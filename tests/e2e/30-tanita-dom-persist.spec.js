// 30-tanita-dom-persist.spec.js — BSM-TANITA-004 Faz 3: DOM + Persist Coverage
// CSV → form → save → member.measurements → member.profile zinciri.
// HOOK'SUZ: gerçek DOM event (setInputFiles + change) + gerçek button click +
// localStorage doğrulaması. Üretim koduna SIFIR dokunuş.
//
// Senaryolar:
//   - Anonim Generic CSV → #tanitaCsvInput.setInputFiles → handleTanitaCsvSelected
//   - DOM doldurma: weight/fat/muscleMass/bmr + 5 segment kas
//   - Save → localStorage member.measurements[0] + member.profile
//   - v1.5.3: fatFreeMass tam zincir (form + measurement + profile)
//   - console/page/network error 0

const { test, expect } = require("@playwright/test");
const { setupPage, navigate, assertNoErrors } = require("./_helpers");

test.setTimeout(90000);

const MEMBERS_KEY = "formaplan-studio-members";
const ACTIVE_ID_KEY = "formaplan-studio-active-member-id";

// Anonim Generic CSV (BC-418 string YOK → Yol B). Kişisel veri YOK.
// v1.5.3: fat free mass kolonu eklendi (alias: services/tanita-csv-service.js:18).
const CSV_GENERIC = [
  "date,weight,body fat %,muscle mass,fat free mass,visceral fat,bmr,bmi,right arm muscle,left arm muscle,trunk muscle,right leg muscle,left leg muscle,right arm fat,left arm fat,trunk fat,right leg fat,left leg fat",
  "2026-01-01,72.0,24.0,30.0,52.0,7,1500,26.5,2.5,2.4,25.0,8.0,7.9,0.4,0.4,5.5,1.2,1.1",
].join("\n");

