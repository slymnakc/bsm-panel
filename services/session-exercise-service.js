(function () {
  "use strict";

  function getExerciseSlotCount(data) {
    if (data.duration <= 30) {
      return 5;
    }

    if (data.duration <= 45) {
      return 6;
    }

    if (data.duration <= 60) {
      return 7;
    }

    return 8;
  }

  function isEquipmentAllowed(exercise, equipmentScope, deps) {
    const { allowedEquipmentByScope } = deps;
    return (allowedEquipmentByScope[equipmentScope] || allowedEquipmentByScope["full-gym"]).includes(exercise.equipment);
  }

  function isExerciseAllowed(exercise, restrictions) {
    if (restrictions.includes("knee") && exercise.tags.includes("knee-caution")) {
      return false;
    }

    if (restrictions.includes("back") && exercise.tags.includes("back-caution")) {
      return false;
    }

    if (restrictions.includes("shoulder") && exercise.tags.includes("shoulder-caution")) {
      return false;
    }

    if (restrictions.includes("low-impact") && exercise.tags.includes("high-impact")) {
      return false;
    }

    return true;
  }

  function buildPrescription(exercise, data, index) {
    if (exercise.kind === "cardio") {
      if (data.cardioPreference === "high" || data.goal === "conditioning") {
        return "12-18 dk interval: 45 sn aktif / 45 sn rahat";
      }

      return "8-12 dk orta tempo, konuşabilecek yoğunluk";
    }

    if (exercise.kind === "conditioning") {
      return data.cardioPreference === "high" ? "5 tur x 40 sn çalışma / 20 sn dinlenme" : "4 tur x 30 sn çalışma / 30 sn dinlenme";
    }

    if (exercise.kind === "mobility") {
      return "2-3 tur x 30-45 sn kontrollü uygulama";
    }

    if (exercise.kind === "core") {
      return data.level === "advanced" ? "3-4 set x 12-18 tekrar veya 45 sn" : "3 set x 10-14 tekrar veya 30-40 sn";
    }

    if (data.goal === "strength" && exercise.kind === "compound") {
      return index < 2 ? "4-5 set x 3-6 tekrar" : "3-4 set x 6-8 tekrar";
    }

    if (data.goal === "muscle-gain") {
      return exercise.kind === "compound" ? "4 set x 6-10 tekrar" : "3-4 set x 10-15 tekrar";
    }

    if (data.goal === "fat-loss" || data.goal === "conditioning") {
      return "3 set x 12-15 tekrar";
    }

    return exercise.kind === "compound" ? "3-4 set x 8-12 tekrar" : "3 set x 12-15 tekrar";
  }

  function buildRest(exercise, data) {
    if (["cardio", "conditioning", "mobility"].includes(exercise.kind)) {
      return "30-60 sn";
    }

    if (data.goal === "strength" && exercise.kind === "compound") {
      return "120-180 sn";
    }

    if (exercise.kind === "compound") {
      return "75-120 sn";
    }

    return "45-75 sn";
  }

  function buildTempo(exercise, data) {
    if (["cardio", "conditioning"].includes(exercise.kind)) {
      return "Ritmik";
    }

    if (exercise.kind === "mobility") {
      return "Yavaş ve kontrollü";
    }

    if (data.goal === "strength") {
      return "2-1-1";
    }

    if (data.goal === "muscle-gain") {
      return "3-1-1";
    }

    return "2-0-2";
  }

  function selectExerciseForGroup(group, data, usedExerciseIds, sessionIndex, pickCount, deps) {
    const {
      planContext,
      exerciseLibrary,
      rotateArray,
      pickExercise,
      allowedEquipmentByScope,
    } = deps;
    const byGroup = exerciseLibrary.filter((exercise) => exercise.group === group);
    const byEquipment = byGroup.filter((exercise) => isEquipmentAllowed(exercise, data.equipmentScope, { allowedEquipmentByScope }));
    const byRestriction = byEquipment.filter((exercise) => isExerciseAllowed(exercise, data.restrictions));
    const sourcePool = byRestriction.length ? byRestriction : byEquipment.length ? byEquipment : byGroup;
    const unusedPool = sourcePool.filter((exercise) => !usedExerciseIds.has(exercise.id));
    const pool = rotateArray(unusedPool.length ? unusedPool : sourcePool, sessionIndex + pickCount);
    const v2Exercise = pickExercise(pool, data, {
      group,
      sessionIndex,
      pickCount,
      context: planContext,
    });

    if (v2Exercise) {
      return v2Exercise;
    }

    if (data.level === "beginner") {
      const beginnerSafe = pool.find((exercise) => exercise.level === "beginner" || exercise.tags.includes("beginner-safe"));
      if (beginnerSafe) {
        return beginnerSafe;
      }
    }

    if (data.equipmentScope === "machines-only") {
      const machineExercise = pool.find((exercise) => ["machine", "cable", "cardio"].includes(exercise.equipment));
      if (machineExercise) {
        return machineExercise;
      }
    }

    if (pickCount === 0) {
      const compound = pool.find((exercise) => ["compound", "cardio"].includes(exercise.kind));
      if (compound) {
        return compound;
      }
    }

    return pool[0] || null;
  }

  function selectExercisesForSession(data, sessionBlueprint, sessionIndex, deps) {
    const {
      planContext,
      selectExerciseForGroup,
      buildPrescription,
      buildRest,
      buildTempo,
    } = deps;
    const strengthSlots = getExerciseSlotCount(data);
    const groups = [...sessionBlueprint.groups];
    const usedExerciseIds = new Set();
    const groupPickCounts = {};
    const selected = [];
    let safety = 0;

    while (selected.length < strengthSlots && safety < strengthSlots * 4) {
      const group = groups[safety % groups.length];
      const pickCount = groupPickCounts[group] || 0;
      const exercise = selectExerciseForGroup(group, data, usedExerciseIds, sessionIndex, pickCount, planContext);

      if (exercise) {
        usedExerciseIds.add(exercise.id);
        groupPickCounts[group] = pickCount + 1;
        selected.push({
          ...exercise,
          prescription: buildPrescription(exercise, data, selected.length),
          rest: buildRest(exercise, data),
          tempo: buildTempo(exercise, data),
        });
      }

      safety += 1;
    }

    if (data.cardioPreference === "high" && !groups.includes("cardio") && data.duration >= 45) {
      const cardio = selectExerciseForGroup("cardio", data, usedExerciseIds, sessionIndex, 0, planContext);
      if (cardio) {
        selected.push({
          ...cardio,
          prescription: buildPrescription(cardio, data, selected.length),
          rest: buildRest(cardio, data),
          tempo: "Ritmik",
        });
      }
    }

    return selected;
  }

  window.BSMSessionExerciseService = {
    getExerciseSlotCount,
    isEquipmentAllowed,
    isExerciseAllowed,
    buildPrescription,
    buildRest,
    buildTempo,
    selectExerciseForGroup,
    selectExercisesForSession,
  };
})();
