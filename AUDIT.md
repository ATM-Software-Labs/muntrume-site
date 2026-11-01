
## Turno 5 — Mejoras de UX/rendimiento (1 nov 2026)

Commits: `e26ec3f` (head/SEO/a11y, imágenes responsive, 404, contacto honesto vía mailto, news vía Worker `/api/news` sin rss2json + dedupe, estado "temporada completada", robots/sitemap) y `d1fef8b` (Inter self-hosted OFL con fallback métrico, misma fuente en todo el sitio, preload responsive del hero, fila de estado de news estable).
Worker: live `4bbb7fcc-dfbf-4a50-963c-0a9e4f226a8e`, rollback `aa7f62dd-9fef-47a3-b58a-062600467b1d`. D1 sin cambios.
Rollback web: `git revert c1dd0c3..d1fef8b`.
Lighthouse antes: `lh/before/`; después: `lh/after/`, `lh/after2/` (ejecuciones únicas, variación ±20 pts en perf).
Pendiente de decisión: backend real del formulario de contacto, limpieza de assets/vídeos pesados no usados, contenido del artículo "Victory at 24H Spa Virtual" y calendario 2027.
