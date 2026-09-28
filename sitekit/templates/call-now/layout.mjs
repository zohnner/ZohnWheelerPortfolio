import { esc } from '../../escape.mjs';
import { icon } from '../../icons.mjs';
import { themeCss, themeVars } from '../../themes.mjs';
import { presenterPanel, PRESENTER_CSS } from '../../presenter-panel.mjs';
import { CSS } from './styles.mjs';
import { tel } from './sections.mjs';
import { businessLd, ldScripts } from './schema.mjs';

function favicon(ctx) {
  const initial = esc((ctx.c.business.name || '?').trim().charAt(0).toUpperCase());
  const { primary, onPrimary } = themeVars(ctx.theme);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${primary}"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="${onPrimary}" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function navLinks(ctx) {
  const { c } = ctx;
  const links = [[ctx.href('/', '#services'), 'Services']];
  if (c.areas.length) links.push([ctx.href('/', '#areas'), 'Service Areas']);
  if (c.reviews.length) links.push([ctx.href('/', '#reviews'), 'Reviews']);
  links.push([ctx.href('/contact'), 'Contact']);
  return links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('');
}

function header(ctx) {
  const b = ctx.c.business;
  const links = navLinks(ctx);
  return `<header class="site-header"><div class="wrap"><a class="brand" href="${ctx.href('/')}">${esc(b.name)}</a><nav class="nav" aria-label="Main">${links}<a class="btn btn-accent header-call" href="${tel(b.phone)}">${icon('phone')}${esc(b.phone)}</a></nav><details class="menu"><summary aria-label="Menu">${icon('menu')}</summary><nav aria-label="Mobile">${links}</nav></details></div></header>`;
}

function banner(ctx) {
  const bn = ctx.c.banner;
  if (!bn.enabled || !bn.text) return '';
  return `<div class="banner">${esc(bn.text)}<a href="${tel(ctx.c.business.phone)}">Call ${esc(ctx.c.business.phone)}</a></div>`;
}

function ribbon(ctx) {
  return `<div class="ribbon">Preview built for ${esc(ctx.c.business.name)}<a href="/hire.html#contact-form">Make it yours →</a></div>`;
}

function footer(ctx) {
  const { c } = ctx;
  const b = c.business;
  const info = [
    b.address && `<li>${esc(b.address)}</li>`,
    `<li><a href="${tel(b.phone)}">${esc(b.phone)}</a></li>`,
    b.email && `<li><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></li>`,
    b.hours && `<li>${esc(b.hours)}</li>`,
    b.license && `<li>License ${esc(b.license)}</li>`,
  ].filter(Boolean).join('');
  const svc = c.services.map((s) => `<li><a href="${ctx.href(`/services/${s.slug}`)}">${esc(s.name)}</a></li>`).join('');
  const ar = c.areas.map((a) => `<li><a href="${ctx.href(`/areas/${a.slug}`)}">${esc(a.name)}</a></li>`).join('');
  return `<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div><h2>${esc(b.name)}</h2><ul>${info}</ul></div><div><h2>Services</h2><ul>${svc}</ul></div>${ar ? `<div><h2>Service Areas</h2><ul>${ar}</ul></div>` : ''}</div><p class="legal">© ${ctx.year} ${esc(b.name)}. All rights reserved.</p></div></footer>`;
}

function callbar(ctx) {
  return `<nav class="callbar" aria-label="Quick contact"><a class="call" href="${tel(ctx.c.business.phone)}">${icon('phone')}Call Now</a><a class="quote" href="${ctx.href('/contact')}">${esc(ctx.c.hero.cta || 'Free Estimate')}</a></nav>`;
}

export function layout(ctx, page) {
  const demo = ctx.mode === 'demo';
  const canonical = !demo && ctx.origin ? `<link rel="canonical" href="${esc(ctx.origin + page.path)}">` : '';
  const robots = demo ? '<meta name="robots" content="noindex, nofollow">' : '';
  const ogImage = demo && ctx.origin ? `<meta property="og:image" content="${esc(ctx.origin)}/og-image-hire.png">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${robots}${canonical}
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:type" content="website">
${ogImage}
<meta name="theme-color" content="${themeVars(ctx.theme).primary}">
<link rel="icon" href="${favicon(ctx)}">
<style>${themeCss(ctx.theme)}${CSS}${ctx.presenter ? PRESENTER_CSS : ''}</style>
${ldScripts([businessLd(ctx), ...(page.ld || [])])}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${demo ? ribbon(ctx) : ''}${banner(ctx)}${header(ctx)}
<main id="main">${page.body}</main>
${footer(ctx)}${callbar(ctx)}${page.scripts || ''}${ctx.presenter ? presenterPanel(ctx) : ''}
</body>
</html>
`;
}
