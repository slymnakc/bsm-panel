(function () {
  "use strict";

  const CONFIG = {
    engineVersion: "2.0.0",
    storageKey: "bsm-v2-automation-records",
    measurementReminderDays: 14,
    programRevisionDays: 21,
    controlWindowDays: 3,
    channels: {
      local: true,
      telegram: false,
      whatsapp: false,
      email: false,
    },
  };

  function syncAutomations(members = [], activeMemberId = null, options = {}) {
    const today = options.today ? new Date(options.today) : new Date();
    const records = buildAutomationRecords(members, activeMemberId, today);
    saveRecords(records);

    return buildSummary(records, members, today);
  }

  function buildAutomationRecords(members = [], activeMemberId = null, today = new Date()) {
    const records = [];

    members.forEach((member) => {
      const profile = member.profile || {};
      const latestMeasurement = getLatestMeasurement(member);
      const latestProgram = getLatestProgram(member);
      const memberName = profile.memberName || profile.memberCode || "Üye";

      if (!latestMeasurement) {
        records.push(makeRecord(member, {
          type: "measurement-reminder",
          severity: "warning",
          title: "Ölçüm kaydı bekleniyor",
          message: `${memberName} için henüz segmental ölçüm yok. İlk ölçüm alınırsa analiz ve takip netleşir.`,
          dueAt: today,
        }));
      } else {
        const measurementAge = daysSince(latestMeasurement.date, today);
        if (measurementAge !== null && measurementAge >= CONFIG.measurementReminderDays) {
          records.push(makeRecord(member, {
            type: "measurement-reminder",
            severity: "warning",
            title: "14 gün ölçüm hatırlatması",
            message: `${memberName} için son ölçüm ${measurementAge} gün önce girilmiş. Yeni ölçüm planlanmalı.`,
            dueAt: today,
          }));
        }
      }

      if (latestProgram) {
        const programAge = daysSince(latestProgram.savedAtIso || latestProgram.program?.createdAtIso || latestProgram.savedAt || latestProgram.program?.createdAt, today);
        if (programAge !== null && programAge >= CONFIG.programRevisionDays) {
          records.push(makeRecord(member, {
            type: "program-revision",
            severity: "info",
            title: "Program güncelleme önerisi",
            message: `${memberName} için son program ${programAge} gün önce kaydedilmiş. Yeni varyasyon veya yoğunluk revizyonu önerilir.`,
            dueAt: today,
          }));
        }
      }

      const nextControl = inferNextControlDate(member, today);
      const daysToControl = nextControl ? daysBetween(today, nextControl) : null;

      if (daysToControl !== null && daysToControl >= 0 && daysToControl <= CONFIG.controlWindowDays) {
        records.push(makeRecord(member, {
          type: "next-control",
          severity: member.id === activeMemberId ? "warning" : "info",
          title: "Kontrol tarihi yaklaşıyor",
          message: `${memberName} için bir sonraki kontrol ${formatDate(nextControl)} civarında planlanmalı.`,
          dueAt: nextControl,
        }));
      }

      if (member.id === activeMemberId && (profile.restrictions || []).length) {
        records.push(makeRecord(member, {
          type: "active-restriction",
          severity: "warning",
          title: "Aktif üye hassasiyet uyarısı",
          message: "Aktif üyenin diz/bel/omuz veya düşük etkili çalışma notu var. Egzersiz alternatifleri kontrol edilmeli.",
          dueAt: today,
        }));
      }
    });

    return dedupeRecords(records);
  }

  function buildSummary(records, members, today) {
    const last7DaysActivityCount = countLast7DaysActivity(members, today);
    const measurementDueMemberIds = new Set(records.filter((record) => record.type === "measurement-reminder").map((record) => record.memberId));
    const programDueMemberIds = new Set(records.filter((record) => record.type === "program-revision").map((record) => record.memberId));
    const riskMemberIds = new Set(records.filter((record) => record.severity === "warning").map((record) => record.memberId));

    return {
      engineVersion: CONFIG.engineVersion,
      records,
      riskMemberCount: riskMemberIds.size,
      measurementDueCount: measurementDueMemberIds.size,
      programUpdateDueCount: programDueMemberIds.size,
      last7DaysActivityCount,
      localNotificationCenter: {
        storageKey: CONFIG.storageKey,
        channels: CONFIG.channels,
        openRecords: records.length,
      },
    };
  }

  function getNotificationCenter() {
    return {
      storageKey: CONFIG.storageKey,
      channels: CONFIG.channels,
      records: loadRecords(),
    };
  }

  function makeRecord(member, payload) {
    const profile = member.profile || {};
    const dueAt = payload.dueAt instanceof Date ? payload.dueAt.toISOString() : new Date(payload.dueAt || Date.now()).toISOString();

    return {
      id: `${member.id || "member"}-${payload.type}-${dueAt.slice(0, 10)}`,
      memberId: member.id || "",
      memberName: profile.memberName || profile.memberCode || "Üye",
      type: payload.type,
      severity: payload.severity || "info",
      title: payload.title,
      message: payload.message,
      dueAt,
      status: "open",
      createdAt: new Date().toISOString(),
      channels: CONFIG.channels,
      integrationReady: {
        telegram: false,
        whatsapp: false,
        email: false,
      },
    };
  }

  function dedupeRecords(records) {
    const map = new Map();
    records.forEach((record) => {
      map.set(record.id, record);
    });
    return [...map.values()].sort((a, b) => {
      const severityRank = { warning: 2, info: 1 };
      return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || String(a.dueAt).localeCompare(String(b.dueAt), "tr");
    });
  }

  function countLast7DaysActivity(members, today) {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let count = 0;

    members.forEach((member) => {
      (member.measurements || []).forEach((measurement) => {
        const date = parseDate(measurement.date);
        if (date && date >= sevenDaysAgo && date <= today) {
          count += 1;
        }
      });

      (member.programs || []).forEach((program) => {
        const date = parseDate(program.savedAtIso || program.program?.createdAtIso || program.savedAt || program.program?.createdAt);
        if (date && date >= sevenDaysAgo && date <= today) {
          count += 1;
        }
      });
    });

    return count;
  }

  function getLatestMeasurement(member) {
    return [...(member.measurements || [])].sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0))[0] || null;
  }

  function getLatestProgram(member) {
    return [...(member.programs || [])].sort((a, b) => {
      const dateA = parseDate(a.savedAtIso || a.program?.createdAtIso || a.savedAt || a.program?.createdAt);
      const dateB = parseDate(b.savedAtIso || b.program?.createdAtIso || b.savedAt || b.program?.createdAt);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    })[0] || null;
  }

  function inferNextControlDate(member, today) {
    const latestMeasurement = getLatestMeasurement(member);
    const latestProgram = getLatestProgram(member);
    const baseDate = parseDate(latestMeasurement?.date) || parseDate(latestProgram?.savedAtIso || latestProgram?.program?.createdAtIso || latestProgram?.savedAt || latestProgram?.program?.createdAt);

    if (!baseDate) {
      return null;
    }

    const nextControl = new Date(baseDate);
    nextControl.setDate(nextControl.getDate() + CONFIG.measurementReminderDays);

    if (nextControl < new Date(today).setHours(0, 0, 0, 0)) {
      return null;
    }

    return nextControl;
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(records));
    } catch (error) {
      console.warn("Automation records could not be saved", error);
    }
  }

  function loadRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function daysSince(value, today = new Date()) {
    const date = parseDate(value);
    if (!date) {
      return null;
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  function daysBetween(startValue, endValue) {
    const start = new Date(startValue);
    const end = new Date(endValue);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end - start) / 86400000);
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    if (window.BSMAnalysisEngine?.parseDate) {
      return window.BSMAnalysisEngine.parseDate(value);
    }

    const direct = new Date(value);
    return Number.isNaN(direct.getTime()) ? null : direct;
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    return date ? date.toLocaleDateString("tr-TR", { dateStyle: "medium" }) : "yakın tarih";
  }

  window.BSMAutomationEngine = {
    CONFIG,
    syncAutomations,
    buildAutomationRecords,
    getNotificationCenter,
    loadRecords,
    daysSince,
  };
})();
