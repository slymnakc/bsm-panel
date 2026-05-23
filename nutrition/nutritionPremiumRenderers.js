// nutritionPremiumRenderers.js — Refactor Adım 3 part 3B1.
// 2 saf render fonksiyonu app.js'den extract edildi.
// Davranış değişikliği yok; DOM mutation ve HTML output birebir aynı.
//
// Dependency injection (init):
//   state                          → window.state (closure)
//   escapeHtml                     → core utils escapeHtml
//   foodLibrary                    → BSM_FOOD_LIBRARY (meal editor food dropdown)
//   labelMaps                      → window.BSMLabelData.labelMaps (hero level label)
//   getActiveMeasurementSnapshot   → app.js fn (latest measurement resolver)

(function () {
  "use strict";

  var _state = null;
  var _escapeHtml = function (s) { return String(s == null ? "" : s); };
  var _foodLibrary = [];
  var _labelMaps = {};
  var _getActiveMeasurementSnapshot = null;

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    _escapeHtml = typeof deps.escapeHtml === "function" ? deps.escapeHtml : _escapeHtml;
    _foodLibrary = Array.isArray(deps.foodLibrary) ? deps.foodLibrary : [];
    _labelMaps = deps.labelMaps || {};
    _getActiveMeasurementSnapshot = typeof deps.getActiveMeasurementSnapshot === "function"
      ? deps.getActiveMeasurementSnapshot
      : null;
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionHero — beslenme paneli üst hero alanı
  // DOM-render: avatar + initials + member meta + makro summary.
  // Return değeri yok; side-effect ile DOM elementlerini doldurur.
  // ═══════════════════════════════════════════════════════════
  function renderNutritionHero(member, plan) {
    const profile = member?.profile || {};
    const latestMeasurement = (typeof _getActiveMeasurementSnapshot === "function")
      ? _getActiveMeasurementSnapshot(member)
      : (member?.measurements?.[0] || null);

    // Avatar/initials
    const initialsEl = document.querySelector("#bsmNutritionAvatarInitials");
    if (initialsEl) {
      const name = String(profile.memberName || "").trim();
      if (name) {
        const parts = name.split(/\s+/).filter(Boolean);
        const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
        initialsEl.textContent = initials.toLocaleUpperCase("tr");
      } else {
        initialsEl.textContent = "--";
      }
    }
    const avatarHost = document.querySelector("#bsmNutritionAvatar");
    if (avatarHost && profile.photo && typeof profile.photo === "string" && profile.photo.startsWith("data:image/")) {
      avatarHost.innerHTML = `<img src="${_escapeHtml(profile.photo)}" alt="" loading="lazy" decoding="async" />`;
    } else if (avatarHost && !avatarHost.querySelector(".bsm-nutrition-hero__avatar-initials")) {
      avatarHost.innerHTML = `<span class="bsm-nutrition-hero__avatar-initials" id="bsmNutritionAvatarInitials">${_escapeHtml(initialsEl?.textContent || "--")}</span>`;
    }

    const setText = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };
    setText("#bsmNutritionMemberName", profile.memberName || "Üye seçilmedi");
    setText("#bsmNutritionHeroCode", profile.memberCode || "Yok");
    const lvlLabel = _labelMaps?.level?.[profile.level] || profile.level || "Seviye yok";
    setText("#bsmNutritionHeroLevel", lvlLabel);
    const hasProgram = Array.isArray(member?.programs) && member.programs.length > 0;
    setText("#bsmNutritionHeroProgram", hasProgram ? "Aktif" : "Bekliyor");
    setText("#bsmNutritionLastMeasurement", latestMeasurement?.date || "Ölçüm yok");

    const goalChipSpan = document.querySelector("#bsmNutritionGoalChip span");
    if (goalChipSpan) {
      const map = { "fat-loss": "Yağ yakımı", "muscle-gain": "Kas kazanımı", "maintenance": "Koruma", "recomposition": "Recomposition" };
      goalChipSpan.textContent = map[_state.nutritionFormState.goal] || "Hedef belirtilmedi";
    }

    const calories = plan?.calories || _state.nutritionFormState.calories || 0;
    setText("#bsmNutritionDailyCalories", calories ? `${calories} kcal` : "—");
    const m = plan?.macros;
    if (m) {
      setText("#bsmNutritionMacroSummary", `P ${m.protein || 0}g / K ${m.carbs || 0}g / Y ${m.fat || 0}g`);
    } else {
      const f = _state.nutritionFormState;
      if (f.protein && f.carbs && f.fat) {
        setText("#bsmNutritionMacroSummary", `P ${f.protein}g / K ${f.carbs}g / Y ${f.fat}g`);
      } else {
        setText("#bsmNutritionMacroSummary", "—");
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // renderMealEditorHtml — meal editor inline panel HTML üretici
  // v1.3.4: meal.foods her satir icin food dropdown + gramaj input.
  // Return: HTML string.
  // ═══════════════════════════════════════════════════════════
  function renderMealEditorHtml(meal, idx) {
    const foods = Array.isArray(meal.foods) ? meal.foods : [];
    const categories = ["Protein", "Karbonhidrat", "Yağ", "Sebze", "Meyve", "Süt Ürünleri", "Kuruyemiş", "Pratik"];
    return `
    <div class="bsm-meal-editor" data-meal-editor="${idx}">
      <div class="bsm-meal-editor__head">
        <label class="bsm-meal-editor__field">
          <span>Öğün adı</span>
          <input type="text" data-meal-field="name" value="${_escapeHtml(meal.name || "")}" />
        </label>
        <label class="bsm-meal-editor__field">
          <span>Saat</span>
          <input type="time" data-meal-field="time" value="${_escapeHtml(meal.scheduledTime || meal.time || "12:00")}" />
        </label>
      </div>
      <div class="bsm-meal-editor__foods">
        ${foods.length
          ? foods.map((food, fi) => {
              const foodId = food.id || "";
              const grams = food.grams || 100;
              return `
                <div class="bsm-meal-food-row" data-food-row="${fi}">
                  <select class="bsm-meal-food-row__select" data-food-field="id" data-food-row="${fi}">
                    <option value="">— Seç —</option>
                    ${categories.map((cat) => `<optgroup label="${_escapeHtml(cat)}">${
                      _foodLibrary.filter((f) => f.category === cat)
                        .map((f) => `<option value="${_escapeHtml(f.id)}"${f.id === foodId ? " selected" : ""}>${_escapeHtml(f.name)}</option>`)
                        .join("")
                    }</optgroup>`).join("")}
                  </select>
                  <input type="number" class="bsm-meal-food-row__grams" data-food-field="grams" data-food-row="${fi}" min="1" max="1000" step="5" value="${_escapeHtml(String(grams))}" /> <span class="bsm-meal-food-row__unit">g</span>
                  <button type="button" class="bsm-meal-food-row__remove" data-meal-action="remove-food" data-meal-idx="${idx}" data-food-row="${fi}" aria-label="Sil">×</button>
                </div>
              `;
            }).join("")
          : `<p class="bsm-meal-editor__empty">Henüz besin yok. Aşağıdaki butondan ekleyin.</p>`
        }
      </div>
      <div class="bsm-meal-editor__foot">
        <button type="button" class="bsm-meal-editor__btn bsm-meal-editor__btn--add" data-meal-action="add-food" data-meal-idx="${idx}">+ Besin Ekle</button>
        <button type="button" class="bsm-meal-editor__btn" data-meal-action="close-edit" data-meal-idx="${idx}">Tamam</button>
      </div>
    </div>
  `;
  }

  window.BSMNutritionPremiumRenderers = {
    init: init,
    renderNutritionHero: renderNutritionHero,
    renderMealEditorHtml: renderMealEditorHtml,
  };
})();
