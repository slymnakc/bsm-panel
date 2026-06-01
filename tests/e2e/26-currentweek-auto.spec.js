// 26-currentweek-auto.spec.js — M1b.6 date-based currentWeekIndex auto + manuel override
// Program startDate'e göre bugünün haftası otomatik hesaplanır.
// Kullanıcı manuel tab tıkladığında autoMode kilitlenir.
// "Auto'ya dön" tekrar auto mode'a alır.
//
// Kontroller:
//   1. PERSISTENCE FIX: rawData.startDate normalizeFormData sonrası korunur (M1b.1 bug)
//   2. computeAutoWeekIndex: startDate=todayOverride → idx=1
//   3. computeAutoWeekIndex: startDate=8 gün önce → idx=2
//   4. computeAutoWeekIndex: startDate=60 gün önce, totalWeeks=8 → idx=8 (clamp)
//   5. computeAutoWeekIndex: startDate gelecekte → idx=1 (negatif clamp)
//   6. computeAutoWeekIndex: startDate yok/geçersiz → null
//   7. autoMode=true + renderProgram → auto compute tetiklenir
//   8. setActiveWeek → autoMode=false (manuel kilit)
//   9. autoMode=false + renderProgram → auto compute SKIP (persisted idx korunur)
//   10. resumeAutoMode → autoMode=true + auto compute tekrar tetiklenir
//   11. Edit mode aktif → auto compute SKIP (veri kaybı koruması)
//   12. UI: Auto/Manuel badge görünür + Auto'ya dön butonu manuel mod'da
//   13. autoMode localStorage persist (saveLastPlan)
//   14. console / page / network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(120000);

// Helper: Belirli startDate + currentWeekIndex + autoMode ile mock program seed.
async function seedProgram(page, opts = {}) {
  const {
    totalWeeks = 8,
    startDate = "",
    currentWeekIndex = 1,
    autoMode = true,
  } = opts;
  return page.evaluate((cfg) => {
    const baseSession = { day: "monday", dayLabel: "Pzt", title: "T", sessionIndex: 0,
      exercises: [{ name: "Bench", group: "chest", sets: 4, reps: "8", prescription: "4 x 8" }] };
    const mkSessions = () => JSON.parse(JSON.stringify([baseSession]));
    const weeks = Array.from({ length: cfg.totalWeeks }, (_, i) => ({
      weekIndex: i + 1,
      isDeload: (i + 1) % 4 === 0,
      intensityFactor: 1.0,
      sessions: mkSessions(),
    }));
    const program = {
      schemaVersion: 4,
      title: "Auto Week Test",
      createdAtIso: new Date().toISOString(),
      overview: [["Üye", "Auto Test Üye"]],
      coachNote: "T", progression: [], guidance: [], coverage: [],
      macrocycle: { totalWeeks: cfg.totalWeeks, model: "linear", deloadCadence: 4, progressionRule: { type: "linear", deltaPercent: 2.5 } },
      weeks,
      currentWeekIndex: cfg.currentWeekIndex,
      currentWeekIndexAutoMode: cfg.autoMode,
      sessions: weeks[cfg.currentWeekIndex - 1].sessions,
      rawData: {
        memberName: "Auto Test Üye", trainerName: "T",
        goal: "muscle-gain", level: "intermediate", days: ["monday"],
        startDate: cfg.startDate,
      },
    };
    window.BSMTestApi.renderProgramForTest(program);
    return true;
  }, { totalWeeks, startDate, currentWeekIndex, autoMode });
}

