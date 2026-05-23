// 04-nutrition-create.spec.js — Beslenme planı oluştur akışı
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("Beslenme sayfasi acilir + hero meta dolu", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");

  // Panel görünür
  const visible = await page.evaluate(() => !document.querySelector("#nutritionPanel")?.classList.contains("is-hidden"));
  expect(visible).toBe(true);

  // Hero elementleri dolu (DOM-bazlı, state global gerekmez)
  const heroState = await page.evaluate(() => ({
    memberName: document.querySelector("#bsmNutritionMemberName")?.textContent || "",
    dailyCal: document.querySelector("#bsmNutritionDailyCalories")?.textContent || "",
    macroSummary: document.querySelector("#bsmNutritionMacroSummary")?.textContent || "",
  }));

  // v1.4.4: Test mode aktif — Supabase override edemez, test üye sabit
  expect(heroState.memberName).toContain("Test Üye");
  expect(heroState.dailyCal).not.toBe("—");
  expect(heroState.macroSummary).not.toBe("—");

  assertNoErrors(errors);
});

test("Beslenme plani olustur butonu meal listesi + totals olusturur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");

  // Beslenme planı oluştur butonuna click
  await page.evaluate(() => document.querySelector("#generateNutritionButton")?.click());
  await page.waitForTimeout(900);

  // DOM-bazlı assertion: timeline meal'leri ve totals'lar dolu
  const result = await page.evaluate(() => ({
    timelineMealCount: document.querySelectorAll("#bsmNutritionTimeline .bsm-nutrition-timeline__item").length,
    totalCalories: document.querySelector("#bsmNutritionTotalCalories")?.textContent || "",
    totalProtein: document.querySelector("#bsmNutritionTotalProtein")?.textContent || "",
    saveBtnHidden: document.querySelector("#saveNutritionButton")?.classList.contains("is-hidden"),
  }));

  expect(result.timelineMealCount).toBeGreaterThanOrEqual(3);
  // "2696 kcal" gibi sayı içeriyor
  expect(result.totalCalories).toMatch(/\d+/);
  expect(result.totalProtein).toMatch(/\d+/);
  // Save butonu artık görünür olmalı
  expect(result.saveBtnHidden).toBe(false);

  assertNoErrors(errors);
});
