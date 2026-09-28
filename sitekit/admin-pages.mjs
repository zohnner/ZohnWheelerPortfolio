import { esc } from './escape.mjs';

const CSS = 'body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#0f1115;color:#e8eaf0}main{max-width:900px;margin:0 auto;padding:32px 16px}h1{font-size:1.6rem}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #2a2f3a}a{color:#7cc4ff}.pill{display:inline-block;padding:2px 10px;border-radius:999px;background:#2a2f3a;font-size:.85rem}';

const doc = (title, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

export function renderPresenterHome(sites) {
  if (!sites.length) {
    return doc('Presenter · Demo sites', '<h1>Demo sites</h1><p>No demo sites yet. Push one with <code>node scripts/site.mjs push &lt;slug&gt;</code>.</p>');
  }
  const rows = sites
    .map((s) => `<tr><td><a href="/demo/${esc(s.slug)}?t=${esc(s.demo_token)}">${esc(s.name || s.slug)}</a></td><td><span class="pill">${esc(s.status)}</span></td><td>${esc(String(s.updated_at || '').slice(0, 10))}</td></tr>`)
    .join('');
  return doc('Presenter · Demo sites', `<h1>Demo sites</h1><table><thead><tr><th>Business</th><th>Status</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>`);
}

export function renderUnavailable() {
  return doc('Temporarily unavailable', '<h1>We’ll be right back</h1><p>This site is temporarily unavailable. Please try again in a minute.</p>');
}
