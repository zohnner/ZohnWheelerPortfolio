const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

export function parseLead(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  // Honeypot — bots fill every field, real visitors never see this one.
  if (body.website) return { ok: true, spam: true };
  const lead = {
    slug: clip(body.slug, 80),
    token: clip(body.t, 100),
    name: clip(body.name, 200),
    phone: clip(body.phone, 40),
    email: clip(body.email, 200),
    message: clip(body.message, 5000),
  };
  if (!lead.slug) return { ok: false, error: 'Invalid request.' };
  if (!lead.name) return { ok: false, error: 'Please include your name.' };
  if (!lead.phone && !lead.email) return { ok: false, error: 'Please include a phone number or email so we can reach you.' };
  if (lead.email && !EMAIL_RE.test(lead.email)) return { ok: false, error: 'That doesn’t look like a valid email address.' };
  return { ok: true, lead };
}
