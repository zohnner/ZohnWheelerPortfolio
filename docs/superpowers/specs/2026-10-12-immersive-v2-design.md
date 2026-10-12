# Immersive Portfolio v2 — Design

**Date:** 2026-10-12
**Status:** Approved in brainstorming, awaiting written-spec review
**Branch:** `immersive-v2`
**Builds on:** `docs/superpowers/specs/2026-10-11-immersive-portfolio-design.md` (v1, shipped to `main`). Everything in v1 stays unless this spec changes it.

## Goal

Make the homepage feel like a real old-school terminal, and make the AI feel
like the operator of the whole experience rather than a caption beside it.
Two phases ship in this spec:

1. **Terminal immersion:** CRT physics, power on/off, a BIOS self-test with
   the visitor's real hardware, text-mode windows with ASCII-art screenshots,
   a virtual filesystem, and commands wired to live data.
2. **AI operator:** the AI types into the terminal, reacts to the visitor,
   scans projects live, answers plain-English questions from a scripted
   knowledge base, and tells the true story of how it was built.

**Out of scope:** a real language model (decided later), voice (stays off
behind `VOICE_ENABLED`), changes to `/classic/`, `hire.html`, `resume.html`.

## Constraints (unchanged from v1 unless noted)

- No paid APIs. No build step. Plain HTML, CSS, ES modules in `public/`.
- No new client libraries. Three.js stays the only CDN dependency.
- Page weight before the orb loads: 250 KB or less.
- Storage access always wrapped in try/catch.
- Visible copy never uses gendered pronouns for Zohn.
- Everything shown as "live" must be real. Where data is unavailable, say so
  honestly instead of inventing it.
- Visitor device details are read in the browser, shown only to that
  visitor, and never sent anywhere.
- Photosensitivity: no element flashes more than 3 times per second; CRT
  flicker changes opacity by 3% or less (WCAG 2.3.1).

## Experience

### Act 0: power on (new)

The screen starts black. A thin white horizontal line appears in the middle,
blooms vertically into the full screen (about 400 ms), and the CRT settles.
The CRT treatment applies to the whole page for the rest of the visit:

- Screen curvature: rounded corners plus a dark radial vignette overlay.
- Scanlines (existing) plus a slow rolling bright band (about 8 s per pass).
- Faint flicker (opacity 0.97–1.0, irregular, under 3 Hz).
- Phosphor afterglow on terminal text (layered text-shadow).
- A brief color-split glitch when windows open.

Leaving for `/classic/` (command or link) first collapses the screen to a
horizontal line, then to a dot (about 300 ms), then navigates.

### Act 1: BIOS self-test (new)

Before the OS boot lines, a POST screen runs (about 2.5 s, skippable like
the rest of the boot):

```
ZW-BIOS v5.1  (c) Zohn Wheeler
Memory test: 8192 MB OK
CPU: 8 logical cores detected
GPU: ANGLE (NVIDIA GeForce RTX 3070)
Display: 2560x1440 @2x
Browser: Chrome 141 on Windows
Locale: en-US, 22:41 local
Booting ZW-OS...
```

Every value is read from the visitor's own browser:
`navigator.hardwareConcurrency`, `navigator.deviceMemory` (Chromium only;
the line is omitted when absent), the WebGL unmasked renderer (omitted when
blocked), `screen.width/height` and `devicePixelRatio`,
`navigator.userAgentData` or a minimal user-agent parse, the locale and
the local time. The memory line counts up to its final value.

The `/api/status` fetch starts at the same moment, so its latency is hidden
behind the BIOS screen. Boot lines from v1 then follow unchanged.

### Act 2–3: the AI operates the terminal (changed)

The floating caption under the orb is removed. The AI speaks **in the
terminal**:

```
zw-core> Hello. I'm ZW-Core, the system Zohn Wheeler built to make introductions.
```

- Each AI line is preceded by a short thinking indicator (`zw-core> ...`,
  300–600 ms), then typed character by character in a distinct color.
