/**
 * Lightweight, privacy-first client-side analytics & attribution tracker.
 * - Uses anonymous first-party UUIDs + server-issued ownership tokens (`visitorToken`).
 * - Preserves first-touch and last-touch ?ref=campaign_name and referrer attribution.
 * - Never requests browser GPS coordinates unless the visitor explicitly clicks opt-in.
 */

export interface AttributionRecord {
  ref: string | null;
  referrerDomain: string | null;
  referrerUrl: string | null;
  timestamp: string;
}

export interface GpsCoordinatesPayload {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: string;
}

export type GpsConsentState = 'unset' | 'granted' | 'denied' | 'withdrawn';

const STORAGE_KEYS = {
  VISITOR_ID: 'arqam_analytics_visitor_id',
  VISITOR_TOKEN: 'arqam_analytics_visitor_token',
  SESSION_ID: 'arqam_analytics_session_id',
  SESSION_TS: 'arqam_analytics_session_ts',
  FIRST_TOUCH: 'arqam_analytics_first_touch',
  LAST_TOUCH: 'arqam_analytics_last_touch',
  GPS_CONSENT: 'arqam_analytics_gps_consent',
  GPS_COORDS: 'arqam_analytics_gps_coords',
  PROMPT_DISMISSED: 'arqam_analytics_prompt_dismissed',
} as const;

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recentSentKeys = new Set<string>();

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeGetLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function safeRemoveLocal(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export function getOrCreateVisitorId(): string {
  let id = safeGetLocal(STORAGE_KEYS.VISITOR_ID);
  if (!id || !UUID_V4_REGEX.test(id)) {
    id = generateUuid();
    safeSetLocal(STORAGE_KEYS.VISITOR_ID, id);
  }
  return id;
}

export function getStoredVisitorToken(): string | null {
  return safeGetLocal(STORAGE_KEYS.VISITOR_TOKEN);
}

export function getOrCreateSessionId(): string {
  const now = Date.now();
  try {
    const existingId = window.sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
    const lastTs = Number(window.sessionStorage.getItem(STORAGE_KEYS.SESSION_TS) || '0');
    if (existingId && UUID_V4_REGEX.test(existingId) && now - lastTs < SESSION_TIMEOUT_MS) {
      window.sessionStorage.setItem(STORAGE_KEYS.SESSION_TS, String(now));
      return existingId;
    }
    const newId = generateUuid();
    window.sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, newId);
    window.sessionStorage.setItem(STORAGE_KEYS.SESSION_TS, String(now));
    return newId;
  } catch {
    return generateUuid();
  }
}

/**
 * Extracts referrer domain and URL safely without capturing any personal/social usernames.
 */
export function parseReferrerInfo(): { referrerDomain: string | null; referrerUrl: string | null } {
  try {
    const rawRef = document.referrer;
    if (!rawRef) return { referrerDomain: null, referrerUrl: null };
    const refUrl = new URL(rawRef);
    if (refUrl.hostname === window.location.hostname) {
      return { referrerDomain: null, referrerUrl: null };
    }
    const cleanDomain = refUrl.hostname.replace(/^www\./i, '').toLowerCase();
    const socialHosts = [
      'instagram.com',
      'x.com',
      'twitter.com',
      'facebook.com',
      't.me',
      'linkedin.com',
      'reddit.com',
    ];
    const isSocial = socialHosts.some((h) => cleanDomain === h || cleanDomain.endsWith(`.${h}`));
    const safeUrl = isSocial
      ? `${refUrl.protocol}//${refUrl.hostname}/`
      : `${refUrl.origin}${refUrl.pathname}`;
    return {
      referrerDomain: cleanDomain,
      referrerUrl: safeUrl.slice(0, 512),
    };
  } catch {
    return { referrerDomain: null, referrerUrl: null };
  }
}

export function parseRefCampaignFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ref') || params.get('utm_campaign') || params.get('source');
    if (!raw) return null;
    const cleaned = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 80);
    return cleaned || null;
  } catch {
    return null;
  }
}

