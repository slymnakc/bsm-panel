// output-handlers.js — 4B.4 sonrasi STUB.
//
// Tarihsel rol: createOutputHandlers factory action/mail/backup handler'larini ureten
// merkezi yerdi. Asagidaki sub-sprint'lerle BOSALDI:
//   - 4A.2.2 → output/outputActions.js (copy/print/pdf/html action handler'lari)
//   - 4A.2.3 → output/outputMail.js (handleSendProgramMail + mail helper'lari)
//   - 4B.4   → members/memberBackup.js (5 backup/CSV fn + resetFormToDefaults + bind)
//
// Bu dosya artik kod icermez. BSMOutputHandlers globali geri uyumluluk icin
// expose edilir (dis kullanim YOK — app.js destructure'i da kaldirildi) ama
// createOutputHandlers / bindOutputHandlers stub'lari herhangi bir external
// referans olmasi durumunda no-op olarak calisir.
//
// Komple silme + index.html script tag cikarma 4B.4.1 (cleanup) sub-sprint'inde
// onerilebilir; bu sprintte mechanical risk almamak icin stub bırakildi.

(function () {
  "use strict";

  function createOutputHandlers(/* deps */) {
    // 4B.4: tum handler'lar tasindi. Bos object donerek geri uyumluluk korunur.
    return {};
  }

  function bindOutputHandlers(/* elements, handlers */) {
    // 4B.4: bind'lar window.BSMMemberBackup.bindBackupHandlers'a tasindi.
  }

  window.BSMOutputHandlers = {
    createOutputHandlers: createOutputHandlers,
    bindOutputHandlers: bindOutputHandlers,
  };
})();
