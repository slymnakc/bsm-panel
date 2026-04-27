(function () {
  "use strict";

  function createNavigationHandlers(deps) {
    const {
      state,
      setActiveScreen,
      setWorkspaceView,
      inferScreenFromHash,
      renderLibrary,
      exerciseLibraryEl,
      exerciseSearch,
      libraryGroupFilter,
      libraryEquipmentFilter,
      windowObject = window,
    } = deps;

    function handleScreenNavClick(event) {
      const button = event.target.closest("button[data-screen-target]");

      if (!button) {
        return;
      }

      setActiveScreen(button.dataset.screenTarget, { userTriggered: true });
    }

    function handleWorkspaceTabClick(event) {
      const button = event.target.closest("button[data-workspace-view]");

      if (!button) {
        return;
      }

      setWorkspaceView(button.dataset.workspaceView);
    }

    function handleExerciseSearch() {
      renderLibrary();
    }

    function handleLibraryFilterChange() {
      renderLibrary();
    }

    function handleMuscleTabClick(event) {
      const button = event.target.closest("button[data-group]");

      if (!button) {
        return;
      }

      libraryGroupFilter.value = button.dataset.group;
      renderLibrary();
    }

    function handleAlphabetTabClick(event) {
      const button = event.target.closest("button[data-letter]");

      if (!button) {
        return;
      }

      state.activeAlphabetLetter = button.dataset.letter;
      renderLibrary();
    }

    function handleFindExercise() {
      renderLibrary();
      exerciseLibraryEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function handleClearExerciseSearch() {
      exerciseSearch.value = "";
      state.activeAlphabetLetter = "all";
      libraryGroupFilter.value = "all";
      libraryEquipmentFilter.value = "all";
      renderLibrary();
    }

    function handleHashChange() {
      const hashScreen = inferScreenFromHash(windowObject.location.hash);
      setActiveScreen(hashScreen, { userTriggered: true, silent: true });
    }

    return {
      handleScreenNavClick,
      handleWorkspaceTabClick,
      handleExerciseSearch,
      handleLibraryFilterChange,
      handleMuscleTabClick,
      handleAlphabetTabClick,
      handleFindExercise,
      handleClearExerciseSearch,
      handleHashChange,
    };
  }

  function bindNavigationHandlers(elements, handlers) {
    bindIf(elements.studioNav, "click", handlers.handleScreenNavClick);
    bindIf(elements.workspaceTabs, "click", handlers.handleWorkspaceTabClick);
    bindIf(elements.exerciseSearch, "input", handlers.handleExerciseSearch);
    bindIf(elements.libraryGroupFilter, "change", handlers.handleLibraryFilterChange);
    bindIf(elements.libraryEquipmentFilter, "change", handlers.handleLibraryFilterChange);
    bindIf(elements.muscleGroupTabs, "click", handlers.handleMuscleTabClick);
    bindIf(elements.alphabetTabs, "click", handlers.handleAlphabetTabClick);
    bindIf(elements.findExerciseButton, "click", handlers.handleFindExercise);
    bindIf(elements.clearExerciseSearchButton, "click", handlers.handleClearExerciseSearch);

    if (elements.windowObject && handlers.handleHashChange) {
      elements.windowObject.addEventListener("hashchange", handlers.handleHashChange);
    }
  }

  function bindIf(target, eventName, handler) {
    if (!target || !handler) {
      return;
    }

    target.addEventListener(eventName, handler);
  }

  window.BSMNavigationHandlers = {
    createNavigationHandlers,
    bindNavigationHandlers,
  };
})();
