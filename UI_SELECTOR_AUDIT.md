# BSM Panel UI Selector Audit

UI-only refactor, logic preserved.

Bu dosya, tasarım düzenlemelerinde korunması gereken kritik JavaScript seçicilerini özetler. Bu değerler yeniden adlandırılmamalı, kaldırılmamalı veya JS bağlantısı kopacak şekilde taşınmamalıdır.

## Ekran ve Navigasyon Seçicileri

- `data-screen-target`: `dashboard`, `builder`, `nutrition`, `library`, `output`
- `data-screen`: `dashboard`, `builder`, `nutrition`, `library`, `output`, `measurement-report`
- `data-workspace-view`: `members`, `measurements`, `history`, `v3`
- `data-workspace-panel`: `members`, `measurements`, `history`, `v3`

## Ana Form ID ve Name Seçicileri

- `#plannerForm`, `#formStatus`, `#liveSummary`
- `#gymName`, `#memberName`, `#memberCode`, `#trainerName`
- `#goal`, `#level`, `#programStyle`, `#trainingSystem`, `#equipmentScope`, `#duration`, `#priorityMuscle`, `#notes`
- `name="days"`, `name="restrictions"`, `name="cardioPreference"`
- `#fillExampleButton`, `#loadSavedButton`, `#newMemberButton`, `#saveMemberButton`

## Üye, Dashboard ve Workspace Seçicileri

- `#dashboardPanel`, `#dashboardToday`, `#dashboardMemberCount`, `#dashboardProgramCount`, `#dashboardMeasurementCount`
- `#dashboardActiveMember`, `#dashboardActiveMemberMeta`, `#dashboardRiskMemberCount`, `#dashboardMeasurementDueCount`
- `#dashboardProgramDueCount`, `#dashboardLast7ActivityCount`, `#dashboardActivity`
- `#coachAlertsPanel`, `#coachTaskPanel`, `#v3DashboardCalendar`, `#coachQuickPanel`
- `#workspaceTabs`, `#memberSearch`, `#memberSort`, `#memberList`, `#memberCount`
- `#activeMemberProfile`, `#measurementHistory`, `#programHistory`
- `data-action="load-member"`, `data-member-id`, `data-program-id`

## Ölçüm ve Tanita CSV Seçicileri

- `#tanitaCsvButton`, `#tanitaCsvInput`, `#tanitaImportStatus`, `#tanitaPreview`, `#saveTanitaMeasurementButton`
- `#buildMeasurementReportButton`, `#measurementReportSection`, `#measurementReportContent`
- `#measurementReportBackButton`, `#measurementReportPdfButton`, `#measurementReportPrintButton`
- `#saveMeasurementButton`, `#bodyAnalysisReport`
- `#measurementDate`, `#measurementWeight`, `#measurementHeight`, `#measurementBmi`
- `#measurementBirthDay`, `#measurementBirthMonth`, `#measurementBirthYear`
- `#measurementFat`, `#measurementMuscleMass`, `#measurementFatMass`, `#measurementBodyWater`
- `#measurementVisceralFat`, `#measurementBmr`, `#measurementMetabolicAge`, `#measurementBoneMass`
- `#measurementWaist`, `#measurementHip`, `#measurementChest`, `#measurementNote`
- `#segmentRightArmMuscle`, `#segmentLeftArmMuscle`, `#segmentTrunkMuscle`, `#segmentRightLegMuscle`, `#segmentLeftLegMuscle`
- `#segmentRightArmFat`, `#segmentLeftArmFat`, `#segmentTrunkFat`, `#segmentRightLegFat`, `#segmentLeftLegFat`
- `#segmentRightArmResistance`, `#segmentLeftArmResistance`, `#segmentTrunkResistance`, `#segmentRightLegResistance`, `#segmentLeftLegResistance`

## Program Çıktısı ve Düzenleme Seçicileri

- `#resultsSection`, `#resultsTitle`, `#programOverview`, `#coachNote`, `#weeklyPlan`
- `#progressionPlan`, `#guidanceBlock`, `#muscleCoverage`, `#aiReportSummary`, `#nextControlReport`, `#outputWarnings`
- `#saveProgramButton`, `#copyPlanButton`, `#printPlanButton`
- `#programEditToolbar`, `#programEditStatus`, `#toggleProgramEditButton`, `#saveProgramEditsButton`, `#resetProgramEditsButton`
- `data-program-field`, `data-session-index`, `data-exercise-index`

## Beslenme Seçicileri

- `#nutritionPanel`, `#nutritionMemberSummary`, `#nutritionPlanEditor`, `#outputNutritionPlan`
- `#generateNutritionButton`, `#saveNutritionButton`, `#printNutritionButton`
- `#supplementUse`, `#caffeineSensitive`, `#lactoseSensitive`, `#supplementBudget`
- `#nutritionTrainerNoteInput`, `data-nutrition-field`, `data-meal-index`, `data-meal-field`

## Hareket Kütüphanesi ve GIF Seçicileri

- `#libraryPanel`, `#exerciseSearch`, `#libraryGroupFilter`, `#libraryEquipmentFilter`
- `#muscleGroupTabs`, `#alphabetTabs`, `#exerciseLibrary`, `#libraryCount`
- `#findExerciseButton`, `#clearExerciseSearchButton`
- `#customExerciseName`, `#customExerciseGroup`, `#customExerciseEquipment`, `#customExerciseKind`, `#customExerciseLevel`, `#customExerciseGifUrl`, `#customExerciseCue`
- `#addCustomExerciseButton`, `#resetCustomExerciseFormButton`, `#restoreHiddenExercisesButton`, `#customExerciseStatus`, `#customExerciseList`
- `#exerciseGifModal`, `#exerciseGifModalImage`, `#exerciseGifModalTitle`, `#exerciseGifModalGroup`
- `data-exercise-id`, `data-exercise-name`

## Yedekleme ve Aktarım Seçicileri

- `#downloadBackupButton`, `#restoreBackupButton`, `#exportMembersCsvButton`, `#restoreAutoBackupButton`, `#backupFileInput`, `#backupMeta`
