// Sitekit entry point. Routes every request: portfolio host → static files
// (unchanged); /demo/<slug>?t= → token-gated demo; any other host → a live
// client site looked up by domain. See sitekit/route.mjs for the rules.

import { routeRequest, portfolioHostList } from '../sitekit/route.mjs';
import { renderPage, renderSitemap, renderRobots } from '../sitekit/render.mjs';
import { renderPresenterHome, renderUnavailable } from '../sitekit/admin-pages.mjs';
import { isPresenter, presenterCookieValue, PRESENTER_COOKIE, deviceFromUA, safeEqual, isBot } from '../sitekit/presenter.mjs';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
// Browsers always revalidate; the edge cache keeps a copy for 5 minutes.
const LIVE_CACHE = 'public, max-age=0, s-maxage=300';

function respond(body, { status = 200, type = 'text/html; charset=utf-8', cache = 'no-store', extra = {} } = {}) {
  return new Response(body, { status, headers: { 'Content-Type': type, 'Cache-Control': cache, ...SECURITY_HEADERS, ...extra } });
}

const notFound = () => respond('Not found', { status: 404, type: 'text/plain; charset=utf-8' });

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const route = routeRequest({
    host: url.host,
    path: url.pathname,
    searchParams: url.searchParams,
    portfolioHosts: portfolioHostList(env.PORTFOLIO_HOSTS),
  });

  if (route.kind === 'static') return next();
  if (route.kind === 'not-found') return notFound();
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return respond('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8' });
  }

  try {
    if (route.kind === 'presenter-login') return await presenterLogin(route, env);
    if (route.kind === 'presenter-home') return await presenterHome(request, env);
    if (route.kind === 'demo') return await demo(context, route, url);
    if (route.kind === 'live') return await live(context, route);
    return notFound();
  } catch (err) {
    console.error('sitekit request failed', err);
    return respond(renderUnavailable(), { status: 503, extra: { 'Retry-After': '60' } });
  }
}

async function presenterLogin(route, env) {
  if (!env.ADMIN_TOKEN || !safeEqual(route.key, env.ADMIN_TOKEN)) return notFound();
  const value = await presenterCookieValue(env.ADMIN_TOKEN);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/demo/presenter',
      'Set-Cookie': `${PRESENTER_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
      'Cache-Control': 'no-store',
    },
  });
}

async function presenterHome(request, env) {
  if (!(await isPresenter(request.headers.get('cookie'), env.ADMIN_TOKEN))) return notFound();
  const { results } = await env.DB.prepare(
    `SELECT slug, status, demo_token, json_extract(content_json, '$.business.name') AS name, updated_at
     FROM sites WHERE status != 'lost' ORDER BY updated_at DESC LIMIT 200`
  ).all();
  return respond(renderPresenterHome(results), { extra: { 'X-Robots-Tag': 'noindex, nofollow' } });
}

async function demo(context, route, url) {
  const { request, env } = context;
  const site = await env.DB.prepare(`SELECT id, slug, status, demo_token, content_json FROM sites WHERE slug = ?`)
    .bind(route.slug)
    .first();
  if (!site || site.status === 'lost') return notFound();

  const presenter = await isPresenter(request.headers.get('cookie'), env.ADMIN_TOKEN);
  const tokenOk = safeEqual(route.token, site.demo_token);
  if (!tokenOk && !presenter) return notFound();

  const html = renderPage({
    content: JSON.parse(site.content_json),
    slug: site.slug,
    page: route.page,
    mode: 'demo',
    token: tokenOk ? route.token : '',
    origin: url.origin,
    overrides: route.overrides,
    presenter,
  });
  if (!html) return notFound();

  // Presenter views are Zohn's own; logging them would fake the "they looked
  // at it" signal. Bots/link-scanners/previewers get the same treatment —
  // they aren't a prospect looking at their demo.
  if (!presenter && !isBot(request.headers.get('user-agent')) && request.method === 'GET') {
    const now = new Date().toISOString();
    context.waitUntil(
      env.DB.batch([
        env.DB.prepare(`INSERT INTO demo_views (id, site_id, path, device, viewed_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), site.id, url.pathname, deviceFromUA(request.headers.get('user-agent')), now),
        env.DB.prepare(`UPDATE sites SET status = 'viewed', updated_at = ? WHERE id = ? AND status = 'pitched'`).bind(now, site.id),
      ]).catch((err) => console.error('demo view log failed', err))
    );
  }
  return respond(html, { extra: { 'X-Robots-Tag': 'noindex, nofollow' } });
}

async function live(context, route) {
  const { request, env } = context;
  const cache = caches.default;
  if (request.method === 'GET') {
    const hit = await cache.match(request);
    if (hit) return hit;
  }

  const site = await env.DB.prepare(`SELECT slug, domain, content_json FROM sites WHERE status = 'live' AND domain = ?`)
    .bind(route.domain)
    .first();
  if (!site) return notFound();

  const content = JSON.parse(site.content_json);
  const origin = `https://${site.domain}`;
  let res;
  if (route.page.type === 'sitemap') {
    res = respond(renderSitemap({ content, origin }), { type: 'application/xml; charset=utf-8', cache: LIVE_CACHE });
  } else if (route.page.type === 'robots') {
    res = respond(renderRobots({ origin }), { type: 'text/plain; charset=utf-8', cache: LIVE_CACHE });
  } else {
    const html = renderPage({ content, slug: site.slug, page: route.page, mode: 'live', origin });
    if (!html) return notFound();
    res = respond(html, { cache: LIVE_CACHE });
  }
  if (request.method === 'GET') {
    context.waitUntil(cache.put(request, res.clone()).catch((err) => console.error('cache put failed', err)));
  }
  return res;
}
