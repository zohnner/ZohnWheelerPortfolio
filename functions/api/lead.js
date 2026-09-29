import { parseLead } from '../../sitekit/lead.mjs';
import { safeEqual } from '../../sitekit/presenter.mjs';

const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 3;
const OWNER_EMAIL = 'zohnwheeler@gmail.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Demo submissions (carrying the demo token) go to Zohn so a prospect testing
// their own form doesn't get a confusing email. Live submissions must come
// from the site's own domain and go to the business.
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const parsed = parseLead(body);
  if (!parsed.ok) return json(parsed, 400);
  if (parsed.spam) return json({ ok: true });
  const { lead } = parsed;

  let site;
  let mode;
  if (lead.token) {
    site = await env.DB.prepare(`SELECT id, content_json, contact_email, demo_token FROM sites WHERE slug = ? AND status != 'lost'`).bind(lead.slug).first();
    if (!site || !safeEqual(lead.token, site.demo_token)) return json({ ok: false, error: 'Not found' }, 404);
    mode = 'demo';
  } else {
    const host = new URL(request.url).hostname.toLowerCase().replace(/^www\./, '');
    site = await env.DB.prepare(`SELECT id, content_json, contact_email FROM sites WHERE slug = ? AND status = 'live' AND domain = ?`)
      .bind(lead.slug, host)
      .first();
    if (!site) return json({ ok: false, error: 'Not found' }, 404);
    mode = 'live';
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
  const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM site_leads WHERE ip = ? AND created_at > ?`).bind(ip, windowStart).first();
  if ((recent?.n || 0) >= RATE_LIMIT_MAX) {
    return json({ ok: false, error: 'Too many submissions — please try again in a few minutes.' }, 429);
  }

  await env.DB.prepare(
    `INSERT INTO site_leads (id, site_id, mode, name, phone, email, message, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), site.id, mode, lead.name, lead.phone, lead.email, lead.message, ip, new Date().toISOString())
    .run();

  if (env.RESEND_API_KEY) {
    const businessName = JSON.parse(site.content_json).business?.name || lead.slug;
    const to = mode === 'live' && site.contact_email ? site.contact_email : OWNER_EMAIL;
    context.waitUntil(notify(env, { to, mode, businessName, lead }));
  }

  return json({ ok: true });
}

async function notify(env, { to, mode, businessName, lead }) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM || 'onboarding@resend.dev',
        to,
        ...(lead.email ? { reply_to: lead.email } : {}),
        subject: `${mode === 'demo' ? `[DEMO: ${businessName}] ` : ''}New estimate request — ${lead.name}`,
        text: `Name: ${lead.name}\nPhone: ${lead.phone}\nEmail: ${lead.email}\n\n${lead.message}`,
      }),
    });
  } catch {
    // Best effort — the lead is already saved in D1.
  }
}
