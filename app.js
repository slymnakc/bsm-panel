const {
  schemaVersion,
  storageKeys,
  normalizeFormPayload,
  normalizePlanPayload,
  normalizeMeasurementPayload,
  normalizeMembersPayload,
  storeBackupSnapshot,
  loadBackupHistory,
  saveToStorage,
  loadFromStorage,
  extractMembersFromBackup,
  normalizeImportedMembers,
} = window.BSMStorageService;

// ── BSM Build Version ───────────────────────────────────────────
// Tek kaynak: tüm cache busting (?v=) ve console banner buradan turetilir.
// Bumping: ozellik eklemelerinde minor, kucuk duzeltmelerde patch artirilir.
// duzeltmelerde, major (1.x -> 2.0) breaking change'lerde.
const BSM_BUILD_VERSION = "1.2.1";

console.log("APP VERSION: v" + BSM_BUILD_VERSION);
console.log("UI/UX SIMPLIFICATION VERSION: v" + BSM_BUILD_VERSION);
console.log("NUTRITION PRO VERSION: v" + BSM_BUILD_VERSION + "-member-supplement-wizard");

// ── BSM Wizard + Avatar Palette Sabitleri ───────────────────────
// HOTFIX: Bu sabitler dosyanin asagisindaydi (line ~2027 ve ~2870).
// initialize() -> syncStartupUi() -> renderMemberWorkspace() top-level'da
// calistirildigindan, BSM_WIZARD_STEPS / BSM_AVATAR_PALETTE'e erisen render
// fonksiyonlari const'larin INITIALIZE edilmedigi anda (Temporal Dead Zone)
// patliyordu. Sabitleri yukari aldik; fonksiyon davranisi degismedi.
//
// Fresh browser'da localStorage bos oldugu icin findActiveMember() null doner
// ve renderWizardBar early-return yapar -> bu sebeple smoke testlerde
// yakalanamadi. 16 uyeli gercek kullanicida zincir kiriliyordu.

const BSM_WIZARD_STEPS = [
  { id: "olcum",    label: "Ölçüm",       screen: "measurements" },
  { id: "program",  label: "Program",     screen: "builder"      },
  { id: "beslenme", label: "Beslenme",    screen: "nutrition"    },
  { id: "pdf",      label: "PDF Çıktısı", screen: "output"       },
  { id: "mail",     label: "Mail Gönder", screen: "output"       },
];

// F5e: Premium pastel renk paleti (slate / blue / teal / amber / orange / rose).
// Üye ID veya isim deterministik hash → sabit renk. Rainbow/neon yok.
const BSM_AVATAR_PALETTE = [
  { from: "#475569", to: "#64748b" }, // slate
  { from: "#1e5baa", to: "#3b82f6" }, // blue
  { from: "#0e7490", to: "#06b6d4" }, // teal
  { from: "#b45309", to: "#f59e0b" }, // amber
  { from: "#c2410c", to: "#f97316" }, // orange
  { from: "#9f1239", to: "#e11d48" }, // rose
];
console.log("UI VERSION: redesign-v1");
console.log("TANITA REPORT VERSION: ultra-pro-v2-compact-3page");
console.log("MEASUREMENT TAB VERSION: v1");
console.log("MEASUREMENT CSV UI VERSION: premium-csv-v2");
console.log("NUTRITION REPORT VERSION: dietitian-pro-v1");
console.log("DASHBOARD VERSION: command-center-v1");
console.log("SUPABASE SYNC VERSION: supabase-first-v1");
console.log("SUPABASE SYNC SERVICE READY:", Boolean(window.BSMSupabaseSyncService?.loadMembers));

const {
  findActiveMember: findActiveMemberRecord,
  loadMembers: loadStoredMembers,
  loadSupabaseMembers: loadSupabaseMemberRecords,
  mergeMemberLists,
  cacheMembersLocally,
  persistMembers: persistStoredMembers,
  saveMeasurementToSupabase,
  updateActiveMemberProfile: updateStoredActiveMemberProfile,
  loadActiveMemberId,
  saveActiveMemberId,
  loadLastForm,
  saveLastForm,
  loadLastPlan,
  saveLastPlan,
  loadMemberSort,
  saveMemberSort,
} = window.BSMMemberService;
const {
  buildActivityItems: buildActivityItemsService,
  buildFallbackMemberAnalysis: buildFallbackMemberAnalysisService,
  buildFallbackAutomationSummary: buildFallbackAutomationSummaryService,
  buildCoachTasks: buildCoachTasksService,
  buildCoachQuickPanelModel: buildCoachQuickPanelModelService,
} = window.BSMDashboardService;
const {
  validateFormData: validateFormDataService,
  buildFormValidationErrors: buildFormValidationErrorsService,
  validateMeasurementData: validateMeasurementDataService,
} = window.BSMValidationService;
const {
  buildLiveSummaryModel: buildLiveSummaryModelService,
  describeProgram: describeProgramService,
  buildProgression: buildProgressionService,
  buildGuidance: buildGuidanceService,
} = window.BSMProgramContentService;
const {
  matchesProgramMemberData: matchesProgramMemberDataService,
  findMatchingMemberRecord: findMatchingMemberRecordService,
  buildProgramMemberRecord: buildProgramMemberRecordService,
} = window.BSMProgramMemberService;
const {
  resolveEffectiveStyle: resolveEffectiveStyleService,
  resolveSplit: resolveSplitService,
  buildExerciseBlocks: buildExerciseBlocksService,
  recommendStructure: recommendStructureService,
  buildSessionNote: buildSessionNoteService,
} = window.BSMProgramStructureService;
const {
  buildProgramTitle: buildProgramTitleService,
  buildProgramOverview: buildProgramOverviewService,
  buildMuscleCoverage: buildMuscleCoverageService,
  buildFallbackProgramIntelligence: buildFallbackProgramIntelligenceService,
} = window.BSMProgramSummaryService;
const {
  buildProgramDocument: buildProgramDocumentService,
} = window.BSMProgramAssemblyService;
const {
  buildProgramSectionsModel: buildProgramSectionsModelService,
  buildOutputIntelligenceModel: buildOutputIntelligenceModelService,
  buildProgramCoverModel: buildProgramCoverModelService,
} = window.BSMOutputModelService;
const {
  buildTrainingReport: buildTrainingReportService,
  nutritionNotice: trainingNutritionNotice,
} = window.BSMTrainingOutputService || {};
const {
  getExerciseSlotCount: getExerciseSlotCountService,
  isEquipmentAllowed: isEquipmentAllowedService,
  isExerciseAllowed: isExerciseAllowedService,
  buildPrescription: buildPrescriptionService,
  buildRest: buildRestService,
  buildTempo: buildTempoService,
  selectExerciseForGroup: selectExerciseForGroupService,
  selectExercisesForSession: selectExercisesForSessionService,
} = window.BSMSessionExerciseService;
const {
  buildSessionDraft: buildSessionDraftService,
} = window.BSMSessionAssemblyService;
const {
  buildWarmup: buildWarmupService,
  buildCooldown: buildCooldownService,
  buildCardioBlock: buildCardioBlockService,
} = window.BSMSessionSupportService;
const {
  buildNutritionPlan,
  normalizeNutritionPlan,
} = window.BSMNutritionService;
const {
  buildExerciseMedia,
} = window.BSMExerciseMediaService;
const {
  readTanitaCsvFile,
  parseTanitaCsv,
  selectBestRecord: selectBestTanitaRecord,
  buildTanitaMeasurement,
  buildTanitaPreviewModel,
} = window.BSMTanitaCsvService || {};

const state = {
  _members: [],
  get members() {
    return this._members;
  },
  set members(value) {
    this._members = normalizeMembersPayload(value);
    console.log("STATE MEMBERS TYPE:", Array.isArray(this._members), this._members);
  },
  activeMemberId: null,
  activeMember: null,
  latestMeasurement: null,
  activeProgram: null,
  activeAlphabetLetter: "all",
  activeScreen: "members",
  activeWorkspaceView: "members",
  activeMemberSort: "recent-update",
  activeWizardStep: "olcum",
  pendingTanitaMeasurement: null,
  activeMeasurementState: null,
  activeMeasurementSource: null,
  measurementHistoryFilters: {
    view: "all",
    range: "all",
    compare: "previous",
  },
  programEditMode: false,
  programDefaultSnapshot: null,
  activeNutritionPlan: null,
  activeNutritionMemberId: null,
  customExercises: [],
  hiddenExerciseIds: [],
  supabaseStatus: "Kontrol ediliyor",
  supabaseRealtimeActive: false,
  supabaseRealtimeSubscription: null,
  supabaseRealtimeTimer: null,
};

const {
  turkishAlphabet,
  dayMeta,
  muscleGroups,
  equipmentLabels,
  allowedEquipmentByScope,
  programStyleOptions,
  trainingSystemOptions,
  splitNameMap,
  splitTemplates,
} = window.BSMOptionData;
const { labelMaps } = window.BSMLabelData;
const { examplePreset } = window.BSMPresetData;
const { repetitionModelOptions = [], repetitionPresets = [] } = window.BSMRepetitionPresetData || {};
const { exerciseGroups, exerciseExpansionBlueprints, exerciseLibrary: baseExerciseLibrary } = window.BSMExerciseData;
const exerciseLibrary = [...baseExerciseLibrary];
const {
  formatDashboardDate,
  formatFileDate,
  buildCsvContent,
  downloadFile,
  rotateArray,
  makeId,
  cloneData,
  titleCase,
  numberOrEmpty,
  getTodayInputValue,
  normalizeText,
  escapeHtml,
} = window.BSMCoreUtils;
const {
  getMuscleLabel,
  getDayLabel,
  labelExerciseKind,
  labelExerciseLevel,
} = window.BSMLabelUtils;
const {
  renderDashboardMetrics: renderDashboardMetricsUi,
  renderDashboardActivity: renderDashboardActivityUi,
  renderCoachAlerts: renderCoachAlertsUi,
  renderDashboardFocus: renderDashboardFocusUi,
  renderV3DashboardCalendar: renderV3DashboardCalendarUi,
  renderCoachTasks: renderCoachTasksUi,
  renderCoachQuickPanel: renderCoachQuickPanelUi,
  renderBackupMeta: renderBackupMetaUi,
} = window.BSMDashboardUI;
const { renderBodyAnalysisReport: renderBodyAnalysisReportUi } = window.BSMAlertsUI;
const {
  renderActiveMemberProfile: renderActiveMemberProfileUi,
  renderMemberList: renderMemberListUi,
  renderMeasurementHistory: renderMeasurementHistoryUi,
  renderProgramHistory: renderProgramHistoryUi,
  renderV3CoachingPanel: renderV3CoachingPanelUi,
} = window.BSMMemberUI;
const { renderLibraryResults: renderLibraryResultsUi, syncLibraryTabs: syncLibraryTabsUi } = window.BSMLibraryUI;
const {
  buildWeeklyPlanHtml: buildWeeklyPlanHtmlUi,
  renderProgramCover: renderProgramCoverUi,
  renderProgramSections: renderProgramSectionsUi,
  renderOutputIntelligence: renderOutputIntelligenceUi,
  renderTrainingReport: renderTrainingReportUi,
} = window.BSMOutputUI;
const {
  prepareNutritionControls,
  renderNutritionWorkspace: renderNutritionWorkspaceUi,
  renderOutputNutritionPlan: renderOutputNutritionPlanUi,
  collectNutritionPlanEdits,
  collectSupplementPreferences,
} = window.BSMNutritionUI;
const { createFormHandlers, bindFormHandlers } = window.BSMFormHandlers;
const { createNavigationHandlers, bindNavigationHandlers } = window.BSMNavigationHandlers;
const { createMemberHandlers, bindMemberHandlers } = window.BSMMemberHandlers;
const { createOutputHandlers, bindOutputHandlers } = window.BSMOutputHandlers;
const { createNutritionHandlers, bindNutritionHandlers } = window.BSMNutritionHandlers;
const programStyleOptionMap = Object.fromEntries(programStyleOptions.map((option) => [option.value, option]));
const trainingSystemMap = Object.fromEntries(trainingSystemOptions.map((option) => [option.value, option]));

function normalizeProgramStyleValue(value) {
  if (programStyleOptionMap[value]) {
    return value;
  }

  if (splitTemplates[value]) {
    return value;
  }

  return "auto";
}

function resolveProgramStyleTemplate(programStyle, dayCount) {
  const normalized = normalizeProgramStyleValue(programStyle);
  const template = programStyleOptionMap[normalized]?.template || normalized;

  if (dayCount < 3 && ["push-pull-legs", "hypertrophy"].includes(template)) {
    return "full-body";
  }

  return splitTemplates[template] ? template : "full-body";
}

function getProgramStyleLabel(programStyle) {
  const normalized = normalizeProgramStyleValue(programStyle);
  return programStyleOptionMap[normalized]?.label || splitNameMap[normalized] || labelMaps.programStyle[normalized] || "Program tipi";
}

function getProgramStyleSummaryLabel(data) {
  if (data.programStyle === "auto") {
    const autoTemplate = resolveEffectiveStyle(data);
    const autoLabel = splitNameMap[autoTemplate] || getProgramStyleLabel(autoTemplate);
    return `${getProgramStyleLabel("auto")} (${autoLabel})`;
  }

  return getProgramStyleLabel(data.programStyle);
}

function normalizeTrainingSystem(value) {
  return trainingSystemMap[value] ? value : "standard";
}

function getTrainingSystemLabel(value) {
  return trainingSystemMap[normalizeTrainingSystem(value)]?.label || trainingSystemMap.standard.label;
}

function getRepetitionModelLabel(value) {
  return repetitionModelOptions.find((option) => option.value === normalizeRepModel(value))?.label || "Fixed";
}

function segmentDiffPercent(a, b) {
  if (a === "" || b === "" || a === undefined || b === undefined || Number(a) === 0 || Number(b) === 0) {
    return null;
  }
  const max = Math.max(Number(a), Number(b));
  const min = Math.min(Number(a), Number(b));
  return ((max - min) / max) * 100;
}

const form = document.querySelector("#plannerForm");
const formStatus = document.querySelector("#formStatus");
const repetitionBuilder = document.querySelector(".repetition-builder");
const defaultSetCount = document.querySelector("#defaultSetCount");
const defaultRepModel = document.querySelector("#defaultRepModel");
const defaultRepPreset = document.querySelector("#defaultRepPreset");
const defaultRestTime = document.querySelector("#defaultRestTime");
const defaultTempo = document.querySelector("#defaultTempo");
const customRepPattern = document.querySelector("#customRepPattern");
const repTemplatePreview = document.querySelector("#repTemplatePreview");
const liveSummary = document.querySelector("#liveSummary");
const workflowAssistant = document.querySelector("#workflowAssistant");
const resultsSection = document.querySelector("#resultsSection");
const resultsTitle = document.querySelector("#resultsTitle");
const programOverview = document.querySelector("#programOverview");
const coachNote = document.querySelector("#coachNote");
const weeklyPlan = document.querySelector("#weeklyPlan");
const progressionPlan = document.querySelector("#progressionPlan");
const guidanceBlock = document.querySelector("#guidanceBlock");
const muscleCoverage = document.querySelector("#muscleCoverage");
const fillExampleButton = document.querySelector("#fillExampleButton");
const loadSavedButton = document.querySelector("#loadSavedButton");
const saveMemberButton = document.querySelector("#saveMemberButton");
const newMemberButton = document.querySelector("#newMemberButton");
const saveProgramButton = document.querySelector("#saveProgramButton");
const toggleProgramEditButton = document.querySelector("#toggleProgramEditButton");
const saveProgramEditsButton = document.querySelector("#saveProgramEditsButton");
const resetProgramEditsButton = document.querySelector("#resetProgramEditsButton");
const programEditToolbar = document.querySelector("#programEditToolbar");
const programEditStatus = document.querySelector("#programEditStatus");
const copyPlanButton = document.querySelector("#copyPlanButton");
const printPlanButton = document.querySelector("#printPlanButton");
const programPdfActionButton = document.querySelector("#programPdfActionButton");
const downloadLiveProgramButton = document.querySelector("#downloadLiveProgramButton");
const sendProgramMailButton = document.querySelector("#sendProgramMailButton");
const programDeliveryStatus = document.querySelector("#programDeliveryStatus");
const programMailHistory = document.querySelector("#programMailHistory");
const priorityMuscle = document.querySelector("#priorityMuscle");
const libraryGroupFilter = document.querySelector("#libraryGroupFilter");
const libraryEquipmentFilter = document.querySelector("#libraryEquipmentFilter");
const exerciseSearch = document.querySelector("#exerciseSearch");
const muscleGroupTabs = document.querySelector("#muscleGroupTabs");
const alphabetTabs = document.querySelector("#alphabetTabs");
const exerciseLibraryEl = document.querySelector("#exerciseLibrary");
const libraryCount = document.querySelector("#libraryCount");
const findExerciseButton = document.querySelector("#findExerciseButton");
const clearExerciseSearchButton = document.querySelector("#clearExerciseSearchButton");
const customExerciseName = document.querySelector("#customExerciseName");
const customExerciseGroup = document.querySelector("#customExerciseGroup");
const customExerciseEquipment = document.querySelector("#customExerciseEquipment");
const customExerciseKind = document.querySelector("#customExerciseKind");
const customExerciseLevel = document.querySelector("#customExerciseLevel");
const customExerciseGifUrl = document.querySelector("#customExerciseGifUrl");
const customExerciseCue = document.querySelector("#customExerciseCue");
const addCustomExerciseButton = document.querySelector("#addCustomExerciseButton");
const resetCustomExerciseFormButton = document.querySelector("#resetCustomExerciseFormButton");
const restoreHiddenExercisesButton = document.querySelector("#restoreHiddenExercisesButton");
const customExerciseStatus = document.querySelector("#customExerciseStatus");
const customExerciseList = document.querySelector("#customExerciseList");
const exerciseGifModal = document.querySelector("#exerciseGifModal");
const exerciseGifModalImage = document.querySelector("#exerciseGifModalImage");
const exerciseGifModalTitle = document.querySelector("#exerciseGifModalTitle");
const exerciseGifModalGroup = document.querySelector("#exerciseGifModalGroup");
const studioNav = document.querySelector(".studio-nav");
const screenPanels = [...document.querySelectorAll("[data-screen]")];
const measurementsPanel = document.querySelector("#measurementsPanel");
const measurementTabMount = document.querySelector("#measurementTabMount");
const measurementTabNotice = document.querySelector("#measurementTabNotice");
const measurementActiveMemberCard = document.querySelector("#measurementActiveMemberCard");
const openMeasurementTabButton = document.querySelector("#openMeasurementTabButton");
const nutritionPanel = document.querySelector("#nutritionPanel");
const nutritionMemberSummary = document.querySelector("#nutritionMemberSummary");
const nutritionPlanEditor = document.querySelector("#nutritionPlanEditor");
const generateNutritionButton = document.querySelector("#generateNutritionButton");
const saveNutritionButton = document.querySelector("#saveNutritionButton");
const printNutritionButton = document.querySelector("#printNutritionButton");
const workspaceTabs = document.querySelector("#workspaceTabs");
const workspacePanels = [...document.querySelectorAll("[data-workspace-panel]")];
const memberSearch = document.querySelector("#memberSearch");
const memberSort = document.querySelector("#memberSort");
const memberList = document.querySelector("#memberList");
const memberCount = document.querySelector("#memberCount");
const dashboardToday = document.querySelector("#dashboardToday");
const dashboardMemberCount = document.querySelector("#dashboardMemberCount");
const dashboardProgramCount = document.querySelector("#dashboardProgramCount");
const dashboardMeasurementCount = document.querySelector("#dashboardMeasurementCount");
const dashboardActiveMember = document.querySelector("#dashboardActiveMember");
const dashboardActiveMemberMeta = document.querySelector("#dashboardActiveMemberMeta");
const dashboardRiskMemberCount = document.querySelector("#dashboardRiskMemberCount");
const dashboardMeasurementDueCount = document.querySelector("#dashboardMeasurementDueCount");
const dashboardProgramDueCount = document.querySelector("#dashboardProgramDueCount");
const dashboardLast7ActivityCount = document.querySelector("#dashboardLast7ActivityCount");
const dashboardActivity = document.querySelector("#dashboardActivity");
const dashboardStatusSummary = document.querySelector("#dashboardStatusSummary");
const dashboardSupabaseStatus = document.querySelector("#dashboardSupabaseStatus");
const dashboardMemberTrend = document.querySelector("#dashboardMemberTrend");
const dashboardMeasurementDueTrend = document.querySelector("#dashboardMeasurementDueTrend");
const dashboardProgramDueTrend = document.querySelector("#dashboardProgramDueTrend");
const dashboardActiveMemberTrend = document.querySelector("#dashboardActiveMemberTrend");
const dashboardFocusPanel = document.querySelector("#dashboardFocusPanel");
const coachAlertsPanel = document.querySelector("#coachAlertsPanel");
const coachTaskPanel = document.querySelector("#coachTaskPanel");
const v3DashboardCalendar = document.querySelector("#v3DashboardCalendar");
const coachQuickPanel = document.querySelector("#coachQuickPanel");
const backupMeta = document.querySelector("#backupMeta");
const downloadBackupButton = document.querySelector("#downloadBackupButton");
const restoreBackupButton = document.querySelector("#restoreBackupButton");
const exportMembersCsvButton = document.querySelector("#exportMembersCsvButton");
const restoreAutoBackupButton = document.querySelector("#restoreAutoBackupButton");
const backupFileInput = document.querySelector("#backupFileInput");
const activeMemberProfile = document.querySelector("#activeMemberProfile");
const membersPanel = document.querySelector("#membersPanel");
const coverBrand = document.querySelector("#coverBrand");
const coverMember = document.querySelector("#coverMember");
const coverMeta = document.querySelector("#coverMeta");
const coverTrainer = document.querySelector("#coverTrainer");
const trainingReportPanel = document.querySelector("#trainingReportPanel");
const aiReportSummary = document.querySelector("#aiReportSummary");
const nextControlReport = document.querySelector("#nextControlReport");
const outputWarnings = document.querySelector("#outputWarnings");
const outputNutritionPlan = document.querySelector("#outputNutritionPlan");
const measurementDate = document.querySelector("#measurementDate");
const measurementWeight = document.querySelector("#measurementWeight");
const measurementHeight = document.querySelector("#measurementHeight");
const measurementBmi = document.querySelector("#measurementBmi");
const measurementBirthDay = document.querySelector("#measurementBirthDay");
const measurementBirthMonth = document.querySelector("#measurementBirthMonth");
const measurementBirthYear = document.querySelector("#measurementBirthYear");
const measurementFat = document.querySelector("#measurementFat");
const measurementMuscleMass = document.querySelector("#measurementMuscleMass");
const measurementFatMass = document.querySelector("#measurementFatMass");
const measurementBodyWater = document.querySelector("#measurementBodyWater");
const measurementVisceralFat = document.querySelector("#measurementVisceralFat");
const measurementBmr = document.querySelector("#measurementBmr");
const measurementMetabolicAge = document.querySelector("#measurementMetabolicAge");
const measurementBoneMass = document.querySelector("#measurementBoneMass");
const measurementWaist = document.querySelector("#measurementWaist");
const measurementHip = document.querySelector("#measurementHip");
const measurementChest = document.querySelector("#measurementChest");
const measurementNote = document.querySelector("#measurementNote");
const segmentInputs = {
  rightArmMuscle: document.querySelector("#segmentRightArmMuscle"),
  leftArmMuscle: document.querySelector("#segmentLeftArmMuscle"),
  trunkMuscle: document.querySelector("#segmentTrunkMuscle"),
  rightLegMuscle: document.querySelector("#segmentRightLegMuscle"),
  leftLegMuscle: document.querySelector("#segmentLeftLegMuscle"),
  rightArmFat: document.querySelector("#segmentRightArmFat"),
  leftArmFat: document.querySelector("#segmentLeftArmFat"),
  trunkFat: document.querySelector("#segmentTrunkFat"),
  rightLegFat: document.querySelector("#segmentRightLegFat"),
  leftLegFat: document.querySelector("#segmentLeftLegFat"),
};
const segmentResistanceInputs = {
  rightArmResistance: document.querySelector("#segmentRightArmResistance"),
  leftArmResistance: document.querySelector("#segmentLeftArmResistance"),
  trunkResistance: document.querySelector("#segmentTrunkResistance"),
  rightLegResistance: document.querySelector("#segmentRightLegResistance"),
  leftLegResistance: document.querySelector("#segmentLeftLegResistance"),
};
const tanitaCsvButton = document.querySelector("#tanitaCsvButton");
const tanitaCsvInput = document.querySelector("#tanitaCsvInput");
const tanitaImportStatus = document.querySelector("#tanitaImportStatus");
const tanitaPreview = document.querySelector("#tanitaPreview");
const saveTanitaMeasurementButton = document.querySelector("#saveTanitaMeasurementButton");
const buildMeasurementReportButton = document.querySelector("#buildMeasurementReportButton");
const measurementTabPdfButton = document.querySelector("#measurementTabPdfButton");
const measurementReportSection = document.querySelector("#measurementReportSection");
const measurementReportContent = document.querySelector("#measurementReportContent");
const measurementReportBackButton = document.querySelector("#measurementReportBackButton");
const measurementReportPdfButton = document.querySelector("#measurementReportPdfButton");
const measurementReportPrintButton = document.querySelector("#measurementReportPrintButton");
const saveMeasurementButton = document.querySelector("#saveMeasurementButton");
const measurementHistory = document.querySelector("#measurementHistory");
const bodyAnalysisReport = document.querySelector("#bodyAnalysisReport");
const programHistory = document.querySelector("#programHistory");
const professionalMemberFile = document.querySelector("#professionalMemberFile");
const v3MemberDossier = document.querySelector("#v3MemberDossier");
const v3TrendCharts = document.querySelector("#v3TrendCharts");
const v3RevisionPanel = document.querySelector("#v3RevisionPanel");
const v3ControlCalendar = document.querySelector("#v3ControlCalendar");

const formHandlers = createFormHandlers({
  state,
  form,
  examplePreset,
  measurementDate,
  resultsSection,
  populateForm,
  collectFormData,
  validateFormData,
  buildProgram,
  saveLastForm,
  saveLastPlan,
  updateActiveMemberProfile,
  renderProgram,
  setActiveScreen,
  showStatus,
  loadLastForm,
  renderLiveSummary,
  upsertMemberFromCurrentForm,
  saveActiveMemberId,
  getTodayInputValue,
  clearMeasurementInputs,
  renderMemberWorkspace,
  getCurrentProgramFromEditor,
  makeId,
  cloneData,
  persistMembers,
  setWorkspaceView,
  readMeasurementForm,
  validateMeasurementData,
  normalizeMeasurementPayload,
  tanitaCsvInput,
  tanitaImportStatus,
  saveTanitaMeasurementButton,
  readTanitaCsvFile,
  parseTanitaCsv,
  selectBestTanitaRecord,
  buildTanitaMeasurement,
  buildTanitaPreviewModel,
  renderTanitaPreview,
  applyTanitaMeasurementToForm,
  setActiveMeasurementState,
  applyMeasurementToAppState,
  triggerMeasurementRecalculation,
  renderMeasurementTabStatus,
  renderMeasurementHistory,
  renderMeasurementReport,
  saveMeasurementToSupabase,
  exerciseLibrary,
  buildPrescription,
  buildRest,
  buildTempo,
  buildExerciseBlocks,
  buildMuscleCoverage,
  applyProgramExerciseEdit,
  validateEditableProgram,
});

const navigationHandlers = createNavigationHandlers({
  state,
  setActiveScreen,
  setWorkspaceView,
  inferScreenFromHash,
  renderLibrary,
  exerciseLibraryEl,
  exerciseSearch,
  libraryGroupFilter,
  libraryEquipmentFilter,
});

const outputHandlers = createOutputHandlers({
  state,
  schemaVersion,
  form,
  backupFileInput,
  resultsSection,
  collectFormData,
  getCurrentProgramFromEditor,
  validateEditableProgram,
  loadLastPlan,
  showStatus,
  convertProgramToText,
  downloadFile,
  formatFileDate,
  extractMembersFromBackup,
  normalizeImportedMembers,
  saveActiveMemberId,
  persistMembers,
  findActiveMember,
  populateForm,
  renderProgram,
  cloneData,
  handleLiveUpdate: formHandlers.handleLiveUpdate,
  renderMemberWorkspace,
  loadBackupHistory,
  formatDashboardDate,
  buildCsvContent,
  labelMaps,
  getTrainingSystemLabel,
  getDayLabel,
  programDeliveryStatus,
  programMailHistory,
});

const nutritionHandlers = createNutritionHandlers({
  state,
  findActiveMember,
  buildNutritionPlan,
  normalizeNutritionPlan,
  collectSupplementPreferences,
  collectNutritionPlanEdits,
  renderNutritionWorkspace,
  renderNutritionOutput,
  persistMembers,
  renderMemberWorkspace,
  showStatus,
  makeId,
  nutritionPanel,
  nutritionPlanEditor,
  generateNutritionPdf: window.BSMNutritionPdfRenderer?.generateNutritionPdf,
  sendNutritionPlanEmail: window.BSMNutritionEmailService?.sendNutritionPlanEmail,
});

const memberHandlers = createMemberHandlers({
  state,
  memberSort,
  measurementDate,
  professionalMemberFile,
  normalizeMemberSort,
  saveMemberSort,
  renderMemberWorkspace,
  loadMember,
  findActiveMember,
  cloneData,
  renderProgram,
  setActiveScreen,
  setWorkspaceView,
  showStatus,
  getMemberAnalysis,
  populateForm,
  applyV3RevisionDefaults,
  collectFormData,
  validateFormData,
  buildProgram,
  saveLastForm,
  saveLastPlan,
  updateActiveMemberProfile,
  handleExportMembersCsv: outputHandlers.handleExportMembersCsv,
});

// ── BSMRouter başlatma ────────────────────────────────────────────────────────
if (window.BSMRouter) {
  window.BSMRouter.init({
    state,
    screenPanels,
    studioNav,
    workspacePanels,
    workspaceTabs,
    loadLatestForOutput: () => loadLatestProgramForOutput(),
    onMeasurementReport: () => renderMeasurementReport(),
    onMeasurementTab: () => renderMeasurementTabStatus(),
    showStatus: (msg, type) => showStatus(msg, type),
  });
}

// ── BSMMeasurementReport başlatma ─────────────────────────────────────────────
if (window.BSMMeasurementReport) {
  window.BSMMeasurementReport.init({
    state,
    findActiveMember,
    collectFormData,
    parseCalendarInputDate,
    readMeasurementForm,
    segmentDiffPercent,
    getProgramStyleLabel,
    getTrainingSystemLabel,
  });
}

// ── BSMBodyAnalysis başlatma ──────────────────────────────────────────────────
if (window.BSMBodyAnalysis) {
  window.BSMBodyAnalysis.init({ getMemberAnalysis });
}

// ── Auth sonrası Supabase yeniden sync ────────────────────────────────────────
// Yeni oturum açan kullanıcılar için: başlangıçta anon olarak sync başarısız
// olmuşsa, auth tamamlandıktan sonra tekrar çalışır.
window.addEventListener("bsm:auth:ready", () => {
  syncMembersFromSupabase({ source: "auth-ready" });
  syncAppSettingsFromSupabase();
  initNavigation();
  activateScreen(inferScreenFromHash(window.location.hash) || "members");
});

initialize();

function initialize() {
  populateStaticFilters();
  populateProgramStyleOptions();
  prepareRepetitionTemplateControls();
  prepareNutritionControls?.(nutritionPanel, escapeHtml);
  initializeStateFromStorage();
  prepareOutputLayout();
  setupBuilderWizard();
  prepareMeasurementTabLayout();
  bindApplicationHandlers();
  syncStartupUi();
  hydrateInitialSession();
  setActiveScreen(inferScreenFromHash(window.location.hash), { silent: true });
  syncMembersFromSupabase();
  setupSupabaseRealtimeSync();
  syncAppSettingsFromSupabase();
  initNavigation();
  activateScreen(inferScreenFromHash(window.location.hash) || "members");
}

function initializeStateFromStorage() {
  state.members = loadMembers();
  state.activeMemberId = loadActiveMemberId();
  syncActiveMemberState();
  state.activeMemberSort = normalizeMemberSort(loadMemberSort());
  state.customExercises = loadCustomExercises();
  state.hiddenExerciseIds = loadHiddenExerciseIds();
  refreshExerciseLibrary();

  if (state.members.length && !loadBackupHistory().length) {
    storeBackupSnapshot(state.members, state.activeMemberId);
  }

  saveMemberSort(state.activeMemberSort);
}

function loadCustomExercises() {
  return normalizeCustomExercises(loadFromStorage(storageKeys.customExercises));
}

function loadHiddenExerciseIds() {
  const ids = loadFromStorage(storageKeys.hiddenExerciseIds);
  return Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))] : [];
}

function normalizeCustomExercises(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeCustomExercise)
    .filter(Boolean);
}

function normalizeCustomExercise(exercise) {
  if (!exercise || typeof exercise !== "object") {
    return null;
  }

  const name = String(exercise.name || "").trim();
  const group = normalizeExerciseGroup(exercise.group);
  const equipment = normalizeExerciseEquipment(exercise.equipment);

  if (!name || !group) {
    return null;
  }

  return {
    id: String(exercise.id || makeCustomExerciseId(name, group)),
    group,
    name,
    equipment,
    kind: normalizeCustomExerciseKind(exercise.kind),
    level: normalizeCustomExerciseLevel(exercise.level),
    tags: Array.isArray(exercise.tags) ? exercise.tags : ["custom"],
    cue: String(exercise.cue || "Kontrollü formda uygula.").trim(),
    gifUrl: String(exercise.gifUrl || "").trim(),
    isCustom: true,
  };
}

function refreshExerciseLibrary() {
  const hiddenIds = new Set(state.hiddenExerciseIds);
  const mergedExercises = [...baseExerciseLibrary, ...state.customExercises].filter((exercise) => !hiddenIds.has(exercise.id));

  exerciseLibrary.splice(0, exerciseLibrary.length, ...mergedExercises);
}

function persistCustomExercises() {
  saveToStorage(storageKeys.customExercises, state.customExercises);
  persistSupabaseAppSetting("customExercises", state.customExercises);
}

function persistHiddenExerciseIds() {
  saveToStorage(storageKeys.hiddenExerciseIds, state.hiddenExerciseIds);
  persistSupabaseAppSetting("hiddenExerciseIds", state.hiddenExerciseIds);
}

function makeCustomExerciseId(name, group) {
  const slug = normalizeText(`${group}-${name}`)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `custom-${slug || makeId("exercise")}`;
}

function normalizeExerciseGroup(value) {
  const group = String(value || "").trim();
  return muscleGroups.some((item) => item.id === group) ? group : muscleGroups[0]?.id || "";
}

function normalizeExerciseEquipment(value) {
  const equipment = String(value || "").trim();
  return equipmentLabels[equipment] ? equipment : "bodyweight";
}

function normalizeCustomExerciseKind(value) {
  const kind = String(value || "").trim();
  return ["compound", "accessory", "cardio", "conditioning", "mobility", "core"].includes(kind) ? kind : "accessory";
}

function normalizeCustomExerciseLevel(value) {
  const level = String(value || "").trim();
  return ["beginner", "intermediate", "advanced"].includes(level) ? level : "intermediate";
}

function syncStartupUi() {
  if (memberSort) {
    memberSort.value = state.activeMemberSort;
  }

  measurementDate.value = getTodayInputValue();
  dashboardToday.textContent = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  setWorkspaceView(state.activeWorkspaceView);
  renderLibrary();
  renderMemberWorkspace();
  renderNutritionWorkspace();
}

