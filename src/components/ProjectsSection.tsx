import type { FC, CSSProperties } from 'react';
import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { FadeIn } from './FadeIn';
import { LiveProjectButton } from './LiveProjectButton';

export interface Project {
  number: string;
  name: string;
  category: string;
  status: string;
  description: string;
  link?: string;
  isMirrorCard?: boolean;
  /**
   * Optional image paths for the 3 card preview slots.
   * Leave undefined or empty string "" to render the obsidian mirror placeholder.
   * When actual project images are ready, place them in `public/projects/`
   * and set e.g. col1Img1: "/projects/alif-billing-1.webp".
   */
  col1Img1?: string;
  col1Img2?: string;
  col2Img?: string;
}

export const projectsData: Project[] = [
  {
    number: "01",
    name: "ALIF Billing Tool",
    category: "Business Management Tool",
    status: "Active Development",
    description: "A billing and business management tool associated with ALIF.",
    col1Img1: "",
    col1Img2: "",
    col2Img: "",
  },
  {
    number: "02",
    name: "ALIF Website",
    category: "Official Business Website",
    status: "Active",
    description: "Official website project for ALIF Ladies Tailor.",
    col1Img1: "",
    col1Img2: "",
    col2Img: "",
  },
  {
    number: "03",
    name: "Ward Al Madinah",
    category: "Freelance & Client Website",
    status: "Client Project",
    description: "Website development work for a client. This project also represents my freelance website development and website-selling work.",
    col1Img1: "",
    col1Img2: "",
    col2Img: "",
  },
  {
    number: "04",
    name: "SayNO",
    category: "Digital Product Concept",
    status: "Pending / Experimental Project",
    description: "A digital product concept focused on helping users manage digital distractions and improve self-control.",
    col1Img1: "",
    col1Img2: "",
    col2Img: "",
  },
  {
    number: "05",
    name: "ASCOOL",
    category: "Upcoming Venture",
    status: "Upcoming Project",
    description: "An upcoming project. Coming soon.",
    col1Img1: "",
    col1Img2: "",
    col2Img: "",
  },
];

interface ImageSlotProps {
  src?: string;
  alt: string;
  variant: 'top-left' | 'bottom-left' | 'tall-right';
  projectName: string;
  projectStatus: string;
}

