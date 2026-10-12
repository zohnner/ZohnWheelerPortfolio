// Box-drawing helpers for text-mode output. Pure.

export function rule(cols, ch = '─') {
  return ch.repeat(Math.max(0, cols));
}

export function bar(fraction, cols) {
  const inner = Math.max(0, cols - 2);
  const f = Math.min(1, Math.max(0, Number(fraction) || 0));
  const filled = Math.round(f * inner);
  return `[${'█'.repeat(filled)}${'░'.repeat(inner - filled)}]`;
}

export function frame(title, cols) {
  const inner = Math.max(0, cols - 2);
  const head = `═[ ${title} ]`.slice(0, inner);
  return { top: `╔${head}${'═'.repeat(inner - head.length)}╗`, bottom: `╚${'═'.repeat(inner)}╝` };
}

export function table(headers, rows) {
  const all = [headers, ...rows].map((r) => r.map(String));
  const widths = headers.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]))).join('  ').trimEnd());
}
