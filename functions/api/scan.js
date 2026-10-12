// GET /api/scan?id=<projectId>: real repo stats for one project with a public
// repo. Always 200; failures are honest and never cached.

import { PROJECTS } from '../../public/xp/content.js';
import { gh, cached, json } from '../../server/github.mjs';

export function parseLastPage(link) {
  const m = /[?&]page=(\d+)>;\s*rel="last"/.exec(link ?? '');
  return m ? Number(m[1]) : null;
}

export async function scanRepo(repo, { env, fetchImpl = fetch } = {}) {
  const opts = { env, fetchImpl };
  const [repoRes, langRes, commitsRes] = await Promise.all([
    gh(`/repos/${repo}`, opts), gh(`/repos/${repo}/languages`, opts), gh(`/repos/${repo}/commits?per_page=1`, opts),
  ]);
  if (!repoRes.ok || !langRes.ok || !commitsRes.ok) throw new Error('upstream');
  const info = await repoRes.json();
  const bytes = await langRes.json();
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  const languages = Object.fromEntries(Object.entries(bytes)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, n]) => [name, total ? Math.round((n / total) * 100) : 0]));
  const commits = parseLastPage(commitsRes.headers.get('link')) ?? (await commitsRes.json()).length;
  return { repo, languages, commits, pushedAt: info.pushed_at ?? null, stars: info.stargazers_count ?? 0 };
}

export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get('id') ?? '';
  const project = PROJECTS.find((p) => p.id === id && p.repo);
  if (!project) return json({ ok: false, error: 'unknown project' });
  try {
    const data = await cached(`scan/${id}`, 3600, () => scanRepo(project.repo, { env: context.env }));
    return json({ ok: true, id, ...data });
  } catch {
    return json({ ok: false, error: 'upstream unavailable' });
  }
}
