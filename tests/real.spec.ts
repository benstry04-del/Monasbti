import AxeBuilder from '@axe-core/playwright';
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("habbIntroSeenVersion", "1"),
  );
});

test("mobile home shows a loader before JavaScript and opens with older browser APIs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined, configurable: true });
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let release!: () => void;
  const delayedScript = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/assets/index-*.js", async route => {
    await delayedScript;
    await route.continue();
  });
  const response = await page.goto("/", { waitUntil: "commit" });
  try {
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.locator(".app-boot")).toBeVisible();
  } finally {
    release();
  }
  await expect(page.locator(".experience-app")).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("heading", { name: "يا هلا ومسهلا.. زارتنا البركة" })).toBeVisible();
  await expect(page.locator(".app-boot")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("real registration, issued verification, persisted authenticated session and server authorization", async ({
  page,
  request,
}) => {
  const email = "e2e-" + Date.now() + "@example.test";
  await page.goto("/");
  await expect(page.locator(".experience-app")).not.toHaveAttribute("inert", "");
  await page.getByRole("link",{name:"افتحوا حساب وابدوا"}).click();
  await expect(page).toHaveURL(/auth\/register\?next=%2Fplanner/);
  await expect(page.locator(".experience-app")).not.toHaveAttribute(
    "inert",
    "",
  );
  await page
    .getByLabel("الاسم الكامل", { exact: true })
    .fill("عميلة تحقق حقيقية");
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
  await page.getByLabel("رقم الهاتف", { exact: true }).fill("96555551234");
  await page.locator('input[name="password"]').fill("Actual-E2E-Password!");
  await page.getByRole("button",{name:"إظهار كلمة المرور"}).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"إخفاء كلمة المرور"}).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "إنشاء حساب", exact: true }).click();
  await expect(page).toHaveURL(/auth\/verify/);
  const response = await request.get("/__test/verification", {
    params: { email },
  });
  const { code } = await response.json();
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("رمز التحقق", { exact: true }).fill(code);
  await page.getByRole("button", { name: "تحقق وتابع", exact: true }).click();
  await expect(page).toHaveURL(/planner$/);
  await page.goto("/dashboard");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /يا هلا ومسهلا عميلة/ }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "الوصول غير مسموح", exact: true }),
  ).toBeVisible();
  const denied = await page.request.get("/api/reports");
  expect(denied.status()).toBe(403);
});
test("real public catalog and auth layout fit approved breakpoints", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [
    [320, 720],
    [360, 800],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of ["/", "/services", "/auth/login"]) {
      await page.goto(route);
      await expect(page.locator(".experience-app")).not.toHaveAttribute(
        "inert",
        "",
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        )
        .toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
test("customer, supplier, staff and owner complete an actual contract workflow without authenticator setup", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const contexts: any[] = [];
  const operators: Record<string,any> = {};
  async function fit(p:any){for(const [width,height]of [[320,720],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080],[844,390]]){await p.setViewportSize({width,height});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}await p.setViewportSize({width:1440,height:900});}
  async function login(role: string) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    contexts.push(context);
    await context.addInitScript(() =>
      localStorage.setItem("habbIntroSeenVersion", "1"),
    );
    const p = await context.newPage();
    await p.goto("/auth/login");
    await expect(p.locator(".experience-app")).not.toHaveAttribute("inert", "");
    await p
      .getByLabel("البريد الإلكتروني", { exact: true })
      .fill(role + "@demo.kw");
    await p.locator('input[name="password"]').fill("E2E-Isolated-Password!");
    await p.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
    await expect(p).toHaveURL(role==='supplier'?/\/supplier$/:['admin','staff'].includes(role)?/\/admin$/:/\/dashboard$/);
    await expect(p.getByLabel('رمز تطبيق المصادقة',{exact:true})).toHaveCount(0);
    return p;
  }
  try {
    const customer = await login("customer");
    async function command(action: string, payload: any, client=customer) {
      const session = await client.request.get("/api/auth/session");
      const { csrfToken } = await session.json();
      const r = await client.request.post("/api/commands", {
        headers: {
          Origin: "http://127.0.0.1:4301",
          "X-CSRF-Token": csrfToken,
          "Idempotency-Key": crypto.randomUUID(),
        },
        data: { action, payload },
      });
      expect(r.ok(), await r.text()).toBe(true);
      return r.json();
    }
    await command("PLANNER", { date: "2031-01-13", location: "حولي" });
    await command("CART_ADD", { id: "s1", qty: 1 });
    const state = await command("SUBMIT", {}),
      id = state.orders[0].id;
    await customer.goto("/bookings/" + id);
    await expect(
      customer.getByText(id, { exact: false }).first(),
    ).toBeVisible();
    const supplier = await login("supplier");
    await supplier.goto("/supplier/requests/" + id);
    await expect(supplier.locator(".experience-app")).not.toHaveAttribute(
      "inert",
      "",
    );
    await supplier
      .getByRole("button", { name: "تأكيد التوفر والتكلفة", exact: true })
      .click();
    await expect(supplier.locator(".supplier-line .badge")).toContainText(
      "تم التأكيد",
    );
    await fit(supplier);
    await supplier.locator('input[type="file"]').setInputFiles('public/assets/coffee.jpg');
    await expect(supplier.getByRole('link',{name:'coffee.jpg',exact:true})).toBeVisible();
    const filePath=await supplier.getByRole('link',{name:'coffee.jpg',exact:true}).getAttribute('href');
    expect((await supplier.request.get(filePath!)).status()).toBe(200);
    expect((await customer.request.get(filePath!)).status()).toBe(403);
    for (const role of ["staff", "admin"]) {
      const p = await login(role);
      operators[role]=p;
      await p.goto("/admin/orders/" + id);
      await expect(p.locator(".experience-app")).not.toHaveAttribute(
        "inert",
        "",
      );
      await p
        .getByRole("button", {
          name: role === "admin" ? "اعتماد المالك" : "اعتماد الموظف",
          exact: true,
        })
        .click();
      await p
        .getByRole("textbox", { name: "سبب الاعتماد", exact: true })
        .fill("مراجعة فعلية مستقلة للاختبار");
      await p
        .getByRole("button", { name: "تأكيد الإجراء", exact: true })
        .click();
      await expect(p.getByRole("dialog")).toHaveCount(0);
      if (role === "admin") {
        await p
          .getByRole("button", { name: "إرسال عرض السعر", exact: true })
          .click();
        await expect(
          p.getByText("بانتظار موافقتك", { exact: true }).first(),
        ).toBeVisible();
        await fit(p);
      }
    }
    await customer.goto("/quote/" + id);
    await expect(customer.locator(".experience-app")).not.toHaveAttribute(
      "inert",
      "",
    );
    await customer
      .getByRole("button", { name: "الموافقة وتجهيز العقد", exact: true })
      .click();
    await customer
      .getByRole("checkbox", {
        name: "أقر وأوافق على الشروط والأحكام",
        exact: true,
      })
      .check();
    await customer
      .getByRole("textbox", { name: "التوقيع بالاسم الكامل", exact: true })
      .fill("عميل بيئة التطوير");
    await customer
      .getByRole("button", { name: "اعتماد وتوقيع إلكتروني", exact: true })
      .click();
    await expect(customer).toHaveURL(new RegExp("/checkout/" + id));
    const document = await customer.request.get("/api/contracts/" + id);
    expect(document.status()).toBe(200);
    expect(await document.text()).toContain("عميل بيئة التطوير");
    await command('CHANGES',{id,reason:'إضافة خدمة بملحق مستقل'});
    const catalog=await (await operators.admin.request.get('/api/state')).json();
    const source=catalog.services.find((s:any)=>s.id==='s1');
    const extra=catalog.services.find((s:any)=>s.id!=='s1' && s.supplierId===source.supplierId);
    expect(extra).toBeTruthy();
    await command('AMENDMENT_CREATE',{id,serviceId:extra.id},operators.staff);
    await command('AMENDMENT_CONFIRM',{id},supplier);
    await command('AMENDMENT_APPROVE',{id,reason:'مراجعة الموظف للملحق'},operators.staff);
    await command('AMENDMENT_APPROVE',{id,reason:'مراجعة المالك للملحق'},operators.admin);
    await customer.goto('/bookings/'+id);
    const acceptAmendment=customer.getByRole('button',{name:'الموافقة والتوقيع على الملحق',exact:true});
    await expect(acceptAmendment).toBeDisabled();
    await customer.getByRole('checkbox',{name:'أقر بالموافقة على بنود الملحق ومبلغه',exact:true}).check();
    await customer.getByLabel('التوقيع على الملحق بالاسم الكامل',{exact:true}).fill('عميل بيئة التطوير');
    await acceptAmendment.click();
    const supplement=customer.getByRole('link',{name:/تنزيل الملحق الموثق/}).first();
    await expect(supplement).toBeVisible();
    const href=await supplement.getAttribute('href');
    const supplementFile=await customer.request.get(href!);
    expect(supplementFile.status()).toBe(200);
    expect(await supplementFile.text()).toContain('ملحق تعديل عقد تنظيم مناسبة');
    await customer.goto('/checkout/'+id);
    await customer.screenshot({
      path: "docs/production/real-checkout-desktop.png",
      fullPage: true,
    });
    await fit(customer);await customer.setViewportSize({width:390,height:844});await customer.screenshot({path:'docs/production/real-checkout-mobile.png',fullPage:true});
    const vendor=catalog.suppliers.find((v:any)=>v.id===source.supplierId);
    await command('SUPPLIER_SAVE',{...vendor,payoutRecipientId:'e2e-approved-beneficiary'},operators.admin);
    expect((await customer.request.post('/__test/complete-booking/'+id)).ok()).toBe(true);
    const admin=operators.admin,staff=operators.staff;
    await staff.goto('/admin/settlements');
    await expect(staff.locator('.experience-app')).not.toHaveAttribute('inert','');
    await expect(staff.getByRole('button',{name:'طلب تسوية المستحق',exact:true})).toBeVisible();
    await staff.getByRole('button',{name:'طلب تسوية المستحق',exact:true}).click();
    await staff.getByLabel('سبب اعتماد التسوية',{exact:true}).fill('تدقيق التكلفة والمستفيد من الموظف');
    await staff.getByRole('button',{name:'تسجيل الموافقة المستقلة',exact:true}).click();
    await expect(staff.getByText('الموافقات: الموظف',{exact:true})).toBeVisible();
    await admin.goto('/admin/settlements');
    await expect(admin.locator('.experience-app')).not.toHaveAttribute('inert','');
    await admin.getByLabel('سبب اعتماد التسوية',{exact:true}).fill('تدقيق مستقل من المالك');
    const settlementApproval=admin.waitForResponse(r=>r.url().includes('/api/settlements/') && r.url().endsWith('/approve') && r.request().method()==='POST');
    await admin.getByRole('button',{name:'تسجيل الموافقة المستقلة',exact:true}).click();
    const approval=await settlementApproval;expect(approval.status(),await approval.text()).toBe(200);
    await expect(admin.getByRole('button',{name:'إرسال التحويل المعتمد',exact:true})).toBeDisabled();
    await expect(admin.getByText('معتمدة للتحويل',{exact:true})).toBeVisible();
    await fit(admin);await admin.evaluate(()=>window.scrollTo(0,0));await admin.screenshot({path:'docs/production/supplier-settlements-desktop.png',fullPage:true});
    await supplier.goto('/supplier/settlements');
    await expect(supplier.locator('.experience-app')).not.toHaveAttribute('inert','');
    await expect(supplier.getByText('معتمدة للتحويل',{exact:true})).toBeVisible();
    await expect(supplier.getByRole('button',{name:'إرسال التحويل المعتمد',exact:true})).toHaveCount(0);
    await fit(supplier);await supplier.setViewportSize({width:390,height:844});await supplier.screenshot({path:'docs/production/supplier-settlements-mobile.png',fullPage:true});
    await admin.goto('/admin/integrations');
    await expect(admin.getByRole('heading',{name:'الربط والتفعيل',exact:true,level:2})).toBeVisible();
    const paymentCard=admin.getByRole('region',{name:'دفع العملاء',exact:true});
    await paymentCard.getByLabel('مفتاح التاجر',{exact:true}).fill('e2e-secret-not-returned-to-browser');
    await paymentCard.getByLabel('سر إشعارات الدفع',{exact:true}).fill('e2e-webhook-secret-not-returned');
    await paymentCard.getByLabel('كلمة مرور المالك لتأكيد التغيير',{exact:true}).fill('E2E-Isolated-Password!');
    await paymentCard.getByRole('button',{name:'حفظ المسودة',exact:true}).click();
    await expect(paymentCard.getByRole('status')).toContainText('حُفظت المسودة');
    await expect(paymentCard.getByLabel('مفتاح التاجر',{exact:true})).toHaveValue('');
    const metadata=await admin.request.get('/api/admin/integrations');
    expect(await metadata.text()).not.toContain('e2e-secret-not-returned-to-browser');
    expect((await staff.request.get('/api/admin/integrations')).status()).toBe(403);
    await fit(admin);
    await admin.screenshot({path:'docs/production/integrations-desktop.png',fullPage:true});
    await admin.setViewportSize({width:390,height:844});
    await admin.screenshot({path:'docs/production/integrations-mobile.png',fullPage:true});
    await admin.goto('/admin/orders');
    await expect(admin.getByLabel('ترقيم النتائج')).toBeVisible();
    await expect(admin.getByRole('link',{name:id,exact:true}).first()).toBeVisible();
    const overview=await (await admin.request.get('/api/state?route=%2Fadmin')).json();
    expect(overview.orders.length).toBeLessThanOrEqual(13);expect(overview.analytics.newOrders).toBeGreaterThanOrEqual(0);
    const reportLoaded=admin.waitForResponse(r=>r.url().includes('/api/report-summary?') && r.status()===200);
    await admin.goto('/admin/reports');const reportResponse=await reportLoaded;
    expect((await reportResponse.json()).count).toBeGreaterThanOrEqual(1);
    await fit(admin);
    await customer.goto('/dashboard');
    await expect(customer.getByRole('heading',{name:'كل مناسباتك',exact:true})).toBeVisible();
    await expect(customer.getByLabel('ترقيم النتائج')).toBeVisible();
    await supplier.goto('/supplier/requests');
    await expect(supplier.getByLabel('ترقيم النتائج')).toBeVisible();

  } finally {
    await Promise.allSettled(contexts.map((c) => c.close()));
  }
});


