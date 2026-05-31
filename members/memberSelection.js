// memberSelection.js — Refactor Adım 4B.3.1 (STRICT MECHANICAL).
// Member selection + hydration flow app.js'den BIREBIR tasindi. Davranis degisikligi YOK;
// state mutation sirasi, render sirasi, activeProgram davranisi, rail selection hafifligi
// birebir korundu.
//
// !!! app.js'de loadMember + selectActiveMemberFromRail + hydrateInitialSession WRAPPER
// olarak kalir — cagrı siteleri (member-handlers DI, handleMemberQuickAction, rail click,
// initialize) DEGISMEZ.
//
// KAPSAM ICI:
//   - loadMember (full selection: state + render + setActiveScreen + program/nutrition)
//   - selectActiveMemberFromRail (lightweight: renderProgram CAGIRMAZ, uyeler ekraninda kalir)
//   - flashWorkspaceSkeleton (inline — sadece rail selection kullaniyor)
//   - hydrateInitialSession → hydrateSavedFormDraft + hydrateActiveMemberSession + hydrateLastSavedProgram
//
// DAVRANIS KORUMA:
//   loadMember:   renderProgram + renderNutritionWorkspace + renderNutritionOutput cagirir
//   selectActiveMemberFromRail: renderProgram CAGIRMAZ (lightweight), sadece renderMemberWorkspace
//   activeProgram: loadMember program varsa renderProgram, yoksa null + resultsSection.hidden
//
// Dependency injection (koddan dogrulanmis):
//   state, findActiveMember, saveActiveMemberId, setActiveMeasurementState, populateForm,
//   clearMeasurementInputs, getTodayInputValue, handleLiveUpdate, renderMemberWorkspace,
//   setActiveScreen, renderProgram, renderNutritionWorkspace, renderNutritionOutput,
//   cloneData, normalizeNutritionPlan, showStatus, loadLastForm, loadLastPlan, schemaVersion,
//   domRefs{ measurementDate, resultsSection }

