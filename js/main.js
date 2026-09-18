import * as Cloud from "./cloud.js";

const $ = (sel) => document.querySelector(sel);
const screens = {
  boot: $("#boot-screen"), auth: $("#auth-screen"), game: $("#game-screen"),
};

function showScreen(name) {
  for (const s of Object.values(screens)) s.classList.add("hidden");
  screens[name].classList.remove("hidden");
}

const LOCAL_SAVE_KEY = "sessiz-arsiv-save-v1";

let inGame = false;
let awaitingConfirm = null;
let awaitingReportChoice = null;
let gameOver = false;
const history = [];
let historyIdx = -1;
let crossPicks = [];      // record ids picked in the sidebar for cross-referencing

// ---------------------------------------------------------------------------
// language switcher — visible on every screen, drives both the static site
// chrome (I18N) and, once in game, the archive content language (Engine).
// ---------------------------------------------------------------------------

function wireLangSwitch() {
  const sel = $("#lang-select");
  if (sel && !sel.dataset.wired) {
    sel.dataset.wired = "1";
    const meta = window.LANGUAGE_META || [{ code: "en", label: "English" }];
    sel.innerHTML = meta
      .map((m) => `<option value="${m.code}">${m.label}</option>`)
      .join("");
    sel.addEventListener("change", () => {
      const code = sel.value;
      window.I18N.setUiLang(code);
      if (inGame) {
        const E = window.Engine;
        const state = E.getState();
        if (state.lang !== code && E.LANGS[code]) {
          state.lang = code;
          updatePromptTag();
          persist();
        }
      }
    });
  }
  window.I18N.setUiLang(window.I18N.getUiLang()); // paint + sync select value
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

async function boot() {
  try {
    await window.Engine.boot("data");
  } catch (err) {
    document.querySelector("#boot-screen p").textContent =
      "Failed to load game data: " + err.message;
    return;
  }

  // Returning player: pick up exactly where they left off, no clicks.
  if (readLocalSave()) {
    startGame(window.I18N.getUiLang());
    return;
  }
  showScreen("auth");
  wireAuthScreen();
}

// ---------------------------------------------------------------------------
// start screen: one button. (Also shown after `quit`, as "Continue".)
// ---------------------------------------------------------------------------

function wireAuthScreen() {
  // Can run more than once per page load — clone-and-replace so listeners
  // from an earlier visit don't stack up.
  const btn = freshEl("#play-btn");
  const key = readLocalSave() ? "btn_continue" : "btn_play";
  btn.dataset.i18n = key;
  btn.textContent = window.I18N.t(key);
  btn.addEventListener("click", () => startGame(window.I18N.getUiLang()));
  freshEl("#signin-btn").addEventListener("click", openAccount);
  paintEndingsCount();
  btn.focus();
}

// ---------------------------------------------------------------------------
// game
// ---------------------------------------------------------------------------

async function startGame(langCode, restored = null) {
  gameOver = false;
  const E = window.Engine;
  if (!E.LANGS[langCode]) langCode = E.BASE_LANG;

  // This browser's save is written after every command, so it is always the
  // freshest. A save file the player just loaded beats it, on purpose.
  let state = null;
  if (restored) {
    state = E.loadSanitizedState(restored, langCode);
  } else {
    const local = readLocalSave();
    if (local) state = E.loadSanitizedState(local, langCode);
  }
  if (!state) state = E.newState(langCode);
  state.lang = langCode;
  E.setState(state);
  if (restored) writeLocalSave(state);

  inGame = true;
  crossPicks = [];
  showScreen("game");
  $("#terminal").innerHTML = "";

  printIntro();
  updatePromptTag();
  browserTab = "records";
  browserSearch = "";
  renderDashboard();
  wireBrowserTabsAndSearch();
  renderRecordBrowser();
  wireSidebar();
  wireInput();
  $("#cmd-input").focus();
  window.Atmosphere.init({ getName: () => Cloud.getName(), getLang: () => E.getState().lang });
  window.Atmosphere.start();

  maybeShowTutorial();
}

// ---------------------------------------------------------------------------
// sidebar: dashboard stats, clickable record browser, cross-reference tray
// ---------------------------------------------------------------------------

function renderDashboard() {
  const E = window.Engine;
  const s = E.getState();

  $("#stat-clearance").textContent = `${s.clearance} / ${E.RULES.clearance_max}`;
  $("#stat-day").textContent = `${s.day} / ${E.RULES.days_max}`;
  $("#stat-findings").textContent = `${s.findings.length} / ${E.FINDING_ORDER.length}`;
  const ready = E.readyPairs().length;
  $("#stat-ready").textContent = ready;
  $("#stat-ready").classList.toggle("hot", ready > 0);

  const dayPct = Math.min(100, Math.round((s.day / E.RULES.days_max) * 100));
  const dayMeter = $("#meter-day");
  dayMeter.style.width = dayPct + "%";
  dayMeter.className = "meter-fill day" + (s.day >= E.RULES.days_max - 2 ? " urgent" : "");

  const c = s.contam;
  $("#stat-contam-pct").textContent = `${c}%`;
  const contamMeter = $("#meter-contam");
  contamMeter.style.width = c + "%";
  contamMeter.className = "meter-fill" + (c >= 70 ? " danger" : c >= 40 ? " warn" : "");

  const vignette = $("#tension-vignette");
  window.Atmosphere.setContam(c);
  vignette.classList.toggle("on", c >= 55);
  vignette.classList.toggle("pulse", c >= 80);

  const idx = E.rankIndex(s.xp);
  $("#stat-rank").textContent = E.rankName(idx);
  const ranks = E.RANKS;
  const next = ranks[idx + 1];
  const xpMeter = $("#meter-xp");
  if (next) {
    const prevAt = ranks[idx].at;
    const pct = Math.min(100, Math.round(((s.xp - prevAt) / (next.at - prevAt)) * 100));
    xpMeter.style.width = pct + "%";
    $("#stat-xp").textContent = `${s.xp} / ${next.at}`;
  } else {
    xpMeter.style.width = "100%";
    $("#stat-xp").textContent = `${s.xp}`;
  }
}

let browserTab = "records";
let browserSearch = "";

function renderRecordBrowser() {
  if (browserTab === "findings") { renderFindingsList(); return; }

  const E = window.Engine;
  const s = E.getState();
  const t = window.I18N.t;
  const box = $("#record-browser");
  box.innerHTML = "";

  const needle = E.fold(browserSearch);
  const accessible = E.RECORD_ORDER.filter((rid) => E.accessible(rid))
    .filter((rid) => !needle || E.fold(E.T("records", rid, "name", { default: rid })).includes(needle));

  if (!accessible.length) {
    const p = document.createElement("div");
    p.className = "rb-tag";
    p.textContent = browserSearch ? t("browser_no_match") : t("browser_empty");
    box.appendChild(p);
    return;
  }

  let currentAct = null;
  for (const rid of accessible) {
    const meta = E.RECORDS[rid];
    if (meta.act !== currentAct) {
      currentAct = meta.act;
      const h = document.createElement("div");
      h.className = "rb-act-header";
      h.style.marginTop = currentAct === meta.act && box.children.length === 0 ? "0" : "";
      h.textContent = E.T("acts", String(currentAct), "title", { default: "ACT " + currentAct });
      box.appendChild(h);
    }
    const isRead = s.read.includes(rid);
    const row = document.createElement("div");
    row.className = "rb-row" + (isRead ? " read" : "");

    if (isRead) {
      const check = document.createElement("span");
      check.className = "rb-check" + (crossPicks.includes(rid) ? " picked" : "");
      check.textContent = crossPicks.includes(rid) ? "✓" : "";
      check.addEventListener("click", (e) => { e.stopPropagation(); toggleCrossPick(rid); });
      row.appendChild(check);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "rb-check";
      spacer.style.visibility = "hidden";
      row.appendChild(spacer);
    }

    const name = document.createElement("span");
    name.className = "rb-name";
    name.textContent = (E.T("records", rid, "name", { default: rid }));
    row.appendChild(name);

    if (isRead) {
      const tag = document.createElement("span");
      tag.className = "rb-tag";
      tag.textContent = "✓";
      row.appendChild(tag);
    }

    row.addEventListener("click", () => {
      window.SFX.open();
      handleLine("read " + rid);
    });
    box.appendChild(row);
  }
}

function renderFindingsList() {
  const E = window.Engine;
  const s = E.getState();
  const t = window.I18N.t;
  const box = $("#record-browser");
  box.innerHTML = "";

  const needle = E.fold(browserSearch);
  const found = E.FINDING_ORDER.filter((fid) => s.findings.includes(fid))
    .filter((fid) => !needle || E.fold(E.T("findings", fid, "title", { default: fid })).includes(needle));

  if (!found.length) {
    const p = document.createElement("div");
    p.className = "rb-tag";
    p.textContent = browserSearch ? t("browser_no_match") : t("findings_empty");
    box.appendChild(p);
    return;
  }

  for (const fid of found) {
    const card = document.createElement("div");
    card.className = "finding-card";
    const title = document.createElement("div");
    title.className = "fc-title";
    title.textContent = E.T("findings", fid, "title", { default: fid });
    const excerpt = document.createElement("div");
    excerpt.className = "fc-excerpt";
    const full = E.T("findings", fid, "text", { default: "" });
    excerpt.textContent = full.length > 100 ? full.slice(0, 100) + "…" : full;
    card.appendChild(title);
    card.appendChild(excerpt);
    card.addEventListener("click", () => {
      window.SFX.open();
      printLine("", "");
      printLine("=".repeat(72), "darkgreen");
      printLine("  " + title.textContent, "bold white");
      printLine("", "");
      printLine(full, "green");
      printLine("=".repeat(72), "darkgreen");
      scrollDown();
    });
    box.appendChild(card);
  }
}

function wireBrowserTabsAndSearch() {
  document.querySelectorAll("#browser-tabs .rb-tab").forEach((tab) => {
    const clone = tab.cloneNode(true);
    tab.replaceWith(clone);
  });
  document.querySelectorAll("#browser-tabs .rb-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#browser-tabs .rb-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      browserTab = tab.dataset.tab;
      window.SFX.key();
      renderRecordBrowser();
    });
  });
  const search = freshEl("#rb-search");
  search.value = browserSearch;
  search.addEventListener("input", () => {
    browserSearch = search.value;
    renderRecordBrowser();
  });
}