function prepareOutputLayout() {
  const grid = resultsSection?.querySelector(".results__grid");

  if (!grid || grid.querySelector(".output-detail-panel")) {
    return;
  }

  const summaryCard = programOverview?.closest(".result-card");
  const programCard = weeklyPlan?.closest(".result-card");
  const detailTargets = [
    coachNote,
    aiReportSummary,
    nextControlReport,
    outputWarnings,
    muscleCoverage,
    progressionPlan,
    guidanceBlock,
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

function setupBuilderWizard() {
  if (window.BSMBuilderWizard) window.BSMBuilderWizard.setup();
}

function prepareMeasurementTabLayout() {
  if (!measurementTabMount) {
    return;
  }

  const measurementWorkspaceCard = document.querySelector('[data-workspace-panel="measurements"]');

  if (measurementWorkspaceCard && measurementWorkspaceCard.parentElement !== measurementTabMount) {
    // UI-only refactor, logic preserved: measurement inputs/buttons keep their ids and existing handlers.
    measurementWorkspaceCard.classList.remove("is-hidden");
    measurementWorkspaceCard.classList.add("measurement-module-card");
    measurementTabMount.appendChild(measurementWorkspaceCard);
  }

  preparePremiumMeasurementLayout();
}

function preparePremiumMeasurementLayout() {
  if (!measurementsPanel || measurementsPanel.dataset.premiumUiReady === "true") {
    return;
  }

  const header = measurementsPanel.querySelector(".measurement-panel__header");
  const stepper = measurementsPanel.querySelector(".measurement-flow-steps");
  const workspace = measurementsPanel.querySelector(".measurement-workspace");

  if (!header || !workspace) {
    return;
  }

  measurementsPanel.dataset.premiumUiReady = "true";
  measurementsPanel.classList.add("measurement-panel--premium");

  if (stepper) {
    // UI-only refactor, logic preserved: old workflow helper is hidden, not used by measurement logic.
    stepper.hidden = true;
    stepper.setAttribute("aria-hidden", "true");
    stepper.classList.add("measurement-flow-steps--retired");
  }

  prepareMeasurementTopActions(header);

  let memberHero = measurementsPanel.querySelector("#measurementTopMemberHero");

  if (!memberHero) {
    memberHero = document.createElement("section");
    memberHero.id = "measurementTopMemberHero";
    memberHero.className = "measurement-top-member-hero";
    header.insertAdjacentElement("afterend", memberHero);
  }

  const shell = document.createElement("div");
  shell.className = "measurement-saas-shell";
  shell.innerHTML = `
    <aside class="measurement-saas-left" aria-label="Aktif üye ve son ölçüm"></aside>
    <div class="measurement-saas-main"></div>
    <aside class="measurement-saas-right" aria-label="Ölçüm içgörüleri"></aside>
  `;

  if (memberHero?.nextSibling) {
    memberHero.parentNode.insertBefore(shell, memberHero.nextSibling);
  } else {
    measurementsPanel.appendChild(shell);
  }

  const leftColumn = shell.querySelector(".measurement-saas-left");
  const mainColumn = shell.querySelector(".measurement-saas-main");
  const rightColumn = shell.querySelector(".measurement-saas-right");

  if (measurementActiveMemberCard) {
    leftColumn.appendChild(measurementActiveMemberCard);
  }

  if (measurementTabNotice) {
    leftColumn.appendChild(measurementTabNotice);
  }

  const summaryCard = document.createElement("section");
  summaryCard.className = "measurement-side-card measurement-left-summary-card";
  summaryCard.innerHTML = `
    <div class="measurement-side-card__head">
      <span>Son Ölçüm Özeti</span>
      <small>Aktif üyenin hızlı görünümü</small>
    </div>
    <div id="measurementLeftSummary" class="measurement-left-summary"></div>
  `;
  leftColumn.appendChild(summaryCard);

  mainColumn.appendChild(workspace);

  prepareMeasurementFormSections(workspace);
  prepareMeasurementWorkspaceCards(workspace);
  prepareMeasurementTabbedWorkspace(workspace);

  const insightPanel = document.createElement("section");
  insightPanel.className = "measurement-insight-panel";
  insightPanel.id = "measurementInsightPanel";
  rightColumn.appendChild(insightPanel);

  renderMeasurementPremiumInsight(findActiveMember());
  renderMeasurementLeftSummary(findActiveMember());
  renderMeasurementMemberHero(findActiveMember());
  measurementsPanel.addEventListener("click", handleMeasurementPremiumAction);
  measurementsPanel.addEventListener("input", handleMeasurementManualDraftInput);
  measurementsPanel.addEventListener("change", handleMeasurementManualDraftInput);
}

function prepareMeasurementTopActions(header) {
  let actionBar = header.querySelector(".measurement-top-actions");

  if (!actionBar) {
    actionBar = document.createElement("div");
    actionBar.className = "measurement-top-actions";
    actionBar.innerHTML = `
      <button type="button" class="ghost-button measurement-top-action" data-measurement-ui-action="load-saved">Son Kaydı Yükle</button>
      <button type="button" class="ghost-button measurement-top-action" data-measurement-ui-action="new-measurement">Yeni Ölçüm</button>
    `;
    header.appendChild(actionBar);
  }

  if (buildMeasurementReportButton) {
    buildMeasurementReportButton.classList.add("measurement-top-primary");
    actionBar.appendChild(buildMeasurementReportButton);
  }
}

function prepareMeasurementFormSections(workspace) {
  const sourceGrid = workspace?.querySelector(".measurement-grid");

  if (!sourceGrid || workspace.querySelector(".measurement-form-sections")) {
    return;
  }

  ensureMeasurementManualExtraFields(sourceGrid);

  const sections = [
    {
      badge: "A",
      title: "Temel Bilgiler",
      text: "Ölçüm zamanı, kimlik ve ana antropometrik değerler.",
      selectors: [
        "#measurementDate",
        "#measurementBirthDay",
        "#measurementHeight",
        "#measurementAge",
        "#measurementWeight",
        "#measurementGender",
        "#measurementBmi",
        "#measurementTime",
      ],
    },
    {
      badge: "B",
      title: "Vücut Kompozisyonu",
      text: "Tanita ve manuel vücut kompozisyon değerleri.",
      selectors: [
        "#measurementFat",
        "#measurementFatMass",
        "#measurementMuscleMass",
        "#measurementBodyWater",
        "#measurementVisceralFat",
        "#measurementBmr",
        "#measurementMetabolicAge",
        "#measurementBoneMass",
        "#measurementProteinPercent",
        "#measurementIntracellularWater",
      ],
    },
    {
      badge: "C",
      title: "Çevre Ölçümleri",
      text: "Bölgesel çevre ölçümleri ve takip alanları.",
      selectors: [
        "#measurementWaist",
        "#measurementHip",
        "#measurementChest",
        "#measurementArmCircumference",
        "#measurementThighCircumference",
        "#measurementCalfCircumference",
      ],
    },
    {
      badge: "D",
      title: "Ek Bilgiler",
      text: "Ölçüm yöntemi, cihaz, sorumlu kişi ve kısa not.",
      selectors: ["#measurementMethod", "#measurementDevice", "#measurementMeasuredBy", "#measurementNote"],
    },
  ];
  const wrapper = document.createElement("div");
  wrapper.className = "measurement-form-sections";

  sections.forEach((section) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "measurement-form-section";
    sectionEl.innerHTML = `
      <div class="measurement-form-section__head">
        <strong><span>${escapeHtml(section.badge)}</span> ${escapeHtml(section.title)}</strong>
        <span>${escapeHtml(section.text)}</span>
      </div>
      <div class="measurement-form-section__grid"></div>
    `;
    const sectionGrid = sectionEl.querySelector(".measurement-form-section__grid");

    section.selectors.forEach((selector) => {
      const input = workspace.querySelector(selector);
      const field = input?.closest(".field");

      if (field && !sectionGrid.contains(field)) {
        if (selector === "#measurementNote") {
          field.classList.add("measurement-note-field");
        }
        sectionGrid.appendChild(field);
      }
    });

    wrapper.appendChild(sectionEl);
  });

  sourceGrid.replaceWith(wrapper);
  decorateMeasurementManualUnits(wrapper);
}

function ensureMeasurementManualExtraFields(sourceGrid) {
  const extraFields = [
    {
      id: "measurementAge",
      label: "Yaş",
      type: "number",
      attrs: { min: "5", max: "100", step: "1", readonly: "readonly", placeholder: "Otomatik" },
    },
    {
      id: "measurementGender",
      label: "Cinsiyet",
      type: "select",
      options: [
        ["", "Seçin"],
        ["female", "Kadın"],
        ["male", "Erkek"],
        ["other", "Belirtmek istemiyor"],
      ],
    },
    { id: "measurementTime", label: "Ölçüm saati", type: "time" },
    { id: "measurementProteinPercent", label: "Protein %", type: "number", attrs: { min: "1", max: "40", step: "0.1", placeholder: "17.2" } },
    { id: "measurementIntracellularWater", label: "Hücre içi su %", type: "number", attrs: { min: "10", max: "80", step: "0.1", placeholder: "32.4" } },
    { id: "measurementArmCircumference", label: "Kol çevresi", type: "number", attrs: { min: "10", max: "80", step: "0.1", placeholder: "35" } },
    { id: "measurementThighCircumference", label: "Uyluk çevresi", type: "number", attrs: { min: "20", max: "120", step: "0.1", placeholder: "60" } },
    { id: "measurementCalfCircumference", label: "Baldır çevresi", type: "number", attrs: { min: "15", max: "80", step: "0.1", placeholder: "38" } },
    {
      id: "measurementMethod",
      label: "Ölçüm yöntemi",
      type: "select",
      options: [
        ["manual_entry", "Manuel"],
        ["tanita_bc418_csv", "Tanita BC-418 CSV"],
        ["segmental_device", "Segmental cihaz"],
        ["tape_measure", "Mezura"],
      ],
    },
    { id: "measurementDevice", label: "Ölçüm cihazı", type: "text", attrs: { maxlength: "60", placeholder: "Tanita BC-418 / Mezura" } },
    { id: "measurementMeasuredBy", label: "Ölçümü yapan", type: "text", attrs: { maxlength: "60", placeholder: "Antrenör adı" } },
  ];

  extraFields.forEach((config) => {
    if (sourceGrid.querySelector(`#${config.id}`) || document.querySelector(`#${config.id}`)) {
      return;
    }

    sourceGrid.appendChild(createMeasurementExtraField(config));
  });
}

function createMeasurementExtraField(config) {
  const field = document.createElement("label");
  field.className = "field compact-field measurement-extra-field";
  field.innerHTML = `<span>${escapeHtml(config.label)}</span>`;
  const input = config.type === "select" ? document.createElement("select") : document.createElement("input");

  input.id = config.id;
  input.dataset.measurementExtra = "true";

  if (config.type === "select") {
    (config.options || []).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      input.appendChild(option);
    });
  } else {
    input.type = config.type || "text";
  }

  Object.entries(config.attrs || {}).forEach(([key, value]) => {
    input.setAttribute(key, value);
  });

  field.appendChild(input);
  return field;
}

