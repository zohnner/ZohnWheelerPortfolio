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
