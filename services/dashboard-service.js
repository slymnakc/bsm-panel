(function () {
  "use strict";

  function buildActivityItems(members, formatMeasurementLine) {
    const items = [];

    (members || []).forEach((member) => {
      const name = member.profile?.memberName || "Üye";

      (member.programs || []).forEach((record) => {
        items.push({
          date: record.program?.createdAt || record.savedAt || member.updatedAt,
          title: `${name} için program kaydı`,
          meta: record.savedAt || record.program?.createdAt || "Tarih yok",
        });
      });

      (member.measurements || []).forEach((measurement) => {
        items.push({
          date: measurement.date,
          title: `${name} ölçüm kaydı`,
          meta: formatMeasurementLine(measurement),
        });
      });
    });

    return items.sort((a, b) => String(b.date).localeCompare(String(a.date), "tr"));
  }

  function buildFallbackMemberAnalysis(member, labelMaps) {
    const profile = member.profile || {};
    const latestMeasurement = member.measurements?.[0] || null;
    const hasRestrictions = (profile.restrictions || []).length > 0;
    const hasMeasurements = (member.measurements || []).length > 0;

    return {
      score: hasMeasurements ? (hasRestrictions ? 68 : 76) : 55,
      goalFitScore: hasMeasurements ? 64 : 48,
      riskLevel: hasRestrictions || !hasMeasurements ? "Orta" : "Düşük",
      summary: hasMeasurements
        ? "Yerel analiz motoru kullanılamadığı için temel profil ve son ölçüm bilgisine göre özet oluşturuldu."
        : "Ölçüm kaydı olmadığı için analiz başlangıç seviyesinde.",
      trend: {
        text: latestMeasurement ? "Trend için en az iki ölçüm gerekir." : "Henüz ölçüm kaydı yok.",
        items: [],
        weight: { direction: "unknown", text: "Kilo verisi yok." },
        fat: { direction: "unknown", text: "Yağ oranı verisi yok." },
        muscle: { direction: "unknown", text: "Kas kütlesi verisi yok." },
      },
      coachAlerts: [],
      strengths: ["Temel üye dosyası hazır."],
      riskAreas: hasRestrictions ? ["Hassasiyet bildirimi var."] : [],
      focusAreas: ["Düzenli ölçüm ve program takibi sürdürülmeli."],
      nextAction: hasMeasurements ? "Programı ölçüm trendine göre takip et." : "İlk segmental ölçümü gir.",
      measurementSummary: [],
      programSuitability: "Temel uygunluk notu için analiz motoru bekleniyor.",
      revisionNote: "Program revizyonu ölçüm trendiyle birlikte yapılmalı.",
      warnings: [],
      tags: ["Temel analiz"],
      goalComment: labelMaps.goal[profile.goal] ? `${labelMaps.goal[profile.goal]} hedefi takip ediliyor.` : "Hedef bilgisi bekleniyor.",
    };
  }

  function buildFallbackAutomationSummary(latestItems) {
    return {
      records: [],
      riskMemberCount: 0,
      measurementDueCount: 0,
      programUpdateDueCount: 0,
      last7DaysActivityCount: (latestItems || []).filter((item) => {
        const date = new Date(item.date);
        if (Number.isNaN(date.getTime())) {
          return false;
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return date >= sevenDaysAgo;
      }).length,
    };
  }

  function buildCoachTasks(members, automationRecords, getMemberAnalysis) {
    const tasks = [];
    const dedupe = new Set();

    const pushTask = (task) => {
      const key = `${task.memberId}-${task.title}`;
      if (dedupe.has(key)) {
        return;
      }
      dedupe.add(key);
      tasks.push(task);
    };

    (members || []).forEach((member) => {
      const analysis = getMemberAnalysis(member);
      const memberName = member.profile?.memberName || member.profile?.memberCode || "Üye";
      const hasProgram = (member.programs || []).length > 0;
      const hasMeasurement = (member.measurements || []).length > 0;

      if (!hasProgram) {
        pushTask({
          memberId: member.id,
          memberName,
          title: "İlk programı oluştur",
          text: "Üye için kayıtlı program yok. Profil bilgilerini kontrol edip ilk planı oluşturun.",
          badge: "Yüksek öncelik",
          priority: 95,
          tone: "danger",
          workspace: "members",
          actionLabel: "Üye aç",
        });
      }

      if (hasProgram && !hasMeasurement) {
        pushTask({
          memberId: member.id,
          memberName,
          title: "İlk ölçümü al",
          text: "Program var ama ölçüm yok. İlk segmental ölçüm alınırsa takip daha doğru başlar.",
          badge: "Ölçüm",
          priority: 92,
          tone: "warning",
          workspace: "measurements",
          actionLabel: "Ölçüm aç",
        });
      }

      if (analysis?.riskLevel === "Yüksek") {
        pushTask({
          memberId: member.id,
          memberName,
          title: "Yüksek riskli üyeyi gözden geçir",
          text: analysis.nextAction || "Risk seviyesi yüksek görünüyor. V3 koçluk dosyasından revizyon önerilerini kontrol edin.",
          badge: "Risk",
          priority: 97,
          tone: "danger",
          workspace: "v3",
          actionLabel: "V3 aç",
        });
      }
    });

    (automationRecords || []).forEach((record) => {
      const workspace =
        record.type === "measurement-reminder" || record.type === "measurement-missing"
          ? "measurements"
          : record.type === "program-revision" || record.type === "next-control"
            ? "v3"
            : "members";

      pushTask({
        memberId: record.memberId || "",
        memberName: record.memberName || "Üye",
        title: record.title || "Koç görevi",
        text: record.message || "Takip panelinden ilgili üyeyi açın.",
        badge: record.severity === "warning" ? "Takip" : "Bilgi",
        priority: record.severity === "warning" ? 88 : 72,
        tone: record.severity === "warning" ? "warning" : "default",
        workspace,
        actionLabel: workspace === "measurements" ? "Ölçüm aç" : workspace === "v3" ? "V3 aç" : "Üye aç",
      });
    });

    return tasks.sort((a, b) => b.priority - a.priority || a.memberName.localeCompare(b.memberName, "tr"));
  }

  function buildCoachQuickPanelModel(activeMember, getMemberAnalysis, getDayLabel) {
    if (!activeMember) {
      return null;
    }

    const profile = activeMember.profile || {};
    const latestMeasurement = activeMember.measurements?.[0] || null;
    const latestProgramRecord = activeMember.programs?.[0] || null;
    const analysis = getMemberAnalysis(activeMember);
    const trainingDays = (profile.days || []).map((day) => getDayLabel(day)).join(", ") || "Henüz gün seçilmedi";
    const nextAction = analysis?.nextAction || (latestProgramRecord
      ? latestMeasurement
        ? "Mevcut programı güncelle ve yeni ölçüm trendini takip et"
        : "İlk ölçümü kaydederek program takibini başlat"
      : "Programı oluşturup üyeye kaydet");
    const alertSummary = analysis?.coachAlerts?.length
      ? analysis.coachAlerts
          .slice(0, 2)
          .map((alert) => `${alert.title}: ${alert.message}`)
          .join(" ")
      : "Kritik otomatik uyarı yok.";

    return {
      memberName: profile.memberName || "Aktif Üye",
      trainingDays,
      latestMeasurementDate: latestMeasurement?.date || "Kayıt yok",
      latestProgramDate: latestProgramRecord?.savedAt || "Kayıt yok",
      score: `${analysis?.score ?? 0}/100`,
      goalFitScore: `${analysis?.goalFitScore ?? 0}/100`,
      riskLevel: analysis?.riskLevel || "Belirsiz",
      summary: analysis?.summary || "Analiz için ölçüm bekleniyor.",
      trendText: analysis?.trend?.text || "Trend için en az iki ölçüm gerekir.",
      alertSummary,
      nextAction,
    };
  }

  window.BSMDashboardService = {
    buildActivityItems,
    buildFallbackMemberAnalysis,
    buildFallbackAutomationSummary,
    buildCoachTasks,
    buildCoachQuickPanelModel,
  };
})();
