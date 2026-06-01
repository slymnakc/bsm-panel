// outputRenderers.js — Refactor Adım 4A.2.1.
// Output render wrapper katmani app.js'den extract edildi.
// Davranis degisikligi yok; signature/call sequence/DOM mutation birebir korundu.
//
// KAPSAM ICI (5 fonksiyon + 1 helper):
//   - prepareOutputLayout()         — Bootstrap DOM mutation (detail panel re-parent)
//   - renderProgramCover(program)   — Wrapper: BSMOutputUI.renderProgramCover + cover model
//   - renderOutputIntelligence(prog)— Wrapper: BSMOutputUI.renderOutputIntelligence + intel model
//   - renderNutritionOutput()       — Wrapper: BSMNutritionUI.renderOutputNutritionPlan
//   - getNutritionPlanForOutput()   — Plan resolver: state.activeNutritionPlan ↔ member fallback
//   - setResultCardTitle(card,title)— Inline helper (sadece prepareOutputLayout kullaniyor)
//
// KAPSAM DISI (app.js'de KALIYOR):
//   - renderProgram(program, options) — PROGRAM domain orchestrator. Output sadece
//     endpoint render tetikleyicisi. 4C sprintinde program/ domainine tasinacak.
//   - findActiveMember — state resolver, app.js'de bootstrap rolünde.
//   - normalizeNutritionPlan — BSMDataMigrations'tan destructure; cross-domain helper.
//
// MOVE HOST / KEEP OWNER stratejisi (renderNutritionOutput icin):
//   - Wrapper bu modüle TASINDI (host degisikligi).
//   - Gercek render owner: BSMNutritionUI.renderOutputNutritionPlan
//     (ui/nutrition-ui.js:535) — DOKUNULMADI.
//   - Signature korundu: (target, plan, labelMaps, escapeHtml) — plan parametresi
//     halen UNUSED (kasitli tasarim: Workout PDF yalniz antrenman plani).
//   - Static notice davranisi 14-spec ile kilitli; bu sprint o davranisi degistirmez.
//
// PERSISTENCE / SIDE EFFECT YOK:
// Bu modüldeki tüm fn'ler READ-ONLY state'ten okur veya DOM mutate eder.
// state mutation yok, localStorage yok, fetch yok.
//
// Dependency injection (11 madde — koddan dogrulanmis):
//   state                            -> app state (closure)
//   domRefs                          -> { resultsSection, programOverview, weeklyPlan,
//                                          coachNote, aiReportSummary, nextControlReport,
//                                          outputWarnings, muscleCoverage, progressionPlan,
//                                          guidanceBlock, coverBrand, coverMember,
//                                          coverMeta, coverTrainer, outputNutritionPlan }
//                                          (14 DOM ref)
//   renderProgramCoverUi             -> BSMOutputUI.renderProgramCover
//   renderOutputIntelligenceUi       -> BSMOutputUI.renderOutputIntelligence
//   renderOutputNutritionPlanUi      -> BSMNutritionUI.renderOutputNutritionPlan
//   buildOutputIntelligenceModelService -> BSMOutputModelService.buildOutputIntelligenceModel
//   buildProgramCoverModelService    -> BSMOutputModelService.buildProgramCoverModel
//   normalizeNutritionPlan           -> BSMDataMigrations.normalizePlan (for nutrition plan)
//   findActiveMember                 -> app.js fn (callback)
//   labelMaps                        -> BSMLabelData.labelMaps
//   escapeHtml                       -> BSMCoreUtils

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _state = null;
  var _domRefs = {};
  var _renderProgramCoverUi = function () {};
  var _renderOutputIntelligenceUi = function () {};
  var _renderOutputNutritionPlanUi = function () {};
  var _buildOutputIntelligenceModelService = function () { return {}; };
  var _buildProgramCoverModelService = function () { return {}; };
  var _normalizeNutritionPlan = function (v) { return v || null; };
  var _findActiveMember = function () { return null; };
  var _labelMaps = {};
  var _escapeHtml = function (s) { return String(s == null ? "" : s); };

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (deps.domRefs) _domRefs = deps.domRefs;
    if (typeof deps.renderProgramCoverUi === "function") _renderProgramCoverUi = deps.renderProgramCoverUi;
    if (typeof deps.renderOutputIntelligenceUi === "function") _renderOutputIntelligenceUi = deps.renderOutputIntelligenceUi;
    if (typeof deps.renderOutputNutritionPlanUi === "function") _renderOutputNutritionPlanUi = deps.renderOutputNutritionPlanUi;
    if (typeof deps.buildOutputIntelligenceModelService === "function") _buildOutputIntelligenceModelService = deps.buildOutputIntelligenceModelService;
    if (typeof deps.buildProgramCoverModelService === "function") _buildProgramCoverModelService = deps.buildProgramCoverModelService;
    if (typeof deps.normalizeNutritionPlan === "function") _normalizeNutritionPlan = deps.normalizeNutritionPlan;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (deps.labelMaps) _labelMaps = deps.labelMaps;
    if (typeof deps.escapeHtml === "function") _escapeHtml = deps.escapeHtml;
  }

  // ═══════════════════════════════════════════════════════════════════
  // setResultCardTitle — inline helper (sadece prepareOutputLayout kullaniyor)
  // app.js:3052'den birebir kopyalandi; app.js'den silindi.
  // ═══════════════════════════════════════════════════════════════════
  function setResultCardTitle(card, title) {
    const titleElement = card?.querySelector("h3");

    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // prepareOutputLayout — Bootstrap DOM mutation.
  //
  // Side effects (birebir korundu):
  //   1. Idempotent: panel zaten varsa erken return
  //   2. summaryCard / programCard class set + title rename
  //   3. detailCards collect (7 result-card)
  //   4. <details class="output-detail-panel"> create + grid append
  //   5. programCard.nextSibling pivot ile insert (veya appendChild)
  // ═══════════════════════════════════════════════════════════════════
  function prepareOutputLayout() {
    const resultsSection = _domRefs.resultsSection;
    const programOverview = _domRefs.programOverview;
    const weeklyPlan = _domRefs.weeklyPlan;
    const grid = resultsSection?.querySelector(".results__grid");

    if (!grid || grid.querySelector(".output-detail-panel")) {
      return;
    }

    const summaryCard = programOverview?.closest(".result-card");
    const programCard = weeklyPlan?.closest(".result-card");
    const detailTargets = [
      _domRefs.coachNote,
      _domRefs.aiReportSummary,
      _domRefs.nextControlReport,
      _domRefs.outputWarnings,
      _domRefs.muscleCoverage,
      _domRefs.progressionPlan,
      _domRefs.guidanceBlock,
    ];
    const detailCards = detailTargets.map((target) => target?.closest(".result-card")).filter(Boolean);

    summaryCard?.classList.add("output-summary-card");
    programCard?.classList.add("output-program-card");
    setResultCardTitle(summaryCard, "Üye Program Özeti");
    setResultCardTitle(programCard, "Haftalık Üye Antrenman Planı");

    const detailPanel = document.createElement("details");
    detailPanel.className = "result-card result-card--wide output-detail-panel";
    detailPanel.innerHTML = `
    <summary>
      <span>Detaylı Analiz</span>
      <small>Antrenör için teknik notlar, AI değerlendirme ve takip bilgileri</small>
    </summary>
    <div class="output-detail-grid"></div>
  `;

    const detailGrid = detailPanel.querySelector(".output-detail-grid");
    detailCards.forEach((card) => {
      card.classList.add("output-detail-card");
      detailGrid.appendChild(card);
    });

    if (programCard?.nextSibling) {
      grid.insertBefore(detailPanel, programCard.nextSibling);
    } else {
      grid.appendChild(detailPanel);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderProgramCover — Wrapper.
  // BSMOutputUI.renderProgramCover'a delege; cover model builder labelMaps ile.
  // ═══════════════════════════════════════════════════════════════════
  function renderProgramCover(program) {
    _renderProgramCoverUi(
      {
        coverBrand: _domRefs.coverBrand,
        coverMember: _domRefs.coverMember,
        coverMeta: _domRefs.coverMeta,
        coverTrainer: _domRefs.coverTrainer,
        // M1b.3: Macrocycle band targets. domRefs'ten lazy alınır (init zamanı dolu).
        coverMacrocycle: _domRefs.coverMacrocycle,
        coverMacroTitle: _domRefs.coverMacroTitle,
        coverMacroCurrent: _domRefs.coverMacroCurrent,
        coverMacroProgressFill: _domRefs.coverMacroProgressFill,
        coverMacroProgressBar: _domRefs.coverMacroProgressBar,
        coverMacroNextDeload: _domRefs.coverMacroNextDeload,
      },
      _buildProgramCoverModelService(program, {
        labelMaps: _labelMaps,
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderOutputIntelligence — Wrapper.
  // BSMOutputUI.renderOutputIntelligence'a delege; intelligence model builder ile.
  // ═══════════════════════════════════════════════════════════════════
  function renderOutputIntelligence(program) {
    _renderOutputIntelligenceUi(
      {
        aiReportSummary: _domRefs.aiReportSummary,
        nextControlReport: _domRefs.nextControlReport,
        outputWarnings: _domRefs.outputWarnings,
      },
      _buildOutputIntelligenceModelService(program),
      _escapeHtml,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderNutritionOutput — MOVE HOST / KEEP OWNER.
  //
  // Wrapper bu modüle tasindi (host); render owner BSMNutritionUI'da kaldi.
  // BSMNutritionUI.renderOutputNutritionPlan signature: (target, plan, labelMaps, escapeHtml).
  // Plan parametresi UNUSED (static notice davranisi kasitli, 14-spec ile kilitli).
  // ═══════════════════════════════════════════════════════════════════
  function renderNutritionOutput() {
    const plan = getNutritionPlanForOutput();
    _renderOutputNutritionPlanUi(_domRefs.outputNutritionPlan, plan, _labelMaps, _escapeHtml);
  }

  // ═══════════════════════════════════════════════════════════════════
  // getNutritionPlanForOutput — Plan resolver.
  // state.activeNutritionPlan ?? member.nutritionPlan ?? member.nutritionPlans[0]
  // (app.js:8559-8567 birebir korundu).
  // ═══════════════════════════════════════════════════════════════════
  function getNutritionPlanForOutput() {
    const activeMember = _findActiveMember();

    return (
      _normalizeNutritionPlan(_state.activeNutritionPlan) ||
      _normalizeNutritionPlan(activeMember?.nutritionPlan || activeMember?.nutritionPlans?.[0]) ||
      null
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  window.BSMOutputRenderers = {
    init: init,
    prepareOutputLayout: prepareOutputLayout,
    renderProgramCover: renderProgramCover,
    renderOutputIntelligence: renderOutputIntelligence,
    renderNutritionOutput: renderNutritionOutput,
    getNutritionPlanForOutput: getNutritionPlanForOutput,
  };
})();
