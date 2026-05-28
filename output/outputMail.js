// outputMail.js — Refactor Adım 4A.2.3 (STRICT MECHANICAL EXTRACTION).
// Program mail gönderim flow'u handlers/output-handlers.js'den BIREBIR tasindi.
// Davranis degisikligi YOK; handleSendProgramMail govdesi, payload shape, mail HTML
// attachment (buildLiveProgramHtml base64), mail history persistence, delivery status
// zinciri birebir korundu.
//
// !!! REWRITE DEGIL — sadece OWNERSHIP TRANSFER. Mail template (buildMailMessage) +
// payload yapisi + endpoint sirasi DEGISMEDI.
//
// KAPSAM ICI (10 fn + 2 helper + 2 const):
//   - handleSendProgramMail (orchestrator)
//   - sendProgramMailRequest, getProgramMailEndpoints
//   - buildMailMessage
//   - appendProgramMailHistory, renderProgramMailHistory, loadProgramMailHistory,
//     saveProgramMailHistory
//   - isValidEmail, toBase64Unicode
//   - escapeHtml, escapeAttribute (mail history render icin lokal kopya)
//   - PROGRAM_MAIL_HISTORY_KEY, PROGRAM_EMAIL_API_PATH
//
// CROSS-MODULE REFERENCE (output/outputActions.js'e — 4A.2.2'de tasinmis shared fn'ler):
//   buildLiveProgramHtml, buildProgramPdfPayload, setProgramDeliveryStatus, slugifyFilePart
//   → window.BSMOutputActions.X (wrapper). handleSendProgramMail govdesi DEGISMEDI.
//   buildLiveProgramHtml ciktisina DOKUNULMADI (outputActions sahibi).
//
// Dependency injection (koddan dogrulanmis):
//   domRefs{programMailHistory}, getCurrentProgramFromEditor, loadLastPlan, collectFormData,
//   findActiveMember, persistMembers, windowObject (default window)

