// Runs the story: power-on and BIOS (acts 0-1), OS boot (act 2), the core
// (act 3) and track view (act 4). The only module that knows the act order.

import { PROJECTS, TRACKS, VOICE_ENABLED, BANNER } from './content.js';
import { createTerminal } from './terminal.js';
import { getBootLines, formatLine } from './boot.js';
import { readDevice, formatPost, memoryLine, memorySteps } from './bios.js';
import { createOperator } from './operator.js';
import { createVoice } from './voice.js';
import { initPalette, glitch, powerOff } from './crt.js';
import { imageToAscii } from './ascii.js';
import { createScreensaver } from './screensaver.js';
import { createReactions } from './reactions.js';
import { registerShell } from './shell.js';
import { fetchJson } from './live.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
if (params.has('fresh')) { for (const k of ['zw_visited', 'zw_track', 'zw_last_project']) store.remove(k); }

const projectById = new Map(PROJECTS.map((p) => [p.id, p]));
const phone = matchMedia('(max-width: 640px)').matches;
const state = { opened: false, skipped: false, track: null, focused: null, alert: false };
const restingState = () => (state.alert ? 'alert' : state.focused ? 'focus' : 'idle');

initPalette(store);
const term = createTerminal($('#terminal'));

// Start loading the orb immediately; the boot sequence hides the wait.
let core = null;
const leaving = Boolean(window.__zwLeaving);
const corePromise = (leaving ? Promise.reject(new Error('leaving')) : import('./core.js'))
  .then((m) => m.mountCore($('#core-stage'), { particles: phone ? 900 : 2400, forceCss: params.has('css-core') }))
  .then((c) => { core = c; return c; })
  .catch(() => null);

const voice = createVoice();
const operator = createOperator({ term, liveEl: $('#live'), getCore: () => core, restingState, voice: VOICE_ENABLED ? voice : null });
const reactions = createReactions({
  operator, store, projectById, getState: () => state, screensaver: createScreensaver($('#core')),
  setAlert: (on) => { state.alert = on; core?.setAlert?.(on); core?.setState(restingState()); },
});

// ---------- Acts 0-2: power on, BIOS, OS boot ----------

async function bios() {
  const device = readDevice();
  for (const line of formatPost(device)) {
    if (state.skipped) return;
    if (device.memoryMB && line === memoryLine(device.memoryMB)) {
      const el = term.print('Memory test: 0 MB');
      for (const n of memorySteps(device.memoryMB)) {
        if (state.skipped) return;
        el.textContent = `Memory test: ${n} MB`;
        await sleep(70);
      }
      el.textContent = line;
    } else {
      term.print(line);
    }
    await sleep(200);
  }
}

function printBanner() {
  for (const line of BANNER) term.print(line, 'banner').setAttribute('aria-hidden', 'true');
}

async function boot() {
  const lines = getBootLines({ url: params.has('offline') ? '/api/__offline' : '/api/status' });
  await sleep(550);
  await bios();
  if (state.skipped) return;
  await sleep(300);
  if (state.skipped) return;
  term.clear();
  await term.typeLine('who is zohn_wheeler', { prompt: '> ', typo: { at: 7, wrong: 'zhon' } });
  for (const line of await lines) {
    if (state.skipped) return;
    await sleep(160);
    if (state.skipped) return;
    term.print(formatLine(line), `tag-${line.tag.toLowerCase()}`);
  }
  if (state.skipped) return;
  printBanner();
  await sleep(700);
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
  term.setFast(false);
  const returning = store.get('zw_visited') === '1';
  store.set('zw_visited', '1');
  document.body.classList.add('is-core');
  const active = document.activeElement;
  if (!phone && (active === document.body || active === $('#skip'))) term.focus();
  term.print("identity core online. type 'help' for commands, or just ask a question.");
  reactions.start();
  await Promise.race([corePromise, sleep(2500)]);
  try {
    await narrate(returning);
  } finally {
    fetchJson('/api/status').then((s) => { if (s) reactions.checkHealth(s); });
  }
}

async function narrate(returning) {
  const chosen = () => Boolean(state.track || state.focused);
  if (returning) {
    await operator.say(reactions.welcomeLine());
    if (chosen()) return;
    const saved = store.get('zw_track');
    if (Object.hasOwn(TRACKS, saved)) { chooseTrack(saved); return; }
  } else {
    await operator.say('intro');
    if (chosen()) return;
    await operator.say('bio');
    if (chosen()) return;
  }
  await operator.say('ask');
  if (!state.track) showTrackChoice();
}

function showTrackChoice() {
  const choice = $('#track-choice');
  choice.hidden = false;
  const typing = document.activeElement === $('#term-input') && $('#term-input').value !== '';
  if (!typing) choice.querySelector('button').focus({ preventScroll: true });
}

// ---------- Act 4: tracks, rings and the project window ----------

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
  if (!quiet) operator.say(`track.${track}`);
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

let returnFocus = null;

function focusProject(id, { moveFocus = true } = {}) {
  const p = projectById.get(id);
  if (!p) return false;
  if (!state.track) chooseTrack('hire', { quiet: true });
  if ($('#panel').hidden) returnFocus = document.activeElement;
  state.focused = id;
  core?.focus(id);
  markCurrent();
  renderPanel(p, moveFocus);
  reactions.projectOpened(id);
  operator.say(`project.${id}`);
  return true;
}

function renderPanel(p, moveFocus) {
  const panel = $('#panel');
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
  const art = panel.querySelector('[data-ascii]');
  art.textContent = p.thumb ? 'rendering...' : '[ no image on file ]';
  if (p.thumb) {
    imageToAscii(p.thumb, phone ? 40 : 64).then((lines) => {
      if (state.focused === p.id) art.textContent = lines ? lines.join('\n') : '[ no image on file ]';
    });
  }
  panel.hidden = false;
  glitch(panel);
  if (moveFocus) panel.querySelector('.close').focus({ preventScroll: true });
}

function closePanel() {
  const returnTo = state.focused;
  $('#panel').hidden = true;
  state.focused = null;
  core?.focus(null);
  core?.setState(restingState());
  markCurrent();
  const back = returnFocus;
  returnFocus = null;
  if (back && back.isConnected && back === $('#term-input')) { back.focus({ preventScroll: true }); return; }
  const ring = document.querySelector(`.ring-node[data-id="${returnTo}"]`) ?? (phone ? $('#rings button') : null);
  if (ring) ring.focus({ preventScroll: true });
  else if (!phone) term.focus();
}

function setSound(on) {
  voice.setOn(on);
  const b = $('#sound');
  b.setAttribute('aria-pressed', String(on));
  b.textContent = `sound: ${on ? 'on' : 'off'}`;
}

registerShell({ term, operator, state, store, projectById, focusProject, chooseTrack, setSound: VOICE_ENABLED ? setSound : null });

// ---------- Wiring ----------

$('#skip').addEventListener('click', skip);
if (VOICE_ENABLED) $('#sound').addEventListener('click', () => setSound(!voice.on));
else $('#sound').hidden = true;
$('#track-toggle').addEventListener('click', () => chooseTrack(state.track === 'hire' ? 'build' : 'hire'));
document.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => chooseTrack(b.dataset.track)));
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => term.run(b.dataset.cmd)));
$('#panel .close').addEventListener('click', closePanel);
addEventListener('pageshow', (e) => { if (e.persisted) $('#crt-power')?.classList.remove('off'); });
$('.top-links a').addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  powerOff().then(() => { location.href = '/classic/'; });
});

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
