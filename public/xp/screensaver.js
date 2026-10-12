// Matrix-rain screensaver, drawn in the current phosphor color. Throttled to
// about 20 fps; any visitor input dismisses it (wired in reactions.js).

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789';

export function createScreensaver(host) {
  let canvas = null;
  let raf = 0;
  let active = false;

  function stop() {
    active = false;
    cancelAnimationFrame(raf);
    canvas?.remove();
    canvas = null;
  }

  function start() {
    if (active) return;
    const c = document.createElement('canvas');
    const ctx = c.getContext?.('2d');
    if (!ctx) return;
    active = true;
    canvas = c;
    c.className = 'saver';
    c.setAttribute('aria-hidden', 'true');
    host.append(c);
    const w = (c.width = host.clientWidth);
    const h = (c.height = host.clientHeight);
    const size = 16;
    const drops = Array.from({ length: Math.max(1, Math.floor(w / size)) }, () => Math.random() * (-h / size));
    const color = getComputedStyle(document.documentElement).getPropertyValue('--phosphor').trim() || '#3dff9a';
    ctx.font = `${size}px monospace`;
    let last = 0;
    const frame = (t) => {
      if (!active) return;
      raf = requestAnimationFrame(frame);
      if (t - last < 50) return;
      last = t;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      drops.forEach((y, i) => {
        ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * size, y * size);
        drops[i] = y * size > h && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    raf = requestAnimationFrame(frame);
  }

  return { start, stop, get active() { return active; } };
}
