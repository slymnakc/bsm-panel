# Bahçeşehir Spor Merkezi Üye Performans Paneli

Bahçeşehir Spor Merkezi için hazırlanmış Türkçe, mobil uyumlu, Supabase bağlantılı ve Render üzerinde yayınlanabilir üye performans ve antrenman panelidir.

## Ne İşe Yarar?

- Üye kaydı ve üye dosyası yönetimi
- Segmental vücut analiz ölçümü
- Üyeye özel antrenman programı oluşturma
- Hareket kütüphanesi ve kas grubu filtreleme
- AI destekli analiz, koç notları ve otomasyon uyarıları
- Üyeye verilebilir sade program çıktısı
- Yazdırma / PDF alma desteği
- Supabase üyeler tablosuna veri yazma ve sayfa açılışında veri çekme

## Canlı Yayın

Canlı panel:

https://bsm-panel.onrender.com/

## Otomatik Güncelleme Mantığı

Bu proje Render için hazırlandı. Proje GitHub reposuna bağlandıktan sonra:

1. Kodda değişiklik yapılır.
2. Değişiklik GitHub `main` branch'ine gönderilir.
3. Render `autoDeploy: true` ayarıyla siteyi otomatik yeniden yayınlar.
4. Canlı sitede yeni sürüm görünür.

Bu ayar [render.yaml](./render.yaml) dosyasında hazırdır.

## Render Ayarı

Render bu projeyi statik site olarak yayınlar:

- Servis adı: `bsm-panel`
- Runtime: `static`
- Yayın klasörü: proje ana klasörü
- Auto deploy: açık
- SPA yönlendirme: tüm yollar `index.html` dosyasına yönlenir

## Önemli Dosyalar

- `index.html`: Ana sayfa ve ekran yapısı
- `styles.css`: Görsel tasarım ve print/PDF düzeni
- `app.js`: Uygulama başlangıcı ve ana akış
- `data/`: Hareketler, seçenekler ve etiket verileri
- `services/`: Storage, üye, program ve çıktı servisleri
- `ui/`: Dashboard, üye, kütüphane ve çıktı render dosyaları
- `handlers/`: Form, navigasyon, üye ve çıktı olayları
- `analysis-engine.js`: Yerel AI analiz motoru
- `automation-engine.js`: Yerel otomasyon ve uyarı motoru
- `program-engine-v2.js`: Akıllı program öneri motoru
- `v3-insights-engine.js`: V3 koçluk içgörüleri
- `render.yaml`: Render otomatik deploy yapılandırması

## Kullanım

1. Paneli açın.
2. Üye bilgilerini girin veya kayıtlı üyeyi seçin.
3. Ölçüm bilgilerini girin.
4. Hedef, seviye, gün ve ekipman bilgilerine göre program oluşturun.
5. Programı üyeye kaydedin.
6. `Üye Çıktısı` sekmesinden sade programı yazdırın veya PDF alın.

## Not

Bu proje vanilla JavaScript ile çalışır. React, Vue veya backend gerektirmez. Supabase sadece veri saklama/senkronizasyon için kullanılır.
