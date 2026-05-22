// 08-library.spec.js — Hareket Kütüphanesi: kartlar + video butonları
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("Hareket Kutuphanesi sayfasi egzersizleri render eder", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(800);

  const libState = await page.evaluate(() => ({
    exerciseCount: document.querySelectorAll(".library-exercise").length,
    videoTriggerCount: document.querySelectorAll("[data-exercise-video-open]").length,
  }));

  expect(libState.exerciseCount).toBeGreaterThan(30); // en az 30 egzersiz görünür
  expect(libState.videoTriggerCount).toBeGreaterThan(0); // video butonları render edildi

  assertNoErrors(errors);
});

test("Video butonu YouTube search URL ile yeni sekme acmaya hazir", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    window.__openedUrls = [];
    window.open = (url) => { window.__openedUrls.push(url); return null; };
  });

  await page.evaluate(() => document.querySelector("[data-exercise-video-open]")?.click());
  await page.waitForTimeout(500);

  const opened = await page.evaluate(() => window.__openedUrls);
  expect(opened.length).toBe(1);
  expect(opened[0]).toMatch(/youtube\.com\/results\?search_query=/);

  assertNoErrors(errors);
});
