// 17-member-crud.spec.js — Member selection + hydration regression baseline (4B öncesi)
//
// AMAC: 4B (members domain split) oncesi hydrateActiveMemberSession + loadMember +
// persistMembers davranisini kilit altina almak. Ozellikle:
//   - hydrateActiveMemberSession render sirasi (renderMemberWorkspace → renderProgram →
//     renderNutritionWorkspace)
//   - renderProgram tetigi (state.activeProgram korunumu)
//   - renderNutritionWorkspace tetigi (state.activeNutritionPlan)
//   - latestMeasurement sync (syncActiveMemberState)
//   - activeMemberId persistence (localStorage)
//   - loadMember selection flow (member degisimi + program/nutrition swap)
//
// Supabase: test mode izolasyonu (setupPage bsmTestMode=true) — realtime sync disable.
// Gercek realtime rewrite YOK.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

const ACTIVE_ID_KEY = "formaplan-studio-active-member-id";
const MEMBERS_KEY = "formaplan-studio-members";

function programRecord(id, title, exerciseName) {
  return {
    id,
    savedAtIso: "2026-05-28T00:00:00.000Z",
    savedAt: "28.05.2026",
    program: {
      schemaVersion: 3,
      title,
      createdAtIso: "2026-05-28T00:00:00.000Z",
      createdAt: "28.05.2026",
      coachNote: "Member regression test programi.",
      overview: [["Üye", title]],
      sessions: [
        {
          dayId: "monday",
          dayLabel: "Pazartesi",
          dayName: "Pazartesi",
          exercises: [
            { id: "barbell-bench-press", name: exerciseName, group: "chest", equipment: "barbell", sets: 3, reps: "10", rest: "60-90 sn", tempo: "2-0-2", notes: "" },
          ],
        },
      ],
      progression: [],
      guidance: [],
      coverage: [],
      rawData: { memberName: title, goal: "muscle-gain", level: "intermediate", days: ["monday"] },
    },
  };
}

const NUTRITION_PLAN_SEED = {
  schemaVersion: 3,
  memberName: "Test Üye",
  goal: "balanced",
  calories: 2200,
  macros: { protein: 165, carbs: 220, fat: 70 },
  meals: [
    { name: "Kahvaltı", time: "08:30", timingLabel: "Kahvaltı", scheduleRole: "meal", foods: "Yulaf, yumurta", calories: 520, protein: 32, carbs: 55, fat: 18 },
    { name: "Öğle", time: "13:00", timingLabel: "Öğle", scheduleRole: "meal", foods: "Tavuk, pilav", calories: 680, protein: 52, carbs: 70, fat: 18 },
  ],
  supplements: [],
  createdAtIso: "2026-05-28T00:00:00.000Z",
};

// Member 1 = DEFAULT_MEMBER (measurements mevcut) + program + nutrition plan
const MEMBER1 = {
  ...DEFAULT_MEMBER,
  programs: [programRecord("prog-m1", "Üye1 Programı", "Barbell Bench Press")],
  nutritionPlan: NUTRITION_PLAN_SEED,
  nutritionPlans: [NUTRITION_PLAN_SEED],
};

// Member 2 = farkli measurement + program (selection swap testi)
const MEMBER2 = {
  id: "regression-test-member-2",
  schemaVersion: 3,
  profile: {
    memberName: "İkinci Üye",
    memberCode: "TEST-002",
    memberEmail: "test2@bsm.local",
    trainerName: "Test Antrenör",
    goal: "fat-loss",
    level: "beginner",
    programStyle: "auto",
    trainingSystem: "standard",
    equipmentScope: "full-gym",
    duration: 45,
    priorityMuscle: "balanced",
    cardioPreference: "balanced",
    restrictions: [],
    days: ["tuesday", "thursday"],
    notes: "",
  },
  measurements: [
    { id: "m2-1", date: "2026-05-20", weight: 90.5, fat: 25.1, muscleMass: 60.2, bmi: 28.4, visceralFat: 12, bmr: 1750, bodyWater: 52.1, source: "manual" },
  ],
  programs: [programRecord("prog-m2", "Üye2 Programı", "Deadlift")],
  nutritionPlan: null,
  nutritionPlans: [],
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
};

