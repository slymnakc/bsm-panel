// 41-library-gif-fallback.spec.js — BUG-LIBRARY-GIF-001
// GIF manifest / allowlist: eksik assets/gifs/*.gif için network isteği
// yapılmaz, console 404 oluşmaz, kırık görsel yerine mevcut video CTA
// fallback'i (renderMissingExerciseMedia) gösterilir.
//
// KURAL: media.gifUrl yalnız manifest'te (window.BSMGifManifest) bulunan
// slug'lar için üretilir. Explicit/custom/remote gifUrl manifest'ten muaftır.
//
// NOT (ortam farkı, keşif bulgusu): localhost server.js eksik dosyaya SPA
// fallback ile 200+index.html döner — bu yüzden "404 yok" assert'i anlamsız;
// doğru assert "manifest-dışı sluga İSTEK HİÇ ATILMADI"dır.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

// Repo'daki gerçek GIF dosyaları (assets/gifs) — manifest bunlarla eşleşmeli
const MANIFEST_SLUGS = [
  "assisted-dip",
  "assisted-pull-up",
  "back-extension",
  "band-assisted-dip",
  "band-resisted-push-up",
  "barbell-bench-press",
];

// Keşifte doğrulanmış örnekler:
const MISSING_EXERCISE = "Lat pulldown";   // slug: lat-pulldown — manifest DIŞI
const PRESENT_EXERCISE = "Assisted dip";   // slug: assisted-dip — manifest'te

