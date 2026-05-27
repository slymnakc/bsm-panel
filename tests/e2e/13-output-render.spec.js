// 13-output-render.spec.js — Output domain regression baseline (4A.2 oncesi)
//
// Amac: 4A.2 (output domain extract) baslamadan once asagidaki davranislari kilit altina almak:
//   1. Empty state (program yok) — output paneli render olur, panik yok
//   2. Member + plan seed — output panel + action butonlar + result card'lar DOM'da
//   3. PDF button — empty state'de fetch ATILMAZ; plan seed sonrasi fetch ATILIR
//   4. HTML export button — empty state'de Blob OLUSMAZ; plan seed sonrasi createObjectURL CAGRILIR
//   5. Console / page error 0
//
// Mock/server altyapisi YOK — real /api/program-pdf endpoint kullanir (server uygulamada
// real PDF doner). Test sadece istegin atilip atilmadigini gozlemler, response icerigini
// dogrulamaz. Mail/Resend test kapsamasi YOK.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

const STORAGE_KEY_PLAN = "formaplan-studio-last-plan";

// ═══════════════════════════════════════════════════════════════════
// Test 1 — EMPTY STATE BASELINE
// Member seeded (DEFAULT_MEMBER, programs:[]). Plan localStorage'da YOK.
// Output panel DOM render olur; PDF/HTML butonlari click sonrasi handler
// erken return'u tetikler — fetch/Blob ATILMAZ, status mesaji doldurulur.
// ═══════════════════════════════════════════════════════════════════
test("Output panel empty state — DOM render + action button erken return", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Network sniffer kur — empty state'de /api/program-pdf cagrilmamalı
  const pdfRequests = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/program-pdf")) pdfRequests.push(req.url());
  });

  // createObjectURL spy — empty state'de Blob URL olusturulmamalı
  await page.evaluate(() => {
    window.__test_objUrlCount = 0;
    const orig = window.URL.createObjectURL.bind(window.URL);
    window.URL.createObjectURL = function (...args) {
      window.__test_objUrlCount += 1;
      return orig(...args);
    };
  });

  await navigate(page, "output");
  await page.waitForTimeout(500);

  // ─── GRUP 1: Output panel + result cards + action buttons DOM ─────
  const dom = await page.evaluate(() => {
    const panel = document.querySelector("#resultsSection");
    return {
      panelExists: !!panel,
      dataScreen: panel?.getAttribute("data-screen"),
      // Action buttons
      pdfBtn: !!document.querySelector("#programPdfActionButton"),
      htmlBtn: !!document.querySelector("#downloadLiveProgramButton"),
      mailBtn: !!document.querySelector("#sendProgramMailButton"),
      deliveryStatus: !!document.querySelector("#programDeliveryStatus"),
      // Result card containers (program output + nutrition output + intelligence)
      programOverview: !!document.querySelector("#programOverview"),
      weeklyPlan: !!document.querySelector("#weeklyPlan"),
      outputNutritionPlan: !!document.querySelector("#outputNutritionPlan"),
      trainingReportPanel: !!document.querySelector("#trainingReportPanel"),
      aiReportSummary: !!document.querySelector("#aiReportSummary"),
      outputWarnings: !!document.querySelector("#outputWarnings"),
    };
  });

  expect(dom.panelExists, "#resultsSection DOM'da").toBe(true);
  expect(dom.dataScreen, "data-screen='output'").toBe("output");
  expect(dom.pdfBtn, "PDF action button mount").toBe(true);
  expect(dom.htmlBtn, "HTML download button mount").toBe(true);
  expect(dom.mailBtn, "Mail button mount").toBe(true);
  expect(dom.deliveryStatus, "Delivery status container mount").toBe(true);
  expect(dom.programOverview, "Program overview card mount").toBe(true);
  expect(dom.weeklyPlan, "Weekly plan card mount").toBe(true);
  expect(dom.outputNutritionPlan, "Nutrition output card mount").toBe(true);
  expect(dom.trainingReportPanel, "Training report (intelligence) card mount").toBe(true);
  expect(dom.aiReportSummary, "AI report summary card mount").toBe(true);
  expect(dom.outputWarnings, "Output warnings card mount").toBe(true);

  // ─── GRUP 2: PDF button — empty state click → no-fetch + status mesaji ─
  await page.evaluate(() => document.querySelector("#programPdfActionButton")?.click());
  await page.waitForTimeout(500);

  const afterPdfClick = await page.evaluate(() => ({
    statusText: (document.querySelector("#programDeliveryStatus")?.textContent || "").trim(),
  }));

  expect(pdfRequests.length, "Program yokken /api/program-pdf cagrilmamali (early return)").toBe(0);
  expect(afterPdfClick.statusText.length, "Status mesaji doldurulmali (handler calisti)").toBeGreaterThan(0);
  expect(/program|olustur|once/i.test(afterPdfClick.statusText), `PDF empty state status: "${afterPdfClick.statusText}"`).toBe(true);

  // ─── GRUP 3: HTML button — empty state click → no-blob + status mesaji ─
  await page.evaluate(() => document.querySelector("#downloadLiveProgramButton")?.click());
  await page.waitForTimeout(500);

  const afterHtmlClick = await page.evaluate(() => ({
    objUrlCount: window.__test_objUrlCount,
    statusText: (document.querySelector("#programDeliveryStatus")?.textContent || "").trim(),
  }));

  expect(afterHtmlClick.objUrlCount, "Program yokken HTML Blob ObjectURL olusturulmamali").toBe(0);
  expect(/program|olustur|once/i.test(afterHtmlClick.statusText), `HTML empty state status: "${afterHtmlClick.statusText}"`).toBe(true);

  // ─── GRUP 4: Console / page error kontrolu ─────────────────────────
  assertNoErrors(errors);
});

