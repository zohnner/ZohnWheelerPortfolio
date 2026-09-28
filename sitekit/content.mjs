import { getPreset } from './presets/index.mjs';
import { esc } from './escape.mjs';

// Objects merge shallowly (content keys win); arrays from the content file
// replace the preset's. Facts (trust, areas, reviews, gallery) never come
// from a preset.
const MERGE_OBJECTS = ['hero', 'banner', 'financing', 'theme', 'copy'];
const PRESET_ARRAYS = ['services', 'whyUs', 'faq', 'sectionOrder'];
const CONTENT_ARRAYS = ['trust', 'areas', 'reviews', 'gallery'];

export function resolveContent(content) {
  const preset = getPreset(content.industry);
  const out = {
    industry: preset.industry,
    trade: content.trade || preset.trade,
    schemaType: preset.schemaType,
    business: { ...(content.business || {}) },
  };
  for (const key of MERGE_OBJECTS) out[key] = { ...(preset[key] || {}), ...(content[key] || {}) };
  for (const key of PRESET_ARRAYS) {
    out[key] = Array.isArray(content[key]) && content[key].length ? content[key] : preset[key] || [];
  }
  for (const key of CONTENT_ARRAYS) out[key] = Array.isArray(content[key]) ? content[key] : [];
  // A content service with a preset slug inherits that preset service's copy/icon/image.
  out.services = out.services.map((s) => {
    const base = preset.services.find((p) => p.slug === s.slug) || {};
    return { icon: 'check', ...base, ...s };
  });
  return out;
}

export function resolveImage(ref, slug) {
  const r = String(ref ?? '');
  if (r.startsWith('stock:')) return `/sk/stock/${r.slice(6)}`;
  if (r.startsWith('site:')) return `/sk/sites/${slug}/${r.slice(5)}`;
  if (r.startsWith('https://')) return r;
  return null;
}

// Stock images ship in two sizes (scripts/optimize-images.mjs): <name>.jpg and
// <name>-sm.jpg. Heroes are 1600/800 wide, everything else 1200/600.
export function imgAttrs(ref, slug, sizes) {
  const src = resolveImage(ref, slug);
  if (!src) return null;
  let attrs = `src="${esc(src)}"`;
  if (String(ref).startsWith('stock:')) {
    const small = src.replace(/\.jpg$/, '-sm.jpg');
    const [sw, lw] = /\/hero\.jpg$/.test(src) ? [800, 1600] : [600, 1200];
    attrs += ` srcset="${esc(small)} ${sw}w, ${esc(src)} ${lw}w" sizes="${esc(sizes)}"`;
  }
  return attrs;
}
