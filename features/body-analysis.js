(function () {
  "use strict";

  // Injected via init(config): getMemberAnalysis
  // Direct access: window.BSMAlertsUI.renderBodyAnalysisReport, window.BSMCoreUtils.escapeHtml
  var _getMemberAnalysis = null;
  var _bodyAnalysisReport = null;

  function init(config) {
    _getMemberAnalysis = (config || {}).getMemberAnalysis || function () { return null; };
    _bodyAnalysisReport = document.querySelector("#bodyAnalysisReport");
  }

  function renderBodyAnalysisReportUi(el, data, esc) {
    return window.BSMAlertsUI.renderBodyAnalysisReport(el, data, esc);
  }
  function escapeHtml(s) { return window.BSMCoreUtils.escapeHtml(s); }
  function getMemberAnalysis(member) { return _getMemberAnalysis(member); }

  // ── [Extracted from app.js — body analysis block] ─────────────────────────────
function renderBodyAnalysisReport(measurements, member) {
  if (!measurements.length) {
    renderBodyAnalysisReportUi(_bodyAnalysisReport, null, escapeHtml);
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
    _bodyAnalysisReport,
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
  // ─────────────────────────────────────────────────────────────────────────────
  window.BSMBodyAnalysis = { init: init, render: renderBodyAnalysisReport };
})();