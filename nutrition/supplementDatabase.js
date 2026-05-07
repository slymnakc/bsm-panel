(function () {
  "use strict";

  const categoryDefaults = {
    "Protein destekleri": {
      goals: ["muscle-gain", "clean-bulk", "lean-bulk", "hypertrophy", "fat-loss-muscle-preserve", "recomposition", "training-recovery"],
      purpose: "Günlük protein hedefini gıda ile tamamlamak zor olduğunda pratik destek sağlamak.",
      timing: "Eksik protein kalan öğünde veya antrenman sonrası.",
      dose: "Etiket porsiyonuna göre genellikle 20-30 g protein sağlayacak miktar.",
      evidence: "strong",
    },
    "Amino asitler": {
      goals: ["training-recovery", "endurance", "functional-fitness", "advanced-athlete"],
      purpose: "Antrenman çevresinde toparlanma ve protein alımını desteklemek için opsiyonel ürün.",
      timing: "Antrenman öncesi, antrenman sırasında veya protein düşük kalan günlerde.",
      dose: "Etiket porsiyonuna göre 1 servis.",
      evidence: "moderate",
    },
    "Performans destekleri": {
      goals: ["strength", "athletic-performance", "hypertrophy", "functional-fitness", "basketball-performance", "running-performance"],
      purpose: "Yüksek yoğunluklu antrenman performansını desteklemek için opsiyonel kullanım.",
      timing: "Antrenmandan 30-60 dakika önce veya günlük düzenli kullanım.",
      dose: "Etiket önerisine göre düşük dozla başlanmalı.",
      evidence: "moderate",
    },
    "Yağ yakım destekleri": {
      goals: ["fat-loss-basic", "aggressive-cut", "slow-fat-loss", "waist-reduction", "abdominal-fat-reduction", "female-fat-loss", "male-fat-loss"],
      purpose: "Kalori açığı ve hareket planına yardımcı olabilecek opsiyonel destek.",
      timing: "Gün içinde veya antrenman öncesi; toleransa göre.",
      dose: "Etiket önerisine göre, kafein hassasiyeti kontrol edilerek.",
      evidence: "limited",
    },
    Vitaminler: {
      goals: ["general-health-form", "metabolism-support", "training-recovery", "sleep-quality", "busy-work-life"],
      purpose: "Eksiklik riski veya yoğun dönemlerde genel beslenmeyi desteklemek.",
      timing: "Öğünle birlikte.",
      dose: "Kan tahlili ve uzman görüşüne göre; etiket dozunu aşmadan.",
      evidence: "moderate",
    },
    Mineraller: {
      goals: ["general-health-form", "sleep-quality", "training-recovery", "endurance", "metabolism-support"],
      purpose: "Sıvı dengesi, kas fonksiyonu ve genel beslenme desteği için opsiyonel kullanım.",
      timing: "Öğünle birlikte veya ürüne göre akşam.",
      dose: "Etiket önerisi ve bireysel ihtiyaçlara göre.",
      evidence: "moderate",
    },
    "Eklem destekleri": {
      goals: ["advanced-athlete", "running-performance", "basketball-performance", "general-health-form", "training-recovery"],
      purpose: "Yoğun antrenman dönemlerinde eklem/bağ dokusu desteği için opsiyonel ürün.",
      timing: "Öğünle birlikte düzenli kullanım.",
      dose: "Etiket önerisine göre.",
      evidence: "limited",
    },
    "Sindirim destekleri": {
      goals: ["digestion-support", "appetite-control", "busy-work-life", "general-health-form"],
      purpose: "Lif, bağırsak düzeni veya sindirim konforunu desteklemek için opsiyonel tercih.",
      timing: "Öğünle birlikte veya ürüne göre gün içinde.",
      dose: "Düşük dozla başlanıp su tüketimi artırılmalı.",
      evidence: "moderate",
    },
    "Uyku / stres destekleri": {
      goals: ["sleep-quality", "shift-worker", "training-recovery", "busy-work-life"],
      purpose: "Uyku rutini ve stres yönetimini desteklemek için opsiyonel destek.",
      timing: "Akşam veya yatmadan önce.",
      dose: "Etiket önerisine göre; düşük dozla başlanmalı.",
      evidence: "limited",
    },
    "Kadın sağlığı destekleri": {
      goals: ["female-fat-loss", "menopause-weight-control", "bikini-fitness-prep", "general-health-form"],
      purpose: "Kadınlara özel dönemsel ihtiyaçlarda genel destek olarak değerlendirilebilir.",
      timing: "Öğünle birlikte.",
      dose: "Uzman görüşü ve etiket önerisine göre.",
      evidence: "limited",
    },
    "Erkek sağlığı destekleri": {
      goals: ["male-fat-loss", "strength", "classic-bodybuilding-prep", "general-health-form"],
      purpose: "Erkeklere özel genel sağlık ve performans hedeflerinde opsiyonel destek.",
      timing: "Öğünle birlikte.",
      dose: "Uzman görüşü ve etiket önerisine göre.",
      evidence: "limited",
    },
    "Genel sağlık destekleri": {
      goals: ["general-health-form", "metabolism-support", "insulin-sensitivity", "training-recovery", "maintenance"],
      purpose: "Genel beslenme kalitesini desteklemek için opsiyonel kullanım.",
      timing: "Öğünle birlikte.",
      dose: "Etiket önerisine göre.",
      evidence: "moderate",
    },
    "Elektrolit / hidrasyon destekleri": {
      goals: ["endurance", "running-performance", "swimming-performance", "basketball-performance", "functional-fitness"],
      purpose: "Terleme ve uzun antrenmanlarda sıvı-elektrolit dengesini desteklemek.",
      timing: "Antrenman öncesi, sırasında veya sonrasında.",
      dose: "Terleme miktarı ve etiket önerisine göre.",
      evidence: "strong",
    },
  };

  const supplementNamesByCategory = {
    "Protein destekleri": [
      "Whey Protein", "Whey Isolate", "Whey Hydrolysate", "Casein", "Beef Protein", "Vegan Protein",
      "Pea Protein", "Rice Protein", "Egg White Protein", "Protein Bar", "Ready Protein Shake", "Clear Whey",
    ],
    "Amino asitler": [
      "EAA", "BCAA", "Leucine", "L-Glutamine", "Taurine", "L-Tyrosine", "L-Glycine", "L-Lysine",
      "L-Theanine", "Ornithine", "Alanine", "Essential Amino Blend",
    ],
    "Performans destekleri": [
      "Creatine Monohydrate", "Creatine HCL", "Beta Alanine", "Citrulline Malate", "L-Citrulline",
      "Arginine", "Caffeine", "Beetroot", "Sodium Bicarbonate", "HMB", "Dextrose", "Maltodextrin",
      "Carb Powder", "Intra Workout", "Pre Workout", "Peak ATP", "Ribose", "Glycerol",
    ],
    "Yağ yakım destekleri": [
      "L-Carnitine", "Green Tea Extract", "CLA", "Caffeine + Green Tea", "Capsaicin", "Yohimbine",
      "Forskolin", "Garcinia Cambogia", "Yerba Mate", "Guarana", "Chromium Picolinate", "Apple Cider Vinegar",
    ],
    Vitaminler: [
      "Multivitamin", "Vitamin D3", "Vitamin C", "Vitamin B Complex", "Vitamin B12", "Vitamin B6",
      "Vitamin A", "Vitamin E", "Vitamin K2", "Folate", "Biotin", "Niacin", "Riboflavin", "Thiamine",
    ],
    Mineraller: [
      "Magnesium", "Magnesium Glycinate", "Zinc", "Calcium", "Iron", "Potassium", "Sodium",
      "Selenium", "Iodine", "Chromium", "Boron", "Copper", "Manganese", "Trace Mineral Blend",
    ],
    "Eklem destekleri": [
      "Collagen", "Hydrolyzed Collagen", "Glucosamine", "Chondroitin", "MSM", "Turmeric",
      "Boswellia", "Hyaluronic Acid", "UC-II Collagen", "Gelatin + Vitamin C",
    ],
    "Sindirim destekleri": [
      "Probiotic", "Prebiotic", "Digestive Enzyme", "Fiber/Psyllium", "Inulin", "L-Glutamine Gut Support",
      "Ginger", "Peppermint Oil", "Betaine HCL", "Lactase Enzyme", "Aloe Vera", "Fennel Extract",
    ],
    "Uyku / stres destekleri": [
      "Melatonin", "Ashwagandha", "Rhodiola", "Magnesium Sleep Blend", "GABA", "L-Theanine Sleep",
      "Valerian Root", "Passionflower", "Chamomile Extract", "5-HTP", "Phosphatidylserine",
    ],
    "Kadın sağlığı destekleri": [
      "Cranberry", "Inositol", "Evening Primrose Oil", "Folate Women", "Iron Women", "Calcium + D3",
      "Vitex", "Collagen Beauty Blend", "D-Mannose", "Myo-Inositol",
    ],
    "Erkek sağlığı destekleri": [
      "Maca", "Saw Palmetto", "ZMA", "Boron Men", "Zinc Men", "Tribulus", "Fenugreek",
      "Lycopene", "Pumpkin Seed Oil", "D-Aspartic Acid",
    ],
    "Genel sağlık destekleri": [
      "Omega 3", "CoQ10", "NAC", "Alpha Lipoic Acid", "Berberine", "Milk Thistle", "Resveratrol",
      "Quercetin", "Garlic Extract", "Spirulina", "Chlorella", "Curcumin", "Astaxanthin", "Lutein",
    ],
    "Elektrolit / hidrasyon destekleri": [
      "Electrolyte Blend", "Sodium Tabs", "Potassium Citrate", "Magnesium Citrate", "Coconut Water Powder",
      "Hydration Tablet", "ORS Blend", "Sea Salt Capsules", "Endurance Electrolyte", "Carb + Electrolyte Drink",
    ],
  };

  const cautionText =
    "Opsiyoneldir. İlaç kullanan, hamile/emziren, kronik hastalığı olan veya özel sağlık durumu bulunan kişiler kullanım öncesi hekim/diyetisyen görüşü almalıdır.";

  const supplementDatabase = Object.entries(supplementNamesByCategory).flatMap(([category, names]) =>
    names.map((supplementName, index) => buildSupplement(supplementName, category, index)),
  );

  function buildSupplement(supplementName, category, index) {
    const defaults = categoryDefaults[category] || categoryDefaults["Genel sağlık destekleri"];
    const strongNames = new Set(["Whey Protein", "Creatine Monohydrate", "Caffeine", "Electrolyte Blend", "Sodium Tabs", "Vitamin D3", "Omega 3", "Fiber/Psyllium"]);
    const limitedCategories = new Set(["Yağ yakım destekleri", "Kadın sağlığı destekleri", "Erkek sağlığı destekleri", "Uyku / stres destekleri"]);

    return {
      id: slugify(`${category}-${supplementName}`),
      supplementName,
      category,
      suitableGoals: [...defaults.goals],
      purpose: defaults.purpose,
      suggestedTiming: defaults.timing,
      suggestedDoseText: defaults.dose,
      warningText: cautionText,
      evidenceLevel: strongNames.has(supplementName) ? "strong" : limitedCategories.has(category) || index % 5 === 0 ? "limited" : defaults.evidence,
      isOptional: true,
    };
  }

  function slugify(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getSupplementDatabase() {
    return supplementDatabase.map((item) => ({ ...item, suitableGoals: [...item.suitableGoals] }));
  }

  function getSupplementCategories() {
    return Object.keys(supplementNamesByCategory);
  }

  window.BSMSupplementDatabase = {
    getSupplementDatabase,
    getSupplementCategories,
  };
})();
