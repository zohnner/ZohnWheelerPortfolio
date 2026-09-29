// One self-contained HTML page to review a scaffold batch. Everything in it
// came from scraped sites or AI drafts, so every string is escaped.

import { esc } from '../escape.mjs';

export const BADGES = { ready: '✅ ready', 'needs-look': '⚠️ needs-look', blocked: '❌ blocked' };

const show = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v));
const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="none">None</p>');

export function summaryLine(r) {
  const bits = [
    `brief ${r.briefStatus}`,
    `${r.facts.length} facts`,
    `${r.dropped.length} dropped`,
    `${r.warnings.length + r.validation.warnings.length} warnings`,
  ];
  if (r.validation.errors.length) bits.push(`${r.validation.errors.length} errors`);
  if (r.error) bits.push(r.error);
  return `${BADGES[r.status]}  ${r.slug} — ${bits.join(', ')}`;
}

function factsTable(facts) {
  if (!facts.length) return '<p class="none">None</p>';
  const rows = facts.map((f) => `<tr><td>${esc(f.path)}</td><td>${esc(show(f.value))}</td><td>${esc(f.source)}</td><td>${esc(f.quote)}</td></tr>`).join('');
  return `<table><thead><tr><th>Path</th><th>Value</th><th>Source</th><th>Quote</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function card(r) {
  const validation = [...r.validation.errors.map((e) => `error: ${e}`), ...r.validation.warnings.map((w) => `warning: ${w}`)];
  return `<section class="card ${esc(r.status)}">
<h2>${esc(r.name)} <small>${esc(r.slug)}</small> <span class="badge">${esc(BADGES[r.status])}</span></h2>
${r.error ? `<p class="error">${esc(r.error)}</p>` : ''}
<p>Brief: ${esc(r.briefStatus)}</p>
<details><summary>Fetch log (${r.fetchLog.length})</summary>${list(r.fetchLog)}</details>
<h3>Facts</h3>${factsTable(r.facts)}
<h3>Dropped</h3>${list(r.dropped.map((d) => `${d.path} = ${show(d.value)} — ${d.reason}`))}
<h3>Copy warnings</h3>${list(r.warnings)}
<h3>Validation</h3>${list(validation)}
${r.status === 'blocked' ? '' : `<p>When it looks right: <code>node scripts/site.mjs push ${esc(r.slug)}</code></p>`}
</section>`;
}

const CSS = `body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:16px;background:#f6f7f9;color:#1b1f24}
.card{background:#fff;border:1px solid #d9dde3;border-left:6px solid #999;border-radius:8px;padding:12px 16px;margin:16px 0}
.card.ready{border-left-color:#1a7f37}.card.needs-look{border-left-color:#bf8700}.card.blocked{border-left-color:#cf222e}
h2 small{font-weight:400;color:#57606a}.badge{font-size:.8em;margin-left:.5em}
table{border-collapse:collapse;width:100%;font-size:.9em}td,th{border:1px solid #d9dde3;padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.none{color:#57606a}.error{color:#cf222e;font-weight:600}code{background:#eef1f4;padding:2px 4px;border-radius:4px}
@media (prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}.card{background:#161b22;border-color:#30363d}td,th{border-color:#30363d}code{background:#21262d}h2 small,.none{color:#8b949e}}`;

export function renderReview({ date, results }) {
  const count = (s) => results.filter((r) => r.status === s).length;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scaffold review ${esc(date)}</title><style>${CSS}</style></head><body>
<h1>Scaffold review — ${esc(date)}</h1>
<p class="summary">${count('ready')} ready · ${count('needs-look')} needs a look · ${count('blocked')} blocked</p>
${results.map(card).join('\n')}
</body></html>
`;
}
