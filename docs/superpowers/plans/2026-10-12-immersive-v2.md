# Immersive Portfolio v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage feel like a real old-school terminal (CRT physics, power on/off, BIOS self-test, text-mode windows with ASCII art, a virtual filesystem, live-data commands) and make the AI the operator of the experience (types into the terminal, reacts, scans projects live, answers plain-English questions, tells how it was built).

**Architecture:** Same stack as v1: plain ES modules in `public/xp/`, Cloudflare Pages Functions, no build step. Pure logic lives in small Node-testable modules (`fs.js`, `answers.js`, `tui.js`, `ascii.js`, `bios.js`, `live.js`, `crt.js`). DOM units (`terminal.js`, `operator.js`, `voice.js`, `reactions.js`, `screensaver.js`, `shell.js`, `main.js`) are verified in a real browser. A shared server helper (`server/github.mjs`) backs two new endpoints.

**Tech Stack:** Vanilla JS ES modules, Three.js r169 (existing), Cloudflare Pages Functions + Cache API, Node 24 `node --test`, Chrome DevTools MCP.

**Spec:** `docs/superpowers/specs/2026-10-12-immersive-v2-design.md` (builds on `docs/superpowers/specs/2026-10-11-immersive-portfolio-design.md`)

## Global Constraints

- No paid APIs. No build step. No new client libraries.
- Page weight before the orb loads: 250 KB or less.
- `localStorage` and `sessionStorage` access is always wrapped in try/catch.
- Visible copy never uses gendered pronouns for Zohn. Use the name.
- Everything shown as live must be real. When data is unavailable, say so; never invent numbers.
- Visitor device details are read in the browser, shown only to that visitor, never sent anywhere.
- No element flashes more than 3 times per second; CRT flicker changes opacity by 3% or less.
- Endpoints always return HTTP 200 JSON and never log visitor data. Failures are never cached.
- Voice stays off behind `VOICE_ENABLED` (already `false` in `content.js`).
- CLS stays under 0.1 on first and returning visits. Animate only `transform` and `opacity`.
- Work on branch `immersive-v2`. Stage files by explicit path. Never stage the unrelated working-tree files (`.gitignore` edits, `.agents/`, `AGENTS.md`, `adapters/`, `todos.md`, `docs/noodle-handoff.md`, `.gitattributes`, `.noodle.toml`).
- Commit messages end with a blank line and a `Co-Authored-By:` trailer.
- Local dev server: `npx wrangler pages dev public --port 8899`. Stop it before reporting.
- Edit files with Bash or the Edit/Write tools, never PowerShell `Set-Content`.

## Spec refinements made while planning

- Command registration moves from `main.js` into a new `public/xp/shell.js`, so `main.js` keeps only the act order. `main.js` passes `shell.js` the functions it needs.
- The text-mode window frame uses a CSS double border plus a title row of box characters. Measuring character columns in JS is not needed. `tui.frame` is used for the boxed `scan` report in the terminal.
- `narrator.js` is deleted. `operator.js` speaks, and `voice.js` plays clips only when `VOICE_ENABLED`.
- The BIOS memory line is omitted when `navigator.deviceMemory` is absent, as the spec says.
- Projects without a public repo (BotChase) have `repo: null`. `scan botchase` says so honestly.

## File Map

| File | Status | Task |
|---|---|---|
| `public/xp/content.js` | modify: add `repo`, `ABOUT`, `MAN`, `BANNER`, `KB`, `FALLBACK_REPLY` | 1 |
| `test/xp-content.test.mjs` | modify | 1 |
| `public/xp/commands.js`, `test/xp-commands.test.mjs` | modify: `names()`, `setFallback()` | 2 |
| `public/xp/fs.js`, `test/xp-fs.test.mjs` | create | 3 |
| `public/xp/answers.js`, `test/xp-answers.test.mjs` | create | 4 |
| `public/xp/tui.js`, `public/xp/ascii.js`, `public/xp/bios.js`, `public/xp/crt.js` + tests | create | 5 |
| `public/xp/live.js`, `test/xp-live.test.mjs` | create | 6 |
| `server/github.mjs`, `functions/api/gitlog.js`, `functions/api/scan.js`, `functions/api/status.js` + tests | create / modify | 7 |
| `scripts/build-log.mjs`, `public/xp/buildlog.json`, `test/build-log.test.mjs` | create | 8 |
| `public/xp/terminal.js`, `public/xp/operator.js`, `public/xp/voice.js`, `public/xp/core.js`, `public/xp/core-fallback.css` | modify / create | 9 |
| `public/xp/reactions.js`, `public/xp/screensaver.js` | create | 10 |
| `public/xp/shell.js`, `public/xp/main.js`, `public/index.html`, `public/xp/xp.css`; delete `public/xp/narrator.js` | create / replace / modify | 11 |
| verification, `buildlog.json` refresh, spec status | — | 12 |

---

### Task 1: Content additions

**Files:**
- Modify: `public/xp/content.js`
- Modify: `test/xp-content.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PROJECTS[i].repo: string | null`, in the form `owner/name`.
  - `ABOUT: string[]`, `MAN: string[]`, `BANNER: string[]` (3 lines of equal width).
  - `KB: { id, keywords: string[], reply }[]`, where each keyword is one lowercase token as produced by `answers.tokenize` in Task 4.
  - `FALLBACK_REPLY: string`.

- [ ] **Step 1: Add the failing tests**

Append to `test/xp-content.test.mjs` (keep the existing tests; extend the import):

```js
import { KB, MAN, ABOUT, BANNER, FALLBACK_REPLY } from '../public/xp/content.js';

test('repo fields are owner/name or null', () => {
  for (const p of PROJECTS) {
    assert.ok(p.repo === null || /^[\w.-]+\/[\w.-]+$/.test(p.repo), `${p.id} repo`);
  }
  assert.equal(PROJECTS.find((p) => p.id === 'sportstrata').repo, 'zohnner/zohn-sports-stats');
  assert.equal(PROJECTS.find((p) => p.id === 'botchase').repo, null);
});

test('KB entries are well formed', () => {
  const kbIds = KB.map((e) => e.id);
  assert.equal(new Set(kbIds).size, kbIds.length);
  assert.ok(KB.length >= 14);
  for (const e of KB) {
    assert.ok(e.keywords.length > 0, e.id);
    for (const k of e.keywords) assert.match(k, /^[a-z0-9+#]+$/, `${e.id} keyword ${k}`);
    assert.ok(e.reply.length > 20 && e.reply.length <= 280, `${e.id} reply length ${e.reply.length}`);
  }
});

test('banner is three lines of equal width', () => {
  assert.equal(BANNER.length, 3);
  assert.equal(new Set(BANNER.map((l) => [...l].length)).size, 1);
});

test('no gendered pronouns in visitor-facing copy', () => {
  const copy = [
    ...KB.map((e) => e.reply), ...MAN, ...ABOUT, FALLBACK_REPLY,
    ...Object.values(NARRATION), ...PROJECTS.map((p) => p.story),
  ].join('\n');
  assert.doesNotMatch(copy, /\b(he|him|his|she|her|hers|himself|herself)\b/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-content.test.mjs`
Expected: FAIL, because `KB` and the others are not exported.

- [ ] **Step 3: Implement**

In `public/xp/content.js`:

1. Add a `repo` field to each project, right after `healthUrl`:
   - `sportstrata`: `repo: 'zohnner/zohn-sports-stats',`
   - `botchase`: `repo: null,`
   - `zretrobuild`: `repo: 'zohnner/ZRetroBuild',`
   - `oraclebot`: `repo: 'zohnner/OracleChatBot',`
   - `sitekit`: `repo: 'zohnner/ZohnWheelerPortfolio',`
2. Append at the end of the file:

```js
// about.txt in the virtual filesystem.
export const ABOUT = [
  'Zohn Wheeler: full-stack developer, Kansas City, MO.',
  '',
  'Supports mission-critical treasury systems for a federal agency',
  '(active TS/SCI clearance) and ships full-stack products end to end:',
  'Cloudflare Workers backends, AI-assisted workflows and fast sites',
  'for local businesses.',
  '',
  'Try: cat contact.txt, cd projects, man zohn',
];

// `man zohn`.
export const MAN = [
  'ZOHN(1)                     User Commands                     ZOHN(1)',
  '',
  'NAME',
  '    zohn - full-stack developer and federal IT professional',
  '',
  'SYNOPSIS',
  '    zohn [--hire] [--build] [--contact]',
  '',
  'DESCRIPTION',
  '    Kansas City developer who ships full-stack products end to end and',
  '    supports mission-critical treasury systems for a federal agency.',
  '',
  'SKILLS',
  '    JavaScript, TypeScript, Python, SQL, Bash',
  '    React, Node.js, Docker, Linux, Active Directory',
  '    Cloudflare Workers + D1, AWS, CI/CD, REST APIs',
  '',
  'PROJECTS',
  '    sportstrata, botchase, zretrobuild, oraclebot, sitekit',
  '',
  'SEE ALSO',
  '    resume(1), contact(1), scan(1), history(1)',
];

// Printed once at the end of the boot (decorative, aria-hidden).
export const BANNER = [
  '╔═╗╔═╗╦ ╦╔╗╔  ╦ ╦╦ ╦╔═╗╔═╗╦  ╔═╗╦═╗',
  '╔═╝║ ║╠═╣║║║  ║║║╠═╣║╣ ║╣ ║  ║╣ ╠╦╝',
  '╚═╝╚═╝╩ ╩╝╚╝  ╚╩╝╩ ╩╚═╝╚═╝╩═╝╚═╝╩╚═',
];

export const FALLBACK_REPLY = "I don't have that on file. Ask about projects, stack, experience, education or hiring, or type 'help'.";

// Scripted knowledge base for plain-English questions. Every reply is written
// from content already on the portfolio. Keywords are single lowercase tokens
// in the form answers.tokenize produces (a trailing plural 's' is dropped
// unless the word ends in ss, us or is).
export const KB = [
  { id: 'greeting', keywords: ['hi', 'hello', 'hey', 'yo', 'sup', 'greeting'],
    reply: "Hello. Ask me about Zohn's projects, stack, experience, education or availability. Or type 'help' to drive the terminal yourself." },
  { id: 'stack', keywords: ['stack', 'tech', 'language', 'framework', 'tool', 'skill', 'javascript', 'typescript', 'python', 'react', 'node', 'docker', 'aws', 'cloudflare', 'sql'],
    reply: 'Zohn works in JavaScript, TypeScript, Python, SQL and Bash, with React, Node.js, Docker and Linux. Infrastructure runs on Cloudflare Workers and D1, AWS, CI/CD and REST APIs.' },
  { id: 'experience', keywords: ['experience', 'job', 'work', 'career', 'employer', 'background', 'administrator', 'engineer'],
    reply: 'Applications Administrator on federal treasury systems since March 2026, giving Tier 2/3 support for enterprise financial applications. Before that, Junior Engineer at a Missouri state agency from July 2024 to January 2026: infrastructure, identity and automation.' },
  { id: 'clearance', keywords: ['clearance', 'sci', 'secret', 'security', 'federal', 'government', 'treasury', 'classified'],
    reply: 'Zohn holds an active TS/SCI clearance and supports classified, air-gapped federal treasury systems as a contractor.' },
  { id: 'location', keywords: ['where', 'location', 'based', 'city', 'missouri', 'live', 'remote', 'relocate'],
    reply: 'Zohn is based in Kansas City, Missouri, and open to opportunities.' },
  { id: 'hire', keywords: ['hire', 'hiring', 'available', 'availability', 'open', 'opportunity', 'recruit', 'recruiter', 'position', 'role', 'interview'],
    reply: "Zohn is open to full-time roles, contract work and interesting conversations. The fastest route is email: zohnwheeler@gmail.com. Or type 'contact'." },
  { id: 'education', keywords: ['education', 'school', 'degree', 'college', 'university', 'mizzou', 'graduate', 'study'],
    reply: "B.S. in Information Technology from the University of Missouri, 2024, with Dean's List honors. The senior capstone AI bot was featured by Mizzou Engineering." },
  { id: 'sitekit', keywords: ['sitekit', 'website', 'site', 'build', 'quote', 'business', 'price', 'cost', 'local', 'client', 'roofing', 'hvac'],
    reply: "Through Sitekit, Zohn builds fast, mobile-first sites for local service businesses: service and area pages, SEO fundamentals and a lead form straight to the owner. Type 'track build', then 'contact' for a quote." },
  { id: 'ai', keywords: ['ai', 'agent', 'claude', 'llm', 'automation', 'workflow', 'persona', 'review'],
    reply: "Zohn builds with AI agent teams. SportStrata ships with a design reviewer, code auditor and deep-review analyst. I was planned, built and reviewed by agents too. Type 'history' for the receipts." },
  { id: 'site', keywords: ['site', 'portfolio', 'terminal', 'orb', 'made', 'built', 'core', 'zw'],
    reply: "You're inside it: plain HTML, CSS and JavaScript modules on Cloudflare Pages, Workers functions for live data and a Three.js core. No framework, no build step. Type 'history' to see how I was made." },
  { id: 'sportstrata', keywords: ['sportstrata', 'baseball', 'mlb', 'sport', 'stat', 'analytic', 'fantasy', 'statcast', 'broadcast'],
    reply: "SportStrata is a full-stack MLB analytics platform: live scorecards, Statcast leaderboards and AI-generated broadcast narratives, built solo across 200+ commits. Try 'open sportstrata' or 'scan sportstrata'." },
  { id: 'botchase', keywords: ['botchase', 'sale', 'lead', 'outreach', 'stripe', 'billing'],
    reply: "BotChase is an AI sales automation SaaS for local service businesses, with lead scoring, outreach drafts and real Stripe billing. Try 'open botchase' or 'ping botchase'." },
  { id: 'zretrobuild', keywords: ['zretrobuild', 'arcade', 'game', 'retro', 'snake', 'breakout', 'invader'],
    reply: "ZRetroBuild is a playable 8-bit arcade (Snake, Breakout, Space Invaders) inside a CRT cabinet, with zero dependencies. Try 'open zretrobuild'." },
  { id: 'oraclebot', keywords: ['discord', 'bot', 'capstone', 'oracle', 'oraclebot', 'student'],
    reply: "The capstone Discord bot used AI to help students work through course material. Built by a team of four and featured by Mizzou Engineering. Try 'open oraclebot'." },
  { id: 'contact', keywords: ['contact', 'email', 'reach', 'linkedin', 'github', 'message', 'touch', 'call'],
    reply: "Email zohnwheeler@gmail.com, or find Zohn on LinkedIn and GitHub. Type 'contact' for clickable links." },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-content.test.mjs`
Expected: PASS (6 existing + 4 new = 10 tests).

- [ ] **Step 5: Commit**

```bash
git add public/xp/content.js test/xp-content.test.mjs
git commit -m "xp: content for filesystem, man page, banner and knowledge base" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Registry fallback and names

**Files:**
- Modify: `public/xp/commands.js`
- Modify: `test/xp-commands.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `registry.names() → string[]`, listing every registered command, including those without help.
  - `registry.setFallback(fn)`, where `fn(parsed) → output | Promise<output>` handles unknown commands instead of the not-found message. Fallback output is wrapped like handler output, and a thrown error becomes `"<name>: <message>"` with `ok: false`.

