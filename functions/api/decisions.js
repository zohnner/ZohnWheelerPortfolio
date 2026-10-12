// GET /api/decisions[?id=D-135]: SportStrata's real decision log, read from
// the public repo's DECISIONS.md and parsed into entries. Without an id it
// lists the newest entries; with one it returns that entry's excerpt.
// Always 200; failures are honest and never cached.

import { PROJECTS } from '../../public/xp/content.js';
import { cached, json } from '../../server/github.mjs';

const REPO = PROJECTS.find((p) => p.id === 'sportstrata').repo;
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/main/DECISIONS.md`;
const SOURCE_URL = `https://github.com/${REPO}/blob/main/DECISIONS.md`;
const EXCERPT_MAX = 360;
const STATUS_MAX = 140;
const RECENT = 8;

const HEADING = /^##\s+(D-\d+)\s*[—–-]+\s*(.+?)\s*$/;
const TRAILING_DATE = /\s+[—–-]+\s+(\d{4}-\d{2}-\d{2})\s*$/;
const META_LINE = /^\*\*(Status|Contributors|Date|Owner|Trigger owner)\b[^*]*:\*\*/;
const BARE_LABEL = /^\*\*[^*]+:\*\*\s*$/;

const stripMd = (s) => String(s)
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\*\*|__|`/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function cap(s, max = EXCERPT_MAX) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 0 ? space : max).replace(/[\s,;:—–-]+$/, '')}…`;
}

function paragraphs(lines) {
  const out = [];
  let cur = [];
  for (const line of lines) {
    if (!line.trim() || /^-{3,}\s*$/.test(line.trim())) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(line.trim());
  }
  if (cur.length) out.push(cur);
  return out;
}

function parseEntry(id, rawTitle, body) {
  let title = rawTitle;
  let date = null;
  const dated = TRAILING_DATE.exec(title);
  if (dated) { date = dated[1]; title = title.slice(0, dated.index); }

  let status = null;
  for (const line of body) {
    const s = /^\*\*Status:\*\*\s*(.+)$/.exec(line.trim());
    if (s && status == null) {
      const [head, ...rest] = stripMd(s[1]).split(/\s+\|\s+/);
      status = cap(head, STATUS_MAX);
      const inline = rest.map((part) => /^Date:\s*(\d{4}-\d{2}-\d{2})/.exec(part)).find(Boolean);
      if (inline && date == null) date = inline[1];
    }
    const d = /^\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(line.trim());
    if (d && date == null) date = d[1];
  }

  const paras = paragraphs(body).filter((p) => !p.every((l) => META_LINE.test(l)));
  const label = (p) => (/^\*\*([^*]+?)\*\*/.exec(p[0])?.[1] ?? '').toLowerCase();
  const chosen = paras.find((p) => /^decision\b(?! needed)/.test(label(p)))
    ?? paras.find((p) => !/^trigger\b/.test(label(p)))
    ?? paras[0] ?? [];
  const text = (BARE_LABEL.test(chosen[0] ?? '') ? chosen.slice(1) : chosen).join(' ');

  return { id, title: stripMd(title), status, date, excerpt: text ? cap(stripMd(text)) : null };
}

export function parseDecisions(md) {
  const entries = [];
  let current = null;
  for (const line of String(md).split(/\r?\n/)) {
    const h = HEADING.exec(line);
    if (h) {
      if (current) entries.push(parseEntry(current.id, current.title, current.body));
      current = { id: h[1], title: h[2], body: [] };
    } else if (current) {
      if (/^#{1,2}\s/.test(line)) { entries.push(parseEntry(current.id, current.title, current.body)); current = null; }
      else current.body.push(line);
    }
  }
  if (current) entries.push(parseEntry(current.id, current.title, current.body));
  return entries;
}

export function normalizeId(raw) {
  const m = /^\s*d?\s*-?\s*(\d{1,4})\s*$/i.exec(String(raw ?? ''));
  return m ? `D-${m[1].padStart(3, '0')}` : null;
}

async function loadDecisions(fetchImpl = fetch) {
  const res = await fetchImpl(RAW_URL, { headers: { 'User-Agent': 'zohnwheeler-portfolio' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`decisions ${res.status}`);
  const entries = parseDecisions(await res.text());
  if (!entries.length) throw new Error('no entries parsed');
  return entries;
}

export async function onRequestGet(context) {
  let entries;
  try {
    entries = await cached('decisions', 3600, () => loadDecisions());
  } catch {
    return json({ ok: false, error: 'upstream unavailable' });
  }
  const param = new URL(context.request.url).searchParams.get('id');
  if (param != null) {
    const id = normalizeId(param);
    const entry = id && entries.find((e) => e.id === id);
    return entry ? json({ ok: true, entry, source: SOURCE_URL }) : json({ ok: false, error: 'no such decision' });
  }
  const recent = entries.slice(-RECENT).reverse().map(({ excerpt, ...rest }) => rest);
  return json({ ok: true, total: entries.length, recent, source: SOURCE_URL });
}
