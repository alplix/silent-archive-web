# The Silent Archive — Web

Browser-playable version of the terminal SCP investigation game, with
rank/XP progression, automatic resume-where-you-left-off saves and a
leaderboard. The game and all content (565 records, 303 findings, six
languages) are identical to the original Python/terminal version — this repo
just re-implements the same engine to run client-side, reading the same data
files unchanged.

**The game is a fully static site**: plain files on GitHub Pages, nothing for
players to set up. **Accounts and the leaderboard are a separate optional
add-on** (a tiny Cloudflare Worker, see below). If it is ever unreachable,
retired or full, only those stop — the game and everyone's saved progress keep
working, because they never depended on it. Players can also just play as a
guest.

---

## Live site

**https://alplix.github.io/silent-archive-web/**

## Run locally

Data files are loaded via `fetch()`, so opening `index.html` directly as
`file://` won't work — any static file server is enough:

```bash
cd silent-archive-web
python3 -m http.server 8000
# open http://localhost:8000
```

## Saving

- **Automatic.** Progress is written to the browser (`localStorage`) the
  moment anything changes, and the game reopens exactly where the player
  stopped — no login, no button. Players who have never played see a start
  screen with a single **Play** button; returning players go straight back in.
- **Moving between devices / backups.** The **Save file** button in the top
  bar downloads progress as a `.json` file and loads one back in on another
  device or browser. It is optional and never needed for normal play. Loaded
  files are sanitized (only the game's known fields, with clamped values).

## Accounts and leaderboard (optional add-on)

Nothing is required of players: while they play, the page uploads their
progress (best XP, findings, a name) in the background, throttled to at most
one upload every 3 minutes plus a last one when the tab is hidden.

- **Guest** (default): the browser makes a random 128-bit key on first use and
  the server stores only its SHA-256, so nobody can write to someone else's
  entry. The name defaults to a random `Auditor-XXXX` and can be changed in
  the leaderboard dialog.
- **Account** (optional, username + password): the key is derived from them
  in the browser with PBKDF2 (200,000 rounds), so the password never leaves
  the device and the same credentials restore the same progress on any device.
  The username is unique (case-insensitive) and becomes the leaderboard name.
  There is no e-mail, so there is **no password recovery**. On sign-in, the
  save with more turns played wins (the player is asked if it would replace
  different progress on the device).

The player's name (account or guest) also appears in the "Welcome,
Researcher …" line of the intro.

The server is [`worker/`](worker/): a Cloudflare Worker with one KV entry per
player (no SQL). It validates every upload against the game's real limits and
never stores anything but the game's known fields; the leaderboard is still
honor-system because the game runs in the player's browser.

Data shared with the server: the key's hash, the display name, and the
game-progress numbers. Nothing else.

**Deploying your own copy** (free plan, no credit card):

```bash
cd worker
npx wrangler login          # once; opens the browser to sign in / allow
npx wrangler deploy         # creates the KV namespace on first deploy
node smoke-test.mjs https://<your-worker>.workers.dev https://<you>.github.io
```

A new `workers.dev` address can take a few minutes before its certificate is
ready. Then set `API_BASE` in `js/cloud.js` and the allowed site origins in
`worker/wrangler.toml` (`ALLOWED_ORIGINS`). Free-plan limits worth knowing:
KV allows about 1,000 writes/day, which is why uploads are throttled.

## GitHub Pages

In repo settings: **Settings > Pages > Build and deployment > Source:
Deploy from a branch**, branch `main`, folder `/ (root)`. This repo is
laid out to be served as-is from the repository root.

## Architecture

```
index.html                start screen, game screen, modals
style.css                 terminal look and feel
js/languages.js           registry of available languages (add a language here)
js/engine.js              a faithful JS port of scp.py;
                          reads manifest.json + dil/*.json unchanged
js/i18n.js                site-chrome localization (start screen, top bar,
                          tutorial, toasts, dialogs)
js/sfx.js                 synthesized sound effects (Web Audio API)
js/atmosphere.js          the "strange events": glitches, phantom text,
                          colour shifts, blackouts (cosmetic only)
js/main.js                wires screens together, renders the terminal,
                          autosave, the save file and leaderboard upload
js/cloud.js               accounts + leaderboard client (the only file that
                          talks to the Worker)
worker/                   the optional accounts/leaderboard server
                          (Cloudflare Worker)
data/manifest.json        unchanged copy from the original Python project
data/dil/en.json          unchanged copies from the original Python project
data/dil/tr.json
data/dil/es.json
data/dil/fr.json
data/dil/de.json
data/dil/pt.json
```

## Features

- **Sidebar**: an always-visible status panel (clearance, day, findings
  count, contamination and XP bars), and a clickable, searchable record
  browser with separate Records/Findings tabs — click to read a record,
  check two you've read and hit "Compare" to cross-reference them; typing
  commands still works, it's just no longer required.
- **Sound effects and toasts**: short synthesized cues (Web Audio API, no
  audio files) plus animated toast notifications for new findings,
  rank-ups, and rising/critical contamination — toggle sound off with the
  🔊 button in the topbar. A contamination "tension vignette" overlay adds
  visual pressure as the day and contamination meters climb.
- **Six languages** (English, Türkçe, Español, Français, Deutsch, Português) chosen from the
  dropdown at the top right, on every screen; it covers the whole site and
  all archive content, and can also be changed mid-game with `lang <code>`.
  Only English (the fallback) and the chosen language are downloaded, others
  load on demand, so the first visit stays light.
  Adding a language is a matter of dropping a new `data/dil/<code>.json`
  file and registering it in `js/languages.js` — see that file's comment
  for the full checklist.
- **Colour and themes**: five themes (a multi-hued low-glare default,
  classic green terminal, amber, ice, and a light "paper" theme) cycled with
  the ◐ button; SCP numbers, object classes, redactions, percentages, access
  keys and quoted speech are colour-coded in the output.
- **Strange events**: the longer the player reads (contamination), the more
  the terminal misbehaves: lines glitch, phantom text that isn't in the game
  appears and fades, colours shift, the title bar changes, the connection
  "drops", a heartbeat starts. It is all cosmetic and temporary, never touches
  the game state, can be switched off with the 👁 button and skips flashing
  effects when the OS asks for reduced motion.
- **Hints**: the sidebar counts contradictions you can already record
  ("Ready to compare"); the `hint` command points at the next one at the cost
  of a little contamination.
- **Endings tracker**: which endings this browser has reached (and whether
  with a full set of findings), under the Endings button.
- **Typewriter effect**: record/finding/mail text, day narratives and
  endings reveal with a flowing "typing" animation (a web port of the
  original terminal's `slow()` calls); clicking the terminal instantly
  finishes the line currently animating.
- **"How to play" onboarding** — auto-shown on first game start, explaining
  the goal, object classes, clearance levels, contamination, the
  finding/cross-reference mechanic and the 11-day clock; reopenable
  anytime from the topbar button.

## License

SCP Foundation concepts belong to the collaborative
[SCP Wiki](https://scpwiki.com), licensed CC BY-SA 3.0. All prose in this
game is original and shared under the same licence.
