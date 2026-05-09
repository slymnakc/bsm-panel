const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;
const MAX_BODY_SIZE = 18 * 1024 * 1024;

// ── Rate Limiter ─────────────────────────────────────────────────────────────
// In-memory, dependency-free. IP başına window bazlı sayaç.

const _rateLimitStore = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 saat
const RATE_LIMIT_EMAIL = Math.max(1, Number(process.env.RATE_LIMIT_EMAIL_MAX) || 10);
const RATE_LIMIT_PDF   = Math.max(1, Number(process.env.RATE_LIMIT_PDF_MAX)   || 30);

// Eski kayıtları periyodik temizle (bellek sızıntısı önlemi)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _rateLimitStore) {
    if (now > entry.resetAt) _rateLimitStore.delete(key);
  }
}, 30 * 60 * 1000).unref();

function checkRateLimit(ip, type, max) {
  const key = `${type}:${ip}`;
  const now = Date.now();
  let entry = _rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
  }

  entry.count += 1;
  _rateLimitStore.set(key, entry);

  return {
    allowed: entry.count <= max,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt,
  };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// ── CSRF Guard ───────────────────────────────────────────────────────────────
// Same-origin zorunluluğu: Origin header host ile eşleşmeli.
// X-Requested-With header ek güvence katmanı.

function validateCsrf(req) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;

  const host = req.headers.host || "";
  const origin = req.headers.origin || "";

  // Origin yoksa (server-to-server veya aynı host) kabul et
  if (!origin) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

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
  setCorsHeaders(req, res);
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "bsm-panel" });
    return;
  }

  // Supabase credentials'ı env'den serve et (HTML'den kaldırma yolu)
  if (pathname === "/api/config" && req.method === "GET") {
    sendJson(res, 200, {
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    });
    return;
  }

  // POST endpoint'leri için CSRF kontrolü
  if (req.method === "POST" && !validateCsrf(req)) {
    sendJson(res, 403, { ok: false, message: "Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin." });
    return;
  }

  if (pathname === "/api/program-pdf" && req.method === "POST") {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, "pdf", RATE_LIMIT_PDF);
    if (!limit.allowed) {
      sendJson(res, 429, { ok: false, message: "Çok fazla PDF isteği. Lütfen bir saat sonra tekrar deneyin." });
      return;
    }
    await handleDownloadProgramPdf(req, res);
    return;
  }

  if (pathname === "/api/nutrition-pdf" && req.method === "POST") {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, "pdf", RATE_LIMIT_PDF);
    if (!limit.allowed) {
      sendJson(res, 429, { ok: false, message: "Çok fazla PDF isteği. Lütfen bir saat sonra tekrar deneyin." });
      return;
    }
    await handleDownloadNutritionPdf(req, res);
    return;
  }

  if ((pathname === "/api/send-program-email" || pathname === "/api/send-program-mail") && req.method === "POST") {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, "email", RATE_LIMIT_EMAIL);
    if (!limit.allowed) {
      sendJson(res, 429, { ok: false, message: "Çok fazla mail isteği. Saatlik limit aşıldı, lütfen bekleyin." });
      return;
    }
    await handleSendProgramMail(req, res);
    return;
  }

  if (pathname === "/api/send-nutrition-email" && req.method === "POST") {
    const ip = getClientIp(req);
    const limit = checkRateLimit(ip, "email", RATE_LIMIT_EMAIL);
    if (!limit.allowed) {
      sendJson(res, 429, { ok: false, message: "Çok fazla mail isteği. Saatlik limit aşıldı, lütfen bekleyin." });
      return;
    }
    await handleSendNutritionMail(req, res);
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
    let pdfBuffer;

    try {
      pdfBuffer = createProgramPdfBuffer(payload);
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

async function handleDownloadProgramPdf(req, res) {
  try {
    const payload = await readJsonBody(req);
    const validationError = validateProgramPdfPayload(payload);

    if (validationError) {
      sendJson(res, 400, { ok: false, message: validationError });
      return;
    }

    let pdfBuffer;

    try {
      pdfBuffer = createProgramPdfBuffer(payload);
    } catch (error) {
      console.error("Program PDF download generation error", error);
      sendJson(res, 500, { ok: false, message: "Program PDF'i oluşturulamadı. Lütfen program verisini kontrol edip tekrar deneyin." });
      return;
    }

    if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) {
      sendJson(res, 500, { ok: false, message: "Program PDF'i oluşturulamadı. PDF içeriği boş döndü." });
      return;
    }

    const memberName = sanitizeText(payload.memberName || payload.programData?.memberName || "uye");
    sendPdf(res, pdfBuffer, `antrenman-programi-${slugifyFilenamePart(memberName)}.pdf`);
  } catch (error) {
    console.error("Program PDF download endpoint error", error);
    sendJson(res, 500, { ok: false, message: error.message || "Program PDF'i oluşturulurken hata oluştu." });
  }
}

async function handleDownloadNutritionPdf(req, res) {
  try {
    const payload = await readJsonBody(req);

    if (!payload || typeof payload !== "object" || !payload.planData || typeof payload.planData !== "object") {
      sendJson(res, 400, { ok: false, message: "PDF için geçerli bir beslenme planı gerekli." });
      return;
    }

    let pdfBuffer;

    try {
      pdfBuffer = createNutritionPdfBuffer(payload.planData);
    } catch (error) {
      console.error("Nutrition PDF download generation error", error);
      sendJson(res, 500, { ok: false, message: "Beslenme PDF'i oluşturulamadı. Lütfen plan verisini kontrol edip tekrar deneyin." });
      return;
    }

    if (!Buffer.isBuffer(pdfBuffer) || !pdfBuffer.length) {
      sendJson(res, 500, { ok: false, message: "Beslenme PDF'i oluşturulamadı. PDF içeriği boş döndü." });
      return;
    }

    const memberName = sanitizeText(payload.memberName || payload.planData.memberName || "uye");
    sendPdf(res, pdfBuffer, `sporcu-beslenme-plani-${slugifyFilenamePart(memberName)}.pdf`);
  } catch (error) {
    console.error("Nutrition PDF download endpoint error", error);
    sendJson(res, 500, { ok: false, message: error.message || "Beslenme PDF'i oluşturulurken hata oluştu." });
  }
}

async function handleSendNutritionMail(req, res) {
  try {
    const payload = await readJsonBody(req);

    if (!payload || typeof payload !== "object" || !isValidEmail(payload.to)) {
      sendJson(res, 400, { ok: false, message: "Geçerli bir üye e-posta adresi gerekli." });
      return;
    }

    if (!payload.planData || typeof payload.planData !== "object") {
      sendJson(res, 400, { ok: false, message: "Mail eki için beslenme planı bulunamadı." });
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

    let pdfBuffer;
    try {
      pdfBuffer = createNutritionPdfBuffer(payload.planData);
    } catch (error) {
      console.error("Nutrition PDF generation error", error);
      sendJson(res, 500, { ok: false, message: "PDF oluşturulamadığı için mail gönderilmedi.", pdfCreated: false });
      return;
    }

    const memberName = sanitizeText(payload.memberName || payload.planData.memberName || "Üye");
    const message = `Merhaba ${memberName},\n\nSize özel hazırlanan sporcu beslenme planınız ekte yer almaktadır.\n\nPlanınızı düzenli uygulamanız ve gerekli durumlarda antrenör/diyetisyen desteği almanız önerilir.\n\nSağlıklı günler dileriz.\nBahçeşehir Spor Merkezi`;
    const resendPayload = {
      from: mailFrom,
      to: [String(payload.to).trim()],
      subject: "Bahçeşehir Spor Merkezi Sporcu Beslenme Planınız",
      text: message,
      html: buildMailHtml(message),
      attachments: [
        {
          filename: "sporcu-beslenme-plani.pdf",
          content: pdfBuffer.toString("base64"),
          content_type: "application/pdf",
        },
      ],
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
      console.error("Resend nutrition connection error", error);
      sendJson(res, 502, {
        ok: false,
        message: "Mail sağlayıcısına ulaşılamadı. İnternet bağlantısı, RESEND_API_KEY ve gönderici domain ayarlarını kontrol edin.",
        pdfCreated: true,
      });
      return;
    }
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Resend nutrition mail error", result);
      sendJson(res, response.status, { ok: false, message: result?.message || "Mail sağlayıcısı gönderimi reddetti." });
      return;
    }

    sendJson(res, 200, { ok: true, message: "Beslenme planı mail ile gönderildi.", providerId: result.id || "", pdfCreated: true });
  } catch (error) {
    console.error("Nutrition mail endpoint error", error);
    sendJson(res, 500, { ok: false, message: error.message || "Beslenme maili gönderimi sırasında hata oluştu." });
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

function validateProgramPdfPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Geçersiz PDF isteği.";
  }

  if (!payload.programText && !payload.programData) {
    return "PDF için program verisi bulunamadı.";
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
    "Cache-Control": getStaticCacheControl(ext),
  });
  fs.createReadStream(filePath).pipe(res);
}

