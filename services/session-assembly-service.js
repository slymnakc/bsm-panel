(function () {
  "use strict";

  function buildSessionDuration(data) {
    return `${Math.max(30, data.duration - 5)}-${data.duration} dakika`;
  }

  function buildSessionDraft(payload, deps) {
    const {
      day,
      sessionBlueprint,
      sessionIndex,
      data,
      exercises,
      exerciseBlocks,
      warmup,
      cooldown,
      cardioBlock,
    } = payload;
    const {
      getDayLabel,
      recommendStructure,
      normalizeTrainingSystem,
      buildSessionNote,
    } = deps;

    return {
      sessionIndex,
      dayLabel: getDayLabel(day),
      title: sessionBlueprint.title,
      intensity: sessionBlueprint.intensity,
      targetGroups: sessionBlueprint.groups,
      duration: buildSessionDuration(data),
      structure: recommendStructure(data, sessionBlueprint.groups, exercises.length),
      trainingSystem: normalizeTrainingSystem(data.trainingSystem),
      exerciseBlocks,
      warmup,
      exercises,
      cardioBlock,
      cooldown,
      note: buildSessionNote(data, sessionBlueprint.groups),
    };
  }

  window.BSMSessionAssemblyService = {
    buildSessionDuration,
    buildSessionDraft,
  };
})();
