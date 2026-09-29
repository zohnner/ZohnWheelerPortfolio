import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryLine, renderReview } from '../sitekit/scaffold/review.mjs';

const result = (over = {}) => ({
  slug: 'acme', name: 'Acme Roofing', status: 'ready', briefStatus: 'ok', fetchLog: ['/: ok'],
  facts: [{ path: 'business.phone', value: '816-555-0142', source: 'site:/', quote: 'Call 816.555.0142' }],
  dropped: [], warnings: [], validation: { errors: [], warnings: [] }, ...over,
});

test('summaryLine', () => {
  assert.equal(summaryLine(result()), '✅ ready  acme — brief ok, 1 facts, 0 dropped, 0 warnings');
  const bad = summaryLine(result({ status: 'blocked', error: 'no brief — run scaffold first', validation: { errors: ['x'], warnings: ['w'] } }));
  assert.equal(bad, '❌ blocked  acme — brief ok, 1 facts, 0 dropped, 1 warnings, 1 errors, no brief — run scaffold first');
});

test('renderReview summarizes and shows each card', () => {
  const html = renderReview({ date: '2026-09-29', results: [
    result(),
    result({ slug: 'bob', name: 'Bob HVAC', status: 'needs-look', dropped: [{ path: 'business.founded', value: 1990, reason: 'no provenance entry' }], warnings: ['hero.headline: "since" reads like a fact'] }),
    result({ slug: 'cy', name: 'Cy Co', status: 'blocked', error: 'no brief — run scaffold first', facts: [] }),
  ] });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /1 ready · 1 needs a look · 1 blocked/);
  assert.match(html, /business\.founded = 1990 — no provenance entry/);
  assert.match(html, /node scripts\/site\.mjs push acme/);
  assert.match(html, /node scripts\/site\.mjs push bob/);
  assert.doesNotMatch(html, /push cy/);
  assert.match(html, /&quot;since&quot; reads like a fact/);
});

test('renderReview escapes scraped text everywhere', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const html = renderReview({ date: '2026-09-29', results: [result({ name: evil, fetchLog: [evil], facts: [{ path: 'reviews[0]', value: { name: evil, text: evil }, source: 'site:/', quote: evil }], warnings: [evil] })] });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
