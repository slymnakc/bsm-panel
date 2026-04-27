(function () {
  "use strict";

  function buildProgramTitle(data, deps) {
    const { labelMaps } = deps;
    const memberLabel = data.memberName || "Üye";
    return `${memberLabel} | ${labelMaps.goal[data.goal]} Antrenman Programı`;
  }

  function buildProgramOverview(data, deps) {
    const {
      labelMaps,
      splitNameMap,
      resolveEffectiveStyle,
      getProgramStyleLabel,
      getTrainingSystemLabel,
      getMuscleLabel,
    } = deps;

    return [
      ["Fitness merkezi", data.gymName || "Belirtilmedi"],
      ["Üye", data.memberName || "Belirtilmedi"],
      ["Üye no", data.memberCode || "Belirtilmedi"],
      ["Antrenör", data.trainerName || "Belirtilmedi"],
      ["Hedef", labelMaps.goal[data.goal]],
      ["Seviye", labelMaps.level[data.level]],
      [
        "Program tipi",
        data.programStyle === "auto"
          ? splitNameMap[resolveEffectiveStyle(data)] || getProgramStyleLabel("auto")
          : getProgramStyleLabel(data.programStyle),
      ],
      ["Antrenman sistemi", getTrainingSystemLabel(data.trainingSystem)],
      ["Ekipman", labelMaps.equipmentScope[data.equipmentScope]],
      ["Haftalık sıklık", `${data.days.length} gün`],
      ["Seans süresi", `${data.duration} dakika`],
      ["Öncelikli kas grubu", data.priorityMuscle === "balanced" ? "Dengeli" : getMuscleLabel(data.priorityMuscle)],
    ];
  }

  function buildMuscleCoverage(sessions, deps) {
    const { getMuscleLabel } = deps;
    const coverage = new Map();

    sessions.forEach((session) => {
      (session.exercises || []).forEach((exercise) => {
        const current = coverage.get(exercise.group) || { group: exercise.group, sessionCount: 0, exerciseCount: 0 };
        current.exerciseCount += 1;
        coverage.set(exercise.group, current);
      });

      (session.targetGroups || []).forEach((group) => {
        const current = coverage.get(group) || { group, sessionCount: 0, exerciseCount: 0 };
        current.sessionCount += 1;
        coverage.set(group, current);
      });
    });

    return [...coverage.values()].sort((a, b) => getMuscleLabel(a.group).localeCompare(getMuscleLabel(b.group), "tr"));
  }

  function buildFallbackProgramIntelligence(data, sessions, analysis) {
    const exerciseCount = sessions.reduce((sum, session) => sum + (session.exercises?.length || 0), 0);

    return {
      summary: `${data.days.length} günlük program ${exerciseCount} ana hareket satırıyla oluşturuldu.`,
      balance: {},
      warnings: analysis?.warnings?.map((warning) => warning.message) || [],
      coachNote: analysis?.nextAction || "Program 10-14 gün içinde ölçüm ve performans notuyla tekrar kontrol edilmeli.",
      nextControlSuggestion: "10-14 gün içinde kontrol önerilir.",
    };
  }

  window.BSMProgramSummaryService = {
    buildProgramTitle,
    buildProgramOverview,
    buildMuscleCoverage,
    buildFallbackProgramIntelligence,
  };
})();
