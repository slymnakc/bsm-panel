// 35-dashboard-progressive.spec.js — BSM-UX-004e: Dashboard Progressive Disclosure
// KPI + Focus + Quick action açık kalır; Koç Uyarıları+Görevler (command-grid)
// native <details> default AÇIK; Son Aktivite native <details> default KAPALI.
//
// Dashboard'ın İLK e2e coverage'ı. Üretim dokunuşu yalnızca index.html (statik
// <details> wrapper) + styles.css. app.js/render hedefleri/handler'lar değişmez.
//
// NOT: kapalı <details> içeriği modern Chrome'da content-visibility ile gizlenir
// (offsetParent null dönmez) → görünürlük checkVisibility() ile ölçülür.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Dashboard temel görünüm: KPI + Focus + Quick açık
// ════════════════════════════════════════════════════════════════════════════
test("Dashboard temel görünüm — KPI + Focus + Quick açık", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "dashboard");
  await page.waitForTimeout(400);

  const base = await page.evaluate(() => {
    const panel = document.getElementById("dashboardPanel");
    const kpiCards = document.querySelectorAll(".dashboard-kpi-strip .dashboard-card");
    const focus = document.getElementById("dashboardFocusPanel");
    const quick = document.getElementById("coachQuickPanel");
    return {
      panelVisible: !!(panel && !panel.classList.contains("is-hidden")),
      kpiCount: kpiCards.length,
      memberCountMount: !!document.getElementById("dashboardMemberCount"),
      focusVisible: !!(focus && focus.checkVisibility()),
      quickVisible: !!(quick && quick.checkVisibility()),
    };
  });

  expect(base.panelVisible, "dashboardPanel görünür").toBe(true);
  expect(base.kpiCount, "KPI kartı sayısı 4").toBe(4);
  expect(base.memberCountMount, "#dashboardMemberCount mount").toBe(true);
  expect(base.focusVisible, "#dashboardFocusPanel görünür (açık)").toBe(true);
  expect(base.quickVisible, "#coachQuickPanel görünür (açık)").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Koç Uyarıları + Görevler disclosure (default AÇIK)
// ════════════════════════════════════════════════════════════════════════════
test("Koç Uyarıları + Görevler — <details> default açık", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "dashboard");
  await page.waitForTimeout(400);

  const cmd = await page.evaluate(() => {
    const grid = document.querySelector(".dashboard-command-grid");
    const details = grid ? grid.closest("details.dashboard-disclosure--commands") : null;
    const alerts = document.getElementById("coachAlertsPanel");
    const tasks = document.getElementById("coachTaskPanel");
    return {
      detailsExists: !!details,
      isDetails: details ? details.tagName.toLowerCase() === "details" : false,
      open: details ? details.open : null,
      alertsMount: !!alerts,
      tasksMount: !!tasks,
      alertsInside: !!(alerts && details && details.contains(alerts)),
      tasksInside: !!(tasks && details && details.contains(tasks)),
    };
  });

  expect(cmd.detailsExists, "command-grid <details> wrapper var").toBe(true);
  expect(cmd.isDetails, "wrapper bir <details>").toBe(true);
  expect(cmd.open, "command-grid details default AÇIK").toBe(true);
  expect(cmd.alertsMount, "#coachAlertsPanel mount").toBe(true);
  expect(cmd.tasksMount, "#coachTaskPanel mount").toBe(true);
  expect(cmd.alertsInside, "#coachAlertsPanel details içinde").toBe(true);
  expect(cmd.tasksInside, "#coachTaskPanel details içinde").toBe(true);

  // toggle: kapat → aç
  const toggled = await page.evaluate(() => {
    const details = document.querySelector("details.dashboard-disclosure--commands");
    const summary = details ? details.querySelector(":scope > summary") : null;
    summary?.click();
    const afterClose = details ? details.open : null;
    summary?.click();
    const afterOpen = details ? details.open : null;
    const alerts = document.getElementById("coachAlertsPanel");
    return { afterClose, afterOpen, alertsAccessible: !!(alerts && details && details.open && details.contains(alerts)) };
  });
  expect(toggled.afterClose, "summary tık → kapandı").toBe(false);
  expect(toggled.afterOpen, "tekrar tık → açıldı").toBe(true);
  expect(toggled.alertsAccessible, "açıkken içerik erişilebilir").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Son Aktivite disclosure (default KAPALI)
// ════════════════════════════════════════════════════════════════════════════
test("Son Aktivite — <details> default kapalı + toggle", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "dashboard");
  await page.waitForTimeout(400);

  const act = await page.evaluate(() => {
    const activity = document.getElementById("dashboardActivity");
    const details = activity ? activity.closest("details.dashboard-disclosure--activity") : null;
    return {
      detailsExists: !!details,
      isDetails: details ? details.tagName.toLowerCase() === "details" : false,
      open: details ? details.open : null,
      activityInside: !!(activity && details && details.contains(activity)),
      closedNotVisible: !!(activity && !activity.checkVisibility()),
    };
  });

  expect(act.detailsExists, "Son Aktivite <details> wrapper var").toBe(true);
  expect(act.isDetails, "wrapper bir <details>").toBe(true);
  expect(act.open, "Son Aktivite details default KAPALI").toBe(false);
  expect(act.activityInside, "#dashboardActivity details içinde").toBe(true);
  expect(act.closedNotVisible, "kapalıyken #dashboardActivity görünmez").toBe(true);

  // toggle: aç → görünür → kapat
  const toggled = await page.evaluate(() => {
    const details = document.querySelector("details.dashboard-disclosure--activity");
    const summary = details ? details.querySelector(":scope > summary") : null;
    summary?.click();
    const openState = details ? details.open : null;
    const activity = document.getElementById("dashboardActivity");
    const visibleWhenOpen = !!(activity && activity.checkVisibility());
    summary?.click();
    const closedState = details ? details.open : null;
    return { openState, visibleWhenOpen, closedState };
  });
  expect(toggled.openState, "summary tık → açıldı").toBe(true);
  expect(toggled.visibleWhenOpen, "açıkken #dashboardActivity görünür").toBe(true);
  expect(toggled.closedState, "tekrar tık → kapandı").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — ID koruma: tüm render hedefleri mount
// ════════════════════════════════════════════════════════════════════════════
test("Render target ID'leri korunuyor (özellik kaybı yok)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "dashboard");
  await page.waitForTimeout(400);

  const ids = [
    "dashboardPanel",
    "dashboardFocusPanel",
    "coachQuickPanel",
    "coachAlertsPanel",
    "coachTaskPanel",
    "dashboardActivity",
    "dashboardMemberCount",
  ];
  const mount = await page.evaluate((list) => {
    const r = {};
    list.forEach((id) => { r[id] = !!document.getElementById(id); });
    return r;
  }, ids);

  ids.forEach((id) => {
    expect(mount[id], `#${id} DOM'da mount`).toBe(true);
  });

  assertNoErrors(errors);
});
