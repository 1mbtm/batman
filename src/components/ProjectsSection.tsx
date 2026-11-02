import type { FC, CSSProperties } from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { FadeIn } from './FadeIn';
import { LiveProjectButton } from './LiveProjectButton';
import { ToastNotification } from './ToastNotification';

export interface Project {
  number: string;
  name: string;
  status: string;
  link?: string;
  notificationMessage?: string;
  objectPosition?: 'top' | 'center';
  /**
   * Image paths for the 3 card preview slots (all in WebP format).
   * Leave undefined or empty string "" to render the obsidian mirror fallback visual.
   */
  col1Img1?: string;
  col1Img2?: string;
  col2Img?: string;
}

export const projectsData: Project[] = [
  {
    number: "01",
    name: "ALIF Billing Tool",
    status: "Active Development",
    notificationMessage: "ALIF Billing Tool is currently a private project.",
    objectPosition: "top",
    col1Img1: "/projects/alif-billing-1.webp",
    col1Img2: "/projects/alif-billing-2.webp",
    col2Img: "/projects/alif-billing-3.webp",
  },
  {
    number: "02",
    name: "ALIF Website",
    status: "Active",
    link: "https://aliflt.netlify.app/",
    objectPosition: "top",
    col1Img1: "/projects/alif-1.webp",
    col1Img2: "/projects/alif-2.webp",
    col2Img: "/projects/alif-3.webp",
  },
  {
    number: "03",
    name: "Ward Al Madinah",
    status: "Client Project",
    link: "https://wardalmadinah.pages.dev/",
    objectPosition: "top",
    col1Img1: "/projects/ward-al-madinah-1.webp",
    col1Img2: "/projects/ward-al-madinah-2.webp",
    col2Img: "/projects/ward-al-madinah-3.webp",
  },
  {
    number: "04",
    name: "SayNO",
    status: "Experimental / Pending",
    link: "https://saynoapp.webtree.workers.dev/",
    objectPosition: "top",
    col1Img1: "/projects/sayno-1.webp",
    col1Img2: "/projects/sayno-2.webp",
    col2Img: "/projects/sayno-3.webp",
  },
  {
    number: "05",
    name: "ASCOOL",
    status: "Coming Soon",
    notificationMessage: "ASCOOL is coming soon. Stay tuned.",
    objectPosition: "center",
    col1Img1: "/projects/ascool-1.webp",
    col1Img2: "/projects/ascool-2.webp",
    col2Img: "/projects/ascool-3.webp",
  },
];

interface ImageSlotProps {
  src?: string;
  alt: string;
  variant: 'top-left' | 'bottom-left' | 'tall-right';
  objectPosition?: 'top' | 'center';
}

const ProjectImageSlot: FC<ImageSlotProps> = ({
  src,
  alt,
  variant,
  objectPosition = 'top',
}) => {
  const [imgError, setImgError] = useState(false);
  const hasValidImage = Boolean(src && src.trim() !== '' && !imgError);

  const aspectClasses: Record<ImageSlotProps['variant'], string> = {
    'top-left': 'aspect-[1024/585]',
    'bottom-left': 'aspect-[1024/680]',
    'tall-right': 'aspect-[1024/875] md:aspect-auto md:h-full md:min-h-[380px]',
  };

  const mirrorBackgrounds: Record<ImageSlotProps['variant'], CSSProperties> = {
    'top-left': {
      background: 'linear-gradient(135deg, #262626 0%, #151515 50%, #0a0a0a 100%)',
    },
    'bottom-left': {
      background: 'linear-gradient(135deg, #1c1c1c 0%, #111111 50%, #060606 100%)',
    },
    'tall-right': {
      background: 'linear-gradient(145deg, #2e2e2e 0%, #191919 35%, #0e0e0e 70%, #040404 100%)',
    },
  };

  if (hasValidImage) {
    return (
      <div
        className={`w-full rounded-[28px] sm:rounded-[40px] md:rounded-[52px] overflow-hidden border border-[#e0dfdb]/15 bg-[#111111] shadow-xl ${aspectClasses[variant]}`}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover select-none ${
            objectPosition === 'center' ? 'object-center' : 'object-top'
          }`}
        />
      </div>
    );
  }

  // Fallback visual: Clean obsidian liquid-mirror card
  if (variant === 'tall-right') {
    return (
      <div
        className={`w-full rounded-[28px] sm:rounded-[40px] md:rounded-[52px] border border-white/25 relative overflow-hidden shadow-2xl ${aspectClasses['tall-right']}`}
        style={mirrorBackgrounds['tall-right']}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-45"
          style={{
            background:
              'linear-gradient(125deg, rgba(255,255,255,0.28) 0%, transparent 35%, rgba(255,255,255,0.08) 55%, transparent 100%)',
          }}
        />
        <div className="absolute -right-16 -bottom-16 w-72 h-72 rounded-full bg-white/[0.04] blur-3xl pointer-events-none" />
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-[28px] sm:rounded-[40px] md:rounded-[52px] border border-white/20 relative overflow-hidden shadow-xl ${aspectClasses[variant]}`}
      style={mirrorBackgrounds[variant]}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          background:
            variant === 'top-left'
              ? 'linear-gradient(120deg, rgba(255,255,255,0.22) 0%, transparent 40%, rgba(255,255,255,0.06) 65%, transparent 100%)'
              : 'linear-gradient(140deg, rgba(255,255,255,0.18) 0%, transparent 45%, rgba(255,255,255,0.04) 70%, transparent 100%)',
        }}
      />
    </div>
  );
};

