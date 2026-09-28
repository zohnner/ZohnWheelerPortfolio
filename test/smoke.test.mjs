import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('static site lives in public/ and private files stay out of it', () => {
  for (const f of ['index.html', 'hire.html', 'dashboard.html', '_headers', '404.html']) {
    assert.ok(fs.existsSync(`public/${f}`), `public/${f} should exist`);
  }
  for (const f of ['schema.sql', 'schema-dashboard.sql', 'scripts', 'functions', 'sitekit', 'sites']) {
    assert.ok(!fs.existsSync(`public/${f}`), `public/${f} must not exist`);
  }
});

test('wrangler serves public/', () => {
  const cfg = fs.readFileSync('wrangler.jsonc', 'utf8');
  assert.match(cfg, /"pages_build_output_dir":\s*"public"/);
});
