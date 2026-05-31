// 21-periodization-wizard.spec.js — M1b.1 Periodization fieldset regression
// Wizard'a eklenen yeni section'ı kilitler. Engine entegrasyonu YOK (M1b.2'de);
// bu spec sadece form state'i + UI davranışını doğrular.
//
// Kontroller:
//   1. Builder sayfası açılır + Periodization fieldset DOM'da
//   2. Range slider (4-12) + output sync
//   3. Linear ↔ Manual radio değişimi → linear delta slider show/hide + preview değişir
//   4. Deload chip click → active class + hidden input value
//   5. Linear delta slider (0.5-5.0) preview intensity hesabını etkiler
//   6. Mini preview DOM'da render edilir, doğru hafta sayısı + deload satırları
//   7. Büyük preview ("Önizleme ve Oluştur") DOM'da render edilir
//   8. Manual mode hint görünür + manuel açıklama metni doğru
//   9. Start date input mevcut + default değeri bugün (YYYY-MM-DD)
//   10. console/page/network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

test("Periodization wizard fieldset — form state + preview davranışı", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "builder");
  await page.waitForTimeout(500);

  // ─── DOĞRULAMA 1: Fieldset DOM'da ────────────────────────────────────
  const dom = await page.evaluate(() => ({
    fieldset: !!document.querySelector('[data-form-section="periodization"]'),
    totalRange: !!document.querySelector("#periodTotalWeeks"),
    totalOutput: !!document.querySelector("#periodTotalWeeksOutput"),
    linearRadio: !!document.querySelector('input[name="periodModel"][value="linear"]'),
    manualRadio: !!document.querySelector('input[name="periodModel"][value="manual"]'),
    linearDeltaRange: !!document.querySelector("#periodLinearDelta"),
    deloadChips: document.querySelectorAll('[data-deload-value]').length,
    deloadHidden: !!document.querySelector("#periodDeloadCadenceValue"),
    startDate: !!document.querySelector("#periodStartDate"),
    miniPreview: !!document.querySelector("#periodPreviewList"),
    bigPreview: !!document.querySelector("#bigPeriodPreviewList"),
    manualHint: !!document.querySelector("#periodManualHint"),
  }));
  expect(dom.fieldset, "Periodization fieldset DOM'da olmalı").toBe(true);
  expect(dom.totalRange, "#periodTotalWeeks range input mevcut").toBe(true);
  expect(dom.totalOutput, "#periodTotalWeeksOutput mevcut").toBe(true);
  expect(dom.linearRadio, "Linear radio mevcut").toBe(true);
  expect(dom.manualRadio, "Manual radio mevcut").toBe(true);
  expect(dom.linearDeltaRange, "#periodLinearDelta slider mevcut").toBe(true);
  expect(dom.deloadChips, "Deload chip sayısı 4 olmalı").toBe(4);
  expect(dom.deloadHidden, "Deload hidden input mevcut").toBe(true);
  expect(dom.startDate, "#periodStartDate mevcut").toBe(true);
  expect(dom.miniPreview, "#periodPreviewList mini liste mevcut").toBe(true);
  expect(dom.bigPreview, "#bigPeriodPreviewList büyük liste mevcut").toBe(true);

  // ─── DOĞRULAMA 2: Default values + initial render ────────────────────
  const initial = await page.evaluate(() => ({
    totalValue: document.querySelector("#periodTotalWeeks").value,
    totalOutputText: document.querySelector("#periodTotalWeeksOutput").textContent.trim(),
    linearChecked: document.querySelector('input[name="periodModel"][value="linear"]').checked,
    manualChecked: document.querySelector('input[name="periodModel"][value="manual"]').checked,
    deloadHiddenValue: document.querySelector("#periodDeloadCadenceValue").value,
    activeChip: document.querySelector('[data-deload-value].is-active')?.dataset.deloadValue,
    linearDeltaValue: document.querySelector("#periodLinearDelta").value,
    miniRowCount: document.querySelectorAll("#periodPreviewList .bsm-period-preview__row").length,
    bigRowCount: document.querySelectorAll("#bigPeriodPreviewList .bsm-period-preview__row").length,
    startDateValue: document.querySelector("#periodStartDate").value,
  }));
  expect(initial.totalValue, "Default totalWeeks=8").toBe("8");
  expect(initial.totalOutputText, "Output text 8").toBe("8");
  expect(initial.linearChecked, "Linear default checked").toBe(true);
  expect(initial.manualChecked, "Manual not checked").toBe(false);
  expect(initial.deloadHiddenValue, "Default deload=4").toBe("4");
  expect(initial.activeChip, "Active chip 4").toBe("4");
  expect(initial.linearDeltaValue, "Default linear delta=2.5").toBe("2.5");
  expect(initial.miniRowCount, "Mini preview 8 hafta").toBe(8);
  expect(initial.bigRowCount, "Big preview 8 hafta").toBe(8);
  // Start date default bugün (YYYY-MM-DD format)
  expect(/^\d{4}-\d{2}-\d{2}$/.test(initial.startDateValue), `Start date format YYYY-MM-DD (gerçek: "${initial.startDateValue}")`).toBe(true);

  // ─── DOĞRULAMA 3: Range slider değişimi + preview re-render ──────────
  await page.evaluate(() => {
    const inp = document.querySelector("#periodTotalWeeks");
    inp.value = "12";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const afterRange = await page.evaluate(() => ({
    output: document.querySelector("#periodTotalWeeksOutput").textContent.trim(),
    miniCount: document.querySelectorAll("#periodPreviewList .bsm-period-preview__row").length,
    bigCount: document.querySelectorAll("#bigPeriodPreviewList .bsm-period-preview__row").length,
  }));
  expect(afterRange.output, "Output 12'ye güncellenir").toBe("12");
  expect(afterRange.miniCount, "Mini preview 12 hafta").toBe(12);
  expect(afterRange.bigCount, "Big preview 12 hafta").toBe(12);

  // ─── DOĞRULAMA 4: Deload chip click → active + hidden value ──────────
  await page.evaluate(() => {
    document.querySelector('[data-deload-value="3"]').click();
  });
  await page.waitForTimeout(200);
  const afterChip = await page.evaluate(() => ({
    hidden: document.querySelector("#periodDeloadCadenceValue").value,
    active: document.querySelector('[data-deload-value].is-active').dataset.deloadValue,
    // Deload her 3 haftada: 12 hafta → hafta 3, 6, 9, 12 = 4 deload satırı
    deloadRows: document.querySelectorAll("#periodPreviewList .bsm-period-preview__row.is-deload").length,
  }));
  expect(afterChip.hidden, "Hidden value 3").toBe("3");
  expect(afterChip.active, "Active chip 3").toBe("3");
  expect(afterChip.deloadRows, "12 hafta + deload=3 → 4 deload satırı").toBe(4);

  // ─── DOĞRULAMA 5: Linear → Manual switch ─────────────────────────────
  await page.evaluate(() => {
    document.querySelector('input[name="periodModel"][value="manual"]').click();
  });
  await page.waitForTimeout(200);
  const afterManual = await page.evaluate(() => ({
    manualChecked: document.querySelector('input[name="periodModel"][value="manual"]').checked,
    deltaHidden: document.querySelector("#periodLinearDeltaWrap").hidden,
    manualHintHidden: document.querySelector("#periodManualHint").hidden,
    miniRowCount: document.querySelectorAll("#periodPreviewList .bsm-period-preview__row").length,
    manualText: (document.querySelector("#periodPreviewList .bsm-period-preview__manual")?.textContent || "").trim(),
  }));
  expect(afterManual.manualChecked, "Manual radio aktif").toBe(true);
  expect(afterManual.deltaHidden, "Linear delta slider gizli").toBe(true);
  expect(afterManual.manualHintHidden, "Manual hint görünür").toBe(false);
  expect(afterManual.miniRowCount, "Manual modda standart row sayısı 0").toBe(0);
  expect(/sistem.*kopya|otomatik kopya|clone/i.test(afterManual.manualText), `Manual açıklama metni var (gerçek: "${afterManual.manualText.slice(0, 80)}")`).toBe(true);

  // ─── DOĞRULAMA 6: Linear'a geri dön + delta slider değişimi ──────────
  await page.evaluate(() => {
    document.querySelector('input[name="periodModel"][value="linear"]').click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const inp = document.querySelector("#periodLinearDelta");
    inp.value = "5.0";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(200);
  const afterDelta = await page.evaluate(() => ({
    deltaOutput: document.querySelector("#periodLinearDeltaOutput").textContent.trim(),
    deltaVisible: !document.querySelector("#periodLinearDeltaWrap").hidden,
    // Hafta 2'nin intensity'si (linear 1.0 + delta/100, deload yoksa)
    // Hafta 1 = 1.000, Hafta 2 = 1.050 (delta=5.0 ile)
    week2Text: (document.querySelectorAll("#periodPreviewList .bsm-period-preview__row")[1]?.textContent || ""),
  }));
  expect(afterDelta.deltaVisible, "Linear delta slider görünür").toBe(true);
  expect(/%5\.0|5\.0%/.test(afterDelta.deltaOutput), `Delta output %5.0 (gerçek: "${afterDelta.deltaOutput}")`).toBe(true);
  expect(/1\.050/.test(afterDelta.week2Text), `Hafta 2 intensity 1.050 (delta=5.0, gerçek: "${afterDelta.week2Text}")`).toBe(true);

  // ─── DOĞRULAMA 7: collectFormData rawData.macrocycle doğru shape ──────
  // window.collectFormData global değil, ama submit handler aracılığıyla
  // dolaylı doğrularız. Burada direkt input values'ları doğrudan teyit ederiz.
  const finalForm = await page.evaluate(() => ({
    totalWeeks: Number(document.querySelector("#periodTotalWeeks").value),
    model: document.querySelector('input[name="periodModel"]:checked').value,
    deload: Number(document.querySelector("#periodDeloadCadenceValue").value),
    linearDelta: Number(document.querySelector("#periodLinearDelta").value),
    startDate: document.querySelector("#periodStartDate").value,
  }));
  expect(finalForm.totalWeeks, "Total weeks 12").toBe(12);
  expect(finalForm.model, "Model linear").toBe("linear");
  expect(finalForm.deload, "Deload 3").toBe(3);
  expect(finalForm.linearDelta, "Delta 5.0").toBe(5);
  expect(/^\d{4}-\d{2}-\d{2}$/.test(finalForm.startDate), "Start date hala dolu").toBe(true);

  // ─── DOĞRULAMA 8: console / page / network error 0 ───────────────────
  assertNoErrors(errors);
});
