# Sitekit v1 — Template A ("Call Now") Design

**Date:** 2026-09-28
**Status:** Approved in brainstorming, pending written-spec review

## Goal

Turn this repo from a personal portfolio into a scalable local-business website system. Zohn walks into (or messages) a Lee's Summit / KC-metro business with a **prepared, personalized demo site**, can restyle it live in the room, and — if they sign — the same site goes live on their domain as a hosted, monthly-billed product. Custom work (booking, payments, portals) is the upsell tier on top.

## Decisions made

| Decision | Choice |
|---|---|
| Sales workflow | Prepared demos ahead of time + live theme/color switching in the room |
| Business model | Template sites are the production entry tier; custom work is layered on top |
| v1 templates | A: "Call Now" (service-area trades). B: "Book Now" (appointment storefronts) — **B is out of scope for this spec** |
| v1 industry presets for A | Roofing, HVAC, foundation/waterproofing, + generic fallback |
| Architecture | One multi-tenant renderer on Cloudflare Pages Functions, content in D1 (Approach 1) |
| Location | This repo (not a new one) |
| Outreach | Meta Muse handles prospect research, sending, form-filling, and scheduling via copy-paste handoff; this system owns demos, view tracking, and pipeline state |

## Sub-project roadmap (this spec = #1 + #3 core)

1. **Template system** — Template A, themes, industry presets, renderer. *(this spec)*
2. **Scaffolder** — Claude API turns an idea or existing-site URL into a content file. *(next spec; must output the content-file format defined here)*
3. **Demo delivery** — tokenized demo links, presenter mode, view tracking. *(this spec)*
4. **Agency rebrand** — `index.html` / `hire.html` repositioned as a studio. *(later spec)*
5. **Template B ("Book Now").** *(later spec, reuses renderer)*

## 1. Architecture & repo layout

### Restructure (prerequisite)

`wrangler.jsonc` currently has `pages_build_output_dir: "."`, which publicly serves every repo file — including `schema.sql`, `schema-dashboard.sql`, and `scripts/new-project.js` today. Move all served static files into `public/` and set `pages_build_output_dir: "public"`. Existing public URLs are unchanged. `_headers`, `robots.txt`, `sitemap.xml`, and `404.html` move into `public/` too.

```
public/                    static portfolio site (index, hire, resume, dashboard, ai-workflow, 404, images, _headers…)
  sk/stock/<industry>/     self-hosted free-license stock photos per industry preset
  sk/sites/<slug>/         client-supplied photos
functions/
  _middleware.js           NEW: host/path routing → static passthrough or sitekit render
  api/inquiry.js           existing
  api/inquiries.js         existing
  api/project.js           existing
  api/lead.js              NEW: lead form for client sites
  api/demo-theme.js        NEW: presenter "Save this look"
sitekit/                   NOT served; imported by functions
  route.js                 pure fn: (host, path, query) → route descriptor
  render.js                content + template + theme → HTML string
  validate.js              content-file validation
  escape.js                HTML escaping + safe markdown subset
  themes.js                theme presets
  presets/<industry>.js    industry defaults
  templates/call-now/      page + section partials (plain JS template strings)
sites/<slug>.json          content files (source of truth, committed)
scripts/site.js            CLI: validate | push | pull | demo-link | import | pitch | status | views | export
schema-sitekit.sql         NEW tables
test/                      node:test suites + fixtures
```

### Routing (`functions/_middleware.js` → `sitekit/route.js`)

- Host is a portfolio host (`zohnwheelerportfolio.pages.dev`, `localhost`, or any host listed in a `PORTFOLIO_HOSTS` env var, e.g. a future studio domain) **and** path doesn't start with `/demo/` → `next()` (static site, unchanged behavior).
- `/demo/presenter?key=<ADMIN_TOKEN>` → sets an `HttpOnly; Secure; SameSite=Lax` presenter cookie (value: HMAC-SHA256 of the string `sitekit-presenter` keyed with `ADMIN_TOKEN`) and redirects to `/demo/presenter`, which lists demo sites with their links. Without a valid key or cookie → 404.
- `/demo/<slug>/<page…>?t=<demo_token>` → render the site in **demo mode** if the token matches `sites.demo_token`. Internal links on demo pages carry `t`. A valid presenter cookie also grants access without `t`.
- Any other host → look up `sites.domain` (also matching the `www.` variant) with `status = 'live'` → render in **live mode**. `/sitemap.xml` and `/robots.txt` on client hosts are generated.
- Anything unmatched → bare 404 (never reveals whether a slug/domain exists).

Client domains are added as custom domains on this Pages project. Limit: **100 per project on Free, 250 on Pro** (Cloudflare docs, checked 2026-09-28); apex + `www` count separately, so ~50 clients on Free. Beyond that, move to Pro or Cloudflare for SaaS custom hostnames. Pages Functions requests count against the Workers quota; the middleware runs on every request, so upgrade to Workers Paid ($5/mo) once traffic approaches the free daily limit.

