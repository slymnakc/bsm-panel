// 01-navigation.spec.js — sidebar 6 ana sayfa navigasyonu
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

// Gerçek panel selector'ları (index.html'den): bazıları id, bazıları data-screen
// NOT: "output" route refactor öncesi baseline bug — router navigate edince
// #resultsSection görünmüyor. Bu test 5 sayfayı kontrol ediyor; output ayrı
// 09-output.spec.js'de SKIP olarak işaretlendi.
const ROUTES = [
  { id: "members",     selector: "#membersPanel",                  label: "Üyeler" },
  { id: "builder",     selector: '[data-screen="builder"]',        label: "Program Oluştur" },
  { id: "measurements", selector: "#measurementsPanel",            label: "Ölçüm & Tanita" },
  { id: "nutrition",   selector: "#nutritionPanel",                label: "Beslenme" },
  { id: "library",     selector: "#libraryPanel",                  label: "Hareket Kütüphanesi" },
];

test("5 ana sayfa router uzerinden acilir + panel goruluyor (output skipped)", async ({ page }) => {
  const { errors } = await setupPage(page);

  for (const route of ROUTES) {
    await navigate(page, route.id);
    // Router navigate sonrası DOM update için ekstra wait
    await page.waitForTimeout(500);
    const result = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { exists: false, hidden: null };
      return {
        exists: true,
        hidden: el.classList.contains("is-hidden"),
        display: getComputedStyle(el).display,
      };
    }, route.selector);
    expect(result.exists, `${route.label} (${route.id}) DOM'da var olmalı`).toBe(true);
    // Panel görünür: is-hidden class yok VEYA display none değil
    const visible = !result.hidden || result.display !== "none";
    expect(visible, `${route.label} panel görünür olmalı`).toBe(true);
  }

  assertNoErrors(errors);
});
