// 34-builder-actions.spec.js — BSM-UX-004c: Builder Buton Hiyerarşisi
// Üst aksiyon barında birincil aksiyonlar (Program Oluştur + Üyeyi Kaydet +
// formStatus) görünür; ikincil aksiyonlar (Örnek Üye, Son Kaydı Yükle, Yeni Üye)
// native <details class="builder-more-actions"> ("⋯ Diğer") altında, default kapalı.
//
// MEKANİK KİLİDİ: app.js:2709 (newMemberButton.click()) ve app.js:3013
// (loadSavedButton.click()) bu butonları PROGRAMATİK tıklar — kapalı details
// içindeyken de çalışmak zorunda. Test 3 bunu fillExampleButton ile kilitler.
//
// Üretim dokunuşu: yalnızca index.html (regrup) + styles.css. app.js/handlers
// değişmez; ID/class/handler korunur.

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(60000);

const SECONDARY_IDS = ["fillExampleButton", "loadSavedButton", "newMemberButton"];

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Yapı + görünürlük: birincil açık, ikincil details içinde gizli
// ════════════════════════════════════════════════════════════════════════════
test("Builder üst bar — birincil görünür, ikincil ⋯ Diğer altında kapalı", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "builder");
  await page.waitForTimeout(400);

  const struct = await page.evaluate((ids) => {
    const details = document.querySelector(".builder-more-actions");
    const createBtn = document.querySelector(".builder-top-actions .builder-create-button");
    const saveBtn = document.querySelector("#saveMemberButton");
    const status = document.querySelector("#formStatus");

    const secondary = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      secondary[id] = {
        mount: !!el,
        inside: !!(el && details && details.contains(el)),
        // checkVisibility: kapalı <details> içeriği modern Chrome'da
        // content-visibility ile gizlenir (display:none değil) —
        // offsetParent null dönmez, checkVisibility doğru sonuç verir.
        visible: !!(el && el.checkVisibility()),
      };
    });

    return {
      detailsExists: !!details,
      isDetails: details ? details.tagName.toLowerCase() === "details" : false,
      open: details ? details.open : null,
      summaryText: (details?.querySelector(":scope > summary")?.textContent || "").trim(),
      createVisible: !!(createBtn && createBtn.offsetParent !== null),
      createIsSubmit: createBtn?.getAttribute("type") === "submit" && createBtn?.getAttribute("form") === "plannerForm",
      saveVisible: !!(saveBtn && saveBtn.offsetParent !== null),
      statusMount: !!status,
      secondary,
    };
  }, SECONDARY_IDS);

  // Birincil aksiyonlar görünür
  expect(struct.createVisible, "Üye Programını Oluştur görünür").toBe(true);
  expect(struct.createIsSubmit, "submit butonu type=submit form=plannerForm korunur").toBe(true);
  expect(struct.saveVisible, "#saveMemberButton görünür").toBe(true);
  expect(struct.statusMount, "#formStatus DOM'da").toBe(true);

  // Details yapısı
  expect(struct.detailsExists, ".builder-more-actions DOM'da").toBe(true);
  expect(struct.isDetails, "builder-more-actions bir <details>").toBe(true);
  expect(struct.open, "details varsayılan KAPALI").toBe(false);
  expect(/Diğer/i.test(struct.summaryText),
    `summary "Diğer" içerir (gerçek: "${struct.summaryText}")`).toBe(true);

  // İkincil butonlar: mount + içeride + kapalıyken görünmez
  SECONDARY_IDS.forEach((id) => {
    expect(struct.secondary[id].mount, `#${id} DOM'da mount (ID korunur)`).toBe(true);
    expect(struct.secondary[id].inside, `#${id} details İÇİNDE`).toBe(true);
    expect(struct.secondary[id].visible, `#${id} kapalıyken GÖRÜNMEZ`).toBe(false);
  });

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Toggle: summary aç/kapa, ikincil butonlar erişilebilir
// ════════════════════════════════════════════════════════════════════════════
test("⋯ Diğer toggle — açılınca ikincil butonlar görünür", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "builder");
  await page.waitForTimeout(400);

  const afterOpen = await page.evaluate((ids) => {
    const details = document.querySelector(".builder-more-actions");
    details?.querySelector(":scope > summary")?.click();
    const vis = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      vis[id] = !!(el && el.checkVisibility());
    });
    return { open: details?.open, vis };
  }, SECONDARY_IDS);

  expect(afterOpen.open, "summary tık → details AÇIK").toBe(true);
  SECONDARY_IDS.forEach((id) => {
    expect(afterOpen.vis[id], `açıkken #${id} görünür/erişilebilir`).toBe(true);
  });

  const afterClose = await page.evaluate(() => {
    const details = document.querySelector(".builder-more-actions");
    details?.querySelector(":scope > summary")?.click();
    return details?.open;
  });
  expect(afterClose, "tekrar tık → details KAPALI").toBe(false);

  assertNoErrors(errors);
});

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — MEKANİK KİLİDİ: kapalı details içindeki butona programatik .click()
// ════════════════════════════════════════════════════════════════════════════
test("Kapalı details içinde programatik click çalışır (fillExample → form dolar)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "builder");
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const details = document.querySelector(".builder-more-actions");
    const btn = document.querySelector("#fillExampleButton");
    const before = (document.querySelector("#memberName")?.value || "").trim();
    // details KAPALIYKEN programatik click (app.js:2709/3013 deseni)
    btn?.click();
    const after = (document.querySelector("#memberName")?.value || "").trim();
    return { detailsOpen: details?.open, before, after };
  });

  expect(result.detailsOpen, "click öncesi details kapalıydı").toBe(false);
  expect(result.after, `programatik click sonrası #memberName dolu (gerçek: "${result.after}")`).not.toBe("");
  expect(result.after !== result.before || result.before !== "",
    "örnek üye verisi forma uygulandı").toBe(true);

  assertNoErrors(errors);
});
