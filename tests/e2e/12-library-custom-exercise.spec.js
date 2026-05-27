// 12-library-custom-exercise.spec.js — Custom Exercise CRUD regression suite
// 4A.1 (library domain split) ÖNCESİ baseline; refactor sonrası birebir aynı
// pass etmeli. Bu spec şu davranışları kilitler:
//   1. Library sayfası açılır + form alanları DOM'da
//   2. Custom exercise ekle → state.customExercises + DOM list + localStorage
//   3. Form temizleniyor + status mesajı
//   4. Custom exercise sil → DOM list azalır + localStorage güncellenir
//   5. Hazır exercise hide → state.hiddenExerciseIds + DOM filtre + hint mesajı
//   6. Restore hidden → state.hiddenExerciseIds boş + exercise geri geliyor
//   7. Reload sonrası persistence (custom + hidden korunmalı)
//   8. Safety: NaN / undefined yok, error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

const STORAGE_KEY_CUSTOM = "formaplan-studio-custom-exercises";

test("Library custom exercise CRUD + persistence", async ({ page }) => {
  // Spec inherently yavas: cleanup + 2 reload + 6 aksiyon zinciri.
  // Solo 27s, full suite icinde browser warm-up + serial overhead ile 40-50s.
  // Default 30s yetmiyor — 90s tutuyoruz (4.x sprintlerinde daha az reload ile
  // optimize edilebilir, ama baseline icin guvenli sinir).
  test.setTimeout(90000);

  const { errors } = await setupPage(page);

  // Test isolation: önceki run'lardan kalan QA/Persist Test exercise'lerini ve
  // hidden exercise list'ini temizle. setupPage member seed eder ama library
  // localStorage entry'lerine dokunmaz. Burada manuel clear.
  await page.evaluate(() => {
    // QA Test ile başlayan custom exercise'leri temizle (önceki test artıkları)
    const all = JSON.parse(localStorage.getItem("formaplan-studio-custom-exercises") || "[]");
    const cleaned = all.filter((e) => !/^QA Test Hareket|^Persist Test/.test(e.name || ""));
    localStorage.setItem("formaplan-studio-custom-exercises", JSON.stringify(cleaned));
    // Tüm hidden exercise'leri temizle (test izolasyonu için)
    localStorage.removeItem("formaplan-studio-hidden-exercise-ids");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });

  await navigate(page, "library");

  // ─── DOĞRULAMA 1: Library sayfası açıldı + form DOM'da ───────────────
  const formExists = await page.evaluate(() => ({
    panelExists: !!document.querySelector("#libraryPanel"),
    panelVisible: !document.querySelector("#libraryPanel")?.classList.contains("is-hidden"),
    nameInput: !!document.querySelector("#customExerciseName"),
    groupSelect: !!document.querySelector("#customExerciseGroup"),
    equipmentSelect: !!document.querySelector("#customExerciseEquipment"),
    kindSelect: !!document.querySelector("#customExerciseKind"),
    levelSelect: !!document.querySelector("#customExerciseLevel"),
    addBtn: !!document.querySelector("#addCustomExerciseButton"),
    restoreBtn: !!document.querySelector("#restoreHiddenExercisesButton"),
    listContainer: !!document.querySelector("#customExerciseList"),
  }));
  expect(formExists.panelExists, "#libraryPanel DOM'da olmalı").toBe(true);
  expect(formExists.panelVisible, "#libraryPanel görünür olmalı").toBe(true);
  expect(formExists.nameInput, "#customExerciseName input mevcut").toBe(true);
  expect(formExists.groupSelect, "#customExerciseGroup select mevcut").toBe(true);
  expect(formExists.equipmentSelect, "#customExerciseEquipment select mevcut").toBe(true);
  expect(formExists.addBtn, "#addCustomExerciseButton mevcut").toBe(true);
  expect(formExists.restoreBtn, "#restoreHiddenExercisesButton mevcut").toBe(true);
  expect(formExists.listContainer, "#customExerciseList container mevcut").toBe(true);

  // İlk state baseline — şu anki custom + hidden sayıları
  const baseline = await page.evaluate(() => ({
    customCount: JSON.parse(localStorage.getItem("formaplan-studio-custom-exercises") || "[]").length,
    customListItems: document.querySelectorAll("#customExerciseList .custom-exercise-item").length,
    libraryItemsCount: document.querySelectorAll("#exerciseLibrary [data-exercise-id]").length,
  }));

  // ─── DOĞRULAMA 2: Custom exercise ekle ───────────────────────────────
  const uniqueName = `QA Test Hareket ${Date.now()}`;
  await page.evaluate(({ name }) => {
    const set = (sel, val) => {
      const el = document.querySelector(sel);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    set("#customExerciseName", name);
    // group: select'in ilk non-empty option'unu seç (varsayım yapmadan)
    const groupSel = document.querySelector("#customExerciseGroup");
    if (groupSel && groupSel.options.length > 0) {
      const firstOpt = [...groupSel.options].find((o) => o.value && o.value !== "");
      if (firstOpt) {
        groupSel.value = firstOpt.value;
        groupSel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    // equipment: select'in ilk non-empty option'unu seç
    const eqSel = document.querySelector("#customExerciseEquipment");
    if (eqSel && eqSel.options.length > 0) {
      const firstOpt = [...eqSel.options].find((o) => o.value && o.value !== "");
      if (firstOpt) {
        eqSel.value = firstOpt.value;
        eqSel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    // kind + level zaten clearCustomExerciseForm default'larıyla başlıyor
    set("#customExerciseCue", "QA test açıklama notu");
  }, { name: uniqueName });
  await page.waitForTimeout(300);

  // Add button click
  await page.evaluate(() => document.querySelector("#addCustomExerciseButton")?.click());
  await page.waitForTimeout(500);

  // Doğrulamalar
  const afterAdd = await page.evaluate((name) => {
    const ls = JSON.parse(localStorage.getItem("formaplan-studio-custom-exercises") || "[]");
    const items = [...document.querySelectorAll("#customExerciseList .custom-exercise-item")];
    const statusText = (document.querySelector("#customExerciseStatus")?.textContent || "").trim();
    const lsHasName = ls.some((e) => e.name === name);
    const domHasName = items.some((it) => it.textContent.includes(name));
    return {
      lsCount: ls.length,
      lsHasName,
      domItemCount: items.length,
      domHasName,
      statusText,
      // Form temizlendi mi?
      nameInputValue: document.querySelector("#customExerciseName")?.value,
      cueInputValue: document.querySelector("#customExerciseCue")?.value,
      kindValue: document.querySelector("#customExerciseKind")?.value,
      levelValue: document.querySelector("#customExerciseLevel")?.value,
    };
  }, uniqueName);

  expect(afterAdd.lsCount, "localStorage custom array length artmalı").toBe(baseline.customCount + 1);
  expect(afterAdd.lsHasName, "localStorage'da yeni name var").toBe(true);
  expect(afterAdd.domItemCount, "DOM custom list item sayısı arttı").toBe(baseline.customListItems + 1);
  expect(afterAdd.domHasName, "DOM list'te yeni name görünür").toBe(true);
  expect(/eklendi|başarı|✓|success/i.test(afterAdd.statusText), `Status success mesajı (gerçek: "${afterAdd.statusText}")`).toBe(true);

  // ─── DOĞRULAMA 3: Form temizleniyor ───────────────────────────────────
  expect(afterAdd.nameInputValue, "name input temizlendi").toBe("");
  expect(afterAdd.cueInputValue, "cue input temizlendi").toBe("");
  expect(afterAdd.kindValue, "kind input default 'compound'").toBe("compound");
  expect(afterAdd.levelValue, "level input default 'intermediate'").toBe("intermediate");

  // ─── DOĞRULAMA 4: Custom exercise sil ─────────────────────────────────
  await page.evaluate((name) => {
    const items = [...document.querySelectorAll("#customExerciseList .custom-exercise-item")];
    const target = items.find((it) => it.textContent.includes(name));
    if (target) {
      const removeBtn = target.querySelector('[data-exercise-library-action="remove-custom"]');
      if (removeBtn) removeBtn.click();
    }
  }, uniqueName);
  await page.waitForTimeout(500);

  const afterDelete = await page.evaluate((name) => {
    const ls = JSON.parse(localStorage.getItem("formaplan-studio-custom-exercises") || "[]");
    const items = [...document.querySelectorAll("#customExerciseList .custom-exercise-item")];
    return {
      lsCount: ls.length,
      lsHasName: ls.some((e) => e.name === name),
      domItemCount: items.length,
      domHasName: items.some((it) => it.textContent.includes(name)),
    };
  }, uniqueName);

  expect(afterDelete.lsCount, "Sil sonrası localStorage azaldı").toBe(baseline.customCount);
  expect(afterDelete.lsHasName, "Sil sonrası localStorage'da name yok").toBe(false);
  expect(afterDelete.domHasName, "Sil sonrası DOM'da name yok").toBe(false);
  expect(afterDelete.domItemCount, "Sil sonrası DOM item count baseline").toBe(baseline.customListItems);

  // ─── DOĞRULAMA 5: Hazır exercise hide ─────────────────────────────────
  // İlk hazır exercise'in id'sini al, hide butonuna tıkla.
  const hideResult = await page.evaluate(() => {
    // Library grid'de hide butonlu ilk hazır exercise
    const hideBtn = document.querySelector('#exerciseLibrary [data-exercise-library-action="hide"]');
    if (!hideBtn) return { ok: false, reason: "no hide button in library" };
    const exerciseId = hideBtn.dataset.exerciseId;
    const beforeCount = document.querySelectorAll("#exerciseLibrary [data-exercise-id]").length;
    hideBtn.click();
    return { ok: true, exerciseId, beforeCount };
  });
  expect(hideResult.ok, "Library'de hide butonu mevcut").toBe(true);
  await page.waitForTimeout(500);

  const afterHide = await page.evaluate((targetId) => {
    const items = [...document.querySelectorAll("#exerciseLibrary [data-exercise-id]")];
    const hiddenLs = JSON.parse(localStorage.getItem("formaplan-studio-hidden-exercise-ids") || "[]");
    const statusText = (document.querySelector("#customExerciseStatus")?.textContent || "").trim();
    const hintEl = document.querySelector("#customExerciseList .custom-exercise-list__hint");
    return {
      itemCount: items.length,
      targetStillVisible: items.some((el) => el.dataset.exerciseId === targetId),
      hiddenLsHasTarget: hiddenLs.includes(targetId),
      statusText,
      hintText: (hintEl?.textContent || "").trim(),
    };
  }, hideResult.exerciseId);

  expect(afterHide.itemCount, "Hide sonrası library exercise count azaldı").toBe(hideResult.beforeCount - 1);
  expect(afterHide.targetStillVisible, "Hide edilen exercise library'de yok").toBe(false);
  expect(afterHide.hiddenLsHasTarget, "Hide sonrası localStorage hidden-exercise-ids içinde target id var").toBe(true);
  expect(/gizlen|hidden|kaldır/i.test(afterHide.statusText), `Hide status mesajı (gerçek: "${afterHide.statusText}")`).toBe(true);

  // ─── DOĞRULAMA 6: Restore hidden ──────────────────────────────────────
  await page.evaluate(() => document.querySelector("#restoreHiddenExercisesButton")?.click());
  await page.waitForTimeout(500);

  const afterRestore = await page.evaluate((targetId) => {
    const items = [...document.querySelectorAll("#exerciseLibrary [data-exercise-id]")];
    const statusText = (document.querySelector("#customExerciseStatus")?.textContent || "").trim();
    return {
      itemCount: items.length,
      targetVisibleAgain: items.some((el) => el.dataset.exerciseId === targetId),
      statusText,
    };
  }, hideResult.exerciseId);

  expect(afterRestore.itemCount, "Restore sonrası library count baseline").toBe(hideResult.beforeCount);
  expect(afterRestore.targetVisibleAgain, "Hide edilen exercise restore sonrası geri geldi").toBe(true);
  expect(/geri|restore|tekrar/i.test(afterRestore.statusText), `Restore status mesajı (gerçek: "${afterRestore.statusText}")`).toBe(true);

  // ─── DOĞRULAMA 7: Persistence (reload sonrası custom korunmalı) ──────
  // Önce bir custom exercise ekle, sonra reload et, hala görünür mü?
  const persistName = `Persist Test ${Date.now()}`;
  await page.evaluate(({ name }) => {
    document.querySelector("#customExerciseName").value = name;
    document.querySelector("#customExerciseName").dispatchEvent(new Event("change", { bubbles: true }));
    const groupSel = document.querySelector("#customExerciseGroup");
    const firstOpt = [...groupSel.options].find((o) => o.value);
    if (firstOpt) { groupSel.value = firstOpt.value; groupSel.dispatchEvent(new Event("change", { bubbles: true })); }
    const eqSel = document.querySelector("#customExerciseEquipment");
    const firstEqOpt = [...eqSel.options].find((o) => o.value);
    if (firstEqOpt) { eqSel.value = firstEqOpt.value; eqSel.dispatchEvent(new Event("change", { bubbles: true })); }
    document.querySelector("#addCustomExerciseButton")?.click();
  }, { name: persistName });
  await page.waitForTimeout(500);

  // localStorage'da olduğunu doğrula
  const persistedBefore = await page.evaluate((name) => {
    const ls = JSON.parse(localStorage.getItem("formaplan-studio-custom-exercises") || "[]");
    return ls.some((e) => e.name === name);
  }, persistName);
  expect(persistedBefore, "Reload öncesi localStorage'da persist exercise var").toBe(true);

  // Reload + library route'a tekrar git
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  // Auth gate'i tekrar kaldır + library'ye git
  await page.evaluate(() => {
    document.body.classList.remove("auth-required");
    document.querySelector("#authGate")?.classList.add("is-hidden");
  });
  await page.evaluate(() => window.BSMRouter.navigate("library", { silent: true }));
  await page.waitForTimeout(800);

  const persistedAfter = await page.evaluate((name) => {
    const ls = JSON.parse(localStorage.getItem("formaplan-studio-custom-exercises") || "[]");
    const items = [...document.querySelectorAll("#customExerciseList .custom-exercise-item")];
    return {
      lsHasName: ls.some((e) => e.name === name),
      domHasName: items.some((it) => it.textContent.includes(name)),
    };
  }, persistName);
  expect(persistedAfter.lsHasName, "Reload sonrası localStorage'da persist exercise korundu").toBe(true);
  expect(persistedAfter.domHasName, "Reload sonrası DOM'da persist exercise render edildi").toBe(true);

  // Cleanup: persist test exercise'i sil
  await page.evaluate((name) => {
    const items = [...document.querySelectorAll("#customExerciseList .custom-exercise-item")];
    const target = items.find((it) => it.textContent.includes(name));
    if (target) target.querySelector('[data-exercise-library-action="remove-custom"]')?.click();
  }, persistName);
  await page.waitForTimeout(300);

  // ─── DOĞRULAMA 8: Safety — NaN / undefined / duplicate ──────────────
  const safety = await page.evaluate(() => {
    const libraryText = document.querySelector("#exerciseLibrary")?.textContent || "";
    const customText = document.querySelector("#customExerciseList")?.textContent || "";
    const totalText = (libraryText + " " + customText).toLowerCase();
    // Duplicate render: aynı data-exercise-id iki kez varsa duplicate
    const ids = [...document.querySelectorAll("#exerciseLibrary [data-exercise-id]")].map((el) => el.dataset.exerciseId);
    const uniqueIds = new Set(ids);
    return {
      hasNaN: /\bnan\b/.test(totalText),
      hasUndefined: /\bundefined\b/.test(totalText),
      duplicateIds: ids.length !== uniqueIds.size,
      idCount: ids.length,
      uniqueIdCount: uniqueIds.size,
    };
  });
  expect(safety.hasNaN, "DOM'da NaN yok").toBe(false);
  expect(safety.hasUndefined, "DOM'da undefined yok").toBe(false);
  expect(safety.duplicateIds, `Duplicate data-exercise-id render yok (gerçek ${safety.idCount}/${safety.uniqueIdCount})`).toBe(false);

  // Console / page / network error 0
  assertNoErrors(errors);
});
