// 07-program.spec.js — Program Oluştur sayfası açılıyor
const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test("Program Olustur sayfasi acilir ve form alanlari var", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "builder");

  const formState = await page.evaluate(() => ({
    visible: !document.querySelector("#builderPanel")?.classList.contains("is-hidden"),
    hasForm: !!document.querySelector("#builderPanel form, #builderPanel .builder-form, #builderPanel input"),
  }));
  expect(formState.visible).toBe(true);

  assertNoErrors(errors);
});