test("currentWeekIndex auto compute + manuel override + persistence", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "output");
  await page.waitForTimeout(300);

  // ─── DOĞRULAMA 1: API hooks mevcut ────────────────────────────────────
  const hooks = await page.evaluate(() => ({
    computeAuto: typeof window.BSMTestApi?.computeAutoWeekIndexForTest === "function",
    resumeAuto: typeof window.BSMTestApi?.resumeAutoWeekForTest === "function",
    autoSnapshot: typeof window.BSMTestApi?.getProgramAutoSnapshot === "function",
  }));
  expect(hooks.computeAuto, "computeAutoWeekIndexForTest hook").toBe(true);
  expect(hooks.resumeAuto, "resumeAutoWeekForTest hook").toBe(true);
  expect(hooks.autoSnapshot, "getProgramAutoSnapshot hook").toBe(true);

  // ─── DOĞRULAMA 2-6: computeAutoWeekIndex pure helper'ı (deterministic) ─
  const calc = await page.evaluate(() => {
    const fn = window.BSMTestApi.computeAutoWeekIndexForTest;
    return {
      sameDay: fn("2026-06-01", 8, "2026-06-01"),     // 0 gün → idx=1
      sevenDays: fn("2026-05-25", 8, "2026-06-01"),   // 7 gün → idx=2
      eightDays: fn("2026-05-24", 8, "2026-06-01"),   // 8 gün → idx=2 (8/7=1.14→1+1)
      thirteenDays: fn("2026-05-19", 8, "2026-06-01"),// 13 gün → idx=2
      fourteenDays: fn("2026-05-18", 8, "2026-06-01"),// 14 gün → idx=3
      sixtyDays: fn("2026-04-02", 8, "2026-06-01"),   // 60 gün → idx=9 → clamp=8
      future: fn("2026-06-15", 8, "2026-06-01"),      // gelecek → idx=1
      empty: fn("", 8, "2026-06-01"),                 // boş → null
      invalid: fn("not-a-date", 8, "2026-06-01"),     // geçersiz → null
      undef: fn(undefined, 8, "2026-06-01"),          // undefined → null
    };
  });
  expect(calc.sameDay, "Bugün başlayan plan → hafta 1").toBe(1);
  expect(calc.sevenDays, "7 gün önce → hafta 2").toBe(2);
  expect(calc.eightDays, "8 gün önce → hafta 2").toBe(2);
  expect(calc.thirteenDays, "13 gün önce → hafta 2").toBe(2);
  expect(calc.fourteenDays, "14 gün önce → hafta 3").toBe(3);
  expect(calc.sixtyDays, "60 gün önce → clamp 8").toBe(8);
  expect(calc.future, "Gelecek tarih → hafta 1").toBe(1);
  expect(calc.empty, "Boş startDate → null").toBeNull();
  expect(calc.invalid, "Geçersiz → null").toBeNull();
  expect(calc.undef, "Undefined → null").toBeNull();

  // ─── DOĞRULAMA 7: PERSISTENCE FIX — rawData.startDate normalize sonrası korunur ──
  // M1b.1 bug: normalizeFormData whitelist'te startDate yoktu → restore'da kayboluyordu
  await seedProgram(page, { totalWeeks: 8, startDate: "2026-05-25", currentWeekIndex: 1, autoMode: false });
  const persistCheck = await page.evaluate(() => {
    const snap = window.BSMTestApi.getProgramAutoSnapshot();
    return { startDate: snap.startDate };
  });
  expect(persistCheck.startDate, "rawData.startDate normalize sonrası korunur").toBe("2026-05-25");

  // ─── DOĞRULAMA 8: autoMode=false + renderProgram → compute SKIP ───────
  // Manuel mode'da auto compute çalışmaz, kullanıcının seçtiği currentWeekIndex=1 korunur.
  // (startDate 7 gün önce olsa bile autoMode=false ise hafta 1'de kalır)
  const skipCheck = await page.evaluate(() => window.BSMTestApi.getProgramAutoSnapshot());
  expect(skipCheck.autoMode, "autoMode=false set edildi").toBe(false);
  expect(skipCheck.currentWeekIndex, "autoMode=false → currentWeekIndex=1 (compute SKIP)").toBe(1);

  // ─── DOĞRULAMA 9: setActiveWeek → autoMode=false (manuel kilit) ────────
  // Önce auto mode + startDate=bugün ile seed (currentWeekIndex compute=1)
  await seedProgram(page, { totalWeeks: 8, startDate: "2026-06-01", currentWeekIndex: 1, autoMode: true });
  await page.waitForTimeout(200);
  const beforeManual = await page.evaluate(() => window.BSMTestApi.getProgramAutoSnapshot());
  expect(beforeManual.autoMode, "Seed sonrası autoMode=true").toBe(true);

  // Kullanıcı hafta 3'e tıklar (setActiveWeek)
  await page.evaluate(() => window.BSMTestApi.setActiveWeekForTest(3));
  await page.waitForTimeout(200);
  const afterManual = await page.evaluate(() => window.BSMTestApi.getProgramAutoSnapshot());
  expect(afterManual.autoMode, "setActiveWeek → autoMode=false (manuel kilit)").toBe(false);
  expect(afterManual.currentWeekIndex, "setActiveWeek(3) → currentWeekIndex=3").toBe(3);

  // ─── DOĞRULAMA 10: resumeAutoMode → autoMode=true + compute tetiklenir ──
  // todayOverride yok → production new Date() → idx hesaplanır.
  // Test'i deterministik tutmak için startDate'i bugün ile seed ettik (idx=1 hedef).
  // resumeAutoMode → autoMode=true → renderProgram tetiklenir → compute → idx=1
  await page.evaluate(() => {
    // startDate'i bugünün ISO'suna güncelle (deterministic compute=1 garanti)
    const todayISO = new Date().toISOString().slice(0, 10);
    state_setStartDate: {
      const p = window.BSMTestApi.__setRawStartDateForTest(todayISO);
    }
    window.BSMTestApi.resumeAutoWeekForTest();
  });
  await page.waitForTimeout(300);
  const afterResume = await page.evaluate(() => window.BSMTestApi.getProgramAutoSnapshot());
  expect(afterResume.autoMode, "resumeAutoMode → autoMode=true").toBe(true);
  expect(afterResume.currentWeekIndex, "Auto compute tetiklenir → bugün startDate → idx=1").toBe(1);

  // ─── DOĞRULAMA 11: Edit mode → auto compute SKIP (veri kaybı koruması) ──
  // Hafta 5 manuel → edit mode aç → autoMode'a dön → SKIP olmalı (kullanıcı edit'i koru)
  await seedProgram(page, { totalWeeks: 8, startDate: "2026-05-18", currentWeekIndex: 5, autoMode: false });
  // Edit mode aç
  await page.evaluate(() => window.BSMTestApi.setProgramEditModeForTest(true));
  await page.waitForTimeout(150);
  // autoMode=true'ya çek (resume çağrısı) — ama edit mode'da SKIP olmalı
  const editSkip = await page.evaluate(() => {
    window.BSMTestApi.resumeAutoWeekForTest();
    return window.BSMTestApi.getProgramAutoSnapshot();
  });
  expect(editSkip.currentWeekIndex, "Edit mode'da auto compute SKIP → manuel index korunur").toBe(5);
  // Edit mode kapat
  await page.evaluate(() => window.BSMTestApi.setProgramEditModeForTest(false));

  // ─── DOĞRULAMA 12: UI Auto/Manuel badge görünür + Auto'ya dön butonu ──
  // Manuel mod (autoMode=false) → badge "Manuel" + buton görünür
  await seedProgram(page, { totalWeeks: 8, startDate: "2026-06-01", currentWeekIndex: 3, autoMode: false });
  await page.waitForTimeout(200);
  const manualUi = await page.evaluate(() => {
    const badge = document.querySelector("[data-week-auto-badge]");
    const resumeBtn = document.querySelector("[data-week-auto-resume]");
    return {
      badgeExists: !!badge,
      badgeText: (badge?.textContent || "").trim(),
      badgeMode: badge?.dataset?.weekAutoBadge || "",
      resumeBtnExists: !!resumeBtn,
      resumeBtnHidden: resumeBtn?.hidden,
    };
  });
  expect(manualUi.badgeExists, "[data-week-auto-badge] mevcut").toBe(true);
  expect(manualUi.badgeMode, "Manuel mod → data-week-auto-badge='manual'").toBe("manual");
  expect(/Manuel|Manual/i.test(manualUi.badgeText), `Manuel badge text (gerçek: "${manualUi.badgeText}")`).toBe(true);
  expect(manualUi.resumeBtnExists, "[data-week-auto-resume] buton DOM'da").toBe(true);
  expect(manualUi.resumeBtnHidden, "Manuel mod → resume buton visible").toBe(false);

  // Auto mod → badge "Auto" + buton hidden
  await seedProgram(page, { totalWeeks: 8, startDate: "2026-06-01", currentWeekIndex: 1, autoMode: true });
  await page.waitForTimeout(200);
  const autoUi = await page.evaluate(() => {
    const badge = document.querySelector("[data-week-auto-badge]");
    const resumeBtn = document.querySelector("[data-week-auto-resume]");
    return {
      badgeMode: badge?.dataset?.weekAutoBadge || "",
      badgeText: (badge?.textContent || "").trim(),
      resumeBtnHidden: resumeBtn?.hidden,
    };
  });
  expect(autoUi.badgeMode, "Auto mod → data-week-auto-badge='auto'").toBe("auto");
  expect(/Auto/i.test(autoUi.badgeText), `Auto badge text (gerçek: "${autoUi.badgeText}")`).toBe(true);
  expect(autoUi.resumeBtnHidden, "Auto mod → resume buton hidden").toBe(true);

  // ─── DOĞRULAMA 13: autoMode persistence (saveLastPlan localStorage) ──
  await seedProgram(page, { totalWeeks: 8, startDate: "2026-06-01", currentWeekIndex: 1, autoMode: true });
  await page.evaluate(() => window.BSMTestApi.setActiveWeekForTest(4));
  await page.waitForTimeout(200);
  const persisted = await page.evaluate(() => {
    const lastPlan = JSON.parse(localStorage.getItem("formaplan-studio-last-plan") || "{}");
    return {
      currentWeekIndex: lastPlan.currentWeekIndex,
      autoMode: lastPlan.currentWeekIndexAutoMode,
    };
  });
  expect(persisted.currentWeekIndex, "localStorage currentWeekIndex=4").toBe(4);
  expect(persisted.autoMode, "localStorage autoMode=false (setActiveWeek sonrası)").toBe(false);

  // ─── DOĞRULAMA 14: Console / page / network error 0 ──────────────────
  assertNoErrors(errors);
});
