import { esc, md } from '../../escape.mjs';
import { icon } from '../../icons.mjs';
import { imgAttrs } from '../../content.mjs';
import { SECTIONS, BANDS, tel, band, head, serviceCard, reviews, areas, cta } from './sections.mjs';
import { faqLd, serviceLd } from './schema.mjs';

export function home(ctx) {
  const { c } = ctx;
  let alt = false;
  const body = c.sectionOrder
    .map((name) => {
      const fn = Object.hasOwn(SECTIONS, name) ? SECTIONS[name] : null;
      if (!fn) return '';
      const html = fn(ctx, alt);
      if (html && BANDS.has(name)) alt = !alt;
      return html;
    })
    .join('');
  const where = c.business.city || 'Kansas City';
  return {
    path: '/',
    title: `${c.business.name} | ${c.trade} in ${where}`,
    description: c.hero.sub || `${c.trade} in ${where}.`,
    body,
    ld: faqLd(c.faq),
  };
}

function pageHero(crumbs, title, sub) {
  const trail = crumbs.map(([h, t]) => `<a href="${h}">${esc(t)}</a>`).join(' / ');
  return `<section class="page-hero"><div class="wrap"><div class="crumbs">${trail}</div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></section>`;
}

function asideCta(ctx) {
  const b = ctx.c.business;
  return `<aside class="aside-card"><h2>${esc(ctx.c.hero.cta || 'Get a Free Estimate')}</h2><p>Call us or send a request online — we’ll get back to you quickly.</p><a class="btn btn-accent" href="${tel(b.phone)}">${icon('phone')}Call ${esc(b.phone)}</a><a class="btn btn-ghost" href="${ctx.href('/contact')}">Request online</a></aside>`;
}

export function service(ctx, { slug }) {
  const { c } = ctx;
  const s = c.services.find((x) => x.slug === slug);
  if (!s) return null;
  const img = imgAttrs(s.image, ctx.slug, '(max-width: 860px) 100vw, 680px');
  const others = c.services.filter((x) => x.slug !== slug);
  const otherHtml = others.length
    ? `<h2 class="sub-h">Other services</h2><ul class="chips">${others.map((o) => `<li><a href="${ctx.href(`/services/${o.slug}`)}">${icon(o.icon)}${esc(o.name)}</a></li>`).join('')}</ul>`
    : '';
  const body =
    pageHero([[ctx.href('/'), 'Home'], [ctx.href('/', '#services'), 'Services']], s.name, s.summary) +
    `<section class="section"><div class="wrap split"><div>${img ? `<div class="rounded"><img ${img} alt="" decoding="async"></div>` : ''}<div class="prose">${md(s.body || s.summary || '')}</div>${otherHtml}</div>${asideCta(ctx)}</div></section>` +
    areas(ctx, true) +
    cta(ctx);
  return {
    path: `/services/${s.slug}`,
    title: `${s.name} | ${c.business.name}`,
    description: s.summary || `${s.name} from ${c.business.name}.`,
    body,
    ld: serviceLd(ctx, s),
  };
}

export function area(ctx, { slug }) {
  const { c } = ctx;
  const a = c.areas.find((x) => x.slug === slug);
  if (!a) return null;
  const title = `${c.trade} in ${a.name}`;
  const body =
    pageHero([[ctx.href('/'), 'Home'], [ctx.href('/', '#areas'), 'Service Areas']], title, `${c.business.name} serves homeowners in ${a.name} and the surrounding area.`) +
    `<section class="section"><div class="wrap split"><div class="prose">${md(a.intro || '')}</div>${asideCta(ctx)}</div></section>` +
    band('', true, `${head('Services', `Our services in ${a.name}`)}<div class="grid">${c.services.map((s) => serviceCard(ctx, s)).join('')}</div>`) +
    reviews(ctx, false) +
    cta(ctx);
  return {
    path: `/areas/${a.slug}`,
    title: `${title} | ${c.business.name}`,
    description: `${title} — call ${c.business.phone} or request an estimate online.`,
    body,
  };
}

const FORM_SCRIPT = `<script>
document.getElementById('lead-form').addEventListener('submit',function(e){e.preventDefault();var f=e.target,s=f.querySelector('.form-status'),b=f.querySelector('button');b.disabled=true;s.textContent='Sending…';
fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))}).then(function(r){return r.json().catch(function(){return{};}).then(function(j){if(r.ok&&j.ok){f.reset();s.textContent='Thanks! We’ll be in touch shortly.';}else{s.textContent=j.error||'Something went wrong. Please call us instead.';}});}).catch(function(){s.textContent='Something went wrong. Please call us instead.';}).finally(function(){b.disabled=false;});});
</script>`;

function leadForm(ctx) {
  return `<form class="form" id="lead-form" novalidate><input type="hidden" name="slug" value="${esc(ctx.slug)}"><input type="hidden" name="t" value="${esc(ctx.token)}"><label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><label>Name<input name="name" required autocomplete="name"></label><label>Phone<input name="phone" type="tel" autocomplete="tel"></label><label>Email<input name="email" type="email" autocomplete="email"></label><label>How can we help?<textarea name="message"></textarea></label><button class="btn btn-accent" type="submit">Send my request</button><p class="form-status" role="status" aria-live="polite"></p></form>`;
}

function exportContact(ctx) {
  const b = ctx.c.business;
  return `<div class="prose"><p>Call us or send an email and we’ll get back to you quickly.</p></div><div class="hero-ctas"><a class="btn btn-accent" href="${tel(b.phone)}">${icon('phone')}Call ${esc(b.phone)}</a>${b.email ? `<a class="btn btn-ghost" href="mailto:${esc(b.email)}">Email us</a>` : ''}</div>`;
}

export function contact(ctx) {
  const b = ctx.c.business;
  const info = [
    ['phone', `<a href="${tel(b.phone)}">${esc(b.phone)}</a>`],
    b.email && ['mail', `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`],
    b.address && ['pin', `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(b.address)}">${esc(b.address)}</a>`],
    b.hours && ['clock', esc(b.hours)],
    b.license && ['shield', `License ${esc(b.license)}`],
  ]
    .filter(Boolean)
    .map(([i, h]) => `<li>${icon(i)}<span>${h}</span></li>`)
    .join('');
  const exporting = ctx.mode === 'export';
  const body =
    pageHero([[ctx.href('/'), 'Home']], ctx.c.hero.cta || 'Get a Free Estimate', 'Tell us a little about your project and we’ll get back to you quickly.') +
    `<section class="section"><div class="wrap split"><div>${exporting ? exportContact(ctx) : leadForm(ctx)}</div><aside class="aside-card"><h2>Contact ${esc(b.name)}</h2><ul class="info-list">${info}</ul></aside></div></section>`;
  return {
    path: '/contact',
    title: `Contact | ${b.name}`,
    description: `Contact ${b.name} — call ${b.phone} or request an estimate online.`,
    body,
    scripts: exporting ? '' : FORM_SCRIPT,
  };
}

export const PAGES = { home, service, area, contact };
