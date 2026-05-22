// 06-nutrition-pdf.spec.js — PDF preview + Print Root export birebir senkron
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("PDF preview 2 sayfa render eder + P0K0Y0 yoktur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");
  await page.evaluate(() => document.querySelector('[data-nutrition-view="pdf"]')?.click());
  await page.waitForTimeout(700);

  const pdfState = await page.evaluate(() => {
    const pages = document.querySelectorAll(".bsm-pdf-v13[data-pdf-page]");
    const mealMacros = Array.from(document.querySelectorAll('[data-pdf-page="1"] .bsm-pdf-v13__meal-cal-inline'))
      .map((el) => el.textContent.trim());
    return {
      pageCount: pages.length,
      mealCount: document.querySelectorAll('[data-pdf-page="1"] .bsm-pdf-v13__meal-item').length,
      mealMacros,
      hasZeroMacros: mealMacros.some((t) => /P0[^0-9]/.test(t) || /K0[^0-9]/.test(t) || /Y0[^0-9]/.test(t)),
      hasNaN: mealMacros.some((t) => /NaN|undefined/.test(t)),
      dailyKcal: document.querySelector('[data-pdf-page="1"] .bsm-pdf-v13__kpi--accent strong')?.textContent,
    };
  });

  expect(pdfState.pageCount).toBe(2);
  expect(pdfState.mealCount).toBeGreaterThan(0);
  expect(pdfState.hasZeroMacros, "P0/K0/Y0 hatası olmamalı").toBe(false);
  expect(pdfState.hasNaN, "NaN/undefined olmamalı").toBe(false);
  expect(pdfState.dailyKcal).not.toBe("0 kcal");
  expect(pdfState.dailyKcal).not.toBe("— kcal");

  assertNoErrors(errors);
});

test("Print Root preview ile bire-bir ayni icerik", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");
  await page.evaluate(() => document.querySelector('[data-nutrition-view="pdf"]')?.click());
  await page.waitForTimeout(700);

  // window.print stub'la → modal/dialog açtırmaz
  await page.evaluate(() => { window.print = () => {}; });

  const result = await page.evaluate(() => {
    const previewMacros = Array.from(document.querySelectorAll('#bsmNutritionPdfPages [data-pdf-page="1"] .bsm-pdf-v13__meal-cal-inline'))
      .map((el) => el.textContent.trim());
    document.querySelector("#printNutritionButton")?.click();
    return new Promise((resolve) => {
      setTimeout(() => {
        const root = document.getElementById("nutritionPrintRoot");
        const printMacros = root
          ? Array.from(root.querySelectorAll('[data-pdf-page="1"] .bsm-pdf-v13__meal-cal-inline')).map((el) => el.textContent.trim())
          : [];
        resolve({
          printRootExists: !!root,
          firstChildIsRoot: document.body.firstElementChild?.id === "nutritionPrintRoot",
          previewMacros,
          printMacros,
          match: JSON.stringify(previewMacros) === JSON.stringify(printMacros),
          pageCount: root?.querySelectorAll(".nutrition-print-page").length || 0,
        });
      }, 500);
    });
  });

  expect(result.printRootExists, "Print Root oluşturulmuş").toBe(true);
  expect(result.firstChildIsRoot, "Print Root body'nin ilk çocuğu").toBe(true);
  expect(result.pageCount).toBe(2);
  expect(result.match, "Preview ve Print Root meal makroları aynı").toBe(true);
  expect(result.previewMacros.length).toBeGreaterThan(0);

  await page.waitForTimeout(1500); // cleanup tamamlansın

  assertNoErrors(errors);
});
