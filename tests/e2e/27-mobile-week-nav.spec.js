// 27-mobile-week-nav.spec.js — M1b.7 Mobile responsive
// 375px viewport (iPhone SE/12 mini) ile week navigation + badge + resume
// buton testleri. Chip taşması yok, horizontal scroll çalışıyor, touch target
// minimumları korunmuş, badge mobilde okunabilir.
//
// Kontroller:
//   1. Mobile viewport tabs container görünür + visible (8 hafta)
//   2. Chip touch target >= 44×44 (WCAG mobil minimum)
//   3. Tabs grup horizontal scroll yapılabilir (overflow-x: auto)
//   4. Container container'a TAŞMADAN sığar (chips wrap veya scroll)
//   5. Mode badge görünür (data-week-auto-badge mevcut)
//   6. Resume buton manuel mod'da görünür (autoMode=false)
//   7. Resume buton click → resumeAutoWeekMode çağrılır (touch event)
//   8. Cover macrocycle band mobile'da görünür + okunabilir
//   9. console / page / network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

// iPhone SE / 12 mini viewport — 375×667 (en dar mainstream)
test.use({ viewport: { width: 375, height: 667 } });

async function seedEightWeekProgram(page, opts = {}) {
  const { autoMode = false, currentWeekIndex = 3 } = opts;
  return page.evaluate((cfg) => {
    const baseSession = { day: "monday", dayLabel: "Pzt", title: "T", sessionIndex: 0,
      exercises: [{ name: "Bench", group: "chest", sets: 4, reps: "8", prescription: "4 x 8" }] };
    const mkSessions = () => JSON.parse(JSON.stringify([baseSession]));
    const weeks = Array.from({ length: 8 }, (_, i) => ({
      weekIndex: i + 1,
      isDeload: (i + 1) % 4 === 0,
      intensityFactor: 1.0,
      sessions: mkSessions(),
    }));
    const program = {
      schemaVersion: 4,
      title: "Mobile Test",
      createdAtIso: new Date().toISOString(),
      overview: [["Üye", "Mobile Üye"]],
      coachNote: "T", progression: [], guidance: [], coverage: [],
      macrocycle: { totalWeeks: 8, model: "linear", deloadCadence: 4, progressionRule: { type: "linear", deltaPercent: 2.5 } },
      weeks,
      currentWeekIndex: cfg.currentWeekIndex,
      currentWeekIndexAutoMode: cfg.autoMode,
      sessions: weeks[cfg.currentWeekIndex - 1].sessions,
      rawData: { memberName: "Mobile Üye", trainerName: "T", goal: "muscle-gain", level: "intermediate", days: ["monday"], startDate: "" },
    };
    window.BSMTestApi.renderProgramForTest(program);
    return true;
  }, { autoMode, currentWeekIndex });
}

