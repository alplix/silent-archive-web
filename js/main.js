import * as Auth from "./auth.js";

const $ = (sel) => document.querySelector(sel);
const screens = {
  boot: $("#boot-screen"), auth: $("#auth-screen"), lang: $("#lang-screen"), game: $("#game-screen"),
};

function showScreen(name) {
  for (const s of Object.values(screens)) s.classList.add("hidden");
  screens[name].classList.remove("hidden");
}

const LOCAL_SAVE_KEY = "sessiz-arsiv-save-v1";

let currentUser = null;   // Firebase user, or null for local/guest play
let awaitingConfirm = null;
let awaitingReportChoice = null;
let gameOver = false;
const history = [];
let historyIdx = -1;

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

async function boot() {
  try {
    await window.Engine.boot("data");
  } catch (err) {
    document.querySelector("#boot-screen p").textContent =
      "Veri yüklenemedi / Failed to load game data: " + err.message;
    return;
  }

  // If Firebase is already configured and a session exists, skip the auth
  // screen and resume directly.
  let unsub;
  unsub = Auth.watchAuth((user) => {
    if (unsub) unsub();
    if (user) {
      currentUser = user;
      showScreen("lang");
      buildLangButtons();
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
      showScreen("lang");
      buildLangButtons();
    } catch (err) {
      $("#login-err").textContent = friendlyAuthError(err);
    }
  });

  $("#register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#register-err").textContent = "";
    try {
      currentUser = await Auth.registerWithEmail(
        $("#register-name").value.trim() || "Denetçi",
        $("#register-email").value,
        $("#register-password").value,
      );
      showScreen("lang");
      buildLangButtons();
    } catch (err) {
      $("#register-err").textContent = friendlyAuthError(err);
    }
  });

  $("#google-btn").addEventListener("click", async () => {
    try {
      currentUser = await Auth.loginWithGoogle();
      showScreen("lang");
      buildLangButtons();
    } catch (err) {
      $("#login-err").textContent = friendlyAuthError(err);
    }
  });

  $("#guest-btn").addEventListener("click", () => {
    currentUser = null; // pure local/guest mode, no Firebase involved
    showScreen("lang");
    buildLangButtons();
  });
}

function friendlyAuthError(err) {
  const msg = String(err && err.message || err);
  if (msg.includes("Firebase henüz") || msg.includes("not configured")) return msg;
  if (msg.includes("auth/email-already-in-use")) return "Bu e-posta zaten kayıtlı / Email already registered.";
  if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) return "Hatalı e-posta veya şifre / Wrong email or password.";
  if (msg.includes("auth/weak-password")) return "Şifre en az 6 karakter olmalı / Password must be at least 6 characters.";
  if (msg.includes("auth/user-not-found")) return "Hesap bulunamadı / Account not found.";
  return msg;
}

// ---------------------------------------------------------------------------
// language screen
// ---------------------------------------------------------------------------

function buildLangButtons() {
  const box = $("#lang-buttons");
  box.innerHTML = "";
  const langs = window.Engine.LANGS;
  for (const code of Object.keys(langs).sort()) {
    const meta = langs[code].meta || {};
    const btn = document.createElement("button");
    btn.textContent = `${code.toUpperCase()} — ${meta.name || code}`;
    btn.addEventListener("click", () => startGame(code));
    box.appendChild(btn);
  }
}

// ---------------------------------------------------------------------------
// game
// ---------------------------------------------------------------------------

async function startGame(langCode) {
  gameOver = false;
  const E = window.Engine;

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

  showScreen("game");
  $("#terminal").innerHTML = "";
  $("#topbar-user").textContent = currentUser
    ? `Denetçi: ${Auth.displayNameFor(currentUser)}`
    : "Misafir modu / Guest mode (kaydedilir yalnızca bu tarayıcıda)";

  printIntro();
  updatePromptTag();
  wireInput();
  $("#cmd-input").focus();
}

function printIntro() {
  const E = window.Engine;
  const logo = document.createElement("pre");
  logo.className = "line darkgreen";
  logo.textContent = "   ___  ___ _ ___  _  _ ___ _____\n  / __|/ __(_) _ \\| \\| | __|_   _|\n  \\__ \\ (__| |  _/| .` | _|  | |\n  |___/\\___|_|_|  |_|\\_|___| |_|";
  $("#terminal").appendChild(logo);
  printLine("  " + E.T("ui", "banner_sub"), "dim darkgreen");
  printLine("=".repeat(72), "darkgreen");
  printLine("");
  const introLines = E.T("intro", { default: [] });
  for (const l of introLines) printLine(l, "green");
  printLine("");
  printLine("=".repeat(72), "darkgreen");
  printLine("  " + E.T("acts", "1", "title"), "bold cyan");
  printLine(E.T("acts", "1", "blurb", { default: "" }), "green");
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

function printLines(lines) {
  for (const l of lines) printLine(l.text, l.cls);
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
    printLines(res.lines);
    if (res.ended) handleEnding(res.ended);
    updatePromptTag();
    persist();
    return;
  }
  if (awaitingReportChoice) {
    const fn = awaitingReportChoice;
    awaitingReportChoice = null;
    const res = fn(raw.trim());
    printLines(res.lines);
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
    $("#cmd-input").disabled = true;
    setTimeout(() => { showScreen("lang"); }, 900);
    return;
  }

  if (result.clearScreen) {
    $("#terminal").innerHTML = "";
    printIntro();
  }

  printLines(result.lines);

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
  printLine(">> oturum sona erdi — yeniden başlamak için sayfayı yenileyin", "dim amber");
  printLine(">> session ended — refresh the page to start a new run", "dim amber");
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
  const modal = $("#leaderboard-modal");
  modal.classList.remove("hidden");
  const tbody = document.querySelector("#leaderboard-table tbody");
  tbody.innerHTML = "<tr><td colspan='5'>...</td></tr>";
  if (!Auth.isConfigured()) {
    tbody.innerHTML = "<tr><td colspan='5'>Firebase yapılandırılmadı / Firebase not configured — leaderboard needs the site owner to set up js/firebase-config.js.</td></tr>";
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
    if (!rows.length) tbody.innerHTML = "<tr><td colspan='5'>Henüz kimse yok / Nobody yet.</td></tr>";
  } catch (err) {
    tbody.innerHTML = "<tr><td colspan='5'>Yüklenemedi / Failed to load: " + escapeHtml(err.message) + "</td></tr>";
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

boot();
