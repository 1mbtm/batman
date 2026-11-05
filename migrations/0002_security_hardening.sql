-- ============================================================================
-- Migration: 0002_security_hardening.sql
-- Incremental migration for existing D1 databases upgrading from 0001
-- ============================================================================

PRAGMA foreign_keys = ON;

-- Add rate_limits table for login brute-force protection and API rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TEXT NOT NULL,
  locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Add system_metadata table for tracking automated retention cleanup runs
CREATE TABLE IF NOT EXISTS system_metadata (
  meta_key TEXT PRIMARY KEY,
  meta_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id);
CREATE INDEX IF NOT EXISTS idx_location_consents_created ON location_consents(created_at);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_at ON deletion_requests(requested_at);
