// 32-rbac-enforcement.spec.js — BSM-AUTH-001 Faz 1: RBAC Characterization
// Mevcut RBAC davranışını OLDUĞU GİBİ test altına alır (characterization).
// Güvenlik sertleştirme DEĞİL — sadece auth/rbac.js + auth/auth.js'in mevcut
// client-side davranışını kilitler.
//
// HOOK'SUZ: window.BSMRbac (enforce/hasPermission/levelOf) + window.BSMAuth.getRole
// + bsm:auth:ready event dispatch + data-requires-role DOM görünürlüğü.
// Üretim koduna SIFIR dokunuş.
//
// NOT (önemli): settings noktalarının görünürlüğü için COMPUTED display DEĞİL,
// rbac.js'in yazdığı INLINE style.display kontrol edilir. Çünkü #settingsPanel
// ayrıca .screen-panel.is-hidden (router, display:none !important) ile gizlenir —
// settings ekranı aktif olmadığı sürece computed display her rolde "none" kalır.
// rbac.js enforce yalnızca inline style.display + aria-hidden yönetir:
//   allowed → el.style.display = "" + removeAttribute("aria-hidden")
//   denied  → el.style.display = "none" + setAttribute("aria-hidden","true")
// data-requires-role="admin" 3 noktada: sidebar item, mobil buton, #settingsPanel.

