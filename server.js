const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const MAX_BODY_SIZE = 18 * 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/health") {
    sendJson(res, 200, { ok: true, service: "bsm-panel" });
    return;
  }

  if ((req.url === "/api/send-program-email" || req.url === "/api/send-program-mail") && req.method === "POST") {
    await handleSendProgramMail(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`BSM panel server running on port ${PORT}`);
});

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

async function handleSendProgramMail(req, res) {
  try {
    const payload = await readJsonBody(req);
    const validationError = validateMailPayload(payload);

    if (validationError) {
      sendJson(res, 400, { ok: false, message: validationError });
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const mailFrom = process.env.MAIL_FROM;

    if (!resendApiKey || !mailFrom) {
      sendJson(res, 503, {
        ok: false,
        message: "Mail servisi yapılandırılmamış. .env veya Render ortam değişkenlerinde RESEND_API_KEY ve MAIL_FROM tanımlanmalı.",
      });
      return;
    }

    const memberName = sanitizeText(payload.memberName || "Üye");
    const programText = sanitizeText(payload.programText || "");
    let pdfBuffer;

    try {
      pdfBuffer = createPremiumProgramPdf({
        title: "Bahçeşehir Spor Merkezi Antrenman Programı",
        memberName,
        programText,
        programData: payload.programData,
      });
    } catch (error) {
      console.error("Program PDF generation error", error);
      sendJson(res, 500, { ok: false, message: "PDF oluşturulamadığı için mail gönderilmedi.", pdfCreated: false });
      return;
    }

    if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) {
      sendJson(res, 500, { ok: false, message: "PDF oluşturulamadığı için mail gönderilmedi.", pdfCreated: false });
      return;
    }
    const attachments = [
      {
        filename: "antrenman-programi.pdf",
        content: pdfBuffer.toString("base64"),
        content_type: "application/pdf",
      },
    ];

    if (payload.htmlAttachment?.contentBase64 && payload.htmlAttachment?.filename) {
      attachments.push({
        filename: sanitizeFilename(payload.htmlAttachment.filename, "canli-antrenman-programi.html"),
        content: String(payload.htmlAttachment.contentBase64),
        content_type: "text/html",
      });
    }

    const resendPayload = {
      from: mailFrom,
      to: [String(payload.to).trim()],
      subject: payload.subject || "Bahçeşehir Spor Merkezi | Size Özel Antrenman Programınız",
      text: payload.message,
      html: buildMailHtml(payload.message),
      attachments,
    };

    let response;

    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendPayload),
      });
    } catch (error) {
      console.error("Resend connection error", error);
      sendJson(res, 502, {
        ok: false,
        message: "Mail sağlayıcısına ulaşılamadı. İnternet bağlantısı, RESEND_API_KEY ve gönderici domain ayarlarını kontrol edin.",
        pdfCreated: true,
      });
      return;
    }
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Resend mail error", result);
      sendJson(res, response.status, {
        ok: false,
        message: result?.message || "Mail sağlayıcısı gönderimi reddetti.",
      });
      return;
    }

    sendJson(res, 200, { ok: true, message: "Mail gönderildi.", providerId: result.id || "", pdfCreated: true });
  } catch (error) {
    console.error("Program mail endpoint error", error);
    sendJson(res, 500, { ok: false, message: error.message || "Mail gönderimi sırasında hata oluştu." });
  }
}

function validateMailPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Geçersiz mail isteği.";
  }

  if (!isValidEmail(payload.to)) {
    return "Geçerli bir üye e-posta adresi gerekli.";
  }

  if (!payload.programText) {
    return "Mail eki için program verisi bulunamadı.";
  }

  return "";
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
        reject(new Error("Mail eki çok büyük. HTML dosyasındaki GIF boyutlarını azaltın."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("JSON verisi okunamadı."));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const safePath = path
    .normalize(decodeURIComponent(requestUrl.pathname))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath || "index.html");

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  });
  fs.createReadStream(filePath).pipe(res);
}