test("Tanita CSV → form → save → persist (DOM + localStorage, hook'suz)", async ({ page }) => {
  const { errors } = await setupPage(page);
  await navigate(page, "measurements");
  await page.waitForTimeout(500);

  // ─── 1-3: setInputFiles ile gerçek CSV upload (hidden input) ──────────
  const hasInput = await page.evaluate(() => !!document.querySelector("#tanitaCsvInput"));
  expect(hasInput, "#tanitaCsvInput DOM'da").toBe(true);

  await page.setInputFiles("#tanitaCsvInput", {
    name: "tanita-anonim.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV_GENERIC, "utf-8"),
  });

  // ─── 4: CSV import tamamlanmasını bekle (async readTanitaCsvFile) ─────
  // Form doldurma async; weight input dolana kadar bekle.
  await page.waitForFunction(() => {
    const w = document.querySelector("#measurementWeight");
    return w && String(w.value || "").trim() !== "";
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);

  // ─── 5: DOM doğrulamaları (ana alanlar) ───────────────────────────────
  const formValues = await page.evaluate(() => {
    const val = (sel) => (document.querySelector(sel)?.value || "").trim();
    return {
      weight: val("#measurementWeight"),
      fat: val("#measurementFat"),
      muscleMass: val("#measurementMuscleMass"),
      bmr: val("#measurementBmr"),
      bmi: val("#measurementBmi"),
      visceralFat: val("#measurementVisceralFat"),
    };
  });
  expect(formValues.weight, "#measurementWeight dolu").not.toBe("");
  expect(formValues.fat, "#measurementFat dolu").not.toBe("");
  expect(formValues.muscleMass, "#measurementMuscleMass dolu").not.toBe("");
  expect(formValues.bmr, "#measurementBmr dolu").not.toBe("");

  // ─── 6: Segment kas alanları (5) DOM'da dolu ──────────────────────────
  const segValues = await page.evaluate(() => {
    const val = (sel) => (document.querySelector(sel)?.value || "").trim();
    return {
      rightArmMuscle: val("#segmentRightArmMuscle"),
      leftArmMuscle: val("#segmentLeftArmMuscle"),
      trunkMuscle: val("#segmentTrunkMuscle"),
      rightLegMuscle: val("#segmentRightLegMuscle"),
      leftLegMuscle: val("#segmentLeftLegMuscle"),
    };
  });
  expect(segValues.rightArmMuscle, "segmentRightArmMuscle dolu").not.toBe("");
  expect(segValues.leftArmMuscle, "segmentLeftArmMuscle dolu").not.toBe("");
  expect(segValues.trunkMuscle, "segmentTrunkMuscle dolu").not.toBe("");
  expect(segValues.rightLegMuscle, "segmentRightLegMuscle dolu").not.toBe("");
  expect(segValues.leftLegMuscle, "segmentLeftLegMuscle dolu").not.toBe("");

  // ─── 7: Save butonu enabled ───────────────────────────────────────────
  const saveEnabled = await page.evaluate(() => {
    const btn = document.querySelector("#saveTanitaMeasurementButton");
    return btn ? !btn.disabled : false;
  });
  expect(saveEnabled, "#saveTanitaMeasurementButton enabled").toBe(true);

  // ─── 8: Save click ────────────────────────────────────────────────────
  await page.click("#saveTanitaMeasurementButton");
  await page.waitForTimeout(600);

  // ─── 9-13: localStorage persist doğrulama ─────────────────────────────
  const persisted = await page.evaluate((cfg) => {
    const members = JSON.parse(localStorage.getItem(cfg.membersKey) || "[]");
    const activeId = JSON.parse(localStorage.getItem(cfg.activeIdKey) || "null");
    const member = members.find((m) => String(m.id) === String(activeId)) || members[0] || null;
    const m0 = member?.measurements?.[0] || null;
    const profile = member?.profile || null;
    return {
      memberCount: members.length,
      measurementCount: member?.measurements?.length || 0,
      m0: m0 ? {
        weight: m0.weight, fat: m0.fat, muscleMass: m0.muscleMass, visceralFat: m0.visceralFat,
      } : null,
      profile: profile ? {
        weight: profile.weight, bmi: profile.bmi, visceralFat: profile.visceralFat,
        hasSegments: !!profile.segments,
        segRightArmMuscle: profile.segments?.rightArmMuscle,
        fatFreeMass: profile.fatFreeMass,  // bilinen sınır kilidi
      } : null,
    };
  }, { membersKey: MEMBERS_KEY, activeIdKey: ACTIVE_ID_KEY });

  // 10: measurements[0] oluştu
  expect(persisted.measurementCount, "Aktif üye measurements >= 1").toBeGreaterThanOrEqual(1);
  expect(persisted.m0, "measurements[0] kaydı var").not.toBeNull();
  // 11: measurements[0] ana alanlar dolu
  expect(persisted.m0.weight !== "" && persisted.m0.weight != null, `m0.weight dolu (gerçek: ${persisted.m0.weight})`).toBe(true);
  expect(persisted.m0.fat !== "" && persisted.m0.fat != null, `m0.fat dolu (gerçek: ${persisted.m0.fat})`).toBe(true);
  expect(persisted.m0.muscleMass !== "" && persisted.m0.muscleMass != null, `m0.muscleMass dolu (gerçek: ${persisted.m0.muscleMass})`).toBe(true);
  expect(persisted.m0.visceralFat !== "" && persisted.m0.visceralFat != null, `m0.visceralFat dolu (gerçek: ${persisted.m0.visceralFat})`).toBe(true);
  // 12: profile güncellendi
  expect(persisted.profile, "profile var").not.toBeNull();
  expect(persisted.profile.weight !== "" && persisted.profile.weight != null, `profile.weight güncel (gerçek: ${persisted.profile.weight})`).toBe(true);
  expect(persisted.profile.bmi !== "" && persisted.profile.bmi != null, `profile.bmi güncel (gerçek: ${persisted.profile.bmi})`).toBe(true);
  expect(persisted.profile.visceralFat !== "" && persisted.profile.visceralFat != null, `profile.visceralFat güncel (gerçek: ${persisted.profile.visceralFat})`).toBe(true);
  // 13: segment verileri profile'da
  expect(persisted.profile.hasSegments, "profile.segments mevcut").toBe(true);
  expect(persisted.profile.segRightArmMuscle != null && persisted.profile.segRightArmMuscle !== "",
    `profile.segments.rightArmMuscle dolu (gerçek: ${persisted.profile.segRightArmMuscle})`).toBe(true);

  // ─── 14: v1.5.3 fatFreeMass — #measurementFatFree formda VAR ──────────
  const fatFreeInput = await page.evaluate(() => ({
    exists: !!document.querySelector("#measurementFatFree"),
    value: (document.querySelector("#measurementFatFree")?.value || "").trim(),
  }));
  expect(fatFreeInput.exists, "#measurementFatFree input mevcut").toBe(true);
  expect(fatFreeInput.value, "#measurementFatFree dolu (CSV → form)").not.toBe("");

  // ─── 15: v1.5.3 fatFreeMass — profile.fatFreeMass dolu ────────────────
  expect(persisted.profile.fatFreeMass !== "" && persisted.profile.fatFreeMass != null,
    `profile.fatFreeMass dolu (gerçek: ${persisted.profile.fatFreeMass})`).toBe(true);

  // ─── 16-18: console / page / network error 0 ─────────────────────────
  assertNoErrors(errors);
});
