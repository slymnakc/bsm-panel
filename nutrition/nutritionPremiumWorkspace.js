// nutritionPremiumWorkspace.js — Refactor Adım 3 part 3B2.
// renderNutritionPremiumWorkspace orkestrasyon fonksiyonu app.js'den extract edildi.
// Davranis degisikligi yok; cagri sirasi ve parametre seti birebir ayni.
//
// Bu modul SADECE orkestrasyon eder; render yapan alt fonksiyonlarin
// implementasyonlari farkli modullerde:
//   - renderNutritionHero          → nutritionPremiumRenderers.js (3B1)
//   - renderNutritionTimelineView  → nutritionRenderers.js        (3A)
//   - renderNutritionMacroView     → nutritionRenderers.js        (3A)
//   - renderNutritionTotalsBar     → nutritionRenderers.js        (3A)
//   - renderNutritionMacroChart    → nutritionRenderers.js        (3A)
//   - renderSupplementLibrary      → nutritionRenderers.js        (3A)
//   - renderSupplementSelected     → nutritionRenderers.js        (3A)
//   - renderNutritionSupplementTimeline → nutritionRenderers.js   (3A)
//   - renderNutritionMetaCard      → nutritionRenderers.js        (3A)
//   - renderNutritionPdfPreview    → nutritionPdfPipeline.js      (Part 2)
// Geri kalanlar (seedNutritionFormFromMember, tryAutoGenerateNutritionPlan,
// syncNutritionAccordionInputs, updateNutritionGenerateButtonLabel,
// applyNutritionActiveViewClass) hala app.js'de — callback olarak inject edilir.
//
// Dependency injection (init):
//   state                                → app state (closure)
//   getNutritionPanel                    → lazy DOM ref () => nutritionPanel
//   seedNutritionFormFromMember          → app.js fn (callback)
//   tryAutoGenerateNutritionPlan         → app.js fn (callback)
//   syncNutritionAccordionInputs         → app.js fn (callback)
//   updateNutritionGenerateButtonLabel   → app.js fn (callback)
//   applyNutritionActiveViewClass        → app.js fn (callback)
//   renderNutritionHero                  → from PremiumRenderers
//   renderNutritionTimelineView          → from Renderers
//   renderNutritionMacroView             → from Renderers
//   renderNutritionPdfPreview            → from PdfPipeline
//   renderNutritionTotalsBar             → from Renderers
//   renderNutritionMacroChart            → from Renderers
//   renderSupplementLibrary              → from Renderers
//   renderSupplementSelected             → from Renderers
//   renderNutritionSupplementTimeline    → from Renderers
//   renderNutritionMetaCard              → from Renderers

