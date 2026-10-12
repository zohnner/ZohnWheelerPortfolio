import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, answer, editDistance, suggest } from '../public/xp/answers.js';
import { KB } from '../public/xp/content.js';

const kb = [
  { id: 'stack', keywords: ['stack', 'tech', 'language'], reply: 'stack reply' },
  { id: 'site', keywords: ['site', 'built'], reply: 'site reply' },
  { id: 'sitekit', keywords: ['site', 'build', 'business'], reply: 'sitekit reply' },
];

test('tokenize lowercases, drops stopwords and simple plurals', () => {
  assert.deepEqual(tokenize("What's Zohn's tech stack?"), ['tech', 'stack']);
  assert.deepEqual(tokenize('Languages and skills'), ['language', 'skill']);
  assert.deepEqual(tokenize('business status analysis'), ['business', 'status', 'analysis']);
  assert.deepEqual(tokenize('Does it run AWS?'), ['run', 'aws']);
  assert.deepEqual(tokenize(''), []);
});

test('answer picks the best-scoring entry', () => {
  assert.equal(answer("what's your tech stack", kb).id, 'stack');
  assert.equal(answer('how was this site built', kb).id, 'site');
  assert.equal(answer('can you build a site for my business', kb).id, 'sitekit');
  assert.deepEqual(answer('which languages', kb), { id: 'stack', reply: 'stack reply', score: 1 });
});

test('answer returns null below the threshold or for empty input', () => {
  assert.equal(answer('tell me about the weather', kb), null);
  assert.equal(answer('', kb), null);
  assert.equal(answer('stack', kb, { threshold: 2 }), null);
});

test('editDistance is Levenshtein', () => {
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('same', 'same'), 0);
});

test('suggest finds close commands, scaled to word length', () => {
  assert.equal(suggest('opne', ['open', 'cat']), 'open');
  assert.equal(suggest('opn', ['open', 'cat']), 'open');
  assert.equal(suggest('hisotry', ['history', 'help']), 'history');
  assert.equal(suggest('ct', ['cat']), null);
  assert.equal(suggest('xyzzy', ['open', 'help']), null);
  assert.equal(suggest('cta', ['cat']), null);
});

test('every content KB keyword survives tokenize unchanged', () => {
  for (const e of KB) for (const k of e.keywords) assert.deepEqual(tokenize(k), [k], `${e.id}: ${k}`);
});

test('content KB answers representative questions', () => {
  assert.equal(answer('what is your tech stack?', KB).id, 'stack');
  assert.equal(answer('does zohn have a security clearance', KB).id, 'clearance');
  assert.equal(answer('can you build a website for my roofing business', KB).id, 'sitekit');
  assert.equal(answer('how was this site built', KB).id, 'site');
  assert.equal(answer('where is zohn based', KB).id, 'location');
  assert.equal(answer('tell me about the baseball app', KB).id, 'sportstrata');
});
