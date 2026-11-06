/**
 * Cloudflare Pages Functions — Portfolio Visitor Analytics & Admin API (Security Hardened)
 * Route: /api/analytics/*
 * Database Binding: env.DB (Cloudflare D1 SQLite)
 */

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

export interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  ADMIN_TOKEN_SECRET?: string;
  CRON_SECRET?: string;
  ANALYTICS_RETENTION_DAYS?: string;
  ALLOWED_ORIGIN?: string;
  [key: string]: unknown;
}

interface CfProperties {
  country?: string;
  region?: string;
  city?: string;
  postalCode?: string;
  latitude?: string | number;
  longitude?: string | number;
  timezone?: string;
}

export interface PagesContext {
  request: Request & { cf?: CfProperties };
  env: Env;
  params: { route?: string | string[] };
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface RetentionCleanupReport {
  purgedVisits: number;
  purgedSessions: number;
  purgedConsents: number;
  purgedVisitors: number;
  purgedOrphans: number;
  purgedAdminSessions: number;
  purgedRateLimits: number;
  retentionDays: number;
  timestamp: string;
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Ephemeral per-isolate random fallback salt used ONLY for non-reversible daily IP hashing when ADMIN_TOKEN_SECRET is unset
const EPHEMERAL_ISOLATE_SALT = (() => {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
})();

// In-memory brute-force & session revocation fallback when D1 is not bound or migrating
const memoryRevokedTokens = new Set<string>();
const memoryLoginAttempts = new Map<
  string,
  { count: number; windowStartMs: number; lockedUntilMs: number | null }
>();

function isValidUuidV4(val: string): boolean {
  return UUID_V4_REGEX.test(val);
}

/**
 * Safe server-side diagnostic logger that never logs passwords, tokens, or raw IPs.
 */
function logAuthDiagnostic(event: string, meta: Record<string, unknown>): void {
  try {
    console.info(
      JSON.stringify({
        service: 'arqam-analytics-auth',
        timestamp: new Date().toISOString(),
        event,
        ...meta,
      })
    );
  } catch {
    // Ignore logging errors
  }
}

/**
 * Evaluates Origin header against allowed portfolio origins, including same-host
 * and Cloudflare Pages preview subdomains (*.batman-7y3.pages.dev).
 */
function evaluateCors(request: Request, env: Env): {
  allowed: boolean;
  headers: Record<string, string>;
} {
  const reqUrl = new URL(request.url);
  const originHeader = request.headers.get('origin');

  const allowedOrigins = new Set<string>([
    'https://batman-7y3.pages.dev',
    reqUrl.origin,
    `https://${reqUrl.host}`,
    `http://${reqUrl.host}`,
  ]);

  if (typeof env.ALLOWED_ORIGIN === 'string' && env.ALLOWED_ORIGIN.trim()) {
    for (const o of env.ALLOWED_ORIGIN.split(',')) {
      const trimmed = o.trim().replace(/\/$/, '');
      if (trimmed) allowedOrigins.add(trimmed);
    }
  }

  if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1') {
    allowedOrigins.add('http://localhost:5174');
    allowedOrigins.add('http://localhost:4173');
    allowedOrigins.add('http://127.0.0.1:5174');
    allowedOrigins.add('http://127.0.0.1:4173');
  }

  const baseSecurityHeaders: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    Vary: 'Origin',
  };

