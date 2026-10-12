import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cleanStepName, gateSteps, onRequestGet } from '../functions/api/pipeline.js';

const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
function memoryCache() {
  const store = new Map();
  return { async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; }, async put(req, res) { store.set(req.url, res.clone()); } };
}
beforeEach(() => { globalThis.caches = { default: memoryCache() }; });
afterEach(() => { globalThis.fetch = realFetch; globalThis.caches = realCaches; });

const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const run = (over = {}) => ({
  id: 42, name: 'SportStrata CI', display_title: 'Fix the scoreboard\n\nbody', head_sha: 'f712e22abcdef',
  created_at: '2026-10-12T21:22:10Z', status: 'completed', conclusion: 'success', html_url: 'https://github.com/x/runs/42', ...over,
});
const STEPS = [
  { name: 'Set up job', conclusion: 'success' },
  { name: 'Run actions/checkout@v4', conclusion: 'success' },
  { name: 'BDL API key not hardcoded (deploy-check', conclusion: 'success' },
  { name: 'Unit tests (deploy-check #9)', conclusion: 'success' },
  { name: 'Theme contrast contract', conclusion: 'failure' },
  { name: 'Post Run actions/checkout@v4', conclusion: 'success' },
  { name: 'Complete job', conclusion: 'success' },
];

test('cleanStepName drops the deploy-check suffix, even when GitHub truncates it', () => {
  assert.equal(cleanStepName('BDL API key not hardcoded (deploy-check'), 'BDL API key not hardcoded');
  assert.equal(cleanStepName('Unit tests (deploy-check #9)'), 'Unit tests');
  assert.equal(cleanStepName('NFL home fields — all 32 researched'), 'NFL home fields — all 32 researched');
});

test('gateSteps keeps only the real gates, in order', () => {
  assert.deepEqual(gateSteps([{ steps: STEPS }]), [
    { name: 'BDL API key not hardcoded', conclusion: 'success' },
    { name: 'Unit tests', conclusion: 'success' },
    { name: 'Theme contrast contract', conclusion: 'failure' },
  ]);
});

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
  ['/actions/workflows/ci.yml/runs', () => json({ workflow_runs: [run()] })],
  ['/actions/runs/42/jobs', () => json({ jobs: [{ steps: STEPS }] })],
  ['/actions/workflows/contract-check.yml/runs', () => json({ workflow_runs: [run({ id: 7, name: 'Contract check', created_at: '2026-10-12T11:00:00Z', html_url: 'https://github.com/x/runs/7' })] })],
];
const call = async () => {
  const res = await onRequestGet({ request: new Request('https://x/api/pipeline'), env: {} });
  return { res, body: await res.json() };
};

test('GET returns the latest CI run with its gates and the contract monitor, cached', async () => {
  const f = routes(healthy());
  globalThis.fetch = f;
  const { res, body } = await call();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(
    { title: body.ci.title, sha7: body.ci.sha7, date: body.ci.date, conclusion: body.ci.conclusion, url: body.ci.url },
    { title: 'Fix the scoreboard', sha7: 'f712e22', date: '2026-10-12T21:22:10Z', conclusion: 'success', url: 'https://github.com/x/runs/42' },
  );
  assert.equal(body.ci.steps.length, 3);
  assert.deepEqual(body.monitor, { date: '2026-10-12T11:00:00Z', status: 'completed', conclusion: 'success', url: 'https://github.com/x/runs/7' });
  assert.match(body.repo, /^zohnner\/zohn-sports-stats$/);
  await call();
  assert.equal(f.calls.length, 3);
});

test('a missing contract monitor still returns the CI gates', async () => {
  globalThis.fetch = routes([...healthy().slice(0, 2), ['/actions/workflows/contract-check.yml/runs', () => json({ message: 'nope' }, 404)]]);
  const { body } = await call();
  assert.equal(body.ok, true);
  assert.equal(body.monitor, null);
});

test('a GitHub failure is honest and not cached', async () => {
  const f = routes([['/actions/workflows/ci.yml/runs', () => json({ message: 'rate limited' }, 403)]]);
  globalThis.fetch = f;
  for (let i = 0; i < 2; i++) assert.deepEqual((await call()).body, { ok: false, error: 'upstream unavailable' });
  assert.equal(f.calls.filter((u) => u.includes('/ci.yml/')).length, 2);
});
