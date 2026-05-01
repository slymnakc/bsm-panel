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

console.log("APP VERSION: v1.0.12");
console.log("UI VERSION: redesign-v1");
console.log("TANITA REPORT VERSION: ultra-pro-v2");

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
  activeScreen: "dashboard",
  activeWorkspaceView: "members",
  activeMemberSort: "recent-update",
  pendingTanitaMeasurement: null,
  programEditMode: false,
  programDefaultSnapshot: null,
  activeNutritionPlan: null,
  activeNutritionMemberId: null,
  customExercises: [],
  hiddenExerciseIds: [],
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
} = window.BSMOutputUI;
const {
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

const form = document.querySelector("#plannerForm");
const formStatus = document.querySelector("#formStatus");
const liveSummary = document.querySelector("#liveSummary");
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
const coverBrand = document.querySelector("#coverBrand");
const coverMember = document.querySelector("#coverMember");
const coverMeta = document.querySelector("#coverMeta");
const coverTrainer = document.querySelector("#coverTrainer");
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
  applyMeasurementToAppState,
  triggerMeasurementRecalculation,
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

initialize();

function initialize() {
  populateStaticFilters();
  populateProgramStyleOptions();
  initializeStateFromStorage();
  prepareOutputLayout();
  syncStartupUi();
  bindApplicationHandlers();
  hydrateInitialSession();
  setActiveScreen(inferScreenFromHash(window.location.hash), { silent: true });
  syncMembersFromSupabase();
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
}

function persistHiddenExerciseIds() {
  saveToStorage(storageKeys.hiddenExerciseIds, state.hiddenExerciseIds);
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

  tanitaPreview.innerHTML = `
    <h5>${escapeHtml(model.title || "Tanita ölçüm önizlemesi")}</h5>
    <div class="tanita-preview-grid">${metricsHtml}</div>
    <p class="tanita-preview__summary">${escapeHtml(model.segmentSummary || "")}</p>
  `;
}

function handleBuildMeasurementReport() {
  renderMeasurementReport();
  setActiveScreen("measurement-report", { silent: true });
  measurementReportSection?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleMeasurementReportBack() {
  setActiveScreen("builder", { silent: true });
  setWorkspaceView("measurements");
}

function handlePrintMeasurementReport() {
  renderMeasurementReport();
  setActiveScreen("measurement-report", { silent: true });
  window.setTimeout(() => window.print(), 50);
}

function renderMeasurementReport() {
  if (!measurementReportContent) {
    return;
  }

  const reportModel = buildMeasurementReportModel();

  if (!reportModel?.measurement) {
    measurementReportContent.innerHTML = `
      <article class="measurement-report-empty">
        <strong>Bu üye için ölçüm kaydı bulunamadı.</strong>
        <span>Önce ölçüm girin veya Tanita CSV yükleyip ölçümü üyeye kaydedin.</span>
      </article>
    `;
    return;
  }

  measurementReportContent.innerHTML = buildMeasurementReportHtml(reportModel);
}

function buildMeasurementReportModel() {
  const member = findActiveMember();
  const activeMeasurement = getLatestMeasurementForReport(member);

  if (!activeMeasurement) {
    return { member, measurement: null };
  }

  const measurement = normalizeMeasurementPayload(activeMeasurement);
  const profile = member?.profile || collectFormData();
  const previousMeasurements = getPreviousMeasurementsForReport(member, measurement);
  const bodyValues = buildBodyCompositionValues(measurement);
  const segmentalValues = buildSegmentalReportValues(measurement);
  const impedanceValues = buildImpedanceReportValues(measurement);
  const indicators = buildHealthIndicatorValues(measurement);
  const scoreBreakdown = buildUltraProScoreBreakdown(measurement);
  const summary = buildMeasurementExecutiveSummary(measurement, indicators, previousMeasurements);
  const scoreCards = buildMeasurementScoreCards(measurement, scoreBreakdown);
  const segmentalAnalysis = buildSegmentalAnalysisModel(measurement, segmentalValues);
  const targetDistance = buildTargetDistanceModel(measurement);
  const trends = buildTrendReportValues(measurement, previousMeasurements);
  const interpretation = buildMeasurementCoachInterpretation(measurement, previousMeasurements);
  const coachPlan = buildMeasurementCoachPlan(measurement, previousMeasurements, segmentalAnalysis);
  const nextGoals = buildNextMeasurementGoals(measurement, targetDistance, segmentalAnalysis);
  summary.score = scoreBreakdown.overall.score;
  summary.status = scoreBreakdown.overall.status;
  summary.riskLevel = scoreBreakdown.overall.statusLabel;

  return {
    member,
    profile,
    measurement,
    previousMeasurements,
    summary,
    scoreBreakdown,
    scoreCards,
    bodyValues,
    segmentalValues,
    segmentalAnalysis,
    targetDistance,
    impedanceValues,
    indicators,
    trends,
    interpretation,
    coachPlan,
    nextGoals,
  };
}

function getLatestMeasurementForReport(member) {
  const formMeasurement = readMeasurementForm();
  const latestMemberMeasurement = member?.measurements?.[0] || null;

  return latestMemberMeasurement || state.latestMeasurement || state.pendingTanitaMeasurement || formMeasurement || null;
}

function getPreviousMeasurementsForReport(member, measurement) {
  return (member?.measurements || [])
    .filter((item) => String(item?.id || "") !== String(measurement?.id || ""))
    .slice(0, 6)
    .map(normalizeMeasurementPayload);
}

function buildBodyCompositionValues(measurement) {
  const weight = measurementValue(measurement.weight);
  const fatPercent = measurementValue(measurement.fat);
  const fatMass = measurementValue(measurement.fatMass);
  const bodyWaterKg = calculateBodyWaterKg(measurement);
  const fatFreeMass = measurementValue(measurement.fatFreeMass) || (weight && fatMass ? roundReportNumber(weight - fatMass) : "");
  const muscleMass = measurementValue(measurement.muscleMass);
  const boneMass = measurementValue(measurement.boneMass);
  const maxValue = Math.max(weight || 0, fatFreeMass || 0, muscleMass || 0, bodyWaterKg || 0, fatMass || 0, boneMass || 0, 1);
  const idealWeightRange = calculateIdealWeightRange(measurement.height);
  const waterStatus = measurementValue(measurement.bodyWater) === "" ? { status: "neutral", statusLabel: "Veri yok" } : evaluateBodyWater(measurementValue(measurement.bodyWater));
  const fatStatus = measurementValue(measurement.fat) === "" ? { status: "neutral", statusLabel: "Veri yok" } : evaluateBodyFat(measurementValue(measurement.fat), measurement.gender);
  const muscleStatus = evaluateMuscleMass(muscleMass, weight);

  return [
    {
      label: "Kilo",
      value: weight,
      unit: "kg",
      color: "blue",
      percent: reportPercent(weight, maxValue),
      ...resolveWeightStatus(weight, measurement.height),
      reference: idealWeightRange ? `${formatReportValue(idealWeightRange.min, "kg")} - ${formatReportValue(idealWeightRange.max, "kg")}` : "Boy bilgisiyle hesaplanır",
      normalStart: idealWeightRange ? reportPercent(idealWeightRange.min, maxValue) : 28,
      normalEnd: idealWeightRange ? reportPercent(idealWeightRange.max, maxValue) : 62,
      explanation: "BMI ve ideal kilo aralığıyla birlikte okunur; tek başına performans göstergesi değildir.",
    },
    {
      label: "Yağ kütlesi",
      value: fatMass,
      unit: "kg",
      color: "orange",
      percent: reportPercent(fatMass, maxValue),
      ...fatStatus,
      reference: "Yağ oranı ve hedefe göre takip",
      normalStart: 8,
      normalEnd: 32,
      explanation: "Toplam yağ ağırlığını gösterir; hedefe göre kontrollü azaltım veya koruma planlanır.",
    },
    {
      label: "Yağ %",
      value: fatPercent,
      unit: "%",
      color: "orange",
      percent: reportPercent(fatPercent, 60),
      ...fatStatus,
      reference: "Cinsiyet ve hedefe göre yorumlanır",
      normalStart: 26,
      normalEnd: 52,
      explanation: "Vücut kompozisyon hedefini belirleyen ana ölçümdür.",
    },
    {
      label: "Sıvı kg",
      value: bodyWaterKg,
      unit: "kg",
      color: "cyan",
      percent: reportPercent(bodyWaterKg, maxValue),
      ...waterStatus,
      reference: "%50 - %65 ideal takip aralığı",
      normalStart: 32,
      normalEnd: 58,
      explanation: "Hidrasyon ve yağsız kütle kalitesi için destekleyici göstergedir.",
    },
    {
      label: "Yağsız kütle",
      value: fatFreeMass,
      unit: "kg",
      color: "green",
      percent: reportPercent(fatFreeMass, maxValue),
      status: "normal",
      statusLabel: "Takip",
      reference: "Kas, su ve mineral toplamı",
      normalStart: 52,
      normalEnd: 84,
      explanation: "Kas, su ve mineral toplamı olduğu için kas koruma hedefiyle birlikte takip edilir.",
    },
    {
      label: "Kas kütlesi",
      value: muscleMass,
      unit: "kg",
      color: "teal",
      percent: reportPercent(muscleMass, maxValue),
      ...muscleStatus,
      reference: "Kilo oranına göre değerlendirilir",
      normalStart: 45,
      normalEnd: 78,
      explanation: "Direnç antrenmanı ve protein hedefi için ana takip değerlerinden biridir.",
    },
    {
      label: "Kemik kütlesi",
      value: boneMass,
      unit: "kg",
      color: "gray",
      percent: reportPercent(boneMass, maxValue),
      status: "neutral",
      statusLabel: "Referans",
      reference: "Cihaz ölçümü, trend olarak izlenir",
      normalStart: 6,
      normalEnd: 18,
      explanation: "Tek ölçümden çok ölçüm trendi olarak izlenmesi daha güvenilirdir.",
    },
  ];
}

function buildSegmentalReportValues(measurement) {
  const segments = measurement.segments || {};
  return [
    { label: "Sağ kol kas", value: segments.rightArmMuscle, unit: "kg", type: "muscle" },
    { label: "Sol kol kas", value: segments.leftArmMuscle, unit: "kg", type: "muscle" },
    { label: "Gövde kas", value: segments.trunkMuscle, unit: "kg", type: "muscle" },
    { label: "Sağ bacak kas", value: segments.rightLegMuscle, unit: "kg", type: "muscle" },
    { label: "Sol bacak kas", value: segments.leftLegMuscle, unit: "kg", type: "muscle" },
    { label: "Sağ kol yağ", value: segments.rightArmFat, unit: "kg", type: "fat" },
    { label: "Sol kol yağ", value: segments.leftArmFat, unit: "kg", type: "fat" },
    { label: "Gövde yağ", value: segments.trunkFat, unit: "kg", type: "fat" },
    { label: "Sağ bacak yağ", value: segments.rightLegFat, unit: "kg", type: "fat" },
    { label: "Sol bacak yağ", value: segments.leftLegFat, unit: "kg", type: "fat" },
  ];
}

function buildImpedanceReportValues(measurement) {
  const resistance = measurement.resistance || {};
  return [
    ["Sağ kol direnç", resistance.rightArmResistance],
    ["Sol kol direnç", resistance.leftArmResistance],
    ["Gövde direnç", resistance.trunkResistance],
    ["Sağ bacak direnç", resistance.rightLegResistance],
    ["Sol bacak direnç", resistance.leftLegResistance],
  ];
}

function buildHealthIndicatorValues(measurement) {
  const whr = calculateWhr(measurement);
  return [
    buildIndicator(
      "BMI",
      measurement.bmi,
      "",
      evaluateBmi,
      "Boy-kilo oranını hızlı takip etmek için kullanılır.",
      "Tek başına karar verdirmez; yağ ve kas verileriyle birlikte değerlendirilmelidir.",
    ),
    buildIndicator(
      "Yağ oranı",
      measurement.fat,
      "%",
      (value) => evaluateBodyFat(value, measurement.gender),
      "Vücut kompozisyonunun ana risk ve hedef belirleme göstergesidir.",
      "Hedefe göre direnç antrenmanı korunmalı, kardiyo ve beslenme kontrollü planlanmalıdır.",
    ),
    buildIndicator(
      "Visceral yağ",
      measurement.visceralFat,
      "",
      evaluateVisceralFat,
      "İç yağlanma seviyesini pratik bir skor olarak gösterir.",
      "Yüksekse düşük etkili kardiyo, düzenli ölçüm ve beslenme takibi artırılmalıdır.",
    ),
    buildIndicator(
      "BMR",
      measurement.bmr,
      "kcal",
      () => ({ status: "neutral", statusLabel: "Kalori referansı" }),
      "Bazal metabolizma hızı günlük enerji planı için temel referanstır.",
      "Beslenme kalori hedefi aktivite düzeyi ve hedefe göre bu değer üzerinden ayarlanır.",
    ),
    buildIndicator(
      "Metabolizma yaşı",
      measurement.metabolicAge,
      "",
      (value) => evaluateMetabolicAge(value, measurement.age),
      "Metabolik profilin yaş referansına göre yorumlanmasına yardımcı olur.",
      "Gerçek yaştan yüksekse uyku, aktivite, kas kütlesi ve beslenme düzeni birlikte ele alınmalıdır.",
    ),
    buildIndicator(
      "Vücut suyu",
      measurement.bodyWater,
      "%",
      evaluateBodyWater,
      "Hidrasyon ve yağsız kütle kalitesi için destekleyici göstergedir.",
      "Düşükse sıvı tüketimi, terleme düzeyi ve ölçüm koşulları takip edilmelidir.",
    ),
    buildIndicator(
      "WHR",
      whr,
      "",
      (value) => evaluateWhr(value, measurement.gender),
      "Bel/kalça oranı merkez bölge risk takibinde kullanılır.",
      "Bel çevresi yüksekse kardiyo, beslenme ve core stabilizasyon takibi önerilir.",
    ),
    buildIndicator(
      "Yağ kütlesi",
      measurement.fatMass,
      "kg",
      () => (measurementValue(measurement.fat) === "" ? { status: "neutral", statusLabel: "Takip" } : evaluateBodyFat(measurementValue(measurement.fat), measurement.gender)),
      "Toplam yağ miktarını kilogram olarak gösterir.",
      "Yağ kaybı hedefinde bu değerin kontrollü ve sürdürülebilir azalması beklenir.",
    ),
    buildIndicator(
      "Kas kütlesi",
      measurement.muscleMass,
      "kg",
      (value) => evaluateMuscleMass(value, measurement.weight),
      "Direnç antrenmanı ve protein hedefi için ana takip değerlerinden biridir.",
      "Düşük veya azalan trend varsa temel kuvvet ve hipertrofi çalışmaları güçlendirilmelidir.",
    ),
  ];
}

function buildIndicator(label, rawValue, unit, evaluator, explanation = "", recommendation = "") {
  const value = measurementValue(rawValue);
  const result = value === "" ? { status: "neutral", statusLabel: "Veri yok" } : evaluator(value);
  return { title: label, value, unit, explanation, recommendation, ...result };
}

function buildUltraProScoreBreakdown(measurement) {
  const fat = calculateFatScore(measurement);
  const muscle = calculateMuscleScore(measurement);
  const balance = calculateBalanceScore(measurement);
  const metabolic = calculateMetabolicScore(measurement);
  const overall = calculateOverallScore(measurement);

  return {
    fat: buildScoreObject("Yağ Skoru", fat, "Yağ oranı ve visceral yağ birlikte değerlendirilir."),
    muscle: buildScoreObject("Kas Skoru", muscle, "Kas kütlesinin vücut ağırlığına oranı dikkate alınır."),
    balance: buildScoreObject("Denge Skoru", balance, "Sağ-sol segmental kas/yağ farkları üzerinden hesaplanır."),
    metabolic: buildScoreObject("Metabolik Skor", metabolic, "BMI, visceral yağ, vücut suyu ve metabolizma yaşı birlikte okunur."),
    overall: buildScoreObject("Genel Skor", overall, "Tüm skorların ağırlıklı ortalamasıdır."),
  };
}

function buildScoreObject(title, score, text) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const status = normalizedScore >= 82 ? "normal" : normalizedScore >= 66 ? "warning" : normalizedScore >= 1 ? "risk" : "neutral";
  const statusLabel = normalizedScore >= 82 ? "İyi" : normalizedScore >= 66 ? "Dikkat" : normalizedScore >= 1 ? "Yüksek takip" : "Veri yok";

  return {
    title,
    score: normalizedScore,
    status,
    statusLabel,
    text,
  };
}

function calculateFatScore(measurement) {
  const fat = measurementValue(measurement?.fat);
  const visceral = measurementValue(measurement?.visceralFat);

  if (fat === "" && visceral === "") {
    return 65;
  }

  const fatStatus = fat === "" ? 72 : evaluateBodyFat(fat, measurement?.gender);
  const fatBase = fatStatus.status === "normal" ? 92 : fatStatus.status === "warning" ? 70 : 46;
  const visceralBase = visceral === "" ? 72 : visceral <= 9 ? 94 : visceral <= 12 ? 72 : 42;
  return Math.round(fatBase * 0.72 + visceralBase * 0.28);
}

function calculateMuscleScore(measurement) {
  const muscle = measurementValue(measurement?.muscleMass);
  const weight = measurementValue(measurement?.weight);

  if (muscle === "" || !weight) {
    return 65;
  }

  const ratio = (muscle / weight) * 100;
  if (ratio >= 45) return 94;
  if (ratio >= 40) return 84;
  if (ratio >= 35) return 68;
  return 48;
}

function calculateBalanceScore(measurement) {
  const segments = measurement?.segments || {};
  const diffs = [
    segmentDiffPercent(segments.rightArmMuscle, segments.leftArmMuscle),
    segmentDiffPercent(segments.rightLegMuscle, segments.leftLegMuscle),
    segmentDiffPercent(segments.rightArmFat, segments.leftArmFat),
    segmentDiffPercent(segments.rightLegFat, segments.leftLegFat),
  ].filter((value) => Number.isFinite(Number(value)));

  if (!diffs.length) {
    return 65;
  }

  const maxDiff = Math.max(...diffs);
  if (maxDiff <= 5) return 96;
  if (maxDiff <= 10) return 84;
  if (maxDiff <= 16) return 68;
  return 48;
}

function calculateMetabolicScore(measurement) {
  const visceral = measurementValue(measurement?.visceralFat);
  const bmi = measurementValue(measurement?.bmi) || calculateBmiFromWeightHeight(measurement?.weight, measurement?.height);
  const bodyWater = measurementValue(measurement?.bodyWater);
  const metabolicAge = measurementValue(measurement?.metabolicAge);
  const age = measurementValue(measurement?.age);
  const scores = [];

  if (visceral !== "") scores.push(visceral <= 9 ? 94 : visceral <= 12 ? 72 : 42);
  if (bmi !== "") scores.push(evaluateBmi(bmi).status === "normal" ? 92 : evaluateBmi(bmi).status === "warning" ? 70 : 48);
  if (bodyWater !== "") scores.push(evaluateBodyWater(bodyWater).status === "normal" ? 90 : evaluateBodyWater(bodyWater).status === "warning" ? 70 : 48);
  if (metabolicAge !== "" && age !== "") scores.push(metabolicAge <= age ? 92 : metabolicAge <= age + 5 ? 72 : 48);

  if (!scores.length) {
    return 65;
  }

  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function calculateOverallScore(measurement) {
  const fat = calculateFatScore(measurement);
  const muscle = calculateMuscleScore(measurement);
  const balance = calculateBalanceScore(measurement);
  const metabolic = calculateMetabolicScore(measurement);
  return Math.round(fat * 0.28 + muscle * 0.25 + balance * 0.22 + metabolic * 0.25);
}

function buildMeasurementExecutiveSummary(measurement, indicators, previousMeasurements) {
  const riskCount = indicators.filter((item) => item.status === "risk").length;
  const warningCount = indicators.filter((item) => item.status === "warning").length;
  const normalCount = indicators.filter((item) => item.status === "normal").length;
  const score = Math.max(35, Math.min(98, 88 - riskCount * 16 - warningCount * 7 + normalCount * 2));
  const riskLevel = riskCount ? "Yüksek takip" : warningCount >= 3 ? "Orta takip" : warningCount ? "Dikkat" : "Düşük risk";
  const fat = measurementValue(measurement.fat);
  const muscle = measurementValue(measurement.muscleMass);
  const visceral = measurementValue(measurement.visceralFat);
  const water = measurementValue(measurement.bodyWater);
  const previous = previousMeasurements?.[0] || null;
  const muscleTrend = previous ? measurementValue(measurement.muscleMass) - measurementValue(previous.muscleMass) : 0;
  const fatTrend = previous ? measurementValue(measurement.fat) - measurementValue(previous.fat) : 0;
  const strengths = [];
  const focusAreas = [];

  if (visceral !== "" && visceral <= 9) strengths.push("Visceral yağ kontrol altında");
  if (water !== "" && water >= 50 && water <= 65) strengths.push("Vücut suyu takip aralığında");
  if (muscleTrend > 0) strengths.push("Kas kütlesi trendi olumlu");
  if (fat !== "" && fat <= 22) strengths.push("Yağ oranı yönetilebilir aralıkta");
  if (!strengths.length) strengths.push("Ölçüm verileri düzenli takip için yeterli temel sağlıyor");

  if (fat !== "" && fat >= 30) focusAreas.push("Yağ oranı ve yağ kütlesi azaltımı");
  if (visceral !== "" && visceral >= 13) focusAreas.push("İç yağlanma ve kardiyo düzeni");
  if (muscle !== "" && measurementValue(measurement.weight) && (muscle / measurementValue(measurement.weight)) * 100 < 38) focusAreas.push("Kas kütlesi ve kuvvet gelişimi");
  if (fatTrend > 0) focusAreas.push("Son ölçüme göre yağ oranı artışı");
  if (!focusAreas.length) focusAreas.push("Mevcut kompozisyonu koruyarak hedefe göre kademeli gelişim");

  return {
    score,
    riskLevel,
    status: riskCount ? "risk" : warningCount ? "warning" : "normal",
    compositionStatus: score >= 82 ? "Dengeli ve takip edilebilir" : score >= 68 ? "Geliştirilebilir, düzenli takip önerilir" : "Yakın takip ve plan revizyonu önerilir",
    strengths: strengths.slice(0, 3),
    focusAreas: focusAreas.slice(0, 3),
  };
}

function buildMeasurementScoreCards(measurement, scoreBreakdown) {
  return [
    scoreBreakdown.fat,
    scoreBreakdown.muscle,
    scoreBreakdown.balance,
    scoreBreakdown.metabolic,
  ].map((item) => ({
    title: item.title,
    value: `${item.score}`,
    status: item.status,
    statusLabel: item.statusLabel,
    text: item.text,
  }));
}

function buildSegmentalAnalysisModel(measurement, segmentalValues) {
  const segments = measurement.segments || {};
  const armDiff = segmentDiffPercent(segments.rightArmMuscle, segments.leftArmMuscle) || 0;
  const legDiff = segmentDiffPercent(segments.rightLegMuscle, segments.leftLegMuscle) || 0;
  const trunkFat = measurementValue(segments.trunkFat);
  const segmentFatTotal = ["rightArmFat", "leftArmFat", "trunkFat", "rightLegFat", "leftLegFat"]
    .map((key) => measurementValue(segments[key]))
    .filter((value) => value !== "")
    .reduce((sum, value) => sum + value, 0);
  const trunkFatShare = trunkFat !== "" && segmentFatTotal ? roundReportNumber((trunkFat / segmentFatTotal) * 100) : "";
  const interpretations = [];

  interpretations.push(
    legDiff <= 8
      ? "Sağ ve sol bacak kas değerleri birbirine yakın, alt ekstremite dengesi korunmuş."
      : "Sağ-sol bacak kas farkı takip edilmeli; tek taraflı alt vücut çalışmaları programa eklenebilir.",
  );
  interpretations.push(
    armDiff <= 8
      ? "Kol kas değerleri birbirine yakın, üst ekstremite simetrisi iyi görünüyor."
      : "Kol kas değerleri arasında fark var; tek taraflı çekiş/itiş hareketleri kontrollü artırılabilir.",
  );
  interpretations.push(
    trunkFatShare !== "" && trunkFatShare >= 45
      ? "Gövde yağ kütlesi toplam segmental yağ dağılımında belirgin paya sahip, beslenme ve kardiyo planında takip edilmelidir."
      : "Gövde yağ dağılımı belirgin yüksek görünmüyor; genel yağ oranı hedefe göre izlenebilir.",
  );
  interpretations.push(
    measurementValue(segments.rightArmMuscle) !== "" && measurementValue(segments.rightArmMuscle) < 3
      ? "Kol kas değerleri düşükse üst ekstremite kuvvet çalışmaları artırılabilir."
      : "Üst ekstremite çalışmaları mevcut hedefe göre korunabilir.",
  );

  return {
    muscleValues: segmentalValues.filter((item) => item.type === "muscle"),
    fatValues: segmentalValues.filter((item) => item.type === "fat"),
    armDiff,
    legDiff,
    trunkFatShare,
    symmetryBars: buildSegmentalSymmetryBars(measurement),
    heatmap: buildSegmentalHeatmap(measurement, armDiff, legDiff, trunkFatShare),
    interpretations,
  };
}

function buildSegmentalSymmetryBars(measurement) {
  const segments = measurement?.segments || {};
  return [
    buildSymmetryBar("Kol kas simetrisi", segments.rightArmMuscle, segments.leftArmMuscle, "Sağ kol", "Sol kol", "muscle"),
    buildSymmetryBar("Bacak kas simetrisi", segments.rightLegMuscle, segments.leftLegMuscle, "Sağ bacak", "Sol bacak", "muscle"),
    buildSymmetryBar("Kol yağ simetrisi", segments.rightArmFat, segments.leftArmFat, "Sağ kol", "Sol kol", "fat"),
    buildSymmetryBar("Bacak yağ simetrisi", segments.rightLegFat, segments.leftLegFat, "Sağ bacak", "Sol bacak", "fat"),
  ];
}

function buildSymmetryBar(title, rightValue, leftValue, rightLabel, leftLabel, type) {
  const right = measurementValue(rightValue);
  const left = measurementValue(leftValue);
  const total = right !== "" && left !== "" ? right + left : 0;
  const diff = segmentDiffPercent(right, left) || 0;
  const status = diff <= 5 ? "normal" : diff <= 12 ? "warning" : "risk";

  return {
    title,
    rightLabel,
    leftLabel,
    right,
    left,
    type,
    diff,
    status,
    rightPercent: total ? Math.round((right / total) * 100) : 50,
    leftPercent: total ? Math.round((left / total) * 100) : 50,
  };
}

function buildSegmentalHeatmap(measurement, armDiff, legDiff, trunkFatShare) {
  const segments = measurement?.segments || {};
  const trunkFat = measurementValue(segments.trunkFat);
  const trunkMuscle = measurementValue(segments.trunkMuscle);
  const limbMuscleValues = [segments.rightArmMuscle, segments.leftArmMuscle, segments.rightLegMuscle, segments.leftLegMuscle].map(measurementValue).filter((value) => value !== "");
  const avgLimbMuscle = limbMuscleValues.length ? limbMuscleValues.reduce((sum, value) => sum + value, 0) / limbMuscleValues.length : "";
  const trunkDominance = trunkMuscle !== "" && avgLimbMuscle ? trunkMuscle / avgLimbMuscle : "";

  return [
    {
      title: "Kas denge heatmap",
      status: Math.max(armDiff, legDiff) <= 5 ? "normal" : Math.max(armDiff, legDiff) <= 12 ? "warning" : "risk",
      value: `${formatReportValue(Math.max(armDiff, legDiff), "%")} max fark`,
      text: "Sağ-sol kas simetrisi",
    },
    {
      title: "Yağ yoğunluğu",
      status: trunkFatShare === "" ? "neutral" : trunkFatShare >= 48 ? "risk" : trunkFatShare >= 40 ? "warning" : "normal",
      value: formatReportValue(trunkFatShare, "%"),
      text: "Gövde yağ payı",
    },
    {
      title: "Gövde yağ uyarısı",
      status: trunkFat === "" ? "neutral" : trunkFatShare >= 45 ? "warning" : "normal",
      value: formatReportValue(trunkFat, "kg"),
      text: "Gövde yağ kütlesi",
    },
    {
      title: "Alt ekstremite",
      status: legDiff <= 5 ? "normal" : legDiff <= 12 ? "warning" : "risk",
      value: formatReportValue(legDiff, "%"),
      text: "Bacak kas farkı",
    },
    {
      title: "Üst ekstremite",
      status: armDiff <= 5 ? "normal" : armDiff <= 12 ? "warning" : "risk",
      value: formatReportValue(armDiff, "%"),
      text: "Kol kas farkı",
    },
    {
      title: "Gövde dominansı",
      status: trunkDominance !== "" && trunkDominance >= 4.5 ? "warning" : "neutral",
      value: trunkDominance === "" ? "Veri yok" : `${roundReportNumber(trunkDominance, 1)}x`,
      text: "Gövde / ekstremite oranı",
    },
  ];
}

function buildTargetDistanceModel(measurement) {
  const idealWeightRange = calculateIdealWeightRange(measurement.height);
  const fat = measurementValue(measurement.fat);
  const weight = measurementValue(measurement.weight);
  const fatMass = measurementValue(measurement.fatMass);
  const muscleMass = measurementValue(measurement.muscleMass);
  const isMale = normalizeText(measurement.gender).includes("bay") || normalizeText(measurement.gender).includes("erkek") || normalizeText(measurement.gender).includes("male");
  const targetFatRange = isMale ? { min: 12, max: 20 } : { min: 18, max: 28 };
  const targetFatMass = weight && fat > targetFatRange.max ? roundReportNumber((weight * targetFatRange.max) / 100) : "";
  const fatMassReduction = fatMass !== "" && targetFatMass !== "" ? Math.max(0, roundReportNumber(fatMass - targetFatMass)) : "";

  return {
    idealWeightRange,
    targetFatRange,
    items: [
      {
        title: "Mevcut kilo",
        value: formatReportValue(weight, "kg"),
        target: idealWeightRange ? `${formatReportValue(idealWeightRange.min, "kg")} - ${formatReportValue(idealWeightRange.max, "kg")}` : "Boy verisi gerekli",
        note: idealWeightRange ? "İdeal kilo aralığı BMI referansına göre hesaplanmıştır." : "Boy bilgisi olmadan ideal kilo hesaplanamaz.",
      },
      {
        title: "Yağ oranı",
        value: formatReportValue(fat, "%"),
        target: `%${targetFatRange.min} - %${targetFatRange.max}`,
        note: fat === "" ? "Yağ oranı verisi bulunamadı." : fat > targetFatRange.max ? "Yağ oranının kontrollü azaltılması hedeflenebilir." : "Yağ oranı hedef aralıkla uyumlu veya takip edilebilir düzeyde.",
      },
      {
        title: "Kas kütlesi",
        value: formatReportValue(muscleMass, "kg"),
        target: "Koruma / kademeli artış",
        note: "Yağ kaybı döneminde kas kütlesinin korunması önceliklidir.",
      },
      {
        title: "Yağ kütlesi hedefi",
        value: formatReportValue(fatMass, "kg"),
        target: fatMassReduction !== "" ? `${formatReportValue(fatMassReduction, "kg")} kontrollü azaltım potansiyeli` : "Hedefe göre korunabilir",
        note: `Mevcut yağ kütlesi ${formatReportValue(fatMass, "kg")}. Hedefe göre yağ kütlesinin kontrollü şekilde azaltılması veya korunması değerlendirilebilir.`,
      },
    ],
  };
}

function buildNextMeasurementGoals(measurement, targetDistance, segmentalAnalysis) {
  const fat = measurementValue(measurement?.fat);
  const muscleMass = measurementValue(measurement?.muscleMass);
  const bodyWater = measurementValue(measurement?.bodyWater);
  const bmr = measurementValue(measurement?.bmr);
  const hasWaistHip = measurementValue(measurement?.waist) !== "" && measurementValue(measurement?.hip) !== "";
  const targetFatMax = targetDistance?.targetFatRange?.max || 28;
  const balanceNeedsFollowUp = (segmentalAnalysis?.armDiff || 0) > 8 || (segmentalAnalysis?.legDiff || 0) > 8;

  return [
    {
      title: "Yağ oranı takip",
      status: fat === "" ? "neutral" : fat > targetFatMax ? "warning" : "normal",
      text: fat === "" ? "Yağ oranı verisi yok; sonraki ölçümde takip edilmeli." : fat > targetFatMax ? "Yağ oranında kontrollü düşüş hedeflenebilir." : "Yağ oranı hedef aralıkla uyumlu şekilde izlenebilir.",
    },
    {
      title: "Kas kütlesi koruma",
      status: muscleMass === "" ? "neutral" : "normal",
      text: muscleMass === "" ? "Kas kütlesi verisi yok; Tanita ölçümünde tekrar kontrol edilmeli." : "Direnç antrenmanı ve protein hedefiyle kas kütlesi korunmalı.",
    },
    {
      title: "Segmental denge izleme",
      status: balanceNeedsFollowUp ? "warning" : "normal",
      text: balanceNeedsFollowUp ? "Sağ-sol fark için tek taraflı destekleyici çalışmalar eklenebilir." : "Sağ-sol segmental denge korunmuş görünüyor.",
    },
    {
      title: "BMR bazlı beslenme planlama",
      status: bmr === "" ? "neutral" : "normal",
      text: bmr === "" ? "BMR yoksa kalori hedefi tahmini hesaplanır." : "Beslenme kalorisi BMR ve aktivite düzeyine göre planlanabilir.",
    },
    {
      title: "Hidrasyon hedefi",
      status: bodyWater === "" ? "neutral" : evaluateBodyWater(bodyWater).status,
      text: bodyWater === "" ? "Vücut suyu verisi yok; ölçüm koşulları standart tutulmalı." : "Ölçüm öncesi sıvı dengesi ve antrenman zamanı standartlaştırılmalı.",
    },
    {
      title: hasWaistHip ? "Bel/kalça takibi" : "Bel/kalça ölçümü ekle",
      status: hasWaistHip ? "normal" : "neutral",
      text: hasWaistHip ? "WHR ile merkez bölge değişimi izlenebilir." : "Bel ve kalça çevresi eklendiğinde rapor yorumu güçlenir.",
    },
    {
      title: "14-21 gün sonra tekrar ölçüm",
      status: "normal",
      text: "Aynı saat, benzer hidrasyon ve benzer antrenman koşullarında tekrar ölçüm önerilir.",
    },
  ];
}

function buildMeasurementCoachPlan(measurement, previousMeasurements, segmentalAnalysis) {
  const fat = measurementValue(measurement.fat);
  const visceral = measurementValue(measurement.visceralFat);
  const muscle = measurementValue(measurement.muscleMass);
  const previous = previousMeasurements?.[0] || null;
  const fatMassDelta = previous ? measurementValue(measurement.fatMass) - measurementValue(previous.fatMass) : "";
  const muscleDelta = previous ? measurementValue(measurement.muscleMass) - measurementValue(previous.muscleMass) : "";
  const nextTargets = [];

  if (fat !== "" && fat >= 25) nextTargets.push("Yağ oranında kontrollü düşüş hedefle");
  if (muscleDelta !== "" && muscleDelta <= 0) nextTargets.push("Kas kütlesini koru veya küçük artış hedefle");
  if (visceral !== "" && visceral >= 10) nextTargets.push("Visceral yağ skorunu takip aralığında tut");
  if (segmentalAnalysis.armDiff >= 10 || segmentalAnalysis.legDiff >= 10) nextTargets.push("Sağ-sol segmental farkı azalt");
  if (!nextTargets.length) nextTargets.push("Mevcut ölçüm değerlerini koruyarak hedefe göre kademeli ilerle");

  return [
    {
      title: "Genel değerlendirme",
      text: fat !== "" && fat >= 30
        ? "Yağ oranı öncelikli takip alanı olarak öne çıkıyor. Kas kütlesi korunurken yağ kütlesinin kontrollü azaltılması hedeflenmelidir."
        : "Yağ oranı yönetilebilir aralıktadır. Kas kütlesi korunurken hedefe göre kontrollü gelişim planlanabilir.",
    },
    {
      title: "Antrenman önerisi",
      text: "Haftalık direnç antrenmanı korunmalı; büyük kas gruplarında temel hareketler, segmental fark varsa tek taraflı destekleyici çalışmalarla tamamlanmalıdır.",
    },
    {
      title: "Beslenme önerisi",
      text: fatMassDelta !== "" && fatMassDelta > 0
        ? "Son ölçüme göre yağ kütlesi artışı görüldüğü için kalori kontrolü ve protein hedefi netleştirilmelidir."
        : "Protein hedefi korunmalı, karbonhidrat ve yağ dengesi antrenman sıklığına göre ayarlanmalıdır.",
    },
    {
      title: "Takip önerisi",
      text: "Ölçüm koşulları benzer tutularak 14-21 gün içinde tekrar ölçüm alınması, trend analizini daha güvenilir hale getirir.",
    },
    {
      title: "Dikkat edilmesi gereken alanlar",
      text: visceral >= 13 ? "Visceral yağ yüksek bölgede; düşük etkili kardiyo, düzenli yürüyüş ve beslenme takibi önceliklendirilmelidir." : "Bel çevresi, yağ oranı ve segmental denge düzenli takip edilmelidir.",
    },
    {
      title: "Bir sonraki ölçüm hedefleri",
      text: nextTargets.join(" • "),
    },
  ];
}

function buildTrendReportValues(measurement, previousMeasurements) {
  const rows = previousMeasurements.slice(0, 5);
  const latest = normalizeMeasurementPayload(measurement);
  const timeline = [...rows].reverse().concat(latest);
  const tableTimeline = [latest, ...rows];

  return {
    hasTrend: rows.length > 0,
    charts: [
      buildTrendChart("Kilo", "weight", "kg", timeline),
      buildTrendChart("Yağ oranı", "fat", "%", timeline),
      buildTrendChart("Kas kütlesi", "muscleMass", "kg", timeline),
      buildTrendChart("Yağ kg", "fatMass", "kg", timeline),
      buildTrendChart("Vücut suyu", "bodyWater", "%", timeline),
      buildTrendChart("BMI", "bmi", "", timeline),
    ],
    historyRows: tableTimeline.map((item, index) => buildMeasurementHistoryReportRow(item, tableTimeline[index + 1])),
    differences: [
      buildDifferenceRow("Kilo", latest.weight, rows[0]?.weight, "kg"),
      buildDifferenceRow("Yağ oranı", latest.fat, rows[0]?.fat, "%"),
      buildDifferenceRow("Kas kütlesi", latest.muscleMass, rows[0]?.muscleMass, "kg"),
      buildDifferenceRow("Yağ kg", latest.fatMass, rows[0]?.fatMass, "kg"),
      buildDifferenceRow("Vücut suyu", latest.bodyWater, rows[0]?.bodyWater, "%"),
      buildDifferenceRow("BMI", latest.bmi, rows[0]?.bmi, ""),
    ],
  };
}

function buildTrendChart(label, key, unit, timeline) {
  const values = timeline.map((item) => measurementValue(item?.[key])).filter((value) => value !== "");
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const firstValue = values[0] ?? "";
  const latestValue = values[values.length - 1] ?? "";
  const delta = firstValue !== "" && latestValue !== "" ? roundReportNumber(latestValue - firstValue) : "";
  const lowerIsBetter = ["fat", "fatMass", "bmi"].includes(key);
  const direction = delta === "" || delta === 0 ? "stable" : delta > 0 ? "up" : "down";
  const improved = delta === "" || delta === 0 ? "stable" : lowerIsBetter ? delta < 0 : delta > 0;
  const status = improved === true ? "normal" : improved === false ? "warning" : "neutral";
  const interpretation = delta === ""
    ? "Trend için yeterli veri yok."
    : delta === 0
      ? "Değer stabil seyrediyor."
      : improved
        ? "Trend hedef yönünde ilerliyor."
        : "Trend takip ve plan revizyonu gerektirebilir.";
  const points = timeline.map((item, index) => {
    const value = measurementValue(item?.[key]);
    const x = timeline.length <= 1 ? 50 : (index / (timeline.length - 1)) * 100;
    const y = value === "" ? 84 : 86 - ((value - min) / range) * 68;
    const percent = value === "" ? 0 : Math.max(8, Math.min(100, ((value - min) / range) * 82 + 12));

    return {
      label: index === timeline.length - 1 ? "Son" : formatReportDate(item?.date),
      value,
      percent,
      x: roundReportNumber(x, 1),
      y: roundReportNumber(Math.max(12, Math.min(86, y)), 1),
    };
  });
  const svgPoints = points.filter((point) => point.value !== "").map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = svgPoints ? `0,92 ${svgPoints} 100,92` : "";

  return {
    label,
    unit,
    points,
    svgPoints,
    areaPoints,
    firstValue,
    latestValue,
    delta,
    direction,
    status,
    interpretation,
  };
}

function buildDifferenceRow(label, currentValue, previousValue, unit) {
  const current = measurementValue(currentValue);
  const previous = measurementValue(previousValue);

  if (current === "" || previous === "") {
    return { label, current, previous, delta: "", unit, direction: "neutral" };
  }

  const delta = roundReportNumber(current - previous);
  return {
    label,
    current,
    previous,
    delta,
    unit,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "neutral",
  };
}

function buildMeasurementHistoryReportRow(current, previous) {
  return {
    date: `${formatReportDate(current?.date)}${current?.time ? " " + current.time : ""}`,
    weight: current?.weight,
    weightDelta: calculateReportDelta(current?.weight, previous?.weight),
    fatMass: current?.fatMass,
    fatMassDelta: calculateReportDelta(current?.fatMass, previous?.fatMass),
    fat: current?.fat,
    fatDelta: calculateReportDelta(current?.fat, previous?.fat),
    muscleMass: current?.muscleMass,
    muscleMassDelta: calculateReportDelta(current?.muscleMass, previous?.muscleMass),
    bodyWaterKg: calculateBodyWaterKg(current || {}),
    bodyWaterDelta: calculateReportDelta(calculateBodyWaterKg(current || {}), calculateBodyWaterKg(previous || {})),
    bmi: current?.bmi,
    bmiDelta: calculateReportDelta(current?.bmi, previous?.bmi),
  };
}

function calculateReportDelta(currentValue, previousValue) {
  const current = measurementValue(currentValue);
  const previous = measurementValue(previousValue);

  if (current === "" || previous === "") {
    return "";
  }

  return roundReportNumber(current - previous);
}

function buildMeasurementCoachInterpretation(measurement, previousMeasurements) {
  const fat = measurementValue(measurement.fat);
  const muscleMass = measurementValue(measurement.muscleMass);
  const weight = measurementValue(measurement.weight);
  const visceralFat = measurementValue(measurement.visceralFat);
  const previous = previousMeasurements?.[0] || null;
  const muscleRatio = weight && muscleMass ? (muscleMass / weight) * 100 : "";
  const armDiff = segmentDiffPercent(measurement?.segments?.rightArmMuscle, measurement?.segments?.leftArmMuscle);
  const legDiff = segmentDiffPercent(measurement?.segments?.rightLegMuscle, measurement?.segments?.leftLegMuscle);
  const maxSegmentDiff = Math.max(armDiff || 0, legDiff || 0);
  const fatTrend = previous ? measurementValue(measurement.fat) - measurementValue(previous.fat) : 0;
  const muscleTrend = previous ? measurementValue(measurement.muscleMass) - measurementValue(previous.muscleMass) : 0;

  return [
    {
      title: "Genel durum",
      text: weight ? `Güncel kilo ${formatReportValue(weight, "kg")}. Ölçüm, takip ve program revizyonu için kullanılabilir düzeyde veri sağlıyor.` : "Genel değerlendirme için kilo ve temel kompozisyon verileri takip edilmelidir.",
    },
    {
      title: "Yağ oranı yorumu",
      text: fat === "" ? "Yağ oranı verisi bulunmadığı için yorum sınırlıdır." : fat >= 30 ? "Yağ oranı yüksek bölgede; kontrollü kalori açığı ve düzenli düşük etkili kardiyo önerilir." : fat >= 22 ? "Yağ oranı takip edilmeli; direnç antrenmanı korunurken beslenme kontrolü güçlendirilebilir." : "Yağ oranı yönetilebilir aralıkta; performans ve kas kalitesini korumaya odaklanılabilir.",
    },
    {
      title: "Kas kütlesi yorumu",
      text: muscleMass === "" ? "Kas kütlesi verisi bulunmuyor." : muscleRatio && muscleRatio < 38 ? "Kas kütlesi/kilo oranı düşük görünüyor; protein hedefi ve temel kuvvet çalışmaları önceliklenmeli." : muscleTrend > 0 ? "Kas kütlesinde olumlu artış görülüyor; mevcut kuvvet/hipertrofi düzeni sürdürülebilir." : "Kas kütlesi korunmalı; büyük kas gruplarında kontrollü progresyon önerilir.",
    },
    {
      title: "Segmental denge yorumu",
      text: maxSegmentDiff >= 10 ? "Sağ-sol segmental fark takip gerektiriyor; tek taraflı destekleyici hareketler programa eklenmeli." : "Segmental kas dağılımı belirgin dengesizlik göstermiyor; simetrik yüklenme korunabilir.",
    },
    {
      title: "Beslenme / antrenman önerisi",
      text: visceralFat >= 13 || fatTrend > 0 ? "Beslenmede sürdürülebilir kalori kontrolü, yürüyüş/kardiyo sıklığı ve ölçüm takibi artırılmalı." : "Direnç antrenmanı, yeterli protein ve haftalık düzenli takip ile mevcut gelişim desteklenebilir.",
    },
  ];
}

// Premium report UI only, logic preserved.
function buildMeasurementReportHtml(model) {
  const { profile, measurement, bodyValues, segmentalAnalysis, targetDistance, impedanceValues, indicators, trends, interpretation, summary, scoreCards, coachPlan, nextGoals } = model;
  const memberName = profile?.memberName || measurement.memberName || "Üye";
  const trainerName = profile?.trainerName || "Bahçeşehir Spor Merkezi";
  const measurementTime = measurement.time ? ` / ${measurement.time}` : "";
  const reportDateText = `${formatReportDate(measurement.date)}${measurementTime}`;
  const reportHeader = buildPremiumReportHeader(memberName, reportDateText);

  return `
    <article class="measurement-report-page measurement-report-page--executive measurement-report-page--ultra-cover">
      ${reportHeader}
      <section class="ultra-cover-grid">
        <div class="ultra-cover-main">
          ${buildExecutiveSummaryHtml(summary)}
        </div>
        <aside class="ultra-cover-profile">
          <h3>Üye ve ölçüm bilgileri</h3>
          <div class="measurement-report-profile measurement-report-profile--compact">
            ${buildReportProfileItem("Üye adı soyadı", memberName)}
            ${buildReportProfileItem("Cinsiyet", measurement.gender || "-")}
            ${buildReportProfileItem("Yaş", formatReportValue(measurement.age, ""))}
            ${buildReportProfileItem("Boy", formatReportValue(measurement.height, "cm"))}
            ${buildReportProfileItem("Kilo", formatReportValue(measurement.weight, "kg"))}
            ${buildReportProfileItem("BMI", formatReportValue(measurement.bmi, ""))}
            ${buildReportProfileItem("Yağ %", formatReportValue(measurement.fat, "%"))}
            ${buildReportProfileItem("Ölçüm tarihi / saat", reportDateText)}
            ${buildReportProfileItem("Hazırlayan / Antrenör", trainerName)}
          </div>
        </aside>
        <div class="premium-score-grid ultra-score-grid">
          ${scoreCards.map(buildPremiumScoreCardHtml).join("")}
        </div>
      </section>
      ${buildPremiumReportFooter("Executive Summary")}
    </article>

    <article class="measurement-report-page measurement-report-page--composition">
      ${buildPremiumSectionHeader("02", "Vücut Kompozisyonu Analizi", "Kilo, yağ, su, yağsız kütle, kas ve kemik değerleri referans aralıklarıyla birlikte gösterilir.")}
      <div class="premium-reference-bars">
        ${bodyValues.map(buildMeasurementBarHtml).join("")}
      </div>
      ${buildTargetDistanceHtml(targetDistance)}
      <div class="premium-reference-note">
        <strong>Okuma notu</strong>
        <span>Her bar mevcut değeri, referans bölgeyi ve kısa yorumu birlikte gösterir. Renkler; yeşil normal, turuncu dikkat, kırmızı yüksek takip ihtiyacı, mavi/gri ise nötr referans değerleri belirtir.</span>
      </div>
      ${buildPremiumReportFooter("Vücut Kompozisyonu")}
    </article>

    <article class="measurement-report-page measurement-report-page--segmental">
      ${buildPremiumSectionHeader("03", "Segmental Vücut Kompozisyonu Analizi", "Sağ-sol kas dengesi, gövde dağılımı ve segmental yağ yoğunluğu daha okunabilir şekilde yorumlanır.")}
      <div class="premium-segmental-layout">
        ${buildSegmentalSilhouetteHtml(segmentalAnalysis)}
        <div class="premium-segmental-side">
          <div class="premium-segmental-subgrid">
            ${segmentalAnalysis.muscleValues.map(buildSegmentCardHtml).join("")}
          </div>
          <div class="premium-segmental-subgrid">
            ${segmentalAnalysis.fatValues.map(buildSegmentCardHtml).join("")}
          </div>
        </div>
      </div>
      ${buildSegmentalSymmetryHtml(segmentalAnalysis.symmetryBars)}
      ${buildSegmentalHeatmapHtml(segmentalAnalysis.heatmap)}
      <div class="premium-interpretation-grid">
        ${segmentalAnalysis.interpretations.map((text) => `<article><strong>Segmental yorum</strong><p>${escapeHtml(text)}</p></article>`).join("")}
      </div>
      ${buildPremiumReportFooter("Segmental Analiz")}
    </article>

    <article class="measurement-report-page measurement-report-page--health">
      ${buildPremiumSectionHeader("04", "Sağlık Göstergeleri ve Empedans", "Temel ölçüm değerleri kısa açıklama ve uygulanabilir önerilerle birlikte sunulur.")}
      <div class="premium-health-grid">
        ${indicators.map(buildIndicatorHtml).join("")}
      </div>
      <section class="premium-impedance-panel">
        <div class="measurement-report-card__title">
          <span>Ω</span>
          <h2>Segmental Direnç / Empedans Değerleri</h2>
        </div>
        <div class="measurement-impedance-table">
          ${impedanceValues.map(([label, value]) => buildImpedanceRowHtml(label, value)).join("")}
        </div>
      </section>
      ${buildPremiumReportFooter("Sağlık Göstergeleri")}
    </article>

    <article class="measurement-report-page measurement-report-page--trend">
      ${buildPremiumSectionHeader("05", "Gelişim Takibi ve Fark Analizi", trends.hasTrend ? "Önceki ölçümlerle kilo, yağ, kas ve sıvı değişimi takip edilir." : "Trend grafikleri ikinci ölçümden itibaren otomatik oluşur.")}
      ${
        trends.hasTrend
          ? `
            <div class="premium-history-table">
              <div class="premium-history-table__head">
                <span>Ölçüm tarihi</span><span>Kilo / fark</span><span>Yağ kg / fark</span><span>Yağ % / fark</span><span>Kas kg / fark</span><span>Sıvı kg / fark</span><span>BMI / fark</span>
              </div>
              ${trends.historyRows.map(buildHistoryRowHtml).join("")}
            </div>
            <div class="measurement-trend-grid measurement-trend-grid--premium">
              ${trends.charts.map(buildTrendChartHtml).join("")}
            </div>
            <div class="measurement-difference-table premium-difference-table">
              <div class="measurement-difference-table__head">
                <span>Alan</span><span>Önceki</span><span>Son</span><span>Fark</span>
              </div>
              ${trends.differences.map(buildDifferenceRowHtml).join("")}
            </div>
          `
          : `
            <article class="measurement-report-empty measurement-report-empty--compact">
              <strong>Trend analizi için en az iki ölçüm gereklidir.</strong>
              <span>İkinci ölçümden itibaren değişim grafikleri, fark tablosu ve trend yorumu otomatik oluşacaktır.</span>
            </article>
          `
      }
      ${buildPremiumReportFooter("Trend Analizi")}
    </article>

    <article class="measurement-report-page measurement-report-page--coach">
      ${buildPremiumSectionHeader("06", "Profesyonel Koç Değerlendirmesi", "Ölçüm sonucu antrenman, beslenme ve takip aksiyonlarına dönüştürülür.")}
      <div class="premium-coach-layout">
        ${coachPlan.map(buildCoachInterpretationHtml).join("")}
      </div>
      <div class="premium-coach-summary">
        <strong>Kısa değerlendirme</strong>
        <div class="measurement-coach-grid measurement-coach-grid--final">
          ${interpretation.map(buildCoachInterpretationHtml).join("")}
        </div>
      </div>
      ${buildNextGoalsHtml(nextGoals)}
      ${buildPremiumReportFooter("Koç Değerlendirmesi")}
    </article>
  `;
}

function buildPremiumReportHeader(memberName, reportDateText) {
  return `
    <div class="measurement-print-header">Bahçeşehir Spor Merkezi | Tanita BC-418 Ölçüm Raporu</div>
    <header class="measurement-report-hero measurement-report-hero--premium">
      <div class="premium-brand-mark">
        <strong>BSM</strong>
        <span>Performans & Ölçüm</span>
      </div>
      <div>
        <p class="section-kicker">Bahçeşehir Spor Merkezi • Ultra Pro V2</p>
        <h1>Tanita BC-418 Performans ve Vücut Kompozisyon Raporu</h1>
        <span>${escapeHtml(memberName)} için hazırlanmış Ultra Pro spor performans ve vücut analizi raporu.</span>
      </div>
      <div class="measurement-report-stamp">
        <strong>${escapeHtml(reportDateText)}</strong>
        <span>Rapor tarihi</span>
      </div>
    </header>
  `;
}

function buildPremiumSectionHeader(pageNumber, title, description) {
  return `
    <div class="measurement-print-header">Bahçeşehir Spor Merkezi | Tanita BC-418 Ölçüm Raporu</div>
    <header class="measurement-report-section-header measurement-report-section-header--premium">
      <span>${escapeHtml(pageNumber)}</span>
      <div>
        <p class="section-kicker">Premium Ölçüm Raporu</p>
        <h2>${escapeHtml(title)}</h2>
        <small>${escapeHtml(description)}</small>
      </div>
    </header>
  `;
}

function buildPremiumReportFooter(sectionName) {
  return `
    <footer class="measurement-print-footer">
      <span>Bahçeşehir Spor Merkezi | Tanita BC-418 Ölçüm Raporu</span>
      <strong>${escapeHtml(sectionName)}</strong>
      <em class="measurement-page-number"></em>
    </footer>
  `;
}

function buildReportProfileItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function buildMeasurementBarHtml(item) {
  const normalStart = Math.max(0, Math.min(100, Number(item.normalStart || 18)));
  const normalEnd = Math.max(normalStart + 4, Math.min(100, Number(item.normalEnd || 72)));
  return `
    <div class="measurement-bar measurement-bar--${escapeHtml(item.color)} measurement-bar--status-${escapeHtml(item.status || "neutral")}">
      <div class="measurement-bar__label">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.reference || "Referans aralığı takip amaçlıdır")}</span>
      </div>
      <div class="measurement-bar__track">
        <b style="left: ${normalStart}%; width: ${Math.max(4, normalEnd - normalStart)}%"></b>
        <i style="width: ${item.percent}%"></i>
      </div>
      <div class="measurement-bar__value">
        <strong>${escapeHtml(formatReportValueText(item.value, item.unit))}</strong>
        <em>${escapeHtml(item.statusLabel || "Takip")}</em>
      </div>
      <p class="measurement-bar__note">${escapeHtml(item.explanation || "Bu değer ölçüm dosyasında bulunamadı.")}</p>
    </div>
  `;
}

function buildIndicatorHtml(indicator) {
  return `
    <article class="measurement-indicator measurement-indicator--detailed measurement-indicator--${escapeHtml(indicator.status)}">
      <div>
        <span>${escapeHtml(indicator.title)}</span>
        <em>${escapeHtml(indicator.statusLabel || "Takip")}</em>
      </div>
      <strong>${escapeHtml(formatReportValueText(indicator.value, indicator.unit))}</strong>
      <p>${escapeHtml(indicator.explanation || "Bu değer ölçüm dosyasında bulunamadı.")}</p>
      <small>${escapeHtml(indicator.value === "" ? "Bu değer ölçüm dosyasında bulunamadı." : indicator.recommendation || "Takip aralığı korunmalıdır.")}</small>
    </article>
  `;
}

function buildImpedanceRowHtml(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatReportValue(value, "ohm"))}</strong>
    </div>
  `;
}

function buildSegmentCardHtml(item) {
  const value = measurementValue(item.value);
  const percent = reportPercent(value, item.type === "muscle" ? 40 : 20);
  return `
    <article class="measurement-segment-card measurement-segment-card--${escapeHtml(item.type)}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(formatReportValue(value, item.unit))}</strong>
      <div class="measurement-segment-card__bar"><i style="width: ${percent}%"></i></div>
    </article>
  `;
}

function buildSegmentalSilhouetteHtml(segmentalAnalysis) {
  return `
    <div class="premium-body-map">
      <div class="premium-body-map__figure" aria-hidden="true">
        <span class="body-head"></span>
        <span class="body-torso"></span>
        <span class="body-arm body-arm--left"></span>
        <span class="body-arm body-arm--right"></span>
        <span class="body-leg body-leg--left"></span>
        <span class="body-leg body-leg--right"></span>
      </div>
      <div class="premium-body-map__stats">
        <article>
          <span>Kol kas farkı</span>
          <strong>${escapeHtml(formatReportValue(segmentalAnalysis.armDiff, "%"))}</strong>
        </article>
        <article>
          <span>Bacak kas farkı</span>
          <strong>${escapeHtml(formatReportValue(segmentalAnalysis.legDiff, "%"))}</strong>
        </article>
        <article>
          <span>Gövde yağ payı</span>
          <strong>${escapeHtml(formatReportValue(segmentalAnalysis.trunkFatShare, "%"))}</strong>
        </article>
      </div>
    </div>
  `;
}

function buildTargetDistanceHtml(targetDistance) {
  if (!targetDistance?.items?.length) {
    return "";
  }

  return `
    <section class="ultra-target-distance">
      <div class="ultra-section-title">
        <span>Hedefe Uzaklık</span>
        <strong>Mevcut değerler hedef aralıklarla karşılaştırılır.</strong>
      </div>
      <div class="ultra-target-grid">
        ${targetDistance.items
          .map(
            (item) => `
              <article class="ultra-target-card">
                <span>${escapeHtml(item.title)}</span>
                <strong>${escapeHtml(item.value || "Veri yok")}</strong>
                <em>Hedef: ${escapeHtml(item.target || "Takip")}</em>
                <p>${escapeHtml(item.note || "Bu değer ölçüm dosyasında bulunamadı.")}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function buildSegmentalSymmetryHtml(symmetryBars) {
  if (!symmetryBars?.length) {
    return "";
  }

  return `
    <section class="ultra-symmetry-panel">
      <div class="ultra-section-title">
        <span>Sağ-Sol Karşılaştırma</span>
        <strong>Fark azaldıkça segmental denge skoru güçlenir.</strong>
      </div>
      <div class="ultra-symmetry-grid">
        ${symmetryBars.map(buildSymmetryBarHtml).join("")}
      </div>
    </section>
  `;
}

function buildSymmetryBarHtml(item) {
  return `
    <article class="ultra-symmetry-card ultra-symmetry-card--${escapeHtml(item.status)}">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <em>${escapeHtml(formatReportValue(item.diff, "%"))} fark</em>
      </div>
      <div class="ultra-symmetry-track">
        <span style="width: ${item.rightPercent}%"></span>
        <i style="width: ${item.leftPercent}%"></i>
      </div>
      <div class="ultra-symmetry-values">
        <span>${escapeHtml(item.rightLabel)}: ${escapeHtml(formatReportValue(item.right, item.type === "fat" ? "kg" : "kg"))}</span>
        <span>${escapeHtml(item.leftLabel)}: ${escapeHtml(formatReportValue(item.left, item.type === "fat" ? "kg" : "kg"))}</span>
      </div>
    </article>
  `;
}

function buildSegmentalHeatmapHtml(heatmap) {
  if (!heatmap?.length) {
    return "";
  }

  return `
    <section class="ultra-heatmap-panel">
      <div class="ultra-section-title">
        <span>Segmental Heatmap</span>
        <strong>Kas dengesi, yağ yoğunluğu ve gövde dağılımı hızlı okunur.</strong>
      </div>
      <div class="ultra-heatmap-grid">
        ${heatmap.map(buildHeatmapBadgeHtml).join("")}
      </div>
    </section>
  `;
}

function buildHeatmapBadgeHtml(item) {
  return `
    <article class="ultra-heatmap-badge ultra-heatmap-badge--${escapeHtml(item.status)}">
      <span>${escapeHtml(item.title)}</span>
      <strong>${escapeHtml(item.value || "Veri yok")}</strong>
      <small>${escapeHtml(item.text || "Takip")}</small>
    </article>
  `;
}

function buildNextGoalsHtml(nextGoals) {
  if (!nextGoals?.length) {
    return "";
  }

  return `
    <section class="ultra-next-goals">
      <div class="ultra-section-title">
        <span>Sonraki Ölçüm Hedefleri</span>
        <strong>14-21 günlük takip döngüsü için uygulanabilir kontrol listesi.</strong>
      </div>
      <div class="ultra-next-goal-grid">
        ${nextGoals
          .map(
            (goal) => `
              <article class="ultra-next-goal ultra-next-goal--${escapeHtml(goal.status)}">
                <b aria-hidden="true"></b>
                <div>
                  <strong>${escapeHtml(goal.title)}</strong>
                  <p>${escapeHtml(goal.text)}</p>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function buildCoachInterpretationHtml(item) {
  return `
    <article>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `;
}

function buildExecutiveSummaryHtml(summary) {
  return `
    <article class="premium-executive-card premium-executive-card--${escapeHtml(summary.status)}">
      <div class="premium-score-ring" style="--score: ${summary.score}">
        <strong>${escapeHtml(summary.score)}</strong>
        <span>/100</span>
      </div>
      <div>
        <p class="section-kicker">Genel Vücut Kompozisyon Durumu</p>
        <h2>${escapeHtml(summary.compositionStatus)}</h2>
        <div class="premium-risk-badge premium-risk-badge--${escapeHtml(summary.status)}">${escapeHtml(summary.riskLevel)}</div>
      </div>
      <div class="premium-summary-columns">
        <div>
          <strong>Güçlü yönler</strong>
          <ul>${summary.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div>
          <strong>Geliştirilmesi gereken alanlar</strong>
          <ul>${summary.focusAreas.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </div>
    </article>
  `;
}

function buildPremiumScoreCardHtml(card) {
  return `
    <article class="premium-score-card premium-score-card--${escapeHtml(card.status)}">
      <span>${escapeHtml(card.title)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <em>${escapeHtml(card.statusLabel || "Takip")}</em>
      <p>${escapeHtml(card.text)}</p>
    </article>
  `;
}

function buildTrendChartHtml(chart) {
  const deltaText = chart.delta === "" ? "-" : `${chart.delta > 0 ? "+" : ""}${formatReportValue(chart.delta, chart.unit)}`;
  const lineHtml = chart.svgPoints
    ? `
      <svg class="ultra-trend-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(chart.label)} trend grafiği">
        <polygon points="${escapeHtml(chart.areaPoints)}"></polygon>
        <polyline points="${escapeHtml(chart.svgPoints)}"></polyline>
        ${chart.points
          .filter((point) => point.value !== "")
          .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="2.3"></circle>`)
          .join("")}
      </svg>
    `
    : `<div class="ultra-trend-empty">Trend için veri yok</div>`;

  return `
    <article class="measurement-trend-card ultra-trend-card ultra-trend-card--${escapeHtml(chart.status)}">
      <div class="ultra-trend-card__head">
        <strong>${escapeHtml(chart.label)}</strong>
        <em>${escapeHtml(deltaText)}</em>
      </div>
      ${lineHtml}
      <div class="ultra-trend-card__meta">
        <span>İlk: ${escapeHtml(formatReportValue(chart.firstValue, chart.unit))}</span>
        <span>Son: ${escapeHtml(formatReportValue(chart.latestValue, chart.unit))}</span>
      </div>
      <p>${escapeHtml(chart.interpretation)}</p>
    </article>
  `;
}

function buildHistoryRowHtml(row) {
  return `
    <div class="premium-history-row">
      <span>${escapeHtml(row.date)}</span>
      <strong>${escapeHtml(formatHistoryValueWithDelta(row.weight, row.weightDelta, "kg"))}</strong>
      <strong>${escapeHtml(formatHistoryValueWithDelta(row.fatMass, row.fatMassDelta, "kg"))}</strong>
      <strong>${escapeHtml(formatHistoryValueWithDelta(row.fat, row.fatDelta, "%"))}</strong>
      <strong>${escapeHtml(formatHistoryValueWithDelta(row.muscleMass, row.muscleMassDelta, "kg"))}</strong>
      <strong>${escapeHtml(formatHistoryValueWithDelta(row.bodyWaterKg, row.bodyWaterDelta, "kg"))}</strong>
      <strong>${escapeHtml(formatHistoryValueWithDelta(row.bmi, row.bmiDelta, ""))}</strong>
    </div>
  `;
}

function buildDifferenceRowHtml(row) {
  const deltaText = row.delta === "" ? "-" : `${row.delta > 0 ? "+" : ""}${formatReportValue(row.delta, row.unit)}`;
  return `
    <div class="measurement-difference-row measurement-difference-row--${escapeHtml(row.direction)}">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(formatReportValue(row.previous, row.unit))}</strong>
      <strong>${escapeHtml(formatReportValue(row.current, row.unit))}</strong>
      <em>${escapeHtml(deltaText)}</em>
    </div>
  `;
}

function evaluateBmi(value) {
  if (value < 18.5) return { status: "warning", statusLabel: "Düşük" };
  if (value < 25) return { status: "normal", statusLabel: "Normal" };
  if (value < 30) return { status: "warning", statusLabel: "Takip" };
  return { status: "risk", statusLabel: "Yüksek" };
}

function evaluateBodyFat(value, gender) {
  const isMale = normalizeText(gender).includes("bay") || normalizeText(gender).includes("erkek") || normalizeText(gender).includes("male");
  const normalMax = isMale ? 20 : 28;
  const warningMax = isMale ? 25 : 34;
  if (value <= normalMax) return { status: "normal", statusLabel: "Normal" };
  if (value <= warningMax) return { status: "warning", statusLabel: "Takip" };
  return { status: "risk", statusLabel: "Yüksek" };
}

function evaluateVisceralFat(value) {
  if (value <= 9) return { status: "normal", statusLabel: "Normal" };
  if (value <= 12) return { status: "warning", statusLabel: "Takip" };
  return { status: "risk", statusLabel: "Yüksek" };
}

function evaluateMetabolicAge(value, age) {
  const realAge = measurementValue(age);
  if (realAge === "") return { status: "neutral", statusLabel: "Takip" };
  if (value <= realAge) return { status: "normal", statusLabel: "İyi" };
  if (value <= realAge + 5) return { status: "warning", statusLabel: "Takip" };
  return { status: "risk", statusLabel: "Yüksek" };
}

function evaluateBodyWater(value) {
  if (value >= 50 && value <= 65) return { status: "normal", statusLabel: "Normal" };
  if ((value >= 45 && value < 50) || (value > 65 && value <= 70)) return { status: "warning", statusLabel: "Takip" };
  return { status: "risk", statusLabel: "Dikkat" };
}

function evaluateWhr(value, gender) {
  const isMale = normalizeText(gender).includes("bay") || normalizeText(gender).includes("erkek") || normalizeText(gender).includes("male");
  const normalMax = isMale ? 0.9 : 0.85;
  const warningMax = isMale ? 1 : 0.95;
  if (value <= normalMax) return { status: "normal", statusLabel: "Normal" };
  if (value <= warningMax) return { status: "warning", statusLabel: "Takip" };
  return { status: "risk", statusLabel: "Yüksek" };
}

function evaluateMuscleMass(muscleMass, weight) {
  const muscle = measurementValue(muscleMass);
  const bodyWeight = measurementValue(weight);

  if (muscle === "" || !bodyWeight) {
    return { status: "neutral", statusLabel: "Veri yok" };
  }

  const ratio = (muscle / bodyWeight) * 100;

  if (ratio >= 42) {
    return { status: "normal", statusLabel: "Güçlü" };
  }

  if (ratio >= 36) {
    return { status: "warning", statusLabel: "Takip" };
  }

  return { status: "risk", statusLabel: "Düşük" };
}

function resolveWeightStatus(weight, height) {
  const bodyWeight = measurementValue(weight);
  const bmi = calculateBmiFromWeightHeight(weight, height);

  if (bodyWeight === "" || bmi === "") {
    return { status: "neutral", statusLabel: "Veri yok" };
  }

  return evaluateBmi(bmi);
}

function calculateBmiFromWeightHeight(weight, height) {
  const bodyWeight = measurementValue(weight);
  const bodyHeight = measurementValue(height);

  if (bodyWeight === "" || !bodyHeight) {
    return "";
  }

  const heightMeter = bodyHeight / 100;
  return roundReportNumber(bodyWeight / (heightMeter * heightMeter), 1);
}

function calculateIdealWeightRange(height) {
  const bodyHeight = measurementValue(height);

  if (!bodyHeight) {
    return null;
  }

  const heightMeter = bodyHeight / 100;
  return {
    min: roundReportNumber(18.5 * heightMeter * heightMeter, 1),
    max: roundReportNumber(24.9 * heightMeter * heightMeter, 1),
  };
}

function calculateBodyWaterKg(measurement) {
  const bodyWater = measurementValue(measurement.bodyWater);
  const weight = measurementValue(measurement.weight);

  if (bodyWater === "") {
    return "";
  }

  if (weight && bodyWater <= 100) {
    return roundReportNumber((weight * bodyWater) / 100);
  }

  return bodyWater;
}

function calculateWhr(measurement) {
  const waist = measurementValue(measurement.waist);
  const hip = measurementValue(measurement.hip);
  return waist && hip ? roundReportNumber(waist / hip, 2) : "";
}

function measurementValue(value) {
  if (value === "" || value === undefined || value === null || !Number.isFinite(Number(value))) {
    return "";
  }

  return Number(value);
}

function reportPercent(value, max) {
  if (value === "" || value === undefined || value === null || !Number.isFinite(Number(value))) {
    return 6;
  }

  return Math.max(6, Math.min(100, (Number(value) / Math.max(Number(max) || 1, 1)) * 100));
}

function roundReportNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) {
    return "";
  }

  return Number(Number(value).toFixed(digits));
}

function formatReportValue(value, unit) {
  const normalizedValue = measurementValue(value);

  if (normalizedValue === "") {
    return "-";
  }

  const formatted = Math.abs(normalizedValue) < 1 && unit === ""
    ? normalizedValue.toFixed(2).replace(".", ",")
    : Math.abs(normalizedValue) >= 100 || Number.isInteger(normalizedValue)
      ? String(normalizedValue)
      : normalizedValue.toFixed(1).replace(".", ",");
  return `${formatted}${unit ? " " + unit : ""}`;
}

function formatReportValueText(value, unit) {
  const normalizedValue = measurementValue(value);
  return normalizedValue === "" ? "Bu değer ölçüm dosyasında bulunamadı." : formatReportValue(normalizedValue, unit);
}

function formatHistoryValueWithDelta(value, delta, unit) {
  const mainValue = formatReportValue(value, unit);
  const normalizedDelta = measurementValue(delta);

  if (normalizedDelta === "") {
    return `${mainValue} / -`;
  }

  return `${mainValue} / ${normalizedDelta > 0 ? "+" : ""}${formatReportValue(normalizedDelta, unit)}`;
}

function formatReportDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const parsed = parseCalendarInputDate(dateValue);

  if (!parsed) {
    return String(dateValue);
  }

  return parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function syncMembersFromSupabase() {
  loadSupabaseMemberRecords()
    .then((supabaseMembers) => {
      if (!supabaseMembers.length) {
        return;
      }

      const mergedMembers = mergeMemberLists(state.members, supabaseMembers);

      if (!mergedMembers.length) {
        return;
      }

      state.activeMemberId = mergedMembers.some((member) => member.id === state.activeMemberId)
        ? state.activeMemberId
        : mergedMembers[0]?.id || null;
      saveActiveMemberId(state.activeMemberId);
      state.members = cacheMembersLocally(mergedMembers, state.activeMemberId);
      syncActiveMemberState();
      renderMemberWorkspace();
    })
    .catch((error) => {
      console.warn("Supabase members sync error", error);
    });
}

function bindApplicationHandlers() {
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
      coachQuickPanel,
      coachTaskPanel,
    },
    memberHandlers,
  );
  bindOutputHandlers(
    {
      copyPlanButton,
      printPlanButton,
      downloadBackupButton,
      restoreBackupButton,
      exportMembersCsvButton,
      restoreAutoBackupButton,
      backupFileInput,
    },
    outputHandlers,
  );
  bindNutritionHandlers(
    {
      generateNutritionButton,
      saveNutritionButton,
      printNutritionButton,
      nutritionPlanEditor,
    },
    nutritionHandlers,
  );
  addCustomExerciseButton?.addEventListener("click", handleAddCustomExercise);
  resetCustomExerciseFormButton?.addEventListener("click", clearCustomExerciseForm);
  restoreHiddenExercisesButton?.addEventListener("click", handleRestoreHiddenExercises);
  exerciseLibraryEl?.addEventListener("click", handleLibraryExerciseAction);
  customExerciseList?.addEventListener("click", handleLibraryExerciseAction);
  buildMeasurementReportButton?.addEventListener("click", handleBuildMeasurementReport);
  measurementReportBackButton?.addEventListener("click", handleMeasurementReportBack);
  measurementReportPdfButton?.addEventListener("click", handlePrintMeasurementReport);
  measurementReportPrintButton?.addEventListener("click", handlePrintMeasurementReport);
  document.addEventListener("click", handleExerciseGifModalClick);
  document.addEventListener("error", handleExerciseGifError, true);
  document.addEventListener("keydown", handleExerciseGifModalKeydown);
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


function setActiveScreen(screen, options = {}) {
  const { userTriggered = false, silent = false } = options;
  const normalized = ["dashboard", "builder", "nutrition", "library", "output", "measurement-report"].includes(screen) ? screen : "dashboard";

  if (normalized === "output" && !state.activeProgram) {
    if (userTriggered && !silent) {
      showStatus("Çıktı ekranı için önce üye programı oluşturun.", "error");
    }
    return false;
  }

  state.activeScreen = normalized;

  if (normalized === "measurement-report") {
    renderMeasurementReport();
  }

  screenPanels.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.screen !== normalized);
  });

  studioNav.querySelectorAll("button[data-screen-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.screenTarget === normalized);
  });

  const hashMap = {
    dashboard: "#dashboardPanel",
    builder: "#plannerForm",
    nutrition: "#nutritionPanel",
    library: "#libraryPanel",
    output: "#resultsSection",
    "measurement-report": "#measurementReportSection",
  };
  const nextHash = hashMap[normalized];

  if (nextHash && window.location.hash !== nextHash) {
    history.replaceState(null, "", nextHash);
  }

  return true;
}

function inferScreenFromHash(hashValue) {
  const hash = String(hashValue || "").toLowerCase();

  if (hash.includes("librarypanel")) {
    return "library";
  }

  if (hash.includes("nutritionpanel")) {
    return "nutrition";
  }

  if (hash.includes("resultssection")) {
    return "output";
  }

  if (hash.includes("measurementreportsection")) {
    return "measurement-report";
  }

  if (hash.includes("plannerform") || hash.includes("member") || hash.includes("measurement")) {
    return "builder";
  }

  return "dashboard";
}


function setWorkspaceView(view) {
  const normalized = ["members", "measurements", "history", "v3"].includes(view) ? view : "members";
  state.activeWorkspaceView = normalized;

  workspacePanels.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.workspacePanel !== normalized);
  });

  workspaceTabs.querySelectorAll("button[data-workspace-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.workspaceView === normalized);
  });
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
    trainerName: String(formData.get("trainerName") || "").trim(),
    goal: String(formData.get("goal") || ""),
    level: String(formData.get("level") || ""),
    programStyle: normalizeProgramStyleValue(String(formData.get("programStyle") || "auto")),
    trainingSystem: normalizeTrainingSystem(String(formData.get("trainingSystem") || "standard")),
    equipmentScope: String(formData.get("equipmentScope") || "full-gym"),
    duration: Number(formData.get("duration") || 60),
    priorityMuscle: String(formData.get("priorityMuscle") || "balanced"),
    cardioPreference: String(formData.get("cardioPreference") || "balanced"),
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
  form.querySelector("#trainerName").value = data.trainerName || "";
  form.querySelector("#goal").value = data.goal || "";
  form.querySelector("#level").value = data.level || "";
  form.querySelector("#programStyle").value = normalizeProgramStyleValue(data.programStyle || "auto");
  form.querySelector("#trainingSystem").value = normalizeTrainingSystem(data.trainingSystem || "standard");
  form.querySelector("#equipmentScope").value = data.equipmentScope || (data.location === "gym" ? "full-gym" : "standard-gym");
  form.querySelector("#duration").value = String(data.duration || 60);
  form.querySelector("#priorityMuscle").value = data.priorityMuscle || "balanced";
  form.querySelector("#notes").value = data.notes || "";

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
      showStatus("Programı geçmişe kaydetmek için önce üye adı veya üye no girin.", "error");
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

  member.profile = profile;
  member.updatedAt = now;
  state.activeMemberId = member.id;
  state.activeMember = member;
  state.latestMeasurement = member.measurements?.[0] || state.latestMeasurement || null;
  saveActiveMemberId(member.id);
  persistMembers();
  renderMemberWorkspace();
  return member;
}

