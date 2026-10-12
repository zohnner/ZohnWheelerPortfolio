// Pure command machinery for the terminal: parsing, a registry and input
// history. No DOM, so it is unit tested in Node (test/xp-commands.test.mjs).

export function parseInput(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  return { name: parts[0].toLowerCase(), args: parts.slice(1), raw: trimmed };
}

export function createRegistry() {
  const commands = new Map();
  let fallback = null;
  const wrap = (out) => (out == null ? [] : [].concat(out));

  return {
    register(name, handler, help = '') {
      commands.set(name.toLowerCase(), { handler, help });
    },
    list() {
      return [...commands.entries()]
        .filter(([, c]) => c.help)
        .map(([name, c]) => ({ name, help: c.help }));
    },
    names() {
      return [...commands.keys()];
    },
    complete(prefix) {
      const p = String(prefix).toLowerCase();
      return [...commands.keys()].filter((n) => n.startsWith(p)).sort();
    },
    setFallback(fn) {
      fallback = fn;
    },
    async run(raw) {
      const parsed = parseInput(raw);
      if (!parsed) return { ok: true, output: [] };
      const cmd = commands.get(parsed.name);
      const handler = cmd ? (args, p) => cmd.handler(args, p) : fallback && ((args, p) => fallback(p));
      if (!handler) return { ok: false, output: [`command not found: ${parsed.name}. type 'help' for commands.`] };
      try {
        return { ok: true, output: wrap(await handler(parsed.args, parsed)) };
      } catch (err) {
        return { ok: false, output: [`${parsed.name}: ${err?.message ?? err}`] };
      }
    },
  };
}

export function createHistory(limit = 50) {
  const items = [];
  let cursor = 0;

  return {
    push(line) {
      const t = String(line ?? '').trim();
      if (!t) return;
      if (items[items.length - 1] !== t) items.push(t);
      if (items.length > limit) items.shift();
      cursor = items.length;
    },
    prev() {
      if (!items.length) return '';
      cursor = Math.max(0, cursor - 1);
      return items[cursor];
    },
    next() {
      if (cursor >= items.length - 1) {
        cursor = items.length;
        return '';
      }
      cursor += 1;
      return items[cursor];
    },
  };
}
