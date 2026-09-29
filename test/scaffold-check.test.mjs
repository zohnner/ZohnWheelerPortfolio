import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factEntries, checkScaffold, copyWarnings, scaffoldStatus, runCheck, sourceText } from '../sitekit/scaffold/check.mjs';
import { gather, noAiContent } from '../sitekit/scaffold/brief.mjs';
import { fakeFetch, siteRoutes, ORIGIN, NORMAL_DIR } from './fixtures/scaffold/helpers.mjs';

const brief = (over = {}) => ({
  slug: 'acme',
  status: 'ok',
  stub: { business: { name: 'Acme Roofing', phone: '816-555-0100', city: "Lee's Summit", rating: 4.8, reviewCount: 112 } },
  note: 'Customer Pat K. said: "They fixed our leak the same afternoon we called."',
  pages: [
    { path: '/', title: 'Acme Roofing', text: 'Call 816.555.0142 today\nServing Lee’s Summit since 2004' },
    { path: '/services', title: 'Services', text: '## Gutters\nSeamless gutter installation\n## Skylights\nSkylight installs' },
  ],
  fetchLog: [],
  ...over,
});
const content = (over = {}) => ({
  business: { name: 'Acme Roofing', phone: '(816) 555-0142', founded: 2004, rating: 4.8, reviewCount: 112 },
  industry: 'roofing',
  services: [{ slug: 'gutters', name: 'Gutters' }],
  ...over,
});
const goodProv = () => ({
  'business.phone': { value: '816-555-0142', source: 'site:/', quote: 'Call 816.555.0142 today' },
  'business.founded': { value: 2004, source: 'site:/', quote: "Serving Lee's Summit since 2004" },
  'business.rating': { value: 4.8, source: 'muse', quote: 'google_rating=4.8' },
  'business.reviewCount': { value: 112, source: 'muse', quote: 'review_count=112' },
  'services[0]': { value: 'Gutters', source: 'site:/services', quote: 'Seamless gutter installation' },
});

test('factEntries lists facts and skips falsy scalars', () => {
  const paths = factEntries(content({ business: { name: 'A', phone: '1', emergency: false, hours: '' }, trust: ['Licensed'], financing: { enabled: true } })).map((f) => f.path);
  assert.deepEqual(paths, ['business.phone', 'trust[0]', 'services[0]', 'financing.enabled']);
});

test('good provenance is kept, with normalized phone and curly quotes', () => {
  const r = checkScaffold({ content: content(), provenance: goodProv(), brief: brief() });
  assert.deepEqual(r.dropped, []);
  assert.equal(r.facts.length, 5);
  assert.deepEqual(r.content, content());
});

test('fabricated quote, value-not-in-quote, and missing provenance are dropped', () => {
  const p = goodProv();
  p['business.founded'].quote = 'Serving since 1990';
  const c = content({ business: { ...content().business, license: 'MO-1234', city: "Lee's Summit" } });
  p['business.city'] = { value: 'Raymore', source: 'muse', quote: "city=Lee's Summit" };
  const r = checkScaffold({ content: { ...c, business: { ...c.business, founded: 2004 } }, provenance: p, brief: brief() });
  const reasons = Object.fromEntries(r.dropped.map((d) => [d.path, d.reason]));
  assert.equal(reasons['business.founded'], 'quote not found in site:/');
  assert.equal(reasons['business.license'], 'no provenance entry');
  assert.equal(reasons['business.city'], undefined); // content value is checked, not provenance.value
  assert.equal(r.content.business.founded, undefined);
  assert.equal(r.content.business.license, undefined);

  const p2 = goodProv();
  const r2 = checkScaffold({ content: content({ business: { ...content().business, founded: 2001 } }), provenance: p2, brief: brief() });
  assert.deepEqual(r2.dropped.map((d) => [d.path, d.reason]), [['business.founded', 'value does not appear in the quote']]);
});