- [ ] **Step 1: Add the failing tests**

Append to `test/xp-commands.test.mjs`:

```js
test('names lists every registered command, with or without help', () => {
  const r = createRegistry();
  r.register('help', () => {}, 'help: list commands');
  r.register('whoami', () => 'guest');
  assert.deepEqual(r.names(), ['help', 'whoami']);
});

test('fallback handles unknown commands and receives the parsed input', async () => {
  const r = createRegistry();
  let seen = null;
  r.setFallback((parsed) => { seen = parsed; return 'handled'; });
  assert.deepEqual(await r.run('What is   this?'), { ok: true, output: ['handled'] });
  assert.deepEqual(seen, { name: 'what', args: ['is', 'this?'], raw: 'What is   this?' });
});

test('fallback errors become output', async () => {
  const r = createRegistry();
  r.setFallback(async () => { throw new Error('nope'); });
  assert.deepEqual(await r.run('zzz'), { ok: false, output: ['zzz: nope'] });
});

test('known commands never reach the fallback', async () => {
  const r = createRegistry();
  r.register('ls', () => 'files');
  r.setFallback(() => 'fallback');
  assert.deepEqual((await r.run('ls')).output, ['files']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-commands.test.mjs`
Expected: FAIL, because `r.names` and `r.setFallback` are not functions.

- [ ] **Step 3: Implement**

Replace `createRegistry` in `public/xp/commands.js` with:

```js
export function createRegistry() {
  const commands = new Map();
  let fallback = null;
  const wrap = (out) => (out == null ? [] : [].concat(out));

  return {
    register(name, handler, help = '') {
      commands.set(name.toLowerCase(), { handler, help });
    },
    list() {
      return [...commands.entries()]
        .filter(([, c]) => c.help)
        .map(([name, c]) => ({ name, help: c.help }));
    },
    names() {
      return [...commands.keys()];
    },
    complete(prefix) {
      const p = String(prefix).toLowerCase();
      return [...commands.keys()].filter((n) => n.startsWith(p)).sort();
    },
    setFallback(fn) {
      fallback = fn;
    },
    async run(raw) {
      const parsed = parseInput(raw);
      if (!parsed) return { ok: true, output: [] };
      const cmd = commands.get(parsed.name);
      const handler = cmd ? (args, p) => cmd.handler(args, p) : fallback && ((args, p) => fallback(p));
      if (!handler) return { ok: false, output: [`command not found: ${parsed.name}. type 'help' for commands.`] };
      try {
        return { ok: true, output: wrap(await handler(parsed.args, parsed)) };
      } catch (err) {
        return { ok: false, output: [`${parsed.name}: ${err?.message ?? err}`] };
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-commands.test.mjs`
Expected: PASS (13 existing + 4 new = 17 tests).

- [ ] **Step 5: Commit**

```bash
git add public/xp/commands.js test/xp-commands.test.mjs
git commit -m "xp: registry fallback for unknown input and full command names" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Virtual filesystem

**Files:**
- Create: `public/xp/fs.js`
- Test: `test/xp-fs.test.mjs`

**Interfaces:**
- Consumes: data shaped like `PROJECTS` and `OWNER`, plus `ABOUT`.
- Produces:
  - Node shapes: `{type:'dir', children}`, `{type:'file', lines}` and `{type:'link', href}`. Paths are arrays of names, and `[]` is home (`~`).
  - Functions:
    - `buildTree({ projects, owner, about })`
    - `resolvePath(cwd, input) → string[]`
    - `nodeAt(tree, path) → node | null`
    - `formatCwd(cwd) → '~' | '~/a/b'`
    - `ls(tree, cwd, input?)`, `cd(tree, cwd, input)` and `cat(tree, cwd, input)`, each returning `{ok:true, …} | {ok:false, error}`. `ls` and `cat` give `lines`, and `cd` gives `cwd`.
    - `tree(root) → string[]`
    - `completePath(tree, cwd, partial) → string[]`
  - File lines are strings or `{prefix, text, href}` link items, which `terminal.print` already renders.

- [ ] **Step 1: Write the failing test**

Create `test/xp-fs.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, resolvePath, nodeAt, formatCwd, ls, cd, cat, tree, completePath } from '../public/xp/fs.js';

const T = buildTree({
  projects: [
    { id: 'alpha', name: 'Alpha', story: 'Alpha story.', stack: ['JS', 'D1'], links: [{ label: 'Live', href: 'https://a.example/' }] },
    { id: 'beta', name: 'Beta', story: 'Beta story.', stack: ['Py'], links: [] },
  ],
  owner: { email: 'z@example.com', linkedin: 'https://li.example/z', github: 'https://gh.example/z' },
  about: ['line one', 'line two'],
});

test('resolvePath handles relative, absolute, home, dot and dot-dot', () => {
  assert.deepEqual(resolvePath([], 'projects/alpha'), ['projects', 'alpha']);
  assert.deepEqual(resolvePath(['projects'], '..'), []);
  assert.deepEqual(resolvePath([], '..'), []);
  assert.deepEqual(resolvePath(['projects'], '~/about.txt'), ['about.txt']);
  assert.deepEqual(resolvePath(['projects'], '/projects/./beta/'), ['projects', 'beta']);
  assert.deepEqual(resolvePath(['projects'], '~'), []);
  assert.deepEqual(resolvePath(['projects'], ''), ['projects']);
});

test('nodeAt refuses inherited keys', () => {
  assert.equal(nodeAt(T, ['constructor']), null);
  assert.equal(nodeAt(T, ['projects', '__proto__']), null);
});

test('formatCwd', () => {
  assert.equal(formatCwd([]), '~');
  assert.equal(formatCwd(['projects', 'alpha']), '~/projects/alpha');
});

test('ls lists sorted names with a slash on directories', () => {
  assert.deepEqual(ls(T, []), { ok: true, lines: ['about.txt  contact.txt  projects/  resume'] });
  assert.deepEqual(ls(T, ['projects']), { ok: true, lines: ['alpha/  beta/'] });
  assert.deepEqual(ls(T, [], 'about.txt'), { ok: true, lines: ['about.txt'] });
  assert.deepEqual(ls(T, [], 'nope'), { ok: false, error: "ls: cannot access 'nope': No such file or directory" });
});

test('cd moves into directories and reports shell-style errors', () => {
  assert.deepEqual(cd(T, [], 'projects'), { ok: true, cwd: ['projects'] });
  assert.deepEqual(cd(T, ['projects'], '~'), { ok: true, cwd: [] });
  assert.deepEqual(cd(T, [], 'about.txt'), { ok: false, error: 'cd: not a directory: about.txt' });
  assert.deepEqual(cd(T, [], 'nope'), { ok: false, error: 'cd: no such file or directory: nope' });
  assert.deepEqual(cd(T, [], 'constructor'), { ok: false, error: 'cd: no such file or directory: constructor' });
});

test('cat prints files, links and errors', () => {
  assert.deepEqual(cat(T, [], 'about.txt'), { ok: true, lines: ['line one', 'line two'] });
  assert.deepEqual(cat(T, [], 'projects/alpha/README'), { ok: true, lines: ['Alpha', '', 'Alpha story.', '', 'stack: JS · D1'] });
  assert.deepEqual(cat(T, [], 'projects/alpha/links'), { ok: true, lines: [{ prefix: 'Live: ', text: 'https://a.example/', href: 'https://a.example/' }] });
  assert.deepEqual(cat(T, [], 'resume'), { ok: true, lines: [{ prefix: '→ ', text: '/resume.html', href: '/resume.html' }] });
  assert.deepEqual(cat(T, [], 'projects'), { ok: false, error: 'cat: projects: Is a directory' });
  assert.deepEqual(cat(T, [], 'nope'), { ok: false, error: 'cat: nope: No such file or directory' });
});

test('contact.txt holds clickable links', () => {
  const { lines } = cat(T, [], 'contact.txt');
  assert.deepEqual(lines[0], { prefix: 'email:    ', text: 'z@example.com', href: 'mailto:z@example.com' });
  assert.equal(lines.length, 4);
});

test('tree draws the whole filesystem', () => {
  assert.deepEqual(tree(T), [
    '~',
    '├── about.txt',
    '├── contact.txt',
    '├── projects/',
    '│   ├── alpha/',
    '│   │   ├── README',
    '│   │   └── links',
    '│   └── beta/',
    '│       ├── README',
    '│       └── links',
    '└── resume',
  ]);
});