function loadMember(member) {
  state.activeMemberId = member.id;
  state.activeMember = member;
  state.latestMeasurement = member.measurements?.[0] || null;
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

function renderMemberWorkspace() {
  renderDashboard();
  renderWorkspacePanels();
  renderNutritionWorkspace();
  renderNutritionOutput();
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
    },
    {
      memberCount: state.members.length,
      programCount: totalPrograms,
      measurementCount: totalMeasurements,
      activeMemberName: activeMember?.profile?.memberName || "Seçilmedi",
      activeMemberMeta: activeMember
        ? `${activeMember.profile?.memberCode || "Üye no yok"} • ${labelMaps.goal[activeMember.profile?.goal] || "Hedef yok"}`
        : "Üye seçerek profil panelini açın",
      riskMemberCount: Math.max(automationSummary.riskMemberCount || 0, analysisRiskMemberCount),
      measurementDueCount: automationSummary.measurementDueCount || 0,
      programDueCount: automationSummary.programUpdateDueCount || 0,
      last7ActivityCount: automationSummary.last7DaysActivityCount || 0,
    },
  );
  renderDashboardActivityUi(dashboardActivity, latestItems.slice(0, 5), escapeHtml);
  renderCoachAlertsPanel(automationSummary, activeMember);
  renderV3DashboardCalendar(automationSummary);
  renderCoachTaskPanel(automationSummary);
  renderCoachQuickPanel(activeMember);
  renderBackupMeta();
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
    memberName: activeMember?.profile?.memberName || "Aktif üye",
  }));
  const automationAlerts = (automationSummary.records || []).slice(0, 5);
  const alerts = [...activeAlerts, ...automationAlerts]
    .filter((alert, index, list) => list.findIndex((item) => `${item.memberName}-${item.type}-${item.title}` === `${alert.memberName}-${alert.type}-${alert.title}`) === index)
    .slice(0, 5);
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

  const tasks = buildCoachTasks(automationSummary).slice(0, 6);
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
  const measurementRecords = member?.measurements || [];

  if (!member) {
    renderBodyAnalysisReportUi(bodyAnalysisReport, null, escapeHtml);
    renderMeasurementHistoryUi(measurementHistory, null, escapeHtml);
    return;
  }

  renderBodyAnalysisReport(measurementRecords, member);
  renderMeasurementHistoryUi(
    measurementHistory,
    {
      items: measurementRecords.slice(0, 6).map((item) => ({
        date: item.date,
        line: formatMeasurementLine(item),
        segmentLine: formatSegmentLine(item.segments),
        resistanceLine: formatResistanceLine(item.resistance),
        note: item.note || "",
      })),
    },
    escapeHtml,
  );
}

