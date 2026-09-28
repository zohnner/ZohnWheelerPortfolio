const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const areaNames = (ctx) => (ctx.c.areas.length ? ctx.c.areas.map((a) => a.name) : undefined);

export function businessLd(ctx) {
  const { c } = ctx;
  const b = c.business;
  return strip({
    '@context': 'https://schema.org',
    '@type': c.schemaType,
    name: b.name,
    telephone: b.phone,
    email: b.email,
    address: b.address,
    url: ctx.mode !== 'demo' && ctx.origin ? `${ctx.origin}/` : undefined,
    foundingDate: b.founded ? String(b.founded) : undefined,
    areaServed: areaNames(ctx),
  });
}

export function faqLd(items) {
  if (!items.length) return [];
  return [{
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }];
}

export function serviceLd(ctx, s) {
  const b = ctx.c.business;
  return [strip({
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: s.name,
    description: s.summary,
    provider: strip({ '@type': ctx.c.schemaType, name: b.name, telephone: b.phone }),
    areaServed: areaNames(ctx),
  })];
}

// "<" is escaped so content can never close the script tag.
export function ldScripts(objects) {
  return objects.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
}
