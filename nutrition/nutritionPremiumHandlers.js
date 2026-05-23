// nutritionPremiumHandlers.js — Refactor Adım 3 part 3B3.
// bindNutritionPremiumHandlers + alt handler fonksiyonlari app.js'den extract edildi.
// Davranis degisikligi yok; event delegation, state mutation, render call sequence
// birebir ayni. Handler iki kez bind etmemek icin nutritionPanel.dataset
// bsmNutritionBound flag korundu.
//
// KAPSAM DISI (app.js'de kaldi):
//   - saveNutritionButton handler (#saveNutritionButton, separate bind, ~3484)
//   - printNutritionButton handler (#printNutritionButton, separate bind)
//   - bsmNutritionGenerateButton (yok)
//   - Supabase / localStorage save fn'leri (handler'lar bunlari cagirmiyor)
//
// Dependency injection (init):
//   state, getNutritionPanel (lazy)
//   App.js local fn callbacks:
//     applyNutritionActiveViewClass, setNutritionPdfActivePage,
//     renderNutritionWorkspace, showStatus, findActiveMember,
//     tryAutoGenerateNutritionPlan, buildPreferencesFromFormState,
//     applyDiversificationToPlan, applyUserOverridesToPlan,
//     buildSmartSupplementSuggestions, getActiveMeasurementSnapshot,
//     diversifyMealFoods
//   Engine fn callbacks (BSMNutritionService):
//     normalizeNutritionPlan, buildNutritionPlan, makeId
//   Already-extracted modul fns:
//     renderSupplementLibrary (3A), mealOverrideKey + findFoodById (Part 1)
//   Library data: foodLibrary (BSM_FOOD_LIBRARY)

