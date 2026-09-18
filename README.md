# The Silent Archive — Web

Browser-playable version of the terminal SCP investigation game, with
rank/XP progression and automatic resume-where-you-left-off saves. The game
and all content (565 records, 303 findings, four languages) are identical to
the original Python/terminal version — this repo just re-implements the same
engine to run client-side, reading the same data files unchanged.

**This is a fully static site.** No server, no database, no accounts, no
third-party service, nothing to configure. It is plain files on GitHub Pages,
so it keeps working for as long as GitHub Pages does.

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

### Why there is no account system or shared leaderboard

A page on GitHub Pages can't write anything to a shared place on its own:
GitHub doesn't let anonymous pages write to a repository (and a token
embedded in the page would let anyone overwrite the whole repo, including the
site), and a browser can't do a "Log in with GitHub" popup without a server.
A shared leaderboard or cross-device accounts therefore always need either a
server/service the owner runs, or a credential from every player. This project
deliberately chooses neither, so saving is local plus the optional save file.

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
                          tutorial, toasts, save-file dialog)
js/sfx.js                 synthesized sound effects (Web Audio API)
js/main.js                wires screens together, renders the terminal,
                          autosave and the save file
data/manifest.json        unchanged copy from the original Python project
data/dil/en.json          unchanged copies from the original Python project
data/dil/tr.json
data/dil/es.json
data/dil/fr.json
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
- **Four languages** (English, Türkçe, Español, Français) chosen from the
  dropdown at the top right, on every screen; it covers the whole site and
  all archive content, and can also be changed mid-game with `lang <code>`.
  Adding a language is a matter of dropping a new `data/dil/<code>.json`
  file and registering it in `js/languages.js` — see that file's comment
  for the full checklist.
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
