(function () {
  "use strict";

  async function sendNutritionPlanEmail({ email, planData, endpoint = "/api/send-nutrition-email", fetchImpl = fetch, locationObject = window.location }) {
    const to = String(email || "").trim();

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { ok: false, message: "Geçerli bir e-posta adresi girin." };
    }

    if (!planData) {
      return { ok: false, message: "Mail göndermek için önce beslenme planı oluşturun." };
    }

    if (locationObject?.protocol === "file:") {
      return {
        ok: false,
        message: "Mail gönderimi için paneli http://localhost:3000 veya canlı Render adresi üzerinden açmalısınız.",
      };
    }

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          memberName: planData.memberName || "Üye",
          planData,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        return {
          ok: false,
          message: result.message || "Beslenme planı maili gönderilemedi.",
        };
      }

      return {
        ok: true,
        message: result.message || "Beslenme planı mail ile gönderildi.",
      };
    } catch (error) {
      const subject = encodeURIComponent("Bahçeşehir Spor Merkezi Sporcu Beslenme Planınız");
      const body = encodeURIComponent(
        `Merhaba ${planData.memberName || ""},\n\nSize özel hazırlanan sporcu beslenme planınız için Bahçeşehir Spor Merkezi ekibiyle iletişime geçebilirsiniz.\n\nSağlıklı günler dileriz.\nBahçeşehir Spor Merkezi`,
      );
      return {
        ok: false,
        message: `Mail servisine ulaşılamadı. Manuel mail için: mailto:${to}?subject=${subject}&body=${body}`,
      };
    }
  }

  window.BSMNutritionEmailService = {
    sendNutritionPlanEmail,
  };
})();