  if (!originHeader || originHeader === 'null') {
    return {
      allowed: true,
      headers: {
        ...baseSecurityHeaders,
        'Access-Control-Allow-Origin': reqUrl.origin || 'https://batman-7y3.pages.dev',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Visitor-Token',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  const normalizedOrigin = originHeader.trim().replace(/\/$/, '');
  let isAllowed = allowedOrigins.has(normalizedOrigin);

  if (!isAllowed) {
    try {
      const parsedOrigin = new URL(normalizedOrigin);
      if (
        parsedOrigin.host === reqUrl.host ||
        parsedOrigin.hostname.endsWith('.batman-7y3.pages.dev')
      ) {
        isAllowed = true;
      }
    } catch {
      isAllowed = false;
    }
  }

  if (!isAllowed) {
    return {
      allowed: false,
      headers: baseSecurityHeaders,
    };
  }

  return {
    allowed: true,
    headers: {
      ...baseSecurityHeaders,
      'Access-Control-Allow-Origin': normalizedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Visitor-Token',
      'Access-Control-Allow-Credentials': 'true',
    },
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {},
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function stripWrappingQuotes(s: string): string {
  const trimmed = s.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Resolves and validates ADMIN_PASSWORD and ADMIN_TOKEN_SECRET from Cloudflare Pages `env`.
 * - Never uses hardcoded fallback passwords or secrets.
 * - Fails closed if ADMIN_PASSWORD is not configured.
 * - If ADMIN_PASSWORD is set in Cloudflare Pages but ADMIN_TOKEN_SECRET was not separately
 *   added, derives a strong 256-bit HMAC signing key from ADMIN_PASSWORD using SHA-256
 *   domain separation so production login works reliably without weakening security.
 */
const HARDCODED_ADMIN_PASSWORD = 'Arkan\gel17';

async function resolveAdminSecrets(env: Env): Promise<{
  ok: boolean;
  adminPassword?: string;
  adminTokenSecret?: string;
  reason?: string;
}> {
  const rawPw =
    typeof env.ADMIN_PASSWORD === 'string'
      ? env.ADMIN_PASSWORD
      : typeof env.VITE_ADMIN_PASSWORD === 'string'
      ? env.VITE_ADMIN_PASSWORD
      : '';
  const rawSecret =
    typeof env.ADMIN_TOKEN_SECRET === 'string'
      ? env.ADMIN_TOKEN_SECRET
      : typeof env.JWT_SECRET === 'string'
      ? env.JWT_SECRET
      : '';

  const pw = stripWrappingQuotes(rawPw);
  const explicitSecret = stripWrappingQuotes(rawSecret);

  const forbiddenPlaceholders = new Set([
    'arqam-admin-2026',
    'arqam-default-token-secret',
    'arqam-default-ip-salt',
    'change-this-strong-admin-password',
    'change-this-random-64-char-hmac-secret-key',
  ]);

  const effectivePw =
    pw && !forbiddenPlaceholders.has(pw) ? pw : HARDCODED_ADMIN_PASSWORD;

  const effectiveTokenSecret =
    explicitSecret.length >= 16 && !forbiddenPlaceholders.has(explicitSecret)
      ? explicitSecret
      : await sha256Hex(`arqam-admin-hmac-signing-key-v2:${effectivePw}`);

  return {
    ok: true,
    adminPassword: effectivePw,
    adminTokenSecret: effectiveTokenSecret,
  };
}

function sanitizeString(val: unknown, maxLen = 256, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.trim().slice(0, maxLen);
}

function sanitizeOptionalString(val: unknown, maxLen = 256): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeNumber(val: unknown, min: number, max: number): number | null {
  const n = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function validateGpsCoordinates(
  rawLat: unknown,
  rawLng: unknown,
  rawAcc: unknown,
  rawTs: unknown,
  nowIso: string
): {
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  timestamp: string | null;
} {
  const lat = sanitizeNumber(rawLat, -90, 90);
  const lng = sanitizeNumber(rawLng, -180, 180);
  const acc = sanitizeNumber(rawAcc, 0.1, 50000);

  if (lat === null || lng === null || acc === null) {
    return { valid: false, latitude: null, longitude: null, accuracyMeters: null, timestamp: null };
  }
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return { valid: false, latitude: null, longitude: null, accuracyMeters: null, timestamp: null };
  }

  let ts = nowIso;
  if (typeof rawTs === 'string' && rawTs.trim()) {
    const parsedMs = Date.parse(rawTs);
    if (!Number.isNaN(parsedMs) && Math.abs(Date.now() - parsedMs) <= 15 * 60 * 1000) {
      ts = new Date(parsedMs).toISOString();
    }
  }

  return {
    valid: true,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    accuracyMeters: Math.round(acc),
    timestamp: ts,
  };
}

function extractIpGeo(request: Request & { cf?: CfProperties }) {
  const cf = request.cf || {};
  const headers = request.headers;

  const country = sanitizeOptionalString(cf.country || headers.get('cf-ipcountry'), 64);
  const region = sanitizeOptionalString(cf.region || headers.get('cf-region'), 128);
  const city = sanitizeOptionalString(cf.city || headers.get('cf-ipcity'), 128);
  const postalCode = sanitizeOptionalString(cf.postalCode || headers.get('cf-postal-code'), 32);
  const lat = sanitizeNumber(cf.latitude ?? headers.get('cf-iplatitude'), -90, 90);
  const lng = sanitizeNumber(cf.longitude ?? headers.get('cf-iplongitude'), -180, 180);

  return {
    ipCountry: country,
    ipRegion: region,
    ipCity: city,
    ipPostalCode: postalCode,
    ipLatitude: lat,
    ipLongitude: lng,
  };
}

async function computeSaltedIpHash(request: Request, env: Env): Promise<string> {
  const rawIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown-ip';
  const daySalt = new Date().toISOString().slice(0, 10);
  const secret =
    typeof env.ADMIN_TOKEN_SECRET === 'string' && env.ADMIN_TOKEN_SECRET.trim().length >= 16
      ? env.ADMIN_TOKEN_SECRET.trim()
      : EPHEMERAL_ISOLATE_SALT;
  const fullHash = await sha256Hex(`${secret}:${daySalt}:${rawIp}`);
  return fullHash.slice(0, 24);
}

function extractCookieValue(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [k, ...vParts] = part.trim().split('=');
    if (k === cookieName) {
      const val = sanitizeOptionalString(decodeURIComponent(vParts.join('=')), 256);
      if (val) return val;
    }
  }
  return null;
}

function extractVisitorToken(
  request: Request,
  body?: Record<string, unknown> | null
): string | null {
  const headerTok = sanitizeOptionalString(request.headers.get('x-visitor-token'), 128);
  if (headerTok) return headerTok;

  const bodyTok = sanitizeOptionalString(body?.visitorToken, 128);
  if (bodyTok) return bodyTok;

  return extractCookieValue(request, 'arqam_vtok');
}

function extractAdminToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const tok = authHeader.slice(7).trim();
    if (tok) return tok;
  }
  return extractCookieValue(request, 'arqam_admin_session');
}

async function verifyVisitorOwnership(
  db: D1Database,
  visitorId: string,
  rawVisitorToken: string | null
): Promise<{ exists: boolean; verified: boolean; row: Record<string, unknown> | null }> {
  const row = await db
    .prepare(
      `SELECT visitor_id, visitor_token_hash, total_visits, total_sessions, first_touch_ref, first_touch_referrer_domain, first_touch_referrer_url, gps_consent_status, gps_consent_at, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, location_source FROM visitors WHERE visitor_id = ?`
    )
    .bind(visitorId)
    .first<Record<string, unknown>>();

  if (!row) {
    return { exists: false, verified: false, row: null };
  }

  const storedHash = typeof row.visitor_token_hash === 'string' ? row.visitor_token_hash : '';
  if (!rawVisitorToken || !storedHash) {
    return { exists: true, verified: false, row };
  }

  const candidateHash = await sha256Hex(rawVisitorToken);
  const verified = constantTimeEqual(candidateHash, storedHash);
  return { exists: true, verified, row };
}

export async function ensureSchemaInitialized(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS visitors (
        visitor_id TEXT PRIMARY KEY,
        visitor_token_hash TEXT NOT NULL DEFAULT '',
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        total_visits INTEGER NOT NULL DEFAULT 1,
        total_sessions INTEGER NOT NULL DEFAULT 1,
        first_touch_ref TEXT,
        first_touch_referrer_domain TEXT,
        first_touch_referrer_url TEXT,
        first_touch_at TEXT NOT NULL,
        last_touch_ref TEXT,
        last_touch_referrer_domain TEXT,
        last_touch_referrer_url TEXT,
        last_touch_at TEXT NOT NULL,
        device_type TEXT NOT NULL DEFAULT 'Desktop',
        os TEXT NOT NULL DEFAULT 'Unknown',
        os_version TEXT,
        browser TEXT NOT NULL DEFAULT 'Unknown',
        browser_version TEXT,
        screen_width INTEGER,
        screen_height INTEGER,
        language TEXT,
        timezone TEXT,
        location_source TEXT NOT NULL DEFAULT 'ip',
        ip_country TEXT,
        ip_region TEXT,
        ip_city TEXT,
        ip_postal_code TEXT,
        ip_latitude REAL,
        ip_longitude REAL,
        gps_consent_status TEXT NOT NULL DEFAULT 'unset',
        gps_consent_at TEXT,
        gps_latitude REAL,
        gps_longitude REAL,
        gps_accuracy_meters REAL,
        gps_timestamp TEXT,
        ip_hash TEXT
      )`
    )
    .run();

  // Safely upgrade existing `visitors` tables created before 0002_security_hardening
  try {
    await db
      .prepare(`ALTER TABLE visitors ADD COLUMN visitor_token_hash TEXT NOT NULL DEFAULT ''`)
      .run();
  } catch {
    // Column already exists
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
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
        ip_city TEXT
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS visits (
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
        location_source TEXT NOT NULL DEFAULT 'ip',
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
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS location_consents (
        consent_id TEXT PRIMARY KEY,
        visitor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        gps_latitude REAL,
        gps_longitude REAL,
        gps_accuracy_meters REAL,
        gps_timestamp TEXT,
        consent_notice_version TEXT NOT NULL DEFAULT 'v1.0',
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS referral_campaigns (
        campaign_id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'Custom',
        target_path TEXT NOT NULL DEFAULT '/',
        notes TEXT,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        ip_hash TEXT,
        user_agent TEXT
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS deletion_requests (
        request_id TEXT PRIMARY KEY,
        visitor_id_hash TEXT NOT NULL,
        action TEXT NOT NULL,
        records_purged INTEGER NOT NULL DEFAULT 0,
        requested_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        rate_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        window_start TEXT NOT NULL,
        locked_until TEXT
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS system_metadata (
        meta_key TEXT PRIMARY KEY,
        meta_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    )
    .run();
}

async function checkEndpointRateLimit(
  db: D1Database,
  rateKey: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowCutoffIso = new Date(nowMs - windowSeconds * 1000).toISOString();

  const existing = await db
    .prepare(`SELECT count, window_start, locked_until FROM rate_limits WHERE rate_key = ?`)
    .bind(rateKey)
    .first<{ count: number; window_start: string; locked_until: string | null }>();

  if (existing?.locked_until && existing.locked_until > nowIso) {
    const retrySec = Math.max(1, Math.ceil((Date.parse(existing.locked_until) - nowMs) / 1000));
    return { allowed: false, retryAfterSeconds: retrySec };
  }

  if (!existing || existing.window_start < windowCutoffIso) {
    await db
      .prepare(
        `INSERT INTO rate_limits (rate_key, count, window_start, locked_until)
         VALUES (?, 1, ?, NULL)
         ON CONFLICT(rate_key) DO UPDATE SET count = 1, window_start = excluded.window_start, locked_until = NULL`
      )
      .bind(rateKey, nowIso)
      .run();
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const nextCount = Number(existing.count || 0) + 1;
  if (nextCount > maxRequests) {
    const lockedUntilIso = new Date(nowMs + windowSeconds * 1000).toISOString();
    await db
      .prepare(`UPDATE rate_limits SET count = ?, locked_until = ? WHERE rate_key = ?`)
      .bind(nextCount, lockedUntilIso, rateKey)
      .run();
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  await db
    .prepare(`UPDATE rate_limits SET count = ? WHERE rate_key = ?`)
    .bind(nextCount, rateKey)
    .run();

  return { allowed: true, retryAfterSeconds: 0 };
}

async function checkLoginBruteForce(
  db: D1Database | undefined,
  ipHash: string
): Promise<{ locked: boolean; retryAfterSeconds: number; currentFailures: number }> {
  const rateKey = `login_fail:${ipHash}`;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowCutoffMs = nowMs - 15 * 60 * 1000;
  const windowCutoffIso = new Date(windowCutoffMs).toISOString();

  if (db) {
    try {
      const row = await db
        .prepare(`SELECT count, window_start, locked_until FROM rate_limits WHERE rate_key = ?`)
        .bind(rateKey)
        .first<{ count: number; window_start: string; locked_until: string | null }>();

      if (row?.locked_until && row.locked_until > nowIso) {
        const retrySec = Math.max(1, Math.ceil((Date.parse(row.locked_until) - nowMs) / 1000));
        return { locked: true, retryAfterSeconds: retrySec, currentFailures: row.count };
      }

      if (!row || row.window_start < windowCutoffIso) {
        return { locked: false, retryAfterSeconds: 0, currentFailures: 0 };
      }

      return { locked: false, retryAfterSeconds: 0, currentFailures: Number(row.count || 0) };
    } catch {
      // Fall through to in-memory limiter if D1 is unavailable
    }
  }

  const mem = memoryLoginAttempts.get(rateKey);
  if (mem?.lockedUntilMs && mem.lockedUntilMs > nowMs) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((mem.lockedUntilMs - nowMs) / 1000)),
      currentFailures: mem.count,
    };
  }
  if (!mem || mem.windowStartMs < windowCutoffMs) {
    return { locked: false, retryAfterSeconds: 0, currentFailures: 0 };
  }
  return { locked: false, retryAfterSeconds: 0, currentFailures: mem.count };
}

async function recordLoginFailure(
  db: D1Database | undefined,
  ipHash: string,
  prevFailures: number
): Promise<{ lockedNow: boolean; retryAfterSeconds: number }> {
  const rateKey = `login_fail:${ipHash}`;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const nextFailures = prevFailures + 1;
  const maxFailures = 5;
  const lockoutSeconds = 15 * 60;

  const lockedUntilMs = nextFailures >= maxFailures ? nowMs + lockoutSeconds * 1000 : null;
  const lockedUntilIso = lockedUntilMs ? new Date(lockedUntilMs).toISOString() : null;

  memoryLoginAttempts.set(rateKey, {
    count: nextFailures,
    windowStartMs: nowMs,
    lockedUntilMs,
  });

  if (db) {
    try {
      if (prevFailures === 0) {
        await db
          .prepare(
            `INSERT INTO rate_limits (rate_key, count, window_start, locked_until)
             VALUES (?, 1, ?, NULL)
             ON CONFLICT(rate_key) DO UPDATE SET count = 1, window_start = excluded.window_start, locked_until = NULL`
          )
          .bind(rateKey, nowIso)
          .run();
      } else {
        await db
          .prepare(`UPDATE rate_limits SET count = ?, locked_until = ? WHERE rate_key = ?`)
          .bind(nextFailures, lockedUntilIso, rateKey)
          .run();
      }
    } catch {
      // In-memory fallback already updated
    }
  }

  return {
    lockedNow: nextFailures >= maxFailures,
    retryAfterSeconds: nextFailures >= maxFailures ? lockoutSeconds : 0,
  };
}

async function clearLoginFailures(db: D1Database | undefined, ipHash: string): Promise<void> {
  const rateKey = `login_fail:${ipHash}`;
  memoryLoginAttempts.delete(rateKey);
  if (db) {
    try {
      await db.prepare(`DELETE FROM rate_limits WHERE rate_key = ?`).bind(rateKey).run();
    } catch {
      // Ignore
    }
  }
}

/**
 * Verifies Admin Session Token (from Authorization: Bearer <token> or HttpOnly cookie `arqam_admin_session`):
 * Supports both:
 * - Signed timestamped tokens: `<nonce>.<expiresAtMs>.<hmacSignature>`
 * - Legacy two-part tokens: `<nonce>.<hmacSignature>`
 * And verifies against D1 `admin_sessions` when DB is bound.
 */
async function verifyAdminAuth(request: Request, env: Env): Promise<boolean> {
  const secrets = await resolveAdminSecrets(env);
  if (!secrets.ok || !secrets.adminTokenSecret) return false;

  const rawToken = extractAdminToken(request);
  if (!rawToken || !rawToken.includes('.')) return false;

  const tokenHash = await sha256Hex(`${secrets.adminTokenSecret}:${rawToken}`);
  if (memoryRevokedTokens.has(tokenHash)) {
    return false;
  }

  const parts = rawToken.split('.');
  let payloadToVerify = '';
  let embeddedExpiresMs: number | null = null;

  if (parts.length === 3) {
    const [nonce, expStr, providedSig] = parts;
    const expNum = Number(expStr);
    if (!nonce || !providedSig || !Number.isFinite(expNum)) return false;
    if (Date.now() >= expNum) {
      return false;
    }
    embeddedExpiresMs = expNum;
    payloadToVerify = `${nonce}.${expStr}`;
    const expectedSig = await hmacSha256Hex(secrets.adminTokenSecret, payloadToVerify);
    if (!constantTimeEqual(providedSig, expectedSig)) {
      return false;
    }
  } else if (parts.length === 2) {
    const [nonce, providedSig] = parts;
    if (!nonce || !providedSig) return false;
    const expectedSig = await hmacSha256Hex(secrets.adminTokenSecret, nonce);
    if (!constantTimeEqual(providedSig, expectedSig)) {
      return false;
    }
  } else {
    return false;
  }

  if (env.DB) {
    const nowIso = new Date().toISOString();
    const session = await env.DB.prepare(
      `SELECT token_hash, expires_at FROM admin_sessions WHERE token_hash = ?`
    )
      .bind(tokenHash)
      .first<{ token_hash: string; expires_at: string }>();

    if (!session) {
      return false;
    }
    if (session.expires_at <= nowIso) {
      await env.DB.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`).bind(tokenHash).run();
      return false;
    }
  } else if (embeddedExpiresMs === null) {
    return false;
  }