interface CardProps {
  project: Project;
  index: number;
  totalCards: number;
  progress: MotionValue<number>;
  onNotify: (message: string) => void;
}

const ProjectCard: FC<CardProps> = ({ project, index, totalCards, progress, onNotify }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate target scale: 1 - (totalCards - 1 - index) * 0.025
  const targetScale = 1 - (totalCards - 1 - index) * 0.025;
  const rangeStart = index * (1 / totalCards);
  const scale = useTransform(progress, [rangeStart, 1], [1, targetScale]);

  const handleActionClick = () => {
    if (!project.link && project.notificationMessage) {
      onNotify(project.notificationMessage);
    }
  };

  return (
    <div
      ref={cardRef}
      className="sticky top-20 sm:top-24 md:top-28 h-auto flex justify-center items-center mb-12 sm:mb-16 md:mb-20"
      style={{
        top: `${84 + index * 22}px`,
        zIndex: index + 1,
      }}
    >
      <motion.div
        style={{
          scale,
          transformOrigin: 'top center',
        }}
        className="w-full max-w-6xl rounded-[36px] sm:rounded-[48px] md:rounded-[60px] border-2 border-[#e0dfdb] bg-[#090909] p-4 sm:p-6 md:p-8 shadow-2xl overflow-hidden origin-top will-change-transform transform-gpu"
      >
        {/* Top Row: Number, Short Status, Project Name, and Direct View Project ↗ Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-[#e0dfdb]/20">
          <div className="flex items-center gap-3.5 sm:gap-6 min-w-0">
            <span
              className="font-black text-[#f2f2f0] leading-none select-none shrink-0"
              style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4.75rem)' }}
            >
              {project.number}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs md:text-sm uppercase tracking-widest text-[#b8b8b8] font-light truncate">
                {project.status}
              </span>
              <h3 className="text-lg sm:text-2xl md:text-3xl font-medium uppercase text-[#f2f2f0] tracking-tight truncate">
                {project.name}
              </h3>
            </div>
          </div>

          <div className="shrink-0 ml-auto sm:ml-0">
            <LiveProjectButton
              label="View Project ↗"
              href={project.link}
              onClick={!project.link ? handleActionClick : undefined}
            />
          </div>
        </div>

        {/* Bottom Row: 3-Slot Visual Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mt-5 sm:mt-6 md:mt-8">
          {/* Left Column (5 cols): 2 stacked slots */}
          <div className="md:col-span-5 flex flex-col gap-4 md:gap-6">
            <ProjectImageSlot
              src={project.col1Img1}
              alt={`${project.name} screenshot 1`}
              variant="top-left"
              objectPosition={project.objectPosition}
            />
            <ProjectImageSlot
              src={project.col1Img2}
              alt={`${project.name} screenshot 2`}
              variant="bottom-left"
              objectPosition={project.objectPosition}
            />
          </div>

          {/* Right Column (7 cols): 1 tall slot */}
          <div className="md:col-span-7 flex">
            <ProjectImageSlot
              src={project.col2Img}
              alt={`${project.name} screenshot 3`}
              variant="tall-right"
              objectPosition={project.objectPosition}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const ProjectsSection: FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  return (
    <section
      ref={containerRef}
      id="projects"
      className="relative z-10 bg-[#090909] text-[#f2f2f0] px-4 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 w-full min-h-[360vh]"
    >
      {/* Heading */}
      <FadeIn delay={0} y={40}>
        <h2
          className="hero-heading font-black uppercase text-center text-[#f2f2f0] leading-none tracking-tight mb-16 sm:mb-20 md:mb-28 select-none"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          Projects
        </h2>
      </FadeIn>

      {/* Cards Stack Container */}
      <div className="relative">
        {projectsData.map((project, index) => (
          <ProjectCard
            key={project.number}
            project={project}
            index={index}
            totalCards={projectsData.length}
            progress={scrollYProgress}
            onNotify={showToast}
          />
        ))}
      </div>

      {/* Reusable Toast Notification for Private / Upcoming Projects */}
      <ToastNotification message={toastMessage} onClose={dismissToast} />
    </section>
  );
};
