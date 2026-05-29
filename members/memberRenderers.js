// memberRenderers.js — Refactor Adım 4B.2.1 (STRICT MECHANICAL).
// Saf member render fonksiyonlari app.js'den BIREBIR tasindi. Davranis degisikligi YOK;
// model build, render call sequence, DOM mutation birebir korundu.
//
// KAPSAM ICI (3 render fn + 1 inline helper):
//   - renderActiveMemberProfile() — aktif uye profil karti (BSMMemberUI'a delege)
//   - renderMemberList()          — uye listesi (filtre + sort + BSMMemberUI'a delege)
//   - renderMembersKpiStrip()     — KPI strip (toplam/olcum/program/beslenme sayilari)
//   - formatMembersKpiDate()      — inline helper (sadece KpiStrip kullaniyor)
//
// KAPSAM DISI (app.js'de KALIYOR — renderProgram precedent, cross-domain orchestrator):
//   - renderMemberWorkspace (13 render fn orchestrator, 4 cross-domain)
//   - renderWorkspacePanels (renderMeasurementHistory + renderProgramHistory cross-domain)
//   - renderWorkspaceHero / renderUtilityPanel (4B.2.2'ye birakildi)
//
// Cagrı siteleri app.js icinde (renderMemberWorkspace + renderWorkspacePanels) →
// orchestrator'lar window.BSMMemberRenderers.X cagirir (wrapper gerekmez).
//
// Dependency injection (10 madde + domRefs — koddan dogrulanmis):
//   state, normalizeText, labelMaps, escapeHtml,
//   findActiveMember (cb), getMemberAnalysis (cb), sortMembersForList (cb),
//   normalizeMemberSort (cb), renderActiveMemberProfileUi (BSMMemberUI),
//   renderMemberListUi (BSMMemberUI),
//   domRefs{ activeMemberProfile, memberList, memberCount, memberSort, memberSearch }

