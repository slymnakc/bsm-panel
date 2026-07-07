(function () {
  "use strict";

  const SYNC_VERSION = "supabase-first-v1";
  const TABLES = {
    members: "members",
    measurements: "measurements",
    programs: "programs",
    nutritionPlans: "nutrition_plans",
    appSettings: "app_settings",
  };

  function getClient() {
    return window.supabaseClient || window.BSMSupabaseClient || null;
  }

  function isEnabled() {
    return Boolean(getClient()?.from);
  }

  function loadMembers() {
    const client = getClient();

    if (!client?.from) {
      console.log("SUPABASE MEMBERS:", []);
      return Promise.resolve([]);
    }

    return Promise.all([
      safeSelect(client, TABLES.members, "updated_at", true),
      safeSelect(client, TABLES.measurements, "measured_at", false),
      safeSelect(client, TABLES.programs, "saved_at", false),
      safeSelect(client, TABLES.nutritionPlans, "created_at", false),
    ]).then(([memberRows, measurementRows, programRows, nutritionRows]) => {
      console.log("SUPABASE MEMBERS:", memberRows);
      return normalizeMembers(memberRows, measurementRows, programRows, nutritionRows);
    });
  }

  function loadAppSettings() {
    const client = getClient();

    if (!client?.from) {
      return Promise.resolve({});
    }

    return safeSelect(client, TABLES.appSettings, "updated_at", false).then((rows) =>
      rows.reduce((settings, row) => {
        const key = text(row.setting_key || row.key);
        if (key) {
          settings[key] = row.payload;
        }
        return settings;
      }, {}),
    );
  }

  function safeSelect(client, tableName, orderColumn, required) {
    let query = client.from(tableName).select("*");

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    return query
      .then(({ data, error }) => {
        if (error) {
          if (orderColumn) {
            return safeSelect(client, tableName, "", required);
          }

          const level = required ? "warn" : "info";
          console[level](`Supabase ${tableName} load error`, error);
          return [];
        }

        return Array.isArray(data) ? data : [];
      })
      .catch((error) => {
        const level = required ? "warn" : "info";
        console[level](`Supabase ${tableName} load error`, error);
        return [];
      });
  }

  function persistMembers(members) {
    const client = getClient();
    const normalizedMembers = normalizeMembersPayload(members);

    if (!client?.from || !normalizedMembers.length) {
      // BUG-SAVE-001: skipped=true → Supabase kapalı/offline lokal mod; HATA DEĞİL,
      // kullanıcı uyarısı tetiklenmez (test modu dahil).
      return Promise.resolve({ ok: false, skipped: true, reason: "Supabase kapalı veya üye yok." });
    }

    return upsertMembers(client, normalizedMembers).then((memberError) =>
      Promise.all([
        upsertPrograms(client, normalizedMembers),
        upsertNutritionPlans(client, normalizedMembers),
      ]).then(([programError, nutritionError]) => {
        const errors = [memberError, programError, nutritionError].filter(Boolean);
        return {
          ok: errors.length === 0,
          errors,
          errorKind: errors.length ? normalizeSyncErrorKind(errors[0].error) : "",
          syncedAt: new Date().toISOString(),
        };
      }),
    );
  }

  // BUG-SAVE-001: hata sebebini kullanıcı-yönlendirmesi için normalize eder.
  function normalizeSyncErrorKind(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || error || "").toLowerCase();

    if (code === "42501" || code === "PGRST301" || /jwt|auth|permission|row-level security|401|403/.test(message)) {
      return "auth";
    }

    if (/fetch|network|timeout|abort|offline/.test(message)) {
      return "network";
    }

    return "sync";
  }

  function persistMeasurement(member, measurement) {
    const client = getClient();

    if (!client?.from || !member || !measurement) {
      return Promise.resolve(null);
    }

    const row = buildMeasurementRow(member, measurement);

    if (!row.member_id || !row.app_measurement_id) {
      return Promise.resolve(null);
    }

    return client
      .from(TABLES.measurements)
      .upsert([row], { onConflict: "app_measurement_id" })
      .then(({ error }) => {
        if (error) {
          console.error("Supabase measurement upsert error", error);
          // BUG-SAVE-001: hata artık ayırt edilebilir (null = client kapalı/atlandı)
          return { ok: false, error, errorKind: normalizeSyncErrorKind(error) };
        }

        return row;
      })
      .catch((error) => {
        console.error("Supabase measurement upsert error", error);
        return { ok: false, error, errorKind: normalizeSyncErrorKind(error) };
      });
  }

  function deleteMeasurement(member, measurementId) {
    const client = getClient();
    const appMeasurementId = text(measurementId);

    if (!client?.from || !appMeasurementId) {
      return Promise.resolve(null);
    }

    const query = client.from(TABLES.measurements).delete().eq("app_measurement_id", appMeasurementId);
    const scopedQuery = member?.id ? query.eq("member_id", text(member.id)) : query;

    return scopedQuery
      .then(({ error }) => {
        if (error) {
          console.error("Supabase measurement delete error", error);
          return null;
        }

        return { app_measurement_id: appMeasurementId };
      })
      .catch((error) => {
        console.error("Supabase measurement delete error", error);
        return null;
      });
  }

  function persistAppSetting(key, payload) {
    const client = getClient();
    const settingKey = text(key);

    if (!client?.from || !settingKey) {
      return Promise.resolve({ ok: false });
    }

    return client
      .from(TABLES.appSettings)
      .upsert(
        [
          {
            setting_key: settingKey,
            payload,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "setting_key" },
      )
      .then(({ error }) => {
        if (error) {
          console.info("Supabase app_settings upsert skipped", error);
          return { ok: false };
        }

        return { ok: true };
      })
      .catch((error) => {
        console.info("Supabase app_settings upsert skipped", error);
        return { ok: false };
      });
  }

  function subscribeToChanges(onChange) {
    const client = getClient();

    if (!client?.channel) {
      return null;
    }

    const channel = client
      .channel("bsm-panel-production-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.members }, (payload) => onChange?.({ table: TABLES.members, payload }))
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.measurements }, (payload) => onChange?.({ table: TABLES.measurements, payload }))
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.programs }, (payload) => onChange?.({ table: TABLES.programs, payload }))
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.nutritionPlans }, (payload) => onChange?.({ table: TABLES.nutritionPlans, payload }))
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.appSettings }, (payload) => onChange?.({ table: TABLES.appSettings, payload }))
      .subscribe((status) => onChange?.({ status }));

    return channel;
  }

  // BUG-SAVE-001: upsert'ler başarıda null, hatada { table, error } döndürür —
  // persistMembers sonuçları toplayıp çağırana iletir (hata artık yutulmaz).
  function upsertMembers(client, members) {
    const rows = members.map(buildMemberRow).filter((row) => row.app_member_id && row.name);

    if (!rows.length) {
      return Promise.resolve(null);
    }

    return client
      .from(TABLES.members)
      .upsert(rows, { onConflict: "app_member_id" })
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase members upsert error", error);
          return { table: TABLES.members, error };
        }

        return null;
      })
      .catch((error) => {
        console.warn("Supabase members upsert error", error);
        return { table: TABLES.members, error };
      });
  }

  function upsertPrograms(client, members) {
    const rows = members.flatMap(buildProgramRows).filter((row) => row.app_program_id && row.member_id);

    if (!rows.length) {
      return Promise.resolve(null);
    }

    return client
      .from(TABLES.programs)
      .upsert(rows, { onConflict: "app_program_id" })
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase programs upsert error", error);
          return { table: TABLES.programs, error };
        }

        return null;
      })
      .catch((error) => {
        console.warn("Supabase programs upsert error", error);
        return { table: TABLES.programs, error };
      });
  }

  function upsertNutritionPlans(client, members) {
    const rows = members.flatMap(buildNutritionRows).filter((row) => row.app_nutrition_id && row.member_id);

    if (!rows.length) {
      return Promise.resolve(null);
    }

    return client
      .from(TABLES.nutritionPlans)
      .upsert(rows, { onConflict: "app_nutrition_id" })
      .then(({ error }) => {
        if (error) {
          console.warn("Supabase nutrition upsert error", error);
          return { table: TABLES.nutritionPlans, error };
        }

        return null;
      })
      .catch((error) => {
        console.warn("Supabase nutrition upsert error", error);
        return { table: TABLES.nutritionPlans, error };
      });
  }

  function buildMemberRow(member) {
    const normalizedMember = normalizeMember(member);
    const profile = normalizedMember.profile || {};
    const updatedAt = normalizedMember.updatedAt || normalizedMember.updated_at || normalizedMember.createdAt || new Date().toISOString();

    return {
      app_member_id: String(normalizedMember.id || ""),
      name: text(profile.memberName || normalizedMember.memberName || "Üye"),
      program: text(profile.goal || normalizedMember.goal || normalizedMember.program || "Genel"),
      email: text(profile.memberEmail || normalizedMember.memberEmail),
      member_code: text(profile.memberCode || normalizedMember.memberCode),
      profile,
      measurements: normalizedMember.measurements || [],
      programs: normalizedMember.programs || [],
      nutrition_plan: normalizedMember.nutritionPlan || null,
      nutrition_plans: normalizedMember.nutritionPlans || [],
      raw_payload: normalizedMember,
      updated_at: updatedAt,
    };
  }

  function buildMeasurementRow(member, measurement) {
    const profile = member?.profile || {};
    const normalizedMeasurement = normalizeMeasurement(measurement);

    return {
      app_measurement_id: String(normalizedMeasurement.id || buildStableId("measurement", member?.id, normalizedMeasurement.date, normalizedMeasurement.createdAtIso)),
      member_id: text(member?.id),
      member_name: text(profile.memberName || member?.memberName),
      measured_at: buildMeasuredAt(normalizedMeasurement),
      source: text(normalizedMeasurement.source) || "manual_entry",
      raw_payload: buildMeasurementRawPayload(normalizedMeasurement, measurement),
      weight: numberOrNull(normalizedMeasurement.weight),
      body_fat_percentage: numberOrNull(normalizedMeasurement.fat ?? normalizedMeasurement.bodyFatPercentage),
      fat_mass: numberOrNull(normalizedMeasurement.fatMass),
      muscle_mass: numberOrNull(normalizedMeasurement.muscleMass),
      body_water: numberOrNull(normalizedMeasurement.bodyWater),
      bmi: numberOrNull(normalizedMeasurement.bmi),
      bmr: numberOrNull(normalizedMeasurement.bmr),
      metabolic_age: numberOrNull(normalizedMeasurement.metabolicAge),
      visceral_fat: numberOrNull(normalizedMeasurement.visceralFat),
      bone_mass: numberOrNull(normalizedMeasurement.boneMass),
      segmental: normalizedMeasurement.segments || {},
      impedance: normalizedMeasurement.resistance || {},
    };
  }

  function buildMeasurementRawPayload(normalizedMeasurement, originalMeasurement) {
    const tanitaRawPayload = originalMeasurement?.rawPayload || normalizedMeasurement.rawPayload || null;

    return {
      ...normalizedMeasurement,
      bodyFatPercentage: normalizedMeasurement.fat,
      segments: normalizedMeasurement.segments || {},
      resistance: normalizedMeasurement.resistance || {},
      rawPayload: tanitaRawPayload,
      tanitaRawPayload,
      parserVersion: "tanita-csv-normalized-v2",
    };
  }

  function buildProgramRows(member) {
    const profile = member?.profile || {};
    return (member?.programs || []).map((record) => ({
      app_program_id: String(record.id || record.program?.id || buildStableId("program", member.id, record.savedAtIso, record.program?.createdAtIso)),
      member_id: text(member.id),
      member_name: text(profile.memberName || member.memberName),
      title: text(record.program?.title || record.title || "Antrenman Programı"),
      saved_at: buildDate(record.savedAtIso || record.saved_at || record.program?.createdAtIso),
      program: record.program || record,
      raw_payload: record,
      updated_at: new Date().toISOString(),
    }));
  }

  function buildNutritionRows(member) {
    const profile = member?.profile || {};
    const plans = member?.nutritionPlans?.length ? member.nutritionPlans : member?.nutritionPlan ? [member.nutritionPlan] : [];

    return plans.map((plan) => ({
      app_nutrition_id: String(plan.id || buildStableId("nutrition", member.id, plan.createdAtIso, plan.updatedAtIso)),
      member_id: text(member.id),
      member_name: text(profile.memberName || member.memberName),
      goal: text(plan.goal || profile.goal),
      payload: plan,
      created_at: buildDate(plan.createdAtIso || plan.createdAt),
      updated_at: buildDate(plan.updatedAtIso || plan.updatedAt || plan.createdAtIso),
    }));
  }

  function normalizeMembers(memberRows, measurementRows, programRows, nutritionRows) {
    const membersById = new Map();

    memberRows.forEach((row) => {
      const member = mapMemberRow(row);
      if (member?.id) {
        membersById.set(member.id, member);
      }
    });

    measurementRows.forEach((row) => {
      const memberId = text(row.member_id || row.app_member_id);
      const member = ensureRemoteMember(membersById, memberId, row.member_name);
      member.measurements = upsertById(member.measurements || [], mapMeasurementRow(row), "id");
    });

    programRows.forEach((row) => {
      const memberId = text(row.member_id || row.app_member_id);
      const member = ensureRemoteMember(membersById, memberId, row.member_name);
      member.programs = upsertById(member.programs || [], mapProgramRow(row), "id");
    });

    nutritionRows.forEach((row) => {
      const memberId = text(row.member_id || row.app_member_id);
      const member = ensureRemoteMember(membersById, memberId, row.member_name);
      const plan = row.payload || row.nutrition_plan || {};
      member.nutritionPlan = plan;
      member.nutritionPlans = upsertById(member.nutritionPlans || [], plan, "id").slice(0, 12);
    });

    return normalizeMembersPayload([...membersById.values()].map(sortMemberChildren));
  }

  function mapMemberRow(row) {
    const payload = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : row;
    const profile = {
      ...(payload.profile || {}),
      ...(row.profile || {}),
    };
    profile.memberName = profile.memberName || row.name || row.member_name || payload.memberName;
    profile.memberEmail = profile.memberEmail || row.email || payload.memberEmail;
    profile.memberCode = profile.memberCode || row.member_code || payload.memberCode;
    profile.goal = profile.goal || row.program || payload.goal;

    return normalizeMember({
      ...payload,
      id: payload.id || row.app_member_id || row.member_id || row.id,
      profile,
      measurements: Array.isArray(row.measurements) ? row.measurements : payload.measurements || [],
      programs: Array.isArray(row.programs) ? row.programs : payload.programs || [],
      nutritionPlan: row.nutrition_plan || payload.nutritionPlan || null,
      nutritionPlans: Array.isArray(row.nutrition_plans) ? row.nutrition_plans : payload.nutritionPlans || [],
      createdAt: payload.createdAt || row.created_at,
      updatedAt: payload.updatedAt || row.updated_at || row.created_at,
    });
  }

  function mapMeasurementRow(row) {
    const payload = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {};
    const tanitaRawPayload = payload.tanitaRawPayload && typeof payload.tanitaRawPayload === "object" ? payload.tanitaRawPayload : payload.rawPayload;
    const segments = firstFilledObject(
      row.segmental,
      payload.segments,
      buildSegmentsFromPayload(payload),
      buildSegmentsFromPayload(tanitaRawPayload),
    );
    const resistance = firstFilledObject(
      row.impedance,
      payload.resistance,
      buildResistanceFromPayload(payload),
      buildResistanceFromPayload(tanitaRawPayload),
    );

    return normalizeMeasurement({
      ...payload,
      id: payload.id || row.app_measurement_id || row.id,
      date: payload.date || dateOnly(row.measured_at || row.created_at),
      time: payload.time || timeOnly(row.measured_at),
      source: payload.source || row.source,
      weight: payload.weight ?? row.weight,
      fat: payload.fat ?? row.body_fat_percentage,
      bodyFatPercentage: payload.bodyFatPercentage ?? row.body_fat_percentage,
      fatMass: payload.fatMass ?? row.fat_mass,
      muscleMass: payload.muscleMass ?? row.muscle_mass,
      bodyWater: payload.bodyWater ?? row.body_water,
      bmi: payload.bmi ?? row.bmi,
      bmr: payload.bmr ?? row.bmr,
      metabolicAge: payload.metabolicAge ?? row.metabolic_age,
      visceralFat: payload.visceralFat ?? row.visceral_fat,
      boneMass: payload.boneMass ?? row.bone_mass,
      segments,
      resistance,
    });
  }

  function firstFilledObject(...objects) {
    return objects.find(hasFilledObjectValue) || {};
  }

  function hasFilledObjectValue(value) {
    return (
      value &&
      typeof value === "object" &&
      Object.values(value).some((item) => item !== "" && item !== undefined && item !== null)
    );
  }

  function buildSegmentsFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return {};
    }

    return {
      rightArmMuscle: pickPayloadValue(payload.rightArmMuscle),
      leftArmMuscle: pickPayloadValue(payload.leftArmMuscle),
      trunkMuscle: pickPayloadValue(payload.trunkMuscle),
      rightLegMuscle: pickPayloadValue(payload.rightLegMuscle),
      leftLegMuscle: pickPayloadValue(payload.leftLegMuscle),
      rightArmFat: pickPayloadValue(payload.rightArmFat),
      leftArmFat: pickPayloadValue(payload.leftArmFat),
      trunkFat: pickPayloadValue(payload.trunkFat),
      rightLegFat: pickPayloadValue(payload.rightLegFat),
      leftLegFat: pickPayloadValue(payload.leftLegFat),
    };
  }

  function buildResistanceFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return {};
    }

    return {
      rightArmResistance: pickPayloadValue(payload.rightArmResistance, payload.impedanceRightArm),
      leftArmResistance: pickPayloadValue(payload.leftArmResistance, payload.impedanceLeftArm),
      trunkResistance: pickPayloadValue(payload.trunkResistance, payload.impedanceTrunk),
      rightLegResistance: pickPayloadValue(payload.rightLegResistance, payload.impedanceRightLeg),
      leftLegResistance: pickPayloadValue(payload.leftLegResistance, payload.impedanceLeftLeg),
    };
  }

  function pickPayloadValue(...values) {
    return values.find((value) => value !== "" && value !== undefined && value !== null) ?? "";
  }

  function mapProgramRow(row) {
    return {
      ...(row.raw_payload || {}),
      id: row.app_program_id || row.id,
      savedAtIso: row.saved_at || row.created_at,
      savedAt: row.savedAt || row.saved_at || row.created_at,
      program: row.program || row.raw_payload?.program || {},
    };
  }

  function ensureRemoteMember(membersById, memberId, memberName) {
    const id = memberId || buildStableId("remote-member", memberName);

    if (!membersById.has(id)) {
      membersById.set(
        id,
        normalizeMember({
          id,
          profile: {
            memberName: memberName || "Üye",
          },
          measurements: [],
          programs: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
    }

    return membersById.get(id);
  }

  function sortMemberChildren(member) {
    member.measurements = [...(member.measurements || [])].sort((a, b) => dateScore(b.date || b.createdAtIso) - dateScore(a.date || a.createdAtIso)).slice(0, 40);
    member.programs = [...(member.programs || [])].sort((a, b) => dateScore(b.savedAtIso || b.saved_at) - dateScore(a.savedAtIso || a.saved_at)).slice(0, 25);
    return member;
  }

  function upsertById(records, nextRecord, key) {
    const id = String(nextRecord?.[key] || "");
    return [nextRecord, ...(records || []).filter((record) => String(record?.[key] || "") !== id)].filter(Boolean);
  }

  function buildMeasuredAt(measurement) {
    const date = text(measurement?.date);
    const time = text(measurement?.time) || "12:00";
    return buildDate(date ? `${date}T${time}` : measurement?.createdAtIso);
  }

  function buildDate(value) {
    const parsed = new Date(value || Date.now());
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  function dateOnly(value) {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }

  function timeOnly(value) {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toTimeString().slice(0, 5);
  }

  function dateScore(value) {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function numberOrNull(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildStableId(prefix, ...parts) {
    const value = parts.filter(Boolean).join("-");
    const slug = value.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-").replace(/^-+|-+$/g, "");
    return `${prefix}-${slug || Date.now()}`;
  }

  function text(value) {
    return String(value || "").trim();
  }

  function normalizeMembersPayload(value) {
    return window.BSMStorageService?.normalizeMembersPayload ? window.BSMStorageService.normalizeMembersPayload(value) : Array.isArray(value) ? value : [];
  }

  function normalizeMember(value) {
    return normalizeMembersPayload([value])[0] || value;
  }

  function normalizeMeasurement(value) {
    return window.BSMStorageService?.normalizeMeasurementPayload ? window.BSMStorageService.normalizeMeasurementPayload(value) : value;
  }

  window.BSMSupabaseSyncService = {
    version: SYNC_VERSION,
    isEnabled,
    normalizeSyncErrorKind,
    loadMembers,
    persistMembers,
    persistMeasurement,
    deleteMeasurement,
    loadAppSettings,
    persistAppSetting,
    subscribeToChanges,
  };
})();
