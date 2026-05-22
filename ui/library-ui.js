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
                      ${renderExerciseVideoBadge(exercise, escapeHtml)}
                      <div class="library-exercise__top">
                        <strong>${escapeHtml(exercise.name)}</strong>
                        ${renderLibraryExerciseAction(exercise, escapeHtml)}
                      </div>
                      <div class="exercise-meta">
                        <span>${escapeHtml(exercise.equipmentLabel)}</span>
                        <span>${escapeHtml(exercise.kindLabel)}</span>
                        <span>${escapeHtml(exercise.levelLabel)}</span>
                        ${exercise.isCustom ? "<span>Özel hareket</span>" : ""}
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
    const name = media?.name || "Hareket";
    const groupLabel = media?.groupLabel || "Kas grubu";
    const fallbackUrls = getFallbackGifUrls(media);
    const mediaUrl = media?.gifUrl || fallbackUrls[0] || "";

    if (!media?.gifUrl) {
      return renderMissingExerciseMedia({ name, groupLabel }, escapeHtml);
    }

    return `
      <div class="exercise-media" data-exercise-media="${escapeHtml(mediaUrl)}" data-exercise-name="${escapeHtml(name)}" data-exercise-group="${escapeHtml(groupLabel)}" data-gif-slug="${escapeHtml(media?.slug || "")}">
        <button
          type="button"
          class="exercise-media__button"
          data-exercise-gif-open
          data-gif-url="${escapeHtml(media.gifUrl)}"
          data-gif-fallback-url="${escapeHtml(media.fallbackGifUrl || "")}"
          data-gif-fallback-urls="${escapeHtml(fallbackUrls.join("|"))}"
          data-exercise-name="${escapeHtml(name)}"
          data-exercise-group="${escapeHtml(groupLabel)}"
          aria-label="${escapeHtml(name)} GIF önizlemesini büyüt"
        >
          <img src="${escapeHtml(media.gifUrl)}" alt="${escapeHtml(name)} GIF" loading="lazy" data-exercise-gif-img />
        </button>
        <div class="exercise-media__placeholder">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(groupLabel)}</span>
          <em>GIF yok</em>
        </div>
      </div>
    `;
  }

  function renderMissingExerciseMedia(media, escapeHtml) {
    // v1.4.2: GIF yoksa direkt YouTube video butonunu prominent goster (placeholder yerine)
    const name = media?.name || "Hareket";
    const groupLabel = media?.groupLabel || "";
    return `
      <div class="exercise-media exercise-media--video-only" data-exercise-name="${escapeHtml(name)}" data-exercise-group="${escapeHtml(groupLabel)}">
        <button
          type="button"
          class="exercise-media__video-cta"
          data-exercise-video-open
          data-exercise-name="${escapeHtml(name)}"
          aria-label="${escapeHtml(name)} videosunu izle"
        >
          <span class="exercise-media__video-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </span>
          <strong>${escapeHtml(name)}</strong>
          <em>Video İzle</em>
        </button>
      </div>
    `;
  }

  // v1.4.2: YouTube video butonu — her egzersize ek, GIF zaten varsa kart ustunde rozet olarak gosterilir
  function renderExerciseVideoBadge(exercise, escapeHtml) {
    if (!exercise?.media?.gifUrl) return ""; // GIF yoksa zaten renderMissingExerciseMedia video CTA gosterir
    const name = exercise?.name || exercise?.media?.name || "Hareket";
    return `
      <button
        type="button"
        class="library-exercise__video-badge"
        data-exercise-video-open
        data-exercise-name="${escapeHtml(name)}"
        aria-label="${escapeHtml(name)} videosunu izle"
        title="YouTube'da video izle"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Video</span>
      </button>
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
