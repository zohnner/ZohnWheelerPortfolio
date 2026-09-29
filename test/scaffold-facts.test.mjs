import { test } from 'node:test';
import assert from 'node:assert/strict';
import { museText, museFacts, findPhone, findEmail, findAddress, findFounded, findLicense, findServices, findTestimonials, extractFacts } from '../sitekit/scaffold/facts.mjs';
import { dropRepeatedLines } from '../sitekit/scaffold/extract.mjs';
import { getPreset } from '../sitekit/presets/index.mjs';
import { normalPages } from './fixtures/scaffold/helpers.mjs';

const pages = () => dropRepeatedLines(normalPages());
const stub = {
  business: { name: 'Summit Peak Roofing', phone: '816-555-0100', city: "Lee's Summit", rating: 4.8, reviewCount: 57, googleMapsUrl: 'https://maps.app.goo.gl/abc123' },
  industry: 'roofing',
  outreach: { currentSite: 'https://www.summitpeakroofing.example' },
};
const quoteIsInSource = (f, ps) => ps.find((p) => `site:${p.path}` === f.source).text.includes(f.quote);

test('museText renders the stub as key=value lines', () => {
  assert.equal(museText(stub), "name=Summit Peak Roofing\nphone=816-555-0100\ncity=Lee's Summit\ngoogle_rating=4.8\nreview_count=57\ngoogle_maps_url=https://maps.app.goo.gl/abc123\ncurrent_site=https://www.summitpeakroofing.example");
});

test('museFacts quote museText lines', () => {
  const f = museFacts(stub);
  assert.deepEqual(f.rating, { value: 4.8, source: 'muse', quote: 'google_rating=4.8' });
  assert.deepEqual(f.phone, { value: '816-555-0100', source: 'muse', quote: 'phone=816-555-0100' });
  for (const fact of Object.values(f)) assert.ok(museText(stub).split('\n').includes(fact.quote));
});

test('phone prefers tel: links and ignores script content', () => {
  const ps = pages();
  const f = findPhone(ps);
  assert.equal(f.value, '816-555-0142');
  assert.equal(f.source, 'site:/');
  assert.ok(quoteIsInSource(f, ps));
});

test('phone falls back to the most frequent number', () => {
  const f = findPhone([{ path: '/', text: 'Call 913-555-0001\nOr 816-555-0002\nText 816.555.0002' }]);
  assert.equal(f.value, '816-555-0002');
});

test('email prefers mailto addresses and skips image names', () => {
  const ps = pages();
  assert.equal(findEmail(ps).value, 'office@summitpeakroofing.example');
  assert.equal(findEmail(ps).source, 'site:/contact');
  assert.equal(findEmail([{ path: '/', text: 'logo@2x.png' }]), null);
});

test('address and city', () => {
  const ps = pages();
  const { address, city } = findAddress(ps);
  assert.equal(address.value, "412 SW Oldham Pkwy, Lee's Summit, MO 64081");
  assert.equal(city.value, "Lee's Summit");
  assert.ok(quoteIsInSource(address, ps));
  assert.equal(findAddress([{ path: '/', text: 'Call (816) 555-0142\n412 SW Oldham Pkwy, Lee\'s Summit, MO 64081' }]).address.value, "412 SW Oldham Pkwy, Lee's Summit, MO 64081");
  const split = findAddress([{ path: '/', text: '9 Main St\nRaymore, MO 64083' }]);
  assert.equal(split.address.value, '9 Main St, Raymore, MO 64083');
  assert.equal(split.city.value, 'Raymore');
});

test('founded year: phrase required, © lines and future years ignored', () => {
  const ps = pages();
  const f = findFounded(ps, 2026);
  assert.equal(f.value, 1998);
  assert.ok(quoteIsInSource(f, ps));
  assert.equal(findFounded([{ path: '/', text: '© 2024 Acme Roofing\nCopyright 2019, established 2019\nFamily owned since 2031\nWe did 2004 jobs' }], 2026), null);
  assert.equal(findFounded([{ path: '/', text: 'Est. 2004' }], 2026).value, 2004);
});

test('license numbers need a digit', () => {
  const ps = pages();
  const f = findLicense(ps);
  assert.equal(f.value, 'RC-44821');
  assert.equal(f.source, 'site:/about');
  assert.equal(findLicense([{ path: '/', text: 'Licensed & insured. License pending.' }]), null);
});

test('services matched against preset names', () => {
  const found = findServices(pages(), getPreset('roofing').services);
  assert.deepEqual(found.map((s) => s.slug).sort(), ['gutters', 'roof-repair', 'roof-replacement', 'storm-damage']);
  const gutters = found.find((s) => s.slug === 'gutters');
  assert.equal(gutters.value, 'Gutters');
  assert.equal(gutters.source, 'site:/services');
});

test('testimonials: quoted text ≥ 40 chars followed by a dash-name line, on review pages only', () => {
  const t = findTestimonials(pages());
  assert.deepEqual(t.map((x) => x.value.name), ['Jordan P.', 'Priya S.']);
  assert.equal(t[0].value.text, 'Summit Peak replaced our roof after the May hailstorm and the crew left the yard spotless.');
  assert.equal(t[0].source, 'site:/reviews');
  assert.equal(findTestimonials([{ path: '/', title: 'Home', text: '“Summit Peak replaced our roof after the May hailstorm, wow.”\n— Jordan P.' }]).length, 0);
});

test('extractFacts merges site facts over Muse facts', () => {
  const f = extractFacts({ pages: pages(), stub, presetServices: getPreset('roofing').services, year: 2026 });
  assert.equal(f.phone.value, '816-555-0142');
  assert.equal(f.phone.source, 'site:/');
  assert.equal(f.rating.source, 'muse');
  assert.equal(f.city.source, 'site:/');
  assert.equal(f.services.length, 4);
  assert.equal(f.testimonials.length, 2);
  const noSite = extractFacts({ pages: [], stub, presetServices: getPreset('roofing').services, year: 2026 });
  assert.equal(noSite.phone.source, 'muse');
  assert.equal(noSite.city.quote, "city=Lee's Summit");
  assert.deepEqual(noSite.services, []);
});
