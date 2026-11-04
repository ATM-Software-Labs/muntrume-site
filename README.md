Aquí tienes el README DEFINITIVO, ya con fotos, estructura limpia para el usuario y todo detallado. Es la versión que usan los equipos grandes.

Solo tienes que crear la carpeta `docs/screenshots/` y meter ahí las 7 capturas que me pasaste con estos nombres.

Copia y pega esto entero:

# MUNTRUME MOTORSPORT
### Sant Andreu, Barcelona — iRacing Sim Racing Team

> **PRECISION RACING. ENGINEERED TO WIN.**

Escudería independiente de iRacing con base en Sant Andreu, Barcelona. 4 pilotos oficiales, 196 coches y 239.539 setups validados con telemetría Garage 61 y MoTeC i2 Pro.

**[ Web - muntru.me ](https://muntru.me) | [ Garage Access ](https://muntru.me/garage) | [ Paddock ](https://muntru.me/paddock) | [ Discord ](https://discord.gg/ehX6B8JUtE)**

---

### Platform Showcase

<p align="center">
  <img src="docs/screenshots/home-hero.png" width="100%" alt="Muntrume Home - Precision Racing" />
</p>

<p align="center">
  <em>Home — Hero limpio, stats unificados y acceso directo al Garage</em>
</p>

---

### Official Lineup 2026

4 pilotos homologados para GTP, GT3 Endurance y Monoplazas.

<p align="center">
  <img src="docs/screenshots/pilotos-equipo.png" width="100%" alt="Pilotos del Equipo - 4 Drivers" />
</p>

| # | Piloto | Rol | Especialidad |
| :--- | :--- | :--- | :--- |
| **#1** | **Alberto Trujillo** | Team Principal & Telemetría | Dinámica vehicular, análisis 60Hz |
| **#2** | **Mateo Berbis** | Lead Sprint & Qualy | Vuelta rápida, clasificación |
| **#3** | **Eduardo Chongkan** | Race Engineer & Prototipos | Curvas rápidas, resistencia |
| **#4** | **Juanlu Carrillo** | Monoplazas Specialist | Alta carga aerodinámica, Formula |

---

### Estructura: Paddock + Garage

Hemos simplificado 7 páginas en 2 conceptos.

#### 1. MUNTRUME PADDOCK — El Club (Público)

<p align="center">
  <img src="docs/screenshots/about-muntrume.png" width="48%" alt="About Muntrume - Canales Oficiales" />
  <img src="docs/screenshots/contacto-oficial.png" width="48%" alt="Contacto Oficial - Paddock Pass" />
</p>

Donde entra todo el mundo. Manifiesto del equipo, canales oficiales y solicitud de ingreso.

- **Discord:** Radio oficial del equipo
- **YouTube:** @jostrume18gameplays28 — Onboards y análisis
- **Twitch:** muntrumemrt — Live stints
- **Request Paddock Pass:** Formulario de ingreso en /paddock

#### 2. MUNTRUME GARAGE — Área Privada (Solo Pilotos)

<p align="center">
  <img src="docs/screenshots/setup-vault.png" width="100%" alt="Muntrume Setup Vault - 41k Setups" />
</p>

<p align="center">
  <em>Setup Vault — 239.539 setups con guardado en 1 clic en Documents\iRacing\setups</em>
</p>

<p align="center">
  <img src="docs/screenshots/team-comms.png" width="100%" alt="Team Comms - Buzón Privado" />
</p>

<p align="center">
  <em>Team Comms — Buzón privado, telemetría .STO y MoTeC i2 Pro</em>
</p>

**Box #1: Setup Vault**
196 coches oficiales, 239.539 .STO firmados `muntru.me - Setup by Alberto Trujillo`. Variantes Q, R, Endurance y Wet. Guardado directo en 1 clic.

**Box #2: Comms & Telemetry**
Buzón privado con identidad verificada `alberto.muntrume@trujillomingorance.com`. Intercambio de logs MoTeC y archivos .STO. Mailbox isolation entre pilotos.

**Box #3: Race Center**
Briefings, estrategia y calendario de especiales de iRacing.

---

### Press Room & Media Wire

<p align="center">
  <img src="docs/screenshots/press-room.png" width="100%" alt="Press Room & Media Wire" />
</p>

Wire en vivo conectado a RSS públicos de iRacing, Sim Racing y Motorsport. Team updates y titulares oficiales.

---

### Mobile First — 100% Responsive

Diseñado para 375px, 390px y 412px. 40px touch targets, scroll chips y cero overflow.

<p align="center">
  <img src="docs/screenshots/mobile-home.png" width="30%" alt="Mobile Home" />
  <img src="docs/screenshots/mobile-setups.png" width="30%" alt="Mobile Setup Vault" />
  <img src="docs/screenshots/mobile-preview-modal.png" width="30%" alt="Mobile Preview Modal" />
</p>

---

### ¿Cómo empiezo?

**Si eres fan:**
1. Entra al Paddock en Discord: discord.gg/ehX6B8JUtE
2. Sigue el calendario en muntru.me

**Si quieres ser piloto:**
1. Ve a muntru.me/paddock
2. Rellena Request Paddock Pass con tu nombre, email de iRacing e iRating
3. Te respondemos en < 24h con test de ritmo

**Si ya eres piloto oficial:**
1. Ve a muntru.me/garage
2. GARAGE ACCESS con tu email de piloto
3. Acceso total a Vault + Comms + Telemetry

---

<details>
<summary><b>Technical Stack (para devs)</b></summary>

| Layer | Tech |
| :--- | :--- |
| Frontend | Astro 5 + Tailwind 4 — SSG |
| Edge | Cloudflare Workers — Zero-Trust |
| DB | Cloudflare D1 — muntrume_vault |
| Email | Cloudflare Email Routing + Resend + PostalMime |
| Hosting | GitHub Pages Edge CDN |
| QA | Playwright E2E Mobile Audit |

Arquitectura: GitHub Pages -> Cloudflare Worker (Auth + Mail) -> D1 + Email Routing. Zero-Trust: PBKDF2 100k + HMAC 2FA 10m + HSTS preload + CSP frame-ancestors none.

</details>

---

**Muntrume Motorsport © 2026 — SimRacing Team — Sant Andreu, Barcelona, CAT — muntru.me**
**iRacing Sim Racing Team — GT3 Endurance | Prototypes GTP | Single-Seater — Discord: ehX6B8JUtE**
