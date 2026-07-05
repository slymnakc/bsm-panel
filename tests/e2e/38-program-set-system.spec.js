// 38-program-set-system.spec.js — BUG-SET-001: Set sistemi / piramit preset korunması
// Program generation, kullanıcının seçtiği repetitionTemplate (pyramid preset)'i
// EZMEMELI. Seçilen pattern (15-12-10-8 veya 12-10-8-6) generation + preview + PDF
// payload'da aynen korunmalı; goal/kind fallback yalnızca template YOKKEN devreye girer.
//
// Kök neden: services/session-exercise-service.js buildPrescription data.repetitionTemplate
// okumuyordu → her egzersize goal-bazlı hard-coded string atıyordu.
//
// Program objesi localStorage'dan (formaplan-studio-last-plan) alınıp
// buildProgramPdfPayloadForTest ile PDF payload doğrulanır (yeni hook gerekmez).

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

const LAST_PLAN_KEY = "formaplan-studio-last-plan";

// Builder'da form doldurup pyramid preset seçip program üretir; localStorage'daki
// program objesini döndürür. goal override edilebilir (Test 4 için).
async function generateWithPreset(page, { presetId, sets = 4, model = "pyramid", goal = null }) {
  await navigate(page, "builder");
  await page.waitForTimeout(400);

  return page.evaluate(async (cfg) => {
    // 1) Geçerli örnek form doldur
    document.querySelector("#fillExampleButton")?.click();
    await new Promise((r) => setTimeout(r, 150));

    // 2) goal override (Test 4)
    if (cfg.goal) {
      const goalSel = document.querySelector("#goal");
      if (goalSel) { goalSel.value = cfg.goal; goalSel.dispatchEvent(new Event("change", { bubbles: true })); }
    }

    // 3) repetition model + set sayısı + preset
    const modelSel = document.querySelector("#defaultRepModel");
    const setCount = document.querySelector("#defaultSetCount");
    if (modelSel) { modelSel.value = cfg.model; }
    if (setCount) { setCount.value = String(cfg.sets); }
    // preset dropdown'ı yenilemek için change tetikle
    modelSel?.dispatchEvent(new Event("change", { bubbles: true }));
    setCount?.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));

    const presetSel = document.querySelector("#defaultRepPreset");
    let presetSet = false;
    if (presetSel && cfg.presetId) {
      const hasOption = [...presetSel.options].some((o) => o.value === cfg.presetId);
      if (hasOption) { presetSel.value = cfg.presetId; presetSel.dispatchEvent(new Event("change", { bubbles: true })); presetSet = true; }
    }
    await new Promise((r) => setTimeout(r, 100));

    // 4) programı oluştur (submit)
    document.querySelector("#plannerForm")?.requestSubmit();
    await new Promise((r) => setTimeout(r, 500));

    // 5) localStorage'daki programı döndür
    let program = null;
    try { program = JSON.parse(localStorage.getItem("formaplan-studio-last-plan") || "null"); } catch (e) { /* */ }

    // preview DOM (weeklyPlan) prescription metinleri
    const weeklyText = (document.querySelector("#weeklyPlan")?.textContent || "").replace(/\s+/g, " ");

    return { presetSet, presetValue: presetSel?.value || null, program, weeklyText };
  }, { presetId, sets, model, goal });
}

