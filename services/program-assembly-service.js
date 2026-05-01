(function () {
  "use strict";

  function formatProgramCreatedAt(createdAtIso) {
    return new Date(createdAtIso).toLocaleString("tr-TR", {
      dateStyle: "long",
      timeStyle: "short",
    });
  }

  function buildProgramDocument(payload) {
    const {
      schemaVersion,
      createdAtIso,
      title,
      overview,
      coachNote,
      sessions,
      progression,
      guidance,
      coverage,
      aiReport,
      programIntelligence,
      trainingReport,
      v3Insights,
      programContext,
      rawData,
    } = payload;

    return {
      schemaVersion,
      createdAtIso,
      createdAt: formatProgramCreatedAt(createdAtIso),
      title,
      overview,
      coachNote,
      sessions,
      progression,
      guidance,
      coverage,
      aiReport,
      programIntelligence,
      trainingReport,
      v3Insights,
      programContext,
      rawData,
    };
  }

  window.BSMProgramAssemblyService = {
    formatProgramCreatedAt,
    buildProgramDocument,
  };
})();
