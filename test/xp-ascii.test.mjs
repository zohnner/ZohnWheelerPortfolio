import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luminance, toAscii, RAMP } from '../public/xp/ascii.js';

test('luminance converts RGBA to gray', () => {
  assert.deepEqual([...luminance([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255])], [255, 0, 76]);
});

test('toAscii maps dark to space and bright to dense characters', () => {
  const gray = [0, 0, 255, 255, 0, 0, 255, 255];
  assert.deepEqual(toAscii(gray, 4, 2, 2, ' @', 1), [' @']);
});

test('toAscii keeps aspect with the default 0.5 row factor', () => {
  const gray = new Array(8 * 8).fill(255);
  const lines = toAscii(gray, 8, 8, 4);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines, ['@@@@', '@@@@']);
  assert.equal(RAMP[RAMP.length - 1], '@');
});
