// outputActions.js — Refactor Adım 4A.2.2 (STRICT MECHANICAL EXTRACTION).
// Output action katmani (PDF/HTML/Print/Copy + export pipeline) handlers/output-handlers.js'den
// BIREBIR tasindi. Davranis degisikligi YOK; signature/branch/flag/serializer output sirasi korundu.
//
// !!! REWRITE DEGIL — sadece OWNERSHIP TRANSFER. buildLiveProgramHtml serializer'i,
// inlineImages branch'i, base64 GIF logic, Blob flow, fetch flow AYNEN korundu.
// Runtime DOM render ile export render BIRLESTIRILMEDI (preview/export divergence riski
// kasitli olarak ayrik birakildi).
//
// KAPSAM ICI:
//   Action handlers (4):
//     - copyPlanText (public: copyProgramAsText)
//     - handlePrintPlan
//     - handleDownloadProgramPdf
//     - handleDownloadLiveProgram (public: handleDownloadProgramHtml)
//   Export pipeline (buildLiveProgramHtml + 17 helper — birebir):
//     - buildLiveProgramHtml, stripTrainerOnlySectionsFromLiveExport, removeExportSectionById,
//       simplifyLiveNutritionSection, hydrateExerciseMediaForExport, resolveFirstFetchableImage,
//       inlineNonExerciseImagesInClone, buildExportGifCandidates, normalizeGifCandidateUrl,
//       ensureExportMediaButton, ensureExportMediaImage, markExportMediaMissing,
//       getExerciseMediaName, getExerciseMediaGroup, blobToDataUrl, buildLiveProgramCss,
//       slugifyExerciseFilePart, uniqueStrings
//   SHARED (mail flow da kullanir — public API ile expose edilir):
//     - buildProgramPdfPayload + buildMailProgramData + getMailExerciseGroupLabel +
//       splitMailExercisePrescription + limitMailSentence
//     - setProgramDeliveryStatus
//     - slugifyFilePart
//
// KAPSAM DISI (handlers/output-handlers.js'de KALIYOR):
//   - handleSendProgramMail + mail helper'lari (4A.2.3'e birakildi) — bu fn'ler artik
//     window.BSMOutputActions.buildLiveProgramHtml / buildProgramPdfPayload /
//     setProgramDeliveryStatus / slugifyFilePart cagirir (CROSS-MODULE REFERENCE).
//   - Backup/CSV handler'lari (member/backup domain)
//   - inlineImagesInClone (572) — olu kod, cagrilmiyor; output-handlers'da kaldi.
//   - renderProgram — PROGRAM orchestrator, app.js'de.
//
// handlePrintPlan ORCHESTRATION zinciri korundu:
//   state.programEditMode mutate → getCurrentProgramFromEditor → validateEditableProgram →
//   renderProgram(..., preserveEditState:true) → setTimeout(print, 50). Optimize EDILMEDI.
//
// Dependency injection (17 madde — koddan dogrulanmis; user'in varsayimsal listesi duzeltildi):
//   state, domRefs{resultsSection, programDeliveryStatus}, showStatus, renderProgram,
//   getCurrentProgramFromEditor, validateEditableProgram, loadLastPlan, collectFormData,
//   findActiveMember, convertProgramToText, downloadFile, formatFileDate, escapeHtml,
//   labelMaps, getDayLabel, windowObject, navigatorObject
//   (BSMPdfDownloadService → windowObject.BSMPdfDownloadService üzerinden)

