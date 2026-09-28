import { resolveContent } from './content.mjs';
import { THEMES, isHex, resolveTheme } from './themes.mjs';
import { esc } from './escape.mjs';
import { layout } from './templates/call-now/layout.mjs';
import { PAGES } from './templates/call-now/pages.mjs';

// Only valid overrides are carried into links, so junk query params don't
// propagate across a demo.
function overrideParams(overrides) {
  const out = [];
  if (Object.hasOwn(THEMES, overrides.preset ?? '')) out.push(['theme', overrides.preset]);
  if (isHex(overrides.accent)) out.push(['accent', overrides.accent]);
  if (overrides.mode === 'light' || overrides.mode === 'dark') out.push(['mode', overrides.mode]);
  return out;
}

export function makeCtx({ content, slug, mode, token = '', origin = '', overrides = {}, presenter = false, year = new Date().getFullYear() }) {
  const c = resolveContent(content);
  const demo = mode === 'demo';
  const theme = resolveTheme(c.theme, demo ? overrides : {});
  const params = new URLSearchParams();
  if (demo && token) params.set('t', token);
  if (demo) for (const [k, v] of overrideParams(overrides)) params.set(k, v);
  const qs = params.toString();
  const href = (path = '/', hash = '') => {
    const p = demo ? `/demo/${slug}${path === '/' ? '' : path}` : path;
    return esc(`${p}${qs ? `?${qs}` : ''}${hash}`);
  };
  return { c, slug, mode, token, origin, theme, presenter, year, href };
}

export function renderPage(opts) {
  const type = opts.page?.type;
  if (!Object.hasOwn(PAGES, type ?? '')) return null;
  const ctx = makeCtx(opts);
  const page = PAGES[type](ctx, opts.page);
  return page ? layout(ctx, page) : null;
}

export function listPages(content) {
  return [
    { page: { type: 'home' }, path: '/' },
    ...(content.services || []).map((s) => ({ page: { type: 'service', slug: s.slug }, path: `/services/${s.slug}` })),
    ...(content.areas || []).map((a) => ({ page: { type: 'area', slug: a.slug }, path: `/areas/${a.slug}` })),
    { page: { type: 'contact' }, path: '/contact' },
  ];
}

export function renderSitemap({ content, origin }) {
  const urls = listPages(content).map((p) => `<url><loc>${esc(origin + p.path)}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export function renderRobots({ origin }) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
