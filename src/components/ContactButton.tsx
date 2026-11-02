import type { FC } from 'react';

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
  const buttonContent = (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full font-bold uppercase tracking-widest text-[#090909] cursor-pointer px-8 py-3 sm:px-10 sm:py-3.5 md:px-12 md:py-4 text-xs sm:text-sm md:text-base liquid-chrome-btn ${className}`}
    >
      <span className="relative z-10 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">{label}</span>
    </button>
  );

  if (href && !onClick) {
    const isExternal = href.startsWith('http');
    return (
      <a
        href={href}
        className="inline-block"
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {buttonContent}
      </a>
    );
  }

  return buttonContent;
};
