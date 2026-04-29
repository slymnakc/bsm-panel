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

  const aliasLookup = buildAliasLookup(fieldAliases);

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
      age: "",
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
        rightArmResistance: numberOrEmpty(source.impedanceRightArm),
        leftArmResistance: numberOrEmpty(source.impedanceLeftArm),
        trunkResistance: numberOrEmpty(source.impedanceTrunk),
        rightLegResistance: numberOrEmpty(source.impedanceRightLeg),
        leftLegResistance: numberOrEmpty(source.impedanceLeftLeg),
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
    const replacementPenalty = (text.match(/\uFFFD/g) || []).length;
    return mappedCount * 20 - replacementPenalty;
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
