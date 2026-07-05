// 39-program-pdf-layout.spec.js — BUG-PDF-002 Faz 1: Program PDF layout sadeleşmesi
// Üyeye verilen antrenman PDF'i: tek kolon, dinamik kart yüksekliği, teknik model
// bilgisi gizli, İngilizce "Sets" yerine Türkçe "Set/Tekrar", metrics ayrı satır.
// Türkçe font embedding FAZ 2 — bu spec kapsamı dışı.
//
// PDF, /api/program-pdf'e POST edilip response (uncompressed PDF bytes) üzerinden
// ASCII metin komutları doğrulanır. Program gerçek form submit ile üretilir.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

// Builder'da pyramid preset ile program üretir, PDF payload'ı /api/program-pdf'e
// POST eder, PDF response'unu (latin1 decode → ASCII komutları korunur) döndürür.
async function generateAndFetchPdf(page, { presetId = "pyramid-4-12-10-8-6", goal = "muscle-gain" } = {}) {
  await navigate(page, "builder");
  await page.waitForTimeout(400);

  return page.evaluate(async (cfg) => {
    document.querySelector("#fillExampleButton")?.click();
    await new Promise((r) => setTimeout(r, 150));
    const g = document.querySelector("#goal");
    if (g) { g.value = cfg.goal; g.dispatchEvent(new Event("change", { bubbles: true })); }
    const m = document.querySelector("#defaultRepModel");
    const s = document.querySelector("#defaultSetCount");
    if (m) m.value = "pyramid";
    if (s) s.value = "4";
    m?.dispatchEvent(new Event("change", { bubbles: true }));
    s?.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    const ps = document.querySelector("#defaultRepPreset");
    if (ps && [...ps.options].some((o) => o.value === cfg.presetId)) {
      ps.value = cfg.presetId; ps.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 120));
    document.querySelector("#plannerForm")?.requestSubmit();
    await new Promise((r) => setTimeout(r, 600));

    let program = null;
    try { program = JSON.parse(localStorage.getItem("formaplan-studio-last-plan") || "null"); } catch (e) { /* */ }
    const payload = window.BSMTestApi.buildProgramPdfPayloadForTest(program);

    const resp = await fetch("/api/program-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify(payload),
    });
    const status = resp.status;
    const ct = resp.headers.get("content-type") || "";
    const buf = await resp.arrayBuffer();
    const text = new TextDecoder("latin1").decode(new Uint8Array(buf));
    return { status, ct, len: buf.byteLength, text };
  }, { presetId, goal });
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Üyeye sade içerik: Model/Sets gizli, Türkçe Set/Tekrar var
// ════════════════════════════════════════════════════════════════════════════
test("PDF üye içeriği sadeleşti — Model/Sets yok, Türkçe Set/Tekrar var", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  expect(pdf.status, "PDF endpoint 200").toBe(200);
  // Teknik model bilgisi üyeye gösterilmez
  expect(/Model:/.test(pdf.text), "PDF'te 'Model:' YOK").toBe(false);
  expect(/\bSets:/.test(pdf.text), "PDF'te İngilizce 'Sets:' YOK").toBe(false);
  // Türkçe sade format var
  expect(/Set\/Tekrar/.test(pdf.text), "PDF'te 'Set/Tekrar' var").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Endpoint smoke: 200 + application/pdf + non-empty
// ════════════════════════════════════════════════════════════════════════════
test("PDF endpoint smoke — 200 + application/pdf + non-empty", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  expect(pdf.status, "HTTP 200").toBe(200);
  expect(/application\/pdf/.test(pdf.ct), `content-type application/pdf (gerçek: ${pdf.ct})`).toBe(true);
  expect(pdf.len, "PDF gövdesi boş değil (>1000 byte)").toBeGreaterThan(1000);
  expect(/^%PDF-/.test(pdf.text), "PDF magic header").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Layout restructure: eski iki-kolon sabit kart + metrics-join yok
// ════════════════════════════════════════════════════════════════════════════
test("Layout restructure — sabit 54pt iki-kolon kart ve metrics-join kalktı", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  // Eski sabit kart: drawRect(..., 244, 54) → "244 54 re" komutu. Tek-kolon+dinamik → yok.
  expect(/244 54 re/.test(pdf.text), "eski iki-kolon sabit 54pt kart komutu YOK").toBe(false);
  // Eski metrics tek satırı "  |  " ile birleştiriyordu → ayrı satırlara bölündü.
  expect(/ {2}\| {2}/.test(pdf.text), "eski '  |  ' metrics-join YOK").toBe(false);
  // Ayrı satırlar mevcut
  expect(/Dinlenme:/.test(pdf.text), "'Dinlenme:' ayrı alan var").toBe(true);
  expect(/Tempo:/.test(pdf.text), "'Tempo:' ayrı alan var").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Set/Tekrar Türkçe formatı: seçilen pattern korunur (BUG-SET-001 uyumu)
// ════════════════════════════════════════════════════════════════════════════
test("Set/Tekrar Türkçe format — seçilen pattern PDF'te korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page, { presetId: "pyramid-4-12-10-8-6", goal: "muscle-gain" });

  expect(pdf.status, "200").toBe(200);
  // Seçilen 12-10-8-6 pattern PDF'te (BUG-SET-001 regresyon)
  expect(/12-10-8-6/.test(pdf.text), "seçilen 12-10-8-6 pattern PDF'te var").toBe(true);
  // Türkçe "set x ... tekrar" formatı
  expect(/set x .*tekrar|Set\/Tekrar/.test(pdf.text), "Türkçe set/tekrar formatı").toBe(true);

  assertNoErrors(errors);
});
