// The BIOS self-test. formatPost and parseUA are pure; readDevice reads the
// visitor's own browser. Nothing here is sent anywhere.

export function parseUA(ua) {
  const s = String(ua ?? '');
  const pick = (re, name) => { const m = re.exec(s); return m ? `${name} ${m[1]}` : null; };
  const browser = pick(/Edg\/(\d+)/, 'Edge') ?? pick(/OPR\/(\d+)/, 'Opera') ?? pick(/Firefox\/(\d+)/, 'Firefox')
    ?? pick(/Chrome\/(\d+)/, 'Chrome') ?? pick(/Version\/(\d+)[\d.]* .*Safari/, 'Safari');
  const os = /Windows/.test(s) ? 'Windows' : /iPhone|iPad/.test(s) ? 'iOS' : /Mac OS X/.test(s) ? 'macOS'
    : /Android/.test(s) ? 'Android' : /Linux/.test(s) ? 'Linux' : null;
  return { browser, os };
}

export const memoryLine = (mb) => `Memory test: ${mb} MB OK`;

export function memorySteps(mb, steps = 8) {
  return Array.from({ length: steps }, (_, i) => Math.round((mb * (i + 1)) / steps));
}

export function formatPost(d = {}) {
  const lines = ['ZW-BIOS v5.1  (c) Zohn Wheeler'];
  if (d.memoryMB) lines.push(memoryLine(d.memoryMB));
  if (d.cores) lines.push(`CPU: ${d.cores} logical cores detected`);
  if (d.gpu) lines.push(`GPU: ${d.gpu.length > 60 ? `${d.gpu.slice(0, 57)}...` : d.gpu}`);
  if (d.screen) lines.push(`Display: ${d.screen.w}x${d.screen.h} @${d.screen.dpr}x`);
  if (d.browser) lines.push(`Browser: ${d.browser}${d.os ? ` on ${d.os}` : ''}`);
  if (d.locale) lines.push(`Locale: ${d.locale}${d.time ? `, ${d.time} local` : ''}`);
  lines.push('Booting ZW-OS...');
  return lines;
}

export function readDevice(nav = globalThis.navigator, win = globalThis.window) {
  const d = {};
  try { d.cores = nav.hardwareConcurrency || null; } catch { /* unavailable */ }
  try { d.memoryMB = nav.deviceMemory ? Math.round(nav.deviceMemory * 1024) : null; } catch { /* unavailable */ }
  try {
    const gl = win.document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    d.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* blocked */ }
  try { d.screen = { w: win.screen.width, h: win.screen.height, dpr: Math.round((win.devicePixelRatio || 1) * 100) / 100 }; } catch { /* unavailable */ }
  try { Object.assign(d, parseUA(nav.userAgent)); } catch { /* unavailable */ }
  try {
    d.locale = nav.language || null;
    d.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { /* unavailable */ }
  return d;
}
