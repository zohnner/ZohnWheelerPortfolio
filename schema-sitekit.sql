-- Sitekit: multi-tenant client sites. Same portfolio-leads D1 database.
-- Apply once: npx wrangler d1 execute portfolio-leads --remote --file ./schema-sitekit.sql

-- status: prospect|demo|pitched|viewed|meeting|won|lost|live
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL DEFAULT 'call-now',
  status TEXT NOT NULL DEFAULT 'prospect',
  domain TEXT UNIQUE,
  demo_token TEXT NOT NULL UNIQUE,
  content_json TEXT NOT NULL,
  contact_email TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- device is bucketed from User-Agent; no IP is stored for views.
CREATE TABLE IF NOT EXISTS demo_views (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  path TEXT NOT NULL,
  device TEXT NOT NULL,
  viewed_at TEXT NOT NULL
);

-- ip is kept only for rate limiting, same as inquiries.
CREATE TABLE IF NOT EXISTS site_leads (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_demo_views_site ON demo_views(site_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_site_leads_site ON site_leads(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_site_leads_ip ON site_leads(ip, created_at);
