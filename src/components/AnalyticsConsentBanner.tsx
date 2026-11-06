import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  getStoredGpsConsent,
  getStoredGpsCoords,
  isLocationPromptDismissed,
  requestAndRecordGpsLocation,
  declineGpsLocation,
  withdrawGpsConsent,
  deleteAllVisitorAnalyticsData,
  getOrCreateVisitorId,
  type GpsConsentState,
  type GpsCoordinatesPayload,
} from '../utils/analyticsTracker';

interface AnalyticsConsentBannerProps {
  isOpenModal: boolean;
  onCloseModal: () => void;
}

export const AnalyticsConsentBanner: FC<AnalyticsConsentBannerProps> = ({
  isOpenModal,
  onCloseModal,
}) => {
  const [showFloatingPrompt, setShowFloatingPrompt] = useState(false);
  const [consentState, setConsentState] = useState<GpsConsentState>('unset');
  const [coords, setCoords] = useState<GpsCoordinatesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string>('');

  useEffect(() => {
    const currentConsent = getStoredGpsConsent();
    setConsentState(currentConsent);
    setCoords(getStoredGpsCoords());
    setVisitorId(getOrCreateVisitorId());

    if (currentConsent === 'unset' && !isLocationPromptDismissed()) {
      const timer = window.setTimeout(() => {
        setShowFloatingPrompt(true);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const showTempFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    window.setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleEnableGps = async () => {
    setIsLoading(true);
    const res = await requestAndRecordGpsLocation();
    setIsLoading(false);
    setShowFloatingPrompt(false);
    setConsentState(getStoredGpsConsent());
    setCoords(getStoredGpsCoords());
    if (res.ok && res.coords) {
      showTempFeedback('Location enabled. You can update or withdraw permission anytime in Location Settings.');
    } else if (res.error) {
      showTempFeedback(res.error);
    }
  };

  const handleNotNow = async () => {
    await declineGpsLocation();
    setShowFloatingPrompt(false);
    setConsentState('denied');
    setCoords(null);
  };

  const handleWithdrawGps = async () => {
    setIsLoading(true);
    const res = await withdrawGpsConsent();
    setIsLoading(false);
    setConsentState('withdrawn');
    setCoords(null);
    showTempFeedback(res.message);
  };

  const handleDeleteAllData = async () => {
    setIsLoading(true);
    const res = await deleteAllVisitorAnalyticsData();
    setIsLoading(false);
    setConsentState('unset');
    setCoords(null);
    setVisitorId(getOrCreateVisitorId());
    showTempFeedback(res.message);
  };

  return (
    <>
      {/* 1. Prominent, Non-Blocking Dark Liquid-Mirror Location Permission Card */}
      <AnimatePresence>
        {showFloatingPrompt && !isOpenModal && (
          <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-40 pointer-events-none flex justify-center sm:justify-end">
            <motion.div
              role="dialog"
              aria-label="Turn on location for a better experience"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto relative overflow-hidden w-full max-w-[420px] rounded-[28px] sm:rounded-[32px] bg-gradient-to-b from-[#1e1e1e] via-[#141414] to-[#0b0b0b] border-2 border-[#e0dfdb]/45 p-5 sm:p-6 text-[#f2f2f0] backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.92),0_0_32px_rgba(255,255,255,0.08)]"
            >
              {/* Subtle specular liquid-mirror highlight */}
              <div
                className="absolute inset-0 pointer-events-none opacity-80"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 45%, rgba(255,255,255,0.04) 70%, transparent 100%)',
                }}
              />

              <div className="relative z-10">
                {/* Top Header Row: Location Pin Icon + Optional Badge + Dismiss Button */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#f2f2f0]/10 border border-[#e0dfdb]/35 flex items-center justify-center shrink-0 shadow-inner">
                      <svg
                        className="w-5 h-5 text-[#f2f2f0]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-[#e0dfdb]/25 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[#e0dfdb]">
                      Optional · Location
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNotNow}
                    aria-label="Close location prompt"
                    className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-xs font-mono text-[#b8b8b8] hover:text-white hover:border-white/40 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Friendly Heading & Concise Explanation */}
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#f2f2f0] leading-snug mb-1.5">
                  Turn on location for a better experience
                </h3>
                <p className="text-xs sm:text-sm text-[#f2f2f0]/80 font-light leading-relaxed mb-5">
                  Help us understand where visitors are discovering my portfolio.
                </p>

                {/* Primary & Secondary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleEnableGps}
                    className="flex-1 rounded-full font-bold uppercase tracking-widest text-[#090909] px-5 py-3 text-xs sm:text-sm liquid-chrome-btn cursor-pointer text-center"
                  >
                    <span className="relative z-10">
                      {isLoading ? 'Requesting…' : 'Enable Location'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleNotNow}
                    className="sm:w-auto rounded-full border-2 border-[#e0dfdb]/40 bg-[#161616] text-[#f2f2f0] font-medium uppercase tracking-widest px-5 py-2.5 sm:py-3 text-xs sm:text-sm hover:bg-white/10 hover:border-[#f2f2f0] transition-colors cursor-pointer text-center"
                  >
                    Not now
                  </button>
                </div>

                {/* Subtle Privacy Footer */}
                <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#b8b8b8]/75">
                  <span>Browser GPS is only requested if you enable</span>
                  <a href="/privacy" className="underline hover:text-[#f2f2f0] shrink-0 ml-2">
                    Privacy
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Privacy & Location Data Management Modal (Enable Later / Withdraw Consent / Delete Data) */}
      <AnimatePresence>
        {isOpenModal && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Privacy and Location Settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={onCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-[32px] bg-[#111111] border border-[#e0dfdb]/30 p-6 sm:p-8 text-[#f2f2f0] shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#e0dfdb]/15">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8b8b8]">
                    VISITOR PRIVACY CONTROLS
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mt-0.5">
                    Location &amp; Analytics Data
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="rounded-full border border-[#e0dfdb]/30 px-3 py-1 text-xs font-mono uppercase hover:bg-white/10 cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs sm:text-sm text-[#f2f2f0]/80 font-light leading-relaxed">
                <div className="rounded-2xl bg-[#181818] border border-white/10 p-4 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#b8b8b8]">Anonymous Visitor ID:</span>
                    <span className="text-[#f2f2f0] truncate max-w-[210px]">{visitorId}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#b8b8b8]">Location Mode:</span>
                    <span className="uppercase text-[#f2f2f0]">
                      {consentState === 'granted' && coords
                        ? `Exact GPS (±${coords.accuracyMeters}m)`
                        : 'Approximate IP Estimate Only'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#b8b8b8]">GPS Consent Status:</span>
                    <span className="uppercase text-[#f2f2f0]">{consentState}</span>
                  </div>
                  {coords && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[#b8b8b8]">Recorded Coordinates:</span>
                      <span className="text-[#f2f2f0]">
                        {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>

                <p>
                  Location sharing is completely optional. Without browser GPS permission, only approximate city/region-level IP metadata is used. You can enable location, withdraw GPS permission, or delete your analytics records at any time.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {consentState !== 'granted' ? (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleEnableGps}
                      className="flex-1 rounded-full border border-[#e0dfdb] bg-[#f2f2f0] text-[#090909] font-medium uppercase tracking-widest px-5 py-2.5 text-xs hover:bg-white transition-colors cursor-pointer"
                    >
                      Enable Location
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleWithdrawGps}
                      className="flex-1 rounded-full border border-[#e0dfdb] bg-[#f2f2f0] text-[#090909] font-medium uppercase tracking-widest px-5 py-2.5 text-xs hover:bg-white transition-colors cursor-pointer"
                    >
                      Withdraw GPS Consent
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleDeleteAllData}
                    className="flex-1 rounded-full border border-red-400/50 text-red-200 font-mono uppercase tracking-widest px-5 py-2.5 text-xs hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    Delete My Analytics Data
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs font-mono text-[#b8b8b8]">
                  <a href="/privacy" className="underline hover:text-[#f2f2f0]">
                    Read Full Privacy Notice →
                  </a>
                  <span>90-day auto-retention</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Feedback Toast for Privacy/GPS Actions */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-full bg-[#161616]/95 border border-[#e0dfdb]/30 text-[#f2f2f0] font-mono text-xs tracking-wide shadow-2xl"
          >
            {feedbackMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
