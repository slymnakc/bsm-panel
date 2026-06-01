// 23-macrocycle-cover.spec.js — M1b.3 read-only macrocycle band regression
// Cover (Program Summary) + Output ekranında macrocycle bilgisi gösterilir.
// Sessions alias mantığına dokunulmaz; sadece state.activeProgram.weeks +
// macrocycle + currentWeekIndex okunup DOM'a yansıtılır.
//
// Kontroller:
//   1. Cover'a macrocycle band DOM elementi eklendi
//   2. totalWeeks=1 (default) → band hidden
//   3. 8 hafta program render → band visible + correct title + "Hafta 1 / 8" + progress %12.5
//   4. currentWeekIndex yoksa → 1 kabul edilir
//   5. Next deload doğru hesaplanır (deloadCadence=4, current=1 → "Hafta 4")
//   6. Next deload yok ise (deloadCadence=0) → satır hidden
//   7. Manual model → "Manual" label
//   8. Output ekranında (router) cover band aynı bilgiyi gösterir
//   9. console / page / network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

function mockProgramFactory({
  totalWeeks = 1,
  model = "linear",
  deloadCadence = 0,
  deltaPercent = 2.5,
  currentWeekIndex = null,
} = {}) {
  return {
    schemaVersion: 4,
    title: "Test Program — Macrocycle",
    createdAtIso: new Date().toISOString(),
    createdAt: new Date().toLocaleDateString("tr-TR"),
    overview: [["Üye", "Test Üye"]],
    coachNote: "Test note",
    progression: [],
    guidance: [],
    coverage: [],
    macrocycle: { totalWeeks, model, deloadCadence, progressionRule: { type: "linear", deltaPercent } },
    weeks: Array.from({ length: totalWeeks }, (_, i) => ({
      weekIndex: i + 1,
      isDeload: deloadCadence > 0 && (i + 1) % deloadCadence === 0,
      intensityFactor: 1.0,
      sessions: [{ day: "monday", title: "Test Day", exercises: [] }],
    })),
    currentWeekIndex: currentWeekIndex,  // null → engine default'a düşmeli
    sessions: [{ day: "monday", title: "Test Day", exercises: [] }],
    rawData: { memberName: "Test Üye", trainerName: "Test Trainer", goal: "muscle-gain", level: "intermediate", days: ["monday"] },
  };
}