function decorateMeasurementManualUnits(root) {
  const unitMap = {
    measurementWeight: "kg",
    measurementHeight: "cm",
    measurementFat: "%",
    measurementFatMass: "kg",
    measurementMuscleMass: "kg",
    measurementBodyWater: "%",
    measurementBmr: "kcal",
    measurementBoneMass: "kg",
    measurementWaist: "cm",
    measurementHip: "cm",
    measurementChest: "cm",
    measurementProteinPercent: "%",
    measurementIntracellularWater: "%",
    measurementArmCircumference: "cm",
    measurementThighCircumference: "cm",
    measurementCalfCircumference: "cm",
  };

  Object.entries(unitMap).forEach(([id, unit]) => {
    const input = root.querySelector(`#${id}`);

    if (!input || input.parentElement?.classList.contains("measurement-input-unit")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "measurement-input-unit";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.insertAdjacentHTML("beforeend", `<em>${escapeHtml(unit)}</em>`);
  });
}

function prepareMeasurementWorkspaceCards(workspace) {
  const tanitaCard = workspace?.querySelector(".tanita-import-card");
  const reportEntry = workspace?.querySelector(".measurement-report-entry");
  const details = [...(workspace?.querySelectorAll(".segmental-details") || [])];

  tanitaCard?.classList.add("measurement-dropzone-card");
  details.forEach((detail, index) => {
    detail.classList.add("measurement-accordion-card");
    detail.dataset.measurementDetail = index === 0 ? "segmental" : "resistance";
  });

  if (reportEntry) {
    reportEntry.classList.add("measurement-report-entry--retired");
    reportEntry.hidden = true;
    reportEntry.setAttribute("aria-hidden", "true");
  }

  if (saveMeasurementButton) {
    saveMeasurementButton.classList.add("measurement-save-primary");
  }
}

function prepareMeasurementTabbedWorkspace(workspace) {
  if (!workspace || workspace.querySelector(".measurement-inner-tabs")) {
    return;
  }

  const tabModel = [
    { id: "tanita", label: "Tanita CSV", hint: "Dosya yükle" },
    { id: "manual", label: "Manuel Ölçüm", hint: "Formu düzenle" },
    { id: "segmental", label: "Segmental Analiz", hint: "Kas / yağ / direnç" },
    { id: "history", label: "Trend & Geçmiş", hint: "Ölçümleri incele" },
    { id: "ai", label: "V3 Koçluk / AI", hint: "İçgörü ve takip" },
    { id: "report", label: "Rapor & PDF", hint: "Üye çıktısı" },
  ];
  const tabShell = document.createElement("section");
  tabShell.className = "measurement-inner-tabs";
  tabShell.innerHTML = `
    <div class="measurement-inner-tabs__bar" role="tablist" aria-label="Ölçüm ve Tanita içerik sekmeleri">
      ${tabModel
        .map(
          (tab, index) => `
            <button
              type="button"
              class="measurement-inner-tab${index === 0 ? " is-active" : ""}"
              id="measurementTabButton-${escapeHtml(tab.id)}"
              role="tab"
              aria-selected="${index === 0 ? "true" : "false"}"
              aria-controls="measurementPane-${escapeHtml(tab.id)}"
              data-measurement-tab-target="${escapeHtml(tab.id)}"
            >
              <strong>${escapeHtml(tab.label)}</strong>
              <span>${escapeHtml(tab.hint)}</span>
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="measurement-inner-tabs__content">
      ${tabModel
        .map(
          (tab, index) => `
            <div
              class="measurement-tab-pane${index === 0 ? " is-active" : ""}"
              id="measurementPane-${escapeHtml(tab.id)}"
              role="tabpanel"
              aria-labelledby="measurementTabButton-${escapeHtml(tab.id)}"
              data-measurement-tab-pane="${escapeHtml(tab.id)}"
              ${index === 0 ? "" : "hidden"}
            ></div>
          `,
        )
        .join("")}
    </div>
  `;

  workspace.prepend(tabShell);

  const panes = Object.fromEntries(
    tabModel.map((tab) => [tab.id, tabShell.querySelector(`[data-measurement-tab-pane="${tab.id}"]`)]),
  );
  const tanitaCard = workspace.querySelector(".tanita-import-card");
  const formSections = workspace.querySelector(".measurement-form-sections");
  const details = [...workspace.querySelectorAll(".segmental-details")];
  const v3Card = workspace.querySelector(".measurement-workspace__v3");
  const programHistoryCard = workspace.querySelector(".measurement-workspace__history");

  if (panes.tanita) {
    panes.tanita.innerHTML = `
      <div class="measurement-csv-dashboard">
        <div class="measurement-csv-grid">
          <div class="measurement-csv-upload-slot"></div>
          <section class="measurement-csv-preview-card">
            <div class="measurement-tab-intro">
              <strong>Ölçüm Önizleme</strong>
              <span>CSV yüklendiğinde temel Tanita değerleri burada anında görünür.</span>
            </div>
            <div class="measurement-csv-preview-slot"></div>
          </section>
        </div>
        <section class="measurement-csv-analytics-card">
          <div class="measurement-tab-intro">
            <strong>Trend Grafikleri</strong>
            <span>Kilo, yağ oranı, kas kütlesi ve bel çevresi için kompakt takip.</span>
          </div>
          <div id="measurementCsvTrendHost" class="measurement-history-trend-grid"></div>
        </section>
        <section class="measurement-csv-history-card">
          <div class="measurement-tab-intro">
            <strong>Ölçüm Geçmişi</strong>
            <span>Son kayıtlar ve Tanita/manual kaynak bilgisi.</span>
          </div>
          <div id="measurementCsvHistoryTable" class="measurement-csv-history-table"></div>
        </section>
      </div>
    `;
    appendIfFound(panes.tanita.querySelector(".measurement-csv-upload-slot"), tanitaCard);
    appendIfFound(panes.tanita.querySelector(".measurement-csv-preview-slot"), tanitaPreview);
  }

  if (panes.manual) {
    panes.manual.innerHTML = `
      <div class="measurement-manual-dashboard">
        <div class="measurement-manual-toolbar">
          <div>
            <strong>Manuel Ölçüm Girişi</strong>
            <span>Eksik veya Tanita’dan gelen değerleri düzenleyip tek kayıt halinde üye geçmişine ekleyin.</span>
          </div>
          <button type="button" class="measurement-required-pill" aria-label="Zorunlu alan bilgisi">i · * Zorunlu alanlar</button>
        </div>
        <div class="measurement-manual-form-grid"></div>
        <div class="measurement-manual-info-strip">
          <div><strong>Ölçüm Notları ve Uyarılar</strong><span>Ölçüm doğru sonuç için sabah aç karna, tuvalet sonrası ve egzersiz öncesi yapılmalıdır.</span></div>
          <div><span>Bol su tüketimi sonuçları etkileyebilir.</span></div>
          <div><span>Her ölçüm aynı koşullarda yapılırsa trend daha güvenilir olur.</span></div>
        </div>
        <div class="measurement-manual-actions">
          <button type="button" class="ghost-button" data-measurement-ui-action="clear-manual">Temizle</button>
          <button type="button" class="secondary-button" data-measurement-ui-action="save-draft">Taslak Olarak Kaydet</button>
          <span class="measurement-manual-save-slot"></span>
        </div>
      </div>
    `;
    appendIfFound(panes.manual.querySelector(".measurement-manual-form-grid"), formSections);
    appendIfFound(panes.manual.querySelector(".measurement-manual-save-slot"), saveMeasurementButton);
  }

  details.forEach((detail) => appendIfFound(panes.segmental, detail));
  appendIfFound(panes.ai, v3Card);
  appendIfFound(panes.report, bodyAnalysisReport);

  if (panes.segmental) {
    panes.segmental.insertAdjacentHTML(
      "afterbegin",
      `<div class="measurement-tab-intro"><strong>Segmental Analiz</strong><span>Varsayılan olarak derli toplu gelir; ihtiyaç oldukça detayları açabilirsiniz.</span></div>`,
    );
  }

  if (panes.history) {
    panes.history.innerHTML = `
      <div class="measurement-history-dashboard">
        <div id="measurementHistoryTrendHost" class="measurement-history-trend-host"></div>
        <section class="measurement-history-table-card">
          <div class="measurement-tab-intro">
            <strong>Ölçüm Geçmişi</strong>
            <span>Kaydedilen manuel ve Tanita ölçümleri, rapor ve silme aksiyonlarıyla birlikte.</span>
          </div>
          <div class="measurement-history-table-slot"></div>
        </section>
        <section class="measurement-history-program-card"></section>
      </div>
    `;
    appendIfFound(panes.history.querySelector(".measurement-history-table-slot"), measurementHistory);
    appendIfFound(panes.history.querySelector(".measurement-history-program-card"), programHistoryCard);
  }

  if (panes.ai) {
    panes.ai.insertAdjacentHTML(
      "afterbegin",
      `<div class="measurement-tab-intro"><strong>V3 Koçluk / AI</strong><span>Veri kalitesi, risk, revizyon ve kontrol takvimi bu alanda incelenir.</span></div>`,
    );
  }

  if (panes.report) {
    // v1.2.0: Premium Report Center, measurement panel'in 'report' alt sekmesinin
    // içine yerlestirildi. Mevcut export/PDF/email handler id'leri korunur:
    // build-report / print-report / email-report (data-measurement-ui-action).
    panes.report.insertAdjacentHTML(
      "afterbegin",
      `
        <div class="bsm-report-center bsm-report-center--in-tab">
          <header class="bsm-report-hero">
            <div class="bsm-report-hero__member">
              <div class="bsm-report-hero__avatar" id="bsmReportAvatar" aria-hidden="true">
                <span class="bsm-report-hero__avatar-initials" id="bsmReportAvatarInitials">--</span>
              </div>
              <div class="bsm-report-hero__info">
                <div class="bsm-report-hero__title-row">
                  <strong class="bsm-report-hero__name" id="bsmReportMemberName">Üye seçilmedi</strong>
                  <span class="bsm-report-chip bsm-report-chip--status">Aktif Üye</span>
                  <span class="bsm-report-chip bsm-report-chip--goal" id="bsmReportGoalChip">
                    <span>Hedef belirtilmedi</span>
                  </span>
                </div>
                <ul class="bsm-report-hero__tags" aria-label="Üye temel bilgileri">
                  <li><span>Üye No:</span> <strong id="bsmReportHeroCode">—</strong></li>
                  <li><span>Seviye:</span> <strong id="bsmReportHeroLevel">—</strong></li>
                  <li><span>Program:</span> <strong id="bsmReportHeroProgram">—</strong></li>
                </ul>
              </div>
            </div>

            <div class="bsm-report-hero__meta">
              <div class="bsm-report-hero__meta-row">
                <span class="bsm-report-hero__meta-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </span>
                <div>
                  <span class="bsm-report-hero__meta-label">Son Ölçüm</span>
                  <strong class="bsm-report-hero__meta-value" id="bsmReportLastMeasurement">—</strong>
                </div>
              </div>
              <div class="bsm-report-hero__meta-row">
                <span class="bsm-report-hero__meta-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                </span>
                <div>
                  <span class="bsm-report-hero__meta-label">Rapor Türü</span>
                  <strong class="bsm-report-hero__meta-value">Vücut Analiz Raporu</strong>
                </div>
              </div>
              <div class="bsm-report-hero__meta-row">
                <span class="bsm-report-hero__meta-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path><line x1="9" y1="13" x2="15" y2="13"></line></svg>
                </span>
                <div>
                  <span class="bsm-report-hero__meta-label">Sayfa Sayısı</span>
                  <strong class="bsm-report-hero__meta-value" id="bsmReportPageCount">4 sayfa</strong>
                </div>
              </div>
            </div>

            <div class="bsm-report-hero__actions" role="toolbar" aria-label="Rapor aksiyonlari">
              <button type="button" class="bsm-report-btn bsm-report-btn--primary" data-measurement-ui-action="build-report">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>PDF Oluştur</span>
              </button>
              <button type="button" class="bsm-report-btn bsm-report-btn--ghost" data-measurement-ui-action="email-report">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <span>E-posta ile Gönder</span>
              </button>
              <button type="button" class="bsm-report-btn bsm-report-btn--ghost" data-measurement-ui-action="print-report">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>Yazdır</span>
              </button>
            </div>
          </header>

          <div class="bsm-report-layout">
            <aside class="bsm-report-config" aria-label="Rapor icerigi yapilandirmasi">
              <header class="bsm-report-config__head">
                <h3>Rapor İçeriği</h3>
                <span class="bsm-report-config__sub">Rapora dahil edilecek bölümleri seçin ve sıralayın.</span>
                <span class="bsm-report-config__counter" id="bsmReportSectionCounter">6/6 seçili</span>
              </header>

              <ul class="bsm-report-sections" id="bsmReportSections" role="list">
                <li class="bsm-report-section" data-report-section="composition">
                  <span class="bsm-report-section__handle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>
                  </span>
                  <span class="bsm-report-section__icon bsm-report-section__icon--orange" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="3"></circle><path d="M12 9v6"></path><path d="M9 14h6"></path><path d="M7 21h10"></path></svg>
                  </span>
                  <span class="bsm-report-section__body">
                    <strong>Vücut Kompozisyonu</strong>
                    <small>Kilo, yağ, kas, su, BMI ve temel kompozisyon</small>
                  </span>
                  <label class="bsm-report-section__toggle">
                    <input type="checkbox" data-report-toggle="composition" checked />
                    <span class="bsm-report-section__check" aria-hidden="true"></span>
                  </label>
                </li>

                <li class="bsm-report-section" data-report-section="segmental">
                  <span class="bsm-report-section__handle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>
                  </span>
                  <span class="bsm-report-section__icon bsm-report-section__icon--blue" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"></circle><path d="M12 7v6"></path><path d="M9 13l3-2 3 2"></path><path d="M8 18l4-4 4 4"></path></svg>
                  </span>
                  <span class="bsm-report-section__body">
                    <strong>Segmental Analiz</strong>
                    <small>Kas, yağ ve segmental denge</small>
                  </span>
                  <label class="bsm-report-section__toggle">
                    <input type="checkbox" data-report-toggle="segmental" checked />
                    <span class="bsm-report-section__check" aria-hidden="true"></span>
                  </label>
                </li>

                <li class="bsm-report-section" data-report-section="trend">
                  <span class="bsm-report-section__handle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>
                  </span>
                  <span class="bsm-report-section__icon bsm-report-section__icon--green" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"></polyline><polyline points="14 7 21 7 21 14"></polyline></svg>
                  </span>
                  <span class="bsm-report-section__body">
                    <strong>Trend Grafikleri</strong>
                    <small>Zaman içindeki değişim ve gelişim</small>
                  </span>
                  <label class="bsm-report-section__toggle">
                    <input type="checkbox" data-report-toggle="trend" checked />
                    <span class="bsm-report-section__check" aria-hidden="true"></span>
                  </label>
                </li>

                <li class="bsm-report-section" data-report-section="program-notes">
                  <span class="bsm-report-section__handle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>
                  </span>
                  <span class="bsm-report-section__icon bsm-report-section__icon--purple" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="13" y2="17"></line></svg>
                  </span>
                  <span class="bsm-report-section__body">
                    <strong>Program Notları</strong>
                    <small>Mevcut program, hedefler ve takip</small>
                  </span>
                  <label class="bsm-report-section__toggle">
                    <input type="checkbox" data-report-toggle="program-notes" checked />
                    <span class="bsm-report-section__check" aria-hidden="true"></span>
                  </label>
                </li>

                <li class="bsm-report-section" data-report-section="nutrition-notes">
                  <span class="bsm-report-section__handle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>
                  </span>
                  <span class="bsm-report-section__icon bsm-report-section__icon--teal" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2v20"></path><path d="M5 2v6a3 3 0 0 0 6 0V2"></path><path d="M18 2v20"></path><path d="M15 2c0 4 3 4 3 8"></path></svg>
                  </span>
                  <span class="bsm-report-section__body">
                    <strong>Beslenme Notları</strong>
                    <small>Beslenme planı ve makro hedefleri</small>
                  </span>
                  <label class="bsm-report-section__toggle">
                    <input type="checkbox" data-report-toggle="nutrition-notes" checked />
                    <span class="bsm-report-section__check" aria-hidden="true"></span>
                  </label>
                </li>

                <li class="bsm-report-section" data-report-section="history">
                  <span class="bsm-report-section__handle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle></svg>
                  </span>
                  <span class="bsm-report-section__icon bsm-report-section__icon--rose" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><polyline points="3 3 3 8 8 8"></polyline><path d="M12 7v5l3 2"></path></svg>
                  </span>
                  <span class="bsm-report-section__body">
                    <strong>Ölçüm Geçmişi Özeti</strong>
                    <small>Geçmiş ölçümlerin kısa karşılaştırması</small>
                  </span>
                  <label class="bsm-report-section__toggle">
                    <input type="checkbox" data-report-toggle="history" checked />
                    <span class="bsm-report-section__check" aria-hidden="true"></span>
                  </label>
                </li>
              </ul>

              <footer class="bsm-report-config__footer">
                <button type="button" class="bsm-report-config__add" id="bsmReportAddSection" disabled aria-disabled="true" title="Bu ozellik yakinda">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>Yeni Bölüm Ekle</span>
                </button>
              </footer>
            </aside>

            <section class="bsm-report-preview" aria-label="Rapor onizlemesi">
              <header class="bsm-report-preview__head">
                <div>
                  <h3>Rapor Önizleme</h3>
                  <span class="bsm-report-preview__sub">Raporun PDF önizlemesini görüntüleyin.</span>
                </div>
                <div class="bsm-report-preview__pager" id="bsmReportPager">
                  <span class="bsm-report-preview__pager-label">Sayfa <strong id="bsmReportCurrentPage">1</strong> / <strong id="bsmReportTotalPages">4</strong></span>
                  <button type="button" class="bsm-report-preview__pager-btn" id="bsmReportPagePrev" aria-label="Onceki sayfa">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button type="button" class="bsm-report-preview__pager-btn" id="bsmReportPageNext" aria-label="Sonraki sayfa">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              </header>

              <div class="bsm-report-preview__body">
                <article class="bsm-report-page" id="bsmReportPage" aria-label="PDF sayfa onizlemesi">
                  <header class="bsm-report-page__head">
                    <div>
                      <span class="bsm-report-page__brand">Bahçeşehir Spor Merkezi</span>
                      <h2>VÜCUT ANALİZ RAPORU</h2>
                      <p id="bsmReportPageMember">Üye seçilmedi</p>
                    </div>
                    <div class="bsm-report-page__date" id="bsmReportPageDate">—</div>
                  </header>
                  <div class="bsm-report-page__section">
                    <span class="bsm-report-page__section-title">Vücut Kompozisyonu</span>
                    <div class="bsm-report-page__metrics" id="bsmReportPreviewMetrics">
                      <div class="bsm-report-page__metric"><small>Kilo</small><strong>—</strong></div>
                      <div class="bsm-report-page__metric"><small>Yağ Oranı</small><strong>—</strong></div>
                      <div class="bsm-report-page__metric"><small>Kas Kütlesi</small><strong>—</strong></div>
                      <div class="bsm-report-page__metric"><small>BMI</small><strong>—</strong></div>
                      <div class="bsm-report-page__metric"><small>Visceral Yağ</small><strong>—</strong></div>
                      <div class="bsm-report-page__metric"><small>BMR</small><strong>—</strong></div>
                    </div>
                  </div>
                  <div class="bsm-report-page__section">
                    <span class="bsm-report-page__section-title">Trend Grafikleri</span>
                    <div class="bsm-report-page__charts" id="bsmReportPreviewCharts" aria-hidden="true">
                      <div class="bsm-report-page__chart bsm-report-page__chart--blue">
                        <span>Kilo (kg)</span>
                        <svg viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points="2,22 18,18 34,20 50,16 66,14 82,12 98,10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>
                      </div>
                      <div class="bsm-report-page__chart bsm-report-page__chart--orange">
                        <span>Yağ Oranı (%)</span>
                        <svg viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points="2,12 18,14 34,18 50,16 66,20 82,22 98,24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>
                      </div>
                      <div class="bsm-report-page__chart bsm-report-page__chart--green">
                        <span>Kas Kütlesi (kg)</span>
                        <svg viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points="2,20 18,18 34,16 50,14 66,12 82,10 98,8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>
                      </div>
                    </div>
                  </div>
                  <footer class="bsm-report-page__footer">
                    <span>Bahçeşehir Spor Merkezi — Profesyonel Üye Performans Raporu</span>
                    <span class="bsm-report-page__footer-page">Sayfa 1 / 4</span>
                  </footer>
                </article>

                <aside class="bsm-report-thumbs" id="bsmReportThumbs" aria-label="Sayfa kucuk goruntuleri">
                  <button type="button" class="bsm-report-thumb is-active" data-report-thumb="1" aria-label="Sayfa 1"><span>1</span></button>
                  <button type="button" class="bsm-report-thumb" data-report-thumb="2" aria-label="Sayfa 2"><span>2</span></button>
                  <button type="button" class="bsm-report-thumb" data-report-thumb="3" aria-label="Sayfa 3"><span>3</span></button>
                  <button type="button" class="bsm-report-thumb" data-report-thumb="4" aria-label="Sayfa 4"><span>4</span></button>
                </aside>
              </div>
            </section>
          </div>
        </div>
      `,
    );
  }
}

function appendIfFound(parent, child) {
  if (parent && child) {
    parent.appendChild(child);
  }
}

function handleMeasurementPremiumAction(event) {
  const viewButton = event.target.closest("[data-measurement-view]");

  if (viewButton) {
    loadMeasurementRecordById(viewButton.dataset.measurementView);
    return;
  }

  const deleteButton = event.target.closest("[data-measurement-delete]");

  if (deleteButton) {
    handleDeleteMeasurementRecord(deleteButton.dataset.measurementDelete);
    return;
  }

  const tabButton = event.target.closest("[data-measurement-tab-target]");

  if (tabButton) {
    setActiveMeasurementInnerTab(tabButton.dataset.measurementTabTarget);
    return;
  }

  const historyFilterButton = event.target.closest("[data-measurement-history-filter]");

  if (historyFilterButton) {
    updateMeasurementHistoryFilter(
      historyFilterButton.dataset.measurementHistoryFilter,
      historyFilterButton.dataset.measurementHistoryValue,
    );
    return;
  }

  const v3ActionButton = event.target.closest("button[data-v3-action]");

  if (v3ActionButton && !v3RevisionPanel?.contains(v3ActionButton)) {
    const v3Action = v3ActionButton.dataset.v3Action;

    if (v3Action === "open-measurement") {
      setActiveMeasurementInnerTab("manual");
      measurementDate?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (v3Action === "generate-revision") {
      const revisionButton = v3RevisionPanel?.querySelector('button[data-v3-action="generate-revision"]');

      if (revisionButton) {
        revisionButton.click();
      } else {
        showStatus("V3 revizyon aksiyonu için gerekli kontrol bulunamadı.", "error");
      }

      return;
    }
  }

  const actionButton = event.target.closest("[data-measurement-ui-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.measurementUiAction;

  if (action === "load-saved") {
    loadLatestMeasurementForActiveMember();
    return;
  }

  if (action === "new-measurement") {
    prepareNewMeasurementDraft();
    return;
  }

  if (action === "clear-manual") {
    clearManualMeasurementDraft();
    return;
  }

  if (action === "save-draft") {
    saveManualMeasurementDraft();
    return;
  }

  if (action === "new-member") {
    setActiveScreen("builder", { silent: true });
    newMemberButton?.click();
    return;
  }

  if (action === "open-builder") {
    setActiveScreen("builder", { userTriggered: true, silent: true });
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (action === "build-report") {
    handleBuildMeasurementReport();
    return;
  }

  if (action === "print-report") {
    handlePrintMeasurementReport();
    return;
  }

  if (action === "email-report") {
    openMeasurementEmailDraft();
    return;
  }

  if (action === "focus-note") {
    setActiveMeasurementInnerTab("manual");
    measurementNote?.focus();
    return;
  }

  if (action === "focus-v3-details") {
    setActiveMeasurementInnerTab("ai");
    const detailPanel = document.querySelector("#v3DecisionDetails");
    detailPanel?.querySelector("details")?.setAttribute("open", "");
    detailPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (action === "focus-v3-calendar") {
    setActiveMeasurementInnerTab("ai");
    document.querySelector("#v3ControlFocus")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (action === "compare") {
    setActiveMeasurementInnerTab("history");
    document.querySelector("#measurementPane-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (action === "export-history") {
    exportMeasurementHistoryCsv();
    return;
  }

  if (action === "mail-info") {
    openMeasurementEmailDraft();
  }
}

function loadMeasurementRecordById(measurementId) {
  const member = findActiveMember();
  const measurement = (member?.measurements || []).find((item) => String(item?.id || "") === String(measurementId || ""));

  if (!member || !measurement) {
    showStatus("Görüntülenecek ölçüm kaydı bulunamadı.", "error");
    return;
  }

  state.pendingTanitaMeasurement = null;
  setActiveMeasurementState(measurement, { memberId: member.id, source: "saved" });
  applyTanitaMeasurementToForm(measurement, { dispatch: false });
  renderTanitaPreview(buildTanitaPreviewModel?.(measurement));
  renderMeasurementTabStatus();
  renderMeasurementHistory();
  renderMeasurementReport();
  showStatus("Ölçüm kaydı forma ve rapor önizlemesine yüklendi.", "success");
}

function updateMeasurementHistoryFilter(filterKey, value) {
  if (!filterKey || !value) {
    return;
  }

  state.measurementHistoryFilters = {
    ...(state.measurementHistoryFilters || {}),
    [filterKey]: value,
  };

  renderMeasurementHistory();
}

function handleDeleteMeasurementRecord(measurementId) {
  const member = findActiveMember();
  const id = String(measurementId || "");

  if (!member || !id) {
    showStatus("Silinecek ölçüm kaydı bulunamadı.", "error");
    return;
  }

  const measurements = Array.isArray(member.measurements) ? member.measurements : [];
  const measurement = measurements.find((item) => String(item?.id || "") === id);

  if (!measurement) {
    showStatus("Bu ölçüm kaydı zaten bulunamadı.", "info");
    renderMeasurementHistory();
    return;
  }

  const confirmed = window.confirm("Bu ölçüm kaydı silinsin mi?");

  if (!confirmed) {
    return;
  }

  const activeBefore = state.activeMeasurementState ? cloneData(state.activeMeasurementState) : null;
  const isDeletingActive =
    String(activeBefore?.id || "") === id ||
    String(state.latestMeasurement?.id || "") === id ||
    String(state.pendingTanitaMeasurement?.id || "") === id;

  member.measurements = measurements.filter((item) => String(item?.id || "") !== id);
  member.updatedAt = new Date().toISOString();

  if (String(state.pendingTanitaMeasurement?.id || "") === id) {
    state.pendingTanitaMeasurement = null;
    if (saveTanitaMeasurementButton) saveTanitaMeasurementButton.disabled = true;
  }

  persistMembers();

  const refreshedMember = syncActiveMemberState();
  const nextMeasurement = refreshedMember?.measurements?.[0] || null;

  if (isDeletingActive) {
    setActiveMeasurementState(nextMeasurement, { memberId: refreshedMember?.id || member.id, source: nextMeasurement ? "saved" : null });
    if (nextMeasurement) {
      applyTanitaMeasurementToForm(nextMeasurement, { dispatch: false });
    } else {
      clearMeasurementInputs();
      if (measurementDate) measurementDate.value = getTodayInputValue();
    }
  } else if (activeBefore) {
    setActiveMeasurementState(activeBefore, { memberId: member.id, source: state.activeMeasurementSource || activeBefore.source || "measurement" });
  } else {
    setActiveMeasurementState(nextMeasurement, { memberId: member.id, source: nextMeasurement ? "saved" : null });
  }

  deleteMeasurementFromSupabase(member, id);
  triggerMeasurementRecalculation();
  renderMeasurementTabStatus();
  renderMeasurementHistory();
  renderMeasurementReport();

  showStatus(
    nextMeasurement ? "Ölçüm kaydı silindi. Özet ve trendler güncellendi." : "Ölçüm kaydı silindi. Bu üye için kayıtlı ölçüm kalmadı.",
    "success",
  );
}

function deleteMeasurementFromSupabase(member, measurementId) {
  if (!window.BSMSupabaseSyncService?.deleteMeasurement) {
    return Promise.resolve(null);
  }

  return window.BSMSupabaseSyncService
    .deleteMeasurement(member, measurementId)
    .catch((error) => {
      console.error("Supabase measurement delete error", error);
      return null;
    });
}

function setActiveMeasurementInnerTab(tabId = "tanita") {
  const tabShell = measurementsPanel?.querySelector(".measurement-inner-tabs");

  if (!tabShell) {
    return;
  }

  const hasPane = [...tabShell.querySelectorAll("[data-measurement-tab-pane]")].some((pane) => pane.dataset.measurementTabPane === tabId);
  const normalizedTabId = hasPane ? tabId : "tanita";
  measurementsPanel.dataset.activeMeasurementTab = normalizedTabId;
  measurementsPanel.classList.toggle("measurement-panel--history-fullwidth", normalizedTabId === "history");
  measurementsPanel.classList.toggle("measurement-panel--v3-fullwidth", normalizedTabId === "ai");

  tabShell.querySelectorAll("[data-measurement-tab-target]").forEach((button) => {
    const isActive = button.dataset.measurementTabTarget === normalizedTabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  tabShell.querySelectorAll("[data-measurement-tab-pane]").forEach((pane) => {
    const isActive = pane.dataset.measurementTabPane === normalizedTabId;
    pane.classList.toggle("is-active", isActive);
    pane.hidden = !isActive;
  });
}

function setActiveMeasurementState(measurement, options = {}) {
  if (!measurement) {
    state.activeMeasurementState = null;
    state.activeMeasurementSource = null;
    state.latestMeasurement = null;
    return null;
  }

  const member = options.member || findActiveMember();
  const normalizedMeasurement = normalizeMeasurementPayload({
    ...measurement,
    memberId: options.memberId || measurement.memberId || member?.id || "",
  });

  state.activeMeasurementState = normalizedMeasurement;
  state.activeMeasurementSource = options.source || normalizedMeasurement.source || "measurement";
  state.latestMeasurement = normalizedMeasurement;
  return normalizedMeasurement;
}

function getActiveMeasurementSnapshot(member = findActiveMember(), fallback = null) {
  const pending = state.pendingTanitaMeasurement;

  if (pending && isMeasurementForMember(pending, member)) {
    return normalizeMeasurementPayload(pending);
  }

  if (state.activeMeasurementState && isMeasurementForMember(state.activeMeasurementState, member)) {
    return normalizeMeasurementPayload(state.activeMeasurementState);
  }

  return fallback || member?.measurements?.[0] || state.latestMeasurement || null;
}

function getActiveMeasurementRecords(member = findActiveMember()) {
  const records = Array.isArray(member?.measurements) ? member.measurements : [];
  const activeMeasurement = getActiveMeasurementSnapshot(member);

  if (!activeMeasurement || !state.pendingTanitaMeasurement || !isMeasurementForMember(activeMeasurement, member)) {
    return records;
  }

  const activeId = String(activeMeasurement.id || "");
  const withoutDuplicate = records.filter((item) => !activeId || String(item?.id || "") !== activeId);
  return [activeMeasurement, ...withoutDuplicate].slice(0, 40);
}

function isMeasurementForMember(measurement, member) {
  if (!measurement || !member) {
    return Boolean(measurement);
  }

  const measurementMemberId = measurement.memberId || measurement.activeMemberId || measurement.member_id || "";
  return !measurementMemberId || String(measurementMemberId) === String(member.id);
}

function prepareNewMeasurementDraft() {
  const member = findActiveMember();

  if (!member) {
    showStatus("Yeni ölçüm başlatmak için önce üye seçin veya oluşturun.", "error");
    return;
  }

  state.pendingTanitaMeasurement = null;
  clearMeasurementInputs();
  const today = getTodayInputValue();
  const nowTime = getCurrentTimeInputValue();
  if (measurementDate) measurementDate.value = today;
  setInputValue(document.querySelector("#measurementTime"), nowTime);
  setActiveMeasurementState(
    {
      id: makeId("measurement-draft"),
      memberId: member.id,
      date: today,
      time: nowTime,
      source: "manual-draft",
      measurementMethod: "manual_entry",
    },
    { memberId: member.id, source: "manual-draft" },
  );
  renderTanitaPreview(null);
  if (saveTanitaMeasurementButton) saveTanitaMeasurementButton.disabled = true;
  setActiveMeasurementInnerTab("manual");
  renderMeasurementTabStatus();
  renderMeasurementHistory();
  showStatus("Yeni ölçüm için Tanita CSV ve manuel giriş alanları hazır.", "success");
}

function getCurrentTimeInputValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function loadLatestMeasurementForActiveMember() {
  const member = findActiveMember();
  const latestMeasurement = member?.measurements?.[0] || null;

  if (!member) {
    loadSavedButton?.click();
    return;
  }

  if (!latestMeasurement) {
    showStatus("Bu üye için yüklenebilecek kayıtlı ölçüm bulunamadı.", "info");
    return;
  }

  state.pendingTanitaMeasurement = null;
  setActiveMeasurementState(latestMeasurement, { memberId: member.id, source: "saved" });
  applyTanitaMeasurementToForm(latestMeasurement);
  renderTanitaPreview(buildTanitaPreviewModel?.(latestMeasurement));
  setActiveMeasurementInnerTab("tanita");
  renderMeasurementTabStatus();
  renderMeasurementHistory();
  showStatus("Son kayıtlı ölçüm forma ve özet panellere yüklendi.", "success");
}

function openMeasurementEmailDraft() {
  const member = findActiveMember();
  const profile = member?.profile || {};
  const email = profile.email || profile.memberEmail || profile.mail || "";

  if (!member) {
    showStatus("E-posta göndermek için önce aktif üye seçin.", "error");
    return;
  }

  if (!email) {
    showStatus("Bu üye için e-posta adresi bulunamadı. Üye bilgilerine mail adresi ekleyin.", "error");
    return;
  }

  const subject = encodeURIComponent("Bahçeşehir Spor Merkezi | Tanita Ölçüm Raporunuz");
  const body = encodeURIComponent(
    `Merhaba ${profile.memberName || "üyemiz"},\n\nTanita ölçüm raporunuz hazırlandı. Panelden PDF olarak indirilen raporu sizinle paylaşıyoruz.\n\nSağlıklı günler dileriz.\nBahçeşehir Spor Merkezi`,
  );
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  showStatus("E-posta taslağı açıldı. PDF dosyasını ek olarak iliştirebilirsiniz.", "success");
}

function renderMeasurementPremiumInsight(member = findActiveMember(), latestMeasurement = null) {
  const panel = document.querySelector("#measurementInsightPanel");

  if (!panel) {
    return;
  }

  const measurement = getActiveMeasurementSnapshot(member, latestMeasurement);
  const model = buildMeasurementInsightModel(member, measurement);
  const trendCards = buildMeasurementTrendCards(getActiveMeasurementRecords(member));

  panel.innerHTML = `
    <div class="measurement-insight-card measurement-body-map-card">
      <div class="measurement-side-card__head">
        <span>Ölçüm Özeti</span>
        <small>${escapeHtml(model.dateText)}</small>
      </div>
      <div class="measurement-body-map-card__content">
        <div class="measurement-body-silhouette" aria-hidden="true">
          <span></span>
        </div>
        <div class="measurement-mini-metrics">
          ${model.metrics
            .map(
              (metric) => `
                <div>
                  <span>${escapeHtml(metric.label)}</span>
                  <strong>${escapeHtml(metric.value)}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
    <div class="measurement-insight-card measurement-score-card">
      <div class="measurement-score-ring" style="--score:${model.score}">
        <strong>${escapeHtml(String(model.score))}</strong>
        <span>/100</span>
      </div>
      <div>
        <span class="measurement-insight-eyebrow">Ölçüm Özeti</span>
        <h3>Genel Skor</h3>
        <p>${escapeHtml(model.summary)}</p>
      </div>
    </div>
    <div class="measurement-insight-card measurement-status-list">
      ${model.statuses
        .map(
          (item) => `
            <div>
              <span>${escapeHtml(item.label)}</span>
              <strong class="measurement-status-badge is-${escapeHtml(item.state)}">${escapeHtml(item.value)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="measurement-insight-card">
      <div class="measurement-side-card__head">
        <span>Trend Analizi</span>
        <small>Son 3 ölçüm</small>
      </div>
      <div class="measurement-trend-grid">
        ${trendCards.map(renderMeasurementTrendCard).join("")}
      </div>
    </div>
    <div class="measurement-insight-card measurement-quick-actions">
      <button type="button" class="measurement-quick-action" data-measurement-ui-action="build-report">Rapor Oluştur</button>
      <button type="button" class="measurement-quick-action" data-measurement-ui-action="compare">Karşılaştır</button>
      <button type="button" class="measurement-quick-action" data-measurement-ui-action="email-report">E-posta</button>
      <button type="button" class="measurement-quick-action" data-measurement-ui-action="focus-note">Not Ekle</button>
      <span class="measurement-pdf-slot"></span>
    </div>
    <div class="measurement-insight-card measurement-ai-card">
      <span>AI Önerisi</span>
      <p>${escapeHtml(model.aiSuggestion)}</p>
    </div>
  `;

  const pdfSlot = panel.querySelector(".measurement-pdf-slot");

  if (pdfSlot && measurementTabPdfButton) {
    measurementTabPdfButton.classList.add("measurement-quick-action", "measurement-quick-action--pdf");
    pdfSlot.appendChild(measurementTabPdfButton);
  }
}

function renderMeasurementLeftSummary(member = findActiveMember()) {
  const host = document.querySelector("#measurementLeftSummary");

  if (!host) {
    return;
  }

  const latestMeasurement = getActiveMeasurementSnapshot(member);
  const cards = buildMeasurementMetrics(latestMeasurement);

  host.innerHTML = member
    ? `
      <div class="measurement-left-summary__date">${escapeHtml(latestMeasurement?.date || "Henüz ölçüm yok")}</div>
      <div class="measurement-left-summary__grid">
        ${cards
          .map(
            (card) => `
              <div>
                <span>${escapeHtml(card.label)}</span>
                <strong>${escapeHtml(card.value)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
      <button type="button" class="measurement-side-link" data-measurement-ui-action="compare">Tüm Geçmişi Gör</button>
    `
    : `
      <div class="measurement-left-summary__empty">
        <strong>Ölçüm bekleniyor</strong>
        <span>Aktif üye seçildikten sonra son ölçüm özeti burada görünecek.</span>
      </div>
    `;
}

function buildMeasurementInsightModel(member, measurement) {
  if (!member) {
    return {
      score: 0,
      summary: "Önce üye seçildiğinde ölçüm analizi burada görünür.",
      dateText: "Üye bekleniyor",
      aiSuggestion: "Üye seçimi sonrası Tanita CSV veya manuel ölçüm ile takip başlatılabilir.",
      statuses: [
        { label: "Veri Kalitesi", value: "Bekliyor", state: "neutral" },
        { label: "Risk Seviyesi", value: "Belirsiz", state: "neutral" },
        { label: "Takip Sürekliliği", value: "Başlatılmadı", state: "neutral" },
      ],
      metrics: buildEmptyMeasurementMetrics(),
    };
  }

  const dataQuality = calculateMeasurementDataQuality(measurement);
  const risk = resolveMeasurementRisk(measurement);
  const continuity = resolveMeasurementContinuity(member.measurements || []);
  const score = Math.max(0, Math.min(100, Math.round(dataQuality.score * 0.35 + risk.score * 0.4 + continuity.score * 0.25)));
  const profile = member.profile || {};
  const goalLabel = labelMaps.goal[profile.goal] || "hedef";
  const summary = measurement
    ? `${goalLabel} hedefi için ölçüm verisi aktif; takip kalitesi ${dataQuality.label.toLowerCase()}.`
    : "Bu üye için ölçüm bulunmadığı için analiz beklemede.";

  return {
    score,
    summary,
    dateText: measurement?.date || "Ölçüm yok",
    aiSuggestion: buildMeasurementAiSuggestion(measurement, risk, continuity),
    statuses: [
      { label: "Veri Kalitesi", value: dataQuality.label, state: dataQuality.state },
      { label: "Risk Seviyesi", value: risk.label, state: risk.state },
      { label: "Takip Sürekliliği", value: continuity.label, state: continuity.state },
    ],
    metrics: buildMeasurementMetrics(measurement),
  };
}

function buildMeasurementMetrics(measurement) {
  if (!measurement) {
    return buildEmptyMeasurementMetrics();
  }

  return [
    { label: "Kilo", value: formatMeasurementMetric(measurement.weight, "kg") },
    { label: "Yağ", value: formatMeasurementMetric(measurement.fat, "%") },
    { label: "Kas", value: formatMeasurementMetric(measurement.muscleMass, "kg") },
    { label: "Su", value: formatMeasurementMetric(measurement.bodyWater, "%") },
    { label: "Visceral", value: formatMeasurementMetric(measurement.visceralFat, "") },
    { label: "BMR", value: formatMeasurementMetric(measurement.bmr, "kcal") },
    { label: "BMI", value: formatMeasurementMetric(measurement.bmi, "") },
    { label: "Bel", value: formatMeasurementMetric(measurement.waist, "cm") },
  ];
}

function buildEmptyMeasurementMetrics() {
  return [
    { label: "Kilo", value: "Veri yok" },
    { label: "Yağ", value: "Veri yok" },
    { label: "Kas", value: "Veri yok" },
    { label: "Su", value: "Veri yok" },
    { label: "Visceral", value: "Veri yok" },
    { label: "BMR", value: "Veri yok" },
    { label: "BMI", value: "Veri yok" },
    { label: "Bel", value: "Veri yok" },
  ];
}

function calculateMeasurementDataQuality(measurement) {
  if (!measurement) {
    return { score: 0, label: "Bekliyor", state: "neutral" };
  }

  const fields = ["weight", "height", "fat", "muscleMass", "bmr", "waist"];
  const filled = fields.filter((key) => Number.isFinite(Number(measurement[key]))).length;
  const score = Math.round((filled / fields.length) * 100);

  if (score >= 75) return { score, label: "İyi", state: "good" };
  if (score >= 45) return { score, label: "Orta", state: "warning" };
  return { score, label: "Eksik", state: "danger" };
}

function resolveMeasurementRisk(measurement) {
  if (!measurement) {
    return { score: 30, label: "Belirsiz", state: "neutral" };
  }

  const bmi = Number(measurement.bmi);
  const fat = Number(measurement.fat);
  const visceral = Number(measurement.visceralFat);
  let penalty = 0;

  if (Number.isFinite(bmi)) penalty += bmi >= 32 ? 24 : bmi >= 28 ? 12 : 0;
  if (Number.isFinite(fat)) penalty += fat >= 35 ? 28 : fat >= 28 ? 14 : 0;
  if (Number.isFinite(visceral)) penalty += visceral >= 13 ? 26 : visceral >= 10 ? 12 : 0;

  const score = Math.max(30, 100 - penalty);

  if (score >= 78) return { score, label: "Düşük", state: "good" };
  if (score >= 58) return { score, label: "Orta", state: "warning" };
  return { score, label: "Yüksek", state: "danger" };
}

function resolveMeasurementContinuity(measurements = []) {
  if (measurements.length >= 3) return { score: 92, label: "İyi", state: "good" };
  if (measurements.length >= 2) return { score: 74, label: "Takipte", state: "warning" };
  if (measurements.length === 1) return { score: 52, label: "Yeni", state: "neutral" };
  return { score: 25, label: "Başlatılmadı", state: "neutral" };
}

function buildMeasurementAiSuggestion(measurement, risk, continuity) {
  if (!measurement) {
    return "İlk ölçüm kaydedildiğinde program, beslenme ve takip önerileri daha kişisel hale gelir.";
  }

  if (risk.state === "danger") {
    return "Yağ, BMI veya visceral değerleri dikkat istiyor; düşük etkili kardiyo, kontrollü kuvvet ve düzenli takip önerilir.";
  }

  if (continuity.state === "neutral") {
    return "Trend analizi için 14-21 gün içinde ikinci ölçüm alınması planı daha net hale getirir.";
  }

  return "Veriler tutarlı görünüyor; hedefe göre kuvvet, kardiyo ve beslenme takip ritmini koruyun.";
}

function buildMeasurementTrendCards(measurements = []) {
  return [
    { key: "weight", label: "Kilo", suffix: "kg" },
    { key: "fat", label: "Yağ %", suffix: "%" },
    { key: "muscleMass", label: "Kas", suffix: "kg" },
    { key: "waist", label: "Bel", suffix: "cm" },
  ].map((item) => {
    const values = measurements
      .slice(0, 3)
      .map((measurement) => Number(measurement?.[item.key]))
      .filter(Number.isFinite);
    const latest = values[0];
    const previous = values[1];
    const delta = Number.isFinite(latest) && Number.isFinite(previous) ? latest - previous : null;

    return {
      ...item,
      value: Number.isFinite(latest) ? formatMeasurementMetric(latest, item.suffix) : "Veri yok",
      delta,
      values: values.slice().reverse(),
    };
  });
}

function renderMeasurementTrendCard(card) {
  const deltaLabel = Number.isFinite(card.delta)
    ? `${card.delta > 0 ? "+" : ""}${card.delta.toFixed(1)} ${card.suffix}`
    : "2 ölçüm bekleniyor";
  const deltaState = !Number.isFinite(card.delta) ? "neutral" : card.delta > 0 ? "up" : card.delta < 0 ? "down" : "stable";

  return `
    <article class="measurement-trend-card">
      <div>
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
      </div>
      <small class="is-${escapeHtml(deltaState)}">${escapeHtml(deltaLabel)}</small>
      ${renderMeasurementSparkline(card.values)}
    </article>
  `;
}

function renderMeasurementSparkline(values = []) {
  if (values.length < 2) {
    return `<div class="measurement-sparkline measurement-sparkline--empty"></div>`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 34 - ((value - min) / range) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return `
    <svg class="measurement-sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${escapeHtml(points)}"></polyline>
    </svg>
  `;
}

function formatMeasurementMetric(value, suffix = "") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Veri yok";
  }

  return `${number.toFixed(number % 1 === 0 ? 0 : 1)} ${suffix}`.trim();
}

function setResultCardTitle(card, title) {
  const titleElement = card?.querySelector("h3");

  if (titleElement) {
    titleElement.textContent = title;
  }
}

function renderTanitaPreview(model) {
  if (!tanitaPreview) {
    return;
  }

  if (!model) {
    tanitaPreview.innerHTML = "<p>CSV yüklendiğinde okunan kilo, yağ, kas, segmental dağılım ve direnç değerleri burada önizlenir.</p>";
    return;
  }

  const metricsHtml = (model.metrics || [])
    .map(
      ([label, value]) => `
        <div class="tanita-preview-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
  const segmentRowsHtml = (model.segmentRows || [])
    .map(
      (row) => `
        <div class="tanita-preview-segment-row">
          <strong>${escapeHtml(row.label || "-")}</strong>
          <span>Kas: ${escapeHtml(row.muscle || "-")}</span>
          <span>Yağ: ${escapeHtml(row.fat || "-")}</span>
          <span>Direnç: ${escapeHtml(row.resistance || "-")}</span>
        </div>
      `,
    )
    .join("");
  const segmentPreviewHtml = segmentRowsHtml
    ? `<div class="tanita-preview-segments" aria-label="Segmental Tanita değerleri">${segmentRowsHtml}</div>`
    : "";

  tanitaPreview.innerHTML = `
    <h5>${escapeHtml(model.title || "Tanita ölçüm önizlemesi")}</h5>
    <div class="tanita-preview-grid">${metricsHtml}</div>
    ${segmentPreviewHtml}
    <p class="tanita-preview__summary">${escapeHtml(model.segmentSummary || "")}</p>
  `;
}

function handleBuildMeasurementReport() {
  renderMeasurementReport();
  setActiveScreen("measurement-report", { silent: true });
  measurementReportSection?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleMeasurementReportBack() {
  setActiveScreen("measurements", { silent: true });
}

function handlePrintMeasurementReport() {
  renderMeasurementReport();
  setActiveScreen("measurement-report", { silent: true });
  window.setTimeout(() => window.print(), 50);
}

function renderMeasurementReport() {
  if (window.BSMMeasurementReport) window.BSMMeasurementReport.render();
}

function syncMembersFromSupabase(options = {}) {
  state.supabaseStatus = window.supabaseClient?.from ? "Kontrol ediliyor" : "Kapalı";
  renderDashboard();

  loadSupabaseMemberRecords()
    .then((supabaseMembers) => {
      state.supabaseStatus = window.supabaseClient?.from ? getSupabaseConnectedStatus() : "Kapalı";

      if (!supabaseMembers.length) {
        if (state.members.length && window.BSMSupabaseSyncService?.isEnabled?.()) {
          persistStoredMembers(state.members, state.activeMemberId);
        }

        syncActiveMemberState();
        renderMemberWorkspace();
        renderNutritionWorkspace();
        renderDashboard();
        return;
      }

      const mergedMembers = mergeMemberLists(state.members, supabaseMembers);

      if (!mergedMembers.length) {
        renderDashboard();
        return;
      }

      state.activeMemberId = mergedMembers.some((member) => member.id === state.activeMemberId)
        ? state.activeMemberId
        : mergedMembers[0]?.id || null;
      saveActiveMemberId(state.activeMemberId);
      state.members = cacheMembersLocally(mergedMembers, state.activeMemberId);
      syncActiveMemberState();
      renderMemberWorkspace();
      renderNutritionWorkspace();
      renderDashboard();
    })
    .catch((error) => {
      state.supabaseStatus = "Bağlantı hatası";
      renderDashboard();
      console.warn("Supabase members sync error", error);
    });
}

function setupSupabaseRealtimeSync() {
  if (state.supabaseRealtimeSubscription || !window.BSMSupabaseSyncService?.subscribeToChanges) {
    return;
  }

  state.supabaseRealtimeSubscription = window.BSMSupabaseSyncService.subscribeToChanges((event) => {
    if (event?.status) {
      state.supabaseRealtimeActive = event.status === "SUBSCRIBED";
      state.supabaseStatus = state.supabaseRealtimeActive ? "Bağlı / Realtime aktif" : `Realtime: ${event.status}`;
      renderDashboard();
      return;
    }

    if (event?.table === "app_settings") {
      syncAppSettingsFromSupabase();
      return;
    }

    window.clearTimeout(state.supabaseRealtimeTimer);
    state.supabaseRealtimeTimer = window.setTimeout(() => {
      syncMembersFromSupabase({ source: "realtime" });
    }, 700);
  });
}

function getSupabaseConnectedStatus() {
  return state.supabaseRealtimeActive ? "Bağlı / Realtime aktif" : "Bağlı";
}

function syncAppSettingsFromSupabase() {
  if (!window.BSMSupabaseSyncService?.loadAppSettings) {
    return;
  }

  window.BSMSupabaseSyncService
    .loadAppSettings()
    .then((settings) => {
      const hasRemoteCustomExercises = Array.isArray(settings.customExercises);
      const hasRemoteHiddenExerciseIds = Array.isArray(settings.hiddenExerciseIds);

      if (hasRemoteCustomExercises) {
        state.customExercises = normalizeCustomExercises(settings.customExercises);
        saveToStorage(storageKeys.customExercises, state.customExercises);
      }

      if (hasRemoteHiddenExerciseIds) {
        state.hiddenExerciseIds = normalizeHiddenExerciseIds(settings.hiddenExerciseIds);
        saveToStorage(storageKeys.hiddenExerciseIds, state.hiddenExerciseIds);
      }

      if (hasRemoteCustomExercises || hasRemoteHiddenExerciseIds) {
        refreshExerciseLibrary();
        renderLibrary();
        return;
      }

      if (state.customExercises.length) {
        persistSupabaseAppSetting("customExercises", state.customExercises);
      }

      if (state.hiddenExerciseIds.length) {
        persistSupabaseAppSetting("hiddenExerciseIds", state.hiddenExerciseIds);
      }
    })
    .catch((error) => console.info("Supabase app settings sync skipped", error));
}

function persistSupabaseAppSetting(key, payload) {
  if (!window.BSMSupabaseSyncService?.persistAppSetting) {
    return;
  }

  window.BSMSupabaseSyncService.persistAppSetting(key, payload);
}

function normalizeHiddenExerciseIds(value) {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
}

function handleWorkflowAssistantAction(event) {
  const button = event.target.closest("[data-workflow-action]");

  if (!button) {
    return;
  }

  const action = button.dataset.workflowAction;

  if (action === "members") {
    setActiveScreen("builder", { userTriggered: true, silent: true });
    setWorkspaceView("members");
    memberSearch?.focus();
    return;
  }

  if (action === "measurements") {
    setActiveScreen("measurements", { userTriggered: true, silent: true });
    measurementDate?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (action === "build-program") {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
    return;
  }

  if (action === "save-member") {
    formHandlers.handleSaveMember();
    renderWorkflowAssistant();
    return;
  }

  if (action === "output") {
    setActiveScreen("output", { userTriggered: true });
    return;
  }

  if (action === "nutrition") {
    setActiveScreen("nutrition", { userTriggered: true, silent: true });
  }
}

function bindApplicationHandlers() {
  workflowAssistant?.addEventListener("click", handleWorkflowAssistantAction);
  form?.addEventListener("input", renderWorkflowAssistant);
  form?.addEventListener("change", renderWorkflowAssistant);
  [defaultSetCount, defaultRepModel, defaultRepPreset, defaultRestTime, defaultTempo, customRepPattern].forEach((control) => {
    control?.addEventListener("input", handleRepetitionTemplateControlChange);
    control?.addEventListener("change", handleRepetitionTemplateControlChange);
  });
  openMeasurementTabButton?.addEventListener("click", () => setActiveScreen("measurements", { userTriggered: true, silent: true }));
  bindFormHandlers(
    {
      form,
      fillExampleButton,
      loadSavedButton,
      saveMemberButton,
      newMemberButton,
      saveProgramButton,
      toggleProgramEditButton,
      saveProgramEditsButton,
      resetProgramEditsButton,
      saveMeasurementButton,
      tanitaCsvButton,
      tanitaCsvInput,
      tanitaImportStatus,
      tanitaPreview,
      saveTanitaMeasurementButton,
      weeklyPlan,
    },
    formHandlers,
  );
  bindNavigationHandlers(
    {
      studioNav,
      workspaceTabs,
      exerciseSearch,
      libraryGroupFilter,
      libraryEquipmentFilter,
      muscleGroupTabs,
      alphabetTabs,
      findExerciseButton,
      clearExerciseSearchButton,
      windowObject: window,
    },
    navigationHandlers,
  );
  bindMemberHandlers(
    {
      memberSearch,
      memberSort,
      memberList,
      programHistory,
      v3RevisionPanel,
      dashboardFocusPanel,
      coachAlertsPanel,
      coachQuickPanel,
      coachTaskPanel,
    },
    memberHandlers,
  );
  bindOutputHandlers(
    {
      copyPlanButton,
      printPlanButton,
      programPdfActionButton,
      downloadLiveProgramButton,
      sendProgramMailButton,
      programDeliveryStatus,
      programMailHistory,
      downloadBackupButton,
      restoreBackupButton,
      exportMembersCsvButton,
      restoreAutoBackupButton,
      backupFileInput,
    },
    outputHandlers,
  );
  // v1.1.8: Report Center UI etkilesimleri (toggle counter + thumbnail switch)
  try { bindReportCenterHandlers(); } catch (e) { /* defansif */ }
  bindNutritionHandlers(
    {
      generateNutritionButton,
      saveNutritionButton,
      printNutritionButton,
      nutritionPlanEditor,
      nutritionPanel,
    },
    nutritionHandlers,
  );
  nutritionPanel?.addEventListener("click", (e) => {
    if (e.target.closest("#sendNutritionMailButton")) nutritionHandlers.handleSendNutritionPlanEmail();
  });
  addCustomExerciseButton?.addEventListener("click", handleAddCustomExercise);
  resetCustomExerciseFormButton?.addEventListener("click", clearCustomExerciseForm);
  restoreHiddenExercisesButton?.addEventListener("click", handleRestoreHiddenExercises);
  exerciseLibraryEl?.addEventListener("click", handleLibraryExerciseAction);
  customExerciseList?.addEventListener("click", handleLibraryExerciseAction);
  activeMemberProfile?.addEventListener("click", handleWorkflowAssistantAction);
buildMeasurementReportButton?.addEventListener("click", handleBuildMeasurementReport);
measurementTabPdfButton?.addEventListener("click", handlePrintMeasurementReport);
measurementReportBackButton?.addEventListener("click", handleMeasurementReportBack);
  measurementReportPdfButton?.addEventListener("click", handlePrintMeasurementReport);
  measurementReportPrintButton?.addEventListener("click", handlePrintMeasurementReport);
  membersPanel?.addEventListener("click", handleMemberQuickAction);
  membersPanel?.addEventListener("click", (e) => {
    const target = e.target.closest("button[data-screen-target]");
    if (!target) return;
    if (target.hasAttribute("data-member-quick-action")) return;
    setActiveScreen(target.dataset.screenTarget, { userTriggered: true, silent: true });
  });
  // F5a: Member Rail kart tıklamaları — üye seçimini hızlı yapar, ekran değiştirmez.
  membersPanel?.addEventListener("click", (e) => {
    const railBtn = e.target.closest(".bsm-rail-card[data-rail-member-id]");
    if (!railBtn) return;
    const railMemberId = railBtn.dataset.railMemberId;
    const railMember = state.members.find((m) => m.id === railMemberId);
    if (railMember) selectActiveMemberFromRail(railMember);
  });
  // F5b: Wizard step + footer nav click delegasyonu
  membersPanel?.addEventListener("click", (e) => {
    const stepBtn = e.target.closest("button[data-wizard-step]");
    if (stepBtn) {
      setActiveWizardStep(stepBtn.dataset.wizardStep);
      return;
    }
    const navBtn = e.target.closest("button[data-wizard-nav]");
    if (navBtn && !navBtn.disabled) {
      shiftWizardStep(navBtn.dataset.wizardNav === "next" ? 1 : -1);
    }
  });
  // F5c: Utility Panel "Hızlı İşlemler" butonları
  membersPanel?.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("button[data-utility-action]");
    if (!actionBtn) return;
    const action = actionBtn.dataset.utilityAction;
    if (BSM_WIZARD_STEPS.find((s) => s.id === action)) {
      setActiveWizardStep(action);
    }
  });
  // F5e: Hero avatar edit overlay tıklaması → photo modal aç
  membersPanel?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("button[data-photo-edit]");
    if (!editBtn) return;
    openPhotoModal(editBtn.dataset.photoEdit);
  });
  // F5e: Photo modal binding (idempotent)
  bindPhotoModalHandlers();
  document.addEventListener("click", handleExerciseGifModalClick);
  document.addEventListener("error", handleExerciseGifError, true);
  document.addEventListener("keydown", handleExerciseGifModalKeydown);

  setupAppShellSidebar(navigationHandlers);
}

function setupAppShellSidebar(navigationHandlers) {
  const appSidebar = document.querySelector("#appSidebar");
  const hamburger = document.querySelector("#appTopbarHamburger");
  const backdrop = document.querySelector("#appSidebarBackdrop");
  const userSlot = document.querySelector("#appTopbarUserSlot");
  const userBadge = document.querySelector("#authUserBadge");

  if (appSidebar && navigationHandlers?.handleScreenNavClick) {
    appSidebar.addEventListener("click", navigationHandlers.handleScreenNavClick);
  }

  if (userSlot && userBadge) {
    userSlot.appendChild(userBadge);
  }

  function setDrawer(open) {
    const next = typeof open === "boolean" ? open : !document.body.classList.contains("app-sidebar-open");
    document.body.classList.toggle("app-sidebar-open", next);
    if (hamburger) hamburger.setAttribute("aria-expanded", String(next));
  }

  hamburger?.addEventListener("click", () => setDrawer());
  backdrop?.addEventListener("click", () => setDrawer(false));
  appSidebar?.addEventListener("click", (event) => {
    if (event.target.closest("[data-screen-target]")) setDrawer(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("app-sidebar-open")) {
      setDrawer(false);
    }
  });

  syncSidebarActive();
  document.querySelector(".studio-nav")?.addEventListener("click", () => requestAnimationFrame(syncSidebarActive));
  appSidebar?.addEventListener("click", () => requestAnimationFrame(syncSidebarActive));
}

function syncSidebarActive() {
  const activeScreen = state.activeScreen
    || document.querySelector(".studio-nav button.is-active")?.dataset.screenTarget
    || "members";
  document.querySelectorAll(".app-sidebar__item[data-screen-target]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.screenTarget === activeScreen);
  });
}

function handleAddCustomExercise() {
  const exercise = collectCustomExerciseForm();
  const validationError = validateCustomExercise(exercise);

  if (validationError) {
    setCustomExerciseStatus(validationError, "error");
    return;
  }

  state.customExercises = [...state.customExercises, exercise];
  persistCustomExercises();
  refreshExerciseLibrary();
  clearCustomExerciseForm();
  setCustomExerciseStatus(`${exercise.name} kütüphaneye eklendi.`, "success");
  renderLibrary();
}

function handleLibraryExerciseAction(event) {
  const button = event.target.closest("[data-exercise-library-action]");

  if (!button) {
    return;
  }

  const exerciseId = button.dataset.exerciseId;
  const action = button.dataset.exerciseLibraryAction;

  if (action === "remove-custom") {
    removeCustomExercise(exerciseId);
    return;
  }

  if (action === "hide") {
    hideLibraryExercise(exerciseId);
  }
}

function handleRestoreHiddenExercises() {
  if (!state.hiddenExerciseIds.length) {
    setCustomExerciseStatus("Geri getirilecek gizlenmiş hareket yok.", "neutral");
    return;
  }

  state.hiddenExerciseIds = [];
  persistHiddenExerciseIds();
  refreshExerciseLibrary();
  setCustomExerciseStatus("Gizlenen hazır hareketler tekrar kütüphaneye eklendi.", "success");
  renderLibrary();
}

function collectCustomExerciseForm() {
  const name = String(customExerciseName?.value || "").trim();
  const group = normalizeExerciseGroup(customExerciseGroup?.value);

  return normalizeCustomExercise({
    id: makeUniqueCustomExerciseId(name, group),
    name,
    group,
    equipment: customExerciseEquipment?.value,
    kind: customExerciseKind?.value,
    level: customExerciseLevel?.value,
    cue: customExerciseCue?.value,
    gifUrl: customExerciseGifUrl?.value,
    tags: ["custom"],
  });
}

function validateCustomExercise(exercise) {
  if (!exercise?.name) {
    return "Hareket adı boş olamaz.";
  }

  const duplicate = [...baseExerciseLibrary, ...state.customExercises].some(
    (item) => item.group === exercise.group && normalizeText(item.name) === normalizeText(exercise.name),
  );

  if (duplicate) {
    return "Bu kas grubunda aynı isimle bir hareket zaten var.";
  }

  return "";
}

function makeUniqueCustomExerciseId(name, group) {
  const baseId = makeCustomExerciseId(name, group);
  const existingIds = new Set([...baseExerciseLibrary, ...state.customExercises].map((exercise) => exercise.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  return `${baseId}-${Date.now().toString(36)}`;
}

function removeCustomExercise(exerciseId) {
  const exercise = state.customExercises.find((item) => item.id === exerciseId);

  if (!exercise) {
    setCustomExerciseStatus("Silinecek özel hareket bulunamadı.", "error");
    return;
  }

  state.customExercises = state.customExercises.filter((item) => item.id !== exerciseId);
  persistCustomExercises();
  refreshExerciseLibrary();
  setCustomExerciseStatus(`${exercise.name} özel hareketlerden silindi.`, "success");
  renderLibrary();
}

function hideLibraryExercise(exerciseId) {
  const exercise = exerciseLibrary.find((item) => item.id === exerciseId);

  if (!exercise) {
    setCustomExerciseStatus("Gizlenecek hareket bulunamadı.", "error");
    return;
  }

  if (exercise.isCustom) {
    removeCustomExercise(exerciseId);
    return;
  }

  state.hiddenExerciseIds = [...new Set([...state.hiddenExerciseIds, exerciseId])];
  persistHiddenExerciseIds();
  refreshExerciseLibrary();
  setCustomExerciseStatus(`${exercise.name} hazır kütüphaneden gizlendi.`, "success");
  renderLibrary();
}

function clearCustomExerciseForm() {
  if (customExerciseName) customExerciseName.value = "";
  if (customExerciseGifUrl) customExerciseGifUrl.value = "";
  if (customExerciseCue) customExerciseCue.value = "";
  if (customExerciseKind) customExerciseKind.value = "compound";
  if (customExerciseLevel) customExerciseLevel.value = "intermediate";
}

function setCustomExerciseStatus(message, type = "neutral") {
  if (!customExerciseStatus) {
    return;
  }

  customExerciseStatus.textContent = message;
  customExerciseStatus.dataset.state = type;
}

function handleExerciseGifModalClick(event) {
  const openButton = event.target.closest("[data-exercise-gif-open]");

  if (openButton) {
    const mediaCard = openButton.closest("[data-exercise-media]");

    if (mediaCard?.classList.contains("is-missing")) {
      return;
    }

    openExerciseGifModal({
      gifUrl: openButton.dataset.gifUrl,
      name: openButton.dataset.exerciseName,
      group: openButton.dataset.exerciseGroup,
    });
    return;
  }

  if (event.target.closest("[data-gif-modal-close]")) {
    closeExerciseGifModal();
  }
}

function handleExerciseGifError(event) {
  const image = event.target;

  if (!image?.matches?.("[data-exercise-gif-img]")) {
    return;
  }

  const openButton = image.closest("[data-exercise-gif-open]");
  const failedUrl = image.getAttribute("src") || "";
  const exerciseName = openButton?.dataset.exerciseName || image.alt || "Bilinmeyen hareket";
  console.warn(`EXERCISE GIF LOAD FAILED: ${exerciseName} -> ${failedUrl}`);
  const fallbackUrl = getNextExerciseGifFallbackUrl(image, openButton);

  if (fallbackUrl) {
    image.src = fallbackUrl;
    if (openButton) {
      openButton.dataset.gifUrl = fallbackUrl;
    }
    return;
  }

  image.closest("[data-exercise-media]")?.classList.add("is-missing");
  image.removeAttribute("src");
}

function getNextExerciseGifFallbackUrl(image, openButton) {
  const fallbackUrls = getExerciseGifFallbackUrls(openButton);
  const triedUrls = new Set(String(image.dataset.fallbackTriedUrls || "").split("|").filter(Boolean));
  const currentUrl = image.getAttribute("src") || "";

  if (currentUrl) {
    triedUrls.add(currentUrl);
  }

  const nextUrl = fallbackUrls.find((url) => url && !triedUrls.has(url));

  if (nextUrl) {
    triedUrls.add(nextUrl);
    image.dataset.fallbackTriedUrls = [...triedUrls].join("|");
  }

  return nextUrl || "";
}

function getExerciseGifFallbackUrls(openButton) {
  const multiValue = String(openButton?.dataset.gifFallbackUrls || "").split("|").filter(Boolean);
  const singleValue = openButton?.dataset.gifFallbackUrl ? [openButton.dataset.gifFallbackUrl] : [];

  return [...new Set([...multiValue, ...singleValue])];
}

function handleExerciseGifModalKeydown(event) {
  if (event.key === "Escape" && !exerciseGifModal?.classList.contains("is-hidden")) {
    closeExerciseGifModal();
  }
}

function openExerciseGifModal({ gifUrl, name, group }) {
  if (!exerciseGifModal || !exerciseGifModalImage || !gifUrl) {
    return;
  }

  exerciseGifModalImage.src = gifUrl;
  exerciseGifModalImage.alt = `${name || "Egzersiz"} GIF`;
  if (exerciseGifModalTitle) {
    exerciseGifModalTitle.textContent = name || "Egzersiz GIF";
  }
  if (exerciseGifModalGroup) {
    exerciseGifModalGroup.textContent = group || "Hareket";
  }
  exerciseGifModal.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
}

function closeExerciseGifModal() {
  if (!exerciseGifModal) {
    return;
  }

  exerciseGifModal.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
  if (exerciseGifModalImage) {
    exerciseGifModalImage.removeAttribute("src");
  }
}

function hydrateInitialSession() {
  hydrateSavedFormDraft();
  hydrateActiveMemberSession();
  hydrateLastSavedProgram();
}

function hydrateSavedFormDraft() {
  const lastForm = loadLastForm();

  if (lastForm) {
    populateForm(lastForm);
  }

  formHandlers.handleLiveUpdate();
}

function hydrateActiveMemberSession() {
  const activeMember = findActiveMember();

  if (!activeMember) {
    return null;
  }

  populateForm(activeMember.profile);
  formHandlers.handleLiveUpdate();
  renderMemberWorkspace();

  if (activeMember.programs?.[0]?.program) {
    renderProgram(activeMember.programs[0].program, { savedProgramRecordId: activeMember.programs[0].id });
  }

  state.activeNutritionPlan = normalizeNutritionPlan(activeMember.nutritionPlan || activeMember.nutritionPlans?.[0]) || null;
  state.activeNutritionMemberId = activeMember.id;
  renderNutritionWorkspace();

  return activeMember;
}

function hydrateLastSavedProgram() {
  const lastPlan = loadLastPlan();

  if (!state.activeProgram && lastPlan?.schemaVersion === schemaVersion) {
    renderProgram(lastPlan);
  }
}

function populateStaticFilters() {
  muscleGroups.forEach((group) => {
    const priorityOption = document.createElement("option");
    priorityOption.value = group.id;
    priorityOption.textContent = group.label;
    priorityMuscle.appendChild(priorityOption);

    const libraryOption = document.createElement("option");
    libraryOption.value = group.id;
    libraryOption.textContent = group.label;
    libraryGroupFilter.appendChild(libraryOption);

    if (customExerciseGroup) {
      const customGroupOption = document.createElement("option");
      customGroupOption.value = group.id;
      customGroupOption.textContent = group.label;
      customExerciseGroup.appendChild(customGroupOption);
    }
  });

  Object.entries(equipmentLabels).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    libraryEquipmentFilter.appendChild(option);

    if (customExerciseEquipment) {
      const customEquipmentOption = document.createElement("option");
      customEquipmentOption.value = value;
      customEquipmentOption.textContent = label;
      customExerciseEquipment.appendChild(customEquipmentOption);
    }
  });

  muscleGroupTabs.innerHTML = [
    `<button type="button" class="muscle-tab is-active" data-group="all">Tümü</button>`,
    ...muscleGroups.map(
      (group) => `<button type="button" class="muscle-tab" data-group="${group.id}">${group.label}</button>`,
    ),
  ].join("");

  alphabetTabs.innerHTML = turkishAlphabet
    .map(
      (letter) =>
        `<button type="button" class="alphabet-tab ${letter === "all" ? "is-active" : ""}" data-letter="${letter}">${
          letter === "all" ? "Tümü" : letter
        }</button>`,
    )
    .join("");
}

function populateProgramStyleOptions() {
  const styleSelect = form.querySelector("#programStyle");

  if (!styleSelect) {
    return;
  }

  styleSelect.innerHTML = "";

  programStyleOptions.forEach((option) => {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    styleSelect.appendChild(optionEl);
  });

  styleSelect.value = "auto";
}

function prepareRepetitionTemplateControls() {
  if (repetitionBuilder?.parentElement?.tagName === "FIELDSET") {
    repetitionBuilder.parentElement.before(repetitionBuilder);
  }

  populateRepetitionPresetOptions();
  updateRepetitionTemplatePreview();
}

function populateRepetitionPresetOptions() {
  if (!defaultRepPreset) {
    return;
  }

  const sets = Number(defaultSetCount?.value || 3);
  const model = normalizeRepModel(defaultRepModel?.value || "pyramid");
  const customOption = `<option value="custom">${model === "custom" ? "Manuel giriş" : "Custom / manuel giriş"}</option>`;
  const matchingPresets = repetitionPresets.filter((preset) => Number(preset.sets) === sets && preset.model === model);
  const fallbackPresets = repetitionPresets.filter((preset) => Number(preset.sets) === sets);
  const options = (matchingPresets.length ? matchingPresets : fallbackPresets)
    .map((preset) => `<option value="${preset.id}">${preset.reps.join(" • ")}</option>`)
    .join("");

  const previousValue = defaultRepPreset.value;
  defaultRepPreset.innerHTML = `${options}${customOption}`;

  if ([...defaultRepPreset.options].some((option) => option.value === previousValue)) {
    defaultRepPreset.value = previousValue;
  } else if (model === "custom") {
    defaultRepPreset.value = "custom";
  }
}

function updateRepetitionTemplatePreview() {
  if (!repTemplatePreview) {
    return;
  }

  const template = readRepetitionTemplateFromForm();
  repTemplatePreview.innerHTML = `
    <strong>${template.sets} Sets</strong>
    <span>${escapeHtml(template.repPattern.join(" • "))}</span>
    <em>${escapeHtml(getRepetitionModelLabel(template.model))} • ${escapeHtml(template.rest || "Dinlenme otomatik")} • ${escapeHtml(template.tempo || "Tempo otomatik")}</em>
  `;
}

function handleRepetitionTemplateControlChange(event) {
  if (event?.target === defaultSetCount || event?.target === defaultRepModel) {
    populateRepetitionPresetOptions();
  }

  if (event?.target === customRepPattern && defaultRepModel) {
    defaultRepModel.value = "custom";
    populateRepetitionPresetOptions();
    if (defaultRepPreset) defaultRepPreset.value = "custom";
  }

  updateRepetitionTemplatePreview();
}


// Navigasyon mantığı core/router.js → BSMRouter'a taşındı.
// Bu fonksiyonlar geriye uyumluluk için ince wrapper olarak korunur.
// Handler'lar hâlâ bu isimleri dependency injection ile alıyor.

function setActiveScreen(screen, options) {
  const result = window.BSMRouter ? window.BSMRouter.navigate(screen, options) : false;
  if (typeof syncSidebarActive === "function") syncSidebarActive();
  return result;
}

function activateScreen(screenName) {
  var panels = document.querySelectorAll(".screen-panel");
  var found = false;
  panels.forEach(function (panel) {
    if (panel.dataset.screen === screenName) {
      panel.classList.remove("is-hidden");
      found = true;
    } else {
      panel.classList.add("is-hidden");
    }
  });
  document.querySelectorAll(".studio-nav button[data-screen-target]").forEach(function (btn) {
    btn.classList.toggle("is-active", btn.dataset.screenTarget === screenName);
  });
  if (!found) console.error("[BSM] activateScreen: panel bulunamadı →", screenName);
  else console.log("[BSM] activateScreen:", screenName, "— panel gösterildi");
}

function initNavigation() {
  var navBtns = document.querySelectorAll(".studio-nav button[data-screen-target]");
  console.log("[BSM] initNavigation: buton sayısı =", navBtns.length);
  navBtns.forEach(function (btn) {
    if (btn.dataset.navBound === "true") return;
    btn.dataset.navBound = "true";
    btn.addEventListener("click", function () {
      activateScreen(this.dataset.screenTarget);
    });
    console.log("[BSM] listener bağlandı:", btn.dataset.screenTarget);
  });
}

function inferScreenFromHash(hashValue) {
  return window.BSMRouter ? window.BSMRouter.inferFromHash(hashValue) : "dashboard";
}

function setWorkspaceView(view) {
  if (window.BSMRouter) window.BSMRouter.setView(view);
}


function collectFormData() {
  const formData = new FormData(form);
  const selectedDays = dayMeta
    .filter((day) => formData.getAll("days").includes(day.value))
    .map((day) => day.value);

  return {
    gymName: String(formData.get("gymName") || "").trim(),
    memberName: String(formData.get("memberName") || "").trim(),
    memberCode: String(formData.get("memberCode") || "").trim(),
    memberEmail: String(formData.get("memberEmail") || "").trim(),
    trainerName: String(formData.get("trainerName") || "").trim(),
    goal: String(formData.get("goal") || ""),
    level: String(formData.get("level") || ""),
    programStyle: normalizeProgramStyleValue(String(formData.get("programStyle") || "auto")),
    trainingSystem: normalizeTrainingSystem(String(formData.get("trainingSystem") || "standard")),
    equipmentScope: String(formData.get("equipmentScope") || "full-gym"),
    duration: Number(formData.get("duration") || 60),
    priorityMuscle: String(formData.get("priorityMuscle") || "balanced"),
    cardioPreference: String(formData.get("cardioPreference") || "balanced"),
    repetitionTemplate: readRepetitionTemplateFromForm(formData),
    restrictions: formData.getAll("restrictions").map(String),
    days: selectedDays,
    notes: String(formData.get("notes") || "").trim(),
  };
}

function validateFormData(data) {
  return validateFormDataService(data);
}

function buildFormValidationErrors(data) {
  return buildFormValidationErrorsService(data);
}

function validateMeasurementData(measurement) {
  return validateMeasurementDataService(measurement, { parseCalendarInputDate });
}

function populateForm(data) {
  form.querySelector("#gymName").value = data.gymName || "Bahçeşehir Spor Merkezi";
  form.querySelector("#memberName").value = data.memberName || data.userName || "";
  form.querySelector("#memberCode").value = data.memberCode || "";
  form.querySelector("#memberEmail").value = data.memberEmail || data.email || "";
  form.querySelector("#trainerName").value = data.trainerName || "";
  form.querySelector("#goal").value = data.goal || "";
  form.querySelector("#level").value = data.level || "";
  form.querySelector("#programStyle").value = normalizeProgramStyleValue(data.programStyle || "auto");
  form.querySelector("#trainingSystem").value = normalizeTrainingSystem(data.trainingSystem || "standard");
  form.querySelector("#equipmentScope").value = data.equipmentScope || (data.location === "gym" ? "full-gym" : "standard-gym");
  form.querySelector("#duration").value = String(data.duration || 60);
  form.querySelector("#priorityMuscle").value = data.priorityMuscle || "balanced";
  form.querySelector("#notes").value = data.notes || "";

  const repetitionTemplate = data.repetitionTemplate || {};
  if (defaultSetCount) defaultSetCount.value = String(repetitionTemplate.sets || 3);
  if (defaultRepModel) defaultRepModel.value = normalizeRepModel(repetitionTemplate.model || "pyramid");
  populateRepetitionPresetOptions();
  if (
    defaultRepPreset &&
    repetitionTemplate.presetId &&
    [...defaultRepPreset.options].some((option) => option.value === repetitionTemplate.presetId)
  ) {
    defaultRepPreset.value = repetitionTemplate.presetId;
  } else if (defaultRepPreset && normalizeRepModel(repetitionTemplate.model) === "custom") {
    defaultRepPreset.value = "custom";
  }
  if (defaultRestTime) defaultRestTime.value = repetitionTemplate.rest || "60-90 sn";
  if (defaultTempo) defaultTempo.value = repetitionTemplate.tempo || "2-0-2";
  if (customRepPattern) customRepPattern.value = repetitionTemplate.customPattern || "";
  updateRepetitionTemplatePreview();

  form.querySelectorAll('input[name="cardioPreference"]').forEach((input) => {
    input.checked = input.value === (data.cardioPreference || "balanced");
  });

  form.querySelectorAll('input[name="days"]').forEach((input) => {
    input.checked = (data.days || []).includes(input.value);
  });

  form.querySelectorAll('input[name="restrictions"]').forEach((input) => {
    input.checked = (data.restrictions || []).includes(input.value);
  });
}

function upsertMemberFromCurrentForm(options = {}) {
  const profile = collectFormData();

  if (!profile.memberName && !profile.memberCode) {
    if (!options.silent) {
      showStatus("Üye dosyası kaydetmek için en az üye adı veya üye no girin.", "error");
    } else {
      const silentMessage =
        state.activeScreen === "measurements"
          ? "Ölçüm kaydetmek için önce üye seçin veya Üye ve Program sekmesinde yeni üye oluşturun."
          : "Programı geçmişe kaydetmek için önce üye adı veya üye no girin.";
      showStatus(silentMessage, "error");
    }
    return null;
  }

  const now = new Date().toISOString();
  let member = findActiveMember();

  if (!member) {
    const matchedMember = findMatchingMemberRecord(profile);
    member = matchedMember || {
      id: makeId("member"),
      createdAt: now,
      measurements: [],
      programs: [],
    };

    if (!matchedMember) {
      state.members.unshift(member);
    }
  }

  // F5e: Mevcut profil fotoğrafını koru — collectFormData() photo alanı içermez,
  // bu nedenle save sırasında photo silinmemeli. Diğer field'lar formdan gelen
  // değerlerle güncellenmeye devam eder.
  if (member.profile?.photo && !profile.photo) {
    profile.photo = member.profile.photo;
  }
  member.profile = profile;
  member.updatedAt = now;
  state.activeMemberId = member.id;
  state.activeMember = member;
  state.latestMeasurement = member.measurements?.[0] || state.latestMeasurement || null;
  saveActiveMemberId(member.id);
  persistMembers();
  member = findActiveMember() || member;
  state.activeMember = member;
  state.latestMeasurement = member.measurements?.[0] || state.latestMeasurement || null;
  renderMemberWorkspace();
  return member;
}

function loadMember(member) {
  state.activeMemberId = member.id;
  state.activeMember = member;
  state.latestMeasurement = member.measurements?.[0] || null;
  state.pendingTanitaMeasurement = null;
  setActiveMeasurementState(state.latestMeasurement, { memberId: member.id, source: "saved" });
  saveActiveMemberId(member.id);
  populateForm(member.profile || {});
  clearMeasurementInputs();
  measurementDate.value = getTodayInputValue();
  formHandlers.handleLiveUpdate();
  renderMemberWorkspace();
  setActiveScreen("builder", { silent: true });

  if (member.programs?.[0]?.program) {
    renderProgram(cloneData(member.programs[0].program), { savedProgramRecordId: member.programs[0].id });
  } else {
    resultsSection.classList.add("hidden");
    state.activeProgram = null;
  }

  state.activeNutritionPlan = normalizeNutritionPlan(member.nutritionPlan || member.nutritionPlans?.[0]) || null;
  state.activeNutritionMemberId = member.id;
  renderNutritionWorkspace();
  renderNutritionOutput();

  showStatus(`${member.profile?.memberName || "Üye"} dosyası yüklendi.`, "success");
}

// F5a: Rail click wrapper — üye seçimini hızlı yapar, ekran değiştirmez.
// loadMember() ile farkı: setActiveScreen("builder") çağırmaz, üye Üyeler ekranında kalır.
function selectActiveMemberFromRail(member) {
  if (!member) return;
  state.activeMemberId = member.id;
  state.activeMember = member;
  state.latestMeasurement = member.measurements?.[0] || null;
  state.pendingTanitaMeasurement = null;
  setActiveMeasurementState(state.latestMeasurement, { memberId: member.id, source: "saved" });
  saveActiveMemberId(member.id);

  // F5j: Brief skeleton flash ile geçiş hissi ver (premium snappy feel)
  flashWorkspaceSkeleton();

  // Builder form'unu da güncel tut (sonra Program Oluştur sekmesine geçtiğinde dolu gelsin)
  try { populateForm(member.profile || {}); } catch (e) { /* form yoksa sessiz geç */ }
  try {
    if (measurementDate) measurementDate.value = getTodayInputValue();
    clearMeasurementInputs();
  } catch (e) { /* ölçüm input'ları yoksa sessiz */ }
  try { formHandlers?.handleLiveUpdate?.(); } catch (e) { /* */ }

  state.activeNutritionPlan = normalizeNutritionPlan(member.nutritionPlan || member.nutritionPlans?.[0]) || null;
  state.activeNutritionMemberId = member.id;

  renderMemberWorkspace();
}

// F5j: Workspace switch sırasında 120ms skeleton flash (CSS-only kontrol).
// prefers-reduced-motion altinda otomatik devre disi (CSS @media).
function flashWorkspaceSkeleton() {
  const panel = document.querySelector("#membersPanel");
  if (!panel) return;
  panel.classList.add("is-switching");
  // Re-trigger animation: force reflow
  void panel.offsetWidth;
  setTimeout(() => panel.classList.remove("is-switching"), 280);
}

function renderMemberWorkspace() {
  renderDashboard();
  renderMembersKpiStrip();
  renderWorkflowAssistant();
  renderMeasurementTabStatus();
  renderWorkspacePanels();
  renderNutritionWorkspace();
  renderNutritionOutput();
  // F5b: Workspace wizard bar + footer
  renderWizardBar();
  renderWizardFooter();
  // F5c: Workspace hero + content + utility panel
  renderWorkspaceHero();
  renderWizardContent();
  renderUtilityPanel();
  // F5e: Initials avatar'larına pastel HSL accent uygula
  applyMemberAccentToAvatars(document.querySelector("#bsmMemberRail"));
  applyMemberAccentToAvatars(document.querySelector("#bsmWorkspaceHero"));
}

// ════════════════════════════════════════════════════════════════
// F5c: Workspace Hero + Content + Utility Panel
// ════════════════════════════════════════════════════════════════

function renderWorkspaceHero() {
  const host = document.querySelector("#bsmWorkspaceHero");
  if (!host) return;
  const member = findActiveMember();
  if (!member) {
    host.innerHTML = `
      <div class="bsm-hero-empty">
        <strong>Aktif üye seçilmedi</strong>
        <span>Sol panelden bir üye seçtiğinizde profili burada görüntülenecek.</span>
      </div>
    `;
    return;
  }

  const profile = member.profile || {};
  const goalLabel = labelMaps.goal[profile.goal] || "Hedef belirtilmedi";
  const initials = buildMemberInitials(profile.memberName, profile.memberCode);
  const photo = profile.photo || null;
  const lastUpdate = relativeTimeShort(member.updatedAt || member.createdAt);
  const completedCount = countCompletedWizardSteps(member);
  const progressPct = Math.round((completedCount / BSM_WIZARD_STEPS.length) * 100);
  const memberStatus = member.measurements?.length > 0 ? "Aktif Üye" : "Yeni Üye";

  const accent = getMemberAccent(member);
  const accentStyle = `background: linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`;

  host.innerHTML = `
    <div class="bsm-hero-card" data-member-id="${escapeHtml(member.id)}">
      <button type="button" class="bsm-hero-card__avatar" data-photo-edit="${escapeHtml(member.id)}" aria-label="Profil fotoğrafını değiştir" title="Profil fotoğrafını değiştir" style="${photo ? "" : accentStyle}">
        ${photo
          ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
          : `<span class="bsm-hero-card__initials">${escapeHtml(initials)}</span>`}
        <span class="bsm-hero-card__edit" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </span>
      </button>
      <div class="bsm-hero-card__body">
        <div class="bsm-hero-card__title">
          <h3>${escapeHtml(profile.memberName || "İsimsiz Üye")}</h3>
          <span class="bsm-pill bsm-pill--${memberStatus === "Aktif Üye" ? "active" : "warning"}">${escapeHtml(memberStatus)}</span>
        </div>
        <p class="bsm-hero-card__goal">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
          <span>Hedef: <strong>${escapeHtml(goalLabel)}</strong></span>
        </p>
        <p class="bsm-hero-card__meta">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>Son güncelleme: ${escapeHtml(lastUpdate)}</span>
        </p>
      </div>
      <div class="bsm-hero-card__progress">
        <div class="bsm-hero-card__progress-head">
          <span>Genel İlerleme</span>
          <strong>%${progressPct}</strong>
        </div>
        <div class="bsm-hero-card__progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}">
          <span class="bsm-hero-card__progress-fill" style="width: ${progressPct}%"></span>
        </div>
        <small>${completedCount} / ${BSM_WIZARD_STEPS.length} adım tamamlandı</small>
      </div>
    </div>
  `;
}

function countCompletedWizardSteps(member) {
  const states = computeWizardStepStates(member);
  return Object.values(states).filter((v) => v === "completed").length;
}

function buildMemberInitials(memberName, memberCode) {
  const source = String(memberName || memberCode || "").trim();
  if (!source) return "BSM";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("tr");
  return source.slice(0, 2).toLocaleUpperCase("tr");
}

// BSM_AVATAR_PALETTE artik dosyanin basinda (hotfix - TDZ fix).

function bsmHashString(str) {
  const s = String(str || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getMemberAccent(memberOrProfile) {
  const seed = memberOrProfile?.id
    || memberOrProfile?.memberId
    || memberOrProfile?.profile?.memberCode
    || memberOrProfile?.profile?.memberName
    || memberOrProfile?.memberCode
    || memberOrProfile?.memberName
    || "bsm";
  const idx = bsmHashString(seed) % BSM_AVATAR_PALETTE.length;
  return BSM_AVATAR_PALETTE[idx];
}

function applyMemberAccentToAvatars(root) {
  if (!root) return;
  const nodes = root.querySelectorAll("[data-member-id], [data-rail-member-id]");
  nodes.forEach((el) => {
    const id = el.dataset.memberId || el.dataset.railMemberId;
    if (!id) return;
    const member = state.members?.find?.((m) => m.id === id);
    const seed = member ? { id: member.id, profile: member.profile } : { id };
    const accent = getMemberAccent(seed);
    const av = el.querySelector(".bsm-rail-card__avatar, .bsm-hero-card__avatar");
    if (av && !av.querySelector("img")) {
      av.style.background = `linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`;
    }
  });
}

// ════════════════════════════════════════════════════════════════
// F5e: Profile Photo Pipeline (file → canvas crop → WebP/PNG dataURL)
// ════════════════════════════════════════════════════════════════

const BSM_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const BSM_PHOTO_TARGET = 300;                // 300x300 square
const BSM_PHOTO_QUALITY = 0.85;

let _bsmPhotoState = {
  memberId: null,
  webcamStream: null,
  pendingCaptureDataUrl: null,
};

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Görsel yüklenemedi."));
    img.src = url;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(file);
  });
}

// Image element → square center crop → resize 300x300 → WebP dataURL (fallback PNG)
function imageToSquareDataUrl(img, size = BSM_PHOTO_TARGET, quality = BSM_PHOTO_QUALITY) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error("Görsel boyutları okunamadı.");
  const side = Math.min(w, h);
  const sx = Math.max(0, (w - side) / 2);
  const sy = Math.max(0, (h - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  // WebP dene, desteklenmezse PNG'ye düş
  let dataUrl;
  try { dataUrl = canvas.toDataURL("image/webp", quality); } catch (e) { dataUrl = null; }
  if (!dataUrl || !dataUrl.startsWith("data:image/webp")) {
    dataUrl = canvas.toDataURL("image/png");
  }
  return dataUrl;
}

async function processImageFile(file) {
  if (!file) throw new Error("Dosya yok.");
  if (!/^image\//.test(file.type)) throw new Error("Sadece görsel dosya kabul edilir.");
  if (file.size > BSM_PHOTO_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Dosya çok büyük (${mb} MB). Maksimum 5 MB olmalı.`);
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageFromUrl(dataUrl);
  return imageToSquareDataUrl(img);
}

// Persist: member.profile.photo'yu güncelle + member-service üzerinden kaydet
function setMemberPhoto(memberId, dataUrl) {
  if (!memberId || !dataUrl) return null;
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return null;
  member.profile = { ...(member.profile || {}), photo: dataUrl };
  member.updatedAt = new Date().toISOString();
  if (state.activeMember?.id === memberId) {
    state.activeMember = member;
  }
  persistMembers();
  renderMemberWorkspace();
  return member;
}

function setMemberPhotoRemove(memberId) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return null;
  if (member.profile) {
    const { photo, ...rest } = member.profile;
    member.profile = rest;
  }
  member.updatedAt = new Date().toISOString();
  persistMembers();
  renderMemberWorkspace();
  return member;
}

// ── Photo Modal Control ─────────────────────────────────────────

function openPhotoModal(memberId) {
  const modal = document.querySelector("#bsmPhotoModal");
  if (!modal || !memberId) return;
  _bsmPhotoState.memberId = memberId;
  _bsmPhotoState.pendingCaptureDataUrl = null;
  setPhotoModalTab("upload");
  showPhotoError("");
  setPhotoLoading(false);
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("bsm-photo-modal-open");
}

function closePhotoModal() {
  const modal = document.querySelector("#bsmPhotoModal");
  if (!modal) return;
  stopWebcamStream();
  resetWebcamUi();
  _bsmPhotoState.memberId = null;
  _bsmPhotoState.pendingCaptureDataUrl = null;
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("bsm-photo-modal-open");
}

function setPhotoModalTab(tabId) {
  document.querySelectorAll(".bsm-photo-modal__tab").forEach((btn) => {
    const isActive = btn.dataset.photoTab === tabId;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll(".bsm-photo-tabpanel").forEach((panel) => {
    const isActive = panel.id === `bsmPhotoTab${tabId === "upload" ? "Upload" : "Webcam"}Panel`;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
  showPhotoError("");
  if (tabId !== "webcam") {
    stopWebcamStream();
    resetWebcamUi();
  }
}

function setPhotoLoading(isLoading) {
  const el = document.querySelector("#bsmPhotoLoading");
  if (el) el.classList.toggle("is-hidden", !isLoading);
}

function showPhotoError(message) {
  const el = document.querySelector("#bsmPhotoError");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("is-visible", Boolean(message));
}

// ── File Upload (drag-drop + file picker) ───────────────────────

async function handlePhotoFile(file) {
  if (!file || !_bsmPhotoState.memberId) return;
  try {
    showPhotoError("");
    setPhotoLoading(true);
    const dataUrl = await processImageFile(file);
    setMemberPhoto(_bsmPhotoState.memberId, dataUrl);
    setPhotoLoading(false);
    closePhotoModal();
    showStatus("Profil fotoğrafı güncellendi.", "success");
  } catch (err) {
    setPhotoLoading(false);
    showPhotoError(err.message || "Fotoğraf işlenemedi.");
  }
}

function bindPhotoModalHandlers() {
  const modal = document.querySelector("#bsmPhotoModal");
  if (!modal) return;
  if (modal.dataset.photoBound === "true") return;
  modal.dataset.photoBound = "true";

  // Close handlers
  modal.querySelectorAll("[data-photo-modal-close]").forEach((el) => {
    el.addEventListener("click", closePhotoModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("is-hidden")) {
      closePhotoModal();
    }
  });

  // Tab switching
  modal.querySelectorAll(".bsm-photo-modal__tab[data-photo-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setPhotoModalTab(btn.dataset.photoTab));
  });

  // Dropzone
  const dropzone = modal.querySelector("#bsmPhotoDropzone");
  const fileInput = modal.querySelector("#bsmPhotoFileInput");
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
      const file = e.dataTransfer?.files?.[0];
      if (file) handlePhotoFile(file);
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) handlePhotoFile(file);
      fileInput.value = "";
    });
  }

  // Webcam buttons (F5f)
  modal.querySelector("#bsmWebcamStartBtn")?.addEventListener("click", startWebcamStream);
  modal.querySelector("#bsmWebcamCaptureBtn")?.addEventListener("click", captureWebcamFrame);
  modal.querySelector("#bsmWebcamRetakeBtn")?.addEventListener("click", retakeWebcamCapture);
  modal.querySelector("#bsmWebcamConfirmBtn")?.addEventListener("click", confirmWebcamCapture);
}

// ════════════════════════════════════════════════════════════════
// F5f: Webcam Capture (getUserMedia → canvas → WebP dataURL)
// ════════════════════════════════════════════════════════════════

function isMediaDevicesSupported() {
  return Boolean(navigator?.mediaDevices?.getUserMedia);
}

function setWebcamStatus(message, opts = {}) {
  const el = document.querySelector("#bsmWebcamStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("is-error", Boolean(opts.error));
}

function setWebcamButtonsVisibility({ start, capture, retake, confirm } = {}) {
  const map = {
    bsmWebcamStartBtn: start,
    bsmWebcamCaptureBtn: capture,
    bsmWebcamRetakeBtn: retake,
    bsmWebcamConfirmBtn: confirm,
  };
  Object.entries(map).forEach(([id, visible]) => {
    const el = document.querySelector("#" + id);
    if (!el) return;
    if (visible) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });
}

async function startWebcamStream() {
  if (!isMediaDevicesSupported()) {
    setWebcamStatus("Bu tarayıcı kamera erişimini desteklemiyor. Lütfen dosya yükleme sekmesini kullanın.", { error: true });
    setTimeout(() => setPhotoModalTab("upload"), 1200);
    return;
  }
  const video = document.querySelector("#bsmWebcamVideo");
  const placeholder = document.querySelector("#bsmWebcamPlaceholder");
  if (!video) return;
  try {
    setWebcamStatus("Kamera başlatılıyor…");
    setWebcamButtonsVisibility({ start: false });
    // Square crop için square aspect ratio iste (cihaz desteklemezse en yakın)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
      audio: false,
    });
    _bsmPhotoState.webcamStream = stream;
    video.srcObject = stream;
    video.hidden = false;
    if (placeholder) placeholder.hidden = true;
    await new Promise((resolve) => {
      const onReady = () => { video.removeEventListener("loadedmetadata", onReady); resolve(); };
      video.addEventListener("loadedmetadata", onReady, { once: true });
      // Some browsers fire loadedmetadata synchronously
      if (video.readyState >= 1) resolve();
    });
    await video.play().catch(() => { /* autoplay engellenirse görmezden gel; muted zaten */ });
    setWebcamStatus("Hazır. Hizalandığınızda 'Fotoğraf Çek' butonuna basın.");
    setWebcamButtonsVisibility({ capture: true });
  } catch (err) {
    const code = err?.name || "";
    let msg = "Kamera erişimi reddedildi veya başlatılamadı.";
    if (code === "NotAllowedError" || code === "PermissionDeniedError") {
      msg = "Kamera izni reddedildi. Lütfen dosya yükleme sekmesini kullanın.";
    } else if (code === "NotFoundError" || code === "DevicesNotFoundError") {
      msg = "Kamera bulunamadı. Dosya yükleme sekmesini kullanabilirsiniz.";
    } else if (code === "NotReadableError" || code === "TrackStartError") {
      msg = "Kamera başka bir uygulama tarafından kullanılıyor olabilir.";
    } else if (code === "OverconstrainedError") {
      msg = "Kamera istenen çözünürlüğü desteklemiyor.";
    }
    setWebcamStatus(msg, { error: true });
    setWebcamButtonsVisibility({ start: true });
    stopWebcamStream();
  }
}

function captureWebcamFrame() {
  const video = document.querySelector("#bsmWebcamVideo");
  const canvas = document.querySelector("#bsmWebcamCanvas");
  if (!video || !canvas || !_bsmPhotoState.webcamStream) return;
  const vw = video.videoWidth || 720;
  const vh = video.videoHeight || 720;
  if (!vw || !vh) {
    setWebcamStatus("Görüntü hazır değil, biraz bekleyip tekrar deneyin.", { error: true });
    return;
  }
  const side = Math.min(vw, vh);
  const sx = Math.max(0, (vw - side) / 2);
  const sy = Math.max(0, (vh - side) / 2);
  canvas.width = BSM_PHOTO_TARGET;
  canvas.height = BSM_PHOTO_TARGET;
  const ctx = canvas.getContext("2d");
  // Video aynalı gösteriliyor → kullanıcı kendini doğal görüyor.
  // Çekilen fotoğrafta da aynalı kaydet (selfie tutarlılığı için).
  ctx.save();
  ctx.translate(BSM_PHOTO_TARGET, 0);
  ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, sx, sy, side, side, 0, 0, BSM_PHOTO_TARGET, BSM_PHOTO_TARGET);
  ctx.restore();

  let dataUrl;
  try { dataUrl = canvas.toDataURL("image/webp", BSM_PHOTO_QUALITY); } catch (e) { dataUrl = null; }
  if (!dataUrl || !dataUrl.startsWith("data:image/webp")) {
    dataUrl = canvas.toDataURL("image/png");
  }
  _bsmPhotoState.pendingCaptureDataUrl = dataUrl;

  // Show preview: hide video, show canvas
  video.hidden = true;
  canvas.hidden = false;
  setWebcamStatus("Fotoğrafı onaylayın veya tekrar çekin.");
  setWebcamButtonsVisibility({ retake: true, confirm: true });
}

function retakeWebcamCapture() {
  const video = document.querySelector("#bsmWebcamVideo");
  const canvas = document.querySelector("#bsmWebcamCanvas");
  if (canvas) canvas.hidden = true;
  if (video) video.hidden = false;
  _bsmPhotoState.pendingCaptureDataUrl = null;
  setWebcamStatus("Hazır olduğunuzda tekrar 'Fotoğraf Çek'.");
  setWebcamButtonsVisibility({ capture: true });
}

function confirmWebcamCapture() {
  const dataUrl = _bsmPhotoState.pendingCaptureDataUrl;
  const memberId = _bsmPhotoState.memberId;
  if (!dataUrl || !memberId) return;
  setMemberPhoto(memberId, dataUrl);
  stopWebcamStream();
  closePhotoModal();
  showStatus("Profil fotoğrafı güncellendi.", "success");
}

function stopWebcamStream() {
  if (_bsmPhotoState.webcamStream) {
    try { _bsmPhotoState.webcamStream.getTracks().forEach((t) => t.stop()); } catch (e) { /* */ }
    _bsmPhotoState.webcamStream = null;
  }
  const video = document.querySelector("#bsmWebcamVideo");
  if (video) {
    try { video.pause(); } catch (e) { /* */ }
    video.srcObject = null;
  }
}

function resetWebcamUi() {
  const video = document.querySelector("#bsmWebcamVideo");
  if (video) video.srcObject = null;
  const placeholder = document.querySelector("#bsmWebcamPlaceholder");
  if (placeholder) placeholder.hidden = false;
  if (video) video.hidden = true;
  const canvas = document.querySelector("#bsmWebcamCanvas");
  if (canvas) canvas.hidden = true;
  setWebcamButtonsVisibility({ start: true, capture: false, retake: false, confirm: false });
  setWebcamStatus("");
}

function relativeTimeShort(value) {
  if (!value) return "kayıt yok";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const diffMs = Date.now() - parsed.getTime();
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr  = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return "az önce";
  if (min < 60) return `${min} dk önce`;
  if (hr < 24) return `${hr} sa önce`;
  if (day < 30) return `${day} gün önce`;
  try { return parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }); } catch (e) { return parsed.toISOString().slice(0,10); }
}

