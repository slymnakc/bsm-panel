(function () {
  "use strict";

  function createMemberHandlers(deps) {
    const {
      state,
      memberSort,
      measurementDate,
      professionalMemberFile,
      normalizeMemberSort,
      saveMemberSort,
      renderMemberWorkspace,
      loadMember,
      findActiveMember,
      cloneData,
      renderProgram,
      setActiveScreen,
      setWorkspaceView,
      showStatus,
      getMemberAnalysis,
      populateForm,
      applyV3RevisionDefaults,
      collectFormData,
      validateFormData,
      buildProgram,
      saveLastForm,
      saveLastPlan,
      updateActiveMemberProfile,
      handleExportMembersCsv,
    } = deps;

    function handleMemberSearchInput() {
      renderMemberWorkspace();
    }

    function handleMemberSortChange() {
      state.activeMemberSort = normalizeMemberSort(memberSort?.value);
      saveMemberSort(state.activeMemberSort);
      renderMemberWorkspace();
    }

    function handleMemberListClick(event) {
      const button = event.target.closest("button[data-action]");

      if (!button) {
        return;
      }

      const member = state.members.find((item) => item.id === button.dataset.memberId);

      if (!member) {
        return;
      }

      if (button.dataset.action === "load-member") {
        loadMember(member);
      }
    }

    function handleProgramHistoryClick(event) {
      const button = event.target.closest("button[data-program-id]");

      if (!button) {
        return;
      }

      const member = findActiveMember();
      const record = member?.programs?.find((item) => item.id === button.dataset.programId);

      if (!record?.program) {
        return;
      }

      renderProgram(cloneData(record.program));
      setActiveScreen("output", { userTriggered: true, silent: true });
      showStatus("Geçmiş program yüklendi. İsterseniz düzenleyip tekrar kaydedebilirsiniz.", "success");
    }

    function handleCoachQuickAction(event) {
      const button = event.target.closest("button[data-quick-action]");

      if (!button) {
        return;
      }

      const action = button.dataset.quickAction;
      const member = findActiveMember();

      if (action === "open-builder") {
        setActiveScreen("builder", { userTriggered: true, silent: true });
        setWorkspaceView("members");
        return;
      }

      if (action === "open-measurements") {
        setActiveScreen("builder", { userTriggered: true, silent: true });
        setWorkspaceView("measurements");
        return;
      }

      if (action === "open-output") {
        const latestProgram = member?.programs?.[0]?.program;

        if (!latestProgram) {
          showStatus("Aktif üye için kayıtlı program bulunamadı.", "error");
          return;
        }

        renderProgram(cloneData(latestProgram));
        setActiveScreen("output", { userTriggered: true, silent: true });
        return;
      }

      if (action === "export-active-member") {
        handleExportMembersCsv(member ? [member] : null);
      }
    }

    function handleCoachTaskAction(event) {
      const button = event.target.closest("button[data-task-member-id]");

      if (!button) {
        return;
      }

      const member = state.members.find((item) => item.id === button.dataset.taskMemberId);

      if (!member) {
        showStatus("Göreve bağlı üye kaydı bulunamadı.", "error");
        return;
      }

      loadMember(member);
      setActiveScreen("builder", { userTriggered: true, silent: true });
      setWorkspaceView(button.dataset.taskWorkspace || "members");

      if (button.dataset.taskWorkspace === "measurements") {
        measurementDate?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      if (button.dataset.taskWorkspace === "v3") {
        professionalMemberFile?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      showStatus(`${member.profile?.memberName || "Üye"} için görev paneli açıldı.`, "success");
    }

    function handleV3RevisionAction(event) {
      const button = event.target.closest("button[data-v3-action]");

      if (!button) {
        return;
      }

      const action = button.dataset.v3Action;

      if (action === "open-measurement") {
        setWorkspaceView("measurements");
        measurementDate?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (action !== "generate-revision") {
        return;
      }

      const member = findActiveMember();

      if (!member) {
        showStatus("Revizyonlu program için önce aktif üye seçin.", "error");
        return;
      }

      populateForm(member.profile || {});
      const analysis = getMemberAnalysis(member);
      const revisedData = applyV3RevisionDefaults(collectFormData(), analysis);
      populateForm(revisedData);

      const validationMessage = validateFormData(revisedData);

      if (validationMessage) {
        showStatus(validationMessage, "error");
        return;
      }

      const program = buildProgram(revisedData);
      program.title = `${program.title} | V3 Revizyon`;
      program.v3RevisionApplied = true;
      saveLastForm(revisedData);
      saveLastPlan(program);
      updateActiveMemberProfile(revisedData);
      renderProgram(program);
      setActiveScreen("output", { userTriggered: true, silent: true });
      showStatus("V3 revizyon önerilerine göre yeni program oluşturuldu. Kontrol edip üyeye kaydedebilirsiniz.", "success");
    }

    return {
      handleMemberSearchInput,
      handleMemberSortChange,
      handleMemberListClick,
      handleProgramHistoryClick,
      handleCoachQuickAction,
      handleCoachTaskAction,
      handleV3RevisionAction,
    };
  }

  function bindMemberHandlers(elements, handlers) {
    bindIf(elements.memberSearch, "input", handlers.handleMemberSearchInput);
    bindIf(elements.memberSort, "change", handlers.handleMemberSortChange);
    bindIf(elements.memberList, "click", handlers.handleMemberListClick);
    bindIf(elements.programHistory, "click", handlers.handleProgramHistoryClick);
    bindIf(elements.v3RevisionPanel, "click", handlers.handleV3RevisionAction);
    bindIf(elements.coachQuickPanel, "click", handlers.handleCoachQuickAction);
    bindIf(elements.coachTaskPanel, "click", handlers.handleCoachTaskAction);
  }

  function bindIf(target, eventName, handler) {
    if (!target || !handler) {
      return;
    }

    target.addEventListener(eventName, handler);
  }

  window.BSMMemberHandlers = {
    createMemberHandlers,
    bindMemberHandlers,
  };
})();
