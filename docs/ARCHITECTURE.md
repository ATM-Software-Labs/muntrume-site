# Arquitectura del Ecosistema Muntrume (`muntru.me`)

## Visión general

El ecosistema de Muntrume Motorsport se divide en tres capas desacopladas:

1. **Web estática (`muntrume-site` → GitHub Pages `https://muntru.me`)**
   - Generada con **Astro** + **Tailwind CSS 4** + **TypeScript**.
   - Salida estática en `_site/` con minificado de assets, compresión HTML y sitemap automático (`npm run build`).
   - Multi-idioma (`es`, `ca`, `en`, `fr`) emitido desde `src/i18n/emit.mjs`.
   - Incluye el portal oficial, Garage Vault (42.654+ setups `.sto`), Directorio de 150 circuitos, Calendario 2026 S4, Paddock, Galería, Panel Admin y el frontend de **Muntrume AI Studio** (`/ai/` y `/ai-docs/`).

2. **Edge API & Hosting de Artefactos (`muntrume-worker-private` → Cloudflare Worker `muntrume`)**
   - Dominio propio: `https://ai.muntru.me` y origen `https://muntrume.atrumin16.workers.dev`.
   - **Cloudflare D1 (`muntrume-vault`)**: usuarios aprobados, perfiles/licencias de pilotos, catálogo `.sto`, fotos de galería y artefactos publicados (`ai_artifacts`).
   - **Durable Object (`PaddockRoom`)**: presencia y chat en tiempo real del Paddock.
   - **Cloudflare Workers AI (`env.AI`)** + proveedores externos (Groq / Gemini) con enrutamiento por tier y fallback automático.
   - **Proxy Edge `ai.muntru.me`**: sirve `/` (desde `muntru.me/ai/`), `/docs/` (desde `muntru.me/ai-docs/`), artefactos alojados `/a/<slug>`, `/a/<slug>/raw`, perfiles `/u/<handle>` y ficheros de descubrimiento (`llms.txt`, `ai-knowledge.json`, `ai-openapi.json`, `.well-known/ai-plugin.json`).

3. **Cliente de Escritorio (`desktop/` → MMT Sync para Windows)**
   - **Tauri v2 + Rust + TypeScript** (`winget install Muntrume.MMTSync`).
   - Sincroniza setups `.sto` por SHA-256 en `Documents\iRacing\setups\MMT`.
   - Lee telemetría iRSDK en tiempo real a 60 Hz (`FILE_MAP_READ`) y renderiza overlays transparentes.

## Flujo de despliegue

- **Frontend (`muntrume-site`)**: `git push origin main` → GitHub Actions (`deploy.yml`) ejecuta `npm ci`, `npm run check`, `npm run build` y publica `_site/` en GitHub Pages.
- **Desktop (`desktop/`)**: tags de release disparan `desktop-release.yml` para compilar instaladores `.exe`/`.msi` y actualizar el manifest de `winget`.
- **Backend (`muntrume-worker-private`)**: `npx wrangler deploy` publica el Worker `muntrume` en Cloudflare.