function toggleCrossPick(rid) {
  const idx = crossPicks.indexOf(rid);
  if (idx >= 0) {
    crossPicks.splice(idx, 1);
  } else {
    if (crossPicks.length >= 2) crossPicks.shift();
    crossPicks.push(rid);
  }
  window.SFX.key();
  renderRecordBrowser();
  renderCrossTray();
}

function renderCrossTray() {
  const E = window.Engine;
  const t = window.I18N.t;
  const tray = $("#cross-tray");
  if (!crossPicks.length) { tray.classList.add("hidden"); return; }
  tray.classList.remove("hidden");
  $("#cross-tray-label").textContent = crossPicks.length < 2 ? t("cross_tray_need_one_more") : t("cross_tray_hint");

  const picksBox = $("#cross-tray-picks");
  picksBox.innerHTML = "";
  for (const rid of crossPicks) {
    const row = document.createElement("div");
    row.className = "cross-pick";
    const name = document.createElement("span");
    name.textContent = E.T("records", rid, "name", { default: rid });
    const rm = document.createElement("button");
    rm.textContent = "×";
    rm.addEventListener("click", () => toggleCrossPick(rid));
    row.appendChild(name);
    row.appendChild(rm);
    picksBox.appendChild(row);
  }

  const goBtn = $("#cross-tray-go");
  goBtn.disabled = crossPicks.length !== 2;
  goBtn.textContent = t("cross_tray_go");
}

