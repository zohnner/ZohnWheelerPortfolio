import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, extractPage, dropRepeatedLines, capText } from '../sitekit/scaffold/extract.mjs';
import { readFixture, normalPages, NORMAL_DIR } from './fixtures/scaffold/helpers.mjs';

test('decodeEntities handles named, decimal, and hex entities', () => {
  assert.equal(decodeEntities('Lee&#39;s &amp; Co &rsquo; &#x2014; &copy; &bogus;'), 'Lee\'s & Co ’ — © &bogus;');
});

test('extractPage keeps structure and drops scripts, styles, and comments', () => {
  const p = extractPage(readFixture(NORMAL_DIR, 'index.html'));
  assert.equal(p.title, "Summit Peak Roofing | Lee's Summit Roofers");
  const lines = p.text.split('\n');
  assert.ok(lines.includes('# Lee’s Summit’s Trusted Roofing Team'));
  assert.ok(lines.includes('- Services'));
  assert.ok(lines.includes('Proudly serving Lee’s Summit since 1998.'));
  assert.ok(lines.includes("412 SW Oldham Pkwy, Lee's Summit, MO 64081"));
  assert.doesNotMatch(p.text, /trackingPhone|913-555|font-family|Old promo/);
  assert.deepEqual(p.links.find((l) => l.href === '/services'), { href: '/services', text: 'Services' });
  assert.deepEqual(p.tels[0], { number: '+18165550142', text: '(816) 555-0142' });
});

test('extractPage collects mailto addresses without query strings', () => {
  const p = extractPage(readFixture(NORMAL_DIR, 'contact.html'));
  assert.deepEqual(p.mailtos, ['office@summitpeakroofing.example']);
  assert.ok(p.text.split('\n').includes('Hours: Mon–Fri 7am–6pm'));
});

test('extractPage marks h2 headings with ##', () => {
  const p = extractPage(readFixture(NORMAL_DIR, 'services.html'));
  assert.ok(p.text.split('\n').includes('## Seamless Gutters'));
});

test('a JavaScript-only shell yields almost no text', () => {
  const p = extractPage(readFixture('test/fixtures/scaffold/js-shell', 'index.html'));
  assert.equal(p.title, 'Loading…');
  assert.equal(p.text, '');
});

test('dropRepeatedLines keeps nav/footer on the homepage only', () => {
  const pages = dropRepeatedLines(normalPages());
  assert.match(pages[0].text, /Privacy Policy/);
  assert.match(pages[0].text, /412 SW Oldham Pkwy/);
  const about = pages.find((p) => p.path === '/about');
  assert.doesNotMatch(about.text, /Privacy Policy|- Home|412 SW Oldham/);
  assert.match(about.text, /license #RC-44821/);
});

test('dropRepeatedLines does nothing with fewer than 3 pages', () => {
  const pages = [{ path: '/', text: 'a\nb' }, { path: '/x', text: 'a\nc' }];
  assert.deepEqual(dropRepeatedLines(pages), pages);
});

test('capText limits total text length', () => {
  const pages = capText([{ path: '/', text: 'x'.repeat(8) }, { path: '/a', text: 'y'.repeat(8) }, { path: '/b', text: 'z' }], 10);
  assert.deepEqual(pages.map((p) => p.text), ['xxxxxxxx', 'yy', '']);
});
