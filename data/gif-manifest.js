(function () {
  "use strict";

  // BUG-LIBRARY-GIF-001: assets/gifs klasöründe GERÇEKTEN var olan GIF slug'ları.
  // exercise-media-service yalnız bu listedeki slug'lar için yerel GIF yolu üretir;
  // listede olmayan slug için network isteği HİÇ yapılmaz (kart video CTA fallback'e düşer).
  //
  // BAKIM: assets/gifs'e yeni GIF eklendiğinde dosya adını (.gif uzantısız) buraya ekleyin.
  // Explicit/custom gifUrl'ler (üye tanımlı hareketler, remote URL) bu listeden MUAFTIR.
  window.BSMGifManifest = [
    "assisted-dip",
    "assisted-pull-up",
    "back-extension",
    "band-assisted-dip",
    "band-resisted-push-up",
    "barbell-bench-press",
  ];
})();
