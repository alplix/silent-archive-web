// ---------------------------------------------------------------------------
// Leaderboard client. The server is worker/src/index.js (a small Cloudflare
// Worker + KV store). This is an add-on only: the game and its saves live in
// the browser, so if the server is ever unreachable, retired or full, nothing
// but the leaderboard is affected.
//
// Identity, two flavours (both send a 128-bit key as a Bearer token; the server
// stores only its SHA-256):
//  * guest  - the browser makes a random key on first use. Nothing to do; the
//    name shown on the board defaults to "Auditor-XXXX" and can be changed.
//  * account - the key is derived from username + password with PBKDF2, so the
//    password never leaves the device and the same credentials give the same
//    key on any device. There is no password recovery (no e-mail is involved).
// ---------------------------------------------------------------------------

const API_BASE = "https://silent-archive-api.alplix.workers.dev";

const KEY_KEY = "silent-archive-player-key";
const NAME_KEY = "silent-archive-player-name";
const ACCOUNT_KEY = "silent-archive-account";
const KEY_RE = /^[0-9a-f]{32}$/;

function readAccount() {
  try {
    const a = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null");
    return a && typeof a.name === "string" && KEY_RE.test(a.key) ? a : null;
  } catch { return null; }
}

export function isAccount() { return !!readAccount(); }
export function accountName() { const a = readAccount(); return a ? a.name : null; }

function getKey() {
  const acct = readAccount();
  if (acct) return acct.key;
  let key = null;
  try { key = localStorage.getItem(KEY_KEY); } catch { /* ignore */ }
  if (key && KEY_RE.test(key)) return key;
  key = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  try { localStorage.setItem(KEY_KEY, key); } catch { /* ignore */ }
  return key;
}

export function cleanName(text) {
  return String(text || "").replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim().slice(0, 24) || null;
}

export function getName() {
  const acct = readAccount();
  if (acct) return acct.name;
  let name = null;
  try { name = localStorage.getItem(NAME_KEY); } catch { /* ignore */ }
  return name || "Auditor-" + getKey().slice(0, 4).toUpperCase();
}

export function setName(text) {
  if (isAccount()) return; // an account's name is fixed: it is the login
  const name = cleanName(text);
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch { /* ignore */ }
}

function httpError(res) {
  const e = new Error("HTTP " + res.status);
  e.status = res.status;
  return e;
}

// Uploads the current progress. Throws an Error with `.status` on HTTP
// failures (429 means "too soon", the caller just tries again later).
export async function saveToCloud(state, { keepalive = false } = {}) {
  const res = await fetch(API_BASE + "/api/save", {
    method: "PUT",
    headers: { Authorization: "Bearer " + getKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: getName(), state }),
    keepalive,
  });
  if (!res.ok) throw httpError(res);
}

export async function fetchLeaderboard() {
  const res = await fetch(API_BASE + "/api/leaderboard");
  if (!res.ok) throw httpError(res);
  const data = await res.json();
  return Array.isArray(data.rows) ? data.rows : [];
}

// --- accounts ---------------------------------------------------------------

const PBKDF2_ROUNDS = 200000;

// Same rule as the server's claim key, so "Alp" and "ALP" derive the same key.
function normName(name) {
  return name.normalize("NFKC").toLowerCase();
}

async function deriveKey(name, password) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ROUNDS, salt: new TextEncoder().encode("silent-archive:" + normName(name)) },
    base, 128);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// mode: "login" | "register". Resolves with the account name; rejects with an
// Error whose .code is one of: bad_input, no_such_account, wrong_password,
// name_taken, network.
export async function authenticate(mode, rawName, password) {
  const name = cleanName(rawName);
  const fail = (code) => Object.assign(new Error(code), { code });
  if (!name || name.length < 3 || String(password).length < 6) throw fail("bad_input");
  const key = await deriveKey(name, String(password));
  let res;
  try {
    res = await fetch(API_BASE + "/api/account", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mode }),
    });
  } catch { throw fail("network"); }
  if (res.ok) {
    const data = await res.json();
    const finalName = cleanName(data.name) || name;
    try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ name: finalName, key })); } catch { /* ignore */ }
    return finalName;
  }
  let code = "network";
  try { code = (await res.json()).error || code; } catch { /* ignore */ }
  throw fail(["no_such_account", "wrong_password", "name_taken"].includes(code) ? code : "network");
}

// Leaves the account; the guest identity (if any) is untouched.
export function logout() {
  try { localStorage.removeItem(ACCOUNT_KEY); } catch { /* ignore */ }
}

// The account's stored save, or null if there is none (or the server is down).
export async function fetchSave() {
  try {
    const res = await fetch(API_BASE + "/api/save", { headers: { Authorization: "Bearer " + getKey() } });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.state ? data.state : null;
  } catch { return null; }
}
