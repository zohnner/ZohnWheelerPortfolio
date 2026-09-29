import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// These commands never touch D1 (no --remote/--local network calls), so they're
// safe to run as a subprocess, same pattern as export.test.mjs. console.warn
// goes to stderr, so stdout+stderr are combined for assertions below.
const run = (args) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return `${r.stdout}${r.stderr}`;
};

test('status <slug> live prints the effective lead recipient from the local content file', () => {
  const out = run(['scripts/site.mjs', 'status', 'acme-roofing', 'live', '--domain', 'acme-status-test.example']);
  assert.match(out, /Lead recipient once live: office@acmeroofing\.example/);
});

test('import skips a row whose name slugifies to an empty string', () => {
  const csvPath = path.join('sites', '.import-empty-slug-test.csv');
  const emptySlugPath = path.join('sites', '.json');
  fs.mkdirSync('sites', { recursive: true });
  fs.writeFileSync(csvPath, 'name,industry\n"!!!",Roofing\n');
  try {
    const out = run(['scripts/site.mjs', 'import', csvPath]);
    assert.match(out, /skipping "!!!" — slugifies to an empty string/);
    assert.ok(!fs.existsSync(emptySlugPath));
  } finally {
    fs.rmSync(csvPath, { force: true });
    fs.rmSync(emptySlugPath, { force: true });
  }
});
