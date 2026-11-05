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
  onOpenAdmin?: () => void;
}

export const AnalyticsConsentBanner: FC<AnalyticsConsentBannerProps> = ({
  isOpenModal,
  onCloseModal,
  onOpenAdmin,
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
      }, 1500);
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
      showTempFeedback(
        `Exact GPS shared (±${res.coords.accuracyMeters}m accuracy). You can withdraw consent anytime.`
      );
    } else if (res.error) {
      showTempFeedback(res.error);
    }
  };

  const handleContinueIpOnly = async () => {
    await declineGpsLocation();
    setShowFloatingPrompt(false);
    setConsentState('denied');
    setCoords(null);
    showTempFeedback('Continuing with approximate IP-based region estimates only.');
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
      {/* 1. Optional Non-Intrusive Bottom-Right GPS Consent Prompt */}
      <AnimatePresence>
        {showFloatingPrompt && !isOpenModal && (
          <motion.div
            role="dialog"
            aria-label="Optional Location Sharing Consent"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-3xl bg-[#111111]/95 border border-[#e0dfdb]/25 p-4 sm:p-5 text-[#f2f2f0] backdrop-blur-xl shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#e0dfdb]" />
                <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-[#b8b8b8]">
                  OPTIONAL TELEMETRY
                </span>
              </div>
              <button
                type="button"
                onClick={handleContinueIpOnly}
                aria-label="Dismiss location prompt"
                className="text-xs font-mono uppercase tracking-widest text-[#b8b8b8]/70 hover:text-[#f2f2f0] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#f2f2f0]/85 font-light leading-relaxed mb-3.5">
              By default, this portfolio uses only approximate IP region estimates and anonymous visit counts. Would you like to share exact browser GPS coordinates?
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleEnableGps}
                className="flex-1 min-w-[130px] rounded-full border border-[#e0dfdb] bg-[#f2f2f0] text-[#090909] font-medium uppercase tracking-widest px-4 py-2 text-[11px] hover:bg-white transition-colors cursor-pointer"
              >
                {isLoading ? 'Requesting...' : 'Allow Exact GPS'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleContinueIpOnly}
                className="flex-1 min-w-[130px] rounded-full border border-[#e0dfdb]/35 text-[#f2f2f0] font-mono uppercase tracking-widest px-4 py-2 text-[11px] hover:bg-white/10 transition-colors cursor-pointer"
              >
                IP Estimate Only
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-[#b8b8b8]/60">
              <a href="/privacy" className="underline hover:text-[#f2f2f0]">
                Privacy Policy
              </a>
              <span>90-day auto-retention</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Privacy & Location Data Management Modal (Withdraw Consent / Delete Data) */}
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
                  Raw IP addresses are never stored in our database. Without explicit GPS permission, only approximate city/region-level IP metadata is recorded. Analytics records are automatically purged after 90 days.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {consentState !== 'granted' ? (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleEnableGps}
                      className="flex-1 rounded-full border border-[#e0dfdb] bg-[#f2f2f0] text-[#090909] font-medium uppercase tracking-widest px-5 py-2.5 text-xs hover:bg-white transition-colors cursor-pointer"
                    >
                      Opt-In to Exact GPS
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
                  <a href="/admin" onClick={(e) => { if (onOpenAdmin) { e.preventDefault(); onOpenAdmin(); } }} className="underline hover:text-[#f2f2f0] cursor-pointer">
                    Admin Dashboard →
                  </a>
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