test('Arabic public and authentication views pass automated accessibility checks',async({page})=>{
  test.setTimeout(90000);
  const findings:any[]=[];
  for(const [width,height]of [[390,844],[768,1024],[1440,900]]){
    await page.setViewportSize({width,height});
    for(const route of ['/','/services','/auth/login']){
      await page.goto(route);await expect(page.locator('.experience-app')).not.toHaveAttribute('inert','');
      const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      findings.push({width,route,violations:results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
      await expect(page.locator('html')).toHaveAttribute('lang','ar');
      await expect(page.getByRole('button',{name:'EN',exact:true})).toHaveCount(0);
    }
  }
  await (await import('node:fs/promises')).writeFile('docs/production/accessibility.json',JSON.stringify(findings,null,2));
  expect(findings.filter(f=>f.violations.length)).toEqual([]);
});

test("owner branding additions and removals reach public and login pages", async ({page,browser}) => {
  await page.goto("/auth/login");
  await expect(page.locator(".experience-app")).not.toHaveAttribute("inert", "");
  await page.getByLabel("البريد الإلكتروني",{exact:true}).fill("admin@demo.kw");
  await page.locator('input[name="password"]').fill("E2E-Isolated-Password!");
  await page.getByRole("button",{name:"تسجيل الدخول",exact:true}).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings");
  await expect(page.locator(".experience-app")).not.toHaveAttribute("inert", "");
  await page.getByLabel("اسم العلامة بالعربية",{exact:true}).fill("هوية الاختبار");
  await page.getByLabel("الاسم اللاتيني",{exact:true}).fill("TRIAL BRAND");
  await page.getByLabel("الشعار الكامل للفوتر والدخول والوثائق",{exact:true}).setInputFiles("public/brand-motion/logo/habb-logo-v1.webp");
  const save=page.getByRole("button",{name:"حفظ الهوية",exact:true});
  await save.click();
  await expect(page).toHaveTitle("هوية الاختبار | TRIAL BRAND");
  const context=await browser.newContext({baseURL:"http://127.0.0.1:4301"});
  try {
    const guest=await context.newPage();
    await guest.goto("/auth/login");
    await expect(guest).toHaveTitle("هوية الاختبار | TRIAL BRAND");
    await expect(guest.locator(".logo--auth img")).toHaveAttribute("src", /^data:image\/webp;base64,/);
    await expect(guest.locator(".experience-app")).not.toHaveAttribute("inert", "");
    await page.getByRole("button",{name:"إخفاء الهوية بالكامل",exact:true}).click();
    await save.click();
    await expect(page).toHaveTitle("منصة المناسبات");
    await guest.reload();
    await expect(guest).toHaveTitle("منصة المناسبات");
    await expect(guest.locator(".logo--auth img")).toHaveCount(0);
    await expect(guest.locator('link[rel="icon"]')).toHaveCount(0);
  } finally { await context.close(); }
});

test("admin navigation is searchable, responsive and scoped to the signed-in role", async ({page,browser}) => {
  test.setTimeout(90000);
  async function login(target, role) {
    await target.goto("/auth/login");
    await expect(target.locator(".experience-app")).not.toHaveAttribute("inert", "");
    await target.getByLabel("البريد الإلكتروني",{exact:true}).fill(role + "@demo.kw");
    await target.locator('input[name="password"]').fill("E2E-Isolated-Password!");
    await target.getByRole("button",{name:"تسجيل الدخول",exact:true}).click();
    await expect(target).toHaveURL(/\/admin$/);
  }
  await page.setViewportSize({width:1440,height:900});
  await login(page,"admin");
  const desktop = page.getByRole("navigation",{name:"أقسام الإدارة"});
  await expect(desktop.getByRole("link",{name:"لوحة الإدارة",exact:true})).toHaveAttribute("aria-current","page");
  await expect(desktop.locator('a[href="/demo"]')).toHaveCount(0);
  const search=page.getByRole("searchbox",{name:"ابحث في أقسام الإدارة"});
  await search.fill("التفعيل");
  await expect(desktop.getByRole("link")).toHaveCount(1);
  await desktop.getByRole("link",{name:"الربط والتفعيل",exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/integrations$/);
  await expect(desktop.getByRole("link",{name:"الربط والتفعيل",exact:true})).toHaveAttribute("aria-current","page");

  for (const width of [320,390,768,844]) {
    await page.setViewportSize({width,height:width===844?390:850});
    const open=page.getByRole("button",{name:"فتح قائمة الإدارة"});
    await open.click();
    const drawer=page.getByRole("dialog",{name:"قائمة الإدارة"});
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button",{name:"إغلاق قائمة الإدارة"})).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(open).toBeFocused();
  }
  await page.getByRole("button",{name:"فتح قائمة الإدارة"}).click();
  const mobile = page.getByRole("dialog",{name:"قائمة الإدارة"});
  await mobile.getByRole("searchbox").fill("الطلبات");
  await mobile.getByRole("link",{name:"الطلبات",exact:true}).click();
  await expect(mobile).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  const context=await browser.newContext({baseURL:"http://127.0.0.1:4301",viewport:{width:1440,height:900}});
  try {
    await context.addInitScript(()=>localStorage.setItem("habbIntroSeenVersion","1"));
    const staff=await context.newPage();
    await login(staff,"staff");
    const staffNav=staff.getByRole("navigation",{name:"أقسام الإدارة"});
    await expect(staffNav.getByRole("link",{name:"تسليم الإشعارات",exact:true})).toBeVisible();
    await expect(staffNav.getByRole("link",{name:"الربط والتفعيل",exact:true})).toHaveCount(0);
    expect((await staff.request.get("/api/admin/integrations")).status()).toBe(403);
  } finally {await context.close();}
});
