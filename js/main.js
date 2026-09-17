import * as Auth from "./auth.js";

const $ = (sel) => document.querySelector(sel);
const screens = {
  boot: $("#boot-screen"), auth: $("#auth-screen"), game: $("#game-screen"),
};

function showScreen(name) {
  for (const s of Object.values(screens)) s.classList.add("hidden");
  screens[name].classList.remove("hidden");
}

const LOCAL_SAVE_KEY = "sessiz-arsiv-save-v1";

let currentUser = null;   // Firebase user, or null for local/guest play
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
  window.I18N.setUiLang(window.I18N.getUiLang()); // paint + mark active button
  document.querySelectorAll(".lang-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.lang;
      window.I18N.setUiLang(code);
      updateTopbarText();
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
  });
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

  // If Firebase is already configured and a session exists, skip the auth
  // screen and resume directly.
  let unsub;
  unsub = Auth.watchAuth((user) => {
    if (unsub) unsub();
    if (user) {
      currentUser = user;
      startGame(window.I18N.getUiLang());
    } else {
      showScreen("auth");
      wireAuthScreen();
    }
  });
}

// ---------------------------------------------------------------------------
// auth screen
// ---------------------------------------------------------------------------

function wireAuthScreen() {
  // wireAuthScreen() can run more than once per page load (e.g. quit then
  // log back in without a full reload) — clone-and-replace first so old
  // listeners don't stack up and double-submit.
  const tabs = [...document.querySelectorAll("#auth-tabs .tab")].map((tab) => {
    const clone = tab.cloneNode(true);
    tab.replaceWith(clone);
    return clone;
  });
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $("#login-form").classList.toggle("hidden", tab.dataset.tab !== "login");
      $("#register-form").classList.toggle("hidden", tab.dataset.tab !== "register");
    });
  });

  freshEl("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-err").textContent = "";
    try {
      currentUser = await Auth.loginWithEmail($("#login-email").value, $("#login-password").value);
      startGame(window.I18N.getUiLang());
    } catch (err) {
      $("#login-err").textContent = friendlyAuthError(err);
    }
  });

  freshEl("#register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#register-err").textContent = "";
    try {
      currentUser = await Auth.registerWithEmail(
        $("#register-name").value.trim() || window.I18N.t("operator_label"),
        $("#register-email").value,
        $("#register-password").value,
      );
      startGame(window.I18N.getUiLang());
    } catch (err) {
      $("#register-err").textContent = friendlyAuthError(err);
    }
  });

  freshEl("#google-btn").addEventListener("click", async () => {
    try {
      currentUser = await Auth.loginWithGoogle();
      startGame(window.I18N.getUiLang());
    } catch (err) {
      $("#login-err").textContent = friendlyAuthError(err);
    }
  });

  freshEl("#guest-btn").addEventListener("click", () => {
    currentUser = null; // pure local/guest mode, no Firebase involved
    startGame(window.I18N.getUiLang());
  });
}

function friendlyAuthError(err) {
  const msg = String((err && err.message) || err);
  const t = window.I18N.t;
  if (msg.includes("Firebase henüz") || msg.includes("not configured")) return t("err_not_configured");
  if (msg.includes("auth/email-already-in-use")) return t("err_email_in_use");
  if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) return t("err_wrong_credentials");
  if (msg.includes("auth/weak-password")) return t("err_weak_password");
  if (msg.includes("auth/user-not-found")) return t("err_user_not_found");
  return msg;
}

// ---------------------------------------------------------------------------
// game
// ---------------------------------------------------------------------------

