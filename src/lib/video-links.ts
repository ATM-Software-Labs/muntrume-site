/**
 * Mapeo de vídeos directos oficiales de iRacing y guías de calidad verificadas.
 * Cada coche y circuito solo recibe vídeos verificados que corresponden exactamente
 * a ese coche o circuito (sin rellenos ni fallbacks cruzados).
 */

export interface MediaVideo {
  videoId: string;
  title: string;
  channel: string;
  badge: string;
  tag: string;
  duration?: string;
  url: string;
  embedUrl: string;
  thumbnail: string;
  desc: string;
}

interface VerifiedClip {
  id: string;
  title: string;
  channel: string;
  badge: string;
  tag: string;
  desc: string;
}

const TRACK_VIDEOS_MAP: Record<string, VerifiedClip[]> = {
  nurburgring: [
    { id: "QtX0uiLDt1c", title: "Nürburgring · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Track Preview", desc: "Modelado por escaneo láser milimétrico de Nürburgring GP y Nordschleife." },
    { id: "SUMkOHoRWxk", title: "Building the Nürburgring · Escaneo Láser", channel: "iRacing Oficial", badge: "Ingeniería", tag: "Behind the Scenes", desc: "Cómo se construyó el trazado más exigente del mundo en iRacing." },
  ],
  spa: [
    { id: "xQk9NoLs8_E", title: "Circuit de Spa-Francorchamps · Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Track Preview", desc: "Presentación oficial en iRacing del circuito de Spa-Francorchamps." },
    { id: "J9TGfT9s698", title: "Spa-Francorchamps · Carrera Creator Series", channel: "iRacing Oficial", badge: "Carrera", tag: "Race Highlights", desc: "Acción en pista y adelantamientos en Eau Rouge, Kemmel y Blanchimont." },
    { id: "yAiR0YnJrUA", title: "Spa-Francorchamps · Onboard de Trazado", channel: "iRacing Oficial", badge: "Onboard", tag: "Track Guide", desc: "Referencia visual de vértices y límites de pista en Spa-Francorchamps." },
  ],
  daytona: [
    { id: "bFbPDDgtYhs", title: "Daytona Road Course · Guía 24H y Gestión de Tráfico", channel: "JaSoiL Race", badge: "Guía 24H", tag: "Track Guide", desc: "Análisis de vuelta completa, frenada de Bus Stop y tráfico multiclase en Daytona." },
    { id: "nqSZSlPc-Hs", title: "Daytona International Speedway · GT Sprint", channel: "Stadium Scene TV", badge: "Carrera", tag: "GT Sprint", desc: "Carrera oficial GT Sprint en el trazado mixto de Daytona." },
  ],
  longbeach: [
    { id: "kFgsC9nMyNU", title: "Long Beach · Guía de Trazado Porsche 992.2 Cup (1:18.3)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Puntos de frenada entre muros, horquilla final y referencias de vuelta rápida en Long Beach." },
    { id: "F8gnIWKpAPs", title: "Long Beach · Guía GT3 McLaren 720S (1:17.6)", channel: "Sambo iRacing", badge: "Telemetría", tag: "GT3 Hotlap", desc: "Trazada milimétrica en el circuito urbano de Long Beach para categoría GT3." },
    { id: "tF9GaOeJQvc", title: "Long Beach · Guía Ferrari 296 GT3 + Telemetría", channel: "Track Titan", badge: "Hotlap", tag: "Telemetry", desc: "Vuelta comentada con telemetría de frenos y acelerador curva a curva en Long Beach." },
  ],
  lemans: [
    { id: "z7Oh9hcoDKM", title: "24 Hours of Le Mans · Documental Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Endurance", desc: "Historia y preparación oficial de las 24 Horas de Le Mans en iRacing." },
    { id: "AvT3sXo7qUk", title: "Circuit des 24 Heures du Mans · Guía Porsche Cup (3:52.5)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Referencias de frenada en Mulsanne, Porsche Curves y chicanes de Le Mans." },
    { id: "stGkw6p7Cio", title: "Le Mans · Guía GT4 BMW M4 (4:10.5)", channel: "Sambo iRacing", badge: "Telemetría", tag: "GT4 Guide", desc: "Gestión de rebufos y trazada óptima en Le Mans." },
  ],
  sebring: [
    { id: "S_Sb4pp3mqs", title: "Sebring International Raceway · Actualización Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "Updated Content", desc: "Escaneo láser de los famosos baches de hormigón y curvas de Sebring." },
    { id: "h_o4VbxOGsQ", title: "Sebring · Guía de Trazado Toyota GR86", channel: "Erilla", badge: "Guía", tag: "Track Guide", desc: "Referencias limpias de entrada en Sunset Bend y Turn 1 de Sebring." },
    { id: "Qb5iGfBIkxs", title: "Sebring International Raceway · Carrera Radical", channel: "iRacing Oficial", badge: "Carrera", tag: "Onboard", desc: "Ritmo de carrera y adelantamientos en Sebring International Raceway." },
  ],
  watkins: [
    { id: "6ftjzb8Ny6k", title: "Watkins Glen International · Rescan Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Rescanned", desc: "Presentación oficial del reescaneo láser completo de Watkins Glen." },
    { id: "ci27d1moo1s", title: "Watkins Glen Boot · Guía Completa (1:52.9)", channel: "Sambo iRacing", badge: "Guía", tag: "Boot Layout", desc: "Referencias de las Esses, Inner Loop y Boot en Watkins Glen." },
    { id: "ABp-dCI3Y5Y", title: "Watkins Glen International · Vuelta Onboard IMSA", channel: "IMSA Official", badge: "Onboard", tag: "IMSA", desc: "Análisis del trazado completo de Watkins Glen." },
  ],
  monza: [
    { id: "Bzzisr7jCVU", title: "Autodromo Nazionale Monza · Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Track Preview", desc: "Presentación en pista del Templo de la Velocidad en iRacing." },
    { id: "ozmQnUxSxko", title: "Autodromo Nazionale Monza · Análisis del Trazado", channel: "Sim Racing Paddock", badge: "Análisis", tag: "First Look", desc: "Chicanes, Variante Ascari y Parabólica al detalle en Monza." },
    { id: "DY35Kz_FqTI", title: "Monza Grand Prix · Trailer", channel: "Michi Hoyer", badge: "Showcase", tag: "Monza GP", desc: "Recorrido cinematográfico por el Autodromo Nazionale Monza." },
  ],
  bathurst: [
    { id: "J3xlhNfeyvA", title: "Mount Panorama (Bathurst) · Guía Super Formula (1:56.6)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Subida de Mountain Straight, Skyline y bajada técnica de Bathurst." },
    { id: "SgZheSkx3qQ", title: "Bathurst · Vuelta Gen3 Supercar (2:05.8)", channel: "Pete VDK", badge: "Hotlap", tag: "Demo Lap", desc: "Vuelta rápida de referencia entre muros en Mount Panorama." },
  ],
  suzuka: [
    { id: "0qvDdH-YyRw", title: "Suzuka Grand Prix · Guía Oficial de Trazado F4", channel: "Track Titan", badge: "Telemetría", tag: "Track Guide", desc: "Sector 1 de las Esses, Degner, Spoon y 130R en Suzuka." },
    { id: "1rVbFLlJp-4", title: "Suzuka · Guía GTP IMSA", channel: "HYMO Academy", badge: "GTP", tag: "IMSA Guide", desc: "Puntos de frenada y carga aerodinámica para prototipos en Suzuka." },
    { id: "aMDqfb4yWEU", title: "Suzuka · FIA F4 Regional Tour", channel: "Vatayan 81", badge: "Carrera", tag: "Esports", desc: "Carrera oficial en Suzuka International Racing Course." },
  ],
  redbullring: [
    { id: "PT9sjFCyqCc", title: "Red Bull Ring · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "New Content", desc: "Lanzamiento oficial del circuito de Spielberg en iRacing." },
    { id: "6m1-BYuoNvY", title: "Red Bull Ring GP · Guía de Trazado", channel: "Erilla", badge: "Guía", tag: "Track Guide", desc: "Frenadas fuertes de T1, T3 y gestión de límites en Red Bull Ring." },
    { id: "fsHUiXOcJZg", title: "Red Bull Ring · Carrera Oficial", channel: "iRacing Oficial", badge: "Carrera", tag: "Onboard", desc: "Batallas y trazadas en carrera en Red Bull Ring." },
  ],
  silverstone: [
    { id: "ijcodp01DHE", title: "Silverstone Circuit · Vuelta Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Track Preview", desc: "Maggots, Becketts, Copse y Stowe en el Silverstone escaneado por iRacing." },
    { id: "xtNy-qb9fFs", title: "Silverstone GP · Guía LMP2 (1:48.9)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Puntos de frenada y paso por curva rápida en Silverstone GP." },
    { id: "P_3FuTP0cfg", title: "Silverstone · Hotlap Cadillac V-Series.R GTP", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "IMSA", desc: "Vuelta rápida de referencia con telemetría en Silverstone." },
  ],
  interlagos: [
    { id: "xK1ud15MmdA", title: "Interlagos · Guía de Trazado F3 (1:26.8)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "S de Senna, Descida do Lago y Junção al detalle en Interlagos." },
    { id: "kR6BISAnF6I", title: "Autódromo José Carlos Pace · Vuelta Onboard", channel: "Pure_racing99", badge: "Onboard", tag: "Hotlap", desc: "Recorrido completo por el trazado brasileño de Interlagos." },
    { id: "B874kjsrUUw", title: "Interlagos · Carrera Super Formula SF23", channel: "Lluis Paris", badge: "Carrera", tag: "SF23", desc: "Carrera en directo desde el habitáculo en Interlagos." },
  ],
  barcelona: [
    { id: "H-RWfyPQA-Y", title: "Circuit de Barcelona-Catalunya · Presentación Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "Track Preview", desc: "Presentación oficial del Circuit de Barcelona-Catalunya en iRacing." },
    { id: "WAxzQi5sOjc", title: "Barcelona GP · Hotlap F4 (1:44.8)", channel: "Track Limits Coaching", badge: "Hotlap", tag: "Barcelona GP", desc: "Vuelta rápida limpia y referencias de vértices en Montmeló." },
  ],
  roadamerica: [
    { id: "yMnlK_uyZE4", title: "Road America · Actualización Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Updated Content", desc: "Reasfaltado y detalle oficial de Road America en iRacing." },
    { id: "k2ZEk9ml2gM", title: "Road America · Creator Series Round 1", channel: "iRacing Oficial", badge: "Carrera", tag: "Race", desc: "Carrera oficial en las rápidas rectas y curvas de Road America." },
    { id: "1adhbGV10yY", title: "Road America · Guía BMW M Hybrid V8 + Telemetría", channel: "Track Titan", badge: "Telemetría", tag: "Track Guide", desc: "Guía de vuelta rápida en el Carousel y Canada Corner." },
  ],
  imola: [
    { id: "27429G-0N9Y", title: "Autodromo Enzo e Dino Ferrari (Imola) · Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "Teaser", desc: "Presentación oficial del circuito de Imola en iRacing." },
    { id: "STaTEEr0BoU", title: "Imola · Guía Porsche Cup 992.2 (1:41.0)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Tamburello, Acque Minerali y Variante Alta en Imola." },
    { id: "5csQlLIKbD0", title: "Imola · Guía Super Formula Lights (1:33.3)", channel: "Sambo iRacing", badge: "Telemetría", tag: "SFL Guide", desc: "Referencias de ataque en pianos y frenada en Imola." },
  ],
  fuji: [
    { id: "G0qoyqjHv1c", title: "Fuji Speedway · Guía GT3 McLaren 720S (1:37.3)", channel: "Sambo iRacing", badge: "Guía", tag: "Fuji GP", desc: "Frenada de T1, sector técnico final y trazada en Fuji GP." },
    { id: "zKkHPH0Yl1I", title: "Fuji International Speedway · Guía SF23 + Telemetría", channel: "Track Titan", badge: "Telemetría", tag: "Track Guide", desc: "Guía completa con telemetría en Fuji Speedway." },
  ],
  roadatlanta: [
    { id: "4JLjBpPndv4", title: "Road Atlanta · Guía Oficial FIA F4 (1:19.9)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Las Esses ciegas, T10a/b y bajada final de Road Atlanta." },
    { id: "4u5VtozXo5E", title: "Road Atlanta · Hotlap GT3 (1:18.4)", channel: "SimRacingSetups", badge: "Hotlap", tag: "GT3", desc: "Vuelta rápida de referencia en Michelin Raceway Road Atlanta." },
  ],
  lagunaseca: [
    { id: "gpf_H8TIdLQ", title: "WeatherTech Raceway Laguna Seca · Guía F4 (1:20.8)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Andretti Hairpin, el Sacacorchos (Corkscrew) y Rainey Curve." },
    { id: "0sWZGaFuypU", title: "Laguna Seca · Guía de Trazado y Pianos", channel: "Mirko Merlo", badge: "Análisis", tag: "Track Guide", desc: "Referencias visuales y puntos de frenada en Laguna Seca." },
  ],
  mugello: [
    { id: "Y1r8i14t9Kc", title: "Autodromo del Mugello · Guía F4 (1:47.4)", channel: "GITGUD Racing", badge: "Guía", tag: "Track Guide", desc: "San Donato, Casanova-Savelli y Arrabbiata 1 & 2 en Mugello." },
    { id: "Jf7Vp7NvcuM", title: "Mugello · Guía Porsche 992 GT3 R (1:45.9)", channel: "GITGUD Racing", badge: "GT3", tag: "GT3 Guide", desc: "Ritmo de vuelta rápida y puntos de apoyo en Mugello." },
  ],
  algarve: [
    { id: "oUOG1ilzVZg", title: "Algarve (Portimão) · Guía GT3 GP", channel: "HYMO Hotlaps", badge: "GT3", tag: "Track Guide", desc: "Cambios de rasante, frenadas ciegas y trazada en Portimão." },
    { id: "c2LlcnYxWSk", title: "Algarve (Portimão) · Guía F4 (1:44.1)", channel: "GITGUD Racing", badge: "Guía", tag: "Track Guide", desc: "Referencias exactas de vértices en el circuito del Algarve." },
  ],
  zandvoort: [
    { id: "ZS3t2y7Wb-M", title: "Circuit Zandvoort · Rescan Oficial 2023 iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Rescanned", desc: "Presentación oficial de los peraltes de Hugenholtz y Luyendykbocht." },
    { id: "aQmF4iCA2yY", title: "Zandvoort · Guía F4 (1:33.9)", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Trazada y carga en las curvas peraltadas de Zandvoort." },
  ],
  brandshatch: [
    { id: "QopmH7l5VDI", title: "Brands Hatch GP · Guía de Trazado + Telemetría", channel: "Track Titan", badge: "Telemetría", tag: "Track Guide", desc: "Paddock Hill Bend, Druids y sector rápido de bosque en Brands Hatch." },
  ],
  hockenheim: [
    { id: "B4K4j6l-khY", title: "Hockenheimring GP · Guía de Trazado + Telemetría", channel: "Track Titan", badge: "Telemetría", tag: "Track Guide", desc: "Parabolika, Hairpin, Sachs Kurve y entrada al Motodrom." },
  ],
  cota: [
    { id: "IoJPNqFGayc", title: "Circuit of the Americas (COTA) · Guía Completa", channel: "Maconi Setup Shop", badge: "Guía", tag: "Track Guide", desc: "Subida de T1, sector de Esses y complejo del estadio en COTA." },
    { id: "AR86THlLneA", title: "COTA · Hotlap Audi R8 LMS GT3 EVO II", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "GT Sprint", desc: "Vuelta rápida de referencia en Circuit of the Americas." },
  ],
};

const CAR_VIDEOS_MAP: Record<string, VerifiedClip[]> = {
  porsche992cup: [
    { id: "MpTNLPSVuzg", title: "Porsche 911 Cup (992.2) · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Cup Showcase", desc: "Presentación oficial del Porsche 911 Cup (992.2) sin ABS ni control de tracción." },
    { id: "STaTEEr0BoU", title: "Porsche 911 Cup (992.2) · Guía de Conducción en Imola", channel: "Sambo iRacing", badge: "Guía", tag: "Driving Tips", desc: "Control de frenada sin ABS y modulación del acelerador con el 992.2 Cup." },
    { id: "kFgsC9nMyNU", title: "Porsche 911 Cup (992.2) · Onboard en Long Beach", channel: "Sambo iRacing", badge: "Onboard", tag: "Street Circuit", desc: "Vuelta completa al límite entre muros con el Porsche 911 Cup." },
  ],
  porsche963: [
    { id: "UZ-UAOizJao", title: "Porsche 963 GTP · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "GTP Showcase", desc: "Sistema híbrido LMDh, aerodinámica y sonido del Porsche 963 GTP." },
    { id: "mWARS1lkNkk", title: "Porsche 963 GTP · Trailer de Lanzamiento", channel: "RaceSimCentral", badge: "Showcase", tag: "IMSA GTP", desc: "Vista en pista y detalles del prototipo Porsche 963 en iRacing." },
    { id: "Qk1ve94p3kU", title: "Porsche 963 GTP · Hotlap IMSA", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "IMSA", desc: "Vuelta rápida de referencia y gestión híbrida con el Porsche 963." },
  ],
  porsche718gt4: [
    { id: "cOpxuf0Vh9M", title: "Porsche 718 Cayman GT4 · Hotlap Navarra", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "GT4", desc: "Vuelta rápida y balance en frenada con el Porsche 718 Cayman GT4." },
    { id: "Qip9FqfNGeU", title: "Porsche 718 Cayman GT4 · Guía en Motegi", channel: "Sambo iRacing", badge: "Guía", tag: "GT4 Guide", desc: "Referencias de pilotaje y tracción en el Porsche 718 GT4." },
  ],
  porsche992gt3: [
    { id: "NTLCqJf8WmY", title: "Porsche 911 GT3 R (992) · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "GT3 Showcase", desc: "Lanzamiento oficial y dinámica del Porsche 911 GT3 R (992)." },
    { id: "J281j1yjDqY", title: "Porsche 911 GT3 R (992) · Hotlap Le Mans", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "Endurance", desc: "Ritmo de resistencia y velocidad punta con el 992 GT3 R." },
    { id: "Jf7Vp7NvcuM", title: "Porsche 911 GT3 R (992) · Guía Mugello", channel: "GITGUD Racing", badge: "Guía", tag: "GT3", desc: "Cómo extraer el máximo del tren delantero del 992 GT3 R." },
  ],
  ferrari499p: [
    { id: "crDlhTVFBFg", title: "Ferrari 499P LMH · Presentación en iRacing", channel: "Michi Hoyer", badge: "Oficial", tag: "LMH Hypercar", desc: "Análisis completo del Ferrari 499P LMH: tracción integral híbrida y aerodinámica." },
    { id: "lWuTkAcib_o", title: "Ferrari 499P LMH · Hotlap Le Mans", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "Majors 24", desc: "Vuelta rápida de referencia con el Ferrari 499P en La Sarthe." },
  ],
  ferrari296challenge: [
    { id: "mtIVZUGoS6E", title: "Ferrari 296 Challenge · Análisis en Pista iRacing", channel: "Heikki360ES", badge: "Análisis", tag: "Challenge", desc: "Comportamiento, potencia y diferencias del Ferrari 296 Challenge frente al GT3." },
  ],
  ferrari296: [
    { id: "cmEbLn8Ffxw", title: "Ferrari 296 GT3 · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "GT3 Showcase", desc: "Presentación oficial del Ferrari 296 GT3: V6 biturbo y paquete aero." },
    { id: "HNGkRzqpNZw", title: "Ferrari 296 GT3 · Guía de Pilotaje y Trazada", channel: "Sambo iRacing", badge: "Guía", tag: "GT3 Guide", desc: "Gestión de mapas de TC, reparto de frenada y paso por curva en el 296 GT3." },
    { id: "ThA117d29i0", title: "Ferrari 296 GT3 · Hotlap Spa + Telemetría", channel: "Race Forge eSports", badge: "Telemetría", tag: "Hotlap", desc: "Vuelta rápida en Spa-Francorchamps con telemetría completa del 296 GT3." },
  ],
  bmwmhybridv8: [
    { id: "y4tPrUhvyeE", title: "BMW M Hybrid V8 · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "GTP Showcase", desc: "Lanzamiento oficial del BMW M Hybrid V8 en la categoría GTP." },
    { id: "wlkANe-BVzw", title: "BMW M Hybrid V8 Evo · Actualización Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "Evo Update", desc: "Novedades aerodinámicas y de conducción de la especificación Evo." },
    { id: "1adhbGV10yY", title: "BMW M Hybrid V8 Evo · Guía Road America + Telemetría", channel: "Track Titan", badge: "Telemetría", tag: "Track Guide", desc: "Vuelta rápida y análisis de frenadas con el BMW M Hybrid V8." },
  ],
  bmwm4gt4: [
    { id: "stGkw6p7Cio", title: "BMW M4 GT4 · Guía en Le Mans (4:10.5)", channel: "Sambo iRacing", badge: "Guía", tag: "GT4 Guide", desc: "Comportamiento y gestión de rebufos con el BMW M4 GT4." },
    { id: "ci27d1moo1s", title: "BMW M4 GT4 · Guía en Watkins Glen Boot", channel: "Sambo iRacing", badge: "Onboard", tag: "GT4", desc: "Paso por las Esses y control de peso del BMW M4 GT4." },
  ],
  bmwm4: [
    { id: "C5I0ym_w0Uo", title: "BMW M4 GT3 EVO · Hotlap Nürburgring VLN", channel: "Majors Garage", badge: "Hotlap", tag: "Nordschleife", desc: "Vuelta rápida oficial con el BMW M4 GT3 en Nürburgring Combined." },
    { id: "Yhivso3np6o", title: "BMW M4 GT3 · Guía en COTA", channel: "Sambo iRacing", badge: "Guía", tag: "GT3 Guide", desc: "Control de tracción y frenada estable con el BMW M4 GT3." },
    { id: "LZQ7SJDm_eQ", title: "BMW M4 GT3 · Guía de Pilotaje", channel: "Sambo iRacing", badge: "Técnica", tag: "Driving Tips", desc: "Referencias de giro y tracción con el BMW M4 GT3." },
  ],
  mercedes: [
    { id: "iexPUbjhec8", title: "Mercedes-AMG GT3 & GT4 · Presentación Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "Showcase", desc: "Motor V8 atmosférico y comportamiento en pista del Mercedes-AMG." },
    { id: "onEJB2zWMKg", title: "Mercedes-AMG GT3 2020 · Guía COTA + Telemetría", channel: "Track Titan", badge: "Telemetría", tag: "GT3 Guide", desc: "Vuelta rápida con trazos de freno y acelerador en el AMG GT3." },
  ],
  audi: [
    { id: "CQYozlbUqZQ", title: "Audi R8 LMS GT3 EVO II · Hotlap Spa", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "GT Sprint", desc: "Vuelta rápida en Spa-Francorchamps aprovechando el motor V10 del R8." },
    { id: "_Al6_HUMoMM", title: "Audi R8 LMS GT3 EVO II · Hotlap Le Mans", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "Endurance", desc: "Estabilidad en alta velocidad y chicanes con el Audi R8 GT3." },
    { id: "AR86THlLneA", title: "Audi R8 LMS GT3 EVO II · Hotlap COTA", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "GT Sprint", desc: "Paso por curva rápida y frenadas fuertes con el R8 LMS EVO II." },
  ],
  corvette: [
    { id: "fz-nvXGARws", title: "Chevrolet Corvette Z06 GT3.R · Presentación Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "GT3 Showcase", desc: "V8 flat-plane y paquete aero del Corvette Z06 GT3.R en iRacing." },
    { id: "2yBpHBHm9-c", title: "Corvette Z06 GT3.R · Análisis de Conducción y FFB", channel: "PitLanePete", badge: "Técnica", tag: "Review", desc: "Sensaciones al volante, frenada y comportamiento del Corvette Z06 GT3.R." },
    { id: "jnMNCecGjMc", title: "Corvette Z06 GT3.R · Hotlap Watkins Glen 6h", channel: "GO Setups", badge: "Hotlap", tag: "Endurance", desc: "Ritmo de resistencia con el Corvette Z06 GT3.R." },
  ],
  mustang: [
    { id: "x1syxyOR3iY", title: "Ford Mustang GT3 · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "GT3 Showcase", desc: "Motor Coyote V8 y debut oficial del Ford Mustang GT3 en iRacing." },
    { id: "rmYMIq_YgMU", title: "Ford Mustang GT3 · Hotlap Le Mans", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "GT Sprint", desc: "Vuelta rápida en Le Mans con el Ford Mustang GT3." },
    { id: "cPBP_RTnxBc", title: "Ford Mustang GT3 · Hotlap Nordschleife VLN", channel: "HYMO Hotlaps", badge: "Onboard", tag: "NEC", desc: "Vuelta al límite en el Infierno Verde con el Mustang GT3." },
  ],
  mclaren: [
    { id: "XksUQYKTFBU", title: "McLaren 720S GT3 EVO · Presentación Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "GT3 Showcase", desc: "Lanzamiento oficial del McLaren 720S GT3 EVO en iRacing." },
    { id: "P2i443bEONY", title: "McLaren 720S GT3 EVO · Análisis Técnico", channel: "PitLanePete", badge: "Técnica", tag: "Review", desc: "Dinámica, agarre aerodinámico y puntos fuertes del 720S GT3 EVO." },
    { id: "F8gnIWKpAPs", title: "McLaren 720S GT3 EVO · Guía Long Beach", channel: "Sambo iRacing", badge: "Guía", tag: "Onboard", desc: "Vuelta rápida urbana con el McLaren 720S GT3 EVO." },
  ],
  lamborghini: [
    { id: "GsmKmtGfnJo", title: "Lamborghini Huracán GT3 EVO · Análisis en Pista", channel: "PitLanePete", badge: "Técnica", tag: "Review", desc: "Comportamiento del V10 y paso por curva del Huracán GT3 EVO." },
    { id: "YTmglSLqhDo", title: "Lamborghini Huracán GT3 EVO · Guía de Pilotaje", channel: "Track Titan", badge: "Guía", tag: "GT3", desc: "Claves de setup y pilotaje del Lamborghini Huracán GT3 EVO." },
    { id: "4u5VtozXo5E", title: "Lamborghini Huracán GT3 EVO · Hotlap Road Atlanta", channel: "SimRacingSetups", badge: "Hotlap", tag: "Hotlap", desc: "Vuelta rápida de referencia con el Huracán GT3 EVO." },
  ],
  aston: [
    { id: "gvQ4r6eWPOE", title: "Aston Martin Vantage GT3 EVO · Hotlap Le Mans", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "IMSA", desc: "Vuelta rápida oficial de referencia con el Aston Martin Vantage GT3 EVO." },
  ],
  mx5: [
    { id: "PaJGLr1g8Kw", title: "Global Mazda MX-5 Cup · Actualización Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "Showcase", desc: "Presentación oficial del Mazda MX-5 Cup en iRacing." },
    { id: "11eXzdFgZYU", title: "Mazda MX-5 · Guía de Pilotaje", channel: "Sambo iRacing", badge: "Guía", tag: "Production Car", desc: "Cómo mantener inercia y velocidad de paso por curva en el MX-5." },
    { id: "qpXPx3BCL-w", title: "Mazda MX-5 · Carrera Oficial", channel: "iRacing Oficial", badge: "Carrera", tag: "Highlights", desc: "Batallas limpias en rebufo con el Mazda MX-5 Cup." },
  ],
  gr86: [
    { id: "5PCiJ2GATEM", title: "Toyota GR86 Cup · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Showcase", desc: "Lanzamiento oficial del Toyota GR86 Cup." },
    { id: "6m1-BYuoNvY", title: "Toyota GR86 · Guía en Red Bull Ring", channel: "Erilla", badge: "Guía", tag: "Track Guide", desc: "Trazadas limpias y gestión de cambio con el GR86." },
    { id: "h_o4VbxOGsQ", title: "Toyota GR86 · Guía en Sebring", channel: "Erilla", badge: "Onboard", tag: "Track Guide", desc: "Paso por curva y modulación de freno en el Toyota GR86." },
  ],
  superformula: [
    { id: "7PVlLORnxfU", title: "Super Formula SF23 · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "Showcase", desc: "Aerodinámica extrema y sistema Overtake del Super Formula SF23." },
    { id: "HnWIyToTXbU", title: "Super Formula SF23 · Trailer Oficial", channel: "RaceSimCentral", badge: "Trailer", tag: "SF23", desc: "Imágenes en pista y sonido del SF23 en iRacing." },
    { id: "kvYSqIUVbRM", title: "Super Formula SF23 · Hotlap Bathurst", channel: "iRacing Oficial", badge: "Hotlap", tag: "Hotlap", desc: "Vuelta rápida al límite con el SF23 en Mount Panorama." },
  ],
  dallarap217: [
    { id: "SxUePpENSlM", title: "Dallara P217 LMP2 · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "LMP2 Showcase", desc: "Presentación oficial del prototipo Dallara P217 LMP2." },
    { id: "ywxvYIdzj34", title: "Dallara P217 LMP2 · Hotlap Montreal", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "IMSA", desc: "Frenadas tardías y tracción con el Dallara P217 LMP2." },
    { id: "xtNy-qb9fFs", title: "Dallara P217 LMP2 · Guía Silverstone", channel: "Sambo iRacing", badge: "Guía", tag: "Track Guide", desc: "Paso por curva de alta carga con el Dallara P217." },
  ],
  dallara_f3: [
    { id: "Jo1o6USTWM8", title: "Dallara F3 · Presentación Oficial iRacing", channel: "iRacing Oficial", badge: "Oficial", tag: "F3 Showcase", desc: "Presentación del monoplaza Dallara F3 en iRacing." },
    { id: "1yrE5vsI4ec", title: "Dallara F3 · Hotlap Barber", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "Formula C", desc: "Vuelta rápida limpia con el Dallara F3." },
    { id: "F7cxU9Sb00k", title: "Dallara F3 · Hotlap Mexico City", channel: "HYMO Hotlaps", badge: "Hotlap", tag: "Formula C", desc: "Referencia de trazada y carga aero con el Dallara F3." },
  ],
  acura: [
    { id: "J3v4Wr5afcM", title: "Acura ARX-06 GTP · Trailer Oficial iRacing", channel: "RaceSimCentral", badge: "Oficial", tag: "GTP Showcase", desc: "Presentación en pista del prototipo Acura ARX-06 GTP." },
  ],
  cadillac: [
    { id: "jLxU8upMjrs", title: "Cadillac V-Series.R GTP · Presentación Oficial", channel: "iRacing Oficial", badge: "Oficial", tag: "GTP Showcase", desc: "Sonido V8 atmosférico y sistema híbrido del Cadillac V-Series.R." },
    { id: "O8q9KZvK8TY", title: "Cadillac V-Series.R GTP · Season Spotlight", channel: "iRacing Oficial", badge: "Oficial", tag: "IMSA", desc: "El Cadillac V-Series.R en acción en las series IMSA de iRacing." },
    { id: "3kW5HojC1RE", title: "Cadillac V-Series.R GTP · Vuelta Onboard", channel: "iRacing Oficial", badge: "Onboard", tag: "Cockpit", desc: "Vuelta completa desde el habitáculo del Cadillac GTP." },
  ],
};

function resolveTrackVideoClips(trackName: string, trackSlug?: string): VerifiedClip[] {
  const norm = `${trackSlug || ''} ${trackName || ''}`.toLowerCase();
  if (norm.includes('nurburg') || norm.includes('nordschleife')) return TRACK_VIDEOS_MAP.nurburgring;
  if (norm.includes('spa')) return TRACK_VIDEOS_MAP.spa;
  if (norm.includes('daytona')) return TRACK_VIDEOS_MAP.daytona;
  if (norm.includes('long beach') || norm.includes('longbeach')) return TRACK_VIDEOS_MAP.longbeach;
  if (norm.includes('mans') || norm.includes('sarthe')) return TRACK_VIDEOS_MAP.lemans;
  if (norm.includes('sebring')) return TRACK_VIDEOS_MAP.sebring;
  if (norm.includes('watkins')) return TRACK_VIDEOS_MAP.watkins;
  if (norm.includes('monza')) return TRACK_VIDEOS_MAP.monza;
  if (norm.includes('bathurst') || norm.includes('panorama')) return TRACK_VIDEOS_MAP.bathurst;
  if (norm.includes('suzuka')) return TRACK_VIDEOS_MAP.suzuka;
  if (norm.includes('red bull') || norm.includes('spielberg') || norm.includes('redbull')) return TRACK_VIDEOS_MAP.redbullring;
  if (norm.includes('silverstone')) return TRACK_VIDEOS_MAP.silverstone;
  if (norm.includes('interlagos') || norm.includes('jose carlos pace') || norm.includes('josé carlos pace')) return TRACK_VIDEOS_MAP.interlagos;
  if (norm.includes('barcelona') || norm.includes('catalunya')) return TRACK_VIDEOS_MAP.barcelona;
  if (norm.includes('road america') || norm.includes('roadamerica')) return TRACK_VIDEOS_MAP.roadamerica;
  if (norm.includes('imola') || norm.includes('enzo e dino')) return TRACK_VIDEOS_MAP.imola;
  if (norm.includes('fuji')) return TRACK_VIDEOS_MAP.fuji;
  if (norm.includes('road atlanta') || norm.includes('roadatlanta')) return TRACK_VIDEOS_MAP.roadatlanta;
  if (norm.includes('laguna seca') || norm.includes('lagunaseca')) return TRACK_VIDEOS_MAP.lagunaseca;
  if (norm.includes('mugello')) return TRACK_VIDEOS_MAP.mugello;
  if (norm.includes('algarve') || norm.includes('portimao') || norm.includes('portimão')) return TRACK_VIDEOS_MAP.algarve;
  if (norm.includes('zandvoort')) return TRACK_VIDEOS_MAP.zandvoort;
  if (norm.includes('brands hatch') || norm.includes('brandshatch')) return TRACK_VIDEOS_MAP.brandshatch;
  if (norm.includes('hockenheim')) return TRACK_VIDEOS_MAP.hockenheim;
  if (norm.includes('americas') || norm.includes('cota')) return TRACK_VIDEOS_MAP.cota;
  return [];
}

function resolveCarVideoClips(brand: string, model: string, carFolder?: string): VerifiedClip[] {
  const norm = `${carFolder || ''} ${brand || ''} ${model || ''}`.toLowerCase();
  if (norm.includes('porsche') && norm.includes('963')) return CAR_VIDEOS_MAP.porsche963;
  if (norm.includes('porsche') && norm.includes('cup')) return CAR_VIDEOS_MAP.porsche992cup;
  if (norm.includes('porsche') && (norm.includes('718') || norm.includes('cayman') || norm.includes('gt4'))) return CAR_VIDEOS_MAP.porsche718gt4;
  if (norm.includes('porsche') && (norm.includes('992') || norm.includes('gt3'))) return CAR_VIDEOS_MAP.porsche992gt3;
  if (norm.includes('ferrari') && norm.includes('499p')) return CAR_VIDEOS_MAP.ferrari499p;
  if (norm.includes('ferrari') && norm.includes('challenge')) return CAR_VIDEOS_MAP.ferrari296challenge;
  if (norm.includes('ferrari') && norm.includes('296')) return CAR_VIDEOS_MAP.ferrari296;
  if (norm.includes('bmw') && (norm.includes('hybrid') || norm.includes('lmdh'))) return CAR_VIDEOS_MAP.bmwmhybridv8;
  if (norm.includes('bmw') && norm.includes('gt4')) return CAR_VIDEOS_MAP.bmwm4gt4;
  if (norm.includes('bmw') && norm.includes('m4')) return CAR_VIDEOS_MAP.bmwm4;
  if (norm.includes('mercedes') && (norm.includes('gt3') || norm.includes('amg'))) return CAR_VIDEOS_MAP.mercedes;
  if (norm.includes('audi') && norm.includes('r8')) return CAR_VIDEOS_MAP.audi;
  if (norm.includes('corvette') && norm.includes('z06')) return CAR_VIDEOS_MAP.corvette;
  if (norm.includes('mustang') && norm.includes('gt3')) return CAR_VIDEOS_MAP.mustang;
  if (norm.includes('mclaren') && norm.includes('720s')) return CAR_VIDEOS_MAP.mclaren;
  if (norm.includes('lamborghini') && norm.includes('huracan')) return CAR_VIDEOS_MAP.lamborghini;
  if (norm.includes('aston') && norm.includes('gt3')) return CAR_VIDEOS_MAP.aston;
  if (norm.includes('mx5') || norm.includes('miata')) return CAR_VIDEOS_MAP.mx5;
  if (norm.includes('gr86')) return CAR_VIDEOS_MAP.gr86;
  if (norm.includes('superformula') && !norm.includes('lights')) return CAR_VIDEOS_MAP.superformula;
  if (norm.includes('p217') || norm.includes('lmp2')) return CAR_VIDEOS_MAP.dallarap217;
  if (norm.includes('dallaraf3') || (norm.includes('dallara') && norm.includes('f3'))) return CAR_VIDEOS_MAP.dallara_f3;
  if (norm.includes('acura') && norm.includes('arx')) return CAR_VIDEOS_MAP.acura;
  if (norm.includes('cadillac') && norm.includes('vseries')) return CAR_VIDEOS_MAP.cadillac;
  return [];
}

function toMediaVideos(clips: VerifiedClip[]): MediaVideo[] {
  return clips.map((c) => ({
    videoId: c.id,
    title: c.title,
    channel: c.channel,
    badge: c.badge,
    tag: c.tag,
    url: `https://www.youtube.com/watch?v=${c.id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${c.id}?autoplay=1&rel=0`,
    thumbnail: `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`,
    desc: c.desc,
  }));
}

export function getTrackVideos(trackName: string, _category: string = "Road", trackSlug?: string): MediaVideo[] {
  return toMediaVideos(resolveTrackVideoClips(trackName, trackSlug));
}

export function getCarVideos(brand: string, model: string, _carClass: string, carFolder?: string): MediaVideo[] {
  return toMediaVideos(resolveCarVideoClips(brand, model, carFolder));
}
