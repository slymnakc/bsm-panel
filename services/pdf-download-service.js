(function () {
  "use strict";

  const PROGRAM_PDF_ENDPOINT = "/api/program-pdf";
  const NUTRITION_PDF_ENDPOINT = "/api/nutrition-pdf";

  async function downloadProgramPdf(options = {}) {
    return downloadBackendPdf({
      endpoint: PROGRAM_PDF_ENDPOINT,
      payload: options.payload,
      filename: options.filename || "antrenman-programi.pdf",
      fallbackFilename: "antrenman-programi.pdf",
      successMessage: "Premium program PDF'i indirildi.",
      missingPayloadMessage: "PDF için önce program oluşturun.",
      windowObject: options.windowObject,
      downloadFile: options.downloadFile,
    });
  }

  async function downloadNutritionPdf(options = {}) {
    return downloadBackendPdf({
      endpoint: NUTRITION_PDF_ENDPOINT,
      payload: {
        memberName: options.planData?.memberName || "",
        planData: options.planData,
      },
      filename: options.filename || "sporcu-beslenme-plani.pdf",
      fallbackFilename: "sporcu-beslenme-plani.pdf",
      successMessage: "Premium beslenme PDF'i indirildi.",
      missingPayloadMessage: "PDF için önce beslenme planı oluşturun.",
      windowObject: options.windowObject,
      downloadFile: options.downloadFile,
    });
  }

  async function downloadBackendPdf(config) {
    const windowObject = config.windowObject || window;
    const downloadFile = config.downloadFile || windowObject.BSMCoreUtils?.downloadFile;

    if (!config.payload || typeof config.payload !== "object") {
      return { ok: false, message: config.missingPayloadMessage || "PDF için geçerli veri bulunamadı." };
    }

    if (windowObject.location?.protocol === "file:") {
      return {
        ok: false,
        fallbackAvailable: true,
        message: "Premium PDF için paneli npm start veya canlı Render adresi üzerinden açın.",
      };
    }

    try {
      const response = await windowObject.fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.payload),
      });

      if (!response.ok) {
        const result = await readErrorPayload(response);
        return {
          ok: false,
          fallbackAvailable: true,
          message: result.message || "PDF oluşturulamadı. Lütfen verileri kontrol edip tekrar deneyin.",
        };
      }

      const contentType = response.headers?.get?.("Content-Type") || "";
      const blob = await response.blob();

      if (!blob?.size || !contentType.toLowerCase().includes("application/pdf")) {
        return {
          ok: false,
          fallbackAvailable: true,
          message: "PDF servisi geçerli bir PDF dosyası döndürmedi.",
        };
      }

      const filename = getResponseFilename(response, config.filename || config.fallbackFilename);
      triggerDownload(windowObject, downloadFile, filename, blob);
      return { ok: true, message: config.successMessage || "PDF indirildi." };
    } catch (error) {
      return {
        ok: false,
        fallbackAvailable: true,
        message: `PDF servisine ulaşılamadı. Backend çalışıyor mu kontrol edin. Detay: ${error.message || "bağlantı kurulamadı"}`,
      };
    }
  }

  async function readErrorPayload(response) {
    try {
      const result = await response.clone().json();
      return result && typeof result === "object" ? result : {};
    } catch (error) {
      return {};
    }
  }

  function getResponseFilename(response, fallback) {
    const disposition = response.headers?.get?.("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i) || disposition.match(/filename=([^;]+)/i);
    const filename = match?.[1]?.trim();
    return filename || fallback || "bsm-rapor.pdf";
  }

  function triggerDownload(windowObject, downloadFile, filename, blob) {
    if (typeof downloadFile === "function") {
      downloadFile(filename, blob, "application/pdf");
      return;
    }

    const objectUrl = windowObject.URL.createObjectURL(blob);
    const link = windowObject.document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    windowObject.document.body.appendChild(link);
    link.click();
    link.remove();
    windowObject.URL.revokeObjectURL(objectUrl);
  }

  window.BSMPdfDownloadService = {
    downloadProgramPdf,
    downloadNutritionPdf,
  };
})();
