const {
  schemaVersion,
  storageKeys,
  normalizeFormPayload,
  normalizePlanPayload,
  normalizeMeasurementPayload,
  storeBackupSnapshot,
  loadBackupHistory,
  extractMembersFromBackup,
  normalizeImportedMembers,
} = window.BSMStorageService;

const {
  findActiveMember: findActiveMemberRecord,
  loadMembers: loadStoredMembers,
  persistMembers: persistStoredMembers,
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

const state = {
  members: [],
  activeMemberId: null,
  activeProgram: null,
  activeAlphabetLetter: "all",
  activeScreen: "dashboard",
  activeWorkspaceView: "members",
  activeMemberSort: "recent-update",
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
const { exerciseGroups, exerciseExpansionBlueprints, exerciseLibrary } = window.BSMExerciseData;
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
const { createFormHandlers, bindFormHandlers } = window.BSMFormHandlers;
const { createNavigationHandlers, bindNavigationHandlers } = window.BSMNavigationHandlers;
const { createMemberHandlers, bindMemberHandlers } = window.BSMMemberHandlers;
const { createOutputHandlers, bindOutputHandlers } = window.BSMOutputHandlers;
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
const studioNav = document.querySelector(".studio-nav");
const screenPanels = [...document.querySelectorAll("[data-screen]")];
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
const measurementDate = document.querySelector("#measurementDate");
const measurementWeight = document.querySelector("#measurementWeight");
const measurementHeight = document.querySelector("#measurementHeight");
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
  exerciseLibrary,
  buildPrescription,
  buildRest,
  buildTempo,
  buildExerciseBlocks,
  buildMuscleCoverage,
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
  syncStartupUi();
  bindApplicationHandlers();
  hydrateInitialSession();
  setActiveScreen(inferScreenFromHash(window.location.hash), { silent: true });
}

function initializeStateFromStorage() {
  state.members = loadMembers();
  state.activeMemberId = loadActiveMemberId();
  state.activeMemberSort = normalizeMemberSort(loadMemberSort());

  if (state.members.length && !loadBackupHistory().length) {
    storeBackupSnapshot(state.members, state.activeMemberId);
  }

  saveMemberSort(state.activeMemberSort);
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
      saveMeasurementButton,
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
    renderProgram(activeMember.programs[0].program);
  }

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
  });

  Object.entries(equipmentLabels).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    libraryEquipmentFilter.appendChild(option);
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
  const normalized = ["dashboard", "builder", "library", "output"].includes(screen) ? screen : "dashboard";

  if (normalized === "output" && !state.activeProgram) {
    if (userTriggered && !silent) {
      showStatus("Çıktı ekranı için önce üye programı oluşturun.", "error");
    }
    return false;
  }

  state.activeScreen = normalized;

  screenPanels.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.screen !== normalized);
  });

  studioNav.querySelectorAll("button[data-screen-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.screenTarget === normalized);
  });

  const hashMap = {
    dashboard: "#dashboardPanel",
    builder: "#plannerForm",
    library: "#libraryPanel",
    output: "#resultsSection",
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

  if (hash.includes("resultssection")) {
    return "output";
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
  const form = document.querySelector("form");
console.log("FORM:", form);
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
  saveActiveMemberId(member.id);
  persistMembers();
  renderMemberWorkspace();
  return member;
}

function loadMember(member) {
  state.activeMemberId = member.id;
  saveActiveMemberId(member.id);
  populateForm(member.profile || {});
  clearMeasurementInputs();
  measurementDate.value = getTodayInputValue();
  formHandlers.handleLiveUpdate();
  renderMemberWorkspace();
  setActiveScreen("builder", { silent: true });

  if (member.programs?.[0]?.program) {
    renderProgram(cloneData(member.programs[0].program));
  } else {
    resultsSection.classList.add("hidden");
    state.activeProgram = null;
  }

  showStatus(`${member.profile?.memberName || "Üye"} dosyası yüklendi.`, "success");
}

function renderMemberWorkspace() {
  renderDashboard();
  renderWorkspacePanels();
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

function loadMembers() {
  return loadStoredMembers();
}

function persistMembers() {
  state.members = persistStoredMembers(state.members, state.activeMemberId);
}

function updateActiveMemberProfile(profile) {
  const nextMembers = updateStoredActiveMemberProfile(state.members, state.activeMemberId, profile);

  if (!nextMembers) {
    return;
  }

  state.members = nextMembers;
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

function renderProgram(program) {
  state.activeProgram = cloneData(normalizePlanPayload(program));
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
    { sessions: state.activeProgram.sessions || [] },
    escapeHtml,
    {
      getMuscleLabel,
      equipmentLabels,
      exerciseLibrary,
    },
  );
  const programSectionsModel = buildProgramSectionsModelService(state.activeProgram, {
    getMuscleLabel,
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
  renderOutputIntelligence(state.activeProgram);
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

    if (programField === "exerciseId") {
      return;
    }

    const sessionIndex = Number(field.dataset.sessionIndex);
    const exerciseIndex = Number(field.dataset.exerciseIndex);
    const exercise = state.activeProgram.sessions?.[sessionIndex]?.exercises?.[exerciseIndex];

    if (exercise) {
      exercise[programField] = field.value;
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
          equipmentLabel: equipmentLabels[exercise.equipment],
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

function getFirstLetter(value) {
  const first = String(value || "").trim().charAt(0).toLocaleUpperCase("tr-TR");
  return turkishAlphabet.includes(first) ? first : first.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function convertProgramToText(program) {
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

    return `- ${exercise.name} | ${getMuscleLabel(exercise.group)} | ${exercise.prescription} | Dinlenme: ${exercise.rest} | Tempo: ${exercise.tempo} | ${exercise.cue}${alternatives}`;
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
