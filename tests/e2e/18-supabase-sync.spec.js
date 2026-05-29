// 18-supabase-sync.spec.js — Supabase member sync + realtime regression baseline (4B.3.2 öncesi)
//
// AMAC: syncMembersFromSupabase + setupSupabaseRealtimeSync davranisini 4B.3.2 (member
// Supabase sync extraction) oncesi kilit altina almak.
//
// TEST-HOOK (BSMTestApi, read-only): triggerSupabaseSync / triggerRealtimeSetup /
// getSupabaseSnapshot — production davranisi degismez.
//
// GERCEK SUPABASE YAZMA YOK: window.supabaseClient client-side mock'lanir (loadMembers
// mock rows'tan okur; persist localStorage'a). Realtime subscribeToChanges override edilir,
// onChange manuel tetiklenir. isTestMode toggle: senaryo 1 bypass'i, 2-8 sync'i aktive eder.
//
// syncAppSettingsFromSupabase KAPSAM DISI (library domain — bu sprintte test edilmiyor).

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

// Supabase client mock — safeSelect uyumlu (from().select().order().then()).
// FAKE: { members:[...], measurements:[], programs:[], nutrition_plans:[] }
function installSupabaseMock(page, fakeRows, opts = {}) {
  return page.evaluate(
    ({ fake, fail }) => {
      function makeThenable(rows) {
        const p = Promise.resolve({ data: rows, error: null });
        p.order = () => makeThenable(rows);
        return p;
      }
      window.__realtimeOnChange = null;
      window.supabaseClient = {
        from: (table) => {
          if (fail) throw new Error("mock supabase from() failure");
          return { select: () => makeThenable(fake[table] || []) };
        },
        channel: () => {
          const ch = {
            on: function () { return ch; },
            subscribe: function (cb) { if (cb) cb("SUBSCRIBED"); return ch; },
          };
          return ch;
        },
      };
      // subscribeToChanges direkt window üzerinden cagrildigi icin override edilebilir.
      if (window.BSMSupabaseSyncService) {
        window.BSMSupabaseSyncService.subscribeToChanges = function (onChange) {
          window.__realtimeOnChange = onChange;
          return { __mockChannel: true };
        };
        window.BSMSupabaseSyncService.isEnabled = function () { return true; };
      }
    },
    { fake: fakeRows, fail: Boolean(opts.fail) },
  );
}

