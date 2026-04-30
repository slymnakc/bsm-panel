(function () {
  "use strict";

  const GIF_BASE_PATH = "./assets/gifs/";

  function buildExerciseMedia(exercise, groupLabel = "") {
    const source = exercise && typeof exercise === "object" ? exercise : {};
    const name = String(source.name || "Hareket").trim();
    const explicitGifUrl = String(source.gifUrl || "").trim();
    const slugUrl = `${GIF_BASE_PATH}${slugifyExerciseName(name)}.gif`;
    const gifUrl = explicitGifUrl || slugUrl;

    return {
      gifUrl,
      fallbackGifUrl: explicitGifUrl ? "" : `${slugUrl}.gif`,
      name,
      groupLabel: groupLabel || source.group || "Kas grubu",
      isExplicit: Boolean(source.gifUrl),
    };
  }

  function slugifyExerciseName(value) {
    return normalizeTurkishText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  function normalizeTurkishText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  window.BSMExerciseMediaService = {
    GIF_BASE_PATH,
    buildExerciseMedia,
    slugifyExerciseName,
  };
})();
