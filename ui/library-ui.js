(function () {
  "use strict";

  function renderLibraryResults(targets, model, escapeHtml) {
    const { exerciseLibraryEl, libraryCount } = targets || {};

    if (libraryCount) {
      libraryCount.textContent = `${model?.filteredCount || 0} hareket bulundu`;
    }

    if (!exerciseLibraryEl) {
      return;
    }

    const groupedHtml = (model?.groups || [])
      .map(
        (group) => `
          <article class="library-group">
            <div class="library-group__header">
              <div>
                <h3>${escapeHtml(group.label)}</h3>
                <p>${escapeHtml(group.description)}</p>
              </div>
              <span>${group.exerciseCount} hareket</span>
            </div>
            <div class="library-exercises">
              ${group.exercises
                .map(
                  (exercise) => `
                    <div class="library-exercise">
                      <strong>${escapeHtml(exercise.name)}</strong>
                      <div class="exercise-meta">
                        <span>${escapeHtml(exercise.equipmentLabel)}</span>
                        <span>${escapeHtml(exercise.kindLabel)}</span>
                        <span>${escapeHtml(exercise.levelLabel)}</span>
                        <span>V3 medya alanı hazır</span>
                      </div>
                      <p>${escapeHtml(exercise.cue)}</p>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </article>
        `,
      )
      .join("");

    exerciseLibraryEl.innerHTML =
      groupedHtml || `<div class="empty-state">Bu filtrelerle hareket bulunamadı. Arama metnini veya filtreleri değiştirebilirsiniz.</div>`;
  }

  function syncLibraryTabs(targets, state) {
    const { muscleGroupTabs, alphabetTabs } = targets || {};
    const { activeGroup = "all", activeLetter = "all" } = state || {};

    if (muscleGroupTabs) {
      muscleGroupTabs.querySelectorAll(".muscle-tab").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.group === activeGroup);
      });
    }

    if (alphabetTabs) {
      alphabetTabs.querySelectorAll(".alphabet-tab").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.letter === activeLetter);
      });
    }
  }

  window.BSMLibraryUI = {
    renderLibraryResults,
    syncLibraryTabs,
  };
})();
