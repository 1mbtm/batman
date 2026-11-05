# Arqam — Personal & Professional Portfolio

> Official personal and professional portfolio of **Muhammed Arqam Khan (Arqam)** — Entrepreneur & Founder | Software Developer. Built with **React 19**, **TypeScript**, **TailwindCSS**, **Framer Motion**, **Cloudflare Pages Functions**, and **Cloudflare D1**.

![Portfolio Preview](public/og-image.webp)

---

## ⚡ Overview

* **Identity**: Muhammed Arqam Khan (`Arqam`) — Entrepreneur & Founder | Software Developer from Sahibganj, Jharkhand, India.
* **Focus Areas**:
  1. Building technology products and digital solutions.
  2. Running and developing offline businesses.
  3. Freelancing, website development, and selling websites to clients.
* **Interactive 3D Liquid Dark UI**: Obsidian mirror finishes, specular sheens, scroll-reactive 3D elements, and responsive Swiss typography.
* **120 FPS Dual-Row Social Marquee**: Hardware-composited social and contact cards linking directly to GitHub, X, LinkedIn, Telegram, Reddit, Founder/Professional Instagram (`@1m.btm`), Personal Instagram (`@notarqam`), and Email.
* **Sticky Stacked Project Cards (All WebP Visuals)**:
  - `01` — **ALIF Billing Tool** (`Active Development` · `/projects/alif-billing-1..3.webp` · Private project toast notification)
  - `02` — **ALIF Website** (`Active` · `/projects/alif-1..3.webp` · [https://aliflt.netlify.app/](https://aliflt.netlify.app/))
  - `03` — **Ward Al Madinah** (`Client Project` · `/projects/ward-al-madinah-1..3.webp` · [https://wardalmadinah.pages.dev/](https://wardalmadinah.pages.dev/))
  - `04` — **SayNO** (`Experimental / Pending` · `/projects/sayno-1..3.webp` · [https://saynoapp.webtree.workers.dev/](https://saynoapp.webtree.workers.dev/))
  - `05` — **ASCOOL** (`Coming Soon` · `/projects/ascool-1..3.webp` · Upcoming project toast notification)
* **First-Party Visitor Analytics & Private Admin Dashboard (`/admin`)**:
  - **Location Tracking**: Explicit optional browser GPS permission (`latitude`, `longitude`, `accuracyMeters`, `timestamp`) + server-side Cloudflare IP geolocation fallback (`country`, `region`, `city`, `postalCode`), clearly distinguishing exact GPS from approximate IP estimates.
  - **Referral & Campaign Tracking**: Captures referrer domain/URL, supports `?ref=campaign_name` links with first-touch and last-touch attribution, and includes a built-in campaign URL generator.
  - **Device & Browser Telemetry**: Tracks Mobile/Desktop/Tablet, OS, browser & version, and screen dimensions.
  - **Privacy Controls**: Consent timestamp logging, one-click GPS consent withdrawal, visitor data deletion (`Location & Data Settings` in footer), salted SHA-256 IP hashing (raw IP addresses are never stored), and configurable 90-day auto-retention.

---

## 🛠️ Tech Stack

* **Frontend**: [React 19](https://react.dev/) + [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/) + [TailwindCSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
* **Backend & Database**: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) (`functions/api/analytics/[[route]].ts`) + [Cloudflare D1](https://developers.cloudflare.com/d1/) SQLite (`migrations/0001_visitor_analytics.sql`)

---

## 🚀 Quick Start & Cloudflare D1 Setup

### 1. Install Dependencies & Build
```bash
npm install
npm run build
```

### 2. Create the Cloudflare D1 Database & Apply Migrations
```bash
# 1. Create the D1 database
npx wrangler d1 create arqam-portfolio-analytics

# 2. Copy the returned database_id into wrangler.toml under [[d1_databases]]

# 3. Apply the SQL schema locally or to production
npx wrangler d1 migrations apply arqam-portfolio-analytics --local
npx wrangler d1 migrations apply arqam-portfolio-analytics --remote
```

### 3. Configure Required Secrets
Set the following secrets in your Cloudflare Pages project (via `npx wrangler pages secret put <NAME>` or Cloudflare Dashboard → Pages → Settings → Environment variables):

| Variable / Secret | Required | Description |
| :--- | :--- | :--- |
| `DB` | **Yes (D1 Binding)** | Cloudflare D1 database binding pointing to `arqam-portfolio-analytics` |
| `ADMIN_PASSWORD` | **Yes (Secret)** | Password required to unlock the Private Admin Dashboard at `/admin` |
| `ADMIN_TOKEN_SECRET` | **Yes (Secret)** | High-entropy secret string used to sign admin session tokens and salt daily IP hashes |
| `ANALYTICS_RETENTION_DAYS` | Optional (`"90"`) | Number of days to retain visit and session records before automatic cleanup |

---

## 📄 License

MIT License © [Muhammed Arqam Khan (Arqam)](https://github.com/1mbtm)
