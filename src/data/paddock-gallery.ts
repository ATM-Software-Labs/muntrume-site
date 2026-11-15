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
    summary: "Render oficial de estudio iRacing · V6 Twin-Turbo GT3.",
    photos: [
      {
        id: "ferrari296gt3-studio",
        carPath: "ferrari296gt3",
        title: "Ferrari 296 GT3 · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/ferrari296gt3.webp",
        thumb: "/assets/cars/ferrari296gt3.webp",
        desc: "Modelo oficial iRacing del Ferrari 296 GT3 con paquete aerodinámico GT3.",
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
    summary: "Render oficial de estudio iRacing · Flat-6 4.2L GT3.",
    photos: [
      {
        id: "porsche992rgt3-studio",
        carPath: "porsche992rgt3",
        title: "Porsche 911 GT3 R (992) · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/porsche992rgt3.webp",
        thumb: "/assets/cars/porsche992rgt3.webp",
        desc: "Render oficial de estudio iRacing del Porsche 911 GT3 R (992) con alerón cuello de cisne.",
      },
    ],
  },
  {
    slug: "porsche9922cup",
    carPath: "porsche9922cup",
    title: "Porsche 911 Cup (992.2)",
    brand: "Porsche",
    carClass: "Cup",
    cover: "/assets/cars/porsche9922cup.webp",
    summary: "Render oficial de estudio iRacing · Copa monomarca sin ABS ni TC.",
    photos: [
      {
        id: "porsche9922cup-studio",
        carPath: "porsche9922cup",
        title: "Porsche 911 Cup (992.2) · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/porsche9922cup.webp",
        thumb: "/assets/cars/porsche9922cup.webp",
        desc: "Render de estudio oficial de iRacing para el Porsche 911 Cup (992.2).",
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
    summary: "Render oficial de estudio iRacing · 3.0L TwinPower Turbo GT3.",
    photos: [
      {
        id: "bmwm4gt3-studio",
        carPath: "bmwm4gt3",
        title: "BMW M4 GT3 · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/bmwm4gt3.webp",
        thumb: "/assets/cars/bmwm4gt3.webp",
        desc: "Fotografía técnica de estudio oficial del BMW M4 GT3 en iRacing.",
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
    summary: "Render oficial de estudio iRacing · V8 atmosférico 6.2L GT3.",
    photos: [
      {
        id: "mercedesamgevogt3-studio",
        carPath: "mercedesamgevogt3",
        title: "Mercedes-AMG GT3 Evo · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/mercedesamgevogt3.webp",
        thumb: "/assets/cars/mercedesamgevogt3.webp",
        desc: "Render de estudio oficial iRacing del Mercedes-AMG GT3 Evo.",
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
    summary: "Render oficial de estudio iRacing · Chasis monocasco de carbono GT3.",
    photos: [
      {
        id: "mclaren720sgt3-studio",
        carPath: "mclaren720sgt3",
        title: "McLaren 720S GT3 EVO · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/mclaren720sgt3.webp",
        thumb: "/assets/cars/mclaren720sgt3.webp",
        desc: "Render oficial de estudio iRacing del McLaren 720S GT3 EVO.",
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
    summary: "Render oficial de estudio iRacing · V12 atmosférico 6.5L Hypercar / GTP.",
    photos: [
      {
        id: "amvalkyriegtp-studio",
        carPath: "amvalkyriegtp",
        title: "Aston Martin Valkyrie GTP · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/amvalkyriegtp.webp",
        thumb: "/assets/cars/amvalkyriegtp.webp",
        desc: "Render de estudio oficial iRacing del Aston Martin Valkyrie GTP.",
      },
    ],
  },
  {
    slug: "porsche963gtp",
    carPath: "porsche963gtp",
    title: "Porsche 963 GTP",
    brand: "Porsche",
    carClass: "GTP",
    cover: "/assets/cars/porsche963gtp.webp",
    summary: "Render oficial de estudio iRacing · LMDh Híbrido V8 Twin-Turbo.",
    photos: [
      {
        id: "porsche963gtp-studio",
        carPath: "porsche963gtp",
        title: "Porsche 963 GTP · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/porsche963gtp.webp",
        thumb: "/assets/cars/porsche963gtp.webp",
        desc: "Render de estudio oficial iRacing del prototipo Porsche 963 GTP.",
      },
    ],
  },
  {
    slug: "ferrari499p",
    carPath: "ferrari499p",
    title: "Ferrari 499P",
    brand: "Ferrari",
    carClass: "GTP",
    cover: "/assets/cars/ferrari499p.webp",
    summary: "Render oficial de estudio iRacing · LMH Híbrido tracción total.",
    photos: [
      {
        id: "ferrari499p-studio",
        carPath: "ferrari499p",
        title: "Ferrari 499P · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/ferrari499p.webp",
        thumb: "/assets/cars/ferrari499p.webp",
        desc: "Render oficial de estudio iRacing del Ferrari 499P LMH.",
      },
    ],
  },
  {
    slug: "cadillacvseriesrgtp",
    carPath: "cadillacvseriesrgtp",
    title: "Cadillac V-Series.R GTP",
    brand: "Cadillac",
    carClass: "GTP",
    cover: "/assets/cars/cadillacvseriesrgtp.webp",
    summary: "Render oficial de estudio iRacing · V8 atmosférico 5.5L LMDh.",
    photos: [
      {
        id: "cadillacvseriesrgtp-studio",
        carPath: "cadillacvseriesrgtp",
        title: "Cadillac V-Series.R GTP · Render Oficial iRacing",
        subtitle: "Asset oficial escaneado por láser",
        tag: "Estudio iRacing",
        img: "/assets/cars/cadillacvseriesrgtp.webp",
        thumb: "/assets/cars/cadillacvseriesrgtp.webp",
        desc: "Render oficial de estudio iRacing del Cadillac V-Series.R GTP.",
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
