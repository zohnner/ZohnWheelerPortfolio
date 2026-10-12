import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, createRegistry, createHistory } from '../public/xp/commands.js';

test('parseInput lowercases the name and keeps arg case', () => {
  assert.deepEqual(parseInput('  OPEN  SportStrata '), { name: 'open', args: ['SportStrata'], raw: 'OPEN  SportStrata' });
});

test('parseInput returns null for blank input', () => {
  assert.equal(parseInput(''), null);
  assert.equal(parseInput('   '), null);
  assert.equal(parseInput(undefined), null);
});

test('run passes args to the handler and wraps a string in an array', async () => {
  const r = createRegistry();
  r.register('echo', (args) => args.join(' '), 'echo: repeat');
  assert.deepEqual(await r.run('echo a b'), { ok: true, output: ['a b'] });
});

test('array output passes through and undefined output is empty', async () => {
  const r = createRegistry();
  r.register('two', () => ['x', { text: 'y', href: '/y' }]);
  r.register('none', () => undefined);
  assert.deepEqual((await r.run('two')).output, ['x', { text: 'y', href: '/y' }]);
  assert.deepEqual(await r.run('none'), { ok: true, output: [] });
});

test('async handlers are awaited', async () => {
  const r = createRegistry();
  r.register('later', async () => 'done');
  assert.deepEqual((await r.run('later')).output, ['done']);
});

test('unknown commands return a hint', async () => {
  const r = createRegistry();
  assert.deepEqual(await r.run('nope'), { ok: false, output: ["command not found: nope. type 'help' for commands."] });
});

test('blank input is a no-op', async () => {
  assert.deepEqual(await createRegistry().run('  '), { ok: true, output: [] });
});

test('handler errors become output instead of throwing', async () => {
  const r = createRegistry();
  r.register('boom', () => { throw new Error('kaboom'); });
  assert.deepEqual(await r.run('boom'), { ok: false, output: ['boom: kaboom'] });
});

test('list returns only commands with help, in registration order', () => {
  const r = createRegistry();
  r.register('help', () => {}, 'help: list commands');
  r.register('whoami', () => 'guest');
  r.register('clear', () => {}, 'clear: clear the terminal');
  assert.deepEqual(r.list(), [
    { name: 'help', help: 'help: list commands' },
    { name: 'clear', help: 'clear: clear the terminal' },
  ]);
});

test('complete returns sorted prefix matches', () => {
  const r = createRegistry();
  for (const n of ['cat', 'clear', 'classic', 'contact']) r.register(n, () => {});
  assert.deepEqual(r.complete('cl'), ['classic', 'clear']);
  assert.deepEqual(r.complete('CA'), ['cat']);
  assert.deepEqual(r.complete('z'), []);
});

test('history walks back and forward, skipping blanks and repeats', () => {
  const h = createHistory();
  for (const line of ['a', 'b', 'b', '  ']) h.push(line);
  assert.equal(h.prev(), 'b');
  assert.equal(h.prev(), 'a');
  assert.equal(h.prev(), 'a');
  assert.equal(h.next(), 'b');
  assert.equal(h.next(), '');
});

test('history respects its limit', () => {
  const h = createHistory(2);
  for (const line of ['a', 'b', 'c']) h.push(line);
  assert.equal(h.prev(), 'c');
  assert.equal(h.prev(), 'b');
  assert.equal(h.prev(), 'b');
});

test('history on empty returns empty strings', () => {
  const h = createHistory();
  assert.equal(h.prev(), '');
  assert.equal(h.next(), '');
});

test('names lists every registered command, with or without help', () => {
  const r = createRegistry();
  r.register('help', () => {}, 'help: list commands');
  r.register('whoami', () => 'guest');
  assert.deepEqual(r.names(), ['help', 'whoami']);
});

test('fallback handles unknown commands and receives the parsed input', async () => {
  const r = createRegistry();
  let seen = null;
  r.setFallback((parsed) => { seen = parsed; return 'handled'; });
  assert.deepEqual(await r.run('What is   this?'), { ok: true, output: ['handled'] });
  assert.deepEqual(seen, { name: 'what', args: ['is', 'this?'], raw: 'What is   this?' });
});

test('fallback errors become output', async () => {
  const r = createRegistry();
  r.setFallback(async () => { throw new Error('nope'); });
  assert.deepEqual(await r.run('zzz'), { ok: false, output: ['zzz: nope'] });
});

test('known commands never reach the fallback', async () => {
  const r = createRegistry();
  r.register('ls', () => 'files');
  r.setFallback(() => 'fallback');
  assert.deepEqual((await r.run('ls')).output, ['files']);
});
