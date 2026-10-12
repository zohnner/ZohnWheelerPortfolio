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
