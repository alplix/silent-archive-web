/*
 * Site-chrome localization (login form, buttons, leaderboard, etc.) —
 * separate from Engine.T(), which localizes the archive/game content
 * itself. Both are driven by the same language code so the whole site
 * (not just the SCP records) follows the language you pick.
 */

const UI_STRINGS = {
  tr: {
    boot_connecting: "SCiPNET Terminali — bağlanıyor...",
    github_hint: "İlerlemenizi GitHub'a kaydedip liderlik tablosuna girmek için GitHub kullanıcı adınızı yazın. Bu gerçek bir şifreli giriş değildir — sadece kayıtlarınızı hangi dosyada tutacağımızı bilmemizi sağlar; gerçek kimlik doğrulaması, GitHub'a \"Senkronize Et\" dediğinizde kendi hesabınızla açtığınız bir issue üzerinden yapılır.",
    lbl_github_username: "GitHub kullanıcı adı",
    github_username_ph: "kullaniciadi",
    btn_continue: "Devam Et",
    err_bad_username: "Geçersiz GitHub kullanıcı adı.",
    btn_sync: "GitHub'a Senkronize Et",
    or_row: "veya",
    btn_guest: "Misafir olarak oyna (kayıt olmadan)",
    nav_leaderboard: "liderlik",
    nav_logout: "çıkış",
    guest_mode: "Misafir modu (kaydedilir yalnızca bu tarayıcıda)",
    operator_label: "Denetçi",
    st_clearance: "Yetki",
    st_day: "Gün",
    st_findings: "Bulgu",
    st_contam: "Kontaminasyon",
    browser_title: "KAYITLAR",
    browser_tab_records: "Kayıtlar",
    browser_tab_findings: "Bulgular",
    browser_search_ph: "ara...",
    browser_locked: "kilitli",
    browser_read: "okundu",
    browser_empty: "Bu perdede erişilebilir kayıt yok.",
    browser_no_match: "Eşleşme yok.",
    findings_empty: "Henüz bulgu yok. İki okunmuş kaydı karşılaştırın.",
    toast_finding: "YENİ BULGU",
    toast_rankup: "RÜTBE ATLADINIZ",
    toast_danger: "KONTAMİNASYON KRİTİK",
    toast_warning: "KONTAMİNASYON YÜKSELİYOR",
    day_urgent: "Son gün yaklaşıyor",
    cross_tray_hint: "Karşılaştırmak için iki okunmuş kayıt seçin:",
    cross_tray_go: "Karşılaştır",
    cross_tray_need_one_more: "1 kayıt daha seçin",
    cross_tray_clear: "Temizle",
    lb_title: "LİDERLİK TABLOSU",
    lb_col_name: "Denetçi",
    lb_col_rank: "Rütbe",
    lb_col_xp: "XP",
    lb_col_findings: "Bulgu",
    btn_close: "Kapat",
    lb_loading: "...",
    lb_empty: "Henüz kimse yok.",
    lb_error: "Yüklenemedi: ",
    session_ended_1: ">> oturum sona erdi",
    session_ended_2: ">> yeniden başlamak için sayfayı yenileyin",
    tut_title: "NASIL OYNANIR",
    tut_button: "Nasıl oynanır",
    tut_close: "Anladım, başla",
    tut_items: [
      { h: "Amacınız Ne?", b: "Bir arşiv denetçisisiniz. Görev: kayıtları okuyun ('liste' ile listeyi görün, 'oku SCP-173' gibi okuyun), aralarındaki çelişkileri bulmak için ikişer ikişer karşılaştırın ('capraz SCP-173 SCP-096'), bu size bir bulgu kazandırır. Yeterince bulgu topladıktan sonra 'rapor' yazıp bir son seçin. Hepsi bu kadar — okuyun, karşılaştırın, biriktirin, kapatın." },
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
    github_hint: "Enter your GitHub username to sync progress to GitHub and appear on the leaderboard. This isn't a real password-protected login — it only tells us which save file to look for; the actual identity check happens when you hit \"Sync to GitHub\" and submit it from your own GitHub account.",
    lbl_github_username: "GitHub username",
    github_username_ph: "username",
    btn_continue: "Continue",
    err_bad_username: "Invalid GitHub username.",
    btn_sync: "Sync to GitHub",
    or_row: "or",
    btn_guest: "Play as guest (no account)",
    nav_leaderboard: "leaderboard",
    nav_logout: "logout",
    guest_mode: "Guest mode (saved only in this browser)",
    operator_label: "Auditor",
    st_clearance: "Clearance",
    st_day: "Day",
    st_findings: "Findings",
    st_contam: "Contamination",
    browser_title: "RECORDS",
    browser_tab_records: "Records",
    browser_tab_findings: "Findings",
    browser_search_ph: "search...",
    browser_locked: "locked",
    browser_read: "read",
    browser_empty: "No accessible records in this act.",
    browser_no_match: "No matches.",
    findings_empty: "No findings yet. Compare two records you've read.",
    toast_finding: "NEW FINDING",
    toast_rankup: "RANK UP",
    toast_danger: "CONTAMINATION CRITICAL",
    toast_warning: "CONTAMINATION RISING",
    day_urgent: "Final day approaching",
    cross_tray_hint: "Pick two records you've read to compare:",
    cross_tray_go: "Compare",
    cross_tray_need_one_more: "pick 1 more",
    cross_tray_clear: "Clear",
    lb_title: "LEADERBOARD",
    lb_col_name: "Auditor",
    lb_col_rank: "Rank",
    lb_col_xp: "XP",
    lb_col_findings: "Findings",
    btn_close: "Close",
    lb_loading: "...",
    lb_empty: "Nobody yet.",
    lb_error: "Failed to load: ",
    session_ended_1: ">> session ended",
    session_ended_2: ">> refresh the page to start a new run",
    tut_title: "HOW TO PLAY",
    tut_button: "How to play",
    tut_close: "Got it, start",
    tut_items: [
      { h: "What's the goal?", b: "You're an archive auditor. Your job: read records ('list' to see them, 'read SCP-173' to open one), compare them two at a time to find contradictions ('cross SCP-173 SCP-096') — that earns you a finding. Once you've collected enough findings, type 'report' and pick an ending. That's the whole loop: read, compare, collect, close the case." },
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

function knownCodes() {
  const meta = (typeof window !== "undefined" && window.LANGUAGE_META) || [];
  return meta.length ? meta.map((m) => m.code) : Object.keys(UI_STRINGS);
}

function detectDefaultLang() {
  const codes = knownCodes();
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored && codes.includes(stored)) return stored;
  } catch { /* ignore */ }
  const nav = (navigator.language || "en").toLowerCase().slice(0, 2);
  return codes.includes(nav) ? nav : "en";
}

let currentLang = detectDefaultLang();

function t(key) {
  return (UI_STRINGS[currentLang] && UI_STRINGS[currentLang][key]) || UI_STRINGS.en[key] || key;
}

function getUiLang() { return currentLang; }

function setUiLang(code) {
  // currentLang can be a code with no UI_STRINGS block yet (chrome falls
  // back to English per-key in t()); the game content still switches via
  // Engine regardless, since that has its own fallback chain.
  currentLang = code;
  try { localStorage.setItem(STORE_KEY, code); } catch { /* ignore */ }
  document.documentElement.lang = code;
  applyStaticI18n();
  const sel = document.getElementById("lang-select");
  if (sel && sel.value !== code) sel.value = code;
}

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    el.setAttribute("placeholder", t(key));
  });
}

window.I18N = { t, getUiLang, setUiLang, applyStaticI18n };
