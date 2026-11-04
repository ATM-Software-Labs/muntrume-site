# Muntrume Motorsport

Official sim racing team platform, confidential iRacing setup vault (196 cars, 239,539 setups), raw FTP directory explorer, Garage 61 telemetry integration, and secure driver communications under the ATM Software Labs ecosystem.

[Production Site](https://muntru.me) | [Setup Vault](https://muntru.me/setups) | [Driver Webmail](https://muntru.me/mail) | [Official Discord](https://discord.gg/ehX6B8JUtE) | [Security Policy](SECURITY.md)

---

## Overview

Muntrume Motorsport is an independent iRacing team based in Barcelona, Spain. The platform provides drivers with automated setup distribution directly into local iRacing directories, Garage 61 lap telemetry analysis, an integrated raw FTP repository, and a zero-trust institutional webmail client.

- 196 official iRacing vehicles supported across GT3, GTP Hypercars, LMP2, LMP3, and Formula series.
- 239,539 digitally signed `.sto` setup files with official watermarks (`muntru.me - Muntrume Motorsport | Setup by Alberto Trujillo`).
- Complete integration of team archives: ZEK Racing (Garage 61 and FTP), MT_SETUPS, and normalized legacy collections.
- Zero-Trust edge architecture deployed on Cloudflare Workers, Cloudflare D1, and GitHub Pages.

---

## Mobile Interface Showcase

The platform is engineered with a mobile-first responsive layout (375px, 390px, 412px viewports) featuring touch-friendly 40px interaction targets, horizontal scroll chips, and zero overflow.

<p align="center">
  <img src="docs/screenshots/mobile-home.png" width="31%" alt="Mobile Home View" />
  &nbsp;
  <img src="docs/screenshots/mobile-setups.png" width="31%" alt="Mobile Setup Vault" />
  &nbsp;
  <img src="docs/screenshots/mobile-preview-modal.png" width="31%" alt="Mobile Preview Modal" />
</p>

---

## Core Capabilities

### Setup Vault & FTP Directory Explorer
- Raw FTP Directory Browser: Integrated web-based FTP directory view (`ftp://vault.muntrume.internal/setups/`) for direct inspection, sorting, and stream-downloading of `.sto` files.
- Direct File System Sync: Injects setups directly into `Documents\iRacing\setups\[car]` using the File System Access API on desktop browsers.
- Adaptive Mobile Downloads: Automatically provides clean `.sto` and zip package downloads without desktop configuration prompts.
- Session Variants: Multi-file setup packages including Qualy (Q), Race (R), Endurance (Endur), and Wet presets.
- Technical Preview Modal: Displays binary setup header notes, vehicle parameters, and Garage 61 team leaderboards.

### Institutional Webmail (`/mail`)
- Dedicated corporate client for team principals, drivers, and track engineers.
- Verified sender identity: `Alberto de Muntrume <alberto.muntrume@trujillomingorance.com>`.
- Inbound and outbound routing via Cloudflare Email Routing with PostalMime multipart parsing.
- Persistent message storage in Cloudflare D1 database.

### Zero-Trust Security
- PBKDF2-SHA256 password derivation with 100,000 iterations.
- One-Time 2FA authentication codes signed via HMAC-SHA256 (10-minute validity, constant-time verification).
- Strict HTTP headers: strict HSTS with preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and CSP with `frame-ancestors 'none'`.
- Driver mailbox isolation preventing unauthorized cross-account access.

---

## Technical Stack

| Layer | Technology | Function |
| :--- | :--- | :--- |
| Frontend | Astro 5 + Tailwind CSS 4 | Static site generation (SSG) with optimized assets and minified HTML. |
| Edge API | Cloudflare Workers (`worker/index.js`) | Zero-Trust authentication, telemetry relay, and email webhooks. |
| Database | Cloudflare D1 (`muntrume_vault`) | Setup catalog metadata, authorized roster, and email messages. |
| Email Relay | Resend API + Cloudflare Email Routing | Verified DKIM, SPF, and DMARC dispatch under `trujillomingorance.com`. |
| Web Hosting | GitHub Pages Edge CDN | High-availability global static delivery. |
| Testing | Playwright E2E Suite (`scripts/test-mobile.mjs`) | Headless cross-route responsive audit and interaction testing. |
| Standards | ATM Software Labs Engineering Standards | Architectural hygiene, surgical changes, and high-performance SimOps. |

---

## System Architecture

```
                       +-------------------------------+
                       |       https://muntru.me       |
                       |      (GitHub Pages Edge)      |
                       +---------------+---------------+
                                       |
                         Static Astro SSG Pages
                 (/, /setups, /mail, /news, /team, /p/*)
                                       |
                        REST / JSON-RPC Requests
                                       v
                       +-------------------------------+
                       |      Cloudflare Worker        |
                       | (muntrume.atrumin16.workers)  |
                       +---------------+---------------+
                       | PBKDF2-100k Authentication    |
                       | HMAC-SHA256 2FA Engine        |
                       | PostalMime Email Decoder      |
                       | Strict Security Headers       |
                       +-------+---------------+-------+
                               |               |
                               v               v
                     +------------------+ +-------------------+
                     |  Cloudflare D1   | | Cloudflare Email  |
                     | (muntrume_vault) | |      Routing      |
                     +------------------+ +-------------------+
```

---

## Domain Portability

The platform is engineered to be fully domain-agnostic. If the primary domain `muntru.me` expires or is transitioned to an alternate domain or subdomain (such as `muntrume.trujillomingorance.com`), migration requires only updating the CNAME host without changing application code:

1. Update `public/CNAME` to the designated hostname (e.g., `muntrume.trujillomingorance.com`).
2. Point your DNS provider's CNAME record to `atrumin16.github.io`.

All canonical URLs, Schema.org structured data, Open Graph tags, and sitemaps automatically adapt through dynamic site resolution. The Cloudflare Worker CORS policy already permits `*.trujillomingorance.com` and `muntru.me` origins.

---

## Official Lineup

- Alberto Trujillo - Team Principal & Driver
- Mateo Berbis - Endurance & GT3 Driver
- Eduardo Chongkan - Prototype & Formula Driver
- Juanlu Carrillo - Touring & Cup Driver

---

Muntrume Motorsport (c) 2026. Sant Andreu, Barcelona.
