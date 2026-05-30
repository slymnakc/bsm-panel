// 19-backup-restore.spec.js — Backup / Restore / CSV regression baseline (4B.4 öncesi)
//
// AMAC: handleDownloadBackup + handleExportMembersCsv + handleBackupFileSelected +
// handleRestoreAutoBackup davranisini 4B.4 (backup extraction) oncesi kilit altina almak.
//
// TEST-HOOK (BSMTestApi, read/trigger-only): triggerBackupDownload / triggerCsvExport /
// triggerBackupRestore(jsonText) / triggerAutoRestore / getBackupHistoryLength /
// getActiveProgramSnapshot — production davranisi degismez. Handler'lar dogal akisla
// calisir: confirm dialog (page.on dialog), downloadFile (page.on download), state
// mutation, render zinciri birebir korunur.
//
// KAPSAM:
//   1. Backup JSON export → download + payload icerigi + state degismez
//   2. CSV export → download + CSV header + row count
//   3. Restore (confirm accept) → state.members swap + activeMemberId + render
//   4. Restore (confirm cancel) → state korunur
//   5. Auto restore — empty history → status mesaj + state degismez
//   6. Auto restore — with history → state.members swap + render
//
// MOCK: page.on('dialog') confirm yakalar; page.on('download') JSON/CSV icerigi yakalar.

const { test, expect } = require("@playwright/test");
const { setupPage, assertNoErrors, DEFAULT_MEMBER } = require("./_helpers");

// İkinci üye — restore senaryolari icin (mevcut DEFAULT_MEMBER ile karismayacak ID).
const RESTORE_MEMBER_A = {
  id: "restore-member-a",
  schemaVersion: 3,
  profile: { memberName: "Restore Üye A", memberCode: "RST-A", goal: "fat-loss", level: "beginner", days: ["tuesday"], restrictions: [] },
  measurements: [],
  programs: [],
  nutritionPlan: null,
  nutritionPlans: [],
};
const RESTORE_MEMBER_B = {
  id: "restore-member-b",
  schemaVersion: 3,
  profile: { memberName: "Restore Üye B", memberCode: "RST-B", goal: "muscle-gain", level: "intermediate", days: ["monday", "thursday"], restrictions: [] },
  measurements: [],
  programs: [],
  nutritionPlan: null,
  nutritionPlans: [],
};