const ProjectImageSlot: FC<ImageSlotProps> = ({
  src,
  alt,
  variant,
  projectName,
  projectStatus,
}) => {
  const [imgError, setImgError] = useState(false);
  const hasValidImage = Boolean(src && src.trim() !== '' && !imgError);

  const slotStyles: Record<ImageSlotProps['variant'], CSSProperties> = {
    'top-left': {
      height: 'clamp(130px, 16vw, 230px)',
      background: 'linear-gradient(135deg, #262626 0%, #151515 50%, #0a0a0a 100%)',
    },
    'bottom-left': {
      height: 'clamp(160px, 22vw, 340px)',
      background: 'linear-gradient(135deg, #1c1c1c 0%, #111111 50%, #060606 100%)',
    },
    'tall-right': {
      background: 'linear-gradient(145deg, #2e2e2e 0%, #191919 35%, #0e0e0e 70%, #040404 100%)',
    },
  };

  if (hasValidImage) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className={`w-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] object-cover border border-[#e0dfdb]/10 ${
          variant === 'tall-right' ? 'h-full min-h-[290px] md:min-h-[400px]' : ''
        }`}
        style={variant !== 'tall-right' ? { height: slotStyles[variant].height } : undefined}
      />
    );
  }

  // Fallback visual: Existing obsidian mirror gradient treatment ready for future images
  if (variant === 'tall-right') {
    return (
      <div
        className="w-full h-full min-h-[290px] md:min-h-[400px] rounded-[40px] sm:rounded-[50px] md:rounded-[60px] border border-white/25 relative overflow-hidden shadow-2xl flex flex-col justify-between p-6 sm:p-8"
        style={slotStyles['tall-right']}
      >
        {/* Specular mirror sheen */}
        <div
          className="absolute inset-0 pointer-events-none opacity-45"
          style={{
            background:
              'linear-gradient(125deg, rgba(255,255,255,0.28) 0%, transparent 35%, rgba(255,255,255,0.08) 55%, transparent 100%)',
          }}
        />
        {/* Ambient glow */}
        <div className="absolute -right-16 -bottom-16 w-72 h-72 rounded-full bg-white/[0.04] blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-white/35">
            {projectStatus}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/25">
            PREVIEW SLOT
          </span>
        </div>

        <div className="relative z-10">
          <p className="font-black uppercase text-xl sm:text-2xl md:text-3xl tracking-tight text-white/20 select-none">
            {projectName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] border border-white/20 relative overflow-hidden shadow-xl"
      style={slotStyles[variant]}
    >
      {/* Diagonal mirror light sheen */}
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
}

const ProjectCard: FC<CardProps> = ({ project, index, totalCards, progress }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate target scale: 1 - (totalCards - 1 - index) * 0.025
  const targetScale = 1 - (totalCards - 1 - index) * 0.025;
  const rangeStart = index * (1 / totalCards);
  const scale = useTransform(progress, [rangeStart, 1], [1, targetScale]);

  return (
    <div
      ref={cardRef}
      className="sticky top-24 md:top-32 h-auto flex justify-center items-center mb-12 sm:mb-16 md:mb-20"
      style={{
        top: `${88 + index * 22}px`,
      }}
    >
      <motion.div
        style={{
          scale,
          transformOrigin: 'top center',
        }}
        className="w-full max-w-6xl rounded-[40px] sm:rounded-[50px] md:rounded-[60px] border-2 border-[#e0dfdb] bg-[#090909] p-4 sm:p-6 md:p-8 shadow-2xl overflow-hidden origin-top will-change-transform transform-gpu"
      >
        {/* Top Row: Number, Category, Name, Description, Status / Live Button */}
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#e0dfdb]/20">
          <div className="flex items-start sm:items-center gap-4 sm:gap-6 flex-1 min-w-[240px]">
            <span
              className="font-black text-[#f2f2f0] leading-none select-none shrink-0"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
            >
              {project.number}
            </span>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm uppercase tracking-widest text-[#b8b8b8] font-light">
                {project.category} · {project.status}
              </span>
              <h3 className="text-lg sm:text-2xl md:text-3xl font-medium uppercase text-[#f2f2f0] mt-0.5">
                {project.name}
              </h3>
              <p className="text-xs sm:text-sm text-[#f2f2f0]/70 font-light mt-1.5 max-w-2xl leading-relaxed">
                {project.description}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <LiveProjectButton
              label={project.link ? 'Live Project' : project.status}
              href={project.link}
            />
          </div>
        </div>

        {/* Bottom Row: 3-Slot Preview Grid (automatically renders images when provided or obsidian mirror placeholders) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mt-6 md:mt-8">
          {/* Left Column (40% width / 5 cols): 2 stacked slots */}
          <div className="md:col-span-5 flex flex-col gap-4 md:gap-6">
            <ProjectImageSlot
              src={project.isMirrorCard ? undefined : project.col1Img1}
              alt={`${project.name} preview 1`}
              variant="top-left"
              projectName={project.name}
              projectStatus={project.status}
            />
            <ProjectImageSlot
              src={project.isMirrorCard ? undefined : project.col1Img2}
              alt={`${project.name} preview 2`}
              variant="bottom-left"
              projectName={project.name}
              projectStatus={project.status}
            />
          </div>

          {/* Right Column (60% width / 7 cols): 1 tall slot */}
          <div className="md:col-span-7 flex">
            <ProjectImageSlot
              src={project.isMirrorCard ? undefined : project.col2Img}
              alt={`${project.name} main preview`}
              variant="tall-right"
              projectName={project.name}
              projectStatus={project.status}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const ProjectsSection: FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  return (
    <section
      ref={containerRef}
      id="projects"
      className="relative z-10 bg-[#090909] text-[#f2f2f0] px-4 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 w-full min-h-[380vh]"
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
          />
        ))}
      </div>
    </section>
  );
};
