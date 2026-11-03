# 🛡️ Política de Seguridad / Security Policy

Muntrume Motorsport opera bajo los estándares de ingeniería y seguridad de **ATM Software Labs**. Tratamos la seguridad, confidencialidad de datos y la integridad criptográfica de nuestros pilotos como una prioridad de nivel militar.

---

## 🔒 Arquitectura de Seguridad (Zero-Trust)

El ecosistema de **muntru.me** está diseñado con defensa en profundidad (*Defense-in-Depth*):

| Capa | Medida Implementada | Estándar Criptográfico / Técnico |
| :--- | :--- | :--- |
| **Autenticación** | Hashing de credenciales en reposo | **PBKDF2-SHA256** (100.000 iteraciones en Edge Workers) |
| **Doble Factor (2FA)** | Códigos de acceso de un solo uso | Muestreo criptográfico uniforme (`crypto.getRandomValues`) + HMAC-SHA256 (TTL: 10 min) |
| **Comparación de Secretos**| Protección contra Timing Attacks | Algoritmo **Timing-Safe Equal** en tiempo constante |
| **Control de Acceso** | Segregación estricta por rol | Aislamiento por buzón de piloto (`🔒 PRIVADO`) y panel de control con re-autenticación periódica |
| **Firmas de Integridad** | Watermark digital en setups `.sto` | Verificación de cabeceras binarias iRacing e inyección de firma oficial de escudería |
| **Cabeceras HTTP** | Blindaje contra ataques web | `HSTS` con preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| **Content Security Policy** | Prevención de XSS y Clickjacking | CSP restrictivo con `frame-ancestors 'none'` y orígenes explícitos |
| **Protección contra Abuso** | Rate Limiting y Cuotas | Límite de 1.500 descargas/hora por piloto, cooldown de 60s en solicitudes 2FA |

---

## 📢 Notificación de Vulnerabilidades (Coordinated Disclosure)

Si detectas cualquier fallo de seguridad, debilidad criptográfica o riesgo potencial en `muntru.me` o en el Cloudflare Worker (`muntrume.atrumin16.workers.dev`):

1. **NO abras un issue público en GitHub ni lo comentes en redes sociales o Discord.**
2. Envía un correo cifrado a:
   * **`info@muntru.me`** con el asunto `[SECURITY] Reporte confidencial`
   * O utiliza la función oficial de **Private Vulnerability Reporting** en la pestaña *Security* de este repositorio en GitHub.
3. Incluye:
   * Descripción técnica detallada del vector de ataque.
   * Pasos reproducibles o prueba de concepto (*PoC*).
   * Impacto potencial y recomendaciones de mitigación.

### Tiempos de Respuesta (SLA)
* **Reconocimiento inicial:** Menos de 24 horas.
* **Evaluación técnica y triage:** 48 horas.
* **Despliegue del parche:** Dependiendo de la severidad (crítico: < 24h).

---

## 🚫 Pruebas Fuera de Alcance (Out-of-Scope)

* Ataques de denegación de servicio volumétrico (DDoS) contra la infraestructura de Cloudflare o GitHub Pages.
* Ingeniería social, phishing o ataques físicos contra los pilotos o administradores.
* Intentos de vulnerar cuentas personales de iRacing o buzones de correo externos ajenos a la organización.
