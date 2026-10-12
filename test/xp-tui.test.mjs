import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rule, bar, frame, table } from '../public/xp/tui.js';

test('rule repeats a character', () => {
  assert.equal(rule(4), '────');
  assert.equal(rule(3, '='), '===');
  assert.equal(rule(-2), '');
});

test('bar fills proportionally and clamps', () => {
  assert.equal(bar(0.5, 12), '[█████░░░░░]');
  assert.equal(bar(-1, 6), '[░░░░]');
  assert.equal(bar(2, 6), '[████]');
  assert.equal(bar(0.72, 14), '[█████████░░░]');
});

test('frame draws a titled box edge of exact width', () => {
  const { top, bottom } = frame('SportStrata', 24);
  assert.equal(top, `╔═[ SportStrata ]${'═'.repeat(6)}╗`);
  assert.equal([...top].length, 24);
  assert.equal(bottom, `╚${'═'.repeat(22)}╝`);
});

test('table pads columns', () => {
  assert.deepEqual(table(['A', 'BB'], [['xyz', '1'], ['q', '22']]), ['A    BB', 'xyz  1', 'q    22']);
});