function createPremiumProgramPdf({ title, memberName, programText, programData }) {
  const model = buildProgramPdfModel({ title, memberName, programText, programData });
  const pages = buildPremiumProgramPdfPages(model).slice(0, 4);
  const objects = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const contentIds = pages.map((_, index) => 5 + index * 2);

  objects.push([1, "<< /Type /Catalog /Pages 2 0 R >>"]);
  objects.push([2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`]);
  objects.push([
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [128 /gbreve /Gbreve /Idotaccent /dotlessi /scedilla /Scedilla] >> >>",
  ]);

  pages.forEach((content, index) => {
    objects.push([
      pageIds[index],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`,
    ]);
    objects.push([contentIds[index], `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`]);
  });

  return buildPdf(objects);
}

function buildProgramPdfModel({ title, memberName, programText, programData }) {
  const data = programData && typeof programData === "object" ? programData : {};
  const sessions = Array.isArray(data.sessions) ? data.sessions : parseProgramTextToSessions(programText);
  const summary = [
    ["Üye", data.memberName || memberName || "Üye"],
    ["Hedef", data.goal || "Kişisel hedef"],
    ["Seviye", data.level || "Seviye belirtilmedi"],
    ["Haftalık düzen", data.daysText || data.frequency || "Haftalık plana göre"],
  ];

  return {
    title: title || data.title || "Bahçeşehir Spor Merkezi Antrenman Programı",
    memberName: data.memberName || memberName || "Üye",
    summary,
    sessions,
    generatedAt: new Date().toLocaleDateString("tr-TR"),
  };
}

function buildPremiumProgramPdfPages(model) {
  const pages = [];
  let commands = [];
  let y = 0;
  let pageNumber = 0;

  function startPage() {
    pageNumber += 1;
    commands = [];
    drawPageHeader(commands, model, pageNumber);
    y = 704;
  }

  function finishPage() {
    drawPageFooter(commands, pageNumber);
    pages.push(commands.join("\n"));
  }

  startPage();
  drawSummaryBlock(commands, model);
  y = 612;

  for (const session of model.sessions) {
    const exercises = Array.isArray(session.exercises) ? session.exercises : [];

    if (y < 150) {
      finishPage();
      startPage();
    }

    drawSessionHeader(commands, session, y);
    y -= 42;

    exercises.forEach((exercise, index) => {
      const column = index % 2;
      const needsNewRow = column === 0 && index > 0;

      if (needsNewRow) {
        y -= 64;
      }

      if (y < 92) {
        finishPage();
        startPage();
        drawSessionHeader(commands, session, y);
        y -= 42;
      }

      drawExerciseCard(commands, exercise, 42 + column * 256, y, 244, 54);
    });

    y -= exercises.length % 2 === 0 ? 76 : 140;
    drawSupportNotes(commands, session, y + 52);
    y -= 22;
  }

  if (y < 142) {
    finishPage();
    startPage();
  }

  drawNutritionNotice(commands, y);
  finishPage();
  return pages.length ? pages : [commands.join("\n")];
}

function drawPageHeader(commands, model, pageNumber) {
  drawRect(commands, 28, 760, 539, 54, "#082b35");
  drawRect(commands, 28, 754, 112, 6, "#d8ad63");
  addText(commands, 44, 792, "Bahçeşehir Spor Merkezi", 10, "#d8ad63");
  addText(commands, 44, 774, model.title, 16, "#ffffff", 52);
  addText(commands, 420, 792, `Sayfa ${pageNumber}`, 9, "#d8ad63");
  addText(commands, 420, 774, model.generatedAt || "", 9, "#ffffff");
}

function drawSummaryBlock(commands, model) {
  drawRect(commands, 28, 648, 539, 88, "#f6faf9", "#d9e5e3");
  addText(commands, 44, 714, model.memberName, 18, "#082b35", 36);
  addText(commands, 44, 696, "Üyeye verilecek sade antrenman planı", 9, "#1d6b74");

  model.summary.forEach((item, index) => {
    const x = 44 + index * 128;
    drawRect(commands, x, 660, 116, 28, "#ffffff", "#d9e5e3");
    addText(commands, x + 8, 678, item[0], 6.8, "#1d6b74");
    addText(commands, x + 8, 666, item[1], 8.6, "#082b35", 18);
  });
}

