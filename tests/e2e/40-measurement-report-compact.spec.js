// 40-measurement-report-compact.spec.js — BSM-MEASURE-UX-001 Faz A
// Ölçüm raporu sadeleştirme:
//   1) Tek ölçümde (hasTrend=false) büyük "Trend ve Koç Aksiyon Planı" sayfası
//      hiç render edilmez.
//   2) Koç önerileri büyük 03 sayfasından çıkıp kompakt "Koç Notu" kartına taşınır
//      (her koşulda görünür).
//   3) Direnç / Empedans paneli <details class="measurement-tech-details"> altına
//      alınır (web'de default kapalı, print/PDF'te görünür).
//   4) Çekirdek bölümler (üye bilgileri, kompozisyon, segmental, sağlık, genel skor)
//      korunur.
//
// VERİ MODELİ NOTU: renderMeasurementReport, aktif ölçümü readMeasurementForm()
// üzerinden (form dolu) okur; form measurement id'si fresh olduğu için
// member.measurements'in TAMAMI "previous" sayılır → hasTrend = measurements.length>0.
// Bu yüzden:
//   - Tek ölçüm senaryosu  → member.measurements = []          (hasTrend false)
//   - Çoklu ölçüm senaryosu → member.measurements = [1 geçmiş]  (hasTrend true)
// Her iki senaryoda form 6 temel alanla doldurulur (gerçekçi aktif ölçüm).

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

test.setTimeout(90000);

// Geçmiş (önceki) ölçüm — çoklu senaryoda trend verisi üretir
const HISTORY_MEASUREMENT = Object.freeze({
  id: "history-measurement-1",
  date: "2026-04-01",
  weight: 82.0,
  fat: 22.5,
  muscleMass: 58.0,
  bmi: 25.8,
  visceralFat: 11,
  bmr: 1780,
  bodyWater: 55.0,
  source: "tanita",
});

// Aktif ölçüm için forma yazılacak temel alanlar
const FORM_VALUES = Object.freeze({
  measurementDate: "2026-06-15",
  measurementHeight: "178",
  measurementWeight: "79.4",
  measurementFat: "18.2",
  measurementMuscleMass: "60.5",
  measurementBmi: "25.1",
});

// member.measurements'i verilen geçmişle yeniden seed eder + reload + auth bypass
async function seedHistory(page, errors, measurements) {
  await page.evaluate(
    (data) => {
      const member = { ...data.member, measurements: data.measurements };
      localStorage.setItem("formaplan-studio-members", JSON.stringify([member]));
      localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
    },
    { member: DEFAULT_MEMBER, measurements },
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });
  await page.waitForTimeout(200);
  // reload sırasındaki init gürültüsünü temizle — assertNoErrors sadece rapor akışını görsün
  errors.console.length = 0;
  errors.page.length = 0;
  errors.network.length = 0;
}

// Ölçüm ekranına gider, formu doldurur, "Ölçüm Raporu Oluştur" tıklar,
// #measurementReportContent dolana kadar bekler.
async function openReport(page) {
  await navigate(page, "measurements");
  await page.evaluate((values) => {
    Object.entries(values).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = String(val);
    });
  }, FORM_VALUES);
  await page.waitForTimeout(120);
  await page.evaluate(() => document.querySelector("#buildMeasurementReportButton")?.click());
  await page.waitForFunction(
    () => {
      const c = document.querySelector("#measurementReportContent");
      return c && c.querySelector(".measurement-report-page");
    },
    { timeout: 8000 },
  ).catch(() => {});
  await page.waitForTimeout(250);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Tek ölçümde büyük Trend sayfası hiç render edilmez
