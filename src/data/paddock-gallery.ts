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
  readonly views?: number;
  readonly photos: readonly GalleryPhoto[];
}

export interface TrackGalleryPhoto {
  readonly id: string;
  readonly category: "gt3" | "gtp" | "cup" | "night";
  readonly badge: string;
  readonly title: string;
  readonly caption: string;
  readonly circuit: string;
  readonly img: string;
  readonly featured?: boolean;
}

export const TRACK_GALLERY_PHOTOS: readonly TrackGalleryPhoto[] = [
  {
    id: "gt3-monza-pack",
    category: "gt3",
    badge: "GT3 en pista",
    title: "Parrilla GT3 · Curva 1 Monza",
    caption: "Salida en pelotón oficial con Ferrari 296 GT3 #27 y gestión de rebufo en la chicane.",
    circuit: "Autodromo Nazionale Monza",
    img: "/assets/img/coche1.webp",
    featured: true,
  },
  {
    id: "gtp-night-sebring",
    category: "night",
    badge: "Prototipo GTP nocturno",
    title: "Stint nocturno · Porsche 963 GTP en Sebring",
    caption: "Rodando bajo luz artificial con discos de freno al rojo tras 8 horas de resistencia.",
    circuit: "Sebring International Raceway",
    img: "/assets/img/race1.webp",
    featured: true,
  },
  {
    id: "paddock-telemetry-pit",
    category: "gt3",
    badge: "Paddock / Telemetría",
    title: "Puesto de ingeniería · Telemetría 60 Hz",
    caption: "Comparativa de frenada, trazada y carga aerodinámica en el muro de Muntrume Motorsport.",
    circuit: "Circuit de Spa-Francorchamps",
    img: "/assets/img/hero-bg.webp",
    featured: true,
  },
  {
    id: "gt3-spa-raidillon",
    category: "gt3",
    badge: "GT3",
    title: "En paralelo por Eau Rouge · Ferrari 296 GT3",
    caption: "Compresión vertical a fondo en Raidillon durante el stint central de las 24h.",
    circuit: "Circuit de Spa-Francorchamps",
    img: "/assets/img/coche2.webp",
  },
  {
    id: "gtp-lemans-dusk",
    category: "gtp",
    badge: "GTP",
    title: "Batalla GTP en Mulsanne · Ferrari 499P",
    caption: "Tráfico multiclase superando GT3 al atardecer en la recta de Les Hunaudières.",
    circuit: "Circuit des 24 Heures du Mans",
    img: "/assets/img/series/imsa.jpg",
  },
  {
    id: "gt3-sprint-grid",
    category: "gt3",
    badge: "GT3",
    title: "GT Sprint · Porsche 911 GT3 R (992)",
    caption: "Ataque al vértice sobre los pianos interiores en tanda de clasificación.",
    circuit: "Watkins Glen International",
    img: "/assets/img/series/gt-sprint.jpg",
  },
  {
    id: "night-daytona-infield",
    category: "night",
    badge: "Noche / Resistencia",
    title: "Madrugada en Daytona · Stint de relevo",
    caption: "Temperatura de asfalto en descenso y cambio de mapa de tracción en la salida del peralte.",
    circuit: "Daytona International Speedway",
    img: "/assets/img/coche3.webp",
  },
  {
    id: "gtp-cadillac-imola",
    category: "gtp",
    badge: "GTP",
    title: "Cadillac V-Series.R · Curva Tamburello",
    caption: "Apoyo aerodinámico al límite en la primera variante de Imola.",
    circuit: "Autodromo Enzo e Dino Ferrari",
    img: "/assets/img/coche4.webp",
  },
  {
    id: "night-cup-endurance",
    category: "cup",
    badge: "Cup",
    title: "Porsche Cup · Doble stint en carrera",
    caption: "Frenada sin ABS ni control de tracción bajo los focos de boxes.",
    circuit: "Nürburgring GP-Strecke",
    img: "/assets/img/series/porsche-cup.jpg",
  },
];

