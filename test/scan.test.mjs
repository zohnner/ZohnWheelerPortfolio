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
