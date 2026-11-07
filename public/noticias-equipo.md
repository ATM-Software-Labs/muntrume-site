# Despacho Oficial 24H Le Mans 2026: Setup Valkyrie GTP y Telemetría en Les Hunaudières
**Fecha:** 2026-11-04
**Autor:** Alberto Trujillo
**Categoría:** Resistencia
**Imagen:** /assets/img/race1.webp

Análisis exhaustivo del paquete aerodinámico del Aston Martin Valkyrie GTP para las 24 Horas de Le Mans en iRacing. Durante las sesiones de pruebas oficiales en el Circuit de la Sarthe, el departamento de ingeniería de Muntrume Motorsport completó más de 450 vueltas de simulación centradas en la estabilidad a alta velocidad en Les Hunaudières y la degradación térmica en la sección de Porsche Curves.

## Calibración Aerodinámica y Resistencia al Avance (Drag)
El alerón trasero se ha fijado en 4.5° para optimizar la velocidad punta en recta sin comprometer la carga aerodinámica en curvas rápidas.
- Velocidad máxima alcanzada en Mulsanne: 334.8 km/h sin rebufo.
- Altura de marcha dinámica (Dynamic Ride Height): 27.5 mm en el eje delantero a velocidad terminal para evitar el cabeceo (porpoising) en los desniveles del asfalto.
- Reparto de frenada ajustado al 54.2% con rampa de regeneración híbrida calibrada en modo Endurance.

## Gestión Térmica y Estrategia de Stints Nocturnos
Con temperaturas de asfalto descendiendo hasta los 17°C durante la madrugada, el equipo ha desarrollado una curva de presión en frío compensada (+1.2 psi en el flanco derecho) para mantener la ventana óptima de trabajo entre 82°C y 94°C.

> "La clave en Le Mans no es la vuelta rápida en solitario, sino la consistencia del ritmo en tráfico multiclase y la conservación de la carcasa durante el tercer y cuarto stint." — Alberto Trujillo, Team Principal.

---
# Actualización Masiva del Setup Vault: Sincronización Completa de 105 Coches y 41.000 Archivos .STO
**Fecha:** 2026-11-02
**Autor:** Muntrume Engineering
**Categoría:** Setups
**Imagen:** /assets/img/coche1.webp

El repositorio oficial de reglajes de Muntrume Motorsport ha completado su mayor actualización de temporada, integrando más de 41.000 archivos de configuración .sto optimizados para la 2026 Season 4 de iRacing.

## Arquitectura de Distribución y Almacenamiento
Todos los setups han sido procesados y clasificados en la infraestructura de Cloudflare D1 y R2 de la escudería, garantizando descargas ultrarrápidas y sincronización directa con el cliente local.
- Cobertura de 105 vehículos oficiales de iRacing entre Sports Car, Fórmula, Prototipos y Turismos.
- Clasificación por condiciones de sesión: Qualy (baja carga de combustible y presiones agresivas), Race (equilibrio neutro y conservación de gomas) y Tempest Wet (reglajes de agua).
- Verificación criptográfica SHA-256 en cada archivo para certificar la autoría institucional de Muntrume Motorsport.

## Modelos GT3 Destacados
Los paquetes para el Ferrari 296 GT3, Porsche 911 GT3 R (992), Ford Mustang GT3 y McLaren 720S GT3 EVO incorporan nuevas geometrías de suspensión y ajustes de amortiguación acordes al último Balance of Performance (BoP) oficial.

> Los miembros oficiales y usuarios con credenciales de garaje pueden sincronizar los reglajes directamente en su carpeta Documents\iRacing\setups.

---
# Simulación y Telemetría GT3 en Spa-Francorchamps: Calibración de Amortiguadores para Eau Rouge & Raidillon
**Fecha:** 2026-10-30
**Autor:** Mateo Berbis
**Categoría:** GT3
**Imagen:** /assets/img/coche2.webp

