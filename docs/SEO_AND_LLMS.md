# SEO e Indexación para Buscadores e IAs Externas

Esta guía documenta cómo `muntru.me` y `ai.muntru.me` exponen su estructura y capacidades a Google, Bing y sistemas de IA externos (ChatGPT, Claude, Perplexity, Gemini, agentes RAG).

## Ficheros de descubrimiento

| Ruta pública | Propósito |
|---|---|
| `/robots.txt` | Permite el rastreo global e incluye directivas explícitas `Allow: /` para `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended` y `CCBot`. |
| `/sitemap.xml` | Generado por `src/pages/sitemap.xml.ts` y `scripts/generate-sitemap.mjs`; incluye `/ai/`, `/ai-docs/`, `/garage/`, `/tracks/`, `/calendar/`, `/app/` y rutas programáticas de setups. |
| `/llms.txt` | Resumen conciso siguiendo el estándar `llms.txt` con enlaces directos al ecosistema y a Muntrume AI. |
| `/llms-full.txt` | Referencia extendida en texto plano/Markdown con arquitectura, tiers, skills, Artifacts Studio y API. |
| `/ai-knowledge.json` | Base de conocimiento estructurada en JSON orientada a pipelines RAG y crawlers semánticos. |
| `/ai-openapi.json` | Especificación OpenAPI 3.1 de los endpoints públicos de Muntrume AI (`POST /api/ai`, `GET /api/ai/artifacts/get/{slug}`). |
| `/.well-known/ai-plugin.json` | Manifiesto estándar de descubrimiento de agente/plugin enlazado al OpenAPI. |

## Datos estructurados (Schema.org JSON-LD)

- `/ai/` (`src/pages/ai.astro`): `SoftwareApplication` con `featureList`, licencia MIT y enlace a documentación.
- `/ai-docs/` (`src/pages/ai-docs.astro`): `TechArticle` + `SoftwareApplication` + `FAQPage`.
- `ai.muntru.me/a/<slug>` (`worker/artifacts.js`): `CreativeWork` + OpenGraph + Twitter Card + canonical por cada artefacto público.

## Mantenimiento

Al añadir nuevas capacidades en Muntrume AI o nuevas secciones principales en la web, actualizar en conjunto:
1. `src/pages/ai-docs.astro`
2. `public/llms.txt` y `public/llms-full.txt`
3. `public/ai-knowledge.json` (y `public/ai-openapi.json` si cambia la API)
4. `src/pages/sitemap.xml.ts` si se agrega una ruta estática nueva.
