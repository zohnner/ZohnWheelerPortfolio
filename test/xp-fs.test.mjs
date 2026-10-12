import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, resolvePath, nodeAt, formatCwd, ls, cd, cat, tree, completePath } from '../public/xp/fs.js';

const T = buildTree({
  projects: [
    { id: 'alpha', name: 'Alpha', story: 'Alpha story.', stack: ['JS', 'D1'], links: [{ label: 'Live', href: 'https://a.example/' }] },
    { id: 'beta', name: 'Beta', story: 'Beta story.', stack: ['Py'], links: [] },
  ],
  owner: { email: 'z@example.com', linkedin: 'https://li.example/z', github: 'https://gh.example/z' },
  about: ['line one', 'line two'],
});

test('resolvePath handles relative, absolute, home, dot and dot-dot', () => {
  assert.deepEqual(resolvePath([], 'projects/alpha'), ['projects', 'alpha']);
  assert.deepEqual(resolvePath(['projects'], '..'), []);
  assert.deepEqual(resolvePath([], '..'), []);
  assert.deepEqual(resolvePath(['projects'], '~/about.txt'), ['about.txt']);
  assert.deepEqual(resolvePath(['projects'], '/projects/./beta/'), ['projects', 'beta']);
  assert.deepEqual(resolvePath(['projects'], '~'), []);
  assert.deepEqual(resolvePath(['projects'], ''), ['projects']);
});

test('nodeAt refuses inherited keys', () => {
  assert.equal(nodeAt(T, ['constructor']), null);
  assert.equal(nodeAt(T, ['projects', '__proto__']), null);
});

test('formatCwd', () => {
  assert.equal(formatCwd([]), '~');
  assert.equal(formatCwd(['projects', 'alpha']), '~/projects/alpha');
});

test('ls lists sorted names with a slash on directories', () => {
  assert.deepEqual(ls(T, []), { ok: true, lines: ['about.txt  contact.txt  projects/  resume'] });
  assert.deepEqual(ls(T, ['projects']), { ok: true, lines: ['alpha/  beta/'] });
  assert.deepEqual(ls(T, [], 'about.txt'), { ok: true, lines: ['about.txt'] });
  assert.deepEqual(ls(T, [], 'nope'), { ok: false, error: "ls: cannot access 'nope': No such file or directory" });
});

test('cd moves into directories and reports shell-style errors', () => {
  assert.deepEqual(cd(T, [], 'projects'), { ok: true, cwd: ['projects'] });
  assert.deepEqual(cd(T, ['projects'], '~'), { ok: true, cwd: [] });
  assert.deepEqual(cd(T, [], 'about.txt'), { ok: false, error: 'cd: not a directory: about.txt' });
  assert.deepEqual(cd(T, [], 'nope'), { ok: false, error: 'cd: no such file or directory: nope' });
  assert.deepEqual(cd(T, [], 'constructor'), { ok: false, error: 'cd: no such file or directory: constructor' });
});

test('cat prints files, links and errors', () => {
  assert.deepEqual(cat(T, [], 'about.txt'), { ok: true, lines: ['line one', 'line two'] });
  assert.deepEqual(cat(T, [], 'projects/alpha/README'), { ok: true, lines: ['Alpha', '', 'Alpha story.', '', 'stack: JS · D1'] });
  assert.deepEqual(cat(T, [], 'projects/alpha/links'), { ok: true, lines: [{ prefix: 'Live: ', text: 'https://a.example/', href: 'https://a.example/' }] });
  assert.deepEqual(cat(T, [], 'resume'), { ok: true, lines: [{ prefix: '→ ', text: '/resume.html', href: '/resume.html' }] });
  assert.deepEqual(cat(T, [], 'projects'), { ok: false, error: 'cat: projects: Is a directory' });
  assert.deepEqual(cat(T, [], 'nope'), { ok: false, error: 'cat: nope: No such file or directory' });
});

test('contact.txt holds clickable links', () => {
  const { lines } = cat(T, [], 'contact.txt');
  assert.deepEqual(lines[0], { prefix: 'email:    ', text: 'z@example.com', href: 'mailto:z@example.com' });
  assert.equal(lines.length, 4);
});

test('tree draws the whole filesystem', () => {
  assert.deepEqual(tree(T), [
    '~',
    '├── about.txt',
    '├── contact.txt',
    '├── projects/',
    '│   ├── alpha/',
    '│   │   ├── README',
    '│   │   └── links',
    '│   └── beta/',
    '│       ├── README',
    '│       └── links',
    '└── resume',
  ]);
});

test('completePath completes names relative to cwd and through directories', () => {
  assert.deepEqual(completePath(T, [], 'pro'), ['projects/']);
  assert.deepEqual(completePath(T, [], 'projects/a'), ['projects/alpha/']);
  assert.deepEqual(completePath(T, ['projects'], ''), ['alpha/', 'beta/']);
  assert.deepEqual(completePath(T, [], '~/ab'), ['~/about.txt']);
  assert.deepEqual(completePath(T, [], 'zz'), []);
  assert.deepEqual(completePath(T, [], 'about.txt/x'), []);
});
