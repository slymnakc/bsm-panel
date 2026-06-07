// 29-tanita-csv-import.spec.js — BSM-TANITA-001 Faz 1: Tanita CSV servis katmanı coverage
// KAPSAM: Sadece window.BSMTanitaCsvService servis fonksiyonları (parse/normalize/build).
// Inline Generic CSV fixture (gerçek dosya upload YOK, BC-418 gerçek fixture YOK,
// DOM persist YOK, Supabase YOK). Üretim koduna sıfır dokunuş — servis zaten expose.
//
// Kontroller:
//   1. window.BSMTanitaCsvService 6 fn expose
//   2. parseTanitaCsv — Generic CSV parse (headers + records + warnings)
//   3. Alias eşleme: TR "yağ oranı" + EN "body fat %" → ikisi de bodyFatPercentage
//   4. selectBestRecord — çoklu kayıt içinden en güncel tarih
//   5. buildTanitaMeasurement — doğru measurement shape (id/date/source/segments/resistance)
//   6. Ana alanlar: weight, fat (=bodyFatPercentage), muscleMass, fatFreeMass, visceralFat
//   7. Segmental: segments{} + resistance{} objeleri
//   8. fatFreeMass regresyon kilidi — measurement objesinde taşınır (form'da görünmese de)
//   9. Boş / alakasız CSV → warnings
//   10. console / page / network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

// ─── Inline Generic CSV fixtures (BC-418 string'leri İÇERMEZ → Yol B / generic) ───

// Tam EN header + segmental + impedance (tek kayıt)
const CSV_EN_FULL = [
  "date,weight,body fat %,muscle mass,fat free mass,visceral fat,right arm muscle,left arm muscle,trunk muscle,right leg muscle,left leg muscle,right arm fat,left arm fat,trunk fat,right leg fat,left leg fat,right arm impedance,left arm impedance,trunk impedance,right leg impedance,left leg impedance",
  "2026-06-01,82.5,18.4,34.2,67.3,8,2.8,2.7,28.5,9.1,9.0,0.5,0.5,6.2,1.4,1.3,320,322,28,290,292",
].join("\n");

// TR header (alias eşleşmesi testi için)
const CSV_TR = [
  "tarih,kilo,yağ oranı,kas kütlesi",
  "2026-06-01,80,20,33",
].join("\n");

// Çoklu kayıt (selectBestRecord en güncel tarih testi)
const CSV_MULTI = [
  "date,weight,body fat %",
  "2026-01-15,85,22",
  "2026-06-01,82,19",
  "2026-03-10,84,21",
].join("\n");

// Alakasız header (eşleşme yok → warnings)
const CSV_IRRELEVANT = [
  "renk,marka,model",
  "kirmizi,acme,x100",
].join("\n");

// BSM-TANITA-003: BSM Panel'in kendi "ölçüm geçmişi export" round-trip CSV'si.
// Header'lar BSM export formatı ("Visceral Yağ", "Metabolik Yaş"). Anonim, sabit
// test tarihi, jenerik değerler (gerçek kişisel veri YOK). Round-trip alias kaybı
// regresyonunu kilitler — visceralFat + metabolicAge dolu olmalı.
const CSV_BSM_ROUNDTRIP = [
  '"Tarih","Kilo","Yağ Oranı","Kas Kütlesi","Bel","Visceral Yağ","BMR","Metabolik Yaş","Kaynak"',
  '"2026-01-01","80.0","18.0","60.0","","6","1800","30","Tanita CSV"',
].join("\n");

