// ---------------------------------------------------------------------------
// "Accounts" + cloud save + leaderboard, backed entirely by GitHub itself —
// no Firebase, no third-party service, no secret embedded in this file.
//
// How it works:
// - Identity is just a GitHub username the player types in (stored locally,
//   used only to know which save file to read). It is NOT verified on read.
// - Writing (syncing progress / posting to the leaderboard) opens a
//   pre-filled "new issue" page on GitHub for the player to submit
//   themselves, while logged into their own GitHub account. A repo
//   workflow (.github/workflows/sync-save.yml) reacts to that issue and
//   commits the save/leaderboard files. Crucially, the workflow trusts
//   the issue's REAL author (`issue.user.login`, set by GitHub itself) as
//   the identity for the write — never anything the client claims — so a
//   player can only ever overwrite their own save/leaderboard entry.
// - Reading (resuming a save, loading the leaderboard) is a plain GET of a
//   public JSON file from raw.githubusercontent.com. No auth needed.
//
// Trade-offs, on purpose, given the constraint of "everything on GitHub,
// nothing else": this is not real authentication (anyone can type any
// username and see that public save/leaderboard entry), syncing is a
// manual, explicit action rather than continuous, and there is a short
// delay (the workflow run) between submitting and the sync being visible.
// ---------------------------------------------------------------------------

const OWNER = "alplix";
const REPO = "silent-archive-web";
const BRANCH = "main";
const SYNC_LABEL = "sync";
const USERNAME_KEY = "silent-archive-github-user";

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}?t=${Date.now()}`;
}

export function isConfigured() {
  return true; // nothing to configure — this always works on GitHub Pages
}

export function isValidUsername(name) {
  return typeof name === "string" && USERNAME_RE.test(name);
}

export function getUsername() {
  try { return localStorage.getItem(USERNAME_KEY); } catch { return null; }
}

export function setUsername(name) {
  try {
    if (name) localStorage.setItem(USERNAME_KEY, name);
    else localStorage.removeItem(USERNAME_KEY);
  } catch { /* ignore */ }
}

// Mirrors the old Firebase-based watchAuth(cb) shape so main.js's boot()
// logic barely has to change: calls back once with a user-ish object
// ({ username }) or null, and returns an unsubscribe function (a no-op
// here, since there is no live session to watch).
export function watchAuth(cb) {
  const name = getUsername();
  cb(name ? { username: name } : null);
  return () => {};
}

export function loginWithUsername(name) {
  const trimmed = (name || "").trim();
  if (!isValidUsername(trimmed)) {
    throw new Error("err_bad_username");
  }
  setUsername(trimmed);
  return { username: trimmed };
}

export async function logout() {
  setUsername(null);
}

export function displayNameFor(user) {
  return (user && user.username) || "Auditor";
}

// ---- save / resume (read-only from the client's side) ----

export async function loadSave(username) {
  if (!isValidUsername(username)) return null;
  try {
    const res = await fetch(rawUrl(`data/saves/${username.toLowerCase()}.json`), { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- leaderboard (read-only from the client's side) ----

export async function fetchLeaderboard(topN = 50) {
  const res = await fetch(rawUrl("data/leaderboard.json"), { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return []; // no one has synced yet
    throw new Error("HTTP " + res.status);
  }
  const data = await res.json();
  const rows = Array.isArray(data) ? data : Object.values(data || {});
  rows.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  return rows.slice(0, topN);
}

// ---- the actual write path: open a pre-filled GitHub issue ----
// The player reviews and submits it themselves, authenticated as whoever
// they're logged in as on github.com — that's what makes the write safe
// without any token living in this file.

export function buildSyncUrl(state) {
  const payload = {
    lang: state.lang, day: state.day, clearance: state.clearance,
    contam: state.contam, xp: state.xp, rank_seen: state.rank_seen,
    read: state.read, findings: state.findings, amnestics: state.amnestics,
    fast: state.fast,
  };
  const body =
    "Opened automatically by The Silent Archive's \"Sync to GitHub\" button. " +
    "Do not edit the block below — a workflow reads it verbatim.\n\n" +
    "```json\n" + JSON.stringify(payload, null, 1) + "\n```\n";
  const params = new URLSearchParams({
    title: "sync: progress update",
    body,
    labels: SYNC_LABEL,
  });
  return `https://github.com/${OWNER}/${REPO}/issues/new?${params.toString()}`;
}

export function submitSync(state) {
  window.open(buildSyncUrl(state), "_blank", "noopener");
}
