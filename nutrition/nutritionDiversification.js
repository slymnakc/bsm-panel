// nutritionDiversification.js — Refactor Adım 3D.
// 3 pure diversification fonksiyonu app.js'den extract edildi.
// Davranis degisikligi yok; seed/randomization mantigi, food selection
// sirasi ve supplement scoring birebir ayni.
//
// KAPSAM:
//   - diversifyMealFoods(meal, mealIdx, seed, formState, usedProteinIds)
//     -> Meal'i food library'den alternatif besinlerle degistirir,
//        hedef makrolardan gramaj turetir, seed+mealIdx ile deterministik secim.
//   - applyDiversificationToPlan(plan, formState)
//     -> Plan.meals'in TAMAMI icin diversify uygula, sonucu mealOverrides'a yaz.
//   - buildSmartSupplementSuggestions(formState, activeMeasurement)
//     -> Hedef + IF + workout + hassasiyet + olcum bazli scoring, top 7 supplement ID.
//
// Dependency injection (init):
//   foodLibrary                    -> BSM_FOOD_LIBRARY (direct ref)
//   supplementLibrary              -> BSM_SUPPLEMENT_LIBRARY (direct ref)
//   mealOverrideKey                -> BSMNutritionHelpers.mealOverrideKey
//   normalizeSupplementCategoryKey -> BSMNutritionHelpers.normalizeSupplementCategoryKey

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _foodLibrary = [];
  var _supplementLibrary = [];
  var _mealOverrideKey = function (i) { return String(i); };
  var _normalizeSupplementCategoryKey = function (c) { return c; };

  function init(deps) {
    if (!deps) deps = {};
    if (Array.isArray(deps.foodLibrary)) _foodLibrary = deps.foodLibrary;
    if (Array.isArray(deps.supplementLibrary)) _supplementLibrary = deps.supplementLibrary;
    if (typeof deps.mealOverrideKey === "function") _mealOverrideKey = deps.mealOverrideKey;
    if (typeof deps.normalizeSupplementCategoryKey === "function") _normalizeSupplementCategoryKey = deps.normalizeSupplementCategoryKey;
  }

  // ═══════════════════════════════════════════════════════════════════
  // diversifyMealFoods — bir meal'in foods'larini library'den alternatif
  // besinlerle değiştirir. Hedef makrolardan gramaj türetilir.
  // Aynı protein gün içinde 2'den fazla tekrar etmesin diye usedProteinIds set.
  // v1.3.4
  // ═══════════════════════════════════════════════════════════════════
  function diversifyMealFoods(meal, mealIdx, seed, formState, usedProteinIds) {
    if (!meal) return meal;
    const goal = formState?.goal || "maintenance";
    // Meal tipi belirleme (saatten kaba ipucu)
    const time = meal.scheduledTime || meal.time || "12:00";
    const hour = parseInt(String(time).split(":")[0], 10) || 12;
    let mealType = "ogle";
    if (hour < 10) mealType = "kahvalti";
    else if (hour < 13) mealType = (meal.name || "").toLowerCase().includes("ara") ? "ara" : "ogle";
    else if (hour < 17) mealType = "ara";
    else if (hour < 22) mealType = "aksam";
    else mealType = "ara";
    // Pre/Post workout override
    if (meal.isPreWorkout) mealType = "preworkout";
    if (meal.isPostWorkout) mealType = "postworkout";

    // Bu meal tipine + hedefe uygun protein/karb/yag adaylari
    const tagFilter = (food, tag) => food.mealTags?.includes(tag);
    const goalFilter = (food) => food.goalTags?.includes(goal);

    const candidates = _foodLibrary.filter((f) => tagFilter(f, mealType) && goalFilter(f));
    const proteinCandidates = candidates.filter((f) => f.proteinPer100g >= 10 && !usedProteinIds.has(f.id));
    const carbCandidates = candidates.filter((f) => f.carbsPer100g >= 15 && f.proteinPer100g < 10);
    const fatCandidates = candidates.filter((f) => f.fatPer100g >= 10);

    // Seed + idx bazli secim (deterministik ama farkli her diversify'da)
    const pick = (arr, offset) => {
      if (!arr.length) return null;
      return arr[(seed + mealIdx + offset) % arr.length];
    };

    const protein = pick(proteinCandidates, 0) || pick(candidates.filter((f) => f.proteinPer100g >= 8), 0);
    const carb = pick(carbCandidates, 1) || pick(candidates.filter((f) => f.carbsPer100g >= 10), 1);
    const fat = pick(fatCandidates, 2) || pick(candidates.filter((f) => f.fatPer100g >= 5), 2);

    // Hedef makro/meal — meal'in engine'den gelen mevcut makrolari
    const targetCal = Number(meal.calories) || 500;
    const targetP = Number(meal.macros?.protein) || 30;
    const targetC = Number(meal.macros?.carbs) || 50;
    const targetF = Number(meal.macros?.fat) || 15;

    const foods = [];
    if (protein) {
      const grams = Math.round((targetP / protein.proteinPer100g) * 100 / 5) * 5;
      if (grams > 0) foods.push({ id: protein.id, grams: Math.min(grams, 300) });
      usedProteinIds.add(protein.id);
    }
    if (carb) {
      const grams = Math.round((targetC / Math.max(carb.carbsPer100g, 1)) * 100 / 10) * 10;
      if (grams > 0) foods.push({ id: carb.id, grams: Math.min(grams, 400) });
    }
    if (fat && targetF > 5) {
      const grams = Math.round((targetF / Math.max(fat.fatPer100g, 1)) * 100 / 5) * 5;
      if (grams > 0) foods.push({ id: fat.id, grams: Math.min(grams, 60) });
    }

    return foods;
  }

  // ═══════════════════════════════════════════════════════════════════
  // applyDiversificationToPlan — plan.meals'in TAMAMI icin diversify uygula.
  // Sonuc state.mealOverrides'a yazilir; applyMealOverridesToPlan recall ile
  // totals yeniden hesaplar.
  // v1.3.4
  // ═══════════════════════════════════════════════════════════════════
  function applyDiversificationToPlan(plan, formState) {
    if (!plan || !Array.isArray(plan.meals)) return;
    const seed = Number(formState?.diversifySeed) || 0;
    const usedProteinIds = new Set();
    const newOverrides = { ...(formState.mealOverrides || {}) };
    plan.meals.forEach((meal, idx) => {
      const foods = diversifyMealFoods(meal, idx, seed, formState, usedProteinIds);
      if (foods.length) {
        newOverrides[_mealOverrideKey(idx)] = {
          foods,
          name: meal.name,
          time: meal.scheduledTime || meal.time,
        };
      }
    });
    formState.mealOverrides = newOverrides;
  }

  // ═══════════════════════════════════════════════════════════════════
  // buildSmartSupplementSuggestions — hedef + IF + workout time + hassasiyet
  // bazli otomatik 5-7 supplement onerir. Manuel ekleme/cikarma user'in elinde.
  // v1.2.5
  // ═══════════════════════════════════════════════════════════════════
  function buildSmartSupplementSuggestions(formState, activeMeasurement) {
    const goal = formState?.goal || "maintenance";
    const hasWorkout = !!formState?.workoutTime;
    const fastingOn = !!formState?.fastingEnabled;
    const caffeineSensitive = formState?.caffeineSensitive === "yes";
    const lactoseSensitive = formState?.lactoseSensitive === "yes";
    const categoryFilter = Array.isArray(formState?.supplementCategories) ? formState.supplementCategories : [];

    const scores = _supplementLibrary.map((s) => {
      let score = 0;
      // Hedef eslesmesi: en kritik kriter
      if (s.goalTags.includes(goal)) score += 30;
      // Antrenman varsa pre/post/intra workout supplements'i artir
      if (hasWorkout && /workout/.test(s.timing || "")) score += 18;
      // IF aktifse intra-workout BCAA cok degerli
      if (fastingOn && s.id === "bcaa") score += 25;
      // Hassasiyet penalty
      if (caffeineSensitive && s.warnings?.includes("caffeine")) score -= 40;
      if (lactoseSensitive && s.warnings?.includes("lactose")) score -= 35;
      // Sağlık kategorisi her zaman ust seviyede onerelim (omega3, D vitamini)
      if (s.category === "Sağlık" || s.category === "Vitamin") score += 8;
      // Olcum bazli: visceral fat yuksekse omega3 ve magnezyum ekstra ag
      const visc = Number(activeMeasurement?.visceralFat || 0);
      if (visc >= 10 && (s.id === "omega3" || s.id === "magnesium")) score += 12;
      // Kategori filter — user secmisse, sadece bu kategorilere bonus
      if (categoryFilter.length) {
        const cMatch = categoryFilter.some((c) => _normalizeSupplementCategoryKey(s.category) === c);
        if (cMatch) score += 10;
      }
      return { supplement: s, score };
    });

    return scores
      .filter((x) => x.score > 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((x) => x.supplement.id);
  }

  window.BSMNutritionDiversification = {
    init: init,
    diversifyMealFoods: diversifyMealFoods,
    applyDiversificationToPlan: applyDiversificationToPlan,
    buildSmartSupplementSuggestions: buildSmartSupplementSuggestions,
  };
})();
