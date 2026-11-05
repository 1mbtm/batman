-- ============================================================================
-- Migration: 0001_visitor_analytics.sql
-- Portfolio Visitor Analytics System (Cloudflare D1 / SQLite)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Visitors Table: Anonymous first-party visitor profiles & attribution
CREATE TABLE IF NOT EXISTS visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  total_visits INTEGER NOT NULL DEFAULT 1,
  total_sessions INTEGER NOT NULL DEFAULT 1,

  -- First-touch attribution (locked on initial acquisition)
  first_touch_ref TEXT,
  first_touch_referrer_domain TEXT,
  first_touch_referrer_url TEXT,
  first_touch_at TEXT NOT NULL,

  -- Last-touch attribution (updated when a new campaign or external referrer occurs)
  last_touch_ref TEXT,
  last_touch_referrer_domain TEXT,
  last_touch_referrer_url TEXT,
  last_touch_at TEXT NOT NULL,

  -- Latest device & browser fingerprint (non-identifying technical telemetry)
  device_type TEXT NOT NULL DEFAULT 'Desktop',
  os TEXT NOT NULL DEFAULT 'Unknown',
  os_version TEXT,
  browser TEXT NOT NULL DEFAULT 'Unknown',
  browser_version TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  language TEXT,
  timezone TEXT,

  -- Location tracking (strictly distinguishes 'gps' vs 'ip' approximate estimate)
  location_source TEXT NOT NULL DEFAULT 'ip' CHECK (location_source IN ('gps', 'ip', 'none')),
  ip_country TEXT,
  ip_region TEXT,
  ip_city TEXT,
  ip_postal_code TEXT,
  ip_latitude REAL,
  ip_longitude REAL,

  -- Explicit opt-in GPS coordinates (NULL unless visitor explicitly granted permission)
  gps_consent_status TEXT NOT NULL DEFAULT 'unset' CHECK (gps_consent_status IN ('unset', 'granted', 'denied', 'withdrawn')),
  gps_consent_at TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy_meters REAL,
  gps_timestamp TEXT,

  -- Ephemeral salted SHA-256 IP hash (raw IP is NEVER stored)
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_first_seen ON visitors(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_location_source ON visitors(location_source);
CREATE INDEX IF NOT EXISTS idx_visitors_first_ref ON visitors(first_touch_ref);
CREATE INDEX IF NOT EXISTS idx_visitors_last_ref ON visitors(last_touch_ref);
CREATE INDEX IF NOT EXISTS idx_visitors_country ON visitors(ip_country);
CREATE INDEX IF NOT EXISTS idx_visitors_device ON visitors(device_type);

-- 2. Sessions Table: Grouped browsing sessions per visitor
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  entry_page TEXT NOT NULL,
  exit_page TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1,
  ref_campaign TEXT,
  referrer_domain TEXT,
  referrer_url TEXT,
  device_type TEXT NOT NULL DEFAULT 'Desktop',
  os TEXT NOT NULL DEFAULT 'Unknown',
  browser TEXT NOT NULL DEFAULT 'Unknown',
  ip_country TEXT,
  ip_region TEXT,
  ip_city TEXT,
  FOREIGN KEY (visitor_id) REFERENCES visitors(visitor_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);

-- 3. Visits Table: Individual pageview & interaction events with deduplication
CREATE TABLE IF NOT EXISTS visits (
  visit_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer_url TEXT,
  referrer_domain TEXT,
  ref_campaign TEXT,
  device_type TEXT NOT NULL DEFAULT 'Desktop',
  os TEXT NOT NULL DEFAULT 'Unknown',
  os_version TEXT,
  browser TEXT NOT NULL DEFAULT 'Unknown',
  browser_version TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  language TEXT,
  timezone TEXT,
  location_source TEXT NOT NULL DEFAULT 'ip' CHECK (location_source IN ('gps', 'ip', 'none')),
  ip_country TEXT,
  ip_region TEXT,
  ip_city TEXT,
  ip_postal_code TEXT,
  ip_latitude REAL,
  ip_longitude REAL,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy_meters REAL,
  gps_timestamp TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (visitor_id) REFERENCES visitors(visitor_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_page_path ON visits(page_path);
CREATE INDEX IF NOT EXISTS idx_visits_ref_campaign ON visits(ref_campaign);
CREATE INDEX IF NOT EXISTS idx_visits_referrer_domain ON visits(referrer_domain);

-- 4. Location Consents Table: Explicit audit trail of GPS consent grants, withdrawals, and deletions
CREATE TABLE IF NOT EXISTS location_consents (
  consent_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('granted', 'denied', 'withdrawn', 'deleted')),
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy_meters REAL,
  gps_timestamp TEXT,
  consent_notice_version TEXT NOT NULL DEFAULT 'v1.0',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_location_consents_visitor ON location_consents(visitor_id, created_at DESC);

-- 5. Referral Campaigns Table: Custom ?ref=campaign_name tracking links created by Admin
CREATE TABLE IF NOT EXISTS referral_campaigns (
  campaign_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'Custom',
  target_path TEXT NOT NULL DEFAULT '/',
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_campaigns_slug ON referral_campaigns(slug);

-- 6. Admin Sessions Table: Server-side verified admin bearer tokens
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- 7. Privacy Deletion Requests Audit Log (stores only anonymised request receipt timestamp)
CREATE TABLE IF NOT EXISTS deletion_requests (
  request_id TEXT PRIMARY KEY,
  visitor_id_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('withdraw_gps', 'delete_all_data')),
  records_purged INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT NOT NULL
);
