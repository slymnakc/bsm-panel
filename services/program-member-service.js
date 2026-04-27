(function () {
  "use strict";

  function matchesProgramMemberData(data, activeMember, deps) {
    const { normalizeText } = deps;
    const sameCode = data.memberCode && normalizeText(activeMember?.profile?.memberCode) === normalizeText(data.memberCode);
    const sameName = data.memberName && normalizeText(activeMember?.profile?.memberName) === normalizeText(data.memberName);

    return Boolean(sameCode || sameName);
  }

  function findMatchingMemberRecord(data, members = [], deps) {
    const { normalizeText } = deps;
    const sameCode = data.memberCode
      ? members.find((item) => normalizeText(item?.profile?.memberCode) === normalizeText(data.memberCode))
      : null;
    const sameName = data.memberName
      ? members.find((item) => normalizeText(item?.profile?.memberName) === normalizeText(data.memberName))
      : null;

    return sameCode || sameName || null;
  }

  function buildDraftProgramMember(data) {
    return {
      id: "draft-member",
      profile: data,
      measurements: [],
      programs: [],
    };
  }

  function buildProgramMemberRecord(data, activeMember, deps) {
    if (activeMember && matchesProgramMemberData(data, activeMember, deps)) {
      return {
        ...activeMember,
        profile: {
          ...(activeMember.profile || {}),
          ...data,
        },
      };
    }

    return buildDraftProgramMember(data);
  }

  window.BSMProgramMemberService = {
    matchesProgramMemberData,
    findMatchingMemberRecord,
    buildDraftProgramMember,
    buildProgramMemberRecord,
  };
})();
