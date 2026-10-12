// GET /api/status: live data for the homepage boot sequence. Always 200.
// The visitor's city and country come from request.cf and are echoed back
// to that visitor only; they are never stored or logged.

import { PROJECTS, GITHUB_USER } from '../../public/xp/content.js';

const TIMEOUT_MS = 1200;
const COMMIT_TTL = 600;
const HEALTH_TTL = 300;
const CACHE_ORIGIN = 'https://status-cache.internal';
const GITHUB_HEADERS = { 'User-Agent': 'zohnwheeler-portfolio', Accept: 'application/vnd.github+json' };

async function cached(key, ttl, produce) {
  const cache = globalThis.caches?.default;
  const req = new Request(`${CACHE_ORIGIN}/${key}`);
  if (cache) {
    const hit = await cache.match(req);
    if (hit) return hit.json();
  }
  const value = await produce();
  if (cache) {
    await cache.put(req, new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` },
    }));
  }
  return value;
}

export async function latestCommit(user, fetchImpl = fetch) {
  try {
    const init = { headers: GITHUB_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) };
    const reposRes = await fetchImpl(`https://api.github.com/users/${user}/repos?sort=pushed&per_page=1`, init);
    if (!reposRes.ok) return null;
    const [repo] = await reposRes.json();
    if (!repo?.full_name) return null;
    const commitsRes = await fetchImpl(`https://api.github.com/repos/${repo.full_name}/commits?per_page=1`, init);
    if (!commitsRes.ok) return null;
    const [c] = await commitsRes.json();
    if (!c?.commit) return null;
    return {
      repo: repo.full_name,
      message: String(c.commit.message).split('\n')[0].slice(0, 72),
      date: c.commit.author?.date ?? null,
    };
  } catch {
    return null;
  }
}

export async function checkProject(project, fetchImpl = fetch) {
  const t0 = Date.now();
  try {
    const res = await fetchImpl(project.healthUrl, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    try { await res.body?.cancel(); } catch { /* body already consumed or absent */ }
    const ok = res.status >= 200 && res.status < 400;
    return { id: project.id, status: ok ? 'online' : 'down', ms: ok ? Date.now() - t0 : null };
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return { id: project.id, status: timedOut ? 'sleeping' : 'down', ms: null };
  }
}

export async function onRequestGet(context) {
  const cf = context.request?.cf ?? {};
  const targets = PROJECTS.filter((p) => p.healthUrl);
  let commit = null;
  let projects = targets.map((p) => ({ id: p.id, status: 'down', ms: null }));

  try {
    [commit, projects] = await Promise.all([
      cached('commit', COMMIT_TTL, () => latestCommit(GITHUB_USER)).catch(() => null),
      Promise.all(targets.map((p) =>
        cached(`health/${p.id}`, HEALTH_TTL, () => checkProject(p)).catch(() => ({ id: p.id, status: 'down', ms: null })),
      )),
    ]);
  } catch {
    // Keep the defaults above. This endpoint must always answer 200.
  }

  const body = {
    city: cf.city ?? null,
    country: cf.country ?? null,
    commit,
    projects,
    generatedAt: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