### Data (`schema-sitekit.sql`, same `portfolio-leads` D1 database)

```sql
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL DEFAULT 'call-now',
  status TEXT NOT NULL DEFAULT 'prospect',  -- prospect|demo|pitched|viewed|meeting|won|lost|live
  domain TEXT UNIQUE,                        -- set when live
  demo_token TEXT NOT NULL UNIQUE,           -- 192-bit hex, same as dashboard tokens
  content_json TEXT NOT NULL,
  contact_email TEXT,                        -- lead notification recipient when live
  updated_at TEXT NOT NULL,                  -- ISO 8601 UTC
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_views (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  path TEXT NOT NULL,
  device TEXT NOT NULL,       -- 'mobile' | 'tablet' | 'desktop' from User-Agent; no IP stored
  viewed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_leads (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  mode TEXT NOT NULL,         -- 'demo' | 'live'
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_demo_views_site ON demo_views(site_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_site_leads_site ON site_leads(site_id, created_at);
```

`status` transitions: `prospect` (imported) → `demo` (content pushed) → `pitched` (set by `site.js pitch`) → `viewed` (automatically on the first non-presenter demo view while `pitched`) → `meeting` / `won` / `lost` (manual via `site.js status <slug> <status>`) → `live` (via `site.js status <slug> live --domain <domain>`). Only `live` sites render on custom domains; demo links work in every status except `lost`.

### Content workflow

Edit `sites/<slug>.json` → `node scripts/site.js push <slug>` validates, writes `scripts/.site-push.sql` (gitignored), and prints the `wrangler d1 execute portfolio-leads --remote --file …` command plus the demo link. The first push creates the row (status `demo`, new `demo_token`); later pushes update `content_json` and `updated_at` only. Same `--file`-only pattern as `new-project.js` (multi-statement `--command` silently drops statements). Content updates need no deploy; template changes ship on `git push`.

## 2. Template A — "Call Now"

### Pages

- **Home** — hero with click-to-call + "Free Estimate" CTA; trust bar (years in business, licensed/insured, review rating, badges); services grid; why-us; before/after gallery; reviews; service-area list; financing (optional); FAQ; closing CTA.
- **`/services/<slug>`** — one per service: summary, body, image, related services, CTA.
- **`/areas/<slug>`** — one per city: unique intro, services offered there, CTA. Validation warns when `intro` < 300 characters or two area intros share >80% of their words (doorway-page risk).
- **`/contact`** — estimate form, phone, hours, address/map link.
- **Every page** — sticky mobile call bar; optional emergency banner; `LocalBusiness` + `Service` + `FAQPage` JSON-LD; canonical tags (live mode); `noindex, nofollow` (demo mode).

### Content file (`sites/<slug>.json`)

```json
{
  "business": {
    "name": "Acme Roofing", "phone": "816-555-0100", "email": "office@acmeroofing.example",
    "address": "123 SE Main St, Lee's Summit, MO 64063", "founded": 2004,
    "license": "MO #12345", "hours": "Mon–Fri 7–6, Sat 8–2", "emergency": true
  },
  "industry": "roofing",
  "theme": { "preset": "storm", "accent": "#f97316", "mode": "light" },
  "hero": { "headline": "…", "sub": "…", "image": "stock:roofing/hero-1.jpg" },
  "trust": ["GAF Certified", "BBB A+", "Licensed & Insured"],
  "services": [{ "slug": "roof-replacement", "name": "…", "summary": "…", "body": "…", "image": "…" }],
  "areas": [{ "slug": "blue-springs", "name": "Blue Springs", "intro": "…" }],
  "reviews": [{ "name": "…", "rating": 5, "text": "…", "source": "Google" }],
  "gallery": [{ "before": "…", "after": "…", "caption": "…" }],
  "faq": [{ "q": "…", "a": "…" }],
  "financing": { "enabled": true, "text": "…" },
  "banner": { "enabled": true, "text": "Hail damage? Free 24/7 inspections." }
}
```

- **Required:** `business.name`, `business.phone`, `industry`, at least one `services` entry.
- Everything else falls back to the industry preset; anything set in the file overrides the preset (shallow merge per top-level section).
- Image refs: `stock:<industry>/<file>` → `/sk/stock/<industry>/<file>`; `site:<file>` → `/sk/sites/<slug>/<file>`; absolute `https://` URLs allowed.
- `body`, `intro`, `faq[].a`, and `financing.text` accept a safe markdown subset (paragraphs, bold, italic, lists, links with `https:`/`tel:`/`mailto:` only). All other strings are plain text, HTML-escaped.

### Industry presets (`sitekit/presets/`)

