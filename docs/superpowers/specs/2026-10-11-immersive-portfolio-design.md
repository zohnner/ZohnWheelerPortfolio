# Immersive Portfolio — Design

**Date:** 2026-10-11
**Status:** Approved in brainstorming, awaiting written-spec review
**Branch:** `immersive-portfolio`

## Goal

Replace the portfolio homepage with an immersive experience that does not feel
like a website. A CRT terminal types "who is zohn_wheeler", boots using real
live data from the stack, then opens a Jarvis-style AI core. The experience
must prove full-stack capability by showing it working, not by claiming it.

## Audiences

Two audiences, one story, forked after the boot:

- **Employers** ("hire"): engineering depth, stack, résumé, featured projects.
- **Clients** ("build"): Sitekit demos, results, "start a project" path.

The core asks: *"Are you here to hire me, or to have me build something?"*
The choice reorders the project rings and changes the narration. A visitor can
switch tracks at any time with `track hire` / `track build` or a visible toggle.

## Constraints

- **No paid APIs.** No Claude API and no paid TTS. Free and local tooling only.
- **No build step.** Plain HTML, CSS and ES modules in `public/`, matching the
  current repo. Three.js is loaded as a pinned ES module from a CDN.
- **Hosting:** the existing Cloudflare Pages project (`wrangler.jsonc`), with
  Pages Functions in `functions/api/`.
- **Captions first.** Every spoken line is fully readable as text. Sound is
  muted until the visitor turns it on. Nothing depends on audio.

## Experience flow

1. **Boot.** The visitor lands on `/`. A CRT terminal with scanlines and
   phosphor glow types `> who is zohn_wheeler` with human-like timing,
   including one typo that is backspaced. Escape, any key, or the visible
   "skip intro" button jumps to step 3. Returning visitors skip to step 3
   automatically, using a flag in `localStorage` wrapped in try/catch.
2. **Live system check.** Boot lines stream from `/api/status`: the visitor's
   round-trip latency, their city, the latest public commit, and health checks
   on the three featured projects, each ending in `[ OK ]`, `[ SLEEP ]` or
   `[ DOWN ]`. If the endpoint is slow or fails, scripted fallback lines play.
3. **AI core opens.** A window glitches open over the terminal showing the
   particle orb. A captioned greeting introduces Zohn in one sentence and asks
   the hire-or-build question.
4. **Track view.** Project rings orbit the core, ordered by track. Selecting a
   ring focuses it: the orb takes the project's color, and a panel shows a
   screenshot, stack, a one-paragraph story, and links. A terminal docked at
   the bottom accepts commands.
5. **Fallback.** The current homepage moves to `/classic/`. It is linked from a
   visible "plain version" toggle and a `<noscript>` tag, and it is where
   reduced-motion visitors land.

## Architecture (Approach A: vanilla modules, no build)

```
public/
  index.html            new immersive shell + real semantic text for SEO
  classic/index.html    current homepage, moved; relative links made root-absolute
  xp/
    content.js          data only: projects, tracks, narration script, command help
    terminal.js         typing effect, command parser, history, tab completion
    boot.js             fetch /api/status, build boot lines, fallbacks
    core.js             Three.js orb + project rings (lazy loaded)
    core-fallback.css   CSS-only orb used when WebGL or Three.js is unavailable
    narrator.js         captions (always) + optional audio clips
    main.js             wires units together and runs the act sequence
    xp.css              terminal, window, panel and caption styles
    voice/*.opus        pre-rendered narration clips
functions/api/status.js new Pages Function
scripts/render-voice.mjs regenerates voice clips from content.js with Piper
```

### Unit interfaces

| Unit | Responsibility | Interface |
|---|---|---|
| `content.js` | Single source of truth for all text and project data | Exported constants; no logic |
| `terminal.js` | Render and type lines, parse and run commands | `typeLine(text, opts)`, `print(text)`, `register(name, handler, help)`, `run(input)` |
| `boot.js` | Turn status JSON into boot lines | `getBootLines({ timeoutMs })` returns `Promise<string[]>` and never rejects |
| `core.js` | Orb and rings | `mount(el)`, `setState(state)` with idle / speaking / focus, `focus(projectId)`, `setTrack(track)` |
| `narrator.js` | Captions and audio | `say(lineId)` returns a promise that resolves when the caption finishes; `setSound(on)` |
| `status.js` | Live boot data | `GET /api/status` returns JSON (schema below) |

`main.js` is the only unit that knows the act order. Units do not import each
other directly; `main.js` wires them. Any unit may read `content.js`.

