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
