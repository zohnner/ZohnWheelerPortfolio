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