(function () {
  "use strict";

  var _state = null;
  var _findActiveMember = function () { return null; };
  var _saveActiveMemberId = function () {};
  var _setActiveMeasurementState = function () {};
  var _populateForm = function () {};
  var _clearMeasurementInputs = function () {};
  var _getTodayInputValue = function () { return ""; };
  var _handleLiveUpdate = function () {};
  var _renderMemberWorkspace = function () {};
  var _setActiveScreen = function () {};
  var _renderProgram = function () {};
  var _renderNutritionWorkspace = function () {};
  var _renderNutritionOutput = function () {};
  var _cloneData = function (v) { return v; };
  var _normalizeNutritionPlan = function (v) { return v || null; };
  var _showStatus = function () {};
  var _loadLastForm = function () { return null; };
  var _loadLastPlan = function () { return null; };
  var _schemaVersion = 4;  // M1a.3: v3 -> v4 periodization bump
  var _domRefs = {};

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.saveActiveMemberId === "function") _saveActiveMemberId = deps.saveActiveMemberId;
    if (typeof deps.setActiveMeasurementState === "function") _setActiveMeasurementState = deps.setActiveMeasurementState;
    if (typeof deps.populateForm === "function") _populateForm = deps.populateForm;
    if (typeof deps.clearMeasurementInputs === "function") _clearMeasurementInputs = deps.clearMeasurementInputs;
    if (typeof deps.getTodayInputValue === "function") _getTodayInputValue = deps.getTodayInputValue;
    if (typeof deps.handleLiveUpdate === "function") _handleLiveUpdate = deps.handleLiveUpdate;
    if (typeof deps.renderMemberWorkspace === "function") _renderMemberWorkspace = deps.renderMemberWorkspace;
    if (typeof deps.setActiveScreen === "function") _setActiveScreen = deps.setActiveScreen;
    if (typeof deps.renderProgram === "function") _renderProgram = deps.renderProgram;
    if (typeof deps.renderNutritionWorkspace === "function") _renderNutritionWorkspace = deps.renderNutritionWorkspace;
    if (typeof deps.renderNutritionOutput === "function") _renderNutritionOutput = deps.renderNutritionOutput;
    if (typeof deps.cloneData === "function") _cloneData = deps.cloneData;
    if (typeof deps.normalizeNutritionPlan === "function") _normalizeNutritionPlan = deps.normalizeNutritionPlan;
    if (typeof deps.showStatus === "function") _showStatus = deps.showStatus;
    if (typeof deps.loadLastForm === "function") _loadLastForm = deps.loadLastForm;
    if (typeof deps.loadLastPlan === "function") _loadLastPlan = deps.loadLastPlan;
    if (typeof deps.schemaVersion === "number") _schemaVersion = deps.schemaVersion;
    if (deps.domRefs) _domRefs = deps.domRefs;
  }

  // ═══════════════════════════════════════════════════════════════════
  // loadMember — full selection (app.js:4062 birebir)
  // state mutate → setActiveScreen("builder") → renderProgram + nutrition
  // ═══════════════════════════════════════════════════════════════════
  function loadMember(member) {
    _state.activeMemberId = member.id;
    _state.activeMember = member;
    _state.latestMeasurement = member.measurements?.[0] || null;
    _state.pendingTanitaMeasurement = null;
    _setActiveMeasurementState(_state.latestMeasurement, { memberId: member.id, source: "saved" });
    _saveActiveMemberId(member.id);
    _populateForm(member.profile || {});
    _clearMeasurementInputs();
    _domRefs.measurementDate.value = _getTodayInputValue();
    _handleLiveUpdate();
    _renderMemberWorkspace();
    _setActiveScreen("builder", { silent: true });

    if (member.programs?.[0]?.program) {
      _renderProgram(_cloneData(member.programs[0].program), { savedProgramRecordId: member.programs[0].id });
    } else {
      _domRefs.resultsSection.classList.add("hidden");
      _state.activeProgram = null;
    }

    _state.activeNutritionPlan = _normalizeNutritionPlan(member.nutritionPlan || member.nutritionPlans?.[0]) || null;
    _state.activeNutritionMemberId = member.id;
    _renderNutritionWorkspace();
    _renderNutritionOutput();

    _showStatus(`${member.profile?.memberName || "Üye"} dosyası yüklendi.`, "success");
  }

  // ═══════════════════════════════════════════════════════════════════
  // selectActiveMemberFromRail — lightweight (app.js:4093 birebir)
  // renderProgram CAGIRMAZ; setActiveScreen CAGIRMAZ; uyeler ekraninda kalir.
  // ═══════════════════════════════════════════════════════════════════
  function selectActiveMemberFromRail(member) {
    if (!member) return;
    _state.activeMemberId = member.id;
    _state.activeMember = member;
    _state.latestMeasurement = member.measurements?.[0] || null;
    _state.pendingTanitaMeasurement = null;
    _setActiveMeasurementState(_state.latestMeasurement, { memberId: member.id, source: "saved" });
    _saveActiveMemberId(member.id);

    // F5j: Brief skeleton flash ile geçiş hissi ver (premium snappy feel)
    flashWorkspaceSkeleton();

    // Builder form'unu da güncel tut (sonra Program Oluştur sekmesine geçtiğinde dolu gelsin)
    try { _populateForm(member.profile || {}); } catch (e) { /* form yoksa sessiz geç */ }
    try {
      if (_domRefs.measurementDate) _domRefs.measurementDate.value = _getTodayInputValue();
      _clearMeasurementInputs();
    } catch (e) { /* ölçüm input'ları yoksa sessiz */ }
    try { _handleLiveUpdate(); } catch (e) { /* */ }

    _state.activeNutritionPlan = _normalizeNutritionPlan(member.nutritionPlan || member.nutritionPlans?.[0]) || null;
    _state.activeNutritionMemberId = member.id;

    _renderMemberWorkspace();
  }

  // ── flashWorkspaceSkeleton — inline (app.js:4121 birebir, sadece rail selection) ──
  function flashWorkspaceSkeleton() {
    const panel = document.querySelector("#membersPanel");
    if (!panel) return;
    panel.classList.add("is-switching");
    // Re-trigger animation: force reflow
    void panel.offsetWidth;
    setTimeout(() => panel.classList.remove("is-switching"), 280);
  }

  // ═══════════════════════════════════════════════════════════════════
  // HYDRATION zinciri (app.js:3697-3741 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function hydrateInitialSession() {
    hydrateSavedFormDraft();
    hydrateActiveMemberSession();
    hydrateLastSavedProgram();
  }

  function hydrateSavedFormDraft() {
    const lastForm = _loadLastForm();

    if (lastForm) {
      _populateForm(lastForm);
    }

    _handleLiveUpdate();
  }

  function hydrateActiveMemberSession() {
    const activeMember = _findActiveMember();

    if (!activeMember) {
      return null;
    }

    _populateForm(activeMember.profile);
    _handleLiveUpdate();
    _renderMemberWorkspace();

    if (activeMember.programs?.[0]?.program) {
      _renderProgram(activeMember.programs[0].program, { savedProgramRecordId: activeMember.programs[0].id });
    }

    _state.activeNutritionPlan = _normalizeNutritionPlan(activeMember.nutritionPlan || activeMember.nutritionPlans?.[0]) || null;
    _state.activeNutritionMemberId = activeMember.id;
    _renderNutritionWorkspace();

    return activeMember;
  }

  function hydrateLastSavedProgram() {
    const lastPlan = _loadLastPlan();

    if (!_state.activeProgram && lastPlan?.schemaVersion === _schemaVersion) {
      _renderProgram(lastPlan);
    }
  }

  window.BSMMemberSelection = {
    init: init,
    loadMember: loadMember,
    selectActiveMemberFromRail: selectActiveMemberFromRail,
    hydrateInitialSession: hydrateInitialSession,
  };
})();
