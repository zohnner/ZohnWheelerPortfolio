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
  ['zretrobuild', () => new Response('nope', { status: 503 })],
  ['wepicksharp.com', () => { throw timeoutError(); }],
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
  assert.deepEqual(body.projects.map((p) => [p.id, p.status]), [['sportstrata', 'online'], ['zretrobuild', 'down'], ['picksharp', 'sleeping']]);
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
