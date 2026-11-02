import type { FC } from 'react';
import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { FadeIn } from './FadeIn';
import { AnimatedText } from './AnimatedText';
import { ContactButton } from './ContactButton';
import emoji1 from '../assets/emojis/emoji1.webp';
import emoji2 from '../assets/emojis/emoji2.webp';
import emoji3 from '../assets/emojis/emoji3.webp';
import emoji4 from '../assets/emojis/emoji4.webp';

const ABOUT_TEXT = `I’m Arqam, an entrepreneur and self-taught developer from Sahibganj, India. My work spans software development, digital products, and business. I build websites and digital solutions for clients while also developing products and working on offline business ventures.
My interest in technology began with exploring how software works, experimenting with systems, and understanding the ideas behind them. Over time, that curiosity grew into a practical interest in software development, reverse engineering, and building products of my own.
Alongside my work, I’m completing Class 12 at The Assembly of God Church School, Kolkata.`;

export const AboutSection: FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Scroll progress targeting the About section
  // Range: 0.0 (section top enters viewport bottom) to 1.0 (section bottom leaves viewport top)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Continuous smooth opacity mapping: fade in on enter (0->0.25), hold (0.25->0.75), fade out on exit (0.75->1.0)
  const opacity = useTransform(scrollYProgress, [0.0, 0.25, 0.75, 1.0], [0, 1, 1, 0]);

  // Smooth scale mapping: scale up on enter (0.65->1.0), scale down on exit (1.0->0.65)
  const scale = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [1, 1, 1, 1] : [0.65, 1, 1, 0.65]
  );

  // Directional corner offset movement
  const topLeftX = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [-60, 0, 0, -60]
  );
  const topLeftY = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [-40, 0, 0, -40]
  );

  const bottomLeftX = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [-60, 0, 0, -60]
  );
  const bottomLeftY = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [40, 0, 0, 40]
  );

  const topRightX = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [60, 0, 0, 60]
  );
  const topRightY = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [-40, 0, 0, -40]
  );

  const bottomRightX = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [60, 0, 0, 60]
  );
  const bottomRightY = useTransform(
    scrollYProgress,
    [0.0, 0.25, 0.75, 1.0],
    shouldReduceMotion ? [0, 0, 0, 0] : [40, 0, 0, 40]
  );

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-5 sm:px-8 md:px-10 py-20 overflow-hidden bg-[#090909]"
    >
      {/* Scroll-Reactive 3D Objects in 4 Corners */}

      {/* Top-left Custom Emoji */}
      <motion.div
        style={{
          opacity,
          scale,
          x: topLeftX,
          y: topLeftY,
          transform: 'translate3d(0,0,0)',
        }}
        className="absolute top-[4%] left-[1%] sm:left-[2%] md:left-[4%] z-10 pointer-events-none origin-top-left will-change-transform transform-gpu"
      >
        <img
          src={emoji1}
          alt="Custom 3D Emoji 1"
          loading="lazy"
          decoding="async"
          className="w-[120px] sm:w-[160px] md:w-[210px] h-auto object-contain drop-shadow-2xl opacity-95 pointer-events-none select-none"
        />
      </motion.div>

      {/* Bottom-left Custom Emoji */}
      <motion.div
        style={{
          opacity,
          scale,
          x: bottomLeftX,
          y: bottomLeftY,
          transform: 'translate3d(0,0,0)',
        }}
        className="absolute bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%] z-10 pointer-events-none origin-bottom-left will-change-transform transform-gpu"
      >
        <img
          src={emoji2}
          alt="Custom 3D Emoji 2"
          loading="lazy"
          decoding="async"
          className="w-[155px] sm:w-[205px] md:w-[255px] h-auto object-contain drop-shadow-2xl opacity-95 pointer-events-none select-none"
        />
      </motion.div>

      {/* Top-right Custom Emoji */}
      <motion.div
        style={{
          opacity,
          scale,
          x: topRightX,
          y: topRightY,
          transform: 'translate3d(0,0,0)',
        }}
        className="absolute top-[4%] right-[1%] sm:right-[2%] md:right-[4%] z-10 pointer-events-none origin-top-right will-change-transform transform-gpu"
      >
        <img
          src={emoji3}
          alt="Custom 3D Emoji 3"
          loading="lazy"
          decoding="async"
          className="w-[120px] sm:w-[160px] md:w-[210px] h-auto object-contain drop-shadow-2xl opacity-95 pointer-events-none select-none"
        />
      </motion.div>

      {/* Bottom-right Custom Emoji */}
      <motion.div
        style={{
          opacity,
          scale,
          x: bottomRightX,
          y: bottomRightY,
          transform: 'translate3d(0,0,0)',
        }}
        className="absolute bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%] z-10 pointer-events-none origin-bottom-right will-change-transform transform-gpu"
      >
        <img
          src={emoji4}
          alt="Custom 3D Emoji 4"
          loading="lazy"
          decoding="async"
          className="w-[130px] sm:w-[170px] md:w-[220px] h-auto object-contain drop-shadow-2xl opacity-95 pointer-events-none select-none"
        />
      </motion.div>

      {/* Main Content Box */}
      <div className="relative z-20 flex flex-col items-center max-w-4xl text-center">
        {/* Heading */}
        <FadeIn delay={0} y={40}>
          <h2
            className="hero-heading font-black uppercase leading-none tracking-tight text-center select-none"
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
          >
            About me
          </h2>
        </FadeIn>

        {/* Gap between heading and text: gap-10 sm:gap-14 md:gap-16 */}
        <div className="mt-10 sm:mt-14 md:mt-16 mb-16 sm:mb-20 md:mb-24 flex flex-col items-center">
          <AnimatedText
            text={ABOUT_TEXT}
            className="text-[#f2f2f0] font-medium text-center leading-relaxed max-w-[720px]"
            style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
          />
        </div>

        {/* Contact button below text block */}
        <FadeIn delay={0.2} y={20}>
          <ContactButton />
        </FadeIn>
      </div>
    </section>
  );
};
