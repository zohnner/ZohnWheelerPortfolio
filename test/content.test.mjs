import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../sitekit/presets/index.mjs';
import { resolveContent, resolveImage, imgAttrs } from '../sitekit/content.mjs';
import { ICONS } from '../sitekit/icons.mjs';
import { THEMES } from '../sitekit/themes.mjs';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECTION_NAMES = ['hero', 'trust', 'services', 'whyUs', 'gallery', 'reviews', 'areas', 'financing', 'faq', 'cta'];

test('every preset is complete and internally valid', () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), ['foundation', 'generic', 'hvac', 'roofing']);
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.equal(p.industry, name);
    for (const k of ['trade', 'schemaType']) assert.ok(p[k], `${name}.${k}`);
    assert.ok(Object.hasOwn(THEMES, p.theme.preset), `${name} theme`);
    assert.ok(p.hero.headline && p.hero.sub && p.hero.image && p.hero.cta, `${name} hero`);
    assert.ok(p.copy.ctaTitle, `${name} copy`);
    assert.equal(p.financing.enabled, false, `${name} financing must default off (it is a claim)`);
    assert.equal(p.banner.enabled, false, `${name} banner must default off`);
    for (const s of p.services) {
      assert.match(s.slug, SLUG);
      assert.ok(s.name && s.summary && s.body, `${name}/${s.slug}`);
      assert.ok(Object.hasOwn(ICONS, s.icon), `${name}/${s.slug} icon ${s.icon}`);
      assert.match(s.image, /^stock:[a-z]+\/[a-z0-9-]+\.jpg$/);
    }
    for (const w of p.whyUs) assert.ok(Object.hasOwn(ICONS, w.icon), `${name} whyUs icon`);
    for (const sec of p.sectionOrder) assert.ok(SECTION_NAMES.includes(sec), `${name} section ${sec}`);
    for (const k of ['reviews', 'gallery', 'trust', 'areas']) assert.equal(p[k], undefined, `${name} must not define ${k}`);
  }
});

test('resolveContent merges preset defaults under content overrides', () => {
  const c = resolveContent({
    industry: 'roofing',
    business: { name: 'X Roofing', phone: '8165550100' },
    hero: { headline: 'Custom headline' },
    services: [{ slug: 'roof-repair', name: 'Repairs' }, { slug: 'skylights', name: 'Skylights' }],
  });
  assert.equal(c.hero.headline, 'Custom headline');
  assert.equal(c.hero.image, 'stock:roofing/hero.jpg');
  assert.equal(c.services[0].name, 'Repairs');
  assert.equal(c.services[0].icon, 'tools');
  assert.ok(c.services[0].body.length > 50);
  assert.equal(c.services[1].icon, 'check');
  assert.equal(c.services[1].image, undefined);
  assert.equal(c.faq.length, PRESETS.roofing.faq.length);
  assert.equal(c.trade, 'Roofing');
  assert.equal(c.schemaType, 'RoofingContractor');
});

test('resolveContent never fills verifiable facts from presets', () => {
  const c = resolveContent({ industry: 'hvac', business: { name: 'X', phone: '8165550100' }, services: [{ slug: 'ac-repair', name: 'AC' }] });
  assert.deepEqual(c.reviews, []);
  assert.deepEqual(c.gallery, []);
  assert.deepEqual(c.trust, []);
  assert.deepEqual(c.areas, []);
});

test('resolveContent falls back to generic for unknown or prototype industries', () => {
  assert.equal(resolveContent({ industry: 'plumbing', business: {} }).industry, 'generic');
  assert.equal(resolveContent({ industry: '__proto__', business: {} }).industry, 'generic');
});

test('resolveImage maps stock, site, and https refs and rejects everything else', () => {
  assert.equal(resolveImage('stock:roofing/hero.jpg', 'acme'), '/sk/stock/roofing/hero.jpg');
  assert.equal(resolveImage('site:crew.jpg', 'acme'), '/sk/sites/acme/crew.jpg');
  assert.equal(resolveImage('https://cdn.example.com/a.jpg', 'acme'), 'https://cdn.example.com/a.jpg');
  assert.equal(resolveImage('http://x.com/a.jpg', 'acme'), null);
  assert.equal(resolveImage('javascript:alert(1)', 'acme'), null);
  assert.equal(resolveImage(undefined, 'acme'), null);
});

test('imgAttrs adds srcset for stock images only', () => {
  assert.equal(
    imgAttrs('stock:roofing/hero.jpg', 'acme', '100vw'),
    'src="/sk/stock/roofing/hero.jpg" srcset="/sk/stock/roofing/hero-sm.jpg 800w, /sk/stock/roofing/hero.jpg 1600w" sizes="100vw"'
  );
  assert.match(imgAttrs('stock:roofing/gutters.jpg', 'acme', '50vw'), /gutters-sm\.jpg 600w, \/sk\/stock\/roofing\/gutters\.jpg 1200w/);
  assert.equal(imgAttrs('https://cdn.example.com/a.jpg?x=1&y=2', 'acme', '50vw'), 'src="https://cdn.example.com/a.jpg?x=1&amp;y=2"');
  assert.equal(imgAttrs('nope', 'acme', '50vw'), null);
});