(function () {
  "use strict";

  const PROGRAM_MAIL_HISTORY_KEY = "bsm-program-mail-history-v1";
  const PROGRAM_EMAIL_API_PATH = "/api/send-program-email";

  var _domRefs = {};
  var _getCurrentProgramFromEditor = function () { return null; };
  var _loadLastPlan = function () { return null; };
  var _collectFormData = function () { return {}; };
  var _findActiveMember = function () { return null; };
  var _persistMembers = function () {};
  var _windowObject = typeof window !== "undefined" ? window : {};

  function init(deps) {
    if (!deps) deps = {};
    if (deps.domRefs) _domRefs = deps.domRefs;
    if (typeof deps.getCurrentProgramFromEditor === "function") _getCurrentProgramFromEditor = deps.getCurrentProgramFromEditor;
    if (typeof deps.loadLastPlan === "function") _loadLastPlan = deps.loadLastPlan;
    if (typeof deps.collectFormData === "function") _collectFormData = deps.collectFormData;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.persistMembers === "function") _persistMembers = deps.persistMembers;
    if (deps.windowObject) _windowObject = deps.windowObject;
    // Mevcut davranis: createOutputHandlers basinda renderProgramMailHistory() bir kez cagriliyordu.
    renderProgramMailHistory();
  }

  // ── CROSS-MODULE wrapper'lar (output/outputActions.js) ──────────────
  // handleSendProgramMail govdesi degismesin diye output-handlers.js'deki
  // wrapper'lar birebir tasindi.
  function buildLiveProgramHtml(program, options) {
    return window.BSMOutputActions.buildLiveProgramHtml(program, options);
  }

  function buildProgramPdfPayload(program, profile, activeMember) {
    return window.BSMOutputActions.buildProgramPdfPayload(program, profile, activeMember);
  }

  function setProgramDeliveryStatus(message, stateName) {
    return window.BSMOutputActions.setProgramDeliveryStatus(message, stateName);
  }

  function slugifyFilePart(value) {
    return window.BSMOutputActions.slugifyFilePart(value);
  }

  // ── escapeHtml / escapeAttribute (output-handlers.js lokal kopyasi birebir) ──
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIL FLOW (birebir — output-handlers.js:68-264)
  // ═══════════════════════════════════════════════════════════════════

  async function handleSendProgramMail() {
    const program = _getCurrentProgramFromEditor() || _loadLastPlan();

    if (!program?.schemaVersion) {
      setProgramDeliveryStatus("Mail gönderimi için önce program oluşturun.", "error");
      return;
    }

    if (_windowObject.location?.protocol === "file:") {
      setProgramDeliveryStatus("Mail gönderimi için paneli http://localhost:3000 veya canlı Render adresi üzerinden açmalısınız.", "error");
      return;
    }

    const profile = _collectFormData();
    const activeMember = _findActiveMember();
    const recipientEmail = String(profile.memberEmail || activeMember?.profile?.memberEmail || "").trim();

    if (!isValidEmail(recipientEmail)) {
      setProgramDeliveryStatus("Mail göndermek için üye bilgilerine geçerli bir e-posta adresi girin.", "error");
      return;
    }

    try {
      setProgramDeliveryStatus("Gönderiliyor...", "loading");
      const liveHtml = await buildLiveProgramHtml(program, { inlineImages: false });
      const pdfPayload = buildProgramPdfPayload(program, profile, activeMember);
      const payload = {
        to: recipientEmail,
        memberName: pdfPayload.memberName,
        trainerName: profile.trainerName || activeMember?.profile?.trainerName || "",
        subject: "Bahçeşehir Spor Merkezi | Size Özel Antrenman Programınız",
        message: buildMailMessage(pdfPayload.memberName),
        programText: pdfPayload.programText,
        programData: pdfPayload.programData,
        htmlAttachment: {
          filename: `canli-antrenman-programi-${slugifyFilePart(profile.memberName || "uye")}.html`,
          contentBase64: toBase64Unicode(liveHtml),
        },
      };
      const response = await sendProgramMailRequest(payload);

      if (!response.ok) {
        throw new Error(response.message || "Mail gönderilemedi.");
      }

      const record = {
        id: `mail-${Date.now()}`,
        memberId: activeMember?.id || "",
        memberName: payload.memberName,
        email: recipientEmail,
        status: "Başarılı",
        sentAtIso: new Date().toISOString(),
        sentAt: new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
      };
      appendProgramMailHistory(record);
      setProgramDeliveryStatus("Başarılı: Program maili üyeye gönderildi.", "success");
    } catch (error) {
      const record = {
        id: `mail-${Date.now()}`,
        memberId: activeMember?.id || "",
        memberName: profile.memberName || activeMember?.profile?.memberName || "Üye",
        email: recipientEmail,
        status: "Hata",
        error: error.message || "Mail gönderilemedi.",
        sentAtIso: new Date().toISOString(),
        sentAt: new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }),
      };
      appendProgramMailHistory(record);
      setProgramDeliveryStatus(`Hata: ${record.error}`, "error");
    }
  }

  async function sendProgramMailRequest(payload) {
    const endpoints = getProgramMailEndpoints();
    const networkErrors = [];

    for (const endpoint of endpoints) {
      try {
        const response = await _windowObject.fetch(endpoint.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => null);

        if (!result || typeof result !== "object") {
          return {
            ok: false,
            message: `${endpoint.label} geçerli mail API yanıtı vermedi. Render servisinin Node olarak deploy edildiğini kontrol edin.`,
          };
        }

        return {
          ok: response.ok && result.ok === true,
          message: result.message || result.error || "",
          pdfCreated: result.pdfCreated !== false,
        };
      } catch (error) {
        networkErrors.push(`${endpoint.label}: ${error.message || "bağlantı kurulamadı"}`);
        console.warn("Program mail API erişim hatası", endpoint.url, error);
      }
    }

    return {
      ok: false,
      message: `Mail API'sine ulaşılamadı. Yerelde kullanıyorsanız proje klasöründe "npm start" ile backend'i çalıştırın veya paneli canlı Render adresinden açın. Detay: ${networkErrors.join(" | ")}`,
    };
  }

  function getProgramMailEndpoints() {
    return [{ url: PROGRAM_EMAIL_API_PATH, label: "Mail servisi" }];
  }

  function buildMailMessage(memberName) {
    return `Merhaba ${memberName || "Üye"},

Size özel hazırlanan antrenman programınız ekte yer almaktadır.

Programınızı düzenli uygulamanız önerilir. Herhangi bir sorunuzda antrenörlerimizden destek alabilirsiniz.

Sağlıklı günler dileriz.
Bahçeşehir Spor Merkezi`;
  }

  function appendProgramMailHistory(record) {
    const history = [record, ...loadProgramMailHistory()].slice(0, 20);
    saveProgramMailHistory(history);

    const activeMember = _findActiveMember();
    if (activeMember) {
      activeMember.mailHistory = [record, ...(activeMember.mailHistory || [])].slice(0, 20);
      activeMember.updatedAt = new Date().toISOString();
      _persistMembers();
    }

    renderProgramMailHistory();
  }

  function renderProgramMailHistory() {
    const programMailHistory = _domRefs.programMailHistory;
    if (!programMailHistory) {
      return;
    }

    const activeMember = _findActiveMember();
    const allRecords = loadProgramMailHistory();
    const records = allRecords.filter((record) => !activeMember || !record.memberId || record.memberId === activeMember.id).slice(0, 4);

    if (!records.length) {
      programMailHistory.innerHTML = `<span>Gönderim geçmişi henüz yok.</span>`;
      return;
    }

    programMailHistory.innerHTML = `
        <strong>Mail gönderim geçmişi</strong>
        ${records
          .map(
            (record) => `
              <div class="program-mail-history__item" data-state="${escapeAttribute(record.status === "Başarılı" ? "success" : "error")}">
                <span>${escapeHtml(record.status)}</span>
                <p>${escapeHtml(record.memberName || "Üye")} • ${escapeHtml(record.email || "")}</p>
                <small>${escapeHtml(record.sentAt || "")}${record.error ? ` • ${escapeHtml(record.error)}` : ""}</small>
              </div>
            `,
          )
          .join("")}
      `;
  }

  function loadProgramMailHistory() {
    try {
      const parsed = JSON.parse(_windowObject.localStorage?.getItem(PROGRAM_MAIL_HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveProgramMailHistory(history) {
    try {
      _windowObject.localStorage?.setItem(PROGRAM_MAIL_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      // Gönderim geçmişi yazılamasa bile mail akışı devam eder.
    }
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function toBase64Unicode(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return _windowObject.btoa(binary);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BIND (idempotent guard'li) — sendProgramMailButton
  // ═══════════════════════════════════════════════════════════════════

  function bindOutputMailHandlers(buttons) {
    if (!buttons) buttons = {};
    const btn = buttons.sendProgramMailButton;
    if (!btn) {
      return;
    }
    if (btn.dataset.bsmOutputMailBound === "true") {
      return;
    }
    btn.addEventListener("click", handleSendProgramMail);
    btn.dataset.bsmOutputMailBound = "true";
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  window.BSMOutputMail = {
    init: init,
    handleSendProgramMail: handleSendProgramMail,
    renderProgramMailHistory: renderProgramMailHistory,
    bindOutputMailHandlers: bindOutputMailHandlers,
  };
})();
