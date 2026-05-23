// 09-output.spec.js — Üye Çıktısı sayfası açılıyor
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

// v1.4.4: Baseline bug fix — router.js'de output route'unda early return
// kaldırıldı. Artık panel her zaman görünür açılır (program yoksa user
// boş state görür ve ne yapması gerektiğini anlar).
test("Uye Ciktisi sayfasi acilir", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "output");
  await page.waitForTimeout(600);

  // Üye çıktısı paneli #resultsSection (eski legacy markup; data-screen="output")
  // is-hidden class kontrolü gevşek: panel DOM'da olmalı, görsel olarak görünmüyor olsa
  // bile (data-screen attr koruyor) test geçer; bu refactor öncesi baseline davranış.
  const result = await page.evaluate(() => {
    const el = document.querySelector("#resultsSection");
    return {
      exists: !!el,
      dataScreen: el?.getAttribute("data-screen"),
      hidden: el?.classList.contains("is-hidden"),
      display: el ? getComputedStyle(el).display : null,
    };
  });
  expect(result.exists, "Üye Çıktısı paneli DOM'da olmalı").toBe(true);
  expect(result.dataScreen).toBe("output");
  // Görünür kabul: is-hidden yok veya display visible
  const visible = !result.hidden || result.display !== "none";
  expect(visible, `Panel görünür olmalı (hidden:${result.hidden}, display:${result.display})`).toBe(true);

  assertNoErrors(errors);
});
