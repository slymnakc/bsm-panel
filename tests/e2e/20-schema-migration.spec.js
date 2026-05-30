// 20-schema-migration.spec.js — Schema v3 → v4 migration regression baseline (M1a öncesi)
//
// AMAC: program schema'sinin mevcut v3 davranisini KILIT ALTINA almak. M1a.3
// (data-migrations.js v4 bump) sonrasi her senaryonun assertion'lari V4 davranisina
// guncellenecek (her assertion bloğunda "POST-M1a.3 UPDATE" comment'i var).
//
// V3 GERÇEK ŞEMA (data-migrations.js TARGET_SCHEMA_VERSION = 3):
//   program = {
//     schemaVersion: 3,
//     title, createdAtIso, createdAt, overview[[label,value]], coachNote,
//     sessions: [{ dayLabel, title, exercises: [...], ... }],
//     progression[], guidance[], coverage{}, programIntelligence{},
//     aiReport, trainingReport, v3Insights, programContext, rawData
//   }
//
// V4 HEDEF ŞEMA (M1a.3 sonrasi):
//   program = {
//     schemaVersion: 4,
//     macrocycle: { totalWeeks, model, deloadCadence, progressionRule },
//     weeks: [{ weekIndex, isDeload, intensityFactor, sessions: [...] }],
//     currentWeekIndex: 1,
//     sessions: weeks[0].sessions,  // BACKWARD ALIAS — v3 consumers (7 dosya) icin
//     ...mevcut v3 alanlari korunur (lossless)
//   }
//
// MIGRATION TEK NOKTA: data-migrations.js → normalizePlan(raw)
//   v3 detection: schemaVersion === 3 || (!Array.isArray(raw.weeks) && Array.isArray(raw.sessions))
//   transform: weeks=[{weekIndex:1,...,sessions: normalizeSessions(raw.sessions)}],
//              macrocycle={totalWeeks:1,model:"manual",...},
//              currentWeekIndex:1, sessions:weeks[0].sessions (alias)