`roofing`, `hvac`, `foundation`, `generic`. Each supplies: icon set (inline SVG), stock image pack, default section order, starter FAQ, default banner copy, default services list, and suggested trust badges.

### Themes (`sitekit/themes.js`)

`storm` (navy/orange), `clean` (white/blue), `bold` (charcoal/yellow), `earth` (green/tan). Each defines CSS custom properties for light and dark; `accent` overrides the accent token. Rendered as an inline `<style>` block — no external CSS request.

### Lead form (`functions/api/lead.js`)

Reuses `inquiry.js` patterns: validation, honeypot, IP rate limit (3 / 10 min). Stores in `site_leads`. Email via Resend: **live mode → `sites.contact_email`**; **demo mode → Zohn** (same recipient as `inquiry.js`). If Resend fails or isn't configured, the lead is still stored.

### Out of scope for v1

Client self-editing UI, blog, booking/payments, AI scaffolder, Template B, offline/PWA demo mode, per-site OG images, R2/upload pipeline.

## 3. Demo experience

### Prospect view (`/demo/<slug>?t=…`)

Full working site plus a slim top ribbon: *"Preview built for {name}"* with a **"Make it yours"** link to `/hire.html#contact`. `noindex, nofollow`. Generic studio OG image (existing `og-image-hire.png`). Each non-presenter page view inserts a `demo_views` row; the first view while `status = 'pitched'` moves the site to `viewed`.

### Presenter mode

On a device holding the presenter cookie, demo pages show a floating panel: theme preset buttons, accent swatches, light/dark toggle, and **Save this look** (POST `/api/demo-theme`, presenter cookie required), which updates `theme` inside `content_json`. Query params `?theme=&accent=&mode=` apply a look without saving. Presenter views are not logged. Note: a saved theme lives in D1 only; `site.js pull <slug>` writes the D1 `theme` back into `sites/<slug>.json` so the file stays the source of truth. Pages target < 100 KB and near-zero JS (only the panel, form, and mobile nav).

### Outreach handoff (Muse)

Meta Muse (personal agent: browsing, form-filling, approval-gated email, calendar; no API) is used by copy-paste:

- **Muse → system:** Muse produces a prospect CSV with header `name,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count`. `node scripts/site.js import prospects.csv` creates `sites/<slug>.json` stubs (business fields + industry preset, one default area for `city`) and prints next steps. Rows with an existing slug are skipped. Stubs are local-only (status `prospect` is implied until first push).
- **System → Muse:** `node scripts/site.js pitch <slug>` prints a paste-ready Muse instruction: contact method (email, or fill `contact_form_url`), a drafted personalized message including the demo link, and a CAN-SPAM footer (physical mailing address from `SK_MAILING_ADDRESS` env var + opt-out line). It also writes SQL setting status `pitched` and prints the wrangler command.
- `node scripts/site.js views` prints the wrangler query that lists sites by most recent demo views (hot leads first) — the in-person visit list.

Operational guidance (README): send outreach from a separate mailbox/domain, not the primary Gmail; keep volume personal (roughly 5–15/day); confirm Muse's terms permit commercial outreach before relying on it.

### Export (ownership guarantee)

`node scripts/site.js export <slug>` renders every page in live mode from the local content file to `dist/<slug>/` as static HTML (+ copies referenced `/sk/` images), with the lead form replaced by a `mailto:` link. `dist/` is gitignored. Honors the `hire.html` promise of no lock-in.

## Error handling

- Invalid/missing token, unknown slug/domain, `lost` site → bare 404.
- `site.js push` refuses invalid content (required fields, phone has 10 digits, accent is `#rrggbb`, known industry/theme preset, `stock:`/`site:` image refs resolve to existing files); doorway-page checks are warnings, not errors.
- Renderer omits optional sections whose data is absent; never throws on missing optional fields.
- All content HTML-escaped; markdown subset is allow-list rendered (content will come from scraping/AI).
- D1 error → styled 503. Live pages use `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`; demo pages and any request with theme params are `no-store`.
- Resend failure never fails the lead request.

## Testing

`node:test` (built-in, zero dependencies), run with `node --test`:

- `route.test.js` — host/path/query → route descriptor for every branch above.
- `validate.test.js` — required fields, bad phone/accent, unknown preset, missing image, doorway warnings.
- `escape.test.js` — HTML escaping, markdown allow-list, `javascript:` link rejection.
- `render.test.js` — fixture `test/fixtures/acme-roofing.json`: every page renders; contains `tel:` link; JSON-LD parses; demo ribbon and `noindex` only in demo mode; missing optional sections omitted; HTML snapshot for regressions.
- Manual smoke: `wrangler pages dev public` with the fixture seeded locally; Playwright screenshots at 390px and 1024px; Lighthouse ≥ 95 performance/SEO/accessibility on the fixture home page.
