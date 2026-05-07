(function () {
  "use strict";

  function createOutputHandlers(deps) {
    const {
      state,
      schemaVersion,
      form,
      backupFileInput,
      resultsSection,
      collectFormData,
      getCurrentProgramFromEditor,
      validateEditableProgram,
      loadLastPlan,
      showStatus,
      convertProgramToText,
      downloadFile,
      formatFileDate,
      extractMembersFromBackup,
      normalizeImportedMembers,
      saveActiveMemberId,
      persistMembers,
      findActiveMember,
      populateForm,
      renderProgram,
      cloneData,
      handleLiveUpdate,
      renderMemberWorkspace,
      loadBackupHistory,
      formatDashboardDate,
      buildCsvContent,
      labelMaps,
      getTrainingSystemLabel,
      getDayLabel,
      programDeliveryStatus,
      programMailHistory,
      windowObject = window,
      navigatorObject = navigator,
    } = deps;
    const PROGRAM_MAIL_HISTORY_KEY = "bsm-program-mail-history-v1";
    const PROGRAM_EMAIL_API_PATH = "/api/send-program-email";

    renderProgramMailHistory();

    async function copyPlanText() {
      const savedPlan = getCurrentProgramFromEditor() || loadLastPlan();

      if (!savedPlan?.schemaVersion) {
        showStatus("Kopyalanacak bir üye programı yok. Önce program oluşturun.", "error");
        return;
      }

      try {
        if (!navigatorObject.clipboard?.writeText) {
          throw new Error("Clipboard API unavailable");
        }

        await navigatorObject.clipboard.writeText(convertProgramToText(savedPlan));
        showStatus("Üye programı panoya kopyalandı.", "success");
      } catch (error) {
        showStatus("Tarayıcı panoya kopyalama izni vermedi. Yazdır / PDF seçeneğini kullanabilirsiniz.", "error");
      }
    }

    function handlePrintPlan() {
      if (state.programEditMode) {
        const currentProgram = getCurrentProgramFromEditor();
        const validationMessage = validateEditableProgram?.(currentProgram) || "";

        if (validationMessage) {
          showStatus(validationMessage, "error");
          return;
        }

        state.programEditMode = false;
        renderProgram(currentProgram, { preserveEditState: true });
        windowObject.setTimeout(() => windowObject.print(), 50);
        return;
      }

      windowObject.print();
    }

    async function handleDownloadLiveProgram() {
      const program = getCurrentProgramFromEditor() || loadLastPlan();

      if (!program?.schemaVersion) {
        setProgramDeliveryStatus("Canlı program indirilebilmesi için önce program oluşturun.", "error");
        return;
      }

      try {
        setProgramDeliveryStatus("Canlı program dosyası hazırlanıyor...", "loading");
        const html = await buildLiveProgramHtml(program, { inlineImages: true });
        const profile = collectFormData();
        const filename = `bahcesehir-canli-program-${slugifyFilePart(profile.memberName || "uye")}-${formatFileDate(new Date())}.html`;
        downloadFile(filename, html, "text/html;charset=utf-8");
        setProgramDeliveryStatus("Canlı program HTML dosyası indirildi.", "success");
      } catch (error) {
        console.error("Live program export error", error);
        setProgramDeliveryStatus("Canlı program indirilemedi. Lütfen tekrar deneyin.", "error");
      }
    }

    async function handleSendProgramMail() {
      const program = getCurrentProgramFromEditor() || loadLastPlan();

      if (!program?.schemaVersion) {
        setProgramDeliveryStatus("Mail gönderimi için önce program oluşturun.", "error");
        return;
      }

      if (windowObject.location?.protocol === "file:") {
        setProgramDeliveryStatus("Mail gönderimi için paneli http://localhost:3000 veya canlı Render adresi üzerinden açmalısınız.", "error");
        return;
      }

      const profile = collectFormData();
      const activeMember = findActiveMember();
      const recipientEmail = String(profile.memberEmail || activeMember?.profile?.memberEmail || "").trim();

      if (!isValidEmail(recipientEmail)) {
        setProgramDeliveryStatus("Mail göndermek için üye bilgilerine geçerli bir e-posta adresi girin.", "error");
        return;
      }

      try {
        setProgramDeliveryStatus("Gönderiliyor...", "loading");
        const liveHtml = await buildLiveProgramHtml(program, { inlineImages: false });
        const payload = {
          to: recipientEmail,
          memberName: profile.memberName || activeMember?.profile?.memberName || "Üye",
          trainerName: profile.trainerName || activeMember?.profile?.trainerName || "",
          subject: "Bahçeşehir Spor Merkezi | Size Özel Antrenman Programınız",
          message: buildMailMessage(profile.memberName || activeMember?.profile?.memberName || "Üye"),
          programText: convertProgramToText(program),
          programData: buildMailProgramData(program, profile, activeMember),
          htmlAttachment: {
            filename: `canli-antrenman-programi-${slugifyFilePart(profile.memberName || "uye")}.html`,
            contentBase64: toBase64Unicode(liveHtml),
          },
        };
        const response = await sendProgramMailRequest(payload);

        if (!response.ok) {
          throw new Error(response.message || "Mail gönderilemedi.");
        }

        const record = {
          id: `mail-${Date.now()}`,
          memberId: activeMember?.id || "",
          memberName: payload.memberName,
          email: recipientEmail,
          status: "Başarılı",
          sentAtIso: new Date().toISOString(),
          sentAt: new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
        };
        appendProgramMailHistory(record);
        setProgramDeliveryStatus("Başarılı: Program maili üyeye gönderildi.", "success");
      } catch (error) {
        const record = {
          id: `mail-${Date.now()}`,
          memberId: activeMember?.id || "",
          memberName: profile.memberName || activeMember?.profile?.memberName || "Üye",
          email: recipientEmail,
          status: "Hata",
          error: error.message || "Mail gönderilemedi.",
          sentAtIso: new Date().toISOString(),
          sentAt: new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
        };
        appendProgramMailHistory(record);
        setProgramDeliveryStatus(`Hata: ${record.error}`, "error");
      }
    }

    async function sendProgramMailRequest(payload) {
      const endpoints = getProgramMailEndpoints();
      const networkErrors = [];

      for (const endpoint of endpoints) {
        try {
          const response = await windowObject.fetch(endpoint.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => null);

          if (!result || typeof result !== "object") {
            return {
              ok: false,
              message: `${endpoint.label} geçerli mail API yanıtı vermedi. Render servisinin Node olarak deploy edildiğini kontrol edin.`,
            };
          }

          return {
            ok: response.ok && result.ok === true,
            message: result.message || result.error || "",
            pdfCreated: result.pdfCreated !== false,
          };
        } catch (error) {
          networkErrors.push(`${endpoint.label}: ${error.message || "bağlantı kurulamadı"}`);
          console.warn("Program mail API erişim hatası", endpoint.url, error);
        }
      }

      return {
        ok: false,
        message: `Mail API'sine ulaşılamadı. Yerelde kullanıyorsanız proje klasöründe "npm start" ile backend'i çalıştırın veya paneli canlı Render adresinden açın. Detay: ${networkErrors.join(" | ")}`,
      };
    }

    function getProgramMailEndpoints() {
      return [{ url: PROGRAM_EMAIL_API_PATH, label: "Mail servisi" }];
    }

    async function buildLiveProgramHtml(program, options = {}) {
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
        const replacement = windowObject.document.createElement("span");
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

          const absoluteUrl = new URL(candidate, windowObject.location.href).href;
          const response = await windowObject.fetch(absoluteUrl);

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
          const absoluteUrl = new URL(image.getAttribute("src"), windowObject.location.href).href;
          const response = await windowObject.fetch(absoluteUrl);

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

      button = windowObject.document.createElement("button");
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

      image = windowObject.document.createElement("img");
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

    async function inlineImagesInClone(clone) {
      const images = [...clone.querySelectorAll("img")].filter((image) => image.getAttribute("src"));

      for (const image of images) {
        try {
          const absoluteUrl = new URL(image.getAttribute("src"), windowObject.location.href).href;
          const response = await windowObject.fetch(absoluteUrl);

          if (!response.ok) {
            continue;
          }

          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          image.setAttribute("src", dataUrl);
        } catch (error) {
          // GIF yolu yerelde okunamazsa mevcut yol korunur; canlı panelde yine çalışır.
        }
      }
    }

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new windowObject.FileReader();
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

    function buildMailMessage(memberName) {
      return `Merhaba ${memberName || "Üye"},

Size özel hazırlanan antrenman programınız ekte yer almaktadır.

Programınızı düzenli uygulamanız önerilir. Herhangi bir sorunuzda antrenörlerimizden destek alabilirsiniz.

Sağlıklı günler dileriz.
Bahçeşehir Spor Merkezi`;
    }

    function buildMailProgramData(program, profile, activeMember) {
      const goalLabel = labelMaps?.goal?.[profile.goal] || profile.goal || activeMember?.profile?.goal || "Kişisel hedef";
      const levelLabel = labelMaps?.level?.[profile.level] || profile.level || activeMember?.profile?.level || "Seviye belirtilmedi";
      const days = Array.isArray(profile.days) && profile.days.length ? profile.days : activeMember?.profile?.days || [];

      return {
        title: program?.title || "Bahçeşehir Spor Merkezi Antrenman Programı",
        memberName: profile.memberName || activeMember?.profile?.memberName || "Üye",
        goal: goalLabel,
        level: levelLabel,
        daysText: Array.isArray(days) && days.length ? days.map((day) => getDayLabel?.(day) || day).join(", ") : "Haftalık plana göre",
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
              groupLabel: exercise.groupLabel || exercise.muscleGroup || exercise.group || "Kas grubu",
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

    function appendProgramMailHistory(record) {
      const history = [record, ...loadProgramMailHistory()].slice(0, 20);
      saveProgramMailHistory(history);

      const activeMember = findActiveMember();
      if (activeMember) {
        activeMember.mailHistory = [record, ...(activeMember.mailHistory || [])].slice(0, 20);
        activeMember.updatedAt = new Date().toISOString();
        persistMembers();
      }

      renderProgramMailHistory();
    }

    function renderProgramMailHistory() {
      if (!programMailHistory) {
        return;
      }

      const activeMember = findActiveMember();
      const allRecords = loadProgramMailHistory();
      const records = allRecords.filter((record) => !activeMember || !record.memberId || record.memberId === activeMember.id).slice(0, 4);

      if (!records.length) {
        programMailHistory.innerHTML = `<span>Gönderim geçmişi henüz yok.</span>`;
        return;
      }

      programMailHistory.innerHTML = `
        <strong>Mail gönderim geçmişi</strong>
        ${records
          .map(
            (record) => `
              <div class="program-mail-history__item" data-state="${escapeAttribute(record.status === "Başarılı" ? "success" : "error")}">
                <span>${escapeHtml(record.status)}</span>
                <p>${escapeHtml(record.memberName || "Üye")} • ${escapeHtml(record.email || "")}</p>
                <small>${escapeHtml(record.sentAt || "")}${record.error ? ` • ${escapeHtml(record.error)}` : ""}</small>
              </div>
            `,
          )
          .join("")}
      `;
    }

    function loadProgramMailHistory() {
      try {
        const parsed = JSON.parse(windowObject.localStorage?.getItem(PROGRAM_MAIL_HISTORY_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }

    function saveProgramMailHistory(history) {
      try {
        windowObject.localStorage?.setItem(PROGRAM_MAIL_HISTORY_KEY, JSON.stringify(history));
      } catch (error) {
        // Gönderim geçmişi yazılamasa bile mail akışı devam eder.
      }
    }

    function setProgramDeliveryStatus(message, stateName = "") {
      if (programDeliveryStatus) {
        programDeliveryStatus.textContent = message || "";
        if (stateName) {
          programDeliveryStatus.dataset.state = stateName;
        } else {
          delete programDeliveryStatus.dataset.state;
        }
      }

      if (message) {
        showStatus(message, stateName === "error" ? "error" : "success");
      }
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    }

    function toBase64Unicode(value) {
      const bytes = new TextEncoder().encode(String(value || ""));
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return windowObject.btoa(binary);
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
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "");
    }

    function uniqueStrings(values) {
      return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function escapeAttribute(value) {
      return escapeHtml(value).replace(/`/g, "&#096;");
    }

    function handleDownloadBackup() {
      if (!state.members.length) {
        showStatus("Yedek indirilebilmesi için önce en az bir üye kaydı olmalı.", "error");
        return;
      }

      const backupPayload = {
        schemaVersion,
        exportedAt: new Date().toISOString(),
        gymName: form.querySelector("#gymName")?.value?.trim() || "Bahçeşehir Spor Merkezi",
        activeMemberId: state.activeMemberId,
        members: state.members,
        lastForm: collectFormData(),
        lastPlan: getCurrentProgramFromEditor() || loadLastPlan(),
      };
      const filename = `bahcesehir-spor-merkezi-yedek-${formatFileDate(new Date())}.json`;

      downloadFile(filename, `${JSON.stringify(backupPayload, null, 2)}\n`, "application/json;charset=utf-8");
      showStatus("Yedek dosyası indirildi.", "success");
    }

    function handleOpenRestorePicker() {
      backupFileInput?.click();
    }

    async function handleBackupFileSelected(event) {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      try {
        const rawText = await file.text();
        const payload = JSON.parse(rawText);
        const extractedMembers = extractMembersFromBackup(payload);
        const normalizedMembers = normalizeImportedMembers(extractedMembers);

        if (!windowObject.confirm(`Yedek yüklendiğinde mevcut kayıtlar bu dosyayla değişecek. Devam edilsin mi? (${normalizedMembers.length} üye)`)) {
          return;
        }

        state.members = normalizedMembers;
        const importedActiveMemberId = String(payload?.activeMemberId || "");
        state.activeMemberId = state.members.some((member) => member.id === importedActiveMemberId) ? importedActiveMemberId : state.members[0]?.id || null;
        saveActiveMemberId(state.activeMemberId);
        persistMembers();

        const activeMember = findActiveMember();
        if (activeMember) {
          populateForm(activeMember.profile || {});
          if (activeMember.programs?.[0]?.program) {
            renderProgram(cloneData(activeMember.programs[0].program));
          } else {
            resultsSection.classList.add("hidden");
            state.activeProgram = null;
          }
        } else {
          resetFormToDefaults(form);
          resultsSection.classList.add("hidden");
          state.activeProgram = null;
        }

        handleLiveUpdate();
        renderMemberWorkspace();
        showStatus(`Yedek dosyası başarıyla yüklendi (${normalizedMembers.length} üye).`, "success");
      } catch (error) {
        showStatus("Yedek yüklenemedi. Dosya biçimi geçerli bir JSON yedeği olmalı.", "error");
      } finally {
        if (backupFileInput) {
          backupFileInput.value = "";
        }
      }
    }

    function handleRestoreAutoBackup() {
      const history = loadBackupHistory();

      if (!history.length) {
        showStatus("Geri alınacak otomatik yedek bulunamadı.", "error");
        return;
      }

      const latestSnapshot = history[0];
      const snapshotMembers = normalizeImportedMembers(latestSnapshot.members || []);
      const snapshotMemberCount = snapshotMembers.length;
      const snapshotDate = formatDashboardDate(latestSnapshot.savedAt);

      if (!windowObject.confirm(`Son otomatik yedek geri alınacak (${snapshotDate} - ${snapshotMemberCount} üye). Devam edilsin mi?`)) {
        return;
      }

      state.members = snapshotMembers;
      state.activeMemberId = state.members.some((member) => member.id === latestSnapshot.activeMemberId) ? latestSnapshot.activeMemberId : state.members[0]?.id || null;
      saveActiveMemberId(state.activeMemberId);
      persistMembers();

      const activeMember = findActiveMember();
      if (activeMember) {
        populateForm(activeMember.profile || {});
        if (activeMember.programs?.[0]?.program) {
          renderProgram(cloneData(activeMember.programs[0].program));
        } else {
          resultsSection.classList.add("hidden");
          state.activeProgram = null;
        }
      } else {
        resultsSection.classList.add("hidden");
        state.activeProgram = null;
      }
      handleLiveUpdate();
      renderMemberWorkspace();
      showStatus("Otomatik yedek geri alındı.", "success");
    }

    function handleExportMembersCsv(memberSubset = null) {
      const membersToExport = Array.isArray(memberSubset) ? memberSubset : state.members;

      if (!membersToExport.length) {
        showStatus("CSV dışa aktarma için üye kaydı bulunamadı.", "error");
        return;
      }

      const header = [
        "Üye Adı",
        "Üye No",
        "Antrenör",
        "Hedef",
        "Seviye",
        "Antrenman Sistemi",
        "Haftalık Günler",
        "Program Sayısı",
        "Ölçüm Sayısı",
        "Son Ölçüm Tarihi",
        "Son Kilo (kg)",
        "Son Yağ (%)",
        "Son Kas (kg)",
        "Son Program Tarihi",
        "Not",
      ];
      const rows = membersToExport.map((member) => {
        const profile = member.profile || {};
        const latestMeasurement = member.measurements?.[0] || {};
        const latestProgram = member.programs?.[0] || {};

        return [
          profile.memberName || "",
          profile.memberCode || "",
          profile.trainerName || "",
          labelMaps.goal[profile.goal] || "",
          labelMaps.level[profile.level] || "",
          getTrainingSystemLabel(profile.trainingSystem || "standard"),
          (profile.days || []).map((day) => getDayLabel(day)).join(", "),
          member.programs?.length || 0,
          member.measurements?.length || 0,
          latestMeasurement.date || "",
          latestMeasurement.weight ?? "",
          latestMeasurement.fat ?? "",
          latestMeasurement.muscleMass ?? "",
          latestProgram.savedAt || "",
          profile.notes || "",
        ];
      });
      const csvContent = buildCsvContent([header, ...rows]);
      const fileLabel = membersToExport.length === 1 ? "uye" : "tum-uyeler";
      const filename = `bahçeşehir-${fileLabel}-${formatFileDate(new Date())}.csv`;

      downloadFile(filename, csvContent, "text/csv;charset=utf-8");
      showStatus(`CSV dışa aktarma tamamlandı (${membersToExport.length} üye).`, "success");
    }

    return {
      copyPlanText,
      handlePrintPlan,
      handleDownloadLiveProgram,
      handleSendProgramMail,
      handleDownloadBackup,
      handleOpenRestorePicker,
      handleBackupFileSelected,
      handleRestoreAutoBackup,
      handleExportMembersCsv,
    };
  }

  function bindOutputHandlers(elements, handlers) {
    bindIf(elements.copyPlanButton, "click", handlers.copyPlanText);
    bindIf(elements.printPlanButton, "click", handlers.handlePrintPlan);
    bindIf(elements.programPdfActionButton, "click", handlers.handlePrintPlan);
    bindIf(elements.downloadLiveProgramButton, "click", handlers.handleDownloadLiveProgram);
    bindIf(elements.sendProgramMailButton, "click", handlers.handleSendProgramMail);
    bindIf(elements.downloadBackupButton, "click", handlers.handleDownloadBackup);
    bindIf(elements.restoreBackupButton, "click", handlers.handleOpenRestorePicker);
    bindIf(elements.exportMembersCsvButton, "click", handlers.handleExportMembersCsv);
    bindIf(elements.restoreAutoBackupButton, "click", handlers.handleRestoreAutoBackup);
    bindIf(elements.backupFileInput, "change", handlers.handleBackupFileSelected);
  }

  function bindIf(target, eventName, handler) {
    if (!target || !handler) {
      return;
    }

    target.addEventListener(eventName, handler);
  }

  function resetFormToDefaults(form) {
    if (!form) {
      return;
    }

    form.reset();
    form.querySelector("#gymName").value = "Bahçeşehir Spor Merkezi";
    form.querySelector("#programStyle").value = "auto";
    form.querySelector("#trainingSystem").value = "standard";
    form.querySelector("#equipmentScope").value = "full-gym";
    form.querySelector("#duration").value = "60";
    form.querySelector("#priorityMuscle").value = "balanced";
    const cardioInput = form.querySelector('input[name="cardioPreference"][value="balanced"]');
    if (cardioInput) {
      cardioInput.checked = true;
    }
  }

  window.BSMOutputHandlers = {
    createOutputHandlers,
    bindOutputHandlers,
  };
})();
