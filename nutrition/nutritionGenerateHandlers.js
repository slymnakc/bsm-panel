// nutritionGenerateHandlers.js — Refactor Adım 3E2.
// generateNutritionButton click handler app.js'den extract edildi.
// Davranis degisikligi yok — capture phase + stopImmediatePropagation +
// raw plan write + state.activeNutritionMemberId sync + try/catch birebir ayni.
// Eklenen TEK koruma: idempotent bind (dataset.bsmGenerateBound === "true").
//
// KAPSAM ICI:
//   - generateNutritionButton click handler (capture phase, stopImmediatePropagation)
//
// KAPSAM DISI (kasitli):
//   - saveNutritionButton handler (3C'de Persistence'ta)
//   - printNutritionButton handler (3C'de Persistence'ta)
//   - tryAutoGenerateNutritionPlan (3E1'de PlanFactory'de)
//   - Legacy BSMNutritionHandlers.handleGenerateNutritionPlan (bubble phase, app.js'de kaliyor)
//
// DAVRANIS KORUMALARI:
// 1. Capture phase: addEventListener(..., true) — legacy bubble handler ONCEDEN
//    bypass edilir (stopImmediatePropagation ile durdurulur)
// 2. stopImmediatePropagation: hem member-yok early-return'de hem normal yolda
// 3. Raw plan write: state.activeNutritionPlan = normalizeNutritionPlan(buildNutritionPlan(...))
//    OVERRIDE CHAIN UYGULANMAZ — livePreview adapter'in (PlanFactory) gorevi
// 4. state.activeNutritionMemberId = member.id (sync)
// 5. try/catch: console.error(err) + showStatus("Beslenme planı üretilemedi: ...")
//    SILENT FAIL YASAK
// 6. renderNutritionWorkspace() — plan create sonrasi UI tetikleyici
// 7. Sync flow — no async, no Promise, no await
// 8. Duplicate bind guard: dataset.bsmGenerateBound flag
//
// Dependency injection (8 madde — koddan dogrulanmis):
//   state                            -> app state (closure)
//   showStatus                       -> app.js fn (callback)
//   findActiveMember                 -> app.js fn (callback)
//   renderNutritionWorkspace         -> app.js fn (callback)
//   buildPreferencesFromFormState    -> BSMNutritionPersistence (3C)
//   buildNutritionPlan               -> BSMNutritionService — engine
//   normalizeNutritionPlan           -> BSMNutritionService — normalize
//   makeId                           -> BSMCoreUtils — id generator

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _state = null;
  var _showStatus = function () {};
  var _findActiveMember = function () { return null; };
  var _renderNutritionWorkspace = function () {};
  var _buildPreferencesFromFormState = function () { return {}; };
  // buildNutritionPlan + normalizeNutritionPlan engine fn'leri — DEFAULT null
  // ki app.js'deki typeof check yapilmasa bile defansif davranisi koruyabilelim
  var _buildNutritionPlan = null;
  var _normalizeNutritionPlan = function (p) { return p; };
  var _makeId = function () { return ""; };

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.showStatus === "function") _showStatus = deps.showStatus;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.renderNutritionWorkspace === "function") _renderNutritionWorkspace = deps.renderNutritionWorkspace;
    if (typeof deps.buildPreferencesFromFormState === "function") _buildPreferencesFromFormState = deps.buildPreferencesFromFormState;
    if (typeof deps.buildNutritionPlan === "function") _buildNutritionPlan = deps.buildNutritionPlan;
    if (typeof deps.normalizeNutritionPlan === "function") _normalizeNutritionPlan = deps.normalizeNutritionPlan;
    if (typeof deps.makeId === "function") _makeId = deps.makeId;
  }

  // ═══════════════════════════════════════════════════════════════════
  // GENERATE HANDLER — capture phase + stopImmediatePropagation
  // v1.2.4: Legacy generate handler eski #nutritionMealCount/#nutritionDayType
  // input'larini okuyor; premium UI bunlari segment/farkli ID kullaniyor.
  // Bu yuzden generate butonuna capture-phase ile bir on-handler ekliyoruz:
  // nutritionFormState'ten direkt build yapsin + legacy bubble'i durdursun.
  //
  // Davranis (birebir korundu):
  //   1. findActiveMember() — member yoksa showStatus + stopImmediatePropagation + return
  //   2. try block:
  //      a. buildPreferencesFromFormState() -> engine input
  //      b. activeProgram fallback: state.activeProgram > member.programs[0].program > null
  //      c. state.activeNutritionPlan = normalizeNutritionPlan(buildNutritionPlan(...))
  //         RAW engine output — override chain UYGULANMAZ
  //      d. state.activeNutritionMemberId = member.id
  //      e. renderNutritionWorkspace()
  //      f. showStatus("Beslenme planı oluşturuldu.", "success")
  //   3. catch (err):
  //      a. showStatus("Beslenme planı üretilemedi: ...", "error")
  //      b. console.error(err)
  //   4. stopImmediatePropagation() — try/catch'in DISINDA, her zaman calisir
  // ═══════════════════════════════════════════════════════════════════
  function generateClickHandler(e) {
    const member = _findActiveMember();
    if (!member) {
      _showStatus("Beslenme planı için önce bir üye seçin.", "error");
      e.stopImmediatePropagation();
      return;
    }
    try {
      const preferences = _buildPreferencesFromFormState();
      const activeProgram = _state.activeProgram || member.programs?.[0]?.program || null;
      _state.activeNutritionPlan = _normalizeNutritionPlan(_buildNutritionPlan(member, activeProgram, preferences, { makeId: _makeId }));
      _state.activeNutritionMemberId = member.id;
      _renderNutritionWorkspace();
      _showStatus("Beslenme planı oluşturuldu.", "success");
    } catch (err) {
      _showStatus("Beslenme planı üretilemedi: " + (err?.message || ""), "error");
      console.error(err);
    }
    // Legacy handleGenerateNutritionPlan'in tekrar build etmemesi icin durdur
    e.stopImmediatePropagation();
  }

  // ═══════════════════════════════════════════════════════════════════
  // EVENT BINDING — idempotent guard: bsmGenerateBound flag
  // App.js bindApplicationHandlers icinden bir kez cagrilir.
  // ═══════════════════════════════════════════════════════════════════
  function bindNutritionGenerateHandler() {
    const btn = document.querySelector("#generateNutritionButton");
    if (!btn) return;
    if (btn.dataset.bsmGenerateBound === "true") return;
    // Capture phase — addEventListener'in 3. parametresi `true`
    btn.addEventListener("click", generateClickHandler, true);
    btn.dataset.bsmGenerateBound = "true";
  }

  window.BSMNutritionGenerateHandlers = {
    init: init,
    bindNutritionGenerateHandler: bindNutritionGenerateHandler,
  };
})();
