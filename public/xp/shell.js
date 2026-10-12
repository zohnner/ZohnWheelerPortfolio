// Every terminal command, plus tab completion and the plain-English fallback.
// Commands reach the rest of the page only through the deps main.js passes.

import { PROJECTS, TRACKS, OWNER, VOICE_ENABLED, KB, MAN, ABOUT, FALLBACK_REPLY, LAB_NOTES } from './content.js';
import { buildTree, ls, cd, cat, tree as drawTree, formatCwd, completePath } from './fs.js';
import { answer, suggest } from './answers.js';
import {
  pingLine, pingSummary, parseCount, formatGitLog, formatTop, formatScan, verdict, formatHistory, fetchJson, pingOnce,
  gateLine, formatPipeline, formatDecisionList, formatDecision, formatNotes,
} from './live.js';
import { bar } from './tui.js';
import { applyPalette, PALETTE_NAMES, powerOff } from './crt.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const projectId = (arg) => String(arg ?? '').toLowerCase().replace(/^~?\/?(projects\/)?/, '').replace(/\/$/, '');
const PATH_COMMANDS = ['ls', 'cd', 'cat'];
const PROJECT_COMMANDS = ['open', 'ping', 'scan'];

export function registerShell({ term, operator, state, store, projectById, focusProject, chooseTrack, setSound }) {
  const fsTree = buildTree({ projects: PROJECTS, owner: OWNER, about: ABOUT });
  let cwd = [];
  const setCwd = (next) => { cwd = next; term.setPrompt(`guest@zw-os:${formatCwd(cwd)}$`); };
  const result = (r) => (r.ok ? r.lines : r.error);
  setCwd([]);

  term.register('help', () => term.list().map((c) => c.help), 'help: list commands');
  term.register('ls', (args) => result(ls(fsTree, cwd, args[0] ?? '')), 'ls [path]: list files');
  term.register('cd', (args) => {
    const r = cd(fsTree, cwd, args[0] ?? '~');
    if (!r.ok) return r.error;
    setCwd(r.cwd);
    return [];
  }, 'cd <dir>: change directory');
  term.register('pwd', () => formatCwd(cwd), 'pwd: where am I');
  term.register('cat', (args) => (args[0] ? result(cat(fsTree, cwd, args[0])) : 'usage: cat <file>'), 'cat <file>: print a file');
  term.register('tree', () => drawTree(fsTree), 'tree: the whole filesystem');
  term.register('man', (args) => ((args[0] ?? '').toLowerCase() === 'zohn' ? MAN : `No manual entry for ${args[0] ?? ''}`.trim()), 'man zohn: the manual');
  term.register('open', (args) => {
    const id = projectId(args[0]);
    if (!id) return 'usage: open <project>';
    return focusProject(id, { moveFocus: false }) ? `opening ${projectById.get(id).name}...` : `open: ${id}: no such project. try 'ls projects'.`;
  }, 'open <project>: open a project window');
  term.register('track', (args) => {
    const t = (args[0] ?? '').toLowerCase();
    return chooseTrack(t) ? `track set: ${t}` : 'usage: track hire|build';
  }, 'track hire|build: switch audience');
  term.register('contact', () => [
    TRACKS[state.track ?? 'hire'].contact,
    { prefix: 'linkedin: ', text: OWNER.linkedin, href: OWNER.linkedin },
  ], 'contact: get in touch');

  term.register('ping', async (args) => {
    const id = projectId(args[0]);
    if (!id) return 'usage: ping <project>';
    const p = projectById.get(id);
    if (!p) return `ping: unknown project: ${id}`;
    if (!p.healthUrl) return `ping: ${p.name} has no live host on file`;
    const host = new URL(p.healthUrl).host;
    term.print(`PING ${host}: 4 probes from your browser`);
    const samples = [];
    for (let i = 0; i < 4; i++) {
      const ms = await pingOnce(p.healthUrl);
      samples.push(ms);
      term.print(pingLine(host, ms));
      if (i < 3) await sleep(350);
    }
    return pingSummary(host, samples);
  }, 'ping <project>: live latency from your browser');

  term.register('git', async (args) => {
    if ((args[0] ?? '') !== 'log') return 'usage: git log [-n N]';
    const data = await fetchJson('/api/gitlog', { timeoutMs: 6000 });
    const lines = formatGitLog(data?.commits ?? [], parseCount(args.slice(1)));
    if (!lines.length) { await operator.say("The data link to GitHub is unavailable right now. I won't make commits up."); return []; }
    return lines;
  }, 'git log [-n N]: recent public commits');

  const top = async () => {
    const s = await fetchJson('/api/status');
    if (!s?.projects?.length) { await operator.say('Live status is unavailable right now.'); return []; }
    return formatTop(s.projects, PROJECTS);
  };
  term.register('top', top, 'top: projects as live processes');
  term.register('status', top, 'status: live health of every project');

  const deploy = async () => {
    term.print("deploy: guests can't ship to production.");
    term.print("replaying the gates SportStrata's latest real deploy had to pass ...");
    const data = await fetchJson('/api/pipeline', { timeoutMs: 8000 });
    if (!data?.ok) { await operator.say("I can't reach GitHub Actions right now, so I won't fake a pipeline. Try again shortly."); return []; }
    const { header, footer } = formatPipeline(data);
    for (const line of header) term.print(line);
    for (const step of data.ci.steps) { term.print(gateLine(step)); await sleep(140); }
    for (const line of footer) term.print(line);
    return data.ci.url ? [{ prefix: 'run log: ', text: 'github actions', href: data.ci.url }] : [];
  };
  term.register('deploy', deploy, 'deploy: replay the real CI gates');
  term.register('pipeline', deploy);

  term.register('decisions', async (args) => {
    const id = args.join(' ').trim();
    const data = await fetchJson(id ? `/api/decisions?id=${encodeURIComponent(id)}` : '/api/decisions', { timeoutMs: 8000 });
    if (!data) { await operator.say("I can't reach the decision log right now, so I won't paraphrase it from memory."); return []; }
    if (!data.ok) return data.error === 'no such decision' ? `decisions: ${id}: no such entry. type 'decisions' for the latest.` : 'decisions: the log is unavailable right now.';
    const lines = data.entry ? formatDecision(data.entry) : formatDecisionList(data);
    return [...lines, { prefix: 'source: ', text: 'DECISIONS.md', href: data.source }];
  }, 'decisions [id]: read the real decision log');

  term.register('notes', () => [...formatNotes(LAB_NOTES), { prefix: 'all notes: ', text: '/notes/', href: '/notes/' }], 'notes: Lab Notes, incident write-ups');

  term.register('scan', async (args) => {
    const id = projectId(args[0]);
    if (!id) return 'usage: scan <project>';
    const p = projectById.get(id);
    if (!p) return `scan: unknown project: ${id}`;
    if (!p.repo) return `scan: ${p.name} has no public repo on file`;
    term.print(`scanning ${p.repo} ...`);
    const progress = term.print(bar(0, 26));
    const request = fetchJson(`/api/scan?id=${encodeURIComponent(id)}`, { timeoutMs: 6000 });
    for (let i = 1; i <= 10; i++) { progress.textContent = `${bar(i / 10, 26)} ${i * 10}%`; await sleep(110); }
    const data = await request;
    if (!data?.ok) { await operator.say("I can't reach GitHub right now, so I won't guess at the numbers. Try again shortly."); return []; }
    for (const line of formatScan(data)) term.print(line);
    await operator.say(verdict(data, Date.now()));
    return [];
  }, 'scan <project>: live repo analysis');

  term.register('history', async () => {
    const log = await fetchJson('/xp/buildlog.json');
    if (!log) { await operator.say('My build log is unavailable right now.'); return []; }
    for (const line of formatHistory(log)) await operator.say(line);
    return [];
  }, 'history: how this site was built');

  term.register('color', (args) => {
    const name = (args[0] ?? '').toLowerCase();
    if (!applyPalette(name)) return `usage: color ${PALETTE_NAMES.join('|')}`;
    store.set('zw_color', name);
    return `phosphor: ${name}`;
  }, `color <name>: ${PALETTE_NAMES.join(', ')}`);

  if (VOICE_ENABLED && setSound) {
    term.register('sound', (args) => {
      const v = (args[0] ?? '').toLowerCase();
      if (v !== 'on' && v !== 'off') return 'usage: sound on|off';
      setSound(v === 'on');
      return `sound ${v}`;
    }, 'sound on|off: toggle voice');
  } else {
    term.register('sound', () => 'voice module offline. captions only for now.');
  }

  term.register('classic', () => {
    powerOff().then(() => { location.href = '/classic/'; });
    return 'powering down...';
  }, 'classic: plain version of this site');
  term.register('clear', () => { term.clear(); }, 'clear: clear the terminal');
  term.register('whoami', () => 'guest. curious, apparently. good sign.');
  term.register('sudo', (args) => (args.join(' ').toLowerCase() === 'hire zohn'
    ? ['[sudo] access granted.', { prefix: 'next step: ', text: OWNER.email, href: `mailto:${OWNER.email}` }]
    : 'nice try.'));

  term.setCompleter((value) => {
    const m = /^(\S+)\s+(\S*)$/.exec(value);
    if (!m) return [];
    const [, cmd, partial] = m;
    if (PATH_COMMANDS.includes(cmd)) return completePath(fsTree, cwd, partial).map((p) => `${cmd} ${p}`);
    if (PROJECT_COMMANDS.includes(cmd)) {
      return PROJECTS.map((p) => p.id).filter((id) => id.startsWith(partial.toLowerCase())).map((id) => `${cmd} ${id}`);
    }
    return [];
  });

  term.setFallback(async ({ raw, name, args }) => {
    const hit = answer(raw, KB);
    if (hit) { await operator.say(hit.reply); return []; }
    if (args.length === 0) {
      const pool = [...term.names(), ...PROJECTS.map((p) => p.id), ...Object.keys(fsTree.children)];
      const s = suggest(name, pool);
      if (s) return `command not found: ${name}. did you mean '${s}'?`;
    }
    await operator.say(FALLBACK_REPLY);
    return [];
  });
}
