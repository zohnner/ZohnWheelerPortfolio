import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUA, memoryLine, memorySteps, formatPost } from '../public/xp/bios.js';

test('parseUA recognises common browsers and systems', () => {
  assert.deepEqual(parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'), { browser: 'Chrome 141', os: 'Windows' });
  assert.deepEqual(parseUA('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0'), { browser: 'Edge 141', os: 'Windows' });
  assert.deepEqual(parseUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0'), { browser: 'Firefox 131', os: 'macOS' });
  assert.deepEqual(parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), { browser: 'Safari 18', os: 'iOS' });
  assert.deepEqual(parseUA('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36'), { browser: 'Chrome 141', os: 'Android' });
  assert.deepEqual(parseUA(''), { browser: null, os: null });
});

test('memory count-up ends exactly on the total', () => {
  assert.deepEqual(memorySteps(8192, 4), [2048, 4096, 6144, 8192]);
  assert.equal(memoryLine(8192), 'Memory test: 8192 MB OK');
});

test('formatPost prints every known field', () => {
  assert.deepEqual(formatPost({
    memoryMB: 8192, cores: 8, gpu: 'ANGLE (NVIDIA GeForce RTX 3070)', screen: { w: 2560, h: 1440, dpr: 2 },
    browser: 'Chrome 141', os: 'Windows', locale: 'en-US', time: '22:41',
  }), [
    'ZW-BIOS v5.1  (c) Zohn Wheeler',
    'Memory test: 8192 MB OK',
    'CPU: 8 logical cores detected',
    'GPU: ANGLE (NVIDIA GeForce RTX 3070)',
    'Display: 2560x1440 @2x',
    'Browser: Chrome 141 on Windows',
    'Locale: en-US, 22:41 local',
    'Booting ZW-OS...',
  ]);
});

test('formatPost omits what the browser does not reveal and truncates long GPU names', () => {
  assert.deepEqual(formatPost({}), ['ZW-BIOS v5.1  (c) Zohn Wheeler', 'Booting ZW-OS...']);
  const lines = formatPost({ gpu: 'x'.repeat(80), browser: 'Firefox 131' });
  assert.equal(lines[1], `GPU: ${'x'.repeat(57)}...`);
  assert.equal(lines[2], 'Browser: Firefox 131');
});