// ── Wizard Content (aktif adıma göre içerik) ────────────────────

function renderWizardContent() {
  const host = document.querySelector("#bsmWizardContent");
  if (!host) return;
  const member = findActiveMember();
  if (!member) {
    host.innerHTML = "";
    return;
  }
  const step = state.activeWizardStep || "olcum";
  switch (step) {
    case "olcum":     host.innerHTML = renderStepOlcumHtml(member); break;
    case "program":   host.innerHTML = renderStepGenericHtml("Program", "Program oluşturma adımı sağ paneldeki <strong>Program Oluştur</strong> butonu veya yukarıdaki wizard adımı ile açılır.", "Program oluştur sekmesinde detaylı form vardır."); break;
    case "beslenme":  host.innerHTML = renderStepGenericHtml("Beslenme Planı", "Beslenme planı sağ paneldeki <strong>Beslenme Planı</strong> butonu veya wizard adımı ile açılır.", "Beslenme sekmesinde üyeye özel plan oluşturulur."); break;
    case "pdf":       host.innerHTML = renderStepGenericHtml("PDF Çıktısı", "PDF üretimi için önce program oluşturulmalı. Üye Çıktısı sekmesinde indirme seçenekleri yer alır.", "Çıktı sekmesinden PDF, HTML veya mail gönderimi yapılabilir."); break;
    case "mail":      host.innerHTML = renderStepGenericHtml("Mail Gönder", "Mail gönderimi için üyenin e-posta adresi ve hazır program gerekli.", "Çıktı sekmesinden mail butonu kullanılır."); break;
    default:          host.innerHTML = "";
  }
}

function renderStepGenericHtml(title, description, footnote) {
  return `
    <div class="bsm-step-section">
      <header class="bsm-step-section__head">
        <h4>${escapeHtml(title)}</h4>
      </header>
      <div class="bsm-step-section__body">
        <p>${description}</p>
        <small>${escapeHtml(footnote)}</small>
      </div>
    </div>
  `;
}

