(function () {
  "use strict";

  const DISCLAIMER =
    "Bu plan genel sporcu beslenmesi amacıyla hazırlanmıştır. Klinik hastalık, gebelik, ilaç kullanımı veya özel sağlık durumu olan kişiler diyetisyen/hekim desteği almalıdır. Supplementler opsiyoneldir; kullanım öncesi hekim/diyetisyen görüşü önerilir.";

  const activityMultipliers = [
    { maxDays: 1, value: 1.35 },
    { maxDays: 3, value: 1.5 },
    { maxDays: 5, value: 1.65 },
    { maxDays: 7, value: 1.78 },
  ];

  function getNutritionGoals() {
    return window.BSMNutritionGoals?.getNutritionGoals?.() || [];
  }

  function calculateNutritionTargets(memberData, selectedGoalId, preferences = {}) {
    const profile = memberData?.profile || {};
    const latestMeasurement = memberData?.latestMeasurement || {};
    const activeProgram = memberData?.activeProgram || null;
    const fallbackGoalId = window.BSMNutritionGoals?.mapLegacyGoalToNutritionGoalId?.(profile.goal || activeProgram?.rawData?.goal);
    const selectedGoal = window.BSMNutritionGoals?.getNutritionGoalById?.(selectedGoalId || fallbackGoalId) || getNutritionGoals()[0];
    const trainingDays = Number(profile.days?.length || activeProgram?.sessions?.length || preferences.trainingDays || 3);
    const weight = firstNumber(latestMeasurement.weight, activeProgram?.rawData?.weight, 75);
    const height = firstNumber(latestMeasurement.height, activeProgram?.rawData?.height, 170);
    const age = firstNumber(latestMeasurement.age, calculateAgeFromBirthDate(latestMeasurement.birthDate), 35);
    const gender = normalizeGender(latestMeasurement.gender || profile.gender);
    const bmr = firstNumber(latestMeasurement.bmr) || estimateBmr({ weight, height, age, gender });
    const bmrSource = firstNumber(latestMeasurement.bmr) ? "Tanita BMR" : "Mifflin-St Jeor tahmini";
    const maintenanceCalories = Math.round(bmr * getActivityMultiplier(trainingDays));
    const adjustedDelta = adjustDeltaForMeasurement(selectedGoal.calorieDelta, selectedGoal.strategy, latestMeasurement);
    const baseCalories = Math.max(1100, Math.round(maintenanceCalories + adjustedDelta));
    const trainingDayCalories = Math.round(baseCalories * (1 + selectedGoal.trainingDayCarbBoost));
    const restDayCalories = Math.round(baseCalories * (1 - selectedGoal.restDayCarbReduction));
    const dayType = normalizeDayType(preferences.dayType);
    const targetCalories = dayType === "training" ? trainingDayCalories : dayType === "rest" ? restDayCalories : baseCalories;
    const macros = calculateMacros({
      calories: targetCalories,
      weight,
      proteinPerKg: selectedGoal.proteinPerKg,
      fatPerKg: selectedGoal.fatPerKg,
      strategy: selectedGoal.strategy,
    });

    return {
      selectedGoal,
      weight,
      height,
      age,
      gender,
      trainingDays,
      bmr,
      bmrSource,
      maintenanceCalories,
      baseCalories,
      trainingDayCalories,
      restDayCalories,
      targetCalories,
      macros,
      dayType,
    };
  }

  function generateMealPlan(targets, preferences = {}) {
    const mealCount = clamp(Number(preferences.mealCount || targets.selectedGoal?.preferredMealCount || 5), 3, 6);
    const ratios = getMealRatios(mealCount);
    const names = getMealNames(mealCount);
    const templates = getMealTemplates(targets.selectedGoal?.mealTheme || "balanced", mealCount);

    return names.map((name, index) => {
      const ratio = ratios[index] || 1 / mealCount;
      const template = templates[index] || templates[templates.length - 1];
      return {
        name,
        foods: template.foods,
        calories: Math.round(targets.targetCalories * ratio),
        protein: Math.max(8, Math.round(targets.macros.protein * ratio)),
        carbs: Math.max(8, Math.round(targets.macros.carbs * ratio)),
        fat: Math.max(4, Math.round(targets.macros.fat * ratio)),
        alternatives: template.alternatives,
      };
    });
  }

  function getSupplementsByGoal(goalId, options = {}) {
    const goal = window.BSMNutritionGoals?.getNutritionGoalById?.(goalId) || getNutritionGoals()[0];
    const database = window.BSMSupplementDatabase?.getSupplementDatabase?.() || [];
    const selectedCategories = Array.isArray(options.categories) ? options.categories.filter(Boolean) : [];
    const categoryAllowed = (item) => !selectedCategories.length || selectedCategories.includes(item.category);
    const goalTokens = new Set([goal?.id, goal?.strategy, ...(goal?.tags || [])].filter(Boolean));
    const caffeineSensitive = options.caffeineSensitive === "yes";
    const lactoseSensitive = options.lactoseSensitive === "yes";
    const limit = Number(options.limit || 7);

    return database
      .filter(categoryAllowed)
      .filter((item) => !caffeineSensitive || !/caffeine|pre workout|guarana|mate|yohimbine/i.test(item.supplementName))
      .filter((item) => !lactoseSensitive || !/whey|casein|milk|ready protein shake/i.test(item.supplementName))
      .map((item) => ({
        item,
        score:
          (item.suitableGoals.includes(goal?.id) ? 8 : 0) +
          item.suitableGoals.reduce((sum, token) => sum + (goalTokens.has(token) ? 3 : 0), 0) +
          (item.evidenceLevel === "strong" ? 2 : item.evidenceLevel === "moderate" ? 1 : 0),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.supplementName.localeCompare(b.item.supplementName, "tr"))
      .slice(0, limit)
      .map(({ item }) => ({
        ...item,
        name: item.supplementName,
        timing: item.suggestedTiming,
        note: `${item.suggestedDoseText} ${item.warningText}`,
        foodAlternative: buildFoodAlternative(item.category),
      }));
  }

  function buildNutritionPlan(member, activeProgram, preferences = {}, deps = {}) {
    const profile = member?.profile || {};
    const latestMeasurement = member?.measurements?.[0] || {};
    const fallbackGoalId = window.BSMNutritionGoals?.mapLegacyGoalToNutritionGoalId?.(profile.goal || activeProgram?.rawData?.goal);
    const selectedGoalId = preferences.nutritionGoalId || fallbackGoalId;
    const targets = calculateNutritionTargets({ profile, latestMeasurement, activeProgram }, selectedGoalId, preferences);
    const meals = generateMealPlan(targets, preferences);
    const supplements =
      preferences.useSupplements === "yes"
        ? getSupplementsByGoal(targets.selectedGoal.id, {
            categories: preferences.supplementCategories,
            caffeineSensitive: preferences.caffeineSensitive,
            lactoseSensitive: preferences.lactoseSensitive,
            limit: 7,
          })
        : [];
    const intelligence = buildNutritionIntelligence({ latestMeasurement, targets, preferences });

    return {
      id: deps.makeId ? deps.makeId("nutrition") : makeFallbackId("nutrition"),
      createdAtIso: new Date().toISOString(),
      createdAt: new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }),
      memberName: profile.memberName || "Üye",
      memberEmail: profile.memberEmail || profile.email || "",
      goal: profile.goal || activeProgram?.rawData?.goal || "maintenance",
      nutritionGoalId: targets.selectedGoal.id,
      nutritionGoalLabel: targets.selectedGoal.label,
      nutritionGoalCategory: targets.selectedGoal.category,
      nutritionStrategy: targets.selectedGoal.strategy,
      level: profile.level || activeProgram?.rawData?.level || "",
      trainingDays: targets.trainingDays,
      sourceSummary: {
        bmrSource: targets.bmrSource,
        bmr: targets.bmr,
        maintenanceCalories: targets.maintenanceCalories,
        baseCalories: targets.baseCalories,
        trainingDayCalories: targets.trainingDayCalories,
        restDayCalories: targets.restDayCalories,
        weight: targets.weight || "",
        height: targets.height || "",
        age: targets.age || "",
        gender: targets.gender || "belirsiz",
      },
      calories: targets.targetCalories,
      macros: targets.macros,
      mealCount: meals.length,
      dayType: targets.dayType,
      intelligence,
      meals,
      supplementPreferences: normalizePreferences(preferences),
      supplementNotice:
        preferences.useSupplements === "yes"
          ? "Supplement önerileri opsiyoneldir; planın ana temeli gıda düzenidir."
          : "Supplement kullanımı kapalı. Plan gıda öncelikli hazırlanmıştır.",
      supplements,
      trainerNote: buildTrainerNote(targets.selectedGoal, intelligence),
      disclaimer: DISCLAIMER,
    };
  }

  function calculateMacros({ calories, weight, proteinPerKg, fatPerKg, strategy }) {
    const safeWeight = weight || 75;
    const protein = Math.round(safeWeight * (proteinPerKg || 1.9));
    const fat = Math.round(safeWeight * (fatPerKg || 0.85));
    const minimumCarbs = strategy === "deficit" ? 70 : strategy === "performance" ? 130 : 90;
    const carbs = Math.max(minimumCarbs, Math.round((calories - protein * 4 - fat * 9) / 4));

    return { protein, carbs, fat };
  }

  function buildNutritionIntelligence({ latestMeasurement, targets, preferences }) {
    const notes = [];
    const fat = Number(latestMeasurement?.fat);
    const muscleMass = Number(latestMeasurement?.muscleMass);
    const visceralFat = Number(latestMeasurement?.visceralFat);
    const goalLabel = targets.selectedGoal?.label || "seçilen hedef";

    notes.push(`${goalLabel} için kalori hedefi ${targets.bmrSource} ve haftalık ${targets.trainingDays} antrenman gününe göre hesaplandı.`);

    if (Number.isFinite(fat) && fat >= 30) {
      notes.push("Yağ oranı yüksek göründüğü için kalori açığı kontrollü tutuldu; performansı korumak için protein yüksek planlandı.");
    }

    if (muscleMass && targets.weight && muscleMass / targets.weight < 0.38) {
      notes.push("Kas kütlesi oranı geliştirilebilir; ana öğünlerde kaliteli protein ve direnç antrenmanı önceliklendirildi.");
    }

    if (Number.isFinite(visceralFat) && visceralFat >= 13) {
      notes.push("Visceral yağ takibi için düşük/orta yoğunluklu kardiyo, düzenli uyku ve 14-21 gün ölçüm kontrolü önerilir.");
    }

    if (preferences.dayType === "training") {
      notes.push("Antrenman günü seçildiği için karbonhidratlar performans ve toparlanmayı destekleyecek şekilde düzenlendi.");
    }

    if (!latestMeasurement?.bmr) {
      notes.push("Tanita BMR bulunmadığı için hesaplama tahmini yapılmıştır; ölçüm güncellendikçe plan netleşir.");
    }

    return notes.slice(0, 5);
  }

  function buildTrainerNote(goal, intelligence) {
    const strategyText = {
      deficit: "Haftalık değişim kilo kadar bel çevresi, enerji ve antrenman performansı ile birlikte izlenmelidir.",
      surplus: "Kilo artışı kontrollü tutulmalı; yağlanma hızlanırsa kalori fazlası küçük adımlarla azaltılmalıdır.",
      maintenance: "Plan sürdürülebilir form koruma için hazırlanmıştır; ölçüm değişimine göre küçük ayarlamalar yapılabilir.",
      performance: "Performans günlerinde karbonhidrat zamanlaması ve sıvı-elektrolit dengesi takip edilmelidir.",
    };

    return `${goal?.label || "Hedef"} odağında planlandı. ${strategyText[goal?.strategy] || strategyText.maintenance} ${intelligence[0] || ""}`.trim();
  }

  function estimateBmr({ weight, height, age, gender }) {
    const base = 10 * (weight || 75) + 6.25 * (height || 170) - 5 * (age || 35);
    if (gender === "female") return Math.round(base - 161);
    if (gender === "male") return Math.round(base + 5);
    return Math.round(base - 78);
  }

  function getActivityMultiplier(trainingDays) {
    const days = Number(trainingDays) || 0;
    return activityMultipliers.find((item) => days <= item.maxDays)?.value || 1.65;
  }

  function adjustDeltaForMeasurement(delta, strategy, measurement) {
    const fat = Number(measurement?.fat);
    const visceralFat = Number(measurement?.visceralFat);

    if (strategy === "deficit" && (fat >= 32 || visceralFat >= 13)) {
      return delta - 80;
    }

    if (strategy === "surplus" && fat >= 28) {
      return Math.min(delta, 180);
    }

    return delta;
  }

  function getMealNames(count) {
    return {
      3: ["Kahvaltı", "Öğle", "Akşam"],
      4: ["Kahvaltı", "Öğle", "Ara Öğün", "Akşam"],
      5: ["Kahvaltı", "Öğle", "Ara Öğün 1", "Akşam", "Ara Öğün 2"],
      6: ["Kahvaltı", "Ara Öğün 1", "Öğle", "Ara Öğün 2", "Akşam", "Gece Öğünü"],
    }[count] || ["Kahvaltı", "Öğle", "Ara Öğün", "Akşam"];
  }

  function getMealRatios(count) {
    return {
      3: [0.3, 0.36, 0.34],
      4: [0.25, 0.32, 0.13, 0.3],
      5: [0.24, 0.28, 0.12, 0.26, 0.1],
      6: [0.21, 0.11, 0.26, 0.11, 0.23, 0.08],
    }[count] || [0.25, 0.32, 0.13, 0.3];
  }

  function getMealTemplates(theme, count) {
    const library = {
      "lower-carb": [
        meal("2 adet yumurta (100 g), lor peyniri 60 g, sebze 250 g, tam buğday ekmeği 1 dilim (30 g)", ["Yoğurt 200 g + yulaf 30 g", "Menemen 2 yumurta + sebze 200 g"]),
        meal("Tavuk göğüs 150 g pişmiş, salata 300 g, bulgur 100 g pişmiş, zeytinyağı 5 ml", ["Hindi 150 g + karabuğday 120 g", "Ton balığı 120 g + salata 300 g"]),
        meal("Yoğurt 180 g, meyve 100 g, badem 12 g", ["Kefir 250 ml", "Lor 80 g + meyve 100 g"]),
        meal("Balık 170 g pişmiş, sebze 300 g, yoğurt 150 g", ["Yağsız et 150 g + sebze 300 g", "Baklagil 180 g + yoğurt 150 g"]),
        meal("Kefir 200 ml, tarçın 2 g", ["Yoğurt 150 g", "Bitki çayı + kuruyemiş 10 g"]),
        meal("Casein/yoğurt alternatifi 150-200 g", ["Süzme yoğurt 150 g", "Kefir 200 ml"]),
      ],
      "higher-carb": [
        meal("3 adet yumurta (150 g), yulaf 70 g, muz 1 adet (120 g), süt 200 ml", ["Peynir 60 g + ekmek 90 g", "Yoğurt 250 g + granola 50 g"]),
        meal("Tavuk/et 180 g pişmiş, pirinç 220 g pişmiş, salata 250 g, zeytinyağı 10 ml", ["Hindi 180 g + makarna 200 g", "Balık 180 g + patates 300 g"]),
        meal("Yoğurt 250 g, yulaf 40 g, bal 10 g", ["Kefir 300 ml + muz 120 g", "Sandviç: ekmek 80 g + peynir 50 g"]),
        meal("Et/tavuk/balık 180 g, bulgur 220 g pişmiş, sebze 250 g", ["Köfte 160 g + patates 280 g", "Baklagil 220 g + yoğurt 200 g"]),
        meal("Süt 250 ml, ceviz 20 g, meyve 150 g", ["Kefir 250 ml + kuruyemiş 20 g", "Yoğurt 200 g + tahin 10 g"]),
        meal("Süzme yoğurt 200 g, yulaf 25 g", ["Lor 100 g + meyve 100 g", "Süt 250 ml"]),
      ],
      digestive: [
        meal("Yoğurt 220 g, yulaf 40 g, chia 8 g, meyve 120 g", ["Kefir 250 ml + yulaf 35 g", "Yumurta 2 adet + sebze 250 g"]),
        meal("Izgara tavuk 150 g, bulgur 150 g, zeytinyağlı sebze 250 g", ["Balık 160 g + patates 220 g", "Baklagil 180 g + yoğurt 150 g"]),
        meal("Kefir 250 ml, muz 100 g", ["Yoğurt 180 g + meyve 120 g", "Tam buğday tost 70 g"]),
        meal("Balık 160 g, sebze 300 g, yoğurt 150 g", ["Hindi 150 g + sebze 300 g", "Omlet 2 yumurta + salata"]),
        meal("Bitki çayı 200 ml, yoğurt 150 g", ["Kefir 200 ml", "Meyve 100 g + ceviz 10 g"]),
        meal("Kefir 200 ml", ["Yoğurt 150 g", "Süt 200 ml"]),
      ],
      practical: [
        meal("Tam buğday tost: ekmek 70 g, peynir 50 g, 1 yumurta (50 g)", ["Yoğurt 250 g + yulaf 40 g", "Omlet 2 yumurta"]),
        meal("Hazır pratik kase: tavuk 150 g, bulgur 160 g, salata 200 g", ["Ton balığı 120 g + ekmek 60 g", "Et 150 g + patates 250 g"]),
        meal("Meyve 150 g, kefir 250 ml", ["Yoğurt 200 g", "Proteinli sandviç 90 g"]),
        meal("Ev yemeği porsiyonu: protein 150 g, sebze 250 g, yoğurt 150 g", ["Baklagil 200 g + yoğurt", "Balık 160 g + salata"]),
        meal("Kuruyemiş 15 g, süt/kefir 200 ml", ["Yoğurt 150 g", "Meyve 100 g"]),
        meal("Yoğurt 150 g", ["Kefir 200 ml", "Lor 80 g"]),
      ],
    };

    const themeAliases = {
      balanced: "practical",
      "high-satiety": "lower-carb",
      "energy-dense": "higher-carb",
      "endurance-carb": "higher-carb",
      recovery: "digestive",
      periodized: "lower-carb",
    };
    const selected = library[theme] || library[themeAliases[theme]] || library.practical;
    return selected.slice(0, Math.max(count, 3));
  }

  function meal(foods, alternatives) {
    return { foods, alternatives };
  }

  function buildFoodAlternative(category) {
    if (category === "Protein destekleri") return "Tavuk/balık/et 120-150 g, yoğurt 200 g, 2 yumurta veya baklagil porsiyonu.";
    if (category === "Elektrolit / hidrasyon destekleri") return "Su, maden suyu, tuzlu ayran veya antrenman süresine göre karbonhidratlı içecek.";
    if (category === "Vitaminler" || category === "Mineraller") return "Sebze, meyve, süt ürünleri, kuruyemiş ve dengeli ana öğünler.";
    return "Öncelik düzenli öğün, yeterli su, kaliteli protein ve uyku rutini olmalıdır.";
  }

  function normalizePreferences(preferences = {}) {
    return {
      nutritionGoalId: preferences.nutritionGoalId || "",
      mealCount: clamp(Number(preferences.mealCount || 5), 3, 6),
      dayType: normalizeDayType(preferences.dayType),
      useSupplements: preferences.useSupplements === "yes" ? "yes" : "no",
      caffeineSensitive: preferences.caffeineSensitive === "yes" ? "yes" : "no",
      lactoseSensitive: preferences.lactoseSensitive === "yes" ? "yes" : "no",
      budget: ["low", "medium", "high"].includes(preferences.budget) ? preferences.budget : "medium",
      supplementCategories: Array.isArray(preferences.supplementCategories) ? preferences.supplementCategories : [],
    };
  }

  function normalizeDayType(value) {
    return ["balanced", "training", "rest"].includes(value) ? value : "balanced";
  }

  function normalizeGender(value) {
    const text = String(value || "").toLowerCase();
    if (["male", "erkek", "m"].includes(text)) return "male";
    if (["female", "kadın", "kadin", "f"].includes(text)) return "female";
    return "";
  }

  function calculateAgeFromBirthDate(value) {
    if (!value) return 0;
    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
    return age;
  }

  function firstNumber(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function makeFallbackId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.BSMNutritionPlanEngine = {
    DISCLAIMER,
    getNutritionGoals,
    calculateNutritionTargets,
    generateMealPlan,
    getSupplementsByGoal,
    buildNutritionPlan,
    normalizePreferences,
  };
})();
