# Nutrition Architecture — Technical Debt

> **Snapshot:** Refactor ADIM 3B3 sonrası (commit `59a712c`, 2026-05-23).
> app.js: 9927 satır · nutrition/*.js: 3793 satır (11 modül) · e2e: 16/16 pass.

Bu doküman 3B serisinden sonra **app.js'de hala duran** nutrition kodunu, çıkartılması zor olan kalıntıları, ve gelecek refactor sıralamasını listeler. Yeni feature için **referans değil** — sadece bilinen borçların envanteri.

---

## 1. Kalan app.js Nutrition Blokları (~600 satır)

Modüllerden bağımsız hala app.js'de duran nutrition-ilgili kod:

| Fonksiyon / Blok | ~Satır | Sebep |
|---|---|---|
| `seedNutritionFormFromMember` | 30 | Workspace callback'i, DI yükü ekstra |
| `tryAutoGenerateNutritionPlan` | 20 | Engine adapter (build + apply chain) |
| `applyUserOverridesToPlan` | 60 | User override scale + macro redistribute |
| `applyMealOverridesToPlan` | 50 | Meal override merge + macro recalc |
| `applyDiversificationToPlan` | 30 | Diversification post-process |
| `diversifyMealFoods` | 60 | Meal-level food shuffle, usedProteinIds tracking |
| `buildSmartSupplementSuggestions` | 40 | Smart-suggest logic |
| `buildPreferencesFromFormState` | 25 | Form state → engine preferences mapping |
| `renderNutritionWorkspace` wrapper | 10 | Top-level alias, Premium'a delege |
| `syncNutritionAccordionInputs` | 35 | DOM input sync (set value) |
| `updateNutritionGenerateButtonLabel` | 10 | Generate vs Update button label toggle |
| `applyNutritionActiveViewClass` | 10 | View tab class toggle |
| `setNutritionPdfActivePage` | 15 | PDF page nav + scroll |
| **`saveNutritionButton` handler** | 50+ | **Yüksek değer extract** — Supabase + localStorage |
| **`printNutritionButton` handler** | 30+ | **Yüksek değer extract** — PDF print flow |
| `nutritionPanel` const + DOM refs | — | Module-level DOM bindings |
| Misc bind glue + adapters | 100+ | Top-level init blokları arasında |

**Tahmini extract potansiyeli:** ~600 satır (iki yeni modülle).

---

## 2. Persistence Extract Adayları

Hedef modül: `nutrition/nutritionPersistence.js`

| Aday Fonksiyon | Konum | Risk |
|---|---|---|
| `saveNutritionButton` click handler | app.js ~3484 | 🟡 Orta — Supabase race condition'a açık |
| `printNutritionButton` click handler | app.js | 🟢 Düşük — DOM-only flow |
| `seedNutritionFormFromMember` | app.js (Premium callback) | 🟢 Düşük — pure form fill |
| `buildPreferencesFromFormState` | app.js (Handlers/Workspace) | 🟢 Düşük — pure mapping |

**Bağımlılıklar:** `BSMSupabaseSync`, `localStorage`, `state.activeNutritionPlan`, `findActiveMember`.
**Gerekli ek:** Yeni e2e spec — save flow (henüz test edilmiyor).

---

## 3. Diversification Extract Adayları

Hedef modül: `nutrition/nutritionDiversification.js`

| Aday Fonksiyon | Konum | Risk |
|---|---|---|
| `diversifyMealFoods` | app.js:569 | 🟡 Orta — seed mantığı + usedProteinIds set |
| `applyDiversificationToPlan` | app.js:631 | 🟡 Orta — plan mutate post-process |
| `buildSmartSupplementSuggestions` | app.js:652 | 🟢 Düşük — pure logic |
| `applyUserOverridesToPlan` | app.js | 🔴 Yüksek — meal macro scale chain, P0K0Y0 fix bağımlı |
| `applyMealOverridesToPlan` | app.js | 🔴 Yüksek — calcFoodMacros chain, meal override format |

Override fn'leri "Diversification" değil ama benzer kategori — ayrı modül (`nutritionPlanMutations.js`) tercih edilebilir.

---

## 4. Reducer / State Riskleri

`state.nutritionFormState` mutation yüzeyi **dağınık**:

```
state.nutritionFormState.X = Y    pattern'i şu yerlerde:
  app.js                   → 8 yerde (override, seed, post-process)
  premiumHandlers.js       → 11 yerde (click/input handlers)
  premiumWorkspace.js      → 1 yerde (memberId reset)
```

**Sorunlar:**
- Hangi action hangi field'ı değiştirir trace edilemez
- Race: Workspace render sırasında handler tetiklenirse stale read
- Undo/redo imkansız (mutation tracking yok)

**Çözüm önerisi (uzun vade):**
- `BSMNutritionState.dispatch({ type, payload })` reducer pattern
- Tüm mutation'lar reducer üzerinden geçer
- Action log audit trail için kullanılabilir

**Kısa vadeli adım:** `setNutritionFormField(key, value)` helper'ı tek noktadan mutate eder, log için hook.

---

## 5. Test Coverage Boşlukları

E2E suite (16 test) reactive + PDF testler iyi kapsıyor, ama eksikler:

| Akış | Test var mı? |
|---|---|
| Plan oluştur button click → save | ❌ |
| Plan güncelle button click | ❌ |
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
| `printNutritionButton` click → PDF print | ❌ |
| Email button → send mail | ❌ |

**Önerilen:** Tek dosya `10-nutrition-handlers.spec.js` ile ~10 ek test (~1 saat iş).

---

## 6. Bilinen Code Smell'ler

| Kod Kokusu | Konum | Etki |
|---|---|---|
| `renderNutritionWorkspace` ikinci wrapper | app.js (calls renderNutritionPremiumWorkspace) | Gereksiz indirection, legacy aliasing |
| `debouncedNutritionInputHandler` IIFE `_state` lazy access | premiumHandlers.js | Init order'a güvenir — pre-init crash riski |
| Print Root + preview canvas duplicate render | pdfPipeline.js | Bellekte iki DOM kopya; preview = export gerekçesiyle kasıtlı ama dikkat |
| 20 dependency'li init() — premiumHandlers | premiumHandlers.js | DI surface çok geniş, refactor parametre değişikliklerinde brittle |
| Engine fn'leri (buildNutritionPlan, makeId) direct inject | premiumHandlers.js | Engine değişimi handler'ı kırar — adapter yok |
| `nutritionPanel` const lazy getter inconsistent | bazı modüllerde getter, bazılarında değil | Hijyen meselesi, runtime'da fark yok |

---

## 7. Önerilen Sıralama

### 🥇 Adım 3C — Persistence + Form State Extract
- `nutritionPersistence.js` yeni modülü
- saveNutritionButton + printNutritionButton handlers
- seedNutritionFormFromMember + buildPreferencesFromFormState
- **Tahmini app.js azalma:** ~250 satır
- **Risk:** 🟢 Düşük (Supabase sync test mode izole)
- **Gerekli ek:** save flow e2e spec

### 🥈 Adım 3D — Diversification + Plan Mutations Extract
- `nutritionDiversification.js` veya `nutritionPlanMutations.js`
- diversifyMealFoods + applyDiversificationToPlan + buildSmartSupplementSuggestions
- (Opsiyonel) applyUserOverridesToPlan + applyMealOverridesToPlan
- **Tahmini app.js azalma:** ~150-250 satır
- **Risk:** 🟡 Orta — plan mutate chain, P0K0Y0 fix bağımlı

### 🥉 Adım 4 — Domain Bootstrap Modülleri
9927 satır app.js'i domain'lere böl:
- `member/` (~1500 satır)
- `program/` (~2000 satır)
- `measurement/` (~1500 satır)
- `output/` (~600 satır)
- Bootstrap glue (~500 satır)

### 🏅 Adım 5 — Reducer Pattern (Uzun Vade)
- `BSMNutritionState.dispatch` action handler
- State mutation tek noktadan
- Audit trail + undo/redo zemini

### Hızlı Kazançlar (refactor dışı, < 1 saat)
- ✅ `tests/_report/` gitignore — Done (bu sprint)
- ⏳ `10-nutrition-handlers.spec.js` — 10 ek test
- ⏳ `renderNutritionWorkspace` wrapper sil — call site'ları audit

---

## Versiyon Notu

Bu doküman Refactor 3B3 commit `59a712c` durumunu yansıtır. Sıradaki refactor adımları başlatıldığında bu dosya güncellenmeli (her adım sonrası ilgili satırlar struck-out edilir).
