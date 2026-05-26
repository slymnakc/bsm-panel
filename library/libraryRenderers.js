// libraryRenderers.js — Refactor Adım 4A.1.2.
// Hareket Kütüphanesi render katmanı app.js'den extract edildi.
// Davranis degisikligi yok; filter pipeline, locale compare, render order,
// muscle group grouping, custom list render birebir korundu.
//
// KAPSAM ICI:
//   - renderLibrary() — ana render orchestration
//   - renderCustomExerciseList() — module-private (renderLibrary tarafindan cagrilir)
//   - getFirstLetter(value) — module-private alphabet helper (turkishAlphabet bagimli)
//
// KAPSAM DISI (dokunulmadi):
//   - libraryVideoModal (4A.1.1'de extract edildi)
//   - Custom exercise CRUD (4A.1.3'e birakildi: handleAddCustomExercise,
//     removeCustomExercise, hideLibraryExercise, handleRestoreHiddenExercises,
//     handleLibraryExerciseAction)
//   - exerciseLibrary mutable global cache — DEGISTIRILMEZ, lazy getter ile okunur
//   - state.customExercises / state.hiddenExerciseIds — read-only, mutation YOK
//
// MUTABLE CACHE KORUMA STRATEJISI:
// exerciseLibrary runtime'da `refreshExerciseLibrary()` tarafindan length=0 +
// push(...) ile yeniden doldurulan global. Module-level cache YASAK; her
// renderLibrary cagrisinda _getExerciseLibrary() lazy getter ile CANLI ref alinir.
// Direct array inject yasak — stale reference olusturur.
//
// Dependency injection (14 madde — koddan dogrulanmis):
//   state                      -> app state (closure)
//   getExerciseLibrary         -> () => exerciseLibrary (LAZY GETTER, ZORUNLU)
//   muscleGroups               -> BSMOptionData
//   equipmentLabels            -> BSMOptionData
//   escapeHtml                 -> BSMCoreUtils
//   normalizeText              -> BSMCoreUtils
//   getMuscleLabel             -> BSMLabelUtils
//   labelExerciseKind          -> BSMLabelUtils
//   labelExerciseLevel         -> BSMLabelUtils
//   syncLibraryTabsUi          -> BSMUI (library tabs adapter)
//   renderLibraryResultsUi     -> BSMUI (library results adapter)
//   getExerciseMedia           -> app.js fn (callback — buildExerciseMedia wrapper)
//   turkishAlphabet            -> BSMOptionData (getFirstLetter icin)
//   domRefs                    -> { exerciseSearch, libraryGroupFilter,
//                                    libraryEquipmentFilter, muscleGroupTabs,
//                                    alphabetTabs, exerciseLibraryEl, libraryCount,
//                                    customExerciseList } — top-level DOM ref'leri

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _state = null;
  var _getExerciseLibrary = function () { return []; };
  var _muscleGroups = [];
  var _equipmentLabels = {};
  var _escapeHtml = function (s) { return String(s == null ? "" : s); };
  var _normalizeText = function (s) { return String(s || "").toLowerCase(); };
  var _getMuscleLabel = function (g) { return String(g || ""); };
  var _labelExerciseKind = function (k) { return String(k || ""); };
  var _labelExerciseLevel = function (l) { return String(l || ""); };
  var _syncLibraryTabsUi = function () {};
  var _renderLibraryResultsUi = function () {};
  var _getExerciseMedia = function () { return null; };
  var _turkishAlphabet = [];
  var _domRefs = {};

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.getExerciseLibrary === "function") _getExerciseLibrary = deps.getExerciseLibrary;
    if (Array.isArray(deps.muscleGroups)) _muscleGroups = deps.muscleGroups;
    if (deps.equipmentLabels) _equipmentLabels = deps.equipmentLabels;
    if (typeof deps.escapeHtml === "function") _escapeHtml = deps.escapeHtml;
    if (typeof deps.normalizeText === "function") _normalizeText = deps.normalizeText;
    if (typeof deps.getMuscleLabel === "function") _getMuscleLabel = deps.getMuscleLabel;
    if (typeof deps.labelExerciseKind === "function") _labelExerciseKind = deps.labelExerciseKind;
    if (typeof deps.labelExerciseLevel === "function") _labelExerciseLevel = deps.labelExerciseLevel;
    if (typeof deps.syncLibraryTabsUi === "function") _syncLibraryTabsUi = deps.syncLibraryTabsUi;
    if (typeof deps.renderLibraryResultsUi === "function") _renderLibraryResultsUi = deps.renderLibraryResultsUi;
    if (typeof deps.getExerciseMedia === "function") _getExerciseMedia = deps.getExerciseMedia;
    if (Array.isArray(deps.turkishAlphabet)) _turkishAlphabet = deps.turkishAlphabet;
    if (deps.domRefs) _domRefs = deps.domRefs;
  }

  // ═══════════════════════════════════════════════════════════════════
  // getFirstLetter — Turkce alfabe icin ilk harf normalize
  // (turkishAlphabet'te varsa direkt, yoksa NFD strip)
  // ═══════════════════════════════════════════════════════════════════
  function getFirstLetter(value) {
    const first = String(value || "").trim().charAt(0).toLocaleUpperCase("tr-TR");
    return _turkishAlphabet.includes(first) ? first : first.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderCustomExerciseList — module-private; renderLibrary tarafindan
  // her render cycle'da cagrilir.
  // Side effects: customExerciseList.innerHTML mutate (state.customExercises
  // + state.hiddenExerciseIds.length read-only).
  // ═══════════════════════════════════════════════════════════════════
  function renderCustomExerciseList() {
    const customExerciseList = _domRefs.customExerciseList;
    if (!customExerciseList) {
      return;
    }

    const customItemsHtml = _state.customExercises
      .map(
        (exercise) => `
        <div class="custom-exercise-item">
          <div>
            <strong>${_escapeHtml(exercise.name)}</strong>
            <span>${_escapeHtml(_getMuscleLabel(exercise.group))} • ${_escapeHtml(_equipmentLabels[exercise.equipment] || exercise.equipment)}</span>
          </div>
          <button
            type="button"
            class="library-exercise__action"
            data-exercise-library-action="remove-custom"
            data-exercise-id="${_escapeHtml(exercise.id)}"
          >Sil</button>
        </div>
      `,
      )
      .join("");

    const hiddenInfo = _state.hiddenExerciseIds.length
      ? `<p class="custom-exercise-list__hint">${_state.hiddenExerciseIds.length} hazır hareket gizlendi. İstersen "Gizlenenleri Geri Getir" ile tamamını açabilirsin.</p>`
      : "";

    customExerciseList.innerHTML =
      customItemsHtml || hiddenInfo
        ? `${customItemsHtml}${hiddenInfo}`
        : `<p class="custom-exercise-list__hint">Henüz özel hareket eklenmedi. Eklediğin hareketler burada listelenecek.</p>`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderLibrary — ana render orchestration.
  //
  // Filter pipeline (sira korundu):
  //   1. matchesSearch (name/group/equipment/kind/level/cue normalize includes)
  //   2. matchesGroup (groupFilter === "all" veya exercise.group === groupFilter)
  //   3. matchesEquipment (equipmentFilter === "all" veya exercise.equipment === eqFilter)
  //   4. matchesLetter (letterFilter === "all" veya getFirstLetter === letterFilter)
  //
  // Sort: localeCompare(name, "tr") — Turkce siralama korundu.
  // Group ordering: muscleGroups iterate sirasi korundu (filter(Boolean) ile bos drop).
  // Sub-call: renderCustomExerciseList() — her render'da side effect.
  //
  // MUTABLE CACHE: exerciseLibrary _getExerciseLibrary() ile CANLI alinir.
  // refreshExerciseLibrary()'nin length=0/push(...) mutation'lari yansir.
  // ═══════════════════════════════════════════════════════════════════
  function renderLibrary() {
    const exerciseSearch = _domRefs.exerciseSearch;
    const libraryGroupFilter = _domRefs.libraryGroupFilter;
    const libraryEquipmentFilter = _domRefs.libraryEquipmentFilter;
    const muscleGroupTabs = _domRefs.muscleGroupTabs;
    const alphabetTabs = _domRefs.alphabetTabs;
    const exerciseLibraryEl = _domRefs.exerciseLibraryEl;
    const libraryCount = _domRefs.libraryCount;

    const searchText = _normalizeText(exerciseSearch.value);
    const groupFilter = libraryGroupFilter.value;
    const equipmentFilter = libraryEquipmentFilter.value;
    const letterFilter = _state.activeAlphabetLetter;

    // LAZY GETTER: her render'da canli mutable global ref
    const exerciseLibrary = _getExerciseLibrary();

    const filtered = exerciseLibrary
      .filter((exercise) => {
        const matchesSearch =
          !searchText ||
          _normalizeText(exercise.name).includes(searchText) ||
          _normalizeText(_getMuscleLabel(exercise.group)).includes(searchText) ||
          _normalizeText(_equipmentLabels[exercise.equipment]).includes(searchText) ||
          _normalizeText(_labelExerciseKind(exercise.kind)).includes(searchText) ||
          _normalizeText(_labelExerciseLevel(exercise.level)).includes(searchText) ||
          _normalizeText(exercise.cue).includes(searchText);
        const matchesGroup = groupFilter === "all" || exercise.group === groupFilter;
        const matchesEquipment = equipmentFilter === "all" || exercise.equipment === equipmentFilter;
        const matchesLetter = letterFilter === "all" || getFirstLetter(exercise.name) === letterFilter;

        return matchesSearch && matchesGroup && matchesEquipment && matchesLetter;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    renderCustomExerciseList();

    const groups = _muscleGroups
      .map((group) => {
        const exercises = filtered.filter((exercise) => exercise.group === group.id).sort((a, b) => a.name.localeCompare(b.name, "tr"));

        if (!exercises.length) {
          return null;
        }

        return {
          id: group.id,
          label: group.label,
          description: group.description,
          exerciseCount: exercises.length,
          exercises: exercises.map((exercise) => ({
            name: exercise.name,
            id: exercise.id,
            isCustom: Boolean(exercise.isCustom),
            media: _getExerciseMedia(exercise),
            equipmentLabel: _equipmentLabels[exercise.equipment] || exercise.equipment || "Ekipman",
            kindLabel: _labelExerciseKind(exercise.kind),
            levelLabel: _labelExerciseLevel(exercise.level),
            cue: exercise.cue,
          })),
        };
      })
      .filter(Boolean);

    _syncLibraryTabsUi(
      {
        muscleGroupTabs,
        alphabetTabs,
      },
      {
        activeGroup: groupFilter,
        activeLetter: letterFilter,
      },
    );
    _renderLibraryResultsUi(
      {
        exerciseLibraryEl,
        libraryCount,
      },
      {
        filteredCount: filtered.length,
        groups,
      },
      _escapeHtml,
    );
  }

  window.BSMLibraryRenderers = {
    init: init,
    renderLibrary: renderLibrary,
    renderCustomExerciseList: renderCustomExerciseList,
  };
})();
