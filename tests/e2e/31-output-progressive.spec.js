// 31-output-progressive.spec.js — BSM-UX-004a: Output Progressive Disclosure
// Output ekranında 11 result-card → 3 ana kart açık + 8 detay kartı tek
// <details class="output-detail-panel"> ("Detaylı Analiz") altında, varsayılan kapalı.
//
// HOOK'SUZ: gerçek DOM yapı kontrolü + native <details> toggle + görünürlük.
// Üretim koduna SIFIR JS dokunuş (sadece index.html + styles.css).
//
// Doğrulamalar:
//   - .output-detail-panel bir <details> ve grid'in direct child'ı
//   - details.open === false (varsayılan kapalı)
//   - 8 detay kartı details içinde (contains)
//   - 3 ana kart details dışında + DOM'da
//   - 11 kartın tamamı mount
//   - summary tıklanınca details.open === true + detay kartı erişilebilir
//   - summary metni "Detaylı Analiz"
//   - console/page/network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

// Açık kalacak ana operasyon kartları (içerik mount node ID'leri)
const OPEN_CARD_IDS = ["programOverview", "weeklyPlan", "outputNutritionPlan"];

// "Detaylı Analiz" altına taşınacak detay kartları (= print'te gizlenen 8 kart)
const DETAIL_CARD_IDS = [
  "trainingReportPanel",
  "coachNote",
  "aiReportSummary",
  "nextControlReport",
  "outputWarnings",
  "muscleCoverage",
  "progressionPlan",
  "guidanceBlock",
];

test("Output progressive disclosure — Detaylı Analiz <details> (BSM-UX-004a)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "output");
  await page.waitForTimeout(300);

  // ─── 1: Yapısal doğrulama (DOM) ───────────────────────────────────────
  const struct = await page.evaluate((ids) => {
    const grid =
      document.querySelector(".results__grid.output-clean-grid") ||
      document.querySelector(".output-clean-grid");
    const details = document.querySelector(".output-detail-panel");
    const isDetails = !!details && details.tagName.toLowerCase() === "details";

    const detailInside = {};
    ids.detail.forEach((id) => {
      const el = document.getElementById(id);
      detailInside[id] = !!(el && details && details.contains(el));
    });

    const openOutside = {};
    ids.open.forEach((id) => {
      const el = document.getElementById(id);
      openOutside[id] = !!(el && details && !details.contains(el));
    });

    const allMount = {};
    [...ids.open, ...ids.detail].forEach((id) => {
      allMount[id] = !!document.getElementById(id);
    });

    return {
      gridFound: !!grid,
      isDetails,
      open: details ? details.open : null,
      detailIsGridChild: !!(grid && details && details.parentElement === grid),
      summaryText: (details?.querySelector(":scope > summary")?.textContent || "").trim(),
      detailInside,
      openOutside,
      allMount,
    };
  }, { open: OPEN_CARD_IDS, detail: DETAIL_CARD_IDS });

  // 1a: details var ve grid direct child
  expect(struct.gridFound, ".output-clean-grid DOM'da").toBe(true);
  expect(struct.isDetails, ".output-detail-panel bir <details> elementi").toBe(true);
  expect(struct.detailIsGridChild, "details, output-clean-grid'in direct child'ı").toBe(true);

  // 1b: varsayılan kapalı
  expect(struct.open, "details varsayılan KAPALI (open=false)").toBe(false);

  // 1c: summary metni
  expect(/Detaylı Analiz/i.test(struct.summaryText),
    `summary metni "Detaylı Analiz" içerir (gerçek: "${struct.summaryText}")`).toBe(true);

  // ─── 2: 8 detay kartı details içinde ──────────────────────────────────
  DETAIL_CARD_IDS.forEach((id) => {
    expect(struct.detailInside[id], `#${id} details içinde`).toBe(true);
  });

  // ─── 3: 3 ana kart details dışında ────────────────────────────────────
  OPEN_CARD_IDS.forEach((id) => {
    expect(struct.openOutside[id], `#${id} details DIŞINDA (açık kalır)`).toBe(true);
  });

  // ─── 4: 11 kartın tamamı mount ────────────────────────────────────────
  [...OPEN_CARD_IDS, ...DETAIL_CARD_IDS].forEach((id) => {
    expect(struct.allMount[id], `#${id} DOM'da mount`).toBe(true);
  });

  // ─── 5: Summary tıkla → details açılır (progressive disclosure özü) ────
  // Not: Görünürlük (offsetParent) output paneli render'ına bağlı; bu spec
  // YAPISAL disclosure'u test eder (details.open state). Panel render görünürlüğü
  // 13-output-render kapsamında. "Erişilebilir" = açık details içinde mount.
  const afterToggle = await page.evaluate(() => {
    const summary = document.querySelector(".output-detail-panel > summary");
    summary?.click();
    const details = document.querySelector(".output-detail-panel");
    const ai = document.getElementById("aiReportSummary");
    return {
      open: details ? details.open : null,
      aiAccessible: !!(ai && details && details.open && details.contains(ai)),
    };
  });
  expect(afterToggle.open, "summary tıklanınca details AÇILDI (open=true)").toBe(true);
  expect(afterToggle.aiAccessible, "Açılınca detay kartı erişilebilir (açık details içinde)").toBe(true);

  // ─── 6: Tekrar tıkla → kapanır (toggle çift yönlü) ────────────────────
  const afterReToggle = await page.evaluate(() => {
    const summary = document.querySelector(".output-detail-panel > summary");
    summary?.click();
    return document.querySelector(".output-detail-panel")?.open;
  });
  expect(afterReToggle, "tekrar tıklanınca details KAPANDI (open=false)").toBe(false);

  // ─── 7: console / page / network error 0 ──────────────────────────────
  assertNoErrors(errors);
});
