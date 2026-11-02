import type { FC } from 'react';

interface LiveProjectButtonProps {
  label?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export const LiveProjectButton: FC<LiveProjectButtonProps> = ({
  label = "Live Project",
  href,
  onClick,
  className = "",
}) => {
  if (href && !onClick) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`relative inline-flex items-center justify-center rounded-full border-2 border-[#e0dfdb] text-[#f2f2f0] font-medium uppercase tracking-widest px-6 py-2.5 sm:px-8 sm:py-3 text-xs sm:text-sm hover:bg-[#f2f2f0]/10 hover:border-[#f2f2f0] transition-all duration-200 cursor-pointer button-alive ${className}`}
      >
        <span className="relative z-10">{label}</span>
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`relative inline-flex items-center justify-center rounded-full border-2 border-[#e0dfdb] text-[#f2f2f0] font-medium uppercase tracking-widest px-6 py-2.5 sm:px-8 sm:py-3 text-xs sm:text-sm hover:bg-[#f2f2f0]/10 hover:border-[#f2f2f0] transition-all duration-200 cursor-pointer button-alive ${className}`}
      >
        <span className="relative z-10">{label}</span>
      </button>
    );
  }

  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full border-2 border-[#e0dfdb]/60 text-[#f2f2f0] font-medium uppercase tracking-widest px-6 py-2.5 sm:px-8 sm:py-3 text-xs sm:text-sm select-none ${className}`}
    >
      <span className="relative z-10">{label}</span>
    </span>
  );
};
