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
      level: String(source.level || ""),
      trainingDays: toNumber(source.trainingDays) || 3,
      sourceSummary: source.sourceSummary && typeof source.sourceSummary === "object" ? source.sourceSummary : {},
      calories: toNumber(source.calories) || 2000,
      macros: {
        protein: toNumber(source.macros?.protein) || 130,
        carbs: toNumber(source.macros?.carbs) || 220,
        fat: toNumber(source.macros?.fat) || 70,
      },
      intelligence: Array.isArray(source.intelligence) ? source.intelligence.map(String) : [],
      meals: normalizeMeals(source.meals),
      supplementPreferences: normalizeSupplementPreferences(source.supplementPreferences),
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
      meal("Kahvaltı", "2 yumurta, 3-4 kaşık yulaf, yoğurt, salatalık-domates"),
      meal("Öğle", "120-150 g tavuk, 5-6 kaşık bulgur, büyük salata"),
      meal("Ara Öğün 1", "1 porsiyon meyve, 10-12 badem veya fındık"),
      meal("Akşam", "150 g balık veya yağsız et, sebze yemeği, yoğurt"),
      meal("Ara Öğün 2", "Kefir veya yoğurt, tarçın"),
    ];
  }

  function muscleGainMeals() {
    return [
      meal("Kahvaltı", "3 yumurta, yulaf veya tam buğday ekmeği, peynir, zeytin"),
      meal("Öğle", "150-180 g tavuk/et, pirinç veya bulgur, salata"),
      meal("Ara Öğün 1", "Yoğurt, muz, yulaf veya ev yapımı sandviç"),
      meal("Akşam", "150-180 g balık/et/tavuk, patates veya makarna, salata"),
      meal("Ara Öğün 2", "Süt/kefir veya yoğurt, ceviz/fındık"),
    ];
  }

  function balancedMeals() {
    return [
      meal("Kahvaltı", "2 yumurta, peynir, tam buğday ekmeği, söğüş sebze"),
      meal("Öğle", "120-150 g protein kaynağı, bulgur/pirinç, salata"),
      meal("Ara Öğün 1", "Meyve ve yoğurt veya kefir"),
      meal("Akşam", "Protein kaynağı, sebze, yoğurt ve kontrollü karbonhidrat"),
      meal("Ara Öğün 2", "Bitki çayı yanında yoğurt veya küçük kuruyemiş porsiyonu"),
    ];
  }

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
      return ["Menemen + tam buğday ekmeği", "Lor peynirli omlet", "Yoğurt + yulaf + meyve"];
    }

    if (normalized.includes("öğle") || normalized.includes("akşam")) {
      return ["Hindi/tavuk + bulgur", "Balık + salata + patates", "Kuru baklagil + yoğurt + salata"];
    }

    return ["Meyve + yoğurt", "Kefir + kuruyemiş", "Tam buğday tost"];
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
        timing: "Antrenman sonrası veya protein düşük kalan öğünde.",
        note:
          prefs.lactoseSensitive === "yes"
            ? "Laktoz hassasiyeti nedeniyle laktozsuz seçenek veya gıda alternatifi önceliklidir."
            : "Opsiyoneldir; günlük protein yiyeceklerle tamamlanabiliyorsa şart değildir.",
        foodAlternative: "Yoğurt, kefir, yumurta, tavuk, balık veya et.",
      },
    ];

    if (goal === "muscle-gain" || goal === "strength" || trainingDays >= 4) {
      supplements.push({
        name: "Creatine monohydrate",
        purpose: "Kuvvet ve yüksek yoğunluklu antrenman performansını desteklemek için opsiyonel tercih.",
        timing: "Günün herhangi bir saatinde düzenli kullanım.",
        note: "Tıbbi durum varsa uzman görüşü alınmalıdır.",
        foodAlternative: "Kırmızı et ve balık kreatin içeren doğal kaynaklardır.",
      });
    }

    supplements.push({
      name: "Omega-3",
      purpose: "Genel beslenme desteği olarak opsiyonel tercih.",
      timing: "Öğünle birlikte.",
      note: "Tıbbi iddia değildir; kan sulandırıcı vb. ilaç kullanımında uzman görüşü gerekir.",
      foodAlternative: "Somon, sardalya, uskumru, ceviz ve keten tohumu.",
    });

    if (prefs.caffeineSensitive !== "yes" && (goal === "conditioning" || trainingDays >= 4)) {
      supplements.push({
        name: "Kafein / pre-workout",
        purpose: "Performans odaklı günlerde uyanıklık desteği için opsiyonel.",
        timing: "Antrenmandan 30-45 dakika önce.",
        note: "Kafein hassasiyeti, çarpıntı veya uyku problemi varsa önerilmez.",
        foodAlternative: "Türk kahvesi veya filtre kahve.",
      });
    }

    return supplements.slice(0, 4);
  }

  function normalizeSupplementPreferences(preferences = {}) {
    return {
      useSupplements: preferences.useSupplements === "yes" ? "yes" : "no",
      caffeineSensitive: preferences.caffeineSensitive === "yes" ? "yes" : "no",
      lactoseSensitive: preferences.lactoseSensitive === "yes" ? "yes" : "no",
      budget: ["low", "medium", "high"].includes(preferences.budget) ? preferences.budget : "medium",
    };
  }

  function normalizeMeals(meals) {
    const fallback = balancedMeals().map((item, index) => ({ ...item, calories: distributeCalories(2000)[index], protein: 25, carbs: 35, fat: 12 }));
    const source = Array.isArray(meals) && meals.length ? meals : fallback;

    return source.map((mealItem, index) => ({
      name: String(mealItem.name || fallback[index]?.name || `Öğün ${index + 1}`),
      foods: String(mealItem.foods || ""),
      calories: toNumber(mealItem.calories) || 0,
      protein: toNumber(mealItem.protein) || 0,
      carbs: toNumber(mealItem.carbs) || 0,
      fat: toNumber(mealItem.fat) || 0,
      macroShare: mealItem.macroShare || {},
    }));
  }

  function normalizeSupplements(supplements) {
    return Array.isArray(supplements)
      ? supplements.map((item) => ({
          name: String(item.name || ""),
          purpose: String(item.purpose || ""),
          timing: String(item.timing || ""),
          note: String(item.note || ""),
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
