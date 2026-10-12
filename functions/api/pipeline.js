// GET /api/pipeline: the gates SportStrata's latest real CI run had to pass
// on main, step by step, plus the nightly upstream contract monitor's latest
// run. Read from GitHub Actions. Always 200; failures are honest and never
// cached.

import { PROJECTS } from '../../public/xp/content.js';
import { gh, cached, json } from '../../server/github.mjs';

const REPO = PROJECTS.find((p) => p.id === 'sportstrata').repo;
const CI_WORKFLOW = 'ci.yml';
const MONITOR_WORKFLOW = 'contract-check.yml';
const PLUMBING = /^(Set up job|Complete job|Post |Run actions\/)/;

// GitHub's API cuts step names at '#', so "(deploy-check #9)" can arrive as
// "(deploy-check".
export function cleanStepName(name) {
  return String(name ?? '').replace(/\s*\(deploy-check(\s*#\d+)?\)?\s*$/, '').trim();
}

export function gateSteps(jobs) {
  return (jobs ?? []).flatMap((j) => j.steps ?? [])
    .filter((s) => !PLUMBING.test(s.name ?? ''))
    .map((s) => ({ name: cleanStepName(s.name), conclusion: s.conclusion ?? null }));
}

async function latestRun(workflow, opts) {
  const res = await gh(`/repos/${REPO}/actions/workflows/${workflow}/runs?branch=main&per_page=1`, opts);
  if (!res.ok) throw new Error(`${workflow} ${res.status}`);
  const run = (await res.json()).workflow_runs?.[0];
  if (!run) throw new Error(`${workflow}: no runs`);
  return run;
}

export async function loadPipeline({ env, fetchImpl = fetch } = {}) {
  const opts = { env, fetchImpl, timeoutMs: 4000 };
  const [ciRun, monitorRun] = await Promise.all([
    latestRun(CI_WORKFLOW, opts),
    latestRun(MONITOR_WORKFLOW, opts).catch(() => null),
  ]);
  const jobsRes = await gh(`/repos/${REPO}/actions/runs/${ciRun.id}/jobs`, opts);
  if (!jobsRes.ok) throw new Error(`jobs ${jobsRes.status}`);
  const steps = gateSteps((await jobsRes.json()).jobs);
  if (!steps.length) throw new Error('no gate steps');
  return {
    repo: REPO,
    ci: {
      workflow: ciRun.name ?? null,
      title: String(ciRun.display_title ?? '').split('\n')[0].slice(0, 72),
      sha7: String(ciRun.head_sha ?? '').slice(0, 7),
      date: ciRun.created_at ?? null,
      status: ciRun.status ?? null,
      conclusion: ciRun.conclusion ?? null,
      url: ciRun.html_url ?? null,
      steps,
    },
    monitor: monitorRun && {
      date: monitorRun.created_at ?? null,
      status: monitorRun.status ?? null,
      conclusion: monitorRun.conclusion ?? null,
      url: monitorRun.html_url ?? null,
    },
  };
}

export async function onRequestGet(context) {
  try {
    const data = await cached('pipeline', 300, () => loadPipeline({ env: context.env }));
    return json({ ok: true, ...data });
  } catch {
    return json({ ok: false, error: 'upstream unavailable' });
  }
}
