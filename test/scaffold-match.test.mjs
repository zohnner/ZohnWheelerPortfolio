import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, words, wordsMatch, digits, phoneDigits, numbersIn, includesNorm, includesToken, quoteAround } from '../sitekit/scaffold/match.mjs';

test('norm folds case, quotes, dashes, and whitespace', () => {
  assert.equal(norm('  Lee’s  Summit — “Best” Roof\n'), 'lee\'s summit - "best" roof');
});

test('words drops apostrophes and punctuation', () => {
  assert.deepEqual(words("Lee’s Summit, MO 64063"), ['lees', 'summit', 'mo', '64063']);
  assert.deepEqual(words('Licensed & Insured'), ['licensed', 'insured']);
});

test('wordsMatch is plural- and case-tolerant but needs every word', () => {
  assert.equal(wordsMatch('Gutters', 'Seamless gutter installation'), true);
  assert.equal(wordsMatch('Roof Replacement', 'We handle roof replacements fast'), true);
  assert.equal(wordsMatch("Lee's Summit", 'city=Lee’s Summit'), true);
  assert.equal(wordsMatch('Roof Repair', 'Storm Damage Repair'), false);
  assert.equal(wordsMatch('', 'anything'), false);
});

test('wordsMatch requires an exact match for digit-only words but keeps prefix matching for alphabetic words', () => {
  assert.equal(wordsMatch('MO-123', 'License MO-12345'), false);
  assert.equal(wordsMatch('12 Main St', '1234 Main St'), false);
  assert.equal(wordsMatch('123 Main St', '123 Main Street'), true);
  assert.equal(wordsMatch('MO-12345', 'License MO-12345'), true);
});

test('digit and number helpers', () => {
  assert.equal(digits('(816) 555-0142'), '8165550142');
  assert.equal(phoneDigits('+1 816.555.0142'), '8165550142');
  assert.deepEqual(numbersIn('Rated 4.8 from 1,204 reviews since 2004'), [4.8, 1204, 2004]);
});

test('includesNorm compares normalized text', () => {
  assert.equal(includesNorm('Serving  Lee’s Summit since 2004.', "serving lee's summit since 2004"), true);
  assert.equal(includesNorm('abc', ''), false);
});

test('quoteAround returns a substring window around the match', () => {
  const line = `${'x'.repeat(300)} since 1998 ${'y'.repeat(300)}`;
  const q = quoteAround(line, 301, 10);
  assert.ok(line.includes(q));
  assert.ok(q.includes('since 1998'));
  assert.ok(q.length <= 200);
  assert.equal(quoteAround('  short line  ', 0, 0), 'short line');
});

test('quoteAround never starts or ends mid-word when it has to cut a long line', () => {
  const line = `${'x'.repeat(300)} since 1998 ${'y'.repeat(300)}`;
  const q = quoteAround(line, 301, 10);
  assert.equal(q, 'since 1998');
  const idx = line.indexOf(q);
  assert.ok(idx >= 0);
  const before = line[idx - 1];
  const after = line[idx + q.length];
  assert.ok(before === undefined || /\s/.test(before), `char before cut should be whitespace, got ${JSON.stringify(before)}`);
  assert.ok(after === undefined || /\s/.test(after), `char after cut should be whitespace, got ${JSON.stringify(after)}`);
});

test('includesToken finds boundary-respecting occurrences and rejects mid-token fragments', () => {
  assert.equal(includesToken('Call 8165550142 today', '555'), false);
  assert.equal(includesToken('info@acme.com', 'fo@acme.com'), false);
  assert.equal(includesToken('Rated 4.8 stars', '4.8'), true);
  assert.equal(includesToken('abc', ''), false);
});

test('includesToken skips a boundary check on the side where the needle edge is punctuation', () => {
  assert.equal(includesToken('Call(816) 555-0142.', '(816)'), true);
  assert.equal(includesToken('Serving Lee’s Summit since 2004.', 'since 2004.'), true);
});

test('includesToken checks every occurrence, not just the first', () => {
  assert.equal(includesToken('concatenate cat nap', 'cat'), true);
});
