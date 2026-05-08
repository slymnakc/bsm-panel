(function () {
  "use strict";

  async function generateNutritionPdf(planData, options = {}) {
    const windowObject = options.windowObject || window;

    if (!planData) {
      return { ok: false, message: "PDF için önce beslenme planı oluşturun." };
    }

    const pdfService = windowObject.BSMPdfDownloadService;

    if (!pdfService?.downloadNutritionPdf) {
      return {
        ok: false,
        fallbackAvailable: true,
        message: "Premium PDF servisi yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.",
      };
    }

    return pdfService.downloadNutritionPdf({
      planData,
      filename: `bahcesehir-beslenme-${slugifyFilePart(planData.memberName || "uye")}.pdf`,
      downloadFile: options.downloadFile || windowObject.BSMCoreUtils?.downloadFile,
      windowObject,
    });
  }

  function printNutritionFallback(planData, options = {}) {
    const windowObject = options.windowObject || window;

    if (!planData) {
      return { ok: false, message: "Yazdırmak için önce beslenme planı oluşturun." };
    }

    windowObject.print();
    return { ok: true, message: "Eski yazdırma fallback'i açıldı." };
  }

  function slugifyFilePart(value) {
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
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "uye";
  }

  window.BSMNutritionPdfRenderer = {
    generateNutritionPdf,
    printNutritionFallback,
  };
})();
