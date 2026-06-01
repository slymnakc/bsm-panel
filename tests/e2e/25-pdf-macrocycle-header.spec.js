// 25-pdf-macrocycle-header.spec.js — M1b.5 PDF macrocycle header band
// SOT KURALI: buildProgramPdfPayload.macrocycle === buildMacrocycleCoverModel(program)
// Drift kabul edilmiyor — PDF payload + cover band aynı kaynaktan beslenmeli.
//
// Kontroller:
//   1. buildProgramPdfPayload macrocycle field içerir (8 hafta program)
//   2. totalWeeks=1 → macrocycle.visible=false (header gizli)
//   3. Aktif hafta 3 (Linear) → "Hafta 3 / 8 · 1.05× yoğunluk"
//   4. Aktif hafta deload → "🌙 DELOAD HAFTASI · 0.65× yoğunluk"
//   5. Manual model → intensity satırı yok, sadece "Hafta N / M"
//   6. SOT consistency: PDF payload.macrocycle === buildMacrocycleCoverModel(program)
//      (core field'lar aynı)
//   7. Geriye uyumluluk: macrocycle yok → payload.macrocycle.visible=false
//   8. console / page / network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

function mockProgramFactory({
  totalWeeks = 1,
  model = "linear",
  deloadCadence = 0,
  deltaPercent = 2.5,
  currentWeekIndex = 1,
  weeksOverride = null,   // null → factory varsayılan weeks; özel test için verilebilir
} = {}) {
  const baseSession = { day: "monday", dayLabel: "Pazartesi", title: "Test Day", exercises: [{ name: "Bench Press", group: "chest", sets: 4, reps: "8", prescription: "4 x 8" }] };
  const weeks = weeksOverride || Array.from({ length: totalWeeks }, (_, i) => ({
    weekIndex: i + 1,
    isDeload: model !== "manual" && deloadCadence > 0 && (i + 1) % deloadCadence === 0,
    // Linear: deload haftası 0.65, normal hafta artan intensity (örn 1.00, 1.025, 1.05...).
    intensityFactor: (model !== "manual" && deloadCadence > 0 && (i + 1) % deloadCadence === 0)
      ? 0.65
      : 1 + (i * (deltaPercent / 100)),
    sessions: [JSON.parse(JSON.stringify(baseSession))],
  }));
  const currentClamped = Math.max(1, Math.min(currentWeekIndex, totalWeeks));
  return {
    schemaVersion: 4,
    title: "Test Program PDF",
    createdAtIso: new Date().toISOString(),
    createdAt: new Date().toLocaleDateString("tr-TR"),
    overview: [["Üye", "PDF Test Üye"]],
    coachNote: "Test",
    progression: [], guidance: [], coverage: [],
    macrocycle: { totalWeeks, model, deloadCadence, progressionRule: { type: "linear", deltaPercent } },
    weeks,
    currentWeekIndex: currentClamped,
    sessions: weeks[currentClamped - 1].sessions,
    rawData: { memberName: "PDF Test Üye", trainerName: "T", goal: "muscle-gain", level: "intermediate", days: ["monday"] },
  };
}

