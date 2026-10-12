import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPalette, PALETTE_NAMES, PALETTES } from '../public/xp/crt.js';

function fakeRoot() {
  const props = {};
  return { props, style: { setProperty: (k, v) => { props[k] = v; } } };
}

test('applyPalette sets the three phosphor variables', () => {
  const root = fakeRoot();
  assert.equal(applyPalette('amber', root), true);
  assert.deepEqual(root.props, { '--phosphor': '#ffb000', '--phosphor-dim': '#7a5500', '--glow': '255,176,0' });
});

test('applyPalette rejects unknown and inherited names', () => {
  const root = fakeRoot();
  assert.equal(applyPalette('pink', root), false);
  assert.equal(applyPalette('constructor', root), false);
  assert.deepEqual(root.props, {});
});

test('palettes on offer', () => {
  assert.deepEqual(PALETTE_NAMES, ['green', 'amber', 'white']);
  assert.equal(PALETTES.green.phosphor, '#3dff9a');
});