const { test, expect } = require("@playwright/test");
const { setupPage, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

// V3 program seed — minimal ama lossless test icin tum onemli alanlar dolu
const V3_PROGRAM = Object.freeze({
  schemaVersion: 3,
  title: "Regression Test Programı",
  createdAtIso: "2026-05-15T10:00:00.000Z",
  createdAt: "15.05.2026",
  coachNote: "M1a migration regression notu. Bu alan v3 → v4 sonrasi korunmali.",
  overview: [
    ["Hedef", "Kas kazanımı"],
    ["Seviye", "Orta"],
    ["Antrenman sistemi", "Standart"],
  ],
  sessions: [
    {
      dayId: "monday",
      dayLabel: "Pazartesi",
      title: "Push (Göğüs / Omuz / Triceps)",
      targetGroups: ["chest", "shoulder", "triceps"],
      exercises: [
        {
          id: "bench-press",
          name: "Bench press",
          group: "chest",
          equipment: "barbell",
          sets: "4",
          reps: "8 • 8 • 8 • 8",
          rest: "120 sn",
          tempo: "2-0-2",
          cue: "Bar göğüse kontrollü iner.",
        },
        {
          id: "shoulder-press",
          name: "Shoulder press",
          group: "shoulder",
          equipment: "dumbbell",
          sets: "3",
          reps: "10 • 10 • 10",
          rest: "90 sn",
          tempo: "2-0-2",
        },
      ],
    },
    {
      dayId: "wednesday",
      dayLabel: "Çarşamba",
      title: "Pull (Sırt / Biceps)",
      targetGroups: ["back", "biceps"],
      exercises: [
        {
          id: "deadlift",
          name: "Deadlift",
          group: "back",
          equipment: "barbell",
          sets: "4",
          reps: "5 • 5 • 5 • 5",
          rest: "180 sn",
          tempo: "2-0-2",
        },
      ],
    },
  ],
  // V3 normalize: progression/guidance text-block format {title,text}; string array YUTULUR.
  progression: [
    { title: "Hafta 1-2", text: "Form oturtma, %70 yük." },
    { title: "Hafta 3-4", text: "%75-80 yük, rep'leri koru." },
  ],
  guidance: [
    { title: "Isınma", text: "Antrenman öncesi 10dk dinamik ısınma." },
    { title: "Dinlenme", text: "Set arası tam dinlenme şart." },
  ],
  // V3 coverage: array of {group, sessionCount, exerciseCount}
  coverage: [
    { group: "chest", sessionCount: 1, exerciseCount: 2 },
    { group: "back", sessionCount: 1, exerciseCount: 1 },
    { group: "shoulder", sessionCount: 1, exerciseCount: 1 },
  ],
  programIntelligence: {
    primaryFocus: "muscle-gain",
    weeklyVolume: 11,
    notes: ["Üst-alt vücut dengeli dağılım."],
  },
  rawData: {
    memberName: "Test Üye",
    goal: "muscle-gain",
    level: "intermediate",
    days: ["monday", "wednesday"],
    trainingSystem: "standard",
  },
});

// Seed helper — DEFAULT_MEMBER + 1 v3 program record
function buildSeedMemberWithV3Program() {
  return {
    ...DEFAULT_MEMBER,
    programs: [
      {
        id: "regression-program-1",
        savedAtIso: "2026-05-15T10:00:00.000Z",
        savedAt: "15.05.2026",
        program: JSON.parse(JSON.stringify(V3_PROGRAM)),
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEST 1 — V3 schema baseline (M1a.3 sonrası V4 olur)
// ═══════════════════════════════════════════════════════════════════
test("Schema v3 baseline — program.schemaVersion=3 + weeks/macrocycle YOK (pre-migration)", async ({ page }) => {
  const { errors } = await setupPage(page);

  await page.evaluate((member) => {
    localStorage.setItem("formaplan-studio-members", JSON.stringify([member]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
  }, buildSeedMemberWithV3Program());

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  const snapshot = await page.evaluate(() => {
    const members = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    const program = members[0]?.programs?.[0]?.program;
    return {
      hasProgram: Boolean(program),
      schemaVersion: program?.schemaVersion,
      sessionsType: Array.isArray(program?.sessions) ? "array" : typeof program?.sessions,
      sessionsLength: Array.isArray(program?.sessions) ? program.sessions.length : 0,
      // V4 alanları (şu an undefined olmalı — M1a.3 sonrası varlık beklenecek)
      hasWeeks: Array.isArray(program?.weeks),
      hasMacrocycle: !!(program?.macrocycle && typeof program.macrocycle === "object"),
      hasCurrentWeekIndex: typeof program?.currentWeekIndex === "number",
    };
  });

  expect(snapshot.hasProgram, "program seed yuklendi").toBe(true);

  // ── V3 BASELINE (current) ──────────────────────────────────────
  expect(snapshot.schemaVersion, "V3: schemaVersion === 3").toBe(3);
  expect(snapshot.sessionsType, "V3: sessions array").toBe("array");
  expect(snapshot.sessionsLength, "V3: sessions length === 2 (seed)").toBe(2);
  expect(snapshot.hasWeeks, "V3: weeks alanı YOK").toBe(false);
  expect(snapshot.hasMacrocycle, "V3: macrocycle alanı YOK").toBe(false);
  expect(snapshot.hasCurrentWeekIndex, "V3: currentWeekIndex YOK").toBe(false);

  // ── POST-M1a.3 UPDATE: ─────────────────────────────────────────
  // expect(snapshot.schemaVersion).toBe(4);
  // expect(snapshot.hasWeeks).toBe(true);
  // expect(snapshot.hasMacrocycle).toBe(true);
  // expect(snapshot.hasCurrentWeekIndex).toBe(true);
  // + ek snapshot: weeks[0].weekIndex===1, weeks[0].isDeload===false,
  //   weeks[0].intensityFactor===1.0, macrocycle.totalWeeks===1,
  //   macrocycle.model==="manual", macrocycle.deloadCadence===0

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 2 — sessions alias / data shape (V3'te direkt array, V4'te alias)
// ═══════════════════════════════════════════════════════════════════
test("Schema v3 baseline — program.sessions doğrudan array (pre-migration alias yok)", async ({ page }) => {
  const { errors } = await setupPage(page);

  await page.evaluate((member) => {
    localStorage.setItem("formaplan-studio-members", JSON.stringify([member]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
  }, buildSeedMemberWithV3Program());

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  const shape = await page.evaluate(() => {
    const members = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    const program = members[0]?.programs?.[0]?.program;
    return {
      sessionsArray: Array.isArray(program?.sessions),
      sessionsLength: program?.sessions?.length,
      firstSessionDayId: program?.sessions?.[0]?.dayId,
      firstSessionDayLabel: program?.sessions?.[0]?.dayLabel,
      firstSessionExerciseCount: program?.sessions?.[0]?.exercises?.length,
      firstExerciseName: program?.sessions?.[0]?.exercises?.[0]?.name,
      // V4 alias kontrolü (şu an weeks yok → erişilemez)
      weeksZeroSessionsExists: Array.isArray(program?.weeks?.[0]?.sessions),
    };
  });

  // ── V3 BASELINE (current) ──────────────────────────────────────
  expect(shape.sessionsArray, "V3: program.sessions array").toBe(true);
  expect(shape.sessionsLength, "V3: sessions.length === 2").toBe(2);
  expect(shape.firstSessionDayId, "V3: first session dayId").toBe("monday");
  expect(shape.firstSessionDayLabel, "V3: first session dayLabel").toBe("Pazartesi");
  expect(shape.firstSessionExerciseCount, "V3: first session exercise count").toBe(2);
  expect(shape.firstExerciseName, "V3: first exercise name").toBe("Bench press");
  expect(shape.weeksZeroSessionsExists, "V3: weeks[0] YOK").toBe(false);

  // ── POST-M1a.3 UPDATE: ─────────────────────────────────────────
  // expect(shape.weeksZeroSessionsExists).toBe(true);
  // + ek snapshot: program.weeks[0].sessions === program.sessions (ALIAS shallow ref check
  //   page.evaluate icinde 'const same = program.sessions === program.weeks[0].sessions')
  // + V4 alias garantisi: 7 consumer (app.js + outputActions + ui/output-ui +
  //   program-summary-service + output-model-service + form-handlers + analysis-engine)
  //   program.sessions okumaya devam edebilir

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 3 — Backup restore migrate (V3 backup JSON → state)
// ═══════════════════════════════════════════════════════════════════
test("Schema v3 baseline — backup restore JSON v3 schemaVersion korunur (pre-migration)", async ({ page }) => {
  const { errors } = await setupPage(page);

  // V3 backup payload (handleDownloadBackup formatı — schemaVersion + members[])
  const backupPayload = {
    schemaVersion: 3,
    exportedAt: "2026-05-15T11:00:00.000Z",
    activeMemberId: DEFAULT_MEMBER.id,
    members: [buildSeedMemberWithV3Program()],
  };

  // Confirm dialog → ACCEPT
  page.on("dialog", (dialog) => dialog.accept());

  // BSMTestApi.triggerBackupRestore(jsonText) → handleBackupFileSelected akışı
  await page.evaluate((json) => window.BSMTestApi.triggerBackupRestore(json), JSON.stringify(backupPayload));
  await page.waitForTimeout(500);

  const afterRestore = await page.evaluate(() => {
    const members = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    const program = members[0]?.programs?.[0]?.program;
    return {
      memberCount: members.length,
      programSchemaVersion: program?.schemaVersion,
      sessionsLength: program?.sessions?.length,
      programTitle: program?.title,
      hasWeeks: Array.isArray(program?.weeks),
      hasMacrocycle: !!(program?.macrocycle && typeof program.macrocycle === "object"),
    };
  });

  expect(afterRestore.memberCount, "1 üye restore edildi").toBe(1);
  expect(afterRestore.programTitle, "program title preserved").toBe("Regression Test Programı");
  expect(afterRestore.sessionsLength, "sessions preserved (2)").toBe(2);

  // ── V3 BASELINE (current) ──────────────────────────────────────
  expect(afterRestore.programSchemaVersion, "V3: backup'tan gelen program schemaVersion === 3").toBe(3);
  expect(afterRestore.hasWeeks, "V3: weeks YOK").toBe(false);
  expect(afterRestore.hasMacrocycle, "V3: macrocycle YOK").toBe(false);

  // ── POST-M1a.3 UPDATE: ─────────────────────────────────────────
  // expect(afterRestore.programSchemaVersion).toBe(4);
  // expect(afterRestore.hasWeeks).toBe(true);
  // expect(afterRestore.hasMacrocycle).toBe(true);
  // → extractMembersFromBackup → normalizeImportedMembers → normalizeMember →
  //   normalizeProgramRecord → normalizePlan zincirinde v3→v4 otomatik migrate

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 4 — Lossless: tüm v3 alanları korunur (overview/coachNote/programIntelligence)
// ═══════════════════════════════════════════════════════════════════
test("Schema v3 baseline — normalizePlan lossless (overview/coachNote/programIntelligence korunur)", async ({ page }) => {
  const { errors } = await setupPage(page);

  await page.evaluate((member) => {
    localStorage.setItem("formaplan-studio-members", JSON.stringify([member]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
  }, buildSeedMemberWithV3Program());

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  const fields = await page.evaluate(() => {
    const members = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    const program = members[0]?.programs?.[0]?.program;
    return {
      // Yapısal alanlar
      title: program?.title,
      coachNote: program?.coachNote,
      // overview = [[label,value], ...]
      overviewLength: Array.isArray(program?.overview) ? program.overview.length : 0,
      overviewFirstLabel: program?.overview?.[0]?.[0],
      overviewFirstValue: program?.overview?.[0]?.[1],
      // progression / guidance (text blocks {title,text})
      progressionLength: Array.isArray(program?.progression) ? program.progression.length : 0,
      guidanceLength: Array.isArray(program?.guidance) ? program.guidance.length : 0,
      progressionFirstTitle: program?.progression?.[0]?.title,
      progressionFirstText: program?.progression?.[0]?.text,
      // coverage [{group,sessionCount,exerciseCount}]
      coverageLength: Array.isArray(program?.coverage) ? program.coverage.length : 0,
      coverageFirstGroup: program?.coverage?.[0]?.group,
      coverageFirstSessionCount: program?.coverage?.[0]?.sessionCount,
      // programIntelligence (nested obj)
      piPrimaryFocus: program?.programIntelligence?.primaryFocus,
      piWeeklyVolume: program?.programIntelligence?.weeklyVolume,
      piNotesLength: Array.isArray(program?.programIntelligence?.notes) ? program.programIntelligence.notes.length : 0,
      // rawData
      rawDataGoal: program?.rawData?.goal,
      rawDataLevel: program?.rawData?.level,
    };
  });

  // ── LOSSLESS doğrulaması (v3'te DE v4'te DE geçmeli) ──────────
  expect(fields.title, "title preserved").toBe("Regression Test Programı");
  expect(fields.coachNote, "coachNote preserved").toBe("M1a migration regression notu. Bu alan v3 → v4 sonrasi korunmali.");
  expect(fields.overviewLength, "overview length 3").toBe(3);
  expect(fields.overviewFirstLabel, "overview[0][0]").toBe("Hedef");
  expect(fields.overviewFirstValue, "overview[0][1]").toBe("Kas kazanımı");
  expect(fields.progressionLength, "progression length 2").toBe(2);
  expect(fields.guidanceLength, "guidance length 2").toBe(2);
  expect(fields.progressionFirstTitle, "progression first title").toBe("Hafta 1-2");
  expect(fields.progressionFirstText, "progression first text").toBe("Form oturtma, %70 yük.");
  expect(fields.coverageLength, "coverage length 3").toBe(3);
  expect(fields.coverageFirstGroup, "coverage[0].group").toBe("chest");
  expect(fields.coverageFirstSessionCount, "coverage[0].sessionCount").toBe(1);
  expect(fields.piPrimaryFocus, "programIntelligence.primaryFocus").toBe("muscle-gain");
  expect(fields.piWeeklyVolume, "programIntelligence.weeklyVolume").toBe(11);
  expect(fields.piNotesLength, "programIntelligence.notes length").toBe(1);
  expect(fields.rawDataGoal, "rawData.goal").toBe("muscle-gain");
  expect(fields.rawDataLevel, "rawData.level").toBe("intermediate");

  // ── POST-M1a.3 UPDATE: ─────────────────────────────────────────
  // Bu assertion'lar AYNI KALACAK (lossless garanti). Sadece TEST 1/2/3'teki
  // schemaVersion + weeks + macrocycle assertion'lari v4'e guncellenir.
  // Lossless test = migration'in zarar vermedigini dogrular.

  assertNoErrors(errors, { allowNetwork: true });
});
