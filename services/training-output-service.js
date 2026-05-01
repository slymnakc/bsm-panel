(function () {
  "use strict";

  const nutritionNotice = "Beslenme planı uygulama içindeki Beslenme sekmesinde sunulmaktadır.";

  function buildTrainingReport(data = {}, sessions = [], intelligence = {}, analysis = {}, deps = {}) {
    const measurement = data.latestMeasurement || {};
    const guidance = data.measurementGuidance || {};
    const labelMaps = deps.labelMaps || {};
    const goalLabel = labelMaps.goal?.[data.goal] || data.goal || "Hedef";
    const levelLabel = labelMaps.level?.[data.level] || data.level || "Seviye";
    const trainingSystemLabel = deps.getTrainingSystemLabel ? deps.getTrainingSystemLabel(data.trainingSystem) : "Standart sistem";

    return {
      nutritionNotice,
      why: buildProgramWhy({ data, measurement, goalLabel, levelLabel, trainingSystemLabel, analysis }),
      tanitaAdaptation: buildTanitaAdaptation(measurement, guidance),
      weeklyProgression: buildWeeklyProgression(data, guidance),
      expectedResults: buildExpectedResults(data, measurement, guidance),
      dayCoachNotes: buildDayCoachNotes(sessions),
      cta: buildActionCta(data, guidance, intelligence),
    };
  }

  function buildProgramWhy({ data, measurement, goalLabel, levelLabel, trainingSystemLabel, analysis }) {
    const tanitaText = hasMeasurement(measurement)
      ? `Son ölçüm ${formatNumber(measurement.weight, "kg")} kilo, ${formatNumber(measurement.fat, "%")} yağ ve ${formatNumber(measurement.muscleMass, "kg")} kas verisine göre yorumlandı.`
      : "Tanita/ölçüm verisi yoksa program hedef, seviye ve uygun gün bilgisine göre oluşturulur.";

    return [
      {
        title: "Programın amacı",
        text: `${goalLabel} hedefi, ${levelLabel} seviye ve ${trainingSystemLabel.toLowerCase()} yapısına göre güvenli uygulanabilir antrenman planı hazırlandı.`,
      },
      {
        title: "Tanita bağlantısı",
        text: tanitaText,
      },
      {
        title: "Koç mantığı",
        text: analysis?.summary || "Program; ana hareket, destek egzersizi, kardiyo ve mobilite dengesini koruyacak şekilde planlandı.",
      },
    ];
  }

  function buildTanitaAdaptation(measurement, guidance) {
    const cards = [];

    if (guidance.fatLossSupport || guidance.visceralFatSupport) {
      cards.push({
        title: "Kardiyo desteği",
        status: "warning",
        text: "Yağ/visceral yağ verisi nedeniyle direnç antrenmanı kardiyo bitirişleriyle desteklendi.",
      });
    } else {
      cards.push({
        title: "Kardiyo dengesi",
        status: "normal",
        text: "Kardiyo hacmi hedef ve seans yapısını bozmayacak şekilde dengeli tutuldu.",
      });
    }

    if (guidance.strengthSupport) {
      cards.push({
        title: "Kas hacmi",
        status: "warning",
        text: "Kas kütlesi oranı düşük göründüğü için ana hareket ve destek egzersizi hacmi güçlendirildi.",
      });
    } else {
      cards.push({
        title: "Kas koruma",
        status: "normal",
        text: "Kas kütlesini korumak için büyük kas gruplarında progresif yüklenme hedeflendi.",
      });
    }

    if (guidance.segmentalImbalance) {
      cards.push({
        title: "Denge düzeltme",
        status: "warning",
        text: "Sağ-sol fark nedeniyle unilateral hareketler ve kontrollü tempo önerileri öne çıkarıldı.",
      });
    } else {
      cards.push({
        title: "Segmental denge",
        status: "normal",
        text: "Segmental fark belirgin değil; simetrik yüklenme ve teknik kalite korunmalı.",
      });
    }

    if (!hasMeasurement(measurement)) {
      cards.push({
        title: "Ölçüm notu",
        status: "neutral",
        text: "Tanita ölçümü kaydedildiğinde program önerileri daha kişisel hale gelir.",
      });
    }

    return cards;
  }

  function buildWeeklyProgression(data, guidance) {
    return [
      {
        title: "1. Hafta | Adaptasyon",
        text: "Teknik öğrenme, kontrollü tempo ve RPE 6-7 ile güvenli başlangıç.",
      },
      {
        title: "2. Hafta | Ağırlık artışı",
        text: "Form bozulmuyorsa ana hareketlerde küçük ağırlık artışı veya 1-2 tekrar ekleme.",
      },
      {
        title: "3. Hafta | Hacim artışı",
        text: guidance.strengthSupport
          ? "Kas kütlesi desteği için uygun hareketlerde ek set veya kontrollü tekrar artışı."
          : "Toplam set kalitesi korunarak hacim ve yoğunluk kademeli artırılır.",
      },
      {
        title: "4. Hafta | Deload ve kontrol",
        text: "Yorgunluk birikimini azaltmak için hacim %15-25 düşürülür, ölçüm ve performans kontrol edilir.",
      },
    ];
  }

  function buildExpectedResults(data, measurement, guidance) {
    const fatHigh = guidance.fatLossSupport || guidance.visceralFatSupport;
    const muscleLow = guidance.strengthSupport;
    const goal = data.goal || "";

    return [
      {
        label: "Yağ değişimi",
        value: fatHigh || goal === "fat-loss" ? "-0,5 / -1,5 puan" : "Koruma / küçük düşüş",
        percent: fatHigh || goal === "fat-loss" ? 72 : 46,
      },
      {
        label: "Kas değişimi",
        value: muscleLow || goal === "muscle-gain" ? "+0 / +0,6 kg" : "Koruma",
        percent: muscleLow || goal === "muscle-gain" ? 68 : 52,
      },
      {
        label: "Kilo değişimi",
        value: goal === "fat-loss" ? "-0,5 / -2 kg" : goal === "muscle-gain" ? "+0 / +1 kg" : "Stabil",
        percent: goal === "maintenance" ? 42 : 62,
      },
    ].map((item) => ({
      ...item,
      note: hasMeasurement(measurement) ? "4 haftalık beklenen takip aralığıdır; sonuç garanti değil, uygulama düzenine bağlıdır." : "Ölçüm verisi arttıkça hedef aralığı netleşir.",
    }));
  }

  function buildDayCoachNotes(sessions) {
    return (sessions || []).map((session, index) => ({
      dayLabel: session.dayLabel || `Gün ${index + 1}`,
      focus: session.purpose || session.title || "Teknik kalite ve kontrollü tempo",
      tip: session.balanceNote || session.note || "Ana hareketlerde form bozulmadan ilerleyin.",
    }));
  }

  function buildActionCta(data, guidance, intelligence) {
    return [
      {
        title: "Program",
        text: guidance.segmentalImbalance ? "Unilateral hareketleri takip et ve teknik farkları not al." : "Ana hareketlerde haftalık küçük ilerleme hedefle.",
      },
      {
        title: "Beslenme",
        text: nutritionNotice,
      },
      {
        title: "Takip",
        text: intelligence?.nextControlSuggestion || "14-21 gün içinde ölçüm ve program kontrolü önerilir.",
      },
    ];
  }

  function hasMeasurement(measurement) {
    return Boolean(measurement && Object.values(measurement).some((value) => value !== null && value !== undefined && value !== ""));
  }

  function formatNumber(value, unit) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "-";
    }

    const formatted = Number.isInteger(number) ? String(number) : number.toFixed(1).replace(".", ",");
    return `${formatted}${unit ? " " + unit : ""}`;
  }

  window.BSMTrainingOutputService = {
    nutritionNotice,
    buildTrainingReport,
  };
})();
