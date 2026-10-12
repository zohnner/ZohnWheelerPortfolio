// Output for the live-data commands (ping, git log, top, scan, history) and
// the small fetchers they use. Formatters are pure; every number they print
// comes from real data passed in.

import { bar, frame, table } from './tui.js';

export function pingLine(host, ms) {
  return ms == null ? 'Request timed out.' : `reply from ${host}: time=${Math.round(ms)} ms`;
}

export function pingSummary(host, samples) {
  const got = samples.filter((m) => m != null).map(Math.round);
  const loss = Math.round((1 - got.length / samples.length) * 100);
  const lines = [`--- ${host} ping statistics ---`, `${samples.length} sent, ${got.length} answered, ${loss}% loss`];
  if (got.length) {
    const avg = Math.round(got.reduce((a, b) => a + b, 0) / got.length);
    lines.push(`min/avg/max = ${Math.min(...got)}/${avg}/${Math.max(...got)} ms`);
  }
  return lines;
}

export function parseCount(args, { def = 5, max = 10 } = {}) {
  const m = /-n\s*(\d+)|-(\d+)/.exec(args.join(' '));
  const n = m ? Number(m[1] ?? m[2]) : def;
  return Math.min(max, Math.max(1, Number.isFinite(n) && n > 0 ? n : def));
}

const shortRepo = (r) => String(r ?? '').split('/').pop();

export function formatGitLog(commits, n) {
  return commits.slice(0, n).map((c) => `${c.sha7}  ${String(c.date ?? '').slice(0, 10)}  ${shortRepo(c.repo).padEnd(18)} ${c.message}`);
}

export function formatTop(statuses, projects) {
  const rows = statuses.map((s, i) => {
    const p = projects.find((x) => x.id === s.id);
    return [String(101 + i), p?.name ?? s.id, String(s.status).toUpperCase(), s.ms == null ? '-' : `${s.ms} ms`, p?.stack?.[0] ?? ''];
  });
  return table(['PID', 'NAME', 'STATUS', 'LATENCY', 'STACK'], rows);
}

export function formatScan(scan) {
  const { top, bottom } = frame(`scan: ${scan.repo}`, 46);
  const langs = Object.entries(scan.languages ?? {});
  return [
    top,
    ...langs.map(([name, pct]) => `  ${name.padEnd(12)} ${bar(pct / 100, 14)} ${String(pct).padStart(3)}%`),
    `  commits      ${scan.commits ?? 'unknown'}`,
    `  last push    ${String(scan.pushedAt ?? '').slice(0, 10) || 'unknown'}`,
    `  stars        ${scan.stars ?? 'unknown'}`,
    bottom,
  ];
}

export function daysSince(iso, now) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
}

export function verdict(scan, now) {
  const first = Object.keys(scan.languages ?? {})[0];
  const lead = first ? `${first}-led` : 'language mix unknown';
  const c = scan.commits ?? null;
  const depth = c == null ? null : c >= 200 ? 'a deep commit history' : c >= 50 ? 'a solid commit history' : 'a young codebase';
  const days = daysSince(scan.pushedAt, now);
  const ago = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  const activity = days == null ? 'activity unknown'
    : days <= 14 ? `actively developed (last push ${ago})`
      : days <= 90 ? `maintained (last push ${ago})`
        : `resting for now (last push ${ago})`;
  const history = c == null ? 'an unknown number of commits' : `${depth} of ${c} commits`;
  return `Verdict: ${lead}, ${history}, ${activity}.`;
}

export function formatHistory(log) {
  const lines = [
    `I was assembled in ${log.commits} commits, from ${log.firstDate} to ${log.lastDate}.`,
    `That came to ${log.filesChanged} file changes: +${log.insertions} and -${log.deletions} lines.`,
    `${log.tests} unit tests cover my logic.`,
  ];
  if (log.coAuthors?.length) {
    lines.push(`My code was written by AI agents (${log.coAuthors.join(', ')}), working from a plan, with every task reviewed before it landed.`);
  }
  lines.push('Zohn wrote the brief, approved the design and made the calls. The agents did the typing.');
  return lines;
}

const MARKS = { success: '[ OK ]', failure: '[FAIL]', skipped: '[SKIP]', cancelled: '[SKIP]' };
const utc = (iso) => `${String(iso ?? '').slice(0, 16).replace('T', ' ')} UTC`;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function gateLine(step) {
  return `  ${MARKS[step.conclusion] ?? '[ .. ]'} ${step.name}`;
}

export function formatPipeline({ ci, monitor }) {
  const passed = ci.steps.filter((s) => s.conclusion === 'success').length;
  const footer = [`${passed}/${ci.steps.length} gates passed. result: ${String(ci.conclusion ?? ci.status ?? 'unknown').toUpperCase()}.`];
  if (monitor) footer.push(`nightly contract monitor: last run ${utc(monitor.date)}, ${String(monitor.conclusion ?? monitor.status ?? 'unknown').toUpperCase()}.`);
  return {
    header: [`${ci.workflow} on main @ ${ci.sha7}  "${ci.title}"`, `ran ${utc(ci.date)}`],
    footer,
  };
}

export function formatDecisionList({ total, recent }) {
  return [
    `SportStrata decision log: ${total} entries. latest:`,
    ...recent.map((e) => `  ${e.id.padEnd(6)} ${clip(e.title, 64)}`),
    "type 'decisions D-135' to read one.",
  ];
}

export function formatDecision(e) {
  const lines = [`${e.id}  ${e.title}`];
  const meta = [e.status, e.date].filter(Boolean).join(' · ');
  if (meta) lines.push(`status: ${meta}`);
  if (e.excerpt) lines.push('', e.excerpt);
  return lines;
}

export function formatNotes(notes) {
  return notes.map((n) => ({ prefix: `${n.id}  ${n.date}  `, text: n.title, href: n.href }));
}

export async function fetchJson(url,{ timeoutMs = 4000, fetchImpl = globalThis.fetch } = {}) {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function pingOnce(url, { timeoutMs = 3000, fetchImpl = globalThis.fetch, now = () => performance.now() } = {}) {
  const t0 = now();
  try {
    const sep = url.includes('?') ? '&' : '?';
    await fetchImpl(`${url}${sep}zwping=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return now() - t0;
  } catch {
    return null;
  }
}
