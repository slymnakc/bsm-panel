// 44-member-detail-content.spec.js — BUG-MEMBER-DETAIL-001
// Üyeler ekranında seçili üyenin KAYITLI içerikleri görünür olmalı:
//   - Program wizard adımı: son kayıtlı programın özeti (Set/Tekrar dahil) + CTA;
//     tıklayınca kullanıcı ÜYELER EKRANINDA KALIR (builder'a fırlatılmaz).
//   - Beslenme adımı: kayıtlı plan özeti (kcal/öğün/makro) + CTA.
//   - Ölçüm adımı davranışı korunur (metrik grid + geçmiş).
//   - Status "completed" iken generic yönlendirme placeholder'ı dönmesi FAIL'dir.
//   - Boş üyede oluşturma yönlendirmesi korunur, "Aç/Görüntüle" CTA'sı çıkmaz.
// (pdf/mail adımları bu işin kapsamı dışında — generic kalabilir.)

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(120000);

const GENERIC_RE = /sağ paneldeki/i;

const FULL_MEMBER = {
  id: "detail-full-1", schemaVersion: 3,
  profile: {
    memberName: "Dolu Üye", memberCode: "DOLU-1", trainerName: "Koç",
    goal: "muscle-gain", level: "intermediate", programStyle: "auto", trainingSystem: "standard",
    equipmentScope: "full-gym", duration: 60, priorityMuscle: "balanced", cardioPreference: "balanced",
    repetitionTemplate: { sets: 4, model: "pyramid", repPattern: ["12", "10", "8", "6"], reps: "", rest: "90 sn", tempo: "2-0-2" },
    restrictions: [], days: ["monday", "wednesday"], notes: "",
  },
  measurements: [{ id: "m1", date: "2026-07-01", weight: 83.5, fat: 19.5, muscleMass: 62.1, bmi: 25.8, source: "manual_entry" }],
  programs: [{
    id: "p1", savedAtIso: "2026-07-05T10:00:00.000Z", savedAt: "5 Temmuz 2026 13:00",
    program: {
      title: "Hipertrofi Programı", createdAtIso: "2026-07-05T09:59:00.000Z",
      sessions: [
        { dayLabel: "Pazartesi", title: "Göğüs + Arka Kol", duration: "60 dk", exercises: [
          { name: "Bench Press", groupLabel: "Göğüs", sets: 4, repPattern: ["12", "10", "8", "6"], rest: "90 sn", tempo: "2-0-2" },
          { name: "Incline Dumbbell Press", groupLabel: "Göğüs", sets: 3, repPattern: ["12", "10", "8"], rest: "60-90 sn", tempo: "2-0-2" },
        ] },
        { dayLabel: "Çarşamba", title: "Sırt + Ön Kol", duration: "60 dk", exercises: [
          { name: "Lat Pulldown", groupLabel: "Sırt", sets: 4, repPattern: ["12", "10", "8", "6"], rest: "90 sn", tempo: "2-0-2" },
        ] },
      ],
    },
  }],
  nutritionPlan: {
    id: "n1", createdAtIso: "2026-07-06T08:00:00.000Z", goal: "muscle-gain",
    calories: 2400, macros: { protein: 150, carbs: 250, fat: 80 },
    meals: [{ name: "Kahvaltı", calories: 600 }, { name: "Öğle", calories: 800 }, { name: "Akşam", calories: 700 }],
  },
  nutritionPlans: [],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-07-06T09:00:00.000Z",
};

const EMPTY_MEMBER = {
  ...FULL_MEMBER,
  id: "detail-empty-1",
  profile: { ...FULL_MEMBER.profile, memberName: "Boş Üye", memberCode: "BOS-1" },
  measurements: [], programs: [], nutritionPlan: null, nutritionPlans: [],
};

// seed'i verilen üyeyle değiştirir + reload + gate bypass + members ekranı
async function bootWithMember(page, errors, member) {
  await page.evaluate((m) => {
    localStorage.setItem("formaplan-studio-members", JSON.stringify([m]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(m.id));
  }, member);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });
  errors.console.length = 0; errors.page.length = 0; errors.network.length = 0;
  await navigate(page, "members");
}

async function clickStep(page, stepId) {
  await page.evaluate((s) => document.querySelector(`[data-wizard-step="${s}"]`)?.click(), stepId);
  await page.waitForTimeout(500);
}

