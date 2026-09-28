import { isPresenter } from '../../sitekit/presenter.mjs';
import { resolveTheme } from '../../sitekit/themes.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Presenter-only: persists the look chosen in the room. Run
// `node scripts/site.mjs pull <slug>` afterwards to sync the content file.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isPresenter(request.headers.get('cookie'), env.ADMIN_TOKEN))) {
    return json({ ok: false, error: 'Not found' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const slug = String(body?.slug || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ ok: false, error: 'Invalid slug.' }, 400);
  const theme = resolveTheme({}, body.theme || {});

  const result = await env.DB.prepare(
    `UPDATE sites SET content_json = json_set(content_json, '$.theme', json(?)), updated_at = ? WHERE slug = ?`
  )
    .bind(JSON.stringify(theme), new Date().toISOString(), slug)
    .run();
  if (!result.meta?.changes) return json({ ok: false, error: 'Not found' }, 404);
  return json({ ok: true, theme });
}
