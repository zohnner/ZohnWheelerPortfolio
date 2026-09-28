# Sitekit v1 — Template A ("Call Now") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this portfolio repo into a multi-tenant local-business website system: one content file per business renders a production-quality multi-page "Call Now" trades site, served as a private tokenized demo or live on the client's own domain.

**Architecture:** Static portfolio moves into `public/`. A Pages Functions root middleware routes by hostname/path: portfolio host → static files; `/demo/<slug>?t=` → token-gated demo render; any other host → live client site looked up by domain in D1. Rendering is pure ESM modules in `sitekit/` (plain template strings, no framework), shared by the middleware, the `scripts/site.mjs` CLI, and `node:test` tests.

**Tech Stack:** Cloudflare Pages + Pages Functions, D1 (`portfolio-leads`, binding `DB`), Resend (optional email), Node 24 (`node:test`, built-ins only), Wrangler 4.

**Spec:** `docs/superpowers/specs/2026-09-28-sitekit-template-a-design.md` (read its "Amendments during planning" section — this plan implements the amended spec).

## Global Constraints

- **Zero runtime dependencies.** Node built-ins only. The only package ever installed is `sharp`, via `npm i --no-save sharp`, for the one-off image optimizer in Task 14. Never add `dependencies` to `package.json`.
- New shared modules live in `sitekit/` as **`.mjs` ESM**. Pages Functions stay `.js` (ESM, bundled by Wrangler). Tests are `test/*.test.mjs`, run with `npm test` (= `node --test`).
- **Never render fabricated facts.** Reviews, ratings, review counts, gallery photos, license numbers, founding year, and trust badges come **only** from the content file. Industry presets contain only generic, owner-reviewable copy (headlines, service descriptions, FAQ, "why us").
- All content strings are escaped with `esc()`; the rich-text fields (`services[].body`, `areas[].intro`, `faq[].a`, `financing.text`) go through `md()` only.
- Object lookups keyed by user input (`THEMES[x]`, `PRESETS[x]`) use `Object.hasOwn` so `__proto__`/`constructor` can't resolve.
- D1 writes from the CLI go through a generated file + `wrangler d1 execute --file`. **Never** a multi-statement `--command` (it silently drops every statement after the first). Single-statement reads may use `--command`.
- Unknown slug, bad token, unknown domain, `lost` site → **bare 404** (`Not found`, text/plain). Demo pages send `noindex, nofollow` in both the meta tag and an `X-Robots-Tag` header.
- Demo tokens are 24 random bytes as hex (192-bit), compared with a constant-time `safeEqual`.
- Lead emails go to `sites.contact_email` in live mode and to `zohnwheeler@gmail.com` in demo mode (or when `contact_email` is empty).
- `sites/*.json` is **gitignored** (the repo is public; prospect data must not be published). Only the fictional sample `sites/acme-roofing.json` is committed. D1's `content_json` is the backup.
- Preset copy uses the curly apostrophe `’` so strings can stay single-quoted.
- Every commit message ends with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use a second `-m`).

## File Structure

```
public/                          ← moved: all currently-served static files (Task 1)
  sk/stock/<industry>/*.jpg      ← stock photos, two sizes each (Task 14)
functions/
  _middleware.js                 ← NEW routing + rendering entry (Task 11)
  api/lead.js                    ← NEW client-site lead form (Task 11)
  api/demo-theme.js              ← NEW presenter "Save this look" (Task 11)
  api/inquiry.js, inquiries.js, project.js   ← unchanged
sitekit/
  escape.mjs        esc, safeUrl, md                                  (Task 2)
  themes.mjs        THEMES, ACCENT_SWATCHES, isHex, resolveTheme,
                    themeVars, themeCss                               (Task 3)
  icons.mjs         ICONS, icon                                       (Task 3)
  presets/shared.mjs, roofing.mjs, hvac.mjs, foundation.mjs,
          generic.mjs, index.mjs                                      (Task 4)
  content.mjs       resolveContent, resolveImage, imgAttrs            (Task 4)
  validate.mjs      validateContent, similarity                       (Task 5)
  route.mjs         portfolioHostList, isPortfolioHost, parsePage,
                    routeRequest                                      (Task 6)
  presenter.mjs     PRESENTER_COOKIE, safeEqual, readCookie,
                    presenterCookieValue, isPresenter, deviceFromUA   (Task 7)
  lead.mjs          parseLead                                         (Task 7)
  presenter-panel.mjs  PRESENTER_CSS, presenterPanel                  (Task 8)
  templates/call-now/styles.mjs    CSS                                (Task 8)
  templates/call-now/sections.mjs  tel, band, head, section fns       (Task 8)
  templates/call-now/schema.mjs    businessLd, faqLd, serviceLd, ldScripts (Task 8)
  templates/call-now/layout.mjs    layout                             (Task 8)
  templates/call-now/pages.mjs     PAGES                              (Tasks 8–9)
  render.mjs        listPages, makeCtx, renderPage, renderSitemap,
                    renderRobots                                      (Tasks 8–9)
  admin.mjs         STATUSES, sqlString, pushSql, normalizeDomain,
                    statusSql (T10); parseCsv, slugify,
                    normalizeIndustry, stubFromProspect, pitchText (T12)
  admin-pages.mjs   renderPresenterHome, renderUnavailable            (Task 11)
scripts/site.mjs    CLI                                               (Tasks 10, 12, 13)
scripts/optimize-images.mjs                                           (Task 14)
schema-sitekit.sql                                                    (Task 11)
sites/acme-roofing.json          fictional sample (committed)         (Task 11)
test/*.test.mjs, test/fixtures/acme-roofing.json
package.json                     scripts only, no deps                (Task 1)
```

---

### Task 1: Move the static site into `public/` and add the test runner

Fixes the existing exposure: `pages_build_output_dir: "."` publicly serves `schema.sql`, `schema-dashboard.sql`, and `scripts/new-project.js`.

**Files:**
- Move (git mv) into `public/`: `404.html`, `Zohn-Wheeler-Resume.pdf`, `_headers`, `ai-workflow.html`, `apple-touch-icon.png`, `dashboard.html`, `favicon.svg`, `hire.html`, `icon-192.png`, `icon-512.png`, `index.html`, `manifest.json`, `og-image-hire.png`, `og-image.png`, `profile.jpeg`, `robots.txt`, `sitemap.xml`, `thumb-botchase.jpg`, `thumb-sportstrata.jpg`, `thumb-zretrobuild.jpg`
- Modify: `wrangler.jsonc`, `.gitignore`, `README.md`
- Create: `package.json`, `test/smoke.test.mjs`

**Interfaces:**
- Produces: `npm test` runs every `test/*.test.mjs`. Static files served from `public/`.

- [ ] **Step 1: Move the static files**

```bash
mkdir -p public
git mv 404.html Zohn-Wheeler-Resume.pdf _headers ai-workflow.html apple-touch-icon.png dashboard.html favicon.svg hire.html icon-192.png icon-512.png index.html manifest.json og-image-hire.png og-image.png profile.jpeg robots.txt sitemap.xml thumb-botchase.jpg thumb-sportstrata.jpg thumb-zretrobuild.jpg public/
```

- [ ] **Step 2: Point Pages at `public/`**

Replace `wrangler.jsonc` with:

```jsonc
{
  "name": "zohnwheelerportfolio",
  "pages_build_output_dir": "public",
  "compatibility_date": "2026-08-06",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "portfolio-leads",
      "database_id": "dea712c2-4383-41c2-8689-9d625b8fd1e1"
    }
  ]
}
```

- [ ] **Step 3: Add `package.json` (scripts only)**

```json
{
  "name": "zohnwheelerportfolio",
  "private": true,
  "scripts": {
    "test": "node --test",
    "site": "node scripts/site.mjs"
  }
}
```

- [ ] **Step 4: Extend `.gitignore`**

Append:

```
scripts/.site-push.sql
dist/

# Client/prospect content is private (public repo). D1 content_json is the backup.
sites/*
!sites/acme-roofing.json
```

- [ ] **Step 5: Write a smoke test proving the move**

`test/smoke.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('static site lives in public/ and private files stay out of it', () => {
  for (const f of ['index.html', 'hire.html', 'dashboard.html', '_headers', '404.html']) {
    assert.ok(fs.existsSync(`public/${f}`), `public/${f} should exist`);
  }
  for (const f of ['schema.sql', 'schema-dashboard.sql', 'scripts', 'functions', 'sitekit', 'sites']) {
    assert.ok(!fs.existsSync(`public/${f}`), `public/${f} must not exist`);
  }
});

test('wrangler serves public/', () => {
  const cfg = fs.readFileSync('wrangler.jsonc', 'utf8');
  assert.match(cfg, /"pages_build_output_dir":\s*"public"/);
});
```

- [ ] **Step 6: Run the test**

Run: `npm test`
Expected: PASS, 2 tests.

- [ ] **Step 7: Verify locally that URLs are unchanged**

Run in the background: `npx wrangler pages dev public --port 8788`
Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/hire.html
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/schema.sql
```

Expected: `200`, `200`, then `404` (or the styled 404 page with status 404). Stop the dev server.

- [ ] **Step 8: Update README**

In `README.md`, change the "Pages" section intro line to: `All served files live in public/ (wrangler.jsonc: pages_build_output_dir = "public"). Everything outside public/ — schemas, scripts, functions source, sitekit/ — is never served.` Change `wrangler pages dev .` to `wrangler pages dev public`.

- [ ] **Step 9: Commit**

```bash
git add -A public wrangler.jsonc package.json .gitignore README.md test/smoke.test.mjs
git commit -m "Move static site into public/ so schemas and scripts stop being served; add node:test runner" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Flag for the human (do not push yourself)**

Tell Zohn: after he pushes, verify production with `curl -s -o /dev/null -w "%{http_code}" https://zohnwheelerportfolio.pages.dev/schema.sql` → `404` and `/` → `200`. If `/` breaks, the Cloudflare dashboard's Pages "Build output directory" setting must be set to `public` (Settings → Builds).

---

### Task 2: Escaping and safe markdown (`sitekit/escape.mjs`)

**Files:**
- Create: `sitekit/escape.mjs`
- Test: `test/escape.test.mjs`

**Interfaces:**
- Produces: `esc(value): string`, `safeUrl(url): string` (returns the URL or `'#'`), `md(src): string` (HTML).

- [ ] **Step 1: Write the failing tests**

`test/escape.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, safeUrl, md } from '../sitekit/escape.mjs';

test('esc escapes HTML-significant characters', () => {
  assert.equal(esc(`<a href="x">Tom's & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom&#39;s &amp; Jerry&#39;s&lt;/a&gt;');
});

test('esc stringifies non-strings and blanks null/undefined', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(42), '42');
});

test('safeUrl allows https, tel, mailto, root-relative, and hash links', () => {
  for (const u of ['https://a.com', 'tel:+18165550100', 'mailto:a@b.com', '/contact', '#faq']) {
    assert.equal(safeUrl(u), u);
  }
});

test('safeUrl rejects javascript:, data:, http:, and protocol-relative links', () => {
  for (const u of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'http://a.com', '//evil.com']) {
    assert.equal(safeUrl(u), '#');
  }
});

test('md renders paragraphs and bullet lists', () => {
  assert.equal(md('First para.\n\n- one\n- two'), '<p>First para.</p><ul><li>one</li><li>two</li></ul>');
});

test('md joins soft-wrapped lines into one paragraph', () => {
  assert.equal(md('line one\nline two'), '<p>line one line two</p>');
});

test('md renders bold, italic, and safe links', () => {
  assert.equal(
    md('**Big** *deal* [call](tel:+18165550100)'),
    '<p><strong>Big</strong> <em>deal</em> <a href="tel:+18165550100">call</a></p>'
  );
});

test('md escapes raw HTML and neutralizes unsafe links', () => {
  assert.equal(
    md('<script>x</script> [bad](javascript:void0)'),
    '<p>&lt;script&gt;x&lt;/script&gt; <a href="#">bad</a></p>'
  );
});