export function resolveAttribution(): {
  currentRef: string | null;
  currentReferrerDomain: string | null;
  currentReferrerUrl: string | null;
  firstTouch: AttributionRecord;
  lastTouch: AttributionRecord;
} {
  const nowIso = new Date().toISOString();
  const currentRef = parseRefCampaignFromUrl();
  const { referrerDomain, referrerUrl } = parseReferrerInfo();

  let firstTouch: AttributionRecord | null = null;
  const rawFirst = safeGetLocal(STORAGE_KEYS.FIRST_TOUCH);
  if (rawFirst) {
    try {
      firstTouch = JSON.parse(rawFirst) as AttributionRecord;
    } catch {
      firstTouch = null;
    }
  }

  if (!firstTouch) {
    firstTouch = {
      ref: currentRef,
      referrerDomain,
      referrerUrl,
      timestamp: nowIso,
    };
    safeSetLocal(STORAGE_KEYS.FIRST_TOUCH, JSON.stringify(firstTouch));
  } else if (!firstTouch.ref && currentRef) {
    firstTouch = {
      ...firstTouch,
      ref: currentRef,
    };
    safeSetLocal(STORAGE_KEYS.FIRST_TOUCH, JSON.stringify(firstTouch));
  }

  let lastTouch: AttributionRecord = {
    ref: currentRef,
    referrerDomain,
    referrerUrl,
    timestamp: nowIso,
  };
  const rawLast = safeGetLocal(STORAGE_KEYS.LAST_TOUCH);
  if (rawLast && !currentRef && !referrerDomain) {
    try {
      lastTouch = JSON.parse(rawLast) as AttributionRecord;
    } catch {
      // Keep current
    }
  } else {
    safeSetLocal(STORAGE_KEYS.LAST_TOUCH, JSON.stringify(lastTouch));
  }

  return {
    currentRef: currentRef || lastTouch.ref,
    currentReferrerDomain: referrerDomain || lastTouch.referrerDomain,
    currentReferrerUrl: referrerUrl || lastTouch.referrerUrl,
    firstTouch,
    lastTouch,
  };
}

export function detectDeviceAndBrowser(): {
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  os: string;
  osVersion: string | null;
  browser: string;
  browserVersion: string | null;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  language: string;
  timezone: string;
} {
  const ua = navigator.userAgent || '';

  const isTablet =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile =
    !isTablet && /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceType: 'Desktop' | 'Mobile' | 'Tablet' = isTablet
    ? 'Tablet'
    : isMobile
    ? 'Mobile'
    : 'Desktop';

  let os = 'Unknown';
  let osVersion: string | null = null;
  if (/Windows NT ([0-9.]+)/i.test(ua)) {
    os = 'Windows';
    const ntVer = RegExp.$1;
    osVersion = ntVer === '10.0' ? '10/11' : ntVer;
  } else if (/Android ([0-9.]+)/i.test(ua)) {
    os = 'Android';
    osVersion = RegExp.$1;
  } else if (/CPU (?:iPhone )?OS ([0-9_]+)/i.test(ua)) {
    os = 'iOS';
    osVersion = RegExp.$1.replace(/_/g, '.');
  } else if (/Mac OS X ([0-9_]+)/i.test(ua)) {
    os = isTablet ? 'iPadOS' : 'macOS';
    osVersion = RegExp.$1.replace(/_/g, '.');
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Unknown';
  let browserVersion: string | null = null;
  if (/EdgA?\/([0-9.]+)/i.test(ua)) {
    browser = 'Edge';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/OPR\/([0-9.]+)/i.test(ua)) {
    browser = 'Opera';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/Firefox\/([0-9.]+)/i.test(ua) || /FxiOS\/([0-9.]+)/i.test(ua)) {
    browser = 'Firefox';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/CriOS\/([0-9.]+)/i.test(ua)) {
    browser = 'Chrome';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/Chrome\/([0-9.]+)/i.test(ua)) {
    browser = 'Chrome';
    browserVersion = RegExp.$1.split('.')[0];
  } else if (/Version\/([0-9.]+).*Safari/i.test(ua)) {
    browser = 'Safari';
    browserVersion = RegExp.$1.split('.')[0];
  }

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timezone = 'UTC';
  }

  return {
    deviceType,
    os,
    osVersion,
    browser,
    browserVersion,
    screenWidth: window.screen?.width || window.innerWidth,
    screenHeight: window.screen?.height || window.innerHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    language: navigator.language || 'en',
    timezone,
  };
}

