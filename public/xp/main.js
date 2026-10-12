// Runs the story: boot (acts 1-2), core (act 3), track view (act 4).
// The only module that knows the act order.

import { PROJECTS, TRACKS, OWNER } from './content.js';
import { createTerminal } from './terminal.js';
import { getBootLines, formatLine } from './boot.js';
import { createNarrator } from './narrator.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
if (params.has('fresh')) { store.remove('zw_visited'); store.remove('zw_track'); }

const projectById = new Map(PROJECTS.map((p) => [p.id, p]));
const phone = matchMedia('(max-width: 640px)').matches;
const state = { opened: false, skipped: false, track: null, focused: null };

const term = createTerminal($('#terminal'));

// Start loading the orb immediately; the boot sequence hides the wait.
let core = null;
const leaving = Boolean(window.__zwLeaving);
const corePromise = (leaving ? Promise.reject(new Error('leaving')) : import('./core.js'))
  .then((m) => m.mountCore($('#core-stage'), { particles: phone ? 900 : 2400, forceCss: params.has('css-core') }))
  .then((c) => { core = c; return c; })
  .catch(() => null);

const narrator = createNarrator({
  captionEl: $('#caption'),
  liveEl: $('#live'),
  onSpeakStart: () => core?.setState('speaking'),
  onSpeakEnd: () => core?.setState(state.focused ? 'focus' : 'idle'),
});

// ---------- Acts 1-2: boot ----------

async function boot() {
  const lines = getBootLines({ url: params.has('offline') ? '/api/__offline' : '/api/status' });
  await term.typeLine('who is zohn_wheeler', { prompt: '> ', typo: { at: 7, wrong: 'zhon' } });
  for (const line of await lines) {
    if (state.skipped) return;
    await sleep(160);
    if (state.skipped) return;
    term.print(formatLine(line), `tag-${line.tag.toLowerCase()}`);
  }
  await sleep(500);
}

function skip() {
  if (state.opened) return;
  state.skipped = true;
  term.setFast(true);
  openCore();
}

// ---------- Act 3: the core ----------

async function openCore() {
  if (state.opened) return;
  state.opened = true;
  const returning = store.get('zw_visited') === '1';
  store.set('zw_visited', '1');
  document.body.classList.add('is-core');
  const active = document.activeElement;
  if (!phone && (active === document.body || active === $('#skip'))) term.focus();
  term.print("identity core online. type 'help' for commands.");
  await Promise.race([corePromise, sleep(2500)]);

  const chosen = () => Boolean(state.track || state.focused);
  if (returning) {
    await narrator.say('welcome');
    if (chosen()) return;
    const saved = store.get('zw_track');
    if (Object.hasOwn(TRACKS, saved)) { chooseTrack(saved); return; }
  } else {
    await narrator.say('intro');
    if (chosen()) return;
    await narrator.say('bio');
    if (chosen()) return;
  }
  await narrator.say('ask');
  if (!state.track) showTrackChoice();
}

function showTrackChoice() {
  const choice = $('#track-choice');
  choice.hidden = false;
  const typing = document.activeElement === $('#term-input') && $('#term-input').value !== '';
  if (!typing) choice.querySelector('button').focus({ preventScroll: true });
}

// ---------- Act 4: tracks, rings and panel ----------

function chooseTrack(track, { quiet = false } = {}) {
  if (!Object.hasOwn(TRACKS, track)) return false;
  state.track = track;
  store.set('zw_track', track);
  const choice = $('#track-choice');
  const hadFocus = choice.contains(document.activeElement);
  const ringFocus = document.activeElement?.closest?.('.ring-node')?.dataset.id;
  choice.hidden = true;
  const toggle = $('#track-toggle');
  toggle.hidden = false;
  toggle.textContent = `track: ${track}`;
  renderRings();
  if (hadFocus) $('#rings .ring-node')?.focus({ preventScroll: true });
  else if (ringFocus) (document.querySelector(`.ring-node[data-id="${ringFocus}"]`) ?? $('#rings .ring-node'))?.focus({ preventScroll: true });
  if (!quiet) narrator.say(`track.${track}`);
  return true;
}

function renderRings() {
  const order = TRACKS[state.track].order;
  $('#rings').replaceChildren(...order.map((id, i) => {
    const p = projectById.get(id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ring-node';
    b.textContent = p.name;
    b.dataset.id = id;
    b.style.setProperty('--i', i);
    b.style.setProperty('--n', order.length);
    b.style.setProperty('--c', p.color);
    if (state.focused === id) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => focusProject(id));
    return b;
  }));
}

