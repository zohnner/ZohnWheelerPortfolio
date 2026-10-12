import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecisions, normalizeId, onRequestGet } from '../functions/api/decisions.js';

const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
function memoryCache() {
  const store = new Map();
  return { async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; }, async put(req, res) { store.set(req.url, res.clone()); } };
}
beforeEach(() => { globalThis.caches = { default: memoryCache() }; });
afterEach(() => { globalThis.fetch = realFetch; globalThis.caches = realCaches; });

const MD = `# Decisions

Intro text that is not an entry.

## D-005 — Throttled-Network Verification Pass Required
**Status:** accepted
**Contributors:** Kael

**Decision:**
Run a **throttled** pass before every \`feature\` push.

---

## D-135 — NCAAF Scores was silently capped (missing \`groups=80\`)

**Status:** shipped (\`js/ncaaf.js\`). Live-verified.
**Date:** 2026-09-03

**Trigger:** direct continuation of a planned session.

The scoreboard returned ~25 of up to 99 games because a param was missing.

## D-149 — Analytics instrumentation: dead token removed — 2026-09-10

**Trigger:** owner confirmed the dashboard toggle is ON.

**Decision — remove the dead snippet, don't fix its token.** It recorded zero events.
`;

test('parseDecisions reads id, title, status, date and a clean excerpt in file order', () => {
  const d = parseDecisions(MD);
  assert.deepEqual(d.map((e) => e.id), ['D-005', 'D-135', 'D-149']);
  assert.equal(d[0].title, 'Throttled-Network Verification Pass Required');
  assert.equal(d[0].status, 'accepted');
  assert.equal(d[0].excerpt, 'Run a throttled pass before every feature push.');
  assert.equal(d[1].title, 'NCAAF Scores was silently capped (missing groups=80)');
  assert.equal(d[1].status, 'shipped (js/ncaaf.js). Live-verified.');
  assert.equal(d[1].date, '2026-09-03');
  assert.equal(d[1].excerpt, 'The scoreboard returned ~25 of up to 99 games because a param was missing.');
  assert.equal(d[2].title, 'Analytics instrumentation: dead token removed');
  assert.equal(d[2].date, '2026-09-10');
  assert.equal(d[2].status, null);
  assert.equal(d[2].excerpt, "Decision — remove the dead snippet, don't fix its token. It recorded zero events.");
});

test('excerpts are capped at a word boundary', () => {
  const long = `## D-001 — Long\n\n${'word '.repeat(200)}\n`;
  const [e] = parseDecisions(long);
  assert.ok(e.excerpt.length <= 361, String(e.excerpt.length));
  assert.ok(e.excerpt.endsWith('…'));
  assert.ok(!e.excerpt.includes('wor…'));
});

test('a status line carrying "| Date:" is split, and long statuses are capped', () => {
  const [a, b] = parseDecisions(`## D-175 — Win probability\n\n**Status:** shipping | Date: 2026-10-11\n\nBody.\n\n## D-176 — Long\n\n**Status:** ${'verified '.repeat(40)}\n\nBody.\n`);
  assert.equal(a.status, 'shipping');
  assert.equal(a.date, '2026-10-11');
  assert.ok(b.status.length <= 141, String(b.status.length));
  assert.ok(b.status.endsWith('…'));
});

test('excerpt prefers the decision, skips "Decision needed", and falls back to the trigger', () => {
  const [a, b] = parseDecisions(`## D-007 — Scorecard

**Decision needed:** whether to build it.

**Decision:** Proceed, phase-gated.

## D-033 — Rate limiting

**Trigger:** no rate limiting anywhere.
`);
  assert.equal(a.excerpt, 'Decision: Proceed, phase-gated.');
  assert.equal(b.excerpt, 'Trigger: no rate limiting anywhere.');
});

test('normalizeId accepts the forms a visitor types', () => {
  for (const raw of ['D-135', 'd-135', 'D135', '135', ' d 135 ']) assert.equal(normalizeId(raw), 'D-135', raw);
  assert.equal(normalizeId('7'), 'D-007');
  assert.equal(normalizeId('latest'), null);
  assert.equal(normalizeId(''), null);
});

const call = async (qs = '') => {
  const res = await onRequestGet({ request: new Request(`https://x/api/decisions${qs}`), env: {} });
  return { res, body: await res.json() };
};
const serve = (status = 200, body = MD) => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(body, { status }); };
  return calls;
};

test('GET lists the newest entries first without excerpts, and caches the parse', async () => {
  const calls = serve();
  const { res, body } = await call();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.total, 3);
  assert.deepEqual(body.recent.map((e) => e.id), ['D-149', 'D-135', 'D-005']);
  assert.equal(body.recent[0].excerpt, undefined);
  assert.match(body.source, /github\.com\/zohnner\/zohn-sports-stats\/blob\/main\/DECISIONS\.md$/);
  await call();
  assert.equal(calls.length, 1);
  assert.match(calls[0], /raw\.githubusercontent\.com\/zohnner\/zohn-sports-stats\/main\/DECISIONS\.md$/);
});

test('GET ?id= returns one full entry, or an honest miss', async () => {
  serve();
  const hit = await call('?id=135');
  assert.equal(hit.body.ok, true);
  assert.equal(hit.body.entry.id, 'D-135');
  assert.match(hit.body.entry.excerpt, /^The scoreboard returned/);
  const miss = await call('?id=999');
  assert.deepEqual({ ok: miss.body.ok, error: miss.body.error }, { ok: false, error: 'no such decision' });
});

test('an upstream failure is reported, not cached', async () => {
  const calls = serve(503, 'down');
  for (let i = 0; i < 2; i++) {
    const { res, body } = await call();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { ok: false, error: 'upstream unavailable' });
  }
  assert.equal(calls.length, 2);
});
