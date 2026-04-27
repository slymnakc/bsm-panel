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
};
  window.BSMLabelData = {
    labelMaps,
  };
})();
