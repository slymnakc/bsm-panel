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
                      ${renderExerciseMedia(exercise.media, escapeHtml)}
                      <div class="library-exercise__top">
                        <strong>${escapeHtml(exercise.name)}</strong>
                        ${renderLibraryExerciseAction(exercise, escapeHtml)}
                      </div>
                      <div class="exercise-meta">
                        <span>${escapeHtml(exercise.equipmentLabel)}</span>
                        <span>${escapeHtml(exercise.kindLabel)}</span>
                        <span>${escapeHtml(exercise.levelLabel)}</span>
                        ${exercise.isCustom ? "<span>Özel hareket</span>" : ""}
                        <span>GIF alanı hazır</span>
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

  function renderExerciseMedia(media, escapeHtml) {
    if (!media?.gifUrl) {
      return "";
    }

    return `
      <div class="exercise-media" data-exercise-media>
        <button
          type="button"
          class="exercise-media__button"
          data-exercise-gif-open
          data-gif-url="${escapeHtml(media.gifUrl)}"
          data-gif-fallback-url="${escapeHtml(media.fallbackGifUrl || "")}"
          data-gif-fallback-urls="${escapeHtml(getFallbackGifUrls(media).join("|"))}"
          data-exercise-name="${escapeHtml(media.name)}"
          data-exercise-group="${escapeHtml(media.groupLabel)}"
          aria-label="${escapeHtml(media.name)} GIF önizlemesini büyüt"
        >
          <img src="${escapeHtml(media.gifUrl)}" alt="${escapeHtml(media.name)} GIF" loading="lazy" data-exercise-gif-img />
        </button>
        <div class="exercise-media__placeholder">
          <strong>${escapeHtml(media.name)}</strong>
          <span>${escapeHtml(media.groupLabel)}</span>
        </div>
      </div>
    `;
  }

  function renderLibraryExerciseAction(exercise, escapeHtml) {
    if (!exercise?.id) {
      return "";
    }

    const action = exercise.isCustom ? "remove-custom" : "hide";
    const label = exercise.isCustom ? "Sil" : "Gizle";

    return `
      <button
        type="button"
        class="library-exercise__action"
        data-exercise-library-action="${escapeHtml(action)}"
        data-exercise-id="${escapeHtml(exercise.id)}"
        aria-label="${escapeHtml(exercise.name)} hareketini kütüphaneden çıkar"
      >${label}</button>
    `;
  }

  function getFallbackGifUrls(media) {
    if (Array.isArray(media?.fallbackGifUrls)) {
      return media.fallbackGifUrls.filter(Boolean);
    }

    return media?.fallbackGifUrl ? [media.fallbackGifUrl] : [];
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
