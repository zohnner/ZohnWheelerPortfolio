import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLead } from '../sitekit/lead.mjs';

test('valid lead with phone only', () => {
  assert.deepEqual(parseLead({ slug: 'acme', name: ' Pat ', phone: '816-555-0101' }), {
    ok: true, lead: { slug: 'acme', token: '', name: 'Pat', phone: '816-555-0101', email: '', message: '' },
  });
});

test('honeypot short-circuits as spam', () => {
  assert.deepEqual(parseLead({ slug: 'acme', name: 'x', website: 'http://spam' }), { ok: true, spam: true });
});

test('rejects missing body, slug, name, or contact method', () => {
  assert.equal(parseLead(null).ok, false);
  assert.equal(parseLead({ name: 'Pat', phone: '1' }).error, 'Invalid request.');
  assert.equal(parseLead({ slug: 'acme', phone: '1' }).error, 'Please include your name.');
  assert.equal(parseLead({ slug: 'acme', name: 'Pat' }).error, 'Please include a phone number or email so we can reach you.');
});

test('rejects malformed email', () => {
  assert.equal(parseLead({ slug: 'acme', name: 'Pat', email: 'nope' }).error, 'That doesn’t look like a valid email address.');
});

test('truncates long fields and carries the demo token', () => {
  const r = parseLead({ slug: 'acme', t: 'tok', name: 'x'.repeat(500), email: 'a@b.co', message: 'm'.repeat(6000) });
  assert.equal(r.lead.name.length, 200);
  assert.equal(r.lead.message.length, 5000);
  assert.equal(r.lead.token, 'tok');
});
