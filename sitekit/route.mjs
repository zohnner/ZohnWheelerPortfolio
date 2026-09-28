// Pure routing: (host, path, query) → what to serve. No I/O, so it's fully
// unit-tested; functions/_middleware.js acts on the descriptor.

const DEFAULT_HOSTS = ['zohnwheelerportfolio.pages.dev', 'localhost', '127.0.0.1'];
const PREVIEW_SUFFIX = '.zohnwheelerportfolio.pages.dev';
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

export function portfolioHostList(envValue) {
  const extra = String(envValue ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...DEFAULT_HOSTS, ...extra];
}

export function isPortfolioHost(host, list) {
  return list.includes(host) || host.endsWith(PREVIEW_SUFFIX);
}

export function parsePage(path) {
  const p = String(path ?? '').replace(/\/+$/, '') || '/';
  if (p === '/') return { type: 'home' };
  if (p === '/contact') return { type: 'contact' };
  let m = p.match(new RegExp(`^/services/(${SLUG})$`));
  if (m) return { type: 'service', slug: m[1] };
  m = p.match(new RegExp(`^/areas/(${SLUG})$`));
  if (m) return { type: 'area', slug: m[1] };
  return null;
}

function themeOverrides(sp) {
  const out = {};
  if (sp.get('theme')) out.preset = sp.get('theme');
  if (sp.get('accent')) out.accent = sp.get('accent');
  if (sp.get('mode')) out.mode = sp.get('mode');
  return out;
}

const DEMO = new RegExp(`^/demo/(${SLUG})(/.*)?$`);

export function routeRequest({ host, path, searchParams, portfolioHosts }) {
  const h = String(host ?? '').toLowerCase().replace(/:\d+$/, '');
  if (path.startsWith('/api/') || path.startsWith('/sk/')) return { kind: 'static' };

  if (isPortfolioHost(h, portfolioHosts)) {
    if (!/^\/demo(\/|$)/.test(path)) return { kind: 'static' };
    if (path === '/demo/presenter' || path === '/demo/presenter/') {
      return searchParams.has('key') ? { kind: 'presenter-login', key: searchParams.get('key') } : { kind: 'presenter-home' };
    }
    const m = path.match(DEMO);
    const page = m && parsePage(m[2] || '/');
    if (!page) return { kind: 'not-found' };
    return { kind: 'demo', slug: m[1], page, token: searchParams.get('t') || '', overrides: themeOverrides(searchParams) };
  }

  const domain = h.replace(/^www\./, '');
  if (path === '/sitemap.xml') return { kind: 'live', domain, page: { type: 'sitemap' } };
  if (path === '/robots.txt') return { kind: 'live', domain, page: { type: 'robots' } };
  const page = parsePage(path);
  return page ? { kind: 'live', domain, page } : { kind: 'not-found' };
}
