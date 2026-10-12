// GET /api/gitlog: the newest public commits across the account's most
// recently pushed repos. Always 200; failures are not cached.

import { GITHUB_USER } from '../../public/xp/content.js';
import { gh, cached, json } from '../../server/github.mjs';

export async function recentCommits(user, { env, fetchImpl = fetch, repoCount = 3, perRepo = 5, limit = 10 } = {}) {
  const reposRes = await gh(`/users/${user}/repos?sort=pushed&per_page=${repoCount}`, { env, fetchImpl });
  if (!reposRes.ok) throw new Error(`repos ${reposRes.status}`);
  const repos = await reposRes.json();
  let anyOk = false;
  const lists = await Promise.all(repos.map(async (r) => {
    const res = await gh(`/repos/${r.full_name}/commits?per_page=${perRepo}`, { env, fetchImpl });
    if (!res.ok) return [];
    anyOk = true;
    const commits = await res.json();
    return commits.map((c) => ({
      sha7: String(c.sha).slice(0, 7),
      date: c.commit?.author?.date ?? null,
      repo: r.full_name,
      message: String(c.commit?.message ?? '').split('\n')[0].slice(0, 72),
    }));
  }));
  if (!anyOk) throw new Error('no commits readable');
  return lists.flat().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

export async function onRequestGet(context) {
  let commits = [];
  try {
    commits = await cached('gitlog', 600, () => recentCommits(GITHUB_USER, { env: context.env }));
  } catch {
    commits = [];
  }
  return json({ commits });
}