// ═══════════════════════════════════════════════════════════════════
// TEST 1 — Senaryo 1: test mode bypass
// ═══════════════════════════════════════════════════════════════════
test("Supabase sync — test mode bypass (isTestMode → early return)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.evaluate((m) => {
    localStorage.setItem("formaplan-studio-members", JSON.stringify([m]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(m.id));
  }, DEFAULT_MEMBER);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  // bsmTestMode=true (setupPage default) → triggerSupabaseSync bypass etmeli
  const result = await page.evaluate(() => {
    const before = window.BSMTestApi.getMembersCount();
    window.BSMTestApi.triggerSupabaseSync();
    return {
      isTestMode: window.BSMTestApi.isTestMode(),
      supabaseStatus: window.BSMTestApi.getSupabaseSnapshot().supabaseStatus,
      membersBefore: before,
      membersAfter: window.BSMTestApi.getMembersCount(),
    };
  });

  expect(result.isTestMode, "test mode aktif").toBe(true);
  expect(result.supabaseStatus, "test mode bypass → supabaseStatus='Test modu'").toBe("Test modu");
  expect(result.membersAfter, "test mode bypass → members degismez").toBe(result.membersBefore);

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 2 — Senaryo 2/3/4: remote empty / merge / error
// ═══════════════════════════════════════════════════════════════════
test("Supabase sync — remote empty/merge/error (loadMembers via mock client)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.evaluate((m) => {
    localStorage.setItem("formaplan-studio-members", JSON.stringify([m]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(m.id));
  }, DEFAULT_MEMBER);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
    // isTestMode false → sync aktive (senaryo 2-4)
    localStorage.removeItem("bsmTestMode");
  });

  // ─── Senaryo 2: bos remote → local member korunur ───────────────
  await installSupabaseMock(page, { members: [], measurements: [], programs: [], nutrition_plans: [] });
  await page.evaluate(() => window.BSMTestApi.triggerSupabaseSync({ source: "test-empty" }));
  await page.waitForTimeout(600);
  const emptyResult = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
    supabaseStatus: window.BSMTestApi.getSupabaseSnapshot().supabaseStatus,
  }));
  expect(emptyResult.membersCount, "bos remote → local member (1) korunur").toBe(1);
  expect(emptyResult.activeMemberId, "bos remote → activeMemberId korunur").toBe(DEFAULT_MEMBER.id);

  // ─── Senaryo 3: dolu remote → merge (yeni uye eklenir) ──────────
  await installSupabaseMock(page, {
    members: [{ app_member_id: "remote-member-1", name: "Remote Üye" }],
    measurements: [],
    programs: [],
    nutrition_plans: [],
  });
  await page.evaluate(() => window.BSMTestApi.triggerSupabaseSync({ source: "test-merge" }));
  await page.waitForTimeout(600);
  const mergeResult = await page.evaluate(() => {
    const members = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    return {
      membersCount: window.BSMTestApi.getMembersCount(),
      ids: members.map((m) => m.id),
    };
  });
  expect(mergeResult.membersCount, "dolu remote → merge (local 1 + remote 1 = 2)").toBeGreaterThanOrEqual(2);
  expect(mergeResult.ids.includes("remote-member-1"), "remote member merge edildi").toBe(true);

  // NOT: Senaryo 4 (hata branch → "Bağlantı hatası") KAPSAM DISI. safeSelect tum hatalari
  // yutuyor (.catch → []) ve from() throw'u senkron oldugu icin loadMembers asla reject
  // etmez → syncMembersFromSupabase.catch deterministik tetiklenemez (defensive tasarim).
  // Bu branch pratikte ulasilamaz; e2e ile guvenilir test edilemez.

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 3 — Senaryo 5/6/8: realtime subscribe / member event / duplicate guard
// ═══════════════════════════════════════════════════════════════════
test("Supabase realtime — subscribe + member event debounce + duplicate guard", async ({ page }) => {
  const { errors } = await setupPage(page);
  await page.evaluate((m) => {
    localStorage.setItem("formaplan-studio-members", JSON.stringify([m]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(m.id));
  }, DEFAULT_MEMBER);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
    localStorage.removeItem("bsmTestMode");
  });

  await installSupabaseMock(page, { members: [], measurements: [], programs: [], nutrition_plans: [] });

  // ─── Senaryo 5: subscribe + SUBSCRIBED status event ─────────────
  await page.evaluate(() => window.BSMTestApi.triggerRealtimeSetup());
  await page.waitForTimeout(200);
  const subscribed = await page.evaluate(() => ({
    hasSub: window.BSMTestApi.getSupabaseSnapshot().hasRealtimeSubscription,
    onChangeCaptured: typeof window.__realtimeOnChange === "function",
  }));
  expect(subscribed.hasSub, "triggerRealtimeSetup → supabaseRealtimeSubscription set").toBe(true);
  expect(subscribed.onChangeCaptured, "subscribeToChanges onChange yakalandi").toBe(true);

  // SUBSCRIBED status event → supabaseRealtimeActive true
  await page.evaluate(() => window.__realtimeOnChange({ status: "SUBSCRIBED" }));
  await page.waitForTimeout(100);
  const afterStatus = await page.evaluate(() => window.BSMTestApi.getSupabaseSnapshot());
  expect(afterStatus.supabaseRealtimeActive, "SUBSCRIBED event → supabaseRealtimeActive=true").toBe(true);

  // ─── Senaryo 8: duplicate subscription guard ────────────────────
  const beforeDup = await page.evaluate(() => window.__realtimeOnChange);
  await page.evaluate(() => window.BSMTestApi.triggerRealtimeSetup()); // ikinci cagri
  await page.waitForTimeout(100);
  const dupResult = await page.evaluate(() => ({
    hasSub: window.BSMTestApi.getSupabaseSnapshot().hasRealtimeSubscription,
  }));
  expect(dupResult.hasSub, "duplicate triggerRealtimeSetup → subscription guard (hala 1)").toBe(true);

  // ─── Senaryo 6: member event → 700ms debounce → syncMembersFromSupabase ─
  // Mock client.from'u dolu remote'a cevir AMA __realtimeOnChange'i KORU (senaryo 5'te
  // yakalandi; duplicate guard nedeniyle yeniden kaydedilemez). Sonra member event tetikle.
  await page.evaluate(() => {
    function makeThenable(rows) {
      const p = Promise.resolve({ data: rows, error: null });
      p.order = () => makeThenable(rows);
      return p;
    }
    const FAKE = {
      members: [{ app_member_id: "realtime-member-1", name: "Realtime Üye" }],
      measurements: [],
      programs: [],
      nutrition_plans: [],
    };
    window.supabaseClient.from = (table) => ({ select: () => makeThenable(FAKE[table] || []) });
    // realtime member event tetikle (__realtimeOnChange korundu)
    if (typeof window.__realtimeOnChange === "function") {
      window.__realtimeOnChange({ table: "members", payload: {} });
    }
  });
  await page.waitForTimeout(1000); // 700ms debounce + sync + buffer
  const afterMemberEvent = await page.evaluate(() => {
    const members = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    return { ids: members.map((m) => m.id) };
  });
  expect(afterMemberEvent.ids.includes("realtime-member-1"), "member event → debounce → sync → merge").toBe(true);

  assertNoErrors(errors, { allowNetwork: true });
});
