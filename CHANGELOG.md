# Changelog

Bu dosya BSM Panel sürümlerindeki tüm önemli değişiklikleri belgeler.
Format [Keep a Changelog](https://keepachangelog.com/) yaklaşımına uyar
ve sürümleme [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`)
prensibini izler.

---

# BSM Panel v1.5.13 — "Üye Detayında Kayıtlı İçerik Görünürlüğü"

**Yayın tarihi:** 2026-07-07
**Önceki sürüm:** 1.5.12

## Fixes

### BUG-MEMBER-DETAIL-001 — Üyeler ekranında kayıtlı içerikler artık görünüyor
- Üyeler ekranında seçili üyenin **kayıtlı program özeti** gösteriliyor:
  başlık, kayıt tarihi, gün/egzersiz sayısı, geçmiş program adedi ve ilk
  egzersizlerin Set/Tekrar satırları
- **Kayıtlı beslenme planı özeti** gösteriliyor: plan tarihi, hedef,
  günlük kalori, makrolar (protein/karbonhidrat/yağ) ve öğün sayısı
- Program/Beslenme wizard adımlarına tıklanınca kullanıcı artık
  **üyeler ekranında kalıyor** (önceden Builder/Beslenme ekranına fırlıyordu)
- İlgili ekranlara geçiş için özet içinde **CTA** eklendi:
  "Programı Aç (Üye Çıktısı)" ve "Beslenme Planını Aç"
- **Ölçüm görünürlüğü korundu** (metrik grid + geçmiş grafiği)
- Status check ("tamamlandı" işaretleri) ile **gerçek içerik görünürlüğü
  tutarlı** hale getirildi — tamamlanmış adım artık boş yönlendirme metni
  yerine kayıtlı veriyi gösterir
- Boş üyede oluşturma yönlendirmeleri korunur; "Aç" CTA'sı gösterilmez
- Footer "Önceki/Sonraki Adım" ve sağ paneldeki "Oluştur" aksiyonlarının
  ekran geçiş davranışı değişmedi

## Tests

- Yeni: `tests/e2e/44-member-detail-content.spec.js` (5 test) — test-first,
  baseline FAIL doğrulamalı: ekranda kalma + program/beslenme özetleri,
  ölçüm regresyonu, status↔içerik tutarlılığı, boş üye davranışı
- Full e2e: **110 passed + 1 skipped (111 test)** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 43× `?v=`
  cache-bust 1.5.12 → 1.5.13

---

# BSM Panel v1.5.12 — "Supabase Sync Hata Bildirimi"

**Yayın tarihi:** 2026-07-07
**Önceki sürüm:** 1.5.11

## Fixes

### BUG-SAVE-001 — Supabase senkron hatası artık kullanıcıya bildiriliyor
- Supabase/cloud sync hataları **görünür uyarıyla** bildiriliyor; önceden yalnız
  `console.warn`'a gidiyor, kullanıcı her koşulda "kaydedildi" görüyordu
- Uyarı metni hata türüne göre yönlendirme içerir: *"Yerel kayıt tamamlandı,
  ancak bulut senkronizasyonu başarısız oldu."* + oturum yenileme (auth) /
  bağlantı kontrolü (network) / otomatik tekrar deneme (diğer)
- **localStorage-first kayıt mimarisi korundu** — kaydet butonu beklemez,
  yerel kayıt her koşulda tamamlanır; uyarı sync sonucu geldiğinde gösterilir
- **Program, Tanita/ölçüm ve beslenme** kayıtları ortak hata bildirim
  davranışını kullanır (merkezi `BSMSyncStatusNotifier`)
- Dashboard `supabaseStatus` alanında **"Senkron hatası"** durumu gösterilir;
  başarılı sync sonrası hata göstergesi otomatik temizlenir
- Supabase kapalı/offline/test modunda uyarı çıkmaz (lokal mod hata değildir)
- Hata sebebi normalize edilir: RLS/auth/session (42501, PGRST301, JWT),
  network, generic sync

### Kapsam dışı (dokunulmadı)
- **BUG-SAVE-002** (aktif üye yokken sessiz yeni üye oluşturma) ayrı iş olarak
  bırakıldı — 43-spec'te `test.fixme` placeholder ile işaretli
- BUG-PDF-002 dosyaları, PDF'ler, program generation, set-template,
  measurement report, GIF manifest, auth/RLS, şema: **değişmedi**

## Tests

- Yeni: `tests/e2e/43-save-persistence.spec.js` (6 test + 1 fixme) — test-first,
  baseline FAIL doğrulamalı: üç akışta kalıcılık (kaydet→reload), Supabase upsert
  payload/onConflict sözleşmesi, hata bildirimi, başarı davranışı korunumu
- Full e2e: 99 → **105 passed + 1 skipped (106 test)** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 43× `?v=`
  cache-bust 1.5.11 → 1.5.12

---

# BSM Panel v1.5.11 — "Program PDF Türkçe Font Embedding"

**Yayın tarihi:** 2026-07-07
**Önceki sürüm:** 1.5.10

## Fixes

### BUG-PDF-002 Faz 2 — Program PDF Türkçe karakter düzeltmesi
- Program PDF'inde `ş Ş ğ Ğ ı İ` karakterleri artık **doğru render edilir**
  (base-14 Helvetica bu glyph'leri içermiyordu; ç/ö/ü zaten sağlamdı)
- **PT Sans Regular** (SIL OFL 1.1) PDF'e **gömülü TrueType** font olarak eklendi:
  `/FontFile2`, `/FontDescriptor`, `/Widths`, `/ToUnicode` objeleri üretilir
- WinAnsiEncoding + Differences düzeni ve mevcut metin/layout motoru
  (`encodePdfWinAnsiText`, kart/page-break) **değişmeden korunur**
- `/ToUnicode` CMap ile kopyala/yapıştır ve text extraction doğru Türkçe verir
- Yeni build-time üretici: `scripts/build-pdf-font.js` →
  `services/pdf-font-data.js` (runtime'da TTF parse edilmez)
- PDF boyutu font gömme nedeniyle ~21KB → ~440KB (2MB sınırının altında)

### Kapsam dışı (dokunulmadı)
- **Nutrition PDF ve diğer modüller etkilenmedi** (auth/RLS, measurement report,
  GIF manifest, program generation, set/rep template — hepsi değişmedi)

## Tests

- Yeni: `tests/e2e/42-program-pdf-turkish-font.spec.js` (6 test) — test-first,
  baseline FAIL doğrulamalı: byte mapping, embedding objeleri, ToUnicode,
  sfnt stream, boyut bandı, Faz 1 layout regresyonu
- Full e2e: 93 → **99/99 PASS** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 43× `?v=`
  cache-bust 1.5.10 → 1.5.11

---

# BSM Panel v1.5.10 — "Library GIF Manifest Fallback"

**Yayın tarihi:** 2026-07-06
**Önceki sürüm:** 1.5.9

## Fixes

### BUG-LIBRARY-GIF-001 — Eksik egzersiz GIF'lerine manifest/allowlist fallback
- Library ekranında eksik `assets/gifs/*.gif` dosyaları için artık **network
  isteği yapılmaz** → canlıda 404 ve console error üretilmez (pre-existing bug;
  v1.5.8/v1.5.9'da da aynı dosyalar eksikti)
- Yeni **`data/gif-manifest.js`**: repo'da gerçekten var olan GIF slug'ları
  allowlist olarak tutulur (assisted-dip, assisted-pull-up, back-extension,
  band-assisted-dip, band-resisted-push-up, barbell-bench-press)
- `buildExerciseMedia` slug ve alias adaylarını **manifest üzerinde çözer**;
  manifest'te olmayan egzersizlerde `gifUrl` boş döner
- Boş `gifUrl` → mevcut `renderMissingExerciseMedia` **video CTA fallback'i**
  devreye girer; kırık görsel yerine "Video İzle" kartı görünür
- Manifest'te olan gerçek GIF'ler `<img>` ile gösterilmeye devam eder
- Explicit/custom/remote `gifUrl` davranışı korunur (manifest'ten muaf)
- Library search/filter/grid ve Output/media regresyonları korunur

### Kapsam dışı (dokunulmadı)
- Gerçek GIF asset tamamlama **yapılmadı** (ayrı backlog; yeni GIF eklendiğinde
  `data/gif-manifest.js` güncellenmelidir)
- Auth/RLS, measurement report, program PDF, Tanita parser, server.js: **değişmedi**

## Tests

- Yeni: `tests/e2e/41-library-gif-fallback.spec.js` (5 test) — test-first,
  baseline FAIL doğrulamalı: eksik GIF'te video CTA + sıfır network isteği,
  mevcut GIF korunur, explicit muafiyet, library regresyon
- Full e2e: 88 → **93/93 PASS** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html `?v=`
  cache-bust 1.5.9 → 1.5.10
- **index.html cache-bust sayısı 42 → 43** (yeni `data/gif-manifest.js?v=`
  script tag'i eklendi; sonraki release'lerde beklenen adet 43)

---

# BSM Panel v1.5.9 — "Measurement Report Compact View + Print Fix"

**Yayın tarihi:** 2026-07-06
**Önceki sürüm:** 1.5.8

## Changed

### BSM-MEASURE-UX-001 Faz A — Ölçüm raporu sadeleştirme
- Tek ölçümde `Trend ve Koç Aksiyon Planı` büyük trend article'ı **artık render
  edilmez** (`trends.hasTrend === false` → trend sayfası DOM'a basılmaz)
- Tek ölçümdeki büyük boş trend placeholder kaldırıldı → rapor 3 → **2 sayfa**
- 2+ ölçümde trend korunur ve **`Gelişim Trendi`** olarak render edilir; sayfa
  yalnız trend grafikleri + fark tablosuna odaklanır
- Koç yorumu / aksiyon / takip bilgileri büyük trend sayfasından çıkarılıp
  kompakt **`Koç Notu`** kartına taşındı (en fazla 3 madde: Antrenman /
  Beslenme / Takip; boş data'da güvenli şekilde render edilmez)
- Direnç / Empedans teknik verileri **`Detaylı Teknik Veriler`** adlı native
  `<details>` altına alındı — web preview'da kapalı başlar, istenirse açılır

## Fixes

### Measurement print/PDF boş çıktı düzeltmesi (pre-existing)
- Ölçüm raporu PDF'i (`window.print()`) **önceden beri boş çıkıyordu**:
  nutrition print kuralı `body > *:not(#nutritionPrintRoot)` tüm body
  çocuklarını (#appLayout dahil) gizliyordu
- Kural **`body:has(#nutritionPrintRoot)`** ile koşullandırıldı → nutrition
  print/PDF davranışı aynen korunur, ölçüm raporu print/PDF artık boş çıkmaz
- `beforeprint` sırasında measurement tech details otomatik açılır,
  `afterprint` sırasında eski open state geri yüklenir → empedans değerleri
  PDF/print çıktısından düşmez

### Korunanlar
- Üye ve ölçüm bilgileri, genel skor / özet, vücut kompozisyonu, segmental
  analiz, sağlık göstergeleri, skor kartları, 2+ ölçüm trend davranışı

### Kapsam dışı (Faz B / dokunulmadı)
- Skor strip redesign ve segmental redesign **yapılmadı**
- Program PDF, server.js, Tanita parser, Auth/RLS: **değişmedi**

## Tests

- Yeni: `tests/e2e/40-measurement-report-compact.spec.js` (6 test) — test-first,
  baseline FAIL doğrulamalı: tek ölçümde trend gizli, 2+ ölçümde trend korunur,
  Koç Notu kompakt kart, empedans details kapalı, print reveal, çekirdek bölümler
- Full e2e: 82 → **88/88 PASS** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 42× `?v=`
  cache-bust 1.5.8 → 1.5.9

---

# BSM Panel v1.5.8 — "Program PDF Layout Readability Fix"

**Yayın tarihi:** 2026-07-05
**Önceki sürüm:** 1.5.7

## Fixes

### BUG-PDF-002 Faz 1 — Program PDF okunabilirlik düzeltmesi
- Üyeye verilen antrenman programı PDF'i **tek kolon layout**'a alındı
- Sabit 54pt iki kolon egzersiz kartları kaldırıldı
- Egzersiz kart yüksekliği **içerik satırlarına göre dinamik** hesaplanır →
  kart içi metin overlap'i giderildi; not/açıklama metni wrap eder ve kart
  dışına taşmaz
- `Model: Fixed` gibi teknik model bilgileri üye çıktısından **gizlendi**
- İngilizce `Sets` kaldırıldı → Türkçe **`Set/Tekrar`** formatı
- Set/Tekrar, Dinlenme, Tempo ve Not **ayrı satırlara** ayrıldı (eski tek satır
  `|` ile birleştirilmiş metrik düzeni kaldırıldı)
- **Page-break** içerik yüksekliğine göre iyileştirildi: kart sığmıyorsa yeni
  sayfa, gün başlığı sayfa sonunda tek bırakılmaz, support notes için kalan
  alan kontrol edilir (eski odd/even y-hack kaldırıldı)
- Yeni yardımcılar: `buildExerciseCardRows`, `measureExerciseCardHeight`
  (program-PDF'e özel)

### Kapsam dışı (Faz 2 / dokunulmadı)
- **Türkçe TTF/font embedding YAPILMADI** — base-14 Helvetica korundu;
  `ş/ı/ğ` glyph problemi BUG-PDF-002 Faz 2'ye bırakıldı
- Generation logic, payload logic, Nutrition PDF, Auth/RLS: **değişmedi**
- `formatRepModelLabel` korundu ama egzersiz kartında çağrılmıyor

## Tests

- Yeni: `tests/e2e/39-program-pdf-layout.spec.js` (4 test) — test-first, baseline
  FAIL doğrulamalı: Model/Sets kaldırma, layout restructure (iki-kolon sabit kart
  yok), Türkçe Set/Tekrar, endpoint smoke (200 + application/pdf)
- Full e2e: 78 → **82/82 PASS** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 42× `?v=`
  cache-bust 1.5.7 → 1.5.8

---

# BSM Panel v1.5.7 — "Program Set Template Generation Fix"

**Yayın tarihi:** 2026-07-05
**Önceki sürüm:** 1.5.6

## Fixes

### BUG-SET-001 — Program generation seçilen set/tekrar template'ini korur
- Program oluştururken kullanıcının seçtiği `repetitionTemplate` (piramit preset
  vb.) artık generation aşamasında **korunur**; goal/kind bazlı fallback ezmez
- Kök neden: `services/session-exercise-service.js` `buildPrescription` form'un
  `data.repetitionTemplate`'ini okumuyordu → her strength egzersizine goal/kind
  bazlı hard-coded reçete atıyordu
- Örnek: kullanıcı `15-12-10-8` seçerse `15-12-10-8`, `12-10-8-6` seçerse
  `12-10-8-6` korunur; sabit canonical pattern zorlanmaz
- Pattern üç katmanda doğrulandı: **activeProgram** · **preview/output** ·
  **PDF payload**
- Cardio/conditioning/mobility/core erken return davranışı korundu; template
  yoksa veya `custom` ise eski goal/kind fallback bit-identical korunur
- Saf sayı desenleri tire ile (`15-12-10-8`), aralık desenleri `•` ile yazılır
- **app.js dokunulmadı** (form template zaten exact preset'i taşıyor;
  `selectSuggestedRepetitionPreset` yalnız edit-time yolunda). PDF server/layout
  **değişmedi.** Bağımsız BUG-PDF-001 (layout/boş PDF/Türkçe/taşma) bu release
  kapsamında **değildir**

## Tests

- Yeni: `tests/e2e/38-program-set-system.spec.js` (5 test) — test-first, baseline
  FAIL doğrulamalı: 15-12-10-8 korunması, 12-10-8-6 korunması + 15-12-10-8
  zorlanmaması, PDF payload, goal-bağımsızlık, fallback
- Full e2e: 73 → **78/78 PASS** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 42× `?v=`
  cache-bust 1.5.6 → 1.5.7

---

# BSM Panel v1.5.6 — "Builder Compact Steps + View Density Toggle"

**Yayın tarihi:** 2026-07-04
**Önceki sürüm:** 1.5.5

## Highlights

Progressive disclosure serisinin son iki parçası: builder adım şeridi görsel
olarak sadeleştirildi ve kullanıcıya global Basit/Profesyonel görünüm tercihi
eklendi. Hiçbir özellik kaldırılmadı, hiçbir ID/mekanik değişmedi.

## Improvements

### Builder Adım Şeridi Kompaktlaştırma (BSM-UX-004g)
- `.builder-steps` şeridi CSS-only kompaktlaştırıldı: span min-height 54→40px,
  padding/font küçültüldü, numara balonu 26→20px (strip yüksekliği ~70→56px)
- Etkin boyut `#plannerForm.builder-wizard-active .builder-steps span`
  kurallarından geldiği için override aynı specificity ile yapıldı
- Wizard step navigation + DOM/ID/class/data-builder-step-target/role/tabIndex
  korundu; app.js ve builder-wizard.js değişmedi
- `measurement-flow-steps` zaten runtime'da retired/hidden → dokunulmadı

### Basit / Profesyonel Görünüm Toggle (BSM-UX-004h)
- Sidebar footer'a global Basit/Profesyonel segmented toggle (settings
  admin-gated olduğu için sidebar'da; herkes görür)
- Tercih localStorage'da: `formaplan-studio-view-density` (`simple`|`pro`),
  default `simple`, bilinmeyen değer → `simple`
- **Pro modda yalnızca 4 içerik-disclosure açılır:** `.output-detail-panel`,
  `.measurement-detail-fields`, `.dashboard-disclosure--activity`,
  `.library-alphabet-disclosure`
- **Exclude (asla yönetilmez):** builder ⋯ Diğer, library manager, nutrition
  accordion, segmental, v3-ai-accordion, supplement-wizard, dashboard commands
- Mod yalnızca yükleme + toggle değişiminde uygulanır; router navigasyonunda
  re-apply yok → kullanıcının manuel aç/kapatması korunur; reload'da tekrar uygulanır
- Yeni izole modül `core/view-density.js` self-init (app.js'ten sonra yüklenir;
  initialize senkron olduğu için whitelist details bootstrap'ta hazır) →
  **app.js'e dokunulmadı**

## Tests

- Yeni: `tests/e2e/37-view-density.spec.js` (5 test) — default simple, pro mode,
  persistence, manuel davranış, exclude list; test-first baseline FAIL doğrulamalı
- UX-004g için yeni spec yok (salt görsel; 21-periodization-wizard step
  tıklanabilirliğini zaten kilitliyor)
- Full e2e: 68 → **73/73 PASS** (test default simple → mevcut 68 test korundu),
  flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 42× `?v=`
  cache-bust (yeni view-density.js script dahil) 1.5.5 → 1.5.6

---

# BSM Panel v1.5.5 — "Dashboard & Library Disclosure + Test Remediation"

**Yayın tarihi:** 2026-07-04
**Önceki sürüm:** 1.5.4

## Highlights

Progressive disclosure serisi Dashboard ve Library ekranlarıyla tamamlandı;
ayrıca AUTH-002 2b-1 (RLS anon kapatma) sonrası e2e suite'i canlı Supabase'e
bağlanmadan çalışacak şekilde test-mode izolasyonu sertleştirildi. Hiçbir
özellik kaldırılmadı, hiçbir ID/mekanik değişmedi.

## Improvements

### Dashboard Progressive Disclosure (BSM-UX-004e)
- KPI şeridi, Focus (`#dashboardFocusPanel`) ve Quick Action (`#coachQuickPanel`)
  her zaman açık
- Koç Uyarıları + Görevler (`.dashboard-command-grid`) native `<details>`
  içinde, **default açık**
- Son Aktivite (`#dashboardActivity`) native `<details>` içinde, **default kapalı**
  (tarihsel log → en büyük görsel sadeleşme)
- `.dashboard-hidden-metrics` mevcut hidden haliyle korundu
- Dashboard için **ilk e2e coverage** eklendi

### Library Progressive Disclosure (BSM-UX-004f)
- Arama, filtreler, kas grubu sekmeleri ve egzersiz grid'i açık kalır
- Alfabe şeridi (`#alphabetTabs`) native `<details class="library-alphabet-disclosure">`
  içinde, **default kapalı** (A-Z nadir kullanılır, en çok yer kaplar)
- "Bul" (`#findExerciseButton`) canlı arama nedeniyle görsel **ikincilleştirildi**
  (`library-search-button--secondary`); DOM'dan çıkarılmadı, ID + handler korundu
- Canlı arama davranışı (input listener her tuşta filtreler) e2e ile kilitlendi

## Fixes

### AUTH-002 2b-1 Test Remediation
- AUTH-002 2b-1 (RLS anon → authenticated) sonrası e2e suite'in canlı Supabase'e
  anon key ile giden sync/persist yolları 401 üretiyordu (8 spec assertNoErrors fail)
- Kök neden: `supabase-sync-service` + `member-service` yalnızca `client?.from`
  guard'ına güveniyordu; test modunda inline client kurulu olduğu için çağrı
  canlıya gidiyordu
- Fix: `isTestMode()` true iken `window.supabaseClient`/`BSMSupabaseClient` null'lanır
  → tüm `client?.from` guard'ları tripler → sıfır Supabase network
- **Production-safe:** `isTestMode()` üretimde false → canlı client'a dokunulmaz.
  RLS/policy/auth-flow/console-filter değişmedi

## Tests

- Yeni: `35-dashboard-progressive.spec.js` (4 test) + `36-library-progressive.spec.js`
  (4 test) — hepsi test-first, baseline FAIL doğrulamalı
- Full e2e: 64 → **68/68 PASS** — flaky/timeout/401 yok

## Internal

- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 41× `?v=`
  cache-bust 1.5.4 → 1.5.5

---

# BSM Panel v1.5.4 — "Progressive Disclosure + RBAC Coverage"

**Yayın tarihi:** 2026-06-15
**Önceki sürüm:** 1.5.3

## Highlights

Üç ana ekranda (Output, Ölçüm, Builder) progressive disclosure: kullanıcı ilk
bakışta yalnızca ana operasyon öğelerini görür, detaylar tek tıkla açılır.
Hiçbir özellik kaldırılmadı, hiçbir ID/mekanik değişmedi. Ek olarak mevcut
client-side RBAC davranışı characterization testleriyle kilitlendi.

## Improvements

### Output Progressive Disclosure (BSM-UX-004a)
- "Tanita Bağlantılı Program Zekâsı" (`#trainingReportPanel`) kartı da
  Detaylı Analiz `<details>` altına alındı → ilk görünümde yalnızca 3 ana
  kart: Program Özeti + Haftalık Plan + Beslenme
- Yan fayda: kart önceden ekranda açık ama print'te gizliydi → artık tutarlı

### Ölçüm Formu Progressive Disclosure (BSM-UX-004b)
- Manuel Ölçüm sekmesinde katı-6 temel alan açık: Tarih, Boy, Kilo, BMI,
  Yağ %, Kas Kütlesi
- Kalan 23 alan "Detaylı Ölçümler" native `<details>` altında (4 alt bölüm:
  kimlik/zaman, ileri kompozisyon, çevre ölçüleri, ek bilgiler)
- **Auto-open:** CSV import, geçmiş ölçüm yükleme ve son ölçüm restore
  dahil TÜM programatik doldurma yolları detay alanı doldurduysa bölüm
  otomatik açılır — gizli veri riski yok; sadece açar, asla kapatmaz

### Builder Üst Aksiyon Hiyerarşisi (BSM-UX-004c)
- 6 eşit ağırlıklı aksiyon → 3 görünür öğe: Üye Programını Oluştur (primary)
  + Üyeyi Kaydet + durum mesajı
- İkincil aksiyonlar (Örnek Üye, Son Kaydı Yükle, Yeni Üye) "⋯ Diğer"
  native `<details>` dropdown menüsünde
- ID/class/handler/form davranışı aynen korundu; programatik `.click()`
  akışları kapalı menüde de çalışır

## Tests

### BSM-AUTH-001 Faz 1 — RBAC Characterization
- `tests/e2e/32-rbac-enforcement.spec.js` (4 test): BSMRbac API +
  levelOf/hasPermission/getRole matrisleri + enforce(coach/admin) +
  bsm:auth:ready event akışı + bypass + bilinmeyen rol
- Güvenlik sertleştirme DEĞİL — mevcut client-side davranış kilidi
  (sertleştirme BSM-AUTH-002 kapsamında ayrıca planlandı)

### Yeni disclosure spec'leri
- `31-output-progressive.spec.js` (1 test), `33-measurement-progressive.spec.js`
  (3 test), `34-builder-actions.spec.js` (3 test) — hepsi test-first,
  baseline FAIL doğrulamalı
- Not: kapalı `<details>` içeriği modern Chrome'da `content-visibility` ile
  gizlenir → görünürlük kontrolleri `checkVisibility()` ile

## Internal

- Full e2e: 60/60 PASS (49 → 60 test)
- Versiyon: package.json + app.js `BSM_BUILD_VERSION` + index.html 41×
  `?v=` cache-bust 1.5.3 → 1.5.4

---

# BSM Panel v1.5.3 — "fatFreeMass Full Roundtrip"

**Yayın tarihi:** 2026-06-11
**Önceki sürüm:** 1.5.2

## Highlights

Tanita CSV'deki "yağsız kütle" (fat free mass / FFM) değeri artık form → save →
profile zincirini eksiksiz kat ediyor. v1.5.2'de bilinen sınır olarak işaretlenmiş
**ikincil çift kayıp** (input yok + fieldMap'te yok) kapatıldı.

## Improvements

### fatFreeMass Form + Persist Roundtrip
- Vücut Kompozisyonu paneline `#measurementFatFree` (Yağsız kütle kg) input
  eklendi — Yağ kütlesi (`measurementFatMass`) ile Vücut suyu arasında
- `mergeMeasurementIntoProfile` fieldMap'ine `fatFreeMass` eklendi → ölçüm
  kaydedildikten sonra `member.profile.fatFreeMass` da güncellenir
- Tanita CSV parser zaten `fat free mass`/`ffm`/`yağsız kütle` alias'larıyla
  okuyordu; artık form & profile da bu değeri tutar → tam roundtrip
- Wiring: DOM ref + dispatchMeasurementInputEvents + clearMeasurementInputs +
  applyTanitaMeasurementToForm setInputValue + collectMeasurement reader +
  decorateMeasurementManualUnits + Vücut Kompozisyonu selector listesi

## Tests

### BSM-TANITA-004 — 30-spec güncellendi
- Test CSV'sine `fat free mass` kolonu eklendi (anonim değer: 52.0)
- v1.5.2'deki "bilinen sınır" iki assertion (`#measurementFatFree` yok +
  `profile.fatFreeMass` undefined) → "var ve dolu" pozitif kontrole çevrildi
- DOM doldurma (CSV → form) + persist (form → profile) zinciri end-to-end yeşil

## Internal

- Full e2e: 49/49 PASS (~7.2 dk)
- Versiyon: package.json + app.js BSM_BUILD_VERSION + index.html 41× ?v=
  1.5.2 → 1.5.3
- `data-migrations.js PROFILE_MEASUREMENT_NUMERIC_KEYS` zaten v1.5.2'de
  `fatFreeMass` içeriyordu (defensive) → persist katmanı değişmeden çalıştı

---

# BSM Panel v1.5.2 — "Tanita Profile Persist Fix"

**Yayın tarihi:** 2026-06-11
**Önceki sürüm:** 1.5.1

## Highlights

Tanita CSV import → kaydet akışında üye `profile` ölçüm özetinin (weight,
bmi, visceralFat, muscle/fat alanları, segments) localStorage'da kaybolduğu
**kritik veri kaybı bug'ını** kapatır. Sadece persist katmanı düzeltmesi —
yeni özellik yok, UI değişmedi.

## Bug fixes

### Tanita Profile Persist Fix (BSM-TANITA-005)
- `normalizeFormData` whitelist'i form alanları için tasarlandığından
  `mergeMeasurementIntoProfile`'ın `profile`'a yazdığı ölçüm özeti
  (weight, height, bmi, visceralFat, fat, muscleMass, bmr, metabolicAge,
  segments, resistance, vb.) persist sırasında siliniyordu
- `normalizeMember` artık `preserveMeasurementSummary` ile
  `mergeMeasurementIntoProfile` fieldMap'iyle birebir aynı alanları
  `sourceProfile`'dan geri yazıyor → form-only whitelist semantiği korunur,
  ölçüm özeti kaybolmaz
- Etki: Tanita ölçümü kaydedildikten sonra üye kartı profil özeti boş
  kalmıyor, sayfa yenileme/reload sonrası özet alanlar yerinde

## Tests

### BSM-TANITA-004 — DOM + Persist e2e
- `tests/e2e/30-tanita-dom-persist.spec.js` (1 test) eklendi
- Hook'suz akış: `setInputFiles` + change event + button click +
  `localStorage` doğrulaması
- CSV import → form doldurma → save → `member.measurements[0]` +
  `member.profile.{weight,bmi,visceralFat,segments}` zincirini bütün olarak
  kapsar
- Bilinen sınırları da kilitler: `#measurementFatFree` input'u yok +
  `profile.fatFreeMass` undefined

## Internal

- Tüm e2e: 49/49 PASS (~7.9 dk)
- Mevcut Tanita test coverage (TANITA-001/002/003) yeşil — regresyon yok
- Versiyon: `package.json`, `app.js BSM_BUILD_VERSION`, `index.html` 41×
  `?v=` cache-bust 1.5.1 → 1.5.2

---

# BSM Panel v1.5.1 — "Periodization UX Refinements + Tanita Test Coverage"

**Yayın tarihi:** 2026-06-07
**Önceki sürüm:** 1.5.0

## Highlights

v1.5.0 ile gelen periyodizasyon özelliğinin kullanıcı deneyimi rötuşları ve
Tanita CSV import için test güvencesi. Yeni özellik içermez; mevcut akışları
sadeleştirir, Türkçeleştirir ve test altına alır.

## Improvements

### Periyodizasyon Paneli Wizard Görünürlüğü (BSM-UX-001)
- Program oluşturma sihirbazında tam periyodizasyon paneli artık **yalnızca
  son adımda (Önizleme ve Oluştur)** görünür
- 2. adımda **özet rozet** ("8 haftalık Kademeli Artış programı") + "Düzenle"
  butonuyla son adıma hızlı geçiş
- 1., 3. ve 4. adımlarda panel gizlenir → wizard "her adım tek odak" prensibi
  geri kazanıldı; alakasız adımlarda görsel gürültü kalktı

### Periyodizasyon Terminolojisi Türkçeleştirme (BSM-UX-002)
- Terimler Türkçe + parantezli İngilizce gösterilir:
  - **Kademeli Artış (Linear)** · **Manuel Planlama** · **Hafifletme Haftası
    (Deload)** · **Kas Gelişimi (Hypertrophy)** · **Kuvvet Gelişimi (Strength)**
- Tüm görünür yüzeylerde tutarlı: rozet, model kartları, kapak bandı,
  **PDF çıktısı**, program özeti, intelligence raporu
- Üyeye verilen PDF artık tam Türkçe terminoloji içeriyor

## Internal

### Merkezi Terim Sözlüğü (BSM-UX-002)
- Periyodizasyon terimleri merkezi label map'e (`data/labels.js`) taşındı; üç
  ayrı tüketici (rozet, kapak bandı, intelligence) tek kaynaktan okur
- Önceki "Manual / Manuel / manuel" tutarsızlığı giderildi (drift kapatıldı)
- Veri modeli, engine, migration, PDF payload şeması **dokunulmadı** — yalnızca
  görüntü katmanı

### Tanita CSV Test Coverage — Faz 1 (BSM-TANITA-001)
- Tanita CSV import servis katmanı (Generic yol) otomatik test altına alındı
  (önceki coverage: 0)
- Kapsam: CSV parse, Türkçe/İngilizce başlık eşleme, en güncel kayıt seçimi,
  ölçüm nesnesi şekli (segmental + direnç), `fatFreeMass` regresyon kilidi,
  hatalı/boş CSV uyarıları
- Üretim koduna **sıfır dokunuş** (servis zaten dışa açık, test-only)
- BC-418 segmental rapor (Yol A) ve DOM/persist akışı sonraki fazlara bırakıldı

## Test

- **48/48 e2e PASS** (0 flaky, 0 retry, 0 console/page/network error)
- E2E suite: 47 → 48 spec/test

---

# BSM Panel v1.5.0 — "Periodization"

**Yayın tarihi:** 2026-06-03
**Önceki sürüm:** 1.4.3

## Highlights

Bu sürümün hikayesi: üyenizi **tek seferlik bir antrenman programıyla bırakmak yerine,
çok haftalı periyodik bir plana** alabilirsiniz. Sistem bugünün tarihine bakarak üyenin
**hangi haftada olduğunu otomatik bilir**, programın yoğunluğunu hafta hafta artırır,
toparlanma (deload) haftalarını doğru zamanda önerir.

- 📅 **4–12 hafta arası periyodik programlar** oluşturma
- 🔄 **Bugünün haftası otomatik** — sayfa açılınca doğru hafta seçili gelir
- 🗓 **Hafta hafta navigasyon** — üye yolculuğunda nerede olduğunu görebilirsiniz
- 📄 **PDF çıktısı periyodizasyon farkında** — aktif hafta ve yoğunluk başlıkta görünür
- 📱 **Mobil dostu** — tüm yeni özellikler telefon ekranında çalışır

## New Features

### 📅 Çok Haftalı Programlar (Periyodizasyon)

Program oluşturma sihirbazına **Periyodizasyon adımı** eklendi.

- **Hafta sayısı**: 4 ile 12 arası seçilebilir (varsayılan 8)
- **Linear progression**: Her hafta belirlenen oranda yük artışı (%0.5 – %5.0, varsayılan %2.5)
- **Deload (toparlanma) haftaları**: Her **3, 4 veya 6 haftada bir** otomatik yerleştirilir,
  o hafta yoğunluk **%35 düşer** (toparlanma için sport-science önerisi)
- **Program başlangıç tarihi**: Aktif hafta hesabı için kullanılır
- **Mini ve büyük canlı önizleme**: Sihirbazda ve "Önizleme & Oluştur" ekranında
  hafta hafta yoğunluk tablosu görünür

### 🗓 Hafta Hafta Navigasyon (Output ekranı)

Programın altında **hafta seçim çubuğu** belirir.

- Aktif hafta vurgulanır (mor)
- Tamamlanmış haftalar yeşil onay (✓) ile gösterilir
- Deload haftalarında ay ikonu (🌙) ve amber kenarlık
- Tıklayarak farklı haftaları görüntüleyebilirsiniz
- **Düzenleme modunda kilitlenir** — yanlışlıkla hafta değişiminden korur

### 🔄 Bugünün Haftası Otomatik (Auto Mode)

Sayfa açıldığında sistem **bugünün tarihine göre doğru haftayı** seçer.

- Program başlangıç tarihinden bugüne kadar geçen gün sayısı → aktif hafta
- "🔄 Auto · Hafta 3" yeşil rozetiyle görünür
- Sayfayı bir hafta sonra açtığınızda otomatik olarak **bir sonraki haftaya geçer**

### 🔒 Manuel Hafta Seçimi + "Auto'ya Dön"

Otomatik seçimi manuel ile geçersiz kılabilirsiniz.

- Hafta chip'ine tıkladığınızda **manuel mod**'a düşer ("🔒 Manuel · Hafta 5")
- "↻ Auto'ya dön" butonu ile tekrar otomatik moda alabilirsiniz
- Tercih sayfa yenilemelerinde **korunur** (localStorage)

### 📄 PDF Çıktısında Periyodizasyon Başlık Bandı

PDF'in ilk sayfasına aktif hafta bilgisi eklendi.

- "📅 8 Haftalık Program · Linear" başlık satırı
- "Bu çıktı: Hafta 3 / 8 · 1.05× yoğunluk"
- Aktif hafta deload ise: "🌙 Hafta 4 / 8 · DELOAD HAFTASI · 0.65× yoğunluk" (amber vurgu)
- "Sıradaki deload: Hafta 4 (1 hafta sonra)"

PDF her zaman **aktif haftayı basar** — kullanıcı hangi haftadaysa o hafta indirilir.

### 📊 Program Özeti Akıllı Hale Geldi

Output ekranındaki "Program Özeti" kartı periyodizasyon bilgisini söyler:

> *"8 haftalık linear program. Şu an Hafta 3 / 8 (yoğunluk 1.05×). Sıradaki deload: Hafta 4."*

Deload haftasında:

> *"8 haftalık linear program. Şu an Hafta 4 / 8 — deload (toparlanma) haftası, yoğunluk 0.65×."*

### 📱 Mobil Uyumluluk

Tüm yeni periyodizasyon özellikleri telefon ekranında çalışır.

- **Hafta navigasyon**: Yatay kaydırma (swipe), iOS momentum desteği
- **Touch target**: WCAG 44×44 px minimum buton boyutu
- **Auto/Manuel rozet**: Mobilde tek satır kompakt görünüm
- **Çok dar ekranlarda** (≤ 360 px, Galaxy Fold gibi): "Auto'ya dön" butonu ikon-only mod (↻)

### ⏸ Manual Mode "Yakında"

Periyodizasyon sihirbazında "Manual" seçeneğine **"Yakında"** rozeti eklendi.

- Her haftayı ayrı düzenleme özelliği geliştirme aşamasında
- Seçenek halen kullanılabilir; bu durumda tüm haftalar ilk hafta ile aynı planlanır
- Açıklayıcı yardım metni eklendi

## Improvements

### Veri Güvenliği

- **Düzenleme modunda hafta değişimi kilitlenir** — açık edit varken yanlışlıkla başka haftaya
  geçip değişiklik kaybetmek imkansız
- **Otomatik mod düzenleme modunda da kilitlenir** — auto compute kullanıcının el ile yaptığı
  düzenlemeyi ezmez

### Geriye Uyumluluk

- **Tek haftalık (eski) programlar olduğu gibi çalışır** — periyodizasyon UI'ları gizlenir,
  hiçbir akış değişmez
- **Mevcut yedeklerden geri yükleme** çok haftalı programlar dahil sorunsuz çalışır
- v3 plan formatından v4 formatına geçiş **kayıpsız** ve **otomatik**

### Kalite Güvencesi

- Otomatik test paketi 36'dan **47 senaryoya** çıktı (her release öncesi koşar)
- M1b boyunca **sıfır flaky**, **sıfır retry**, **sıfır console hatası** disiplini

## Fixes

### Program başlangıç tarihi yedek/geri yükleme sonrası korunuyor

Önceki sürümde (v1.4.x) Periyodizasyon sihirbazında girilen `startDate` alanı, plan
kaydedilip yedeklendiğinde **kayboluyordu**. Bu, otomatik hafta hesabını sessizce
devre dışı bırakıyordu. Bu sürümde başlangıç tarihi tüm akışlarda (kaydet, yedekle,
geri yükle, sayfa yenile) korunuyor.

## Internal Improvements

Bu bölüm geliştiriciler/sistem yöneticileri içindir — son kullanıcıyı doğrudan
etkilemez ama platformun sağlığını gösterir.

### Tek Doğruluk Kaynağı (SOT) Disiplini

Periyodizasyon veri akışında üç farklı SOT (Single Source of Truth) yardımcısı
kurularak **veri tutarsızlığı (drift) yapısal olarak imkansız** hale getirildi:

- `computeIntensityTable` — sihirbaz önizlemesi ve gerçek hafta üretimi tek kaynaktan
- `buildMacrocycleCoverModel` — kapak bandı, PDF başlık bandı, intelligence özeti tek kaynaktan
- `buildPeriodizationSummary` — engine ve fallback aynı string'i üretir

Her birinin yapısal eşitliği otomatik testlerle doğrulanır.

### Dynamic Alias Pattern

Aktif haftanın sessions referansı çalışma zamanında otomatik olarak yeniden bağlanır.
14 farklı tüketici (inline edit, kas örtüşmesi, intelligence, PDF, vb.) tek nokta
güncellemesiyle aktif haftaya senkronize olur — kod tarafında zarif, test tarafında
referans eşitliği ile kanıtlanmış.

### Şema v3 → v4 Migration

`weeks[]`, `macrocycle`, `currentWeekIndex` gibi yeni alanlar plan şemasına eklendi.
v3 planları **otomatik ve kayıpsız** olarak v4'e dönüşür; geriye dönük alias
(`program.sessions === program.weeks[0].sessions`) sayesinde mevcut 14 kod yolu
değiştirilmeden çalışmaya devam etti.

### Dead Code Temizliği

Çalışan kodla referansı olmayan eski `__remote_app_check.js` taslağı yerel çalışma
ağacından temizlendi (zaten `.gitignore` listesinde olduğundan repo'ya yansımıyordu;
yanıltıcı varlığı kaldırıldı).

## Known Limitations

Aşağıdaki sınırlar **bilinçli scope kararı** olarak v1.5.0'a alınmadı.

- **Manual modda hafta hafta ayrı düzenleme yok.** Şu an Manual seçildiğinde tüm
  haftalar ilk hafta ile aynı planlanır. UI'da "Yakında" rozeti gösterilir.
  → 1.6.0 hedefi
- **Çok haftalı PDF (tüm haftalar tek dosyada) yok.** PDF her zaman aktif haftayı basar.
  → 2.0 hedefi
- **Macrocycle oluşturma sonrası düzenleme yok.** Hafta sayısını veya progression
  modelini değiştirmek için yeni plan oluşturmak gerekir.
  → 1.6.0 hedefi
- **Tanita CSV import otomatik regression testi yok.** Servis kodu hazır ve test
  modunda fonksiyonel; canlı CSV ile kullanım öncesi manuel doğrulama önerilir.
  → 1.5.x patch hedefi
- **Çok haftalı kas örtüşmesi (coverage) toplam görünümü yok.** Coverage kartı şu an
  aktif hafta üzerinden hesaplanır; Linear modda haftalar aynı olduğu için fark yok,
  Manual gerçek olunca (1.6.0) toplam görünüm gerekecek.
  → 1.6.0 sonrası

## Coming Next

Sonraki sürümlerde planlananlar (öncelik sırasıyla):

1. **Manual mode tam destek** — her haftayı ayrı düzenleme, haftalar arası kopyalama
2. **Macrocycle düzenleme** — plan oluşturulduktan sonra hafta sayısı / model / deload
   düzenini değiştirme (veri kaybı uyarısıyla)
3. **Tanita CSV otomatik regression testi** — ticari kullanım öncesi kalite kanıtı
4. **`app.js` modül ayrıştırması** — uzun vadeli sürdürülebilirlik için
5. **Çok haftalı PDF** (PDF-B) — tüm makrosikli tek dosyada basma seçeneği

---

## Sürüm Tarihçesi

### v1.4.3 (2026-05-25)
- YouTube modal kaldırıldı, doğrudan yeni sekme açılışı
- Hareket Kütüphanesi her egzersize video butonu

### v1.4.2 (2026-05-25)
- Exercise video sistemi (curated YouTube ID map + search fallback)

### v1.4.1 (2026-05-23)
- BSM_SUPPLEMENT_LIBRARY declaration order düzeltmesi
- Default ON + guard

### v1.4.0 (2026-05-22)
- Supplement library viewport scroll düzeltmesi
- Kompakt liste

### v1.3.9 (2026-05-21)
- Supplement library accordion açıldığında scroll-into-view
- Library max-height küçültüldü

### v1.3.8 (2026-05-21)
- Supplement UX: default ON, empty state CTA, diversify butonu öne çıkarıldı

### v1.3.7 (2026-05-20)
- Print Root: livePreview önceliği
- PDF preview ile birebir aynı içerik

### v1.3.6 (2026-05-19)
- Meal macros 4-katmanlı fallback (P0K0Y0 sorununun nihai çözümü)

### v1.3.5 (2026-05-18)
- PDF Sayfa 1 yeniden düzenlendi (6 sütun KPI, compact chart)

### v1.3.4 (2026-05-17)
- Reactive macro override + diversification engine
- BSM_FOOD_LIBRARY (50 besin)
- Target vs Actual UI

### v1.3.3 (2026-05-15)
- Print Root yaklaşımı + temiz print stylesheet
- Reactive macro override
