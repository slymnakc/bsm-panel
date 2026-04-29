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

    function handlePrintNutritionPlan() {
      const editedPlan = collectNutritionPlanEdits(nutritionPlanEditor, state.activeNutritionPlan);

      if (editedPlan) {
        state.activeNutritionPlan = normalizeNutritionPlan(editedPlan);
        renderNutritionWorkspace();
      }

      windowObject.print();
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
      handleNutritionInput,
    };
  }

  function bindNutritionHandlers(elements, handlers) {
    bindIf(elements.generateNutritionButton, "click", handlers.handleGenerateNutritionPlan);
    bindIf(elements.saveNutritionButton, "click", handlers.handleSaveNutritionPlan);
    bindIf(elements.printNutritionButton, "click", handlers.handlePrintNutritionPlan);
    bindIf(elements.nutritionPlanEditor, "input", handlers.handleNutritionInput);
    bindIf(elements.nutritionPlanEditor, "change", handlers.handleNutritionInput);
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
