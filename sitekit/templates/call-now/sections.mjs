import { esc, md, safeUrl } from '../../escape.mjs';
import { icon } from '../../icons.mjs';
import { imgAttrs } from '../../content.mjs';

export function tel(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return `tel:+1${digits}`;
}

export function head(eyebrow, title, intro) {
  return `<div class="section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}</div>`;
}

export function band(id, alt, inner) {
  return `<section class="section${alt ? ' alt' : ''}"${id ? ` id="${id}"` : ''}><div class="wrap">${inner}</div></section>`;
}

export function ctaButtons(ctx) {
  const { business, hero } = ctx.c;
  return `<div class="hero-ctas"><a class="btn btn-accent" href="${tel(business.phone)}">${icon('phone')}Call ${esc(business.phone)}</a><a class="btn btn-ghost" href="${ctx.href('/contact')}">${esc(hero.cta || 'Get a Free Estimate')}</a></div>`;
}

export function hero(ctx) {
  const { c } = ctx;
  const img = imgAttrs(c.hero.image, ctx.slug, '100vw');
  const where = c.business.city ? `Serving ${c.business.city} & nearby` : 'Serving the Kansas City metro';
  const eyebrow = `${c.business.emergency ? '24/7 emergency service' : c.trade} · ${where}`;
  return `<section class="hero">${img ? `<div class="hero-media"><img ${img} alt="" fetchpriority="high" decoding="async"></div>` : ''}<div class="wrap"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(c.hero.headline)}</h1>${c.hero.sub ? `<p>${esc(c.hero.sub)}</p>` : ''}${ctaButtons(ctx)}</div></section>`;
}

export function trust(ctx) {
  const { business: b, trust: badges } = ctx.c;
  const items = [];
  const years = ctx.year - Number(b.founded);
  if (b.founded && years >= 2) items.push(['clock', esc(`${years}+ years in business`)]);
  if (b.rating && b.reviewCount) {
    const text = esc(`Rated ${Number(b.rating).toFixed(1)} on Google Maps (${b.reviewCount} reviews)`);
    items.push(['star', b.googleMapsUrl ? `<a href="${esc(safeUrl(b.googleMapsUrl))}" rel="noopener">${text}</a>` : text]);
  }
  if (b.license) items.push(['shield', esc(`Licensed · ${b.license}`)]);
  for (const t of badges) items.push(['check', esc(t)]);
  if (!items.length) return '';
  // Every item is already escaped HTML (the rating may be a link).
  return `<section class="trust" aria-label="Credentials"><div class="wrap"><ul>${items.map(([i, html]) => `<li>${icon(i)}${html}</li>`).join('')}</ul></div></section>`;
}

export function serviceCard(ctx, s) {
  const img = imgAttrs(s.image, ctx.slug, '(max-width: 860px) 100vw, 360px');
  // No photo → an icon panel of the same size, so a row of cards mixing preset
  // services (photos) and custom ones still lines up.
  const media = img
    ? `<div class="card-media"><img ${img} alt="" loading="lazy" decoding="async"></div>`
    : `<div class="card-media card-media-icon">${icon(s.icon)}</div>`;
  return `<a class="card" href="${ctx.href(`/services/${s.slug}`)}">${media}<div class="card-body"><h3>${icon(s.icon)}${esc(s.name)}</h3>${s.summary ? `<p>${esc(s.summary)}</p>` : ''}<span class="more">Learn more</span></div></a>`;
}

export function services(ctx, alt) {
  const { c } = ctx;
  if (!c.services.length) return '';
  return band('services', alt, `${head('What we do', `${c.trade} services`, c.copy.servicesIntro)}<div class="grid">${c.services.map((s) => serviceCard(ctx, s)).join('')}</div>`);
}

