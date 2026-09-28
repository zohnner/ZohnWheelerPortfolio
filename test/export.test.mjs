import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('export writes every page as static HTML with no lead form', () => {
  execFileSync(process.execPath, ['scripts/site.mjs', 'export', 'acme-roofing', '--origin', 'https://acme.example'], { stdio: 'pipe' });
  const out = 'dist/acme-roofing';
  for (const f of ['index.html', 'contact/index.html', 'services/skylights/index.html', 'areas/blue-springs/index.html', 'sitemap.xml', 'robots.txt']) {
    assert.ok(fs.existsSync(`${out}/${f}`), f);
  }
  const contact = fs.readFileSync(`${out}/contact/index.html`, 'utf8');
  assert.doesNotMatch(contact, /<form/);
  assert.doesNotMatch(contact, /\/api\/lead/);
  const home = fs.readFileSync(`${out}/index.html`, 'utf8');
  assert.match(home, /<link rel="canonical" href="https:\/\/acme\.example\/">/);
  assert.doesNotMatch(home, /Preview built for/);
  assert.match(home, /href="\/services\/skylights"/);
});