function drawSessionHeader(commands, session, y) {
  drawRect(commands, 28, y - 8, 539, 30, "#1d6b74");
  addText(commands, 42, y + 10, `${session.dayLabel || "Gün"} - ${session.title || "Antrenman"}`, 12, "#ffffff", 52);
  addText(commands, 420, y + 10, session.duration || "", 8, "#d8ad63", 18);
}

function drawExerciseCard(commands, exercise, x, y, width, height) {
  const name = exercise?.name || "Hareket";
  const group = exercise?.groupLabel || exercise?.group || "Kas grubu";
  drawRect(commands, x, y - height + 10, width, height, "#ffffff", "#d9e5e3");
  drawRect(commands, x, y - height + 10, 6, height, "#d8ad63");
  drawRect(commands, x + 12, y - 31, 34, 34, "#eef7f5", "#b9d3ce");
  addText(commands, x + 19, y - 12, "GIF", 7, "#1d6b74");
  addText(commands, x + 54, y - 6, name, 9.4, "#082b35", 31);
  addText(commands, x + 54, y - 20, group, 7.3, "#1d6b74", 31);

  const metrics = [
    `Set: ${exercise?.sets || "-"}`,
    `Tekrar: ${exercise?.reps || "-"}`,
    `Dinlenme: ${exercise?.rest || "-"}`,
    `Tempo: ${exercise?.tempo || "-"}`,
  ];
  addText(commands, x + 54, y - 34, metrics.join("  |  "), 6.8, "#384d55", 42);
  addText(commands, x + 54, y - 46, exercise?.cue || exercise?.note || "Kontrollü formda uygula.", 6.5, "#5c6c72", 42);
}

function drawSupportNotes(commands, session, y) {
  const text = [
    session.warmup ? `Isınma: ${session.warmup}` : "",
    session.cardioBlock ? `Kardiyo: ${session.cardioBlock}` : "",
    session.cooldown ? `Soğuma: ${session.cooldown}` : "",
  ].filter(Boolean).join("   ");

  if (!text) {
    return;
  }

  drawRect(commands, 42, y - 16, 511, 18, "#f8fbfb", "#d9e5e3");
  addText(commands, 52, y - 4, text, 6.6, "#384d55", 96);
}

function drawNutritionNotice(commands, y) {
  drawRect(commands, 28, y - 52, 539, 44, "#fffaf0", "#d8ad63");
  addText(commands, 44, y - 24, "Beslenme Bilgisi", 10, "#082b35");
  addText(commands, 44, y - 40, "Beslenme planı uygulama içindeki Beslenme sekmesinde sunulmaktadır.", 8, "#384d55", 84);
}

function drawPageFooter(commands, pageNumber) {
  drawLine(commands, 28, 50, 567, 50, "#d9e5e3");
  addText(commands, 42, 34, "Bahçeşehir Spor Merkezi | Üye Antrenman Programı", 7.5, "#5c6c72");
  addText(commands, 500, 34, `Sayfa ${pageNumber}`, 7.5, "#5c6c72");
}

