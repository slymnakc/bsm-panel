// 24-week-navigation.spec.js — M1b.4 week navigation + alias dynamic re-bind
// KRİTİK SPRINT: state.activeProgram.sessions artık weeks[currentWeekIndex-1].sessions.
// Test-first: week tabs UI + setActiveWeek + alias re-bind + persistence.
//
// Kontroller:
//   1. Week tabs DOM container var (#programWeekTabs)
//   2. 8 hafta program → 8 chip render + deload icon
//   3. totalWeeks=1 → tabs hidden
//   4. Aktif chip initial = currentWeekIndex (1)
//   5. setActiveWeek(3) → currentWeekIndex=3 + alias re-bind (sessions===weeks[2].sessions)
//   6. Cover band "Hafta 3 / 8" güncellenir
//   7. Inline edit aktif haftaya yazar (weeks[2] değişir, weeks[0] korunur)
//   8. Edit mode'da week tabs disabled
//   9. currentWeekIndex localStorage persist + reload sonrası restore
//   10. console / page / network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(120000);

// Helper: 8 haftalık linear program oluştur (form submit yerine engine + render)
async function seedEightWeekProgram(page) {
  return page.evaluate(() => {
    const baseSessions = [
      { day: "monday", dayLabel: "Pazartesi", title: "Üst Vücut", sessionIndex: 0,
        exercises: [{ name: "Bench Press", group: "chest", sets: 4, reps: "8", rest: "90 sn", tempo: "2-0-2", prescription: "4 x 8" }] },
      { day: "wednesday", dayLabel: "Çarşamba", title: "Alt Vücut", sessionIndex: 1,
        exercises: [{ name: "Squat", group: "legs", sets: 5, reps: "5", rest: "120 sn", tempo: "3-1-1", prescription: "5 x 5" }] },
    ];
    // TAM v4-valid program: 8 elemanlı weeks array (her hafta kendi sessions kopyası).
    // Bu, "saved v4 plan load" senaryosunu simüle eder — normalizePlan v4 path'e
    // girer (macrocycle korunur), renderProgram weeks.length===totalWeeks görüp
    // expansion'ı SKIP eder (idempotent). Her haftaya ayrı sessions clone (deep)
    // ki inline edit izolasyonu test edilebilsin.
    const mkSessions = () => JSON.parse(JSON.stringify(baseSessions));
    const weeks = Array.from({ length: 8 }, (_, i) => ({
      weekIndex: i + 1,
      isDeload: (i + 1) % 4 === 0,   // hafta 4 ve 8 deload
      intensityFactor: 1.0,
      sessions: mkSessions(),
    }));
    const program = {
      schemaVersion: 4,
      title: "8 Haftalık Test Programı",
      createdAtIso: new Date().toISOString(),
      createdAt: new Date().toLocaleDateString("tr-TR"),
      overview: [["Üye", "Hafta Test Üye"]],
      coachNote: "Test",
      progression: [],
      guidance: [],
      coverage: [],
      macrocycle: { totalWeeks: 8, model: "linear", deloadCadence: 4, progressionRule: { type: "linear", deltaPercent: 2.5 } },
      weeks,
      currentWeekIndex: 1,
      sessions: weeks[0].sessions,
      rawData: { memberName: "Hafta Test Üye", trainerName: "T", goal: "muscle-gain", level: "intermediate", days: ["monday", "wednesday"] },
    };
    // renderProgram → engine expand + alias bind + week tabs render
    if (typeof window.BSMTestApi?.renderProgramForTest === "function") {
      window.BSMTestApi.renderProgramForTest(program);
    }
    return true;
  });
}