(function () {
  "use strict";

  var _state = null;
  var _getNutritionPanel = function () { return document.querySelector("#nutritionPanel"); };

  // App.js local fn callbacks (lazy via deps)
  var _seedNutritionFormFromMember = function () {};
  var _tryAutoGenerateNutritionPlan = function () { return null; };
  var _syncNutritionAccordionInputs = function () {};
  var _updateNutritionGenerateButtonLabel = function () {};
  var _applyNutritionActiveViewClass = function () {};

  // Already-extracted module fn refs
  var _renderNutritionHero = function () {};
  var _renderNutritionTimelineView = function () {};
  var _renderNutritionMacroView = function () {};
  var _renderNutritionPdfPreview = function () {};
  var _renderNutritionTotalsBar = function () {};
  var _renderNutritionMacroChart = function () {};
  var _renderSupplementLibrary = function () {};
  var _renderSupplementSelected = function () {};
  var _renderNutritionSupplementTimeline = function () {};
  var _renderNutritionMetaCard = function () {};

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.getNutritionPanel === "function") _getNutritionPanel = deps.getNutritionPanel;

    if (typeof deps.seedNutritionFormFromMember === "function") _seedNutritionFormFromMember = deps.seedNutritionFormFromMember;
    if (typeof deps.tryAutoGenerateNutritionPlan === "function") _tryAutoGenerateNutritionPlan = deps.tryAutoGenerateNutritionPlan;
    if (typeof deps.syncNutritionAccordionInputs === "function") _syncNutritionAccordionInputs = deps.syncNutritionAccordionInputs;
    if (typeof deps.updateNutritionGenerateButtonLabel === "function") _updateNutritionGenerateButtonLabel = deps.updateNutritionGenerateButtonLabel;
    if (typeof deps.applyNutritionActiveViewClass === "function") _applyNutritionActiveViewClass = deps.applyNutritionActiveViewClass;

    if (typeof deps.renderNutritionHero === "function") _renderNutritionHero = deps.renderNutritionHero;
    if (typeof deps.renderNutritionTimelineView === "function") _renderNutritionTimelineView = deps.renderNutritionTimelineView;
    if (typeof deps.renderNutritionMacroView === "function") _renderNutritionMacroView = deps.renderNutritionMacroView;
    if (typeof deps.renderNutritionPdfPreview === "function") _renderNutritionPdfPreview = deps.renderNutritionPdfPreview;
    if (typeof deps.renderNutritionTotalsBar === "function") _renderNutritionTotalsBar = deps.renderNutritionTotalsBar;
    if (typeof deps.renderNutritionMacroChart === "function") _renderNutritionMacroChart = deps.renderNutritionMacroChart;
    if (typeof deps.renderSupplementLibrary === "function") _renderSupplementLibrary = deps.renderSupplementLibrary;
    if (typeof deps.renderSupplementSelected === "function") _renderSupplementSelected = deps.renderSupplementSelected;
    if (typeof deps.renderNutritionSupplementTimeline === "function") _renderNutritionSupplementTimeline = deps.renderNutritionSupplementTimeline;
    if (typeof deps.renderNutritionMetaCard === "function") _renderNutritionMetaCard = deps.renderNutritionMetaCard;
  }

  // ═══════════════════════════════════════════════════════════
  // renderNutritionPremiumWorkspace — ana orkestrasyon
  // Member ve savedPlan parametrelerini alır, livePreview üretir,
  // tüm alt-renderer'ları sırayla çağırarak workspace'i günceller.
  // ═══════════════════════════════════════════════════════════
  function renderNutritionPremiumWorkspace(member, savedPlan) {
    var nutritionPanel = _getNutritionPanel();
    if (!nutritionPanel) return;

    // Eger uye degistiyse formu uyenin profilinden default'a sifirla
    if (member?.id && member.id !== _state.nutritionFormMemberId) {
      _state.nutritionFormMemberId = member.id;
      _seedNutritionFormFromMember(member, savedPlan);
    } else if (!member?.id && _state.nutritionFormMemberId) {
      _state.nutritionFormMemberId = null;
    }

    // v1.2.4: LIVE PREVIEW her render'da form state'inden yeniden uretilir.
    // savedPlan = state.activeNutritionPlan (Save butonu sonrasi). livePreview
    // form ayarlari degisince anlik guncellenir; meta status livePreview vs savedPlan
    // karsilastirmasi ile "Taslak" / "Aktif" gosterir.
    const livePreview = _tryAutoGenerateNutritionPlan(member) || savedPlan || null;

    _renderNutritionHero(member, livePreview);
    _syncNutritionAccordionInputs();
    _renderNutritionTimelineView(livePreview);
    _renderNutritionMacroView(livePreview);
    // v1.2.5: PDF preview artik 4 sayfa, member + livePreview + activeMeasurement bazli
    _renderNutritionPdfPreview(member, livePreview);
    _renderNutritionTotalsBar(livePreview);
    _renderNutritionMacroChart(livePreview);
    // v1.2.5: Yeni supplement UI — library kartlari + selected chips + timeline
    _renderSupplementLibrary();
    _renderSupplementSelected();
    _renderNutritionSupplementTimeline(livePreview);
    _renderNutritionMetaCard(member, savedPlan, livePreview);
    _updateNutritionGenerateButtonLabel(savedPlan);
    _applyNutritionActiveViewClass();
  }

  window.BSMNutritionPremiumWorkspace = {
    init: init,
    renderNutritionPremiumWorkspace: renderNutritionPremiumWorkspace,
  };
})();
