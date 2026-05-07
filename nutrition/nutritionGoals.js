(function () {
  "use strict";

  const nutritionGoals = [
    goal("fat-loss-basic", "Yağ yakımı", "Yağ Yakımı", "deficit", -400, 2.1, 0.75, "balanced", ["fat-loss", "waist"]),
    goal("fat-loss-muscle-preserve", "Kas kaybetmeden yağ yakımı", "Yağ Yakımı", "deficit", -300, 2.2, 0.8, "balanced", ["fat-loss", "muscle-preserve"]),
    goal("aggressive-cut", "Agresif definasyon", "Yağ Yakımı", "deficit", -550, 2.3, 0.7, "lower-carb", ["fat-loss", "advanced"]),
    goal("slow-fat-loss", "Yavaş ve sürdürülebilir kilo kaybı", "Yağ Yakımı", "deficit", -250, 2.0, 0.85, "balanced", ["fat-loss", "beginner"]),
    goal("waist-reduction", "Bel çevresi azaltma", "Yağ Yakımı", "deficit", -350, 2.1, 0.8, "balanced", ["fat-loss", "waist"]),
    goal("abdominal-fat-reduction", "Karın yağları azaltma", "Yağ Yakımı", "deficit", -350, 2.1, 0.8, "balanced", ["fat-loss", "visceral"]),
    goal("appetite-control", "İştah kontrolü", "Yağ Yakımı", "deficit", -250, 2.0, 0.9, "high-satiety", ["fat-loss", "health"]),
    goal("female-fat-loss", "Kadın yağ yakımı", "Kadın / Erkek Özel", "deficit", -300, 2.0, 0.85, "balanced", ["fat-loss", "female"]),
    goal("male-fat-loss", "Erkek yağ yakımı", "Kadın / Erkek Özel", "deficit", -400, 2.1, 0.8, "balanced", ["fat-loss", "male"]),
    goal("menopause-weight-control", "Menopoz dönemi kilo kontrolü", "Kadın / Erkek Özel", "deficit", -250, 2.0, 0.9, "high-satiety", ["fat-loss", "female", "health"]),

    goal("muscle-gain", "Kas kazanımı", "Kas Kazanımı", "surplus", 300, 2.0, 0.9, "higher-carb", ["muscle-gain"]),
    goal("clean-bulk", "Temiz bulk", "Kas Kazanımı", "surplus", 250, 2.0, 0.85, "higher-carb", ["muscle-gain", "lean"]),
    goal("lean-bulk", "Lean bulk", "Kas Kazanımı", "surplus", 180, 2.1, 0.85, "higher-carb", ["muscle-gain", "lean"]),
    goal("weight-gain", "Kilo alma", "Kas Kazanımı", "surplus", 450, 1.9, 1.0, "energy-dense", ["muscle-gain", "weight-gain"]),
    goal("healthy-weight-gain", "Sağlıklı kilo alma", "Kas Kazanımı", "surplus", 350, 1.9, 0.95, "energy-dense", ["muscle-gain", "health"]),
    goal("hypertrophy", "Hipertrofi", "Kas Kazanımı", "surplus", 250, 2.1, 0.85, "higher-carb", ["muscle-gain", "hypertrophy"]),

    goal("recomposition", "Recomposition", "Recomposition", "maintenance", -100, 2.2, 0.8, "balanced", ["recomposition"]),
    goal("beginner-athlete", "Yeni başlayan sporcu beslenmesi", "Recomposition", "maintenance", 0, 1.8, 0.85, "balanced", ["beginner", "health"]),
    goal("advanced-athlete", "İleri seviye sporcu beslenmesi", "Recomposition", "performance", 100, 2.1, 0.85, "higher-carb", ["advanced", "performance"]),
    goal("general-health-form", "Genel sağlık ve form koruma", "Sağlık Odaklı", "maintenance", 0, 1.7, 0.9, "balanced", ["maintenance", "health"]),

    goal("strength", "Kuvvet artışı", "Performans", "performance", 250, 2.0, 0.85, "higher-carb", ["strength", "performance"]),
    goal("athletic-performance", "Atletik performans", "Performans", "performance", 150, 1.9, 0.85, "higher-carb", ["performance"]),
    goal("functional-fitness", "Fonksiyonel fitness", "Performans", "performance", 100, 1.9, 0.8, "balanced", ["conditioning", "performance"]),
    goal("training-recovery", "Antrenman toparlanması", "Performans", "performance", 100, 2.0, 0.9, "recovery", ["recovery", "performance"]),
    goal("energy-boost", "Enerji artırma", "Performans", "performance", 100, 1.8, 0.85, "higher-carb", ["energy", "performance"]),

    goal("endurance", "Dayanıklılık artışı", "Dayanıklılık", "performance", 150, 1.8, 0.8, "endurance-carb", ["endurance", "performance"]),
    goal("running-performance", "Koşu performansı", "Spor Branşı", "performance", 150, 1.7, 0.8, "endurance-carb", ["running", "endurance"]),
    goal("basketball-performance", "Basketbol performansı", "Spor Branşı", "performance", 150, 1.9, 0.8, "higher-carb", ["basketball", "performance"]),
    goal("swimming-performance", "Yüzme performansı", "Spor Branşı", "performance", 150, 1.8, 0.85, "endurance-carb", ["swimming", "endurance"]),

    goal("contest-cut", "Yarışma definasyonu", "Yarışma Hazırlığı", "deficit", -450, 2.3, 0.7, "lower-carb", ["contest", "fat-loss", "advanced"]),
    goal("classic-bodybuilding-prep", "Classic bodybuilding hazırlığı", "Yarışma Hazırlığı", "deficit", -350, 2.3, 0.75, "periodized", ["contest", "bodybuilding"]),
    goal("bikini-fitness-prep", "Bikini fitness hazırlığı", "Yarışma Hazırlığı", "deficit", -350, 2.2, 0.8, "periodized", ["contest", "female"]),
    goal("post-cycle-recovery", "Post-cycle toparlanma beslenmesi", "Sağlık Odaklı", "maintenance", 0, 2.0, 0.9, "recovery", ["recovery", "health"]),

    goal("metabolism-support", "Metabolizma hızlandırma", "Sağlık Odaklı", "maintenance", 50, 1.9, 0.85, "balanced", ["health", "energy"]),
    goal("insulin-sensitivity", "İnsülin duyarlılığı destekleme", "Sağlık Odaklı", "deficit", -150, 2.0, 0.85, "balanced", ["health", "glycemic"]),
    goal("digestion-support", "Sindirim düzenleme", "Sağlık Odaklı", "maintenance", 0, 1.7, 0.9, "digestive", ["digestive", "health"]),
    goal("sleep-quality", "Uyku kalitesi destekleme", "Sağlık Odaklı", "maintenance", 0, 1.7, 0.9, "recovery", ["sleep", "stress"]),
    goal("busy-work-life", "Yoğun iş temposuna uygun beslenme", "Sağlık Odaklı", "maintenance", 0, 1.8, 0.85, "practical", ["lifestyle", "health"]),
    goal("shift-worker", "Vardiyalı çalışan beslenmesi", "Sağlık Odaklı", "maintenance", 0, 1.8, 0.85, "practical", ["lifestyle", "sleep"]),

    goal("maintenance", "Kilo koruma", "Kilo Koruma", "maintenance", 0, 1.8, 0.85, "balanced", ["maintenance"]),
    goal("performance-maintenance", "Performans koruma", "Kilo Koruma", "performance", 50, 1.9, 0.85, "higher-carb", ["maintenance", "performance"]),
    goal("off-season-control", "Off-season form kontrolü", "Kilo Koruma", "maintenance", 50, 1.9, 0.9, "balanced", ["maintenance", "bodybuilding"]),
    goal("low-stress-maintenance", "Düşük stresli sürdürülebilir plan", "Kilo Koruma", "maintenance", 0, 1.7, 0.9, "practical", ["maintenance", "lifestyle"]),
  ];

  function goal(id, label, category, strategy, calorieDelta, proteinPerKg, fatPerKg, mealTheme, tags = []) {
    return {
      id,
      label,
      category,
      strategy,
      calorieDelta,
      proteinPerKg,
      fatPerKg,
      mealTheme,
      tags,
      trainingDayCarbBoost: ["performance", "surplus"].includes(strategy) ? 0.08 : 0.04,
      restDayCarbReduction: strategy === "deficit" ? 0.08 : 0.05,
    };
  }

  function getNutritionGoals() {
    return nutritionGoals.map((item) => ({ ...item, tags: [...item.tags] }));
  }

  function getNutritionGoalById(goalId) {
    return nutritionGoals.find((item) => item.id === goalId) || nutritionGoals[0];
  }

  function mapLegacyGoalToNutritionGoalId(goal) {
    const map = {
      "fat-loss": "fat-loss-basic",
      "muscle-gain": "muscle-gain",
      strength: "strength",
      conditioning: "functional-fitness",
      maintenance: "maintenance",
    };
    return map[goal] || "general-health-form";
  }

  window.BSMNutritionGoals = {
    getNutritionGoals,
    getNutritionGoalById,
    mapLegacyGoalToNutritionGoalId,
  };
})();
