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

## How "accounts" and saving work without a backend

There's no password, no third-party auth provider, no database — just
GitHub itself:

1. On the login screen a player types their **GitHub username**. That only
   tells the site which save file to look for (`saves/<username>.json` on
   the `player-data` branch, read straight from `raw.githubusercontent.com`
   — public, no auth needed).
2. **Auto-save (recommended).** In the topbar, **Sync to GitHub** opens a
   dialog where the player pastes their own *fine-grained personal access
   token* once (repository access: only this repo; permission:
   *Issues: Read and write*). From then on the page keeps a single issue
   titled `sync: auto` up to date through `api.github.com`, with no button
   presses: the first change after a load syncs after ~15 s, then at most
   once every 2 min, plus a last push when the tab is hidden. The token
   also proves who the player is (`GET /user`), so the typed username is
   replaced by the verified one. It lives only in that browser's
   `localStorage`.
3. **Manual fallback.** The same dialog can open a pre-filled *new issue*
   page (`sync: manual`) that the player submits from their logged-in
   GitHub session — no token needed.
4. `.github/workflows/sync-save.yml` reacts to any issue whose title starts
   with `sync:`. It uses the issue's real author
   (`github.event.issue.user.login`, set by GitHub — never anything the
   body claims) as the identity, validates the payload, and commits
   `saves/<username>.json` plus an updated `leaderboard.json` to the
   **`player-data` branch** (not `main`, so saving never triggers a Pages
   rebuild). It reads the issue's *current* body when it runs, so two
   quick edits converge on the newest one. GitHub's own automatic
   `GITHUB_TOKEN` does the writing — there is no secret to create.

Honest limits, on purpose:

- **GitHub won't let an anonymous page write to a repo**, and a browser
  can't do a "Log in with GitHub" popup without a server (GitHub's OAuth
  endpoints don't allow CORS). So automatic saving needs a token from the
  player. Putting the *owner's* token in the page instead would let anyone
  overwrite the whole repo, including the site itself.
- A fine-grained token only reaches repositories its owner can write to, so
  auto-save works for the repo owner and collaborators. Everyone else uses
  the manual fallback. (A classic token with `public_repo` would reach any
  public repo but also grants write access to all of the player's own
  public repos — not recommended.)
- The token is readable by any script running on the same origin
  (`alplix.github.io`), which is why it should be scoped to this one repo
  and to Issues only.
- Everything is public (it's a public repo), and progress/leaderboard values
  are self-reported by the client, so the leaderboard is honor-system.

### One-time repo setup (only needed once, by the repo owner)

1. **Settings > Actions > General > Workflow permissions** — select
   "Read and write permissions" (so the workflow can commit).
2. The `player-data` branch must exist (it holds `leaderboard.json` as
   `{}` initially). Nothing else to configure.

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
js/auth.js                       GitHub-native "accounts": username, token,
                                  save/leaderboard reads, auto-save + manual sync
js/i18n.js                       site-chrome localization (login form, topbar,
                                  leaderboard, tutorial, toasts)
js/sfx.js                        synthesized sound effects (Web Audio API)
js/main.js                       wires screens together, renders the terminal
data/manifest.json               unchanged copy from the original Python project
data/dil/en.json                 unchanged copies from the original Python project
data/dil/tr.json
data/dil/es.json
data/dil/fr.json
.github/workflows/sync-save.yml  turns "sync:" issues into saves/ + leaderboard.json
                                  on the player-data branch
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
- **Automatic GitHub save and leaderboard** — no Firebase, no third-party
  service; see "How accounts and saving work" above.
- In guest mode (no username entered), progress is saved only to that
  browser's `localStorage` — no cross-device sync, not included in the
  leaderboard.

## License

SCP Foundation concepts belong to the collaborative
[SCP Wiki](https://scpwiki.com), licensed CC BY-SA 3.0. All prose in this
game is original and shared under the same licence.
