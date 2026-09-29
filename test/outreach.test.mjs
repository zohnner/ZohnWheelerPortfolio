import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, slugify, normalizeIndustry, stubFromProspect, pitchText } from '../sitekit/admin.mjs';
import { validateContent } from '../sitekit/validate.mjs';

const CSV = '﻿name,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count\r\n'
  + '"Smith & Sons Roofing, LLC",Roofing,Lee\'s Summit,816-555-0142,,https://smithroof.example/contact,https://smithroof.example,4.7,88\r\n'
  + 'Cool Air Co,HVAC / Heating,Blue Springs,(816) 555-0199,hello@coolair.example,,,,\r\n'
  + '"Quote ""Test"" Plumbing",plumbing,Raymore,,,,,,\r\n\r\n';

test('parseCsv handles BOM, quotes, commas, escaped quotes, CRLF, and blank lines', () => {
  const rows = parseCsv(CSV);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].name, 'Smith & Sons Roofing, LLC');
  assert.equal(rows[0].contact_form_url, 'https://smithroof.example/contact');
  assert.equal(rows[1].email, 'hello@coolair.example');
  assert.equal(rows[2].name, 'Quote "Test" Plumbing');
});

test('slugify makes URL-safe slugs', () => {
  assert.equal(slugify('Smith & Sons Roofing, LLC'), 'smith-sons-roofing-llc');
  assert.equal(slugify("Lee's Summit"), 'lees-summit');
  assert.equal(slugify('  --Weird__Name!!  '), 'weird-name');
});

test('normalizeIndustry maps free text to presets without false matches', () => {
  assert.equal(normalizeIndustry('Roofing & Gutters'), 'roofing');
  assert.equal(normalizeIndustry('HVAC / Heating'), 'hvac');
  assert.equal(normalizeIndustry('Air Conditioning'), 'hvac');
  assert.equal(normalizeIndustry('Foundation Repair'), 'foundation');
  assert.equal(normalizeIndustry('Basement waterproofing'), 'foundation');
  assert.equal(normalizeIndustry('plumbing'), 'generic');
  assert.equal(normalizeIndustry(undefined), 'generic');
});

test('stubFromProspect builds a pushable stub from a Muse row', () => {
  const [row] = parseCsv(CSV);
  const stub = stubFromProspect(row);
  assert.equal(stub.industry, 'roofing');
  assert.equal(stub.business.name, 'Smith & Sons Roofing, LLC');
  assert.equal(stub.business.rating, 4.7);
  assert.equal(stub.business.reviewCount, 88);
  assert.deepEqual(stub.services.map((s) => s.slug), ['roof-replacement', 'roof-repair', 'storm-damage', 'gutters']);
  assert.deepEqual(stub.areas, [{ slug: 'lees-summit', name: "Lee's Summit", intro: '' }]);
  assert.deepEqual(stub.outreach, { contactFormUrl: 'https://smithroof.example/contact', currentSite: 'https://smithroof.example' });
  const { errors } = validateContent(stub, { slug: 'x', fileExists: () => true });
  assert.deepEqual(errors, []);
});

test('stubFromProspect leaves rating out when missing and flags missing phone via validation', () => {
  const stub = stubFromProspect(parseCsv(CSV)[2]);
  assert.equal(stub.business.rating, undefined);
  assert.equal(stub.industry, 'generic');
  const { errors } = validateContent(stub, { slug: 'x', fileExists: () => true });
  assert.ok(errors.includes('business.phone is required'));
  assert.ok(errors.includes('services must have at least one entry'));
});

const ADDRESS = '123 Example St, Lee’s Summit, MO 64063';

test('pitchText targets email when available and includes CAN-SPAM footer', () => {
  const stub = stubFromProspect(parseCsv(CSV)[1]);
  const { channel, text } = pitchText({ content: stub, link: 'https://x/demo/cool-air-co?t=1', mailingAddress: ADDRESS });
  assert.equal(channel, 'email');
  assert.match(text, /wait for my approval before sending/);
  assert.match(text, /How: Send an email to hello@coolair\.example\./);
  assert.match(text, /Subject: A new website preview for Cool Air Co/);
  assert.match(text, /https:\/\/x\/demo\/cool-air-co\?t=1/);
  assert.ok(text.includes(ADDRESS));
  assert.match(text, /won’t contact you again/);
});

test('pitchText falls back to the contact form, then to no-send', () => {
  const form = pitchText({ content: stubFromProspect(parseCsv(CSV)[0]), link: 'L', mailingAddress: ADDRESS });
  assert.equal(form.channel, 'form');
  assert.match(form.text, /Open https:\/\/smithroof\.example\/contact and submit their contact form/);
  assert.doesNotMatch(form.text, /Subject:/);
  const none = pitchText({ content: stubFromProspect(parseCsv(CSV)[2]), link: 'L', mailingAddress: ADDRESS });
  assert.equal(none.channel, 'none');
  assert.match(none.text, /don’t send anything through Muse/);
});

test('stubFromProspect maps google_maps_url and notes', () => {
  const stub = stubFromProspect({ name: 'Acme', industry: 'roofing', google_maps_url: 'https://maps.app.goo.gl/abc123', notes: 'Owner is Dana; does gutters too' });
  assert.equal(stub.business.googleMapsUrl, 'https://maps.app.goo.gl/abc123');
  assert.equal(stub.outreach.note, 'Owner is Dana; does gutters too');
  const bare = stubFromProspect({ name: 'Acme', industry: 'roofing' });
  assert.equal(bare.business.googleMapsUrl, undefined);
  assert.equal(bare.outreach.note, undefined);
});

test('pitchText refuses without a mailing address, including whitespace-only', () => {
  assert.throws(() => pitchText({ content: { business: {} }, link: 'L', mailingAddress: '' }), /SK_MAILING_ADDRESS/);
  assert.throws(() => pitchText({ content: { business: {} }, link: 'L', mailingAddress: '   \n\t  ' }), /SK_MAILING_ADDRESS/);
  assert.throws(() => pitchText({ content: { business: {} }, link: 'L', mailingAddress: undefined }), /SK_MAILING_ADDRESS/);
});
