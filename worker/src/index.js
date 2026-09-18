// The Silent Archive - cloud save + leaderboard API (Cloudflare Worker + KV).
//
// No SQL, no accounts database: one KV entry per player.
//
//   Identity: the browser generates a random 128-bit key (32 hex chars) on
//   first launch and sends it as `Authorization: Bearer <key>`. Only the
//   SHA-256 of it is ever stored, so the key is the whole "account" and the
//   same key on another device restores the same progress. Nobody can write
//   to a save without its key.
//
//   Leaderboard: each save is stored with a small public `metadata` blob
//   (name, best xp, best findings, clearance, updatedAt). Listing the keys returns that
//   metadata without reading any values, so a save is exactly ONE KV write.
//
//   GET  /api/leaderboard   top players (cached at the edge for 2 minutes)
//   GET  /api/save          the caller's save            (Bearer key)
//   PUT  /api/save          {name, state}: store a save  (Bearer key)
//
// The leaderboard is honor-system: the game runs in the player's browser, so
// the server can only check that a save is well-formed and within the game's
// real limits, not that it was earned.

const KEY_RE = /^[0-9a-f]{32}$/;
const MAX_BODY_BYTES = 20000;
const MIN_WRITE_GAP_MS = 10000;
const MAX_XP = 10000; // 565 records * 5 + 303 findings * 15 + rests is ~7.4k
const LEADERBOARD_ROWS = 50;
const LEADERBOARD_CACHE_SECONDS = 120;
const LIST_PAGES = 5; // up to 5000 players considered for the top list

function json(body, status, cors, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors, ...(extra || {}) },
  });
}

function corsFor(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    ok,
    hasOrigin: !!origin,
    headers: ok ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    } : { Vary: "Origin" },
  };
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function playerKeyFrom(request) {
  const m = /^Bearer ([0-9a-f]{32})$/.exec(request.headers.get("Authorization") || "");
  if (!m || !KEY_RE.test(m[1])) return null;
  return "p:" + (await sha256Hex(m[1]));
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isStrList = (v, maxLen, maxItem) =>
  Array.isArray(v) && v.length <= maxLen &&
  v.every((x) => typeof x === "string" && x.length > 0 && x.length <= maxItem);

// Returns a cleaned copy containing ONLY the game's known state fields, or
// null if anything is out of range. (Never store the client's object as-is.)
function cleanState(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  const ok =
    typeof s.lang === "string" && /^[a-z]{2,8}$/.test(s.lang) &&
    isInt(s.clearance, 0, 10) &&
    isInt(s.contam, 0, 100) &&
    isInt(s.day, 1, 50) &&
    isStrList(s.read, 1000, 80) &&
    isStrList(s.findings, 1000, 80) &&
    isStrList(s.mail_read, 100, 20) &&
    isInt(s.amnestics, 0, 20) &&
    Array.isArray(s.thresholds_fired) && s.thresholds_fired.length <= 10 &&
    s.thresholds_fired.every((n) => isInt(n, 0, 100)) &&
    isInt(s.cure_used, 0, 200) &&
    typeof s.fast === "boolean" &&
    isInt(s.turns, 0, 10000000) &&
    isInt(s.xp, 0, MAX_XP) &&
    isInt(s.rank_seen, 0, 20);
  if (!ok) return null;
  return {
    lang: s.lang, clearance: s.clearance, contam: s.contam, day: s.day,
    read: s.read, findings: s.findings, mail_read: s.mail_read,
    amnestics: s.amnestics, thresholds_fired: s.thresholds_fired,
    cure_used: s.cure_used, fast: s.fast, turns: s.turns, xp: s.xp,
    rank_seen: s.rank_seen,
  };
}

function cleanName(n) {
  if (typeof n !== "string") return null;
  const name = n.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, "")
    .replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= 24 ? name : null;
}

