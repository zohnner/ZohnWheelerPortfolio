// Virtual filesystem for the terminal, built from content.js. Pure: paths are
// arrays of names, [] is home ('~'), and nothing here touches the DOM.

const dir = (children) => ({ type: 'dir', children });
const file = (lines) => ({ type: 'file', lines });
const link = (href) => ({ type: 'link', href });
const label = (name, node) => (node.type === 'dir' ? `${name}/` : name);
const sortedNames = (node) => Object.keys(node.children).sort();

export function buildTree({ projects, owner, about }) {
  return dir({
    'about.txt': file(about),
    'contact.txt': file([
      { prefix: 'email:    ', text: owner.email, href: `mailto:${owner.email}` },
      { prefix: 'linkedin: ', text: owner.linkedin, href: owner.linkedin },
      { prefix: 'github:   ', text: owner.github, href: owner.github },
      { prefix: 'quote:    ', text: '/hire.html#contact-form', href: '/hire.html#contact-form' },
    ]),
    resume: link('/resume.html'),
    projects: dir(Object.fromEntries(projects.map((p) => [p.id, dir({
      README: file([p.name, '', p.story, '', `stack: ${p.stack.join(' · ')}`]),
      links: file(p.links.map((l) => ({ prefix: `${l.label}: `, text: l.href, href: l.href }))),
    })]))),
  });
}

export function resolvePath(cwd, input) {
  const raw = String(input ?? '').trim();
  if (raw === '') return [...cwd];
  const fromHome = raw === '~' || raw.startsWith('~/') || raw.startsWith('/');
  const path = fromHome ? [] : [...cwd];
  for (const part of raw.replace(/^~/, '').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') path.pop();
    else path.push(part);
  }
  return path;
}

export function nodeAt(tree, path) {
  let node = tree;
  for (const name of path) {
    if (node.type !== 'dir' || !Object.hasOwn(node.children, name)) return null;
    node = node.children[name];
  }
  return node;
}

export function formatCwd(cwd) {
  return cwd.length ? `~/${cwd.join('/')}` : '~';
}

export function ls(tree, cwd, input = '') {
  const path = resolvePath(cwd, input);
  const node = nodeAt(tree, path);
  if (!node) return { ok: false, error: `ls: cannot access '${input}': No such file or directory` };
  if (node.type !== 'dir') return { ok: true, lines: [path[path.length - 1]] };
  return { ok: true, lines: [sortedNames(node).map((n) => label(n, node.children[n])).join('  ')] };
}

export function cd(tree, cwd, input) {
  const path = resolvePath(cwd, input);
  const node = nodeAt(tree, path);
  if (!node) return { ok: false, error: `cd: no such file or directory: ${input}` };
  if (node.type !== 'dir') return { ok: false, error: `cd: not a directory: ${input}` };
  return { ok: true, cwd: path };
}

export function cat(tree, cwd, input) {
  const node = nodeAt(tree, resolvePath(cwd, input));
  if (!node) return { ok: false, error: `cat: ${input}: No such file or directory` };
  if (node.type === 'dir') return { ok: false, error: `cat: ${input}: Is a directory` };
  if (node.type === 'link') return { ok: true, lines: [{ prefix: '→ ', text: node.href, href: node.href }] };
  return { ok: true, lines: node.lines };
}

export function tree(root) {
  const lines = ['~'];
  const walk = (node, prefix) => {
    const names = sortedNames(node);
    names.forEach((name, i) => {
      const last = i === names.length - 1;
      const child = node.children[name];
      lines.push(`${prefix}${last ? '└── ' : '├── '}${label(name, child)}`);
      if (child.type === 'dir') walk(child, `${prefix}${last ? '    ' : '│   '}`);
    });
  };
  walk(root, '');
  return lines;
}

export function completePath(tree, cwd, partial) {
  const cut = partial.lastIndexOf('/');
  const dirPart = cut >= 0 ? partial.slice(0, cut + 1) : '';
  const base = cut >= 0 ? partial.slice(cut + 1) : partial;
  const node = nodeAt(tree, resolvePath(cwd, dirPart));
  if (!node || node.type !== 'dir') return [];
  return sortedNames(node).filter((n) => n.startsWith(base)).map((n) => dirPart + label(n, node.children[n]));
}
