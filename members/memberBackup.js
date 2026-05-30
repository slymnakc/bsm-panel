// memberBackup.js — Refactor Adım 4B.4 (STRICT MECHANICAL).
// Backup/restore/CSV handler'lari output-handlers.js'den BIREBIR tasindi. Davranis
// degisikligi YOK; state mutation sirasi (members → activeMemberId → saveActiveMemberId
// → persistMembers → findActiveMember → populateForm/renderProgram → handleLiveUpdate
// → renderMemberWorkspace), confirm dialog metni, downloadFile filename pattern,
// CSV header siralamasi birebir korundu.
//
// !!! app.js'de BSMTestApi hook'lari (triggerBackupDownload / triggerCsvExport /
// triggerBackupRestore / triggerAutoRestore) WRAPPER olarak kalir — outputHandlers
// referansi window.BSMMemberBackup'a cevrilir. memberHandlers'a gecen
// handleExportMembersCsv (4B onceki member-handlers DI'i) da window.BSMMemberBackup
// uzerinden gecer; member-handlers degismez.
//
// KAPSAM ICI:
//   - handleDownloadBackup (JSON export — state read-only)
//   - handleOpenRestorePicker (file picker DOM trigger)
//   - handleBackupFileSelected (file upload + confirm + state SWAP + render)
//   - handleRestoreAutoBackup (history snapshot + confirm + state SWAP + render)
//   - handleExportMembersCsv (CSV export — state read-only)
//   - resetFormToDefaults (inline lokal — sadece handleBackupFileSelected kullanir)
//   - bindBackupHandlers (idempotent dataset guard'li)
//
// DAVRANIS KORUMA:
//   handleBackupFileSelected + handleRestoreAutoBackup: state.members + activeMemberId
//   + activeProgram MUTATE; renderProgram (program varsa) + renderMemberWorkspace.
//   confirm dismiss → erken donus, state korunur.
//
// Dependency injection (28 dep — output-handlers factory deps'i birebir):
//   state, schemaVersion, form, backupFileInput, resultsSection, collectFormData,
//   getCurrentProgramFromEditor, loadLastPlan, showStatus, downloadFile, formatFileDate,
//   extractMembersFromBackup, normalizeImportedMembers, saveActiveMemberId,
//   persistMembers, findActiveMember, populateForm, renderProgram, cloneData,
//   handleLiveUpdate, renderMemberWorkspace, loadBackupHistory, formatDashboardDate,
//   buildCsvContent, labelMaps, getTrainingSystemLabel, getDayLabel,
//   windowObject (default window)

