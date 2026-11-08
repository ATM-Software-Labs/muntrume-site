# Marco Legal, Propiedad Intelectual y Cumplimiento Normativo (MTM Engineering)

Este documento establece las bases jurídicas, técnicas y de propiedad intelectual aplicables a la plataforma **Muntrume Motorsport (muntru.me)**, su motor de telemetría y su catálogo de archivos de configuración (.STO) **MTM Megasetup™**, orientado tanto a su publicación como software de código abierto como a su explotación comercial.

---

## 1. Ingeniería Limpia e Independiente (Clean-Room Engineering)

Todas las geometrías de suspensión, mapas aerodinámicos, distribuciones de presiones y ajustes cinemáticos incluidos en la plataforma han sido desarrollados **de manera 100% independiente** mediante metodología de ingeniería limpia (*clean-room engineering*):

1. **Datos Telemétricos Propios (.IBT a 60 Hz):**
   - Los modelos de optimización se alimentan de canales telemétricos reales (velocidad de amortiguador, flexión de bump stop, temperaturas de banda interna/media/externa, ángulo de deriva y fuerzas G longitudinales/laterales) registrados en pista durante sesiones de prueba oficiales.
2. **Línea Base Oficial Reglamentaria (Baseline iRacing Fixed):**
   - Todo setup parte del estándar oficial publicado por el simulador para la temporada en curso (2026 Season 4).
   - Se aplican correcciones de escrutinio técnico estricto (*Tech Inspection*) garantizando el cumplimiento de la altura estática mínima legal (incluyendo el límite de ≥70.0 mm en Nürburgring Nordschleife / VLN) y presiones en frío reglamentarias (152.0 kPa GTP / 159.0 kPa GT3 / 165.0 kPa Wet) con **cero Failed Tech (100% Pass Tech)**.
3. **Ausencia de Propiedad Intelectual de Terceros:**
   - No se utiliza, almacena ni distribuye código propietario ni material protegido por derechos de autor perteneciente a tiendas comerciales o proveedores externos de setups.
   - Las referencias comparativas en telemetría corresponden a modelos teóricos de **Benchmark Competitivo Pro** generados internamente.

---

## 2. Firma Digital, Watermark y Protección de Marca

Cada archivo binario `.sto` descargado o generado a través de la plataforma incorpora una cabecera codificada en formato UTF-16LE firmada digitalmente con el sello de calidad:

- **Identificador de Seguridad:** `[MTM-PRO-SEC-26S4-VERIFIED-V2]`
- **Titular de los Derechos:** Alberto Trujillo Mingorance (#16)
- **Marca Registrada:** Muntrume Motorsport™ / MTM Megasetup™
- **Sincronización Telemétrica Oficial:** [Garage 61 - Muntrume Motorsport](https://garage61.net/app/teams/muntrume-motorsport)

Cualquier archivo exportado certifica su autenticidad, autoría y parámetros ante el simulador y ante plataformas de telemetría colaborativa.

---

## 3. Descargo de Responsabilidad y Marcas Registradas (Fair Use)

- **iRacing:** *iRacing* e *iRacing.com* son marcas registradas de *iRacing.com Motorsport Simulations, LLC*.
- **Garage 61:** *Garage 61* es una marca de su respectivo titular.
- **Fair Use:** El uso de los nombres de vehículos, circuitos y series en este proyecto tiene propósitos exclusivamente identificativos, descriptivos y de compatibilidad técnica en el marco del derecho al uso legítimo (*fair use / nominative use*).
- **Independencia:** Muntrume Motorsport es una escudería y equipo de desarrollo técnico independiente. Ni este software ni su contenido están afiliados, patrocinados ni avalados oficialmente por iRacing.com Motorsport Simulations, LLC ni por terceros fabricantes de vehículos, salvo acuerdo expreso.

---

## 4. Modalidades de Setup Homologadas

Los setups distribuidos bajo el sello **MTM Megasetup™** se estructuran en tres niveles técnicos transparentes:
- **🔴 Modo Esport [E] (Nivel Pro):** Calibración agresiva de baja resistencia aerodinámica (*low drag*), alturas al límite reglamentario y diferencial de respuesta inmediata para clasificación (*hotlap*) y top-split.
- **🟡 Modo Normal (Nivel Avanzado - Estándar MTM):** El mejor ratio velocidad/seguridad. Alturas con margen de escrutinio, ventana térmica estable en 170 kPa calientes y control ágil de *trail-braking*.
- **🟢 Modo Safe [S] (Nivel Principiante / Iniciación):** Alturas sobreelevadas (+1.5 mm Del / +2.0 mm Tras), amortiguadores de alta velocidad suavizados para absorber bordillos y diferencial progresivo para eliminar trompos.
