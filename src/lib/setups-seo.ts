import { CAR_CATALOG_LIST, type CarMetadata } from "../../desktop/src/cars/catalog";
import rawTracks from "../data/iracing-tracks.json";

export interface TrackEntry {
  slug: string;
  name: string;
  thumb?: string;
  img?: string;
  history?: string;
}

const ICONIC_TRACK_SLUGS = new Set([
  "circuit-de-spa-francorchamps",
  "autodromo-nazionale-monza",
  "nurburgring-grand-prix-strecke",
  "nurburgring-nordschleife",
  "sebring-international-raceway",
  "daytona-international-speedway",
  "circuit-des-24-heures-du-mans",
  "watkins-glen-international",
  "suzuka-international-racing-course",
  "silverstone-circuit",
  "mount-panorama-circuit",
  "weathertech-raceway-at-laguna-seca",
  "road-america",
  "autodromo-enzo-e-dino-ferrari",
  "autodromo-jose-carlos-pace",
  "autodromo-internazionale-del-mugello",
  "circuit-de-barcelona-catalunya",
  "algarve-international-circuit",
  "fuji-international-speedway",
  "michelin-raceway-road-atlanta",
]);

export function slugifySetup(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCarSlug(car: CarMetadata): string {
  return slugifySetup(`${car.brand} ${car.model}`);
}

export function getProgrammaticSetupCars(): CarMetadata[] {
  const seen = new Set<string>();
  return CAR_CATALOG_LIST.filter((car) => {
    const slug = getCarSlug(car);
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

export function getTopRoadTracks(): TrackEntry[] {
  const tracks = rawTracks as TrackEntry[];
  const iconic = tracks.filter((t) => ICONIC_TRACK_SLUGS.has(t.slug));
  return iconic.length >= 10 ? iconic : tracks.slice(0, 20);
}

export function buildSetupRoutePairs(): Array<{ car: CarMetadata; carSlug: string; track: TrackEntry }> {
  const roadClasses = new Set(["GT3", "GTP", "LMP2", "GT4", "GTE", "Formula", "Prototype"]);
  const cars = getProgrammaticSetupCars().filter((c) => roadClasses.has(c.carClass)).slice(0, 28);
  const tracks = getTopRoadTracks();
  const pairs: Array<{ car: CarMetadata; carSlug: string; track: TrackEntry }> = [];
  for (const car of cars) {
    const carSlug = getCarSlug(car);
    for (const track of tracks) {
      pairs.push({ car, carSlug, track });
    }
  }
  return pairs;
}

export function getSetupTechSheet(car: CarMetadata, track: TrackEntry) {
  const name = track.name.toLowerCase();
  const highSpeed = name.includes("monza") || name.includes("mans") || name.includes("daytona") || name.includes("spa");
  const highDf = name.includes("hungar") || name.includes("zandvoort") || name.includes("barcelona") || name.includes("suzuka");

  const downforce = highSpeed
    ? "Baja / Media-Baja (prioridad velocidad punta en recta)"
    : highDf
      ? "Alta (máximo apoyo en curvas rápidas y chicanes)"
      : "Media equilibrada (compromiso estabilidad / tracción)";

  const fuelPerLap =
    car.carClass === "GTP" || car.carClass === "LMP2"
      ? "2.9 – 3.4 L / vuelta"
      : car.carClass === "GT3" || car.carClass === "GTE"
        ? "2.5 – 3.1 L / vuelta"
        : car.carClass === "Formula"
          ? "1.4 – 1.9 L / vuelta"
          : "1.8 – 2.3 L / vuelta";

  const coldPressure = car.carClass === "Formula" ? "138 kPa (20.0 PSI)" : "152 – 158 kPa (22.0 – 23.0 PSI)";
  const brakeBias = car.carClass === "GTP" ? "49.5% – 51.5%" : car.carClass === "GT3" ? "52.0% – 54.5%" : "55.0% – 57.0%";

  return {
    downforce,
    targetTrackTemp: "24 °C – 34 °C",
    fuelPerLap,
    coldPressure,
    brakeBias,
    variants: ["QUALY", "RACE", "SAFE", "WET"],
    sectors: [
      {
        sector: "Sector 1",
        tip: `Frenada inicial progresiva en ${track.name}: busca el 85–90% de presión y modula trail-braking hacia el vértice.`,
      },
      {
        sector: "Sector 2",
        tip: "Prioriza estabilidad del eje trasero en cambios de dirección medios; evita subir demasiado por pianos agresivos.",
      },
      {
        sector: "Sector 3",
        tip: "Aceleración temprana con volante recto hacia la recta principal para maximizar velocidad de salida.",
      },
    ],
  };
}
