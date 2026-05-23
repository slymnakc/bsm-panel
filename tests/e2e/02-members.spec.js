// 02-members.spec.js — Üyeler sayfası açılıyor + aktif üye bilgisi
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

test("Uyeler sayfasi acilir ve test seed uyesi korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "members");

  // Members panel görünür
  const visible = await page.evaluate(() => !document.querySelector("#membersPanel")?.classList.contains("is-hidden"));
  expect(visible).toBe(true);

  // v1.4.4: Test mode aktif — Supabase override edemez, seed üye korunur
  const stateSnapshot = await page.evaluate(() => window.BSMTestApi?.getStateSnapshot());
  expect(stateSnapshot).toBeTruthy();
  expect(stateSnapshot.activeMemberId).toBe(DEFAULT_MEMBER.id);
  expect(stateSnapshot.membersCount).toBeGreaterThan(0);

  // Test mode bayrağı runtime'da true
  const inTestMode = await page.evaluate(() => window.BSMTestApi?.isTestMode());
  expect(inTestMode).toBe(true);

  // Test üye adı sayfada görünüyor (Supabase override yok)
  const hasName = await page.evaluate((name) => (document.body.textContent || "").includes(name), DEFAULT_MEMBER.profile.memberName);
  expect(hasName).toBe(true);

  assertNoErrors(errors);
});
