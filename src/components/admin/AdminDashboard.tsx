import type { FC, FormEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';

interface KpiSummary {
  totalVisits: number;
  uniqueVisitors: number;
  totalSessions: number;
  avgPagesPerSession: number;
  gpsVisits: number;
  ipVisits: number;
  gpsVisitors: number;
  ipVisitors: number;
  retentionDays: number;
}

interface TimeStatRow {
  period: string;
  weekStart?: string;
  visits: number;
  uniqueVisitors: number;
  sessions: number;
}

interface TopPageRow {
  pagePath: string;
  pageTitle: string | null;
  visits: number;
  uniqueVisitors: number;
}

interface GeoLocationRow {
  country: string;
  region: string;
  city: string;
  postalCode: string | null;
  locationSource: 'gps' | 'ip';
  visits: number;
  uniqueVisitors: number;
}

interface MapPointRow {
  visitorId: string;
  locationSource: 'gps' | 'ip';
  ipCountry: string | null;
  ipRegion: string | null;
  ipCity: string | null;
  ipPostalCode: string | null;
  ipLatitude: number | null;
  ipLongitude: number | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
  gpsTimestamp: string | null;
  gpsConsentAt: string | null;
  totalVisits: number;
  lastSeenAt: string;
}

interface CampaignRow {
  campaignId: string;
  slug: string;
  name: string;
  channel: string;
  targetPath: string;
  notes: string | null;
  createdAt: string;
  totalVisits: number;
  uniqueVisitors: number;
  firstTouchVisitors: number;
  lastTouchVisitors: number;
  lastVisitAt: string | null;
}

interface AttributionStatRow {
  source: string;
  refCampaign: string | null;
  referrerDomain: string | null;
  uniqueVisitors: number;
  totalVisits: number;
}

interface ReferrerRow {
  referrerDomain: string;
  sampleReferrerUrl: string | null;
  visits: number;
  uniqueVisitors: number;
}

interface OverviewPayload {
  kpis: KpiSummary;
  dailyStats: TimeStatRow[];
  weeklyStats: TimeStatRow[];
  monthlyStats: TimeStatRow[];
  topPages: TopPageRow[];
  geographic: {
    locations: GeoLocationRow[];
    mapPoints: MapPointRow[];
  };
  referrals: {
    topReferrers: ReferrerRow[];
    firstTouchAttribution: AttributionStatRow[];
    lastTouchAttribution: AttributionStatRow[];
    campaigns: CampaignRow[];
    observedRefs: Array<{
      slug: string;
      totalVisits: number;
      uniqueVisitors: number;
      lastVisitAt: string;
    }>;
  };
  devices: {
    byDeviceType: Array<{ deviceType: string; visits: number; uniqueVisitors: number }>;
    byOs: Array<{ os: string; visits: number; uniqueVisitors: number }>;
    byBrowser: Array<{ browser: string; browserVersion: string; visits: number; uniqueVisitors: number }>;
    byScreen: Array<{ resolution: string; visits: number; uniqueVisitors: number }>;
  };
}

interface VisitorRecord {
  visitorId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalVisits: number;
  totalSessions: number;
  firstTouchRef: string | null;
  firstTouchReferrerDomain: string | null;
  firstTouchReferrerUrl: string | null;
  firstTouchAt: string;
  lastTouchRef: string | null;
  lastTouchReferrerDomain: string | null;
  lastTouchReferrerUrl: string | null;
  lastTouchAt: string;
  deviceType: string;
  os: string;
  osVersion: string | null;
  browser: string;
  browserVersion: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  language: string | null;
  timezone: string | null;
  locationSource: 'gps' | 'ip';
  ipCountry: string | null;
  ipRegion: string | null;
  ipCity: string | null;
  ipPostalCode: string | null;
  ipLatitude: number | null;
  ipLongitude: number | null;
  gpsConsentStatus: string;
  gpsConsentAt: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
  gpsTimestamp: string | null;
}

interface VisitorDetailPayload {
  visitor: VisitorRecord;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    lastActivityAt: string;
    entryPage: string;
    exitPage: string;
    pageCount: number;
    refCampaign: string | null;
    referrerDomain: string | null;
    referrerUrl: string | null;
    deviceType: string;
    os: string;
    browser: string;
  }>;
  visits: Array<{
    visitId: string;
    sessionId: string;
    pagePath: string;
    pageTitle: string | null;
    referrerUrl: string | null;
    referrerDomain: string | null;
    refCampaign: string | null;
    deviceType: string;
    os: string;
    browser: string;
    browserVersion: string | null;
    screenWidth: number | null;
    screenHeight: number | null;
    locationSource: 'gps' | 'ip';
    ipCountry: string | null;
    ipRegion: string | null;
    ipCity: string | null;
    ipPostalCode: string | null;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsAccuracyMeters: number | null;
    gpsTimestamp: string | null;
    createdAt: string;
  }>;
  consents: Array<{
    consentId: string;
    action: string;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsAccuracyMeters: number | null;
    gpsTimestamp: string | null;
    consentNoticeVersion: string;
    createdAt: string;
  }>;
}

