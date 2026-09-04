# Zohn Wheeler — Portfolio

Personal portfolio site: [zohnwheelerportfolio.pages.dev](https://zohnwheelerportfolio.pages.dev/)

Zero-dependency, hand-coded HTML/CSS/JS. Deployed automatically to Cloudflare Pages on every push to `main`.

## Pages

- `index.html` — main portfolio (projects, services, experience, education, contact)
- `resume.html` — web resume with downloadable PDF (`Zohn-Wheeler-Resume.pdf`)
- `ai-workflow.html` — case study: the multi-agent AI persona workflow behind SportStrata
- `hire.html` — freelance web development services page, with a real project inquiry form (see below)

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

**Local dev**: `wrangler pages dev .` (uses local D1 simulation — run `wrangler d1 execute portfolio-leads --local --file ./schema.sql` once first).
