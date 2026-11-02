import type { FC } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface ToastNotificationProps {
  message: string | null;
  onClose?: () => void;
}

export const ToastNotification: FC<ToastNotificationProps> = ({ message, onClose }) => {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          onClick={onClose}
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-max max-w-[calc(100vw-2rem)] px-5 sm:px-6 py-3 sm:py-3.5 rounded-full bg-[#141414]/95 border border-[#e0dfdb]/30 text-[#f2f2f0] font-mono text-xs sm:text-sm tracking-wide backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] flex items-center gap-3 cursor-pointer select-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#e0dfdb] shrink-0 animate-pulse" />
          <span className="truncate">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
