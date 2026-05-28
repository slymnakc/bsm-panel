// 15-output-print.spec.js — handlePrintPlan edit-mode toggle + render side-effect baseline
//
// AMAC: 4A.2.2 (outputActions extract) oncesi handlePrintPlan'in EN HASSAS davranisini
// kilit altina almak. handlePrintPlan (handlers/output-handlers.js:65) edit mode AKTIFKEN
// bir PROGRAM STATE MUTATION yapiyor:
//   1. getCurrentProgramFromEditor() ile DOM'dan program oku
//   2. state.programEditMode = false   ← side effect
//   3. renderProgram(currentProgram, { preserveEditState: true })  ← re-render
//   4. setTimeout(window.print, 50)
//
// 4A.2.2'de bu fn output/outputActions.js'e tasinirken bu edit-mode toggle + render
// side-effect zinciri birebir korunmali. Bu spec o zinciri baseline yapar.
//
// Mock: window.print stub'lanir (gercek print popup acilmaz). Server mock yok.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

// Member.programs[0] seed — hydrateActiveMemberSession (app.js:3617) bunu render eder,
// state.activeProgram'i doldurur. normalizeProgramRecord/normalizePlan uyumlu minimal yapi.
const PROGRAM_RECORD_SEED = Object.freeze({
  id: "regression-print-program-1",
  savedAtIso: "2026-05-27T00:00:00.000Z",
  savedAt: "27.05.2026",
  program: {
    schemaVersion: 3,
    title: "Print Test Programı",
    createdAtIso: "2026-05-27T00:00:00.000Z",
    createdAt: "27.05.2026",
    coachNote: "Print regression test programi.",
    overview: [
      ["Üye", "Test Üye"],
      ["Hedef", "Kas kazanımı"],
      ["Seviye", "Orta"],
    ],
    sessions: [
      {
        dayId: "monday",
        dayLabel: "Pazartesi",
        dayName: "Pazartesi",
        exercises: [
          {
            id: "barbell-bench-press",
            name: "Barbell Bench Press",
            group: "chest",
            equipment: "barbell",
            sets: 3,
            reps: "10",
            rest: "60-90 sn",
            tempo: "2-0-2",
            notes: "",
          },
        ],
      },
    ],
    progression: [],
    guidance: [],
    coverage: [],
    rawData: {
      memberName: "Test Üye",
      goal: "muscle-gain",
      level: "intermediate",
      days: ["monday"],
    },
  },
});

test("Output print flow — edit-mode toggle + render side-effect baseline", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Member'a program record inject (DEFAULT_MEMBER programs:[] bos — override)
  await page.evaluate(
    ({ member, programRecord }) => {
      const seeded = { ...member, programs: [programRecord] };
      localStorage.setItem("formaplan-studio-members", JSON.stringify([seeded]));
      localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
    },
    { member: DEFAULT_MEMBER, programRecord: PROGRAM_RECORD_SEED },
  );

  // Reload → hydrateActiveMemberSession → renderProgram → state.activeProgram dolar
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  await navigate(page, "output");
  await page.waitForTimeout(600);

  // ─── GUARD: state.activeProgram seed program ile dolu mu? ────────────
  const activeProgramReady = await page.evaluate(() => Boolean(window.__bsm?.state?.activeProgram));
  expect(activeProgramReady, "state.activeProgram seed program ile dolu olmali (hydrateActiveMemberSession)").toBe(true);

  // ─── window.print mock (gercek popup acilmaz) ───────────────────────
  await page.evaluate(() => {
    window.__test_printCount = 0;
    window.__orig_print = window.print;
    window.print = function () {
      window.__test_printCount += 1;
    };
  });

  // ─── Edit mode AKTIF: toggleProgramEditButton click ─────────────────
  await page.evaluate(() => document.querySelector("#toggleProgramEditButton")?.click());
  await page.waitForTimeout(400);

  const editModeOn = await page.evaluate(() => window.__bsm?.state?.programEditMode);
  expect(editModeOn, "toggleProgramEditButton edit mode'u acti (on)").toBe(true);

  // ─── Print button click (edit mode TRUE branch) ─────────────────────
  await page.evaluate(() => document.querySelector("#printPlanButton")?.click());
  // handlePrintPlan setTimeout(window.print, 50) → 50ms+ bekle
  await page.waitForTimeout(600);

  const result = await page.evaluate(() => {
    const weeklyPlan = document.querySelector("#weeklyPlan");
    const programOverview = document.querySelector("#programOverview");
    const scopedText = `${weeklyPlan?.textContent || ""} ${programOverview?.textContent || ""}`;
    const resultsSection = document.querySelector("#resultsSection");
    return {
      printCount: window.__test_printCount,
      editMode: window.__bsm?.state?.programEditMode,
      hasDefaultSnapshot: Boolean(window.__bsm?.state?.programDefaultSnapshot),
      toggleBtnText: (document.querySelector("#toggleProgramEditButton")?.textContent || "").trim(),
      panelExists: !!resultsSection,
      panelHidden: resultsSection?.classList.contains("hidden"),
      pdfBtn: !!document.querySelector("#programPdfActionButton"),
      weeklyPlanLength: (weeklyPlan?.innerHTML || "").length,
      hasUndefined: /\bundefined\b/i.test(scopedText),
      hasNaN: /\bnan\b/i.test(scopedText),
    };
  });

  // ─── 1. window.print cagrildi ───────────────────────────────────────
  expect(result.printCount, "window.print cagrildi (setTimeout 50ms sonrasi)").toBeGreaterThanOrEqual(1);

  // ─── 2. state.programEditMode false oldu ────────────────────────────
  expect(result.editMode, "print sonrasi edit mode kapandi (false)").toBe(false);

  // ─── 3. renderProgram tekrar calisti (toggle text + weeklyPlan render) ─
  // renderProgram → renderProgramEditToolbar → toggleBtn "Düzenle" (edit mode kapali)
  expect(result.toggleBtnText, "edit toggle 'Düzenle' state'ine dondu (renderProgram + toolbar re-render)").toBe("Düzenle");
  expect(result.weeklyPlanLength, "weeklyPlan render edildi (renderProgram tekrar calisti)").toBeGreaterThan(0);

  // ─── 4. preserveEditState zinciri korundu ───────────────────────────
  // renderProgram preserveEditState:true → programDefaultSnapshot korunur
  expect(result.hasDefaultSnapshot, "programDefaultSnapshot korundu (preserveEditState zinciri)").toBe(true);

  // ─── 5. Output panel kaybolmadi ─────────────────────────────────────
  expect(result.panelExists, "output panel (#resultsSection) DOM'da").toBe(true);

  // ─── 6. PDF button hala mount ───────────────────────────────────────
  expect(result.pdfBtn, "PDF action button hala mount").toBe(true);

  // ─── 7. undefined / NaN yok (weeklyPlan + overview scope) ───────────
  expect(result.hasUndefined, "weeklyPlan/overview icinde 'undefined' yok").toBe(false);
  expect(result.hasNaN, "weeklyPlan/overview icinde 'NaN' yok").toBe(false);

  // print stub'i restore et
  await page.evaluate(() => {
    if (window.__orig_print) window.print = window.__orig_print;
  });

  // ─── 8. Console / page error yok ────────────────────────────────────
  // allowNetwork: true — measurement context + CDN istekleri test odagi disinda
  assertNoErrors(errors, { allowNetwork: true });
});
