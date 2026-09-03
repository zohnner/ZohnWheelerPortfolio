const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MIN = 10;
const RATE_LIMIT_MAX = 3;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // Honeypot — bots fill every field, real users never see this one.
  if (body.website) {
    return json({ ok: true });
  }

  const name = String(body.name || "").trim().slice(0, 200);
  const email = String(body.email || "").trim().slice(0, 200);
  const projectType = String(body.type || "").trim().slice(0, 60);
  const budget = String(body.budget || "").trim().slice(0, 60);
  const message = String(body.message || "").trim().slice(0, 5000);

  if (!name || !email || !message) {
    return json({ ok: false, error: "Name, email, and a message are required." }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "That doesn't look like a valid email address." }, 400);
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
  const { results: recent } = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM inquiries WHERE ip = ? AND created_at > ?`
  )
    .bind(ip, windowStart)
    .all();
  if ((recent[0]?.n || 0) >= RATE_LIMIT_MAX) {
    return json({ ok: false, error: "Too many submissions — please try again in a few minutes." }, 429);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO inquiries (id, name, email, project_type, budget, message, created_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, name, email, projectType, budget, message, createdAt, ip, userAgent)
    .run();

  if (env.RESEND_API_KEY) {
    context.waitUntil(notify(env, { name, email, projectType, budget, message }));
  }

  return json({ ok: true });
}

async function notify(env, { name, email, projectType, budget, message }) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM || "onboarding@resend.dev",
        to: "zohnwheeler@gmail.com",
        reply_to: email,
        subject: `New project inquiry — ${projectType || "Website"} (${name})`,
        text:
          `Name: ${name}\n` +
          `Email: ${email}\n` +
          `Project Type: ${projectType}\n` +
          `Rough Budget: ${budget}\n\n` +
          `${message}`,
      }),
    });
  } catch {
    // Best effort — the lead is already saved in D1 even if the email fails.
  }
}
