// test/scaffold-fetch.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStartUrl, sameHost, parseRobots, robotsRules, isAllowed, rankLinks, fetchSite, USER_AGENT } from '../sitekit/scaffold/fetchSite.mjs';
import { fakeFetch, siteRoutes, readFixture, ORIGIN, NORMAL_DIR } from './fixtures/scaffold/helpers.mjs';

const normal = () => siteRoutes(NORMAL_DIR, ORIGIN);

test('normalizeStartUrl upgrades http, adds a scheme, rejects others', () => {
  assert.equal(normalizeStartUrl('http://acme.example/x#top').href, 'https://acme.example/x');
  assert.equal(normalizeStartUrl('acme.example').href, 'https://acme.example/');
  assert.equal(normalizeStartUrl('ftp://acme.example'), null);
  assert.equal(normalizeStartUrl(''), null);
});

test('sameHost treats www and apex as the same host', () => {
  assert.equal(sameHost(new URL('https://www.a.example/'), new URL('https://a.example/x')), true);
  assert.equal(sameHost(new URL('https://a.example/'), new URL('https://b.example/')), false);
});

test('robots: SitekitBot group wins over *, wildcards and $ work', () => {
  const txt = 'User-agent: Googlebot\nDisallow: /g\n\nUser-agent: *\nDisallow: /tmp\n';
  assert.deepEqual(robotsRules(txt), ['/tmp']);
  assert.deepEqual(robotsRules('User-agent: SitekitBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n'), ['/']);
  assert.deepEqual(robotsRules(''), []);
  assert.equal(parseRobots('User-agent: a\nUser-agent: b\nDisallow: /x').get('b')[0], '/x');
  assert.equal(isAllowed('/tmp/file', ['/tmp']), false);
  assert.equal(isAllowed('/a.pdf', ['/*.pdf$']), false);
  assert.equal(isAllowed('/a.pdfx', ['/*.pdf$']), true);
  assert.equal(isAllowed('/about', []), true);
});

test('rankLinks keeps on-host keyword links in priority order', () => {
  const links = [
    { href: '/', text: 'Home' },
    { href: '/blog', text: 'Blog' },
    { href: '/reviews', text: 'Reviews' },
    { href: '/contact', text: 'Contact' },
    { href: '/service-areas', text: 'Service Areas' },
    { href: '/about', text: 'About Us' },
    { href: 'https://summitpeakroofing.example/services/', text: 'Services' },
    { href: 'https://www.facebook.com/x', text: 'Services on Facebook' },
    { href: '/flyer.pdf', text: 'Services flyer' },
    { href: '/gutter-guards', text: 'Gutter Guards' },
    { href: 'mailto:a@b.example', text: 'Contact' },
  ];
  assert.deepEqual(rankLinks(links, new URL(ORIGIN), ['Gutters']), ['/services', '/about', '/service-areas', '/contact', '/reviews', '/gutter-guards']);
});

test('fetchSite fetches the homepage plus ranked pages and skips the rest', async () => {
  const calls = [];
  const r = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch(normal(), calls) });
  assert.equal(r.blocked, null);
  assert.deepEqual(r.pages.map((p) => p.path), ['/', '/services', '/about', '/service-areas', '/contact', '/reviews']);
  assert.equal(calls[0], `${ORIGIN}/robots.txt`);
  assert.ok(!calls.some((u) => /blog|privacy|facebook/.test(u)));
  assert.ok(r.log.includes('/services: ok'));
});

test('fetchSite sends the SitekitBot user agent', async () => {
  let ua;
  const inner = fakeFetch(normal());
  await fetchSite(`${ORIGIN}/`, { fetch: (url, init) => { ua = init?.headers?.['user-agent']; return inner(url, init); } });
  assert.equal(ua, USER_AGENT);
});

test('fetchSite obeys a SitekitBot disallow for the whole site', async () => {
  const calls = [];
  const r = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch(siteRoutes('test/fixtures/scaffold/robots-disallow', ORIGIN), calls) });
  assert.equal(r.blocked, 'robots.txt');
  assert.deepEqual(r.pages, []);
  assert.deepEqual(calls, [`${ORIGIN}/robots.txt`]);
});

