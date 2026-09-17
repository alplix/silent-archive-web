/*
 * Site-chrome localization (login form, buttons, leaderboard, etc.) —
 * separate from Engine.T(), which localizes the archive/game content
 * itself. Both are driven by the same language code so the whole site
 * (not just the SCP records) follows the language you pick.
 */

const UI_STRINGS = {
  tr: {
    boot_connecting: "SCiPNET Terminali — bağlanıyor...",
    tab_login: "Giriş",
    tab_register: "Kayıt Ol",
    lbl_email: "E-posta",
    lbl_password: "Şifre",
    lbl_name: "Denetçi adı",
    btn_signin: "Giriş Yap",
    btn_register: "Kayıt Ol",
    or_row: "veya",
    btn_google: "Google ile giriş yap",
    btn_guest: "Misafir olarak oyna (kayıt olmadan)",
    nav_leaderboard: "liderlik",
    nav_logout: "çıkış",
    guest_mode: "Misafir modu (kaydedilir yalnızca bu tarayıcıda)",
    operator_label: "Denetçi",
    lb_title: "LİDERLİK TABLOSU",
    lb_col_name: "Denetçi",
    lb_col_rank: "Rütbe",
    lb_col_xp: "XP",
    lb_col_findings: "Bulgu",
    btn_close: "Kapat",
    lb_loading: "...",
    lb_not_configured: "Firebase yapılandırılmadı — liderlik tablosu için site sahibinin js/firebase-config.js dosyasını doldurması gerekiyor.",
    lb_empty: "Henüz kimse yok.",
    lb_error: "Yüklenemedi: ",
    err_email_in_use: "Bu e-posta zaten kayıtlı.",
    err_wrong_credentials: "Hatalı e-posta veya şifre.",
    err_weak_password: "Şifre en az 6 karakter olmalı.",
    err_user_not_found: "Hesap bulunamadı.",
    err_not_configured: "Firebase henüz yapılandırılmadı. Site sahibi js/firebase-config.js dosyasını doldurmalı.",
    session_ended_1: ">> oturum sona erdi",
    session_ended_2: ">> yeniden başlamak için sayfayı yenileyin",
    tut_title: "NASIL OYNANIR",
    tut_button: "Nasıl oynanır",
    tut_close: "Anladım, başla",
    tut_items: [
      { h: "Nesne Sınıfı", b: "Safe: düşük risk. Euclid: davranışı tam anlaşılmamış, dikkat gerektirir. Keter: yüksek risk, sıkı kontrol önlemleri gerekir. Thaumiel: Vakfın başka anomalilere karşı bir araç olarak kullandığı anomaliler." },
      { h: "Yetki Seviyesi", b: "Kayıtlar Seviye 2-6 arasında kilitlidir. Bazı bölümler yetkiniz yetene kadar [REDAKTE] görünür. Belgelerin içinde saklı anahtarları bulup 'kod <anahtar>' yazarak yetkinizi yükseltirsiniz." },
      { h: "Bilişsel Kontaminasyon", b: "Okudukça artar. %100'e ulaşırsa denetim sizin için biter. 'dinlen' bir günü bitirip düşürür; SCP-999 dosyasını okumak ve amnezik kullanmak da düşürür." },
      { h: "Bulgu / Çapraz Referans", b: "Oyunun kalbi: iki okunmuş kaydı 'capraz <A> <B>' ile karşılaştırın. Aralarındaki tutarsızlık bir bulguya dönüşür. Yeterince bulgu toplayınca 'rapor' ile denetimi kapatabilirsiniz." },
      { h: "Rütbe / Deneyim Puanı", b: "Okumak ve çapraz referans yapmak deneyim puanı kazandırır. Rütbe atladıkça arşiv bunu kutlar ve kontaminasyonunuzu biraz azaltır." },
      { h: "11 Günlük Süre", b: "Görev emri 11 gün açık kalır. 'dinlen' bir günü bitirir. 11. günün sonunda görev sizin elinizden alınır, tamamlamış olsanız da olmasanız da." },
    ],
  },
  en: {
    boot_connecting: "SCiPNET Terminal — connecting...",
    tab_login: "Login",
    tab_register: "Register",
    lbl_email: "Email",
    lbl_password: "Password",
    lbl_name: "Auditor name",
    btn_signin: "Sign In",
    btn_register: "Create Account",
    or_row: "or",
    btn_google: "Sign in with Google",
    btn_guest: "Play as guest (no account)",
    nav_leaderboard: "leaderboard",
    nav_logout: "logout",
    guest_mode: "Guest mode (saved only in this browser)",
    operator_label: "Auditor",
    lb_title: "LEADERBOARD",
    lb_col_name: "Auditor",
    lb_col_rank: "Rank",
    lb_col_xp: "XP",
    lb_col_findings: "Findings",
    btn_close: "Close",
    lb_loading: "...",
    lb_not_configured: "Firebase is not configured — the leaderboard needs the site owner to fill in js/firebase-config.js.",
    lb_empty: "Nobody yet.",
    lb_error: "Failed to load: ",
    err_email_in_use: "This email is already registered.",
    err_wrong_credentials: "Wrong email or password.",
    err_weak_password: "Password must be at least 6 characters.",
    err_user_not_found: "Account not found.",
    err_not_configured: "Firebase is not configured yet. The site owner needs to fill in js/firebase-config.js.",
    session_ended_1: ">> session ended",
    session_ended_2: ">> refresh the page to start a new run",
    tut_title: "HOW TO PLAY",
    tut_button: "How to play",
    tut_close: "Got it, start",
    tut_items: [
      { h: "Object Class", b: "Safe: low risk. Euclid: behavior not fully understood, requires caution. Keter: high risk, demands strict containment. Thaumiel: anomalies the Foundation actively uses as a tool against other anomalies." },
      { h: "Clearance Level", b: "Records are locked to Level 2-6. Some sections show [REDACTED] until your clearance is high enough. Keys are hidden inside the documents themselves — find one and type 'code <key>' to raise your clearance." },
      { h: "Cognitive Contamination", b: "Rises as you read. At 100% the audit ends for you. 'rest' ends a day and lowers it; reading the SCP-999 file and using an amnestic also lower it." },
      { h: "Findings / Cross-Reference", b: "The heart of the game: compare two records you've read with 'cross <A> <B>'. The inconsistency between them becomes a finding. Collect enough and you can close the audit with 'report'." },
      { h: "Rank / Experience", b: "Reading and cross-referencing earn experience. Ranking up is logged by the archive and eases your contamination slightly." },
      { h: "The 11-Day Clock", b: "The work order stays open for 11 days. 'rest' ends a day. At the end of day 11, the assignment is taken out of your hands, finished or not." },
    ],
  },
};

const STORE_KEY = "silent-archive-ui-lang";

function detectDefaultLang() {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored && UI_STRINGS[stored]) return stored;
  } catch { /* ignore */ }
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("tr") ? "tr" : "en";
}

let currentLang = detectDefaultLang();

function t(key) {
  return (UI_STRINGS[currentLang] && UI_STRINGS[currentLang][key]) || UI_STRINGS.en[key] || key;
}

function getUiLang() { return currentLang; }

function setUiLang(code) {
  if (!UI_STRINGS[code]) return;
  currentLang = code;
  try { localStorage.setItem(STORE_KEY, code); } catch { /* ignore */ }
  document.documentElement.lang = code;
  applyStaticI18n();
  document.querySelectorAll(".lang-opt").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === code);
  });
}

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
}

window.I18N = { t, getUiLang, setUiLang, applyStaticI18n };
