// 43-save-persistence.spec.js — BSM-SAVE-AUDIT-001 / BUG-SAVE-001
// Üç kayıt akışının (program / ölçüm / beslenme) kalıcılığı + Supabase yazma
// payload sözleşmesi + SENKRON HATA BİLDİRİMİ:
//   - localStorage-first korunur: local kayıt her koşulda tamamlanır.
//   - Supabase upsert BAŞARISIZSA kullanıcıya AÇIK uyarı gösterilir
//     ("bulut senkronizasyonu başarısız" + oturum yenileme yönlendirmesi);
//     yalnız console.warn YETERLİ DEĞİLDİR.
//   - Supabase kapalıyken (test modu/offline) uyarı ÇIKMAZ (lokal mod normaldir).
//
// Supabase YAZMA yolu gerçek ağa çıkmaz: window.supabaseClient kaydetten hemen
// önce mock'lanır (18-spec okuma-mock deseninin yazma karşılığı).

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(120000);

const CLOUD_WARN_RE = /bulut senkronizasyonu başarısız/i;

// ── ortak yardımcılar ────────────────────────────────────────────────────────
async function armWriteMock(page, { failTable = "" } = {}) {
  await page.evaluate((failTable) => {
    window.__sbCalls = [];
    const result = (table) =>
      failTable && table === failTable
        ? { error: { message: "e2e simulated sync failure", code: "42501" } }
        : { error: null };
    window.supabaseClient = {
      from(table) {
        return {
          upsert(rows, opts) {
            window.__sbCalls.push({ table, op: "upsert", rows: JSON.parse(JSON.stringify(rows)), onConflict: opts?.onConflict });
            return Promise.resolve(result(table));
          },
          insert(rows) {
            window.__sbCalls.push({ table, op: "insert", rows: JSON.parse(JSON.stringify(rows)) });
            return Promise.resolve(result(table));
          },
          select() {
            const done = Promise.resolve({ data: [], error: null });
            return { order: () => done, then: (f, r) => done.then(f, r) };
          },
          delete() { return { eq: () => Promise.resolve({ error: null }) }; },
        };
      },
    };
  }, failTable);
}

async function generateProgram(page) {
  await navigate(page, "builder");
  await page.waitForTimeout(400);
  await page.evaluate(async () => {
    document.querySelector("#fillExampleButton")?.click();
    await new Promise((r) => setTimeout(r, 200));
    // aktif seed üyeyle eşleşsin — form adı aktif üyenin adı olmalı
    const name = document.querySelector("#memberName");
    if (name) name.value = "Test Üye";
    document.querySelector("#plannerForm")?.requestSubmit();
  });
  await page.waitForTimeout(900);
}

const readMembers = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]"));
const activeMember = (members) =>
  members.find((m) => m.profile?.memberName === "Test Üye") || members[0];
const readStatus = (page) =>
  page.evaluate(() => ({
    text: (document.querySelector("#formStatus")?.textContent || "").trim(),
    state: document.querySelector("#formStatus")?.dataset.state || "",
  }));

