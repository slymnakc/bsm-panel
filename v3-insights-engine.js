(function () {
  "use strict";

  const CONFIG = {
    engineVersion: "3.0.0",
    measurementFreshDays: 14,
    programFreshDays: 21,
    controlWindowDays: 14,
    chartMetrics: [
      { key: "weight", label: "Kilo", unit: "kg", lowerIsBetterFor: ["fat-loss"] },
      { key: "fat", label: "Yağ oranı", unit: "%", lowerIsBetterFor: ["fat-loss", "conditioning"] },
      { key: "muscleMass", label: "Kas kütlesi", unit: "kg", higherIsBetterFor: ["muscle-gain", "strength", "maintenance"] },
      { key: "waist", label: "Bel çevresi", unit: "cm", lowerIsBetterFor: ["fat-loss", "conditioning"] },
    ],
  };

  function buildMemberDossier(member = {}, analysis = {}, automationRecords = [], options = {}) {
    const today = options.today ? new Date(options.today) : new Date();
    const profile = member.profile || {};
    const measurements = sortMeasurements(member.measurements || []);
    const programs = sortPrograms(member.programs || []);
    const latestMeasurement = measurements[0] || null;
    const latestProgram = programs[0] || null;
    const measurementAge = latestMeasurement ? daysSince(latestMeasurement.date, today) : null;
    const programAge = latestProgram ? daysSince(latestProgram.savedAtIso || latestProgram.program?.createdAtIso || latestProgram.savedAt || latestProgram.program?.createdAt, today) : null;
    const trendSeries = buildTrendSeries(measurements, profile.goal);
    const dataQualityScore = scoreDataQuality({ profile, latestMeasurement, measurements, programs });
    const continuityScore = scoreContinuity({ measurementAge, programAge, programs });
    const coachingPriorityScore = scoreCoachingPriority({ analysis, measurementAge, programAge, profile });
    const revisionPlan = buildRevisionPlan({ member, analysis, measurementAge, programAge, trendSeries });

    return {
      engineVersion: CONFIG.engineVersion,
      readinessScore: clamp(Math.round((dataQualityScore * 0.35) + (continuityScore * 0.3) + ((100 - coachingPriorityScore) * 0.35)), 0, 100),
      dataQualityScore,
      continuityScore,
      coachingPriorityScore,
      summary: buildDossierSummary({ profile, analysis, dataQualityScore, continuityScore, coachingPriorityScore }),
      trendSeries,
      revisionPlan,
      controlTimeline: buildMemberControlTimeline(member, automationRecords, today),
      coachChecklist: buildCoachChecklist({ profile, analysis, measurements, programs }),
      mediaReadiness: buildMediaReadiness(profile),
      latestMeta: {
        measurementAge,
        programAge,
        measurementCount: measurements.length,
        programCount: programs.length,
      },
    };
  }

  function buildDashboardCalendar(members = [], automationRecords = [], options = {}) {
    const today = options.today ? new Date(options.today) : new Date();
    const items = [];

    automationRecords.forEach((record) => {
      const dueDate = parseDate(record.dueAt);
      if (!dueDate) {
        return;
      }

      const daysLeft = daysBetween(today, dueDate);
      if (daysLeft >= 0 && daysLeft <= CONFIG.controlWindowDays) {
        items.push({
          memberId: record.memberId,
          memberName: record.memberName || "Üye",
          title: record.title || "Takip",
          text: record.message || "",
          dueAt: dueDate.toISOString(),
          daysLeft,
          severity: record.severity || "info",
        });
      }
    });

    members.forEach((member) => {
      const existing = items.some((item) => item.memberId === member.id && item.title.includes("Kontrol"));
      if (existing) {
        return;
      }

      const latestMeasurement = sortMeasurements(member.measurements || [])[0];
      const latestProgram = sortPrograms(member.programs || [])[0];
      const baseDate = parseDate(latestMeasurement?.date) || parseDate(latestProgram?.savedAtIso || latestProgram?.program?.createdAtIso || latestProgram?.savedAt || latestProgram?.program?.createdAt);

      if (!baseDate) {
        return;
      }

      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + CONFIG.measurementFreshDays);
      const daysLeft = daysBetween(today, dueDate);

      if (daysLeft >= 0 && daysLeft <= CONFIG.controlWindowDays) {
        items.push({
          memberId: member.id,
          memberName: member.profile?.memberName || member.profile?.memberCode || "Üye",
          title: "Planlı kontrol",
          text: "Ölçüm ve program performansı birlikte gözden geçirilmeli.",
          dueAt: dueDate.toISOString(),
          daysLeft,
          severity: "info",
        });
      }
    });

    return dedupe(items).sort((a, b) => a.daysLeft - b.daysLeft || a.memberName.localeCompare(b.memberName, "tr")).slice(0, 8);
  }

  function buildTrendSeries(measurements = [], goal = "") {
    const chronological = sortMeasurements(measurements).reverse();

    return CONFIG.chartMetrics.map((metric) => {
      const values = chronological
        .map((measurement) => ({
          date: measurement.date || "",
          value: toNumberOrNull(measurement[metric.key]),
        }))
        .filter((item) => item.value !== null);
      const min = values.length ? Math.min(...values.map((item) => item.value)) : 0;
      const max = values.length ? Math.max(...values.map((item) => item.value)) : 0;
      const delta = values.length >= 2 ? values[values.length - 1].value - values[0].value : null;
      const goalDirection = metric.lowerIsBetterFor?.includes(goal) ? "lower" : metric.higherIsBetterFor?.includes(goal) ? "higher" : "stable";
      const isPositive = delta === null ? null : goalDirection === "lower" ? delta <= 0 : goalDirection === "higher" ? delta >= 0 : Math.abs(delta) <= 0.4;

      return {
        ...metric,
        values,
        min,
        max,
        delta,
        isPositive,
        statusText: buildTrendStatusText(metric, delta, goalDirection),
      };
    });
  }

  function buildRevisionPlan({ member, analysis, measurementAge, programAge, trendSeries }) {
    const profile = member.profile || {};
    const actions = [];
    const approvalSteps = [];
    const riskControls = [];

    if (!member.programs?.length) {
      actions.push("İlk programı oluştur ve üye geçmişine kaydet.");
      approvalSteps.push("Antrenör ilk seans sonrası hareket toleransını kontrol eder.");
    } else if (programAge !== null && programAge >= CONFIG.programFreshDays) {
      actions.push("Program hareket sırası, set sistemi ve yoğunluk açısından revize edilmeli.");
      approvalSteps.push("Eski program ile yeni öneri yan yana kontrol edilip onaylanmalı.");
    }

    if (!member.measurements?.length) {
      actions.push("İlk segmental ölçüm alınmadan V3 takip tam kapasiteye geçmez.");
      approvalSteps.push("Kilo, yağ oranı, kas kütlesi, bel çevresi ve segmental sonuçlar girilmeli.");
    } else if (measurementAge !== null && measurementAge >= CONFIG.measurementFreshDays) {
      actions.push("Yeni ölçüm alınarak trend grafikleri güncellenmeli.");
    }

    if (profile.goal === "fat-loss" && trendSeries.find((item) => item.key === "fat")?.isPositive === false) {
      actions.push("Yağ kaybı hedefi için kardiyo bitirişi ve günlük aktivite takibi artırılmalı.");
    }

    if (profile.goal === "muscle-gain" && trendSeries.find((item) => item.key === "muscleMass")?.isPositive === false) {
      actions.push("Kas kazanımı için compound hareket hacmi ve progresif yüklenme tekrar kontrol edilmeli.");
    }

    if ((profile.restrictions || []).length) {
      riskControls.push("Hassasiyet bildirilen bölgelerde ağrı skalası ve hareket açıklığı takip edilmeli.");
      riskControls.push("Riskli hareketler alternatif listesinden güvenli varyasyonlarla değiştirilmeli.");
    }

    if (!actions.length) {
      actions.push("Mevcut program korunabilir; küçük varyasyon ve performans notu takibi yeterli.");
    }

    if (!approvalSteps.length) {
      approvalSteps.push("Antrenör bir sonraki kontrolde ölçüm trendi ve egzersiz performansını karşılaştırır.");
    }

    if (!riskControls.length) {
      riskControls.push("Teknik kalite bozulursa yük azaltılır ve hareket alternatifi seçilir.");
    }

    return {
      priority: analysis.riskLevel === "Yüksek" || actions.length >= 3 ? "Yüksek" : analysis.riskLevel === "Orta" ? "Orta" : "Normal",
      fitNote: analysis.programSuitability || "Program uygunluğu ölçüm ve geçmiş veriye göre takip edilir.",
      revisionNote: analysis.revisionNote || "Revizyon notu sonraki kontrolde netleştirilir.",
      recommendedActions: actions.slice(0, 5),
      approvalSteps: approvalSteps.slice(0, 4),
      riskControls: riskControls.slice(0, 4),
    };
  }

  function buildMemberControlTimeline(member, automationRecords, today) {
    const records = automationRecords.filter((record) => record.memberId === member.id);
    const timeline = records.map((record) => {
      const dueDate = parseDate(record.dueAt) || today;
      return {
        title: record.title || "Kontrol",
        text: record.message || "",
        dueAt: dueDate.toISOString(),
        daysLeft: daysBetween(today, dueDate),
        severity: record.severity || "info",
      };
    });

    if (!timeline.length) {
      const latestMeasurement = sortMeasurements(member.measurements || [])[0];
      const baseDate = parseDate(latestMeasurement?.date) || today;
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + CONFIG.measurementFreshDays);
      timeline.push({
        title: "Sonraki kontrol",
        text: "Ölçüm, ağrı notu ve program performansı birlikte kontrol edilir.",
        dueAt: nextDate.toISOString(),
        daysLeft: daysBetween(today, nextDate),
        severity: "info",
      });
    }

    return timeline.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 4);
  }

  function scoreDataQuality({ profile, latestMeasurement, measurements, programs }) {
    let score = 20;

    if (profile.memberName || profile.memberCode) score += 10;
    if (profile.goal) score += 10;
    if (profile.level) score += 8;
    if ((profile.days || []).length >= 2) score += 8;
    if (latestMeasurement) score += 18;
    if (measurements.length >= 2) score += 12;
    if (measurements.length >= 3) score += 7;
    if (programs.length) score += 7;

    return clamp(score, 0, 100);
  }

  function scoreContinuity({ measurementAge, programAge, programs }) {
    let score = 55;

    if (measurementAge !== null) {
      score += measurementAge <= CONFIG.measurementFreshDays ? 25 : -12;
    }

    if (programAge !== null) {
      score += programAge <= CONFIG.programFreshDays ? 18 : -10;
    }

    if (programs.length >= 2) {
      score += 8;
    }

    return clamp(score, 0, 100);
  }

  function scoreCoachingPriority({ analysis, measurementAge, programAge, profile }) {
    let score = 20;

    if (analysis.riskLevel === "Yüksek") score += 35;
    if (analysis.riskLevel === "Orta") score += 18;
    if ((profile.restrictions || []).length) score += 12;
    if (measurementAge === null || measurementAge > CONFIG.measurementFreshDays) score += 12;
    if (programAge !== null && programAge > CONFIG.programFreshDays) score += 10;
    if ((analysis.warnings || []).length) score += Math.min(14, analysis.warnings.length * 4);

    return clamp(score, 0, 100);
  }

  function buildDossierSummary({ profile, analysis, dataQualityScore, continuityScore, coachingPriorityScore }) {
    const memberGoal = profile.goal ? ` hedefi ${profile.goal}` : "";

    if (dataQualityScore < 55) {
      return `V3 dosyası açıldı; ancak veri kalitesi düşük. Ölçüm ve program geçmişi tamamlandığında koçluk önerileri daha net çalışır.`;
    }

    if (coachingPriorityScore >= 60) {
      return `Üye${memberGoal} için yakın koç takibi gerektiriyor. Hassasiyet, ölçüm gecikmesi veya kötüleşen trendler öncelikle ele alınmalı.`;
    }

    if (continuityScore >= 80) {
      return `Üye dosyası V3 takip için güçlü durumda. Program, ölçüm trendleri ve kontrol takvimi düzenli yönetilebilir.`;
    }

    return `Üye dosyası V3 takibe uygun. Bir sonraki kontrolde ölçüm trendi ve program performansı birlikte karşılaştırılmalı.`;
  }

  function buildCoachChecklist({ profile, analysis, measurements, programs }) {
    const checklist = [];

    checklist.push(measurements.length ? "Son ölçüm trendini üye hedefiyle karşılaştır." : "İlk segmental ölçümü gir.");
    checklist.push(programs.length ? "Mevcut programdaki riskli hareketleri alternatiflerle kontrol et." : "İlk programı oluştur ve geçmişe kaydet.");
    checklist.push("Seans sonrası ağrı, RPE ve performans notunu dosyaya ekle.");

    if ((profile.restrictions || []).length) {
      checklist.push("Diz, bel veya omuz hassasiyetinde teknik toleransı her seansta sor.");
    }

    if (analysis.nextAction) {
      checklist.push(analysis.nextAction);
    }

    return [...new Set(checklist)].slice(0, 5);
  }

  function buildMediaReadiness(profile) {
    const focus = profile.priorityMuscle && profile.priorityMuscle !== "balanced" ? profile.priorityMuscle : "genel program";

    return {
      status: "Hazır alan",
      text: `${focus} için hareket video/görsel bağlantıları V3 medya alanına eklenebilir. Şimdilik hareket notları ve alternatifler gösteriliyor.`,
    };
  }

  function buildTrendStatusText(metric, delta, goalDirection) {
    if (delta === null) {
      return "Trend için en az iki ölçüm gerekir.";
    }

    const sign = delta > 0 ? "+" : "";
    const changeText = `${sign}${round(delta)} ${metric.unit}`;

    if (goalDirection === "lower") {
      return delta <= 0 ? `${changeText} hedefle uyumlu.` : `${changeText} hedefe ters yönde.`;
    }

    if (goalDirection === "higher") {
      return delta >= 0 ? `${changeText} hedefle uyumlu.` : `${changeText} hedefe ters yönde.`;
    }

    return Math.abs(delta) <= 0.4 ? "Stabil aralıkta." : `${changeText} değişim var.`;
  }

  function sortMeasurements(measurements) {
    return [...measurements].sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));
  }

  function sortPrograms(programs) {
    return [...programs].sort((a, b) => {
      const dateA = parseDate(a.savedAtIso || a.program?.createdAtIso || a.savedAt || a.program?.createdAt);
      const dateB = parseDate(b.savedAtIso || b.program?.createdAtIso || b.savedAt || b.program?.createdAt);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }

  function dedupe(items) {
    const map = new Map();
    items.forEach((item) => {
      map.set(`${item.memberId}-${item.title}-${item.dueAt.slice(0, 10)}`, item);
    });
    return [...map.values()];
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    if (window.BSMAnalysisEngine?.parseDate) {
      return window.BSMAnalysisEngine.parseDate(value);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function daysSince(value, today = new Date()) {
    const date = parseDate(value);
    if (!date) {
      return null;
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  function daysBetween(startValue, endValue) {
    const start = new Date(startValue);
    const end = new Date(endValue);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end - start) / 86400000);
  }

  function toNumberOrNull(value) {
    return value === "" || value === undefined || value === null || !Number.isFinite(Number(value)) ? null : Number(value);
  }

  function round(value) {
    return Number(value).toFixed(Math.abs(Number(value)) >= 10 ? 0 : 1);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.BSMV3InsightsEngine = {
    CONFIG,
    buildMemberDossier,
    buildDashboardCalendar,
    buildTrendSeries,
  };
})();
