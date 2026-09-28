import { SECTIONS, BANDS } from './sections.mjs';
import { faqLd } from './schema.mjs';

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

export const PAGES = { home };
