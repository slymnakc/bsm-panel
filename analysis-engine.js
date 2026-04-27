(function () {
  "use strict";

  const CONFIG = {
    rulesVersion: "2.0.0",
    staleMeasurementDays: 14,
    staleProgramDays: 21,
    weightTrendThreshold: 0.3,
    fatTrendThreshold: 0.3,
    muscleTrendThreshold: 0.2,
  };

  const goalLabels = {
    "fat-loss": "yağ kaybı",
    "muscle-gain": "kas kazanımı",
    strength: "kuvvet artışı",
    conditioning: "kondisyon gelişimi",
    maintenance: "form koruma",
  };

  const restrictionLabels = {
    knee: "diz hassasiyeti",
    back: "bel hassasiyeti",
    shoulder: "omuz hassasiyeti",
    "low-impact": "düşük etkili çalışma ihtiyacı",
  };

  function analyzeMember(input = {}) {
    const member = input.member || input;
    const today = input.today ? new Date(input.today) : new Date();
    const profile = member?.profile || {};
    const measurements = sortRecordsByDate(member?.measurements || [], "date");
    const programs = sortProgramRecords(member?.programs || []);
    const latest = measurements[0] || null;
    const previous = measurements[1] || null;
    const trend = analyzeMeasurementTrend(measurements);
    const coachAlerts = buildCoachAlerts(member, { today, trend });
    const scoring = scoreMember({ profile, latest, previous, trend, coachAlerts, today, programs });
    const strengths = buildStrengths({ profile, latest, trend });
    const risks = buildRisks({ profile, latest, trend, coachAlerts });
    const focusAreas = buildFocusAreas({ profile, latest, trend, coachAlerts });
    const goalComment = buildGoalComment(profile, trend, latest);
    const nextAction = buildNextAction({ profile, latest, programs, coachAlerts, scoring });
    const measurementSummary = measurements.slice(0, 3).map(formatMeasurementSummary);
    const programSuitability = buildProgramSuitability({ profile, programs, trend, latest });
    const revisionNote = buildRevisionNote({ profile, latest, trend, programs, coachAlerts });
    const notes = buildAnalysisNotes({ latest, trend, coachAlerts, scoring, profile });
    const tags = buildTags({ profile, scoring, trend, latest });

    return {
      engine: "local-rule-based",
      rulesVersion: CONFIG.rulesVersion,
      score: scoring.score,
      goalFitScore: scoring.goalFitScore,
      riskLevel: scoring.riskLevel,
      riskScore: scoring.riskScore,
      summary: buildSummary({ profile, latest, trend, scoring }),
      goalComment,
      strengths,
      riskAreas: risks,
      focusAreas,
      trend,
      coachAlerts,
      nextAction,
      measurementSummary,
      programSuitability,
      revisionNote,
      warnings: coachAlerts.filter((alert) => alert.severity !== "info"),
      notes,
      tags,
      llmReadyPayload: {
        rulesVersion: CONFIG.rulesVersion,
        profile: sanitizeProfile(profile),
        latestMeasurement: latest,
        previousMeasurement: previous,
        trends: trend.items,
        alerts: coachAlerts,
        scoring: {
          score: scoring.score,
          goalFitScore: scoring.goalFitScore,
          riskLevel: scoring.riskLevel,
        },
      },
    };
  }

  function analyzeMeasurementTrend(measurements = []) {
    const sorted = sortRecordsByDate(measurements, "date");
    const latest = sorted[0] || null;
    const previous = sorted[1] || null;

    if (!latest) {
      return {
        hasData: false,
        text: "Henüz ölçüm kaydı yok.",
        items: [],
        weight: buildEmptyTrend("Kilo"),
        fat: buildEmptyTrend("Yağ oranı"),
        muscle: buildEmptyTrend("Kas kütlesi"),
      };
    }

    const items = [
      buildTrendItem("weight", "Kilo", latest.weight, previous?.weight, "kg", CONFIG.weightTrendThreshold, true),
      buildTrendItem("fat", "Yağ oranı", latest.fat, previous?.fat, "%", CONFIG.fatTrendThreshold, false),
      buildTrendItem("muscleMass", "Kas kütlesi", latest.muscleMass, previous?.muscleMass, "kg", CONFIG.muscleTrendThreshold, true),
    ];

    return {
      hasData: true,
      text: previous ? items.map((item) => item.text).join(" ") : "İlk ölçüm alındı; trend için en az iki kayıt gerekir.",
      items,
      weight: items[0],
      fat: items[1],
      muscle: items[2],
    };
  }

  function buildCoachAlerts(member = {}, options = {}) {
    const today = options.today ? new Date(options.today) : new Date();
    const profile = member.profile || {};
    const measurements = sortRecordsByDate(member.measurements || [], "date");
    const programs = sortProgramRecords(member.programs || []);
    const latestMeasurement = measurements[0] || null;
    const latestProgram = programs[0] || null;
    const trend = options.trend || analyzeMeasurementTrend(measurements);
    const alerts = [];

    if (!latestMeasurement) {
      alerts.push({
        type: "measurement-missing",
        severity: latestProgram ? "warning" : "info",
        title: "Ölçüm kaydı bekleniyor",
        message: latestProgram
          ? "Program kaydı var ancak ölçüm yok. İlk segmental ölçüm alınırsa programın doğruluğu daha iyi takip edilir."
          : "Üye dosyasında ölçüm olmadığı için analiz başlangıç seviyesinde kalıyor.",
      });
    } else {
      const measurementAge = daysSince(latestMeasurement.date, today);
      if (measurementAge !== null && measurementAge > CONFIG.staleMeasurementDays) {
        alerts.push({
          type: "measurement-stale",
          severity: "warning",
          title: "Ölçüm güncellemesi gerekli",
          message: `Son ölçüm ${measurementAge} gün önce girilmiş. Yeni ölçüm alıp trendi güncellemeniz önerilir.`,
        });
      }
    }

    if (latestProgram) {
      const programAge = daysSince(latestProgram.savedAtIso || latestProgram.program?.createdAtIso || latestProgram.savedAt || latestProgram.program?.createdAt, today);
      if (programAge !== null && programAge > CONFIG.staleProgramDays) {
        alerts.push({
          type: "program-stale",
          severity: "warning",
          title: "Program revizyonu yaklaşıyor",
          message: `Son program ${programAge} gün önce kaydedilmiş. Hareket ve yoğunluk revizyonu planlanmalı.`,
        });
      }
    }

    if ((profile.restrictions || []).length) {
      const restrictionText = profile.restrictions.map((item) => restrictionLabels[item] || item).join(", ");
      alerts.push({
        type: "restriction",
        severity: "warning",
        title: "Hassasiyet kontrollü uygulanmalı",
        message: `${titleCase(restrictionText)} nedeniyle ağrı, hareket açıklığı ve teknik kalite seans içinde izlenmeli.`,
      });
    }

    if (profile.goal === "fat-loss" && profile.cardioPreference === "low") {
      alerts.push({
        type: "cardio-low-for-fat-loss",
        severity: "info",
        title: "Kardiyo desteği düşük",
        message: "Yağ kaybı hedefinde kardiyo tercihi minimum görünüyor. Bitiriş kardiyosu veya günlük adım hedefi eklenebilir.",
      });
    }

    if (profile.goal === "muscle-gain" && (profile.days || []).length < 3) {
      alerts.push({
        type: "low-frequency-for-muscle",
        severity: "info",
        title: "Kas kazanımı için frekans sınırlı",
        message: "Haftalık gün sayısı düşük. Kas kazanımı hedefinde 3 veya daha fazla gün daha iyi takip sağlar.",
      });
    }

    if (trend.hasData) {
      if (trend.fat.direction === "up") {
        alerts.push({
          type: "fat-up",
          severity: "warning",
          title: "Yağ oranı artışta",
          message: "Son ölçüm trendinde yağ oranı yükselmiş. Beslenme, kardiyo ve toplam hacim tekrar kontrol edilmeli.",
        });
      }

      if (trend.muscle.direction === "down") {
        alerts.push({
          type: "muscle-down",
          severity: "warning",
          title: "Kas kütlesi düşüşte",
          message: "Kas kütlesi düşüş eğiliminde. Protein, toparlanma ve direnç antrenmanı yüklenmesi yeniden değerlendirilmelidir.",
        });
      }
    }

    return alerts;
  }

  function scoreMember({ profile, latest, trend, coachAlerts, today, programs }) {
    let score = latest ? 70 : 55;
    let goalFitScore = 62;
    let riskScore = 0;

    if (!latest) {
      riskScore += 18;
      goalFitScore -= 10;
    }

    if (latest) {
      const bmi = calculateBmi(latest);
      const muscleRatio = latest.weight && latest.muscleMass ? (Number(latest.muscleMass) / Number(latest.weight)) * 100 : null;

      if (hasNumber(latest.fat)) {
        if (Number(latest.fat) >= 32) {
          score -= 10;
          riskScore += 12;
        } else if (Number(latest.fat) <= 22) {
          score += 6;
        }
      }

      if (hasNumber(latest.visceralFat)) {
        if (Number(latest.visceralFat) >= 13) {
          score -= 12;
          riskScore += 16;
        } else if (Number(latest.visceralFat) <= 9) {
          score += 5;
        }
      }

      if (hasNumber(latest.bodyWater)) {
        if (Number(latest.bodyWater) < 45) {
          score -= 5;
          riskScore += 5;
        } else if (Number(latest.bodyWater) >= 50 && Number(latest.bodyWater) <= 65) {
          score += 4;
        }
      }

      if (muscleRatio !== null) {
        if (muscleRatio >= 42) {
          score += 7;
        } else if (muscleRatio < 32) {
          score -= 7;
          riskScore += 6;
        }
      }

      if (bmi !== null) {
        if (bmi >= 30) {
          score -= 8;
          riskScore += 8;
        } else if (bmi >= 18.5 && bmi <= 26) {
          score += 4;
        }
      }

      const measurementAge = daysSince(latest.date, today);
      if (measurementAge !== null && measurementAge > CONFIG.staleMeasurementDays) {
        score -= 6;
        riskScore += 8;
      }
    }

    if ((profile.restrictions || []).length) {
      riskScore += Math.min(22, profile.restrictions.length * 8);
      score -= Math.min(8, profile.restrictions.length * 2);
    }

    if (programs?.[0]) {
      const programAge = daysSince(programs[0].savedAtIso || programs[0].program?.createdAtIso || programs[0].savedAt || programs[0].program?.createdAt, today);
      if (programAge !== null && programAge > CONFIG.staleProgramDays) {
        score -= 4;
        riskScore += 5;
      }
    }

    if (trend.hasData) {
      if (trend.fat.direction === "down") {
        score += 4;
      }
      if (trend.fat.direction === "up") {
        score -= 7;
        riskScore += 8;
      }
      if (trend.muscle.direction === "up") {
        score += 6;
      }
      if (trend.muscle.direction === "down") {
        score -= 7;
        riskScore += 9;
      }
    }

    goalFitScore += calculateGoalFitAdjustment(profile, trend, latest);

    coachAlerts.forEach((alert) => {
      if (alert.severity === "warning") {
        goalFitScore -= 3;
      }
    });

    score = clamp(Math.round(score), 35, 96);
    goalFitScore = clamp(Math.round(goalFitScore), 30, 96);

    return {
      score,
      goalFitScore,
      riskScore,
      riskLevel: riskScore >= 42 ? "Yüksek" : riskScore >= 22 ? "Orta" : "Düşük",
    };
  }

  function calculateGoalFitAdjustment(profile, trend, latest) {
    const days = (profile.days || []).length;
    let adjustment = 0;

    if (profile.goal === "fat-loss") {
      if (trend.fat.direction === "down") adjustment += 14;
      if (trend.weight.direction === "down") adjustment += 6;
      if (trend.muscle.direction === "up" || trend.muscle.direction === "stable") adjustment += 5;
      if (trend.fat.direction === "up") adjustment -= 12;
      if (trend.muscle.direction === "down") adjustment -= 8;
      if (profile.cardioPreference === "low") adjustment -= 7;
      if (hasNumber(latest?.visceralFat) && Number(latest.visceralFat) >= 13) adjustment -= 6;
    } else if (profile.goal === "muscle-gain") {
      if (trend.muscle.direction === "up") adjustment += 16;
      if (trend.weight.direction === "up" || trend.weight.direction === "stable") adjustment += 5;
      if (trend.muscle.direction === "down") adjustment -= 12;
      if (trend.fat.direction === "up") adjustment -= 6;
      if (days < 3) adjustment -= 8;
      if (days >= 4) adjustment += 5;
    } else if (profile.goal === "conditioning") {
      if (profile.cardioPreference === "high") adjustment += 10;
      if (profile.cardioPreference === "low") adjustment -= 6;
      if (days >= 3) adjustment += 4;
      if ((profile.restrictions || []).includes("low-impact")) adjustment += 2;
    } else if (profile.goal === "maintenance") {
      const stableCount = [trend.weight, trend.fat, trend.muscle].filter((item) => item.direction === "stable").length;
      adjustment += stableCount * 5;
      if (days >= 2 && days <= 4) adjustment += 4;
    } else if (profile.goal === "strength") {
      if (days >= 3) adjustment += 6;
      if (trend.muscle.direction === "up") adjustment += 7;
      if ((profile.restrictions || []).includes("back")) adjustment -= 5;
    }

    return adjustment;
  }

  function buildSummary({ profile, latest, trend, scoring }) {
    const goalLabel = goalLabels[profile.goal] || "genel gelişim";

    if (!latest) {
      return `Üye için ${goalLabel} hedefi tanımlı; ancak ölçüm kaydı olmadığı için analiz başlangıç seviyesinde. İlk segmental ölçüm girildiğinde skor, trend ve risk değerlendirmesi otomatik netleşir.`;
    }

    if (scoring.riskLevel === "Yüksek") {
      return `Son ölçüm ve form bilgilerine göre üye daha yakın takip gerektiriyor. ${goalLabel} hedefi korunabilir; ancak hassasiyetler, ölçüm trendi ve program revizyonu kontrollü yönetilmelidir.`;
    }

    if (scoring.score >= 82 && scoring.goalFitScore >= 75) {
      return `Son ölçüm genel olarak güçlü görünüyor. ${goalLabel} hedefiyle uyum iyi; mevcut plan küçük yüklenme artışları ve düzenli ölçüm takibiyle sürdürülebilir.`;
    }

    if (trend.hasData) {
      return `Genel tablo takip edilebilir seviyede. ${goalLabel} hedefi için ölçüm trendi, antrenman sıklığı ve toparlanma birlikte izlenmeli; gerekirse program hacmi kademeli revize edilmelidir.`;
    }

    return `İlk ölçüm alındı. ${goalLabel} hedefi için bu kayıt başlangıç referansı olarak kullanılmalı ve 10-14 gün içinde ikinci ölçümle trend kontrol edilmelidir.`;
  }

  function buildGoalComment(profile, trend, latest) {
    const goal = profile.goal;

    if (goal === "fat-loss") {
      if (trend.fat.direction === "down") {
        return "Yağ kaybı hedefiyle uyumlu bir düşüş görülüyor; kas kütlesi korunarak kardiyo ve direnç dengesi sürdürülmeli.";
      }
      return "Yağ kaybı hedefi için direnç antrenmanı korunmalı, kardiyo desteği ve günlük aktivite düzenli takip edilmelidir.";
    }

    if (goal === "muscle-gain") {
      if (trend.muscle.direction === "up") {
        return "Kas kazanımı hedefinde olumlu ilerleme var; aynı hareketlerde kademeli yüklenme ve yeterli toparlanma korunmalı.";
      }
      return "Kas kazanımı için ana direnç hareketleri, yeterli haftalık frekans ve progresif yüklenme daha görünür hale getirilmeli.";
    }

    if (goal === "conditioning") {
      return "Kondisyon hedefinde nabız kontrollü interval, düşük etkili kardiyo ve hareket kalitesi birlikte planlanmalıdır.";
    }

    if (goal === "maintenance") {
      return "Form koruma hedefinde ölçümlerin stabil kalması, ağrısız antrenman ve sürdürülebilir haftalık rutin önceliklidir.";
    }

    if (goal === "strength") {
      return "Kuvvet hedefinde ana hareketlerin teknik kalitesi, uzun dinlenme ve kontrollü yük artışı ön planda olmalıdır.";
    }

    return latest ? "Hedefe göre program ve ölçüm takibi birlikte sürdürülmelidir." : "Hedef yorumu için ilk ölçüm bekleniyor.";
  }

  function buildStrengths({ profile, latest, trend }) {
    const strengths = [];

    if ((profile.days || []).length >= 3) {
      strengths.push("Haftalık antrenman sıklığı takip için yeterli görünüyor.");
    }

    if (trend.fat.direction === "down") {
      strengths.push("Yağ oranı son ölçüme göre düşüş eğiliminde.");
    }

    if (trend.muscle.direction === "up") {
      strengths.push("Kas kütlesinde olumlu artış eğilimi var.");
    }

    if (hasNumber(latest?.bodyWater) && Number(latest.bodyWater) >= 50 && Number(latest.bodyWater) <= 65) {
      strengths.push("Vücut su oranı ölçüm gününde dengeli aralıkta.");
    }

    if (!(profile.restrictions || []).length) {
      strengths.push("Formda özel hassasiyet bildirimi yok.");
    }

    return strengths.length ? strengths : ["Takip sistemi kurulmuş; düzenli ölçümle güçlü yönler netleşecek."];
  }

  function buildRisks({ profile, latest, trend, coachAlerts }) {
    const risks = coachAlerts.filter((alert) => alert.severity === "warning").map((alert) => alert.title);

    if (hasNumber(latest?.visceralFat) && Number(latest.visceralFat) >= 13) {
      risks.push("Visceral yağ değeri dikkat gerektiriyor.");
    }

    if (trend.fat.direction === "up") {
      risks.push("Yağ oranı artış trendinde.");
    }

    if (trend.muscle.direction === "down") {
      risks.push("Kas kütlesi düşüş trendinde.");
    }

    if ((profile.restrictions || []).length) {
      risks.push("Hassasiyet nedeniyle hareket seçimi kontrollü yapılmalı.");
    }

    return [...new Set(risks)].slice(0, 5);
  }

  function buildFocusAreas({ profile, latest, trend, coachAlerts }) {
    const focus = [];

    if (profile.goal === "fat-loss") {
      focus.push("Direnç antrenmanını koruyup kardiyo ve günlük aktiviteyi düzenli takip et.");
    } else if (profile.goal === "muscle-gain") {
      focus.push("Ana hareketlerde kademeli yüklenme ve haftalık hacim takibini güçlendir.");
    } else if (profile.goal === "conditioning") {
      focus.push("Nabız kontrollü kondisyon blokları ve toparlanma sürelerini izle.");
    } else if (profile.goal === "maintenance") {
      focus.push("Ölçüm stabilitesi, sürdürülebilir rutin ve ağrısız formu koru.");
    } else if (profile.goal === "strength") {
      focus.push("Teknik kalite, uzun dinlenme ve düşük tekrar kuvvet setlerini önceliklendir.");
    }

    if ((profile.restrictions || []).includes("knee")) {
      focus.push("Diz hassasiyeti için derin squat/lunge varyasyonlarını kontrollü seç.");
    }

    if ((profile.restrictions || []).includes("back")) {
      focus.push("Bel hassasiyeti için destekli row, makine ve core stabilizasyon seçeneklerini öne al.");
    }

    if ((profile.restrictions || []).includes("shoulder")) {
      focus.push("Omuz hassasiyetinde baş üstü press ve derin dip varyasyonlarını sınırlı kullan.");
    }

    if (!latest || coachAlerts.some((alert) => alert.type.includes("measurement"))) {
      focus.push("10-14 gün aralığında yeni ölçüm kontrolü planla.");
    }

    if (trend.muscle.direction === "down") {
      focus.push("Kas kaybı riskine karşı direnç yoğunluğu ve toparlanma düzenini kontrol et.");
    }

    return [...new Set(focus)].slice(0, 5);
  }

  function buildNextAction({ latest, programs, coachAlerts, scoring }) {
    if (!latest) {
      return "İlk segmental ölçümü gir ve analiz skorunu netleştir.";
    }

    if (!programs.length) {
      return "Analiz sonucuna göre ilk programı oluşturup üye geçmişine kaydet.";
    }

    if (coachAlerts.some((alert) => alert.type === "program-stale")) {
      return "Programı güncelle, riskli hareketleri kontrol et ve yeni varyasyon planla.";
    }

    if (coachAlerts.some((alert) => alert.type === "measurement-stale")) {
      return "Yeni ölçüm alıp trendi güncelle.";
    }

    if (scoring.riskLevel === "Yüksek") {
      return "Hassasiyet ve kötüleşen metriklere göre program yoğunluğunu kontrollü revize et.";
    }

    return "Mevcut programı uygula, bir sonraki kontrolde ölçüm ve performans notlarını karşılaştır.";
  }

  function buildProgramSuitability({ profile, programs, trend }) {
    if (!programs?.length) {
      return "Henüz kayıtlı program olmadığı için uygunluk notu oluşturulamadı.";
    }

    const latestProgram = programs[0]?.program || {};
    const sessions = latestProgram.sessions || [];
    const sessionCount = sessions.length || (profile.days || []).length;
    const warnings = [];

    if (profile.goal === "muscle-gain" && sessionCount < 3) {
      warnings.push("kas kazanımı için haftalık frekans düşük");
    }

    if (profile.goal === "fat-loss" && profile.cardioPreference === "low") {
      warnings.push("yağ kaybı hedefinde kardiyo desteği sınırlı");
    }

    if (trend.fat.direction === "up") {
      warnings.push("yağ oranı artış trendi var");
    }

    if ((profile.restrictions || []).length) {
      warnings.push("hassasiyetlere göre egzersiz kontrolü gerekli");
    }

    if (!warnings.length) {
      return "Mevcut program hedef ve seviye ile genel olarak uyumlu görünüyor.";
    }

    return `Mevcut program uygulanabilir; ancak ${warnings.join(", ")}.`;
  }

  function buildRevisionNote({ profile, trend, programs, coachAlerts }) {
    if (!programs?.length) {
      return "Önce ilk programı oluşturun; ölçüm geldikçe revizyon önerisi otomatik netleşir.";
    }

    if (coachAlerts.some((alert) => alert.type === "program-stale")) {
      return "Program 21 günü geçtiği için hareket sırası, yoğunluk ve set sistemi güncellenmeli.";
    }

    if (profile.goal === "fat-loss" && trend.fat.direction !== "down") {
      return "Yağ kaybı hedefi için kardiyo bitirişi ve düşük riskli compound/accessory dengesi artırılabilir.";
    }

    if (profile.goal === "muscle-gain" && trend.muscle.direction !== "up") {
      return "Kas kazanımı için ana hareketlerde progresif yüklenme ve haftalık hacim artırımı gözden geçirilmeli.";
    }

    if ((profile.restrictions || []).length) {
      return "Hassasiyetli hareketler alternatiflerle kontrol edilmeli; ağrı oluşturan varyasyonlar programdan çıkarılmalı.";
    }

    return "Şu an büyük revizyon gerekmiyor; sonraki kontrolde ölçüm trendine göre küçük varyasyon değişikliği yeterli.";
  }

  function buildAnalysisNotes({ latest, trend, coachAlerts, scoring, profile }) {
    const notes = [];

    if (!latest) {
      notes.push({
        level: "info",
        title: "Ölçüm bekleniyor",
        text: "Skorun daha doğru oluşması için kilo, yağ oranı, kas kütlesi ve segmental ölçüm girilmelidir.",
      });
    }

    if (trend.fat.direction === "down") {
      notes.push({ level: "good", title: "Yağ trendi olumlu", text: "Son ölçümde yağ oranı düşüş eğiliminde görünüyor." });
    } else if (trend.fat.direction === "up") {
      notes.push({ level: "warning", title: "Yağ trendi izlenmeli", text: "Yağ oranı artış eğiliminde; kardiyo ve beslenme takibi güçlendirilmeli." });
    }

    if (trend.muscle.direction === "up") {
      notes.push({ level: "good", title: "Kas kütlesi destekleniyor", text: "Kas kütlesinde olumlu artış var; yüklenme kademeli sürdürülebilir." });
    } else if (trend.muscle.direction === "down") {
      notes.push({ level: "warning", title: "Kas kaybı riski", text: "Kas kütlesi düşüşü direnç yoğunluğu ve toparlanma kontrolü gerektirir." });
    }

    coachAlerts.slice(0, 3).forEach((alert) => {
      notes.push({ level: alert.severity === "warning" ? "warning" : "info", title: alert.title, text: alert.message });
    });

    if (!notes.length) {
      notes.push({
        level: scoring.riskLevel === "Düşük" ? "good" : "info",
        title: "Genel tablo dengeli",
        text: `${goalLabels[profile.goal] || "Hedef"} için ölçüm ve program takibi sürdürülebilir görünüyor.`,
      });
    }

    return notes.slice(0, 5);
  }

  function buildTags({ profile, scoring, trend, latest }) {
    const tags = [`Risk: ${scoring.riskLevel}`, `Hedef uyumu: ${scoring.goalFitScore}/100`];

    if (profile.goal) {
      tags.push(titleCase(goalLabels[profile.goal] || profile.goal));
    }

    if (trend.fat.direction === "down") {
      tags.push("Yağ oranı düşüşte");
    }

    if (trend.muscle.direction === "up") {
      tags.push("Kas kütlesi artışta");
    }

    if (hasNumber(latest?.boneMass)) {
      tags.push("Kemik kg takipte");
    }

    if (hasNumber(latest?.age) && hasNumber(latest?.metabolicAge)) {
      const metabolicDelta = Number(latest.metabolicAge) - Number(latest.age);
      tags.push(metabolicDelta <= 0 ? "Metabolizma yaşı avantajlı" : "Metabolizma yaşı takipte");
    }

    return tags.slice(0, 5);
  }

  function buildTrendItem(key, label, current, previous, unit, threshold, higherIsGood) {
    if (!hasNumber(current)) {
      return buildEmptyTrend(label);
    }

    if (!hasNumber(previous)) {
      return {
        key,
        label,
        current: Number(current),
        previous: null,
        delta: null,
        direction: "new",
        isPositive: null,
        text: `${label} için ilk kayıt alındı.`,
      };
    }

    const delta = Number(current) - Number(previous);
    const absDelta = Math.abs(delta);
    const direction = absDelta < threshold ? "stable" : delta > 0 ? "up" : "down";
    const isPositive = direction === "stable" ? true : higherIsGood ? direction === "up" : direction === "down";
    const verb = direction === "stable" ? "stabil kaldı" : direction === "up" ? "arttı" : "azaldı";
    const sign = delta > 0 ? "+" : "";

    return {
      key,
      label,
      current: Number(current),
      previous: Number(previous),
      delta,
      direction,
      isPositive,
      text:
        direction === "stable"
          ? `${label} stabil kaldı.`
          : `${label} ${sign}${round(delta)}${unit ? ` ${unit}` : ""} ${verb}.`,
    };
  }

  function buildEmptyTrend(label) {
    return {
      label,
      current: null,
      previous: null,
      delta: null,
      direction: "unknown",
      isPositive: null,
      text: `${label} verisi yok.`,
    };
  }

  function formatMeasurementSummary(measurement) {
    return {
      date: measurement.date || "Tarih yok",
      weight: formatValue(measurement.weight, "kg"),
      height: formatValue(measurement.height, "cm"),
      age: formatValue(measurement.age, "yaş"),
      fat: formatValue(measurement.fat, "%"),
      muscleMass: formatValue(measurement.muscleMass, "kg"),
      bmr: formatValue(measurement.bmr, "kcal"),
    };
  }

  function calculateBmi(measurement) {
    if (!hasNumber(measurement?.weight) || !hasNumber(measurement?.height)) {
      return null;
    }

    const heightMeter = Number(measurement.height) / 100;
    return Number(measurement.weight) / (heightMeter * heightMeter);
  }

  function sortRecordsByDate(records, key) {
    return [...records].sort((a, b) => {
      const dateA = parseDate(a?.[key]);
      const dateB = parseDate(b?.[key]);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }

  function sortProgramRecords(programs) {
    return [...programs].sort((a, b) => {
      const dateA = parseDate(a?.savedAtIso || a?.program?.createdAtIso || a?.savedAt || a?.program?.createdAt);
      const dateB = parseDate(b?.savedAtIso || b?.program?.createdAtIso || b?.savedAt || b?.program?.createdAt);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }

  function daysSince(value, today = new Date()) {
    const date = parseDate(value);
    if (!date) {
      return null;
    }

    const diff = new Date(today).setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(diff / 86400000));
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const monthMap = {
      ocak: 0,
      şubat: 1,
      subat: 1,
      mart: 2,
      nisan: 3,
      mayıs: 4,
      mayis: 4,
      haziran: 5,
      temmuz: 6,
      ağustos: 7,
      agustos: 7,
      eylül: 8,
      eylul: 8,
      ekim: 9,
      kasım: 10,
      kasim: 10,
      aralık: 11,
      aralik: 11,
    };
    const normalized = String(value).toLocaleLowerCase("tr-TR").replaceAll(",", " ");
    const match = normalized.match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i);

    if (!match) {
      return null;
    }

    const month = monthMap[match[2]];
    if (month === undefined) {
      return null;
    }

    return new Date(Number(match[3]), month, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0));
  }

  function sanitizeProfile(profile) {
    return {
      goal: profile.goal || "",
      level: profile.level || "",
      days: profile.days || [],
      equipmentScope: profile.equipmentScope || "",
      cardioPreference: profile.cardioPreference || "",
      priorityMuscle: profile.priorityMuscle || "",
      restrictions: profile.restrictions || [],
    };
  }

  function hasNumber(value) {
    return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  }

  function formatValue(value, unit) {
    return hasNumber(value) ? `${round(value)} ${unit}` : "Veri yok";
  }

  function round(value) {
    return Number(value).toFixed(Math.abs(Number(value)) >= 10 ? 0 : 1);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function titleCase(value) {
    return String(value || "")
      .split(" ")
      .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
      .join(" ");
  }

  window.BSMAnalysisEngine = {
    CONFIG,
    analyzeMember,
    analyzeMeasurementTrend,
    buildCoachAlerts,
    daysSince,
    parseDate,
  };
})();