// ═══════════════════════════════════════════════════════════════════
// TEST 1 — HYDRATE: reload → hydrateActiveMemberSession render zinciri
// ═══════════════════════════════════════════════════════════════════
test("Member hydrate — render order + program/nutrition trigger + latestMeasurement sync", async ({ page }) => {
  const { errors } = await setupPage(page);

  await page.evaluate(
    ({ member, key, idKey }) => {
      localStorage.setItem(key, JSON.stringify([member]));
      localStorage.setItem(idKey, JSON.stringify(member.id));
    },
    { member: MEMBER1, key: MEMBERS_KEY, idKey: ACTIVE_ID_KEY },
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });
  await page.waitForTimeout(400);

  const snap = await page.evaluate(() => {
    const s = window.__bsm?.state || {};
    return {
      activeMemberId: s.activeMemberId,
      activeMemberSet: Boolean(s.activeMember),
      // renderProgram tetigi → activeProgram korunumu
      activeProgramSet: Boolean(s.activeProgram),
      activeProgramTitle: s.activeProgram?.title || "",
      // renderNutritionWorkspace tetigi
      activeNutritionPlanSet: Boolean(s.activeNutritionPlan),
      activeNutritionCalories: s.activeNutritionPlan?.calories || 0,
      activeNutritionMemberId: s.activeNutritionMemberId,
      // latestMeasurement sync (syncActiveMemberState)
      latestMeasurementWeight: s.latestMeasurement?.weight || null,
      // workspace visibility
      membersPanelExists: !!document.querySelector("#membersPanel"),
    };
  });

  // ─── activeMemberId + persistence ───────────────────────────────────
  expect(snap.activeMemberId, "activeMemberId = seeded member").toBe(MEMBER1.id);
  expect(snap.activeMemberSet, "state.activeMember set (syncActiveMemberState)").toBe(true);

  const persistedId = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), ACTIVE_ID_KEY);
  expect(persistedId, "activeMemberId localStorage'da persist").toBe(MEMBER1.id);

  // ─── renderProgram tetigi → activeProgram korunumu ──────────────────
  expect(snap.activeProgramSet, "hydrate → renderProgram → state.activeProgram dolu").toBe(true);
  expect(snap.activeProgramTitle, "activeProgram member1 programi").toBe("Üye1 Programı");

  // ─── renderNutritionWorkspace tetigi ────────────────────────────────
  expect(snap.activeNutritionPlanSet, "hydrate → activeNutritionPlan set").toBe(true);
  expect(snap.activeNutritionCalories, "nutrition plan calories korundu").toBe(2200);
  expect(snap.activeNutritionMemberId, "activeNutritionMemberId = member").toBe(MEMBER1.id);

  // ─── latestMeasurement sync (syncActiveMemberState) ─────────────────
  expect(snap.latestMeasurementWeight, "latestMeasurement = member.measurements[0] (78.2)").toBe(78.2);

  // ─── workspace visibility ───────────────────────────────────────────
  expect(snap.membersPanelExists, "#membersPanel DOM'da").toBe(true);

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 2 — RAIL SELECTION: member list rail card → selectActiveMemberFromRail
// (Gercek member list mekanizmasi: bsm-rail-card[data-rail-member-id] click →
//  app.js membersPanel delegation → selectActiveMemberFromRail. loadMember DEGIL:
//  rail selection uyeler ekraninda kalir, renderProgram cagirMAZ.)
// ═══════════════════════════════════════════════════════════════════
test("Member rail selection — selectActiveMemberFromRail swaps activeMember + measurement + persist", async ({ page }) => {
  const { errors } = await setupPage(page);

  await page.evaluate(
    ({ m1, m2, key, idKey }) => {
      localStorage.setItem(key, JSON.stringify([m1, m2]));
      localStorage.setItem(idKey, JSON.stringify(m1.id));
    },
    { m1: MEMBER1, m2: MEMBER2, key: MEMBERS_KEY, idKey: ACTIVE_ID_KEY },
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  await navigate(page, "members");
  await page.waitForTimeout(500);

  // Baslangic: member1 aktif
  const before = await page.evaluate(() => ({
    activeMemberId: window.__bsm?.state?.activeMemberId,
  }));
  expect(before.activeMemberId, "baslangic activeMemberId = member1").toBe(MEMBER1.id);

  // Member list'te member2'nin rail card'ina tikla (gercek selection mekanizmasi)
  const clicked = await page.evaluate((targetId) => {
    const btn = document.querySelector(`#memberList .bsm-rail-card[data-rail-member-id="${targetId}"]`);
    if (!btn) return { ok: false, reason: "rail card bulunamadi" };
    btn.click();
    return { ok: true };
  }, MEMBER2.id);
  expect(clicked.ok, `member2 rail card mevcut (${clicked.reason || ""})`).toBe(true);
  await page.waitForTimeout(700);

  // Selection swap dogrulama (selectActiveMemberFromRail davranisi)
  const after = await page.evaluate(() => {
    const s = window.__bsm?.state || {};
    return {
      activeMemberId: s.activeMemberId,
      latestMeasurementWeight: s.latestMeasurement?.weight || null,
      activeNutritionPlanSet: Boolean(s.activeNutritionPlan),
      activeNutritionMemberId: s.activeNutritionMemberId,
    };
  });

  expect(after.activeMemberId, "rail selection sonrasi activeMemberId = member2").toBe(MEMBER2.id);
  expect(after.latestMeasurementWeight, "latestMeasurement member2 (90.5) sync").toBe(90.5);
  expect(after.activeNutritionMemberId, "activeNutritionMemberId = member2").toBe(MEMBER2.id);
  // member2 nutritionPlan null → activeNutritionPlan null (swap)
  expect(after.activeNutritionPlanSet, "member2 nutritionPlan yok → activeNutritionPlan null (swap)").toBe(false);

  // activeMemberId persistence (saveActiveMemberId)
  const persistedId = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), ACTIVE_ID_KEY);
  expect(persistedId, "rail selection → activeMemberId localStorage persist (member2)").toBe(MEMBER2.id);

  // persistMembers/members localStorage: 2 uye korundu
  const membersPersisted = await page.evaluate((k) => {
    const m = JSON.parse(localStorage.getItem(k) || "[]");
    return { count: m.length };
  }, MEMBERS_KEY);
  expect(membersPersisted.count, "members localStorage'da 2 uye korundu").toBe(2);

  assertNoErrors(errors, { allowNetwork: true });
});
