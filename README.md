# Arqam — Personal & Professional Portfolio

> Official personal and professional portfolio of **Muhammed Arqam Khan (Arqam)** — Entrepreneur & Founder | Software Developer. Built with **React 19**, **TypeScript**, **TailwindCSS**, and **Framer Motion**.

![Portfolio Preview](public/og-image.png)

---

## ⚡ Overview

* **Identity**: Muhammed Arqam Khan (`Arqam`) — Entrepreneur & Founder | Software Developer from Sahibganj, Jharkhand, India.
* **Focus Areas**:
  1. Building technology products and digital solutions.
  2. Running and developing offline businesses.
  3. Freelancing, website development, and selling websites to clients.
* **Interactive 3D Liquid Dark UI**: Obsidian mirror finishes, specular sheens, scroll-reactive 3D elements, and responsive Swiss typography.
* **120 FPS Dual-Row Social Marquee**: Hardware-composited social and contact cards linking directly to GitHub, X, LinkedIn, Telegram, Reddit, Founder/Professional Instagram (`@1m.btm`), Personal Instagram (`@notarqam`), and Email.
* **Sticky Stacked Project Cards**: Showcasing active ventures, client projects, experimental concepts, and upcoming work with built-in obsidian mirror fallback slots ready for project screenshots.

---

## 🛠️ Tech Stack

* **Framework**: [React 19](https://react.dev/) + [Vite](https://vite.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
* **Styling**: [TailwindCSS](https://tailwindcss.com/)
* **Motion & Physics**: [Framer Motion](https://www.framer.com/motion/)
* **Icons**: [Lucide React](https://lucide.dev/) + Custom SVG Vectors
* **Image Optimization**: [Sharp](https://sharp.pixelplumbing.com/) (WebP pipeline)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open `http://localhost:5174` in your browser.

### 3. Production Build
```bash
npm run build
```

---

## 🖼️ Adding Project Images Later

Each project card in `src/components/ProjectsSection.tsx` has three image slots (`col1Img1`, `col1Img2`, and `col2Img`). When an image slot is empty (`""` or omitted), it automatically renders an obsidian mirror placeholder card with the exact same aspect ratio and border radius.

To add real project screenshots later:

1. Place your `.webp` (or `.png` / `.jpg`) images inside `public/projects/` (for example: `public/projects/alif-billing-1.webp`, `public/projects/alif-billing-2.webp`, `public/projects/alif-billing-3.webp`).
2. Open `src/components/ProjectsSection.tsx` and update the corresponding project entry in `projectsData`:
   ```ts
   {
     number: "01",
     name: "ALIF Billing Tool",
     category: "Business Management Tool",
     status: "Active Development",
     description: "A billing and business management tool associated with ALIF.",
     col1Img1: "/projects/alif-billing-1.webp", // Top-left slot
     col1Img2: "/projects/alif-billing-2.webp", // Bottom-left slot
     col2Img: "/projects/alif-billing-3.webp",  // Tall right slot
   }
   ```
3. Optional: If you want to add a live URL button to a project card, add `link: "https://your-project-url.com"` to that project object in `projectsData`.

---

## 📄 License

MIT License © [Muhammed Arqam Khan (Arqam)](https://github.com/1mbtm)
