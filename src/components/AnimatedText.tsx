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
  const containerRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'end 0.35'],
  });

  const words = text.split(" ");
  const totalWords = words.length;

  return (
    <p ref={containerRef} className={className} style={style}>
      {words.map((word, i) => {
        const start = i / totalWords;
        const end = Math.min(1, start + 1.2 / totalWords);
        return (
          <Word
            key={`w-${i}-${word}`}
            word={word}
            progress={scrollYProgress}
            range={[start, end]}
          />
        );
      })}
    </p>
  );
};
