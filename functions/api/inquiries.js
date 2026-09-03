export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = request.headers.get("x-admin-token") || new URL(request.url).searchParams.get("token");
  if (!env.ADMIN_TOKEN || auth !== env.ADMIN_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, name, email, project_type, budget, message, created_at
     FROM inquiries ORDER BY created_at DESC LIMIT 200`
  ).all();

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
