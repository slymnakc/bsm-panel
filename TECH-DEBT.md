# Nutrition Architecture — Technical Debt

> **Snapshot:** Refactor ADIM 3E2 sonrası (commit `8610d16`, 2026-05-24).
> app.js: 9607 satır · nutrition/*.js: 4548 satır (15 modül) · e2e: 18/18 pass.

Bu doküman nutrition domain refactor'unun **mevcut durumunu**, app.js'de **hala duran** nutrition kalıntılarını ve 4.x domain split öncesi son resmi yansıtır. Yeni feature için referans değil — sadece bilinen borçların envanteri.

---

## 1. Refactor 3 Serisi — Tamamlanma Durumu

### ✅ Tamamlanan Modüller (10 modül, 2853 satır extract)

| Part | Modül | LOC | Tamamlandı |
|---|---|---|---|
| 1 | `nutritionHelpers.js` | 241 | Pure helpers (calcFoodMacros, resolveMealMacros, mealOverrideKey, shiftTime, …) |
| 2 | `nutritionPdfPipeline.js` | 658 | PDF render + Print Root (renderPdfPage1/2, buildKcalBar, prepareNutritionPrintRoot) |
| 3A | `nutritionRenderers.js` | 401 | 8 saf render fn (timeline, macroView, supplementLibrary, …) |
| 3B1 | `nutritionPremiumRenderers.js` | 148 | renderNutritionHero, renderMealEditorHtml |
| 3B2 | `nutritionPremiumWorkspace.js` | 132 | renderNutritionPremiumWorkspace (orchestrator) |
| 3B3 | `nutritionPremiumHandlers.js` | 518 | bindNutritionPremiumHandlers + reactive input chain |
| 3C | `nutritionPersistence.js` | 355 | Save/Print handlers + seed/preferences/override mutations |
| 3D | `nutritionDiversification.js` | 177 | diversifyMealFoods + applyDiversificationToPlan + smartSupplements |
| 3E1 | `nutritionPlanFactory.js` | 96 | tryAutoGenerateNutritionPlan (livePreview adapter) |
| 3E2 | `nutritionGenerateHandlers.js` | 127 | generateNutritionButton handler (raw plan write, capture phase) |

### 📊 Kümülatif Sonuçlar

```
app.js:        11456 → 9607 satır  (−1849, −16.1%)
Extract:       2853 satır
Overhead:      ~90 satır (destructure + init blokları)
Tamamlanma:    ~%93-95
```

---

## 2. Kalan app.js Nutrition Alanları (~103 satır)

Modüllerden bağımsız hala app.js'de duran nutrition kodu:

### DOM Sync (~35 satır)

| Fonksiyon | Satır | Sebep |
|---|---|---|
| `syncNutritionAccordionInputs` | 35 | Form input value sync — premiumWorkspace içinden callback ile çağrılıyor; reactive chain'le coupling |

### View State (~35 satır)

| Fonksiyon | Satır | Sebep |
|---|---|---|
| `updateNutritionGenerateButtonLabel` | 10 | "Plan Oluştur" / "Planı Güncelle" toggle + save button class |
| `applyNutritionActiveViewClass` | 10 | View tab (timeline/macro/pdf) class toggle |
| `setNutritionPdfActivePage` | 15 | PDF page nav + smooth scroll |

### Wrapper Fn'leri (~25 satır)

| Fonksiyon | Satır | Sebep |
|---|---|---|
| `renderNutritionWorkspace` | 10 | Premium'a delege eden top-level alias |
| `renderNutritionOutput` + `getNutritionPlanForOutput` | 15 | Output panel render glue (Üye Çıktısı'na) |

### Bind Glue (~8 satır)

| Kod | Satır | Sebep |
|---|---|---|
| `nutritionPanel.addEventListener("click", ...)` → sendMailButton | 3 | 1 satır click delegation |
| Top-level DOM ref const'ları (`nutritionPanel`, `saveNutritionButton`, `printNutritionButton`, `generateNutritionButton`, `nutritionPlanEditor`) | 5 | Bootstrap DOM bindings |

### Overhead (~90 satır)

| Blok | Satır | Sebep |
|---|---|---|
| 10 modül guard check'leri | ~20 | `if (!window.BSMNutrition*) throw ...` |
| 10 modül destructure block'ları | ~50 | `const { x, y, z } = window.BSMNutrition*;` |
| `initialize()` içindeki 10 init call | ~70 | Her modüle DI parametreleri |

**Toplam (fonksiyonel + overhead): ~193 satır**

---

## 3. Refactor 3F (DOM Sync + View State) — Opsiyonel

### 3F1 — `nutritionFormSync.js` Adayı
- `syncNutritionAccordionInputs` (~35 satır)
- **Risk:** 🟢 Düşük (DOM input sync)
- **Faydası:** Marginal — premiumWorkspace içinden callback ile çağrılıyor, modüle taşımak ekstra DI overhead getirir

### 3F2 — `nutritionViewState.js` Adayı
- `updateNutritionGenerateButtonLabel`, `applyNutritionActiveViewClass`, `setNutritionPdfActivePage` (~35 satır)
- **Risk:** 🟢 Düşük (DOM class toggle)
- **Faydası:** Marginal — küçük helper'lar, modüle taşımak ekstra overhead

### Neden 3F Opsiyonel?

1. **Kalan kod küçük** (~103 fonksiyonel satır, major sorumluluk yok)
2. **Mantıksal grupları belirsiz** — 4.x domain split sırasında bu helper'lar ait oldukları domain'e organic şekilde dağılır
3. **3F ekstra overhead getirir** (~20 satır × 2 modül = 40 satır init/destructure)
4. **4.x sırasında daha temiz** — domain split sırasında nutrition/ klasörü altında doğru yerine yerleşir
5. **app.js'in bootstrap rolü gerektirir** — bazı helper'lar (renderNutritionWorkspace wrapper) muhtemelen 4.x'de silinir veya birleştirilir

### Önerilen Yol: **3F'i atla, doğrudan 4.x'e geç**

Kalan ~103 satır 4.x domain split sırasında `nutrition/` klasörüne dağılır:
- `syncNutritionAccordionInputs` → `nutrition/nutritionFormSync.js` (4.x ile birlikte)
- View state helpers → `nutrition/nutritionViewState.js` (4.x ile birlikte)
- Wrapper'lar muhtemelen silinir (direkt Premium çağrı veya output domain'inde)

---

## 4. 4.x Öncesi Stabilization Status

### ✅ Yeşil (Geçiş Güvenli)

| Gate | Durum |
|---|---|
| E2E regression suite | 18/18 pass |
| Console / page / network error | 0 / 0 / 0 |
| Nutrition major sorumlulukları modüler | ✅ 10 modül |
| Generate raw plan ↔ livePreview distinction | ✅ Spec #18 kilitli |
| Save/Print/PDF preview parity | ✅ Spec #11, #12, #17 |
| Reactive form chain | ✅ Spec #8, #9 |
| Idempotent bind koruması | ✅ generate + save + print + premium hepsi guard'lı |
| Cross-module callback chain | ✅ Lazy callback pattern sağlam |
| Engine bridge (planFactory) izole | ✅ |
| Working tree clean | ✅ |

### 🟡 Sarı (4.x Sırasında Dikkat)

| Konu | Etki |
|---|---|
| Kalan ~103 satır nutrition glue | 4.x sırasında nutrition/ altında organize edilecek — minor |
| Supabase race manuel QA | Test mode izole, production manuel doğrulama önerilir |
| 6 e2e action gap | handleMealAction CRUD, smart-suggest, reset, enable-supplements henüz test edilmiyor |
| TECH-DEBT.md yeni domain split planı | DOMAIN-SPLIT-PLAN.md'ye taşındı (3E2 sonrası) |

### ❌ Kırmızı (Gerçek Blocker): **HİÇBİR ŞEY**

---

## 5. Reducer/State Riskleri (Uzun Vade)

`state.nutritionFormState` mutation yüzeyi **artık daha izole**:

```
Refactor 3 öncesi:               Refactor 3 sonrası:
  app.js → ~20 yerde mutate         app.js → 0 (sadece destructure)
                                    nutritionPersistence → 4 yerde (seed/save)
                                    nutritionPremiumHandlers → 11 yerde (handlers)
                                    nutritionDiversification → 1 yerde (mealOverrides)
                                    nutritionGenerateHandlers → 2 yerde (activeNutritionPlan)
                                    nutritionPlanFactory → 0 (read-only)
```

**4.x öncesi durum:** Mutation hala dağınık ama her modülün sorumluluk alanı net. Reducer pattern (uzun vade) hala değerli ama **acil değil** — 4.x'den sonraki sprintlere bırakılabilir.

---

## 6. Test Coverage Boşlukları

| Akış | Test var mı? |
|---|---|
| Plan oluştur button → save | ✅ Spec #18 (3E2 sonrası) |
| `handleMealAction("edit")` toggle | ❌ |
| `handleMealAction("add-food")` | ❌ |
| `handleMealAction("remove-food")` | ❌ |
| `handleMealAction("refresh")` (dolaylı) | 🟡 diversify-all kapsamında |
| `handleMealAction("close-edit")` | ❌ |
| `handleMealEditorInput` (food id / grams change) | ❌ |
| `handleNutritionPdfZoom` (in/out/reset) | ❌ |
| `enable-supplements` action | ❌ |
| `smart-suggest` action | ❌ |
| `reset` action | ❌ |
| Supplement filter chip click | ❌ |
| Supplement add/remove toggle | ❌ |
| `printNutritionButton` click → PDF print | ✅ Spec #17 (3C sonrası) |
| Email button → send mail | ❌ |
| Generate flow (duplicate click + raw vs livePreview) | ✅ Spec #18 (3E2 sonrası) |

**Önerilen (4.x öncesi DEĞİL, 4.x sonrası):** Tek dosya `12-nutrition-handlers.spec.js` ile ~10 ek test. 4.x sırasında test ağı genişletilebilir.

---

## 7. Bilinen Code Smell'ler (Refactor Sonrası)

| Kod Kokusu | Konum | Etki |
|---|---|---|
| `renderNutritionWorkspace` ikinci wrapper | app.js (calls renderNutritionPremiumWorkspace) | Gereksiz indirection, legacy aliasing. 4.x sırasında silinmesi muhtemel |
| `debouncedNutritionInputHandler` IIFE `_state` lazy access | premiumHandlers.js | Init order'a güvenir — pre-init crash riski (test'lerde tetiklenmiyor) |
| Print Root + preview canvas duplicate render | pdfPipeline.js | Bellekte iki DOM kopya; preview = export gerekçesiyle kasıtlı |
| 20 dependency'li init() — premiumHandlers | premiumHandlers.js | DI surface çok geniş — parametre değişikliklerinde brittle |
| Engine fn'leri (buildNutritionPlan, makeId) direct inject | generateHandlers.js + planFactory.js | Engine adapter pattern yok — engine değişimi 2 yerde değişiklik |
| Yetimsiz top-level DOM refs (`generateNutritionButton`, `saveNutritionButton`) | app.js:910-915 | Modüller artık `document.querySelector` ile alıyor; const'lar muhtemelen kaldırılabilir |

---

## 8. Önerilen Sıralama (4.x Sonrası)

### 🥇 4.x — Domain Split (Sonraki büyük adım)
- Member / Program / Measurement / Output / Nutrition domain klasörleri
- app.js → 4 ana entry point + bootstrap glue
- **Risk:** 🔴 Yüksek (4000+ satır nutrition dışı kod hareket)
- **Yaklaşım:** [DOMAIN-SPLIT-PLAN.md](./DOMAIN-SPLIT-PLAN.md)

### 🥈 5.x — Reducer Pattern (Uzun Vade)
- `BSMState.dispatch({ type, payload })` merkezi action handler
- Audit trail + undo/redo zemini
- **Risk:** 🔴 Yüksek (tüm modüllerde mutation site değişikliği)

### 🥉 6.x — Test Coverage Genişletme
- `12-nutrition-handlers.spec.js` (10 ek test)
- `13-program-builder.spec.js`
- `14-measurement-flow.spec.js`
- **Risk:** 🟢 Düşük (sadece test ekleme)

### Hızlı Kazançlar (refactor dışı, < 1 saat)
- ✅ `tests/_report/` gitignore — DONE (stabilization sprint, 2026-05-23)
- ⏳ TECH-DEBT.md güncelleme — Bu sprint
- ⏳ `renderNutritionWorkspace` wrapper'ı sil — 4.x içinde

---

## Versiyon Notu

Bu doküman Refactor 3E2 commit `8610d16` durumunu yansıtır. 4.x domain split başlatıldığında bu dosya **DOMAIN-SPLIT-PLAN.md** ile birlikte güncellenmeli (her adım sonrası ilgili satırlar struck-out edilir veya yeni bölümler eklenir).
