// Turns the /api/status payload into terminal boot lines. Pure apart from the
// fetch in getBootLines, which is injectable and never rejects.

import { PROJECTS } from './content.js';

const TAGS = { online: 'OK', sleeping: 'SLEEP', down: 'DOWN' };
const WIDTH = 46;

const nameOf = (id) => PROJECTS.find((p) => p.id === id)?.name ?? id;
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

export const FALLBACK_LINES = [
  { text: 'kernel zw-os 5.1', tag: 'OK' },
  { text: 'live telemetry unavailable, using cached profile', tag: 'WARN' },
  { text: 'identity module zohn_wheeler', tag: 'OK' },
];

export function formatBootLines(status, latencyMs) {
  const lines = [{ text: 'kernel zw-os 5.1', tag: 'OK' }];
  if (Number.isFinite(latencyMs)) lines.push({ text: `uplink ${Math.round(latencyMs)} ms`, tag: 'OK' });
  if (status?.city) lines.push({ text: `visitor ${status.city}${status.country ? `, ${status.country}` : ''}`, tag: 'OK' });
  if (status?.commit?.message) lines.push({ text: `last commit "${truncate(status.commit.message, 40)}"`, tag: 'OK' });
  for (const p of status?.projects ?? []) {
    lines.push({ text: `service ${nameOf(p.id)}`, tag: TAGS[p.status] ?? 'DOWN' });
  }
  lines.push({ text: 'identity module zohn_wheeler', tag: 'OK' });
  return lines;
}

export function formatLine({ text, tag }) {
  const body = text.length >= WIDTH ? `${text} ` : `${text} `.padEnd(WIDTH, '.');
  return `${body} [ ${tag} ]`;
}

export async function getBootLines({
  url = '/api/status',
  timeoutMs = 1500,
  fetchImpl = globalThis.fetch,
  now = () => performance.now(),
} = {}) {
  try {
    const t0 = now();
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    const latency = now() - t0;
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return formatBootLines(data, latency);
  } catch {
    return FALLBACK_LINES;
  }
}
