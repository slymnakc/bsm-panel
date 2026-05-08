(function () {
  "use strict";

  function renderNutritionWorkspace(targets, model, escapeHtml, deps = {}) {
    if (!targets?.nutritionMemberSummary || !targets?.nutritionPlanEditor) {
      return;
    }

    renderMemberSummary(targets.nutritionMemberSummary, model, escapeHtml, deps);
    renderNutritionPlan(targets.nutritionPlanEditor, model?.plan || null, escapeHtml);
    syncNutritionControlValues(targets.nutritionPanel, model, escapeHtml);
  }

  function prepareNutritionControls(root, escapeHtml) {
    if (!root) {
      return;
    }

    const actions = root.querySelector(".panel-actions");
    const saveButton = root.querySelector("#saveNutritionButton");
    if (actions && saveButton && !root.querySelector("#sendNutritionMailButton")) {
      saveButton.insertAdjacentHTML(
        "afterend",
        `<button type="button" class="ghost-button" id="sendNutritionMailButton">PDF'i Mail ile Gönder</button>`,
      );
    }

    const memberSummary = root.querySelector("#nutritionMemberSummary");
    if (memberSummary && !root.querySelector("#nutritionGoalSelect")) {
      memberSummary.insertAdjacentHTML(
        "afterend",
        `
          <div class="nutrition-planner-controls">
            <div class="nutrition-control-card nutrition-control-card--primary">
              <p class="section-kicker">Plan Ayarları</p>
              <label class="field compact-field">
                <span>Beslenme hedefi</span>
                <select id="nutritionGoalSelect"></select>
              </label>
              <div class="nutrition-control-grid">
                <label class="field compact-field">
                  <span>Öğün sayısı</span>
                  <select id="nutritionMealCount">
                    <option value="3">3 öğün</option>
                    <option value="4">4 öğün</option>
                    <option value="5" selected>5 öğün</option>
                    <option value="6">6 öğün</option>
                  </select>
                </label>
                <label class="field compact-field">
                  <span>Gün tipi</span>
                  <select id="nutritionDayType">
                    <option value="balanced" selected>Dengeli gün</option>
                    <option value="training">Antrenman günü</option>
                    <option value="rest">Dinlenme günü</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="nutrition-control-card">
              <p class="section-kicker">Saat Bazlı Akış</p>
              <div class="nutrition-schedule-controls" aria-label="Saat bazlı beslenme akışı">
                <label class="field compact-field">
                  <span>Uyanma</span>
                  <input type="time" id="nutritionWakeTime" value="07:30" />
                </label>
                <label class="field compact-field">
                  <span>İlk öğün</span>
                  <input type="time" id="nutritionFirstMealTime" value="08:30" />
                </label>
                <label class="field compact-field">
                  <span>Antrenman</span>
                  <input type="time" id="nutritionWorkoutTime" value="18:30" />
                </label>
                <label class="field compact-field">
                  <span>Kardiyo</span>
                  <input type="time" id="nutritionCardioTime" />
                </label>
                <label class="field compact-field">
                  <span>Uyku</span>
                  <input type="time" id="nutritionSleepTime" value="23:30" />
                </label>
                <label class="nutrition-checkbox-control nutrition-checkbox-control--inline nutrition-if-toggle">
                  <input type="checkbox" id="nutritionFastingEnabled" />
                  <span>Intermittent fasting</span>
                </label>
                <label class="field compact-field">
                  <span>IF penceresi</span>
                  <select id="nutritionFastingWindow">
                    <option value="14:10">14:10</option>
                    <option value="16:8" selected>16:8</option>
                    <option value="18:6">18:6</option>
                  </select>
                </label>
              </div>
            </div>

            <label class="field compact-field nutrition-email-field">
              <span>Mail adresi</span>
              <input type="email" id="nutritionEmailInput" placeholder="uye@ornek.com" autocomplete="email" />
            </label>

            <div id="nutritionTargetPreview" class="nutrition-target-preview">
              Hedef seçildiğinde kalori, makro ve zamanlama ön izlemesi burada görünür.
            </div>
          </div>
        `,
      );
    }

    const supplementUse = root.querySelector("#supplementUse");
    if (supplementUse && supplementUse.tagName === "SELECT" && !root.querySelector("#supplementUseCheckbox")) {
      supplementUse.closest("label")?.insertAdjacentHTML(
        "beforebegin",
        `<label class="supplement-master-toggle"><input type="checkbox" id="supplementUseCheckbox" value="yes" /> <span><b>Supplement önerisi eklensin</b><small>Destekler öğün kartlarının içinde saatli olarak gösterilir.</small></span></label>`,
      );
      supplementUse.closest("label").classList.add("is-hidden");
    }

    const supplementBlock = root.querySelector(".supplement-preferences");
    if (supplementBlock && !root.querySelector("#supplementCategoryList")) {
      supplementBlock.querySelector(".section-kicker")?.insertAdjacentHTML(
        "afterend",
        `<div id="supplementCategoryList" class="supplement-category-list"></div>`,
      );
    }

    populateNutritionGoalSelect(root.querySelector("#nutritionGoalSelect"), escapeHtml);
    populateSupplementCategories(root.querySelector("#supplementCategoryList"), escapeHtml);
  }

  function populateNutritionGoalSelect(select, escapeHtml) {
    if (!select || select.options.length) {
      return;
    }

    const goals = window.BSMNutritionGoals?.getNutritionGoals?.() || [];
    const byCategory = goals.reduce((acc, goal) => {
      acc[goal.category] = acc[goal.category] || [];
      acc[goal.category].push(goal);
      return acc;
    }, {});

    select.innerHTML = Object.entries(byCategory)
      .map(
        ([category, items]) => `
          <optgroup label="${escapeHtml(category)}">
            ${items.map((goal) => `<option value="${escapeHtml(goal.id)}">${escapeHtml(goal.label)}</option>`).join("")}
          </optgroup>
        `,
      )
      .join("");
  }

  function populateSupplementCategories(target, escapeHtml) {
    if (!target || target.children.length) {
      return;
    }

    const categories = window.BSMSupplementDatabase?.getSupplementCategories?.() || [];
    target.innerHTML = categories
      .map(
        (category) => `
          <label class="supplement-toggle-card">
            <input type="checkbox" name="supplementCategories" value="${escapeHtml(category)}" />
            <span class="supplement-toggle-card__icon">${escapeHtml(getSupplementCategoryIcon(category))}</span>
            <span class="supplement-toggle-card__text">
              <strong>${escapeHtml(category)}</strong>
              <small>${escapeHtml(getSupplementCategoryHint(category))}</small>
            </span>
          </label>
        `,
      )
      .join("");
  }

  function syncNutritionControlValues(root, model, escapeHtml) {
    if (!root) {
      return;
    }

    const member = model?.member || null;
    const plan = model?.plan || null;
    const profile = member?.profile || {};
    const fallbackGoalId = window.BSMNutritionGoals?.mapLegacyGoalToNutritionGoalId?.(profile.goal) || "general-health-form";
    const preferences = plan?.supplementPreferences || {};
    const forcePlanSync = Boolean(plan?.id) && root.dataset.nutritionPlanSyncId !== String(plan.id || "");

    setControlValue(root.querySelector("#nutritionGoalSelect"), plan?.nutritionGoalId || preferences.nutritionGoalId || fallbackGoalId, forcePlanSync);
    setControlValue(root.querySelector("#nutritionMealCount"), String(plan?.mealCount || preferences.mealCount || 5), forcePlanSync);
    setControlValue(root.querySelector("#nutritionDayType"), plan?.dayType || preferences.dayType || "balanced", forcePlanSync);

    const schedule = plan?.schedule || preferences || {};
    setControlValue(root.querySelector("#nutritionWakeTime"), schedule.wakeTime || "07:30", forcePlanSync);
    setControlValue(root.querySelector("#nutritionFirstMealTime"), schedule.firstMealTime || "08:30", forcePlanSync);
    setControlValue(root.querySelector("#nutritionWorkoutTime"), schedule.workoutTime || "18:30", forcePlanSync);
    setControlValue(root.querySelector("#nutritionSleepTime"), schedule.sleepTime || "23:30", forcePlanSync);
    setControlValue(root.querySelector("#nutritionCardioTime"), schedule.cardioTime || "", forcePlanSync);
    setControlValue(root.querySelector("#nutritionFastingWindow"), schedule.fastingWindow || "16:8", forcePlanSync);

    const fastingInput = root.querySelector("#nutritionFastingEnabled");
    if (fastingInput && (forcePlanSync || !fastingInput.dataset.synced)) {
      fastingInput.checked = schedule.fastingEnabled === "yes";
      fastingInput.dataset.synced = "true";
    }

    const supplementCheckbox = root.querySelector("#supplementUseCheckbox");
    if (supplementCheckbox && (forcePlanSync || !supplementCheckbox.dataset.synced)) {
      supplementCheckbox.checked = preferences.useSupplements === "yes" || Boolean(plan?.supplements?.length);
      supplementCheckbox.dataset.synced = "true";
    }

    const emailInput = root.querySelector("#nutritionEmailInput");
    if (emailInput && !emailInput.value) {
      emailInput.value = plan?.memberEmail || profile.memberEmail || profile.email || "";
    }

    if (forcePlanSync) {
      root.dataset.nutritionPlanSyncId = String(plan.id || "");
    }

    renderNutritionTargetPreview(root, model, escapeHtml);
  }

  function renderNutritionTargetPreview(root, model, escapeHtml) {
    const preview = root?.querySelector("#nutritionTargetPreview");
    const member = model?.member;

    if (!preview || !member || !window.BSMNutritionPlanEngine?.calculateNutritionTargets) {
      return;
    }

    const preferences = collectSupplementPreferences(root);
    const activeProgram = model?.activeProgram || member.programs?.[0]?.program || null;
    const targets = window.BSMNutritionPlanEngine.calculateNutritionTargets(
      { profile: member.profile || {}, latestMeasurement: member.measurements?.[0] || {}, activeProgram },
      preferences.nutritionGoalId,
      preferences,
    );

    preview.innerHTML = `
      <div>
        <strong>${escapeHtml(targets.selectedGoal.label)}</strong>
        <span>${escapeHtml(targets.targetCalories)} kcal • P ${escapeHtml(targets.macros.protein)} g • K ${escapeHtml(targets.macros.carbs)} g • Y ${escapeHtml(targets.macros.fat)} g</span>
        <small>Antrenman günü: ${escapeHtml(targets.trainingDayCalories)} kcal • Dinlenme günü: ${escapeHtml(targets.restDayCalories)} kcal</small>
      </div>
      <div class="nutrition-preview-flow">
        ${renderTimelinePreviewChip(preferences.wakeTime, "Uyanış", escapeHtml)}
        ${renderTimelinePreviewChip(preferences.firstMealTime, "İlk öğün", escapeHtml)}
        ${renderTimelinePreviewChip(preferences.workoutTime, "Antrenman", escapeHtml)}
        ${preferences.cardioTime ? renderTimelinePreviewChip(preferences.cardioTime, "Kardiyo", escapeHtml) : ""}
        ${renderTimelinePreviewChip(preferences.sleepTime, "Uyku", escapeHtml)}
        ${preferences.fastingEnabled === "yes" ? `<span class="nutrition-preview-chip">IF ${escapeHtml(preferences.fastingWindow || "16:8")}</span>` : ""}
      </div>
    `;
  }

  function renderMemberSummary(target, model, escapeHtml, deps) {
    const member = model?.member || null;
    const profile = member?.profile || {};
    const latestMeasurement = member?.measurements?.[0] || null;
    const goalLabel = deps.labelMaps?.goal?.[profile.goal] || profile.goal || "Belirtilmedi";

    if (!member) {
      target.innerHTML = `
        <div class="nutrition-member-empty">
          <strong>Önce üye seçin</strong>
          <span>Beslenme planı aktif üyenin ölçüm, hedef ve antrenman sıklığına göre hazırlanır.</span>
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
        <div class="nutrition-plan-placeholder">
          <p class="section-kicker">Canlı Önizleme</p>
          <h3>Henüz beslenme planı oluşturulmadı.</h3>
          <span>Sol taraftan hedef, saat akışı ve supplement tercihlerini seçip "Beslenme Planı Oluştur" düğmesine basın.</span>
        </div>
      `;
      return;
    }

    const displayPlan = withMealSupportFallback(plan);

    target.innerHTML = `
      <div class="nutrition-plan-card nutrition-report-card" data-nutrition-plan-id="${escapeHtml(plan.id)}">
        <header class="nutrition-report-hero">
          <div>
            <p class="section-kicker">Bahçeşehir Spor Merkezi</p>
            <h3>Sporcu Beslenme Planı</h3>
            <span>${escapeHtml(plan.memberName || "Üye")} için hedef, ölçüm, antrenman sıklığı ve günlük saat akışına göre hazırlanmış uygulanabilir plan.</span>
          </div>
          <div class="nutrition-report-stamp">
            <strong>BSM</strong>
            <span>${escapeHtml(plan.createdAt || "")}</span>
          </div>
        </header>

        <section class="nutrition-report-summary">
          <div><span>Üye</span><strong>${escapeHtml(plan.memberName || "Üye")}</strong></div>
          <div><span>Hedef</span><strong>${escapeHtml(plan.nutritionGoalLabel || formatNutritionGoal(plan.goal))}</strong></div>
          <div><span>Hedef grubu</span><strong>${escapeHtml(plan.nutritionGoalCategory || "-")}</strong></div>
          <div><span>Seviye</span><strong>${escapeHtml(formatNutritionLevel(plan.level))}</strong></div>
          <div><span>Antrenman</span><strong>${escapeHtml(plan.trainingDays || "-")} gün/hafta</strong></div>
          <div><span>BMR kaynağı</span><strong>${escapeHtml(plan.sourceSummary?.bmrSource || "Tahmini hesap")}</strong></div>
          <div><span>Koruma kalorisi</span><strong>${escapeHtml(plan.sourceSummary?.maintenanceCalories || "-")} kcal</strong></div>
          <div><span>Gün tipi</span><strong>${escapeHtml(formatDayType(plan.dayType))}</strong></div>
          <div><span>Öğün</span><strong>${escapeHtml(plan.mealCount || plan.meals?.length || "-")} öğün</strong></div>
        </section>

        <section class="nutrition-report-section nutrition-report-section--macros">
          <div class="nutrition-report-section__title">
            <span>01</span>
            <div>
              <strong>Günlük Kalori ve Makro Hedefleri</strong>
              <small>Değerler antrenör tarafından düzenlenebilir; PDF'de temiz rapor formatında görünür.</small>
            </div>
          </div>
          <div class="nutrition-macro-editor nutrition-report-macros">
            ${renderEditableMetric("Günlük kalori", "calories", plan.calories, "kcal", escapeHtml)}
            ${renderEditableMetric("Protein", "protein", plan.macros?.protein, "g", escapeHtml)}
            ${renderEditableMetric("Karbonhidrat", "carbs", plan.macros?.carbs, "g", escapeHtml)}
            ${renderEditableMetric("Yağ", "fat", plan.macros?.fat, "g", escapeHtml)}
          </div>
        </section>

        <section class="nutrition-report-section nutrition-report-section--timeline">
          <div class="nutrition-report-section__title">
            <span>02</span>
            <div>
              <strong>Saat Bazlı Günlük Akış</strong>
              <small>Öğün, antrenman, kardiyo, uyku ve destek zamanlaması tek çizgide.</small>
            </div>
          </div>
          ${renderNutritionTimeline(displayPlan.timeline || [], escapeHtml)}
        </section>

        <section class="nutrition-report-section">
          <div class="nutrition-report-section__title">
            <span>03</span>
            <div>
              <strong>Plan Mantığı</strong>
              <small>Ölçüm ve hedef verisine göre kısa profesyonel yorum.</small>
            </div>
          </div>
          <div class="nutrition-intelligence nutrition-report-note-grid">
            ${(plan.intelligence || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
            <p><strong>Plan mantığı:</strong> ${escapeHtml(buildPlanLogicText(plan))}</p>
          </div>
        </section>

        <section class="nutrition-report-section">
          <div class="nutrition-report-section__title">
            <span>04</span>
            <div>
              <strong>Günlük Öğün Planı</strong>
              <small>Pratik porsiyonlar, yaklaşık enerji ve makro dağılımı.</small>
            </div>
          </div>
          <div class="nutrition-meal-grid nutrition-report-meals">
            ${(displayPlan.meals || []).map((meal, index) => renderMealEditor(meal, index, escapeHtml)).join("")}
          </div>
        </section>

        <section class="nutrition-report-section nutrition-report-section--note">
          <div class="nutrition-report-section__title">
            <span>05</span>
            <div>
              <strong>Antrenör / Beslenme Notu</strong>
              <small>Üyeye verilecek kısa takip notu.</small>
            </div>
          </div>
          <label class="field compact-field nutrition-note-field">
            <span>Antrenör notu</span>
            <textarea id="nutritionTrainerNoteInput" rows="3" maxlength="420">${escapeHtml(plan.trainerNote || "")}</textarea>
          </label>
        </section>

        <footer class="nutrition-report-footer">
          <p class="nutrition-disclaimer">${escapeHtml(plan.disclaimer || "")}</p>
          <small>Bahçeşehir Spor Merkezi | Sporcu Beslenmesi Raporu</small>
        </footer>
      </div>
    `;
  }

  function formatNutritionGoal(goal) {
    const labels = {
      "fat-loss": "Yağ kaybı",
      "muscle-gain": "Kas kazanımı",
      strength: "Kuvvet / performans",
      conditioning: "Kondisyon",
      maintenance: "Form koruma",
    };

    return labels[goal] || goal || "Belirtilmedi";
  }

  function formatNutritionLevel(level) {
    const labels = {
      beginner: "Başlangıç",
      intermediate: "Orta",
      advanced: "İleri",
    };

    return labels[level] || level || "Belirtilmedi";
  }

  function formatDayType(value) {
    const labels = {
      balanced: "Dengeli gün",
      training: "Antrenman günü",
      rest: "Dinlenme günü",
    };

    return labels[value] || "Dengeli gün";
  }

  function buildPlanLogicText(plan) {
    const strategyText = {
      deficit: "kontrollü kalori açığı",
      surplus: "kontrollü kalori fazlası",
      maintenance: "koruma kalorisi",
      performance: "performans odaklı yakıt dengesi",
    };
    const strategy = strategyText[plan.nutritionStrategy] || "hedefe uygun kalori dengesi";
    return `${strategy} ile protein ${plan.macros?.protein || "-"} g, karbonhidrat ${plan.macros?.carbs || "-"} g ve yağ ${plan.macros?.fat || "-"} g olarak planlandı.`;
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
      time: root.querySelector(`[data-meal-index="${index}"][data-meal-field="time"]`)?.value || meal.time || "",
      timingLabel: meal.timingLabel || meal.name,
      scheduleRole: meal.scheduleRole || "meal",
      name: root.querySelector(`[data-meal-index="${index}"][data-meal-field="name"]`)?.value?.trim() || meal.name,
      foods: root.querySelector(`[data-meal-index="${index}"][data-meal-field="foods"]`)?.value?.trim() || meal.foods,
      calories: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="calories"]`)?.value) || meal.calories,
      protein: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="protein"]`)?.value) || meal.protein,
      carbs: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="carbs"]`)?.value) || meal.carbs,
      fat: readNumber(root.querySelector(`[data-meal-index="${index}"][data-meal-field="fat"]`)?.value) || meal.fat,
    }));
    edited.meals = withMealSupportFallback(edited).meals;
    const editedTotals = sumEditedMeals(edited.meals);
    edited.calories = editedTotals.calories;
    edited.macros = editedTotals.macros;
    edited.timeline = buildEditableTimeline(edited);
    edited.trainerNote = root.querySelector("#nutritionTrainerNoteInput")?.value?.trim() || "";
    return edited;
  }

  function collectSupplementPreferences(root) {
    const supplementCheckbox = root?.querySelector("#supplementUseCheckbox");
    const supplementSelect = root?.querySelector("#supplementUse");
    return {
      nutritionGoalId: root?.querySelector("#nutritionGoalSelect")?.value || "",
      mealCount: root?.querySelector("#nutritionMealCount")?.value || "5",
      dayType: root?.querySelector("#nutritionDayType")?.value || "balanced",
      wakeTime: root?.querySelector("#nutritionWakeTime")?.value || "07:30",
      firstMealTime: root?.querySelector("#nutritionFirstMealTime")?.value || "08:30",
      workoutTime: root?.querySelector("#nutritionWorkoutTime")?.value || "18:30",
      sleepTime: root?.querySelector("#nutritionSleepTime")?.value || "23:30",
      cardioTime: root?.querySelector("#nutritionCardioTime")?.value || "",
      fastingEnabled: root?.querySelector("#nutritionFastingEnabled")?.checked ? "yes" : "no",
      fastingWindow: root?.querySelector("#nutritionFastingWindow")?.value || "16:8",
      useSupplements: supplementCheckbox ? (supplementCheckbox.checked ? "yes" : "no") : supplementSelect?.value || "no",
      caffeineSensitive: root?.querySelector("#caffeineSensitive")?.value || "no",
      lactoseSensitive: root?.querySelector("#lactoseSensitive")?.value || "no",
      budget: root?.querySelector("#supplementBudget")?.value || "medium",
      supplementCategories: [...(root?.querySelectorAll('input[name="supplementCategories"]:checked') || [])].map((input) => input.value),
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

  function renderNutritionTimeline(items, escapeHtml) {
    const visibleItems = Array.isArray(items) ? items.slice(0, 12) : [];

    if (!visibleItems.length) {
      return `
        <div class="nutrition-timeline nutrition-timeline--empty">
          Saat bazlı akış plan oluşturulduğunda otomatik görünür.
        </div>
      `;
    }

    return `
      <div class="nutrition-timeline">
        ${visibleItems
          .map(
            (item) => `
              <article class="nutrition-timeline-item nutrition-timeline-item--${escapeHtml(item.kind || "meal")}">
                <strong>${escapeHtml(item.time || "--:--")}</strong>
                <span>${escapeHtml(item.title || "Plan adımı")}</span>
                <small>${escapeHtml(item.meta || "")}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderMealEditor(meal, index, escapeHtml) {
    return `
      <article class="nutrition-meal-card">
        <div class="nutrition-meal-card__header">
          <label class="edit-field nutrition-time-field">
            <span>Saat</span>
            <input type="time" value="${escapeHtml(meal.time || "")}" data-meal-index="${index}" data-meal-field="time" />
          </label>
          <span class="nutrition-meal-role">${escapeHtml(meal.timingLabel || meal.name || `Öğün ${index + 1}`)}</span>
        </div>
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
        ${renderMealSupports(meal.supports || [], escapeHtml)}
        ${renderMealAlternatives(meal.alternatives || [], escapeHtml)}
      </article>
    `;
  }

  function renderMealSupports(supports, escapeHtml) {
    if (!supports.length) {
      return "";
    }

    return `
      <div class="nutrition-meal-supports">
        <strong>Destekler</strong>
        ${supports
          .slice(0, 5)
          .map(
            (item) => `
              <span class="nutrition-meal-support">
                <b>${escapeHtml(item.name || "Supplement")}</b>
                <small>${escapeHtml(item.time || item.usageTime || item.timing || "Öğünle birlikte")} — ${escapeHtml(item.dose || item.suggestedDoseText || "")} — ${escapeHtml(item.water || "1 bardak su")} — ${escapeHtml(item.purpose || "Plan hedefini desteklemek")}</small>
              </span>
            `,
          )
          .join("")}
      </div>
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

  function withMealSupportFallback(plan) {
    const meals = Array.isArray(plan?.meals) ? plan.meals : [];
    const hasMealSupports = meals.some((meal) => Array.isArray(meal.supports) && meal.supports.length);

    if (hasMealSupports || !Array.isArray(plan?.supplements) || !plan.supplements.length) {
      return ensureNutritionTimeline(plan);
    }

    const attach = window.BSMNutritionPlanEngine?.attachSupplementsToMeals;
    return ensureNutritionTimeline({
      ...plan,
      meals: typeof attach === "function" ? attach(meals, plan.supplements) : attachSupportsLocally(meals, plan.supplements),
    });
  }

  function ensureNutritionTimeline(plan) {
    if (Array.isArray(plan?.timeline) && plan.timeline.length) {
      return plan;
    }

    return {
      ...plan,
      timeline: buildEditableTimeline(plan),
    };
  }

  function attachSupportsLocally(meals, supplements) {
    const mealList = meals.map((meal) => ({ ...meal, supports: Array.isArray(meal.supports) ? [...meal.supports] : [] }));
    supplements.forEach((item) => {
      const support = window.BSMNutritionPlanEngine?.buildSupplementSupport?.(item) || {
        name: item.supplementName || item.name || "Supplement",
        usageTime: item.suggestedTiming || item.timing || "Öğünle birlikte",
        dose: item.suggestedDoseText || item.note || "etiket dozuna göre",
        water: "1 bardak su",
        purpose: item.purpose || "Plan hedefini desteklemek",
      };
      const index = /uyku|gece/i.test(support.usageTime) ? mealList.length - 1 : /antrenman/i.test(support.usageTime) ? Math.min(1, mealList.length - 1) : 0;
      mealList[index]?.supports.push(support);
    });
    return mealList;
  }

  function buildEditableTimeline(plan) {
    const schedule = plan?.schedule || {};
    const items = [];

    if (schedule.wakeTime) {
      items.push({ time: schedule.wakeTime, kind: "wake", title: "Uyanış", meta: "Güne hazırlık" });
    }

    (plan?.meals || []).forEach((meal, index) => {
      items.push({
        time: meal.time || "",
        kind: meal.scheduleRole || "meal",
        title: meal.timingLabel || meal.name || `Öğün ${index + 1}`,
        meta: `${meal.calories || "-"} kcal | P ${meal.protein || "-"} g | K ${meal.carbs || "-"} g | Y ${meal.fat || "-"} g`,
      });
    });

    if (schedule.workoutTime) {
      items.push({ time: schedule.workoutTime, kind: "workout", title: "Antrenman", meta: "Performans bloğu" });
    }

    if (schedule.cardioTime) {
      items.push({ time: schedule.cardioTime, kind: "cardio", title: "Kardiyo", meta: "Opsiyonel kardiyo" });
    }

    if (schedule.sleepTime) {
      items.push({ time: schedule.sleepTime, kind: "sleep", title: "Uyku", meta: "Toparlanma" });
    }

    return items
      .filter((item) => item.time)
      .sort((a, b) => timeToSortValue(a.time) - timeToSortValue(b.time));
  }

  function renderTimelinePreviewChip(time, label, escapeHtml) {
    return `<span class="nutrition-preview-chip"><b>${escapeHtml(time || "--:--")}</b>${escapeHtml(label)}</span>`;
  }

  function getSupplementCategoryIcon(category) {
    const text = String(category || "").toLowerCase();
    if (text.includes("protein")) return "P";
    if (text.includes("amino")) return "AA";
    if (text.includes("performans")) return "PR";
    if (text.includes("yağ")) return "Y";
    if (text.includes("vitamin")) return "V";
    if (text.includes("mineral")) return "M";
    if (text.includes("eklem")) return "E";
    if (text.includes("sindirim")) return "S";
    if (text.includes("uyku") || text.includes("stres")) return "Z";
    if (text.includes("hidrasyon") || text.includes("elektrolit")) return "H";
    return "✓";
  }

  function getSupplementCategoryHint(category) {
    const text = String(category || "").toLowerCase();
    if (text.includes("protein")) return "Whey, casein, vegan protein";
    if (text.includes("performans")) return "Creatine, caffeine, beta alanine";
    if (text.includes("hidrasyon") || text.includes("elektrolit")) return "Sıvı ve mineral desteği";
    if (text.includes("vitamin") || text.includes("mineral")) return "Genel mikro besin desteği";
    return "Hedefe uygun opsiyonel destek";
  }

  function setControlValue(control, value, force = false) {
    if (!control || (!force && control.value)) {
      return;
    }

    control.value = value;
  }

  function readNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sumEditedMeals(meals) {
    return (meals || []).reduce(
      (total, meal) => ({
        calories: total.calories + readNumber(meal.calories),
        macros: {
          protein: total.macros.protein + readNumber(meal.protein),
          carbs: total.macros.carbs + readNumber(meal.carbs),
          fat: total.macros.fat + readNumber(meal.fat),
        },
      }),
      { calories: 0, macros: { protein: 0, carbs: 0, fat: 0 } },
    );
  }

  function timeToSortValue(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  window.BSMNutritionUI = {
    prepareNutritionControls,
    renderNutritionWorkspace,
    renderNutritionPlan,
    renderOutputNutritionPlan,
    collectNutritionPlanEdits,
    collectSupplementPreferences,
  };
})();
