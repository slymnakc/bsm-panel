// 21-periodization-wizard.spec.js — M1b.1 + BSM-UX-001 Periodization fieldset
// BSM-UX-001 (Seçenek B): Tam periyodizasyon paneli artık SADECE Adım 5'te görünür.
// Adım 2'de özet rozet gösterilir; Adım 1, 3, 4'te panel gizlidir.
// Veri katmanı / engine / output / PDF / macrocycle shape DEĞİŞMEZ — sadece wizard görünürlüğü.
//
// Kontroller:
//   1. Builder DOM: fieldset + tüm kontroller DOM'da mevcut (gizli olsa da)
//   2. GÖRÜNÜRLÜK (YENİ): Adım 1 panel gizli, Adım 2 rozet görünür, Adım 5 panel görünür
//   3. ROZET (YENİ): Adım 2 özet rozet metni totalWeeks + model içerir; "Düzenle" → Adım 5
//   4. Adım 5'te default değerler + preview render
//   5. Adım 5'te range slider değişimi → preview re-render
//   6. Adım 5'te deload chip → active + hidden value
//   7. Adım 5'te Linear ↔ Manual switch
//   8. Adım 5'te linear delta slider intensity
//   9. Adım 5'te final form values (macrocycle shape korunur)
//   10. ROZET SYNC (YENİ): Adım 5'te totalWeeks değişince Adım 2 rozet güncellenir
//   11. console/page/network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

// Wizard adımına git (step göstergesine tıkla → setBuilderWizardStep)
async function goToStep(page, n) {
  await page.evaluate((step) => {
    document.querySelector(`[data-builder-step-target="${step}"]`)?.click();
  }, n);
  await page.waitForTimeout(150);
}

// Bir elementin computed display değeri ("none" = gizli, "missing" = DOM'da yok)
async function getDisplay(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "missing";
    return window.getComputedStyle(el).display;
  }, selector);
}

