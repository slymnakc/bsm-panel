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

    // Refactor Adim 4A.2.2: copyPlanText, handlePrintPlan, handleDownloadProgramPdf,
    // handleDownloadLiveProgram + export pipeline (buildLiveProgramHtml + helpers) +
    // buildProgramPdfPayload + setProgramDeliveryStatus + slugifyFilePart →
    // output/outputActions.js (ownership transfer).
    //
    // handleSendProgramMail (mail, 4A.2.3'e birakildi) asagidaki CROSS-MODULE WRAPPER'lar
    // uzerinden tasinan shared fn'lere erisir. handleSendProgramMail govdesi DEGISMEDI.
    function buildLiveProgramHtml(program, options) {
      return window.BSMOutputActions.buildLiveProgramHtml(program, options);
    }

    function buildProgramPdfPayload(program, profile, activeMember) {
      return window.BSMOutputActions.buildProgramPdfPayload(program, profile, activeMember);
    }

    function setProgramDeliveryStatus(message, stateName) {
      return window.BSMOutputActions.setProgramDeliveryStatus(message, stateName);
    }

    function slugifyFilePart(value) {
      return window.BSMOutputActions.slugifyFilePart(value);
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
        const pdfPayload = buildProgramPdfPayload(program, profile, activeMember);
        const payload = {
          to: recipientEmail,
          memberName: pdfPayload.memberName,
          trainerName: profile.trainerName || activeMember?.profile?.trainerName || "",
          subject: "Bahçeşehir Spor Merkezi | Size Özel Antrenman Programınız",
          message: buildMailMessage(pdfPayload.memberName),
          programText: pdfPayload.programText,
          programData: pdfPayload.programData,
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

    function buildMailMessage(memberName) {
      return `Merhaba ${memberName || "Üye"},

Size özel hazırlanan antrenman programınız ekte yer almaktadır.

Programınızı düzenli uygulamanız önerilir. Herhangi bir sorunuzda antrenörlerimizden destek alabilirsiniz.

Sağlıklı günler dileriz.
Bahçeşehir Spor Merkezi`;
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

    // Refactor Adim 4A.2.2: copyPlanText/handlePrintPlan/handleDownloadProgramPdf/
    // handleDownloadLiveProgram → output/outputActions.js. Bunlarin bind'i app.js'de
    // window.BSMOutputActions.bindOutputActionHandlers ile yapilir. Burada SADECE
    // mail + backup/CSV handler'lari return edilir.
    return {
      handleSendProgramMail,
      handleDownloadBackup,
      handleOpenRestorePicker,
      handleBackupFileSelected,
      handleRestoreAutoBackup,
      handleExportMembersCsv,
    };
  }

  function bindOutputHandlers(elements, handlers) {
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
