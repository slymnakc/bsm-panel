// nutritionPlanFactory.js — Refactor Adım 3E1.
// tryAutoGenerateNutritionPlan livePreview orchestration fn'i app.js'den
// extract edildi. Davranis degisikligi yok; 4-asamali zincir birebir ayni:
//   buildNutritionPlan -> applyUserOverridesToPlan
//     -> applyMealOverridesToPlan -> ensureMealMacrosFallback
//
// KAPSAM ICI:
//   - tryAutoGenerateNutritionPlan(member) -> override-applied plan snapshot
//
// KAPSAM DISI (kasitli):
//   - generateNutritionButton handler (app.js'de kaliyor — raw engine plan write)
//   - capture phase + stopImmediatePropagation (degismiyor)
//   - save handler (app.js call-chain kullaniyor, modul disinda)
//
// DAVRANIS KORUMASI:
// 1. livePreview state'e yazilmaz (sadece return edilir)
// 2. Raw plan (state.activeNutritionPlan) generate handler tarafindan yazilir
// 3. Override chain sirasi degismez
// 4. Hata durumunda console.warn + null return (silent fail YASAK, log korunur)
// 5. typeof guard ile engine module yuklenmemis durumda null don
//
// Dependency injection (8 madde — koddan dogrulanmis):
//   state                            -> app state (closure)
//   buildNutritionPlan               -> BSMNutritionService.buildNutritionPlan
//   normalizeNutritionPlan           -> BSMNutritionService.normalizeNutritionPlan
//   buildPreferencesFromFormState    -> BSMNutritionPersistence
//   applyUserOverridesToPlan         -> BSMNutritionPersistence
//   applyMealOverridesToPlan         -> BSMNutritionPersistence
//   ensureMealMacrosFallback         -> BSMNutritionPdfPipeline
//   makeId                           -> BSMCoreUtils

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _state = null;
  var _buildNutritionPlan = null;
  var _normalizeNutritionPlan = function (p) { return p; };
  var _buildPreferencesFromFormState = function () { return {}; };
  var _applyUserOverridesToPlan = function (p) { return p; };
  var _applyMealOverridesToPlan = function (p) { return p; };
  var _ensureMealMacrosFallback = function (p) { return p; };
  var _makeId = function () { return ""; };

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    // buildNutritionPlan icin DEFAULT null — defansif typeof check icin
    if (typeof deps.buildNutritionPlan === "function") _buildNutritionPlan = deps.buildNutritionPlan;
    if (typeof deps.normalizeNutritionPlan === "function") _normalizeNutritionPlan = deps.normalizeNutritionPlan;
    if (typeof deps.buildPreferencesFromFormState === "function") _buildPreferencesFromFormState = deps.buildPreferencesFromFormState;
    if (typeof deps.applyUserOverridesToPlan === "function") _applyUserOverridesToPlan = deps.applyUserOverridesToPlan;
    if (typeof deps.applyMealOverridesToPlan === "function") _applyMealOverridesToPlan = deps.applyMealOverridesToPlan;
    if (typeof deps.ensureMealMacrosFallback === "function") _ensureMealMacrosFallback = deps.ensureMealMacrosFallback;
    if (typeof deps.makeId === "function") _makeId = deps.makeId;
  }

  // ═══════════════════════════════════════════════════════════════════
  // tryAutoGenerateNutritionPlan — Live preview icin auto-generate.
  // Form state'inden cikan plan'i 4-asamali override chain'inden gecirir.
  // State'e yazilmaz — caller (renderer/save/print) snapshot olarak kullanir.
  //
  // Davranis (birebir korundu):
  //   1. Member yoksa veya engine fn injection eksikse null don
  //   2. buildPreferencesFromFormState -> engine input
  //   3. activeProgram: state.activeProgram > member.programs[0].program > null
  //   4. buildNutritionPlan -> normalizeNutritionPlan -> initial plan
  //   5. applyUserOverridesToPlan (kalori/makro scale)
  //   6. applyMealOverridesToPlan (manuel meal edits)
  //   7. ensureMealMacrosFallback (P0K0Y0 koruma)
  //   8. try/catch: hata durumunda console.warn + null
  // ═══════════════════════════════════════════════════════════════════
  function tryAutoGenerateNutritionPlan(member) {
    if (!member || typeof _buildNutritionPlan !== "function") return null;
    try {
      const preferences = _buildPreferencesFromFormState();
      const activeProgram = _state.activeProgram || member.programs?.[0]?.program || null;
      let plan = _normalizeNutritionPlan(_buildNutritionPlan(member, activeProgram, preferences, { makeId: _makeId }));
      // v1.3.3: User override (kalori/makro) engine sonucunu basar + meals orantili scale
      plan = _applyUserOverridesToPlan(plan, _state.nutritionFormState);
      // v1.3.4: Manuel meal overrides + diversification post-process
      plan = _applyMealOverridesToPlan(plan, _state.nutritionFormState);
      // v1.3.6: P0 K0 Y0 fallback — engine meal macros bos/0 ise kaloriden 30/45/25 split
      plan = _ensureMealMacrosFallback(plan);
      return plan;
    } catch (e) {
      console.warn("Nutrition auto-generate skipped:", e?.message);
      return null;
    }
  }

  window.BSMNutritionPlanFactory = {
    init: init,
    tryAutoGenerateNutritionPlan: tryAutoGenerateNutritionPlan,
  };
})();
