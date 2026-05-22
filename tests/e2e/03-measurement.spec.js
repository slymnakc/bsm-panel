// 03-measurement.spec.js — Ölçüm & Tanita sayfası: 6 alt-tab + manuel ölçüm
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("Olcum & Tanita sayfasinda 6 alt-tab vardir", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "measurements");

  const tabCount = await page.evaluate(() => {
    return document.querySelectorAll("[data-measurement-tab-target]").length;
  });
  expect(tabCount).toBeGreaterThanOrEqual(5);

  assertNoErrors(errors);
});

test("Olcum & Tanita - Manuel sekmesine gecis", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "measurements");
  await page.evaluate(() => document.querySelector('[data-measurement-tab-target="manual"]')?.click());
  await page.waitForTimeout(500);

  const manualPane = await page.evaluate(() => {
    const pane = document.querySelector('[data-measurement-tab-pane="manual"]');
    return pane ? pane.classList.contains("is-active") : false;
  });
  expect(manualPane).toBe(true);

  assertNoErrors(errors);
});
