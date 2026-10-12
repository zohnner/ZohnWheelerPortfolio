# Immersive Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portfolio homepage with a CRT-terminal boot sequence that runs on live data and opens a Jarvis-style AI core, with the old homepage kept as a plain fallback at `/classic/`.

**Architecture:** Plain HTML, CSS and ES modules under `public/xp/`, with no build step. One new Cloudflare Pages Function (`functions/api/status.js`) serves live boot data. `public/xp/content.js` is the single source of truth for projects, tracks and narration. Pure logic (`commands.js`, `boot.js`, `content.js`, `status.js`) is unit tested with Node. DOM and WebGL code (`terminal.js`, `narrator.js`, `core.js`, `main.js`) is verified in a real browser.

**Tech Stack:** Vanilla JS (ES modules), Three.js r169 from jsDelivr, Cloudflare Pages + Pages Functions, Node 24 `node --test`, Piper TTS + ffmpeg (local, one-off), Chrome DevTools MCP for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-11-immersive-portfolio-design.md`

## Global Constraints

- No paid APIs. No Claude API and no paid TTS.
- No build step. Files in `public/` are served as written.
- Three.js is pinned: `https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js`.
- Captions first. Every spoken line is readable as text. Sound is off until the visitor turns it on.
- `/api/status` always returns HTTP 200. City and country are never stored or logged.
- Health-check and GitHub timeouts: 1200 ms. Commit cache: 600 s. Health cache: 300 s. Client boot wait: 1500 ms.
- Page weight before the orb loads: 250 KB or less. Each voice clip: 30 KB or less (32 kbps mono MP3).
- `localStorage` and `sessionStorage` access is always wrapped in try/catch.
- Visible copy never uses gendered pronouns for Zohn. Use the name.
- Work on branch `immersive-portfolio`. Stage files by explicit path only. The working tree has unrelated uncommitted files (`.gitignore`, `.agents/`, `AGENTS.md`, `adapters/`, `todos.md`, and others) that must not be committed.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Local dev server: `npx wrangler pages dev public --port 8899`.
- Edit files with Bash or the Edit/Write tools, never PowerShell `Set-Content`, which corrupts UTF-8 in this repo.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `public/xp/package.json` | create | `{"type":"module"}` so Node can import the browser modules |
| `public/xp/content.js` | create | Projects, tracks, narration, owner links. Data only |
| `public/xp/commands.js` | create | Pure command registry, parser and history |
| `public/xp/boot.js` | create | Status JSON to boot lines, with fallbacks |
| `functions/api/status.js` | create | Live boot data endpoint |
| `public/classic/index.html` | move | Old homepage, with relative links made root-absolute |
| `public/index.html` | create | Immersive shell and real semantic copy |
| `public/xp/xp.css` | create | All immersive styles |
| `public/xp/core-fallback.css` | create | CSS orb used when WebGL is unavailable |
| `public/xp/terminal.js` | create | DOM terminal |
| `public/xp/core.js` | create | Three.js orb and orbit lines |
| `public/xp/narrator.js` | create | Captions plus optional audio |
| `public/xp/main.js` | create | Wires the units together and runs the acts |
| `scripts/render-voice.mjs` | create | Renders narration clips with Piper |
| `public/xp/voice/*.mp3` | create | Rendered clips |
| `public/_headers`, `public/sitemap.xml`, `.gitignore` | modify | Cache rules, sitemap entry, ignore `.voices/` |
| `test/xp-content.test.mjs`, `test/xp-commands.test.mjs`, `test/xp-boot.test.mjs`, `test/status.test.mjs` | create | Unit tests |

---

### Task 1: Content module

**Files:**
- Create: `public/xp/package.json`
- Create: `public/xp/content.js`
- Test: `test/xp-content.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `OWNER` `{ name, email, github, linkedin }`; `GITHUB_USER` string; `PROJECTS` array of `{ id, name, color, story, stack: string[], links: {label, href}[], thumb: string|null, healthUrl: string|null }`; `TRACKS` `{ hire, build }`, each `{ label, order: string[], contact: { prefix, text, href } }`; `NARRATION` object mapping a line id to its text. Ids used: `intro`, `welcome`, `bio`, `ask`, `track.hire`, `track.build`, `project.<id>`.

- [ ] **Step 1: Write the failing test**

Create `test/xp-content.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, TRACKS, NARRATION, OWNER, GITHUB_USER } from '../public/xp/content.js';

const ids = PROJECTS.map((p) => p.id);

test('project ids are unique', () => {
  assert.equal(new Set(ids).size, ids.length);
});

test('every project has the fields the UI renders', () => {
  for (const p of PROJECTS) {
    assert.match(p.id, /^[a-z]+$/, p.id);
    assert.ok(p.name, `${p.id} name`);
    assert.match(p.color, /^#[0-9a-f]{6}$/i, `${p.id} color`);
    assert.ok(p.story.length > 40, `${p.id} story`);
    assert.ok(Array.isArray(p.stack) && p.stack.length > 0, `${p.id} stack`);
    assert.ok(p.links.length > 0, `${p.id} links`);
    for (const l of p.links) assert.ok(l.label && l.href, `${p.id} link`);
    if (p.healthUrl) assert.match(p.healthUrl, /^https:\/\//, `${p.id} healthUrl`);
  }
});

test('the three featured live projects are health-checked', () => {
  const checked = PROJECTS.filter((p) => p.healthUrl).map((p) => p.id);
  assert.deepEqual(checked, ['sportstrata', 'botchase', 'zretrobuild']);
});

test('both tracks exist and only list real projects', () => {
  assert.deepEqual(Object.keys(TRACKS).sort(), ['build', 'hire']);
  for (const [name, t] of Object.entries(TRACKS)) {
    assert.ok(t.order.length > 0, name);
    for (const id of t.order) assert.ok(ids.includes(id), `${name} lists unknown ${id}`);
    assert.ok(t.contact.href && t.contact.text, `${name} contact`);
  }
});

test('every scripted line exists and is short enough for a 30 KB clip', () => {
  const required = ['intro', 'welcome', 'bio', 'ask', 'track.hire', 'track.build', ...ids.map((id) => `project.${id}`)];
  for (const id of required) assert.ok(NARRATION[id], `missing narration ${id}`);
  for (const [id, text] of Object.entries(NARRATION)) assert.ok(text.length <= 140, `${id} is ${text.length} chars`);
});

test('owner links', () => {
  assert.equal(OWNER.email, 'zohnwheeler@gmail.com');
  assert.equal(GITHUB_USER, 'zohnner');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-content.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `public/xp/content.js`.

- [ ] **Step 3: Write the implementation**

Create `public/xp/package.json`:

```json
{ "type": "module" }
```

Create `public/xp/content.js`:

```js
// Single source of truth for the immersive homepage: projects, audience
// tracks and narration. Data only, no logic. Imported by the browser modules,
// by functions/api/status.js and by scripts/render-voice.mjs.

export const OWNER = {
  name: 'Zohn Wheeler',
  email: 'zohnwheeler@gmail.com',
  github: 'https://github.com/zohnner',
  linkedin: 'https://www.linkedin.com/in/zohn-wheeler/',
};

export const GITHUB_USER = 'zohnner';

export const PROJECTS = [
  {
    id: 'sportstrata',
    name: 'SportStrata',
    color: '#4fd1ff',
    story:
      'Full-stack MLB analytics platform for broadcast pros and fantasy players: live play-by-play scorecards, Statcast leaderboards, printable game-prep sheets, a custom stat builder and AI-generated broadcast narratives. Built solo across 200+ commits with a multi-agent AI review team that keeps shipping velocity high.',
    stack: ['JavaScript', 'Cloudflare Workers + D1', 'Live APIs', 'AI workflow'],
    links: [
      { label: 'Live', href: 'https://sportstrata.cc/' },
      { label: 'GitHub', href: 'https://github.com/zohnner/zohn-sports-stats' },
      { label: 'Case study', href: '/ai-workflow.html' },
    ],
    thumb: '/thumb-sportstrata.jpg',
    healthUrl: 'https://sportstrata.cc/',
  },
  {
    id: 'botchase',
    name: 'BotChase',
    color: '#ff9f43',
    story:
      'AI sales automation SaaS for local service businesses like roofing, HVAC and plumbing. It scores leads, drafts outreach copy and turns campaigns into client-ready proposals, with real Stripe billing, a per-account dashboard and an admin console. Claude-powered generation is cost-tracked per customer and gated to paying accounts.',
    stack: ['Python / Flask', 'Stripe billing', 'Claude API', 'SaaS'],
    links: [{ label: 'Live', href: 'https://botchase.onrender.com/' }],
    thumb: '/thumb-botchase.jpg',
    healthUrl: 'https://botchase.onrender.com/',
  },
  {
    id: 'zretrobuild',
    name: 'ZRetroBuild',
    color: '#ff4fd8',
    story:
      'A fully playable 8-bit arcade with Snake, Breakout and Space Invaders inside an authentic CRT cabinet: scanlines, neon glow, a coin-insert system, synthesized Web Audio and a Konami Code easter egg. Zero dependencies.',
    stack: ['HTML / CSS / JS', 'Web Audio API', 'CSS animation', 'Zero deps'],
    links: [
      { label: 'Play', href: 'https://zretrobuild.zohnwheeler.workers.dev/' },
      { label: 'GitHub', href: 'https://github.com/zohnner/ZRetroBuild' },
    ],
    thumb: '/thumb-zretrobuild.jpg',
    healthUrl: 'https://zretrobuild.zohnwheeler.workers.dev/',
  },
  {
    id: 'oraclebot',
    name: 'Discord Educational Bot',
    color: '#a78bfa',
    story:
      'A senior capstone Discord bot that uses AI to help students work through course material with natural-language Q&A. Built by a team of four and featured by the University of Missouri College of Engineering.',
    stack: ['Python', 'NLP', 'React', 'Team of four'],
    links: [
      { label: 'Article', href: 'https://engineering.missouri.edu/2024/information-technology-students-develop-an-educational-ai-bot-for-capstone-project/' },
      { label: 'GitHub', href: 'https://github.com/zohnner/OracleChatBot' },
    ],
    thumb: null,
    healthUrl: null,
  },
  {
    id: 'sitekit',
    name: 'Sitekit',
    color: '#3dff9a',
    story:
      'Fast, mobile-first websites for local service businesses like roofing, HVAC and foundation repair. Every site ships with service and service-area pages, SEO fundamentals and a lead form that goes straight to the owner.',
    stack: ['Cloudflare Pages', 'D1', 'Templated content', 'Lead capture'],
    links: [{ label: 'Get a quote', href: '/hire.html#contact-form' }],
    thumb: null,
    healthUrl: null,
  },
];

export const TRACKS = {
  hire: {
    label: 'Hiring',
    order: ['sportstrata', 'botchase', 'zretrobuild', 'oraclebot', 'sitekit'],
    contact: { prefix: 'email: ', text: OWNER.email, href: `mailto:${OWNER.email}` },
  },
  build: {
    label: 'Building',
    order: ['sitekit', 'botchase', 'sportstrata', 'zretrobuild'],
    contact: { prefix: 'quote form: ', text: '/hire.html#contact-form', href: '/hire.html#contact-form' },
  },
};

// Every entry here gets a pre-rendered voice clip (scripts/render-voice.mjs).
// Keep each line at 140 characters or fewer.
export const NARRATION = {
  intro: "Hello. I'm ZW-Core, the system Zohn Wheeler built to make introductions.",
  welcome: 'Welcome back. Picking up where we left off.',
  bio: 'Zohn is a Kansas City developer and federal IT professional who ships full-stack products from idea to production.',
  ask: 'So, are you here to hire Zohn, or to have something built?',
  'track.hire': 'Engineering it is. These projects show the most range. Pick one, or type help.',
  'track.build': "Let's talk results. This is what Zohn builds for businesses like yours. Pick one, or type help.",
  'project.sportstrata': "SportStrata: a live baseball analytics platform, built solo, running on Cloudflare's edge.",
  'project.botchase': 'BotChase: an AI sales assistant for local service businesses, with real billing.',
  'project.zretrobuild': 'Z Retro Build: a fully playable arcade in the browser, with zero dependencies.',
  'project.oraclebot': 'The capstone AI bot that helped students study, featured by Mizzou Engineering.',
  'project.sitekit': 'Sitekit: fast, professional websites for local businesses, built to turn visitors into calls.',
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-content.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add public/xp/package.json public/xp/content.js test/xp-content.test.mjs
git commit -m "xp: content module for projects, tracks and narration" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Command registry

**Files:**
- Create: `public/xp/commands.js`
- Test: `test/xp-commands.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseInput(raw) → { name, args: string[], raw } | null`. The name is lowercased. Args keep their case.
  - `createRegistry() → { register(name, handler, help?), list() → {name, help}[], complete(prefix) → string[], run(raw) → Promise<{ ok, output: Array<string | {prefix?, text, href}> }> }`. A handler receives `(args, parsed)` and may return a string, a link object, an array of those, or nothing. It may be async.
  - `createHistory(limit = 50) → { push(line), prev() → string, next() → string }`.

- [ ] **Step 1: Write the failing test**

Create `test/xp-commands.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, createRegistry, createHistory } from '../public/xp/commands.js';

test('parseInput lowercases the name and keeps arg case', () => {
  assert.deepEqual(parseInput('  OPEN  SportStrata '), { name: 'open', args: ['SportStrata'], raw: 'OPEN  SportStrata' });
});

test('parseInput returns null for blank input', () => {
  assert.equal(parseInput(''), null);
  assert.equal(parseInput('   '), null);
  assert.equal(parseInput(undefined), null);
});

test('run passes args to the handler and wraps a string in an array', async () => {
  const r = createRegistry();
  r.register('echo', (args) => args.join(' '), 'echo: repeat');
  assert.deepEqual(await r.run('echo a b'), { ok: true, output: ['a b'] });
});

test('array output passes through and undefined output is empty', async () => {
  const r = createRegistry();
  r.register('two', () => ['x', { text: 'y', href: '/y' }]);
  r.register('none', () => undefined);
  assert.deepEqual((await r.run('two')).output, ['x', { text: 'y', href: '/y' }]);
  assert.deepEqual(await r.run('none'), { ok: true, output: [] });
});

test('async handlers are awaited', async () => {
  const r = createRegistry();
  r.register('later', async () => 'done');
  assert.deepEqual((await r.run('later')).output, ['done']);
});

test('unknown commands return a hint', async () => {
  const r = createRegistry();
  assert.deepEqual(await r.run('nope'), { ok: false, output: ["command not found: nope. type 'help' for commands."] });
});

test('blank input is a no-op', async () => {
  assert.deepEqual(await createRegistry().run('  '), { ok: true, output: [] });
});

test('handler errors become output instead of throwing', async () => {
  const r = createRegistry();
  r.register('boom', () => { throw new Error('kaboom'); });
  assert.deepEqual(await r.run('boom'), { ok: false, output: ['boom: kaboom'] });
});

test('list returns only commands with help, in registration order', () => {
  const r = createRegistry();
  r.register('help', () => {}, 'help: list commands');
  r.register('whoami', () => 'guest');
  r.register('clear', () => {}, 'clear: clear the terminal');
  assert.deepEqual(r.list(), [
    { name: 'help', help: 'help: list commands' },
    { name: 'clear', help: 'clear: clear the terminal' },
  ]);
});

test('complete returns sorted prefix matches', () => {
  const r = createRegistry();
  for (const n of ['cat', 'clear', 'classic', 'contact']) r.register(n, () => {});
  assert.deepEqual(r.complete('cl'), ['classic', 'clear']);
  assert.deepEqual(r.complete('CA'), ['cat']);
  assert.deepEqual(r.complete('z'), []);
});

test('history walks back and forward, skipping blanks and repeats', () => {
  const h = createHistory();
  for (const line of ['a', 'b', 'b', '  ']) h.push(line);
  assert.equal(h.prev(), 'b');
  assert.equal(h.prev(), 'a');
  assert.equal(h.prev(), 'a');
  assert.equal(h.next(), 'b');
  assert.equal(h.next(), '');
});

test('history respects its limit', () => {
  const h = createHistory(2);
  for (const line of ['a', 'b', 'c']) h.push(line);
  assert.equal(h.prev(), 'c');
  assert.equal(h.prev(), 'b');
  assert.equal(h.prev(), 'b');
});

test('history on empty returns empty strings', () => {
  const h = createHistory();
  assert.equal(h.prev(), '');
  assert.equal(h.next(), '');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-commands.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the implementation**

Create `public/xp/commands.js`:

```js
// Pure command machinery for the terminal: parsing, a registry and input
// history. No DOM, so it is unit tested in Node (test/xp-commands.test.mjs).

export function parseInput(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  return { name: parts[0].toLowerCase(), args: parts.slice(1), raw: trimmed };
}

export function createRegistry() {
  const commands = new Map();

  return {
    register(name, handler, help = '') {
      commands.set(name.toLowerCase(), { handler, help });
    },
    list() {
      return [...commands.entries()]
        .filter(([, c]) => c.help)
        .map(([name, c]) => ({ name, help: c.help }));
    },
    complete(prefix) {
      const p = String(prefix).toLowerCase();
      return [...commands.keys()].filter((n) => n.startsWith(p)).sort();
    },
    async run(raw) {
      const parsed = parseInput(raw);
      if (!parsed) return { ok: true, output: [] };
      const cmd = commands.get(parsed.name);
      if (!cmd) return { ok: false, output: [`command not found: ${parsed.name}. type 'help' for commands.`] };
      try {
        const out = await cmd.handler(parsed.args, parsed);
        return { ok: true, output: out == null ? [] : [].concat(out) };
      } catch (err) {
        return { ok: false, output: [`${parsed.name}: ${err?.message ?? err}`] };
      }
    },
  };
}

export function createHistory(limit = 50) {
  const items = [];
  let cursor = 0;

  return {
    push(line) {
      const t = String(line ?? '').trim();
      if (!t) return;
      if (items[items.length - 1] !== t) items.push(t);
      if (items.length > limit) items.shift();
      cursor = items.length;
    },
    prev() {
      if (!items.length) return '';
      cursor = Math.max(0, cursor - 1);
      return items[cursor];
    },
    next() {
      if (cursor >= items.length - 1) {
        cursor = items.length;
        return '';
      }
      cursor += 1;
      return items[cursor];
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-commands.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add public/xp/commands.js test/xp-commands.test.mjs
git commit -m "xp: pure command registry, parser and history" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Boot lines

**Files:**
- Create: `public/xp/boot.js`
- Test: `test/xp-boot.test.mjs`

**Interfaces:**
- Consumes: `PROJECTS` from Task 1, for display names.
- Produces:
  - `FALLBACK_LINES: {text, tag}[]`
  - `formatBootLines(status, latencyMs) → {text, tag}[]`, where tag is one of `OK`, `SLEEP`, `DOWN` or `WARN`.
  - `formatLine({text, tag}) → string`, padded with dots to 46 columns and ending `[ TAG ]`.
  - `getBootLines({ url = '/api/status', timeoutMs = 1500, fetchImpl = fetch, now = () => performance.now() }) → Promise<{text, tag}[]>`. It never rejects.

- [ ] **Step 1: Write the failing test**

Create `test/xp-boot.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBootLines, formatLine, getBootLines, FALLBACK_LINES } from '../public/xp/boot.js';

const KERNEL = { text: 'kernel zw-os 5.1', tag: 'OK' };
const IDENTITY = { text: 'identity module zohn_wheeler', tag: 'OK' };

test('formats a full status payload', () => {
  const lines = formatBootLines({
    city: 'Kansas City',
    country: 'US',
    commit: { repo: 'zohnner/x', message: 'Fix boot timing', date: '2026-10-10T18:00:00Z' },
    projects: [
      { id: 'sportstrata', status: 'online', ms: 120 },
      { id: 'botchase', status: 'sleeping', ms: null },
      { id: 'zretrobuild', status: 'down', ms: null },
    ],
  }, 41.6);
  assert.deepEqual(lines, [
    KERNEL,
    { text: 'uplink 42 ms', tag: 'OK' },
    { text: 'visitor Kansas City, US', tag: 'OK' },
    { text: 'last commit "Fix boot timing"', tag: 'OK' },
    { text: 'service SportStrata', tag: 'OK' },
    { text: 'service BotChase', tag: 'SLEEP' },
    { text: 'service ZRetroBuild', tag: 'DOWN' },
    IDENTITY,
  ]);
});

test('skips fields that are missing', () => {
  assert.deepEqual(formatBootLines({ city: null, country: null, commit: null, projects: [] }, NaN), [KERNEL, IDENTITY]);
});

test('city without a country has no trailing comma', () => {
  const lines = formatBootLines({ city: 'Denver', country: null, commit: null, projects: [] }, NaN);
  assert.deepEqual(lines[1], { text: 'visitor Denver', tag: 'OK' });
});

test('long commit messages are truncated', () => {
  const lines = formatBootLines({ commit: { message: 'a'.repeat(60) }, projects: [] }, NaN);
  assert.deepEqual(lines[1], { text: `last commit "${'a'.repeat(37)}..."`, tag: 'OK' });
});

test('unknown project status is shown as DOWN', () => {
  const lines = formatBootLines({ projects: [{ id: 'sportstrata', status: 'weird' }] }, NaN);
  assert.deepEqual(lines[1], { text: 'service SportStrata', tag: 'DOWN' });
});

test('formatLine pads with dots to 46 columns', () => {
  assert.equal(formatLine({ text: 'uplink 42 ms', tag: 'OK' }), `uplink 42 ms ${'.'.repeat(33)} [ OK ]`);
});

test('formatLine leaves long text unpadded', () => {
  const text = 'x'.repeat(50);
  assert.equal(formatLine({ text, tag: 'OK' }), `${text}  [ OK ]`);
});

test('getBootLines measures latency around the fetch', async () => {
  const times = [100, 142];
  const fetchImpl = async (url) => {
    assert.equal(url, '/api/status');
    return { ok: true, json: async () => ({ city: 'Denver', country: 'US', commit: null, projects: [] }) };
  };
  const lines = await getBootLines({ fetchImpl, now: () => times.shift() });
  assert.deepEqual(lines, [KERNEL, { text: 'uplink 42 ms', tag: 'OK' }, { text: 'visitor Denver, US', tag: 'OK' }, IDENTITY]);
});

test('getBootLines falls back when fetch rejects', async () => {
  const lines = await getBootLines({ fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepEqual(lines, FALLBACK_LINES);
});

test('getBootLines falls back on a non-OK response', async () => {
  const lines = await getBootLines({ fetchImpl: async () => ({ ok: false, json: async () => ({}) }) });
  assert.deepEqual(lines, FALLBACK_LINES);
});

test('getBootLines falls back on bad JSON', async () => {
  const lines = await getBootLines({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }) });
  assert.deepEqual(lines, FALLBACK_LINES);
});

test('fallback lines are honest about missing telemetry', () => {
  assert.ok(FALLBACK_LINES.some((l) => l.tag === 'WARN'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-boot.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the implementation**

Create `public/xp/boot.js`:

```js
// Turns the /api/status payload into terminal boot lines. Pure apart from the
// fetch in getBootLines, which is injectable and never rejects.

import { PROJECTS } from './content.js';

const TAGS = { online: 'OK', sleeping: 'SLEEP', down: 'DOWN' };
const WIDTH = 46;

const nameOf = (id) => PROJECTS.find((p) => p.id === id)?.name ?? id;
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

export const FALLBACK_LINES = [
  { text: 'kernel zw-os 5.1', tag: 'OK' },
  { text: 'live telemetry unavailable, using cached profile', tag: 'WARN' },
  { text: 'identity module zohn_wheeler', tag: 'OK' },
];

export function formatBootLines(status, latencyMs) {
  const lines = [{ text: 'kernel zw-os 5.1', tag: 'OK' }];
  if (Number.isFinite(latencyMs)) lines.push({ text: `uplink ${Math.round(latencyMs)} ms`, tag: 'OK' });
  if (status?.city) lines.push({ text: `visitor ${status.city}${status.country ? `, ${status.country}` : ''}`, tag: 'OK' });
  if (status?.commit?.message) lines.push({ text: `last commit "${truncate(status.commit.message, 40)}"`, tag: 'OK' });
  for (const p of status?.projects ?? []) {
    lines.push({ text: `service ${nameOf(p.id)}`, tag: TAGS[p.status] ?? 'DOWN' });
  }
  lines.push({ text: 'identity module zohn_wheeler', tag: 'OK' });
  return lines;
}

export function formatLine({ text, tag }) {
  const body = text.length >= WIDTH ? `${text} ` : `${text} `.padEnd(WIDTH, '.');
  return `${body} [ ${tag} ]`;
}

export async function getBootLines({
  url = '/api/status',
  timeoutMs = 1500,
  fetchImpl = globalThis.fetch,
  now = () => performance.now(),
} = {}) {
  try {
    const t0 = now();
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    const latency = now() - t0;
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return formatBootLines(data, latency);
  } catch {
    return FALLBACK_LINES;
  }
}
```

Latency is measured before `res.json()` is awaited, so it is the network round trip only. The test passes `now` values in call order: the first call happens before the fetch and the second right after it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-boot.test.mjs`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add public/xp/boot.js test/xp-boot.test.mjs
git commit -m "xp: boot line formatting with honest fallbacks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `/api/status` Pages Function

**Files:**
- Create: `functions/api/status.js`
- Test: `test/status.test.mjs`

**Interfaces:**
- Consumes: `PROJECTS` and `GITHUB_USER` from Task 1, through `../../public/xp/content.js`. Pages Functions bundle relative imports outside `functions/`; `functions/_middleware.js` already imports from `../sitekit/`.
- Produces: `onRequestGet(context)` returning JSON `{ city, country, commit: {repo, message, date} | null, projects: {id, status: 'online'|'sleeping'|'down', ms: number|null}[], generatedAt }`, always with HTTP 200. Also exports `latestCommit(user, fetchImpl?)` and `checkProject(project, fetchImpl?)` for tests.

`sitekit/route.mjs` already returns `{ kind: 'static' }` for every `/api/` path, so the middleware passes `/api/status` through to this function. No routing change is needed.

- [ ] **Step 1: Write the failing test**

Create `test/status.test.mjs`:

```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/status.js';

const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;

function memoryCache() {
  const store = new Map();
  return {
    async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; },
    async put(req, res) { store.set(req.url, res.clone()); },
  };
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const timeoutError = () => Object.assign(new Error('timed out'), { name: 'TimeoutError' });

// Routes a fetch by substring of the URL and records every call.
function routeFetch(routes) {
  const calls = [];
  const f = async (url, init) => {
    const u = String(url);
    calls.push(u);
    for (const [match, handler] of routes) if (u.includes(match)) return handler(init);
    throw new Error(`unexpected fetch ${u}`);
  };
  f.calls = calls;
  return f;
}

const healthy = () => [
  ['api.github.com/users/zohnner/repos', () => json([{ full_name: 'zohnner/zohn-sports-stats' }])],
  ['api.github.com/repos/zohnner/zohn-sports-stats/commits', () => json([{ commit: { message: 'Fix boot timing\n\nlong body', author: { date: '2026-10-10T18:00:00Z' } } }])],
  ['sportstrata.cc', () => new Response('ok', { status: 200 })],
  ['botchase.onrender.com', () => { throw timeoutError(); }],
  ['zretrobuild', () => new Response('nope', { status: 503 })],
];

const ctx = (cf) => ({ request: { url: 'https://zohnwheelerportfolio.pages.dev/api/status', cf } });

async function call(cf) {
  const res = await onRequestGet(ctx(cf));
  return { res, body: await res.json() };
}

beforeEach(() => { globalThis.caches = { default: memoryCache() }; });
afterEach(() => { globalThis.fetch = realFetch; globalThis.caches = realCaches; });

test('returns location, latest commit and project health', async () => {
  globalThis.fetch = routeFetch(healthy());
  const { res, body } = await call({ city: 'Kansas City', country: 'US' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'application/json');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.city, 'Kansas City');
  assert.equal(body.country, 'US');
  assert.deepEqual(body.commit, { repo: 'zohnner/zohn-sports-stats', message: 'Fix boot timing', date: '2026-10-10T18:00:00Z' });
  assert.deepEqual(body.projects.map((p) => [p.id, p.status]), [['sportstrata', 'online'], ['botchase', 'sleeping'], ['zretrobuild', 'down']]);
  assert.equal(typeof body.projects[0].ms, 'number');
  assert.equal(body.projects[1].ms, null);
  assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
});

test('caches GitHub and health results between requests', async () => {
  const f = routeFetch(healthy());
  globalThis.fetch = f;
  await call({});
  await call({});
  assert.equal(f.calls.filter((u) => u.includes('api.github.com')).length, 2);
  assert.equal(f.calls.filter((u) => u.includes('sportstrata.cc')).length, 1);
});

test('a GitHub error leaves commit null and still returns 200', async () => {
  const routes = healthy();
  routes[0] = ['api.github.com/users/zohnner/repos', () => json({ message: 'rate limited' }, 403)];
  globalThis.fetch = routeFetch(routes);
  const { res, body } = await call({});
  assert.equal(res.status, 200);
  assert.equal(body.commit, null);
});

test('missing cf data gives null city and country', async () => {
  globalThis.fetch = routeFetch(healthy());
  const { body } = await call(undefined);
  assert.equal(body.city, null);
  assert.equal(body.country, null);
});

test('total network failure still returns 200 with everything down', async () => {
  globalThis.fetch = async () => { throw new Error('network down'); };
  const { res, body } = await call({});
  assert.equal(res.status, 200);
  assert.equal(body.commit, null);
  assert.deepEqual(body.projects.map((p) => p.status), ['down', 'down', 'down']);
});

test('works without the Cache API', async () => {
  delete globalThis.caches;
  globalThis.fetch = routeFetch(healthy());
  const { res, body } = await call({});
  assert.equal(res.status, 200);
  assert.equal(body.projects.length, 3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/status.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `functions/api/status.js`.

- [ ] **Step 3: Write the implementation**

Create `functions/api/status.js`:

```js
// GET /api/status: live data for the homepage boot sequence. Always 200.
// The visitor's city and country come from request.cf and are echoed back
// to that visitor only; they are never stored or logged.

import { PROJECTS, GITHUB_USER } from '../../public/xp/content.js';

const TIMEOUT_MS = 1200;
const COMMIT_TTL = 600;
const HEALTH_TTL = 300;
const CACHE_ORIGIN = 'https://status-cache.internal';
const GITHUB_HEADERS = { 'User-Agent': 'zohnwheeler-portfolio', Accept: 'application/vnd.github+json' };

async function cached(key, ttl, produce) {
  const cache = globalThis.caches?.default;
  const req = new Request(`${CACHE_ORIGIN}/${key}`);
  if (cache) {
    const hit = await cache.match(req);
    if (hit) return hit.json();
  }
  const value = await produce();
  if (cache) {
    await cache.put(req, new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` },
    }));
  }
  return value;
}

export async function latestCommit(user, fetchImpl = fetch) {
  try {
    const init = { headers: GITHUB_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) };
    const reposRes = await fetchImpl(`https://api.github.com/users/${user}/repos?sort=pushed&per_page=1`, init);
    if (!reposRes.ok) return null;
    const [repo] = await reposRes.json();
    if (!repo?.full_name) return null;
    const commitsRes = await fetchImpl(`https://api.github.com/repos/${repo.full_name}/commits?per_page=1`, init);
    if (!commitsRes.ok) return null;
    const [c] = await commitsRes.json();
    if (!c?.commit) return null;
    return {
      repo: repo.full_name,
      message: String(c.commit.message).split('\n')[0].slice(0, 72),
      date: c.commit.author?.date ?? null,
    };
  } catch {
    return null;
  }
}

export async function checkProject(project, fetchImpl = fetch) {
  const t0 = Date.now();
  try {
    const res = await fetchImpl(project.healthUrl, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    try { await res.body?.cancel(); } catch { /* body already consumed or absent */ }
    const ok = res.status >= 200 && res.status < 400;
    return { id: project.id, status: ok ? 'online' : 'down', ms: ok ? Date.now() - t0 : null };
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return { id: project.id, status: timedOut ? 'sleeping' : 'down', ms: null };
  }
}

