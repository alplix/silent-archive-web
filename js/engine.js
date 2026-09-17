/*
 * SESSIZ ARŞİV / THE SILENT ARCHIVE — web engine
 * A faithful JS port of scp.py's logic. Reads the same manifest.json /
 * dil/*.json data files unchanged. Produces an array of {text, cls} lines
 * per command instead of printing to a terminal, so the DOM layer can
 * render them. No language or story knowledge lives here beyond what the
 * data files provide.
 */

const Engine = (() => {
  "use strict";

  let M = null;          // manifest
  let RECORDS = null;
  let RECORD_ORDER = null;
  let KEYS = null;
  let KEY_ALIASES = null;
  let FINDING_ORDER = null;
  let RULES = null;
  let ENDING_DEFS = null;
  let MAIL_DEFS = null;
  let RANKS = null;
  let CROSS_MAP = null;   // Map: "a|b" (sorted) -> finding id
  let LANGS = null;       // {code: data}
  let BASE_LANG = "en";
  let COMMANDS = null;    // folded word -> canonical verb

  let STATE = null;

  const GLITCH_CHARS = "▓▒░#@%&§¤";
  const GATE_RE = /\{\{(\d)\|([\s\S]*?)\|([\s\S]*?)\}\}/g;

  const FOLD_MAP = {
    "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
    "ç": "c", "Ç": "c", "ö": "o", "Ö": "o", "ü": "u", "Ü": "u",
    "ä": "a", "å": "a", "æ": "a", "ø": "o", "ß": "ss", "ñ": "n",
    "đ": "d", "ł": "l", "ż": "z", "ź": "z", "ę": "e", "ą": "a",
  };

  function fold(s) {
    s = String(s ?? "");
    let out = "";
    for (const ch of s) out += FOLD_MAP[ch] ?? ch;
    out = out.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    return out.toLowerCase().trim();
  }

  // ------------------------------------------------------------------
  // loading
  // ------------------------------------------------------------------

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to fetch " + path + ": " + res.status);
    return res.json();
  }

  async function boot(dataBase) {
    M = await fetchJson(dataBase + "/manifest.json");
    RECORDS = M.records;
    RECORD_ORDER = M.record_order;
    KEYS = M.keys;
    KEY_ALIASES = M.key_aliases;
    FINDING_ORDER = M.finding_order;
    RULES = M.rules;
    ENDING_DEFS = M.endings;
    MAIL_DEFS = M.mail;
    RANKS = M.ranks || [{ id: "stajyer", at: 0 }];

    CROSS_MAP = new Map();
    for (const c of M.cross) {
      const key = [c.a, c.b].sort().join("|");
      CROSS_MAP.set(key, c.finding);
    }

    const registry = (typeof window !== "undefined" && window.LANGUAGE_META) || [
      { code: "en" }, { code: "tr" },
    ];
    const results = await Promise.allSettled(
      registry.map((entry) => fetchJson(dataBase + "/dil/" + entry.code + ".json"))
    );
    LANGS = {};
    results.forEach((res, i) => {
      if (res.status === "fulfilled") {
        const data = res.value;
        const code = (data.meta && data.meta.code) || registry[i].code;
        LANGS[code] = data;
      } else {
        console.warn("Failed to load language data for", registry[i].code, res.reason);
      }
    });
    BASE_LANG = LANGS.en ? "en" : Object.keys(LANGS).sort()[0];

    COMMANDS = {};
    for (const data of Object.values(LANGS)) {
      for (const [word, canonical] of Object.entries(data.commands || {})) {
        COMMANDS[fold(word)] = canonical;
      }
    }
  }

  function langChain(code) {
    const seen = new Set();
    const order = [];
    let cur = code;
    while (cur && LANGS[cur] && !seen.has(cur)) {
      seen.add(cur);
      order.push(cur);
      cur = LANGS[cur].meta && LANGS[cur].meta.fallback;
    }
    if (!seen.has(BASE_LANG)) order.push(BASE_LANG);
    return order;
  }

  function T(...path) {
    let dflt;
    if (path.length && typeof path[path.length - 1] === "object" && path[path.length - 1] !== null
        && "default" in path[path.length - 1]) {
      dflt = path.pop().default;
    }
    for (const code of langChain(STATE.lang || BASE_LANG)) {
      let node = LANGS[code];
      let ok = true;
      for (const step of path) {
        if (node && typeof node === "object" && step in node) {
          node = node[step];
        } else {
          ok = false;
          break;
        }
      }
      if (ok && node !== null && node !== undefined && node !== "") return node;
    }
    if (dflt !== undefined) return dflt;
    return path.join("/");
  }

  // ------------------------------------------------------------------
  // state
  // ------------------------------------------------------------------

  function newState(langcode) {
    return {
      lang: langcode,
      clearance: RULES.clearance_start,
      contam: 0,
      day: 1,
      read: [],
      findings: [],
      mail_read: [],
      amnestics: RULES.amnestic_doses,
      thresholds_fired: [],
      cure_used: 0,
      fast: false,
      turns: 0,
      xp: 0,
      rank_seen: 0,
    };
  }

  function getState() { return STATE; }
  function setState(s) { STATE = s; }

  // ------------------------------------------------------------------
  // rank / xp
  // ------------------------------------------------------------------

  function rankIndex(xp) {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].at) idx = i;
    return idx;
  }

  function rankName(idx) {
    if (idx === undefined) idx = rankIndex(STATE.xp);
    return T("ranks", RANKS[idx].id);
  }

  // lines: mutable array the caller passes in, so addXp (called from other
  // commands) can append its own "rank up" lines in the right place.
  function addXp(amount, lines) {
    if (!amount) return;
    STATE.xp += amount;
    const idx = rankIndex(STATE.xp);
    if (idx > (STATE.rank_seen || 0)) {
      STATE.rank_seen = idx;
      const relief = RULES.rank_commendation_relief || 0;
      const before = STATE.contam;
      if (relief) {
        STATE.contam = Math.max(0, STATE.contam - relief);
        STATE.thresholds_fired = STATE.thresholds_fired.filter(t => t <= STATE.contam);
      }
      lines.push({ text: "", cls: "" });
      lines.push({ text: "  >> " + T("ui", "rank_up").replace("{rank}", rankName(idx)), cls: "cyan", anim: true, animSpeed: 14 });
      if (relief && before > STATE.contam) {
        lines.push({ text: T("ui", "rank_up_relief").replace("{n}", String(before - STATE.contam)), cls: "dim cyan" });
      }
    }
  }

  // ------------------------------------------------------------------
  // rendering: clearance gate, then contamination glitch
  // ------------------------------------------------------------------

  function render(text, clearance) {
    if (clearance === undefined) clearance = STATE.clearance;
    return text.replace(GATE_RE, (m, need, visible, hidden) => {
      need = parseInt(need, 10);
      if (clearance >= need) return visible;
      return hidden || T("ui", "redacted").replace("{n}", String(need));
    });
  }

  function glitch(text, contam) {
    if (contam === undefined) contam = STATE.contam;
    const floor = RULES.contam_glitch_floor;
    if (contam < floor) return text;
    const rate = (contam - floor) / 260.0;
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      if (/\p{L}/u.test(chars[i]) && Math.random() < rate) {
        chars[i] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      }
    }
    return chars.join("");
  }

  function body(text) {
    return glitch(render(text));
  }

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------

  function contamLevel() {
    const c = STATE.contam;
    return c >= 70 ? "high" : (c >= 40 ? "mid" : "low");
  }

  function bar(value, total = 100, width = 24) {
    const filled = Math.round(width * value / total);
    return "[" + "#".repeat(filled) + ".".repeat(width - filled) + "]";
  }

  function accessible(rid) {
    return RECORDS[rid].clearance <= STATE.clearance;
  }

  function accessibleRecords() {
    return RECORD_ORDER.filter(accessible);
  }

  function addContam(amount, lines) {
    if (!amount) return;
    STATE.contam = Math.max(0, Math.min(RULES.contam_max, STATE.contam + amount));
    for (const t of RULES.contam_thresholds) {
      if (STATE.contam >= t && !STATE.thresholds_fired.includes(t)) {
        STATE.thresholds_fired.push(t);
        lines.push({ text: "", cls: "" });
        lines.push({ text: T("contamination", String(t)), cls: "amber" });
      }
    }
  }

  function availableMail() {
    const n = STATE.findings.length;
    return MAIL_DEFS.filter(m => m.at <= n).map(m => m.id);
  }

  function unreadMail() {
    return availableMail().filter(id => !STATE.mail_read.includes(id));
  }

  function resolve(token) {
    let t = fold(token).replace(/\s+/g, "");
    const tc = t.replace(/[-_]/g, "");
    for (const rid of RECORD_ORDER) {
      const f = fold(rid);
      if (t === f || tc === f.replace(/-/g, "")) return rid;
    }
    if (tc && /^\d+$/.test(tc)) {
      for (const rid of RECORD_ORDER) {
        if (rid.startsWith("SCP-") && rid.slice(4) === tc) return rid;
      }
    }
    const hits = RECORD_ORDER.filter(r => tc && fold(r).replace(/-/g, "").includes(tc));
    if (hits.length === 1) return hits[0];
    const vis = hits.filter(accessible);
    if (vis.length === 1) return vis[0];
    return null;
  }

  function isYes(word) {
    const yes = new Set();
    for (const data of Object.values(LANGS)) {
      for (const w of (data.ui && data.ui.yes_words) || []) yes.add(fold(w));
    }
    return yes.has(fold(word));
  }

  // ------------------------------------------------------------------
  // commands. Each returns { lines: [{text, cls}], pendingConfirm?: fn,
  // ended?: {kind: 'finish'|'fail', id} }
  // ------------------------------------------------------------------

  function indentText(text, pad = "  ") {
    return text.split("\n").map(l => pad + l).join("\n");
  }

  function cmdHelp() {
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "help_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    for (const l of T("ui", "help_lines", { default: [] })) lines.push({ text: "  " + l, cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    return { lines };
  }

  function cmdList(args) {
    const lines = [];
    let onlyAct = null;
    if (args.length && /^\d+$/.test(args[0])) onlyAct = parseInt(args[0], 10);
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "list_title").replace("{n}", String(STATE.clearance)), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    let shown = 0;
    let currentAct = null;
    for (const rid of RECORD_ORDER) {
      const meta = RECORDS[rid];
      if (!accessible(rid)) continue;
      if (onlyAct && meta.act !== onlyAct) continue;
      if (meta.act !== currentAct) {
        currentAct = meta.act;
        lines.push({ text: "", cls: "" });
        lines.push({ text: "  " + T("acts", String(currentAct), "title"), cls: "cyan" });
        lines.push({ text: "  " + "-".repeat(68), cls: "dim darkgreen" });
      }
      shown++;
      const mark = STATE.read.includes(rid) ? T("ui", "mark_read") : " ".repeat(8);
      lines.push({ text: `  ${rid.padEnd(16)} ${mark}  ${T("records", rid, "name")}`, cls: "" });
    }
    const locked = RECORD_ORDER.filter(r => !accessible(r)).length;
    lines.push({ text: "", cls: "" });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    lines.push({
      text: T("ui", "list_footer").replace("{open}", String(shown)).replace("{locked}", String(locked)),
      cls: "dim darkgreen",
    });
    return { lines };
  }

  function cmdRead(args) {
    const lines = [];
    if (!args.length) { lines.push({ text: T("ui", "read_usage"), cls: "amber" }); return { lines }; }
    const rid = resolve(args.join(" "));
    if (rid === null) {
      lines.push({ text: T("ui", "no_such_file").replace("{x}", args.join(" ")), cls: "amber" });
      return { lines };
    }
    const meta = RECORDS[rid];
    if (!accessible(rid)) {
      lines.push({ text: T("ui", "denied").replace("{n}", String(meta.clearance)).replace("{f}", rid), cls: "red" });
      return { lines };
    }
    const first = !STATE.read.includes(rid);
    if (first) STATE.read.push(rid);

    lines.push({ text: "", cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + rid + "  //  " + T("records", rid, "name"), cls: "bold white" });
    const cls = T("records", rid, "class", { default: "" });
    if (cls) lines.push({ text: "  " + T("ui", "class_label") + ": " + cls, cls: "amber" });
    lines.push({
      text: "  " + T("ui", "clearance_label") + ": " + meta.clearance + "    " + T("ui", "act_label") + ": " + meta.act,
      cls: "dim darkgreen",
    });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "", cls: "" });
    lines.push({ text: body(T("records", rid, "text")), cls: "green", anim: true });
    lines.push({ text: "", cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });

    if (rid === RULES.cure_record) {
      const relief = Math.max(RULES.cure_floor, RULES.cure_first - RULES.cure_step * STATE.cure_used);
      STATE.cure_used++;
      if (STATE.contam > 0) {
        const actual = Math.min(relief, STATE.contam);
        STATE.contam -= actual;
        STATE.thresholds_fired = STATE.thresholds_fired.filter(t => t <= STATE.contam);
        lines.push({ text: T("ui", "cure").replace("{n}", String(actual)), cls: "cyan" });
      }
    } else if (first) {
      addContam(meta.contam, lines);
    }
    if (first) addXp(RULES.xp_per_record || 0, lines);

    return { lines };
  }

  function cmdSearch(args) {
    const lines = [];
    if (!args.length) { lines.push({ text: T("ui", "search_usage"), cls: "amber" }); return { lines }; }
    const term = args.join(" ");
    const needle = fold(term);
    let hits = 0;
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "search_title").replace("{x}", term), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    for (const rid of accessibleRecords()) {
      const text = render(T("records", rid, "text"));
      for (const line of text.split("\n")) {
        if (needle && fold(line).includes(needle)) {
          hits++;
          if (hits <= 60) lines.push({ text: `  ${rid.padEnd(16)} | ${line.trim().slice(0, 76)}`, cls: "" });
        }
      }
    }
    if (!hits) lines.push({ text: "  " + T("ui", "search_none"), cls: "dim darkgreen" });
    else if (hits > 60) lines.push({ text: "  ...", cls: "dim darkgreen" });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "search_footer").replace("{n}", String(hits)), cls: "dim darkgreen" });
    return { lines };
  }

  function cmdCross(args) {
    const lines = [];
    if (args.length < 2) { lines.push({ text: T("ui", "cross_usage"), cls: "amber" }); return { lines }; }
    const a = resolve(args[0]), b = resolve(args[1]);
    if (a === null || b === null) { lines.push({ text: T("ui", "cross_bad"), cls: "amber" }); return { lines }; }
    if (a === b) { lines.push({ text: T("ui", "cross_same"), cls: "amber" }); return { lines }; }
    for (const rid of [a, b]) {
      if (!STATE.read.includes(rid)) {
        lines.push({ text: T("ui", "cross_unread").replace("{f}", rid), cls: "amber" });
        return { lines };
      }
    }

    lines.push({ text: "", cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "cross_header").replace("{a}", a).replace("{b}", b), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });

    const key = [a, b].sort().join("|");
    const fid = CROSS_MAP.get(key);
    if (!fid) {
      lines.push({ text: "  " + T("ui", "cross_nothing"), cls: "dim darkgreen" });
      return { lines };
    }
    if (STATE.findings.includes(fid)) {
      lines.push({ text: "  " + T("ui", "cross_known"), cls: "dim darkgreen" });
      lines.push({ text: indentText(body(T("findings", fid, "text"))), cls: "" });
      return { lines };
    }

    STATE.findings.push(fid);
    lines.push({ text: "", cls: "" });
    lines.push({ text: "  >> " + T("ui", "cross_match"), cls: "cyan", anim: true, animSpeed: 14 });
    lines.push({ text: "", cls: "" });
    lines.push({ text: "  " + T("findings", fid, "title"), cls: "bold white" });
    lines.push({ text: "", cls: "" });
    lines.push({ text: indentText(body(T("findings", fid, "text"))), cls: "green", anim: true });
    lines.push({ text: "", cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    addContam(RULES.contam_per_cross, lines);
    addXp(RULES.xp_per_finding || 0, lines);
    if (unreadMail().length) {
      lines.push({ text: T("ui", "new_mail").replace("{n}", String(unreadMail().length)), cls: "cyan" });
    }
    return { lines };
  }

  function cmdFindings() {
    const lines = [];
    lines.push({
      text: "=".repeat(72), cls: "darkgreen",
    });
    lines.push({
      text: T("ui", "findings_title").replace("{n}", String(STATE.findings.length)).replace("{t}", String(FINDING_ORDER.length)),
      cls: "bold white",
    });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    if (!STATE.findings.length) {
      lines.push({ text: "  " + T("ui", "findings_none"), cls: "dim darkgreen" });
      return { lines };
    }
    let n = 0;
    for (const fid of FINDING_ORDER) {
      if (!STATE.findings.includes(fid)) continue;
      n++;
      lines.push({ text: `  ${String(n).padStart(2)}. ${T("findings", fid, "title")}`, cls: "white" });
      lines.push({ text: indentText(T("findings", fid, "text"), "      "), cls: "" });
      lines.push({ text: "", cls: "" });
    }
    return { lines };
  }

  function cmdMail(args) {
    const lines = [];
    const avail = availableMail();
    if (args.length) {
      const idx = parseInt(args[0], 10) - 1;
      if (Number.isNaN(idx)) { lines.push({ text: T("ui", "mail_usage"), cls: "amber" }); return { lines }; }
      if (!(idx >= 0 && idx < avail.length)) { lines.push({ text: T("ui", "mail_none"), cls: "amber" }); return { lines }; }
      const mid = avail[idx];
      if (!STATE.mail_read.includes(mid)) STATE.mail_read.push(mid);
      lines.push({ text: "", cls: "" });
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      lines.push({ text: "  " + T("ui", "mail_from") + ": " + T("mail", mid, "from"), cls: "white" });
      lines.push({ text: "  " + T("ui", "mail_subject") + ": " + T("mail", mid, "subject"), cls: "white" });
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      lines.push({ text: "", cls: "" });
      lines.push({ text: body(T("mail", mid, "text")), cls: "green", anim: true });
      lines.push({ text: "", cls: "" });
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      return { lines };
    }

    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "mail_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    if (!avail.length) { lines.push({ text: "  " + T("ui", "mail_empty"), cls: "dim darkgreen" }); return { lines }; }
    avail.forEach((mid, i) => {
      const unread = !STATE.mail_read.includes(mid);
      const flagText = unread ? " * " : "   ";
      lines.push({
        text: `  ${String(i + 1).padStart(2)}.${flagText}${T("mail", mid, "from").padEnd(26)} ${T("mail", mid, "subject")}`,
        cls: unread ? "cyan" : "",
      });
    });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "mail_hint"), cls: "dim darkgreen" });
    return { lines };
  }

  function cmdStatus() {
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "status_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: `  ${T("ui", "st_operator").padEnd(28)} ${T("records", "PRS-DEREN", "name")}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_clearance").padEnd(28)} ${STATE.clearance} / ${RULES.clearance_max}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_day").padEnd(28)} ${STATE.day} / ${RULES.days_max}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_files").padEnd(28)} ${STATE.read.length} / ${accessibleRecords().length}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_findings").padEnd(28)} ${STATE.findings.length} / ${FINDING_ORDER.length}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_amnestics").padEnd(28)} ${STATE.amnestics}`, cls: "" });
    const idx = rankIndex(STATE.xp);
    lines.push({ text: `  ${T("ui", "st_rank").padEnd(28)} ${rankName(idx)}`, cls: "" });
    if (idx + 1 < RANKS.length) {
      lines.push({ text: `  ${T("ui", "st_xp").padEnd(28)} ${STATE.xp}  (${T("ui", "xp_next").replace("{n}", String(RANKS[idx + 1].at))})`, cls: "" });
    } else {
      lines.push({ text: `  ${T("ui", "st_xp").padEnd(28)} ${STATE.xp}  (${T("ui", "xp_max")})`, cls: "" });
    }
    const c = STATE.contam;
    lines.push({ text: `  ${T("ui", "st_contam").padEnd(28)} ${bar(c)} ${c}%`, cls: contamLevel() === "high" ? "red" : (contamLevel() === "mid" ? "amber" : "green") });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "contam_state", contamLevel()), cls: contamLevel() === "high" ? "red" : (contamLevel() === "mid" ? "amber" : "green") });
    const left = RULES.days_max - STATE.day;
    lines.push({ text: "  " + T("ui", "days_left").replace("{n}", String(left)), cls: "dim darkgreen" });
    return { lines };
  }

  function cmdRest() {
    const lines = [];
    if (STATE.day >= RULES.days_max) { lines.push({ text: T("ui", "rest_last"), cls: "red" }); return { lines }; }
    lines.push({ text: T("ui", "rest_warn").replace("{n}", String(RULES.rest_relief)), cls: "amber" });
    return {
      lines,
      pendingConfirm: (yes) => {
        const out = [];
        if (!yes) { out.push({ text: T("ui", "cancelled"), cls: "dim darkgreen" }); return { lines: out }; }
        STATE.day++;
        const before = STATE.contam;
        STATE.contam = Math.max(0, STATE.contam - RULES.rest_relief);
        STATE.thresholds_fired = STATE.thresholds_fired.filter(t => t <= STATE.contam);
        out.push({ text: "", cls: "" });
        out.push({ text: "=".repeat(72), cls: "darkgreen" });
        out.push({ text: "  " + T("ui", "day_header").replace("{n}", String(STATE.day)), cls: "bold white" });
        out.push({ text: "=".repeat(72), cls: "darkgreen" });
        out.push({ text: "", cls: "" });
        out.push({ text: T("days", String(STATE.day), { default: T("ui", "day_generic") }), cls: "green", anim: true });
        out.push({ text: "", cls: "" });
        out.push({ text: T("ui", "rest_done").replace("{n}", String(before - STATE.contam)), cls: "cyan" });
        addXp(RULES.xp_rest_bonus || 0, out);
        if (STATE.day >= RULES.days_max) out.push({ text: T("ui", "rest_final_warning"), cls: "red" });
        return { lines: out };
      },
    };
  }

  function cmdCode(args) {
    const lines = [];
    if (!args.length) { lines.push({ text: T("ui", "code_usage"), cls: "amber" }); return { lines }; }
    let raw = args[0].trim();
    let token = KEY_ALIASES[raw] || raw.toUpperCase();
    token = KEY_ALIASES[token] || token;
    const entry = KEYS[token];
    if (!entry) { lines.push({ text: T("ui", "code_bad"), cls: "red" }); return { lines }; }
    const lvl = entry.level;
    if (STATE.clearance >= lvl) { lines.push({ text: T("ui", "code_already").replace("{n}", String(lvl)), cls: "amber" }); return { lines }; }
    STATE.clearance = lvl;
    lines.push({ text: "", cls: "" });
    lines.push({ text: T("ui", "code_ok").replace("{n}", String(lvl)), cls: "cyan", anim: true, animSpeed: 15 });
    lines.push({ text: T("ui", "code_note"), cls: "dim darkgreen" });
    let act = 1;
    for (const m of Object.values(RECORDS)) if (m.clearance <= lvl) act = Math.max(act, m.act);
    lines.push({ text: "", cls: "" });
    lines.push({ text: "  " + T("acts", String(act), "title"), cls: "bold cyan" });
    lines.push({ text: indentText(T("acts", String(act), "blurb", { default: "" })), cls: "green" });
    return { lines };
  }

  function cmdAmnestic() {
    const lines = [];
    if (STATE.amnestics <= 0) { lines.push({ text: T("ui", "amn_none"), cls: "amber" }); return { lines }; }
    if (STATE.contam === 0 && !STATE.findings.length) { lines.push({ text: T("ui", "amn_pointless"), cls: "amber" }); return { lines }; }
    lines.push({ text: T("ui", "amn_warn").replace("{n}", String(RULES.amnestic_relief)).replace("{k}", String(RULES.amnestic_cost)), cls: "amber" });
    return {
      lines,
      pendingConfirm: (yes) => {
        const out = [];
        if (!yes) { out.push({ text: T("ui", "cancelled"), cls: "dim darkgreen" }); return { lines: out }; }
        STATE.amnestics--;
        STATE.contam = Math.max(0, STATE.contam - RULES.amnestic_relief);
        STATE.thresholds_fired = STATE.thresholds_fired.filter(t => t <= STATE.contam);
        const lost = [];
        for (let i = 0; i < RULES.amnestic_cost; i++) {
          if (STATE.findings.length) {
            const idx = Math.floor(Math.random() * STATE.findings.length);
            lost.push(STATE.findings.splice(idx, 1)[0]);
          }
        }
        out.push({ text: "", cls: "" });
        out.push({ text: T("ui", "amn_done"), cls: "cyan" });
        for (const fid of lost) out.push({ text: "  - " + T("findings", fid, "title"), cls: "dim red" });
        if (lost.length) out.push({ text: T("ui", "amn_lost"), cls: "dim darkgreen" });
        return { lines: out };
      },
    };
  }

  function cmdLang(args) {
    const lines = [];
    if (!args.length) {
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      lines.push({ text: T("ui", "lang_title"), cls: "bold white" });
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      for (const code of Object.keys(LANGS).sort()) {
        const meta = LANGS[code].meta || {};
        const mark = code === STATE.lang ? "  <<" : "";
        lines.push({ text: `  ${code.padEnd(8)} ${(meta.name || code).padEnd(26)} ${meta.coverage || ""}${mark}`, cls: "" });
      }
      lines.push({ text: "-".repeat(72), cls: "darkgreen" });
      lines.push({ text: T("ui", "lang_hint"), cls: "dim darkgreen" });
      return { lines };
    }
    const code = fold(args[0]);
    if (!LANGS[code]) { lines.push({ text: T("ui", "lang_bad").replace("{x}", args[0]), cls: "amber" }); return { lines }; }
    STATE.lang = code;
    lines.push({ text: T("ui", "lang_switched"), cls: "cyan" });
    return { lines };
  }

  function cmdSpeed() {
    STATE.fast = !STATE.fast;
    return { lines: [{ text: T("ui", STATE.fast ? "speed_fast" : "speed_slow"), cls: "cyan" }] };
  }

  function cmdClear() {
    return { lines: [], clearScreen: true };
  }

  function cmdAbout() {
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "about_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    for (const l of T("ui", "about_lines", { default: [] })) lines.push({ text: "  " + l, cls: "" });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    lines.push({
      text: `  ${Object.keys(RECORDS).length} ${T("ui", "ab_records")} / ${FINDING_ORDER.length} ${T("ui", "ab_findings")} / ${ENDING_DEFS.length} ${T("ui", "ab_endings")} / ${Object.keys(LANGS).length} ${T("ui", "ab_languages")}`,
      cls: "dim darkgreen",
    });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    return { lines };
  }

  function unlockedEndings() {
    const res = [];
    for (const e of ENDING_DEFS) {
      if (STATE.clearance < e.clearance) continue;
      if (e.needs.some(f => !STATE.findings.includes(f))) continue;
      res.push(e.id);
    }
    return res;
  }

  function cmdReport() {
    const lines = [];
    const n = STATE.findings.length;
    if (n < RULES.report_min_findings) {
      lines.push({
        text: T("ui", "report_early").replace("{n}", String(n)).replace("{m}", String(RULES.report_min_findings)),
        cls: "amber",
      });
      return { lines };
    }
    const opts = unlockedEndings();
    lines.push({ text: "", cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "report_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "", cls: "" });
    lines.push({ text: body(T("report", "intro").replace("{n}", String(n)).replace("{t}", String(FINDING_ORDER.length))), cls: "green", anim: true });
    lines.push({ text: "", cls: "" });
    opts.forEach((eid, i) => {
      lines.push({ text: `  ${i + 1}) ${T("report", "options", eid, "label")}`, cls: "bold white" });
      lines.push({ text: "     " + T("report", "options", eid, "hint"), cls: "dim darkgreen" });
      lines.push({ text: "", cls: "" });
    });
    const hidden = ENDING_DEFS.length - opts.length;
    if (hidden) {
      lines.push({ text: "  " + T("ui", "report_locked").replace("{n}", String(hidden)), cls: "dim amber" });
      lines.push({ text: "", cls: "" });
    }
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });

    return {
      lines,
      pendingReportChoice: (choice) => {
        const idx = parseInt(choice, 10);
        if (Number.isNaN(idx) || idx < 1 || idx > opts.length) {
          return { lines: [{ text: T("ui", "cancelled"), cls: "dim darkgreen" }] };
        }
        return finish(opts[idx - 1]);
      },
    };
  }

  function finish(endingId) {
    const ratio = STATE.findings.length / FINDING_ORDER.length;
    const key = ratio >= RULES.ending_full_ratio ? "full" : "partial";
    let paras = T("endings", endingId, key, { default: null });
    if (!Array.isArray(paras)) paras = T("endings", endingId, "full", { default: [] });
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("endings", endingId, "title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "", cls: "" });
    for (const para of paras) { lines.push({ text: para, cls: "green", anim: true }); lines.push({ text: "", cls: "" }); }
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "end_findings").replace("{n}", String(STATE.findings.length)).replace("{t}", String(FINDING_ORDER.length)), cls: "dim darkgreen" });
    lines.push({ text: "  " + T("ui", "end_contam").replace("{n}", String(STATE.contam)), cls: "dim darkgreen" });
    lines.push({ text: "  " + T("ui", "end_days").replace("{n}", String(STATE.day)), cls: "dim darkgreen" });
    lines.push({ text: "  " + T("ui", "end_hint"), cls: "dim darkgreen" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    return { lines, ended: { kind: "finish", id: endingId } };
  }

  function fail(endingId) {
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("endings", endingId, "title"), cls: "bold red" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "", cls: "" });
    for (const para of T("endings", endingId, "full", { default: [] })) { lines.push({ text: para, cls: "red", anim: true }); lines.push({ text: "", cls: "" }); }
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "end_findings").replace("{n}", String(STATE.findings.length)).replace("{t}", String(FINDING_ORDER.length)), cls: "dim darkgreen" });
    lines.push({ text: "  " + T("ui", "end_hint"), cls: "dim darkgreen" });
    return { lines, ended: { kind: "fail", id: endingId } };
  }

  const DISPATCH = {
    help: cmdHelp, list: cmdList, read: cmdRead, search: cmdSearch,
    cross: cmdCross, findings: cmdFindings, mail: cmdMail, status: cmdStatus,
    rest: cmdRest, code: cmdCode, amnestic: cmdAmnestic, report: cmdReport,
    lang: cmdLang, speed: cmdSpeed, clear: cmdClear, about: cmdAbout,
  };

  function resolveVerb(word) {
    return COMMANDS[fold(word)] || null;
  }

  function runCommand(raw) {
    raw = raw.trim();
    if (!raw) return null;
    STATE.turns++;
    const parts = raw.split(/\s+/);
    const verb = resolveVerb(parts[0]);
    if (verb === null) {
      return { lines: [{ text: T("ui", "unknown").replace("{x}", parts[0]), cls: "amber" }] };
    }
    // save/load/quit are handled by the host page (localStorage / GitHub sync / navigation)
    if (["save", "load", "quit"].includes(verb)) {
      return { lines: [], hostVerb: verb };
    }
    const fn = DISPATCH[verb];
    if (!fn) return { lines: [{ text: T("ui", "unknown").replace("{x}", parts[0]), cls: "amber" }] };
    const result = fn(parts.slice(1));
    // post-command fail checks, mirroring scp.py's main loop
    if (!result.ended) {
      if (STATE.contam >= RULES.contam_max) {
        const f = fail("silindi");
        result.lines = result.lines.concat(f.lines);
        result.ended = f.ended;
      } else if (STATE.day > RULES.days_max) {
        const f = fail("rotasyon");
        result.lines = result.lines.concat(f.lines);
        result.ended = f.ended;
      }
    }
    return result;
  }

  function prompt() {
    const c = STATE.contam;
    return `L${STATE.clearance} G${STATE.day} ${c}%`;
  }

  function loadSanitizedState(data, currentLang) {
    const base = newState(currentLang);
    Object.assign(base, data);
    if (!LANGS[base.lang]) base.lang = currentLang;
    base.read = (base.read || []).filter(r => r in RECORDS);
    base.findings = (base.findings || []).filter(f => FINDING_ORDER.includes(f));
    return base;
  }

  return {
    boot, T, fold, newState, getState, setState,
    runCommand, isYes, prompt, loadSanitizedState,
    accessible, accessibleRecords,
    get RECORDS() { return RECORDS; },
    get RECORD_ORDER() { return RECORD_ORDER; },
    get FINDING_ORDER() { return FINDING_ORDER; },
    get RULES() { return RULES; },
    get RANKS() { return RANKS; },
    get LANGS() { return LANGS; },
    get BASE_LANG() { return BASE_LANG; },
    rankIndex, rankName,
  };
})();

// Attach explicitly so module scripts (main.js) can reliably reference it —
// don't rely on implicit global-scope sharing between classic and module scripts.
window.Engine = Engine;
