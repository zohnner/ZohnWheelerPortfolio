import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, words, wordsMatch, digits, phoneDigits, numbersIn, includesNorm, quoteAround } from '../sitekit/scaffold/match.mjs';

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
