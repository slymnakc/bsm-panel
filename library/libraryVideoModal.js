// libraryVideoModal.js — Refactor Adım 4A.1.1.
// Hareket Kütüphanesi video butonu click handler ve YouTube search URL üretimi
// app.js'den extract edildi. Davranis degisikligi yok; video button click →
// YouTube search URL → yeni sekme akisi birebir korundu.
//
// KAPSAM ICI:
//   - [data-exercise-video-open] click → openExerciseVideoModal(name)
//   - [data-video-modal-close] click → closeExerciseVideoModal()
//   - Escape key → closeExerciseVideoModal() (modal acık ise)
//   - openExerciseVideoModal(exerciseName) → window.open YouTube search
//   - closeExerciseVideoModal() → backward-compat noop
//   - Document-level event delegation (idempotent guard'li bind)
//
// KAPSAM DISI (dokunulmadi):
//   - renderLibrary (renderers'da, 4A.1.2'ye birakildi)
//   - Custom exercise CRUD (4A.1.3'e birakildi)
//   - GIF modal handler'lari (handleExerciseGifModalClick'in DIGER iflari)
//   - exerciseLibrary mutable array
//
// DEPENDENCY INJECTION:
// HIC DEPENDENCY YOK — modul state-less + pure DOM/native window API.
// User'in ornek listesindeki (exerciseMediaService, getMuscleLabel, showStatus)
// hicbiri bu code path'inde cagrilmiyor. Init contract'i yine de tanimlanir ki
// pattern tutarli kalsin ve ileride extension noktasi acik kalsin.
//
// IDEMPOTENT BIND GUARD:
// Document-level delegation icin DOM element guard kullanilamaz; bu yuzden
// document.documentElement.dataset.bsmLibraryVideoBound flag'i set edilir.

(function () {
  "use strict";

  // ── Module-level lazy refs (gelecek extension'lar icin) ────────────
  // Su an hicbir dep kullanilmiyor; init() bos deps ile cagrilabilir.

  function init(deps) {
    // Reserved for future extension (currently no-op).
    // Olasi gelecek deps: showStatus (search basarisiz ise toast),
    // exerciseMediaService (curated video URL lookup), telemetry callback.
    void deps;
  }

  // ═══════════════════════════════════════════════════════════════════
  // openExerciseVideoModal — Video butonuna click sonrasi YouTube search
  // URL'i uretir ve yeni sekmede acar.
  // v1.4.3: YouTube modal kaldırıldı — listType=search embed YouTube tarafından
  // kısıtlandığı için "Bu video kullanılamıyor" hatası veriyordu. Daha temiz UX:
  // video buton click → doğrudan YouTube search sayfasını yeni sekmede aç.
  // Modal/iframe karmaşası yok, telif/embed sorunları yok, %100 calisir.
  // ═══════════════════════════════════════════════════════════════════
  function openExerciseVideoModal(exerciseName) {
    const safeName = String(exerciseName || "Egzersiz").trim();
    const query = `${safeName} nasıl yapılır doğru form`;
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(searchUrl, "_blank", "noopener,noreferrer");
  }

  // ═══════════════════════════════════════════════════════════════════
  // closeExerciseVideoModal — Backward-compat noop.
  // v1.4.3: Modal aktif degil; event handler hala cagirabilir ama is-hidden
  // ekleme + body class temizleme defensive davranisi korunur (kullanici eski
  // markup'a denk gelirse temizleme yapilir).
  // ═══════════════════════════════════════════════════════════════════
  function closeExerciseVideoModal() {
    const modal = document.querySelector("#exerciseVideoModal");
    if (modal) modal.classList.add("is-hidden");
    document.body.classList.remove("is-video-modal-open");
  }

  // ═══════════════════════════════════════════════════════════════════
  // Click delegation handler — document-level
  // [data-exercise-video-open] → open
  // [data-video-modal-close] → close
  // ═══════════════════════════════════════════════════════════════════
  function handleClick(event) {
    // v1.4.2: YouTube video modal — ▶ Video butonu
    const videoOpenBtn = event.target.closest("[data-exercise-video-open]");
    if (videoOpenBtn) {
      openExerciseVideoModal(videoOpenBtn.dataset.exerciseName || "Egzersiz");
      return;
    }
    if (event.target.closest("[data-video-modal-close]")) {
      closeExerciseVideoModal();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Keydown delegation handler — document-level
  // v1.4.2: ESC ile video modal kapatma
  // ═══════════════════════════════════════════════════════════════════
  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    const videoModal = document.querySelector("#exerciseVideoModal");
    if (videoModal && !videoModal.classList.contains("is-hidden")) {
      closeExerciseVideoModal();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Event binding — idempotent guard via document.documentElement.dataset
  // App.js initialize() icinden bir kez cagrilir. Ikinci cagri no-op.
  // ═══════════════════════════════════════════════════════════════════
  function bindLibraryVideoModalHandlers() {
    if (document.documentElement.dataset.bsmLibraryVideoBound === "true") return;
    document.documentElement.dataset.bsmLibraryVideoBound = "true";
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);
  }

  window.BSMLibraryVideoModal = {
    init: init,
    bindLibraryVideoModalHandlers: bindLibraryVideoModalHandlers,
  };
})();
