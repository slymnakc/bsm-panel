(function () {
  "use strict";

  const {
    storageKeys,
    loadFromStorage,
    saveToStorage,
    normalizeMembersPayload,
    normalizeFormPayload,
    storeBackupSnapshot,
  } = window.BSMStorageService;

  let lastSupabaseMembersFingerprint = "";

  function findActiveMember(members, activeMemberId) {
    const normalizedMembers = normalizeMembersPayload(members);
    return normalizedMembers.find((member) => member.id === activeMemberId) || null;
  }

  function loadMembers() {
    const savedMembers = loadFromStorage(storageKeys.members);
    return normalizeMembersPayload(savedMembers);
  }

  function loadSupabaseMembers() {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient?.from) {
      console.log("SUPABASE MEMBERS:", []);
      return Promise.resolve([]);
    }

    return supabaseClient
      .from("members")
      .select("*")
      .then(({ data, error }) => {
        console.log("SUPABASE MEMBERS:", data);

        if (error) {
          console.warn("Supabase members load error", error);
          return [];
        }

        return normalizeMembersPayload(Array.isArray(data) ? data.map(mapSupabaseMemberRow) : []);
      })
      .catch((error) => {
        console.warn("Supabase members load error", error);
        return [];
      });
  }

  function mergeMemberLists(localMembers, remoteMembers) {
    const mergedByIdentity = new Map();

    [...normalizeMembersPayload(remoteMembers), ...normalizeMembersPayload(localMembers)].forEach((member) => {
      const identity = buildMemberIdentity(member);
      const existingMember = mergedByIdentity.get(identity);
      mergedByIdentity.set(identity, chooseRicherMember(existingMember, member));
    });

    return normalizeMembersPayload([...mergedByIdentity.values()]);
  }

  function cacheMembersLocally(members, activeMemberId) {
    const normalizedMembers = normalizeMembersPayload(members);
    saveToStorage(storageKeys.members, normalizedMembers);
    storeBackupSnapshot(normalizedMembers, activeMemberId);
    return normalizedMembers;
  }

  function persistMembers(members, activeMemberId) {
    const normalizedMembers = normalizeMembersPayload(members);
    saveToStorage(storageKeys.members, normalizedMembers);
    storeBackupSnapshot(normalizedMembers, activeMemberId);
    syncMembersToSupabase(normalizedMembers);
    console.log("PERSIST MEMBERS OUTPUT:", normalizedMembers);
    return normalizedMembers;
  }

  function saveMeasurementToSupabase(member, measurement) {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient?.from) {
      return Promise.resolve(null);
    }

    const row = buildSupabaseMeasurementRow(member, measurement);

    if (!row.member_id || !row.member_name) {
      return Promise.resolve(null);
    }

    return supabaseClient
      .from("measurements")
      .insert([row])
      .then(({ error }) => {
        if (error) {
          console.error("Supabase measurement insert error", error);
        }

        return row;
      })
      .catch((error) => {
        console.error("Supabase measurement insert error", error);
        return null;
      });
  }

  function updateActiveMemberProfile(members, activeMemberId, profile) {
    const normalizedMembers = normalizeMembersPayload(members);
    const member = findActiveMember(normalizedMembers, activeMemberId);

    if (!member) {
      return null;
    }

    member.profile = normalizeFormPayload(profile);
    member.updatedAt = new Date().toISOString();
    return persistMembers(normalizedMembers, activeMemberId);
  }

  function syncMembersToSupabase(members) {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient?.from) {
      return;
    }

    const rows = buildSupabaseMemberRows(members);

    if (!rows.length) {
      return;
    }

    const fingerprint = JSON.stringify(rows);

    if (fingerprint === lastSupabaseMembersFingerprint) {
      return;
    }

    lastSupabaseMembersFingerprint = fingerprint;
    supabaseClient
      .from("members")
      .insert(rows)
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase members insert error", error);
        }
      })
      .catch((error) => {
        console.warn("Supabase members insert error", error);
      });
  }

  function buildSupabaseMemberRows(members) {
    return normalizeMembersPayload(members)
      .map((member) => {
        const profile = member.profile || {};
        const name = normalizeSupabaseText(member.memberName || profile.memberName);
        const program = normalizeSupabaseText(member.program || member.goal || profile.goal);
        return { name, program };
      })
      .filter((row) => row.name && row.program);
  }

  function buildSupabaseMeasurementRow(member, measurement) {
    const profile = member?.profile || {};
    const measuredAt = buildMeasuredAt(measurement);

    return {
      member_id: normalizeSupabaseText(member?.id),
      member_name: normalizeSupabaseText(member?.memberName || profile.memberName),
      measured_at: measuredAt,
      source: normalizeSupabaseText(measurement?.source) || "tanita_bc418_csv",
      raw_payload: measurement?.rawPayload || measurement || {},
      weight: toSupabaseNumber(measurement?.weight),
      body_fat_percentage: toSupabaseNumber(measurement?.fat),
      fat_mass: toSupabaseNumber(measurement?.fatMass),
      muscle_mass: toSupabaseNumber(measurement?.muscleMass),
      body_water: toSupabaseNumber(measurement?.bodyWater),
      bmi: toSupabaseNumber(measurement?.bmi),
      bmr: toSupabaseNumber(measurement?.bmr),
      metabolic_age: toSupabaseNumber(measurement?.metabolicAge),
      visceral_fat: toSupabaseNumber(measurement?.visceralFat),
      bone_mass: toSupabaseNumber(measurement?.boneMass),
      segmental: measurement?.segments || {},
      impedance: measurement?.resistance || {},
    };
  }

  function buildMeasuredAt(measurement) {
    const date = normalizeSupabaseText(measurement?.date);
    const time = normalizeSupabaseText(measurement?.time) || "12:00";

    if (!date) {
      return new Date().toISOString();
    }

    const parsed = new Date(`${date}T${time}`);
    const fallbackParsed = new Date(date);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return Number.isNaN(fallbackParsed.getTime()) ? new Date().toISOString() : fallbackParsed.toISOString();
  }

  function toSupabaseNumber(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeSupabaseText(value) {
    return String(value || "").trim();
  }

  function getSupabaseClient() {
    return window.supabaseClient || window.BSMSupabaseClient || null;
  }

  function mapSupabaseMemberRow(row) {
    const source = row && typeof row === "object" ? row : {};
    const profile = source.profile && typeof source.profile === "object" ? source.profile : {};
    const id = source.app_member_id || source.memberId || source.member_id || source.id || buildFallbackSupabaseId(source);

    return {
      ...source,
      id,
      profile: {
        ...profile,
        memberName: source.memberName || source.member_name || source.name || profile.memberName,
        memberCode: source.memberCode || source.member_code || profile.memberCode,
        trainerName: source.trainerName || source.trainer_name || profile.trainerName,
        goal: source.goal || source.program || profile.goal,
      },
      createdAt: source.createdAt || source.created_at || source.inserted_at || source.savedAtIso,
      updatedAt: source.updatedAt || source.updated_at || source.created_at || source.inserted_at || source.savedAtIso,
      measurements: Array.isArray(source.measurements) ? source.measurements : [],
      programs: Array.isArray(source.programs) ? source.programs : [],
    };
  }

  function buildFallbackSupabaseId(row) {
    const name = normalizeSupabaseText(row.name || row.memberName || "member").toLowerCase();
    const program = normalizeSupabaseText(row.program || row.goal || "program").toLowerCase();
    const stableKey = `${name}-${program}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `supabase-${stableKey || Date.now()}`;
  }

  function buildMemberIdentity(member) {
    const profile = member?.profile || {};
    const memberCode = normalizeSupabaseText(profile.memberCode).toLowerCase();

    if (memberCode) {
      return `code:${memberCode}`;
    }

    const memberName = normalizeSupabaseText(profile.memberName).toLowerCase();
    const goal = normalizeSupabaseText(profile.goal).toLowerCase();

    if (memberName) {
      return `name:${memberName}|goal:${goal}`;
    }

    return `id:${member?.id || buildFallbackSupabaseId(member || {})}`;
  }

  function chooseRicherMember(currentMember, nextMember) {
    if (!currentMember) {
      return nextMember;
    }

    return scoreMemberCompleteness(nextMember) > scoreMemberCompleteness(currentMember) ? nextMember : currentMember;
  }

  function scoreMemberCompleteness(member) {
    const profile = member?.profile || {};
    const profileScore = Object.values(profile).filter((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return normalizeSupabaseText(value);
    }).length;

    return profileScore + (member?.measurements?.length || 0) * 4 + (member?.programs?.length || 0) * 4;
  }

  function loadActiveMemberId() {
    return loadFromStorage(storageKeys.activeMemberId);
  }

  function saveActiveMemberId(activeMemberId) {
    saveToStorage(storageKeys.activeMemberId, activeMemberId || null);
    return activeMemberId || null;
  }

  function loadLastForm() {
    return loadFromStorage(storageKeys.form);
  }

  function saveLastForm(formData) {
    saveToStorage(storageKeys.form, formData);
    return formData;
  }

  function loadLastPlan() {
    return loadFromStorage(storageKeys.plan);
  }

  function saveLastPlan(plan) {
    saveToStorage(storageKeys.plan, plan);
    return plan;
  }

  function loadMemberSort() {
    return loadFromStorage(storageKeys.memberSort);
  }

  function saveMemberSort(sortValue) {
    saveToStorage(storageKeys.memberSort, sortValue);
    return sortValue;
  }

  window.BSMMemberService = {
    findActiveMember,
    loadMembers,
    loadSupabaseMembers,
    mergeMemberLists,
    cacheMembersLocally,
    persistMembers,
    saveMeasurementToSupabase,
    updateActiveMemberProfile,
    loadActiveMemberId,
    saveActiveMemberId,
    loadLastForm,
    saveLastForm,
    loadLastPlan,
    saveLastPlan,
    loadMemberSort,
    saveMemberSort,
  };
})();
