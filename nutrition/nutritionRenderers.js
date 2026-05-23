// nutritionRenderers.js — Refactor Adım 3 part 3A.
// 8 düşük/orta riskli render fonksiyonu app.js'den extract edildi.
// Davranış değişikliği yok; HTML output birebir aynı.
//
// Dependency injection (init):
//   state                   → window.state (closure)
//   escapeHtml              → core utils escapeHtml
//   helpers                 → BSMNutritionHelpers (resolveMealMacros, findSupplementById, ...)
//   supplementLibrary       → BSM_SUPPLEMENT_LIBRARY (renderSupplementLibrary filtresi)
//   renderMealEditorHtml    → app.js'de kalan inline editor renderer (callback)
//   getNutritionPanel       → opsiyonel; lazy DOM ref (şu an kullanılmıyor)

(function () {
  "use strict";

  var _state = null;
  var _escapeHtml = function (s) { return String(s == null ? "" : s); };
  var _h = {};
  var _supplementLibrary = [];
  var _renderMealEditorHtml = function () { return ""; };
  var _getNutritionPanel = function () { return document.querySelector("#nutritionPanel"); };

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    _escapeHtml = typeof deps.escapeHtml === "function" ? deps.escapeHtml : _escapeHtml;
    _h = deps.helpers || window.BSMNutritionHelpers || {};
    _supplementLibrary = Array.isArray(deps.supplementLibrary) ? deps.supplementLibrary : [];
    _renderMealEditorHtml = typeof deps.renderMealEditorHtml === "function" ? deps.renderMealEditorHtml : _renderMealEditorHtml;
    if (typeof deps.getNutritionPanel === "function") _getNutritionPanel = deps.getNutritionPanel;
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionTimelineView — orta sütun günlük öğün akışı
  // ═══════════════════════════════════════════════════════════
  function renderNutritionTimelineView(plan) {
    var host = document.querySelector("#bsmNutritionTimeline");
    if (!host) return;
    var meals = Array.isArray(plan && plan.meals) ? plan.meals : [];
    if (!meals.length) {
      host.innerHTML = '<li class="bsm-nutrition-empty">Plan ayarlarını seçin; öğün zamanlaması ve makrolar burada canlı görünecek.</li>';
      return;
    }
    function mealIcon(name) {
      var lower = String(name || "").toLowerCase();
      if (/kahvaltı|breakfast|sabah/.test(lower)) return "☀";
      if (/öğle|lunch/.test(lower)) return "🍽";
      if (/akşam|dinner|gece/.test(lower)) return "🌙";
      if (/ara|snack/.test(lower)) return "🥤";
      if (/antrenman önce|pre[- ]?workout/.test(lower)) return "⚡";
      if (/antrenman sonra|post[- ]?workout/.test(lower)) return "💪";
      return "•";
    }
    var editingKey = _state.nutritionFormState && _state.nutritionFormState.editingMealKey;
    host.innerHTML = meals.map(function (meal, idx) {
      var key = _h.mealOverrideKey(idx);
      var isEditing = editingKey === key;
      var time = meal.scheduledTime || meal.time || "—";
      var foods = Array.isArray(meal.foods)
        ? meal.foods
        : (typeof meal.foods === "string" ? meal.foods.split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean) : []);
      var macros = _h.resolveMealMacros(meal);
      var tags = [];
      if (meal.isPreWorkout) tags.push("Antrenman Öncesi");
      if (meal.isPostWorkout) tags.push("Antrenman Sonrası");

      var foodsHtml = foods.length
        ? '<ul class="bsm-nutrition-timeline__foods">' + foods.slice(0, 5).map(function (food) {
            if (typeof food === "string") return '<li>' + _escapeHtml(food) + '</li>';
            var label = food.displayLabel || (food.name && food.grams ? food.name + " " + food.grams + "g" : (food.name || ""));
            return '<li>' + _escapeHtml(label) + '</li>';
          }).join("") + '</ul>'
        : "";

      var editorHtml = isEditing ? _renderMealEditorHtml(meal, idx) : "";

      return '<li class="bsm-nutrition-timeline__item' + (isEditing ? " is-editing" : "") + (meal.isOverridden ? " is-overridden" : "") + '" data-meal-idx="' + idx + '">'
        + '<div class="bsm-nutrition-timeline__time">'
        + '<strong>' + _escapeHtml(String(time)) + '</strong>'
        + '<span class="bsm-nutrition-timeline__icon" aria-hidden="true">' + _escapeHtml(mealIcon(meal.name)) + '</span>'
        + '</div>'
        + '<article class="bsm-nutrition-timeline__card">'
        + '<header class="bsm-nutrition-timeline__head">'
        + '<strong>' + _escapeHtml(meal.name || "Öğün") + '</strong>'
        + '<span class="bsm-nutrition-timeline__cal">' + _escapeHtml(String(macros.calories || meal.calories || 0)) + ' kcal</span>'
        + '</header>'
        + foodsHtml
        + '<footer class="bsm-nutrition-timeline__macros">'
        + '<span>P ' + _escapeHtml(String(macros.protein || 0)) + 'g</span>'
        + '<span>K ' + _escapeHtml(String(macros.carbs || 0)) + 'g</span>'
        + '<span>Y ' + _escapeHtml(String(macros.fat || 0)) + 'g</span>'
        + tags.map(function (t) { return '<span class="bsm-nutrition-timeline__tag">' + _escapeHtml(t) + '</span>'; }).join("")
        + '</footer>'
        + '<div class="bsm-meal-actions">'
        + '<button type="button" class="bsm-meal-action" data-meal-action="edit" data-meal-idx="' + idx + '" title="Düzenle">'
        + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        + '<span>' + (isEditing ? "Kapat" : "Düzenle") + '</span>'
        + '</button>'
        + '<button type="button" class="bsm-meal-action" data-meal-action="add-food" data-meal-idx="' + idx + '" title="Besin Ekle">'
        + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
        + '<span>Besin Ekle</span>'
        + '</button>'
        + '<button type="button" class="bsm-meal-action" data-meal-action="refresh" data-meal-idx="' + idx + '" title="Öğünü Yenile">'
        + '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/></svg>'
        + '<span>Yenile</span>'
        + '</button>'
        + '</div>'
        + editorHtml
        + '</article>'
        + '</li>';
    }).join("");
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionMacroView — orta sütun "Makro Dağılımı" tab
  // ═══════════════════════════════════════════════════════════
  function renderNutritionMacroView(plan) {
    var host = document.querySelector("#bsmNutritionMacroDetail");
    if (!host) return;
    if (!plan || !plan.macros) {
      host.innerHTML = '<p class="bsm-nutrition-empty">Plan oluşturulduğunda makro dağılımı detayı burada görünür.</p>';
      return;
    }
    var m = plan.macros;
    var totalKcal = plan.calories || (m.protein * 4 + m.carbs * 4 + m.fat * 9);
    function pct(g, kcalPerG) { return totalKcal ? Math.round((g * kcalPerG / totalKcal) * 100) : 0; }
    host.innerHTML = ''
      + '<div class="bsm-nutrition-macro-detail__grid">'
      + '<div class="bsm-nutrition-macro-detail__card bsm-nutrition-macro-detail__card--protein">'
      + '<small>Protein</small><strong>' + _escapeHtml(String(m.protein || 0)) + ' g</strong>'
      + '<span>' + pct(m.protein, 4) + '% · ' + (m.protein * 4) + ' kcal</span>'
      + '</div>'
      + '<div class="bsm-nutrition-macro-detail__card bsm-nutrition-macro-detail__card--carbs">'
      + '<small>Karbonhidrat</small><strong>' + _escapeHtml(String(m.carbs || 0)) + ' g</strong>'
      + '<span>' + pct(m.carbs, 4) + '% · ' + (m.carbs * 4) + ' kcal</span>'
      + '</div>'
      + '<div class="bsm-nutrition-macro-detail__card bsm-nutrition-macro-detail__card--fat">'
      + '<small>Yağ</small><strong>' + _escapeHtml(String(m.fat || 0)) + ' g</strong>'
      + '<span>' + pct(m.fat, 9) + '% · ' + (m.fat * 9) + ' kcal</span>'
      + '</div>'
      + '</div>'
      + '<p class="bsm-nutrition-macro-detail__hint">Toplam ' + _escapeHtml(String(totalKcal)) + ' kcal — günlük hedefe göre planlanmıştır.</p>';
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionTotalsBar — orta sütun footer toplamlar + delta
  // ═══════════════════════════════════════════════════════════
  function renderNutritionTotalsBar(plan) {
    function setText(sel, t) {
      var el = document.querySelector(sel);
      if (el) el.textContent = t;
    }
    if (!plan) {
      setText("#bsmNutritionTotalCalories", "— kcal");
      setText("#bsmNutritionTotalProtein", "— g");
      setText("#bsmNutritionTotalCarbs", "— g");
      setText("#bsmNutritionTotalFat", "— g");
      document.querySelectorAll(".bsm-nutrition-totals__delta").forEach(function (el) { el.remove(); });
      return;
    }
    setText("#bsmNutritionTotalCalories", (plan.calories || 0) + " kcal");
    setText("#bsmNutritionTotalProtein", ((plan.macros && plan.macros.protein) || 0) + " g");
    setText("#bsmNutritionTotalCarbs", ((plan.macros && plan.macros.carbs) || 0) + " g");
    setText("#bsmNutritionTotalFat", ((plan.macros && plan.macros.fat) || 0) + " g");

    var targetCal = Number(plan.targetCalories) || 0;
    var actualCal = Number(plan.calories) || 0;
    var targetMacros = plan.targetMacros || plan.macros || {};

    function updateDelta(containerSel, target, actual, unit) {
      if (unit === undefined) unit = "";
      var container = document.querySelector(containerSel);
      if (!container) return;
      var delta = container.querySelector(".bsm-nutrition-totals__delta");
      if (!delta) {
        delta = document.createElement("span");
        delta.className = "bsm-nutrition-totals__delta";
        container.appendChild(delta);
      }
      if (!target || target === actual) {
        delta.textContent = "";
        delta.className = "bsm-nutrition-totals__delta";
        return;
      }
      var diff = actual - target;
      var sign = diff > 0 ? "+" : "";
      delta.textContent = sign + diff + unit;
      delta.className = "bsm-nutrition-totals__delta " + (
        Math.abs(diff / Math.max(1, target)) < 0.05 ? "is-ok" :
        diff > 0 ? "is-over" : "is-under"
      );
    }
    if (targetCal && targetCal !== actualCal) {
      updateDelta("#bsmNutritionTotalCalories", targetCal, actualCal, " kcal");
      updateDelta("#bsmNutritionTotalProtein", Number(targetMacros.protein), Number(plan.macros && plan.macros.protein), "g");
      updateDelta("#bsmNutritionTotalCarbs", Number(targetMacros.carbs), Number(plan.macros && plan.macros.carbs), "g");
      updateDelta("#bsmNutritionTotalFat", Number(targetMacros.fat), Number(plan.macros && plan.macros.fat), "g");
    } else {
      document.querySelectorAll(".bsm-nutrition-totals__delta").forEach(function (el) {
        el.textContent = "";
        el.className = "bsm-nutrition-totals__delta";
      });
    }
    var weight = Number(plan && plan.sourceSummary && plan.sourceSummary.weight) || 0;
    if (weight) setText("#bsmNutritionWaterTarget", (weight * 0.035).toFixed(1) + " L");
    else setText("#bsmNutritionWaterTarget", "2.5 L");
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionMacroChart — sağ kolon makro donut
  // ═══════════════════════════════════════════════════════════
  function renderNutritionMacroChart(plan) {
    var host = document.querySelector("#bsmNutritionMacroChart");
    if (!host) return;
    if (!plan || !plan.macros) {
      host.innerHTML = '<p class="bsm-nutrition-empty bsm-nutrition-empty--small">Plan oluşturulmadı.</p>';
      return;
    }
    var m = plan.macros;
    var proteinKcal = (m.protein || 0) * 4;
    var carbsKcal = (m.carbs || 0) * 4;
    var fatKcal = (m.fat || 0) * 9;
    var total = proteinKcal + carbsKcal + fatKcal || 1;
    var pP = proteinKcal / total;
    var pC = carbsKcal / total;
    var pF = fatKcal / total;
    var C = 251.3;
    var dashP = pP * C;
    var dashC = pC * C;
    var dashF = pF * C;
    host.innerHTML = ''
      + '<div class="bsm-nutrition-donut">'
      + '<svg viewBox="0 0 100 100" width="120" height="120" aria-hidden="true">'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" stroke-width="14"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#16a34a" stroke-width="14" stroke-dasharray="' + dashP.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="0" transform="rotate(-90 50 50)" stroke-linecap="butt"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#2563eb" stroke-width="14" stroke-dasharray="' + dashC.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-dashP).toFixed(2) + '" transform="rotate(-90 50 50)" stroke-linecap="butt"/>'
      + '<circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" stroke-width="14" stroke-dasharray="' + dashF.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-(dashP + dashC)).toFixed(2) + '" transform="rotate(-90 50 50)" stroke-linecap="butt"/>'
      + '<text x="50" y="52" text-anchor="middle" font-size="14" font-weight="700" fill="#111827">' + (plan.calories || 0) + '</text>'
      + '<text x="50" y="65" text-anchor="middle" font-size="7" fill="#6b7280">kcal</text>'
      + '</svg>'
      + '<ul class="bsm-nutrition-donut__legend">'
      + '<li><span class="bsm-nutrition-donut__swatch" style="background:#16a34a"></span><strong>Protein</strong><em>' + (m.protein || 0) + 'g · ' + Math.round(pP * 100) + '%</em></li>'
      + '<li><span class="bsm-nutrition-donut__swatch" style="background:#2563eb"></span><strong>Karbonhidrat</strong><em>' + (m.carbs || 0) + 'g · ' + Math.round(pC * 100) + '%</em></li>'
      + '<li><span class="bsm-nutrition-donut__swatch" style="background:#f59e0b"></span><strong>Yağ</strong><em>' + (m.fat || 0) + 'g · ' + Math.round(pF * 100) + '%</em></li>'
      + '</ul>'
      + '</div>';
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionSupplementTimeline — sağ kolon zaman çizgisi
  // ═══════════════════════════════════════════════════════════
  function renderNutritionSupplementTimeline(plan) {
    var host = document.querySelector("#bsmNutritionSupplementTimeline");
    if (!host) return;
    var f = _state.nutritionFormState;
    if (!f.supplementUse || !Array.isArray(f.selectedSupplements) || !f.selectedSupplements.length) {
      host.innerHTML = '<p class="bsm-nutrition-empty bsm-nutrition-empty--small">Supplement planı kapalı.</p>';
      return;
    }
    var items = f.selectedSupplements
      .map(function (id) { return _h.findSupplementById(id); })
      .filter(Boolean)
      .map(function (s) {
        return {
          id: s.id,
          time: _h.getSupplementScheduleTime(s, f),
          name: s.name,
          icon: s.icon || "💊",
          dose: s.dosage || "",
          category: s.category,
        };
      })
      .sort(function (a, b) { return (a.time || "").localeCompare(b.time || ""); });

    host.innerHTML = '<ul class="bsm-nutrition-suppl-list">'
      + items.map(function (it) {
        return '<li class="bsm-nutrition-suppl-item" data-suppl-id="' + _escapeHtml(it.id) + '">'
          + '<span class="bsm-nutrition-suppl-time">' + _escapeHtml(it.time) + '</span>'
          + '<span class="bsm-nutrition-suppl-icon" aria-hidden="true">' + _escapeHtml(it.icon) + '</span>'
          + '<span class="bsm-nutrition-suppl-name">' + _escapeHtml(it.name) + '</span>'
          + '<span class="bsm-nutrition-suppl-dose">' + _escapeHtml(String(it.dose)) + '</span>'
          + '<button type="button" class="bsm-nutrition-suppl-remove" data-suppl-remove="' + _escapeHtml(it.id) + '" aria-label="Kaldır">×</button>'
          + '</li>';
      }).join("")
      + '</ul>';
  }

  // ═══════════════════════════════════════════════════════════
  // renderSupplementLibrary — sol panel supplement kart listesi
  // ═══════════════════════════════════════════════════════════
  function renderSupplementLibrary() {
    var host = document.querySelector("#supplementLibrary");
    if (!host) return;
    // v1.4.1: Library hazır mı kontrolü (defansif — async load / future Supabase ihtimaline karşı)
    if (!Array.isArray(_supplementLibrary) || !_supplementLibrary.length) {
      host.innerHTML = '<p class="bsm-nutrition-empty bsm-nutrition-empty--small">Supplement veritabanı yükleniyor…</p>';
      return;
    }
    var f = _state.nutritionFormState;
    if (!f.supplementUse) {
      host.innerHTML = ''
        + '<div class="bsm-suppl-cta-empty">'
        + '<p>Sporcunuza supplement zaman çizelgesi eklemek için aşağıdaki butonu kullanın.</p>'
        + '<button type="button" class="bsm-suppl-cta-btn" data-nutrition-action="enable-supplements">'
        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/></svg>'
        + '<span>Supplement Sistemini Aç</span>'
        + '</button>'
        + '</div>';
      return;
    }
    var search = String(f.supplementSearch || "").toLocaleLowerCase("tr");
    var activeFilter = host.dataset.activeFilter || "all";
    var items = _supplementLibrary.filter(function (s) {
      var matchSearch = !search || s.name.toLocaleLowerCase("tr").includes(search) || s.category.toLocaleLowerCase("tr").includes(search);
      var matchFilter = activeFilter === "all" || _h.normalizeSupplementCategoryKey(s.category) === activeFilter;
      return matchSearch && matchFilter;
    });
    if (!items.length) {
      host.innerHTML = '<p class="bsm-nutrition-empty bsm-nutrition-empty--small">Aramaya uyan supplement yok.</p>';
      return;
    }
    host.innerHTML = items.map(function (s) {
      var isSelected = f.selectedSupplements.includes(s.id);
      var timingLabel = _h.supplementTimingLabel(s.timing);
      return ''
        + '<article class="bsm-suppl-card' + (isSelected ? " is-selected" : "") + '" data-suppl-add="' + _escapeHtml(s.id) + '" role="listitem">'
        + '<div class="bsm-suppl-card__head">'
        + '<span class="bsm-suppl-card__icon" aria-hidden="true">' + _escapeHtml(s.icon || "💊") + '</span>'
        + '<div class="bsm-suppl-card__info">'
        + '<strong>' + _escapeHtml(s.name) + '</strong>'
        + '<span class="bsm-suppl-card__cat">' + _escapeHtml(s.category) + '</span>'
        + '</div>'
        + '<button type="button" class="bsm-suppl-card__action" data-suppl-toggle="' + _escapeHtml(s.id) + '" aria-label="' + (isSelected ? "Kaldır" : "Ekle") + '">'
        + (isSelected ? "✓" : "+")
        + '</button>'
        + '</div>'
        + '<p class="bsm-suppl-card__desc">' + _escapeHtml(s.description || "") + '</p>'
        + '<footer class="bsm-suppl-card__foot">'
        + '<span class="bsm-suppl-card__time">⏰ ' + _escapeHtml(timingLabel) + '</span>'
        + '<span class="bsm-suppl-card__dose">' + _escapeHtml(s.dosage || "") + '</span>'
        + '</footer>'
        + '</article>';
    }).join("");
  }

  // ═══════════════════════════════════════════════════════════
  // renderSupplementSelected — sol panel chip listesi
  // ═══════════════════════════════════════════════════════════
  function renderSupplementSelected() {
    var wrap = document.querySelector("#supplementSelectedWrap");
    var list = document.querySelector("#supplementSelected");
    if (!wrap || !list) return;
    var f = _state.nutritionFormState;
    if (!f.supplementUse || !f.selectedSupplements.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    list.innerHTML = f.selectedSupplements.map(function (id) {
      var s = _h.findSupplementById(id);
      if (!s) return "";
      return '<li class="bsm-suppl-chip">'
        + '<span aria-hidden="true">' + _escapeHtml(s.icon || "💊") + '</span>'
        + '<strong>' + _escapeHtml(s.name) + '</strong>'
        + '<button type="button" class="bsm-suppl-chip__remove" data-suppl-remove="' + _escapeHtml(s.id) + '" aria-label="Kaldır">×</button>'
        + '</li>';
    }).join("");
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionMetaCard — sağ kolon plan bilgileri
  // ═══════════════════════════════════════════════════════════
  function renderNutritionMetaCard(member, savedPlan, livePreview) {
    function setText(sel, t) {
      var el = document.querySelector(sel);
      if (el) el.textContent = t || "—";
    }
    var displayPlan = savedPlan || livePreview;
    setText("#bsmNutritionMetaCreated", (savedPlan && savedPlan.createdAt) || (livePreview && livePreview.createdAt) || "—");
    setText("#bsmNutritionMetaUpdated", (savedPlan && savedPlan.updatedAt) || (savedPlan && savedPlan.createdAt) || "Henüz kaydedilmedi");
    var typeMap = { "fat-loss": "Yağ yakımı", "muscle-gain": "Kas kazanımı", "maintenance": "Koruma", "recomposition": "Recomposition" };
    setText("#bsmNutritionMetaType", typeMap[_state.nutritionFormState.goal] || (displayPlan && displayPlan.nutritionGoalLabel) || "—");
    var isSaved = !!(member && member.nutritionPlan && member.nutritionPlan.id && savedPlan && savedPlan.id === member.nutritionPlan.id);
    setText("#bsmNutritionMetaStatus", isSaved ? "Aktif" : "Taslak");
  }

  // ═══════════════════════════════════════════════════════════
  // Expose
  // ═══════════════════════════════════════════════════════════
  window.BSMNutritionRenderers = {
    init: init,
    renderNutritionTimelineView: renderNutritionTimelineView,
    renderNutritionMacroView: renderNutritionMacroView,
    renderNutritionTotalsBar: renderNutritionTotalsBar,
    renderNutritionMacroChart: renderNutritionMacroChart,
    renderNutritionSupplementTimeline: renderNutritionSupplementTimeline,
    renderSupplementLibrary: renderSupplementLibrary,
    renderSupplementSelected: renderSupplementSelected,
    renderNutritionMetaCard: renderNutritionMetaCard,
  };
})();
