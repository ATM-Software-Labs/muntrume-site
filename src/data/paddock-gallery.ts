export interface GalleryPhoto {
  readonly id: string;
  readonly carPath: string; // Relación estricta con DriverInfo.Drivers[CamCarIdx].CarPath
  readonly title: string;
  readonly subtitle: string;
  readonly tag: string;
  readonly img: string;
  readonly thumb: string;
  readonly desc: string;
}

export interface GalleryAlbum {
  readonly slug: string;
  readonly carPath: string; // Identificador exacto de telemetría iRacing
  readonly title: string;
  readonly brand: string;
  readonly carClass: string;
  readonly cover: string;
  readonly summary: string;
  readonly photos: readonly GalleryPhoto[];
}

export const PADDOCK_ALBUMS: readonly GalleryAlbum[] = [
  {
    slug: "ferrari296gt3",
    carPath: "ferrari296gt3",
    title: "Ferrari 296 GT3",
    brand: "Ferrari",
    carClass: "GT3",
    cover: "/assets/cars/ferrari296gt3.webp",
    summary: "Renders oficiales de iRacing, librea corporativa de competición y telemetría en curva rápida.",
    photos: [
      {
        id: "ferrari-studio",
        carPath: "ferrari296gt3",
        title: "Ferrari 296 GT3 · Render de Estudio Oficial",
        subtitle: "Asset oficial del catálogo iRacing",
        tag: "Estudio iRacing",
        img: "/assets/cars/ferrari296gt3.webp",
        thumb: "/assets/cars/ferrari296gt3.webp",
        desc: "Ficha técnica oficial de modelado 3D por escaneo láser del Ferrari 296 GT3.",
      },
      {
        id: "ferrari-pista",
        carPath: "ferrari296gt3",
        title: "Ferrari 296 GT3 en Pista",
        subtitle: "Sesión oficial en simulador iRacing",
        tag: "Pista",
        img: "/assets/img/coche1.webp",
        thumb: "/assets/img/coche1-640.webp",
        desc: "Captura en pista con librea oficial de competición y carga aerodinámica en curva peraltada.",
      },
      {
        id: "ferrari-nocturna",
        carPath: "ferrari296gt3",
        title: "Stint Nocturno y Ópticas LED",
        subtitle: "Resistencia oficial iRacing",
        tag: "Nocturna",
        img: "/assets/img/coche3.webp",
        thumb: "/assets/img/coche3-640.webp",
        desc: "Transición al anochecer con gestión de presiones de neumático y temperatura de frenos.",
      },
      {
        id: "ferrari-vertice",
        carPath: "ferrari296gt3",
        title: "Apoyo Aerodinámico en Vértice",
        subtitle: "Paso por curva de alta velocidad",
        tag: "Telemetría",
        img: "/assets/img/coche4.webp",
        thumb: "/assets/img/coche4-640.webp",
        desc: "Alineación y rigidez de amortiguación trabajando al límite de adherencia sobre el piano.",
      },
    ],
  },
  {
    slug: "porsche992rgt3",
    carPath: "porsche992rgt3",
    title: "Porsche 911 GT3 R (992)",
    brand: "Porsche",
    carClass: "GT3",
    cover: "/assets/cars/porsche992rgt3.webp",
    summary: "Render oficial de iRacing, aerodinámica de cuello de cisne y suspensiones de doble horquilla.",
    photos: [
      {
        id: "porsche-studio",
        carPath: "porsche992rgt3",
        title: "Porsche 911 GT3 R (992) · Render de Estudio",
        subtitle: "Asset oficial del catálogo iRacing",
        tag: "Estudio iRacing",
        img: "/assets/cars/porsche992rgt3.webp",
        thumb: "/assets/cars/porsche992rgt3.webp",
        desc: "Render de estudio oficial iRacing mostrando el chasis aligerado y el paquete aerodinámico del 992.",
      },
      {
        id: "porsche-series",
        carPath: "porsche992rgt3",
        title: "Competición Oficial Porsche en iRacing",
        subtitle: "Series oficiales en el simulador",
        tag: "Competición",
        img: "/assets/img/series/porsche-cup.jpg",
        thumb: "/assets/img/series/porsche-cup.jpg",
        desc: "Acción en pista de la armada Porsche compitiendo en campeonatos oficiales de iRacing.",
      },
      {
        id: "porsche-peloton",
        carPath: "porsche992rgt3",
        title: "Pelotón GT3 en Curva Rápida",
        subtitle: "Gestión de carrera y tráfico en grupo",
        tag: "Carrera",
        img: "/assets/img/coche2.webp",
        thumb: "/assets/img/coche2-640.webp",
        desc: "Lucha cerrada de posición aprovechando la estabilidad trasera característica del 911.",
      },
    ],
  },
  {
    slug: "porsche9922cup",
    carPath: "porsche9922cup",
    title: "Porsche 911 GT3 Cup (992.2)",
    brand: "Porsche",
    carClass: "Cup",
    cover: "/assets/cars/porsche9922cup.webp",
    summary: "Copa monomarca oficial sin ABS ni control de tracción: conducción pura de resistencia.",
    photos: [
      {
        id: "porsche-cup-studio",
        carPath: "porsche9922cup",
        title: "Porsche 911 GT3 Cup (992.2) · Asset Oficial",
        subtitle: "Modelo oficial escaneado por láser iRacing",
        tag: "Estudio iRacing",
        img: "/assets/cars/porsche9922cup.webp",
        thumb: "/assets/cars/porsche9922cup.webp",
        desc: "Render de estudio oficial de iRacing para el Porsche 911 GT3 Cup 992.2.",
      },
      {
        id: "porsche-cup-track",
        carPath: "porsche9922cup",
        title: "Porsche Cup Supercup en Trazado GP",
        subtitle: "Gestión de frenada sin ABS",
        tag: "Competición",
        img: "/assets/img/series/porsche-cup.jpg",
        thumb: "/assets/img/series/porsche-cup.jpg",
        desc: "Transición de masas y apurada de frenada en copa monomarca oficial.",
      },
    ],
  },
  {
    slug: "bmwm4gt3",
    carPath: "bmwm4gt3",
    title: "BMW M4 GT3",
    brand: "BMW",
    carClass: "GT3",
    cover: "/assets/cars/bmwm4gt3.webp",
    summary: "Motor 3.0L TwinPower Turbo, batalla larga y estabilidad en frenadas intensas.",
    photos: [
      {
        id: "bmw-studio",
        carPath: "bmwm4gt3",
        title: "BMW M4 GT3 · Render de Estudio Oficial",
        subtitle: "Asset oficial del catálogo iRacing",
        tag: "Estudio iRacing",
        img: "/assets/cars/bmwm4gt3.webp",
        thumb: "/assets/cars/bmwm4gt3.webp",
        desc: "Fotografía técnica de estudio del BMW M4 GT3 EVO modelado oficialmente en iRacing.",
      },
      {
        id: "bmw-series",
        carPath: "bmwm4gt3",
        title: "GT Sprint Series Oficial iRacing",
        subtitle: "Competición oficial de GT3",
        tag: "GT Sprint",
        img: "/assets/img/series/gt-sprint.jpg",
        thumb: "/assets/img/series/gt-sprint.jpg",
        desc: "Frenada sincronizada y lucha por la posición en trazado de velocidad media.",
      },
      {
        id: "bmw-carrera",
        carPath: "bmwm4gt3",
        title: "BMW M4 GT3 · Librea de Competición",
        subtitle: "Render técnico oficial iRacing",
        tag: "Pista iRacing",
        img: "/assets/cars/bmwm4gt3.webp",
        thumb: "/assets/cars/bmwm4gt3.webp",
        desc: "Comportamiento del chasis ante transferencia de masas y compresión de amortiguadores.",
      },
    ],
  },
  {
    slug: "gt3-endurance",
    carPath: "multiclass",
    title: "GT3 Endurance & Parrilla",
    brand: "Multiclase",
    carClass: "Endurance",
    cover: "/assets/img/race1-640.webp",
    summary: "Gestión de tráfico multiclase, salidas oficiales y frenadas en grupo en iRacing.",
    photos: [
      {
        id: "g3",
        carPath: "multiclass",
        title: "Tráfico y Frenada en Grupo",
        subtitle: "Gestión de Carrera y Doblados",
        tag: "Pista iRacing",
        img: "/assets/img/race1.webp",
        thumb: "/assets/img/race1-640.webp",
        desc: "Frenada sincronizada con luces de cruce encendidas y gestión de adelantamientos en iRacing.",
      },
      {
        id: "g6",
        carPath: "multiclass",
        title: "Parrilla de Salida al Ocaso",
        subtitle: "Alineación Oficial de Escuderías",
        tag: "Parrilla iRacing",
        img: "/assets/img/hero-bg.webp",
        thumb: "/assets/img/hero-bg-640.webp",
        desc: "Momento previo a la bandera verde con los vehículos en formación de parrilla para la prueba de resistencia.",
      },
    ],
  },
  {
    slug: "pit-wall-tech",
    carPath: "team_engineering",
    title: "Pit Wall & Telemetría",
    brand: "Muntrume Tech",
    carClass: "Ingeniería",
    cover: "/assets/img/og-team.jpg",
    summary: "Estación de datos Garage 61 a 60 Hz, Setup Vault e ingeniería de telemetría.",
    photos: [
      {
        id: "g7",
        carPath: "team_engineering",
        title: "Puesto de Control de Telemetría",
        subtitle: "Monitorización Garage 61 en Directo",
        tag: "Telemetría",
        img: "/assets/img/og-team.jpg",
        thumb: "/assets/img/og-team.jpg",
        desc: "Estación de análisis de datos a 60 Hz con curvas de aceleración, presión de freno y deltas de tiempo por sector.",
      },
      {
        id: "g8",
        carPath: "team_engineering",
        title: "Identidad Corporativa 2026",
        subtitle: "Identidad visual de Muntrume Motorsport",
        tag: "Escudería",
        img: "/assets/img/og-cover.jpg",
        thumb: "/assets/img/og-cover.jpg",
        desc: "Diseño institucional del equipo combinando el verde neón (#00E699), gris carbón y tipografía deportiva.",
      },
      {
        id: "g9",
        carPath: "team_engineering",
        title: "Setup Vault (.STO)",
        subtitle: "Banco de Reglajes Oficiales",
        tag: "Setup Lab",
        img: "/assets/img/og-setups.jpg",
        thumb: "/assets/img/og-setups.jpg",
        desc: "Catálogo técnico con configuraciones .STO verificadas y listas para sincronización local con MMT Sync.",
      },
    ],
  },
];

/**
 * Filtro estricto anti-mezcla: cualquier foto sin carPath o cuyo carPath no coincida
 * exactamente con el vehículo solicitado queda excluida de la visualización.
 */
export function getSanitizedPhotosByCar(targetCarPath: string): GalleryPhoto[] {
  const norm = String(targetCarPath || "").toLowerCase().trim();
  if (!norm) return [];
  const results: GalleryPhoto[] = [];
  for (const album of PADDOCK_ALBUMS) {
    for (const photo of album.photos) {
      if (photo.carPath && photo.carPath.toLowerCase().trim() === norm) {
        results.push(photo);
      }
    }
  }
  return results;
}

export function validatePhotoCarPath(photo: GalleryPhoto, expectedCarPath: string): boolean {
  if (!photo || !photo.carPath || !expectedCarPath) return false;
  return photo.carPath.toLowerCase().trim() === expectedCarPath.toLowerCase().trim();
}
