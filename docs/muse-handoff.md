# Muse → Sitekit handoff

How Muse gives Claude Code a batch of prospects to turn into demo sites.

**The short version:** Muse commits one CSV per batch to `inbox/` in the **private** repo `zohnner/sitekit-prospects` (cloned next to this one, at `../sitekit-prospects`). That repo's README holds Muse's full rules: where to write, when, and the format. Then the batch runs: `import` → `scaffold` → `/scaffold-sites` → `scaffold-check` → review. Imported batches move to `done/`.

**Never let Muse write into this repo.** It's public, so a committed prospect file is visible to anyone, even if you delete it later. Anything under `sites/` here is gitignored, and that's the only place prospect data lives in this repo.

**Schedule:** one batch of up to 20 a week, committed by 6:00 AM Monday (Central), imported at 6:30 AM. You review on Monday and pitch 5–15 a day, Tuesday to Thursday, 9–11 AM.

The section below is the copy-paste version, for when Muse hands over a batch in chat instead.

---

## 1. Paste this into Muse

> Find up to 20 local businesses in the Lee's Summit / Kansas City metro that are good prospects for a new website. Focus on roofing, HVAC, and foundation repair/waterproofing companies. The best prospects have no website, or one that is outdated, slow, or hard to use on a phone. Skip franchises and national chains, and skip any business whose site already looks modern.
>
> Return the results as **one CSV code block** with exactly this header row, in this order:
>
> ```
> name,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count,google_maps_url,notes
> ```
>
> Rules for each column:
>
> - **name**: the business name exactly as shown on its Google Maps listing. One row per business, with no duplicates.
> - **industry**: one of `roofing`, `hvac`, or `foundation`. If it is none of these, write what it is in a few words (e.g. `plumbing`).
> - **city**: the city only, with no state (e.g. `Lee's Summit`, `Blue Springs`).
> - **phone**: the main business phone, written as `(816) 555-0123`. This matters most, because a demo can't be built without a 10-digit phone number.
> - **email**: a public business email from the business's website or listing. Leave it blank if none is listed. Never guess one or use a personal address.
> - **contact_form_url**: the full URL of the contact page if the site has a contact form. Otherwise leave it blank.
> - **current_site**: the full homepage URL starting with `https://`. If the business only has a Facebook, Yelp, or Google profile, leave this blank and mention that in notes.
> - **google_rating**: the star rating from Google Maps as a number (e.g. `4.7`).
> - **review_count**: the number of Google reviews as a whole number (e.g. `86`). Fill in both rating and count, or neither.
> - **google_maps_url**: the "Share" link of the Google Maps listing (e.g. `https://maps.app.goo.gl/...`).
> - **notes**: short, factual details you saw on the listing or website: services offered, hours, years in business, license number, emergency/24-7 service, service areas, and one phrase on what's wrong with the current site. **Only write things the business itself states.** Anything in notes may appear on the demo site as fact. Do not copy Google review text and do not guess.
>
> Formatting:
> - If a value contains a comma, wrap it in double quotes. Notes almost always need quotes.
> - If you don't know a value, leave it empty. Never write "N/A", "unknown", or a made-up value.
> - Put only the header and data rows inside the code block.
> - After the code block, list any businesses you skipped, one line each with the reason.

### Example of a good row (fictional)

```csv
name,industry,city,phone,email,contact_form_url,current_site,google_rating,review_count,google_maps_url,notes
Prairie Peak Roofing,roofing,Lee's Summit,(816) 555-0142,office@prairiepeak.example,https://prairiepeak.example/contact,https://prairiepeak.example,4.8,112,https://maps.app.goo.gl/AbCdEf123,"Services: roof replacement, storm damage repair, gutters. Hours: Mon-Fri 7am-6pm. Family owned since 2006. Site is not mobile friendly and has no photos."
```

---

## 2. Your side (Zohn)

**From the private repo (normal, automated):** the Windows task "Sitekit inbox" runs [scripts/monday-inbox.ps1](../scripts/monday-inbox.ps1) every Monday at 6:30 AM. If the PC is asleep, it wakes it; if the PC is off, it runs at the next startup. The task runs `node scripts/site.mjs inbox`, which:

- pulls the repo and imports every CSV in `inbox/`,
- skips any row whose comma count is wrong and reports it,
- moves the batch to `done/` and pushes.

It then runs `scaffold` and writes a log to `sites/.inbox-log/<date>.log`. After that, open Claude Code and run `/scaffold-sites`. To run it any other day: `node scripts/site.mjs inbox`.

**From chat (fallback):**

1. Copy the code block out of Muse, but not Muse's text around it.
2. Either paste it to Claude Code and say "import this batch", or save it as `sites/prospects-YYYY-MM-DD.csv` and run:
   ```
   node scripts/site.mjs import sites/prospects-YYYY-MM-DD.csv
   ```
3. Claude Code then runs `scaffold`, `/scaffold-sites`, and `scaffold-check`, and gives you the review page (`sites/.review/<date>.html`).

---

## Why the rules matter

| Rule | What happens if it's broken |
|---|---|
| Exact header row | Columns are matched by header name. A misspelled header means that column is silently ignored. |
| `name` exact and unique | The name becomes the site's slug (`prairie-peak-roofing`). A slug that already exists is skipped, so re-sending a business is harmless. A slightly different spelling creates a duplicate. |
| 10-digit `phone` | It's required, so a site without one is ❌ blocked until it's filled in. |
| `industry` keyword | `roof`/`gutter`/`siding` → roofing, `foundation`/`waterproof`/`basement`/`crawl` → foundation, `hvac`/`heating`/`cooling`/`furnace`/`air` → hvac. Anything else gets the generic template. |
| `city` without state | The city becomes the first service-area page and its URL. |
| Real homepage in `current_site` | The scaffolder reads up to 7 pages of that site to find services, years in business, and testimonials. A Facebook/Yelp URL gives it nothing usable. |
| Rating and count together | If either is missing or zero, both are dropped. They're shown as "Rated X on Google Maps (N reviews)" with a link, so they must match the listing. |
| Maps link format | It must be an `https` link on `google.com/maps`, `maps.google.com`, `maps.app.goo.gl`, or `g.page`, or the site fails validation. |
| Facts-only `notes` | Notes count as a trusted source. `scaffold-check` lets a fact onto the site if it can quote it from the business's site, Muse's columns, or the notes. A guess in notes can end up on a demo as a claim. |
| No Google review text | Sitekit never shows Google review text. Testimonials only come from the business's own site. |

Before a site goes live, refresh the rating and review count. Muse's numbers go stale.