// ════════════════════════════════════════════════════════════════════════════
test("Tek ölçümde Trend/Koç Aksiyon Planı sayfası render edilmez", async ({ page }) => {
  const { errors } = await setupPage(page);
  await seedHistory(page, errors, []); // hasTrend false
  await openReport(page);

  const r = await page.evaluate(() => {
    const c = document.querySelector("#measurementReportContent");
    return {
      hasTrendArticle: !!c.querySelector(".measurement-report-page--trend"),
      hasOldHeading: c.textContent.includes("Trend ve Koç Aksiyon Planı"),
      hasBigPlaceholder: c.textContent.includes("Trend analizi ikinci ölçümden itibaren otomatik oluşur"),
      rendered: !!c.querySelector(".measurement-report-page"),
    };
  });

  expect(r.rendered, "rapor render edildi (empty-state değil)").toBe(true);
  expect(r.hasTrendArticle, "trend article DOM'da OLMAMALI").toBe(false);
  expect(r.hasOldHeading, '"Trend ve Koç Aksiyon Planı" başlığı OLMAMALI').toBe(false);
  expect(r.hasBigPlaceholder, "büyük trend boş-placeholder OLMAMALI").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — 2+ ölçümde Trend sayfası korunur ve grafikler görünür
// ════════════════════════════════════════════════════════════════════════════
test("2+ ölçümde Trend sayfası render olur, grafikler görünür", async ({ page }) => {
  const { errors } = await setupPage(page);
  await seedHistory(page, errors, [HISTORY_MEASUREMENT]); // hasTrend true
  await openReport(page);

  const r = await page.evaluate(() => {
    const c = document.querySelector("#measurementReportContent");
    const trend = c.querySelector(".measurement-report-page--trend");
    return {
      hasTrendArticle: !!trend,
      trendVisible: trend ? trend.checkVisibility() : false,
      hasCharts: !!c.querySelector(".measurement-trend-grid, .ultra-trend-card, .measurement-trend-card"),
    };
  });

  expect(r.hasTrendArticle, "trend article render oldu").toBe(true);
  expect(r.trendVisible, "trend article görünür").toBe(true);
  expect(r.hasCharts, "trend grafikleri render oldu").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Kompakt "Koç Notu" kartı her koşulda görünür (tek ölçümde dahi)
// ════════════════════════════════════════════════════════════════════════════
test("Koç Notu kompakt kartı tek ölçümde görünür, en fazla 3 madde", async ({ page }) => {
  const { errors } = await setupPage(page);
  await seedHistory(page, errors, []); // tek ölçüm
  await openReport(page);

  const r = await page.evaluate(() => {
    const c = document.querySelector("#measurementReportContent");
    const card = c.querySelector(".compact-coach-note");
    const items = card ? card.querySelectorAll("article") : [];
    // Büyük 03 mimarisi kullanılmamalı (compact-trend-action-grid trend'e ait)
    return {
      hasCard: !!card,
      cardVisible: card ? card.checkVisibility() : false,
      itemCount: items.length,
      titleText: card ? card.textContent : "",
      empty: card ? card.textContent.trim().length === 0 : true,
    };
  });

  expect(r.hasCard, "compact-coach-note kartı DOM'da").toBe(true);
  expect(r.cardVisible, "koç notu kartı görünür").toBe(true);
  expect(r.itemCount, "en az 1 öneri maddesi").toBeGreaterThan(0);
  expect(r.itemCount, "en fazla 3 öneri maddesi (kompakt)").toBeLessThanOrEqual(3);
  expect(r.empty, "kart boş placeholder değil").toBe(false);
  expect(/Koç Notu/i.test(r.titleText), "kart başlığı Koç Notu").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Direnç/Empedans <details> altında, default kapalı, açılınca 5 satır
// ════════════════════════════════════════════════════════════════════════════
test("Empedans Detaylı Teknik Veriler details altında, default kapalı", async ({ page }) => {
  const { errors } = await setupPage(page);
  await seedHistory(page, errors, [HISTORY_MEASUREMENT]);
  await openReport(page);

  const before = await page.evaluate(() => {
    const c = document.querySelector("#measurementReportContent");
    const details = c.querySelector("details.measurement-tech-details");
    const summary = details?.querySelector(":scope > summary");
    const firstRow = details?.querySelector(".measurement-impedance-table > div");
    return {
      exists: !!details,
      isDetails: details ? details.tagName.toLowerCase() === "details" : false,
      summaryText: (summary?.textContent || "").trim(),
      openDefault: details ? details.open : null,
      rowCount: details ? details.querySelectorAll(".measurement-impedance-table > div").length : 0,
      rowVisibleClosed: firstRow ? firstRow.checkVisibility() : false,
    };
  });

  expect(before.exists, "measurement-tech-details DOM'da").toBe(true);
  expect(before.isDetails, "bir <details> elemanı").toBe(true);
  expect(/Detaylı Teknik Veriler/i.test(before.summaryText),
    `summary "Detaylı Teknik Veriler" (gerçek: "${before.summaryText}")`).toBe(true);
  expect(before.openDefault, "web'de default KAPALI").toBe(false);
  expect(before.rowCount, "5 direnç/empedans satırı mount").toBe(5);
  expect(before.rowVisibleClosed, "kapalıyken satırlar görünmez (kalabalık yapmaz)").toBe(false);

  // Kullanıcı açar → satırlar görünür
  await page.evaluate(() => {
    document.querySelector("details.measurement-tech-details")?.setAttribute("open", "");
  });
  await page.waitForTimeout(150);
  const afterOpen = await page.evaluate(() => {
    const row = document.querySelector(".measurement-tech-details .measurement-impedance-table > div");
    return row ? row.checkVisibility() : false;
  });
  expect(afterOpen, "açılınca empedans satırları görünür").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — Print/PDF'te empedans görünür kalır (window.print() yolu)
// Ölçüm raporu PDF'i window.print() ile üretilir; window.print() beforeprint
// event'ini tetikler. Faz A: beforeprint kapalı teknik details'i açar (empedans
// PDF'e düşmesin), afterprint geri kapatır. Modern Chromium kapalı <details>'i
// ::details-content content-visibility ile gizlediğinden salt-CSS reveal güvenilir
// değil; bu yüzden gerçek print yolu (beforeprint) doğrulanır.
// ════════════════════════════════════════════════════════════════════════════
test("Print modunda empedans değerleri görünür (PDF'ten düşmez)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await seedHistory(page, errors, [HISTORY_MEASUREMENT]);
  await openReport(page);

  // Ön koşul: web'de details kapalı
  const closedBefore = await page.evaluate(
    () => document.querySelector(".measurement-tech-details")?.open,
  );
  expect(closedBefore, "yazdırma öncesi web'de kapalı").toBe(false);

  // window.print() → beforeprint. Print moduna da geç (PDF render koşulu).
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.waitForTimeout(150);

  const duringPrint = await page.evaluate(() => {
    const details = document.querySelector(".measurement-tech-details");
    const row = document.querySelector(".measurement-tech-details .measurement-impedance-table > div");
    return {
      hasRow: !!row,
      open: details ? details.open : null,
      visibleInPrint: row ? row.checkVisibility() : false,
    };
  });

  // afterprint → geri kapatma
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.emulateMedia({ media: "screen" });
  await page.waitForTimeout(120);
  const restored = await page.evaluate(
    () => document.querySelector(".measurement-tech-details")?.open,
  );

  expect(duringPrint.hasRow, "empedans satırı DOM'da").toBe(true);
  expect(duringPrint.open, "beforeprint teknik details'i açar").toBe(true);
  expect(duringPrint.visibleInPrint, "KRİTİK: yazdırırken empedans satırı GÖRÜNÜR (PDF'e düşer)").toBe(true);
  expect(restored, "afterprint sonrası details tekrar kapanır (web sadeliği korunur)").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 6 — Çekirdek bölümler korunur (regresyon kalkanı)
// ════════════════════════════════════════════════════════════════════════════
test("Çekirdek ölçüm raporu bölümleri korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await seedHistory(page, errors, [HISTORY_MEASUREMENT]);
  await openReport(page);

  const r = await page.evaluate(() => {
    const c = document.querySelector("#measurementReportContent");
    const text = c.textContent;
    const has = (sel) => !!c.querySelector(sel);
    return {
      memberInfo: text.includes("Üye ve ölçüm bilgileri"),
      composition: has(".compact-report-section--composition"),
      bars: has(".measurement-bar"),
      segmental: has(".measurement-report-page--segmental"),
      healthIndicators: text.includes("Sağlık göstergeleri"),
      overallScore: has(".premium-executive-card") || has(".premium-score-ring"),
      scoreCards: has(".premium-score-card"),
    };
  });

  expect(r.memberInfo, "üye ve ölçüm bilgileri korunur").toBe(true);
  expect(r.composition, "vücut kompozisyonu bölümü korunur").toBe(true);
  expect(r.bars, "kompozisyon bar'ları korunur").toBe(true);
  expect(r.segmental, "segmental analiz sayfası korunur").toBe(true);
  expect(r.healthIndicators, "sağlık göstergeleri korunur").toBe(true);
  expect(r.overallScore, "genel skor/özet korunur").toBe(true);
  expect(r.scoreCards, "skor kartları korunur").toBe(true);

  assertNoErrors(errors);
});
