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
      windowObject = window,
      navigatorObject = navigator,
    } = deps;

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
