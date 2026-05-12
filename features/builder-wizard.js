(function () {
  "use strict";

  var _form = null;
  var _repetitionBuilder = null;
  var _previewPanel = null;

  function setup() {
    _form = document.querySelector("#plannerForm");
    _repetitionBuilder = document.querySelector(".repetition-builder");
    setupBuilderWizard();
  }

  // ── [Extracted from app.js — builder wizard block] ────────────────────────────
function setupBuilderWizard() {
  if (!_form || _form.dataset.builderWizardReady === "true") {
    return;
  }

  const steps = [..._form.querySelectorAll(".builder-steps span")];

  if (!steps.length) {
    return;
  }

  _form.dataset.builderWizardReady = "true";
  _form.classList.add("builder-wizard-active");
  _form.dataset.builderWizardStep = "1";

  steps.forEach((stepElement, index) => {
    stepElement.dataset.builderStepTarget = String(index + 1);
    stepElement.setAttribute("role", "button");
    stepElement.tabIndex = 0;
  });

  markBuilderWizardSections();
  insertBuilderWizardToolbar();
  arrangeBuilderUILayout();
  updateBuilderPreviewPanel();
  setBuilderWizardStep(1);
  _form.addEventListener("click", handleBuilderWizardClick);
  _form.addEventListener("keydown", handleBuilderWizardKeydown);
  _form.addEventListener("input", updateBuilderPreviewPanel);
  _form.addEventListener("change", updateBuilderPreviewPanel);
}

function markBuilderWizardSections() {
  const assignControl = (selector, step) => {
    const control = _form.querySelector(selector);
    const wrapper = control?.closest(".field, .choice-block, .field--full, ._form-footer");

    if (wrapper) {
      wrapper.dataset.builderStep = String(step);
    }
  };

  ["#gymName", "#memberName", "#memberCode", "#memberEmail", "#trainerName"].forEach((selector) => assignControl(selector, 1));
  ["#goal", "#level", "#programStyle", "#priorityMuscle"].forEach((selector) => assignControl(selector, 2));
  ["#trainingSystem", "#equipmentScope", "#duration"].forEach((selector) => assignControl(selector, 3));

  _form.querySelector('input[name="days"]')?.closest(".choice-block")?.setAttribute("data-builder-step", "3");
  _form.querySelector('input[name="cardioPreference"]')?.closest(".choice-block")?.setAttribute("data-builder-step", "3");
  _form.querySelector('input[name="restrictions"]')?.closest(".choice-block")?.setAttribute("data-builder-step", "3");
  _repetitionBuilder?.setAttribute("data-builder-step", "4");
  _form.querySelector("#notes")?.closest(".field")?.setAttribute("data-builder-step", "5");
}

function insertBuilderWizardToolbar() {
  if (_form.querySelector(".builder-wizard-toolbar")) {
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "builder-wizard-toolbar";
  toolbar.innerHTML = `
    <div>
      <strong id="builderWizardTitle">Üye bilgileri</strong>
      <span id="builderWizardHint">Üye dosyasını oluşturacak temel bilgileri girin.</span>
    </div>
    <div class="builder-wizard-toolbar__actions">
      <button type="button" class="ghost-button mini-button" data-builder-wizard-action="toggle-all">Tüm adımları göster</button>
      <button type="button" class="ghost-button mini-button" data-builder-wizard-action="prev">Geri</button>
      <button type="button" class="secondary-button mini-button" data-builder-wizard-action="next">Sonraki</button>
    </div>
  `;

  _form.querySelector(".builder-steps")?.insertAdjacentElement("afterend", toolbar);
}

function arrangeBuilderUILayout() {
  const existingLayout = _form.querySelector(".builder-flow-layout");

  if (existingLayout) {
    _previewPanel = existingLayout.querySelector("#builderProgramPreview");
    return;
  }

  const toolbar = _form.querySelector(".builder-wizard-toolbar");

  if (!toolbar) {
    return;
  }

  // UI-only refactor, logic preserved: existing form controls keep ids, names and data-* hooks.
  const layout = document.createElement("div");
  layout.className = "builder-flow-layout";
  layout.innerHTML = `
    <div class="builder-flow-main"></div>
    <aside class="builder-flow-side" aria-label="Program oluşturma hızlı özeti">
      <section class="builder-preview-panel" id="builderProgramPreview" aria-live="polite"></section>
    </aside>
  `;

  toolbar.insertAdjacentElement("afterend", layout);

  const main = layout.querySelector(".builder-flow-main");
  _previewPanel = layout.querySelector("#builderProgramPreview");

  const movableNodes = [];
  let node = layout.nextSibling;

  while (node) {
    const nextNode = node.nextSibling;
    if (node.nodeType === Node.ELEMENT_NODE) {
      movableNodes.push(node);
    }
    node = nextNode;
  }

  movableNodes.forEach((item) => {
    main.appendChild(item);
  });
}

function handleBuilderWizardClick(event) {
  const stepTarget = event.target.closest("[data-builder-step-target]");
  const actionTarget = event.target.closest("[data-builder-wizard-action]");

  if (stepTarget) {
    setBuilderWizardStep(Number(stepTarget.dataset.builderStepTarget));
    return;
  }

  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.builderWizardAction;
  const currentStep = Number(_form.dataset.builderWizardStep || 1);

  if (action === "prev") {
    setBuilderWizardStep(currentStep - 1);
  } else if (action === "next") {
    setBuilderWizardStep(currentStep + 1);
  } else if (action === "toggle-all") {
    _form.classList.toggle("builder-wizard-show-all");
    actionTarget.textContent = _form.classList.contains("builder-wizard-show-all") ? "Adım adım göster" : "Tüm adımları göster";
    setBuilderWizardStep(currentStep);
  }
}

function handleBuilderWizardKeydown(event) {
  const stepTarget = event.target.closest("[data-builder-step-target]");

  if (!stepTarget || !["Enter", " "].includes(event.key)) {
    return;
  }

  event.preventDefault();
  setBuilderWizardStep(Number(stepTarget.dataset.builderStepTarget));
}

function setBuilderWizardStep(step) {
  const stepItems = [..._form.querySelectorAll("[data-builder-step-target]")];
  const maxStep = stepItems.length || 5;
  const activeStep = Math.min(Math.max(Number(step) || 1, 1), maxStep);
  const stepMeta = getBuilderWizardStepMeta(activeStep);
  const showAll = _form.classList.contains("builder-wizard-show-all");

  _form.dataset.builderWizardStep = String(activeStep);
  stepItems.forEach((item, index) => {
    item.classList.toggle("is-active", index + 1 === activeStep);
  });

  _form.querySelectorAll("[data-builder-step]").forEach((section) => {
    section.classList.toggle("is-builder-step-active", showAll || Number(section.dataset.builderStep) === activeStep);
  });

  const title = _form.querySelector("#builderWizardTitle");
  const hint = _form.querySelector("#builderWizardHint");
  const prevButton = _form.querySelector('[data-builder-wizard-action="prev"]');
  const nextButton = _form.querySelector('[data-builder-wizard-action="next"]');

  if (title) title.textContent = stepMeta.title;
  if (hint) hint.textContent = stepMeta.hint;
  if (prevButton) prevButton.disabled = activeStep === 1;
  if (nextButton) {
    nextButton.textContent = activeStep === maxStep ? "Önizleme hazır" : "Sonraki";
    nextButton.disabled = activeStep === maxStep;
  }

  updateBuilderPreviewPanel();
}

function getBuilderWizardStepMeta(step) {
  const meta = {
    1: { title: "1. Üye bilgileri", hint: "Üye adı, iletişim ve antrenör bilgilerini sade şekilde tamamlayın." },
    2: { title: "2. Hedef ve seviye", hint: "Hedef, seviye ve program tipi kararlarını netleştirin." },
    3: { title: "3. Antrenman tercihleri", hint: "Gün, ekipman, süre, kardiyo ve hassasiyetleri seçin." },
    4: { title: "4. Set / tekrar yapısı", hint: "Program oluşmadan önce ana reçete mantığını belirleyin." },
    5: { title: "5. Önizleme ve oluştur", hint: "Antrenör notunu ekleyin; üyeyi kaydedip programı oluşturun." },
  };

  return meta[step] || meta[1];
}

function updateBuilderPreviewPanel() {
  const panel = _previewPanel || _form?.querySelector("#builderProgramPreview");

  if (!panel || !_form) {
    return;
  }

  const memberName = getInputValue("#memberName") || "Üye seçimi bekliyor";
  const goal = getSelectedText("#goal", "Hedef seçilmedi");
  const level = getSelectedText("#level", "Seviye seçilmedi");
  const programStyle = getSelectedText("#programStyle", "Otomatik");
  const trainingSystem = getSelectedText("#trainingSystem", "Standart");
  const equipmentScope = getSelectedText("#equipmentScope", "Ekipman seçilmedi");
  const duration = getSelectedText("#duration", "60 dakika");
  const days = Array.from(_form.querySelectorAll('input[name="days"]:checked')).map((item) => item.closest("label")?.textContent?.trim() || item.value);
  const dayText = days.length ? `${days.length} gün / hafta` : "Gün seçilmedi";
  const dayList = days.length ? days.join(", ") : "Henüz gün seçilmedi";
  const repPreview = _form.querySelector("#repTemplatePreview")?.textContent?.trim().replace(/\s+/g, " ") || "Set/tekrar seçilmedi";
  const restTime = getInputValue("#defaultRestTime") || "Dinlenme seçilmedi";
  const activeStep = Number(_form.dataset.builderWizardStep || 1);
  const nextStep = getBuilderWizardStepMeta(Math.min(activeStep + 1, 5));

  panel.innerHTML = `
    <div class="builder-preview-panel__head">
      <span>Program Önizleme</span>
      <strong>${escapeHtml(memberName)}</strong>
      <small>Seçilen ayarlara göre oluşturulacak plan özeti</small>
    </div>
    <div class="builder-preview-panel__metrics">
      ${renderPreviewMetric("Hedef", goal)}
      ${renderPreviewMetric("Seviye", level)}
      ${renderPreviewMetric("Süre", duration)}
      ${renderPreviewMetric("Split / Program", programStyle)}
      ${renderPreviewMetric("Seçili günler", dayText)}
      ${renderPreviewMetric("Ekipman", equipmentScope)}
      ${renderPreviewMetric("Dinlenme", restTime)}
    </div>
    <div class="builder-preview-panel__rep">
      <span>Aktif preset</span>
      <strong>${escapeHtml(repPreview)}</strong>
      <small>${escapeHtml(trainingSystem)}</small>
    </div>
    <div class="builder-preview-panel__next">
      <span>PDF özeti</span>
      <strong>Üyeye verilebilir antrenman çıktısı</strong>
      <small>${escapeHtml(dayList)} • PDF, mail ve yazdırma akışı korunur.</small>
    </div>
    <div class="builder-preview-panel__next">
      <span>Sonraki adım</span>
      <strong>${escapeHtml(nextStep.title)}</strong>
      <small>${escapeHtml(nextStep.hint)}</small>
    </div>
    <ul class="builder-preview-panel__checks">
      <li>Üye bilgileri ve hedefler korunur</li>
      <li>Tanita / ölçüm verileri varsa öneriye yansır</li>
      <li>PDF, mail ve kayıt akışı değişmez</li>
    </ul>
  `;
}

function renderPreviewMetric(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function getInputValue(selector) {
  return _form.querySelector(selector)?.value?.trim() || "";
}

function getSelectedText(selector, fallback) {
  const select = _form.querySelector(selector);
  const text = select?.selectedOptions?.[0]?.textContent?.trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
  // ─────────────────────────────────────────────────────────────────────────────
  window.BSMBuilderWizard = { setup: setup };
})();
