// 11-nutrition-generate.spec.js — generate flow regression suite
// 3E (engine adapter extract) ÖNCESİ baseline; refactor sonrası birebir aynı
// pass etmeli. Generate handler engine'i çağırır + state.activeNutritionPlan
// yazar. Bu spec şu akışları kilitler:
//   1. Plan oluştur → state.activeNutritionPlan dolar
//   2. Form değişiklikleri (kalori, meal count) plan'a yansır
//   3. Hero meta + meal timeline + PDF preview render olur
//   4. Duplicate click crash yapmaz, state tutarlı kalır
//   5. Generate sonrası save akışı çalışır (no race)
//   6. console/page/network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("Nutrition generate flow — plan create + form sync + render zinciri", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");

  // 1) Nutrition sayfası açıldı + aktif üye seçili
  const initial = await page.evaluate(() => {
    const panel = document.querySelector("#nutritionPanel");
    const snap = window.BSMTestApi?.getStateSnapshot?.();
    return {
      panelExists: !!panel,
      panelVisible: panel ? !panel.classList.contains("is-hidden") : false,
      activeMemberId: snap?.activeMemberId,
      hasActivePlan: !!snap?.activeNutritionPlanId,
    };
  });
  expect(initial.panelExists, "nutritionPanel DOM'da olmalı").toBe(true);
  expect(initial.panelVisible, "nutritionPanel görünür olmalı").toBe(true);
  expect(initial.activeMemberId, "test member seed edilmiş olmalı").toBe("regression-test-member");

  // 2) Günlük kalori = 2500 (input event → state.nutritionFormState.calories)
  await page.evaluate(() => {
    const inp = document.querySelector("#nutritionCaloriesInput");
    if (inp) { inp.value = "2500"; inp.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await page.waitForTimeout(500);

  // 3) Öğün sayısı = 5 (segment button click — handleClick via premiumHandlers)
  await page.evaluate(() => {
    const btn = document.querySelector('[data-nutrition-input="mealCount"] button[data-value="5"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);

  // Pre-generate snapshot
  const beforeGenerate = await page.evaluate(() => {
    const snap = window.BSMTestApi?.getStateSnapshot?.();
    return {
      mealCount: snap?.nutritionFormState?.mealCount,
      timelineLi: document.querySelectorAll("#bsmNutritionTimeline > li").length,
      heroDailyCalories: (document.querySelector("#bsmNutritionDailyCalories")?.textContent || "").trim(),
    };
  });
  // Form mealCount değişti
  expect(beforeGenerate.mealCount, "Form mealCount=5 olmalı").toBe(5);
  // Timeline livePreview ile 5 meal göstermeli (reactive)
  expect(beforeGenerate.timelineLi, "Timeline 5 meal render etmeli (reactive)").toBe(5);

  // 4) "Plan Oluştur" butonuna bas
  const generateClicked = await page.evaluate(() => {
    const btn = document.querySelector("#generateNutritionButton");
    if (!btn) return { ok: false, reason: "no generate btn" };
    btn.click();
    return { ok: true };
  });
  expect(generateClicked.ok, "generateNutritionButton DOM'da olmalı").toBe(true);
  await page.waitForTimeout(800);

  // ─── DOĞRULAMA 1: state.activeNutritionPlan oluştu mu ───────────────
  const afterGenerate = await page.evaluate(() => {
    const snap = window.BSMTestApi?.getStateSnapshot?.();
    return {
      activePlanId: snap?.activeNutritionPlanId,
      activePlanCalories: snap?.activeNutritionPlanCalories || 0,
      formCalories: document.querySelector("#nutritionCaloriesInput")?.value,
      formMealCount: snap?.nutritionFormState?.mealCount,
    };
  });
  expect(afterGenerate.activePlanId, "Generate sonrası state.activeNutritionPlan.id dolu").not.toBeNull();
  expect(afterGenerate.activePlanId, "activeNutritionPlanId boş string olmamalı").not.toBe("");
  expect(afterGenerate.activePlanCalories, "Plan.calories > 0").toBeGreaterThan(0);

  // ─── DOĞRULAMA 2: öğün sayısı form ile aynı ─────────────────────────
  const timelineCount = await page.evaluate(() => document.querySelectorAll("#bsmNutritionTimeline > li").length);
  expect(timelineCount, "Timeline meal count form.mealCount ile eşleşmeli").toBe(5);
  expect(afterGenerate.formMealCount, "Form mealCount 5 olarak korunmalı").toBe(5);

  // ─── DOĞRULAMA 3: preview panel dolu mu ─────────────────────────────
  const panelContent = await page.evaluate(() => {
    const panel = document.querySelector("#nutritionPanel");
    return panel ? panel.textContent.replace(/\s+/g, " ").trim().length : 0;
  });
  expect(panelContent, "nutritionPanel content > 500 char").toBeGreaterThan(500);

  // ─── DOĞRULAMA 4: hero macro değerleri boş değil ────────────────────
  const hero = await page.evaluate(() => ({
    daily: (document.querySelector("#bsmNutritionDailyCalories")?.textContent || "").trim(),
    macro: (document.querySelector("#bsmNutritionMacroSummary")?.textContent || "").trim(),
    memberName: (document.querySelector("#bsmNutritionMemberName")?.textContent || "").trim(),
  }));
  expect(hero.daily, "Hero #bsmNutritionDailyCalories boş olmamalı").not.toBe("");
  expect(hero.daily, "Hero kcal '—' olmamalı (livePreview 2500 user override)").not.toBe("—");
  expect(/\d+\s*kcal/i.test(hero.daily), `Hero kcal numerik içermeli (gerçek: "${hero.daily}")`).toBe(true);
  expect(hero.macro, "Hero macro summary boş olmamalı").not.toBe("");
  expect(hero.macro, "Hero macro '—' olmamalı").not.toBe("—");
  expect(hero.memberName, "Hero memberName 'Test Üye' olmalı").toBe("Test Üye");

  // ─── DOĞRULAMA 5: PDF preview render oluyor mu ──────────────────────
  const pdf = await page.evaluate(() => {
    const pages = document.querySelectorAll("[data-pdf-page]");
    const allText = [...pages].map((p) => p.textContent).join(" ").replace(/\s+/g, " ");
    return {
      count: pages.length,
      p1Len: pages[0]?.innerHTML?.length || 0,
      p2Len: pages[1]?.innerHTML?.length || 0,
      hasP0K0Y0: /P\s*0\s*g.{0,5}K\s*0\s*g.{0,5}Y\s*0\s*g/i.test(allText),
      kcalMatch: allText.match(/(\d+)\s*kcal/),
    };
  });
  expect(pdf.count, "PDF 2 sayfa render etmeli").toBe(2);
  expect(pdf.p1Len, "PDF page1 dolu (>200 char)").toBeGreaterThan(200);
  expect(pdf.p2Len, "PDF page2 dolu (>200 char)").toBeGreaterThan(200);
  expect(pdf.hasP0K0Y0, "PDF'de P0 K0 Y0 olmamalı").toBe(false);
  expect(pdf.kcalMatch && Number(pdf.kcalMatch[1]), "PDF kcal numerik > 0").toBeGreaterThan(0);

  // ─── DOĞRULAMA 6: meal timeline render oluyor mu ────────────────────
  const timelineState = await page.evaluate(() => {
    const meals = [...document.querySelectorAll("#bsmNutritionTimeline > li")];
    const stats = meals.map((li) => {
      const text = li.textContent || "";
      return {
        textLen: text.length,
        hasKcal: /\d+\s*kcal/i.test(text),
      };
    });
    return {
      count: meals.length,
      allHaveContent: stats.length > 0 && stats.every((s) => s.textLen > 20),
      allHaveKcal: stats.length > 0 && stats.every((s) => s.hasKcal),
    };
  });
  expect(timelineState.count, "Timeline 5 meal").toBe(5);
  expect(timelineState.allHaveContent, "Tüm meal kartlarında content var").toBe(true);
  expect(timelineState.allHaveKcal, "Tüm meal kartlarında kcal görünür").toBe(true);

  // ─── DOĞRULAMA 7: duplicate generate crash yapmıyor + state tutarlı ─
  // İlk plan id'yi sakla, ikinci click sonrası id değişebilir AMA state hala
  // tutarlı + plan var + timeline 5 meal + error yok.
  const firstPlanId = afterGenerate.activePlanId;
  await page.evaluate(() => {
    const btn = document.querySelector("#generateNutritionButton");
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);
  const afterDuplicate = await page.evaluate(() => {
    const snap = window.BSMTestApi?.getStateSnapshot?.();
    return {
      activePlanId: snap?.activeNutritionPlanId,
      planCalories: snap?.activeNutritionPlanCalories || 0,
      timelineCount: document.querySelectorAll("#bsmNutritionTimeline > li").length,
    };
  });
  expect(afterDuplicate.activePlanId, "Duplicate generate sonrası plan id hala dolu").not.toBeNull();
  expect(afterDuplicate.planCalories, "Duplicate generate sonrası plan.calories > 0").toBeGreaterThan(0);
  expect(afterDuplicate.timelineCount, "Duplicate generate sonrası timeline 5 meal kalmalı").toBe(5);
  // Plan id değişmiş olabilir (her generate yeni id atar) ama TUTARLILIK var
  // → state.activeNutritionPlan hala var, hata yok.

  // ─── DOĞRULAMA 8: generate sonrası save akışı bozulmuyor ────────────
  await page.evaluate(() => {
    const btn = document.querySelector("#saveNutritionButton");
    if (btn) btn.click();
  });
  await page.waitForTimeout(700);
  const afterSave = await page.evaluate(() => {
    const ls = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    const member = ls[0] || {};
    return {
      memberHasPlan: !!member.nutritionPlan,
      memberPlanCalories: member.nutritionPlan?.calories || 0,
      memberPlansCount: Array.isArray(member.nutritionPlans) ? member.nutritionPlans.length : 0,
    };
  });
  expect(afterSave.memberHasPlan, "Save sonrası member.nutritionPlan dolu").toBe(true);
  expect(afterSave.memberPlanCalories, "Save sonrası member plan.calories > 0").toBeGreaterThan(0);
  expect(afterSave.memberPlansCount, "Save sonrası history ≥ 1").toBeGreaterThanOrEqual(1);

  // ─── DOĞRULAMA 9: console/page/network error 0 ──────────────────────
  assertNoErrors(errors);
});
