# Sitekit Scaffolder — Design

**Date:** 2026-09-29
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** `docs/superpowers/specs/2026-09-28-sitekit-template-a-design.md` (content-file format, CLI, Muse import)

## Goal

Turn a prospect stub (from `site.mjs import` of Muse's CSV) into a filled-in, demo-ready content file with minimal manual work, using any combination of the business's existing website, Muse's data, and a short note from Zohn — **without any paid API**. Batch-friendly: scaffold ~20 prospects, then review them all on one page in ~15 minutes.

## Decisions made

| Decision | Choice |
|---|---|
| Sources | Their website, Muse CSV data (incl. Google rating/count/Maps URL), Zohn's free-text note — any combination |
| Workflow | Batch + review sheet; nothing is pushed/published automatically |
| Paid APIs | **None.** No Anthropic API, no Google Places API. Anthropic API may be enabled later once projects are validated |
| Writer | Claude Code under Zohn's existing subscription, via a project skill `/scaffold-sites`; deterministic `--no-ai` fallback |
| Google content | Only a Google Maps link is stored. Google review text is never fetched, stored, or displayed. Rating/count (from Muse) displayed only with "Google Maps" attribution + link |
| Dependencies | None added (Node built-ins only, same as the rest of the repo) |

## Pipeline

```
site.mjs import prospects.csv      (exists; + google_maps_url, notes columns)
        ↓
site.mjs scaffold [slug...]        gather → sites/.briefs/<slug>.md (+ .json)
        ↓                          (--no-ai: also writes the content file directly)
/scaffold-sites  (Claude Code)     reads briefs → writes sites/<slug>.json + sites/.briefs/<slug>.provenance.json
        ↓
site.mjs scaffold-check [slug...]  verify provenance → drop unproven facts → validate → sites/.review/<date>.html
        ↓
Zohn reviews → site.mjs push <slug>  (existing)
```

Later (out of scope now): a `--provider anthropic` batch mode replaces only the `/scaffold-sites` step, reusing the same brief, rules, and `scaffold-check`.

## 1. Gather (`site.mjs scaffold`) — `sitekit/scaffold/`

Pure code, no AI, no paid calls. Targets: explicit slugs, or by default every `sites/*.json` stub that has no `sites/.briefs/<slug>.md` yet; `--force` re-gathers.

**Inputs:** the stub (`business`, `industry`, `outreach.currentSite`, `outreach.note`, `business.googleMapsUrl`), plus CLI `--url <url>` and `--note "<text>"` overrides (saved into the stub's `outreach`).

**Site fetch** (`fetchSite.mjs`), only if a site URL exists:
- `https://` only (upgrade `http://`); same host only (www/apex equivalent); ≤3 redirects, staying on-host.
- Homepage first; then up to 6 more pages from on-host links ranked by link text/path keywords: services/service, about/our-story/company, areas/service-area/locations, contact, reviews/testimonials, plus links whose text matches a preset service name.
- Per request: 10s timeout, User-Agent `SitekitBot/1.0 (+https://zohnwheelerportfolio.pages.dev/hire.html)`, respect `robots.txt` Disallow for that UA or `*` (simple parser), accept only `text/html` ≤ 1.5MB.
- Total extracted text cap: 400KB per business. Global `fetch` (Node 24), injected for tests. No headless browser.

**Text extraction** (`extract.mjs`): strip `script/style/noscript/svg`, drop nav/footer lines repeated on ≥3 pages, decode entities, collapse whitespace, keep headings (`#`-prefixed) and list items (`- `). Record page title and path.

**Pattern facts** (`facts.mjs`), each `{ value, source, quote }`:
- phone (US 10-digit; `tel:` link preferred, else most frequent), email (`mailto:` or pattern), street address (US pattern with state + ZIP), city (from address, else stub), founded year (`since|established|est.|founded` + 19xx/20xx ≤ current year; `©` lines excluded), license (`license|lic.? #` patterns), matched services (preset service names/keywords found in page text), testimonials (on a reviews/testimonials page: quoted text ≥ 40 chars followed by a short name line).
- Muse facts from the stub (`rating`, `reviewCount`, `googleMapsUrl`) with `source: "muse"`.

**Brief:** `sites/.briefs/<slug>.md` (readable) and `sites/.briefs/<slug>.json` (machine: `pages[{path,title,text}]`, pattern facts, stub, note, fetch log, status). The `.md` has: stub summary, note, pattern-facts table, fetch log, then each page as `## site:<path> — <title>` + its text. Status: `ok | partial (<reason>) | no-site | blocked (<reason>)`.

**`--no-ai`:** also writes `sites/<slug>.json` = stub + pattern facts (reviews only when a reviewer name was found) + industry-preset copy, plus a provenance file for those facts, then runs the check for that slug.

## 2. Write (`/scaffold-sites` project skill)

`.claude/skills/scaffold-sites/SKILL.md`, run in a Claude Code session. These "writer rules" are also the future API system prompt:

- For each slug given (default: briefs with no newer `.provenance.json`), read `sites/.briefs/<slug>.md`, the industry preset (`sitekit/presets/<industry>.mjs`), and the content format (Template A spec + `test/fixtures/acme-roofing.json`).
- Write `sites/<slug>.json` (full content file) and `sites/.briefs/<slug>.provenance.json`.
- **Facts** (need a provenance entry with a verbatim quote from the brief, else omit): `business.phone/email/address/city/hours/founded/license/rating/reviewCount/googleMapsUrl/emergency`, `trust[]`, `reviews[]`, `gallery[]`, each `services[i]` (existence/name), each `areas[i]` (existence/name), `financing.enabled`.
- **Copy** (free to write, must not introduce new facts): `hero.headline/sub`, service `summary/body`, area `intro`, `whyUs`, `faq`, `copy.*`, `banner.text`. Area intros are city-specific, ≥ 300 characters where honest material allows, never duplicated.
- Reviews only from the business's own site or Zohn's note, verbatim, with the reviewer name as shown. Never from Google.
- Stay within the content-file schema; reuse preset service slugs when a service matches a preset service.
- Then run `node scripts/site.mjs scaffold-check <slugs>` and resolve what it reports by removing unsupported claims (never by weakening the check); summarize ready / needs-look / blocked.
- Never run `push`, `pitch`, or any `--remote` command.

## 3. Check (`site.mjs scaffold-check`) — `sitekit/scaffold/check.mjs`

Pure core `checkScaffold({ content, provenance, brief }) → { content, dropped[], warnings[], facts[] }` plus CLI wrapper.

**Provenance file** `sites/.briefs/<slug>.provenance.json`: object keyed by content path (`"business.founded"`, `"services[2]"`, `"reviews[0]"`, `"areas[1]"`, `"trust[0]"`), values `{ value, source, quote }`, `source` ∈ `site:<path>` | `muse` | `note`. Synthetic example:

```json
{
  "business.founded": { "value": 2004, "source": "site:/about", "quote": "Serving Lee's Summit since 2004" },
  "services[2]": { "value": "Gutters", "source": "site:/services", "quote": "Seamless gutter installation" },
  "business.rating": { "value": 4.8, "source": "muse", "quote": "google_rating=4.8" }
}
```

**Rules:**
1. Every fact path present in the content needs a provenance entry whose `source` is a fetched page, `muse`, or `note`; whose `quote` occurs in that source's text (page text, the stub's Muse fields rendered `key=value`, or the note) after normalizing whitespace/case/quote characters; and whose `value` occurs in the quote after normalization (phones by digits, years/ratings as numbers).
2. Failing facts are removed (array items spliced, scalars deleted) and listed in `dropped[]` with a reason.
3. `reviews[]` entries not sourced from `site:*` or `note` are dropped.
4. Copy scan: copy fields are scanned for fact-like patterns — 4-digit years, `since|established|founded`, `licensed|insured|bonded|certified|accredited|award|#1|best in`, `\d(.\d)? stars`, phone numbers, percentages — not backed by a provenance fact with the same value → warning (not removed).
5. Before writing back `sites/<slug>.json`, the prior version is copied to `sites/.bak/<slug>.<timestamp>.json`; then `validateContent` runs and its errors/warnings join the report.
6. Status: ❌ blocked if validation errors remain; ⚠️ needs-look if any dropped facts, copy warnings, validation warnings, or brief status ≠ ok; ✅ ready otherwise.

**Review page** `sites/.review/<YYYY-MM-DD>.html` (self-contained, every string escaped, opened locally): summary counts, then one card per business — status badge, brief status + fetch log, facts table (path, value, source, quote), dropped list, copy warnings, validation warnings, and the `node scripts/site.mjs push <slug>` line. Plus a one-line-per-business terminal summary.

## 4. Template and data-format changes

- New optional content field `business.googleMapsUrl`: https URL on `google.com/maps`, `maps.google.com`, `maps.app.goo.gl`, or `g.page` — validated.
- Muse CSV gains optional `google_maps_url` (→ `business.googleMapsUrl`) and `notes` (→ `outreach.note`) columns in `stubFromProspect`.
- Trust-bar rating line becomes `Rated X on Google Maps (N reviews)`, linked to `googleMapsUrl` when present; the reviews-section intro sentence gets the same attribution.
- "See our reviews on Google Maps" button in the reviews section (or a small standalone band when there are no site reviews) when `googleMapsUrl` is set, via `safeUrl`.
- README: updated Muse CSV columns, scaffold workflow, and a note that Muse's Google rating/count should be refreshed before going live.

## 5. Files

```
sitekit/scaffold/fetchSite.mjs   fetch + page selection + robots (fetch injected)
sitekit/scaffold/extract.mjs     HTML → structured text
sitekit/scaffold/facts.mjs       pattern facts
sitekit/scaffold/brief.mjs       brief .md/.json rendering; --no-ai content assembly
sitekit/scaffold/check.mjs       checkScaffold + copy scan
sitekit/scaffold/review.mjs      review page HTML
scripts/site.mjs                 + scaffold, scaffold-check commands
.claude/skills/scaffold-sites/SKILL.md
test/fixtures/scaffold/…         recorded HTML: normal multi-page site, JS-only shell, robots-disallow site
test/scaffold-*.test.mjs
```

`.gitignore`: `sites/.briefs/`, `sites/.review/`, `sites/.bak/` are already covered by `sites/*`; listed explicitly for clarity.

## Error handling

- Per-business failures (DNS, timeout, non-HTML, robots-disallowed, >1.5MB, off-host redirect, <200 chars of text) go in that brief's status/fetch log; the batch continues. No usable site → brief from Muse data + note only.
- A malformed provenance file marks that business ❌ with the parse error; the batch continues.
- Content files are always backed up before any overwrite.
- Scraped text is untrusted: everything in the review page is escaped.

## Testing

`node:test`, no network (injected fetch), no cost:
- `extract` on the three fixtures: structure kept, scripts/nav stripped, JS shell → `partial (little text)`.
- `fetchSite`: ranking picks services/about/areas/contact; off-host and robots-disallowed links skipped; caps and redirect limits enforced.
- `facts`: phone/email/address/founded/license/testimonial extraction with quotes; `© 2024` never read as a founded year.
- `checkScaffold`: good provenance kept; fabricated quote dropped; value-not-in-quote dropped; Google-sourced review dropped; fact without provenance dropped; "Since 1998" / "#1 roofer" in copy warned; phone normalization matches.
- `--no-ai` end to end on the normal fixture → valid content file, status ✅ or ⚠️.
- Template: rating line includes "Google Maps" + link; reviews button only with `googleMapsUrl`; non-https blocked.
- `/scaffold-sites` validated once by hand on the Acme fixture brief.

## Out of scope

Anthropic API provider (future `--provider anthropic`), Google Places API, Facebook scraping, image scraping/re-hosting, automatic push/pitch, headless-browser rendering of JavaScript-only sites.