Informe técnico de ingeniería sobre la absorción de impactos en compresión rápida y el balance aerodinámico en el emblemático complejo de curvas de Spa-Francorchamps.

## El Desafío de la Compresión a 250 km/h
Al negociar la bajada hacia Eau Rouge y encarar el muro ciego de Raidillon a fondo, el chasis experimenta una fuerza vertical superior a los 2.8G. Una amortiguación excesivamente rígida provoca que el splitter delantero golpee el asfalto (bottoming out), perdiendo instantáneamente el flujo aerodinámico y desestabilizando el eje trasero.
- Amortiguadores de alta velocidad (High Speed Compression): Suavizados en 2 clics para absorber el salto en la base de la compresión sin hacer tope de suspensión.
- Limitadores de recorrido (Packers): Reducidos a 4 mm para proporcionar recorrido libre antes de entrar en contacto con las gomas de tope.
- Ángulos de caída (Camber): Calibrados a -3.9° delante y -3.2° detrás para maximizar la superficie de contacto en Pouhon y Blanchimont.

## Comparativa de Rendimiento en Telemetría Garage 61
Los registros telemétricos confirman una ganancia de 0.28 segundos en el Sector 1 manteniendo el acelerador al 100% durante toda la subida de Raidillon con carga de carrera (100 litros).

---
# Guía Técnica de Telemetría: Cómo Interpretar Canales de Frenada (Trail Braking) y Dirección en Garage 61
**Fecha:** 2026-10-25
**Autor:** Alberto Trujillo
**Categoría:** Telemetría
**Imagen:** /assets/img/coche3.webp

Publicación del manual técnico interno de Muntrume Motorsport diseñado para que los pilotos del equipo interpreten sus datos telemétricos a 60 Hz y optimicen su técnica de pilotaje en curva.

## La Curva de Descompresión en Trail Braking
El error más común entre pilotos intermedios es soltar el pedal de freno de manera brusca al llegar al punto de giro (Turn-in). Esto descarga repentinamente el eje delantero, generando un subviraje parásito.
- Entrada en recta: Pico de presión de freno rápido (80-90% de fuerza) para ralentizar el vehículo en línea recta.
- Transición al vértice: Liberación gradual y progresiva del pedal (del 50% al 5%) mientras se incrementa el ángulo de volante.
- Rotación inducida: La transferencia de peso sobre el neumático delantero exterior mantiene la dirección precisa y permite girar el coche sin balance excesivo.

## Análisis de Micro-correcciones de Dirección
Mediante la superposición de la traza de dirección (Steering Angle) en Garage 61 con la aceleración lateral (G-Lat), los ingenieros de Muntrume identifican si el piloto está aplicando correcciones innecesarias que sobrecalientan los neumáticos delanteros.

> "Un trazo suave y continuo en la curva de dirección equivale a menor temperatura en la superficie del neumático y mayor tracción al traccionar hacia la recta."

---
# Apertura Oficial de Selección de Pilotos: Temporada de Resistencia 2026/2027 en Muntrume Motorsport
**Fecha:** 2026-10-20
**Autor:** Muntrume Motorsport
**Categoría:** Equipo
**Imagen:** /assets/img/coche4.webp

Muntrume Motorsport abre formalmente el periodo de recepción de candidaturas para pilotos de simracing interesados en integrarse en la estructura de resistencia para la temporada 2026/2027 de iRacing.

## Divisiones y Programas de Competición
El equipo disputará los campeonatos oficiales de resistencia más prestigiosos del calendario internacional:
- IMSA Endurance Championship (Clase GTD con Ferrari 296 GT3 y Ford Mustang GT3).
- VRS GT Endurance Series (carreras de 3 horas multiconductor por parejas).
- Global Endurance Tour (pruebas de 6, 12 y 24 horas en Daytona, Sebring, Spa, Nürburgring y Le Mans).

