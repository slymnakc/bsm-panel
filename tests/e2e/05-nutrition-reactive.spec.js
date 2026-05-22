// 05-nutrition-reactive.spec.js — Kalori/makro/öğün sayısı değişince preview güncellenir
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("Kalori degisince preview totals guncellenir", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");

  await page.evaluate(() => {
    const inp = document.querySelector("#nutritionCaloriesInput");
    if (!inp) throw new Error("calories input bulunamadi");
    inp.value = "3500";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(600);

  const totals = await page.evaluate(() => ({
    cal: document.querySelector("#bsmNutritionTotalCalories")?.textContent,
    dailyCal: document.querySelector("#bsmNutritionDailyCalories")?.textContent,
  }));
  expect(totals.cal).toContain("3500");
  expect(totals.dailyCal).toContain("3500");

  assertNoErrors(errors);
});

test("Ogun sayisi degisince timeline kart sayisi degisir", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");

  await page.evaluate(() => document.querySelector('[data-nutrition-input="mealCount"] button[data-value="6"]')?.click());
  await page.waitForTimeout(600);

  const mealCount = await page.evaluate(() => document.querySelectorAll("#bsmNutritionTimeline .bsm-nutrition-timeline__item").length);
  expect(mealCount).toBe(6);

  assertNoErrors(errors);
});

test("Tum plani cesitlendir butonu meal foods'unu degistirir", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");

  // Diversify öncesi mevcut meal foods'unu yakala
  const beforeFoods = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("#bsmNutritionTimeline .bsm-nutrition-timeline__item"))
      .slice(0, 3)
      .map((it) => Array.from(it.querySelectorAll(".bsm-nutrition-timeline__foods li")).map((li) => li.textContent.trim()).join("|"));
  });

  // "Tüm planı çeşitlendir" butonu
  await page.evaluate(() => document.querySelector('[data-nutrition-action="diversify-all"]')?.click());
  await page.waitForTimeout(800);

  // Diversify sonrası foods'u yakala
  const afterFoods = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("#bsmNutritionTimeline .bsm-nutrition-timeline__item"))
      .slice(0, 3)
      .map((it) => Array.from(it.querySelectorAll(".bsm-nutrition-timeline__foods li")).map((li) => li.textContent.trim()).join("|"));
  });

  // En az bir öğünün foods değişmiş olmalı
  expect(JSON.stringify(beforeFoods)).not.toBe(JSON.stringify(afterFoods));

  assertNoErrors(errors);
});