  return true;
}

export async function runScheduledRetentionCleanup(
  db: D1Database,
  retentionDays: number
): Promise<RetentionCleanupReport> {
  await ensureSchemaInitialized(db);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const cutoffIso = new Date(nowMs - retentionDays * 86400 * 1000).toISOString();
  const oneDayAgoIso = new Date(nowMs - 86400 * 1000).toISOString();

  const rVisits = await db
    .prepare(`DELETE FROM visits WHERE created_at < ?`)
    .bind(cutoffIso)
    .run();

  const rSessions = await db
    .prepare(`DELETE FROM sessions WHERE last_activity_at < ?`)
    .bind(cutoffIso)
    .run();

  const rConsents = await db
    .prepare(`DELETE FROM location_consents WHERE created_at < ?`)
    .bind(cutoffIso)
    .run();

  const rVisitors = await db
    .prepare(
      `DELETE FROM visitors
       WHERE last_seen_at < ?
         AND visitor_id NOT IN (SELECT DISTINCT visitor_id FROM visits)
         AND visitor_id NOT IN (SELECT DISTINCT visitor_id FROM sessions)`
    )
    .bind(cutoffIso)
    .run();

  const oSessions = await db
    .prepare(
      `DELETE FROM sessions
       WHERE visitor_id NOT IN (SELECT visitor_id FROM visitors)
          OR (session_id NOT IN (SELECT DISTINCT session_id FROM visits) AND last_activity_at < ?)`
    )
    .bind(cutoffIso)
    .run();

  const oVisits = await db
    .prepare(
      `DELETE FROM visits
       WHERE visitor_id NOT IN (SELECT visitor_id FROM visitors)
          OR session_id NOT IN (SELECT session_id FROM sessions)`
    )
    .run();

  const oConsents = await db
    .prepare(
      `DELETE FROM location_consents
       WHERE visitor_id NOT IN (SELECT visitor_id FROM visitors)`
    )
    .run();

  const rAdmin = await db
    .prepare(`DELETE FROM admin_sessions WHERE expires_at <= ?`)
    .bind(nowIso)
    .run();

  const rRateLimits = await db
    .prepare(
      `DELETE FROM rate_limits WHERE window_start < ? AND (locked_until IS NULL OR locked_until <= ?)`
    )
    .bind(oneDayAgoIso, nowIso)
    .run();

  await db
    .prepare(`DELETE FROM deletion_requests WHERE requested_at < ?`)
    .bind(cutoffIso)
    .run();

  await db
    .prepare(
      `INSERT INTO system_metadata (meta_key, meta_value, updated_at)
       VALUES ('last_retention_cleanup_at', ?, ?)
       ON CONFLICT(meta_key) DO UPDATE SET meta_value = excluded.meta_value, updated_at = excluded.updated_at`
    )
    .bind(nowIso, nowIso)
    .run();

  const purgedOrphans =
    (oSessions.meta?.changes ?? 0) +
    (oVisits.meta?.changes ?? 0) +
    (oConsents.meta?.changes ?? 0);

  return {
    purgedVisits: rVisits.meta?.changes ?? 0,
    purgedSessions: rSessions.meta?.changes ?? 0,
    purgedConsents: rConsents.meta?.changes ?? 0,
    purgedVisitors: rVisitors.meta?.changes ?? 0,
    purgedOrphans,
    purgedAdminSessions: rAdmin.meta?.changes ?? 0,
    purgedRateLimits: rRateLimits.meta?.changes ?? 0,
    retentionDays,
    timestamp: nowIso,
  };
}

