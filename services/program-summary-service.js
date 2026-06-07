(function () {
  "use strict";

  // BSM-UX-002: Periyodizasyon model label resolver — merkezi map SOT.
  // labels.js bu servisten önce yüklenir; defansif fallback ile güvenli.
  function resolvePeriodModelLabel(model) {
    var map = (typeof window !== "undefined" && window.BSMLabelData
      && window.BSMLabelData.labelMaps && window.BSMLabelData.labelMaps.periodModel) || null;
    if (map && map[model]) return map[model];
    return model === "manual" ? "Manuel Planlama" : "Kademeli Artış (Linear)";
  }

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

  // M1b.10: Periodization summary — TEK pure helper (SOT). Hem engine hem fallback
  // bunu çağırır → "engine ve fallback aynı string üretir" yapısal garanti.
  // periodization objesi buildMacrocycleCoverModel'den türetilir (cover band ile drift yok):
  //   { totalWeeks, currentWeekIndex, model, activeIntensityFactor, isActiveDeload, nextDeloadIndex }
  // İçerik (karar M1b.10): kaç haftalık program + aktif hafta + deload + yoğunluk.
  //   Linear normal: "8 haftalık linear program. Şu an Hafta 3 / 8 (yoğunluk 1.05×). Sıradaki deload: Hafta 4."
  //   Linear deload: "8 haftalık linear program. Şu an Hafta 4 / 8 — deload (toparlanma) haftası, yoğunluk 0.65×."
  //   Manual:        "6 haftalık manuel program. Şu an Hafta 2 / 6." (yoğunluk gizli — engine'de hep 1.0)
  // Geçersiz/null input → null (caller'da periodizationSummary set edilmez).
  function buildPeriodizationSummary(periodization) {
    if (!periodization || typeof periodization !== "object") return null;
    const totalWeeks = Number(periodization.totalWeeks);
    if (!Number.isFinite(totalWeeks) || totalWeeks <= 1) return null;  // 1 hafta → periodization anlamsız

    const currentWeekIndex = Number(periodization.currentWeekIndex) >= 1
      ? Math.min(Math.floor(Number(periodization.currentWeekIndex)), totalWeeks)
      : 1;
    const model = periodization.model === "manual" ? "manual" : "linear";
    // BSM-UX-002: Merkezi label map SOT (drift yok). Defansif fallback.
    const modelLabel = resolvePeriodModelLabel(model);
    const isActiveDeload = model === "manual" ? false : !!periodization.isActiveDeload;
    const rawIntensity = Number(periodization.activeIntensityFactor);
    const intensity = Number.isFinite(rawIntensity) && rawIntensity > 0 ? rawIntensity : 1.0;
    const nextDeloadIndex = Number(periodization.nextDeloadIndex) >= 1 ? Math.floor(Number(periodization.nextDeloadIndex)) : null;

    const head = `${totalWeeks} haftalık ${modelLabel} program.`;
    const weekText = `Şu an Hafta ${currentWeekIndex} / ${totalWeeks}`;

    let body;
    if (isActiveDeload) {
      // BSM-UX-002: "deload (toparlanma)" → "hafifletme (deload)" haftası
      body = `${weekText} — hafifletme (deload) haftası, yoğunluk ${intensity.toFixed(2)}×.`;
    } else if (model === "manual") {
      body = `${weekText}.`;  // Manual'de yoğunluk gizli
    } else {
      body = `${weekText} (yoğunluk ${intensity.toFixed(2)}×).`;
    }

    let tail = "";
    if (model !== "manual" && nextDeloadIndex !== null && nextDeloadIndex > currentWeekIndex) {
      // BSM-UX-002: "Sıradaki deload" → "Sıradaki hafifletme haftası"
      tail = ` Sıradaki hafifletme haftası: Hafta ${nextDeloadIndex}.`;
    }

    return `${head} ${body}${tail}`;
  }

  function buildFallbackProgramIntelligence(data, sessions, analysis, periodization) {
    const exerciseCount = sessions.reduce((sum, session) => sum + (session.exercises?.length || 0), 0);

    return {
      summary: `${data.days.length} günlük program ${exerciseCount} ana hareket satırıyla oluşturuldu.`,
      balance: {},
      warnings: analysis?.warnings?.map((warning) => warning.message) || [],
      coachNote: analysis?.nextAction || "Program 10-14 gün içinde ölçüm ve performans notuyla tekrar kontrol edilmeli.",
      nextControlSuggestion: "10-14 gün içinde kontrol önerilir.",
      // M1b.10: Periodization summary (SOT helper — engine ile birebir aynı).
      periodizationSummary: buildPeriodizationSummary(periodization),
    };
  }

  window.BSMProgramSummaryService = {
    buildProgramTitle,
    buildProgramOverview,
    buildMuscleCoverage,
    buildFallbackProgramIntelligence,
    // M1b.10: SOT helper expose — engine de bunu çağırır.
    buildPeriodizationSummary,
  };
})();
