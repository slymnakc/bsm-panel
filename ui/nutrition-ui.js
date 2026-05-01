(function () {
  "use strict";

  function renderNutritionWorkspace(targets, model, escapeHtml, deps = {}) {
    if (!targets?.nutritionMemberSummary || !targets?.nutritionPlanEditor) {
      return;
    }

    renderMemberSummary(targets.nutritionMemberSummary, model, escapeHtml, deps);
    renderNutritionPlan(targets.nutritionPlanEditor, model?.plan || null, escapeHtml);
  }

  function renderMemberSummary(target, model, escapeHtml, deps) {
    const member = model?.member || null;
    const profile = member?.profile || {};
    const latestMeasurement = member?.measurements?.[0] || null;
    const goalLabel = deps.labelMaps?.goal?.[profile.goal] || profile.goal || "Belirtilmedi";

    if (!member) {
      target.innerHTML = `
        <div class="empty-state compact-empty">
          Beslenme planı için önce bir üye seçin. Ölçüm varsa kalori ve makro hesapları daha isabetli yapılır.
        </div>
      `;
      return;
    }

    target.innerHTML = `
      <article class="nutrition-member-card">
        <div>
          <p class="section-kicker">Aktif Üye</p>
          <h3>${escapeHtml(profile.memberName || "Üye")}</h3>
          <span>${escapeHtml(goalLabel)} • ${escapeHtml(profile.days?.length ? `${profile.days.length} gün antrenman` : "Antrenman günü belirtilmedi")}</span>
        </div>
        <div class="nutrition-member-card__metrics">
          <span><strong>${escapeHtml(latestMeasurement?.weight || "-")}</strong>Kilo</span>
          <span><strong>${escapeHtml(latestMeasurement?.fat || "-")}</strong>Yağ %</span>
          <span><strong>${escapeHtml(latestMeasurement?.muscleMass || "-")}</strong>Kas kg</span>
          <span><strong>${escapeHtml(latestMeasurement?.bmr || "-")}</strong>BMR</span>
        </div>
      </article>
    `;
  }

  function renderNutritionPlan(target, plan, escapeHtml) {
    if (!target) {
      return;
    }

    if (!plan) {
      target.innerHTML = `
        <div class="empty-state compact-empty">
          Henüz beslenme planı oluşturulmadı. Üye verilerini kontrol edip "Beslenme Planı Oluştur" düğmesine basın.
        </div>
      `;
      return;
    }

    target.innerHTML = `
      <div class="nutrition-plan-card" data-nutrition-plan-id="${escapeHtml(plan.id)}">
        <div class="nutrition-plan-card__header">
          <div>
            <p class="section-kicker">Kalori ve Makro Hedefleri</p>
            <h3>${escapeHtml(plan.memberName || "Üye")} Beslenme Planı</h3>
            <span>${escapeHtml(plan.sourceSummary?.bmrSource || "Tahmini hesap")} • Bakım: ${escapeHtml(plan.sourceSummary?.maintenanceCalories || "-")} kcal</span>
          </div>
          <small>${escapeHtml(plan.createdAt || "")}</small>
        </div>
        <div class="nutrition-macro-editor">
          ${renderEditableMetric("Günlük kalori", "calories", plan.calories, "kcal", escapeHtml)}
          ${renderEditableMetric("Protein", "protein", plan.macros?.protein, "g", escapeHtml)}
          ${renderEditableMetric("Karbonhidrat", "carbs", plan.macros?.carbs, "g", escapeHtml)}
          ${renderEditableMetric("Yağ", "fat", plan.macros?.fat, "g", escapeHtml)}
        </div>
        <div class="nutrition-intelligence">
          ${(plan.intelligence || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </div>
        <div class="nutrition-meal-grid">
          ${(plan.meals || []).map((meal, index) => renderMealEditor(meal, index, escapeHtml)).join("")}
        </div>
        ${renderSupplementOutput(plan.supplements || [], escapeHtml, true)}
        <label class="field compact-field nutrition-note-field">
          <span>Antrenör notu</span>
          <textarea id="nutritionTrainerNoteInput" rows="3" maxlength="420">${escapeHtml(plan.trainerNote || "")}</textarea>
        </label>
        <p class="nutrition-disclaimer">${escapeHtml(plan.disclaimer || "")}</p>
      </div>
    `;
  }

  function renderOutputNutritionPlan(target, plan, labelMaps, escapeHtml) {
    if (!target) {
      return;
    }

    target.innerHTML = `
      <article class="nutrition-output-card nutrition-output-card--workout-notice">
        <strong>Beslenme planı uygulama içindeki Beslenme sekmesinde sunulmaktadır.</strong>
        <small>Workout PDF yalnızca antrenman planı, Tanita bağlantılı program notları ve takip aksiyonlarını içerir.</small>
      </article>
    `;
  }

  function collectNutritionPlanEdits(root, currentPlan) {
    if (!root || !currentPlan) {
      return null;
    }

    const edited = cloneData(currentPlan);
    edited.calories = readNumber(root.querySelector('[data-nutrition-field="calories"]')?.value) || edited.calories;
    edited.macros = {
      protein: readNumber(root.querySelector('[data-nutrition-field="protein"]')?.value) || edited.macros?.protein || 0,
      carbs: readNumber(root.querySelector('[data-nutrition-field="carbs"]')?.value) || edited.macros?.carbs || 0,
      fat: readNumber(root.querySelector('[data-nutrition-field="fat"]')?.value) || edited.macros?.fat || 0,
    };
    edited.meals = (edited.meals || []).map((meal, index) => ({
      ...meal,
      name: root.querySelector(`[data-meal-index="${index}"][data-meal-field="name"]`)?.value?.trim() || meal.name,
      foods: root.querySelector(`[data-meal-index="${index}"][data-meal-field="foods"]`)?.value?.trim() || meal.foods,
      calories: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="calories"]`)?.value) || meal.calories,
      protein: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="protein"]`)?.value) || meal.protein,
      carbs: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="carbs"]`)?.value) || meal.carbs,
      fat: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="fat"]`)?.value) || meal.fat,
    }));
    edited.trainerNote = root.querySelector("#nutritionTrainerNoteInput")?.value?.trim() || "";
    return edited;
  }

  function collectSupplementPreferences(root) {
    return {
      useSupplements: root?.querySelector("#supplementUse")?.value || "no",
      caffeineSensitive: root?.querySelector("#caffeineSensitive")?.value || "no",
      lactoseSensitive: root?.querySelector("#lactoseSensitive")?.value || "no",
      budget: root?.querySelector("#supplementBudget")?.value || "medium",
    };
  }

  function renderEditableMetric(label, field, value, suffix, escapeHtml) {
    return `
      <label class="edit-field nutrition-macro-field">
        <span>${escapeHtml(label)}</span>
        <input type="number" min="0" step="1" value="${escapeHtml(value || "")}" data-nutrition-field="${escapeHtml(field)}" />
        <small>${escapeHtml(suffix)}</small>
      </label>
    `;
  }

  function renderMealEditor(meal, index, escapeHtml) {
    return `
      <article class="nutrition-meal-card">
        <label class="edit-field">
          <span>Öğün adı</span>
          <input type="text" value="${escapeHtml(meal.name || "")}" data-meal-index="${index}" data-meal-field="name" />
        </label>
        <label class="edit-field">
          <span>Besinler ve porsiyon</span>
          <textarea rows="3" data-meal-index="${index}" data-meal-field="foods">${escapeHtml(meal.foods || "")}</textarea>
        </label>
        <div class="nutrition-meal-card__macros">
          ${renderMealNumber("Kalori", "calories", meal.calories, index, escapeHtml)}
          ${renderMealNumber("P", "protein", meal.protein, index, escapeHtml)}
          ${renderMealNumber("K", "carbs", meal.carbs, index, escapeHtml)}
          ${renderMealNumber("Y", "fat", meal.fat, index, escapeHtml)}
        </div>
        ${renderMealAlternatives(meal.alternatives || [], escapeHtml)}
      </article>
    `;
  }

  function renderMealAlternatives(alternatives, escapeHtml) {
    if (!alternatives.length) {
      return "";
    }

    return `
      <div class="nutrition-meal-alternatives">
        <strong>Alternatif besinler</strong>
        <span>${alternatives.map((item) => escapeHtml(item)).join(" • ")}</span>
      </div>
    `;
  }

  function renderMealNumber(label, field, value, index, escapeHtml) {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <input type="number" min="0" step="1" value="${escapeHtml(value || "")}" data-meal-index="${index}" data-meal-field="${escapeHtml(field)}" />
      </label>
    `;
  }

  function renderSupplementOutput(supplements, escapeHtml, editableContext) {
    if (!supplements.length) {
      return editableContext ? `<div class="nutrition-supplements empty-state compact-empty">Supplement kullanımı kapalı. Plan gıda öncelikli hazırlandı.</div>` : "";
    }

    return `
      <div class="nutrition-supplements">
        <h4>Supplement Tercihi</h4>
        ${supplements
          .map(
            (item) => `
              <article>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.purpose)}</span>
                <small>${escapeHtml(item.timing)} • ${escapeHtml(item.note)} Gıda alternatifi: ${escapeHtml(item.foodAlternative)}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function readNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  window.BSMNutritionUI = {
    renderNutritionWorkspace,
    renderNutritionPlan,
    renderOutputNutritionPlan,
    collectNutritionPlanEdits,
    collectSupplementPreferences,
  };
})();
