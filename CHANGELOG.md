# Changelog

Bu dosya BSM Panel sürümlerindeki tüm önemli değişiklikleri belgeler.
Format [Keep a Changelog](https://keepachangelog.com/) yaklaşımına uyar
ve sürümleme [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`)
prensibini izler.

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
