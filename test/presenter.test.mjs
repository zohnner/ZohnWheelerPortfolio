import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESENTER_COOKIE, safeEqual, readCookie, presenterCookieValue, isPresenter, deviceFromUA } from '../sitekit/presenter.mjs';

test('presenterCookieValue is a deterministic 64-char hex HMAC', async () => {
  const a = await presenterCookieValue('secret');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await presenterCookieValue('secret'));
  assert.notEqual(a, await presenterCookieValue('other'));
});

test('isPresenter accepts only the matching cookie', async () => {
  const v = await presenterCookieValue('secret');
  assert.equal(await isPresenter(`foo=1; ${PRESENTER_COOKIE}=${v}`, 'secret'), true);
  assert.equal(await isPresenter(`${PRESENTER_COOKIE}=${v}`, 'different'), false);
  assert.equal(await isPresenter(`${PRESENTER_COOKIE}=nope`, 'secret'), false);
  assert.equal(await isPresenter(null, 'secret'), false);
  assert.equal(await isPresenter(`${PRESENTER_COOKIE}=${v}`, undefined), false);
});

test('readCookie finds values by exact name', () => {
  assert.equal(readCookie('a=1; b=2=3', 'b'), '2=3');
  assert.equal(readCookie('ab=1', 'a'), null);
  assert.equal(readCookie(undefined, 'a'), null);
});

test('safeEqual compares strings and never matches empty', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), false);
});

test('deviceFromUA buckets user agents', () => {
  assert.equal(deviceFromUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'), 'mobile');
  assert.equal(deviceFromUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36'), 'mobile');
  assert.equal(deviceFromUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
  assert.equal(deviceFromUA('Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36'), 'tablet');
  assert.equal(deviceFromUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
  assert.equal(deviceFromUA(null), 'desktop');
});
