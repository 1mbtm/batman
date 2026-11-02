import type { FC } from 'react';
import { motion } from 'framer-motion';
import { FadeIn } from './FadeIn';
import { ContactButton } from './ContactButton';
import { Magnet } from './Magnet';

export const HeroSection: FC = () => {
  return (
    <section className="relative h-screen w-full flex flex-col justify-between overflow-x-clip bg-[#090909]">
      {/* Navbar */}
      <FadeIn delay={0} y={-20} className="w-full z-20">
        <nav className="w-full flex justify-between items-center px-6 md:px-10 pt-6 md:pt-8 text-[#f2f2f0] font-medium uppercase tracking-wider text-sm md:text-lg lg:text-[1.4rem]">
          <a href="#about" className="hover:text-[#b8b8b8] transition-colors duration-200">About</a>
          <a href="#expertise" className="hover:text-[#b8b8b8] transition-colors duration-200">Expertise</a>
          <a href="#projects" className="hover:text-[#b8b8b8] transition-colors duration-200">Projects</a>
          <a href="#contact" className="hover:text-[#b8b8b8] transition-colors duration-200">Contact</a>
        </nav>
      </FadeIn>

      {/* Hero Heading - Massive with crisp letter gaps */}
      <div className="w-full flex justify-center items-center z-0 px-2 sm:px-4 overflow-visible">
        <FadeIn delay={0.15} y={40} className="w-full flex justify-center">
          <h1 className="hero-heading font-black uppercase tracking-tight leading-none whitespace-nowrap text-center w-full text-[18vw] sm:text-[19.5vw] md:text-[21vw] lg:text-[22vw] mt-4 sm:mt-2 md:-mt-4 select-none">
            Arqam
          </h1>
        </FadeIn>
      </div>

      {/* Hero Portrait Image with Magnet & Interactive Touch Drag Snapback */}
      <FadeIn
        delay={0.6}
        y={30}
        className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-[280px] sm:w-[360px] md:w-[440px] lg:w-[520px] top-1/2 -translate-y-1/2 sm:top-auto sm:translate-y-0 sm:bottom-0"
      >
        <Magnet
          padding={150}
          strength={3}
          activeTransition="transform 0.3s ease-out"
          inactiveTransition="transform 0.6s ease-in-out"
          className="w-full flex justify-center"
        >
          <motion.div
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.75}
            dragTransition={{ bounceStiffness: 350, bounceDamping: 22 }}
            whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
            whileTap={{ scale: 1.02 }}
            className="w-full flex justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          >
            <img
              src="/hero-portrait.webp"
              alt="Arqam — Entrepreneur & Founder | Software Developer"
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="w-full h-auto object-contain max-h-[60vh] sm:max-h-[75vh] drop-shadow-2xl pointer-events-none select-none"
            />
          </motion.div>
        </Magnet>
      </FadeIn>

      {/* Bottom Bar */}
      <div className="w-full px-6 md:px-10 pb-7 sm:pb-8 md:pb-10 flex justify-between items-end gap-4 z-20">
        <FadeIn delay={0.35} y={20}>
          <div className="max-w-[200px] sm:max-w-[290px] md:max-w-[380px]">
            <p className="text-[#b8b8b8] font-mono text-[10px] sm:text-xs uppercase tracking-widest mb-1.5">
              Entrepreneur &amp; Founder | Software Developer
            </p>
            <p
              className="text-[#f2f2f0] font-light uppercase tracking-wide leading-snug"
              style={{ fontSize: 'clamp(0.75rem, 1.25vw, 1.3rem)' }}
            >
              Building technology products, exploring ideas, and developing digital solutions.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.5} y={20}>
          <ContactButton />
        </FadeIn>
      </div>
    </section>
  );
};
