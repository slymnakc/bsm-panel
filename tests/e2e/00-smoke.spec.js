// 00-smoke.spec.js — uygulama açılıyor + 0 error
const { test, expect } = require("@playwright/test");
const { setupPage, assertNoErrors } = require("./_helpers");

test("uygulama acilir ve global API'ler hazir", async ({ page }) => {
  const { errors } = await setupPage(page);

  // BSM* global'ları yüklenmiş mi
  const globals = await page.evaluate(() => ({
    router: typeof window.BSMRouter,
    nutritionEngine: typeof window.BSMNutritionPlanEngine,
    storageService: typeof window.BSMStorageService,
    measurementReport: typeof window.BSMMeasurementReport,
    libraryUi: typeof window.BSMLibraryUI,
  }));

  expect(globals.router).toBe("object");
  expect(globals.nutritionEngine).toBe("object");
  expect(globals.storageService).toBe("object");
  expect(globals.libraryUi).toBe("object");

  // Body var ve auth-required gizli
  const bodyState = await page.evaluate(() => ({
    bodyClass: document.body.className,
    panelCount: document.querySelectorAll(".screen-panel").length,
  }));
  expect(bodyState.panelCount).toBeGreaterThan(0);

  assertNoErrors(errors);
});
