import { HeroSection } from './components/HeroSection';
import { MarqueeSection } from './components/MarqueeSection';
import { AboutSection } from './components/AboutSection';
import { ServicesSection } from './components/ServicesSection';
import { ProjectsSection } from './components/ProjectsSection';
import { ContactButton } from './components/ContactButton';
import { AudioPlayer } from './components/AudioPlayer';

export function App() {
  const EMAIL = '1m.btmnnn@gmail.com';

  return (
    <div className="bg-[#090909] text-[#f2f2f0] font-sans antialiased overflow-x-clip min-h-screen selection:bg-[#b8b8b8] selection:text-[#090909]">
      {/* 1. HERO SECTION */}
      <HeroSection />

      {/* 2. MARQUEE SECTION */}
      <MarqueeSection />

      {/* 3. ABOUT SECTION */}
      <AboutSection />

      {/* 4. EXPERTISE & SKILLS SECTION */}
      <ServicesSection />

      {/* 5. PROJECTS SECTION */}
      <ProjectsSection />

      {/* FOOTER / CONTACT SECTION */}
      <footer id="contact" className="bg-[#090909] py-20 sm:py-24 md:py-32 px-6 md:px-10 border-t border-[#e0dfdb]/10 flex flex-col items-center justify-center text-center">
        {/* Avatar Mark */}
        <div className="mb-8">
          <img
            src="/avatar.webp"
            alt="Arqam"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-[#e0dfdb]/20 shadow-2xl object-cover"
          />
        </div>

        <h2 className="hero-heading font-black uppercase text-4xl sm:text-6xl md:text-8xl tracking-tight mb-6 select-none">
          LET&apos;S BUILD SOMETHING
        </h2>
        
        <p className="text-[#f2f2f0]/70 text-base sm:text-xl max-w-2xl mb-10 font-light uppercase tracking-wider leading-relaxed">
          HAVE AN IDEA, A PROBLEM, OR JUST WANT TO TALK? LET&apos;S CONNECT AND SEE WHERE IT LEADS.
        </p>

        <ContactButton label="Get In Touch" href={`mailto:${EMAIL}`} />

        <p className="mt-16 text-xs text-[#b8b8b8]/50 uppercase tracking-widest font-mono">
          © {new Date().getFullYear()} Arqam · Muhammed Arqam Khan. All rights reserved.
        </p>
      </footer>

      {/* AMBIENT AUDIO PLAYER (Auto-plays on first scroll/touch) */}
      <AudioPlayer />
    </div>
  );
}

export default App;
