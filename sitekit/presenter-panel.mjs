import { esc } from './escape.mjs';
import { THEMES, ACCENT_SWATCHES } from './themes.mjs';

export const PRESENTER_CSS = `.sk-panel{position:fixed;right:16px;bottom:16px;z-index:50;background:#111;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 10px 40px rgba(0,0,0,.35);font:14px/1.4 system-ui,sans-serif;width:250px}.sk-panel summary{cursor:pointer;font-weight:700}.sk-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.sk-row button,.sk-save{font:inherit;border:1px solid #444;background:#222;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}.sk-row button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 1px #fff}.sk-swatch{width:30px;height:30px;padding:0!important;border-radius:50%!important}.sk-save{width:100%;margin-top:12px;background:#fff;color:#111;font-weight:700}.sk-msg{margin-top:6px;min-height:1.2em}@media (max-width:860px){.sk-panel{bottom:76px}}`;

// Buttons reload the page with ?theme/&accent/&mode so the server renders the
// look (and ctx.href carries it to other pages). "Save" writes it to D1.
export function presenterPanel(ctx) {
  const t = ctx.theme;
  const presets = Object.entries(THEMES)
    .map(([k, v]) => `<button type="button" data-k="theme" data-v="${k}" aria-pressed="${t.preset === k}">${esc(v.label)}</button>`)
    .join('');
  const swatches = ACCENT_SWATCHES
    .map((h) => `<button type="button" class="sk-swatch" data-k="accent" data-v="${h}" style="background:${h}" aria-label="Accent ${h}" aria-pressed="${t.accent === h}"></button>`)
    .join('');
  const modes = ['light', 'dark']
    .map((m) => `<button type="button" data-k="mode" data-v="${m}" aria-pressed="${t.mode === m}">${m === 'light' ? 'Light' : 'Dark'}</button>`)
    .join('');
  const state = JSON.stringify({ slug: ctx.slug, theme: { preset: t.preset, accent: t.accent || undefined, mode: t.mode } }).replace(/</g, '\\u003c');
  return `<details class="sk-panel" open><summary>Presenter</summary><div class="sk-row">${presets}</div><div class="sk-row">${swatches}</div><div class="sk-row">${modes}</div><button type="button" class="sk-save" id="sk-save">Save this look</button><div class="sk-msg" id="sk-msg" role="status"></div></details>
<script>
(function(){var s=${state};
document.querySelectorAll('.sk-panel [data-k]').forEach(function(b){b.addEventListener('click',function(){var u=new URL(location.href);u.searchParams.set(b.dataset.k,b.dataset.v);location.href=u.toString();});});
document.getElementById('sk-save').addEventListener('click',function(){var m=document.getElementById('sk-msg');m.textContent='Saving…';fetch('/api/demo-theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)}).then(function(r){m.textContent=r.ok?'Saved ✓':'Save failed';}).catch(function(){m.textContent='Save failed';});});
})();
</script>`;
}
