(function () {
  "use strict";

  // BSM-UX-004h: Basit / Profesyonel görünüm yoğunluğu (view density).
  // Global tercih; yalnızca 4 içerik-disclosure'ı yönetir. Aksiyon menüleri,
  // curated accordion ve teknik nested details ASLA yönetilmez.
  //
  // Self-init: app.js'ten SONRA yüklenir. app.js initialize() senkron çalıştığı
  // için (prepareOutputLayout + preparePremiumMeasurementLayout bootstrap'ta),
  // bu modül yüklendiğinde whitelist details DOM'da hazırdır. app.js'e dokunulmaz.
  //
  // Davranış: mod yalnızca (a) sayfa yüklemede ve (b) toggle değişiminde uygulanır.
  // Router navigasyonunda re-apply YOK → kullanıcının manuel aç/kapatması korunur.

  var STORAGE_KEY = "formaplan-studio-view-density";
  var VALUES = ["simple", "pro"];

  // Yalnızca içerik-özeti disclosure'ları. Aksiyon/curated/teknik HARİÇ.
  var WHITELIST_SELECTORS = [
    ".output-detail-panel",          // Output Detaylı Analiz (UX-004a)
    ".measurement-detail-fields",    // Ölçüm Detaylı Ölçümler (UX-004b)
    ".dashboard-disclosure--activity", // Dashboard Son Aktivite (UX-004e)
    ".library-alphabet-disclosure",  // Library Alfabe (UX-004f)
  ];

  function normalize(value) {
    var v = String(value || "").toLowerCase();
    return VALUES.indexOf(v) !== -1 ? v : "simple";
  }

  function getViewDensity() {
    try {
      return normalize(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return "simple";
    }
  }

  function applyViewDensity(value) {
    var density = normalize(value);
    var open = density === "pro";
    WHITELIST_SELECTORS.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (details) {
        if (details && details.tagName && details.tagName.toLowerCase() === "details") {
          details.open = open;
        }
      });
    });
  }

  function syncToggleUi(value) {
    var density = normalize(value);
    document.querySelectorAll(".view-density-toggle__button").forEach(function (btn) {
      var isActive = btn.dataset.density === density;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setViewDensity(value) {
    var density = normalize(value);
    try {
      localStorage.setItem(STORAGE_KEY, density);
    } catch (e) {
      /* localStorage yok / kota */
    }
    syncToggleUi(density);
    applyViewDensity(density);
    return density;
  }

  function bindToggle() {
    var toggle = document.querySelector(".view-density-toggle");
    if (!toggle || toggle.dataset.densityBound === "true") {
      return;
    }
    toggle.dataset.densityBound = "true";
    toggle.addEventListener("click", function (event) {
      var button = event.target.closest(".view-density-toggle__button");
      if (!button || !button.dataset.density) {
        return;
      }
      setViewDensity(button.dataset.density);
    });
  }

  function initViewDensity() {
    var density = getViewDensity();
    bindToggle();
    syncToggleUi(density);
    applyViewDensity(density);
  }

  // Self-init: app.js initialize() senkron bittiği için details hazır.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initViewDensity);
  } else {
    initViewDensity();
  }

  window.BSMViewDensity = {
    get: getViewDensity,
    set: setViewDensity,
    apply: applyViewDensity,
    init: initViewDensity,
    STORAGE_KEY: STORAGE_KEY,
  };
})();
