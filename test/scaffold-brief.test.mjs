// test/scaffold-brief.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { briefStatus, gather, renderBriefMd, noAiContent, isStub } from '../sitekit/scaffold/brief.mjs';
import { stubFromProspect } from '../sitekit/admin.mjs';
import { fakeFetch, siteRoutes, ORIGIN, NORMAL_DIR } from './fixtures/scaffold/helpers.mjs';

const stub = () => ({
  business: { name: 'Summit Peak Roofing', phone: '816-555-0100', city: "Lee's Summit", rating: 4.8, reviewCount: 57, googleMapsUrl: 'https://maps.app.goo.gl/abc123' },
  industry: 'roofing',
  theme: { preset: 'storm', mode: 'light' },
  services: [{ slug: 'roof-replacement', name: 'Roof Replacement' }],
  areas: [{ slug: 'lees-summit', name: "Lee's Summit", intro: '' }],
  outreach: { currentSite: `${ORIGIN}/`, note: 'Owner Dana says they also do skylights.' },
});
const now = new Date('2026-09-29T12:00:00Z');
const normalBrief = () => gather({ slug: 'summit-peak-roofing', stub: stub(), fetch: fakeFetch(siteRoutes(NORMAL_DIR, ORIGIN)), now });

test('briefStatus', () => {
  assert.equal(briefStatus({ siteUrl: '', blocked: null, pages: [] }), 'no-site');
  assert.equal(briefStatus({ siteUrl: 'x', blocked: 'robots.txt', pages: [] }), 'blocked (robots.txt)');
  assert.equal(briefStatus({ siteUrl: 'x', blocked: null, pages: [{ text: 'short' }] }), 'partial (little text)');
  assert.equal(briefStatus({ siteUrl: 'x', blocked: null, pages: [{ text: 'x'.repeat(200) }] }), 'ok');
});

test('gather builds a brief from the normal site', async () => {
  const b = await normalBrief();
  assert.equal(b.status, 'ok');
  assert.equal(b.slug, 'summit-peak-roofing');
  assert.equal(b.generatedAt, '2026-09-29T12:00:00.000Z');
  assert.equal(b.note, 'Owner Dana says they also do skylights.');
  assert.deepEqual(b.pages.map((p) => p.path), ['/', '/services', '/about', '/service-areas', '/contact', '/reviews']);
  assert.deepEqual(Object.keys(b.pages[0]).sort(), ['path', 'text', 'title']);
  assert.equal(b.facts.phone.value, '816-555-0142');
  assert.equal(b.facts.testimonials.length, 2);
  assert.ok(b.fetchLog.includes('/services: ok'));
  assert.doesNotMatch(b.pages.find((p) => p.path === '/about').text, /Privacy Policy/);
});

test('gather: JS-only shell is partial, robots block is blocked, no URL is no-site', async () => {
  const shell = await gather({ slug: 's', stub: stub(), fetch: fakeFetch(siteRoutes('test/fixtures/scaffold/js-shell', ORIGIN)), now });
  assert.equal(shell.status, 'partial (little text)');
  const robots = await gather({ slug: 's', stub: stub(), fetch: fakeFetch(siteRoutes('test/fixtures/scaffold/robots-disallow', ORIGIN)), now });
  assert.equal(robots.status, 'blocked (robots.txt)');
  const s = stub();
  delete s.outreach.currentSite;
  const calls = [];
  const none = await gather({ slug: 's', stub: s, fetch: fakeFetch({}, calls), now });
  assert.equal(none.status, 'no-site');
  assert.deepEqual(calls, []);
  assert.equal(none.facts.phone.source, 'muse');
});

test('renderBriefMd shows stub, note, facts, log, and pages', async () => {
  const md = renderBriefMd(await normalBrief());
  assert.match(md, /^# Brief: Summit Peak Roofing \(summit-peak-roofing\)/);
  assert.match(md, /Status: ok/);
  assert.match(md, /## Stub \(source: muse\)\n\n```\nname=Summit Peak Roofing\nphone=816-555-0100/);
  assert.match(md, /## Note from Zohn \(source: note\)\n\nOwner Dana says they also do skylights\./);
  assert.match(md, /\| phone \| 816-555-0142 \| site:\/ \|/);
  assert.match(md, /\| testimonials\[0\] \| Jordan P\.: Summit Peak replaced/);
  assert.match(md, /- \/services: ok/);
  assert.match(md, /## site:\/services — Roofing Services \| Summit Peak Roofing\n\n# Our Services/);
});

test('noAiContent fills facts with provenance and keeps the stub’s other fields', async () => {
  const { content, provenance } = noAiContent(await normalBrief());
  assert.equal(content.business.phone, '816-555-0142');
  assert.equal(content.business.founded, 1998);
  assert.equal(content.business.license, 'RC-44821');
  assert.equal(content.business.name, 'Summit Peak Roofing');
  assert.deepEqual(content.theme, { preset: 'storm', mode: 'light' });
  assert.deepEqual(content.services.map((s) => s.slug).sort(), ['gutters', 'roof-repair', 'roof-replacement', 'storm-damage']);
  assert.deepEqual(content.reviews[0], { name: 'Jordan P.', text: 'Summit Peak replaced our roof after the May hailstorm and the crew left the yard spotless.' });
  assert.deepEqual(provenance['business.founded'], { value: 1998, source: 'site:/', quote: 'Proudly serving Lee’s Summit since 1998.' });
  assert.deepEqual(provenance['areas[0]'], { value: "Lee's Summit", source: 'muse', quote: "city=Lee's Summit" });
  assert.equal(provenance['reviews[1]'].source, 'site:/reviews');
  assert.equal(provenance['services[0]'].value, content.services[0].name);
  assert.equal(content.outreach.note, 'Owner Dana says they also do skylights.');
});

test('isStub: a fresh stubFromProspect() is a stub; a filled-in content file is not', () => {
  assert.equal(isStub(stubFromProspect({ name: 'A Co', industry: 'roofing', city: 'Raymore' })), true);
  const acme = JSON.parse(fs.readFileSync('test/fixtures/acme-roofing.json', 'utf8'));
  assert.equal(isStub(acme), false);
});

test('isStub checks hero, reviews, trust, and area intros independently', () => {
  const base = { business: { name: 'A Co' } };
  assert.equal(isStub(base), true);
  assert.equal(isStub({ ...base, hero: { headline: 'x' } }), false);
  assert.equal(isStub({ ...base, reviews: [{ name: 'A', text: 'x' }] }), false);
  assert.equal(isStub({ ...base, reviews: [] }), true);
  assert.equal(isStub({ ...base, trust: ['Licensed'] }), false);
  assert.equal(isStub({ ...base, trust: [] }), true);
  assert.equal(isStub({ ...base, areas: [{ name: 'Raymore', intro: '' }] }), true);
  assert.equal(isStub({ ...base, areas: [{ name: 'Raymore', intro: 'A whole paragraph about Raymore.' }] }), false);
  assert.equal(isStub(null), true);
  assert.equal(isStub({}), true);
});