// Re-wired every time startGame() runs (e.g. quit then log back in without a
// full page reload) — clone-and-replace each button first so stale listeners
// from a previous game session don't stack up and double-fire.
function freshEl(sel) {
  const el = $(sel);
  const clone = el.cloneNode(true);
  el.replaceWith(clone);
  return clone;
}

function wireSidebar() {
  freshEl("#cross-tray-go").addEventListener("click", () => {
    if (crossPicks.length !== 2) return;
    const [a, b] = crossPicks;
    crossPicks = [];
    renderRecordBrowser();
    renderCrossTray();
    handleLine(`cross ${a} ${b}`);
  });
  freshEl("#sidebar-toggle").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });
  const sfxBtn = freshEl("#sfx-toggle");
  sfxBtn.addEventListener("click", () => {
    window.SFX.setMuted(!window.SFX.isMuted());
    $("#sfx-toggle").textContent = window.SFX.isMuted() ? "🔇" : "🔊";
  });
  sfxBtn.textContent = window.SFX.isMuted() ? "🔇" : "🔊";
}

// ---------------------------------------------------------------------------
// onboarding tutorial (object classes, clearance, contamination, findings...)
// ---------------------------------------------------------------------------

const TUTORIAL_SEEN_KEY = "silent-archive-tutorial-seen";

function buildTutorialContent() {
  const box = $("#tutorial-body");
  box.innerHTML = "";
  for (const item of window.I18N.t("tut_items")) {
    const div = document.createElement("div");
    div.className = "tut-item";
    const h3 = document.createElement("h3");
    h3.textContent = item.h;
    const p = document.createElement("p");
    p.textContent = item.b;
    div.appendChild(h3);
    div.appendChild(p);
    box.appendChild(div);
  }
}

function openTutorial() {
  buildTutorialContent();
  $("#tutorial-modal").classList.remove("hidden");
}

function closeTutorial() {
  $("#tutorial-modal").classList.add("hidden");
  try { localStorage.setItem(TUTORIAL_SEEN_KEY, "1"); } catch { /* ignore */ }
  $("#cmd-input").focus();
}

function maybeShowTutorial() {
  let seen = false;
  try { seen = localStorage.getItem(TUTORIAL_SEEN_KEY) === "1"; } catch { /* ignore */ }
  if (!seen) openTutorial();
}

$("#tutorial-btn").addEventListener("click", openTutorial);
$("#tutorial-close").addEventListener("click", closeTutorial);

