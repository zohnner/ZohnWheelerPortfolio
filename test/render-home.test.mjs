import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPage, makeCtx } from '../sitekit/render.mjs';

const fixture = () => JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json', 'utf8'));
const home = (over = {}) =>
  renderPage({ content: fixture(), slug: 'acme-roofing', page: { type: 'home' }, mode: 'live', origin: 'https://acme.example', year: 2026, ...over });

const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('home renders the core conversion elements', () => {
  const html = home();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Acme Roofing \| Roofing in Lee&#39;s Summit<\/title>/);
  assert.match(html, /href="tel:\+18165550100"/);
  assert.match(html, /Get a Free Estimate/);
  assert.match(html, /id="services"/);
  assert.match(html, /id="reviews"/);
  assert.match(html, /id="areas"/);
  assert.match(html, /id="faq"/);
  assert.match(html, /22\+ years in business/);
  assert.match(html, /Rated 4\.8 on Google Maps \(112 reviews\)/);
  assert.match(html, /Rated 4\.8 out of 5 on Google Maps \(112 reviews\)\./);
  assert.doesNotMatch(html, /See our reviews on Google Maps/);
  assert.match(html, /Hail damage\? Free 24\/7 storm inspections\./);
  assert.match(html, /class="callbar"/);
});

test('home JSON-LD parses and describes the business and FAQ', () => {
  const blocks = ldBlocks(home());
  assert.equal(blocks[0]['@type'], 'RoofingContractor');
  assert.equal(blocks[0].name, 'Acme Roofing');
  assert.equal(blocks[0].url, 'https://acme.example/');
  assert.deepEqual(blocks[0].areaServed, ["Lee's Summit", 'Blue Springs']);
  assert.equal(blocks[1]['@type'], 'FAQPage');
});

test('live mode has canonical and no demo ribbon or noindex', () => {
  const html = home();
  assert.match(html, /<link rel="canonical" href="https:\/\/acme\.example\/">/);
  assert.doesNotMatch(html, /Preview built for/);
  assert.doesNotMatch(html, /noindex/);
});

test('demo mode has ribbon, noindex, token links, and no canonical', () => {
  const html = home({ mode: 'demo', token: 'tok123' });
  assert.match(html, /Preview built for Acme Roofing/);
  assert.match(html, /href="\/hire\.html#contact-form"/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /href="\/demo\/acme-roofing\/services\/roof-replacement\?t=tok123"/);
  assert.match(html, /href="\/demo\/acme-roofing\/contact\?t=tok123"/);
  assert.doesNotMatch(html, /rel="canonical"/);
});

test('theme overrides apply in demo mode only and propagate to links', () => {
  const overrides = { preset: 'bold', accent: '#123456', mode: 'dark' };
  const demo = home({ mode: 'demo', token: 't', overrides });
  assert.match(demo, /--accent:#123456/);
  assert.match(demo, /href="\/demo\/acme-roofing\/contact\?t=t&amp;theme=bold&amp;accent=%23123456&amp;mode=dark"/);
  assert.doesNotMatch(home({ overrides }), /--accent:#123456/);
});

test('empty optional sections are omitted', () => {
  const c = fixture();
  c.reviews = [];
  c.areas = [];
  c.trust = [];
  delete c.business.founded;
  delete c.business.rating;
  delete c.business.license;
  c.banner = { enabled: false };
  const html = renderPage({ content: c, slug: 'x', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.doesNotMatch(html, /id="reviews"/);
  assert.doesNotMatch(html, /id="areas"/);
  assert.doesNotMatch(html, /class="trust"/);
  assert.doesNotMatch(html, /class="banner"/);
  assert.doesNotMatch(html, />Service Areas</);
});

test('content is escaped everywhere', () => {
  const c = fixture();
  c.business.name = '<script>alert(1)</script>';
  c.reviews[0].text = '<img src=x onerror=alert(1)>';
  const html = renderPage({ content: c, slug: 'x', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('presenter panel only renders for presenters', () => {
  assert.doesNotMatch(home({ mode: 'demo', token: 't' }), /sk-panel/);
  const html = home({ mode: 'demo', token: 't', presenter: true });
  assert.match(html, /class="sk-panel"/);
  assert.match(html, /Save this look/);
});

test('unknown page type returns null', () => {
  assert.equal(renderPage({ content: fixture(), slug: 'x', page: { type: 'nope' }, mode: 'live' }), null);
});

test('makeCtx.href builds demo and live URLs', () => {
  const demo = makeCtx({ content: fixture(), slug: 'acme-roofing', mode: 'demo', token: 'tok' });
  assert.equal(demo.href('/'), '/demo/acme-roofing?t=tok');
  assert.equal(demo.href('/', '#faq'), '/demo/acme-roofing?t=tok#faq');
  const live = makeCtx({ content: fixture(), slug: 'acme-roofing', mode: 'live' });
  assert.equal(live.href('/contact'), '/contact');
  const presenterNoToken = makeCtx({ content: fixture(), slug: 'acme-roofing', mode: 'demo' });
  assert.equal(presenterNoToken.href('/contact'), '/demo/acme-roofing/contact');
});

test('googleMapsUrl links the rating line and adds a reviews button', () => {
  const c = fixture();
  c.business.googleMapsUrl = 'https://maps.app.goo.gl/abc123';
  const html = renderPage({ content: c, slug: 'acme-roofing', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.match(html, /<a href="https:\/\/maps\.app\.goo\.gl\/abc123" rel="noopener">Rated 4\.8 on Google Maps \(112 reviews\)<\/a>/);
  assert.match(html, /<a class="btn btn-ghost" href="https:\/\/maps\.app\.goo\.gl\/abc123" rel="noopener">See our reviews on Google Maps<\/a>/);
});

test('with no site reviews, googleMapsUrl still gets a small reviews band', () => {
  const c = fixture();
  c.reviews = [];
  c.business.googleMapsUrl = 'https://maps.app.goo.gl/abc123';
  const html = renderPage({ content: c, slug: 'acme-roofing', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.match(html, /id="reviews"/);
  assert.match(html, /See our reviews on Google Maps/);
  assert.doesNotMatch(html, /class="reviews"/);
});

test('non-https googleMapsUrl never becomes a link', () => {
  const c = fixture();
  c.business.googleMapsUrl = 'javascript:alert(1)';
  const html = renderPage({ content: c, slug: 'acme-roofing', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.doesNotMatch(html, /javascript:alert/);
  assert.match(html, /href="#" rel="noopener">See our reviews on Google Maps/);
});

test('a review without a rating renders without stars', () => {
  const c = fixture();
  c.reviews = [{ name: 'Pat', text: 'Great work on our roof, would hire again.' }];
  const html = renderPage({ content: c, slug: 'acme-roofing', page: { type: 'home' }, mode: 'live', year: 2026 });
  assert.match(html, /Great work on our roof/);
  assert.doesNotMatch(html, /class="stars"/);
});

test('a service without a photo gets an icon panel in place of the image', () => {
  const html = home();
  // Skylights (custom, no image) still gets a media slot, so card rows line up.
  const card = html.match(/<a class="card"[^>]*services\/skylights[\s\S]*?<\/a>/)[0];
  assert.match(card, /class="card-media card-media-icon"/);
  assert.doesNotMatch(card, /<img/);
  // A preset service keeps its stock photo.
  const preset = html.match(/<a class="card"[^>]*services\/roof-replacement[\s\S]*?<\/a>/)[0];
  assert.match(preset, /<div class="card-media"><img /);
});
