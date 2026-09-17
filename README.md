# The Silent Archive — Web

Browser-playable version of the terminal SCP investigation game, with
accounts, rank/XP progression, a leaderboard, and resume-where-you-left-off
saves. The game and all content (565 records, 303 findings) are identical
to the original Python/terminal version — this repo just re-implements the
same engine to run client-side, reading the same data files unchanged.

**This is a fully static site.** No server-side code, no SQL. Accounts,
saved progress and the leaderboard use a free Firebase project (NoSQL,
hosted by Google — you don't run a server). The site itself sits on
GitHub Pages as plain static files.

---

## Live site

**https://alplix.github.io/silent-archive-web/**

Until Firebase is configured, the game is fully playable in **guest mode**
(local browser save only); accounts/leaderboard activate once
`js/firebase-config.js` is filled in.

## Run locally

Data files are loaded via `fetch()`, so opening `index.html` directly as
`file://` won't work — any static file server is enough:

```bash
cd silent-archive-web
python3 -m http.server 8000
# open http://localhost:8000
```

## Firebase setup (for accounts / leaderboard / cloud save) — optional but recommended

1. Create a free project at https://console.firebase.google.com/.
2. Enable "Email/Password" (and optionally "Google") under
   **Build > Authentication > Sign-in method**.
3. Create a Firestore database (production mode) under
   **Build > Firestore Database**.
4. Register a Web app under **Project settings > General > Your apps**
   and copy the `firebaseConfig` object it gives you.
5. Paste those values into `js/firebase-config.js` (these values are not
   secret — security comes from Firestore Rules, see below).
6. Paste the contents of `firestore.rules` into
   **Firestore Database > Rules** and publish.
7. Commit and push — GitHub Pages redeploys automatically.

## GitHub Pages

In repo settings: **Settings > Pages > Build and deployment > Source:
Deploy from a branch**, branch `main`, folder `/ (root)`. This repo is
laid out to be served as-is from the repository root.

## Architecture

```
index.html             auth, language, game screens
style.css               terminal look and feel
js/languages.js          registry of available languages (add a language here)
js/engine.js             a faithful JS port of scp.py;
                         reads manifest.json + dil/*.json unchanged
js/firebase-config.js   your Firebase project config (you fill this in)
js/auth.js               Firebase Auth/Firestore wrapper: accounts, cloud
                         save, leaderboard
js/i18n.js                site-chrome localization (auth form, topbar,
                         leaderboard, tutorial, toasts)
js/sfx.js                  synthesized sound effects (Web Audio API)
js/main.js                 wires screens together, renders the terminal
data/manifest.json       unchanged copy from the original Python project
data/dil/en.json          unchanged copies from the original Python project
data/dil/tr.json
data/dil/es.json
firestore.rules          paste into Firebase Console > Firestore > Rules
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
- **Language switcher sits above/at the login screen** (top-right dropdown)
  — the selected language covers the login form, topbar, leaderboard and
  all archive content; can also be changed mid-game with `lang <code>`.
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
- In guest mode (no login), progress is saved only to that browser's
  `localStorage` — no cross-device sync, not included in the leaderboard.

## License

SCP Foundation concepts belong to the collaborative
[SCP Wiki](https://scpwiki.com), licensed CC BY-SA 3.0. All prose in this
game is original and shared under the same licence.
