import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESENTER_COOKIE, safeEqual, readCookie, presenterCookieValue, isPresenter, deviceFromUA, isBot } from '../sitekit/presenter.mjs';

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

test('isBot passes real browsers through and flags scanners/previews/tools', () => {
  assert.equal(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'), false);
  assert.equal(isBot('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36'), false);
  assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'), false);
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'facebookexternalhit/1.1',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'WhatsApp/2.23.20 A',
    'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
    'Mozilla/5.0 (compatible; SkypeUriPreview; Preview) Chrome',
    'Mozilla/5.0 (Safe Links Crawler)',
    'Mimecast',
    'Proofpoint',
    'Barracuda Sentinel',
    'Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36',
    'curl/8.4.0',
    'Wget/1.21.4',
    'python-requests/2.31.0',
  ]) assert.equal(isBot(ua), true, ua);
  assert.equal(isBot(''), true);
  assert.equal(isBot(null), true);
  assert.equal(isBot(undefined), true);
});

test('deviceFromUA buckets user agents', () => {
  assert.equal(deviceFromUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'), 'mobile');
  assert.equal(deviceFromUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36'), 'mobile');
  assert.equal(deviceFromUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
  assert.equal(deviceFromUA('Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36'), 'tablet');
  assert.equal(deviceFromUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
  assert.equal(deviceFromUA(null), 'desktop');
});
