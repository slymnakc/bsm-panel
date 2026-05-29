// memberSupabaseSync.js — Refactor Adım 4B.3.2 (STRICT MECHANICAL).
// Member Supabase sync + realtime app.js'den BIREBIR tasindi. Davranis degisikligi YOK;
// test mode bypass, activeMemberId koruma mantigi, mergeMemberLists/cacheMembersLocally
// akisi, realtime debounce (700ms), duplicate subscription guard birebir korundu.
//
// !!! app.js'de syncMembersFromSupabase + setupSupabaseRealtimeSync WRAPPER olarak kalir —
// initialize + auth-ready + BSMTestApi hook (triggerSupabaseSync/triggerRealtimeSetup)
// cagrı siteleri DEGISMEZ.
//
// KAPSAM ICI:
//   - syncMembersFromSupabase (test mode bypass + loadMembers + merge + cache + render)
//   - setupSupabaseRealtimeSync (subscribe + status/app_settings/member event + debounce)
//   - getSupabaseConnectedStatus (inline — sadece syncMembers kullaniyor)
//
// KAPSAM DISI (callback ile erisilir / app.js'de kalir):
//   - syncAppSettingsFromSupabase (LIBRARY domain — app_settings event'inde callback)
//   - renderMemberWorkspace / renderNutritionWorkspace / renderDashboard (orchestrator/cross-domain)
//
// GLOBAL direct erisim (DI degil): window.supabaseClient, window.BSMSupabaseSyncService,
//   window.setTimeout/clearTimeout — test mock'lari window.X uzerinden override eder.
//
// Dependency injection (12 callback + state):
//   state, isTestMode, renderDashboard, renderMemberWorkspace, renderNutritionWorkspace,
//   syncActiveMemberState, loadSupabaseMemberRecords, mergeMemberLists, cacheMembersLocally,
//   persistStoredMembers, saveActiveMemberId, syncAppSettingsFromSupabase

(function () {
  "use strict";

  var _state = null;
  var _isTestMode = function () { return false; };
  var _renderDashboard = function () {};
  var _renderMemberWorkspace = function () {};
  var _renderNutritionWorkspace = function () {};
  var _syncActiveMemberState = function () {};
  var _loadSupabaseMemberRecords = function () { return Promise.resolve([]); };
  var _mergeMemberLists = function (local) { return local; };
  var _cacheMembersLocally = function (members) { return members; };
  var _persistStoredMembers = function (members) { return members; };
  var _saveActiveMemberId = function () {};
  var _syncAppSettingsFromSupabase = function () {};

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.isTestMode === "function") _isTestMode = deps.isTestMode;
    if (typeof deps.renderDashboard === "function") _renderDashboard = deps.renderDashboard;
    if (typeof deps.renderMemberWorkspace === "function") _renderMemberWorkspace = deps.renderMemberWorkspace;
    if (typeof deps.renderNutritionWorkspace === "function") _renderNutritionWorkspace = deps.renderNutritionWorkspace;
    if (typeof deps.syncActiveMemberState === "function") _syncActiveMemberState = deps.syncActiveMemberState;
    if (typeof deps.loadSupabaseMemberRecords === "function") _loadSupabaseMemberRecords = deps.loadSupabaseMemberRecords;
    if (typeof deps.mergeMemberLists === "function") _mergeMemberLists = deps.mergeMemberLists;
    if (typeof deps.cacheMembersLocally === "function") _cacheMembersLocally = deps.cacheMembersLocally;
    if (typeof deps.persistStoredMembers === "function") _persistStoredMembers = deps.persistStoredMembers;
    if (typeof deps.saveActiveMemberId === "function") _saveActiveMemberId = deps.saveActiveMemberId;
    if (typeof deps.syncAppSettingsFromSupabase === "function") _syncAppSettingsFromSupabase = deps.syncAppSettingsFromSupabase;
  }

  // ═══════════════════════════════════════════════════════════════════
  // syncMembersFromSupabase — app.js:3245 birebir
  // ═══════════════════════════════════════════════════════════════════
  function syncMembersFromSupabase(options = {}) {
    // v1.4.4: Test mode aktifse Supabase sync'i bypass et — localStorage seed
    // member'lari Supabase realtime override'indan korunsun.
    if (_isTestMode()) {
      _state.supabaseStatus = "Test modu";
      return;
    }
    _state.supabaseStatus = window.supabaseClient?.from ? "Kontrol ediliyor" : "Kapalı";
    _renderDashboard();

    _loadSupabaseMemberRecords()
      .then((supabaseMembers) => {
        _state.supabaseStatus = window.supabaseClient?.from ? getSupabaseConnectedStatus() : "Kapalı";

        if (!supabaseMembers.length) {
          if (_state.members.length && window.BSMSupabaseSyncService?.isEnabled?.()) {
            _persistStoredMembers(_state.members, _state.activeMemberId);
          }

          _syncActiveMemberState();
          _renderMemberWorkspace();
          _renderNutritionWorkspace();
          _renderDashboard();
          return;
        }

        const mergedMembers = _mergeMemberLists(_state.members, supabaseMembers);

        if (!mergedMembers.length) {
          _renderDashboard();
          return;
        }

        _state.activeMemberId = mergedMembers.some((member) => member.id === _state.activeMemberId)
          ? _state.activeMemberId
          : mergedMembers[0]?.id || null;
        _saveActiveMemberId(_state.activeMemberId);
        _state.members = _cacheMembersLocally(mergedMembers, _state.activeMemberId);
        _syncActiveMemberState();
        _renderMemberWorkspace();
        _renderNutritionWorkspace();
        _renderDashboard();
      })
      .catch((error) => {
        _state.supabaseStatus = "Bağlantı hatası";
        _renderDashboard();
        console.warn("Supabase members sync error", error);
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // setupSupabaseRealtimeSync — app.js:3295 birebir
  // duplicate subscription guard + status/app_settings/member event + 700ms debounce
  // ═══════════════════════════════════════════════════════════════════
  function setupSupabaseRealtimeSync() {
    // v1.4.4: Test mode'da realtime subscription kurma — test seed'i korunsun
    if (_isTestMode()) return;
    if (_state.supabaseRealtimeSubscription || !window.BSMSupabaseSyncService?.subscribeToChanges) {
      return;
    }

    _state.supabaseRealtimeSubscription = window.BSMSupabaseSyncService.subscribeToChanges((event) => {
      if (event?.status) {
        _state.supabaseRealtimeActive = event.status === "SUBSCRIBED";
        _state.supabaseStatus = _state.supabaseRealtimeActive ? "Bağlı / Realtime aktif" : `Realtime: ${event.status}`;
        _renderDashboard();
        return;
      }

      if (event?.table === "app_settings") {
        _syncAppSettingsFromSupabase();
        return;
      }

      window.clearTimeout(_state.supabaseRealtimeTimer);
      _state.supabaseRealtimeTimer = window.setTimeout(() => {
        syncMembersFromSupabase({ source: "realtime" });
      }, 700);
    });
  }

  // ── getSupabaseConnectedStatus — inline (app.js:3322 birebir) ──────
  function getSupabaseConnectedStatus() {
    return _state.supabaseRealtimeActive ? "Bağlı / Realtime aktif" : "Bağlı";
  }

  window.BSMMemberSupabaseSync = {
    init: init,
    syncMembersFromSupabase: syncMembersFromSupabase,
    setupSupabaseRealtimeSync: setupSupabaseRealtimeSync,
  };
})();
