(function () {
  "use strict";

  const CONFIG = {
    engineVersion: "2.0.0",
    alternativeLimit: 3,
    riskPenalty: 120,
    beginnerSafeBonus: 24,
    compoundFirstBonus: 22,
  };

  const cautiousTagsByRestriction = {
    knee: ["knee-caution", "high-impact"],
    back: ["back-caution"],
    shoulder: ["shoulder-caution"],
    "low-impact": ["high-impact"],
  };

  const friendlyTagsByRestriction = {
    knee: ["knee-friendly", "low-impact"],
    back: ["back-friendly", "low-impact"],
    shoulder: ["shoulder-friendly"],
    "low-impact": ["low-impact"],
  };

  const allowedEquipmentByScope = {
    "full-gym": null,
    "standard-gym": ["barbell", "dumbbell", "machine", "cable", "smith", "bodyweight", "cardio", "mat", "band", "kettlebell", "medicineball", "box", "rower", "rig", "pilatesball"],
    "machines-only": ["machine", "cable", "cardio", "mat", "bodyweight"],
    "free-weights": ["barbell", "dumbbell", "kettlebell", "bodyweight", "mat", "band", "medicineball", "box", "rig"],
  };

  function createPlanContext(data = {}) {
    const now = new Date();
    const variationBase = [
      data.memberName || "",
      data.memberCode || "",
      data.goal || "",
      data.level || "",
      data.programStyle || "",
      (data.days || []).join("-"),
      now.toISOString(),
      Math.random().toString(16).slice(2),
    ].join("|");

    return {
      engineVersion: CONFIG.engineVersion,
      variationSeed: hashString(variationBase),
      generatedAtIso: now.toISOString(),
      intensityBias: getIntensityBias(data),
      balanceTargets: getBalanceTargets(data),
    };
  }

  function pickExercise(pool = [], data = {}, meta = {}) {
    if (!pool.length) {
      return null;
    }

    const context = meta.context || createPlanContext(data);

    return [...pool]
      .map((exercise) => ({
        exercise,
        score: scoreExercise(exercise, data, { ...meta, context }),
      }))
      .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "tr"))
      .map((item) => item.exercise)[0];
  }

  function scoreExercise(exercise = {}, data = {}, meta = {}) {
    const tags = exercise.tags || [];
    const restrictions = data.restrictions || [];
    const pickCount = meta.pickCount || 0;
    let score = 50;

    if (data.level === "beginner") {
      if (exercise.level === "beginner") score += 18;
      if (tags.includes("beginner-safe")) score += CONFIG.beginnerSafeBonus;
      if (["machine", "cable", "cardio", "mat"].includes(exercise.equipment)) score += 12;
      if (exercise.level === "advanced") score -= 28;
    } else if (data.level === "advanced") {
      if (exercise.level === "advanced") score += 12;
      if (exercise.kind === "compound") score += 10;
      if (["barbell", "dumbbell", "kettlebell", "rig"].includes(exercise.equipment)) score += 6;
    } else {
      if (exercise.level === "intermediate") score += 10;
      if (exercise.level === "beginner") score += 5;
    }

    if (pickCount === 0 && ["compound", "cardio", "conditioning"].includes(exercise.kind)) {
      score += CONFIG.compoundFirstBonus;
    }

    if (pickCount > 0 && ["accessory", "core", "mobility"].includes(exercise.kind)) {
      score += 8;
    }

    if (data.goal === "fat-loss") {
      if (["compound", "conditioning", "cardio"].includes(exercise.kind)) score += 12;
      if (exercise.tags?.includes("low-impact")) score += 4;
    } else if (data.goal === "muscle-gain") {
      if (pickCount <= 1 && exercise.kind === "compound") score += 12;
      if (pickCount >= 1 && exercise.kind === "accessory") score += 10;
    } else if (data.goal === "strength") {
      if (exercise.kind === "compound") score += 18;
      if (exercise.level === "advanced" && data.level !== "beginner") score += 6;
    } else if (data.goal === "conditioning") {
      if (["conditioning", "cardio", "compound"].includes(exercise.kind)) score += 14;
    } else if (data.goal === "maintenance") {
      if (["machine", "cable", "bodyweight", "mat"].includes(exercise.equipment)) score += 6;
      if (["compound", "accessory", "mobility"].includes(exercise.kind)) score += 4;
    }

    if (data.priorityMuscle && data.priorityMuscle !== "balanced" && exercise.group === data.priorityMuscle) {
      score += 16;
    }

    if (data.equipmentScope === "machines-only" && ["machine", "cable", "cardio"].includes(exercise.equipment)) {
      score += 18;
    }

    restrictions.forEach((restriction) => {
      const riskyTags = cautiousTagsByRestriction[restriction] || [];
      const friendlyTags = friendlyTagsByRestriction[restriction] || [];

      if (riskyTags.some((tag) => tags.includes(tag))) {
        score -= CONFIG.riskPenalty;
      }

      if (friendlyTags.some((tag) => tags.includes(tag))) {
        score += 18;
      }
    });

    if (meta.preferredKind && exercise.kind === meta.preferredKind) {
      score += 10;
    }

    return score + variationScore(exercise, data, meta);
  }

  function enhanceSession(session = {}, data = {}, library = [], context = createPlanContext(data)) {
    const targetGroups = session.targetGroups || [];
    const enhancedExercises = (session.exercises || []).map((exercise, exerciseIndex) => ({
      ...exercise,
      alternatives: buildAlternatives(exercise, library, data, {
        context,
        sessionIndex: session.sessionIndex || 0,
        exerciseIndex,
      }),
    }));
    const purpose = buildDayPurpose(session, data);
    const balanceNote = buildBalanceNote(session, data, enhancedExercises);

    return {
      ...session,
      purpose,
      balanceNote,
      targetGroups,
      exercises: enhancedExercises,
    };
  }

  function buildAlternatives(currentExercise = {}, library = [], data = {}, meta = {}) {
    const allowedPool = library
      .filter((exercise) => exercise.group === currentExercise.group && exercise.id !== currentExercise.id)
      .filter((exercise) => isEquipmentAllowed(exercise, data.equipmentScope))
      .map((exercise) => ({
        exercise,
        score: scoreExercise(exercise, data, {
          ...meta,
          pickCount: meta.exerciseIndex || 1,
          preferredKind: currentExercise.kind,
        }),
      }))
      .filter((item) => item.score > -20)
      .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "tr"))
      .slice(0, CONFIG.alternativeLimit);

    return allowedPool.map(({ exercise }) => ({
      id: exercise.id,
      name: exercise.name,
      reason: buildAlternativeReason(exercise, data),
    }));
  }

  function buildProgramIntelligence(data = {}, sessions = [], analysis = null) {
    const compoundCount = countExercisesByKind(sessions, "compound");
    const accessoryCount = countExercisesByKind(sessions, "accessory");
    const cardioCount = countExercisesByKind(sessions, "cardio") + countExercisesByKind(sessions, "conditioning");
    const mobilityCount = countExercisesByKind(sessions, "mobility") + countExercisesByKind(sessions, "core");
    const warnings = [];

    if (data.goal === "fat-loss" && cardioCount < Math.max(1, Math.floor((data.days || []).length / 2))) {
      warnings.push("Yağ kaybı hedefi için kardiyo/conditioning bloğu düşük kalabilir.");
    }

    if (data.goal === "muscle-gain" && compoundCount < (data.days || []).length) {
      warnings.push("Kas kazanımı için her seansta en az bir ana hareket hedeflenmeli.");
    }

    if ((data.restrictions || []).length) {
      warnings.push("Hassasiyet bildirimi olduğu için alternatif hareket listesi kontrol edilmelidir.");
    }

    return {
      engineVersion: CONFIG.engineVersion,
      summary: `Program dağılımı ${compoundCount} ana hareket, ${accessoryCount} destek hareketi, ${cardioCount} kardiyo/kondisyon ve ${mobilityCount} core/mobilite öğesi içeriyor.`,
      balance: {
        compound: compoundCount,
        accessory: accessoryCount,
        cardio: cardioCount,
        mobility: mobilityCount,
      },
      warnings,
      coachNote: analysis?.nextAction || "Program 10-14 gün ölçüm ve performans notuyla tekrar kontrol edilmeli.",
      nextControlSuggestion: buildNextControlSuggestion(data, analysis),
    };
  }

  function buildDayPurpose(session = {}, data = {}) {
    const groups = session.targetGroups || [];

    if (groups.includes("crossfit")) {
      return data.level === "beginner" ? "CrossFit teknik adaptasyon + düşük riskli kondisyon" : "Metabolik kondisyon + fonksiyonel güç";
    }

    if (groups.includes("pilates")) {
      return "Pilates core kontrol + postür ve mobilite";
    }

    if (groups.includes("cardio")) {
      return "Kardiyovasküler dayanıklılık + yağ yakımı desteği";
    }

    if (groups.some((group) => ["quadriceps", "hamstrings", "glutes", "calves"].includes(group))) {
      if (groups.includes("glutes")) {
        return "Alt vücut kuvvet + kalça aktivasyonu";
      }
      return "Alt vücut kuvvet + diz/kalça kontrolü";
    }

    if (groups.includes("chest") || groups.includes("shoulders") || groups.includes("triceps")) {
      return "Üst vücut itiş gücü + omuz stabilitesi";
    }

    if (groups.includes("back") || groups.includes("biceps")) {
      return "Üst vücut çekiş gücü + postür desteği";
    }

    if (groups.includes("core") || groups.includes("mobility")) {
      return "Core stabilite + hareket kalitesi";
    }

    return "Dengeli kuvvet + teknik kalite";
  }

  function buildBalanceNote(session = {}, data = {}, exercises = []) {
    const kindCounts = exercises.reduce((counts, exercise) => {
      counts[exercise.kind] = (counts[exercise.kind] || 0) + 1;
      return counts;
    }, {});
    const parts = [];

    if (kindCounts.compound) {
      parts.push(`${kindCounts.compound} ana hareket`);
    }

    if (kindCounts.accessory) {
      parts.push(`${kindCounts.accessory} destek/izolasyon`);
    }

    if (kindCounts.cardio || kindCounts.conditioning) {
      parts.push(`${(kindCounts.cardio || 0) + (kindCounts.conditioning || 0)} kondisyon`);
    }

    if (kindCounts.core || kindCounts.mobility) {
      parts.push(`${(kindCounts.core || 0) + (kindCounts.mobility || 0)} core/mobilite`);
    }

    if (!parts.length) {
      return "Seans dengesi hareket seçimiyle tamamlanacak.";
    }

    if ((data.restrictions || []).length) {
      return `${parts.join(", ")} dengesi kuruldu; hassasiyetli hareketlerde alternatifler kontrol edilmeli.`;
    }

    return `${parts.join(", ")} dengesi kuruldu.`;
  }

  function buildAlternativeReason(exercise, data) {
    if ((data.restrictions || []).some((restriction) => (friendlyTagsByRestriction[restriction] || []).some((tag) => exercise.tags?.includes(tag)))) {
      return "hassasiyete daha güvenli alternatif";
    }

    if (data.level === "beginner" && (exercise.tags || []).includes("beginner-safe")) {
      return "başlangıç seviyesi için güvenli varyasyon";
    }

    if (exercise.kind === "compound") {
      return "ana hareket alternatifi";
    }

    if (exercise.kind === "mobility" || exercise.kind === "core") {
      return "teknik ve kontrol desteği";
    }

    return "aynı kas grubu için uygulanabilir alternatif";
  }

  function isEquipmentAllowed(exercise, equipmentScope = "full-gym") {
    const allowed = allowedEquipmentByScope[equipmentScope];
    return !allowed || allowed.includes(exercise.equipment);
  }

  function countExercisesByKind(sessions, kind) {
    return sessions.reduce((total, session) => total + (session.exercises || []).filter((exercise) => exercise.kind === kind).length, 0);
  }

  function getIntensityBias(data) {
    if (data.level === "advanced") {
      return data.goal === "strength" ? "heavy-compound" : "high-volume";
    }

    if (data.level === "beginner") {
      return "safe-technique";
    }

    return "balanced-progression";
  }

  function getBalanceTargets(data) {
    if (data.goal === "fat-loss" || data.goal === "conditioning") {
      return { compound: 0.35, accessory: 0.3, cardio: 0.25, mobility: 0.1 };
    }

    if (data.goal === "muscle-gain") {
      return { compound: 0.42, accessory: 0.44, cardio: 0.06, mobility: 0.08 };
    }

    if (data.goal === "strength") {
      return { compound: 0.55, accessory: 0.28, cardio: 0.05, mobility: 0.12 };
    }

    return { compound: 0.36, accessory: 0.34, cardio: 0.12, mobility: 0.18 };
  }

  function buildNextControlSuggestion(data, analysis) {
    if (analysis?.riskLevel === "Yüksek" || (data.restrictions || []).length) {
      return "7-10 gün içinde teknik ve ölçüm kontrolü önerilir.";
    }

    if (data.goal === "fat-loss" || data.goal === "muscle-gain") {
      return "10-14 gün içinde ölçüm ve performans kontrolü önerilir.";
    }

    return "14-21 gün içinde program kontrolü önerilir.";
  }

  function variationScore(exercise, data, meta) {
    const context = meta.context || {};
    const seed = [context.variationSeed || 0, exercise.id || exercise.name, meta.group || "", meta.sessionIndex || 0, meta.pickCount || 0].join("|");
    return hashString(seed) % 17;
  }

  function hashString(value) {
    return String(value)
      .split("")
      .reduce((hash, char) => {
        const nextHash = (hash << 5) - hash + char.charCodeAt(0);
        return nextHash | 0;
      }, 0) >>> 0;
  }

  window.BSMProgramEngineV2 = {
    CONFIG,
    createPlanContext,
    pickExercise,
    scoreExercise,
    enhanceSession,
    buildAlternatives,
    buildProgramIntelligence,
  };
})();