// ═══════════════════════════════════════════════════════════════════
// Test 2 — PLAN SEEDED HAPPY PATH
// localStorage'a minimal plan inject + reload. Output panel'a navigate
// edildiginde loadLastPlan plan'i okur. PDF/HTML butonlari fetch/Blob
// flow'unu tetikler. Test fetch'in atildigini ve createObjectURL'un
// cagrildigini gozlemler — gercek PDF/HTML icerigi test edilmez.
// ═══════════════════════════════════════════════════════════════════
test("Output panel plan seeded — PDF fetch + HTML Blob flow", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Minimal valid plan inject (schemaVersion 3 + temel alanlar — data-migrations
  // normalizePlan icin yeterli; buildProgramPdfPayload basic alanlari okur).
  await page.evaluate((key) => {
    const minimalPlan = {
      schemaVersion: 3,
      title: "Test Programı",
      createdAtIso: "2026-05-27T00:00:00.000Z",
      createdAt: "27.05.2026",
      coachNote: "Regression test plani.",
      overview: [["Hedef", "Test"], ["Seviye", "Orta"]],
      sessions: [
        {
          dayId: "monday",
          dayLabel: "Pazartesi",
          dayName: "Pazartesi",
          blocks: [
            {
              name: "Isınma",
              exercises: [
                { name: "Bisiklet", sets: 1, reps: "5 dk", rest: "-", tempo: "-", notes: "" },
              ],
            },
          ],
        },
      ],
      progression: [],
      guidance: [],
      coverage: {},
      rawData: {
        memberName: "Test Üye",
        goal: "muscle-gain",
        level: "intermediate",
        days: ["monday"],
      },
    };
    localStorage.setItem(key, JSON.stringify(minimalPlan));
  }, STORAGE_KEY_PLAN);

  // Reload — loadLastPlan plan'i pick up etsin
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  // Network sniffer kur (reload sonrasi yeniden — page.on listener'lar korunur
  // ama temizleyip net baslangic yapalim)
  const pdfRequests = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/program-pdf")) pdfRequests.push(req.url());
  });

  // createObjectURL spy reload sonrasi YENIDEN kurulmali (window yeniden olustu)
  await page.evaluate(() => {
    window.__test_objUrlCount = 0;
    const orig = window.URL.createObjectURL.bind(window.URL);
    window.URL.createObjectURL = function (...args) {
      window.__test_objUrlCount += 1;
      return orig(...args);
    };
  });

  await navigate(page, "output");
  await page.waitForTimeout(500);

  // ─── GRUP 1: Plan loaded — output panel hala render oluyor ────────
  const loadedDom = await page.evaluate(() => ({
    panelExists: !!document.querySelector("#resultsSection"),
    pdfBtn: !!document.querySelector("#programPdfActionButton"),
    htmlBtn: !!document.querySelector("#downloadLiveProgramButton"),
  }));
  expect(loadedDom.panelExists, "Plan seed sonrasi panel hala DOM'da").toBe(true);
  expect(loadedDom.pdfBtn, "PDF button mount sonrasi").toBe(true);
  expect(loadedDom.htmlBtn, "HTML button mount sonrasi").toBe(true);

  // ─── GRUP 2: PDF click — fetch atilmali ────────────────────────────
  await page.evaluate(() => document.querySelector("#programPdfActionButton")?.click());
  // Fetch + server response icin yeterli sure (server real PDF olusturuyor)
  await page.waitForTimeout(2500);

  expect(pdfRequests.length, "Plan seed sonrasi /api/program-pdf cagrilmali (en az 1 istek)").toBeGreaterThanOrEqual(1);

  // ─── GRUP 3: HTML click — createObjectURL cagrilmali ───────────────
  await page.evaluate(() => document.querySelector("#downloadLiveProgramButton")?.click());
  // buildLiveProgramHtml + Blob olusturma icin yeterli sure
  await page.waitForTimeout(2000);

  const htmlResult = await page.evaluate(() => ({
    objUrlCount: window.__test_objUrlCount,
  }));
  expect(htmlResult.objUrlCount, "Plan seed sonrasi HTML createObjectURL cagrilmali").toBeGreaterThanOrEqual(1);

  // ─── GRUP 4: Console / page error kontrolu ─────────────────────────
  // allowNetwork: true — server PDF endpoint'i 4xx/5xx dondurebilir (test mode)
  // requestfailed olmaz ama bir guvenlik agi olarak network filtresi gevsek.
  assertNoErrors(errors, { allowNetwork: true });
});