function parseProgramTextToSessions(programText) {
  const lines = String(programText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [
    {
      dayLabel: "Program",
      title: "Antrenman Planı",
      duration: "",
      exercises: lines.slice(0, 22).map((line) => ({ name: line, groupLabel: "Program", sets: "-", reps: "-", rest: "-", tempo: "-", cue: "" })),
    },
  ];
}

function addText(commands, x, y, text, size = 9, color = "#082b35", maxChars = 80) {
  const lines = wrapTextByChars(text, maxChars).slice(0, 2);
  commands.push(`BT /F1 ${size} Tf ${pdfColor(color)} rg ${x} ${y} Td ${Math.round(size + 3)} TL`);
  lines.forEach((line, index) => {
    commands.push(`${index ? "T* " : ""}${encodePdfWinAnsiText(line)} Tj`);
  });
  commands.push("ET");
}

function drawRect(commands, x, y, width, height, fillColor, strokeColor = "") {
  commands.push(`${pdfColor(fillColor)} rg ${x} ${y} ${width} ${height} re f`);

  if (strokeColor) {
    commands.push(`${pdfColor(strokeColor)} RG ${x} ${y} ${width} ${height} re S`);
  }
}

function drawLine(commands, x1, y1, x2, y2, color = "#d9e5e3") {
  commands.push(`${pdfColor(color)} RG ${x1} ${y1} m ${x2} ${y2} l S`);
}

function pdfColor(hex) {
  const clean = String(hex || "#000000").replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function wrapTextByChars(value, maxChars) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function encodePdfWinAnsiText(value) {
  const turkishMap = {
    "ğ": 128,
    "Ğ": 129,
    "İ": 130,
    "ı": 131,
    "ş": 132,
    "Ş": 133,
  };
  let output = "";

  for (const char of String(value || "")) {
    const mapped = turkishMap[char];

    if (mapped) {
      output += String.fromCharCode(mapped);
      continue;
    }

    const code = char.charCodeAt(0);
    output += code <= 255 ? String.fromCharCode(code) : "?";
  }

  return `(${escapePdfString(output)})`;
}

function createSimpleProgramPdf({ title, memberName, programText }) {
  const text = `${title}\nÜye: ${memberName}\n\n${programText}`;
  const lines = wrapText(text, 92);
  const pages = chunkLines(lines, 42).slice(0, 3);

  if (chunkLines(lines, 42).length > 3) {
    pages[2].push("...");
    pages[2].push("Program metni kısaltılmıştır. Tam canlı HTML dosyası ekte yer alır.");
  }

  const objects = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const contentIds = pages.map((_, index) => 5 + index * 2);

  objects.push([1, "<< /Type /Catalog /Pages 2 0 R >>"]);
  objects.push([2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`]);
  objects.push([3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]);

  pages.forEach((pageLines, index) => {
    const content = buildPdfPageContent(pageLines, index + 1, pageIds.length);
    objects.push([
      pageIds[index],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`,
    ]);
    objects.push([contentIds[index], `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`]);
  });

  return buildPdf(objects);
}

function buildPdfPageContent(lines, pageNumber, totalPages) {
  const escapedLines = [
    "Bahçeşehir Spor Merkezi | Antrenman Programı",
    "",
    ...lines,
    "",
    `Sayfa ${pageNumber}/${totalPages}`,
  ].map((line) => `${encodePdfUnicodeText(line)} Tj T*`);

  return `BT\n/F1 10 Tf\n42 790 Td\n13 TL\n${escapedLines.join("\n")}\nET`;
}

function buildPdf(objects) {
  let output = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach(([id, body]) => {
    offsets[id] = Buffer.byteLength(output, "binary");
    output += `${id} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "binary");
  const maxId = Math.max(...objects.map(([id]) => id));
  output += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;

  for (let id = 1; id <= maxId; id += 1) {
    output += `${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "binary");
}

function wrapText(value, maxLength) {
  return String(value || "")
    .split(/\n/)
    .flatMap((line) => {
      const words = line.split(/\s+/).filter(Boolean);

      if (!words.length) {
        return [""];
      }

      const wrapped = [];
      let current = "";

      words.forEach((word) => {
        if (`${current} ${word}`.trim().length > maxLength) {
          wrapped.push(current);
          current = word;
        } else {
          current = `${current} ${word}`.trim();
        }
      });

      if (current) {
        wrapped.push(current);
      }

      return wrapped;
    });
}

function chunkLines(lines, size) {
  const chunks = [];

  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }

  return chunks.length ? chunks : [["Program verisi bulunamadı."]];
}

function escapePdfString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function encodePdfUnicodeText(value) {
  const littleEndian = Buffer.from(`\ufeff${String(value || "")}`, "utf16le");
  const bigEndian = Buffer.alloc(littleEndian.length);

  for (let index = 0; index < littleEndian.length; index += 2) {
    bigEndian[index] = littleEndian[index + 1];
    bigEndian[index + 1] = littleEndian[index];
  }

  return `<${bigEndian.toString("hex").toUpperCase()}>`;
}

function transliterateTurkish(value) {
  return String(value || "")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function buildMailHtml(message) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#102f3a;white-space:pre-line">${escapeHtml(message)}</div>`;
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function sanitizeFilename(value, fallback) {
  const sanitized = String(value || "")
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
