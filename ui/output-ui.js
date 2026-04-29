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

    if (model?.editMode) {
      return sessions.map((session, sessionIndex) => renderEditableSession(session, sessionIndex, escapeHtml, helpers)).join("");
    }

    return sessions.map((session, sessionIndex) => renderPrintableSession(session, sessionIndex, escapeHtml, helpers)).join("");

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

  function renderPrintableSession(session, sessionIndex, escapeHtml, helpers) {
    return `
      <article class="member-program-day">
        <div class="member-program-day__header">
          <div>
            <span>${escapeHtml(session.dayLabel || `Gün ${sessionIndex + 1}`)}</span>
            <h4>${escapeHtml(session.title || "Antrenman")}</h4>
          </div>
          <small>${escapeHtml(session.duration || "")}</small>
        </div>
        <p class="member-program-day__purpose">${escapeHtml(limitToOneSentence(session.purpose || session.note || "Kontrollü teknik ve düzenli tempo ile uygulanır."))}</p>
        <div class="member-program-table">
          <div class="member-program-table__head">
            <span>Hareket</span>
            <span>Set</span>
            <span>Tekrar</span>
            <span>Dinlenme</span>
            <span>Uygulama notu</span>
          </div>
          ${renderPrintableExerciseRows(session, escapeHtml)}
        </div>
        <div class="member-program-support">
          ${renderSupportLine("Isınma", (session.warmup || []).join(" • "), escapeHtml)}
          ${renderSupportLine("Kardiyo / Bitiriş", session.cardioBlock, escapeHtml)}
          ${renderSupportLine("Soğuma", (session.cooldown || []).join(" • "), escapeHtml)}
        </div>
      </article>
    `;
  }

  function renderPrintableExerciseRows(session, escapeHtml) {
    return (session.exercises || [])
      .map((exercise) => {
        const prescription = getExercisePrescriptionParts(exercise);

        return `
          <div class="member-program-table__row">
            <strong>${escapeHtml(exercise.name || "Hareket")}</strong>
            <span data-label="Set">${escapeHtml(prescription.sets)}</span>
            <span data-label="Tekrar">${escapeHtml(prescription.reps)}</span>
            <span data-label="Dinlenme">${escapeHtml(exercise.rest || "-")}</span>
            <span data-label="Not">${escapeHtml(limitToOneSentence(exercise.cue || "Kontrollü formda uygula."))}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderEditableSession(session, sessionIndex, escapeHtml, helpers) {
    return `
      <article class="member-program-day member-program-day--editable">
        <div class="member-program-day__header">
          <div>
            <span>${escapeHtml(session.dayLabel || `Gün ${sessionIndex + 1}`)}</span>
            <h4>${escapeHtml(session.title || "Antrenman")}</h4>
          </div>
          <small>${escapeHtml(session.duration || "")}</small>
        </div>
        <p class="member-program-day__purpose">${escapeHtml(limitToOneSentence(session.purpose || session.note || "Kontrollü teknik ve düzenli tempo ile uygulanır."))}</p>
        <div class="editable-exercise-grid">
          ${(session.exercises || [])
            .map((exercise, exerciseIndex) => renderEditableExerciseCard(exercise, sessionIndex, exerciseIndex, escapeHtml, helpers))
            .join("")}
        </div>
      </article>
    `;
  }

  function renderEditableExerciseCard(exercise, sessionIndex, exerciseIndex, escapeHtml, helpers) {
    const prescription = getExercisePrescriptionParts(exercise);

    return `
      <div class="editable-exercise-card">
        <div class="editable-exercise-card__top">
          <label class="edit-field">
            <span>Kas grubu</span>
            <select data-session-index="${sessionIndex}" data-exercise-index="${exerciseIndex}" data-program-field="group">
              ${buildMuscleGroupOptions(exercise.group, escapeHtml, helpers)}
            </select>
          </label>
          <label class="edit-field">
            <span>Hareket adı</span>
            <select data-session-index="${sessionIndex}" data-exercise-index="${exerciseIndex}" data-program-field="exerciseId">
              ${buildExerciseSelectOptions(exercise, escapeHtml, helpers)}
            </select>
          </label>
        </div>
        <div class="editable-exercise-card__metrics">
          <label class="edit-field">
            <span>Set</span>
            <input type="number" min="1" max="8" step="1" value="${escapeHtml(prescription.sets)}" data-session-index="${sessionIndex}" data-exercise-index="${exerciseIndex}" data-program-field="sets" />
          </label>
          <label class="edit-field">
            <span>Tekrar</span>
            <input type="text" value="${escapeHtml(prescription.reps)}" placeholder="8-12, 10 veya AMRAP" data-session-index="${sessionIndex}" data-exercise-index="${exerciseIndex}" data-program-field="reps" />
          </label>
          <label class="edit-field">
            <span>Dinlenme</span>
            <input type="text" value="${escapeHtml(exercise.rest || "")}" placeholder="45 sn, 60 sn veya 90 sn" data-session-index="${sessionIndex}" data-exercise-index="${exerciseIndex}" data-program-field="rest" />
          </label>
          <label class="edit-field">
            <span>Tempo</span>
            <input type="text" value="${escapeHtml(exercise.tempo || "")}" placeholder="2-0-2" data-session-index="${sessionIndex}" data-exercise-index="${exerciseIndex}" data-program-field="tempo" />
          </label>
        </div>
        <label class="edit-field">
          <span>Notlar</span>
          <textarea rows="2" placeholder="Kısa uygulama notu" data-session-index="${sessionIndex}" data-exercise-index="${exerciseIndex}" data-program-field="cue">${escapeHtml(exercise.cue || "")}</textarea>
        </label>
      </div>
    `;
  }

  function buildMuscleGroupOptions(currentGroup, escapeHtml, helpers) {
    const muscleGroups = helpers.muscleGroups || [];
    const options = muscleGroups.map(
      (group) => `<option value="${escapeHtml(group.id)}" ${group.id === currentGroup ? "selected" : ""}>${escapeHtml(group.label)}</option>`,
    );

    if (currentGroup && !muscleGroups.some((group) => group.id === currentGroup)) {
      options.unshift(`<option value="${escapeHtml(currentGroup)}" selected>${escapeHtml(helpers.getMuscleLabel(currentGroup))}</option>`);
    }

    return options.join("");
  }

  function splitPrescription(value) {
    const text = String(value || "").trim();
    const setMatch = text.match(/^(.+?)\s*set\s*x\s*(.+)$/i);
    const roundMatch = text.match(/^(.+?)\s*tur\s*x\s*(.+)$/i);

    if (setMatch) {
      return {
        sets: setMatch[1].trim(),
        reps: cleanRepetitionText(setMatch[2]),
      };
    }

    if (roundMatch) {
      return {
        sets: `${roundMatch[1].trim()} tur`,
        reps: cleanRepetitionText(roundMatch[2]),
      };
    }

    return {
      sets: "-",
      reps: text || "-",
    };
  }

  function getExercisePrescriptionParts(exercise) {
    const split = splitPrescription(exercise?.prescription);

    return {
      sets: normalizeSetValue(exercise?.sets || split.sets),
      reps: String(exercise?.reps || split.reps || "-").trim() || "-",
    };
  }

  function normalizeSetValue(value) {
    const text = String(value || "").trim();
    const numericMatch = text.match(/\d+/);

    return numericMatch ? numericMatch[0] : "1";
  }

  function cleanRepetitionText(value) {
    return String(value || "").replace(/\s*tekrar\s*$/i, "").trim() || "-";
  }

  function renderSupportLine(label, value, escapeHtml) {
    if (!value) {
      return "";
    }

    return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(limitToOneSentence(value))}</p>`;
  }

  function limitToOneSentence(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();

    if (!text) {
      return "";
    }

    const sentenceMatch = text.match(/^.*?[.!?](?:\s|$)/);
    const sentence = sentenceMatch ? sentenceMatch[0].trim() : text;

    return sentence.length > 130 ? `${sentence.slice(0, 127).trim()}...` : sentence;
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