test('md of empty input is empty', () => {
  assert.equal(md(''), '');
  assert.equal(md(undefined), '');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/escape.test.mjs`
Expected: FAIL — `Cannot find module '.../sitekit/escape.mjs'`.

- [ ] **Step 3: Implement**

`sitekit/escape.mjs`:

```js
// Everything that reaches HTML goes through here. Content will come from
// scraped sites and AI drafts, so treat every string as hostile.

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
}

const SAFE_URL = /^(https:\/\/|tel:|mailto:|\/(?!\/)|#)/i;

export function safeUrl(url) {
  const u = String(url ?? '').trim();
  return SAFE_URL.test(u) ? u : '#';
}

// Input is already HTML-escaped, so link URLs are safe inside the attribute.
function inline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a href="${safeUrl(url)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Deliberately tiny markdown subset: paragraphs, "- " lists, **bold**,
// *italic*, [links](https:|tel:|mailto:|/path). Anything else is plain text.
export function md(src) {
  const blocks = String(src ?? '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocks
    .filter((b) => b.trim())
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(esc(l.replace(/^\s*[-*]\s+/, '')))}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(esc(lines.map((l) => l.trim()).join(' ')))}</p>`;
    })
    .join('');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/escape.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add sitekit/escape.mjs test/escape.test.mjs
git commit -m "Add sitekit HTML escaping and safe markdown subset" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Themes and icons

**Files:**
- Create: `sitekit/themes.mjs`, `sitekit/icons.mjs`
- Test: `test/themes.test.mjs`

**Interfaces:**
- Produces:
  - `THEMES: { [preset]: { label, light: Tokens, dark: Tokens } }`, where Tokens = `{ bg, surface, text, muted, primary, onPrimary, border, accent, onAccent }`
  - `ACCENT_SWATCHES: string[]`
  - `isHex(v): boolean`
  - `resolveTheme(base = {}, overrides = {}): { preset, mode, accent? }` (only valid values survive; overrides win)
  - `themeVars(theme): Tokens`, `themeCss(theme): string` (`:root{--bg:…;…}`)
  - `ICONS: { [name]: svgInner }`, `icon(name, cls = 'icon'): string` (unknown name → `check`)

- [ ] **Step 1: Write the failing tests**

`test/themes.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, resolveTheme, themeCss, themeVars, isHex } from '../sitekit/themes.mjs';
import { ICONS, icon } from '../sitekit/icons.mjs';

test('resolveTheme applies valid overrides', () => {
  assert.deepEqual(
    resolveTheme({ preset: 'storm', mode: 'light' }, { preset: 'bold', accent: '#123456', mode: 'dark' }),
    { preset: 'bold', mode: 'dark', accent: '#123456' }
  );
});

test('resolveTheme ignores invalid overrides and keeps the base', () => {
  assert.deepEqual(
    resolveTheme({ preset: 'storm', mode: 'light', accent: '#f97316' }, { preset: 'nope', accent: 'red', mode: 'sepia' }),
    { preset: 'storm', mode: 'light', accent: '#f97316' }
  );
});

test('resolveTheme falls back to storm/light and rejects prototype keys', () => {
  assert.deepEqual(resolveTheme({ preset: 'x', mode: 'y', accent: 'z' }), { preset: 'storm', mode: 'light' });
  assert.deepEqual(resolveTheme({}, { preset: '__proto__' }), { preset: 'storm', mode: 'light' });
  assert.deepEqual(resolveTheme({}, { preset: 'constructor' }), { preset: 'storm', mode: 'light' });
});

test('themeCss emits custom properties with a readable onAccent for the accent', () => {
  const css = themeCss({ preset: 'storm', mode: 'light', accent: '#facc15' });
  assert.match(css, /^:root\{/);
  assert.match(css, /--accent:#facc15/);
  assert.match(css, /--onAccent:#111111/);
  assert.match(themeCss({ preset: 'storm', mode: 'light', accent: '#1e3a8a' }), /--onAccent:#ffffff/);
});

test('themeVars returns the preset tokens for the mode', () => {
  assert.equal(themeVars({ preset: 'clean', mode: 'dark' }).bg, THEMES.clean.dark.bg);
});

test('every theme defines the same tokens in light and dark, all hex', () => {
  const keys = Object.keys(THEMES.storm.light).sort();
  for (const [name, t] of Object.entries(THEMES)) {
    assert.ok(t.label, `${name} label`);
    for (const mode of ['light', 'dark']) {
      assert.deepEqual(Object.keys(t[mode]).sort(), keys, `${name}.${mode}`);
      for (const v of Object.values(t[mode])) assert.ok(isHex(v), `${name}.${mode} ${v}`);
    }
  }
});

test('icon renders an inline svg and falls back to check', () => {
  assert.match(icon('phone'), /^<svg class="icon" viewBox="0 0 24 24"[^>]*aria-hidden="true">/);
  assert.equal(icon('does-not-exist'), icon('check'));
  assert.ok(Object.keys(ICONS).length >= 16);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/themes.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement themes**

`sitekit/themes.mjs`:

```js
// Theme presets are what gets switched live in a sales demo. Each defines the
// same tokens for light and dark; `accent` can be overridden per site.

export const THEMES = {
  storm: {
    label: 'Storm',
    light: { bg: '#ffffff', surface: '#f3f5f9', text: '#0f1b2d', muted: '#4b5a73', primary: '#12233f', onPrimary: '#ffffff', border: '#dde3ec', accent: '#f97316', onAccent: '#111111' },
    dark: { bg: '#0b1220', surface: '#131d31', text: '#e8edf6', muted: '#a3b0c6', primary: '#16274a', onPrimary: '#ffffff', border: '#24334f', accent: '#fb923c', onAccent: '#111111' },
  },
  clean: {
    label: 'Clean',
    light: { bg: '#ffffff', surface: '#f5f8fc', text: '#111827', muted: '#4b5563', primary: '#0f3d91', onPrimary: '#ffffff', border: '#e2e8f0', accent: '#2563eb', onAccent: '#ffffff' },
    dark: { bg: '#0a0f1a', surface: '#111a2b', text: '#e5e9f0', muted: '#a0aec0', primary: '#132a57', onPrimary: '#ffffff', border: '#1f2c44', accent: '#60a5fa', onAccent: '#111111' },
  },
  bold: {
    label: 'Bold',
    light: { bg: '#ffffff', surface: '#f4f4f2', text: '#161616', muted: '#52525b', primary: '#1c1c1c', onPrimary: '#ffffff', border: '#e4e4e0', accent: '#facc15', onAccent: '#111111' },
    dark: { bg: '#0d0d0d', surface: '#171717', text: '#f2f2f0', muted: '#a8a8a3', primary: '#1f1f1f', onPrimary: '#ffffff', border: '#2a2a2a', accent: '#facc15', onAccent: '#111111' },
  },
  earth: {
    label: 'Earth',
    light: { bg: '#fdfcf9', surface: '#f3efe6', text: '#1f2a1f', muted: '#56604f', primary: '#23402b', onPrimary: '#ffffff', border: '#e3dccd', accent: '#c0823f', onAccent: '#111111' },
    dark: { bg: '#0f140f', surface: '#172017', text: '#ecefe6', muted: '#a9b3a0', primary: '#1d3323', onPrimary: '#ffffff', border: '#26332a', accent: '#d69a57', onAccent: '#111111' },
  },
};

export const ACCENT_SWATCHES = ['#f97316', '#2563eb', '#facc15', '#16a34a', '#dc2626', '#7c3aed'];

const HEX = /^#[0-9a-f]{6}$/i;
export function isHex(v) {
  return HEX.test(String(v ?? ''));
}

const MODES = new Set(['light', 'dark']);
const validPreset = (p) => typeof p === 'string' && Object.hasOwn(THEMES, p);

export function resolveTheme(base = {}, overrides = {}) {
  const preset = validPreset(overrides.preset) ? overrides.preset : validPreset(base.preset) ? base.preset : 'storm';
  const mode = MODES.has(overrides.mode) ? overrides.mode : MODES.has(base.mode) ? base.mode : 'light';
  const accent = isHex(overrides.accent) ? overrides.accent : isHex(base.accent) ? base.accent : null;
  return accent ? { preset, mode, accent } : { preset, mode };
}

function contrastText(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff';
}

export function themeVars(theme) {
  const vars = { ...THEMES[theme.preset][theme.mode] };
  if (theme.accent) {
    vars.accent = theme.accent;
    vars.onAccent = contrastText(theme.accent);
  }
  return vars;
}

export function themeCss(theme) {
  return `:root{${Object.entries(themeVars(theme)).map(([k, v]) => `--${k}:${v}`).join(';')}}`;
}
```

- [ ] **Step 4: Implement icons**

`sitekit/icons.mjs`:

```js
// Inline stroke icons (24x24). Inline SVG means no icon font or extra request.
export const ICONS = {
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  tools: '<path d="M3 21l7-7"/><path d="m14 4 6 6-4 4-6-6z"/><path d="M4 4l4 4"/>',
  cloud: '<path d="M17 18H7a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-2 8z"/>',
  droplet: '<path d="M12 2s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
  snowflake: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-13-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 7 0 5 3 10 7 10z"/>',
  fan: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 16h15a3 3 0 1 1-3 3"/><path d="M3 12h18"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  pin: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  dollar: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

export function icon(name, cls = 'icon') {
  const inner = Object.hasOwn(ICONS, name) ? ICONS[name] : ICONS.check;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test test/themes.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add sitekit/themes.mjs sitekit/icons.mjs test/themes.test.mjs
git commit -m "Add sitekit theme presets and inline icon set" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Industry presets and content resolution

**Files:**
- Create: `sitekit/presets/shared.mjs`, `sitekit/presets/roofing.mjs`, `sitekit/presets/hvac.mjs`, `sitekit/presets/foundation.mjs`, `sitekit/presets/generic.mjs`, `sitekit/presets/index.mjs`, `sitekit/content.mjs`
- Test: `test/content.test.mjs`

**Interfaces:**
- Consumes: `esc` (Task 2), `ICONS` (Task 3), `THEMES` (Task 3, in the test only).
- Produces:
  - `PRESETS: { roofing, hvac, foundation, generic }`, each `{ industry, trade, schemaType, theme, hero:{headline,sub,image,cta}, banner:{enabled,text}, copy:{servicesIntro,whyUsTitle,areasIntro,ctaTitle,ctaText}, services:[{slug,name,icon,image,summary,body}], whyUs:[{icon,title,text}], faq:[{q,a}], financing:{enabled,title,text}, trustSuggestions:string[], sectionOrder:string[] }`
  - `getPreset(industry)` → the preset, or `generic`
  - `resolveContent(content)` → `{ industry, trade, schemaType, business, hero, banner, financing, theme, copy, services, whyUs, faq, sectionOrder, trust, areas, reviews, gallery }`
  - `resolveImage(ref, slug): string|null` (`stock:a/b.jpg` → `/sk/stock/a/b.jpg`, `site:x.jpg` → `/sk/sites/<slug>/x.jpg`, `https://…` unchanged, anything else → `null`)
  - `imgAttrs(ref, slug, sizes): string|null`, an escaped `src="…"` plus, for stock refs, `srcset`/`sizes` (the `-sm.jpg` sibling; hero 800w/1600w, everything else 600w/1200w)

- [ ] **Step 1: Write the failing tests**

`test/content.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../sitekit/presets/index.mjs';
import { resolveContent, resolveImage, imgAttrs } from '../sitekit/content.mjs';
import { ICONS } from '../sitekit/icons.mjs';
import { THEMES } from '../sitekit/themes.mjs';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECTION_NAMES = ['hero', 'trust', 'services', 'whyUs', 'gallery', 'reviews', 'areas', 'financing', 'faq', 'cta'];

test('every preset is complete and internally valid', () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), ['foundation', 'generic', 'hvac', 'roofing']);
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.equal(p.industry, name);
    for (const k of ['trade', 'schemaType']) assert.ok(p[k], `${name}.${k}`);
    assert.ok(Object.hasOwn(THEMES, p.theme.preset), `${name} theme`);
    assert.ok(p.hero.headline && p.hero.sub && p.hero.image && p.hero.cta, `${name} hero`);
    assert.ok(p.copy.ctaTitle, `${name} copy`);
    assert.equal(p.financing.enabled, false, `${name} financing must default off (it is a claim)`);
    assert.equal(p.banner.enabled, false, `${name} banner must default off`);
    for (const s of p.services) {
      assert.match(s.slug, SLUG);
      assert.ok(s.name && s.summary && s.body, `${name}/${s.slug}`);
      assert.ok(Object.hasOwn(ICONS, s.icon), `${name}/${s.slug} icon ${s.icon}`);
      assert.match(s.image, /^stock:[a-z]+\/[a-z0-9-]+\.jpg$/);
    }
    for (const w of p.whyUs) assert.ok(Object.hasOwn(ICONS, w.icon), `${name} whyUs icon`);
    for (const sec of p.sectionOrder) assert.ok(SECTION_NAMES.includes(sec), `${name} section ${sec}`);
    for (const k of ['reviews', 'gallery', 'trust', 'areas']) assert.equal(p[k], undefined, `${name} must not define ${k}`);
  }
});

test('resolveContent merges preset defaults under content overrides', () => {
  const c = resolveContent({
    industry: 'roofing',
    business: { name: 'X Roofing', phone: '8165550100' },
    hero: { headline: 'Custom headline' },
    services: [{ slug: 'roof-repair', name: 'Repairs' }, { slug: 'skylights', name: 'Skylights' }],
  });
  assert.equal(c.hero.headline, 'Custom headline');
  assert.equal(c.hero.image, 'stock:roofing/hero.jpg');
  assert.equal(c.services[0].name, 'Repairs');
  assert.equal(c.services[0].icon, 'tools');
  assert.ok(c.services[0].body.length > 50);
  assert.equal(c.services[1].icon, 'check');
  assert.equal(c.services[1].image, undefined);
  assert.equal(c.faq.length, PRESETS.roofing.faq.length);
  assert.equal(c.trade, 'Roofing');
  assert.equal(c.schemaType, 'RoofingContractor');
});

test('resolveContent never fills verifiable facts from presets', () => {
  const c = resolveContent({ industry: 'hvac', business: { name: 'X', phone: '8165550100' }, services: [{ slug: 'ac-repair', name: 'AC' }] });
  assert.deepEqual(c.reviews, []);
  assert.deepEqual(c.gallery, []);
  assert.deepEqual(c.trust, []);
  assert.deepEqual(c.areas, []);
});

test('resolveContent falls back to generic for unknown or prototype industries', () => {
  assert.equal(resolveContent({ industry: 'plumbing', business: {} }).industry, 'generic');
  assert.equal(resolveContent({ industry: '__proto__', business: {} }).industry, 'generic');
});

test('resolveImage maps stock, site, and https refs and rejects everything else', () => {
  assert.equal(resolveImage('stock:roofing/hero.jpg', 'acme'), '/sk/stock/roofing/hero.jpg');
  assert.equal(resolveImage('site:crew.jpg', 'acme'), '/sk/sites/acme/crew.jpg');
  assert.equal(resolveImage('https://cdn.example.com/a.jpg', 'acme'), 'https://cdn.example.com/a.jpg');
  assert.equal(resolveImage('http://x.com/a.jpg', 'acme'), null);
  assert.equal(resolveImage('javascript:alert(1)', 'acme'), null);
  assert.equal(resolveImage(undefined, 'acme'), null);
});

test('imgAttrs adds srcset for stock images only', () => {
  assert.equal(
    imgAttrs('stock:roofing/hero.jpg', 'acme', '100vw'),
    'src="/sk/stock/roofing/hero.jpg" srcset="/sk/stock/roofing/hero-sm.jpg 800w, /sk/stock/roofing/hero.jpg 1600w" sizes="100vw"'
  );
  assert.match(imgAttrs('stock:roofing/gutters.jpg', 'acme', '50vw'), /gutters-sm\.jpg 600w, \/sk\/stock\/roofing\/gutters\.jpg 1200w/);
  assert.equal(imgAttrs('https://cdn.example.com/a.jpg?x=1&y=2', 'acme', '50vw'), 'src="https://cdn.example.com/a.jpg?x=1&amp;y=2"');
  assert.equal(imgAttrs('nope', 'acme', '50vw'), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/content.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Shared preset pieces**

`sitekit/presets/shared.mjs`:

```js
// Copy shared across industry presets. Presets hold only generic,
// owner-reviewable copy — never reviews, ratings, badges, or licenses.

export const DEFAULT_ORDER = ['hero', 'trust', 'services', 'whyUs', 'gallery', 'reviews', 'areas', 'financing', 'faq', 'cta'];

export const RESPECT = { icon: 'home', title: 'Respect for your home', text: 'Protected floors and landscaping, tidy work areas, and a full cleanup when we’re done.' };
export const EASY = { icon: 'phone', title: 'Easy to reach', text: 'Real people answer the phone and keep you updated from start to finish.' };
export const LOCAL = { icon: 'pin', title: 'Local and accountable', text: 'We live and work here, and our reputation rides on every job.' };

export const COPY = {
  areasIntro: 'Proudly serving homeowners throughout the area, including:',
  ctaText: 'Call today or request an estimate online — we’ll get back to you fast.',
};
```

- [ ] **Step 4: Roofing preset**

`sitekit/presets/roofing.mjs`:

```js
import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

export default {
  industry: 'roofing',
  trade: 'Roofing',
  schemaType: 'RoofingContractor',
  theme: { preset: 'storm', mode: 'light' },
  hero: {
    headline: 'Roofing done right the first time.',
    sub: 'Roof replacement, repairs, and storm damage restoration for homes across the Kansas City metro.',
    image: 'stock:roofing/hero.jpg',
    cta: 'Get a Free Estimate',
  },
  banner: { enabled: false, text: 'Hail or wind damage? Call now to schedule a storm inspection.' },
  copy: {
    ...COPY,
    servicesIntro: 'From a few missing shingles to a full tear-off, every job starts with a clear written quote.',
    whyUsTitle: 'Why homeowners call us first',
    ctaTitle: 'Ready for a roof you don’t have to think about?',
  },
  services: [
    {
      slug: 'roof-replacement', name: 'Roof Replacement', icon: 'home', image: 'stock:roofing/roof-replacement.jpg',
      summary: 'Complete tear-off and replacement with quality materials and a clean job site.',
      body: 'A new roof is one of the biggest investments you’ll make in your home. We walk you through material options, colors, and ventilation, then handle the full tear-off, decking inspection, and installation.\n\n- Architectural shingle and metal options\n- Decking inspected and replaced where needed\n- Full cleanup, including a magnetic nail sweep',
    },
    {
      slug: 'roof-repair', name: 'Roof Repair', icon: 'tools', image: 'stock:roofing/roof-repair.jpg',
      summary: 'Leaks, missing shingles, flashing, and vent boots fixed fast.',
      body: 'Small problems turn into big ones once water gets in. We find the source of the leak — not just the stain on your ceiling — and fix it properly.\n\n- Leak detection and repair\n- Flashing, vent boot, and chimney repairs\n- Missing or damaged shingle replacement',
    },
    {
      slug: 'storm-damage', name: 'Storm Damage', icon: 'cloud', image: 'stock:roofing/storm-damage.jpg',
      summary: 'Hail and wind damage inspections, with help understanding your insurance claim.',
      body: 'Kansas City hail can damage a roof in minutes, and the damage isn’t always visible from the ground. We inspect, document what we find with photos, and explain your options before you file a claim.\n\n- Hail and wind damage inspections\n- Photo documentation for your insurance company\n- Emergency tarping to prevent further damage',
    },
    {
      slug: 'gutters', name: 'Gutters', icon: 'droplet', image: 'stock:roofing/gutters.jpg',
      summary: 'Seamless gutters and downspouts that keep water away from your home.',
      body: 'Gutters protect your roof, siding, and foundation. We install seamless gutters sized for your roof and run downspouts where the water actually needs to go.\n\n- Seamless aluminum gutters\n- Downspout extensions and drainage planning\n- Gutter guards',
    },
  ],
  whyUs: [
    { icon: 'check', title: 'Clear, written quotes', text: 'You’ll know exactly what’s included and what it costs before any work begins.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'How do I know if I need a new roof or just a repair?', a: 'It depends on the roof’s age, how widespread the damage is, and whether leaks keep coming back. We’ll inspect it and give you an honest recommendation — if a repair will do the job, we’ll tell you.' },
    { q: 'Do you help with insurance claims?', a: 'We document storm damage with photos and walk you through what to expect from the claims process. Coverage decisions are always up to your insurance company.' },
    { q: 'How long does a roof replacement take?', a: 'Most homes are finished in one to two days, depending on size, weather, and the materials you choose.' },
    { q: 'How much does a new roof cost?', a: 'It depends on the size and pitch of your roof and the materials you pick. You’ll get a detailed written estimate so there are no surprises.' },
  ],
  financing: { enabled: false, title: 'Flexible financing available', text: 'Ask about payment options that fit your budget.' },
  trustSuggestions: ['Licensed & Insured', 'Manufacturer Certified', 'BBB Accredited', 'Workmanship Warranty'],
  sectionOrder: DEFAULT_ORDER,
};
```

- [ ] **Step 5: HVAC preset**

`sitekit/presets/hvac.mjs`:

```js
import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

export default {
  industry: 'hvac',
  trade: 'Heating & Cooling',
  schemaType: 'HVACBusiness',
  theme: { preset: 'clean', mode: 'light' },
  hero: {
    headline: 'Stay comfortable all year long.',
    sub: 'Air conditioning, furnace repair, and system replacement for homes across the Kansas City metro.',
    image: 'stock:hvac/hero.jpg',
    cta: 'Schedule Service',
  },
  banner: { enabled: false, text: 'AC or furnace out? Call now for fast service.' },
  copy: {
    ...COPY,
    servicesIntro: 'Repairs, replacements, and tune-ups for every major brand of heating and cooling equipment.',
    whyUsTitle: 'Why homeowners trust our techs',
    ctaTitle: 'Too hot, too cold, or just not right?',
  },
  services: [
    {
      slug: 'ac-repair', name: 'AC Repair', icon: 'snowflake', image: 'stock:hvac/ac-repair.jpg',
      summary: 'Fast diagnosis and repair when your air conditioner stops keeping up.',
      body: 'Kansas City summers don’t wait. We diagnose the real problem, explain your options in plain language, and get the cool air flowing again.\n\n- Refrigerant leaks and weak cooling\n- Capacitors, contactors, and fan motors\n- Frozen coils and drainage problems',
    },
    {
      slug: 'furnace-repair', name: 'Furnace Repair', icon: 'flame', image: 'stock:hvac/furnace-repair.jpg',
      summary: 'Heat restored quickly and safely when the temperature drops.',
      body: 'A furnace that won’t start on a January night is an emergency. We troubleshoot ignition, airflow, and safety issues, and make sure your system is running safely before we leave.\n\n- No-heat and short-cycling repairs\n- Igniters, flame sensors, and blower motors\n- Carbon monoxide safety checks',
    },
    {
      slug: 'hvac-replacement', name: 'System Replacement', icon: 'fan', image: 'stock:hvac/hvac-replacement.jpg',
      summary: 'Right-sized, efficient heating and cooling systems, installed properly.',
      body: 'When repairs stop making sense, we help you choose a system sized for your home — not just the biggest unit on the truck — and install it to manufacturer specifications.\n\n- Load calculations for proper sizing\n- High-efficiency furnaces, air conditioners, and heat pumps\n- Clear options at different price points',
    },
    {
      slug: 'maintenance-plans', name: 'Maintenance Plans', icon: 'tools', image: 'stock:hvac/maintenance-plans.jpg',
      summary: 'Seasonal tune-ups that prevent breakdowns and extend system life.',
      body: 'Most breakdowns start as small problems a tune-up would have caught. A maintenance plan keeps your system checked every spring and fall.\n\n- Spring AC and fall furnace tune-ups\n- Filter, coil, and electrical checks\n- Priority scheduling for plan members',
    },
  ],
  whyUs: [
    { icon: 'check', title: 'Straight answers', text: 'We explain what’s wrong and what it will cost before any work begins.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'How often should my system be serviced?', a: 'Once a year for each system is a good rule — cooling in the spring and heating in the fall.' },
    { q: 'Should I repair or replace my system?', a: 'Age, repair cost, and efficiency all factor in. We’ll give you an honest side-by-side so you can decide.' },
    { q: 'How long does a new system install take?', a: 'Most replacements are completed in a single day.' },
    { q: 'What size system do I need?', a: 'It depends on your home’s square footage, insulation, windows, and layout. We calculate it rather than guess.' },
  ],
  financing: { enabled: false, title: 'Flexible financing available', text: 'Ask about payment options for new equipment.' },
  trustSuggestions: ['Licensed & Insured', 'NATE-Certified Technicians', 'Manufacturer Dealer', 'Satisfaction Guarantee'],
  sectionOrder: DEFAULT_ORDER,
};
```

- [ ] **Step 6: Foundation preset**

`sitekit/presets/foundation.mjs`:

```js
import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

export default {
  industry: 'foundation',
  trade: 'Foundation Repair',
  schemaType: 'HomeAndConstructionBusiness',
  theme: { preset: 'earth', mode: 'light' },
  hero: {
    headline: 'Protect your home from the ground up.',
    sub: 'Foundation repair, basement waterproofing, and crawl space solutions for homes across the Kansas City metro.',
    image: 'stock:foundation/hero.jpg',
    cta: 'Get a Free Inspection',
  },
  banner: { enabled: false, text: 'Water in your basement? Call now to schedule an inspection.' },
  copy: {
    ...COPY,
    servicesIntro: 'We find what’s causing the problem and fix it at the source, not just the symptoms.',
    whyUsTitle: 'Why homeowners choose us',
    ctaTitle: 'Cracks, water, or sinking floors?',
  },
  services: [
    {
      slug: 'foundation-repair', name: 'Foundation Repair', icon: 'layers', image: 'stock:foundation/foundation-repair.jpg',
      summary: 'Stabilize settling, cracked, and bowing foundation walls for good.',
      body: 'Kansas City’s clay soil swells and shrinks with the seasons, and foundations pay the price. We find the cause of the movement and recommend a repair that addresses it.\n\n- Wall bracing and anchors for bowing walls\n- Piering for settling foundations\n- Crack repair and sealing',
    },
    {
      slug: 'basement-waterproofing', name: 'Basement Waterproofing', icon: 'droplet', image: 'stock:foundation/basement-waterproofing.jpg',
      summary: 'Keep water out and your basement dry, usable, and healthy.',
      body: 'A wet basement ruins belongings, invites mold, and makes finished space impossible. We pinpoint where water is getting in and stop it.\n\n- Interior drainage systems and sump pumps\n- Crack and wall sealing\n- Dehumidification',
    },
    {
      slug: 'crawl-space', name: 'Crawl Space Repair', icon: 'home', image: 'stock:foundation/crawl-space.jpg',
      summary: 'Encapsulation and support for damp or sagging crawl spaces.',
      body: 'What happens in your crawl space affects the air and floors in the rest of your home. We dry it out, seal it up, and support floors that have started to sag.\n\n- Vapor barriers and encapsulation\n- Floor joist support\n- Moisture and humidity control',
    },
    {
      slug: 'concrete-leveling', name: 'Concrete Leveling', icon: 'tools', image: 'stock:foundation/concrete-leveling.jpg',
      summary: 'Lift and level sunken driveways, patios, and walkways.',
      body: 'Sunken concrete is a trip hazard and can send water toward your foundation. Leveling lifts the existing slab back into place, usually for far less than replacement.\n\n- Driveways, sidewalks, and patios\n- Steps and garage floors\n- Joint sealing to prevent future settling',
    },
  ],
  whyUs: [
    { icon: 'check', title: 'Honest assessments', text: 'We’ll tell you what your home actually needs — and what it doesn’t.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'Are foundation cracks always a problem?', a: 'No — some hairline cracks are normal. Wide, growing, or stair-step cracks and bowing walls should be inspected.' },
    { q: 'Why is my basement wet?', a: 'Common causes include poor drainage, cracks, and pressure from saturated soil. An inspection pinpoints the source.' },
    { q: 'How long does foundation repair take?', a: 'Many repairs are completed in one to three days, depending on the method and scope.' },
    { q: 'Will repairs disrupt my home?', a: 'Most work happens outside or in the basement, and we protect the areas we work in.' },
  ],
  financing: { enabled: false, title: 'Flexible financing available', text: 'Ask about payment options for larger repairs.' },
  trustSuggestions: ['Licensed & Insured', 'Transferable Warranty', 'BBB Accredited', 'Free Inspections'],
  sectionOrder: DEFAULT_ORDER,
};
```

- [ ] **Step 7: Generic preset and index**

`sitekit/presets/generic.mjs`:

```js
import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

// Fallback for trades without a dedicated preset. Services must come from the
// content file (validation requires at least one).
export default {
  industry: 'generic',
  trade: 'Home Services',
  schemaType: 'HomeAndConstructionBusiness',
  theme: { preset: 'bold', mode: 'light' },
  hero: {
    headline: 'Quality work, done right.',
    sub: 'Trusted local service for homes across the Kansas City metro.',
    image: 'stock:generic/hero.jpg',
    cta: 'Get a Free Estimate',
  },
  banner: { enabled: false, text: 'Need help fast? Call us today.' },
  copy: {
    ...COPY,
    servicesIntro: 'Every job starts with a clear quote and ends with a clean workspace.',
    whyUsTitle: 'Why homeowners choose us',
    ctaTitle: 'Ready to get started?',
  },
  services: [],
  whyUs: [
    { icon: 'check', title: 'Clear, upfront quotes', text: 'You’ll know what’s included and what it costs before work begins.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'What areas do you serve?', a: 'We serve homeowners across the Kansas City metro. Give us a call to confirm we cover your neighborhood.' },
    { q: 'How do I get started?', a: 'Call us or request an estimate online, and we’ll get back to you quickly.' },
  ],
  financing: { enabled: false, title: 'Financing available', text: 'Ask about payment options.' },
  trustSuggestions: ['Licensed & Insured'],
  sectionOrder: DEFAULT_ORDER,
};
```

`sitekit/presets/index.mjs`:

```js
import roofing from './roofing.mjs';
import hvac from './hvac.mjs';
import foundation from './foundation.mjs';
import generic from './generic.mjs';

export const PRESETS = { roofing, hvac, foundation, generic };

export function getPreset(industry) {
  return typeof industry === 'string' && Object.hasOwn(PRESETS, industry) ? PRESETS[industry] : PRESETS.generic;
}
```

- [ ] **Step 8: Content resolution**

`sitekit/content.mjs`:

```js
import { getPreset } from './presets/index.mjs';
import { esc } from './escape.mjs';

// Objects merge shallowly (content keys win); arrays from the content file
// replace the preset's. Facts (trust, areas, reviews, gallery) never come
// from a preset.
const MERGE_OBJECTS = ['hero', 'banner', 'financing', 'theme', 'copy'];
const PRESET_ARRAYS = ['services', 'whyUs', 'faq', 'sectionOrder'];
const CONTENT_ARRAYS = ['trust', 'areas', 'reviews', 'gallery'];

export function resolveContent(content) {
  const preset = getPreset(content.industry);
  const out = {
    industry: preset.industry,
    trade: content.trade || preset.trade,
    schemaType: preset.schemaType,
    business: { ...(content.business || {}) },
  };
  for (const key of MERGE_OBJECTS) out[key] = { ...(preset[key] || {}), ...(content[key] || {}) };
  for (const key of PRESET_ARRAYS) {
    out[key] = Array.isArray(content[key]) && content[key].length ? content[key] : preset[key] || [];
  }
  for (const key of CONTENT_ARRAYS) out[key] = Array.isArray(content[key]) ? content[key] : [];
  // A content service with a preset slug inherits that preset service's copy/icon/image.
  out.services = out.services.map((s) => {
    const base = preset.services.find((p) => p.slug === s.slug) || {};
    return { icon: 'check', ...base, ...s };
  });
  return out;
}

export function resolveImage(ref, slug) {
  const r = String(ref ?? '');
  if (r.startsWith('stock:')) return `/sk/stock/${r.slice(6)}`;
  if (r.startsWith('site:')) return `/sk/sites/${slug}/${r.slice(5)}`;
  if (r.startsWith('https://')) return r;
  return null;
}

// Stock images ship in two sizes (scripts/optimize-images.mjs): <name>.jpg and
// <name>-sm.jpg. Heroes are 1600/800 wide, everything else 1200/600.
export function imgAttrs(ref, slug, sizes) {
  const src = resolveImage(ref, slug);
  if (!src) return null;
  let attrs = `src="${esc(src)}"`;
  if (String(ref).startsWith('stock:')) {
    const small = src.replace(/\.jpg$/, '-sm.jpg');
    const [sw, lw] = /\/hero\.jpg$/.test(src) ? [800, 1600] : [600, 1200];
    attrs += ` srcset="${esc(small)} ${sw}w, ${esc(src)} ${lw}w" sizes="${esc(sizes)}"`;
  }
  return attrs;
}
```

- [ ] **Step 9: Run to verify pass**

Run: `node --test test/content.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 10: Commit**

```bash
git add sitekit/presets sitekit/content.mjs test/content.test.mjs
git commit -m "Add roofing/HVAC/foundation/generic presets and content resolution" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Content validation (`sitekit/validate.mjs`)

**Files:**
- Create: `sitekit/validate.mjs`, `test/fixtures/acme-roofing.json`
- Test: `test/validate.test.mjs`

**Interfaces:**
- Consumes: `PRESETS` (Task 4), `THEMES`, `isHex` (Task 3), `resolveImage` (Task 4).
- Produces: `validateContent(content, { slug, fileExists }) → { errors: string[], warnings: string[] }`. `fileExists(relPath)` receives repo-relative paths like `public/sk/stock/roofing/hero.jpg`. `similarity(a, b) → number` (word-set Jaccard, 0–1).
- Produces: fixture `test/fixtures/acme-roofing.json`, used by later tests and copied to `sites/acme-roofing.json` in Task 10.

- [ ] **Step 1: Create the fixture (fictional business, 555 number)**

`test/fixtures/acme-roofing.json`:

```json
{
  "business": {
    "name": "Acme Roofing",
    "phone": "816-555-0100",
    "email": "office@acmeroofing.example",
    "address": "123 SE Main St, Lee's Summit, MO 64063",
    "city": "Lee's Summit",
    "founded": 2004,
    "license": "MO #12345",
    "hours": "Mon–Fri 7am–6pm, Sat 8am–2pm",
    "emergency": true,
    "rating": 4.8,
    "reviewCount": 112
  },
  "industry": "roofing",
  "theme": { "preset": "storm", "accent": "#f97316", "mode": "light" },
  "trust": ["Licensed & Insured", "Workmanship Warranty"],
  "services": [
    { "slug": "roof-replacement", "name": "Roof Replacement" },
    { "slug": "storm-damage", "name": "Storm Damage" },
    {
      "slug": "skylights",
      "name": "Skylights",
      "summary": "Skylight installation and leak repair.",
      "body": "We install **new** skylights and fix leaky ones.\n\n- Venting skylights\n- Flashing and leak repair"
    }
  ],
  "areas": [
    {
      "slug": "lees-summit",
      "name": "Lee's Summit",
      "intro": "Lee's Summit is home base. From the older homes around downtown to the newer subdivisions near Lakewood and Longview Lake, we've replaced and repaired roofs across every part of town. Spring hail is the big threat here, so we keep storm-season inspections quick and document everything with photos for your insurance company."
    },
    {
      "slug": "blue-springs",
      "name": "Blue Springs",
      "intro": "Blue Springs neighborhoods mix 1970s ranch homes with brand-new construction, and each needs a different approach. Older roofs often hide worn decking and outdated ventilation, while newer builds sometimes have builder-grade shingles that struggle after a hard winter. We inspect carefully and recommend only what your roof needs."
    }
  ],
  "reviews": [
    { "name": "Dana R.", "rating": 5, "text": "They replaced our roof in a day and you'd never know they were here. Great communication the whole way through.", "source": "Google" },
    { "name": "Marcus T.", "rating": 5, "text": "Came out the morning after the hailstorm, documented everything, and made the insurance process painless.", "source": "Google" }
  ],
  "gallery": [],
  "banner": { "enabled": true, "text": "Hail damage? Free 24/7 storm inspections." }
}
```

- [ ] **Step 2: Write the failing tests**

`test/validate.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateContent, similarity } from '../sitekit/validate.mjs';

const fixture = () => JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json', 'utf8'));
const opts = { slug: 'acme-roofing', fileExists: () => true };

test('the fixture is valid with no warnings', () => {
  assert.deepEqual(validateContent(fixture(), opts), { errors: [], warnings: [] });
});

test('required fields are enforced', () => {
  const r = validateContent({ business: {}, services: [] }, opts);
  assert.ok(r.errors.includes('business.name is required'));
  assert.ok(r.errors.includes('business.phone is required'));
  assert.ok(r.errors.includes('industry is required'));
  assert.ok(r.errors.includes('services must have at least one entry'));
});

test('non-object content is rejected', () => {
  assert.deepEqual(validateContent(null, opts).errors, ['content must be a JSON object']);
});

test('phone must have 10 digits (a leading 1 is allowed)', () => {
  const c = fixture();
  c.business.phone = '555-0100';
  assert.ok(validateContent(c, opts).errors.includes('business.phone must have 10 digits'));
  c.business.phone = '+1 (816) 555-0100';
  assert.deepEqual(validateContent(c, opts).errors, []);
});

test('unknown industry, theme preset, mode, and bad accent are errors', () => {
  const c = fixture();
  c.industry = 'plumbing';
  c.theme = { preset: 'neon', accent: 'orange', mode: 'sepia' };
  const { errors } = validateContent(c, opts);
  assert.ok(errors.some((e) => e.startsWith('industry "plumbing"')));
  assert.ok(errors.includes('theme.preset "neon" is not one of: storm, clean, bold, earth'));
  assert.ok(errors.includes('theme.accent must be #rrggbb'));
  assert.ok(errors.includes('theme.mode must be light or dark'));
});

test('service and area slugs must be valid and unique', () => {
  const c = fixture();
  c.services.push({ slug: 'Bad Slug', name: 'x' }, { slug: 'skylights', name: 'dupe' });
  c.areas[1].slug = 'lees-summit';
  const { errors } = validateContent(c, opts);
  assert.ok(errors.includes('services[3].slug must be lowercase-hyphenated'));
  assert.ok(errors.includes('duplicate services slug "skylights"'));
  assert.ok(errors.includes('duplicate areas slug "lees-summit"'));
});

test('reviews need a name, text, and 1-5 rating', () => {
  const c = fixture();
  c.reviews.push({ name: '', rating: 7, text: '' });
  const { errors } = validateContent(c, opts);
  assert.ok(errors.includes('reviews[2] needs name, text, and a rating from 1 to 5'));
});

test('image refs must resolve to existing files', () => {
  const c = fixture();
  c.hero = { image: 'stock:roofing/missing.jpg' };
  c.gallery = [{ before: 'site:b.jpg', after: 'ftp://x/a.jpg' }];
  const seen = [];
  const { errors } = validateContent(c, { slug: 'acme-roofing', fileExists: (p) => (seen.push(p), false) });
  assert.ok(seen.includes('public/sk/stock/roofing/missing.jpg'));
  assert.ok(seen.includes('public/sk/sites/acme-roofing/b.jpg'));
  assert.ok(errors.includes('hero.image: file not found (public/sk/stock/roofing/missing.jpg)'));
  assert.ok(errors.includes('gallery[0].after: use stock:, site:, or an https:// URL'));
});

test('thin or near-duplicate area pages produce warnings, not errors', () => {
  const c = fixture();
  c.areas[0].intro = 'Short.';
  c.areas[1].intro = c.areas[0].intro;
  const { errors, warnings } = validateContent(c, opts);
  assert.deepEqual(errors, []);
  assert.ok(warnings.includes('areas[0] (lees-summit) intro is under 300 characters — thin city pages can hurt search ranking'));
  assert.ok(warnings.some((w) => w.includes('lees-summit and blue-springs intros are nearly identical')));
});

test('similarity is word-set Jaccard', () => {
  assert.equal(similarity('a b c', 'a b c'), 1);
  assert.equal(similarity('a b', 'c d'), 0);
  assert.equal(similarity('', 'a'), 0);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `node --test test/validate.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`sitekit/validate.mjs`:

```js
import { PRESETS } from './presets/index.mjs';
import { THEMES, isHex } from './themes.mjs';
import { resolveImage } from './content.mjs';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_AREA_INTRO = 300;
const DUPLICATE_THRESHOLD = 0.8;

const words = (s) => String(s ?? '').toLowerCase().match(/[a-z0-9']+/g) || [];

export function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

function checkImage(ref, label, { slug, fileExists }, errors) {
  if (!ref) return;
  const src = resolveImage(ref, slug);
  if (!src) return errors.push(`${label}: use stock:, site:, or an https:// URL`);
  if (src.startsWith('/') && !fileExists(`public${src}`)) errors.push(`${label}: file not found (public${src})`);
}

function checkSlugs(list, name, errors) {
  const seen = new Set();
  list.forEach((item, i) => {
    if (!item?.slug || !SLUG.test(item.slug)) errors.push(`${name}[${i}].slug must be lowercase-hyphenated`);
    else if (seen.has(item.slug)) errors.push(`duplicate ${name} slug "${item.slug}"`);
    else seen.add(item.slug);
    if (!item?.name) errors.push(`${name}[${i}].name is required`);
  });
}

export function validateContent(c, opts) {
  const errors = [];
  const warnings = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { errors: ['content must be a JSON object'], warnings };

  const b = c.business || {};
  if (!b.name) errors.push('business.name is required');
  if (!b.phone) errors.push('business.phone is required');
  else if (String(b.phone).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').length !== 10) {
    errors.push('business.phone must have 10 digits');
  }

  if (!c.industry) errors.push('industry is required');
  else if (!Object.hasOwn(PRESETS, c.industry)) {
    errors.push(`industry "${c.industry}" is not one of: ${Object.keys(PRESETS).join(', ')}`);
  }

  const services = Array.isArray(c.services) ? c.services : [];
  if (!services.length) errors.push('services must have at least one entry');
  checkSlugs(services, 'services', errors);

  const areas = Array.isArray(c.areas) ? c.areas : [];
  checkSlugs(areas, 'areas', errors);
  areas.forEach((a, i) => {
    if (String(a?.intro ?? '').length < MIN_AREA_INTRO) {
      warnings.push(`areas[${i}] (${a?.slug}) intro is under ${MIN_AREA_INTRO} characters — thin city pages can hurt search ranking`);
    }
  });
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      if (similarity(areas[i].intro, areas[j].intro) > DUPLICATE_THRESHOLD) {
        warnings.push(`areas ${areas[i].slug} and ${areas[j].slug} intros are nearly identical — write something specific to each city`);
      }
    }
  }

  if (c.theme) {
    if (c.theme.preset !== undefined && !Object.hasOwn(THEMES, c.theme.preset)) {
      errors.push(`theme.preset "${c.theme.preset}" is not one of: ${Object.keys(THEMES).join(', ')}`);
    }
    if (c.theme.accent !== undefined && !isHex(c.theme.accent)) errors.push('theme.accent must be #rrggbb');
    if (c.theme.mode !== undefined && !['light', 'dark'].includes(c.theme.mode)) errors.push('theme.mode must be light or dark');
  }

  (Array.isArray(c.reviews) ? c.reviews : []).forEach((r, i) => {
    if (!r?.name || !r?.text || !Number.isInteger(r?.rating) || r.rating < 1 || r.rating > 5) {
      errors.push(`reviews[${i}] needs name, text, and a rating from 1 to 5`);
    }
  });

  checkImage(c.hero?.image, 'hero.image', opts, errors);
  services.forEach((s, i) => checkImage(s?.image, `services[${i}].image`, opts, errors));
  (Array.isArray(c.gallery) ? c.gallery : []).forEach((g, i) => {
    checkImage(g?.before, `gallery[${i}].before`, opts, errors);
    checkImage(g?.after, `gallery[${i}].after`, opts, errors);
  });

  return { errors, warnings };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test test/validate.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add sitekit/validate.mjs test/validate.test.mjs test/fixtures/acme-roofing.json
git commit -m "Add content-file validation with doorway-page warnings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Request routing (`sitekit/route.mjs`)

**Files:**
- Create: `sitekit/route.mjs`
- Test: `test/route.test.mjs`

**Interfaces:**
- Produces:
  - `portfolioHostList(envValue?: string): string[]`, the defaults `zohnwheelerportfolio.pages.dev`, `localhost`, `127.0.0.1` plus comma-separated extras
  - `isPortfolioHost(host, list): boolean` (also true for `*.zohnwheelerportfolio.pages.dev` preview deploys)
  - `parsePage(path): {type:'home'}|{type:'contact'}|{type:'service',slug}|{type:'area',slug}|null`
  - `routeRequest({ host, path, searchParams, portfolioHosts })` → one of:
    - `{ kind: 'static' }`
    - `{ kind: 'not-found' }`
    - `{ kind: 'presenter-login', key }`
    - `{ kind: 'presenter-home' }`
    - `{ kind: 'demo', slug, page, token, overrides: { preset?, accent?, mode? } }`
    - `{ kind: 'live', domain, page }`, where `page` may also be `{type:'sitemap'}` or `{type:'robots'}`

- [ ] **Step 1: Write the failing tests**

`test/route.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest, parsePage, portfolioHostList, isPortfolioHost } from '../sitekit/route.mjs';

const hosts = portfolioHostList('studio.example');
const r = (host, pathAndQuery) => {
  const u = new URL(`https://${host}${pathAndQuery}`);
  return routeRequest({ host, path: u.pathname, searchParams: u.searchParams, portfolioHosts: hosts });
};

test('portfolio hosts include defaults, env extras, and preview deploys', () => {
  assert.ok(hosts.includes('zohnwheelerportfolio.pages.dev'));
  assert.ok(hosts.includes('localhost'));
  assert.ok(hosts.includes('studio.example'));
  assert.ok(isPortfolioHost('abc123.zohnwheelerportfolio.pages.dev', hosts));
  assert.ok(!isPortfolioHost('acmeroofing.com', hosts));
});

test('parsePage recognizes the template pages only', () => {
  assert.deepEqual(parsePage('/'), { type: 'home' });
  assert.deepEqual(parsePage(''), { type: 'home' });
  assert.deepEqual(parsePage('/contact/'), { type: 'contact' });
  assert.deepEqual(parsePage('/services/roof-repair'), { type: 'service', slug: 'roof-repair' });
  assert.deepEqual(parsePage('/areas/blue-springs'), { type: 'area', slug: 'blue-springs' });
  assert.equal(parsePage('/services/'), null);
  assert.equal(parsePage('/hire.html'), null);
  assert.equal(parsePage('/services/Bad_Slug'), null);
});

test('portfolio host serves static files outside /demo', () => {
  assert.deepEqual(r('zohnwheelerportfolio.pages.dev', '/'), { kind: 'static' });
  assert.deepEqual(r('zohnwheelerportfolio.pages.dev', '/hire.html'), { kind: 'static' });
  assert.deepEqual(r('localhost:8788', '/demos-are-static.html'), { kind: 'static' });
});

test('/api and /sk pass through on every host', () => {
  assert.deepEqual(r('acmeroofing.com', '/api/lead'), { kind: 'static' });
  assert.deepEqual(r('acmeroofing.com', '/sk/stock/roofing/hero.jpg'), { kind: 'static' });
  assert.deepEqual(r('localhost', '/api/inquiry'), { kind: 'static' });
});

test('presenter login and home', () => {
  assert.deepEqual(r('localhost', '/demo/presenter?key=abc'), { kind: 'presenter-login', key: 'abc' });
  assert.deepEqual(r('localhost', '/demo/presenter'), { kind: 'presenter-home' });
  assert.deepEqual(r('localhost', '/demo/presenter/'), { kind: 'presenter-home' });
});

test('demo routes carry slug, page, token, and theme overrides', () => {
  assert.deepEqual(r('zohnwheelerportfolio.pages.dev', '/demo/acme-roofing?t=tok'), {
    kind: 'demo', slug: 'acme-roofing', page: { type: 'home' }, token: 'tok', overrides: {},
  });
  assert.deepEqual(r('localhost', '/demo/acme-roofing/services/roof-repair?t=tok&theme=bold&accent=%23123456&mode=dark'), {
    kind: 'demo', slug: 'acme-roofing', page: { type: 'service', slug: 'roof-repair' }, token: 'tok',
    overrides: { preset: 'bold', accent: '#123456', mode: 'dark' },
  });
  assert.deepEqual(r('localhost', '/demo/acme-roofing'), {
    kind: 'demo', slug: 'acme-roofing', page: { type: 'home' }, token: '', overrides: {},
  });
});

test('bad demo paths are not found', () => {
  assert.deepEqual(r('localhost', '/demo'), { kind: 'not-found' });
  assert.deepEqual(r('localhost', '/demo/'), { kind: 'not-found' });
  assert.deepEqual(r('localhost', '/demo/Acme'), { kind: 'not-found' });
  assert.deepEqual(r('localhost', '/demo/acme/hire.html'), { kind: 'not-found' });
});

test('client hosts route to live pages by apex domain, ignoring theme params', () => {
  assert.deepEqual(r('www.acmeroofing.com', '/?theme=bold'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'home' } });
  assert.deepEqual(r('acmeroofing.com', '/areas/blue-springs'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'area', slug: 'blue-springs' } });
  assert.deepEqual(r('acmeroofing.com', '/sitemap.xml'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'sitemap' } });
  assert.deepEqual(r('acmeroofing.com', '/robots.txt'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'robots' } });
});

test('client hosts never expose portfolio or demo paths', () => {
  assert.deepEqual(r('acmeroofing.com', '/hire.html'), { kind: 'not-found' });
  assert.deepEqual(r('acmeroofing.com', '/demo/acme-roofing'), { kind: 'not-found' });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/route.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`sitekit/route.mjs`:

```js
// Pure routing: (host, path, query) → what to serve. No I/O, so it's fully
// unit-tested; functions/_middleware.js acts on the descriptor.

const DEFAULT_HOSTS = ['zohnwheelerportfolio.pages.dev', 'localhost', '127.0.0.1'];
const PREVIEW_SUFFIX = '.zohnwheelerportfolio.pages.dev';
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

export function portfolioHostList(envValue) {
  const extra = String(envValue ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...DEFAULT_HOSTS, ...extra];
}

export function isPortfolioHost(host, list) {
  return list.includes(host) || host.endsWith(PREVIEW_SUFFIX);
}

export function parsePage(path) {
  const p = String(path ?? '').replace(/\/+$/, '') || '/';
  if (p === '/') return { type: 'home' };
  if (p === '/contact') return { type: 'contact' };
  let m = p.match(new RegExp(`^/services/(${SLUG})$`));
  if (m) return { type: 'service', slug: m[1] };
  m = p.match(new RegExp(`^/areas/(${SLUG})$`));
  if (m) return { type: 'area', slug: m[1] };
  return null;
}

function themeOverrides(sp) {
  const out = {};
  if (sp.get('theme')) out.preset = sp.get('theme');
  if (sp.get('accent')) out.accent = sp.get('accent');
  if (sp.get('mode')) out.mode = sp.get('mode');
  return out;
}

const DEMO = new RegExp(`^/demo/(${SLUG})(/.*)?$`);

export function routeRequest({ host, path, searchParams, portfolioHosts }) {
  const h = String(host ?? '').toLowerCase().replace(/:\d+$/, '');
  if (path.startsWith('/api/') || path.startsWith('/sk/')) return { kind: 'static' };

  if (isPortfolioHost(h, portfolioHosts)) {
    if (!/^\/demo(\/|$)/.test(path)) return { kind: 'static' };
    if (path === '/demo/presenter' || path === '/demo/presenter/') {
      return searchParams.has('key') ? { kind: 'presenter-login', key: searchParams.get('key') } : { kind: 'presenter-home' };
    }
    const m = path.match(DEMO);
    const page = m && parsePage(m[2] || '/');
    if (!page) return { kind: 'not-found' };
    return { kind: 'demo', slug: m[1], page, token: searchParams.get('t') || '', overrides: themeOverrides(searchParams) };
  }

  const domain = h.replace(/^www\./, '');
  if (path === '/sitemap.xml') return { kind: 'live', domain, page: { type: 'sitemap' } };
  if (path === '/robots.txt') return { kind: 'live', domain, page: { type: 'robots' } };
  const page = parsePage(path);
  return page ? { kind: 'live', domain, page } : { kind: 'not-found' };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/route.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add sitekit/route.mjs test/route.test.mjs
git commit -m "Add sitekit host/path router" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Presenter auth, device detection, lead parsing

**Files:**
- Create: `sitekit/presenter.mjs`, `sitekit/lead.mjs`
- Test: `test/presenter.test.mjs`, `test/lead.test.mjs`

**Interfaces:**
- Produces (`presenter.mjs`):
  - `PRESENTER_COOKIE = 'sk_presenter'`
  - `safeEqual(a, b): boolean` (constant-time for equal lengths; empty strings never match)
  - `readCookie(header, name): string|null`
  - `presenterCookieValue(adminToken): Promise<string>` (64-char hex HMAC-SHA256 of `sitekit-presenter`)
  - `isPresenter(cookieHeader, adminToken): Promise<boolean>`
  - `deviceFromUA(ua): 'mobile'|'tablet'|'desktop'`
- Produces (`lead.mjs`): `parseLead(body)` → `{ ok: false, error }` | `{ ok: true, spam: true }` | `{ ok: true, lead: { slug, token, name, phone, email, message } }`

- [ ] **Step 1: Write the failing tests**

`test/presenter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESENTER_COOKIE, safeEqual, readCookie, presenterCookieValue, isPresenter, deviceFromUA } from '../sitekit/presenter.mjs';

test('presenterCookieValue is a deterministic 64-char hex HMAC', async () => {
  const a = await presenterCookieValue('secret');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await presenterCookieValue('secret'));
  assert.notEqual(a, await presenterCookieValue('other'));
});

test('isPresenter accepts only the matching cookie', async () => {
  const v = await presenterCookieValue('secret');
  assert.equal(await isPresenter(`foo=1; ${PRESENTER_COOKIE}=${v}`, 'secret'), true);
  assert.equal(await isPresenter(`${PRESENTER_COOKIE}=${v}`, 'different'), false);
  assert.equal(await isPresenter(`${PRESENTER_COOKIE}=nope`, 'secret'), false);
  assert.equal(await isPresenter(null, 'secret'), false);
  assert.equal(await isPresenter(`${PRESENTER_COOKIE}=${v}`, undefined), false);
});

test('readCookie finds values by exact name', () => {
  assert.equal(readCookie('a=1; b=2=3', 'b'), '2=3');
  assert.equal(readCookie('ab=1', 'a'), null);
  assert.equal(readCookie(undefined, 'a'), null);
});

test('safeEqual compares strings and never matches empty', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), false);
});

test('deviceFromUA buckets user agents', () => {
  assert.equal(deviceFromUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'), 'mobile');
  assert.equal(deviceFromUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36'), 'mobile');
  assert.equal(deviceFromUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
  assert.equal(deviceFromUA('Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36'), 'tablet');
  assert.equal(deviceFromUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
  assert.equal(deviceFromUA(null), 'desktop');
});
```

`test/lead.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLead } from '../sitekit/lead.mjs';

test('valid lead with phone only', () => {
  assert.deepEqual(parseLead({ slug: 'acme', name: ' Pat ', phone: '816-555-0101' }), {
    ok: true, lead: { slug: 'acme', token: '', name: 'Pat', phone: '816-555-0101', email: '', message: '' },
  });
});

test('honeypot short-circuits as spam', () => {
  assert.deepEqual(parseLead({ slug: 'acme', name: 'x', website: 'http://spam' }), { ok: true, spam: true });
});

test('rejects missing body, slug, name, or contact method', () => {
  assert.equal(parseLead(null).ok, false);
  assert.equal(parseLead({ name: 'Pat', phone: '1' }).error, 'Invalid request.');
  assert.equal(parseLead({ slug: 'acme', phone: '1' }).error, 'Please include your name.');
  assert.equal(parseLead({ slug: 'acme', name: 'Pat' }).error, 'Please include a phone number or email so we can reach you.');
});

test('rejects malformed email', () => {
  assert.equal(parseLead({ slug: 'acme', name: 'Pat', email: 'nope' }).error, 'That doesn’t look like a valid email address.');
});

test('truncates long fields and carries the demo token', () => {
  const r = parseLead({ slug: 'acme', t: 'tok', name: 'x'.repeat(500), email: 'a@b.co', message: 'm'.repeat(6000) });
  assert.equal(r.lead.name.length, 200);
  assert.equal(r.lead.message.length, 5000);
  assert.equal(r.lead.token, 'tok');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/presenter.test.mjs test/lead.test.mjs`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement presenter helpers**

`sitekit/presenter.mjs`:

```js
// Presenter mode = Zohn's own tablet during a sales visit. The cookie value is
// an HMAC of a fixed string keyed with ADMIN_TOKEN, so it can be verified
// without storing sessions, and rotating ADMIN_TOKEN logs every device out.

export const PRESENTER_COOKIE = 'sk_presenter';
const enc = new TextEncoder();

export function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (!x || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export async function presenterCookieValue(adminToken) {
  const key = await crypto.subtle.importKey('raw', enc.encode(adminToken), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('sitekit-presenter'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isPresenter(cookieHeader, adminToken) {
  if (!adminToken) return false;
  const value = readCookie(cookieHeader, PRESENTER_COOKIE);
  if (!value) return false;
  return safeEqual(value, await presenterCookieValue(adminToken));
}

export function deviceFromUA(ua) {
  const s = String(ua ?? '');
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(s)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(s)) return 'mobile';
  return 'desktop';
}
```

- [ ] **Step 4: Implement lead parsing**

`sitekit/lead.mjs`:

```js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

export function parseLead(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  // Honeypot — bots fill every field, real visitors never see this one.
  if (body.website) return { ok: true, spam: true };
  const lead = {
    slug: clip(body.slug, 80),
    token: clip(body.t, 100),
    name: clip(body.name, 200),
    phone: clip(body.phone, 40),
    email: clip(body.email, 200),
    message: clip(body.message, 5000),
  };
  if (!lead.slug) return { ok: false, error: 'Invalid request.' };
  if (!lead.name) return { ok: false, error: 'Please include your name.' };
  if (!lead.phone && !lead.email) return { ok: false, error: 'Please include a phone number or email so we can reach you.' };
  if (lead.email && !EMAIL_RE.test(lead.email)) return { ok: false, error: 'That doesn’t look like a valid email address.' };
  return { ok: true, lead };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test test/presenter.test.mjs test/lead.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add sitekit/presenter.mjs sitekit/lead.mjs test/presenter.test.mjs test/lead.test.mjs
git commit -m "Add presenter cookie auth, device detection, and lead parsing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Template A home page and renderer core

**Files:**
- Create: `sitekit/templates/call-now/styles.mjs`, `sitekit/templates/call-now/sections.mjs`, `sitekit/templates/call-now/schema.mjs`, `sitekit/templates/call-now/layout.mjs`, `sitekit/templates/call-now/pages.mjs`, `sitekit/presenter-panel.mjs`, `sitekit/render.mjs`
- Test: `test/render-home.test.mjs`

**Interfaces:**
- Consumes: `esc`, `md` (T2); `THEMES`, `ACCENT_SWATCHES`, `isHex`, `resolveTheme`, `themeCss`, `themeVars` (T3); `icon` (T3); `resolveContent`, `imgAttrs` (T4).
- Produces:
  - `makeCtx({ content, slug, mode, token='', origin='', overrides={}, presenter=false, year })` → `ctx = { c, slug, mode, token, origin, theme, presenter, year, href(path='/', hash='') }`. `mode` is `'demo'|'live'|'export'`. `href` returns an **already-escaped** URL: in demo mode it's `/demo/<slug><path>?t=…[&theme=…]`, otherwise the plain path.
  - `renderPage({ content, slug, page, mode, token?, origin?, overrides?, presenter?, year? }): string|null` (null = unknown page)
  - `PAGES: { home }` here; Task 9 adds `service`, `area`, `contact`. Each page fn is `(ctx, page) → { path, title, description, body, ld?, scripts? } | null`.
  - From `sections.mjs`: `tel(phone)`, `band(id, alt, inner)`, `head(eyebrow, title, intro?)`, `ctaButtons(ctx)`, `serviceCard(ctx, s)`, `areaChips(ctx)`, `reviews(ctx, alt)`, `areas(ctx, alt)`, `cta(ctx)`, `SECTIONS`, `BANDS`.
  - From `schema.mjs`: `businessLd(ctx)`, `faqLd(items)`, `serviceLd(ctx, s)`, `ldScripts(objects)`.

- [ ] **Step 1: Write the failing tests**

`test/render-home.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPage, makeCtx } from '../sitekit/render.mjs';

const fixture = () => JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json', 'utf8'));
const home = (over = {}) =>
  renderPage({ content: fixture(), slug: 'acme-roofing', page: { type: 'home' }, mode: 'live', origin: 'https://acme.example', year: 2026, ...over });

const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('home renders the core conversion elements', () => {
  const html = home();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Acme Roofing \| Roofing in Lee&#39;s Summit<\/title>/);
  assert.match(html, /href="tel:\+18165550100"/);
  assert.match(html, /Get a Free Estimate/);
  assert.match(html, /id="services"/);
  assert.match(html, /id="reviews"/);
  assert.match(html, /id="areas"/);
  assert.match(html, /id="faq"/);
  assert.match(html, /22\+ years in business/);
  assert.match(html, /4\.8 stars on Google \(112 reviews\)/);
  assert.match(html, /Hail damage\? Free 24\/7 storm inspections\./);
  assert.match(html, /class="callbar"/);
});

test('home JSON-LD parses and describes the business and FAQ', () => {
  const blocks = ldBlocks(home());
  assert.equal(blocks[0]['@type'], 'RoofingContractor');
  assert.equal(blocks[0].name, 'Acme Roofing');
  assert.equal(blocks[0].url, 'https://acme.example/');
  assert.deepEqual(blocks[0].areaServed, ["Lee's Summit", 'Blue Springs']);
  assert.equal(blocks[1]['@type'], 'FAQPage');
});

test('live mode has canonical and no demo ribbon or noindex', () => {
  const html = home();
  assert.match(html, /<link rel="canonical" href="https:\/\/acme\.example\/">/);
  assert.doesNotMatch(html, /Preview built for/);
  assert.doesNotMatch(html, /noindex/);
});

test('demo mode has ribbon, noindex, token links, and no canonical', () => {
  const html = home({ mode: 'demo', token: 'tok123' });
  assert.match(html, /Preview built for Acme Roofing/);
  assert.match(html, /href="\/hire\.html#contact-form"/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /href="\/demo\/acme-roofing\/services\/roof-replacement\?t=tok123"/);
  assert.match(html, /href="\/demo\/acme-roofing\/contact\?t=tok123"/);
  assert.doesNotMatch(html, /rel="canonical"/);
});

test('theme overrides apply in demo mode only and propagate to links', () => {
  const overrides = { preset: 'bold', accent: '#123456', mode: 'dark' };
  const demo = home({ mode: 'demo', token: 't', overrides });
  assert.match(demo, /--accent:#123456/);
  assert.match(demo, /href="\/demo\/acme-roofing\/contact\?t=t&amp;theme=bold&amp;accent=%23123456&amp;mode=dark"/);
  assert.doesNotMatch(home({ overrides }), /--accent:#123456/);
});

test('empty optional sections are omitted', () => {
  const c = fixture();
  c.reviews = [];
  c.areas = [];
  c.trust = [];
  delete c.business.founded;
  delete c.business.rating;
  delete c.business.license;
  c.banner = { enabled: false };
  const html = renderPage({ content: c, slug: 'x', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.doesNotMatch(html, /id="reviews"/);
  assert.doesNotMatch(html, /id="areas"/);
  assert.doesNotMatch(html, /class="trust"/);
  assert.doesNotMatch(html, /class="banner"/);
  assert.doesNotMatch(html, />Service Areas</);
});

test('content is escaped everywhere', () => {
  const c = fixture();
  c.business.name = '<script>alert(1)</script>';
  c.reviews[0].text = '<img src=x onerror=alert(1)>';
  const html = renderPage({ content: c, slug: 'x', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('presenter panel only renders for presenters', () => {
  assert.doesNotMatch(home({ mode: 'demo', token: 't' }), /sk-panel/);
  const html = home({ mode: 'demo', token: 't', presenter: true });
  assert.match(html, /class="sk-panel"/);
  assert.match(html, /Save this look/);
});

test('unknown page type returns null', () => {
  assert.equal(renderPage({ content: fixture(), slug: 'x', page: { type: 'nope' }, mode: 'live' }), null);
});

test('makeCtx.href builds demo and live URLs', () => {
  const demo = makeCtx({ content: fixture(), slug: 'acme-roofing', mode: 'demo', token: 'tok' });
  assert.equal(demo.href('/'), '/demo/acme-roofing?t=tok');
  assert.equal(demo.href('/', '#faq'), '/demo/acme-roofing?t=tok#faq');
  const live = makeCtx({ content: fixture(), slug: 'acme-roofing', mode: 'live' });
  assert.equal(live.href('/contact'), '/contact');
  const presenterNoToken = makeCtx({ content: fixture(), slug: 'acme-roofing', mode: 'demo' });
  assert.equal(presenterNoToken.href('/contact'), '/demo/acme-roofing/contact');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/render-home.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Styles**

`sitekit/templates/call-now/styles.mjs`:

```js
// Template A stylesheet. Colors come only from theme tokens (themes.mjs), so
// every preset/accent/mode combination works without touching this file.
// Accent is used for fills and decoration, never as small text on bg, to keep
// contrast at WCAG AA for any accent choice.
export const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;font-size:17px}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,h3{line-height:1.15;letter-spacing:-.015em}
.wrap{width:min(1120px,100% - 32px);margin-inline:auto}
.icon{width:1.25em;height:1.25em;flex:none}
.skip{position:absolute;left:-9999px}
.skip:focus{left:1rem;top:1rem;z-index:100;background:var(--bg);color:var(--text);padding:.5rem 1rem;border-radius:8px}
.btn{display:inline-flex;align-items:center;gap:.5em;padding:.85em 1.4em;border-radius:10px;font-weight:700;text-decoration:none;border:2px solid transparent;cursor:pointer;font-size:1rem;line-height:1.2;font-family:inherit}
.btn-accent{background:var(--accent);color:var(--onAccent)}
.btn-ghost{border-color:currentColor;color:inherit;background:transparent}
.btn:hover{filter:brightness(1.08)}
.btn:disabled{opacity:.6;cursor:wait}
a:focus-visible,.btn:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.ribbon{background:#111;color:#fff;font-size:.85rem;text-align:center;padding:.5em 1em}
.ribbon a{color:#fff;font-weight:700;margin-left:.75em}
.banner{background:var(--accent);color:var(--onAccent);text-align:center;font-weight:700;padding:.6em 1em}
.banner a{color:inherit;margin-left:.5em}
.site-header{background:var(--primary);color:var(--onPrimary);position:sticky;top:0;z-index:20}
.site-header .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:68px;position:relative}
.brand{font-weight:800;font-size:1.2rem;text-decoration:none;letter-spacing:-.01em}
.nav{display:flex;align-items:center;gap:1.5rem}
.nav a:not(.btn){text-decoration:none;font-weight:600;opacity:.9}
.nav a:not(.btn):hover{opacity:1}
.menu{display:none}
.menu summary{list-style:none;cursor:pointer;padding:.4rem;display:flex}
.menu summary::-webkit-details-marker{display:none}
.menu summary .icon{width:1.6rem;height:1.6rem}
.menu nav{position:absolute;right:0;top:100%;background:var(--primary);padding:1rem 1.25rem;border-radius:0 0 12px 12px;display:flex;flex-direction:column;gap:.9rem;min-width:220px;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.menu nav a{text-decoration:none;font-weight:600}
.hero{position:relative;color:#fff;background:var(--primary);overflow:hidden}
.hero-media{position:absolute;inset:0}
.hero-media img{width:100%;height:100%;object-fit:cover}
.hero-media::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(0,0,0,.8) 0%,rgba(0,0,0,.58) 55%,rgba(0,0,0,.3) 100%)}
.hero .wrap{position:relative;padding:clamp(4rem,10vw,7.5rem) 0}
.hero h1{font-size:clamp(2.1rem,5vw,3.6rem);line-height:1.06;margin:0 0 1rem;max-width:18ch}
.hero p{font-size:clamp(1.05rem,2vw,1.3rem);max-width:46ch;margin:0 0 2rem;opacity:.92}
.hero-ctas{display:flex;flex-wrap:wrap;gap:.75rem}
.eyebrow{display:inline-flex;align-items:center;gap:.5em;text-transform:uppercase;font-size:.8rem;font-weight:800;letter-spacing:.08em;color:var(--muted);margin-bottom:.75rem}
.eyebrow::before{content:"";width:.6em;height:.6em;border-radius:50%;background:var(--accent)}
.hero .eyebrow{color:#fff}
.trust{background:var(--surface);border-bottom:1px solid var(--border)}
.trust ul{list-style:none;margin:0;padding:1.1rem 0;display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem 2rem}
.trust li{display:flex;align-items:center;gap:.5em;font-weight:700}
.trust .icon{color:var(--accent)}
.section{padding:clamp(3.5rem,8vw,6rem) 0}
.section.alt{background:var(--surface)}
.section-head{max-width:640px;margin:0 0 2.5rem}
.section-head h2{font-size:clamp(1.7rem,3.5vw,2.4rem);margin:0 0 .6rem}
.section-head p{color:var(--muted);margin:0}
.sub-h{font-size:1.2rem;margin:2.5rem 0 1rem}
.grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
.section.alt .card{background:var(--bg)}
a.card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(0,0,0,.14)}
.card-media{aspect-ratio:16/10;background:var(--border)}
.card-media img{width:100%;height:100%;object-fit:cover}
.card-body{padding:1.25rem 1.25rem 1.5rem;display:flex;flex-direction:column;gap:.5rem;flex:1}
.card h3{margin:0;font-size:1.2rem;display:flex;align-items:center;gap:.5em}
.card h3 .icon{color:var(--accent)}
.card p{margin:0;color:var(--muted)}
.more{margin-top:auto;padding-top:.5rem;font-weight:700;text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:4px}
.features{display:grid;gap:1.75rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.feature-icon{width:2.6rem;height:2.6rem;padding:.6rem;border-radius:12px;background:var(--accent);color:var(--onAccent);margin-bottom:.9rem}
.feature h3{margin:0 0 .35rem;font-size:1.1rem}
.feature p{margin:0;color:var(--muted)}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:4px;border-radius:14px;overflow:hidden}
.ba figure{margin:0;position:relative;aspect-ratio:4/3}
.ba img{width:100%;height:100%;object-fit:cover}
.ba figcaption{position:absolute;left:.6rem;top:.6rem;background:rgba(0,0,0,.72);color:#fff;font-size:.75rem;font-weight:800;text-transform:uppercase;padding:.2em .6em;border-radius:6px}
.gallery-item p{margin:.6rem 0 0;color:var(--muted);font-size:.95rem}
.reviews{columns:3 280px;column-gap:1.25rem}
.review{break-inside:avoid;margin:0 0 1.25rem;background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:1.4rem}
.section:not(.alt) .review{background:var(--surface)}
.stars{color:#f5a623;display:flex;gap:2px}
.stars .icon{fill:currentColor;width:1.1em;height:1.1em}
.review blockquote{margin:.7rem 0 .9rem}
.review figcaption{font-weight:700;font-size:.95rem}
.review figcaption span{color:var(--muted);font-weight:500}
.chips{display:flex;flex-wrap:wrap;gap:.6rem;list-style:none;padding:0;margin:0}
.chips a{display:inline-flex;align-items:center;gap:.4em;padding:.55em 1em;border:1px solid var(--border);border-radius:999px;text-decoration:none;font-weight:600;background:var(--bg)}
.chips a:hover{border-color:var(--accent)}
.chips .icon{color:var(--accent)}
.financing{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1.5rem;background:var(--primary);color:var(--onPrimary);border-radius:18px;padding:clamp(1.75rem,4vw,2.75rem)}
.financing h2{margin:0 0 .4rem}
.financing .prose p{margin:0}
.faq{max-width:780px}
.faq details{border-bottom:1px solid var(--border);padding:1.1rem 0}
.faq summary{font-weight:700;cursor:pointer;font-size:1.08rem;list-style:none;display:flex;justify-content:space-between;gap:1rem}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-size:1.4rem;line-height:1}
.faq details[open] summary::after{content:"–"}
.faq .answer{color:var(--muted);padding-top:.6rem}
.faq .answer p{margin:0 0 .6rem}
.cta-band{background:var(--primary);color:var(--onPrimary);text-align:center}
.cta-band h2{font-size:clamp(1.8rem,4vw,2.6rem);margin:0 0 .6rem}
.cta-band p{opacity:.88;margin:0 auto 1.75rem;max-width:52ch}
.cta-band .hero-ctas{justify-content:center}
.page-hero{background:var(--primary);color:var(--onPrimary);padding:clamp(3rem,7vw,4.5rem) 0}
.page-hero h1{margin:0 0 .5rem;font-size:clamp(1.9rem,4.5vw,3rem)}
.page-hero p{margin:0;opacity:.88;max-width:60ch;font-size:1.1rem}
.crumbs{font-size:.85rem;opacity:.8;margin-bottom:.9rem}
.crumbs a{text-decoration:none}
.crumbs a:hover{text-decoration:underline}
.split{display:grid;gap:2.5rem;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:start}
.prose{max-width:68ch}
.prose p{margin:0 0 1.1rem}
.prose ul{padding-left:1.2rem;margin:0 0 1.1rem}
.prose li{margin-bottom:.35rem}
.prose a{text-decoration-color:var(--accent)}
.aside-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;position:sticky;top:90px}
.aside-card h2{font-size:1.25rem;margin:0 0 .5rem}
.aside-card p{color:var(--muted);margin:0 0 .75rem}
.aside-card .btn{width:100%;justify-content:center;margin-top:.75rem}
.rounded{border-radius:14px;overflow:hidden;margin-bottom:1.75rem;aspect-ratio:16/9;background:var(--border)}
.rounded img{width:100%;height:100%;object-fit:cover}
.form{display:grid;gap:1rem}
.form label{display:grid;gap:.35rem;font-weight:600;font-size:.95rem}
.form input,.form textarea{font:inherit;padding:.8em .9em;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
.form textarea{min-height:130px;resize:vertical}
.form .hp{position:absolute;left:-9999px}
.form button{justify-self:start}
.form-status{font-weight:700;min-height:1.5em;margin:0}
.info-list{list-style:none;padding:0;margin:0;display:grid;gap:1rem}
.info-list li{display:flex;gap:.75rem}
.info-list .icon{color:var(--accent);margin-top:.2em}
.site-footer{background:var(--primary);color:var(--onPrimary);padding:3.5rem 0 2rem;font-size:.95rem}
.footer-grid{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.site-footer h2{font-size:.95rem;margin:0 0 .75rem;text-transform:uppercase;letter-spacing:.06em;opacity:.85}
.site-footer ul{list-style:none;padding:0;margin:0;display:grid;gap:.4rem}
.site-footer a{text-decoration:none}
.site-footer a:hover{text-decoration:underline}
.legal{margin:2.5rem 0 0;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.18);opacity:.8;font-size:.85rem}
.callbar{display:none}
@media (max-width:860px){
  .nav{display:none}
  .menu{display:block}
  .split{grid-template-columns:1fr}
  .aside-card{position:static}
  .site-footer{padding-bottom:6rem}
  .callbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;box-shadow:0 -6px 20px rgba(0,0,0,.18)}
  .callbar a{flex:1;display:flex;align-items:center;justify-content:center;gap:.5em;padding:1rem;font-weight:800;text-decoration:none}
  .callbar .call{background:var(--accent);color:var(--onAccent)}
  .callbar .quote{background:var(--primary);color:var(--onPrimary)}
}
`;
```

- [ ] **Step 4: Sections**

`sitekit/templates/call-now/sections.mjs`:

```js
import { esc, md } from '../../escape.mjs';
import { icon } from '../../icons.mjs';
import { imgAttrs } from '../../content.mjs';

export function tel(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return `tel:+1${digits}`;
}

export function head(eyebrow, title, intro) {
  return `<div class="section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}</div>`;
}

export function band(id, alt, inner) {
  return `<section class="section${alt ? ' alt' : ''}"${id ? ` id="${id}"` : ''}><div class="wrap">${inner}</div></section>`;
}

export function ctaButtons(ctx) {
  const { business, hero } = ctx.c;
  return `<div class="hero-ctas"><a class="btn btn-accent" href="${tel(business.phone)}">${icon('phone')}Call ${esc(business.phone)}</a><a class="btn btn-ghost" href="${ctx.href('/contact')}">${esc(hero.cta || 'Get a Free Estimate')}</a></div>`;
}

export function hero(ctx) {
  const { c } = ctx;
  const img = imgAttrs(c.hero.image, ctx.slug, '100vw');
  const where = c.business.city ? `Serving ${c.business.city} & nearby` : 'Serving the Kansas City metro';
  const eyebrow = `${c.business.emergency ? '24/7 emergency service' : c.trade} · ${where}`;
  return `<section class="hero">${img ? `<div class="hero-media"><img ${img} alt="" fetchpriority="high" decoding="async"></div>` : ''}<div class="wrap"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(c.hero.headline)}</h1>${c.hero.sub ? `<p>${esc(c.hero.sub)}</p>` : ''}${ctaButtons(ctx)}</div></section>`;
}

export function trust(ctx) {
  const { business: b, trust: badges } = ctx.c;
  const items = [];
  const years = ctx.year - Number(b.founded);
  if (b.founded && years >= 2) items.push(['clock', `${years}+ years in business`]);
  if (b.rating && b.reviewCount) items.push(['star', `${Number(b.rating).toFixed(1)} stars on Google (${b.reviewCount} reviews)`]);
  if (b.license) items.push(['shield', `Licensed · ${b.license}`]);
  for (const t of badges) items.push(['check', t]);
  if (!items.length) return '';
  return `<section class="trust" aria-label="Credentials"><div class="wrap"><ul>${items.map(([i, t]) => `<li>${icon(i)}${esc(t)}</li>`).join('')}</ul></div></section>`;
}

export function serviceCard(ctx, s) {
  const img = imgAttrs(s.image, ctx.slug, '(max-width: 860px) 100vw, 360px');
  return `<a class="card" href="${ctx.href(`/services/${s.slug}`)}">${img ? `<div class="card-media"><img ${img} alt="" loading="lazy" decoding="async"></div>` : ''}<div class="card-body"><h3>${icon(s.icon)}${esc(s.name)}</h3>${s.summary ? `<p>${esc(s.summary)}</p>` : ''}<span class="more">Learn more</span></div></a>`;
}

export function services(ctx, alt) {
  const { c } = ctx;
  if (!c.services.length) return '';
  return band('services', alt, `${head('What we do', `${c.trade} services`, c.copy.servicesIntro)}<div class="grid">${c.services.map((s) => serviceCard(ctx, s)).join('')}</div>`);
}

export function whyUs(ctx, alt) {
  const { c } = ctx;
  if (!c.whyUs.length) return '';
  const items = c.whyUs.map((w) => `<div class="feature">${icon(w.icon, 'icon feature-icon')}<h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join('');
  return band('why-us', alt, `${head('Why choose us', c.copy.whyUsTitle || `Why ${c.business.name}`)}<div class="features">${items}</div>`);
}

export function gallery(ctx, alt) {
  const items = ctx.c.gallery
    .map((g) => {
      const sizes = '(max-width: 860px) 50vw, 280px';
      const before = imgAttrs(g.before, ctx.slug, sizes);
      const after = imgAttrs(g.after, ctx.slug, sizes);
      if (!before || !after) return '';
      return `<div class="gallery-item"><div class="ba"><figure><img ${before} alt="Before" loading="lazy" decoding="async"><figcaption>Before</figcaption></figure><figure><img ${after} alt="After" loading="lazy" decoding="async"><figcaption>After</figcaption></figure></div>${g.caption ? `<p>${esc(g.caption)}</p>` : ''}</div>`;
    })
    .join('');
  if (!items) return '';
  return band('work', alt, `${head('Our work', 'Before & after')}<div class="grid">${items}</div>`);
}

function stars(n) {
  const count = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return `<div class="stars" role="img" aria-label="${count} out of 5 stars">${icon('star').repeat(count)}</div>`;
}

export function reviews(ctx, alt) {
  const { c } = ctx;
  if (!c.reviews.length) return '';
  const b = c.business;
  const intro = b.rating && b.reviewCount ? `Rated ${Number(b.rating).toFixed(1)} out of 5 across ${b.reviewCount} Google reviews.` : '';
  const items = c.reviews
    .map((r) => `<figure class="review">${stars(r.rating)}<blockquote>${esc(r.text)}</blockquote><figcaption>${esc(r.name)}${r.source ? ` <span>· ${esc(r.source)}</span>` : ''}</figcaption></figure>`)
    .join('');
  return band('reviews', alt, `${head('Reviews', 'What customers say', intro)}<div class="reviews">${items}</div>`);
}

export function areaChips(ctx) {
  return `<ul class="chips">${ctx.c.areas.map((a) => `<li><a href="${ctx.href(`/areas/${a.slug}`)}">${icon('pin')}${esc(a.name)}</a></li>`).join('')}</ul>`;
}

export function areas(ctx, alt) {
  if (!ctx.c.areas.length) return '';
  return band('areas', alt, `${head('Service area', 'Where we work', ctx.c.copy.areasIntro)}${areaChips(ctx)}`);
}

export function financing(ctx, alt) {
  const f = ctx.c.financing;
  if (!f.enabled || !f.text) return '';
  return band('', alt, `<div class="financing"><div><h2>${esc(f.title || 'Financing available')}</h2><div class="prose">${md(f.text)}</div></div><a class="btn btn-accent" href="${ctx.href('/contact')}">Ask about financing</a></div>`);
}

export function faq(ctx, alt) {
  const items = ctx.c.faq;
  if (!items.length) return '';
  const list = items.map((f) => `<details><summary>${esc(f.q)}</summary><div class="answer">${md(f.a)}</div></details>`).join('');
  return band('faq', alt, `${head('FAQ', 'Common questions')}<div class="faq">${list}</div>`);
}

export function cta(ctx) {
  const { copy } = ctx.c;
  return `<section class="cta-band section"><div class="wrap"><h2>${esc(copy.ctaTitle || 'Ready to get started?')}</h2>${copy.ctaText ? `<p>${esc(copy.ctaText)}</p>` : ''}${ctaButtons(ctx)}</div></section>`;
}

export const SECTIONS = { hero, trust, services, whyUs, gallery, reviews, areas, financing, faq, cta };
// Bands alternate background; hero/trust/cta have their own.
export const BANDS = new Set(['services', 'whyUs', 'gallery', 'reviews', 'areas', 'financing', 'faq']);
```

- [ ] **Step 5: Structured data**

`sitekit/templates/call-now/schema.mjs`:

```js
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const areaNames = (ctx) => (ctx.c.areas.length ? ctx.c.areas.map((a) => a.name) : undefined);

export function businessLd(ctx) {
  const { c } = ctx;
  const b = c.business;
  return strip({
    '@context': 'https://schema.org',
    '@type': c.schemaType,
    name: b.name,
    telephone: b.phone,
    email: b.email,
    address: b.address,
    url: ctx.mode !== 'demo' && ctx.origin ? `${ctx.origin}/` : undefined,
    foundingDate: b.founded ? String(b.founded) : undefined,
    areaServed: areaNames(ctx),
  });
}

export function faqLd(items) {
  if (!items.length) return [];
  return [{
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }];
}

export function serviceLd(ctx, s) {
  const b = ctx.c.business;
  return [strip({
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: s.name,
    description: s.summary,
    provider: strip({ '@type': ctx.c.schemaType, name: b.name, telephone: b.phone }),
    areaServed: areaNames(ctx),
  })];
}

// "<" is escaped so content can never close the script tag.
export function ldScripts(objects) {
  return objects.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
}
```

- [ ] **Step 6: Presenter panel**

`sitekit/presenter-panel.mjs`:

```js
import { esc } from './escape.mjs';
import { THEMES, ACCENT_SWATCHES } from './themes.mjs';

export const PRESENTER_CSS = `.sk-panel{position:fixed;right:16px;bottom:16px;z-index:50;background:#111;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 10px 40px rgba(0,0,0,.35);font:14px/1.4 system-ui,sans-serif;width:250px}.sk-panel summary{cursor:pointer;font-weight:700}.sk-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.sk-row button,.sk-save{font:inherit;border:1px solid #444;background:#222;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}.sk-row button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 1px #fff}.sk-swatch{width:30px;height:30px;padding:0!important;border-radius:50%!important}.sk-save{width:100%;margin-top:12px;background:#fff;color:#111;font-weight:700}.sk-msg{margin-top:6px;min-height:1.2em}@media (max-width:860px){.sk-panel{bottom:76px}}`;

// Buttons reload the page with ?theme/&accent/&mode so the server renders the
// look (and ctx.href carries it to other pages). "Save" writes it to D1.
export function presenterPanel(ctx) {
  const t = ctx.theme;
  const presets = Object.entries(THEMES)
    .map(([k, v]) => `<button type="button" data-k="theme" data-v="${k}" aria-pressed="${t.preset === k}">${esc(v.label)}</button>`)
    .join('');
  const swatches = ACCENT_SWATCHES
    .map((h) => `<button type="button" class="sk-swatch" data-k="accent" data-v="${h}" style="background:${h}" aria-label="Accent ${h}" aria-pressed="${t.accent === h}"></button>`)
    .join('');
  const modes = ['light', 'dark']
    .map((m) => `<button type="button" data-k="mode" data-v="${m}" aria-pressed="${t.mode === m}">${m === 'light' ? 'Light' : 'Dark'}</button>`)
    .join('');
  const state = JSON.stringify({ slug: ctx.slug, theme: { preset: t.preset, accent: t.accent || undefined, mode: t.mode } }).replace(/</g, '\\u003c');
  return `<details class="sk-panel" open><summary>Presenter</summary><div class="sk-row">${presets}</div><div class="sk-row">${swatches}</div><div class="sk-row">${modes}</div><button type="button" class="sk-save" id="sk-save">Save this look</button><div class="sk-msg" id="sk-msg" role="status"></div></details>
<script>
(function(){var s=${state};
document.querySelectorAll('.sk-panel [data-k]').forEach(function(b){b.addEventListener('click',function(){var u=new URL(location.href);u.searchParams.set(b.dataset.k,b.dataset.v);location.href=u.toString();});});
document.getElementById('sk-save').addEventListener('click',function(){var m=document.getElementById('sk-msg');m.textContent='Saving…';fetch('/api/demo-theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)}).then(function(r){m.textContent=r.ok?'Saved ✓':'Save failed';}).catch(function(){m.textContent='Save failed';});});
})();
</script>`;
}
```

- [ ] **Step 7: Layout**

`sitekit/templates/call-now/layout.mjs`:

```js
import { esc } from '../../escape.mjs';
import { icon } from '../../icons.mjs';
import { themeCss, themeVars } from '../../themes.mjs';
import { presenterPanel, PRESENTER_CSS } from '../../presenter-panel.mjs';
import { CSS } from './styles.mjs';
import { tel } from './sections.mjs';
import { businessLd, ldScripts } from './schema.mjs';

function favicon(ctx) {
  const initial = esc((ctx.c.business.name || '?').trim().charAt(0).toUpperCase());
  const { primary, onPrimary } = themeVars(ctx.theme);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${primary}"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="${onPrimary}" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function navLinks(ctx) {
  const { c } = ctx;
  const links = [[ctx.href('/', '#services'), 'Services']];
  if (c.areas.length) links.push([ctx.href('/', '#areas'), 'Service Areas']);
  if (c.reviews.length) links.push([ctx.href('/', '#reviews'), 'Reviews']);
  links.push([ctx.href('/contact'), 'Contact']);
  return links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('');
}

function header(ctx) {
  const b = ctx.c.business;
  const links = navLinks(ctx);
  return `<header class="site-header"><div class="wrap"><a class="brand" href="${ctx.href('/')}">${esc(b.name)}</a><nav class="nav" aria-label="Main">${links}<a class="btn btn-accent header-call" href="${tel(b.phone)}">${icon('phone')}${esc(b.phone)}</a></nav><details class="menu"><summary aria-label="Menu">${icon('menu')}</summary><nav aria-label="Mobile">${links}</nav></details></div></header>`;
}

function banner(ctx) {
  const bn = ctx.c.banner;
  if (!bn.enabled || !bn.text) return '';
  return `<div class="banner">${esc(bn.text)}<a href="${tel(ctx.c.business.phone)}">Call ${esc(ctx.c.business.phone)}</a></div>`;
}

function ribbon(ctx) {
  return `<div class="ribbon">Preview built for ${esc(ctx.c.business.name)}<a href="/hire.html#contact-form">Make it yours →</a></div>`;
}

function footer(ctx) {
  const { c } = ctx;
  const b = c.business;
  const info = [
    b.address && `<li>${esc(b.address)}</li>`,
    `<li><a href="${tel(b.phone)}">${esc(b.phone)}</a></li>`,
    b.email && `<li><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
    b.hours && `<li>${esc(b.hours)}</li>`,
    b.license && `<li>License ${esc(b.license)}</li>`,
  ].filter(Boolean).join('');
  const svc = c.services.map((s) => `<li><a href="${ctx.href(`/services/${s.slug}`)}">${esc(s.name)}</a></li>`).join('');
  const ar = c.areas.map((a) => `<li><a href="${ctx.href(`/areas/${a.slug}`)}">${esc(a.name)}</a></li>`).join('');
  return `<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div><h2>${esc(b.name)}</h2><ul>${info}</ul></div><div><h2>Services</h2><ul>${svc}</ul></div>${ar ? `<div><h2>Service Areas</h2><ul>${ar}</ul></div>` : ''}</div><p class="legal">© ${ctx.year} ${esc(b.name)}. All rights reserved.</p></div></footer>`;
}

function callbar(ctx) {
  return `<nav class="callbar" aria-label="Quick contact"><a class="call" href="${tel(ctx.c.business.phone)}">${icon('phone')}Call Now</a><a class="quote" href="${ctx.href('/contact')}">${esc(ctx.c.hero.cta || 'Free Estimate')}</a></nav>`;
}

export function layout(ctx, page) {
  const demo = ctx.mode === 'demo';
  const canonical = !demo && ctx.origin ? `<link rel="canonical" href="${esc(ctx.origin + page.path)}">` : '';
  const robots = demo ? '<meta name="robots" content="noindex, nofollow">' : '';
  const ogImage = demo && ctx.origin ? `<meta property="og:image" content="${esc(ctx.origin)}/og-image-hire.png">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${robots}${canonical}
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:type" content="website">
${ogImage}
<meta name="theme-color" content="${themeVars(ctx.theme).primary}">
<link rel="icon" href="${favicon(ctx)}">
<style>${themeCss(ctx.theme)}${CSS}${ctx.presenter ? PRESENTER_CSS : ''}</style>
${ldScripts([businessLd(ctx), ...(page.ld || [])])}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${demo ? ribbon(ctx) : ''}${banner(ctx)}${header(ctx)}
<main id="main">${page.body}</main>
${footer(ctx)}${callbar(ctx)}${page.scripts || ''}${ctx.presenter ? presenterPanel(ctx) : ''}
</body>
</html>
`;
}
```

- [ ] **Step 8: Home page**

`sitekit/templates/call-now/pages.mjs`:

```js
import { SECTIONS, BANDS } from './sections.mjs';
import { faqLd } from './schema.mjs';

export function home(ctx) {
  const { c } = ctx;
  let alt = false;
  const body = c.sectionOrder
    .map((name) => {
      const fn = Object.hasOwn(SECTIONS, name) ? SECTIONS[name] : null;
      if (!fn) return '';
      const html = fn(ctx, alt);
      if (html && BANDS.has(name)) alt = !alt;
      return html;
    })
    .join('');
  const where = c.business.city || 'Kansas City';
  return {
    path: '/',
    title: `${c.business.name} | ${c.trade} in ${where}`,
    description: c.hero.sub || `${c.trade} in ${where}.`,
    body,
    ld: faqLd(c.faq),
  };
}

export const PAGES = { home };
```

- [ ] **Step 9: Renderer**

`sitekit/render.mjs`:

```js
import { resolveContent } from './content.mjs';
import { THEMES, isHex, resolveTheme } from './themes.mjs';
import { esc } from './escape.mjs';
import { layout } from './templates/call-now/layout.mjs';
import { PAGES } from './templates/call-now/pages.mjs';

// Only valid overrides are carried into links, so junk query params don't
// propagate across a demo.
function overrideParams(overrides) {
  const out = [];
  if (Object.hasOwn(THEMES, overrides.preset ?? '')) out.push(['theme', overrides.preset]);
  if (isHex(overrides.accent)) out.push(['accent', overrides.accent]);
  if (overrides.mode === 'light' || overrides.mode === 'dark') out.push(['mode', overrides.mode]);
  return out;
}

export function makeCtx({ content, slug, mode, token = '', origin = '', overrides = {}, presenter = false, year = new Date().getFullYear() }) {
  const c = resolveContent(content);
  const demo = mode === 'demo';
  const theme = resolveTheme(c.theme, demo ? overrides : {});
  const params = new URLSearchParams();
  if (demo && token) params.set('t', token);
  if (demo) for (const [k, v] of overrideParams(overrides)) params.set(k, v);
  const qs = params.toString();
  const href = (path = '/', hash = '') => {
    const p = demo ? `/demo/${slug}${path === '/' ? '' : path}` : path;
    return esc(`${p}${qs ? `?${qs}` : ''}${hash}`);
  };
  return { c, slug, mode, token, origin, theme, presenter, year, href };
}

export function renderPage(opts) {
  const type = opts.page?.type;
  if (!Object.hasOwn(PAGES, type ?? '')) return null;
  const ctx = makeCtx(opts);
  const page = PAGES[type](ctx, opts.page);
  return page ? layout(ctx, page) : null;
}
```

- [ ] **Step 10: Run to verify pass**

Run: `node --test test/render-home.test.mjs`
Expected: PASS, 10 tests. If the years assertion fails, check that `year: 2026` is being passed (2026 − 2004 = 22).

- [ ] **Step 11: Eyeball it**

```bash
node --input-type=module -e "import fs from 'node:fs'; import {renderPage} from './sitekit/render.mjs'; const c=JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json','utf8')); fs.mkdirSync('dist',{recursive:true}); fs.writeFileSync('dist/preview-home.html', renderPage({content:c,slug:'acme-roofing',page:{type:'home'},mode:'demo',token:'t',presenter:true}));"
```

Open `dist/preview-home.html` in a browser. Images will be broken until Task 14; everything else should look finished. Check it at 390px and 1024px widths.

- [ ] **Step 12: Run the full suite and commit**

Run: `npm test` → all PASS.

```bash
git add sitekit/templates sitekit/presenter-panel.mjs sitekit/render.mjs test/render-home.test.mjs
git commit -m "Add Template A home page, layout, structured data, and presenter panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Service, area, and contact pages, plus sitemap, robots, and export mode

**Files:**
- Modify: `sitekit/templates/call-now/pages.mjs` (replace whole file), `sitekit/render.mjs` (append)
- Test: `test/render-pages.test.mjs`

**Interfaces:**
- Consumes: everything from Task 8.
- Produces:
  - `PAGES = { home, service, area, contact }`
  - `listPages(content): Array<{ page, path }>` (home, each service, each area, contact)
  - `renderSitemap({ content, origin }): string`
  - `renderRobots({ origin }): string`
  - Contact form fields `slug`, `t`, `website` (honeypot), `name`, `phone`, `email`, `message`, POSTed as JSON to `/api/lead`. In `mode: 'export'` the form is replaced with call/email buttons and no script.

- [ ] **Step 1: Write the failing tests**

`test/render-pages.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPage, listPages, renderSitemap, renderRobots } from '../sitekit/render.mjs';

const fixture = () => JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json', 'utf8'));
const render = (page, over = {}) =>
  renderPage({ content: fixture(), slug: 'acme-roofing', page, mode: 'live', origin: 'https://acme.example', year: 2026, ...over });
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('service page uses preset copy for preset slugs and custom copy otherwise', () => {
  const preset = render({ type: 'service', slug: 'roof-replacement' });
  assert.match(preset, /<h1>Roof Replacement<\/h1>/);
  assert.match(preset, /magnetic nail sweep/);
  assert.match(preset, /<title>Roof Replacement \| Acme Roofing<\/title>/);
  assert.match(preset, /<link rel="canonical" href="https:\/\/acme\.example\/services\/roof-replacement">/);
  const custom = render({ type: 'service', slug: 'skylights' });
  assert.match(custom, /We install <strong>new<\/strong> skylights/);
  assert.match(custom, /Other services/);
  assert.equal(ldBlocks(custom)[1]['@type'], 'Service');
});

test('unknown service or area returns null', () => {
  assert.equal(render({ type: 'service', slug: 'nope' }), null);
  assert.equal(render({ type: 'area', slug: 'nope' }), null);
});

test('area page has a city-specific title, intro, and service grid', () => {
  const html = render({ type: 'area', slug: 'blue-springs' });
  assert.match(html, /<h1>Roofing in Blue Springs<\/h1>/);
  assert.match(html, /1970s ranch homes/);
  assert.match(html, /Our services in Blue Springs/);
  assert.match(html, /href="\/services\/skylights"/);
});

test('contact page has a working lead form in live and demo modes', () => {
  const live = render({ type: 'contact' });
  assert.match(live, /<form class="form" id="lead-form"/);
  assert.match(live, /name="slug" value="acme-roofing"/);
  assert.match(live, /name="website"/);
  assert.match(live, /fetch\('\/api\/lead'/);
  const demo = render({ type: 'contact' }, { mode: 'demo', token: 'tok' });
  assert.match(demo, /name="t" value="tok"/);
});

test('export mode replaces the form with call/email buttons', () => {
  const html = render({ type: 'contact' }, { mode: 'export' });
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /\/api\/lead/);
  assert.match(html, /href="mailto:office@acmeroofing\.example"/);
  assert.match(html, /href="tel:\+18165550100"/);
});

test('listPages covers every page once', () => {
  assert.deepEqual(listPages(fixture()).map((p) => p.path), [
    '/', '/services/roof-replacement', '/services/storm-damage', '/services/skylights',
    '/areas/lees-summit', '/areas/blue-springs', '/contact',
  ]);
});

test('every listed page renders', () => {
  for (const { page } of listPages(fixture())) assert.ok(render(page), JSON.stringify(page));
});

test('sitemap and robots', () => {
  const xml = renderSitemap({ content: fixture(), origin: 'https://acme.example' });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/acme\.example\/areas\/blue-springs<\/loc>/);
  assert.equal((xml.match(/<url>/g) || []).length, 7);
  assert.equal(renderRobots({ origin: 'https://acme.example' }), 'User-agent: *\nAllow: /\n\nSitemap: https://acme.example/sitemap.xml\n');
});

test('home page HTML snapshot', (t) => {
  t.assert.snapshot(render({ type: 'home' }));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/render-pages.test.mjs`
Expected: FAIL — `listPages` is not exported / page tests return null.

- [ ] **Step 3: Add the pages**

Replace `sitekit/templates/call-now/pages.mjs` with:

```js
import { esc, md } from '../../escape.mjs';
import { icon } from '../../icons.mjs';
import { imgAttrs } from '../../content.mjs';
import { SECTIONS, BANDS, tel, band, head, serviceCard, reviews, areas, cta } from './sections.mjs';
import { faqLd, serviceLd } from './schema.mjs';

export function home(ctx) {
  const { c } = ctx;
  let alt = false;
  const body = c.sectionOrder
    .map((name) => {
      const fn = Object.hasOwn(SECTIONS, name) ? SECTIONS[name] : null;
      if (!fn) return '';
      const html = fn(ctx, alt);
      if (html && BANDS.has(name)) alt = !alt;
      return html;
    })
    .join('');
  const where = c.business.city || 'Kansas City';
  return {
    path: '/',
    title: `${c.business.name} | ${c.trade} in ${where}`,
    description: c.hero.sub || `${c.trade} in ${where}.`,
    body,
    ld: faqLd(c.faq),
  };
}

function pageHero(crumbs, title, sub) {
  const trail = crumbs.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join(' / ');
  return `<section class="page-hero"><div class="wrap"><div class="crumbs">${trail}</div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></section>`;
}

function asideCta(ctx) {
  const b = ctx.c.business;
  return `<aside class="aside-card"><h2>${esc(ctx.c.hero.cta || 'Get a Free Estimate')}</h2><p>Call us or send a request online — we’ll get back to you quickly.</p><a class="btn btn-accent" href="${tel(b.phone)}">${icon('phone')}Call ${esc(b.phone)}</a><a class="btn btn-ghost" href="${ctx.href('/contact')}">Request online</a></aside>`;
}

export function service(ctx, { slug }) {
  const { c } = ctx;
  const s = c.services.find((x) => x.slug === slug);
  if (!s) return null;
  const img = imgAttrs(s.image, ctx.slug, '(max-width: 860px) 100vw, 680px');
  const others = c.services.filter((x) => x.slug !== slug);
  const otherHtml = others.length
    ? `<h2 class="sub-h">Other services</h2><ul class="chips">${others.map((o) => `<li><a href="${ctx.href(`/services/${o.slug}`)}">${icon(o.icon)}${esc(o.name)}</a></li>`).join('')}</ul>`
    : '';
  const body =
    pageHero([[ctx.href('/'), 'Home'], [ctx.href('/', '#services'), 'Services']], s.name, s.summary) +
    `<section class="section"><div class="wrap split"><div>${img ? `<div class="rounded"><img ${img} alt="" decoding="async"></div>` : ''}<div class="prose">${md(s.body || s.summary || '')}</div>${otherHtml}</div>${asideCta(ctx)}</div></section>` +
    areas(ctx, true) +
    cta(ctx);
  return {
    path: `/services/${s.slug}`,
    title: `${s.name} | ${c.business.name}`,
    description: s.summary || `${s.name} from ${c.business.name}.`,
    body,
    ld: serviceLd(ctx, s),
  };
}

export function area(ctx, { slug }) {
  const { c } = ctx;
  const a = c.areas.find((x) => x.slug === slug);
  if (!a) return null;
  const title = `${c.trade} in ${a.name}`;
  const body =
    pageHero([[ctx.href('/'), 'Home'], [ctx.href('/', '#areas'), 'Service Areas']], title, `${c.business.name} serves homeowners in ${a.name} and the surrounding area.`) +
    `<section class="section"><div class="wrap split"><div class="prose">${md(a.intro || '')}</div>${asideCta(ctx)}</div></section>` +
    band('', true, `${head('Services', `Our services in ${a.name}`)}<div class="grid">${c.services.map((s) => serviceCard(ctx, s)).join('')}</div>`) +
    reviews(ctx, false) +
    cta(ctx);
  return {
    path: `/areas/${a.slug}`,
    title: `${title} | ${c.business.name}`,
    description: `${title} — call ${c.business.phone} or request an estimate online.`,
    body,
  };
}

const FORM_SCRIPT = `<script>
document.getElementById('lead-form').addEventListener('submit',function(e){e.preventDefault();var f=e.target,s=f.querySelector('.form-status'),b=f.querySelector('button');b.disabled=true;s.textContent='Sending…';
fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))}).then(function(r){return r.json().catch(function(){return{};}).then(function(j){if(r.ok&&j.ok){f.reset();s.textContent='Thanks! We’ll be in touch shortly.';}else{s.textContent=j.error||'Something went wrong. Please call us instead.';}});}).catch(function(){s.textContent='Something went wrong. Please call us instead.';}).finally(function(){b.disabled=false;});});
</script>`;

function leadForm(ctx) {
  return `<form class="form" id="lead-form" novalidate><input type="hidden" name="slug" value="${esc(ctx.slug)}"><input type="hidden" name="t" value="${esc(ctx.token)}"><label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>Name<input name="name" required autocomplete="name"></label><label>Phone<input name="phone" type="tel" autocomplete="tel"></label><label>Email<input name="email" type="email" autocomplete="email"></label><label>How can we help?<textarea name="message"></textarea></label><button class="btn btn-accent" type="submit">Send my request</button><p class="form-status" role="status" aria-live="polite"></p></form>`;
}

function exportContact(ctx) {
  const b = ctx.c.business;
  return `<div class="prose"><p>Call us or send an email and we’ll get back to you quickly.</p></div><div class="hero-ctas"><a class="btn btn-accent" href="${tel(b.phone)}">${icon('phone')}Call ${esc(b.phone)}</a>${b.email ? `<a class="btn btn-ghost" href="mailto:${esc(b.email)}">Email us</a>` : ''}</div>`;
}

export function contact(ctx) {
  const b = ctx.c.business;
  const info = [
    ['phone', `<a href="${tel(b.phone)}">${esc(b.phone)}</a>`],
    b.email && ['mail', `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`],
    b.address && ['pin', `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(b.address)}">${esc(b.address)}</a>`],
    b.hours && ['clock', esc(b.hours)],
    b.license && ['shield', `License ${esc(b.license)}`],
  ]
    .filter(Boolean)
    .map(([i, h]) => `<li>${icon(i)}<span>${h}</span></li>`)
    .join('');
  const exporting = ctx.mode === 'export';
  const body =
    pageHero([[ctx.href('/'), 'Home']], ctx.c.hero.cta || 'Get a Free Estimate', 'Tell us a little about your project and we’ll get back to you quickly.') +
    `<section class="section"><div class="wrap split"><div>${exporting ? exportContact(ctx) : leadForm(ctx)}</div><aside class="aside-card"><h2>Contact ${esc(b.name)}</h2><ul class="info-list">${info}</ul></aside></div></section>`;
  return {
    path: '/contact',
    title: `Contact | ${b.name}`,
    description: `Contact ${b.name} — call ${b.phone} or request an estimate online.`,
    body,
    scripts: exporting ? '' : FORM_SCRIPT,
  };
}

export const PAGES = { home, service, area, contact };
```

- [ ] **Step 4: Add `listPages`, sitemap, and robots to the renderer**

Append to `sitekit/render.mjs`:

```js
export function listPages(content) {
  return [
    { page: { type: 'home' }, path: '/' },
    ...(content.services || []).map((s) => ({ page: { type: 'service', slug: s.slug }, path: `/services/${s.slug}` })),
    ...(content.areas || []).map((a) => ({ page: { type: 'area', slug: a.slug }, path: `/areas/${a.slug}` })),
    { page: { type: 'contact' }, path: '/contact' },
  ];
}

export function renderSitemap({ content, origin }) {
  const urls = listPages(content).map((p) => `<url><loc>${esc(origin + p.path)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export function renderRobots({ origin }) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
```

- [ ] **Step 5: Create the snapshot, then run**

Run: `node --test --test-update-snapshots test/render-pages.test.mjs`. This writes `test/render-pages.test.mjs.snapshot`.
Then run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Eyeball the inner pages**

Using the same one-liner as Task 8 Step 11, render `{type:'service',slug:'skylights'}`, `{type:'area',slug:'blue-springs'}`, and `{type:'contact'}` to `dist/` and view them at 390px and 1024px.

- [ ] **Step 7: Commit**

```bash
git add sitekit/templates/call-now/pages.mjs sitekit/render.mjs test/render-pages.test.mjs test/render-pages.test.mjs.snapshot
git commit -m "Add service, area, and contact pages; sitemap, robots, and export mode" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Admin SQL helpers and CLI core (`validate`, `push`, `demo-link`, `status`, `pull`, `views`)

**Files:**
- Create: `sitekit/admin.mjs`, `scripts/site.mjs`
- Test: `test/admin.test.mjs`

**Interfaces:**
- Consumes: `validateContent` (T5).
- Produces:
  - `STATUSES = ['prospect','demo','pitched','viewed','meeting','won','lost','live']`
  - `sqlString(v): string` (`'…'` with `''` escaping; `null`/`undefined` → `NULL`)
  - `pushSql({ id, slug, token, content, now }): string` (one-statement upsert; first insert has status `demo`, a `prospect` row is promoted to `demo`, and the token is set on insert only)
  - `normalizeDomain(d): string|null`
  - `statusSql({ slug, status, domain, now }): string`
  - CLI: `node scripts/site.mjs <validate|push|demo-link|status|pull|views> [args] [--local]`. Local token cache in `sites/.tokens.json`, which the Task 1 gitignore rule `sites/*` covers.

- [ ] **Step 1: Write the failing tests**

`test/admin.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlString, pushSql, normalizeDomain, statusSql, STATUSES } from '../sitekit/admin.mjs';

test('sqlString quotes and escapes', () => {
  assert.equal(sqlString("Lee's"), "'Lee''s'");
  assert.equal(sqlString(null), 'NULL');
  assert.equal(sqlString(undefined), 'NULL');
  assert.equal(sqlString(5), "'5'");
});

test('pushSql is a single-statement upsert that preserves token and status', () => {
  const sql = pushSql({ id: 'id1', slug: 'acme', token: 'tok', content: { business: { name: "O'Neil", email: 'a@b.co' } }, now: '2026-09-28T00:00:00.000Z' });
  assert.match(sql, /^INSERT INTO sites \(id, slug, template, status, demo_token, content_json, contact_email, updated_at, created_at\)/);
  assert.match(sql, /VALUES \('id1', 'acme', 'call-now', 'demo', 'tok', '\{"business":\{"name":"O''Neil","email":"a@b\.co"\}\}', 'a@b\.co', /);
  assert.match(sql, /ON CONFLICT\(slug\) DO UPDATE SET/);
  assert.match(sql, /status = CASE WHEN sites\.status = 'prospect' THEN 'demo' ELSE sites\.status END/);
  assert.doesNotMatch(sql, /demo_token = excluded/);
  assert.equal((sql.match(/;/g) || []).length, 1, 'exactly one statement');
});

test('pushSql handles a missing business email', () => {
  assert.match(pushSql({ id: 'i', slug: 's', token: 't', content: { business: {} }, now: 'n' }), /'\{"business":\{\}\}', NULL, /);
});

test('normalizeDomain strips protocol, www, and paths', () => {
  assert.equal(normalizeDomain('https://www.AcmeRoofing.com/about'), 'acmeroofing.com');
  assert.equal(normalizeDomain('acme-roofing.co.uk'), 'acme-roofing.co.uk');
  assert.equal(normalizeDomain('not a domain'), null);
  assert.equal(normalizeDomain('localhost'), null);
});

test('statusSql updates status and optionally domain', () => {
  assert.equal(
    statusSql({ slug: 'acme', status: 'meeting', domain: null, now: 'N' }),
    "UPDATE sites SET status = 'meeting', updated_at = 'N' WHERE slug = 'acme';\n"
  );
  assert.equal(
    statusSql({ slug: 'acme', status: 'live', domain: 'www.acme.com', now: 'N' }),
    "UPDATE sites SET status = 'live', domain = 'acme.com', updated_at = 'N' WHERE slug = 'acme';\n"
  );
  assert.throws(() => statusSql({ slug: 'a', status: 'bogus', now: 'N' }), /Unknown status/);
  assert.throws(() => statusSql({ slug: 'a', status: 'live', domain: 'nope', now: 'N' }), /Invalid domain/);
  assert.deepEqual(STATUSES, ['prospect', 'demo', 'pitched', 'viewed', 'meeting', 'won', 'lost', 'live']);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/admin.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the admin helpers**

`sitekit/admin.mjs`:

```js
// Pure helpers for scripts/site.mjs. Every SQL builder returns ONE statement:
// `wrangler d1 execute --file` is the only safe way to run anything longer.

export const STATUSES = ['prospect', 'demo', 'pitched', 'viewed', 'meeting', 'won', 'lost', 'live'];

export function sqlString(v) {
  return v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
}

export function pushSql({ id, slug, token, content, now }) {
  const email = content.business?.email || null;
  return `INSERT INTO sites (id, slug, template, status, demo_token, content_json, contact_email, updated_at, created_at)
VALUES (${sqlString(id)}, ${sqlString(slug)}, 'call-now', 'demo', ${sqlString(token)}, ${sqlString(JSON.stringify(content))}, ${sqlString(email)}, ${sqlString(now)}, ${sqlString(now)})
ON CONFLICT(slug) DO UPDATE SET
  content_json = excluded.content_json,
  contact_email = COALESCE(sites.contact_email, excluded.contact_email),
  updated_at = excluded.updated_at,
  status = CASE WHEN sites.status = 'prospect' THEN 'demo' ELSE sites.status END;
`;
}

export function normalizeDomain(d) {
  const s = String(d ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

export function statusSql({ slug, status, domain, now }) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
  let domainSet = '';
  if (domain !== null && domain !== undefined) {
    const d = normalizeDomain(domain);
    if (!d) throw new Error(`Invalid domain: ${domain}`);
    domainSet = `, domain = ${sqlString(d)}`;
  }
  return `UPDATE sites SET status = ${sqlString(status)}${domainSet}, updated_at = ${sqlString(now)} WHERE slug = ${sqlString(slug)};\n`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/admin.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the CLI**

`scripts/site.mjs`:

```js
#!/usr/bin/env node
// Sitekit CLI. Writes (push/status, and pitch in Task 12) generate SQL into
// scripts/.site-push.sql and print the wrangler command for you to run — same
// --file pattern as new-project.js, because `wrangler d1 execute --command`
// silently drops every statement after the first. Reads (demo-link/pull/views)
// run a single SELECT through wrangler directly since they change nothing.
//
// Usage: node scripts/site.mjs <command> [args] [--local]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../sitekit/validate.mjs';
import { pushSql, statusSql, STATUSES } from '../sitekit/admin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITES_DIR = path.join(ROOT, 'sites');
const TOKENS_FILE = path.join(SITES_DIR, '.tokens.json');
const SQL_FILE = path.join(ROOT, 'scripts', '.site-push.sql');
const BASE_URL = process.env.SK_BASE_URL || 'https://zohnwheelerportfolio.pages.dev';
const DB = 'portfolio-leads';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
      else { out[a.slice(2)] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);
const target = flags.local ? '--local' : '--remote';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function sitePath(slug) {
  if (!SLUG.test(slug || '')) fail(`Invalid or missing slug: ${slug ?? '(none)'}`);
  return path.join(SITES_DIR, `${slug}.json`);
}

function readContent(slug) {
  const p = sitePath(slug);
  if (!fs.existsSync(p)) fail(`No content file at ${path.relative(ROOT, p)}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeContent(slug, content) {
  fs.writeFileSync(sitePath(slug), JSON.stringify(content, null, 2) + '\n');
}

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch { return {}; }
}

function saveToken(slug, token) {
  const t = readTokens();
  t[slug] = token;
  fs.mkdirSync(SITES_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(t, null, 2) + '\n');
}

const demoLink = (slug, token) => `${BASE_URL}/demo/${slug}?t=${token}`;

function writeSql(sql) {
  fs.writeFileSync(SQL_FILE, sql);
  const rel = path.relative(ROOT, SQL_FILE).replace(/\\/g, '/');
  console.log(`\nWrote ${rel}. Run:\n\n  npx wrangler d1 execute ${DB} ${target} --file ${rel}\n`);
}

// Single-statement reads only. Slugs are validated, so the only quotes in
// the SQL are single quotes; double quotes would break the shell quoting.
function d1Query(sql) {
  if (sql.includes('"')) throw new Error('d1Query SQL must not contain double quotes');
  const out = execSync(`npx wrangler d1 execute ${DB} ${target} --json --command "${sql}"`, {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
}

const fileExists = (rel) => fs.existsSync(path.join(ROOT, rel));

function runValidate(slug, content) {
  const { errors, warnings } = validateContent(content, { slug, fileExists });
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    fail(`\n${slug}: ${errors.length} error(s) — fix them and try again.`);
  }
  console.log(`${slug}: valid${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
}

const commands = {
  validate() {
    const slug = flags._[0];
    runValidate(slug, readContent(slug));
  },

  push() {
    const slug = flags._[0];
    const content = readContent(slug);
    runValidate(slug, content);
    const token = readTokens()[slug] || crypto.randomBytes(24).toString('hex');
    saveToken(slug, token);
    writeSql(pushSql({ id: crypto.randomUUID(), slug, token, content, now: new Date().toISOString() }));
    console.log(`Demo link (works once the SQL has run):\n\n  ${demoLink(slug, token)}\n`);
    console.log(`If ${slug} was first pushed from another machine, run: node scripts/site.mjs demo-link ${slug}`);
  },

  'demo-link'() {
    const slug = flags._[0];
    sitePath(slug);
    const rows = d1Query(`SELECT demo_token FROM sites WHERE slug = '${slug}'`);
    if (!rows.length) fail(`${slug} is not in the database yet — run push first.`);
    saveToken(slug, rows[0].demo_token);
    console.log(demoLink(slug, rows[0].demo_token));
  },

  status() {
    const [slug, status] = flags._;
    sitePath(slug);
    if (!STATUSES.includes(status)) fail(`Status must be one of: ${STATUSES.join(', ')}`);
    if (status === 'live' && typeof flags.domain !== 'string') fail('Going live requires --domain example.com');
    const domain = typeof flags.domain === 'string' ? flags.domain : null;
    try {
      writeSql(statusSql({ slug, status, domain, now: new Date().toISOString() }));
    } catch (err) {
      fail(err.message);
    }
    if (status === 'live') {
      console.log('Also add the domain (and www.) as custom domains on the zohnwheelerportfolio Pages project.');
    }
  },

  pull() {
    const slug = flags._[0];
    const content = readContent(slug);
    const rows = d1Query(`SELECT json_extract(content_json, '$.theme') AS theme FROM sites WHERE slug = '${slug}'`);
    if (!rows.length || !rows[0].theme) fail(`${slug} has no saved theme in the database.`);
    content.theme = JSON.parse(rows[0].theme);
    writeContent(slug, content);
    console.log(`Updated sites/${slug}.json theme → ${rows[0].theme}`);
  },

  views() {
    const rows = d1Query(
      `SELECT s.slug, s.status, COUNT(v.id) AS views, MAX(v.viewed_at) AS last_view FROM sites s JOIN demo_views v ON v.site_id = s.id GROUP BY s.id ORDER BY last_view DESC LIMIT 50`
    );
    if (!rows.length) console.log('No demo views yet.');
    else console.table(rows);
  },
};

if (!Object.hasOwn(commands, cmd ?? '')) {
  fail(`Usage: node scripts/site.mjs <${Object.keys(commands).join('|')}> [slug] [--local]`);
}
commands[cmd]();
```

- [ ] **Step 6: Smoke-test the offline commands**

```bash
mkdir -p sites && cp test/fixtures/acme-roofing.json sites/acme-roofing.json
node scripts/site.mjs validate acme-roofing
node scripts/site.mjs push acme-roofing --local
node scripts/site.mjs status acme-roofing live --local
node scripts/site.mjs status acme-roofing live --domain https://www.acme.test --local
node scripts/site.mjs nope
```

Expected, in order:
1. `acme-roofing: valid`
2. The SQL-file path, a `--local` wrangler command, and a demo link. `sites/.tokens.json` now exists, and `git status` does not show it.
3. `Going live requires --domain example.com` (exit code 1).
4. A SQL file containing `domain = 'acme.test'`.
5. A usage line listing the commands (exit code 1).

(`demo-link`, `pull`, and `views` need the D1 tables, so they're exercised in Task 11.)

- [ ] **Step 7: Commit**

`sites/acme-roofing.json` is committed in Task 11, so leave it out here.

```bash
git add sitekit/admin.mjs scripts/site.mjs test/admin.test.mjs
git commit -m "Add sitekit CLI: validate, push, demo-link, status, pull, views" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: D1 schema, middleware, lead and theme endpoints, and a local end-to-end test

**Files:**
- Create: `schema-sitekit.sql`, `sitekit/admin-pages.mjs`, `functions/_middleware.js`, `functions/api/lead.js`, `functions/api/demo-theme.js`
- Commit: `sites/acme-roofing.json` (fictional sample, created in Task 10 Step 6)
- Test: `test/admin-pages.test.mjs`

**Interfaces:**
- Consumes: `routeRequest`, `portfolioHostList` (T6); `renderPage`, `renderSitemap`, `renderRobots` (T8/9); `isPresenter`, `presenterCookieValue`, `PRESENTER_COOKIE`, `deviceFromUA`, `safeEqual` (T7); `parseLead` (T7); `resolveTheme` (T3).
- Produces: `renderPresenterHome(rows)` where `rows` are `{ slug, status, demo_token, name, updated_at }`; `renderUnavailable()`. HTTP endpoints: `POST /api/lead`, `POST /api/demo-theme`.

- [ ] **Step 1: Schema**

`schema-sitekit.sql`:

```sql
-- Sitekit: multi-tenant client sites. Same portfolio-leads D1 database.
-- Apply once: npx wrangler d1 execute portfolio-leads --remote --file ./schema-sitekit.sql

-- status: prospect|demo|pitched|viewed|meeting|won|lost|live
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL DEFAULT 'call-now',
  status TEXT NOT NULL DEFAULT 'prospect',
  domain TEXT UNIQUE,
  demo_token TEXT NOT NULL UNIQUE,
  content_json TEXT NOT NULL,
  contact_email TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- device is bucketed from User-Agent; no IP is stored for views.
CREATE TABLE IF NOT EXISTS demo_views (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  path TEXT NOT NULL,
  device TEXT NOT NULL,
  viewed_at TEXT NOT NULL
);

-- ip is kept only for rate limiting, same as inquiries.
CREATE TABLE IF NOT EXISTS site_leads (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_demo_views_site ON demo_views(site_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_site_leads_site ON site_leads(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_site_leads_ip ON site_leads(ip, created_at);
```

- [ ] **Step 2: Write the failing admin-pages test**

`test/admin-pages.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPresenterHome, renderUnavailable } from '../sitekit/admin-pages.mjs';

test('presenter home lists demo links and escapes names', () => {
  const html = renderPresenterHome([{ slug: 'acme', status: 'pitched', demo_token: 'tok', name: '<b>Acme</b>', updated_at: '2026-09-28T12:00:00Z' }]);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /href="\/demo\/acme\?t=tok"/);
  assert.match(html, /&lt;b&gt;Acme&lt;\/b&gt;/);
  assert.match(html, /pitched/);
  assert.match(html, /2026-09-28/);
});

test('presenter home explains the empty state', () => {
  assert.match(renderPresenterHome([]), /No demo sites yet/);
});

test('unavailable page is a complete HTML document', () => {
  assert.match(renderUnavailable(), /^<!doctype html>[\s\S]*temporarily unavailable/);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `node --test test/admin-pages.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 4: Admin pages**

`sitekit/admin-pages.mjs`:

```js
import { esc } from './escape.mjs';

const CSS = 'body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#0f1115;color:#e8eaf0}main{max-width:900px;margin:0 auto;padding:32px 16px}h1{font-size:1.6rem}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #2a2f3a}a{color:#7cc4ff}.pill{display:inline-block;padding:2px 10px;border-radius:999px;background:#2a2f3a;font-size:.85rem}';

const doc = (title, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

export function renderPresenterHome(sites) {
  if (!sites.length) {
    return doc('Presenter · Demo sites', '<h1>Demo sites</h1><p>No demo sites yet. Push one with <code>node scripts/site.mjs push &lt;slug&gt;</code>.</p>');
  }
  const rows = sites
    .map((s) => `<tr><td><a href="/demo/${esc(s.slug)}?t=${esc(s.demo_token)}">${esc(s.name || s.slug)}</a></td><td><span class="pill">${esc(s.status)}</span></td><td>${esc(String(s.updated_at || '').slice(0, 10))}</td></tr>`)
    .join('');
  return doc('Presenter · Demo sites', `<h1>Demo sites</h1><table><thead><tr><th>Business</th><th>Status</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>`);
}

export function renderUnavailable() {
  return doc('Temporarily unavailable', '<h1>We’ll be right back</h1><p>This site is temporarily unavailable. Please try again in a minute.</p>');
}
```

- [ ] **Step 5: Run to verify pass**

Run: `node --test test/admin-pages.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 6: Middleware**

`functions/_middleware.js`:

```js
// Sitekit entry point. Routes every request: portfolio host → static files
// (unchanged); /demo/<slug>?t= → token-gated demo; any other host → a live
// client site looked up by domain. See sitekit/route.mjs for the rules.

import { routeRequest, portfolioHostList } from '../sitekit/route.mjs';
import { renderPage, renderSitemap, renderRobots } from '../sitekit/render.mjs';
import { renderPresenterHome, renderUnavailable } from '../sitekit/admin-pages.mjs';
import { isPresenter, presenterCookieValue, PRESENTER_COOKIE, deviceFromUA, safeEqual } from '../sitekit/presenter.mjs';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
// Browsers always revalidate; the edge cache keeps a copy for 5 minutes.
const LIVE_CACHE = 'public, max-age=0, s-maxage=300';

function respond(body, { status = 200, type = 'text/html; charset=utf-8', cache = 'no-store', extra = {} } = {}) {
  return new Response(body, { status, headers: { 'Content-Type': type, 'Cache-Control': cache, ...SECURITY_HEADERS, ...extra } });
}

const notFound = () => respond('Not found', { status: 404, type: 'text/plain; charset=utf-8' });

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const route = routeRequest({
    host: url.host,
    path: url.pathname,
    searchParams: url.searchParams,
    portfolioHosts: portfolioHostList(env.PORTFOLIO_HOSTS),
  });

  if (route.kind === 'static') return next();
  if (route.kind === 'not-found') return notFound();
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return respond('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8' });
  }

  try {
    if (route.kind === 'presenter-login') return await presenterLogin(route, env);
    if (route.kind === 'presenter-home') return await presenterHome(request, env);
    if (route.kind === 'demo') return await demo(context, route, url);
    if (route.kind === 'live') return await live(context, route);
    return notFound();
  } catch (err) {
    console.error('sitekit request failed', err);
    return respond(renderUnavailable(), { status: 503, extra: { 'Retry-After': '60' } });
  }
}

async function presenterLogin(route, env) {
  if (!env.ADMIN_TOKEN || !safeEqual(route.key, env.ADMIN_TOKEN)) return notFound();
  const value = await presenterCookieValue(env.ADMIN_TOKEN);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/demo/presenter',
      'Set-Cookie': `${PRESENTER_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
      'Cache-Control': 'no-store',
    },
  });
}

async function presenterHome(request, env) {
  if (!(await isPresenter(request.headers.get('cookie'), env.ADMIN_TOKEN))) return notFound();
  const { results } = await env.DB.prepare(
    `SELECT slug, status, demo_token, json_extract(content_json, '$.business.name') AS name, updated_at
     FROM sites WHERE status != 'lost' ORDER BY updated_at DESC LIMIT 200`
  ).all();
  return respond(renderPresenterHome(results), { extra: { 'X-Robots-Tag': 'noindex, nofollow' } });
}

async function demo(context, route, url) {
  const { request, env } = context;
  const site = await env.DB.prepare(`SELECT id, slug, status, demo_token, content_json FROM sites WHERE slug = ?`)
    .bind(route.slug)
    .first();
  if (!site || site.status === 'lost') return notFound();

  const presenter = await isPresenter(request.headers.get('cookie'), env.ADMIN_TOKEN);
  const tokenOk = safeEqual(route.token, site.demo_token);
  if (!tokenOk && !presenter) return notFound();

  const html = renderPage({
    content: JSON.parse(site.content_json),
    slug: site.slug,
    page: route.page,
    mode: 'demo',
    token: tokenOk ? route.token : '',
    origin: url.origin,
    overrides: route.overrides,
    presenter,
  });
  if (!html) return notFound();

  // Presenter views are Zohn's own; logging them would fake the "they looked
  // at it" signal.
  if (!presenter && request.method === 'GET') {
    const now = new Date().toISOString();
    context.waitUntil(
      env.DB.batch([
        env.DB.prepare(`INSERT INTO demo_views (id, site_id, path, device, viewed_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), site.id, url.pathname, deviceFromUA(request.headers.get('user-agent')), now),
        env.DB.prepare(`UPDATE sites SET status = 'viewed', updated_at = ? WHERE id = ? AND status = 'pitched'`).bind(now, site.id),
      ]).catch((err) => console.error('demo view log failed', err))
    );
  }
  return respond(html, { extra: { 'X-Robots-Tag': 'noindex, nofollow' } });
}

async function live(context, route) {
  const { request, env } = context;
  const cache = caches.default;
  if (request.method === 'GET') {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

  const site = await env.DB.prepare(`SELECT slug, domain, content_json FROM sites WHERE status = 'live' AND domain = ?`)
    .bind(route.domain)
    .first();
  if (!site) return notFound();

  const content = JSON.parse(site.content_json);
  const origin = `https://${site.domain}`;
  let res;
  if (route.page.type === 'sitemap') {
    res = respond(renderSitemap({ content, origin }), { type: 'application/xml; charset=utf-8', cache: LIVE_CACHE });
  } else if (route.page.type === 'robots') {
    res = respond(renderRobots({ origin }), { type: 'text/plain; charset=utf-8', cache: LIVE_CACHE });
  } else {
    const html = renderPage({ content, slug: site.slug, page: route.page, mode: 'live', origin });
    if (!html) return notFound();
    res = respond(html, { cache: LIVE_CACHE });
  }
  if (request.method === 'GET') context.waitUntil(cache.put(request, res.clone()));
  return res;
}
```

- [ ] **Step 7: Lead endpoint**

`functions/api/lead.js`:

```js
import { parseLead } from '../../sitekit/lead.mjs';
import { safeEqual } from '../../sitekit/presenter.mjs';

const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 3;
const OWNER_EMAIL = 'zohnwheeler@gmail.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Demo submissions (carrying the demo token) go to Zohn so a prospect testing
// their own form doesn't get a confusing email. Live submissions must come
// from the site's own domain and go to the business.
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const parsed = parseLead(body);
  if (!parsed.ok) return json(parsed, 400);
  if (parsed.spam) return json({ ok: true });
  const { lead } = parsed;

  let site;
  let mode;
  if (lead.token) {
    site = await env.DB.prepare(`SELECT id, content_json, contact_email, demo_token FROM sites WHERE slug = ?`).bind(lead.slug).first();
    if (!site || !safeEqual(lead.token, site.demo_token)) return json({ ok: false, error: 'Not found' }, 404);
    mode = 'demo';
  } else {
    const host = new URL(request.url).hostname.toLowerCase().replace(/^www\./, '');
    site = await env.DB.prepare(`SELECT id, content_json, contact_email FROM sites WHERE slug = ? AND status = 'live' AND domain = ?`)
      .bind(lead.slug, host)
      .first();
    if (!site) return json({ ok: false, error: 'Not found' }, 404);
    mode = 'live';
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM site_leads WHERE ip = ? AND created_at > ?`).bind(ip, windowStart).first();
  if ((recent?.n || 0) >= RATE_LIMIT_MAX) {
    return json({ ok: false, error: 'Too many submissions — please try again in a few minutes.' }, 429);
  }

  await env.DB.prepare(
    `INSERT INTO site_leads (id, site_id, mode, name, phone, email, message, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), site.id, mode, lead.name, lead.phone, lead.email, lead.message, ip, new Date().toISOString())
    .run();

  if (env.RESEND_API_KEY) {
    const businessName = JSON.parse(site.content_json).business?.name || lead.slug;
    const to = mode === 'live' && site.contact_email ? site.contact_email : OWNER_EMAIL;
    context.waitUntil(notify(env, { to, mode, businessName, lead }));
  }

  return json({ ok: true });
}

async function notify(env, { to, mode, businessName, lead }) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM || 'onboarding@resend.dev',
        to,
        ...(lead.email ? { reply_to: lead.email } : {}),
        subject: `${mode === 'demo' ? `[DEMO: ${businessName}] ` : ''}New estimate request — ${lead.name}`,
        text: `Name: ${lead.name}\nPhone: ${lead.phone}\nEmail: ${lead.email}\n\n${lead.message}`,
      }),
    });
  } catch {
    // Best effort — the lead is already saved in D1.
  }
}
```

- [ ] **Step 8: Theme-save endpoint**

`functions/api/demo-theme.js`:

```js
import { isPresenter } from '../../sitekit/presenter.mjs';
import { resolveTheme } from '../../sitekit/themes.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Presenter-only: persists the look chosen in the room. Run
// `node scripts/site.mjs pull <slug>` afterwards to sync the content file.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isPresenter(request.headers.get('cookie'), env.ADMIN_TOKEN))) {
    return json({ ok: false, error: 'Not found' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const slug = String(body?.slug || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ ok: false, error: 'Invalid slug.' }, 400);
  const theme = resolveTheme({}, body.theme || {});

  const result = await env.DB.prepare(
    `UPDATE sites SET content_json = json_set(content_json, '$.theme', json(?)), updated_at = ? WHERE slug = ?`
  )
    .bind(JSON.stringify(theme), new Date().toISOString(), slug)
    .run();
  if (!result.meta?.changes) return json({ ok: false, error: 'Not found' }, 404);
  return json({ ok: true, theme });
}
```

- [ ] **Step 9: Run the unit suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 10: Local end-to-end run**

```bash
npx wrangler d1 execute portfolio-leads --local --file ./schema-sitekit.sql
node scripts/site.mjs push acme-roofing --local
npx wrangler d1 execute portfolio-leads --local --file scripts/.site-push.sql
echo "ADMIN_TOKEN=local-admin" > .dev.vars
```

Start `npx wrangler pages dev public --port 8788` in the background. Set `TOKEN` to the value for `acme-roofing` in `sites/.tokens.json`. Then check:

```bash
B=http://localhost:8788
curl -s -o /dev/null -w "%{http_code} portfolio\n" $B/
curl -s -o /dev/null -w "%{http_code} demo ok\n" "$B/demo/acme-roofing?t=$TOKEN"
curl -s "$B/demo/acme-roofing?t=$TOKEN" | grep -c "Preview built for Acme Roofing"
curl -s -o /dev/null -w "%{http_code} demo service\n" "$B/demo/acme-roofing/services/skylights?t=$TOKEN"
curl -s -o /dev/null -w "%{http_code} no token\n" $B/demo/acme-roofing
curl -s -o /dev/null -w "%{http_code} bad token\n" "$B/demo/acme-roofing?t=wrong"
curl -s -o /dev/null -w "%{http_code} unknown slug\n" "$B/demo/nope?t=$TOKEN"
curl -s -i "$B/demo/presenter?key=local-admin" | grep -iE "^(HTTP|location|set-cookie)"
curl -s -o /dev/null -w "%{http_code} bad key\n" "$B/demo/presenter?key=wrong"
curl -s -X POST -H "Content-Type: application/json" -d "{\"slug\":\"acme-roofing\",\"t\":\"$TOKEN\",\"name\":\"Test\",\"phone\":\"8165550101\"}" $B/api/lead
node scripts/site.mjs views --local
node scripts/site.mjs demo-link acme-roofing --local
```

Expected: `200 portfolio`, `200 demo ok`, `1`, `200 demo service`, `404 no token`, `404 bad token`, `404 unknown slug`, a `302` with `Location: /demo/presenter` and a `Set-Cookie: sk_presenter=…` header, `404 bad key`, `{"ok":true}`, a views table showing `acme-roofing` with at least 2 views, and the same link as before.

Presenter flow: open `http://localhost:8788/demo/presenter?key=local-admin` in a browser. You should land on the list. Open Acme and check that the panel shows. Click **Bold**, then an accent, then **Save this look**; the panel should show `Saved ✓`. Then run `node scripts/site.mjs pull acme-roofing --local` → `sites/acme-roofing.json` has the new theme. Restore the file afterwards with `cp test/fixtures/acme-roofing.json sites/acme-roofing.json`.

Live mode:

```bash
npx wrangler d1 execute portfolio-leads --local --command "UPDATE sites SET status = 'live', domain = 'acme.test' WHERE slug = 'acme-roofing'"
curl -s -H "Host: acme.test" $B/ | grep -o '<link rel="canonical"[^>]*>'
curl -s -o /dev/null -w "%{http_code} live hire.html\n" -H "Host: acme.test" $B/hire.html
curl -s -H "Host: www.acme.test" $B/sitemap.xml | head -c 200
curl -s -X POST -H "Host: acme.test" -H "Content-Type: application/json" -d '{"slug":"acme-roofing","name":"Live Test","email":"x@y.co"}' $B/api/lead
```

Expected: `<link rel="canonical" href="https://acme.test/">`, `404 live hire.html`, sitemap XML with `https://acme.test/` URLs, `{"ok":true}`.

If `wrangler pages dev` rewrites the Host header so live requests come back `200` with the portfolio page instead, record that in the task notes. Live routing is fully covered by `test/route.test.mjs` and gets verified on a real custom domain after deploy. Don't change the code to work around the dev server.

Stop the dev server.

- [ ] **Step 11: Commit**

```bash
git add schema-sitekit.sql sitekit/admin-pages.mjs functions/_middleware.js functions/api/lead.js functions/api/demo-theme.js test/admin-pages.test.mjs sites/acme-roofing.json
git commit -m "Serve demo and live client sites from Pages middleware; add lead and theme endpoints" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Muse outreach handoff (`import`, `pitch`)

**Files:**
- Modify: `sitekit/admin.mjs` (add import + append), `scripts/site.mjs` (add two commands, extend import)
- Test: `test/outreach.test.mjs`

**Interfaces:**
- Consumes: `getPreset` (T4), `validateContent` (T5), `statusSql` (T10).
- Produces:
  - `parseCsv(text): Array<Record<string,string>>` (header row lowercased; quoted fields, `""` escapes, CRLF, BOM)
  - `slugify(s): string`
  - `normalizeIndustry(s): 'roofing'|'hvac'|'foundation'|'generic'`
  - `stubFromProspect(row)` → content object with `business`, `industry`, `theme`, `services`, `areas`, `outreach: { email?, contactFormUrl?, currentSite? }`
  - `pitchText({ content, link, mailingAddress, senderName?, senderUrl? })` → `{ channel: 'email'|'form'|'none', text }`. Throws if `mailingAddress` is empty.
  - Expected CSV header from Muse: `name,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count`

- [ ] **Step 1: Write the failing tests**

`test/outreach.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, slugify, normalizeIndustry, stubFromProspect, pitchText } from '../sitekit/admin.mjs';
import { validateContent } from '../sitekit/validate.mjs';

const CSV = '\uFEFFname,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count\r\n'
  + '"Smith & Sons Roofing, LLC",Roofing,Lee\'s Summit,816-555-0142,,https://smithroof.example/contact,https://smithroof.example,4.7,88\r\n'
  + 'Cool Air Co,HVAC / Heating,Blue Springs,(816) 555-0199,hello@coolair.example,,,,\r\n'
  + '"Quote ""Test"" Plumbing",plumbing,Raymore,,,,,,\r\n\r\n';

test('parseCsv handles BOM, quotes, commas, escaped quotes, CRLF, and blank lines', () => {
  const rows = parseCsv(CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].name, 'Smith & Sons Roofing, LLC');
  assert.equal(rows[0].contact_form_url, 'https://smithroof.example/contact');
  assert.equal(rows[1].email, 'hello@coolair.example');
  assert.equal(rows[2].name, 'Quote "Test" Plumbing');
});

test('slugify makes URL-safe slugs', () => {
  assert.equal(slugify('Smith & Sons Roofing, LLC'), 'smith-sons-roofing-llc');
  assert.equal(slugify("Lee's Summit"), 'lees-summit');
  assert.equal(slugify('  --Weird__Name!!  '), 'weird-name');
});

test('normalizeIndustry maps free text to presets without false matches', () => {
  assert.equal(normalizeIndustry('Roofing & Gutters'), 'roofing');
  assert.equal(normalizeIndustry('HVAC / Heating'), 'hvac');
  assert.equal(normalizeIndustry('Air Conditioning'), 'hvac');
  assert.equal(normalizeIndustry('Foundation Repair'), 'foundation');
  assert.equal(normalizeIndustry('Basement waterproofing'), 'foundation');
  assert.equal(normalizeIndustry('plumbing'), 'generic');
  assert.equal(normalizeIndustry(undefined), 'generic');
});

test('stubFromProspect builds a pushable stub from a Muse row', () => {
  const [row] = parseCsv(CSV);
  const stub = stubFromProspect(row);
  assert.equal(stub.industry, 'roofing');
  assert.equal(stub.business.name, 'Smith & Sons Roofing, LLC');
  assert.equal(stub.business.rating, 4.7);
  assert.equal(stub.business.reviewCount, 88);
  assert.deepEqual(stub.services.map((s) => s.slug), ['roof-replacement', 'roof-repair', 'storm-damage', 'gutters']);
  assert.deepEqual(stub.areas, [{ slug: 'lees-summit', name: "Lee's Summit", intro: '' }]);
  assert.deepEqual(stub.outreach, { contactFormUrl: 'https://smithroof.example/contact', currentSite: 'https://smithroof.example' });
  const { errors } = validateContent(stub, { slug: 'x', fileExists: () => true });
  assert.deepEqual(errors, []);
});

test('stubFromProspect leaves rating out when missing and flags missing phone via validation', () => {
  const stub = stubFromProspect(parseCsv(CSV)[2]);
  assert.equal(stub.business.rating, undefined);
  assert.equal(stub.industry, 'generic');
  const { errors } = validateContent(stub, { slug: 'x', fileExists: () => true });
  assert.ok(errors.includes('business.phone is required'));
  assert.ok(errors.includes('services must have at least one entry'));
});

const ADDRESS = '123 Example St, Lee’s Summit, MO 64063';

test('pitchText targets email when available and includes CAN-SPAM footer', () => {
  const stub = stubFromProspect(parseCsv(CSV)[1]);
  const { channel, text } = pitchText({ content: stub, link: 'https://x/demo/cool-air-co?t=1', mailingAddress: ADDRESS });
  assert.equal(channel, 'email');
  assert.match(text, /wait for my approval before sending/);
  assert.match(text, /How: Send an email to hello@coolair\.example\./);
  assert.match(text, /Subject: A new website preview for Cool Air Co/);
  assert.match(text, /https:\/\/x\/demo\/cool-air-co\?t=1/);
  assert.ok(text.includes(ADDRESS));
  assert.match(text, /won’t contact you again/);
});

test('pitchText falls back to the contact form, then to no-send', () => {
  const form = pitchText({ content: stubFromProspect(parseCsv(CSV)[0]), link: 'L', mailingAddress: ADDRESS });
  assert.equal(form.channel, 'form');
  assert.match(form.text, /Open https:\/\/smithroof\.example\/contact and submit their contact form/);
  assert.doesNotMatch(form.text, /Subject:/);
  const none = pitchText({ content: stubFromProspect(parseCsv(CSV)[2]), link: 'L', mailingAddress: ADDRESS });
  assert.equal(none.channel, 'none');
  assert.match(none.text, /don’t send anything through Muse/);
});

test('pitchText refuses without a mailing address', () => {
  assert.throws(() => pitchText({ content: { business: {} }, link: 'L', mailingAddress: '' }), /SK_MAILING_ADDRESS/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/outreach.test.mjs`
Expected: FAIL — `parseCsv` is not exported.

- [ ] **Step 3: Implement (in `sitekit/admin.mjs`)**

Add this import at the top of `sitekit/admin.mjs`:

```js
import { getPreset } from './presets/index.mjs';
```

Append:

```js
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some((f) => f.trim() !== ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// Order matters: "foundation repair" contains "air", so foundation is checked
// before HVAC, and HVAC only matches "air" as a whole word.
export function normalizeIndustry(s) {
  const v = String(s ?? '').toLowerCase();
  if (/roof|gutter|siding/.test(v)) return 'roofing';
  if (/foundation|waterproof|basement|crawl/.test(v)) return 'foundation';
  if (/hvac|heating|cooling|furnace|\bair\b|a\/c/.test(v)) return 'hvac';
  return 'generic';
}

export function stubFromProspect(row) {
  const industry = normalizeIndustry(row.industry);
  const preset = getPreset(industry);
  const business = { name: String(row.name ?? '').trim() };
  if (row.phone) business.phone = row.phone;
  if (row.email) business.email = row.email;
  if (row.city) business.city = row.city;
  const rating = Number(row.google_rating);
  const count = parseInt(row.review_count, 10);
  if (rating > 0 && count > 0) {
    business.rating = rating;
    business.reviewCount = count;
  }
  const outreach = {};
  if (row.email) outreach.email = row.email;
  if (row.contact_form_url) outreach.contactFormUrl = row.contact_form_url;
  if (row.current_site) outreach.currentSite = row.current_site;
  return {
    business,
    industry,
    theme: { ...preset.theme },
    services: preset.services.map(({ slug, name }) => ({ slug, name })),
    areas: row.city ? [{ slug: slugify(row.city), name: row.city, intro: '' }] : [],
    outreach,
  };
}

export function pitchText({ content, link, mailingAddress, senderName = 'Zohn Wheeler', senderUrl = 'https://zohnwheelerportfolio.pages.dev/hire.html' }) {
  if (!mailingAddress) {
    throw new Error('A physical mailing address is required for commercial email (CAN-SPAM). Set SK_MAILING_ADDRESS.');
  }
  const b = content.business || {};
  const o = content.outreach || {};
  const email = o.email || b.email;
  if (!email && !o.contactFormUrl) {
    return {
      channel: 'none',
      text: `No email or contact form on file for ${b.name}. Call ${b.phone || 'them'} or visit in person instead — don’t send anything through Muse.`,
    };
  }
  const how = email
    ? `Send an email to ${email}.`
    : `Open ${o.contactFormUrl} and submit their contact form with the message below. Use my name and email in the form’s name and email fields.`;
  const message = [
    `Hi ${b.name} team,`,
    '',
    `I’m ${senderName}, a web developer here in Lee’s Summit. I put together a preview of a new website for ${b.name} — it’s free to look at, and there’s nothing to sign:`,
    '',
    link,
    '',
    'It’s built to bring in more calls: click-to-call on every page, an estimate request form, and a page for each service and city you work in.',
    '',
    'If you like it, I can have it live on your own domain quickly. Happy to stop by and walk you through it.',
    '',
    senderName,
    senderUrl,
    '',
    '—',
    mailingAddress,
    'Not interested? Just reply “no thanks” and I won’t contact you again.',
  ].join('\n');
  const lines = [
    'Muse — please send this website pitch for me. Show me the final message and wait for my approval before sending.',
    '',
    `How: ${how}`,
    ...(email ? [`Subject: A new website preview for ${b.name}`] : []),
    '',
    'Message:',
    '',
    message,
  ];
  return { channel: email ? 'email' : 'form', text: lines.join('\n') };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/outreach.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add `import` and `pitch` to the CLI**

In `scripts/site.mjs`, change the admin import line to:

```js
import { pushSql, statusSql, STATUSES, parseCsv, slugify, stubFromProspect, pitchText } from '../sitekit/admin.mjs';
```

Add these two entries to the `commands` object, after `views`:

```js
  'import'() {
    const file = flags._[0];
    if (!file || !fs.existsSync(file)) fail('Usage: node scripts/site.mjs import prospects.csv');
    fs.mkdirSync(SITES_DIR, { recursive: true });
    let created = 0;
    for (const row of parseCsv(fs.readFileSync(file, 'utf8'))) {
      if (!row.name) { console.warn('skipping a row with no name'); continue; }
      const slug = slugify(row.name);
      const p = path.join(SITES_DIR, `${slug}.json`);
      if (fs.existsSync(p)) { console.log(`skip ${slug} (already exists)`); continue; }
      const stub = stubFromProspect(row);
      fs.writeFileSync(p, JSON.stringify(stub, null, 2) + '\n');
      created++;
      const { errors, warnings } = validateContent(stub, { slug, fileExists });
      console.log(`created sites/${slug}.json${errors.length ? ` — needs: ${errors.join('; ')}` : ''}${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
    }
    console.log(`\n${created} new site(s). Fill in the details (write each city intro!), then: node scripts/site.mjs push <slug>`);
  },

  pitch() {
    const slug = flags._[0];
    const content = readContent(slug);
    const token = readTokens()[slug];
    if (!token) fail(`No demo link for ${slug} yet — run push (or demo-link) first.`);
    let result;
    try {
      result = pitchText({ content, link: demoLink(slug, token), mailingAddress: process.env.SK_MAILING_ADDRESS });
    } catch (err) {
      fail(err.message);
    }
    console.log('\n----- paste into Muse -----\n');
    console.log(result.text);
    console.log('\n---------------------------');
    if (result.channel !== 'none') writeSql(statusSql({ slug, status: 'pitched', domain: null, now: new Date().toISOString() }));
  },
```

- [ ] **Step 6: Smoke-test**

```bash
printf 'name,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count\nTest Heating Co,HVAC,Raymore,816-555-0177,owner@testheat.example,,,4.9,31\n' > dist/prospects.csv
node scripts/site.mjs import dist/prospects.csv
node scripts/site.mjs pitch test-heating-co
node scripts/site.mjs push test-heating-co --local
SK_MAILING_ADDRESS="PO Box 1, Lee's Summit, MO 64063" node scripts/site.mjs pitch test-heating-co --local
git status --short sites
rm sites/test-heating-co.json
```

Expected:
1. `created sites/test-heating-co.json (1 warning(s))`
2. `No demo link for test-heating-co yet`
3. A push SQL file and demo link
4. The Muse instruction, with `How: Send an email to owner@testheat.example.`, the demo link, and the PO box, followed by a status SQL file for `pitched`
5. `git status` shows no `sites/test-heating-co.json` (gitignored)

- [ ] **Step 7: Commit**

```bash
git add sitekit/admin.mjs scripts/site.mjs test/outreach.test.mjs
git commit -m "Add Muse outreach handoff: prospect CSV import and paste-ready pitch" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Static export (ownership guarantee)

**Files:**
- Modify: `scripts/site.mjs` (add the `export` command)
- Test: `test/export.test.mjs`

**Interfaces:**
- Consumes: `renderPage`, `listPages`, `renderSitemap`, `renderRobots` (T9).
- Produces: `node scripts/site.mjs export <slug> [--origin https://domain]` → `dist/<slug>/index.html`, `contact/index.html`, `services/<s>/index.html`, `areas/<a>/index.html`, the referenced `/sk/` images, plus `sitemap.xml` and `robots.txt` when `--origin` is given.

- [ ] **Step 1: Write the failing test**

`test/export.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('export writes every page as static HTML with no lead form', () => {
  execFileSync(process.execPath, ['scripts/site.mjs', 'export', 'acme-roofing', '--origin', 'https://acme.example'], { stdio: 'pipe' });
  const out = 'dist/acme-roofing';
  for (const f of ['index.html', 'contact/index.html', 'services/skylights/index.html', 'areas/blue-springs/index.html', 'sitemap.xml', 'robots.txt']) {
    assert.ok(fs.existsSync(`${out}/${f}`), f);
  }
  const contact = fs.readFileSync(`${out}/contact/index.html`, 'utf8');
  assert.doesNotMatch(contact, /<form/);
  assert.doesNotMatch(contact, /\/api\/lead/);
  const home = fs.readFileSync(`${out}/index.html`, 'utf8');
  assert.match(home, /<link rel="canonical" href="https:\/\/acme\.example\/">/);
  assert.doesNotMatch(home, /Preview built for/);
  assert.match(home, /href="\/services\/skylights"/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/export.test.mjs`
Expected: FAIL — usage error (no `export` command).

- [ ] **Step 3: Add the command**

In `scripts/site.mjs`, add this import:

```js
import { renderPage, listPages, renderSitemap, renderRobots } from '../sitekit/render.mjs';
```

Add this entry to `commands`:

```js
  'export'() {
    const slug = flags._[0];
    const content = readContent(slug);
    runValidate(slug, content);
    const origin = typeof flags.origin === 'string' ? flags.origin.replace(/\/+$/, '') : '';
    const out = path.join(ROOT, 'dist', slug);
    fs.rmSync(out, { recursive: true, force: true });
    const assets = new Set();
    const pages = listPages(content);
    for (const { page, path: urlPath } of pages) {
      const html = renderPage({ content, slug, page, mode: 'export', origin });
      const file = path.join(out, urlPath, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, html);
      for (const m of html.matchAll(/\/sk\/[A-Za-z0-9_\-./]+/g)) assets.add(m[0]);
    }
    for (const a of assets) {
      const src = path.join(ROOT, 'public', a);
      if (!fs.existsSync(src)) { console.warn(`warning: missing asset ${a}`); continue; }
      const dst = path.join(out, a);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    if (origin) {
      fs.writeFileSync(path.join(out, 'sitemap.xml'), renderSitemap({ content, origin }));
      fs.writeFileSync(path.join(out, 'robots.txt'), renderRobots({ origin }));
    }
    console.log(`Exported ${pages.length} pages and ${assets.size} asset(s) to dist/${slug}/`);
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/export.test.mjs`
Expected: PASS. Missing-asset warnings are fine until Task 14.

- [ ] **Step 5: Commit**

```bash
git add scripts/site.mjs test/export.test.mjs
git commit -m "Add static export so clients can take their site anywhere" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Stock photo pack, quality checks, and docs

**Files:**
- Create: `scripts/optimize-images.mjs`, `public/sk/stock/{roofing,hvac,foundation,generic}/*.jpg`, `docs/stock-credits.md`, `test/stock.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: `PRESETS` (T4).
- Produces: for every `stock:` ref in a preset, both `<name>.jpg` and `<name>-sm.jpg` exist.

- [ ] **Step 1: Write the failing test**

`test/stock.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRESETS } from '../sitekit/presets/index.mjs';

test('every preset stock image exists in both sizes', () => {
  const refs = new Set();
  for (const p of Object.values(PRESETS)) {
    refs.add(p.hero.image);
    for (const s of p.services) refs.add(s.image);
  }
  for (const ref of refs) {
    const base = `public/sk/stock/${ref.slice('stock:'.length)}`;
    assert.ok(fs.existsSync(base), base);
    assert.ok(fs.existsSync(base.replace(/\.jpg$/, '-sm.jpg')), base.replace(/\.jpg$/, '-sm.jpg'));
    assert.ok(fs.statSync(base).size < 350_000, `${base} is over 350KB — re-run the optimizer`);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/stock.test.mjs`
Expected: FAIL — `public/sk/stock/roofing/hero.jpg` is missing.

- [ ] **Step 3: Write the optimizer**

`scripts/optimize-images.mjs`:

```js
#!/usr/bin/env node
// One-off stock photo optimizer. sharp is NOT a project dependency:
//   npm i --no-save sharp
//   node scripts/optimize-images.mjs <sourceDir> <industry>
// Each <sourceDir>/<name>.(jpg|jpeg|png|webp) becomes
// public/sk/stock/<industry>/<name>.jpg and <name>-sm.jpg. Heroes are
// 1600x900/800x450; everything else 1200x750/600x375 (matches imgAttrs()).

import fs from 'node:fs';
import path from 'node:path';

const [srcDir, industry] = process.argv.slice(2);
if (!srcDir || !industry) {
  console.error('Usage: node scripts/optimize-images.mjs <sourceDir> <industry>');
  process.exit(1);
}

const { default: sharp } = await import('sharp');
const outDir = path.join('public', 'sk', 'stock', industry);
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(srcDir)) {
  if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
  const name = path.parse(file).name;
  const [w, h] = name === 'hero' ? [1600, 900] : [1200, 750];
  const src = path.join(srcDir, file);
  for (const [suffix, scale] of [['', 1], ['-sm', 0.5]]) {
    const dest = path.join(outDir, `${name}${suffix}.jpg`);
    await sharp(src)
      .resize(Math.round(w * scale), Math.round(h * scale), { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile(dest);
    console.log(`${dest} ${Math.round(fs.statSync(dest).size / 1024)}KB`);
  }
}
```

- [ ] **Step 4: Source 16 photos (free-license only)**

Download landscape photos from Unsplash (https://unsplash.com/license) or Pexels (https://www.pexels.com/license/). Both allow free commercial use without attribution. Pick photos with no visible company logos, readable signage, or recognizable faces. Save them into scratch folders with these exact base names:

| Folder | Files |
|---|---|
| `roofing/` | `hero`, `roof-replacement`, `roof-repair`, `storm-damage`, `gutters` |
| `hvac/` | `hero`, `ac-repair`, `furnace-repair`, `hvac-replacement`, `maintenance-plans` |
| `foundation/` | `hero`, `foundation-repair`, `basement-waterproofing`, `crawl-space`, `concrete-leveling` |
| `generic/` | `hero` |

Hero photos need darker or busy areas on the left, because the headline sits there over a dark gradient.

Record every photo in `docs/stock-credits.md` as a table with the columns `File | Source URL | Photographer | License`. This file is outside `public/`, so it isn't served.

If the executor can't download photos, stop here and ask Zohn to supply them. Don't substitute placeholders or AI-generated images of "real" jobs.

- [ ] **Step 5: Optimize**

```bash
npm i --no-save sharp
node scripts/optimize-images.mjs <scratch>/roofing roofing
node scripts/optimize-images.mjs <scratch>/hvac hvac
node scripts/optimize-images.mjs <scratch>/foundation foundation
node scripts/optimize-images.mjs <scratch>/generic generic
```

Expected: 32 files. Heroes should be around 120–250KB and the rest around 60–150KB. Then confirm `git status` does not list `node_modules/`, and that `package.json` is unchanged.

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: all PASS, including `stock.test.mjs`.

- [ ] **Step 7: Visual and Lighthouse check**

With the local dev server and seeded site from Task 11 running:

- Take Playwright screenshots of the demo home, a service page, and the contact page at 390×844 and 1024×768. Check for layout breaks, overlapping callbar/footer, and unreadable text in each of the 4 themes × light/dark (add `&theme=…&mode=dark` to the URL).
- Run Lighthouse (mobile) on `http://localhost:8788/demo/acme-roofing?t=<token>`. Target: Performance ≥ 95, Accessibility ≥ 95. The demo page is `noindex` on purpose, so Lighthouse SEO will flag that; for SEO ≥ 95, check the exported site instead: `node scripts/site.mjs export acme-roofing --origin https://acme.example` then `npx serve dist/acme-roofing` and run Lighthouse on it.
- Fix any regressions in `styles.mjs`/templates, re-run `node --test --test-update-snapshots test/render-pages.test.mjs`, and re-run `npm test`.

- [ ] **Step 8: Document Sitekit in README**

Append a `## Sitekit (client sites)` section to `README.md` covering:
- What it is: one content file per business → multi-page "Call Now" site; demo at `/demo/<slug>?t=`; live on the client's domain.
- One-time setup: `npx wrangler d1 execute portfolio-leads --remote --file ./schema-sitekit.sql`. `ADMIN_TOKEN` is already set. Optionally set `PORTFOLIO_HOSTS` if a studio domain is added later.
- Daily workflow commands, in order: `import` → edit `sites/<slug>.json` (write real city intros) → `push` → run the printed wrangler command → `pitch` (with `SK_MAILING_ADDRESS` set) → paste into Muse → `views` to see who opened their demo → `status <slug> meeting|won|lost` → `status <slug> live --domain example.com` plus adding the domain and `www.` as custom domains on the Pages project.
- Presenter mode: visit `/demo/presenter?key=<ADMIN_TOKEN>` once per device, use **Save this look**, then run `pull <slug>` to sync the file.
- `export <slug> --origin https://domain` for handing a client their site.
- Privacy: `sites/*.json` is gitignored because the repo is public, and D1 holds the content as a backup.
- Limits: 100 custom domains per project on Free and 250 on Pro (apex and `www` each count). Live pages are edge-cached for 5 minutes, so content pushes can take up to 5 minutes to appear on live domains.
- Outreach rules: use a separate outreach mailbox/domain, keep volume around 5–15 a day, and confirm Muse's terms allow commercial use.

- [ ] **Step 9: Commit**

```bash
git add scripts/optimize-images.mjs public/sk/stock docs/stock-credits.md test/stock.test.mjs README.md test/render-pages.test.mjs.snapshot sitekit/templates
git commit -m "Add optimized stock photo pack, stock coverage test, and Sitekit docs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Hand off deploy steps to Zohn (do not do these yourself)**

1. `git push` (deploys).
2. `npx wrangler d1 execute portfolio-leads --remote --file ./schema-sitekit.sql`
3. Verify `https://zohnwheelerportfolio.pages.dev/` → 200 and `/schema.sql` → 404.
4. `node scripts/site.mjs push acme-roofing`, run the printed command, then open the demo link on a phone and a tablet.
5. Visit `/demo/presenter?key=<ADMIN_TOKEN>` on the sales tablet.
