(function () {
  "use strict";

  const schemaVersion = 3;
  const storageKeys = {
    form: "formaplan-studio-last-form",
    plan: "formaplan-studio-last-plan",
    members: "formaplan-studio-members",
    activeMemberId: "formaplan-studio-active-member-id",
    memberSort: "formaplan-studio-member-sort",
    backupHistory: "formaplan-studio-backup-history",
  };

  function normalizeFormPayload(value) {
    return window.BSMDataMigrations?.normalizeFormData ? window.BSMDataMigrations.normalizeFormData(value) : value;
  }

  function normalizePlanPayload(value) {
    return window.BSMDataMigrations?.normalizePlan ? window.BSMDataMigrations.normalizePlan(value) : value;
  }

  function normalizeMeasurementPayload(value) {
    return window.BSMDataMigrations?.normalizeMeasurement ? window.BSMDataMigrations.normalizeMeasurement(value) : value;
  }

  function normalizeMembersPayload(value) {
    const members = extractMemberArrayPayload(value);
    return window.BSMDataMigrations?.normalizeMembers ? window.BSMDataMigrations.normalizeMembers(members) : members;
  }

  function extractMemberArrayPayload(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && Array.isArray(value.data)) {
      return value.data;
    }

    if (value && Array.isArray(value.members)) {
      return value.members;
    }

    return [];
  }

  function normalizeBackupHistoryPayload(value) {
    return window.BSMDataMigrations?.normalizeBackupHistory ? window.BSMDataMigrations.normalizeBackupHistory(value) : value;
  }

  function normalizeStorageValue(key, value) {
    if (key === storageKeys.form) {
      return normalizeFormPayload(value);
    }

    if (key === storageKeys.plan) {
      return normalizePlanPayload(value);
    }

    if (key === storageKeys.members) {
      return normalizeMembersPayload(value);
    }

    if (key === storageKeys.backupHistory) {
      return normalizeBackupHistoryPayload(value);
    }

    return value;
  }

  function saveToStorage(key, value) {
    const normalizedValue = normalizeStorageValue(key, value);

    try {
      localStorage.setItem(key, JSON.stringify(normalizedValue));
    } catch (error) {
      // Tarayıcı yerel kaydı engellerse uygulama çalışmaya devam eder.
    }
  }

  function loadFromStorage(key) {
    let raw = null;

    try {
      raw = localStorage.getItem(key);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeStorageValue(key, parsed);

      try {
        if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
          localStorage.setItem(key, JSON.stringify(normalized));
        }
      } catch (error) {
        // Normalizasyon sonrasi tekrar yazilamazsa okunan deger dondurulur.
      }

      return normalized;
    } catch (error) {
      return null;
    }
  }

  function buildBackupFingerprint(members, activeMemberId) {
    const memberMeta = members
      .map((member) => `${member.id}|${member.updatedAt || member.createdAt || ""}|${member.programs?.length || 0}|${member.measurements?.length || 0}`)
      .join(";");

    return `${memberMeta}#${activeMemberId || ""}`;
  }

  function storeBackupSnapshot(members, activeMemberId) {
    if (!Array.isArray(members)) {
      return;
    }

    const backupHistory = loadBackupHistory();
    const fingerprint = buildBackupFingerprint(members, activeMemberId);

    if (backupHistory[0]?.fingerprint === fingerprint) {
      return;
    }

    const snapshot = {
      id: makeId("backup"),
      savedAt: new Date().toISOString(),
      memberCount: members.length,
      activeMemberId: activeMemberId || null,
      fingerprint,
      members: cloneData(members),
    };

    saveToStorage(storageKeys.backupHistory, [snapshot, ...backupHistory].slice(0, 6));
  }

  function loadBackupHistory() {
    const backupHistory = loadFromStorage(storageKeys.backupHistory);
    return Array.isArray(backupHistory) ? backupHistory.filter((item) => item && typeof item === "object") : [];
  }

  function extractMembersFromBackup(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.members)) {
      return payload.members;
    }

    throw new Error("Backup parse error");
  }

  function normalizeImportedMembers(rawMembers) {
    return Array.isArray(rawMembers) ? normalizeMembersPayload(rawMembers) : [];
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.BSMStorageService = {
    schemaVersion,
    storageKeys,
    normalizeFormPayload,
    normalizePlanPayload,
    normalizeMeasurementPayload,
    normalizeMembersPayload,
    normalizeBackupHistoryPayload,
    normalizeStorageValue,
    saveToStorage,
    loadFromStorage,
    storeBackupSnapshot,
    loadBackupHistory,
    extractMembersFromBackup,
    normalizeImportedMembers,
  };
})();
