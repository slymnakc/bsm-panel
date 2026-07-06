// build-pdf-font.js — BUG-PDF-002 Faz 2: PDF gömme font verisi üretici (build-time)
//
// TTF dosyasını parse edip (head/hhea/hmtx/cmap/OS2/name) program PDF'inin
// ihtiyaç duyduğu her şeyi tek deterministik modüle yazar:
//   services/pdf-font-data.js  →  { fontName, base64, widths[32..255], metrikler }
//
// Runtime'da TTF parse YAPILMAZ — server.js yalnız bu hazır modülü require eder.
// Deterministiktir: aynı TTF → bayt-bayt aynı çıktı (tarih/rastgelelik yok).
//
// Kullanım:  node scripts/build-pdf-font.js
// Girdi:     assets/fonts/PTSans-Regular.ttf
// Çıktı:     services/pdf-font-data.js

"use strict";

const fs = require("fs");
const path = require("path");

const FONT_PATH = path.join(__dirname, "..", "assets", "fonts", "PTSans-Regular.ttf");
const OUT_PATH = path.join(__dirname, "..", "services", "pdf-font-data.js");

const ttf = fs.readFileSync(FONT_PATH);
const u16 = (o) => ttf.readUInt16BE(o);
const s16 = (o) => ttf.readInt16BE(o);
const u32 = (o) => ttf.readUInt32BE(o);

// ── sfnt tablo dizini ────────────────────────────────────────────────────────
if (u32(0) !== 0x00010000) throw new Error("TrueType (sfnt 00010000) değil");
const tables = {};
for (let i = 0; i < u16(4); i += 1) {
  const rec = 12 + i * 16;
  tables[ttf.toString("ascii", rec, rec + 4)] = { off: u32(rec + 8), len: u32(rec + 12) };
}
["head", "hhea", "hmtx", "cmap", "OS/2", "name"].forEach((t) => {
  if (!tables[t]) throw new Error(`gerekli tablo yok: ${t}`);
});

// ── metrikler ────────────────────────────────────────────────────────────────
const head = tables.head.off;
const unitsPerEm = u16(head + 18);
const scale = (v) => Math.round((v * 1000) / unitsPerEm);
const bbox = [s16(head + 36), s16(head + 38), s16(head + 40), s16(head + 42)].map(scale);
const hhea = tables.hhea.off;
const ascent = scale(s16(hhea + 4));
const descent = scale(s16(hhea + 6));
const numberOfHMetrics = u16(hhea + 34);
const os2 = tables["OS/2"].off;
const os2Version = u16(os2);
const fsType = u16(os2 + 8);
const capHeight = os2Version >= 2 ? scale(s16(os2 + 88)) : Math.round(ascent * 0.7);

// ── PostScript font adı (name tablosu, nameID=6) ─────────────────────────────
function readPostScriptName() {
  const base = tables.name.off;
  const count = u16(base + 2);
  const strOff = base + u16(base + 4);
  for (let i = 0; i < count; i += 1) {
    const rec = base + 6 + i * 12;
    const platform = u16(rec);
    const nameId = u16(rec + 6);
    if (nameId !== 6) continue;
    const len = u16(rec + 8);
    const off = strOff + u16(rec + 10);
    if (platform === 3) {
      // UTF-16BE
      let out = "";
      for (let j = 0; j < len; j += 2) out += String.fromCharCode(u16(off + j));
      return out;
    }
    return ttf.toString("ascii", off, off + len);
  }
  return "EmbeddedFont";
}
const fontName = readPostScriptName().replace(/[^A-Za-z0-9-]/g, "");

// ── cmap (3,1) format 4: unicode → glyph id ──────────────────────────────────
const cmap = tables.cmap.off;
let subOff = 0;
for (let i = 0; i < u16(cmap + 2); i += 1) {
  const rec = cmap + 4 + i * 8;
  if (u16(rec) === 3 && u16(rec + 2) === 1) { subOff = cmap + u32(rec + 4); break; }
}
if (!subOff) throw new Error("cmap (3,1) alt tablosu yok");
if (u16(subOff) !== 4) throw new Error(`cmap format 4 değil: ${u16(subOff)}`);
const segCount = u16(subOff + 6) / 2;
const endAt = subOff + 14;
const startAt = endAt + segCount * 2 + 2;
const deltaAt = startAt + segCount * 2;
const rangeAt = deltaAt + segCount * 2;

