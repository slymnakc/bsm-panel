# Domain Split Plan — 4.x Migration Strategy

> **Snapshot:** Refactor ADIM 3E2 sonrası (commit `8610d16`, 2026-05-24).
> app.js: 9607 satır · 15 nutrition modülü modüler (~%93-95 nutrition refactor done).
> Bu doküman 4.x'in **mimari planı**dır; uygulama adımları başlatılmadı.

Nutrition domain refactor başarıyla tamamlandı (Part 1–3E2). Şimdi aynı pattern'i `member/`, `program/`, `measurement/`, `output/` domain'lerine uygulayacağız. Bu doküman:

1. **Hedef mimariyi** (target architecture) tanımlar
2. **Domain sınırlarını** netleştirir
3. **Geçiş sırasını** önerir
4. **Risk haritasını** çıkarır
5. **Migration stratejisini** belgelemektir

---

## 1. Hedef Mimari

### Klasör Yapısı

```
bsm-panel/
├── app.js                              ← Bootstrap + glue (~500-800 satır hedef)
├── index.html                          ← Script load order + entry point
│
├── core/                               ← Shared infrastructure
│   ├── router.js
│   ├── state.js                        (?)
│   ├── auth.js                         (?)
│   └── utils.js                        (BSMCoreUtils)
│
├── shared/                             ← Cross-domain dependencies
│   ├── escapeHtml, format helpers
│   ├── BSMLabelData / BSMOptionData / BSMPresetData (zaten var)
│   └── persistMembers / supabase sync (?)
│
├── members/                            ← Member domain (~1500 satır taşınacak)
│   ├── memberRenderers.js
│   ├── memberHandlers.js
│   ├── memberWorkspace.js
│   └── memberPersistence.js (?)
│
├── measurements/                       ← Measurement domain (~1500 satır taşınacak)
│   ├── measurementRenderers.js
│   ├── measurementTabs.js
│   ├── measurementReport.js
│   ├── measurementCsvAnalytics.js
│   └── measurementTrendCharts.js
│
├── programs/                           ← Program domain (~2000 satır taşınacak)
│   ├── programBuilder.js
│   ├── programWizard.js
│   ├── programRenderers.js
│   ├── programEditMode.js
│   └── programHistory.js
│
├── output/                             ← Output domain (~600 satır taşınacak)
│   ├── outputRenderers.js
│   ├── outputIntelligence.js
│   └── outputActions.js                (PDF/HTML/Mail)
│
├── library/                            ← Exercise library (~500 satır taşınacak)
│   ├── libraryRenderers.js
│   ├── libraryCustomExercise.js
│   └── libraryVideoModal.js
│
├── dashboard/                          ← Dashboard domain (~500 satır)
│   ├── dashboardRenderers.js
│   ├── dashboardCoachAlerts.js
│   └── dashboardCalendar.js
│
└── nutrition/                          ← ZATEN MODÜLER (15 modül) ✅
    ├── nutritionHelpers.js
    ├── nutritionPdfPipeline.js
    ├── nutritionRenderers.js
    ├── nutritionPremiumRenderers.js
    ├── nutritionPremiumWorkspace.js
    ├── nutritionPremiumHandlers.js
    ├── nutritionPersistence.js
    ├── nutritionDiversification.js
    ├── nutritionPlanFactory.js
    ├── nutritionGenerateHandlers.js
    ├── nutritionGoals.js               (legacy)
    ├── nutritionPlanEngine.js          (legacy engine)
    ├── nutritionEmailService.js        (legacy)
    ├── nutritionPdfRenderer.js         (legacy adapter)
    ├── supplementDatabase.js           (legacy data)
    └── (4.x'de eklenecek)
        ├── nutritionFormSync.js        (3F1 — syncNutritionAccordionInputs)
        └── nutritionViewState.js       (3F2 — view tab + PDF page + button label)
```

### app.js'in Hedef Boyutu

**Şu an:** 9607 satır
**4.x hedef:** **500-800 satır**
**Azalma:** ~%92-95

### app.js'in Hedef Rolü (Bootstrap-only)

