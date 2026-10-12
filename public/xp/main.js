// Boot-only version. Task 7 replaces this file with the full sequence.

import { createTerminal } from './terminal.js';
import { getBootLines, formatLine } from './boot.js';

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
if (params.has('fresh')) store.remove('zw_visited');

const term = createTerminal($('#terminal'));
const state = { opened: false, skipped: false };

async function boot() {
  const lines = getBootLines({ url: params.has('offline') ? '/api/__offline' : '/api/status' });
  await term.typeLine('who is zohn_wheeler', { prompt: '> ', typo: { at: 7, wrong: 'zhon' } });
  for (const line of await lines) {
    if (state.skipped) return;
    await sleep(160);
    term.print(formatLine(line), `tag-${line.tag.toLowerCase()}`);
  }
  await sleep(500);
}

function openCore() {
  if (state.opened) return;
  state.opened = true;
  store.set('zw_visited', '1');
  document.body.classList.add('is-core');
  term.print("identity core online. type 'help' for commands.");
}

function skip() {
  if (state.opened) return;
  state.skipped = true;
  term.setFast(true);
  openCore();
}

term.register('help', () => term.list().map((c) => c.help), 'help: list commands');
term.register('clear', () => { term.clear(); }, 'clear: clear the terminal');

$('#skip').addEventListener('click', skip);
addEventListener('keydown', (e) => {
  if (state.opened || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ' && e.key.length !== 1) return;
  skip();
});
document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => term.run(b.dataset.cmd)));

if (store.get('zw_visited') === '1') {
  term.print('> who is zohn_wheeler');
  term.print('welcome back. skipping boot sequence.');
  openCore();
} else {
  boot().then(openCore);
}
