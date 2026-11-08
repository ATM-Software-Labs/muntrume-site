<p align="center">
  <img src="docs/screenshots/home-hero.png" alt="Muntrume Motorsport — Precision Racing. Engineered to win." width="100%" />
</p>

<p align="center">
  <strong>Web oficial de Muntrume Motorsport, escudería de iRacing de Sant Andreu (Barcelona).</strong><br/>
  <em>Official website of Muntrume Motorsport, an iRacing sim-racing team from Barcelona (ES · EN · CA · FR).</em>
</p>

<p align="center">
  <a href="https://muntru.me"><b>muntru.me</b></a> ·
  <a href="https://muntru.me/garage/">Garage &amp; Setups</a> ·
  <a href="https://muntru.me/news/">Sala de Prensa</a> ·
  <a href="https://muntru.me/pilotos/">Pilotos</a> ·
  <a href="https://muntru.me/paddock/">Paddock Pass</a> ·
  <a href="https://discord.gg/ehX6B8JUtE">Discord</a>
</p>

<p align="center">
  <a href="https://github.com/atrumin16/muntrume-site/actions/workflows/deploy.yml"><img alt="Deploy" src="https://github.com/atrumin16/muntrume-site/actions/workflows/deploy.yml/badge.svg" /></a>
  <img alt="Astro" src="https://img.shields.io/badge/Astro-5.4-111827?logo=astro&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind%20CSS-v4-0EA5E9?logo=tailwindcss&logoColor=white" />
  <img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub-Pages-047857?logo=github&logoColor=white" />
  <img alt="Idiomas" src="https://img.shields.io/badge/i18n-ES%20%C2%B7%20EN%20%C2%B7%20CA%20%C2%B7%20FR-10B981" />
  <img alt="Zero Trust" src="https://img.shields.io/badge/Zero--Trust-Passed-00E699" />
</p>

---

## Capturas del Ecosistema

| Pilotos Oficiales | Sala de Prensa &amp; Despachos | AI Setup Lab &amp; Garage Vault |
|:-:|:-:|:-:|
| <img src="docs/screenshots/pilotos-equipo.png" width="300" alt="Alineación oficial de pilotos" /> | <img src="docs/screenshots/press-room.png" width="300" alt="Sala de prensa y noticias" /> | <img src="docs/screenshots/setup-vault.png" width="300" alt="Garage para pilotos" /> |

| Inicio Móvil | Setups Móvil | Contacto &amp; Paddock Pass |
|:-:|:-:|:-:|
| <img src="docs/screenshots/mobile-home.png" width="200" alt="Inicio en móvil" /> | <img src="docs/screenshots/mobile-setups.png" width="200" alt="Setups en móvil" /> | <img src="docs/screenshots/contacto-oficial.png" width="300" alt="Contacto y Paddock Pass" /> |

---

## 🏎️ Filosofía de Ingeniería de Setups (3 Niveles MMT)

Muntrume Motorsport clasifica y diseña sus configuraciones `.sto` en tres filosofías adaptadas a cada perfil de piloto y exigencia de pista:

| Nivel | Sufijo | Perfil de Piloto | Características Técnicas | Comportamiento en Pista |
| :--- | :---: | :--- | :--- | :--- |
| **🔴 ESPORT** | **`_E`** | **Piloto Pro**<br>*(Hotlap / Top-Split)* | Mínimo drag aerodinámico (-0.5° a -1.0° de ala), alturas estáticas al límite técnico legal y diferencial reactivo (10 caras / 110 Nm). | ⚡ **+0.16s extra** vs tiendas.<br>Máxima velocidad punta y mordida en salida. Exige precisión milimétrica en pianos. |
| **🟡 NORMAL** | *(sin letra)* | **Piloto Avanzado**<br>*(Ritmo de Carrera)* | Rake balanceado, presiones estabilizadas exactamente a 170 kPa calientes en la Vuelta 1 y diferencial neutro (8 caras / 90 Nm). | ⭐ **Mejor Ratio Velocidad / Seguridad.**<br>Consistencia vuelta a vuelta para stints largos sin sobrecalentar neumáticos. |
| **🟢 SAFE** | **`_S`** | **Principiante / Iniciación**<br>*(Resistencia / Baches)* | Alturas sobreelevadas (+1.5 mm Del / +2.0 mm Tras), amortiguación HS Comp suavizada (-3 clics) y diferencial progresivo (6 caras / 70 Nm). | 🛡️ **Máxima Estabilidad y 0 trompos.**<br>Blindaje anti-fondo en compresiones de 3G (Fuchsröhre, Eau Rouge) y cero Failed Tech. |

