# Sitekit business model — design

**Date:** 2026-10-08
**Status:** Approved in brainstorming, pending spec review

## Goal

Prove that local trades will pay for Sitekit. The 90-day target is **1–3 paying clients at any price**. Revenue targets come after that proof.

## 1. The offer

**Sitekit Founding Client: $79/month, no contract.** Open to the first 3 clients. After that the standard price is **$129/month**.

**Included:**
- The prepared site, hosted with SSL and kept running.
- The lead form emails inquiries to the owner.
- A monthly note with views and leads.
- Up to 30 minutes of small edits per month (hours, photos, text).

**Founding bonus (first 3 only):** a one-time Google Business Profile setup or cleanup.

**What the founding client gives:**
- A short testimonial after 30 days.
- One referral introduction.
- Permission to use their site in Sitekit pitches.

**Terms:**
- Month-to-month and cancel anytime. The site comes down at the end of the paid month.
- The domain is registered in the client's name, and they pay for it. Sitekit only points it.
- On request, the client receives their text and photos.
- The founding price is locked while the subscription stays active.

**Optional extras:**
- Full static site export: $250, one-time.
- Changes beyond the 30 minutes: quoted separately.

**Out of scope:** SEO retainers, ads, logo or branding work, unlimited edits.

**Payment:** one Stripe recurring Payment Link at $79/month, created in the dashboard with no code. Its checkout requires accepting the terms, which links to `public/sitekit-terms.html`. Stripe charges a fee per transaction (about 2.9% + 30¢) and has no monthly fee. That's acceptable under the no-paid-APIs rule because nothing is charged until revenue comes in.

## 2. Sales loop and scorecard

### Weekly rhythm (Central time)

| When | What | Who |
|---|---|---|
| Mon 6:00 | Batch of 20 or fewer committed to `inbox/` in `sitekit-prospects` | Muse |
| Mon 6:30 | `site.mjs inbox` + scaffold, run by the "Sitekit inbox" scheduled task | Automated |
| Mon | `/scaffold-sites`, `scaffold-check`, push | Zohn + Claude Code |
| Tue–Thu | `pitch --next 5`, pasted to Muse. Muse sends from the outreach mailbox after Zohn approves | Zohn + Muse |
| Daily | `site.mjs views`. Every new viewer gets a call or text within 24h | Zohn |
| Meeting | Presenter-mode demo, then the offer. If yes, send the Stripe link on the spot | Zohn |
| Day 3, day 7 | `pitch <slug> --followup 1` / `--followup 2` for non-responders, then stop | Muse |

**Pipeline:** the existing D1 `status` column (`prospect → demo → pitched → viewed → meeting → won/lost → live`). No CRM.

### Scorecard

The experiment ends after **60 pitches or 6 weeks from the first pitch, whichever comes first.** Then one of these applies:

| Result | Verdict | Next |
|---|---|---|
| 1 or more `won`/`live` | **Validated** | Lift the no-paid-tools rule, set revenue targets, start Template B and the agency rebrand |
| 0 won, 5 or more viewed | **Offer problem** | Change price or framing (for example, first month free) and run one more round |
| Fewer than 5 viewed | **Channel problem** | Lead with texting or calls instead of email and run one more round |

"Viewed" counts sites with at least one demo view. Bot views are already filtered out.

### Before the first pitch (Zohn)

1. Set up the outreach mailbox. It's separate from the main inbox, and Muse sends from it.
2. Create the Stripe account and the $79/month Payment Link, with terms acceptance turned on.
3. Confirm Muse's terms of service allow commercial outreach.
4. `SK_MAILING_ADDRESS` is already set locally (2026-10-05).

## 3. What gets built

No new runtime dependencies and no paid APIs. Code goes in `sitekit/` and `scripts/site.mjs`, tested with `node:test`.

### 3.1 Offer line in the pitch

`pitchText` in `sitekit/admin.mjs` gets one paragraph before the sign-off:

> Founding-client rate: $79/month, no contract — open to the first 3 businesses.

The price and slot count are constants in `admin.mjs` (`OFFER = { foundingPrice: 79, standardPrice: 129, foundingSlots: 3 }`), so they're changed in one place. Once 3 sites are `won` or `live`, `pitch` stops adding the founding line and uses the standard price instead: *"$129/month, no contract."*

### 3.2 Follow-ups