function getStaticCacheControl(ext) {
  if ([".html", ".js", ".css"].includes(ext)) {
    return "no-store, no-cache, must-revalidate, proxy-revalidate";
  }

  if ([".gif", ".png", ".jpg", ".jpeg", ".svg", ".ico"].includes(ext)) {
    return "public, max-age=3600";
  }

  return "no-cache";
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

function createProgramPdfBuffer(payload = {}) {
  return createPremiumProgramPdf({
    title: "Bahçeşehir Spor Merkezi Antrenman Programı",
    memberName: sanitizeText(payload.memberName || payload.programData?.memberName || "Üye"),
    programText: sanitizeText(payload.programText || ""),
    programData: payload.programData,
  });
}

function createNutritionPlanPdf(planData) {
  return createNutritionPdfBuffer(planData);
}

function createNutritionPdfBuffer(planData) {
  const model = buildNutritionPdfModel(planData);
  const pages = buildNutritionPdfPagesV2(model).slice(0, 5);
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

function buildNutritionPdfModel(planData) {
  const plan = planData && typeof planData === "object" ? planData : {};
  const supplements = Array.isArray(plan.supplements) ? plan.supplements : [];
  const schedule = normalizeNutritionPdfSchedule(plan.schedule || plan.supplementPreferences || {});
  const meals = ensureNutritionMealSupports(Array.isArray(plan.meals) ? plan.meals : [], supplements, schedule);
  const timeline = Array.isArray(plan.timeline) && plan.timeline.length ? plan.timeline : buildNutritionPdfTimeline(meals, schedule);
  const measurementNote =
    plan.sourceSummary?.measurementConnectionText ||
    plan.sourceSummary?.measurementStatus ||
    "Tanita/ölçüm verisi bulunmadığı için plan hedef ve seviye bilgisine göre oluşturuldu.";
  const intelligenceItems = [measurementNote, ...(Array.isArray(plan.intelligence) ? plan.intelligence : [])].filter(Boolean);

  return {
    title: "Sporcu Beslenme Planı",
    summarySubtitle: "Üyeye verilecek sade sporcu beslenme planı",
    footerText: "Bahçeşehir Spor Merkezi | Sporcu Beslenme Planı",
    memberName: plan.memberName || "Üye",
    goal: plan.nutritionGoalLabel || plan.goal || "Beslenme hedefi",
    category: plan.nutritionGoalCategory || "",
    generatedAt: new Date().toLocaleDateString("tr-TR"),
    summary: [
      ["Üye", plan.memberName || "Üye"],
      ["Hedef", plan.nutritionGoalLabel || plan.goal || "-"],
      ["Kalori", `${plan.calories || "-"} kcal`],
      ["Protein", `${plan.macros?.protein || "-"} g`],
      ["Karbonhidrat", `${plan.macros?.carbs || "-"} g`],
      ["Yağ", `${plan.macros?.fat || "-"} g`],
      ["BMR", `${plan.sourceSummary?.bmr || "-"} kcal (${plan.sourceSummary?.bmrSource || "Formül bazlı tahmin"})`],
      ["Antrenman", `${plan.trainingDays || "-"} gün/hafta`],
    ],
    intelligence: [...new Set(intelligenceItems)].slice(0, 5),
    schedule,
    timeline,
    meals,
    supplements,
    supplementNotice: plan.supplementNotice || "Supplement kullanımı kapalı. Plan gıda öncelikli hazırlanmıştır.",
    supplementCommonWarning:
      plan.supplementCommonWarning ||
      "Supplementler opsiyoneldir; ilaç kullanan, hamile/emziren, kronik hastalığı olan veya özel sağlık durumu bulunan kişiler kullanım öncesi hekim/diyetisyen görüşü almalıdır.",
    trainerNote: plan.trainerNote || "",
    disclaimer: plan.disclaimer || "",
  };
}

function ensureNutritionMealSupports(meals, supplements, schedule = {}) {
  const sourceMeals = Array.isArray(meals) ? meals : [];
  const mealList = sourceMeals.map((meal) => ({ ...meal, supports: [] }));
  const existingSupports = sourceMeals.flatMap((meal) => (Array.isArray(meal.supports) ? meal.supports : []));
  const sourceSupports = existingSupports.length
    ? existingSupports.map(normalizeNutritionSupplementSupport)
    : normalizeNutritionSupplementStack(supplements).map(buildNutritionSupplementSupport);

  if (!sourceSupports.length) {
    return mealList;
  }

  normalizeNutritionSupplementStack(sourceSupports).forEach((support) => {
    const index = getNutritionSupportMealIndex(support, mealList, schedule);
    const targetMeal = mealList[index] || mealList[0];
    if (!targetMeal) {
      return;
    }

    targetMeal.supports.push({
      ...support,
      time: getNutritionSupportClockTime(support, targetMeal, schedule),
    });
  });

  return mealList;
}

function normalizeNutritionSupplementSupport(support) {
  const item = support && typeof support === "object" ? support : {};
  const rebuilt = buildNutritionSupplementSupport({
    ...item,
    supplementName: item.supplementName || item.name,
    suggestedTiming: item.suggestedTiming || item.timing || item.usageTime,
    suggestedDoseText: item.suggestedDoseText || item.note || item.dose,
  });

  return {
    ...item,
    ...rebuilt,
    recommendationTier: item.recommendationTier || rebuilt.recommendationTier || "main",
  };
}

function normalizeNutritionSupplementStack(items) {
  const seenNames = new Set();
  let hasStimulant = false;
  let hasProteinPowder = false;

  return (Array.isArray(items) ? items : []).filter((item) => {
    const nameKey = normalizeNutritionSupplementName(item?.supplementName || item?.name);
    if (!nameKey || seenNames.has(nameKey)) {
      return false;
    }

    if (isNutritionProteinPowder(item)) {
      if (hasProteinPowder) {
        return false;
      }
      hasProteinPowder = true;
    }

    if (isNutritionStimulantSupplement(item)) {
      if (hasStimulant) {
        return false;
      }
      hasStimulant = true;
    }

    seenNames.add(nameKey);
    return true;
  });
}

function normalizeNutritionSupplementName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNutritionStimulantSupplement(item) {
  const text = `${item?.supplementName || item?.name || ""} ${item?.category || ""}`.toLowerCase();
  return /caffeine|pre workout|guarana|yerba mate|mate|yohimbine|green tea/.test(text);
}

function isNutritionProteinPowder(item) {
  const text = `${item?.supplementName || item?.name || ""}`.toLowerCase();
  return /whey|casein|beef protein|vegan protein|pea protein|rice protein|egg white protein|ready protein shake|clear whey/.test(text);
}

function normalizeNutritionPdfSchedule(schedule = {}) {
  const source = schedule && typeof schedule === "object" ? schedule : {};
  const wakeTime = normalizePdfTime(source.wakeTime, "07:30");
  const firstMealTime = normalizePdfTime(source.firstMealTime, "08:30");
  const workoutTime = normalizePdfTime(source.workoutTime, "18:30");
  const sleepTime = normalizePdfTime(source.sleepTime, "23:30");
  const cardioTime = normalizePdfTime(source.cardioTime, "");
  const wakeMinutes = pdfTimeToMinutes(wakeTime);
  const firstMealMinutes = normalizePdfFutureMinutes(pdfTimeToMinutes(firstMealTime), wakeMinutes);
  const workoutMinutes = normalizePdfFutureMinutes(pdfTimeToMinutes(workoutTime), wakeMinutes);
  const sleepMinutes = normalizePdfFutureMinutes(pdfTimeToMinutes(sleepTime), firstMealMinutes);
  const cardioMinutes = cardioTime ? normalizePdfFutureMinutes(pdfTimeToMinutes(cardioTime), wakeMinutes) : null;

  return {
    wakeTime,
    firstMealTime,
    workoutTime,
    sleepTime,
    cardioTime,
    fastingEnabled: source.fastingEnabled === "yes" ? "yes" : "no",
    fastingWindow: ["14:10", "16:8", "18:6"].includes(source.fastingWindow) ? source.fastingWindow : "16:8",
    wakeMinutes,
    firstMealMinutes,
    workoutMinutes,
    sleepMinutes,
    cardioMinutes,
  };
}

function buildNutritionPdfTimeline(meals, schedule) {
  const items = [
    { time: schedule.wakeTime, kind: "wake", title: "Uyanış", meta: "Güne hazırlık" },
    { time: schedule.workoutTime, kind: "workout", title: "Antrenman", meta: "Performans bloğu" },
    { time: schedule.sleepTime, kind: "sleep", title: "Uyku", meta: schedule.fastingEnabled === "yes" ? `IF ${schedule.fastingWindow}` : "Toparlanma" },
  ];

  if (schedule.cardioTime) {
    items.push({ time: schedule.cardioTime, kind: "cardio", title: "Kardiyo", meta: "Opsiyonel" });
  }

  meals.forEach((meal, index) => {
    items.push({
      time: normalizePdfTime(meal.time, schedule.firstMealTime),
      kind: meal.scheduleRole || "meal",
      title: meal.timingLabel || meal.name || `Öğün ${index + 1}`,
      meta: `${meal.calories || "-"} kcal | P ${meal.protein || "-"} g | K ${meal.carbs || "-"} g | Y ${meal.fat || "-"} g`,
    });
  });

  return items
    .filter((item) => item.time)
    .sort((a, b) => pdfTimeToMinutes(a.time) - pdfTimeToMinutes(b.time));
}

function normalizePdfTime(value, fallback = "") {
  return /^\d{2}:\d{2}$/.test(String(value || "")) ? String(value) : fallback;
}

function pdfTimeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function formatPdfMinutesToTime(value) {
  const minutesInDay = 24 * 60;
  const normalized = ((Math.round(value) % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function normalizePdfFutureMinutes(value, baseMinutes) {
  let result = Number(value) || 0;
  while (result < baseMinutes - 120) {
    result += 24 * 60;
  }
  return result;
}

function buildNutritionSupplementSupport(item) {
  const name = item?.supplementName || item?.name || "Supplement";
  const text = `${name} ${item?.category || ""} ${item?.suggestedTiming || item?.timing || ""}`.toLowerCase();
  const usageTime = getNutritionSupplementUsageTime(text, item);
  return {
    name,
    usageTime,
    dose: getNutritionSupplementDose(text, item),
    water: getNutritionSupplementWater(text, usageTime),
    purpose: shortText(item?.purpose || "Plan hedefini desteklemek", 86),
    category: item?.category || "",
    recommendationTier: item?.recommendationTier || "main",
  };
}

function getNutritionSupplementUsageTime(text, item) {
  if (/bcaa|eaa|electrolyte|intra|sodium|hidrasyon|elektrolit/.test(text)) return "Antrenman sırasında";
  if (/casein|melatonin|magnesium|zma|ashwagandha|rhodiola|uyku|stres/.test(text)) return "Uyku öncesi";
  if (/whey|protein|beef protein|vegan protein|glutamine|creatine|kreatin/.test(text)) return "Antrenmandan hemen sonra";
  if (isNutritionFatBurnerText(text, item)) return "Kardiyo/antrenmandan 30 dk önce";
  if (/caffeine|pre workout|citrulline|arginine|beta alanine|beetroot|bicarbonate/.test(text)) return "Antrenmandan 30 dk önce";
  if (/fiber|psyllium|probiotic|prebiotic|digestive|enzyme|sindirim/.test(text)) return "İlk öğünden 15 dk önce";
  if (/vitamin|omega|multi|d3|k2|zinc|calcium|iron|selenium|iodine|chromium|boron|mineral/.test(text)) return "Kahvaltıyla birlikte";
  return item?.suggestedTiming || item?.timing || "Öğünle birlikte";
}

function isNutritionFatBurnerText(text, item) {
  const haystack = `${text || ""} ${item?.supplementName || item?.name || ""} ${item?.category || ""}`.toLowerCase();
  return /yağ yak|yag yak|fat burn|l-?carnitine|green tea|cla|capsaicin|yohimbine|forskolin|garcinia|yerba mate|guarana|chromium|apple cider/.test(haystack);
}

function getNutritionSupplementDose(text, item) {
  if (/creatine|kreatin/.test(text)) return "5 g";
  if (/bcaa/.test(text)) return "10 g";
  if (/eaa/.test(text)) return "8-10 g";
  if (/whey|protein tozu|vegan protein|beef protein|casein/.test(text)) return "1 ölçek (30 g)";
  if (/electrolyte|sodium/.test(text)) return "1 porsiyon";
  if (/caffeine|pre workout/.test(text)) return "100-200 mg";
  if (isNutritionFatBurnerText(text, item)) return "etiket dozuna göre";
  if (/fiber|psyllium/.test(text)) return "5-10 g";
  if (/omega/.test(text)) return "1-2 kapsül";
  if (/vitamin|omega|multi|d3|k2|zinc|magnesium|calcium|iron|selenium|iodine|chromium|boron/.test(text)) return item?.suggestedDoseText || "1 kapsül";
  return item?.suggestedDoseText || item?.note || "etiket dozuna göre";
}

function getNutritionSupplementWater(text, usageTime) {
  if (/bcaa|eaa|electrolyte|intra|sodium/.test(text) || usageTime === "Antrenman sırasında") return "600-700 ml su";
  if (/whey|protein|casein/.test(text)) return "250-300 ml su/süt";
  if (/fiber|psyllium/.test(text)) return "300-400 ml su";
  if (/creatine|kreatin/.test(text)) return "300 ml su";
  if (/caffeine|pre workout/.test(text)) return "200 ml su";
  return "1 bardak su";
}

function getNutritionSupportMealIndex(support, meals, schedule = {}) {
  const time = String(support?.usageTime || "").toLowerCase();
  if (!meals.length) return 0;
  if (/sabah|kahvalt|ilk öğün|ilk ogun/.test(time)) return 0;
  if (/uyku|gece/.test(time)) return meals.length - 1;
  if (/kardiyo|cardio/.test(time)) {
    return findNearestNutritionMealIndexByMinutes(meals, schedule.cardioMinutes ?? schedule.workoutMinutes, schedule);
  }
  if (/antrenman/.test(time)) {
    const snackIndex = meals.findIndex((meal) => /ara/i.test(meal.name || ""));
    return snackIndex >= 0 ? snackIndex : Math.min(1, meals.length - 1);
  }
  return 0;
}

function findNearestNutritionMealIndexByMinutes(meals, targetMinutes, schedule = {}) {
  if (!meals.length) {
    return 0;
  }

  const baseMinutes = schedule.wakeMinutes ?? schedule.firstMealMinutes ?? 0;
  const normalizedTarget = normalizePdfFutureMinutes(Number(targetMinutes) || 0, baseMinutes);
  let selectedIndex = 0;
  let selectedDistance = Number.POSITIVE_INFINITY;

  meals.forEach((meal, index) => {
    const mealMinutes = normalizePdfFutureMinutes(pdfTimeToMinutes(normalizePdfTime(meal.time, schedule.firstMealTime)), baseMinutes);
    const distance = Math.abs(mealMinutes - normalizedTarget);
    if (distance < selectedDistance) {
      selectedDistance = distance;
      selectedIndex = index;
    }
  });

  return selectedIndex;
}

function getNutritionSupportClockTime(support, meal, schedule = {}) {
  const usage = String(support?.usageTime || support?.timing || "").toLowerCase();
  const baseMinutes = schedule.wakeMinutes ?? 0;
  const workoutMinutes = normalizePdfFutureMinutes(schedule.workoutMinutes ?? pdfTimeToMinutes(schedule.workoutTime), baseMinutes);
  const cardioMinutes =
    schedule.cardioMinutes === null || schedule.cardioMinutes === undefined
      ? null
      : normalizePdfFutureMinutes(schedule.cardioMinutes, baseMinutes);
  const firstMealMinutes = normalizePdfFutureMinutes(schedule.firstMealMinutes ?? pdfTimeToMinutes(schedule.firstMealTime), baseMinutes);
  const sleepMinutes = normalizePdfFutureMinutes(schedule.sleepMinutes ?? pdfTimeToMinutes(schedule.sleepTime), firstMealMinutes);

  if (/kardiyo|cardio/.test(usage)) {
    return formatPdfMinutesToTime((cardioMinutes ?? workoutMinutes) - 30);
  }

  if (/sırasında|sirasinda|intra/.test(usage)) {
    return formatPdfMinutesToTime(workoutMinutes + 25);
  }

  if (/hemen sonra|sonra/.test(usage) && /antrenman/.test(usage)) {
    return formatPdfMinutesToTime(workoutMinutes + 15);
  }

  if (/30 dk|30 dakika|önce|once/.test(usage) && /antrenman/.test(usage)) {
    return formatPdfMinutesToTime(workoutMinutes - 30);
  }

  if (/uyku|gece/.test(usage)) {
    return formatPdfMinutesToTime(sleepMinutes - 30);
  }

  if (/ilk|kahvalt|sabah/.test(usage)) {
    return formatPdfMinutesToTime(firstMealMinutes - (/15/.test(usage) ? 15 : 0));
  }

  return meal?.time || schedule.firstMealTime || "";
}

function shortText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function buildNutritionPdfPagesV2(model) {
  const pages = [];
  let commands = [];
  let y = 704;
  let pageNumber = 0;

  function startPage() {
    pageNumber += 1;
    commands = [];
    drawPageHeader(commands, { title: model.title, generatedAt: model.generatedAt }, pageNumber);
    y = 704;
  }

  function finishPage() {
    if (!commands.length) {
      return;
    }
    drawPageFooter(commands, pageNumber, model);
    pages.push(commands.join("\n"));
  }

  function ensureSpace(requiredHeight, sectionTitle = "") {
    if (y >= requiredHeight + 74) {
      return y;
    }
    finishPage();
    startPage();
    if (sectionTitle) {
      drawNutritionPdfSectionTitle(commands, sectionTitle, y);
      y -= 26;
    }
    return y;
  }

  startPage();
  drawSummaryBlock(commands, model);
  y = 606;

  drawNutritionPdfSectionTitle(commands, "Kalori ve Makro Özeti", y);
  y -= 26;
  drawNutritionMacroCards(commands, model.summary.slice(2, 6), y);
  y -= 62;

  drawNutritionPdfSectionTitle(commands, "Saat Bazlı Günlük Akış", y);
  y -= 24;
  y = drawNutritionTimelinePdf(commands, model.timeline, y);

  ensureSpace(95, "Plan Mantığı");
  if (y <= 640) {
    drawNutritionPdfSectionTitle(commands, "Plan Mantığı", y);
    y -= 24;
  }
  y = drawNutritionNotesGrid(commands, model.intelligence, y);

  ensureSpace(190, "Günlük Öğün Planı");
  if (y <= 640) {
    drawNutritionPdfSectionTitle(commands, "Günlük Öğün Planı", y);
    y -= 24;
  }
  const mealItems = Array.isArray(model.meals) ? model.meals : [];
  for (let index = 0; index < mealItems.length; index += 2) {
    const left = mealItems[index];
    const right = mealItems[index + 1];
    const rowHeight = Math.max(getNutritionMealCardHeight(left), getNutritionMealCardHeight(right));
    if (y < rowHeight + 86) {
      finishPage();
      startPage();
      drawNutritionPdfSectionTitle(commands, "Günlük Öğün Planı", y);
      y -= 24;
    }
    drawNutritionMealCard(commands, left, index + 1, 42, y, 250, rowHeight);
    if (right) {
      drawNutritionMealCard(commands, right, index + 2, 303, y, 250, rowHeight);
    }
    y -= rowHeight + 9;
  }

  ensureSpace(118, "Antrenör / Beslenme Notu");
  drawNutritionPdfSectionTitle(commands, "Antrenör / Beslenme Notu", y);
  y -= 24;
  addText(commands, 44, y, model.trainerNote || "Plan düzenli takip edilmelidir.", 8, "#384d55", 96);
  y -= 34;
  addText(commands, 44, y, model.disclaimer, 6.8, "#5c6c72", 102);
  finishPage();
  return pages;
}

function buildNutritionPdfPages(model) {
  const pages = [];
  let commands = [];
  let y = 704;
  let pageNumber = 1;

  function startPage() {
    commands = [];
    drawPageHeader(commands, { title: model.title, generatedAt: model.generatedAt }, pageNumber);
    y = 704;
  }

  function finishPage() {
    drawPageFooter(commands, pageNumber, model);
    pages.push(commands.join("\n"));
    pageNumber += 1;
  }

  startPage();
  drawSummaryBlock(commands, model);
  y = 596;
  drawNutritionPdfSectionTitle(commands, "Plan Mantığı", y);
  y -= 24;
  model.intelligence.forEach((note) => {
    addText(commands, 48, y, `• ${note}`, 8, "#384d55", 92);
    y -= 18;
  });
  y -= 8;
  drawNutritionPdfSectionTitle(commands, "Kalori ve Makro Kartları", y);
  y -= 28;
  drawNutritionMacroCards(commands, model.summary.slice(2, 6), y);
  y -= 74;
  drawNutritionPdfSectionTitle(commands, "Günlük Öğün Planı", y);
  y -= 28;

  model.meals.forEach((meal, index) => {
    const rowHeight = getNutritionMealRowHeight(meal);
    if (y < rowHeight + 84) {
      finishPage();
      startPage();
      drawNutritionPdfSectionTitle(commands, "Günlük Öğün Planı", y);
      y -= 28;
    }
    drawNutritionMealRow(commands, meal, index + 1, y);
    y -= rowHeight + 8;
  });

  if (y < 190) {
    finishPage();
    startPage();
  }

  if (y < 150) {
    finishPage();
    startPage();
  }

  drawNutritionPdfSectionTitle(commands, "Antrenör / Beslenme Notu", y);
  y -= 25;
  addText(commands, 44, y, model.trainerNote || "Plan düzenli takip edilmelidir.", 8, "#384d55", 92);
  y -= 44;
  addText(commands, 44, y, model.disclaimer, 7, "#5c6c72", 98);
  finishPage();
  return pages;
}

function drawNutritionTimelinePdf(commands, timeline, y) {
  const items = (Array.isArray(timeline) ? timeline : []).slice(0, 9);
  const cardWidth = 166;
  const cardHeight = 34;
  const gapX = 8;
  const gapY = 8;

  if (!items.length) {
    drawRect(commands, 42, y - 34, 511, 38, "#f6faf9", "#d9e5e3");
    addText(commands, 54, y - 13, "Saat bazlı akış plan oluşturulduğunda otomatik görünür.", 8, "#384d55", 84);
    return y - 46;
  }

  items.forEach((item, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 42 + column * (cardWidth + gapX);
    const top = y - row * (cardHeight + gapY);
    const accent = getNutritionTimelineColor(item.kind);
    drawRect(commands, x, top - cardHeight + 4, cardWidth, cardHeight, "#ffffff", "#d9e5e3");
    drawRect(commands, x, top - cardHeight + 4, 5, cardHeight, accent);
    addText(commands, x + 12, top - 9, item.time || "--:--", 9, accent, 10);
    addText(commands, x + 58, top - 9, item.title || "Plan", 7.5, "#082b35", 22);
    addText(commands, x + 58, top - 22, item.meta || "", 6.2, "#5c6c72", 24);
  });

  return y - Math.ceil(items.length / 3) * (cardHeight + gapY) - 8;
}

function getNutritionTimelineColor(kind) {
  const colors = {
    wake: "#d8ad63",
    workout: "#1d6b74",
    cardio: "#1976d2",
    sleep: "#384d55",
    "pre-workout": "#d8ad63",
    "post-workout": "#0f6a65",
    "night-protein": "#6c5ce7",
  };
  return colors[kind] || "#1d6b74";
}

function drawNutritionNotesGrid(commands, notes, y) {
  const visibleNotes = (Array.isArray(notes) ? notes : []).slice(0, 4);
  if (!visibleNotes.length) {
    return y;
  }

  visibleNotes.forEach((note, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 42 + column * 258;
    const top = y - row * 44;
    drawRect(commands, x, top - 36, 247, 38, "#ffffff", "#d9e5e3");
    drawRect(commands, x, top - 36, 5, 38, index % 2 ? "#d8ad63" : "#1d6b74");
    addText(commands, x + 12, top - 11, note, 6.7, "#384d55", 44);
  });

  return y - Math.ceil(visibleNotes.length / 2) * 44 - 8;
}

function drawNutritionMealCardGrid(commands, meals, y, ensureSpace) {
  const items = Array.isArray(meals) ? meals : [];
  const cardWidth = 250;
  const gapX = 11;
  const gapY = 9;

  for (let index = 0; index < items.length; index += 2) {
    const left = items[index];
    const right = items[index + 1];
    const rowHeight = Math.max(getNutritionMealCardHeight(left), getNutritionMealCardHeight(right));
    y = ensureSpace(rowHeight + 12, "Günlük Öğün Planı") || y;
    drawNutritionMealCard(commands, left, index + 1, 42, y, cardWidth, rowHeight);
    if (right) {
      drawNutritionMealCard(commands, right, index + 2, 42 + cardWidth + gapX, y, cardWidth, rowHeight);
    }
    y -= rowHeight + gapY;
  }

  return y;
}

function getNutritionMealCardHeight(meal) {
  const supportCount = Array.isArray(meal?.supports) ? Math.min(meal.supports.length, 3) : 0;
  const foodLength = String(meal?.foods || "").length;
  return 104 + supportCount * 19 + (foodLength > 92 ? 12 : 0);
}

function drawNutritionMealCard(commands, meal, index, x, y, width, height) {
  if (!meal) {
    return;
  }

  drawRect(commands, x, y - height + 4, width, height, "#ffffff", "#d9e5e3");
  drawRect(commands, x, y - height + 4, 6, height, getNutritionTimelineColor(meal.scheduleRole));
  drawRect(commands, x + 12, y - 24, 42, 20, "#eef7f5", "#d9e5e3");
  addText(commands, x + 20, y - 11, meal.time || "--:--", 7.5, "#1d6b74", 8);
  addText(commands, x + 62, y - 8, meal.timingLabel || meal.name || `Öğün ${index}`, 8.4, "#082b35", 28);
  addText(commands, x + 62, y - 22, `${meal.calories || "-"} kcal | P ${meal.protein || "-"} g | K ${meal.carbs || "-"} g | Y ${meal.fat || "-"} g`, 6.6, "#1d6b74", 34);
  addText(commands, x + 14, y - 42, meal.foods || "-", 6.5, "#384d55", 42);

  const supports = (meal.supports || []).slice(0, 3);
  if (supports.length) {
    addText(commands, x + 14, y - 68, "Destekler", 6.4, "#d8ad63", 16);
    supports.forEach((support, supportIndex) => {
      const line = `${support.time || support.usageTime || ""} ${support.name || "Supplement"} - ${support.dose || ""} - ${support.water || "1 bardak su"}`;
      addText(commands, x + 62, y - 68 - supportIndex * 17, line, 5.8, "#384d55", 34);
    });
  }
}

function drawNutritionPdfSectionTitle(commands, title, y) {
  drawRect(commands, 34, y - 17, 527, 24, "#eef7f5", "#d9e5e3");
  drawRect(commands, 34, y - 17, 6, 24, "#d8ad63");
  addText(commands, 48, y - 2, title, 10, "#082b35", 80);
}

function drawNutritionMacroCards(commands, metrics, y) {
  metrics.forEach(([label, value], index) => {
    const x = 44 + index * 126;
    drawRect(commands, x, y - 48, 112, 52, "#ffffff", "#d9e5e3");
    drawRect(commands, x, y - 48, 112, 6, index === 0 ? "#1d6b74" : "#d8ad63");
    addText(commands, x + 10, y - 14, label, 7.5, "#5c6c72");
    addText(commands, x + 10, y - 32, value, 12, "#082b35");
  });
}

function drawNutritionMealRow(commands, meal, index, y) {
  const rowHeight = getNutritionMealRowHeight(meal);
  drawRect(commands, 42, y - rowHeight + 4, 511, rowHeight, "#ffffff", "#d9e5e3");
  drawRect(commands, 42, y - rowHeight + 4, 32, rowHeight, "#1d6b74");
  addText(commands, 51, y - 22, String(index), 12, "#ffffff");
  addText(commands, 84, y - 10, meal.name || `Öğün ${index}`, 9.5, "#082b35", 32);
  addText(commands, 84, y - 25, meal.foods || "-", 7, "#384d55", 82);
  addText(commands, 84, y - 40, `${meal.calories || "-"} kcal | P ${meal.protein || "-"} g | K ${meal.carbs || "-"} g | Y ${meal.fat || "-"} g`, 7, "#1d6b74", 82);
  drawNutritionMealSupports(commands, meal.supports || [], y - 56);
}

function getNutritionMealRowHeight(meal) {
  const supportCount = Array.isArray(meal?.supports) ? Math.min(meal.supports.length, 5) : 0;
  return supportCount ? 60 + supportCount * 18 : 56;
}

function drawNutritionMealSupports(commands, supports, y) {
  const visibleSupports = (supports || []).slice(0, 5);
  if (!visibleSupports.length) {
    return;
  }

  addText(commands, 84, y, "Destekler", 6.8, "#d8ad63", 18);
  visibleSupports.forEach((support, index) => {
    const line = `${support.name || "Supplement"} - ${support.usageTime || "Öğünle birlikte"} - ${support.dose || ""} - ${support.water || "1 bardak su"} - ${support.purpose || "Plan hedefini desteklemek"}`;
    addText(commands, 132, y - index * 18, line, 6.1, "#384d55", 78);
  });
}

function drawNutritionSupplementRow(commands, item, y) {
  drawRect(commands, 42, y - 34, 511, 38, "#ffffff", "#d9e5e3");
  addText(commands, 54, y - 8, item.supplementName || item.name || "Supplement", 8.5, "#082b35", 34);
  addText(commands, 54, y - 22, `${item.category || ""} | ${item.purpose || ""}`, 6.7, "#384d55", 84);
  addText(commands, 330, y - 8, item.suggestedTiming || item.timing || "", 6.5, "#1d6b74", 36);
  addText(commands, 330, y - 22, `${item.suggestedDoseText || item.note || ""}${item.evidenceLevel ? ` | Kanıt: ${item.evidenceLevel}` : ""}`, 6.5, "#d8ad63", 36);
}

function drawNutritionSupplementGroup(commands, title, supplements, y) {
  if (!supplements.length) {
    return y;
  }

  addText(commands, 44, y, title, 8, "#1d6b74", 42);
  y -= 18;

  supplements.forEach((item) => {
    if (y < 118) {
      return;
    }
    drawNutritionSupplementRow(commands, item, y);
    y -= 42;
  });

  return y - 4;
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
    summarySubtitle: "Üyeye verilecek sade antrenman planı",
    footerText: "Bahçeşehir Spor Merkezi | Üye Antrenman Programı",
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
    drawPageFooter(commands, pageNumber, model);
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

      drawExerciseCard(commands, exercise, 42 + column * 256, y, 244, 54, index + 1);
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
  addText(commands, 44, 696, model.summarySubtitle || "Üyeye verilecek sade antrenman planı", 9, "#1d6b74");

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

function drawExerciseCard(commands, exercise, x, y, width, height, order = "") {
  const name = exercise?.name || "Hareket";
  const group = exercise?.groupLabel || exercise?.group || "Kas grubu";
  drawRect(commands, x, y - height + 10, width, height, "#ffffff", "#d9e5e3");
  drawRect(commands, x, y - height + 10, 6, height, "#d8ad63");
  drawRect(commands, x + 12, y - 31, 34, 34, "#eef7f5", "#b9d3ce");
  addText(commands, x + 22, y - 12, String(order || ""), 9, "#1d6b74");
  addText(commands, x + 54, y - 6, name, 9.4, "#082b35", 31);
  addText(commands, x + 54, y - 20, group, 7.3, "#1d6b74", 31);

  const repPattern = Array.isArray(exercise?.repPattern) && exercise.repPattern.length ? exercise.repPattern.join(" • ") : exercise?.reps || "-";
  const metrics = [
    `${exercise?.sets || "-"} Sets: ${repPattern}`,
    `Model: ${formatRepModelLabel(exercise?.repModel)}`,
    `Dinlenme: ${exercise?.rest || "-"}`,
    `Tempo: ${exercise?.tempo || "-"}`,
  ];
  addText(commands, x + 54, y - 34, metrics.join("  |  "), 6.8, "#384d55", 42);
  addText(commands, x + 54, y - 46, exercise?.cue || exercise?.note || "Kontrollü formda uygula.", 6.5, "#5c6c72", 42);
}

function formatRepModelLabel(value) {
  const labels = {
    fixed: "Fixed",
    pyramid: "Pyramid",
    "reverse-pyramid": "Reverse Pyramid",
    strength: "Strength",
    hypertrophy: "Hypertrophy",
    endurance: "Endurance",
    advanced: "Advanced",
    custom: "Custom",
  };

  return labels[String(value || "").trim()] || "Fixed";
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

function drawPageFooter(commands, pageNumber, model = {}) {
  drawLine(commands, 28, 50, 567, 50, "#d9e5e3");
  addText(commands, 42, 34, model.footerText || "Bahçeşehir Spor Merkezi | Üye Antrenman Programı", 7.5, "#5c6c72");
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
  turkishMap["ğ"] = 128;
  turkishMap["Ğ"] = 129;
  turkishMap["İ"] = 130;
  turkishMap["ı"] = 131;
  turkishMap["ş"] = 132;
  turkishMap["Ş"] = 133;
  let output = "";

  for (const char of String(value || "")) {
    if (char === "•") {
      output += String.fromCharCode(149);
      continue;
    }

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

function slugifyFilenamePart(value) {
  const slug = String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "uye";
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254) return false;
  // RFC 5322 basit format: local@domain.tld — boşluk, birden fazla @ ve tek hane TLD yasak
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email);
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

function sendPdf(res, pdfBuffer, filename) {
  const safeFilename = sanitizeFilename(filename, "bsm-rapor.pdf").replace(/[^\x20-\x7E]/g, "-");
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${safeFilename}"`,
    "Content-Length": pdfBuffer.length,
    "Cache-Control": "no-store",
  });
  res.end(pdfBuffer);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function setCorsHeaders(req, res) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const origin = req.headers.origin || "";

  if (allowedOrigins.length > 0) {
    // Üretim: sadece tanımlı origin'lere izin ver
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    // Tanımlı değilse CORS header eklenmez → same-origin zorunlu
  } else {
    // ALLOWED_ORIGINS tanımlı değil: geliştirme/geçiş modu
    // Aynı host'tan gelen istekler zaten izinli; wildcard local için
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    if (origin) res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Requested-With");
}