---

## 📋 Estándar Oficial de Nomenclatura MMT

Todos los archivos de setup de iRacing siguen la norma estricta:

```text
MMT_[MODELO]_[CIRCUITO]_[SESIÓN]_[VERSIÓN_OPCIONAL].sto
```

### Modificadores y Códigos de Sesión
- **`Q` / `Q2`**: Clasificación a 1 vuelta / 2 vueltas (combustible mínimo calibrado).
- **`R`**: Carrera sprint / estándar (Nivel normal: *sin letra*).
- **`END`**: Eventos de resistencia y pruebas especiales.
- **`W`**: Wet / Condiciones de lluvia (*Tempest Weather System* de iRacing).
- **`_E`**: Modificador Esport (Nivel Pro / Hotlap). Ej: `MMT_F296_SPA_R_E.sto`
- **`_S`**: Modificador Safe (Principiante / Alta estabilidad). Ej: `MMT_M4_VLN_END_S.sto`
- **`V2`, `V3`**: Revisión evolutiva o adaptación a cambios de BoP oficial.

---

## 🧠 Características de la Plataforma Web

- **AI Setup Lab Interactivo (`/garage`):** Selector dinámico en tiempo real de los 3 niveles (`🔴 Esport [E]`, `🟡 Normal`, `🟢 Safe [S]`) con cálculo instantáneo de tiempos objetivo, Vmax esperada, diagnóstico de ingeniería y tabla comparativa mano a mano con iRacing Fixed y tiendas de setups.
- **Motor Telemetría 60 Hz en Cliente:** Parser de archivos binarios `.ibt` de iRacing ejecutado 100% en el navegador (<40 ms, 0 bytes enviados a servidores externos, privacidad total de telemetría).
- **Sala de Prensa Técnica (`/news` y `/noticias/[slug]`):** Despachos oficiales de telemetría y noticias del simracing con tiempo de lectura estimado, recuento de palabras, metadatos estructurados e integración completa con temas **Light y Dark** de alto contraste.
- **Escrutinio Técnico y Validación BoP:** Comprobación estricta de alturas mínimas legales (70 mm en Nürburgring VLN/NEC; 50 mm en GT3; 30 mm en GTP) y presiones en frío reglamentarias.
- **Internacionalización Nativa:** Español, inglés, catalán y francés con etiquetas `hreflang` canónicas.
- **Rendimiento y Accesibilidad:** Puntuación Lighthouse 98-100, imágenes WebP responsivas y CSS Tailwind v4 minificado.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Frontend** | [Astro](https://astro.build/) · Tailwind CSS v4 · Vanilla JS optimizado |
| **Hosting** | GitHub Pages con CDN global (dominio propio [`muntru.me`](https://muntru.me)) |
| **Edge API** | Cloudflare Workers &amp; D1 Database (repositorio privado) |
| **Telemetría &amp; IA** | Parser nativo `.IBT` binario (DataView) + regresores de gradiente de puesta a punto |
| **CI / CD** | GitHub Actions con Zero-Trust Scanner y minificación automática de activos |

---

## 💻 Desarrollo Local

Requiere **Node.js 22+** (o Node.js 24/26).

```bash
# 1. Instalar dependencias exactas
npm ci

# 2. Servidor de desarrollo local
npm run dev

# 3. Compilación de producción con minificación y compresión HTML
npm run build
```

---

## 🛡️ Seguridad y Verificación

- Escáner militar Zero-Trust integrado en hooks de Git (`pre-commit` y CI).
- Formulario de retirada inmediata de contenidos en [/legal/retirada](https://muntru.me/legal/retirada/) conforme al Art. 32 LPI / DMCA.
- Consulta [SECURITY.md](SECURITY.md) para reporte responsable de incidencias.

---

<p align="center">
  <strong>© 2026 Muntrume Motorsport</strong> · Sant Andreu, Barcelona<br/>
  <em>Mantenido por el departamento técnico y de competición de MMT.</em>
</p>