test('completePath completes names relative to cwd and through directories', () => {
  assert.deepEqual(completePath(T, [], 'pro'), ['projects/']);
  assert.deepEqual(completePath(T, [], 'projects/a'), ['projects/alpha/']);
  assert.deepEqual(completePath(T, ['projects'], ''), ['alpha/', 'beta/']);
  assert.deepEqual(completePath(T, [], '~/ab'), ['~/about.txt']);
  assert.deepEqual(completePath(T, [], 'zz'), []);
  assert.deepEqual(completePath(T, [], 'about.txt/x'), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-fs.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement**

Create `public/xp/fs.js`:

```js
// Virtual filesystem for the terminal, built from content.js. Pure: paths are
// arrays of names, [] is home ('~'), and nothing here touches the DOM.

const dir = (children) => ({ type: 'dir', children });
const file = (lines) => ({ type: 'file', lines });
const link = (href) => ({ type: 'link', href });
const label = (name, node) => (node.type === 'dir' ? `${name}/` : name);
const sortedNames = (node) => Object.keys(node.children).sort();

export function buildTree({ projects, owner, about }) {
  return dir({
    'about.txt': file(about),
    'contact.txt': file([
      { prefix: 'email:    ', text: owner.email, href: `mailto:${owner.email}` },
      { prefix: 'linkedin: ', text: owner.linkedin, href: owner.linkedin },
      { prefix: 'github:   ', text: owner.github, href: owner.github },
      { prefix: 'quote:    ', text: '/hire.html#contact-form', href: '/hire.html#contact-form' },
    ]),
    resume: link('/resume.html'),
    projects: dir(Object.fromEntries(projects.map((p) => [p.id, dir({
      README: file([p.name, '', p.story, '', `stack: ${p.stack.join(' · ')}`]),
      links: file(p.links.map((l) => ({ prefix: `${l.label}: `, text: l.href, href: l.href }))),
    })]))),
  });
}

export function resolvePath(cwd, input) {
  const raw = String(input ?? '').trim();
  if (raw === '') return [...cwd];
  const fromHome = raw === '~' || raw.startsWith('~/') || raw.startsWith('/');
  const path = fromHome ? [] : [...cwd];
  for (const part of raw.replace(/^~/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') path.pop();
    else path.push(part);
  }
  return path;
}

export function nodeAt(tree, path) {
  let node = tree;
  for (const name of path) {
    if (node.type !== 'dir' || !Object.hasOwn(node.children, name)) return null;
    node = node.children[name];
  }
  return node;
}

export function formatCwd(cwd) {
  return cwd.length ? `~/${cwd.join('/')}` : '~';
}

export function ls(tree, cwd, input = '') {
  const path = resolvePath(cwd, input);
  const node = nodeAt(tree, path);
  if (!node) return { ok: false, error: `ls: cannot access '${input}': No such file or directory` };
  if (node.type !== 'dir') return { ok: true, lines: [path[path.length - 1]] };
  return { ok: true, lines: [sortedNames(node).map((n) => label(n, node.children[n])).join('  ')] };
}

export function cd(tree, cwd, input) {
  const path = resolvePath(cwd, input);
  const node = nodeAt(tree, path);
  if (!node) return { ok: false, error: `cd: no such file or directory: ${input}` };
  if (node.type !== 'dir') return { ok: false, error: `cd: not a directory: ${input}` };
  return { ok: true, cwd: path };
}

export function cat(tree, cwd, input) {
  const node = nodeAt(tree, resolvePath(cwd, input));
  if (!node) return { ok: false, error: `cat: ${input}: No such file or directory` };
  if (node.type === 'dir') return { ok: false, error: `cat: ${input}: Is a directory` };
  if (node.type === 'link') return { ok: true, lines: [{ prefix: '→ ', text: node.href, href: node.href }] };
  return { ok: true, lines: node.lines };
}

export function tree(root) {
  const lines = ['~'];
  const walk = (node, prefix) => {
    const names = sortedNames(node);
    names.forEach((name, i) => {
      const last = i === names.length - 1;
      const child = node.children[name];
      lines.push(`${prefix}${last ? '└── ' : '├── '}${label(name, child)}`);
      if (child.type === 'dir') walk(child, `${prefix}${last ? '    ' : '│   '}`);
    });
  };
  walk(root, '');
  return lines;
}

export function completePath(tree, cwd, partial) {
  const cut = partial.lastIndexOf('/');
  const dirPart = cut >= 0 ? partial.slice(0, cut + 1) : '';
  const base = cut >= 0 ? partial.slice(cut + 1) : partial;
  const node = nodeAt(tree, resolvePath(cwd, dirPart));
  if (!node || node.type !== 'dir') return [];
  return sortedNames(node).filter((n) => n.startsWith(base)).map((n) => dirPart + label(n, node.children[n]));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-fs.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add public/xp/fs.js test/xp-fs.test.mjs
git commit -m "xp: virtual filesystem for the terminal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Plain-English answers and typo suggestions

**Files:**
- Create: `public/xp/answers.js`
- Test: `test/xp-answers.test.mjs`

**Interfaces:**
- Consumes: KB-shaped data (`{ id, keywords, reply }[]`). The content test from Task 1 checks keyword format only, so this task adds a test that every content keyword survives `tokenize` unchanged.
- Produces:
  - `tokenize(text) → string[]`
  - `answer(input, kb, { threshold = 1 }) → { id, reply, score } | null`
  - `editDistance(a, b) → number`
  - `suggest(word, candidates) → string | null`. The maximum distance is 1 for words of 4 or fewer characters and 2 otherwise. Words shorter than 3 characters never get a suggestion.

- [ ] **Step 1: Write the failing test**

Create `test/xp-answers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, answer, editDistance, suggest } from '../public/xp/answers.js';
import { KB } from '../public/xp/content.js';

const kb = [
  { id: 'stack', keywords: ['stack', 'tech', 'language'], reply: 'stack reply' },
  { id: 'site', keywords: ['site', 'built'], reply: 'site reply' },
  { id: 'sitekit', keywords: ['site', 'build', 'business'], reply: 'sitekit reply' },
];

test('tokenize lowercases, drops stopwords and simple plurals', () => {
  assert.deepEqual(tokenize("What's Zohn's tech stack?"), ['tech', 'stack']);
  assert.deepEqual(tokenize('Languages and skills'), ['language', 'skill']);
  assert.deepEqual(tokenize('business status analysis'), ['business', 'status', 'analysis']);
  assert.deepEqual(tokenize('Does it run AWS?'), ['run', 'aws']);
  assert.deepEqual(tokenize(''), []);
});

test('answer picks the best-scoring entry', () => {
  assert.equal(answer("what's your tech stack", kb).id, 'stack');
  assert.equal(answer('how was this site built', kb).id, 'site');
  assert.equal(answer('can you build a site for my business', kb).id, 'sitekit');
  assert.deepEqual(answer('which languages', kb), { id: 'stack', reply: 'stack reply', score: 1 });
});

test('answer returns null below the threshold or for empty input', () => {
  assert.equal(answer('tell me about the weather', kb), null);
  assert.equal(answer('', kb), null);
  assert.equal(answer('stack', kb, { threshold: 2 }), null);
});

test('editDistance is Levenshtein', () => {
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('same', 'same'), 0);
});

test('suggest finds close commands, scaled to word length', () => {
  assert.equal(suggest('opne', ['open', 'cat']), 'open');
  assert.equal(suggest('opn', ['open', 'cat']), 'open');
  assert.equal(suggest('hisotry', ['history', 'help']), 'history');
  assert.equal(suggest('ct', ['cat']), null);
  assert.equal(suggest('xyzzy', ['open', 'help']), null);
  assert.equal(suggest('cta', ['cat']), null);
});

test('every content KB keyword survives tokenize unchanged', () => {
  for (const e of KB) for (const k of e.keywords) assert.deepEqual(tokenize(k), [k], `${e.id}: ${k}`);
});

test('content KB answers representative questions', () => {
  assert.equal(answer('what is your tech stack?', KB).id, 'stack');
  assert.equal(answer('does zohn have a security clearance', KB).id, 'clearance');
  assert.equal(answer('can you build a website for my roofing business', KB).id, 'sitekit');
  assert.equal(answer('how was this site built', KB).id, 'site');
  assert.equal(answer('where is zohn based', KB).id, 'location');
  assert.equal(answer('tell me about the baseball app', KB).id, 'sportstrata');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-answers.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement**

Create `public/xp/answers.js`:

```js
// Scripted understanding for plain-English input: keyword scoring against
// the knowledge base in content.js, and "did you mean" suggestions. Pure.

const STOP = new Set((
  'a am an and any are be can could did do does for from give has have how i in is it me my of on or '
  + 'please s show some t tell that the there this to was what whats who with would you your about '
  + 'zohn zohns wheeler'
).split(' '));

function stem(t) {
  return t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t) ? t.slice(0, -1) : t;
}

export function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map(stem)
    .filter((t) => !STOP.has(t));
}

export function answer(input, kb, { threshold = 1 } = {}) {
  const tokens = tokenize(input);
  if (!tokens.length) return null;
  let best = null;
  let bestScore = 0;
  for (const entry of kb) {
    const keys = new Set(entry.keywords);
    const score = tokens.filter((t) => keys.has(t)).length;
    if (score > bestScore) { best = entry; bestScore = score; }
  }
  return best && bestScore >= threshold ? { id: best.id, reply: best.reply, score: bestScore } : null;
}

export function editDistance(a, b) {
  const s = String(a);
  const t = String(b);
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    for (let j = 1; j <= t.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[t.length];
}

export function suggest(word, candidates) {
  const w = String(word ?? '').toLowerCase();
  if (w.length < 3) return null;
  const max = w.length <= 4 ? 1 : 2;
  let best = null;
  let bestDistance = Infinity;
  for (const c of new Set(candidates)) {
    const d = editDistance(w, c);
    if (d < bestDistance) { best = c; bestDistance = d; }
  }
  return bestDistance > 0 && bestDistance <= max ? best : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-answers.test.mjs`
Expected: PASS, 7 tests. If a content-KB case fails, adjust only the KB keywords in `public/xp/content.js` (never the test questions), then re-run this test and `node --test test/xp-content.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add public/xp/answers.js test/xp-answers.test.mjs
git commit -m "xp: scripted answers and did-you-mean suggestions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If the KB keywords were adjusted, add `public/xp/content.js` to the same commit.

---

### Task 5: Text UI, ASCII art, BIOS and CRT helpers

**Files:**
- Create: `public/xp/tui.js`, `public/xp/ascii.js`, `public/xp/bios.js`, `public/xp/crt.js`
- Test: `test/xp-tui.test.mjs`, `test/xp-ascii.test.mjs`, `test/xp-bios.test.mjs`, `test/xp-crt.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `tui.js`:
    - `rule(cols, ch?)`
    - `bar(fraction, cols)`, returning `[████░░]` with a total length of `cols`
    - `frame(title, cols)`, returning `{ top, bottom }`, each `cols` characters
    - `table(headers, rows)`, returning lines in two-space-separated padded columns
  - `ascii.js`:
    - `RAMP`
    - `luminance(rgba) → Uint8ClampedArray`
    - `toAscii(gray, w, h, cols, ramp = RAMP, aspect = 0.5) → string[]`
    - `imageToAscii(src, cols) → Promise<string[] | null>` (browser only, cached)
  - `bios.js`:
    - `parseUA(ua) → { browser, os }`
    - `memoryLine(mb)`
    - `memorySteps(mb, steps = 8) → number[]`
    - `formatPost(device) → string[]`
    - `readDevice(nav?, win?) → device` (browser only)
  - `crt.js`:
    - `PALETTES` and `PALETTE_NAMES`
    - `applyPalette(name, root?) → boolean`
    - `initPalette(store)`
    - `powerOff(el?) → Promise`
    - `glitch(el)`

- [ ] **Step 1: Write the failing tests**

Create `test/xp-tui.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rule, bar, frame, table } from '../public/xp/tui.js';

test('rule repeats a character', () => {
  assert.equal(rule(4), '────');
  assert.equal(rule(3, '='), '===');
  assert.equal(rule(-2), '');
});

test('bar fills proportionally and clamps', () => {
  assert.equal(bar(0.5, 12), '[█████░░░░░]');
  assert.equal(bar(-1, 6), '[░░░░]');
  assert.equal(bar(2, 6), '[████]');
  assert.equal(bar(0.72, 14), '[█████████░░░]');
});

test('frame draws a titled box edge of exact width', () => {
  const { top, bottom } = frame('SportStrata', 24);
  assert.equal(top, `╔═[ SportStrata ]${'═'.repeat(6)}╗`);
  assert.equal([...top].length, 24);
  assert.equal(bottom, `╚${'═'.repeat(22)}╝`);
});

test('table pads columns', () => {
  assert.deepEqual(table(['A', 'BB'], [['xyz', '1'], ['q', '22']]), ['A    BB', 'xyz  1', 'q    22']);
});
```

Create `test/xp-ascii.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luminance, toAscii, RAMP } from '../public/xp/ascii.js';

test('luminance converts RGBA to gray', () => {
  assert.deepEqual([...luminance([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255])], [255, 0, 76]);
});

test('toAscii maps dark to space and bright to dense characters', () => {
  const gray = [0, 0, 255, 255, 0, 0, 255, 255];
  assert.deepEqual(toAscii(gray, 4, 2, 2, ' @', 1), [' @']);
});

test('toAscii keeps aspect with the default 0.5 row factor', () => {
  const gray = new Array(8 * 8).fill(255);
  const lines = toAscii(gray, 8, 8, 4);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines, ['@@@@', '@@@@']);
  assert.equal(RAMP[RAMP.length - 1], '@');
});
```

Create `test/xp-bios.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUA, memoryLine, memorySteps, formatPost } from '../public/xp/bios.js';

test('parseUA recognises common browsers and systems', () => {
  assert.deepEqual(parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'), { browser: 'Chrome 141', os: 'Windows' });
  assert.deepEqual(parseUA('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0'), { browser: 'Edge 141', os: 'Windows' });
  assert.deepEqual(parseUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0'), { browser: 'Firefox 131', os: 'macOS' });
  assert.deepEqual(parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), { browser: 'Safari 18', os: 'iOS' });
  assert.deepEqual(parseUA('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36'), { browser: 'Chrome 141', os: 'Android' });
  assert.deepEqual(parseUA(''), { browser: null, os: null });
});

test('memory count-up ends exactly on the total', () => {
  assert.deepEqual(memorySteps(8192, 4), [2048, 4096, 6144, 8192]);
  assert.equal(memoryLine(8192), 'Memory test: 8192 MB OK');
});

test('formatPost prints every known field', () => {
  assert.deepEqual(formatPost({
    memoryMB: 8192, cores: 8, gpu: 'ANGLE (NVIDIA GeForce RTX 3070)', screen: { w: 2560, h: 1440, dpr: 2 },
    browser: 'Chrome 141', os: 'Windows', locale: 'en-US', time: '22:41',
  }), [
    'ZW-BIOS v5.1  (c) Zohn Wheeler',
    'Memory test: 8192 MB OK',
    'CPU: 8 logical cores detected',
    'GPU: ANGLE (NVIDIA GeForce RTX 3070)',
    'Display: 2560x1440 @2x',
    'Browser: Chrome 141 on Windows',
    'Locale: en-US, 22:41 local',
    'Booting ZW-OS...',
  ]);
});

test('formatPost omits what the browser does not reveal and truncates long GPU names', () => {
  assert.deepEqual(formatPost({}), ['ZW-BIOS v5.1  (c) Zohn Wheeler', 'Booting ZW-OS...']);
  const lines = formatPost({ gpu: 'x'.repeat(80), browser: 'Firefox 131' });
  assert.equal(lines[1], `GPU: ${'x'.repeat(57)}...`);
  assert.equal(lines[2], 'Browser: Firefox 131');
});
```

Create `test/xp-crt.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPalette, PALETTE_NAMES, PALETTES } from '../public/xp/crt.js';

function fakeRoot() {
  const props = {};
  return { props, style: { setProperty: (k, v) => { props[k] = v; } } };
}

test('applyPalette sets the three phosphor variables', () => {
  const root = fakeRoot();
  assert.equal(applyPalette('amber', root), true);
  assert.deepEqual(root.props, { '--phosphor': '#ffb000', '--phosphor-dim': '#7a5500', '--glow': '255,176,0' });
});

test('applyPalette rejects unknown and inherited names', () => {
  const root = fakeRoot();
  assert.equal(applyPalette('pink', root), false);
  assert.equal(applyPalette('constructor', root), false);
  assert.deepEqual(root.props, {});
});

test('palettes on offer', () => {
  assert.deepEqual(PALETTE_NAMES, ['green', 'amber', 'white']);
  assert.equal(PALETTES.green.phosphor, '#3dff9a');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/xp-tui.test.mjs test/xp-ascii.test.mjs test/xp-bios.test.mjs test/xp-crt.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for each.

- [ ] **Step 3: Implement**

Create `public/xp/tui.js`:

```js
// Box-drawing helpers for text-mode output. Pure.

export function rule(cols, ch = '─') {
  return ch.repeat(Math.max(0, cols));
}

export function bar(fraction, cols) {
  const inner = Math.max(0, cols - 2);
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  const filled = Math.round(f * inner);
  return `[${'█'.repeat(filled)}${'░'.repeat(inner - filled)}]`;
}

export function frame(title, cols) {
  const inner = Math.max(0, cols - 2);
  const head = `═[ ${title} ]`.slice(0, inner);
  return { top: `╔${head}${'═'.repeat(inner - head.length)}╗`, bottom: `╚${'═'.repeat(inner)}╝` };
}

export function table(headers, rows) {
  const all = [headers, ...rows].map((r) => r.map(String));
  const widths = headers.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join('  ').trimEnd());
}
```

Create `public/xp/ascii.js`:

```js
// Image to ASCII art. toAscii and luminance are pure; imageToAscii draws the
// image to a canvas in the browser and caches the result per image and width.

export const RAMP = ' .:-=+*#%@';

export function luminance(rgba) {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return out;
}

export function toAscii(gray, w, h, cols, ramp = RAMP, aspect = 0.5) {
  const rows = Math.max(1, Math.round((h / w) * cols * aspect));
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * h) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * h) / rows));
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * w) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * w) / cols));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += gray[y * w + x]; n += 1; }
      line += ramp[Math.min(ramp.length - 1, Math.floor(((sum / n) / 256) * ramp.length))];
    }
    lines.push(line);
  }
  return lines;
}

const cache = new Map();

export function imageToAscii(src, cols) {
  const key = `${src}|${cols}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const w = cols * 4;
          const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(toAscii(luminance(ctx.getImageData(0, 0, w, h).data), w, h, cols));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return cache.get(key);
}
```

Create `public/xp/bios.js`:

```js
// The BIOS self-test. formatPost and parseUA are pure; readDevice reads the
// visitor's own browser. Nothing here is sent anywhere.

export function parseUA(ua) {
  const s = String(ua ?? '');
  const pick = (re, name) => { const m = re.exec(s); return m ? `${name} ${m[1]}` : null; };
  const browser = pick(/Edg\/(\d+)/, 'Edge') ?? pick(/OPR\/(\d+)/, 'Opera') ?? pick(/Firefox\/(\d+)/, 'Firefox')
    ?? pick(/Chrome\/(\d+)/, 'Chrome') ?? pick(/Version\/(\d+)[\d.]* .*Safari/, 'Safari');
  const os = /Windows/.test(s) ? 'Windows' : /iPhone|iPad/.test(s) ? 'iOS' : /Mac OS X/.test(s) ? 'macOS'
    : /Android/.test(s) ? 'Android' : /Linux/.test(s) ? 'Linux' : null;
  return { browser, os };
}

export const memoryLine = (mb) => `Memory test: ${mb} MB OK`;

export function memorySteps(mb, steps = 8) {
  return Array.from({ length: steps }, (_, i) => Math.round((mb * (i + 1)) / steps));
}

export function formatPost(d = {}) {
  const lines = ['ZW-BIOS v5.1  (c) Zohn Wheeler'];
  if (d.memoryMB) lines.push(memoryLine(d.memoryMB));
  if (d.cores) lines.push(`CPU: ${d.cores} logical cores detected`);
  if (d.gpu) lines.push(`GPU: ${d.gpu.length > 60 ? `${d.gpu.slice(0, 57)}...` : d.gpu}`);
  if (d.screen) lines.push(`Display: ${d.screen.w}x${d.screen.h} @${d.screen.dpr}x`);
  if (d.browser) lines.push(`Browser: ${d.browser}${d.os ? ` on ${d.os}` : ''}`);
  if (d.locale) lines.push(`Locale: ${d.locale}${d.time ? `, ${d.time} local` : ''}`);
  lines.push('Booting ZW-OS...');
  return lines;
}

export function readDevice(nav = globalThis.navigator, win = globalThis.window) {
  const d = {};
  try { d.cores = nav.hardwareConcurrency || null; } catch { /* unavailable */ }
  try { d.memoryMB = nav.deviceMemory ? Math.round(nav.deviceMemory * 1024) : null; } catch { /* unavailable */ }
  try {
    const gl = win.document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    d.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* blocked */ }
  try { d.screen = { w: win.screen.width, h: win.screen.height, dpr: Math.round((win.devicePixelRatio || 1) * 100) / 100 }; } catch { /* unavailable */ }
  try { Object.assign(d, parseUA(nav.userAgent)); } catch { /* unavailable */ }
  try {
    d.locale = nav.language || null;
    d.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { /* unavailable */ }
  return d;
}
```

Create `public/xp/crt.js`:

```js
// CRT controls: phosphor palettes, the power-off collapse and the glitch pulse.
// Power-on is pure CSS (.crt-power runs on page load), so it works without JS.

export const PALETTES = {
  green: { phosphor: '#3dff9a', dim: '#1d7a4c', glow: '61,255,154' },
  amber: { phosphor: '#ffb000', dim: '#7a5500', glow: '255,176,0' },
  white: { phosphor: '#e8e8e8', dim: '#6b6b6b', glow: '232,232,232' },
};
export const PALETTE_NAMES = Object.keys(PALETTES);

export function applyPalette(name, root = globalThis.document?.documentElement) {
  if (!Object.hasOwn(PALETTES, name) || !root) return false;
  const p = PALETTES[name];
  root.style.setProperty('--phosphor', p.phosphor);
  root.style.setProperty('--phosphor-dim', p.dim);
  root.style.setProperty('--glow', p.glow);
  return true;
}

export function initPalette(store) {
  applyPalette(store.get('zw_color') ?? 'green');
}

export function powerOff(el = globalThis.document?.getElementById('crt-power')) {
  return new Promise((resolve) => {
    if (!el) { resolve(); return; }
    el.classList.add('off');
    setTimeout(resolve, 340);
  });
}

export function glitch(el) {
  if (!el) return;
  el.classList.remove('glitch');
  void el.offsetWidth;
  el.classList.add('glitch');
  setTimeout(() => el.classList.remove('glitch'), 260);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/xp-tui.test.mjs test/xp-ascii.test.mjs test/xp-bios.test.mjs test/xp-crt.test.mjs`
Expected: PASS (4 + 3 + 4 + 3 = 14 tests).

- [ ] **Step 5: Commit**

```bash
git add public/xp/tui.js public/xp/ascii.js public/xp/bios.js public/xp/crt.js test/xp-tui.test.mjs test/xp-ascii.test.mjs test/xp-bios.test.mjs test/xp-crt.test.mjs
git commit -m "xp: text UI, ASCII art, BIOS and CRT helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Live-data formatters and client fetchers

**Files:**
- Create: `public/xp/live.js`
- Test: `test/xp-live.test.mjs`

**Interfaces:**
- Consumes: `bar`, `frame` and `table` from Task 5.
- Produces:
  - Ping: `pingLine(host, ms | null)` and `pingSummary(host, samples) → string[]`.
  - `parseCount(args) → 1..10`, defaulting to 5.
  - Formatters:
    - `formatGitLog(commits, n) → string[]`
    - `formatTop(statuses, projects) → string[]`
    - `formatScan(scan) → string[]`
    - `formatHistory(log) → string[]`
  - Verdicts: `daysSince(iso, now) → number | null` and `verdict(scan, now) → string`.
  - Fetchers:
    - `fetchJson(url, { timeoutMs = 4000, fetchImpl }) → data | null`, which never rejects.
    - `pingOnce(url, { timeoutMs = 3000, fetchImpl, now }) → ms | null`.

- [ ] **Step 1: Write the failing test**

Create `test/xp-live.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pingLine, pingSummary, parseCount, formatGitLog, formatTop, formatScan, daysSince, verdict,
  formatHistory, fetchJson, pingOnce,
} from '../public/xp/live.js';