test('fetchSite skips individual disallowed pages', async () => {
  const routes = { ...normal(), [`${ORIGIN}/robots.txt`]: { body: 'User-agent: *\nDisallow: /about', headers: { 'content-type': 'text/plain' } } };
  const calls = [];
  const r = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch(routes, calls) });
  assert.ok(!calls.includes(`${ORIGIN}/about`));
  assert.ok(r.log.includes('/about: disallowed by robots.txt'));
});

test('fetchSite follows same-host redirects and blocks off-host ones', async () => {
  const apex = 'https://summitpeakroofing.example';
  const ok = await fetchSite(`${apex}/`, { fetch: fakeFetch({ ...normal(), [`${apex}/`]: { status: 301, headers: { location: `${ORIGIN}/` } } }) });
  assert.equal(ok.blocked, null);
  assert.equal(ok.pages[0].path, '/');
  assert.equal(ok.pages.length, 6);

  const off = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch({ [`${ORIGIN}/`]: { status: 302, headers: { location: 'https://evil.example/' } } }) });
  assert.match(off.blocked, /off-host redirect/);
});

test('fetchSite gives up after 3 redirects', async () => {
  const hop = (to) => ({ status: 302, headers: { location: to } });
  const routes = { [`${ORIGIN}/`]: hop('/a'), [`${ORIGIN}/a`]: hop('/b'), [`${ORIGIN}/b`]: hop('/c'), [`${ORIGIN}/c`]: hop('/d'), [`${ORIGIN}/d`]: '<p>never</p>' };
  const r = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch(routes) });
  assert.equal(r.blocked, 'too many redirects');
});

test('fetchSite caps extra pages at 6', async () => {
  const links = Array.from({ length: 9 }, (_, i) => `<a href="/services-${i}">Service ${i}</a>`).join('');
  const routes = { [`${ORIGIN}/`]: `<html><body>${links}</body></html>` };
  for (let i = 0; i < 9; i++) routes[`${ORIGIN}/services-${i}`] = `<p>page ${i}</p>`;
  const calls = [];
  const r = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch(routes, calls) });
  assert.equal(r.pages.length, 7);
  assert.equal(calls.length, 8); // robots + home + 6
});

test('fetchSite skips non-HTML, oversized, failed, and timed-out pages', async () => {
  const timeout = new Error('timed out');
  timeout.name = 'TimeoutError';
  const routes = {
    ...normal(),
    [`${ORIGIN}/about`]: { body: '%PDF', headers: { 'content-type': 'application/pdf' } },
    [`${ORIGIN}/services`]: { body: '<p>x</p>', headers: { 'content-type': 'text/html', 'content-length': '2000000' } },
    [`${ORIGIN}/contact`]: { status: 500, body: 'oops' },
    [`${ORIGIN}/reviews`]: timeout,
  };
  const r = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch(routes) });
  assert.deepEqual(r.pages.map((p) => p.path), ['/', '/service-areas']);
  assert.ok(r.log.some((l) => l.startsWith('/about: not HTML')));
  assert.ok(r.log.includes('/services: larger than 1.5MB'));
  assert.ok(r.log.includes('/contact: HTTP 500'));
  assert.ok(r.log.includes('/reviews: timeout'));
});

test('fetchSite reports an unreachable homepage as blocked', async () => {
  const r = await fetchSite(`${ORIGIN}/`, { fetch: fakeFetch({}) });
  assert.equal(r.blocked, 'HTTP 404');
  const bad = await fetchSite('ftp://x.example', { fetch: fakeFetch({}) });
  assert.equal(bad.blocked, 'invalid URL');
});

test('fixture sanity: the js-shell page is fetchable HTML', () => {
  assert.match(readFixture('test/fixtures/scaffold/js-shell', 'index.html'), /id="root"/);
});
