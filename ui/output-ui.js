(function () {
  "use strict";

  function renderProgramCover(targets, model) {
    if (!targets || !model) {
      return;
    }

    setText(targets.coverBrand, model.brand);
    setText(targets.coverMember, model.memberTitle);
    setText(targets.coverMeta, model.meta);
    setText(targets.coverTrainer, model.trainer);
  }

  function renderProgramSections(targets, model, escapeHtml) {
    if (!targets || !model) {
      return;
    }

    if (targets.programOverview) {
      targets.programOverview.innerHTML = (model.overview || [])
        .map(
          (item) => `
            <div class="metric-item">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.value)}</span>
            </div>
          `,
        )
        .join("");
    }

    if (targets.coachNote) {
      targets.coachNote.innerHTML = `<p>${escapeHtml(model.coachNote || "")}</p><p><strong>Oluşturulma zamanı:</strong> ${escapeHtml(model.createdAt || "")}</p>`;
    }

    if (targets.muscleCoverage) {
      targets.muscleCoverage.innerHTML = (model.coverage || [])
        .map(
          (item) => `
            <div class="coverage-pill">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.summary)}</span>
            </div>
          `,
        )
        .join("");
    }

    if (targets.weeklyPlan) {
      targets.weeklyPlan.innerHTML = model.weeklyPlanHtml || "";
    }

    if (targets.progressionPlan) {
      targets.progressionPlan.innerHTML = (model.progression || [])
        .map(
          (item) => `
            <div class="timeline-item">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.text)}</span>
            </div>
          `,
        )
        .join("");
    }

    if (targets.guidanceBlock) {
      targets.guidanceBlock.innerHTML = (model.guidance || [])
        .map(
          (item) => `
            <div class="guidance-item">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.text)}</span>
            </div>
          `,
        )
        .join("");
    }
  }

  function buildWeeklyPlanHtml(model, escapeHtml, helpers) {
    const sessions = model?.sessions || [];

    return sessions
      .map(
        (session, sessionIndex) => `
          <article class="day-card">
            <div class="day-card__header">
              <div>
                <h4>${escapeHtml(session.dayLabel)} • ${escapeHtml(session.title)}</h4>
                <p class="day-card__sub">${escapeHtml((session.targetGroups || []).map(helpers.getMuscleLabel).join(" + "))}</p>
              </div>
              <span class="intensity-badge">${escapeHtml(session.intensity)}</span>
            </div>

            <div class="day-meta">
              <div>
                <strong>Süre</strong>
                <span>${escapeHtml(session.duration)}</span>
              </div>
              <div>
                <strong>Akış</strong>
                <span>${escapeHtml(session.structure)}</span>
              </div>
              <div>
                <strong>Seans amacı</strong>
                <span>${escapeHtml(session.purpose || "Dengeli kuvvet ve teknik kalite")}</span>
              </div>
              <div>
                <strong>V2 denge notu</strong>
                <span>${escapeHtml(session.balanceNote || "Ana hareket, destek ve mobilite dengesi korunur.")}</span>
              </div>
            </div>

            <div class="exercise-list">
              <div class="exercise-item">
                <strong>Isınma</strong>
                <span>${escapeHtml((session.warmup || []).join(" • "))}</span>
              </div>
              ${renderSessionExerciseArea(session, sessionIndex, escapeHtml, helpers)}
              <div class="exercise-item">
                <strong>Kardiyo / Bitiriş</strong>
                <span>${escapeHtml(session.cardioBlock)}</span>
              </div>
              <div class="exercise-item">
                <strong>Soğuma</strong>
                <span>${escapeHtml((session.cooldown || []).join(" • "))}</span>
              </div>
              <div class="exercise-item">
                <strong>Seans Notu</strong>
                <span>${escapeHtml(session.note)}</span>
              </div>
            </div>
          </article>
        `,
      )
      .join("");
  }

  function renderOutputIntelligence(targets, model, escapeHtml) {
    if (!targets || !model) {
      return;
    }

    if (targets.aiReportSummary) {
      targets.aiReportSummary.innerHTML = (model.cards || [])
        .map(
          (card) => `
            <article class="ai-report-card${card.hero ? " ai-report-card--hero" : ""}${card.wide ? " ai-report-card--wide" : ""}">
              <span>${escapeHtml(card.label)}</span>
              <strong>${escapeHtml(card.value)}</strong>
              <p>${escapeHtml(card.text)}</p>
            </article>
          `,
        )
        .join("");
    }

    if (targets.nextControlReport) {
      targets.nextControlReport.innerHTML = (model.nextControlItems || [])
        .map((item) => `<p>${escapeHtml(item)}</p>`)
        .join("");
    }

    if (targets.outputWarnings) {
      targets.outputWarnings.innerHTML = (model.warnings || []).length
        ? model.warnings.map((warning) => `<div class="warning-item">${escapeHtml(warning)}</div>`).join("")
        : `<div class="warning-item warning-item--good">Kritik uyarı yok. Program form kalitesi korunarak uygulanabilir.</div>`;
    }
  }

  function renderSessionExerciseArea(session, sessionIndex, escapeHtml, helpers) {
    if (!session.exerciseBlocks?.length) {
      return (session.exercises || [])
        .map((exercise, exerciseIndex) => renderExerciseLine(exercise, sessionIndex, exerciseIndex, escapeHtml, helpers))
        .join("");
    }

    return session.exerciseBlocks
      .map((block) => renderExerciseBlock(block, session, sessionIndex, escapeHtml, helpers))
      .join("");
  }

  function renderExerciseBlock(block, session, sessionIndex, escapeHtml, helpers) {
    return `
      <div class="exercise-block exercise-block--${escapeHtml(block.type)}">
        <div class="exercise-block__header">
          <div>
            <strong>${escapeHtml(block.label)}</strong>
            <span>${escapeHtml(block.instruction)}</span>
          </div>
          <em>${escapeHtml(block.rest)}</em>
        </div>
        <div class="exercise-block__items">
          ${(block.exerciseIndexes || [])
            .map((exerciseIndex) => {
              const exercise = session.exercises?.[exerciseIndex];
              return exercise ? renderExerciseLine(exercise, sessionIndex, exerciseIndex, escapeHtml, helpers) : "";
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderExerciseLine(exercise, sessionIndex, exerciseIndex, escapeHtml, helpers) {
    return `
      <div class="exercise-item exercise-line">
        <div class="exercise-line__top">
          <label class="edit-field edit-field--title">
            <span>Hareket</span>
            <input
              type="text"
              value="${escapeHtml(exercise.name)}"
              data-session-index="${sessionIndex}"
              data-exercise-index="${exerciseIndex}"
              data-program-field="name"
            />
          </label>
          <span class="muscle-badge">${escapeHtml(helpers.getMuscleLabel(exercise.group))}</span>
        </div>
        <label class="edit-field">
          <span>Hareketi değiştir</span>
          <select
            data-session-index="${sessionIndex}"
            data-exercise-index="${exerciseIndex}"
            data-program-field="exerciseId"
          >
            ${buildExerciseSelectOptions(exercise, escapeHtml, helpers)}
          </select>
        </label>
        <div class="prescription-grid">
          <label class="edit-field">
            <span>Set/tekrar</span>
            <input
              type="text"
              value="${escapeHtml(exercise.prescription)}"
              data-session-index="${sessionIndex}"
              data-exercise-index="${exerciseIndex}"
              data-program-field="prescription"
            />
          </label>
          <label class="edit-field">
            <span>Dinlenme</span>
            <input
              type="text"
              value="${escapeHtml(exercise.rest)}"
              data-session-index="${sessionIndex}"
              data-exercise-index="${exerciseIndex}"
              data-program-field="rest"
            />
          </label>
          <label class="edit-field">
            <span>Tempo</span>
            <input
              type="text"
              value="${escapeHtml(exercise.tempo)}"
              data-session-index="${sessionIndex}"
              data-exercise-index="${exerciseIndex}"
              data-program-field="tempo"
            />
          </label>
          <span><b>Ekipman:</b> ${escapeHtml(helpers.equipmentLabels[exercise.equipment])}</span>
        </div>
        <label class="edit-field">
          <span>Uygulama notu</span>
          <textarea
            rows="2"
            data-session-index="${sessionIndex}"
            data-exercise-index="${exerciseIndex}"
            data-program-field="cue"
          >${escapeHtml(exercise.cue)}</textarea>
        </label>
        ${
          exercise.alternatives?.length
            ? `<div class="alternative-list">
                <strong>Önerilen alternatifler</strong>
                ${exercise.alternatives
                  .map((alternative) => `<span>${escapeHtml(alternative.name)} <em>${escapeHtml(alternative.reason)}</em></span>`)
                  .join("")}
              </div>`
            : ""
        }
      </div>
    `;
  }

  function buildExerciseSelectOptions(currentExercise, escapeHtml, helpers) {
    const exerciseLibrary = helpers.exerciseLibrary || [];
    const equipmentLabels = helpers.equipmentLabels || {};
    const options = exerciseLibrary
      .filter((exercise) => exercise.group === currentExercise.group)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map(
        (exercise) =>
          `<option value="${exercise.id}" ${exercise.id === currentExercise.id ? "selected" : ""}>${escapeHtml(
            exercise.name,
          )} • ${escapeHtml(equipmentLabels[exercise.equipment])}</option>`,
      );

    if (!exerciseLibrary.some((exercise) => exercise.id === currentExercise.id)) {
      options.unshift(`<option value="${escapeHtml(currentExercise.id || currentExercise.name)}" selected>${escapeHtml(currentExercise.name)}</option>`);
    }

    return options.join("");
  }

  function setText(target, value) {
    if (!target) {
      return;
    }

    target.textContent = value || "";
  }

  window.BSMOutputUI = {
    buildWeeklyPlanHtml,
    renderProgramCover,
    renderProgramSections,
    renderOutputIntelligence,
  };
})();
