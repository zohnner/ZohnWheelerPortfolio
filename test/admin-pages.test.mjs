import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPresenterHome, renderUnavailable } from '../sitekit/admin-pages.mjs';

test('presenter home lists demo links and escapes names', () => {
  const html = renderPresenterHome([{ slug: 'acme', status: 'pitched', demo_token: 'tok', name: '<b>Acme</b>', updated_at: '2026-09-28T12:00:00Z' }]);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /href="\/demo\/acme\?t=tok"/);
  assert.match(html, /&lt;b&gt;Acme&lt;\/b&gt;/);
  assert.match(html, /pitched/);
  assert.match(html, /2026-09-28/);
});

test('presenter home explains the empty state', () => {
  assert.match(renderPresenterHome([]), /No demo sites yet/);
});

test('unavailable page is a complete HTML document', () => {
  assert.match(renderUnavailable(), /^<!doctype html>[\s\S]*temporarily unavailable/);
});