export async function onRequestGet(context) {
  const cf = context.request?.cf ?? {};
  const targets = PROJECTS.filter((p) => p.healthUrl);
  let commit = null;
  let projects = targets.map((p) => ({ id: p.id, status: 'down', ms: null }));

  try {
    [commit, projects] = await Promise.all([
      cached('commit', COMMIT_TTL, () => latestCommit(GITHUB_USER)).catch(() => null),
      Promise.all(targets.map((p) =>
        cached(`health/${p.id}`, HEALTH_TTL, () => checkProject(p)).catch(() => ({ id: p.id, status: 'down', ms: null })),
      )),
    ]);
  } catch {
    // Keep the defaults above. This endpoint must always answer 200.
  }

  const body = {
    city: cf.city ?? null,
    country: cf.country ?? null,
    commit,
    projects,
    generatedAt: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
```

`fetchImpl = fetch` is evaluated at call time, so the tests' `globalThis.fetch` replacement is picked up.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/status.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: every test passes, including the existing Sitekit suites.

- [ ] **Step 6: Commit**

```bash
git add functions/api/status.js test/status.test.mjs
git commit -m "api: /api/status live boot data with edge caching" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Move the old homepage to `/classic/`

**Files:**
- Move: `public/index.html` → `public/classic/index.html`
- Modify: `public/_headers`, `public/sitemap.xml`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `/classic/` page that links to `/?immersive=1`. Task 6 relies on that query parameter.

- [ ] **Step 1: Move the file with history**

```bash
mkdir -p public/classic
git mv public/index.html public/classic/index.html
```

- [ ] **Step 2: Make relative asset and page links root-absolute**

The page now lives one folder deeper, so `href="hire.html"` would break.

```bash
sed -i -E 's#(href|src)="(ai-workflow\.html|apple-touch-icon\.png|favicon\.svg|hire\.html|manifest\.json|resume\.html|profile\.jpeg|thumb-[a-z]+\.jpg|Zohn-Wheeler-Resume\.pdf|og-image\.png)#\1="/\2#g' public/classic/index.html
sed -i -E "s#(['\"])(ai-workflow|hire|resume)\.html#\1/\2.html#g" public/classic/index.html
```

- [ ] **Step 3: Verify no relative page or asset links remain**

```bash
grep -noE "(href|src)=\"[^\"/#:][^\"]*\"" public/classic/index.html
grep -noE "['\"](ai-workflow|hire|resume)\.html" public/classic/index.html
```

Expected: no output from either command. Links starting with `#`, `https:`, `mailto:` or `/` are fine. If the first command lists an `https:` or `mailto:` link, that is a false positive from the character class; ignore it.

- [ ] **Step 4: Point the canonical URL at `/classic/` and add the way back**

```bash
node - <<'JS'
const fs = require('fs');
const f = 'public/classic/index.html';
let s = fs.readFileSync(f, 'utf8');
s = s.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, '<link rel="canonical" href="https://zohnwheelerportfolio.pages.dev/classic/">');
const banner = '\n<a href="/?immersive=1" style="position:fixed;bottom:16px;left:16px;z-index:200;font:600 12px/1 ui-monospace,Consolas,monospace;color:#3dff9a;background:#04070a;border:1px solid #1d7a4c;border-radius:4px;padding:8px 12px;text-decoration:none">&gt; launch immersive version</a>';
s = s.replace(/<body([^>]*)>/, (m) => m + banner);
fs.writeFileSync(f, s);
JS
grep -n 'canonical\|launch immersive' public/classic/index.html
```

Expected: one canonical line pointing at `/classic/`, and one banner line. If the canonical line is missing because the old page had none, insert it into `<head>` by hand.

- [ ] **Step 5: Add cache rules**

Append to `public/_headers`:

```
/classic/
  Cache-Control: public, max-age=0, must-revalidate

/xp/*.js
  Cache-Control: public, max-age=0, must-revalidate

/xp/*.css
  Cache-Control: public, max-age=0, must-revalidate

/xp/voice/*
  Cache-Control: public, max-age=604800
```

Cloudflare merges headers from every matching rule, so the patterns are deliberately disjoint.

- [ ] **Step 6: Add `/classic/` to the sitemap**

```bash
node - <<'JS'
const fs = require('fs');
const f = 'public/sitemap.xml';
let s = fs.readFileSync(f, 'utf8');
if (!s.includes('/classic/')) {
  s = s.replace('</urlset>', '  <url>\n    <loc>https://zohnwheelerportfolio.pages.dev/classic/</loc>\n  </url>\n</urlset>');
  fs.writeFileSync(f, s);
}
JS
grep -n classic public/sitemap.xml
```

- [ ] **Step 7: Check it in the browser**

Start the server in the background with `npx wrangler pages dev public --port 8899`. Open `http://localhost:8899/classic/` with Chrome DevTools MCP and confirm:
- The profile image and the three project thumbnails load. The network panel shows no 404s.
- The Résumé and Hire links open the right pages.
- The "launch immersive version" link is visible bottom-left.

The root URL returns 404 until Task 6. That is expected.

- [ ] **Step 8: Commit**

```bash
git add public/classic/index.html public/_headers public/sitemap.xml
git commit -m "Move old homepage to /classic/ as the plain fallback" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Immersive shell and the boot act

**Files:**
- Create: `public/index.html`
- Create: `public/xp/xp.css`
- Create: `public/xp/core-fallback.css`
- Create: `public/xp/terminal.js`
- Create: `public/xp/main.js` (boot-only version; Task 7 replaces it)

**Interfaces:**
- Consumes: `createRegistry` and `createHistory` from Task 2; `getBootLines` and `formatLine` from Task 3.
- Produces: `createTerminal(root)` returning `{ print(item, cls?), typeLine(text, { cls, prompt, speed, typo: {at, wrong} }), run(raw), register(name, handler, help?), list(), setFast(bool), clear(), focus() }`. `print` accepts a string or `{ prefix?, text, href }`. It also produces the DOM ids Task 7 uses: `#terminal`, `#skip`, `#core`, `#core-stage`, `#rings`, `#caption`, `#live`, `#track-choice`, `#track-toggle`, `#sound`, `#panel`, `#panel-title`, and the `[data-cmd]` chips. Body class `is-core` switches from the boot act to the core.

- [ ] **Step 1: Create `public/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zohn Wheeler — Full-Stack Developer</title>
<meta name="description" content="Zohn Wheeler is a Kansas City full-stack developer and federal IT professional. Explore SportStrata, BotChase, ZRetroBuild and Sitekit through an interactive terminal.">
<link rel="canonical" href="https://zohnwheelerportfolio.pages.dev/">
<meta property="og:type" content="website">
<meta property="og:title" content="Zohn Wheeler — Full-Stack Developer">
<meta property="og:description" content="Boot the terminal. Meet the developer.">
<meta property="og:url" content="https://zohnwheelerportfolio.pages.dev/">
<meta property="og:image" content="https://zohnwheelerportfolio.pages.dev/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#04070a">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/xp/xp.css">
<link rel="stylesheet" href="/xp/core-fallback.css">
<script>
  // Reduced-motion visitors get the plain page unless they opted in this session.
  (function () {
    var opted = false;
    try {
      if (new URLSearchParams(location.search).get('immersive') === '1') sessionStorage.setItem('zw_immersive', '1');
      opted = sessionStorage.getItem('zw_immersive') === '1';
    } catch (e) {}
    if (!opted && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) location.replace('/classic/');
  })();
</script>
</head>
<body>
<div class="top-links"><a href="/classic/">plain version</a></div>
<button id="skip" class="skip" type="button">skip intro [any key]</button>

<main>
  <section id="terminal" class="terminal" aria-label="Terminal">
    <div class="term-out" data-term-out role="log"></div>
    <form class="term-form" data-term-form autocomplete="off">
      <label for="term-input" class="sr-only">Type a command</label>
      <span aria-hidden="true">&gt;</span>
      <input id="term-input" data-term-input type="text" spellcheck="false" autocapitalize="off" autocomplete="off">
    </form>
    <div class="chips" aria-label="Quick commands">
      <button type="button" data-cmd="help">help</button>
      <button type="button" data-cmd="ls projects">ls projects</button>
      <button type="button" data-cmd="track hire">track hire</button>
      <button type="button" data-cmd="track build">track build</button>
      <button type="button" data-cmd="cat resume">cat resume</button>
      <button type="button" data-cmd="contact">contact</button>
    </div>
  </section>

  <section id="core" class="core-window" aria-label="ZW-Core">
    <div class="core-bar">
      <span>ZW-CORE</span>
      <button id="sound" type="button" aria-pressed="false">sound: off</button>
      <button id="track-toggle" type="button" hidden></button>
    </div>
    <div id="core-stage" class="core-stage"></div>
    <nav id="rings" class="rings" aria-label="Projects"></nav>
    <p id="caption" class="caption" aria-hidden="true"></p>
    <p id="live" class="sr-only" aria-live="polite"></p>
    <div id="track-choice" class="track-choice" hidden>
      <button type="button" data-track="hire">I'm hiring</button>
      <button type="button" data-track="build">I need something built</button>
    </div>
    <aside id="panel" class="panel" hidden aria-labelledby="panel-title">
      <button type="button" class="close" aria-label="Close project">&times;</button>
      <img alt="" hidden>
      <h2 id="panel-title"></h2>
      <ul data-stack aria-label="Stack"></ul>
      <p data-story></p>
      <div class="links" data-links></div>
    </aside>
  </section>

  <article id="about-copy" class="sr-only">
    <h1>Zohn Wheeler, full-stack developer in Kansas City</h1>
    <p>Zohn Wheeler is an IT professional and software developer in Kansas City, Missouri. Zohn supports mission-critical treasury systems for a federal agency, holds an active security clearance, and builds full-stack products from Cloudflare Workers backends to AI-assisted workflows.</p>
    <h2>Projects</h2>
    <ul>
      <li><a href="https://sportstrata.cc/">SportStrata</a>: full-stack MLB analytics platform with live scorecards, Statcast leaderboards and AI-generated broadcast narratives.</li>
      <li><a href="https://botchase.onrender.com/">BotChase</a>: AI sales automation SaaS for local service businesses, with Stripe billing.</li>
      <li><a href="https://zretrobuild.zohnwheeler.workers.dev/">ZRetroBuild</a>: a playable 8-bit arcade in a CRT cabinet, with zero dependencies.</li>
      <li><a href="https://github.com/zohnner/OracleChatBot">Discord Educational Bot</a>: a senior capstone AI study bot featured by Mizzou Engineering.</li>
      <li><a href="/hire.html">Sitekit</a>: fast websites for local service businesses.</li>
    </ul>
    <h2>Contact</h2>
    <p><a href="mailto:zohnwheeler@gmail.com">zohnwheeler@gmail.com</a> · <a href="/resume.html">Résumé</a> · <a href="https://github.com/zohnner">GitHub</a> · <a href="https://www.linkedin.com/in/zohn-wheeler/">LinkedIn</a></p>
  </article>
</main>

<noscript>
  <style>.skip,.terminal,.core-window,.top-links{display:none!important}#about-copy{position:static;width:auto;height:auto;clip:auto;overflow:visible;white-space:normal;margin:0 auto;padding:24px 16px;max-width:720px}</style>
  <p style="padding:24px 16px"><a href="/classic/">Open the plain version of this site</a></p>
</noscript>
<script type="module" src="/xp/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/xp/xp.css`**

```css
:root {
  --bg: #04070a;
  --bg-2: #0a1218;
  --phosphor: #3dff9a;
  --phosphor-dim: #1d7a4c;
  --core: #4fd1ff;
  --core-dim: #1b5770;
  --text: #d7f5e6;
  --muted: #6c8a7c;
  --warn: #ffcc4d;
  --down: #ff5d5d;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --dock-h: 30vh;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
[hidden] { display: none !important; }
html, body { height: 100%; }
body { background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 15px; line-height: 1.55; overflow: hidden; }
body::after { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 50; background: repeating-linear-gradient(to bottom, rgba(255,255,255,.035) 0 1px, transparent 1px 3px); }
a { color: var(--core); }
:focus-visible { outline: 2px solid var(--core); outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
#about-copy:focus-within { position: fixed; left: 16px; right: 16px; bottom: 16px; width: auto; height: auto; clip: auto; overflow: visible; white-space: normal; margin: 0; padding: 16px; background: var(--bg-2); border: 1px solid var(--core-dim); z-index: 70; }

/* Top-right links */
.top-links { position: fixed; top: 12px; right: 16px; z-index: 60; display: flex; gap: 12px; }
.top-links a { font-size: 12px; color: var(--muted); border: 1px solid var(--phosphor-dim); padding: 4px 10px; border-radius: 3px; text-decoration: none; background: var(--bg); }
.top-links a:hover { color: var(--text); }

/* Terminal: full screen during boot */
.terminal { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: clamp(16px, 6vw, 80px); color: var(--phosphor); text-shadow: 0 0 6px rgba(61,255,154,.55); z-index: 10; transition: inset .6s cubic-bezier(.2,.8,.2,1), padding .6s; }
.term-out { max-width: 900px; width: 100%; margin: 0 auto; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }
.term-line { min-height: 1.55em; }
.term-line.tag-sleep, .term-line.tag-warn { color: var(--warn); }
.term-line.tag-down { color: var(--down); }
.term-echo { color: var(--text); }
.cursor { display: inline-block; width: .6em; height: 1.1em; margin-left: 1px; background: var(--phosphor); vertical-align: text-bottom; animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.term-form { display: none; max-width: 900px; width: 100%; margin: 8px auto 0; align-items: center; gap: 8px; }
.term-form input { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--phosphor); font: inherit; caret-color: var(--phosphor); text-shadow: inherit; }
.term-form input:focus { outline: none; }
.term-form:focus-within { outline: 1px dashed var(--phosphor-dim); outline-offset: 4px; }
.chips { display: none; flex-wrap: wrap; gap: 8px; max-width: 900px; width: 100%; margin: 10px auto 0; }
.chips button { font: inherit; font-size: 12px; color: var(--phosphor); background: rgba(61,255,154,.06); border: 1px solid var(--phosphor-dim); border-radius: 3px; padding: 6px 10px; cursor: pointer; }

/* Skip */
.skip { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 60; font: inherit; font-size: 12px; color: var(--muted); background: var(--bg); border: 1px solid var(--phosphor-dim); padding: 6px 14px; border-radius: 3px; cursor: pointer; }

/* Core act: terminal docks to the bottom */
body.is-core .skip { display: none; }
body.is-core .terminal { inset: auto 0 0 0; height: var(--dock-h); justify-content: flex-start; padding: 12px 16px; background: rgba(4,7,10,.94); border-top: 1px solid var(--phosphor-dim); font-size: 13px; z-index: 30; }
body.is-core .term-out { flex: 1; }
body.is-core .term-form { display: flex; }

/* Core window */
.core-window { position: fixed; inset: 0 0 var(--dock-h) 0; display: none; z-index: 20; background: radial-gradient(ellipse at center, #07202b 0%, var(--bg) 65%); }
body.is-core .core-window { display: block; animation: tear-in .7s steps(1, end) both, flash-in .7s ease both; }
@keyframes tear-in { 0% { clip-path: inset(48% 0 48% 0); } 20% { clip-path: inset(10% 0 70% 0); } 35% { clip-path: inset(60% 0 5% 0); } 50% { clip-path: inset(30% 0 30% 0); } 70% { clip-path: inset(5% 0 15% 0); } 100% { clip-path: inset(0); } }
@keyframes flash-in { from { opacity: 0; filter: brightness(2.5) hue-rotate(40deg); } to { opacity: 1; filter: none; } }
.core-bar { position: absolute; top: 12px; left: 16px; z-index: 5; display: flex; gap: 10px; align-items: center; font-size: 12px; color: var(--core); letter-spacing: .12em; }
.core-bar button { font: inherit; letter-spacing: normal; color: var(--muted); background: none; border: 1px solid var(--core-dim); border-radius: 3px; padding: 3px 8px; cursor: pointer; }
.core-bar button[aria-pressed="true"] { color: var(--core); border-color: var(--core); }
.core-stage { position: absolute; inset: 0; }
.core-stage canvas { display: block; width: 100%; height: 100%; }
.caption { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(720px, calc(100% - 32px)); min-height: 3em; text-align: center; color: var(--text); font-size: clamp(14px, 2vw, 18px); text-shadow: 0 0 12px rgba(79,209,255,.5); }
.track-choice { position: absolute; left: 50%; bottom: 100px; transform: translateX(-50%); width: calc(100% - 32px); display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.track-choice button { font: inherit; font-weight: 600; color: var(--bg); background: var(--core); border: 1px solid var(--core); border-radius: 3px; padding: 10px 18px; cursor: pointer; }
.track-choice button + button { color: var(--core); background: transparent; }

/* Project rings: HTML buttons orbiting the core */
@property --spin { syntax: '<angle>'; inherits: true; initial-value: 0deg; }
.rings { position: absolute; left: 50%; top: 50%; width: 0; height: 0; --r: min(34vmin, 300px); animation: orbit 120s linear infinite; z-index: 4; }
.rings:hover, .rings:focus-within { animation-play-state: paused; }
@keyframes orbit { to { --spin: 360deg; } }
.ring-node { --a: calc(var(--i) / var(--n) * 360deg + var(--spin)); position: absolute; left: 0; top: 0; transform: translate(-50%, -50%) rotate(var(--a)) translateX(var(--r)) rotate(calc(-1 * var(--a))); font: inherit; font-size: 13px; white-space: nowrap; color: var(--core); background: rgba(4,20,28,.8); border: 1px solid var(--core-dim); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
.ring-node:hover, .ring-node[aria-current="true"] { color: #fff; border-color: var(--c, var(--core)); box-shadow: 0 0 18px var(--c, var(--core)); }

/* Project panel */
.panel { position: absolute; right: 16px; top: 56px; bottom: 16px; width: min(380px, calc(100% - 32px)); overflow-y: auto; background: rgba(6,16,22,.92); border: 1px solid var(--core-dim); border-radius: 6px; padding: 16px; z-index: 6; animation: flash-in .35s ease both; }
.panel img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 4px; border: 1px solid var(--core-dim); }
.panel h2 { font-size: 18px; color: #fff; margin: 12px 0 6px; padding-right: 24px; }
.panel p { font-size: 14px; color: var(--text); }
.panel ul { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.panel li { font-size: 11px; color: var(--core); border: 1px solid var(--core-dim); border-radius: 999px; padding: 2px 8px; }
.panel .links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.panel .links a { font-weight: 600; font-size: 13px; color: var(--bg); background: var(--core); border-radius: 3px; padding: 8px 14px; text-decoration: none; }
.panel .close { position: absolute; top: 8px; right: 10px; font: inherit; font-size: 20px; background: none; border: 0; color: var(--muted); cursor: pointer; }

/* Phones: tappable chips replace typing */
@media (max-width: 640px) {
  :root { --dock-h: 36vh; }
  body { font-size: 13px; }
  body.is-core .chips { display: flex; }
  body.is-core .term-form { display: none; }
  .rings { --r: 36vw; }
  .ring-node { font-size: 11px; padding: 4px 10px; }
  .panel { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 62%; }
  .track-choice { bottom: 88px; }
}
```

- [ ] **Step 3: Create `public/xp/core-fallback.css`**

```css
/* CSS orb shown when WebGL or the Three.js CDN is unavailable (core.js mountCss). */
.core--css { display: grid; place-items: center; }
.css-orb { width: min(42vmin, 320px); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #fff 0%, var(--orb, #4fd1ff) 18%, rgba(79,209,255,.15) 55%, transparent 70%); box-shadow: 0 0 60px var(--orb, #4fd1ff), inset 0 0 40px rgba(255,255,255,.2); animation: orb-pulse 3.2s ease-in-out infinite; transition: background .6s, box-shadow .6s; }
.css-orb.is-speaking { animation-duration: .9s; }
@keyframes orb-pulse { 50% { transform: scale(1.06); filter: brightness(1.25); } }
```

- [ ] **Step 4: Create `public/xp/terminal.js`**

```js
// DOM terminal: typed lines, printed output, an input with history and tab
// completion. Command logic lives in commands.js.

import { createRegistry, createHistory } from './commands.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTerminal(root) {
  const out = root.querySelector('[data-term-out]');
  const form = root.querySelector('[data-term-form]');
  const input = root.querySelector('[data-term-input]');
  const registry = createRegistry();
  const history = createHistory();
  let fast = false;

  const scroll = () => { out.scrollTop = out.scrollHeight; };

  function addLine(cls) {
    const el = document.createElement('div');
    el.className = cls ? `term-line ${cls}` : 'term-line';
    out.append(el);
    return el;
  }

  function print(item, cls) {
    const el = addLine(cls);
    if (item && typeof item === 'object' && item.href) {
      if (item.prefix) el.append(item.prefix);
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.text;
      if (/^https?:/.test(item.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      el.append(a);
    } else {
      el.textContent = String(item ?? '');
    }
    scroll();
    return el;
  }

  async function typeLine(text, { cls, prompt = '', speed = 55, typo } = {}) {
    const el = addLine(cls);
    const typed = document.createTextNode(prompt);
    const caret = document.createElement('span');
    caret.className = 'cursor';
    el.append(typed, caret);
    for (let i = 0; i < text.length && !fast; i++) {
      if (typo && i === typo.at) {
        for (const ch of typo.wrong) { typed.data += ch; await sleep(speed); }
        await sleep(260);
        for (let k = 0; k < typo.wrong.length; k++) { typed.data = typed.data.slice(0, -1); await sleep(speed * 0.7); }
      }
      typed.data += text[i];
      scroll();
      await sleep(speed + Math.random() * speed);
    }
    typed.data = prompt + text;
    caret.remove();
    scroll();
    return el;
  }

  async function run(raw) {
    print(`> ${raw}`, 'term-echo');
    history.push(raw);
    const { output } = await registry.run(raw);
    for (const item of output) print(item);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    if (value.trim()) run(value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); input.value = history.prev(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); input.value = history.next(); return; }
    if (e.key !== 'Tab') return;
    const value = input.value.trim();
    if (!value || value.includes(' ')) return;
    const matches = registry.complete(value);
    if (matches.length === 1) { e.preventDefault(); input.value = `${matches[0]} `; }
    else if (matches.length > 1) { e.preventDefault(); print(matches.join('  ')); }
  });

  return {
    print,
    typeLine,
    run,
    register: registry.register,
    list: registry.list,
    setFast(value) { fast = !!value; },
    clear() { out.replaceChildren(); },
    focus() { input.focus({ preventScroll: true }); },
  };
}
```

- [ ] **Step 5: Create the boot-only `public/xp/main.js`**

```js
// Boot-only version. Task 7 replaces this file with the full sequence.

import { createTerminal } from './terminal.js';
import { getBootLines, formatLine } from './boot.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
if (params.has('fresh')) store.remove('zw_visited');

const term = createTerminal($('#terminal'));
const state = { opened: false, skipped: false };

async function boot() {
  const lines = getBootLines({ url: params.has('offline') ? '/api/__offline' : '/api/status' });
  await term.typeLine('who is zohn_wheeler', { prompt: '> ', typo: { at: 7, wrong: 'zhon' } });
  for (const line of await lines) {
    if (state.skipped) return;
    await sleep(160);
    term.print(formatLine(line), `tag-${line.tag.toLowerCase()}`);
  }
  await sleep(500);
}

function openCore() {
  if (state.opened) return;
  state.opened = true;
  store.set('zw_visited', '1');
  document.body.classList.add('is-core');
  term.print("identity core online. type 'help' for commands.");
}

function skip() {
  if (state.opened) return;
  state.skipped = true;
  term.setFast(true);
  openCore();
}

term.register('help', () => term.list().map((c) => c.help), 'help: list commands');
term.register('clear', () => { term.clear(); }, 'clear: clear the terminal');

$('#skip').addEventListener('click', skip);
addEventListener('keydown', (e) => {
  if (state.opened || e.key === 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
  skip();
});
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => term.run(b.dataset.cmd)));

if (store.get('zw_visited') === '1') {
  term.print('> who is zohn_wheeler');
  term.print('welcome back. skipping boot sequence.');
  openCore();
} else {
  boot().then(openCore);
}
```

- [ ] **Step 6: Verify in the browser**

With the dev server running on port 8899, use Chrome DevTools MCP:
1. Open `http://localhost:8899/?fresh`. The question types with one typo that is backspaced. Boot lines then stream with a real `uplink`, `service SportStrata` and the other live lines. In local dev the visitor line may be missing because `request.cf` has no city. That is fine. The page then docks the terminal and shows the empty core window.
2. Reload `http://localhost:8899/`. Boot is skipped with "welcome back".
3. Open `http://localhost:8899/?fresh&offline`. The fallback lines with the yellow `WARN` line appear.
4. Open `http://localhost:8899/?fresh` and press a letter key mid-typing. The page skips straight to the core.
5. In the docked terminal, type `help` and press Enter, then `cl` and Tab, then the up arrow. Help prints, completion fills `clear `, and history recalls `help`.
6. Take screenshots at 1440×900 and 390×844. The console must show no errors.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/xp/xp.css public/xp/core-fallback.css public/xp/terminal.js public/xp/main.js
git commit -m "xp: immersive shell, CRT terminal and live boot act" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: AI core, narration, tracks and commands

**Files:**
- Create: `public/xp/core.js`
- Create: `public/xp/narrator.js`
- Replace: `public/xp/main.js`

**Interfaces:**
- Consumes: everything from Tasks 1–3 and 6.
- Produces:
  - `mountCore(container, { particles = 2400, forceCss = false, threeUrl })` returning a promise of `{ mode: 'webgl' | 'css', setState('idle' | 'speaking' | 'focus'), focus(projectId | null) }`. It never rejects for WebGL or CDN failure; it falls back to the CSS orb.
  - `createNarrator({ captionEl, liveEl, voiceBase = '/xp/voice/', charMs = 32, onSpeakStart, onSpeakEnd })` returning `{ say(id) → Promise, caption(text) → Promise, setSound(bool), sound }`. Task 8 adds the `.mp3` files that `say` plays.

- [ ] **Step 1: Confirm the pinned Three.js build exists**

```bash
curl -sI https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js | head -1
```

Expected: `HTTP/2 200`.

- [ ] **Step 2: Create `public/xp/core.js`**

```js
// The AI core: a Three.js particle orb with orbit lines. Falls back to a CSS
// orb when WebGL or the CDN is unavailable. The clickable project rings are
// HTML buttons owned by main.js, so they stay accessible.

import { PROJECTS } from './content.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';
const BASE_COLOR = '#4fd1ff';
const AMP = { idle: 0.04, speaking: 0.16, focus: 0.08 };
const colorOf = (id) => PROJECTS.find((p) => p.id === id)?.color ?? BASE_COLOR;

const VERT = `
uniform float uTime;
uniform float uAmp;
uniform float uSize;
void main() {
  vec3 p = position;
  float n = sin(p.x * 3.0 + uTime * 1.4) * cos(p.y * 3.5 + uTime * 1.1) * sin(p.z * 3.0 + uTime * 0.8);
  p += normalize(p) * n * uAmp * 3.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (5.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * 0.9);
}`;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function mountCss(container) {
  container.replaceChildren();
  container.classList.add('core--css');
  const orb = document.createElement('div');
  orb.className = 'css-orb';
  orb.setAttribute('aria-hidden', 'true');
  container.append(orb);
  return {
    mode: 'css',
    setState(state) { orb.classList.toggle('is-speaking', state === 'speaking'); },
    focus(id) { orb.style.setProperty('--orb', colorOf(id)); },
  };
}

function mountGl(THREE, container, particles) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 6.5;

  // Even points on a sphere (Fibonacci lattice).
  const positions = new Float32Array(particles * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < particles; i++) {
    const y = 1 - (i / (particles - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    positions.set([Math.cos(theta) * r * 1.4, y * 1.4, Math.sin(theta) * r * 1.4], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: AMP.idle },
    uSize: { value: 3 * renderer.getPixelRatio() },
    uColor: { value: new THREE.Color(BASE_COLOR) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const orb = new THREE.Points(geometry, material);
  scene.add(orb);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: BASE_COLOR, transparent: true, opacity: 0.3 });
  const rings = [2.1, 2.5, 2.9].map((radius, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.005, 6, 180), ringMaterial);
    ring.rotation.set(1.15 + i * 0.22, i * 0.7, 0);
    scene.add(ring);
    return ring;
  });

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  let targetAmp = AMP.idle;
  const targetColor = new THREE.Color(BASE_COLOR);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    uniforms.uAmp.value += (targetAmp - uniforms.uAmp.value) * Math.min(1, dt * 4);
    uniforms.uColor.value.lerp(targetColor, Math.min(1, dt * 3));
    ringMaterial.color.lerp(targetColor, Math.min(1, dt * 3));
    orb.rotation.y += dt * 0.12;
    rings.forEach((ring, i) => { ring.rotation.z += dt * (0.05 + i * 0.03) * (i % 2 ? -1 : 1); });
    renderer.render(scene, camera);
  });

  return {
    mode: 'webgl',
    setState(state) { targetAmp = AMP[state] ?? AMP.idle; },
    focus(id) { targetColor.set(colorOf(id)); },
  };
}

export async function mountCore(container, { particles = 2400, forceCss = false, threeUrl = THREE_URL } = {}) {
  if (forceCss || !hasWebGL()) return mountCss(container);
  let THREE;
  try {
    THREE = await import(threeUrl);
  } catch {
    return mountCss(container);
  }
  try {
    return mountGl(THREE, container, particles);
  } catch {
    return mountCss(container);
  }
}
```

- [ ] **Step 3: Create `public/xp/narrator.js`**

```js
// Captions first, voice second. Every line is typed into the visible caption
// and announced once, in full, to screen readers. Audio plays only when the
// visitor has turned sound on, and a missing clip is silently skipped.

import { NARRATION } from './content.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createNarrator({
  captionEl,
  liveEl,
  voiceBase = '/xp/voice/',
  charMs = 32,
  onSpeakStart = () => {},
  onSpeakEnd = () => {},
}) {
  let sound = false;
  let audio = null;
  let release = null;
  let token = 0;

  function stopAudio() {
    if (audio) { audio.pause(); audio = null; }
    if (release) { release(); release = null; }
  }

  async function show(text, voiceId) {
    const mine = ++token;
    stopAudio();
    liveEl.textContent = text;
    captionEl.textContent = '';
    onSpeakStart();

    let done = sleep(700);
    if (sound && voiceId) {
      const clip = new Audio(`${voiceBase}${voiceId}.mp3`);
      audio = clip;
      done = new Promise((resolve) => {
        release = resolve;
        clip.addEventListener('ended', resolve, { once: true });
        clip.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 15000);
      });
      clip.play().catch(() => stopAudio());
    }

    for (const ch of text) {
      if (mine !== token) return;
      captionEl.textContent += ch;
      await sleep(charMs);
    }
    await done;
    if (mine === token) onSpeakEnd();
  }

  return {
    say(id) {
      const text = NARRATION[id];
      return text ? show(text, id) : Promise.resolve();
    },
    caption(text) { return show(String(text), null); },
    setSound(on) {
      sound = !!on;
      if (!sound) stopAudio();
    },
    get sound() { return sound; },
  };
}
```

- [ ] **Step 4: Replace `public/xp/main.js` with the full sequence**

```js
// Runs the story: boot (acts 1-2), core (act 3), track view (act 4).
// The only module that knows the act order.

import { PROJECTS, TRACKS, OWNER } from './content.js';
import { createTerminal } from './terminal.js';
import { getBootLines, formatLine } from './boot.js';
import { createNarrator } from './narrator.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
if (params.has('fresh')) { store.remove('zw_visited'); store.remove('zw_track'); }

const projectById = new Map(PROJECTS.map((p) => [p.id, p]));
const phone = matchMedia('(max-width: 640px)').matches;
const state = { opened: false, skipped: false, track: null, focused: null };

const term = createTerminal($('#terminal'));

// Start loading the orb immediately; the boot sequence hides the wait.
let core = null;
const corePromise = import('./core.js')
  .then((m) => m.mountCore($('#core-stage'), { particles: phone ? 900 : 2400, forceCss: params.has('css-core') }))
  .then((c) => { core = c; return c; })
  .catch(() => null);

const narrator = createNarrator({
  captionEl: $('#caption'),
  liveEl: $('#live'),
  onSpeakStart: () => core?.setState('speaking'),
  onSpeakEnd: () => core?.setState(state.focused ? 'focus' : 'idle'),
});

// ---------- Acts 1-2: boot ----------

async function boot() {
  const lines = getBootLines({ url: params.has('offline') ? '/api/__offline' : '/api/status' });
  await term.typeLine('who is zohn_wheeler', { prompt: '> ', typo: { at: 7, wrong: 'zhon' } });
  for (const line of await lines) {
    if (state.skipped) return;
    await sleep(160);
    term.print(formatLine(line), `tag-${line.tag.toLowerCase()}`);
  }
  await sleep(500);
}

function skip() {
  if (state.opened) return;
  state.skipped = true;
  term.setFast(true);
  openCore();
}

// ---------- Act 3: the core ----------

async function openCore() {
  if (state.opened) return;
  state.opened = true;
  const returning = store.get('zw_visited') === '1';
  store.set('zw_visited', '1');
  document.body.classList.add('is-core');
  term.print("identity core online. type 'help' for commands.");
  await Promise.race([corePromise, sleep(2500)]);

  if (returning) {
    await narrator.say('welcome');
    const saved = store.get('zw_track');
    if (TRACKS[saved] && !state.track) { chooseTrack(saved); return; }
  } else {
    await narrator.say('intro');
    await narrator.say('bio');
  }
  if (state.track) return;
  await narrator.say('ask');
  if (!state.track) showTrackChoice();
}

function showTrackChoice() {
  const choice = $('#track-choice');
  choice.hidden = false;
  choice.querySelector('button').focus({ preventScroll: true });
}

// ---------- Act 4: tracks, rings and panel ----------

function chooseTrack(track, { quiet = false } = {}) {
  if (!TRACKS[track]) return false;
  state.track = track;
  store.set('zw_track', track);
  $('#track-choice').hidden = true;
  const toggle = $('#track-toggle');
  toggle.hidden = false;
  toggle.textContent = `track: ${track}`;
  renderRings();
  if (!quiet) narrator.say(`track.${track}`);
  return true;
}

function renderRings() {
  const order = TRACKS[state.track].order;
  $('#rings').replaceChildren(...order.map((id, i) => {
    const p = projectById.get(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ring-node';
    b.textContent = p.name;
    b.dataset.id = id;
    b.style.setProperty('--i', i);
    b.style.setProperty('--n', order.length);
    b.style.setProperty('--c', p.color);
    if (state.focused === id) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => focusProject(id));
    return b;
  }));
}

function markCurrent() {
  document.querySelectorAll('.ring-node').forEach((b) => {
    if (b.dataset.id === state.focused) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
}

function focusProject(id, { moveFocus = true } = {}) {
  const p = projectById.get(id);
  if (!p) return false;
  if (!state.track) chooseTrack('hire', { quiet: true });
  state.focused = id;
  core?.focus(id);
  markCurrent();
  renderPanel(p, moveFocus);
  narrator.say(`project.${id}`);
  return true;
}

function renderPanel(p, moveFocus) {
  const panel = $('#panel');
  const img = panel.querySelector('img');
  if (p.thumb) { img.src = p.thumb; img.alt = `${p.name} screenshot`; img.hidden = false; }
  else { img.removeAttribute('src'); img.alt = ''; img.hidden = true; }
  $('#panel-title').textContent = p.name;
  panel.querySelector('[data-story]').textContent = p.story;
  panel.querySelector('[data-stack]').replaceChildren(...p.stack.map((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    return li;
  }));
  panel.querySelector('[data-links]').replaceChildren(...p.links.map((l) => {
    const a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.label;
    if (/^https?:/.test(l.href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }));
  panel.hidden = false;
  if (moveFocus) panel.querySelector('.close').focus({ preventScroll: true });
}

function closePanel() {
  const returnTo = state.focused;
  $('#panel').hidden = true;
  state.focused = null;
  core?.focus(null);
  core?.setState('idle');
  markCurrent();
  document.querySelector(`.ring-node[data-id="${returnTo}"]`)?.focus({ preventScroll: true });
}

function setSound(on) {
  narrator.setSound(on);
  const b = $('#sound');
  b.setAttribute('aria-pressed', String(on));
  b.textContent = `sound: ${on ? 'on' : 'off'}`;
}

// ---------- Commands ----------

term.register('help', () => term.list().map((c) => c.help), 'help: list commands');
term.register('ls', (args) => (args[0] === 'projects'
  ? TRACKS[state.track ?? 'hire'].order.map((id) => `${id.padEnd(12)} ${projectById.get(id).name}`)
  : 'usage: ls projects'), 'ls projects: list projects');
term.register('open', (args) => {
  const id = (args[0] ?? '').toLowerCase();
  if (!id) return 'usage: open <project>';
  return focusProject(id, { moveFocus: false }) ? `opening ${projectById.get(id).name}...` : `open: ${id}: no such project. try 'ls projects'.`;
}, 'open <project>: focus a project');
term.register('track', (args) => {
  const t = (args[0] ?? '').toLowerCase();
  return chooseTrack(t) ? `track set: ${t}` : 'usage: track hire|build';
}, 'track hire|build: switch audience');
term.register('cat', (args) => ((args[0] ?? '').toLowerCase() === 'resume'
  ? { prefix: 'résumé: ', text: '/resume.html', href: '/resume.html' }
  : `cat: ${args[0] ?? ''}: no such file`), 'cat resume: view résumé');
term.register('contact', () => [
  TRACKS[state.track ?? 'hire'].contact,
  { prefix: 'linkedin: ', text: OWNER.linkedin, href: OWNER.linkedin },
], 'contact: get in touch');
term.register('sound', (args) => {
  const v = (args[0] ?? '').toLowerCase();
  if (v !== 'on' && v !== 'off') return 'usage: sound on|off';
  setSound(v === 'on');
  return `sound ${v}`;
}, 'sound on|off: toggle voice');
term.register('classic', () => { location.href = '/classic/'; return 'loading plain version...'; }, 'classic: plain version of this site');
term.register('clear', () => { term.clear(); }, 'clear: clear the terminal');
term.register('whoami', () => 'guest. curious, apparently. good sign.');
term.register('sudo', (args) => (args.join(' ').toLowerCase() === 'hire zohn'
  ? ['[sudo] access granted.', { prefix: 'next step: ', text: OWNER.email, href: `mailto:${OWNER.email}` }]
  : 'nice try.'));

// ---------- Wiring ----------

$('#skip').addEventListener('click', skip);
$('#sound').addEventListener('click', () => setSound(!narrator.sound));
$('#track-toggle').addEventListener('click', () => chooseTrack(state.track === 'hire' ? 'build' : 'hire'));
document.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => chooseTrack(b.dataset.track)));
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => term.run(b.dataset.cmd)));
$('#panel .close').addEventListener('click', closePanel);

addEventListener('keydown', (e) => {
  if (!state.opened) {
    if (e.key === 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
    skip();
    return;
  }
  if (e.key === 'Escape' && !$('#panel').hidden) closePanel();
});

if (store.get('zw_visited') === '1') {
  term.print('> who is zohn_wheeler');
  term.print('welcome back. skipping boot sequence.');
  openCore();
} else {
  boot().then(openCore);
}
```

- [ ] **Step 5: Run the unit suite**

Run: `npm test`
Expected: all tests pass. This task adds no new unit tests, because the new files are DOM and WebGL code checked in the browser below.

- [ ] **Step 6: Verify in the browser**

With the dev server on port 8899, use Chrome DevTools MCP:
1. Open `/?fresh`. After the boot sequence, the core tears open and the orb renders. The captions type intro, then bio, then the ask line, and the two track buttons appear with the first one focused.
2. Click "I'm hiring". The rings render in the hire order and the caption plays the hire line. Click SportStrata. The orb shifts toward its color, the panel shows the thumbnail, stack, story and links, and focus moves to the close button. Press Escape. The panel closes and focus returns to the SportStrata ring.
3. In the terminal, run `track build`, `ls projects`, `open sitekit`, `cat resume`, `contact`, `sudo hire zohn` and `nope`. Each prints the expected output. `open sitekit` must not steal focus from the input.
4. Open `/?fresh&css-core`. The CSS orb appears in place of WebGL and pulses faster while captions type.
5. Reload `/` without parameters. The welcome-back line plays and the saved track is restored with no ask.
6. Keyboard only from `/?fresh`: press Tab to reach "skip intro" and Enter, then reach a track button, a ring and the panel close button. Each shows a visible focus ring.
7. Take screenshots at 1440×900 and 390×844. On the phone size, chips show in place of the input and the panel is a bottom sheet. The console must show no errors.

- [ ] **Step 7: Commit**

```bash
git add public/xp/core.js public/xp/narrator.js public/xp/main.js
git commit -m "xp: AI core orb, captioned narration, tracks and commands" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Voice clips

**Files:**
- Create: `scripts/render-voice.mjs`
- Create: `public/xp/voice/*.mp3`
- Modify: `.gitignore` (add `.voices/` only; the file has unrelated unstaged edits, so stage just this hunk)

**Interfaces:**
- Consumes: `NARRATION` from Task 1. `narrator.js` from Task 7 requests `/xp/voice/<id>.mp3`.
- Produces: one MP3 per `NARRATION` key, each 30 KB or less.

- [ ] **Step 1: Install Piper and confirm its CLI**

```bash
python -m pip install piper-tts
python -m piper --help
python -m piper.download_voices --help
ffmpeg -version | head -1
```

Expected: help text for both Piper commands, and an ffmpeg version line. Read the help output. If the flags for the model (`-m`), output file (`-f`) or data directory (`--data-dir`) are spelled differently in the installed version, use the installed spelling in Step 2.

- [ ] **Step 2: Create `scripts/render-voice.mjs`**

```js
// Renders public/xp/voice/<id>.mp3 for every line in NARRATION with Piper
// (free, local TTS) and ffmpeg. Re-run after editing narration text.
//
//   node scripts/render-voice.mjs [--voice en_GB-alan-medium] [--only intro,bio] [--out public/xp/voice]

import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { NARRATION } from '../public/xp/content.js';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const voice = opt('voice', 'en_GB-alan-medium');
const outDir = resolve(opt('out', 'public/xp/voice'));
const only = opt('only', '').split(',').filter(Boolean);
const dataDir = resolve('.voices');
const python = process.env.PYTHON || 'python';
const MAX_BYTES = 30 * 1024;

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(' ')}\n${r.stderr || r.error}`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });
if (!existsSync(join(dataDir, `${voice}.onnx`))) run(python, ['-m', 'piper.download_voices', '--data-dir', dataDir, voice]);

let over = 0;
for (const [id, text] of Object.entries(NARRATION)) {
  if (only.length && !only.includes(id)) continue;
  const wav = join(tmpdir(), `zw-voice-${id}.wav`);
  const mp3 = join(outDir, `${id}.mp3`);
  run(python, ['-m', 'piper', '--data-dir', dataDir, '-m', voice, '-f', wav], text);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '22050', '-b:a', '32k', mp3]);
  rmSync(wav, { force: true });
  const size = statSync(mp3).size;
  if (size > MAX_BYTES) over += 1;
  console.log(`${size > MAX_BYTES ? 'OVER' : 'ok  '} ${id}.mp3 ${(size / 1024).toFixed(1)} KB`);
}
if (over) {
  console.error(`${over} clip(s) over 30 KB. Shorten those lines in content.js and re-run.`);
  process.exit(1);
}
```

- [ ] **Step 3: Ignore downloaded voice models**

Append `.voices/` to `.gitignore`, then stage only that line:

```bash
printf '\n.voices/\n' >> .gitignore
git add -p .gitignore
```

`git add -p` is interactive. If the environment cannot answer its prompts, stage the single line another way: save the current `.gitignore`, restore the committed version with `git show HEAD:.gitignore > .gitignore`, append `.voices/`, `git add .gitignore`, then restore the saved working copy (which also contains `.voices/`). Never stage the unrelated `.gitignore` edits.

- [ ] **Step 4: Render voice candidates for Zohn to pick**

```bash
for v in en_GB-alan-medium en_US-ryan-high en_GB-northern_english_male-medium; do
  node scripts/render-voice.mjs --voice "$v" --only intro --out "$TMPDIR/zw-voices/$v"
done
```

Play the three `intro.mp3` files to Zohn and ask which voice fits ZW-Core. If no answer is available, use `en_GB-alan-medium`.

- [ ] **Step 5: Render every clip with the chosen voice**

Run: `node scripts/render-voice.mjs --voice <chosen-voice>`
Expected: one `ok` line per narration id and exit code 0. If any line prints `OVER`, shorten that line in `public/xp/content.js`, re-run `node --test test/xp-content.test.mjs`, and render again.

- [ ] **Step 6: Verify in the browser**

Open `/?fresh`, skip to the core, and click "sound: off" to turn sound on. The next captioned line is voiced. The orb stays in the speaking state until the clip ends. Turn sound off mid-line: audio stops at once and captions continue. Confirm in the network panel that each clip is under 30 KB.

- [ ] **Step 7: Commit**

```bash
git add scripts/render-voice.mjs public/xp/voice/
git commit -m "xp: Piper-rendered narration clips and render script" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The `.gitignore` line was staged in Step 3, so it is included in this commit.

---

### Task 9: Full verification pass

**Files:**
- Modify: `docs/superpowers/specs/2026-10-11-immersive-portfolio-design.md` (status line only)

**Interfaces:**
- Consumes: the finished feature.
- Produces: evidence that every spec requirement holds, and a spec marked implemented.

- [ ] **Step 1: Unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Weight budget**

```bash
du -cb public/index.html public/xp/*.js public/xp/*.css | tail -1
```

Expected: under 256000 bytes. Google Fonts and Three.js are excluded, because the font is external and Three.js loads after first paint. If the total is over budget, report it rather than trimming features silently.

- [ ] **Step 3: Failure-mode checks in Chrome DevTools MCP**

| Check | How | Expected |
|---|---|---|
| Status endpoint down | Open `/?fresh&offline` | Fallback lines with `WARN`, no stall |
| WebGL or CDN unavailable | Open `/?fresh&css-core` | CSS orb, everything else works |
| Reduced motion | Emulate `prefers-reduced-motion: reduce`, open `/` | Redirects to `/classic/` |
| Opt back in | With reduced motion, open `/?immersive=1`, then reload `/` | Immersive both times this session |
| Storage blocked | Run `localStorage.clear()` in the console, reload | Treated as a first visit |
| JavaScript off | Disable JS, open `/` | Noscript link and readable bio and projects |
| Phone | 390×844 | Chips, bottom-sheet panel, no horizontal scroll |

- [ ] **Step 4: Lighthouse**

Run the Chrome DevTools MCP Lighthouse audit on `http://localhost:8899/?immersive=1` for desktop and mobile. Report the Accessibility and Performance scores, and fix any accessibility failure that comes from the new markup.

- [ ] **Step 5: Mark the spec implemented**

Change the spec's status line to `**Status:** Implemented on branch immersive-portfolio`.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-10-11-immersive-portfolio-design.md
git commit -m "Mark immersive portfolio spec implemented" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Hand off**

Use superpowers:finishing-a-development-branch. Do not deploy or merge to `main` without Zohn's go-ahead, because a push to `main` deploys to Cloudflare Pages.