(function () {
  "use strict";

  // ── Module-level lazy refs ──────────────────────────────────────────
  var _state = null;
  var _getNutritionPanel = function () { return document.querySelector("#nutritionPanel"); };

  // App.js local fn callbacks
  var _applyNutritionActiveViewClass = function () {};
  var _setNutritionPdfActivePage = function () {};
  var _renderNutritionWorkspace = function () {};
  var _showStatus = function () {};
  var _findActiveMember = function () { return null; };
  var _tryAutoGenerateNutritionPlan = function () { return null; };
  var _buildPreferencesFromFormState = function () { return {}; };
  var _applyDiversificationToPlan = function () {};
  var _applyUserOverridesToPlan = function (p) { return p; };
  var _buildSmartSupplementSuggestions = function () { return []; };
  var _getActiveMeasurementSnapshot = null;
  var _diversifyMealFoods = function () { return []; };

  // Engine fn callbacks
  var _normalizeNutritionPlan = function (p) { return p; };
  var _buildNutritionPlan = function () { return null; };
  var _makeId = function () { return ""; };

  // Already-extracted modul fns
  var _renderSupplementLibrary = function () {};
  var _mealOverrideKey = function (i) { return String(i); };
  var _findFoodById = function () { return null; };

  // Library data
  var _foodLibrary = [];

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.getNutritionPanel === "function") _getNutritionPanel = deps.getNutritionPanel;

    if (typeof deps.applyNutritionActiveViewClass === "function") _applyNutritionActiveViewClass = deps.applyNutritionActiveViewClass;
    if (typeof deps.setNutritionPdfActivePage === "function") _setNutritionPdfActivePage = deps.setNutritionPdfActivePage;
    if (typeof deps.renderNutritionWorkspace === "function") _renderNutritionWorkspace = deps.renderNutritionWorkspace;
    if (typeof deps.showStatus === "function") _showStatus = deps.showStatus;
    if (typeof deps.findActiveMember === "function") _findActiveMember = deps.findActiveMember;
    if (typeof deps.tryAutoGenerateNutritionPlan === "function") _tryAutoGenerateNutritionPlan = deps.tryAutoGenerateNutritionPlan;
    if (typeof deps.buildPreferencesFromFormState === "function") _buildPreferencesFromFormState = deps.buildPreferencesFromFormState;
    if (typeof deps.applyDiversificationToPlan === "function") _applyDiversificationToPlan = deps.applyDiversificationToPlan;
    if (typeof deps.applyUserOverridesToPlan === "function") _applyUserOverridesToPlan = deps.applyUserOverridesToPlan;
    if (typeof deps.buildSmartSupplementSuggestions === "function") _buildSmartSupplementSuggestions = deps.buildSmartSupplementSuggestions;
    if (typeof deps.getActiveMeasurementSnapshot === "function") _getActiveMeasurementSnapshot = deps.getActiveMeasurementSnapshot;
    if (typeof deps.diversifyMealFoods === "function") _diversifyMealFoods = deps.diversifyMealFoods;

    if (typeof deps.normalizeNutritionPlan === "function") _normalizeNutritionPlan = deps.normalizeNutritionPlan;
    if (typeof deps.buildNutritionPlan === "function") _buildNutritionPlan = deps.buildNutritionPlan;
    if (typeof deps.makeId === "function") _makeId = deps.makeId;

    if (typeof deps.renderSupplementLibrary === "function") _renderSupplementLibrary = deps.renderSupplementLibrary;
    if (typeof deps.mealOverrideKey === "function") _mealOverrideKey = deps.mealOverrideKey;
    if (typeof deps.findFoodById === "function") _findFoodById = deps.findFoodById;

    if (Array.isArray(deps.foodLibrary)) _foodLibrary = deps.foodLibrary;
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLER: meal action butonlari (Düzenle / Besin Ekle / Yenile / Tamam / Sil)
  // ═══════════════════════════════════════════════════════════════════
  function handleMealAction(btn) {
    const action = btn.dataset.mealAction;
    const idx = Number(btn.dataset.mealIdx);
    const f = _state.nutritionFormState;
    const key = _mealOverrideKey(idx);
    const member = _findActiveMember();
    // Mevcut plan'i al — overrides uygulanmis hali state.activeNutritionPlan'da
    // saklamiyoruz; her render'da tryAutoGenerate ile yeniden uretiliyor.
    const livePlan = _tryAutoGenerateNutritionPlan(member);
    const meal = livePlan?.meals?.[idx];

    if (action === "edit") {
      // Toggle editor
      f.editingMealKey = f.editingMealKey === key ? null : key;
      // Eger ilk kez ediliyorsa, mevcut foods'u override'a kopyala
      if (f.editingMealKey === key && !f.mealOverrides[key] && meal) {
        f.mealOverrides[key] = {
          foods: extractMealFoodsForOverride(meal),
          name: meal.name,
          time: meal.scheduledTime || meal.time,
        };
      }
      _renderNutritionWorkspace();
      return;
    }

    if (action === "close-edit") {
      f.editingMealKey = null;
      _renderNutritionWorkspace();
      return;
    }

    if (action === "refresh") {
      // Sadece bu öğünü diversify et — usedProtein set'i tum diger meals'tan
      const seed = (Number(f.diversifySeed) || 0) + idx + 1;
      f.diversifySeed = seed;
      const usedProteinIds = new Set();
      if (livePlan?.meals) {
        livePlan.meals.forEach((m, i) => {
          if (i !== idx && Array.isArray(m.foods)) {
            m.foods.forEach((food) => {
              if (food?.id) {
                const fObj = _findFoodById(food.id);
                if (fObj && fObj.proteinPer100g >= 10) usedProteinIds.add(food.id);
              }
            });
          }
        });
      }
      const newFoods = _diversifyMealFoods(meal, idx, seed, f, usedProteinIds);
      if (newFoods.length) {
        f.mealOverrides[key] = {
          foods: newFoods,
          name: meal?.name || `Öğün ${idx + 1}`,
          time: meal?.scheduledTime || meal?.time || "12:00",
        };
      }
      _renderNutritionWorkspace();
      _showStatus("Öğün yenilendi.", "success");
      return;
    }

    if (action === "add-food") {
      if (!f.mealOverrides[key]) {
        f.mealOverrides[key] = {
          foods: meal ? extractMealFoodsForOverride(meal) : [],
          name: meal?.name || `Öğün ${idx + 1}`,
          time: meal?.scheduledTime || meal?.time || "12:00",
        };
      }
      // Default: ilk protein gida + 100g
      f.mealOverrides[key].foods.push({ id: "yumurta", grams: 100 });
      f.editingMealKey = key;
      _renderNutritionWorkspace();
      return;
    }

    if (action === "remove-food") {
      const foodRow = Number(btn.dataset.foodRow);
      const ov = f.mealOverrides[key];
      if (ov?.foods && ov.foods.length > foodRow) {
        ov.foods.splice(foodRow, 1);
        _renderNutritionWorkspace();
      }
      return;
    }
  }

  // Helper: meal'in foods'unu override formatına çevir (id + grams)
  function extractMealFoodsForOverride(meal) {
    const foods = Array.isArray(meal?.foods) ? meal.foods : [];
    return foods.map((food) => {
      if (typeof food === "string") {
        // Engine'den gelen "Yumurta 4 adet" gibi free-form text; default 100g + en
        // yakin library item'a fallback
        const lower = food.toLocaleLowerCase("tr");
        const match = _foodLibrary.find((lf) => lower.includes(lf.name.toLocaleLowerCase("tr"))) || _foodLibrary[0];
        return { id: match.id, grams: 100 };
      }
      return {
        id: food.id || "yumurta",
        grams: Number(food.grams) || 100,
      };
    }).filter((f) => f.id);
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLER: meal editor input change (select/input change degisikligi)
  // ═══════════════════════════════════════════════════════════════════
  function handleMealEditorInput(e) {
    const select = e.target.closest("[data-food-field]");
    if (select) {
      const row = Number(select.dataset.foodRow);
      const field = select.dataset.foodField;
      const editor = select.closest("[data-meal-editor]");
      if (!editor) return;
      const idx = Number(editor.dataset.mealEditor);
      const key = _mealOverrideKey(idx);
      const f = _state.nutritionFormState;
      if (!f.mealOverrides[key]) return;
      const food = f.mealOverrides[key].foods[row];
      if (!food) return;
      if (field === "id") food.id = select.value;
      if (field === "grams") food.grams = Math.max(1, Math.min(1000, Number(select.value) || 100));
      _renderNutritionWorkspace();
      return;
    }
    // Meal name / time degisikligi
    const mealField = e.target.closest("[data-meal-field]");
    if (mealField) {
      const editor = mealField.closest("[data-meal-editor]");
      if (!editor) return;
      const idx = Number(editor.dataset.mealEditor);
      const key = _mealOverrideKey(idx);
      const f = _state.nutritionFormState;
      if (!f.mealOverrides[key]) f.mealOverrides[key] = { foods: [] };
      const fieldName = mealField.dataset.mealField;
      f.mealOverrides[key][fieldName] = mealField.value;
      // Sadece visual update — full render gereksiz, sadece data update
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLER: PDF preview zoom kontrolu (toolbar +/-/reset)
  // ═══════════════════════════════════════════════════════════════════
  function handleNutritionPdfZoom(action) {
    const canvas = document.querySelector("#bsmPdfCanvas");
    const label = document.querySelector("#bsmPdfZoomLabel");
    if (!canvas) return;
    const current = Number(canvas.dataset.zoom || "100");
    let next = current;
    if (action === "in") next = Math.min(150, current + 10);
    else if (action === "out") next = Math.max(60, current - 10);
    else if (action === "reset") next = 100;
    canvas.dataset.zoom = String(next);
    canvas.style.setProperty("--pdf-zoom", String(next / 100));
    if (label) label.textContent = `${next}%`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // HANDLER: form input change (select/input/checkbox)
  // ═══════════════════════════════════════════════════════════════════
  function handleNutritionFormInputChange(e) {
    const nutritionPanel = _getNutritionPanel();
    // v1.3.4: Meal editor inputs (food id/grams select-change)
    if (e.target.closest("[data-food-field]") || e.target.closest("[data-meal-field]")) {
      handleMealEditorInput(e);
      return;
    }
    const input = e.target.closest("[data-nutrition-input]");
    if (!input) {
      // supplementCategoryList icindeki checkbox'lar farkli; kategorileri topla
      if (e.target.closest("#supplementCategoryList")) {
        const cats = [...nutritionPanel.querySelectorAll('#supplementCategoryList input[type="checkbox"]')]
          .filter((c) => c.checked).map((c) => c.value);
        _state.nutritionFormState.supplementCategories = cats.length ? cats : ["basic"];
        _renderNutritionWorkspace();
      }
      return;
    }
    const f = _state.nutritionFormState;
    const key = input.dataset.nutritionInput;

    // Special: meal count is handled in click (segment button); accordion checkbox group is supplement
    if (key === "mealCount") return;

    if (input.tagName === "SELECT" || input.tagName === "INPUT" || input.tagName === "TEXTAREA") {
      if (input.type === "checkbox") {
        f[key] = !!input.checked;
      } else if (input.type === "number") {
        const n = Number(input.value);
        f[key] = Number.isFinite(n) && n > 0 ? n : null;
        // Kalori değiştiyse calorieShift'i bağımsızla
        if (key === "calorieShift") f[key] = Number(input.value);
      } else {
        f[key] = input.value;
      }
    }
    _renderNutritionWorkspace();
  }

  // ═══════════════════════════════════════════════════════════════════
  // DEBOUNCED INPUT HANDLER — 300ms debounce, state INSTANT update
  // ═══════════════════════════════════════════════════════════════════
  // v1.3.3: Debounce wrapper — son input'tan 300ms sonra render et.
  // State update INSTANT olur, ama renderNutritionWorkspace cagrisi gecikmeli.
  const debouncedNutritionInputHandler = (() => {
    let timer = null;
    return function (e) {
      // Hemen state'i guncelle (cunku React-like reactivity bekleniyor)
      const input = e?.target?.closest("[data-nutrition-input]");
      if (input) {
        const f = _state.nutritionFormState;
        const key = input.dataset.nutritionInput;
        if (key === "mealCount") return; // segment ile handle
        if (input.type === "checkbox") f[key] = !!input.checked;
        else if (input.type === "number") {
          const n = Number(input.value);
          f[key] = Number.isFinite(n) && n > 0 ? n : null;
        } else f[key] = input.value;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { _renderNutritionWorkspace(); }, 300);
    };
  })();

  // ═══════════════════════════════════════════════════════════════════
  // EVENT DELEGATION — ana bind (idempotent guard: bsmNutritionBound)
  // ═══════════════════════════════════════════════════════════════════
  function bindNutritionPremiumHandlers() {
    const nutritionPanel = _getNutritionPanel();
    if (!nutritionPanel || nutritionPanel.dataset.bsmNutritionBound === "true") return;
    nutritionPanel.dataset.bsmNutritionBound = "true";

    // v1.4.0: Supplement accordion <details toggle> event — open oldugunda
    // library'i viewport'a getir. User accordion'i acinca otomatik olarak
    // supplement kartlari ekranda gozukur, scroll etmek zorunda kalmaz.
    // Bu listener'i 200ms sonra ekliyoruz cunku initial render sirasinda
    // accordion default open ise gereksiz scroll tetiklemesin.
    setTimeout(() => {
      const supplAcc = nutritionPanel.querySelector('.bsm-nutrition-acc[data-acc="supplement"]');
      if (supplAcc) {
        supplAcc.addEventListener("toggle", () => {
          if (supplAcc.open) {
            // Library kartlarina smooth scroll (sol panel sticky bile olsa
            // accordion icinden library'i viewport'a getirir)
            const lib = nutritionPanel.querySelector("#supplementLibrary");
            (lib || supplAcc).scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
          }
        });
      }
    }, 200);

    // View tabs (Günlük Akış / Makro / PDF) + supplement library + PDF thumbs
    nutritionPanel.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-nutrition-view]");
      if (tab) {
        _state.nutritionActiveView = tab.dataset.nutritionView;
        _applyNutritionActiveViewClass();
        return;
      }
      // v1.2.5: PDF thumbnail / v1.3.2: PDF toolbar page button click
      const pdfThumb = e.target.closest("[data-pdf-thumb]");
      if (pdfThumb) {
        _setNutritionPdfActivePage(pdfThumb.dataset.pdfThumb);
        return;
      }
      // v1.3.2: PDF toolbar zoom kontrolu
      const zoomBtn = e.target.closest("[data-pdf-zoom]");
      if (zoomBtn) {
        handleNutritionPdfZoom(zoomBtn.dataset.pdfZoom);
        return;
      }
      // v1.3.2: PDF toolbar aksiyonlari (print/download/email)
      const pdfActBtn = e.target.closest("[data-pdf-action]");
      if (pdfActBtn) {
        const act = pdfActBtn.dataset.pdfAction;
        if (act === "print" || act === "download") {
          document.querySelector("#printNutritionButton")?.click();
        } else if (act === "email") {
          document.querySelector("#sendNutritionMailButton")?.click();
        }
        return;
      }
      // v1.3.4: Meal action butonlar (Düzenle / Besin Ekle / Yenile / Tamam / Sil)
      const mealActBtn = e.target.closest("[data-meal-action]");
      if (mealActBtn) {
        handleMealAction(mealActBtn);
        return;
      }
      // v1.2.5: Supplement library kategori filtre chip
      const filterBtn = e.target.closest("[data-suppl-filter]");
      if (filterBtn) {
        const host = document.querySelector("#supplementLibrary");
        if (host) host.dataset.activeFilter = filterBtn.dataset.supplFilter;
        document.querySelectorAll("[data-suppl-filter]").forEach((b) => {
          b.classList.toggle("is-active", b === filterBtn);
        });
        _renderSupplementLibrary();
        return;
      }
      // v1.2.5: Supplement add/remove toggle
      const supplToggle = e.target.closest("[data-suppl-toggle]");
      if (supplToggle) {
        const id = supplToggle.dataset.supplToggle;
        const f = _state.nutritionFormState;
        if (f.selectedSupplements.includes(id)) {
          f.selectedSupplements = f.selectedSupplements.filter((x) => x !== id);
        } else {
          f.selectedSupplements = [...f.selectedSupplements, id];
          // Ekleme yapildiysa supplement toggle'i da AC
          if (!f.supplementUse) f.supplementUse = true;
        }
        _renderNutritionWorkspace();
        return;
      }
      const supplRemove = e.target.closest("[data-suppl-remove]");
      if (supplRemove) {
        const id = supplRemove.dataset.supplRemove;
        const f = _state.nutritionFormState;
        f.selectedSupplements = f.selectedSupplements.filter((x) => x !== id);
        _renderNutritionWorkspace();
        return;
      }
      // Meal count segment
      const segBtn = e.target.closest('[data-nutrition-input="mealCount"] button');
      if (segBtn) {
        _state.nutritionFormState.mealCount = Number(segBtn.dataset.value);
        _renderNutritionWorkspace();
        return;
      }
      // Aksiyonlar (reset / auto-macros / smart-suggest)
      const actBtn = e.target.closest("[data-nutrition-action]");
      if (actBtn) {
        const act = actBtn.dataset.nutritionAction;
        if (act === "reset") {
          Object.assign(_state.nutritionFormState, {
            goal: "muscle-gain", calories: null, calorieShift: 300,
            protein: null, carbs: null, fat: null,
            mealCount: 5, dayType: "balanced",
            workoutTime: "18:30", cardioTime: "", activityLevel: "moderate",
            fastingEnabled: false, fastingWindow: "16:8",
            supplementUse: false, supplementCategories: [],
            caffeineSensitive: "no", lactoseSensitive: "no",
            trainerNote: "", avoidList: "", allergies: "",
            selectedSupplements: [], supplementSearch: "",
          });
          _renderNutritionWorkspace();
          _showStatus("Plan ayarları sıfırlandı.", "success");
        } else if (act === "auto-macros") {
          const cal = (_state.activeNutritionPlan?.calories) || _state.nutritionFormState.calories;
          if (cal) {
            const f = _state.nutritionFormState;
            f.protein = Math.round(cal * 0.30 / 4);
            f.carbs = Math.round(cal * 0.45 / 4);
            f.fat = Math.round(cal * 0.25 / 9);
            _renderNutritionWorkspace();
            _showStatus("Makro hedefi otomatik hesaplandı (30/45/25).", "success");
          } else {
            _showStatus("Önce kalori hedefi girin veya plan oluşturun.", "error");
          }
        } else if (act === "enable-supplements") {
          // v1.3.9: Empty state CTA — toggle aç + accordion aç + smart suggest
          _state.nutritionFormState.supplementUse = true;
          document.querySelector('.bsm-nutrition-acc[data-acc="supplement"]')?.setAttribute("open", "");
          // Sync checkbox
          const cb = document.querySelector("#supplementUseCheckbox");
          if (cb) cb.checked = true;
          _renderNutritionWorkspace();
          _showStatus("Supplement sistemi açıldı.", "success");
          // v1.4.0: Library viewport'a otomatik scroll (kullanici kartlari hemen gorsun)
          setTimeout(() => {
            document.querySelector("#supplementLibrary")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
          return;
        } else if (act === "diversify-all") {
          // v1.3.4: Tüm planı çeşitlendir
          const member = _findActiveMember();
          const f = _state.nutritionFormState;
          f.diversifySeed = (Number(f.diversifySeed) || 0) + 1;
          // Mevcut plan'i diversify et + overrides'a yaz
          try {
            const preferences = _buildPreferencesFromFormState();
            const activeProgram = _state.activeProgram || member?.programs?.[0]?.program || null;
            let plan = _normalizeNutritionPlan(_buildNutritionPlan(member, activeProgram, preferences, { makeId: _makeId }));
            plan = _applyUserOverridesToPlan(plan, f);
            _applyDiversificationToPlan(plan, f);
            _renderNutritionWorkspace();
            _showStatus("Tüm plan çeşitlendirildi.", "success");
          } catch (err) {
            _showStatus("Çeşitlendirme başarısız: " + (err?.message || ""), "error");
            console.error(err);
          }
          return;
        } else if (act === "smart-suggest") {
          // v1.2.5: Akilli oneri uygula
          const member = _findActiveMember();
          const activeMeasurement = (typeof _getActiveMeasurementSnapshot === "function") ? _getActiveMeasurementSnapshot(member) : null;
          const suggested = _buildSmartSupplementSuggestions(_state.nutritionFormState, activeMeasurement);
          if (suggested.length) {
            _state.nutritionFormState.supplementUse = true;
            _state.nutritionFormState.selectedSupplements = suggested;
            _renderNutritionWorkspace();
            _showStatus(`${suggested.length} supplement önerildi.`, "success");
          } else {
            _showStatus("Hedef ve ayarlara göre öneri üretilemedi.", "error");
          }
        }
      }
    });

    // Form input change — CAPTURE phase ki legacy bindNutritionControlEvents
    // bubble handler'dan ONCE state'i guncelleyelim. Aksi takdirde syncAccordionInputs
    // user'in girdigi degeri eski state'le ezer.
    // v1.3.3: 'input' eventleri debounced (300ms) — number/text yazarken render
    // patirtisi olmasin. 'change' anlik (select/checkbox/segment).
    nutritionPanel.addEventListener("input", (e) => debouncedNutritionInputHandler(e), true);
    nutritionPanel.addEventListener("change", (e) => handleNutritionFormInputChange(e), true);
  }

  window.BSMNutritionPremiumHandlers = {
    init: init,
    bindNutritionPremiumHandlers: bindNutritionPremiumHandlers,
  };
})();
