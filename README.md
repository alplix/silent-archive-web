# The Silent Archive — Web

Browser-playable version of the terminal SCP investigation game, with
accounts, rank/XP progression, a leaderboard, and resume-where-you-left-off
saves. The game and all content (565 records, 303 findings) are identical
to the original Python/terminal version — this repo just re-implements the
same engine to run client-side, reading the same data files unchanged.

**This is a fully static site.** No server-side code, no SQL, and no
third-party backend at all — everything, including accounts, saved
progress and the leaderboard, lives in this GitHub repo. The site itself
sits on GitHub Pages as plain static files; a small GitHub Actions
workflow is what makes "cloud save" possible without a server.

---

## Live site

**https://alplix.github.io/silent-archive-web/**

The game is always playable in **guest mode** (local browser save only,
no account needed). Entering a GitHub username on the login screen adds
cross-device sync and a public leaderboard — see below for how that works
and its one-time repo setup.

## Run locally

Data files are loaded via `fetch()`, so opening `index.html` directly as
`file://` won't work — any static file server is enough:

```bash
cd silent-archive-web
python3 -m http.server 8000
# open http://localhost:8000
```

## How "accounts" work without a backend

There's no password, no third-party auth provider, no database — just
GitHub itself:

1. On the login screen, a player types their **GitHub username**. This is
   not verified at this point — it only tells the site which save file to
   look for (`data/saves/<username>.json`, read directly from
   `raw.githubusercontent.com`, no auth needed for a public repo).
2. To actually save progress, the player clicks **"Sync to GitHub"** in
   the topbar. This opens a pre-filled *new issue* page on this repo,
   labeled `sync`, with their current progress as a JSON block in the
   body. They review and submit it themselves, from their own logged-in
   GitHub account.
3. `.github/workflows/sync-save.yml` reacts to that issue. It uses the
   issue's real author (`github.event.issue.user.login` — set by GitHub,
   never anything the issue body claims) as the identity, validates the
   payload, and commits `data/saves/<username>.json` plus an updated
   `data/leaderboard.json`. Nothing this repo doesn't already have
   (GitHub's own automatic `GITHUB_TOKEN`) is needed to do this — there is
   no secret to create or paste anywhere.
4. It closes the issue with a ✅ or ❌ comment once done.

This is intentionally a trade-off, not a full accounts system: it's not
password-protected (anyone can type any username and see that public save
or leaderboard entry — there's nothing private here, it's all committed to
a public repo), and syncing is a manual, occasional action rather than
continuous — the always-on save is still plain `localStorage`, exactly
like guest mode. See `js/auth.js` for the full reasoning.

### One-time repo setup (only needed once, by the repo owner)

1. **Settings > Actions > General > Workflow permissions** — select
   "Read and write permissions" (so the sync workflow can commit).
2. Create the `sync` label once: `gh label create sync --color 0e8a16` (or
   **Issues > Labels > New label** in the GitHub UI).

That's it — no accounts to register, no keys to copy anywhere.

## GitHub Pages

In repo settings: **Settings > Pages > Build and deployment > Source:
Deploy from a branch**, branch `main`, folder `/ (root)`. This repo is
laid out to be served as-is from the repository root.

## Architecture

```
index.html                       auth, language, game screens
style.css                        terminal look and feel
js/languages.js                  registry of available languages (add a language here)
js/engine.js                     a faithful JS port of scp.py;
                                  reads manifest.json + dil/*.json unchanged
js/auth.js                       GitHub-native "accounts": username, cloud
                                  save read, leaderboard read, sync-issue opener
js/i18n.js                       site-chrome localization (login form, topbar,
                                  leaderboard, tutorial, toasts)
js/sfx.js                        synthesized sound effects (Web Audio API)
js/main.js                       wires screens together, renders the terminal
data/manifest.json               unchanged copy from the original Python project
data/dil/en.json                 unchanged copies from the original Python project
data/dil/tr.json
data/dil/es.json
data/saves/<username>.json       written by the sync workflow, one per player
data/leaderboard.json            written by the sync workflow
.github/workflows/sync-save.yml  processes "sync" issues into the files above
.github/scripts/sync-issue.js    validates and writes the payload (called by the workflow)
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
- **GitHub-native sync and leaderboard** — no Firebase, no third-party
  service; see "How 'accounts' work" above.
- In guest mode (no username entered), progress is saved only to that
  browser's `localStorage` — no cross-device sync, not included in the
  leaderboard.

## License

SCP Foundation concepts belong to the collaborative
[SCP Wiki](https://scpwiki.com), licensed CC BY-SA 3.0. All prose in this
game is original and shared under the same licence.
