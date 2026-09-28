# Stock photo credits

Source photos for `public/sk/stock/` (Sitekit industry presets). All from
Unsplash (https://unsplash.com/license) or Pexels (https://www.pexels.com/license/),
both of which allow free commercial use without attribution. Credits are kept
here anyway as good practice. This file lives outside `public/`, so it is
never served.

Originals were downloaded to a scratch folder outside the repo, then run
through `scripts/optimize-images.mjs` (`npm i --no-save sharp`) to produce the
`<name>.jpg` / `<name>-sm.jpg` pairs actually committed under
`public/sk/stock/<industry>/`.

| File | Source URL | Photographer | License |
|---|---|---|---|
| roofing/hero.jpg | https://www.pexels.com/photo/white-and-red-house-surrounded-by-trees-at-night-1612351/ | eberhard grossgasteiger | Pexels License |
| roofing/roof-replacement.jpg | https://www.pexels.com/photo/historic-home-roof-replacement-in-weatherford-33501308/ | Ryan Stephens | Pexels License |
| roofing/roof-repair.jpg | https://www.pexels.com/photo/professional-roofer-installing-shingles-on-new-roof-33404248/ | Ryan Stephens | Pexels License |
| roofing/storm-damage.jpg | https://www.pexels.com/photo/grayscale-photo-of-a-broken-roof-tiles-14615663/ | Andreas Ebner | Pexels License |
| roofing/gutters.jpg | https://www.pexels.com/photo/rain-gutter-on-a-wall-25907259/ | Jan van der Wolf | Pexels License |
| hvac/hero.jpg | https://www.pexels.com/photo/air-conditioner-unit-near-wall-of-modern-building-on-street-3964341/ | ready made | Pexels License |
| hvac/ac-repair.jpg | https://www.pexels.com/photo/professional-technician-repairing-outdoor-air-conditioning-unit-6471913/ | José Andrés Pacheco Cortes | Pexels License |
| hvac/furnace-repair.jpg | https://www.pexels.com/photo/technician-kneels-outdoors-performing-hvac-maintenance-6471914/ | José Andrés Pacheco Cortes | Pexels License |
| hvac/hvac-replacement.jpg | https://www.pexels.com/photo/technician-checks-and-repairs-hvac-system-outdoors-6471911/ | José Andrés Pacheco Cortes | Pexels License |
| hvac/maintenance-plans.jpg | https://www.pexels.com/photo/professional-technician-adjusting-refrigerant-manifold-gauge-6471912/ | José Andrés Pacheco Cortes | Pexels License |
| foundation/hero.jpg | https://www.pexels.com/photo/construction-worker-building-foundation-outdoors-29735767/ | Rodolfo Gaion | Pexels License |
| foundation/foundation-repair.jpg | https://www.pexels.com/photo/close-up-shot-of-a-crack-on-a-concrete-wall-6788272/ | Polina Kovaleva | Pexels License |
| foundation/basement-waterproofing.jpg | https://www.pexels.com/photo/an-empty-basement-4092026/ | Curtis Adams | Pexels License |
| foundation/crawl-space.jpg | https://www.pexels.com/photo/damaged-house-exterior-with-roof-and-wall-issues-36237047/ | Peter Dyllong | Pexels License |
| foundation/concrete-leveling.jpg | https://www.pexels.com/photo/worker-with-gas-mask-operating-concrete-mixer-6082416/ | CONSTRUCCIÓN TOTAL | Pexels License |
| generic/hero.jpg | https://www.pexels.com/photo/modern-house-exterior-with-trees-on-a-lawn-7598364/ | Max Vakhtbovych | Pexels License |

## Re-running the optimizer

If a photo needs to be swapped later:

1. Save the new original into a scratch folder outside the repo, using the
   exact base name from the table above (e.g. `hero.jpg`, `roof-repair.jpg`).
2. `npm i --no-save sharp`
3. `node scripts/optimize-images.mjs <scratchFolder>/<industry> <industry>`
4. Update this table with the new source URL and photographer.
5. `npm test` (the `stock.test.mjs` coverage/size check should stay green).
