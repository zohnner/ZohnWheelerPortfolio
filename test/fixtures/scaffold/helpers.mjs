// test/fixtures/scaffold/helpers.mjs
// Shared by the scaffold tests. Contains no tests itself (node --test runs
// it anyway and reports nothing). Never touches the network.
import fs from 'node:fs';
import path from 'node:path';
import { extractPage } from '../../../sitekit/scaffold/extract.mjs';

export const ORIGIN = 'https://www.summitpeakroofing.example';
export const NORMAL_DIR = 'test/fixtures/scaffold/normal';
export const NORMAL_ORDER = ['index.html', 'services.html', 'about.html', 'service-areas.html', 'reviews.html', 'contact.html'];

export const pathOf = (file) => (file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`);

export function readFixture(dir, file) {
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

export function normalPages() {
  return NORMAL_ORDER.map((f) => ({ path: pathOf(f), ...extractPage(readFixture(NORMAL_DIR, f)) }));
}

// Every file in `dir` becomes a route under `origin`: index.html → "/",
// foo.html → "/foo", robots.txt → "/robots.txt" (text/plain).
export function siteRoutes(dir, origin) {
  const routes = {};
  for (const f of fs.readdirSync(dir)) {
    const body = readFixture(dir, f);
    if (f === 'robots.txt') routes[`${origin}/robots.txt`] = { body, headers: { 'content-type': 'text/plain' } };
    else routes[`${origin}${pathOf(f)}`] = body;
  }
  return routes;
}

// routes: { [absoluteUrl]: htmlString | { status, headers, body } | Error }.
// Unknown URLs are 404s. Every requested URL is pushed onto `calls`.
export function fakeFetch(routes, calls = []) {
  return async (url) => {
    const key = String(url);
    calls.push(key);
    const r = Object.hasOwn(routes, key) ? routes[key] : undefined;
    if (r === undefined) return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
    if (r instanceof Error) throw r;
    if (typeof r === 'string') return new Response(r, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers ?? { 'content-type': 'text/html' } });
  };
}
