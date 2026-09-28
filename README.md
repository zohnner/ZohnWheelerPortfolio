# Zohn Wheeler — Portfolio

Personal portfolio site: [zohnwheelerportfolio.pages.dev](https://zohnwheelerportfolio.pages.dev/)

Zero-dependency, hand-coded HTML/CSS/JS. Deployed automatically to Cloudflare Pages on every push to `main`.

## Pages

All served files live in public/ (wrangler.jsonc: pages_build_output_dir = "public"). Everything outside public/ — schemas, scripts, functions source, sitekit/ — is never served.

- `index.html` — main portfolio (projects, services, experience, education, contact)
- `resume.html` — web resume with downloadable PDF (`Zohn-Wheeler-Resume.pdf`)
- `ai-workflow.html` — case study: the multi-agent AI persona workflow behind SportStrata
- `hire.html` — freelance web development services page, with a real project inquiry form (see below)
- `dashboard.html` — client project status page, reached via a private tokenized link (see below). `noindex, nofollow` — never linked from anywhere else on the site.

## Stack

No frameworks, no build step. IntersectionObserver scroll animations, a fuzzy-search command palette (Cmd+K), a light/dark theme toggle (`zw_theme` in localStorage, defaults to system preference), and security headers via Cloudflare Pages `_headers`.

`manifest.json` + `apple-touch-icon.png`/`icon-192.png`/`icon-512.png` (generated from `favicon.svg` via `sharp`) support "Add to Home Screen." `og-image-hire.png` is a dedicated share card for `hire.html` — don't let it drift back to reusing the generic `og-image.png` if hire.html's pitch changes.

## Lead capture backend

`hire.html`'s inquiry form posts to a Cloudflare Pages Function backed by D1 — not mailto, so submissions are durable even if the visitor has no mail client configured.

- `functions/api/inquiry.js` — `POST` handler. Validates input, rate-limits by IP (3 submissions / 10 min), stores the lead in D1, and (if `RESEND_API_KEY` is set) fires a best-effort email notification via [Resend](https://resend.com). Includes a hidden honeypot field (`website`) to filter bots.
- `functions/api/inquiries.js` — `GET` handler to view leads. Returns 404 unless a valid `ADMIN_TOKEN` is passed via `X-Admin-Token` header or `?token=` query param — same pattern as BotChase's `METRICS_API_TOKEN`.
- `schema.sql` — D1 schema (`inquiries` table). Apply with `wrangler d1 execute portfolio-leads --remote --file ./schema.sql`.
- `wrangler.jsonc` — Pages config; the D1 binding (`DB` → `portfolio-leads`) is defined here and is the source of truth (not the dashboard).

**Required Pages secrets** (`wrangler pages secret put <NAME> --project-name zohnwheelerportfolio`):
- `ADMIN_TOKEN` — required for `/api/inquiries` to work. Already set.
- `RESEND_API_KEY` — optional. Without it, leads still land in D1, just without an email ping. Reuse the same key already configured for BotChase.

**Checking leads**: `curl -H "X-Admin-Token: <token>" https://zohnwheelerportfolio.pages.dev/api/inquiries`

**Local dev**: `wrangler pages dev public` (uses local D1 simulation — run `wrangler d1 execute portfolio-leads --local --file ./schema.sql` once first).

## Client dashboard (Phase 1)

`dashboard.html?token=<token>` gives a client a private, read-only status page for their project — no login, no accounts. The token itself is the credential (same trust model as a Stripe invoice link): a 192-bit random value, unguessable, so there's deliberately no rate limiting on the lookup.

- `schema-dashboard.sql` — `clients` / `projects` / `project_updates` tables, same `portfolio-leads` D1 database as the leads backend. Apply with `wrangler d1 execute portfolio-leads --remote --file ./schema-dashboard.sql` (once).
- `functions/api/project.js` — `GET ?token=` handler. Returns the project + its update feed, or a bare 404 for an invalid/missing token (never leaks whether a token is "close" to valid).
- Status progresses through `discovery → design → build → review → launch → support`, rendered as a stepper on the page.

**No admin UI yet (that's Phase 2)** — you manage projects via `scripts/new-project.js`:

```
node scripts/new-project.js --client "Acme Roofing" --email "owner@acme.com" --project "Acme Roofing Website" [--staging "https://..."]
```

This prints a `wrangler d1 execute --remote --file ...` command to create the client + project (writes the SQL to `scripts/.new-project.sql`, gitignored — contains real client PII, delete it after running) and the resulting dashboard link to send the client. It also prints a template command for posting a status update later. **Always use `--file`, never a multi-statement `--command` string** — confirmed live that `wrangler d1 execute --command` silently only runs the first statement of a semicolon-separated string and drops the rest, with no error.

## Sitekit (client sites)

Sitekit turns one content file into a full multi-page "Call Now" site for a local-service business (roofing, HVAC, foundation repair, or any generic home-services trade): a home page, service pages, service-area pages, a contact page with a lead form, sitemap/robots, and JSON-LD structured data — all rendered server-side from `sites/<slug>.json` plus an industry preset (`sitekit/presets/`). Each site can be previewed at `/demo/<slug>?t=<token>` before it's sold, and served live on the client's own domain once they say yes.

### One-time setup

```bash
npx wrangler d1 execute portfolio-leads --remote --file ./schema-sitekit.sql
```

`ADMIN_TOKEN` is already set (shared with the lead-capture and dashboard backends above). If a separate studio/agency domain is ever added in front of the portfolio host, set `PORTFOLIO_HOSTS` to include it.

### Daily workflow

Run these in order, from the repo root:

1. `node scripts/site.mjs import prospects.csv` — creates a `sites/<slug>.json` stub per row (skips names that already exist).
2. Edit `sites/<slug>.json` by hand — fill in real details, and **write real, specific city intros** for each service area (generic filler reads as a doorway page and `validate` will warn about it).
3. `node scripts/site.mjs push <slug>` — validates the content, writes it to D1, and prints a `wrangler d1 execute --remote --file ...` command.
4. Run the printed wrangler command.
5. `SK_MAILING_ADDRESS="123 Studio Way, City, ST 00000" node scripts/site.mjs pitch <slug>` — prints ready-to-paste outreach copy with the demo link. Paste it into Muse.
6. `node scripts/site.mjs views` — see who's opened their demo link, and when.
7. `node scripts/site.mjs status <slug> meeting|won|lost` — track the deal as it moves.
8. `node scripts/site.mjs status <slug> live --domain example.com` — go live. Also add `example.com` and `www.example.com` as custom domains on the Pages project (dashboard or `wrangler pages domain add`).

### Presenter mode

For showing a prospect a few looks on a tablet or laptop during a sales meeting: visit `/demo/presenter?key=<ADMIN_TOKEN>` once per device to authenticate (sets a long-lived cookie), then use the on-page theme/accent/mode controls and **Save this look** to persist a choice back to D1. Run `node scripts/site.mjs pull <slug>` afterward to sync that theme choice into the local `sites/<slug>.json` file.

### Handing off a finished site

`node scripts/site.mjs export <slug> --origin https://example.com` renders every page to static HTML plus its images under `dist/<slug>/`, so a client (or their next developer) can take the site anywhere — no server, no D1, no Sitekit runtime required.

### Privacy

`sites/*.json` is gitignored — this is a public repo, and real client content (names, phone numbers, addresses, review text) shouldn't be in it. Only the fictional `sites/acme-roofing.json` sample is committed. D1's `content_json` column holds the authoritative copy as a backup; `pull`/`push` keep the local file and the database in sync.

### Limits

- **Custom domains**: 100 per Pages project on the Free plan, 250 on Pro. A client's apex domain and its `www` each count as one.
- **Cache**: live pages are edge-cached for 5 minutes, so a content push can take up to 5 minutes to show up on a live custom domain. Demo links always reflect the latest push immediately.

### Outreach rules

Send pitches from a separate outreach mailbox/domain, not the main portfolio inbox. Keep volume modest — roughly 5–15 a day — and confirm Muse's (or whatever mailing tool's) terms of service allow this kind of commercial outreach before scaling up.