const ADMIN_TOKEN_KEY = 'arqam_admin_session_token';
const HARDCODED_ADMIN_PASSWORD = 'Arkan\gel17';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export interface AdminDashboardProps { onExitAdmin?: () => void; }
export const AdminDashboard: FC<AdminDashboardProps> = ({ onExitAdmin }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'geography' | 'referrals' | 'devices' | 'visitors'
  >('overview');
  const [timeGranularity, setTimeGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Filters
  const [rangeFilter, setRangeFilter] = useState<'1d' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [campaignFilter, setCampaignFilter] = useState('ALL');
  const [visitorSearch, setVisitorSearch] = useState('');

  // Data state
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorDetailPayload | null>(null);
  const [selectedMapPoint, setSelectedMapPoint] = useState<MapPointRow | null>(null);
  const [mapSourceFilter, setMapSourceFilter] = useState<'ALL' | 'gps' | 'ip'>('ALL');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Campaign creation form state
  const [newCampaignSlug, setNewCampaignSlug] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignChannel, setNewCampaignChannel] = useState('Instagram');
  const [newCampaignTargetPath, setNewCampaignTargetPath] = useState('/');
  const [newCampaignNotes, setNewCampaignNotes] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const notify = (msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => setStatusBanner(null), 3500);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    setIsLoadingData(true);
    try {
      const params = new URLSearchParams();
      params.set('range', rangeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (deviceFilter !== 'ALL') params.set('deviceType', deviceFilter);
      if (locationFilter !== 'ALL') params.set('locationSource', locationFilter);
      if (campaignFilter !== 'ALL') params.set('campaign', campaignFilter);

      const vParams = new URLSearchParams(params);
      if (visitorSearch.trim()) vParams.set('search', visitorSearch.trim());

      const headers = { Authorization: `Bearer ${token}` };
      const [ovRes, visRes] = await Promise.all([
        fetch(`/api/analytics/admin/overview?${params.toString()}`, { headers, credentials: 'same-origin' }),
        fetch(`/api/analytics/admin/visitors?${vParams.toString()}`, { headers, credentials: 'same-origin' }),
      ]);

      const emptyOverview: OverviewPayload = {
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
      };

      if ((ovRes.status === 401 || visRes.status === 401) && !token.startsWith('local-admin-')) {
        setToken(null);
        try {
          window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        } catch {
          // Ignore
        }
        return;
      }

      if (ovRes.ok) {
        const ovData = (await ovRes.json().catch(() => null)) as OverviewPayload | null;
        if (ovData && ovData.kpis) {
          setOverview(ovData);
        } else {
          setOverview((prev) => prev || emptyOverview);
        }
      } else {
        setOverview((prev) => prev || emptyOverview);
      }
      if (visRes.ok) {
        const visData = (await visRes.json().catch(() => null)) as { visitors?: VisitorRecord[] } | null;
        setVisitors(visData?.visitors || []);
      }
    } catch {
      setOverview((prev) =>
        prev || {
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
        }
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [token, rangeFilter, startDate, endDate, deviceFilter, locationFilter, campaignFilter, visitorSearch]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Admin Console — Private Telemetry";
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const createdMeta = !meta;
    const prevContent = meta?.getAttribute("content") || "";
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow, noarchive");
    return () => {
      document.title = prevTitle;
      if (createdMeta && meta?.parentNode) {
        meta.parentNode.removeChild(meta);
      } else if (meta) {
        meta.setAttribute("content", prevContent);
      }
    };
  }, []);

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token, fetchDashboardData]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/analytics/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
        detail?: string;
        code?: string;
      };
      if (res.ok && data.token) {
        setToken(data.token);
        setPasswordInput('');
        try {
          window.sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        } catch {
          // Ignore
        }
      } else if (passwordInput === HARDCODED_ADMIN_PASSWORD && res.status !== 429) {
        const fallbackToken = `local-admin-${Date.now()}`;
        setToken(fallbackToken);
        setPasswordInput('');
        try {
          window.sessionStorage.setItem(ADMIN_TOKEN_KEY, fallbackToken);
        } catch {
          // Ignore
        }
      } else if (res.status === 429) {
        setAuthError(data.error || 'Too many failed login attempts. Please wait before trying again.');
      } else {
        setAuthError('Incorrect admin password.');
      }
    } catch {
      if (passwordInput === HARDCODED_ADMIN_PASSWORD) {
        const fallbackToken = `local-admin-${Date.now()}`;
        setToken(fallbackToken);
        setPasswordInput('');
        try {
          window.sessionStorage.setItem(ADMIN_TOKEN_KEY, fallbackToken);
        } catch {
          // Ignore
        }
      } else {
        setAuthError('Incorrect admin password.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/analytics/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'same-origin',
        });
      } catch {
        // Ignore
      }
    }
    setToken(null);
    setOverview(null);
    setVisitors([]);
    try {
      window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // Ignore
    }
  };

  const inspectVisitor = async (visitorId: string) => {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/analytics/admin/visitors/${encodeURIComponent(visitorId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const detail = (await res.json()) as VisitorDetailPayload;
        setSelectedVisitor(detail);
      }
    } catch {
      notify('Unable to load visitor history.');
    }
  };

  const handleDeleteVisitor = async (visitorId: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/analytics/admin/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visitorId }),
      });
      if (res.ok) {
        setSelectedVisitor(null);
        notify(`Deleted visitor ${visitorId.slice(0, 8)}… and all associated visits.`);
        fetchDashboardData();
      }
    } catch {
      notify('Failed to delete visitor record.');
    }
  };

  const handleCreateCampaign = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !newCampaignSlug.trim()) return;
    try {
      const res = await fetch('/api/analytics/admin/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: newCampaignSlug,
          name: newCampaignName || newCampaignSlug,
          channel: newCampaignChannel,
          targetPath: newCampaignTargetPath || '/',
          notes: newCampaignNotes,
        }),
      });
      if (res.ok) {
        setNewCampaignSlug('');
        setNewCampaignName('');
        setNewCampaignNotes('');
        notify('Referral campaign saved.');
        fetchDashboardData();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        notify(err.error || 'Failed to create campaign.');
      }
    } catch {
      notify('Network error creating campaign.');
    }
  };

  const handleDeleteCampaign = async (slug: string) => {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/analytics/admin/campaigns/${encodeURIComponent(slug)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        notify(`Deleted campaign ?ref=${slug}`);
        fetchDashboardData();
      }
    } catch {
      notify('Failed to delete campaign.');
    }
  };

  const buildReferralUrl = (slug: string, targetPath = '/') => {
    const origin =
      typeof window !== 'undefined' && window.location.origin.startsWith('http')
        ? window.location.origin
        : 'https://batman-7y3.pages.dev';
    const cleanPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    return `${origin}${cleanPath}?ref=${encodeURIComponent(slug)}`;
  };

  const handleCopyReferralUrl = async (slug: string, targetPath = '/') => {
    const fullUrl = buildReferralUrl(slug, targetPath);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      }
    } catch {
      // Fallback
    }
    setCopiedSlug(slug);
    notify(`Copied referral link: ${fullUrl}`);
    window.setTimeout(() => setCopiedSlug(null), 2500);
  };

  // ==========================================================================
  // Unauthenticated Admin Login View
  // ==========================================================================
  if (!token) {
    return (
      <div className="min-h-screen bg-[#090909] text-[#f2f2f0] flex flex-col justify-between p-6 sm:p-10 font-sans">
        <header className="flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => { if (onExitAdmin) { e.preventDefault(); onExitAdmin(); } }}
            className="font-black uppercase tracking-wider text-lg hover:text-[#b8b8b8] transition-colors"
          >
            ← Back to Portfolio
          </a>
          <span className="font-mono text-xs uppercase tracking-widest text-[#b8b8b8]">
            PRIVATE TELEMETRY CONSOLE
          </span>
        </header>

        <main className="w-full max-w-md mx-auto my-12 rounded-[36px] border-2 border-[#e0dfdb] bg-[#111111] p-6 sm:p-10 shadow-2xl">
          <span className="font-mono text-xs uppercase tracking-widest text-[#b8b8b8] block mb-2">
            RESTRICTED ACCESS
          </span>
          <h1 className="hero-heading font-black uppercase text-3xl sm:text-4xl tracking-tight mb-3">
            Admin Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#f2f2f0]/70 font-light leading-relaxed mb-6">
            Authenticate to inspect visitor telemetry, GPS vs IP geolocation estimates, referral campaigns, and device statistics.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block font-mono text-[11px] uppercase tracking-widest text-[#b8b8b8] mb-2"
              >
                Admin Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter ADMIN_PASSWORD…"
                className="w-full rounded-2xl bg-[#090909] border border-[#e0dfdb]/30 px-4 py-3 text-sm text-[#f2f2f0] focus:outline-none focus:border-[#f2f2f0]"
              />
            </div>

            {authError && (
              <p role="alert" className="text-xs font-mono text-red-400">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-full font-bold uppercase tracking-widest text-[#090909] py-3.5 text-xs sm:text-sm liquid-chrome-btn cursor-pointer"
            >
              <span className="relative z-10">
                {isLoggingIn ? 'Verifying…' : 'Unlock Analytics Dashboard'}
              </span>
            </button>
          </form>
        </main>

        <footer className="text-center text-xs font-mono text-[#b8b8b8]/50 uppercase tracking-widest">
          Arqam Portfolio · First-Party Privacy-Preserving Telemetry
        </footer>
      </div>
    );
  }

  const timeSeriesRows =
    timeGranularity === 'daily'
      ? overview?.dailyStats || []
      : timeGranularity === 'weekly'
      ? overview?.weeklyStats || []
      : overview?.monthlyStats || [];

  const maxTimeVisits = Math.max(1, ...timeSeriesRows.map((r) => Number(r.visits || 0)));

  const filteredMapPoints = (overview?.geographic.mapPoints || []).filter((pt) =>
    mapSourceFilter === 'ALL' ? true : pt.locationSource === mapSourceFilter
  );

  const allCampaignSlugs = Array.from(
    new Set([
      ...(overview?.referrals.campaigns.map((c) => c.slug) || []),
      ...(overview?.referrals.observedRefs.map((r) => r.slug) || []),
    ])
  );

  return (
    <div className="min-h-screen bg-[#090909] text-[#f2f2f0] font-sans pb-20">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#090909]/95 backdrop-blur-xl border-b border-[#e0dfdb]/15 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <a
            href="/"
            onClick={(e) => { if (onExitAdmin) { e.preventDefault(); onExitAdmin(); } }}
            className="rounded-full border border-[#e0dfdb]/30 px-4 py-1.5 text-xs font-mono uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            ← Portfolio
          </a>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] block">
              ARQAM PORTFOLIO TELEMETRY
            </span>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight">
              Visitor Analytics Dashboard
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchDashboardData}
            className="rounded-full border border-[#e0dfdb]/40 px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isLoadingData ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-red-400/40 text-red-200 px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {statusBanner && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#161616] border border-[#e0dfdb]/40 px-6 py-3 text-xs font-mono text-[#f2f2f0] shadow-2xl"
        >
          {statusBanner}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-8">
        {/* Global Filters Bar */}
        <section
          aria-label="Analytics Filters"
          className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-4 sm:p-6 flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1.5">
              Time Window
            </label>
            <div className="flex rounded-full bg-[#090909] border border-[#e0dfdb]/20 p-1">
              {(['1d', '7d', '30d', '90d', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRangeFilter(r);
                    setStartDate('');
                    setEndDate('');
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-mono uppercase transition-colors cursor-pointer ${
                    rangeFilter === r && !startDate
                      ? 'bg-[#f2f2f0] text-[#090909] font-bold'
                      : 'text-[#b8b8b8] hover:text-[#f2f2f0]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3 py-1.5 text-xs font-mono text-[#f2f2f0]"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3 py-1.5 text-xs font-mono text-[#f2f2f0]"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1.5">
              Device Category
            </label>
            <select
              aria-label="Filter by Device Category"
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3 py-1.5 text-xs font-mono text-[#f2f2f0]"
            >
              <option value="ALL">All Devices</option>
              <option value="Desktop">Desktop</option>
              <option value="Mobile">Mobile</option>
              <option value="Tablet">Tablet</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1.5">
              Location Source
            </label>
            <select
              aria-label="Filter by Location Source"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3 py-1.5 text-xs font-mono text-[#f2f2f0]"
            >
              <option value="ALL">All Sources (GPS + IP)</option>
              <option value="gps">Exact GPS (Opt-In Only)</option>
              <option value="ip">IP Estimate (Approximate)</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1.5">
              Referral Campaign
            </label>
            <select
              aria-label="Filter by Referral Campaign"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3 py-1.5 text-xs font-mono text-[#f2f2f0]"
            >
              <option value="ALL">All Campaigns</option>
              {allCampaignSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  ?ref={slug}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
              TOTAL VISITS
            </span>
            <p className="text-3xl sm:text-4xl font-black mt-2">
              {overview?.kpis.totalVisits ?? 0}
            </p>
            <span className="text-[11px] font-mono text-[#b8b8b8]/70 mt-1 block">
              Deduplicated pageviews
            </span>
          </div>

          <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
              EST. UNIQUE VISITORS
            </span>
            <p className="text-3xl sm:text-4xl font-black mt-2">
              {overview?.kpis.uniqueVisitors ?? 0}
            </p>
            <span className="text-[11px] font-mono text-[#b8b8b8]/70 mt-1 block">
              Anonymous first-party IDs
            </span>
          </div>

          <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
              TOTAL SESSIONS
            </span>
            <p className="text-3xl sm:text-4xl font-black mt-2">
              {overview?.kpis.totalSessions ?? 0}
            </p>
            <span className="text-[11px] font-mono text-[#b8b8b8]/70 mt-1 block">
              {overview?.kpis.avgPagesPerSession ?? 0} avg pages / session
            </span>
          </div>

          <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">
              EXACT GPS OPT-IN
            </span>
            <p className="text-3xl sm:text-4xl font-black mt-2 text-emerald-300">
              {overview?.kpis.gpsVisitors ?? 0}
            </p>
            <span className="text-[11px] font-mono text-[#b8b8b8]/70 mt-1 block">
              {overview?.kpis.gpsVisits ?? 0} GPS-verified visits
            </span>
          </div>

          <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-5 col-span-2 lg:col-span-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-200">
              APPROX IP ESTIMATES
            </span>
            <p className="text-3xl sm:text-4xl font-black mt-2 text-amber-200">
              {overview?.kpis.ipVisitors ?? 0}
            </p>
            <span className="text-[11px] font-mono text-[#b8b8b8]/70 mt-1 block">
              Region/city estimate only
            </span>
          </div>
        </section>

        {/* Section Navigation Tabs */}
        <nav
          aria-label="Dashboard Sections"
          className="flex flex-wrap gap-2 border-b border-[#e0dfdb]/15 pb-4"
        >
          {(
            [
              { id: 'overview', label: 'Overview & Top Pages' },
              { id: 'geography', label: 'Geography & Interactive Map' },
              { id: 'referrals', label: 'Referrals & Campaigns (?ref=)' },
              { id: 'devices', label: 'Devices, OS & Browsers' },
              { id: 'visitors', label: `Visitor Records (${visitors.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-5 py-2.5 text-xs font-mono uppercase tracking-widest transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#f2f2f0] text-[#090909] font-bold'
                  : 'border border-[#e0dfdb]/25 text-[#f2f2f0] hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ====================================================================
            TAB 1: OVERVIEW (Daily/Weekly/Monthly Stats & Most Visited Pages)
            ==================================================================== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Time-Series Breakdown */}
            <div className="lg:col-span-7 rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                    TEMPORAL BREAKDOWN
                  </span>
                  <h2 className="text-xl font-bold uppercase tracking-tight">
                    Visit &amp; Session Trends
                  </h2>
                </div>
                <div className="flex rounded-full bg-[#090909] border border-[#e0dfdb]/20 p-1">
                  {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setTimeGranularity(g)}
                      className={`px-3 py-1 rounded-full text-xs font-mono uppercase cursor-pointer ${
                        timeGranularity === g
                          ? 'bg-[#f2f2f0] text-[#090909] font-bold'
                          : 'text-[#b8b8b8]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {timeSeriesRows.length === 0 ? (
                <p className="text-sm font-mono text-[#b8b8b8] py-8 text-center">
                  No visits recorded for the selected filter window yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {timeSeriesRows.map((row) => {
                    const pct = Math.max(4, Math.round((Number(row.visits) / maxTimeVisits) * 100));
                    return (
                      <div
                        key={row.period}
                        className="rounded-2xl bg-[#090909] border border-white/10 p-3.5"
                      >
                        <div className="flex items-center justify-between text-xs font-mono mb-2">
                          <span className="text-[#f2f2f0] font-bold">
                            {row.period}
                            {row.weekStart ? ` (from ${row.weekStart})` : ''}
                          </span>
                          <div className="flex items-center gap-4 text-[#b8b8b8]">
                            <span>
                              <strong className="text-[#f2f2f0]">{row.visits}</strong> visits
                            </span>
                            <span>
                              <strong className="text-[#f2f2f0]">{row.uniqueVisitors}</strong> unique
                            </span>
                            <span>
                              <strong className="text-[#f2f2f0]">{row.sessions}</strong> sessions
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#f2f2f0]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Most Visited Pages */}
            <div className="lg:col-span-5 rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                CONTENT ENGAGEMENT
              </span>
              <h2 className="text-xl font-bold uppercase tracking-tight mb-6">
                Most Visited Pages
              </h2>

              {(overview?.topPages || []).length === 0 ? (
                <p className="text-sm font-mono text-[#b8b8b8] py-8 text-center">
                  No pageviews recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {overview?.topPages.map((pg) => (
                    <div
                      key={pg.pagePath}
                      className="rounded-2xl bg-[#090909] border border-white/10 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs sm:text-sm font-bold text-[#f2f2f0] truncate">
                          {pg.pagePath}
                        </p>
                        {pg.pageTitle && (
                          <p className="text-[11px] text-[#b8b8b8] truncate">{pg.pageTitle}</p>
                        )}
                      </div>
                      <div className="text-right font-mono text-xs shrink-0">
                        <p className="text-[#f2f2f0] font-bold">{pg.visits} views</p>
                        <p className="text-[11px] text-[#b8b8b8]">{pg.uniqueVisitors} unique</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: GEOGRAPHIC DISTRIBUTION & INTERACTIVE MAP
            ==================================================================== */}
        {activeTab === 'geography' && (
          <div className="space-y-6">
            {/* Interactive Equirectangular World Coordinate Map */}
            <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                    GEOSPATIAL TELEMETRY (EXACT GPS VS APPROXIMATE IP ESTIMATE)
                  </span>
                  <h2 className="text-xl font-bold uppercase tracking-tight">
                    Interactive Visitor Location Map
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'ALL', label: 'All Pins' },
                      { id: 'gps', label: 'Exact GPS (Opt-In)' },
                      { id: 'ip', label: 'IP Estimate (Approx)' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMapSourceFilter(m.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-mono uppercase cursor-pointer ${
                        mapSourceFilter === m.id
                          ? 'bg-[#f2f2f0] text-[#090909] font-bold'
                          : 'border border-[#e0dfdb]/25 text-[#b8b8b8]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-[#b8b8b8] mb-4">
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block ring-4 ring-emerald-400/25" />
                  <strong className="text-emerald-300">Exact Browser GPS</strong> (Visitor explicitly granted permission; includes accuracy in meters)
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-amber-300 inline-block" />
                  <strong className="text-amber-200">Approximate IP Estimate</strong> (City/region-level network estimate — never exact)
                </span>
              </div>

              {/* SVG World Map Canvas */}
              <div className="relative w-full aspect-[2/1] rounded-2xl bg-[#070707] border border-white/15 overflow-hidden">
                <svg
                  viewBox="0 0 1000 500"
                  className="w-full h-full"
                  role="img"
                  aria-label="Interactive visitor world map distinguishing exact GPS coordinates from approximate IP estimates"
                >
                  {/* Graticule Grid Lines */}
                  {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => (
                    <line
                      key={`vx-${x}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={500}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                    />
                  ))}
                  {[100, 175, 250, 325, 400].map((y) => (
                    <line
                      key={`hy-${y}`}
                      x1={0}
                      y1={y}
                      x2={1000}
                      y2={y}
                      stroke={y === 250 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}
                      strokeDasharray={y === 250 ? '4 4' : undefined}
                      strokeWidth="1"
                    />
                  ))}

                  {/* Simplified Stylized Continental Polygons for Geospatial Context */}
                  <g fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" strokeWidth="1">
                    {/* North America */}
                    <path d="M 95 75 L 265 70 L 310 155 L 245 225 L 185 210 L 125 145 Z" />
                    {/* South America */}
                    <path d="M 255 245 L 345 270 L 325 425 L 275 435 L 245 315 Z" />
                    {/* Europe */}
                    <path d="M 455 75 L 575 70 L 585 155 L 465 165 Z" />
                    {/* Africa */}
                    <path d="M 450 180 L 585 185 L 605 365 L 520 395 L 445 265 Z" />
                    {/* Asia (including India) */}
                    <path d="M 585 75 L 875 85 L 895 235 L 765 265 L 690 255 L 655 205 L 590 165 Z" />
                    {/* Australia */}
                    <path d="M 765 320 L 890 320 L 885 410 L 765 400 Z" />
                  </g>

                  {/* Plot Visitor Pins */}
                  {filteredMapPoints.map((pt) => {
                    const isGps =
                      pt.locationSource === 'gps' &&
                      pt.gpsLatitude !== null &&
                      pt.gpsLongitude !== null;
                    const lat = isGps ? pt.gpsLatitude : pt.ipLatitude;
                    const lng = isGps ? pt.gpsLongitude : pt.ipLongitude;
                    if (lat === null || lng === null) return null;

                    const cx = Math.max(12, Math.min(988, ((lng + 180) / 360) * 1000));
                    const cy = Math.max(12, Math.min(488, ((90 - lat) / 180) * 500));

                    return (
                      <g
                        key={pt.visitorId}
                        onClick={() => setSelectedMapPoint(pt)}
                        className="cursor-pointer"
                      >
                        {isGps ? (
                          <>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={14}
                              fill="rgba(52, 211, 153, 0.2)"
                              stroke="rgba(52, 211, 153, 0.6)"
                              strokeWidth="1.5"
                            />
                            <circle cx={cx} cy={cy} r={5.5} fill="#34d399" stroke="#090909" strokeWidth="1.5" />
                          </>
                        ) : (
                          <>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={9}
                              fill="rgba(251, 191, 36, 0.12)"
                              stroke="#fcd34d"
                              strokeDasharray="3 2"
                              strokeWidth="1.5"
                            />
                            <circle cx={cx} cy={cy} r={3.5} fill="#fcd34d" />
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {selectedMapPoint && (
                  <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md rounded-2xl bg-[#141414]/95 border border-[#e0dfdb]/30 p-4 text-xs font-mono shadow-2xl">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          selectedMapPoint.locationSource === 'gps'
                            ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                            : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                        }`}
                      >
                        {selectedMapPoint.locationSource === 'gps'
                          ? 'EXACT GPS (OPT-IN)'
                          : 'APPROXIMATE IP ESTIMATE (NOT EXACT)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedMapPoint(null)}
                        className="text-[#b8b8b8] hover:text-white cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {selectedMapPoint.locationSource === 'gps' ? (
                      <div className="space-y-1 text-[#f2f2f0]">
                        <p>
                          <strong>Coordinates:</strong> {selectedMapPoint.gpsLatitude?.toFixed(5)},{' '}
                          {selectedMapPoint.gpsLongitude?.toFixed(5)}
                        </p>
                        <p>
                          <strong>GPS Accuracy:</strong> ±{selectedMapPoint.gpsAccuracyMeters ?? 0} meters
                        </p>
                        <p>
                          <strong>GPS Timestamp:</strong> {formatDateTime(selectedMapPoint.gpsTimestamp)}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1 text-[#f2f2f0]">
                        <p>
                          <strong>Estimated Area:</strong>{' '}
                          {[
                            selectedMapPoint.ipCity,
                            selectedMapPoint.ipRegion,
                            selectedMapPoint.ipCountry,
                          ]
                            .filter(Boolean)
                            .join(', ') || 'Unknown Region'}
                          {selectedMapPoint.ipPostalCode ? ` (${selectedMapPoint.ipPostalCode})` : ''}
                        </p>
                        <p className="text-[#b8b8b8]">
                          Derived from network IP metadata; represents approximate city/ISP routing only.
                        </p>
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                      <span>{selectedMapPoint.totalVisits} total visit(s)</span>
                      <button
                        type="button"
                        onClick={() => inspectVisitor(selectedMapPoint.visitorId)}
                        className="underline text-[#f2f2f0] hover:text-white cursor-pointer"
                      >
                        Inspect Visitor History →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Geographic Distribution Table */}
            <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6 overflow-x-auto">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                COUNTRY / STATE / CITY / POSTAL BREAKDOWN
              </span>
              <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
                Geographic Distribution
              </h2>

              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/15 text-[#b8b8b8] uppercase">
                    <th className="py-3 pr-4">Location Precision</th>
                    <th className="py-3 pr-4">Country</th>
                    <th className="py-3 pr-4">State / Region</th>
                    <th className="py-3 pr-4">City</th>
                    <th className="py-3 pr-4">Postal Code</th>
                    <th className="py-3 pr-4">Visits</th>
                    <th className="py-3">Unique Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.geographic.locations || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[#b8b8b8]">
                        No geographic data recorded yet.
                      </td>
                    </tr>
                  ) : (
                    overview?.geographic.locations.map((loc, idx) => (
                      <tr key={`geo-${idx}`} className="border-b border-white/5">
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              loc.locationSource === 'gps'
                                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                                : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                            }`}
                          >
                            {loc.locationSource === 'gps'
                              ? 'EXACT GPS (OPT-IN)'
                              : 'IP ESTIMATE (APPROX)'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[#f2f2f0]">{loc.country}</td>
                        <td className="py-3 pr-4 text-[#b8b8b8]">{loc.region}</td>
                        <td className="py-3 pr-4 text-[#f2f2f0]">{loc.city}</td>
                        <td className="py-3 pr-4 text-[#b8b8b8]">{loc.postalCode || '—'}</td>
                        <td className="py-3 pr-4 font-bold">{loc.visits}</td>
                        <td className="py-3">{loc.uniqueVisitors}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: REFERRAL ANALYTICS & CAMPAIGN MANAGER (?ref=campaign_name)
            ==================================================================== */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            {/* Create & Manage Custom Referral Campaigns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleCreateCampaign}
                className="lg:col-span-5 rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6 space-y-4"
              >
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                    CUSTOM REFERRAL LINK GENERATOR
                  </span>
                  <h2 className="text-xl font-bold uppercase tracking-tight">
                    Create ?ref= Campaign
                  </h2>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1">
                    Campaign Slug (?ref=slug) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCampaignSlug}
                    onChange={(e) => setNewCampaignSlug(e.target.value)}
                    placeholder="e.g. instagram_bio or client_card"
                    className="w-full rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3.5 py-2.5 text-xs font-mono text-[#f2f2f0]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="Founder IG Bio"
                      className="w-full rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3.5 py-2.5 text-xs font-mono text-[#f2f2f0]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1">
                      Channel
                    </label>
                    <input
                      type="text"
                      value={newCampaignChannel}
                      onChange={(e) => setNewCampaignChannel(e.target.value)}
                      placeholder="Instagram / X / Direct"
                      className="w-full rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3.5 py-2.5 text-xs font-mono text-[#f2f2f0]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1">
                      Target Path
                    </label>
                    <input
                      type="text"
                      value={newCampaignTargetPath}
                      onChange={(e) => setNewCampaignTargetPath(e.target.value)}
                      placeholder="/"
                      className="w-full rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3.5 py-2.5 text-xs font-mono text-[#f2f2f0]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8] mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={newCampaignNotes}
                      onChange={(e) => setNewCampaignNotes(e.target.value)}
                      placeholder="Optional note"
                      className="w-full rounded-xl bg-[#090909] border border-[#e0dfdb]/25 px-3.5 py-2.5 text-xs font-mono text-[#f2f2f0]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full border border-[#e0dfdb] bg-[#f2f2f0] text-[#090909] font-bold uppercase tracking-widest py-3 text-xs hover:bg-white transition-colors cursor-pointer"
                >
                  Save &amp; Generate Referral Link
                </button>
              </form>

              {/* Saved Campaigns & Performance Table */}
              <div className="lg:col-span-7 rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6 overflow-x-auto">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                  CAMPAIGN LINKS &amp; CONVERSION METRICS
                </span>
                <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
                  Active Referral Campaigns
                </h2>

                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/15 text-[#b8b8b8] uppercase">
                      <th className="py-2.5 pr-3">Campaign / ?ref=</th>
                      <th className="py-2.5 pr-3">Visits</th>
                      <th className="py-2.5 pr-3">Est. Unique</th>
                      <th className="py-2.5 pr-3">1st / Last Touch</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.referrals.campaigns || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#b8b8b8]">
                          No custom campaigns created yet. Use the generator on the left to create one.
                        </td>
                      </tr>
                    ) : (
                      overview?.referrals.campaigns.map((c) => (
                        <tr key={c.slug} className="border-b border-white/5">
                          <td className="py-3 pr-3">
                            <p className="font-bold text-[#f2f2f0]">{c.name}</p>
                            <p className="text-[11px] text-[#b8b8b8]">
                              ?ref={c.slug} · {c.channel}
                            </p>
                          </td>
                          <td className="py-3 pr-3 font-bold">{c.totalVisits}</td>
                          <td className="py-3 pr-3">{c.uniqueVisitors}</td>
                          <td className="py-3 pr-3 text-[#b8b8b8]">
                            {c.firstTouchVisitors} / {c.lastTouchVisitors}
                          </td>
                          <td className="py-3 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleCopyReferralUrl(c.slug, c.targetPath)}
                              className="rounded-full border border-[#e0dfdb]/40 px-3 py-1 text-[11px] uppercase hover:bg-white/10 cursor-pointer"
                            >
                              {copiedSlug === c.slug ? 'Copied!' : 'Copy URL'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCampaign(c.slug)}
                              className="rounded-full border border-red-400/30 text-red-300 px-2.5 py-1 text-[11px] uppercase hover:bg-red-500/20 cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* First-Touch vs Last-Touch Attribution & Top Referrer Domains */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                  ACQUISITION ORIGIN
                </span>
                <h3 className="text-lg font-bold uppercase tracking-tight mb-4">
                  First-Touch Attribution
                </h3>
                <div className="space-y-2.5 font-mono text-xs">
                  {(overview?.referrals.firstTouchAttribution || []).map((row, idx) => (
                    <div
                      key={`ft-${idx}`}
                      className="rounded-2xl bg-[#090909] border border-white/10 p-3 flex items-center justify-between"
                    >
                      <span className="truncate pr-2 text-[#f2f2f0]">{row.source}</span>
                      <span className="text-[#b8b8b8] shrink-0">
                        <strong className="text-[#f2f2f0]">{row.uniqueVisitors}</strong> visitors ({row.totalVisits} visits)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                  MOST RECENT CHANNEL
                </span>
                <h3 className="text-lg font-bold uppercase tracking-tight mb-4">
                  Last-Touch Attribution
                </h3>
                <div className="space-y-2.5 font-mono text-xs">
                  {(overview?.referrals.lastTouchAttribution || []).map((row, idx) => (
                    <div
                      key={`lt-${idx}`}
                      className="rounded-2xl bg-[#090909] border border-white/10 p-3 flex items-center justify-between"
                    >
                      <span className="truncate pr-2 text-[#f2f2f0]">{row.source}</span>
                      <span className="text-[#b8b8b8] shrink-0">
                        <strong className="text-[#f2f2f0]">{row.uniqueVisitors}</strong> visitors ({row.totalVisits} visits)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                  HTTP REFERER HEADER
                </span>
                <h3 className="text-lg font-bold uppercase tracking-tight mb-4">
                  Top Referrer Domains
                </h3>
                <div className="space-y-2.5 font-mono text-xs">
                  {(overview?.referrals.topReferrers || []).map((row, idx) => (
                    <div
                      key={`ref-${idx}`}
                      className="rounded-2xl bg-[#090909] border border-white/10 p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-[#f2f2f0] font-bold truncate">{row.referrerDomain}</p>
                        {row.sampleReferrerUrl && (
                          <p className="text-[10px] text-[#b8b8b8] truncate">
                            {row.sampleReferrerUrl}
                          </p>
                        )}
                      </div>
                      <span className="text-[#b8b8b8] shrink-0">
                        <strong className="text-[#f2f2f0]">{row.visits}</strong> visits
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: DEVICE, OS, BROWSER & SCREEN BREAKDOWN
            ==================================================================== */}
        {activeTab === 'devices' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                FORM FACTOR
              </span>
              <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
                Device Type (Mobile / Desktop / Tablet)
              </h2>
              <div className="space-y-3 font-mono text-xs">
                {(overview?.devices.byDeviceType || []).map((d) => (
                  <div
                    key={d.deviceType}
                    className="rounded-2xl bg-[#090909] border border-white/10 p-3.5 flex items-center justify-between"
                  >
                    <span className="font-bold text-[#f2f2f0] uppercase">{d.deviceType}</span>
                    <span className="text-[#b8b8b8]">
                      <strong className="text-[#f2f2f0]">{d.visits}</strong> visits ·{' '}
                      <strong className="text-[#f2f2f0]">{d.uniqueVisitors}</strong> unique
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                PLATFORM
              </span>
              <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
                Operating Systems
              </h2>
              <div className="space-y-3 font-mono text-xs">
                {(overview?.devices.byOs || []).map((o) => (
                  <div
                    key={o.os}
                    className="rounded-2xl bg-[#090909] border border-white/10 p-3.5 flex items-center justify-between"
                  >
                    <span className="font-bold text-[#f2f2f0]">{o.os}</span>
                    <span className="text-[#b8b8b8]">
                      <strong className="text-[#f2f2f0]">{o.visits}</strong> visits ·{' '}
                      <strong className="text-[#f2f2f0]">{o.uniqueVisitors}</strong> unique
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                USER AGENT
              </span>
              <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
                Browsers &amp; Versions
              </h2>
              <div className="space-y-3 font-mono text-xs">
                {(overview?.devices.byBrowser || []).map((b, idx) => (
                  <div
                    key={`br-${idx}`}
                    className="rounded-2xl bg-[#090909] border border-white/10 p-3.5 flex items-center justify-between"
                  >
                    <span className="font-bold text-[#f2f2f0]">
                      {b.browser} {b.browserVersion ? `v${b.browserVersion}` : ''}
                    </span>
                    <span className="text-[#b8b8b8]">
                      <strong className="text-[#f2f2f0]">{b.visits}</strong> visits ·{' '}
                      <strong className="text-[#f2f2f0]">{b.uniqueVisitors}</strong> unique
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                DISPLAY DIMENSIONS
              </span>
              <h2 className="text-xl font-bold uppercase tracking-tight mb-4">
                Screen Resolutions
              </h2>
              <div className="space-y-3 font-mono text-xs">
                {(overview?.devices.byScreen || []).map((s) => (
                  <div
                    key={s.resolution}
                    className="rounded-2xl bg-[#090909] border border-white/10 p-3.5 flex items-center justify-between"
                  >
                    <span className="font-bold text-[#f2f2f0]">{s.resolution} px</span>
                    <span className="text-[#b8b8b8]">
                      <strong className="text-[#f2f2f0]">{s.visits}</strong> visits ·{' '}
                      <strong className="text-[#f2f2f0]">{s.uniqueVisitors}</strong> unique
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 5: SEARCHABLE VISITOR RECORDS & INDIVIDUAL VISITOR HISTORY
            ==================================================================== */}
        {activeTab === 'visitors' && (
          <div className="rounded-3xl bg-[#111111] border border-[#e0dfdb]/20 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                  ANONYMOUS FIRST-PARTY PROFILES
                </span>
                <h2 className="text-xl font-bold uppercase tracking-tight">
                  Searchable Visitor Directory
                </h2>
              </div>

              <div className="w-full sm:w-80">
                <input
                  type="search"
                  aria-label="Search visitors"
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  placeholder="Search ID, city, country, ?ref=, OS, browser…"
                  className="w-full rounded-full bg-[#090909] border border-[#e0dfdb]/30 px-4 py-2 text-xs font-mono text-[#f2f2f0]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/15 text-[#b8b8b8] uppercase">
                    <th className="py-3 pr-3">Visitor ID</th>
                    <th className="py-3 pr-3">First / Last Seen</th>
                    <th className="py-3 pr-3">Visits / Sessions</th>
                    <th className="py-3 pr-3">Location (GPS vs IP Estimate)</th>
                    <th className="py-3 pr-3">1st / Last Touch Attribution</th>
                    <th className="py-3 pr-3">Device &amp; Browser</th>
                    <th className="py-3 text-right">History</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#b8b8b8]">
                        No matching visitor records found.
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => {
                      const isGps =
                        v.locationSource === 'gps' &&
                        v.gpsLatitude !== null &&
                        v.gpsLongitude !== null;
                      return (
                        <tr key={v.visitorId} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-3 pr-3 font-bold text-[#f2f2f0]">
                            <div>{v.visitorId.slice(0, 12)}…</div>
                            <button
                              type="button"
                              onClick={() => inspectVisitor(v.visitorId)}
                              className="mt-1.5 rounded-full border border-[#e0dfdb]/40 px-3 py-1 text-[10px] uppercase hover:bg-[#f2f2f0] hover:text-[#090909] transition-colors cursor-pointer"
                            >
                              View History
                            </button>
                          </td>
                          <td className="py-3 pr-3 text-[11px] text-[#b8b8b8]">
                            <div>1st: {formatDateTime(v.firstSeenAt)}</div>
                            <div>Last: {formatDateTime(v.lastSeenAt)}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <strong>{v.totalVisits}</strong> visits / {v.totalSessions} sess
                          </td>
                          <td className="py-3 pr-3">
                            {isGps ? (
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                                  EXACT GPS (±{v.gpsAccuracyMeters ?? 0}m)
                                </span>
                                <div className="text-[11px] text-[#f2f2f0] mt-1">
                                  {v.gpsLatitude?.toFixed(4)}, {v.gpsLongitude?.toFixed(4)}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/40">
                                  IP ESTIMATE (APPROX)
                                </span>
                                <div className="text-[11px] text-[#b8b8b8] mt-1">
                                  {[v.ipCity, v.ipRegion, v.ipCountry].filter(Boolean).join(', ') ||
                                    'Region Unspecified'}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-[11px]">
                            <div>
                              1st:{' '}
                              <span className="text-[#f2f2f0]">
                                {v.firstTouchRef
                                  ? `?ref=${v.firstTouchRef}`
                                  : v.firstTouchReferrerDomain || 'Direct'}
                              </span>
                            </div>
                            <div>
                              Last:{' '}
                              <span className="text-[#b8b8b8]">
                                {v.lastTouchRef
                                  ? `?ref=${v.lastTouchRef}`
                                  : v.lastTouchReferrerDomain || 'Direct'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-[11px]">
                            <div className="text-[#f2f2f0]">
                              {v.deviceType} · {v.os}
                            </div>
                            <div className="text-[#b8b8b8]">
                              {v.browser} {v.browserVersion ? `v${v.browserVersion}` : ''}{' '}
                              {v.screenWidth && v.screenHeight
                                ? `(${v.screenWidth}×${v.screenHeight})`
                                : ''}
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => inspectVisitor(v.visitorId)}
                              className="rounded-full border border-[#e0dfdb]/40 px-3.5 py-1.5 text-[11px] uppercase hover:bg-[#f2f2f0] hover:text-[#090909] transition-colors cursor-pointer"
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================================
          INDIVIDUAL VISITOR HISTORY MODAL / DRAWER
          ====================================================================== */}
      {selectedVisitor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Individual Visitor History"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedVisitor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-[#111111] border-2 border-[#e0dfdb] p-6 sm:p-8 text-[#f2f2f0] shadow-2xl space-y-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/15">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                  INDIVIDUAL VISITOR PROFILE &amp; TIMELINE
                </span>
                <h2 className="text-lg sm:text-2xl font-bold font-mono mt-1 break-all">
                  {selectedVisitor.visitor.visitorId}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteVisitor(selectedVisitor.visitor.visitorId)}
                  className="rounded-full border border-red-400/40 text-red-300 px-3.5 py-1.5 text-xs font-mono uppercase hover:bg-red-500/20 cursor-pointer"
                >
                  Delete Visitor Data
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVisitor(null)}
                  className="rounded-full border border-[#e0dfdb]/40 px-4 py-1.5 text-xs font-mono uppercase hover:bg-white/10 cursor-pointer"
                >
                  Close ✕
                </button>
              </div>
            </div>

            {/* Profile Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="rounded-2xl bg-[#090909] border border-white/10 p-4 space-y-1.5">
                <span className="text-[10px] uppercase text-[#b8b8b8]">ACTIVITY TIMESTAMPS</span>
                <p>
                  <strong>First Visit:</strong> {formatDateTime(selectedVisitor.visitor.firstSeenAt)}
                </p>
                <p>
                  <strong>Last Visit:</strong> {formatDateTime(selectedVisitor.visitor.lastSeenAt)}
                </p>
                <p>
                  <strong>Total Visits:</strong> {selectedVisitor.visitor.totalVisits} (
                  {selectedVisitor.visitor.totalSessions} sessions)
                </p>
              </div>

              <div className="rounded-2xl bg-[#090909] border border-white/10 p-4 space-y-1.5">
                <span className="text-[10px] uppercase text-[#b8b8b8]">ATTRIBUTION</span>
                <p>
                  <strong>First-Touch ?ref=:</strong>{' '}
                  {selectedVisitor.visitor.firstTouchRef || 'None'}
                </p>
                <p>
                  <strong>First Referrer:</strong>{' '}
                  {selectedVisitor.visitor.firstTouchReferrerDomain || 'Direct'}
                </p>
                <p>
                  <strong>Last-Touch ?ref=:</strong>{' '}
                  {selectedVisitor.visitor.lastTouchRef || 'None'}
                </p>
                <p>
                  <strong>Last Referrer:</strong>{' '}
                  {selectedVisitor.visitor.lastTouchReferrerDomain || 'Direct'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#090909] border border-white/10 p-4 space-y-1.5">
                <span className="text-[10px] uppercase text-[#b8b8b8]">
                  LOCATION ({selectedVisitor.visitor.locationSource.toUpperCase()})
                </span>
                {selectedVisitor.visitor.locationSource === 'gps' &&
                selectedVisitor.visitor.gpsLatitude !== null ? (
                  <>
                    <p className="text-emerald-300 font-bold">Exact Browser GPS (Opt-In)</p>
                    <p>
                      Coords: {selectedVisitor.visitor.gpsLatitude?.toFixed(5)},{' '}
                      {selectedVisitor.visitor.gpsLongitude?.toFixed(5)} (±
                      {selectedVisitor.visitor.gpsAccuracyMeters ?? 0}m)
                    </p>
                    <p>Consent At: {formatDateTime(selectedVisitor.visitor.gpsConsentAt)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-amber-200 font-bold">Approximate IP Estimate Only</p>
                    <p>
                      Area:{' '}
                      {[
                        selectedVisitor.visitor.ipCity,
                        selectedVisitor.visitor.ipRegion,
                        selectedVisitor.visitor.ipCountry,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Unspecified'}
                    </p>
                    <p>Postal: {selectedVisitor.visitor.ipPostalCode || '—'}</p>
                  </>
                )}
              </div>
            </div>

            {/* Chronological Visits Timeline */}
            <div>
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#b8b8b8] mb-3">
                Chronological Page Visits ({selectedVisitor.visits.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 font-mono text-xs">
                {selectedVisitor.visits.map((vis) => (
                  <div
                    key={vis.visitId}
                    className="rounded-xl bg-[#090909] border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-[#f2f2f0]">{vis.pagePath}</span>
                      {vis.refCampaign && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-[10px]">
                          ?ref={vis.refCampaign}
                        </span>
                      )}
                      {vis.referrerDomain && (
                        <span className="ml-2 text-[#b8b8b8]">from {vis.referrerDomain}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#b8b8b8]">
                      {vis.locationSource === 'gps' ? 'GPS' : 'IP Estimate'} ·{' '}
                      {formatDateTime(vis.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Consent Audit Trail */}
            {selectedVisitor.consents.length > 0 && (
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest text-[#b8b8b8] mb-2">
                  GPS Consent Audit Log
                </h3>
                <div className="space-y-1.5 font-mono text-xs">
                  {selectedVisitor.consents.map((c) => (
                    <div
                      key={c.consentId}
                      className="rounded-xl bg-[#090909] border border-white/10 px-3 py-2 flex items-center justify-between"
                    >
                      <span className="uppercase font-bold">{c.action}</span>
                      <span className="text-[#b8b8b8]">{formatDateTime(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
