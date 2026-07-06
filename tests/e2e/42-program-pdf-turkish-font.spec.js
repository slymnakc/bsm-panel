// 42-program-pdf-turkish-font.spec.js — BUG-PDF-002 Faz 2: Türkçe font embedding
// Program PDF'inde base-14 Helvetica yerine gömülü TrueType font kullanılır:
//   /Subtype /TrueType + /FontDescriptor + /FontFile2 + /Widths + /ToUnicode
// WinAnsiEncoding + /Differences [128 ğĞİışŞ] düzeni ve encodePdfWinAnsiText
// byte mapping'i (ğ=128 Ğ=129 İ=130 ı=131 ş=132 Ş=133) AYNEN korunur.
//
// NOT: Kontrol-aralığı byte'ları (0x80-0x85) String.fromCharCode ile üretilir
// (kaynak dosyada raw kontrol karakteri tutulmaz). Görsel glyph doğrulaması
// headless'ta PDF viewer olmadığından ayrı diag screenshot ile yapılır (rapor);
// burada binary imzalar kilitlenir.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(120000);

// codes/string karışımını latin1 dizgisine çevirir
function B(...parts) {
  return parts.map((p) => (typeof p === "number" ? String.fromCharCode(p) : p)).join("");
}

// 39-spec deseni: builder'da gerçek program üret + Türkçe üye adıyla PDF çek.
async function generateAndFetchPdf(page, { memberName = "Çağrı Şahin" } = {}) {
  await navigate(page, "builder");
  await page.waitForTimeout(400);

  return page.evaluate(async (cfg) => {
    document.querySelector("#fillExampleButton")?.click();
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector("#plannerForm")?.requestSubmit();
    await new Promise((r) => setTimeout(r, 700));

    let program = null;
    try { program = JSON.parse(localStorage.getItem("formaplan-studio-last-plan") || "null"); } catch (e) { /* */ }
    const payload = window.BSMTestApi.buildProgramPdfPayloadForTest(program);
    payload.memberName = cfg.memberName; // Türkçe karakter yolu
    if (payload.programData) payload.programData.memberName = cfg.memberName;

    const resp = await fetch("/api/program-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify(payload),
    });
    const buf = await resp.arrayBuffer();
    // DİKKAT: TextDecoder("latin1") tarayıcıda windows-1252'dir (0x80-0x9F'i
    // €/ƒ/„/… yapar). Byte-sadık latin1 için elle decode: codepoint == byte.
    const bytes = new Uint8Array(buf);
    let text = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      text += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return {
      status: resp.status,
      ct: resp.headers.get("content-type") || "",
      len: buf.byteLength,
      text,
    };
  }, { memberName });
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Türkçe payload encoding: 128-133 byte mapping korunur, "?" kaybı yok
// ════════════════════════════════════════════════════════════════════════════
test("Türkçe payload: 128-133 byte mapping korunur, karakter kaybı yok", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page, { memberName: "Çağrı Şahin - Işıl Özkan" });

  expect(pdf.status, "endpoint 200").toBe(200);
  // encodePdfWinAnsiText düzeni: ğ=128 Ğ=129 İ=130 ı=131 ş=132 Ş=133; ç/Ç/ö/Ö/ü/Ü latin1 native
  const cagriSahin = B("Ça", 128, "r", 131, " ", 133, "ahin"); // "Çağrı Şahin"
  const isil = B("I", 132, 131, "l");                          // "Işıl"
  const bahcesehir = B("Bahçe", 132, "ehir");                  // "Bahçeşehir" (başlıktan)
  expect(pdf.text.includes(cagriSahin), "'Çağrı Şahin' doğru byte dizilimi (ğ=128, ı=131, Ş=133)").toBe(true);
  expect(pdf.text.includes(isil), "'Işıl' doğru byte dizilimi (ş=132, ı=131)").toBe(true);
  expect(pdf.text.includes(bahcesehir), "'Bahçeşehir' doğru byte dizilimi (ç native, ş=132)").toBe(true);
  expect(pdf.text.includes("Ça?r?"), "'Çağrı'da ? fallback YOK").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Font embedding objeleri var; salt Type1 Helvetica ana font kalmadı