function renderProgramHistory() {
  const member = findActiveMember();
  const programRecords = member?.programs || [];

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
  if (!measurements.length) {
    renderBodyAnalysisReportUi(bodyAnalysisReport, null, escapeHtml);
    return;
  }

  const latest = measurements[0];
  const previous = measurements[1] || null;
  const analysis = getMemberAnalysis(member);
  const evaluation = analysis
    ? {
        score: analysis.score,
        summary: analysis.summary,
        tags: analysis.tags || [],
        notes: analysis.notes || [],
      }
    : buildBodyAnalysisEvaluation(latest, previous, member);

  renderBodyAnalysisReportUi(
    bodyAnalysisReport,
    {
      score: evaluation.score,
      summary: evaluation.summary,
      tags: evaluation.tags || [],
      focusText: analysis ? (analysis.focusAreas || []).join(" \u2022 ") || "D\u00fczenli \u00f6l\u00e7\u00fcm ve program takibi." : "",
      notes: evaluation.notes || [],
      metrics: buildAnalysisMetricModel(latest, previous),
      resistanceItems: buildResistanceDistributionModel(latest, previous),
    },
    escapeHtml,
  );
}

function buildAnalysisMetricModel(latest, previous) {
  const bmi = calculateBmi(latest);
  return [
    {
      label: "Kilo",
      value: formatMetricValue(latest.weight, "kg"),
      delta: formatDelta(latest.weight, previous?.weight, "kg", true),
      percent: percentage(latest.weight, 140),
    },
    {
      label: "Ya\u011f Oran\u0131",
      value: formatMetricValue(latest.fat, "%"),
      delta: formatDelta(latest.fat, previous?.fat, "%", false),
      percent: percentage(latest.fat, 45),
    },
    {
      label: "Kas K\u00fctlesi",
      value: formatMetricValue(latest.muscleMass, "kg"),
      delta: formatDelta(latest.muscleMass, previous?.muscleMass, "kg", true),
      percent: percentage(latest.muscleMass, Math.max(60, latest.weight || 60)),
    },
    {
      label: "Ya\u015f",
      value: formatMetricValue(latest.age, "ya\u015f"),
      delta: "",
      percent: percentage(latest.age, 100),
    },
    {
      label: "Metabolizma H\u0131z\u0131",
      value: formatMetricValue(latest.bmr, "kcal"),
      delta: formatDelta(latest.bmr, previous?.bmr, "kcal", true),
      percent: percentage(latest.bmr, 2800),
    },
    {
      label: "Metabolizma Ya\u015f\u0131",
      value: formatMetricValue(latest.metabolicAge, "ya\u015f"),
      delta: formatDelta(latest.metabolicAge, previous?.metabolicAge, "ya\u015f", false),
      percent: percentage(latest.metabolicAge, 80),
    },
    {
      label: "Kemik K\u00fctlesi",
      value: formatMetricValue(latest.boneMass, "kg"),
      delta: formatDelta(latest.boneMass, previous?.boneMass, "kg", true),
      percent: percentage(latest.boneMass, 5),
    },
    {
      label: "Visceral Ya\u011f",
      value: formatMetricValue(latest.visceralFat, ""),
      delta: formatDelta(latest.visceralFat, previous?.visceralFat, "", false),
      percent: percentage(latest.visceralFat, 20),
    },
    {
      label: "BMI",
      value: bmi ? bmi.toFixed(1) : "Veri yok",
      delta: "",
      percent: percentage(bmi, 35),
    },
  ];
}

