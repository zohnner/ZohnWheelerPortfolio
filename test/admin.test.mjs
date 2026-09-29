import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlString, pushSql, normalizeDomain, statusSql, pitchStatusSql, STATUSES } from '../sitekit/admin.mjs';

test('sqlString quotes and escapes', () => {
  assert.equal(sqlString("Lee's"), "'Lee''s'");
  assert.equal(sqlString(null), 'NULL');
  assert.equal(sqlString(undefined), 'NULL');
  assert.equal(sqlString(5), "'5'");
});

test('pushSql is a single-statement upsert that preserves token and status', () => {
  const sql = pushSql({ id: 'id1', slug: 'acme', token: 'tok', content: { business: { name: "O'Neil", email: 'a@b.co' } }, now: '2026-09-28T00:00:00.000Z' });
  assert.match(sql, /^INSERT INTO sites \(id, slug, template, status, demo_token, content_json, contact_email, updated_at, created_at\)/);
  assert.match(sql, /VALUES \('id1', 'acme', 'call-now', 'demo', 'tok', '\{"business":\{"name":"O''Neil","email":"a@b\.co"\}\}', 'a@b\.co', /);
  assert.match(sql, /ON CONFLICT\(slug\) DO UPDATE SET/);
  assert.match(sql, /status = CASE WHEN sites\.status = 'prospect' THEN 'demo' ELSE sites\.status END/);
  assert.doesNotMatch(sql, /demo_token = excluded/);
  assert.equal((sql.match(/;/g) || []).length, 1, 'exactly one statement');
});

test('pushSql makes the content file\'s business.email authoritative on every push, not just the first', () => {
  const sql = pushSql({ id: 'id1', slug: 'acme', token: 'tok', content: { business: { name: 'Acme', email: 'new@acme.co' } }, now: 'N' });
  assert.match(sql, /contact_email = excluded\.contact_email/);
  assert.doesNotMatch(sql, /COALESCE\(sites\.contact_email/);
});

test('pushSql handles a missing business email', () => {
  assert.match(pushSql({ id: 'i', slug: 's', token: 't', content: { business: {} }, now: 'n' }), /'\{"business":\{\}\}', NULL, /);
});

test('normalizeDomain strips protocol, www, and paths', () => {
  assert.equal(normalizeDomain('https://www.AcmeRoofing.com/about'), 'acmeroofing.com');
  assert.equal(normalizeDomain('acme-roofing.co.uk'), 'acme-roofing.co.uk');
  assert.equal(normalizeDomain('not a domain'), null);
  assert.equal(normalizeDomain('localhost'), null);
});

test('pitchStatusSql only advances prospect/demo/pitched/viewed sites, never won/meeting/live/lost', () => {
  const sql = pitchStatusSql({ slug: 'acme', now: 'N' });
  assert.equal((sql.match(/;/g) || []).length, 1, 'exactly one statement');
  assert.equal(sql, "UPDATE sites SET status = 'pitched', updated_at = 'N' WHERE slug = 'acme' AND status IN ('prospect','demo','pitched','viewed');\n");
  assert.match(sql, /AND status IN \('prospect','demo','pitched','viewed'\)/);
});

test('statusSql updates status and optionally domain', () => {
  assert.equal(
    statusSql({ slug: 'acme', status: 'meeting', domain: null, now: 'N' }),
    "UPDATE sites SET status = 'meeting', updated_at = 'N' WHERE slug = 'acme';\n"
  );
  assert.equal(
    statusSql({ slug: 'acme', status: 'live', domain: 'www.acme.com', now: 'N' }),
    "UPDATE sites SET status = 'live', domain = 'acme.com', updated_at = 'N' WHERE slug = 'acme';\n"
  );
  assert.throws(() => statusSql({ slug: 'a', status: 'bogus', now: 'N' }), /Unknown status/);
  assert.throws(() => statusSql({ slug: 'a', status: 'live', domain: 'nope', now: 'N' }), /Invalid domain/);
  assert.deepEqual(STATUSES, ['prospect', 'demo', 'pitched', 'viewed', 'meeting', 'won', 'lost', 'live']);
});
