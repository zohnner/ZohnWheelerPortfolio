// CRT controls: phosphor palettes, the power-off collapse and the glitch pulse.
// Power-on is pure CSS (.crt-power runs on page load), so it works without JS.

export const PALETTES = {
  green: { phosphor: '#3dff9a', dim: '#1d7a4c', glow: '61,255,154' },
  amber: { phosphor: '#ffb000', dim: '#7a5500', glow: '255,176,0' },
  white: { phosphor: '#e8e8e8', dim: '#6b6b6b', glow: '232,232,232' },
};
export const PALETTE_NAMES = Object.keys(PALETTES);

export function applyPalette(name, root = globalThis.document?.documentElement) {
  if (!Object.hasOwn(PALETTES, name) || !root) return false;
  const p = PALETTES[name];
  root.style.setProperty('--phosphor', p.phosphor);
  root.style.setProperty('--phosphor-dim', p.dim);
  root.style.setProperty('--glow', p.glow);
  return true;
}

export function initPalette(store) {
  applyPalette(store.get('zw_color') ?? 'green');
}

export function powerOff(el = globalThis.document?.getElementById('crt-power')) {
  return new Promise((resolve) => {
    if (!el) { resolve(); return; }
    el.classList.add('off');
    setTimeout(resolve, 340);
  });
}

export function glitch(el) {
  if (!el) return;
  el.classList.remove('glitch');
  void el.offsetWidth;
  el.classList.add('glitch');
  setTimeout(() => el.classList.remove('glitch'), 260);
}
