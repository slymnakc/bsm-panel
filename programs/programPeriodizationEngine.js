// programPeriodizationEngine.js — M1b.2 Periodization Engine
// SOT (Source of Truth) for periodization math. Hem UI wizard preview hem de
// state.activeProgram.weeks hydration aynı fonksiyondan beslenir → math drift
// imkansız.
//
// PURE MODULE:
//   - Hiç state mutation
//   - Hiç DOM erişimi
//   - Hiç async / Promise
//   - Sadece pure functions
//
// PUBLIC API:
//   - init(deps)                              — cloneData injection
//   - computeIntensityTable(macrocycle)       — SOT math (UI + engine ortak)
//   - generateWeeksFromForm(rawData, base)    — weeks[] üretir (state için)
//
// DEPENDENCIES (init):
//   - cloneData: deep clone helper (BSMCoreUtils.cloneData)
//                Fallback: JSON.parse(JSON.stringify(x))
//
// MATH MODEL:
//   Linear:  intensityFactor[i] = isDeload(i)
//              ? 0.65 (sabit deload)
//              : 1.0 + N_non_deload(i-1) × (deltaPercent/100)
//            (Deload progression'ı askıya alır — eski seviyeden devam)
//   Manual:  Tüm haftalarda intensityFactor=1.0, isDeload=false
//            (deloadCadence IGNORE edilir — Manual'de chip etkisiz)
//
// DELOAD CONSTANT: 0.65 (sport science %60-70 ortası, MVP'de sabit)

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _cloneData = function (x) {
    // Fallback: JSON deep clone (engine v2 sessions hep serializable)
    return x == null ? x : JSON.parse(JSON.stringify(x));
  };

  function init(deps) {
    if (deps && typeof deps.cloneData === "function") {
      _cloneData = deps.cloneData;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // computeIntensityTable — SOT math.
  //
  // Linear:
  //   - isDeload(i) = (deloadCadence > 0) AND (i % deloadCadence === 0)
  //   - Non-deload haftada intensity 1.0 + Σ(delta/100)
  //   - Deload haftalarda intensity 0.65 (sabit)
  //   - Progression deload haftalarda DURAKLAR (intensity değişmez)
  //
  // Manual:
  //   - Tüm haftalar {isDeload:false, intensityFactor:1.0}
  //   - deloadCadence IGNORE (Manual'de chip disable)
  //
  // Return shape: Array<{weekIndex, isDeload, intensityFactor}>
  // ═══════════════════════════════════════════════════════════════════
  function computeIntensityTable(macrocycle) {
    const safe = macrocycle && typeof macrocycle === "object" ? macrocycle : {};

    // Edge case coercion (defansif)
    var totalWeeks = Number(safe.totalWeeks);
    if (!Number.isFinite(totalWeeks) || totalWeeks < 1) totalWeeks = 1;
    if (totalWeeks > 12) totalWeeks = 12;
    totalWeeks = Math.floor(totalWeeks);

    const model = safe.model === "manual" ? "manual" : "linear";

    var deloadCadence = Number(safe.deloadCadence);
    if (!Number.isFinite(deloadCadence) || deloadCadence < 0) deloadCadence = 0;
    deloadCadence = Math.floor(deloadCadence);

    var deltaPercent = Number(safe.progressionRule && safe.progressionRule.deltaPercent);
    if (!Number.isFinite(deltaPercent) || deltaPercent <= 0) deltaPercent = 2.5;
    if (deltaPercent < 0.5) deltaPercent = 0.5;
    if (deltaPercent > 5.0) deltaPercent = 5.0;

    // ── Manual model: flat 1.0×, isDeload=false (deloadCadence ignore) ──
    if (model === "manual") {
      const rows = [];
      for (let i = 1; i <= totalWeeks; i++) {
        rows.push({
          weekIndex: i,
          isDeload: false,
          intensityFactor: 1.0,
        });
      }
      return rows;
    }

    // ── Linear model: progression + deload pause ──────────────────────
    const rows = [];
    let intensity = 1.0;
    for (let i = 1; i <= totalWeeks; i++) {
      const isDeload = deloadCadence > 0 && i % deloadCadence === 0;
      rows.push({
        weekIndex: i,
        isDeload,
        intensityFactor: isDeload ? 0.65 : intensity,
      });
      if (!isDeload) {
        intensity += deltaPercent / 100;
      }
      // Deload haftalarda intensity unchanged — non-deload weeks resume from same level
    }
    return rows;
  }

  // ═══════════════════════════════════════════════════════════════════
  // generateWeeksFromForm — form rawData + baseSessions → weeks[] hydration.
  //
  // Linear: her hafta için baseSessions deep clone + intensityFactor metadata
  // Manual: aynı yapı (deload mantığı yok, hepsi flat 1.0)
  //
  // MVP'de exercise weight × intensityFactor scaling YAPILMAZ. Sadece
  // intensityFactor field olarak weeks[i]'de tutulur. Renderer (M1b.3+) bu
  // field'ı okuyup yoğunluk badge'i gösterir.
  // ═══════════════════════════════════════════════════════════════════
  function generateWeeksFromForm(rawData, baseSessions) {
    const macro = rawData && rawData.macrocycle ? rawData.macrocycle : {};
    const safeBase = Array.isArray(baseSessions) ? baseSessions : [];
    const table = computeIntensityTable(macro);

    return table.map(function (row) {
      return {
        weekIndex: row.weekIndex,
        isDeload: row.isDeload,
        intensityFactor: row.intensityFactor,
        // Deep clone — her hafta bağımsız mutable copy
        // (M1b.8 macrocycle edit + per-week customization için zorunlu)
        sessions: _cloneData(safeBase),
      };
    });
  }

  window.BSMProgramPeriodizationEngine = {
    init: init,
    computeIntensityTable: computeIntensityTable,
    generateWeeksFromForm: generateWeeksFromForm,
  };
})();
