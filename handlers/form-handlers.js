(function () {
  "use strict";

  function createFormHandlers(deps) {
    const {
      state,
      form,
      examplePreset,
      measurementDate,
      resultsSection,
      populateForm,
      collectFormData,
      validateFormData,
      buildProgram,
      saveLastForm,
      saveLastPlan,
      updateActiveMemberProfile,
      renderProgram,
      setActiveScreen,
      showStatus,
      loadLastForm,
      renderLiveSummary,
      upsertMemberFromCurrentForm,
      saveActiveMemberId,
      getTodayInputValue,
      clearMeasurementInputs,
      renderMemberWorkspace,
      getCurrentProgramFromEditor,
      makeId,
      cloneData,
      persistMembers,
      setWorkspaceView,
      readMeasurementForm,
      validateMeasurementData,
      normalizeMeasurementPayload,
      tanitaCsvInput,
      tanitaImportStatus,
      saveTanitaMeasurementButton,
      readTanitaCsvFile,
      parseTanitaCsv,
      selectBestTanitaRecord,
      buildTanitaMeasurement,
      buildTanitaPreviewModel,
      renderTanitaPreview,
      saveMeasurementToSupabase,
      exerciseLibrary,
      buildPrescription,
      buildRest,
      buildTempo,
      buildExerciseBlocks,
      buildMuscleCoverage,
      windowObject = window,
    } = deps;

    function handleSubmit(event) {
      event.preventDefault();

      const formData = collectFormData();
      const validationMessage = validateFormData(formData);

      if (validationMessage) {
        showStatus(validationMessage, "error");
        return;
      }

      const program = buildProgram(formData);
      saveLastForm(formData);
      saveLastPlan(program);
      updateActiveMemberProfile(formData);
      renderProgram(program);
      setActiveScreen("output", { userTriggered: true, silent: true });
      showStatus("Üye programı oluşturuldu. Aşağıdan görüntüleyebilir, kopyalayabilir veya yazdırabilirsiniz.", "success");
      resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function handleLiveUpdate() {
      const formData = collectFormData();
      renderLiveSummary(formData);
    }

    function handleFillExample() {
      populateForm(examplePreset);
      handleLiveUpdate();
      showStatus("Örnek üye bilgileri forma işlendi. İsterseniz düzenleyip program oluşturabilirsiniz.", "success");
    }

    function loadSavedForm() {
      const savedForm = loadLastForm();

      if (!savedForm) {
        showStatus("Henüz kaydedilmiş bir üye formu bulunamadı.", "error");
        return;
      }

      populateForm(savedForm);
      handleLiveUpdate();
      showStatus("Son kaydedilen üye bilgileri yüklendi.", "success");
    }

    function handleSaveMember() {
      const member = upsertMemberFromCurrentForm();

      if (!member) {
        return;
      }

      showStatus(`${member.profile.memberName || "Üye"} dosyası kaydedildi.`, "success");
    }

    function handleNewMember() {
      state.activeMemberId = null;
      state.activeProgram = null;
      saveActiveMemberId(null);
      form.reset();
      form.querySelector("#gymName").value = "Bahçeşehir Spor Merkezi";
      form.querySelector("#programStyle").value = "auto";
      form.querySelector("#trainingSystem").value = "standard";
      form.querySelector("#equipmentScope").value = "full-gym";
      form.querySelector("#duration").value = "60";
      form.querySelector("#priorityMuscle").value = "balanced";
      form.querySelector('input[name="cardioPreference"][value="balanced"]').checked = true;
      measurementDate.value = getTodayInputValue();
      clearMeasurementInputs();
      resultsSection.classList.add("hidden");
      setActiveScreen("builder", { silent: true });
      handleLiveUpdate();
      renderMemberWorkspace();
      showStatus("Yeni üye için boş form hazırlandı.", "success");
    }

    function handleSaveProgramToMember() {
      const program = getCurrentProgramFromEditor();

      if (!program) {
        showStatus("Kaydedilecek program yok. Önce üye programı oluşturun.", "error");
        return;
      }

      const member = upsertMemberFromCurrentForm({ silent: true });

      if (!member) {
        return;
      }

      const programRecord = {
        id: makeId("program"),
        savedAtIso: new Date().toISOString(),
        savedAt: new Date().toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }),
        program: cloneData(program),
      };

      member.programs = [programRecord, ...(member.programs || [])].slice(0, 25);
      member.updatedAt = new Date().toISOString();
      persistMembers();
      setWorkspaceView("history");
      renderMemberWorkspace();
      showStatus("Düzenlenebilir program üye geçmişine kaydedildi.", "success");
    }

    function handleSaveMeasurement() {
      const member = upsertMemberFromCurrentForm({ silent: true });

      if (!member) {
        return;
      }

      const measurement = readMeasurementForm();

      if (!measurement) {
        showStatus("Ölçüm kaydı için en az bir değer veya not girin.", "error");
        return;
      }

      const measurementValidationMessage = validateMeasurementData(measurement);

      if (measurementValidationMessage) {
        showStatus(measurementValidationMessage, "error");
        return;
      }

      member.measurements = [normalizeMeasurementPayload(measurement), ...(member.measurements || [])].slice(0, 40);
      member.updatedAt = new Date().toISOString();
      persistMembers();
      setWorkspaceView("measurements");
      clearMeasurementInputs();
      renderMemberWorkspace();
      showStatus("Üye ölçümü kaydedildi.", "success");
    }

    function handleOpenTanitaCsvPicker() {
      if (!parseTanitaCsv || !buildTanitaMeasurement) {
        setTanitaImportStatus("Tanita CSV modülü yüklenemedi. Sayfayı yenileyip tekrar deneyin.", "error");
        return;
      }

      const profile = collectFormData();

      if (!state.activeMemberId && !profile.memberName && !profile.memberCode) {
        setTanitaImportStatus("Tanita ölçümü yüklemek için önce üye seçin veya üye adı/üye no girin.", "error");
        return;
      }

      tanitaCsvInput?.click();
    }

    function handleTanitaCsvSelected(event) {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setTanitaImportStatus("CSV okunuyor...", "");
      state.pendingTanitaMeasurement = null;
      setTanitaSaveEnabled(false);
      renderTanitaPreview?.(null);

      (readTanitaCsvFile ? readTanitaCsvFile(file) : file.text())
        .then((csvText) => {
          const result = parseTanitaCsv(csvText);
          const record = selectBestTanitaRecord?.(result.records) || result.records?.[0] || null;

          if (!record) {
            setTanitaImportStatus(result.warnings?.[0] || "CSV içinde ölçüm verisi bulunamadı.", "error");
            return;
          }

          const measurement = buildTanitaMeasurement(record, { makeId, getTodayInputValue });
          state.pendingTanitaMeasurement = measurement;
          renderTanitaPreview?.(buildTanitaPreviewModel?.(measurement));
          setTanitaSaveEnabled(true);

          const warningText = result.warnings?.length ? ` Ek bilgi: ${result.warnings.join(" ")}` : "";
          setTanitaImportStatus(`CSV okundu. Ölçümü üyeye kaydetmeye hazır.${warningText}`, "success");
        })
        .catch((error) => {
          console.error("Tanita CSV read error", error);
          setTanitaImportStatus("CSV dosyası okunamadı. Dosya formatını kontrol edin.", "error");
        });
    }

    function handleSaveTanitaMeasurement() {
      const member = upsertMemberFromCurrentForm({ silent: true });

      if (!member) {
        setTanitaImportStatus("Ölçümü kaydetmek için önce üye adı veya üye no girin.", "error");
        return;
      }

      if (!state.pendingTanitaMeasurement) {
        setTanitaImportStatus("Kaydedilecek Tanita ölçümü yok. Önce CSV yükleyin.", "error");
        return;
      }

      const measurementValidationMessage = validateMeasurementData(state.pendingTanitaMeasurement);

      if (measurementValidationMessage) {
        setTanitaImportStatus(measurementValidationMessage, "error");
        return;
      }

      const normalizedMeasurement = normalizeMeasurementPayload(state.pendingTanitaMeasurement);
      member.measurements = [normalizedMeasurement, ...(member.measurements || [])].slice(0, 40);
      member.updatedAt = new Date().toISOString();
      persistMembers();

      if (typeof saveMeasurementToSupabase === "function") {
        saveMeasurementToSupabase(member, normalizedMeasurement);
      }

      state.pendingTanitaMeasurement = null;
      setTanitaSaveEnabled(false);
      if (tanitaCsvInput) {
        tanitaCsvInput.value = "";
      }
      setWorkspaceView("measurements");
      renderMemberWorkspace();
      showStatus("Tanita ölçümü üye geçmişine kaydedildi.", "success");
      setTanitaImportStatus("Tanita ölçümü kaydedildi. Analiz ve koç uyarıları güncellendi.", "success");
    }

    function setTanitaImportStatus(message, stateName) {
      if (!tanitaImportStatus) {
        return;
      }

      tanitaImportStatus.textContent = message || "";
      if (stateName) {
        tanitaImportStatus.dataset.state = stateName;
      } else {
        delete tanitaImportStatus.dataset.state;
      }
    }

    function setTanitaSaveEnabled(isEnabled) {
      if (saveTanitaMeasurementButton) {
        saveTanitaMeasurementButton.disabled = !isEnabled;
      }
    }

    function handleProgramEdit(event) {
      const field = event.target.dataset.programField;

      if (!field || !state.activeProgram) {
        return;
      }

      const sessionIndex = Number(event.target.dataset.sessionIndex);
      const exerciseIndex = Number(event.target.dataset.exerciseIndex);
      const exercise = state.activeProgram.sessions?.[sessionIndex]?.exercises?.[exerciseIndex];

      if (!exercise) {
        return;
      }

      if (field === "exerciseId") {
        const replacement = exerciseLibrary.find((item) => item.id === event.target.value);

        if (replacement) {
          const rawData = state.activeProgram.rawData || collectFormData();
          const alternatives = window.BSMProgramEngineV2?.buildAlternatives?.(replacement, exerciseLibrary, rawData, {
            context: state.activeProgram.programContext,
            sessionIndex,
            exerciseIndex,
          });
          state.activeProgram.sessions[sessionIndex].exercises[exerciseIndex] = {
            ...replacement,
            prescription: buildPrescription(replacement, rawData, exerciseIndex),
            rest: buildRest(replacement, rawData),
            tempo: buildTempo(replacement, rawData),
            alternatives: alternatives || [],
          };
          state.activeProgram.sessions[sessionIndex].exerciseBlocks = buildExerciseBlocks(state.activeProgram.sessions[sessionIndex].exercises, rawData);
          state.activeProgram.sessions[sessionIndex].balanceNote =
            window.BSMProgramEngineV2?.enhanceSession?.(state.activeProgram.sessions[sessionIndex], rawData, exerciseLibrary, state.activeProgram.programContext)
              ?.balanceNote || state.activeProgram.sessions[sessionIndex].balanceNote;
          state.activeProgram.coverage = buildMuscleCoverage(state.activeProgram.sessions);
          saveLastPlan(state.activeProgram);
          renderProgram(state.activeProgram);
        }

        return;
      }

      exercise[field] = event.target.value;
      saveLastPlan(state.activeProgram);
    }

    function handlePrintPlan() {
      windowObject.print();
    }

    return {
      handleSubmit,
      handleLiveUpdate,
      handleFillExample,
      loadSavedForm,
      handleSaveMember,
      handleNewMember,
      handleSaveProgramToMember,
      handleSaveMeasurement,
      handleOpenTanitaCsvPicker,
      handleTanitaCsvSelected,
      handleSaveTanitaMeasurement,
      handleProgramEdit,
      handlePrintPlan,
    };
  }

  function bindFormHandlers(elements, handlers) {
    bindIf(elements.form, "submit", handlers.handleSubmit);
    bindIf(elements.form, "input", handlers.handleLiveUpdate);
    bindIf(elements.form, "change", handlers.handleLiveUpdate);
    bindIf(elements.fillExampleButton, "click", handlers.handleFillExample);
    bindIf(elements.loadSavedButton, "click", handlers.loadSavedForm);
    bindIf(elements.saveMemberButton, "click", handlers.handleSaveMember);
    bindIf(elements.newMemberButton, "click", handlers.handleNewMember);
    bindIf(elements.saveProgramButton, "click", handlers.handleSaveProgramToMember);
    bindIf(elements.saveMeasurementButton, "click", handlers.handleSaveMeasurement);
    bindIf(elements.tanitaCsvButton, "click", handlers.handleOpenTanitaCsvPicker);
    bindIf(elements.tanitaCsvInput, "change", handlers.handleTanitaCsvSelected);
    bindIf(elements.saveTanitaMeasurementButton, "click", handlers.handleSaveTanitaMeasurement);
    bindIf(elements.weeklyPlan, "input", handlers.handleProgramEdit);
    bindIf(elements.weeklyPlan, "change", handlers.handleProgramEdit);
  }

  function bindIf(target, eventName, handler) {
    if (!target || !handler) {
      return;
    }

    target.addEventListener(eventName, handler);
  }

  window.BSMFormHandlers = {
    createFormHandlers,
    bindFormHandlers,
  };
})();
