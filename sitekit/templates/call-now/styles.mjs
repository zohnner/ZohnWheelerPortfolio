// Template A stylesheet. Colors come only from theme tokens (themes.mjs), so
// every preset/accent/mode combination works without touching this file.
// Accent is used for fills and decoration, never as small text on bg, to keep
// contrast at WCAG AA for any accent choice.
export const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;font-size:17px}
img{max-width:100%;display:block}
a{color:inherit}
h1,h2,h3{line-height:1.15;letter-spacing:-.015em}
.wrap{width:min(1120px,100% - 32px);margin-inline:auto}
.icon{width:1.25em;height:1.25em;flex:none}
.skip{position:absolute;left:-9999px}
.skip:focus{left:1rem;top:1rem;z-index:100;background:var(--bg);color:var(--text);padding:.5rem 1rem;border-radius:8px}
.btn{display:inline-flex;align-items:center;gap:.5em;padding:.85em 1.4em;border-radius:10px;font-weight:700;text-decoration:none;border:2px solid transparent;cursor:pointer;font-size:1rem;line-height:1.2;font-family:inherit}
.btn-accent{background:var(--accent);color:var(--onAccent)}
.btn-ghost{border-color:currentColor;color:inherit;background:transparent}
.btn:hover{filter:brightness(1.08)}
.btn:disabled{opacity:.6;cursor:wait}
a:focus-visible,.btn:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.ribbon{background:#111;color:#fff;font-size:.85rem;text-align:center;padding:.5em 1em}
.ribbon a{color:#fff;font-weight:700;margin-left:.75em}
.banner{background:var(--accent);color:var(--onAccent);text-align:center;font-weight:700;padding:.6em 1em}
.banner a{color:inherit;margin-left:.5em}
.site-header{background:var(--primary);color:var(--onPrimary);position:sticky;top:0;z-index:20}
.site-header .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:68px;position:relative}
.brand{font-weight:800;font-size:1.2rem;text-decoration:none;letter-spacing:-.01em}
.nav{display:flex;align-items:center;gap:1.5rem}
.nav a:not(.btn){text-decoration:none;font-weight:600;opacity:.9}
.nav a:not(.btn):hover{opacity:1}
.menu{display:none}
.menu summary{list-style:none;cursor:pointer;padding:.4rem;display:flex}
.menu summary::-webkit-details-marker{display:none}
.menu summary .icon{width:1.6rem;height:1.6rem}
.menu nav{position:absolute;right:0;top:100%;background:var(--primary);padding:1rem 1.25rem;border-radius:0 0 12px 12px;display:flex;flex-direction:column;gap:.9rem;min-width:220px;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.menu nav a{text-decoration:none;font-weight:600}
.hero{position:relative;color:#fff;background:var(--primary);overflow:hidden}
.hero-media{position:absolute;inset:0}
.hero-media img{width:100%;height:100%;object-fit:cover}
.hero-media::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(0,0,0,.8) 0%,rgba(0,0,0,.58) 55%,rgba(0,0,0,.3) 100%)}
.hero .wrap{position:relative;padding:clamp(4rem,10vw,7.5rem) 0}
.hero h1{font-size:clamp(2.1rem,5vw,3.6rem);line-height:1.06;margin:0 0 1rem;max-width:18ch}
.hero p{font-size:clamp(1.05rem,2vw,1.3rem);max-width:46ch;margin:0 0 2rem;opacity:.92}
.hero-ctas{display:flex;flex-wrap:wrap;gap:.75rem}
.eyebrow{display:inline-flex;align-items:center;gap:.5em;text-transform:uppercase;font-size:.8rem;font-weight:800;letter-spacing:.08em;color:var(--muted);margin-bottom:.75rem}
.eyebrow::before{content:"";width:.6em;height:.6em;border-radius:50%;background:var(--accent)}
.hero .eyebrow{color:#fff}
.trust{background:var(--surface);border-bottom:1px solid var(--border)}
.trust ul{list-style:none;margin:0;padding:1.1rem 0;display:flex;flex-wrap:wrap;justify-content:center;gap:.75rem 2rem}
.trust li{display:flex;align-items:center;gap:.5em;font-weight:700}
.trust .icon{color:var(--accent)}
.section{padding:clamp(3.5rem,8vw,6rem) 0}
.section.alt{background:var(--surface)}
.section-head{max-width:640px;margin:0 0 2.5rem}
.section-head h2{font-size:clamp(1.7rem,3.5vw,2.4rem);margin:0 0 .6rem}
.section-head p{color:var(--muted);margin:0}
.sub-h{font-size:1.2rem;margin:2.5rem 0 1rem}
.grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
.section.alt .card{background:var(--bg)}
a.card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(0,0,0,.14)}
.card-media{aspect-ratio:16/10;background:var(--border)}
.card-media img{width:100%;height:100%;object-fit:cover}
.card-media-icon{display:grid;place-items:center;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 70%,var(--accent)));color:var(--onPrimary)}
.card-media-icon .icon{width:3.5rem;height:3.5rem;opacity:.9}
.card-body{padding:1.25rem 1.25rem 1.5rem;display:flex;flex-direction:column;gap:.5rem;flex:1}
.card h3{margin:0;font-size:1.2rem;display:flex;align-items:center;gap:.5em}
.card h3 .icon{color:var(--accent)}
.card p{margin:0;color:var(--muted)}
.more{margin-top:auto;padding-top:.5rem;font-weight:700;text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:4px}
.features{display:grid;gap:1.75rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.feature-icon{width:2.6rem;height:2.6rem;padding:.6rem;border-radius:12px;background:var(--accent);color:var(--onAccent);margin-bottom:.9rem}
.feature h3{margin:0 0 .35rem;font-size:1.1rem}
.feature p{margin:0;color:var(--muted)}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:4px;border-radius:14px;overflow:hidden}
.ba figure{margin:0;position:relative;aspect-ratio:4/3}
.ba img{width:100%;height:100%;object-fit:cover}
.ba figcaption{position:absolute;left:.6rem;top:.6rem;background:rgba(0,0,0,.72);color:#fff;font-size:.75rem;font-weight:800;text-transform:uppercase;padding:.2em .6em;border-radius:6px}
.gallery-item p{margin:.6rem 0 0;color:var(--muted);font-size:.95rem}
.reviews{columns:3 280px;column-gap:1.25rem}
.reviews-more{margin-top:1.5rem;text-align:center}
.review{break-inside:avoid;margin:0 0 1.25rem;background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:1.4rem}
.section:not(.alt) .review{background:var(--surface)}
.stars{color:#f5a623;display:flex;gap:2px}
.stars .icon{fill:currentColor;width:1.1em;height:1.1em}
.review blockquote{margin:.7rem 0 .9rem}
.review figcaption{font-weight:700;font-size:.95rem}
.review figcaption span{color:var(--muted);font-weight:500}
.chips{display:flex;flex-wrap:wrap;gap:.6rem;list-style:none;padding:0;margin:0}
.chips a{display:inline-flex;align-items:center;gap:.4em;padding:.55em 1em;border:1px solid var(--border);border-radius:999px;text-decoration:none;font-weight:600;background:var(--bg)}
.chips a:hover{border-color:var(--accent)}
.chips .icon{color:var(--accent)}
.financing{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1.5rem;background:var(--primary);color:var(--onPrimary);border-radius:18px;padding:clamp(1.75rem,4vw,2.75rem)}
.financing h2{margin:0 0 .4rem}
.financing .prose p{margin:0}
.faq{max-width:780px}
.faq details{border-bottom:1px solid var(--border);padding:1.1rem 0}
.faq summary{font-weight:700;cursor:pointer;font-size:1.08rem;list-style:none;display:flex;justify-content:space-between;gap:1rem}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-size:1.4rem;line-height:1}
.faq details[open] summary::after{content:"–"}
.faq .answer{color:var(--muted);padding-top:.6rem}
.faq .answer p{margin:0 0 .6rem}
.cta-band{background:var(--primary);color:var(--onPrimary);text-align:center}
.cta-band h2{font-size:clamp(1.8rem,4vw,2.6rem);margin:0 0 .6rem}
.cta-band p{opacity:.88;margin:0 auto 1.75rem;max-width:52ch}
.cta-band .hero-ctas{justify-content:center}
.page-hero{background:var(--primary);color:var(--onPrimary);padding:clamp(3rem,7vw,4.5rem) 0}
.page-hero h1{margin:0 0 .5rem;font-size:clamp(1.9rem,4.5vw,3rem)}
.page-hero p{margin:0;opacity:.88;max-width:60ch;font-size:1.1rem}
.crumbs{font-size:.85rem;opacity:.8;margin-bottom:.9rem}
.crumbs a{text-decoration:none}
.crumbs a:hover{text-decoration:underline}
.split{display:grid;gap:2.5rem;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:start}
.prose{max-width:68ch}
.prose p{margin:0 0 1.1rem}
.prose ul{padding-left:1.2rem;margin:0 0 1.1rem}
.prose li{margin-bottom:.35rem}
.prose a{text-decoration-color:var(--accent)}
.aside-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;position:sticky;top:90px}
.aside-card h2{font-size:1.25rem;margin:0 0 .5rem}
.aside-card p{color:var(--muted);margin:0 0 .75rem}
.aside-card .btn{width:100%;justify-content:center;margin-top:.75rem}
.rounded{border-radius:14px;overflow:hidden;margin-bottom:1.75rem;aspect-ratio:16/9;background:var(--border)}
.rounded img{width:100%;height:100%;object-fit:cover}
.form{display:grid;gap:1rem}
.form label{display:grid;gap:.35rem;font-weight:600;font-size:.95rem}
.form input,.form textarea{font:inherit;padding:.8em .9em;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
.form textarea{min-height:130px;resize:vertical}
.form .hp{position:absolute;left:-9999px}
.form button{justify-self:start}
.form-status{font-weight:700;min-height:1.5em;margin:0}
.info-list{list-style:none;padding:0;margin:0;display:grid;gap:1rem}
.info-list li{display:flex;gap:.75rem}
.info-list .icon{color:var(--accent);margin-top:.2em}
.site-footer{background:var(--primary);color:var(--onPrimary);padding:3.5rem 0 2rem;font-size:.95rem}
.footer-grid{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.site-footer h2{font-size:.95rem;margin:0 0 .75rem;text-transform:uppercase;letter-spacing:.06em;opacity:.85}
.site-footer ul{list-style:none;padding:0;margin:0;display:grid;gap:.4rem}
.site-footer a{text-decoration:none}
.site-footer a:hover{text-decoration:underline}
.legal{margin:2.5rem 0 0;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.18);opacity:.8;font-size:.85rem}
.callbar{display:none}
@media (max-width:860px){
  .nav{display:none}
  .menu{display:block}
  .split{grid-template-columns:1fr}
  .aside-card{position:static}
  .site-footer{padding-bottom:6rem}
  .callbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;box-shadow:0 -6px 20px rgba(0,0,0,.18)}
  .callbar a{flex:1;display:flex;align-items:center;justify-content:center;gap:.5em;padding:1rem;font-weight:800;text-decoration:none}
  .callbar .call{background:var(--accent);color:var(--onAccent)}
  .callbar .quote{background:var(--primary);color:var(--onPrimary)}
}
`;
