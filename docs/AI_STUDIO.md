# Guía Técnica Interna · Muntrume AI Studio

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `src/pages/ai.astro` | Shell del Studio, barra lateral, compositor, modal de calculadoras, panel de Artifacts Studio y JSON-LD `SoftwareApplication`. |
| `src/pages/ai-docs.astro` | Documentación pública indexable (`/ai-docs/` y `ai.muntru.me/docs/`) con JSON-LD `TechArticle` y `FAQPage`. |
| `public/assets/js/ai-studio.js` | Estado local (`localStorage`), streaming SSE suavizado, renderizador Markdown, comandos slash, Artifacts Studio y publicación D1. |
| `public/assets/js/ai-md.js` | Bundle auxiliar generado por `scripts/bundle-ai-md.mjs` durante `npm run build`. |

## Motores y Skills

- **Tiers**: `lite` (*Muntrume 1.0 Lite*), `pro` (*Muntrume 1.0 Pro*), `ultra_max` (*Muntrume 1.0 Ultra Max*).
- **Comandos slash en el compositor**:
  - `/setup` → activa skill de ingeniería de setups iRacing.
  - `/strategy` → activa skill de estrategia endurance y combustible.
  - `/code` → activa skill de código y artefactos HTML/SVG/Mermaid.
  - `/slides` → activa skill de presentaciones 16:9 (`---` entre diapositivas).
  - `/doc` → activa skill de documento técnico exportable a `.doc`/PDF.
  - `/mermaid` → activa skill `code` y fuerza salida en bloque ```` ```mermaid ````.

## Renderizador Markdown (`renderMarkdownHtml`)

- Soporta encabezados **H1–H6** (tolerando espacio opcional tras `#`), fences de 3 y 4 backticks, atributos en info string, bloques de matemáticas legibles, callouts GitHub (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), checklists, tablas GFM con exportación CSV y listas anidadas dentro de `<ol>`.
- Durante streaming (`{ showCaret: isTyping, streaming: isTyping }`) estabiliza marcadores `**` y `` ` `` abiertos y evita recortar cabeceras de tablas a medio escribir.

## Artifacts Studio

- **Tipos soportados**: `html`, `svg`, `mermaid`, `slides`, `csv`, `doc`, `code`.
- **Controles de vista previa**: selector responsive **PC (100 %) / Tablet (768 px) / Móvil (390 px)**, **Recargar**, **Pestaña nueva** (Blob URL), **Ampliar** (pantalla completa) y editor de código en vivo con debounce de 350 ms.
- **Publicación**: `POST /api/ai/artifacts/publish` (requiere sesión de piloto del Vault) genera una URL permanente en `https://ai.muntru.me/a/<slug>`.
