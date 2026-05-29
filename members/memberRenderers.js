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

  window.BSMMemberRenderers = {
    init: init,
    renderActiveMemberProfile: renderActiveMemberProfile,
    renderMemberList: renderMemberList,
    renderMembersKpiStrip: renderMembersKpiStrip,
  };
})();