// activeProgram exercises içinde bir pattern arar (weeks[].sessions[].exercises[].prescription)
function programHasPattern(program, pattern) {
  if (!program) return false;
  const weeks = Array.isArray(program.weeks) ? program.weeks : [];
  const sessions = weeks.length ? weeks.flatMap((w) => w.sessions || []) : (program.sessions || []);
  for (const s of sessions) {
    for (const ex of s.exercises || []) {
      const p = String(ex.prescription || ex.reps || "");
      if (p.includes(pattern)) return true;
    }
  }
  return false;
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — generation/preview: pyramid 15-12-10-8 korunur
// ════════════════════════════════════════════════════════════════════════════
test("pyramid-4-15-12-10-8 seçimi generation + preview'da korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  const res = await generateWithPreset(page, { presetId: "pyramid-4-15-12-10-8", goal: "muscle-gain" });

  expect(res.presetSet, "preset dropdown 15-12-10-8'e ayarlandı").toBe(true);
  expect(res.program, "program oluştu (localStorage)").not.toBeNull();
  expect(programHasPattern(res.program, "15-12-10-8"), "activeProgram bir egzersizde 15-12-10-8 taşıyor").toBe(true);
  expect(/15-12-10-8/.test(res.weeklyText), "preview (weeklyPlan) 15-12-10-8 gösteriyor").toBe(true);
  // goal-bazlı fallback string'i seçimi ezmiyor
  expect(programHasPattern(res.program, "6-10"), "goal muscle-gain fallback '6-10' seçimi EZMEDI").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — generation/preview: pyramid 12-10-8-6 korunur (sabit canonical yok)
// ════════════════════════════════════════════════════════════════════════════
test("pyramid-4-12-10-8-6 seçimi korunur, 15-12-10-8 zorlanmaz", async ({ page }) => {
  const { errors } = await setupPage(page);
  const res = await generateWithPreset(page, { presetId: "pyramid-4-12-10-8-6", goal: "muscle-gain" });

  expect(res.presetSet, "preset dropdown 12-10-8-6'ya ayarlandı").toBe(true);
  expect(programHasPattern(res.program, "12-10-8-6"), "activeProgram 12-10-8-6 taşıyor").toBe(true);
  expect(programHasPattern(res.program, "15-12-10-8"), "15-12-10-8 ZORLANMADI").toBe(false);
  expect(/12-10-8-6/.test(res.weeklyText), "preview 12-10-8-6 gösteriyor").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — PDF payload data source: seçilen pattern korunur
// ════════════════════════════════════════════════════════════════════════════
test("PDF payload seçilen pyramid pattern'i taşır (15-12-10-8 ve 12-10-8-6)", async ({ page }) => {
  const { errors } = await setupPage(page);

  const a = await generateWithPreset(page, { presetId: "pyramid-4-15-12-10-8", goal: "muscle-gain" });
  const payloadA = await page.evaluate((prog) => {
    const p = window.BSMTestApi.buildProgramPdfPayloadForTest(prog);
    return JSON.stringify(p);
  }, a.program);
  expect(/15-12-10-8/.test(payloadA), "PDF payload 15-12-10-8 içeriyor").toBe(true);

  const b = await generateWithPreset(page, { presetId: "pyramid-4-12-10-8-6", goal: "fat-loss" });
  const payloadB = await page.evaluate((prog) => JSON.stringify(window.BSMTestApi.buildProgramPdfPayloadForTest(prog)), b.program);
  expect(/12-10-8-6/.test(payloadB), "PDF payload 12-10-8-6 içeriyor").toBe(true);
  expect(/15-12-10-8/.test(payloadB), "PDF payload 15-12-10-8 zorlanmadı").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — goal seçimden bağımsız: farklı goal'lerde seçilen preset korunur
// ════════════════════════════════════════════════════════════════════════════
test("goal (muscle-gain/fat-loss/hypertrophy) seçilen preset'i ezmez", async ({ page }) => {
  const { errors } = await setupPage(page);

  for (const goal of ["muscle-gain", "fat-loss", "hypertrophy"]) {
    const res = await generateWithPreset(page, { presetId: "pyramid-4-15-12-10-8", goal });
    expect(programHasPattern(res.program, "15-12-10-8"), `goal=${goal}: 15-12-10-8 korunur`).toBe(true);
  }

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — fallback: template yoksa/custom ise eski goal-bazlı davranış korunur
// ════════════════════════════════════════════════════════════════════════════
test("template custom/yoksa goal-bazlı fallback prescription korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  // custom preset seç → repetitionTemplate.repPattern belirli bir preset'ten gelmez
  const res = await generateWithPreset(page, { presetId: "custom", model: "custom", goal: "fat-loss" });

  // fallback: fat-loss → "3 set x 12-15 tekrar" gibi goal-bazlı string (program yine üretilir)
  expect(res.program, "program yine oluştu (fallback)").not.toBeNull();
  const weeks = Array.isArray(res.program?.weeks) ? res.program.weeks : [];
  const anyPrescription = weeks.flatMap((w) => w.sessions || []).flatMap((s) => s.exercises || []).some((ex) => String(ex.prescription || "").length > 0);
  expect(anyPrescription, "egzersizlerde prescription mevcut (fallback bozulmadı)").toBe(true);

  assertNoErrors(errors);
});