function renderStepOlcumHtml(member) {
  const latest = member?.measurements?.[0];
  const profile = member?.profile || {};
  const note = (latest?.note || profile.notes || "").trim();
  const measureDate = latest ? (latest.date || "Tarih yok") : "Henüz ölçüm yok";
  const measurementHistory = (member?.measurements || []).slice(0, 6).reverse();
  const sparkSeries = measurementHistory.length >= 2;

  const metric = (label, valueText, unit, key) => {
    const values = measurementHistory.map((m) => num(m[key])).filter((v) => v !== null);
    const sparkline = sparkSeries && values.length >= 2 ? buildSparklineSvg(values) : "";
    return `
      <article class="bsm-metric-card">
        <span class="bsm-metric-card__label">${escapeHtml(label)}</span>
        <strong class="bsm-metric-card__value">${escapeHtml(valueText)}${unit ? `<em>${escapeHtml(unit)}</em>` : ""}</strong>
        ${sparkline ? `<div class="bsm-metric-card__spark">${sparkline}</div>` : `<div class="bsm-metric-card__spark bsm-metric-card__spark--empty"></div>`}
      </article>
    `;
  };

  const v = (key, suffix = "") => latest && latest[key] != null && latest[key] !== "" ? String(latest[key]) + suffix : "—";

  return `
    <div class="bsm-step-section">
      <header class="bsm-step-section__head">
        <div>
          <h4>Vücut Analiz Sonuçları (Tanita)</h4>
          <small>Ölçüm Tarihi: ${escapeHtml(measureDate)}</small>
        </div>
        ${latest
          ? `<span class="bsm-pill bsm-pill--success"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>Ölçüm mevcut</span>`
          : `<span class="bsm-pill bsm-pill--warning">Ölçüm bekleniyor</span>`}
      </header>

      <div class="bsm-metric-grid">
        ${metric("Kilo", v("weight"), "kg", "weight")}
        ${metric("Vücut Yağ Oranı", v("fat"), "%", "fat")}
        ${metric("Kas Kütlesi", v("muscleMass"), "kg", "muscleMass")}
        ${metric("Vücut Yağ Kütlesi", v("fatMass"), "kg", "fatMass")}
        ${metric("BMI", v("bmi"), "", "bmi")}
        ${metric("Metabolik Yaş", v("metabolicAge"), "", "metabolicAge")}
        ${metric("Vücut Suyu", v("bodyWater"), "%", "bodyWater")}
        ${metric("İç Yağlanma", v("visceralFat"), "", "visceralFat")}
      </div>

      <div class="bsm-step-secondary">
        <article class="bsm-side-card">
          <header><h5>Notlar</h5></header>
          <p>${note ? escapeHtml(note) : "Bu üye için henüz not eklenmemiş."}</p>
        </article>
        <article class="bsm-side-card">
          <header><h5>Hedef Bilgileri</h5></header>
          <dl class="bsm-target-list">
            <div><dt>Hedef</dt><dd>${escapeHtml(labelMaps.goal[profile.goal] || "—")}</dd></div>
            <div><dt>Başlangıç</dt><dd>${escapeHtml(relativeTimeShort(member?.createdAt) || "—")}</dd></div>
            <div><dt>Hedef Kilo</dt><dd>—</dd></div>
            <div><dt>Hedef Yağ %</dt><dd>—</dd></div>
          </dl>
          <small>Hedef Kilo ve Yağ % alanları gelecek sprintte builder formuna eklenecek.</small>
        </article>
      </div>

      ${buildMeasurementHistoryChartHtml(member?.measurements)}
    </div>
  `;
}

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildSparklineSvg(values) {
  if (!values || values.length < 2) return "";
  const w = 96; const h = 22; const pad = 2;
  const min = Math.min(...values); const max = Math.max(...values);
  const range = max - min || 1;
  const dx = (w - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * dx;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>`;
}

// F5h: Ölçüm Geçmişi line chart — dual axis (Kilo kg + Yağ %), inline SVG, dependency-yok.
function buildMeasurementHistoryChartHtml(measurements) {
  // En son 12 ölçüm, kronolojik (eski → yeni)
  const raw = Array.isArray(measurements) ? measurements.slice(0, 12).reverse() : [];
  const items = raw
    .map((m) => ({ date: m?.date, weight: num(m?.weight), fat: num(m?.fat) }))
    .filter((m) => m.weight !== null || m.fat !== null);

  if (items.length < 2) {
    return `
      <section class="bsm-chart-card">
        <header class="bsm-chart-card__head">
          <h5>Ölçüm Geçmişi</h5>
          <span class="bsm-chart-card__hint">Trend için en az iki ölçüm gerekir.</span>
        </header>
        <div class="bsm-chart-empty">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"></path><path d="M7 14l4-4 4 4 5-5"></path></svg>
          <span>${items.length === 0 ? "Henüz ölçüm kaydı yok." : "İkinci ölçüm eklendiğinde trend grafiği açılır."}</span>
        </div>
      </section>
    `;
  }

  const w = 640;
  const h = 220;
  const padL = 38;
  const padR = 38;
  const padT = 16;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  function scale(values) {
    const valid = values.filter((v) => v !== null);
    if (!valid.length) return null;
    let min = Math.min(...valid);
    let max = Math.max(...valid);
    const span = max - min || Math.max(1, Math.abs(max) * 0.05 || 1);
    // Padding for readability
    min -= span * 0.12;
    max += span * 0.12;
    return { min, max };
  }

  const sW = scale(items.map((m) => m.weight));
  const sF = scale(items.map((m) => m.fat));

  const xAt = (i) => padL + (items.length === 1 ? innerW / 2 : (i / (items.length - 1)) * innerW);
  const yAt = (scaleObj, value) => {
    if (!scaleObj || value === null) return null;
    const t = (value - scaleObj.min) / (scaleObj.max - scaleObj.min);
    return padT + (1 - t) * innerH;
  };

  function buildSeries(getValue, scaleObj, colorClass) {
    if (!scaleObj) return { path: "", dots: "" };
    const points = items.map((m, i) => {
      const value = getValue(m);
      if (value === null) return null;
      return { x: xAt(i), y: yAt(scaleObj, value), value, date: m.date };
    }).filter(Boolean);
    if (points.length < 2) return { path: "", dots: "" };
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const dots = points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="bsm-chart-dot ${colorClass}"><title>${escapeHtml(p.date || "")} — ${p.value}</title></circle>`).join("");
    return { path: `<path d="${pathD}" class="bsm-chart-line ${colorClass}"></path>`, dots };
  }

  const weightSeries = buildSeries((m) => m.weight, sW, "is-weight");
  const fatSeries = buildSeries((m) => m.fat, sF, "is-fat");

  // X axis labels (ilk, orta, son — en fazla 4 etiket)
  const xLabelCount = Math.min(items.length, 4);
  const xLabelIndices = Array.from({ length: xLabelCount }, (_, k) => Math.round(k * (items.length - 1) / Math.max(1, xLabelCount - 1)));
  const xLabels = xLabelIndices.map((i) => {
    const label = formatShortDate(items[i]?.date);
    return `<text x="${xAt(i).toFixed(1)}" y="${(h - 10).toFixed(0)}" class="bsm-chart-axis-label" text-anchor="${i === 0 ? "start" : i === items.length - 1 ? "end" : "middle"}">${escapeHtml(label)}</text>`;
  }).join("");

  // Y axis tick labels
  function yTicks(scaleObj, side) {
    if (!scaleObj) return "";
    const ticks = 3;
    const items = [];
    for (let k = 0; k <= ticks; k++) {
      const v = scaleObj.min + (k / ticks) * (scaleObj.max - scaleObj.min);
      const y = padT + (1 - k / ticks) * innerH;
      const label = String(Math.round(v * 10) / 10);
      const x = side === "left" ? padL - 6 : w - padR + 6;
      const anchor = side === "left" ? "end" : "start";
      items.push(`<text x="${x.toFixed(0)}" y="${y.toFixed(1)}" class="bsm-chart-axis-label bsm-chart-axis-label--${side}" text-anchor="${anchor}" dominant-baseline="middle">${escapeHtml(label)}</text>`);
    }
    return items.join("");
  }

  // Grid lines (yatay 3 çizgi)
  const gridLines = [0, 1, 2, 3].map((k) => {
    const y = padT + (k / 3) * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(w - padR).toFixed(0)}" y2="${y.toFixed(1)}" class="bsm-chart-grid"></line>`;
  }).join("");

  return `
    <section class="bsm-chart-card">
      <header class="bsm-chart-card__head">
        <h5>Ölçüm Geçmişi</h5>
        <div class="bsm-chart-legend" aria-hidden="true">
          ${sW ? `<span class="bsm-chart-legend__item is-weight"><i></i>Kilo (kg)</span>` : ""}
          ${sF ? `<span class="bsm-chart-legend__item is-fat"><i></i>Yağ Oranı (%)</span>` : ""}
        </div>
      </header>
      <div class="bsm-chart-card__body">
        <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Üye ölçüm geçmişi: kilo ve yağ oranı trendi" preserveAspectRatio="xMidYMid meet" class="bsm-chart-svg">
          ${gridLines}
          ${yTicks(sW, "left")}
          ${yTicks(sF, "right")}
          ${weightSeries.path}
          ${fatSeries.path}
          ${weightSeries.dots}
          ${fatSeries.dots}
          ${xLabels}
        </svg>
      </div>
    </section>
  `;
}

function formatShortDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  try {
    return parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  } catch (e) {
    return parsed.toISOString().slice(5, 10);
  }
}

// ── Utility Panel ──────────────────────────────────────────────

function renderUtilityPanel() {
  const host = document.querySelector("#bsmUtilityPanel");
  if (!host) return;
  const member = findActiveMember();
  if (!member) {
    host.innerHTML = "";
    return;
  }
  const states = computeWizardStepStates(member);

  const statusRow = (id, label) => {
    const s = states[id] || "pending";
    const ok = s === "completed";
    return `
      <li class="bsm-status-row ${ok ? "is-ok" : "is-pending"}">
        <span class="bsm-status-row__icon" aria-hidden="true">
          ${ok
            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`}
        </span>
        <span class="bsm-status-row__label">${escapeHtml(label)}</span>
        <span class="bsm-status-row__state">${ok ? "Tamamlandı" : "Eksik"}</span>
      </li>
    `;
  };

  host.innerHTML = `
    <article class="bsm-utility-card bsm-utility-card--status">
      <header class="bsm-utility-card__head">
        <h4>Hızlı Durum</h4>
      </header>
      <ul class="bsm-status-list">
        ${statusRow("olcum", "Ölçüm")}
        ${statusRow("program", "Program")}
        ${statusRow("beslenme", "Beslenme")}
        ${statusRow("pdf", "PDF Çıktısı")}
        ${statusRow("mail", "Mail Gönder")}
      </ul>
    </article>

    <article class="bsm-utility-card bsm-utility-card--actions">
      <header class="bsm-utility-card__head">
        <h4>Hızlı İşlemler</h4>
      </header>
      <div class="bsm-action-list">
        <button type="button" class="bsm-action-btn bsm-action-btn--blue" data-utility-action="olcum">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h3l3-9 4 18 3-9h5"></path></svg>
          <span>Ölçüm Güncelle</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--orange" data-utility-action="program">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v16"></path><path d="M18 4v16"></path><path d="M2 8h4"></path><path d="M2 16h4"></path><path d="M18 8h4"></path><path d="M18 16h4"></path><path d="M6 12h12"></path></svg>
          <span>Program Oluştur</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--green" data-utility-action="beslenme">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2v20"></path><path d="M5 2v6a3 3 0 0 0 6 0V2"></path><path d="M18 2v20"></path><path d="M15 2c0 4 3 4 3 8"></path></svg>
          <span>Beslenme Planı</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--purple" data-utility-action="pdf">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span>PDF Oluştur</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--cyan" data-utility-action="mail">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          <span>Mail Gönder</span>
        </button>
      </div>
    </article>

    <button type="button" class="bsm-utility-deactivate" disabled aria-disabled="true" title="Bu özellik gelecek sprintte aktif edilecek">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
      <span>Üyeyi Pasif Yap</span>
    </button>
  `;
}

// BSM_WIZARD_STEPS artik dosyanin basinda (hotfix - TDZ fix).

function computeWizardStepStates(member) {
  const hasMeasurement = !!(member?.measurements?.length);
  const hasProgram = !!(member?.programs?.length);
  const hasNutrition = !!(member?.nutritionPlan || member?.nutritionPlans?.length);
  return {
    olcum:    hasMeasurement ? "completed" : "pending",
    program:  hasProgram ? "completed" : "pending",
    beslenme: hasNutrition ? "completed" : "pending",
    pdf:      hasProgram ? "completed" : "pending",
    mail:     "pending",
  };
}

function renderWizardBar() {
  const host = document.querySelector("#bsmWizardBar");
  if (!host) return;
  const member = findActiveMember();
  const states = computeWizardStepStates(member);
  const active = state.activeWizardStep || "olcum";

  if (!member) {
    host.innerHTML = `
      <div class="bsm-wizard-bar__empty">
        <strong>Üye seçilmedi</strong>
        <span>Sol panelden üye seçerek antrenör akışını başlatın.</span>
      </div>
    `;
    return;
  }

  const items = BSM_WIZARD_STEPS.map((step, index) => {
    const stateKey = states[step.id] || "pending";
    const isActive = step.id === active;
    const stateClass = isActive ? "is-active" : stateKey === "completed" ? "is-completed" : "is-pending";
    const arrow = index < BSM_WIZARD_STEPS.length - 1
      ? `<span class="bsm-wizard-bar__arrow" aria-hidden="true">›</span>`
      : "";
    return `
      <button type="button" class="bsm-wizard-step ${stateClass}" data-wizard-step="${escapeHtml(step.id)}" data-wizard-screen="${escapeHtml(step.screen)}" aria-current="${isActive ? "step" : "false"}">
        <span class="bsm-wizard-step__circle" aria-hidden="true">
          ${stateKey === "completed" && !isActive
            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<span class="bsm-wizard-step__num">${index + 1}</span>`}
        </span>
        <span class="bsm-wizard-step__label">${escapeHtml(step.label)}</span>
      </button>
      ${arrow}
    `;
  }).join("");

  host.innerHTML = `<div class="bsm-wizard-bar__track">${items}</div>`;
}

function renderWizardFooter() {
  const host = document.querySelector("#bsmWizardFooter");
  if (!host) return;
  const member = findActiveMember();
  if (!member) {
    host.innerHTML = "";
    return;
  }
  const activeIdx = Math.max(0, BSM_WIZARD_STEPS.findIndex((s) => s.id === (state.activeWizardStep || "olcum")));
  const prev = BSM_WIZARD_STEPS[activeIdx - 1];
  const next = BSM_WIZARD_STEPS[activeIdx + 1];
  host.innerHTML = `
    <button type="button" class="bsm-wizard-nav bsm-wizard-nav--prev" data-wizard-nav="prev" ${prev ? "" : "disabled"} aria-label="Önceki adım">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      <span>Önceki Adım${prev ? ` · ${escapeHtml(prev.label)}` : ""}</span>
    </button>
    <button type="button" class="bsm-wizard-nav bsm-wizard-nav--next" data-wizard-nav="next" ${next ? "" : "disabled"} aria-label="Sonraki adım">
      <span>Sonraki Adım${next ? ` · ${escapeHtml(next.label)}` : ""}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
    </button>
  `;
}

function setActiveWizardStep(stepId, options = {}) {
  const valid = BSM_WIZARD_STEPS.find((s) => s.id === stepId);
  if (!valid) return;
  state.activeWizardStep = stepId;
  renderWizardBar();
  renderWizardFooter();
  if (options.navigate !== false && valid.screen) {
    setActiveScreen(valid.screen, { userTriggered: true, silent: true });
  }
}

function shiftWizardStep(delta) {
  const idx = Math.max(0, BSM_WIZARD_STEPS.findIndex((s) => s.id === (state.activeWizardStep || "olcum")));
  const nextIdx = Math.max(0, Math.min(BSM_WIZARD_STEPS.length - 1, idx + delta));
  setActiveWizardStep(BSM_WIZARD_STEPS[nextIdx].id);
}

function renderMembersKpiStrip() {
  const totalEl = document.querySelector("#membersKpiTotal");
  const measuredEl = document.querySelector("#membersKpiMeasured");
  const measuredMetaEl = document.querySelector("#membersKpiMeasuredMeta");
  const programsEl = document.querySelector("#membersKpiPrograms");
  const programsMetaEl = document.querySelector("#membersKpiProgramsMeta");
  const nutritionEl = document.querySelector("#membersKpiNutrition");
  const nutritionMetaEl = document.querySelector("#membersKpiNutritionMeta");
  const lastNameEl = document.querySelector("#membersKpiLastUpdate");
  const lastMetaEl = document.querySelector("#membersKpiLastUpdateMeta");

  if (!totalEl) return;

  const members = Array.isArray(state.members) ? state.members : [];
  const total = members.length;
  const measuredCount = members.filter((m) => Array.isArray(m?.measurements) && m.measurements.length > 0).length;
  const programCount = members.filter((m) => Array.isArray(m?.programs) && m.programs.length > 0).length;
  const nutritionCount = members.filter((m) => {
    if (m?.nutritionPlan) return true;
    return Array.isArray(m?.nutritionPlans) && m.nutritionPlans.length > 0;
  }).length;

  totalEl.textContent = String(total);

  measuredEl.textContent = String(measuredCount);
  if (measuredMetaEl) {
    measuredMetaEl.textContent = total > 0 ? `${total} üyeden ${measuredCount}` : "Henüz ölçüm yok";
  }

  programsEl.textContent = String(programCount);
  if (programsMetaEl) {
    programsMetaEl.textContent = total > 0 ? `${total} üyeden ${programCount}` : "Henüz program yok";
  }

  nutritionEl.textContent = String(nutritionCount);
  if (nutritionMetaEl) {
    nutritionMetaEl.textContent = total > 0 ? `${total} üyeden ${nutritionCount}` : "Henüz beslenme planı yok";
  }

  let latest = null;
  members.forEach((m) => {
    const stamp = m?.updatedAt || m?.createdAt;
    if (!stamp) return;
    const time = new Date(stamp).getTime();
    if (Number.isNaN(time)) return;
    if (!latest || time > latest.time) {
      latest = { time, name: m?.profile?.memberName || m?.profile?.memberCode || "Üye", stamp };
    }
  });

  if (latest) {
    lastNameEl.textContent = latest.name;
    if (lastMetaEl) {
      lastMetaEl.textContent = formatMembersKpiDate(latest.stamp);
    }
  } else {
    lastNameEl.textContent = "-";
    if (lastMetaEl) lastMetaEl.textContent = "Henüz güncelleme yok";
  }
}

function formatMembersKpiDate(value) {
  if (!value) return "Tarih yok";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  try {
    return parsed.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return parsed.toISOString().slice(0, 10);
  }
}

function handleMemberQuickAction(event) {
  const btn = event.target.closest("[data-member-quick-action]");
  if (!btn) return;

  const action = btn.dataset.memberQuickAction;
  const memberId = btn.dataset.memberId;
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return;

  loadMember(member);

  if (action === "load-profile" || action === "build-program") {
    setActiveScreen("builder", { userTriggered: true, silent: true });
  } else if (action === "add-measurement" || action === "history") {
    setActiveScreen("measurements", { userTriggered: true, silent: true });
  } else if (action === "nutrition") {
    setActiveScreen("nutrition", { userTriggered: true, silent: true });
  } else if (action === "output") {
    setActiveScreen("output", { userTriggered: true });
  }
}

function renderWorkspacePanels() {
  renderActiveMemberProfile();
  renderMemberList();
  renderMeasurementHistory();
  renderProgramHistory();
  renderV3CoachingPanel();
}

function renderDashboard() {
  const totalPrograms = state.members.reduce((sum, member) => sum + (member.programs?.length || 0), 0);
  const totalMeasurements = state.members.reduce((sum, member) => sum + (member.measurements?.length || 0), 0);
  const activeMember = findActiveMember();
  const latestItems = buildActivityItems();
  const automationSummary = getAutomationSummary();
  const analysisRiskMemberCount = state.members.filter((member) => ["Orta", "Yüksek"].includes(getMemberAnalysis(member)?.riskLevel)).length;
  const activeGoalLabel = activeMember ? labelMaps.goal[activeMember.profile?.goal] || "Hedef yok" : "";
  const activeLastAction = activeMember ? getActiveMemberLastAction(activeMember) : "";

  renderDashboardMetricsUi(
    {
      memberCount: dashboardMemberCount,
      programCount: dashboardProgramCount,
      measurementCount: dashboardMeasurementCount,
      activeMember: dashboardActiveMember,
      activeMemberMeta: dashboardActiveMemberMeta,
      riskMemberCount: dashboardRiskMemberCount,
      measurementDueCount: dashboardMeasurementDueCount,
      programDueCount: dashboardProgramDueCount,
      last7ActivityCount: dashboardLast7ActivityCount,
      statusSummary: dashboardStatusSummary,
      supabaseStatus: dashboardSupabaseStatus,
      memberTrend: dashboardMemberTrend,
      measurementDueTrend: dashboardMeasurementDueTrend,
      programDueTrend: dashboardProgramDueTrend,
      activeMemberTrend: dashboardActiveMemberTrend,
    },
    {
      memberCount: state.members.length,
      programCount: totalPrograms,
      measurementCount: totalMeasurements,
      activeMemberName: activeMember?.profile?.memberName || "Seçilmedi",
      activeMemberMeta: activeMember ? `${activeGoalLabel} • ${activeLastAction}` : "Üye seçerek profil panelini açın",
      riskMemberCount: Math.max(automationSummary.riskMemberCount || 0, analysisRiskMemberCount),
      measurementDueCount: automationSummary.measurementDueCount || 0,
      programDueCount: automationSummary.programUpdateDueCount || 0,
      last7ActivityCount: automationSummary.last7DaysActivityCount || 0,
      supabaseStatus: state.supabaseStatus,
      statusSummary: buildDashboardStatusSummary(automationSummary, activeMember),
      kpiStates: buildDashboardKpiStates(automationSummary, activeMember),
    },
  );
  renderDashboardFocusUi?.(dashboardFocusPanel, buildDashboardFocusModel(automationSummary), escapeHtml);
  renderDashboardActivityUi(dashboardActivity, latestItems.slice(0, 5), escapeHtml);
  renderCoachAlertsPanel(automationSummary, activeMember);
  renderV3DashboardCalendar(automationSummary);
  renderCoachTaskPanel(automationSummary);
  renderCoachQuickPanel(activeMember);
  renderBackupMeta();
}

function buildDashboardStatusSummary(automationSummary, activeMember) {
  const measurementDue = automationSummary.measurementDueCount || 0;
  const programDue = automationSummary.programUpdateDueCount || 0;
  const activeText = activeMember?.profile?.memberName ? `Aktif üye: ${activeMember.profile.memberName}` : "Aktif üye seçilmedi";
  return `${activeText} • ${measurementDue} ölçüm bekliyor • ${programDue} program revizyonu`;
}

function buildDashboardKpiStates(automationSummary, activeMember) {
  const measurementDue = Number(automationSummary.measurementDueCount || 0);
  const programDue = Number(automationSummary.programUpdateDueCount || 0);

  return {
    member: {
      tone: state.members.length ? "good" : "neutral",
      trend: state.members.length ? "↑ Aktif" : "→ Başlangıç",
    },
    measurement: {
      tone: measurementDue >= 5 ? "danger" : measurementDue > 0 ? "warning" : "good",
      trend: measurementDue > 0 ? `↑ ${measurementDue} takip` : "↓ Temiz",
    },
    program: {
      tone: programDue >= 5 ? "danger" : programDue > 0 ? "warning" : "good",
      trend: programDue > 0 ? `↑ ${programDue} revizyon` : "↓ Güncel",
    },
    active: {
      tone: activeMember ? "good" : "warning",
      trend: activeMember ? "↑ Seçili" : "→ Üye seç",
    },
  };
}

function readRepetitionTemplateFromForm(formData = null) {
  const source = formData || new FormData(form);
  const sets = Number(source.get("defaultSetCount") || defaultSetCount?.value || 3);
  const model = normalizeRepModel(source.get("defaultRepModel") || defaultRepModel?.value || "pyramid");
  const presetId = String(source.get("defaultRepPreset") || defaultRepPreset?.value || "");
  const customPattern = String(source.get("customRepPattern") || customRepPattern?.value || "").trim();
  const selectedPreset = repetitionPresets.find((preset) => preset.id === presetId && Number(preset.sets) === sets);
  const fallbackPreset = repetitionPresets.find((preset) => preset.model === model && Number(preset.sets) === sets) || repetitionPresets.find((preset) => Number(preset.sets) === sets);
  const preset = model === "custom" || presetId === "custom" ? null : selectedPreset || fallbackPreset;
  const repPattern = preset?.reps?.length ? [...preset.reps] : buildRepPatternFromText(customPattern || defaultRepTextForSets(sets), sets);

  return {
    sets,
    model,
    presetId: preset?.id || (model === "custom" ? "custom" : presetId || ""),
    repPattern,
    reps: repPattern.join(" • "),
    rest: String(source.get("defaultRestTime") || defaultRestTime?.value || "").trim(),
    tempo: String(source.get("defaultTempo") || defaultTempo?.value || "").trim(),
    customPattern,
  };
}

function buildDashboardFocusModel(automationSummary) {
  const measurementDue = Number(automationSummary.measurementDueCount || 0);
  const programDue = Number(automationSummary.programUpdateDueCount || 0);
  const missingData = countMembersWithMissingData();
  const items = [
    {
      title: "Ölçüm bekleyen üyeler",
      count: measurementDue,
      text: measurementDue ? "14 günü geçen veya hiç ölçümü olmayan üyeler var." : "Ölçüm takibi şu an dengede.",
      tone: measurementDue >= 5 ? "danger" : measurementDue > 0 ? "warning" : "good",
    },
    {
      title: "Program güncelleme",
      count: programDue,
      text: programDue ? "Revizyon zamanı yaklaşan programlar bulunuyor." : "Program revizyon takibi temiz.",
      tone: programDue >= 5 ? "danger" : programDue > 0 ? "warning" : "good",
    },
    {
      title: "Eksik profil / veri",
      count: missingData,
      text: missingData ? "Hedef, seviye, gün veya ölçüm bilgisi eksik üyeler var." : "Temel üye verileri iyi görünüyor.",
      tone: missingData >= 5 ? "danger" : missingData > 0 ? "warning" : "good",
    },
  ];
  const highestPriority = items.find((item) => item.count > 0) || items[0];
  const action =
    measurementDue > 0 ? "open-measurements" : programDue > 0 ? "build-program" : missingData > 0 ? "open-builder" : "new-member";

  return {
    title: highestPriority.count ? highestPriority.title : "Salon akışı kontrol altında",
    text: highestPriority.count
      ? highestPriority.text
      : "Bugün kritik aksiyon yok. Yeni üye, ölçüm veya program akışıyla devam edebilirsiniz.",
    action,
    actionLabel: "İşlemlere Başla",
    items,
  };
}

function countMembersWithMissingData() {
  return state.members.filter((member) => {
    const profile = member.profile || {};
    return !profile.memberName || !profile.goal || !profile.level || !(profile.days || []).length || !(member.measurements || []).length;
  }).length;
}

function getActiveMemberLastAction(member) {
  const candidates = [
    ...(member.measurements || []).map((measurement) => ({
      date: measurement.date,
      label: `Son ölçüm ${measurement.date || "tarihsiz"}`,
    })),
    ...(member.programs || []).map((record) => ({
      date: record.savedAt || record.program?.createdAt,
      label: `Son program ${formatDashboardDate(record.savedAt || record.program?.createdAt)}`,
    })),
    {
      date: member.updatedAt || member.createdAt,
      label: member.updatedAt || member.createdAt ? `Üye güncellendi ${formatDashboardDate(member.updatedAt || member.createdAt)}` : "Son işlem yok",
    },
  ].filter((item) => item.date);

  return candidates.sort((a, b) => String(b.date).localeCompare(String(a.date), "tr"))[0]?.label || "Son işlem yok";
}

function renderWorkflowAssistant() {
  if (!workflowAssistant) {
    return;
  }

  const model = buildWorkflowAssistantModel();

  workflowAssistant.innerHTML = `
    <div class="workflow-assistant__header">
      <div>
        <p class="section-kicker">Akış Rehberi</p>
        <h3>${escapeHtml(model.title)}</h3>
        <span>${escapeHtml(model.subtitle)}</span>
      </div>
      <button type="button" class="primary-button mini-button" data-workflow-action="${escapeHtml(model.nextAction)}">${escapeHtml(model.nextActionLabel)}</button>
    </div>
    <div class="workflow-assistant__steps">
      ${model.steps
        .map(
          (step) => `
            <article class="workflow-step workflow-step--${escapeHtml(step.status)}">
              <b>${escapeHtml(step.number)}</b>
              <div>
                <strong>${escapeHtml(step.title)}</strong>
                <span>${escapeHtml(step.text)}</span>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="workflow-assistant__actions" aria-label="Hızlı aksiyonlar">
      <button type="button" class="ghost-button mini-button" data-workflow-action="members">Üye Listesi</button>
      <button type="button" class="ghost-button mini-button" data-workflow-action="measurements">Ölçüm / Tanita</button>
      <button type="button" class="secondary-button mini-button" data-workflow-action="build-program">Program Oluştur</button>
      <button type="button" class="ghost-button mini-button" data-workflow-action="nutrition">Beslenme</button>
      <button type="button" class="primary-button mini-button" data-workflow-action="output">Çıktı / PDF</button>
    </div>
  `;
}

function renderMeasurementTabStatus() {
  // v1.2.0: Measurement panel her render edildiginde 'report' tab'indaki
  // premium Report Center'i da besle.
  try { renderReportCenter(); } catch (e) { /* defansif */ }

  const member = findActiveMember();
  const profile = member?.profile || {};
  const latestMeasurement = getActiveMeasurementSnapshot(member);
  const memberName = profile.memberName || "Aktif üye yok";
  const initials = buildMemberInitials(profile.memberName, profile.memberCode);
  const accent = member ? getMemberAccent(member) : null;
  const avatarStyle = accent ? `style="background: linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)"` : "";
  const goalLabel = labelMaps.goal[profile.goal] || "Hedef belirtilmedi";
  const levelLabel = labelMaps.level[profile.level] || "Seviye yok";
  const latestMeasurementText = latestMeasurement
    ? `${latestMeasurement.date || "Tarih yok"} • ${formatWorkflowMetric(latestMeasurement.weight, "kg") || "Kilo yok"} • ${
        formatWorkflowMetric(latestMeasurement.fat, "yağ") || "Yağ yok"
      }`
    : "Henüz kayıtlı ölçüm yok";

  if (measurementActiveMemberCard) {
    measurementActiveMemberCard.innerHTML = member
      ? `
        <div class="measurement-member-card__top">
          <div class="measurement-member-avatar" ${avatarStyle}>
            ${
              profile.photo
                ? `<img src="${escapeHtml(profile.photo)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
                : `<span>${escapeHtml(initials)}</span>`
            }
          </div>
          <div>
            <span class="measurement-member-card__status">Aktif</span>
            <strong>${escapeHtml(memberName)}</strong>
            <small>${escapeHtml(profile.memberCode || "Üye no yok")}</small>
          </div>
        </div>
        <dl class="measurement-member-card__meta">
          <div><dt>Hedef</dt><dd>${escapeHtml(goalLabel)}</dd></div>
          <div><dt>Seviye</dt><dd>${escapeHtml(levelLabel)}</dd></div>
          <div><dt>Son ölçüm</dt><dd>${escapeHtml(latestMeasurement?.date || "Yok")}</dd></div>
          <div><dt>Kilo</dt><dd>${escapeHtml(formatMeasurementMetric(latestMeasurement?.weight, "kg"))}</dd></div>
          <div><dt>Boy</dt><dd>${escapeHtml(formatMeasurementMetric(profile.height || latestMeasurement?.height, "cm"))}</dd></div>
        </dl>
        <p class="measurement-member-card__summary">${escapeHtml(latestMeasurementText)}</p>
      `
      : `
        <div class="measurement-member-card__empty">
          <strong>Önce üye seçin veya yeni üye oluşturun.</strong>
          <span>Üye ve Program sekmesinden aktif üye seçildiğinde burada görünür.</span>
        </div>
      `;
  }

  if (measurementTabNotice) {
    measurementTabNotice.textContent = member
      ? "Aktif üye seçildi. Tanita CSV yükleyebilir, manuel ölçüm girebilir veya son ölçüm raporunu oluşturabilirsiniz."
      : "Önce üye seçin veya yeni üye oluşturun.";
    measurementTabNotice.dataset.state = member ? "ready" : "empty";
  }

  measurementsPanel?.classList.toggle("has-active-member", Boolean(member));
  renderMeasurementPremiumInsight(member, latestMeasurement);
  renderMeasurementLeftSummary(member);
  renderMeasurementMemberHero(member);
  renderMeasurementCsvAnalytics(member);
}

