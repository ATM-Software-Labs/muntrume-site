# Guía de Contribución a MMT Sync (Open-Source)

¡Gracias por tu interés en mejorar **MMT Sync**! Esta guía te ayudará a configurar tu entorno local y entender la arquitectura modular de la aplicación.

---

## 🏛️ Arquitectura del Proyecto

El código fuente de MMT Sync se organiza de forma modular para evitar acoplamientos:

- **`src/irsdk/` (Core SDK & Engines)**:
  - `yaml-parser.ts`: Parser seguro para SessionInfo de iRacing.
  - `relative-engine.ts`: Cálculo de distancias y wraparound de meta con `CamCarIdx`.
  - `leaderboard-engine.ts`: Clasificación multiclase en vivo y en entrenamientos.
  - `fuel-calculator.ts`: Computador de combustible blindado contra división por cero.
  - `gpu-pedals.ts`: Renderizado por GPU de pedales y volante con trail braking.
  - `radar-360.ts`: Spotter y radar de proximidad `CarLeftRight`.
  - `pitbox-helper.ts`: Speed limiter delta y cuenta atrás al cajón.
  - `digi-flag.ts`: Decodificador bitwise de SessionFlags por prioridad.
- **`src/theme/` (Theme Engine)**:
  - Variables dinámicas CSS (`--mmt-bg`, `--mmt-accent`, etc.).
  - Configuración de columnas visibles por widget.
  - Exportación / importación de layouts en 1 clic (`mmt-layout://`).
- **`src/plugins/` (SDK de Plugins)**:
  - Bus de telemetría local a 60 Hz (WebSocket en `localhost:9090` y postMessage).
  - Cargador dinámico de widgets externos en `plugins/<widget>/`.
- **`locales/` (i18n)**:
  - Archivos JSON planos para traducción comunitaria (`es.json`, `en.json`, `pt.json`, etc.).
- **`plugins/` (Widgets Comunitarios)**:
  - Repositorio de overlays creados en HTML/CSS/JS (`example-gforce-meter`).

---

## 🛠️ Entorno de Desarrollo Local en 3 Pasos

1. **Instalar dependencias**:
   ```bash
   cd desktop
   npm install
   ```

2. **Ejecutar tests unitarios**:
   ```bash
   npx tsx tests/test-bloque1.ts
   npx tsx tests/test-bloque2.ts
   ```

3. **Compilar la aplicación**:
   ```bash
   npm run build
   ```

---

## 🔒 Seguridad y Cero Secretos

- No se permiten claves privadas, credenciales o tokens en ningún archivo commiteado.
- La aplicación debe ser 100% utilizable en modo local/offline sin conexión a internet.
- Todo Pull Request debe pasar las pruebas unitarias y de tipos sin advertencias (`tsc --noEmit`).
