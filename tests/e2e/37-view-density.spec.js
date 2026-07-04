// 37-view-density.spec.js — BSM-UX-004h: Basit / Profesyonel Görünüm Toggle
// Global density tercihi (simple|pro), localStorage'da saklanır. Pro modda YALNIZCA
// 4 içerik-disclosure açılır; aksiyon/curated/teknik details asla yönetilmez.
//
// Whitelist (yönetilen): .output-detail-panel, .measurement-detail-fields,
//   .dashboard-disclosure--activity, .library-alphabet-disclosure
// Exclude (dokunulmaz): .builder-more-actions, .library-manager, .segmental-details,
//   .bsm-nutrition-acc, .dashboard-disclosure--commands
//
// Test default = simple (setupPage key seed etmez) → mevcut 68 test korunur.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

const DENSITY_KEY = "formaplan-studio-view-density";
const WHITELIST = [
  ".output-detail-panel",
  ".measurement-detail-fields",
  ".dashboard-disclosure--activity",
  ".library-alphabet-disclosure",
];

function readOpenStates(selectors) {
  const r = {};
  selectors.forEach((sel) => {
    const el = document.querySelector(sel);
    r[sel] = el ? el.open : null;
  });
  return r;
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — default simple: key yok, whitelist kapalı, API expose
// ════════════════════════════════════════════════════════════════════════════
test("default simple — whitelist kapalı + toggle Basit + API expose", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.waitForTimeout(400);

  const state = await page.evaluate((cfg) => {
    const api = window.BSMViewDensity;
    const toggle = document.querySelector(".view-density-toggle");
    const simpleBtn = document.querySelector('.view-density-toggle__button[data-density="simple"]');
    const readOpen = (sels) => { const r = {}; sels.forEach((s) => { const e = document.querySelector(s); r[s] = e ? e.open : null; }); return r; };
    return {
      apiExpose: typeof api === "object" && typeof api.get === "function" && typeof api.set === "function" && typeof api.apply === "function",
      storageKey: api ? api.STORAGE_KEY : null,
      lsValue: localStorage.getItem(cfg.key),
      currentDensity: api ? api.get() : null,
      toggleExists: !!toggle,
      simpleActive: !!(simpleBtn && simpleBtn.classList.contains("is-active")),
      whitelistOpen: readOpen(cfg.whitelist),
    };
  }, { key: DENSITY_KEY, whitelist: WHITELIST });

  expect(state.apiExpose, "window.BSMViewDensity expose (get/set/apply)").toBe(true);
  expect(state.storageKey, "STORAGE_KEY doğru").toBe(DENSITY_KEY);
  expect(state.lsValue, "localStorage'da key seed edilmemiş (yok)").toBeNull();
  expect(state.currentDensity, "default simple").toBe("simple");
  expect(state.toggleExists, ".view-density-toggle DOM'da").toBe(true);
  expect(state.simpleActive, "Basit butonu aktif").toBe(true);
  WHITELIST.forEach((sel) => {
    expect(state.whitelistOpen[sel], `${sel} simple'da KAPALI`).toBe(false);
  });

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — pro mode: whitelist açılır, exclude dokunulmaz
// ════════════════════════════════════════════════════════════════════════════
test("pro mode — whitelist açılır, exclude korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.waitForTimeout(400);

  const pro = await page.evaluate((cfg) => {
    document.querySelector('.view-density-toggle__button[data-density="pro"]')?.click();
    const readOpen = (sels) => { const r = {}; sels.forEach((s) => { const e = document.querySelector(s); r[s] = e ? e.open : null; }); return r; };
    const proBtn = document.querySelector('.view-density-toggle__button[data-density="pro"]');
    // curated: macros default kapalı — pro'da zorlanmamalı
    const macros = document.querySelector('.bsm-nutrition-acc[data-acc="macros"]');
    return {
      lsValue: localStorage.getItem(cfg.key),
      proActive: !!(proBtn && proBtn.classList.contains("is-active")),
      whitelistOpen: readOpen(cfg.whitelist),
      excludeOpen: readOpen([".builder-more-actions", ".library-manager", ".segmental-details"]),
      macrosOpen: macros ? macros.open : null,
    };
  }, { key: DENSITY_KEY, whitelist: WHITELIST });

  expect(pro.lsValue, "localStorage = pro").toBe("pro");
  expect(pro.proActive, "Profesyonel butonu aktif").toBe(true);
  WHITELIST.forEach((sel) => {
    expect(pro.whitelistOpen[sel], `${sel} pro'da AÇIK`).toBe(true);
  });
  // exclude: pro'da açılMAmalı
  expect(pro.excludeOpen[".builder-more-actions"], "builder-more-actions kapalı (exclude)").toBe(false);
  expect(pro.excludeOpen[".library-manager"], "library-manager kapalı (exclude)").toBe(false);
  expect(pro.excludeOpen[".segmental-details"], "segmental-details kapalı (exclude)").toBe(false);
  expect(pro.macrosOpen, "nutrition macros curated default (kapalı) korunur").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — persistence: pro→reload→pro; simple→reload→simple
// ════════════════════════════════════════════════════════════════════════════
test("persistence — reload sonrası mod + whitelist durumu korunur", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.waitForTimeout(400);

  // pro seç
  await page.evaluate(() => document.querySelector('.view-density-toggle__button[data-density="pro"]')?.click());
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => { document.body.classList.remove("auth-required"); document.querySelector("#authGate")?.classList.add("is-hidden"); });
  await page.waitForTimeout(600);

  const afterProReload = await page.evaluate((cfg) => {
    const readOpen = (sels) => { const r = {}; sels.forEach((s) => { const e = document.querySelector(s); r[s] = e ? e.open : null; }); return r; };
    return {
      density: window.BSMViewDensity?.get(),
      proActive: !!document.querySelector('.view-density-toggle__button[data-density="pro"]')?.classList.contains("is-active"),
      whitelistOpen: readOpen(cfg.whitelist),
    };
  }, { whitelist: WHITELIST });
  expect(afterProReload.density, "reload sonrası pro kalır").toBe("pro");
  expect(afterProReload.proActive, "Profesyonel aktif kalır").toBe(true);
  WHITELIST.forEach((sel) => {
    expect(afterProReload.whitelistOpen[sel], `reload: ${sel} açık başlar`).toBe(true);
  });

  // simple seç → reload
  await page.evaluate(() => document.querySelector('.view-density-toggle__button[data-density="simple"]')?.click());
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => { document.body.classList.remove("auth-required"); document.querySelector("#authGate")?.classList.add("is-hidden"); });
  await page.waitForTimeout(600);

  const afterSimpleReload = await page.evaluate((cfg) => {
    const readOpen = (sels) => { const r = {}; sels.forEach((s) => { const e = document.querySelector(s); r[s] = e ? e.open : null; }); return r; };
    return {
      density: window.BSMViewDensity?.get(),
      whitelistOpen: readOpen(cfg.whitelist),
    };
  }, { whitelist: WHITELIST });
  expect(afterSimpleReload.density, "reload sonrası simple kalır").toBe("simple");
  WHITELIST.forEach((sel) => {
    expect(afterSimpleReload.whitelistOpen[sel], `reload: ${sel} kapalı başlar`).toBe(false);
  });

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — manuel davranış: pro'da manuel kapatma, nav sonrası korunur
// ════════════════════════════════════════════════════════════════════════════
test("manuel davranış — pro'da manuel kapatma router nav'de ezilmez", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.waitForTimeout(400);

  await page.evaluate(() => document.querySelector('.view-density-toggle__button[data-density="pro"]')?.click());
  // alphabet açık mı
  const opened = await page.evaluate(() => document.querySelector(".library-alphabet-disclosure")?.open);
  expect(opened, "pro: alphabet açık").toBe(true);

  // kullanıcı manuel kapatır
  await page.evaluate(() => { const d = document.querySelector(".library-alphabet-disclosure"); if (d) d.open = false; });

  // başka ekrana git + geri dön
  await navigate(page, "dashboard");
  await navigate(page, "library");
  await page.waitForTimeout(300);

  const afterNav = await page.evaluate(() => ({
    alphabetOpen: document.querySelector(".library-alphabet-disclosure")?.open,
    density: window.BSMViewDensity?.get(),
  }));
  expect(afterNav.alphabetOpen, "nav sonrası manuel kapatma KORUNUR (re-apply yok)").toBe(false);
  expect(afterNav.density, "mod hâlâ pro").toBe("pro");

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — exclude list bütünlüğü (pro modda)
// ════════════════════════════════════════════════════════════════════════════
test("exclude list — aksiyon/curated/teknik details pro'da açılmaz", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.waitForTimeout(400);

  await page.evaluate(() => document.querySelector('.view-density-toggle__button[data-density="pro"]')?.click());

  const excl = await page.evaluate(() => {
    const openOf = (sel) => { const e = document.querySelector(sel); return e ? e.open : null; };
    const nutritionAccs = [...document.querySelectorAll(".bsm-nutrition-acc")].map((d) => ({
      acc: d.dataset.acc, open: d.open,
    }));
    return {
      builderMore: openOf(".builder-more-actions"),
      libraryManager: openOf(".library-manager"),
      segmental: [...document.querySelectorAll(".segmental-details")].map((d) => d.open),
      commandsStayDefault: openOf(".dashboard-disclosure--commands"),
      nutritionAccs,
    };
  });

  expect(excl.builderMore, "builder-more-actions kapalı").toBe(false);
  expect(excl.libraryManager, "library-manager kapalı").toBe(false);
  excl.segmental.forEach((o, i) => expect(o, `segmental-details[${i}] kapalı`).toBe(false));
  // dashboard commands zaten default açık (whitelist dışı, no-op)
  expect(excl.commandsStayDefault, "dashboard commands default açık (yönetilmiyor)").toBe(true);
  // nutrition accordion: curated default'lar korunur (goal/supplement açık, diğerleri kapalı — pro zorlamaz)
  const goal = excl.nutritionAccs.find((a) => a.acc === "goal");
  const macros = excl.nutritionAccs.find((a) => a.acc === "macros");
  if (goal) expect(goal.open, "nutrition goal curated default (açık) korunur").toBe(true);
  if (macros) expect(macros.open, "nutrition macros curated default (kapalı) korunur").toBe(false);

  assertNoErrors(errors);
});