test('reviews must come from the site or the note', () => {
  const c = content({ reviews: [
    { name: 'Dana R.', text: 'Best roofer in town, five stars all around!' },
    { name: 'Pat K.', text: 'They fixed our leak the same afternoon we called.' },
  ] });
  const p = {
    ...goodProv(),
    'reviews[0]': { value: 'x', source: 'muse', quote: 'google_rating=4.8' },
    'reviews[1]': { value: 'x', source: 'note', quote: 'Pat K. said: "They fixed our leak the same afternoon we called."' },
  };
  const r = checkScaffold({ content: c, provenance: p, brief: brief() });
  assert.deepEqual(r.dropped.map((d) => d.path), ['reviews[0]']);
  assert.match(r.dropped[0].reason, /own site or the note/);
  assert.deepEqual(r.content.reviews.map((x) => x.name), ['Pat K.']);
  assert.equal(r.provenance['reviews[0]'].source, 'note'); // re-indexed
  assert.ok(r.facts.some((f) => f.path === 'reviews[0]' && f.source === 'note'));
});

test('dropped array items re-index the remaining provenance', () => {
  const c = content({ services: [{ slug: 'roof-repair', name: 'Roof Repair' }, { slug: 'gutters', name: 'Gutters' }, { slug: 'skylights', name: 'Skylights' }] });
  const p = {
    ...goodProv(),
    'services[1]': { value: 'Gutters', source: 'site:/services', quote: 'Seamless gutter installation' },
    'services[2]': { value: 'Skylights', source: 'site:/services', quote: 'Skylight installs' },
  };
  delete p['services[0]'];
  const r = checkScaffold({ content: c, provenance: p, brief: brief() });
  assert.deepEqual(r.content.services.map((s) => s.slug), ['gutters', 'skylights']);
  assert.equal(r.provenance['services[0]'].value, 'Gutters');
  assert.equal(r.provenance['services[1]'].value, 'Skylights');
  assert.equal(r.provenance['services[2]'], undefined);
  // Re-running on the output is stable.
  const again = checkScaffold({ content: r.content, provenance: r.provenance, brief: brief() });
  assert.deepEqual(again.dropped, []);
});

test('fragment quotes and prefix matches are rejected, not kept', () => {
  const b = brief({ pages: [{ path: '/', title: 'Home', text: 'Reviews: 8165550142 people. License MO-12345 on file. 1234 Main St. Email info@acme.com.' }] });
  const cases = [
    { path: 'business.rating', content: { business: { rating: 5 } }, prov: { 'business.rating': { value: 5, source: 'site:/', quote: '5' } } },
    { path: 'business.reviewCount', content: { business: { reviewCount: 555 } }, prov: { 'business.reviewCount': { value: 555, source: 'site:/', quote: '555' } } },
    { path: 'business.license', content: { business: { license: 'MO-123' } }, prov: { 'business.license': { value: 'MO-123', source: 'site:/', quote: 'License MO-12345' } } },
    { path: 'business.address', content: { business: { address: '12 Main St' } }, prov: { 'business.address': { value: '12 Main St', source: 'site:/', quote: '1234 Main St' } } },
    { path: 'business.email', content: { business: { email: 'fo@acme.com' } }, prov: { 'business.email': { value: 'fo@acme.com', source: 'site:/', quote: 'info@acme.com' } } },
  ];
  for (const { path, content: c, prov } of cases) {
    const r = checkScaffold({ content: c, provenance: prov, brief: b });
    assert.deepEqual(r.dropped.map((d) => d.path), [path], `expected ${path} to be dropped (dropped: ${JSON.stringify(r.dropped)})`);
  }
});