async function printIntro() {
  const E = window.Engine;
  const fast = E.getState().fast;
  const logo = document.createElement("pre");
  logo.className = "line darkgreen";
  logo.textContent = "   ___  ___ _ ___  _  _ ___ _____\n  / __|/ __(_) _ \\| \\| | __|_   _|\n  \\__ \\ (__| |  _/| .` | _|  | |\n  |___/\\___|_|_|  |_|\\_|___| |_|";
  $("#terminal").appendChild(logo);
  printLine("  " + E.T("ui", "banner_sub"), "dim darkgreen");
  printLine("=".repeat(72), "darkgreen");
  printLine("");
  const introLines = E.T("intro", { default: [] });
  const who = Cloud.getName().toUpperCase();
  for (const raw of introLines) {
    const l = raw.replace("A. DEREN", who);
    if (fast) printLine(l, "green"); else await typeLine(l, "green", 9);
  }
  printLine("");
  printLine("=".repeat(72), "darkgreen");
  printLine("  " + E.T("acts", "1", "title"), "bold cyan");
  const blurb = E.T("acts", "1", "blurb", { default: "" });
  if (fast) printLine(blurb, "green"); else await typeLine(blurb, "green", 9);
  printLine("=".repeat(72), "darkgreen");
  printLine(E.T("ui", "intro_hint"), "cyan");
  printLine("=".repeat(72), "darkgreen");
  scrollDown();
}

function printLine(text, cls = "") {
  if (text === undefined || text === null) return;
  const div = document.createElement("div");
  div.className = "line " + cls;
  div.textContent = text;
  decorate(div);
  $("#terminal").appendChild(div);
}

// ---------------------------------------------------------------------------
// decoration: colour the things worth noticing inside a line (SCP numbers,
// object classes, redactions, percentages, quoted speech). Purely visual: the
// text itself is never changed.
// ---------------------------------------------------------------------------

const TOKEN_RE = new RegExp([
  "(?<scp>\\bSCP-\\d{3,4}(?:-[A-Z]{1,3})?\\b)",
  "(?<redact>\\[[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ _-]{2,30}\\])",
  "(?<cls>\\b(?:Safe|Euclid|Keter|Thaumiel|Apollyon)\\b)",
  "(?<key>>>[^\\n]{3,80}<<)",
  "(?<num>\\b\\d+(?:[.,]\\d+)?\\s?%)",
  "(?<quote>\u201c[^\u201d]{3,200}\u201d|\"[^\"\\n]{3,200}\")",
].join("|"), "g");

function decorate(el) {
  const text = el.textContent;
  if (text.length < 4) return;
  TOKEN_RE.lastIndex = 0;
  let last = 0, m, frag = null;
  while ((m = TOKEN_RE.exec(text))) {
    if (!frag) frag = document.createDocumentFragment();
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const g = m.groups;
    let cls = "tok-scp";
    if (g.redact) cls = "tok-redact";
    else if (g.cls) cls = "tok-" + m[0].toLowerCase().replace("apollyon", "keter");
    else if (g.key) cls = "tok-key";
    else if (g.num) cls = "tok-num";
    else if (g.quote) cls = "tok-quote";
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = m[0];
    frag.appendChild(span);
    last = m.index + m[0].length;
  }
  if (!frag) return;
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  el.textContent = "";
  el.appendChild(frag);
}

// Typewriter reveal for atmospheric lines (record/finding/mail bodies, day
// narratives, endings, rank-ups). Long text reveals in small chunks (not
// strictly one character at a time) so a 700-word record finishes in a few
// seconds rather than a minute. Click anywhere in the terminal to instantly
// finish the line currently animating.
let skipRequested = false;
$("#terminal").addEventListener("click", () => {
  skipRequested = true;
  $("#cmd-input").focus();
});

function typeLine(text, cls, speedHint) {
  return new Promise((resolve) => {
    const div = document.createElement("div");
    div.className = "line " + cls;
    $("#terminal").appendChild(div);
    if (!text) { resolve(); return; }
    skipRequested = false;
    div.dataset.typing = "1";
    const finish = () => { div.textContent = text; decorate(div); delete div.dataset.typing; scrollDown(); resolve(); };
    const interval = speedHint || 12;
    const chunk = text.length <= 90 ? 1 : Math.max(1, Math.round(text.length / 150));
    let i = 0;
    function step() {
      if (skipRequested) { finish(); return; }
      i = Math.min(text.length, i + chunk);
      div.textContent = text.slice(0, i);
      scrollDown();
      if (i >= text.length) { finish(); return; }
      setTimeout(step, interval);
    }
    step();
  });
}

async function printLines(lines) {
  const fast = window.Engine.getState().fast;
  for (const l of lines) {
    if (l.anim && !fast) {
      await typeLine(l.text, l.cls, l.animSpeed);
    } else {
      printLine(l.text, l.cls);
    }
  }
  scrollDown();
}

function scrollDown() {
  const t = $("#terminal");
  t.scrollTop = t.scrollHeight;
}