function gidOf(code) {
  for (let i = 0; i < segCount; i += 1) {
    const end = u16(endAt + i * 2);
    if (code > end) continue;
    const start = u16(startAt + i * 2);
    if (code < start) return 0;
    const delta = s16(deltaAt + i * 2);
    const rangeOffset = u16(rangeAt + i * 2);
    if (rangeOffset === 0) return (code + delta) & 0xffff;
    const gid = u16(rangeAt + i * 2 + rangeOffset + (code - start) * 2);
    return gid === 0 ? 0 : (gid + delta) & 0xffff;
  }
  return 0;
}

const hmtx = tables.hmtx.off;
const advOf = (gid) => u16(hmtx + Math.min(gid, numberOfHMetrics - 1) * 4);

// ── Widths 32..255: WinAnsi(CP1252) + Differences 128-133 Türkçe düzeni ──────
// server.js font tanımıyla birebir aynı encoding düzeni:
//   /BaseEncoding /WinAnsiEncoding /Differences [128 ğ Ğ İ ı ş Ş]
const CP1252_HIGH = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};
const TURKISH_DIFF = { 0x80: 0x011f, 0x81: 0x011e, 0x82: 0x0130, 0x83: 0x0131, 0x84: 0x015f, 0x85: 0x015e };

function unicodeOfByte(b) {
  if (TURKISH_DIFF[b] !== undefined) return TURKISH_DIFF[b];
  if (b >= 0x80 && b <= 0x9f) return CP1252_HIGH[b] || 0;
  return b; // latin1 aralığı unicode ile birebir
}

const widths = [];
for (let b = 32; b <= 255; b += 1) {
  const uc = unicodeOfByte(b);
  const gid = uc ? gidOf(uc) : 0;
  widths.push(gid ? scale(advOf(gid)) : scale(advOf(gidOf(0x20))));
}

// Türkçe glyph güvencesi — biri eksikse build FAIL (yanlış font seçimi erken yakalanır)
const missing = Object.entries(TURKISH_DIFF).filter(([, uc]) => gidOf(uc) === 0);
if (missing.length) throw new Error(`Fontta eksik Türkçe glyph: ${missing.map(([b, uc]) => `0x${(+b).toString(16)}→U+${uc.toString(16)}`).join(", ")}`);

// ── çıktı modülü ─────────────────────────────────────────────────────────────
const banner = `// pdf-font-data.js — OTOMATIK ÜRETİLDİ (node scripts/build-pdf-font.js) — ELLE DÜZENLEME
//
// Kaynak font: PT Sans Regular (assets/fonts/PTSans-Regular.ttf)
// Telif: (c) 2009 ParaType Ltd — Lisans: SIL Open Font License 1.1 (OFL).
// OFL, fontun uygulama/PDF içine GÖMÜLMESİNE izin verir; font dosyası tek başına
// yeniden satılamaz. Bu modül yalnız server-side program PDF üretiminde kullanılır
// (BUG-PDF-002 Faz 2 — Türkçe glyph embedding). Font ayrıca dağıtılmaz/linklenmez.
//
// İçerik: base64 TTF + WinAnsi/Differences(128-133 ğĞİışŞ) düzeninde 32..255 Widths
// + FontDescriptor metrikleri (1000/unitsPerEm ölçekli). Runtime TTF parse edilmez.`;

const out = `${banner}

"use strict";

module.exports = {
  fontName: ${JSON.stringify(fontName)},
  flags: 32,
  unitsPerEm: ${unitsPerEm},
  ascent: ${ascent},
  descent: ${descent},
  capHeight: ${capHeight},
  italicAngle: 0,
  stemV: 80,
  bbox: [${bbox.join(", ")}],
  firstChar: 32,
  lastChar: 255,
  widths: [
    ${(() => { const rows = []; for (let i = 0; i < widths.length; i += 16) rows.push(widths.slice(i, i + 16).join(", ")); return rows.join(",\n    "); })()},
  ],
  base64: ${JSON.stringify(ttf.toString("base64"))},
};
`;

fs.writeFileSync(OUT_PATH, out);
console.log("OK:", OUT_PATH);
console.log("fontName:", fontName, "| unitsPerEm:", unitsPerEm, "| fsType:", fsType);
console.log("ascent:", ascent, "| descent:", descent, "| capHeight:", capHeight, "| bbox:", bbox.join(","));
console.log("widths:", widths.length, "adet | ttf:", Math.round(ttf.length / 1024) + "KB | base64:", Math.round(Buffer.byteLength(ttf.toString("base64")) / 1024) + "KB");
console.log("turkish glyphs OK:", Object.values(TURKISH_DIFF).map((uc) => "U+" + uc.toString(16).toUpperCase()).join(" "));
