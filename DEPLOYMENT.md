# GitHub -> Render -> Canlı Site Güncelleme Rehberi

Bu proje statik bir BSM panelidir. Canlı site:

https://bsm-panel.onrender.com/

## Mevcut Durum

- Proje Render için statik site olarak yapılandırıldı.
- `render.yaml` dosyasında `autoDeploy: true` açık.
- Bu yerel klasörde şu anda `.git` klasörü yok.
- Bu bilgisayarda `git` komutu görünmüyor.
- Bu nedenle yerelde yapılan değişiklikler kendiliğinden canlı siteye gidemez.

## Render Ayarı

Render ayarı [render.yaml](./render.yaml) dosyasındadır:

- Service name: `bsm-panel`
- Runtime: `static`
- Branch: `main`
- Auto deploy: `true`
- Build command: `echo "Static BSM panel ready"`
- Publish directory: `.`

Bu proje için `startCommand` gerekmez, çünkü uygulama backend server değil statik HTML/CSS/JS panelidir.

## Neden Canlı Site Güncellenmiyor Olabilir?

1. Değişiklikler GitHub'a gönderilmemiş olabilir.
2. Render servisi GitHub reposuna bağlı olmayabilir.
3. Render yanlış branch'i izliyor olabilir.
4. GitHub'a `main` yerine başka branch push edilmiş olabilir.
5. Render build başarısız olmuş olabilir.
6. Tarayıcı eski dosyayı cache'liyor olabilir.
7. Canlı site güncellenmiş ama doğru sürüm console'dan kontrol edilmemiş olabilir.

## Doğru Otomatik Deploy Akışı

1. Kod yerelde güncellenir.
2. Değişiklikler GitHub `main` branch'ine push edilir.
3. Render otomatik deploy başlatır.
4. Deploy tamamlanınca canlı site güncellenir.

Akış:

`Local project -> GitHub main -> Render auto deploy -> Live site`

## GitHub'a Bağlama Adımları

1. GitHub'da `bsm-panel` adlı repository oluşturun.
2. Bu proje dosyalarını repo içine gönderin.
3. Render Dashboard'a girin.
4. `bsm-panel` servisini açın.
5. Settings veya Deploy bölümünden GitHub repository bağlantısını kontrol edin.
6. Branch ayarının `main` olduğundan emin olun.
7. Auto Deploy ayarını `On` yapın.

## Manuel Deploy Nasıl Yapılır?

Render Dashboard üzerinden:

1. https://dashboard.render.com adresine girin.
2. `bsm-panel` servisini açın.
3. `Manual Deploy` butonuna basın.
4. `Deploy latest commit` seçeneğini seçin.
5. Deploy bitene kadar bekleyin.
6. Canlı siteyi hard refresh ile açın: `Ctrl + F5`.

Manuel deploy sadece GitHub'daki son commit'i canlıya alır. Yereldeki ama GitHub'a gönderilmemiş değişiklikleri almaz.

## Canlı Sürüm Nasıl Kontrol Edilir?

`app.js` içine sürüm logu eklendi:

```js
console.log("APP VERSION: v1.0.1");
```

Kontrol:

1. Canlı siteyi açın: https://bsm-panel.onrender.com/
2. Tarayıcı geliştirici konsolunu açın.
3. `APP VERSION: v1.0.1` görünüyor mu kontrol edin.

Eğer eski versiyon görünüyorsa:

- GitHub'a push yapılmamıştır.
- Render deploy başlamamıştır.
- Render deploy başarısız olmuştur.
- Tarayıcı cache temizlenmelidir.

## Her Yeni Güncellemede

Her geliştirmede `app.js` içindeki sürüm bir artırılmalı:

- `v1.0.1`
- `v1.0.2`
- `v1.0.3`

Bu sayede canlı sitenin gerçekten güncellenip güncellenmediği console'dan anlaşılır.