export const PADDOCK_ALBUMS: readonly GalleryAlbum[] = [
  {
    slug: "ferrari296gt3",
    carPath: "ferrari296gt3",
    title: "Ferrari 296 GT3",
    brand: "Ferrari",
    carClass: "GT3",
    cover: "/assets/img/coche1.webp",
    summary: "Programa oficial GT3 Sprint & Endurance · V6 Twin-Turbo.",
    views: 1420,
    photos: [
      {
        id: "ferrari296gt3-track",
        carPath: "ferrari296gt3",
        title: "Ferrari 296 GT3 #27 · En pista",
        subtitle: "Muntrume Motorsport · GT3",
        tag: "Pista",
        img: "/assets/img/coche1.webp",
        thumb: "/assets/img/coche1.webp",
        desc: "Captura en pista del Ferrari 296 GT3 con la librea oficial de Muntrume Motorsport.",
      },
    ],
  },
  {
    slug: "porsche992rgt3",
    carPath: "porsche992rgt3",
    title: "Porsche 911 GT3 R (992)",
    brand: "Porsche",
    carClass: "GT3",
    cover: "/assets/img/series/gt-sprint.jpg",
    summary: "Programa GT3 · Flat-6 4.2L en pista.",
    views: 1180,
    photos: [
      {
        id: "porsche992rgt3-track",
        carPath: "porsche992rgt3",
        title: "Porsche 911 GT3 R (992) · GT Sprint",
        subtitle: "Muntrume Motorsport · GT3",
        tag: "Pista",
        img: "/assets/img/series/gt-sprint.jpg",
        thumb: "/assets/img/series/gt-sprint.jpg",
        desc: "Porsche 911 GT3 R (992) atacando los pianos en sesión oficial.",
      },
    ],
  },
  {
    slug: "porsche9922cup",
    carPath: "porsche9922cup",
    title: "Porsche 911 Cup (992.2)",
    brand: "Porsche",
    carClass: "Cup",
    cover: "/assets/img/series/porsche-cup.jpg",
    summary: "Copa monomarca sin ABS ni TC · Frenada pura.",
    photos: [
      {
        id: "porsche9922cup-track",
        carPath: "porsche9922cup",
        title: "Porsche 911 Cup (992.2) · Carrera",
        subtitle: "Muntrume Motorsport · Cup",
        tag: "Pista",
        img: "/assets/img/series/porsche-cup.jpg",
        thumb: "/assets/img/series/porsche-cup.jpg",
        desc: "Porsche 911 Cup en pelotón oficial sin ayudas electrónicas.",
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
    summary: "Programa Resistencia GT3 · 3.0L TwinPower Turbo.",
    photos: [
      {
        id: "bmwm4gt3-track",
        carPath: "bmwm4gt3",
        title: "BMW M4 GT3 · Resistencia",
        subtitle: "Muntrume Motorsport · GT3",
        tag: "GT3",
        img: "/assets/cars/bmwm4gt3.webp",
        thumb: "/assets/cars/bmwm4gt3.webp",
        desc: "BMW M4 GT3 configurado para stints largos de resistencia.",
      },
    ],
  },
  {
    slug: "mercedesamgevogt3",
    carPath: "mercedesamgevogt3",
    title: "Mercedes-AMG GT3 Evo",
    brand: "Mercedes-AMG",
    carClass: "GT3",
    cover: "/assets/cars/mercedesamgevogt3.webp",
    summary: "Programa GT3 · V8 atmosférico 6.2L.",
    photos: [
      {
        id: "mercedesamgevogt3-track",
        carPath: "mercedesamgevogt3",
        title: "Mercedes-AMG GT3 Evo · Competición",
        subtitle: "Muntrume Motorsport · GT3",
        tag: "GT3",
        img: "/assets/cars/mercedesamgevogt3.webp",
        thumb: "/assets/cars/mercedesamgevogt3.webp",
        desc: "Mercedes-AMG GT3 Evo preparado para circuitos de alta velocidad.",
      },
    ],
  },
  {
    slug: "mclaren720sgt3",
    carPath: "mclaren720sgt3",
    title: "McLaren 720S GT3 EVO",
    brand: "McLaren",
    carClass: "GT3",
    cover: "/assets/cars/mclaren720sgt3.webp",
    summary: "Programa GT3 · Chasis monocasco de carbono.",
    photos: [
      {
        id: "mclaren720sgt3-track",
        carPath: "mclaren720sgt3",
        title: "McLaren 720S GT3 EVO · Pista",
        subtitle: "Muntrume Motorsport · GT3",
        tag: "GT3",
        img: "/assets/cars/mclaren720sgt3.webp",
        thumb: "/assets/cars/mclaren720sgt3.webp",
        desc: "McLaren 720S GT3 EVO con carga aerodinámica de circuito técnico.",
      },
    ],
  },
  {
    slug: "amvalkyriegtp",
    carPath: "amvalkyriegtp",
    title: "Aston Martin Valkyrie GTP",
    brand: "Aston Martin",
    carClass: "GTP",
    cover: "/assets/cars/amvalkyriegtp.webp",
    summary: "Programa IMSA / Hypercar · V12 atmosférico 6.5L.",
    photos: [
      {
        id: "amvalkyriegtp-track",
        carPath: "amvalkyriegtp",
        title: "Aston Martin Valkyrie GTP · Hypercar",
        subtitle: "Muntrume Motorsport · GTP",
        tag: "GTP",
        img: "/assets/cars/amvalkyriegtp.webp",
        thumb: "/assets/cars/amvalkyriegtp.webp",
        desc: "Aston Martin Valkyrie GTP en configuración de alta carga.",
      },
    ],
  },
  {
    slug: "porsche963gtp",
    carPath: "porsche963gtp",
    title: "Porsche 963 GTP",
    brand: "Porsche",
    carClass: "GTP",
    cover: "/assets/img/race1.webp",
    summary: "Programa IMSA Endurance · LMDh Híbrido V8 Twin-Turbo.",
    views: 1290,
    photos: [
      {
        id: "porsche963gtp-track",
        carPath: "porsche963gtp",
        title: "Porsche 963 GTP · Stint nocturno",
        subtitle: "Muntrume Motorsport · GTP",
        tag: "Resistencia",
        img: "/assets/img/race1.webp",
        thumb: "/assets/img/race1.webp",
        desc: "Porsche 963 GTP en pleno stint nocturno de resistencia.",
      },
    ],
  },
  {
    slug: "ferrari499p",
    carPath: "ferrari499p",
    title: "Ferrari 499P",
    brand: "Ferrari",
    carClass: "GTP",
    cover: "/assets/img/series/imsa.jpg",
    summary: "Programa IMSA / Le Mans · LMH Híbrido tracción total.",
    photos: [
      {
        id: "ferrari499p-track",
        carPath: "ferrari499p",
        title: "Ferrari 499P · IMSA Multiclase",
        subtitle: "Muntrume Motorsport · GTP",
        tag: "GTP",
        img: "/assets/img/series/imsa.jpg",
        thumb: "/assets/img/series/imsa.jpg",
        desc: "Ferrari 499P gestionando tráfico multiclase en pista.",
      },
    ],
  },
  {
    slug: "cadillacvseriesrgtp",
    carPath: "cadillacvseriesrgtp",
    title: "Cadillac V-Series.R GTP",
    brand: "Cadillac",
    carClass: "GTP",
    cover: "/assets/img/coche4.webp",
    summary: "Programa IMSA · V8 atmosférico 5.5L LMDh.",
    photos: [
      {
        id: "cadillacvseriesrgtp-track",
        carPath: "cadillacvseriesrgtp",
        title: "Cadillac V-Series.R GTP · En pista",
        subtitle: "Muntrume Motorsport · GTP",
        tag: "GTP",
        img: "/assets/img/coche4.webp",
        thumb: "/assets/img/coche4.webp",
        desc: "Cadillac V-Series.R GTP en plena trazada de carrera.",
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
