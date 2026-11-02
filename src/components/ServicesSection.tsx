import type { FC } from 'react';
import { FadeIn } from './FadeIn';

interface ServiceItem {
  number: string;
  name: string;
  description: string;
}

interface SkillGroup {
  category: string;
  items: string[];
}

const servicesData: ServiceItem[] = [
  {
    number: "01",
    name: "Technology Products & Digital Solutions",
    description: "Exploring ideas, experimenting with technology, and building practical software products and web applications.",
  },
  {
    number: "02",
    name: "Offline Business Ventures",
    description: "Running and developing real-world offline business operations alongside software tools built to support them.",
  },
  {
    number: "03",
    name: "Freelancing & Website Development",
    description: "Designing, developing, and selling custom websites tailored to clients and business needs.",
  },
  {
    number: "04",
    name: "Systems & Reverse Engineering",
    description: "Understanding how systems work underneath by experimenting, breaking things down, and building practical solutions.",
  },
];

const skillGroups: SkillGroup[] = [
  {
    category: "Frontend",
    items: ["React", "JavaScript", "TypeScript", "HTML", "CSS"],
  },
  {
    category: "Backend",
    items: ["Node.js", "Firebase"],
  },
  {
    category: "Development & Infrastructure",
    items: ["APIs", "Databases", "Git", "Cloudflare"],
  },
  {
    category: "Programming",
    items: ["Python"],
  },
];

export const ServicesSection: FC = () => {
  return (
    <section
      id="expertise"
      className="relative z-10 bg-[#f2f2f0] text-[#090909] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 w-full"
    >
      {/* Heading */}
      <FadeIn delay={0} y={40}>
        <h2
          className="font-black uppercase text-center text-[#090909] leading-none tracking-tight mb-16 sm:mb-20 md:mb-28 select-none"
          style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
        >
          Expertise
        </h2>
      </FadeIn>

      {/* Core Work Areas List */}
      <div className="max-w-5xl mx-auto flex flex-col">
        {servicesData.map((item, index) => (
          <FadeIn
            key={item.number}
            delay={index * 0.1}
            y={30}
            className="border-b border-[#090909]/15 py-8 sm:py-10 md:py-12 first:border-t"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-8 md:gap-12">
              {/* Left: Number */}
              <div
                className="font-black text-[#090909] leading-none select-none min-w-[120px] sm:min-w-[160px] md:min-w-[200px]"
                style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
              >
                {item.number}
              </div>

              {/* Right: Stacked Name + Description */}
              <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                <h3
                  className="font-medium uppercase text-[#090909] leading-snug"
                  style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}
                >
                  {item.name}
                </h3>
                <p
                  className="font-light leading-relaxed max-w-2xl text-[#090909]/65"
                  style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.25rem)' }}
                >
                  {item.description}
                </p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Technical Skills — Technologies Worked With */}
      <div id="skills" className="max-w-5xl mx-auto mt-20 sm:mt-24 md:mt-32">
        <FadeIn delay={0.1} y={30}>
          <div className="mb-10 sm:mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-[#090909]/55 block mb-2">
              TECHNICAL STACK
            </span>
            <h3
              className="font-black uppercase text-[#090909] leading-none tracking-tight"
              style={{ fontSize: 'clamp(2rem, 5.5vw, 4.5rem)' }}
            >
              Technologies Worked With
            </h3>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 border-t border-[#090909]/15 pt-8 sm:pt-10">
          {skillGroups.map((group, idx) => (
            <FadeIn
              key={group.category}
              delay={idx * 0.08}
              y={20}
              className="border border-[#090909]/15 rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-4 bg-[#090909]/[0.02]"
            >
              <span className="font-mono text-xs uppercase tracking-widest text-[#090909]/60">
                {group.category}
              </span>
              <div className="flex flex-wrap gap-2.5">
                {group.items.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center rounded-full border border-[#090909]/25 px-4 py-1.5 text-xs sm:text-sm font-medium uppercase tracking-wider text-[#090909]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};
