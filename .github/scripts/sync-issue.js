// Processes a "sync:" issue (see .github/workflows/sync-save.yml). Reads the
// issue body/author from env vars, validates everything defensively (this
// runs against arbitrary public input — any GitHub user can open an issue
// with this title), and writes saves/<username>.json + updates
// leaderboard.json inside DATA_DIR (the checked-out `player-data` branch).
// The result ({status, message, username}) goes to RESULT_PATH as JSON.
//
// Security note: the username used for the save file and leaderboard
// entry comes from ISSUE_USER (the issue's real author, set by GitHub
// itself, passed in by the workflow from `github.event.issue.user.login`)
// — never from anything inside the issue body. That's what makes it safe
// for a player to only ever overwrite their own data.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = process.env.DATA_DIR || path.join(REPO_ROOT, "player-data");
const SAVES_DIR = path.join(DATA_DIR, "saves");
const LEADERBOARD_PATH = path.join(DATA_DIR, "leaderboard.json");
const RESULT_PATH = process.env.RESULT_PATH || path.join(DATA_DIR, "..", "result.json");
const RANKS_META = require(path.join(REPO_ROOT, "data", "manifest.json")).ranks || [];

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const MAX_BODY_LEN = 20000;
const MAX_ARRAY_LEN = 2000;

// The message ends up in a workflow output and an issue comment: keep it to
// one short plain line no matter what (it can echo attacker-controlled text,
// e.g. inside a JSON parse error).
function oneLine(s) {
  return String(s).replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "?").slice(0, 200);
}

function writeResult(status, message, username) {
  fs.writeFileSync(
    RESULT_PATH,
    JSON.stringify({ status, message: oneLine(message), username: username || "" }),
    "utf8"
  );
}

function fail(msg) {
  console.error("REJECTED: " + oneLine(msg));
  writeResult("rejected", msg);
  process.exit(0); // exit 0 so the workflow can still report cleanly
}

// Returns the rank's internal id (e.g. "stajyer"), not a display name —
// this script has no access to dil/*.json's localized rank names, so the
// client resolves the id to text via Engine.T("ranks", id) at render time,
// which also means the leaderboard respects each viewer's language.
function rankIdFor(xp) {
  let id = RANKS_META[0] ? RANKS_META[0].id : "stajyer";
  for (const r of RANKS_META) {
    if (xp >= r.at) id = r.id;
  }
  return id;
}

function main() {
  const username = process.env.ISSUE_USER || "";
  const body = process.env.ISSUE_BODY || "";

  if (!USERNAME_RE.test(username)) {
    fail("Issue author is not a valid GitHub username shape - refusing to write.");
    return;
  }
  if (body.length > MAX_BODY_LEN) {
    fail(`Issue body too large (${body.length} chars, max ${MAX_BODY_LEN}).`);
    return;
  }

  const match = body.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    fail("No ```json code block found in the issue body.");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch (e) {
    fail("Could not parse the JSON block.");
    return;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("Payload is not a JSON object.");
    return;
  }

  const { lang, day, clearance, contam, xp, rank_seen, read, findings, amnestics, fast } = payload;

  const isStringArray = (v) =>
    Array.isArray(v) && v.length <= MAX_ARRAY_LEN && v.every((x) => typeof x === "string" && x.length <= 80);

  if (typeof lang !== "string" || lang.length > 10) return fail("Invalid lang field.");
  if (!Number.isInteger(day) || day < 0 || day > 1000) return fail("Invalid day field.");
  if (!Number.isInteger(clearance) || clearance < 0 || clearance > 100) return fail("Invalid clearance field.");
  if (!Number.isInteger(contam) || contam < 0 || contam > 100) return fail("Invalid contam field.");
  if (!Number.isInteger(xp) || xp < 0 || xp > 1000000) return fail("Invalid xp field.");
  if (!Number.isInteger(rank_seen) || rank_seen < 0 || rank_seen > 1000) return fail("Invalid rank_seen field.");
  if (!isStringArray(read)) return fail("Invalid read field.");
  if (!isStringArray(findings)) return fail("Invalid findings field.");
  if (!Number.isInteger(amnestics) || amnestics < 0 || amnestics > 1000) return fail("Invalid amnestics field.");

  const cleanState = {
    lang, day, clearance, contam, xp, rank_seen, read, findings, amnestics,
    fast: !!fast,
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(SAVES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SAVES_DIR, `${username.toLowerCase()}.json`),
    JSON.stringify(cleanState, null, 1) + "\n",
    "utf8"
  );

  let leaderboard = {};
  try {
    leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_PATH, "utf8"));
  } catch { /* file doesn't exist yet, or is empty - start fresh */ }
  if (!leaderboard || typeof leaderboard !== "object" || Array.isArray(leaderboard)) leaderboard = {};

  leaderboard[username.toLowerCase()] = {
    username,
    xp,
    rankId: rankIdFor(xp),
    findings: findings.length,
    clearance,
    updatedAt: cleanState.updatedAt,
  };

  fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(leaderboard, null, 1) + "\n", "utf8");

  writeResult("ok", `Synced ${username}: ${xp} XP, ${findings.length} findings, clearance ${clearance}.`, username.toLowerCase());
}

main();
