// 14-output-nutrition-content.spec.js — Nutrition output static notice baseline (4A.2 oncesi)
//
// ÖNEMLI BAGLAM — current behavior (4A.2 onceki kilitlenen davranis):
// ui/nutrition-ui.js:535 renderOutputNutritionPlan(target, plan, labelMaps, escapeHtml) PLAN
// parametresini ALDIGI HALDE KULLANMIYOR. Sabit bir "Beslenme planı uygulama içindeki
// Beslenme sekmesinde sunulmaktadır" notice'i basiyor. Bu KASITLI tasarim: Workout PDF
// yalnizca antrenman plani icerir; nutrition plani Beslenme sekmesinde gosterilir.
//
// Bu spec'in amaci: current notice davranisini 4A.2 (output domain extract) oncesi kilit
// altina almak. renderNutritionOutput ev sahibi app.js → output/outputRenderers.js'e
// tasinirken bu davranis korunmali. Eger biri yanlislikla plan-aware render eklerse VEYA
// notice'i silerse, bu spec yakalar.
//
// Plan icerigini (kalori/protein/oguenler) render etme davranisi YOK — talimattaki 4/5/6
// dogrulamalari current code'da uygulanamazdi. Bu spec mevcut davranisi baseline yapar.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

const NUTRITION_PLAN_SEED = Object.freeze({
  schemaVersion: 3,
  memberName: "Test Üye",
  goal: "balanced",
  nutritionGoalLabel: "Dengeli Beslenme",
  calories: 2200,
  macros: { protein: 165, carbs: 220, fat: 70 },
  meals: [
    {
      name: "Kahvaltı",
      time: "08:30",
      timingLabel: "Kahvaltı",
      scheduleRole: "meal",
      foods: "Yulaf, yumurta, ceviz",
      calories: 520,
      protein: 32,
      carbs: 55,
      fat: 18,
    },
    {
      name: "Öğle",
      time: "13:00",
      timingLabel: "Öğle",
      scheduleRole: "meal",
      foods: "Tavuk göğsü, bulgur pilavı, salata",
      calories: 680,
      protein: 52,
      carbs: 70,
      fat: 18,
    },
  ],
  supplements: [],
  trainerNote: "Regression test plani",
  createdAtIso: "2026-05-27T00:00:00.000Z",
});

test("Output nutrition block — static notice baseline (current behavior lock)", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Member + nutrition plan inject (DEFAULT_MEMBER'a nutritionPlan ekle)
  await page.evaluate(
    ({ member, plan }) => {
      const seededMember = { ...member, nutritionPlan: plan, nutritionPlans: [plan] };
      localStorage.setItem("formaplan-studio-members", JSON.stringify([seededMember]));
      localStorage.setItem("formaplan-studio-active-member-id", JSON.stringify(member.id));
    },
    { member: DEFAULT_MEMBER, plan: NUTRITION_PLAN_SEED },
  );

  // Reload — loadMembers + getNutritionPlanForOutput plan'i pick up etsin
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  await navigate(page, "output");
  await page.waitForTimeout(600);

  // ─── DOGRULAMALAR ───────────────────────────────────────────────
  const result = await page.evaluate(() => {
    const el = document.querySelector("#outputNutritionPlan");
    const rawHtml = el?.innerHTML || "";
    const textContent = (el?.textContent || "").trim();
    const lowered = textContent.toLowerCase();
    return {
      // 1. Container mount + non-empty
      exists: !!el,
      innerHtmlLength: rawHtml.length,
      textTrimmedLength: textContent.length,
      // 2. Static notice baseline icerik kontrolu
      hasBeslenmePlani: lowered.includes("beslenme planı"),
      hasBeslenmeSekmesi: lowered.includes("beslenme sekmesinde"),
      hasWorkoutPdfHint: lowered.includes("workout pdf"),
      // 3. Safety — undefined / NaN yok
      hasUndefined: /\bundefined\b/i.test(textContent),
      hasNaN: /\bnan\b/i.test(textContent),
      // 4. Debug — text snapshot (fail durumunda gorulebilsin)
      textPreview: textContent.slice(0, 200),
    };
  });

  // ─── 1. Container mount ─────────────────────────────────────────
  expect(result.exists, "#outputNutritionPlan DOM'da olmali").toBe(true);

  // ─── 2. innerHTML length > 0 ────────────────────────────────────
  expect(result.innerHtmlLength, "innerHTML doldurulmus olmali (notice render edildi)").toBeGreaterThan(0);
  expect(result.textTrimmedLength, "Text content doldurulmus olmali").toBeGreaterThan(0);

  // ─── 3. Notice basligi render oluyor (current behavior) ─────────
  expect(
    result.hasBeslenmePlani,
    `"Beslenme planı" notice basligi gorulmeli (preview: "${result.textPreview}")`,
  ).toBe(true);

  // ─── 4. Notice hint metni render oluyor (current behavior) ──────
  expect(
    result.hasBeslenmeSekmesi,
    `"Beslenme sekmesinde" hint metni gorulmeli (preview: "${result.textPreview}")`,
  ).toBe(true);

  // Workout PDF hint — current notice'in ikinci satiri
  expect(
    result.hasWorkoutPdfHint,
    `"Workout PDF" hint metni gorulmeli (preview: "${result.textPreview}")`,
  ).toBe(true);

  // ─── 5. Safety — undefined / NaN yok ────────────────────────────
  expect(result.hasUndefined, `outputNutritionPlan icinde "undefined" goruluyor (preview: "${result.textPreview}")`).toBe(false);
  expect(result.hasNaN, `outputNutritionPlan icinde "NaN" goruluyor (preview: "${result.textPreview}")`).toBe(false);

  // ─── 6. Console / page error yok ────────────────────────────────
  assertNoErrors(errors);
});
