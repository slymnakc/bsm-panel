// 28-intelligence-periodization.spec.js — M1b.10 Program Intelligence periodization farkındalığı
// buildProgramIntelligence + buildFallbackProgramIntelligence opsiyonel 4. param
// (periodization) alır. periodizationSummary tek pure helper'dan (buildPeriodizationSummary)
// türetilir → engine ve fallback AYNI string üretir, cover band ile drift yok.
//
// Kontroller:
//   1. API hooks mevcut (engine + fallback + helper + cover model)
//   2. buildProgramIntelligence 4. param kabul eder, periodization=null → periodizationSummary null
//   3. 8 hafta linear → "8 haftalık linear" + "Hafta 3/8" + "1.05" intensity
//   4. Aktif hafta deload → "deload"/"toparlanma" vurgusu
//   5. Manual mode → "manuel" + intensity satırı yok
//   6. ENGINE === FALLBACK: aynı periodization → birebir aynı periodizationSummary
//   7. SOT: periodization objesi buildMacrocycleCoverModel'den türetilince
//      currentWeekIndex/totalWeeks cover band ile aynı (drift yok)
//   8. Output "Program Özeti" kartı periodizationSummary'yi render eder
//   9. 1 hafta program → periodization null → summary değişmez (geriye uyumluluk)
//   10. Manual "Yakında" badge + yardımcı açıklama wizard'da mevcut
//   11. console / page / network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

// periodization objesi fabrikası (buildMacrocycleCoverModel return shape ile uyumlu)
function periodizationInput({ totalWeeks = 8, currentWeekIndex = 3, model = "linear", activeIntensityFactor = 1.05, isActiveDeload = false, nextDeloadIndex = 4 } = {}) {
  return { totalWeeks, currentWeekIndex, model, activeIntensityFactor, isActiveDeload, nextDeloadIndex };
}

