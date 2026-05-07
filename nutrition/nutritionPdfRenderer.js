(function () {
  "use strict";

  function generateNutritionPdf(planData, options = {}) {
    const windowObject = options.windowObject || window;

    if (!planData) {
      return { ok: false, message: "PDF için önce beslenme planı oluşturun." };
    }

    windowObject.print();
    return { ok: true, message: "PDF/Yazdır ekranı açıldı." };
  }

  window.BSMNutritionPdfRenderer = {
    generateNutritionPdf,
  };
})();
