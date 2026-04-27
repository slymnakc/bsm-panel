(function () {
  "use strict";

  function buildProgramSectionsModel(program, deps) {
    const { getMuscleLabel, weeklyPlanHtml } = deps;

    return {
      overview: (program.overview || []).map(([label, value]) => ({ label, value })),
      coachNote: program.coachNote,
      createdAt: program.createdAt,
      coverage: (program.coverage || []).map((item) => ({
        label: getMuscleLabel(item.group),
        summary: `${item.sessionCount} seans • ${item.exerciseCount} hareket`,
      })),
      weeklyPlanHtml,
      progression: program.progression || [],
      guidance: program.guidance || [],
    };
  }

  function buildOutputIntelligenceModel(program) {
    const analysis = program.aiReport || {};
    const intelligence = program.programIntelligence || {};
    const v3Insights = program.v3Insights || {};
    const warnings = [
      ...(analysis.warnings || []).map((warning) => warning.message || warning.title),
      ...(intelligence.warnings || []),
    ].filter(Boolean);
    const strengths = (analysis.strengths || []).slice(0, 3).join(" • ") || "Güçlü yönler ölçüm geçmişiyle netleşir.";
    const focusAreas = (analysis.focusAreas || []).slice(0, 3).join(" • ") || "Program takibi ve ölçüm düzeni sürdürülmeli.";

    return {
      cards: [
        {
          label: "AI Genel Değerlendirme",
          value: `${analysis.score ?? 0}/100`,
          text: analysis.summary || "Analiz için üye ve ölçüm bilgisi bekleniyor.",
          hero: true,
        },
        {
          label: "Hedef Uyumu",
          value: `${analysis.goalFitScore ?? 0}/100`,
          text: analysis.goalComment || "Hedef yorumu ölçüm trendiyle oluşur.",
        },
        {
          label: "Program Özeti",
          value: `${program.sessions?.length || 0} gün`,
          text: intelligence.summary || "Program dağılımı oluşturuldu.",
        },
        {
          label: "V3 Hazırlık",
          value: `${v3Insights.readinessScore ?? 0}/100`,
          text: v3Insights.summary || "V3 koçluk dosyası programla birlikte hazırlandı.",
        },
        {
          label: "Güçlü Yönler",
          value: `${analysis.riskLevel || "Belirsiz"} risk`,
          text: strengths,
        },
        {
          label: "Odak Noktaları",
          value: "",
          text: focusAreas,
          wide: true,
        },
        {
          label: "Koç Notu",
          value: "",
          text: intelligence.coachNote || analysis.nextAction || "Program uygulaması sonrası ölçüm ve performans kontrolü yapılmalı.",
          wide: true,
        },
        {
          label: "V3 Revizyon Planı",
          value: "",
          text: (v3Insights.revisionPlan?.recommendedActions || []).join(" • ") || "Revizyon önerisi bir sonraki ölçümle netleşir.",
          wide: true,
        },
      ],
      nextControlItems: [
        intelligence.nextControlSuggestion || "10-14 gün içinde ölçüm ve performans kontrolü önerilir.",
        `Önerilen sonraki adım: ${analysis.nextAction || "Üye programını takip et ve ölçüm geçmişini güncelle."}`,
        `Revizyon notu: ${analysis.revisionNote || "Program revizyonu trend verisine göre yapılmalı."}`,
      ],
      warnings: warnings.slice(0, 5),
    };
  }

  function buildProgramCoverModel(program, deps) {
    const { labelMaps } = deps;
    const rawData = program.rawData || {};
    const memberName = rawData.memberName || program.overview.find(([label]) => label === "Üye")?.[1] || "Üye";
    const trainerName = rawData.trainerName || program.overview.find(([label]) => label === "Antrenör")?.[1] || "-";
    const gym = rawData.gymName || program.overview.find(([label]) => label === "Fitness merkezi")?.[1] || "Bahçeşehir Spor Merkezi";

    return {
      brand: gym === "Belirtilmedi" ? "Bahçeşehir Spor Merkezi" : gym,
      memberTitle: `${memberName} için Antrenman Planı`,
      meta: `${labelMaps.goal[rawData.goal] || "Hedef"} • ${labelMaps.level[rawData.level] || "Seviye"} • ${rawData.days?.length || program.sessions.length} günlük program`,
      trainer: trainerName === "Belirtilmedi" ? "-" : trainerName,
    };
  }

  window.BSMOutputModelService = {
    buildProgramSectionsModel,
    buildOutputIntelligenceModel,
    buildProgramCoverModel,
  };
})();