(function () {
  "use strict";

  var _state = null;
  var _schemaVersion = 3;
  var _form = null;
  var _backupFileInput = null;
  var _resultsSection = null;
  var _collectFormData = function () { return {}; };
  var _getCurrentProgramFromEditor = function () { return null; };
  var _loadLastPlan = function () { return null; };
  var _showStatus = function () {};
  var _downloadFile = function () {};
  var _formatFileDate = function () { return ""; };
  var _extractMembersFromBackup = function () { return []; };
  var _normalizeImportedMembers = function (v) { return Array.isArray(v) ? v : []; };
  var _saveActiveMemberId = function () {};
  var _persistMembers = function () {};
  var _findActiveMember = function () { return null; };
  var _populateForm = function () {};
  var _renderProgram = function () {};
  var _cloneData = function (v) { return v; };
  var _handleLiveUpdate = function () {};
  var _renderMemberWorkspace = function () {};
  var _loadBackupHistory = function () { return []; };
  var _formatDashboardDate = function (v) { return v || ""; };
  var _buildCsvContent = function () { return ""; };
  var _labelMaps = { goal: {}, level: {} };
  var _getTrainingSystemLabel = function (v) { return v || ""; };
  var _getDayLabel = function (v) { return v || ""; };
  var _windowObject = (typeof window !== "undefined") ? window : {};

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.schemaVersion === "number") _schemaVersion = deps.schemaVersion;
    if (deps.form) _form = deps.form;
    if (deps.backupFileInput) _backupFileInput = deps.backupFileInput;
    if (deps.resultsSection) _resultsSection = deps.resultsSection;
    if (typeof deps.collectFormData === "function") _collectFormData = deps.collectFormData;
    if (typeof deps.getCurrentProgramFromEditor === "function") _getCurrentProgramFromEditor = deps.getCurrentProgramFromEditor;
    if (typeof deps.loadLastPlan === "function") _loadLastPlan = deps.loadLastPlan;
    if (typeof deps.showStatus === "function") _showStatus = deps.showStatus;
    if (typeof deps.downloadFile === "function") _downloadFile = deps.downloadFile;
    if (typeof deps.formatFileDate === "function") _formatFileDate = deps.formatFileDate;
    if (typeof deps.extractMembersFromBackup === "function") _extractMembersFromBackup = deps.extractMembersFromBackup;
    if (typeof deps.normalizeImportedMembers === "function") _normalizeImportedMembers = deps.normalizeImportedMembers;
    if (typeof deps.saveActiveMemberId === "function") _saveActiveMemberId = deps.saveActiveMemberId;
    if (typeof deps.persistMembers === "function") _persistMembers = deps.persistMembers;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.populateForm === "function") _populateForm = deps.populateForm;
    if (typeof deps.renderProgram === "function") _renderProgram = deps.renderProgram;
    if (typeof deps.cloneData === "function") _cloneData = deps.cloneData;
    if (typeof deps.handleLiveUpdate === "function") _handleLiveUpdate = deps.handleLiveUpdate;
    if (typeof deps.renderMemberWorkspace === "function") _renderMemberWorkspace = deps.renderMemberWorkspace;
    if (typeof deps.loadBackupHistory === "function") _loadBackupHistory = deps.loadBackupHistory;
    if (typeof deps.formatDashboardDate === "function") _formatDashboardDate = deps.formatDashboardDate;
    if (typeof deps.buildCsvContent === "function") _buildCsvContent = deps.buildCsvContent;
    if (deps.labelMaps) _labelMaps = deps.labelMaps;
    if (typeof deps.getTrainingSystemLabel === "function") _getTrainingSystemLabel = deps.getTrainingSystemLabel;
    if (typeof deps.getDayLabel === "function") _getDayLabel = deps.getDayLabel;
    if (deps.windowObject) _windowObject = deps.windowObject;
  }

  // ═══════════════════════════════════════════════════════════════════
  // handleDownloadBackup — output-handlers.js:41 birebir
  // ═══════════════════════════════════════════════════════════════════
  function handleDownloadBackup() {
    if (!_state.members.length) {
      _showStatus("Yedek indirilebilmesi için önce en az bir üye kaydı olmalı.", "error");
      return;
    }

    const backupPayload = {
      schemaVersion: _schemaVersion,
      exportedAt: new Date().toISOString(),
      gymName: _form.querySelector("#gymName")?.value?.trim() || "Bahçeşehir Spor Merkezi",
      activeMemberId: _state.activeMemberId,
      members: _state.members,
      lastForm: _collectFormData(),
      lastPlan: _getCurrentProgramFromEditor() || _loadLastPlan(),
    };
    const filename = `bahcesehir-spor-merkezi-yedek-${_formatFileDate(new Date())}.json`;

    _downloadFile(filename, `${JSON.stringify(backupPayload, null, 2)}\n`, "application/json;charset=utf-8");
    _showStatus("Yedek dosyası indirildi.", "success");
  }

  // ═══════════════════════════════════════════════════════════════════
  // handleOpenRestorePicker — output-handlers.js:62 birebir
  // ═══════════════════════════════════════════════════════════════════
  function handleOpenRestorePicker() {
    _backupFileInput?.click();
  }

  // ═══════════════════════════════════════════════════════════════════
  // handleBackupFileSelected — output-handlers.js:66 birebir
  // state.members + activeMemberId + activeProgram MUTATE; confirm dismiss → erken
  // ═══════════════════════════════════════════════════════════════════
  async function handleBackupFileSelected(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const payload = JSON.parse(rawText);
      const extractedMembers = _extractMembersFromBackup(payload);
      const normalizedMembers = _normalizeImportedMembers(extractedMembers);

      if (!_windowObject.confirm(`Yedek yüklendiğinde mevcut kayıtlar bu dosyayla değişecek. Devam edilsin mi? (${normalizedMembers.length} üye)`)) {
        return;
      }

      _state.members = normalizedMembers;
      const importedActiveMemberId = String(payload?.activeMemberId || "");
      _state.activeMemberId = _state.members.some((member) => member.id === importedActiveMemberId) ? importedActiveMemberId : _state.members[0]?.id || null;
      _saveActiveMemberId(_state.activeMemberId);
      _persistMembers();

      const activeMember = _findActiveMember();
      if (activeMember) {
        _populateForm(activeMember.profile || {});
        if (activeMember.programs?.[0]?.program) {
          _renderProgram(_cloneData(activeMember.programs[0].program));
        } else {
          _resultsSection.classList.add("hidden");
          _state.activeProgram = null;
        }
      } else {
        resetFormToDefaults(_form);
        _resultsSection.classList.add("hidden");
        _state.activeProgram = null;
      }

      _handleLiveUpdate();
      _renderMemberWorkspace();
      _showStatus(`Yedek dosyası başarıyla yüklendi (${normalizedMembers.length} üye).`, "success");
    } catch (error) {
      _showStatus("Yedek yüklenemedi. Dosya biçimi geçerli bir JSON yedeği olmalı.", "error");
    } finally {
      if (_backupFileInput) {
        _backupFileInput.value = "";
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // handleRestoreAutoBackup — output-handlers.js:116 birebir
  // ═══════════════════════════════════════════════════════════════════
  function handleRestoreAutoBackup() {
    const history = _loadBackupHistory();

    if (!history.length) {
      _showStatus("Geri alınacak otomatik yedek bulunamadı.", "error");
      return;
    }

    const latestSnapshot = history[0];
    const snapshotMembers = _normalizeImportedMembers(latestSnapshot.members || []);
    const snapshotMemberCount = snapshotMembers.length;
    const snapshotDate = _formatDashboardDate(latestSnapshot.savedAt);

    if (!_windowObject.confirm(`Son otomatik yedek geri alınacak (${snapshotDate} - ${snapshotMemberCount} üye). Devam edilsin mi?`)) {
      return;
    }

    _state.members = snapshotMembers;
    _state.activeMemberId = _state.members.some((member) => member.id === latestSnapshot.activeMemberId) ? latestSnapshot.activeMemberId : _state.members[0]?.id || null;
    _saveActiveMemberId(_state.activeMemberId);
    _persistMembers();

    const activeMember = _findActiveMember();
    if (activeMember) {
      _populateForm(activeMember.profile || {});
      if (activeMember.programs?.[0]?.program) {
        _renderProgram(_cloneData(activeMember.programs[0].program));
      } else {
        _resultsSection.classList.add("hidden");
        _state.activeProgram = null;
      }
    } else {
      _resultsSection.classList.add("hidden");
      _state.activeProgram = null;
    }
    _handleLiveUpdate();
    _renderMemberWorkspace();
    _showStatus("Otomatik yedek geri alındı.", "success");
  }

  // ═══════════════════════════════════════════════════════════════════
  // handleExportMembersCsv — output-handlers.js:156 birebir
  // ═══════════════════════════════════════════════════════════════════
  function handleExportMembersCsv(memberSubset = null) {
    const membersToExport = Array.isArray(memberSubset) ? memberSubset : _state.members;

    if (!membersToExport.length) {
      _showStatus("CSV dışa aktarma için üye kaydı bulunamadı.", "error");
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
        _labelMaps.goal[profile.goal] || "",
        _labelMaps.level[profile.level] || "",
        _getTrainingSystemLabel(profile.trainingSystem || "standard"),
        (profile.days || []).map((day) => _getDayLabel(day)).join(", "),
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
    const csvContent = _buildCsvContent([header, ...rows]);
    const fileLabel = membersToExport.length === 1 ? "uye" : "tum-uyeler";
    const filename = `bahçeşehir-${fileLabel}-${_formatFileDate(new Date())}.csv`;

    _downloadFile(filename, csvContent, "text/csv;charset=utf-8");
    _showStatus(`CSV dışa aktarma tamamlandı (${membersToExport.length} üye).`, "success");
  }

  // ── resetFormToDefaults — output-handlers.js:240 birebir (sadece handleBackupFileSelected) ──
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

  // ═══════════════════════════════════════════════════════════════════
  // bindBackupHandlers — output-handlers.js:224 birebir (idempotent guard)
  // ═══════════════════════════════════════════════════════════════════
  function bindBackupHandlers(elements) {
    if (!elements) return;
    bindIf(elements.downloadBackupButton, "click", handleDownloadBackup);
    bindIf(elements.restoreBackupButton, "click", handleOpenRestorePicker);
    bindIf(elements.exportMembersCsvButton, "click", handleExportMembersCsv);
    bindIf(elements.restoreAutoBackupButton, "click", handleRestoreAutoBackup);
    bindIf(elements.backupFileInput, "change", handleBackupFileSelected);
  }

  function bindIf(target, eventName, handler) {
    if (!target || !handler) {
      return;
    }
    // Idempotent guard (4A.2.2/4A.2.3 pattern) — dataset flag ile cift bind onlenir.
    var key = "bsmBackup" + eventName.charAt(0).toUpperCase() + eventName.slice(1) + "Bound";
    if (target.dataset && target.dataset[key] === "true") return;
    target.addEventListener(eventName, handler);
    if (target.dataset) target.dataset[key] = "true";
  }

  window.BSMMemberBackup = {
    init: init,
    bindBackupHandlers: bindBackupHandlers,
    handleDownloadBackup: handleDownloadBackup,
    handleOpenRestorePicker: handleOpenRestorePicker,
    handleBackupFileSelected: handleBackupFileSelected,
    handleRestoreAutoBackup: handleRestoreAutoBackup,
    handleExportMembersCsv: handleExportMembersCsv,
  };
})();
