// test/scaffold-cli.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Every test runs against a throwaway SK_SITES_DIR, so real prospect files
// and today's real review page are never touched. No network: the stubs
// used here have no website.
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sk-sites-'));
const run = (dir, args) => {
  const r = spawnSync(process.execPath, ['scripts/site.mjs', ...args], { encoding: 'utf8', env: { ...process.env, SK_SITES_DIR: dir } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const writeJson = (file, v) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(v, null, 2)); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('scaffold --no-ai on a no-site stub writes a brief, provenance, backup, and review page', () => {
  const dir = tmp();
  try {
    writeJson(path.join(dir, 'test-roofing.json'), {
      business: { name: 'Test Roofing', phone: '816-555-0100', city: 'Raymore' },
      industry: 'roofing',
      services: [{ slug: 'roof-repair', name: 'Roof Repair' }],
      areas: [{ slug: 'raymore', name: 'Raymore', intro: '' }],
      outreach: {},
    });
    const { code, out } = run(dir, ['scaffold', 'test-roofing', '--no-ai']);
    assert.equal(code, 0, out);
    assert.match(out, /test-roofing: brief no-site/);
    assert.match(out, /❌ blocked {2}test-roofing/); // no proven services
    for (const f of ['test-roofing.md', 'test-roofing.json', 'test-roofing.provenance.json']) assert.ok(fs.existsSync(path.join(dir, '.briefs', f)), f);
    assert.equal(fs.readdirSync(path.join(dir, '.bak')).filter((f) => f.startsWith('test-roofing.')).length >= 1, true);
    const reviews = fs.readdirSync(path.join(dir, '.review'));
    assert.equal(reviews.length, 1);
    assert.match(reviews[0], /^\d{4}-\d{2}-\d{2}\.html$/);
    const content = readJson(path.join(dir, 'test-roofing.json'));
    assert.equal(content.business.phone, '816-555-0100');
    assert.deepEqual(content.services, []);
    assert.equal(content.areas[0].name, 'Raymore');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold with no slugs skips stubs that already have a brief', () => {
  const dir = tmp();
  try {
    writeJson(path.join(dir, 'a-co.json'), { business: { name: 'A Co', phone: '816-555-0100' }, industry: 'roofing', outreach: {} });
    fs.mkdirSync(path.join(dir, '.briefs'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.briefs', 'a-co.md'), '# old');
    const { out } = run(dir, ['scaffold']);
    assert.match(out, /Nothing to scaffold/);
    const forced = run(dir, ['scaffold', '--force']);
    assert.match(forced.out, /a-co: brief no-site/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold --note is saved into the stub, backed up first', () => {
  const dir = tmp();
  try {
    writeJson(path.join(dir, 'b-co.json'), { business: { name: 'B Co', phone: '816-555-0100' }, industry: 'roofing', outreach: {} });
    const { code, out } = run(dir, ['scaffold', 'b-co', '--note', 'Services: roof repair, gutters']);
    assert.equal(code, 0, out);
    assert.equal(readJson(path.join(dir, 'b-co.json')).outreach.note, 'Services: roof repair, gutters');
    assert.equal(readJson(path.join(dir, '.briefs', 'b-co.json')).note, 'Services: roof repair, gutters');
    assert.ok(fs.readdirSync(path.join(dir, '.bak')).length >= 1);
    assert.match(out, /\/scaffold-sites/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold --url/--note need exactly one slug', () => {
  const dir = tmp();
  try {
    const { code, out } = run(dir, ['scaffold', 'a', 'b', '--url', 'https://x.example']);
    assert.equal(code, 1);
    assert.match(out, /--url and --note need exactly one slug/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold rejects an invalid explicit slug before doing any work', () => {
  const dir = tmp();
  try {
    const content = { business: { name: 'A Co', phone: '816-555-0100' }, industry: 'roofing', outreach: {} };
    writeJson(path.join(dir, 'a-co.json'), content);
    const { code, out } = run(dir, ['scaffold', 'a-co', 'BAD!SLUG', '--no-ai']);
    assert.equal(code, 1, out);
    assert.match(out, /Invalid slug\(s\): BAD!SLUG/);
    assert.ok(!fs.existsSync(path.join(dir, '.briefs')));
    assert.ok(!fs.existsSync(path.join(dir, '.review')));
    assert.ok(!fs.existsSync(path.join(dir, '.bak')));
    assert.deepEqual(readJson(path.join(dir, 'a-co.json')), content);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold-check rejects an invalid explicit slug before doing any work', () => {
  const dir = tmp();
  try {
    const content = { business: { name: 'A Co', phone: '816-555-0100' }, industry: 'roofing', outreach: {} };
    writeJson(path.join(dir, 'a-co.json'), content);
    const { code, out } = run(dir, ['scaffold-check', 'a-co', 'BAD!SLUG']);
    assert.equal(code, 1, out);
    assert.match(out, /Invalid slug\(s\): BAD!SLUG/);
    assert.ok(!fs.existsSync(path.join(dir, '.review')));
    assert.ok(!fs.existsSync(path.join(dir, '.bak')));
    assert.deepEqual(readJson(path.join(dir, 'a-co.json')), content);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold-check marks a proven file ready and leaves it untouched', () => {
  const dir = tmp();
  try {
    const content = { business: { name: 'Ready Co', phone: '816-555-0100' }, industry: 'roofing', services: [{ slug: 'roof-repair', name: 'Roof Repair' }] };
    writeJson(path.join(dir, 'ready-co.json'), content);
    writeJson(path.join(dir, '.briefs', 'ready-co.json'), {
      slug: 'ready-co', status: 'ok', stub: { business: { name: 'Ready Co', phone: '816-555-0100' } }, note: '',
      pages: [{ path: '/services', title: 'Services', text: '# Services\n- Roof repair and leak fixes' }], facts: {}, fetchLog: ['/services: ok'],
    });
    writeJson(path.join(dir, '.briefs', 'ready-co.provenance.json'), {
      'business.phone': { value: '816-555-0100', source: 'muse', quote: 'phone=816-555-0100' },
      'services[0]': { value: 'Roof Repair', source: 'site:/services', quote: 'Roof repair and leak fixes' },
    });
    const { code, out } = run(dir, ['scaffold-check']);
    assert.equal(code, 0, out);
    assert.match(out, /✅ ready {2}ready-co/);
    assert.match(out, /Review page: /);
    assert.ok(!fs.existsSync(path.join(dir, '.bak')));
    assert.deepEqual(readJson(path.join(dir, 'ready-co.json')), content);
    const html = fs.readFileSync(path.join(dir, '.review', fs.readdirSync(path.join(dir, '.review'))[0]), 'utf8');
    assert.match(html, /Ready Co/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold-check reports a malformed provenance file and keeps going', () => {
  const dir = tmp();
  try {
    writeJson(path.join(dir, 'bad-co.json'), { business: { name: 'Bad Co', phone: '816-555-0100' }, industry: 'roofing' });
    writeJson(path.join(dir, '.briefs', 'bad-co.json'), { slug: 'bad-co', status: 'ok', stub: {}, note: '', pages: [], facts: {}, fetchLog: [] });
    fs.writeFileSync(path.join(dir, '.briefs', 'bad-co.provenance.json'), '{nope');
    const { code, out } = run(dir, ['scaffold-check', 'bad-co']);
    assert.equal(code, 0, out);
    assert.match(out, /❌ blocked {2}bad-co — .*provenance file is not valid JSON/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('default scaffold only gathers stubs, always skips acme-roofing, and prints a skip line for filled files', () => {
  const dir = tmp();
  try {
    // A genuine untouched stub (no hero/reviews/trust, no area intros).
    writeJson(path.join(dir, 'a-stub.json'), { business: { name: 'A Stub', phone: '816-555-0100' }, industry: 'roofing', outreach: {} });
    // A finished client file — must never be re-gathered by a bare `scaffold`.
    writeJson(path.join(dir, 'b-filled.json'), {
      business: { name: 'B Filled', phone: '816-555-0100' },
      industry: 'roofing',
      hero: { headline: 'Welcome to B Filled' },
      outreach: {},
    });
    // acme-roofing is always skipped even though this one is a stub.
    writeJson(path.join(dir, 'acme-roofing.json'), { business: { name: 'Acme', phone: '816-555-0100' }, industry: 'roofing', outreach: {} });
    const { code, out } = run(dir, ['scaffold']);
    assert.equal(code, 0, out);
    assert.match(out, /a-stub: brief no-site/);
    assert.doesNotMatch(out, /b-filled: brief/);
    assert.doesNotMatch(out, /acme-roofing: brief/);
    assert.match(out, /skip b-filled \(not a stub — name it explicitly to re-gather\)/);
    assert.ok(fs.existsSync(path.join(dir, '.briefs', 'a-stub.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.briefs', 'b-filled.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.briefs', 'acme-roofing.md')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--no-ai refuses to overwrite a non-stub content file unless --force', () => {
  const dir = tmp();
  try {
    const filled = {
      business: { name: 'C Filled', phone: '816-555-0100' },
      industry: 'roofing',
      hero: { headline: 'Welcome to C Filled' },
      outreach: {},
    };
    writeJson(path.join(dir, 'c-filled.json'), filled);
    const refused = run(dir, ['scaffold', 'c-filled', '--no-ai']);
    assert.equal(refused.code, 0, refused.out);
    assert.match(refused.out, /c-filled: not a stub — --no-ai would overwrite a filled-in file; add --force to do it anyway/);
    assert.deepEqual(readJson(path.join(dir, 'c-filled.json')), filled);
    assert.ok(!fs.existsSync(path.join(dir, '.briefs', 'c-filled.md')));

    const forced = run(dir, ['scaffold', 'c-filled', '--no-ai', '--force']);
    assert.equal(forced.code, 0, forced.out);
    assert.match(forced.out, /c-filled: brief no-site/);
    assert.ok(fs.existsSync(path.join(dir, '.briefs', 'c-filled.md')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scaffold-check with no briefs says so', () => {
  const dir = tmp();
  try {
    const { code, out } = run(dir, ['scaffold-check']);
    assert.equal(code, 1);
    assert.match(out, /No briefs yet/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
