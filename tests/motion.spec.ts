import { test, expect } from "@playwright/test";

const lab = "/demo/motion";
async function enterLab(page: any) {
  await page.goto(lab);
  await expect(
    page.getByRole("heading", { name: "مختبر تجربة هَبّ السعد", exact: true }),
  ).toBeVisible({ timeout: 15000 });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("habbIntroSeenVersion", "1"),
  );
});
test("returning boot never requests the film; manual promo restores scroll and focus", async ({
  page,
}) => {
  const films: string[] = [];
  page.on("request", (r) => {
    if (/intro-v1.*\.(webm|mp4)/.test(r.url())) films.push(r.url());
  });
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "شاهد التجربة",
    exact: true,
  });
  await expect(trigger).toBeVisible({ timeout: 15000 });
  expect(films).toHaveLength(0);
  await trigger.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "مشاهدة فيلم هَبّ السعد", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("video")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
});
test("natural completion records viewed; a newer version is shown once", async ({
  page,
}) => {
  test.setTimeout(60000);
  await enterLab(page);
  await page
    .getByRole("button", { name: "محاكاة أول زيارة", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "التجربة الأولى — فيلم هَبّ السعد",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveJSProperty("muted", true);
  await expect(
    page.getByRole("heading", { name: "مختبر تجربة هَبّ السعد", exact: true }),
  ).toBeVisible({ timeout: 35000 });
  expect(
    await page.evaluate(() => localStorage.getItem("habbIntroSkipped")),
  ).toBe("false");
  await page
    .getByRole("button", {
      name: "رفع إصدار المقدمة وإعادة التشغيل",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "تخطي", exact: true })
    .click({ timeout: 15000 });
  await expect(page.locator("[data-seen-version]")).toHaveText("2");
});
test("reduced motion is a paused poster, keyboard skip reaches the app without WebGL", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterLab(page);
  await page
    .getByRole("button", { name: "محاكاة أول زيارة", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "تشغيل الفيديو", exact: true }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveJSProperty("paused", true);
  await expect(page.locator("canvas")).toHaveCount(0);
  await page
    .getByRole("button", { name: "شاهد التجربة لاحقًا", exact: true })
    .click();
  await expect(page.locator("[data-seen-version]")).toHaveText("1");
});
test("failed film fails open and the same splash continues while app is preparing", async ({
  page,
}) => {
  await enterLab(page);
  await page
    .getByRole("combobox", { name: "توفر الفيلم", exact: true })
    .selectOption("failed");
  await page
    .getByRole("button", { name: "محاكاة أول زيارة", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "مختبر تجربة هَبّ السعد", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page
    .getByRole("combobox", { name: "مصيّر الحركة", exact: true })
    .selectOption("fallback");
  await page
    .getByRole("combobox", { name: "تأخر جاهزية التطبيق", exact: true })
    .selectOption("6000");
  await page
    .getByRole("button", { name: "معاينة Splash عائد", exact: true })
    .click();
  await expect(
    page.locator('[data-experience-state="LOADING_CONTINUATION"]'),
  ).toBeVisible({ timeout: 4000 });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.locator('.experience-overlay [data-renderer="css"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "مختبر تجربة هَبّ السعد", exact: true }),
  ).toBeVisible({ timeout: 10000 });
});
test("real task progress uses contextual loading and never announces verified payment", async ({
  page,
}) => {
  test.setTimeout(40000);
  await enterLab(page);
  await page
    .getByRole("combobox", { name: "محاكاة الشبكة ووقت Mock API", exact: true })
    .selectOption("slow4g");
  await page
    .getByRole("combobox", { name: "سياق التحميل", exact: true })
    .selectOption("payment");
  await page
    .getByRole("button", { name: "خمس مهام بتقدم موثّق", exact: true })
    .click();
  await expect(page.locator(".habb-loading-overlay")).toBeVisible({
    timeout: 7000,
  });
  await expect(page.locator(".habb-loading-overlay progress")).toBeVisible();
  await expect(page.locator("[data-verified-success]")).toHaveCount(0);
  await expect(page.locator(".habb-loading-overlay")).toHaveCount(0, {
    timeout: 25000,
  });
  await expect(
    page.getByText("اكتملت خمس عمليات فعلية من Mock API", { exact: false }),
  ).toBeVisible();
});
test("promo and film controls fit ten reference viewports", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "شاهد التجربة",
    exact: true,
  });
  await expect(trigger).toBeVisible({ timeout: 15000 });
  const sizes = [
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
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await trigger.click();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    expect(
      await page.locator(".cinematic-player button").evaluateAll(
        (buttons) =>
          buttons.length > 0 &&
          buttons.every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.left >= 0 &&
              r.top >= 0 &&
              r.right <= innerWidth + 1 &&
              r.bottom <= innerHeight + 1
            );
          }),
      ),
    ).toBe(true);
  }
});