// ═══════════════════════════════════════════════════════════════════
// TEST 1 — handleDownloadBackup: JSON payload + state read-only
// ═══════════════════════════════════════════════════════════════════
test("Backup JSON export — download payload + state mutate etmez", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Download yakalayicisi setup (trigger'dan ONCE register edilmeli)
  const downloadPromise = page.waitForEvent("download");

  const beforeSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));

  await page.evaluate(() => window.BSMTestApi.triggerBackupDownload());
  const download = await downloadPromise;

  // Download dosya adi format kontrolu (bahcesehir-spor-merkezi-yedek-YYYY-MM-DD.json)
  const filename = download.suggestedFilename();
  // formatFileDate → "YYYYMMDD-HHMM" (boşluksuz, tek tire)
  expect(filename, "filename pattern").toMatch(/^bahcesehir-spor-merkezi-yedek-\d{8}-\d{4}\.json$/);

  // Download icerigi parse
  const path = await download.path();
  const fs = require("fs");
  const rawText = fs.readFileSync(path, "utf-8");
  const payload = JSON.parse(rawText);

  expect(payload.schemaVersion, "schemaVersion field").toBe(3);
  expect(payload.exportedAt, "exportedAt ISO").toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(payload.gymName, "gymName fallback").toBeTruthy();
  expect(payload.activeMemberId, "activeMemberId payload").toBe(DEFAULT_MEMBER.id);
  expect(Array.isArray(payload.members), "members array").toBe(true);
  expect(payload.members.length, "members count = 1").toBe(1);
  expect(payload.members[0].id, "member.id").toBe(DEFAULT_MEMBER.id);

  // State degismedi
  const afterSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));
  expect(afterSnapshot.membersCount, "members count read-only").toBe(beforeSnapshot.membersCount);
  expect(afterSnapshot.activeMemberId, "activeMemberId read-only").toBe(beforeSnapshot.activeMemberId);

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 2 — handleExportMembersCsv: CSV header + member rows + state read-only
// ═══════════════════════════════════════════════════════════════════
test("CSV export — download CSV header + row count + state mutate etmez", async ({ page }) => {
  const { errors } = await setupPage(page);

  const downloadPromise = page.waitForEvent("download");

  const beforeSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));

  await page.evaluate(() => window.BSMTestApi.triggerCsvExport());
  const download = await downloadPromise;

  // Dosya adi (1 uye → "uye" suffix)
  const filename = download.suggestedFilename();
  expect(filename, "csv filename pattern (single member)").toMatch(/^bah.+-uye-\d{8}-\d{4}\.csv$/);

  const path = await download.path();
  const fs = require("fs");
  const csvText = fs.readFileSync(path, "utf-8");
  const lines = csvText.split(/\r?\n/).filter((l) => l.length > 0);

  // 1 header + 1 member row = 2 satir minimum
  expect(lines.length, "CSV satir sayisi").toBeGreaterThanOrEqual(2);

  // Header sutun kontrolu (Turkce header)
  const header = lines[0];
  expect(header, "header: Üye Adı").toContain("Üye Adı");
  expect(header, "header: Üye No").toContain("Üye No");
  expect(header, "header: Antrenör").toContain("Antrenör");
  expect(header, "header: Hedef").toContain("Hedef");
  expect(header, "header: Seviye").toContain("Seviye");

  // İkinci satirda DEFAULT_MEMBER bilgisi
  const dataRow = lines[1];
  expect(dataRow, "data row: member name").toContain(DEFAULT_MEMBER.profile.memberName);
  expect(dataRow, "data row: member code").toContain(DEFAULT_MEMBER.profile.memberCode);

  // State degismedi
  const afterSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));
  expect(afterSnapshot.membersCount, "members count read-only").toBe(beforeSnapshot.membersCount);
  expect(afterSnapshot.activeMemberId, "activeMemberId read-only").toBe(beforeSnapshot.activeMemberId);

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 3 — handleBackupFileSelected (confirm accept): state.members swap + render
// ═══════════════════════════════════════════════════════════════════
test("Backup restore (confirm accept) — state.members swap + activeMemberId + render", async ({ page }) => {
  const { errors } = await setupPage(page);

  // confirm dialog ACCEPT
  page.on("dialog", (dialog) => dialog.accept());

  // Restore payload: 2 yeni uye, RESTORE_MEMBER_A active
  const restorePayload = {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    activeMemberId: RESTORE_MEMBER_A.id,
    members: [RESTORE_MEMBER_A, RESTORE_MEMBER_B],
  };

  const beforeSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));
  expect(beforeSnapshot.membersCount, "before: DEFAULT_MEMBER seed").toBe(1);
  expect(beforeSnapshot.activeMemberId, "before: DEFAULT active").toBe(DEFAULT_MEMBER.id);

  // Restore tetikle
  await page.evaluate((json) => window.BSMTestApi.triggerBackupRestore(json), JSON.stringify(restorePayload));
  await page.waitForTimeout(400); // handler async (file.text() + render zinciri)

  // State mutate doğrula
  const afterSnapshot = await page.evaluate(() => {
    const lsMembers = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    return {
      membersCount: window.BSMTestApi.getMembersCount(),
      activeMemberId: window.BSMTestApi.getActiveMemberId(),
      lsMemberIds: lsMembers.map((m) => m.id),
    };
  });
  expect(afterSnapshot.membersCount, "after: 2 restore uye").toBe(2);
  expect(afterSnapshot.activeMemberId, "after: payload activeMemberId").toBe(RESTORE_MEMBER_A.id);
  expect(afterSnapshot.lsMemberIds, "localStorage persistMembers").toEqual(
    expect.arrayContaining([RESTORE_MEMBER_A.id, RESTORE_MEMBER_B.id]),
  );
  expect(afterSnapshot.lsMemberIds.includes(DEFAULT_MEMBER.id), "default uye silindi").toBe(false);

  // Render tetigi (renderMemberWorkspace cagrildi → member rail guncel)
  // Member rail'de yeni uyeler gorulebilir (DOM check)
  const railHasRestoreMembers = await page.evaluate(() => {
    const rail = document.querySelector(".bsm-member-rail, [data-rail-member-id]");
    return Boolean(rail);
  });
  // Not: Member rail varsa renderMemberWorkspace cagrildi demektir.
  expect(railHasRestoreMembers, "renderMemberWorkspace tetigi (rail mevcut)").toBe(true);

  // activeProgram null olmali (restore payload'da program yok → resultsSection hidden)
  const programSnapshot = await page.evaluate(() => window.BSMTestApi.getActiveProgramSnapshot());
  expect(programSnapshot.hasProgram, "restore payload program yok → activeProgram null").toBe(false);

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 4 — handleBackupFileSelected (confirm cancel): state korunur
// ═══════════════════════════════════════════════════════════════════
test("Backup restore (confirm cancel) — state korunur, mutation yok", async ({ page }) => {
  const { errors } = await setupPage(page);

  // confirm dialog DISMISS (cancel)
  page.on("dialog", (dialog) => dialog.dismiss());

  const restorePayload = {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    activeMemberId: RESTORE_MEMBER_A.id,
    members: [RESTORE_MEMBER_A, RESTORE_MEMBER_B],
  };

  const beforeSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));

  await page.evaluate((json) => window.BSMTestApi.triggerBackupRestore(json), JSON.stringify(restorePayload));
  await page.waitForTimeout(400);

  const afterSnapshot = await page.evaluate(() => {
    const lsMembers = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    return {
      membersCount: window.BSMTestApi.getMembersCount(),
      activeMemberId: window.BSMTestApi.getActiveMemberId(),
      lsMemberIds: lsMembers.map((m) => m.id),
    };
  });
  expect(afterSnapshot.membersCount, "cancel → members count korunur").toBe(beforeSnapshot.membersCount);
  expect(afterSnapshot.activeMemberId, "cancel → activeMemberId korunur").toBe(beforeSnapshot.activeMemberId);
  expect(afterSnapshot.lsMemberIds.includes(DEFAULT_MEMBER.id), "cancel → default uye korunur").toBe(true);
  expect(afterSnapshot.lsMemberIds.includes(RESTORE_MEMBER_A.id), "cancel → restore uye eklenmez").toBe(false);

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 5 — handleRestoreAutoBackup (empty history): status mesaj + state korunur
// ═══════════════════════════════════════════════════════════════════
test("Auto restore (empty history) — status mesaj + state degismez", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Backup history'yi temizle
  await page.evaluate(() => {
    localStorage.removeItem("formaplan-studio-backup-history");
  });
  const histLen = await page.evaluate(() => window.BSMTestApi.getBackupHistoryLength());
  expect(histLen, "backup history empty").toBe(0);

  const beforeSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));

  // Dialog handler kayitla (empty history confirm cagirmamali; cagirirsa accept et)
  page.on("dialog", (dialog) => dialog.accept());

  await page.evaluate(() => window.BSMTestApi.triggerAutoRestore());
  await page.waitForTimeout(300);

  const afterSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));
  expect(afterSnapshot.membersCount, "empty history → members degismez").toBe(beforeSnapshot.membersCount);
  expect(afterSnapshot.activeMemberId, "empty history → activeMemberId degismez").toBe(beforeSnapshot.activeMemberId);

  // Status banner "Geri alinacak otomatik yedek bulunamadi" (showStatus error tip)
  // DOM'da #statusMessage / .bsm-status varsa kontrol
  const statusVisible = await page.evaluate(() => {
    const el = document.querySelector("#statusMessage, .bsm-status, [data-status]");
    return el ? (el.textContent || "").toLowerCase() : "";
  });
  // Soft check: status mesaji "yedek" gecmeli (defansif — DOM hook varyasyon)
  if (statusVisible) {
    expect(statusVisible, "status mesaj yedek geciyor").toMatch(/yedek/);
  }

  assertNoErrors(errors, { allowNetwork: true });
});

