// Pure helpers for scripts/site.mjs. Every SQL builder returns ONE statement:
// `wrangler d1 execute --file` is the only safe way to run anything longer.

import { getPreset } from './presets/index.mjs';

export const STATUSES = ['prospect', 'demo', 'pitched', 'viewed', 'meeting', 'won', 'lost', 'live'];

export function sqlString(v) {
  return v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
}

export function pushSql({ id, slug, token, content, now }) {
  const email = content.business?.email || null;
  return `INSERT INTO sites (id, slug, template, status, demo_token, content_json, contact_email, updated_at, created_at)
VALUES (${sqlString(id)}, ${sqlString(slug)}, 'call-now', 'demo', ${sqlString(token)}, ${sqlString(JSON.stringify(content))}, ${sqlString(email)}, ${sqlString(now)}, ${sqlString(now)})
ON CONFLICT(slug) DO UPDATE SET
  content_json = excluded.content_json,
  contact_email = excluded.contact_email,
  updated_at = excluded.updated_at,
  status = CASE WHEN sites.status = 'prospect' THEN 'demo' ELSE sites.status END;
`;
}

export function normalizeDomain(d) {
  const s = String(d ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

export function statusSql({ slug, status, domain, now }) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
  let domainSet = '';
  if (domain !== null && domain !== undefined) {
    const d = normalizeDomain(domain);
    if (!d) throw new Error(`Invalid domain: ${domain}`);
    domainSet = `, domain = ${sqlString(d)}`;
  }
  return `UPDATE sites SET status = ${sqlString(status)}${domainSet}, updated_at = ${sqlString(now)} WHERE slug = ${sqlString(slug)};\n`;
}

// Only advances a site into 'pitched' — never knocks a site that's already
// past that stage (meeting/won/live) back down just because it was pitched
// again, and never revives a 'lost' site this way either.
export function pitchStatusSql({ slug, now }) {
  return `UPDATE sites SET status = 'pitched', updated_at = ${sqlString(now)} WHERE slug = ${sqlString(slug)} AND status IN ('prospect','demo','pitched','viewed');\n`;
}

// Like parseCsv, but a row whose field count differs from the header's is
// reported instead of returned: one stray comma silently shifts every later
// value into the wrong column. `row` counts the header as row 1, skipping
// blank lines.
export function parseCsvChecked(text) {
  const [header, ...data] = csvRecords(text);
  if (!header) return { rows: [], bad: [] };
  const keys = header.map((h) => h.trim().toLowerCase());
  const rows = [];
  const bad = [];
  data.forEach((r, i) => {
    if (r.length === keys.length) rows.push(Object.fromEntries(keys.map((k, j) => [k, r[j].trim()])));
    else bad.push({ row: i + 2, name: (r[0] ?? '').trim(), fields: r.length, expected: keys.length });
  });
  return { rows, bad };
}

export function parseCsv(text) {
  const [header, ...data] = csvRecords(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// Splits CSV text into raw records (arrays of untrimmed fields), dropping blank lines.
function csvRecords(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// Order matters: "foundation repair" contains "air", so foundation is checked
// before HVAC, and HVAC only matches "air" as a whole word. The roofing check
// anchors "roof" to a word start (\b) because "waterproofing" contains "roof"
// as a mid-word substring and would otherwise match roofing before the
// foundation check below ever runs.
export function normalizeIndustry(s) {
  const v = String(s ?? '').toLowerCase();
  if (/\broof|gutter|siding/.test(v)) return 'roofing';
  if (/foundation|waterproof|basement|crawl/.test(v)) return 'foundation';
  if (/hvac|heating|cooling|furnace|\bair\b|a\/c/.test(v)) return 'hvac';
  return 'generic';
}

export function stubFromProspect(row) {
  const industry = normalizeIndustry(row.industry);
  const preset = getPreset(industry);
  const business = { name: String(row.name ?? '').trim() };
  if (row.phone) business.phone = row.phone;
  if (row.email) business.email = row.email;
  if (row.city) business.city = row.city;
  const rating = Number(row.google_rating);
  const count = parseInt(row.review_count, 10);
  if (rating > 0 && count > 0) {
    business.rating = rating;
    business.reviewCount = count;
  }
  if (row.google_maps_url) business.googleMapsUrl = row.google_maps_url;
  const outreach = {};
  if (row.email) outreach.email = row.email;
  if (row.contact_form_url) outreach.contactFormUrl = row.contact_form_url;
  if (row.current_site) outreach.currentSite = row.current_site;
  if (row.notes) outreach.note = row.notes;
  return {
    business,
    industry,
    theme: { ...preset.theme },
    services: preset.services.map(({ slug, name }) => ({ slug, name })),
    areas: row.city ? [{ slug: slugify(row.city), name: row.city, intro: '' }] : [],
    outreach,
  };
}

export function pitchText({ content, link, mailingAddress, senderName = 'Zohn Wheeler', senderUrl = 'https://zohnwheelerportfolio.pages.dev/hire.html' }) {
  if (!String(mailingAddress ?? '').trim()) {
    throw new Error('A physical mailing address is required for commercial email (CAN-SPAM). Set SK_MAILING_ADDRESS.');
  }
  const b = content.business || {};
  const o = content.outreach || {};
  const email = o.email || b.email;
  if (!email && !o.contactFormUrl) {
    return {
      channel: 'none',
      text: `No email or contact form on file for ${b.name}. Call ${b.phone || 'them'} or visit in person instead — don’t send anything through Muse.`,
    };
  }
  const how = email
    ? `Send an email to ${email}.`
    : `Open ${o.contactFormUrl} and submit their contact form with the message below. Use my name and email in the form’s name and email fields.`;
  const message = [
    `Hi ${b.name} team,`,
    '',
    `I’m ${senderName}, a web developer here in Lee’s Summit. I put together a preview of a new website for ${b.name} — it’s free to look at, and there’s nothing to sign:`,
    '',
    link,
    '',
    'It’s built to bring in more calls: click-to-call on every page, an estimate request form, and a page for each service and city you work in.',
    '',
    'If you like it, I can have it live on your own domain quickly. Happy to stop by and walk you through it.',
    '',
    senderName,
    senderUrl,
    '',
    '—',
    mailingAddress,
    'Not interested? Just reply “no thanks” and I won’t contact you again.',
  ].join('\n');
  const lines = [
    'Muse — please send this website pitch for me. Show me the final message and wait for my approval before sending.',
    '',
    `How: ${how}`,
    ...(email ? [`Subject: A new website preview for ${b.name}`] : []),
    '',
    'Message:',
    '',
    message,
  ];
  return { channel: email ? 'email' : 'form', text: lines.join('\n') };
}
