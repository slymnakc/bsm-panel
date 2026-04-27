(function () {
  "use strict";

  function getMuscleLabel(groupId) {
    const muscleGroups = window.BSMOptionData?.muscleGroups || [];
    return muscleGroups.find((group) => group.id === groupId)?.label || groupId;
  }

  function getDayLabel(value) {
    const dayMeta = window.BSMOptionData?.dayMeta || [];
    return dayMeta.find((day) => day.value === value)?.label || value;
  }

  function labelExerciseKind(kind) {
    const labels = {
      compound: "Ana hareket",
      accessory: "İzolasyon",
      core: "Core",
      cardio: "Kardiyo",
      conditioning: "Kondisyon",
      mobility: "Mobilite",
    };

    return labels[kind] || kind;
  }

  function labelExerciseLevel(level) {
    const labels = {
      beginner: "Başlangıç",
      intermediate: "Orta",
      advanced: "İleri",
    };

    return labels[level] || level;
  }

  window.BSMLabelUtils = {
    getMuscleLabel,
    getDayLabel,
    labelExerciseKind,
    labelExerciseLevel,
  };
})();
