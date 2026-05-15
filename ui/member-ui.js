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
      memberList.innerHTML = `<div class="bsm-rail-empty">Kayıtlı üye yok. "Yeni Üye Ekle" ile başlayın.</div>`;
      return;
    }

    memberList.innerHTML = model.items
      .map((item) => {
        const initials = escapeHtml(buildMemberInitials(item.memberName, item.memberCode));
        const goalLabel = escapeHtml(item.goalLabel || item.memberCode || "Hedef yok");
        const statusClass = resolveRailStatusClass(item);
        const photoSrc = item.photo ? escapeHtml(item.photo) : "";
        const avatarHtml = photoSrc
          ? `<img src="${photoSrc}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
          : initials;
        return `
          <button type="button" class="bsm-rail-card ${item.isActive ? "is-active" : ""}" data-rail-member-id="${item.memberId}" data-member-id="${item.memberId}" role="listitem">
            <span class="bsm-rail-card__avatar" aria-hidden="true">${avatarHtml}</span>
            <span class="bsm-rail-card__body">
              <span class="bsm-rail-card__name">${escapeHtml(item.memberName)}</span>
              <span class="bsm-rail-card__goal">${goalLabel}</span>
            </span>
            <span class="bsm-rail-card__status ${statusClass}" aria-hidden="true"></span>
          </button>
        `;
      })
      .join("");
  }

  function resolveRailStatusClass(item) {
    // active = ölçümü VE programı olan
    // warning = ölçümü VAR ama programı yok (veya tersi)
    // default = ikisi de yok
    const hasMeasurement = !/yok|hen[üu]z/i.test(String(item.measurementText || ""));
    const hasProgram = !/yok|hen[üu]z/i.test(String(item.programText || ""));
    if (hasMeasurement && hasProgram) return "bsm-rail-card__status--active";
    if (hasMeasurement || hasProgram) return "bsm-rail-card__status--warning";
    return "";
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

    if (model.variant === "premium-table") {
      target.innerHTML = `
        <div class="measurement-history-table-wrap">
          <table class="measurement-history-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kilo</th>
                <th>Yağ Oranı</th>
                <th>Kas Kütlesi</th>
                <th>Bel</th>
                <th>Visceral</th>
                <th>BMR</th>
                <th>Met. Yaş</th>
                <th>Kaynak</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              ${model.items
                .map(
                  (item) => `
                    <tr>
                      <td><strong>${escapeHtml(item.date || "-")}</strong></td>
                      <td>${escapeHtml(item.weight || "-")}</td>
                      <td>${escapeHtml(item.fat || "-")}</td>
                      <td>${escapeHtml(item.muscleMass || "-")}</td>
                      <td>${escapeHtml(item.waist || "-")}</td>
                      <td>${escapeHtml(item.visceralFat || "-")}</td>
                      <td>${escapeHtml(item.bmr || "-")}</td>
                      <td>${escapeHtml(item.metabolicAge || "-")}</td>
                      <td><span class="measurement-source-pill">${escapeHtml(item.sourceLabel || "Manuel")}</span></td>
                      <td>
                        <div class="measurement-history-actions">
                          <button type="button" class="measurement-history-icon-action" data-measurement-view="${escapeHtml(item.id || "")}" aria-label="Ölçümü görüntüle">Gör</button>
                          <button type="button" class="measurement-history-icon-action" data-measurement-ui-action="compare" aria-label="Ölçümleri karşılaştır">Karşılaştır</button>
                          <button type="button" class="measurement-history-icon-action" data-measurement-ui-action="build-report" aria-label="Rapor oluştur">PDF</button>
                          ${
                            item.id
                              ? `<button type="button" class="measurement-history-icon-action is-danger" data-measurement-delete="${escapeHtml(item.id)}" aria-label="Ölçüm kaydını sil">Sil</button>`
                              : ""
                          }
                        </div>
                      </td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
      return;
    }

    if (model.variant === "premium-cards") {
      target.innerHTML = `
        <div class="measurement-program-history-grid">
          ${model.items
            .map(
              (item) => `
                <article class="measurement-program-history-card">
                  <div>
                    <span>${escapeHtml(item.status || "Kayıtlı")}</span>
                    <strong>${escapeHtml(item.title || "Program")}</strong>
                    <small>${escapeHtml(item.savedAt || "Tarih yok")}</small>
                  </div>
                  <dl>
                    <div><dt>Hedef</dt><dd>${escapeHtml(item.goal || "-")}</dd></div>
                    <div><dt>İlgili ölçüm</dt><dd>${escapeHtml(item.measurement || "-")}</dd></div>
                  </dl>
                  <button type="button" class="ghost-button mini-button" data-program-id="${escapeHtml(item.id || "")}">Görüntüle</button>
                </article>
              `,
            )
            .join("")}
        </div>
      `;
      return;
    }

    target.innerHTML = model.items
      .map(
        (item) => `
          <article class="history-item measurement-history-item">
            <div class="measurement-history-item__body">
              <strong>${escapeHtml(item.date)}</strong>
              <span>${escapeHtml(item.line)}</span>
              ${item.segmentLine ? `<small>${escapeHtml(item.segmentLine)}</small>` : ""}
              ${item.resistanceLine ? `<small>${escapeHtml(item.resistanceLine)}</small>` : ""}
              ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
            </div>
            ${
              item.id
                ? `<button type="button" class="measurement-history-delete" data-measurement-delete="${escapeHtml(item.id)}" aria-label="Ölçüm kaydını sil">Sil</button>`
                : ""
            }
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

    const decisionModel = buildV3DecisionModel(model);

    professionalMemberFile.innerHTML = renderV3LeanDecisionCenter(decisionModel, escapeHtml);
    v3MemberDossier.innerHTML = renderV3MainRecommendation(decisionModel, escapeHtml);
    v3TrendCharts.innerHTML = renderV3ActionAndChecklist(decisionModel, escapeHtml);
    v3RevisionPanel.innerHTML = renderV3AiNoteAndDetails(decisionModel, escapeHtml);
    v3ControlCalendar.innerHTML = renderV3FollowUpPlan(decisionModel, escapeHtml);
    return;

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

  function buildV3DecisionModel(model) {
    const latestMeasurement = model.latestMeasurement || {};
    const goalText = String(model.goalLabel || "").toLocaleLowerCase("tr");
    const isFatGoal = /yağ|yag|kilo|definasyon|recomp/.test(goalText);
    const isMuscleGoal = /kas|hipertrofi|bulk|kuvvet/.test(goalText);
    const weight = readV3MeasurementNumber(latestMeasurement, ["weight", "kilo", "bodyWeight"]);
    const bodyFat = readV3MeasurementNumber(latestMeasurement, ["bodyFatPercentage", "fat", "bodyFat", "fatPercent"]);
    const muscleMass = readV3MeasurementNumber(latestMeasurement, ["muscleMass", "kasKutlesi", "kasKütlesi"]);
    const bodyWater = readV3MeasurementNumber(latestMeasurement, ["bodyWater", "water", "suOrani"]);
    const waist = readV3MeasurementNumber(latestMeasurement, ["waist", "bel", "waistCircumference"]);
    const visceralFat = readV3MeasurementNumber(latestMeasurement, ["visceralFat", "visceral", "icYag"]);
    const bmr = readV3MeasurementNumber(latestMeasurement, ["bmr", "basalMetabolicRate"]);
    const bmi = readV3MeasurementNumber(latestMeasurement, ["bmi"]);
    const dataQualityScore = clampV3Score(model.dataQualityScore ?? 0);
    const continuityScore = clampV3Score(model.continuityScore ?? 0);
    const coachingPriorityScore = clampV3Score(model.coachingPriorityScore ?? 0);
    const measurementCount = Number(model.measurementCount || 0);
    const programCount = Number(model.programCount || 0);
    const measurementAge = Number.isFinite(Number(model.measurementAge)) ? Number(model.measurementAge) : null;
    const programAge = Number.isFinite(Number(model.programAge)) ? Number(model.programAge) : null;
    const goalDefined = Boolean(model.profileGoal && model.goalLabel && model.goalLabel !== "Hedef yok");
    const readinessScore = calculateV3UsableScore(model.readinessScore ?? model.score ?? 0, {
      dataQualityScore,
      continuityScore,
      measurementCount,
      programCount,
      measurementAge,
    });
    const riskState = buildV3RiskState({
      engineRiskLabel: model.riskLabel,
      measurementCount,
      programCount,
      measurementAge,
      goalDefined,
      continuityScore,
    });
    const priorityAction = buildV3PriorityAction({
      bodyFat,
      muscleMass,
      measurementCount,
      measurementAge,
      programCount,
      programAge,
      goalDefined,
      isFatGoal,
      isMuscleGoal,
      nextAction: model.nextAction,
      riskState,
    });

    return {
      ...model,
      latestMeasurement,
      metrics: { weight, bodyFat, muscleMass, bodyWater, waist, visceralFat, bmr, bmi },
      goalText,
      isFatGoal,
      isMuscleGoal,
      readinessScore,
      dataQualityScore,
      continuityScore,
      coachingPriorityScore,
      measurementCount,
      programCount,
      programAge,
      measurementAge,
      goalDefined,
      riskState,
      riskLabel: riskState.label,
      riskTone: riskState.tone,
      priorityAction,
      scoreCards: buildV3ScoreCards({
        readinessScore,
        dataQualityScore,
        continuityScore,
        coachingPriorityScore,
        measurementCount,
        programCount,
        measurementAge,
        programAge,
        summary: model.summary,
      }),
    };
  }

  function calculateV3UsableScore(rawScore, context) {
    let score = clampV3Score(rawScore || Math.round(context.dataQualityScore * 0.48 + context.continuityScore * 0.34 + (context.programCount ? 18 : 0)));

    if (!context.measurementCount) {
      score = Math.min(score, 42);
    } else if (!context.programCount) {
      score = Math.min(score, 68);
    }

    if (context.measurementAge !== null && context.measurementAge > 14) {
      score = Math.min(score, 60);
    }

    return clampV3Score(score);
  }

  function buildV3RiskState(context) {
    const engineTone = resolveV3RiskTone(context.engineRiskLabel);

    if (!context.measurementCount) {
      return { label: "Yüksek Risk", tone: "danger", text: "Güncel ölçüm yok." };
    }

    if (!context.programCount) {
      return { label: "Orta Risk", tone: "attention", text: "Program kaydı eksik." };
    }

    if (context.measurementAge !== null && context.measurementAge > 14) {
      return { label: "Orta Risk", tone: "attention", text: "Son ölçüm güncel değil." };
    }

    if (!context.goalDefined) {
      return { label: "Orta Risk", tone: "attention", text: "Hedef tanımı eksik." };
    }

    if (engineTone === "danger") {
      return { label: "Yüksek Risk", tone: "danger", text: "Analiz yakın takip öneriyor." };
    }

    if (engineTone === "attention" || context.continuityScore < 55) {
      return { label: "Orta Risk", tone: "attention", text: "Takip ritmi güçlendirilmeli." };
    }

    return { label: "Düşük Risk", tone: "good", text: "Mevcut takip güvenli aralıkta." };
  }

  function buildV3PriorityAction(context) {
    if (!context.measurementCount) {
      return {
        title: "Yeni ölçüm girilmeli",
        text: "Üyenin güncel ölçüm kaydı olmadığı için risk ve program kararı güvenilir oluşmaz.",
        why: "V3 skoru ölçüm geçmişi olmadan sadece profil bilgisine dayanır.",
        what: "Ölçüm & Tanita ekranında manuel ölçüm veya Tanita CSV kaydı ekleyin.",
        expected: "Skor, risk ve program yönlendirmesi gerçek veriye göre güncellenir.",
        actionLabel: "Yeni Ölçüm Gir",
        actionType: "v3",
        actionValue: "open-measurement",
      };
    }

    if (context.measurementAge !== null && context.measurementAge > 14) {
      return {
        title: "Yeni ölçüm alınmalı",
        text: "Son ölçüm 14 günü geçtiği için mevcut kararlar güncelliğini kaybediyor.",
        why: "Kilo, yağ oranı ve kas kütlesi değişmiş olabilir.",
        what: "Yeni ölçüm girip program ve beslenme kararlarını tazeleyin.",
        expected: "Trend takibi netleşir ve gereksiz program revizyonu riski azalır.",
        actionLabel: "Yeni Ölçüm Gir",
        actionType: "v3",
        actionValue: "open-measurement",
      };
    }

    if (!context.programCount) {
      return {
        title: "İlk program oluşturulmalı",
        text: "Üyenin ölçüm verisi var ancak aktif program geçmişi bulunmuyor.",
        why: "Program olmadan takip ve gelişim skorları anlamlı şekilde ilerlemez.",
        what: `${context.isMuscleGoal ? "Kas kazanımı" : context.isFatGoal ? "Yağ kaybı" : "Hedefe uygun"} başlangıç programı oluşturun.`,
        expected: "Takip planı, ölçüm trendleri ve gelişim skorları anlamlı hale gelir.",
        actionLabel: "Program Oluştur",
        actionType: "ui",
        actionValue: "open-builder",
      };
    }

    if (context.programAge !== null && context.programAge > 21) {
      return {
        title: "Program gözden geçirilmeli",
        text: "Program kaydı var ancak revizyon tarihi yaklaşıyor.",
        why: "Aynı programın uzun süre değişmeden sürmesi adaptasyonu yavaşlatabilir.",
        what: "Program hacmi, set/tekrar ve kardiyo dengesini son ölçüme göre kontrol edin.",
        expected: "Program hedefe daha yakın ve sürdürülebilir hale gelir.",
        actionLabel: "Programı Gözden Geçir",
        actionType: "ui",
        actionValue: "open-builder",
      };
    }

    if (context.isFatGoal && Number.isFinite(context.bodyFat)) {
      return {
        title: "Yağ kaybı ritmi korunmalı",
        text: "Ölçüm güncel ve program var; yağ oranı hedefe göre izlenmeli.",
        why: "Yağ kaybı hedefinde direnç, kardiyo ve beslenme aynı yönde ilerlemeli.",
        what: "Programı son ölçüme göre gözden geçirip kardiyo hacmini kontrollü ayarlayın.",
        expected: "Kas kaybı riski düşerken yağ kaybı takibi daha net ilerler.",
        actionLabel: "Programı Gözden Geçir",
        actionType: "ui",
        actionValue: "open-builder",
      };
    }

    if (context.isMuscleGoal && Number.isFinite(context.muscleMass)) {
      return {
        title: "Kas gelişimi takip edilmeli",
        text: "Ölçüm güncel ve program var; yüklenme-toparlanma dengesi izlenmeli.",
        why: "Kas kazanımı hedefinde program hacmi, protein ve uyku aynı anda takip edilmeli.",
        what: "Programı son ölçüm ve performans notuna göre gözden geçirin.",
        expected: "Kas kütlesi korunur veya kademeli artış için daha net takip sağlanır.",
        actionLabel: "Programı Gözden Geçir",
        actionType: "ui",
        actionValue: "open-builder",
      };
    }

    return {
      title: context.nextAction || "Programı gözden geçir",
      text: "Ölçüm ve program güncel; koçluk takibi sürdürülmeli.",
      why: "Sistem kritik eksik görmüyor, bu nedenle düzenli kontrol yeterli.",
      what: "Üye geçmişini ve son program çıktısını birlikte kontrol edin.",
      expected: "Takip sürdürülebilir kalır ve küçük sapmalar erken yakalanır.",
      actionLabel: "Üye Geçmişini Gör",
      actionType: "ui",
      actionValue: "compare",
    };
  }

  function buildV3ScoreCards(context) {
    return [
      {
        label: "V3 Hazırlık Skoru",
        value: context.readinessScore,
        text: context.summary || "Üyenin ölçüm, program ve takip verileri birlikte değerlendirildi.",
        tone: resolveV3ScoreTone(context.readinessScore),
      },
      {
        label: "Veri Kalitesi",
        value: context.dataQualityScore,
        text: `${context.measurementCount} ölçüm · ${context.programCount} program kaydı`,
        tone: resolveV3ScoreTone(context.dataQualityScore),
      },
      {
        label: "Takip Sürekliliği",
        value: context.continuityScore,
        text: `Ölçüm: ${formatV3AgeClean(context.measurementAge)} · Program: ${formatV3AgeClean(context.programAge)}`,
        tone: resolveV3ScoreTone(context.continuityScore),
      },
      {
        label: "Koç Önceliği",
        value: context.coachingPriorityScore,
        text: "Yüksek değer daha yakın koç takibi gerektiğini gösterir.",
        tone: context.coachingPriorityScore >= 70 ? "danger" : context.coachingPriorityScore >= 45 ? "attention" : "good",
      },
    ];
  }

  function renderV3LeanDecisionCenter(model, escapeHtml) {
    const cards = [
      {
        label: "Genel V3 Skoru",
        value: `${model.readinessScore}/100`,
        text: resolveV3StatusLabel(model.readinessScore),
        tone: resolveV3ScoreTone(model.readinessScore),
      },
      {
        label: "Risk Durumu",
        value: model.riskState.label,
        text: model.riskState.text,
        tone: model.riskState.tone,
      },
      {
        label: "Veri Kalitesi",
        value: `${model.dataQualityScore}/100`,
        text: `${model.measurementCount} ölçüm · ${model.programCount} program`,
        tone: resolveV3ScoreTone(model.dataQualityScore),
      },
      {
        label: "Sonraki En Doğru Adım",
        value: model.priorityAction.actionLabel,
        text: model.priorityAction.title,
        tone: "violet",
        action: model.priorityAction,
      },
    ];

    return `
      <section class="v3-lean-center">
        <div class="v3-lean-header">
          <div>
            <p class="section-kicker">V3 Koçluk / AI</p>
            <h4>Koçluk Karar Merkezi</h4>
            <span>${escapeHtml(model.memberName || "Aktif üye")} için ölçüm, program ve risk durumu tek ekranda özetlenir.</span>
          </div>
          <em>Son güncelleme: ${escapeHtml(new Date().toLocaleDateString("tr-TR"))}</em>
        </div>
        <div class="v3-lean-summary-grid">
          ${cards.map((card) => renderV3LeanScoreCard(card, escapeHtml)).join("")}
        </div>
      </section>
    `;
  }

  function renderV3LeanScoreCard(card, escapeHtml) {
    const action = card.action
      ? `<button type="button" class="v3-card-cta" ${renderV3ActionAttribute(card.action)}>${escapeHtml(card.action.actionLabel)}</button>`
      : "";

    return `
      <article class="v3-lean-score-card v3-lean-score-card--${escapeHtml(card.tone)}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <p>${escapeHtml(card.text)}</p>
        ${action}
      </article>
    `;
  }

  function renderV3MainRecommendation(model, escapeHtml) {
    const recommendation = model.priorityAction;

    return `
      <section class="v3-main-recommendation">
        <div class="v3-main-recommendation__badge">Bugünkü Öncelik</div>
        <div class="v3-main-recommendation__content">
          <div>
            <p class="section-kicker">Ana Koçluk Önerisi</p>
            <h4>${escapeHtml(recommendation.title)}</h4>
            <p>${escapeHtml(recommendation.text)}</p>
          </div>
          <div class="v3-main-recommendation__action">
            <button type="button" class="primary-button mini-button" ${renderV3ActionAttribute(recommendation)}>
              ${escapeHtml(recommendation.actionLabel)}
            </button>
          </div>
        </div>
        <div class="v3-recommendation-grid">
          <div><span>Neden?</span><strong>${escapeHtml(recommendation.why || "Ölçüm ve program verileri bu aksiyonu işaret ediyor.")}</strong></div>
          <div><span>Ne yapılacak?</span><strong>${escapeHtml(recommendation.what || "Antrenör tarafından hızlı kontrol yapılacak.")}</strong></div>
          <div><span>Beklenen sonuç</span><strong>${escapeHtml(recommendation.expected || "Takip ve karar kalitesi artar.")}</strong></div>
        </div>
      </section>
    `;
  }

  function renderV3ActionAndChecklist(model, escapeHtml) {
    const actions = [
      {
        title: "Program Oluştur",
        text: model.programCount ? "Programı son ölçüme göre gözden geçir." : "İlk aktif programı oluştur.",
        tone: "orange",
        action: { actionLabel: "Başlat", actionType: "ui", actionValue: "open-builder" },
      },
      {
        title: "Yeni Ölçüm Gir",
        text: "Manuel ölçüm veya Tanita CSV ile güncel veri ekle.",
        tone: "blue",
        action: { actionLabel: "Ölçüm Aç", actionType: "v3", actionValue: "open-measurement" },
      },
      {
        title: "Rapor Oluştur",
        text: "Son ölçümden üyeye verilecek raporu hazırla.",
        tone: "green",
        action: { actionLabel: "Rapor", actionType: "ui", actionValue: "build-report" },
      },
      {
        title: "Üye Geçmişini Gör",
        text: "Ölçüm ve program geçmişini birlikte incele.",
        tone: "violet",
        action: { actionLabel: "Geçmiş", actionType: "ui", actionValue: "compare" },
      },
    ];
    const checklist = buildV3Checklist(model);

    return `
      <section class="v3-action-check-grid">
        <article class="v3-working-actions-card">
          <div class="v3-card-head">
            <div>
              <p class="section-kicker">Aksiyon Planı</p>
              <h4>Sadece Çalışan Hızlı Aksiyonlar</h4>
            </div>
          </div>
          <div class="v3-working-actions">
            ${actions.map((action) => renderV3ActionTile(action, escapeHtml)).join("")}
          </div>
        </article>
        <article class="v3-checklist-card">
          <div class="v3-card-head">
            <div>
              <p class="section-kicker">Takip Kontrol Listesi</p>
              <h4>Koçun Hızlı Kontrolü</h4>
            </div>
          </div>
          <div class="v3-checklist">
            ${checklist.map((item) => renderV3ChecklistRow(item, escapeHtml)).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderV3ActionTile(item, escapeHtml) {
    return `
      <button type="button" class="v3-action-tile v3-action-tile--${escapeHtml(item.tone)}" ${renderV3ActionAttribute(item.action)}>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.text)}</span>
        <em>${escapeHtml(item.action.actionLabel)}</em>
      </button>
    `;
  }

  function renderV3ChecklistRow(item, escapeHtml) {
    return `
      <div class="v3-checklist-row v3-checklist-row--${escapeHtml(item.tone)}">
        <span>${escapeHtml(item.status)}</span>
        <strong>${escapeHtml(item.label)}</strong>
        <em>${escapeHtml(item.detail)}</em>
      </div>
    `;
  }

  function renderV3AiNoteAndDetails(model, escapeHtml) {
    const bullets = buildV3AiBullets(model);
    const accordionGroups = [
      {
        title: "V3 skor detayları",
        items: [
          `Genel skor: ${model.readinessScore}/100`,
          `Veri kalitesi: ${model.dataQualityScore}/100`,
          `Takip sürekliliği: ${model.continuityScore}/100`,
          `Koç önceliği: ${model.coachingPriorityScore}/100`,
        ],
      },
      { title: "Risk kontrol listesi", items: model.riskControls || [] },
      { title: "Antrenör kontrol notları", items: model.coachChecklist || [] },
      { title: "Revizyon önerileri", items: [model.fitNote, model.revisionNote, ...(model.recommendedActions || [])].filter(Boolean) },
    ];

    return `
      <section class="v3-ai-compact">
        <article class="v3-ai-note-card">
          <div class="v3-card-head">
            <div>
              <p class="section-kicker">Koç Notu / AI Önerisi</p>
              <h4>Bugün İçin Kısa Öneri</h4>
            </div>
            <span class="v3-status-badge v3-status-badge--${escapeHtml(model.riskTone)}">${escapeHtml(model.riskState.label)}</span>
          </div>
          <ol>
            ${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ol>
        </article>
        <article class="v3-accordion-card" id="v3DecisionDetails">
          <div class="v3-card-head">
            <div>
              <p class="section-kicker">Detaylar</p>
              <h4>Varsayılan Kapalı Detaylar</h4>
            </div>
          </div>
          <div class="v3-accordion-stack">
            ${accordionGroups.map((group) => renderV3Accordion(group, escapeHtml)).join("")}
          </div>
        </article>
      </section>
    `;
  }

  function renderV3FollowUpPlan(model, escapeHtml) {
    const nextMeasurementText = !model.measurementCount
      ? "Ölçüm bekleniyor"
      : model.measurementAge !== null && model.measurementAge > 14
        ? "Bugün yeni ölçüm önerilir"
        : "14-21 gün içinde tekrar ölçüm";
    const programText = model.programCount ? "Program takipte" : "İlk program oluşturulmalı";

    return `
      <section class="v3-followup-strip" id="v3ControlFocus">
        <div>
          <span>Takip planı</span>
          <strong>${escapeHtml(nextMeasurementText)}</strong>
        </div>
        <div>
          <span>Program yönlendirmesi</span>
          <strong>${escapeHtml(programText)}</strong>
        </div>
        <div>
          <span>Hedef</span>
          <strong>${escapeHtml(model.goalDefined ? model.goalLabel : "Hedef tanımlanmalı")}</strong>
        </div>
      </section>
    `;
  }

  function buildV3Checklist(model) {
    const measurementFresh = model.measurementCount > 0 && !(model.measurementAge !== null && model.measurementAge > 14);
    const riskNormal = model.riskTone === "good";

    return [
      {
        label: "Ölçüm var mı?",
        detail: model.measurementCount ? `${model.measurementCount} kayıt` : "Ölçüm yok",
        status: model.measurementCount ? "Tamamlandı" : "Eksik",
        tone: model.measurementCount ? "good" : "danger",
      },
      {
        label: "Program var mı?",
        detail: model.programCount ? `${model.programCount} kayıt` : "Program bulunmuyor",
        status: model.programCount ? "Tamamlandı" : "Eksik",
        tone: model.programCount ? "good" : "danger",
      },
      {
        label: "Son ölçüm 14 günü geçti mi?",
        detail: model.measurementAge === null ? "Ölçüm yok" : `${model.measurementAge} gün`,
        status: measurementFresh ? "Tamamlandı" : "Uyarı",
        tone: measurementFresh ? "good" : "attention",
      },
      {
        label: "Hedef tanımlı mı?",
        detail: model.goalDefined ? model.goalLabel : "Hedef yok",
        status: model.goalDefined ? "Tamamlandı" : "Eksik",
        tone: model.goalDefined ? "good" : "danger",
      },
      {
        label: "Risk seviyesi normal mi?",
        detail: model.riskState.label,
        status: riskNormal ? "Tamamlandı" : model.riskTone === "attention" ? "Uyarı" : "Eksik",
        tone: riskNormal ? "good" : model.riskTone,
      },
    ];
  }

  function buildV3AiBullets(model) {
    const bullets = [
      model.priorityAction.what,
      model.priorityAction.expected,
      model.riskTone === "good" ? "Mevcut takip ritmini koruyup bir sonraki kontrolü 14-21 gün içinde planlayın." : model.riskState.text,
    ];

    return bullets.filter(Boolean).slice(0, 3);
  }

  function renderV3DecisionCenter(model, escapeHtml) {
    const decisions = [
      {
        tone: "orange",
        code: "01",
        title: "Bugünkü Öncelik",
        headline: model.priorityAction.title,
        text: model.priorityAction.text,
        action: model.priorityAction,
      },
      {
        tone: "green",
        code: "AI",
        title: "AI Önerisi",
        headline: buildV3AiHeadline(model),
        text: buildV3AiText(model),
        action: { actionLabel: "Programı Güncelle", actionType: "v3", actionValue: "generate-revision" },
      },
      {
        tone: model.riskTone,
        code: "R",
        title: "Risk Durumu",
        headline: `${model.riskLabel || "Belirsiz"} risk`,
        text: buildV3RiskText(model),
        badge: model.riskLabel || "Belirsiz",
      },
      {
        tone: "violet",
        code: "N",
        title: "Sonraki Adım",
        headline: model.programCount ? "Program revizyonu değerlendirilecek." : "Yeni program oluşturulacak.",
        text: model.nextAction || "Ölçüm ve program takibini güncelle.",
        action: { actionLabel: "Program Oluştur", actionType: "v3", actionValue: "generate-revision" },
      },
    ];

    return `
      <section class="v3-decision-center">
        <div class="v3-decision-center__intro">
          <div>
            <p class="section-kicker">V3 Koçluk / AI</p>
            <h4>Koçluk Karar Merkezi</h4>
            <span>${escapeHtml(model.memberName || "Aktif üye")} için risk, veri kalitesi, odak ve sonraki aksiyon tek ekranda özetlenir.</span>
          </div>
          <button type="button" class="ghost-button mini-button" data-measurement-ui-action="focus-v3-calendar">Koçluk Geçmişi</button>
        </div>
        <div class="v3-decision-grid">
          ${decisions.map((item) => renderV3DecisionCard(item, escapeHtml)).join("")}
        </div>
      </section>
    `;
  }

  function renderV3DecisionCard(item, escapeHtml) {
    const actionHtml = item.action
      ? `<button type="button" class="v3-card-cta" ${renderV3ActionAttribute(item.action)}>${escapeHtml(item.action.actionLabel)}</button>`
      : `<span class="v3-status-badge v3-status-badge--${escapeHtml(item.tone)}">${escapeHtml(item.badge || "Aktif")}</span>`;

    return `
      <article class="v3-decision-card v3-decision-card--${escapeHtml(item.tone)}">
        <span class="v3-decision-card__icon">${escapeHtml(item.code)}</span>
        <small>${escapeHtml(item.title)}</small>
        <strong>${escapeHtml(item.headline)}</strong>
        <p>${escapeHtml(item.text)}</p>
        ${actionHtml}
      </article>
    `;
  }

  function renderV3ScoreDashboard(model, escapeHtml) {
    return `
      <section class="v3-score-dashboard">
        <div class="v3-score-dashboard__head">
          <div>
            <p class="section-kicker">Skorlar</p>
            <h4>V3 Hazırlık ve Takip Kalitesi</h4>
          </div>
          <span class="v3-status-badge v3-status-badge--${escapeHtml(resolveV3ScoreTone(model.readinessScore))}">
            ${escapeHtml(resolveV3StatusLabel(model.readinessScore))}
          </span>
        </div>
        <div class="v3-score-grid v3-score-grid--decision">
          ${model.scoreCards.map((card) => renderV3ScoreTile(card, escapeHtml)).join("")}
        </div>
      </section>
      <section class="v3-focus-projection-grid">
        ${renderV3FocusAreas(model, escapeHtml)}
        ${renderV3Projection(model, escapeHtml)}
      </section>
    `;
  }

  function renderV3ScoreTile(card, escapeHtml) {
    return `
      <article class="v3-score-card v3-score-card--${escapeHtml(card.tone)}">
        <div class="v3-score-card__top">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}/100</strong>
        </div>
        <div class="v3-score-progress" aria-hidden="true">
          <i style="width:${escapeHtml(card.value)}%"></i>
        </div>
        <p>${escapeHtml(card.text)}</p>
      </article>
    `;
  }

  function renderV3FocusAreas(model, escapeHtml) {
    const areas = buildV3FocusAreas(model);

    return `
      <article class="v3-focus-card">
        <div class="v3-card-head">
          <div>
            <p class="section-kicker">Odaklanma Alanları</p>
            <h4>Koçluk Öncelikleri</h4>
          </div>
        </div>
        <div class="v3-focus-list">
          ${areas.map((area) => renderV3FocusRow(area, escapeHtml)).join("")}
        </div>
      </article>
    `;
  }

  function renderV3FocusRow(area, escapeHtml) {
    return `
      <div class="v3-focus-row">
        <span class="v3-focus-row__icon">${escapeHtml(area.code)}</span>
        <div>
          <strong>${escapeHtml(area.title)}</strong>
          <small>${escapeHtml(area.current)} → ${escapeHtml(area.target)}</small>
          <div class="v3-focus-progress" aria-hidden="true"><i style="width:${escapeHtml(area.progress)}%"></i></div>
        </div>
        <em class="v3-priority-badge v3-priority-badge--${escapeHtml(area.tone)}">${escapeHtml(area.priority)}</em>
      </div>
    `;
  }

  function renderV3Projection(model, escapeHtml) {
    const rows = buildV3ProjectionRows(model);

    return `
      <article class="v3-projection-card">
        <div class="v3-card-head">
          <div>
            <p class="section-kicker">Beklenen Etki</p>
            <h4>8 Haftalık Projeksiyon</h4>
          </div>
        </div>
        ${
          rows.length
            ? `<div class="v3-projection-list">${rows.map((row) => renderV3ProjectionRow(row, escapeHtml)).join("")}</div>`
            : `<div class="v3-empty-state">Projeksiyon için en az iki ölçüm gerekir.</div>`
        }
      </article>
    `;
  }

  function renderV3ProjectionRow(row, escapeHtml) {
    return `
      <div class="v3-projection-row">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.from)} → ${escapeHtml(row.to)}</strong>
        <em class="v3-delta v3-delta--${escapeHtml(row.tone)}">${escapeHtml(row.delta)}</em>
      </div>
    `;
  }

  function renderV3ActionPlanning(model, escapeHtml) {
    const actions = buildV3PlannedActions(model);

    return `
      <section class="v3-action-plan-card">
        <div class="v3-card-head">
          <div>
            <p class="section-kicker">Planlanan Aksiyonlar</p>
            <h4>Uygulanabilir Koçluk Listesi</h4>
          </div>
        </div>
        <div class="v3-action-plan-list">
          ${actions.map((action) => renderV3ActionRow(action, escapeHtml)).join("")}
        </div>
      </section>
      <section class="v3-cta-strip">
        <button type="button" class="primary-button mini-button" data-v3-action="generate-revision">Program Oluştur</button>
        <button type="button" class="secondary-button mini-button" data-v3-action="open-measurement">Yeni Ölçüm Gir</button>
        <button type="button" class="ghost-button mini-button" data-measurement-ui-action="focus-v3-calendar">Hatırlatma Ayarla</button>
        <button type="button" class="ghost-button mini-button" data-measurement-ui-action="focus-v3-details">Detaylı Analiz Gör</button>
      </section>
    `;
  }

  function renderV3ActionRow(action, escapeHtml) {
    return `
      <article class="v3-action-row">
        <span class="v3-action-row__status v3-action-row__status--${escapeHtml(action.tone)}">${escapeHtml(action.short)}</span>
        <div>
          <strong>${escapeHtml(action.title)}</strong>
          <small>Başlangıç: ${escapeHtml(action.startDate)} · Durum: ${escapeHtml(action.status)}</small>
        </div>
        <em>${escapeHtml(action.priority)}</em>
      </article>
    `;
  }

  function renderV3CoachingAccordions(model, escapeHtml) {
    const accordionGroups = [
      { title: "AI Revizyon Önerisi", items: [model.fitNote, model.revisionNote].filter(Boolean), open: true },
      { title: "Önerilen Aksiyonlar", items: model.recommendedActions || [] },
      { title: "Antrenör Onay Adımları", items: model.approvalSteps || [] },
      { title: "Risk Kontrol Listesi", items: model.riskControls || [] },
      { title: "Koç Seans Kontrolü", items: model.coachChecklist || [] },
      { title: "Kontrol Takvimi", items: (model.controlTimeline || []).map((item) => `${item.title || "Kontrol"} · ${item.dueAtLabel || "Tarih yok"} · ${item.text || ""}`) },
      { title: "Medya Hazırlığı", items: [model.mediaReadinessText || "Hareket video/görsel alanı V3 için hazır."] },
    ];

    return `
      <section class="v3-accordion-card" id="v3DecisionDetails">
        <div class="v3-card-head">
          <div>
            <p class="section-kicker">Detaylı Koçluk Notları</p>
            <h4>AI Revizyon ve Kontrol Adımları</h4>
          </div>
          <span class="v3-status-badge v3-status-badge--${escapeHtml(model.riskTone)}">${escapeHtml(model.revisionPriority || "Normal")}</span>
        </div>
        <div class="v3-accordion-stack">
          ${accordionGroups.map((group) => renderV3Accordion(group, escapeHtml)).join("")}
        </div>
        <div class="v3-action-bar v3-action-bar--source">
          <button type="button" class="secondary-button mini-button" data-v3-action="generate-revision">Revizyonlu Program Oluştur</button>
          <button type="button" class="ghost-button mini-button" data-v3-action="open-measurement">Yeni Ölçüm Gir</button>
        </div>
      </section>
    `;
  }

  function renderV3Accordion(group, escapeHtml) {
    const items = (group.items || []).filter(Boolean);

    return `
      <details class="v3-ai-accordion" ${group.open ? "open" : ""}>
        <summary>${escapeHtml(group.title)}</summary>
        ${
          items.length
            ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : `<p>Bu başlık için ek aksiyon beklenmiyor.</p>`
        }
      </details>
    `;
  }

  function renderV3ControlCenter(model, escapeHtml) {
    return `
      <section class="v3-control-center-card" id="v3ControlFocus">
        <div class="v3-card-head">
          <div>
            <p class="section-kicker">Kontrol Merkezi</p>
            <h4>Sonraki Takip Adımları</h4>
          </div>
        </div>
        <div class="v3-control-mini-grid">
          <div><span>Son ölçüm</span><strong>${escapeHtml(model.latestMeasurementDate || "Yok")}</strong></div>
          <div><span>Son program</span><strong>${escapeHtml(model.latestProgramDate || "Yok")}</strong></div>
          <div><span>Risk</span><strong>${escapeHtml(model.riskLabel || "Belirsiz")}</strong></div>
        </div>
        <div class="v3-control-note">
          Düzenli ölçüm yapmak, önerilerin doğruluğunu artırır ve hedefe ilerlemeyi daha net gösterir.
        </div>
      </section>
    `;
  }

  function buildV3FocusAreas(model) {
    const { bodyFat, muscleMass, bodyWater } = model.metrics;
    const fatTarget = Number.isFinite(bodyFat) ? Math.max(8, bodyFat - (model.isFatGoal ? 2.4 : 1.2)) : null;
    const muscleTarget = Number.isFinite(muscleMass) ? muscleMass + (model.isMuscleGoal ? 1.8 : 0.8) : null;

    return [
      {
        code: "Y",
        title: "Yağ Oranı",
        current: formatV3Value(bodyFat, "%"),
        target: Number.isFinite(fatTarget) ? `${formatV3Number(fatTarget, 1)}% hedefi` : "Ölçüm bekleniyor",
        priority: model.isFatGoal ? "Yüksek" : "Orta",
        tone: model.isFatGoal ? "danger" : "attention",
        progress: clampV3Score(Number.isFinite(bodyFat) ? 100 - bodyFat * 2 : 35),
      },
      {
        code: "K",
        title: "Kas Kütlesi",
        current: formatV3Value(muscleMass, "kg"),
        target: Number.isFinite(muscleTarget) ? `${formatV3Number(muscleTarget, 1)} kg hedefi` : "Ölçüm bekleniyor",
        priority: model.isMuscleGoal ? "Yüksek" : "Orta",
        tone: model.isMuscleGoal ? "danger" : "attention",
        progress: clampV3Score(Number.isFinite(muscleMass) ? 55 + Math.min(35, muscleMass / 2) : 35),
      },
      {
        code: "C",
        title: "Kardiyo Kapasitesi",
        current: "Program hacmi",
        target: model.isFatGoal ? "Haftalık +%10-15" : "Hedefe göre koru",
        priority: model.isFatGoal ? "Yüksek" : "Orta",
        tone: model.isFatGoal ? "danger" : "attention",
        progress: model.isFatGoal ? 64 : 52,
      },
      {
        code: "B",
        title: "Beslenme Düzeni",
        current: Number.isFinite(model.metrics.bmr) ? `${formatV3Number(model.metrics.bmr, 0)} kcal BMR` : "BMR bekleniyor",
        target: "Protein ve öğün ritmi",
        priority: "Orta",
        tone: "attention",
        progress: 58,
      },
      {
        code: "U",
        title: "Uyku Kalitesi",
        current: "Toparlanma",
        target: "Günlük 7-8 saat",
        priority: model.riskTone === "danger" ? "Orta" : "Düşük",
        tone: model.riskTone === "danger" ? "attention" : "good",
        progress: model.riskTone === "danger" ? 48 : 72,
      },
      {
        code: "T",
        title: "Ölçüm Sürekliliği",
        current: `${model.measurementCount} kayıt`,
        target: "14-21 gün takip",
        priority: model.continuityScore < 55 ? "Yüksek" : "Düşük",
        tone: model.continuityScore < 55 ? "danger" : "good",
        progress: model.continuityScore,
      },
      {
        code: "S",
        title: "Hidrasyon",
        current: formatV3Value(bodyWater, "%"),
        target: "Dengeli su oranı",
        priority: Number.isFinite(bodyWater) && bodyWater < 48 ? "Orta" : "Düşük",
        tone: Number.isFinite(bodyWater) && bodyWater < 48 ? "attention" : "good",
        progress: clampV3Score(Number.isFinite(bodyWater) ? bodyWater + 20 : 40),
      },
    ];
  }

  function buildV3ProjectionRows(model) {
    if (model.measurementCount < 2) {
      return [];
    }

    const rows = [];
    const { weight, bodyFat, muscleMass, bodyWater } = model.metrics;

    if (Number.isFinite(bodyFat)) {
      const target = Math.max(8, bodyFat - (model.isFatGoal ? 2.4 : 1.2));
      rows.push({ label: "Yağ Oranı", from: `${formatV3Number(bodyFat, 1)}%`, to: `${formatV3Number(target, 1)}%`, delta: `${formatV3Number(target - bodyFat, 1)}%`, tone: "good" });
    }

    if (Number.isFinite(muscleMass)) {
      const target = muscleMass + (model.isMuscleGoal ? 1.8 : 0.6);
      rows.push({ label: "Kas Kütlesi", from: `${formatV3Number(muscleMass, 1)} kg`, to: `${formatV3Number(target, 1)} kg`, delta: `+${formatV3Number(target - muscleMass, 1)} kg`, tone: "good" });
    }

    if (Number.isFinite(weight)) {
      const target = weight + (model.isMuscleGoal ? 0.6 : model.isFatGoal ? -1.4 : 0.2);
      rows.push({ label: "Vücut Ağırlığı", from: `${formatV3Number(weight, 1)} kg`, to: `${formatV3Number(target, 1)} kg`, delta: `${target >= weight ? "+" : ""}${formatV3Number(target - weight, 1)} kg`, tone: model.isFatGoal || model.isMuscleGoal ? "good" : "neutral" });
    }

    if (Number.isFinite(bodyWater)) {
      const target = Math.max(bodyWater, Math.min(58, bodyWater + 1));
      rows.push({ label: "Vücut Suyu", from: `${formatV3Number(bodyWater, 1)}%`, to: `${formatV3Number(target, 1)}%`, delta: `${target >= bodyWater ? "+" : ""}${formatV3Number(target - bodyWater, 1)}%`, tone: "neutral" });
    }

    rows.push({ label: "V3 Skoru", from: `${model.readinessScore}`, to: `${Math.min(100, model.readinessScore + 10)}`, delta: "+10 puan", tone: "good" });
    return rows.slice(0, 5);
  }

  function buildV3PlannedActions(model) {
    const recommended = (model.recommendedActions || []).filter(Boolean);
    const baseActions = [
      recommended[0] || model.priorityAction.title || "Ölçüm ve program takibini güncelle.",
      model.isFatGoal ? "Kardiyo süresini hedefe göre artır." : "Direnç antrenmanı yüklenmesini kontrol et.",
      "Protein alımını ve öğün ritmini optimize et.",
      "Yeni ölçüm hatırlatması oluştur.",
    ];
    const uniqueActions = Array.from(new Set(baseActions.filter(Boolean))).slice(0, 5);

    return uniqueActions.map((title, index) => ({
      title,
      short: index === 0 ? "Aktif" : index === 1 ? "Plan" : "Takip",
      status: index === 0 ? "Aktif" : index === 1 ? "Planlandı" : "Beklemede",
      priority: index === 0 ? (model.riskTone === "danger" ? "Yüksek" : "Orta") : index === 3 ? "Düşük" : "Orta",
      tone: index === 0 ? model.riskTone : index === 3 ? "good" : "attention",
      startDate: model.latestMeasurementDate || "Bugün",
    }));
  }

  function buildV3AiHeadline(model) {
    if (model.isFatGoal) {
      return "Kardiyo hacmini kontrollü artır.";
    }

    if (model.isMuscleGoal) {
      return "Yüklenme ve protein hedefini hizala.";
    }

    return "Takip ritmini sabitle.";
  }

  function buildV3AiText(model) {
    if (model.isFatGoal) {
      return "Yağ kaybı için direnç antrenmanı korunurken kardiyo hacmi kademeli artırılabilir.";
    }

    if (model.isMuscleGoal) {
      return "Kas kazanımı için progresif yüklenme, toparlanma ve protein planı birlikte izlenmeli.";
    }

    return "Ölçüm, program ve beslenme verileri aynı takvimde güncel tutulmalı.";
  }

  function buildV3RiskText(model) {
    if (model.riskTone === "danger") {
      return "Yakın takip, teknik kontrol ve ölçüm güncellemesi önerilir.";
    }

    if (model.riskTone === "attention") {
      return "Düzenli takip sürerse risk yönetilebilir seviyede kalır.";
    }

    return "Mevcut takip düzeni güvenli aralıkta görünüyor.";
  }

  function renderV3ActionAttribute(action) {
    if (action.actionType === "v3") {
      return `data-v3-action="${action.actionValue}"`;
    }

    return `data-measurement-ui-action="${action.actionValue}"`;
  }

  function readV3MeasurementNumber(source, keys) {
    for (const key of keys) {
      const value = source?.[key];
      if (value === null || value === undefined || value === "") {
        continue;
      }
      const numeric = Number(String(value ?? "").replace(",", "."));

      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }

    return null;
  }

  function clampV3Score(value) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function resolveV3ScoreTone(score) {
    if (score >= 75) return "good";
    if (score >= 50) return "attention";
    return "danger";
  }

  function resolveV3RiskTone(riskLabel) {
    const label = String(riskLabel || "").toLocaleLowerCase("tr");

    if (/yüksek|yuksek|kritik|riskli/.test(label)) return "danger";
    if (/orta|dikkat/.test(label)) return "attention";
    if (/düşük|dusuk|iyi/.test(label)) return "good";
    return "neutral";
  }

  function resolveV3StatusLabel(score) {
    if (score >= 75) return "İyi";
    if (score >= 50) return "Orta";
    return "Takip Gerekir";
  }

  function formatV3AgeClean(age) {
    if (age === null || age === undefined || Number.isNaN(Number(age))) {
      return "yok";
    }

    if (Number(age) <= 0) {
      return "bugün";
    }

    return `${Number(age)} gün`;
  }

  function formatV3Number(value, digits = 1) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return "Veri yok";
    }

    return numeric.toLocaleString("tr-TR", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits > 0 ? 1 : 0,
    });
  }

  function formatV3Value(value, unit) {
    if (!Number.isFinite(Number(value))) {
      return "Veri yok";
    }

    return `${formatV3Number(value, unit === "kg" || unit === "%" ? 1 : 0)} ${unit}`;
  }

  window.BSMMemberUI = {
    renderActiveMemberProfile,
    renderMemberList,
    renderMeasurementHistory,
    renderProgramHistory,
    renderV3CoachingPanel,
  };
})();