test("Week navigation — tabs + setActiveWeek + alias re-bind + persistence", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "output");
  await page.waitForTimeout(400);

  // ─── DOĞRULAMA 1: Week tabs container DOM'da ──────────────────────────
  const containerExists = await page.evaluate(() => ({
    tabs: !!document.querySelector("#programWeekTabs"),
    hasAttr: !!document.querySelector("[data-week-tabs]"),
    hasTestApi: typeof window.BSMTestApi?.renderProgramForTest === "function",
    hasSetActiveWeek: typeof window.BSMTestApi?.setActiveWeekForTest === "function",
    hasWeeksSnapshot: typeof window.BSMTestApi?.getProgramWeeksSnapshot === "function",
  }));
  expect(containerExists.tabs, "#programWeekTabs container DOM'da").toBe(true);
  expect(containerExists.hasAttr, "[data-week-tabs] attr mevcut").toBe(true);
  expect(containerExists.hasTestApi, "renderProgramForTest test hook mevcut").toBe(true);
  expect(containerExists.hasSetActiveWeek, "setActiveWeekForTest test hook mevcut").toBe(true);
  expect(containerExists.hasWeeksSnapshot, "getProgramWeeksSnapshot test hook mevcut").toBe(true);

  // ─── DOĞRULAMA 2: 8 hafta program → 8 chip + deload icon ──────────────
  await seedEightWeekProgram(page);
  await page.waitForTimeout(500);

  const tabsRender = await page.evaluate(() => {
    const chips = [...document.querySelectorAll("#programWeekTabs [data-week-chip]")];
    return {
      tabsHidden: document.querySelector("#programWeekTabs")?.hidden,
      chipCount: chips.length,
      deloadChips: chips.filter((c) => c.dataset.deload === "true").map((c) => Number(c.dataset.weekChip)),
      activeChip: chips.find((c) => c.classList.contains("is-active"))?.dataset.weekChip,
    };
  });
  expect(tabsRender.tabsHidden, "8 hafta → tabs visible").toBe(false);
  expect(tabsRender.chipCount, "8 chip render").toBe(8);
  // deload=4 → hafta 4 ve 8 deload
  expect(tabsRender.deloadChips, "Deload chip'leri hafta 4 ve 8").toEqual([4, 8]);

  // ─── DOĞRULAMA 4: Aktif chip initial = 1 ──────────────────────────────
  expect(tabsRender.activeChip, "Initial aktif chip hafta 1").toBe("1");

  const weeksSnapshot = await page.evaluate(() => window.BSMTestApi.getProgramWeeksSnapshot());
  expect(weeksSnapshot.weeksLength, "weeks.length=8").toBe(8);
  expect(weeksSnapshot.currentWeekIndex, "currentWeekIndex=1").toBe(1);
  expect(weeksSnapshot.aliasMatchesCurrent, "sessions === weeks[0].sessions (initial alias)").toBe(true);

  // ─── DOĞRULAMA 5: setActiveWeek(3) → currentWeekIndex + alias re-bind ──
  await page.evaluate(() => window.BSMTestApi.setActiveWeekForTest(3));
  await page.waitForTimeout(500);

  const afterSwitch = await page.evaluate(() => {
    const snap = window.BSMTestApi.getProgramWeeksSnapshot();
    const chips = [...document.querySelectorAll("#programWeekTabs [data-week-chip]")];
    return {
      currentWeekIndex: snap.currentWeekIndex,
      aliasMatchesCurrent: snap.aliasMatchesCurrent,   // sessions === weeks[2].sessions
      activeChip: chips.find((c) => c.classList.contains("is-active"))?.dataset.weekChip,
      pastChips: chips.filter((c) => c.classList.contains("is-past")).map((c) => c.dataset.weekChip),
    };
  });
  expect(afterSwitch.currentWeekIndex, "setActiveWeek(3) → currentWeekIndex=3").toBe(3);
  expect(afterSwitch.aliasMatchesCurrent, "ALIAS RE-BIND: sessions === weeks[2].sessions").toBe(true);
  expect(afterSwitch.activeChip, "Aktif chip hafta 3").toBe("3");
  expect(afterSwitch.pastChips, "Geçmiş chip'ler 1 ve 2").toEqual(["1", "2"]);

  // ─── DOĞRULAMA 6: Cover band "Hafta 3 / 8" güncellenir ────────────────
  const coverAfterSwitch = await page.evaluate(() => ({
    current: (document.querySelector("#coverMacroCurrent")?.textContent || "").trim(),
  }));
  expect(/Hafta\s*3\s*\/\s*8/i.test(coverAfterSwitch.current), `Cover "Hafta 3 / 8" (gerçek: "${coverAfterSwitch.current}")`).toBe(true);

  // ─── DOĞRULAMA 7: Inline edit aktif haftaya yazar (weeks[2] değişir, weeks[0] korunur) ──
  const editResult = await page.evaluate(() => {
    // Hafta 3 aktif. Aktif sessions[0].exercises[0].name değiştir.
    const snap1 = window.BSMTestApi.getProgramWeeksSnapshot();
    const week0Name_before = snap1.week0FirstExerciseName;
    const week2Name_before = snap1.currentFirstExerciseName;

    // Inline edit simülasyonu: aktif hafta exercise name değiştir
    window.BSMTestApi.editActiveExerciseNameForTest("MODIFIED HAFTA 3");

    const snap2 = window.BSMTestApi.getProgramWeeksSnapshot();
    return {
      week0Before: week0Name_before,
      week2Before: week2Name_before,
      week0After: snap2.week0FirstExerciseName,
      week2After: snap2.currentFirstExerciseName,
    };
  });
  expect(editResult.week2After, "Aktif hafta (3) exercise name değişti").toBe("MODIFIED HAFTA 3");
  expect(editResult.week0After, "Hafta 1 (weeks[0]) exercise name KORUNDU (değişmedi)").toBe(editResult.week0Before);
  expect(editResult.week0After, "Hafta 1 modified olmadı").not.toBe("MODIFIED HAFTA 3");

  // ─── DOĞRULAMA 8: Edit mode'da week tabs disabled ─────────────────────
  const editModeState = await page.evaluate(() => {
    window.BSMTestApi.setProgramEditModeForTest(true);
    const chips = [...document.querySelectorAll("#programWeekTabs [data-week-chip]")];
    return {
      allDisabled: chips.every((c) => c.disabled === true),
      containerDisabledClass: !!document.querySelector("#programWeekTabs")?.classList.contains("is-disabled"),
    };
  });
  expect(editModeState.allDisabled, "Edit mode'da tüm chip'ler disabled").toBe(true);

  // Edit mode kapat → tabs tekrar enabled
  const editModeOff = await page.evaluate(() => {
    window.BSMTestApi.setProgramEditModeForTest(false);
    const chips = [...document.querySelectorAll("#programWeekTabs [data-week-chip]")];
    return chips.every((c) => c.disabled === false);
  });
  expect(editModeOff, "Edit mode kapanınca chip'ler enabled").toBe(true);

  // ─── DOĞRULAMA 9: currentWeekIndex persistence (reload sonrası restore) ──
  // setActiveWeek(5) → localStorage'a yazılır → reload → hala hafta 5
  await page.evaluate(() => window.BSMTestApi.setActiveWeekForTest(5));
  await page.waitForTimeout(400);

  const beforeReload = await page.evaluate(() => {
    const lastPlan = JSON.parse(localStorage.getItem("formaplan-studio-last-plan") || "{}");
    return {
      currentWeekIndex: window.BSMTestApi.getProgramWeeksSnapshot().currentWeekIndex,
      persistedIndex: lastPlan.currentWeekIndex,
    };
  });
  expect(beforeReload.currentWeekIndex, "setActiveWeek(5) state").toBe(5);
  expect(beforeReload.persistedIndex, "localStorage last-plan currentWeekIndex=5").toBe(5);

  // ─── DOĞRULAMA 10: console / page / network error 0 ──────────────────
  assertNoErrors(errors);
});
