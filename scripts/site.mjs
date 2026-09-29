#!/usr/bin/env node
// Sitekit CLI. Writes (push/status, and pitch in Task 12) generate SQL into
// scripts/.site-push.sql and print the wrangler command for you to run — same
// --file pattern as new-project.js, because `wrangler d1 execute --command`
// silently drops every statement after the first. Reads (demo-link/pull/views)
// run a single SELECT through wrangler directly since they change nothing.
//
// Usage: node scripts/site.mjs <command> [args] [--local]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../sitekit/validate.mjs';
import { pushSql, statusSql, STATUSES, parseCsv, slugify, stubFromProspect, pitchText } from '../sitekit/admin.mjs';
import { renderPage, listPages, renderSitemap, renderRobots } from '../sitekit/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITES_DIR = path.join(ROOT, 'sites');
const TOKENS_FILE = path.join(SITES_DIR, '.tokens.json');
const SQL_FILE = path.join(ROOT, 'scripts', '.site-push.sql');
const BASE_URL = process.env.SK_BASE_URL || 'https://zohnwheelerportfolio.pages.dev';
const DB = 'portfolio-leads';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
      else { out[a.slice(2)] = next; i++; }
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

function sitePath(slug) {
  if (!SLUG.test(slug || '')) fail(`Invalid or missing slug: ${slug ?? '(none)'}`);
  return path.join(SITES_DIR, `${slug}.json`);
}

function readContent(slug) {
  const p = sitePath(slug);
  if (!fs.existsSync(p)) fail(`No content file at ${path.relative(ROOT, p)}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeContent(slug, content) {
  fs.writeFileSync(sitePath(slug), JSON.stringify(content, null, 2) + '\n');
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
    fs.mkdirSync(SITES_DIR, { recursive: true });
    let created = 0;
    for (const row of parseCsv(fs.readFileSync(file, 'utf8'))) {
      if (!row.name) { console.warn('skipping a row with no name'); continue; }
      const slug = slugify(row.name);
      const p = path.join(SITES_DIR, `${slug}.json`);
      if (fs.existsSync(p)) { console.log(`skip ${slug} (already exists)`); continue; }
      const stub = stubFromProspect(row);
      fs.writeFileSync(p, JSON.stringify(stub, null, 2) + '\n');
      created++;
      const { errors, warnings } = validateContent(stub, { slug, fileExists });
      console.log(`created sites/${slug}.json${errors.length ? ` — needs: ${errors.join('; ')}` : ''}${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
    }
    console.log(`\n${created} new site(s). Fill in the details (write each city intro!), then: node scripts/site.mjs push <slug>`);
  },

  pitch() {
    const slug = flags._[0];
    const content = readContent(slug);
    const token = readTokens()[slug];
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
    if (result.channel !== 'none') writeSql(statusSql({ slug, status: 'pitched', domain: null, now: new Date().toISOString() }));
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
};

if (!Object.hasOwn(commands, cmd ?? '')) {
  fail(`Usage: node scripts/site.mjs <${Object.keys(commands).join('|')}> [slug] [--local]`);
}
commands[cmd]();
