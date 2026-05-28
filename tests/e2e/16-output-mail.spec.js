// 16-output-mail.spec.js — Program mail gönderim regression baseline (4A.2.3 öncesi)
//
// AMAC: handleSendProgramMail (handlers/output-handlers.js) davranisini 4A.2.3 (mail
// extraction → output/outputMail.js) oncesi kilit altina almak. Mail flow:
//   program resolve → email validate → setProgramDeliveryStatus("Gönderiliyor") →
//   buildLiveProgramHtml(inlineImages:false) → buildProgramPdfPayload →
//   POST /api/send-program-email → mail history kayit → delivery status guncelle.
//
// GERCEK API CAGRISI YOK: /api/send-program-email page.route ile fake 200 intercept
// edilir (Playwright network intercept — server mock degil). Resend'e istek gitmez.
//
// 4A.2.3'te handleSendProgramMail output/outputMail.js'e tasinirken bu payload yapisi +
// history kaydi + status zinciri birebir korunmali.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

const MAIL_HISTORY_KEY = "bsm-program-mail-history-v1";
const MAIL_ENDPOINT = "**/api/send-program-email";

// Program record seed — hydrateActiveMemberSession → renderProgram → state.activeProgram
// (15-output-print.spec.js ile ayni minimal yapi).
const PROGRAM_RECORD_SEED = Object.freeze({
  id: "regression-mail-program-1",
  savedAtIso: "2026-05-28T00:00:00.000Z",
  savedAt: "28.05.2026",
  program: {
    schemaVersion: 3,
    title: "Mail Test Programı",
    createdAtIso: "2026-05-28T00:00:00.000Z",
    createdAt: "28.05.2026",
    coachNote: "Mail regression test programi.",
    overview: [
      ["Üye", "Test Üye"],
      ["Hedef", "Kas kazanımı"],
    ],
    sessions: [
      {
        dayId: "monday",
        dayLabel: "Pazartesi",
        dayName: "Pazartesi",
        exercises: [
          {
            id: "barbell-bench-press",
            name: "Barbell Bench Press",
            group: "chest",
            equipment: "barbell",
            sets: 3,
            reps: "10",
            rest: "60-90 sn",
            tempo: "2-0-2",
            notes: "",
          },
        ],
      },
    ],
    progression: [],
    guidance: [],
    coverage: [],
    rawData: {
      memberName: "Test Üye",
      memberEmail: "test@bsm.local",
      goal: "muscle-gain",
      level: "intermediate",
      days: ["monday"],
    },
  },
});

test("Output program mail — send flow + payload + history baseline", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Member'a program record inject (DEFAULT_MEMBER.profile.memberEmail = test@bsm.local mevcut)
  await page.evaluate(
    ({ member, programRecord }) => {
      const seeded = { ...member, programs: [programRecord] };
      localStorage.setItem("formaplan-studio-members", JSON.stringify([seeded]));
      localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
      // Onceki run'lardan kalan mail history temizligi (test izolasyonu)
      localStorage.removeItem("bsm-program-mail-history-v1");
    },
    { member: DEFAULT_MEMBER, programRecord: PROGRAM_RECORD_SEED },
  );

  // Reload → hydrateActiveMemberSession → renderProgram (state.activeProgram + resultsSection dolu)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  // ─── page.route intercept — /api/send-program-email fake 200 (Resend'e istek YOK) ───
  let mailRequestCount = 0;
  let capturedPayload = null;
  await page.route(MAIL_ENDPOINT, async (route) => {
    mailRequestCount += 1;
    try {
      capturedPayload = JSON.parse(route.request().postData() || "{}");
    } catch (e) {
      capturedPayload = null;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, message: "Mail gönderildi.", pdfCreated: true }),
    });
  });

  await navigate(page, "output");
  await page.waitForTimeout(500);

  // ─── GUARD: program + mail button hazir mi? ─────────────────────────
  const ready = await page.evaluate(() => ({
    activeProgram: Boolean(window.__bsm?.state?.activeProgram),
    mailBtn: !!document.querySelector("#sendProgramMailButton"),
  }));
  expect(ready.activeProgram, "state.activeProgram seed ile dolu (hydrateActiveMemberSession)").toBe(true);
  expect(ready.mailBtn, "#sendProgramMailButton DOM'da").toBe(true);

  // ─── Mail button click → handleSendProgramMail tetiklenir ───────────
  await page.evaluate(() => document.querySelector("#sendProgramMailButton")?.click());
  // buildLiveProgramHtml + buildProgramPdfPayload + fetch + history + render icin yeterli sure
  await page.waitForTimeout(2500);

  // ─── 1. Bind + POST atimi ───────────────────────────────────────────
  expect(mailRequestCount, "Mail button click → /api/send-program-email POST atildi (bind calisti)").toBeGreaterThanOrEqual(1);
  expect(capturedPayload, "POST payload yakalandi").not.toBeNull();

  // ─── 2. Payload alanlari (member/program/pdf/html/mail) ─────────────
  expect(capturedPayload.to, "payload.to = recipient email").toBe("test@bsm.local");
  expect((capturedPayload.memberName || "").length, "payload.memberName dolu").toBeGreaterThan(0);
  expect(typeof capturedPayload.programText, "payload.programText string").toBe("string");
  expect((capturedPayload.programText || "").length, "payload.programText dolu").toBeGreaterThan(0);
  expect(capturedPayload.programData, "payload.programData object").toBeTruthy();
  expect(Array.isArray(capturedPayload.programData?.sessions), "payload.programData.sessions array").toBe(true);
  expect((capturedPayload.message || "").length, "payload.message (mail body) dolu").toBeGreaterThan(0);
  // htmlAttachment (buildLiveProgramHtml çıktısı base64)
  expect(capturedPayload.htmlAttachment, "payload.htmlAttachment object").toBeTruthy();
  expect((capturedPayload.htmlAttachment?.filename || "").endsWith(".html"), "htmlAttachment.filename .html").toBe(true);
  expect((capturedPayload.htmlAttachment?.contentBase64 || "").length, "htmlAttachment.contentBase64 dolu (buildLiveProgramHtml base64)").toBeGreaterThan(0);

  // ─── 3. Mail history localStorage'a yazildi (status Başarılı) ────────
  const afterSend = await page.evaluate((key) => {
    const history = JSON.parse(localStorage.getItem(key) || "[]");
    const statusText = (document.querySelector("#programDeliveryStatus")?.textContent || "").trim();
    return {
      historyLength: history.length,
      topStatus: history[0]?.status || "",
      topEmail: history[0]?.email || "",
      statusText,
    };
  }, MAIL_HISTORY_KEY);

  expect(afterSend.historyLength, "mail history localStorage'a yazildi (>=1)").toBeGreaterThanOrEqual(1);
  expect(afterSend.topStatus, "history[0].status = Başarılı (fake 200)").toBe("Başarılı");
  expect(afterSend.topEmail, "history[0].email = recipient").toBe("test@bsm.local");

  // ─── 4. Delivery status guncellendi ─────────────────────────────────
  expect(/başarı|gönderildi|success/i.test(afterSend.statusText), `delivery status success mesaji (gerçek: "${afterSend.statusText}")`).toBe(true);

  // ─── 5. Console / page error yok ────────────────────────────────────
  // allowNetwork: true — intercept edilen mail endpoint + CDN istekleri test odagi disinda
  assertNoErrors(errors, { allowNetwork: true });
});
