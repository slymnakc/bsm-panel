// 02-members.spec.js — Üyeler sayfası açılıyor + aktif üye bilgisi
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

test("Uyeler sayfasi acilir ve uye listesi render eder", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "members");

  // Members panel görünür
  const visible = await page.evaluate(() => !document.querySelector("#membersPanel")?.classList.contains("is-hidden"));
  expect(visible).toBe(true);

  // localStorage'da en az 1 üye var (test seed + Supabase sync hangisi galip gelirse)
  const memberCount = await page.evaluate(() => {
    try {
      const list = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
      return Array.isArray(list) ? list.length : 0;
    } catch (e) { return 0; }
  });
  expect(memberCount).toBeGreaterThan(0);

  // Aktif üye ID set edilmiş
  const activeId = await page.evaluate(() => localStorage.getItem("formaplan-studio-active-member-id"));
  expect(activeId).toBeTruthy();

  assertNoErrors(errors);
});