function buildResistanceDistributionModel(latest, previous) {
  const labels = [
    { key: "rightArmResistance", label: "Sa\u011f kol" },
    { key: "leftArmResistance", label: "Sol kol" },
    { key: "trunkResistance", label: "G\u00f6vde" },
    { key: "rightLegResistance", label: "Sa\u011f bacak" },
    { key: "leftLegResistance", label: "Sol bacak" },
  ];
  const resistanceValues = latest.resistance || {};
  const visibleItems = labels.filter(({ key }) => resistanceValues[key] !== "" && resistanceValues[key] !== undefined);

  if (!visibleItems.length) {
    return [];
  }

  const numericValues = visibleItems
    .map(({ key }) => Number(resistanceValues[key]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const maxValue = numericValues.length ? Math.max(...numericValues) : 1;

  return visibleItems.map(({ key, label }) => {
    const value = Number(resistanceValues[key]);
    return {
      label,
      valueLabel: `${Math.round(value)} ohm`,
      deltaLabel: formatTrendDelta(value, previous?.resistance?.[key], "ohm") || "\u0130lk \u00f6l\u00e7\u00fcm",
      barWidth: Math.max(8, Math.min(100, (value / maxValue) * 100)),
    };
  });
}

function buildBodyAnalysisEvaluation(latest, previous, member) {
  let score = 74;
  const notes = [];
  const tags = [];
  const goal = member?.profile?.goal;
  const bmi = calculateBmi(latest);
  const muscleRatio = latest.weight && latest.muscleMass ? (latest.muscleMass / latest.weight) * 100 : null;
  const segmentBalance = analyzeSegmentBalance(latest.segments || {});
  const resistanceBalance = analyzeResistanceBalance(latest.resistance || {});

  if (latest.fat !== "" && latest.fat !== undefined) {
    if (latest.fat >= 30) {
      score -= 10;
      notes.push({ level: "warning", title: "Yağ oranı yüksek", text: "Yağ oranı hedefe göre yüksek görünüyor. Kuvvet antrenmanı korunurken kardiyo ve beslenme takibi güçlendirilmeli." });
    } else if (latest.fat <= 22) {
      score += 6;
      notes.push({ level: "good", title: "Yağ oranı kontrollü", text: "Yağ oranı genel sağlık ve performans hedefleri için kontrollü aralıkta görünüyor." });
    }
  }

  if (latest.visceralFat !== "" && latest.visceralFat !== undefined) {
    if (latest.visceralFat >= 13) {
      score -= 12;
      notes.push({ level: "warning", title: "Visceral yağ uyarısı", text: "Visceral yağ değeri dikkat gerektiriyor. Düzenli kardiyo, günlük aktivite ve beslenme planı önceliklendirilmeli." });
    } else if (latest.visceralFat <= 9) {
      score += 5;
      tags.push("Visceral yağ kontrollü");
    }
  }

  if (latest.bodyWater !== "" && latest.bodyWater !== undefined) {
    if (latest.bodyWater < 45) {
      score -= 5;
      notes.push({ level: "info", title: "Vücut suyu düşük olabilir", text: "Vücut suyu oranı düşük görünüyor. Ölçüm öncesi hidrasyon ve günlük su tüketimi takip edilmeli." });
    } else if (latest.bodyWater >= 50 && latest.bodyWater <= 65) {
      score += 4;
      tags.push("Sıvı dengesi iyi");
    }
  }

  if (muscleRatio !== null) {
    if (muscleRatio >= 42) {
      score += 7;
      tags.push("Kas oranı güçlü");
    } else if (muscleRatio < 32) {
      score -= 7;
      notes.push({ level: "info", title: "Kas kütlesi geliştirilebilir", text: "Kas kütlesi oranı geliştirilebilir. Programda ana direnç hareketleri ve progresif yüklenme korunmalı." });
    }
  }

  if (latest.boneMass !== "" && latest.boneMass !== undefined) {
    if (latest.boneMass < 2.2) {
      score -= 4;
      notes.push({ level: "info", title: "Kemik kütlesi takip edilmeli", text: "Kemik kütlesi düşük görünüyor. Direnç egzersizleri, düzenli takip ve gerekirse uzman yönlendirmesi önerilir." });
    } else {
      tags.push("Kemik kg takipte");
    }
  }

  if (bmi) {
    if (bmi >= 30) {
      score -= 8;
      notes.push({ level: "warning", title: "BMI yüksek", text: "BMI yüksek aralıkta. Yağ oranı ve bel çevresiyle birlikte takip edilmelidir." });
    } else if (bmi >= 18.5 && bmi < 25) {
      score += 4;
      tags.push("BMI normal aralıkta");
    }
  }

  if (previous) {
    const fatDelta = numericDelta(latest.fat, previous.fat);
    const muscleDelta = numericDelta(latest.muscleMass, previous.muscleMass);
    const waistDelta = numericDelta(latest.waist, previous.waist);

    if (fatDelta < 0) {
      score += 4;
      tags.push("Yağ oranı düşüşte");
    }

    if (muscleDelta > 0) {
      score += 5;
      tags.push("Kas kütlesi artışta");
    }

    if (waistDelta < 0) {
      score += 3;
      tags.push("Bel çevresi iyileşiyor");
    }
  }

  if (segmentBalance.warning) {
    score -= 5;
    notes.push({ level: "info", title: "Segmental denge farkı", text: segmentBalance.text });
  } else if (segmentBalance.text) {
    score += 3;
    tags.push("Segmental denge iyi");
  }

  if (resistanceBalance.warning) {
    score -= 4;
    notes.push({ level: "info", title: "Segmental kas direnci farkı", text: resistanceBalance.text });
  } else if (resistanceBalance.text) {
    score += 2;
      tags.push("Direnç dağılımı dengeli");
  }

  if (!notes.length) {
    notes.push({ level: "good", title: "Genel tablo dengeli", text: "Girilen ölçümlere göre genel tablo dengeli görünüyor. Mevcut program düzenli takip ile sürdürülebilir." });
  }

  if (!tags.length) {
    tags.push("Takip başlangıcı");
  }

  if (goal === "fat-loss") {
    tags.push("Yağ yakımı hedefi");
  } else if (goal === "muscle-gain") {
    tags.push("Kas kazanımı hedefi");
  }

  score = Math.max(35, Math.min(96, Math.round(score)));

  return {
    score,
    tags,
    notes,
    summary:
      score >= 85
        ? "Genel sonuçlar güçlü görünüyor. Mevcut program korunabilir; küçük performans artışları ve düzenli ölçüm takibi yeterli olacaktır."
        : score >= 70
          ? "Genel tablo takip edilebilir ve geliştirilebilir seviyede. Programda direnç egzersizleri, kardiyo ve ölçüm trendleri birlikte izlenmeli."
          : "Ölçüm sonuçları daha yakın takip gerektiriyor. Program, beslenme ve toparlanma planı antrenör tarafından kontrollü şekilde güncellenmeli.",
  };
}

function analyzeSegmentBalance(segments) {
  const armDiff = segmentDiffPercent(segments.rightArmMuscle, segments.leftArmMuscle);
  const legDiff = segmentDiffPercent(segments.rightLegMuscle, segments.leftLegMuscle);
  const warnings = [];

  if (armDiff !== null && armDiff >= 8) {
    warnings.push(`kol kas dağılımında yaklaşık %${armDiff.toFixed(1)} fark`);
  }

  if (legDiff !== null && legDiff >= 8) {
    warnings.push(`bacak kas dağılımında yaklaşık %${legDiff.toFixed(1)} fark`);
  }

  if (warnings.length) {
    return {
      warning: true,
      text: `${warnings.join(" ve ")} görünüyor. Tek taraflı kuvvet çalışmaları ve teknik kontrol eklenmeli.`,
    };
  }

  if (armDiff !== null || legDiff !== null) {
    return { warning: false, text: "Sağ-sol segmental kas dağılımı kabul edilebilir dengede görünüyor." };
  }

  return { warning: false, text: "" };
}

function analyzeResistanceBalance(resistance) {
  const armDiff = segmentDiffPercent(resistance.rightArmResistance, resistance.leftArmResistance);
  const legDiff = segmentDiffPercent(resistance.rightLegResistance, resistance.leftLegResistance);
  const warnings = [];

  if (armDiff !== null && armDiff >= 10) {
    warnings.push(`kol direnç dağılımında yaklaşık %${armDiff.toFixed(1)} fark`);
  }

  if (legDiff !== null && legDiff >= 10) {
    warnings.push(`bacak direnç dağılımında yaklaşık %${legDiff.toFixed(1)} fark`);
  }

  if (warnings.length) {
    return {
      warning: true,
      text: `${warnings.join(" ve ")} görünüyor. Tek taraflı kuvvet çalışmaları ile dengeleyici egzersizler planlanmalı.`,
    };
  }

  if (armDiff !== null || legDiff !== null) {
    return { warning: false, text: "Sağ-sol kas direnci dağılımı dengeli görünüyor." };
  }

  return { warning: false, text: "" };
}

function segmentDiffPercent(a, b) {
  if (a === "" || b === "" || a === undefined || b === undefined || Number(a) === 0 || Number(b) === 0) {
    return null;
  }

  const max = Math.max(Number(a), Number(b));
  const min = Math.min(Number(a), Number(b));
  return ((max - min) / max) * 100;
}

function calculateBmi(measurement) {
  if (measurement.bmi !== "" && measurement.bmi !== undefined && measurement.bmi !== null) {
    return Number(measurement.bmi);
  }

  if (!measurement.weight || !measurement.height) {
    return null;
  }

  const heightMeter = Number(measurement.height) / 100;
  return Number(measurement.weight) / (heightMeter * heightMeter);
}

function formatMetricValue(value, unit) {
  if (value === "" || value === undefined || value === null) {
    return "Veri yok";
  }

  return `${value}${unit ? " " + unit : ""}`;
}

function formatDelta(current, previous, unit, higherIsGood) {
  const delta = numericDelta(current, previous);

  if (delta === null || delta === 0) {
    return "";
  }

  const direction = delta > 0 ? "+" : "";
  const label = higherIsGood ? (delta > 0 ? "iyileşme" : "düşüş") : delta < 0 ? "iyileşme" : "artış";
  return `${direction}${delta.toFixed(1)}${unit ? " " + unit : ""} ${label}`;
}

function formatTrendDelta(current, previous, unit) {
  const delta = numericDelta(current, previous);

  if (delta === null || delta === 0) {
    return "";
  }

  const direction = delta > 0 ? "+" : "";
  const roundedDelta = Math.abs(delta) >= 10 ? delta.toFixed(0) : delta.toFixed(1);
  return `Değişim: ${direction}${roundedDelta}${unit ? " " + unit : ""}`;
}

function numericDelta(current, previous) {
  if (current === "" || previous === "" || current === undefined || previous === undefined) {
    return null;
  }

  return Number(current) - Number(previous);
}

function percentage(value, max) {
  if (value === "" || value === undefined || value === null || !Number.isFinite(Number(value))) {
    return 0;
  }

  return Math.max(4, Math.min(100, (Number(value) / max) * 100));
}

function readMeasurementForm() {
  const birthDateParts = readBirthDateParts();
  const calculatedAge = calculateAgeFromBirthDate(birthDateParts, measurementDate.value || getTodayInputValue());
  const measurement = {
    id: makeId("measurement"),
    createdAtIso: new Date().toISOString(),
    date: measurementDate.value || getTodayInputValue(),
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
    waist: numberOrEmpty(measurementWaist.value),
    hip: numberOrEmpty(measurementHip.value),
    chest: numberOrEmpty(measurementChest.value),
    segments: Object.fromEntries(Object.entries(segmentInputs).map(([key, input]) => [key, numberOrEmpty(input.value)])),
    resistance: Object.fromEntries(Object.entries(segmentResistanceInputs).map(([key, input]) => [key, numberOrEmpty(input.value)])),
    note: measurementNote.value.trim(),
  };

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
      "bodyWater",
      "visceralFat",
      "bmr",
      "metabolicAge",
      "boneMass",
      "waist",
      "hip",
      "chest",
    ].some(
      (key) => measurement[key] !== "",
    ) ||
    Object.values(measurement.segments).some((value) => value !== "") ||
    Object.values(measurement.resistance).some((value) => value !== "") ||
    measurement.note;
  return hasValue ? measurement : null;
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
  measurementNote.value = "";
}

function applyTanitaMeasurementToForm(measurement) {
  const source = measurement && typeof measurement === "object" ? measurement : {};

  setInputValue(measurementDate, source.date);
  setInputValue(measurementWeight, source.weight);
  setInputValue(measurementHeight, source.height);
  setInputValue(measurementBmi, source.bmi);
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

  Object.entries(source.segments || {}).forEach(([key, value]) => {
    setInputValue(segmentInputs[key], value);
  });

  Object.entries(source.resistance || {}).forEach(([key, value]) => {
    setInputValue(segmentResistanceInputs[key], value);
  });

  if (measurementNote && !measurementNote.value.trim() && source.note) {
    setInputValue(measurementNote, source.note);
  }

  dispatchMeasurementInputEvents();
  console.log("TANITA DATA APPLIED TO FORM");
}

function applyMeasurementToAppState(measurement) {
  const normalizedMeasurement = normalizeMeasurementPayload(measurement);
  const member = upsertMemberFromCurrentForm({ silent: true });
  state.latestMeasurement = normalizedMeasurement;

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
  const programWasRefreshed = refreshActiveProgramFromMeasurement(formData);

  renderLiveSummary(formData);
  refreshNutritionPlanFromMeasurement(activeMember || state.activeMember);
  renderMemberWorkspace();

  if (!programWasRefreshed) {
    renderNutritionOutput();
  }

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
    waist: measurement.waist,
    hip: measurement.hip,
    chest: measurement.chest,
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
  return findActiveMemberRecord(state.members, state.activeMemberId);
}

function syncActiveMemberState() {
  const activeMember = findActiveMember();
  state.activeMember = activeMember || null;
  state.latestMeasurement = activeMember?.measurements?.[0] || null;
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
    v3Insights,
    programContext: planContext,
    rawData: data,
  });
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
  return buildProgramMemberRecordService(data, findActiveMember(), {
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
  renderOutputIntelligence(state.activeProgram);
  renderNutritionOutput();
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
      nutritionMemberSummary,
      nutritionPlanEditor,
    },
    {
      member: activeMember,
      plan: state.activeNutritionPlan || memberPlan,
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
  (program?.sessions || []).forEach((session) => {
    (session.exercises || []).forEach((exercise) => {
      const parts = splitProgramPrescription(exercise.prescription);
      exercise.sets = exercise.sets || normalizeEditableSet(parts.sets);
      exercise.reps = exercise.reps || String(parts.reps || "").trim() || "8-12";
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

  if (field === "sets" || field === "reps") {
    exercise[field] = String(value || "").trim();
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
  exercise.prescription = `${exercise.sets} set x ${exercise.reps}`;
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

    if (programField === "exerciseId" || programField === "group") {
      return;
    }

    const sessionIndex = Number(field.dataset.sessionIndex);
    const exerciseIndex = Number(field.dataset.exerciseIndex);
    const exercise = state.activeProgram.sessions?.[sessionIndex]?.exercises?.[exerciseIndex];

    if (exercise) {
      exercise[programField] = String(field.value || "").trim();

      if (programField === "sets" || programField === "reps") {
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
  const nutritionText = formatNutritionPlanForText(getNutritionPlanForOutput());

  return `${program.title}
Oluşturulma zamanı: ${program.createdAt}

ÜYE PROGRAM ÖZETİ
${overview}

HAFTALIK ANTRENMAN PLANI
${sessionText}${nutritionText ? `\n\nBESLENME PLANI\n${nutritionText}` : ""}`;
}

function formatNutritionPlanForText(plan) {
  if (!plan) {
    return "";
  }

  const meals = (plan.meals || [])
    .map((meal) => `- ${meal.name}: ${meal.foods} | ${meal.calories} kcal | P ${meal.protein} / K ${meal.carbs} / Y ${meal.fat}`)
    .join("\n");
  const supplements = (plan.supplements || []).length
    ? `\nSupplement tercihi:\n${plan.supplements.map((item) => `- ${item.name}: ${item.purpose} Alternatif: ${item.foodAlternative}`).join("\n")}`
    : "";

  return `Üye: ${plan.memberName}
Hedef: ${labelMaps.goal[plan.goal] || plan.goal}
Günlük kalori: ${plan.calories} kcal
Makrolar: Protein ${plan.macros?.protein} g | Karbonhidrat ${plan.macros?.carbs} g | Yağ ${plan.macros?.fat} g
${meals}${supplements}
Antrenör notu: ${plan.trainerNote || "-"}
Not: ${plan.disclaimer || ""}`;
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
}

function showStatus(message, state) {
  formStatus.textContent = message;
  formStatus.dataset.state = state;
}