async function startGame(langCode) {
  gameOver = false;
  const E = window.Engine;
  if (!E.LANGS[langCode]) langCode = E.BASE_LANG;

  let state = null;
  if (currentUser && Auth.isConfigured()) {
    try {
      const cloud = await Auth.loadSave(currentUser.uid);
      if (cloud) state = E.loadSanitizedState(cloud, langCode);
    } catch (err) {
      console.warn("cloud load failed, falling back to local", err);
    }
  }
  if (!state) {
    const local = readLocalSave();
    if (local) state = E.loadSanitizedState(local, langCode);
  }
  if (!state) state = E.newState(langCode);
  state.lang = langCode;
  E.setState(state);

  inGame = true;
  crossPicks = [];
  showScreen("game");
  $("#terminal").innerHTML = "";
  updateTopbarText();

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

function updateTopbarText() {
  if (!inGame) return;
  $("#topbar-user").textContent = currentUser
    ? `${window.I18N.t("operator_label")}: ${Auth.displayNameFor(currentUser)}`
    : window.I18N.t("guest_mode");
}

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
  for (const l of introLines) {
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
  $("#terminal").appendChild(div);
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
    const interval = speedHint || 12;
    const chunk = text.length <= 90 ? 1 : Math.max(1, Math.round(text.length / 150));
    let i = 0;
    function step() {
      if (skipRequested) { div.textContent = text; scrollDown(); resolve(); return; }
      i = Math.min(text.length, i + chunk);
      div.textContent = text.slice(0, i);
      scrollDown();
      if (i >= text.length) { resolve(); return; }
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
    await printLines(res.lines);
    playCueFor(before, E.getState());
    if (res.ended) handleEnding(res.ended);
    updatePromptTag();
    refreshSidebar();
    persist();
    return;
  }
  if (awaitingReportChoice) {
    const fn = awaitingReportChoice;
    awaitingReportChoice = null;
    const res = fn(raw.trim());
    await printLines(res.lines);
    if (res.ended) handleEnding(res.ended);
    updatePromptTag();
    refreshSidebar();
    persist();
    return;
  }

  const folded = E.fold(raw.trim());
  if (folded === "leaderboard" || folded === "liderlik" || folded === "lider") {
    openLeaderboard();
    return;
  }

  const before = snapshot(E.getState());
  const result = E.runCommand(raw);
  if (!result) return;

  if (result.hostVerb === "save") {
    await persist(true);
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
    await persist(true);
    gameOver = true;
    inGame = false;
    $("#cmd-input").disabled = true;
    setTimeout(() => { showScreen("auth"); wireAuthScreen(); }, 900);
    return;
  }

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
  persist();
}

function handleEnding(ended) {
  gameOver = true;
  $("#cmd-input").disabled = true;
  window.SFX.ending();
  clearSave();
  printLine("");
  printLine(window.I18N.t("session_ended_1"), "dim amber");
  printLine(window.I18N.t("session_ended_2"), "dim amber");
}

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
  if (currentUser && Auth.isConfigured()) {
    Auth.writeSave(currentUser.uid, window.Engine.newState(window.Engine.getState().lang)).catch(() => {});
  }
}

let saveTimer = null;
async function persist(immediate = false) {
  const E = window.Engine;
  const state = E.getState();
  writeLocalSave(state);
  if (!currentUser || !Auth.isConfigured()) return;

  const doWrite = async () => {
    try {
      await Auth.writeSave(currentUser.uid, state);
      const idx = E.rankIndex(state.xp);
      await Auth.updateLeaderboardEntry(currentUser.uid, Auth.displayNameFor(currentUser), {
        xp: state.xp,
        rank: E.rankName(idx),
        findings: state.findings.length,
        clearance: state.clearance,
      });
    } catch (err) {
      console.warn("cloud save failed", err);
    }
  };
  if (immediate) { await doWrite(); return; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doWrite, 800);
}

async function reloadSave() {
  const E = window.Engine;
  let data = null;
  if (currentUser && Auth.isConfigured()) {
    try { data = await Auth.loadSave(currentUser.uid); } catch { /* fall through */ }
  }
  if (!data) data = readLocalSave();
  if (!data) return;
  E.setState(E.loadSanitizedState(data, E.getState().lang));
}

// ---------------------------------------------------------------------------
// leaderboard modal + topbar
// ---------------------------------------------------------------------------

async function openLeaderboard() {
  const t = window.I18N.t;
  const modal = $("#leaderboard-modal");
  modal.classList.remove("hidden");
  const tbody = document.querySelector("#leaderboard-table tbody");
  tbody.innerHTML = `<tr><td colspan='5'>${escapeHtml(t("lb_loading"))}</td></tr>`;
  if (!Auth.isConfigured()) {
    tbody.innerHTML = `<tr><td colspan='5'>${escapeHtml(t("lb_not_configured"))}</td></tr>`;
    return;
  }
  try {
    const rows = await Auth.fetchLeaderboard(50);
    tbody.innerHTML = "";
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(r.displayName || "?")}</td><td>${escapeHtml(r.rank || "")}</td><td>${r.xp ?? 0}</td><td>${r.findings ?? 0}</td>`;
      tbody.appendChild(tr);
    });
    if (!rows.length) tbody.innerHTML = `<tr><td colspan='5'>${escapeHtml(t("lb_empty"))}</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan='5'>${escapeHtml(t("lb_error"))}${escapeHtml(err.message)}</td></tr>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("#leaderboard-close").addEventListener("click", () => $("#leaderboard-modal").classList.add("hidden"));
$("#leaderboard-btn").addEventListener("click", openLeaderboard);
$("#logout-btn").addEventListener("click", async () => {
  await persist(true);
  if (currentUser && Auth.isConfigured()) { try { await Auth.logout(); } catch { /* ignore */ } }
  currentUser = null;
  location.reload();
});

wireLangSwitch();
boot();