## Requisitos y Perfil del Aspirante
Buscamos pilotos comprometidos con el trabajo colectivo, la disciplina telemétrica y la regularidad en ritmo de carrera:
- Licencia iRacing Sports Car / Road Clase B (SR 3.0+) o Clase A.
- iRating mínimo recomendado de 2.000+ (se valorará positivamente la constancia frente a la velocidad pura).
- Disponibilidad para participar en los entrenamientos semanales y sesiones de análisis de datos en Discord.
- Capacidad de comunicación en español o inglés y espíritu deportivo en pista.

> Los interesados pueden enviar su solicitud a través de la sección Paddock (/paddock/) o ponerse en contacto con la directiva técnica en nuestro servidor de Discord.

---
# Gestión de Tráfico Multiclase y Baches en las 12 Horas de Sebring con el Ferrari 296 GT3
**Fecha:** 2026-10-15
**Autor:** Eduardo Chongkan
**Categoría:** Resistencia
**Imagen:** /assets/img/race1.webp

Crónica técnica tras las pruebas preparatorias para las 12 Horas de Sebring en el histórico aeródromo de Florida, analizando la respuesta del Ferrari 296 GT3 sobre el pavimento de hormigón.

## Adaptación al Desafío de los Baches en Sunset Bend
Sebring es reconocido como el trazado más exigente del mundo para las suspensiones de competición. La curva 17 (Sunset Bend) somete a los amortiguadores a vibraciones de alta frecuencia que pueden descolocar el coche en pleno apoyo lateral.
- Barra estabilizadora delantera (Front ARB): Ajustada en posición blanda (P1) para mantener tracción e independencia entre ruedas delanteras.
- Presión de neumáticos: Calibrada para amortiguar los escalones de unión entre placas de hormigón sin sobrepasar los 25.5 psi en caliente.
- Ajuste del diferencial en aceleración: Elevado al 45% para evitar pérdidas de potencia por patinaje de la rueda interior al acelerar sobre los baches.

## Coordinación en Carrera Multiclase
En pruebas con más de 50 coches en pista, la interacción con los prototipos GTP y LMP2 determina el resultado final. La estrategia de Muntrume se basa en la predictibilidad de la trazada, evitando cambios de dirección tardíos y facilitando el paso seguro en las zonas rectas de Ulmann Straight.

---
# Protocolo de Setup para Lluvia: Guía para el Sistema Tempest Weather de iRacing
**Fecha:** 2026-10-10
**Autor:** Muntrume Engineering
**Categoría:** Técnica
**Imagen:** /assets/img/coche2.webp

Procedimiento operativo estándar desarrollado por el laboratorio de ingeniería de Muntrume Motorsport para abordar sesiones oficiales bajo condiciones meteorológicas dinámicas del sistema Tempest de iRacing.

## Modificaciones Dinámicas de Geometría y Altura
Cuando la pista pasa de seca a húmeda, los principios de puesta a punto cambian radicalmente:
- Aumento de altura de marcha (Ride Height): Incremento de +7 mm delante y +9 mm detrás para evitar el aquaplaning cuando el coche atraviesa los charcos acumulados en las depresiones del circuito.
- Desconexión o suavizado de barras estabilizadoras: Permite una mayor transferencia de carga diagonal, generando temperatura en los neumáticos y ofreciendo mayor sensación de agarre en el volante.
- Ángulos de caída menos negativos: Reducción de la caída a -2.5° para que toda la banda de rodadura apoye plana y evacue el agua eficientemente a través de los surcos del neumático de lluvia.

## Localización de la "Línea Húmeda" (Wet Line)
La trazada tradicional acumula una capa de goma que, combinada con agua, se convierte en una superficie extremadamente resbaladiza. Los pilotos de Muntrume son instruidos para buscar la línea exterior en frenadas y vértices, donde el asfalto rugoso sin engomar proporciona hasta un 25% más de agarre longitudinal.

> "En lluvia, la suavidad en las transiciones de acelerador y la anticipación de la frenada son diez veces más efectivas que cualquier reglaje agresivo."
