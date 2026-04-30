(function () {
  "use strict";

  const TARGET_SCHEMA_VERSION = 3;
  const DEFAULT_FORM = {
    gymName: "Bahçeşehir Spor Merkezi",
    memberName: "",
    memberCode: "",
    trainerName: "",
    goal: "",
    level: "",
    programStyle: "auto",
    trainingSystem: "standard",
    equipmentScope: "full-gym",
    duration: 60,
    priorityMuscle: "balanced",
    cardioPreference: "balanced",
    restrictions: [],
    days: [],
    notes: "",
  };

  const MEASUREMENT_NUMERIC_KEYS = [
    "weight",
    "height",
    "age",
    "fat",
    "muscleMass",
    "fatMass",
    "fatFreeMass",
    "bodyWater",
    "bmi",
    "visceralFat",
    "bmr",
    "metabolicAge",
    "boneMass",
    "waist",
    "hip",
    "chest",
    "birthDay",
    "birthMonth",
    "birthYear",
  ];

  const SEGMENT_KEYS = [
    "rightArmMuscle",
    "leftArmMuscle",
    "trunkMuscle",
    "rightLegMuscle",
    "leftLegMuscle",
    "rightArmFat",
    "leftArmFat",
    "trunkFat",
    "rightLegFat",
    "leftLegFat",
  ];

  const RESISTANCE_KEYS = [
    "rightArmResistance",
    "leftArmResistance",
    "trunkResistance",
    "rightLegResistance",
    "leftLegResistance",
  ];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeFormData(raw) {
    if (!raw || typeof raw !== "object") {
      return { ...DEFAULT_FORM, schemaVersion: TARGET_SCHEMA_VERSION };
    }

    const normalized = {
      ...DEFAULT_FORM,
      schemaVersion: TARGET_SCHEMA_VERSION,
      gymName: normalizeString(raw.gymName, DEFAULT_FORM.gymName),
      memberName: normalizeString(raw.memberName || raw.userName),
      memberCode: normalizeString(raw.memberCode),
      trainerName: normalizeString(raw.trainerName),
      goal: normalizeString(raw.goal),
      level: normalizeString(raw.level),
      programStyle: normalizeString(raw.programStyle, DEFAULT_FORM.programStyle),
      trainingSystem: normalizeString(raw.trainingSystem, DEFAULT_FORM.trainingSystem),
      equipmentScope: normalizeString(raw.equipmentScope, DEFAULT_FORM.equipmentScope),
      duration: clamp(toNumberOrFallback(raw.duration, DEFAULT_FORM.duration), 30, 75),
      priorityMuscle: normalizeString(raw.priorityMuscle, DEFAULT_FORM.priorityMuscle),
      cardioPreference: normalizeString(raw.cardioPreference, DEFAULT_FORM.cardioPreference),
      restrictions: normalizeStringArray(raw.restrictions),
      days: normalizeStringArray(raw.days),
      notes: normalizeString(raw.notes),
    };

    return normalized;
  }

  function normalizeMeasurement(raw, fallbackDate) {
    const input = raw && typeof raw === "object" ? raw : {};
    const normalized = {
      id: String(input.id || makeId("measurement")),
      createdAtIso: normalizeIsoDate(input.createdAtIso) || new Date().toISOString(),
      date: normalizeDateString(input.date || fallbackDate || ""),
      time: normalizeString(input.time),
      gender: normalizeString(input.gender),
      source: normalizeString(input.source),
      rawPayload: input.rawPayload && typeof input.rawPayload === "object" ? input.rawPayload : null,
      note: normalizeString(input.note),
    };

    MEASUREMENT_NUMERIC_KEYS.forEach((key) => {
      normalized[key] = toNumberOrEmpty(input[key]);
    });

    normalized.segments = normalizeNumericObject(input.segments, SEGMENT_KEYS);
    normalized.resistance = normalizeNumericObject(input.resistance, RESISTANCE_KEYS);
    normalized.birthDate = normalizeBirthDateValue(input.birthDate, normalized.birthDay, normalized.birthMonth, normalized.birthYear);
    normalized.age = normalized.birthDate
      ? calculateAgeFromBirthDate(normalized.birthDate, normalized.date || todayInputValue())
      : normalized.age;

    return normalized;
  }

  function normalizeProgramRecord(raw) {
    const record = raw && typeof raw === "object" ? raw : {};
    const normalizedProgram = normalizePlan(record.program);

    return {
      id: String(record.id || makeId("program")),
      savedAtIso: normalizeIsoDate(record.savedAtIso) || normalizedProgram?.createdAtIso || new Date().toISOString(),
      savedAt: normalizeString(record.savedAt, normalizedProgram?.createdAt || ""),
      program: normalizedProgram,
    };
  }

  function normalizePlan(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const createdAtIso = normalizeIsoDate(raw.createdAtIso) || new Date().toISOString();

    return {
      ...raw,
      schemaVersion: TARGET_SCHEMA_VERSION,
      createdAtIso,
      createdAt: normalizeString(raw.createdAt, formatDisplayDate(createdAtIso)),
      title: normalizeString(raw.title, "Üye Programı"),
      overview: Array.isArray(raw.overview) ? raw.overview.filter((item) => Array.isArray(item) && item.length >= 2) : [],
      coachNote: normalizeString(raw.coachNote),
      sessions: normalizeSessions(raw.sessions),
      progression: normalizeTextBlocks(raw.progression),
      guidance: normalizeTextBlocks(raw.guidance),
      coverage: normalizeCoverage(raw.coverage),
      aiReport: raw.aiReport && typeof raw.aiReport === "object" ? raw.aiReport : null,
      programIntelligence: raw.programIntelligence && typeof raw.programIntelligence === "object" ? raw.programIntelligence : null,
      v3Insights: raw.v3Insights && typeof raw.v3Insights === "object" ? raw.v3Insights : null,
      programContext: raw.programContext && typeof raw.programContext === "object" ? raw.programContext : null,
      rawData: normalizeFormData(raw.rawData),
    };
  }

  function normalizeMember(raw) {
    const member = raw && typeof raw === "object" ? raw : {};
    const sourceProfile = member.profile || member.formData || member.rawProfile || {};
    const profile = normalizeFormData({
      ...sourceProfile,
      memberName: member.memberName || member.member_name || member.name || sourceProfile.memberName,
      memberCode: member.memberCode || member.member_code || sourceProfile.memberCode,
      trainerName: member.trainerName || member.trainer_name || sourceProfile.trainerName,
      goal: member.goal || member.program || sourceProfile.goal,
    });
    const createdAt = normalizeIsoDate(member.createdAt) || new Date().toISOString();
    const measurements = Array.isArray(member.measurements)
      ? member.measurements.map((item) => normalizeMeasurement(item)).sort((a, b) => compareDates(b.date, a.date))
      : [];
    const programs = Array.isArray(member.programs)
      ? member.programs.map((item) => normalizeProgramRecord(item)).sort((a, b) => compareDates(b.savedAtIso || b.program?.createdAtIso, a.savedAtIso || a.program?.createdAtIso))
      : [];
    const nutritionPlan = normalizeNutritionPlan(member.nutritionPlan);
    const nutritionPlans = Array.isArray(member.nutritionPlans)
      ? member.nutritionPlans.map(normalizeNutritionPlan).filter(Boolean).sort((a, b) => compareDates(b.createdAtIso, a.createdAtIso))
      : [];

    return {
      id: String(member.id || makeId("member")),
      schemaVersion: TARGET_SCHEMA_VERSION,
      profile,
      measurements,
      programs,
      nutritionPlan: nutritionPlan || nutritionPlans[0] || null,
      nutritionPlans,
      createdAt,
      updatedAt: normalizeIsoDate(member.updatedAt) || createdAt,
    };
  }

  function normalizeNutritionPlan(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    return {
      ...raw,
      id: String(raw.id || makeId("nutrition")),
      createdAtIso: normalizeIsoDate(raw.createdAtIso) || new Date().toISOString(),
      createdAt: normalizeString(raw.createdAt),
      memberName: normalizeString(raw.memberName),
      goal: normalizeString(raw.goal),
      level: normalizeString(raw.level),
      trainingDays: toNumberOrFallback(raw.trainingDays, 0),
      sourceSummary: raw.sourceSummary && typeof raw.sourceSummary === "object" ? raw.sourceSummary : {},
      calories: toNumberOrFallback(raw.calories, 0),
      macros: {
        protein: toNumberOrFallback(raw.macros?.protein, 0),
        carbs: toNumberOrFallback(raw.macros?.carbs, 0),
        fat: toNumberOrFallback(raw.macros?.fat, 0),
      },
      intelligence: normalizeStringArray(raw.intelligence),
      meals: Array.isArray(raw.meals)
        ? raw.meals.map((meal, index) => ({
            name: normalizeString(meal?.name, `Öğün ${index + 1}`),
            foods: normalizeString(meal?.foods),
            calories: toNumberOrFallback(meal?.calories, 0),
            protein: toNumberOrFallback(meal?.protein, 0),
            carbs: toNumberOrFallback(meal?.carbs, 0),
            fat: toNumberOrFallback(meal?.fat, 0),
          }))
        : [],
      supplementPreferences: raw.supplementPreferences && typeof raw.supplementPreferences === "object" ? raw.supplementPreferences : {},
      supplements: Array.isArray(raw.supplements)
        ? raw.supplements.map((item) => ({
            name: normalizeString(item?.name),
            purpose: normalizeString(item?.purpose),
            timing: normalizeString(item?.timing),
            note: normalizeString(item?.note),
            foodAlternative: normalizeString(item?.foodAlternative),
          }))
        : [],
      trainerNote: normalizeString(raw.trainerNote),
      disclaimer: normalizeString(raw.disclaimer),
    };
  }

  function normalizeMembers(rawMembers) {
    if (!Array.isArray(rawMembers)) {
      return [];
    }

    return rawMembers
      .filter((member) => member && typeof member === "object")
      .map(normalizeMember)
      .sort((a, b) => compareDates(b.updatedAt || b.createdAt, a.updatedAt || a.createdAt));
  }

  function normalizeBackupHistory(rawHistory) {
    if (!Array.isArray(rawHistory)) {
      return [];
    }

    return rawHistory
      .filter((snapshot) => snapshot && typeof snapshot === "object")
      .map((snapshot) => ({
        id: String(snapshot.id || makeId("backup")),
        savedAt: normalizeIsoDate(snapshot.savedAt) || new Date().toISOString(),
        memberCount: toNumberOrFallback(snapshot.memberCount, Array.isArray(snapshot.members) ? snapshot.members.length : 0),
        activeMemberId: snapshot.activeMemberId ? String(snapshot.activeMemberId) : null,
        fingerprint: normalizeString(snapshot.fingerprint),
        members: normalizeMembers(snapshot.members),
      }))
      .sort((a, b) => compareDates(b.savedAt, a.savedAt));
  }

  function normalizeSessions(rawSessions) {
    if (!Array.isArray(rawSessions)) {
      return [];
    }

    return rawSessions
      .filter((session) => session && typeof session === "object")
      .map((session) => ({
        ...session,
        dayLabel: normalizeString(session.dayLabel),
        title: normalizeString(session.title),
        intensity: normalizeString(session.intensity),
        duration: normalizeString(session.duration),
        structure: normalizeString(session.structure),
        purpose: normalizeString(session.purpose),
        balanceNote: normalizeString(session.balanceNote),
        targetGroups: normalizeStringArray(session.targetGroups),
        warmup: normalizeStringArray(session.warmup),
        cooldown: normalizeStringArray(session.cooldown),
        cardioBlock: normalizeString(session.cardioBlock),
        note: normalizeString(session.note),
        exercises: normalizeExercises(session.exercises),
        exerciseBlocks: normalizeExerciseBlocks(session.exerciseBlocks),
      }));
  }

  function normalizeExercises(rawExercises) {
    if (!Array.isArray(rawExercises)) {
      return [];
    }

    return rawExercises
      .filter((exercise) => exercise && typeof exercise === "object")
      .map((exercise) => ({
        ...exercise,
        id: String(exercise.id || exercise.name || makeId("exercise")),
        name: normalizeString(exercise.name),
        group: normalizeString(exercise.group),
        equipment: normalizeString(exercise.equipment),
        gifUrl: normalizeString(exercise.gifUrl),
        kind: normalizeString(exercise.kind),
        level: normalizeString(exercise.level),
        tags: normalizeStringArray(exercise.tags),
        cue: normalizeString(exercise.cue),
        sets: normalizeString(exercise.sets),
        reps: normalizeString(exercise.reps),
        prescription: normalizeString(exercise.prescription),
        rest: normalizeString(exercise.rest),
        tempo: normalizeString(exercise.tempo),
        alternatives: Array.isArray(exercise.alternatives)
          ? exercise.alternatives
              .filter((item) => item && typeof item === "object")
              .map((item) => ({
                id: String(item.id || item.name || makeId("alt")),
                name: normalizeString(item.name),
                reason: normalizeString(item.reason),
              }))
          : [],
      }));
  }

  function normalizeExerciseBlocks(rawBlocks) {
    if (!Array.isArray(rawBlocks)) {
      return [];
    }

    return rawBlocks
      .filter((block) => block && typeof block === "object")
      .map((block) => ({
        ...block,
        id: String(block.id || makeId("block")),
        type: normalizeString(block.type),
        label: normalizeString(block.label),
        instruction: normalizeString(block.instruction),
        rest: normalizeString(block.rest),
        exerciseIndexes: Array.isArray(block.exerciseIndexes) ? block.exerciseIndexes.map((value) => Number(value)).filter(Number.isFinite) : [],
      }));
  }

  function normalizeTextBlocks(rawItems) {
    if (!Array.isArray(rawItems)) {
      return [];
    }

    return rawItems
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        title: normalizeString(item.title),
        text: normalizeString(item.text),
      }));
  }

  function normalizeCoverage(rawCoverage) {
    if (!Array.isArray(rawCoverage)) {
      return [];
    }

    return rawCoverage
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        group: normalizeString(item.group),
        sessionCount: toNumberOrFallback(item.sessionCount, 0),
        exerciseCount: toNumberOrFallback(item.exerciseCount, 0),
      }));
  }

  function normalizeNumericObject(rawObject, keys) {
    const source = rawObject && typeof rawObject === "object" ? rawObject : {};
    return Object.fromEntries(keys.map((key) => [key, toNumberOrEmpty(source[key])]));
  }

  function normalizeStringArray(value) {
    return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
  }

  function normalizeString(value, fallback = "") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function toNumberOrFallback(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toNumberOrEmpty(value) {
    if (value === "" || value === null || value === undefined) {
      return "";
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : "";
  }

  function normalizeDateString(value) {
    if (!value) {
      return "";
    }

    const calendarDate = parseCalendarDate(value);
    if (calendarDate) {
      return formatDateOnly(calendarDate);
    }

    return String(value).trim();
  }

  function normalizeIsoDate(value) {
    if (!value) {
      return "";
    }

    const direct = new Date(value);
    return Number.isNaN(direct.getTime()) ? "" : direct.toISOString();
  }

  function normalizeBirthDateValue(rawBirthDate, day, month, year) {
    if (rawBirthDate) {
      const directDate = parseCalendarDate(rawBirthDate);
      if (directDate) {
        return formatDateOnly(directDate);
      }
    }

    if (day !== "" && month !== "" && year !== "") {
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      if (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === Number(year) &&
        date.getMonth() === Number(month) - 1 &&
        date.getDate() === Number(day)
      ) {
        return formatDateOnly(date);
      }
    }

    return "";
  }

  function calculateAgeFromBirthDate(birthDateValue, referenceDateValue) {
    const birthDate = parseCalendarDate(birthDateValue);
    const referenceDate = parseCalendarDate(referenceDateValue);

    if (!birthDate || !referenceDate) {
      return "";
    }

    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const birthdayPassed =
      referenceDate.getMonth() > birthDate.getMonth() ||
      (referenceDate.getMonth() === birthDate.getMonth() && referenceDate.getDate() >= birthDate.getDate());

    if (!birthdayPassed) {
      age -= 1;
    }

    return age >= 0 && age <= 120 ? age : "";
  }

  function compareDates(a, b) {
    return (parseDate(a)?.getTime() || 0) - (parseDate(b)?.getTime() || 0);
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    return parseCalendarDate(value);
  }

  function formatDisplayDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
  }

  function todayInputValue() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function parseCalendarDate(value) {
    if (!value) {
      return null;
    }

    const text = String(value).trim();
    const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      const date = new Date(year, month - 1, day);
      return isSameCalendarDate(date, year, month, day) ? date : null;
    }

    const directDate = new Date(text);
    return Number.isNaN(directDate.getTime()) ? null : directDate;
  }

  function formatDateOnly(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function isSameCalendarDate(date, year, month, day) {
    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.BSMDataMigrations = {
    TARGET_SCHEMA_VERSION,
    normalizeFormData,
    normalizeMeasurement,
    normalizePlan,
    normalizeProgramRecord,
    normalizeMember,
    normalizeMembers,
    normalizeBackupHistory,
  };
})();
