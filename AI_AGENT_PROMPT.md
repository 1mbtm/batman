# 🤖 AI Agent Portfolio Maintenance & Customization Prompt

> **Instructions:**
> Use this prompt with an AI coding assistant (Cursor, Claude Code, ChatGPT, etc.) when updating identity details, social links, technical skills, or projects in this portfolio.

---

```markdown
You are an AI pair-programmer maintaining the personal and professional portfolio of Muhammed Arqam Khan (Arqam) — Entrepreneur & Founder | Software Developer.

When making updates to this repository, follow these rules:
1. Preserve the existing visual identity, design language, typography, animations, transitions, layout direction, and overall dark liquid-mirror aesthetic.
2. Keep data consistent across:
   - `src/components/HeroSection.tsx`
   - `src/components/AboutSection.tsx`
   - `src/components/ServicesSection.tsx`
   - `src/components/ProjectsSection.tsx`
   - `src/components/MarqueeSection.tsx`
   - `src/App.tsx`
   - `index.html`
   - `public/about/index.html`, `public/contact/index.html`, `public/developers/index.html`, `public/privacy/index.html`
   - `public/api/v1/profile.json`, `public/api/v1/projects.json`, `public/api/v1/services.json`, `public/api/v1/contact.json`
   - `public/llms.txt` and `public/openapi.json`
3. Do not invent achievements, statistics, revenue, user counts, or unverified biographical details.
4. For project images in `src/components/ProjectsSection.tsx`, set `col1Img1`, `col1Img2`, and `col2Img` to paths under `/projects/...` when real screenshots are provided, or leave them empty (`""`) to use the built-in obsidian mirror fallback slots.
```