function renderMeasurementMemberHero(member = findActiveMember()) {
  const host = document.querySelector("#measurementTopMemberHero");

  if (!host) {
    return;
  }

  if (!member) {
    host.innerHTML = `
      <div class="measurement-member-hero__empty">
        <strong>Önce üye seçin veya yeni üye oluşturun.</strong>
        <span>Tanita CSV yükleme, rapor ve ölçüm geçmişi aktif üyeye bağlanır.</span>
      </div>
    `;
    return;
  }

  const profile = member.profile || {};
  const measurement = getActiveMeasurementSnapshot(member);
  const memberName = profile.memberName || "İsimsiz Üye";
  const initials = buildMemberInitials(profile.memberName, profile.memberCode);
  const accent = getMemberAccent(member);
  const goalLabel = labelMaps.goal[profile.goal] || "Hedef belirtilmedi";
  const levelLabel = labelMaps.level[profile.level] || "Seviye yok";
  const lastMeasurementDate = measurement?.date || "Henüz yok";
  const nextMeasurement = estimateNextMeasurementDate(measurement?.date);
  const avatarStyle = `style="background: linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)"`;
  const stats = [
    { label: "Son Ölçüm", value: formatMeasurementDateLabel(lastMeasurementDate), sub: measurement?.date ? "aktif veri" : "kayıt bekleniyor" },
    { label: "Sonraki Ölçüm", value: nextMeasurement.label, sub: nextMeasurement.sub },
  ];

  host.innerHTML = `
    <div class="measurement-member-hero__identity">
      <div class="measurement-member-hero__avatar" ${avatarStyle}>
        ${
          profile.photo
            ? `<img src="${escapeHtml(profile.photo)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
            : `<span>${escapeHtml(initials)}</span>`
        }
      </div>
      <div>
        <div class="measurement-member-hero__title">
          <h3>${escapeHtml(memberName)}</h3>
          <span>Aktif Üye</span>
        </div>
        <p>${escapeHtml(goalLabel)}</p>
        <div class="measurement-member-hero__chips">
          <span>Üye No: ${escapeHtml(profile.memberCode || "Yok")}</span>
          <span>Seviye: ${escapeHtml(levelLabel)}</span>
          <span>Program: ${member.programs?.length ? "Devam ediyor" : "Bekliyor"}</span>
        </div>
      </div>
    </div>
    <div class="measurement-member-hero__stats">
      ${stats
        .map(
          (item) => `
            <div>
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
              <small>${escapeHtml(item.sub)}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderMeasurementCsvAnalytics(member = findActiveMember()) {
  const trendHost = document.querySelector("#measurementCsvTrendHost");
  const tableHost = document.querySelector("#measurementCsvHistoryTable");

  if (!trendHost && !tableHost) {
    return;
  }

  const records = member ? getActiveMeasurementRecords(member) : [];

  if (trendHost) {
    trendHost.innerHTML = records.length
      ? buildMeasurementTrendCards(records).map(renderMeasurementTrendCard).join("")
      : `
        <div class="measurement-history-empty">
          <strong>Trend için ölçüm bekleniyor.</strong>
          <span>CSV yüklendiğinde kilo, yağ, kas ve bel kartları otomatik dolacak.</span>
        </div>
      `;
  }

  if (!tableHost) {
    return;
  }

  if (!records.length) {
    tableHost.innerHTML = `
      <div class="measurement-history-empty">
        <strong>Ölçüm geçmişi henüz boş.</strong>
        <span>İlk Tanita CSV kaydı veya manuel ölçümden sonra geçmiş burada görünür.</span>
      </div>
    `;
    return;
  }

  tableHost.innerHTML = `
    <div class="measurement-csv-history-table__head">
      <span>Tarih</span>
      <span>Kilo</span>
      <span>Yağ</span>
      <span>Kas</span>
      <span>Bel</span>
      <span>Kaynak</span>
    </div>
    ${records
      .slice(0, 6)
      .map(
        (item) => `
          <div class="measurement-csv-history-table__row">
            <strong>${escapeHtml(formatMeasurementDateTime(item))}</strong>
            <span>${escapeHtml(formatMeasurementMetric(item.weight, "kg"))}</span>
            <span>${escapeHtml(formatMeasurementMetric(item.fat, "%"))}</span>
            <span>${escapeHtml(formatMeasurementMetric(item.muscleMass, "kg"))}</span>
            <span>${escapeHtml(formatMeasurementMetric(item.waist, "cm"))}</span>
            <em>${escapeHtml(getMeasurementSourceLabel(item))}</em>
          </div>
        `,
      )
      .join("")}
  `;
}

function estimateNextMeasurementDate(dateValue) {
  const parsed = parseInputDateForUi(dateValue);

  if (!parsed) {
    return { label: "Planlanmadı", sub: "ilk ölçüm bekleniyor" };
  }

  parsed.setDate(parsed.getDate() + 21);
  return {
    label: parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    sub: "21 gün takip",
  };
}

function parseInputDateForUi(dateValue) {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMeasurementDateLabel(dateValue) {
  const parsed = parseInputDateForUi(dateValue);
  return parsed ? parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) : String(dateValue || "Yok");
}

function formatMeasurementDateTime(measurement) {
  return [formatMeasurementDateLabel(measurement?.date), measurement?.time].filter(Boolean).join(" ");
}

function getMeasurementSourceLabel(measurement) {
  const source = normalizeText(measurement?.source || "");

  if (state.pendingTanitaMeasurement && measurement?.id && measurement.id === state.pendingTanitaMeasurement.id) {
    return "Tanita CSV (bekleyen)";
  }

  if (source.includes("tanita") || source.includes("csv")) {
    return "Tanita CSV";
  }

  if (source.includes("manual")) {
    return "Manuel";
  }

  return "Ölçüm";
}

function handleMeasurementManualDraftInput(event) {
  const target = event.target;

  if (!target?.matches?.("input, select, textarea")) {
    return;
  }

  const isMeasurementInput =
    target.id?.startsWith("measurement") ||
    target.id?.startsWith("segment") ||
    target.dataset.measurementExtra === "true";

  if (!isMeasurementInput || target.type === "file") {
    return;
  }

  refreshManualMeasurementDraft({ silent: true });
}

function refreshManualMeasurementDraft(options = {}) {
  const draft = readMeasurementForm();
  const member = findActiveMember();

  syncMeasurementDerivedFields(draft);

  if (!draft) {
    if (!options.silent) {
      showStatus("Taslak için en az bir ölçüm değeri girin.", "error");
    }
    return null;
  }

  const measurement = setActiveMeasurementState(draft, {
    memberId: member?.id || state.activeMemberId || "",
    source: draft.source || "manual-draft",
  });

  renderMeasurementPremiumInsight(member, measurement);
  renderMeasurementLeftSummary(member);
  renderMeasurementMemberHero(member);
  renderMeasurementCsvAnalytics(member);

  return measurement;
}

function clearManualMeasurementDraft() {
  clearMeasurementInputs();
  if (measurementDate) measurementDate.value = getTodayInputValue();
  state.pendingTanitaMeasurement = null;
  setActiveMeasurementState(findActiveMember()?.measurements?.[0] || null, { source: "saved" });
  renderTanitaPreview(null);
  renderMeasurementTabStatus();
  renderMeasurementHistory();
  showStatus("Manuel ölçüm alanları temizlendi.", "success");
}

function saveManualMeasurementDraft() {
  const measurement = refreshManualMeasurementDraft({ silent: false });

  if (!measurement) {
    return;
  }

  showStatus("Manuel ölçüm taslağı sağ panel ve rapor önizlemesi için güncellendi. Kalıcı kayıt için Ölçümü Kaydet'e basın.", "success");
}

function syncMeasurementDerivedFields(measurement) {
  const ageInput = document.querySelector("#measurementAge");

  if (ageInput && measurement?.age !== "" && measurement?.age !== undefined && measurement?.age !== null) {
    ageInput.value = String(measurement.age);
  }
}

function buildWorkflowAssistantModel() {
  const activeMember = findActiveMember();
  const draftProfile = form ? collectFormData() : {};
  const memberName = activeMember?.profile?.memberName || draftProfile.memberName || draftProfile.memberCode || "Yeni üye";
  const latestMeasurement = getActiveMeasurementSnapshot(activeMember);
  const latestProgram = state.activeProgram || activeMember?.programs?.[0]?.program || null;
  const nutritionPlan = state.activeNutritionPlan || activeMember?.nutritionPlan || activeMember?.nutritionPlans?.[0] || null;
  const hasMember = Boolean(activeMember || draftProfile.memberName || draftProfile.memberCode);
  const hasMeasurement = Boolean(latestMeasurement);
  const hasProgram = Boolean(latestProgram);
  const hasNutrition = Boolean(nutritionPlan);
  const next = resolveWorkflowNextAction({ hasMember, hasMeasurement, hasProgram, hasNutrition });

  return {
    title: `${memberName} için sıradaki en doğru adım`,
    subtitle: next.subtitle,
    nextAction: next.action,
    nextActionLabel: next.label,
    steps: [
      {
        number: "1",
        title: "Üye",
        status: hasMember ? "done" : "current",
        text: hasMember ? `${memberName} çalışma dosyası hazır.` : "Önce üye seçin veya yeni üye bilgisi girin.",
      },
      {
        number: "2",
        title: "Ölçüm",
        status: hasMeasurement ? "done" : hasMember ? "current" : "todo",
        text: hasMeasurement ? formatWorkflowMeasurement(latestMeasurement) : "Tanita CSV veya manuel ölçüm bekleniyor.",
      },
      {
        number: "3",
        title: "Program",
        status: hasProgram ? "done" : hasMeasurement ? "current" : "todo",
        text: hasProgram ? "Program hazır; isterseniz düzenleyip kaydedin." : "Hedef, seviye ve ölçüme göre program oluşturun.",
      },
      {
        number: "4",
        title: "Çıktı",
        status: hasProgram ? "current" : "todo",
        text: hasNutrition ? "PDF ve beslenme sekmesi birlikte takip edilebilir." : "Program PDF’i hazır olduğunda üyeye verilebilir.",
      },
    ],
  };
}

function resolveWorkflowNextAction({ hasMember, hasMeasurement, hasProgram, hasNutrition }) {
  if (!hasMember) {
    return {
      action: "members",
      label: "Üye Seç / Oluştur",
      subtitle: "Üye seçilmeden ölçüm, program ve çıktı akışı sağlıklı ilerlemez.",
    };
  }

  if (!hasMeasurement) {
    return {
      action: "measurements",
      label: "Ölçüm Gir",
      subtitle: "Tanita CSV veya manuel ölçüm eklemek program ve beslenmeyi daha isabetli yapar.",
    };
  }

  if (!hasProgram) {
    return {
      action: "build-program",
      label: "Program Oluştur",
      subtitle: "Ölçüm verisi hazır; şimdi hedefe uygun antrenman planını oluşturabilirsiniz.",
    };
  }

  if (!hasNutrition) {
    return {
      action: "nutrition",
      label: "Beslenme Planı",
      subtitle: "Program hazır; isterseniz Beslenme sekmesinde Tanita bazlı plan oluşturun.",
    };
  }

  return {
    action: "output",
    label: "PDF Çıktısını Aç",
    subtitle: "Üye dosyası tamam; çıktı/PDF ekranından son kontrolü yapabilirsiniz.",
  };
}

function formatWorkflowMeasurement(measurement) {
  const parts = [
    measurement?.date || "Tarih yok",
    formatWorkflowMetric(measurement?.weight, "kg"),
    formatWorkflowMetric(measurement?.fat, "yağ"),
    formatWorkflowMetric(measurement?.muscleMass, "kas"),
  ].filter(Boolean);

  return parts.join(" • ");
}

function formatWorkflowMetric(value, label) {
  if (value === "" || value === undefined || value === null) {
    return "";
  }

  return `${value} ${label}`;
}

function buildActivityItems() {
  return buildActivityItemsService(state.members, formatMeasurementLine);
}

function getMemberAnalysis(member) {
  if (!member) {
    return null;
  }

  try {
    if (window.BSMAnalysisEngine?.analyzeMember) {
      return window.BSMAnalysisEngine.analyzeMember({ member });
    }
  } catch (error) {
    console.warn("V2 analysis engine error", error);
  }

  return buildFallbackMemberAnalysis(member);
}

function buildFallbackMemberAnalysis(member) {
  return buildFallbackMemberAnalysisService(member, labelMaps);
}

function getAutomationSummary() {
  try {
    if (window.BSMAutomationEngine?.syncAutomations) {
      return window.BSMAutomationEngine.syncAutomations(state.members, state.activeMemberId);
    }
  } catch (error) {
    console.warn("V2 automation engine error", error);
  }

  return buildFallbackAutomationSummaryService(buildActivityItems());
}

function renderCoachAlertsPanel(automationSummary, activeMember) {
  if (!coachAlertsPanel) {
    return;
  }

  const activeAnalysis = getMemberAnalysis(activeMember);
  const activeAlerts = (activeAnalysis?.coachAlerts || []).map((alert) => ({
    ...alert,
    memberId: activeMember?.id || "",
    memberName: activeMember?.profile?.memberName || "Aktif üye",
    workspace: "v3",
    actionLabel: "İncele",
    severityLabel: alert.level === "danger" || alert.severity === "danger" ? "Risk" : "Takip",
  }));
  const automationAlerts = (automationSummary.records || []).slice(0, 3).map((record) => ({
    ...record,
    workspace: record.type === "measurement-reminder" || record.type === "measurement-missing" ? "measurements" : "members",
    actionLabel: record.type === "measurement-reminder" || record.type === "measurement-missing" ? "Ölçüm aç" : "Üye aç",
    severityLabel: record.severity === "warning" ? "Takip" : "Bilgi",
  }));
  const alerts = [...activeAlerts, ...automationAlerts]
    .filter((alert, index, list) => list.findIndex((item) => `${item.memberName}-${item.type}-${item.title}` === `${alert.memberName}-${alert.type}-${alert.title}`) === index)
    .slice(0, 3);
  renderCoachAlertsUi(coachAlertsPanel, alerts, escapeHtml);
}

function renderV3DashboardCalendar(automationSummary) {
  if (!v3DashboardCalendar) {
    return;
  }

  const calendarItems = getV3DashboardCalendar(automationSummary);
  renderV3DashboardCalendarUi(v3DashboardCalendar, calendarItems, escapeHtml, formatV3DaysLeft);
}

function getV3DashboardCalendar(automationSummary) {
  try {
    if (window.BSMV3InsightsEngine?.buildDashboardCalendar) {
      return window.BSMV3InsightsEngine.buildDashboardCalendar(state.members, automationSummary.records || []);
    }
  } catch (error) {
    console.warn("V3 dashboard calendar error", error);
  }

  return (automationSummary.records || []).slice(0, 5).map((record) => ({
    memberId: record.memberId,
    memberName: record.memberName,
    title: record.title,
    text: record.message,
    dueAt: record.dueAt,
    daysLeft: 0,
      severity: record.severity,
  }));
}

function renderCoachTaskPanel(automationSummary) {
  if (!coachTaskPanel) {
    return;
  }

  const tasks = buildCoachTasks(automationSummary).slice(0, 3);
  renderCoachTasksUi(coachTaskPanel, tasks, escapeHtml);
}

function buildCoachTasks(automationSummary) {
  return buildCoachTasksService(state.members, automationSummary.records || [], getMemberAnalysis);
}

function renderCoachQuickPanel(activeMember) {
  if (!coachQuickPanel) {
    return;
  }

  renderCoachQuickPanelUi(coachQuickPanel, buildCoachQuickPanelModel(activeMember), escapeHtml);
}

function buildCoachQuickPanelModel(activeMember) {
  return buildCoachQuickPanelModelService(activeMember, getMemberAnalysis, getDayLabel);
}


function renderActiveMemberProfile() {
  const member = findActiveMember();
  const activeAnalysis = getMemberAnalysis(member);
  const activeProfileData = member?.profile || {};
  const latestMeasurementRecord = member?.measurements?.[0] || null;
  const latestProgramRecord = member?.programs?.[0]?.program || null;
  const profileModel = member
    ? {
        memberName: activeProfileData.memberName || "İsimsiz Üye",
        memberCode: activeProfileData.memberCode || "Üye no yok",
        trainerName: activeProfileData.trainerName || "Antrenör yok",
        levelLabel: labelMaps.level[activeProfileData.level] || "Seviye yok",
        goalLabel: labelMaps.goal[activeProfileData.goal] || "Belirtilmedi",
        latestMeasurementDate: latestMeasurementRecord?.date || "Yok",
        programStatus: latestProgramRecord ? "Aktif" : "Yok",
        riskText: activeProfileData.restrictions?.length
          ? activeProfileData.restrictions.map((item) => labelMaps.restrictions[item]).join(", ")
          : "Özel uyarı yok",
        score: `${activeAnalysis?.score ?? 0}/100`,
        goalFitScore: `${activeAnalysis?.goalFitScore ?? 0}/100`,
        riskLevel: activeAnalysis?.riskLevel || "Belirsiz",
        summary: activeAnalysis?.summary || "Analiz için ölçüm ve üye bilgisi bekleniyor.",
        trendText: activeAnalysis?.trend?.text || "Trend için en az iki ölçüm gerekir.",
        programSuitability: activeAnalysis?.programSuitability || "Program uygunluğu için kayıt bekleniyor.",
        revisionNote: activeAnalysis?.revisionNote || "Revizyon notu ölçüm trendine göre oluşur.",
        nextAction: activeAnalysis?.nextAction || "Ölçüm ve program takibini başlat.",
        lastThreeMeasurements: (activeAnalysis?.measurementSummary || []).map((item) => ({
          date: item.date,
          summary: `${item.weight} • Yağ: ${item.fat} • Kas: ${item.muscleMass}`,
        })),
        warnings: (activeAnalysis?.coachAlerts || []).slice(0, 3),
      }
    : null;
  renderActiveMemberProfileUi(activeMemberProfile, profileModel, escapeHtml);
  return;
}

function renderMemberList() {
  const searchText = normalizeText(memberSearch.value);
  const filteredMembers = state.members.filter((member) => {
    const profile = member.profile || {};
    const haystack = [
      profile.memberName,
      profile.memberCode,
      profile.trainerName,
      labelMaps.goal[profile.goal],
      labelMaps.level[profile.level],
    ]
      .filter(Boolean)
      .join(" ");

    return !searchText || normalizeText(haystack).includes(searchText);
  });
  const sortedMembers = sortMembersForList(filteredMembers, state.activeMemberSort);
  const listModel = {
    totalCount: state.members.length,
    activeSort: normalizeMemberSort(state.activeMemberSort),
    items: sortedMembers.map((member) => {
      const profile = member.profile || {};
      const isActive = member.id === state.activeMemberId;
      const lastMeasurement = member.measurements?.[0];
      const lastProgram = member.programs?.[0];

      return {
        memberId: member.id,
        isActive,
        memberName: profile.memberName || "İsimsiz Üye",
        memberCode: profile.memberCode || "Üye no yok",
        goalLabel: labelMaps.goal[profile.goal] || "Hedef yok",
        measurementText: lastMeasurement ? `Son ölçüm: ${lastMeasurement.date}` : "Ölçüm kaydı yok",
        programText: lastProgram ? "Program geçmişi var" : "Program kaydı yok",
        actionLabel: isActive ? "Aktif" : "Yükle",
        photo: profile.photo || null,
      };
    }),
  };
  renderMemberListUi(
    {
      memberList,
      memberCount,
      memberSort,
    },
    listModel,
    escapeHtml,
  );
  return;
}

function renderMeasurementHistory() {
  const member = findActiveMember();
  const measurementRecords = getActiveMeasurementRecords(member);
  const activeMeasurement = getActiveMeasurementSnapshot(member);

  if (!member) {
    renderBodyAnalysisReportUi(bodyAnalysisReport, null, escapeHtml);
    renderMeasurementHistoryUi(measurementHistory, null, escapeHtml);
    renderMeasurementPremiumInsight(null, null);
    renderMeasurementLeftSummary(null);
    renderMeasurementHistoryTrendHost([]);
    renderMeasurementCsvAnalytics(null);
    return;
  }

  renderBodyAnalysisReport(measurementRecords, member);
  renderMeasurementHistoryUi(
    measurementHistory,
    {
      variant: "premium-table",
      items: measurementRecords.slice(0, 10).map((item) => ({
        id: item.id,
        date: item.date,
        weight: formatMeasurementCell(item.weight, "kg"),
        fat: formatMeasurementCell(item.fat ?? item.bodyFatPercentage, "%"),
        muscleMass: formatMeasurementCell(item.muscleMass, "kg"),
        waist: formatMeasurementCell(item.waist, "cm"),
        visceralFat: formatMeasurementCell(item.visceralFat, ""),
        bmr: formatMeasurementCell(item.bmr, "kcal"),
        metabolicAge: formatMeasurementCell(item.metabolicAge, ""),
        sourceLabel: getMeasurementSourceLabel(item),
        v3Score: buildMeasurementInsightModel(member, item).score,
        line: formatMeasurementLine(item),
        segmentLine: formatSegmentLine(item.segments),
        resistanceLine: formatResistanceLine(item.resistance),
        note: item.note || "",
      })),
    },
    escapeHtml,
  );
  renderMeasurementPremiumInsight(member, activeMeasurement || measurementRecords[0] || state.latestMeasurement || null);
  renderMeasurementLeftSummary(member);
  renderMeasurementHistoryTrendHost(measurementRecords, member);
  renderMeasurementCsvAnalytics(member);
}

function renderMeasurementHistoryTrendHost(measurements = [], member = findActiveMember()) {
  const host = document.querySelector("#measurementHistoryTrendHost");

  if (!host) {
    return;
  }

  const filters = normalizeMeasurementHistoryFilters();
  const filteredMeasurements = filterMeasurementsByHistoryRange(measurements, filters.range);

  if (!measurements.length) {
    host.innerHTML = `
      <div class="measurement-history-empty">
        <strong>Bu üye için henüz ölçüm kaydı yok.</strong>
        <span>İlk ölçümü Tanita CSV veya manuel girişle kaydettiğinizde trend kartları otomatik oluşur.</span>
      </div>
    `;
    return;
  }

  const trendCards = buildPremiumMeasurementTrendCards(filteredMeasurements, member, filters);
  const chartCards = buildPremiumMeasurementChartCards(filteredMeasurements, member, filters);
  const hasTrend = filteredMeasurements.length > 1;

  host.innerHTML = `
    <section class="measurement-history-command">
      <div class="measurement-history-filter-row">
        ${renderMeasurementHistoryFilterGroup("Görüntüle", "view", [
          ["all", "Tüm Vücut"],
          ["composition", "Kompozisyon"],
          ["circumference", "Çevre"],
          ["segmental", "Segmental"],
        ], filters.view)}
        ${renderMeasurementHistoryFilterGroup("Zaman Aralığı", "range", [
          ["1m", "1A"],
          ["3m", "3A"],
          ["6m", "6A"],
          ["1y", "1Y"],
          ["all", "Tümü"],
        ], filters.range)}
        ${renderMeasurementHistoryFilterGroup("Karşılaştır", "compare", [
          ["previous", "Önceki Ölçüm"],
          ["start", "Başlangıç Ölçümü"],
        ], filters.compare)}
        <button type="button" class="measurement-history-export" data-measurement-ui-action="export-history">Grafikleri Dışa Aktar</button>
      </div>
    </section>

    <section class="measurement-history-kpi-grid">
      ${trendCards.map(renderPremiumMeasurementTrendCard).join("")}
    </section>

    <section class="measurement-history-chart-panel">
      <div class="measurement-tab-intro">
        <strong>Büyük Trend Grafikleri</strong>
        <span>${hasTrend ? "Seçilen aralıktaki ölçümlerin görsel gelişim çizgisi." : "Trend için en az iki ölçüm gerekir."}</span>
      </div>
      <div class="measurement-history-chart-grid">
        ${chartCards.map(renderPremiumMeasurementChartCard).join("")}
      </div>
      <div class="measurement-history-chart-note">Grafiklerdeki değerler kayıtlı manuel/Tanita ölçüm geçmişinden hesaplanır.</div>
    </section>
  `;
}

function normalizeMeasurementHistoryFilters() {
  const filters = state.measurementHistoryFilters || {};
  return {
    view: ["all", "composition", "circumference", "segmental"].includes(filters.view) ? filters.view : "all",
    range: ["1m", "3m", "6m", "1y", "all"].includes(filters.range) ? filters.range : "all",
    compare: ["previous", "start"].includes(filters.compare) ? filters.compare : "previous",
  };
}

function renderMeasurementHistoryFilterGroup(label, key, options, activeValue) {
  return `
    <div class="measurement-history-filter-group" aria-label="${escapeHtml(label)}">
      <span>${escapeHtml(label)}</span>
      <div>
        ${options
          .map(
            ([value, text]) => `
              <button
                type="button"
                class="${value === activeValue ? "is-active" : ""}"
                data-measurement-history-filter="${escapeHtml(key)}"
                data-measurement-history-value="${escapeHtml(value)}"
              >${escapeHtml(text)}</button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function filterMeasurementsByHistoryRange(measurements = [], range = "all") {
  const records = Array.isArray(measurements) ? measurements : [];

  if (range === "all") {
    return records;
  }

  const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[range] || 0;

  if (!months) {
    return records;
  }

  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);

  return records.filter((measurement) => {
    const date = parseMeasurementHistoryDate(measurement?.date || measurement?.createdAtIso);
    return date ? date >= start : true;
  });
}

function parseMeasurementHistoryDate(value) {
  if (!value) {
    return null;
  }

  const text = String(value);
  const parts = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (parts) {
    return new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPremiumMeasurementTrendCards(measurements = [], member = findActiveMember(), filters = normalizeMeasurementHistoryFilters()) {
  const definitions = [
    { key: "weight", label: "Kilo", suffix: "kg", color: "blue", lowerIsBetter: false },
    { key: "fat", label: "Yağ Oranı", suffix: "%", color: "green", lowerIsBetter: true },
    { key: "muscleMass", label: "Kas Kütlesi", suffix: "kg", color: "purple", lowerIsBetter: false },
    { key: "waist", label: "Bel Çevresi", suffix: "cm", color: "orange", lowerIsBetter: true },
    { key: "v3Score", label: "V3 Skoru", suffix: "/100", color: "gold", lowerIsBetter: false },
  ];

  return definitions.map((definition) => buildPremiumTrendModel(definition, measurements, member, filters.compare));
}

function buildPremiumMeasurementChartCards(measurements = [], member = findActiveMember(), filters = normalizeMeasurementHistoryFilters()) {
  const chartGroups = {
    all: [
      { key: "weight", label: "Kilo", suffix: "kg", color: "blue", lowerIsBetter: false },
      { key: "fat", label: "Yağ Oranı", suffix: "%", color: "green", lowerIsBetter: true },
      { key: "muscleMass", label: "Kas Kütlesi", suffix: "kg", color: "purple", lowerIsBetter: false },
      { key: "visceralFat", label: "Visceral Yağ", suffix: "", color: "orange", lowerIsBetter: true },
    ],
    composition: [
      { key: "fat", label: "Yağ Oranı", suffix: "%", color: "green", lowerIsBetter: true },
      { key: "fatMass", label: "Yağ Kütlesi", suffix: "kg", color: "orange", lowerIsBetter: true },
      { key: "muscleMass", label: "Kas Kütlesi", suffix: "kg", color: "purple", lowerIsBetter: false },
      { key: "bodyWater", label: "Vücut Suyu", suffix: "%", color: "blue", lowerIsBetter: false },
    ],
    circumference: [
      { key: "waist", label: "Bel Çevresi", suffix: "cm", color: "orange", lowerIsBetter: true },
      { key: "hip", label: "Kalça Çevresi", suffix: "cm", color: "blue", lowerIsBetter: true },
      { key: "chest", label: "Göğüs Çevresi", suffix: "cm", color: "purple", lowerIsBetter: false },
      { key: "weight", label: "Kilo", suffix: "kg", color: "green", lowerIsBetter: false },
    ],
    segmental: [
      { key: "segments.rightArmMuscle", label: "Sağ Kol Kas", suffix: "kg", color: "purple", lowerIsBetter: false },
      { key: "segments.leftArmMuscle", label: "Sol Kol Kas", suffix: "kg", color: "purple", lowerIsBetter: false },
      { key: "segments.rightLegMuscle", label: "Sağ Bacak Kas", suffix: "kg", color: "blue", lowerIsBetter: false },
      { key: "segments.leftLegMuscle", label: "Sol Bacak Kas", suffix: "kg", color: "blue", lowerIsBetter: false },
    ],
  };

  return (chartGroups[filters.view] || chartGroups.all).map((definition) =>
    buildPremiumTrendModel(definition, measurements, member, filters.compare),
  );
}

function buildPremiumTrendModel(definition, measurements = [], member = findActiveMember(), compareMode = "previous") {
  const newestFirst = (measurements || []).filter(Boolean);
  const oldestFirst = newestFirst.slice().reverse();
  const values = oldestFirst
    .map((measurement) => ({
      value: getMeasurementTrendValue(measurement, definition.key, member),
      label: formatShortMeasurementDate(measurement?.date || measurement?.createdAtIso),
    }))
    .filter((item) => Number.isFinite(item.value));
  const latestValue = newestFirst.map((measurement) => getMeasurementTrendValue(measurement, definition.key, member)).find(Number.isFinite);
  const baselineCandidate = compareMode === "start"
    ? newestFirst.slice().reverse().map((measurement) => getMeasurementTrendValue(measurement, definition.key, member)).find(Number.isFinite)
    : newestFirst.slice(1).map((measurement) => getMeasurementTrendValue(measurement, definition.key, member)).find(Number.isFinite);
  const delta = Number.isFinite(latestValue) && Number.isFinite(baselineCandidate) ? latestValue - baselineCandidate : null;
  const stateName = resolveTrendState(delta, definition.lowerIsBetter);

  return {
    ...definition,
    value: formatMeasurementCell(latestValue, definition.suffix),
    delta,
    deltaLabel: formatTrendDelta(delta, definition.suffix),
    stateName,
    statusLabel: resolveTrendStatusLabel(delta, definition.lowerIsBetter),
    values,
  };
}

function getMeasurementTrendValue(measurement, key, member = findActiveMember()) {
  if (!measurement) {
    return null;
  }

  if (key === "fat") {
    return numberOrNull(measurement.fat ?? measurement.bodyFatPercentage);
  }

  if (key === "v3Score") {
    return numberOrNull(buildMeasurementInsightModel(member, measurement).score);
  }

  if (key.includes(".")) {
    return numberOrNull(key.split(".").reduce((value, part) => value?.[part], measurement));
  }

  return numberOrNull(measurement[key]);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolveTrendState(delta, lowerIsBetter = false) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) {
    return "neutral";
  }

  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return improved ? "good" : "attention";
}

function resolveTrendStatusLabel(delta, lowerIsBetter = false) {
  const stateName = resolveTrendState(delta, lowerIsBetter);
  if (stateName === "good") return "İyi";
  if (stateName === "attention") return "Dikkat";
  return "Stabil";
}

function formatTrendDelta(delta, suffix = "") {
  if (!Number.isFinite(delta)) {
    return "2 ölçüm gerekir";
  }

  const formatted = Math.abs(delta).toFixed(Math.abs(delta) % 1 === 0 ? 0 : 1);
  return `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${formatted} ${suffix}`.trim();
}

function formatMeasurementCell(value, suffix = "") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return `${number.toFixed(number % 1 === 0 ? 0 : 1)} ${suffix}`.trim();
}

function formatShortMeasurementDate(value) {
  const date = parseMeasurementHistoryDate(value);

  if (!date) {
    return String(value || "-").slice(0, 10);
  }

  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function renderPremiumMeasurementTrendCard(card) {
  return `
    <article class="measurement-history-kpi-card is-${escapeHtml(card.color)}">
      <div class="measurement-history-kpi-card__head">
        <span>${escapeHtml(card.label)}</span>
        <em class="is-${escapeHtml(card.stateName)}">${escapeHtml(card.statusLabel)}</em>
      </div>
      <div class="measurement-history-kpi-card__value">
        <strong>${escapeHtml(card.value)}</strong>
        <small class="is-${escapeHtml(card.stateName)}">${escapeHtml(card.deltaLabel)}</small>
      </div>
      ${renderPremiumMeasurementSparkline(card.values, card.color)}
    </article>
  `;
}

function renderPremiumMeasurementChartCard(card) {
  return `
    <article class="measurement-history-chart-card is-${escapeHtml(card.color)}">
      <div class="measurement-history-chart-card__head">
        <strong>${escapeHtml(card.label)}</strong>
        <span>${escapeHtml(card.value)}</span>
        <small class="is-${escapeHtml(card.stateName)}">${escapeHtml(card.deltaLabel)}</small>
      </div>
      ${renderPremiumMeasurementLineChart(card.values, card.color)}
    </article>
  `;
}

function renderPremiumMeasurementSparkline(points = [], color = "blue") {
  if ((points || []).length < 2) {
    return `<div class="measurement-history-sparkline is-empty"></div>`;
  }

  const values = points.map((point) => point.value);
  const path = buildSvgPoints(values, 100, 34, 4);

  return `
    <svg class="measurement-history-sparkline is-${escapeHtml(color)}" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${escapeHtml(path)}"></polyline>
    </svg>
  `;
}

function renderPremiumMeasurementLineChart(points = [], color = "blue") {
  if ((points || []).length < 2) {
    return `
      <div class="measurement-history-chart-empty">
        <strong>Trend için en az iki ölçüm gerekir.</strong>
        <span>İkinci ölçümden sonra grafik otomatik oluşur.</span>
      </div>
    `;
  }

  const values = points.map((point) => point.value);
  const polyline = buildSvgPoints(values, 360, 142, 18);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return `
    <div class="measurement-history-chart-canvas">
      <svg class="measurement-history-line-chart is-${escapeHtml(color)}" viewBox="0 0 360 170" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="historyGradient-${escapeHtml(color)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.18"></stop>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <line x1="18" y1="26" x2="342" y2="26"></line>
        <line x1="18" y1="83" x2="342" y2="83"></line>
        <line x1="18" y1="140" x2="342" y2="140"></line>
        <polyline points="${escapeHtml(polyline)}"></polyline>
      </svg>
      <div class="measurement-history-chart-scale">
        <span>${escapeHtml(max.toFixed(max % 1 === 0 ? 0 : 1))}</span>
        <span>${escapeHtml(min.toFixed(min % 1 === 0 ? 0 : 1))}</span>
      </div>
      <div class="measurement-history-chart-dates">
        <span>${escapeHtml(points[0]?.label || "-")}</span>
        <span>${escapeHtml(points[points.length - 1]?.label || "-")}</span>
      </div>
    </div>
  `;
}

function buildSvgPoints(values = [], width = 100, height = 40, padding = 4) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = padding + (height - padding * 2) * (1 - (value - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function getMeasurementSourceLabel(measurement = {}) {
  const source = String(measurement.source || measurement.measurementMethod || "").toLowerCase();

  if (source.includes("tanita") || source.includes("csv")) {
    return "Tanita CSV";
  }

  if (source.includes("manual")) {
    return "Manuel";
  }

  return measurement.source ? titleCase(String(measurement.source).replace(/[_-]/g, " ")) : "Manuel";
}

function exportMeasurementHistoryCsv() {
  const member = findActiveMember();
  const records = getActiveMeasurementRecords(member);

  if (!member || !records.length) {
    showStatus("Dışa aktarılacak ölçüm geçmişi bulunamadı.", "error");
    return;
  }

  const rows = [
    ["Tarih", "Kilo", "Yağ Oranı", "Kas Kütlesi", "Bel", "Visceral Yağ", "BMR", "Metabolik Yaş", "Kaynak"],
    ...records.map((measurement) => [
      measurement.date || "",
      measurement.weight || "",
      measurement.fat ?? measurement.bodyFatPercentage ?? "",
      measurement.muscleMass || "",
      measurement.waist || "",
      measurement.visceralFat || "",
      measurement.bmr || "",
      measurement.metabolicAge || "",
      getMeasurementSourceLabel(measurement),
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadFile(`bsm-olcum-gecmisi-${formatFileDate(new Date())}.csv`, csv, "text/csv;charset=utf-8");
  showStatus("Ölçüm geçmişi CSV olarak dışa aktarıldı.", "success");
}

function renderProgramHistory() {
  const member = findActiveMember();
  const programRecords = member?.programs || [];

  if (programHistory?.closest(".measurement-history-program-card")) {
    renderPremiumProgramHistory(programHistory, member, programRecords);
    return;
  }

  renderProgramHistoryUi(
    programHistory,
    member
      ? {
          items: programRecords.slice(0, 6).map((record) => ({
            id: record.id,
            title: record.program?.title || "Program",
            savedAt: record.savedAt || record.program?.createdAt || "Tarih yok",
          })),
        }
      : null,
    escapeHtml,
  );
}

function renderPremiumProgramHistory(target, member, programRecords = []) {
  if (!target) {
    return;
  }

  if (!member) {
    target.innerHTML = `<div class="empty-state compact-empty">Bir üye seçildiğinde program geçmişi burada görünür.</div>`;
    return;
  }

  if (!programRecords.length) {
    target.innerHTML = `
      <div class="measurement-history-empty">
        <strong>Bu üye için kayıtlı program bulunmuyor.</strong>
        <span>Program oluşturulduğunda ölçüm gelişimiyle birlikte burada takip edilir.</span>
      </div>
    `;
    return;
  }

  const latestMeasurement = member.measurements?.[0] || null;
  target.innerHTML = `
    <div class="measurement-program-history-grid">
      ${programRecords
        .slice(0, 6)
        .map((record) => {
          const program = record.program || {};
          const rawData = program.rawData || program.programContext?.rawData || {};
          const goal = labelMaps.goal[rawData.goal || member.profile?.goal] || rawData.goal || member.profile?.goal || "-";
          const savedAt = record.savedAt || program.createdAt || record.savedAtIso || "Tarih yok";
          return `
            <article class="measurement-program-history-card">
              <div>
                <span>${escapeHtml(record.id === programRecords[0]?.id ? "Aktif / Son Kayıt" : "Kayıtlı")}</span>
                <strong>${escapeHtml(program.title || record.title || "Antrenman Programı")}</strong>
                <small>${escapeHtml(savedAt)}</small>
              </div>
              <dl>
                <div><dt>Hedef</dt><dd>${escapeHtml(goal)}</dd></div>
                <div><dt>İlgili ölçüm</dt><dd>${escapeHtml(latestMeasurement?.date || "Ölçüm yok")}</dd></div>
              </dl>
              <button type="button" class="ghost-button mini-button" data-program-id="${escapeHtml(record.id || "")}">Görüntüle</button>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderV3CoachingPanel() {
  const member = findActiveMember();

  if (!member) {
    renderV3CoachingPanelUi(
      {
        professionalMemberFile,
        v3MemberDossier,
        v3TrendCharts,
        v3RevisionPanel,
        v3ControlCalendar,
      },
      null,
      escapeHtml,
    );
    return;
  }

  const automationSummary = getAutomationSummary();
  const analysis = getMemberAnalysis(member);
  const dossier = getV3MemberDossier(member, analysis, automationSummary.records || []);
  const profile = member.profile || {};
  const latestMeasurement = member.measurements?.[0] || null;
  const latestProgram = member.programs?.[0] || null;
  const statusTags = buildMemberStatusTags(member, analysis, dossier);

  renderV3CoachingPanelUi(
    {
      professionalMemberFile,
      v3MemberDossier,
      v3TrendCharts,
      v3RevisionPanel,
      v3ControlCalendar,
    },
    {
      memberName: profile.memberName || "İsimsiz Üye",
      memberCode: profile.memberCode || "Üye no yok",
      goalLabel: labelMaps.goal[profile.goal] || "Hedef yok",
      levelLabel: labelMaps.level[profile.level] || "Seviye yok",
      riskLabel: analysis.riskLevel || "Belirsiz",
      statusTags,
      latestMeasurementDate: latestMeasurement?.date || "Yok",
      latestProgramDate: latestProgram?.savedAt || latestProgram?.program?.createdAt || "Yok",
      latestMeasurement,
      latestProgram,
      profileGoal: profile.goal || "",
      profileLevel: profile.level || "",
      score: analysis.score ?? 0,
      goalFitScore: analysis.goalFitScore ?? 0,
      nextAction: analysis.nextAction || "Ölçüm ve program takibini güncelle.",
      readinessScore: dossier.readinessScore ?? 0,
      summary: dossier.summary || "Üye V3 takibe hazırlanıyor.",
      dataQualityScore: dossier.dataQualityScore ?? 0,
      measurementCount: dossier.latestMeta?.measurementCount || 0,
      programCount: dossier.latestMeta?.programCount || 0,
      continuityScore: dossier.continuityScore ?? 0,
      measurementAge: dossier.latestMeta?.measurementAge,
      programAge: dossier.latestMeta?.programAge,
      coachingPriorityScore: dossier.coachingPriorityScore ?? 0,
      mediaReadinessText: dossier.mediaReadiness?.text || "Hareket video/görsel bağlantıları ileride eklenebilir.",
      trendSeries: dossier.trendSeries || [],
      revisionPriority: dossier.revisionPlan?.priority || "Normal",
      fitNote: dossier.revisionPlan?.fitNote || "Program uygunluğu kontrol ediliyor.",
      revisionNote: dossier.revisionPlan?.revisionNote || "Revizyon notu ölçüm trendiyle netleşir.",
      recommendedActions: dossier.revisionPlan?.recommendedActions || [],
      approvalSteps: dossier.revisionPlan?.approvalSteps || [],
      riskControls: dossier.revisionPlan?.riskControls || [],
      coachChecklist: dossier.coachChecklist || [],
      controlTimeline: (dossier.controlTimeline || []).map((item) => ({
        ...item,
        dueAtLabel: formatDashboardDate(item.dueAt),
      })),
    },
    escapeHtml,
  );
}

function getV3MemberDossier(member, analysis, automationRecords) {
  try {
    if (window.BSMV3InsightsEngine?.buildMemberDossier) {
      return window.BSMV3InsightsEngine.buildMemberDossier(member, analysis, automationRecords);
    }
  } catch (error) {
    console.warn("V3 member dossier error", error);
  }

  return {
    readinessScore: analysis?.score || 0,
    dataQualityScore: member.measurements?.length ? 70 : 35,
    continuityScore: member.programs?.length ? 70 : 45,
    coachingPriorityScore: analysis?.riskLevel === "Yüksek" ? 75 : 35,
    summary: analysis?.summary || "V3 analiz için üye verisi bekleniyor.",
    trendSeries: window.BSMV3InsightsEngine?.buildTrendSeries?.(member.measurements || [], member.profile?.goal) || [],
    revisionPlan: {
      priority: analysis?.riskLevel || "Normal",
      fitNote: analysis?.programSuitability || "",
      revisionNote: analysis?.revisionNote || "",
      recommendedActions: [analysis?.nextAction || "Ölçüm ve program takibini güncelle."],
      approvalSteps: ["Antrenör ölçüm trendini ve uygulama notlarını kontrol eder."],
      riskControls: ["Teknik kalite bozulursa hareket alternatifi seçilir."],
    },
    controlTimeline: [],
    coachChecklist: [analysis?.nextAction || "Bir sonraki kontrolü planla."],
    mediaReadiness: { text: "Hareket video/görsel alanı V3 için hazırlandı." },
    latestMeta: {
      measurementAge: null,
      programAge: null,
      measurementCount: member.measurements?.length || 0,
      programCount: member.programs?.length || 0,
    },
  };
}

function buildMemberStatusTags(member, analysis, dossier) {
  const tags = [];
  const latestMeta = dossier.latestMeta || {};

  if (!member.measurements?.length) {
    tags.push({ label: "Ölçüm bekliyor", tone: "warning" });
  } else if (latestMeta.measurementAge !== null && latestMeta.measurementAge > 14) {
    tags.push({ label: "Ölçüm yenile", tone: "warning" });
  } else {
    tags.push({ label: "Ölçüm güncel", tone: "good" });
  }

  if (!member.programs?.length) {
    tags.push({ label: "Program yok", tone: "warning" });
  } else if (latestMeta.programAge !== null && latestMeta.programAge > 21) {
    tags.push({ label: "Program revizyonu", tone: "warning" });
  } else {
    tags.push({ label: "Program aktif", tone: "good" });
  }

  if (analysis.riskLevel === "Yüksek") {
    tags.push({ label: "Yakın takip", tone: "danger" });
  } else if (analysis.riskLevel === "Orta") {
    tags.push({ label: "Kontrollü takip", tone: "warning" });
  } else {
    tags.push({ label: "Düşük risk", tone: "good" });
  }

  if ((member.profile?.restrictions || []).length) {
    tags.push({ label: "Hassasiyet var", tone: "warning" });
  }

  if (analysis.trend?.fat?.direction === "down") {
    tags.push({ label: "Yağ trendi iyi", tone: "good" });
  }

  if (analysis.trend?.muscle?.direction === "up") {
    tags.push({ label: "Kas trendi iyi", tone: "good" });
  }

  return tags.slice(0, 6);
}


function applyV3RevisionDefaults(data, analysis) {
  const revised = {
    ...data,
    programStyle: data.programStyle || "auto",
    trainingSystem: normalizeTrainingSystem(data.trainingSystem || "standard"),
    days: data.days?.length >= 2 ? data.days : ["monday", "wednesday", "friday"],
  };

  if (revised.goal === "fat-loss" && revised.cardioPreference === "low") {
    revised.cardioPreference = "balanced";
  }

  if (analysis?.riskLevel === "Yüksek" && ["giant-set", "tri-set", "drop-set", "rest-pause"].includes(revised.trainingSystem)) {
    revised.trainingSystem = "standard";
  }

  if ((revised.restrictions || []).length && revised.equipmentScope === "free-weights") {
    revised.equipmentScope = "standard-gym";
  }

  revised.notes = [revised.notes, "V3 revizyon: Ölçüm trendi, risk seviyesi ve hedef uyumu dikkate alınarak güncellendi."]
    .filter(Boolean)
    .join("\n");

  return revised;
}

function formatV3DaysLeft(daysLeft) {
  if (daysLeft === null || daysLeft === undefined || Number.isNaN(Number(daysLeft))) {
    return "Tarih yok";
  }

  if (Number(daysLeft) <= 0) {
    return "Bugün";
  }

  return `${Number(daysLeft)} gün`;
}

function renderBodyAnalysisReport(measurements, member) {
  if (window.BSMBodyAnalysis) window.BSMBodyAnalysis.render(measurements, member);
}

function readMeasurementForm() {
  const birthDateParts = readBirthDateParts();
  const calculatedAge = calculateAgeFromBirthDate(birthDateParts, measurementDate.value || getTodayInputValue());
  const manualTime = getMeasurementExtraValue("measurementTime");
  const manualGender = getMeasurementExtraValue("measurementGender");
  const measurementMethod = getMeasurementExtraValue("measurementMethod");
  const measurement = {
    id: makeId("measurement"),
    createdAtIso: new Date().toISOString(),
    date: measurementDate.value || getTodayInputValue(),
    time: manualTime,
    gender: manualGender,
    source: measurementMethod || "manual_entry",
    measurementMethod: measurementMethod || "manual_entry",
    measurementDevice: getMeasurementExtraValue("measurementDevice"),
    measuredBy: getMeasurementExtraValue("measurementMeasuredBy"),
    weight: numberOrEmpty(measurementWeight.value),
    height: numberOrEmpty(measurementHeight.value),
    bmi: numberOrEmpty(measurementBmi?.value),
    birthDay: birthDateParts.day,
    birthMonth: birthDateParts.month,
    birthYear: birthDateParts.year,
    birthDate: formatBirthDateValue(birthDateParts),
    age: calculatedAge,
    fat: numberOrEmpty(measurementFat.value),
    muscleMass: numberOrEmpty(measurementMuscleMass.value),
    fatMass: numberOrEmpty(measurementFatMass.value),
    bodyWater: numberOrEmpty(measurementBodyWater.value),
    visceralFat: numberOrEmpty(measurementVisceralFat.value),
    bmr: numberOrEmpty(measurementBmr.value),
    metabolicAge: numberOrEmpty(measurementMetabolicAge.value),
    boneMass: numberOrEmpty(measurementBoneMass.value),
    proteinPercent: numberOrEmpty(getMeasurementExtraValue("measurementProteinPercent")),
    intracellularWater: numberOrEmpty(getMeasurementExtraValue("measurementIntracellularWater")),
    waist: numberOrEmpty(measurementWaist.value),
    hip: numberOrEmpty(measurementHip.value),
    chest: numberOrEmpty(measurementChest.value),
    armCircumference: numberOrEmpty(getMeasurementExtraValue("measurementArmCircumference")),
    thighCircumference: numberOrEmpty(getMeasurementExtraValue("measurementThighCircumference")),
    calfCircumference: numberOrEmpty(getMeasurementExtraValue("measurementCalfCircumference")),
    segments: Object.fromEntries(Object.entries(segmentInputs).map(([key, input]) => [key, numberOrEmpty(input.value)])),
    resistance: Object.fromEntries(Object.entries(segmentResistanceInputs).map(([key, input]) => [key, numberOrEmpty(input.value)])),
    note: measurementNote.value.trim(),
  };
  syncMeasurementDerivedFields(measurement);
  const pendingTanitaMeasurement = state.pendingTanitaMeasurement && typeof state.pendingTanitaMeasurement === "object"
    ? state.pendingTanitaMeasurement
    : null;

  if (pendingTanitaMeasurement) {
    measurement.source = pendingTanitaMeasurement.source || measurement.source;
    measurement.rawPayload = pendingTanitaMeasurement.rawPayload || measurement.rawPayload || null;
    measurement.time = measurement.time || pendingTanitaMeasurement.time || "";
    measurement.gender = measurement.gender || pendingTanitaMeasurement.gender || "";
    measurement.fatFreeMass = firstFilledMeasurementValue(measurement.fatFreeMass, pendingTanitaMeasurement.fatFreeMass);
    measurement.parserVersion = pendingTanitaMeasurement.parserVersion || pendingTanitaMeasurement.rawPayload?.parserVersion || "";
  }

  const hasValue =
    [
      "weight",
      "height",
      "bmi",
      "age",
      "birthDay",
      "birthMonth",
      "birthYear",
      "fat",
      "muscleMass",
      "fatMass",
      "fatFreeMass",
      "bodyWater",
      "visceralFat",
      "bmr",
      "metabolicAge",
      "boneMass",
      "proteinPercent",
      "intracellularWater",
      "waist",
      "hip",
      "chest",
      "armCircumference",
      "thighCircumference",
      "calfCircumference",
    ].some(
      (key) => measurement[key] !== "",
    ) ||
    Object.values(measurement.segments).some((value) => value !== "") ||
    Object.values(measurement.resistance).some((value) => value !== "") ||
    measurement.time ||
    measurement.gender ||
    measurement.measurementDevice ||
    measurement.measuredBy ||
    measurement.note;
  return hasValue ? measurement : null;
}

function getMeasurementExtraValue(id) {
  const input = document.querySelector(`#${id}`);
  return input?.value?.trim?.() || "";
}

function clearMeasurementInputs() {
  measurementWeight.value = "";
  measurementHeight.value = "";
  if (measurementBmi) measurementBmi.value = "";
  measurementBirthDay.value = "";
  measurementBirthMonth.value = "";
  measurementBirthYear.value = "";
  measurementFat.value = "";
  measurementMuscleMass.value = "";
  measurementFatMass.value = "";
  measurementBodyWater.value = "";
  measurementVisceralFat.value = "";
  measurementBmr.value = "";
  measurementMetabolicAge.value = "";
  measurementBoneMass.value = "";
  measurementWaist.value = "";
  measurementHip.value = "";
  measurementChest.value = "";
  Object.values(segmentInputs).forEach((input) => {
    input.value = "";
  });
  Object.values(segmentResistanceInputs).forEach((input) => {
    input.value = "";
  });
  getMeasurementExtraInputs().forEach((input) => {
    input.value = input.id === "measurementMethod" ? "manual_entry" : "";
  });
  measurementNote.value = "";
}

function applyTanitaMeasurementToForm(measurement, options = {}) {
  const source = measurement && typeof measurement === "object" ? measurement : {};

  setInputValue(measurementDate, source.date);
  setInputValue(document.querySelector("#measurementTime"), source.time);
  setInputValue(document.querySelector("#measurementGender"), source.gender);
  setInputValue(document.querySelector("#measurementMethod"), source.measurementMethod || source.source);
  setInputValue(document.querySelector("#measurementDevice"), source.measurementDevice || (String(source.source || "").includes("tanita") ? "Tanita BC-418" : ""));
  setInputValue(document.querySelector("#measurementMeasuredBy"), source.measuredBy);
  setInputValue(measurementWeight, source.weight);
  setInputValue(measurementHeight, source.height);
  setInputValue(measurementBmi, source.bmi);
  setInputValue(document.querySelector("#measurementAge"), source.age);
  setInputValue(measurementBirthDay, source.birthDay);
  setInputValue(measurementBirthMonth, source.birthMonth);
  setInputValue(measurementBirthYear, source.birthYear);
  setInputValue(measurementFat, source.fat);
  setInputValue(measurementMuscleMass, source.muscleMass);
  setInputValue(measurementFatMass, source.fatMass);
  setInputValue(measurementBodyWater, source.bodyWater);
  setInputValue(measurementVisceralFat, source.visceralFat);
  setInputValue(measurementBmr, source.bmr);
  setInputValue(measurementMetabolicAge, source.metabolicAge);
  setInputValue(measurementBoneMass, source.boneMass);
  setInputValue(document.querySelector("#measurementProteinPercent"), source.proteinPercent);
  setInputValue(document.querySelector("#measurementIntracellularWater"), source.intracellularWater);
  setInputValue(document.querySelector("#measurementArmCircumference"), source.armCircumference);
  setInputValue(document.querySelector("#measurementThighCircumference"), source.thighCircumference);
  setInputValue(document.querySelector("#measurementCalfCircumference"), source.calfCircumference);

  Object.entries(source.segments || {}).forEach(([key, value]) => {
    setInputValue(segmentInputs[key], value);
  });

  Object.entries(source.resistance || {}).forEach(([key, value]) => {
    setInputValue(segmentResistanceInputs[key], value);
  });

  if (measurementNote && !measurementNote.value.trim() && source.note) {
    setInputValue(measurementNote, source.note);
  }

  if (options.dispatch !== false) {
    dispatchMeasurementInputEvents();
  }
  console.log("TANITA DATA APPLIED TO FORM");
}

function applyMeasurementToAppState(measurement) {
  const normalizedMeasurement = normalizeMeasurementPayload(measurement);
  const member = upsertMemberFromCurrentForm({ silent: true });
  setActiveMeasurementState(normalizedMeasurement, { memberId: state.activeMemberId || member?.id || "", source: normalizedMeasurement.source || "saved" });

  if (!member) {
    console.log("TANITA APPLIED TO STATE:", state.activeMember);
    return null;
  }

  member.measurements = upsertMeasurementRecord(member.measurements, normalizedMeasurement);
  member.profile = mergeMeasurementIntoProfile(member.profile || collectFormData(), normalizedMeasurement);
  member.updatedAt = new Date().toISOString();
  state.activeMember = member;
  persistMembers();

  const refreshedMember = syncActiveMemberState();
  if (refreshedMember) {
    refreshedMember.profile = mergeMeasurementIntoProfile(refreshedMember.profile || {}, normalizedMeasurement);
    state.activeMember = refreshedMember;
  }

  console.log("TANITA APPLIED TO STATE:", state.activeMember);
  return state.activeMember;
}

function triggerMeasurementRecalculation() {
  const formData = collectFormData();
  const activeMember = state.activeMember || syncActiveMemberState();
  refreshActiveProgramFromMeasurement(formData);

  renderLiveSummary(formData);
  refreshNutritionPlanFromMeasurement(activeMember || state.activeMember);
  renderNutritionWorkspace();
  renderMemberWorkspace();
  renderNutritionOutput();

  console.log("MEASUREMENT RECALC TRIGGERED");
}

function refreshActiveProgramFromMeasurement(formData) {
  if (!state.activeProgram) {
    return false;
  }

  const validationMessage = validateFormData(formData);

  if (validationMessage) {
    return false;
  }

  const refreshedProgram = buildProgram(formData);
  renderProgram(refreshedProgram);
  return true;
}

function loadLatestProgramForOutput() {
  // v1.2.0: Output panel artik standart program ciktisini gosteriyor (v1.1.7
  // davranisi geri restore edildi). Premium Report Center measurement panel'in
  // 'report' alt sekmesine tasindi.

  if (state.activeProgram) {
    return state.activeProgram;
  }

  const member = findActiveMember();
  const latestProgramRecord = member?.programs?.[0];

  if (!latestProgramRecord?.program) {
    return null;
  }

  renderProgram(cloneData(latestProgramRecord.program), { savedProgramRecordId: latestProgramRecord.id || null });
  return state.activeProgram;
}

// v1.1.8: Premium Report Center renderer.
// Aktif uye + son olcum bilgisini hero + preview alanlarina yansitir.
// JS minimal — sadece textContent ve class toggle, mevcut handler'lara dokunmaz.
function renderReportCenter() {
  const member = findActiveMember();
  const profile = member?.profile || {};
  const latestMeasurement = member?.measurements?.[0] || null;

  // ── Hero: avatar + isim + hedef ────────────────────────────────
  const initialsEl = document.querySelector("#bsmReportAvatarInitials");
  if (initialsEl) {
    const name = String(profile.memberName || "").trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
      initialsEl.textContent = initials.toLocaleUpperCase("tr");
    } else {
      initialsEl.textContent = "--";
    }
  }

  const avatarHost = document.querySelector("#bsmReportAvatar");
  if (avatarHost && profile.photo && typeof profile.photo === "string" && profile.photo.startsWith("data:image/")) {
    avatarHost.innerHTML = `<img src="${escapeHtml(profile.photo)}" alt="" loading="lazy" decoding="async" />`;
  } else if (avatarHost && !avatarHost.querySelector(".bsm-report-hero__avatar-initials")) {
    avatarHost.innerHTML = `<span class="bsm-report-hero__avatar-initials" id="bsmReportAvatarInitials">${escapeHtml(initialsEl?.textContent || "--")}</span>`;
  }

  const nameEl = document.querySelector("#bsmReportMemberName");
  if (nameEl) {
    nameEl.textContent = profile.memberName || "Üye seçilmedi";
  }

  const goalChipEl = document.querySelector("#bsmReportGoalChip span");
  if (goalChipEl) {
    const goalLabel = (typeof labelMaps === "object" && labelMaps?.goal?.[profile.goal]) || profile.goal || "Hedef belirtilmedi";
    goalChipEl.textContent = goalLabel;
  }

  // ── Hero tag rozetleri: Uye No / Seviye / Program ──────────────
  const codeEl = document.querySelector("#bsmReportHeroCode");
  if (codeEl) codeEl.textContent = profile.memberCode || "Yok";
  const levelEl = document.querySelector("#bsmReportHeroLevel");
  if (levelEl) {
    const lvlLabel = (typeof labelMaps === "object" && labelMaps?.level?.[profile.level]) || profile.level || "Seviye yok";
    levelEl.textContent = lvlLabel;
  }
  const programEl = document.querySelector("#bsmReportHeroProgram");
  if (programEl) {
    const hasProgram = Array.isArray(member?.programs) && member.programs.length > 0;
    programEl.textContent = hasProgram ? "Aktif" : "Bekliyor";
  }

  // ── Meta: son olcum tarihi ────────────────────────────────────
  const lastMeasurementEl = document.querySelector("#bsmReportLastMeasurement");
  if (lastMeasurementEl) {
    lastMeasurementEl.textContent = latestMeasurement?.date || "Ölçüm yok";
  }

  // ── Preview page: member name + date + metric values ──────────
  const pageMemberEl = document.querySelector("#bsmReportPageMember");
  if (pageMemberEl) {
    pageMemberEl.textContent = profile.memberName || "Üye seçilmedi";
  }

  const pageDateEl = document.querySelector("#bsmReportPageDate");
  if (pageDateEl) {
    pageDateEl.textContent = latestMeasurement?.date || "—";
  }

  // Preview metrics doldur
  const metricsHost = document.querySelector("#bsmReportPreviewMetrics");
  if (metricsHost && latestMeasurement) {
    const fmt = (v, unit) => {
      if (v === null || v === undefined || v === "") return "—";
      const n = Number(v);
      return Number.isFinite(n) ? `${n}${unit ? " " + unit : ""}` : String(v);
    };
    metricsHost.innerHTML = `
      <div class="bsm-report-page__metric"><small>Kilo</small><strong>${escapeHtml(fmt(latestMeasurement.weight, "kg"))}</strong></div>
      <div class="bsm-report-page__metric"><small>Yağ Oranı</small><strong>${escapeHtml(fmt(latestMeasurement.fat, "%"))}</strong></div>
      <div class="bsm-report-page__metric"><small>Kas Kütlesi</small><strong>${escapeHtml(fmt(latestMeasurement.muscleMass, "kg"))}</strong></div>
      <div class="bsm-report-page__metric"><small>BMI</small><strong>${escapeHtml(fmt(latestMeasurement.bmi))}</strong></div>
      <div class="bsm-report-page__metric"><small>Visceral Yağ</small><strong>${escapeHtml(fmt(latestMeasurement.visceralFat))}</strong></div>
      <div class="bsm-report-page__metric"><small>BMR</small><strong>${escapeHtml(fmt(latestMeasurement.bmr, "kcal"))}</strong></div>
    `;
  }

  // ── Toggle counter ────────────────────────────────────────────
  updateReportSectionCounter();
}

function updateReportSectionCounter() {
  const counterEl = document.querySelector("#bsmReportSectionCounter");
  const toggles = document.querySelectorAll('[data-report-toggle]');
  if (!counterEl || !toggles.length) return;
  let checked = 0;
  toggles.forEach((t) => {
    if (t.checked) {
      checked++;
      t.closest(".bsm-report-section")?.classList.remove("is-disabled");
    } else {
      t.closest(".bsm-report-section")?.classList.add("is-disabled");
    }
  });
  counterEl.textContent = `${checked}/${toggles.length} seçili`;
}

// v1.2.0: Report Center UI etkilesimleri (toggle counter + thumbnail switch).
// Premium Report Center artik measurement panel'in 'report' alt sekmesinin
// icinde render ediliyor — bu yuzden handler'lar #measurementsPanel'e baglandi.
function bindReportCenterHandlers() {
  const panel = document.querySelector("#measurementsPanel");
  if (!panel || panel.dataset.bsmReportBound === "true") return;
  panel.dataset.bsmReportBound = "true";

  // Toggle counter
  panel.addEventListener("change", (e) => {
    const t = e.target.closest("[data-report-toggle]");
    if (!t) return;
    updateReportSectionCounter();
  });

  // Thumbnail switch (visual only — gercek sayfa rendering scope disinda)
  panel.addEventListener("click", (e) => {
    const thumb = e.target.closest("[data-report-thumb]");
    if (!thumb) return;
    panel.querySelectorAll("[data-report-thumb]").forEach((t) => t.classList.remove("is-active"));
    thumb.classList.add("is-active");
    const num = thumb.dataset.reportThumb;
    const currentEl = document.querySelector("#bsmReportCurrentPage");
    if (currentEl) currentEl.textContent = num;
    const footerPage = document.querySelector(".bsm-report-page__footer-page");
    if (footerPage) footerPage.textContent = `Sayfa ${num} / 4`;
  });

  // Pager buttons
  const prev = panel.querySelector("#bsmReportPagePrev");
  const next = panel.querySelector("#bsmReportPageNext");
  const navigate = (delta) => {
    const thumbs = Array.from(panel.querySelectorAll("[data-report-thumb]"));
    const activeIdx = thumbs.findIndex((t) => t.classList.contains("is-active"));
    const newIdx = Math.max(0, Math.min(thumbs.length - 1, activeIdx + delta));
    thumbs[newIdx]?.click();
  };
  prev?.addEventListener("click", () => navigate(-1));
  next?.addEventListener("click", () => navigate(1));
}

function refreshNutritionPlanFromMeasurement(member) {
  if (!member || typeof buildNutritionPlan !== "function") {
    return;
  }

  const preferences = typeof collectSupplementPreferences === "function" ? collectSupplementPreferences(nutritionPanel) : {};
  const activeProgram = state.activeProgram || member.programs?.[0]?.program || null;
  state.activeNutritionPlan = normalizeNutritionPlan(buildNutritionPlan(member, activeProgram, preferences, { makeId }));
  state.activeNutritionMemberId = member.id;
}

function upsertMeasurementRecord(measurements, measurement) {
  const record = normalizeMeasurementPayload(measurement);
  const existingRecords = Array.isArray(measurements) ? measurements : [];
  return [
    record,
    ...existingRecords.filter((item) => String(item?.id || "") !== String(record.id || "")),
  ].slice(0, 40);
}

function mergeMeasurementIntoProfile(profile, measurement) {
  const nextProfile = { ...(profile || {}) };
  const bodyFatPercentage = firstFilledMeasurementValue(measurement.fat, measurement.bodyFatPercentage);
  const fieldMap = {
    weight: measurement.weight,
    height: measurement.height,
    age: measurement.age,
    birthDay: measurement.birthDay,
    birthMonth: measurement.birthMonth,
    birthYear: measurement.birthYear,
    birthDate: measurement.birthDate,
    bodyFatPercentage,
    fat: bodyFatPercentage,
    fatMass: measurement.fatMass,
    muscleMass: measurement.muscleMass,
    bodyWater: measurement.bodyWater,
    bmi: measurement.bmi,
    bmr: measurement.bmr,
    metabolicAge: measurement.metabolicAge,
    visceralFat: measurement.visceralFat,
    boneMass: measurement.boneMass,
    proteinPercent: measurement.proteinPercent,
    intracellularWater: measurement.intracellularWater,
    waist: measurement.waist,
    hip: measurement.hip,
    chest: measurement.chest,
    armCircumference: measurement.armCircumference,
    thighCircumference: measurement.thighCircumference,
    calfCircumference: measurement.calfCircumference,
  };

  Object.entries(fieldMap).forEach(([key, value]) => {
    if (isFilledMeasurementValue(value)) {
      nextProfile[key] = value;
    }
  });

  if (hasFilledMeasurementValues(measurement.segments)) {
    nextProfile.segments = { ...(measurement.segments || {}) };
  }

  if (hasFilledMeasurementValues(measurement.resistance)) {
    nextProfile.resistance = { ...(measurement.resistance || {}) };
  }

  return nextProfile;
}

function firstFilledMeasurementValue(...values) {
  return values.find(isFilledMeasurementValue) ?? "";
}

function isFilledMeasurementValue(value) {
  return value !== "" && value !== undefined && value !== null;
}

function hasFilledMeasurementValues(values) {
  return Object.values(values || {}).some(isFilledMeasurementValue);
}

function setInputValue(input, value) {
  if (!input || value === "" || value === undefined || value === null) {
    return;
  }

  input.value = String(value);
}

function dispatchMeasurementInputEvents() {
  [
    measurementDate,
    measurementWeight,
    measurementHeight,
    measurementBmi,
    measurementBirthDay,
    measurementBirthMonth,
    measurementBirthYear,
    measurementFat,
    measurementMuscleMass,
    measurementFatMass,
    measurementBodyWater,
    measurementVisceralFat,
    measurementBmr,
    measurementMetabolicAge,
    measurementBoneMass,
    ...getMeasurementExtraInputs(),
    ...Object.values(segmentInputs),
    ...Object.values(segmentResistanceInputs),
    measurementNote,
  ]
    .filter(Boolean)
    .forEach((input) => {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

function getMeasurementExtraInputs() {
  return Array.from(document.querySelectorAll("[data-measurement-extra='true']"));
}

function readBirthDateParts() {
  return {
    day: numberOrEmpty(measurementBirthDay?.value),
    month: numberOrEmpty(measurementBirthMonth?.value),
    year: numberOrEmpty(measurementBirthYear?.value),
  };
}

function formatBirthDateValue(parts) {
  if (!isCompleteBirthDate(parts)) {
    return "";
  }

  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatBirthDateDisplay(measurement) {
  if (measurement.birthDate) {
    const [year, month, day] = String(measurement.birthDate).split("-");
    if (year && month && day) {
      return `${day}.${month}.${year}`;
    }
  }

  if (measurement.birthDay && measurement.birthMonth && measurement.birthYear) {
    return `${String(measurement.birthDay).padStart(2, "0")}.${String(measurement.birthMonth).padStart(2, "0")}.${measurement.birthYear}`;
  }

  return "";
}

function calculateAgeFromBirthDate(parts, referenceDateValue) {
  if (!isCompleteBirthDate(parts)) {
    return "";
  }

  const birthDate = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const referenceDate = parseCalendarInputDate(referenceDateValue || getTodayInputValue());

  if (
    Number.isNaN(birthDate.getTime()) ||
    !referenceDate ||
    birthDate.getFullYear() !== Number(parts.year) ||
    birthDate.getMonth() !== Number(parts.month) - 1 ||
    birthDate.getDate() !== Number(parts.day)
  ) {
    return "";
  }

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    referenceDate.getMonth() > birthDate.getMonth() ||
    (referenceDate.getMonth() === birthDate.getMonth() && referenceDate.getDate() >= birthDate.getDate());

  if (!birthdayPassed) {
    age -= 1;
  }

  return age >= 0 && age <= 120 ? age : "";
}

function isCompleteBirthDate(parts) {
  return parts.day !== "" && parts.month !== "" && parts.year !== "";
}

function parseCalendarInputDate(value) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date;
    }

    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMeasurementLine(item) {
  const parts = [];

  if (item.weight !== "") {
    parts.push(`${item.weight} kg`);
  }

  if (item.height !== "" && item.height !== undefined) {
    parts.push(`${item.height} cm`);
  }

  const birthDateDisplay = formatBirthDateDisplay(item);

  if (birthDateDisplay) {
    parts.push(`Doğum ${birthDateDisplay}`);
  }

  if (item.age !== "" && item.age !== undefined) {
    parts.push(`${item.age} yaş`);
  }

  if (item.fat !== "") {
    parts.push(`%${item.fat} yağ`);
  }

  if (item.muscleMass !== "" && item.muscleMass !== undefined) {
    parts.push(`${item.muscleMass} kg kas`);
  }

  if (item.fatMass !== "" && item.fatMass !== undefined) {
    parts.push(`${item.fatMass} kg yağ`);
  }

  if (item.bodyWater !== "" && item.bodyWater !== undefined) {
    parts.push(`%${item.bodyWater} su`);
  }

  if (item.bmi !== "" && item.bmi !== undefined) {
    parts.push(`BMI ${item.bmi}`);
  }

  if (item.visceralFat !== "" && item.visceralFat !== undefined) {
    parts.push(`Visceral ${item.visceralFat}`);
  }

  if (item.bmr !== "" && item.bmr !== undefined) {
    parts.push(`${item.bmr} kcal BMR`);
  }

  if (item.metabolicAge !== "" && item.metabolicAge !== undefined) {
    parts.push(`Metabolizma yaşı ${item.metabolicAge}`);
  }

  if (item.boneMass !== "" && item.boneMass !== undefined) {
    parts.push(`${item.boneMass} kg kemik`);
  }

  if (item.waist !== "") {
    parts.push(`Bel ${item.waist} cm`);
  }

  if (item.hip !== "") {
    parts.push(`Kalça ${item.hip} cm`);
  }

  if (item.chest !== "") {
    parts.push(`Göğüs ${item.chest} cm`);
  }

  return parts.join(" • ") || "Not kaydı";
}

function formatSegmentLine(segments = {}) {
  const labels = {
    rightArmMuscle: "Sağ kol kas",
    leftArmMuscle: "Sol kol kas",
    trunkMuscle: "Gövde kas",
    rightLegMuscle: "Sağ bacak kas",
    leftLegMuscle: "Sol bacak kas",
    rightArmFat: "Sağ kol yağ",
    leftArmFat: "Sol kol yağ",
    trunkFat: "Gövde yağ",
    rightLegFat: "Sağ bacak yağ",
    leftLegFat: "Sol bacak yağ",
  };

  return Object.entries(labels)
    .filter(([key]) => segments[key] !== "" && segments[key] !== undefined)
    .map(([key, label]) => `${label}: ${segments[key]} kg`)
    .join(" • ");
}

function formatResistanceLine(resistance = {}) {
  const labels = {
    rightArmResistance: "Sağ kol direnç",
    leftArmResistance: "Sol kol direnç",
    trunkResistance: "Gövde direnç",
    rightLegResistance: "Sağ bacak direnç",
    leftLegResistance: "Sol bacak direnç",
  };

  return Object.entries(labels)
    .filter(([key]) => resistance[key] !== "" && resistance[key] !== undefined)
    .map(([key, label]) => `${label}: ${resistance[key]} ohm`)
    .join(" • ");
}

function findActiveMember() {
  const members = Array.isArray(state.members) ? state.members : normalizeMembersPayload(state.members);

  if (!Array.isArray(state.members)) {
    state.members = members;
  }

  return members.find((member) => member.id === state.activeMemberId) || null;
}

function syncActiveMemberState() {
  const activeMember = findActiveMember();
  state.activeMember = activeMember || null;
  state.latestMeasurement = activeMember?.measurements?.[0] || null;

  if (!state.pendingTanitaMeasurement || !isMeasurementForMember(state.pendingTanitaMeasurement, activeMember)) {
    state.activeMeasurementState = state.latestMeasurement;
    state.activeMeasurementSource = state.latestMeasurement ? "saved" : null;
  }

  return state.activeMember;
}

function loadMembers() {
  return loadStoredMembers();
}

function persistMembers() {
  state.members = persistStoredMembers(state.members, state.activeMemberId);
  syncActiveMemberState();
}

function updateActiveMemberProfile(profile) {
  const nextMembers = updateStoredActiveMemberProfile(state.members, state.activeMemberId, profile);

  if (!nextMembers) {
    return;
  }

  state.members = nextMembers;
  syncActiveMemberState();
  renderMemberWorkspace();
}

function renderLiveSummary(data) {
  if (!liveSummary) return;
  const summaryModel = buildLiveSummaryModelService(data, {
    resolveSplit,
    labelMaps,
    getDayLabel,
    getMuscleLabel,
    getProgramStyleSummaryLabel,
    getTrainingSystemLabel,
  });

  liveSummary.innerHTML = `
    <article class="summary-card">
      <strong>${escapeHtml(summaryModel.headerTitle)}</strong>
      <p>${escapeHtml(summaryModel.headerText)}</p>
      <div class="summary-chips">
        ${summaryModel.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
      </div>
    </article>
    <article class="summary-card">
      <strong>Uygun günler</strong>
      <p>${escapeHtml(summaryModel.daysText)}</p>
    </article>
    <article class="summary-card">
      <strong>Haftalık split</strong>
      <p>${escapeHtml(summaryModel.splitText)}</p>
    </article>
    <article class="summary-card">
      <strong>Öncelik ve uyarılar</strong>
      <p>${escapeHtml(summaryModel.priorityText)} • ${escapeHtml(summaryModel.restrictionText)}</p>
    </article>
  `;
}

function buildProgram(data) {
  data = attachLatestMeasurementContext(data);
  const split = resolveSplit(data);
  const planContext = window.BSMProgramEngineV2?.createPlanContext?.(data) || null;
  const aiReport = getAnalysisForProgramData(data);
  const sessions = data.days.map((day, index) =>
    buildSession({
      day,
      sessionBlueprint: split[index] || split[split.length - 1],
      sessionIndex: index,
      data,
      planContext,
    }),
  );

  const progression = buildProgression(data);
  const guidance = buildGuidance(data);
  const coverage = buildMuscleCoverage(sessions);
  const programIntelligence = window.BSMProgramEngineV2?.buildProgramIntelligence?.(data, sessions, aiReport) || buildFallbackProgramIntelligence(data, sessions, aiReport);
  const trainingReport = buildTrainingReportForProgram(data, sessions, programIntelligence, aiReport);
  const v3Insights = buildV3ProgramInsights(data, aiReport);
  const createdAtIso = planContext?.generatedAtIso || new Date().toISOString();

  return buildProgramDocumentService({
    schemaVersion,
    createdAtIso,
    title: buildProgramTitleService(data, {
      labelMaps,
    }),
    overview: buildProgramOverviewService(data, {
      labelMaps,
      splitNameMap,
      resolveEffectiveStyle,
      getProgramStyleLabel,
      getTrainingSystemLabel,
      getMuscleLabel,
    }),
    coachNote: describeProgram(data, split),
    sessions,
    progression,
    guidance,
    coverage,
    aiReport,
    programIntelligence,
    trainingReport,
    v3Insights,
    programContext: planContext,
    rawData: data,
  });
}

function buildTrainingReportForProgram(data, sessions, programIntelligence, aiReport) {
  return buildTrainingReportService?.(data, sessions, programIntelligence, aiReport, {
    labelMaps,
    getTrainingSystemLabel,
    getProgramStyleLabel,
  }) || null;
}

function attachLatestMeasurementContext(data) {
  const member = buildProgramMemberRecord(data);
  const latestMeasurement = member?.measurements?.[0] || null;

  if (!latestMeasurement) {
    return data;
  }

  return {
    ...data,
    latestMeasurement,
    measurementGuidance: buildMeasurementProgramGuidance(latestMeasurement),
  };
}

function buildMeasurementProgramGuidance(measurement) {
  const fat = Number(measurement?.fat);
  const visceralFat = Number(measurement?.visceralFat);
  const weight = Number(measurement?.weight);
  const muscleMass = Number(measurement?.muscleMass);
  const muscleRatio = weight && muscleMass ? (muscleMass / weight) * 100 : null;
  const armDiff = segmentDiffPercent(measurement?.segments?.rightArmMuscle, measurement?.segments?.leftArmMuscle);
  const legDiff = segmentDiffPercent(measurement?.segments?.rightLegMuscle, measurement?.segments?.leftLegMuscle);

  return {
    fatLossSupport: Number.isFinite(fat) && fat >= 30,
    visceralFatSupport: Number.isFinite(visceralFat) && visceralFat >= 13,
    strengthSupport: muscleRatio !== null && muscleRatio < 38,
    segmentalImbalance: Math.max(armDiff || 0, legDiff || 0) >= 10,
  };
}

function getAnalysisForProgramData(data) {
  return getMemberAnalysis(buildProgramMemberRecord(data));
}

function buildFallbackProgramIntelligence(data, sessions, analysis) {
  return buildFallbackProgramIntelligenceService(data, sessions, analysis);
}

function buildV3ProgramInsights(data, analysis) {
  const automationSummary = getAutomationSummary();

  return getV3MemberDossier(buildProgramMemberRecord(data), analysis, automationSummary.records || []);
}

function buildProgramMemberRecord(data) {
  const activeMember = findActiveMember();
  const activeMemberMatches = activeMember && matchesProgramMemberDataService(data, activeMember, { normalizeText });
  const matchedMember = activeMemberMatches ? activeMember : findMatchingMemberRecord(data);

  return buildProgramMemberRecordService(data, matchedMember, {
    normalizeText,
  });
}

function findMatchingMemberRecord(data) {
  return findMatchingMemberRecordService(data, state.members || [], {
    normalizeText,
  });
}

function resolveEffectiveStyle(data) {
  return resolveEffectiveStyleService(data, {
    resolveProgramStyleTemplate,
  });
}

function resolveSplit(data) {
  return resolveSplitService(data, {
    splitTemplates,
    resolveEffectiveStyle,
  });
}

function buildSession({ day, sessionBlueprint, sessionIndex, data, planContext = null }) {
  const exercises = selectExercisesForSession(data, sessionBlueprint, sessionIndex, planContext);
  const exerciseBlocks = buildExerciseBlocks(exercises, data);
  const warmup = buildWarmup(sessionBlueprint.groups, data);
  const cooldown = buildCooldown(sessionBlueprint.groups, data);
  const cardioBlock = buildCardioBlock(data, sessionBlueprint.groups);

  const session = buildSessionDraftService(
    {
      day,
      sessionBlueprint,
      sessionIndex,
      data,
      exercises,
      exerciseBlocks,
      warmup,
      cooldown,
      cardioBlock,
    },
    {
      getDayLabel,
      recommendStructure,
      normalizeTrainingSystem,
      buildSessionNote,
    },
  );

  return window.BSMProgramEngineV2?.enhanceSession?.(session, data, exerciseLibrary, planContext || undefined) || session;
}

function selectExercisesForSession(data, sessionBlueprint, sessionIndex, planContext = null) {
  return selectExercisesForSessionService(data, sessionBlueprint, sessionIndex, {
    planContext,
    selectExerciseForGroup,
    buildPrescription,
    buildRest,
    buildTempo,
  });
}

function buildExerciseBlocks(exercises, data) {
  return buildExerciseBlocksService(exercises, data, {
    trainingSystemMap,
    normalizeTrainingSystem,
  });
}

function getExerciseSlotCount(data) {
  return getExerciseSlotCountService(data);
}

function selectExerciseForGroup(group, data, usedExerciseIds, sessionIndex, pickCount, planContext = null) {
  return selectExerciseForGroupService(group, data, usedExerciseIds, sessionIndex, pickCount, {
    planContext,
    exerciseLibrary,
    allowedEquipmentByScope,
    rotateArray,
    pickExercise: (pool, nextData, meta) => window.BSMProgramEngineV2?.pickExercise?.(pool, nextData, meta),
  });
}

function isEquipmentAllowed(exercise, equipmentScope) {
  return isEquipmentAllowedService(exercise, equipmentScope, {
    allowedEquipmentByScope,
  });
}

function isExerciseAllowed(exercise, restrictions) {
  return isExerciseAllowedService(exercise, restrictions);
}

function buildPrescription(exercise, data, index) {
  return buildPrescriptionService(exercise, data, index);
}

function buildRest(exercise, data) {
  return buildRestService(exercise, data);
}

function buildTempo(exercise, data) {
  return buildTempoService(exercise, data);
}

function buildWarmup(groups, data) {
  return buildWarmupService(groups, data);
}

function buildCooldown(groups, data) {
  return buildCooldownService(groups, data);
}

function buildCardioBlock(data, groups) {
  return buildCardioBlockService(data, groups);
}

function recommendStructure(data, groups, exerciseCount) {
  return recommendStructureService(data, groups, exerciseCount, {
    getTrainingSystemLabel,
  });
}

function buildSessionNote(data, groups) {
  return buildSessionNoteService(data, groups);
}

function describeProgram(data, split) {
  return describeProgramService(data, split, {
    labelMaps,
    getMuscleLabel,
    getTrainingSystemLabel,
  });
}

function buildProgression(data) {
  return buildProgressionService(data);
}

function buildGuidance(data) {
  return buildGuidanceService(data, {
    trainingSystemMap,
    normalizeTrainingSystem,
  });
}

function buildMuscleCoverage(sessions) {
  return buildMuscleCoverageService(sessions, {
    getMuscleLabel,
  });
}

function renderProgram(program, options = {}) {
  const previousEditMode = state.programEditMode;
  const previousDefaultSnapshot = state.programDefaultSnapshot;
  const previousRecordId = state.activeProgram?.savedProgramRecordId;
  state.activeProgram = cloneData(normalizePlanPayload(program));
  normalizeEditableProgram(state.activeProgram);
  state.activeProgram.savedProgramRecordId = options.savedProgramRecordId || program?.savedProgramRecordId || previousRecordId || null;

  if (options.preserveEditState) {
    state.programEditMode = previousEditMode;
    state.programDefaultSnapshot = previousDefaultSnapshot || cloneData(state.activeProgram);
  } else {
    state.programEditMode = false;
    state.programDefaultSnapshot = cloneData(state.activeProgram);
  }

  const rawData = state.activeProgram.rawData || collectFormData();
  state.activeProgram.sessions = state.activeProgram.sessions || [];
  state.activeProgram.coverage = state.activeProgram.coverage || buildMuscleCoverage(state.activeProgram.sessions);
  state.activeProgram.progression = state.activeProgram.progression || buildProgression(rawData);
  state.activeProgram.guidance = state.activeProgram.guidance || buildGuidance(rawData);
  state.activeProgram.aiReport = state.activeProgram.aiReport || getAnalysisForProgramData(rawData);
  state.activeProgram.programIntelligence =
    state.activeProgram.programIntelligence ||
    (window.BSMProgramEngineV2?.buildProgramIntelligence?.(rawData, state.activeProgram.sessions || [], state.activeProgram.aiReport) ||
      buildFallbackProgramIntelligence(rawData, state.activeProgram.sessions || [], state.activeProgram.aiReport));
  const trainingReportData = rawData.latestMeasurement ? rawData : attachLatestMeasurementContext(rawData);
  state.activeProgram.trainingReport =
    state.activeProgram.trainingReport ||
    buildTrainingReportForProgram(trainingReportData, state.activeProgram.sessions || [], state.activeProgram.programIntelligence, state.activeProgram.aiReport);
  state.activeProgram.v3Insights = state.activeProgram.v3Insights || buildV3ProgramInsights(rawData, state.activeProgram.aiReport);
  saveLastPlan(state.activeProgram);
  resultsSection.classList.remove("hidden");
  resultsTitle.textContent = state.activeProgram.title;
  renderProgramCover(state.activeProgram);
  const weeklyPlanHtml = buildWeeklyPlanHtmlUi(
    { sessions: state.activeProgram.sessions || [], editMode: state.programEditMode },
    escapeHtml,
    {
      getMuscleLabel,
      getExerciseMedia,
      muscleGroups,
      equipmentLabels,
      exerciseLibrary,
      repetitionModelOptions,
      repetitionPresets,
    },
  );
  const programSectionsModel = buildProgramSectionsModelService(state.activeProgram, {
    getMuscleLabel,
    getDayLabel,
    labelMaps,
    weeklyPlanHtml,
  });
  renderProgramSectionsUi(
    {
      programOverview,
      coachNote,
      muscleCoverage,
      weeklyPlan,
      progressionPlan,
      guidanceBlock,
    },
    programSectionsModel,
    escapeHtml,
  );
  renderProgramEditToolbar();
  renderTrainingReportUi?.(trainingReportPanel, state.activeProgram.trainingReport, escapeHtml);
  renderOutputIntelligence(state.activeProgram);
  renderNutritionOutput();
  renderWorkflowAssistant();
}

function renderOutputIntelligence(program) {
  renderOutputIntelligenceUi(
    {
      aiReportSummary,
      nextControlReport,
      outputWarnings,
    },
    buildOutputIntelligenceModelService(program),
    escapeHtml,
  );
}

function renderNutritionWorkspace() {
  const activeMember = findActiveMember();
  const memberPlan = normalizeNutritionPlan(activeMember?.nutritionPlan || activeMember?.nutritionPlans?.[0]);

  if (activeMember?.id !== state.activeNutritionMemberId) {
    state.activeNutritionPlan = memberPlan;
    state.activeNutritionMemberId = activeMember?.id || null;
  } else if (!state.activeNutritionPlan && memberPlan) {
    state.activeNutritionPlan = memberPlan;
  }

  renderNutritionWorkspaceUi(
    {
      nutritionPanel,
      nutritionMemberSummary,
      nutritionPlanEditor,
    },
    {
      member: activeMember,
      plan: state.activeNutritionPlan || memberPlan,
      activeProgram: state.activeProgram || activeMember?.programs?.[0]?.program || null,
    },
    escapeHtml,
    {
      labelMaps,
    },
  );
}

function renderNutritionOutput() {
  const plan = getNutritionPlanForOutput();
  renderOutputNutritionPlanUi(outputNutritionPlan, plan, labelMaps, escapeHtml);
}

function getNutritionPlanForOutput() {
  const activeMember = findActiveMember();

  return (
    normalizeNutritionPlan(state.activeNutritionPlan) ||
    normalizeNutritionPlan(activeMember?.nutritionPlan || activeMember?.nutritionPlans?.[0]) ||
    null
  );
}

function getExerciseMedia(exercise) {
  return buildExerciseMedia?.(exercise, getMuscleLabel(exercise?.group)) || null;
}

function renderProgramEditToolbar() {
  if (!programEditToolbar) {
    return;
  }

  const hasProgram = Boolean(state.activeProgram);
  programEditToolbar.classList.toggle("is-hidden", !hasProgram);
  programEditToolbar.classList.toggle("is-editing", state.programEditMode);

  if (toggleProgramEditButton) {
    toggleProgramEditButton.textContent = state.programEditMode ? "Düzenlemeyi Kapat" : "Düzenle";
  }

  saveProgramEditsButton?.classList.toggle("is-hidden", !state.programEditMode);
  resetProgramEditsButton?.classList.toggle("is-hidden", !state.programEditMode);

  if (programEditStatus) {
    programEditStatus.textContent = state.programEditMode
      ? "Düzenleme modu açık. Değişiklikler ekranda anında güncellenir; kalıcı kayıt için Değişiklikleri Kaydet düğmesine basın."
      : "Düzenle modunda hareket, set, tekrar, dinlenme, tempo ve not alanlarını değiştirebilirsiniz.";
  }
}

function normalizeEditableProgram(program) {
  const rawData = program?.rawData || collectFormData();

  (program?.sessions || []).forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      normalizeExerciseRepetitionScheme(exercise, rawData);
    });
  });
}

function applyProgramExerciseEdit({ field, value, sessionIndex, exerciseIndex }) {
  const session = state.activeProgram?.sessions?.[sessionIndex];
  const exercise = session?.exercises?.[exerciseIndex];

  if (!exercise) {
    return { error: "Düzenlenecek hareket bulunamadı." };
  }

  if (field === "group") {
    const replacement = getFirstExerciseForGroup(value);
    applyExerciseReplacement(session, exerciseIndex, replacement || { ...exercise, group: value });
    return { rerender: true };
  }

  if (field === "exerciseId") {
    const replacement = exerciseLibrary.find((item) => item.id === value);

    if (!replacement) {
      return { error: "Seçilen hareket kütüphanede bulunamadı." };
    }

    applyExerciseReplacement(session, exerciseIndex, replacement);
    return { rerender: true };
  }

  if (field === "sets") {
    exercise.sets = normalizeEditableSet(value);
    normalizeExerciseRepetitionScheme(exercise, state.activeProgram.rawData || collectFormData(), { forcePresetForSet: true });
    state.activeProgram.coverage = buildMuscleCoverage(state.activeProgram.sessions);
    saveLastPlan(state.activeProgram);
    return { rerender: true };
  }

  if (field === "repModel") {
    exercise.repModel = normalizeRepModel(value);
    normalizeExerciseRepetitionScheme(exercise, state.activeProgram.rawData || collectFormData(), { forcePresetForModel: true });
    state.activeProgram.coverage = buildMuscleCoverage(state.activeProgram.sessions);
    saveLastPlan(state.activeProgram);
    return { rerender: true };
  }

  if (field === "repPresetId") {
    applyRepetitionPresetById(exercise, value, state.activeProgram.rawData || collectFormData());
    state.activeProgram.coverage = buildMuscleCoverage(state.activeProgram.sessions);
    saveLastPlan(state.activeProgram);
    return { rerender: true };
  }

  if (field === "reps") {
    exercise.reps = String(value || "").trim();
    exercise.repModel = "custom";
    exercise.repPresetId = "custom";
    syncExercisePrescriptionFields(exercise);
  } else if (["rest", "tempo", "cue", "name"].includes(field)) {
    exercise[field] = String(value || "").trim();
  }

  state.activeProgram.coverage = buildMuscleCoverage(state.activeProgram.sessions);
  saveLastPlan(state.activeProgram);
  return { rerender: false };
}

function applyExerciseReplacement(session, exerciseIndex, replacement) {
  const rawData = state.activeProgram.rawData || collectFormData();
  const nextExercise = {
    ...replacement,
    prescription: buildPrescription(replacement, rawData, exerciseIndex),
    rest: buildRest(replacement, rawData),
    tempo: buildTempo(replacement, rawData),
    alternatives:
      window.BSMProgramEngineV2?.buildAlternatives?.(replacement, exerciseLibrary, rawData, {
        context: state.activeProgram.programContext,
        sessionIndex: session.sessionIndex || 0,
        exerciseIndex,
      }) || [],
  };

  normalizeExerciseRepetitionScheme(nextExercise, rawData, { forcePresetForModel: true });
  syncExercisePrescriptionFields(nextExercise);
  session.exercises[exerciseIndex] = nextExercise;
  session.exerciseBlocks = buildExerciseBlocks(session.exercises, rawData);
  session.balanceNote =
    window.BSMProgramEngineV2?.enhanceSession?.(session, rawData, exerciseLibrary, state.activeProgram.programContext)?.balanceNote || session.balanceNote;
  state.activeProgram.coverage = buildMuscleCoverage(state.activeProgram.sessions);
  saveLastPlan(state.activeProgram);
}

function getFirstExerciseForGroup(group) {
  return exerciseLibrary
    .filter((exercise) => exercise.group === group)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))[0];
}

function syncExercisePrescriptionFields(exercise) {
  const parts = splitProgramPrescription(exercise.prescription);
  exercise.sets = normalizeEditableSet(exercise.sets || parts.sets);
  exercise.reps = String(exercise.reps || parts.reps || "").trim() || "8-12";
  exercise.repPattern = buildRepPatternFromText(exercise.reps, exercise.sets);
  exercise.repScheme = {
    model: normalizeRepModel(exercise.repModel),
    presetId: exercise.repPresetId || "custom",
    sets: Number(exercise.sets) || 1,
    reps: [...exercise.repPattern],
    label: exercise.repPattern.join(" • "),
  };
  exercise.prescription = `${exercise.sets} set x ${exercise.reps}`;
}

function shouldPreserveDurationPrescription(exercise = {}) {
  const kind = String(exercise.kind || "").toLowerCase();
  const group = String(exercise.group || "").toLowerCase();
  const prescriptionText = String(exercise.prescription || exercise.reps || "").toLowerCase();
  const durationLike = /\b(sn|dk|tur|interval|tempo|saniye|dakika)\b/.test(prescriptionText);

  return ["cardio", "conditioning", "mobility"].includes(kind) || group === "cardio" || (kind === "core" && durationLike);
}

function hasExerciseRepetitionScheme(exercise = {}) {
  return Boolean(
    exercise.repScheme ||
      exercise.repPresetId ||
      (Array.isArray(exercise.repPattern) && exercise.repPattern.length) ||
      exercise.repetitionTemplateApplied,
  );
}

function applyDefaultRepetitionTemplate(exercise, rawData = {}) {
  const template = rawData?.repetitionTemplate;

  if (!template || shouldPreserveDurationPrescription(exercise)) {
    return false;
  }

  const sets = normalizeEditableSet(template.sets || 3);
  const model = normalizeRepModel(template.model || "fixed");
  const patternSource = Array.isArray(template.repPattern) && template.repPattern.length ? template.repPattern.join(" • ") : template.reps || template.customPattern;
  const repPattern = buildRepPatternFromText(patternSource || defaultRepTextForSets(sets), sets);

  exercise.sets = sets;
  exercise.repModel = model;
  exercise.repPresetId = template.presetId || "custom";
  exercise.reps = repPattern.join(" • ");
  exercise.repPattern = [...repPattern];
  exercise.repScheme = {
    model,
    presetId: exercise.repPresetId,
    sets: Number(sets) || 1,
    reps: [...repPattern],
    label: repPattern.join(" • "),
  };
  exercise.prescription = `${sets} set x ${exercise.reps}`;
  exercise.repetitionTemplateApplied = true;

  if (template.rest) {
    exercise.rest = template.rest;
  }

  if (template.tempo) {
    exercise.tempo = template.tempo;
  }

  return true;
}

function normalizeExerciseRepetitionScheme(exercise, rawData = {}, options = {}) {
  if (!exercise) {
    return exercise;
  }

  if (
    !options.forcePresetForSet &&
    !options.forcePresetForModel &&
    !hasExerciseRepetitionScheme(exercise) &&
    applyDefaultRepetitionTemplate(exercise, rawData)
  ) {
    return exercise;
  }

  if (shouldPreserveDurationPrescription(exercise) && !hasExerciseRepetitionScheme(exercise)) {
    const originalPrescription = exercise.prescription;
    const parts = splitProgramPrescription(exercise.prescription);
    exercise.sets = normalizeEditableSet(exercise.sets || parts.sets || 1);
    exercise.repModel = "custom";
    exercise.repPresetId = "custom";
    exercise.reps = String(exercise.reps || parts.reps || exercise.prescription || "30 sn").trim();
    exercise.repPattern = buildRepPatternFromText(exercise.reps, exercise.sets);
    exercise.repScheme = {
      model: "custom",
      presetId: "custom",
      sets: Number(exercise.sets) || 1,
      reps: [...exercise.repPattern],
      label: exercise.repPattern.join(" • "),
    };
    exercise.prescription = originalPrescription || `${exercise.sets} set x ${exercise.reps}`;
    return exercise;
  }

  const parts = splitProgramPrescription(exercise.prescription);
  exercise.sets = normalizeEditableSet(exercise.sets || exercise.repScheme?.sets || parts.sets);
  exercise.repModel = normalizeRepModel(exercise.repModel || exercise.repScheme?.model || suggestRepModelForExercise(rawData, exercise));

  const currentPreset = repetitionPresets.find((preset) => preset.id === (exercise.repPresetId || exercise.repScheme?.presetId));
  const presetStillFits =
    currentPreset &&
    currentPreset.model === exercise.repModel &&
    Number(currentPreset.sets) === Number(exercise.sets) &&
    !options.forcePresetForSet &&
    !options.forcePresetForModel;
  const nextPreset =
    presetStillFits && exercise.repModel !== "custom"
      ? currentPreset
      : selectSuggestedRepetitionPreset(exercise, rawData);

  if (exercise.repModel === "custom" || !nextPreset) {
    exercise.repPresetId = exercise.repPresetId || "custom";
    exercise.reps = String(exercise.reps || parts.reps || defaultRepTextForSets(exercise.sets)).trim();
    syncExercisePrescriptionFields(exercise);
    return exercise;
  }

  applyRepetitionPreset(exercise, nextPreset);
  return exercise;
}

function applyRepetitionPresetById(exercise, presetId, rawData = {}) {
  if (presetId === "custom") {
    exercise.repModel = "custom";
    exercise.repPresetId = "custom";
    exercise.reps = String(exercise.reps || defaultRepTextForSets(exercise.sets)).trim();
    syncExercisePrescriptionFields(exercise);
    return;
  }

  const preset = repetitionPresets.find((item) => item.id === presetId) || selectSuggestedRepetitionPreset(exercise, rawData);

  if (preset) {
    applyRepetitionPreset(exercise, preset);
  } else {
    syncExercisePrescriptionFields(exercise);
  }
}

function applyRepetitionPreset(exercise, preset) {
  exercise.sets = normalizeEditableSet(preset.sets);
  exercise.repModel = normalizeRepModel(preset.model);
  exercise.repPresetId = preset.id;
  exercise.reps = preset.reps.join(" • ");
  exercise.repPattern = [...preset.reps];
  exercise.repScheme = {
    model: exercise.repModel,
    presetId: preset.id,
    sets: Number(exercise.sets) || preset.sets,
    reps: [...preset.reps],
    label: preset.label,
  };
  exercise.prescription = `${exercise.sets} set x ${exercise.reps}`;
}

function selectSuggestedRepetitionPreset(exercise, rawData = {}) {
  const model = normalizeRepModel(exercise.repModel || suggestRepModelForExercise(rawData, exercise));
  const sets = Number(normalizeEditableSet(exercise.sets)) || 3;

  if (model === "custom") {
    return null;
  }

  const candidates = repetitionPresets.filter((preset) => preset.model === model && Number(preset.sets) === sets);
  const goal = rawData.goal || "";
  const level = rawData.level || "";

  return (
    candidates.find((preset) => preset.tags?.includes(goal) && preset.tags?.includes(level)) ||
    candidates.find((preset) => preset.tags?.includes(goal)) ||
    candidates.find((preset) => preset.tags?.includes(level)) ||
    candidates[0] ||
    repetitionPresets.find((preset) => preset.model === model) ||
    repetitionPresets[0] ||
    null
  );
}

function suggestRepModelForExercise(rawData = {}, exercise = {}) {
  if (exercise.kind === "cardio" || exercise.group === "cardio") {
    return "endurance";
  }

  if (rawData.level === "beginner") {
    return rawData.goal === "strength" ? "strength" : "fixed";
  }

  if (rawData.level === "advanced") {
    if (rawData.goal === "strength") {
      return "strength";
    }

    return "advanced";
  }

  if (rawData.goal === "strength") {
    return exercise.kind === "compound" ? "strength" : "reverse-pyramid";
  }

  if (rawData.goal === "muscle-gain") {
    return exercise.kind === "compound" ? "pyramid" : "hypertrophy";
  }

  if (rawData.goal === "fat-loss" || rawData.goal === "conditioning") {
    return "endurance";
  }

  return "hypertrophy";
}

function normalizeRepModel(value) {
  const model = String(value || "").trim();
  return repetitionModelOptions.some((option) => option.value === model) ? model : "fixed";
}

function defaultRepTextForSets(sets) {
  const count = Number(normalizeEditableSet(sets)) || 3;
  return Array.from({ length: count }, () => "10-12").join(" • ");
}

function buildRepPatternFromText(value, sets) {
  const rawValue = String(value || "").trim();
  const setCount = Number(normalizeEditableSet(sets)) || 1;
  let pattern = rawValue
    .split(/[•,](?=\s*\d|\s*AMRAP|\s*\d+\s*sn)/i)
    .map((item) => item.trim())
    .filter(Boolean);

  if (pattern.length <= 1) {
    const dashPattern = rawValue
      .split(/\s*-\s*/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (dashPattern.length === setCount && dashPattern.length > 1) {
      pattern = dashPattern;
    }
  }

  if (pattern.length) {
    return pattern;
  }

  return Array.from({ length: setCount }, () => String(value || "10-12").trim());
}

function normalizeEditableSet(value) {
  const numericMatch = String(value || "").match(/\d+/);
  return numericMatch ? numericMatch[0] : "1";
}

function validateEditableProgram(program) {
  const errors = [];

  (program?.sessions || []).forEach((session, sessionIndex) => {
    (session.exercises || []).forEach((exercise, exerciseIndex) => {
      const label = `${session.dayLabel || `Gün ${sessionIndex + 1}`} / ${exerciseIndex + 1}. hareket`;
      const sets = Number(exercise.sets || splitProgramPrescription(exercise.prescription).sets);

      if (!String(exercise.name || "").trim()) {
        errors.push(`${label}: Hareket adı boş olamaz.`);
      }

      if (!Number.isInteger(sets) || sets < 1 || sets > 8) {
        errors.push(`${label}: Set değeri 1 ile 8 arasında olmalı.`);
      }

      if (!String(exercise.reps || splitProgramPrescription(exercise.prescription).reps || "").trim()) {
        errors.push(`${label}: Tekrar alanı boş olamaz.`);
      }
    });
  });

  return errors[0] || "";
}

function renderProgramCover(program) {
  renderProgramCoverUi(
    {
      coverBrand,
      coverMember,
      coverMeta,
      coverTrainer,
    },
    buildProgramCoverModelService(program, {
      labelMaps,
    }),
  );
}

function getCurrentProgramFromEditor() {
  if (!state.activeProgram) {
    return null;
  }

  weeklyPlan.querySelectorAll("[data-program-field]").forEach((field) => {
    const programField = field.dataset.programField;

    if (programField === "exerciseId" || programField === "group" || programField === "repModel" || programField === "repPresetId") {
      return;
    }

    const sessionIndex = Number(field.dataset.sessionIndex);
    const exerciseIndex = Number(field.dataset.exerciseIndex);
    const exercise = state.activeProgram.sessions?.[sessionIndex]?.exercises?.[exerciseIndex];

    if (exercise) {
      exercise[programField] = String(field.value || "").trim();

      if (programField === "sets" || programField === "reps") {
        if (programField === "reps") {
          exercise.repModel = "custom";
          exercise.repPresetId = "custom";
        }
        syncExercisePrescriptionFields(exercise);
      }
    }
  });

  state.activeProgram.coverage = buildMuscleCoverage(state.activeProgram.sessions);
  saveLastPlan(state.activeProgram);
  return cloneData(normalizePlanPayload(state.activeProgram));
}

function renderLibrary() {
  const searchText = normalizeText(exerciseSearch.value);
  const groupFilter = libraryGroupFilter.value;
  const equipmentFilter = libraryEquipmentFilter.value;
  const letterFilter = state.activeAlphabetLetter;

  const filtered = exerciseLibrary
    .filter((exercise) => {
      const matchesSearch =
        !searchText ||
        normalizeText(exercise.name).includes(searchText) ||
        normalizeText(getMuscleLabel(exercise.group)).includes(searchText) ||
        normalizeText(equipmentLabels[exercise.equipment]).includes(searchText) ||
        normalizeText(labelExerciseKind(exercise.kind)).includes(searchText) ||
        normalizeText(labelExerciseLevel(exercise.level)).includes(searchText) ||
        normalizeText(exercise.cue).includes(searchText);
      const matchesGroup = groupFilter === "all" || exercise.group === groupFilter;
      const matchesEquipment = equipmentFilter === "all" || exercise.equipment === equipmentFilter;
      const matchesLetter = letterFilter === "all" || getFirstLetter(exercise.name) === letterFilter;

      return matchesSearch && matchesGroup && matchesEquipment && matchesLetter;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  renderCustomExerciseList();

  const groups = muscleGroups
    .map((group) => {
      const exercises = filtered.filter((exercise) => exercise.group === group.id).sort((a, b) => a.name.localeCompare(b.name, "tr"));

      if (!exercises.length) {
        return null;
      }

      return {
        id: group.id,
        label: group.label,
        description: group.description,
        exerciseCount: exercises.length,
        exercises: exercises.map((exercise) => ({
          name: exercise.name,
          id: exercise.id,
          isCustom: Boolean(exercise.isCustom),
          media: getExerciseMedia(exercise),
          equipmentLabel: equipmentLabels[exercise.equipment] || exercise.equipment || "Ekipman",
          kindLabel: labelExerciseKind(exercise.kind),
          levelLabel: labelExerciseLevel(exercise.level),
          cue: exercise.cue,
        })),
      };
    })
    .filter(Boolean);

  syncLibraryTabsUi(
    {
      muscleGroupTabs,
      alphabetTabs,
    },
    {
      activeGroup: groupFilter,
      activeLetter: letterFilter,
    },
  );
  renderLibraryResultsUi(
    {
      exerciseLibraryEl,
      libraryCount,
    },
    {
      filteredCount: filtered.length,
      groups,
    },
    escapeHtml,
  );
}

function renderCustomExerciseList() {
  if (!customExerciseList) {
    return;
  }

  const customItemsHtml = state.customExercises
    .map(
      (exercise) => `
        <div class="custom-exercise-item">
          <div>
            <strong>${escapeHtml(exercise.name)}</strong>
            <span>${escapeHtml(getMuscleLabel(exercise.group))} • ${escapeHtml(equipmentLabels[exercise.equipment] || exercise.equipment)}</span>
          </div>
          <button
            type="button"
            class="library-exercise__action"
            data-exercise-library-action="remove-custom"
            data-exercise-id="${escapeHtml(exercise.id)}"
          >Sil</button>
        </div>
      `,
    )
    .join("");

  const hiddenInfo = state.hiddenExerciseIds.length
    ? `<p class="custom-exercise-list__hint">${state.hiddenExerciseIds.length} hazır hareket gizlendi. İstersen "Gizlenenleri Geri Getir" ile tamamını açabilirsin.</p>`
    : "";

  customExerciseList.innerHTML =
    customItemsHtml || hiddenInfo
      ? `${customItemsHtml}${hiddenInfo}`
      : `<p class="custom-exercise-list__hint">Henüz özel hareket eklenmedi. Eklediğin hareketler burada listelenecek.</p>`;
}

function getFirstLetter(value) {
  const first = String(value || "").trim().charAt(0).toLocaleUpperCase("tr-TR");
  return turkishAlphabet.includes(first) ? first : first.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function convertProgramToText(program) {
  return convertMemberProgramToSimpleText(program);

  const overviewText = program.overview.map(([label, value]) => `${label}: ${value}`).join("\n");
  const analysis = program.aiReport || {};
  const intelligence = program.programIntelligence || {};
  const v3Insights = program.v3Insights || {};
  const warningText = [
    ...(analysis.warnings || []).map((warning) => warning.message || warning.title),
    ...(intelligence.warnings || []),
  ]
    .filter(Boolean)
    .map((warning) => `- ${warning}`)
    .join("\n");
  const aiText = [
    `Genel skor: ${analysis.score ?? 0}/100`,
    `Hedef uyumu: ${analysis.goalFitScore ?? 0}/100`,
    `Risk seviyesi: ${analysis.riskLevel || "Belirsiz"}`,
    `AI analiz özeti: ${analysis.summary || "Analiz için ölçüm bekleniyor."}`,
    `Koç notu: ${intelligence.coachNote || analysis.nextAction || "Program düzenli takip edilmeli."}`,
    `Sonraki kontrol: ${intelligence.nextControlSuggestion || "10-14 gün içinde kontrol önerilir."}`,
    `V3 hazırlık skoru: ${v3Insights.readinessScore ?? 0}/100`,
    `V3 revizyon planı: ${(v3Insights.revisionPlan?.recommendedActions || []).join(" / ") || "Bir sonraki ölçümle netleşir."}`,
    warningText ? `Uyarılar:\n${warningText}` : "Uyarılar: Kritik uyarı yok.",
  ].join("\n");
  const coverageText = program.coverage
    .map((item) => `- ${getMuscleLabel(item.group)}: ${item.sessionCount} seans, ${item.exerciseCount} hareket`)
    .join("\n");
  const sessionText = program.sessions
    .map((session) => {
      const exercises = formatSessionExercisesForText(session);

      return `${session.dayLabel} - ${session.title}
Kas grupları: ${session.targetGroups.map(getMuscleLabel).join(", ")}
Yoğunluk: ${session.intensity}
Süre: ${session.duration}
Amaç: ${session.purpose || "Dengeli kuvvet ve teknik kalite"}
Akış: ${session.structure}
Denge notu: ${session.balanceNote || "Ana hareket, destek ve mobilite dengesi korunur."}
Isınma: ${session.warmup.join(" / ")}
${exercises}
Kardiyo / Bitiriş: ${session.cardioBlock}
Soğuma: ${session.cooldown.join(" / ")}
Not: ${session.note}`;
    })
    .join("\n\n");

  const progressionText = program.progression.map((step) => `- ${step.title}: ${step.text}`).join("\n");
  const guidanceText = program.guidance.map((item) => `- ${item.title}: ${item.text}`).join("\n");

  return `${program.title}
Oluşturulma zamanı: ${program.createdAt}

ÜYE PROGRAM KARTI
${overviewText}

ANTRENÖR NOTU
${program.coachNote}

AI ANALİZ VE KOÇ RAPORU
${aiText}

KAS GRUBU KAPSAMI
${coverageText}

HAFTALIK PROGRAM
${sessionText}

4 HAFTALIK TAKİP
${progressionText}

UYGULAMA KURALLARI
${guidanceText}`;
}

function formatSessionExercisesForText(session) {
  const formatExercise = (exercise) => {
    const alternatives = exercise.alternatives?.length
      ? ` | Alternatifler: ${exercise.alternatives.map((alternative) => alternative.name).join(", ")}`
      : "";

    const prescription = getProgramExercisePrescriptionParts(exercise);
    return `- ${exercise.name} | ${getMuscleLabel(exercise.group)} | Set: ${prescription.sets} | Tekrar: ${prescription.reps} | Dinlenme: ${exercise.rest} | Tempo: ${exercise.tempo} | ${exercise.cue}${alternatives}`;
  };

  if (!session.exerciseBlocks?.length) {
    return session.exercises.map(formatExercise).join("\n");
  }

  return session.exerciseBlocks
    .map((block) => {
      const blockExercises = block.exerciseIndexes
        .map((exerciseIndex) => session.exercises[exerciseIndex])
        .filter(Boolean)
        .map(formatExercise)
        .join("\n");

      return `${block.label} | ${block.instruction} | Dinlenme: ${block.rest}\n${blockExercises}`;
    })
    .join("\n\n");
}

function convertMemberProgramToSimpleText(program) {
  const rawData = program.rawData || {};
  const overview = [
    ["Üye adı", rawData.memberName || findProgramOverviewValue(program, "Üye") || "Belirtilmedi"],
    ["Hedef", labelMaps.goal[rawData.goal] || findProgramOverviewValue(program, "Hedef") || "Belirtilmedi"],
    ["Seviye", labelMaps.level[rawData.level] || findProgramOverviewValue(program, "Seviye") || "Belirtilmedi"],
    ["Haftalık antrenman günleri", Array.isArray(rawData.days) && rawData.days.length ? rawData.days.map(getDayLabel).join(", ") : "Belirtilmedi"],
  ]
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const sessionText = (program.sessions || []).map(formatSimpleSessionForText).join("\n\n");

  return `${program.title}
Oluşturulma zamanı: ${program.createdAt}

ÜYE PROGRAM ÖZETİ
${overview}

HAFTALIK ANTRENMAN PLANI
${sessionText}

BESLENME BİLGİSİ
${trainingNutritionNotice || "Beslenme planı uygulama içindeki Beslenme sekmesinde sunulmaktadır."}`;
}

function formatSimpleSessionForText(session) {
  const exercises = (session.exercises || []).map(formatSimpleExerciseForText).join("\n");

  return `${session.dayLabel} - ${session.title}
Amaç: ${limitTextToOneSentence(session.purpose || session.note || "Kontrollü teknik ve düzenli tempo ile uygulanır.")}
${exercises}
Isınma: ${limitTextToOneSentence((session.warmup || []).join(" / "))}
Kardiyo / Bitiriş: ${limitTextToOneSentence(session.cardioBlock || "")}
Soğuma: ${limitTextToOneSentence((session.cooldown || []).join(" / "))}`;
}

function formatSimpleExerciseForText(exercise) {
  const prescription = getProgramExercisePrescriptionParts(exercise);
  return `- ${exercise.name} | Set: ${prescription.sets} | Tekrar: ${prescription.reps} | Dinlenme: ${exercise.rest || "-"} | Not: ${limitTextToOneSentence(exercise.cue || "Kontrollü formda uygula.")}`;
}

function getProgramExercisePrescriptionParts(exercise) {
  const split = splitProgramPrescription(exercise?.prescription);

  return {
    sets: exercise?.sets || split.sets,
    reps: exercise?.reps || split.reps,
  };
}

function splitProgramPrescription(value) {
  const text = String(value || "").trim();
  const setMatch = text.match(/^(.+?)\s*set\s*x\s*(.+)$/i);
  const roundMatch = text.match(/^(.+?)\s*tur\s*x\s*(.+)$/i);

  if (setMatch) {
    return {
      sets: setMatch[1].trim(),
      reps: cleanProgramRepetition(setMatch[2]),
    };
  }

  if (roundMatch) {
    return {
      sets: `${roundMatch[1].trim()} tur`,
      reps: cleanProgramRepetition(roundMatch[2]),
    };
  }

  return {
    sets: "-",
    reps: text || "-",
  };
}

function cleanProgramRepetition(value) {
  return String(value || "").replace(/\s*tekrar\s*$/i, "").trim() || "-";
}

function limitTextToOneSentence(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "";
  }

  const sentenceMatch = text.match(/^.*?[.!?](?:\s|$)/);
  const sentence = sentenceMatch ? sentenceMatch[0].trim() : text;

  return sentence.length > 130 ? `${sentence.slice(0, 127).trim()}...` : sentence;
}

function findProgramOverviewValue(program, targetLabel) {
  const match = (program.overview || []).find(([label]) => label === targetLabel);
  return match?.[1] || "";
}

function normalizeMemberSort(value) {
  const allowedValues = ["recent-update", "name-asc", "code-asc", "programs-desc", "measurements-desc"];
  return allowedValues.includes(value) ? value : "recent-update";
}

function sortMembersForList(members, sortKey) {
  const sorted = [...members];
  const normalizedSort = normalizeMemberSort(sortKey);

  if (normalizedSort === "name-asc") {
    return sorted.sort((a, b) => normalizeText(a.profile?.memberName).localeCompare(normalizeText(b.profile?.memberName), "tr"));
  }

  if (normalizedSort === "code-asc") {
    return sorted.sort((a, b) => normalizeText(a.profile?.memberCode).localeCompare(normalizeText(b.profile?.memberCode), "tr"));
  }

  if (normalizedSort === "programs-desc") {
    return sorted.sort((a, b) => (b.programs?.length || 0) - (a.programs?.length || 0) || byRecentUpdate(a, b));
  }

  if (normalizedSort === "measurements-desc") {
    return sorted.sort((a, b) => (b.measurements?.length || 0) - (a.measurements?.length || 0) || byRecentUpdate(a, b));
  }

  return sorted.sort(byRecentUpdate);
}

function byRecentUpdate(a, b) {
  return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""), "tr");
}

function renderBackupMeta() {
  if (!backupMeta) {
    return;
  }

  const latestSnapshot = loadBackupHistory()[0];
  const backupText = latestSnapshot
    ? `Son oto yedek: ${formatDashboardDate(latestSnapshot.savedAt)} (${latestSnapshot.memberCount || 0} üye)`
    : "Oto yedek bekleniyor";
  renderBackupMetaUi(backupMeta, backupText);

  const settingsBackupMetaEl = document.querySelector("#settingsBackupMeta");
  if (settingsBackupMetaEl) settingsBackupMetaEl.textContent = backupText;

  const settingsAutoBackupStatusEl = document.querySelector("#settingsAutoBackupStatus");
  if (settingsAutoBackupStatusEl) settingsAutoBackupStatusEl.textContent = backupText;

  const settingsSupabaseStatusEl = document.querySelector("#settingsSupabaseStatus");
  if (settingsSupabaseStatusEl && dashboardSupabaseStatus) {
    settingsSupabaseStatusEl.textContent = String(dashboardSupabaseStatus.textContent || "Kontrol ediliyor").replace(/^Supabase:\s*/i, "");
  }
}

function showStatus(message, state) {
  formStatus.textContent = message;
  formStatus.dataset.state = state;
}

// F5e: Smoke test / dev-debug hook (production'da harmless — sadece okuma erişimi).
// İçeride çalışan kodun davranışını değiştirmez; sadece testler ve devtools için.
if (typeof window !== "undefined") {
  window.__bsm = Object.freeze({
    get state() { return state; },
    get photoState() { return Object.assign({}, _bsmPhotoState); },
    findActiveMember,
    openPhotoModal,
    closePhotoModal,
    handlePhotoFile,
    setMemberPhoto,
    setMemberPhotoRemove,
    processImageFile,
    getMemberAccent,
    // F5f webcam hooks
    startWebcamStream,
    captureWebcamFrame,
    retakeWebcamCapture,
    confirmWebcamCapture,
    stopWebcamStream,
    isMediaDevicesSupported,
  });
}
