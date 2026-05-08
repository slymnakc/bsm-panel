(function () {
  "use strict";

  const DISCLAIMER =
    "Bu plan genel sporcu beslenmesi amacıyla hazırlanmıştır. Klinik hastalık, gebelik, ilaç kullanımı veya özel sağlık durumu olan kişiler diyetisyen/hekim desteği almalıdır.";

  const activityMultipliers = [
    { maxDays: 1, value: 1.35 },
    { maxDays: 3, value: 1.5 },
    { maxDays: 5, value: 1.65 },
    { maxDays: 7, value: 1.78 },
  ];

  function buildNutritionPlan(member, activeProgram, preferences = {}, deps = {}) {
    if (window.BSMNutritionPlanEngine?.buildNutritionPlan) {
      const plan = window.BSMNutritionPlanEngine.buildNutritionPlan(member, activeProgram, preferences, deps);
      console.log("NUTRITION PLAN GENERATED:", plan);
      return plan;
    }

    const profile = member?.profile || {};
    const latestMeasurement = member?.measurements?.[0] || {};
    const memberName = profile.memberName || "Üye";
    const goal = profile.goal || activeProgram?.rawData?.goal || "maintenance";
    const trainingDays = profile.days?.length || activeProgram?.sessions?.length || 3;
    const weight = firstNumber(latestMeasurement.weight, activeProgram?.rawData?.weight);
    const height = firstNumber(latestMeasurement.height, activeProgram?.rawData?.height);
    const age = firstNumber(latestMeasurement.age, calculateAgeFromBirthDate(latestMeasurement.birthDate));
    const gender = normalizeGender(latestMeasurement.gender || profile.gender);
    const bmr = firstNumber(latestMeasurement.bmr) || estimateBmr({ weight, height, age, gender });
    const bmrSource = firstNumber(latestMeasurement.bmr) ? "Tanita BMR" : "Mifflin-St Jeor tahmini";
    const maintenanceCalories = Math.round(bmr * getActivityMultiplier(trainingDays));
    const targetCalories = calculateTargetCalories({ maintenanceCalories, goal, bodyFat: latestMeasurement.fat, trainingDays });
    const macros = calculateMacros({ calories: targetCalories, weight, goal });
    const intelligence = buildNutritionIntelligence({ latestMeasurement, goal, trainingDays, usedEstimate: !firstNumber(latestMeasurement.bmr), weight, height, age });
    const meals = buildMealPlan({ targetCalories, macros, goal });
    const supplementPlan = buildSupplementPlan({ goal, trainingDays, macros, preferences });

    const plan = {
      id: deps.makeId ? deps.makeId("nutrition") : makeFallbackId("nutrition"),
      createdAtIso: new Date().toISOString(),
      createdAt: new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }),
      memberName,
      goal,
      level: profile.level || activeProgram?.rawData?.level || "",
      trainingDays,
      sourceSummary: {
        bmrSource,
        bmr,
        maintenanceCalories,
        weight: weight || "",
        height: height || "",
        age: age || "",
        gender: gender || "belirsiz",
      },
      calories: targetCalories,
      macros,
      intelligence,
      meals,
      supplementPreferences: normalizeSupplementPreferences(preferences),
      supplements: supplementPlan,
      trainerNote: buildTrainerNote(goal, intelligence),
      disclaimer: DISCLAIMER,
    };

    console.log("NUTRITION PLAN GENERATED:", plan);
    return plan;
  }

  function normalizeNutritionPlan(raw) {
    const source = raw && typeof raw === "object" ? raw : {};

    if (!Object.keys(source).length) {
      return null;
    }

    return {
      id: String(source.id || makeFallbackId("nutrition")),
      createdAtIso: source.createdAtIso || new Date().toISOString(),
      createdAt: source.createdAt || new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }),
      memberName: String(source.memberName || "Üye"),
      goal: String(source.goal || "maintenance"),
      memberEmail: String(source.memberEmail || ""),
      nutritionGoalId: String(source.nutritionGoalId || source.goal || "maintenance"),
      nutritionGoalLabel: String(source.nutritionGoalLabel || source.goal || "Kilo koruma"),
      nutritionGoalCategory: String(source.nutritionGoalCategory || "Kilo Koruma"),
      nutritionStrategy: String(source.nutritionStrategy || "maintenance"),
      level: String(source.level || ""),
      trainingDays: toNumber(source.trainingDays) || 3,
      sourceSummary: source.sourceSummary && typeof source.sourceSummary === "object" ? source.sourceSummary : {},
      calories: toNumber(source.calories) || 2000,
      macros: {
        protein: toNumber(source.macros?.protein) || 130,
        carbs: toNumber(source.macros?.carbs) || 220,
        fat: toNumber(source.macros?.fat) || 70,
      },
      mealCount: toNumber(source.mealCount) || (Array.isArray(source.meals) ? source.meals.length : 5),
      dayType: ["balanced", "training", "rest"].includes(source.dayType) ? source.dayType : "balanced",
      schedule: normalizeNutritionSchedule(source.schedule || source.supplementPreferences),
      timeline: normalizeNutritionTimeline(source.timeline),
      intelligence: Array.isArray(source.intelligence) ? source.intelligence.map(String) : [],
      meals: normalizeMeals(source.meals),
      supplementPreferences: normalizeSupplementPreferences(source.supplementPreferences),
      supplementNotice: String(source.supplementNotice || ""),
      supplementCommonWarning: String(source.supplementCommonWarning || ""),
      supplements: normalizeSupplements(source.supplements),
      trainerNote: String(source.trainerNote || ""),
      disclaimer: String(source.disclaimer || DISCLAIMER),
    };
  }

  function buildNutritionPayloadForSupabase(member, nutritionPlan) {
    const profile = member?.profile || {};
    return {
      member_id: String(member?.id || ""),
      member_name: String(profile.memberName || nutritionPlan?.memberName || ""),
      source: "bsm_panel_nutrition_v1",
      payload: nutritionPlan || {},
      created_at: new Date().toISOString(),
    };
  }

  function estimateBmr({ weight, height, age, gender }) {
    if (!weight || !height || !age) {
      return 1650;
    }

    const base = 10 * weight + 6.25 * height - 5 * age;

    if (gender === "female") {
      return Math.round(base - 161);
    }

    if (gender === "male") {
      return Math.round(base + 5);
    }

    return Math.round(base - 78);
  }

  function getActivityMultiplier(trainingDays) {
    const days = Number(trainingDays) || 0;
    return activityMultipliers.find((item) => days <= item.maxDays)?.value || 1.65;
  }

  function calculateTargetCalories({ maintenanceCalories, goal, bodyFat, trainingDays }) {
    if (goal === "fat-loss") {
      return Math.max(1200, maintenanceCalories - (bodyFat >= 30 ? 500 : 350));
    }

    if (goal === "muscle-gain" || goal === "strength") {
      return maintenanceCalories + (trainingDays >= 4 ? 350 : 250);
    }

    if (goal === "conditioning") {
      return bodyFat >= 28 ? maintenanceCalories - 200 : maintenanceCalories;
    }

    return maintenanceCalories;
  }

  function calculateMacros({ calories, weight, goal }) {
    const safeWeight = weight || 75;
    const proteinPerKg = goal === "fat-loss" ? 2.1 : goal === "maintenance" ? 1.8 : 2.0;
    const fatPerKg = goal === "fat-loss" ? 0.75 : 0.85;
    const protein = Math.round(safeWeight * proteinPerKg);
    const fat = Math.round(safeWeight * fatPerKg);
    const proteinCalories = protein * 4;
    const fatCalories = fat * 9;
    const carbs = Math.max(80, Math.round((calories - proteinCalories - fatCalories) / 4));

    return { protein, carbs, fat };
  }

  function buildNutritionIntelligence({ latestMeasurement, goal, trainingDays, usedEstimate, weight, height, age }) {
    const notes = [];
    const fat = toNumber(latestMeasurement.fat);
    const muscleMass = toNumber(latestMeasurement.muscleMass);
    const visceralFat = toNumber(latestMeasurement.visceralFat);

    if (fat >= 30) {
      notes.push("Yağ oranı yüksek göründüğü için kontrollü kalori açığı ve sürdürülebilir kardiyo desteği önerildi.");
    }

    if (muscleMass && weight && muscleMass / weight < 0.38) {
      notes.push("Kas kütlesi oranı geliştirilebilir; protein hedefi ve direnç antrenmanı önceliklendirildi.");
    }

    if (visceralFat >= 13) {
      notes.push("Visceral yağ yüksek göründüğü için düzenli kardiyo, günlük hareket ve ölçüm takibi önerildi.");
    }

    if (trainingDays >= 4) {
      notes.push("Haftalık antrenman sıklığı yüksek olduğu için karbonhidratlar performansı destekleyecek seviyede tutuldu.");
    }

    if (usedEstimate || !weight || !height || !age) {
      notes.push("Eksik veri nedeniyle tahmini plan oluşturuldu.");
    }

    if (!notes.length) {
      notes.push("Ölçüm verileri dengeli görünüyor; plan hedefe göre uygulanabilir ve 10-14 gün içinde kontrol edilebilir.");
    }

    if (goal === "fat-loss") {
      notes.push("Yağ kaybında amaç hızlı değil, sürdürülebilir düşüş ve antrenman performansını korumaktır.");
    }

    return notes;
  }

  function buildMealPlan({ targetCalories, macros, goal }) {
    const templates = goal === "fat-loss" ? fatLossMeals() : goal === "muscle-gain" || goal === "strength" ? muscleGainMeals() : balancedMeals();
    const calorieTargets = distributeCalories(targetCalories);

    return templates.map((meal, index) => ({
      ...meal,
      calories: calorieTargets[index],
      protein: Math.max(8, Math.round((macros.protein * meal.macroShare.protein) / 100)),
      carbs: Math.max(8, Math.round((macros.carbs * meal.macroShare.carbs) / 100)),
      fat: Math.max(4, Math.round((macros.fat * meal.macroShare.fat) / 100)),
    }));
  }

  function fatLossMeals() {
    return [
      meal("Kahvaltı", "2 adet yumurta (100 g), yulaf 35 g, süzme yoğurt 150 g, salatalık-domates 200 g"),
      meal("Öğle", "Tavuk göğüs 130 g pişmiş, bulgur 150 g pişmiş (5-6 yemek kaşığı), salata 250 g, zeytinyağı 5 ml"),
      meal("Ara Öğün 1", "Elma veya armut 1 orta boy (150 g), badem veya fındık 15 g"),
      meal("Akşam", "Balık veya yağsız et 150 g pişmiş, sebze yemeği 250 g, yoğurt 150 g"),
      meal("Ara Öğün 2", "Kefir 200 ml veya yoğurt 150 g, tarçın 2 g"),
    ];
  }

  function muscleGainMeals() {
    return [
      meal("Kahvaltı", "3 adet yumurta (150 g), yulaf 60 g veya tam buğday ekmeği 2 dilim (60 g), beyaz peynir 40 g, zeytin 5 adet (20 g)"),
      meal("Öğle", "Tavuk veya et 170 g pişmiş, pirinç veya bulgur 200 g pişmiş, salata 250 g, zeytinyağı 10 ml"),
      meal("Ara Öğün 1", "Yoğurt 200 g, muz 1 orta boy (120 g), yulaf 30 g veya tam buğday sandviç 1 adet (90 g)"),
      meal("Akşam", "Balık, et veya tavuk 180 g pişmiş, patates 250 g veya makarna 180 g pişmiş, salata 250 g"),
      meal("Ara Öğün 2", "Süt veya kefir 250 ml veya yoğurt 200 g, ceviz veya fındık 20 g"),
    ];
  }

  function balancedMeals() {
    return [
      meal("Kahvaltı", "2 adet yumurta (100 g), beyaz peynir 40 g, tam buğday ekmeği 1-2 dilim (30-60 g), söğüş sebze 200 g"),
      meal("Öğle", "Protein kaynağı 140 g pişmiş, bulgur veya pirinç 160 g pişmiş, salata 250 g, zeytinyağı 5 ml"),
      meal("Ara Öğün 1", "Meyve 1 porsiyon (150 g) + yoğurt 150 g veya kefir 200 ml"),
      meal("Akşam", "Protein kaynağı 150 g pişmiş, sebze 250 g, yoğurt 150 g, kontrollü karbonhidrat 100-150 g pişmiş"),
      meal("Ara Öğün 2", "Bitki çayı 200 ml, yoğurt 150 g veya kuruyemiş 15 g"),
    ];
  }

  const legacyMealPortionMap = new Map([
    ["2 yumurta, 3-4 kaşık yulaf, yoğurt, salatalık-domates", "2 adet yumurta (100 g), yulaf 35 g, süzme yoğurt 150 g, salatalık-domates 200 g"],
    ["120-150 g tavuk, 5-6 kaşık bulgur, büyük salata", "Tavuk göğüs 130 g pişmiş, bulgur 150 g pişmiş (5-6 yemek kaşığı), salata 250 g, zeytinyağı 5 ml"],
    ["1 porsiyon meyve, 10-12 badem veya fındık", "Elma veya armut 1 orta boy (150 g), badem veya fındık 15 g"],
    ["150 g balık veya yağsız et, sebze yemeği, yoğurt", "Balık veya yağsız et 150 g pişmiş, sebze yemeği 250 g, yoğurt 150 g"],
    ["Kefir veya yoğurt, tarçın", "Kefir 200 ml veya yoğurt 150 g, tarçın 2 g"],
    ["3 yumurta, yulaf veya tam buğday ekmeği, peynir, zeytin", "3 adet yumurta (150 g), yulaf 60 g veya tam buğday ekmeği 2 dilim (60 g), beyaz peynir 40 g, zeytin 5 adet (20 g)"],
    ["150-180 g tavuk/et, pirinç veya bulgur, salata", "Tavuk veya et 170 g pişmiş, pirinç veya bulgur 200 g pişmiş, salata 250 g, zeytinyağı 10 ml"],
    ["Yoğurt, muz, yulaf veya ev yapımı sandviç", "Yoğurt 200 g, muz 1 orta boy (120 g), yulaf 30 g veya tam buğday sandviç 1 adet (90 g)"],
    ["150-180 g balık/et/tavuk, patates veya makarna, salata", "Balık, et veya tavuk 180 g pişmiş, patates 250 g veya makarna 180 g pişmiş, salata 250 g"],
    ["Süt/kefir veya yoğurt, ceviz/fındık", "Süt veya kefir 250 ml veya yoğurt 200 g, ceviz veya fındık 20 g"],
    ["2 yumurta, peynir, tam buğday ekmeği, söğüş sebze", "2 adet yumurta (100 g), beyaz peynir 40 g, tam buğday ekmeği 1-2 dilim (30-60 g), söğüş sebze 200 g"],
    ["120-150 g protein kaynağı, bulgur/pirinç, salata", "Protein kaynağı 140 g pişmiş, bulgur veya pirinç 160 g pişmiş, salata 250 g, zeytinyağı 5 ml"],
    ["Meyve ve yoğurt veya kefir", "Meyve 1 porsiyon (150 g) + yoğurt 150 g veya kefir 200 ml"],
    ["Protein kaynağı, sebze, yoğurt ve kontrollü karbonhidrat", "Protein kaynağı 150 g pişmiş, sebze 250 g, yoğurt 150 g, kontrollü karbonhidrat 100-150 g pişmiş"],
    ["Bitki çayı yanında yoğurt veya küçük kuruyemiş porsiyonu", "Bitki çayı 200 ml, yoğurt 150 g veya kuruyemiş 15 g"],
  ]);

  function meal(name, foods) {
    return {
      name,
      foods,
      alternatives: buildMealAlternatives(name),
      macroShare: { protein: name === "Öğle" || name === "Akşam" ? 28 : name.includes("Ara") ? 12 : 20, carbs: name === "Öğle" || name === "Akşam" ? 28 : name.includes("Ara") ? 12 : 20, fat: name === "Öğle" || name === "Akşam" ? 24 : name.includes("Ara") ? 13 : 26 },
    };
  }

  function buildMealAlternatives(name) {
    const normalized = String(name || "").toLocaleLowerCase("tr-TR");

    if (normalized.includes("kahvalt")) {
      return [
        "Menemen: 2 yumurta (100 g) + sebze 150 g + tam buğday ekmeği 1 dilim (30 g)",
        "Lor peynirli omlet: 2 yumurta (100 g) + lor 60 g + söğüş sebze 200 g",
        "Yoğurt kasesi: yoğurt 200 g + yulaf 40 g + meyve 100 g",
      ];
    }

    if (normalized.includes("öğle") || normalized.includes("akşam")) {
      return [
        "Hindi veya tavuk 150 g pişmiş + bulgur 160 g pişmiş + salata 250 g",
        "Balık 170 g pişmiş + patates 220 g + salata 250 g",
        "Kuru baklagil 180 g pişmiş + yoğurt 150 g + salata 250 g",
      ];
    }

    return [
      "Meyve 150 g + yoğurt 150 g",
      "Kefir 200 ml + kuruyemiş 15 g",
      "Tam buğday tost: ekmek 60 g + peynir 40 g",
    ];
  }

  function distributeCalories(calories) {
    return [0.24, 0.28, 0.12, 0.26, 0.1].map((ratio) => Math.round(calories * ratio));
  }

  function buildSupplementPlan({ goal, trainingDays, macros, preferences }) {
    const prefs = normalizeSupplementPreferences(preferences);

    if (prefs.useSupplements !== "yes") {
      return [];
    }

    const supplements = [
      {
        name: prefs.lactoseSensitive === "yes" ? "Laktozsuz protein alternatifi" : "Whey protein",
        purpose: "Protein hedefini yemekle tamamlamak zor olduğunda pratik destek.",
        timing: "Antrenman sonrası veya protein düşük kalan öğünde 1 ölçek (25-30 g).",
        note:
          prefs.lactoseSensitive === "yes"
            ? "Laktoz hassasiyeti nedeniyle laktozsuz seçenek veya gıda alternatifi önceliklidir."
            : "Opsiyoneldir; günlük protein yiyeceklerle tamamlanabiliyorsa şart değildir.",
        foodAlternative: "Yoğurt 200 g, kefir 250 ml, 2 yumurta (100 g), tavuk/balık/et 120-150 g.",
      },
    ];

    if (goal === "muscle-gain" || goal === "strength" || trainingDays >= 4) {
      supplements.push({
        name: "Creatine monohydrate",
        purpose: "Kuvvet ve yüksek yoğunluklu antrenman performansını desteklemek için opsiyonel tercih.",
        timing: "Günün herhangi bir saatinde 3-5 g düzenli kullanım.",
        note: "Tıbbi durum varsa uzman görüşü alınmalıdır.",
        foodAlternative: "Kırmızı et veya balık 150-180 g doğal kaynak olarak tercih edilebilir.",
      });
    }

    supplements.push({
      name: "Omega-3",
      purpose: "Genel beslenme desteği olarak opsiyonel tercih.",
      timing: "Etiket dozuna göre, öğünle birlikte.",
      note: "Tıbbi iddia değildir; kan sulandırıcı vb. ilaç kullanımında uzman görüşü gerekir.",
      foodAlternative: "Somon/sardalya/uskumru 150 g, ceviz 20 g veya keten tohumu 10 g.",
    });

    if (prefs.caffeineSensitive !== "yes" && (goal === "conditioning" || trainingDays >= 4)) {
      supplements.push({
        name: "Kafein / pre-workout",
        purpose: "Performans odaklı günlerde uyanıklık desteği için opsiyonel.",
        timing: "Antrenmandan 30-45 dakika önce; düşük dozla başlanmalı.",
        note: "Kafein hassasiyeti, çarpıntı veya uyku problemi varsa önerilmez.",
        foodAlternative: "Türk kahvesi 1 fincan (60 ml) veya filtre kahve 200 ml.",
      });
    }

    return supplements.slice(0, 4);
  }

  function normalizeSupplementPreferences(preferences = {}) {
    const supplementCategories = Array.isArray(preferences.supplementCategories)
      ? preferences.supplementCategories.map(String).filter(Boolean)
      : [];

    return {
      nutritionGoalId: String(preferences.nutritionGoalId || ""),
      mealCount: toNumber(preferences.mealCount) || 5,
      dayType: ["balanced", "training", "rest"].includes(preferences.dayType) ? preferences.dayType : "balanced",
      wakeTime: normalizeTimeValue(preferences.wakeTime, "07:30"),
      firstMealTime: normalizeTimeValue(preferences.firstMealTime, "08:30"),
      workoutTime: normalizeTimeValue(preferences.workoutTime, "18:30"),
      sleepTime: normalizeTimeValue(preferences.sleepTime, "23:30"),
      cardioTime: normalizeTimeValue(preferences.cardioTime, ""),
      fastingEnabled: preferences.fastingEnabled === "yes" ? "yes" : "no",
      fastingWindow: ["14:10", "16:8", "18:6"].includes(preferences.fastingWindow) ? preferences.fastingWindow : "16:8",
      useSupplements: preferences.useSupplements === "yes" ? "yes" : "no",
      caffeineSensitive: preferences.caffeineSensitive === "yes" ? "yes" : "no",
      lactoseSensitive: preferences.lactoseSensitive === "yes" ? "yes" : "no",
      budget: ["low", "medium", "high"].includes(preferences.budget) ? preferences.budget : "medium",
      supplementCategories,
    };
  }

  function normalizeMeals(meals) {
    const fallback = balancedMeals().map((item, index) => ({ ...item, calories: distributeCalories(2000)[index], protein: 25, carbs: 35, fat: 12 }));
    const source = Array.isArray(meals) && meals.length ? meals : fallback;

    return source.map((mealItem, index) => ({
      name: String(mealItem.name || fallback[index]?.name || `Öğün ${index + 1}`),
      time: normalizeTimeValue(mealItem.time, ""),
      timingLabel: String(mealItem.timingLabel || mealItem.name || fallback[index]?.name || `Öğün ${index + 1}`),
      scheduleRole: String(mealItem.scheduleRole || "meal"),
      foods: upgradeLegacyMealFoods(mealItem.foods || fallback[index]?.foods || ""),
      calories: toNumber(mealItem.calories) || 0,
      protein: toNumber(mealItem.protein) || 0,
      carbs: toNumber(mealItem.carbs) || 0,
      fat: toNumber(mealItem.fat) || 0,
      macroShare: mealItem.macroShare || {},
      supports: normalizeMealSupports(mealItem.supports),
      alternatives:
        Array.isArray(mealItem.alternatives) && mealItem.alternatives.length
          ? mealItem.alternatives.map(String)
          : buildMealAlternatives(mealItem.name || fallback[index]?.name),
    }));
  }

  function normalizeMealSupports(supports) {
    return Array.isArray(supports)
      ? supports.map((item) => ({
          name: String(item.name || item.supplementName || "Supplement"),
          time: normalizeTimeValue(item.time, ""),
          usageTime: String(item.usageTime || item.timing || item.suggestedTiming || "Öğünle birlikte"),
          dose: String(item.dose || item.suggestedDoseText || item.note || ""),
          water: String(item.water || "1 bardak su"),
          purpose: String(item.purpose || "Plan hedefini desteklemek"),
          category: String(item.category || ""),
          recommendationTier: String(item.recommendationTier || "main"),
        }))
      : [];
  }

  function normalizeNutritionSchedule(schedule = {}) {
    const source = schedule && typeof schedule === "object" ? schedule : {};
    return {
      wakeTime: normalizeTimeValue(source.wakeTime, "07:30"),
      firstMealTime: normalizeTimeValue(source.firstMealTime, "08:30"),
      workoutTime: normalizeTimeValue(source.workoutTime, "18:30"),
      sleepTime: normalizeTimeValue(source.sleepTime, "23:30"),
      cardioTime: normalizeTimeValue(source.cardioTime, ""),
      fastingEnabled: source.fastingEnabled === "yes" ? "yes" : "no",
      fastingWindow: ["14:10", "16:8", "18:6"].includes(source.fastingWindow) ? source.fastingWindow : "16:8",
      trainingMoment: String(source.trainingMoment || ""),
    };
  }

  function normalizeNutritionTimeline(timeline) {
    return Array.isArray(timeline)
      ? timeline
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            time: normalizeTimeValue(item.time, ""),
            kind: String(item.kind || "meal"),
            title: String(item.title || "Plan adımı"),
            meta: String(item.meta || ""),
          }))
      : [];
  }

  function normalizeTimeValue(value, fallback = "") {
    return /^\d{2}:\d{2}$/.test(String(value || "")) ? String(value) : fallback;
  }

  function upgradeLegacyMealFoods(foods) {
    const text = String(foods || "").trim();
    return legacyMealPortionMap.get(text) || text;
  }

  function normalizeSupplements(supplements) {
    return Array.isArray(supplements)
      ? supplements.map((item) => ({
          id: String(item.id || ""),
          supplementName: String(item.supplementName || item.name || ""),
          name: String(item.name || item.supplementName || ""),
          category: String(item.category || ""),
          suitableGoals: Array.isArray(item.suitableGoals) ? item.suitableGoals.map(String) : [],
          purpose: String(item.purpose || ""),
          suggestedTiming: String(item.suggestedTiming || item.timing || ""),
          suggestedDoseText: String(item.suggestedDoseText || ""),
          warningText: String(item.warningText || ""),
          evidenceLevel: String(item.evidenceLevel || "limited"),
          isOptional: item.isOptional !== false,
          timing: String(item.timing || item.suggestedTiming || ""),
          note: String(item.note || item.warningText || ""),
          recommendationTier: String(item.recommendationTier || (item.isOptional ? "optional" : "main")),
          foodAlternative: String(item.foodAlternative || ""),
        }))
      : [];
  }

  function buildTrainerNote(goal, intelligence) {
    const goalText = {
      "fat-loss": "Kalori açığı sürdürülebilir tutulmalı; haftalık kilo ve performans birlikte izlenmeli.",
      "muscle-gain": "Protein hedefi ve antrenman sonrası öğün düzeni takip edilmeli.",
      strength: "Karbonhidratlar ana antrenman günlerinde performansı destekleyecek şekilde korunmalı.",
      conditioning: "Sıvı alımı, karbonhidrat zamanlaması ve toparlanma takip edilmeli.",
      maintenance: "Plan form koruma odaklıdır; ölçüme göre küçük ayarlamalar yapılabilir.",
    };

    return `${goalText[goal] || goalText.maintenance} ${intelligence[0] || ""}`.trim();
  }

  function firstNumber(...values) {
    for (const value of values) {
      const number = toNumber(value);
      if (number) {
        return number;
      }
    }

    return 0;
  }

  function toNumber(value) {
    if (value === "" || value === undefined || value === null) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeGender(value) {
    const text = String(value || "").toLowerCase();
    if (["male", "erkek", "m"].includes(text)) return "male";
    if (["female", "kadın", "kadin", "f"].includes(text)) return "female";
    return "";
  }

  function calculateAgeFromBirthDate(value) {
    if (!value) {
      return 0;
    }

    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) {
      return 0;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age;
  }

  function makeFallbackId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.BSMNutritionService = {
    DISCLAIMER,
    buildNutritionPlan,
    normalizeNutritionPlan,
    buildNutritionPayloadForSupabase,
  };
})();
