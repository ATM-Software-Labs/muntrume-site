# MUNTRUME MOTORSPORT
### Sant Andreu, Barcelona — iRacing Sim Racing Team

> PRECISION RACING. ENGINEERED TO WIN.

Muntrume Motorsport es una escudería independiente de sim racing con base en Sant Andreu, Barcelona. Compite en iRacing en GTP, GT3 Endurance y monoplazas.

**Production:** [muntru.me](https://muntru.me) | **Garage:** [muntru.me/garage](https://muntru.me/garage) | **Paddock:** [muntru.me/paddock](https://muntru.me/paddock) | **Discord:** [discord.gg/ehX6B8JUtE](https://discord.gg/ehX6B8JUtE)

---

### Official Lineup — 4 Pilotos

| # | Piloto | Rol |
| :--- | :--- | :--- |
| **#1** | **Alberto Trujillo** | Team Principal & Telemetría |
| **#2** | **Mateo Berbis** | Lead Sprint & Qualy Driver |
| **#3** | **Eduardo Chongkan** | Race Engineer & Prototipos |
| **#4** | **Juanlu Carrillo** | Monoplazas & Formula Specialist |

---

### Estructura: Paddock + Garage

Ya no hay 7 páginas separadas. Todo el proyecto son 2 conceptos:

**1. MUNTRUME PADDOCK — `/paddock`**
El club. Público. Donde entra la comunidad, patrocinadores y nuevos pilotos.
- Manifiesto del equipo
- Canales oficiales: Discord, YouTube @jostrume18gameplays28, Twitch muntrumemrt
- Request Paddock Pass (formulario de ingreso)

**2. MUNTRUME GARAGE — `/garage`**
El área privada. Solo para pilotos oficiales. Login único.
- **Box #1: Setup Vault** — Catálogo oficial de setups .STO
- **Box #2: Comms & Telemetry** — Buzón privado + logs MoTeC i2 Pro + Garage 61
- **Box #3: Race Center** — Briefings, estrategia y calendario

Un solo botón en toda la web: `GARAGE ACCESS`.

---

### Garage Capabilities

- **196 coches / 239,539 setups** oficiales de iRacing (GT3, GTP Hypercars, LMP2, LMP3, GT4, TCR, F1). Todos firmados: `muntru.me - Muntrume Motorsport | Setup by Alberto Trujillo`.
- **1-Click Sync:** Guardado directo en `Documents\iRacing\setups\[car]` con File System Access API en desktop. En móvil, descarga limpia de .STO y .zip.
- **Session Variants:** Qualy (Q), Race (R), Endurance, Wet incluidos por coche/circuito.
- **Preview Técnico:** Header binario del .STO, parámetros del coche y leaderboard de Garage 61.
- **Verified Comms:** Identidad verificada `Alberto de Muntrume <alberto.muntrume@trujillomingorance.com>` con DKIM/SPF/DMARC via Resend + Cloudflare Email Routing.

<p align="center">
  <img src="docs/screenshots/mobile-home.png" width="30%" alt="Home Mobile" />
  <img src="docs/screenshots/mobile-setups.png" width="30%" alt="Garage Mobile" />
  <img src="docs/screenshots/mobile-preview-modal.png" width="30%" alt="Preview Mobile" />
</p>

---

### Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | Astro 5 + Tailwind CSS 4 — SSG minificado |
| Edge | Cloudflare Workers — Auth Zero-Trust + Webhooks |
| Database | Cloudflare D1 — `muntrume_vault` |
| Email | Cloudflare Email Routing + Resend API + PostalMime |
| Hosting | GitHub Pages Edge CDN |
| QA | Playwright E2E — Test de responsive 375/390/412px |

**Arquitectura:**

```
https://muntru.me (GitHub Pages)
        |
        v
Cloudflare Worker (muntrume.atrumin16.workers.dev)
- PBKDF2 Auth + HMAC 2FA
- PostalMime Decoder
- Security Headers (HSTS preload, DENY, nosniff, CSP frame-ancestors 'none')
        |
        +--> D1 (muntrume_vault)
        +--> Email Routing
```

---

### Security

Zero-Trust por diseño. Mailbox isolation entre pilotos. 2FA de un solo uso con validez de 10 min. Ver detalles completos en SECURITY.md.

### Domain Portability

100% domain-agnostic. Para migrar de `muntru.me` a otro dominio:

1. Cambia `public/CNAME`
2. Apunta tu CNAME a `atrumin16.github.io`

Canonicals, OG tags y sitemap se adaptan automáticamente. El Worker ya permite `*.trujillomingorance.com` y `muntru.me`.

---

**Muntrume Motorsport © 2026 — Sant Andreu, Barcelona, CAT — muntru.me — iRacing Sim Racing Team**