export function getStoredGpsConsent(): GpsConsentState {
  const val = safeGetLocal(STORAGE_KEYS.GPS_CONSENT);
  if (val === 'granted' || val === 'denied' || val === 'withdrawn') {
    return val;
  }
  return 'unset';
}

export function getStoredGpsCoords(): GpsCoordinatesPayload | null {
  const raw = safeGetLocal(STORAGE_KEYS.GPS_COORDS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GpsCoordinatesPayload;
  } catch {
    return null;
  }
}

export function isLocationPromptDismissed(): boolean {
  return safeGetLocal(STORAGE_KEYS.PROMPT_DISMISSED) === '1';
}

export function setLocationPromptDismissed(dismissed: boolean): void {
  if (dismissed) {
    safeSetLocal(STORAGE_KEYS.PROMPT_DISMISSED, '1');
  } else {
    safeRemoveLocal(STORAGE_KEYS.PROMPT_DISMISSED);
  }
}

function buildVisitorAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredVisitorToken();
  if (token) {
    headers['X-Visitor-Token'] = token;
  }
  return headers;
}

export async function trackPageVisit(customPath?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const pagePath = customPath || `${window.location.pathname}${window.location.hash || ''}`;
  if (pagePath.startsWith('/admin') || pagePath.startsWith('/#admin')) return;

  const visitorId = getOrCreateVisitorId();
  const visitorToken = getStoredVisitorToken();
  const sessionId = getOrCreateSessionId();
  const minuteBucket = new Date().toISOString().slice(0, 16);
  const idempotencyKey = `${visitorId}:${sessionId}:${pagePath}:${minuteBucket}`;

  if (recentSentKeys.has(idempotencyKey)) return;
  recentSentKeys.add(idempotencyKey);

  const attribution = resolveAttribution();
  const device = detectDeviceAndBrowser();
  const consentState = getStoredGpsConsent();
  const storedGps = consentState === 'granted' ? getStoredGpsCoords() : null;

  const payload = {
    visitorId,
    visitorToken,
    sessionId,
    idempotencyKey,
    pagePath,
    pageTitle: document.title,
    referrerUrl: attribution.currentReferrerUrl,
    referrerDomain: attribution.currentReferrerDomain,
    refCampaign: attribution.currentRef,
    firstTouchRef: attribution.firstTouch.ref,
    firstTouchReferrerDomain: attribution.firstTouch.referrerDomain,
    firstTouchReferrerUrl: attribution.firstTouch.referrerUrl,
    ...device,
    gpsLatitude: storedGps?.latitude ?? null,
    gpsLongitude: storedGps?.longitude ?? null,
    gpsAccuracyMeters: storedGps?.accuracyMeters ?? null,
    gpsTimestamp: storedGps?.timestamp ?? null,
  };

  try {
    const res = await fetch('/api/analytics/collect', {
      method: 'POST',
      headers: buildVisitorAuthHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        visitorId?: string;
        sessionId?: string;
        visitorToken?: string;
      } | null;
      if (data?.visitorId && UUID_V4_REGEX.test(data.visitorId)) {
        safeSetLocal(STORAGE_KEYS.VISITOR_ID, data.visitorId);
      }
      if (data?.visitorToken) {
        safeSetLocal(STORAGE_KEYS.VISITOR_TOKEN, data.visitorToken);
      }
    }
  } catch {
    // Fail silently so portfolio UX is never disrupted
  }
}

