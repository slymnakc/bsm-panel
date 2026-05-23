# Nutrition Refactor Stabilization Checklist

> **Amaç:** 3B serisinden sonra runtime sağlığını doğrulamak için mekanik kontrol listesi.
> Yeni feature başlatmadan ÖNCE her madde geçilmiş olmalı. Her adım için "Kontrol nasıl yapılır" + "Beklenen" + "Mevcut" üçlüsü verilir.

**Snapshot:** commit `59a712c` · e2e 16/16 pass · 2026-05-23.

---

## ✅ 1. Duplicate Bind Kontrolü

**Risk:** `bindNutritionPremiumHandlers` iki kez çağrılırsa her click 2x state mutation + 2x render olur.

**Kontrol:**
```js
// Browser console:
document.querySelector("#nutritionPanel").dataset.bsmNutritionBound
// "true" döner — guard çalışıyor demektir.
```

E2E ek test:
```js
await page.evaluate(() => {
  // Bind'ı tekrar çağırmayı dene
  window.BSMNutritionPremiumHandlers.bindNutritionPremiumHandlers();
  window.BSMNutritionPremiumHandlers.bindNutritionPremiumHandlers();
});
// Click sayısı x1 olmalı, x2 değil.
```

**Beklenen:** Idempotent — flag set olduktan sonra çağrılar no-op.

**Mevcut:** ✅ `dataset.bsmNutritionBound === "true"` guard'ı `bindNutritionPremiumHandlers` içinde aktif (premiumHandlers.js, fn başında early return).

---

## ✅ 2. Memory Leak Kontrolü

**Risk:** `addEventListener` çağrıları cleanup olmadan birikirse memory leak ve duplicate handler.

**Kontrol:**
```js
// Chrome DevTools → Memory → Take heap snapshot
// 1. snapshot al
// 2. Beslenme sayfasını 10 kez aç/kapa
// 3. Tekrar snapshot al + Comparison: heap growth ≤ 5%
```