// ════════════════════════════════════════════════════════════════════════════
test("Font embedding: FontFile2 + TrueType + Descriptor + Widths + ToUnicode", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  expect(pdf.text.includes("/FontFile2"), "/FontFile2 var").toBe(true);
  expect(pdf.text.includes("/Subtype /TrueType"), "/Subtype /TrueType var").toBe(true);
  expect(pdf.text.includes("/FontDescriptor"), "/FontDescriptor var").toBe(true);
  expect(pdf.text.includes("/Widths"), "/Widths var").toBe(true);
  expect(pdf.text.includes("/ToUnicode"), "/ToUnicode var").toBe(true);
  expect(pdf.text.includes("/Differences [128 /gbreve /Gbreve /Idotaccent /dotlessi /scedilla /Scedilla]"),
    "mevcut Differences düzeni korunur").toBe(true);
  expect(/\/Subtype \/Type1 \/BaseFont \/Helvetica/.test(pdf.text),
    "salt Type1 Helvetica font tanımı KALMADI").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — ToUnicode bfchar mapping: 128-133 → doğru Unicode
// ════════════════════════════════════════════════════════════════════════════
test("ToUnicode CMap: 128-133 Türkçe bfchar mapping doğru", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  const pairs = [
    ["<80> <011F>", "ğ → U+011F"],
    ["<81> <011E>", "Ğ → U+011E"],
    ["<82> <0130>", "İ → U+0130"],
    ["<83> <0131>", "ı → U+0131"],
    ["<84> <015F>", "ş → U+015F"],
    ["<85> <015E>", "Ş → U+015E"],
  ];
  pairs.forEach(([needle, label]) => {
    expect(pdf.text.includes(needle), `bfchar ${label}`).toBe(true);
  });

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Render smoke: geçerli PDF + gömülü sfnt font stream'i
// ════════════════════════════════════════════════════════════════════════════
test("PDF render smoke: geçerli yapı + sfnt TTF stream'i gömülü", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  expect(pdf.status, "200").toBe(200);
  expect(/application\/pdf/.test(pdf.ct), "content-type pdf").toBe(true);
  expect(/^%PDF-/.test(pdf.text), "PDF magic header").toBe(true);
  expect(/%%EOF\s*$/.test(pdf.text), "PDF EOF").toBe(true);
  // FontFile2 stream'i sfnt magic ile başlar: 00 01 00 00 (TrueType outlines)
  const sfnt = "stream\n" + B(0, 1, 0, 0);
  expect(pdf.text.includes(sfnt), "FontFile2 stream'i sfnt (TrueType) magic içerir").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — Boyut: font gömülü → >100KB, <2MB
// ════════════════════════════════════════════════════════════════════════════
test("PDF boyutu: font gömülü aralıkta (100KB - 2MB)", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  expect(pdf.len, `boyut > 100KB (gerçek: ${Math.round(pdf.len / 1024)}KB — küçükse font gömülmemiş)`).toBeGreaterThan(100 * 1024);
  expect(pdf.len, `boyut < 2MB (gerçek: ${Math.round(pdf.len / 1024)}KB)`).toBeLessThan(2 * 1024 * 1024);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 6 — Faz 1 layout regresyonu: sadeleşme davranışları korunur
// ════════════════════════════════════════════════════════════════════════════
test("Faz 1 layout korunur: Model yok, Set/Tekrar var, eski kart izi yok", async ({ page }) => {
  const { errors } = await setupPage(page);
  const pdf = await generateAndFetchPdf(page);

  expect(/Model:/.test(pdf.text), "'Model:' YOK").toBe(false);
  expect(/\bSets:/.test(pdf.text), "İngilizce 'Sets:' YOK").toBe(false);
  expect(/Set\/Tekrar/.test(pdf.text), "'Set/Tekrar' var").toBe(true);
  expect(/Dinlenme:/.test(pdf.text), "'Dinlenme:' ayrı satır var").toBe(true);
  expect(/Tempo:/.test(pdf.text), "'Tempo:' ayrı satır var").toBe(true);
  expect(/244 54 re/.test(pdf.text), "eski iki-kolon 54pt kart izi YOK").toBe(false);
  expect(/ {2}\| {2}/.test(pdf.text), "eski '  |  ' metrics-join YOK").toBe(false);

  assertNoErrors(errors);
});
