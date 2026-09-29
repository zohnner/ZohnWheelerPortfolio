// Pattern facts from page text and the Muse stub. Every fact carries the
// exact quote it came from so scaffold-check can verify it later.

import { wordsMatch, phoneDigits, quoteAround } from './match.mjs';

const PHONE = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY';
// Street and city may be split by a comma or a line break; the street number
// must be followed by spaces on the same line (so a phone number on the line
// above can't start the match).
const ADDRESS = new RegExp(`\\b\\d{1,6}[ \\t]+[A-Za-z0-9.'’ #-]{3,60}?[,\\n]\\s*([A-Za-z.'’ ]{2,40}?),?\\s+(?:${STATES})\\s+\\d{5}(?:-\\d{4})?\\b`);
const FOUNDED = /\b(?:since|established|est\.|founded)\s+(?:in\s+)?((?:19|20)\d{2})\b/i;
const LICENSE = /\b(?:licen[sc]e\b|lic\.)(?:\s*(?:number|no\.?))?\s*[:#]?\s*#?\s*([A-Z0-9][A-Z0-9-]{3,19})\b/gi;
const QUOTED = /^["“”'‘](.{38,})["“”'’]$/;
const DASH_NAME = /^[–—~]\s*([A-Z][A-Za-z.'’ -]{1,40})$/;
const BARE_NAME = /^([A-Z][A-Za-z.'’-]*(?:\s+[A-Z][A-Za-z.'’-]*){0,3})$/;

const lines = (p) => p.text.split('\n');
const src = (p) => `site:${p.path}`;
const fmtPhone = (d) => `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;

export function museText(stub) {
  const b = stub?.business || {};
  const o = stub?.outreach || {};
  return [
    ['name', b.name], ['phone', b.phone], ['email', b.email], ['city', b.city],
    ['google_rating', b.rating], ['review_count', b.reviewCount],
    ['google_maps_url', b.googleMapsUrl], ['current_site', o.currentSite],
  ]
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

export function museFacts(stub) {
  const b = stub?.business || {};
  const out = {};
  const add = (key, museKey, v) => {
    if (v !== undefined && v !== null && v !== '') out[key] = { value: v, source: 'muse', quote: `${museKey}=${v}` };
  };
  add('phone', 'phone', b.phone);
  add('email', 'email', b.email);
  add('city', 'city', b.city);
  add('rating', 'google_rating', b.rating);
  add('reviewCount', 'review_count', b.reviewCount);
  add('googleMapsUrl', 'google_maps_url', b.googleMapsUrl);
  return out;
}

export function findPhone(pages) {
  const all = [];
  for (const p of pages) for (const line of lines(p)) for (const m of line.matchAll(PHONE)) {
    all.push({ digits: m[1] + m[2] + m[3], page: p, line, index: m.index, len: m[0].length });
  }
  const tel = new Set(pages.flatMap((p) => (p.tels || []).map((t) => phoneDigits(t.number))));
  const counts = new Map();
  for (const m of all) counts.set(m.digits, (counts.get(m.digits) || 0) + 1);
  const pick = all.find((m) => tel.has(m.digits)) || [...all].sort((a, b) => counts.get(b.digits) - counts.get(a.digits))[0];
  return pick ? { value: fmtPhone(pick.digits), source: src(pick.page), quote: quoteAround(pick.line, pick.index, pick.len) } : null;
}

export function findEmail(pages) {
  const mailtos = pages.flatMap((p) => (p.mailtos || []).map((e) => e.toLowerCase()));
  const all = [];
  for (const p of pages) for (const line of lines(p)) for (const m of line.matchAll(EMAIL)) {
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(m[0])) continue;
    all.push({ email: m[0].toLowerCase(), page: p, line, index: m.index, len: m[0].length });
  }
  const pick = all.find((a) => mailtos.includes(a.email)) || all[0];
  return pick ? { value: pick.email, source: src(pick.page), quote: quoteAround(pick.line, pick.index, pick.len) } : null;
}

export function findAddress(pages) {
  for (const p of pages) {
    const m = p.text.match(ADDRESS);
    if (!m) continue;
    const quote = m[0];
    return {
      address: { value: quote.replace(/\s*\n\s*/g, ', ').replace(/,\s*,/g, ','), source: src(p), quote },
      city: { value: m[1].trim(), source: src(p), quote },
    };
  }
  return null;
}

export function findFounded(pages, year) {
  for (const p of pages) for (const line of lines(p)) {
    if (/©|\(c\)|copyright/i.test(line)) continue;
    const m = line.match(FOUNDED);
    if (m && Number(m[1]) <= year) return { value: Number(m[1]), source: src(p), quote: quoteAround(line, m.index, m[0].length) };
  }
  return null;
}

export function findLicense(pages) {
  for (const p of pages) for (const line of lines(p)) for (const m of line.matchAll(LICENSE)) {
    if (/\d/.test(m[1])) return { value: m[1], source: src(p), quote: quoteAround(line, m.index, m[0].length) };
  }
  return null;
}

export function findServices(pages, presetServices) {
  const out = [];
  for (const s of presetServices) {
    let hit = null;
    for (const p of pages) {
      const line = lines(p).find((l) => l.length <= 300 && wordsMatch(s.name, l));
      if (line) { hit = { p, line }; break; }
    }
    if (hit) out.push({ slug: s.slug, value: s.name, source: src(hit.p), quote: hit.line });
  }
  return out;
}

export function findTestimonials(pages) {
  const out = [];
  for (const p of pages) {
    if (!/review|testimonial/i.test(`${p.path} ${p.title || ''}`)) continue;
    const ls = lines(p);
    for (let i = 0; i + 1 < ls.length; i++) {
      const body = ls[i].replace(/^-\s+/, '');
      if (body.startsWith('#')) continue;
      const next = ls[i + 1].replace(/^-\s+/, '');
      const quoted = body.match(QUOTED);
      const text = quoted ? quoted[1].trim() : body;
      if (text.length < 40) continue;
      const dash = next.match(DASH_NAME);
      const bare = quoted ? next.match(BARE_NAME) : null;
      const name = (dash || bare)?.[1]?.trim();
      if (!name) continue;
      out.push({ value: { name, text }, source: src(p), quote: `${ls[i]}\n${ls[i + 1]}` });
      i++;
    }
  }
  return out;
}

export function extractFacts({ pages, stub, presetServices, year }) {
  const facts = museFacts(stub);
  const site = {
    phone: findPhone(pages),
    email: findEmail(pages),
    founded: findFounded(pages, year),
    license: findLicense(pages),
  };
  const addr = findAddress(pages);
  if (addr) Object.assign(site, addr);
  for (const [k, v] of Object.entries(site)) if (v) facts[k] = v;
  facts.services = findServices(pages, presetServices);
  facts.testimonials = findTestimonials(pages);
  return facts;
}