test('ping output', () => {
  assert.equal(pingLine('a.example', 123.4), 'reply from a.example: time=123 ms');
  assert.equal(pingLine('a.example', null), 'Request timed out.');
  assert.deepEqual(pingSummary('a.example', [10, 20, null, 30]), [
    '--- a.example ping statistics ---', '4 sent, 3 answered, 25% loss', 'min/avg/max = 10/20/30 ms',
  ]);
  assert.deepEqual(pingSummary('a.example', [null, null]), ['--- a.example ping statistics ---', '2 sent, 0 answered, 100% loss']);
});

test('parseCount reads -n N, -nN and -N, clamped to 1..10', () => {
  assert.equal(parseCount([]), 5);
  assert.equal(parseCount(['-n', '7']), 7);
  assert.equal(parseCount(['-n20']), 10);
  assert.equal(parseCount(['-3']), 3);
  assert.equal(parseCount(['-n', '0']), 5);
});

test('formatGitLog', () => {
  const commits = [
    { sha7: 'abc1234', date: '2026-10-10T18:00:00Z', repo: 'zohnner/zohn-sports-stats', message: 'Fix boot timing' },
    { sha7: 'def5678', date: '2026-10-09T10:00:00Z', repo: 'zohnner/ZRetroBuild', message: 'Add snake' },
  ];
  assert.deepEqual(formatGitLog(commits, 1), ['abc1234  2026-10-10  zohn-sports-stats  Fix boot timing']);
  assert.equal(formatGitLog(commits, 5)[1], 'def5678  2026-10-09  ZRetroBuild        Add snake');
  assert.deepEqual(formatGitLog([], 5), []);
});

test('formatTop shows status and latency without inventing uptime', () => {
  const projects = [{ id: 'a', name: 'Alpha', stack: ['JS'] }, { id: 'b', name: 'Beta', stack: ['Py'] }];
  assert.deepEqual(formatTop([{ id: 'a', status: 'online', ms: 120 }, { id: 'b', status: 'sleeping', ms: null }], projects), [
    'PID  NAME   STATUS    LATENCY  STACK',
    '101  Alpha  ONLINE    120 ms   JS',
    '102  Beta   SLEEPING  -        Py',
  ]);
});

const SCAN = { ok: true, id: 'sportstrata', repo: 'zohnner/x', languages: { JavaScript: 72, CSS: 28 }, commits: 214, pushedAt: '2026-10-10T18:00:00Z', stars: 4 };

test('formatScan draws a boxed report', () => {
  const lines = formatScan(SCAN);
  assert.ok(lines[0].startsWith('╔═[ scan: zohnner/x ]'));
  assert.equal([...lines[0]].length, 46);
  assert.equal(lines[1], '  JavaScript   [█████████░░░]  72%');
  assert.equal(lines[3], '  commits      214');
  assert.equal(lines[4], '  last push    2026-10-10');
  assert.equal(lines[5], '  stars        4');
  assert.equal(lines.at(-1), `╚${'═'.repeat(44)}╝`);
});

test('verdicts come only from the stats', () => {
  const now = Date.parse('2026-10-12T00:00:00Z');
  assert.equal(daysSince('2026-10-10T18:00:00Z', now), 1);
  assert.equal(daysSince('not a date', now), null);
  assert.equal(verdict(SCAN, now), 'Verdict: JavaScript-led, a deep commit history of 214 commits, actively developed (last push 1 day ago).');
  assert.equal(verdict({ ...SCAN, commits: 60, pushedAt: '2026-08-01T00:00:00Z' }, now), 'Verdict: JavaScript-led, a solid commit history of 60 commits, maintained (last push 72 days ago).');
  assert.equal(verdict({ languages: {}, commits: 3, pushedAt: '2026-01-01T00:00:00Z' }, now), 'Verdict: Polyglot-led, a young codebase of 3 commits, resting for now (last push 284 days ago).');
  assert.equal(verdict({ ...SCAN, pushedAt: '2026-10-12T00:00:00Z' }, now), 'Verdict: JavaScript-led, a deep commit history of 214 commits, actively developed (last push today).');
});

test('formatHistory narrates real build numbers', () => {
  const lines = formatHistory({ commits: 18, firstDate: '2026-10-11', lastDate: '2026-10-12', coAuthors: ['Claude Opus 5.5', 'Claude Sonnet 5.5'], filesChanged: 120, insertions: 4000, deletions: 300, tests: 120 });
  assert.deepEqual(lines, [
    'I was assembled in 18 commits, from 2026-10-11 to 2026-10-12.',
    'That came to 120 file changes: +4000 and -300 lines.',
    '120 unit tests check my logic on every change.',
    'My code was written by AI agents (Claude Opus 5.5, Claude Sonnet 5.5), working from a plan, with every task reviewed before it landed.',
    'Zohn wrote the brief, approved the design and made the calls. The agents did the typing.',
  ]);
  assert.equal(formatHistory({ commits: 1, firstDate: 'a', lastDate: 'b', coAuthors: [], filesChanged: 1, insertions: 1, deletions: 0, tests: 0 }).length, 4);
});

test('fetchJson returns data, or null on non-OK and on errors', async () => {
  assert.deepEqual(await fetchJson('/x', { fetchImpl: async () => ({ ok: true, json: async () => ({ a: 1 }) }) }), { a: 1 });
  assert.equal(await fetchJson('/x', { fetchImpl: async () => ({ ok: false, json: async () => ({}) }) }), null);
  assert.equal(await fetchJson('/x', { fetchImpl: async () => { throw new Error('offline'); } }), null);
});