test('number facts still need a worded quote, even against the original dot-delimited source', () => {
  // "555" and "5" sit between periods here, so they satisfy includesToken's
  // punctuation-boundary rule on their own — the numeric kind must reject
  // them on its own terms (no alphabetic word in the quote), not rely on
  // the quote-in-source check to catch every case.
  const b = brief({ pages: [{ path: '/', title: 'Home', text: 'Call 816.555.0142. License MO-12345. 1234 Main St. Email info@acme.com.' }] });
  const rating = checkScaffold({
    content: { business: { rating: 5 } },
    provenance: { 'business.rating': { value: 5, source: 'site:/', quote: '5' } },
    brief: b,
  });
  assert.equal(rating.dropped.length, 1);
  assert.equal(rating.dropped[0].path, 'business.rating');

  const reviewCount = checkScaffold({
    content: { business: { reviewCount: 555 } },
    provenance: { 'business.reviewCount': { value: 555, source: 'site:/', quote: '555' } },
    brief: b,
  });
  assert.equal(reviewCount.dropped.length, 1);
  assert.deepEqual(reviewCount.dropped[0], { path: 'business.reviewCount', value: 555, reason: 'value does not appear in the quote' });
});

test('a review rating must be confirmed by a number in its own quote', () => {
  const b = brief({ pages: [{ path: '/', title: 'Reviews', text: 'Great crew. - Pat K.\nFive stars overall, would recommend! 5 stars. - Sam R.' }] });
  const noRatingProof = checkScaffold({
    content: { reviews: [{ name: 'Pat K.', text: 'Great crew.', rating: 5 }] },
    provenance: { 'reviews[0]': { value: 'x', source: 'site:/', quote: 'Great crew. - Pat K.' } },
    brief: b,
  });
  assert.equal(noRatingProof.dropped.length, 1);
  assert.equal(noRatingProof.dropped[0].path, 'reviews[0]');

  const withRatingProof = checkScaffold({
    content: { reviews: [{ name: 'Sam R.', text: 'Five stars overall, would recommend!', rating: 5 }] },
    provenance: { 'reviews[0]': { value: 'x', source: 'site:/', quote: 'Five stars overall, would recommend! 5 stars. - Sam R.' } },
    brief: b,
  });
  assert.deepEqual(withRatingProof.dropped, []);
});

test('sourceText tolerates a non-array or null-holding brief.pages', () => {
  assert.equal(sourceText('site:/', { pages: [null] }), null);
  assert.equal(sourceText('site:/', { pages: 'x' }), null);
  assert.equal(sourceText('site:/', {}), null);
});

test('checkScaffold does not throw when brief.pages is malformed; the fact is just dropped', () => {
  const c = { business: { phone: '816-555-0142' } };
  const p = { 'business.phone': { value: '816-555-0142', source: 'site:/', quote: 'Call 816.555.0142 today' } };

  const b1 = brief({ pages: [null] });
  assert.doesNotThrow(() => checkScaffold({ content: c, provenance: p, brief: b1 }));
  assert.equal(checkScaffold({ content: c, provenance: p, brief: b1 }).dropped.length, 1);

  const b2 = brief({ pages: 'x' });
  assert.doesNotThrow(() => checkScaffold({ content: c, provenance: p, brief: b2 }));
  assert.equal(checkScaffold({ content: c, provenance: p, brief: b2 }).dropped.length, 1);
});

test('flags need a quote that says so', () => {
  const b = brief({ pages: [{ path: '/', title: 'x', text: '24/7 emergency tarping available.\nWe love roofs.' }] });
  const ok = checkScaffold({ content: { business: { emergency: true } }, provenance: { 'business.emergency': { value: true, source: 'site:/', quote: '24/7 emergency tarping available.' } }, brief: b });
  assert.deepEqual(ok.dropped, []);
  const bad = checkScaffold({ content: { business: { emergency: true } }, provenance: { 'business.emergency': { value: true, source: 'site:/', quote: 'We love roofs.' } }, brief: b });
  assert.equal(bad.dropped.length, 1);
});

