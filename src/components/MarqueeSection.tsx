import type { FC, ReactNode } from 'react';
import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export interface SocialCardItem {
  id: string;
  name: string;
  handle: string;
  category: string;
  url: string;
  icon: ReactNode;
}

const INSTAGRAM_ICON = (
  <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-[#E1306C]" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

export const SOCIAL_PLATFORMS: SocialCardItem[] = [
  {
    id: 'github',
    name: 'GITHUB',
    handle: '@1mbtm',
    category: 'CODE & OPEN SOURCE',
    url: 'https://github.com/1mbtm',
    icon: (
      <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-white" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    id: 'instagram-founder',
    name: 'INSTAGRAM (FOUNDER)',
    handle: '@1m.btm',
    category: 'FOUNDER & PROFESSIONAL',
    url: 'https://www.instagram.com/1m.btm/',
    icon: INSTAGRAM_ICON,
  },
  {
    id: 'instagram-personal',
    name: 'INSTAGRAM (PERSONAL)',
    handle: '@notarqam',
    category: 'PERSONAL ACCOUNT',
    url: 'https://www.instagram.com/notarqam/',
    icon: INSTAGRAM_ICON,
  },
  {
    id: 'gmail',
    name: 'EMAIL',
    handle: '1m.btmnnn@gmail.com',
    category: 'DIRECT INQUIRIES',
    url: 'mailto:1m.btmnnn@gmail.com',
    icon: (
      <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-[#EA4335]" viewBox="0 0 24 24">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.272H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
      </svg>
    ),
  },
  {
    id: 'linkedin',
    name: 'LINKEDIN',
    handle: 'Arqam (@1mbtm)',
    category: 'PROFESSIONAL NETWORK',
    url: 'https://linkedin.com/in/1mbtm',
    icon: (
      <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-[#0A66C2]" viewBox="0 0 24 24">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
      </svg>
    ),
  },
  {
    id: 'x',
    name: 'X (TWITTER)',
    handle: '@1mbtm',
    category: 'BUILD IN PUBLIC',
    url: 'https://x.com/1mbtm',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-white" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: 'telegram',
    name: 'TELEGRAM',
    handle: '@imbtmnnn',
    category: 'DIRECT MESSAGE',
    url: 'https://t.me/imbtmnnn',
    icon: (
      <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-[#229ED9]" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.892-1.396 6.575-2.025 9.479-.265 1.229-.719 1.639-1.159 1.679-.958.087-1.684-.633-2.612-1.242-1.452-.953-2.274-1.546-3.684-2.476-1.63-1.074-.575-1.665.356-2.632.363-.332 6.671-6.115 6.793-6.634.015-.065.029-.307-.114-.435-.143-.127-.354-.084-.506-.05-.216.05-3.655 2.327-10.318 6.824-.976.671-1.86.998-2.653.979-.875-.019-2.559-.495-3.813-.903-.769-.251-1.381-.384-1.328-.81.028-.222.333-.449.916-.682 3.587-1.562 5.98-2.593 7.179-3.093 3.421-1.428 4.133-1.676 4.597-1.684.102-.002.33.023.477.143.124.101.159.238.175.334.017.098.037.321.021.496z"/>
      </svg>
    ),
  },
  {
    id: 'reddit',
    name: 'REDDIT',
    handle: 'Fast_Development_258',
    category: 'TECH DISCUSSIONS',
    url: 'https://www.reddit.com/user/Fast_Development_258/',
    icon: (
      <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-[#FF4500]" viewBox="0 0 24 24">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.609a1.246 1.246 0 0 1 1.108-.693zM8.618 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6.764 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6.84 4.896a.5.5 0 0 0 .1.7c.928.694 2.146 1.004 3.358 1.004 1.212 0 2.43-.31 3.358-1.004a.5.5 0 0 0-.6-.8c-.754.564-1.769.804-2.758.804-.989 0-2.004-.24-2.758-.804a.5.5 0 0 0-.7.1z"/>
      </svg>
    ),
  },
];

// FIRST ROW = GITHUB, FOUNDER INSTAGRAM, PERSONAL INSTAGRAM, EMAIL
const ROW1_PLATFORMS: SocialCardItem[] = [
  SOCIAL_PLATFORMS[0], // GITHUB
  SOCIAL_PLATFORMS[1], // INSTAGRAM (FOUNDER)
  SOCIAL_PLATFORMS[2], // INSTAGRAM (PERSONAL)
  SOCIAL_PLATFORMS[3], // EMAIL
];

// SECOND ROW = LINKEDIN, X, TELEGRAM, REDDIT
const ROW2_PLATFORMS: SocialCardItem[] = [
  SOCIAL_PLATFORMS[4], // LINKEDIN
  SOCIAL_PLATFORMS[5], // X (TWITTER)
  SOCIAL_PLATFORMS[6], // TELEGRAM
  SOCIAL_PLATFORMS[7], // REDDIT
];

// Deck repetitions (3x on mobile, 4x on desktop)
const row1CardsMobile = Array(3).fill(ROW1_PLATFORMS).flat();
const row2CardsMobile = Array(3).fill(ROW2_PLATFORMS).flat();
const row1CardsDesktop = Array(4).fill(ROW1_PLATFORMS).flat();
const row2CardsDesktop = Array(4).fill(ROW2_PLATFORMS).flat();

export const MarqueeSection: FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Direct high-precision scroll progress through the marquee section (0 to 1)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Direct 1:1 hardware translation curves for instantaneous 120fps touch tracking
  const row1X = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion
      ? ['0px', '0px']
      : isMobile
      ? ['-1750px', '350px']
      : ['-1200px', '-400px']
  );

  const row2X = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion
      ? ['0px', '0px']
      : isMobile
      ? ['-250px', '-2450px']
      : ['-1200px', '-2000px']
  );

  const row1Cards = isMobile ? row1CardsMobile : row1CardsDesktop;
  const row2Cards = isMobile ? row2CardsMobile : row2CardsDesktop;

  return (
    <section
      ref={sectionRef}
      className="bg-[#090909] pt-20 sm:pt-28 md:pt-36 pb-12 overflow-hidden w-full relative"
      style={{ contain: 'paint layout' }}
    >
      <div className="flex flex-col gap-5 sm:gap-6 w-full">
        {/* Row 1: Moves RIGHT on scroll (GITHUB, INSTAGRAM FOUNDER, INSTAGRAM PERSONAL, EMAIL) */}
        <div className="overflow-hidden w-full py-4 -my-4" style={{ contain: 'content' }}>
          <motion.div
            style={{
              x: row1X,
              transform: 'translate3d(0,0,0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            className="flex gap-4 sm:gap-5 w-max py-2 will-change-transform transform-gpu"
          >
            {row1Cards.map((item, index) => (
              <a
                key={`r1-${item.id}-${index}`}
                href={item.url}
                target={item.url.startsWith('http') ? '_blank' : undefined}
                rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="w-[260px] h-[155px] sm:w-[310px] sm:h-[185px] md:w-[350px] md:h-[205px] rounded-2xl flex-shrink-0 relative overflow-hidden bg-gradient-to-b from-[#1c1c1c] via-[#131313] to-[#0a0a0a] border border-white/40 shadow-xl md:transition-[border-color,transform] md:duration-200 md:hover:border-white/70 md:hover:-translate-y-1.5 group flex flex-col justify-between p-5 sm:p-6 cursor-pointer"
              >
                {/* Permanent diagonal liquid mirror reflection sheen */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-100"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 45%, rgba(255,255,255,0.04) 65%, transparent 100%)',
                  }}
                />

                {/* Top Row: Direct Real Icon + Minimal Text Tag */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    {item.icon}
                  </div>

                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-[#b8b8b8]/60 select-none">
                    {item.category}
                  </span>
                </div>

                {/* Bottom Row: Name with breathing room & Thin Arrow */}
                <div className="relative z-10 flex items-end justify-between pt-3 sm:pt-4 border-t border-white/[0.12]">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider text-white transition-colors">
                      {item.name}
                    </h3>
                    <p className="font-mono text-[11px] sm:text-xs text-[#b8b8b8]/80 mt-1 truncate max-w-[170px] sm:max-w-[210px] tracking-normal font-normal">
                      {item.handle}
                    </p>
                  </div>

                  <div className="flex items-center justify-center text-white/80 group-hover:text-white transition-colors pb-0.5">
                    <ArrowUpRight className="w-4 h-4 stroke-[1.5] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-white" />
                  </div>
                </div>
              </a>
            ))}
          </motion.div>
        </div>

        {/* Row 2: Moves LEFT on scroll (LINKEDIN, X, TELEGRAM, REDDIT) */}
        <div className="overflow-hidden w-full py-4 -my-4" style={{ contain: 'content' }}>
          <motion.div
            style={{
              x: row2X,
              transform: 'translate3d(0,0,0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            className="flex gap-4 sm:gap-5 w-max py-2 will-change-transform transform-gpu"
          >
            {row2Cards.map((item, index) => (
              <a
                key={`r2-${item.id}-${index}`}
                href={item.url}
                target={item.url.startsWith('http') ? '_blank' : undefined}
                rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="w-[260px] h-[155px] sm:w-[310px] sm:h-[185px] md:w-[350px] md:h-[205px] rounded-2xl flex-shrink-0 relative overflow-hidden bg-gradient-to-b from-[#1c1c1c] via-[#131313] to-[#0a0a0a] border border-white/40 shadow-xl md:transition-[border-color,transform] md:duration-200 md:hover:border-white/70 md:hover:-translate-y-1.5 group flex flex-col justify-between p-5 sm:p-6 cursor-pointer"
              >
                {/* Permanent diagonal liquid mirror reflection sheen */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-100"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 45%, rgba(255,255,255,0.04) 65%, transparent 100%)',
                  }}
                />

                {/* Top Row: Direct Real Icon + Minimal Text Tag */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                    {item.icon}
                  </div>

                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-[#b8b8b8]/60 select-none">
                    {item.category}
                  </span>
                </div>

                {/* Bottom Row: Name with breathing room & Thin Arrow */}
                <div className="relative z-10 flex items-end justify-between pt-3 sm:pt-4 border-t border-white/[0.12]">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider text-white transition-colors">
                      {item.name}
                    </h3>
                    <p className="font-mono text-[11px] sm:text-xs text-[#b8b8b8]/80 mt-1 truncate max-w-[170px] sm:max-w-[210px] tracking-normal font-normal">
                      {item.handle}
                    </p>
                  </div>

                  <div className="flex items-center justify-center text-white/80 group-hover:text-white transition-colors pb-0.5">
                    <ArrowUpRight className="w-4 h-4 stroke-[1.5] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-white" />
                  </div>
                </div>
              </a>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
