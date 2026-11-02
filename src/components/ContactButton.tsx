import type { FC, MouseEvent } from 'react';

const DEFAULT_EMAIL_URL = 'mailto:1m.btmnnn@gmail.com';

interface ContactButtonProps {
  label?: string;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export const ContactButton: FC<ContactButtonProps> = ({
  label = "Get In Touch",
  onClick,
  href = DEFAULT_EMAIL_URL,
  className = "",
}) => {
  const baseClasses = `relative inline-flex items-center justify-center rounded-full font-bold uppercase tracking-widest text-[#090909] cursor-pointer px-8 py-3 sm:px-10 sm:py-3.5 md:px-12 md:py-4 text-xs sm:text-sm md:text-base liquid-chrome-btn select-none ${className}`;

  if (href && !onClick) {
    const isExternal = href.startsWith('http');
    const isHash = href.startsWith('#');

    const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
      if (isHash) {
        const targetId = href.slice(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.history.pushState(null, '', href);
        }
      }
    };

    return (
      <a
        href={href}
        onClick={handleLinkClick}
        className={baseClasses}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <span className="relative z-10 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={baseClasses}
    >
      <span className="relative z-10 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">{label}</span>
    </button>
  );
};
