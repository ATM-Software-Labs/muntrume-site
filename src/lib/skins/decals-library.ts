export interface LibraryDecalItem {
  id: string;
  label: string;
  group: "team" | "series" | "brand";
  src: string;
  defaultScale?: number;
}

export const TEAM_DECALS: LibraryDecalItem[] = [
  { id: "mmt-escudo-vector", label: "Escudo MMT Oficial", group: "team", src: "/assets/skins/team/muntrume-escudo-vector.svg", defaultScale: 0.14 },
  { id: "mmt-wordmark-light", label: "Muntrume Blanco", group: "team", src: "/assets/skins/team/muntrume-wordmark-light.svg", defaultScale: 0.24 },
  { id: "mmt-wordmark-dark", label: "Muntrume Oscuro", group: "team", src: "/assets/skins/team/muntrume-wordmark-dark.svg", defaultScale: 0.24 },
  { id: "mmt-mono-white", label: "Monograma Blanco", group: "team", src: "/assets/skins/team/muntrume-mono-white.svg", defaultScale: 0.13 },
  { id: "mmt-monogram-mtm", label: "Monograma MTM", group: "team", src: "/assets/skins/team/muntrume-monogram-mtm.svg", defaultScale: 0.14 },
  { id: "mmt-telemetry-badge", label: "Badge Telemetría MMT", group: "team", src: "/assets/skins/team/muntrume-telemetry-badge.svg", defaultScale: 0.16 },
];

export const SERIES_DECALS: LibraryDecalItem[] = [
  { id: "series-imsa", label: "IMSA Endurance", group: "series", defaultScale: 0.15, src: "/assets/skins/series/imsa.jpg" },
  { id: "series-gt-sprint", label: "GT Sprint Series", group: "series", defaultScale: 0.15, src: "/assets/skins/series/gt-sprint.jpg" },
  { id: "series-porsche-cup", label: "Porsche Cup", group: "series", defaultScale: 0.15, src: "/assets/skins/series/porsche-cup.jpg" },
  { id: "series-pcc", label: "Production Car Challenge", group: "series", defaultScale: 0.15, src: "/assets/skins/series/pcc.jpg" },
  { id: "series-sfl", label: "Super Formula Lights", group: "series", defaultScale: 0.15, src: "/assets/skins/series/sfl.jpg" },
];

export const BRAND_DECALS: LibraryDecalItem[] = [
  { id: "brand-porsche", label: "Porsche", group: "brand", src: "/assets/brand/logos/logo-porsche.svg", defaultScale: 0.10 },
  { id: "brand-ferrari", label: "Ferrari", group: "brand", src: "/assets/brand/logos/logo-ferrari.svg", defaultScale: 0.10 },
  { id: "brand-lambo", label: "Lamborghini", group: "brand", src: "/assets/brand/logos/logo-lambo.svg", defaultScale: 0.10 },
  { id: "brand-bmw", label: "BMW", group: "brand", src: "/assets/brand/logos/logo-bmw.svg", defaultScale: 0.10 },
  { id: "brand-audi", label: "Audi", group: "brand", src: "/assets/brand/logos/logo-audi.svg", defaultScale: 0.13 },
  { id: "brand-mclaren", label: "McLaren", group: "brand", src: "/assets/brand/logos/logo-mclaren.svg", defaultScale: 0.14 },
  { id: "brand-ford", label: "Ford", group: "brand", src: "/assets/brand/logos/logo-ford.svg", defaultScale: 0.13 },
  { id: "brand-mercedes", label: "Mercedes-AMG", group: "brand", src: "/assets/brand/logos/logo-mercedes.svg", defaultScale: 0.10 },
  { id: "brand-aston", label: "Aston Martin", group: "brand", src: "/assets/brand/logos/logo-aston.svg", defaultScale: 0.15 },
  { id: "brand-acura", label: "Acura", group: "brand", src: "/assets/brand/logos/logo-acura.svg", defaultScale: 0.10 },
  { id: "brand-cadillac", label: "Cadillac", group: "brand", src: "/assets/brand/logos/logo-cadillac.svg", defaultScale: 0.13 },
  { id: "brand-chevy", label: "Chevrolet", group: "brand", src: "/assets/brand/logos/logo-chevy.svg", defaultScale: 0.13 },
  { id: "brand-dallara", label: "Dallara", group: "brand", src: "/assets/brand/logos/logo-dallara.svg", defaultScale: 0.13 },
  { id: "brand-toyota", label: "Toyota", group: "brand", src: "/assets/brand/logos/logo-toyota.svg", defaultScale: 0.12 },
  { id: "brand-honda", label: "Honda", group: "brand", src: "/assets/brand/logos/logo-honda.svg", defaultScale: 0.11 },
  { id: "brand-mazda", label: "Mazda", group: "brand", src: "/assets/brand/logos/logo-mazda.svg", defaultScale: 0.11 },
  { id: "brand-hyundai", label: "Hyundai", group: "brand", src: "/assets/brand/logos/logo-hyundai.svg", defaultScale: 0.12 },
];