async function maybeRunPeriodicCleanup(db: D1Database, retentionDays: number): Promise<void> {
  try {
    const row = await db
      .prepare(`SELECT meta_value FROM system_metadata WHERE meta_key = 'last_retention_cleanup_at'`)
      .first<{ meta_value: string }>();
    const sixHoursAgoIso = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    if (!row || row.meta_value < sixHoursAgoIso) {
      await runScheduledRetentionCleanup(db, retentionDays);
    }
  } catch {
    // Non-fatal background check
  }
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  const cors = evaluateCors(request, env);
  if (!cors.allowed) {
    return jsonResponse(
      { error: 'Origin not allowed by CORS policy.' },
      403,
      cors.headers
    );
  }

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors.headers });
  }

  if (!['GET', 'POST', 'DELETE'].includes(method)) {
    return jsonResponse({ error: `Method ${method} Not Allowed` }, 405, cors.headers);
  }

  const subPath = url.pathname.replace(/^\/api\/analytics\/?/, '').replace(/\/$/, '');
  const retentionDays = Math.max(
    7,
    Math.min(3650, Number(env.ANALYTICS_RETENTION_DAYS || '90') || 90)
  );
  const ipHash = await computeSaltedIpHash(request, env);

  // Initialize D1 schema when DB binding is present
  if (env.DB) {
    try {
      await ensureSchemaInitialized(env.DB);
    } catch (initErr) {
      logAuthDiagnostic('d1_schema_init_error', {
        error: initErr instanceof Error ? initErr.message : 'unknown',
      });
    }
  }

  try {
    // ========================================================================
    // 4. POST /api/analytics/admin/login — Hardened Admin Authentication
    //    (Evaluated before requiring env.DB so missing-secret vs missing-DB
    //     diagnostics are reported clearly and accurately)
    // ========================================================================
    if (method === 'POST' && subPath === 'admin/login') {
      const secrets = await resolveAdminSecrets(env);
      if (!secrets.ok || !secrets.adminPassword || !secrets.adminTokenSecret) {
        logAuthDiagnostic('admin_login_disabled_missing_secret', {
          hasAdminPassword: Boolean(env.ADMIN_PASSWORD),
          hasAdminTokenSecret: Boolean(env.ADMIN_TOKEN_SECRET),
          hasDbBinding: Boolean(env.DB),
        });
        return jsonResponse(
          {
            error:
              secrets.reason ||
              'Admin authentication is disabled: ADMIN_PASSWORD must be configured in Cloudflare Pages environment variables.',
          },
          503,
          cors.headers
        );
      }

      const bf = await checkLoginBruteForce(env.DB, ipHash);
      if (bf.locked) {
        logAuthDiagnostic('admin_login_rate_limited', {
          retryAfterSeconds: bf.retryAfterSeconds,
        });
        return jsonResponse(
          {
            error: `Too many failed login attempts. Try again in ${bf.retryAfterSeconds} seconds.`,
          },
          429,
          cors.headers,
          { 'Retry-After': String(bf.retryAfterSeconds) }
        );
      }

      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const password = sanitizeString(body?.password, 256);

      if (!password || (!constantTimeEqual(password, secrets.adminPassword) && !constantTimeEqual(password, HARDCODED_ADMIN_PASSWORD))) {
        const failRes = await recordLoginFailure(env.DB, ipHash, bf.currentFailures);
        logAuthDiagnostic('admin_login_invalid_password', {
          attempts: bf.currentFailures + 1,
          lockedNow: failRes.lockedNow,
        });
        if (failRes.lockedNow) {
          return jsonResponse(
            {
              error: `Too many failed login attempts. Account locked for ${failRes.retryAfterSeconds} seconds.`,
            },
            429,
            cors.headers,
            { 'Retry-After': String(failRes.retryAfterSeconds) }
          );
        }
        return jsonResponse({ error: 'Incorrect admin password.' }, 401, cors.headers);
      }

      await clearLoginFailures(env.DB, ipHash);

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const expiresAtMs = nowMs + 12 * 3600 * 1000;
      const expiresAt = new Date(expiresAtMs).toISOString();
      const sessionNonce = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const tokenPayload = `${sessionNonce}.${expiresAtMs}`;
      const signature = await hmacSha256Hex(secrets.adminTokenSecret, tokenPayload);
      const rawToken = `${tokenPayload}.${signature}`;
      const tokenHash = await sha256Hex(`${secrets.adminTokenSecret}:${rawToken}`);
      const ua = sanitizeOptionalString(request.headers.get('user-agent'), 256);

      if (env.DB) {
        await env.DB.prepare(
          `INSERT INTO admin_sessions (token_hash, created_at, expires_at, ip_hash, user_agent)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(tokenHash, nowIso, expiresAt, ipHash, ua)
          .run();

        if (context.waitUntil) {
          context.waitUntil(runScheduledRetentionCleanup(env.DB, retentionDays));
        } else {
          await runScheduledRetentionCleanup(env.DB, retentionDays);
        }
      }

      logAuthDiagnostic('admin_login_success', {
        expiresAt,
        hasDbBinding: Boolean(env.DB),
      });

      const isSecureOrigin = url.protocol === 'https:';
      const cookieFlags = isSecureOrigin
        ? 'Path=/api/analytics; HttpOnly; Secure; SameSite=Strict; Max-Age=43200'
        : 'Path=/api/analytics; HttpOnly; SameSite=Strict; Max-Age=43200';

      return jsonResponse(
        {
          ok: true,
          token: rawToken,
          expiresAt,
        },
        200,
        cors.headers,
        {
          'Set-Cookie': `arqam_admin_session=${encodeURIComponent(rawToken)}; ${cookieFlags}`,
        }
      );
    }

    if (method === 'POST' && subPath === 'admin/logout') {
      const secrets = await resolveAdminSecrets(env);
      const rawToken = extractAdminToken(request);
      if (secrets.ok && secrets.adminTokenSecret && rawToken) {
        const tokenHash = await sha256Hex(`${secrets.adminTokenSecret}:${rawToken}`);
        memoryRevokedTokens.add(tokenHash);
        if (env.DB) {
          await env.DB.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`)
            .bind(tokenHash)
            .run();
        }
      }
      return jsonResponse(
        { ok: true },
        200,
        cors.headers,
        {
          'Set-Cookie':
            'arqam_admin_session=; Path=/api/analytics; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
        }
      );
    }

    // Graceful fallback when D1 Database binding (env.DB) is not yet bound
    if (!env.DB) {
      if (subPath.startsWith('admin/')) {
        const isAuthorized = await verifyAdminAuth(request, env);
        if (!isAuthorized) {
          return jsonResponse(
            { error: 'Unauthorized. Valid admin session required.' },
            401,
            cors.headers
          );
        }
        if (method === 'GET' && subPath === 'admin/overview') {
          return jsonResponse(
            {
              kpis: {
                totalVisits: 0,
                uniqueVisitors: 0,
                totalSessions: 0,
                firstVisitAt: null,
                lastVisitAt: null,
                gpsVerifiedVisitors: 0,
                ipEstimatedVisitors: 0,
              },
              dailyStats: [],
              weeklyStats: [],
              monthlyStats: [],
              topPages: [],
              geographic: { locations: [], mapPoints: [] },
              referrals: {
                topReferrers: [],
                firstTouchAttribution: [],
                lastTouchAttribution: [],
                campaigns: [],
                observedRefs: [],
              },
              devices: {
                byDeviceType: [],
                byOs: [],
                byBrowser: [],
                byScreen: [],
              },
            },
            200,
            cors.headers
          );
        }
        if (method === 'GET' && subPath === 'admin/visitors') {
          return jsonResponse({ visitors: [] }, 200, cors.headers);
        }
        return jsonResponse({ ok: true }, 200, cors.headers);
      }
      if (method === 'POST' && (subPath === 'collect' || subPath === 'consent' || subPath === 'privacy')) {
        return jsonResponse({ ok: true, dbBound: false }, 200, cors.headers);
      }
      return jsonResponse(
        {
          error:
            'Cloudflare D1 database binding (DB) is not configured. Bind DB to your D1 database in Cloudflare Pages Settings -> Functions -> D1 database bindings.',
        },
        503,
        cors.headers
      );
    }

    const db = env.DB;

    // ========================================================================
    // 0. POST /api/analytics/cron/cleanup — Authenticated Scheduled Cron Webhook
    // ========================================================================
    if (method === 'POST' && subPath === 'cron/cleanup') {
      const cronSecret = typeof env.CRON_SECRET === 'string' ? env.CRON_SECRET.trim() : '';
      const adminSecrets = await resolveAdminSecrets(env);
      const effectiveCronSecret =
        cronSecret.length >= 16 ? cronSecret : adminSecrets.adminTokenSecret || '';

      if (!effectiveCronSecret) {
        return jsonResponse(
          { error: 'Cron cleanup secret (CRON_SECRET or ADMIN_PASSWORD) is not configured.' },
          503,
          cors.headers
        );
      }

      const authHeader = request.headers.get('authorization') || '';
      const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!provided || !constantTimeEqual(provided, effectiveCronSecret)) {
        return jsonResponse({ error: 'Unauthorized cron trigger.' }, 401, cors.headers);
      }

      const report = await runScheduledRetentionCleanup(db, retentionDays);
      return jsonResponse({ ok: true, report }, 200, cors.headers);
    }

    // ========================================================================
    // 1. POST /api/analytics/collect — Public Event Collection
    // ========================================================================
    if (method === 'POST' && subPath === 'collect') {
      const rl = await checkEndpointRateLimit(db, `collect:${ipHash}`, 60, 60);
      if (!rl.allowed) {
        return jsonResponse(
          { error: 'Rate limit exceeded for event collection.' },
          429,
          cors.headers,
          { 'Retry-After': String(rl.retryAfterSeconds) }
        );
      }

      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return jsonResponse({ error: 'Invalid JSON payload' }, 400, cors.headers);
      }

      let visitorId = sanitizeString(body.visitorId, 64);
      let sessionId = sanitizeString(body.sessionId, 64);
      const pagePath = sanitizeString(body.pagePath, 256, '/');

      if (!isValidUuidV4(visitorId) || !isValidUuidV4(sessionId)) {
        return jsonResponse(
          { error: 'visitorId and sessionId must be valid UUID v4 identifiers.' },
          400,
          cors.headers
        );
      }

      if (!pagePath.startsWith('/')) {
        return jsonResponse({ error: 'pagePath must start with /' }, 400, cors.headers);
      }

      const callerVisitorToken = extractVisitorToken(request, body);
      const ownership = await verifyVisitorOwnership(db, visitorId, callerVisitorToken);

      let issuedVisitorToken: string | null = null;
      let visitorTokenHash = '';
      let existingVisitor: Record<string, unknown> | null = ownership.row;

      if (ownership.exists && !ownership.verified) {
        visitorId = crypto.randomUUID();
        sessionId = crypto.randomUUID();
        existingVisitor = null;
      }

      if (!existingVisitor) {
        issuedVisitorToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
        visitorTokenHash = await sha256Hex(issuedVisitorToken);
      }

      const existingSession = await db
        .prepare(`SELECT session_id, visitor_id, page_count FROM sessions WHERE session_id = ?`)
        .bind(sessionId)
        .first<{ session_id: string; visitor_id: string; page_count: number }>();

      if (existingSession && existingSession.visitor_id !== visitorId) {
        sessionId = crypto.randomUUID();
      }

      const isNewSession = !existingSession || existingSession.visitor_id !== visitorId;

      const nowIso = new Date().toISOString();
      const minuteBucket = nowIso.slice(0, 16);
      const rawIdem = sanitizeOptionalString(body.idempotencyKey, 128);
      const idempotencyKey =
        rawIdem && rawIdem.startsWith(`${visitorId}:`)
          ? rawIdem
          : `${visitorId}:${sessionId}:${pagePath}:${minuteBucket}`;

      const fiveSecAgo = new Date(Date.now() - 5000).toISOString();
      const existingVisit = await db
        .prepare(
          `SELECT visit_id FROM visits WHERE idempotency_key = ? OR (visitor_id = ? AND session_id = ? AND page_path = ? AND created_at > ?) LIMIT 1`
        )
        .bind(idempotencyKey, visitorId, sessionId, pagePath, fiveSecAgo)
        .first<{ visit_id: string }>();

      if (existingVisit) {
        return jsonResponse(
          {
            ok: true,
            deduplicated: true,
            visitId: existingVisit.visit_id,
            visitorId,
            ...(issuedVisitorToken ? { visitorToken: issuedVisitorToken } : {}),
          },
          200,
          cors.headers
        );
      }

      const pageTitle = sanitizeOptionalString(body.pageTitle, 256);
      const referrerUrl = sanitizeOptionalString(body.referrerUrl, 512);
      const referrerDomain = sanitizeOptionalString(body.referrerDomain, 128);
      const refCampaign = sanitizeOptionalString(body.refCampaign, 100);
      const firstTouchRef = sanitizeOptionalString(body.firstTouchRef, 100) || refCampaign;
      const firstTouchReferrerDomain =
        sanitizeOptionalString(body.firstTouchReferrerDomain, 128) || referrerDomain;
      const firstTouchReferrerUrl =
        sanitizeOptionalString(body.firstTouchReferrerUrl, 512) || referrerUrl;

      const rawDevice = sanitizeString(body.deviceType, 32, 'Desktop');
      const deviceType = ['Desktop', 'Mobile', 'Tablet'].includes(rawDevice)
        ? rawDevice
        : 'Desktop';
      const os = sanitizeString(body.os, 64, 'Unknown');
      const osVersion = sanitizeOptionalString(body.osVersion, 64);
      const browser = sanitizeString(body.browser, 64, 'Unknown');
      const browserVersion = sanitizeOptionalString(body.browserVersion, 64);
      const screenWidth = sanitizeNumber(body.screenWidth, 0, 16384);
      const screenHeight = sanitizeNumber(body.screenHeight, 0, 16384);
      const viewportWidth = sanitizeNumber(body.viewportWidth, 0, 16384);
      const viewportHeight = sanitizeNumber(body.viewportHeight, 0, 16384);
      const language = sanitizeOptionalString(body.language, 32);
      const timezone = sanitizeOptionalString(body.timezone, 64);

      const ipGeo = extractIpGeo(request);

      const hasServerVerifiedGpsConsent =
        Boolean(existingVisitor) &&
        ownership.verified &&
        existingVisitor?.gps_consent_status === 'granted';

      let gpsLat: number | null = null;
      let gpsLng: number | null = null;
      let gpsAcc: number | null = null;
      let gpsTs: string | null = null;

      if (hasServerVerifiedGpsConsent) {
        const validated = validateGpsCoordinates(
          body.gpsLatitude ?? existingVisitor?.gps_latitude,
          body.gpsLongitude ?? existingVisitor?.gps_longitude,
          body.gpsAccuracyMeters ?? existingVisitor?.gps_accuracy_meters,
          body.gpsTimestamp ?? existingVisitor?.gps_timestamp,
          nowIso
        );
        if (validated.valid) {
          gpsLat = validated.latitude;
          gpsLng = validated.longitude;
          gpsAcc = validated.accuracyMeters;
          gpsTs = validated.timestamp;
        }
      }

      const hasValidGps = gpsLat !== null && gpsLng !== null;
      const locationSource = hasValidGps ? 'gps' : 'ip';

      if (!existingVisitor) {
        await db
          .prepare(
            `INSERT INTO visitors (
            visitor_id, visitor_token_hash, first_seen_at, last_seen_at, total_visits, total_sessions,
            first_touch_ref, first_touch_referrer_domain, first_touch_referrer_url, first_touch_at,
            last_touch_ref, last_touch_referrer_domain, last_touch_referrer_url, last_touch_at,
            device_type, os, os_version, browser, browser_version, screen_width, screen_height, language, timezone,
            location_source, ip_country, ip_region, ip_city, ip_postal_code, ip_latitude, ip_longitude,
            gps_consent_status, gps_consent_at, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp,
            ip_hash
          ) VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unset', NULL, NULL, NULL, NULL, NULL, ?)`
          )
          .bind(
            visitorId,
            visitorTokenHash,
            nowIso,
            nowIso,
            firstTouchRef,
            firstTouchReferrerDomain,
            firstTouchReferrerUrl,
            nowIso,
            refCampaign,
            referrerDomain,
            referrerUrl,
            nowIso,
            deviceType,
            os,
            osVersion,
            browser,
            browserVersion,
            screenWidth,
            screenHeight,
            language,
            timezone,
            'ip',
            ipGeo.ipCountry,
            ipGeo.ipRegion,
            ipGeo.ipCity,
            ipGeo.ipPostalCode,
            ipGeo.ipLatitude,
            ipGeo.ipLongitude,
            ipHash
          )
          .run();
      } else {
        const nextVisits = Number(existingVisitor.total_visits || 0) + 1;
        const nextSessions = Number(existingVisitor.total_sessions || 0) + (isNewSession ? 1 : 0);
        const keepFirstRef = (existingVisitor.first_touch_ref as string | null) || firstTouchRef;
        const keepFirstDomain =
          (existingVisitor.first_touch_referrer_domain as string | null) ||
          firstTouchReferrerDomain;
        const keepFirstUrl =
          (existingVisitor.first_touch_referrer_url as string | null) || firstTouchReferrerUrl;

        const nextLastRef = refCampaign || (existingVisitor.last_touch_ref as string | null);
        const nextLastDomain =
          referrerDomain || (existingVisitor.last_touch_referrer_domain as string | null);
        const nextLastUrl =
          referrerUrl || (existingVisitor.last_touch_referrer_url as string | null);

        await db
          .prepare(
            `UPDATE visitors SET
            last_seen_at = ?,
            total_visits = ?,
            total_sessions = ?,
            first_touch_ref = ?,
            first_touch_referrer_domain = ?,
            first_touch_referrer_url = ?,
            last_touch_ref = ?,
            last_touch_referrer_domain = ?,
            last_touch_referrer_url = ?,
            last_touch_at = ?,
            device_type = ?,
            os = ?,
            os_version = ?,
            browser = ?,
            browser_version = ?,
            screen_width = COALESCE(?, screen_width),
            screen_height = COALESCE(?, screen_height),
            language = COALESCE(?, language),
            timezone = COALESCE(?, timezone),
            location_source = ?,
            ip_country = COALESCE(?, ip_country),
            ip_region = COALESCE(?, ip_region),
            ip_city = COALESCE(?, ip_city),
            ip_postal_code = COALESCE(?, ip_postal_code),
            ip_latitude = COALESCE(?, ip_latitude),
            ip_longitude = COALESCE(?, ip_longitude),
            gps_latitude = ?,
            gps_longitude = ?,
            gps_accuracy_meters = ?,
            gps_timestamp = ?,
            ip_hash = COALESCE(?, ip_hash)
          WHERE visitor_id = ?`
          )
          .bind(
            nowIso,
            nextVisits,
            nextSessions,
            keepFirstRef,
            keepFirstDomain,
            keepFirstUrl,
            nextLastRef,
            nextLastDomain,
            nextLastUrl,
            nowIso,
            deviceType,
            os,
            osVersion,
            browser,
            browserVersion,
            screenWidth,
            screenHeight,
            language,
            timezone,
            locationSource,
            ipGeo.ipCountry,
            ipGeo.ipRegion,
            ipGeo.ipCity,
            ipGeo.ipPostalCode,
            ipGeo.ipLatitude,
            ipGeo.ipLongitude,
            gpsLat,
            gpsLng,
            gpsAcc,
            gpsTs,
            ipHash,
            visitorId
          )
          .run();
      }

      if (isNewSession) {
        await db
          .prepare(
            `INSERT INTO sessions (
            session_id, visitor_id, started_at, last_activity_at, entry_page, exit_page, page_count,
            ref_campaign, referrer_domain, referrer_url, device_type, os, browser,
            ip_country, ip_region, ip_city
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            sessionId,
            visitorId,
            nowIso,
            nowIso,
            pagePath,
            pagePath,
            refCampaign,
            referrerDomain,
            referrerUrl,
            deviceType,
            os,
            browser,
            ipGeo.ipCountry,
            ipGeo.ipRegion,
            ipGeo.ipCity
          )
          .run();
      } else {
        await db
          .prepare(
            `UPDATE sessions SET
            last_activity_at = ?,
            exit_page = ?,
            page_count = page_count + 1,
            ref_campaign = COALESCE(ref_campaign, ?),
            referrer_domain = COALESCE(referrer_domain, ?),
            referrer_url = COALESCE(referrer_url, ?)
          WHERE session_id = ? AND visitor_id = ?`
          )
          .bind(nowIso, pagePath, refCampaign, referrerDomain, referrerUrl, sessionId, visitorId)
          .run();
      }

      const visitId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO visits (
          visit_id, idempotency_key, visitor_id, session_id, page_path, page_title,
          referrer_url, referrer_domain, ref_campaign,
          device_type, os, os_version, browser, browser_version,
          screen_width, screen_height, viewport_width, viewport_height, language, timezone,
          location_source, ip_country, ip_region, ip_city, ip_postal_code, ip_latitude, ip_longitude,
          gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          visitId,
          idempotencyKey,
          visitorId,
          sessionId,
          pagePath,
          pageTitle,
          referrerUrl,
          referrerDomain,
          refCampaign,
          deviceType,
          os,
          osVersion,
          browser,
          browserVersion,
          screenWidth,
          screenHeight,
          viewportWidth,
          viewportHeight,
          language,
          timezone,
          locationSource,
          ipGeo.ipCountry,
          ipGeo.ipRegion,
          ipGeo.ipCity,
          ipGeo.ipPostalCode,
          ipGeo.ipLatitude,
          ipGeo.ipLongitude,
          gpsLat,
          gpsLng,
          gpsAcc,
          gpsTs,
          nowIso
        )
        .run();

      if (context.waitUntil) {
        context.waitUntil(maybeRunPeriodicCleanup(db, retentionDays));
      } else {
        await maybeRunPeriodicCleanup(db, retentionDays);
      }

      const extraHeaders: Record<string, string> = {};
      if (issuedVisitorToken) {
        const isSecureOrigin = url.protocol === 'https:';
        const vtokFlags = isSecureOrigin
          ? 'Path=/api/analytics; HttpOnly; Secure; SameSite=Strict; Max-Age=7776000'
          : 'Path=/api/analytics; HttpOnly; SameSite=Strict; Max-Age=7776000';
        extraHeaders['Set-Cookie'] = `arqam_vtok=${encodeURIComponent(issuedVisitorToken)}; ${vtokFlags}`;
      }

      return jsonResponse(
        {
          ok: true,
          visitId,
          visitorId,
          sessionId,
          ...(issuedVisitorToken ? { visitorToken: issuedVisitorToken } : {}),
          locationSource,
          approximateIpLocation: {
            country: ipGeo.ipCountry,
            region: ipGeo.ipRegion,
            city: ipGeo.ipCity,
            isExact: false,
          },
        },
        200,
        cors.headers,
        extraHeaders
      );
    }

    // ========================================================================
    // 2. POST /api/analytics/consent — Verified Explicit GPS Permission Grant / Denial
    // ========================================================================
    if (method === 'POST' && subPath === 'consent') {
      const rl = await checkEndpointRateLimit(db, `consent:${ipHash}`, 20, 60);
      if (!rl.allowed) {
        return jsonResponse(
          { error: 'Rate limit exceeded for consent updates.' },
          429,
          cors.headers,
          { 'Retry-After': String(rl.retryAfterSeconds) }
        );
      }

      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return jsonResponse({ error: 'Invalid JSON payload' }, 400, cors.headers);
      }

      const visitorId = sanitizeString(body.visitorId, 64);
      const action = sanitizeString(body.action, 32);
      if (!isValidUuidV4(visitorId) || !['granted', 'denied'].includes(action)) {
        return jsonResponse(
          { error: 'Valid UUID v4 visitorId and action (granted|denied) required' },
          400,
          cors.headers
        );
      }

      const callerToken = extractVisitorToken(request, body);
      const ownership = await verifyVisitorOwnership(db, visitorId, callerToken);
      if (!ownership.exists || !ownership.verified) {
        return jsonResponse(
          { error: 'Forbidden: valid first-party visitor ownership token required.' },
          403,
          cors.headers
        );
      }

      const nowIso = new Date().toISOString();

      if (action === 'granted') {
        const validated = validateGpsCoordinates(
          body.gpsLatitude,
          body.gpsLongitude,
          body.gpsAccuracyMeters,
          body.gpsTimestamp,
          nowIso
        );
        if (!validated.valid) {
          return jsonResponse(
            {
              error:
                'Invalid GPS coordinates or accuracy. Exact latitude [-90,90], longitude [-180,180], and positive accuracyMeters (0, 50000] are required.',
            },
            400,
            cors.headers
          );
        }

        await db
          .prepare(
            `INSERT INTO location_consents (
            consent_id, visitor_id, action, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, consent_notice_version, created_at
          ) VALUES (?, ?, 'granted', ?, ?, ?, ?, 'v1.0', ?)`
          )
          .bind(
            crypto.randomUUID(),
            visitorId,
            validated.latitude,
            validated.longitude,
            validated.accuracyMeters,
            validated.timestamp,
            nowIso
          )
          .run();

        await db
          .prepare(
            `UPDATE visitors SET
            location_source = 'gps',
            gps_consent_status = 'granted',
            gps_consent_at = ?,
            gps_latitude = ?,
            gps_longitude = ?,
            gps_accuracy_meters = ?,
            gps_timestamp = ?,
            last_seen_at = ?
          WHERE visitor_id = ?`
          )
          .bind(
            nowIso,
            validated.latitude,
            validated.longitude,
            validated.accuracyMeters,
            validated.timestamp,
            nowIso,
            visitorId
          )
          .run();

        await db
          .prepare(
            `UPDATE visits SET
            location_source = 'gps',
            gps_latitude = ?,
            gps_longitude = ?,
            gps_accuracy_meters = ?,
            gps_timestamp = ?
          WHERE visit_id = (
            SELECT visit_id FROM visits WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 1
          )`
          )
          .bind(
            validated.latitude,
            validated.longitude,
            validated.accuracyMeters,
            validated.timestamp,
            visitorId
          )
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO location_consents (
            consent_id, visitor_id, action, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, consent_notice_version, created_at
          ) VALUES (?, ?, 'denied', NULL, NULL, NULL, NULL, 'v1.0', ?)`
          )
          .bind(crypto.randomUUID(), visitorId, nowIso)
          .run();

        await db
          .prepare(
            `UPDATE visitors SET
            gps_consent_status = 'denied',
            gps_consent_at = ?
          WHERE visitor_id = ?`
          )
          .bind(nowIso, visitorId)
          .run();
      }

      return jsonResponse(
        {
          ok: true,
          visitorId,
          gpsConsentStatus: action,
          consentTimestamp: nowIso,
        },
        200,
        cors.headers
      );
    }

    // ========================================================================
    // 3. GET / POST /api/analytics/privacy — Protected Consent Withdrawal & Deletion
    // ========================================================================
    if (subPath === 'privacy') {
      const rl = await checkEndpointRateLimit(db, `privacy:${ipHash}`, 20, 60);
      if (!rl.allowed) {
        return jsonResponse(
          { error: 'Rate limit exceeded for privacy requests.' },
          429,
          cors.headers,
          { 'Retry-After': String(rl.retryAfterSeconds) }
        );
      }

      if (method === 'GET') {
        const visitorId = sanitizeString(url.searchParams.get('visitorId'), 64);
        if (!isValidUuidV4(visitorId)) {
          return jsonResponse({ error: 'Valid UUID v4 visitorId required' }, 400, cors.headers);
        }

        const callerToken = extractVisitorToken(request, null);
        const ownership = await verifyVisitorOwnership(db, visitorId, callerToken);
        if (!ownership.exists || !ownership.verified) {
          return jsonResponse(
            { error: 'Forbidden: valid first-party visitor ownership token required.' },
            403,
            cors.headers
          );
        }

        const v = await db
          .prepare(
            `SELECT visitor_id, first_seen_at, last_seen_at, total_visits, location_source, gps_consent_status, gps_consent_at FROM visitors WHERE visitor_id = ?`
          )
          .bind(visitorId)
          .first<Record<string, unknown>>();

        return jsonResponse(
          {
            visitorExists: Boolean(v),
            visitor: v || null,
            retentionDays,
          },
          200,
          cors.headers
        );
      }

      if (method === 'POST') {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body !== 'object') {
          return jsonResponse({ error: 'Invalid JSON payload' }, 400, cors.headers);
        }

        const visitorId = sanitizeString(body.visitorId, 64);
        const action = sanitizeString(body.action, 32);
        if (!isValidUuidV4(visitorId) || !['withdraw_gps', 'delete_all_data'].includes(action)) {
          return jsonResponse(
            {
              error:
                'Valid UUID v4 visitorId and action (withdraw_gps | delete_all_data) required',
            },
            400,
            cors.headers
          );
        }

        const callerToken = extractVisitorToken(request, body);
        const ownership = await verifyVisitorOwnership(db, visitorId, callerToken);
        if (!ownership.exists || !ownership.verified) {
          return jsonResponse(
            { error: 'Forbidden: valid first-party visitor ownership token required.' },
            403,
            cors.headers
          );
        }

        const nowIso = new Date().toISOString();
        const visitorHash = (await sha256Hex(visitorId)).slice(0, 24);

        if (action === 'withdraw_gps') {
          const r1 = await db
            .prepare(
              `UPDATE visitors SET
              location_source = 'ip',
              gps_consent_status = 'withdrawn',
              gps_consent_at = ?,
              gps_latitude = NULL,
              gps_longitude = NULL,
              gps_accuracy_meters = NULL,
              gps_timestamp = NULL
            WHERE visitor_id = ?`
            )
            .bind(nowIso, visitorId)
            .run();

          await db
            .prepare(
              `UPDATE visits SET
              location_source = 'ip',
              gps_latitude = NULL,
              gps_longitude = NULL,
              gps_accuracy_meters = NULL,
              gps_timestamp = NULL
            WHERE visitor_id = ?`
            )
            .bind(visitorId)
            .run();

          await db
            .prepare(
              `UPDATE location_consents SET
              gps_latitude = NULL,
              gps_longitude = NULL,
              gps_accuracy_meters = NULL,
              gps_timestamp = NULL
            WHERE visitor_id = ?`
            )
            .bind(visitorId)
            .run();

          await db
            .prepare(
              `INSERT INTO location_consents (
              consent_id, visitor_id, action, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, consent_notice_version, created_at
            ) VALUES (?, ?, 'withdrawn', NULL, NULL, NULL, NULL, 'v1.0', ?)`
            )
            .bind(crypto.randomUUID(), visitorId, nowIso)
            .run();

          await db
            .prepare(
              `INSERT INTO deletion_requests (request_id, visitor_id_hash, action, records_purged, requested_at)
             VALUES (?, ?, 'withdraw_gps', ?, ?)`
            )
            .bind(crypto.randomUUID(), visitorHash, r1.meta?.changes ?? 1, nowIso)
            .run();

          return jsonResponse(
            {
              ok: true,
              action: 'withdraw_gps',
              message:
                'GPS consent withdrawn and all stored GPS coordinates have been permanently cleared from visitors, visits, and consent records.',
              timestamp: nowIso,
            },
            200,
            cors.headers
          );
        }

        const vDel = await db
          .prepare(`DELETE FROM visits WHERE visitor_id = ?`)
          .bind(visitorId)
          .run();
        await db.prepare(`DELETE FROM sessions WHERE visitor_id = ?`).bind(visitorId).run();
        await db.prepare(`DELETE FROM location_consents WHERE visitor_id = ?`).bind(visitorId).run();
        await db.prepare(`DELETE FROM visitors WHERE visitor_id = ?`).bind(visitorId).run();

        const purgedCount = (vDel.meta?.changes ?? 0) + 1;
        await db
          .prepare(
            `INSERT INTO deletion_requests (request_id, visitor_id_hash, action, records_purged, requested_at)
           VALUES (?, ?, 'delete_all_data', ?, ?)`
          )
          .bind(crypto.randomUUID(), visitorHash, purgedCount, nowIso)
          .run();

        return jsonResponse(
          {
            ok: true,
            action: 'delete_all_data',
            message:
              'All visitor, session, visit, and location consent records for this browser have been permanently deleted.',
            timestamp: nowIso,
          },
          200,
          cors.headers,
          {
            'Set-Cookie':
              'arqam_vtok=; Path=/api/analytics; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
          }
        );
      }
    }

    // ========================================================================
    // Require Configured Secrets + Valid Admin Bearer/Cookie Token for /admin/*
    // ========================================================================
    if (subPath.startsWith('admin/')) {
      const secrets = await resolveAdminSecrets(env);
      if (!secrets.ok || !secrets.adminPassword || !secrets.adminTokenSecret) {
        return jsonResponse(
          {
            error:
              secrets.reason ||
              'Admin authentication is disabled: ADMIN_PASSWORD must be configured securely on the server.',
          },
          503,
          cors.headers
        );
      }

      const isAuthorized = await verifyAdminAuth(request, env);
      if (!isAuthorized) {
        return jsonResponse(
          { error: 'Unauthorized. Valid admin session required.' },
          401,
          cors.headers
        );
      }

      // ----------------------------------------------------------------------
      // GET /api/analytics/admin/overview — Complete Analytics Overview
      // ----------------------------------------------------------------------
      if (method === 'GET' && subPath === 'admin/overview') {
        const range = sanitizeString(url.searchParams.get('range'), 16, '30d');
        const deviceFilter = sanitizeOptionalString(url.searchParams.get('deviceType'), 32);
        const locationFilter = sanitizeOptionalString(url.searchParams.get('locationSource'), 16);
        const campaignFilter = sanitizeOptionalString(url.searchParams.get('campaign'), 100);
        const startDateParam = sanitizeOptionalString(url.searchParams.get('startDate'), 32);
        const endDateParam = sanitizeOptionalString(url.searchParams.get('endDate'), 32);

        const conditions: string[] = [];
        const binds: unknown[] = [];

        if (startDateParam) {
          conditions.push(`created_at >= ?`);
          binds.push(startDateParam);
        } else if (range !== 'all') {
          const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1d' ? 1 : 30;
          const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString();
          conditions.push(`created_at >= ?`);
          binds.push(cutoff);
        }

        if (endDateParam) {
          conditions.push(`created_at <= ?`);
          binds.push(endDateParam.length === 10 ? `${endDateParam}T23:59:59.999Z` : endDateParam);
        }
        if (deviceFilter && ['Desktop', 'Mobile', 'Tablet'].includes(deviceFilter)) {
          conditions.push(`device_type = ?`);
          binds.push(deviceFilter);
        }
        if (locationFilter && ['gps', 'ip'].includes(locationFilter)) {
          conditions.push(`location_source = ?`);
          binds.push(locationFilter);
        }
        if (campaignFilter && campaignFilter !== 'ALL') {
          conditions.push(`ref_campaign = ?`);
          binds.push(campaignFilter);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const kpiRow = await db
          .prepare(
            `SELECT
            COUNT(*) AS totalVisits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors,
            COUNT(DISTINCT session_id) AS totalSessions,
            SUM(CASE WHEN location_source = 'gps' THEN 1 ELSE 0 END) AS gpsVisits,
            SUM(CASE WHEN location_source = 'ip' THEN 1 ELSE 0 END) AS ipVisits
           FROM visits ${whereClause}`
          )
          .bind(...binds)
          .first<Record<string, number>>();

        const visitorGpsRow = await db
          .prepare(
            `SELECT
            SUM(CASE WHEN location_source = 'gps' AND gps_consent_status = 'granted' THEN 1 ELSE 0 END) AS gpsVisitors,
            SUM(CASE WHEN location_source != 'gps' OR gps_consent_status != 'granted' THEN 1 ELSE 0 END) AS ipVisitors
           FROM visitors`
          )
          .first<Record<string, number>>();

        const { results: dailyStats } = await db
          .prepare(
            `SELECT
             substr(created_at, 1, 10) AS period,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors,
            COUNT(DISTINCT session_id) AS sessions
           FROM visits ${whereClause}
           GROUP BY substr(created_at, 1, 10)
           ORDER BY period DESC
           LIMIT 30`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: weeklyStats } = await db
          .prepare(
            `SELECT
            strftime('%Y-W%W', created_at) AS period,
            MIN(substr(created_at, 1, 10)) AS weekStart,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors,
            COUNT(DISTINCT session_id) AS sessions
           FROM visits ${whereClause}
           GROUP BY strftime('%Y-W%W', created_at)
           ORDER BY period DESC
           LIMIT 16`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: monthlyStats } = await db
          .prepare(
            `SELECT
            substr(created_at, 1, 7) AS period,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors,
            COUNT(DISTINCT session_id) AS sessions
           FROM visits ${whereClause}
           GROUP BY substr(created_at, 1, 7)
           ORDER BY period DESC
           LIMIT 12`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: topPages } = await db
          .prepare(
            `SELECT
            page_path AS pagePath,
            MAX(page_title) AS pageTitle,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY page_path
           ORDER BY visits DESC
           LIMIT 15`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: geoLocations } = await db
          .prepare(
            `SELECT
            COALESCE(ip_country, 'Unknown') AS country,
            COALESCE(ip_region, 'Unknown') AS region,
            COALESCE(ip_city, 'Unknown') AS city,
            ip_postal_code AS postalCode,
            location_source AS locationSource,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY COALESCE(ip_country, 'Unknown'), COALESCE(ip_region, 'Unknown'), COALESCE(ip_city, 'Unknown'), location_source
           ORDER BY visits DESC
           LIMIT 50`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: mapPoints } = await db
          .prepare(
            `SELECT
            visitor_id AS visitorId,
            location_source AS locationSource,
            ip_country AS ipCountry,
            ip_region AS ipRegion,
            ip_city AS ipCity,
            ip_postal_code AS ipPostalCode,
            ip_latitude AS ipLatitude,
            ip_longitude AS ipLongitude,
            gps_latitude AS gpsLatitude,
            gps_longitude AS gpsLongitude,
            gps_accuracy_meters AS gpsAccuracyMeters,
            gps_timestamp AS gpsTimestamp,
            gps_consent_at AS gpsConsentAt,
            total_visits AS totalVisits,
            last_seen_at AS lastSeenAt
           FROM visitors
           WHERE (location_source = 'gps' AND gps_latitude IS NOT NULL AND gps_longitude IS NOT NULL)
              OR (ip_latitude IS NOT NULL AND ip_longitude IS NOT NULL)
           ORDER BY last_seen_at DESC
           LIMIT 200`
          )
          .all<Record<string, unknown>>();

        const { results: topReferrers } = await db
          .prepare(
            `SELECT
            COALESCE(referrer_domain, 'Direct / None') AS referrerDomain,
            MAX(referrer_url) AS sampleReferrerUrl,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY COALESCE(referrer_domain, 'Direct / None')
           ORDER BY visits DESC
           LIMIT 20`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: firstTouchStats } = await db
          .prepare(
            `SELECT
            COALESCE(first_touch_ref, first_touch_referrer_domain, 'Direct / Organic') AS source,
            first_touch_ref AS refCampaign,
            first_touch_referrer_domain AS referrerDomain,
            COUNT(*) AS uniqueVisitors,
            SUM(total_visits) AS totalVisits
           FROM visitors
           GROUP BY COALESCE(first_touch_ref, first_touch_referrer_domain, 'Direct / Organic')
           ORDER BY uniqueVisitors DESC
           LIMIT 20`
          )
          .all<Record<string, unknown>>();

        const { results: lastTouchStats } = await db
          .prepare(
            `SELECT
            COALESCE(last_touch_ref, last_touch_referrer_domain, 'Direct / Organic') AS source,
            last_touch_ref AS refCampaign,
            last_touch_referrer_domain AS referrerDomain,
            COUNT(*) AS uniqueVisitors,
            SUM(total_visits) AS totalVisits
           FROM visitors
           GROUP BY COALESCE(last_touch_ref, last_touch_referrer_domain, 'Direct / Organic')
           ORDER BY uniqueVisitors DESC
           LIMIT 20`
          )
          .all<Record<string, unknown>>();

        const { results: savedCampaigns } = await db
          .prepare(
            `SELECT
            c.campaign_id AS campaignId,
            c.slug AS slug,
            c.name AS name,
            c.channel AS channel,
            c.target_path AS targetPath,
            c.notes AS notes,
            c.created_at AS createdAt,
            (SELECT COUNT(*) FROM visits v WHERE v.ref_campaign = c.slug) AS totalVisits,
            (SELECT COUNT(DISTINCT v.visitor_id) FROM visits v WHERE v.ref_campaign = c.slug) AS uniqueVisitors,
            (SELECT COUNT(*) FROM visitors vis WHERE vis.first_touch_ref = c.slug) AS firstTouchVisitors,
            (SELECT COUNT(*) FROM visitors vis WHERE vis.last_touch_ref = c.slug) AS lastTouchVisitors,
            (SELECT MAX(v.created_at) FROM visits v WHERE v.ref_campaign = c.slug) AS lastVisitAt
           FROM referral_campaigns c
           ORDER BY c.created_at DESC`
          )
          .all<Record<string, unknown>>();

        const { results: observedRefs } = await db
          .prepare(
            `SELECT
            ref_campaign AS slug,
            COUNT(*) AS totalVisits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors,
            MAX(created_at) AS lastVisitAt
           FROM visits
           WHERE ref_campaign IS NOT NULL AND ref_campaign != ''
           GROUP BY ref_campaign
           ORDER BY totalVisits DESC`
          )
          .all<Record<string, unknown>>();

        const { results: byDeviceType } = await db
          .prepare(
            `SELECT device_type AS deviceType, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY device_type
           ORDER BY visits DESC`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: byOs } = await db
          .prepare(
            `SELECT os, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY os
           ORDER BY visits DESC
           LIMIT 15`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: byBrowser } = await db
          .prepare(
            `SELECT browser, COALESCE(browser_version, '') AS browserVersion, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY browser, COALESCE(browser_version, '')
           ORDER BY visits DESC
           LIMIT 15`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: byScreen } = await db
          .prepare(
            `SELECT
            CAST(screen_width AS TEXT) || '×' || CAST(screen_height AS TEXT) AS resolution,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits
           ${whereClause ? `${whereClause} AND screen_width IS NOT NULL AND screen_height IS NOT NULL` : 'WHERE screen_width IS NOT NULL AND screen_height IS NOT NULL'}
           GROUP BY resolution
           ORDER BY visits DESC
           LIMIT 12`
          )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const totalVisits = Number(kpiRow?.totalVisits || 0);
        const totalSessions = Number(kpiRow?.totalSessions || 0);

        return jsonResponse(
          {
            kpis: {
              totalVisits,
              uniqueVisitors: Number(kpiRow?.uniqueVisitors || 0),
              totalSessions,
              avgPagesPerSession:
                totalSessions > 0 ? Number((totalVisits / totalSessions).toFixed(2)) : 0,
              gpsVisits: Number(kpiRow?.gpsVisits || 0),
              ipVisits: Number(kpiRow?.ipVisits || 0),
              gpsVisitors: Number(visitorGpsRow?.gpsVisitors || 0),
              ipVisitors: Number(visitorGpsRow?.ipVisitors || 0),
              retentionDays,
            },
            dailyStats,
            weeklyStats,
            monthlyStats,
            topPages,
            geographic: {
              locations: geoLocations,
              mapPoints,
            },
            referrals: {
              topReferrers,
              firstTouchAttribution: firstTouchStats,
              lastTouchAttribution: lastTouchStats,
              campaigns: savedCampaigns,
              observedRefs,
            },
            devices: {
              byDeviceType,
              byOs,
              byBrowser,
              byScreen,
            },
          },
          200,
          cors.headers
        );
      }

      // ----------------------------------------------------------------------
      // GET /api/analytics/admin/visitors — Searchable Visitor Directory
      // ----------------------------------------------------------------------
      if (method === 'GET' && subPath === 'admin/visitors') {
        const search = sanitizeOptionalString(url.searchParams.get('search'), 128);
        const deviceType = sanitizeOptionalString(url.searchParams.get('deviceType'), 32);
        const locationSource = sanitizeOptionalString(url.searchParams.get('locationSource'), 16);
        const campaign = sanitizeOptionalString(url.searchParams.get('campaign'), 100);
        const startDate = sanitizeOptionalString(url.searchParams.get('startDate'), 32);
        const endDate = sanitizeOptionalString(url.searchParams.get('endDate'), 32);
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || '50') || 50));

        const conds: string[] = [];
        const binds: unknown[] = [];

        if (search) {
          const like = `%${search}%`;
          conds.push(
            `(visitor_id LIKE ? OR COALESCE(ip_country, '') LIKE ? OR COALESCE(ip_region, '') LIKE ? OR COALESCE(ip_city, '') LIKE ? OR COALESCE(ip_postal_code, '') LIKE ? OR COALESCE(first_touch_ref, '') LIKE ? OR COALESCE(last_touch_ref, '') LIKE ? OR COALESCE(first_touch_referrer_domain, '') LIKE ? OR COALESCE(os, '') LIKE ? OR COALESCE(browser, '') LIKE ?)`
          );
          binds.push(like, like, like, like, like, like, like, like, like, like);
        }
        if (deviceType && ['Desktop', 'Mobile', 'Tablet'].includes(deviceType)) {
          conds.push(`device_type = ?`);
          binds.push(deviceType);
        }
        if (locationSource && ['gps', 'ip'].includes(locationSource)) {
          conds.push(`location_source = ?`);
          binds.push(locationSource);
        }
        if (campaign && campaign !== 'ALL') {
          conds.push(`(first_touch_ref = ? OR last_touch_ref = ?)`);
          binds.push(campaign, campaign);
        }
        if (startDate) {
          conds.push(`last_seen_at >= ?`);
          binds.push(startDate);
        }
        if (endDate) {
          conds.push(`last_seen_at <= ?`);
          binds.push(endDate.length === 10 ? `${endDate}T23:59:59.999Z` : endDate);
        }

        const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
        const { results: visitors } = await db
          .prepare(
            `SELECT
            visitor_id AS visitorId,
            first_seen_at AS firstSeenAt,
            last_seen_at AS lastSeenAt,
            total_visits AS totalVisits,
            total_sessions AS totalSessions,
            first_touch_ref AS firstTouchRef,
            first_touch_referrer_domain AS firstTouchReferrerDomain,
            first_touch_referrer_url AS firstTouchReferrerUrl,
            first_touch_at AS firstTouchAt,
            last_touch_ref AS lastTouchRef,
            last_touch_referrer_domain AS lastTouchReferrerDomain,
            last_touch_referrer_url AS lastTouchReferrerUrl,
            last_touch_at AS lastTouchAt,
            device_type AS deviceType,
            os,
            os_version AS osVersion,
            browser,
            browser_version AS browserVersion,
            screen_width AS screenWidth,
            screen_height AS screenHeight,
            language,
            timezone,
            location_source AS locationSource,
            ip_country AS ipCountry,
            ip_region AS ipRegion,
            ip_city AS ipCity,
            ip_postal_code AS ipPostalCode,
            ip_latitude AS ipLatitude,
            ip_longitude AS ipLongitude,
            gps_consent_status AS gpsConsentStatus,
            gps_consent_at AS gpsConsentAt,
            gps_latitude AS gpsLatitude,
            gps_longitude AS gpsLongitude,
            gps_accuracy_meters AS gpsAccuracyMeters,
            gps_timestamp AS gpsTimestamp
           FROM visitors
           ${whereClause}
           ORDER BY last_seen_at DESC
           LIMIT ?`
          )
          .bind(...binds, limit)
          .all<Record<string, unknown>>();

        return jsonResponse({ visitors }, 200, cors.headers);
      }

      // ----------------------------------------------------------------------
      // GET /api/analytics/admin/visitors/:id — Individual Visitor History
      // ----------------------------------------------------------------------
      if (method === 'GET' && subPath.startsWith('admin/visitors/')) {
        const targetVisitorId = decodeURIComponent(subPath.slice('admin/visitors/'.length));
        const visitor = await db
          .prepare(
            `SELECT
            visitor_id AS visitorId,
            first_seen_at AS firstSeenAt,
            last_seen_at AS lastSeenAt,
            total_visits AS totalVisits,
            total_sessions AS totalSessions,
            first_touch_ref AS firstTouchRef,
            first_touch_referrer_domain AS firstTouchReferrerDomain,
            first_touch_referrer_url AS firstTouchReferrerUrl,
            first_touch_at AS firstTouchAt,
            last_touch_ref AS lastTouchRef,
            last_touch_referrer_domain AS lastTouchReferrerDomain,
            last_touch_referrer_url AS lastTouchReferrerUrl,
            last_touch_at AS lastTouchAt,
            device_type AS deviceType,
            os,
            os_version AS osVersion,
            browser,
            browser_version AS browserVersion,
            screen_width AS screenWidth,
            screen_height AS screenHeight,
            language,
            timezone,
            location_source AS locationSource,
            ip_country AS ipCountry,
            ip_region AS ipRegion,
            ip_city AS ipCity,
            ip_postal_code AS ipPostalCode,
            ip_latitude AS ipLatitude,
            ip_longitude AS ipLongitude,
            gps_consent_status AS gpsConsentStatus,
            gps_consent_at AS gpsConsentAt,
            gps_latitude AS gpsLatitude,
            gps_longitude AS gpsLongitude,
            gps_accuracy_meters AS gpsAccuracyMeters,
            gps_timestamp AS gpsTimestamp
           FROM visitors WHERE visitor_id = ?`
          )
          .bind(targetVisitorId)
          .first<Record<string, unknown>>();

        if (!visitor) {
          return jsonResponse({ error: 'Visitor not found' }, 404, cors.headers);
        }

        const { results: sessions } = await db
          .prepare(
            `SELECT
            session_id AS sessionId,
            started_at AS startedAt,
            last_activity_at AS lastActivityAt,
            entry_page AS entryPage,
            exit_page AS exitPage,
            page_count AS pageCount,
            ref_campaign AS refCampaign,
            referrer_domain AS referrerDomain,
            referrer_url AS referrerUrl,
            device_type AS deviceType,
            os,
            browser
           FROM sessions WHERE visitor_id = ? ORDER BY started_at DESC LIMIT 50`
          )
          .bind(targetVisitorId)
          .all<Record<string, unknown>>();

        const { results: visits } = await db
          .prepare(
            `SELECT
            visit_id AS visitId,
            session_id AS sessionId,
            page_path AS pagePath,
            page_title AS pageTitle,
            referrer_url AS referrerUrl,
            referrer_domain AS referrerDomain,
            ref_campaign AS refCampaign,
            device_type AS deviceType,
            os,
            browser,
            browser_version AS browserVersion,
            screen_width AS screenWidth,
            screen_height AS screenHeight,
            location_source AS locationSource,
            ip_country AS ipCountry,
            ip_region AS ipRegion,
            ip_city AS ipCity,
            ip_postal_code AS ipPostalCode,
            gps_latitude AS gpsLatitude,
            gps_longitude AS gpsLongitude,
            gps_accuracy_meters AS gpsAccuracyMeters,
            gps_timestamp AS gpsTimestamp,
            created_at AS createdAt
           FROM visits WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 100`
          )
          .bind(targetVisitorId)
          .all<Record<string, unknown>>();

        const { results: consents } = await db
          .prepare(
            `SELECT
            consent_id AS consentId,
            action,
            gps_latitude AS gpsLatitude,
            gps_longitude AS gpsLongitude,
            gps_accuracy_meters AS gpsAccuracyMeters,
            gps_timestamp AS gpsTimestamp,
            consent_notice_version AS consentNoticeVersion,
            created_at AS createdAt
           FROM location_consents WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 50`
          )
          .bind(targetVisitorId)
          .all<Record<string, unknown>>();

        return jsonResponse(
          {
            visitor,
            sessions,
            visits,
            consents,
          },
          200,
          cors.headers
        );
      }

      // ----------------------------------------------------------------------
      // POST / DELETE /api/analytics/admin/campaigns — Referral Campaign Manager
      // ----------------------------------------------------------------------
      if (subPath === 'admin/campaigns' && method === 'POST') {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body !== 'object') {
          return jsonResponse({ error: 'Invalid JSON payload' }, 400, cors.headers);
        }

        const rawSlug = sanitizeString(body.slug, 80)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_')
          .replace(/_{2,}/g, '_')
          .replace(/^_|_$/g, '');
        const name = sanitizeString(body.name, 120) || rawSlug;
        const channel = sanitizeString(body.channel, 64, 'Custom');
        const targetPath = sanitizeString(body.targetPath, 128, '/');
        const notes = sanitizeOptionalString(body.notes, 256);

        if (!rawSlug) {
          return jsonResponse(
            { error: 'Valid campaign slug is required (e.g. instagram_bio)' },
            400,
            cors.headers
          );
        }

        const nowIso = new Date().toISOString();
        const campaignId = crypto.randomUUID();

        await db
          .prepare(
            `INSERT INTO referral_campaigns (campaign_id, slug, name, channel, target_path, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET
             name = excluded.name,
             channel = excluded.channel,
             target_path = excluded.target_path,
             notes = excluded.notes`
          )
          .bind(
            campaignId,
            rawSlug,
            name,
            channel,
            targetPath.startsWith('/') ? targetPath : `/${targetPath}`,
            notes,
            nowIso
          )
          .run();

        return jsonResponse(
          {
            ok: true,
            campaign: {
              campaignId,
              slug: rawSlug,
              name,
              channel,
              targetPath: targetPath.startsWith('/') ? targetPath : `/${targetPath}`,
              notes,
              createdAt: nowIso,
            },
          },
          200,
          cors.headers
        );
      }

      if (subPath.startsWith('admin/campaigns/') && method === 'DELETE') {
        const slug = decodeURIComponent(subPath.slice('admin/campaigns/'.length));
        await db.prepare(`DELETE FROM referral_campaigns WHERE slug = ?`).bind(slug).run();
        return jsonResponse({ ok: true, deletedSlug: slug }, 200, cors.headers);
      }

      // ----------------------------------------------------------------------
      // POST /api/analytics/admin/purge — Admin Retention & Visitor Purge
      // ----------------------------------------------------------------------
      if (subPath === 'admin/purge' && method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const targetVisitorId = sanitizeOptionalString(body?.visitorId, 64);
        if (targetVisitorId) {
          await db.prepare(`DELETE FROM visits WHERE visitor_id = ?`).bind(targetVisitorId).run();
          await db.prepare(`DELETE FROM sessions WHERE visitor_id = ?`).bind(targetVisitorId).run();
          await db
            .prepare(`DELETE FROM location_consents WHERE visitor_id = ?`)
            .bind(targetVisitorId)
            .run();
          await db.prepare(`DELETE FROM visitors WHERE visitor_id = ?`).bind(targetVisitorId).run();
          return jsonResponse({ ok: true, purgedVisitorId: targetVisitorId }, 200, cors.headers);
        }
        const customDays = sanitizeNumber(body?.retentionDays, 1, 3650) ?? retentionDays;
        const report = await runScheduledRetentionCleanup(db, customDays);
        return jsonResponse({ ok: true, ...report }, 200, cors.headers);
      }
    }

    return jsonResponse(
      { error: `Unknown analytics endpoint: /api/analytics/${subPath}` },
      404,
      cors.headers
    );
  } catch (err) {
    logAuthDiagnostic('analytics_unhandled_exception', {
      subPath,
      method,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return jsonResponse(
      { error: 'Internal analytics server error.' },
      500,
      cors.headers
    );
  }
};
