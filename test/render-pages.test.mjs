import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPage, listPages, renderSitemap, renderRobots } from '../sitekit/render.mjs';

const fixture = () => JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json', 'utf8'));
const render = (page, over = {}) =>
  renderPage({ content: fixture(), slug: 'acme-roofing', page, mode: 'live', origin: 'https://acme.example', year: 2026, ...over });
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test('service page uses preset copy for preset slugs and custom copy otherwise', () => {
  const preset = render({ type: 'service', slug: 'roof-replacement' });
  assert.match(preset, /<h1>Roof Replacement<\/h1>/);
  assert.match(preset, /magnetic nail sweep/);
  assert.match(preset, /<title>Roof Replacement \| Acme Roofing<\/title>/);
  assert.match(preset, /<link rel="canonical" href="https:\/\/acme\.example\/services\/roof-replacement">/);
  const custom = render({ type: 'service', slug: 'skylights' });
  assert.match(custom, /We install <strong>new<\/strong> skylights/);
  assert.match(custom, /Other services/);
  assert.equal(ldBlocks(custom)[1]['@type'], 'Service');
});

test('unknown service or area returns null', () => {
  assert.equal(render({ type: 'service', slug: 'nope' }), null);
  assert.equal(render({ type: 'area', slug: 'nope' }), null);
});

test('area page has a city-specific title, intro, and service grid', () => {
  const html = render({ type: 'area', slug: 'blue-springs' });
  assert.match(html, /<h1>Roofing in Blue Springs<\/h1>/);
  assert.match(html, /1970s ranch homes/);
  assert.match(html, /Our services in Blue Springs/);
  assert.match(html, /href="\/services\/skylights"/);
});

test('contact page has a working lead form in live and demo modes', () => {
  const live = render({ type: 'contact' });
  assert.match(live, /<form class="form" id="lead-form"/);
  assert.match(live, /name="slug" value="acme-roofing"/);
  assert.match(live, /name="website"/);
  assert.match(live, /fetch\('\/api\/lead'/);
  const demo = render({ type: 'contact' }, { mode: 'demo', token: 'tok' });
  assert.match(demo, /name="t" value="tok"/);
});

test('export mode replaces the form with call/email buttons', () => {
  const html = render({ type: 'contact' }, { mode: 'export' });
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /\/api\/lead/);
  assert.match(html, /href="mailto:office@acmeroofing\.example"/);
  assert.match(html, /href="tel:\+18165550100"/);
});

test('listPages covers every page once', () => {
  assert.deepEqual(listPages(fixture()).map((p) => p.path), [
    '/', '/services/roof-replacement', '/services/storm-damage', '/services/skylights',
    '/areas/lees-summit', '/areas/blue-springs', '/contact',
  ]);
});

test('every listed page renders', () => {
  for (const { page } of listPages(fixture())) assert.ok(render(page), JSON.stringify(page));
});

test('sitemap and robots', () => {
  const xml = renderSitemap({ content: fixture(), origin: 'https://acme.example' });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/acme\.example\/areas\/blue-springs<\/loc>/);
  assert.equal((xml.match(/<url>/g) || []).length, 7);
  assert.equal(renderRobots({ origin: 'https://acme.example' }), 'User-agent: *\nAllow: /\n\nSitemap: https://acme.example/sitemap.xml\n');
});

test('home page HTML snapshot', (t) => {
  t.assert.snapshot(render({ type: 'home' }));
});
