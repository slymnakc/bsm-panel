(function () {
  "use strict";

  // BSM Ekran Yönlendirici.
  // app.js'deki setActiveScreen / inferScreenFromHash / setWorkspaceView mantığını barındırır.
  // BSMRouter.init(config) çağrısından sonra navigate / inferFromHash / setView kullanılabilir.

  var _cfg = null;

  var VALID_SCREENS = [
    "members", "dashboard", "builder", "measurements",
    "nutrition", "library", "output", "measurement-report", "settings",
  ];

  var VALID_VIEWS = ["members", "history", "v3"];

  var HASH_MAP = {
    members: "#membersPanel",
    dashboard: "#dashboardPanel",
    builder: "#plannerForm",
    measurements: "#measurementsPanel",
    nutrition: "#nutritionPanel",
    library: "#libraryPanel",
    output: "#resultsSection",
    "measurement-report": "#measurementReportSection",
    settings: "#settingsPanel",
  };

  // ── Init ────────────────────────────────────────────────────

  function init(config) {
    _cfg = config || {};
  }

  // ── Ekran navigasyonu ────────────────────────────────────────

  function navigate(screen, options) {
    if (!_cfg) return false;

    options = options || {};
    var userTriggered = Boolean(options.userTriggered);
    var silent = Boolean(options.silent);

    var normalized = VALID_SCREENS.indexOf(screen) !== -1 ? screen : "members";

    if (normalized === "output") {
      var loaded = _cfg.loadLatestForOutput ? _cfg.loadLatestForOutput() : true;
      // v1.4.4 fix: Program yoksa bile sayfa AÇILSIN. Eski davranış (early return)
      // panel'i is-hidden kalıyordu → user "Üye Çıktısı" butonuna bastığında hiçbir
      // şey olmuyordu (silent mode'da sessiz iptal). Şimdi sayfa açılır, kullanıcı
      // boş state'i görür ve ne yapması gerektiğini anlar.
      if (!loaded && userTriggered && !silent && _cfg.showStatus) {
        _cfg.showStatus("Çıktı için önce üye programı oluşturun.", "error");
      }
      // Early return KALDIRILDI — panel toggle aşağıda devam etsin.
    }

    if (_cfg.state) _cfg.state.activeScreen = normalized;

    if (normalized === "measurement-report" && _cfg.onMeasurementReport) {
      _cfg.onMeasurementReport();
    }

    if (normalized === "measurements" && _cfg.onMeasurementTab) {
      _cfg.onMeasurementTab();
    }

    var panels = _cfg.screenPanels || [];
    for (var i = 0; i < panels.length; i++) {
      panels[i].classList.toggle("is-hidden", panels[i].dataset.screen !== normalized);
    }

    if (_cfg.studioNav) {
      _cfg.studioNav
        .querySelectorAll("button[data-screen-target]")
        .forEach(function (btn) {
          btn.classList.toggle("is-active", btn.dataset.screenTarget === normalized);
        });
    }

    var nextHash = HASH_MAP[normalized];
    if (nextHash && window.location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }

    return true;
  }

  // ── URL hash → ekran ismi ────────────────────────────────────

  function inferFromHash(hashValue) {
    var hash = String(hashValue || "").toLowerCase();
    if (hash.indexOf("memberspanel") !== -1) return "members";
    if (hash.indexOf("settingspanel") !== -1) return "settings";
    if (hash.indexOf("librarypanel") !== -1) return "library";
    if (hash.indexOf("nutritionpanel") !== -1) return "nutrition";
    if (hash.indexOf("resultssection") !== -1) return "output";
    if (hash.indexOf("measurementreportsection") !== -1) return "measurement-report";
    if (hash.indexOf("measurementspanel") !== -1) return "measurements";
    if (hash.indexOf("plannerform") !== -1 || hash.indexOf("member") !== -1 || hash.indexOf("measurement") !== -1) return "builder";
    return "members";
  }

  // ── Workspace sekme görünümü ─────────────────────────────────

  function setView(view) {
    if (!_cfg) return;

    var normalized = VALID_VIEWS.indexOf(view) !== -1 ? view : "members";
    if (_cfg.state) _cfg.state.activeWorkspaceView = normalized;

    var wPanels = _cfg.workspacePanels || [];
    for (var i = 0; i < wPanels.length; i++) {
      var panel = wPanels[i];
      if (!panel.closest(".member-workspace")) continue;
      panel.classList.toggle("is-hidden", panel.dataset.workspacePanel !== normalized);
    }

    if (_cfg.workspaceTabs) {
      _cfg.workspaceTabs
        .querySelectorAll("button[data-workspace-view]")
        .forEach(function (btn) {
          btn.classList.toggle("is-active", btn.dataset.workspaceView === normalized);
        });
    }
  }

  window.BSMRouter = { init: init, navigate: navigate, inferFromHash: inferFromHash, setView: setView };
})();
