# The Silent Archive — Web

A SCiPNET terminal in the browser for reading the **real SCP Wiki**. The
archive holds 4,954 real SCP Foundation articles (SCP-002 to SCP-4999), each
shown unedited with its author and a link to the original page. The game only
adds the terminal around them: clearance by object class, ranks and experience,
cognitive contamination, and "findings" — the real links between articles.

**No content in this project is invented.** Every article comes from the
[SCP Wiki](https://scp-wiki.wikidot.com) and belongs to its authors (see
[Content and licence](#content-and-licence)).

**The game is a fully static site**: plain files on GitHub Pages, nothing for
players to set up. **Accounts and the leaderboard are a separate optional
add-on** (a tiny Cloudflare Worker, see below). If it is ever unreachable,
retired or full, only those stop — the game and everyone's saved progress keep
working, because they never depended on it. Players can also just play as a
guest.

---

## Live site

**https://alplix.github.io/silent-archive-web/**

## How it plays

- `list` shows the five series; `list 2` or `list keter` pages through a series
  or an object class (most-rated first); `search sculpture` finds articles by
  name or number; `read 173` opens one; `random` picks an unread one.
- **Clearance** depends on rank: level 1 opens Safe (and neutralized/explained)
  files, level 2 adds Euclid, level 3 Keter, level 4 Thaumiel, Apollyon and
  Archon. Locked files show the level they need.
- **Contamination** rises as you read (dangerous classes faster). Above 40% the
  text on screen starts to corrupt. `rest` and reading SCP-999 lower it; at 100%
  an emergency decontamination resets it to 50%.
- **Findings**: when an article names another article you have read, the two
  are linked. `cross A B` records the link, shows the sentence where one names
  the other, and earns experience. `hint` points at the next link for a small
  contamination cost, and the sidebar counts the links you can already record.

## Content and licence

The articles, their text and their authorship belong to the SCP Wiki community
and are licensed **CC BY-SA 3.0**. Every article is displayed with its author,
its rating and a link to the original page, and the project's own code and
interface text are shared under the same licence. Article HTML was converted to
plain text (headings, lists and tables flattened; images, navigation and
collapsible toggles removed); nothing else was changed. The data comes from the
public [scp-data](https://scp-data.tedivm.com) dump of the wiki, and article
names come from the wiki's series pages. Series 6 and later are not included
yet. See [`data/library/NOTICE.md`](data/library/NOTICE.md).

SCP Foundation is a collaborative fiction project; the Foundation's concepts
belong to the SCP Wiki (<https://scpwiki.com>).

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
style.css                 terminal look and feel, themes
js/languages.js           registry of available languages (add a language here)
js/engine.js              the game: commands, clearance, contamination, links;
                          loads the article index and text on demand
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
data/library/meta.json    index of all articles: number, name, class, rating,
                          links to other articles
data/library/cNN.json     article text + author, 100 numbers per file
data/library/NOTICE.md    attribution and conversion notes
data/dil/<code>.json      interface text and command words per language
                          (en, tr, es, fr, de, pt)
```

The interface is available in six languages (English, Türkçe, Español,
Français, Deutsch, Português). **Articles are always shown in their original
English**; only the terminal around them is translated. Adding a language is a
matter of adding `data/dil/<code>.json` (copy `en.json`) and registering it in
`js/languages.js`.

## Other features

- **Colour and themes**: five themes (a multi-hued low-glare default,
  classic green terminal, amber, ice, and a light "paper" theme) cycled with
  the ◐ button; SCP numbers, object classes, redactions, percentages and quoted
  text are colour-coded in the output.
- **Strange events**: the more contaminated the reader, the more the terminal
  misbehaves: lines glitch, phantom text that isn't in the archive appears and
  fades, colours shift, the title bar changes, the connection "drops", a
  heartbeat starts. All cosmetic and temporary; switch it off with the 👁
  button. Flashing effects are skipped when the OS asks for reduced motion.
- **Sound effects and toasts**: short synthesized cues (Web Audio API, no
  audio files) plus toast notifications; toggle sound with the 🔊 button.
- **Typewriter effect**: the first paragraphs of an article reveal with a
  typing animation; click the terminal to finish it, or use `speed` to switch it
  off.
- **"How to play" onboarding**, shown on first start and reopenable from the
  top bar.