export function whyUs(ctx, alt) {
  const { c } = ctx;
  if (!c.whyUs.length) return '';
  const items = c.whyUs.map((w) => `<div class="feature">${icon(w.icon, 'icon feature-icon')}<h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join('');
  return band('why-us', alt, `${head('Why choose us', c.copy.whyUsTitle || `Why ${c.business.name}`)}<div class="features">${items}</div>`);
}

export function gallery(ctx, alt) {
  const items = ctx.c.gallery
    .map((g) => {
      const sizes = '(max-width: 860px) 50vw, 280px';
      const before = imgAttrs(g.before, ctx.slug, sizes);
      const after = imgAttrs(g.after, ctx.slug, sizes);
      if (!before || !after) return '';
      return `<div class="gallery-item"><div class="ba"><figure><img ${before} alt="Before" loading="lazy" decoding="async"><figcaption>Before</figcaption></figure><figure><img ${after} alt="After" loading="lazy" decoding="async"><figcaption>After</figcaption></figure></div>${g.caption ? `<p>${esc(g.caption)}</p>` : ''}</div>`;
    })
    .join('');
  if (!items) return '';
  return band('work', alt, `${head('Our work', 'Before & after')}<div class="grid">${items}</div>`);
}

function stars(n) {
  const count = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return `<div class="stars" role="img" aria-label="${count} out of 5 stars">${icon('star').repeat(count)}</div>`;
}

function mapsButton(b) {
  if (!b.googleMapsUrl) return '';
  return `<p class="reviews-more"><a class="btn btn-ghost" href="${esc(safeUrl(b.googleMapsUrl))}" rel="noopener">See our reviews on Google Maps</a></p>`;
}

export function reviews(ctx, alt) {
  const { c } = ctx;
  const b = c.business;
  const button = mapsButton(b);
  if (!c.reviews.length && !button) return '';
  const intro = b.rating && b.reviewCount ? `Rated ${Number(b.rating).toFixed(1)} out of 5 on Google Maps (${b.reviewCount} reviews).` : '';
  const items = c.reviews
    .map((r) => `<figure class="review">${r.rating ? stars(r.rating) : ''}<blockquote>${esc(r.text)}</blockquote><figcaption>${esc(r.name)}${r.source ? ` <span>· ${esc(r.source)}</span>` : ''}</figcaption></figure>`)
    .join('');
  const title = c.reviews.length ? 'What customers say' : 'Find us on Google Maps';
  return band('reviews', alt, `${head('Reviews', title, intro)}${items ? `<div class="reviews">${items}</div>` : ''}${button}`);
}

export function areaChips(ctx) {
  return `<ul class="chips">${ctx.c.areas.map((a) => `<li><a href="${ctx.href(`/areas/${a.slug}`)}">${icon('pin')}${esc(a.name)}</a></li>`).join('')}</ul>`;
}

export function areas(ctx, alt) {
  if (!ctx.c.areas.length) return '';
  return band('areas', alt, `${head('Service area', 'Where we work', ctx.c.copy.areasIntro)}${areaChips(ctx)}`);
}

export function financing(ctx, alt) {
  const f = ctx.c.financing;
  if (!f.enabled || !f.text) return '';
  return band('', alt, `<div class="financing"><div><h2>${esc(f.title || 'Financing available')}</h2><div class="prose">${md(f.text)}</div></div><a class="btn btn-accent" href="${ctx.href('/contact')}">Ask about financing</a></div>`);
}

export function faq(ctx, alt) {
  const items = ctx.c.faq;
  if (!items.length) return '';
  const list = items.map((f) => `<details><summary>${esc(f.q)}</summary><div class="answer">${md(f.a)}</div></details>`).join('');
  return band('faq', alt, `${head('FAQ', 'Common questions')}<div class="faq">${list}</div>`);
}

export function cta(ctx) {
  const { copy } = ctx.c;
  return `<section class="cta-band section"><div class="wrap"><h2>${esc(copy.ctaTitle || 'Ready to get started?')}</h2>${copy.ctaText ? `<p>${esc(copy.ctaText)}</p>` : ''}${ctaButtons(ctx)}</div></section>`;
}

export const SECTIONS = { hero, trust, services, whyUs, gallery, reviews, areas, financing, faq, cta };
// Bands alternate background; hero/trust/cta have their own.
export const BANDS = new Set(['services', 'whyUs', 'gallery', 'reviews', 'areas', 'financing', 'faq']);
