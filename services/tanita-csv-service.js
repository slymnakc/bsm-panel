(function () {
  "use strict";

  const futureIntegrationNote = {
    source: "tanita_bc418_csv",
    architecture: "Tanita BC-418 -> RS-232 -> Windows bridge app -> HTTP/WebSocket -> BSM panel",
    status: "CSV import aktif. RS-232 canlı aktarım gelecek aşama için modüler olarak planlandı.",
  };

  const fieldAliases = {
    date: ["date", "measurement date", "tarih", "olcum tarihi", "ölçüm tarihi"],
    time: ["time", "measurement time", "saat", "olcum saati", "ölçüm saati"],
    gender: ["gender", "sex", "cinsiyet"],
    height: ["height", "stature", "boy", "boy cm"],
    weight: ["weight", "kilo", "body weight", "vucut agirligi", "vücut ağırlığı"],
    bodyFatPercentage: ["body fat %", "body fat percentage", "fat %", "pbf", "yag orani", "yağ oranı", "vucut yag", "vücut yağ"],
    fatMass: ["fat mass", "yag kutlesi", "yağ kütlesi"],
    fatFreeMass: ["fat free mass", "ffm", "yagsiz kutle", "yağsız kütle"],
    muscleMass: ["muscle mass", "kas kutlesi", "kas kütlesi"],
    bodyWater: ["tbw", "body water", "total body water", "vucut suyu", "vücut suyu"],
    bmi: ["bmi", "body mass index", "vki"],
    bmr: ["bmr", "basal metabolic rate", "metabolizma hizi", "metabolizma hızı", "bazal metabolizma"],
    metabolicAge: ["metabolic age", "metabolizma yasi", "metabolizma yaşı"],
    visceralFat: ["visceral fat", "visceral rating", "ic yag", "iç yağ"],
    boneMass: ["bone mass", "kemik kutlesi", "kemik kütlesi", "kemik kg"],
    rightArmFat: ["right arm fat", "sag kol yag", "sağ kol yağ"],
    leftArmFat: ["left arm fat", "sol kol yag", "sol kol yağ"],
    trunkFat: ["trunk fat", "torso fat", "govde yag", "gövde yağ"],
    rightLegFat: ["right leg fat", "sag bacak yag", "sağ bacak yağ"],
    leftLegFat: ["left leg fat", "sol bacak yag", "sol bacak yağ"],
    rightArmMuscle: ["right arm muscle", "sag kol kas", "sağ kol kas"],
    leftArmMuscle: ["left arm muscle", "sol kol kas", "sol kol kas"],
    trunkMuscle: ["trunk muscle", "torso muscle", "govde kas", "gövde kas"],
    rightLegMuscle: ["right leg muscle", "sag bacak kas", "sağ bacak kas"],
    leftLegMuscle: ["left leg muscle", "sol bacak kas", "sol bacak kas"],
    impedanceRightArm: ["right arm impedance", "right arm resistance", "sag kol direnc", "sağ kol direnç"],
    impedanceLeftArm: ["left arm impedance", "left arm resistance", "sol kol direnc", "sol kol direnç"],
    impedanceTrunk: ["trunk impedance", "trunk resistance", "govde direnc", "gövde direnç"],
    impedanceRightLeg: ["right leg impedance", "right leg resistance", "sag bacak direnc", "sağ bacak direnç"],
    impedanceLeftLeg: ["left leg impedance", "left leg resistance", "sol bacak direnc", "sol bacak direnç"],
  };

  const bc418ReportAliases = {
    date: ["ölçüm tarihi", "rapor tarihi ve saati"],
    bodyFatPercentage: ["yağ %", "yağ oranı"],
    fatMass: ["yağ ağırlığı kg", "yağ kg"],
    muscleMass: ["kas kg", "yumuşak kas dokusu kg", "iskeletsel kaslar kg"],
    bodyWater: ["sıvı oranı"],
    bmr: ["bazal metab hızı", "bazal metabolizma hızı"],
    metabolicAge: ["metabolizma yaşı"],
    visceralFat: ["iç yağlanma"],
    boneMass: ["kemik mineralleri ağırlığı kg"],
    rightArmFat: ["rightarmfat"],
    leftArmFat: ["leftarmfat"],
    trunkFat: ["trunkfat"],
    rightLegFat: ["rightlegfat"],
    leftLegFat: ["leftlegfat"],
    rightArmMuscle: ["rightarmmuscle"],
    leftArmMuscle: ["leftarmmuscle"],
    trunkMuscle: ["trunkmuscle"],
    rightLegMuscle: ["rightlegmuscle"],
    leftLegMuscle: ["leftlegmuscle"],
    impedanceRightArm: ["sağ kol direnç", "right arm resistance", "rightarmresistance"],
    impedanceLeftArm: ["sol kol direnç", "left arm resistance", "leftarmresistance"],
    impedanceTrunk: ["gövde direnç", "trunk resistance", "trunkresistance"],
    impedanceRightLeg: ["sağ bacak direnç", "right leg resistance", "rightlegresistance"],
    impedanceLeftLeg: ["sol bacak direnç", "left leg resistance", "leftlegresistance"],
  };

  const numericFields = new Set([
    "height",
    "weight",
    "bodyFatPercentage",
    "fatMass",
    "fatFreeMass",
    "muscleMass",
    "bodyWater",
    "bmi",
    "bmr",
    "metabolicAge",
    "visceralFat",
    "boneMass",
    "rightArmFat",
    "leftArmFat",
    "trunkFat",
    "rightLegFat",
    "leftLegFat",
    "rightArmMuscle",
    "leftArmMuscle",
    "trunkMuscle",
    "rightLegMuscle",
    "leftLegMuscle",
    "impedanceRightArm",
    "impedanceLeftArm",
    "impedanceTrunk",
    "impedanceRightLeg",
    "impedanceLeftLeg",
  ]);

  const aliasLookup = buildAliasLookup(mergeFieldAliases(fieldAliases, bc418ReportAliases));

  function readTanitaCsvFile(file) {
    if (!file) {
      return Promise.resolve("");
    }

    if (typeof file.arrayBuffer !== "function") {
      return file.text();
    }

    return file.arrayBuffer().then(decodeCsvBuffer);
  }

  function parseTanitaCsv(csvText) {
    const rows = parseCsvRows(csvText);
    const warnings = [];

    if (rows.length < 2) {
      return { headers: rows[0] || [], records: [], warnings: ["CSV içinde okunabilir ölçüm satırı bulunamadı."] };
    }

    if (isBc418SegmentalReport(rows)) {
      const headers = extractBc418ReportHeaders(rows);
      const parsedMeasurement = parseBc418SegmentalReport(rows);
      const records = parsedMeasurement ? [parsedMeasurement] : [];

      console.log("TANITA CSV HEADERS:", headers);
      console.log("TANITA PARSED MEASUREMENT:", parsedMeasurement);

      if (!records.length) {
        warnings.push("Tanita BC-418 raporu tanındı ancak ölçüm değeri bulunamadı.");
      }

      return { headers, records, warnings };
    }

    const headers = rows[0].map((header) => String(header || "").trim());
    const mappedHeaders = headers.map(resolveFieldName);
    const records = rows
      .slice(1)
      .map((row) => mapRowToRecord(row, headers, mappedHeaders))
      .filter((record) => Object.keys(record.values).length > 0)
      .map(({ values, rawPayload }) => ({
        ...values,
        rawPayload,
      }));

    if (!mappedHeaders.some(Boolean)) {
      warnings.push("CSV başlıkları Tanita alanlarıyla eşleşmedi. Başlıkları kontrol edin.");
    }

    if (!records.length) {
      warnings.push("CSV okundu ancak ölçüm değeri bulunamadı.");
    }

    console.log("TANITA CSV HEADERS:", headers);
    console.log("TANITA PARSED MEASUREMENT:", records[0] || null);

    return { headers, records, warnings };
  }

  function selectBestRecord(records) {
    const normalizedRecords = Array.isArray(records) ? records : [];

    if (!normalizedRecords.length) {
      return null;
    }

    return [...normalizedRecords].sort((a, b) => {
      const dateA = buildComparableDate(a);
      const dateB = buildComparableDate(b);
      return dateB - dateA;
    })[0];
  }

  function buildTanitaMeasurement(record, options = {}) {
    const source = record && typeof record === "object" ? record : {};
    const makeId = typeof options.makeId === "function" ? options.makeId : fallbackMakeId;
    const today = typeof options.getTodayInputValue === "function" ? options.getTodayInputValue() : toDateInputValue(new Date());
    const date = normalizeDateValue(source.date) || today;

    return {
      id: makeId("measurement"),
      createdAtIso: new Date().toISOString(),
      date,
      time: normalizeTextValue(source.time),
      gender: normalizeTextValue(source.gender),
      source: futureIntegrationNote.source,
      rawPayload: source.rawPayload || source,
      weight: numberOrEmpty(source.weight),
      height: numberOrEmpty(source.height),
      birthDay: "",
      birthMonth: "",
      birthYear: "",
      birthDate: "",
      age: numberOrEmpty(source.age),
      fat: numberOrEmpty(source.bodyFatPercentage),
      fatMass: numberOrEmpty(source.fatMass),
      fatFreeMass: numberOrEmpty(source.fatFreeMass),
      muscleMass: numberOrEmpty(source.muscleMass),
      bodyWater: numberOrEmpty(source.bodyWater),
      bmi: numberOrEmpty(source.bmi),
      bmr: numberOrEmpty(source.bmr),
      metabolicAge: numberOrEmpty(source.metabolicAge),
      visceralFat: numberOrEmpty(source.visceralFat),
      boneMass: numberOrEmpty(source.boneMass),
      waist: "",
      hip: "",
      chest: "",
      segments: {
        rightArmMuscle: numberOrEmpty(source.rightArmMuscle),
        leftArmMuscle: numberOrEmpty(source.leftArmMuscle),
        trunkMuscle: numberOrEmpty(source.trunkMuscle),
        rightLegMuscle: numberOrEmpty(source.rightLegMuscle),
        leftLegMuscle: numberOrEmpty(source.leftLegMuscle),
        rightArmFat: numberOrEmpty(source.rightArmFat),
        leftArmFat: numberOrEmpty(source.leftArmFat),
        trunkFat: numberOrEmpty(source.trunkFat),
        rightLegFat: numberOrEmpty(source.rightLegFat),
        leftLegFat: numberOrEmpty(source.leftLegFat),
      },
      resistance: {
        rightArmResistance: numberOrEmpty(source.impedanceRightArm || source.rightArmResistance),
        leftArmResistance: numberOrEmpty(source.impedanceLeftArm || source.leftArmResistance),
        trunkResistance: numberOrEmpty(source.impedanceTrunk || source.trunkResistance),
        rightLegResistance: numberOrEmpty(source.impedanceRightLeg || source.rightLegResistance),
        leftLegResistance: numberOrEmpty(source.impedanceLeftLeg || source.leftLegResistance),
      },
      note: "Tanita BC-418 CSV import ölçümü.",
    };
  }

  function buildTanitaPreviewModel(measurement) {
    const item = measurement && typeof measurement === "object" ? measurement : {};
    const segmentCount = Object.values(item.segments || {}).filter((value) => value !== "" && value !== undefined).length;
    const resistanceCount = Object.values(item.resistance || {}).filter((value) => value !== "" && value !== undefined).length;

    return {
      title: "Tanita BC-418 ölçüm önizlemesi",
      source: "CSV import",
      futureNote: futureIntegrationNote.architecture,
      metrics: [
        ["Tarih", item.date || "-"],
        ["Saat", item.time || "-"],
        ["Kilo", formatValue(item.weight, "kg")],
        ["Vücut yağ", formatValue(item.fat, "%")],
        ["Kas kütlesi", formatValue(item.muscleMass, "kg")],
        ["Yağ kütlesi", formatValue(item.fatMass, "kg")],
        ["Vücut suyu", formatValue(item.bodyWater, "%")],
        ["BMI", formatValue(item.bmi, "")],
        ["BMR", formatValue(item.bmr, "kcal")],
        ["Metabolizma yaşı", formatValue(item.metabolicAge, "")],
        ["Visceral yağ", formatValue(item.visceralFat, "")],
        ["Kemik", formatValue(item.boneMass, "kg")],
      ].filter(([, value]) => value !== "-"),
      segmentSummary: `${segmentCount} segmental kas/yağ alanı, ${resistanceCount} direnç alanı okundu.`,
    };
  }

  function parseCsvRows(csvText) {
    const text = stripBom(String(csvText || "").trim());

    if (!text) {
      return [];
    }

    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === delimiter && !inQuotes) {
        row.push(cell.trim());
        cell = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          index += 1;
        }

        row.push(cell.trim());
        if (row.some((value) => value !== "")) {
          rows.push(row);
        }
        row = [];
        cell = "";
        continue;
      }

      cell += char;
    }

    row.push(cell.trim());
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }

    return rows;
  }

  function isBc418SegmentalReport(rows) {
    const text = rows.flat().map(normalizeReportText).join(" ");
    return text.includes("bc 418") && text.includes("segmental vucut kompozisyonu analizi");
  }

  function extractBc418ReportHeaders(rows) {
    return uniqueValues(
      rows
        .flat()
        .map((cell) => String(cell || "").trim())
        .filter((cell) => cell && /[A-Za-zĞÜŞİÖÇğüşıöç]/.test(cell))
        .map(cleanReportHeader),
    );
  }

  function parseBc418SegmentalReport(rows) {
    const headers = extractBc418ReportHeaders(rows);
    const record = {
      rawPayload: {
        format: "tanita_bc418_segmental_report",
        headers,
        rows: rows.filter((row) => row.some(Boolean)),
      },
    };

    parseBc418TopSummary(rows, record);
    parseBc418SegmentalTable(rows, record);
    parseBc418LabeledValues(rows, record);
    parseBc418HistoryRow(rows, record);

    if (!hasMeasurementValues(record)) {
      return null;
    }

    return record;
  }

  function parseBc418TopSummary(rows, record) {
    const labelRowIndex = rows.findIndex(
      (row) => row.some((cell) => normalizeReportText(cell) === "adi soyadi") && row.some((cell) => normalizeReportText(cell) === "kilo"),
    );

    if (labelRowIndex < 0) {
      applyFirstDateTime(rows, record);
      return;
    }

    const labelRow = rows[labelRowIndex] || [];
    const valueRow = rows[labelRowIndex + 1] || [];

    labelRow.forEach((label, index) => {
      const normalizedLabel = normalizeReportText(label);
      const rawValue = valueRow[index];

      if (!rawValue) {
        return;
      }

      if (normalizedLabel === "adi soyadi") record.memberName = normalizeTextValue(rawValue);
      if (normalizedLabel === "cinsiyet") record.gender = normalizeTextValue(rawValue);
      if (normalizedLabel === "yas") record.age = parseFlexibleNumber(rawValue);
      if (normalizedLabel === "boy") record.height = parseFlexibleNumber(rawValue);
      if (normalizedLabel === "kilo") record.weight = parseFlexibleNumber(rawValue);
      if (normalizedLabel === "bmi") record.bmi = parseFlexibleNumber(rawValue);
      if (normalizedLabel === "yag") record.bodyFatPercentage = parseFlexibleNumber(rawValue);
    });

    applyFirstDateTime([valueRow, ...rows], record);
  }

  function parseBc418SegmentalTable(rows, record) {
    const headerIndex = rows.findIndex((row) => Object.keys(buildSegmentColumnMap(row)).length >= 5);

    if (headerIndex < 0) {
      return;
    }

    const segmentColumns = buildSegmentColumnMap(rows[headerIndex]);
    const metricRows = rows.slice(headerIndex + 1, headerIndex + 8);

    metricRows.forEach((row) => {
      const metric = resolveSegmentMetric(row);

      if (!metric) {
        return;
      }

      Object.entries(segmentColumns).forEach(([index, segment]) => {
        const fieldName = getSegmentFieldName(segment, metric);
        const value = parseFlexibleNumber(row[Number(index)]);

        if (fieldName && value !== "") {
          record[fieldName] = value;
        }
      });
    });

    if (record.muscleMass === undefined) {
      const segmentMuscles = [
        record.rightArmMuscle,
        record.leftArmMuscle,
        record.trunkMuscle,
        record.rightLegMuscle,
        record.leftLegMuscle,
      ].filter((value) => value !== "" && value !== undefined);

      if (segmentMuscles.length === 5) {
        record.muscleMass = roundToOneDecimal(segmentMuscles.reduce((sum, value) => sum + Number(value), 0));
      }
    }
  }

  function parseBc418LabeledValues(rows, record) {
    rows.forEach((row) => {
      assignNumericValueByLabel(record, row, "metabolizma yasi", "metabolicAge");
      assignNumericValueByLabel(record, row, "ic yaglanma", "visceralFat");
      assignNumericValueByLabel(record, row, "kemik mineralleri agirligi kg", "boneMass");
      assignNumericValueByLabel(record, row, "yag agirligi kg", "fatMass");
      assignNumericValueByLabel(record, row, "yag orani", "bodyFatPercentage");
      assignNumericValueByLabel(record, row, "sivi orani", "bodyWater");
      assignNumericValueByLabel(record, row, "vucut kutle indeksi", "bmi");

      const bmr = findNumericValueAfterLabel(row, (label) => label === "bmr");
      if (bmr !== "") {
        record.bmr = bmr;
      }
    });
  }

  function parseBc418HistoryRow(rows, record) {
    const headerIndex = rows.findIndex(
      (row) => row.some((cell) => normalizeReportText(cell) === "olcum tarihi") && row.some((cell) => normalizeReportText(cell) === "kas kg"),
    );

    if (headerIndex < 0) {
      return;
    }

    const headerRow = rows[headerIndex] || [];
    const valueRow = rows.slice(headerIndex + 1).find((row) => row.some((cell) => parseDateTimeParts(cell))) || [];

    headerRow.forEach((header, index) => {
      const label = normalizeReportText(header);
      const value = valueRow[index];

      if (!value) {
        return;
      }

      if (label === "olcum tarihi") {
        applyDateTimeValue(value, record);
      }

      if (label === "kilo") record.weight = parseFlexibleNumber(value);
      if (label === "yag kg") record.fatMass = parseFlexibleNumber(value);
      if (label === "kas kg") record.muscleMass = parseFlexibleNumber(value);
      if (label === "yag disi kg") record.fatFreeMass = parseFlexibleNumber(value);
      if (label === "yag orani") record.bodyFatPercentage = parseFlexibleNumber(value);
    });
  }

  function buildSegmentColumnMap(row) {
    const map = {};

    row.forEach((cell, index) => {
      const label = normalizeReportText(cell);
      if (label === "sag bacak") map[index] = "rightLeg";
      if (label === "sol bacak") map[index] = "leftLeg";
      if (label === "sag kol") map[index] = "rightArm";
      if (label === "sol kol") map[index] = "leftArm";
      if (label === "govde") map[index] = "trunk";
    });

    return map;
  }

  function resolveSegmentMetric(row) {
    const labels = row.map(normalizeReportText).filter(Boolean);
    const text = labels.join(" ");

    if (text.includes("empedans")) return "impedance";
    if (text.includes("yag kg")) return "fat";
    if (text.includes("kas kg")) return "muscle";
    return "";
  }

  function getSegmentFieldName(segment, metric) {
    const fields = {
      rightArm: { fat: "rightArmFat", muscle: "rightArmMuscle", impedance: "impedanceRightArm" },
      leftArm: { fat: "leftArmFat", muscle: "leftArmMuscle", impedance: "impedanceLeftArm" },
      trunk: { fat: "trunkFat", muscle: "trunkMuscle", impedance: "impedanceTrunk" },
      rightLeg: { fat: "rightLegFat", muscle: "rightLegMuscle", impedance: "impedanceRightLeg" },
      leftLeg: { fat: "leftLegFat", muscle: "leftLegMuscle", impedance: "impedanceLeftLeg" },
    };

    return fields[segment]?.[metric] || "";
  }

  function assignNumericValueByLabel(record, row, labelText, fieldName) {
    if (record[fieldName] !== undefined && record[fieldName] !== "") {
      return;
    }

    const value = findNumericValueAfterLabel(row, (label) => label === labelText);

    if (value !== "") {
      record[fieldName] = value;
    }
  }

  function findNumericValueAfterLabel(row, labelMatcher) {
    const labelIndex = row.findIndex((cell) => labelMatcher(normalizeReportText(cell)));

    if (labelIndex < 0) {
      return "";
    }

    for (let index = labelIndex + 1; index < row.length; index += 1) {
      if (!isCleanNumericCell(row[index])) {
        continue;
      }

      return parseFlexibleNumber(row[index]);
    }

    return "";
  }

  function isCleanNumericCell(value) {
    const text = String(value || "").trim();
    return text && !/[~<>/*]/.test(text) && parseFlexibleNumber(text) !== "";
  }

  function applyFirstDateTime(rows, record) {
    const dateTime = rows.flat().map(parseDateTimeParts).find(Boolean);

    if (dateTime) {
      record.date = dateTime.date;
      record.time = dateTime.time || record.time || "";
    }
  }

  function applyDateTimeValue(value, record) {
    const dateTime = parseDateTimeParts(value);

    if (dateTime) {
      record.date = dateTime.date;
      record.time = dateTime.time || record.time || "";
    }
  }

  function parseDateTimeParts(value) {
    const text = normalizeTextValue(value);
    const match = text.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(?:\s+(\d{1,2}:\d{2}))?/);

    if (!match) {
      return null;
    }

    return {
      date: match[1],
      time: match[2] || "",
    };
  }

  function hasMeasurementValues(record) {
    return ["weight", "height", "bodyFatPercentage", "fatMass", "muscleMass", "bmi"].some((fieldName) => record[fieldName] !== undefined && record[fieldName] !== "");
  }

  function cleanReportHeader(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeReportText(value) {
    return normalizeTurkishText(value)
      .replace(/%/g, " ")
      .replace(/ω/g, " ohm ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function roundToOneDecimal(value) {
    return Math.round(Number(value) * 10) / 10;
  }

  function decodeCsvBuffer(buffer) {
    const encodings = ["utf-8", "windows-1254", "iso-8859-9"];
    const candidates = encodings
      .map((encoding) => decodeWithEncoding(buffer, encoding))
      .filter(Boolean)
      .map((text) => ({
        text,
        score: scoreDecodedCsv(text),
      }));

    if (!candidates.length) {
      return "";
    }

    return candidates.sort((a, b) => b.score - a.score)[0].text;
  }

  function decodeWithEncoding(buffer, encoding) {
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch (error) {
      return "";
    }
  }

  function scoreDecodedCsv(text) {
    const rows = parseCsvRows(text);
    const headers = rows[0] || [];
    const mappedCount = headers.map(resolveFieldName).filter(Boolean).length;
    const reportScore = isBc418SegmentalReport(rows) ? 200 : 0;
    const replacementPenalty = (text.match(/\uFFFD/g) || []).length;
    return reportScore + mappedCount * 20 - replacementPenalty;
  }

  function detectDelimiter(text) {
    const headerLine = text.split(/\r?\n/)[0] || "";
    const candidates = [",", ";", "\t"];
    return candidates
      .map((delimiter) => ({ delimiter, count: countDelimiterOutsideQuotes(headerLine, delimiter) }))
      .sort((a, b) => b.count - a.count)[0].delimiter;
  }

  function countDelimiterOutsideQuotes(line, delimiter) {
    let inQuotes = false;
    let count = 0;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        count += 1;
      }
    }

    return count;
  }

  function mapRowToRecord(row, headers, mappedHeaders) {
    const values = {};
    const rawPayload = {};

    headers.forEach((header, index) => {
      const rawValue = row[index] ?? "";
      const fieldName = mappedHeaders[index];

      rawPayload[header || `column_${index + 1}`] = rawValue;

      if (!fieldName || rawValue === "") {
        return;
      }

      values[fieldName] = numericFields.has(fieldName) ? parseFlexibleNumber(rawValue) : normalizeTextValue(rawValue);
    });

    return { values, rawPayload };
  }

  function resolveFieldName(header) {
    return aliasLookup.get(normalizeHeader(header)) || "";
  }

  function mergeFieldAliases(...aliasGroups) {
    return aliasGroups.reduce((merged, aliases) => {
      Object.entries(aliases || {}).forEach(([fieldName, names]) => {
        merged[fieldName] = [...(merged[fieldName] || []), ...(Array.isArray(names) ? names : [])];
      });

      return merged;
    }, {});
  }

  function buildAliasLookup(aliases) {
    const lookup = new Map();

    Object.entries(aliases).forEach(([fieldName, names]) => {
      names.forEach((name) => {
        lookup.set(normalizeHeader(name), fieldName);
      });
    });

    return lookup;
  }

  function normalizeHeader(value) {
    return normalizeTurkishText(value)
      .replace(/%/g, " percent ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\bpercent\b/g, "%")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTurkishText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/ÄŸ/g, "g")
      .replace(/Ã¼/g, "u")
      .replace(/ÅŸ/g, "s")
      .replace(/Ä±/g, "i")
      .replace(/Ã¶/g, "o")
      .replace(/Ã§/g, "c")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function parseFlexibleNumber(value) {
    const raw = String(value || "")
      .trim()
      .replace(/\s/g, "")
      .replace(/kg|cm|kcal|ohm|%/gi, "");

    if (!raw) {
      return "";
    }

    const normalized = raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(",", ".");
    const parsed = Number.parseFloat(normalized);

    return Number.isFinite(parsed) ? parsed : "";
  }

  function numberOrEmpty(value) {
    if (value === "" || value === null || value === undefined) {
      return "";
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : "";
  }

  function normalizeTextValue(value) {
    return String(value || "").trim();
  }

  function normalizeDateValue(value) {
    const text = normalizeTextValue(value);

    if (!text) {
      return "";
    }

    const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      return formatDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
    }

    const localMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (localMatch) {
      const year = localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3];
      return formatDateParts(year, localMatch[2], localMatch[1]);
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : toDateInputValue(parsed);
  }

  function formatDateParts(year, month, day) {
    const normalizedYear = String(year).padStart(4, "0");
    const normalizedMonth = String(month).padStart(2, "0");
    const normalizedDay = String(day).padStart(2, "0");
    const parsed = new Date(Number(normalizedYear), Number(normalizedMonth) - 1, Number(normalizedDay));

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== Number(normalizedYear) ||
      parsed.getMonth() !== Number(normalizedMonth) - 1 ||
      parsed.getDate() !== Number(normalizedDay)
    ) {
      return "";
    }

    return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
  }

  function buildComparableDate(record) {
    const date = normalizeDateValue(record?.date) || "1970-01-01";
    const time = normalizeTextValue(record?.time) || "00:00";
    const parsed = new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function toDateInputValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatValue(value, unit) {
    if (value === "" || value === undefined || value === null) {
      return "-";
    }

    return `${value}${unit ? ` ${unit}` : ""}`;
  }

  function fallbackMakeId(prefix) {
    return `${prefix || "item"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function stripBom(text) {
    return text.replace(/^\uFEFF/, "");
  }

  window.BSMTanitaCsvService = {
    futureIntegrationNote,
    readTanitaCsvFile,
    parseTanitaCsv,
    selectBestRecord,
    buildTanitaMeasurement,
    buildTanitaPreviewModel,
  };
})();