test('pingOnce times a no-cors fetch and returns null on failure', async () => {
  const times = [100, 142];
  let init = null;
  let url = null;
  const ms = await pingOnce('https://a.example/', { now: () => times.shift(), fetchImpl: async (u, i) => { url = u; init = i; return {}; } });
  assert.equal(ms, 42);
  assert.equal(init.mode, 'no-cors');
  assert.equal(init.cache, 'no-store');
  assert.match(url, /^https:\/\/a\.example\/\?zwping=\d+$/);
  assert.equal(await pingOnce('https://a.example/', { fetchImpl: async () => { throw new Error('x'); } }), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/xp-live.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement**

Create `public/xp/live.js`:

```js
// Output for the live-data commands (ping, git log, top, scan, history) and
// the small fetchers they use. Formatters are pure; every number they print
// comes from real data passed in.

import { bar, frame, table } from './tui.js';

export function pingLine(host, ms) {
  return ms == null ? 'Request timed out.' : `reply from ${host}: time=${Math.round(ms)} ms`;
}

export function pingSummary(host, samples) {
  const got = samples.filter((m) => m != null).map(Math.round);
  const loss = Math.round((1 - got.length / samples.length) * 100);
  const lines = [`--- ${host} ping statistics ---`, `${samples.length} sent, ${got.length} answered, ${loss}% loss`];
  if (got.length) {
    const avg = Math.round(got.reduce((a, b) => a + b, 0) / got.length);
    lines.push(`min/avg/max = ${Math.min(...got)}/${avg}/${Math.max(...got)} ms`);
  }
  return lines;
}

export function parseCount(args, { def = 5, max = 10 } = {}) {
  const m = /-n\s*(\d+)|-(\d+)/.exec(args.join(' '));
  const n = m ? Number(m[1] ?? m[2]) : def;
  return Math.min(max, Math.max(1, Number.isFinite(n) && n > 0 ? n : def));
}

const shortRepo = (r) => String(r ?? '').split('/').pop();

export function formatGitLog(commits, n) {
  return commits.slice(0, n).map((c) => `${c.sha7}  ${String(c.date ?? '').slice(0, 10)}  ${shortRepo(c.repo).padEnd(18)} ${c.message}`);
}

export function formatTop(statuses, projects) {
  const rows = statuses.map((s, i) => {
    const p = projects.find((x) => x.id === s.id);
    return [String(101 + i), p?.name ?? s.id, String(s.status).toUpperCase(), s.ms == null ? '-' : `${s.ms} ms`, p?.stack?.[0] ?? ''];
  });
  return table(['PID', 'NAME', 'STATUS', 'LATENCY', 'STACK'], rows);
}

export function formatScan(scan) {
  const { top, bottom } = frame(`scan: ${scan.repo}`, 46);
  const langs = Object.entries(scan.languages ?? {});
  return [
    top,
    ...langs.map(([name, pct]) => `  ${name.padEnd(12)} ${bar(pct / 100, 14)} ${String(pct).padStart(3)}%`),
    `  commits      ${scan.commits ?? 'unknown'}`,
    `  last push    ${String(scan.pushedAt ?? '').slice(0, 10) || 'unknown'}`,
    `  stars        ${scan.stars ?? 0}`,
    bottom,
  ];
}

export function daysSince(iso, now) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
}

export function verdict(scan, now) {
  const lead = Object.keys(scan.languages ?? {})[0] ?? 'Polyglot';
  const c = scan.commits ?? 0;
  const depth = c >= 200 ? 'a deep commit history' : c >= 50 ? 'a solid commit history' : 'a young codebase';
  const days = daysSince(scan.pushedAt, now);
  const ago = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  const activity = days == null ? 'activity unknown'
    : days <= 14 ? `actively developed (last push ${ago})`
      : days <= 90 ? `maintained (last push ${ago})`
        : `resting for now (last push ${ago})`;
  return `Verdict: ${lead}-led, ${depth} of ${c} commits, ${activity}.`;
}

export function formatHistory(log) {
  const lines = [
    `I was assembled in ${log.commits} commits, from ${log.firstDate} to ${log.lastDate}.`,
    `That came to ${log.filesChanged} file changes: +${log.insertions} and -${log.deletions} lines.`,
    `${log.tests} unit tests check my logic on every change.`,
  ];
  if (log.coAuthors?.length) {
    lines.push(`My code was written by AI agents (${log.coAuthors.join(', ')}), working from a plan, with every task reviewed before it landed.`);
  }
  lines.push('Zohn wrote the brief, approved the design and made the calls. The agents did the typing.');
  return lines;
}

export async function fetchJson(url, { timeoutMs = 4000, fetchImpl = globalThis.fetch } = {}) {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function pingOnce(url, { timeoutMs = 3000, fetchImpl = globalThis.fetch, now = () => performance.now() } = {}) {
  const t0 = now();
  try {
    const sep = url.includes('?') ? '&' : '?';
    await fetchImpl(`${url}${sep}zwping=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return now() - t0;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/xp-live.test.mjs`
Expected: PASS, 10 tests. Check the day-count assertions by hand if one fails. From 2026-08-01T00:00Z to 2026-10-12T00:00Z is 72 days, and from 2026-01-01T00:00Z it is 284 days. Fix the test's expected number only if the arithmetic in this plan is wrong, never the formula.

- [ ] **Step 5: Commit**

```bash
git add public/xp/live.js test/xp-live.test.mjs
git commit -m "xp: live-data formatters and fetchers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: GitHub helper, `/api/gitlog`, `/api/scan`, status refactor

**Files:**
- Create: `server/github.mjs`, `functions/api/gitlog.js`, `functions/api/scan.js`
- Modify: `functions/api/status.js`
- Test: `test/github.test.mjs`, `test/gitlog.test.mjs`, `test/scan.test.mjs` (the existing `test/status.test.mjs` must still pass unchanged)

**Interfaces:**
- Consumes: `PROJECTS` (with `repo`) and `GITHUB_USER` from `public/xp/content.js`.
- Produces:
  - From `server/github.mjs`:
    - `githubHeaders(env)`, which adds `Authorization: Bearer` only when `env.GITHUB_TOKEN` is set
    - `gh(path, { env, fetchImpl, timeoutMs = 2500, signal }) → Promise<Response>`
    - `cached(key, ttl, produce)`, which caches only successful values, ignores cache read and write failures, and rethrows when `produce` throws
    - `json(body)`, a 200 JSON response with `no-store`
  - `GET /api/gitlog` returns `{ commits: [{ sha7, date, repo, message }] }`.
  - `GET /api/scan?id=` returns `{ ok: true, id, repo, languages, commits, pushedAt, stars }` or `{ ok: false, error }`.
  - `recentCommits`, `scanRepo` and `parseLastPage` are exported for tests.

`functions/` routes every non-underscore file, so the shared helper lives outside it in `server/`. The middleware already imports from outside `functions/` (`../sitekit/`), so Pages bundles it.

- [ ] **Step 1: Write the failing tests**

Create `test/github.test.mjs`:

```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { githubHeaders, gh, cached, json } from '../server/github.mjs';

const realCaches = globalThis.caches;
function memoryCache() {
  const store = new Map();
  return { store, async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; }, async put(req, res) { store.set(req.url, res.clone()); } };
}
beforeEach(() => { globalThis.caches = { default: memoryCache() }; });
afterEach(() => { globalThis.caches = realCaches; });

test('githubHeaders adds a token only when configured', () => {
  assert.equal(githubHeaders({}).Authorization, undefined);
  assert.equal(githubHeaders(undefined).Authorization, undefined);
  assert.equal(githubHeaders({ GITHUB_TOKEN: 'abc' }).Authorization, 'Bearer abc');
  assert.equal(githubHeaders({}).Accept, 'application/vnd.github+json');
});

test('gh builds the URL and sends headers with a signal', async () => {
  let seen = null;
  await gh('/users/x/repos', { env: { GITHUB_TOKEN: 't' }, fetchImpl: async (u, i) => { seen = { u, i }; return new Response('[]'); } });
  assert.equal(seen.u, 'https://api.github.com/users/x/repos');
  assert.equal(seen.i.headers.Authorization, 'Bearer t');
  assert.ok(seen.i.signal);
});

test('cached stores successes and serves them again', async () => {
  let calls = 0;
  const produce = async () => { calls += 1; return { n: calls }; };
  assert.deepEqual(await cached('k', 60, produce), { n: 1 });
  assert.deepEqual(await cached('k', 60, produce), { n: 1 });
  assert.equal(calls, 1);
});

test('cached never stores failures', async () => {
  let calls = 0;
  const produce = async () => { calls += 1; throw new Error('upstream'); };
  await assert.rejects(cached('k', 60, produce), /upstream/);
  await assert.rejects(cached('k', 60, produce), /upstream/);
  assert.equal(calls, 2);
});

test('cached survives a broken cache', async () => {
  globalThis.caches = { default: { match: async () => { throw new Error('read'); }, put: async () => { throw new Error('write'); } } };
  assert.deepEqual(await cached('k', 60, async () => ({ ok: 1 })), { ok: 1 });
  delete globalThis.caches;
  assert.deepEqual(await cached('k', 60, async () => ({ ok: 2 })), { ok: 2 });
});

test('json answers 200 with no-store', async () => {
  const res = json({ a: 1 });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(res.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await res.json(), { a: 1 });
});
```

Create `test/gitlog.test.mjs`:

```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, recentCommits } from '../functions/api/gitlog.js';

const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
function memoryCache() {
  const store = new Map();
  return { async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; }, async put(req, res) { store.set(req.url, res.clone()); } };
}
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const commit = (sha, date, message) => ({ sha, commit: { message, author: { date } } });

function routes(map) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url: String(url), init });
    for (const [match, h] of map) if (String(url).includes(match)) return h();
    throw new Error(`unexpected ${url}`);
  };
  f.calls = calls;
  return f;
}
const healthy = () => [
  ['/users/zohnner/repos', () => json([{ full_name: 'zohnner/a' }, { full_name: 'zohnner/b' }])],
  ['/repos/zohnner/a/commits', () => json([commit('aaaaaaa111', '2026-10-10T10:00:00Z', 'A newest\n\nbody'), commit('aaaaaaa222', '2026-10-01T10:00:00Z', 'A older')])],
  ['/repos/zohnner/b/commits', () => json([commit('bbbbbbb111', '2026-10-05T10:00:00Z', 'B middle')])],
];

beforeEach(() => { globalThis.caches = { default: memoryCache() }; });
afterEach(() => { globalThis.fetch = realFetch; globalThis.caches = realCaches; });

test('recentCommits merges repos newest first and trims messages', async () => {
  const commits = await recentCommits('zohnner', { fetchImpl: routes(healthy()), limit: 2 });
  assert.deepEqual(commits, [
    { sha7: 'aaaaaaa', date: '2026-10-10T10:00:00Z', repo: 'zohnner/a', message: 'A newest' },
    { sha7: 'bbbbbbb', date: '2026-10-05T10:00:00Z', repo: 'zohnner/b', message: 'B middle' },
  ]);
});

test('GET /api/gitlog returns commits and caches them', async () => {
  const f = routes(healthy());
  globalThis.fetch = f;
  const res = await onRequestGet({ request: new Request('https://x/api/gitlog'), env: {} });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).commits.length, 3);
  await onRequestGet({ request: new Request('https://x/api/gitlog'), env: {} });
  assert.equal(f.calls.length, 3);
});

test('a GitHub failure gives an empty list and is not cached', async () => {
  const f = routes([['/users/zohnner/repos', () => json({ message: 'rate limited' }, 403)]]);
  globalThis.fetch = f;
  for (let i = 0; i < 2; i++) {
    const res = await onRequestGet({ request: new Request('https://x/api/gitlog'), env: {} });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { commits: [] });
  }
  assert.equal(f.calls.length, 2);
});

test('the token is sent when GITHUB_TOKEN is set', async () => {
  const f = routes(healthy());
  globalThis.fetch = f;
  await onRequestGet({ request: new Request('https://x/api/gitlog'), env: { GITHUB_TOKEN: 'tok' } });
  assert.ok(f.calls.every((c) => c.init.headers.Authorization === 'Bearer tok'));
});
```

Create `test/scan.test.mjs`:

```js
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, parseLastPage } from '../functions/api/scan.js';

const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
function memoryCache() {
  const store = new Map();
  return { async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; }, async put(req, res) { store.set(req.url, res.clone()); } };
}
const json = (d, status = 200, headers = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const ask = async (id) => (await onRequestGet({ request: new Request(`https://x/api/scan?id=${id}`), env: {} })).json();

function routes(map) {
  const calls = [];
  const f = async (url) => {
    calls.push(String(url));
    for (const [match, h] of map) if (String(url).includes(match)) return h();
    throw new Error(`unexpected ${url}`);
  };
  f.calls = calls;
  return f;
}
const healthy = () => [
  ['/languages', () => json({ JavaScript: 7200, CSS: 2000, HTML: 800 })],
  ['/commits?per_page=1', () => json([{}], 200, { link: '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/commits?per_page=1&page=214>; rel="last"' })],
  ['/repos/zohnner/zohn-sports-stats', () => json({ pushed_at: '2026-10-10T18:00:00Z', stargazers_count: 4 })],
];

beforeEach(() => { globalThis.caches = { default: memoryCache() }; });
afterEach(() => { globalThis.fetch = realFetch; globalThis.caches = realCaches; });

test('parseLastPage reads the last page from a Link header', () => {
  assert.equal(parseLastPage('<https://x/c?per_page=1&page=214>; rel="last"'), 214);
  assert.equal(parseLastPage(null), null);
  assert.equal(parseLastPage('<https://x/c?page=2>; rel="next"'), null);
});

test('unknown ids and ids without a public repo are refused', async () => {
  globalThis.fetch = routes([]);
  assert.deepEqual(await ask('nope'), { ok: false, error: 'unknown project' });
  assert.deepEqual(await ask('botchase'), { ok: false, error: 'unknown project' });
  assert.deepEqual(await ask('constructor'), { ok: false, error: 'unknown project' });
});

test('a scan returns real stats, with languages as rounded percentages', async () => {
  globalThis.fetch = routes(healthy());
  assert.deepEqual(await ask('sportstrata'), {
    ok: true, id: 'sportstrata', repo: 'zohnner/zohn-sports-stats',
    languages: { JavaScript: 72, CSS: 20, HTML: 8 }, commits: 214, pushedAt: '2026-10-10T18:00:00Z', stars: 4,
  });
});

test('scans are cached per id', async () => {
  const f = routes(healthy());
  globalThis.fetch = f;
  await ask('sportstrata');
  await ask('sportstrata');
  assert.equal(f.calls.length, 3);
});

test('upstream failure is honest and not cached', async () => {
  const f = routes([['/repos/', () => json({ message: 'boom' }, 500)]]);
  globalThis.fetch = f;
  assert.deepEqual(await ask('sportstrata'), { ok: false, error: 'upstream unavailable' });
  await ask('sportstrata');
  assert.equal(f.calls.length, 6);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/github.test.mjs test/gitlog.test.mjs test/scan.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement**

Create `server/github.mjs`:

```js
// Shared GitHub access for Pages Functions: headers (with an optional free
// GITHUB_TOKEN to lift the rate limit), a timeout, an edge-cache helper that
// never caches failures, and a JSON response helper.

export const GITHUB_API = 'https://api.github.com';
const CACHE_ORIGIN = 'https://zw-cache.internal';

export function githubHeaders(env) {
  const headers = { 'User-Agent': 'zohnwheeler-portfolio', Accept: 'application/vnd.github+json' };
  if (env?.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}

export function gh(path, { env, fetchImpl = fetch, timeoutMs = 2500, signal } = {}) {
  return fetchImpl(`${GITHUB_API}${path}`, { headers: githubHeaders(env), signal: signal ?? AbortSignal.timeout(timeoutMs) });
}

export async function cached(key, ttl, produce) {
  const cache = globalThis.caches?.default;
  const req = new Request(`${CACHE_ORIGIN}/${key}`);
  if (cache) {
    try {
      const hit = await cache.match(req);
      if (hit) return await hit.json();
    } catch { /* cache read failed: produce a fresh value */ }
  }
  const value = await produce();
  if (cache) {
    try {
      await cache.put(req, new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` },
      }));
    } catch { /* cache write failed: the value is still good */ }
  }
  return value;
}

export function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
```

Create `functions/api/gitlog.js`:

```js
// GET /api/gitlog: the newest public commits across the account's most
// recently pushed repos. Always 200; failures are not cached.

import { GITHUB_USER } from '../../public/xp/content.js';
import { gh, cached, json } from '../../server/github.mjs';

export async function recentCommits(user, { env, fetchImpl = fetch, repoCount = 3, perRepo = 5, limit = 10 } = {}) {
  const reposRes = await gh(`/users/${user}/repos?sort=pushed&per_page=${repoCount}`, { env, fetchImpl });
  if (!reposRes.ok) throw new Error(`repos ${reposRes.status}`);
  const repos = await reposRes.json();
  let anyOk = false;
  const lists = await Promise.all(repos.map(async (r) => {
    const res = await gh(`/repos/${r.full_name}/commits?per_page=${perRepo}`, { env, fetchImpl });
    if (!res.ok) return [];
    anyOk = true;
    const commits = await res.json();
    return commits.map((c) => ({
      sha7: String(c.sha).slice(0, 7),
      date: c.commit?.author?.date ?? null,
      repo: r.full_name,
      message: String(c.commit?.message ?? '').split('\n')[0].slice(0, 72),
    }));
  }));
  if (!anyOk) throw new Error('no commits readable');
  return lists.flat().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

export async function onRequestGet(context) {
  let commits = [];
  try {
    commits = await cached('gitlog', 600, () => recentCommits(GITHUB_USER, { env: context.env }));
  } catch {
    commits = [];
  }
  return json({ commits });
}
```

Create `functions/api/scan.js`:

```js
// GET /api/scan?id=<projectId>: real repo stats for one project with a public
// repo. Always 200; failures are honest and never cached.

import { PROJECTS } from '../../public/xp/content.js';
import { gh, cached, json } from '../../server/github.mjs';

export function parseLastPage(link) {
  const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(link ?? '');
  return m ? Number(m[1]) : null;
}

export async function scanRepo(repo, { env, fetchImpl = fetch } = {}) {
  const opts = { env, fetchImpl };
  const [repoRes, langRes, commitsRes] = await Promise.all([
    gh(`/repos/${repo}`, opts), gh(`/repos/${repo}/languages`, opts), gh(`/repos/${repo}/commits?per_page=1`, opts),
  ]);
  if (!repoRes.ok || !langRes.ok || !commitsRes.ok) throw new Error('upstream');
  const info = await repoRes.json();
  const bytes = await langRes.json();
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  const languages = Object.fromEntries(Object.entries(bytes)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, n]) => [name, total ? Math.round((n / total) * 100) : 0]));
  const commits = parseLastPage(commitsRes.headers.get('link')) ?? (await commitsRes.json()).length;
  return { repo, languages, commits, pushedAt: info.pushed_at ?? null, stars: info.stargazers_count ?? 0 };
}

export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get('id') ?? '';
  const project = PROJECTS.find((p) => p.id === id && p.repo);
  if (!project) return json({ ok: false, error: 'unknown project' });
  try {
    const data = await cached(`scan/${id}`, 3600, () => scanRepo(project.repo, { env: context.env }));
    return json({ ok: true, id, ...data });
  } catch {
    return json({ ok: false, error: 'upstream unavailable' });
  }
}
```

Modify `functions/api/status.js` to use the shared helper. Its behavior and the existing tests stay the same.

- Replace the imports and the local `GITHUB_HEADERS`, `CACHE_ORIGIN` and `cached` with:
  ```js
  import { PROJECTS, GITHUB_USER } from '../../public/xp/content.js';
  import { gh, cached, json } from '../../server/github.mjs';
  ```
  Keep `TIMEOUT_MS`, `COMMIT_TTL` and `HEALTH_TTL`.
- Change `latestCommit` to `latestCommit(user, fetchImpl = fetch, env)`, and make both GitHub calls through `gh(path, { env, fetchImpl, signal })` with one shared `const signal = AbortSignal.timeout(TIMEOUT_MS);`.
- In `onRequestGet`, call `latestCommit(GITHUB_USER, fetch, context.env)`, and build the response with `return json(body);`.

`status.js` still returns null from `latestCommit` on failure rather than throwing. That keeps v1's always-200 contract and the existing status tests unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/github.test.mjs test/gitlog.test.mjs test/scan.test.mjs test/status.test.mjs`
Expected: PASS (6 + 4 + 5 + 6 = 21 tests).

Then run `npm test`. Expected: everything green.

- [ ] **Step 5: Commit**

```bash
git add server/github.mjs functions/api/gitlog.js functions/api/scan.js functions/api/status.js test/github.test.mjs test/gitlog.test.mjs test/scan.test.mjs
git commit -m "api: gitlog and scan endpoints on a shared GitHub helper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Build log script

**Files:**
- Create: `scripts/build-log.mjs`, `public/xp/buildlog.json`
- Test: `test/build-log.test.mjs`
- Modify: `README.md` (append a short section)

**Interfaces:**
- Consumes: git history.
- Produces:
  - `summarize({ dates, trailers, shortstats, testSources })`, which returns `{ commits, firstDate, lastDate, coAuthors, filesChanged, insertions, deletions, tests }` (the shape `live.formatHistory` reads)
  - `public/xp/buildlog.json`

- [ ] **Step 1: Write the failing test**

Create `test/build-log.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../scripts/build-log.mjs';

