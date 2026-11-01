<div align="center">

# 🏁 Muntrume Motorsport

**High-Performance Sim Racing Team & Engineering Vault**  
*Sant Andreu, Barcelona 🇪🇸*

[![Website](https://img.shields.io/badge/Production-muntru.me-10b981?style=for-the-badge&logo=googlechrome&logoColor=white)](https://muntru.me)
[![Stack](https://img.shields.io/badge/Astro-5.x-BC52EE?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build)
[![Backend](https://img.shields.io/badge/Cloudflare_Workers-D1_Vault-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Discord](https://img.shields.io/discord/1188239582865661992?style=for-the-badge&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/ehX6B8JUtE)

</div>

---

## 🏎️ Overview

**Muntrume Motorsport** is a sim racing team competing in **iRacing** (GTP, GT3, Endurance & Sprint). This repository hosts the official web portal, setup telemetry lab, driver profiles, and secured setup distribution vault.

```
                    ┌─────────────────────────┐
                    │    https://muntru.me    │
                    │   (GitHub Pages Edge)   │
                    └────────────┬────────────┘
                                 │
                     Astro SSG Component Pages
             (/, /setups, /pilotos, /team, /news, /mail)
                                 │
                   [ REST / JSON-RPC Endpoints ]
                                 ▼
                    ┌─────────────────────────┐
                    │   Cloudflare Worker     │
                    │ (muntrume_vault + Auth) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  Cloudflare D1 Database │
                    │   · Setup Metadata      │
                    │   · Telemetry Previews  │
                    │   · Team Events & Mail  │
                    └─────────────────────────┘
```

---

## 🏛️ Architecture & Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | [Astro](https://astro.build) 5.x + Tailwind CSS | Component-driven SSG, zero unnecessary client-side JavaScript, instant hydration. |
| **Edge Compute** | Cloudflare Workers (`worker/index.js`) | Zero-trust authentication, setup telemetry API, rate-limiting, internal webmail. |
| **Database** | Cloudflare D1 (`muntrume-vault`) | Driver directory, race event schedules, telemetry metadata, email preferences. |
| **CI/CD** | GitHub Actions (`deploy.yml`) | Automated SSG build, deterministic dependency verification, deployment to Pages. |

---

## 📁 Repository Structure

```
muntrume-site/
├── src/
│   ├── components/       # Reusable components (Navbar, Footer, etc.)
│   ├── layouts/          # Base Layout with SEO, OpenGraph, theme & security headers
│   └── pages/            # Astro static pages & dynamic routes (/p/[slug].astro)
├── public/
│   ├── assets/           # Production CSS, images, client scripts & telemetry catalogs
│   ├── CNAME             # muntru.me DNS routing
│   └── robots.txt        # Crawler & sitemap directives
├── worker/
│   ├── index.js          # Cloudflare Worker API & vault authorization
│   ├── emails.js         # Transactional & briefing email templates
│   └── migrations/       # D1 database schema migrations
├── astro.config.mjs      # Astro configuration (static output, directory format)
└── wrangler.jsonc        # Cloudflare Worker & D1 binding configuration
```

---

## 🔒 Security & Hardening

- **Zero-Trust Driver Authentication**: HMAC/Ed25519 token validation for private telemetry & `.sto` setup access.
- **Strict Content Security**: Explicit referrer policies (`strict-origin-when-cross-origin`), `nosniff`, and sanitized HTML rendering.
- **Rate Limiting**: Cloudflare edge rate-limiters protect sensitive endpoints against enumeration.
- **Privacy Standard**: Driver statistics and private records require explicit authorization; zero invented stats policy.

For vulnerability reporting, see [SECURITY.md](SECURITY.md).

---

## 🚀 Development & Build

### Prerequisites
- Node.js `v20+` or `v22+`
- npm `v10+`

### Local Development
```bash
# Install dependencies
npm install

# Start local Astro development server
npm run dev

# Build production static bundle to _site/
npm run build

# Preview production build locally
npm run preview
```

### Worker Deployment
```bash
# Deploy backend API & D1 bindings to Cloudflare
npx wrangler deploy
```

---

## 👥 Drivers Roster

| Driver | Discipline | Role |
|---|---|---|
| **Alberto Trujillo** | GTP / GT3 | Founder · Driver |
| **Mateo Berbis** | GT3 | Driver |
| **Eduardo Chongkan** | GT3 / GTP | Driver |
| **Juanlu Carrillo** | GT3 | Driver |

---

<div align="center">

**Muntrume Motorsport © 2026** · *Sant Andreu, Barcelona*  
[Website](https://muntru.me) • [Discord Community](https://discord.gg/ehX6B8JUtE) • [Contact](https://muntru.me/contact)

</div>