- The orb follows the AI's state: `thinking` (fast shallow pulse),
  `speaking` (current), `idle`, `focus` (project color), and `alert` (red
  tint while any project's health is `down`).
- Screen readers get each AI line once, in full, through the existing
  `aria-live` region. The typing line is `aria-hidden` until complete.
- The hire/build fork, tracks, rings and returning-visitor flow stay as in v1.

### Act 4: text-mode project windows (changed)

The project panel becomes a box-drawn text-mode window:

```
╔═[ SportStrata ]════════════════════════[x]╗
║ <ASCII-art screenshot>                    ║
║ Full-stack MLB analytics platform ...     ║
║ stack: JavaScript · Cloudflare Workers    ║
║ [ Live ]  [ GitHub ]  [ Case study ]      ║
╚═══════════════════════════════════════════╝
```

- Frame characters are drawn by CSS and generated strings; the content
  inside stays real HTML (heading, list, links, close button), so it remains
  accessible and clickable.
- The screenshot is rendered as ASCII art in the browser from the existing
  thumbnail (`/thumb-*.jpg`) via a canvas, about 64 columns on desktop and
  40 on phones, cached per image. It is `aria-hidden`; the window keeps a
  text description. Projects without a thumbnail show `[ no image on file ]`.
- An ASCII banner of "ZOHN WHEELER" is shown once at the end of the boot.

### Phosphor color (new)

`color green|amber|white` switches the terminal palette (green `#3dff9a`,
amber `#ffb000`, white `#e8e8e8`). The choice is remembered in
`localStorage` (`zw_color`). Default green.

## Commands

All v1 commands stay. New and changed:

| Command | Behavior |
|---|---|
| `cd <path>`, `ls [path]`, `cat <file>`, `tree`, `pwd` | Navigate a virtual filesystem built from `content.js`. The prompt shows the current directory: `guest@zw-os:~/projects$`. |
| `man zohn` | A man-page formatted profile (NAME, SYNOPSIS, DESCRIPTION, SKILLS, SEE ALSO). |
| `open <project or path>` | As v1; also accepts `projects/<id>`. |
| `ping <project>` | Real latency from the visitor's browser: four `no-cors` fetches to the project's live URL, printed like `ping` output, with a summary line. A 3 s timeout prints `Request timed out.` Projects without a live URL print an honest error. |
| `git log [-n N]` | Real recent public commits (default 5, max 10) from `/api/gitlog`. |
| `top` | Projects as processes: PID, NAME, STATUS, LATENCY, STACK, from `/api/status`. No invented uptime. |
| `scan <project>` | Streams a progress bar, then real repo stats from `/api/scan` (languages with percentages, commit count, last push, stars), then a templated AI verdict line derived only from those stats. |
| `history` | The AI tells how this site was built, from `public/xp/buildlog.json` (real git data). |
| `color <name>` | Phosphor palette, as above. |
| `sound` | As now: "voice module offline. captions only for now." |
| anything else | See *Plain-English questions*. |

Tab completion extends to filesystem paths and project ids.

### Virtual filesystem

```
~/
├── about.txt          bio
├── contact.txt        email, LinkedIn, GitHub, quote form
├── resume             link file → /resume.html
└── projects/
    └── <id>/
        ├── README     story, stack
        └── links      the project's links
```

Paths support `.`, `..`, `~`, absolute and relative forms. Errors mimic a
shell: `cd: no such file or directory: foo`, `cat: projects: Is a directory`.

## Plain-English questions

Input that is not a known command is routed:

1. If it is one word within edit distance 2 of a command, path or project
   id: `command not found: opne. did you mean 'open'?`
2. Otherwise it is treated as a question and scored against a knowledge base
   in `content.js` (`KB`: about 15 entries, each with keywords and a reply;
   topics such as stack, experience, clearance, location, availability,
   hiring, Sitekit, each project, AI workflow, this site, education,
   contact). The best entry above a threshold answers as an AI line.
3. Below the threshold the AI says it doesn't have that on file and suggests
   topics and `help`.

Replies never invent facts: every KB reply is written from content that
already exists in the portfolio.

## AI reactions

- **Idle nudge:** after 45 s without input, once per page view, the AI
  suggests a next step that fits the track (for example `try 'scan sportstrata'`).
- **Memory:** the last opened project is remembered (`zw_last_project`).
  Returning visitors hear it: `Welcome back. Last time you looked at BotChase.`
- **Repeat interest:** opening the same project twice in a session gets one
  short aside.
- **Down alert:** if `/api/status` reports a project `down`, the orb shows
  `alert` and the AI mentions it honestly once.
- **Screensaver:** after 90 s idle, a matrix-rain canvas in the current
  phosphor color fills the core window; any key, click or tap dismisses it.
  It never starts while a project window is open or while the tab is hidden.

## Architecture

New units, each with one job. Pure logic is separated from DOM code so it
can be unit tested in Node.

| File | Kind | Responsibility |
|---|---|---|
| `public/xp/crt.js` | DOM | Power on/off sequence, glitch pulse, phosphor palette apply/persist |
| `public/xp/bios.js` | pure + DOM reader | `readDevice()` (browser APIs) and pure `formatPost(device)` → lines |
| `public/xp/fs.js` | pure | `buildTree(content)`, `resolvePath(cwd, input)`, `ls`, `cat`, `cd`, `tree`, `completePath` |
| `public/xp/tui.js` | pure | Box-drawing helpers: `frame(title, cols)`, `rule(cols)`, `bar(fraction, cols)` |
| `public/xp/ascii.js` | pure + DOM wrapper | Pure `toAscii(gray, w, h, cols, ramp)` → lines; `imageToAscii(src, cols)` canvas wrapper with cache |
| `public/xp/operator.js` | DOM | The AI's voice in the terminal: `say(idOrText)`, thinking indicator, mood → core state, live-region announcement |
| `public/xp/answers.js` | pure | `answer(input, kb)` scoring, `suggest(word, candidates)` edit distance |
| `public/xp/reactions.js` | DOM | Idle timer, nudges, visit memory, screensaver lifecycle |
| `public/xp/screensaver.js` | DOM | Matrix-rain canvas |
| `public/xp/live.js` | pure formatting + fetch | Formatting for `ping`, `git log`, `top`, `scan` output; client fetchers |
| `public/xp/buildlog.json` | data | Generated by `scripts/build-log.mjs`, committed |
| `public/xp/voice.js` | DOM | Replaces `narrator.js`: audio-only clip player, used only when `VOICE_ENABLED` |
| `server/github.mjs` | server lib | Shared GitHub fetch helper: headers, optional `GITHUB_TOKEN`, timeout, edge cache |
| `functions/api/gitlog.js` | function | `GET /api/gitlog` |
| `functions/api/scan.js` | function | `GET /api/scan?id=<projectId>` |
| `scripts/build-log.mjs` | script | Writes `buildlog.json` from `git log` |

Changed units: `main.js` (wires the new units; the act order lives here),
`terminal.js` (prompt with cwd, AI line style, path completion hook),
`core.js` (adds `thinking` and `alert` states), `content.js` (adds `repo`
per project, `KB`, `MAN`, `BANNER`), `index.html` and `xp.css` (CRT layers,
text-mode window, caption removed), `functions/api/status.js` (moves its
GitHub code into `server/github.mjs`). `narrator.js` is replaced by
`voice.js` plus `operator.js`.

### Endpoints

All endpoints always return HTTP 200 JSON, never log visitor data, and use
the edge Cache API. GitHub calls send `Authorization: Bearer <GITHUB_TOKEN>`
only when that env var is set (a free fine-grained token with public-repo
read access lifts the rate limit from 60 to 5,000 requests per hour).

- `GET /api/gitlog` → `{ commits: [{ sha7, date, repo, message }] }`, the 10
  newest commits across the account's 3 most recently pushed public repos.
  Cache 600 s. `commits: []` on any error.
- `GET /api/scan?id=<projectId>` → `{ ok, id, repo, languages: {name: pct},
  commits, pushedAt, stars }`. Only ids with a `repo` in `content.js` are
  accepted; others return `{ ok: false, error: "unknown project" }`. Commit
  count comes from the `Link` header of a `per_page=1` commits request.
  Cache 3600 s per id. `{ ok: false }` on any upstream error.
- `GET /api/status` → unchanged shape.

### Build log

`scripts/build-log.mjs` reads `git log` for the immersive files and writes
`{ commits, firstDate, lastDate, coAuthors: [..], filesChanged,
insertions, deletions, tests }` to `public/xp/buildlog.json`. It is run by
hand before a deploy and its output is committed. The `history` narration is
a template filled only from these numbers.

## Failure handling

| Failure | Behavior |
|---|---|
| A device API is missing or blocked | That BIOS line is omitted |
| `/api/gitlog` or `/api/scan` fails | The AI says the data link is unavailable; no invented numbers |
| `ping` target unreachable | `Request timed out.` per attempt, honest summary |
| Thumbnail fails to load | `[ no image on file ]` in the window |
| `buildlog.json` missing | `history` says the build log is unavailable |
| Canvas unavailable | No ASCII art, no screensaver; everything else works |
| Reduced motion | Unchanged: redirect to `/classic/` |

## Testing

- **Unit (Node, `npm test`):** `bios.formatPost`, every `fs.js` function,
  `tui.js`, `ascii.toAscii`, `answers.answer` and `answers.suggest`, the
  `live.js` formatters, `/api/gitlog`, `/api/scan`, the refactored
  `/api/status` (existing tests must keep passing), the shared GitHub helper
  (token header only when set), and `content.js` integrity for `KB`, `MAN`
  and `repo` fields.
- **Browser pass (Chrome DevTools MCP):** power on/off, BIOS lines, AI typing
  in the terminal, each new command, text-mode window with ASCII art at
  desktop and 390 px, color switch persistence, idle nudge, screensaver
  start/dismiss, CLS still under 0.1 on first and returning visits, no
  console errors, Lighthouse accessibility still 100.
