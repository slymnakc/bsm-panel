(function () {
  "use strict";

  function renderBodyAnalysisReport(target, model, escapeHtml) {
    if (!target) {
      return;
    }

    if (!model) {
      target.innerHTML = `<div class="empty-state compact-empty">Segmental cihaz sonucu kaydedildiğinde otomatik genel değerlendirme burada görünür.</div>`;
      return;
    }

    target.innerHTML = `
      <article class="analysis-summary">
        <div class="analysis-summary__header">
          <div>
            <p class="section-kicker">Otomatik Analiz</p>
            <h4>Genel Vücut Değerlendirmesi</h4>
          </div>
          <span class="analysis-score">${escapeHtml(model.score)}/100</span>
        </div>
        <p>${escapeHtml(model.summary || "")}</p>
        <div class="analysis-tags">
          ${(model.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        ${
          model.focusText
            ? `<div class="analysis-focus">
                <strong>Odak noktaları</strong>
                <span>${escapeHtml(model.focusText)}</span>
              </div>`
            : ""
        }
      </article>
      <div class="analysis-metrics">
        ${(model.metrics || [])
          .map(
            (metric) => `
              <div class="analysis-metric">
                <span>${escapeHtml(metric.label)}</span>
                <strong>${escapeHtml(metric.value)}</strong>
                ${metric.delta ? `<small>${escapeHtml(metric.delta)}</small>` : `<small>Son ölçüm</small>`}
                <div class="metric-bar"><i style="width: ${metric.percent}%"></i></div>
              </div>
            `,
          )
          .join("")}
      </div>
      ${
        (model.resistanceItems || []).length
          ? `
            <article class="analysis-distribution">
              <div class="analysis-distribution__header">
                <h5>Segmental Kas Direnci Dağılımı</h5>
                <span>Ohm bazlı sağ-sol denge takibi</span>
              </div>
              <div class="analysis-distribution__grid">
                ${model.resistanceItems
                  .map(
                    (item) => `
                      <div class="analysis-distribution__item">
                        <div class="analysis-distribution__line">
                          <span>${escapeHtml(item.label)}</span>
                          <strong>${escapeHtml(item.valueLabel)}</strong>
                        </div>
                        <small>${escapeHtml(item.deltaLabel)}</small>
                        <div class="resistance-bar"><i style="width: ${item.barWidth}%"></i></div>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </article>
          `
          : ""
      }
      <div class="analysis-notes">
        ${(model.notes || [])
          .map(
            (note) => `
              <div class="analysis-note analysis-note--${note.level}">
                <strong>${escapeHtml(note.title)}</strong>
                <span>${escapeHtml(note.text)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  window.BSMAlertsUI = {
    renderBodyAnalysisReport,
  };
})();