**Beklenen:**
- `nutritionPanel` asla DOM'dan kaldırılmıyor → listener'lar persistent
- Bind tek seferlik (guard'lı) → listener'lar tekil
- IIFE timer state (`debouncedNutritionInputHandler`) tek closure'da yaşıyor

**Mevcut:** ✅ Risk yok:
- `nutritionPanel` ana shell'in çocuğu, route değişiminde sadece `is-hidden` class toggle ediliyor — DOM'dan silinmiyor
- `bindNutritionPremiumHandlers` idempotent
- IIFE timer modül seviyesinde tek instance

---

## ✅ 3. Preview/Export Parity Kontrolü

**Risk:** PDF preview (canvas) ve PDF export (print root) farklı HTML üretirse user'ın gördüğü ile basılan birbirinden ayrılır.

**Kontrol:**
```js
// e2e test 06-nutrition-pdf:35 (mevcut):
// "Print Root preview ile bire-bir ayni icerik"
// Doğrulama: prepareNutritionPrintRoot çağrıldıktan sonra
//   #nutritionPrintRoot.innerHTML === #bsmPdfCanvas.innerHTML
```

**Beklenen:** İki HTML birebir aynı (renderPdfPage1/2 her ikisi için de çağrılır).

**Mevcut:** ✅ E2E test #12 doğruluyor — son run 10.3s'de pass. Print Root pattern (Part 3 v1.3.3) DOM'da `<div id="nutritionPrintRoot">` clone container kullanıyor.

---

## ✅ 4. State Sync Kontrolü

**Risk:** Capture phase handler bubble phase'den önce çalışırsa sync sorun yok; ama yanlış sırada accordion sync user'ın input'unu eski state'le ezerse veri kaybı.

**Kontrol:**
```js
// 1. Kalori inputuna 2500 yaz
// 2. 300ms bekle (debounce)
// 3. State kontrol: state.nutritionFormState.calories === 2500
// 4. UI kontrol: #nutritionCaloriesInput.value === "2500" (syncAccordionInputs ezmemiş)
```

E2E test 05-nutrition-reactive:5 (mevcut): "Kalori degisince preview totals guncellenir" — bu state sync'i de implicitly test ediyor.

**Beklenen:**
- Input event capture phase'de state INSTANT update
- 300ms sonra render
- syncNutritionAccordionInputs sonradan çağrılınca state'i okur, ezmez

**Mevcut:** ✅ Capture phase `addEventListener(..., true)` flag korundu. `debouncedNutritionInputHandler` state'i hemen update ediyor, render gecikmeli. Test #8 doğruluyor.

---

## ✅ 5. Supabase Race Riskleri

**Risk:** İki Supabase event aynı anda gelirse (örn. realtime sync + manual save) member state corruption.

**Senaryolar:**
- User save'ye basar → Supabase'e yazar
- Aynı anda realtime member update gelir → local state'i ezer
- User'ın save'i kaybolur

**Kontrol:**
```js
// Test mode'da Supabase tamamen disable
localStorage.setItem("bsmTestMode", "true");
// → syncMembersFromSupabase + setupSupabaseRealtimeSync no-op
```

**Beklenen:**
- Production: save → optimistic local update → Supabase write → realtime echo idempotent
- Test mode: hiç Supabase çağrısı yok

**Mevcut:** 🟡 **Kısmi**
- ✅ Test mode izolasyonu çalışıyor (Refactor 2 commit `804c4df`)
- ⚠️ Production race scenario'su henüz test edilmemiş — manuel QA gerekli
- ⚠️ Save handler bindNutritionPremiumHandlers DIŞINDA (3B3 kapsam dışı) — race riski tam taranamadı

**Aksiyon:** Production'da realtime sync sırasında save denemesi yap, conflict resolution gözlemle. (Manuel.)

---

## ✅ 6. Render Loop Riskleri

**Risk:** Handler içinde render çağrısı yeni event tetiklerse sonsuz döngü.

**Tarama:**
- `renderNutritionWorkspace` çağrıları: handler'lar (event triggered) → render → DOM update
- DOM update event tetikler mi? `change`/`input` event'leri programmatic value set'ten tetiklenmez (default davranış)
- `syncNutritionAccordionInputs` programmatic value set yapar — event tetiklemez
- View tab class toggle → DOM event yok
- Sadece user-triggered event'ler render çağırır

**Kontrol:**
```js
// Sentinel: render call count
let renderCount = 0;
const orig = renderNutritionWorkspace;
window.renderNutritionWorkspace = (...args) => { renderCount++; orig(...args); };
// 1 click sonrası renderCount artışı === 1 olmalı (≠ 2)
```

**Beklenen:** Tek click = 1 render. Cascade yok.

**Mevcut:** ✅ Risk yok:
- Capture phase guard: state instant update + debounced render
- Programmatic DOM mutation (`syncAccordionInputs`) event firmiyor
- `enable-supplements` action `accordion.setAttribute("open", "")` → toggle event tetiklenebilir ama dinleyici sadece scrollIntoView yapıyor, render çağırmıyor
- Render içinde state mutation YOK (read-only)

---

## ✅ 7. Smoke / E2E Final Run

**Beklenen:** 16/16 pass, 0 error.

**Mevcut:**
```
npm run test:e2e (post-stabilization):
  16 passed (2m 18s)
  Reactive tests: ✅ #8, #9, #10
  PDF tests: ✅ #11, #12
  Library tests: ✅ #14, #15
  Output tests: ✅ #16
```

---

## ✅ 8. Working Tree Hijyeni

**Kontrol:** Smoke/e2e koştuktan sonra git status'ta gereksiz untracked dosya olmamalı.

**Beklenen:** Tracked dosyalar clean, untracked listesi boş (veya sadece yeni doc dosyaları).

**Mevcut:** ✅ Stabilization sprint sonrası:
- `.gitignore` modified (tests/_report/ pattern eklendi)
- Yeni doc dosyaları: TECH-DEBT.md, STABILIZATION-CHECKLIST.md (kasıtlı, commit'lenecek)
- Smoke/e2e sonrası tests/_report/ ignored — untracked olarak görünmüyor ✅

---

## Sprint Sonu Özet

| Kontrol | Durum |
|---|---|
| 1. Duplicate bind guard çalışıyor | ✅ |
| 2. Memory leak yok | ✅ |
| 3. Preview/export parity | ✅ |
| 4. State sync (capture phase) | ✅ |
| 5. Supabase race | 🟡 Test mode OK, prod manuel QA gerekli |
| 6. Render loop yok | ✅ |
| 7. E2E 16/16 | ✅ |
| 8. Working tree hijyenik | ✅ |

**Genel sağlık:** 🟢 Stabil. 3C/3D refactor'larına geçiş güvenli.