### Commands (initial set)

`help`, `ls projects`, `open <project>`, `track hire|build`, `cat resume`,
`contact`, `sound on|off`, `classic`, `clear`, plus easter eggs such as
`sudo hire zohn` and `whoami`. Unknown input prints a short hint pointing to
`help`. On phones, commands are shown as tappable chips instead of typed.

`cat resume` links to the existing `resume.html`. `contact` links to the
existing `hire.html` for the hire track and to the Sitekit inquiry path for
the build track.

## Live data: `/api/status`

Response shape:

```json
{
  "city": "Kansas City",
  "country": "US",
  "commit": { "repo": "zohnner/example", "message": "Fix boot timing", "date": "2026-10-10T18:00:00Z" },
  "projects": [
    { "id": "botchase", "status": "sleeping", "ms": null }
  ],
  "generatedAt": "2026-10-11T12:00:00Z"
}
```

- **City and country** come from `request.cf`. They are shown only to that
  visitor and are never stored or logged. Missing values are `null`.
- **Latency** is measured by the browser timing its own fetch of
  `/api/status`. It is not part of the response.
- **Latest commit** comes from the public GitHub API for the `zohnner`
  account, unauthenticated, cached in the edge Cache API for 10 minutes. On
  any error, `commit` is `null`.
- **Project health** is a GET with a 2-second timeout to each featured
  project's live URL, cached for 5 minutes. A 2xx or 3xx response is
  `online`. A timeout is `sleeping`, because BotChase runs on Render's free
  tier and cold-starts. Any other failure is `down`.
- The function always returns HTTP 200 with whatever fields it could fill.

## Voice

Scripted lines are pre-rendered once, locally, with **Piper**, a free
open-source TTS engine. They are encoded to Opus and committed under
`public/xp/voice/`. The voice model is chosen during implementation by
listening to a few candidates. `scripts/render-voice.mjs` regenerates every
clip from the narration text in `content.js`, so captions and audio cannot
drift apart. Dynamic lines such as the city and the commit are caption-only.
The same file layout supports swapping in clips recorded in Zohn's own voice
later.

The orb's speaking state follows the caption typing, not the audio, so the
visual is identical with sound off.

## Failure handling

| Failure | Behavior |
|---|---|
| `/api/status` slow or down | Boot waits at most 1.5 s, then plays scripted fallback lines |
| WebGL unavailable | CSS orb in the same position; everything else unchanged |
| Three.js CDN fails | Same CSS orb fallback |
| Audio blocked or muted | No change; captions carry every line |
| JavaScript off | `<noscript>` link to `/classic/`; static HTML still holds the bio and projects |
| `localStorage` throws | Treated as a first visit |

## Accessibility

- `prefers-reduced-motion: reduce` sends visitors to `/classic/`, which links
  back to the immersive version. Choosing the immersive version from there is
  remembered for the session.
- All rings and controls are keyboard reachable with a visible focus ring and
  open with Enter.
- Narration is announced in an `aria-live="polite"` region. The orb canvas is
  `aria-hidden`.
- Escape or the visible "skip intro" button skips to the core at any time.

## Performance budgets

- The boot terminal is HTML and CSS only and paints immediately.
- Three.js and the orb load in the background during the boot sequence.
- Page weight before the orb loads: 250 KB or less.
- Each voice clip: 30 KB or less (Opus).
- Phones render fewer particles.

## SEO

`index.html` keeps a real `<title>`, meta description, Open Graph tags, and
the bio and project summaries as semantic HTML inside the page. Scripts
enhance that content into the experience instead of replacing it.
`sitemap.xml` gains `/classic/`.

## Testing

- **Unit tests** with the Node test runner (`npm test`):
  - `functions/api/status.js` with mocked `fetch` and `caches`, covering
    success, timeout as sleeping, GitHub failure, and the always-200 rule.
  - The command parser in `terminal.js`: known commands, arguments, unknown
    input, and history.
- **Browser pass** with Chrome DevTools: screenshots at desktop and 390 px
  phone widths; reduced motion on; `/api/status` blocked; WebGL disabled; and
  keyboard only from landing to opening a project.

## Out of scope

- Free-text AI chat. A later upgrade could use Cloudflare Workers AI's free
  tier behind the same terminal, once the concept is validated.
- A live Sitekit "build a site in front of you" demo command.
- Changes to `hire.html`, `resume.html`, `ai-workflow.html` or `dashboard.html`.
- The BotChase case study, which stays deferred until BotChase stabilizes.
