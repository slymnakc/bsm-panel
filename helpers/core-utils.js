(function () {
  "use strict";

  function formatDashboardDate(value) {
    if (!value) {
      return "Tarih yok";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Tarih yok" : date.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  }

  function formatFileDate(dateValue) {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}${month}${day}-${hour}${minute}`;
  }

  function buildCsvContent(rows) {
    return `\uFEFF${rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(";")).join("\n")}`;
  }

  function escapeCsvValue(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function rotateArray(array, steps) {
    if (!array.length) {
      return [];
    }

    const index = steps % array.length;
    return array.slice(index).concat(array.slice(0, index));
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function titleCase(value) {
    return String(value)
      .split(" ")
      .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
      .join(" ");
  }

  function numberOrEmpty(value) {
    if (value === "" || value === null || value === undefined) {
      return "";
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : "";
  }

  function getTodayInputValue() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function normalizeText(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replaceAll("ı", "i")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  window.BSMCoreUtils = {
    formatDashboardDate,
    formatFileDate,
    buildCsvContent,
    escapeCsvValue,
    downloadFile,
    rotateArray,
    makeId,
    cloneData,
    titleCase,
    numberOrEmpty,
    getTodayInputValue,
    normalizeText,
    escapeHtml,
  };
})();
