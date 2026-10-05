import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseCsvChecked } from '../sitekit/admin.mjs';

const HEADER = 'name,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count,google_maps_url,notes';

test('parseCsvChecked keeps well-formed rows and reports rows with the wrong field count', () => {
  const csv = [
    HEADER,
    'Good Roofing,roofing,Raymore,(816) 555-0101,,,,,,,"Notes, with a comma"',
    // One extra comma: rating/count/maps/notes would all shift a column.
    'Shifted Heating,hvac,Lee\'s Summit,(816) 555-0102,,,,,4.5,9,https://maps.app.goo.gl/x,notes',
    'Short Row,roofing,Belton',
  ].join('\r\n') + '\r\n';
  const { rows, bad } = parseCsvChecked(csv);
  assert.deepEqual(rows.map((r) => r.name), ['Good Roofing']);
  assert.equal(rows[0].notes, 'Notes, with a comma');
  assert.deepEqual(bad, [
    { row: 3, name: 'Shifted Heating', fields: 12, expected: 11 },
    { row: 4, name: 'Short Row', fields: 3, expected: 11 },
  ]);
});

test('parseCsvChecked handles a BOM, quoted newlines, and blank lines', () => {
  const csv = `﻿${HEADER}\n\nA Co,roofing,,(816) 555-0103,,,,,,,"line one\nline two"\n\n`;
  const { rows, bad } = parseCsvChecked(csv);
  assert.equal(bad.length, 0);
  assert.equal(rows[0].notes, 'line one\nline two');
});

// End to end against throwaway git repos: a bare "GitHub" remote and a clone
// standing in for ../sitekit-prospects. No network, no real prospect data.
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-inbox-'));
  const remote = path.join(root, 'remote.git');
  const repo = path.join(root, 'prospects');
  const sites = path.join(root, 'sites');
  git(root, 'init', '--bare', '-b', 'main', remote);
  git(root, 'clone', remote, repo);
  for (const [k, v] of [['user.name', 'Test'], ['user.email', 'test@example.com'], ['commit.gpgsign', 'false']]) git(repo, 'config', k, v);
  fs.mkdirSync(path.join(repo, 'inbox'));
  fs.mkdirSync(path.join(repo, 'done'));
  fs.writeFileSync(path.join(repo, 'inbox', '.gitkeep'), '');
  fs.writeFileSync(path.join(repo, 'done', '.gitkeep'), '');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-m', 'init');
  git(repo, 'push', '-u', 'origin', 'main');
  return { root, remote, repo, sites };
}

const runInbox = (env) => {
  const r = spawnSync(process.execPath, ['scripts/site.mjs', 'inbox'], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

test('inbox pulls a new batch, imports good rows, reports bad ones, and moves the file to done/', () => {
  const t = setup();
  try {
    // "Muse" commits a batch from a second clone, so inbox has to pull it.
    const muse = path.join(t.root, 'muse');
    git(t.root, 'clone', t.remote, muse);
    for (const [k, v] of [['user.name', 'Muse'], ['user.email', 'muse@example.com'], ['commit.gpgsign', 'false']]) git(muse, 'config', k, v);
    fs.writeFileSync(path.join(muse, 'inbox', 'prospects-2026-10-05.csv'), [
      HEADER,
      'Prairie Peak Roofing,roofing,Raymore,(816) 555-0142,,,,,,,',
      'Shifted Heating,hvac,Belton,(816) 555-0102,,,,,4.5,9,https://maps.app.goo.gl/x,notes',
    ].join('\n') + '\n');
    git(muse, 'add', '-A');
    git(muse, 'commit', '-m', 'Add prospect batch 2026-10-05');
    git(muse, 'push');

    const { code, out } = runInbox({ SK_SITES_DIR: t.sites, SK_PROSPECTS_DIR: t.repo });
    assert.equal(code, 0, out);
    assert.match(out, /prospects-2026-10-05\.csv: 1 new site/);
    assert.match(out, /row 3 "Shifted Heating" has 12 fields, expected 11/);
    assert.ok(fs.existsSync(path.join(t.sites, 'prairie-peak-roofing.json')));
    assert.ok(!fs.existsSync(path.join(t.sites, 'shifted-heating.json')));

    // The batch moved to done/ in a commit that reached the remote.
    assert.ok(!fs.existsSync(path.join(t.repo, 'inbox', 'prospects-2026-10-05.csv')));
    assert.ok(fs.existsSync(path.join(t.repo, 'done', 'prospects-2026-10-05.csv')));
    const remoteLog = git(t.root, '--git-dir', t.remote, 'log', '-1', '--format=%B', 'main');
    assert.match(remoteLog, /Import prospects-2026-10-05\.csv: 1 new site, 1 bad row/);
    assert.match(remoteLog, /Shifted Heating/);

    // A second run with nothing new is a quiet no-op.
    const again = runInbox({ SK_SITES_DIR: t.sites, SK_PROSPECTS_DIR: t.repo });
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /No new batches/);
  } finally {
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('inbox fails clearly when the prospects folder is not a git clone', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-inbox-nogit-'));
  try {
    const { code, out } = runInbox({ SK_SITES_DIR: path.join(dir, 'sites'), SK_PROSPECTS_DIR: dir });
    assert.notEqual(code, 0);
    assert.match(out, /not a git clone/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
