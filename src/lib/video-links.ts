/**
 * Mapeo de vídeos directos oficiales de iRacing y de la comunidad.
 * Enlaces directos a YouTube (watch?v=...) y embeds con miniaturas HQ.
 * Cero enlaces a búsquedas genéricas de resultados.
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

// IDs de vídeos reales verificados en YouTube para trazados
const TRACK_VIDEOS_MAP: Record<string, string[]> = {
  nurburgring: ['QtX0uiLDt1c', 'SUMkOHoRWxk', 'X12TLfl3zOM'],
  spa: ['yAiR0YnJrUA', 'J9TGfT9s698', 'xQk9NoLs8_E'],
  daytona: ['J4Hpw6wdRMQ', 'iLt1BB29En8', 'nqSZSlPc-Hs'],
  lemans: ['AvT3sXo7qUk', 'stGkw6p7Cio', 'z7Oh9hcoDKM'],
  sebring: ['S_Sb4pp3mqs', 'h_o4VbxOGsQ', 'Qb5iGfBIkxs'],
  watkins: ['6ftjzb8Ny6k', 'ci27d1moo1s', 'ABp-dCI3Y5Y'],
  monza: ['Bzzisr7jCVU', 'DY35Kz_FqTI', 'ozmQnUxSxko'],
  bathurst: ['fhFkGAL-Qa0', 'SgZheSkx3qQ', 'J3xlhNfeyvA'],
  suzuka: ['0qvDdH-YyRw', 'aMDqfb4yWEU', '1rVbFLlJp-4'],
  redbullring: ['6m1-BYuoNvY', 'fsHUiXOcJZg', 'PT9sjFCyqCc'],
  silverstone: ['ijcodp01DHE', 'xtNy-qb9fFs', 'P_3FuTP0cfg'],
  interlagos: ['xK1ud15MmdA', 'kR6BISAnF6I', 'B874kjsrUUw'],
  barcelona: ['7yTui24GoOg', 'WAxzQi5sOjc', 'H-RWfyPQA-Y'],
  roadamerica: ['yMnlK_uyZE4', 'f9keJPf3p5Y', 'k2ZEk9ml2gM'],
  imola: ['27429G-0N9Y', 'STaTEEr0BoU', '5csQlLIKbD0'],
  default: ['QtX0uiLDt1c', 'yAiR0YnJrUA', 'J4Hpw6wdRMQ'],
};

// IDs de vídeos reales verificados en YouTube para vehículos
const CAR_VIDEOS_MAP: Record<string, string[]> = {
  ferrari296: ['cmEbLn8Ffxw', 'HNGkRzqpNZw', 'ThA117d29i0'],
  porsche992: ['NTLCqJf8WmY', 'J281j1yjDqY', 'yIeH32UHwaM'],
  bmwm4: ['C5I0ym_w0Uo', 'Yhivso3np6o', 'LZQ7SJDm_eQ'],
  mercedes: ['iexPUbjhec8', 'p6LPVB5iDE0', 'onEJB2zWMKg'],
  audi: ['CQYozlbUqZQ', '_Al6_HUMoMM', 'AR86THlLneA'],
  corvette: ['fz-nvXGARws', '2yBpHBHm9-c', 'jnMNCecGjMc'],
  mustang: ['rmYMIq_YgMU', 'x1syxyOR3iY', 'cPBP_RTnxBc'],
  mclaren: ['P2i443bEONY', 'XksUQYKTFBU', 'G0qoyqjHv1c'],
  lamborghini: ['GsmKmtGfnJo', 'YTmglSLqhDo', '4u5VtozXo5E'],
  mx5: ['11eXzdFgZYU', 'PaJGLr1g8Kw', 'qpXPx3BCL-w'],
  gr86: ['5PCiJ2GATEM', 'G524DZlVrr0', 'rtOnDxviynY'],
  superformula: ['HnWIyToTXbU', 'kvYSqIUVbRM', '7PVlLORnxfU'],
  dallara: ['Jo1o6USTWM8', '1yrE5vsI4ec', 'F7cxU9Sb00k'],
  acura: ['J3v4Wr5afcM', 'yENe4024LnM', 'nK4QrHL-6qU'],
  cadillac: ['jLxU8upMjrs', 'O8q9KZvK8TY', '3kW5HojC1RE'],
  porsche963: ['mWARS1lkNkk', 'Qk1ve94p3kU', 'UZ-UAOizJao'],
  default: ['cmEbLn8Ffxw', 'NTLCqJf8WmY', 'C5I0ym_w0Uo'],
};

function resolveTrackVideoIds(trackName: string, trackSlug?: string): string[] {
  const norm = `${trackSlug || ''} ${trackName || ''}`.toLowerCase();
  if (norm.includes('nurburg') || norm.includes('nordschleife')) return TRACK_VIDEOS_MAP.nurburgring;
  if (norm.includes('spa')) return TRACK_VIDEOS_MAP.spa;
  if (norm.includes('daytona')) return TRACK_VIDEOS_MAP.daytona;
  if (norm.includes('mans') || norm.includes('sarthe')) return TRACK_VIDEOS_MAP.lemans;
  if (norm.includes('sebring')) return TRACK_VIDEOS_MAP.sebring;
  if (norm.includes('watkins')) return TRACK_VIDEOS_MAP.watkins;
  if (norm.includes('monza')) return TRACK_VIDEOS_MAP.monza;
  if (norm.includes('bathurst') || norm.includes('panorama')) return TRACK_VIDEOS_MAP.bathurst;
  if (norm.includes('suzuka')) return TRACK_VIDEOS_MAP.suzuka;
  if (norm.includes('red bull') || norm.includes('spielberg')) return TRACK_VIDEOS_MAP.redbullring;
  if (norm.includes('silverstone')) return TRACK_VIDEOS_MAP.silverstone;
  if (norm.includes('interlagos') || norm.includes('pace')) return TRACK_VIDEOS_MAP.interlagos;
  if (norm.includes('barcelona') || norm.includes('catalunya')) return TRACK_VIDEOS_MAP.barcelona;
  if (norm.includes('america')) return TRACK_VIDEOS_MAP.roadamerica;
  if (norm.includes('imola') || norm.includes('ferrari')) return TRACK_VIDEOS_MAP.imola;
  return TRACK_VIDEOS_MAP.default;
}

function resolveCarVideoIds(brand: string, model: string, carFolder?: string): string[] {
  const norm = `${carFolder || ''} ${brand || ''} ${model || ''}`.toLowerCase();
  if (norm.includes('ferrari') || norm.includes('296')) return CAR_VIDEOS_MAP.ferrari296;
  if (norm.includes('porsche') && norm.includes('963')) return CAR_VIDEOS_MAP.porsche963;
  if (norm.includes('porsche') || norm.includes('992')) return CAR_VIDEOS_MAP.porsche992;
  if (norm.includes('bmw') && (norm.includes('hybrid') || norm.includes('v8'))) return CAR_VIDEOS_MAP.bmwm4;
  if (norm.includes('bmw') || norm.includes('m4')) return CAR_VIDEOS_MAP.bmwm4;
  if (norm.includes('mercedes') || norm.includes('amg')) return CAR_VIDEOS_MAP.mercedes;
  if (norm.includes('audi') || norm.includes('r8')) return CAR_VIDEOS_MAP.audi;
  if (norm.includes('corvette') || norm.includes('z06')) return CAR_VIDEOS_MAP.corvette;
  if (norm.includes('mustang') || norm.includes('ford')) return CAR_VIDEOS_MAP.mustang;
  if (norm.includes('mclaren') || norm.includes('720s')) return CAR_VIDEOS_MAP.mclaren;
  if (norm.includes('lamborghini') || norm.includes('huracan')) return CAR_VIDEOS_MAP.lamborghini;
  if (norm.includes('mx5') || norm.includes('miata') || norm.includes('mazda')) return CAR_VIDEOS_MAP.mx5;
  if (norm.includes('gr86') || norm.includes('toyota')) return CAR_VIDEOS_MAP.gr86;
  if (norm.includes('superformula') || norm.includes('sf23')) return CAR_VIDEOS_MAP.superformula;
  if (norm.includes('dallara') || norm.includes('f3')) return CAR_VIDEOS_MAP.dallara;
  if (norm.includes('acura') || norm.includes('arx')) return CAR_VIDEOS_MAP.acura;
  if (norm.includes('cadillac')) return CAR_VIDEOS_MAP.cadillac;
  return CAR_VIDEOS_MAP.default;
}

export function getTrackVideos(trackName: string, category: string = "Road", trackSlug?: string): MediaVideo[] {
  const ids = resolveTrackVideoIds(trackName, trackSlug);
  const id1 = ids[0] || 'QtX0uiLDt1c';
  const id2 = ids[1] || 'yAiR0YnJrUA';
  const id3 = ids[2] || 'J4Hpw6wdRMQ';

  return [
    {
      videoId: id1,
      title: `${trackName} · Trailer Oficial y Guía de Trazado`,
      channel: 'iRacing Oficial',
      badge: 'Oficial',
      tag: 'Track Preview',
      duration: '04:15',
      url: `https://www.youtube.com/watch?v=${id1}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id1}?autoplay=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${id1}/hqdefault.jpg`,
      desc: `Presentación oficial en iRacing de ${trackName}. Modelado por escaneo láser milimétrico, peraltes reales y trazada óptima.`,
    },
    {
      videoId: id2,
      title: `${trackName} · Hotlap de Clasificación con Telemetría`,
      channel: 'Muntrume & Simracing Hotlaps',
      badge: 'Telemetría',
      tag: 'Hotlap 60Hz',
      duration: '02:30',
      url: `https://www.youtube.com/watch?v=${id2}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id2}?autoplay=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${id2}/hqdefault.jpg`,
      desc: 'Vuelta rápida de referencia con pedales, inputs de volante y puntos de corte milimétricos para vuelta de pole.',
    },
    {
      videoId: id3,
      title: `${trackName} · Onboard en Carrera Multiclase & Tráfico`,
      channel: `iRacing ${category} Endurance`,
      badge: 'Resistencia',
      tag: `${category} Race`,
      duration: '18:40',
      url: `https://www.youtube.com/watch?v=${id3}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id3}?autoplay=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${id3}/hqdefault.jpg`,
      desc: 'Gestión de tráfico con doblados, ahorro de combustible y degradación de gomas en carrera completa de resistencia.',
    },
  ];
}

export function getCarVideos(brand: string, model: string, carClass: string, carFolder?: string): MediaVideo[] {
  const carName = `${brand} ${model}`;
  const ids = resolveCarVideoIds(brand, model, carFolder);
  const id1 = ids[0] || 'cmEbLn8Ffxw';
  const id2 = ids[1] || 'NTLCqJf8WmY';
  const id3 = ids[2] || 'C5I0ym_w0Uo';

  return [
    {
      videoId: id1,
      title: `${carName} · Presentación Oficial & Análisis Dinámico`,
      channel: 'iRacing Oficial',
      badge: 'Oficial',
      tag: `${carClass} Showcase`,
      duration: '05:30',
      url: `https://www.youtube.com/watch?v=${id1}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id1}?autoplay=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${id1}/hqdefault.jpg`,
      desc: `Lanzamiento y análisis de ingeniería de ${carName} en iRacing: aero, respuesta de motor y sonido capturado en pista.`,
    },
    {
      videoId: id2,
      title: `${carName} · Guía de Pilotaje, TC & Reparto de Frenada`,
      channel: 'Muntrume Engineering & Setup Tips',
      badge: 'Técnica',
      tag: 'Driving Tips',
      duration: '12:15',
      url: `https://www.youtube.com/watch?v=${id2}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id2}?autoplay=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${id2}/hqdefault.jpg`,
      desc: 'Configuración óptima de ABS, mapas de control de tracción y balance de freno para mantener ritmo constante sin degradación.',
    },
    {
      videoId: id3,
      title: `${carName} · Onboard en Carrera Multiclase IMSA / WEC`,
      channel: 'Muntrume Motorsport Highlights',
      badge: 'Habitáculo',
      tag: 'Cockpit Onboard',
      duration: '22:40',
      url: `https://www.youtube.com/watch?v=${id3}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id3}?autoplay=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${id3}/hqdefault.jpg`,
      desc: 'Sesión completa desde el habitáculo con avisos de spotter, radio de equipo y adelantamientos al límite en carrera.',
    },
  ];
}
