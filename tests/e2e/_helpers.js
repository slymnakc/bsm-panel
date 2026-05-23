// _helpers.js — ortak test setup/teardown
// Her spec bunu import eder. Hiç kod değiştirmiyor; sadece testler için
// uygulamayı tahmin edilebilir bir state'e getirir (member seed + auth bypass).

const DEFAULT_MEMBER = Object.freeze({
  id: "regression-test-member",
  schemaVersion: 3,
  profile: {
    memberName: "Test Üye",
    memberCode: "TEST-001",
    memberEmail: "test@bsm.local",
    trainerName: "Test Antrenör",
    goal: "muscle-gain",
    level: "intermediate",
    programStyle: "auto",
    trainingSystem: "standard",
    equipmentScope: "full-gym",
    duration: 60,
    priorityMuscle: "balanced",
    cardioPreference: "balanced",
    repetitionTemplate: {
      sets: 3,
      model: "pyramid",
      repPattern: ["12", "10", "8"],
      reps: "",
      rest: "60-90 sn",
      tempo: "2-0-2",
    },
    restrictions: [],
    days: ["monday", "wednesday", "friday"],
    notes: "Regression test notu",
  },
  measurements: [
    {
      id: "regression-measurement-1",
      date: "2026-05-12",
      weight: 78.2,
      fat: 17.9,
      muscleMass: 61.4,
      bmi: 22.8,
      visceralFat: 8,
      bmr: 1857,
      bodyWater: 58.4,
      source: "tanita",
    },
  ],
  programs: [],
  nutritionPlan: null,
  nutritionPlans: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-05-12T00:00:00.000Z",
});

/**
 * setupPage — her test'in başında çağrılır.
 * - localStorage member seed eder
 * - auth gate'i bypass eder
 * - console.error ve pageerror toplar (test sonunda assert için)
 *
 * Dönüş: { errors } — test bitiminde console/page error sayısını kontrol
 *                    edebilmek için.
 */
async function setupPage(page) {
  const errors = { console: [], page: [], network: [] };

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.console.push(msg.text());
  });
  page.on("pageerror", (err) => errors.page.push(err.message || String(err)));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (url.startsWith("http://localhost")) {
      errors.network.push(`${req.method()} ${url} :: ${req.failure()?.errorText}`);
    }
  });

  // CDP ile cache disabled — testler stale asset almasın
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  // 1. İlk yükleme — auth gate çıkacak
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // 2. localStorage'a test member seed + TEST MODE flag (Supabase sync disable)
  // NOT: activeMemberId JSON-encoded olmali — uygulama loadFromStorage ile
  // JSON.parse yapiyor. Raw string verirsek SyntaxError + null donus olur.
  await page.evaluate((member) => {
    localStorage.setItem("bsmTestMode", "true");
    localStorage.setItem("formaplan-studio-members", JSON.stringify([member]));
    localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
  }, DEFAULT_MEMBER);

  // Hata sayaçlarını temizle — reload öncesi auth render'ı sıfırla
  errors.console.length = 0;
  errors.page.length = 0;
  errors.network.length = 0;

  // 3. Reload — yeni member ile uygulama açılır
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 4. Auth gate'i kaldır (test ortamı için)
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    const gate = document.querySelector("#authGate");
    if (gate) gate.classList.add("is-hidden");
  });
  await page.waitForTimeout(300);

  return { errors };
}

/**
 * navigate — uygulamanın router'ı üzerinden ekran değiştirir.
 * BSMRouter.navigate(target, { silent: true }) çağırır.
 */
async function navigate(page, target) {
  await page.evaluate((t) => {
    if (window.BSMRouter && typeof window.BSMRouter.navigate === "function") {
      window.BSMRouter.navigate(t, { silent: true });
    }
  }, target);
  await page.waitForTimeout(800);
}

/**
 * assertNoErrors — test sonunda console/page/network hata 0 olmalı.
 * (Network 4xx/5xx 'localhost' filtresinde sayılır, dış kaynak ignore.)
 */
function assertNoErrors(errors, { allowNetwork = false } = {}) {
  const messages = [];
  if (errors.console.length) messages.push(`Console errors:\n  ${errors.console.join("\n  ")}`);
  if (errors.page.length) messages.push(`Page errors:\n  ${errors.page.join("\n  ")}`);
  if (!allowNetwork && errors.network.length) {
    messages.push(`Network errors:\n  ${errors.network.join("\n  ")}`);
  }
  if (messages.length) {
    throw new Error(messages.join("\n\n"));
  }
}

module.exports = {
  DEFAULT_MEMBER,
  setupPage,
  navigate,
  assertNoErrors,
};
