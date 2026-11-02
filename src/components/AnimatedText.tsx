import type { FC, CSSProperties } from 'react';
import { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';

interface AnimatedTextProps {
  text: string;
  className?: string;
  style?: CSSProperties;
}

interface WordProps {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
}

const Word: FC<WordProps> = ({ word, progress, range }) => {
  const opacity = useTransform(progress, range, [0.2, 1]);
  return (
    <span className="relative inline-block mr-[0.28em] select-none">
      <span className="opacity-0 select-none">{word}</span>
      <motion.span
        style={{ opacity }}
        className="absolute left-0 top-0 will-change-[opacity] select-none"
      >
        {word}
      </motion.span>
    </span>
  );
};

export const AnimatedText: FC<AnimatedTextProps> = ({ text, className = "", style }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'end 0.35'],
  });

  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split(/\s+/));

  const totalWords = paragraphs.reduce((acc, words) => acc + words.length, 0);
  let globalIndex = 0;

  return (
    <div ref={containerRef} className={`space-y-5 sm:space-y-6 ${className}`} style={style}>
      {paragraphs.map((words, pIdx) => (
        <p key={`p-${pIdx}`}>
          {words.map((word) => {
            const currentIndex = globalIndex++;
            const start = currentIndex / totalWords;
            const end = Math.min(1, start + 1.2 / totalWords);
            return (
              <Word
                key={`w-${pIdx}-${currentIndex}-${word}`}
                word={word}
                progress={scrollYProgress}
                range={[start, end]}
              />
            );
          })}
        </p>
      ))}
    </div>
  );
};
