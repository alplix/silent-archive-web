// Usage: node worker/smoke-test.mjs <base-url> [origin]
//   node worker/smoke-test.mjs http://127.0.0.1:8787
//   node worker/smoke-test.mjs https://silent-archive-api.<you>.workers.dev
// Exercises the whole API with a throwaway player key (leaves one test entry
// named "smoke-test" until it's overwritten; harmless).

const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const origin = process.argv[3] || "http://localhost:8123";
const key = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

const state = (over = {}) => ({
  lang: "en", clearance: 2, contam: 4, day: 2, read: ["SCP-173"], findings: ["f01_imza"],
  mail_read: ["m01"], amnestics: 4, thresholds_fired: [], cure_used: 0, fast: false,
  turns: 12, xp: 20, rank_seen: 0, ...over,
});

let failed = 0;
function check(label, cond, extra = "") {
  console.log((cond ? "ok   " : "FAIL ") + label + (extra ? "  " + extra : ""));
  if (!cond) failed++;
}
const call = (path, method = "GET", { auth = key, body, o = origin } = {}) =>
  fetch(base + path, {
    method,
    headers: {
      ...(o ? { Origin: o } : {}),
      ...(auth ? { Authorization: "Bearer " + auth } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

let r = await call("/api/save", "GET");
check("GET save before any save -> 404", r.status === 404, String(r.status));

r = await call("/api/save", "PUT", { body: { name: "smoke-test", state: state() } });
check("PUT save -> 200", r.status === 200, String(r.status));
check("CORS header echoes allowed origin", r.headers.get("access-control-allow-origin") === origin);

r = await call("/api/save", "GET");
const got = r.status === 200 ? await r.json() : null;
check("GET save returns what was stored", got && got.name === "smoke-test" && got.state.xp === 20 && got.state.mail_read[0] === "m01");

r = await call("/api/save", "PUT", { body: { name: "smoke-test", state: state({ xp: 30 }) } });
check("second PUT within 10s -> 429", r.status === 429, String(r.status));

r = await call("/api/save", "PUT", { auth: "not-a-key", body: { name: "x", state: state() } });
check("bad key -> 401", r.status === 401, String(r.status));

const other = key.split("").reverse().join("");
r = await call("/api/save", "GET", { auth: other });
check("a different key cannot read this save", r.status === 404, String(r.status));

r = await call("/api/save", "PUT", { auth: other, body: { name: "x", state: state({ xp: 99999 }) } });
check("out-of-range xp -> 400", r.status === 400, String(r.status));

r = await call("/api/save", "PUT", { auth: other, body: { name: "x", state: { ...state(), extra: "junk" }, surprise: 1 } });
check("unknown extra fields are accepted but never stored", r.status === 200 || r.status === 429, String(r.status));
r = await call("/api/save", "GET", { auth: other });
const stored = r.status === 200 ? await r.json() : null;
check("stored state has only known fields", stored && !("extra" in stored.state));

r = await call("/api/save", "PUT", { auth: other, o: "https://evil.example", body: { name: "x", state: state() } });
check("disallowed Origin -> 403", r.status === 403, String(r.status));

r = await call("/api/leaderboard", "GET");
const lb = r.status === 200 ? await r.json() : null;
check("GET leaderboard -> 200 with rows[]", lb && Array.isArray(lb.rows), String(r.status));
check("leaderboard rows expose no key/hash", lb && lb.rows.every((x) => Object.keys(x).sort().join() === "clearance,findings,name,updatedAt,xp"));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
