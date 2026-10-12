// Writes public/xp/buildlog.json: real numbers about how the immersive site
// was built, read from git. Run before a deploy, then commit the JSON:
//   node scripts/build-log.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PATHS = [
  'public/index.html', 'public/xp', 'public/classic', 'functions/api/status.js', 'functions/api/gitlog.js',
  'functions/api/scan.js', 'server', 'scripts/render-voice.mjs', 'scripts/build-log.mjs',
];
// The immersive site's first commit day. Older history on shared paths
// (public/index.html, public/classic) belongs to the previous homepage.
export const SINCE = '2026-10-11T00:00:00';
export const TEST_FILE =/^(xp-.*|status|gitlog|scan|github|build-log)\.test\.mjs$/;

export function summarize({ dates, trailers, shortstats, testSources }) {
  const sorted = dates.filter(Boolean).map((d) => d.slice(0, 10)).sort();
  const coAuthors = [...new Set(trailers.map((t) => t.replace(/<[^>]*>/, '').trim()).filter(Boolean))].sort();
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of shortstats) {
    filesChanged += Number(/(\d+) files? changed/.exec(line)?.[1] ?? 0);
    insertions += Number(/(\d+) insertions?/.exec(line)?.[1] ?? 0);
    deletions += Number(/(\d+) deletions?/.exec(line)?.[1] ?? 0);
  }
  const tests = testSources.reduce((n, src) => n + (src.match(/^\s*test\(/gm)?.length ?? 0), 0);
  return {
    commits: dates.length, firstDate: sorted[0] ?? null, lastDate: sorted.at(-1) ?? null,
    coAuthors, filesChanged, insertions, deletions, tests,
  };
}

function main() {
  const testFiles = readdirSync('test').filter((f) => TEST_FILE.test(f)).map((f) => `test/${f}`);
  const spec = ['--', ...PATHS, ...testFiles];
  const git = (args) => execFileSync('git', [...args, `--since=${SINCE}`, ...spec], { encoding: 'utf8' });
  const lines = (s) => s.split('\n').filter(Boolean);
  const log = summarize({
    dates: lines(git(['log', '--format=%aI'])),
    trailers: lines(git(['log', '--format=%(trailers:key=Co-Authored-By,valueonly)'])),
    shortstats: lines(git(['log', '--shortstat', '--format='])).filter((l) => l.includes('changed')),
    testSources: testFiles.map((f) => readFileSync(f, 'utf8')),
  });
  writeFileSync('public/xp/buildlog.json', `${JSON.stringify(log, null, 2)}\n`);
  console.log(log);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
