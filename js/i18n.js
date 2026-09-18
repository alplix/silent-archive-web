/*
 * Site-chrome localization (start screen, buttons, toasts, tutorial, etc.) —
 * separate from Engine.T(), which localizes the archive/game content
 * itself. Both are driven by the same language code so the whole site
 * (not just the SCP records) follows the language you pick.
 */

const UI_STRINGS = {
  tr: {
    boot_connecting: "SCiPNET Terminali — bağlanıyor...",
    btn_play: "Oyna",
    btn_continue: "Devam et",
    savefile_btn: "Kayıt dosyası",
    savefile_title: "KAYIT DOSYASI",
    savefile_help: "İlerlemeniz bu tarayıcıda otomatik olarak kaydedilir; oyun her zaman kaldığınız yerden devam eder. Başka bir cihaza taşımak ya da yedek almak için buradan bir kayıt dosyası indirip diğer cihazda yükleyin.",
    savefile_download: "Kayıt dosyasını indir",
    savefile_load: "Kayıt dosyası yükle",
    savefile_bad: "Bu dosya geçerli bir kayıt dosyası değil.",
    savefile_confirm: "Mevcut ilerlemenizin yerine bu dosya kullanılsın mı?",
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
    btn_close: "Kapat",
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
    btn_play: "Play",
    btn_continue: "Continue",
    savefile_btn: "Save file",
    savefile_title: "SAVE FILE",
    savefile_help: "Your progress is saved automatically in this browser, so the game always resumes where you stopped. To move it to another device or keep a backup, download a save file here and load it there.",
    savefile_download: "Download save file",
    savefile_load: "Load a save file",
    savefile_bad: "That file isn't a valid save file.",
    savefile_confirm: "Replace your current progress with this file?",
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
    btn_close: "Close",
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
  es: {
    boot_connecting: "Terminal SCiPNET — conectando...",
    btn_play: "Jugar",
    btn_continue: "Continuar",
    savefile_btn: "Archivo de guardado",
    savefile_title: "ARCHIVO DE GUARDADO",
    savefile_help: "Su progreso se guarda automáticamente en este navegador, así que el juego siempre continúa donde lo dejó. Para llevarlo a otro dispositivo o hacer una copia de seguridad, descargue aquí un archivo de guardado y cárguelo allí.",
    savefile_download: "Descargar archivo de guardado",
    savefile_load: "Cargar un archivo de guardado",
    savefile_bad: "Ese archivo no es un archivo de guardado válido.",
    savefile_confirm: "¿Reemplazar su progreso actual con este archivo?",
    st_clearance: "Autorización",
    st_day: "Día",
    st_findings: "Hallazgos",
    st_contam: "Contaminación",
    browser_title: "REGISTROS",
    browser_tab_records: "Registros",
    browser_tab_findings: "Hallazgos",
    browser_search_ph: "buscar...",
    browser_locked: "bloqueado",
    browser_read: "leído",
    browser_empty: "No hay registros accesibles en este acto.",
    browser_no_match: "Sin coincidencias.",
    findings_empty: "Aún no hay hallazgos. Compare dos registros que haya leído.",
    toast_finding: "NUEVO HALLAZGO",
    toast_rankup: "SUBIÓ DE RANGO",
    toast_danger: "CONTAMINACIÓN CRÍTICA",
    toast_warning: "CONTAMINACIÓN EN AUMENTO",
    day_urgent: "Se acerca el último día",
    cross_tray_hint: "Elija dos registros que haya leído para comparar:",
    cross_tray_go: "Comparar",
    cross_tray_need_one_more: "elija 1 más",
    cross_tray_clear: "Limpiar",
    btn_close: "Cerrar",
    session_ended_1: ">> sesión finalizada",
    session_ended_2: ">> actualice la página para empezar una nueva partida",
    tut_title: "CÓMO JUGAR",
    tut_button: "Cómo jugar",
    tut_close: "Entendido, empezar",
    tut_items: [
      { h: "¿Cuál es el objetivo?", b: "Es un auditor de archivo. Su tarea: leer registros ('lista' para verlos, 'leer SCP-173' para abrir uno), compararlos de dos en dos para encontrar contradicciones ('cruzar SCP-173 SCP-096') — eso le da un hallazgo. Una vez que haya reunido suficientes hallazgos, escriba 'informe' y elija un final. Ese es todo el ciclo: leer, comparar, reunir, cerrar el caso." },
      { h: "Clase de Objeto", b: "Safe: bajo riesgo. Euclid: comportamiento no comprendido del todo, requiere precaución. Keter: alto riesgo, exige contención estricta. Thaumiel: anomalías que la Fundación usa activamente como herramienta contra otras anomalías." },
      { h: "Nivel de Autorización", b: "Los registros están bloqueados entre el Nivel 2 y el 6. Algunas secciones muestran [REDACTADO] hasta que su autorización sea suficiente. Las claves están ocultas dentro de los propios documentos — encuentre una y escriba 'codigo <clave>' para elevar su autorización." },
      { h: "Contaminación Cognitiva", b: "Aumenta a medida que lee. Al 100% la auditoría termina para usted. 'descansar' termina un día y la reduce; leer el archivo SCP-999 y usar un amnésico también la reducen." },
      { h: "Hallazgos / Referencia Cruzada", b: "El corazón del juego: compare dos registros que haya leído con 'cruzar <A> <B>'. La inconsistencia entre ellos se convierte en un hallazgo. Reúna suficientes y podrá cerrar la auditoría con 'informe'." },
      { h: "Rango / Experiencia", b: "Leer y cruzar referencias otorgan experiencia. Cuando sube de rango, el archivo lo registra y su contaminación se alivia un poco." },
      { h: "El Reloj de Once Días", b: "La orden de trabajo permanece abierta durante once días. 'descansar' termina un día. Al final del día 11, la asignación se le retira de las manos, terminada o no." },
    ],
  },
  fr: {
    boot_connecting: "Terminal SCiPNET — connexion en cours...",
    btn_play: "Jouer",
    btn_continue: "Continuer",
    savefile_btn: "Fichier de sauvegarde",
    savefile_title: "FICHIER DE SAUVEGARDE",
    savefile_help: "Votre progression est enregistrée automatiquement dans ce navigateur, le jeu reprend donc toujours là où vous vous êtes arrêté. Pour la déplacer vers un autre appareil ou en faire une copie de secours, téléchargez ici un fichier de sauvegarde et chargez-le là-bas.",
    savefile_download: "Télécharger le fichier de sauvegarde",
    savefile_load: "Charger un fichier de sauvegarde",
    savefile_bad: "Ce fichier n'est pas un fichier de sauvegarde valide.",
    savefile_confirm: "Remplacer votre progression actuelle par ce fichier ?",
    st_clearance: "Habilitation",
    st_day: "Jour",
    st_findings: "Constats",
    st_contam: "Contamination",
    browser_title: "REGISTRES",
    browser_tab_records: "Registres",
    browser_tab_findings: "Constats",
    browser_search_ph: "rechercher...",
    browser_locked: "verrouillé",
    browser_read: "lu",
    browser_empty: "Aucun registre accessible dans cet acte.",
    browser_no_match: "Aucune correspondance.",
    findings_empty: "Aucun constat pour l'instant. Comparez deux registres que vous avez lus.",
    toast_finding: "NOUVEAU CONSTAT",
    toast_rankup: "CHANGEMENT DE RANG",
    toast_danger: "CONTAMINATION CRITIQUE",
    toast_warning: "CONTAMINATION EN HAUSSE",
    day_urgent: "Le dernier jour approche",
    cross_tray_hint: "Choisissez deux registres que vous avez lus pour les comparer :",
    cross_tray_go: "Comparer",
    cross_tray_need_one_more: "choisissez-en 1 de plus",
    cross_tray_clear: "Effacer",
    btn_close: "Fermer",
    session_ended_1: ">> session terminée",
    session_ended_2: ">> actualisez la page pour commencer une nouvelle partie",
    tut_title: "COMMENT JOUER",
    tut_button: "Comment jouer",
    tut_close: "Compris, commencer",
    tut_items: [
      { h: "Quel est l'objectif ?", b: "Vous êtes un auditeur d'archive. Votre tâche : lire les registres ('liste' pour les voir, 'lire SCP-173' pour en ouvrir un), les comparer deux par deux pour trouver des contradictions ('croiser SCP-173 SCP-096') — cela vous donne un constat. Une fois que vous avez réuni suffisamment de constats, tapez 'rapport' et choisissez une fin. C'est toute la boucle : lire, comparer, réunir, clore le dossier." },
      { h: "Classe d'Objet", b: "Safe : faible risque. Euclid : comportement mal compris, nécessite de la prudence. Keter : haut risque, exige un confinement strict. Thaumiel : anomalies que la Fondation utilise activement comme outil contre d'autres anomalies." },
      { h: "Niveau d'Habilitation", b: "Les registres sont verrouillés entre les Niveaux 2 et 6. Certaines sections affichent [CAVIARDÉ] tant que votre habilitation n'est pas suffisante. Les clés sont cachées dans les documents eux-mêmes — trouvez-en une et tapez 'code <clé>' pour élever votre habilitation." },
      { h: "Contamination Cognitive", b: "Augmente à mesure que vous lisez. À 100%, l'audit se termine pour vous. 'reposer' termine une journée et la réduit ; lire le dossier SCP-999 et utiliser un amnésique la réduisent aussi." },
      { h: "Constats / Recoupement", b: "Le cœur du jeu : comparez deux registres que vous avez lus avec 'croiser <A> <B>'. L'incohérence entre eux devient un constat. Réunissez-en suffisamment et vous pourrez clore l'audit avec 'rapport'." },
      { h: "Rang / Expérience", b: "Lire et recouper rapportent de l'expérience. Un changement de rang est consigné par l'archive et allège légèrement votre contamination." },
      { h: "L'Horloge de Onze Jours", b: "L'ordre de travail reste ouvert pendant onze jours. 'reposer' termine une journée. À la fin du jour 11, la mission vous est retirée des mains, terminée ou non." },
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
