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

    const lastThreeMeasurementsHtml = (model.lastThreeMeasurements || []).length
      ? model.lastThreeMeasurements
          .map(
            (item) => `
              <div>
                <strong>${escapeHtml(item.date)}</strong>
                <span>${escapeHtml(item.summary)}</span>
              </div>
            `,
          )
          .join("")
      : `<div><strong>Ölçüm yok</strong><span>İlk segmental ölçüm girildiğinde son 3 kayıt burada özetlenir.</span></div>`;

    const warningListHtml = (model.warnings || []).length
      ? model.warnings
          .map((warning) => `<li>${escapeHtml(warning.title)}: ${escapeHtml(warning.message)}</li>`)
          .join("")
      : `<li>Kritik koç uyarısı yok.</li>`;

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
      <div class="profile-intelligence">
        <div class="score-strip">
          <div class="score-pill">
            <span>Genel skor</span>
            <strong>${escapeHtml(model.score)}</strong>
            <small>Ölçüm, trend ve hassasiyet kuralları</small>
          </div>
          <div class="score-pill">
            <span>Hedef uyumu</span>
            <strong>${escapeHtml(model.goalFitScore)}</strong>
            <small>Hedef + ölçüm trendi + frekans</small>
          </div>
          <div class="score-pill score-pill--risk">
            <span>Risk seviyesi</span>
            <strong>${escapeHtml(model.riskLevel)}</strong>
            <small>Hassasiyet ve kötüleşen metrikler</small>
          </div>
        </div>
        <article class="member-intelligence">
          <strong>AI analiz özeti</strong>
          <p>${escapeHtml(model.summary)}</p>
          <span>${escapeHtml(model.trendText)}</span>
        </article>
        <article class="member-intelligence">
          <strong>Son 3 ölçüm</strong>
          <div class="mini-history">${lastThreeMeasurementsHtml}</div>
        </article>
        <article class="member-intelligence">
          <strong>Program uygunluğu</strong>
          <p>${escapeHtml(model.programSuitability)}</p>
          <span>${escapeHtml(model.revisionNote)}</span>
        </article>
        <article class="member-intelligence member-intelligence--alerts">
          <strong>Koç uyarıları</strong>
          <ul>${warningListHtml}</ul>
          <p><b>Önerilen sonraki adım:</b> ${escapeHtml(model.nextAction)}</p>
        </article>
      </div>
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
      memberList.innerHTML = `<div class="empty-state compact-empty">Kayıtlı üye bulunamadı. Formu doldurup “Üyeyi Kaydet” ile ilk dosyayı oluşturabilirsiniz.</div>`;
      return;
    }

    memberList.innerHTML = model.items
      .map(
        (item) => `
          <article class="member-card ${item.isActive ? "is-active" : ""}">
            <div>
              <strong>${escapeHtml(item.memberName)}</strong>
              <span>${escapeHtml(item.memberCode)} • ${escapeHtml(item.goalLabel)}</span>
              <small>${escapeHtml(item.measurementText)} • ${escapeHtml(item.programText)}</small>
            </div>
            <button type="button" class="ghost-button mini-button" data-action="load-member" data-member-id="${item.memberId}">${escapeHtml(item.actionLabel)}</button>
          </article>
        `,
      )
      .join("");
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
