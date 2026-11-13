export interface GalleryPhoto {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly tag: string;
  readonly img: string;
  readonly thumb: string;
  readonly desc: string;
}

export interface GalleryAlbum {
  readonly slug: string;
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
    title: "Ferrari 296 GT3",
    brand: "Ferrari",
    carClass: "GT3",
    cover: "/assets/img/coche1-640.webp",
    summary: "Librea oficial Muntrume Motorsport, stints nocturnos y apoyo aerodinámico en curva rápida.",
    photos: [
      {
        id: "g1",
        title: "Ferrari 296 GT3 #27",
        subtitle: "Librea de Muntrume Motorsport · iRacing",
        tag: "GT3 Oficial",
        img: "/assets/img/coche1.webp",
        thumb: "/assets/img/coche1-640.webp",
        desc: "Captura en pista del Ferrari 296 GT3 con librea corporativa verde esmeralda y patrocinadores oficiales en iRacing.",
      },
      {
        id: "g2",
        title: "Pelotón GT3 en Carrera",
        subtitle: "Series de Resistencia Multiclase",
        tag: "Carrera",
        img: "/assets/img/coche2.webp",
        thumb: "/assets/img/coche2-640.webp",
        desc: "Lucha en pelotón cerrado negociando la entrada a curva peraltada durante una prueba oficial de resistencia.",
      },
      {
        id: "g4",
        title: "Stint Nocturno con Ópticas LED",
        subtitle: "Transición al Anochecer",
        tag: "Nocturna",
        img: "/assets/img/coche3.webp",
        thumb: "/assets/img/coche3-640.webp",
        desc: "Competición con iluminación artificial en pista y gestión de temperatura de neumáticos con caída térmica.",
      },
      {
        id: "g5",
        title: "Apoyo Aerodinámico en Vértice",
        subtitle: "Paso por Curva Rápida",
        tag: "GT3",
        img: "/assets/img/coche4.webp",
        thumb: "/assets/img/coche4-640.webp",
        desc: "Alineación de caída y convergencia trabajando en máxima carga lateral sobre el piano de salida.",
      },
    ],
  },
  {
    slug: "gt3-endurance",
    title: "GT3 Endurance & Parrilla",
    brand: "Multiclase",
    carClass: "Endurance",
    cover: "/assets/img/race1-640.webp",
    summary: "Gestión de tráfico multiclase, salidas oficiales y frenadas en grupo.",
    photos: [
      {
        id: "g3",
        title: "Tráfico y Frenada en Grupo",
        subtitle: "Gestión de Carrera y Doblados",
        tag: "Pista",
        img: "/assets/img/race1.webp",
        thumb: "/assets/img/race1-640.webp",
        desc: "Frenada sincronizada con luces de cruce encendidas y gestión de adelantamientos entre diferentes clases de vehículos.",
      },
      {
        id: "g6",
        title: "Parrilla de Salida al Ocaso",
        subtitle: "Alineación Oficial de Escuderías",
        tag: "Parrilla",
        img: "/assets/img/hero-bg.webp",
        thumb: "/assets/img/hero-bg-640.webp",
        desc: "Momento previo a la bandera verde con los vehículos en formación de parrilla para la prueba de resistencia.",
      },
    ],
  },
  {
    slug: "pit-wall-tech",
    title: "Pit Wall & Telemetría",
    brand: "Muntrume Tech",
    carClass: "Ingeniería",
    cover: "/assets/img/og-team.jpg",
    summary: "Estación de datos Garage 61 a 60 Hz, Setup Vault e identidad de equipo.",
    photos: [
      {
        id: "g7",
        title: "Puesto de Control de Telemetría",
        subtitle: "Monitorización Garage 61 en Directo",
        tag: "Telemetría",
        img: "/assets/img/og-team.jpg",
        thumb: "/assets/img/og-team.jpg",
        desc: "Estación de análisis de datos a 60 Hz con curvas de aceleración, presión de freno y deltas de tiempo por sector.",
      },
      {
        id: "g8",
        title: "Identidad Corporativa 2026",
        subtitle: "Identidad visual de Muntrume Motorsport",
        tag: "Escudería",
        img: "/assets/img/og-cover.jpg",
        thumb: "/assets/img/og-cover.jpg",
        desc: "Diseño institucional del equipo combinando el verde neón (#00E699), gris carbón y tipografía deportiva.",
      },
      {
        id: "g9",
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