(function () {
  "use strict";

  var _state = null;
  var _normalizeText = function (s) { return String(s || "").toLowerCase(); };
  var _labelMaps = {};
  var _escapeHtml = function (s) { return String(s == null ? "" : s); };
  var _findActiveMember = function () { return null; };
  var _getMemberAnalysis = function () { return null; };
  var _sortMembersForList = function (m) { return m; };
  var _normalizeMemberSort = function (v) { return v; };
  var _renderActiveMemberProfileUi = function () {};
  var _renderMemberListUi = function () {};
  var _domRefs = {};
  // 4B.2.2 — Hero/Utility callback'leri (app.js'de kalan helper'lar)
  var _buildMemberInitials = function () { return "BSM"; };
  var _relativeTimeShort = function () { return ""; };
  var _getMemberAccent = function () { return { from: "#1d6b74", to: "#082b35" }; };
  var _computeWizardStepStates = function () { return {}; };
  var _wizardSteps = [];

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.normalizeText === "function") _normalizeText = deps.normalizeText;
    if (deps.labelMaps) _labelMaps = deps.labelMaps;
    if (typeof deps.escapeHtml === "function") _escapeHtml = deps.escapeHtml;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.getMemberAnalysis === "function") _getMemberAnalysis = deps.getMemberAnalysis;
    if (typeof deps.sortMembersForList === "function") _sortMembersForList = deps.sortMembersForList;
    if (typeof deps.normalizeMemberSort === "function") _normalizeMemberSort = deps.normalizeMemberSort;
    if (typeof deps.renderActiveMemberProfileUi === "function") _renderActiveMemberProfileUi = deps.renderActiveMemberProfileUi;
    if (typeof deps.renderMemberListUi === "function") _renderMemberListUi = deps.renderMemberListUi;
    if (deps.domRefs) _domRefs = deps.domRefs;
    if (typeof deps.buildMemberInitials === "function") _buildMemberInitials = deps.buildMemberInitials;
    if (typeof deps.relativeTimeShort === "function") _relativeTimeShort = deps.relativeTimeShort;
    if (typeof deps.getMemberAccent === "function") _getMemberAccent = deps.getMemberAccent;
    if (typeof deps.computeWizardStepStates === "function") _computeWizardStepStates = deps.computeWizardStepStates;
    if (Array.isArray(deps.wizardSteps)) _wizardSteps = deps.wizardSteps;
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderActiveMemberProfile — aktif uye profil karti (app.js:5928 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function renderActiveMemberProfile() {
    const member = _findActiveMember();
    const activeAnalysis = _getMemberAnalysis(member);
    const activeProfileData = member?.profile || {};
    const latestMeasurementRecord = member?.measurements?.[0] || null;
    const latestProgramRecord = member?.programs?.[0]?.program || null;
    const profileModel = member
      ? {
          memberName: activeProfileData.memberName || "İsimsiz Üye",
          memberCode: activeProfileData.memberCode || "Üye no yok",
          trainerName: activeProfileData.trainerName || "Antrenör yok",
          levelLabel: _labelMaps.level[activeProfileData.level] || "Seviye yok",
          goalLabel: _labelMaps.goal[activeProfileData.goal] || "Belirtilmedi",
          latestMeasurementDate: latestMeasurementRecord?.date || "Yok",
          programStatus: latestProgramRecord ? "Aktif" : "Yok",
          riskText: activeProfileData.restrictions?.length
            ? activeProfileData.restrictions.map((item) => _labelMaps.restrictions[item]).join(", ")
            : "Özel uyarı yok",
          score: `${activeAnalysis?.score ?? 0}/100`,
          goalFitScore: `${activeAnalysis?.goalFitScore ?? 0}/100`,
          riskLevel: activeAnalysis?.riskLevel || "Belirsiz",
          summary: activeAnalysis?.summary || "Analiz için ölçüm ve üye bilgisi bekleniyor.",
          trendText: activeAnalysis?.trend?.text || "Trend için en az iki ölçüm gerekir.",
          programSuitability: activeAnalysis?.programSuitability || "Program uygunluğu için kayıt bekleniyor.",
          revisionNote: activeAnalysis?.revisionNote || "Revizyon notu ölçüm trendine göre oluşur.",
          nextAction: activeAnalysis?.nextAction || "Ölçüm ve program takibini başlat.",
          lastThreeMeasurements: (activeAnalysis?.measurementSummary || []).map((item) => ({
            date: item.date,
            summary: `${item.weight} • Yağ: ${item.fat} • Kas: ${item.muscleMass}`,
          })),
          warnings: (activeAnalysis?.coachAlerts || []).slice(0, 3),
        }
      : null;
    _renderActiveMemberProfileUi(_domRefs.activeMemberProfile, profileModel, _escapeHtml);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderMemberList — uye listesi filtre + sort (app.js:5965 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function renderMemberList() {
    const searchText = _normalizeText(_domRefs.memberSearch.value);
    const filteredMembers = _state.members.filter((member) => {
      const profile = member.profile || {};
      const haystack = [
        profile.memberName,
        profile.memberCode,
        profile.trainerName,
        _labelMaps.goal[profile.goal],
        _labelMaps.level[profile.level],
      ]
        .filter(Boolean)
        .join(" ");

      return !searchText || _normalizeText(haystack).includes(searchText);
    });
    const sortedMembers = _sortMembersForList(filteredMembers, _state.activeMemberSort);
    const listModel = {
      totalCount: _state.members.length,
      activeSort: _normalizeMemberSort(_state.activeMemberSort),
      items: sortedMembers.map((member) => {
        const profile = member.profile || {};
        const isActive = member.id === _state.activeMemberId;
        const lastMeasurement = member.measurements?.[0];
        const lastProgram = member.programs?.[0];

        return {
          memberId: member.id,
          isActive,
          memberName: profile.memberName || "İsimsiz Üye",
          memberCode: profile.memberCode || "Üye no yok",
          goalLabel: _labelMaps.goal[profile.goal] || "Hedef yok",
          measurementText: lastMeasurement ? `Son ölçüm: ${lastMeasurement.date}` : "Ölçüm kaydı yok",
          programText: lastProgram ? "Program geçmişi var" : "Program kaydı yok",
          actionLabel: isActive ? "Aktif" : "Yükle",
          photo: profile.photo || null,
        };
      }),
    };
    _renderMemberListUi(
      {
        memberList: _domRefs.memberList,
        memberCount: _domRefs.memberCount,
        memberSort: _domRefs.memberSort,
      },
      listModel,
      _escapeHtml,
    );
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderMembersKpiStrip — KPI strip (app.js:5067 birebir)
  // ═══════════════════════════════════════════════════════════════════
  function renderMembersKpiStrip() {
    const totalEl = document.querySelector("#membersKpiTotal");
    const measuredEl = document.querySelector("#membersKpiMeasured");
    const measuredMetaEl = document.querySelector("#membersKpiMeasuredMeta");
    const programsEl = document.querySelector("#membersKpiPrograms");
    const programsMetaEl = document.querySelector("#membersKpiProgramsMeta");
    const nutritionEl = document.querySelector("#membersKpiNutrition");
    const nutritionMetaEl = document.querySelector("#membersKpiNutritionMeta");
    const lastNameEl = document.querySelector("#membersKpiLastUpdate");
    const lastMetaEl = document.querySelector("#membersKpiLastUpdateMeta");

    if (!totalEl) return;

    const members = Array.isArray(_state.members) ? _state.members : [];
    const total = members.length;
    const measuredCount = members.filter((m) => Array.isArray(m?.measurements) && m.measurements.length > 0).length;
    const programCount = members.filter((m) => Array.isArray(m?.programs) && m.programs.length > 0).length;
    const nutritionCount = members.filter((m) => {
      if (m?.nutritionPlan) return true;
      return Array.isArray(m?.nutritionPlans) && m.nutritionPlans.length > 0;
    }).length;

    totalEl.textContent = String(total);

    measuredEl.textContent = String(measuredCount);
    if (measuredMetaEl) {
      measuredMetaEl.textContent = total > 0 ? `${total} üyeden ${measuredCount}` : "Henüz ölçüm yok";
    }

    programsEl.textContent = String(programCount);
    if (programsMetaEl) {
      programsMetaEl.textContent = total > 0 ? `${total} üyeden ${programCount}` : "Henüz program yok";
    }

    nutritionEl.textContent = String(nutritionCount);
    if (nutritionMetaEl) {
      nutritionMetaEl.textContent = total > 0 ? `${total} üyeden ${nutritionCount}` : "Henüz beslenme planı yok";
    }

    let latest = null;
    members.forEach((m) => {
      const stamp = m?.updatedAt || m?.createdAt;
      if (!stamp) return;
      const time = new Date(stamp).getTime();
      if (Number.isNaN(time)) return;
      if (!latest || time > latest.time) {
        latest = { time, name: m?.profile?.memberName || m?.profile?.memberCode || "Üye", stamp };
      }
    });

    if (latest) {
      lastNameEl.textContent = latest.name;
      if (lastMetaEl) {
        lastMetaEl.textContent = formatMembersKpiDate(latest.stamp);
      }
    } else {
      lastNameEl.textContent = "-";
      if (lastMetaEl) lastMetaEl.textContent = "Henüz güncelleme yok";
    }
  }

  // ── formatMembersKpiDate — inline helper (app.js:5128 birebir) ──────
  function formatMembersKpiDate(value) {
    if (!value) return "Tarih yok";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    try {
      return parsed.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderWorkspaceHero — workspace hero karti (app.js:4148 birebir, 4B.2.2)
  // countCompletedWizardSteps + BSM_WIZARD_STEPS + buildMemberInitials +
  // relativeTimeShort + getMemberAccent callback'leri ile.
  // ═══════════════════════════════════════════════════════════════════
  function renderWorkspaceHero() {
    const host = document.querySelector("#bsmWorkspaceHero");
    if (!host) return;
    const member = _findActiveMember();
    if (!member) {
      host.innerHTML = `
      <div class="bsm-hero-empty">
        <strong>Aktif üye seçilmedi</strong>
        <span>Sol panelden bir üye seçtiğinizde profili burada görüntülenecek.</span>
      </div>
    `;
      return;
    }

    const profile = member.profile || {};
    const goalLabel = _labelMaps.goal[profile.goal] || "Hedef belirtilmedi";
    const initials = _buildMemberInitials(profile.memberName, profile.memberCode);
    const photo = profile.photo || null;
    const lastUpdate = _relativeTimeShort(member.updatedAt || member.createdAt);
    const completedCount = countCompletedWizardSteps(member);
    const progressPct = Math.round((completedCount / _wizardSteps.length) * 100);
    const memberStatus = member.measurements?.length > 0 ? "Aktif Üye" : "Yeni Üye";

    const accent = _getMemberAccent(member);
    const accentStyle = `background: linear-gradient(135deg, ${accent.from} 0%, ${accent.to} 100%)`;

    host.innerHTML = `
    <div class="bsm-hero-card" data-member-id="${_escapeHtml(member.id)}">
      <button type="button" class="bsm-hero-card__avatar" data-photo-edit="${_escapeHtml(member.id)}" aria-label="Profil fotoğrafını değiştir" title="Profil fotoğrafını değiştir" style="${photo ? "" : accentStyle}">
        ${photo
          ? `<img src="${_escapeHtml(photo)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
          : `<span class="bsm-hero-card__initials">${_escapeHtml(initials)}</span>`}
        <span class="bsm-hero-card__edit" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </span>
      </button>
      <div class="bsm-hero-card__body">
        <div class="bsm-hero-card__title">
          <h3>${_escapeHtml(profile.memberName || "İsimsiz Üye")}</h3>
          <span class="bsm-pill bsm-pill--${memberStatus === "Aktif Üye" ? "active" : "warning"}">${_escapeHtml(memberStatus)}</span>
        </div>
        <p class="bsm-hero-card__goal">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
          <span>Hedef: <strong>${_escapeHtml(goalLabel)}</strong></span>
        </p>
        <p class="bsm-hero-card__meta">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>Son güncelleme: ${_escapeHtml(lastUpdate)}</span>
        </p>
      </div>
      <div class="bsm-hero-card__progress">
        <div class="bsm-hero-card__progress-head">
          <span>Genel İlerleme</span>
          <strong>%${progressPct}</strong>
        </div>
        <div class="bsm-hero-card__progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}">
          <span class="bsm-hero-card__progress-fill" style="width: ${progressPct}%"></span>
        </div>
        <small>${completedCount} / ${_wizardSteps.length} adım tamamlandı</small>
      </div>
    </div>
  `;
  }

  // ── countCompletedWizardSteps — inline helper (app.js:4212 birebir) ──
  function countCompletedWizardSteps(member) {
    const states = _computeWizardStepStates(member);
    return Object.values(states).filter((v) => v === "completed").length;
  }

  // ═══════════════════════════════════════════════════════════════════
  // renderUtilityPanel — hizli durum + islemler (app.js:4921 birebir, 4B.2.2)
  // ═══════════════════════════════════════════════════════════════════
  function renderUtilityPanel() {
    const host = document.querySelector("#bsmUtilityPanel");
    if (!host) return;
    const member = _findActiveMember();
    if (!member) {
      host.innerHTML = "";
      return;
    }
    const states = _computeWizardStepStates(member);

    const statusRow = (id, label) => {
      const s = states[id] || "pending";
      const ok = s === "completed";
      return `
      <li class="bsm-status-row ${ok ? "is-ok" : "is-pending"}">
        <span class="bsm-status-row__icon" aria-hidden="true">
          ${ok
            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>`}
        </span>
        <span class="bsm-status-row__label">${_escapeHtml(label)}</span>
        <span class="bsm-status-row__state">${ok ? "Tamamlandı" : "Eksik"}</span>
      </li>
    `;
    };

    host.innerHTML = `
    <article class="bsm-utility-card bsm-utility-card--status">
      <header class="bsm-utility-card__head">
        <h4>Hızlı Durum</h4>
      </header>
      <ul class="bsm-status-list">
        ${statusRow("olcum", "Ölçüm")}
        ${statusRow("program", "Program")}
        ${statusRow("beslenme", "Beslenme")}
        ${statusRow("pdf", "PDF Çıktısı")}
        ${statusRow("mail", "Mail Gönder")}
      </ul>
    </article>

    <article class="bsm-utility-card bsm-utility-card--actions">
      <header class="bsm-utility-card__head">
        <h4>Hızlı İşlemler</h4>
      </header>
      <div class="bsm-action-list">
        <button type="button" class="bsm-action-btn bsm-action-btn--blue" data-utility-action="olcum">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h3l3-9 4 18 3-9h5"></path></svg>
          <span>Ölçüm Güncelle</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--orange" data-utility-action="program">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4v16"></path><path d="M18 4v16"></path><path d="M2 8h4"></path><path d="M2 16h4"></path><path d="M18 8h4"></path><path d="M18 16h4"></path><path d="M6 12h12"></path></svg>
          <span>Program Oluştur</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--green" data-utility-action="beslenme">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2v20"></path><path d="M5 2v6a3 3 0 0 0 6 0V2"></path><path d="M18 2v20"></path><path d="M15 2c0 4 3 4 3 8"></path></svg>
          <span>Beslenme Planı</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--purple" data-utility-action="pdf">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span>PDF Oluştur</span>
        </button>
        <button type="button" class="bsm-action-btn bsm-action-btn--cyan" data-utility-action="mail">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          <span>Mail Gönder</span>
        </button>
      </div>
    </article>

    <button type="button" class="bsm-utility-deactivate" disabled aria-disabled="true" title="Bu özellik gelecek sprintte aktif edilecek">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
      <span>Üyeyi Pasif Yap</span>
    </button>
  `;
  }

  window.BSMMemberRenderers = {
    init: init,
    renderActiveMemberProfile: renderActiveMemberProfile,
    renderMemberList: renderMemberList,
    renderMembersKpiStrip: renderMembersKpiStrip,
    renderWorkspaceHero: renderWorkspaceHero,
    renderUtilityPanel: renderUtilityPanel,
  };
})();
