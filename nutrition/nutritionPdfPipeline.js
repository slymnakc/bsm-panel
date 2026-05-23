// nutritionPdfPipeline.js — Refactor Adım 3 part 2.
// PDF preview + Print Root + page renderer'lar app.js'den extract edildi.
// Davranış değişikliği yok; HTML output birebir aynı.
//
// Dependency injection (init):
//   state                       → window.state objesi (closure'dan)
//   escapeHtml                  → core utils escapeHtml
//   getActiveMeasurementSnapshot → measurement helper
//   helpers                     → BSMNutritionHelpers (resolveMealMacros, findSupplementById, ...)

(function () {
  "use strict";

  var _state = null;
  var _escapeHtml = function (s) { return String(s == null ? "" : s); };
  var _getActiveMeasurementSnapshot = function () { return null; };
  var _h = {}; // BSMNutritionHelpers shortcut

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    _escapeHtml = typeof deps.escapeHtml === "function" ? deps.escapeHtml : _escapeHtml;
    _getActiveMeasurementSnapshot = typeof deps.getActiveMeasurementSnapshot === "function"
      ? deps.getActiveMeasurementSnapshot
      : _getActiveMeasurementSnapshot;
    _h = deps.helpers || window.BSMNutritionHelpers || {};
  }

  // ═══════════════════════════════════════════════════════════
  // ensureMealMacrosFallback — meals macros 4-katmanlı fallback
  // ═══════════════════════════════════════════════════════════
  function ensureMealMacrosFallback(plan) {
    if (!plan || !Array.isArray(plan.meals)) return plan;
    var totalCal = plan.meals.reduce(function (s, m) { return s + (Number(m.calories) || 0); }, 0) || 1;
    var planP = Number(plan.macros && plan.macros.protein) || 0;
    var planC = Number(plan.macros && plan.macros.carbs) || 0;
    var planF = Number(plan.macros && plan.macros.fat) || 0;

    plan.meals = plan.meals.map(function (meal) {
      var actualCalories = Math.round(Number(meal.calories) || 0);
      var actualMacros = null;

      // 1) Foods'tan dinamik hesap (en guvenilir kaynak)
      var fromFoods = _h.calculateMealMacros(meal);
      if (_h.hasNonZeroMacros(fromFoods)) {
        actualMacros = { protein: fromFoods.protein, carbs: fromFoods.carbs, fat: fromFoods.fat };
        if (fromFoods.calories > 0) actualCalories = fromFoods.calories;
      }

      // 2) Engine/override macros
      if (!actualMacros && meal.macros && _h.hasNonZeroMacros(meal.macros)) {
        actualMacros = {
          protein: Math.round(Number(meal.macros.protein) || 0),
          carbs: Math.round(Number(meal.macros.carbs) || 0),
          fat: Math.round(Number(meal.macros.fat) || 0),
        };
      }

      // 3) Plan total ratio (oranla daĝıt)
      if (!actualMacros) {
        var ratio = actualCalories / totalCal;
        var p = Math.round(planP * ratio);
        var c = Math.round(planC * ratio);
        var f = Math.round(planF * ratio);
        if (p > 0 || c > 0 || f > 0) actualMacros = { protein: p, carbs: c, fat: f };
      }

      // 4) Son care: kaloriden 30/45/25 split
      if (!actualMacros) {
        actualMacros = {
          protein: Math.round((actualCalories * 0.30) / 4),
          carbs: Math.round((actualCalories * 0.45) / 4),
          fat: Math.round((actualCalories * 0.25) / 9),
        };
      }

      return Object.assign({}, meal, {
        calories: actualCalories,
        actualCalories: actualCalories,
        actualMacros: actualMacros,
        macros: meal.macros && _h.hasNonZeroMacros(meal.macros) ? meal.macros : actualMacros,
      });
    });
    return plan;
  }

  // ═══════════════════════════════════════════════════════════
  // SVG/Chart builders
  // ═══════════════════════════════════════════════════════════
  function buildKcalBarChart(meals) {
    var items = (Array.isArray(meals) ? meals : []).filter(function (m) { return Number(m && m.calories) > 0; });
    if (!items.length) return '<p class="bsm-nutrition-pdf-page__empty">Öğün verisi yok.</p>';
    var maxCal = Math.max.apply(null, items.map(function (m) { return Number(m.calories) || 0; })) || 1;
    var barWidth = Math.max(20, Math.floor(280 / items.length) - 8);
    var bars = items.map(function (meal, i) {
      var cal = Number(meal.calories) || 0;
      var h = Math.max(4, (cal / maxCal) * 70);
      var x = i * (barWidth + 8) + 10;
      var y = 85 - h;
      var isPre = meal.isPreWorkout;
      var isPost = meal.isPostWorkout;
      var color = isPre || isPost ? "#f26c1f" : "#2563eb";
      return '<g>'
        + '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + h + '" rx="4" fill="' + color + '" opacity="0.85"/>'
        + '<text x="' + (x + barWidth / 2) + '" y="' + (y - 4) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#111827">' + cal + '</text>'
        + '<text x="' + (x + barWidth / 2) + '" y="98" text-anchor="middle" font-size="7" fill="#6b7280">' + _escapeHtml(meal.scheduledTime || meal.time || "—") + '</text>'
        + '<text x="' + (x + barWidth / 2) + '" y="107" text-anchor="middle" font-size="6" fill="#9ca3af">' + _escapeHtml((meal.name || "").slice(0, 8)) + '</text>'
        + '</g>';
    }).join("");
    return '<div class="bsm-pdf-bar-chart">'
      + '<svg viewBox="0 0 320 110" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
      + bars
      + '<line x1="6" y1="85" x2="320" y2="85" stroke="rgba(17,24,39,0.12)" stroke-width="0.5"/>'
      + '</svg></div>';
  }

  function buildWaterProgressRing(weight) {
    var target = weight ? (weight * 0.035).toFixed(1) : "2.5";
    var tNum = Number(target) || 2.5;
    var pct = Math.min(1, tNum / 4);
    var C = 251.3;
    var dash = pct * C;
    return '<div class="bsm-pdf-water-ring" aria-label="Su hedefi ' + target + ' L">'
      + '<svg viewBox="0 0 100 100" width="92" height="92" aria-hidden="true">'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#e0f2fe" stroke-width="11"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#0ea5e9" stroke-width="11" stroke-dasharray="' + dash.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="0" transform="rotate(-90 50 50)" stroke-linecap="round"/>'
      + '<text x="50" y="48" text-anchor="middle" font-size="16" font-weight="800" fill="#0c4a6e">' + target + '</text>'
      + '<text x="50" y="62" text-anchor="middle" font-size="7" fill="#0369a1" font-weight="600">LITRE</text>'
      + '</svg>'
      + '<span class="bsm-pdf-water-ring__label">Günlük su hedefi</span></div>';
  }

  function buildNutritionScoreGauge(score) {
    var arcLen = 131.94;
    var pct = Math.min(1, Math.max(0, score / 100));
    var dash = pct * arcLen;
    var color = score >= 80 ? "#16a34a" : score >= 60 ? "#f59e0b" : "#b91c1c";
    var label = score >= 80 ? "Mükemmel" : score >= 60 ? "İyi" : score >= 40 ? "Orta" : "Geliştirilebilir";
    return '<div class="bsm-pdf-score-gauge" aria-label="Beslenme skoru ' + score + '/100">'
      + '<svg viewBox="0 0 100 60" width="120" height="72" aria-hidden="true">'
      + '<path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="#f3f4f6" stroke-width="9" stroke-linecap="round"/>'
      + '<path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(2) + ' ' + arcLen.toFixed(2) + '"/>'
      + '<text x="50" y="42" text-anchor="middle" font-size="20" font-weight="800" fill="#111827">' + score + '</text>'
      + '<text x="50" y="54" text-anchor="middle" font-size="7" fill="#6b7280" font-weight="600">/100</text>'
      + '</svg>'
      + '<span class="bsm-pdf-score-gauge__label" style="color:' + color + '">' + label + '</span></div>';
  }

  // ═══════════════════════════════════════════════════════════
  // Page 1 — Hero + makro + öğün timeline + supplement özeti
  // ═══════════════════════════════════════════════════════════
  function renderPdfPage1(member, plan, profile, goalLabel, activeMeasurement, activePage) {
    var f = _state.nutritionFormState;
    var meals = Array.isArray(plan.meals) ? plan.meals : [];
    var m = plan.macros || {};
    var weight = Number((activeMeasurement && activeMeasurement.weight) || (plan && plan.sourceSummary && plan.sourceSummary.weight) || 0);
    var proteinKcal = (m.protein || 0) * 4;
    var carbsKcal = (m.carbs || 0) * 4;
    var fatKcal = (m.fat || 0) * 9;
    var total = proteinKcal + carbsKcal + fatKcal || 1;
    var C = 251.3;
    var dP = (proteinKcal / total) * C;
    var dC = (carbsKcal / total) * C;
    var dF = (fatKcal / total) * C;

    var dailyKcal = plan.calories || plan.targetCalories || _state.nutritionFormState.calories || 0;
    var planTypeLabel = plan.dayType === "training" ? "Antrenman günü" : plan.dayType === "rest" ? "Dinlenme günü" : "Dengeli gün";

    var supplArr = _state.nutritionFormState.supplementUse && Array.isArray(_state.nutritionFormState.selectedSupplements)
      ? _state.nutritionFormState.selectedSupplements.map(function (id) { return _h.findSupplementById(id); }).filter(Boolean)
      : [];

    return '<article class="bsm-pdf-v13" data-pdf-page="1"' + (activePage === "1" ? ' data-active="true"' : "") + '>'
      + '<header class="bsm-pdf-v13__head-row">'
      + '<div>'
      + '<span class="bsm-pdf-v13__brand">Bahçeşehir Spor Merkezi</span>'
      + '<h1 class="bsm-pdf-v13__title">BESLENME PERFORMANS RAPORU</h1>'
      + '<p class="bsm-pdf-v13__subtitle">' + _escapeHtml(profile.memberName || "Üye") + ' · ' + _escapeHtml(goalLabel)
      + (profile.memberCode ? ' · Üye No ' + _escapeHtml(profile.memberCode) : "")
      + (activeMeasurement && activeMeasurement.date ? ' · Son Ölçüm ' + _escapeHtml(activeMeasurement.date) : "")
      + '</p>'
      + '</div>'
      + '<div class="bsm-pdf-v13__date">' + _escapeHtml((plan.createdAt || "").split(" ").slice(0, 3).join(" ")) + '</div>'
      + '</header>'

      + '<section class="bsm-pdf-v13__kpi-strip bsm-pdf-v13__kpi-strip--6col">'
      + '<div class="bsm-pdf-v13__kpi"><small>Plan Türü</small><strong>' + _escapeHtml(planTypeLabel) + '</strong></div>'
      + '<div class="bsm-pdf-v13__kpi"><small>Öğün Sayısı</small><strong>' + _escapeHtml(String(plan.mealCount || meals.length || 0)) + '</strong></div>'
      + '<div class="bsm-pdf-v13__kpi"><small>Protein</small><strong>' + _escapeHtml(String(m.protein || 0)) + 'g</strong></div>'
      + '<div class="bsm-pdf-v13__kpi"><small>Karbonhidrat</small><strong>' + _escapeHtml(String(m.carbs || 0)) + 'g</strong></div>'
      + '<div class="bsm-pdf-v13__kpi"><small>Yağ</small><strong>' + _escapeHtml(String(m.fat || 0)) + 'g</strong></div>'
      + '<div class="bsm-pdf-v13__kpi bsm-pdf-v13__kpi--accent"><small>Günlük Kalori</small><strong>' + _escapeHtml(String(dailyKcal)) + ' kcal</strong></div>'
      + '</section>'

      + '<section class="bsm-pdf-v13__chart-row">'
      + '<div class="bsm-pdf-v13__donut-block">'
      + '<h3>Makro Dağılımı</h3>'
      + '<div class="bsm-pdf-v13__donut">'
      + '<svg viewBox="0 0 100 100" width="110" height="110" aria-hidden="true">'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" stroke-width="14"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#16a34a" stroke-width="14" stroke-dasharray="' + dP.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="0" transform="rotate(-90 50 50)"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#2563eb" stroke-width="14" stroke-dasharray="' + dC.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-dP).toFixed(2) + '" transform="rotate(-90 50 50)"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" stroke-width="14" stroke-dasharray="' + dF.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-(dP + dC)).toFixed(2) + '" transform="rotate(-90 50 50)"/>'
      + '<text x="50" y="50" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">' + (plan.calories || 0) + '</text>'
      + '<text x="50" y="62" text-anchor="middle" font-size="6" fill="#6b7280">kcal</text>'
      + '</svg>'
      + '<ul class="bsm-pdf-v13__donut-legend">'
      + '<li><span style="background:#16a34a"></span>Protein <em>' + Math.round((proteinKcal / total) * 100) + '%</em></li>'
      + '<li><span style="background:#2563eb"></span>Karb <em>' + Math.round((carbsKcal / total) * 100) + '%</em></li>'
      + '<li><span style="background:#f59e0b"></span>Yağ <em>' + Math.round((fatKcal / total) * 100) + '%</em></li>'
      + '</ul>'
      + '</div>'
      + '</div>'
      + '<div class="bsm-pdf-v13__water-block">'
      + '<h3>Hidrasyon</h3>'
      + buildWaterProgressRing(weight)
      + (f.fastingEnabled ? '<div class="bsm-pdf-v13__if-chip">IF ' + _escapeHtml(f.fastingWindow || "16:8") + '</div>' : "")
      + '</div>'
      + '</section>'

      + '<section class="bsm-pdf-v13__meals">'
      + '<h3>Günlük Öğün Akışı</h3>'
      + '<ul class="bsm-pdf-v13__meal-list">'
      + meals.slice(0, 6).map(function (meal) {
        var time = meal.scheduledTime || meal.time || "—";
        var allFoods = Array.isArray(meal.foods)
          ? meal.foods.map(function (it) {
              if (typeof it === "string") return it;
              if (it && it.displayLabel) return it.displayLabel;
              if (it && it.name && it.grams) return it.name + " " + it.grams + "g";
              return (it && it.name) || "";
            }).filter(Boolean)
          : (typeof meal.foods === "string" ? meal.foods.split(/[,·•]/).map(function (s) { return s.trim(); }).filter(Boolean) : []);
        var displayFoods = allFoods.slice(0, 2).join(" • ");
        var extra = allFoods.length > 2 ? " +" + (allFoods.length - 2) : "";
        var resolved = _h.resolveMealMacros(meal);
        var tag = meal.isPreWorkout ? "Pre" : meal.isPostWorkout ? "Post" : "";
        return '<li class="bsm-pdf-v13__meal-item' + (tag ? " is-workout" : "") + '">'
          + '<div class="bsm-pdf-v13__meal-time">' + _escapeHtml(String(time)) + '</div>'
          + '<div class="bsm-pdf-v13__meal-body">'
          + '<div class="bsm-pdf-v13__meal-head">'
          + '<strong>' + _escapeHtml(meal.name || "Öğün") + (tag ? ' <span class="bsm-pdf-v13__meal-tag">' + tag + '</span>' : "") + '</strong>'
          + '<span class="bsm-pdf-v13__meal-cal-inline">' + _escapeHtml(String(resolved.calories)) + ' kcal · P' + _escapeHtml(String(resolved.protein)) + ' K' + _escapeHtml(String(resolved.carbs)) + ' Y' + _escapeHtml(String(resolved.fat)) + '</span>'
          + '</div>'
          + (displayFoods ? '<small class="bsm-pdf-v13__meal-foods">' + _escapeHtml(displayFoods) + _escapeHtml(extra) + '</small>' : "")
          + '</div>'
          + '</li>';
      }).join("")
      + '</ul>'
      + (meals.length > 6 ? '<div class="bsm-pdf-v13__meal-overflow">+' + (meals.length - 6) + ' ek öğün — detay üyeye iletilir</div>' : "")
      + '</section>'

      + (supplArr.length
        ? '<section class="bsm-pdf-v13__suppl-summary">'
          + '<h3>Supplement Özeti</h3>'
          + '<ul class="bsm-pdf-v13__suppl-summary-list">'
          + supplArr.slice(0, 4).map(function (s) {
            return '<li>'
              + '<span class="bsm-pdf-v13__suppl-summary-time">' + _escapeHtml(_h.getSupplementScheduleTime(s, _state.nutritionFormState)) + '</span>'
              + '<span class="bsm-pdf-v13__suppl-summary-icon" aria-hidden="true">' + _escapeHtml(s.icon || "💊") + '</span>'
              + '<strong>' + _escapeHtml(s.name) + '</strong>'
              + '<em>' + _escapeHtml(s.dosage || "") + '</em>'
              + '</li>';
          }).join("")
          + (supplArr.length > 4 ? '<li class="bsm-pdf-v13__suppl-summary-more">+' + (supplArr.length - 4) + ' ek destek (detay sayfa 2)</li>' : "")
          + '</ul>'
          + '</section>'
        : "")

      + '<footer class="bsm-pdf-v13__footer">'
      + '<span>Bahçeşehir Spor Merkezi · Beslenme Performans Raporu</span>'
      + '<span class="bsm-pdf-v13__page-num">1 / 2</span>'
      + '</footer>'
      + '</article>';
  }

  // ═══════════════════════════════════════════════════════════
  // buildNutritionFeedback / buildNutritionRecommendations /
  // calculateNutritionScore — Page 2'nin yardımcıları (closure'a bağımlı değil)
  // ═══════════════════════════════════════════════════════════
  function buildNutritionFeedback(plan, formState, activeMeasurement) {
    if (!plan) return [];
    var feedback = [];
    var m = plan.macros || {};
    var weight = Number((activeMeasurement && activeMeasurement.weight) || (plan.sourceSummary && plan.sourceSummary.weight) || 75);
    var proteinPerKg = m.protein ? Number(m.protein) / weight : 0;
    var calories = plan.calories || 0;

    var goalMap = {
      "muscle-gain": { msg: "Kas kazanımı hedefi — antrenman sonrası karbonhidrat arttırıldı, kalori fazlası uygulandı.", severity: "ok", icon: "🎯" },
      "fat-loss":    { msg: "Yağ yakımı hedefi — kalori açığı uygulandı, protein yüksek tutuldu.", severity: "ok", icon: "🔥" },
      "maintenance": { msg: "Koruma hedefi — bakım kalorisi, dengeli makro dağılımı.", severity: "ok", icon: "⚖" },
      "recomposition": { msg: "Recomposition — hafif açık + yüksek protein ile çift yönlü hedef.", severity: "ok", icon: "🔄" },
    };
    var goalNote = goalMap[formState && formState.goal];
    if (goalNote) feedback.push(Object.assign({ id: "goal" }, goalNote));

    if (proteinPerKg && proteinPerKg < 1.6) {
      feedback.push({ id: "protein-low", icon: "⚠", severity: "warn", message: "Protein hedefi " + proteinPerKg.toFixed(1) + " g/kg — kas onarımı için 1.8-2.2 g/kg önerilir." });
    } else if (proteinPerKg >= 2.0) {
      feedback.push({ id: "protein-high", icon: "💪", severity: "ok", message: "Protein hedefi " + proteinPerKg.toFixed(1) + " g/kg — kas senteji için yeterli seviyede." });
    } else if (proteinPerKg >= 1.6) {
      feedback.push({ id: "protein-mid", icon: "✓", severity: "ok", message: "Protein hedefi " + proteinPerKg.toFixed(1) + " g/kg — sağlıklı aralıkta." });
    }

    if (calories && calories < 1400) {
      feedback.push({ id: "cal-low", icon: "⚠", severity: "warn", message: "Kalori hedefi çok düşük; metabolik yavaşlama riski. Açık aşamalı artırılmalı." });
    } else if (calories > 3800) {
      feedback.push({ id: "cal-high", icon: "ℹ", severity: "info", message: "Yüksek kalori hedefi — bulking aşaması için uygun, vücut yağ takibi önemli." });
    }

    var waterTarget = weight * 0.035;
    if (waterTarget < 2.5) {
      feedback.push({ id: "water-low", icon: "💧", severity: "warn", message: "Günlük hidrasyon yetersiz; en az 2.5 L su tüketilmeli." });
    } else {
      feedback.push({ id: "water-ok", icon: "💧", severity: "ok", message: "Günlük su hedefi " + waterTarget.toFixed(1) + " L — vücut ağırlığına göre optimize edildi." });
    }

    if (formState && formState.fastingEnabled) {
      feedback.push({ id: "if-on", icon: "⏱", severity: "info", message: "Intermittent Fasting (" + (formState.fastingWindow || "16:8") + ") — beslenme penceresi optimize edildi." });
    }

    if (formState && formState.workoutTime) {
      feedback.push({ id: "workout-meal", icon: "🏋", severity: "ok", message: "Antrenman saati " + formState.workoutTime + " — pre/post workout öğünleri otomatik düzenlendi." });
    }

    if (formState && formState.supplementUse && Array.isArray(formState.selectedSupplements) && formState.selectedSupplements.length) {
      feedback.push({ id: "suppl", icon: "💊", severity: "ok", message: formState.selectedSupplements.length + " supplement zaman çizgisine entegre edildi." });
    }

    if (activeMeasurement) {
      var visc = Number(activeMeasurement.visceralFat || 0);
      if (visc >= 12) {
        feedback.push({ id: "visc-high", icon: "⚠", severity: "warn", message: "Visceral yağ yüksek; düşük yoğunluklu kardiyo + 8 haftalık açık önerilir." });
      }
      var fat = Number(activeMeasurement.fat || 0);
      if (fat >= 28) {
        feedback.push({ id: "fat-high", icon: "ℹ", severity: "info", message: "Yağ oranı %28+ — protein yüksek, kalori açığı kontrollü tutuldu." });
      }
    } else {
      feedback.push({ id: "no-measurement", icon: "ℹ", severity: "info", message: "Ölçüm verisi yok; plan tahmini hesaplama ile oluşturuldu, ölçüm sonrası güncellenir." });
    }

    return feedback;
  }

  function buildNutritionRecommendations(plan, formState, activeMeasurement) {
    var goal = (formState && formState.goal) || "maintenance";
    var recs = [];
    if (goal === "muscle-gain") {
      recs.push({ icon: "💪", text: "Antrenman sonrası 30-60 dk içinde 30g protein + 50g karbonhidrat alın." });
      recs.push({ icon: "🛌", text: "Günde 7-8 saat uyku — testosteron ve büyüme hormonu için kritik." });
    } else if (goal === "fat-loss") {
      recs.push({ icon: "🚶", text: "Günlük 8-10 bin adım hedefleyin; kardiyo açığı destekler." });
      recs.push({ icon: "🥗", text: "Yüksek hacimli lifli besinleri öğünlere ekleyin (sebze, salata)." });
    } else if (goal === "recomposition") {
      recs.push({ icon: "🔄", text: "Antrenman günü kalori artır, dinlenme günü açığa düş." });
      recs.push({ icon: "💪", text: "Direnç antrenmanı haftada en az 3 kez, ilerleyici yükle." });
    } else {
      recs.push({ icon: "⚖", text: "Haftalık tartı ortalaması ±0.3 kg aralığında tutun." });
      recs.push({ icon: "🥗", text: "Tabağın yarısını sebze ile doldurun; mikrobesinleri çeşitlendirin." });
    }
    recs.push({ icon: "💧", text: "Sabah ilk iş 500ml su; öğünler arası küçük yudumlarla hedefe ulaşın." });
    recs.push({ icon: "🥚", text: "Her öğünde 25-40g protein hedefleyin; kahvaltıyı atlamayın." });
    if (activeMeasurement && activeMeasurement.visceralFat && Number(activeMeasurement.visceralFat) >= 10) {
      recs.push({ icon: "🔥", text: "Visceral yağ takibi için haftada 2 kez 30 dk düşük-orta yoğunlukta kardiyo." });
    } else {
      recs.push({ icon: "📊", text: "2 haftada bir ölçüm tekrarı plan ilerlemesini takip eder." });
    }
    return recs;
  }

  function calculateNutritionScore(plan, formState, activeMeasurement) {
    if (!plan) return { score: 0, breakdown: {} };
    var score = 50;
    var breakdown = { base: 50 };
    var m = plan.macros || {};
    var weight = Number((activeMeasurement && activeMeasurement.weight) || (plan.sourceSummary && plan.sourceSummary.weight) || 75);
    var proteinPerKg = m.protein ? Number(m.protein) / weight : 0;

    if (proteinPerKg >= 1.8 && proteinPerKg <= 2.5) { score += 15; breakdown.protein = 15; }
    else if (proteinPerKg >= 1.4) { score += 8; breakdown.protein = 8; }
    else { breakdown.protein = 0; }

    if (plan.calories >= 1500 && plan.calories <= 3500) { score += 10; breakdown.calories = 10; }
    else { breakdown.calories = 0; }

    if ((plan.meals && plan.meals.length) >= 3 && (plan.meals && plan.meals.length) <= 6) {
      score += 5; breakdown.mealCount = 5;
    }

    if (activeMeasurement && activeMeasurement.weight) { score += 10; breakdown.measurement = 10; }
    else { breakdown.measurement = 0; }

    if (formState && formState.supplementUse && (formState.selectedSupplements && formState.selectedSupplements.length) >= 3) {
      score += 5; breakdown.supplements = 5;
    }

    if (formState && formState.workoutTime) { score += 5; breakdown.workout = 5; }

    return { score: Math.min(100, Math.max(0, score)), breakdown: breakdown };
  }

  // ═══════════════════════════════════════════════════════════
  // Page 2 — Score gauge + supplement timeline + makro target + analiz
  // ═══════════════════════════════════════════════════════════
  function renderPdfPage2(member, plan, profile, activeMeasurement, activePage) {
    var f = _state.nutritionFormState;
    var meals = Array.isArray(plan.meals) ? plan.meals : [];
    var m = plan.macros || {};
    var scoreObj = calculateNutritionScore(plan, f, activeMeasurement);
    var feedback = buildNutritionFeedback(plan, f, activeMeasurement);
    var recommendations = buildNutritionRecommendations(plan, f, activeMeasurement);

    var supplements = f.supplementUse && Array.isArray(f.selectedSupplements)
      ? f.selectedSupplements.map(function (id) { return _h.findSupplementById(id); }).filter(Boolean)
      : [];
    var supplementVisible = supplements.slice(0, 6);
    var supplementOverflow = supplements.length - supplementVisible.length;
    var supplementHtml = supplementVisible.length
      ? supplementVisible.map(function (s) {
          return '<li>'
            + '<span class="bsm-pdf-v13__suppl-time">' + _escapeHtml(_h.getSupplementScheduleTime(s, f)) + '</span>'
            + '<span class="bsm-pdf-v13__suppl-icon">' + _escapeHtml(s.icon || "💊") + '</span>'
            + '<div class="bsm-pdf-v13__suppl-info">'
            + '<strong>' + _escapeHtml(s.name) + '</strong>'
            + '<em>' + _escapeHtml(s.dosage || "") + ' · ' + _escapeHtml(_h.supplementTimingLabel(s.timing)) + '</em>'
            + '</div>'
            + '</li>';
        }).join("") + (supplementOverflow > 0 ? '<li class="bsm-pdf-v13__suppl-overflow">+' + supplementOverflow + ' ek destek</li>' : "")
      : '<li class="bsm-pdf-v13__suppl-empty">Supplement planı kapalı.</li>';

    var weight = Number((activeMeasurement && activeMeasurement.weight) || (plan.sourceSummary && plan.sourceSummary.weight) || 75);
    var proteinTarget = Math.round(weight * 1.8);
    var carbsTarget = Math.round(weight * 4);
    var fatTarget = Math.round(weight * 0.9);
    var pctP = Math.min(100, Math.round(((m.protein || 0) / Math.max(1, proteinTarget)) * 100));
    var pctC = Math.min(100, Math.round(((m.carbs || 0) / Math.max(1, carbsTarget)) * 100));
    var pctF = Math.min(100, Math.round(((m.fat || 0) / Math.max(1, fatTarget)) * 100));

    var validUntil = plan.createdAt ? _h.buildPlanValidUntilLabel(plan) : "";

    // QR pattern (basit fake QR)
    var qrRows = [
      "1111111010001011111111","1000001011010001000001","1011101010110001011101",
      "1011101001110001011101","1011101010001001011101","1000001011010001000001",
      "1111111010101011111111","0000000010000000000000","1110011110001011001011",
      "0001100101100110110010","1101110001011001001111","0010001110010110100100",
      "1110011001001010011110","0000000000110001110100","1111111010001010001011",
      "1000001000100000110010","1011101010111000111000","1011101001010001011100",
      "1011101010001001000111","1000001011010010111011","1111111000110001111000",
    ];
    var qrSvg = qrRows.map(function (row, y) {
      return row.split("").map(function (c, x) {
        return c === "1" ? '<rect x="' + (x * 2) + '" y="' + (y * 2) + '" width="2" height="2" fill="#0f172a"/>' : "";
      }).join("");
    }).join("");

    return '<article class="bsm-pdf-v13" data-pdf-page="2"' + (activePage === "2" ? ' data-active="true"' : "") + '>'
      + '<header class="bsm-pdf-v13__sub-header">'
      + '<div>'
      + '<span class="bsm-pdf-v13__brand">Bahçeşehir Spor Merkezi</span>'
      + '<h2 class="bsm-pdf-v13__sub-title">ANALİZ · SUPPLEMENT · TAVSİYELER</h2>'
      + '<p>' + _escapeHtml(profile.memberName || "Üye") + '</p>'
      + '</div>'
      + buildNutritionScoreGauge(scoreObj.score)
      + '</header>'

      + '<section class="bsm-pdf-v13__row">'
      + '<div class="bsm-pdf-v13__suppl">'
      + '<h3>Supplement Zaman Çizgisi</h3>'
      + '<ul class="bsm-pdf-v13__suppl-list">' + supplementHtml + '</ul>'
      + '</div>'
      + '<div class="bsm-pdf-v13__kcal-dist">'
      + '<h3>Öğün Kalori Dağılımı</h3>'
      + buildKcalBarChart(meals)
      + '</div>'
      + '</section>'

      + '<section class="bsm-pdf-v13__macro-target">'
      + '<h3>Makro Hedef Uyumu</h3>'
      + '<div class="bsm-pdf-v13__macro-bars">'
      + '<div class="bsm-pdf-v13__macro-bar bsm-pdf-v13__macro-bar--protein">'
      + '<div class="bsm-pdf-v13__macro-bar-label"><span>Protein</span><em>' + (m.protein || 0) + 'g / ' + proteinTarget + 'g</em></div>'
      + '<div class="bsm-pdf-v13__macro-bar-track"><div class="bsm-pdf-v13__macro-bar-fill" style="width:' + pctP + '%"></div></div>'
      + '</div>'
      + '<div class="bsm-pdf-v13__macro-bar bsm-pdf-v13__macro-bar--carbs">'
      + '<div class="bsm-pdf-v13__macro-bar-label"><span>Karbonhidrat</span><em>' + (m.carbs || 0) + 'g / ' + carbsTarget + 'g</em></div>'
      + '<div class="bsm-pdf-v13__macro-bar-track"><div class="bsm-pdf-v13__macro-bar-fill" style="width:' + pctC + '%"></div></div>'
      + '</div>'
      + '<div class="bsm-pdf-v13__macro-bar bsm-pdf-v13__macro-bar--fat">'
      + '<div class="bsm-pdf-v13__macro-bar-label"><span>Yağ</span><em>' + (m.fat || 0) + 'g / ' + fatTarget + 'g</em></div>'
      + '<div class="bsm-pdf-v13__macro-bar-track"><div class="bsm-pdf-v13__macro-bar-fill" style="width:' + pctF + '%"></div></div>'
      + '</div>'
      + '</div>'
      + '</section>'

      + '<section class="bsm-pdf-v13__analysis-row">'
      + '<div class="bsm-pdf-v13__feedback">'
      + '<h3>Akıllı Analiz</h3>'
      + '<ul class="bsm-pdf-v13__feedback-list">'
      + feedback.slice(0, 4).map(function (fb) {
        return '<li class="bsm-pdf-v13__feedback-item bsm-pdf-v13__feedback-item--' + _escapeHtml(fb.severity || "info") + '">'
          + '<span class="bsm-pdf-v13__feedback-icon" aria-hidden="true">' + _escapeHtml(fb.icon || "ℹ") + '</span>'
          + '<span>' + _escapeHtml(fb.message) + '</span>'
          + '</li>';
      }).join("")
      + '</ul>'
      + '</div>'
      + '<div class="bsm-pdf-v13__recommendations">'
      + '<h3>Genel Tavsiyeler</h3>'
      + '<ul class="bsm-pdf-v13__rec-list">'
      + recommendations.slice(0, 5).map(function (r) {
        return '<li><span aria-hidden="true">' + _escapeHtml(r.icon) + '</span>' + _escapeHtml(r.text) + '</li>';
      }).join("")
      + '</ul>'
      + '</div>'
      + '</section>'

      + ((f.trainerNote || plan.trainerNote)
        ? '<section class="bsm-pdf-v13__note">'
          + '<h3>Antrenör Notu</h3>'
          + '<p class="bsm-pdf-v13__note-text">' + _escapeHtml(f.trainerNote || plan.trainerNote) + '</p>'
          + '</section>'
        : "")

      + '<section class="bsm-pdf-v13__signature">'
      + '<div class="bsm-pdf-v13__qr" aria-hidden="true">'
      + '<svg viewBox="0 0 49 49" width="56" height="56">' + qrSvg + '</svg>'
      + '</div>'
      + '<div class="bsm-pdf-v13__sig">'
      + '<div class="bsm-pdf-v13__sig-line"><span>Hazırlayan</span><em>' + _escapeHtml(profile.trainerName || "—") + '</em></div>'
      + '<div class="bsm-pdf-v13__sig-line"><span>Plan Tarihi</span><em>' + _escapeHtml((plan.createdAt || "").split(" ").slice(0, 3).join(" ")) + '</em></div>'
      + (validUntil ? '<div class="bsm-pdf-v13__sig-line"><span>Geçerlilik</span><em>' + _escapeHtml(validUntil) + '</em></div>' : "")
      + '</div>'
      + '</section>'

      + '<footer class="bsm-pdf-v13__footer">'
      + '<span>Bahçeşehir Spor Merkezi · Performans Beslenme Sistemi</span>'
      + '<span class="bsm-pdf-v13__page-num">2 / 2</span>'
      + '</footer>'
      + '</article>';
  }

  // ═══════════════════════════════════════════════════════════
  // PDF Preview canvas render
  // ═══════════════════════════════════════════════════════════
  function renderNutritionPdfPreview(member, plan) {
    var host = document.querySelector("#bsmNutritionPdfPages");
    if (!host) return;
    if (!plan) {
      host.innerHTML = '<p class="bsm-nutrition-empty">Plan oluşturulunca PDF önizleme burada görünür.</p>';
      renderNutritionPdfThumbnails(null, null);
      return;
    }
    var profile = (member && member.profile) || {};
    var activeMeasurement = _getActiveMeasurementSnapshot(member);
    var activePage = String(Math.min(2, _state.nutritionPdfPage || 1));
    var f = _state.nutritionFormState;

    var goalLabelMap = { "fat-loss": "Yağ yakımı", "muscle-gain": "Kas kazanımı", "maintenance": "Koruma", "recomposition": "Recomposition" };
    var goalLabel = goalLabelMap[f.goal] || plan.nutritionGoalLabel || "Hedef belirtilmedi";

    host.innerHTML = renderPdfPage1(member, plan, profile, goalLabel, activeMeasurement, activePage)
                   + renderPdfPage2(member, plan, profile, activeMeasurement, activePage);
    renderNutritionPdfThumbnails(plan, member);
  }

  // ═══════════════════════════════════════════════════════════
  // PDF Thumbnails
  // ═══════════════════════════════════════════════════════════
  function renderNutritionPdfThumbnails(plan, member) {
    function setHtml(sel, html) {
      var el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    }
    if (!plan) {
      [1, 2].forEach(function (n) { setHtml('[data-bsm-nutrition-thumb="' + n + '"]', ""); });
      return;
    }
    var m = plan.macros || {};
    var total = (m.protein || 1) * 4 + (m.carbs || 1) * 4 + (m.fat || 1) * 9 || 1;
    var pP = ((m.protein || 0) * 4 / total) * 100;
    var pC = ((m.carbs || 0) * 4 / total) * 100;
    setHtml('[data-bsm-nutrition-thumb="1"]',
      '<div class="bsm-nutrition-pdf-thumb__mix">'
      + '<div class="bsm-nutrition-pdf-thumb__pie bsm-nutrition-pdf-thumb__pie--sm" style="background: conic-gradient(#16a34a 0 ' + pP.toFixed(1) + '%, #2563eb ' + pP.toFixed(1) + '% ' + (pP + pC).toFixed(1) + '%, #f59e0b ' + (pP + pC).toFixed(1) + '% 100%);"></div>'
      + '<div class="bsm-nutrition-pdf-thumb__bars">'
      + '<span></span><span></span><span></span>'
      + '</div>'
      + '</div>');
    var f = _state.nutritionFormState;
    var supplActive = f && f.supplementUse && (f.selectedSupplements && f.selectedSupplements.length) > 0;
    setHtml('[data-bsm-nutrition-thumb="2"]',
      '<div class="bsm-nutrition-pdf-thumb__mix">'
      + '<div class="bsm-nutrition-pdf-thumb__rows">'
      + '<span></span><span class="' + (supplActive ? "is-on" : "") + '"></span><span class="' + (supplActive ? "is-on" : "") + '"></span>'
      + '</div>'
      + '<div class="bsm-nutrition-pdf-thumb__gauge"></div>'
      + '</div>');
    var active = String(Math.min(2, _state.nutritionPdfPage || 1));
    document.querySelectorAll("[data-pdf-thumb]").forEach(function (t) {
      t.classList.toggle("is-active", String(t.dataset.pdfThumb) === active);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Print Root — body altında temiz clone container
  // ═══════════════════════════════════════════════════════════
  function prepareNutritionPrintRoot(member, plan) {
    cleanupNutritionPrintRoot();
    var profile = (member && member.profile) || {};
    var activeMeasurement = _getActiveMeasurementSnapshot(member);
    var goalLabelMap = { "fat-loss": "Yağ yakımı", "muscle-gain": "Kas kazanımı", "maintenance": "Koruma", "recomposition": "Recomposition" };
    var goalLabel = goalLabelMap[_state.nutritionFormState.goal] || plan.nutritionGoalLabel || "Hedef belirtilmedi";

    var page1Html = renderPdfPage1(member, plan, profile, goalLabel, activeMeasurement, "1");
    var page2Html = renderPdfPage2(member, plan, profile, activeMeasurement, "2");

    var root = document.createElement("div");
    root.id = "nutritionPrintRoot";
    root.className = "nutrition-print-root";
    root.innerHTML = '<section class="nutrition-print-page nutrition-print-page--1">' + page1Html + '</section>'
                   + '<section class="nutrition-print-page nutrition-print-page--2">' + page2Html + '</section>';
    if (document.body.firstChild) {
      document.body.insertBefore(root, document.body.firstChild);
    } else {
      document.body.appendChild(root);
    }
  }

  function cleanupNutritionPrintRoot() {
    var existing = document.getElementById("nutritionPrintRoot");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Expose
  // ═══════════════════════════════════════════════════════════
  window.BSMNutritionPdfPipeline = {
    init: init,
    ensureMealMacrosFallback: ensureMealMacrosFallback,
    buildKcalBarChart: buildKcalBarChart,
    buildWaterProgressRing: buildWaterProgressRing,
    buildNutritionScoreGauge: buildNutritionScoreGauge,
    buildNutritionFeedback: buildNutritionFeedback,
    buildNutritionRecommendations: buildNutritionRecommendations,
    calculateNutritionScore: calculateNutritionScore,
    renderPdfPage1: renderPdfPage1,
    renderPdfPage2: renderPdfPage2,
    renderNutritionPdfPreview: renderNutritionPdfPreview,
    renderNutritionPdfThumbnails: renderNutritionPdfThumbnails,
    prepareNutritionPrintRoot: prepareNutritionPrintRoot,
    cleanupNutritionPrintRoot: cleanupNutritionPrintRoot,
  };
})();
