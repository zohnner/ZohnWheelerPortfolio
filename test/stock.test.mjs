import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRESETS } from '../sitekit/presets/index.mjs';

test('every preset stock image exists in both sizes', () => {
  const refs = new Set();
  for (const p of Object.values(PRESETS)) {
    refs.add(p.hero.image);
    for (const s of p.services) refs.add(s.image);
  }
  for (const ref of refs) {
    const base = `public/sk/stock/${ref.slice('stock:'.length)}`;
    assert.ok(fs.existsSync(base), base);
    assert.ok(fs.existsSync(base.replace(/\.jpg$/, '-sm.jpg')), base.replace(/\.jpg$/, '-sm.jpg'));
    assert.ok(fs.statSync(base).size < 350_000, `${base} is over 350KB — re-run the optimizer`);
  }
});
