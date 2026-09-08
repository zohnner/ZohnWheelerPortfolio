#!/usr/bin/env node
// Phase 1 client dashboard has no admin UI yet — this generates the SQL to
// create a client + project + shareable dashboard link and writes it to a
// file (wrangler's --command only reliably runs the first statement of a
// multi-statement string, silently dropping the rest — confirmed live, so
// this always goes through --file instead). Nothing here touches the
// database directly; you run the printed command yourself.
//
// Usage:
//   node scripts/new-project.js --client "Acme Roofing" --email "owner@acme.com" --project "Acme Roofing Website" [--staging "https://staging.example.com"]

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
}

const client = arg('client');
const email = arg('email');
const projectName = arg('project');
const staging = arg('staging');

if (!client || !email || !projectName) {
  console.error('Usage: node scripts/new-project.js --client "Name" --email "email@example.com" --project "Project Name" [--staging "https://..."]');
  process.exit(1);
}

const esc = (s) => s.replace(/'/g, "''");

const clientId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const token = crypto.randomBytes(24).toString('hex');
const now = new Date().toISOString();

const sql = `INSERT INTO clients (id, name, email, created_at) VALUES ('${clientId}', '${esc(client)}', '${esc(email)}', '${now}');
INSERT INTO projects (id, client_id, name, status, staging_url, token, created_at) VALUES ('${projectId}', '${clientId}', '${esc(projectName)}', 'discovery', ${staging ? `'${esc(staging)}'` : 'NULL'}, '${token}', '${now}');
`;

const outPath = path.join(__dirname, '.new-project.sql');
fs.writeFileSync(outPath, sql);

console.log(`Wrote ${path.relative(process.cwd(), outPath)}\n`);
console.log('--- Run this against the remote database, then delete the file ---\n');
console.log(`wrangler d1 execute portfolio-leads --remote --file ${path.relative(process.cwd(), outPath)}\n`);
console.log('--- Dashboard link for the client ---\n');
console.log(`https://zohnwheelerportfolio.pages.dev/dashboard.html?token=${token}\n`);
console.log('--- To post an update later ---\n');
console.log(`wrangler d1 execute portfolio-leads --remote --command "INSERT INTO project_updates (id, project_id, body, created_at) VALUES ('${crypto.randomUUID()}', '${projectId}', 'Your update text here', '${new Date().toISOString()}')"`);
