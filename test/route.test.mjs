import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest, parsePage, portfolioHostList, isPortfolioHost } from '../sitekit/route.mjs';

const hosts = portfolioHostList('studio.example');
const r = (host, pathAndQuery) => {
  const u = new URL(`https://${host}${pathAndQuery}`);
  return routeRequest({ host, path: u.pathname, searchParams: u.searchParams, portfolioHosts: hosts });
};

test('portfolio hosts include defaults, env extras, and preview deploys', () => {
  assert.ok(hosts.includes('zohnwheelerportfolio.pages.dev'));
  assert.ok(hosts.includes('localhost'));
  assert.ok(hosts.includes('studio.example'));
  assert.ok(isPortfolioHost('abc123.zohnwheelerportfolio.pages.dev', hosts));
  assert.ok(!isPortfolioHost('acmeroofing.com', hosts));
});

test('parsePage recognizes the template pages only', () => {
  assert.deepEqual(parsePage('/'), { type: 'home' });
  assert.deepEqual(parsePage(''), { type: 'home' });
  assert.deepEqual(parsePage('/contact/'), { type: 'contact' });
  assert.deepEqual(parsePage('/services/roof-repair'), { type: 'service', slug: 'roof-repair' });
  assert.deepEqual(parsePage('/areas/blue-springs'), { type: 'area', slug: 'blue-springs' });
  assert.equal(parsePage('/services/'), null);
  assert.equal(parsePage('/hire.html'), null);
  assert.equal(parsePage('/services/Bad_Slug'), null);
});

test('portfolio host serves static files outside /demo', () => {
  assert.deepEqual(r('zohnwheelerportfolio.pages.dev', '/'), { kind: 'static' });
  assert.deepEqual(r('zohnwheelerportfolio.pages.dev', '/hire.html'), { kind: 'static' });
  assert.deepEqual(r('localhost:8788', '/demos-are-static.html'), { kind: 'static' });
});

test('/api and /sk pass through on every host', () => {
  assert.deepEqual(r('acmeroofing.com', '/api/lead'), { kind: 'static' });
  assert.deepEqual(r('acmeroofing.com', '/sk/stock/roofing/hero.jpg'), { kind: 'static' });
  assert.deepEqual(r('localhost', '/api/inquiry'), { kind: 'static' });
});

test('presenter login and home', () => {
  assert.deepEqual(r('localhost', '/demo/presenter?key=abc'), { kind: 'presenter-login', key: 'abc' });
  assert.deepEqual(r('localhost', '/demo/presenter'), { kind: 'presenter-home' });
  assert.deepEqual(r('localhost', '/demo/presenter/'), { kind: 'presenter-home' });
});

test('demo routes carry slug, page, token, and theme overrides', () => {
  assert.deepEqual(r('zohnwheelerportfolio.pages.dev', '/demo/acme-roofing?t=tok'), {
    kind: 'demo', slug: 'acme-roofing', page: { type: 'home' }, token: 'tok', overrides: {},
  });
  assert.deepEqual(r('localhost', '/demo/acme-roofing/services/roof-repair?t=tok&theme=bold&accent=%23123456&mode=dark'), {
    kind: 'demo', slug: 'acme-roofing', page: { type: 'service', slug: 'roof-repair' }, token: 'tok',
    overrides: { preset: 'bold', accent: '#123456', mode: 'dark' },
  });
  assert.deepEqual(r('localhost', '/demo/acme-roofing'), {
    kind: 'demo', slug: 'acme-roofing', page: { type: 'home' }, token: '', overrides: {},
  });
});

test('bad demo paths are not found', () => {
  assert.deepEqual(r('localhost', '/demo'), { kind: 'not-found' });
  assert.deepEqual(r('localhost', '/demo/'), { kind: 'not-found' });
  assert.deepEqual(r('localhost', '/demo/Acme'), { kind: 'not-found' });
  assert.deepEqual(r('localhost', '/demo/acme/hire.html'), { kind: 'not-found' });
});

test('client hosts route to live pages by apex domain, ignoring theme params', () => {
  assert.deepEqual(r('www.acmeroofing.com', '/?theme=bold'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'home' } });
  assert.deepEqual(r('acmeroofing.com', '/areas/blue-springs'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'area', slug: 'blue-springs' } });
  assert.deepEqual(r('acmeroofing.com', '/sitemap.xml'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'sitemap' } });
  assert.deepEqual(r('acmeroofing.com', '/robots.txt'), { kind: 'live', domain: 'acmeroofing.com', page: { type: 'robots' } });
});

test('client hosts never expose portfolio or demo paths', () => {
  assert.deepEqual(r('acmeroofing.com', '/hire.html'), { kind: 'not-found' });
  assert.deepEqual(r('acmeroofing.com', '/demo/acme-roofing'), { kind: 'not-found' });
});