function markCurrent() {
  document.querySelectorAll('.ring-node').forEach((b) => {
    if (b.dataset.id === state.focused) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
}

function focusProject(id, { moveFocus = true } = {}) {
  const p = projectById.get(id);
  if (!p) return false;
  if (!state.track) chooseTrack('hire', { quiet: true });
  state.focused = id;
  core?.focus(id);
  markCurrent();
  renderPanel(p, moveFocus);
  narrator.say(`project.${id}`);
  return true;
}

function renderPanel(p, moveFocus) {
  const panel = $('#panel');
  const img = panel.querySelector('img');
  if (p.thumb) { img.src = p.thumb; img.alt = `${p.name} screenshot`; img.hidden = false; }
  else { img.removeAttribute('src'); img.alt = ''; img.hidden = true; }
  $('#panel-title').textContent = p.name;
  panel.querySelector('[data-story]').textContent = p.story;
  panel.querySelector('[data-stack]').replaceChildren(...p.stack.map((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    return li;
  }));
  panel.querySelector('[data-links]').replaceChildren(...p.links.map((l) => {
    const a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.label;
    if (/^https?:/.test(l.href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }));
  panel.hidden = false;
  $('#core').classList.add('panel-open');
  if (moveFocus) panel.querySelector('.close').focus({ preventScroll: true });
}

function closePanel() {
  const returnTo = state.focused;
  $('#panel').hidden = true;
  state.focused = null;
  core?.focus(null);
  core?.setState('idle');
  markCurrent();
  $('#core').classList.remove('panel-open');
  const ring = document.querySelector(`.ring-node[data-id="${returnTo}"]`)
    ?? (phone ? $('#rings button') : null);
  if (ring) ring.focus({ preventScroll: true });
  else if (!phone) term.focus();
}

function setSound(on) {
  narrator.setSound(on);
  const b = $('#sound');
  b.setAttribute('aria-pressed', String(on));
  b.textContent = `sound: ${on ? 'on' : 'off'}`;
}

// ---------- Commands ----------

term.register('help', () => term.list().map((c) => c.help), 'help: list commands');
term.register('ls', (args) => (args[0] === 'projects'
  ? TRACKS[state.track ?? 'hire'].order.map((id) => `${id.padEnd(12)} ${projectById.get(id).name}`)
  : 'usage: ls projects'), 'ls projects: list projects');
term.register('open', (args) => {
  const id = (args[0] ?? '').toLowerCase();
  if (!id) return 'usage: open <project>';
  return focusProject(id, { moveFocus: false }) ? `opening ${projectById.get(id).name}...` : `open: ${id}: no such project. try 'ls projects'.`;
}, 'open <project>: focus a project');
term.register('track', (args) => {
  const t = (args[0] ?? '').toLowerCase();
  return chooseTrack(t) ? `track set: ${t}` : 'usage: track hire|build';
}, 'track hire|build: switch audience');
term.register('cat', (args) => ((args[0] ?? '').toLowerCase() === 'resume'
  ? { prefix: 'résumé: ', text: '/resume.html', href: '/resume.html' }
  : `cat: ${args[0] ?? ''}: no such file`), 'cat resume: view résumé');
term.register('contact', () => [
  TRACKS[state.track ?? 'hire'].contact,
  { prefix: 'linkedin: ', text: OWNER.linkedin, href: OWNER.linkedin },
], 'contact: get in touch');
term.register('sound', (args) => {
  const v = (args[0] ?? '').toLowerCase();
  if (v !== 'on' && v !== 'off') return 'usage: sound on|off';
  setSound(v === 'on');
  return `sound ${v}`;
}, 'sound on|off: toggle voice');
term.register('classic', () => { location.href = '/classic/'; return 'loading plain version...'; }, 'classic: plain version of this site');
term.register('clear', () => { term.clear(); }, 'clear: clear the terminal');
term.register('whoami', () => 'guest. curious, apparently. good sign.');
term.register('sudo', (args) => (args.join(' ').toLowerCase() === 'hire zohn'
  ? ['[sudo] access granted.', { prefix: 'next step: ', text: OWNER.email, href: `mailto:${OWNER.email}` }]
  : 'nice try.'));

// ---------- Wiring ----------

$('#skip').addEventListener('click', skip);
$('#sound').addEventListener('click', () => setSound(!narrator.sound));
$('#track-toggle').addEventListener('click', () => chooseTrack(state.track === 'hire' ? 'build' : 'hire'));
document.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => chooseTrack(b.dataset.track)));
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => term.run(b.dataset.cmd)));
$('#panel .close').addEventListener('click', closePanel);

addEventListener('keydown', (e) => {
  if (!state.opened) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ' && e.key.length !== 1) return;
    skip();
    return;
  }
  if (e.key === 'Escape' && !$('#panel').hidden) closePanel();
});

if (leaving) {
  // The head script is redirecting: no status fetch, no Three.js.
} else if (store.get('zw_visited') === '1') {
  term.print('> who is zohn_wheeler');
  term.print('welcome back. skipping boot sequence.');
  openCore();
} else {
  boot().then(openCore);
}