function updatePromptTag() {
  $("#prompt-tag").textContent = `scipnet [${window.Engine.prompt()}] >`;
}

function wireInput() {
  const input = $("#cmd-input");
  input.replaceWith(input.cloneNode(true)); // drop any previous listeners
  const fresh = $("#cmd-input");
  fresh.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const raw = fresh.value;
      fresh.value = "";
      if (raw.trim()) { history.push(raw); historyIdx = history.length; }
      handleLine(raw);
    } else if (e.key === "ArrowUp") {
      if (historyIdx > 0) { historyIdx--; fresh.value = history[historyIdx] || ""; }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (historyIdx < history.length) {
        historyIdx++;
        fresh.value = history[historyIdx] || "";
      }
      e.preventDefault();
    } else if (e.key.length === 1 || e.key === "Backspace") {
      window.SFX.key();
    }
  });
  fresh.disabled = false;
}

function refreshSidebar() {
  renderDashboard();
  renderRecordBrowser();
  renderCrossTray();
}

// Compares state before/after a command to fire the right sound cue — takes
// plain-number snapshots (not the live state object) since findings/etc are
// mutated in place by the engine and a shallow copy would alias them.
function snapshot(s) {
  return { findingsCount: s.findings.length, rankSeen: s.rank_seen, contam: s.contam };
}
function showToast(text, cls = "") {
  const stack = $("#toast-stack");
  const el = document.createElement("div");
  el.className = "toast" + (cls ? " " + cls : "");
  el.textContent = text;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

function playCueFor(before, s) {
  const E = window.Engine;
  const t = window.I18N.t;
  const after = snapshot(s);
  window.Atmosphere.crossed(before.contam, after.contam);
  if (after.findingsCount > before.findingsCount) { window.SFX.finding(); showToast(t("toast_finding")); return; }
  if (after.rankSeen > before.rankSeen) { window.SFX.rankUp(); showToast(t("toast_rankup") + ": " + E.rankName(after.rankSeen)); return; }
  if (after.contam >= 70 && before.contam < 70) { window.SFX.danger(); showToast(t("toast_danger"), "danger"); return; }
  if (after.contam >= 40 && before.contam < 40) { window.SFX.warning(); showToast(t("toast_warning"), "warn"); return; }
}

async function handleLine(raw) {
  if (gameOver) return;
  const E = window.Engine;
  window.SFX.submit();
  printLine("");

  if (awaitingConfirm) {
    const fn = awaitingConfirm;
    awaitingConfirm = null;
    const before = snapshot(E.getState());
    const res = fn(E.isYes(raw));
    persist();
    await printLines(res.lines);
    playCueFor(before, E.getState());
    if (res.ended) handleEnding(res.ended);
    updatePromptTag();
    refreshSidebar();
    if (!gameOver) persist();
    return;
  }
  if (awaitingReportChoice) {
    const fn = awaitingReportChoice;
    awaitingReportChoice = null;
    const res = fn(raw.trim());
    persist();
    await printLines(res.lines);
    if (res.ended) handleEnding(res.ended);
    updatePromptTag();
    refreshSidebar();
    if (!gameOver) persist();
    return;
  }

  const before = snapshot(E.getState());
  const result = E.runCommand(raw);
  if (!result) return;

  if (result.hostVerb === "save") {
    persist();
    printLine(E.T("ui", "saved"), "cyan");
    updatePromptTag();
    return;
  }
  if (result.hostVerb === "load") {
    await reloadSave();
    printLine(E.T("ui", "loaded"), "cyan");
    updatePromptTag();
    refreshSidebar();
    return;
  }
  if (result.hostVerb === "quit") {
    printLine(E.T("ui", "bye"), "dim darkgreen");
    persist();
    await flushSync();
    gameOver = true;
    inGame = false;
    $("#cmd-input").disabled = true;
    setTimeout(() => { showScreen("auth"); wireAuthScreen(); }, 900);
    return;
  }

  persist();

  if (result.clearScreen) {
    $("#terminal").innerHTML = "";
    await printIntro();
  }

  await printLines(result.lines);
  playCueFor(before, E.getState());

  if (result.pendingConfirm) awaitingConfirm = result.pendingConfirm;
  if (result.pendingReportChoice) awaitingReportChoice = result.pendingReportChoice;

  if (result.ended) handleEnding(result.ended);

  updatePromptTag();
  refreshSidebar();
  if (!gameOver) persist();
}

function handleEnding(ended) {
  gameOver = true;
  if (ended && ended.id) {
    const E = window.Engine;
    const full = ended.kind === "finish" &&
      E.getState().findings.length / E.FINDING_ORDER.length >= E.RULES.ending_full_ratio;
    if (recordEnding(ended.id, full)) showToast(window.I18N.t("endings_new"));
  }
  $("#cmd-input").disabled = true;
  window.SFX.ending();
  clearSave();
  printLine("");
  printLine(window.I18N.t("session_ended_1"), "dim amber");
  printLine(window.I18N.t("session_ended_2"), "dim amber");
}

// ---------------------------------------------------------------------------
// endings tracker (per browser): which endings were reached, and whether with
// a full set of findings.
// ---------------------------------------------------------------------------

const ENDINGS_KEY = "silent-archive-endings";

function readEndings() {
  try {
    const raw = JSON.parse(localStorage.getItem(ENDINGS_KEY) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}

// Returns true when this ending had never been reached before.
function recordEnding(id, full) {
  const seen = readEndings();
  const isNew = !(id in seen);
  seen[id] = full || seen[id] === "full" ? "full" : "partial";
  try { localStorage.setItem(ENDINGS_KEY, JSON.stringify(seen)); } catch { /* ignore */ }
  paintEndingsCount();
  return isNew;
}

function paintEndingsCount() {
  const E = window.Engine;
  const el = $("#endings-count");
  if (!el || !E.ENDING_IDS) return;
  const n = Object.keys(readEndings()).filter((id) => E.ENDING_IDS.includes(id)).length;
  el.textContent = n
    ? window.I18N.t("endings_count").replace("{n}", n).replace("{t}", E.ENDING_IDS.length)
    : "";
}

function openEndings() {
  const E = window.Engine;
  const t = window.I18N.t;
  const seen = readEndings();
  const list = $("#endings-list");
  list.innerHTML = "";
  for (const id of E.ENDING_IDS) {
    const li = document.createElement("li");
    if (seen[id]) {
      li.className = "seen";
      const title = E.T("endings", id, "title", { default: id }).replace(/^\s*(ENDING|SON|FINAL|FIN)\s*[—-]\s*/i, "");
      li.textContent = title + "  [" + t(seen[id] === "full" ? "endings_full" : "endings_partial") + "]";
    } else {
      li.textContent = t("endings_locked");
    }
    list.appendChild(li);
  }
  $("#endings-modal").classList.remove("hidden");
}

function closeEndings() {
  $("#endings-modal").classList.add("hidden");
  const input = $("#cmd-input");
  if (inGame && input && !input.disabled) input.focus();
}

$("#endings-btn").addEventListener("click", openEndings);
$("#endings-close").addEventListener("click", closeEndings);

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

function readLocalSave() {
  try {
    const raw = localStorage.getItem(LOCAL_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeLocalSave(state) {
  try { localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(state)); } catch { /* ignore quota errors */ }
}

function clearSave() {
  try { localStorage.removeItem(LOCAL_SAVE_KEY); } catch { /* ignore */ }
  // Deliberately does not touch the GitHub-synced save: that sync only
  // ever happens via an explicit player action (the "Sync to GitHub"
  // button opening a real GitHub issue), never silently from here.
}

// Progress is written to this browser after every command, so it resumes
// where the player left off with nothing to press. There is deliberately no
// server: the save file below is how progress moves between devices.
function persist() {
  writeLocalSave(window.Engine.getState());
  markSyncDirty();
}

async function reloadSave() {
  const E = window.Engine;
  const data = readLocalSave();
  if (!data) return;
  E.setState(E.loadSanitizedState(data, E.getState().lang));
}

// ---------------------------------------------------------------------------
// save file: download progress as a .json, load it on another device/browser
// ---------------------------------------------------------------------------

const SAVEFILE_MAX_BYTES = 200000;

// Keeps only the game's known fields with sane values, so a hand-edited or
// foreign file can't inject anything else into the game state.
function sanitizeImported(raw) {
  const int = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.trunc(v))) : undefined);
  const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length <= 80).slice(0, 2000) : undefined);
  const clean = {
    clearance: int(raw.clearance, 0, 10),
    contam: int(raw.contam, 0, 100),
    day: int(raw.day, 1, 50),
    xp: int(raw.xp, 0, 1000000),
    rank_seen: int(raw.rank_seen, 0, 20),
    turns: int(raw.turns, 0, 100000000),
    cure_used: int(raw.cure_used, 0, 1000),
    amnestics: int(raw.amnestics, 0, 100),
    read: strs(raw.read),
    findings: strs(raw.findings),
    mail_read: strs(raw.mail_read),
    thresholds_fired: Array.isArray(raw.thresholds_fired) ? raw.thresholds_fired.filter(Number.isFinite).slice(0, 20) : undefined,
    fast: typeof raw.fast === "boolean" ? raw.fast : undefined,
  };
  for (const k of Object.keys(clean)) if (clean[k] === undefined) delete clean[k];
  return clean;
}

