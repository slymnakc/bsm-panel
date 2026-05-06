const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

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

  if (req.url === "/api/send-program-mail" && req.method === "POST") {
    await handleSendProgramMail(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`BSM panel server running on port ${PORT}`);
});

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
        message: "Mail servisi yapılandırılmamış. Render ortamında RESEND_API_KEY ve MAIL_FROM tanımlanmalı.",
      });
      return;
    }

    const memberName = sanitizeText(payload.memberName || "Üye");
    const programText = sanitizeText(payload.programText || "");
    const pdfBuffer = createSimpleProgramPdf({
      title: "Bahçeşehir Spor Merkezi Antrenman Programı",
      memberName,
      programText,
    });
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

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Resend mail error", result);
      sendJson(res, response.status, {
        ok: false,
        message: result?.message || "Mail sağlayıcısı gönderimi reddetti.",
      });
      return;
    }

    sendJson(res, 200, { ok: true, message: "Mail gönderildi.", providerId: result.id || "" });
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

function createSimpleProgramPdf({ title, memberName, programText }) {
  const text = transliterateTurkish(`${title}\nÜye: ${memberName}\n\n${programText}`);
  const lines = wrapText(text, 92);
  const pages = chunkLines(lines, 42).slice(0, 3);

  if (chunkLines(lines, 42).length > 3) {
    pages[2].push("...");
    pages[2].push("Program metni kisaltilmistir. Tam canli HTML dosyasi ekte yer alir.");
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
    "Bahcesehir Spor Merkezi | Antrenman Programi",
    "",
    ...lines,
    "",
    `Sayfa ${pageNumber}/${totalPages}`,
  ].map((line) => `(${escapePdfString(line)}) Tj T*`);

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

  return chunks.length ? chunks : [["Program verisi bulunamadi."]];
}

function escapePdfString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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
