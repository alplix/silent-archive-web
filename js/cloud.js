// ---------------------------------------------------------------------------
// Leaderboard client. The server is worker/src/index.js (a small Cloudflare
// Worker + KV store). This is an add-on only: the game and its saves live in
// the browser, so if the server is ever unreachable, retired or full, nothing
// but the leaderboard is affected.
//
// Identity: the browser makes a random 128-bit key on first use and sends it
// as a Bearer token; the server stores only its SHA-256. There is no login and
// nothing for the player to do. The name shown on the board defaults to
// "Auditor-XXXX" and can be changed from the leaderboard dialog.
// ---------------------------------------------------------------------------

const API_BASE = "https://silent-archive-api.alplix.workers.dev";

const KEY_KEY = "silent-archive-player-key";
const NAME_KEY = "silent-archive-player-name";
const KEY_RE = /^[0-9a-f]{32}$/;

function getKey() {
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
  let name = null;
  try { name = localStorage.getItem(NAME_KEY); } catch { /* ignore */ }
  return name || "Auditor-" + getKey().slice(0, 4).toUpperCase();
}

export function setName(text) {
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
