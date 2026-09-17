# Sessiz Arşiv / The Silent Archive — Web

Tarayıcıda oynanan, hesap sistemi, seviye/rütbe ilerlemesi, liderlik
tablosu ve "kaldığın yerden devam et" özellikli web sürümü. Oyunun
kendisi ve tüm içerik (565 kayıt, 303 bulgu, iki dil) orijinal Python/
terminal sürümüyle birebir aynıdır — bu depo yalnızca aynı motoru ve
aynı veri dosyalarını tarayıcıda çalışacak şekilde yeniden yazar.

Browser-playable version of the terminal SCP investigation game, with
accounts, rank/XP progression, a leaderboard, and resume-where-you-left-off
saves. The game and all content (565 records, 303 findings, two languages)
are identical to the original Python/terminal version — this repo just
re-implements the same engine to run client-side, reading the same data
files unchanged.

**Bu tamamen statik bir site.** Sunucu tarafı kod yok, SQL yok. Hesaplar,
kayıtlı ilerleme ve liderlik tablosu için ücretsiz bir Firebase projesi
kullanılıyor (NoSQL, Google'ın barındırdığı bir servis — siz bir sunucu
çalıştırmuyorsunuz). Site GitHub Pages'te statik dosyalar olarak durur.

**This is a fully static site.** No server-side code, no SQL. Accounts,
saved progress and the leaderboard use a free Firebase project (NoSQL,
hosted by Google — you don't run a server). The site itself sits on
GitHub Pages as plain static files.

---

## Canlı site / Live site

**https://alplix.github.io/silent-archive-web/**

Firebase kurulumu tamamlanana kadar oyun **giriş yapılmadan (misafir
modu) yerel kayıtla** oynanabilir durumda; hesap/liderlik özellikleri
`js/firebase-config.js` doldurulunca aktif olur.

Until Firebase is configured, the game is fully playable in **guest mode**
(local browser save only); accounts/leaderboard activate once
`js/firebase-config.js` is filled in.

## Yerelde çalıştırma / Run locally

Veri dosyaları `fetch()` ile yüklendiği için `index.html`'i doğrudan
`file://` olarak açmak çalışmaz — herhangi bir statik dosya sunucusu
yeterli:

```bash
cd silent-archive-web
python3 -m http.server 8000
# http://localhost:8000 adresini açın
```

## Firebase kurulumu (hesap / liderlik / bulut kayıt için) — zorunlu değil ama önerilir

1. https://console.firebase.google.com/ adresinde ücretsiz bir proje
   oluşturun.
2. **Build > Authentication > Sign-in method**'da "Email/Password"
   sağlayıcısını (ve isterseniz "Google"ı) etkinleştirin.
3. **Build > Firestore Database > Create database**'i "production mode"
   ile oluşturun (kurallar aşağıda verilecek).
4. **Project settings > General > Your apps**'ten bir Web uygulaması
   (`</>`) kaydedin, verdiği `firebaseConfig` nesnesini kopyalayın.
5. Bu değerleri `js/firebase-config.js` dosyasına yapıştırın (bu
   değerler gizli değildir, istemci tarafı koddadır — güvenlik
   Firestore Kuralları ile sağlanır, aşağıya bakın).
6. **Firestore Database > Rules**'a bu depodaki `firestore.rules`
   dosyasının içeriğini yapıştırıp "Publish" deyin.
7. Değişiklikleri commit'leyip GitHub'a push edin (veya GitHub Pages
   otomatik olarak yeni `main` push'unu yayınlar).

## Setup steps (English)

1. Create a free project at https://console.firebase.google.com/.
2. Enable "Email/Password" (and optionally "Google") under
   **Build > Authentication > Sign-in method**.
3. Create a Firestore database (production mode) under
   **Build > Firestore Database**.
4. Register a Web app under **Project settings > General > Your apps**
   and copy the `firebaseConfig` object it gives you.
5. Paste those values into `js/firebase-config.js` (these values are not
   secret — security comes from Firestore Rules, see below).
6. Paste the contents of `firestore.rules` into
   **Firestore Database > Rules** and publish.
7. Commit and push — GitHub Pages redeploys automatically.

## GitHub Pages

Repo ayarlarında **Settings > Pages > Build and deployment > Source:
Deploy from a branch**, branch: `main`, folder: `/ (root)` seçili
olmalı. Bu depo doğrudan kök dizinden statik olarak sunulacak şekilde
hazırlandı.

In repo settings: **Settings > Pages > Build and deployment > Source:
Deploy from a branch**, branch `main`, folder `/ (root)`. This repo is
laid out to be served as-is from the repository root.

## Mimari / Architecture

```
index.html          giriş/dil/oyun ekranları — auth, language, game screens
style.css            terminal görünümü — terminal look and feel
js/engine.js          scp.py'nin birebir JS portu; manifest.json + dil/*.json'ı
                       değiştirmeden okur — a faithful JS port of scp.py;
                       reads manifest.json + dil/*.json unchanged
js/firebase-config.js Firebase proje ayarları (siz doldurursunuz)
                       your Firebase project config (you fill this in)
js/auth.js             hesap, bulut kayıt, liderlik — Firebase Auth/Firestore
                        wrapper: accounts, cloud save, leaderboard
js/main.js              ekranları birbirine bağlar, terminali render eder
                         wires screens together, renders the terminal
data/manifest.json      orijinal Python projesinden değiştirilmeden kopyalandı
data/dil/en.json        unchanged copies from the original Python project
data/dil/tr.json
firestore.rules         Firebase Console > Firestore > Rules'a yapıştırın
                         paste into Firebase Console > Firestore > Rules
```

## Özellikler / Features

- **Kenar çubuğu**: her an görünen bir durum paneli (yetki, gün,
  bulgu sayısı, kontaminasyon ve XP barları), ve tıklanabilir bir
  kayıt listesi — bir kaydı okumak için tıklayın, iki okunmuş kaydı
  onay kutularıyla seçip "Karşılaştır"a basarak çapraz referans
  yapın; komut yazmak hâlâ çalışır, sadece artık zorunlu değil. /
  **Sidebar**: an always-visible status panel (clearance, day,
  findings count, contamination and XP bars), and a clickable record
  list — click to read a record, check two you've read and hit
  "Compare" to cross-reference them; typing commands still works,
  it's just no longer required.
- **Ses efektleri**: yeni bulgu, rütbe atlama, yüksek kontaminasyon
  ve son gibi anlarda kısa, sentezlenmiş sesler (Web Audio API,
  harici ses dosyası yok); üst çubuktaki 🔊 ile kapatılabilir. /
  **Sound effects**: short synthesized cues (Web Audio API, no audio
  files) for new findings, rank-ups, high contamination and endings;
  toggle off with the 🔊 button in the topbar.
- **Dil seçimi giriş ekranının üstünde** (sağ üstte sabit TR/EN
  düğmesi) — seçilen dil giriş formunu, üst çubuğu, liderlik
  tablosunu ve arşiv içeriğinin tamamını kapsar, oyun içinde de
  `dil en`/`dil tr` ile değiştirilebilir. / **Language switcher sits
  above/at the login screen** (fixed TR/EN toggle, top right) —
  covers the login form, topbar, leaderboard and all archive content;
  can also be changed mid-game with `lang en`/`lang tr`.
- **Daktilo efekti**: kayıt/bulgu/posta metinleri, gün anlatıları ve
  sonlar karakter karakter değil ama akan bir "yazılıyor" efektiyle
  beliriyor (orijinal terminaldeki `slow()` çağrılarının web portu);
  terminale tıklamak o an yazılan satırı anında tamamlar. /
  **Typewriter effect**: record/finding/mail text, day narratives and
  endings reveal with a flowing "typing" animation (a web port of the
  original terminal's `slow()` calls); clicking the terminal instantly
  finishes the line currently animating.
- **"Nasıl oynanır" öğretici** — ilk oyuna girişte otomatik açılan,
  nesne sınıflarını, yetki seviyelerini, kontaminasyonu, bulgu/çapraz
  referans mekaniğini ve 11 günlük süreyi anlatan bir bilgi kutusu;
  üst çubuktaki düğmeyle istediğiniz an tekrar açılabilir. / **"How to
  play" onboarding** — auto-shown on first game start, explaining
  object classes, clearance levels, contamination, the
  finding/cross-reference mechanic and the 11-day clock; reopenable
  anytime from the topbar button.
- Misafir modunda (giriş yapılmadan) ilerleme yalnızca o tarayıcıda
  `localStorage` ile saklanır, cihazlar arası senkron olmaz ve
  liderlik tablosuna girmez. / In guest mode (no login), progress is
  saved only to that browser's `localStorage` — no cross-device sync,
  not included in the leaderboard.

## Lisans / License

SCP Vakfı kavramları [SCP Wiki](https://scpwiki.com)'ye aittir, CC
BY-SA 3.0 ile lisanslanmıştır. Bu oyundaki tüm metinler özgündür ve
aynı lisansla paylaşılmaktadır. / SCP Foundation concepts belong to the
collaborative [SCP Wiki](https://scpwiki.com), licensed CC BY-SA 3.0.
All prose in this game is original and shared under the same licence.
