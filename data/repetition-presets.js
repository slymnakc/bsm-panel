(function () {
  "use strict";

  const repetitionModelOptions = [
    { value: "fixed", label: "Fixed", description: "Ayni tekrar araligi" },
    { value: "pyramid", label: "Pyramid", description: "Tekrar azalir, yuk artar" },
    { value: "reverse-pyramid", label: "Reverse Pyramid", description: "Agir baslar, tekrar artar" },
    { value: "strength", label: "Strength", description: "Kuvvet odakli dusuk tekrar" },
    { value: "hypertrophy", label: "Hypertrophy", description: "Kas gelisimi odakli" },
    { value: "endurance", label: "Endurance", description: "Dayaniklilik ve kondisyon" },
    { value: "advanced", label: "Advanced", description: "Drop set, AMRAP ve ileri teknikler" },
    { value: "custom", label: "Custom", description: "Antrenor manuel giris" },
  ];

  const repetitionPresets = [
    preset("fixed-2-10", "fixed", 2, ["10", "10"], ["beginner"]),
    preset("fixed-2-12", "fixed", 2, ["12", "12"], ["beginner", "maintenance"]),
    preset("fixed-2-15", "fixed", 2, ["15", "15"], ["fat-loss", "conditioning"]),
    preset("fixed-3-8", "fixed", 3, ["8", "8", "8"], ["strength"]),
    preset("fixed-3-10", "fixed", 3, ["10", "10", "10"], ["beginner", "maintenance"]),
    preset("fixed-3-12", "fixed", 3, ["12", "12", "12"], ["hypertrophy", "muscle-gain"]),
    preset("fixed-3-15", "fixed", 3, ["15", "15", "15"], ["fat-loss", "conditioning"]),
    preset("fixed-4-6", "fixed", 4, ["6", "6", "6", "6"], ["strength"]),
    preset("fixed-4-8", "fixed", 4, ["8", "8", "8", "8"], ["strength", "muscle-gain"]),
    preset("fixed-4-10", "fixed", 4, ["10", "10", "10", "10"], ["hypertrophy"]),
    preset("fixed-4-12", "fixed", 4, ["12", "12", "12", "12"], ["hypertrophy", "maintenance"]),
    preset("fixed-4-15", "fixed", 4, ["15", "15", "15", "15"], ["fat-loss", "conditioning"]),

    preset("pyramid-3-12-10-8", "pyramid", 3, ["12", "10", "8"], ["hypertrophy", "muscle-gain"]),
    preset("pyramid-3-15-12-10", "pyramid", 3, ["15", "12", "10"], ["beginner", "hypertrophy"]),
    preset("pyramid-3-20-15-12", "pyramid", 3, ["20", "15", "12"], ["fat-loss", "conditioning"]),
    preset("pyramid-4-12-10-8-6", "pyramid", 4, ["12", "10", "8", "6"], ["strength", "muscle-gain"]),
    preset("pyramid-4-15-12-10-8", "pyramid", 4, ["15", "12", "10", "8"], ["hypertrophy"]),
    preset("pyramid-4-20-15-12-10", "pyramid", 4, ["20", "15", "12", "10"], ["fat-loss", "conditioning"]),
    preset("pyramid-5-15-12-10-8-6", "pyramid", 5, ["15", "12", "10", "8", "6"], ["advanced", "muscle-gain"]),
    preset("pyramid-5-20-15-12-10-8", "pyramid", 5, ["20", "15", "12", "10", "8"], ["conditioning"]),

    preset("reverse-3-6-8-10", "reverse-pyramid", 3, ["6", "8", "10"], ["strength", "advanced"]),
    preset("reverse-3-8-10-12", "reverse-pyramid", 3, ["8", "10", "12"], ["hypertrophy"]),
    preset("reverse-4-6-8-10-12", "reverse-pyramid", 4, ["6", "8", "10", "12"], ["strength", "advanced"]),
    preset("reverse-4-8-10-12-15", "reverse-pyramid", 4, ["8", "10", "12", "15"], ["hypertrophy", "maintenance"]),
    preset("reverse-5-5-6-8-10-12", "reverse-pyramid", 5, ["5", "6", "8", "10", "12"], ["advanced", "strength"]),
    preset("reverse-5-8-10-12-15-20", "reverse-pyramid", 5, ["8", "10", "12", "15", "20"], ["conditioning"]),

    preset("strength-3-5", "strength", 3, ["5", "5", "5"], ["strength", "beginner"]),
    preset("strength-3-6", "strength", 3, ["6", "6", "6"], ["strength"]),
    preset("strength-4-5", "strength", 4, ["5", "5", "5", "5"], ["strength"]),
    preset("strength-4-6-5-5-4", "strength", 4, ["6", "5", "5", "4"], ["advanced", "strength"]),
    preset("strength-5-5", "strength", 5, ["5", "5", "5", "5", "5"], ["strength", "advanced"]),
    preset("strength-5-3", "strength", 5, ["3", "3", "3", "3", "3"], ["advanced", "strength"]),
    preset("strength-6-3", "strength", 6, ["3", "3", "3", "3", "3", "3"], ["advanced"]),

    preset("hypertrophy-3-10-12", "hypertrophy", 3, ["10-12", "10-12", "10-12"], ["muscle-gain", "beginner"]),
    preset("hypertrophy-3-12-15", "hypertrophy", 3, ["12-15", "12-15", "12-15"], ["fat-loss", "maintenance"]),
    preset("hypertrophy-4-8-12", "hypertrophy", 4, ["8-12", "8-12", "8-12", "8-12"], ["muscle-gain"]),
    preset("hypertrophy-4-10-12", "hypertrophy", 4, ["10-12", "10-12", "10-12", "10-12"], ["hypertrophy"]),
    preset("hypertrophy-4-12-15", "hypertrophy", 4, ["12-15", "12-15", "12-15", "12-15"], ["fat-loss"]),
    preset("hypertrophy-5-8-10-10-12-12", "hypertrophy", 5, ["8", "10", "10", "12", "12"], ["advanced", "muscle-gain"]),
    preset("hypertrophy-5-10-12", "hypertrophy", 5, ["10-12", "10-12", "10-12", "10-12", "10-12"], ["advanced"]),

    preset("endurance-2-20", "endurance", 2, ["20", "20"], ["beginner", "conditioning"]),
    preset("endurance-3-20", "endurance", 3, ["20", "20", "20"], ["fat-loss", "conditioning"]),
    preset("endurance-3-25", "endurance", 3, ["25", "25", "25"], ["conditioning"]),
    preset("endurance-4-15-20", "endurance", 4, ["15-20", "15-20", "15-20", "15-20"], ["fat-loss"]),
    preset("endurance-4-20-15-12-12", "endurance", 4, ["20", "15", "12", "12"], ["conditioning", "fat-loss"]),
    preset("endurance-5-20", "endurance", 5, ["20", "20", "20", "20", "20"], ["advanced", "conditioning"]),
    preset("endurance-6-circuit", "endurance", 6, ["40 sn", "40 sn", "40 sn", "40 sn", "40 sn", "40 sn"], ["conditioning"]),

    preset("advanced-3-dropset", "advanced", 3, ["12", "10", "8 + dropset"], ["advanced", "muscle-gain"]),
    preset("advanced-3-amrap", "advanced", 3, ["10", "10", "AMRAP"], ["advanced", "conditioning"]),
    preset("advanced-4-dropset", "advanced", 4, ["12", "10", "8", "8 + dropset"], ["advanced", "hypertrophy"]),
    preset("advanced-4-rest-pause", "advanced", 4, ["8", "8", "8", "AMRAP rest-pause"], ["advanced", "strength"]),
    preset("advanced-4-myorep", "advanced", 4, ["15", "5", "5", "5"], ["advanced", "hypertrophy"]),
    preset("advanced-5-wave", "advanced", 5, ["6", "8", "6", "8", "10"], ["advanced", "strength"]),
    preset("advanced-5-dropset", "advanced", 5, ["12", "10", "8", "8", "8 + dropset"], ["advanced"]),
    preset("advanced-6-cluster", "advanced", 6, ["3+3", "3+3", "3+3", "3+3", "3+3", "3+3"], ["advanced", "strength"]),
  ];

  function preset(id, model, sets, reps, tags = []) {
    return {
      id,
      model,
      sets,
      reps,
      label: reps.join("-"),
      tags,
    };
  }

  window.BSMRepetitionPresetData = {
    repetitionModelOptions,
    repetitionPresets,
  };
})();
