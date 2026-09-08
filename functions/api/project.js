function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// No rate limiting here on purpose — the token is a 128-bit random value
// (see scripts/new-project.js), so brute-forcing it is computationally
// infeasible regardless. Same trust model as a Stripe invoice link.
export async function onRequestGet(context) {
  const { request, env } = context;
  const token = new URL(request.url).searchParams.get("token") || "";

  if (!token || token.length < 16) {
    return json({ ok: false, error: "Not found" }, 404);
  }

  const project = await env.DB.prepare(
    `SELECT p.id, p.name, p.status, p.staging_url, p.created_at, c.name AS client_name
     FROM projects p JOIN clients c ON c.id = p.client_id
     WHERE p.token = ?`
  )
    .bind(token)
    .first();

  if (!project) {
    return json({ ok: false, error: "Not found" }, 404);
  }

  const { results: updates } = await env.DB.prepare(
    `SELECT body, created_at FROM project_updates WHERE project_id = ? ORDER BY created_at DESC LIMIT 50`
  )
    .bind(project.id)
    .all();

  return json({ ok: true, project, updates });
}
