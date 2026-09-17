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
  const tabs = document.querySelectorAll("#auth-tabs .tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      $("#login-form").classList.toggle("hidden", tab.dataset.tab !== "login");
      $("#register-form").classList.toggle("hidden", tab.dataset.tab !== "register");
    });
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-err").textContent = "";
    try {
      currentUser = await Auth.loginWithEmail($("#login-email").value, $("#login-password").value);
      startGame(window.I18N.getUiLang());
    } catch (err) {
      $("#login-err").textContent = friendlyAuthError(err);
    }
  });

  $("#register-form").addEventListener("submit", async (e) => {
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

  $("#google-btn").addEventListener("click", async () => {
    try {
      currentUser = await Auth.loginWithGoogle();
      startGame(window.I18N.getUiLang());
    } catch (err) {
      $("#login-err").textContent = friendlyAuthError(err);
    }
  });

  $("#guest-btn").addEventListener("click", () => {
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
  showScreen("game");
  $("#terminal").innerHTML = "";
  updateTopbarText();

  printIntro();
  updatePromptTag();
  wireInput();
  $("#cmd-input").focus();

  maybeShowTutorial();
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
    }
  });
  fresh.disabled = false;
}

async function handleLine(raw) {
  if (gameOver) return;
  const E = window.Engine;
  printLine("");

  if (awaitingConfirm) {
    const fn = awaitingConfirm;
    awaitingConfirm = null;
    const res = fn(E.isYes(raw));
    await printLines(res.lines);
    if (res.ended) handleEnding(res.ended);
    updatePromptTag();
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
    persist();
    return;
  }

  const folded = E.fold(raw.trim());
  if (folded === "leaderboard" || folded === "liderlik" || folded === "lider") {
    openLeaderboard();
    return;
  }

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

  if (result.pendingConfirm) awaitingConfirm = result.pendingConfirm;
  if (result.pendingReportChoice) awaitingReportChoice = result.pendingReportChoice;

  if (result.ended) handleEnding(result.ended);

  updatePromptTag();
  persist();
}

function handleEnding(ended) {
  gameOver = true;
  $("#cmd-input").disabled = true;
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