test("Macrocycle cover band — read-only display + state weeks integration", async ({ page }) => {
  const { errors } = await setupPage(page);

  // ─── DOĞRULAMA 1: Cover'a macrocycle band DOM elementi eklendi ───────
  const initialDom = await page.evaluate(() => ({
    coverMacrocycle: !!document.querySelector("#coverMacrocycle"),
    coverMacroTitle: !!document.querySelector("#coverMacroTitle"),
    coverMacroCurrent: !!document.querySelector("#coverMacroCurrent"),
    coverMacroProgressFill: !!document.querySelector("#coverMacroProgressFill"),
    coverMacroNextDeload: !!document.querySelector("#coverMacroNextDeload"),
    macroBandAttr: !!document.querySelector('[data-macrocycle-band]'),
  }));
  expect(initialDom.coverMacrocycle, "#coverMacrocycle band DOM'da olmalı").toBe(true);
  expect(initialDom.coverMacroTitle, "#coverMacroTitle mevcut").toBe(true);
  expect(initialDom.coverMacroCurrent, "#coverMacroCurrent mevcut").toBe(true);
  expect(initialDom.coverMacroProgressFill, "#coverMacroProgressFill mevcut").toBe(true);
  expect(initialDom.coverMacroNextDeload, "#coverMacroNextDeload mevcut").toBe(true);
  expect(initialDom.macroBandAttr, "[data-macrocycle-band] attribute mevcut").toBe(true);

  // ─── DOĞRULAMA 2: totalWeeks=1 (default) → band hidden ────────────────
  const oneWeek = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      hidden: document.querySelector("#coverMacrocycle").hidden,
    };
  }, mockProgramFactory({ totalWeeks: 1 }));
  expect(oneWeek.hidden, "totalWeeks=1 ise macrocycle band hidden").toBe(true);

  // ─── DOĞRULAMA 3: 8 hafta Linear → band visible + correct labels ──────
  const eightWeekLinear = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      hidden: document.querySelector("#coverMacrocycle").hidden,
      title: (document.querySelector("#coverMacroTitle")?.textContent || "").trim(),
      current: (document.querySelector("#coverMacroCurrent")?.textContent || "").trim(),
      progressStyleWidth: document.querySelector("#coverMacroProgressFill")?.style.width || "",
      nextDeload: (document.querySelector("#coverMacroNextDeload")?.textContent || "").trim(),
      nextDeloadHidden: document.querySelector("#coverMacroNextDeload")?.hidden,
    };
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: 1 }));

  expect(eightWeekLinear.hidden, "8 hafta program → band visible").toBe(false);
  expect(/8\s*Haftalık/i.test(eightWeekLinear.title), `Title "8 Haftalık" içermeli (gerçek: "${eightWeekLinear.title}")`).toBe(true);
  expect(/Linear/i.test(eightWeekLinear.title), "Title 'Linear' içermeli").toBe(true);
  expect(/Hafta\s*1\s*\/\s*8/i.test(eightWeekLinear.current), `"Hafta 1 / 8" gösterilmeli (gerçek: "${eightWeekLinear.current}")`).toBe(true);
  // Progress: 1/8 → %12.5 (~12 veya 12.5)
  const widthMatch = eightWeekLinear.progressStyleWidth.match(/([\d.]+)/);
  const widthValue = widthMatch ? Number(widthMatch[1]) : 0;
  expect(widthValue, `Progress width yaklaşık 12.5% (gerçek: ${eightWeekLinear.progressStyleWidth})`).toBeGreaterThanOrEqual(10);
  expect(widthValue, `Progress width yaklaşık 12.5%`).toBeLessThanOrEqual(15);
  expect(eightWeekLinear.nextDeloadHidden, "Next deload satırı görünür").toBe(false);
  expect(/Hafta\s*4/i.test(eightWeekLinear.nextDeload), `Next deload "Hafta 4" (gerçek: "${eightWeekLinear.nextDeload}")`).toBe(true);

  // ─── DOĞRULAMA 4: currentWeekIndex null → 1 kabul edilir ──────────────
  const noCurrentIndex = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      current: (document.querySelector("#coverMacroCurrent")?.textContent || "").trim(),
      progressWidth: document.querySelector("#coverMacroProgressFill")?.style.width || "",
    };
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: null }));

  expect(/Hafta\s*1\s*\/\s*8/i.test(noCurrentIndex.current), `currentWeekIndex=null → "Hafta 1 / 8" fallback (gerçek: "${noCurrentIndex.current}")`).toBe(true);

  // ─── DOĞRULAMA 5: Next deload yok (deloadCadence=0) → satır hidden ────
  const noDeload = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      nextDeloadHidden: document.querySelector("#coverMacroNextDeload")?.hidden,
    };
  }, mockProgramFactory({ totalWeeks: 6, model: "linear", deloadCadence: 0, currentWeekIndex: 1 }));

  expect(noDeload.nextDeloadHidden, "deloadCadence=0 ise Next deload satırı hidden").toBe(true);

  // ─── DOĞRULAMA 6: Manual model → "Manual" label ───────────────────────
  const manualMode = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      hidden: document.querySelector("#coverMacrocycle").hidden,
      title: (document.querySelector("#coverMacroTitle")?.textContent || "").trim(),
      nextDeloadHidden: document.querySelector("#coverMacroNextDeload")?.hidden,
    };
  }, mockProgramFactory({ totalWeeks: 6, model: "manual", deloadCadence: 4, currentWeekIndex: 2 }));

  expect(manualMode.hidden, "6 hafta Manual → band visible").toBe(false);
  expect(/Manual/i.test(manualMode.title), `Title "Manual" içermeli (gerçek: "${manualMode.title}")`).toBe(true);
  expect(manualMode.nextDeloadHidden, "Manual'de Next deload hidden (deloadCadence ignore)").toBe(true);

  // ─── DOĞRULAMA 7: Current week sonraki deload'dan SONRA ise sıradaki bulunur ──
  // 8 hafta, deload=4, currentWeekIndex=5 → next deload Hafta 8
  const afterDeload = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      nextDeload: (document.querySelector("#coverMacroNextDeload")?.textContent || "").trim(),
      nextDeloadHidden: document.querySelector("#coverMacroNextDeload")?.hidden,
    };
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: 5 }));

  expect(afterDeload.nextDeloadHidden, "Hafta 5 aktif → sıradaki deload var").toBe(false);
  expect(/Hafta\s*8/i.test(afterDeload.nextDeload), `Hafta 5 aktif → next deload "Hafta 8" (gerçek: "${afterDeload.nextDeload}")`).toBe(true);

  // ─── DOĞRULAMA 8: Hiç sıradaki deload kalmadıysa hidden ───────────────
  // 8 hafta, deload=4, currentWeekIndex=8 → tüm deload geçti
  const lastWeek = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      nextDeloadHidden: document.querySelector("#coverMacroNextDeload")?.hidden,
    };
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: 8 }));

  expect(lastWeek.nextDeloadHidden, "Son hafta + tüm deloads geçti → Next deload hidden").toBe(true);

  // ─── DOĞRULAMA 9: Output route'a navigate sonrası cover band çalışır ──
  // Form submit flow'unu test etmiyoruz (07-program spec'i kapsıyor); burada
  // sadece output route + state-based render path'in pas verdiğini doğrularız.
  await navigate(page, "output");
  await page.waitForTimeout(400);

  // Output route'ta da renderProgramCover'a mock program inject ile çağır
  // (state.activeProgram set etmek yerine doğrudan UI level test)
  const outputRouteCheck = await page.evaluate((program) => {
    window.BSMOutputRenderers.renderProgramCover(program);
    return {
      panelExists: !!document.querySelector("#resultsSection"),
      macroBandHidden: document.querySelector("#coverMacrocycle")?.hidden,
      title: (document.querySelector("#coverMacroTitle")?.textContent || "").trim(),
      current: (document.querySelector("#coverMacroCurrent")?.textContent || "").trim(),
    };
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: 1 }));

  expect(outputRouteCheck.panelExists, "#resultsSection mevcut").toBe(true);
  expect(outputRouteCheck.macroBandHidden, "Output route → macrocycle band visible").toBe(false);
  expect(/8\s*Haftalık/i.test(outputRouteCheck.title), `Output route Title "8 Haftalık" (gerçek: "${outputRouteCheck.title}")`).toBe(true);
  expect(/Hafta\s*1\s*\/\s*8/i.test(outputRouteCheck.current), `Output route "Hafta 1 / 8" (gerçek: "${outputRouteCheck.current}")`).toBe(true);

  // ─── DOĞRULAMA 10: Console / page / network error 0 ──────────────────
  assertNoErrors(errors);
});
