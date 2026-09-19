/*
 * THE SILENT ARCHIVE -- web engine ("library mode")
 *
 * The archive is the real SCP Wiki: every article comes from the public wiki
 * (CC BY-SA 3.0), unedited apart from the conversion to plain text, with its
 * author and source link. The game only adds the terminal around it:
 * clearance by object class, ranks, cognitive contamination, and "findings",
 * which are the real links between articles (article A names article B).
 *
 * Data: data/library/meta.json (index: number, name, class, rating, links) and
 * data/library/cNN.json (article text + author, 100 numbers per file, loaded
 * on demand). Interface text: data/dil/<code>.json.
 *
 * Every command returns { lines: [{text, cls, anim?, animSpeed?}], hostVerb?,
 * clearScreen?, loadLang? } so the DOM layer can render it.
 */

const Engine = (() => {
  "use strict";

  const GLITCH_CHARS = "▓▒░#@%&§¤";

  // Rules of the game (there is no story any more, so they live here).
  const RULES = {
    clearance_max: 4,
    contam_max: 100,
    contam_thresholds: [30, 50, 70, 85],
    contam_glitch_floor: 40,
    contam_per_cross: 1,
    rest_relief: 25,
    overload_reset: 50,
    cure_record: "SCP-999",
    cure_first: 15,
    cure_step: 5,
    cure_floor: 5,
    xp_per_record: 3,
    xp_per_finding: 10,
    rank_commendation_relief: 10,
    hint_cost: 2,
    page_size: 40,
  };

  const RANKS = [
    { id: "stajyer", at: 0 }, { id: "denetci", at: 30 }, { id: "kidemli", at: 90 },
    { id: "bas_denetci", at: 200 }, { id: "uzman", at: 400 }, { id: "desen_tanici", at: 800 },
  ];

  // Clearance level needed per object class, and the contamination each costs.
  const NEED = { safe: 1, neutralized: 1, explained: 1, decommissioned: 1, unknown: 1, euclid: 2, esoteric: 2, keter: 3, thaumiel: 4, apollyon: 4, archon: 4 };
  const COST = { safe: 1, euclid: 2, keter: 4, thaumiel: 3, apollyon: 5, archon: 4, esoteric: 2, neutralized: 0, explained: 0, decommissioned: 0, unknown: 1 };

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

  let ROWS = [];               // [{n, id, name, cls, rating, refs:[n]}] sorted by number
  let BY_NUM = new Map();
  let REVERSE = new Map();     // n -> [numbers that link to n]
  let CLASS_LIST = [];
  let LANGS = {};
  let REGISTRY = [];
  let DATA_BASE = "data";
  let BASE_LANG = "en";
  let COMMANDS = {};
  let STATE = null;
  const CHUNKS = {};

  const idOf = (n) => "SCP-" + String(n).padStart(3, "0");

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to fetch " + path + ": " + res.status);
    return res.json();
  }

  // ------------------------------------------------------------------
  // loading
  // ------------------------------------------------------------------

  async function boot(dataBase, opts = {}) {
    DATA_BASE = dataBase;
    REGISTRY = (typeof window !== "undefined" && window.LANGUAGE_META) || [{ code: "en" }];
    const meta = await fetchJson(dataBase + "/library/meta.json");
    CLASS_LIST = meta.classes;
    ROWS = meta.rows.map(([n, name, cls, rating, refs]) => ({ n, id: idOf(n), name, cls, rating, refs }));
    BY_NUM = new Map(ROWS.map((r) => [r.n, r]));
    REVERSE = new Map();
    for (const r of ROWS) {
      for (const t of r.refs) {
        if (!REVERSE.has(t)) REVERSE.set(t, []);
        REVERSE.get(t).push(r.n);
      }
    }
    LANGS = {};
    COMMANDS = {};
    const wanted = new Set(["en", ...(opts.langs || [])]);
    await Promise.all([...wanted].map((code) => ensureLang(code)));
    if (!LANGS.en) throw new Error("Could not load the base language (en).");
    BASE_LANG = "en";
  }

  const LANG_LOADING = {};

  // Loads data/dil/<code>.json (and its fallback chain) once.
  async function ensureLang(code) {
    code = fold(code);
    if (LANGS[code]) return true;
    if (!REGISTRY.some((r) => r.code === code)) return false;
    if (!LANG_LOADING[code]) {
      LANG_LOADING[code] = (async () => {
        try {
          const data = await fetchJson(DATA_BASE + "/dil/" + code + ".json");
          const fb = data.meta && data.meta.fallback;
          if (fb && fb !== code) await ensureLang(fb);
          LANGS[code] = data;
          for (const [word, canonical] of Object.entries(data.commands || {})) {
            COMMANDS[fold(word)] = canonical;
          }
          return true;
        } catch (err) {
          console.warn("Failed to load language data for", code, err);
          return false;
        } finally {
          delete LANG_LOADING[code];
        }
      })();
    }
    return LANG_LOADING[code];
  }

  async function articleOf(n) {
    const c = Math.floor(n / 100);
    if (!CHUNKS[c]) {
      CHUNKS[c] = fetchJson(DATA_BASE + "/library/c" + String(c).padStart(2, "0") + ".json")
        .catch((err) => { delete CHUNKS[c]; throw err; });
    }
    const chunk = await CHUNKS[c];
    return chunk[idOf(n)] || null;
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
    for (const code of langChain((STATE && STATE.lang) || BASE_LANG)) {
      let node = LANGS[code];
      let ok = true;
      for (const step of path) {
        if (node && typeof node === "object" && step in node) node = node[step];
        else { ok = false; break; }
      }
      if (ok && node !== null && node !== undefined && node !== "") return node;
    }
    if (dflt !== undefined) return dflt;
    return path.join("/");
  }

  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

  // ------------------------------------------------------------------
  // state
  // ------------------------------------------------------------------

  function newState(langcode) {
    return {
      lang: langcode, clearance: 1, contam: 0, day: 1,
      read: [], findings: [], mail_read: [], amnestics: 0,
      thresholds_fired: [], cure_used: 0, fast: false, turns: 0, xp: 0, rank_seen: 0,
    };
  }

  function getState() { return STATE; }
  function setState(s) { STATE = s; }

  function rankIndex(xp) {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].at) idx = i;
    return idx;
  }

  function rankName(idx) {
    if (idx === undefined) idx = rankIndex(STATE.xp);
    return T("ranks", RANKS[idx].id);
  }

  const levelFor = (xp) => Math.min(RULES.clearance_max, rankIndex(xp) + 1);
  const rowFor = (id) => { const m = /^SCP-(\d{3,4})$/.exec(id); return m ? BY_NUM.get(parseInt(m[1], 10)) : undefined; };
  const need = (row) => NEED[row.cls] || 1;
  const accessible = (id) => { const r = rowFor(id); return !!r && STATE.clearance >= need(r); };

  function addXp(amount, lines) {
    if (!amount) return;
    STATE.xp += amount;
    const idx = rankIndex(STATE.xp);
    if (idx > (STATE.rank_seen || 0)) {
      STATE.rank_seen = idx;
      const before = STATE.contam;
      STATE.contam = Math.max(0, STATE.contam - RULES.rank_commendation_relief);
      STATE.thresholds_fired = STATE.thresholds_fired.filter((t) => t <= STATE.contam);
      lines.push({ text: "", cls: "" });
      lines.push({ text: "  >> " + T("ui", "rank_up").replace("{rank}", rankName(idx)), cls: "cyan", anim: true, animSpeed: 14 });
      if (before > STATE.contam) {
        lines.push({ text: T("ui", "rank_up_relief").replace("{n}", String(before - STATE.contam)), cls: "dim cyan" });
      }
      const lvl = levelFor(STATE.xp);
      if (lvl > STATE.clearance) {
        STATE.clearance = lvl;
        lines.push({ text: "  " + T("ui", "code_ok").replace("{n}", String(lvl)), cls: "bold cyan" });
      }
    }
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
    if (STATE.contam >= RULES.contam_max) {
      STATE.contam = RULES.overload_reset;
      STATE.thresholds_fired = STATE.thresholds_fired.filter((t) => t <= STATE.contam);
      lines.push({ text: "", cls: "" });
      lines.push({ text: T("ui", "lib_overload"), cls: "bold red" });
    }
  }

  function glitch(text) {
    const floor = RULES.contam_glitch_floor;
    if (STATE.contam < floor) return text;
    const rate = (STATE.contam - floor) / 260.0;
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i++) {
      if (/\p{L}/u.test(chars[i]) && Math.random() < rate) {
        chars[i] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      }
    }
    return chars.join("");
  }

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------

  const pairKey = (a, b) => (a < b ? idOf(a) + "|" + idOf(b) : idOf(b) + "|" + idOf(a));

  function parsePair(key) {
    const m = /^SCP-(\d{3,4})\|SCP-(\d{3,4})$/.exec(key);
    if (!m) return null;
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    return BY_NUM.has(a) && BY_NUM.has(b) && a < b ? [a, b] : null;
  }

  function linked(a, b) {
    const ra = BY_NUM.get(a), rb = BY_NUM.get(b);
    return !!ra && !!rb && (ra.refs.includes(b) || rb.refs.includes(a));
  }

  function resolve(arg) {
    const m = /^(?:scp-?)?0*(\d{1,4})$/i.exec(String(arg).trim());
    if (!m) return null;
    return BY_NUM.get(parseInt(m[1], 10)) || null;
  }

  // Links between articles the player has read and not yet recorded.
  function readyPairs() {
    const read = new Set(STATE.read);
    const done = new Set(STATE.findings);
    const out = [];
    const seen = new Set();
    for (const id of STATE.read) {
      const row = rowFor(id);
      if (!row) continue;
      for (const t of row.refs) {
        const other = BY_NUM.get(t);
        if (!other || !read.has(other.id)) continue;
        const key = pairKey(row.n, t);
        if (done.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push({ a: idOf(Math.min(row.n, t)), b: idOf(Math.max(row.n, t)), finding: key });
      }
    }
    return out;
  }

  const classCap = (c) => c.charAt(0).toUpperCase() + c.slice(1);

  function rowLine(row) {
    const isRead = STATE.read.includes(row.id);
    const locked = STATE.clearance < need(row);
    const mark = isRead ? T("ui", "mark_read") : (locked ? T("ui", "lib_locked_mark").replace("{n}", String(need(row))) : "");
    return {
      text: `  ${row.id.padEnd(9)} ${classCap(row.cls).padEnd(12)} ${row.name || ""}${mark ? "   " + mark : ""}`,
      cls: locked && !isRead ? "dim darkgreen" : "",
    };
  }

  function sentenceAbout(text, n) {
    const num = String(n).padStart(3, "0");
    const re = new RegExp("(?:^|[.!?\\n])\\s*([^.!?\\n]*\\bSCP-0*" + parseInt(num, 10) + "\\b[^\\n]*?[.!?])(?=\\s|$)", "i");
    const m = re.exec(text);
    let q = m ? m[1].trim() : "";
    if (q.length > 420) q = q.slice(0, 417).trimEnd() + "...";
    return q;
  }

  function newLinkNotice(beforeCount, lines) {
    const now = readyPairs().length;
    if (now > beforeCount) {
      lines.push({ text: T("ui", "lib_new_links").replace("{n}", String(now - beforeCount)), cls: "cyan" });
    }
  }

  // ------------------------------------------------------------------
  // commands
  // ------------------------------------------------------------------

  function cmdHelp() {
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "help_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    for (const l of T("ui", "help_lines")) lines.push({ text: "  " + l, cls: "" });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    return { lines };
  }

  function seriesOf(row) { return Math.floor(row.n / 1000) + 1; }

  function page(rows, args, title, cmdWord, lines) {
    const size = RULES.page_size;
    const total = Math.max(1, Math.ceil(rows.length / size));
    let p = parseInt(args, 10);
    if (!(p >= 1)) p = 1;
    p = Math.min(p, total);
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: title, cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    for (const row of rows.slice((p - 1) * size, p * size)) lines.push(rowLine(row));
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "lib_page").replace("{p}", String(p)).replace("{t}", String(total)).replace("{cmd}", cmdWord + " " + (p < total ? p + 1 : 1)), cls: "dim darkgreen" });
  }

  function cmdList(args, verb) {
    const lines = [];
    const word = verb || "list";
    if (!args.length) {
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      lines.push({ text: T("ui", "list_title").replace("{n}", String(STATE.clearance)), cls: "bold white" });
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      const readSet = new Set(STATE.read);
      for (let s = 1; s <= 5; s++) {
        const inSeries = ROWS.filter((r) => seriesOf(r) === s);
        const nRead = inSeries.filter((r) => readSet.has(r.id)).length;
        lines.push({ text: fill(T("ui", "lib_series_row"), { s, a: String((s - 1) * 1000 || 1).padStart(3, "0"), b: s * 1000 - 1, n: inSeries.length, r: nRead }), cls: "" });
      }
      lines.push({ text: "-".repeat(72), cls: "darkgreen" });
      lines.push({ text: "  " + T("ui", "lib_list_hint"), cls: "dim darkgreen" });
      return { lines };
    }
    const first = fold(args[0]);
    if (/^[1-5]$/.test(first)) {
      const s = parseInt(first, 10);
      page(ROWS.filter((r) => seriesOf(r) === s), args[1], fill(T("ui", "lib_series_title"), { s }), `${word} ${s}`, lines);
      return { lines };
    }
    if (CLASS_LIST.includes(first)) {
      const rows = ROWS.filter((r) => r.cls === first).sort((a, b) => b.rating - a.rating);
      page(rows, args[1], fill(T("ui", "lib_class_title"), { c: classCap(first) }), `${word} ${first}`, lines);
      return { lines };
    }
    lines.push({ text: T("ui", "lib_list_bad").replace("{x}", args[0]), cls: "amber" });
    return { lines };
  }

  function cmdSearch(args) {
    const lines = [];
    if (!args.length) { lines.push({ text: T("ui", "search_usage"), cls: "amber" }); return { lines }; }
    const term = args.join(" ");
    const needle = fold(term);
    const digits = /^\d+$/.test(needle) ? parseInt(needle, 10) : null;
    const hits = ROWS.filter((r) => fold(r.name).includes(needle) || (digits !== null && String(r.n).includes(String(digits))) || fold(r.id).includes(needle))
      .sort((a, b) => b.rating - a.rating);
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "search_title").replace("{x}", term), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    for (const row of hits.slice(0, 40)) lines.push(rowLine(row));
    if (!hits.length) lines.push({ text: "  " + T("ui", "lib_no_match").replace("{x}", term), cls: "dim darkgreen" });
    else if (hits.length > 40) lines.push({ text: "  ...", cls: "dim darkgreen" });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "lib_matches").replace("{n}", String(hits.length)), cls: "dim darkgreen" });
    return { lines };
  }

  async function cmdRead(args) {
    const lines = [];
    if (!args.length) { lines.push({ text: T("ui", "read_usage"), cls: "amber" }); return { lines }; }
    const row = resolve(args[0]);
    if (!row) { lines.push({ text: T("ui", "no_such_file").replace("{x}", args[0]), cls: "amber" }); return { lines }; }
    if (STATE.clearance < need(row)) {
      lines.push({ text: T("ui", "denied").replace("{f}", row.id).replace("{n}", String(need(row))), cls: "red" });
      return { lines };
    }
    let art;
    try { art = await articleOf(row.n); } catch { art = null; }
    if (!art) { lines.push({ text: T("ui", "lib_load_fail"), cls: "amber" }); return { lines }; }

    const before = readyPairs().length;
    const firstTime = !STATE.read.includes(row.id);
    lines.push({ text: "", cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: `  ${row.id}${row.name ? " -- " + row.name : ""}`, cls: "bold white" });
    lines.push({ text: `  ${T("ui", "class_label")}: ${classCap(row.cls)}    ${T("ui", "clearance_label")}: ${need(row)}`, cls: "dim darkgreen" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    const paras = art.text.split(/\n{2,}/);
    paras.forEach((p, i) => {
      lines.push({ text: glitch(p), cls: "green", anim: i >= 2 && i < 4 && p.length > 60, animSpeed: 10 });
      lines.push({ text: "", cls: "" });
    });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "lib_source") + ": https://scp-wiki.wikidot.com/scp-" + String(row.n).padStart(3, "0"), cls: "dim darkgreen" });
    lines.push({ text: "  " + T("ui", "lib_author") + ": " + (art.by || "?") + "    " + T("ui", "lib_rating") + ": " + (row.rating > 0 ? "+" : "") + row.rating, cls: "dim darkgreen" });
    lines.push({ text: "  " + T("ui", "lib_license"), cls: "dim darkgreen" });

    if (firstTime) {
      STATE.read.push(row.id);
      if (row.id === RULES.cure_record) {
        const relief = Math.max(RULES.cure_floor, RULES.cure_first - RULES.cure_step * STATE.cure_used);
        STATE.cure_used++;
        STATE.contam = Math.max(0, STATE.contam - relief);
        STATE.thresholds_fired = STATE.thresholds_fired.filter((t) => t <= STATE.contam);
        lines.push({ text: T("ui", "cure").replace("{n}", String(relief)), cls: "cyan" });
      } else {
        addContam(COST[row.cls] ?? 1, lines);
      }
      addXp(RULES.xp_per_record, lines);
    }
    newLinkNotice(before, lines);
    return { lines };
  }

  async function cmdCross(args) {
    const lines = [];
    if (args.length < 2) { lines.push({ text: T("ui", "cross_usage"), cls: "amber" }); return { lines }; }
    const a = resolve(args[0]), b = resolve(args[1]);
    if (!a || !b) { lines.push({ text: T("ui", "cross_bad"), cls: "amber" }); return { lines }; }
    if (a.n === b.n) { lines.push({ text: T("ui", "cross_same"), cls: "amber" }); return { lines }; }
    for (const r of [a, b]) {
      if (!STATE.read.includes(r.id)) {
        lines.push({ text: T("ui", "cross_unread").replace("{f}", r.id), cls: "amber" });
        return { lines };
      }
    }
    lines.push({ text: "", cls: "" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: "  " + T("ui", "cross_header").replace("{a}", a.id).replace("{b}", b.id), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    if (!linked(a.n, b.n)) {
      lines.push({ text: "  " + T("ui", "lib_cross_nothing"), cls: "dim darkgreen" });
      return { lines };
    }
    const key = pairKey(a.n, b.n);
    const from = a.refs.includes(b.n) ? [a, b] : [b, a];
    let quote = "";
    try {
      const art = await articleOf(from[0].n);
      if (art) quote = sentenceAbout(art.text, from[1].n);
    } catch { /* the link itself is still valid */ }
    const known = STATE.findings.includes(key);
    lines.push({ text: "  " + T("ui", known ? "cross_known" : "cross_match"), cls: known ? "dim darkgreen" : "cyan" });
    lines.push({ text: "", cls: "" });
    lines.push({ text: "  " + fill(T("ui", "lib_link_line"), { a: from[0].id, b: from[1].id }), cls: "bold white" });
    if (quote) lines.push({ text: "  “" + quote + "”", cls: "green", anim: !known, animSpeed: 12 });
    lines.push({ text: "", cls: "" });
    if (!known) {
      const before = readyPairs().length;
      STATE.findings.push(key);
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      addContam(RULES.contam_per_cross, lines);
      addXp(RULES.xp_per_finding, lines);
      void before;
    }
    return { lines };
  }

  function cmdFindings() {
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "lib_findings_title").replace("{n}", String(STATE.findings.length)), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    if (!STATE.findings.length) {
      lines.push({ text: "  " + T("ui", "findings_none"), cls: "dim darkgreen" });
    } else {
      for (const key of STATE.findings.slice(-60)) {
        const p = parsePair(key);
        if (!p) continue;
        lines.push({ text: `  ${idOf(p[0])} <-> ${idOf(p[1])}   ${BY_NUM.get(p[0]).name} / ${BY_NUM.get(p[1]).name}`, cls: "" });
      }
      if (STATE.findings.length > 60) lines.push({ text: "  ...", cls: "dim darkgreen" });
    }
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    return { lines };
  }

  function cmdStatus() {
    const lines = [];
    const idx = rankIndex(STATE.xp);
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "status_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: `  ${T("ui", "st_clearance").padEnd(28)}${STATE.clearance} / ${RULES.clearance_max}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_rank").padEnd(28)}${rankName(idx)}`, cls: "" });
    const next = RANKS[idx + 1];
    lines.push({ text: `  ${T("ui", "st_xp").padEnd(28)}${STATE.xp}   ${next ? T("ui", "xp_next").replace("{n}", String(next.at)) : T("ui", "xp_max")}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_files").padEnd(28)}${STATE.read.length} / ${ROWS.length}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_findings").padEnd(28)}${STATE.findings.length}`, cls: "" });
    lines.push({ text: `  ${T("ui", "st_contam").padEnd(28)}${STATE.contam}%`, cls: STATE.contam >= 70 ? "red" : STATE.contam >= 40 ? "amber" : "" });
    const level = STATE.contam >= 70 ? "high" : STATE.contam >= 40 ? "mid" : "low";
    lines.push({ text: "  " + T("ui", "contam_state", level), cls: "dim darkgreen" });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    return { lines };
  }

  function cmdRest() {
    const lines = [];
    if (STATE.contam <= 0) { lines.push({ text: T("ui", "amn_pointless"), cls: "amber" }); return { lines }; }
    const before = STATE.contam;
    STATE.contam = Math.max(0, STATE.contam - RULES.rest_relief);
    STATE.thresholds_fired = STATE.thresholds_fired.filter((t) => t <= STATE.contam);
    lines.push({ text: T("ui", "lib_rest_done").replace("{n}", String(before - STATE.contam)), cls: "cyan" });
    return { lines };
  }

  function topUnread(pred) {
    const read = new Set(STATE.read);
    return ROWS.filter((r) => !read.has(r.id) && STATE.clearance >= need(r) && (!pred || pred(r)))
      .sort((a, b) => b.rating - a.rating);
  }

  // Unread, reachable articles linked to what the player has read (most rated
  // first), topped up with the most rated unread ones.
  function suggestions(limit) {
    const read = new Set(STATE.read);
    const near = new Map();
    for (const id of STATE.read) {
      const row = rowFor(id);
      if (!row) continue;
      for (const t of [...row.refs, ...(REVERSE.get(row.n) || [])]) {
        const o = BY_NUM.get(t);
        if (o && !read.has(o.id) && STATE.clearance >= need(o)) near.set(o.n, o);
      }
    }
    let list = [...near.values()].sort((a, b) => b.rating - a.rating);
    if (list.length < limit) list = list.concat(topUnread().filter((r) => !near.has(r.n)).slice(0, limit - list.length));
    return list.slice(0, limit);
  }

  function recentRead(limit) {
    return STATE.read.slice(-limit).reverse().map(rowFor).filter(Boolean);
  }

  function cmdRandom() {
    const pool = topUnread();
    if (!pool.length) return { lines: [{ text: T("ui", "lib_random_none"), cls: "amber" }] };
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return cmdRead([pick.id]);
  }

  function cmdHint() {
    const lines = [];
    const ready = readyPairs();
    let msg = null;
    if (ready.length) {
      msg = fill(T("ui", "hint_ready"), { a: ready[0].a, b: ready[0].b });
    } else {
      let best = null, locked = null;
      for (const id of STATE.read) {
        const row = rowFor(id);
        if (!row) continue;
        const neighbours = [...row.refs, ...(REVERSE.get(row.n) || [])];
        for (const t of neighbours) {
          const other = BY_NUM.get(t);
          if (!other || STATE.read.includes(other.id)) continue;
          if (STATE.clearance >= need(other)) {
            if (!best || other.rating > best.other.rating) best = { known: row, other };
          } else if (!locked) locked = row;
        }
      }
      if (best) msg = fill(T("ui", "hint_partner"), { a: best.known.id, b: best.other.id });
      else if (locked) msg = fill(T("ui", "hint_locked"), { a: locked.id });
      else {
        const pool = topUnread();
        msg = pool.length ? fill(T("ui", "lib_hint_random"), { a: pool[0].id }) : T("ui", "hint_none");
      }
    }
    lines.push({ text: "", cls: "" });
    lines.push({ text: "  " + msg, cls: "cyan" });
    lines.push({ text: "  " + T("ui", "hint_cost").replace("{n}", String(RULES.hint_cost)), cls: "dim darkgreen" });
    addContam(RULES.hint_cost, lines);
    return { lines };
  }

  function cmdLang(args) {
    const lines = [];
    if (!args.length) {
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      lines.push({ text: T("ui", "lang_title"), cls: "bold white" });
      lines.push({ text: "=".repeat(72), cls: "darkgreen" });
      for (const entry of REGISTRY) {
        const mark = entry.code === STATE.lang ? "  <<" : "";
        lines.push({ text: `  ${entry.code.padEnd(8)} ${(entry.label || entry.code).padEnd(26)}${mark}`, cls: "" });
      }
      lines.push({ text: "-".repeat(72), cls: "darkgreen" });
      lines.push({ text: T("ui", "lang_hint"), cls: "dim darkgreen" });
      return { lines };
    }
    const code = fold(args[0]);
    if (!LANGS[code] && REGISTRY.some((r) => r.code === code)) return { lines, loadLang: code };
    if (!LANGS[code]) { lines.push({ text: T("ui", "lang_bad").replace("{x}", args[0]), cls: "amber" }); return { lines }; }
    STATE.lang = code;
    lines.push({ text: T("ui", "lang_switched"), cls: "cyan" });
    return { lines };
  }

  function cmdSpeed() {
    STATE.fast = !STATE.fast;
    return { lines: [{ text: T("ui", STATE.fast ? "speed_fast" : "speed_slow"), cls: "cyan" }] };
  }

  function cmdAbout() {
    const lines = [];
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    lines.push({ text: T("ui", "about_title"), cls: "bold white" });
    lines.push({ text: "=".repeat(72), cls: "darkgreen" });
    for (const l of T("ui", "lib_about_lines")) lines.push({ text: l ? "  " + l : "", cls: "" });
    lines.push({ text: "  " + `${ROWS.length} ${T("ui", "ab_records")} / ${REGISTRY.length} ${T("ui", "ab_languages")}`, cls: "dim darkgreen" });
    lines.push({ text: "-".repeat(72), cls: "darkgreen" });
    return { lines };
  }

  const DISPATCH = {
    help: cmdHelp, list: cmdList, read: cmdRead, search: cmdSearch, cross: cmdCross,
    findings: cmdFindings, status: cmdStatus, rest: cmdRest, hint: cmdHint, random: cmdRandom,
    lang: cmdLang, speed: cmdSpeed, about: cmdAbout,
    clear: () => ({ lines: [], clearScreen: true }),
  };

  function isYes(word) {
    const yes = new Set();
    for (const data of Object.values(LANGS)) {
      for (const w of (data.ui && data.ui.yes_words) || []) yes.add(fold(w));
    }
    return yes.has(fold(word));
  }

  async function runCommand(raw) {
    raw = raw.trim();
    if (!raw) return null;
    STATE.turns++;
    const parts = raw.split(/\s+/);
    const verb = COMMANDS[fold(parts[0])] || null;
    if (verb === null) {
      return { lines: [{ text: T("ui", "unknown").replace("{x}", parts[0]), cls: "amber" }] };
    }
    if (["save", "load", "quit"].includes(verb)) return { lines: [], hostVerb: verb };
    const fn = DISPATCH[verb];
    if (!fn) return { lines: [{ text: T("ui", "unknown").replace("{x}", parts[0]), cls: "amber" }] };
    return await fn(parts.slice(1), parts[0]);
  }

  function prompt() {
    return `L${STATE.clearance} ${STATE.contam}%`;
  }

  // Cleans a state coming from a save (this browser's, a file, the account):
  // unknown ids from older versions of the game are dropped.
  function loadSanitizedState(data, currentLang) {
    const base = newState(currentLang);
    Object.assign(base, data);
    if (!LANGS[base.lang]) base.lang = currentLang;
    base.read = [...new Set((base.read || []).filter((r) => rowFor(r)))];
    base.findings = [...new Set((base.findings || []).filter((f) => parsePair(f)))];
    base.mail_read = [];
    base.amnestics = 0;
    base.day = 1;
    base.clearance = levelFor(base.xp || 0);
    base.rank_seen = rankIndex(base.xp || 0);
    return base;
  }

  function accessibleRecords() { return ROWS.filter((r) => STATE.clearance >= need(r)).map((r) => r.id); }

  return {
    boot, ensureLang, T, fold, newState, getState, setState,
    runCommand, isYes, prompt, loadSanitizedState,
    accessible, accessibleRecords, readyPairs, resolve, rowFor, need, suggestions, recentRead,
    get ROWS() { return ROWS; },
    get RULES() { return RULES; },
    get RANKS() { return RANKS; },
    get LANGS() { return LANGS; },
    get BASE_LANG() { return BASE_LANG; },
    get CLASS_LIST() { return CLASS_LIST; },
    rankIndex, rankName, idOf, classCap,
  };
})();

// Attach explicitly so module scripts (main.js) can reliably reference it.
window.Engine = Engine;
