/*
 * Atmosphere: momentary wrongness. Glitching lines, phantom text that isn't in
 * the game, colour shifts, blackouts, a heartbeat. Everything here is
 * cosmetic and temporary: no event changes the game state or the saved text.
 * The higher the contamination, the more often (and the harder) it happens.
 *
 * Players can switch it all off (fx button); flashing events are also skipped
 * when the OS asks for reduced motion.
 */
(function () {
  const FX_KEY = "silent-archive-fx";

  const PHANTOM = {
    en: [
      "{name}, you are not the first to read this file.",
      "It read you first.",
      "Do not open the door in Sublevel 3.",
      "Someone else has been reading these records. Check the timestamps.",
      "You are being cross-referenced.",
      "The dead are also on the roster.",
      "Please stop reading. Please.",
      "Don't look at the redacted parts. They look back.",
      "The last auditor stopped on day eleven.",
      "You typed that. Didn't you?",
    ],
    tr: [
      "{name}, bu dosyayı okuyan ilk kişi değilsin.",
      "Seni önce o okudu.",
      "Alt Kat 3'teki kapıyı açma.",
      "Bu kayıtları başka biri de okuyor. Zaman damgalarına bak.",
      "Şu an sen çapraz referanslanıyorsun.",
      "Ölüler de listede.",
      "Lütfen okumayı bırak. Lütfen.",
      "Karartılmış yerlere bakma. Onlar da sana bakıyor.",
      "Son denetçi on birinci günde durdu.",
      "Bunu sen yazdın. Değil mi?",
    ],
    es: [
      "{name}, no eres la primera persona en leer este archivo.",
      "Te leyó a ti primero.",
      "No abras la puerta del Subnivel 3.",
      "Alguien más ha estado leyendo estos registros. Mira las marcas de tiempo.",
      "Te están cotejando.",
      "Los muertos también están en la lista.",
      "Deja de leer. Por favor.",
      "No mires las partes censuradas. Te devuelven la mirada.",
      "El último auditor se detuvo el día once.",
      "Eso lo escribiste tú. ¿Verdad?",
    ],
    fr: [
      "{name}, vous n'êtes pas le premier à lire ce dossier.",
      "Il vous a lu en premier.",
      "N'ouvrez pas la porte du Sous-sol 3.",
      "Quelqu'un d'autre lit ces dossiers. Regardez les horodatages.",
      "Vous êtes en train d'être recoupé.",
      "Les morts figurent aussi sur la liste.",
      "Arrêtez de lire. S'il vous plaît.",
      "Ne regardez pas les passages caviardés. Ils vous regardent.",
      "Le dernier auditeur s'est arrêté au onzième jour.",
      "C'est vous qui avez tapé ça. N'est-ce pas ?",
    ],
  };
  const TITLES = {
    en: ["it is reading you back", "do not close this tab", "S̷i̷l̷e̷n̷t̷ ̷A̷r̷c̷h̷i̷v̷e̷"],
    tr: ["seni geri okuyor", "bu sekmeyi kapatma", "S̷e̷s̷s̷i̷z̷ ̷A̷r̷ş̷i̷v̷"],
    es: ["te está leyendo de vuelta", "no cierres esta pestaña", "A̷r̷c̷h̷i̷v̷o̷ ̷S̷i̷l̷e̷n̷t̷e̷"],
    fr: ["il vous lit en retour", "ne fermez pas cet onglet", "A̷r̷c̷h̷i̷v̷e̷ ̷S̷i̷l̷e̷n̷c̷i̷e̷u̷x̷"],
  };
  const TYPED = {
    en: ["help me", "behind you", "don't", "it's here"],
    tr: ["yardım et", "arkanda", "yapma", "burada"],
    es: ["ayúdame", "detrás de ti", "no lo hagas", "está aquí"],
    fr: ["aidez-moi", "derrière vous", "non", "il est là"],
  };
  const REVEAL = {
    en: ["HERE", "LOOK", "RUN", "YOU"],
    tr: ["BURADA", "BAK", "KAÇ", "SEN"],
    es: ["AQUÍ", "MIRA", "CORRE", "TÚ"],
    fr: ["ICI", "REGARDE", "FUIS", "VOUS"],
  };
  const LOST = {
    en: ["CONNECTION LOST", "…connection restored. Something else is connected too."],
    tr: ["BAĞLANTI KOPTU", "…bağlantı yeniden kuruldu. Başka bir şey de bağlı."],
    es: ["CONEXIÓN PERDIDA", "…conexión restablecida. Hay algo más conectado."],
    fr: ["CONNEXION PERDUE", "…connexion rétablie. Autre chose est connecté aussi."],
  };
  const NOISE = "▓▒░█#@%&?/|<>~§Ω¥¤Ж";

  const S = {
    on: true, reduced: false, contam: 0, running: false, timer: null,
    ctx: { getName: () => "Auditor", getLang: () => "en" },
  };
  try {
    S.on = localStorage.getItem(FX_KEY) !== "off";
    S.reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch { /* ignore */ }

  const $ = (sel) => document.querySelector(sel);
  const rnd = (n) => Math.floor(Math.random() * n);
  const pickOf = (arr) => arr[rnd(arr.length)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Languages without their own lines here (yet) fall back to English.
  const lang = () => { const l = S.ctx.getLang(); return PHANTOM[l] ? l : "en"; };
  const sfx = (name) => { try { if (window.SFX && window.SFX[name]) window.SFX[name](); } catch { /* ignore */ } };
  const modalOpen = () => !!document.querySelector(".modal:not(.hidden)");

  function recentLines(n, filter) {
    const all = [...document.querySelectorAll("#terminal .line")]
      .filter((el) => !el.dataset.typing && !el.classList.contains("phantom"));
    return all.slice(-n).filter(filter || (() => true));
  }

  function scrollDown() { const t = $("#terminal"); if (t) t.scrollTop = t.scrollHeight; }

  // ---- events -------------------------------------------------------------

  async function glitchText() {
    const lines = recentLines(30, (el) => el.textContent.trim().length > 8);
    if (!lines.length) return;
    const chosen = [pickOf(lines)];
    if (S.contam > 40) chosen.push(pickOf(lines));
    const saved = [];
    for (const el of chosen) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) saved.push([walker.currentNode, walker.currentNode.nodeValue]);
      el.classList.add("glitching");
    }
    const strength = 0.12 + S.contam / 250;
    for (let frame = 0; frame < 4; frame++) {
      for (const [node, orig] of saved) {
        node.nodeValue = orig.replace(/\S/g, (ch) => (Math.random() < strength ? NOISE[rnd(NOISE.length)] : ch));
      }
      await wait(70 + rnd(60));
    }
    for (const [node, orig] of saved) node.nodeValue = orig;
    for (const el of chosen) el.classList.remove("glitching");
  }

  async function titleGlitch() {
    const orig = document.title;
    document.title = pickOf(TITLES[lang()]);
    await wait(1400 + rnd(1200));
    document.title = orig;
  }

  async function showPhantom(text, hold) {
    const term = $("#terminal");
    if (!term) return;
    const div = document.createElement("div");
    div.className = "line phantom";
    div.textContent = text;
    term.appendChild(div);
    scrollDown();
    await wait(hold);
    div.classList.add("gone");
    await wait(950);
    div.remove();
  }

  function phantomLine() {
    return showPhantom(pickOf(PHANTOM[lang()]).replace("{name}", S.ctx.getName()), 3200 + rnd(2800));
  }

  async function colorShift(kind) {
    const cls = "anomaly-" + kind;
    document.body.classList.add(cls);
    await wait(kind === "invert" ? 140 : 600 + rnd(1000));
    document.body.classList.remove(cls);
  }

  async function flicker() {
    const term = $("#terminal");
    if (!term) return;
    for (const o of [0.15, 1, 0.35, 1, 0.1, 1]) { term.style.opacity = o; await wait(55); }
    term.style.opacity = "";
  }

  async function shake() {
    const term = $("#terminal");
    if (!term) return;
    term.classList.add("shake");
    sfx("thump");
    await wait(380);
    term.classList.remove("shake");
  }

  async function cursorLie() {
    const tag = $("#prompt-tag");
    if (!tag) return;
    const orig = tag.textContent;
    const fake = pickOf(["scipnet [██████] >", "scipnet [YOU] >", "scipnet [?????] >"]);
    tag.textContent = fake;
    await wait(1300);
    if (tag.textContent === fake) tag.textContent = orig;
  }

  async function phantomTyping() {
    const input = $("#cmd-input");
    if (!input || input.disabled || input.value || document.activeElement !== input) return;
    const word = pickOf(TYPED[lang()]);
    let typed = "";
    for (const ch of word) {
      if (input.value !== typed) return; // the player started typing: stop at once
      typed += ch;
      input.value = typed;
      await wait(110 + rnd(120));
    }
    await wait(1100);
    if (input.value === typed) input.value = "";
  }

  async function redactReveal() {
    const marks = recentLines(40).flatMap((el) => [...el.querySelectorAll(".tok-redact")]);
    if (!marks.length) return;
    const el = pickOf(marks);
    const orig = el.textContent;
    el.textContent = pickOf(REVEAL[lang()]);
    el.classList.add("reveal");
    await wait(650);
    el.textContent = orig;
    el.classList.remove("reveal");
  }

  async function blackout() {
    const box = $("#blackout");
    if (!box) return;
    const [lost, back] = LOST[lang()];
    box.textContent = lost;
    box.classList.add("on");
    sfx("staticBurst");
    await wait(450 + rnd(500));
    box.classList.remove("on");
    await wait(500);
    await showPhantom(back, 3600);
  }

  // ---- scheduling ---------------------------------------------------------

  // [weight, minContam, fn, flashy]
  const EVENTS = [
    [3, 0, glitchText, false],
    [3, 0, titleGlitch, false],
    [2, 8, () => colorShift("mono"), false],
    [3, 15, phantomLine, false],
    [2, 20, redactReveal, false],
    [1, 25, cursorLie, false],
    [2, 25, phantomTyping, false],
    [2, 35, () => colorShift("sick"), false],
    [2, 40, () => { sfx("sub"); return colorShift("red"); }, true],
    [1, 45, flicker, true],
    [2, 60, blackout, true],
    [1, 65, shake, true],
    [1, 70, () => { sfx("heartbeat"); return colorShift("invert"); }, true],
  ];

  function fireRandom() {
    const pool = EVENTS.filter(([, min, , flashy]) => S.contam >= min && !(flashy && S.reduced));
    const total = pool.reduce((a, e) => a + e[0], 0);
    let r = Math.random() * total;
    for (const [w, , fn] of pool) { r -= w; if (r <= 0) { fn(); return; } }
  }

  function nextDelay() {
    const c = S.contam;
    const base = c < 15 ? 80000 : c < 40 ? 55000 : c < 70 ? 30000 : 15000;
    return base * (0.6 + Math.random() * 0.8);
  }

  function tick() {
    if (!S.running) return;
    if (S.on && !document.hidden && !modalOpen()) { try { fireRandom(); } catch { /* cosmetic only */ } }
    S.timer = setTimeout(tick, nextDelay());
  }

  // Contamination thresholds always get a reaction, whatever the dice say.
  function crossed(before, after) {
    if (!S.on || after <= before) return;
    const hit = (n) => before < n && after >= n;
    if (hit(85)) { sfx("heartbeat"); colorShift("red"); if (!S.reduced) shake(); phantomLine(); }
    else if (hit(70)) { if (!S.reduced) blackout(); else phantomLine(); }
    else if (hit(55)) { sfx("sub"); phantomLine(); }
    else if (hit(40)) { glitchText(); colorShift("sick"); }
    else if (hit(25)) { glitchText(); }
  }

  function setContam(c) {
    S.contam = c;
    document.body.dataset.dread = c >= 80 ? "3" : c >= 55 ? "2" : c >= 30 ? "1" : "0";
  }

  function applyOnOff() { document.body.classList.toggle("fx-off", !S.on); }

  window.Atmosphere = {
    init(ctx) { Object.assign(S.ctx, ctx); applyOnOff(); },
    start() {
      if (S.running) return;
      S.running = true;
      S.timer = setTimeout(tick, 30000 + rnd(15000));
    },
    stop() { S.running = false; clearTimeout(S.timer); },
    setContam, crossed,
    isEnabled: () => S.on,
    setEnabled(v) {
      S.on = !!v;
      try { localStorage.setItem(FX_KEY, v ? "on" : "off"); } catch { /* ignore */ }
      applyOnOff();
    },
    // For testing from the console: Atmosphere.fire("blackout")
    fire(name, arg) {
      const fns = { glitchText, titleGlitch, phantomLine, colorShift, flicker, shake, cursorLie, phantomTyping, redactReveal, blackout };
      return fns[name] && fns[name](arg);
    },
  };
})();
