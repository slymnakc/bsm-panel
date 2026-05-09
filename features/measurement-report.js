(function () {
  "use strict";

  // Injected via init(config): findActiveMember, collectFormData, parseCalendarInputDate,
  // readMeasurementForm, segmentDiffPercent, getProgramStyleLabel, getTrainingSystemLabel, state
  var _cfg = {};
  var measurementReportContent = null;

  function init(config) {
    _cfg = config || {};
    measurementReportContent = document.querySelector("#measurementReportContent");
  }

  // ── External dependency wrappers ─────────────────────────────────────────────
  function normalizeMeasurementPayload(m) {
    return window.BSMStorageService.normalizeMeasurementPayload(m);
  }
  function escapeHtml(s) { return window.BSMCoreUtils.escapeHtml(s); }
  function normalizeText(s) { return window.BSMCoreUtils.normalizeText(s); }
  function findActiveMember() { return _cfg.findActiveMember && _cfg.findActiveMember(); }
  function collectFormData() { return _cfg.collectFormData && _cfg.collectFormData(); }
  function parseCalendarInputDate(v) { return _cfg.parseCalendarInputDate && _cfg.parseCalendarInputDate(v); }
  function readMeasurementForm() { return _cfg.readMeasurementForm && _cfg.readMeasurementForm(); }
  function segmentDiffPercent(a, b) { return _cfg.segmentDiffPercent && _cfg.segmentDiffPercent(a, b); }
  function getProgramStyleLabel(s) { return _cfg.getProgramStyleLabel && _cfg.getProgramStyleLabel(s); }
  function getTrainingSystemLabel(s) { return _cfg.getTrainingSystemLabel && _cfg.getTrainingSystemLabel(s); }

  // ── [Extracted from app.js — measurement report block] ───────────────────────
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

  var _state = _cfg.state || {};
  return latestMemberMeasurement || _state.latestMeasurement || _state.pendingTanitaMeasurement || formMeasurement || null;
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
  const { profile, measurement, bodyValues, segmentalAnalysis, impedanceValues, indicators, trends, summary, scoreCards, coachPlan, nextGoals } = model;
  const memberName = profile?.memberName || measurement.memberName || "Üye";
  const trainerName = profile?.trainerName || "Bahçeşehir Spor Merkezi";
  const measurementTime = measurement.time ? ` / ${measurement.time}` : "";
  const reportDateText = `${formatReportDate(measurement.date)}${measurementTime}`;
  const reportHeader = buildPremiumReportHeader(memberName, reportDateText);
  const compactBodyValues = getCompactBodyCompositionValues(bodyValues);
  const compactIndicators = getCompactHealthIndicators(indicators);
  const compactCoachPlan = getCompactCoachPlan(coachPlan);
  const compactGoals = getCompactNextGoals(nextGoals);

  return `
    <article class="report-page measurement-report-page measurement-report-page--executive measurement-report-page--compact measurement-report-page--ultra-cover">
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
      <section class="compact-report-section compact-report-section--composition">
        <div class="compact-section-title">
          <span>01</span>
          <div>
            <strong>Vücut kompozisyonu</strong>
            <small>Kilo, yağ, kas, sıvı ve kemik değerleri tek bakışta.</small>
          </div>
        </div>
        <div class="premium-reference-bars premium-reference-bars--compact">
          ${compactBodyValues.map(buildMeasurementBarHtml).join("")}
        </div>
      </section>
      ${buildPremiumReportFooter("Executive Summary")}
    </article>

    <article class="report-page measurement-report-page measurement-report-page--segmental measurement-report-page--compact">
      ${buildPremiumSectionHeader("02", "Segmental Analiz ve Sağlık Göstergeleri", "Kas/yağ dağılımı, sağ-sol farklar ve temel sağlık göstergeleri kompakt okunur.")}
      <div class="compact-segmental-layout">
        ${buildSegmentalSilhouetteHtml(segmentalAnalysis)}
        <div class="compact-segmental-stack">
          <div class="compact-segment-pair-grid">
            ${buildCompactSegmentPairCards(segmentalAnalysis)}
          </div>
          ${buildCompactSymmetryHtml(segmentalAnalysis.symmetryBars)}
        </div>
      </div>
      <section class="compact-health-layout">
        <div>
          <div class="compact-section-title">
            <span>02A</span>
            <div>
              <strong>Sağlık göstergeleri</strong>
              <small>BMI, yağ, visceral yağ, BMR, metabolizma yaşı ve su oranı.</small>
            </div>
          </div>
          <div class="premium-health-grid premium-health-grid--compact">
            ${compactIndicators.map(buildIndicatorHtml).join("")}
          </div>
        </div>
        <section class="premium-impedance-panel premium-impedance-panel--compact">
          <div class="measurement-report-card__title">
            <span>Ω</span>
            <h2>Direnç / Empedans</h2>
          </div>
          <div class="measurement-impedance-table">
            ${impedanceValues.map(([label, value]) => buildImpedanceRowHtml(label, value)).join("")}
          </div>
        </section>
      </section>
      ${buildPremiumReportFooter("Segmental + Sağlık")}
    </article>

    <article class="report-page measurement-report-page measurement-report-page--trend measurement-report-page--compact">
      ${buildPremiumSectionHeader("03", "Trend ve Koç Aksiyon Planı", trends.hasTrend ? "Kilo, yağ oranı ve kas kütlesi değişimi aksiyon planıyla birlikte gösterilir." : "Trend analizi ikinci ölçümden itibaren otomatik oluşur.")}
      <section class="compact-trend-action-grid">
        <div class="compact-trend-panel">
          ${buildCompactTrendSection(trends)}
        </div>
        <aside class="compact-action-panel">
          ${buildCompactActionPanel(profile, measurement)}
        </aside>
      </section>
      <section class="compact-report-section">
        <div class="compact-section-title">
          <span>03A</span>
          <div>
            <strong>Koç yorumu</strong>
            <small>Rapordan çıkan uygulanabilir kısa aksiyonlar.</small>
          </div>
        </div>
        <div class="premium-coach-layout premium-coach-layout--compact">
          ${compactCoachPlan.map(buildCoachInterpretationHtml).join("")}
        </div>
      </section>
      ${buildCompactNextGoalsHtml(compactGoals)}
      ${buildPremiumReportFooter("Trend + Aksiyon")}
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

function getCompactBodyCompositionValues(bodyValues) {
  const wantedLabels = ["Kilo", "Yağ kütlesi", "Yağ %", "Kas kütlesi", "Sıvı kg", "Kemik kütlesi"];
  const labelMap = {
    "Yağ kütlesi": "Yağ kg",
    "Kas kütlesi": "Kas kg",
    "Kemik kütlesi": "Kemik kg",
  };

  return bodyValues
    .filter((item) => wantedLabels.includes(item.label))
    .map((item) => ({
      ...item,
      label: labelMap[item.label] || item.label,
      explanation: shortenReportText(item.explanation, 92),
    }));
}

function getCompactHealthIndicators(indicators) {
  const wantedLabels = ["BMI", "Yağ oranı", "Visceral yağ", "BMR", "Metabolizma yaşı", "Vücut suyu"];
  const compactText = {
    BMI: "Boy-kilo oranını hızlı takip eder; yağ ve kas verileriyle birlikte okunur.",
    "Yağ oranı": "Kompozisyon hedefinin ana göstergesidir.",
    "Visceral yağ": "İç yağlanma skorudur; yüksekse kardiyo ve takip önceliklenir.",
    BMR: "Beslenme kalori planı için temel referanstır.",
    "Metabolizma yaşı": "Metabolik profilin yaş referansına göre pratik yorumudur.",
    "Vücut suyu": "Hidrasyon ve yağsız kütle kalitesini destekleyici göstergedir.",
  };

  return indicators
    .filter((item) => wantedLabels.includes(item.title))
    .map((item) => ({
      ...item,
      explanation: compactText[item.title] || shortenReportText(item.explanation, 88),
      recommendation: "",
    }));
}

function buildCompactSegmentPairCards(segmentalAnalysis) {
  const regions = [
    { title: "Sağ kol", muscle: "Sağ kol kas", fat: "Sağ kol yağ" },
    { title: "Sol kol", muscle: "Sol kol kas", fat: "Sol kol yağ" },
    { title: "Gövde", muscle: "Gövde kas", fat: "Gövde yağ" },
    { title: "Sağ bacak", muscle: "Sağ bacak kas", fat: "Sağ bacak yağ" },
    { title: "Sol bacak", muscle: "Sol bacak kas", fat: "Sol bacak yağ" },
  ];

  return regions
    .map((region) => {
      const muscle = findSegmentReportItem(segmentalAnalysis.muscleValues, region.muscle);
      const fat = findSegmentReportItem(segmentalAnalysis.fatValues, region.fat);

      return `
        <article class="compact-segment-pair">
          <strong>${escapeHtml(region.title)}</strong>
          <div><span>Kas</span><em>${escapeHtml(formatReportValue(muscle?.value, "kg"))}</em></div>
          <div><span>Yağ</span><em>${escapeHtml(formatReportValue(fat?.value, "kg"))}</em></div>
        </article>
      `;
    })
    .join("");
}

function findSegmentReportItem(items, label) {
  return (items || []).find((item) => item.label === label) || null;
}

function buildCompactSymmetryHtml(symmetryBars) {
  const compactBars = (symmetryBars || []).slice(0, 4);

  if (!compactBars.length) {
    return "";
  }

  return `
    <div class="compact-section-title compact-section-title--small">
      <span>02B</span>
      <div>
        <strong>Sağ-sol karşılaştırma</strong>
        <small>Kol ve bacak kas/yağ farkı.</small>
      </div>
    </div>
    <div class="ultra-symmetry-grid ultra-symmetry-grid--compact">
      ${compactBars.map(buildSymmetryBarHtml).join("")}
    </div>
  `;
}

function buildCompactTrendSection(trends) {
  if (!trends.hasTrend) {
    return `
      <article class="measurement-report-empty measurement-report-empty--compact compact-trend-empty">
        <strong>Trend analizi ikinci ölçümden itibaren otomatik oluşur.</strong>
        <span>Bir sonraki Tanita veya manuel ölçüm kaydedildiğinde kilo, yağ oranı ve kas kütlesi grafikleri burada görünür.</span>
      </article>
    `;
  }

  const charts = getCompactTrendCharts(trends.charts);
  const differences = getCompactDifferenceRows(trends.differences);

  return `
    <div class="compact-section-title">
      <span>03</span>
      <div>
        <strong>Gelişim trendi</strong>
        <small>Kilo, yağ oranı ve kas kütlesi değişimi.</small>
      </div>
    </div>
    <div class="measurement-trend-grid measurement-trend-grid--premium measurement-trend-grid--compact">
      ${charts.map(buildTrendChartHtml).join("")}
    </div>
    <div class="measurement-difference-table premium-difference-table premium-difference-table--compact">
      <div class="measurement-difference-table__head">
        <span>Alan</span><span>Önceki</span><span>Son</span><span>Fark</span>
      </div>
      ${differences.map(buildDifferenceRowHtml).join("")}
    </div>
  `;
}

function getCompactTrendCharts(charts) {
  const wantedLabels = ["Kilo", "Yağ oranı", "Kas kütlesi"];
  return (charts || []).filter((chart) => wantedLabels.includes(chart.label));
}

function getCompactDifferenceRows(differences) {
  const wantedLabels = ["Kilo", "Yağ oranı", "Kas kütlesi", "Yağ kg"];
  return (differences || []).filter((row) => wantedLabels.includes(row.label));
}

function getCompactCoachPlan(coachPlan) {
  const wantedTitles = ["Genel değerlendirme", "Antrenman önerisi", "Beslenme önerisi", "Takip önerisi"];
  const compact = (coachPlan || [])
    .filter((item) => wantedTitles.includes(item.title))
    .map((item) => ({
      ...item,
      text: shortenReportText(item.text, 150),
    }));

  return compact.length ? compact : (coachPlan || []).slice(0, 4).map((item) => ({ ...item, text: shortenReportText(item.text, 150) }));
}

function buildCompactActionPanel(profile, measurement) {
  const goalLabel = labelMaps.goal?.[profile?.goal] || profile?.goal || "Hedefe göre kişisel takip";
  const styleLabel = profile?.programStyle ? getProgramStyleLabel(profile.programStyle) : "Kişisel program";
  const trainingSystem = profile?.trainingSystem ? getTrainingSystemLabel(profile.trainingSystem) : "Standart sistem";
  const dayText = Array.isArray(profile?.days) && profile.days.length ? `${profile.days.length} gün/hafta` : "Haftalık güne göre";
  const fat = measurementValue(measurement?.fat);
  const visceralFat = measurementValue(measurement?.visceralFat);
  const actionNote = fat !== "" && fat >= 30
    ? "Yağ kaybı için direnç + düşük etkili kardiyo dengesi korunmalı."
    : visceralFat !== "" && visceralFat >= 13
      ? "Visceral yağ için düzenli kardiyo ve beslenme takibi öne alınmalı."
      : "Program, beslenme ve ölçüm takibi aynı döngüde sürdürülmeli.";

  return `
    <div class="compact-section-title">
      <span>03B</span>
      <div>
        <strong>Sonraki adım</strong>
        <small>PT/program satışını destekleyen net aksiyon planı.</small>
      </div>
    </div>
    <div class="compact-action-grid">
      <article>
        <span>Önerilen program türü</span>
        <strong>${escapeHtml(styleLabel)}</strong>
        <small>${escapeHtml(goalLabel)} • ${escapeHtml(trainingSystem)} • ${escapeHtml(dayText)}</small>
      </article>
      <article>
        <span>Tekrar ölçüm</span>
        <strong>14-21 gün</strong>
        <small>Aynı saat ve benzer ölçüm koşullarıyla takip önerilir.</small>
      </article>
      <article>
        <span>Kişisel takip</span>
        <strong>Program + beslenme</strong>
        <small>${escapeHtml(actionNote)}</small>
      </article>
    </div>
  `;
}

function getCompactNextGoals(nextGoals) {
  const wantedTitles = ["Yağ oranı takip", "Kas kütlesi koruma", "Segmental denge izleme", "BMR bazlı beslenme planlama"];
  return (nextGoals || [])
    .filter((goal) => wantedTitles.includes(goal.title))
    .map((goal) => ({
      ...goal,
      text: shortenReportText(goal.text, 96),
    }));
}

function buildCompactNextGoalsHtml(goals) {
  if (!goals?.length) {
    return "";
  }

  return `
    <section class="compact-report-section compact-final-checklist">
      <div class="compact-section-title">
        <span>03C</span>
        <div>
          <strong>Final kontrol listesi</strong>
          <small>Bir sonraki görüşmede kontrol edilecek ana başlıklar.</small>
        </div>
      </div>
      <div class="ultra-next-goal-grid ultra-next-goal-grid--compact">
        ${goals
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

function shortenReportText(text, maxLength = 140) {
  const value = String(text || "").trim();

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
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
  // ─────────────────────────────────────────────────────────────────────────────
  window.BSMMeasurementReport = { init: init, render: renderMeasurementReport };
})();