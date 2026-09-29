// sitekit/scaffold/fetchSite.mjs
// Polite, bounded fetch of a small-business site: https only, same host,
// robots.txt respected, homepage + up to 6 keyword-ranked pages. `fetch` is
// injected so tests never touch the network.

import { extractPage } from './extract.mjs';
import { wordsMatch } from './match.mjs';

export const USER_AGENT = 'SitekitBot/1.0 (+https://zohnwheelerportfolio.pages.dev/hire.html)';
export const MAX_BYTES = 1.5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const EXTRA_PAGES = 6;

export function normalizeStartUrl(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol === 'http:') u.protocol = 'https:';
  if (u.protocol !== 'https:') return null;
  u.hash = '';
  return u;
}

const bareHost = (h) => h.toLowerCase().replace(/^www\./, '');

export function sameHost(a, b) {
  return bareHost(a.hostname) === bareHost(b.hostname);
}

export function parseRobots(txt) {
  const groups = new Map();
  let agents = [];
  let lastWasAgent = false;
  for (const raw of String(txt ?? '').split(/\r?\n/)) {
    const m = raw.replace(/#.*/, '').trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) agents = [];
      agents.push(val.toLowerCase());
      if (!groups.has(val.toLowerCase())) groups.set(val.toLowerCase(), []);
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (key === 'disallow' && val) for (const a of agents) groups.get(a).push(val);
    }
  }
  return groups;
}

export function robotsRules(txt) {
  const groups = parseRobots(txt);
  return groups.get('sitekitbot') ?? groups.get('*') ?? [];
}

const ruleRe = (rule) => new RegExp(`^${rule.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`);

export function isAllowed(pathWithSearch, rules) {
  return !rules.some((r) => ruleRe(r).test(pathWithSearch));
}

// First matching group wins, so "/service-areas" is an area page, not a
// services page.
const RANK = [
  [/area|location|cities|communit/, 8],
  [/about|our-story|story|company|who-we-are/, 9],
  [/servic/, 10],
  [/contact/, 7],
  [/review|testimonial/, 6],
];

export function linkScore({ path, text }, serviceNames = []) {
  const hay = `${path} ${text}`.toLowerCase();
  for (const [re, score] of RANK) if (re.test(hay)) return score;
  return serviceNames.some((n) => wordsMatch(n, text)) ? 5 : 0;
}

// Collapses runs of slashes (e.g. the pathname "//evil.example/x" that a
// link like "https://home-host//evil.example/x" or "/.//evil.example/x"
// yields) down to a single leading slash. Without this, a later
// `new URL(p, home.url)` would treat a path starting with "//" as a
// network-path reference and re-target a different host entirely.
const pathKey = (p) => p.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';

export function rankLinks(links, base, serviceNames = []) {
  const best = new Map();
  for (const l of links) {
    let u;
    try { u = new URL(l.href, base); } catch { continue; }
    if (!['https:', 'http:'].includes(u.protocol) || !sameHost(u, base)) continue;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i.test(u.pathname)) continue;
    const p = pathKey(u.pathname);
    if (p === '/') continue;
    const s = linkScore({ path: p, text: l.text }, serviceNames);
    if (s > 0 && s > (best.get(p) ?? 0)) best.set(p, s);
  }
  return [...best]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([p]) => p);
}

const init = (extra = {}) => ({ headers: { 'user-agent': USER_AGENT, accept: 'text/html' }, signal: AbortSignal.timeout(TIMEOUT_MS), ...extra });

async function fetchPage(url, origin, fetchFn) {
  // Belt and suspenders: whatever constructed `url`, never fetch off-host.
  if (!sameHost(url, origin)) return { error: 'off-host URL' };
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await fetchFn(current.href, init({ redirect: 'manual' }));
    } catch (err) {
      return { error: err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : `fetch failed (${err?.cause?.code || err?.message || 'error'})` };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { error: `redirect without location (${res.status})` };
      let next;
      try { next = new URL(loc, current); } catch { return { error: 'bad redirect' }; }
      if (next.protocol === 'http:') next.protocol = 'https:';
      if (next.protocol !== 'https:' || !sameHost(next, origin)) return { error: `off-host redirect to ${next.host}` };
      current = next;
      continue;
    }
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') || '';
    if (!/^text\/html/i.test(type)) return { error: `not HTML (${type || 'no content-type'})` };
    if (Number(res.headers.get('content-length')) > MAX_BYTES) return { error: 'larger than 1.5MB' };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return { error: 'larger than 1.5MB' };
    return { url: current, html: buf.toString('utf8') };
  }
  return { error: 'too many redirects' };
}

export async function fetchSite(rawUrl, { fetch: fetchFn = globalThis.fetch, serviceNames = [] } = {}) {
  const start = normalizeStartUrl(rawUrl);
  if (!start) return { pages: [], log: [`invalid site URL: ${rawUrl}`], blocked: 'invalid URL' };
  const log = [];
  let rules = [];
  try {
    const r = await fetchFn(new URL('/robots.txt', start).href, init());
    if (r.ok) rules = robotsRules(await r.text());
  } catch { /* no reachable robots.txt means no restrictions */ }
  const allowed = (u) => isAllowed(u.pathname + u.search, rules);

  if (!allowed(start)) {
    log.push(`${start.pathname}: disallowed by robots.txt`);
    return { pages: [], log, blocked: 'robots.txt' };
  }
  const home = await fetchPage(start, start, fetchFn);
  if (home.error) {
    log.push(`${start.pathname}: ${home.error}`);
    return { pages: [], log, blocked: home.error };
  }
  log.push(`${home.url.pathname}: ok`);
  const pages = [{ path: home.url.pathname, html: home.html }];
  const seen = new Set([pathKey(home.url.pathname)]);
  let attempts = 0;
  for (const p of rankLinks(extractPage(home.html).links, home.url, serviceNames)) {
    if (attempts >= EXTRA_PAGES) break;
    if (seen.has(p)) continue;
    seen.add(p);
    // Build the URL by concatenating the fixed origin with the (now
    // single-slash) path string and reparsing, rather than resolving `p`
    // against home.url — a leading "//" in `p` would otherwise be read as
    // a network-path reference and silently swap in a different host.
    const u = new URL(home.url.origin + p);
    if (!allowed(u)) { log.push(`${p}: disallowed by robots.txt`); continue; }
    attempts++;
    const r = await fetchPage(u, home.url, fetchFn);
    if (r.error) { log.push(`${p}: ${r.error}`); continue; }
    const got = pathKey(r.url.pathname);
    if (got !== p && seen.has(got)) { log.push(`${p}: redirected to already-fetched ${got}`); continue; }
    seen.add(got);
    log.push(`${p}: ok`);
    pages.push({ path: r.url.pathname, html: r.html });
  }
  return { pages, log, blocked: null };
}
