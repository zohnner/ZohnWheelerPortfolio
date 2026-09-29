import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';
import { onRequestPost as leadPost } from '../functions/api/lead.js';
import { onRequestPost as demoThemePost } from '../functions/api/demo-theme.js';

// A tiny in-memory D1 double. It recognizes the exact statements the
// middleware/lead/demo-theme handlers issue (by a stable prefix of the SQL)
// and reads/writes the same in-memory rows a real D1 database would.
function makeDb(initialSites = []) {
  const sites = initialSites.map((s) => ({ ...s }));
  const demoViews = [];
  const siteLeads = [];
  const executed = [];

  function exec(sql, args) {
    const s = sql.replace(/\s+/g, ' ').trim();
    executed.push(s);

    if (s.startsWith('SELECT id, slug, status, demo_token, content_json FROM sites WHERE slug = ?')) {
      const [slug] = args;
      return sites.find((r) => r.slug === slug) || null;
    }
    if (s.startsWith('INSERT INTO demo_views')) {
      const [id, site_id, path, device, viewed_at] = args;
      demoViews.push({ id, site_id, path, device, viewed_at });
      return { success: true };
    }
    if (s.startsWith("UPDATE sites SET status = 'viewed'")) {
      const [now, id] = args;
      const row = sites.find((r) => r.id === id && r.status === 'pitched');
      if (row) { row.status = 'viewed'; row.updated_at = now; }
      return { success: true };
    }
    if (s.startsWith('SELECT slug, domain, content_json FROM sites WHERE status')) {
      const [domain] = args;
      return sites.find((r) => r.status === 'live' && r.domain === domain) || null;
    }
    if (s.startsWith('SELECT slug, status, demo_token, json_extract')) {
      const rows = sites
        .filter((r) => r.status !== 'lost')
        .map((r) => ({ slug: r.slug, status: r.status, demo_token: r.demo_token, name: JSON.parse(r.content_json)?.business?.name, updated_at: r.updated_at }));
      return { results: rows };
    }
    if (s.startsWith('SELECT id, content_json, contact_email, demo_token FROM sites WHERE slug = ?')) {
      const [slug] = args;
      return sites.find((r) => r.slug === slug && r.status !== 'lost') || null;
    }
    if (s.startsWith('SELECT id, content_json, contact_email FROM sites WHERE slug = ? AND status')) {
      const [slug, domain] = args;
      return sites.find((r) => r.slug === slug && r.status === 'live' && r.domain === domain) || null;
    }
    if (s.startsWith('SELECT COUNT(*) AS n FROM site_leads')) {
      const [ip, windowStart] = args;
      return { n: siteLeads.filter((l) => l.ip === ip && l.created_at > windowStart).length };
    }
    if (s.startsWith('INSERT INTO site_leads')) {
      const [id, site_id, mode, name, phone, email, message, ip, created_at] = args;
      siteLeads.push({ id, site_id, mode, name, phone, email, message, ip, created_at });
      return { success: true };
    }
    if (s.startsWith('UPDATE sites SET content_json = json_set')) {
      const [themeJson, updatedAt, slug] = args;
      const row = sites.find((r) => r.slug === slug);
      if (!row) return { meta: { changes: 0 } };
      const content = JSON.parse(row.content_json);
      content.theme = JSON.parse(themeJson);
      row.content_json = JSON.stringify(content);
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled SQL in fake DB: ${s}`);
  }

  function makeStatement(sql, args) {
    return {
      _sql: sql,
      _args: args,
      first: async () => exec(sql, args),
      all: async () => {
        const r = exec(sql, args);
        return r && r.results ? r : { results: r ? [r] : [] };
      },
      run: async () => exec(sql, args),
    };
  }

  return {
    sites,
    demoViews,
    siteLeads,
    executed,
    prepare(sql) {
      return {
        bind: (...args) => makeStatement(sql, args),
        first: async () => exec(sql, []),
        all: async () => {
          const r = exec(sql, []);
          return r && r.results ? r : { results: r ? [r] : [] };
        },
        run: async () => exec(sql, []),
      };
    },
    async batch(stmts) {
      return Promise.all(stmts.map((st) => st.run()));
    },
  };
}

function makeCache({ rejectPut = false } = {}) {
  const store = new Map();
  return {
    store,
    async match(request) {
      return store.get(request.url);
    },
    async put(request, response) {
      if (rejectPut) throw new Error('simulated cache failure');
      store.set(request.url, response);
    },
  };
}

function makeContext({ url, method = 'GET', headers = {}, env = {}, db, cache, next }) {
  const waited = [];
  const request = new Request(url, { method, headers });
  return {
    request,
    env: { DB: db, ADMIN_TOKEN: 'sekret', ...env },
    next: next || (async () => new Response('static-sentinel', { status: 200 })),
    waitUntil(p) { waited.push(p); },
    async settle() { await Promise.all(waited); },
    _cache: cache,
  };
}

const NOW = '2026-09-28T00:00:00.000Z';
const CONTENT = JSON.stringify({
  business: { name: 'Acme Roofing', phone: '816-555-0100' },
  industry: 'roofing',
  services: [{ slug: 'roof-replacement', name: 'Roof Replacement' }],
});

function baseSite(overrides = {}) {
  return {
    id: 'site-1',
    slug: 'acme-roofing',
    status: 'demo',
    domain: null,
    demo_token: 'tok123',
    content_json: CONTENT,
    contact_email: null,
    updated_at: NOW,
    ...overrides,
  };
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const BOT_UA = 'curl/8.4.0';

async function callMiddleware(opts) {
  const cache = opts.cache || makeCache();
  globalThis.caches = { default: cache };
  const ctx = makeContext({ ...opts, cache });
  const res = await onRequest(ctx);
  await ctx.settle();
  return { res, ctx, cache };
}

test('a static route calls next() and returns its response unchanged', async () => {
  const db = makeDb();
  const { res } = await callMiddleware({ url: 'https://zohnwheelerportfolio.pages.dev/hire.html', db });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'static-sentinel');
});

test('demo route: valid token renders 200 with noindex and logs exactly one demo_view', async () => {
  const db = makeDb([baseSite({ status: 'pitched' })]);
  const { res, ctx } = await callMiddleware({
    url: 'https://zohnwheelerportfolio.pages.dev/demo/acme-roofing?t=tok123',
    headers: { 'user-agent': BROWSER_UA },
    db,
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(await res.text(), /Acme Roofing/);
  assert.equal(db.demoViews.length, 1);
  // Logging a view also flips a 'pitched' site to 'viewed'.
  assert.equal(db.sites[0].status, 'viewed');
  void ctx;
});

test('demo route: bad token is a bare 404', async () => {
  const db = makeDb([baseSite()]);
  const { res } = await callMiddleware({
    url: 'https://zohnwheelerportfolio.pages.dev/demo/acme-roofing?t=wrong',
    headers: { 'user-agent': BROWSER_UA },
    db,
  });
  assert.equal(res.status, 404);
  assert.equal(await res.text(), 'Not found');
  assert.equal(db.demoViews.length, 0);
});

test('demo route: missing token without a presenter cookie is 404', async () => {
  const db = makeDb([baseSite()]);
  const { res } = await callMiddleware({
    url: 'https://zohnwheelerportfolio.pages.dev/demo/acme-roofing',
    headers: { 'user-agent': BROWSER_UA },
    db,
  });
  assert.equal(res.status, 404);
});

test('demo route: a lost site is 404 even with a valid token', async () => {
  const db = makeDb([baseSite({ status: 'lost' })]);
  const { res } = await callMiddleware({
    url: 'https://zohnwheelerportfolio.pages.dev/demo/acme-roofing?t=tok123',
    headers: { 'user-agent': BROWSER_UA },
    db,
  });
  assert.equal(res.status, 404);
});

test('demo route: presenter cookie without a token renders the panel and logs no view', async () => {
  const db = makeDb([baseSite()]);
  const { presenterCookieValue, PRESENTER_COOKIE } = await import('../sitekit/presenter.mjs');
  const cookieValue = await presenterCookieValue('sekret');
  const { res } = await callMiddleware({
    url: 'https://zohnwheelerportfolio.pages.dev/demo/acme-roofing',
    headers: { 'user-agent': BROWSER_UA, cookie: `${PRESENTER_COOKIE}=${cookieValue}` },
    db,
  });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /sk-panel/);
  assert.equal(db.demoViews.length, 0);
});

test('demo route: a bot user agent with a valid token gets 200 but no view is logged', async () => {
  const db = makeDb([baseSite()]);
  const { res } = await callMiddleware({
    url: 'https://zohnwheelerportfolio.pages.dev/demo/acme-roofing?t=tok123',
    headers: { 'user-agent': BOT_UA },
    db,
  });
  assert.equal(res.status, 200);
  assert.equal(db.demoViews.length, 0);
});

test('presenter-login: bad key is 404, good key sets the cookie and redirects', async () => {
  const db = makeDb();
  const bad = await callMiddleware({ url: 'https://zohnwheelerportfolio.pages.dev/demo/presenter?key=nope', db });
  assert.equal(bad.res.status, 404);

  const good = await callMiddleware({ url: 'https://zohnwheelerportfolio.pages.dev/demo/presenter?key=sekret', db });
  assert.equal(good.res.status, 302);
  assert.equal(good.res.headers.get('Location'), '/demo/presenter');
  assert.match(good.res.headers.get('Set-Cookie'), /sk_presenter=/);
});

test('live host: 200 with a canonical link for the matching domain', async () => {
  const db = makeDb([baseSite({ status: 'live', domain: 'acme-roofing.example', slug: 'acme-roofing' })]);
  const { res } = await callMiddleware({
    url: 'https://acme-roofing.example/',
    headers: { 'user-agent': BROWSER_UA },
    db,
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<link rel="canonical" href="https:\/\/acme-roofing\.example\/">/);
});

test('live host: cache.put failures are caught, never crash the request', async () => {
  const db = makeDb([baseSite({ status: 'live', domain: 'acme-roofing.example' })]);
  const cache = makeCache({ rejectPut: true });
  const originalError = console.error;
  console.error = () => {}; // the caught cache.put failure logs by design; keep test output clean
  try {
    const { res } = await callMiddleware({ url: 'https://acme-roofing.example/', db, cache });
    assert.equal(res.status, 200);
  } finally {
    console.error = originalError;
  }
});

test('client host: a portfolio-only static path is 404 on a live client domain', async () => {
  const db = makeDb([baseSite({ status: 'live', domain: 'acme-roofing.example' })]);
  const { res } = await callMiddleware({ url: 'https://acme-roofing.example/hire.html', db });
  assert.equal(res.status, 404);
});

// --- functions/api/lead.js ---

function makeLeadContext({ body, url = 'https://zohnwheelerportfolio.pages.dev/api/lead', headers = {}, db }) {
  const waited = [];
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { request, env: { DB: db }, waitUntil(p) { waited.push(p); }, async settle() { await Promise.all(waited); } };
}

test('lead: a demo token routes the lead to the owner (mode demo)', async () => {
  const db = makeDb([baseSite()]);
  const ctx = makeLeadContext({ body: { slug: 'acme-roofing', t: 'tok123', name: 'Pat', phone: '816-555-0199' }, db });
  const res = await leadPost(ctx);
  await ctx.settle();
  assert.equal(res.status, 200);
  assert.equal(db.siteLeads.length, 1);
  assert.equal(db.siteLeads[0].mode, 'demo');
});

test('lead: live mode requires the request host to equal the site domain', async () => {
  const db = makeDb([baseSite({ status: 'live', domain: 'acme-roofing.example', demo_token: null })]);
  const ok = makeLeadContext({
    body: { slug: 'acme-roofing', name: 'Pat', phone: '816-555-0199' },
    url: 'https://acme-roofing.example/api/lead',
    db,
  });
  const okRes = await leadPost(ok);
  await ok.settle();
  assert.equal(okRes.status, 200);
  assert.equal(db.siteLeads.length, 1);

  const mismatch = makeLeadContext({
    body: { slug: 'acme-roofing', name: 'Pat', phone: '816-555-0199' },
    url: 'https://not-the-domain.example/api/lead',
    db,
  });
  const mismatchRes = await leadPost(mismatch);
  assert.equal(mismatchRes.status, 404);
});

test('lead: a lost site with a demo token is 404', async () => {
  const db = makeDb([baseSite({ status: 'lost' })]);
  const ctx = makeLeadContext({ body: { slug: 'acme-roofing', t: 'tok123', name: 'Pat', phone: '816-555-0199' }, db });
  const res = await leadPost(ctx);
  assert.equal(res.status, 404);
});

// --- functions/api/demo-theme.js ---

function makeThemeContext({ body, headers = {}, db }) {
  const request = new Request('https://zohnwheelerportfolio.pages.dev/api/demo-theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { request, env: { DB: db, ADMIN_TOKEN: 'sekret' } };
}

test('demo-theme: no presenter cookie is 404', async () => {
  const db = makeDb([baseSite()]);
  const ctx = makeThemeContext({ body: { slug: 'acme-roofing', theme: { preset: 'bold' } }, db });
  const res = await demoThemePost(ctx);
  assert.equal(res.status, 404);
});

test('demo-theme: with a valid presenter cookie, updates the site theme', async () => {
  const db = makeDb([baseSite()]);
  const { presenterCookieValue, PRESENTER_COOKIE } = await import('../sitekit/presenter.mjs');
  const cookieValue = await presenterCookieValue('sekret');
  const ctx = makeThemeContext({
    body: { slug: 'acme-roofing', theme: { preset: 'bold', mode: 'dark' } },
    headers: { cookie: `${PRESENTER_COOKIE}=${cookieValue}` },
    db,
  });
  const res = await demoThemePost(ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(JSON.parse(db.sites[0].content_json).theme.preset, 'bold');
});