```js
// app.js (post-4.x, hedef ~700 satır)

// ─── 1. Module guards (~50 satır) ─────────────────────────────────
if (!window.BSMNutritionHelpers) throw new Error(...);
// ... (her domain modülü için guard)

// ─── 2. Cross-domain destructure (~80 satır) ──────────────────────
const { state, escapeHtml, makeId, ... } = window.BSMCoreUtils;
const { ... } = window.BSMNutritionHelpers;
const { ... } = window.BSMMemberRenderers;
const { ... } = window.BSMProgramBuilder;
// ...

// ─── 3. Top-level DOM ref'leri (~30 satır) ────────────────────────
const memberPanel = document.querySelector("#membersPanel");
const programPanel = ...
// ...

// ─── 4. initialize() — module init injection (~200 satır) ─────────
function initialize() {
  window.BSMNutritionHelpers.init({ ... });
  window.BSMMemberRenderers.init({ ... });
  window.BSMProgramBuilder.init({ ... });
  // ...

  // Cross-domain wiring
  bindApplicationHandlers();
  initNavigation();
  syncStartupUi();
  hydrateInitialSession();
  setActiveScreen(...);
}

// ─── 5. Top-level event listeners (~50 satır) ─────────────────────
window.addEventListener("bsm:auth:ready", () => { ... });

// ─── 6. App entry point ──────────────────────────────────────────
initialize();
```

---

## 2. Domain Sınırları

### nutrition/ ✅ (referans implementasyon)

**LOC:** 4548 (15 modül)
**Refactor:** Tamamlandı (Part 1–3E2)
**Pattern:** 7 sorumluluk katmanı:

| Katman | Modül | Sorumluluk |
|---|---|---|
| **Helpers** | nutritionHelpers.js | Pure functions (calc, format, parse) |
| **Engine adapters** | nutritionPlanFactory.js | Engine bridge (livePreview generation) |
| **Persistence** | nutritionPersistence.js | Save/Print + form/plan mutations |
| **Renderers (saf)** | nutritionRenderers.js, nutritionPremiumRenderers.js | HTML output, DOM mutation |
| **Orchestration** | nutritionPremiumWorkspace.js | Multi-renderer composition |
| **Handlers (events)** | nutritionPremiumHandlers.js, nutritionGenerateHandlers.js | Event delegation + reactive |
| **Domain-specific** | nutritionDiversification.js, nutritionPdfPipeline.js | Domain compute (diversify, PDF) |

**Bu pattern diğer domain'lere uygulanacak.**

### members/ (sıradaki en mantıklı domain)

**Tahmini LOC:** ~1500 satır
**App.js'deki konumlar:**

| Fonksiyon / Blok | ~Satır | Hedef Modül |
|---|---|---|
| `renderMemberWorkspace` (4232) | 200 | memberWorkspace.js |
| `renderMembersKpiStrip` (5199) | 100 | memberRenderers.js |
| `renderActiveMemberProfile` (6060) | 50 | memberRenderers.js |
| `renderMemberList` (6097) | 50 | memberRenderers.js |
| Member CRUD handlers | ~300 | memberHandlers.js |
| Member form bind | ~200 | memberHandlers.js |
| `persistMembers` + member sync | ~150 | memberPersistence.js |
| Member auto-save | ~150 | memberPersistence.js |
| Misc member helpers | ~300 | memberRenderers/Helpers |

### measurements/ (orta risk)

**Tahmini LOC:** ~1500 satır
**App.js'deki konumlar:**

| Fonksiyon / Blok | ~Satır | Hedef Modül |
|---|---|---|
| `renderMeasurementPremiumInsight` (2724) | 80 | measurementRenderers.js |
| `renderMeasurementLeftSummary` (2812) | 80 | measurementRenderers.js |
| `renderMeasurementTrendCard` (2999) | 200 | measurementTrendCharts.js |
| `renderMeasurementReport` (3118) | 100 | measurementReport.js |
| `renderMeasurementTabStatus` (5513) | 50 | measurementTabs.js |
| `renderMeasurementMemberHero` (5581) | 70 | measurementRenderers.js |
| `renderMeasurementCsvAnalytics` (5651) | 350 | measurementCsvAnalytics.js |
| `renderMeasurementHistory` (6148) | 50 | measurementRenderers.js |
| `renderMeasurementHistoryTrendHost` (6194) | 75 | measurementTrendCharts.js |
| `renderPremiumMeasurement*` (6471-6515) | 200 | measurementTrendCharts.js |
| Measurement tab event bind | ~150 | measurementTabs.js |
| Tanita CSV import | ~100 | measurementCsvAnalytics.js |

