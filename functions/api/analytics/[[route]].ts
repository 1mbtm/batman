/**
 * Cloudflare Pages Functions — Portfolio Visitor Analytics & Admin API
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
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  ADMIN_TOKEN_SECRET?: string;
  ANALYTICS_RETENTION_DAYS?: string;
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
}

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
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

async function computeSaltedIpHash(request: Request, env: Env): Promise<string | null> {
  const rawIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  if (!rawIp) return null;
  const daySalt = new Date().toISOString().slice(0, 10);
  const secret = env.ADMIN_TOKEN_SECRET || 'arqam-default-ip-salt';
  const fullHash = await sha256Hex(`${secret}:${daySalt}:${rawIp}`);
  return fullHash.slice(0, 24);
}

async function ensureSchemaInitialized(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS visitors (
        visitor_id TEXT PRIMARY KEY,
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
}

async function verifyAdminAuth(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return false;

  const secret = env.ADMIN_TOKEN_SECRET || 'arqam-default-token-secret';
  const tokenHash = await sha256Hex(`${secret}:${rawToken}`);
  const nowIso = new Date().toISOString();

  const session = await env.DB.prepare(
    `SELECT token_hash, expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > ?`
  )
    .bind(tokenHash, nowIso)
    .first<{ token_hash: string; expires_at: string }>();

  return Boolean(session);
}

async function enforceRetentionPolicy(db: D1Database, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86400 * 1000).toISOString();
  const res = await db.prepare(`DELETE FROM visits WHERE created_at < ?`).bind(cutoff).run();
  await db.prepare(`DELETE FROM sessions WHERE last_activity_at < ?`).bind(cutoff).run();
  await db.prepare(`DELETE FROM admin_sessions WHERE expires_at < ?`).bind(new Date().toISOString()).run();
  return res.meta?.changes ?? 0;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!env.DB) {
    return jsonResponse(
      { error: 'Database binding (DB) is not configured in Cloudflare Pages.' },
      503
    );
  }

  await ensureSchemaInitialized(env.DB);

  const subPath = url.pathname.replace(/^\/api\/analytics\/?/, '').replace(/\/$/, '');
  const retentionDays = Math.max(7, Math.min(3650, Number(env.ANALYTICS_RETENTION_DAYS || '90') || 90));

  try {
    // ========================================================================
    // 1. POST /api/analytics/collect — Public Event Collection
    // ========================================================================
    if (method === 'POST' && subPath === 'collect') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) {
        return jsonResponse({ error: 'Invalid JSON payload' }, 400);
      }

      const visitorId = sanitizeString(body.visitorId, 64);
      const sessionId = sanitizeString(body.sessionId, 64);
      const pagePath = sanitizeString(body.pagePath, 256, '/');
      if (!visitorId || visitorId.length < 8 || !sessionId || sessionId.length < 8) {
        return jsonResponse({ error: 'Valid visitorId and sessionId are required' }, 400);
      }

      const nowIso = new Date().toISOString();
      const minuteBucket = nowIso.slice(0, 16);
      const idempotencyKey =
        sanitizeOptionalString(body.idempotencyKey, 128) ||
        `${visitorId}:${sessionId}:${pagePath}:${minuteBucket}`;

      // Check duplicate idempotency key or recent duplicate within 5 seconds
      const fiveSecAgo = new Date(Date.now() - 5000).toISOString();
      const existingVisit = await env.DB.prepare(
        `SELECT visit_id FROM visits WHERE idempotency_key = ? OR (visitor_id = ? AND session_id = ? AND page_path = ? AND created_at > ?) LIMIT 1`
      )
        .bind(idempotencyKey, visitorId, sessionId, pagePath, fiveSecAgo)
        .first<{ visit_id: string }>();

      if (existingVisit) {
        return jsonResponse({ ok: true, deduplicated: true, visitId: existingVisit.visit_id });
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
      const deviceType = ['Desktop', 'Mobile', 'Tablet'].includes(rawDevice) ? rawDevice : 'Desktop';
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
      const ipHash = await computeSaltedIpHash(request, env);

      // Strictly require explicit consent flag for GPS coordinates
      const gpsConsentGranted = body.gpsConsentGranted === true;
      const gpsLat = gpsConsentGranted ? sanitizeNumber(body.gpsLatitude, -90, 90) : null;
      const gpsLng = gpsConsentGranted ? sanitizeNumber(body.gpsLongitude, -180, 180) : null;
      const gpsAcc = gpsConsentGranted ? sanitizeNumber(body.gpsAccuracyMeters, 0, 100000) : null;
      const gpsTs =
        gpsConsentGranted && gpsLat !== null && gpsLng !== null
          ? sanitizeOptionalString(body.gpsTimestamp, 64) || nowIso
          : null;

      const hasValidGps = gpsLat !== null && gpsLng !== null;
      const locationSource = hasValidGps ? 'gps' : 'ip';

      // Check existing visitor
      const existingVisitor = await env.DB.prepare(
        `SELECT visitor_id, total_visits, total_sessions, first_touch_ref, first_touch_referrer_domain, first_touch_referrer_url, gps_consent_status, gps_consent_at, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, location_source FROM visitors WHERE visitor_id = ?`
      )
        .bind(visitorId)
        .first<Record<string, unknown>>();

      // Check existing session
      const existingSession = await env.DB.prepare(
        `SELECT session_id, page_count FROM sessions WHERE session_id = ?`
      )
        .bind(sessionId)
        .first<{ session_id: string; page_count: number }>();

      const isNewSession = !existingSession;

      if (!existingVisitor) {
        await env.DB.prepare(
          `INSERT INTO visitors (
            visitor_id, first_seen_at, last_seen_at, total_visits, total_sessions,
            first_touch_ref, first_touch_referrer_domain, first_touch_referrer_url, first_touch_at,
            last_touch_ref, last_touch_referrer_domain, last_touch_referrer_url, last_touch_at,
            device_type, os, os_version, browser, browser_version, screen_width, screen_height, language, timezone,
            location_source, ip_country, ip_region, ip_city, ip_postal_code, ip_latitude, ip_longitude,
            gps_consent_status, gps_consent_at, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp,
            ip_hash
          ) VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            visitorId,
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
            locationSource,
            ipGeo.ipCountry,
            ipGeo.ipRegion,
            ipGeo.ipCity,
            ipGeo.ipPostalCode,
            ipGeo.ipLatitude,
            ipGeo.ipLongitude,
            hasValidGps ? 'granted' : 'unset',
            hasValidGps ? nowIso : null,
            gpsLat,
            gpsLng,
            gpsAcc,
            gpsTs,
            ipHash
          )
          .run();
      } else {
        const nextVisits = Number(existingVisitor.total_visits || 0) + 1;
        const nextSessions = Number(existingVisitor.total_sessions || 0) + (isNewSession ? 1 : 0);
        const keepFirstRef = (existingVisitor.first_touch_ref as string | null) || firstTouchRef;
        const keepFirstDomain =
          (existingVisitor.first_touch_referrer_domain as string | null) || firstTouchReferrerDomain;
        const keepFirstUrl =
          (existingVisitor.first_touch_referrer_url as string | null) || firstTouchReferrerUrl;

        const nextLastRef = refCampaign || (existingVisitor.last_touch_ref as string | null);
        const nextLastDomain =
          referrerDomain || (existingVisitor.last_touch_referrer_domain as string | null);
        const nextLastUrl =
          referrerUrl || (existingVisitor.last_touch_referrer_url as string | null);

        const prevHadGps = existingVisitor.location_source === 'gps' && existingVisitor.gps_consent_status === 'granted';
        const effectiveLocationSource = hasValidGps ? 'gps' : prevHadGps ? 'gps' : 'ip';
        const effectiveGpsStatus = hasValidGps
          ? 'granted'
          : (existingVisitor.gps_consent_status as string) || 'unset';
        const effectiveGpsConsentAt = hasValidGps
          ? (existingVisitor.gps_consent_at as string | null) || nowIso
          : (existingVisitor.gps_consent_at as string | null);
        const effectiveGpsLat = hasValidGps ? gpsLat : (existingVisitor.gps_latitude as number | null);
        const effectiveGpsLng = hasValidGps ? gpsLng : (existingVisitor.gps_longitude as number | null);
        const effectiveGpsAcc = hasValidGps ? gpsAcc : (existingVisitor.gps_accuracy_meters as number | null);
        const effectiveGpsTs = hasValidGps ? gpsTs : (existingVisitor.gps_timestamp as string | null);

        await env.DB.prepare(
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
            gps_consent_status = ?,
            gps_consent_at = ?,
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
            effectiveLocationSource,
            ipGeo.ipCountry,
            ipGeo.ipRegion,
            ipGeo.ipCity,
            ipGeo.ipPostalCode,
            ipGeo.ipLatitude,
            ipGeo.ipLongitude,
            effectiveGpsStatus,
            effectiveGpsConsentAt,
            effectiveGpsLat,
            effectiveGpsLng,
            effectiveGpsAcc,
            effectiveGpsTs,
            ipHash,
            visitorId
          )
          .run();
      }

      if (isNewSession) {
        await env.DB.prepare(
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
        await env.DB.prepare(
          `UPDATE sessions SET
            last_activity_at = ?,
            exit_page = ?,
            page_count = page_count + 1,
            ref_campaign = COALESCE(ref_campaign, ?),
            referrer_domain = COALESCE(referrer_domain, ?),
            referrer_url = COALESCE(referrer_url, ?)
          WHERE session_id = ?`
        )
          .bind(nowIso, pagePath, refCampaign, referrerDomain, referrerUrl, sessionId)
          .run();
      }

      const visitId = crypto.randomUUID();
      await env.DB.prepare(
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

      if (hasValidGps) {
        await env.DB.prepare(
          `INSERT INTO location_consents (
            consent_id, visitor_id, action, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, consent_notice_version, created_at
          ) VALUES (?, ?, 'granted', ?, ?, ?, ?, 'v1.0', ?)`
        )
          .bind(crypto.randomUUID(), visitorId, gpsLat, gpsLng, gpsAcc, gpsTs, nowIso)
          .run();
      }

      return jsonResponse({
        ok: true,
        visitId,
        locationSource,
        approximateIpLocation: {
          country: ipGeo.ipCountry,
          region: ipGeo.ipRegion,
          city: ipGeo.ipCity,
          isExact: false,
        },
      });
    }

    // ========================================================================
    // 2. POST /api/analytics/consent — Explicit GPS Permission Grant / Denial
    // ========================================================================
    if (method === 'POST' && subPath === 'consent') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return jsonResponse({ error: 'Invalid JSON payload' }, 400);

      const visitorId = sanitizeString(body.visitorId, 64);
      const action = sanitizeString(body.action, 32);
      if (!visitorId || !['granted', 'denied'].includes(action)) {
        return jsonResponse({ error: 'Valid visitorId and action (granted|denied) required' }, 400);
      }

      const nowIso = new Date().toISOString();
      const gpsLat = action === 'granted' ? sanitizeNumber(body.gpsLatitude, -90, 90) : null;
      const gpsLng = action === 'granted' ? sanitizeNumber(body.gpsLongitude, -180, 180) : null;
      const gpsAcc = action === 'granted' ? sanitizeNumber(body.gpsAccuracyMeters, 0, 100000) : null;
      const gpsTs =
        action === 'granted' && gpsLat !== null && gpsLng !== null
          ? sanitizeOptionalString(body.gpsTimestamp, 64) || nowIso
          : null;

      await env.DB.prepare(
        `INSERT INTO location_consents (
          consent_id, visitor_id, action, gps_latitude, gps_longitude, gps_accuracy_meters, gps_timestamp, consent_notice_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'v1.0', ?)`
      )
        .bind(crypto.randomUUID(), visitorId, action, gpsLat, gpsLng, gpsAcc, gpsTs, nowIso)
        .run();

      if (action === 'granted' && gpsLat !== null && gpsLng !== null) {
        await env.DB.prepare(
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
          .bind(nowIso, gpsLat, gpsLng, gpsAcc, gpsTs, nowIso, visitorId)
          .run();

        // Also upgrade the visitor's most recent visit in the current session
        await env.DB.prepare(
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
          .bind(gpsLat, gpsLng, gpsAcc, gpsTs, visitorId)
          .run();
      } else {
        await env.DB.prepare(
          `UPDATE visitors SET
            gps_consent_status = 'denied',
            gps_consent_at = ?
          WHERE visitor_id = ?`
        )
          .bind(nowIso, visitorId)
          .run();
      }

      return jsonResponse({
        ok: true,
        visitorId,
        gpsConsentStatus: action,
        consentTimestamp: nowIso,
      });
    }

    // ========================================================================
    // 3. GET / POST /api/analytics/privacy — Consent Withdrawal & Data Deletion
    // ========================================================================
    if (subPath === 'privacy') {
      if (method === 'GET') {
        const visitorId = sanitizeString(url.searchParams.get('visitorId'), 64);
        if (!visitorId) return jsonResponse({ error: 'visitorId query parameter required' }, 400);

        const v = await env.DB.prepare(
          `SELECT visitor_id, first_seen_at, last_seen_at, total_visits, location_source, gps_consent_status, gps_consent_at FROM visitors WHERE visitor_id = ?`
        )
          .bind(visitorId)
          .first<Record<string, unknown>>();

        return jsonResponse({
          visitorExists: Boolean(v),
          visitor: v || null,
          retentionDays,
        });
      }

      if (method === 'POST') {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return jsonResponse({ error: 'Invalid JSON payload' }, 400);

        const visitorId = sanitizeString(body.visitorId, 64);
        const action = sanitizeString(body.action, 32);
        if (!visitorId || !['withdraw_gps', 'delete_all_data'].includes(action)) {
          return jsonResponse(
            { error: 'Valid visitorId and action (withdraw_gps | delete_all_data) required' },
            400
          );
        }

        const nowIso = new Date().toISOString();
        const visitorHash = (await sha256Hex(visitorId)).slice(0, 24);

        if (action === 'withdraw_gps') {
          const r1 = await env.DB.prepare(
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

          await env.DB.prepare(
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

          await env.DB.prepare(
            `INSERT INTO location_consents (
              consent_id, visitor_id, action, consent_notice_version, created_at
            ) VALUES (?, ?, 'withdrawn', 'v1.0', ?)`
          )
            .bind(crypto.randomUUID(), visitorId, nowIso)
            .run();

          await env.DB.prepare(
            `INSERT INTO deletion_requests (request_id, visitor_id_hash, action, records_purged, requested_at)
             VALUES (?, ?, 'withdraw_gps', ?, ?)`
          )
            .bind(crypto.randomUUID(), visitorHash, r1.meta?.changes ?? 1, nowIso)
            .run();

          return jsonResponse({
            ok: true,
            action: 'withdraw_gps',
            message: 'GPS consent withdrawn and all stored GPS coordinates have been permanently cleared.',
            timestamp: nowIso,
          });
        }

        // action === 'delete_all_data'
        const vDel = await env.DB.prepare(`DELETE FROM visits WHERE visitor_id = ?`).bind(visitorId).run();
        await env.DB.prepare(`DELETE FROM sessions WHERE visitor_id = ?`).bind(visitorId).run();
        await env.DB.prepare(`DELETE FROM location_consents WHERE visitor_id = ?`).bind(visitorId).run();
        await env.DB.prepare(`DELETE FROM visitors WHERE visitor_id = ?`).bind(visitorId).run();

        const purgedCount = (vDel.meta?.changes ?? 0) + 1;
        await env.DB.prepare(
          `INSERT INTO deletion_requests (request_id, visitor_id_hash, action, records_purged, requested_at)
           VALUES (?, ?, 'delete_all_data', ?, ?)`
        )
          .bind(crypto.randomUUID(), visitorHash, purgedCount, nowIso)
          .run();

        return jsonResponse({
          ok: true,
          action: 'delete_all_data',
          message: 'All visitor, session, visit, and location records for this device have been permanently deleted.',
          timestamp: nowIso,
        });
      }
    }

    // ========================================================================
    // 4. POST /api/analytics/admin/login — Admin Authentication
    // ========================================================================
    if (method === 'POST' && subPath === 'admin/login') {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      const password = sanitizeString(body?.password, 256);
      const expectedPassword = env.ADMIN_PASSWORD || 'arqam-admin-2026';

      if (!password || !constantTimeEqual(password, expectedPassword)) {
        return jsonResponse({ error: 'Invalid admin password.' }, 401);
      }

      const rawToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const secret = env.ADMIN_TOKEN_SECRET || 'arqam-default-token-secret';
      const tokenHash = await sha256Hex(`${secret}:${rawToken}`);
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const ipHash = await computeSaltedIpHash(request, env);
      const ua = sanitizeOptionalString(request.headers.get('user-agent'), 256);

      await env.DB.prepare(
        `INSERT INTO admin_sessions (token_hash, created_at, expires_at, ip_hash, user_agent)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(tokenHash, nowIso, expiresAt, ipHash, ua)
        .run();

      // Run retention cleanup asynchronously on admin login
      await enforceRetentionPolicy(env.DB, retentionDays);

      return jsonResponse({
        ok: true,
        token: rawToken,
        expiresAt,
      });
    }

    // ========================================================================
    // Require Admin Bearer Token for all remaining /api/analytics/admin/* routes
    // ========================================================================
    if (subPath.startsWith('admin/')) {
      const isAuthorized = await verifyAdminAuth(request, env);
      if (!isAuthorized) {
        return jsonResponse({ error: 'Unauthorized. Valid admin bearer token required.' }, 401);
      }

      if (method === 'POST' && subPath === 'admin/logout') {
        const authHeader = request.headers.get('authorization') || '';
        const rawToken = authHeader.slice(7).trim();
        const secret = env.ADMIN_TOKEN_SECRET || 'arqam-default-token-secret';
        const tokenHash = await sha256Hex(`${secret}:${rawToken}`);
        await env.DB.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`).bind(tokenHash).run();
        return jsonResponse({ ok: true });
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
        if (deviceFilter && deviceFilter !== 'ALL') {
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

        // 1. KPI Summary
        const kpiRow = await env.DB.prepare(
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

        const visitorGpsRow = await env.DB.prepare(
          `SELECT
            SUM(CASE WHEN location_source = 'gps' AND gps_consent_status = 'granted' THEN 1 ELSE 0 END) AS gpsVisitors,
            SUM(CASE WHEN location_source != 'gps' OR gps_consent_status != 'granted' THEN 1 ELSE 0 END) AS ipVisitors
           FROM visitors`
        ).first<Record<string, number>>();

        // 2. Daily, Weekly, and Monthly statistics
        const { results: dailyStats } = await env.DB.prepare(
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

        const { results: weeklyStats } = await env.DB.prepare(
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

        const { results: monthlyStats } = await env.DB.prepare(
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

        // 3. Most visited pages
        const { results: topPages } = await env.DB.prepare(
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

        // 4. Geographic distribution & interactive map points
        const { results: geoLocations } = await env.DB.prepare(
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

        const { results: mapPoints } = await env.DB.prepare(
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
        ).all<Record<string, unknown>>();

        // 5. Referrals & First-touch / Last-touch attribution
        const { results: topReferrers } = await env.DB.prepare(
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

        const { results: firstTouchStats } = await env.DB.prepare(
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
        ).all<Record<string, unknown>>();

        const { results: lastTouchStats } = await env.DB.prepare(
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
        ).all<Record<string, unknown>>();

        // Custom referral campaigns + ad-hoc ?ref= values observed in visits
        const { results: savedCampaigns } = await env.DB.prepare(
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
        ).all<Record<string, unknown>>();

        const { results: observedRefs } = await env.DB.prepare(
          `SELECT
            ref_campaign AS slug,
            COUNT(*) AS totalVisits,
            COUNT(DISTINCT visitor_id) AS uniqueVisitors,
            MAX(created_at) AS lastVisitAt
           FROM visits
           WHERE ref_campaign IS NOT NULL AND ref_campaign != ''
           GROUP BY ref_campaign
           ORDER BY totalVisits DESC`
        ).all<Record<string, unknown>>();

        // 6. Device, OS, Browser, and Screen breakdown
        const { results: byDeviceType } = await env.DB.prepare(
          `SELECT device_type AS deviceType, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY device_type
           ORDER BY visits DESC`
        )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: byOs } = await env.DB.prepare(
          `SELECT os, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY os
           ORDER BY visits DESC
           LIMIT 15`
        )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: byBrowser } = await env.DB.prepare(
          `SELECT browser, COALESCE(browser_version, '') AS browserVersion, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS uniqueVisitors
           FROM visits ${whereClause}
           GROUP BY browser, COALESCE(browser_version, '')
           ORDER BY visits DESC
           LIMIT 15`
        )
          .bind(...binds)
          .all<Record<string, unknown>>();

        const { results: byScreen } = await env.DB.prepare(
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

        return jsonResponse({
          kpis: {
            totalVisits,
            uniqueVisitors: Number(kpiRow?.uniqueVisitors || 0),
            totalSessions,
            avgPagesPerSession: totalSessions > 0 ? Number((totalVisits / totalSessions).toFixed(2)) : 0,
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
        });
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
        if (deviceType && deviceType !== 'ALL') {
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
        const { results: visitors } = await env.DB.prepare(
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

        return jsonResponse({ visitors });
      }

      // ----------------------------------------------------------------------
      // GET /api/analytics/admin/visitors/:id — Individual Visitor History
      // ----------------------------------------------------------------------
      if (method === 'GET' && subPath.startsWith('admin/visitors/')) {
        const targetVisitorId = decodeURIComponent(subPath.slice('admin/visitors/'.length));
        const visitor = await env.DB.prepare(
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
          return jsonResponse({ error: 'Visitor not found' }, 404);
        }

        const { results: sessions } = await env.DB.prepare(
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

        const { results: visits } = await env.DB.prepare(
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

        const { results: consents } = await env.DB.prepare(
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

        return jsonResponse({
          visitor,
          sessions,
          visits,
          consents,
        });
      }

      // ----------------------------------------------------------------------
      // POST / DELETE /api/analytics/admin/campaigns — Referral Campaign Manager
      // ----------------------------------------------------------------------
      if (subPath === 'admin/campaigns' && method === 'POST') {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return jsonResponse({ error: 'Invalid JSON payload' }, 400);

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
          return jsonResponse({ error: 'Valid campaign slug is required (e.g. instagram_bio)' }, 400);
        }

        const nowIso = new Date().toISOString();
        const campaignId = crypto.randomUUID();

        await env.DB.prepare(
          `INSERT INTO referral_campaigns (campaign_id, slug, name, channel, target_path, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET
             name = excluded.name,
             channel = excluded.channel,
             target_path = excluded.target_path,
             notes = excluded.notes`
        )
          .bind(campaignId, rawSlug, name, channel, targetPath.startsWith('/') ? targetPath : `/${targetPath}`, notes, nowIso)
          .run();

        return jsonResponse({
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
        });
      }

      if (subPath.startsWith('admin/campaigns/') && method === 'DELETE') {
        const slug = decodeURIComponent(subPath.slice('admin/campaigns/'.length));
        await env.DB.prepare(`DELETE FROM referral_campaigns WHERE slug = ?`).bind(slug).run();
        return jsonResponse({ ok: true, deletedSlug: slug });
      }

      // ----------------------------------------------------------------------
      // POST /api/analytics/admin/purge — Admin Retention & Visitor Purge
      // ----------------------------------------------------------------------
      if (subPath === 'admin/purge' && method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const targetVisitorId = sanitizeOptionalString(body?.visitorId, 64);
        if (targetVisitorId) {
          await env.DB.prepare(`DELETE FROM visits WHERE visitor_id = ?`).bind(targetVisitorId).run();
          await env.DB.prepare(`DELETE FROM sessions WHERE visitor_id = ?`).bind(targetVisitorId).run();
          await env.DB.prepare(`DELETE FROM location_consents WHERE visitor_id = ?`).bind(targetVisitorId).run();
          await env.DB.prepare(`DELETE FROM visitors WHERE visitor_id = ?`).bind(targetVisitorId).run();
          return jsonResponse({ ok: true, purgedVisitorId: targetVisitorId });
        }
        const customDays = sanitizeNumber(body?.retentionDays, 1, 3650) ?? retentionDays;
        const purgedVisits = await enforceRetentionPolicy(env.DB, customDays);
        return jsonResponse({ ok: true, purgedVisits, retentionDays: customDays });
      }
    }

    return jsonResponse({ error: `Unknown analytics endpoint: /api/analytics/${subPath}` }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal analytics server error';
    return jsonResponse({ error: message }, 500);
  }
};
