// nutritionHelpers.js — Refactor Adım 3'te app.js'den extract edilen pure helpers.
// Dependency: BSM_FOOD_LIBRARY ve BSM_SUPPLEMENT_LIBRARY init() ile inject edilir.
// window.BSMNutritionHelpers altında expose edilir.

(function () {
  "use strict";

  // ── Dependencies (init ile inject edilir) ───────────────────
  var _foodLibrary = [];
  var _supplementLibrary = [];

  function init(deps) {
    _foodLibrary = Array.isArray(deps && deps.foodLibrary) ? deps.foodLibrary : [];
    _supplementLibrary = Array.isArray(deps && deps.supplementLibrary) ? deps.supplementLibrary : [];
  }

  // ── Library access helpers ──────────────────────────────────
  function findFoodById(id) {
    return _foodLibrary.find(function (f) { return f.id === id; }) || null;
  }

  function findSupplementById(id) {
    return _supplementLibrary.find(function (s) { return s.id === id; }) || null;
  }

  // Hesaplanmış makro/kcal (gramaj * Per100g/100)
  function calcFoodMacros(foodId, grams) {
    var food = findFoodById(foodId);
    if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    var g = Number(grams) || 0;
    var f = g / 100;
    return {
      calories: Math.round(food.caloriesPer100g * f),
      protein: Math.round(food.proteinPer100g * f * 10) / 10,
      carbs: Math.round(food.carbsPer100g * f * 10) / 10,
      fat: Math.round(food.fatPer100g * f * 10) / 10,
    };
  }

  // ── Pure helpers ────────────────────────────────────────────

  // Numerik biçimlendirme: "12.4 kg" / "—"
  function fmtReportMetric(v, unit) {
    if (v === null || v === undefined || v === "") return "—";
    var n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    var rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
    return rounded + (unit ? " " + unit : "");
  }

  function hasNonZeroMacros(m) {
    if (!m) return false;
    var p = Number(m.protein) || 0;
    var c = Number(m.carbs) || 0;
    var f = Number(m.fat) || 0;
    return p > 0 || c > 0 || f > 0;
  }

  // Meal foods'tan kcal/makro toplamı (library bazlı)
  function calculateMealMacros(meal) {
    if (!meal || !Array.isArray(meal.foods) || !meal.foods.length) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    var totals = meal.foods.reduce(function (acc, food) {
      if (food && food.id && Number(food.grams) > 0) {
        var macros = calcFoodMacros(food.id, food.grams);
        acc.calories += macros.calories;
        acc.protein += macros.protein;
        acc.carbs += macros.carbs;
        acc.fat += macros.fat;
      }
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    return {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
    };
  }

  // v1.3.7 — 4-katmanlı meal makro fallback chain
  function resolveMealMacros(meal) {
    if (!meal) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (meal.actualMacros && hasNonZeroMacros(meal.actualMacros)) {
      return {
        calories: Math.round(Number(meal.actualCalories) || Number(meal.calories) || 0),
        protein: Math.round(Number(meal.actualMacros.protein) || 0),
        carbs: Math.round(Number(meal.actualMacros.carbs) || 0),
        fat: Math.round(Number(meal.actualMacros.fat) || 0),
      };
    }
    if (meal.macros && hasNonZeroMacros(meal.macros)) {
      return {
        calories: Math.round(Number(meal.calories) || 0),
        protein: Math.round(Number(meal.macros.protein) || 0),
        carbs: Math.round(Number(meal.macros.carbs) || 0),
        fat: Math.round(Number(meal.macros.fat) || 0),
      };
    }
    var calc = calculateMealMacros(meal);
    if (hasNonZeroMacros(calc)) return calc;
    return { calories: Math.round(Number(meal.calories) || 0), protein: 0, carbs: 0, fat: 0 };
  }

  // HH:MM saatini delta dakika ile kaydır
  function shiftTime(hhmm, deltaMinutes) {
    if (!/^\d{2}:\d{2}$/.test(String(hhmm || ""))) return hhmm;
    var parts = String(hhmm).split(":").map(Number);
    var total = parts[0] * 60 + parts[1] + (Number(deltaMinutes) || 0);
    total = Math.max(0, Math.min(23 * 60 + 59, total));
    var nh = Math.floor(total / 60);
    var nm = total % 60;
    return String(nh).padStart(2, "0") + ":" + String(nm).padStart(2, "0");
  }

  // SVG sparkline noktaları (0-100 viewBox)
  function buildReportSparklinePoints(values) {
    var nums = values.map(function (v) { return Number(v); }).filter(function (n) { return Number.isFinite(n); });
    if (nums.length < 2) return null;
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    var range = max - min || 1;
    var step = 100 / (nums.length - 1);
    return nums.map(function (n, i) {
      var x = (i * step).toFixed(1);
      var y = (28 - ((n - min) / range) * 24).toFixed(1);
      return x + "," + y;
    }).join(" ");
  }

  // Aynısı ama PDF için isimlendirilmiş duplicate
  function buildPdfSparklinePoints(values) {
    var nums = values.map(function (v) { return Number(v); }).filter(function (n) { return Number.isFinite(n); });
    if (nums.length < 2) return null;
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    var range = max - min || 1;
    var step = 100 / (nums.length - 1);
    return nums.map(function (n, i) {
      return (i * step).toFixed(1) + "," + (28 - ((n - min) / range) * 24).toFixed(1);
    }).join(" ");
  }

  // Supplement timing → display label
  function supplementTimingLabel(timing) {
    var m = {
      "morning": "Sabah",
      "with-meals": "Öğünle birlikte",
      "pre-workout": "Antrenman öncesi",
      "post-workout": "Antrenman sonrası",
      "intra-workout": "Antrenman sırası",
      "before-sleep": "Uyku öncesi",
      "daily": "Günlük",
    };
    return m[timing] || "Günlük";
  }

  // Library category → UI filter key
  function normalizeSupplementCategoryKey(category) {
    var m = {
      "Protein": "muscle",
      "Amino Asit": "muscle",
      "Kreatin": "muscle",
      "Pre Workout": "performance",
      "Performans": "performance",
      "Post Workout": "performance",
      "Yağ Yakımı": "fat-burn",
      "Vitamin": "health",
      "Mineral": "health",
      "Sağlık": "health",
      "Uyku / Toparlanma": "recovery",
      "Eklem Desteği": "recovery",
      "Hidrasyon": "performance",
    };
    return m[category] || "health";
  }

  // Supplement timing → schedule HH:MM (formState.workoutTime'a göre)
  function getSupplementScheduleTime(supplement, formState) {
    var wake = (formState && formState.wakeTime) || "07:30";
    var firstMeal = "08:30";
    var workout = (formState && formState.workoutTime) || "18:30";
    var sleep = "23:00";
    var map = {
      "morning": wake,
      "with-meals": firstMeal,
      "pre-workout": shiftTime(workout, -30),
      "post-workout": shiftTime(workout, 60),
      "intra-workout": workout,
      "before-sleep": shiftTime(sleep, -45),
      "daily": firstMeal,
    };
    return map[supplement.timing] || firstMeal;
  }

  // Meal override key (plan.meals indexi bazlı stable id)
  function mealOverrideKey(idx) {
    return String(idx);
  }

  // Plan validUntil label (createdAtIso + 30 gün, Turkish locale)
  function buildPlanValidUntilLabel(plan) {
    var iso = plan && plan.createdAtIso;
    if (!iso) return "";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + 30);
    try {
      return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  // ── window.BSMNutritionHelpers expose ─────────────────────
  window.BSMNutritionHelpers = {
    init: init,
    // library access
    findFoodById: findFoodById,
    findSupplementById: findSupplementById,
    calcFoodMacros: calcFoodMacros,
    // meal macros
    calculateMealMacros: calculateMealMacros,
    resolveMealMacros: resolveMealMacros,
    hasNonZeroMacros: hasNonZeroMacros,
    mealOverrideKey: mealOverrideKey,
    // formatting
    fmtReportMetric: fmtReportMetric,
    // time
    shiftTime: shiftTime,
    getSupplementScheduleTime: getSupplementScheduleTime,
    // SVG points
    buildReportSparklinePoints: buildReportSparklinePoints,
    buildPdfSparklinePoints: buildPdfSparklinePoints,
    // labels
    supplementTimingLabel: supplementTimingLabel,
    normalizeSupplementCategoryKey: normalizeSupplementCategoryKey,
    buildPlanValidUntilLabel: buildPlanValidUntilLabel,
  };
})();