### programs/ (en büyük, en riskli)

**Tahmini LOC:** ~2000 satır
**App.js'deki konumlar:**

| Fonksiyon / Blok | ~Satır | Hedef Modül |
|---|---|---|
| Program wizard fn'leri | 500 | programWizard.js |
| `renderProgram` (8425) + sub-render | 500 | programRenderers.js |
| `renderProgramEditToolbar` (8751) | 50 | programEditMode.js |
| `applyProgramExerciseEdit` | 200 | programEditMode.js |
| `renderProgramCover` (9163) | 50 | programRenderers.js |
| `renderProgramHistory` (6612) | 100 | programHistory.js |
| `renderPremiumProgramHistory` (6636) | 100 | programHistory.js |
| Program form handlers | 300 | programBuilder.js |
| Exercise replacement | 200 | programBuilder.js |

### output/ (küçük, orta risk)

**Tahmini LOC:** ~600 satır
**App.js'deki konumlar:**

| Fonksiyon / Blok | ~Satır | Hedef Modül |
|---|---|---|
| `renderOutputIntelligence` (8498) | 200 | outputIntelligence.js |
| `renderNutritionOutput` + getter | 25 | outputRenderers.js (nutrition'dan taşınır) |
| Output PDF actions | 150 | outputActions.js |
| Output HTML/Mail actions | 100 | outputActions.js |
| Output panel bind | 100 | outputActions.js |

### library/ (en küçük, en düşük risk)

**Tahmini LOC:** ~500 satır
**App.js'deki konumlar:**

| Fonksiyon / Blok | ~Satır | Hedef Modül |
|---|---|---|
| `renderLibrary` (9211) | 250 | libraryRenderers.js |
| `renderCustomExerciseList` | 100 | libraryCustomExercise.js |
| Custom exercise CRUD | 100 | libraryCustomExercise.js |
| Video modal handlers | 50 | libraryVideoModal.js |

### dashboard/ (orta küçük, düşük-orta risk)

**Tahmini LOC:** ~500 satır
**App.js'deki konumlar:**

| Fonksiyon / Blok | ~Satır | Hedef Modül |
|---|---|---|
| `renderDashboard` (5301) | 150 | dashboardRenderers.js |
| `renderCoachAlertsPanel` (5979) | 50 | dashboardCoachAlerts.js |
| `renderV3DashboardCalendar` (6005) | 100 | dashboardCalendar.js |
| `renderCoachTaskPanel` (6034) | 50 | dashboardCoachAlerts.js |
| `renderCoachQuickPanel` (6047) | 50 | dashboardCoachAlerts.js |
| Dashboard wiring | 100 | dashboardRenderers.js |

### shared/core/ (cross-domain helpers)

| İçerik | Konum |
|---|---|
| `BSMCoreUtils` (escapeHtml, makeId, formatDate, …) | Zaten core/ |
| `BSMOptionData`, `BSMLabelData`, `BSMPresetData` | Zaten ayrı modüllerde |
| `BSMExerciseData` | Zaten ayrı |
| `BSMRouter`, `BSMTestApi` | core/router.js (zaten), app.js (test API) |
| `state` global, `persistMembers`, Supabase sync | 4.x'de muhtemelen `core/state.js` |

---

## 3. Bootstrap Sorumluluğu

### app.js → Bootstrap-Only Rol

4.x sonrası app.js sadece şunlardan sorumlu olacak:

1. **Module load order kontrolü** (guard'lar)
2. **Cross-domain destructure** (modüllerden gelen API'leri tek noktada toplama)
3. **Top-level DOM ref'leri** (panel + button const'ları)
4. **`initialize()` orchestration** — her domain modülünü DI ile init et + bind handlers
5. **App entry point** (`initialize()` çağrısı + `bsm:auth:ready` listener)

### Cross-Domain Coupling Noktaları

Aşağıdaki state/fn'ler birden fazla domain tarafından paylaşılır — `core/` veya `shared/` altında merkezi olur:

| Paylaşılan | Hangi domain'ler |
|---|---|
| `state` | Tüm domain'ler (read), nutrition + program + measurement (write) |
| `findActiveMember` | members, nutrition, program, measurement, output |
| `showStatus` | Tüm domain'ler (toast notify) |
| `persistMembers` | members, nutrition (member.nutritionPlan), program |
| `renderNutritionWorkspace` (wrapper) | nutrition (kendi) + members (workspace flow) |
| `renderMemberWorkspace` | members (kendi) + nutrition (post-save) |
| `BSMRouter.navigate` | Tüm domain'ler (sayfa geçişleri) |
| `escapeHtml`, `formatDate` | Tüm domain'ler (rendering) |

---

## 4. Risk Haritası

| Domain | LOC | Risk | Test ağı | Gerekçe |
|---|---|---|---|---|
| **library/** | ~500 | 🟢 Düşük | e2e #14, #15 | İzole, az dependency, e2e kapsamı var |
| **output/** | ~600 | 🟢 Düşük | e2e #16 | Çoğunlukla render glue + PDF/mail action |
| **dashboard/** | ~500 | 🟡 Düşük-Orta | Yok | Coach alerts + calendar render — test ağı yok |
| **measurements/** | ~1500 | 🟡 Orta | e2e #4, #5 | 6 tab + CSV import + chart render — coupling var |
| **members/** | ~1500 | 🟡 Orta | e2e #2 | Member CRUD + workspace + state mutation merkezi |
| **programs/** | ~2000 | 🔴 Yüksek | e2e #7, #13 | En büyük, wizard + builder + edit mode, member ile coupling |

---

## 5. Önerilen Geçiş Sırası

### Faz 4A: Düşük Riskli Domain'ler (4 hafta tahmini)

#### 🥇 **4A.1 — library/** (1 sprint, ~500 satır)
- En izole domain, az dependency
- e2e #14, #15 kapsama var
- Nutrition pattern'in ilk dış uygulaması
- **Çıktı:** library/libraryRenderers.js + libraryCustomExercise.js + libraryVideoModal.js

#### 🥈 **4A.2 — output/** (1 sprint, ~600 satır)
- Render glue + PDF/Mail actions
- e2e #16 kapsama var
- `renderNutritionOutput` nutrition'dan output/'a taşınır (ev sahibi değişimi)
- **Çıktı:** output/outputRenderers.js + outputIntelligence.js + outputActions.js

#### 🥉 **4A.3 — dashboard/** (1 sprint, ~500 satır)
- Test ağı yok → ÖNCE `12-dashboard.spec.js` yazılmalı (regression-first)
- Coach alerts + calendar + KPI strip
- **Çıktı:** dashboard/*.js + tests/e2e/12-dashboard.spec.js

### Faz 4B: Orta Riskli Domain'ler (3-4 hafta)

#### **4B.1 — measurements/** (2-3 sprint, ~1500 satır)
- 6 tab navigation + CSV import + chart render
- Sub-sprintlere bölünebilir:
  - 4B.1.1 — Tab navigation + member hero
  - 4B.1.2 — Trend charts + sparkline
  - 4B.1.3 — CSV analytics + report
- **Test gereksinimi:** Mevcut #4, #5 yeterli ama CSV import için yeni spec önerilir

#### **4B.2 — members/** (2-3 sprint, ~1500 satır)
- Member CRUD + workspace + state mutation
- Sub-sprintlere bölünebilir:
  - 4B.2.1 — Renderers (workspace, list, profile, KPI)
  - 4B.2.2 — Handlers (CRUD events)
  - 4B.2.3 — Persistence (Supabase sync + localStorage)
- **Test gereksinimi:** Mevcut #2 yeterli, ama member CRUD event'leri için yeni spec önerilir

### Faz 4C: Yüksek Riskli Domain (5-6 hafta)

#### **4C — programs/** (4-5 sprint, ~2000 satır)
- En büyük, en karmaşık
- Sub-sprintlere bölünmesi ZORUNLU:
  - 4C.1 — Program wizard (form steps)
  - 4C.2 — Program builder (CRUD)
  - 4C.3 — Program renderers (canvas, cover)
  - 4C.4 — Program edit mode (inline editing)
  - 4C.5 — Program history
- **Test gereksinimi:** Mevcut #7, #13 yeterli değil → yeni 2-3 spec gerekir
- **Risk azaltıcı:** 4A + 4B sonrası mimari kalıbı netleşmiş olacak

---

## 6. 4.x Migration Strategy

### Temel İlkeler

#### 1. **Küçük rollbackable sprintler**

Her sprint:
- Tek bir modül veya alt-modül grubu
- Tek bir commit ile push edilir
- Independent revert mümkün (`git revert <SHA>`)
- En fazla 1 saatlik iş

**Anti-pattern:** "Tüm members/ domain'i tek commit'te" — TEHLİKELİ. Sprint başına 200-400 satır extract.

#### 2. **Regression-first yaklaşımı**

```
Sprint X başlangıç:
  1. Mevcut test ağı yeterli mi? — Domain coverage matrix kontrol
  2. Yetersizse ÖNCE test ekle (baseline doğrulama)
  3. Test pass eder hale getir
  4. SONRA refactor başlat
  5. Refactor sonrası aynı test'ler pass etmeli
```

**Örnek:** `dashboard/` domain'i için e2e test yok → ÖNCE `12-dashboard.spec.js` yaz, baseline 19/19 hale getir, SONRA dashboard refactor başlat.

#### 3. **Test-before-refactor kuralı**

```
ZORUNLU sıra:
  1. Hedef domain'in mevcut test coverage'ını incele
  2. Eksik kritik akışlar varsa yeni spec yaz
  3. Spec baseline'da PASS olduğunu doğrula
  4. Refactor başlat
  5. Refactor sonrası spec hala PASS olmalı
  6. Pass olmazsa regression — revert + tanı + retry
```

#### 4. **Checkpoint commit stratejisi**

Her sprint sonunda:
- Stage sadece o sprint'in dosyaları
- Commit message: `refactor: ADIM 4X.Y — <domain> <kapsam>`
- Commit body: extract edilen fn'ler + DI listesi + test sonucu + davranış korumaları
- Push
- Tam e2e koş (her run sonrası)
- Working tree clean tutulur

#### 5. **Dependency injection pattern**

Nutrition'da kullanılan **birebir aynı pattern**:

```js
// Modül template:
(function () {
  "use strict";
  var _state = null;
  var _showStatus = function () {};
  // ... lazy refs

  function init(deps) {
    if (!deps) deps = {};
    _state = deps.state || null;
    if (typeof deps.showStatus === "function") _showStatus = deps.showStatus;
    // ...
  }

  // ... pure functions using _state, _showStatus

  window.BSM<DomainName> = {
    init: init,
    // public API
  };
})();
```

```js
// app.js içinde:
if (!window.BSM<DomainName>) throw new Error(...);
const { fn1, fn2 } = window.BSM<DomainName>;

// initialize() içinde:
window.BSM<DomainName>.init({
  state: state,
  showStatus: function (m, t) { return showStatus(m, t); },
  // ...
});
```

#### 6. **Idempotent bind koruması (event handler'lar için)**

```js
function bind<DomainName>Handlers() {
  const btn = document.querySelector("#<button-id>");
  if (!btn) return;
  if (btn.dataset.bsm<DomainName>Bound === "true") return;
  btn.addEventListener("click", handler, true);
  btn.dataset.bsm<DomainName>Bound = "true";
}
```

#### 7. **Davranış koruma manifestosu**

Her sprint'in commit message'ında **birebir korunması gerekenler** açıkça listelenir:

```
Davranis korumalari:
1. <event flow> birebir
2. <state mutation pattern> birebir
3. <render call sequence> birebir
4. <error handling> birebir (console.error + showStatus)
5. <async/sync flow> degismedi
6. <DOM hook'lar> degismedi
```

#### 8. **Cross-domain coupling — Callback pattern**

Modüller arası bağımlılıkta **direct destructure** veya **lazy callback** kullanılır:

```js
// Lazy callback (modül A app.js'de henüz tanımlı değilse veya runtime state'e bağlıysa)
{ findActiveMember: function () { return findActiveMember(); } }

// Direct ref (modül A başka bir extracted modülde — script load order sağlam)
{ findActiveMember: findActiveMember }
```

---

## 7. Referans Domain: nutrition/

Nutrition refactor'ı (Part 1–3E2) **diğer domain split'leri için referans implementation**'dur.

### Nutrition'dan Çıkan Pattern Dersleri

| Ders | Nasıl uygulandı | Yeni domain'lerde |
|---|---|---|
| **Helpers önce** | Part 1 — pure functions | Her domain için `<domain>Helpers.js` ilk sprint |
| **Render extract orta** | Part 2/3A — PDF + saf render | Her domain için renderer'lar 2-3 sprint |
| **Orchestration sonra** | Part 3B2 — workspace orchestrator | Her domain'in workspace fn'i son adımlardan biri |
| **Handlers en son** | Part 3B3 — event delegation | Event delegation domain refactor'unun finalize aşaması |
| **Persistence ayrı modül** | Part 3C — save/print | Her domain için `<domain>Persistence.js` veya `<domain>Storage.js` |
| **Engine adapters izole** | Part 3E1 — planFactory | Engine bridge fn'leri kendi modülünde |
| **Button handler'lar izole** | Part 3E2 — generateHandlers | Her domain'in button bind'ı `<domain>Handlers.js` veya `<domain>ButtonHandlers.js` |
| **Idempotent guard zorunlu** | 3B3, 3C, 3E2 | Her bind fn'inde `dataset.bsm<Domain>Bound` |
| **Regression-first** | Part 3C öncesi save spec, 3E2 öncesi generate spec | Her riskli sprint öncesi yeni e2e spec |
| **Davranış nüansları belgelenir** | TECH-DEBT raw vs livePreview not'u | 4.x sırasında her domain için davranış manifest'i |

---

## 8. Başarı Kriterleri (4.x Tamamlandığında)

### Yeşil Çıkış Kriterleri

| Kriter | Hedef |
|---|---|
| app.js LOC | < 800 satır |
| Domain modülleri sayısı | ~25-30 modül (nutrition 15 + diğer 4 domain × 3-5 modül) |
| E2E regression suite | > 25 spec (her domain için en az 2-3) |
| Console / page / network error | 0 |
| Davranış değişikliği | 0 (sıfır) |
| Version bump | 0 (gerekirse 4.0.0 release'de) |
| Cross-domain coupling | Sadece `core/state`, `findActiveMember`, `showStatus`, `BSMRouter` üzerinden |
| Idempotent bind koruması | Tüm handler'larda guard'lı |
| Working tree clean | Her sprint sonrası ✅ |

### Anti-Pattern (Geçişte Yasak)

| Yasak | Sebep |
|---|---|
| ❌ Async/await/Promise ekleme | Sync pattern korunmalı |
| ❌ Reducer pattern ekleme | 5.x'in işi |
| ❌ Yeni feature ekleme | Refactor != yeni özellik |
| ❌ UI redesign | Görsel değişiklik yok |
| ❌ State shape değişikliği | Existing state preserve |
| ❌ DOM hook/id değişikliği | E2E test'leri kırılmamalı |
| ❌ Engine logic değişikliği | nutritionPlanEngine, exerciseLibrary dokunulmaz |
| ❌ Büyük tek-commit refactor | Sprint başına max 1 modül grubu |

---

## 9. Tahmini Takvim

```
Faz 4A — Düşük risk:    3-4 sprint × 1 hafta = ~1 ay
Faz 4B — Orta risk:     5-6 sprint × 1 hafta = ~1.5 ay
Faz 4C — Yüksek risk:   4-5 sprint × 1 hafta = ~1 ay
────────────────────────────────────────────────────
TOPLAM 4.x:             12-15 sprint = ~3.5-4 ay
```

Her sprint sonrası checkpoint commit + e2e regression run.

---

## Versiyon Notu

Bu doküman 4.x öncesi mimari planını yansıtır. Her domain split sprint'i sonrası TECH-DEBT.md ve bu doküman güncellenmeli — özellikle "Önerilen Geçiş Sırası" ve "Risk Haritası" bölümleri.

**İlk 4.x sprint'i için öneri:** **4A.1 — library/** (en izole, en düşük risk, hızlı pattern doğrulama).