test('copy scan warns on unbacked fact-like claims', () => {
  const c = content({
    hero: { headline: 'Serving Lee’s Summit since 1998', sub: 'The #1 roofer in town, rated 5 stars' },
    faq: [{ q: 'Are you licensed?', a: 'Yes, fully licensed and insured.' }],
    copy: { ctaText: 'Call 913-555-7777 for 10% off' },
  });
  const w = copyWarnings(c, []);
  for (const bit of ['"since"', '"1998"', '"#1"', '"5 stars"', '"licensed"', '"insured"', '"913-555-7777"', '"10%"']) {
    assert.ok(w.some((x) => x.includes(bit)), `expected a warning for ${bit}: ${w.join(' | ')}`);
  }
  assert.ok(w.every((x) => /^(hero|faq|copy)/.test(x)));
});

test('copy claims backed by kept facts are not warned', () => {
  const r = checkScaffold({
    content: content({ hero: { headline: 'Serving Lee’s Summit since 2004', sub: 'Call (816) 555-0142' } }),
    provenance: goodProv(),
    brief: brief(),
  });
  assert.deepEqual(r.warnings, []);
});

test('scaffoldStatus', () => {
  const v = (errors = [], warnings = []) => ({ errors, warnings });
  assert.equal(scaffoldStatus({ validation: v(['x']), dropped: [], warnings: [], briefStatus: 'ok' }), 'blocked');
  assert.equal(scaffoldStatus({ validation: v(), dropped: [{}], warnings: [], briefStatus: 'ok' }), 'needs-look');
  assert.equal(scaffoldStatus({ validation: v([], ['w']), dropped: [], warnings: [], briefStatus: 'ok' }), 'needs-look');
  assert.equal(scaffoldStatus({ validation: v(), dropped: [], warnings: [], briefStatus: 'no-site' }), 'needs-look');
  assert.equal(scaffoldStatus({ validation: v(), dropped: [], warnings: [], briefStatus: 'ok' }), 'ready');
});

test('runCheck: ready, missing brief, malformed provenance, missing content', () => {
  const texts = { slug: 'acme', contentText: JSON.stringify(content()), provenanceText: JSON.stringify(goodProv()), briefText: JSON.stringify(brief()), fileExists: () => true };
  const ok = runCheck(texts);
  assert.equal(ok.status, 'ready');
  assert.equal(ok.changed, false);
  assert.equal(ok.name, 'Acme Roofing');

  assert.match(runCheck({ ...texts, briefText: null }).error, /no brief/);
  const bad = runCheck({ ...texts, provenanceText: '{nope' });
  assert.equal(bad.status, 'blocked');
  assert.match(bad.error, /provenance file is not valid JSON/);
  assert.match(runCheck({ ...texts, provenanceText: '[]' }).error, /must be a JSON object/);
  assert.match(runCheck({ ...texts, contentText: null }).error, /no content file/);

  const noProv = runCheck({ ...texts, provenanceText: null });
  assert.equal(noProv.status, 'blocked'); // phone and services dropped → validation errors
  assert.equal(noProv.changed, true);
});

test('end to end: --no-ai on the normal fixture is valid with nothing dropped', async () => {
  const stub = {
    business: { name: 'Summit Peak Roofing', phone: '816-555-0100', city: "Lee's Summit", rating: 4.8, reviewCount: 57, googleMapsUrl: 'https://maps.app.goo.gl/abc123' },
    industry: 'roofing',
    theme: { preset: 'storm', mode: 'light' },
    services: [],
    areas: [{ slug: 'lees-summit', name: "Lee's Summit", intro: '' }],
    outreach: { currentSite: `${ORIGIN}/` },
  };
  const b = await gather({ slug: 'summit-peak-roofing', stub, fetch: fakeFetch(siteRoutes(NORMAL_DIR, ORIGIN)), now: new Date('2026-09-29T12:00:00Z') });
  const { content: c, provenance } = noAiContent(b);
  const r = runCheck({ slug: 'summit-peak-roofing', contentText: JSON.stringify(c), provenanceText: JSON.stringify(provenance), briefText: JSON.stringify(b), fileExists: () => true });
  assert.deepEqual(r.dropped, []);
  assert.deepEqual(r.validation.errors, []);
  assert.ok(['ready', 'needs-look'].includes(r.status), r.status);
});