test("PDF macrocycle header — payload field + SOT consistency + visibility rules", async ({ page }) => {
  const { errors } = await setupPage(page);

  // ─── DOĞRULAMA 1: buildProgramPdfPayload macrocycle field içerir ──────
  const hookExists = await page.evaluate(() => ({
    hasTestApi: typeof window.BSMTestApi?.buildProgramPdfPayloadForTest === "function",
    hasOutputActions: typeof window.BSMOutputActions?.buildProgramPdfPayload === "function",
  }));
  expect(hookExists.hasTestApi, "BSMTestApi.buildProgramPdfPayloadForTest mevcut").toBe(true);
  expect(hookExists.hasOutputActions, "BSMOutputActions.buildProgramPdfPayload mevcut").toBe(true);

  const eightWeekPayload = await page.evaluate((program) => {
    return window.BSMTestApi.buildProgramPdfPayloadForTest(program);
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: 3 }));

  expect(eightWeekPayload, "Payload null değil").not.toBeNull();
  expect(eightWeekPayload.macrocycle, "Payload.macrocycle mevcut").toBeDefined();
  expect(eightWeekPayload.macrocycle.visible, "8 hafta → visible=true").toBe(true);
  expect(eightWeekPayload.macrocycle.totalWeeks, "totalWeeks=8").toBe(8);
  expect(eightWeekPayload.macrocycle.currentWeekIndex, "currentWeekIndex=3").toBe(3);

  // ─── DOĞRULAMA 2: totalWeeks=1 → macrocycle.visible=false ─────────────
  const oneWeekPayload = await page.evaluate((program) => {
    return window.BSMTestApi.buildProgramPdfPayloadForTest(program);
  }, mockProgramFactory({ totalWeeks: 1 }));
  expect(oneWeekPayload.macrocycle.visible, "totalWeeks=1 → visible=false").toBe(false);

  // ─── DOĞRULAMA 3: Aktif hafta 3 (Linear) → "Hafta 3 / 8 · 1.05× yoğunluk" ──
  // Hafta 3 intensityFactor = 1 + 2 * 0.025 = 1.05
  const linearWeek3 = eightWeekPayload.macrocycle;
  expect(linearWeek3.headerLine1, "headerLine1 mevcut").toBeTruthy();
  expect(/8\s*Haftalık/i.test(linearWeek3.headerLine1), `headerLine1 "8 Haftalık" içermeli (gerçek: "${linearWeek3.headerLine1}")`).toBe(true);
  expect(/Linear/i.test(linearWeek3.headerLine1), "headerLine1 'Linear' içermeli").toBe(true);
  expect(/Hafta\s*3\s*\/\s*8/i.test(linearWeek3.headerLine2), `headerLine2 "Hafta 3 / 8" (gerçek: "${linearWeek3.headerLine2}")`).toBe(true);
  expect(/1\.05/i.test(linearWeek3.headerLine2), `headerLine2 "1.05" intensity (gerçek: "${linearWeek3.headerLine2}")`).toBe(true);
  expect(/yoğunluk|yogunluk/i.test(linearWeek3.headerLine2), "headerLine2 'yoğunluk' içermeli").toBe(true);
  expect(linearWeek3.isActiveDeload, "Hafta 3 deload değil").toBe(false);

  // ─── DOĞRULAMA 4: Aktif hafta deload → "🌙 DELOAD HAFTASI · 0.65× yoğunluk" ──
  const deloadPayload = await page.evaluate((program) => {
    return window.BSMTestApi.buildProgramPdfPayloadForTest(program);
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: 4 }));

  const deloadMacro = deloadPayload.macrocycle;
  expect(deloadMacro.isActiveDeload, "Hafta 4 deload=true").toBe(true);
  expect(/DELOAD|Deload/i.test(deloadMacro.headerLine2), `headerLine2 "DELOAD" içermeli (gerçek: "${deloadMacro.headerLine2}")`).toBe(true);
  expect(/0\.65/i.test(deloadMacro.headerLine2), `headerLine2 "0.65" intensity (gerçek: "${deloadMacro.headerLine2}")`).toBe(true);

  // ─── DOĞRULAMA 5: Manual model → intensity satırı yok ─────────────────
  const manualPayload = await page.evaluate((program) => {
    return window.BSMTestApi.buildProgramPdfPayloadForTest(program);
  }, mockProgramFactory({ totalWeeks: 6, model: "manual", deloadCadence: 0, currentWeekIndex: 2 }));

  const manualMacro = manualPayload.macrocycle;
  expect(manualMacro.visible, "Manual 6 hafta → visible=true").toBe(true);
  expect(/Manual/i.test(manualMacro.headerLine1), `Manual headerLine1 "Manual" (gerçek: "${manualMacro.headerLine1}")`).toBe(true);
  expect(/Hafta\s*2\s*\/\s*6/i.test(manualMacro.headerLine2), `Manual headerLine2 "Hafta 2 / 6" (gerçek: "${manualMacro.headerLine2}")`).toBe(true);
  // Manual'de intensity yok — "× yoğunluk" eşleşmemeli
  expect(/×\s*yo.unluk/i.test(manualMacro.headerLine2), "Manual'de '× yoğunluk' GİZLİ (regex eşleşmemeli)").toBe(false);
  expect(manualMacro.isActiveDeload, "Manual'de isActiveDeload=false (her zaman)").toBe(false);

  // ─── DOĞRULAMA 6: SOT consistency — PDF payload === Cover band model ──
  // KRİTİK: Aynı kaynaktan beslenmeli (buildMacrocycleCoverModel).
  // PDF payload macrocycle, cover band ile aynı core field'ları taşımalı.
  const sotCheck = await page.evaluate((program) => {
    // Cover render → DOM'dan oku
    window.BSMOutputRenderers.renderProgramCover(program);
    const coverTitle = (document.querySelector("#coverMacroTitle")?.textContent || "").trim();
    const coverCurrent = (document.querySelector("#coverMacroCurrent")?.textContent || "").trim();
    const coverNextDeload = (document.querySelector("#coverMacroNextDeload")?.textContent || "").trim();

    // PDF payload
    const pdfPayload = window.BSMTestApi.buildProgramPdfPayloadForTest(program);
    const pdfMacro = pdfPayload.macrocycle;

    return {
      coverTitle,
      coverCurrent,
      coverNextDeload,
      pdfHeaderLine1: pdfMacro.headerLine1,
      pdfCurrentText: pdfMacro.currentText,         // SOT field
      pdfNextDeloadText: pdfMacro.nextDeloadText,   // SOT field
      pdfTitle: pdfMacro.title,                     // SOT field (cover ile aynı)
      pdfTotalWeeks: pdfMacro.totalWeeks,
      pdfCurrentWeekIndex: pdfMacro.currentWeekIndex,
      pdfModel: pdfMacro.model,
    };
  }, mockProgramFactory({ totalWeeks: 8, model: "linear", deloadCadence: 4, currentWeekIndex: 3 }));

  // Cover ile PDF'in aynı SOT field'ları taşıdığını doğrula
  expect(sotCheck.pdfTitle, "PDF payload .title (cover band ile aynı SOT)").toBe(sotCheck.coverTitle);
  expect(sotCheck.pdfCurrentText, "PDF payload .currentText (cover band ile aynı SOT)").toBe(sotCheck.coverCurrent);
  // Cover band'in nextDeloadText'i (Linear, currentWeekIndex=3, deloadCadence=4)
  // → "Bir sonraki deload: Hafta 4" — PDF payload'da aynı olmalı
  expect(sotCheck.pdfNextDeloadText, "PDF payload .nextDeloadText cover band ile aynı").toBe(sotCheck.coverNextDeload || null);
  expect(sotCheck.pdfTotalWeeks, "PDF totalWeeks=8").toBe(8);
  expect(sotCheck.pdfCurrentWeekIndex, "PDF currentWeekIndex=3").toBe(3);
  expect(sotCheck.pdfModel, "PDF model=linear").toBe("linear");

  // ─── DOĞRULAMA 7: Geriye uyumluluk — macrocycle yok → visible=false ───
  const legacyPayload = await page.evaluate(() => {
    const legacyProgram = {
      schemaVersion: 3,  // eski plan
      title: "Eski Plan",
      overview: [], coachNote: "", progression: [], guidance: [], coverage: [],
      sessions: [{ day: "monday", dayLabel: "Pzt", title: "Test", exercises: [] }],
      rawData: { memberName: "T", goal: "muscle-gain", level: "intermediate", days: ["monday"] },
      // macrocycle YOK, weeks YOK, currentWeekIndex YOK
    };
    return window.BSMTestApi.buildProgramPdfPayloadForTest(legacyProgram);
  });
  expect(legacyPayload.macrocycle, "Legacy program → macrocycle field var").toBeDefined();
  expect(legacyPayload.macrocycle.visible, "Legacy program → visible=false").toBe(false);

  // ─── DOĞRULAMA 8: Console / page / network error 0 ───────────────────
  assertNoErrors(errors);
});
