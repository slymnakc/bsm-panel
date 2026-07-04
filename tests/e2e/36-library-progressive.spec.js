// 36-library-progressive.spec.js — BSM-UX-004f: Library Progressive Disclosure
// Arama + filtreler + kas grubu sekmeleri + grid açık kalır; Alfabe şeridi
// (#alphabetTabs) native <details> default KAPALI. "Bul" butonu (canlı arama
// nedeniyle gereksiz) görsel ikincilleştirilir — DOM'dan çıkarılmaz, ID/handler korunur.
//
// Üretim dokunuşu yalnızca index.html (statik <details> + Bul class) + styles.css.
// app.js/handlers/render hedefleri/arama canlı davranışı değişmez.
//
// NOT: kapalı <details> içeriği modern Chrome'da content-visibility ile gizlenir
// → görünürlük checkVisibility() ile ölçülür.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Library temel görünüm: arama + filtreler + kas sekmeleri + grid açık
// ════════════════════════════════════════════════════════════════════════════
test("Library temel görünüm — arama, filtreler, kas sekmeleri, grid açık", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(800);

  const base = await page.evaluate(() => {
    const vis = (id) => { const el = document.getElementById(id); return !!(el && el.checkVisibility()); };
    return {
      searchVisible: vis("exerciseSearch"),
      groupVisible: vis("libraryGroupFilter"),
      equipVisible: vis("libraryEquipmentFilter"),
      muscleVisible: vis("muscleGroupTabs"),
      gridMount: !!document.getElementById("exerciseLibrary"),
      exerciseCount: document.querySelectorAll(".library-exercise").length,
    };
  });

  expect(base.searchVisible, "#exerciseSearch görünür").toBe(true);
  expect(base.groupVisible, "#libraryGroupFilter görünür").toBe(true);
  expect(base.equipVisible, "#libraryEquipmentFilter görünür").toBe(true);
  expect(base.muscleVisible, "#muscleGroupTabs görünür").toBe(true);
  expect(base.gridMount, "#exerciseLibrary mount").toBe(true);
  expect(base.exerciseCount, ".library-exercise > 30").toBeGreaterThan(30);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Alfabe disclosure (default KAPALI + toggle)
// ════════════════════════════════════════════════════════════════════════════
test("Alfabe sekmeleri — <details> default kapalı + toggle", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(800);

  const alpha = await page.evaluate(() => {
    const tabs = document.getElementById("alphabetTabs");
    const details = tabs ? tabs.closest("details.library-alphabet-disclosure") : null;
    return {
      detailsExists: !!details,
      isDetails: details ? details.tagName.toLowerCase() === "details" : false,
      open: details ? details.open : null,
      tabsMount: !!tabs,
      tabsInside: !!(tabs && details && details.contains(tabs)),
      closedNotVisible: !!(tabs && !tabs.checkVisibility()),
    };
  });

  expect(alpha.detailsExists, "#alphabetTabs <details> wrapper var").toBe(true);
  expect(alpha.isDetails, "wrapper bir <details>").toBe(true);
  expect(alpha.open, "alfabe details default KAPALI").toBe(false);
  expect(alpha.tabsMount, "#alphabetTabs mount").toBe(true);
  expect(alpha.tabsInside, "#alphabetTabs details içinde").toBe(true);
  expect(alpha.closedNotVisible, "kapalıyken #alphabetTabs görünmez").toBe(true);

  const toggled = await page.evaluate(() => {
    const details = document.querySelector("details.library-alphabet-disclosure");
    const summary = details ? details.querySelector(":scope > summary") : null;
    summary?.click();
    const openState = details ? details.open : null;
    const tabs = document.getElementById("alphabetTabs");
    const visibleWhenOpen = !!(tabs && tabs.checkVisibility());
    summary?.click();
    const closedState = details ? details.open : null;
    return { openState, visibleWhenOpen, closedState };
  });
  expect(toggled.openState, "summary tık → açıldı").toBe(true);
  expect(toggled.visibleWhenOpen, "açıkken #alphabetTabs görünür").toBe(true);
  expect(toggled.closedState, "tekrar tık → kapandı").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — ID koruma + Bul ikincilleştirme
// ════════════════════════════════════════════════════════════════════════════
test("ID koruma + Bul butonu ikincilleştirildi (DOM'da kalır)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(800);

  const ids = [
    "libraryPanel", "libraryCount", "exerciseSearch", "libraryGroupFilter",
    "libraryEquipmentFilter", "findExerciseButton", "clearExerciseSearchButton",
    "muscleGroupTabs", "alphabetTabs", "exerciseLibrary",
  ];
  const check = await page.evaluate((list) => {
    const mount = {};
    list.forEach((id) => { mount[id] = !!document.getElementById(id); });
    const findBtn = document.getElementById("findExerciseButton");
    const clearBtn = document.getElementById("clearExerciseSearchButton");
    return {
      mount,
      findMount: !!findBtn,
      findSecondaryClass: !!(findBtn && findBtn.classList.contains("library-search-button--secondary")),
      clearVisible: !!(clearBtn && clearBtn.checkVisibility()),
    };
  }, ids);

  ids.forEach((id) => {
    expect(check.mount[id], `#${id} DOM'da mount`).toBe(true);
  });
  expect(check.findMount, "#findExerciseButton DOM'da kalır (silinmedi)").toBe(true);
  expect(check.findSecondaryClass, "#findExerciseButton ikincil class'a sahip").toBe(true);
  expect(check.clearVisible, "#clearExerciseSearchButton görünür kalır").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Canlı arama: Bul'a basmadan filtrelenir; Temizle geri doldurur
// ════════════════════════════════════════════════════════════════════════════
test("Canlı arama — Bul'a basmadan filtreler, Temizle geri doldurur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "library");
  await page.waitForTimeout(800);

  const before = await page.evaluate(() => document.querySelectorAll(".library-exercise").length);
  expect(before, "başlangıç grid dolu (>30)").toBeGreaterThan(30);

  // Arama terimi yaz + input event (Bul'a BASMADAN)
  const afterSearch = await page.evaluate(() => {
    const input = document.getElementById("exerciseSearch");
    input.value = "bench";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return null;
  });
  await page.waitForTimeout(400);
  const filtered = await page.evaluate(() => document.querySelectorAll(".library-exercise").length);
  expect(filtered, `canlı arama filtreledi (Bul'a basmadan): ${before} → ${filtered}`).toBeLessThan(before);

  // Temizle → grid geri dolar
  await page.evaluate(() => document.getElementById("clearExerciseSearchButton")?.click());
  await page.waitForTimeout(400);
  const cleared = await page.evaluate(() => document.querySelectorAll(".library-exercise").length);
  expect(cleared, "Temizle sonrası grid tekrar dolu").toBeGreaterThan(30);

  assertNoErrors(errors);
});