test("Periodization wizard — Seçenek B görünürlük + form state + preview", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "builder");
  await page.waitForTimeout(500);

  // ─── DOĞRULAMA 1: Tüm kontroller DOM'da (gizli olsa da var) ──────────
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
    summaryBadge: !!document.querySelector("[data-period-summary]"),
    summaryEdit: !!document.querySelector("[data-period-summary-edit]"),
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
  expect(dom.summaryBadge, "[data-period-summary] rozet DOM'da (BSM-UX-001)").toBe(true);
  expect(dom.summaryEdit, "[data-period-summary-edit] 'Düzenle' butonu DOM'da").toBe(true);

  // ─── DOĞRULAMA 2: GÖRÜNÜRLÜK davranışı (BSM-UX-001) ──────────────────
  // navigate sonrası wizard Adım 1'de. Panel gizli, rozet henüz gizli (adım 2).
  await goToStep(page, 1);
  const step1 = await page.evaluate(() => ({
    panel: window.getComputedStyle(document.querySelector('[data-form-section="periodization"]')).display,
    bigPreview: window.getComputedStyle(document.querySelector('[data-form-section="big-preview"]')).display,
  }));
  expect(step1.panel, "Adım 1: tam panel gizli (display:none)").toBe("none");
  expect(step1.bigPreview, "Adım 1: büyük preview gizli").toBe("none");

  await goToStep(page, 2);
  const step2 = await page.evaluate(() => ({
    badge: window.getComputedStyle(document.querySelector('[data-period-summary]')).display,
    panel: window.getComputedStyle(document.querySelector('[data-form-section="periodization"]')).display,
  }));
  expect(step2.badge, "Adım 2: özet rozet görünür").not.toBe("none");
  expect(step2.panel, "Adım 2: tam panel gizli").toBe("none");

  await goToStep(page, 3);
  expect(await getDisplay(page, '[data-form-section="periodization"]'), "Adım 3: panel gizli").toBe("none");

  await goToStep(page, 4);
  expect(await getDisplay(page, '[data-form-section="periodization"]'), "Adım 4: panel gizli").toBe("none");

  await goToStep(page, 5);
  const step5 = await page.evaluate(() => ({
    panel: window.getComputedStyle(document.querySelector('[data-form-section="periodization"]')).display,
    bigPreview: window.getComputedStyle(document.querySelector('[data-form-section="big-preview"]')).display,
  }));
  expect(step5.panel, "Adım 5: tam panel GÖRÜNÜR").not.toBe("none");
  expect(step5.bigPreview, "Adım 5: büyük preview görünür").not.toBe("none");

  // ─── DOĞRULAMA 3: Rozet içeriği + "Düzenle" → Adım 5 ─────────────────
  await goToStep(page, 2);
  const badge = await page.evaluate(() => ({
    text: (document.querySelector("[data-period-summary]")?.textContent || "").trim(),
  }));
  expect(/8\s*hafta/i.test(badge.text), `Rozet "8 hafta" içerir (gerçek: "${badge.text}")`).toBe(true);
  expect(/linear/i.test(badge.text), `Rozet "Linear" içerir (gerçek: "${badge.text}")`).toBe(true);

  // "Düzenle" → Adım 5'e gider + panel görünür
  await page.evaluate(() => document.querySelector("[data-period-summary-edit]")?.click());
  await page.waitForTimeout(200);
  const afterEdit = await page.evaluate(() => ({
    step: document.querySelector("#plannerForm")?.dataset.builderWizardStep,
    panel: window.getComputedStyle(document.querySelector('[data-form-section="periodization"]')).display,
  }));
  expect(afterEdit.step, "Düzenle → wizard Adım 5'e geçer").toBe("5");
  expect(afterEdit.panel, "Düzenle sonrası panel görünür").not.toBe("none");

  // ─── DOĞRULAMA 4: Adım 5'te default değerler + preview ───────────────
  await goToStep(page, 5);
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
  expect(/^\d{4}-\d{2}-\d{2}$/.test(initial.startDateValue), `Start date format YYYY-MM-DD (gerçek: "${initial.startDateValue}")`).toBe(true);

  // ─── DOĞRULAMA 5: Range slider değişimi + preview re-render ──────────
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

  // ─── DOĞRULAMA 6: Deload chip click → active + hidden value ──────────
  await page.evaluate(() => {
    document.querySelector('[data-deload-value="3"]').click();
  });
  await page.waitForTimeout(200);
  const afterChip = await page.evaluate(() => ({
    hidden: document.querySelector("#periodDeloadCadenceValue").value,
    active: document.querySelector('[data-deload-value].is-active').dataset.deloadValue,
    deloadRows: document.querySelectorAll("#periodPreviewList .bsm-period-preview__row.is-deload").length,
  }));
  expect(afterChip.hidden, "Hidden value 3").toBe("3");
  expect(afterChip.active, "Active chip 3").toBe("3");
  expect(afterChip.deloadRows, "12 hafta + deload=3 → 4 deload satırı").toBe(4);

  // ─── DOĞRULAMA 7: Linear → Manual switch ─────────────────────────────
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

  // ─── DOĞRULAMA 8: Linear'a geri dön + delta slider değişimi ──────────
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
    week2Text: (document.querySelectorAll("#periodPreviewList .bsm-period-preview__row")[1]?.textContent || ""),
  }));
  expect(afterDelta.deltaVisible, "Linear delta slider görünür").toBe(true);
  expect(/%5\.0|5\.0%/.test(afterDelta.deltaOutput), `Delta output %5.0 (gerçek: "${afterDelta.deltaOutput}")`).toBe(true);
  expect(/1\.050/.test(afterDelta.week2Text), `Hafta 2 intensity 1.050 (delta=5.0, gerçek: "${afterDelta.week2Text}")`).toBe(true);

  // ─── DOĞRULAMA 9: Final form values (macrocycle shape korunur) ───────
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

  // ─── DOĞRULAMA 10: Rozet SYNC — Adım 5 değişimi Adım 2 rozete yansır ─
  // Yukarıda totalWeeks=12 yapıldı. Adım 2'ye dön → rozet "12 hafta" göstermeli.
  await goToStep(page, 2);
  const badgeSync = await page.evaluate(() => ({
    text: (document.querySelector("[data-period-summary]")?.textContent || "").trim(),
  }));
  expect(/12\s*hafta/i.test(badgeSync.text), `Rozet sync: "12 hafta" (gerçek: "${badgeSync.text}")`).toBe(true);

  // ─── DOĞRULAMA 11: console / page / network error 0 ──────────────────
  assertNoErrors(errors);
});