test("Mobile week navigation — chip layout + scroll + badge + resume button", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "output");
  await page.waitForTimeout(300);

  await seedEightWeekProgram(page, { autoMode: false, currentWeekIndex: 3 });
  await page.waitForTimeout(400);

  // ─── DOĞRULAMA 1: Tabs container görünür + visible ────────────────────
  const containerMetrics = await page.evaluate(() => {
    const c = document.querySelector("#programWeekTabs");
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const chips = [...document.querySelectorAll("[data-week-chip]")];
    return {
      hidden: c.hidden,
      visible: rect.width > 0 && rect.height > 0,
      width: Math.round(rect.width),
      chipCount: chips.length,
      viewportWidth: window.innerWidth,
    };
  });
  expect(containerMetrics, "Container DOM'da").not.toBeNull();
  expect(containerMetrics.hidden, "8 hafta → tabs visible").toBe(false);
  expect(containerMetrics.visible, "Container visible (rect.width > 0)").toBe(true);
  expect(containerMetrics.chipCount, "8 chip render").toBe(8);
  expect(containerMetrics.viewportWidth, "Mobile viewport 375px").toBe(375);

  // ─── DOĞRULAMA 2: Chip touch target >= 44×44 (WCAG mobil minimum) ──────
  const chipSizes = await page.evaluate(() => {
    return [...document.querySelectorAll("[data-week-chip]")].slice(0, 3).map((chip) => {
      const rect = chip.getBoundingClientRect();
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    });
  });
  chipSizes.forEach((size, i) => {
    expect(size.w, `Chip ${i+1} width >= 44px (gerçek: ${size.w})`).toBeGreaterThanOrEqual(44);
    expect(size.h, `Chip ${i+1} height >= 44px (gerçek: ${size.h})`).toBeGreaterThanOrEqual(44);
  });

  // ─── DOĞRULAMA 3: Tabs grup horizontal scroll yapılabilir ──────────────
  const groupScroll = await page.evaluate(() => {
    const group = document.querySelector(".program-week-tabs__group");
    if (!group) return null;
    const style = window.getComputedStyle(group);
    return {
      overflowX: style.overflowX,
      scrollWidth: group.scrollWidth,
      clientWidth: group.clientWidth,
      hasScrollOrFlex: group.scrollWidth > group.clientWidth
        || style.flexWrap === "wrap"
        || style.flexWrap === "wrap-reverse",
    };
  });
  expect(groupScroll, "Group element mevcut").not.toBeNull();
  // overflow-x auto/scroll veya flex-wrap wrap; herhangi biri yeterli (mobile fit stratejisi)
  const okOverflow = ["auto", "scroll"].includes(groupScroll.overflowX);
  expect(okOverflow || groupScroll.hasScrollOrFlex, `Mobile chip taşması yönetiliyor (overflow=${groupScroll.overflowX}, scroll=${groupScroll.scrollWidth}/${groupScroll.clientWidth})`).toBe(true);

  // ─── DOĞRULAMA 4: Container viewport'a sığar (taşma yok) ──────────────
  const containerOverflow = await page.evaluate(() => {
    const c = document.querySelector("#programWeekTabs");
    const rect = c.getBoundingClientRect();
    return {
      right: Math.round(rect.right),
      viewportWidth: window.innerWidth,
      fits: rect.right <= window.innerWidth + 1,  // 1px tolerans
    };
  });
  expect(containerOverflow.fits, `Container viewport içine sığar (right=${containerOverflow.right}, vw=${containerOverflow.viewportWidth})`).toBe(true);

  // ─── DOĞRULAMA 5: Mode badge görünür ──────────────────────────────────
  const badgeState = await page.evaluate(() => {
    const badge = document.querySelector("[data-week-auto-badge]");
    if (!badge) return null;
    const rect = badge.getBoundingClientRect();
    return {
      mode: badge.dataset.weekAutoBadge,
      visible: rect.width > 0 && rect.height > 0,
      text: (badge.textContent || "").trim(),
      width: Math.round(rect.width),
    };
  });
  expect(badgeState, "Badge DOM'da").not.toBeNull();
  expect(badgeState.visible, "Mobile'da badge visible").toBe(true);
  expect(badgeState.mode, "Manuel mod'da data-week-auto-badge='manual'").toBe("manual");
  expect(/Hafta\s*3/i.test(badgeState.text), `Badge text "Hafta 3" içermeli (gerçek: "${badgeState.text}")`).toBe(true);

  // ─── DOĞRULAMA 6: Resume buton manuel mod'da görünür ──────────────────
  const resumeState = await page.evaluate(() => {
    const btn = document.querySelector("[data-week-auto-resume]");
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return {
      hidden: btn.hidden,
      visible: rect.width > 0 && rect.height > 0,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      fits: rect.right <= window.innerWidth + 1,
    };
  });
  expect(resumeState, "Resume buton DOM'da").not.toBeNull();
  expect(resumeState.hidden, "Manuel mod → resume buton hidden=false").toBe(false);
  expect(resumeState.visible, "Manuel mod → resume buton visible").toBe(true);
  // Touch target 44×44 WCAG minimum
  expect(resumeState.height, `Resume buton height >= 44px (gerçek: ${resumeState.height})`).toBeGreaterThanOrEqual(44);
  expect(resumeState.fits, "Resume buton viewport içine sığar").toBe(true);

  // ─── DOĞRULAMA 7: Resume buton click → autoMode=true (touch event) ────
  // Mobile click davranışı: programatik click yine işler, gerçek touch event simülasyonu
  // Playwright .click() ile yapılır (touch tap default değil ama event handler aynı path).
  // Önce startDate set et ki resume sonrası compute null değil olsun.
  await page.evaluate(() => {
    window.BSMTestApi.__setRawStartDateForTest(new Date().toISOString().slice(0, 10));
  });
  await page.locator("[data-week-auto-resume]").click();
  await page.waitForTimeout(300);
  const afterResume = await page.evaluate(() => window.BSMTestApi.getProgramAutoSnapshot());
  expect(afterResume.autoMode, "Resume click → autoMode=true").toBe(true);

  // ─── DOĞRULAMA 8: Cover macrocycle band mobile'da görünür ─────────────
  const coverState = await page.evaluate(() => {
    const band = document.querySelector("#coverMacrocycle");
    if (!band) return null;
    const rect = band.getBoundingClientRect();
    const title = (document.querySelector("#coverMacroTitle")?.textContent || "").trim();
    return {
      hidden: band.hidden,
      visible: rect.width > 0 && rect.height > 0,
      fits: rect.right <= window.innerWidth + 1,
      title,
    };
  });
  expect(coverState, "Cover band DOM'da").not.toBeNull();
  expect(coverState.hidden, "Cover band visible").toBe(false);
  expect(coverState.fits, "Cover band viewport içine sığar").toBe(true);
  expect(/Haftalık/i.test(coverState.title), "Cover title okunabilir").toBe(true);

  // ─── DOĞRULAMA 9: Console / page / network error 0 ────────────────────
  assertNoErrors(errors);
});
