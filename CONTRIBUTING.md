# BSM Panel — Geliştirici Notları

Bu dosya, BSM Panel deposuna katkıda bulunurken uyulması gereken kuralları
ve yerel ortam hazırlığını özetler.

## 1. Yerel Kurulum

```bash
git clone https://github.com/slymnakc/bsm-panel.git
cd bsm-panel
npm install            # şimdilik sadece dev/test bağımlılıkları (Playwright)
npm start              # http://localhost:3000
```

### Git hook'larını etkinleştir

Repoda paylaşılan pre-commit hook (`tools/git-hooks/pre-commit`) binary
artifact'leri, 5 MB üstü dosyaları reddeder ve smart-quote (curly quote)
uyarısı verir. Bir kerelik etkinleştirme:

```bash
git config --local core.hooksPath tools/git-hooks
```

Acil hotfix sırasında atlamak için:

```bash
git commit --no-verify
```

## 2. Commit Message Standardı

Conventional Commits referans alınır:

```
<type>(<scope>): <kısa özet, imperative>

<gövde — neden, nasıl, riskler>

Co-Authored-By: ...
```

**Tipler:**

| Tip | Kullanım |
|---|---|
| `feat` | Yeni özellik (kullanıcı görür) |
| `fix` | Hata düzeltmesi |
| `chore` | Repo housekeeping, version bump, cleanup |
| `refactor` | Davranış değişmeden kod yeniden yapılandırma |
| `perf` | Performans iyileştirmesi |
| `style` | Sadece görsel/CSS |
| `docs` | Dokümantasyon |
| `test` | Test eklemeleri / değişiklikleri |

**Scope örnekleri:** `ui`, `app`, `auth`, `router`, `measurement`, `nutrition`,
`pdf`, `mail`, `tanita`, `webcam`.

**Örnek:**

```
feat(ui): F5h - Ölçüm Geçmişi line chart (dual axis)

Inline SVG ile dependency-yok line chart. Olcum step'inin altina eklendi.
- Son 12 olcum kronolojik (eski -> yeni)
- Dual scale: sol Y Kilo (mavi), sag Y Yag% (turuncu)
- Empty state: 2+ olcum yoksa uyari ikonu

Smoke (Playwright): 0 console/page/network error.
```

**Yasak:**

- Tek-kelime mesajlar (`fix`, `update`, `kml`, `ghg`) — pre-commit
  uyarı vermese de PR review'de reddedilir.
- `git add .` ile mesleksiz bulk add — explicit dosya listele.

## 3. Sürüm Numaralandırma (Semver)

`BSM_BUILD_VERSION` (app.js) + `package.json:version` + `index.html ?v=...`
**tek standartta** tutulur. Bumping kuralları:

- **major** (1.x → 2.0): breaking change, mevcut akışlar bozulur
- **minor** (1.1 → 1.2): yeni özellik, geriye uyumlu
- **patch** (1.1.0 → 1.1.1): bug fix, görsel polish

Bump operasyonu için tüm 3 kaynağı aynı anda güncelle.

## 4. Korunması Gereken Sistemler

Aşağıdaki alanlar **UI/UX refactor sırasında dokunulmaz**:

- Auth flow (`auth/auth.js`, `auth/rbac.js`, `body.auth-required`)
- Router (`core/router.js`, `BSMRouter`, `data-screen-target`)
- Supabase sync (`services/supabase-sync-service.js`)
- Member CRUD (`services/member-service.js`, `state.activeMemberId`)
- Measurement flow (Tanita CSV + manual + V3 dossier)
- Program builder (`#plannerForm` ve tüm form id'leri)
- Nutrition planlama
- PDF üretimi (`services/pdf-download-service.js`)
- Mail gönderimi (`nutrition/nutritionEmailService.js`)
- Event delegation noktaları (`handlers/*`, `bindApplicationHandlers`)

## 5. Test Akışı

Yeni özellik veya hotfix sonrası **smoke test zorunlu**:

```bash
# Playwright tabanlı smoke örneği
# (.smoke-*.js dosyalari .gitignore'da; her sprintte dispoze edilir)
node .smoke-<topic>.js
```

Smoke için minimum kontrol listesi:

1. `http://localhost:3000` HTTP 200
2. Console error / page error / network error = 0
3. localStorage prepopulated 16 üye → reload sonrası TDZ regression yok
4. 7 ekran navigable (`members`, `measurements`, `builder`, `nutrition`,
   `library`, `output`, `settings`)
5. Mobile 414×900 hamburger + drawer + tek kolon
6. Auth gate z-index hiyerarşisi doğru

## 6. Repository Hijyen

- **Binary / arsiv dosyalari** (`.zip`, `.tar`, `.exe`, vb.) commit edilmez.
  `.gitignore` zaten engelliyor, pre-commit hook redleder.
- **Üretim verisi** repo'ya konmaz (üye, ölçüm, vb.) — localStorage veya
  Supabase üzerinde tutulur.
- **Geçici dosyalar** `tmp-*` veya `tmp-screenshots/` ile gizlenir.
- **Worktree klasörü** `.claude/worktrees/` ana repo'ya commit edilmez.

## 7. PR + Merge

Production'a giden değişiklikler:

1. Feature branch'te commit + push
2. GitHub PR aç
3. Smoke test sonucu PR description'a yapıştır
4. Manuel review
5. Merge (squash önerilir, ama merge commit de OK)

Force-push to main **sadece** kritik temizlik (zip blob, vb.) sırasında
yapılır ve mutlaka backup branch'le güvence alınır.
