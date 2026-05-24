// 10-nutrition-save.spec.js — save/print/persistence regression suite
// 3C refactor öncesi baseline; refactor sonrası birebir aynı pass etmeli.
// Doğrulanan akışlar:
//   1. Save butonu çalışıyor mu (state.activeNutritionPlan + member.nutritionPlan)
//   2. Nutrition state kaybolmuyor mu (form state save sonrası korunuyor)
//   3. Save sonrası preview aynı mı (livePreview totals = saved plan)
//   4. localStorage korunuyor mu (persistMembers yazdı mı)
//   5. PDF preview save sonrası bozulmuyor (2 sayfa, dolu, no P0K0Y0)
//   6. Print flow click → prepareNutritionPrintRoot + cleanup zinciri error-free
//   7. console/page error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("Nutrition save + print persistence — state ve preview kaybolmuyor", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "nutrition");

  // 1) Plan oluştur: generateNutritionButton click → state.activeNutritionPlan dolar
  await page.evaluate(() => {
    const btn = document.querySelector("#generateNutritionButton") || document.querySelector("#bsmNutritionGenerateButton");
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  const afterGenerate = await page.evaluate(() => {
    const snap = window.BSMTestApi?.getStateSnapshot?.();
    return {
      hasPlan: !!snap?.activeNutritionPlanId,
      calories: snap?.activeNutritionPlanCalories || 0,
      memberLs: localStorage.getItem("formaplan-studio-members"),
    };
  });
  expect(afterGenerate.hasPlan, "Plan oluştur sonrası activeNutritionPlanId set olmalı").toBe(true);
  expect(afterGenerate.calories, "Plan kalorisi > 0 olmalı").toBeGreaterThan(0);

  // Form state'i değiştir (calorie input) — save sonrası bu form değeri kaybolmamalı
  await page.evaluate(() => {
    const inp = document.querySelector("#nutritionCaloriesInput");
    if (inp) { inp.value = "2300"; inp.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await page.waitForTimeout(500);

  // Save öncesi livePreview kcal snapshot
  const beforeSave = await page.evaluate(() => ({
    kcalText: (document.querySelector("#bsmNutritionDailyCalories")?.textContent || "").trim(),
    timelineMealCount: document.querySelectorAll("#bsmNutritionTimeline > li").length,
    pdfPageCount: document.querySelectorAll("[data-pdf-page]").length,
  }));

  // 2) Save butonuna tıkla
  await page.evaluate(() => {
    const btn = document.querySelector("#saveNutritionButton");
    if (btn) btn.click();
  });
  await page.waitForTimeout(700);

  // 3) Save sonrası: state.activeNutritionPlan hala dolu, member.nutritionPlan yazılmış,
  //    localStorage update edilmiş.
  const afterSave = await page.evaluate(() => {
    const snap = window.BSMTestApi?.getStateSnapshot?.();
    const ls = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    const member = ls[0] || {};
    return {
      hasActivePlan: !!snap?.activeNutritionPlanId,
      activePlanCalories: snap?.activeNutritionPlanCalories || 0,
      memberHasPlan: !!member.nutritionPlan,
      memberPlanCalories: member.nutritionPlan?.calories || 0,
      memberPlansArrayLength: Array.isArray(member.nutritionPlans) ? member.nutritionPlans.length : 0,
      kcalText: (document.querySelector("#bsmNutritionDailyCalories")?.textContent || "").trim(),
      timelineMealCount: document.querySelectorAll("#bsmNutritionTimeline > li").length,
    };
  });

  // 1. Save butonu çalıştı: state hala aktif plan
  expect(afterSave.hasActivePlan, "Save sonrası activeNutritionPlan korunmalı").toBe(true);
  // Save handler member.nutritionPlan'a yazmalı
  expect(afterSave.memberHasPlan, "member.nutritionPlan dolmalı").toBe(true);
  // member.nutritionPlans (history) array'ine eklenmeli
  expect(afterSave.memberPlansArrayLength, "member.nutritionPlans tarihçesi ≥ 1").toBeGreaterThanOrEqual(1);
  // 4. localStorage update: kalori member üzerine yazıldı (persistMembers çalıştı)
  expect(afterSave.memberPlanCalories, "localStorage member.nutritionPlan.calories > 0").toBeGreaterThan(0);

  // 3. Save sonrası preview aynı — kcal text + meal count
  expect(afterSave.kcalText, "Save sonrası kcal preview kaybolmamalı").not.toBe("");
  expect(afterSave.kcalText, "kcal preview '—' (boş) olmamalı").not.toBe("—");
  expect(afterSave.timelineMealCount, "timeline meal count save sonrası > 0").toBe(beforeSave.timelineMealCount);

  // 2. Nutrition form state kaybolmuyor: kalori input hala 2300
  const formCalories = await page.evaluate(() => {
    const inp = document.querySelector("#nutritionCaloriesInput");
    return inp ? inp.value : null;
  });
  expect(formCalories, "Save sonrası form input.value korunmalı").toBe("2300");

  // 5. PDF preview save sonrası bozulmamış — 2 sayfa, kcal text, no P0K0Y0
  const pdfState = await page.evaluate(() => {
    const pages = document.querySelectorAll("[data-pdf-page]");
    const allText = [...pages].map((p) => p.textContent).join(" ").replace(/\s+/g, " ");
    return {
      pageCount: pages.length,
      page1Len: pages[0]?.innerHTML?.length || 0,
      page2Len: pages[1]?.innerHTML?.length || 0,
      hasP0K0Y0: /P\s*0\s*g.{0,5}K\s*0\s*g.{0,5}Y\s*0\s*g/i.test(allText),
      kcalMatch: allText.match(/(\d+)\s*kcal/),
    };
  });
  expect(pdfState.pageCount, "PDF 2 sayfa render edilmeli").toBe(2);
  expect(pdfState.page1Len, "PDF page1 dolu (>200 char)").toBeGreaterThan(200);
  expect(pdfState.page2Len, "PDF page2 dolu (>200 char)").toBeGreaterThan(200);
  expect(pdfState.hasP0K0Y0, "PDF'de P0 K0 Y0 olmamalı").toBe(false);
  expect(pdfState.kcalMatch && Number(pdfState.kcalMatch[1]), "PDF kcal numerik > 0").toBeGreaterThan(0);

  // 6. Print flow: button click → prepareNutritionPrintRoot çağrılır + cleanup zinciri
  //    headless modda window.print() no-op olabilir; biz state mutasyonunu doğrularız.
  await page.evaluate(() => {
    // print fonksiyonunu no-op'la (headless ortamda dialog'u engelle)
    window.print = function () { /* test mode no-op */ };
  });

  const printResult = await page.evaluate(async () => {
    const btn = document.querySelector("#printNutritionButton");
    if (!btn) return { ok: false, reason: "no print button" };
    btn.click();
    // Print Root prepare async (setTimeout 80ms); bekleyelim.
    await new Promise((r) => setTimeout(r, 200));
    const rootBeforeCleanup = document.querySelector("#nutritionPrintRoot");
    const isPrintingClass = document.body.classList.contains("is-printing-nutrition");
    // Cleanup setTimeout 1500ms — biraz bekleyip cleanup'ın olduğunu doğrula
    await new Promise((r) => setTimeout(r, 1700));
    return {
      ok: true,
      printRootCreated: !!rootBeforeCleanup,
      isPrintingClassDuring: isPrintingClass,
      printRootAfterCleanup: !!document.querySelector("#nutritionPrintRoot"),
      isPrintingClassAfter: document.body.classList.contains("is-printing-nutrition"),
    };
  });
  expect(printResult.ok, "Print butonu DOM'da var").toBe(true);
  expect(printResult.printRootCreated, "prepareNutritionPrintRoot çalıştı (dünyada #nutritionPrintRoot)").toBe(true);
  expect(printResult.printRootAfterCleanup, "cleanup sonrası #nutritionPrintRoot kaldırıldı").toBe(false);
  expect(printResult.isPrintingClassAfter, "cleanup sonrası body 'is-printing-nutrition' class temizlendi").toBe(false);

  // Print sonrası state hala dolu (state bozulmamış)
  const afterPrint = await page.evaluate(() => {
    const snap = window.BSMTestApi?.getStateSnapshot?.();
    return {
      stillHasPlan: !!snap?.activeNutritionPlanId,
      stillHasMealCount: document.querySelectorAll("#bsmNutritionTimeline > li").length,
    };
  });
  expect(afterPrint.stillHasPlan, "Print sonrası state.activeNutritionPlan korunmalı").toBe(true);
  expect(afterPrint.stillHasMealCount, "Print sonrası timeline meal sayısı korunmalı").toBe(beforeSave.timelineMealCount);

  // 7. Console / page / network error 0
  assertNoErrors(errors);
});
