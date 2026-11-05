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
* **Security-Hardened First-Party Visitor Analytics & Private Admin Dashboard (`/admin`)**:
  - **Fail-Closed Admin Authentication**: Requires `ADMIN_PASSWORD` and `ADMIN_TOKEN_SECRET` (no default/fallback passwords), issues HMAC-SHA256 signed session tokens with server-side session expiration, and enforces brute-force login lockout (`rate_limits`).
  - **Cryptographic Visitor Ownership Verification**: Issues a server-generated 256-bit `visitorToken` (`HttpOnly; Secure; SameSite=Strict` cookie + `X-Visitor-Token` header) verified against `visitors.visitor_token_hash` before permitting any consent, privacy read, GPS withdrawal, or deletion request.
  - **Location Tracking & Complete GPS Withdrawal**: Explicit optional browser GPS consent (`POST /api/analytics/consent`) + Cloudflare IP geolocation fallback (`location_source = 'ip'`). Withdrawing GPS consent immediately clears stored GPS coordinates across `visitors`, `visits`, and `location_consents` while preserving the consent audit trail.
  - **Automated Scheduled Retention Cleanup**: Purges expired `visits`, `sessions`, `location_consents`, unreferenced `visitors`, and orphaned records via a daily Cloudflare Cron Trigger Worker (`workers/retention-cron.ts` / `wrangler.cron.toml`) and periodic background checks.

---

## 🛠️ Tech Stack

* **Frontend**: [React 19](https://react.dev/) + [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/) + [TailwindCSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
* **Backend & Database**: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) (`functions/api/analytics/[[route]].ts`) + [Cloudflare D1](https://developers.cloudflare.com/d1/) SQLite (`migrations/`) + Scheduled Cron Worker (`workers/retention-cron.ts`)

---

## 🚀 Cloudflare D1, Secrets & Cron Trigger Setup

### 1. Install Dependencies & Build
```bash
npm install
npm run build
```

### 2. Create the Cloudflare D1 Database & Apply Migrations
```bash
# 1. Create the D1 database in your Cloudflare account
npx wrangler d1 create arqam-portfolio-analytics

# 2. Uncomment [[d1_databases]] in wrangler.toml (and wrangler.cron.toml) and paste the real database_id UUID

# 3. Apply the SQL migrations locally and to production
npx wrangler d1 migrations apply arqam-portfolio-analytics --local
npx wrangler d1 migrations apply arqam-portfolio-analytics --remote
```

### 3. Configure Required Secrets
Admin authentication fails closed (`503 Service Unavailable`) if `ADMIN_PASSWORD` or `ADMIN_TOKEN_SECRET` is missing. Set them via `npx wrangler pages secret put <NAME>` or in **Cloudflare Dashboard → Workers & Pages → your project → Settings → Environment variables**:

| Variable / Secret | Required | Description |
| :--- | :--- | :--- |
| `DB` | **Yes (D1 Binding)** | Cloudflare D1 database binding pointing to `arqam-portfolio-analytics` |
| `ADMIN_PASSWORD` | **Yes (Secret)** | Strong password (minimum 8 chars) required to unlock `/admin` |
| `ADMIN_TOKEN_SECRET` | **Yes (Secret)** | High-entropy secret string (minimum 16 chars, e.g. `openssl rand -hex 32`) for HMAC session signing & daily IP hash salting |
| `CRON_SECRET` | Optional (Secret) | Bearer secret for triggering `POST /api/analytics/cron/cleanup` via external webhook |
| `ANALYTICS_RETENTION_DAYS` | Optional (`"90"`) | Retention window in days before expired visits, sessions, consents, and unreferenced visitors are purged |
| `ALLOWED_ORIGIN` | Optional (`"https://batman-7y3.pages.dev"`) | Comma-separated list of allowed origins for CORS validation on `/api/analytics/*` |

### 4. Deploy the Recurring Retention Cron Trigger Worker
Cloudflare Pages Functions execute on HTTP requests; to guarantee retention cleanup runs on a daily recurring schedule (`0 3 * * *` — 03:00 UTC daily) even during zero-traffic periods, deploy the companion Cron Worker in `workers/retention-cron.ts`:
```bash
# Ensure [[d1_databases]] in wrangler.cron.toml has your real D1 database_id, then run:
npx wrangler deploy --config wrangler.cron.toml
```

---

## 📄 License

MIT License © [Muhammed Arqam Khan (Arqam)](https://github.com/1mbtm)
