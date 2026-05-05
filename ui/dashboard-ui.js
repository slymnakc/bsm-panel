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
    setText(elements.statusSummary, summary.statusSummary);
    setText(elements.supabaseStatus, `Supabase: ${summary.supabaseStatus || "Bilinmiyor"}`);
    setText(elements.memberTrend, summary.kpiStates?.member?.trend);
    setText(elements.measurementDueTrend, summary.kpiStates?.measurement?.trend);
    setText(elements.programDueTrend, summary.kpiStates?.program?.trend);
    setText(elements.activeMemberTrend, summary.kpiStates?.active?.trend);
    setCardTone(elements.memberCount, summary.kpiStates?.member?.tone);
    setCardTone(elements.measurementDueCount, summary.kpiStates?.measurement?.tone);
    setCardTone(elements.programDueCount, summary.kpiStates?.program?.tone);
    setCardTone(elements.activeMember, summary.kpiStates?.active?.tone);
  }

  function renderDashboardActivity(target, items, escapeHtml) {
    if (!target) {
      return;
    }

    target.innerHTML = (items || []).length
      ? items
          .map(
            (item) => `
              <div class="activity-item activity-item--${escapeHtml(item.type || "default")}">
                <i>${escapeHtml(item.badge || "Kayıt")}</i>
                <div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.meta)}</span>
                </div>
              </div>
            `,
          )
          .join("")
      : `<div class="empty-state compact-empty">Henüz aktivite yok. Üye kaydedip ölçüm veya program oluşturunca burada görünür.</div>`;
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
                <div class="coach-alert__top">
                  <span>${escapeHtml(alert.severityLabel || alert.badge || "Takip")}</span>
                  <strong>${escapeHtml(alert.memberName || "Üye")}</strong>
                </div>
                <p>${escapeHtml(alert.message || alert.title || "Koç uyarısı")}</p>
                ${renderAlertAction(alert, escapeHtml)}
              </article>
            `,
          )
          .join("") +
        `<button type="button" class="ghost-button mini-button dashboard-list-more" data-quick-action="open-builder">Tümünü Gör</button>`
      : `<div class="empty-state compact-empty">Şu anda kritik uyarı yok. Ölçüm ve program kayıtları geldikçe otomatik takip burada görünür.</div>`;
  }

  function renderAlertAction(alert, escapeHtml) {
    if (alert.memberId) {
      return `
        <button
          type="button"
          class="ghost-button mini-button"
          data-task-member-id="${escapeHtml(alert.memberId)}"
          data-task-workspace="${escapeHtml(alert.workspace || "members")}"
        >${escapeHtml(alert.actionLabel || "Aç")}</button>
      `;
    }

    return `<button type="button" class="ghost-button mini-button" data-quick-action="open-builder">${escapeHtml(alert.actionLabel || "Aç")}</button>`;
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
          .join("") +
        `<button type="button" class="ghost-button mini-button dashboard-list-more" data-quick-action="open-builder">Tümünü Gör</button>`
      : `<div class="empty-state compact-empty">Bugün için kritik koç görevi görünmüyor.</div>`;
  }

  function renderDashboardFocus(target, model, escapeHtml) {
    if (!target || !model) {
      return;
    }

    target.innerHTML = `
      <div class="dashboard-focus-block__content">
        <div>
          <p class="section-kicker">Bugünün Öncelikli Aksiyonları</p>
          <h3>${escapeHtml(model.title)}</h3>
          <p>${escapeHtml(model.text)}</p>
        </div>
        <button type="button" class="primary-button" data-quick-action="${escapeHtml(model.action || "open-builder")}">${escapeHtml(model.actionLabel || "İşlemlere Başla")}</button>
      </div>
      <div class="dashboard-focus-metrics">
        ${(model.items || [])
          .map(
            (item) => `
              <article class="dashboard-focus-metric dashboard-focus-metric--${escapeHtml(item.tone || "neutral")}">
                <strong>${escapeHtml(item.count)}</strong>
                <span>${escapeHtml(item.title)}</span>
                <small>${escapeHtml(item.text)}</small>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderCoachQuickPanel(target, model, escapeHtml) {
    if (!target) {
      return;
    }

    target.innerHTML = `
      <div class="quick-panel quick-panel--command">
        <div>
          <p class="section-kicker">Ana Akış</p>
          <h3>Hızlı İşlemler</h3>
          <p class="quick-panel__note">Üye seçimi, Tanita ölçümü, program, beslenme ve PDF çıktısına tek dokunuşla geçin.</p>
        </div>
        <div class="quick-action-grid">
          ${renderQuickActionCard("user-plus", "Yeni Üye", "Yeni üye formunu aç ve kayıt akışını başlat.", "new-member", escapeHtml)}
          ${renderQuickActionCard("measure", "Tanita Ölçüm Gir", "CSV yükle veya manuel segmental ölçüm ekle.", "open-measurements", escapeHtml)}
          ${renderQuickActionCard("dumbbell", "Program Oluştur", "Hedef ve ölçüme göre antrenman planı hazırla.", "build-program", escapeHtml)}
          ${renderQuickActionCard("nutrition", "Beslenme Planı", "Tanita verisine bağlı beslenme sekmesini aç.", "open-nutrition", escapeHtml)}
          ${renderQuickActionCard("pdf", "PDF Çıktı", "Üyeye verilecek çıktı ve rapor ekranına geç.", "open-output", escapeHtml)}
        </div>
      </div>
    `;
  }

  function renderQuickActionCard(icon, title, text, action, escapeHtml) {
    return `
      <button type="button" class="quick-action-card quick-action-card--${escapeHtml(icon)}" data-quick-action="${escapeHtml(action)}">
        <span class="quick-action-card__icon" aria-hidden="true">${escapeHtml(getQuickActionIcon(icon))}</span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(text)}</small>
      </button>
    `;
  }

  function getQuickActionIcon(icon) {
    const icons = {
      "user-plus": "+",
      measure: "cm",
      dumbbell: "kg",
      nutrition: "B",
      pdf: "PDF",
    };

    return icons[icon] || ">";
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

  function setCardTone(target, tone) {
    const card = target?.closest?.(".dashboard-card");

    if (!card) {
      return;
    }

    card.dataset.tone = tone || "neutral";
  }

  window.BSMDashboardUI = {
    renderDashboardMetrics,
    renderDashboardActivity,
    renderCoachAlerts,
    renderDashboardFocus,
    renderV3DashboardCalendar,
    renderCoachTasks,
    renderCoachQuickPanel,
    renderBackupMeta,
  };
})();
