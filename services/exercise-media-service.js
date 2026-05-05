(function () {
  "use strict";

  const GIF_BASE_PATH = "./assets/gifs/";

  function buildExerciseMedia(exercise, groupLabel = "") {
    const source = exercise && typeof exercise === "object" ? exercise : {};
    const name = String(source.name || "Hareket").trim();
    const explicitGifUrl = getExplicitMediaUrl(source);
    const slug = slugifyExerciseName(name);
    const slugUrl = buildGifUrl(slug);
    const gifUrl = explicitGifUrl || slugUrl;
    const fallbackGifUrls = explicitGifUrl ? buildExplicitFallbackGifUrls(explicitGifUrl, slug) : buildFallbackGifUrls(source, slug);

    return {
      gifUrl,
      fallbackGifUrl: fallbackGifUrls[0] || "",
      fallbackGifUrls,
      name,
      groupLabel: groupLabel || source.group || "Kas grubu",
      isExplicit: Boolean(explicitGifUrl),
    };
  }

  function getExplicitMediaUrl(source) {
    const media = source.media && typeof source.media === "object" ? source.media : {};
    return String(
      source.gifUrl ||
        source.exerciseGif ||
        source.exerciseGifUrl ||
        source.image ||
        source.imageUrl ||
        source.mediaUrl ||
        media.gifUrl ||
        media.exerciseGif ||
        media.url ||
        media.image ||
        media.imageUrl ||
        "",
    ).trim();
  }

  function buildExplicitFallbackGifUrls(explicitGifUrl, slug) {
    return uniqueValues([
      normalizeLocalGifPath(explicitGifUrl),
      ...buildFallbackGifUrls({}, slug),
    ]).filter((url) => url !== explicitGifUrl);
  }

  function buildFallbackGifUrls(source, slug) {
    const doubleHyphenSlug = buildDoubleHyphenAlias(slug);
    const idSlug = slugifyExerciseName(source?.id || "");
    const nameWithoutEquipment = stripCommonEquipmentPrefix(slug);

    return uniqueValues([
      buildGifUrl(slug),
      `${buildGifUrl(slug)}.gif`,
      doubleHyphenSlug ? buildGifUrl(doubleHyphenSlug) : "",
      doubleHyphenSlug ? `${buildGifUrl(doubleHyphenSlug)}.gif` : "",
      idSlug ? buildGifUrl(idSlug) : "",
      nameWithoutEquipment ? buildGifUrl(nameWithoutEquipment) : "",
    ]);
  }

  function buildGifUrl(slug) {
    return slug ? `${GIF_BASE_PATH}${slug}.gif` : "";
  }

  function normalizeLocalGifPath(value) {
    const text = String(value || "").trim();

    if (!text || text.includes("/") || text.includes("\\") || /^https?:\/\//i.test(text)) {
      return text;
    }

    return `${GIF_BASE_PATH}${text.replace(/\.gif$/i, "")}.gif`;
  }

  function stripCommonEquipmentPrefix(slug) {
    return String(slug || "").replace(/^(barbell|dumbbell|machine|cable|band|bodyweight|smith|kettlebell)-/, "");
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