const readWizard = (page) =>
  page.evaluate(() => ({
    screen: window.__bsm?.state?.activeScreen || "",
    membersVisible: !!document.querySelector("#membersPanel") && !document.querySelector("#membersPanel").classList.contains("is-hidden"),
    text: (document.querySelector("#bsmWizardContent")?.textContent || "").replace(/\s+/g, " ").trim(),
    hasCta: !!document.querySelector("#bsmWizardContent [data-wizard-cta]"),
  }));

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Program adımı: members'ta kalınır + kayıtlı program özeti görünür
// ════════════════════════════════════════════════════════════════════════════
test("Program adımı: üyeler ekranında kalınır, kayıtlı program özeti görünür", async ({ page }) => {
  const { errors } = await setupPage(page);
  await bootWithMember(page, errors, FULL_MEMBER);

  await clickStep(page, "program");
  const w = await readWizard(page);

  expect(w.screen, "aktif ekran members KALIR (builder'a fırlamaz)").toBe("members");
  expect(w.membersVisible, "#membersPanel görünür kalır").toBe(true);
  expect(/Hipertrofi Programı/.test(w.text), "program başlığı görünür").toBe(true);
  expect(/Set\/Tekrar|4 set x 12-10-8-6/.test(w.text), "Set/Tekrar bilgisi görünür").toBe(true);
  expect(/Bench Press/.test(w.text), "egzersiz satırı görünür").toBe(true);
  expect(GENERIC_RE.test(w.text), "statik 'sağ paneldeki buton' placeholder'ı YOK").toBe(false);
  expect(w.hasCta, "'Programı Aç' türü CTA var").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Beslenme adımı: members'ta kalınır + kayıtlı plan özeti görünür
// ════════════════════════════════════════════════════════════════════════════
test("Beslenme adımı: üyeler ekranında kalınır, plan özeti görünür", async ({ page }) => {
  const { errors } = await setupPage(page);
  await bootWithMember(page, errors, FULL_MEMBER);

  await clickStep(page, "beslenme");
  const w = await readWizard(page);

  expect(w.screen, "aktif ekran members KALIR").toBe("members");
  expect(/2400|2\.400/.test(w.text), "kcal görünür").toBe(true);
  expect(/3 öğün|öğün/i.test(w.text), "öğün bilgisi görünür").toBe(true);
  expect(/150/.test(w.text), "makro (protein) görünür").toBe(true);
  expect(GENERIC_RE.test(w.text), "statik yönlendirme placeholder'ı YOK").toBe(false);
  expect(w.hasCta, "'Beslenme Planını Aç' türü CTA var").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Ölçüm adımı regresyon: metrik grid + geçmiş korunur
// ════════════════════════════════════════════════════════════════════════════
test("Ölçüm adımı regresyon: metrik grid ve geçmiş görünmeye devam eder", async ({ page }) => {
  const { errors } = await setupPage(page);
  await bootWithMember(page, errors, FULL_MEMBER);

  await clickStep(page, "olcum");
  const r = await page.evaluate(() => ({
    metricCards: document.querySelectorAll("#bsmWizardContent .bsm-metric-card").length,
    text: (document.querySelector("#bsmWizardContent")?.textContent || ""),
  }));

  expect(r.metricCards, "metrik kartları render (>=6)").toBeGreaterThanOrEqual(6);
  expect(/83\.5|83,5/.test(r.text), "son ölçüm değeri görünür").toBe(true);
  expect(/Vücut Analiz Sonuçları/.test(r.text), "ölçüm başlığı korunur").toBe(true);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Status ↔ içerik tutarlılığı (program + beslenme)
// ════════════════════════════════════════════════════════════════════════════
test("Completed adımlarda generic placeholder dönmez (program+beslenme)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await bootWithMember(page, errors, FULL_MEMBER);

  for (const stepId of ["program", "beslenme"]) {
    const completed = await page.evaluate(
      (s) => (document.querySelector(`[data-wizard-step="${s}"]`)?.className || "").includes("is-completed") ||
             !!document.querySelector(`[data-wizard-step="${s}"] polyline`),
      stepId,
    );
    expect(completed, `${stepId} adımı completed işaretli`).toBe(true);

    await clickStep(page, stepId);
    const w = await readWizard(page);
    expect(GENERIC_RE.test(w.text), `${stepId}: completed iken generic placeholder DÖNMEZ`).toBe(false);
    expect(w.text.length, `${stepId}: anlamlı içerik var`).toBeGreaterThan(80);
    await navigate(page, "members");
  }

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — Boş üye: oluşturma yönlendirmesi korunur, "Aç" CTA'sı çıkmaz
// ════════════════════════════════════════════════════════════════════════════
test("Boş üyede oluşturma yönlendirmesi korunur, Görüntüle CTA'sı yok", async ({ page }) => {
  const { errors } = await setupPage(page);
  await bootWithMember(page, errors, EMPTY_MEMBER);

  for (const stepId of ["program", "beslenme"]) {
    await clickStep(page, stepId);
    // baseline'da tıklama başka ekrana götürebilir — içerik okumak için members'a dön
    await navigate(page, "members");
    const w = await readWizard(page);
    expect(/oluştur/i.test(w.text), `${stepId}: oluşturma yönlendirmesi var`).toBe(true);
    expect(w.hasCta, `${stepId}: boş üyede 'Aç' CTA'sı YOK`).toBe(false);
  }

  assertNoErrors(errors);
});
