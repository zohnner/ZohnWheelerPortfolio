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