test('summarize turns raw git output into build-log numbers', () => {
  const log = summarize({
    dates: ['2026-10-12T09:00:00-05:00', '2026-10-11T19:00:00-05:00', '2026-10-11T20:00:00-05:00'],
    trailers: ['Claude Opus 5.5 <noreply@anthropic.com>', 'Claude Sonnet 5.5 <noreply@anthropic.com>', 'Claude Opus 5.5 <noreply@anthropic.com>'],
    shortstats: [' 3 files changed, 120 insertions(+), 4 deletions(-)', ' 1 file changed, 1 insertion(+)'],
    testSources: ["test('a', () => {});\ntest('b', () => {});", "  test('c', async () => {});\n// test( not a call"],
  });
  assert.deepEqual(log, {
    commits: 3, firstDate: '2026-10-11', lastDate: '2026-10-12',
    coAuthors: ['Claude Opus 5.5', 'Claude Sonnet 5.5'],
    filesChanged: 4, insertions: 121, deletions: 4, tests: 3,
  });
});

test('summarize handles an empty history', () => {
  assert.deepEqual(summarize({ dates: [], trailers: [], shortstats: [], testSources: [] }), {
    commits: 0, firstDate: null, lastDate: null, coAuthors: [], filesChanged: 0, insertions: 0, deletions: 0, tests: 0,
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/build-log.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement**

Create `scripts/build-log.mjs`:

```js
// Writes public/xp/buildlog.json: real numbers about how the immersive site
// was built, read from git. Run before a deploy, then commit the JSON:
//   node scripts/build-log.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PATHS = [
  'public/index.html', 'public/xp', 'public/classic', 'functions/api/status.js', 'functions/api/gitlog.js',
  'functions/api/scan.js', 'server', 'scripts/render-voice.mjs', 'scripts/build-log.mjs',
];
export const TEST_FILE = /^(xp-.*|status|gitlog|scan|github|build-log)\.test\.mjs$/;

export function summarize({ dates, trailers, shortstats, testSources }) {
  const sorted = dates.filter(Boolean).map((d) => d.slice(0, 10)).sort();
  const coAuthors = [...new Set(trailers.map((t) => t.replace(/<[^>]*>/, '').trim()).filter(Boolean))].sort();
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of shortstats) {
    filesChanged += Number(/(\d+) files? changed/.exec(line)?.[1] ?? 0);
    insertions += Number(/(\d+) insertions?/.exec(line)?.[1] ?? 0);
    deletions += Number(/(\d+) deletions?/.exec(line)?.[1] ?? 0);
  }
  const tests = testSources.reduce((n, src) => n + (src.match(/^\s*test\(/gm)?.length ?? 0), 0);
  return {
    commits: dates.length, firstDate: sorted[0] ?? null, lastDate: sorted.at(-1) ?? null,
    coAuthors, filesChanged, insertions, deletions, tests,
  };
}

function main() {
  const testFiles = readdirSync('test').filter((f) => TEST_FILE.test(f)).map((f) => `test/${f}`);
  const spec = ['--', ...PATHS, ...testFiles];
  const git = (args) => execFileSync('git', [...args, ...spec], { encoding: 'utf8' });
  const lines = (s) => s.split('\n').filter(Boolean);
  const log = summarize({
    dates: lines(git(['log', '--format=%aI'])),
    trailers: lines(git(['log', '--format=%(trailers:key=Co-Authored-By,valueonly)'])),
    shortstats: lines(git(['log', '--shortstat', '--format='])).filter((l) => l.includes('changed')),
    testSources: testFiles.map((f) => readFileSync(f, 'utf8')),
  });
  writeFileSync('public/xp/buildlog.json', `${JSON.stringify(log, null, 2)}\n`);
  console.log(log);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run the test, then generate the file**

Run: `node --test test/build-log.test.mjs`
Expected: PASS, 2 tests.

Run: `node scripts/build-log.mjs`
Expected: prints the object and writes `public/xp/buildlog.json` with non-zero `commits`, `tests` and `coAuthors`.

- [ ] **Step 5: Document it**

Append to `README.md`:

```markdown
## Immersive homepage

- `/` is the terminal + AI-core experience (`public/xp/`); the old homepage is `/classic/`.
- Before a deploy, refresh the build log the `history` command narrates:
  `node scripts/build-log.mjs`, then commit `public/xp/buildlog.json`.
- Optional: set a `GITHUB_TOKEN` secret in Cloudflare Pages (a free fine-grained
  token with public-repo read access) so `git log`, `scan` and the boot commit
  line don't hit GitHub's anonymous rate limit.
- Voice narration is off behind `VOICE_ENABLED` in `public/xp/content.js`.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/build-log.mjs public/xp/buildlog.json test/build-log.test.mjs README.md
git commit -m "xp: build log generated from git for the history command" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Terminal, operator, voice and core moods

**Files:**
- Modify: `public/xp/terminal.js`, `public/xp/core.js`, `public/xp/core-fallback.css`
- Create: `public/xp/operator.js`, `public/xp/voice.js`

`main.js` still imports `narrator.js` until Task 11, so leave `narrator.js` in place here.

**Interfaces:**
- Consumes: `createRegistry` (Task 2), `NARRATION` (content).
- Produces:
  - `createTerminal(root)` keeps every v1 method and adds:
    - `names()` and `setFallback(fn)` (passthroughs)
    - `setPrompt(text)`, which updates `[data-term-prompt]` and the echo prefix
    - `setCompleter(fn)`, where `fn(lineWithSpace) → string[]` returns full-line completions
    - a `skip: () => boolean` option on `typeLine`, which finishes the line instantly when it returns true
  - `createOperator({ term, liveEl, getCore, restingState, voice, speed = 22 })` returns `{ say(idOrText) → Promise }`.
    - `say` queues lines, and a new line fast-forwards the one still typing.
    - Each line shows `zw-core> ...` while thinking, then types with the `zw-core> ` prefix and the `ai` class.
    - The orb runs `thinking`, then `speaking`, then `restingState()`.
    - The finished line text goes to `liveEl` once, and the typed line stays `aria-hidden`.
  - `createVoice({ base })` returns `{ play(id), stop(), setOn(bool), on }`.
  - `core.setState` accepts `thinking` and `alert`.

- [ ] **Step 1: Update `public/xp/terminal.js`**

Replace the whole file with:

```js
// DOM terminal: typed lines, printed output, an input with history, a
// prompt that can change, and tab completion for commands and arguments.
// Command logic lives in commands.js.

import { createRegistry, createHistory } from './commands.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTerminal(root) {
  const out = root.querySelector('[data-term-out]');
  const form = root.querySelector('[data-term-form]');
  const input = root.querySelector('[data-term-input]');
  const promptEl = root.querySelector('[data-term-prompt]');
  const registry = createRegistry();
  const history = createHistory();
  let fast = false;
  let promptText = '>';
  let completer = null;

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

  async function typeLine(text, { cls, prompt = '', speed = 55, typo, skip = () => false } = {}) {
    const el = addLine(cls);
    const typed = document.createTextNode(prompt);
    const caret = document.createElement('span');
    caret.className = 'cursor';
    el.append(typed, caret);
    el.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < text.length && !fast && !skip(); i++) {
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
    el.removeAttribute('aria-hidden');
    scroll();
    return el;
  }

  async function run(raw) {
    print(`${promptText} ${raw}`, 'term-echo');
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
    const value = input.value.trimStart();
    if (!value) return;
    const matches = /\s/.test(value) ? (completer?.(value) ?? []) : registry.complete(value);
    if (matches.length === 1) {
      e.preventDefault();
      input.value = matches[0].endsWith('/') ? matches[0] : `${matches[0]} `;
    } else if (matches.length > 1) {
      e.preventDefault();
      print(matches.map((m) => m.split(' ').pop()).join('  '));
    }
  });

  return {
    print,
    typeLine,
    run,
    register: registry.register,
    list: registry.list,
    names: registry.names,
    setFallback: registry.setFallback,
    setFast(value) { fast = !!value; },
    setPrompt(text) { promptText = text; if (promptEl) promptEl.textContent = text; },
    setCompleter(fn) { completer = fn; },
    clear() { out.replaceChildren(); },
    focus() { input.focus({ preventScroll: true }); },
  };
}
```

- [ ] **Step 2: Create `public/xp/voice.js`**

```js
// Audio-only clip player for narration. Used only when VOICE_ENABLED is true.

export function createVoice({ base = '/xp/voice/' } = {}) {
  let on = false;
  let audio = null;
  const stop = () => { if (audio) { audio.pause(); audio = null; } };
  return {
    play(id) {
      if (!on || !id) return;
      stop();
      audio = new Audio(`${base}${id}.mp3`);
      audio.play().catch(() => {});
    },
    stop,
    setOn(value) { on = !!value; if (!on) stop(); },
    get on() { return on; },
  };
}
```

- [ ] **Step 3: Create `public/xp/operator.js`**

```js
// The AI's voice: ZW-Core types its lines into the terminal after a short
// thinking indicator, drives the orb's mood and announces each finished line
// once to screen readers. Lines are queued; a new line fast-forwards the one
// still typing so the AI never falls behind the visitor.

import { NARRATION } from './content.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const AI_PROMPT = 'zw-core> ';

export function createOperator({ term, liveEl, getCore, restingState = () => 'idle', voice = null, speed = 22, thinkMs = [300, 600] }) {
  let queue = Promise.resolve();
  let generation = 0;

  async function speak(text, voiceId, gen) {
    if (gen === generation) {
      getCore()?.setState('thinking');
      const thinking = term.print(`${AI_PROMPT}...`, 'ai ai-thinking');
      thinking.setAttribute('aria-hidden', 'true');
      await sleep(thinkMs[0] + Math.random() * (thinkMs[1] - thinkMs[0]));
      thinking.remove();
    }
    getCore()?.setState('speaking');
    if (voiceId) voice?.play(voiceId);
    const line = await term.typeLine(text, { prompt: AI_PROMPT, cls: 'ai', speed, skip: () => gen !== generation });
    line.setAttribute('aria-hidden', 'true');
    liveEl.textContent = text;
    if (gen === generation) getCore()?.setState(restingState());
  }

  return {
    say(idOrText) {
      const isId = typeof idOrText === 'string' && Object.hasOwn(NARRATION, idOrText);
      const text = isId ? NARRATION[idOrText] : String(idOrText);
      const gen = ++generation;
      queue = queue.then(() => speak(text, isId ? idOrText : null, gen)).catch(() => {});
      return queue;
    },
  };
}
```

- [ ] **Step 4: Add the `thinking` and `alert` moods to `public/xp/core.js`**

- Replace the `AMP` line with:
  ```js
  const AMP = { idle: 0.04, thinking: 0.07, speaking: 0.16, focus: 0.08, alert: 0.12 };
  const SPIN = { thinking: 4, alert: 2 };
  const ALERT_COLOR = '#ff5d5d';
  ```
- In `mountCss`, replace `setState` with:
  ```js
  setState(state) {
    orb.classList.toggle('is-speaking', state === 'speaking' || state === 'thinking');
    orb.classList.toggle('is-alert', state === 'alert');
  },
  ```
- In `mountGl`:
  - Replace `const targetColor = new THREE.Color(BASE_COLOR);` with:
    ```js
    const targetColor = new THREE.Color(BASE_COLOR);
    const baseColor = new THREE.Color(BASE_COLOR);
    const alertColor = new THREE.Color(ALERT_COLOR);
    let spin = 1;
    let mood = 'idle';
    ```
  - Change `orb.rotation.y += dt * 0.12;` to `orb.rotation.y += dt * 0.12 * spin;`.
  - Replace the returned `setState` and `focus` with:
    ```js
    setState(state) {
      mood = state;
      targetAmp = AMP[state] ?? AMP.idle;
      spin = SPIN[state] ?? 1;
      targetColor.copy(state === 'alert' ? alertColor : baseColor);
    },
    focus(id) {
      baseColor.set(colorOf(id));
      if (mood !== 'alert') targetColor.copy(baseColor);
    },
    ```

Append to `public/xp/core-fallback.css`:

```css
.css-orb.is-alert { filter: saturate(1.4) hue-rotate(150deg); }
```

- [ ] **Step 5: Check syntax and the existing suite**

Run:
```bash
node --check public/xp/terminal.js && node --check public/xp/operator.js && node --check public/xp/voice.js && node --check public/xp/core.js && npm test
```
Expected: no syntax errors; all tests pass. `main.js` still uses the v1 terminal API, which stays backward compatible, so the page keeps working.

- [ ] **Step 6: Commit**

```bash
git add public/xp/terminal.js public/xp/operator.js public/xp/voice.js public/xp/core.js public/xp/core-fallback.css
git commit -m "xp: terminal prompt and completion hooks, AI operator, voice player, orb moods" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Reactions and screensaver

**Files:**
- Create: `public/xp/reactions.js`, `public/xp/screensaver.js`

**Interfaces:**
- Consumes: the operator's `say` (Task 9).
- Produces:
  - `createScreensaver(host)` returns `{ start(), stop(), active }`.
  - `createReactions({ operator, store, getState, screensaver, projectById, setAlert, nudgeMs = 45000, saverMs = 90000 })` returns:
    - `start()`, which installs the activity listeners and timers
    - `welcomeLine()`, which returns a line of text, or the `'welcome'` id when no project was seen before
    - `projectOpened(id)` and `checkHealth(status)`

- [ ] **Step 1: Create `public/xp/screensaver.js`**

```js
// Matrix-rain screensaver, drawn in the current phosphor color. Throttled to
// about 20 fps; any visitor input dismisses it (wired in reactions.js).

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789';

export function createScreensaver(host) {
  let canvas = null;
  let raf = 0;
  let active = false;

  function stop() {
    active = false;
    cancelAnimationFrame(raf);
    canvas?.remove();
    canvas = null;
  }

  function start() {
    if (active) return;
    const c = document.createElement('canvas');
    const ctx = c.getContext?.('2d');
    if (!ctx) return;
    active = true;
    canvas = c;
    c.className = 'saver';
    c.setAttribute('aria-hidden', 'true');
    host.append(c);
    const w = (c.width = host.clientWidth);
    const h = (c.height = host.clientHeight);
    const size = 16;
    const drops = Array.from({ length: Math.max(1, Math.floor(w / size)) }, () => Math.random() * (-h / size));
    const color = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#3dff9a';
    ctx.font = `${size}px monospace`;
    let last = 0;
    const frame = (t) => {
      if (!active) return;
      raf = requestAnimationFrame(frame);
      if (t - last < 50) return;
      last = t;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      drops.forEach((y, i) => {
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * size, y * size);
        drops[i] = y * size > h && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    raf = requestAnimationFrame(frame);
  }

  return { start, stop, get active() { return active; } };
}
```

- [ ] **Step 2: Create `public/xp/reactions.js`**

```js
// The AI's reflexes: an idle nudge, memory of the last project, one remark on
// repeat interest, an honest heads-up when a project is down, and the
// screensaver. Any visitor input resets the timers and dismisses the saver.

export function createReactions({ operator, store, getState, screensaver, projectById, setAlert, nudgeMs = 45000, saverMs = 90000 }) {
  const seen = new Set();
  let started = false;
  let nudged = false;
  let remarked = false;
  let nudgeTimer = null;
  let saverTimer = null;

  function nudgeText(state) {
    if (state.track === 'build') return "Still there? Try 'open sitekit', or ask me something in plain English.";
    if (state.track === 'hire') return "Still there? Try 'scan sportstrata', or 'man zohn' for the short version.";
    return "Still there? Pick a track above, or type 'help'.";
  }

  function schedule() {
    clearTimeout(nudgeTimer);
    clearTimeout(saverTimer);
    if (!started) return;
    if (!nudged) {
      nudgeTimer = setTimeout(() => {
        if (document.hidden) return;
        nudged = true;
        operator.say(nudgeText(getState()));
      }, nudgeMs);
    }
    saverTimer = setTimeout(() => {
      if (document.hidden || getState().focused) return;
      screensaver.start();
    }, saverMs);
  }

  function activity() {
    if (screensaver.active) screensaver.stop();
    schedule();
  }

  return {
    start() {
      if (started) return;
      started = true;
      for (const type of ['keydown', 'pointerdown', 'wheel', 'touchstart']) addEventListener(type, activity, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) screensaver.stop();
        else schedule();
      });
      schedule();
    },
    welcomeLine() {
      const id = store.get('zw_last_project');
      const p = id ? projectById.get(id) : null;
      return p ? `Welcome back. Last time you looked at ${p.name}.` : 'welcome';
    },
    projectOpened(id) {
      const p = projectById.get(id);
      if (!p) return;
      store.set('zw_last_project', id);
      if (seen.has(id) && !remarked) {
        remarked = true;
        operator.say(`Back to ${p.name}. It does tend to pull people in.`);
      }
      seen.add(id);
    },
    checkHealth(status) {
      const down = (status?.projects ?? []).filter((s) => s.status === 'down').map((s) => projectById.get(s.id)?.name ?? s.id);
      if (!down.length) return;
      setAlert(true);
      operator.say(`Heads up: ${down.join(' and ')} ${down.length > 1 ? 'are' : 'is'} not responding right now. That's live data, not a script.`);
    },
  };
}
```

- [ ] **Step 3: Check syntax**

Run: `node --check public/xp/reactions.js && node --check public/xp/screensaver.js && npm test`
Expected: no syntax errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add public/xp/reactions.js public/xp/screensaver.js
git commit -m "xp: AI reactions and matrix-rain screensaver" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Shell commands, main wiring, markup and CRT styles

**Files:**
- Create: `public/xp/shell.js`
- Replace: `public/xp/main.js`
- Modify: `public/index.html`, `public/xp/xp.css`
- Delete: `public/xp/narrator.js`

**Interfaces:**
- Consumes: everything from Tasks 1–10.
- Produces: the finished experience. `registerShell(deps)` takes `{ term, operator, state, store, projectById, focusProject, chooseTrack, setSound }`. `setSound` may be `null`.

- [ ] **Step 1: Create `public/xp/shell.js`**

```js
// Every terminal command, plus tab completion and the plain-English fallback.
// Commands reach the rest of the page only through the deps main.js passes.

import { PROJECTS, TRACKS, OWNER, VOICE_ENABLED, KB, MAN, ABOUT, FALLBACK_REPLY } from './content.js';
import { buildTree, ls, cd, cat, tree as drawTree, formatCwd, completePath } from './fs.js';
import { answer, suggest } from './answers.js';
import { pingLine, pingSummary, parseCount, formatGitLog, formatTop, formatScan, verdict, formatHistory, fetchJson, pingOnce } from './live.js';
import { bar } from './tui.js';
import { applyPalette, PALETTE_NAMES, powerOff } from './crt.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const projectId = (arg) => String(arg ?? '').toLowerCase().replace(/^~?\/?(projects\/)?/, '').replace(/\/$/, '');
const PATH_COMMANDS = ['ls', 'cd', 'cat'];
const PROJECT_COMMANDS = ['open', 'ping', 'scan'];

export function registerShell({ term, operator, state, store, projectById, focusProject, chooseTrack, setSound }) {
  const fsTree = buildTree({ projects: PROJECTS, owner: OWNER, about: ABOUT });
  let cwd = [];
  const setCwd = (next) => { cwd = next; term.setPrompt(`guest@zw-os:${formatCwd(cwd)}$`); };
  const result = (r) => (r.ok ? r.lines : r.error);
  setCwd([]);

  term.register('help', () => term.list().map((c) => c.help), 'help: list commands');
  term.register('ls', (args) => result(ls(fsTree, cwd, args[0] ?? '')), 'ls [path]: list files');
  term.register('cd', (args) => {
    const r = cd(fsTree, cwd, args[0] ?? '~');
    if (!r.ok) return r.error;
    setCwd(r.cwd);
    return [];
  }, 'cd <dir>: change directory');
  term.register('pwd', () => formatCwd(cwd), 'pwd: where am I');
  term.register('cat', (args) => (args[0] ? result(cat(fsTree, cwd, args[0])) : 'usage: cat <file>'), 'cat <file>: print a file');
  term.register('tree', () => drawTree(fsTree), 'tree: the whole filesystem');
  term.register('man', (args) => ((args[0] ?? '').toLowerCase() === 'zohn' ? MAN : `No manual entry for ${args[0] ?? ''}`.trim()), 'man zohn: the manual');
  term.register('open', (args) => {
    const id = projectId(args[0]);
    if (!id) return 'usage: open <project>';
    return focusProject(id, { moveFocus: false }) ? `opening ${projectById.get(id).name}...` : `open: ${id}: no such project. try 'ls projects'.`;
  }, 'open <project>: open a project window');
  term.register('track', (args) => {
    const t = (args[0] ?? '').toLowerCase();
    return chooseTrack(t) ? `track set: ${t}` : 'usage: track hire|build';
  }, 'track hire|build: switch audience');
  term.register('contact', () => [
    TRACKS[state.track ?? 'hire'].contact,
    { prefix: 'linkedin: ', text: OWNER.linkedin, href: OWNER.linkedin },
  ], 'contact: get in touch');

  term.register('ping', async (args) => {
    const id = projectId(args[0]);
    if (!id) return 'usage: ping <project>';
    const p = projectById.get(id);
    if (!p) return `ping: unknown project: ${id}`;
    if (!p.healthUrl) return `ping: ${p.name} has no live host on file`;
    const host = new URL(p.healthUrl).host;
    term.print(`PING ${host}: 4 probes from your browser`);
    const samples = [];
    for (let i = 0; i < 4; i++) {
      const ms = await pingOnce(p.healthUrl);
      samples.push(ms);
      term.print(pingLine(host, ms));
      if (i < 3) await sleep(350);
    }
    return pingSummary(host, samples);
  }, 'ping <project>: live latency from your browser');

  term.register('git', async (args) => {
    if ((args[0] ?? '') !== 'log') return 'usage: git log [-n N]';
    const data = await fetchJson('/api/gitlog');
    const lines = formatGitLog(data?.commits ?? [], parseCount(args.slice(1)));
    if (!lines.length) { await operator.say("The data link to GitHub is unavailable right now. I won't make commits up."); return []; }
    return lines;
  }, 'git log [-n N]: recent public commits');

  term.register('top', async () => {
    const s = await fetchJson('/api/status');
    if (!s?.projects?.length) { await operator.say('Live status is unavailable right now.'); return []; }
    return formatTop(s.projects, PROJECTS);
  }, 'top: projects as live processes');

  term.register('scan', async (args) => {
    const id = projectId(args[0]);
    if (!id) return 'usage: scan <project>';
    const p = projectById.get(id);
    if (!p) return `scan: unknown project: ${id}`;
    if (!p.repo) return `scan: ${p.name} has no public repo on file`;
    term.print(`scanning ${p.repo} ...`);
    const progress = term.print(bar(0, 26));
    const request = fetchJson(`/api/scan?id=${encodeURIComponent(id)}`, { timeoutMs: 6000 });
    for (let i = 1; i <= 10; i++) { progress.textContent = `${bar(i / 10, 26)} ${i * 10}%`; await sleep(110); }
    const data = await request;
    if (!data?.ok) { await operator.say("I can't reach GitHub right now, so I won't guess at the numbers. Try again shortly."); return []; }
    for (const line of formatScan(data)) term.print(line);
    await operator.say(verdict(data, Date.now()));
    return [];
  }, 'scan <project>: live repo analysis');

  term.register('history', async () => {
    const log = await fetchJson('/xp/buildlog.json');
    if (!log) { await operator.say('My build log is unavailable right now.'); return []; }
    for (const line of formatHistory(log)) await operator.say(line);
    return [];
  }, 'history: how this site was built');

  term.register('color', (args) => {
    const name = (args[0] ?? '').toLowerCase();
    if (!applyPalette(name)) return `usage: color ${PALETTE_NAMES.join('|')}`;
    store.set('zw_color', name);
    return `phosphor: ${name}`;
  }, `color <name>: ${PALETTE_NAMES.join(', ')}`);

  if (VOICE_ENABLED && setSound) {
    term.register('sound', (args) => {
      const v = (args[0] ?? '').toLowerCase();
      if (v !== 'on' && v !== 'off') return 'usage: sound on|off';
      setSound(v === 'on');
      return `sound ${v}`;
    }, 'sound on|off: toggle voice');
  } else {
    term.register('sound', () => 'voice module offline. captions only for now.');
  }

  term.register('classic', () => {
    powerOff().then(() => { location.href = '/classic/'; });
    return 'powering down...';
  }, 'classic: plain version of this site');
  term.register('clear', () => { term.clear(); }, 'clear: clear the terminal');
  term.register('whoami', () => 'guest. curious, apparently. good sign.');
  term.register('sudo', (args) => (args.join(' ').toLowerCase() === 'hire zohn'
    ? ['[sudo] access granted.', { prefix: 'next step: ', text: OWNER.email, href: `mailto:${OWNER.email}` }]
    : 'nice try.'));

  term.setCompleter((value) => {
    const m = /^(\S+)\s+(\S*)$/.exec(value);
    if (!m) return [];
    const [, cmd, partial] = m;
    if (PATH_COMMANDS.includes(cmd)) return completePath(fsTree, cwd, partial).map((p) => `${cmd} ${p}`);
    if (PROJECT_COMMANDS.includes(cmd)) {
      return PROJECTS.map((p) => p.id).filter((id) => id.startsWith(partial.toLowerCase())).map((id) => `${cmd} ${id}`);
    }
    return [];
  });

  term.setFallback(async ({ raw, name, args }) => {
    const hit = answer(raw, KB);
    if (hit) { await operator.say(hit.reply); return []; }
    if (args.length === 0) {
      const pool = [...term.names(), ...PROJECTS.map((p) => p.id), ...Object.keys(fsTree.children)];
      const s = suggest(name, pool);
      if (s) return `command not found: ${name}. did you mean '${s}'?`;
    }
    await operator.say(FALLBACK_REPLY);
    return [];
  });
}
```

- [ ] **Step 2: Replace `public/xp/main.js`**

```js
// Runs the story: power-on and BIOS (acts 0-1), OS boot (act 2), the core
// (act 3) and track view (act 4). The only module that knows the act order.

import { PROJECTS, TRACKS, VOICE_ENABLED, BANNER } from './content.js';
import { createTerminal } from './terminal.js';
import { getBootLines, formatLine } from './boot.js';
import { readDevice, formatPost, memoryLine, memorySteps } from './bios.js';
import { createOperator } from './operator.js';
import { createVoice } from './voice.js';
import { initPalette, glitch, powerOff } from './crt.js';
import { imageToAscii } from './ascii.js';
import { createScreensaver } from './screensaver.js';
import { createReactions } from './reactions.js';
import { registerShell } from './shell.js';
import { fetchJson } from './live.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
if (params.has('fresh')) { for (const k of ['zw_visited', 'zw_track', 'zw_last_project']) store.remove(k); }

const projectById = new Map(PROJECTS.map((p) => [p.id, p]));
const phone = matchMedia('(max-width: 640px)').matches;
const state = { opened: false, skipped: false, track: null, focused: null, alert: false };
const restingState = () => (state.alert ? 'alert' : state.focused ? 'focus' : 'idle');

initPalette(store);
const term = createTerminal($('#terminal'));

// Start loading the orb immediately; the boot sequence hides the wait.
let core = null;
const leaving = Boolean(window.__zwLeaving);
const corePromise = (leaving ? Promise.reject(new Error('leaving')) : import('./core.js'))
  .then((m) => m.mountCore($('#core-stage'), { particles: phone ? 900 : 2400, forceCss: params.has('css-core') }))
  .then((c) => { core = c; return c; })
  .catch(() => null);

const voice = createVoice();
const operator = createOperator({ term, liveEl: $('#live'), getCore: () => core, restingState, voice: VOICE_ENABLED ? voice : null });
const reactions = createReactions({
  operator, store, projectById, getState: () => state, screensaver: createScreensaver($('#core')),
  setAlert: (on) => { state.alert = on; core?.setState(restingState()); },
});

// ---------- Acts 0-2: power on, BIOS, OS boot ----------

async function bios() {
  const device = readDevice();
  for (const line of formatPost(device)) {
    if (state.skipped) return;
    if (device.memoryMB && line === memoryLine(device.memoryMB)) {
      const el = term.print('Memory test: 0 MB');
      for (const n of memorySteps(device.memoryMB)) {
        if (state.skipped) return;
        el.textContent = `Memory test: ${n} MB`;
        await sleep(70);
      }
      el.textContent = line;
    } else {
      term.print(line);
    }
    await sleep(200);
  }
}

function printBanner() {
  for (const line of BANNER) term.print(line, 'banner').setAttribute('aria-hidden', 'true');
}

async function boot() {
  const lines = getBootLines({ url: params.has('offline') ? '/api/__offline' : '/api/status' });
  await sleep(550);
  await bios();
  if (state.skipped) return;
  await sleep(300);
  term.clear();
  await term.typeLine('who is zohn_wheeler', { prompt: '> ', typo: { at: 7, wrong: 'zhon' } });
  for (const line of await lines) {
    if (state.skipped) return;
    await sleep(160);
    if (state.skipped) return;
    term.print(formatLine(line), `tag-${line.tag.toLowerCase()}`);
  }
  if (state.skipped) return;
  printBanner();
  await sleep(700);
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
  const active = document.activeElement;
  if (!phone && (active === document.body || active === $('#skip'))) term.focus();
  term.print("identity core online. type 'help' for commands, or just ask a question.");
  reactions.start();
  fetchJson('/api/status').then((s) => { if (s) reactions.checkHealth(s); });
  await Promise.race([corePromise, sleep(2500)]);

  const chosen = () => Boolean(state.track || state.focused);
  if (returning) {
    await operator.say(reactions.welcomeLine());
    if (chosen()) return;
    const saved = store.get('zw_track');
    if (Object.hasOwn(TRACKS, saved)) { chooseTrack(saved); return; }
  } else {
    await operator.say('intro');
    if (chosen()) return;
    await operator.say('bio');
    if (chosen()) return;
  }
  await operator.say('ask');
  if (!state.track) showTrackChoice();
}

function showTrackChoice() {
  const choice = $('#track-choice');
  choice.hidden = false;
  const typing = document.activeElement === $('#term-input') && $('#term-input').value !== '';
  if (!typing) choice.querySelector('button').focus({ preventScroll: true });
}

// ---------- Act 4: tracks, rings and the project window ----------

function chooseTrack(track, { quiet = false } = {}) {
  if (!Object.hasOwn(TRACKS, track)) return false;
  state.track = track;
  store.set('zw_track', track);
  const choice = $('#track-choice');
  const hadFocus = choice.contains(document.activeElement);
  const ringFocus = document.activeElement?.closest?.('.ring-node')?.dataset.id;
  choice.hidden = true;
  const toggle = $('#track-toggle');
  toggle.hidden = false;
  toggle.textContent = `track: ${track}`;
  renderRings();
  if (hadFocus) $('#rings .ring-node')?.focus({ preventScroll: true });
  else if (ringFocus) (document.querySelector(`.ring-node[data-id="${ringFocus}"]`) ?? $('#rings .ring-node'))?.focus({ preventScroll: true });
  if (!quiet) operator.say(`track.${track}`);
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
  reactions.projectOpened(id);
  operator.say(`project.${id}`);
  return true;
}

function renderPanel(p, moveFocus) {
  const panel = $('#panel');
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
  const art = panel.querySelector('[data-ascii]');
  art.textContent = p.thumb ? 'rendering...' : '[ no image on file ]';
  if (p.thumb) {
    imageToAscii(p.thumb, phone ? 40 : 64).then((lines) => {
      if (state.focused === p.id) art.textContent = lines ? lines.join('\n') : '[ no image on file ]';
    });
  }
  panel.hidden = false;
  glitch(panel);
  if (moveFocus) panel.querySelector('.close').focus({ preventScroll: true });
}

function closePanel() {
  const returnTo = state.focused;
  $('#panel').hidden = true;
  state.focused = null;
  core?.focus(null);
  core?.setState(restingState());
  markCurrent();
  const ring = document.querySelector(`.ring-node[data-id="${returnTo}"]`) ?? (phone ? $('#rings button') : null);
  if (ring) ring.focus({ preventScroll: true });
  else if (!phone) term.focus();
}

function setSound(on) {
  voice.setOn(on);
  const b = $('#sound');
  b.setAttribute('aria-pressed', String(on));
  b.textContent = `sound: ${on ? 'on' : 'off'}`;
}

registerShell({ term, operator, state, store, projectById, focusProject, chooseTrack, setSound: VOICE_ENABLED ? setSound : null });

// ---------- Wiring ----------

$('#skip').addEventListener('click', skip);
if (VOICE_ENABLED) $('#sound').addEventListener('click', () => setSound(!voice.on));
else $('#sound').hidden = true;
$('#track-toggle').addEventListener('click', () => chooseTrack(state.track === 'hire' ? 'build' : 'hire'));
document.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => chooseTrack(b.dataset.track)));
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => term.run(b.dataset.cmd)));
$('#panel .close').addEventListener('click', closePanel);
$('.top-links a').addEventListener('click', (e) => {
  e.preventDefault();
  powerOff().then(() => { location.href = '/classic/'; });
});

