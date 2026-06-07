(function () {
  "use strict";

  // BSM-UX-002: Periyodizasyon model label resolver — merkezi map SOT.
  // window.BSMLabelData.labelMaps.periodModel'den okur. Defansif fallback ile
  // (map yoksa veya değer eksikse) eski davranış korunur.
  function resolvePeriodModelLabel(model) {
    var map = (typeof window !== "undefined" && window.BSMLabelData
      && window.BSMLabelData.labelMaps && window.BSMLabelData.labelMaps.periodModel) || null;
    if (map && map[model]) return map[model];
    return model === "manual" ? "Manuel Planlama" : "Kademeli Artış (Linear)";
  }

  function buildProgramSectionsModel(program, deps) {
    const { getMuscleLabel, getDayLabel, labelMaps, weeklyPlanHtml } = deps;
    const rawData = program.rawData || {};
    const overview = [
      ["Üye adı", rawData.memberName || findOverviewValue(program, "Üye") || "Belirtilmedi"],
      ["Hedef", labelMaps?.goal?.[rawData.goal] || findOverviewValue(program, "Hedef") || "Belirtilmedi"],
      ["Seviye", labelMaps?.level?.[rawData.level] || findOverviewValue(program, "Seviye") || "Belirtilmedi"],
      ["Haftalık antrenman günleri", formatTrainingDays(rawData.days, getDayLabel)],
    ];

    return {
      overview: overview.map(([label, value]) => ({ label, value })),
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

  function findOverviewValue(program, targetLabel) {
    const match = (program.overview || []).find(([label]) => label === targetLabel);
    return match?.[1] || "";
  }

  function formatTrainingDays(days, getDayLabel) {
    if (!Array.isArray(days) || !days.length) {
      return "Belirtilmedi";
    }

    return days.map((day) => (getDayLabel ? getDayLabel(day) : day)).join(", ");
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
          // M1b.10: periodizationSummary varsa base summary'ye eklenir (ayrı kart değil).
          // Çok haftalı programlarda "N haftalık ... Hafta X/N ..." bilgisi gösterilir.
          text: intelligence.periodizationSummary
            ? `${intelligence.summary || "Program dağılımı oluşturuldu."} ${intelligence.periodizationSummary}`
            : (intelligence.summary || "Program dağılımı oluşturuldu."),
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
      // M1b.3: Macrocycle read-only model. Sessions alias mantığına dokunulmuyor;
      // sadece state.activeProgram.weeks + macrocycle + currentWeekIndex okunup
      // UI'a düz veri olarak iletiliyor.
      macrocycle: buildMacrocycleCoverModel(program),
    };
  }

  // M1b.3: Cover macrocycle band için read-only veri model'i.
  // - totalWeeks <= 1 → visible:false (band tamamen gizli)
  // - currentWeekIndex yoksa 1 fallback
  // - nextDeloadWeekIndex: weeks.find(w => w.isDeload && w.weekIndex > currentIdx)
  //   yoksa null (UI'da deload satırı gizlenir)
  // - model "manual" ise label "Manual", deload chip ignore (engine kuralı)
  function buildMacrocycleCoverModel(program) {
    const macro = program && program.macrocycle ? program.macrocycle : {};
    const totalWeeks = Number(macro.totalWeeks) >= 1 ? Math.floor(Number(macro.totalWeeks)) : 1;
    const model = macro.model === "manual" ? "manual" : "linear";

    // Default: band gizli (1 hafta program — macrocycle anlamsız)
    if (totalWeeks <= 1) {
      return { visible: false };
    }

    const rawCurrent = Number(program && program.currentWeekIndex);
    const currentWeekIndex = Number.isFinite(rawCurrent) && rawCurrent >= 1
      ? Math.min(Math.floor(rawCurrent), totalWeeks)
      : 1;

    const weeks = Array.isArray(program && program.weeks) ? program.weeks : [];
    // Sıradaki deload: currentWeekIndex'ten BÜYÜK ilk isDeload week.
    // M1b.3: Manual model'de deload mantığı KULLANILMAZ (engine kuralı —
    // computeIntensityTable Manual branch hep isDeload:false döner). Mock
    // ya da malformed weeks'te isDeload=true gelse bile Manual'de yok say.
    const nextDeloadWeek = model === "manual"
      ? null
      : weeks.find((w) => w && w.isDeload && Number(w.weekIndex) > currentWeekIndex);
    const nextDeloadIndex = nextDeloadWeek ? Number(nextDeloadWeek.weekIndex) : null;

    // BSM-UX-002: Merkezi label map SOT (drift yok). Defansif fallback.
    const modelLabel = resolvePeriodModelLabel(model);
    const title = `📅 ${totalWeeks} Haftalık Program · ${modelLabel}`;
    const currentText = `Hafta ${currentWeekIndex} / ${totalWeeks}`;
    const progressPercent = Math.round((currentWeekIndex / totalWeeks) * 1000) / 10; // 1 ondalık (örn. 12.5)

    let nextDeloadText = null;
    if (nextDeloadIndex !== null) {
      const weeksUntil = nextDeloadIndex - currentWeekIndex;
      nextDeloadText = weeksUntil <= 1
        ? `Bir sonraki hafifletme haftası: Hafta ${nextDeloadIndex}`
        : `Bir sonraki hafifletme haftası: Hafta ${nextDeloadIndex} (${weeksUntil} hafta sonra)`;
    }

    // M1b.5: PDF header band için aktif hafta yoğunluğu + deload durumu.
    // SOT ilkesi: PDF payload bu fonksiyondan beslenir, drift yok.
    // - Manual modda intensityFactor=1.0 (engine kuralı), bilgi anlamsız → gizle
    // - isActiveDeload: aktif haftanın isDeload field'ı (Linear için anlamlı)
    const activeWeek = weeks[currentWeekIndex - 1] || null;
    const rawIntensity = Number(activeWeek && activeWeek.intensityFactor);
    const activeIntensityFactor = Number.isFinite(rawIntensity) && rawIntensity > 0
      ? Math.round(rawIntensity * 100) / 100
      : 1.0;
    // Manual'de deload yok (engine kuralı); defansif: model==manual → false
    const isActiveDeload = model === "manual"
      ? false
      : !!(activeWeek && activeWeek.isDeload);

    // PDF header satırları (3 satır şablon):
    //   headerLine1: "📅 N Haftalık Program · Linear/Manual" (= title, alias)
    //   headerLine2: aktif hafta + yoğunluk (Manual'de intensity yok)
    //                Deload aktif → "🌙 DELOAD HAFTASI · 0.65× yoğunluk"
    //   headerLine3: sıradaki deload (= nextDeloadText, alias)
    const headerLine1 = title;
    let headerLine2;
    if (isActiveDeload) {
      // BSM-UX-002: "DELOAD HAFTASI" → "HAFİFLETME HAFTASI (DELOAD)"
      headerLine2 = `🌙 ${currentText} · HAFİFLETME HAFTASI (DELOAD) · ${activeIntensityFactor.toFixed(2)}× yoğunluk`;
    } else if (model === "manual") {
      headerLine2 = `Bu çıktı: ${currentText}`;
    } else {
      headerLine2 = `Bu çıktı: ${currentText} · ${activeIntensityFactor.toFixed(2)}× yoğunluk`;
    }
    const headerLine3 = nextDeloadText;  // null → PDF'de satır çizilmez

    return {
      visible: true,
      title,
      currentText,
      progressPercent,
      nextDeloadText,           // null → UI'da satır hidden
      // M1b.5: PDF header alanları (3 satır).
      headerLine1,
      headerLine2,
      headerLine3,
      // Raw veriler (gelecek tüketiciler için):
      totalWeeks,
      currentWeekIndex,
      model,
      nextDeloadIndex,
      activeIntensityFactor,    // M1b.5: aktif haftanın yoğunluk faktörü
      isActiveDeload,           // M1b.5: aktif hafta deload mı?
    };
  }

  window.BSMOutputModelService = {
    buildProgramSectionsModel,
    buildOutputIntelligenceModel,
    buildProgramCoverModel,
    // M1b.5: SOT için public expose. PDF payload aynı fonksiyondan beslenir.
    buildMacrocycleCoverModel,
  };
})();
