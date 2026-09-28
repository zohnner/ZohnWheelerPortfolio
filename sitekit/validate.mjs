import { PRESETS } from './presets/index.mjs';
import { THEMES, isHex } from './themes.mjs';
import { resolveImage } from './content.mjs';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_AREA_INTRO = 300;
const DUPLICATE_THRESHOLD = 0.8;

const words = (s) => String(s ?? '').toLowerCase().match(/[a-z0-9']+/g) || [];

export function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

function checkImage(ref, label, { slug, fileExists }, errors) {
  if (!ref) return;
  const src = resolveImage(ref, slug);
  if (!src) return errors.push(`${label}: use stock:, site:, or an https:// URL`);
  if (src.startsWith('/') && !fileExists(`public${src}`)) errors.push(`${label}: file not found (public${src})`);
}

function checkSlugs(list, name, errors) {
  const seen = new Set();
  list.forEach((item, i) => {
    if (!item?.slug || !SLUG.test(item.slug)) errors.push(`${name}[${i}].slug must be lowercase-hyphenated`);
    else if (seen.has(item.slug)) errors.push(`duplicate ${name} slug "${item.slug}"`);
    else seen.add(item.slug);
    if (!item?.name) errors.push(`${name}[${i}].name is required`);
  });
}

export function validateContent(c, opts) {
  const errors = [];
  const warnings = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { errors: ['content must be a JSON object'], warnings };

  const b = c.business || {};
  if (!b.name) errors.push('business.name is required');
  if (!b.phone) errors.push('business.phone is required');
  else if (String(b.phone).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '').length !== 10) {
    errors.push('business.phone must have 10 digits');
  }

  if (!c.industry) errors.push('industry is required');
  else if (!Object.hasOwn(PRESETS, c.industry)) {
    errors.push(`industry "${c.industry}" is not one of: ${Object.keys(PRESETS).join(', ')}`);
  }

  const services = Array.isArray(c.services) ? c.services : [];
  if (!services.length) errors.push('services must have at least one entry');
  checkSlugs(services, 'services', errors);

  const areas = Array.isArray(c.areas) ? c.areas : [];
  checkSlugs(areas, 'areas', errors);
  areas.forEach((a, i) => {
    if (String(a?.intro ?? '').length < MIN_AREA_INTRO) {
      warnings.push(`areas[${i}] (${a?.slug}) intro is under ${MIN_AREA_INTRO} characters — thin city pages can hurt search ranking`);
    }
  });
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      if (similarity(areas[i].intro, areas[j].intro) > DUPLICATE_THRESHOLD) {
        warnings.push(`areas ${areas[i].slug} and ${areas[j].slug} intros are nearly identical — write something specific to each city`);
      }
    }
  }

  if (c.theme) {
    if (c.theme.preset !== undefined && !Object.hasOwn(THEMES, c.theme.preset)) {
      errors.push(`theme.preset "${c.theme.preset}" is not one of: ${Object.keys(THEMES).join(', ')}`);
    }
    if (c.theme.accent !== undefined && !isHex(c.theme.accent)) errors.push('theme.accent must be #rrggbb');
    if (c.theme.mode !== undefined && !['light', 'dark'].includes(c.theme.mode)) errors.push('theme.mode must be light or dark');
  }

  (Array.isArray(c.reviews) ? c.reviews : []).forEach((r, i) => {
    if (!r?.name || !r?.text || !Number.isInteger(r?.rating) || r.rating < 1 || r.rating > 5) {
      errors.push(`reviews[${i}] needs name, text, and a rating from 1 to 5`);
    }
  });

  checkImage(c.hero?.image, 'hero.image', opts, errors);
  services.forEach((s, i) => checkImage(s?.image, `services[${i}].image`, opts, errors));
  (Array.isArray(c.gallery) ? c.gallery : []).forEach((g, i) => {
    checkImage(g?.before, `gallery[${i}].before`, opts, errors);
    checkImage(g?.after, `gallery[${i}].after`, opts, errors);
  });

  return { errors, warnings };
}