addEventListener('keydown', (e) => {
  if (!state.opened) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ' && e.key.length !== 1) return;
    skip();
    return;
  }
  if (e.key === 'Escape' && !$('#panel').hidden) closePanel();
});

if (leaving) {
  // The head script is redirecting: no status fetch, no Three.js.
} else if (store.get('zw_visited') === '1') {
  term.print('> who is zohn_wheeler');
  term.print('welcome back. skipping boot sequence.');
  openCore();
} else {
  boot().then(openCore);
}
```

Then delete the old narrator: `git rm public/xp/narrator.js`.

- [ ] **Step 3: Update `public/index.html`**

- Directly after `<body>`, add:
  ```html
  <div id="crt-power" class="crt-power" aria-hidden="true"></div>
  <div class="crt-band" aria-hidden="true"></div>
  ```
- Replace `<span aria-hidden="true">&gt;</span>` inside the form with `<span aria-hidden="true" data-term-prompt>&gt;</span>`.
- Replace the chip buttons with:
  ```html
  <button type="button" data-cmd="help">help</button>
  <button type="button" data-cmd="ls">ls</button>
  <button type="button" data-cmd="cd projects">cd projects</button>
  <button type="button" data-cmd="top">top</button>
  <button type="button" data-cmd="track hire">track hire</button>
  <button type="button" data-cmd="track build">track build</button>
  <button type="button" data-cmd="contact">contact</button>
  ```
- Delete `<p id="caption" class="caption" aria-hidden="true"></p>`.
- Replace the whole `<aside id="panel" …>…</aside>` with:
  ```html
  <aside id="panel" class="panel" hidden aria-labelledby="panel-title">
    <div class="tui-title">
      <span aria-hidden="true">[&nbsp;</span><h2 id="panel-title"></h2><span aria-hidden="true">&nbsp;]</span>
      <span class="tui-fill" aria-hidden="true"></span>
      <button type="button" class="close" aria-label="Close project">[x]</button>
    </div>
    <pre class="ascii" data-ascii aria-hidden="true"></pre>
    <p data-story></p>
    <ul data-stack aria-label="Stack"></ul>
    <div class="links" data-links></div>
  </aside>
  ```

- [ ] **Step 4: Update `public/xp/xp.css`**

- In `:root`, change `--dock-h: 30vh;` to `--dock-h: 34vh;`, and add `--glow: 61,255,154;`.
- In `.terminal`, replace the `text-shadow` value with `0 0 2px rgba(var(--glow),.9), 0 0 8px rgba(var(--glow),.45), 0 0 18px rgba(var(--glow),.18)`.
- In `.chips button`, change `background: rgba(61,255,154,.06)` to `background: rgba(var(--glow),.06)`.
- Delete the `.caption { … }` rule, and delete `.core-window.panel-open .caption { … }` from the phone block.
- Replace the whole `/* Project panel */` block (every `.panel…` rule outside the media query) with:
  ```css
  /* Project window: text-mode, real HTML inside */
  .panel { position: absolute; right: 16px; top: 56px; bottom: 16px; width: min(420px, calc(100% - 32px)); overflow-y: auto; background: var(--bg-2); border: 3px double var(--phosphor); padding: 0 14px 14px; z-index: 6; color: var(--phosphor); }
  .tui-title { position: sticky; top: 0; display: flex; align-items: center; background: var(--bg-2); padding: 6px 0; white-space: nowrap; overflow: hidden; }
  .tui-title h2 { font-size: 15px; color: #fff; margin: 0; font-weight: 600; }
  .tui-fill { flex: 1; overflow: hidden; color: var(--phosphor-dim); }
  .tui-fill::before { content: "══════════════════════════════════════════════════════════════════════════"; }
  .panel .close { flex: none; margin-left: 6px; font: inherit; font-size: 14px; background: none; border: 0; color: var(--phosphor); cursor: pointer; }
  .panel .ascii { font: 9px/1 var(--mono); letter-spacing: 0; color: var(--phosphor); margin: 8px 0; overflow: hidden; white-space: pre; min-height: 9em; }
  .panel p { font-size: 13px; color: var(--text); }
  .panel ul { list-style: none; display: flex; flex-wrap: wrap; gap: 0 10px; margin: 10px 0; font-size: 12px; color: var(--phosphor); }
  .panel li + li::before { content: "· "; color: var(--phosphor-dim); }
  .panel .links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .panel .links a { font-size: 13px; color: var(--phosphor); text-decoration: none; }
  .panel .links a::before { content: "[ "; }
  .panel .links a::after { content: " ]"; }
  .panel .links a:hover, .panel .links a:focus-visible { background: var(--phosphor); color: var(--bg); }
  ```
- In the phone block, delete `.panel img { … }`, and add `.panel .ascii { font-size: 7px; }`.
- Append:
  ```css
  /* ---------- CRT ---------- */
  body::before { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 51; border-radius: 22px; box-shadow: inset 0 0 0 2px #000, inset 0 0 90px rgba(0,0,0,.85); background: radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,.5) 100%); }
  .crt-band { position: fixed; left: 0; right: 0; top: 0; height: 22vh; pointer-events: none; z-index: 52; background: linear-gradient(to bottom, transparent, rgba(255,255,255,.04) 50%, transparent); transform: translateY(-22vh); animation: crt-band 8s linear infinite; }
  @keyframes crt-band { to { transform: translateY(100vh); } }
  main { animation: crt-flicker 5s steps(1, end) infinite; }
  @keyframes crt-flicker { 0%, 100% { opacity: 1; } 31% { opacity: .975; } 33% { opacity: 1; } 68% { opacity: .98; } 70% { opacity: 1; } }
  .crt-power { position: fixed; inset: 0; z-index: 90; pointer-events: none; background: #000; animation: crt-power-bg .7s ease-out .05s both; }
  .crt-power::after { content: ""; position: absolute; inset: 0; background: #fff; transform: scale(0, .003); animation: crt-power-line .7s ease-out .05s both; }
  @keyframes crt-power-bg { 0%, 55% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes crt-power-line { 0% { transform: scale(0, .003); opacity: 1; } 25% { transform: scale(1, .003); opacity: 1; } 55% { transform: scale(1, 1); opacity: .85; } 100% { transform: scale(1, 1); opacity: 0; } }
  .crt-power.off { animation: crt-off-bg .34s ease-in both; }
  .crt-power.off::after { animation: crt-off-line .34s ease-in both; }
  @keyframes crt-off-bg { 0% { opacity: 0; } 30%, 100% { opacity: 1; } }
  @keyframes crt-off-line { 0% { transform: scale(1, 1); opacity: .9; } 55% { transform: scale(1, .004); opacity: 1; } 85% { transform: scale(.004, .004); opacity: 1; } 100% { transform: scale(0, 0); opacity: 0; } }
  .glitch { animation: crt-glitch .25s steps(2, end) 1; }
  @keyframes crt-glitch { 0% { transform: translateX(2px); filter: drop-shadow(-2px 0 #ff00c8) drop-shadow(2px 0 #00e5ff); } 50% { transform: translateX(-2px); } 100% { transform: none; filter: none; } }

  /* AI lines, banner, prompt, screensaver */
  .term-line.ai { color: var(--core); text-shadow: 0 0 8px rgba(79,209,255,.45); }
  .term-line.ai-thinking { opacity: .6; }
  .term-line.banner { color: var(--phosphor); line-height: 1.15; white-space: pre; }
  .term-form [data-term-prompt] { white-space: nowrap; color: var(--phosphor); }
  .saver { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 8; background: #000; }
  ```

- [ ] **Step 5: Run the unit suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Verify in the browser**

Start the dev server on port 8899, and use Chrome DevTools MCP (tools prefixed `mcp__plugin_ecc_chrome-devtools__`, loaded via ToolSearch).

1. Open `/?fresh`. A white line blooms into the screen. Then:
   - The BIOS lines show real values: the memory count-up on Chromium, cores, GPU (if exposed), display, browser and locale.
   - The screen clears, the typo plays, the live boot lines stream, the banner appears, and the core opens.
   - The AI types intro, then bio, then ask in the terminal, prefixed `zw-core>` and in the AI color, each after a thinking line.
   - No caption remains under the orb.
2. Run every new command and check its output:
   - `ls`, `cd projects`, `ls`, `cat sportstrata/README`, `cd ..`, `tree`, `pwd` and `man zohn`. The prompt follows the current directory.
   - `ping sportstrata` (4 probes and a summary) and `ping sitekit` (honest error).
   - `git log -n 3`, which shows real commits or the honest unavailable line.
   - `top`.
   - `scan sportstrata`, which shows a progress bar, the boxed report and an AI verdict. `scan botchase` gives the honest no-repo line.
   - `history`, where the AI narrates the build log.
   - `color amber`. Reload, and the color persists.
   - `opne`, which gives a did-you-mean.
   - `what's your tech stack?` and `can you build a website for my roofing business`, which get AI answers.
   - `asdf qwer`, which gets the fallback reply.
   - Tab completion: `cd pro` then Tab gives `cd projects/`, and `scan sp` then Tab gives `scan sportstrata `.
3. Choose a track, then open SportStrata. The text-mode window opens with the glitch pulse and an ASCII-art screenshot. Escape closes it.
4. Leave the page idle for 45 s. One nudge line arrives. At 90 s the matrix rain starts, and a key press dismisses it. Waiting the real time is acceptable. Do not change the code's defaults to test faster.
5. Click "plain version". The screen collapses to a dot, then `/classic/` loads.
6. Check CLS on `/?immersive=1&fresh` (auto-dock) and on a returning reload. Both must be under 0.1.
7. Take screenshots at 1440x900 and 390x844, including an open project window. The console must show no errors. Save screenshots outside the repo.

- [ ] **Step 7: Commit**

```bash
git add public/xp/shell.js public/xp/main.js public/index.html public/xp/xp.css
git commit -m "xp: CRT power-on, BIOS, AI-operated terminal, text-mode windows and live commands" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`public/xp/narrator.js` was already staged by `git rm` in Step 2.

---

### Task 12: Verification pass

**Files:**
- Modify: `public/xp/buildlog.json` (regenerated), `docs/superpowers/specs/2026-10-12-immersive-v2-design.md` (status line)

- [ ] **Step 1: Unit suite.** Run `npm test`. Every test must pass.
- [ ] **Step 2: Weight budget.** Run `du -cb public/index.html public/xp/*.js public/xp/*.css | tail -1`. The total must be under 256000 bytes.
- [ ] **Step 3: Failure modes in the browser:**

| Check | How | Expected |
|---|---|---|
| Status down | `/?fresh&offline` | Fallback boot lines; the core still opens |
| No WebGL | `/?fresh&css-core` | CSS orb; thinking, speaking and alert classes still toggle |
| Unknown scan id | Fetch `/api/scan?id=nope` | `{ ok: false, error: "unknown project" }` |
| Build log served | Fetch `/xp/buildlog.json` | 200 with real numbers |
| Reduced motion | Emulate the preference, open `/` | Redirects to `/classic/` |
| Phone 390x844 | Chips include `ls` and `cd projects`; the project window is opaque and readable | No horizontal scroll |

- [ ] **Step 4: Lighthouse.** Run the Lighthouse audit on `http://localhost:8899/?immersive=1` for desktop and mobile. Accessibility must stay at 100. Fix accessibility failures caused by the new markup only.
- [ ] **Step 5: CLS.** Trace `/?immersive=1&fresh` with auto-dock, and a returning reload. Both must be under 0.1.
- [ ] **Step 6: Refresh the build log.** Run `node scripts/build-log.mjs`, then check that `history` in the browser reflects the new numbers.
- [ ] **Step 7: Mark the spec.** Set the spec status line to `**Status:** Implemented on branch immersive-v2`.
- [ ] **Step 8: Commit.**

```bash
git add public/xp/buildlog.json docs/superpowers/specs/2026-10-12-immersive-v2-design.md
git commit -m "xp: refresh build log; mark v2 spec implemented" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do not merge, push or deploy.
