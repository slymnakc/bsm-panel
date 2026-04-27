(function () {
  "use strict";

  function resolveEffectiveStyle(data, deps) {
    const { resolveProgramStyleTemplate } = deps;

    if (data.programStyle !== "auto") {
      return resolveProgramStyleTemplate(data.programStyle, data.days.length);
    }

    if (data.priorityMuscle === "crossfit") {
      return "crossfit-conditioning";
    }

    if (data.priorityMuscle === "pilates") {
      return "pilates-flow";
    }

    if (data.days.length <= 2) {
      return "full-body";
    }

    if (data.days.length === 3) {
      return data.level === "beginner" ? "full-body" : "push-pull-legs";
    }

    if (data.days.length === 4) {
      return data.goal === "fat-loss" || data.goal === "conditioning" ? "machine-circuit" : "upper-lower";
    }

    if (data.days.length === 5) {
      return data.goal === "muscle-gain" ? "hypertrophy" : "upper-lower";
    }

    return data.goal === "strength" ? "push-pull-legs" : "hypertrophy";
  }

  function applyPriorityMuscle(groups, priorityMuscleId, sessionIndex) {
    if (!priorityMuscleId || priorityMuscleId === "balanced" || groups.includes(priorityMuscleId)) {
      return [...groups];
    }

    if (sessionIndex > 0 && sessionIndex % 2 !== 0) {
      return [...groups];
    }

    const protectedGroups = ["core", "cardio", "mobility"];
    const replaceableIndex = groups.findIndex((group) => !protectedGroups.includes(group));
    const nextGroups = [...groups];

    if (replaceableIndex >= 0) {
      nextGroups[replaceableIndex] = priorityMuscleId;
    } else {
      nextGroups.unshift(priorityMuscleId);
    }

    return [...new Set(nextGroups)];
  }

  function buildIntensityLabel(data, template, index) {
    if (template.groups.includes("mobility")) {
      return "Teknik ve mobilite odaklı";
    }

    if (template.groups.includes("cardio") || data.goal === "conditioning") {
      return data.cardioPreference === "high" ? "Nabız odaklı" : "Kondisyon destekli";
    }

    const byLevel = {
      beginner: ["Teknik öğrenme", "Kontrollü yük", "Temel adaptasyon"],
      intermediate: ["Orta yoğunluk", "Hipertrofi hacmi", "Performans dengesi"],
      advanced: ["Yüksek hacim", "Ağır çalışma", "İleri yoğunluk"],
    };

    return (byLevel[data.level] || byLevel.beginner)[index % 3];
  }

  function resolveSplit(data, deps) {
    const { splitTemplates, resolveEffectiveStyle } = deps;
    const effectiveStyle = resolveEffectiveStyle(data);
    const templates = splitTemplates[effectiveStyle] || splitTemplates["full-body"];

    return data.days.map((day, index) => {
      const template = templates[index % templates.length];
      const groups = applyPriorityMuscle(template.groups, data.priorityMuscle, index);

      return {
        ...template,
        day,
        groups,
        title: template.title,
        intensity: buildIntensityLabel(data, template, index),
      };
    });
  }

  function buildTrainingBlockInstruction(system, blockExercises) {
    const exerciseNames = blockExercises.map((exercise) => exercise.name).join(" + ");
    return `${system.instruction} Blok: ${exerciseNames}.`;
  }

  function buildTrainingBlockRest(system, data) {
    if (system.value === "giant-set" || system.value === "circuit") {
      return data.level === "advanced" ? "90-120 sn tur arası" : "120 sn tur arası";
    }

    if (system.value === "tri-set") {
      return "75-105 sn tur arası";
    }

    if (system.value === "superset" || system.value === "compound-set") {
      return "60-90 sn blok sonrası";
    }

    if (system.value === "drop-set") {
      return "Normal dinlenme; son sette %20-30 yük azalt";
    }

    if (system.value === "rest-pause") {
      return "Normal dinlenme; son sette 15-20 sn mini ara";
    }

    return "Hareket arası normal dinlenme";
  }

  function orderIndexesByGroupForCompoundSet(exercises) {
    const grouped = new Map();
    exercises.forEach((exercise, index) => {
      const indexes = grouped.get(exercise.group) || [];
      indexes.push(index);
      grouped.set(exercise.group, indexes);
    });

    const paired = [];
    const singles = [];

    grouped.forEach((indexes) => {
      for (let index = 0; index < indexes.length; index += 2) {
        const pair = indexes.slice(index, index + 2);
        if (pair.length === 2) {
          paired.push(...pair);
        } else {
          singles.push(...pair);
        }
      }
    });

    return [...paired, ...singles];
  }

  function buildExerciseBlocks(exercises, data, deps) {
    const { trainingSystemMap, normalizeTrainingSystem } = deps;
    const system = trainingSystemMap[normalizeTrainingSystem(data.trainingSystem)] || trainingSystemMap.standard;

    if (system.value === "standard") {
      return [];
    }

    if (["drop-set", "rest-pause"].includes(system.value)) {
      return exercises.map((exercise, index) => ({
        id: `${system.value}-${index}`,
        type: system.value,
        label: `${system.label} ${index + 1}`,
        instruction: buildTrainingBlockInstruction(system, [exercise]),
        rest: buildTrainingBlockRest(system, data),
        exerciseIndexes: [index],
      }));
    }

    const orderedIndexes = system.sameGroupPreferred ? orderIndexesByGroupForCompoundSet(exercises) : exercises.map((_, index) => index);
    const blocks = [];
    let cursor = 0;

    while (cursor < orderedIndexes.length) {
      const exerciseIndexes = orderedIndexes.slice(cursor, cursor + system.blockSize);
      const blockExercises = exerciseIndexes.map((index) => exercises[index]);

      blocks.push({
        id: `${system.value}-${blocks.length}`,
        type: system.value,
        label: `${system.label} ${blocks.length + 1}`,
        instruction: buildTrainingBlockInstruction(system, blockExercises),
        rest: buildTrainingBlockRest(system, data),
        exerciseIndexes,
      });
      cursor += system.blockSize;
    }

    return blocks;
  }

  function recommendStructure(data, groups, exerciseCount, deps) {
    const { getTrainingSystemLabel } = deps;
    const systemLabel = getTrainingSystemLabel(data.trainingSystem).toLowerCase();
    const blocks = ["ısınma 8-10 dk", `${systemLabel} ile ana blok ${exerciseCount} hareket`];

    if (data.cardioPreference !== "low" || groups.includes("cardio") || data.goal === "fat-loss") {
      blocks.push("kardiyo/finisher 6-15 dk");
    }

    blocks.push("soğuma 4-6 dk");
    return blocks.join(" • ");
  }

  function buildSessionNote(data, groups) {
    if (data.restrictions.length > 0) {
      return "Üye uyarılarına göre hareket seçimi güvenli alternatiflere kaydırıldı. Ağrı oluşursa hareket durdurulmalı ve antrenör değerlendirmesi yapılmalıdır.";
    }

    if (groups.includes("cardio")) {
      return "Kondisyon bloğunda hedef, form bozulmadan ritmi korumaktır. Nabız çok yükselirse süre değil tempo düşürülmelidir.";
    }

    return "Son 1-2 tekrar zorlayıcı ama teknik temiz kalıyorsa üye doğru çalışma aralığındadır.";
  }

  window.BSMProgramStructureService = {
    resolveEffectiveStyle,
    resolveSplit,
    buildExerciseBlocks,
    recommendStructure,
    buildSessionNote,
  };
})();