async function reloadAndBypass(page) {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Program kaydet → reload → üye geçmişinde KALICI (+ offline'da uyarı yok)
// ════════════════════════════════════════════════════════════════════════════
test("Program kaydet → reload → üyede kalıcı; Supabase kapalıyken uyarı yok", async ({ page }) => {
  const { errors } = await setupPage(page);
  await generateProgram(page);
  await page.evaluate(() => document.querySelector("#saveProgramButton")?.click());
  await page.waitForTimeout(800);

  const status = await readStatus(page);
  expect(/kaydedildi/i.test(status.text), `başarı mesajı görünür ("${status.text}")`).toBe(true);
  expect(CLOUD_WARN_RE.test(status.text), "Supabase KAPALIYKEN bulut uyarısı ÇIKMAZ (lokal mod)").toBe(false);

  let m = activeMember(await readMembers(page));
  expect((m?.programs || []).length, "member.programs'a eklendi").toBeGreaterThanOrEqual(1);

  await reloadAndBypass(page);
  m = activeMember(await readMembers(page));
  expect((m?.programs || []).length, "reload sonrası program KALICI").toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(m.programs[0].program || {}).length, "program payload'ı dolu").toBeGreaterThan(200);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Ölçüm kaydet → reload → ölçüm geçmişinde KALICI
// ════════════════════════════════════════════════════════════════════════════
test("Ölçüm kaydet → reload → üyede kalıcı", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "measurements");
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); } };
    set("measurementDate", "2026-07-07"); set("measurementHeight", 178); set("measurementWeight", 81.3);
    set("measurementFat", 18.7); set("measurementMuscleMass", 61.8); set("measurementBmi", 25.7);
  });
  await page.evaluate(() => document.querySelector("#saveMeasurementButton")?.click());
  await page.waitForTimeout(800);

  let m = activeMember(await readMembers(page));
  const countAfterSave = (m?.measurements || []).length;
  expect(countAfterSave, "member.measurements'a eklendi (seed 1 + yeni 1)").toBeGreaterThanOrEqual(2);

  await reloadAndBypass(page);
  m = activeMember(await readMembers(page));
  expect((m?.measurements || []).length, "reload sonrası ölçüm KALICI").toBe(countAfterSave);
  expect(m.measurements.some((x) => Number(x.weight) === 81.3), "yeni ölçüm değeri (81.3) kalıcı").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Beslenme kaydet → reload → üyede plan KALICI
// ════════════════════════════════════════════════════════════════════════════
test("Beslenme kaydet → reload → üyede kalıcı", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector("#saveNutritionButton")?.click());
  await page.waitForTimeout(1000);

  let m = activeMember(await readMembers(page));
  expect(!!m?.nutritionPlan, "member.nutritionPlan kaydedildi").toBe(true);
  expect((m?.nutritionPlans || []).length, "nutritionPlans geçmişine eklendi").toBeGreaterThanOrEqual(1);

  await reloadAndBypass(page);
  m = activeMember(await readMembers(page));
  expect(!!m?.nutritionPlan, "reload sonrası beslenme planı KALICI").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Supabase yazma sözleşmesi: 3 akışın payload + onConflict şeması
// ════════════════════════════════════════════════════════════════════════════
test("Supabase upsert payload sözleşmesi — members/programs/measurements/nutrition", async ({ page }) => {
  const { errors } = await setupPage(page);

  // program
  await generateProgram(page);
  await armWriteMock(page);
  await page.evaluate(() => document.querySelector("#saveProgramButton")?.click());
  await page.waitForTimeout(700);
  // ölçüm
  await navigate(page, "measurements");
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    set("measurementDate", "2026-07-07"); set("measurementWeight", 82.1); set("measurementHeight", 178);
    set("measurementFat", 19); set("measurementMuscleMass", 61); set("measurementBmi", 25.9);
  });
  await page.evaluate(() => document.querySelector("#saveMeasurementButton")?.click());
  await page.waitForTimeout(700);
  // beslenme
  await navigate(page, "nutrition");
  await page.evaluate(() => document.querySelector("#saveNutritionButton")?.click());
  await page.waitForTimeout(900);

  const calls = await page.evaluate(() => window.__sbCalls || []);
  const memberId = (activeMember(await readMembers(page)) || {}).id;
  const by = (t) => calls.filter((c) => c.table === t);

  const mem = by("members").find((c) => c.op === "upsert");
  expect(!!mem && mem.onConflict === "app_member_id", "members upsert (onConflict=app_member_id)").toBe(true);
  expect(mem.rows[0]?.app_member_id, "members satırı doğru app_member_id").toBe(memberId);

  const prog = by("programs").find((c) => c.op === "upsert");
  expect(!!prog && prog.onConflict === "app_program_id", "programs upsert (onConflict=app_program_id)").toBe(true);
  expect(prog.rows[0]?.member_id, "programs satırı doğru member_id").toBe(memberId);
  expect(JSON.stringify(prog.rows[0]?.program || {}).length, "programs.program payload dolu").toBeGreaterThan(200);

  const meas = by("measurements")[0];
  expect(!!meas && meas.onConflict === "app_measurement_id", "measurements upsert (onConflict=app_measurement_id)").toBe(true);
  expect(meas.rows[0]?.member_id, "measurements satırı doğru member_id").toBe(memberId);
  expect(meas.rows[0]?.weight, "measurements.weight doğru").toBe(82.1);

  const nut = by("nutrition_plans").find((c) => c.op === "upsert");
  expect(!!nut && nut.onConflict === "app_nutrition_id", "nutrition_plans upsert (onConflict=app_nutrition_id)").toBe(true);
  expect(nut.rows[0]?.member_id, "nutrition satırı doğru member_id").toBe(memberId);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — SENKRON HATASI: local kayıt tamam + KULLANICIYA AÇIK UYARI (BUG-SAVE-001)
