// DOM terminal: typed lines, printed output, an input with history, a
// prompt that can change, and tab completion for commands and arguments.
// Command logic lives in commands.js.

import { createRegistry, createHistory } from './commands.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTerminal(root) {
  const out = root.querySelector('[data-term-out]');
  const form = root.querySelector('[data-term-form]');
  const input = root.querySelector('[data-term-input]');
  const promptEl = root.querySelector('[data-term-prompt]');
  const registry = createRegistry();
  const history = createHistory();
  let fast = false;
  let promptText = '>';
  let completer = null;

  const scroll = () => { out.scrollTop = out.scrollHeight; };

  function addLine(cls) {
    const el = document.createElement('div');
    el.className = cls ? `term-line ${cls}` : 'term-line';
    out.append(el);
    return el;
  }

  function print(item, cls) {
    const el = addLine(cls);
    if (item && typeof item === 'object' && item.href) {
      if (item.prefix) el.append(item.prefix);
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.text;
      if (/^https?:/.test(item.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      el.append(a);
    } else {
      el.textContent = String(item ?? '');
    }
    scroll();
    return el;
  }

  async function typeLine(text, { cls, prompt = '', speed = 55, typo, skip = () => false } = {}) {
    const el = addLine(cls);
    const typed = document.createTextNode(prompt);
    const caret = document.createElement('span');
    caret.className = 'cursor';
    el.append(typed, caret);
    el.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < text.length && !fast && !skip(); i++) {
      if (typo && i === typo.at) {
        for (const ch of typo.wrong) { typed.data += ch; await sleep(speed); }
        await sleep(260);
        for (let k = 0; k < typo.wrong.length; k++) { typed.data = typed.data.slice(0, -1); await sleep(speed * 0.7); }
      }
      typed.data += text[i];
      scroll();
      await sleep(speed + Math.random() * speed);
    }
    typed.data = prompt + text;
    caret.remove();
    el.removeAttribute('aria-hidden');
    scroll();
    return el;
  }

  async function run(raw) {
    print(`${promptText} ${raw}`, 'term-echo');
    history.push(raw);
    const { output } = await registry.run(raw);
    for (const item of output) print(item);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    if (value.trim()) run(value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); input.value = history.prev(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); input.value = history.next(); return; }
    if (e.key !== 'Tab') return;
    const value = input.value.trimStart();
    if (!value) return;
    const matches = /\s/.test(value) ? (completer?.(value) ?? []) : registry.complete(value);
    if (matches.length === 1) {
      e.preventDefault();
      input.value = matches[0].endsWith('/') ? matches[0] : `${matches[0]} `;
    } else if (matches.length > 1) {
      e.preventDefault();
      print(matches.map((m) => m.split(' ').pop()).join('  '));
    }
  });

  return {
    print,
    typeLine,
    run,
    register: registry.register,
    list: registry.list,
    names: registry.names,
    setFallback: registry.setFallback,
    setFast(value) { fast = !!value; },
    setPrompt(text) { promptText = text; if (promptEl) promptEl.textContent = text; },
    setCompleter(fn) { completer = fn; },
    clear() { out.replaceChildren(); },
    focus() { input.focus({ preventScroll: true }); },
  };
}
