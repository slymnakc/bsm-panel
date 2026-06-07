(function () {
  "use strict";
  const { trainingSystemOptions } = window.BSMOptionData;
const labelMaps = {
  goal: {
    "fat-loss": "Yağ yakımı",
    "muscle-gain": "Kas kazanımı",
    strength: "Kuvvet artışı",
    conditioning: "Kondisyon geliştirme",
    maintenance: "Form koruma",
  },
  level: {
    beginner: "Başlangıç",
    intermediate: "Orta seviye",
    advanced: "İleri seviye",
  },
  programStyle: {
    auto: "Otomatik salon split’i",
    "full-body": "Full body",
    "upper-lower": "Upper / Lower",
    "push-pull-legs": "Push / Pull / Legs",
    hypertrophy: "Bölgesel hipertrofi",
    "machine-circuit": "Makine ağırlıklı devre",
    "crossfit-conditioning": "CrossFit kondisyon",
    "pilates-flow": "Pilates mat / reformer",
  },
  trainingSystem: Object.fromEntries(trainingSystemOptions.map((option) => [option.value, option.label])),
  equipmentScope: {
    "full-gym": "Tam donanımlı salon",
    "standard-gym": "Standart fitness merkezi",
    "machines-only": "Makine ve cable ağırlıklı",
    "free-weights": "Serbest ağırlık ağırlıklı",
  },
  cardioPreference: {
    low: "Minimum",
    balanced: "Dengeli",
    high: "Yüksek",
  },
  restrictions: {
    knee: "Diz hassasiyeti",
    back: "Bel hassasiyeti",
    shoulder: "Omuz hassasiyeti",
    "low-impact": "Düşük etkili çalışma",
  },
  // BSM-UX-002: Periyodizasyon terminolojisi — Türkçe + parantezli İngilizce.
  // SOT: 3 tüketici (syncPeriodSummaryBadge, buildMacrocycleCoverModel,
  // buildPeriodizationSummary) buradan okur → "Manual/Manuel/manuel" tutarsızlığı
  // giderilir. DEĞER (macrocycle.model="linear") değişmez, sadece görünür label.
  periodModel: {
    linear: "Kademeli Artış (Linear)",
    manual: "Manuel Planlama",
  },
  // Deload haftası görünür etiketi. Değer (isDeload=true) değişmez.
  deload: "Hafifletme Haftası (Deload)",
  // Repetition preset görünür label'ları (Set/Tekrar adımı). Değer korunur.
  repetitionPreset: {
    hypertrophy: "Kas Gelişimi (Hypertrophy)",
    strength: "Kuvvet Gelişimi (Strength)",
  },
};
  window.BSMLabelData = {
    labelMaps,
  };
})();