(function () {
  "use strict";

  var _state = null;
  var _domRefs = {};
  var _showStatus = function () {};
  var _renderProgram = function () {};
  var _getCurrentProgramFromEditor = function () { return null; };
  var _validateEditableProgram = function () { return ""; };
  var _loadLastPlan = function () { return null; };
  var _collectFormData = function () { return {}; };
  var _findActiveMember = function () { return null; };
  var _convertProgramToText = function () { return ""; };
  var _downloadFile = function () {};
  var _formatFileDate = function () { return ""; };
  var _escapeHtmlDep = function (s) { return String(s == null ? "" : s); };
  var _labelMaps = {};
  var _getDayLabel = function (d) { return d; };
  var _windowObject = typeof window !== "undefined" ? window : {};
  var _navigatorObject = typeof navigator !== "undefined" ? navigator : {};

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (deps.domRefs) _domRefs = deps.domRefs;
    if (typeof deps.showStatus === "function") _showStatus = deps.showStatus;
    if (typeof deps.renderProgram === "function") _renderProgram = deps.renderProgram;
    if (typeof deps.getCurrentProgramFromEditor === "function") _getCurrentProgramFromEditor = deps.getCurrentProgramFromEditor;
    if (typeof deps.validateEditableProgram === "function") _validateEditableProgram = deps.validateEditableProgram;
    if (typeof deps.loadLastPlan === "function") _loadLastPlan = deps.loadLastPlan;
    if (typeof deps.collectFormData === "function") _collectFormData = deps.collectFormData;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.convertProgramToText === "function") _convertProgramToText = deps.convertProgramToText;
    if (typeof deps.downloadFile === "function") _downloadFile = deps.downloadFile;
    if (typeof deps.formatFileDate === "function") _formatFileDate = deps.formatFileDate;
    if (typeof deps.escapeHtml === "function") _escapeHtmlDep = deps.escapeHtml;
    if (deps.labelMaps) _labelMaps = deps.labelMaps;
    if (typeof deps.getDayLabel === "function") _getDayLabel = deps.getDayLabel;
    if (deps.windowObject) _windowObject = deps.windowObject;
    if (deps.navigatorObject) _navigatorObject = deps.navigatorObject;
  }

  // ── escapeHtml (output-handlers.js lokal kopyasi birebir) ───────────
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ═══════════════════════════════════════════════════════════════════
  // ACTION HANDLERS (birebir — output-handlers.js:45-157)
  // ═══════════════════════════════════════════════════════════════════

  async function copyPlanText() {
    const savedPlan = _getCurrentProgramFromEditor() || _loadLastPlan();

    if (!savedPlan?.schemaVersion) {
      _showStatus("Kopyalanacak bir üye programı yok. Önce program oluşturun.", "error");
      return;
    }

    try {
      if (!_navigatorObject.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }

      await _navigatorObject.clipboard.writeText(_convertProgramToText(savedPlan));
      _showStatus("Üye programı panoya kopyalandı.", "success");
    } catch (error) {
      _showStatus("Tarayıcı panoya kopyalama izni vermedi. Yazdır / PDF seçeneğini kullanabilirsiniz.", "error");
    }
  }

  function handlePrintPlan() {
    if (_state.programEditMode) {
      const currentProgram = _getCurrentProgramFromEditor();
      const validationMessage = _validateEditableProgram?.(currentProgram) || "";

      if (validationMessage) {
        _showStatus(validationMessage, "error");
        return;
      }

      _state.programEditMode = false;
      _renderProgram(currentProgram, { preserveEditState: true });
      _windowObject.setTimeout(() => _windowObject.print(), 50);
      return;
    }

    _windowObject.print();
  }

  async function handleDownloadProgramPdf() {
    let program = _getCurrentProgramFromEditor() || _loadLastPlan();

    if (!program?.schemaVersion) {
      setProgramDeliveryStatus("PDF indirilebilmesi için önce program oluşturun.", "error");
      return;
    }

    if (_state.programEditMode) {
      const currentProgram = _getCurrentProgramFromEditor();
      const validationMessage = _validateEditableProgram?.(currentProgram) || "";

      if (validationMessage) {
        setProgramDeliveryStatus(validationMessage, "error");
        return;
      }

      _state.programEditMode = false;
      program = currentProgram;
      _renderProgram(currentProgram, { preserveEditState: true });
    }

    const pdfService = _windowObject.BSMPdfDownloadService;

    if (!pdfService?.downloadProgramPdf) {
      setProgramDeliveryStatus("Premium PDF servisi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.", "error");
      return;
    }

    const profile = _collectFormData();
    const activeMember = _findActiveMember();
    const memberName = profile.memberName || activeMember?.profile?.memberName || "uye";
    const filename = `bahcesehir-program-${slugifyFilePart(memberName)}-${_formatFileDate(new Date())}.pdf`;

    try {
      setProgramDeliveryStatus("Premium PDF hazırlanıyor...", "loading");
      const result = await pdfService.downloadProgramPdf({
        payload: buildProgramPdfPayload(program, profile, activeMember),
        filename,
        downloadFile: _downloadFile,
        windowObject: _windowObject,
      });

      if (!result.ok) {
        throw new Error(result.message || "PDF oluşturulamadı.");
      }

      setProgramDeliveryStatus(result.message || "Premium program PDF'i indirildi.", "success");
    } catch (error) {
      console.error("Program PDF download error", error);
      setProgramDeliveryStatus(`PDF oluşturulamadı: ${error.message || "Lütfen tekrar deneyin."}`, "error");
    }
  }

  async function handleDownloadLiveProgram() {
    const program = _getCurrentProgramFromEditor() || _loadLastPlan();

    if (!program?.schemaVersion) {
      setProgramDeliveryStatus("Canlı program indirilebilmesi için önce program oluşturun.", "error");
      return;
    }

    try {
      setProgramDeliveryStatus("Canlı program dosyası hazırlanıyor...", "loading");
      const html = await buildLiveProgramHtml(program, { inlineImages: true });
      const profile = _collectFormData();
      const filename = `bahcesehir-canli-program-${slugifyFilePart(profile.memberName || "uye")}-${_formatFileDate(new Date())}.html`;
      _downloadFile(filename, html, "text/html;charset=utf-8");
      setProgramDeliveryStatus("Canlı program HTML dosyası indirildi.", "success");
    } catch (error) {
      console.error("Live program export error", error);
      setProgramDeliveryStatus("Canlı program indirilemedi. Lütfen tekrar deneyin.", "error");
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT PIPELINE (buildLiveProgramHtml + helpers — birebir, output-handlers.js:272-641)
  // inlineImages branch + base64 GIF logic + HTML output structure DEGISMEDI.
  // ═══════════════════════════════════════════════════════════════════

  async function buildLiveProgramHtml(program, options = {}) {
    const resultsSection = _domRefs.resultsSection;
    const clone = resultsSection.cloneNode(true);
    clone.classList.remove("hidden", "is-hidden");
    clone.querySelectorAll(".results__header .panel-actions, .program-delivery-panel, .program-delivery-status, .program-mail-history, #programDeliveryStatus, #programMailHistory").forEach((node) => node.remove());
    stripTrainerOnlySectionsFromLiveExport(clone);
    clone.querySelectorAll("button, input, select, textarea").forEach((node) => {
      if (node.tagName === "BUTTON") {
        node.remove();
        return;
      }

      const value = node.value || node.textContent || "";
      const replacement = _windowObject.document.createElement("span");
      replacement.textContent = value;
      replacement.className = "exported-field-value";
      node.replaceWith(replacement);
    });

    await hydrateExerciseMediaForExport(clone, { inlineImages: Boolean(options.inlineImages) });

    if (options.inlineImages) {
      await inlineNonExerciseImagesInClone(clone);
    }

    const title = escapeHtml(program.title || "Bahçeşehir Spor Merkezi Antrenman Programı");
    return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${buildLiveProgramCss()}</style>
</head>
<body>
  <main class="live-program-shell">
    <header class="live-program-header">
      <div>
        <span>Bahçeşehir Spor Merkezi</span>
        <h1>${title}</h1>
      </div>
      <strong>GIF destekli canlı program</strong>
    </header>
    ${clone.innerHTML}
  </main>
  <div class="gif-lightbox" id="gifLightbox" hidden>
    <button type="button" aria-label="Kapat">×</button>
    <img alt="Egzersiz GIF büyütülmüş önizleme" />
  </div>
  <script>
    document.addEventListener("click", function (event) {
      var img = event.target.closest("[data-exercise-gif-img]");
      var lightbox = document.getElementById("gifLightbox");
      if (img && lightbox) {
        lightbox.querySelector("img").src = img.src;
        lightbox.hidden = false;
      }
      if (event.target.closest("#gifLightbox button") || event.target.id === "gifLightbox") {
        lightbox.hidden = true;
      }
    });
    document.addEventListener("error", function (event) {
      var img = event.target;
      if (!img || !img.matches || !img.matches("[data-exercise-gif-img]")) return;
      var button = img.closest("[data-exercise-gif-open]");
      var card = img.closest("[data-exercise-media]");
      var tried = (img.dataset.fallbackTriedUrls || "").split("|").filter(Boolean);
      var current = img.getAttribute("src") || "";
      if (current) tried.push(current);
      var fallbacks = ((button && button.dataset.gifFallbackUrls) || "").split("|").filter(Boolean);
      var next = fallbacks.find(function (url) { return tried.indexOf(url) === -1; });
      img.dataset.fallbackTriedUrls = tried.join("|");
      if (next) {
        img.src = next;
        if (button) button.dataset.gifUrl = next;
        return;
      }
      if (card) card.classList.add("is-missing");
      img.removeAttribute("src");
    }, true);
  </script>
</body>
</html>`;
  }

  function stripTrainerOnlySectionsFromLiveExport(clone) {
    [
      "trainingReportPanel",
      "coachNote",
      "aiReportSummary",
      "nextControlReport",
      "outputWarnings",
      "muscleCoverage",
      "progressionPlan",
      "guidanceBlock",
    ].forEach((id) => removeExportSectionById(clone, id));

    clone.querySelectorAll(".output-detail-panel, .program-edit-toolbar").forEach((node) => node.remove());
    simplifyLiveNutritionSection(clone);
  }

  function removeExportSectionById(clone, id) {
    const target = clone.querySelector(`#${id}`);
    const section = target?.closest(".result-card, section, article");

    if (section) {
      section.remove();
    }
  }

  function simplifyLiveNutritionSection(clone) {
    const nutritionOutput = clone.querySelector("#outputNutritionPlan");

    if (!nutritionOutput) {
      return;
    }

    nutritionOutput.innerHTML = `
        <article class="nutrition-output-card nutrition-output-card--workout-notice">
          <div class="nutrition-output-card__header">
            <strong>Beslenme Bilgisi</strong>
          </div>
          <p>Beslenme planı uygulama içindeki Beslenme sekmesinde sunulmaktadır.</p>
        </article>
      `;
  }

  async function hydrateExerciseMediaForExport(clone, options = {}) {
    const mediaCards = [...clone.querySelectorAll("[data-exercise-media]")];

    for (const card of mediaCards) {
      const name = getExerciseMediaName(card);
      const groupLabel = getExerciseMediaGroup(card);
      const candidates = buildExportGifCandidates(card, name);

      if (!candidates.length) {
        markExportMediaMissing(card);
        continue;
      }

      const resolved = options.inlineImages ? await resolveFirstFetchableImage(candidates) : null;
      const selectedUrl = resolved?.dataUrl || candidates[0];
      const fallbackUrls = resolved?.dataUrl ? [] : candidates.slice(1);
      const button = ensureExportMediaButton(card, name, groupLabel);
      const image = ensureExportMediaImage(button, name);

      card.classList.remove("is-missing");
      card.dataset.exerciseMedia = selectedUrl;
      card.dataset.exerciseName = name;
      card.dataset.exerciseGroup = groupLabel;
      button.dataset.gifUrl = selectedUrl;
      button.dataset.gifFallbackUrls = fallbackUrls.join("|");
      button.dataset.exerciseName = name;
      button.dataset.exerciseGroup = groupLabel;
      image.src = selectedUrl;
      image.alt = `${name} GIF`;
      image.setAttribute("loading", "lazy");
    }
  }

  async function resolveFirstFetchableImage(candidates) {
    for (const candidate of candidates) {
      try {
        if (/^data:/i.test(candidate)) {
          return { originalUrl: candidate, dataUrl: candidate };
        }

        const absoluteUrl = new URL(candidate, _windowObject.location.href).href;
        const response = await _windowObject.fetch(absoluteUrl);

        if (!response.ok) {
          continue;
        }

        const blob = await response.blob();
        return {
          originalUrl: candidate,
          dataUrl: await blobToDataUrl(blob),
        };
      } catch (error) {
        // file:// kaynaklarda tarayıcı fetch engelleyebilir; bu durumda relative yol korunur.
      }
    }

    return null;
  }

  async function inlineNonExerciseImagesInClone(clone) {
    const images = [...clone.querySelectorAll("img")]
      .filter((image) => image.getAttribute("src"))
      .filter((image) => !image.matches("[data-exercise-gif-img]"));

    for (const image of images) {
      try {
        const absoluteUrl = new URL(image.getAttribute("src"), _windowObject.location.href).href;
        const response = await _windowObject.fetch(absoluteUrl);

        if (!response.ok) {
          continue;
        }

        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        image.setAttribute("src", dataUrl);
      } catch (error) {
        // Görsel yolu yerelde okunamazsa mevcut yol korunur; canlı panelde yine çalışır.
      }
    }
  }

  function buildExportGifCandidates(card, name) {
    const button = card.querySelector("[data-exercise-gif-open]");
    const image = card.querySelector("[data-exercise-gif-img]");
    const slug = slugifyExerciseFilePart(card.dataset.gifSlug || name);
    const explicitUrls = [
      card.dataset.exerciseMedia,
      button?.dataset.gifUrl,
      image?.getAttribute("src"),
      button?.dataset.gifFallbackUrl,
      ...(button?.dataset.gifFallbackUrls || "").split("|"),
    ];
    const slugUrls = [
      slug ? `./assets/gifs/${slug}.gif` : "",
      slug ? `assets/gifs/${slug}.gif` : "",
    ];

    return uniqueStrings([...explicitUrls.map(normalizeGifCandidateUrl), ...slugUrls]);
  }

  function normalizeGifCandidateUrl(value) {
    const text = String(value || "").trim();

    if (!text || /^data:/i.test(text) || /^https?:\/\//i.test(text) || text.includes("/") || text.includes("\\")) {
      return text;
    }

    return `./assets/gifs/${text.replace(/\.gif$/i, "")}.gif`;
  }

  function ensureExportMediaButton(card, name, groupLabel) {
    let button = card.querySelector("[data-exercise-gif-open]");

    if (button) {
      return button;
    }

    button = _windowObject.document.createElement("button");
    button.type = "button";
    button.className = "exercise-media__button";
    button.setAttribute("data-exercise-gif-open", "");
    button.dataset.exerciseName = name;
    button.dataset.exerciseGroup = groupLabel;
    button.setAttribute("aria-label", `${name} GIF önizlemesini büyüt`);
    card.prepend(button);
    return button;
  }

  function ensureExportMediaImage(button, name) {
    let image = button.querySelector("[data-exercise-gif-img]");

    if (image) {
      return image;
    }

    image = _windowObject.document.createElement("img");
    image.alt = `${name} GIF`;
    image.setAttribute("loading", "lazy");
    image.setAttribute("data-exercise-gif-img", "");
    button.append(image);
    return image;
  }

  function markExportMediaMissing(card) {
    card.classList.add("is-missing");
    const image = card.querySelector("[data-exercise-gif-img]");

    if (image) {
      image.removeAttribute("src");
    }
  }

  function getExerciseMediaName(card) {
    return String(
      card.dataset.exerciseName ||
        card.querySelector("[data-exercise-gif-open]")?.dataset.exerciseName ||
        card.querySelector(".exercise-media__placeholder strong")?.textContent ||
        card.closest(".member-program-exercise-card")?.querySelector(".member-program-exercise-card__top strong")?.textContent ||
        "Hareket",
    ).trim();
  }

  function getExerciseMediaGroup(card) {
    return String(
      card.dataset.exerciseGroup ||
        card.querySelector("[data-exercise-gif-open]")?.dataset.exerciseGroup ||
        card.querySelector(".exercise-media__placeholder span")?.textContent ||
        card.closest(".member-program-exercise-card")?.querySelector(".member-program-exercise-card__top small")?.textContent ||
        "Kas grubu",
    ).trim();
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new _windowObject.FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function buildLiveProgramCss() {
    return `
        :root { color-scheme: light; --navy: #082b35; --teal: #1d6b74; --gold: #d8ad63; --paper: #f6f1e8; --ink: #162b34; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: var(--ink); background: linear-gradient(135deg, #f8fbfb, var(--paper)); }
        .live-program-shell { width: min(1120px, calc(100% - 28px)); margin: 22px auto; }
        .live-program-header, .program-cover, .result-card, .member-program-day { background: rgba(255,255,255,.94); border: 1px solid rgba(8,43,53,.12); border-radius: 22px; box-shadow: 0 18px 45px rgba(8,43,53,.1); }
        .live-program-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 22px; color: white; background: linear-gradient(135deg, var(--navy), var(--teal)); }
        .live-program-header h1 { margin: 4px 0 0; font-size: clamp(1.45rem, 3vw, 2.35rem); }
        .live-program-header span, .live-program-header strong { color: rgba(255,255,255,.78); }
        .section-kicker, .output-detail-panel, .panel-actions, .program-delivery-panel, .program-mail-history, .program-delivery-status { display: none !important; }
        .results__header { margin: 18px 0; }
        .program-cover, .result-card, .member-program-day { padding: 18px; margin: 16px 0; }
        .results__grid { display: grid; gap: 16px; }
        .metric-grid, .training-report-grid, .training-report-block, .member-program-exercise-cards { display: grid; gap: 10px; }
        .metric-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
        .metric-item, .training-report-card, .training-progression-card, .training-expected-card, .member-program-exercise-card, .member-program-day__coach-notes div, .member-program-support p { padding: 12px; border-radius: 16px; background: #f7faf9; border: 1px solid rgba(8,43,53,.08); }
        .member-program-day__header, .member-program-exercise-card__top, .member-program-day__coach-notes, .member-program-exercise-card__metrics { display: grid; gap: 10px; }
        .member-program-day__header { grid-template-columns: 1fr auto; align-items: center; }
        .member-program-day__coach-notes, .member-program-exercise-cards { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .member-program-exercise-card__top { grid-template-columns: auto auto 1fr; align-items: center; }
        .member-program-exercise-card__index { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 10px; background: var(--teal); color: white; font-weight: 800; }
        .member-program-exercise-card__metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .member-program-exercise-card__metrics span { padding: 8px; border-radius: 11px; background: white; }
        .member-program-exercise-card__metrics b { display: block; color: var(--teal); }
        .rep-pattern-metric { background: linear-gradient(135deg, rgba(29,107,116,.12), rgba(216,173,99,.13)), #fff !important; border: 1px solid rgba(29,107,116,.16); }
        .rep-pattern-metric em { display: block; margin-top: 3px; color: var(--ink); font-style: normal; font-weight: 900; letter-spacing: .02em; }
        .exercise-media { position: relative; overflow: hidden; width: 66px; min-width: 66px; height: 66px; border-radius: 17px; background: linear-gradient(135deg, rgba(216,173,99,.18), rgba(29,107,116,.12)); }
        .exercise-media__button, .exercise-media__button img { display: block; width: 100%; height: 100%; border: 0; padding: 0; object-fit: cover; cursor: zoom-in; }
        .exercise-media__placeholder { position: absolute; inset: 0; display: grid; place-items: center; padding: 7px; font-size: .7rem; color: var(--teal); text-align: center; }
        .exercise-media.is-missing .exercise-media__button, .exercise-media.is-missing img { display: none; }
        .exercise-media--wide { width: 100%; height: 160px; }
        .gif-lightbox { position: fixed; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(8,43,53,.76); z-index: 10; }
        .gif-lightbox[hidden] { display: none; }
        .gif-lightbox img { max-width: min(760px, 92vw); max-height: 78vh; border-radius: 24px; background: white; }
        .gif-lightbox button { position: fixed; top: 18px; right: 18px; width: 42px; height: 42px; border: 0; border-radius: 999px; font-size: 1.5rem; }
        @media (max-width: 760px) { .live-program-header, .member-program-day__header { grid-template-columns: 1fr; } .member-program-exercise-card__metrics { grid-template-columns: repeat(2, 1fr); } }
        @media print { @page { size: A4; margin: 10mm; } body { background: white; font-family: "DejaVu Sans", "Noto Sans", "Segoe UI", Arial, sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .live-program-shell { width: 100%; margin: 0; } .exercise-media { width: 48px; min-width: 48px; height: 48px; min-height: 48px; border-radius: 13px; } .exercise-media__button img { object-fit: cover; } .live-program-header, .program-cover, .result-card, .member-program-day, .member-program-exercise-card { box-shadow: none; break-inside: avoid; } }
      `;
  }

  function slugifyExerciseFilePart(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "");
  }

  function uniqueStrings(values) {
    return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  // ═══════════════════════════════════════════════════════════════════
  // SHARED — PDF payload (mail flow da kullanir) — birebir output-handlers.js:654-748
  // ═══════════════════════════════════════════════════════════════════

  function buildProgramPdfPayload(program, profile, activeMember) {
    const memberName = profile.memberName || activeMember?.profile?.memberName || "Üye";

    return {
      memberName,
      programText: _convertProgramToText(program),
      programData: buildMailProgramData(program, profile, activeMember),
    };
  }

  function getMailExerciseGroupLabel(exercise) {
    const labels = {
      chest: "Göğüs",
      back: "Sırt",
      quadriceps: "Ön Bacak",
      hamstrings: "Arka Bacak",
      glutes: "Kalça",
      shoulders: "Omuz",
      triceps: "Triceps",
      biceps: "Biceps",
      calves: "Baldır",
      core: "Core",
      cardio: "Kardiyo",
      crossfit: "CrossFit",
      pilates: "Pilates",
      mobility: "Mobilite",
    };
    const rawGroup = String(exercise?.group || "").trim();
    const existingLabel = String(exercise?.groupLabel || exercise?.muscleGroup || "").trim();
    return labels[rawGroup] || labels[existingLabel] || existingLabel || rawGroup || "Kas grubu";
  }

  function buildMailProgramData(program, profile, activeMember) {
    const goalLabel = _labelMaps?.goal?.[profile.goal] || profile.goal || activeMember?.profile?.goal || "Kişisel hedef";
    const levelLabel = _labelMaps?.level?.[profile.level] || profile.level || activeMember?.profile?.level || "Seviye belirtilmedi";
    const days = Array.isArray(profile.days) && profile.days.length ? profile.days : activeMember?.profile?.days || [];

    return {
      title: program?.title || "Bahçeşehir Spor Merkezi Antrenman Programı",
      memberName: profile.memberName || activeMember?.profile?.memberName || "Üye",
      goal: goalLabel,
      level: levelLabel,
      daysText: Array.isArray(days) && days.length ? days.map((day) => _getDayLabel?.(day) || day).join(", ") : "Haftalık plana göre",
      sessions: (program?.sessions || []).map((session, sessionIndex) => ({
        dayLabel: session.dayLabel || `Gün ${sessionIndex + 1}`,
        title: session.title || "Antrenman",
        duration: session.duration || "",
        warmup: Array.isArray(session.warmup) ? session.warmup.join(" • ") : session.warmup || "",
        cardioBlock: session.cardioBlock || "",
        cooldown: Array.isArray(session.cooldown) ? session.cooldown.join(" • ") : session.cooldown || "",
        exercises: (session.exercises || []).map((exercise) => {
          const prescription = splitMailExercisePrescription(exercise);

          return {
            name: exercise.name || "Hareket",
            group: exercise.group || "",
            groupLabel: getMailExerciseGroupLabel(exercise),
            sets: exercise.sets || prescription.sets || "-",
            reps: exercise.reps || prescription.reps || "-",
            repModel: exercise.repModel || exercise.repScheme?.model || "fixed",
            repPattern: Array.isArray(exercise.repPattern)
              ? exercise.repPattern
              : Array.isArray(exercise.repScheme?.reps)
                ? exercise.repScheme.reps
                : String(exercise.reps || prescription.reps || "-").split(/[•,]/).map((item) => item.trim()).filter(Boolean),
            rest: exercise.rest || "-",
            tempo: exercise.tempo || "-",
            cue: limitMailSentence(exercise.cue || exercise.note || "Kontrollü formda uygula."),
          };
        }),
      })),
    };
  }

  function splitMailExercisePrescription(exercise) {
    const text = String(exercise?.prescription || "").trim();
    const match = text.match(/^(.+?)\s*(?:set|tur)\s*x\s*(.+)$/i);

    if (match) {
      return {
        sets: match[1].trim(),
        reps: match[2].trim(),
      };
    }

    return {
      sets: exercise?.sets || "-",
      reps: exercise?.reps || text || "-",
    };
  }

  function limitMailSentence(value) {
    const firstSentence = String(value || "").split(/(?<=[.!?])\s+/)[0] || "";
    return firstSentence.length > 140 ? `${firstSentence.slice(0, 137).trim()}...` : firstSentence;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SHARED — status + slug (mail flow da kullanir) — birebir
  // ═══════════════════════════════════════════════════════════════════

  function setProgramDeliveryStatus(message, stateName = "") {
    const programDeliveryStatus = _domRefs.programDeliveryStatus;
    if (programDeliveryStatus) {
      programDeliveryStatus.textContent = message || "";
      if (stateName) {
        programDeliveryStatus.dataset.state = stateName;
      } else {
        delete programDeliveryStatus.dataset.state;
      }
    }

    if (message) {
      _showStatus(message, stateName === "error" ? "error" : "success");
    }
  }

  function slugifyFilePart(value) {
    return String(value || "dosya")
      .toLocaleLowerCase("tr-TR")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "dosya";
  }

  // ═══════════════════════════════════════════════════════════════════
  // BIND (idempotent guard'li) — output action button'lari
  // ═══════════════════════════════════════════════════════════════════

  function bindOutputActionHandlers(buttons) {
    if (!buttons) buttons = {};
    const anchor = buttons.programPdfActionButton || buttons.copyPlanButton;
    if (anchor && anchor.dataset.bsmOutputActionsBound === "true") {
      return;
    }

    bindIf(buttons.copyPlanButton, "click", copyPlanText);
    bindIf(buttons.printPlanButton, "click", handlePrintPlan);
    bindIf(buttons.programPdfActionButton, "click", handleDownloadProgramPdf);
    bindIf(buttons.downloadLiveProgramButton, "click", handleDownloadLiveProgram);

    if (anchor) anchor.dataset.bsmOutputActionsBound = "true";
  }

  function bindIf(target, eventName, handler) {
    if (!target || !handler) {
      return;
    }
    target.addEventListener(eventName, handler);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  window.BSMOutputActions = {
    init: init,
    handleDownloadProgramPdf: handleDownloadProgramPdf,
    handleDownloadProgramHtml: handleDownloadLiveProgram,
    handlePrintPlan: handlePrintPlan,
    copyProgramAsText: copyPlanText,
    buildLiveProgramHtml: buildLiveProgramHtml,
    bindOutputActionHandlers: bindOutputActionHandlers,
    // EXTRA — mail flow (handlers/output-handlers.js) cross-module reference icin:
    buildProgramPdfPayload: buildProgramPdfPayload,
    setProgramDeliveryStatus: setProgramDeliveryStatus,
    slugifyFilePart: slugifyFilePart,
  };
})();
