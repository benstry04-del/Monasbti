import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  // Business tests isolate the cinematic flow; motion has its own suite.
  await page.addInitScript(() => localStorage.setItem("habbIntroSeenVersion", "1"));
});
test("customer to supplier, two approvals, signed contract, declined then successful deposit", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "إعادة ضبط البيانات", exact: true })
    .click();
  await page
    .getByRole("button", { name: "إعادة الضبط الآن", exact: true })
    .click();
  await page.goto("/auth/register");
  await page.getByLabel("الاسم الكامل", { exact: true }).fill("عميلة الاختبار");
  await page
    .getByLabel("البريد الإلكتروني", { exact: true })
    .fill("customer-e2e@example.test");
  await page.getByLabel("رقم الهاتف", { exact: true }).fill("50001234");
  await page.locator('input[name="password"]').fill("Prototype2026!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "إنشاء حساب", exact: true }).click();
  await page.getByLabel("رمز التحقق", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "تحقق وتابع", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/planner");
  for (const next of [
    "تاريخ المناسبة",
    "الموقع والمكان",
    "عدد الضيوف",
    "الميزانية",
    "الخدمات المطلوبة",
  ]) {
    await page.getByRole("button", { name: "التالي", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: next, exact: true }),
    ).toBeVisible();
  }
  for (const name of [
    "قاعة الياقوت للمناسبات",
    "تنسيق الزهور والديكور",
    "بوفيه كويتي فاخر",
    "تصوير فوتوغرافي وفيديو",
  ]) {
    const card = page.locator(".wizard-service").filter({ hasText: name });
    await card.getByRole("button", { name: "اختيار", exact: true }).click();
    await expect(
      card.getByRole("button", { name: "تم الاختيار", exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "مراجعة سلة مناسبتك", exact: true })
    .click();
  await page
    .getByRole("button", { name: "إرسال الطلب للمراجعة", exact: true })
    .click();
  await expect(page.getByText("طلب رقم MN-1088")).toBeVisible();
  await page.goto("/demo");
  await page.getByRole("button", { name: "المورد", exact: true }).click();
  await expect(page).toHaveURL("/supplier");
  for (const vendor of ["v1", "v4", "v5", "v8"]) {
    await page.goto("/demo");
    await page
      .getByRole("combobox", { name: "المورد الذي تمثله في العرض" })
      .selectOption(vendor);
    await expect(page.getByRole("status")).toContainText("تم تبديل");
    await page.goto("/supplier/requests/MN-1088");
    await page
      .getByRole("button", { name: "تأكيد التوفر والتكلفة", exact: true })
      .click();
    await expect(page.getByText("تم التأكيد", { exact: true })).toBeVisible();
  }
  for (const [role, button] of [
    ["الموظف", "اعتماد الموظف"],
    ["المالك", "اعتماد المالك"],
  ]) {
    await page.goto("/demo");
    await page.getByRole("button", { name: role, exact: true }).click();
    await expect(page).toHaveURL("/admin");
    await page.goto("/admin/orders/MN-1088");
    await page.getByRole("button", { name: button, exact: true }).click();
    await page
      .getByRole("textbox", { name: "سبب الاعتماد", exact: true })
      .fill("تمت المراجعة المستقلة بنجاح");
    await page
      .getByRole("button", { name: "تأكيد الإجراء", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "إرسال عرض السعر", exact: true })
    .click();
  await expect(
    page.getByText("بانتظار موافقتك", { exact: true }),
  ).toBeVisible();
  await page.goto("/auth/login");
  await page
    .getByLabel("البريد الإلكتروني", { exact: true })
    .fill("customer-e2e@example.test");
  await page.locator('input[name="password"]').fill("Prototype2026!");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/quote/MN-1088");
  await page
    .getByRole("button", { name: "الموافقة وتجهيز العقد", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "اعتماد وتوقيع إلكتروني", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "أقر وأوافق على الشروط والأحكام",
      exact: true,
    })
    .check();
  await page
    .getByRole("textbox", { name: "التوقيع بالاسم الكامل", exact: true })
    .fill("عميلة الاختبار");
  await page
    .getByRole("button", { name: "اعتماد وتوقيع إلكتروني", exact: true })
    .click();
  await page
    .getByRole("combobox", {
      name: "سيناريو بوابة الدفع التجريبية",
      exact: true,
    })
    .selectOption("decline");
  await page
    .getByRole("checkbox", {
      name: "أوافق على المبلغ وشروط الدفع التجريبي",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: /ادفع الآن/ }).click();
  await expect(
    page.getByRole("heading", { name: "تعذر إتمام الدفع", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "إعادة المحاولة / تغيير الطريقة", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "أوافق على المبلغ وشروط الدفع التجريبي",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: /ادفع الآن/ }).click();
  await expect(
    page.getByRole("heading", { name: "تم الدفع بكل نجاح", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "الانتقال إلى لوحة مناسبتك", exact: true })
    .click();
  await expect(page.locator(".payment-donut")).toContainText("30%");
  await page.reload();
  await expect(page.locator(".payment-donut")).toContainText("30%");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "الوصول غير مسموح", exact: true }),
  ).toBeVisible();
});
test("responsive public pages have no horizontal document overflow", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/services",
      "/packages/p1",
      "/auth/register",
      "/faq",
    ]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        )
        .toBe(true);
    }
  }
});
