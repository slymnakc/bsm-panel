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

  function findActiveMember(members, activeMemberId) {

    if (!Array.isArray(members)) {
        console.log("members ARRAY DEĞİL:", members);
        members = [];
    }

  
    return (members || []).find((member) => member.id === activeMemberId) || null;
  }

  function loadMembers() {
    const savedMembers = loadFromStorage(storageKeys.members);
    return Array.isArray(savedMembers) ? normalizeMembersPayload(savedMembers) : [];
  }

  async function persistMembers(members, activeMemberId) {
    const normalizedMembers = normalizeMembersPayload(members);
    saveToStorage(storageKeys.members, normalizedMembers);
    storeBackupSnapshot(normalizedMembers, activeMemberId);

    if (window.supabaseClient) {
        try {
           await window.supabaseClient.from("members").delete().neq("id", "0");

            await window.supabaseClient.from("members").insert(
                normalizedMembers.map(m => ({
                    name: m.name || "",
                    program: m.program || ""
                }))
            );
        } catch (err) {
            console.error(err);
        }
    }

    return normalizedMembers;
}

  function updateActiveMemberProfile(members, activeMemberId, profile) {
    const member = findActiveMember(members, activeMemberId);

    if (!member) {
      return null;
    }

    member.profile = normalizeFormPayload(profile);
    member.updatedAt = new Date().toISOString();
    return persistMembers(members, activeMemberId);
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
    persistMembers,
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