async function leaderboard(request, env, ctx, cors) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/leaderboard", request.url).toString());
  let body;
  const hit = await cache.match(cacheKey);
  if (hit) {
    body = await hit.text();
  } else {
    const rows = [];
    let cursor;
    for (let page = 0; page < LIST_PAGES; page++) {
      const res = await env.SAVES.list({ prefix: "p:", cursor });
      for (const k of res.keys) {
        const m = k.metadata;
        if (m && typeof m.name === "string" && Number.isInteger(m.xp)) rows.push(m);
      }
      if (res.list_complete) break;
      cursor = res.cursor;
    }
    rows.sort((a, b) => (b.xp - a.xp) || ((b.findings || 0) - (a.findings || 0)));
    body = JSON.stringify({
      rows: rows.slice(0, LEADERBOARD_ROWS).map((m) => ({
        name: m.name, xp: m.xp, findings: m.findings || 0,
        clearance: m.clearance || 0, updatedAt: m.updatedAt || 0,
      })),
    });
    ctx.waitUntil(cache.put(cacheKey, new Response(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${LEADERBOARD_CACHE_SECONDS}` },
    })));
  }
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json", ...cors } });
}

async function getSave(request, env, cors) {
  const key = await playerKeyFrom(request);
  if (!key) return json({ error: "bad_key" }, 401, cors);
  const rec = await env.SAVES.get(key, "json");
  if (!rec) return json({ error: "not_found" }, 404, cors, { "Cache-Control": "no-store" });
  return json({ name: rec.name, state: rec.state, updatedAt: rec.updatedAt }, 200, cors, { "Cache-Control": "no-store" });
}

async function putSave(request, env, cors) {
  const key = await playerKeyFrom(request);
  if (!key) return json({ error: "bad_key" }, 401, cors);

  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "too_large" }, 413, cors);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413, cors);

  let payload;
  try { payload = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400, cors); }

  const name = cleanName(payload && payload.name);
  const state = cleanState(payload && payload.state);
  if (!name) return json({ error: "bad_name" }, 400, cors);
  if (!state) return json({ error: "bad_state" }, 400, cors);

  const now = Date.now();
  const existing = await env.SAVES.get(key, "json");
  if (existing && now - existing.updatedAt < MIN_WRITE_GAP_MS) {
    return json({ error: "slow_down" }, 429, cors, { "Retry-After": "10" });
  }

  const prev = existing && existing.best ? existing.best : { xp: 0, findings: 0 };
  const best = { xp: Math.max(prev.xp || 0, state.xp), findings: Math.max(prev.findings || 0, state.findings.length) };
  const meta = { name, xp: best.xp, findings: best.findings, clearance: state.clearance, updatedAt: now };
  await env.SAVES.put(key, JSON.stringify({ name, state, best, updatedAt: now }), { metadata: meta });
  return json({ ok: true, updatedAt: now }, 200, cors, { "Cache-Control": "no-store" });
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsFor(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: cors.ok ? 204 : 403, headers: cors.headers });
    }
    // Browsers always send Origin on cross-origin calls; refuse ones from
    // sites we don't serve. (Non-browser clients can't be stopped by CORS,
    // which is fine: everything they can do still needs a valid key.)
    if (cors.hasOrigin && !cors.ok) return json({ error: "origin_not_allowed" }, 403, cors.headers);

    try {
      if (url.pathname === "/api/leaderboard" && request.method === "GET") return await leaderboard(request, env, ctx, cors.headers);
      if (url.pathname === "/api/save" && request.method === "GET") return await getSave(request, env, cors.headers);
      if (url.pathname === "/api/save" && request.method === "PUT") return await putSave(request, env, cors.headers);
      if (url.pathname === "/" || url.pathname === "/api") return json({ name: "silent-archive-api", ok: true }, 200, cors.headers);
      return json({ error: "not_found" }, 404, cors.headers);
    } catch (err) {
      console.error("unhandled", err && err.message);
      return json({ error: "server_error" }, 500, cors.headers);
    }
  },
};
