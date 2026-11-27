export interface LibraryDecalItem {
  id: string;
  label: string;
  group: "team" | "series" | "brand";
  src: string;
  defaultScale?: number;
}

export const TEAM_DECALS: LibraryDecalItem[] = [
  { id: "mmt-escudo-vector", label: "Escudo MMT Oficial", group: "team", src: "/assets/skins/team/muntrume-escudo-vector.svg", defaultScale: 0.065 },
  { id: "mmt-wordmark-light", label: "Muntrume Blanco", group: "team", src: "/assets/skins/team/muntrume-wordmark-light.svg", defaultScale: 0.11 },
  { id: "mmt-wordmark-dark", label: "Muntrume Oscuro", group: "team", src: "/assets/skins/team/muntrume-wordmark-dark.svg", defaultScale: 0.11 },
  { id: "mmt-mono-white", label: "Monograma Blanco", group: "team", src: "/assets/skins/team/muntrume-mono-white.svg", defaultScale: 0.06 },
  { id: "mmt-monogram-mtm", label: "Monograma MTM", group: "team", src: "/assets/skins/team/muntrume-monogram-mtm.svg", defaultScale: 0.065 },
  { id: "mmt-telemetry-badge", label: "Badge Telemetría MMT", group: "team", src: "/assets/skins/team/muntrume-telemetry-badge.svg", defaultScale: 0.08 },
];

export const SERIES_DECALS: LibraryDecalItem[] = [
  { id: "series-imsa", label: "IMSA Endurance", group: "series", defaultScale: 0.075, src: "/assets/skins/series/imsa.jpg" },
  { id: "series-gt-sprint", label: "GT Sprint Series", group: "series", defaultScale: 0.075, src: "/assets/skins/series/gt-sprint.jpg" },
  { id: "series-porsche-cup", label: "Porsche Cup", group: "series", defaultScale: 0.075, src: "/assets/skins/series/porsche-cup.jpg" },
  { id: "series-pcc", label: "Production Car Challenge", group: "series", defaultScale: 0.075, src: "/assets/skins/series/pcc.jpg" },
  { id: "series-sfl", label: "Super Formula Lights", group: "series", defaultScale: 0.075, src: "/assets/skins/series/sfl.jpg" },
];

export const BRAND_DECALS: LibraryDecalItem[] = [
  { id: "brand-porsche", label: "Porsche", group: "brand", src: "/assets/brand/logos/logo-porsche.webp", defaultScale: 0.05 },
  { id: "brand-ferrari", label: "Ferrari", group: "brand", src: "/assets/brand/logos/logo-ferrari.svg", defaultScale: 0.05 },
  { id: "brand-lambo", label: "Lamborghini", group: "brand", src: "/assets/brand/logos/logo-lambo.svg", defaultScale: 0.05 },
  { id: "brand-bmw", label: "BMW", group: "brand", src: "/assets/brand/logos/logo-bmw.svg", defaultScale: 0.05 },
  { id: "brand-audi", label: "Audi", group: "brand", src: "/assets/brand/logos/logo-audi.svg", defaultScale: 0.065 },
  { id: "brand-mclaren", label: "McLaren", group: "brand", src: "/assets/brand/logos/logo-mclaren.svg", defaultScale: 0.07 },
  { id: "brand-ford", label: "Ford", group: "brand", src: "/assets/brand/logos/logo-ford.svg", defaultScale: 0.065 },
  { id: "brand-mercedes", label: "Mercedes-AMG", group: "brand", src: "/assets/brand/logos/logo-mercedes.svg", defaultScale: 0.05 },
  { id: "brand-aston", label: "Aston Martin", group: "brand", src: "/assets/brand/logos/logo-aston.svg", defaultScale: 0.075 },
  { id: "brand-acura", label: "Acura", group: "brand", src: "/assets/brand/logos/logo-acura.svg", defaultScale: 0.05 },
  { id: "brand-cadillac", label: "Cadillac", group: "brand", src: "/assets/brand/logos/logo-cadillac.svg", defaultScale: 0.065 },
  { id: "brand-chevy", label: "Chevrolet", group: "brand", src: "/assets/brand/logos/logo-chevy.svg", defaultScale: 0.065 },
  { id: "brand-dallara", label: "Dallara", group: "brand", src: "/assets/brand/logos/logo-dallara.svg", defaultScale: 0.065 },
  { id: "brand-toyota", label: "Toyota", group: "brand", src: "/assets/brand/logos/logo-toyota.svg", defaultScale: 0.06 },
  { id: "brand-honda", label: "Honda", group: "brand", src: "/assets/brand/logos/logo-honda.svg", defaultScale: 0.055 },
  { id: "brand-mazda", label: "Mazda", group: "brand", src: "/assets/brand/logos/logo-mazda.svg", defaultScale: 0.055 },
  { id: "brand-hyundai", label: "Hyundai", group: "brand", src: "/assets/brand/logos/logo-hyundai.svg", defaultScale: 0.06 },
  { id: "brand-kia", label: "Kia", group: "brand", src: "/assets/brand/logos/logo-kia.svg", defaultScale: 0.06 },
  { id: "brand-ligier", label: "Ligier", group: "brand", src: "/assets/brand/logos/logo-ligier.svg", defaultScale: 0.065 },
  { id: "brand-lotus", label: "Lotus", group: "brand", src: "/assets/brand/logos/logo-lotus.svg", defaultScale: 0.05 },
  { id: "brand-nissan", label: "Nissan", group: "brand", src: "/assets/brand/logos/logo-nissan.svg", defaultScale: 0.055 },
  { id: "brand-renault", label: "Renault", group: "brand", src: "/assets/brand/logos/logo-renault.svg", defaultScale: 0.05 },
  { id: "brand-subaru", label: "Subaru", group: "brand", src: "/assets/brand/logos/logo-subaru.webp", defaultScale: 0.06 },
  { id: "brand-vw", label: "Volkswagen", group: "brand", src: "/assets/brand/logos/logo-vw.svg", defaultScale: 0.05 },
  { id: "brand-williams", label: "Williams", group: "brand", src: "/assets/brand/logos/logo-williams.svg", defaultScale: 0.06 },
  { id: "brand-radical", label: "Radical", group: "brand", src: "/assets/brand/logos/logo-radical.webp", defaultScale: 0.065 },
  { id: "brand-ruf", label: "RUF", group: "brand", src: "/assets/brand/logos/logo-ruf.svg", defaultScale: 0.055 },
  { id: "brand-caterham", label: "Caterham", group: "brand", src: "/assets/brand/logos/logo-caterham.svg", defaultScale: 0.06 },
  { id: "brand-pontiac", label: "Pontiac", group: "brand", src: "/assets/brand/logos/logo-pontiac.svg", defaultScale: 0.055 },
  { id: "brand-buick", label: "Buick", group: "brand", src: "/assets/brand/logos/logo-buick.webp", defaultScale: 0.055 },
  { id: "brand-holden", label: "Holden", group: "brand", src: "/assets/brand/logos/logo-holden.webp", defaultScale: 0.055 },
  { id: "brand-ram", label: "RAM", group: "brand", src: "/assets/brand/logos/logo-ram.svg", defaultScale: 0.055 },
  { id: "brand-riley", label: "Riley", group: "brand", src: "/assets/brand/logos/logo-riley.webp", defaultScale: 0.06 },
  { id: "brand-skip", label: "Skip Barber", group: "brand", src: "/assets/brand/logos/logo-skip.svg", defaultScale: 0.06 },
];
