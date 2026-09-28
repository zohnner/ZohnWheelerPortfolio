import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, resolveTheme, themeCss, themeVars, isHex } from '../sitekit/themes.mjs';
import { ICONS, icon } from '../sitekit/icons.mjs';

test('resolveTheme applies valid overrides', () => {
  assert.deepEqual(
    resolveTheme({ preset: 'storm', mode: 'light' }, { preset: 'bold', accent: '#123456', mode: 'dark' }),
    { preset: 'bold', mode: 'dark', accent: '#123456' }
  );
});

test('resolveTheme ignores invalid overrides and keeps the base', () => {
  assert.deepEqual(
    resolveTheme({ preset: 'storm', mode: 'light', accent: '#f97316' }, { preset: 'nope', accent: 'red', mode: 'sepia' }),
    { preset: 'storm', mode: 'light', accent: '#f97316' }
  );
});

test('resolveTheme falls back to storm/light and rejects prototype keys', () => {
  assert.deepEqual(resolveTheme({ preset: 'x', mode: 'y', accent: 'z' }), { preset: 'storm', mode: 'light' });
  assert.deepEqual(resolveTheme({}, { preset: '__proto__' }), { preset: 'storm', mode: 'light' });
  assert.deepEqual(resolveTheme({}, { preset: 'constructor' }), { preset: 'storm', mode: 'light' });
});

test('themeCss emits custom properties with a readable onAccent for the accent', () => {
  const css = themeCss({ preset: 'storm', mode: 'light', accent: '#facc15' });
  assert.match(css, /^:root\{/);
  assert.match(css, /--accent:#facc15/);
  assert.match(css, /--onAccent:#111111/);
  assert.match(themeCss({ preset: 'storm', mode: 'light', accent: '#1e3a8a' }), /--onAccent:#ffffff/);
});

test('themeVars returns the preset tokens for the mode', () => {
  assert.equal(themeVars({ preset: 'clean', mode: 'dark' }).bg, THEMES.clean.dark.bg);
});

test('every theme defines the same tokens in light and dark, all hex', () => {
  const keys = Object.keys(THEMES.storm.light).sort();
  for (const [name, t] of Object.entries(THEMES)) {
    assert.ok(t.label, `${name} label`);
    for (const mode of ['light', 'dark']) {
      assert.deepEqual(Object.keys(t[mode]).sort(), keys, `${name}.${mode}`);
      for (const v of Object.values(t[mode])) assert.ok(isHex(v), `${name}.${mode} ${v}`);
    }
  }
});

test('icon renders an inline svg and falls back to check', () => {
  assert.match(icon('phone'), /^<svg class="icon" viewBox="0 0 24 24"[^>]*aria-hidden="true">/);
  assert.equal(icon('does-not-exist'), icon('check'));
  assert.ok(Object.keys(ICONS).length >= 16);
});
