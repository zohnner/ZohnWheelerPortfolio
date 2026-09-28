// Pure helpers for scripts/site.mjs. Every SQL builder returns ONE statement:
// `wrangler d1 execute --file` is the only safe way to run anything longer.

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
  contact_email = COALESCE(sites.contact_email, excluded.contact_email),
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