test("Intelligence periodization — engine/fallback eşitliği + SOT + output kartı + Manual badge", async ({ page }) => {
  const { errors } = await setupPage(page);

  // ─── DOĞRULAMA 1: API hooks mevcut ────────────────────────────────────
  const hooks = await page.evaluate(() => ({
    engine: typeof window.BSMProgramEngineV2?.buildProgramIntelligence === "function",
    fallback: typeof window.BSMProgramSummaryService?.buildFallbackProgramIntelligence === "function",
    helper: typeof window.BSMProgramSummaryService?.buildPeriodizationSummary === "function",
    coverModel: typeof window.BSMOutputModelService?.buildMacrocycleCoverModel === "function",
    outputModel: typeof window.BSMOutputModelService?.buildOutputIntelligenceModel === "function",
  }));
  expect(hooks.engine, "buildProgramIntelligence mevcut").toBe(true);
  expect(hooks.fallback, "buildFallbackProgramIntelligence mevcut").toBe(true);
  expect(hooks.helper, "buildPeriodizationSummary helper mevcut (SOT)").toBe(true);
  expect(hooks.coverModel, "buildMacrocycleCoverModel mevcut").toBe(true);

  // ─── DOĞRULAMA 2: periodization=null → periodizationSummary null ──────
  const noPeriodization = await page.evaluate(() => {
    const data = { goal: "muscle-gain", level: "intermediate", days: ["monday", "wednesday"] };
    const sessions = [{ exercises: [{ kind: "compound" }, { kind: "accessory" }] }];
    const withNull = window.BSMProgramEngineV2.buildProgramIntelligence(data, sessions, null, null);
    const withUndef = window.BSMProgramEngineV2.buildProgramIntelligence(data, sessions, null);
    return {
      nullSummary: withNull.periodizationSummary,
      undefSummary: withUndef.periodizationSummary,
      hasBaseSummary: typeof withNull.summary === "string" && withNull.summary.length > 0,
    };
  });
  expect(noPeriodization.nullSummary == null, "periodization=null → periodizationSummary null/undefined").toBe(true);
  expect(noPeriodization.undefSummary == null, "periodization yok → periodizationSummary null/undefined").toBe(true);
  expect(noPeriodization.hasBaseSummary, "Base summary korunur (geriye uyumluluk)").toBe(true);

  // ─── DOĞRULAMA 3: 8 hafta linear → içerik kontrolü ────────────────────
  const linear = await page.evaluate((periodization) => {
    const data = { goal: "muscle-gain", level: "intermediate", days: ["monday", "wednesday"] };
    const sessions = [{ exercises: [{ kind: "compound" }] }];
    const intel = window.BSMProgramEngineV2.buildProgramIntelligence(data, sessions, null, periodization);
    return { summary: intel.periodizationSummary };
  }, periodizationInput({ totalWeeks: 8, currentWeekIndex: 3, model: "linear", activeIntensityFactor: 1.05, isActiveDeload: false, nextDeloadIndex: 4 }));

  expect(linear.summary, "periodizationSummary üretildi").toBeTruthy();
  expect(/8\s*haftal/i.test(linear.summary), `"8 haftalık" içermeli (gerçek: "${linear.summary}")`).toBe(true);
  // BSM-UX-002: "linear" → "Kademeli Artış (Linear)" (Türkçe + parantezli).
  expect(/linear/i.test(linear.summary), "'linear' içermeli").toBe(true);
  expect(/Kademeli Artış/i.test(linear.summary), `'Kademeli Artış' Türkçe terim (gerçek: "${linear.summary}")`).toBe(true);
  expect(/Hafta\s*3\s*\/\s*8/i.test(linear.summary), `"Hafta 3 / 8" içermeli (gerçek: "${linear.summary}")`).toBe(true);
  expect(/1[.,]05/.test(linear.summary), `"1.05" yoğunluk içermeli (gerçek: "${linear.summary}")`).toBe(true);
  expect(/Hafta\s*4/i.test(linear.summary), `Sıradaki deload "Hafta 4" içermeli (gerçek: "${linear.summary}")`).toBe(true);

  // ─── DOĞRULAMA 4: Aktif hafta deload → "deload"/"toparlanma" ─────────
  const deload = await page.evaluate((periodization) => {
    const data = { goal: "muscle-gain", level: "intermediate", days: ["monday"] };
    const sessions = [{ exercises: [{ kind: "compound" }] }];
    const intel = window.BSMProgramEngineV2.buildProgramIntelligence(data, sessions, null, periodization);
    return { summary: intel.periodizationSummary };
  }, periodizationInput({ totalWeeks: 8, currentWeekIndex: 4, model: "linear", activeIntensityFactor: 0.65, isActiveDeload: true, nextDeloadIndex: 8 }));

  expect(/deload|toparlan/i.test(deload.summary), `Deload haftası vurgusu (gerçek: "${deload.summary}")`).toBe(true);
  expect(/0[.,]65/.test(deload.summary), `Deload intensity "0.65" (gerçek: "${deload.summary}")`).toBe(true);

  // ─── DOĞRULAMA 5: Manual mode → "manuel" + intensity yok ─────────────
  const manual = await page.evaluate((periodization) => {
    const data = { goal: "muscle-gain", level: "intermediate", days: ["monday"] };
    const sessions = [{ exercises: [{ kind: "compound" }] }];
    const intel = window.BSMProgramEngineV2.buildProgramIntelligence(data, sessions, null, periodization);
    return { summary: intel.periodizationSummary };
  }, periodizationInput({ totalWeeks: 6, currentWeekIndex: 2, model: "manual", activeIntensityFactor: 1.0, isActiveDeload: false, nextDeloadIndex: null }));

  expect(/manuel|manual/i.test(manual.summary), `Manual model etiketi (gerçek: "${manual.summary}")`).toBe(true);
  expect(/Hafta\s*2\s*\/\s*6/i.test(manual.summary), `"Hafta 2 / 6" içermeli (gerçek: "${manual.summary}")`).toBe(true);
  // Manual'de yoğunluk satırı GİZLİ ("× yoğunluk" eşleşmemeli)
  expect(/yo.unluk/i.test(manual.summary), "Manual'de yoğunluk bilgisi GİZLİ").toBe(false);

  // ─── DOĞRULAMA 6: ENGINE === FALLBACK (aynı string) ──────────────────
  const equality = await page.evaluate((periodization) => {
    const data = { goal: "muscle-gain", level: "intermediate", days: ["monday", "wednesday"] };
    const sessions = [{ exercises: [{ kind: "compound" }, { kind: "accessory" }] }];
    const engineIntel = window.BSMProgramEngineV2.buildProgramIntelligence(data, sessions, null, periodization);
    const fallbackIntel = window.BSMProgramSummaryService.buildFallbackProgramIntelligence(data, sessions, null, periodization);
    return {
      engineSummary: engineIntel.periodizationSummary,
      fallbackSummary: fallbackIntel.periodizationSummary,
    };
  }, periodizationInput({ totalWeeks: 8, currentWeekIndex: 3, model: "linear", activeIntensityFactor: 1.05, isActiveDeload: false, nextDeloadIndex: 4 }));

  expect(equality.engineSummary, "Engine periodizationSummary üretti").toBeTruthy();
  expect(equality.fallbackSummary, "Fallback periodizationSummary üretti").toBeTruthy();
  expect(equality.fallbackSummary, "ENGINE === FALLBACK (birebir aynı periodizationSummary)").toBe(equality.engineSummary);

  // ─── DOĞRULAMA 7: SOT — cover band ile drift yok ──────────────────────
  // buildMacrocycleCoverModel'in döndürdüğü alanlardan periodization türetilir;
  // intelligence summary'deki hafta/total cover band ile aynı kaynaktan gelmeli.
  const sot = await page.evaluate(() => {
    const program = {
      schemaVersion: 4,
      macrocycle: { totalWeeks: 8, model: "linear", deloadCadence: 4, progressionRule: { type: "linear", deltaPercent: 2.5 } },
      weeks: Array.from({ length: 8 }, (_, i) => ({ weekIndex: i + 1, isDeload: (i + 1) % 4 === 0, intensityFactor: (i + 1) % 4 === 0 ? 0.65 : 1 + i * 0.025, sessions: [] })),
      currentWeekIndex: 3,
    };
    const coverModel = window.BSMOutputModelService.buildMacrocycleCoverModel(program);
    // periodization objesini cover model'den türet (app.js'in yapacağı gibi)
    const periodization = {
      totalWeeks: coverModel.totalWeeks,
      currentWeekIndex: coverModel.currentWeekIndex,
      model: coverModel.model,
      activeIntensityFactor: coverModel.activeIntensityFactor,
      isActiveDeload: coverModel.isActiveDeload,
      nextDeloadIndex: coverModel.nextDeloadIndex,
    };
    const summary = window.BSMProgramSummaryService.buildPeriodizationSummary(periodization);
    return {
      coverTotalWeeks: coverModel.totalWeeks,
      coverCurrentWeekIndex: coverModel.currentWeekIndex,
      coverCurrentText: coverModel.currentText,
      periodizationSummary: summary,
    };
  });
  expect(sot.coverTotalWeeks, "Cover model totalWeeks=8").toBe(8);
  expect(sot.coverCurrentWeekIndex, "Cover model currentWeekIndex=3").toBe(3);
  // Summary'deki "Hafta 3 / 8" cover band'in currentText'i ile tutarlı (drift yok)
  expect(/Hafta\s*3\s*\/\s*8/i.test(sot.periodizationSummary), `Summary cover ile tutarlı (gerçek: "${sot.periodizationSummary}")`).toBe(true);
  expect(/Hafta\s*3\s*\/\s*8/i.test(sot.coverCurrentText), "Cover currentText 'Hafta 3 / 8'").toBe(true);

  // ─── DOĞRULAMA 8: Output "Program Özeti" kartı periodizationSummary render ──
  const outputCard = await page.evaluate(() => {
    const program = {
      schemaVersion: 4,
      rawData: { goal: "muscle-gain", level: "intermediate", days: ["monday"], memberName: "T" },
      overview: [["Üye", "T"]],
      sessions: [{ exercises: [] }],
      programIntelligence: {
        summary: "Program dağılımı 3 ana hareket içeriyor.",
        periodizationSummary: "8 haftalık linear program. Şu an Hafta 3 / 8 (yoğunluk 1.05×). Sıradaki deload: Hafta 4.",
      },
      aiReport: {},
    };
    const model = window.BSMOutputModelService.buildOutputIntelligenceModel(program);
    // "Program Özeti" kartını bul
    const summaryCard = (model.cards || []).find((c) => c.label === "Program Özeti");
    return { cardText: summaryCard ? summaryCard.text : null };
  });
  expect(outputCard.cardText, "Program Özeti kartı mevcut").toBeTruthy();
  expect(/8\s*haftal/i.test(outputCard.cardText), `Kart text periodizationSummary içerir (gerçek: "${outputCard.cardText}")`).toBe(true);
  expect(/Hafta\s*3\s*\/\s*8/i.test(outputCard.cardText), "Kart text 'Hafta 3 / 8' içerir").toBe(true);

  // ─── DOĞRULAMA 9: 1 hafta program → periodization null → summary değişmez ──
  const oneWeek = await page.evaluate(() => {
    const program = {
      schemaVersion: 4,
      macrocycle: { totalWeeks: 1, model: "linear", deloadCadence: 0 },
      weeks: [{ weekIndex: 1, isDeload: false, intensityFactor: 1.0, sessions: [] }],
      currentWeekIndex: 1,
    };
    const coverModel = window.BSMOutputModelService.buildMacrocycleCoverModel(program);
    return { visible: coverModel.visible };
  });
  expect(oneWeek.visible, "1 hafta program → cover model visible=false (periodization yok)").toBe(false);

  // ─── DOĞRULAMA 10: Manual "Yakında" badge + açıklama wizard'da ────────
  await navigate(page, "program");
  await page.waitForTimeout(300);
  const manualBadge = await page.evaluate(() => {
    const manualCard = document.querySelector('input[name="periodModel"][value="manual"]')?.closest(".bsm-radio-card");
    if (!manualCard) return null;
    const badge = manualCard.querySelector("[data-soon-badge], .bsm-soon-badge");
    return {
      cardExists: true,
      badgeExists: !!badge,
      badgeText: (badge?.textContent || "").trim(),
      cardText: (manualCard.textContent || "").trim(),
    };
  });
  expect(manualBadge, "Manual radio kartı mevcut").not.toBeNull();
  expect(manualBadge.badgeExists, "Manual kartında 'Yakında' badge mevcut").toBe(true);
  expect(/yakında|yakinda/i.test(manualBadge.badgeText), `Badge "Yakında" (gerçek: "${manualBadge.badgeText}")`).toBe(true);

  // ─── DOĞRULAMA 11: Console / page / network error 0 ──────────────────
  assertNoErrors(errors);
});