// ════════════════════════════════════════════════════════════════════════════
test("Supabase upsert hatasında local kayıt tamam + kullanıcıya açık uyarı", async ({ page }) => {
  const { errors } = await setupPage(page);
  await generateProgram(page);
  await armWriteMock(page, { failTable: "members" }); // sync başarısız olacak
  await page.evaluate(() => document.querySelector("#saveProgramButton")?.click());
  await page.waitForTimeout(1200); // fire-and-forget sync sonucu gelsin

  // localStorage-first: local kayıt yine tamamlanmış olmalı
  const m = activeMember(await readMembers(page));
  expect((m?.programs || []).length, "local kayıt yine tamamlandı (localStorage-first)").toBeGreaterThanOrEqual(1);

  // KRİTİK: kullanıcıya açık uyarı — console.warn yeterli DEĞİL
  const status = await readStatus(page);
  expect(CLOUD_WARN_RE.test(status.text),
    `bulut senkron hatası kullanıcıya GÖSTERİLDİ (status="${status.text}")`).toBe(true);
  expect(/oturum/i.test(status.text), "uyarı oturum yenileme yönlendirmesi içerir").toBe(true);
  expect(status.state, "uyarı error görünümünde").toBe("error");

  // Dashboard/status alanında son senkron hatası görünür
  const supabaseStatus = await page.evaluate(() => window.__bsm?.state?.supabaseStatus || "");
  expect(/hata|başarısız/i.test(supabaseStatus), `state.supabaseStatus senkron hatasını yansıtır ("${supabaseStatus}")`).toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 6 — Başarılı sync'te normal başarı mesajı korunur, bulut uyarısı ÇIKMAZ
// ════════════════════════════════════════════════════════════════════════════
test("Başarılı Supabase sync'te başarı mesajı korunur, uyarı çıkmaz", async ({ page }) => {
  const { errors } = await setupPage(page);
  await generateProgram(page);
  await armWriteMock(page); // hepsi başarılı
  await page.evaluate(() => document.querySelector("#saveProgramButton")?.click());
  await page.waitForTimeout(1200);

  const status = await readStatus(page);
  expect(/kaydedildi/i.test(status.text), `normal başarı mesajı korunur ("${status.text}")`).toBe(true);
  expect(CLOUD_WARN_RE.test(status.text), "başarılı sync'te bulut uyarısı YOK").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 7 — BUG-SAVE-002 placeholder: aktif üye yokken sessiz yeni üye oluşturma
// ════════════════════════════════════════════════════════════════════════════
test.fixme(
  "BUG-SAVE-002: aktif üye yokken program kaydet, formdaki ada göre SESSİZCE yeni üye oluşturur — onay/uyarı eklenecek (ayrı iş)",
  async () => {
    // upsertMemberFromCurrentForm (app.js) aktif üye yoksa form profiline göre
    // yeni üye yaratır; koç yanlış üyeye kaydettiğini fark etmez. Bu davranış
    // BUG-SAVE-002 kapsamında onay/uyarı ile ele alınacak.
  },
);
