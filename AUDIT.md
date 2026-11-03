# 📋 Registro de Auditorías Técnicas · Muntrume Motorsport

Historial de auditorías de rendimiento, seguridad y revisiones de infraestructura del portal **muntru.me** bajo los estándares de **ATM Software Labs**.

---

## 🏁 Auditoría Turno 12 — Blindaje Militar, Responsive E2E y Setups (Noviembre 2026)
* **Alcance:** Portal completo (`/`, `/setups`, `/mail`, `/team`, `/news`, `/contact`, `/about`), Setup Vault y Worker Edge.
* **Seguridad:**
  * Implementación de cabeceras de grado militar en `public/_headers` (`X-Frame-Options: DENY`, `HSTS preload`, CSP estricto con `frame-ancestors 'none'`).
  * Validación de tokens PBKDF2 (100k iteraciones), timing-safe equal y cuotas de descarga (1.500/h).
  * Creación de `SECURITY.md` con procedimiento de Coordinated Vulnerability Disclosure.
* **Experiencia Móvil:**
  * 0 desbordamientos horizontales verificados en pantallas de 390px / 844px.
  * Selector de tipos de sesión con chips responsivos (`R`, `Q`, `Wet`) y scroll horizontal sin barra.
  * Botones de carpetas optimizados para interacción táctil (mínimo 40px de altura).
* **Setup Vault:**
  * Catálogo completo de 196 vehículos y 239.539 setups firmados digitalmente.
  * Normalización de nombres de archivo y restauración de carpetas ZEK Racing.
  * Solución al cierre involuntario del modal de vista previa en modo visitante.
* **Automatización:**
  * Suite de pruebas E2E en Playwright (`scripts/test-mobile.mjs` y `scripts/test-preview-modal.mjs`).
  * Generación de capturas Retina para documentación (`docs/screenshots/`).

---

## 🛠️ Auditoría Turno 11 — Seguridad Profunda y QA de Rutas (1 nov 2026)
* **Worker & API:**
  * 15/15 rutas admin verificadas: respuestas 403 en acceso no autorizado, 401 sin token o alterado.
  * Pruebas de inyección SQL y Path Traversal mitigadas sin efecto.
  * Orígenes CORS externos no autorizados bloqueados con 403.
* **Comunicaciones:**
  * 10 plantillas de correo < 12 KB con textos legibles y escape HTML verificado.
  * Verificación 100% DKIM / SPF / DMARC en dominio `trujillomingorance.com`.
* **Frontend:**
  * Pruebas de contraste accesibilidad (axe) completadas sin incidencias.
  * Páginas de pilotos `/p/<alias>/` generadas estáticamente en tiempo de compilación.

---

## ⚡ Auditoría Turno 5 — Optimización de Rendimiento y UX (1 nov 2026)
* **Core Web Vitals:**
  * Tipografía Inter auto-hospedada (OFL) con fallback métrico sin saltos de diseño (CLS = 0).
  * Preload responsive del banner hero y optimización de imágenes en formato WebP.
  * Generación estática SSG ultra-rápida con compresión HTML automática (`compress-html.mjs`).
