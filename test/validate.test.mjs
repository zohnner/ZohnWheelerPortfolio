import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateContent, similarity } from '../sitekit/validate.mjs';

const fixture = () => JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json', 'utf8'));
const opts = { slug: 'acme-roofing', fileExists: () => true };

test('the fixture is valid with no warnings', () => {
  assert.deepEqual(validateContent(fixture(), opts), { errors: [], warnings: [] });
});

test('required fields are enforced', () => {
  const r = validateContent({ business: {}, services: [] }, opts);
  assert.ok(r.errors.includes('business.name is required'));
  assert.ok(r.errors.includes('business.phone is required'));
  assert.ok(r.errors.includes('industry is required'));
  assert.ok(r.errors.includes('services must have at least one entry'));
});

test('non-object content is rejected', () => {
  assert.deepEqual(validateContent(null, opts).errors, ['content must be a JSON object']);
});

test('phone must have 10 digits (a leading 1 is allowed)', () => {
  const c = fixture();
  c.business.phone = '555-0100';
  assert.ok(validateContent(c, opts).errors.includes('business.phone must have 10 digits'));
  c.business.phone = '+1 (816) 555-0100';
  assert.deepEqual(validateContent(c, opts).errors, []);
});

test('unknown industry, theme preset, mode, and bad accent are errors', () => {
  const c = fixture();
  c.industry = 'plumbing';
  c.theme = { preset: 'neon', accent: 'orange', mode: 'sepia' };
  const { errors } = validateContent(c, opts);
  assert.ok(errors.some((e) => e.startsWith('industry "plumbing"')));
  assert.ok(errors.includes('theme.preset "neon" is not one of: storm, clean, bold, earth'));
  assert.ok(errors.includes('theme.accent must be #rrggbb'));
  assert.ok(errors.includes('theme.mode must be light or dark'));
});

test('service and area slugs must be valid and unique', () => {
  const c = fixture();
  c.services.push({ slug: 'Bad Slug', name: 'x' }, { slug: 'skylights', name: 'dupe' });
  c.areas[1].slug = 'lees-summit';
  const { errors } = validateContent(c, opts);
  assert.ok(errors.includes('services[3].slug must be lowercase-hyphenated'));
  assert.ok(errors.includes('duplicate services slug "skylights"'));
  assert.ok(errors.includes('duplicate areas slug "lees-summit"'));
});

test('reviews need a name, text, and 1-5 rating', () => {
  const c = fixture();
  c.reviews.push({ name: '', rating: 7, text: '' });
  const { errors } = validateContent(c, opts);
  assert.ok(errors.includes('reviews[2] needs name, text, and a rating from 1 to 5'));
});

test('image refs must resolve to existing files', () => {
  const c = fixture();
  c.hero = { image: 'stock:roofing/missing.jpg' };
  c.gallery = [{ before: 'site:b.jpg', after: 'ftp://x/a.jpg' }];
  const seen = [];
  const { errors } = validateContent(c, { slug: 'acme-roofing', fileExists: (p) => (seen.push(p), false) });
  assert.ok(seen.includes('public/sk/stock/roofing/missing.jpg'));
  assert.ok(seen.includes('public/sk/sites/acme-roofing/b.jpg'));
  assert.ok(errors.includes('hero.image: file not found (public/sk/stock/roofing/missing.jpg)'));
  assert.ok(errors.includes('gallery[0].after: use stock:, site:, or an https:// URL'));
});

test('path traversal in an image ref is rejected even when the file "exists"', () => {
  const c = fixture();
  c.hero = { image: 'stock:../../secret.jpg' };
  const { errors } = validateContent(c, { slug: 'acme-roofing', fileExists: () => true });
  assert.ok(errors.includes('hero.image: use stock:, site:, or an https:// URL'));
});

test('thin or near-duplicate area pages produce warnings, not errors', () => {
  const c = fixture();
  c.areas[0].intro = 'Short.';
  c.areas[1].intro = c.areas[0].intro;
  const { errors, warnings } = validateContent(c, opts);
  assert.deepEqual(errors, []);
  assert.ok(warnings.includes('areas[0] (lees-summit) intro is under 300 characters — thin city pages can hurt search ranking'));
  assert.ok(warnings.some((w) => w.includes('lees-summit and blue-springs intros are nearly identical')));
});

test('similarity is word-set Jaccard', () => {
  assert.equal(similarity('a b c', 'a b c'), 1);
  assert.equal(similarity('a b', 'c d'), 0);
  assert.equal(similarity('', 'a'), 0);
});