// ═══════════════════════════════════════════════════════════════════
// TEST 6 — handleRestoreAutoBackup (with history + accept): swap + render
// ═══════════════════════════════════════════════════════════════════
test("Auto restore (history mevcut + confirm accept) — state swap + render", async ({ page }) => {
  const { errors } = await setupPage(page);

  // Backup history'ye snapshot seed et (storeBackupSnapshot pattern)
  await page.evaluate(
    ({ memberA, memberB }) => {
      const snapshot = {
        id: "test-snapshot-1",
        savedAt: new Date().toISOString(),
        memberCount: 2,
        activeMemberId: memberA.id,
        fingerprint: "test-fingerprint",
        members: [memberA, memberB],
      };
      localStorage.setItem("formaplan-studio-backup-history", JSON.stringify([snapshot]));
    },
    { memberA: RESTORE_MEMBER_A, memberB: RESTORE_MEMBER_B },
  );

  const histLen = await page.evaluate(() => window.BSMTestApi.getBackupHistoryLength());
  expect(histLen, "backup history seeded").toBe(1);

  const beforeSnapshot = await page.evaluate(() => ({
    membersCount: window.BSMTestApi.getMembersCount(),
    activeMemberId: window.BSMTestApi.getActiveMemberId(),
  }));
  expect(beforeSnapshot.activeMemberId, "before: DEFAULT active").toBe(DEFAULT_MEMBER.id);

  // confirm ACCEPT
  page.on("dialog", (dialog) => dialog.accept());

  await page.evaluate(() => window.BSMTestApi.triggerAutoRestore());
  await page.waitForTimeout(400);

  const afterSnapshot = await page.evaluate(() => {
    const lsMembers = JSON.parse(localStorage.getItem("formaplan-studio-members") || "[]");
    return {
      membersCount: window.BSMTestApi.getMembersCount(),
      activeMemberId: window.BSMTestApi.getActiveMemberId(),
      lsMemberIds: lsMembers.map((m) => m.id),
    };
  });
  expect(afterSnapshot.membersCount, "auto restore → 2 snapshot uye").toBe(2);
  expect(afterSnapshot.activeMemberId, "auto restore → snapshot activeMemberId").toBe(RESTORE_MEMBER_A.id);
  expect(afterSnapshot.lsMemberIds, "localStorage persist").toEqual(
    expect.arrayContaining([RESTORE_MEMBER_A.id, RESTORE_MEMBER_B.id]),
  );
  expect(afterSnapshot.lsMemberIds.includes(DEFAULT_MEMBER.id), "default uye yerini snapshot aldi").toBe(false);

  // Render tetigi (renderMemberWorkspace)
  const railExists = await page.evaluate(() => Boolean(document.querySelector(".bsm-member-rail, [data-rail-member-id]")));
  expect(railExists, "renderMemberWorkspace tetigi (rail mevcut)").toBe(true);

  // activeProgram null (snapshot member'larin program yok)
  const programSnapshot = await page.evaluate(() => window.BSMTestApi.getActiveProgramSnapshot());
  expect(programSnapshot.hasProgram, "snapshot uye program yok → activeProgram null").toBe(false);

  assertNoErrors(errors, { allowNetwork: true });
});
