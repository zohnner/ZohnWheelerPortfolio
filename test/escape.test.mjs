import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, safeUrl, md } from '../sitekit/escape.mjs';

test('esc escapes HTML-significant characters', () => {
  assert.equal(esc(`<a href="x">Tom's & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom&#39;s &amp; Jerry&#39;s&lt;/a&gt;');
});

test('esc stringifies non-strings and blanks null/undefined', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(42), '42');
});

test('safeUrl allows https, tel, mailto, root-relative, and hash links', () => {
  for (const u of ['https://a.com', 'tel:+18165550100', 'mailto:a@b.com', '/contact', '#faq']) {
    assert.equal(safeUrl(u), u);
  }
});

test('safeUrl rejects javascript:, data:, http:, and protocol-relative links', () => {
  for (const u of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'http://a.com', '//evil.com']) {
    assert.equal(safeUrl(u), '#');
  }
});

test('md renders paragraphs and bullet lists', () => {
  assert.equal(md('First para.\n\n- one\n- two'), '<p>First para.</p><ul><li>one</li><li>two</li></ul>');
});

test('md joins soft-wrapped lines into one paragraph', () => {
  assert.equal(md('line one\nline two'), '<p>line one line two</p>');
});

test('md renders bold, italic, and safe links', () => {
  assert.equal(
    md('**Big** *deal* [call](tel:+18165550100)'),
    '<p><strong>Big</strong> <em>deal</em> <a href="tel:+18165550100">call</a></p>'
  );
});

test('md escapes raw HTML and neutralizes unsafe links', () => {
  assert.equal(
    md('<script>x</script> [bad](javascript:void0)'),
    '<p>&lt;script&gt;x&lt;/script&gt; <a href="#">bad</a></p>'
  );
});

test('md of empty input is empty', () => {
  assert.equal(md(''), '');
  assert.equal(md(undefined), '');
});