export async function requestAndRecordGpsLocation(): Promise<{
  ok: boolean;
  coords?: GpsCoordinatesPayload;
  error?: string;
}> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { ok: false, error: 'Geolocation is not supported by this browser.' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: GpsCoordinatesPayload = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracyMeters: Math.max(1, Math.round(pos.coords.accuracy || 10)),
          timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
        };
        safeSetLocal(STORAGE_KEYS.GPS_CONSENT, 'granted');
        safeSetLocal(STORAGE_KEYS.GPS_COORDS, JSON.stringify(coords));
        setLocationPromptDismissed(true);

        const visitorId = getOrCreateVisitorId();
        const visitorToken = getStoredVisitorToken();
        try {
          await fetch('/api/analytics/consent', {
            method: 'POST',
            headers: buildVisitorAuthHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify({
              visitorId,
              visitorToken,
              action: 'granted',
              gpsLatitude: coords.latitude,
              gpsLongitude: coords.longitude,
              gpsAccuracyMeters: coords.accuracyMeters,
              gpsTimestamp: coords.timestamp,
            }),
          });
        } catch {
          // Ignore network error
        }
        resolve({ ok: true, coords });
      },
      async (err) => {
        safeSetLocal(STORAGE_KEYS.GPS_CONSENT, 'denied');
        safeRemoveLocal(STORAGE_KEYS.GPS_COORDS);
        setLocationPromptDismissed(true);

        const visitorId = getOrCreateVisitorId();
        const visitorToken = getStoredVisitorToken();
        try {
          await fetch('/api/analytics/consent', {
            method: 'POST',
            headers: buildVisitorAuthHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify({
              visitorId,
              visitorToken,
              action: 'denied',
            }),
          });
        } catch {
          // Ignore
        }
        resolve({
          ok: false,
          error:
            err.code === 1
              ? 'Browser GPS permission denied. Using approximate IP region estimate instead.'
              : 'Unable to acquire GPS signal. Using approximate IP region estimate instead.',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

export async function declineGpsLocation(): Promise<void> {
  safeSetLocal(STORAGE_KEYS.GPS_CONSENT, 'denied');
  safeRemoveLocal(STORAGE_KEYS.GPS_COORDS);
  setLocationPromptDismissed(true);

  const visitorId = getOrCreateVisitorId();
  const visitorToken = getStoredVisitorToken();
  try {
    await fetch('/api/analytics/consent', {
      method: 'POST',
      headers: buildVisitorAuthHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({
        visitorId,
        visitorToken,
        action: 'denied',
      }),
    });
  } catch {
    // Ignore
  }
}

export async function withdrawGpsConsent(): Promise<{ ok: boolean; message: string }> {
  const visitorId = getOrCreateVisitorId();
  const visitorToken = getStoredVisitorToken();
  safeSetLocal(STORAGE_KEYS.GPS_CONSENT, 'withdrawn');
  safeRemoveLocal(STORAGE_KEYS.GPS_COORDS);

  try {
    const res = await fetch('/api/analytics/privacy', {
      method: 'POST',
      headers: buildVisitorAuthHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({
        visitorId,
        visitorToken,
        action: 'withdraw_gps',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return {
      ok: res.ok,
      message:
        data.message || data.error || 'GPS consent withdrawn and stored GPS coordinates cleared.',
    };
  } catch {
    return {
      ok: true,
      message: 'Local GPS consent withdrawn.',
    };
  }
}

export async function deleteAllVisitorAnalyticsData(): Promise<{ ok: boolean; message: string }> {
  const visitorId = getOrCreateVisitorId();
  const visitorToken = getStoredVisitorToken();
  try {
    const res = await fetch('/api/analytics/privacy', {
      method: 'POST',
      headers: buildVisitorAuthHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({
        visitorId,
        visitorToken,
        action: 'delete_all_data',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };

    if (res.ok) {
      safeRemoveLocal(STORAGE_KEYS.VISITOR_ID);
      safeRemoveLocal(STORAGE_KEYS.VISITOR_TOKEN);
      safeRemoveLocal(STORAGE_KEYS.FIRST_TOUCH);
      safeRemoveLocal(STORAGE_KEYS.LAST_TOUCH);
      safeRemoveLocal(STORAGE_KEYS.GPS_CONSENT);
      safeRemoveLocal(STORAGE_KEYS.GPS_COORDS);
      try {
        window.sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID);
        window.sessionStorage.removeItem(STORAGE_KEYS.SESSION_TS);
      } catch {
        // Ignore
      }
    }

    return {
      ok: res.ok,
      message:
        data.message ||
        data.error ||
        'All visitor, session, and location analytics data for your browser has been deleted.',
    };
  } catch {
    return {
      ok: false,
      message: 'Unable to reach analytics server to complete deletion.',
    };
  }
}
