import type { FC, MouseEvent } from 'react';

interface LiveProjectButtonProps {
  label?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export const LiveProjectButton: FC<LiveProjectButtonProps> = ({
  label = "View Project ↗",
  href,
  onClick,
  className = "",
}) => {
  const baseClasses = `relative inline-flex items-center justify-center rounded-full border-2 border-[#e0dfdb] text-[#f2f2f0] font-medium uppercase tracking-widest px-5 py-2.5 sm:px-7 sm:py-3 min-h-[42px] text-xs sm:text-sm whitespace-nowrap hover:bg-[#f2f2f0] hover:text-[#090909] hover:border-[#f2f2f0] active:scale-[0.97] transition-all duration-200 cursor-pointer select-none button-alive ${className}`;

  if (href) {
    const handleAnchorClick = (e: MouseEvent<HTMLAnchorElement>) => {
      e.stopPropagation();
      onClick?.();
    };

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleAnchorClick}
        className={baseClasses}
      >
        <span className="relative z-10">{label}</span>
      </a>
    );
  }

  const handleButtonClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleButtonClick}
      className={baseClasses}
    >
      <span className="relative z-10">{label}</span>
    </button>
  );
};
