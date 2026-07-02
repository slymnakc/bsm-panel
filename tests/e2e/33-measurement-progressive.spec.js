// 33-measurement-progressive.spec.js — BSM-UX-004b: Ölçüm Formu Progressive Disclosure
// Manuel Ölçüm sekmesinde katı-6 temel alan açık; kalan TÜM alanlar
// "Detaylı Ölçümler" <details id="measurementDetailFields"> altında (default kapalı).
//
// KRİTİK KURAL: applyTanitaMeasurementToForm üzerinden gelen HER doldurma yolu
// (CSV import, geçmiş yükleme, restore) detay alanı doldurduysa details AUTO-OPEN.
// Auto-open sadece AÇAR, asla kapatmaz.
//
// HOOK'SUZ: gerçek DOM + setInputFiles + native <details>. Üretim dokunuşu
// yalnızca app.js UI-layout (prepareMeasurementFormSections + sync helper) + CSS.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

// Katı-6: ilk açılışta görünen temel alanlar (details DIŞINDA)
const BASIC_IDS = [
  "measurementDate",
  "measurementHeight",
  "measurementWeight",
  "measurementBmi",
  "measurementFat",
  "measurementMuscleMass",
];

// Details İÇİNDE olması gereken alanlar (statik + JS-dinamik hepsi)
const DETAIL_IDS = [
  "measurementBirthDay",
  "measurementAge",
  "measurementGender",
  "measurementTime",
  "measurementFatMass",
  "measurementFatFree",
  "measurementBodyWater",
  "measurementVisceralFat",
  "measurementBmr",
  "measurementMetabolicAge",
  "measurementBoneMass",
  "measurementProteinPercent",
  "measurementIntracellularWater",
  "measurementWaist",
  "measurementHip",
  "measurementChest",
  "measurementArmCircumference",
  "measurementThighCircumference",
  "measurementCalfCircumference",
  "measurementMethod",
  "measurementDevice",
  "measurementMeasuredBy",
  "measurementNote",
];

// 30-spec ile aynı anonim Generic CSV (visceral/bmr = detay alanları doldurur)
const CSV_GENERIC = [
  "date,weight,body fat %,muscle mass,fat free mass,visceral fat,bmr,bmi,right arm muscle,left arm muscle,trunk muscle,right leg muscle,left leg muscle,right arm fat,left arm fat,trunk fat,right leg fat,left leg fat",
  "2026-01-01,72.0,24.0,30.0,52.0,7,1500,26.5,2.5,2.4,25.0,8.0,7.9,0.4,0.4,5.5,1.2,1.1",
].join("\n");

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Yapı: details var, kapalı, manual pane'de; katı-6 dışarıda; kalan içeride
// ════════════════════════════════════════════════════════════════════════════
test("Ölçüm formu disclosure yapısı — katı-6 açık, kalanlar details içinde", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "measurements");
  await page.waitForTimeout(400);

  const struct = await page.evaluate((ids) => {
    const details = document.querySelector("#measurementDetailFields");
    const inManualPane = !!details?.closest('[data-measurement-tab-pane="manual"]');

    const basicOutside = {};
    ids.basic.forEach((id) => {
      const el = document.getElementById(id);
      basicOutside[id] = !!(el && details && !details.contains(el));
    });

    const detailInside = {};
    ids.detail.forEach((id) => {
      const el = document.getElementById(id);
      detailInside[id] = !!(el && details && details.contains(el));
    });

    const allMount = {};
    [...ids.basic, ...ids.detail].forEach((id) => {
      allMount[id] = !!document.getElementById(id);
    });

    return {
      exists: !!details,
      isDetails: details ? details.tagName.toLowerCase() === "details" : false,
      open: details ? details.open : null,
      inManualPane,
      summaryText: (details?.querySelector(":scope > summary")?.textContent || "").trim(),
      basicOutside,
      detailInside,
      allMount,
      segmentalPreserved: !!document.querySelector('[data-measurement-tab-pane="segmental"] .segmental-details'),
    };
  }, { basic: BASIC_IDS, detail: DETAIL_IDS });

  expect(struct.exists, "#measurementDetailFields DOM'da").toBe(true);
  expect(struct.isDetails, "measurementDetailFields bir <details>").toBe(true);
  expect(struct.open, "details varsayılan KAPALI").toBe(false);
  expect(struct.inManualPane, "details Manuel Ölçüm pane'inde").toBe(true);
  expect(/Detaylı Ölçümler/i.test(struct.summaryText),
    `summary "Detaylı Ölçümler" içerir (gerçek: "${struct.summaryText}")`).toBe(true);

  BASIC_IDS.forEach((id) => {
    expect(struct.basicOutside[id], `#${id} temel — details DIŞINDA`).toBe(true);
  });
  DETAIL_IDS.forEach((id) => {
    expect(struct.detailInside[id], `#${id} detay — details İÇİNDE`).toBe(true);
  });
  [...BASIC_IDS, ...DETAIL_IDS].forEach((id) => {
    expect(struct.allMount[id], `#${id} DOM'da mount (özellik kaybı yok)`).toBe(true);
  });

  // Segmental analiz mevcut davranışını korur (ayrı sekme, ayrı details)
  expect(struct.segmentalPreserved, "segmental-details segmental pane'de duruyor").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — KRİTİK KURAL: CSV import detay alanı doldurunca details AUTO-OPEN
