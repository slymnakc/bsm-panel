// memberState.js — Refactor Adım 4B.1 (STRICT MECHANICAL).
// Member state resolver + sync + persistence wrapper'lari app.js'den BIREBIR tasindi.
// Davranis degisikligi YOK; render sirasi, state mutation pattern, selectActiveMemberFromRail
// (app.js'de kalan) davranisi etkilenmedi.
//
// !!! app.js'de bu 5 fn ICE WRAPPER olarak kalir (window.BSMMemberState.X cagirir).
// Boylece app.js'deki 51 findActiveMember cagrisi + diger modullere giden callback'ler
// (nutrition/output/handlers init({findActiveMember: () => findActiveMember()})) DEGISMEZ.
//
// KAPSAM ICI (5 fn):
//   - findActiveMember (state.members + activeMemberId resolver)
//   - syncActiveMemberState (activeMember + latestMeasurement + activeMeasurementState sync)
//   - loadMembers (loadStoredMembers wrapper)
//   - persistMembers (persistStoredMembers + syncActiveMemberState)
//   - updateActiveMemberProfile (updateStoredActiveMemberProfile + sync + render)
//
// KAPSAM DISI (app.js'de KALIYOR — callback ile erisilir):
//   - isMeasurementForMember (measurement domain helper)
//   - renderMemberWorkspace (member workspace orchestrator)
//   - selectActiveMemberFromRail / loadMember / hydrateActiveMemberSession (4B sonraki)
//   - state.members setter (normalizeMembersPayload — state objesinin kendi setter'i)
//
// Dependency injection (7 madde — koddan dogrulanmis):
//   state, normalizeMembersPayload (BSMStorageService), loadStoredMembers (BSMMemberService),
//   persistStoredMembers (BSMMemberService), updateStoredActiveMemberProfile (BSMMemberService),
//   isMeasurementForMember (app.js callback), renderMemberWorkspace (app.js callback)

(function () {
  "use strict";

  var _state = null;
  var _normalizeMembersPayload = function (v) { return Array.isArray(v) ? v : []; };
  var _loadStoredMembers = function () { return []; };
  var _persistStoredMembers = function (members) { return members; };
  var _updateStoredActiveMemberProfile = function () { return null; };
  var _isMeasurementForMember = function () { return false; };
  var _renderMemberWorkspace = function () {};

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.normalizeMembersPayload === "function") _normalizeMembersPayload = deps.normalizeMembersPayload;
    if (typeof deps.loadStoredMembers === "function") _loadStoredMembers = deps.loadStoredMembers;
    if (typeof deps.persistStoredMembers === "function") _persistStoredMembers = deps.persistStoredMembers;
    if (typeof deps.updateStoredActiveMemberProfile === "function") _updateStoredActiveMemberProfile = deps.updateStoredActiveMemberProfile;
    if (typeof deps.isMeasurementForMember === "function") _isMeasurementForMember = deps.isMeasurementForMember;
    if (typeof deps.renderMemberWorkspace === "function") _renderMemberWorkspace = deps.renderMemberWorkspace;
  }

  // ═══════════════════════════════════════════════════════════════════
  // findActiveMember — state.members + activeMemberId resolver (app.js:7934 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function findActiveMember() {
    const members = Array.isArray(_state.members) ? _state.members : _normalizeMembersPayload(_state.members);

    if (!Array.isArray(_state.members)) {
      _state.members = members;
    }

    return members.find((member) => member.id === _state.activeMemberId) || null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // syncActiveMemberState — activeMember + latestMeasurement + measurement state
  // (app.js:7944 birebir; isMeasurementForMember callback ile)
  // ═══════════════════════════════════════════════════════════════════
  function syncActiveMemberState() {
    const activeMember = findActiveMember();
    _state.activeMember = activeMember || null;
    _state.latestMeasurement = activeMember?.measurements?.[0] || null;

    if (!_state.pendingTanitaMeasurement || !_isMeasurementForMember(_state.pendingTanitaMeasurement, activeMember)) {
      _state.activeMeasurementState = _state.latestMeasurement;
      _state.activeMeasurementSource = _state.latestMeasurement ? "saved" : null;
    }

    return _state.activeMember;
  }

  // ═══════════════════════════════════════════════════════════════════
  // loadMembers — loadStoredMembers wrapper (app.js:7957 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function loadMembers() {
    return _loadStoredMembers();
  }

  // ═══════════════════════════════════════════════════════════════════
  // persistMembers — persistStoredMembers + syncActiveMemberState (app.js:7961 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function persistMembers() {
    _state.members = _persistStoredMembers(_state.members, _state.activeMemberId);
    syncActiveMemberState();
  }

  // ═══════════════════════════════════════════════════════════════════
  // updateActiveMemberProfile — update + sync + render (app.js:7966 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function updateActiveMemberProfile(profile) {
    const nextMembers = _updateStoredActiveMemberProfile(_state.members, _state.activeMemberId, profile);

    if (!nextMembers) {
      return;
    }

    _state.members = nextMembers;
    syncActiveMemberState();
    _renderMemberWorkspace();
  }

  window.BSMMemberState = {
    init: init,
    findActiveMember: findActiveMember,
    syncActiveMemberState: syncActiveMemberState,
    loadMembers: loadMembers,
    persistMembers: persistMembers,
    updateActiveMemberProfile: updateActiveMemberProfile,
  };
})();
