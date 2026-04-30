(function () {
  "use strict";

  const GIF_BASE_PATH = "./assets/gifs/";

  function buildExerciseMedia(exercise, groupLabel = "") {
    const source = exercise && typeof exercise === "object" ? exercise : {};
    const name = String(source.name || "Hareket").trim();
    const explicitGifUrl = String(source.gifUrl || "").trim();
    const slug = slugifyExerciseName(name);
    const slugUrl = `${GIF_BASE_PATH}${slug}.gif`;
    const gifUrl = explicitGifUrl || slugUrl;
    const fallbackGifUrls = explicitGifUrl ? [] : buildFallbackGifUrls(slug);

    return {
      gifUrl,
      fallbackGifUrl: fallbackGifUrls[0] || "",
      fallbackGifUrls,
      name,
      groupLabel: groupLabel || source.group || "Kas grubu",
      isExplicit: Boolean(source.gifUrl),
    };
  }

  function buildFallbackGifUrls(slug) {
    const doubleHyphenSlug = buildDoubleHyphenAlias(slug);

    return uniqueValues([
      `${GIF_BASE_PATH}${slug}.gif.gif`,
      doubleHyphenSlug ? `${GIF_BASE_PATH}${doubleHyphenSlug}.gif` : "",
      doubleHyphenSlug ? `${GIF_BASE_PATH}${doubleHyphenSlug}.gif.gif` : "",
    ]);
  }

  function buildDoubleHyphenAlias(slug) {
    const parts = String(slug || "").split("-").filter(Boolean);

    if (parts.length < 3) {
      return "";
    }

    return `${parts.slice(0, -1).join("-")}--${parts[parts.length - 1]}`;
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
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
