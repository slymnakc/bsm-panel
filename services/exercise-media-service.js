(function () {
  "use strict";

  const GIF_BASE_PATH = "./assets/gifs/";

  function buildExerciseMedia(exercise, groupLabel = "") {
    const source = exercise && typeof exercise === "object" ? exercise : {};
    const name = String(source.name || "Hareket").trim();
    const explicitGifUrl = getExplicitMediaUrl(source);
    const slug = slugifyExerciseName(name);
    // BUG-LIBRARY-GIF-001: yerel GIF yolları yalnız manifest'te (window.BSMGifManifest)
    // var olan slug'lar için üretilir — eksik dosyaya network isteği hiç yapılmaz.
    // Explicit/custom gifUrl manifest'ten MUAFTIR (mevcut davranış korunur).
    const manifest = getGifManifestSet();

    if (explicitGifUrl) {
      const fallbackGifUrls = buildExplicitFallbackGifUrls(explicitGifUrl, slug)
        .filter((url) => isLocalGifUrlInManifest(url, manifest));
      const candidateGifUrls = uniqueValues([normalizeLocalGifPath(explicitGifUrl), explicitGifUrl, ...fallbackGifUrls]);

      return {
        gifUrl: explicitGifUrl,
        fallbackGifUrl: fallbackGifUrls[0] || "",
        fallbackGifUrls,
        candidateGifUrls,
        name,
        slug,
        groupLabel: groupLabel || source.group || "Kas grubu",
        isExplicit: true,
      };
    }

    // Slug tabanlı: alias zinciri network denemesi yerine manifest üzerinde çözülür.
    const aliasSlugs = uniqueValues([
      slug,
      buildDoubleHyphenAlias(slug),
      slugifyExerciseName(source?.id || ""),
      stripCommonEquipmentPrefix(slug),
    ]);
    const resolvedSlugs = manifest ? aliasSlugs.filter((alias) => manifest.has(alias)) : aliasSlugs;
    const resolvedUrls = resolvedSlugs.map(buildGifUrl);

    return {
      gifUrl: resolvedUrls[0] || "",
      fallbackGifUrl: resolvedUrls[1] || "",
      fallbackGifUrls: resolvedUrls.slice(1),
      candidateGifUrls: resolvedUrls,
      name,
      slug,
      groupLabel: groupLabel || source.group || "Kas grubu",
      isExplicit: false,
    };
  }

  // Manifest yoksa (script yüklenmemiş / eski sayfa) null döner → legacy optimistik davranış.
  function getGifManifestSet() {
    const list = typeof window !== "undefined" ? window.BSMGifManifest : null;
    return Array.isArray(list) ? new Set(list) : null;
  }

  // Yerel assets/gifs URL'i manifest'e tabidir; remote/başka path'ler serbesttir.
  function isLocalGifUrlInManifest(url, manifest) {
    if (!manifest) {
      return true;
    }

    const text = String(url || "");
    const match = text.match(/assets\/gifs\/([a-z0-9-]+)\.gif$/i);

    if (!match) {
      return true;
    }

    return manifest.has(match[1]);
  }

  function getExplicitMediaUrl(source) {
    const media = source.media && typeof source.media === "object" ? source.media : {};
    return String(
      source.gifUrl ||
        source.gif ||
        source.exerciseGif ||
        source.exerciseGifUrl ||
        source.image ||
        source.imageUrl ||
        source.mediaUrl ||
        media.gifUrl ||
        media.gif ||
        media.exerciseGif ||
        media.url ||
        media.image ||
        media.imageUrl ||
        media.mediaUrl ||
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
      doubleHyphenSlug ? buildGifUrl(doubleHyphenSlug) : "",
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
