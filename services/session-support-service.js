(function () {
  "use strict";

  function buildWarmup(groups, data) {
    const base = ["5 dk hafif kardiyo", "Eklem hazırlığı: boyun, omuz, kalça, diz ve ayak bileği"];

    if (groups.includes("chest") || groups.includes("shoulders")) {
      base.push("Band pull-apart veya cable face pull: 2 x 15");
    }

    if (groups.includes("quadriceps") || groups.includes("hamstrings") || groups.includes("glutes")) {
      base.push("Bodyweight squat + glute bridge: 2 tur x 10 tekrar");
    }

    if (data.restrictions.includes("back")) {
      base.push("Dead bug ve bird dog aktivasyonu: 2 tur");
    }

    return base;
  }

  function buildCooldown(groups, data) {
    const cooldown = ["3-5 dk nabız düşürme", "Çalışılan kas gruplarına 20-30 sn hafif esnetme"];

    if (groups.includes("quadriceps") || groups.includes("glutes")) {
      cooldown.push("Kalça fleksör ve hamstring esnetmesi");
    }

    if (groups.includes("chest") || groups.includes("back")) {
      cooldown.push("Göğüs açma ve lat esnetmesi");
    }

    if (data.restrictions.length) {
      cooldown.push("Ağrı varsa ilgili hareketi bir sonraki seansta daha kolay alternatifle değiştirin");
    }

    return cooldown;
  }

  function buildCardioBlock(data, groups) {
    if (data.cardioPreference === "low" && data.goal !== "fat-loss") {
      return "Opsiyonel: 6-8 dk hafif yürüyüş veya bisiklet.";
    }

    if (groups.includes("cardio")) {
      return data.cardioPreference === "high"
        ? "Ana blok: 15-20 dk interval kardiyo."
        : "Ana blok: 12-15 dk orta tempo kardiyo.";
    }

    if (data.goal === "fat-loss") {
      return data.cardioPreference === "high" ? "Bitiriş: 12 dk interval kardiyo." : "Bitiriş: 10 dk eğimli yürüyüş veya bisiklet.";
    }

    return data.cardioPreference === "high" ? "Bitiriş: 8-10 dk kondisyon finisher." : "Bitiriş: 6-8 dk rahat tempo kardiyo.";
  }

  window.BSMSessionSupportService = {
    buildWarmup,
    buildCooldown,
    buildCardioBlock,
  };
})();
