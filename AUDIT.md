
## Turno 5 — Mejoras de UX/rendimiento (1 nov 2026)

Commits: `e26ec3f` (head/SEO/a11y, imágenes responsive, 404, contacto honesto vía mailto, news vía Worker `/api/news` sin rss2json + dedupe, estado "temporada completada", robots/sitemap) y `d1fef8b` (Inter self-hosted OFL con fallback métrico, misma fuente en todo el sitio, preload responsive del hero, fila de estado de news estable).
Worker: live `4bbb7fcc-dfbf-4a50-963c-0a9e4f226a8e`, rollback `aa7f62dd-9fef-47a3-b58a-062600467b1d`. D1 sin cambios.
Rollback web: `git revert c1dd0c3..d1fef8b`.
Lighthouse antes: `lh/before/`; después: `lh/after/`, `lh/after2/` (ejecuciones únicas, variación ±20 pts en perf).
Pendiente de decisión: backend real del formulario de contacto, limpieza de assets/vídeos pesados no usados, contenido del artículo "Victory at 24H Spa Virtual" y calendario 2027.

## Turno 11 (t257/t258) — auditoría profunda, 1 nov 2026
- Worker 79b05877 (rollback bf0ea34f). Commit 4f7d402 (rollback: revert; previo 7483da8).
- Probado con QA driver (borrado): 15/15 rutas admin → 403, token alterado → 401, sin token → 401; SQLi/path traversal sin efecto; CORS de origen ajeno → 403.
- Correos: 10 plantillas < 12 KB, parte texto, escape OK, DKIM/SPF/DMARC pass. Arreglados: frase vacía del digest y botón .ics en modo oscuro.
- Web: 10 páginas × 4 idiomas × 4 viewports, sin 404 ni desbordes; 3 fallos de contraste (axe) arreglados.
- GitHub: acciones fijadas por SHA, solo acciones de GitHub, Pages publica solo `_site` (fuera worker/, AUDIT.md, telemetría JSON), SECURITY.md, CODEOWNERS, reporte privado de vulnerabilidades.
- Pilotos: /p/<alias>/ generado en build (cada 6 h) con OG + JSON-LD Person; 404 redirige alias aún no generados.
- api.trujillomingorance.com OCUPADO (custom domain atm-labs-api + ruta nutrifit-api-gateway): no tocado.
