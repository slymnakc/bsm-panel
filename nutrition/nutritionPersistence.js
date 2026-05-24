// nutritionPersistence.js — Refactor Adım 3C.
// Save + Print event handler'lari + form/plan mutation helpers app.js'den
// extract edildi. Davranis degisikligi yok; save flow, persist zinciri ve
// PDF print flow birebir ayni. Preview ↔ export parity korunuyor.
//
// KAPSAM ICI:
//   - saveNutritionButton click handler
//   - printNutritionButton click handler
//   - seedNutritionFormFromMember(member, plan)
//   - buildPreferencesFromFormState()
//   - applyUserOverridesToPlan(plan, formState)
//   - applyMealOverridesToPlan(plan, formState)
//
// KAPSAM DISI (kasitli, scope buyutmemek icin):
//   - updateNutritionGenerateButtonLabel (view-state, persistence degil)
//   - setNutritionPdfActivePage (PDF tab nav)
//   - generateNutritionButton handler (separate concern)
//   - tryAutoGenerateNutritionPlan (live preview, app.js'de kaliyor)
//   - persistMembers (local storage + supabase wrapper, app.js'de kaliyor)
//
// Dependency injection (init):
//   state                            → app state (closure)
//   showStatus                       → toast notify (callback)
//   findActiveMember                 → app.js fn (callback)
//   tryAutoGenerateNutritionPlan     → app.js fn (callback)
//   persistMembers                   → app.js fn (callback)
//   renderMemberWorkspace            → app.js fn (callback)
//   renderNutritionWorkspace         → app.js fn (callback)
//   prepareNutritionPrintRoot        → BSMNutritionPdfPipeline (direct ref)
//   cleanupNutritionPrintRoot        → BSMNutritionPdfPipeline (direct ref)
//   mealOverrideKey                  → BSMNutritionHelpers (direct ref)
//   calcFoodMacros                   → BSMNutritionHelpers (direct ref)
//   findFoodById                     → BSMNutritionHelpers (direct ref)

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _state = null;
  var _showStatus = function () {};
  var _findActiveMember = function () { return null; };
  var _tryAutoGenerateNutritionPlan = function () { return null; };
  var _persistMembers = function () {};
  var _renderMemberWorkspace = function () {};
  var _renderNutritionWorkspace = function () {};
  var _prepareNutritionPrintRoot = function () {};
  var _cleanupNutritionPrintRoot = function () {};
  var _mealOverrideKey = function (i) { return String(i); };
  var _calcFoodMacros = function () { return { calories: 0, protein: 0, carbs: 0, fat: 0 }; };
  var _findFoodById = function () { return null; };

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.showStatus === "function") _showStatus = deps.showStatus;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.tryAutoGenerateNutritionPlan === "function") _tryAutoGenerateNutritionPlan = deps.tryAutoGenerateNutritionPlan;
    if (typeof deps.persistMembers === "function") _persistMembers = deps.persistMembers;
    if (typeof deps.renderMemberWorkspace === "function") _renderMemberWorkspace = deps.renderMemberWorkspace;
    if (typeof deps.renderNutritionWorkspace === "function") _renderNutritionWorkspace = deps.renderNutritionWorkspace;
    if (typeof deps.prepareNutritionPrintRoot === "function") _prepareNutritionPrintRoot = deps.prepareNutritionPrintRoot;
    if (typeof deps.cleanupNutritionPrintRoot === "function") _cleanupNutritionPrintRoot = deps.cleanupNutritionPrintRoot;
    if (typeof deps.mealOverrideKey === "function") _mealOverrideKey = deps.mealOverrideKey;
    if (typeof deps.calcFoodMacros === "function") _calcFoodMacros = deps.calcFoodMacros;
    if (typeof deps.findFoodById === "function") _findFoodById = deps.findFoodById;
  }

  // ═══════════════════════════════════════════════════════════════════
  // FORM STATE: üye profilinden + son ölçümden + mevcut plandan form'u doldur
  // ═══════════════════════════════════════════════════════════════════
  function seedNutritionFormFromMember(member, plan) {
    const profile = member?.profile || {};
    const f = _state.nutritionFormState;

    // Goal: profile goal'unden map
    if (profile.goal === "fat-loss" || profile.goal === "weight-loss") f.goal = "fat-loss";
    else if (profile.goal === "muscle-gain") f.goal = "muscle-gain";
    else if (profile.goal === "recomposition") f.goal = "recomposition";
    else if (profile.goal === "maintenance" || profile.goal === "preservation") f.goal = "maintenance";

    // Plan varsa onun degerleri form'a yansisin
    if (plan) {
      if (plan.calories) f.calories = plan.calories;
      if (plan.macros?.protein) f.protein = plan.macros.protein;
      if (plan.macros?.carbs) f.carbs = plan.macros.carbs;
      if (plan.macros?.fat) f.fat = plan.macros.fat;
      if (plan.mealCount) f.mealCount = plan.mealCount;
      if (plan.dayType) f.dayType = plan.dayType;
      const prefs = plan.supplementPreferences || {};
      if (prefs.workoutTime) f.workoutTime = prefs.workoutTime;
      if (prefs.cardioTime !== undefined) f.cardioTime = prefs.cardioTime;
      if (prefs.fastingEnabled === "yes") f.fastingEnabled = true;
      if (prefs.fastingWindow) f.fastingWindow = prefs.fastingWindow;
      if (prefs.useSupplements === "yes") f.supplementUse = true;
      if (Array.isArray(prefs.supplementCategories) && prefs.supplementCategories.length) {
        f.supplementCategories = prefs.supplementCategories;
      }
      if (prefs.caffeineSensitive) f.caffeineSensitive = prefs.caffeineSensitive;
      if (prefs.lactoseSensitive) f.lactoseSensitive = prefs.lactoseSensitive;
      if (plan.trainerNote) f.trainerNote = plan.trainerNote;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FORM → ENGINE PREFERENCES: nutritionFormState -> buildNutritionPlan inputu
  // ═══════════════════════════════════════════════════════════════════
  function buildPreferencesFromFormState() {
    const f = _state.nutritionFormState;
    const goalIdMap = {
      "fat-loss": "fat-loss-classic",
      "muscle-gain": "muscle-gain-lean",
      "maintenance": "maintenance",
      "recomposition": "recomposition",
    };
    return {
      nutritionGoalId: goalIdMap[f.goal] || "maintenance",
      mealCount: f.mealCount,
      dayType: f.dayType,
      wakeTime: "07:30",
      firstMealTime: "08:30",
      workoutTime: f.workoutTime || "18:30",
      cardioTime: f.cardioTime || "",
      sleepTime: "23:30",
      fastingEnabled: f.fastingEnabled ? "yes" : "no",
      fastingWindow: f.fastingWindow || "16:8",
      useSupplements: f.supplementUse ? "yes" : "no",
      supplementCategories: f.supplementCategories,
      caffeineSensitive: f.caffeineSensitive,
      lactoseSensitive: f.lactoseSensitive,
      budget: "medium",
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // USER OVERRIDE: user'in custom kalori/makro hedefi engine sonucunu override eder
  // v1.3.3: Engine measurement+goal'a gore plan yapar; user explicit kalori girerse
  // o degerle plan.calories override + meals orantili scale + macros redistribute.
  // ═══════════════════════════════════════════════════════════════════
  function applyUserOverridesToPlan(plan, formState) {
    if (!plan || !formState) return plan;
    const userCal = Number(formState.calories);
    const userP = Number(formState.protein);
    const userC = Number(formState.carbs);
    const userF = Number(formState.fat);
    const hasUserCal = Number.isFinite(userCal) && userCal > 0;
    // v1.3.3: Her makro BAGIMSIZ override edilebilir. Onceki "all-or-none" yaklaşımı
    // spec'in "protein gramaji degisince ogunlerdeki gramajlar degissin" kuralini
    // kirinca tekil override'lar etkisiz kaliyordu.
    const hasUserP = Number.isFinite(userP) && userP > 0;
    const hasUserC = Number.isFinite(userC) && userC > 0;
    const hasUserF = Number.isFinite(userF) && userF > 0;

    const oldCal = plan.calories || 1;
    const oldP = plan.macros?.protein || 1;
    const oldC = plan.macros?.carbs || 1;
    const oldF = plan.macros?.fat || 1;
    // Hedef kalori: user girdise o, yoksa engine + (eger user macros girdiyse) makro
    // toplamindan turetilen yeni kalori.
    const calScale = (hasUserCal ? userCal : oldCal) / oldCal;
    const targetP = hasUserP ? userP : Math.round(oldP * calScale);
    const targetC = hasUserC ? userC : Math.round(oldC * calScale);
    const targetF = hasUserF ? userF : Math.round(oldF * calScale);
    // Kalori bagimsiz hesabi: user kalori vermediyse + bir veya daha cok makro
    // override ettiyse, yeni kalori makrolardan hesaplanir.
    const macroDerivedKcal = targetP * 4 + targetC * 4 + targetF * 9;
    const targetCal = hasUserCal
      ? userCal
      : (hasUserP || hasUserC || hasUserF ? macroDerivedKcal : oldCal);
    const targetTotalKcal = macroDerivedKcal || targetCal;

    plan.calories = targetCal;
    plan.macros = { protein: targetP, carbs: targetC, fat: targetF };

    // v1.3.3: Meals'i orantili scale et + macro fallback.
    // Engine meals'inin macros'u eksik gelirse meal.calories oraniyla
    // hedef makrolar uzerinden tahmini macros set edilir.
    if (Array.isArray(plan.meals) && plan.meals.length) {
      const mealOldTotal = plan.meals.reduce((s, m) => s + (Number(m.calories) || 0), 0) || 1;
      plan.meals = plan.meals.map((meal) => {
        const ratio = (Number(meal.calories) || 0) / mealOldTotal;
        const mCal = Math.round(targetCal * ratio);
        const oldMP = Number(meal.macros?.protein) || 0;
        const oldMC = Number(meal.macros?.carbs) || 0;
        const oldMF = Number(meal.macros?.fat) || 0;
        // Engine macros varsa scale et; yoksa kalori oranindan turet
        const newMP = oldMP > 0 ? Math.round((oldMP / oldP) * targetP) : Math.round(targetP * ratio);
        const newMC = oldMC > 0 ? Math.round((oldMC / oldC) * targetC) : Math.round(targetC * ratio);
        const newMF = oldMF > 0 ? Math.round((oldMF / oldF) * targetF) : Math.round(targetF * ratio);
        return {
          ...meal,
          calories: mCal,
          macros: { protein: newMP, carbs: newMC, fat: newMF },
        };
      });
    }

    return plan;
  }

  // ═══════════════════════════════════════════════════════════════════
  // MEAL OVERRIDE: state.nutritionFormState.mealOverrides -> plan.meals merge
  // v1.3.4: Override edilen meal'in foods/name/time'i override'tan alinir,
  // kcal/macros food library'den yeniden hesaplanir. Plan.calories ve plan.macros
  // TUM meals'in toplamindan TURETILIR (manuel edit totals'a yansisin).
  // ═══════════════════════════════════════════════════════════════════
  function applyMealOverridesToPlan(plan, formState) {
    if (!plan || !Array.isArray(plan.meals)) return plan;
    const overrides = formState?.mealOverrides || {};
    if (!Object.keys(overrides).length) return plan;

    plan.meals = plan.meals.map((meal, idx) => {
      const key = _mealOverrideKey(idx);
      const ov = overrides[key];
      if (!ov) return meal;
      // Override foods: her food {id, grams} -> macros hesapla
      const foods = Array.isArray(ov.foods) ? ov.foods.filter((f) => f && f.id) : [];
      if (foods.length) {
        const totals = foods.reduce((acc, f) => {
          const macros = _calcFoodMacros(f.id, f.grams);
          acc.calories += macros.calories;
          acc.protein += macros.protein;
          acc.carbs += macros.carbs;
          acc.fat += macros.fat;
          return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
        return {
          ...meal,
          name: ov.name || meal.name,
          time: ov.time || meal.time,
          scheduledTime: ov.time || meal.scheduledTime || meal.time,
          foods: foods.map((f) => {
            const food = _findFoodById(f.id);
            return { ...f, name: food?.name || f.id, displayLabel: `${food?.name || f.id} ${Math.round(f.grams)}g` };
          }),
          calories: totals.calories,
          macros: {
            protein: Math.round(totals.protein),
            carbs: Math.round(totals.carbs),
            fat: Math.round(totals.fat),
          },
          isOverridden: true,
        };
      }
      return { ...meal, name: ov.name || meal.name, time: ov.time || meal.time };
    });

    // Plan.calories ve plan.macros'u meal toplamlarindan TURETIR (manuel edit yansisin)
    const planTotal = plan.meals.reduce((acc, m) => {
      acc.calories += Number(m.calories) || 0;
      acc.protein += Number(m.macros?.protein) || 0;
      acc.carbs += Number(m.macros?.carbs) || 0;
      acc.fat += Number(m.macros?.fat) || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    // Engine'in original hedeflerini sakla (target vs actual gosterimi icin)
    plan.targetCalories = plan.targetCalories || plan.calories;
    plan.targetMacros = plan.targetMacros || { ...plan.macros };
    plan.calories = planTotal.calories;
    plan.macros = { protein: Math.round(planTotal.protein), carbs: Math.round(planTotal.carbs), fat: Math.round(planTotal.fat) };
    return plan;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SAVE HANDLER: livePreview snapshot al + state.activeNutritionPlan +
  // member.nutritionPlan + member.nutritionPlans (history) + persistMembers
  // v1.3.8 FIX: SAVE = ekrandaki canli plan (eski state.activeNutritionPlan
  // user'in son duzenlemelerini icermiyordu).
  // ═══════════════════════════════════════════════════════════════════
  function saveHandler(e) {
    const member = _findActiveMember();
    const plan = _tryAutoGenerateNutritionPlan(member) || _state.activeNutritionPlan;
    if (!member || !plan) {
      _showStatus("Kaydedilecek beslenme planı yok. Önce plan oluşturun.", "error");
      e.stopImmediatePropagation();
      return;
    }
    _state.activeNutritionPlan = plan;
    _state.activeNutritionMemberId = member.id;
    member.nutritionPlan = plan;
    member.nutritionPlans = [plan, ...(member.nutritionPlans || []).filter((it) => it.id !== plan.id)].slice(0, 12);
    member.updatedAt = new Date().toISOString();
    _persistMembers();
    _renderMemberWorkspace();
    _renderNutritionWorkspace();
    _showStatus("Beslenme planı üye dosyasına kaydedildi.", "success");
    e.stopImmediatePropagation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRINT HANDLER: livePreview ONCELIK + prepareNutritionPrintRoot +
  // window.print + cleanup (afterprint event + 1500ms fallback timeout).
  // v1.3.3: body altinda temiz Print Root clone uret, dashboard
  // transform/sticky parent zincirini bypass et.
  // ═══════════════════════════════════════════════════════════════════
  function printHandler(e) {
    const member = _findActiveMember();
    const plan = _tryAutoGenerateNutritionPlan(member) || _state.activeNutritionPlan;
    if (!plan) {
      _showStatus("PDF için önce plan oluşturun.", "error");
      e.stopImmediatePropagation();
      return;
    }
    try {
      _prepareNutritionPrintRoot(member, plan);
      document.body.classList.add("is-printing-nutrition");
      window.setTimeout(() => {
        window.print();
        // Cleanup print sonrasi; bazi tarayicilarda afterprint event guvenilir degil,
        // bu yuzden hem afterprint hem fallback timeout kullaniyoruz.
        const cleanup = () => {
          _cleanupNutritionPrintRoot();
          document.body.classList.remove("is-printing-nutrition");
          window.removeEventListener("afterprint", cleanup);
        };
        window.addEventListener("afterprint", cleanup, { once: true });
        window.setTimeout(cleanup, 1500);
      }, 80);
    } catch (err) {
      _cleanupNutritionPrintRoot();
      document.body.classList.remove("is-printing-nutrition");
      _showStatus("PDF üretilemedi: " + (err?.message || ""), "error");
      console.error(err);
    }
    e.stopImmediatePropagation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // EVENT BINDING — idempotent guard: bsmPersistenceBound flag
  // App.js bindApplicationHandlers icinden bir kez cagrilir.
  // ═══════════════════════════════════════════════════════════════════
  function bindNutritionPersistenceHandlers() {
    const saveBtn = document.querySelector("#saveNutritionButton");
    const printBtn = document.querySelector("#printNutritionButton");

    if (saveBtn && saveBtn.dataset.bsmPersistenceBound !== "true") {
      saveBtn.addEventListener("click", saveHandler, true);
      saveBtn.dataset.bsmPersistenceBound = "true";
    }
    if (printBtn && printBtn.dataset.bsmPersistenceBound !== "true") {
      printBtn.addEventListener("click", printHandler, true);
      printBtn.dataset.bsmPersistenceBound = "true";
    }
  }

  window.BSMNutritionPersistence = {
    init: init,
    // Form/plan mutation API (app.js destructure)
    seedNutritionFormFromMember: seedNutritionFormFromMember,
    buildPreferencesFromFormState: buildPreferencesFromFormState,
    applyUserOverridesToPlan: applyUserOverridesToPlan,
    applyMealOverridesToPlan: applyMealOverridesToPlan,
    // Event binding API
    bindNutritionPersistenceHandlers: bindNutritionPersistenceHandlers,
  };
})();
