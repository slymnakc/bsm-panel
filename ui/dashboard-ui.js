(function () {
  "use strict";

  function renderDashboardMetrics(elements, summary) {
    if (!elements || !summary) {
      return;
    }

    setText(elements.memberCount, summary.memberCount);
    setText(elements.programCount, summary.programCount);
    setText(elements.measurementCount, summary.measurementCount);
    setText(elements.activeMember, summary.activeMemberName);
    setText(elements.activeMemberMeta, summary.activeMemberMeta);
    setText(elements.riskMemberCount, summary.riskMemberCount);
    setText(elements.measurementDueCount, summary.measurementDueCount);
    setText(elements.programDueCount, summary.programDueCount);
    setText(elements.last7ActivityCount, summary.last7ActivityCount);
  }

  function renderDashboardActivity(target, items, escapeHtml) {
    if (!target) {
      return;
    }

    target.innerHTML = (items || []).length
      ? items
          .map(
            (item) => `
              <div class="activity-item">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.meta)}</span>
              </div>
            `,
          )
          .join("")
      : `<div class="empty-state compact-empty">Henüz aktivite yok. Üye kaydedip program oluşturunca burada görünür.</div>`;
  }

  function renderCoachAlerts(target, alerts, escapeHtml) {
    if (!target) {
      return;
    }

    target.innerHTML = (alerts || []).length
      ? alerts
          .map(
            (alert) => `
              <article class="coach-alert coach-alert--${escapeHtml(alert.severity || "info")}">
                <strong>${escapeHtml(alert.title || "Koç uyarısı")}</strong>
                <span>${escapeHtml(alert.memberName || "")}${alert.memberName ? " • " : ""}${escapeHtml(alert.message || "")}</span>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state compact-empty">Şu anda kritik uyarı yok. Ölçüm ve program kayıtları geldikçe otomatik takip burada görünür.</div>`;
  }

  function renderV3DashboardCalendar(target, items, escapeHtml, formatV3DaysLeft) {
    if (!target) {
      return;
    }

    target.innerHTML = (items || []).length
      ? items
          .map(
            (item) => `
              <article class="v3-calendar-item v3-calendar-item--${escapeHtml(item.severity || "info")}">
                <div>
                  <strong>${escapeHtml(item.memberName || "Üye")}</strong>
                  <span>${escapeHtml(item.title || "Kontrol")}</span>
                </div>
                <em>${escapeHtml(formatV3DaysLeft(item.daysLeft))}</em>
                <p>${escapeHtml(item.text || "Ölçüm ve program performansı kontrol edilmeli.")}</p>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state compact-empty">Önümüzdeki 14 gün için kritik kontrol görünmüyor.</div>`;
  }

  function renderCoachTasks(target, tasks, escapeHtml) {
    if (!target) {
      return;
    }

    target.innerHTML = (tasks || []).length
      ? tasks
          .map(
            (task) => `
              <article class="coach-task-item coach-task-item--${escapeHtml(task.tone)}">
                <div class="coach-task-item__top">
                  <div>
                    <strong>${escapeHtml(task.title)}</strong>
                    <span>${escapeHtml(task.memberName)}</span>
                  </div>
                  <span>${escapeHtml(task.badge)}</span>
                </div>
                <p>${escapeHtml(task.text)}</p>
                <button
                  type="button"
                  class="ghost-button mini-button"
                  data-task-member-id="${escapeHtml(task.memberId)}"
                  data-task-workspace="${escapeHtml(task.workspace)}"
                >${escapeHtml(task.actionLabel)}</button>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state compact-empty">Bugün için kritik koç görevi görünmüyor.</div>`;
  }

  function renderCoachQuickPanel(target, model, escapeHtml) {
    if (!target) {
      return;
    }

    if (!model) {
      target.innerHTML = `
        <div class="quick-panel">
          <div>
            <p class="section-kicker">Koç Hızlı Panel</p>
            <h3>Hızlı Erişim</h3>
          </div>
          <p class="quick-panel__note">Aktif üye seçtiğinizde bir sonraki adım önerileri, hızlı geçiş butonları ve kritik özet burada görünür.</p>
          <div class="quick-panel__actions">
            <button type="button" class="ghost-button mini-button" data-quick-action="open-builder">Üye Ekranı</button>
            <button type="button" class="ghost-button mini-button" data-quick-action="open-measurements">Ölçüm Ekranı</button>
          </div>
        </div>
      `;
      return;
    }

    target.innerHTML = `
      <div class="quick-panel">
        <div>
          <p class="section-kicker">Koç Hızlı Panel</p>
          <h3>${escapeHtml(model.memberName || "Aktif Üye")}</h3>
        </div>
        <div class="quick-panel__meta">
          <div><span>Haftalık gün</span><strong>${escapeHtml(model.trainingDays)}</strong></div>
          <div><span>Son ölçüm</span><strong>${escapeHtml(model.latestMeasurementDate)}</strong></div>
          <div><span>Son program</span><strong>${escapeHtml(model.latestProgramDate)}</strong></div>
        </div>
        <div class="quick-panel__ai">
          <div><span>AI skor</span><strong>${escapeHtml(model.score)}</strong></div>
          <div><span>Hedef uyumu</span><strong>${escapeHtml(model.goalFitScore)}</strong></div>
          <div><span>Risk</span><strong>${escapeHtml(model.riskLevel)}</strong></div>
        </div>
        <p class="quick-panel__note"><strong>AI özet:</strong> ${escapeHtml(model.summary)}</p>
        <p class="quick-panel__note"><strong>Trend:</strong> ${escapeHtml(model.trendText)}</p>
        <p class="quick-panel__note"><strong>Koç uyarıları:</strong> ${escapeHtml(model.alertSummary)}</p>
        <p class="quick-panel__note"><strong>Önerilen adım:</strong> ${escapeHtml(model.nextAction)}</p>
        <div class="quick-panel__actions">
          <button type="button" class="secondary-button mini-button" data-quick-action="open-builder">Üye Kartı</button>
          <button type="button" class="ghost-button mini-button" data-quick-action="open-measurements">Ölçüm</button>
          <button type="button" class="ghost-button mini-button" data-quick-action="open-output">Program Çıktısı</button>
          <button type="button" class="ghost-button mini-button" data-quick-action="export-active-member">CSV</button>
        </div>
      </div>
    `;
  }

  function renderBackupMeta(target, text) {
    if (!target) {
      return;
    }

    target.textContent = text || "Oto yedek bekleniyor";
  }

  function setText(target, value) {
    if (!target) {
      return;
    }

    target.textContent = String(value ?? "");
  }

  window.BSMDashboardUI = {
    renderDashboardMetrics,
    renderDashboardActivity,
    renderCoachAlerts,
    renderV3DashboardCalendar,
    renderCoachTasks,
    renderCoachQuickPanel,
    renderBackupMeta,
  };
})();