const { test, expect } = require("@playwright/test");
const { setupPage, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — API expose + saf fonksiyon matrisleri (DOM enforce gerekmez)
// ════════════════════════════════════════════════════════════════════════════
test("RBAC API expose + levelOf/hasPermission/getRole matrisleri", async ({ page }) => {
  const { errors } = await setupPage(page);

  // 1: window.BSMRbac + window.BSMAuth expose
  const api = await page.evaluate(() => ({
    rbac: typeof window.BSMRbac,
    enforce: typeof window.BSMRbac?.enforce,
    hasPermission: typeof window.BSMRbac?.hasPermission,
    levelOf: typeof window.BSMRbac?.levelOf,
    auth: typeof window.BSMAuth,
    getRole: typeof window.BSMAuth?.getRole,
  }));
  expect(api.rbac, "window.BSMRbac expose").toBe("object");
  expect(api.enforce, "BSMRbac.enforce fonksiyon").toBe("function");
  expect(api.hasPermission, "BSMRbac.hasPermission fonksiyon").toBe("function");
  expect(api.levelOf, "BSMRbac.levelOf fonksiyon").toBe("function");
  expect(api.auth, "window.BSMAuth expose").toBe("object");
  expect(api.getRole, "BSMAuth.getRole fonksiyon").toBe("function");

  // 2: levelOf matrisi (admin=2, coach=1, bilinmeyen/null/boş=0)
  const lvl = await page.evaluate(() => ({
    admin: window.BSMRbac.levelOf("admin"),
    coach: window.BSMRbac.levelOf("coach"),
    unknown: window.BSMRbac.levelOf("trainer"),
    nullv: window.BSMRbac.levelOf(null),
    empty: window.BSMRbac.levelOf(""),
  }));
  expect(lvl.admin, "levelOf(admin)=2").toBe(2);
  expect(lvl.coach, "levelOf(coach)=1").toBe(1);
  expect(lvl.unknown, "levelOf(trainer)=0").toBe(0);
  expect(lvl.nullv, "levelOf(null)=0").toBe(0);
  expect(lvl.empty, "levelOf('')=0").toBe(0);

  // 3: hasPermission matrisi
  const perm = await page.evaluate(() => ({
    aa: window.BSMRbac.hasPermission("admin", "admin"),
    ac: window.BSMRbac.hasPermission("admin", "coach"),
    cc: window.BSMRbac.hasPermission("coach", "coach"),
    ca: window.BSMRbac.hasPermission("coach", "admin"),
    ua: window.BSMRbac.hasPermission("trainer", "admin"),
  }));
  expect(perm.aa, "admin→admin true").toBe(true);
  expect(perm.ac, "admin→coach true").toBe(true);
  expect(perm.cc, "coach→coach true").toBe(true);
  expect(perm.ca, "coach→admin false").toBe(false);
  expect(perm.ua, "trainer→admin false").toBe(false);

  // 4: getRole davranışı
  const gr = await page.evaluate(() => ({
    nullUser: window.BSMAuth.getRole(null),
    noMeta: window.BSMAuth.getRole({ id: "u1" }),
    admin: window.BSMAuth.getRole({ user_metadata: { role: "admin" } }),
    coach: window.BSMAuth.getRole({ user_metadata: { role: "coach" } }),
  }));
  expect(gr.nullUser, "getRole(null)=null").toBeNull();
  expect(gr.noMeta, "getRole(metadata yok)=coach").toBe("coach");
  expect(gr.admin, "getRole(role=admin)=admin").toBe("admin");
  expect(gr.coach, "getRole(role=coach)=coach").toBe("coach");

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — enforce("coach") gizler / enforce("admin") gösterir (doğrudan çağrı)
// ════════════════════════════════════════════════════════════════════════════
test("enforce(coach) settings'i gizler, enforce(admin) gösterir", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Sözleşme: 3 data-requires-role="admin" noktası mevcut
  const count = await page.evaluate(
    () => document.querySelectorAll('[data-requires-role="admin"]').length
  );
  expect(count, "data-requires-role=admin 3 noktada (sidebar + mobil + panel)").toBe(3);

  // enforce("coach") → hepsi gizli (inline display=none + aria-hidden=true)
  const coach = await page.evaluate(() => {
    window.BSMRbac.enforce("coach");
    return Array.from(document.querySelectorAll('[data-requires-role="admin"]')).map((n) => ({
      id: n.id || n.className,
      inlineDisplay: n.style.display,
      ariaHidden: n.getAttribute("aria-hidden"),
    }));
  });
  coach.forEach((n) => {
    expect(n.inlineDisplay, `coach: ${n.id} inline display=none`).toBe("none");
    expect(n.ariaHidden, `coach: ${n.id} aria-hidden=true`).toBe("true");
  });

  // enforce("admin") → hepsi görünür (inline display none değil + aria-hidden yok)
  const admin = await page.evaluate(() => {
    window.BSMRbac.enforce("admin");
    return Array.from(document.querySelectorAll('[data-requires-role="admin"]')).map((n) => ({
      id: n.id || n.className,
      inlineDisplay: n.style.display,
      ariaHidden: n.getAttribute("aria-hidden"),
    }));
  });
  admin.forEach((n) => {
    expect(n.inlineDisplay, `admin: ${n.id} inline display none DEĞİL`).not.toBe("none");
    expect(n.ariaHidden, `admin: ${n.id} aria-hidden yok/false`).not.toBe("true");
  });

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — bsm:auth:ready event akışı (coach / admin / bypass)
// ════════════════════════════════════════════════════════════════════════════
test("bsm:auth:ready event: coach gizler, admin + bypass gösterir", async ({ page }) => {
  const { errors } = await setupPage(page);

  // {role:"coach"} → gizli
  const coach = await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { role: "coach" } }));
    return Array.from(document.querySelectorAll('[data-requires-role="admin"]')).map((n) => ({
      id: n.id || n.className,
      inlineDisplay: n.style.display,
      ariaHidden: n.getAttribute("aria-hidden"),
    }));
  });
  coach.forEach((n) => {
    expect(n.inlineDisplay, `event coach: ${n.id} display=none`).toBe("none");
    expect(n.ariaHidden, `event coach: ${n.id} aria-hidden=true`).toBe("true");
  });

  // {role:"admin"} → görünür
  const admin = await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { role: "admin" } }));
    return Array.from(document.querySelectorAll('[data-requires-role="admin"]')).map((n) => ({
      id: n.id || n.className,
      inlineDisplay: n.style.display,
      ariaHidden: n.getAttribute("aria-hidden"),
    }));
  });
  admin.forEach((n) => {
    expect(n.inlineDisplay, `event admin: ${n.id} display none DEĞİL`).not.toBe("none");
    expect(n.ariaHidden, `event admin: ${n.id} aria-hidden yok`).not.toBe("true");
  });

  // coach'a düşür, sonra {bypass:true} → admin gibi görünür
  const bypass = await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { role: "coach" } }));
    window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { bypass: true } }));
    return Array.from(document.querySelectorAll('[data-requires-role="admin"]')).map((n) => ({
      id: n.id || n.className,
      inlineDisplay: n.style.display,
      ariaHidden: n.getAttribute("aria-hidden"),
    }));
  });
  bypass.forEach((n) => {
    expect(n.inlineDisplay, `bypass: ${n.id} display none DEĞİL (admin gibi)`).not.toBe("none");
    expect(n.ariaHidden, `bypass: ${n.id} aria-hidden yok`).not.toBe("true");
  });

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — bilinmeyen rol (trainer) → settings gizli (level 0)
// ════════════════════════════════════════════════════════════════════════════
test("bilinmeyen rol (trainer) settings'i gizler", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Önce admin yap (görünür), sonra trainer ile gizlenmesini doğrula
  const trainer = await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { role: "admin" } }));
    window.dispatchEvent(new CustomEvent("bsm:auth:ready", { detail: { role: "trainer" } }));
    return Array.from(document.querySelectorAll('[data-requires-role="admin"]')).map((n) => ({
      id: n.id || n.className,
      inlineDisplay: n.style.display,
      ariaHidden: n.getAttribute("aria-hidden"),
    }));
  });
  trainer.forEach((n) => {
    expect(n.inlineDisplay, `trainer: ${n.id} display=none (level 0)`).toBe("none");
    expect(n.ariaHidden, `trainer: ${n.id} aria-hidden=true`).toBe("true");
  });

  assertNoErrors(errors);
});
