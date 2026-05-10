(function () {
  "use strict";

  function renderActiveMemberProfile(target, model, escapeHtml) {
    if (!target) {
      return;
    }

    if (!model) {
      target.innerHTML = `
        <div class="profile-card__empty">
          <strong>Aktif üye seçilmedi</strong>
          <span>Kayıtlı üyelerden birini yüklediğinizde profil, son ölçüm ve aktif program burada görünür.</span>
        </div>
      `;
      return;
    }

    target.innerHTML = `
      <div class="profile-card__top">
        <div>
          <p class="section-kicker">Aktif Üye Profili</p>
          <h3>${escapeHtml(model.memberName)}</h3>
          <span>${escapeHtml(model.memberCode)} • ${escapeHtml(model.trainerName)}</span>
        </div>
        <strong>${escapeHtml(model.levelLabel)}</strong>
      </div>
      <div class="profile-stats">
        <div><span>Hedef</span><strong>${escapeHtml(model.goalLabel)}</strong></div>
        <div><span>Son ölçüm</span><strong>${escapeHtml(model.latestMeasurementDate)}</strong></div>
        <div><span>Program</span><strong>${escapeHtml(model.programStatus)}</strong></div>
        <div><span>Uyarı</span><strong>${escapeHtml(model.riskText)}</strong></div>
      </div>
      <div class="profile-quick-summary">
        <article>
          <span>Son durum</span>
          <strong>${escapeHtml(model.trendText || model.summary)}</strong>
        </article>
        <article>
          <span>Sonraki adım</span>
          <strong>${escapeHtml(model.nextAction)}</strong>
        </article>
      </div>
      <div class="profile-quick-actions" aria-label="Aktif üye hızlı aksiyonları">
        <button type="button" class="ghost-button mini-button" data-workflow-action="measurements">Ölçüm</button>
        <button type="button" class="secondary-button mini-button" data-workflow-action="build-program">Program</button>
        <button type="button" class="ghost-button mini-button" data-workflow-action="nutrition">Beslenme</button>
        <button type="button" class="primary-button mini-button" data-workflow-action="output">Çıktı</button>
      </div>
      <p class="profile-card__hint">Detaylı AI/V3 analizleri sağ paneldeki <b>V3 Koçluk</b> sekmesinde tutulur.</p>
    `;
  }

  function renderMemberList(targets, model, escapeHtml) {
    const { memberList, memberCount, memberSort } = targets || {};

    if (memberCount) {
      memberCount.textContent = String(model?.totalCount || 0);
    }

    if (memberSort) {
      memberSort.value = model?.activeSort || "recent-update";
    }

    if (!memberList) {
      return;
    }

    if (!(model?.items || []).length) {
      memberList.innerHTML = `<div class="empty-state compact-empty">Kayıtlı üye bulunamadı. "Program Oluştur" sekmesinden formu doldurup "Üyeyi Kaydet" ile ilk dosyayı oluşturabilirsiniz.</div>`;
      return;
    }

    memberList.innerHTML = model.items
      .map(
        (item) => `
          <article class="member-card member-card--full bsm-member-row ${item.isActive ? "is-active" : ""}" data-member-id="${item.memberId}">
            <div class="bsm-member-row__main">
              <div class="bsm-member-row__avatar" aria-hidden="true">${escapeHtml(buildMemberInitials(item.memberName, item.memberCode))}</div>
              <div class="bsm-member-row__info">
                <div class="bsm-member-row__title">
                  <strong>${escapeHtml(item.memberName)}</strong>
                  ${item.isActive ? `<span class="bsm-pill bsm-pill--active">Aktif</span>` : ""}
                </div>
                <div class="bsm-member-row__meta">
                  <span class="bsm-meta-item bsm-meta-item--code">${escapeHtml(item.memberCode)}</span>
                  <span class="bsm-meta-dot" aria-hidden="true"></span>
                  <span class="bsm-meta-item">${escapeHtml(item.goalLabel)}</span>
                </div>
                <div class="bsm-member-row__status">
                  <span class="bsm-status-chip bsm-status-chip--measurement">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h3l3-9 4 18 3-9h5"></path></svg>
                    ${escapeHtml(item.measurementText)}
                  </span>
                  <span class="bsm-status-chip bsm-status-chip--program">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v16"></path><path d="M18 4v16"></path><path d="M2 8h4"></path><path d="M2 16h4"></path><path d="M18 8h4"></path><path d="M18 16h4"></path><path d="M6 12h12"></path></svg>
                    ${escapeHtml(item.programText)}
                  </span>
                </div>
              </div>
            </div>
            <div class="member-card__actions bsm-member-row__actions" role="group" aria-label="Üye hızlı işlemleri">
              <button type="button" class="bsm-icon-btn" title="Profili Aç" aria-label="Profili Aç" data-member-quick-action="load-profile" data-member-id="${item.memberId}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </button>
              <button type="button" class="bsm-icon-btn" title="Ölçüm Ekle" aria-label="Ölçüm Ekle" data-member-quick-action="add-measurement" data-member-id="${item.memberId}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h3l3-9 4 18 3-9h5"></path></svg>
              </button>
              <button type="button" class="bsm-icon-btn" title="Program Oluştur" aria-label="Program Oluştur" data-member-quick-action="build-program" data-member-id="${item.memberId}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v16"></path><path d="M18 4v16"></path><path d="M2 8h4"></path><path d="M2 16h4"></path><path d="M18 8h4"></path><path d="M18 16h4"></path><path d="M6 12h12"></path></svg>
              </button>
              <button type="button" class="bsm-icon-btn" title="Beslenme Planı" aria-label="Beslenme Planı" data-member-quick-action="nutrition" data-member-id="${item.memberId}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2v20"></path><path d="M5 2v6a3 3 0 0 0 6 0V2"></path><path d="M18 2v20"></path><path d="M15 2c0 4 3 4 3 8"></path></svg>
              </button>
              <button type="button" class="bsm-icon-btn" title="Çıktı / PDF" aria-label="Çıktı / PDF" data-member-quick-action="output" data-member-id="${item.memberId}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              </button>
              <button type="button" class="bsm-icon-btn" title="Geçmiş" aria-label="Geçmiş" data-member-quick-action="history" data-member-id="${item.memberId}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><polyline points="3 3 3 8 8 8"></polyline><path d="M12 7v5l3 2"></path></svg>
              </button>
            </div>
          </article>
        `,
      )
      .join("");
  }

  function buildMemberInitials(memberName, memberCode) {
    const source = String(memberName || memberCode || "").trim();
    if (!source) return "BSM";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("tr");
    }
    return source.slice(0, 2).toLocaleUpperCase("tr");
  }

  function renderMeasurementHistory(target, model, escapeHtml) {
    if (!target) {
      return;
    }

    if (!model) {
      target.innerHTML = `<div class="empty-state compact-empty">Bir üye seçildiğinde ölçüm geçmişi burada görünür.</div>`;
      return;
    }

    if (!(model.items || []).length) {
      target.innerHTML = `<div class="empty-state compact-empty">Bu üye için henüz ölçüm kaydı yok.</div>`;
      return;
    }

    target.innerHTML = model.items
      .map(
        (item) => `
          <article class="history-item">
            <strong>${escapeHtml(item.date)}</strong>
            <span>${escapeHtml(item.line)}</span>
            ${item.segmentLine ? `<small>${escapeHtml(item.segmentLine)}</small>` : ""}
            ${item.resistanceLine ? `<small>${escapeHtml(item.resistanceLine)}</small>` : ""}
            ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
          </article>
        `,
      )
      .join("");
  }

  function renderProgramHistory(target, model, escapeHtml) {
    if (!target) {
      return;
    }

    if (!model) {
      target.innerHTML = `<div class="empty-state compact-empty">Bir üye seçildiğinde program geçmişi burada görünür.</div>`;
      return;
    }

    if (!(model.items || []).length) {
      target.innerHTML = `<div class="empty-state compact-empty">Bu üye için henüz program kaydı yok.</div>`;
      return;
    }

    target.innerHTML = model.items
      .map(
        (item) => `
          <article class="history-item history-item--action">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.savedAt)}</span>
            </div>
            <button type="button" class="ghost-button mini-button" data-program-id="${item.id}">Yükle</button>
          </article>
        `,
      )
      .join("");
  }

  function renderV3CoachingPanel(targets, model, escapeHtml) {
    const { professionalMemberFile, v3MemberDossier, v3TrendCharts, v3RevisionPanel, v3ControlCalendar } = targets || {};

    if (!professionalMemberFile || !v3MemberDossier || !v3TrendCharts || !v3RevisionPanel || !v3ControlCalendar) {
      return;
    }

    if (!model) {
      const emptyHtml = `<div class="empty-state compact-empty">V3 koçluk dosyası için önce aktif üye seçin.</div>`;
      professionalMemberFile.innerHTML = emptyHtml;
      v3MemberDossier.innerHTML = emptyHtml;
      v3TrendCharts.innerHTML = "";
      v3RevisionPanel.innerHTML = "";
      v3ControlCalendar.innerHTML = "";
      return;
    }

    professionalMemberFile.innerHTML = `
      <article class="member-file-hero">
        <div>
          <p class="section-kicker">Profesyonel Üye Dosyası</p>
          <h4>${escapeHtml(model.memberName || "İsimsiz Üye")}</h4>
          <span>${escapeHtml(model.memberCode || "Üye no yok")} • ${escapeHtml(model.goalLabel || "Hedef yok")} • ${escapeHtml(model.levelLabel || "Seviye yok")}</span>
        </div>
        <strong>${escapeHtml(model.riskLabel || "Belirsiz")} risk</strong>
      </article>
      <div class="member-file-tags">
        ${(model.statusTags || [])
          .map((tag) => `<span class="member-file-tag member-file-tag--${escapeHtml(tag.tone)}">${escapeHtml(tag.label)}</span>`)
          .join("")}
      </div>
      <div class="member-file-grid">
        <div><span>Son ölçüm</span><strong>${escapeHtml(model.latestMeasurementDate || "Yok")}</strong></div>
        <div><span>Son program</span><strong>${escapeHtml(model.latestProgramDate || "Yok")}</strong></div>
        <div><span>Genel skor</span><strong>${escapeHtml(model.score ?? 0)}/100</strong></div>
        <div><span>Hedef uyumu</span><strong>${escapeHtml(model.goalFitScore ?? 0)}/100</strong></div>
      </div>
      <div class="member-file-next">
        <strong>Önerilen sonraki adım</strong>
        <p>${escapeHtml(model.nextAction || "Ölçüm ve program takibini güncelle.")}</p>
      </div>
    `;

    v3MemberDossier.innerHTML = `
      <article class="v3-score-card v3-score-card--hero">
        <span>V3 hazırlık skoru</span>
        <strong>${escapeHtml(model.readinessScore ?? 0)}/100</strong>
        <p>${escapeHtml(model.summary || "Üye V3 takibe hazırlanıyor.")}</p>
      </article>
      <article class="v3-score-card">
        <span>Veri kalitesi</span>
        <strong>${escapeHtml(model.dataQualityScore ?? 0)}/100</strong>
        <p>${escapeHtml(model.measurementCount ?? 0)} ölçüm • ${escapeHtml(model.programCount ?? 0)} program</p>
      </article>
      <article class="v3-score-card">
        <span>Takip sürekliliği</span>
        <strong>${escapeHtml(model.continuityScore ?? 0)}/100</strong>
        <p>Ölçüm güncelliği: ${escapeHtml(formatV3Age(model.measurementAge))} • Program güncelliği: ${escapeHtml(formatV3Age(model.programAge))}</p>
      </article>
      <article class="v3-score-card">
        <span>Koç önceliği</span>
        <strong>${escapeHtml(model.coachingPriorityScore ?? 0)}/100</strong>
        <p>Yüksek skor daha yakın takip ihtiyacı anlamına gelir.</p>
      </article>
      <article class="v3-score-card v3-score-card--wide">
        <span>Medya hazırlığı</span>
        <p>${escapeHtml(model.mediaReadinessText || "Hareket video/görsel bağlantıları ileride eklenebilir.")}</p>
      </article>
    `;

    v3TrendCharts.innerHTML = (model.trendSeries || []).map((metric) => renderV3TrendChart(metric, escapeHtml)).join("");

    v3RevisionPanel.innerHTML = `
      <article class="v3-revision-card">
        <div class="v3-revision-card__header">
          <div>
            <p class="section-kicker">AI Revizyon Önerisi</p>
            <h4>Öncelik: ${escapeHtml(model.revisionPriority || "Normal")}</h4>
          </div>
          <span>${escapeHtml(model.riskLabel || "Belirsiz")} risk</span>
        </div>
        <p>${escapeHtml(model.fitNote || "Program uygunluğu kontrol ediliyor.")}</p>
        <p>${escapeHtml(model.revisionNote || "Revizyon notu ölçüm trendiyle netleşir.")}</p>
        ${renderV3List("Önerilen aksiyonlar", model.recommendedActions || [], escapeHtml)}
        ${renderV3List("Antrenör onay adımları", model.approvalSteps || [], escapeHtml)}
        ${renderV3List("Risk kontrol listesi", model.riskControls || [], escapeHtml)}
        ${renderV3List("Koç seans kontrolü", model.coachChecklist || [], escapeHtml)}
        <div class="v3-action-bar">
          <button type="button" class="secondary-button mini-button" data-v3-action="generate-revision">Revizyonlu Program Oluştur</button>
          <button type="button" class="ghost-button mini-button" data-v3-action="open-measurement">Yeni Ölçüm Gir</button>
        </div>
      </article>
    `;

    v3ControlCalendar.innerHTML = `
      <div class="v3-panel-title">
        <p class="section-kicker">Kontrol Takvimi</p>
        <h4>Aktif Üye İçin Yaklaşan Adımlar</h4>
      </div>
      ${renderV3CalendarItems(model.controlTimeline || [], escapeHtml)}
    `;
  }

  function renderV3TrendChart(metric, escapeHtml) {
    const values = metric.values || [];
    const latest = values[values.length - 1];
    const chart = buildV3SvgChart(values.map((item) => item.value));

    return `
      <article class="v3-chart-card v3-chart-card--${metric.isPositive === false ? "warning" : "ok"}">
        <div class="v3-chart-card__header">
          <div>
            <span>${escapeHtml(metric.label)}</span>
            <strong>${latest ? `${escapeHtml(latest.value)} ${escapeHtml(metric.unit)}` : "Veri yok"}</strong>
          </div>
          <em>${escapeHtml(metric.statusText || "Trend bekleniyor")}</em>
        </div>
        ${
          values.length >= 2
            ? `<svg viewBox="0 0 240 86" role="img" aria-label="${escapeHtml(metric.label)} trend grafiği">
                <path d="M8 72 H232" class="v3-chart-axis"></path>
                <polyline points="${escapeHtml(chart.points)}" class="v3-chart-line"></polyline>
                ${chart.dots.map((dot) => `<circle cx="${dot.x}" cy="${dot.y}" r="3.5" class="v3-chart-dot"></circle>`).join("")}
              </svg>`
            : `<div class="empty-state compact-empty">Grafik için en az iki ölçüm gerekir.</div>`
        }
      </article>
    `;
  }

  function buildV3SvgChart(values) {
    const width = 224;
    const height = 64;
    const offsetX = 8;
    const offsetY = 10;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const dots = values.map((value, index) => {
      const x = offsetX + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
      const y = offsetY + height - ((value - min) / range) * height;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    return {
      dots,
      points: dots.map((dot) => `${dot.x},${dot.y}`).join(" "),
    };
  }

  function renderV3List(title, items, escapeHtml) {
    const safeItems = (items || []).filter(Boolean);

    if (!safeItems.length) {
      return "";
    }

    return `
      <div class="v3-list-block">
        <strong>${escapeHtml(title)}</strong>
        <ul>
          ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderV3CalendarItems(items, escapeHtml) {
    if (!(items || []).length) {
      return `<div class="empty-state compact-empty">Aktif üye için planlı kontrol görünmüyor.</div>`;
    }

    return items
      .map(
        (item) => `
          <article class="v3-calendar-item v3-calendar-item--${escapeHtml(item.severity || "info")}">
            <div>
              <strong>${escapeHtml(item.title || "Kontrol")}</strong>
              <span>${escapeHtml(item.dueAtLabel || "Tarih yok")}</span>
            </div>
            <em>${escapeHtml(formatV3DaysLeft(item.daysLeft))}</em>
            <p>${escapeHtml(item.text || "Ölçüm ve program performansı kontrol edilmeli.")}</p>
          </article>
        `,
      )
      .join("");
  }

  function formatV3DaysLeft(daysLeft) {
    if (daysLeft === null || daysLeft === undefined || Number.isNaN(Number(daysLeft))) {
      return "Tarih yok";
    }

    if (Number(daysLeft) <= 0) {
      return "Bugün";
    }

    return `${Number(daysLeft)} gün`;
  }

  function formatV3Age(age) {
    if (age === null || age === undefined || Number.isNaN(Number(age))) {
      return "yok";
    }

    return `${Number(age)} gün`;
  }

  window.BSMMemberUI = {
    renderActiveMemberProfile,
    renderMemberList,
    renderMeasurementHistory,
    renderProgramHistory,
    renderV3CoachingPanel,
  };
})();
