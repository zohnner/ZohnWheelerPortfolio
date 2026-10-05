#!/usr/bin/env node
// Sitekit CLI. Writes (push/status, and pitch in Task 12) generate SQL into
// scripts/.site-push.sql and print the wrangler command for you to run — same
// --file pattern as new-project.js, because `wrangler d1 execute --command`
// silently drops every statement after the first. Reads (demo-link/pull/views)
// run a single SELECT through wrangler directly since they change nothing.
//
// Usage: node scripts/site.mjs <command> [args] [--local]  (scaffold/scaffold-check: see README "Scaffolding")

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../sitekit/validate.mjs';
import { pushSql, statusSql, pitchStatusSql, STATUSES, parseCsvChecked, slugify, stubFromProspect, pitchText } from '../sitekit/admin.mjs';
import { renderPage, listPages, renderSitemap, renderRobots } from '../sitekit/render.mjs';
import { gather, renderBriefMd, noAiContent, isStub } from '../sitekit/scaffold/brief.mjs';
import { runCheck } from '../sitekit/scaffold/check.mjs';
import { renderReview, summaryLine } from '../sitekit/scaffold/review.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// SK_SITES_DIR lets tests run against a throwaway directory.
const SITES_DIR = process.env.SK_SITES_DIR ? path.resolve(process.env.SK_SITES_DIR) : path.join(ROOT, 'sites');
const BRIEFS_DIR = path.join(SITES_DIR, '.briefs');
const REVIEW_DIR = path.join(SITES_DIR, '.review');
const BAK_DIR = path.join(SITES_DIR, '.bak');
const TOKENS_FILE = path.join(SITES_DIR, '.tokens.json');
// Local clone of the private repo Muse commits prospect batches to.
const PROSPECTS_DIR = process.env.SK_PROSPECTS_DIR ? path.resolve(process.env.SK_PROSPECTS_DIR) : path.resolve(ROOT, '..', 'sitekit-prospects');
const SQL_FILE = path.join(ROOT, 'scripts', '.site-push.sql');
const BASE_URL = process.env.SK_BASE_URL || 'https://zohnwheelerportfolio.pages.dev';
const DB = 'portfolio-leads';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// These never take a value, so `scaffold --force acme` keeps "acme" as a slug.
const BOOLEAN_FLAGS = new Set(['local', 'force', 'no-ai', 'no-refresh']);

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      const next = args[i + 1];
      if (BOOLEAN_FLAGS.has(name) || next === undefined || next.startsWith('--')) out[name] = true;
      else { out[name] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);
const target = flags.local ? '--local' : '--remote';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Creates a sites/<slug>.json stub per good CSV row. Rows with the wrong field
// count, no name, or an existing slug are skipped and reported.
function importCsv(text) {
  fs.mkdirSync(SITES_DIR, { recursive: true });
  const { rows, bad } = parseCsvChecked(text);
  for (const b of bad) console.warn(`skipping row ${b.row} "${b.name}" has ${b.fields} fields, expected ${b.expected} — fix the commas and re-import it`);
  const created = [];
  for (const row of rows) {
    if (!row.name) { console.warn('skipping a row with no name'); continue; }
    const slug = slugify(row.name);
    if (!slug) { console.warn(`skipping "${row.name}" — slugifies to an empty string`); continue; }
    const p = path.join(SITES_DIR, `${slug}.json`);
    if (fs.existsSync(p)) { console.log(`skip ${slug} (already exists)`); continue; }
    const stub = stubFromProspect(row);
    fs.writeFileSync(p, JSON.stringify(stub, null, 2) + '\n');
    created.push(slug);
    const { errors, warnings } = validateContent(stub, { slug, fileExists });
    console.log(`created sites/${slug}.json${errors.length ? ` — needs: ${errors.join('; ')}` : ''}${warnings.length ? ` (${plural(warnings.length, 'warning')})` : ''}`);
  }
  return { created, bad };
}

function sitePath(slug) {
  if (!SLUG.test(slug || '')) fail(`Invalid or missing slug: ${slug ?? '(none)'}`);
  return path.join(SITES_DIR, `${slug}.json`);
}

