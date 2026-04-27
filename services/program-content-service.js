(function () {
  "use strict";

  function buildLiveSummaryModel(data, deps) {
    const {
      resolveSplit,
      labelMaps,
      getDayLabel,
      getMuscleLabel,
      getProgramStyleSummaryLabel,
      getTrainingSystemLabel,
    } = deps;

    const splitPreview = data.days.length >= 2 && data.days.length <= 6 ? resolveSplit(data) : [];
    const splitText =
      splitPreview.length > 0
        ? splitPreview.map((session) => session.title).join(" • ")
        : "Günleri seçtiğinizde haftalık salon split’i burada görünecek.";

    const restrictionText =
      data.restrictions.length > 0
        ? data.restrictions.map((key) => labelMaps.restrictions[key]).join(", ")
        : "Özel uyarı belirtilmedi";

    const daysText =
      data.days.length > 0
        ? data.days.map((day) => getDayLabel(day)).join(", ")
        : "Henüz gün seçilmedi";

    const priorityText = data.priorityMuscle === "balanced" ? "Dengeli dağılım" : getMuscleLabel(data.priorityMuscle);

    return {
      headerTitle: data.memberName ? `${data.memberName} için üye planı` : "Üye planı hazır",
      headerText: `${labelMaps.goal[data.goal] || "Hedef seçildiğinde"} odaklı, ${labelMaps.level[data.level] || "seviyeye göre"} bir salon programı hazırlanır.`,
      chips: [
        getProgramStyleSummaryLabel(data),
        getTrainingSystemLabel(data.trainingSystem),
        labelMaps.equipmentScope[data.equipmentScope] || "Ekipman kapsamı",
        `${data.duration} dakika`,
      ],
      daysText,
      splitText,
      priorityText,
      restrictionText,
    };
  }

  function describeProgram(data, split, deps) {
    const { labelMaps, getMuscleLabel, getTrainingSystemLabel } = deps;
    const splitSummary = split.map((session) => `${session.title} (${session.groups.map(getMuscleLabel).join(", ")})`).join(" • ");
    const priorityText = data.priorityMuscle === "balanced" ? "dengeli kas grubu dağılımı" : `${getMuscleLabel(data.priorityMuscle)} önceliği`;
    const restrictionText =
      data.restrictions.length > 0
        ? ` Uyarılar: ${data.restrictions.map((item) => labelMaps.restrictions[item]).join(", ")}.`
        : "";

    return `${labelMaps.goal[data.goal]} hedefi için ${priorityText} ile ${data.days.length} günlük salon programı oluşturuldu. Haftalık yapı: ${splitSummary}. Antrenman sistemi ${getTrainingSystemLabel(data.trainingSystem).toLowerCase()} olarak ayarlandı. Set/tekrar ve dinlenme aralıkları ${labelMaps.level[data.level].toLowerCase()} seviyesine göre düzenlendi.${restrictionText}`;
  }

  function buildProgression(data) {
    return [
      {
        title: "1. Hafta | Adaptasyon",
        text: "Üye hareket formunu öğrenir. Ana hareketlerde RPE 6-7, izolasyonlarda kontrollü tempo kullanılır.",
      },
      {
        title: "2. Hafta | Hacim Takibi",
        text: "Teknik bozulmuyorsa ana hareketlerde 1-2 tekrar artırılır veya küçük ağırlık artışı yapılır.",
      },
      {
        title: "3. Hafta | Gelişim Haftası",
        text:
          data.goal === "strength"
            ? "Ana kaldırışlarda yük %2,5-%5 artırılır, dinlenme süreleri kısaltılmaz."
            : "Kas kazanımı ve yağ yakımı hedefinde set kalitesi korunarak toplam hacim artırılır.",
      },
      {
        title: "4. Hafta | Kontrol ve Güncelleme",
        text: "Antrenör, üyenin ağrı, yorgunluk ve performans notlarına göre hareketleri günceller. Gerekirse hacim %15-20 azaltılır.",
      },
    ];
  }

  function buildGuidance(data, deps) {
    const { trainingSystemMap, normalizeTrainingSystem } = deps;
    const guidance = [
      {
        title: "Başlangıç Kuralı",
        text: "Üye her seansta ilk çalışma setinden önce en az 1-2 hazırlık seti yapmalıdır.",
      },
      {
        title: "Ağırlık Seçimi",
        text: "Set sonunda 1-3 tekrar daha yapılabilecek his kalıyorsa ağırlık uygundur. Teknik bozuluyorsa yük azaltılır.",
      },
      {
        title: "Salon Takibi",
        text: "Antrenör haftalık kilo, tekrar, ağrı ve yorgunluk notlarını takip ederek programı güncellemelidir.",
      },
    ];
    const trainingSystem = trainingSystemMap[normalizeTrainingSystem(data.trainingSystem)] || trainingSystemMap.standard;

    if (trainingSystem.value !== "standard") {
      guidance.push({
        title: "Antrenman Sistemi",
        text: `${trainingSystem.label} uygulanırken blok içindeki hareketler peş peşe tamamlanır. Dinlenme, programda belirtilen blok sonunda yapılmalıdır.`,
      });
    }

    if (data.goal === "fat-loss") {
      guidance.push({
        title: "Yağ Yakımı",
        text: "Ağırlık antrenmanı korunurken kardiyo bitirişleri ve günlük adım hedefi destekleyici olarak kullanılır.",
      });
    } else if (data.goal === "muscle-gain") {
      guidance.push({
        title: "Kas Kazanımı",
        text: "Üye aynı hareketlerde haftadan haftaya küçük tekrar veya ağırlık artışı hedeflemelidir.",
      });
    } else if (data.goal === "strength") {
      guidance.push({
        title: "Kuvvet",
        text: "Ana hareketlerde uzun dinlenme korunmalı, düşük kaliteli tekrarlar programa eklenmemelidir.",
      });
    }

    if (data.notes) {
      guidance.push({
        title: "Antrenör Notu",
        text: data.notes,
      });
    }

    return guidance;
  }

  window.BSMProgramContentService = {
    buildLiveSummaryModel,
    describeProgram,
    buildProgression,
    buildGuidance,
  };
})();
