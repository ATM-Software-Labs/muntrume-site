export interface MediaVideo {
  title: string;
  channel: string;
  badge: string;
  tag: string;
  duration?: string;
  url: string;
  query: string;
  desc: string;
}

export function getTrackVideos(trackName: string, category: string = "Road"): MediaVideo[] {
  const enc = encodeURIComponent(`iRacing ${trackName}`);
  return [
    {
      title: `${trackName} · Guía Oficial de Trazado & Puntos de Frenada`,
      channel: "iRacing Oficial / Simracing Community",
      badge: "Guía Oficial",
      tag: "Track Guide",
      duration: "14:20",
      query: `iRacing official track guide ${trackName}`,
      url: `https://www.youtube.com/results?search_query=${enc}+official+track+guide`,
      desc: "Análisis curva a curva, referencias de frenada, velocidad de vértice y trazadas óptimas para clasificación y carrera.",
    },
    {
      title: `${trackName} · Hotlap de Clasificación con Telemetría`,
      channel: "Muntrume & Garage 61 Community",
      badge: "Telemetría 60Hz",
      tag: "Hotlap",
      duration: "02:15",
      query: `iRacing hotlap telemetry ${trackName}`,
      url: `https://www.youtube.com/results?search_query=${enc}+hotlap+telemetry`,
      desc: "Vuelta rápida a fondo con análisis de inputs de pedal, reparto de frenada y trazada de clasificación.",
    },
    {
      title: `${trackName} · Carrera Completa Multiclase & Tráfico`,
      channel: `iRacing ${category} Endurance Championship`,
      badge: "Resistencia",
      tag: `${category} Race`,
      duration: "45:00",
      query: `iRacing endurance race multiclass ${trackName}`,
      url: `https://www.youtube.com/results?search_query=${enc}+endurance+race+onboard`,
      desc: "Gestión de tráfico con doblados, ahorro de combustible y degradación de neumáticos en stint nocturno y mixto.",
    },
  ];
}

export function getCarVideos(brand: string, model: string, carClass: string): MediaVideo[] {
  const carName = `${brand} ${model}`;
  const enc = encodeURIComponent(`iRacing ${carName}`);
  return [
    {
      title: `${carName} · Showcase Oficial & Análisis Técnico`,
      channel: "iRacing Oficial",
      badge: "Showcase",
      tag: `${carClass} Oficial`,
      duration: "08:45",
      query: `iRacing ${carName} official showcase sound`,
      url: `https://www.youtube.com/results?search_query=${enc}+official+showcase`,
      desc: "Física de suspensión, paquete aerodinámico, mapa motor y acústica del propulsor grabada en pista.",
    },
    {
      title: `${carName} · Guía de Pilotaje, TC & Reparto de Frenada`,
      channel: "Simracing Engineering & Setup",
      badge: "Técnica",
      tag: "Driving Guide",
      duration: "18:30",
      query: `iRacing ${carName} driving guide setup tc abs`,
      url: `https://www.youtube.com/results?search_query=${enc}+driving+guide+setup+tips`,
      desc: "Configuración de mapas de ABS, control de tracción y balance de frenada para mantener ritmo constante sin degradación.",
    },
    {
      title: `${carName} · Onboard en Carrera Multiclase IMSA / WEC`,
      channel: "Muntrume Motorsport Highlights",
      badge: "Habitáculo",
      tag: "Cockpit Onboard",
      duration: "25:10",
      query: `iRacing ${carName} cockpit onboard race`,
      url: `https://www.youtube.com/results?search_query=${enc}+onboard+cockpit+race`,
      desc: "Sesión completa desde el habitáculo con avisos de spotter, radio de equipo y adelantamientos en carrera.",
    },
  ];
}
