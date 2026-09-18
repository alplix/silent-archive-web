// ---------------------------------------------------------------------------
// "Accounts" + cloud save + leaderboard, backed entirely by GitHub itself —
// no Firebase, no third-party service, no secret embedded in this file.
//
// Reading (resuming a save, loading the leaderboard) is a plain GET of a
// public JSON file from the `player-data` branch via raw.githubusercontent
// — no auth needed. That branch is written only by a workflow on `main`
// (.github/workflows/sync-save.yml), never by this page directly.
//
// Writing goes through GitHub issues, and there are two ways in:
//
// 1. Auto-save (recommended): the player pastes their own fine-grained
//    personal access token once (Issues: read/write on this one repo). From
//    then on the page keeps ONE issue per player titled "sync: auto" up to
//    date through api.github.com (which allows browser CORS requests), and
//    the workflow turns edits into commits. The token stays in this
//    browser's localStorage only.
// 2. Manual: open a pre-filled "new issue" page for the player to submit
//    themselves from their logged-in GitHub session (no token needed).
//
// Either way the workflow trusts the issue's REAL author
// (`issue.user.login`, set by GitHub) as the identity for the write — never
// anything the page claims — so a player can only overwrite their own save
// and leaderboard entry.
//
// Honest trade-offs of "everything on GitHub, nothing else": the typed
// username is not verified on READ (all data is public anyway); GitHub
// won't let anonymous pages write, so auto-save needs the player's own
// token; and a fine-grained token only reaches repos its owner can write to
// (the repo owner / collaborators). Everyone else can still use manual sync.
// ---------------------------------------------------------------------------

const OWNER = "alplix";
const REPO = "silent-archive-web";
const DATA_BRANCH = "player-data";
const AUTO_TITLE = "sync: auto";
const MANUAL_TITLE = "sync: manual";
const USERNAME_KEY = "silent-archive-github-user";
const TOKEN_KEY = "silent-archive-github-token";
const ISSUE_KEY = "silent-archive-sync-issue";

export const REPO_SLUG = `${OWNER}/${REPO}`;

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${DATA_BRANCH}/${path}?t=${Date.now()}`;
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

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function hasToken() {
  return !!getToken();
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
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

// ---- save / resume (read-only, from the public player-data branch) ----

export async function loadSave(username) {
  if (!isValidUsername(username)) return null;
  try {
    const res = await fetch(rawUrl(`saves/${username.toLowerCase()}.json`), { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- leaderboard (read-only, from the public player-data branch) ----

export async function fetchLeaderboard(topN = 50) {
  const res = await fetch(rawUrl("leaderboard.json"), { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return []; // no one has synced yet
    throw new Error("HTTP " + res.status);
  }
  const data = await res.json();
  const rows = Array.isArray(data) ? data : Object.values(data || {});
  rows.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  return rows.slice(0, topN);
}

// ---- what gets written ----

function syncPayload(state) {
  return {
    lang: state.lang, day: state.day, clearance: state.clearance,
    contam: state.contam, xp: state.xp, rank_seen: state.rank_seen,
    read: state.read, findings: state.findings, amnestics: state.amnestics,
    fast: state.fast,
  };
}

function syncBody(state) {
  return (
    "Written automatically by The Silent Archive. " +
    "Do not edit the block below - a workflow reads it verbatim.\n\n" +
    "```json\n" + JSON.stringify(syncPayload(state), null, 1) + "\n```\n"
  );
}

// ---- manual write path: open a pre-filled GitHub issue ----
// The player reviews and submits it themselves, authenticated as whoever
// they're logged in as on github.com — no token needed.

export function buildSyncUrl(state) {
  const params = new URLSearchParams({ title: MANUAL_TITLE, body: syncBody(state) });
  return `https://github.com/${OWNER}/${REPO}/issues/new?${params.toString()}`;
}

export function submitSync(state) {
  window.open(buildSyncUrl(state), "_blank", "noopener");
}

// ---- automatic write path: the player's own token + the GitHub API ----

async function api(path, method, token, body, keepalive) {
  return fetch("https://api.github.com" + path, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: "Bearer " + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    keepalive: !!(keepalive && body),
  });
}

function apiError(res) {
  const e = new Error("HTTP " + res.status);
  e.status = res.status;
  return e;
}

function issueKeyFor(username) {
  return ISSUE_KEY + ":" + String(username || "").toLowerCase();
}

function getIssueNumber(username) {
  try { return Number(localStorage.getItem(issueKeyFor(username))) || null; } catch { return null; }
}

function setIssueNumber(username, num) {
  try {
    if (num) localStorage.setItem(issueKeyFor(username), String(num));
    else localStorage.removeItem(issueKeyFor(username));
  } catch { /* ignore */ }
}

// The token's owner — this is the VERIFIED identity (unlike the typed
// username). Returns null if it can't be determined.
export async function whoami() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await api("/user", "GET", token);
    if (!res.ok) return null;
    const me = await res.json();
    return isValidUsername(me.login) ? me.login : null;
  } catch {
    return null;
  }
}

// Brings the player's single "sync: auto" issue up to date (creating it the
// first time, or re-finding it from another browser). Throws an Error with
// `.status` set to the HTTP status on API failures (401/403/404 = the token
// is missing, expired, or lacks access to this repo).
export async function autoSync(state, username, { keepalive = false } = {}) {
  const token = getToken();
  if (!token) { const e = new Error("no token"); e.status = 401; throw e; }

  const body = syncBody(state);
  const issues = `/repos/${OWNER}/${REPO}/issues`;

  const patch = async (num) => {
    const res = await api(`${issues}/${num}`, "PATCH", token, { title: AUTO_TITLE, body, state: "open" }, keepalive);
    if (res.ok) return true;
    if (res.status === 404 || res.status === 410) return false; // deleted/transferred
    throw apiError(res);
  };

  let num = getIssueNumber(username);
  if (num && (await patch(num))) return;
  num = null;
  setIssueNumber(username, null);

  if (isValidUsername(username)) {
    const res = await api(`${issues}?creator=${encodeURIComponent(username)}&state=all&per_page=30`, "GET", token);
    if (res.ok) {
      const list = await res.json();
      const found = list.find((i) => !i.pull_request && i.title === AUTO_TITLE);
      if (found) num = found.number;
    } else if (res.status === 401 || res.status === 403) {
      throw apiError(res);
    }
    if (num && (await patch(num))) { setIssueNumber(username, num); return; }
  }

  const res = await api(issues, "POST", token, { title: AUTO_TITLE, body });
  if (!res.ok) throw apiError(res);
  const created = await res.json();
  setIssueNumber(username, created.number);
}
