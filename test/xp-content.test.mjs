import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, TRACKS, NARRATION, OWNER, GITHUB_USER } from '../public/xp/content.js';

const ids = PROJECTS.map((p) => p.id);

test('project ids are unique', () => {
  assert.equal(new Set(ids).size, ids.length);
});

test('every project has the fields the UI renders', () => {
  for (const p of PROJECTS) {
    assert.match(p.id, /^[a-z]+$/, p.id);
    assert.ok(p.name, `${p.id} name`);
    assert.match(p.color, /^#[0-9a-f]{6}$/i, `${p.id} color`);
    assert.ok(p.story.length > 40, `${p.id} story`);
    assert.ok(Array.isArray(p.stack) && p.stack.length > 0, `${p.id} stack`);
    assert.ok(p.links.length > 0, `${p.id} links`);
    for (const l of p.links) assert.ok(l.label && l.href, `${p.id} link`);
    if (p.healthUrl) assert.match(p.healthUrl, /^https:\/\//, `${p.id} healthUrl`);
  }
});

test('the three featured live projects are health-checked', () => {
  const checked = PROJECTS.filter((p) => p.healthUrl).map((p) => p.id);
  assert.deepEqual(checked, ['sportstrata', 'botchase', 'zretrobuild']);
});

test('both tracks exist and only list real projects', () => {
  assert.deepEqual(Object.keys(TRACKS).sort(), ['build', 'hire']);
  for (const [name, t] of Object.entries(TRACKS)) {
    assert.ok(t.order.length > 0, name);
    for (const id of t.order) assert.ok(ids.includes(id), `${name} lists unknown ${id}`);
    assert.ok(t.contact.href && t.contact.text, `${name} contact`);
  }
});

test('every scripted line exists and is short enough for a 30 KB clip', () => {
  const required = ['intro', 'welcome', 'bio', 'ask', 'track.hire', 'track.build', ...ids.map((id) => `project.${id}`)];
  for (const id of required) assert.ok(NARRATION[id], `missing narration ${id}`);
  for (const [id, text] of Object.entries(NARRATION)) assert.ok(text.length <= 140, `${id} is ${text.length} chars`);
});

test('owner links', () => {
  assert.equal(OWNER.email, 'zohnwheeler@gmail.com');
  assert.equal(GITHUB_USER, 'zohnner');
});
