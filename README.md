# MUNTRUME MOTORSPORT
### Sant Andreu, Barcelona — 【entity-iRacing¦canonical_name=iRacing】 Sim Racing Team

Precision Racing. Engineered to Win.

**[muntru.me](https://muntru.me) — [Garage Access](https://muntru.me/garage) — [Paddock](https://muntru.me/paddock) — [【entity-Discord¦canonical_name=Discord】](https://discord.gg/ehX6B8JUtE)**

---

### The Team

Escudería independiente de 【entity-iRacing¦canonical_name=iRacing】 basada en Barcelona. 4 pilotos oficiales. Ingeniería, telemetría y setups para resistencia.

- **Alberto Trujillo** — Team Principal & Telemetry
- **Mateo Berbis** — Lead Sprint & Qualy
- **Eduardo Chongkan** — Race Engineer & Prototipos
- **Juanlu Carrillo** — Monoplazas & Formula Specialist

### What is Muntrume?

Un solo sitio para todo el equipo:

**1. Muntrume Paddock** — El club. Donde entra la comunidad. 【entity-Discord¦canonical_name=Discord】, onboard, roster.
**2. Muntrume Garage** — El área privada. Solo pilotos oficiales.
   - `Box #1: Setup Vault` — 239k setups .STO validados
   - `Box #2: Comms & Telemetry` — Mail privado + logs MoTeC i2 Pro + Garage 61
   - `Box #3: Race Center` — Briefings y calendario

No hay 7 páginas. Hay Paddock y Garage.

### Garage Features

- **1-Click Sync:** Guarda directo en `Documents\iRacing\setups\[car]` con File System Access API. Sin zips.
- **Mobile Ready:** Descarga limpia de .STO en móvil (375px / 390px / 412px tested).
- **196 cars / 239,539 setups** — GT3, GTP, LMP2, LMP3, Formula. Firmados `muntru.me - Setup by Alberto Trujillo`.
- **Verified Comms:** `alberto.muntrume@trujillomingorance.com` vía Cloudflare Email Routing + Resend (DKIM/SPF/DMARC).

### Tech Stack

| Layer | Stack |
| :--- | :--- |
| Site | Astro 5 + Tailwind 4 — SSG |
| Edge | Cloudflare Workers — Zero-Trust Auth |
| DB | Cloudflare D1 (muntrume_vault) |
| Mail | Cloudflare Email Routing + PostalMime |
| Host | GitHub Pages Edge CDN |


### Quick Start

1. Entra al Paddock: [【entity-discord¦canonical_name=Discord】.gg/ehX6B8JUtE](https://discord.gg/ehX6B8JUtE)
2. Pilotos: Garage Access con tu email de piloto.
3. ¿Quieres unirte? Request Paddock Pass en `/paddock`.

### Security

Zero-Trust: PBKDF2 + HMAC 2FA (10m), HSTS preload, CSP `frame-ancestors 'none'`, mailbox isolation. Ver `SECURITY.md`.

---

**Muntrume Motorsport © 2026 — Sant Andreu, Barcelona — muntru.me**