// Explicit slugs (as opposed to slugs discovered from sites/*.json, which are
// already filtered against SLUG) are user input and may include a typo. All
// of them are validated up front so a bad slug partway through a batch never
// lets earlier slugs get processed before the command dies.
function failOnInvalidSlugs(slugs) {
  const bad = slugs.filter((s) => !SLUG.test(s));
  if (bad.length) fail(`Invalid slug(s): ${bad.join(', ')}`);
}

function readContent(slug) {
  const p = sitePath(slug);
  if (!fs.existsSync(p)) fail(`No content file at ${path.relative(ROOT, p)}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeContent(slug, content) {
  fs.writeFileSync(sitePath(slug), JSON.stringify(content, null, 2) + '\n');
}

function backupContent(slug) {
  const p = sitePath(slug);
  if (!fs.existsSync(p)) return;
  fs.mkdirSync(BAK_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(p, path.join(BAK_DIR, `${slug}.${stamp}.json`));
}

// Content files are always backed up before a scaffold command overwrites them.
function writeContentBackedUp(slug, content) {
  backupContent(slug);
  writeContent(slug, content);
}

const briefFile = (slug, ext) => path.join(BRIEFS_DIR, `${slug}${ext}`);
const readIfExists = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

function siteSlugs() {
  if (!fs.existsSync(SITES_DIR)) return [];
  return fs.readdirSync(SITES_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
    .map((f) => f.slice(0, -5))
    .filter((s) => SLUG.test(s));
}

function checkSlugs(slugs) {
  const results = slugs.map((slug) => {
    const r = runCheck({
      slug,
      contentText: readIfExists(sitePath(slug)),
      provenanceText: readIfExists(briefFile(slug, '.provenance.json')),
      briefText: readIfExists(briefFile(slug, '.json')),
      fileExists,
    });
    if (r.changed) {
      writeContentBackedUp(slug, r.content);
      fs.writeFileSync(briefFile(slug, '.provenance.json'), JSON.stringify(r.provenance, null, 2) + '\n');
    }
    console.log(summaryLine(r));
    return r;
  });
  const date = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  const out = path.join(REVIEW_DIR, `${date}.html`);
  fs.writeFileSync(out, renderReview({ date, results }));
  console.log(`\nReview page: ${rel(out)}`);
}

function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch { return {}; }
}

function saveToken(slug, token) {
  const t = readTokens();
  t[slug] = token;
  fs.mkdirSync(SITES_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(t, null, 2) + '\n');
}

const demoLink = (slug, token) => `${BASE_URL}/demo/${slug}?t=${token}`;

function writeSql(sql) {
  fs.writeFileSync(SQL_FILE, sql);
  const rel = path.relative(ROOT, SQL_FILE).replace(/\\/g, '/');
  console.log(`\nWrote ${rel}. Run:\n\n  npx wrangler d1 execute ${DB} ${target} --file ${rel}\n`);
}

// Single-statement reads only. Slugs are validated, so the only quotes in
// the SQL are single quotes; double quotes would break the shell quoting.
function d1Query(sql) {
  if (sql.includes('"')) throw new Error('d1Query SQL must not contain double quotes');
  const out = execSync(`npx wrangler d1 execute ${DB} ${target} --json --command "${sql}"`, {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
}

const fileExists = (rel) => fs.existsSync(path.join(ROOT, rel));

function runValidate(slug, content) {
  const { errors, warnings } = validateContent(content, { slug, fileExists });
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    fail(`\n${slug}: ${errors.length} error(s) — fix them and try again.`);
  }
  console.log(`${slug}: valid${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
}

const commands = {
  validate() {
    const slug = flags._[0];
    runValidate(slug, readContent(slug));
  },

  push() {
    const slug = flags._[0];
    const content = readContent(slug);
    runValidate(slug, content);
    const token = readTokens()[slug] || crypto.randomBytes(24).toString('hex');
    saveToken(slug, token);
    writeSql(pushSql({ id: crypto.randomUUID(), slug, token, content, now: new Date().toISOString() }));
    console.log(`Demo link (works once the SQL has run):\n\n  ${demoLink(slug, token)}\n`);
    console.log(`Token saved to sites/.tokens.json (gitignored, local-only). If that file is lost, recover it with: node scripts/site.mjs demo-link ${slug}`);
    console.log(`If ${slug} was first pushed from another machine, run: node scripts/site.mjs demo-link ${slug}`);
  },

  'demo-link'() {
    const slug = flags._[0];
    sitePath(slug);
    const rows = d1Query(`SELECT demo_token FROM sites WHERE slug = '${slug}'`);
    if (!rows.length) fail(`${slug} is not in the database yet — run push first.`);
    saveToken(slug, rows[0].demo_token);
    console.log(demoLink(slug, rows[0].demo_token));
  },

  status() {
    const [slug, status] = flags._;
    sitePath(slug);
    if (!STATUSES.includes(status)) fail(`Status must be one of: ${STATUSES.join(', ')}`);
    if (status === 'live' && typeof flags.domain !== 'string') fail('Going live requires --domain example.com');
    const domain = typeof flags.domain === 'string' ? flags.domain : null;
    try {
      writeSql(statusSql({ slug, status, domain, now: new Date().toISOString() }));
    } catch (err) {
      fail(err.message);
    }
    if (status === 'live') {
      const email = readContent(slug).business?.email;
      console.log(`Lead recipient once live: ${email || 'none — leads will email the owner'}`);
      console.log('Also add the domain (and www.) as custom domains on the zohnwheelerportfolio Pages project.');
    }
  },

  pull() {
    const slug = flags._[0];
    const content = readContent(slug);
    const rows = d1Query(`SELECT json_extract(content_json, '$.theme') AS theme FROM sites WHERE slug = '${slug}'`);
    if (!rows.length || !rows[0].theme) fail(`${slug} has no saved theme in the database.`);
    content.theme = JSON.parse(rows[0].theme);
    writeContent(slug, content);
    console.log(`Updated sites/${slug}.json theme → ${rows[0].theme}`);
  },

  views() {
    const rows = d1Query(
      `SELECT s.slug, s.status, COUNT(v.id) AS views, MAX(v.viewed_at) AS last_view FROM sites s JOIN demo_views v ON v.site_id = s.id GROUP BY s.id ORDER BY last_view DESC LIMIT 50`
    );
    if (!rows.length) console.log('No demo views yet.');
    else console.table(rows);
  },

  'import'() {
    const file = flags._[0];
    if (!file || !fs.existsSync(file)) fail('Usage: node scripts/site.mjs import prospects.csv');
    const { created } = importCsv(fs.readFileSync(file, 'utf8'));
    console.log(`\n${created.length} new site(s). Next: node scripts/site.mjs scaffold, then /scaffold-sites in Claude Code.`);
  },

  // Muse commits batches to inbox/ in the private prospects repo. Pull, import
  // each new batch, move it to done/, and push — run by the Monday task.
  inbox() {
    const dir = PROSPECTS_DIR;
    if (!fs.existsSync(path.join(dir, '.git'))) fail(`${dir} is not a git clone of the prospects repo (set SK_PROSPECTS_DIR or clone it there).`);
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try { git('pull', '--ff-only', '--quiet'); } catch (e) { fail(`git pull failed in ${dir}: ${String(e.stderr || e.message).trim()}`); }
    const inboxDir = path.join(dir, 'inbox');
    const files = fs.existsSync(inboxDir) ? fs.readdirSync(inboxDir).filter((f) => f.endsWith('.csv')).sort() : [];
    if (!files.length) { console.log('No new batches.'); return; }
    fs.mkdirSync(path.join(dir, 'done'), { recursive: true });
    const lines = [];
    let sites = 0;
    let badRows = 0;
    for (const f of files) {
      console.log(`\n== ${f}`);
      const { created, bad } = importCsv(fs.readFileSync(path.join(inboxDir, f), 'utf8'));
      sites += created.length;
      badRows += bad.length;
      const line = `${f}: ${plural(created.length, 'new site')}, ${plural(bad.length, 'bad row')}`;
      console.log(line);
      lines.push(line, ...bad.map((b) => `  - row ${b.row} "${b.name}" has ${b.fields} fields, expected ${b.expected} (not imported)`));
      git('mv', `inbox/${f}`, `done/${f}`);
    }
    git('commit', '--quiet', '-m', `Import ${files.join(', ')}: ${plural(sites, 'new site')}, ${plural(badRows, 'bad row')}\n\n${lines.join('\n')}`);
    try { git('push', '--quiet'); } catch (e) { console.warn(`\nWarning: imported, but git push failed — run "git -C ${dir} push" later. ${String(e.stderr || e.message).trim()}`); }
    console.log(`\n${plural(sites, 'new site')} from ${plural(files.length, 'batch', 'batches')}. Next: node scripts/site.mjs scaffold, then /scaffold-sites in Claude Code.`);
  },

  pitch() {
    const slug = flags._[0];
    const content = readContent(slug);
    let token = readTokens()[slug];
    if (!flags['no-refresh']) {
      // The local cache (sites/.tokens.json) can be stale or lost; D1 is the
      // authoritative source for the token actually live behind the demo link.
      const rows = d1Query(`SELECT demo_token FROM sites WHERE slug = '${slug}'`);
      if (!rows.length) fail(`${slug} is not in the database yet — run push first.`);
      token = rows[0].demo_token;
      saveToken(slug, token);
    }
    if (!token) fail(`No demo link for ${slug} yet — run push (or demo-link) first.`);
    let result;
    try {
      result = pitchText({ content, link: demoLink(slug, token), mailingAddress: process.env.SK_MAILING_ADDRESS });
    } catch (err) {
      fail(err.message);
    }
    console.log('\n----- paste into Muse -----\n');
    console.log(result.text);
    console.log('\n---------------------------');
    if (result.channel !== 'none') writeSql(pitchStatusSql({ slug, now: new Date().toISOString() }));
  },

  'export'() {
    const slug = flags._[0];
    const content = readContent(slug);
    runValidate(slug, content);
    const origin = typeof flags.origin === 'string' ? flags.origin.replace(/\/+$/, '') : '';
    const out = path.join(ROOT, 'dist', slug);
    fs.rmSync(out, { recursive: true, force: true });
    const assets = new Set();
    const pages = listPages(content);
    for (const { page, path: urlPath } of pages) {
      const html = renderPage({ content, slug, page, mode: 'export', origin });
      const file = path.join(out, urlPath, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, html);
      for (const m of html.matchAll(/\/sk\/[A-Za-z0-9_\-./]+/g)) assets.add(m[0]);
    }
    const publicDir = path.join(ROOT, 'public');
    for (const a of assets) {
      const src = path.join(publicDir, a);
      const dst = path.join(out, a);
      // Defense in depth: resolveImage already rejects traversal refs, but an
      // asset path pulled from rendered HTML is re-checked here too, since a
      // path that escapes public/ or dist/<slug>/ must never be read or
      // written even if some future ref format lets one slip through.
      const relSrc = path.relative(publicDir, src);
      const relDst = path.relative(out, dst);
      if (relSrc.startsWith('..') || path.isAbsolute(relSrc) || relDst.startsWith('..') || path.isAbsolute(relDst)) {
        console.warn(`warning: refusing to copy asset outside public//dist: ${a}`);
        continue;
      }
      if (!fs.existsSync(src)) { console.warn(`warning: missing asset ${a}`); continue; }
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    if (origin) {
      fs.writeFileSync(path.join(out, 'sitemap.xml'), renderSitemap({ content, origin }));
      fs.writeFileSync(path.join(out, 'robots.txt'), renderRobots({ origin }));
    }
    console.log(`Exported ${pages.length} pages and ${assets.size} asset(s) to dist/${slug}/`);
  },

  async scaffold() {
    const explicit = flags._;
    if (explicit.length) failOnInvalidSlugs(explicit);
    const url = flags.url;
    const note = flags.note;
    if ((url !== undefined || note !== undefined) && explicit.length !== 1) fail('--url and --note need exactly one slug');
    if (url === true || note === true) fail('--url and --note need a value');
    // The default target list (no explicit slugs) is filtered to stubs only
    // — a content file stubFromProspect() could have produced, with no
    // hero/reviews/trust/area-intro filled in — and never includes
    // acme-roofing, the committed sample file. A non-stub is reported and
    // skipped rather than silently ignored, so it's clear why it wasn't
    // touched; naming it explicitly bypasses this filter (the --no-ai
    // refusal below still applies).
    let slugs;
    if (explicit.length) {
      slugs = explicit;
    } else {
      slugs = [];
      for (const s of siteSlugs()) {
        if (s === 'acme-roofing') continue;
        if (!flags.force && fs.existsSync(briefFile(s, '.md'))) continue;
        let existing;
        try {
          existing = JSON.parse(fs.readFileSync(sitePath(s), 'utf8'));
        } catch {
          slugs.push(s); // let the per-slug read below report the real error
          continue;
        }
        if (!isStub(existing)) {
          console.log(`skip ${s} (not a stub — name it explicitly to re-gather)`);
          continue;
        }
        slugs.push(s);
      }
    }
    if (!slugs.length) {
      console.log('Nothing to scaffold — every site already has a brief (use --force to re-gather).');
      return;
    }
    fs.mkdirSync(BRIEFS_DIR, { recursive: true });
    const toCheck = [];
    for (const slug of slugs) {
      let stub;
      try {
        stub = JSON.parse(fs.readFileSync(sitePath(slug), 'utf8'));
      } catch (err) {
        console.error(`${slug}: can't read sites/${slug}.json — ${err.message}`);
        continue;
      }
      // --no-ai overwrites the whole content file with a facts-only draft,
      // so a filled-in file (not a stub) is refused unless --force — this
      // applies whether the slug was named explicitly or picked by default.
      if (flags['no-ai'] && !flags.force && !isStub(stub)) {
        console.log(`${slug}: not a stub — --no-ai would overwrite a filled-in file; add --force to do it anyway`);
        continue;
      }
      if (typeof url === 'string' || typeof note === 'string') {
        stub.outreach = { ...(stub.outreach || {}) };
        if (typeof url === 'string') stub.outreach.currentSite = url;
        if (typeof note === 'string') stub.outreach.note = note;
        writeContentBackedUp(slug, stub);
      }
      let brief;
      try {
        brief = await gather({ slug, stub, fetch: globalThis.fetch });
      } catch (err) {
        console.error(`${slug}: gather failed — ${err.message}`);
        continue;
      }
      fs.writeFileSync(briefFile(slug, '.json'), JSON.stringify(brief, null, 2) + '\n');
      fs.writeFileSync(briefFile(slug, '.md'), renderBriefMd(brief));
      console.log(`${slug}: brief ${brief.status} (${brief.pages.length} page(s)) → ${rel(briefFile(slug, '.md'))}`);
      if (flags['no-ai']) {
        const { content, provenance } = noAiContent(brief);
        writeContentBackedUp(slug, content);
        fs.writeFileSync(briefFile(slug, '.provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
        toCheck.push(slug);
      }
    }
    if (toCheck.length) {
      console.log('');
      checkSlugs(toCheck);
    } else {
      console.log('\nNext: run /scaffold-sites in Claude Code (or re-run with --no-ai for a facts-only draft).');
    }
  },

  'scaffold-check'() {
    if (flags._.length) failOnInvalidSlugs(flags._);
    const slugs = flags._.length
      ? flags._
      : fs.existsSync(BRIEFS_DIR)
        ? fs.readdirSync(BRIEFS_DIR).filter((f) => /^[a-z0-9-]+\.json$/.test(f)).map((f) => f.slice(0, -5))
        : [];
    if (!slugs.length) fail('No briefs yet — run: node scripts/site.mjs scaffold');
    checkSlugs(slugs);
  },
};

if (!Object.hasOwn(commands, cmd ?? '')) {
  fail(`Usage: node scripts/site.mjs <${Object.keys(commands).join('|')}> [slug] [--local]`);
}
await commands[cmd]();