`site.mjs pitch <slug> --followup 1|2` prints a Muse instruction for a short reply in the same thread:
- **1 (day 3):** a two-line bump with the demo link again.
- **2 (day 7):** "Last note from me" plus the link, with the same CAN-SPAM footer.

It uses the same email/contact-form routing as `pitch`. The status doesn't change.

### 3.3 Daily batch

`site.mjs pitch --next N` (N defaults to 5):
- Candidates are local `sites/*.json` files whose D1 status is `prospect` or `demo`, and which have an email or contact form.
- Excluded: sites with `outreach.skip`, `acme-roofing`, and anything failing `scaffold-check`.
- Order: sites with no `outreach.currentSite` come first, then the rest, alphabetically by slug for a stable order.
- Output: one Muse instruction covering all N messages, each with its own "How:" line and message, and the shared approval line at the top.
- After printing, the existing `pitchStatusSql` runs for each slug, so they move to `pitched`.

**New site field:** `outreach.skip`, a short reason string. It marks poor fits so `--next` never picks them. One-time step: set it on the 7 prospects flagged as poor fits during the 2026-10-02 and 2026-10-05 batches. This repo is public, so the names stay in the gitignored `sites/*.json` files and nowhere else. `scaffold-check` treats it as optional.

### 3.4 Scorecard

`site.mjs scorecard` runs one read-only D1 query and prints:
- Counts by status.
- Pitched-ever: sites at `pitched` or any later stage, from `pitched` onward.
- Viewed-ever: sites with at least one demo view.
- The first pitch date, and days elapsed out of 42.
- Progress: pitches out of 60, and days out of 42.
- The verdict from the table in Section 2. Until the experiment ends, it shows "In progress", plus the verdict that would apply if it ended today.

**First pitch date:** the earliest `updated_at` on a site whose status reached `pitched`. If that's unreliable because later status changes overwrite `updated_at`, add a `pitched_at` column, set once in `pitchStatusSql` (`COALESCE(pitched_at, now)`). This needs a small D1 migration in `schema-sitekit.sql`. The implementation plan picks one after reading the schema.

The verdict logic is a pure function `scorecardVerdict({ pitched, viewed, won, days })` in `sitekit/admin.mjs`, so it can be unit-tested.

### 3.5 Terms page

`public/sitekit-terms.html` is a static page in the portfolio's existing style, holding the Section 1 terms in plain English:
- the service, price and billing
- the edits allowance
- cancellation, domain ownership and content return
- the export fee
- the testimonial and referral ask for founding clients
- contact details

It isn't linked from the portfolio nav. Only the Stripe checkout and the go-live email link to it. It's marked as not legal advice for Zohn's own reference only, in an HTML comment.

### 3.6 Docs

- `docs/sitekit-offer.md` holds the offer, weekly rhythm and scorecard (Sections 1–2) as the working reference.
- `docs/go-live.md` is the paid-to-live checklist:
  1. Stripe payment received, then `status <slug> won`.
  2. Client points DNS to the Pages project (send them the steps), then add apex and `www` custom domains.
  3. `status <slug> live --domain example.com`.
  4. Submit a test lead and confirm the owner receives it.
  5. Founding bonus: the Google Business Profile pass.
  6. Calendar reminder for day 30: ask for the testimonial and the referral.
- `README.md` sales workflow gets the new commands added.

## Deferred until a paying client exists

- The monthly views and leads note (manual for client #1, automated later).
- Stripe webhooks and automatic status updates.
- The agency rebrand of `index.html`/`hire.html` (todo #1).
- Template B "Book Now".

## Testing

`node:test` covers:
- Pitch copy includes the founding line, and switches to the standard line after 3 wins.
- Follow-up 1 and 2 text, routing, and the CAN-SPAM requirement.
- `--next` candidate filtering (skip, acme, no contact, status) and ordering (no-site first, stable).
- Each branch of `scorecardVerdict`, including the boundaries: 60 pitches, 42 days, 5 viewed, 1 won.

D1 access stays behind the existing `wrangler` read/write helpers. Tests use the pure functions only.

## Risks

- **Muse ToS or deliverability.** If Muse can't send commercial email, switch to the channel-problem plan early (texting or calls).
- **Low volume.** At 20 a week, 60 pitches takes about 3 weeks. The 6-week cap covers a slow week.
- **Founding price lock.** "Locked while subscribed" means three $79 clients permanently. That's accepted as the price of proof.