// ════════════════════════════════════════════════════════════════════════════
test("Tanita CSV import → Detaylı Ölçümler auto-open", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "measurements");
  await page.waitForTimeout(400);

  // Ön koşul: import öncesi kapalı
  const before = await page.evaluate(() => document.querySelector("#measurementDetailFields")?.open);
  expect(before, "import öncesi details kapalı").toBe(false);

  // CSV yükle (30-spec deseni) — visceralFat/bmr/fatFreeMass detay alanlarını doldurur
  await page.setInputFiles("#tanitaCsvInput", {
    name: "tanita-anonim.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV_GENERIC, "utf-8"),
  });
  await page.waitForFunction(() => {
    const w = document.querySelector("#measurementWeight");
    return w && String(w.value || "").trim() !== "";
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);

  // KRİTİK: auto-open gerçekleşti
  const after = await page.evaluate(() => ({
    open: document.querySelector("#measurementDetailFields")?.open,
    bmrValue: (document.querySelector("#measurementBmr")?.value || "").trim(),
  }));
  expect(after.bmrValue, "detay alanı (bmr) CSV'den doldu").not.toBe("");
  expect(after.open, "KRİTİK: details AUTO-OPEN (gizli veri riski yok)").toBe(true);

  // Manuel sekmeye geç → detay alanı gerçekten GÖRÜNÜR
  await page.evaluate(() => document.querySelector('[data-measurement-tab-target="manual"]')?.click());
  await page.waitForTimeout(400);
  const visible = await page.evaluate(() => {
    const bmr = document.querySelector("#measurementBmr");
    return !!(bmr && bmr.offsetParent !== null);
  });
  expect(visible, "Manuel sekmede detay alanı görünür (details açık)").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Native toggle: summary tıkla aç/kapa (kullanıcı kontrolü korunur)
// ════════════════════════════════════════════════════════════════════════════
test("Detaylı Ölçümler summary toggle — aç/kapa", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "measurements");
  await page.waitForTimeout(400);

  const states = await page.evaluate(() => {
    const details = document.querySelector("#measurementDetailFields");
    const summary = details?.querySelector(":scope > summary");
    const initial = details?.open;
    summary?.click();
    const afterOpen = details?.open;
    summary?.click();
    const afterClose = details?.open;
    return { initial, afterOpen, afterClose };
  });

  expect(states.initial, "başlangıç kapalı").toBe(false);
  expect(states.afterOpen, "tık → açık").toBe(true);
  expect(states.afterClose, "tekrar tık → kapalı (kullanıcı kontrolü)").toBe(false);

  assertNoErrors(errors);
});
