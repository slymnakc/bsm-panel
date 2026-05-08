(function () {
  "use strict";

  function createNutritionHandlers(deps) {
    const {
      state,
      findActiveMember,
      buildNutritionPlan,
      normalizeNutritionPlan,
      collectSupplementPreferences,
      collectNutritionPlanEdits,
      renderNutritionWorkspace,
      renderNutritionOutput,
      persistMembers,
      renderMemberWorkspace,
      showStatus,
      makeId,
      nutritionPanel,
      nutritionPlanEditor,
      generateNutritionPdf,
      sendNutritionPlanEmail,
      windowObject = window,
    } = deps;

    function handleGenerateNutritionPlan() {
      const member = findActiveMember();

      if (!member) {
        showStatus("Beslenme planı için önce bir üye seçin.", "error");
        renderNutritionWorkspace();
        return;
      }

      const preferences = collectSupplementPreferences(nutritionPanel);
      const activeProgram = state.activeProgram || member.programs?.[0]?.program || null;
      state.activeNutritionPlan = buildNutritionPlan(member, activeProgram, preferences, { makeId });
      state.activeNutritionMemberId = member.id;
      renderNutritionWorkspace();
      showStatus("Beslenme planı oluşturuldu. İsterseniz alanları düzenleyip kaydedebilirsiniz.", "success");
    }

    function handleSaveNutritionPlan() {
      const member = findActiveMember();

      if (!member) {
        showStatus("Beslenme planını kaydetmek için önce aktif üye seçin.", "error");
        return;
      }

      const editedPlan = collectNutritionPlanEdits(nutritionPlanEditor, state.activeNutritionPlan || member.nutritionPlan);
      const normalizedPlan = normalizeNutritionPlan(editedPlan);

      if (!normalizedPlan) {
        showStatus("Kaydedilecek beslenme planı yok. Önce plan oluşturun.", "error");
        return;
      }

      const validationMessage = validateNutritionPlan(normalizedPlan);

      if (validationMessage) {
        showStatus(validationMessage, "error");
        return;
      }

      member.nutritionPlan = normalizedPlan;
      member.nutritionPlans = [normalizedPlan, ...(member.nutritionPlans || []).filter((item) => item.id !== normalizedPlan.id)].slice(0, 12);
      member.updatedAt = new Date().toISOString();
      state.activeNutritionPlan = normalizedPlan;
      state.activeNutritionMemberId = member.id;
      persistMembers();
      renderMemberWorkspace();
      renderNutritionWorkspace();
      renderNutritionOutput();
      showStatus("Beslenme planı üye dosyasına kaydedildi.", "success");
    }

    async function handlePrintNutritionPlan() {
      const editedPlan = collectNutritionPlanEdits(nutritionPlanEditor, state.activeNutritionPlan);

      if (editedPlan) {
        state.activeNutritionPlan = normalizeNutritionPlan(editedPlan);
        renderNutritionWorkspace();
      }

      showStatus("Premium beslenme PDF'i hazırlanıyor...", "success");
      const result = generateNutritionPdf
        ? await generateNutritionPdf(state.activeNutritionPlan, { windowObject })
        : (windowObject.print(), { ok: true, message: "Eski yazdırma fallback'i açıldı." });

      if (result?.message) {
        showStatus(result.message, result.ok === false ? "error" : "success");
      }
    }

    async function handleSendNutritionPlanEmail() {
      const editedPlan = collectNutritionPlanEdits(nutritionPlanEditor, state.activeNutritionPlan);
      const plan = normalizeNutritionPlan(editedPlan || state.activeNutritionPlan);

      if (!plan) {
        showStatus("Mail göndermek için önce beslenme planı oluşturun.", "error");
        return;
      }

      const email = nutritionPanel?.querySelector("#nutritionEmailInput")?.value?.trim() || plan.memberEmail || "";

      if (!sendNutritionPlanEmail) {
        showStatus("Beslenme mail servisi hazır değil. Lütfen paneli güncelleyip tekrar deneyin.", "error");
        return;
      }

      showStatus("Beslenme planı mail olarak gönderiliyor...", "success");
      const result = await sendNutritionPlanEmail({ email, planData: plan });
      showStatus(result.message, result.ok ? "success" : "error");
    }

    function handleNutritionPreferencesChange(event) {
      if (event?.target?.closest?.("#nutritionPlanEditor")) {
        return;
      }

      renderNutritionWorkspace();
    }

    function handleNutritionInput() {
      const editedPlan = collectNutritionPlanEdits(nutritionPlanEditor, state.activeNutritionPlan);

      if (editedPlan) {
        state.activeNutritionPlan = normalizeNutritionPlan(editedPlan);
        renderNutritionOutput();
      }
    }

    return {
      handleGenerateNutritionPlan,
      handleSaveNutritionPlan,
      handlePrintNutritionPlan,
      handleSendNutritionPlanEmail,
      handleNutritionInput,
      handleNutritionPreferencesChange,
    };
  }

  function bindNutritionHandlers(elements, handlers) {
    bindIf(elements.generateNutritionButton, "click", handlers.handleGenerateNutritionPlan);
    bindIf(elements.saveNutritionButton, "click", handlers.handleSaveNutritionPlan);
    bindIf(elements.printNutritionButton, "click", handlers.handlePrintNutritionPlan);
    bindIf(elements.sendNutritionMailButton, "click", handlers.handleSendNutritionPlanEmail);
    bindIf(elements.nutritionPlanEditor, "input", handlers.handleNutritionInput);
    bindIf(elements.nutritionPlanEditor, "change", handlers.handleNutritionInput);
    bindNutritionControlEvents(elements.nutritionPanel, handlers.handleNutritionPreferencesChange);
  }

  function bindNutritionControlEvents(root, handler) {
    if (!root || !handler) {
      return;
    }

    [
      "#nutritionGoalSelect",
      "#nutritionMealCount",
      "#nutritionDayType",
      "#nutritionWakeTime",
      "#nutritionFirstMealTime",
      "#nutritionWorkoutTime",
      "#nutritionSleepTime",
      "#nutritionCardioTime",
      "#nutritionFastingEnabled",
      "#nutritionFastingWindow",
      "#supplementUse",
      "#supplementUseCheckbox",
      "#caffeineSensitive",
      "#lactoseSensitive",
      "#supplementBudget",
      "#supplementCategoryList",
    ].forEach((selector) => {
      root.querySelector(selector)?.addEventListener("change", handler);
    });
  }

  function validateNutritionPlan(plan) {
    if (!plan.calories || plan.calories < 900) {
      return "Günlük kalori değeri çok düşük görünüyor. Lütfen kontrol edin.";
    }

    if (!plan.macros?.protein || !plan.macros?.carbs || !plan.macros?.fat) {
      return "Protein, karbonhidrat ve yağ değerleri boş bırakılamaz.";
    }

    if (!(plan.meals || []).length || plan.meals.some((meal) => !meal.name || !meal.foods)) {
      return "Tüm öğünlerde ad ve besin/porsiyon bilgisi bulunmalıdır.";
    }

    return "";
  }

  function bindIf(target, eventName, handler) {
    if (!target || !handler) {
      return;
    }

    target.addEventListener(eventName, handler);
  }

  window.BSMNutritionHandlers = {
    createNutritionHandlers,
    bindNutritionHandlers,
  };
})();
