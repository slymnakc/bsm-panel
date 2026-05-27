// libraryCustomExercise.js — Refactor Adım 4A.1.3.
// Custom Exercise CRUD (add/remove/hide/restore) ve persistence (localStorage +
// Supabase) katmanı app.js'den extract edildi.
//
// KAPSAM ICI (22 fonksiyon):
//   Handlers (event):
//     - handleAddCustomExercise
//     - handleLibraryExerciseAction (delegated click: remove-custom + hide)
//     - handleRestoreHiddenExercises
//   CRUD core:
//     - removeCustomExercise
//     - hideLibraryExercise
//   Form helpers:
//     - collectCustomExerciseForm
//     - validateCustomExercise
//     - makeUniqueCustomExerciseId
//     - clearCustomExerciseForm
//     - setCustomExerciseStatus
//   Persistence:
//     - persistCustomExercises (localStorage + Supabase)
//     - persistHiddenExerciseIds (localStorage + Supabase)
//     - loadCustomExercises
//     - loadHiddenExerciseIds
//   Normalize (pure):
//     - normalizeCustomExercises
//     - normalizeCustomExercise
//     - normalizeHiddenExerciseIds
//     - makeCustomExerciseId
//     - normalizeExerciseGroup
//     - normalizeExerciseEquipment
//     - normalizeCustomExerciseKind
//     - normalizeCustomExerciseLevel
//   Bind:
//     - bindLibraryCustomExerciseHandlers (idempotent guard'li)
//
// KAPSAM DISI (app.js'de KALIYOR):
//   - refreshExerciseLibrary — mutable cache mutation (exerciseLibrary.splice)
//     app.js bootstrap rolunde. Modul sadece callback ile cagirir.
//   - exerciseLibrary mutable global (app.js:587) — DEGISTIRILMEZ.
//   - renderLibrary — BSMLibraryRenderers'da (4A.1.2'de extract edildi).
//   - syncAppSettingsFromSupabase orchestration — app.js'de kalir, normalize/
//     persist cagrilari modul API'sine yonlendirildi.
//
// MUTABLE CACHE KORUMA STRATEJISI:
// hideLibraryExercise icinde exerciseLibrary.find(...) gerekiyor — bunun icin
// _getExerciseLibrary() LAZY GETTER kullanildi (renderers ile ayni pattern).
// Array direct inject YASAK — stale referans olusturur.
//
// PERSISTENCE SIRA KILIDI (CRUD operasyonlarinda korundu):
//   state mutate → persist → refreshExerciseLibrary → setStatus → renderLibrary
//
// IMMUTABLE STATE PATTERN KORUNDU:
//   state.customExercises = [...state.customExercises, exercise]
//   state.customExercises = state.customExercises.filter(...)
//   state.hiddenExerciseIds = [...new Set([...state.hiddenExerciseIds, id])]
//   state.hiddenExerciseIds = []
//
// Dependency injection (14 madde — koddan dogrulanmis):
//   state                       -> app state (closure)
//   domRefs                     -> { customExerciseName, customExerciseGroup,
//                                    customExerciseEquipment, customExerciseKind,
//                                    customExerciseLevel, customExerciseGifUrl,
//                                    customExerciseCue, customExerciseStatus,
//                                    customExerciseList, exerciseLibraryEl,
//                                    addCustomExerciseButton,
//                                    resetCustomExerciseFormButton,
//                                    restoreHiddenExercisesButton }
//   storageKeys                 -> BSMStorageService.storageKeys
//   saveToStorage               -> BSMStorageService
//   loadFromStorage             -> BSMStorageService
//   persistSupabaseAppSetting   -> app.js wrapper (BSMSupabaseSyncService bridge)
//   refreshExerciseLibrary      -> app.js fn (callback — mutable cache rebuild)
//   renderLibrary               -> BSMLibraryRenderers.renderLibrary (callback)
//   getExerciseLibrary          -> () => exerciseLibrary (LAZY GETTER, zorunlu —
//                                  hideLibraryExercise icin)
//   normalizeText               -> BSMCoreUtils
//   makeId                      -> BSMCoreUtils
//   muscleGroups                -> BSMOptionData
//   equipmentLabels             -> BSMOptionData
//   baseExerciseLibrary         -> BSMExerciseData.exerciseLibrary (duplicate
//                                  check icin: validateCustomExercise +
//                                  makeUniqueCustomExerciseId)

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _state = null;
  var _domRefs = {};
  var _storageKeys = {};
  var _saveToStorage = function () {};
  var _loadFromStorage = function () { return null; };
  var _persistSupabaseAppSetting = function () {};
  var _refreshExerciseLibrary = function () {};
  var _renderLibrary = function () {};
  var _getExerciseLibrary = function () { return []; };
  var _normalizeText = function (s) { return String(s || "").toLowerCase(); };
  var _makeId = function (prefix) { return prefix + "-" + Date.now(); };
  var _muscleGroups = [];
  var _equipmentLabels = {};
  var _baseExerciseLibrary = [];

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (deps.domRefs) _domRefs = deps.domRefs;
    if (deps.storageKeys) _storageKeys = deps.storageKeys;
    if (typeof deps.saveToStorage === "function") _saveToStorage = deps.saveToStorage;
    if (typeof deps.loadFromStorage === "function") _loadFromStorage = deps.loadFromStorage;
    if (typeof deps.persistSupabaseAppSetting === "function") _persistSupabaseAppSetting = deps.persistSupabaseAppSetting;
    if (typeof deps.refreshExerciseLibrary === "function") _refreshExerciseLibrary = deps.refreshExerciseLibrary;
    if (typeof deps.renderLibrary === "function") _renderLibrary = deps.renderLibrary;
    if (typeof deps.getExerciseLibrary === "function") _getExerciseLibrary = deps.getExerciseLibrary;
    if (typeof deps.normalizeText === "function") _normalizeText = deps.normalizeText;
    if (typeof deps.makeId === "function") _makeId = deps.makeId;
    if (Array.isArray(deps.muscleGroups)) _muscleGroups = deps.muscleGroups;
    if (deps.equipmentLabels) _equipmentLabels = deps.equipmentLabels;
    if (Array.isArray(deps.baseExerciseLibrary)) _baseExerciseLibrary = deps.baseExerciseLibrary;
  }

  // ═══════════════════════════════════════════════════════════════════
  // NORMALIZE (pure)
  // ═══════════════════════════════════════════════════════════════════

  function normalizeCustomExercises(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(normalizeCustomExercise)
      .filter(Boolean);
  }

  function normalizeCustomExercise(exercise) {
    if (!exercise || typeof exercise !== "object") {
      return null;
    }

    const name = String(exercise.name || "").trim();
    const group = normalizeExerciseGroup(exercise.group);
    const equipment = normalizeExerciseEquipment(exercise.equipment);

    if (!name || !group) {
      return null;
    }

    return {
      id: String(exercise.id || makeCustomExerciseId(name, group)),
      group,
      name,
      equipment,
      kind: normalizeCustomExerciseKind(exercise.kind),
      level: normalizeCustomExerciseLevel(exercise.level),
      tags: Array.isArray(exercise.tags) ? exercise.tags : ["custom"],
      cue: String(exercise.cue || "Kontrollü formda uygula.").trim(),
      gifUrl: String(exercise.gifUrl || "").trim(),
      isCustom: true,
    };
  }

  function normalizeHiddenExerciseIds(value) {
    return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
  }

  function makeCustomExerciseId(name, group) {
    const slug = _normalizeText(`${group}-${name}`)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `custom-${slug || _makeId("exercise")}`;
  }

  function normalizeExerciseGroup(value) {
    const group = String(value || "").trim();
    return _muscleGroups.some((item) => item.id === group) ? group : _muscleGroups[0]?.id || "";
  }

  function normalizeExerciseEquipment(value) {
    const equipment = String(value || "").trim();
    return _equipmentLabels[equipment] ? equipment : "bodyweight";
  }

  function normalizeCustomExerciseKind(value) {
    const kind = String(value || "").trim();
    return ["compound", "accessory", "cardio", "conditioning", "mobility", "core"].includes(kind) ? kind : "accessory";
  }

  function normalizeCustomExerciseLevel(value) {
    const level = String(value || "").trim();
    return ["beginner", "intermediate", "advanced"].includes(level) ? level : "intermediate";
  }

  // ═══════════════════════════════════════════════════════════════════
  // STORAGE (load/persist)
  // ═══════════════════════════════════════════════════════════════════

  function loadCustomExercises() {
    return normalizeCustomExercises(_loadFromStorage(_storageKeys.customExercises));
  }

  function loadHiddenExerciseIds() {
    const ids = _loadFromStorage(_storageKeys.hiddenExerciseIds);
    return Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))] : [];
  }

  function persistCustomExercises() {
    _saveToStorage(_storageKeys.customExercises, _state.customExercises);
    _persistSupabaseAppSetting("customExercises", _state.customExercises);
  }

  function persistHiddenExerciseIds() {
    _saveToStorage(_storageKeys.hiddenExerciseIds, _state.hiddenExerciseIds);
    _persistSupabaseAppSetting("hiddenExerciseIds", _state.hiddenExerciseIds);
  }

  // ═══════════════════════════════════════════════════════════════════
  // FORM (collect / validate / clear / status)
  // ═══════════════════════════════════════════════════════════════════

  function collectCustomExerciseForm() {
    const customExerciseName = _domRefs.customExerciseName;
    const customExerciseGroup = _domRefs.customExerciseGroup;
    const customExerciseEquipment = _domRefs.customExerciseEquipment;
    const customExerciseKind = _domRefs.customExerciseKind;
    const customExerciseLevel = _domRefs.customExerciseLevel;
    const customExerciseGifUrl = _domRefs.customExerciseGifUrl;
    const customExerciseCue = _domRefs.customExerciseCue;

    const name = String(customExerciseName?.value || "").trim();
    const group = normalizeExerciseGroup(customExerciseGroup?.value);

    return normalizeCustomExercise({
      id: makeUniqueCustomExerciseId(name, group),
      name,
      group,
      equipment: customExerciseEquipment?.value,
      kind: customExerciseKind?.value,
      level: customExerciseLevel?.value,
      cue: customExerciseCue?.value,
      gifUrl: customExerciseGifUrl?.value,
      tags: ["custom"],
    });
  }

  function validateCustomExercise(exercise) {
    if (!exercise?.name) {
      return "Hareket adı boş olamaz.";
    }

    const duplicate = [..._baseExerciseLibrary, ..._state.customExercises].some(
      (item) => item.group === exercise.group && _normalizeText(item.name) === _normalizeText(exercise.name),
    );

    if (duplicate) {
      return "Bu kas grubunda aynı isimle bir hareket zaten var.";
    }

    return "";
  }

  function makeUniqueCustomExerciseId(name, group) {
    const baseId = makeCustomExerciseId(name, group);
    const existingIds = new Set([..._baseExerciseLibrary, ..._state.customExercises].map((exercise) => exercise.id));

    if (!existingIds.has(baseId)) {
      return baseId;
    }

    return `${baseId}-${Date.now().toString(36)}`;
  }

  function clearCustomExerciseForm() {
    const customExerciseName = _domRefs.customExerciseName;
    const customExerciseGifUrl = _domRefs.customExerciseGifUrl;
    const customExerciseCue = _domRefs.customExerciseCue;
    const customExerciseKind = _domRefs.customExerciseKind;
    const customExerciseLevel = _domRefs.customExerciseLevel;

    if (customExerciseName) customExerciseName.value = "";
    if (customExerciseGifUrl) customExerciseGifUrl.value = "";
    if (customExerciseCue) customExerciseCue.value = "";
    if (customExerciseKind) customExerciseKind.value = "compound";
    if (customExerciseLevel) customExerciseLevel.value = "intermediate";
  }

  function setCustomExerciseStatus(message, type) {
    const customExerciseStatus = _domRefs.customExerciseStatus;
    if (!customExerciseStatus) {
      return;
    }

    customExerciseStatus.textContent = message;
    customExerciseStatus.dataset.state = type || "neutral";
  }

  // ═══════════════════════════════════════════════════════════════════
  // CRUD CORE
  //
  // PERSISTENCE SIRA KILIDI:
  //   state mutate → persist → refreshExerciseLibrary → setStatus → renderLibrary
  // (app.js'deki birebir sira korundu — handleAdd, remove, hide, restore)
  // ═══════════════════════════════════════════════════════════════════

  function handleAddCustomExercise() {
    const exercise = collectCustomExerciseForm();
    const validationError = validateCustomExercise(exercise);

    if (validationError) {
      setCustomExerciseStatus(validationError, "error");
      return;
    }

    _state.customExercises = [..._state.customExercises, exercise];
    persistCustomExercises();
    _refreshExerciseLibrary();
    clearCustomExerciseForm();
    setCustomExerciseStatus(`${exercise.name} kütüphaneye eklendi.`, "success");
    _renderLibrary();
  }

  function handleLibraryExerciseAction(event) {
    const button = event.target.closest("[data-exercise-library-action]");

    if (!button) {
      return;
    }

    const exerciseId = button.dataset.exerciseId;
    const action = button.dataset.exerciseLibraryAction;

    if (action === "remove-custom") {
      removeCustomExercise(exerciseId);
      return;
    }

    if (action === "hide") {
      hideLibraryExercise(exerciseId);
    }
  }

  function handleRestoreHiddenExercises() {
    if (!_state.hiddenExerciseIds.length) {
      setCustomExerciseStatus("Geri getirilecek gizlenmiş hareket yok.", "neutral");
      return;
    }

    _state.hiddenExerciseIds = [];
    persistHiddenExerciseIds();
    _refreshExerciseLibrary();
    setCustomExerciseStatus("Gizlenen hazır hareketler tekrar kütüphaneye eklendi.", "success");
    _renderLibrary();
  }

  function removeCustomExercise(exerciseId) {
    const exercise = _state.customExercises.find((item) => item.id === exerciseId);

    if (!exercise) {
      setCustomExerciseStatus("Silinecek özel hareket bulunamadı.", "error");
      return;
    }

    _state.customExercises = _state.customExercises.filter((item) => item.id !== exerciseId);
    persistCustomExercises();
    _refreshExerciseLibrary();
    setCustomExerciseStatus(`${exercise.name} özel hareketlerden silindi.`, "success");
    _renderLibrary();
  }

  function hideLibraryExercise(exerciseId) {
    // LAZY GETTER: mutable cache canli okunur, stale ref olmaz
    const exerciseLibrary = _getExerciseLibrary();
    const exercise = exerciseLibrary.find((item) => item.id === exerciseId);

    if (!exercise) {
      setCustomExerciseStatus("Gizlenecek hareket bulunamadı.", "error");
      return;
    }

    if (exercise.isCustom) {
      removeCustomExercise(exerciseId);
      return;
    }

    _state.hiddenExerciseIds = [...new Set([..._state.hiddenExerciseIds, exerciseId])];
    persistHiddenExerciseIds();
    _refreshExerciseLibrary();
    setCustomExerciseStatus(`${exercise.name} hazır kütüphaneden gizlendi.`, "success");
    _renderLibrary();
  }

  // ═══════════════════════════════════════════════════════════════════
  // BIND (idempotent guard'li)
  // app.js:3452-3456'daki 5 event listener bu fn'de toplandi.
  // exerciseLibraryEl + customExerciseList click delegation YALNIZCA
  // [data-exercise-library-action] butonlarini hedefler — diger library
  // click'leri (renderers veya app.js) etkilenmez.
  // ═══════════════════════════════════════════════════════════════════

  function bindLibraryCustomExerciseHandlers() {
    const panel = _domRefs.customExerciseList;
    // Guard: customExerciseList panel container'i temel referans — yoksa bind atlanir.
    // Idempotent flag bu element uzerinde tutulur.
    if (!panel) {
      return;
    }
    if (panel.dataset.bsmLibraryCustomExerciseBound === "true") {
      return;
    }

    const addBtn = _domRefs.addCustomExerciseButton;
    const resetBtn = _domRefs.resetCustomExerciseFormButton;
    const restoreBtn = _domRefs.restoreHiddenExercisesButton;
    const libraryEl = _domRefs.exerciseLibraryEl;

    if (addBtn) addBtn.addEventListener("click", handleAddCustomExercise);
    if (resetBtn) resetBtn.addEventListener("click", clearCustomExerciseForm);
    if (restoreBtn) restoreBtn.addEventListener("click", handleRestoreHiddenExercises);
    if (libraryEl) libraryEl.addEventListener("click", handleLibraryExerciseAction);
    panel.addEventListener("click", handleLibraryExerciseAction);

    panel.dataset.bsmLibraryCustomExerciseBound = "true";
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  window.BSMLibraryCustomExercise = {
    init: init,
    bindLibraryCustomExerciseHandlers: bindLibraryCustomExerciseHandlers,
    loadCustomExercises: loadCustomExercises,
    loadHiddenExerciseIds: loadHiddenExerciseIds,
    normalizeCustomExercises: normalizeCustomExercises,
    normalizeCustomExercise: normalizeCustomExercise,
    normalizeHiddenExerciseIds: normalizeHiddenExerciseIds,
    persistCustomExercises: persistCustomExercises,
    persistHiddenExerciseIds: persistHiddenExerciseIds,
  };
})();
