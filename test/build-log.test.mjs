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