test("Tanita CSV servis katmanı — parse + alias + selectBest + buildMeasurement", async ({ page }) => {
  const { errors } = await setupPage(page);

  // ─── DOĞRULAMA 1: window.BSMTanitaCsvService 6 fn expose ──────────────
  const api = await page.evaluate(() => {
    const s = window.BSMTanitaCsvService;
    return {
      exists: !!s,
      parseTanitaCsv: typeof s?.parseTanitaCsv === "function",
      selectBestRecord: typeof s?.selectBestRecord === "function",
      buildTanitaMeasurement: typeof s?.buildTanitaMeasurement === "function",
      buildTanitaPreviewModel: typeof s?.buildTanitaPreviewModel === "function",
      readTanitaCsvFile: typeof s?.readTanitaCsvFile === "function",
      futureIntegrationNote: !!s?.futureIntegrationNote,
    };
  });
  expect(api.exists, "window.BSMTanitaCsvService mevcut").toBe(true);
  expect(api.parseTanitaCsv, "parseTanitaCsv fn").toBe(true);
  expect(api.selectBestRecord, "selectBestRecord fn").toBe(true);
  expect(api.buildTanitaMeasurement, "buildTanitaMeasurement fn").toBe(true);
  expect(api.buildTanitaPreviewModel, "buildTanitaPreviewModel fn").toBe(true);
  expect(api.readTanitaCsvFile, "readTanitaCsvFile fn").toBe(true);
  expect(api.futureIntegrationNote, "futureIntegrationNote export").toBe(true);

  // ─── DOĞRULAMA 2: parseTanitaCsv — Generic CSV parse ──────────────────
  const parsed = await page.evaluate((csv) => {
    const r = window.BSMTanitaCsvService.parseTanitaCsv(csv);
    return {
      headerCount: Array.isArray(r.headers) ? r.headers.length : -1,
      recordCount: Array.isArray(r.records) ? r.records.length : -1,
      firstWeight: r.records?.[0]?.weight,
      firstFat: r.records?.[0]?.bodyFatPercentage,
      warnings: r.warnings || [],
    };
  }, CSV_EN_FULL);
  expect(parsed.recordCount, "Generic CSV → 1 kayıt parse").toBe(1);
  expect(parsed.headerCount, "Header'lar okundu (>0)").toBeGreaterThan(0);
  expect(Number(parsed.firstWeight), "weight=82.5 parse").toBeCloseTo(82.5, 1);
  expect(Number(parsed.firstFat), "bodyFatPercentage=18.4 parse").toBeCloseTo(18.4, 1);

  // ─── DOĞRULAMA 3: Alias eşleme TR + EN → bodyFatPercentage ────────────
  const aliasCheck = await page.evaluate((cfg) => {
    const tr = window.BSMTanitaCsvService.parseTanitaCsv(cfg.tr);
    const en = window.BSMTanitaCsvService.parseTanitaCsv(cfg.en);
    return {
      // TR "yağ oranı" → bodyFatPercentage
      trFat: tr.records?.[0]?.bodyFatPercentage,
      trWeight: tr.records?.[0]?.weight,        // "kilo" → weight
      trMuscle: tr.records?.[0]?.muscleMass,    // "kas kütlesi" → muscleMass
      // EN "body fat %" → bodyFatPercentage
      enFat: en.records?.[0]?.bodyFatPercentage,
    };
  }, { tr: CSV_TR, en: CSV_EN_FULL });
  expect(Number(aliasCheck.trFat), "TR 'yağ oranı' → bodyFatPercentage=20").toBeCloseTo(20, 1);
  expect(Number(aliasCheck.trWeight), "TR 'kilo' → weight=80").toBeCloseTo(80, 1);
  expect(Number(aliasCheck.trMuscle), "TR 'kas kütlesi' → muscleMass=33").toBeCloseTo(33, 1);
  expect(Number(aliasCheck.enFat), "EN 'body fat %' → bodyFatPercentage=18.4").toBeCloseTo(18.4, 1);
  // İki dil aynı semantik field'a map ediliyor (drift yok)
  expect(aliasCheck.trFat != null && aliasCheck.enFat != null, "TR ve EN header aynı field'a (bodyFatPercentage) map").toBe(true);

  // ─── DOĞRULAMA 4: selectBestRecord — en güncel tarih ──────────────────
  const best = await page.evaluate((csv) => {
    const r = window.BSMTanitaCsvService.parseTanitaCsv(csv);
    const chosen = window.BSMTanitaCsvService.selectBestRecord(r.records);
    return { date: chosen?.date, weight: chosen?.weight, recordCount: r.records.length };
  }, CSV_MULTI);
  expect(best.recordCount, "3 kayıt parse").toBe(3);
  expect(best.date, "En güncel tarih 2026-06-01 seçildi").toBe("2026-06-01");
  expect(Number(best.weight), "En güncel kaydın weight=82").toBeCloseTo(82, 1);

  // ─── DOĞRULAMA 5+6+7: buildTanitaMeasurement shape + ana alanlar + segmental ──
  const measurement = await page.evaluate((csv) => {
    const r = window.BSMTanitaCsvService.parseTanitaCsv(csv);
    const record = window.BSMTanitaCsvService.selectBestRecord(r.records);
    const m = window.BSMTanitaCsvService.buildTanitaMeasurement(record, {});
    return {
      hasId: typeof m.id === "string" && m.id.length > 0,
      date: m.date,
      source: m.source,
      // Ana alanlar (madde 6) — fat = bodyFatPercentage map
      weight: m.weight,
      fat: m.fat,
      muscleMass: m.muscleMass,
      fatFreeMass: m.fatFreeMass,
      visceralFat: m.visceralFat,
      // Segmental (madde 7)
      hasSegments: m.segments && typeof m.segments === "object",
      segmentKeys: m.segments ? Object.keys(m.segments).length : 0,
      hasResistance: m.resistance && typeof m.resistance === "object",
      resistanceKeys: m.resistance ? Object.keys(m.resistance).length : 0,
      rightArmMuscle: m.segments?.rightArmMuscle,
      rightArmResistance: m.resistance?.rightArmResistance,
    };
  }, CSV_EN_FULL);

  // Madde 5: shape
  expect(measurement.hasId, "measurement.id üretildi").toBe(true);
  expect(measurement.date, "measurement.date dolu (2026-06-01)").toBe("2026-06-01");
  expect(/tanita/i.test(measurement.source || ""), `measurement.source 'tanita' (gerçek: "${measurement.source}")`).toBe(true);
  // Madde 6: ana alanlar (fat = bodyFatPercentage)
  expect(Number(measurement.weight), "weight=82.5").toBeCloseTo(82.5, 1);
  expect(Number(measurement.fat), "fat (bodyFatPercentage)=18.4").toBeCloseTo(18.4, 1);
  expect(Number(measurement.muscleMass), "muscleMass=34.2").toBeCloseTo(34.2, 1);
  expect(Number(measurement.fatFreeMass), "fatFreeMass=67.3").toBeCloseTo(67.3, 1);
  expect(Number(measurement.visceralFat), "visceralFat=8").toBeCloseTo(8, 1);
  // Madde 7: segmental
  expect(measurement.hasSegments, "segments{} objesi var").toBe(true);
  expect(measurement.segmentKeys, "segments 10 alan (5 kas + 5 yağ)").toBe(10);
  expect(measurement.hasResistance, "resistance{} objesi var").toBe(true);
  expect(measurement.resistanceKeys, "resistance 5 alan").toBe(5);
  expect(Number(measurement.rightArmMuscle), "segments.rightArmMuscle=2.8").toBeCloseTo(2.8, 1);
  expect(Number(measurement.rightArmResistance), "resistance.rightArmResistance=320").toBeCloseTo(320, 0);

  // ─── DOĞRULAMA 8: fatFreeMass regresyon kilidi ────────────────────────
  // BSM-TANITA-001 / madde 10 analizi: fatFreeMass measurement objesinde TAŞINIR
  // (form input'u olmasa da). Bu davranışı kilitliyoruz — kaybolursa test kırılır.
  expect(measurement.fatFreeMass !== "" && measurement.fatFreeMass != null,
    `fatFreeMass measurement'ta taşınıyor (gerçek: ${measurement.fatFreeMass})`).toBe(true);
  expect(Number(measurement.fatFreeMass), "fatFreeMass değeri korunuyor (67.3)").toBeCloseTo(67.3, 1);

  // ─── DOĞRULAMA 9: Boş / alakasız CSV → warnings ───────────────────────
  const errorCases = await page.evaluate((cfg) => {
    const empty = window.BSMTanitaCsvService.parseTanitaCsv("");
    const irrelevant = window.BSMTanitaCsvService.parseTanitaCsv(cfg.irrelevant);
    return {
      emptyRecords: empty.records?.length ?? -1,
      emptyWarnings: empty.warnings?.length ?? 0,
      irrelevantRecords: irrelevant.records?.length ?? -1,
      irrelevantWarnings: irrelevant.warnings?.length ?? 0,
      irrelevantWarningText: (irrelevant.warnings || []).join(" "),
    };
  }, { irrelevant: CSV_IRRELEVANT });
  expect(errorCases.emptyRecords, "Boş CSV → 0 kayıt").toBe(0);
  expect(errorCases.emptyWarnings, "Boş CSV → warning üretir").toBeGreaterThan(0);
  // Alakasız header → eşleşme yok → warning
  expect(errorCases.irrelevantWarnings, "Alakasız CSV → warning üretir").toBeGreaterThan(0);

  // ─── DOĞRULAMA 10: BSM export round-trip (BSM-TANITA-003) ─────────────
  // BSM kendi export'unu geri import edince "Visceral Yağ" + "Metabolik Yaş"
  // sütunları alias listesinde olmadığı için KAYBOLUYORDU (gerçek veri kaybı).
  // Bu blok visceralFat + metabolicAge'in dolduğunu kilitler.
  const roundTrip = await page.evaluate((csv) => {
    const r = window.BSMTanitaCsvService.parseTanitaCsv(csv);
    const best = window.BSMTanitaCsvService.selectBestRecord(r.records);
    const m = window.BSMTanitaCsvService.buildTanitaMeasurement(best, {});
    return {
      recordCount: r.records?.length,
      weight: m.weight, fat: m.fat, muscleMass: m.muscleMass, bmr: m.bmr,
      visceralFat: m.visceralFat, metabolicAge: m.metabolicAge,
    };
  }, CSV_BSM_ROUNDTRIP);
  // Önceden de eşleşen alanlar
  expect(Number(roundTrip.weight), "round-trip weight=80.0").toBeCloseTo(80.0, 1);
  expect(Number(roundTrip.fat), "round-trip fat (Yağ Oranı)=18.0").toBeCloseTo(18.0, 1);
  expect(Number(roundTrip.muscleMass), "round-trip muscleMass (Kas Kütlesi)=60.0").toBeCloseTo(60.0, 1);
  expect(Number(roundTrip.bmr), "round-trip bmr=1800").toBeCloseTo(1800, 0);
  // BSM-TANITA-003 fix hedefi — önceden BOŞ idi (alias kaybı):
  expect(roundTrip.visceralFat !== "" && roundTrip.visceralFat != null,
    `'Visceral Yağ' → visceralFat dolu (gerçek: ${roundTrip.visceralFat})`).toBe(true);
  expect(Number(roundTrip.visceralFat), "round-trip visceralFat=6").toBeCloseTo(6, 0);
  expect(roundTrip.metabolicAge !== "" && roundTrip.metabolicAge != null,
    `'Metabolik Yaş' → metabolicAge dolu (gerçek: ${roundTrip.metabolicAge})`).toBe(true);
  expect(Number(roundTrip.metabolicAge), "round-trip metabolicAge=30").toBeCloseTo(30, 0);

  // ─── DOĞRULAMA 11: console / page / network error 0 ──────────────────
  assertNoErrors(errors);
});