// Library'yi açar ve grid'i sonuna kadar scroll eder (lazy-load tetiklensin)
async function openLibraryAndScroll(page) {
  await navigate(page, "library");
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    const step = 900;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Eksik GIF: <img> yok, video CTA fallback görünür
// ════════════════════════════════════════════════════════════════════════════
test("Manifest-dışı egzersiz kartı video CTA fallback gösterir (img yok)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await openLibraryAndScroll(page);

  const card = await page.evaluate((name) => {
    const media = document.querySelector(`.exercise-media[data-exercise-name="${name}"]`);
    if (!media) return { found: false };
    return {
      found: true,
      hasImg: !!media.querySelector("img[data-exercise-gif-img]"),
      isVideoOnly: media.classList.contains("exercise-media--video-only"),
      hasVideoCta: !!media.querySelector("[data-exercise-video-open]"),
      isMissingBroken: media.classList.contains("is-missing"),
    };
  }, MISSING_EXERCISE);

  expect(card.found, `${MISSING_EXERCISE} kartı library'de render edildi`).toBe(true);
  expect(card.hasImg, "eksik GIF'te <img data-exercise-gif-img> OLMAMALI").toBe(false);
  expect(card.isVideoOnly, "exercise-media--video-only fallback aktif").toBe(true);
  expect(card.hasVideoCta, "video CTA butonu görünür").toBe(true);
  expect(card.isMissingBroken, "onerror sonrası kırık is-missing durumu OLMAMALI (istek hiç atılmadı)").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Manifest-dışı slug'a NETWORK İSTEĞİ HİÇ GİTMEZ
// ════════════════════════════════════════════════════════════════════════════
test("Eksik GIF için assets/gifs network isteği yapılmaz", async ({ page }) => {
  const gifRequests = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("assets/gifs/")) {
      gifRequests.push(url.split("/").pop().split("?")[0]);
    }
  });

  const { errors } = await setupPage(page);
  await openLibraryAndScroll(page);

  const allowedFiles = new Set(MANIFEST_SLUGS.map((s) => `${s}.gif`));
  const disallowed = gifRequests.filter((f) => !allowedFiles.has(f));

  expect(disallowed, `manifest-dışı GIF isteği SIFIR olmalı (gidenler: ${[...new Set(disallowed)].join(", ") || "-"})`).toHaveLength(0);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Manifest'teki GIF korunur: gerçek <img>, fallback'e düşmez
// ════════════════════════════════════════════════════════════════════════════
test("Manifest'teki egzersiz gerçek GIF <img> gösterir", async ({ page }) => {
  const { errors } = await setupPage(page);
  await openLibraryAndScroll(page);

  const card = await page.evaluate((name) => {
    const media = document.querySelector(`.exercise-media[data-exercise-name="${name}"]`);
    const img = media?.querySelector("img[data-exercise-gif-img]");
    return {
      found: !!media,
      hasImg: !!img,
      src: img?.getAttribute("src") || "",
      isVideoOnly: media?.classList.contains("exercise-media--video-only") || false,
    };
  }, PRESENT_EXERCISE);

  expect(card.found, `${PRESENT_EXERCISE} kartı render edildi`).toBe(true);
  expect(card.hasImg, "gerçek GIF <img> mevcut").toBe(true);
  expect(card.src, "src assets/gifs/assisted-dip.gif").toContain("assets/gifs/assisted-dip.gif");
  expect(card.isVideoOnly, "fallback'e DÜŞMEMELİ").toBe(false);

  // Ek güvence: DOM'daki TÜM gif <img>'leri manifest dosyalarından olmalı
  const allSrcs = await page.evaluate(() =>
    [...document.querySelectorAll(".library-exercise img[data-exercise-gif-img]")]
      .map((i) => (i.getAttribute("src") || "").split("/").pop()),
  );
  const allowed = new Set(MANIFEST_SLUGS.map((s) => `${s}.gif`));
  const rogue = allSrcs.filter((f) => !allowed.has(f));
  expect(allSrcs.length, "en az 1 gerçek GIF kartı var").toBeGreaterThan(0);
  expect(rogue, `manifest-dışı src'li <img> olmamalı (bulunan: ${rogue.join(", ") || "-"})`).toHaveLength(0);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Library regresyon: grid + kart sayısı + arama
// ════════════════════════════════════════════════════════════════════════════
test("Library grid, kart sayısı ve arama davranışı korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(800);

  const before = await page.evaluate(() => ({
    count: document.querySelectorAll(".library-exercise").length,
    videoTriggers: document.querySelectorAll("[data-exercise-video-open]").length,
  }));
  expect(before.count, "en az 30 egzersiz kartı (08-spec eşiği)").toBeGreaterThan(30);
  expect(before.videoTriggers, "video butonları render").toBeGreaterThan(0);

  // Canlı arama (36-spec davranışı) — filtre daraltır
  await page.fill("#exerciseSearch", "pulldown");
  await page.waitForTimeout(700);
  const filtered = await page.evaluate(() => document.querySelectorAll(".library-exercise").length);
  expect(filtered, "arama sonuçları daraldı").toBeLessThan(before.count);
  expect(filtered, "pulldown sonuç buldu").toBeGreaterThan(0);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — Explicit/custom gifUrl manifest'ten MUAF
// (Servis seviyesinde doğrulanır: custom exercise UI yolu 12-spec'te ayrıca
//  regresyon olarak koşuluyor; burada muafiyet kuralının kendisi kilitlenir.)
// ════════════════════════════════════════════════════════════════════════════
test("Explicit gifUrl manifest kontrolünden muaf — custom exercise korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const svc = window.BSMExerciseMediaService;
    const remote = svc.buildExerciseMedia({ name: "Custom Remote Move", gifUrl: "https://cdn.example.com/custom-move.gif" });
    const localExplicit = svc.buildExerciseMedia({ name: "Custom Local Move", gifUrl: "my-own-upload.gif" });
    const plain = svc.buildExerciseMedia({ name: "Lat pulldown" });
    const inManifest = svc.buildExerciseMedia({ name: "Assisted dip" });
    return {
      remoteKept: remote.gifUrl === "https://cdn.example.com/custom-move.gif",
      localExplicitKept: (localExplicit.gifUrl || "").includes("my-own-upload.gif"),
      plainEmpty: !plain.gifUrl,
      plainNoCandidates: !(plain.candidateGifUrls || []).length,
      manifestResolved: (inManifest.gifUrl || "").includes("assets/gifs/assisted-dip.gif"),
    };
  });

  expect(r.remoteKept, "remote explicit gifUrl aynen korunur").toBe(true);
  expect(r.localExplicitKept, "lokal explicit dosya adı korunur (normalize edilerek)").toBe(true);
  expect(r.plainEmpty, "manifest-dışı slug → gifUrl boş").toBe(true);
  expect(r.plainNoCandidates, "manifest-dışı slug → candidate zinciri boş (alias 404 denemesi yok)").toBe(true);
  expect(r.manifestResolved, "manifest'teki slug → gerçek yol").toBe(true);

  assertNoErrors(errors);
});