function openSaveFile() {
  $("#savefile-status").textContent = "";
  $("#savefile-modal").classList.remove("hidden");
}

function closeSaveFile() {
  $("#savefile-modal").classList.add("hidden");
  const input = $("#cmd-input");
  if (input && !input.disabled) input.focus();
}

$("#savefile-btn").addEventListener("click", openSaveFile);
$("#savefile-close").addEventListener("click", closeSaveFile);

$("#savefile-download").addEventListener("click", () => {
  persist();
  const payload = {
    game: "silent-archive",
    version: 1,
    savedAt: new Date().toISOString(),
    state: window.Engine.getState(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `silent-archive-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("#savefile-load").addEventListener("click", () => $("#savefile-input").click());

$("#savefile-input").addEventListener("change", async (e) => {
  const t = window.I18N.t;
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > SAVEFILE_MAX_BYTES) throw new Error("too large");
    const data = JSON.parse(await file.text());
    const raw = data && typeof data === "object" && data.state ? data.state : data;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.read) || !Array.isArray(raw.findings)) {
      throw new Error("not a save file");
    }
    if (readLocalSave() && !window.confirm(t("savefile_confirm"))) return;
    closeSaveFile();
    startGame(window.I18N.getUiLang(), sanitizeImported(raw));
  } catch {
    $("#savefile-status").textContent = t("savefile_bad");
  }
});

// ---------------------------------------------------------------------------
// themes + effects toggle
// ---------------------------------------------------------------------------

const THEMES = ["archive", "terminal", "amber", "ice", "paper"];
const THEME_KEY = "silent-archive-theme";

function applyTheme(name) {
  if (!THEMES.includes(name)) name = THEMES[0];
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem(THEME_KEY, name); } catch { /* ignore */ }
  return name;
}

(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  applyTheme(saved);
})();

$("#theme-btn").addEventListener("click", () => {
  const next = THEMES[(THEMES.indexOf(document.documentElement.dataset.theme) + 1) % THEMES.length];
  applyTheme(next);
  showToast(window.I18N.t("theme_" + next));
});

function paintFxButton() {
  $("#fx-btn").style.opacity = window.Atmosphere.isEnabled() ? "1" : "0.4";
}
paintFxButton();
$("#fx-btn").addEventListener("click", () => {
  const on = !window.Atmosphere.isEnabled();
  window.Atmosphere.setEnabled(on);
  paintFxButton();
  showToast(window.I18N.t(on ? "fx_on" : "fx_off"));
});

// ---------------------------------------------------------------------------
// account: username + password. The server never sees the password (the key
// is derived in the browser); an account keeps its progress on any device.
// ---------------------------------------------------------------------------

function renderAccountView() {
  const t = window.I18N.t;
  const signed = Cloud.isAccount();
  $("#account-guest").classList.toggle("hidden", signed);
  $("#account-user").classList.toggle("hidden", !signed);
  $("#acct-signed-as").textContent = signed
    ? t("acct_signed_as").replace("{name}", Cloud.accountName())
    : t("acct_guest_state");
  $("#acct-status").textContent = "";
}

function openAccount() {
  renderAccountView();
  $("#account-modal").classList.remove("hidden");
  const first = Cloud.isAccount() ? $("#acct-close") : $("#acct-user");
  first.focus();
}

function closeAccount() {
  $("#account-modal").classList.add("hidden");
  const input = $("#cmd-input");
  if (inGame && input && !input.disabled) input.focus();
}

let accountBusy = false;

async function submitAccount(mode) {
  if (accountBusy) return;
  const t = window.I18N.t;
  const status = $("#acct-status");
  accountBusy = true;
  status.textContent = t("acct_working");
  try {
    await Cloud.authenticate(mode, $("#acct-user").value, $("#acct-pass").value);
  } catch (err) {
    accountBusy = false;
    status.textContent = t({
      bad_input: "acct_err_short", no_such_account: "acct_err_no_such",
      wrong_password: "acct_err_wrong", name_taken: "acct_err_taken",
    }[err.code] || "acct_err_net");
    return;
  }
  $("#acct-pass").value = "";
  await adoptAccountProgress();
  accountBusy = false;
  closeAccount();
  showToast(t("toast_signed_in") + ": " + Cloud.getName());
}

// Right after signing in: decide between this device's progress and the
// account's save. More turns played wins; if both hold real progress and the
// account's would replace this device's, the player is asked.
async function adoptAccountProgress() {
  const E = window.Engine;
  const t = window.I18N.t;
  const lang = window.I18N.getUiLang();
  const local = readLocalSave();
  const cloudRaw = await Cloud.fetchSave();
  const cloud = cloudRaw ? E.loadSanitizedState(cloudRaw, lang) : null;
  const dev = local ? E.loadSanitizedState(local, lang) : null;
  const meaningful = (st) => st && (st.turns > 0 || st.xp > 0);

  let useCloud = false;
  if (cloud && !meaningful(dev)) useCloud = true;
  else if (cloud && meaningful(dev) && cloud.turns !== dev.turns) {
    useCloud = window.confirm(t("acct_choose_save").replace("{dev}", dev.xp).replace("{cloud}", cloud.xp));
  }

  if (useCloud) {
    startGame(lang, cloud);
  } else if (inGame) {
    persist(); // this device's progress now belongs to the account
    syncDirty = true;
    flushSync();
    renderDashboard();
  } else if (meaningful(dev)) {
    syncDirty = true;
    startGame(lang);
    flushSync();
  } else {
    startGame(lang);
  }
}

async function signOut() {
  const t = window.I18N.t;
  if (!window.confirm(t("acct_logout_confirm"))) return;
  if (inGame && !gameOver) {
    persist();
    syncDirty = true;
    await flushSync();
  }
  Cloud.logout();
  clearSave();
  location.reload();
}

$("#account-btn").addEventListener("click", openAccount);
$("#acct-close").addEventListener("click", closeAccount);
$("#account-form").addEventListener("submit", (e) => { e.preventDefault(); submitAccount("login"); });
$("#acct-register").addEventListener("click", () => submitAccount("register"));
$("#acct-logout").addEventListener("click", signOut);

// ---------------------------------------------------------------------------
// leaderboard + automatic upload. Purely an add-on: the game and its saves
// are local, so if the server is ever unreachable nothing else changes.
// Throttled on purpose (the free server tier allows ~1000 writes a day):
// a burst of commands becomes one upload, plus a last push when the tab is
// hidden or closed.
// ---------------------------------------------------------------------------

const SYNC_FIRST_DELAY_MS = 20000;
const SYNC_MIN_GAP_MS = 180000;
let syncTimer = null;
let syncDirty = false;
let lastSyncAt = 0;

function markSyncDirty() {
  if (!inGame) return;
  syncDirty = true;
  if (syncTimer) return;
  const wait = Math.max(SYNC_FIRST_DELAY_MS, lastSyncAt + SYNC_MIN_GAP_MS - Date.now());
  syncTimer = setTimeout(() => { syncTimer = null; runAutoSync(); }, wait);
}

async function runAutoSync({ keepalive = false } = {}) {
  if (!syncDirty) return;
  syncDirty = false;
  try {
    await Cloud.saveToCloud(window.Engine.getState(), { keepalive });
    lastSyncAt = Date.now();
  } catch (err) {
    if (err && err.status === 409) {
      // Someone registered the name this guest was using. Fall back to the default.
      Cloud.setName("");
      showToast(window.I18N.t("toast_name_taken"), "warn");
      syncDirty = true;
      if (!keepalive) { lastSyncAt = Date.now(); markSyncDirty(); }
      return;
    }
    if (err && err.status === 400) {
      console.warn("leaderboard upload was rejected as malformed", err); // our bug: don't hammer the server
      return;
    }
    syncDirty = true; // network hiccup, rate limit...: try again after a full gap
    if (!keepalive) { lastSyncAt = Date.now(); markSyncDirty(); }
  }
}

async function flushSync() {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  await runAutoSync();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  runAutoSync({ keepalive: true });
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function renderLeaderboard() {
  const t = window.I18N.t;
  const tbody = document.querySelector("#leaderboard-table tbody");
  tbody.innerHTML = `<tr><td colspan='5'>${escapeHtml(t("lb_loading"))}</td></tr>`;
  try {
    const rows = await Cloud.fetchLeaderboard();
    const E = window.Engine;
    tbody.innerHTML = "";
    rows.forEach((r, i) => {
      const rankName = E.rankName(E.rankIndex(r.xp || 0));
      const tr = document.createElement("tr");
      if ((r.name || "").toLowerCase() === Cloud.getName().toLowerCase()) tr.className = "me";
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(r.name || "?")}</td><td>${escapeHtml(rankName)}</td><td>${r.xp ?? 0}</td><td>${r.findings ?? 0}</td>`;
      tbody.appendChild(tr);
    });
    if (!rows.length) tbody.innerHTML = `<tr><td colspan='5'>${escapeHtml(t("lb_empty"))}</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan='5'>${escapeHtml(t("lb_error"))}${escapeHtml(err.message)}</td></tr>`;
  }
}

function openLeaderboard() {
  $("#lb-name").value = Cloud.getName();
  $("#lb-name").disabled = Cloud.isAccount();
  $("#lb-save-name").disabled = Cloud.isAccount();
  $("#leaderboard-modal").classList.remove("hidden");
  renderLeaderboard();
}

function closeLeaderboard() {
  $("#leaderboard-modal").classList.add("hidden");
  const input = $("#cmd-input");
  if (input && !input.disabled) input.focus();
}

$("#leaderboard-btn").addEventListener("click", openLeaderboard);
$("#lb-close").addEventListener("click", closeLeaderboard);
$("#lb-save-name").addEventListener("click", async () => {
  Cloud.setName($("#lb-name").value);
  $("#lb-name").value = Cloud.getName();
  syncDirty = true;
  await flushSync();
  renderLeaderboard();
});

wireLangSwitch();
boot();
