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

  if (req.url === "/api/send-nutrition-email" && req.method === "POST") {
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
      pdfBuffer = createNutritionPlanPdf(payload.planData);
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

function createNutritionPlanPdf(planData) {
  const model = buildNutritionPdfModel(planData);
  const pages = buildNutritionPdfPages(model).slice(0, 5);
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
  return {
    title: "Sporcu Beslenme Planı",
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
      ["BMR", `${plan.sourceSummary?.bmr || "-"} kcal`],
      ["Antrenman", `${plan.trainingDays || "-"} gün/hafta`],
    ],
    intelligence: Array.isArray(plan.intelligence) ? plan.intelligence.slice(0, 5) : [],
    meals: Array.isArray(plan.meals) ? plan.meals : [],
    supplements: Array.isArray(plan.supplements) ? plan.supplements : [],
    supplementNotice: plan.supplementNotice || "Supplement kullanımı kapalı. Plan gıda öncelikli hazırlanmıştır.",
    supplementCommonWarning:
      plan.supplementCommonWarning ||
      "Supplementler opsiyoneldir; ilaç kullanan, hamile/emziren, kronik hastalığı olan veya özel sağlık durumu bulunan kişiler kullanım öncesi hekim/diyetisyen görüşü almalıdır.",
    trainerNote: plan.trainerNote || "",
    disclaimer: plan.disclaimer || "",
  };
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
    drawPageFooter(commands, pageNumber);
    pages.push(commands.join("\n"));
    pageNumber += 1;
  }

  startPage();
  drawSummaryBlock(commands, { summary: model.summary, memberName: model.memberName });
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
    if (y < 132) {
      finishPage();
      startPage();
      drawNutritionPdfSectionTitle(commands, "Günlük Öğün Planı", y);
      y -= 28;
    }
    drawNutritionMealRow(commands, meal, index + 1, y);
    y -= 62;
  });

  if (y < 190) {
    finishPage();
    startPage();
  }

  drawNutritionPdfSectionTitle(commands, "Supplement ve Notlar", y);
  y -= 26;
  addText(commands, 44, y, model.supplementNotice, 8, "#384d55", 92);
  y -= 24;

  const mainSupplements = model.supplements.filter((item) => item.recommendationTier !== "optional").slice(0, 5);
  const optionalSupplements = model.supplements.filter((item) => item.recommendationTier === "optional").slice(0, 3);

  if (!mainSupplements.length && !optionalSupplements.length) {
    drawNutritionSupplementRow(commands, { supplementName: "Supplement kapalı", purpose: "Plan gıda öncelikli hazırlanmıştır.", suggestedTiming: "", suggestedDoseText: "" }, y);
    y -= 44;
  } else {
    y = drawNutritionSupplementGroup(commands, "Ana öneriler", mainSupplements, y);
    y = drawNutritionSupplementGroup(commands, "Opsiyonel destekler", optionalSupplements, y);
    addText(commands, 44, y, model.supplementCommonWarning, 7, "#5c6c72", 94);
    y -= 36;
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
  drawRect(commands, 42, y - 52, 511, 56, "#ffffff", "#d9e5e3");
  drawRect(commands, 42, y - 52, 32, 56, "#1d6b74");
  addText(commands, 51, y - 22, String(index), 12, "#ffffff");
  addText(commands, 84, y - 10, meal.name || `Öğün ${index}`, 9.5, "#082b35", 32);
  addText(commands, 84, y - 25, meal.foods || "-", 7, "#384d55", 82);
  addText(commands, 84, y - 40, `${meal.calories || "-"} kcal | P ${meal.protein || "-"} g | K ${meal.carbs || "-"} g | Y ${meal.fat || "-"} g`, 7, "#1d6b74", 82);
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
