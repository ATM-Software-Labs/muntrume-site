export interface LibraryDecalItem {
  id: string;
  label: string;
  group: "team" | "series" | "brand";
  src: string;
  defaultScale?: number;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
  {
    id: "series-imsa",
    label: "IMSA Endurance",
    group: "series",
    defaultScale: 0.15,
    src: svgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90"><rect x="4" y="4" width="252" height="82" rx="10" fill="#0b111a" stroke="#e11d48" stroke-width="6"/><rect x="14" y="14" width="12" height="62" rx="3" fill="#e11d48"/><text x="142" y="54" text-anchor="middle" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="38" letter-spacing="4">IMSA</text><text x="142" y="75" text-anchor="middle" fill="#94a3b8" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="13" letter-spacing="3">ENDURANCE SERIES</text></svg>`,
    ),
  },
  {
    id: "series-gt-sprint",
    label: "GT Sprint Series",
    group: "series",
    defaultScale: 0.15,
    src: svgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90"><rect x="4" y="4" width="272" height="82" rx="10" fill="#0b111a" stroke="#00e699" stroke-width="6"/><text x="140" y="50" text-anchor="middle" fill="#00e699" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="32" letter-spacing="3">GT SPRINT</text><text x="140" y="73" text-anchor="middle" fill="#e2e8f0" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="13" letter-spacing="4">SIMRACING CHAMPIONSHIP</text></svg>`,
    ),
  },
  {
    id: "series-porsche-cup",
    label: "Porsche Cup",
    group: "series",
    defaultScale: 0.15,
    src: svgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 90"><rect x="4" y="4" width="272" height="82" rx="10" fill="#111827" stroke="#f59e0b" stroke-width="6"/><text x="140" y="48" text-anchor="middle" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="27" letter-spacing="3">PORSCHE CUP</text><text x="140" y="72" text-anchor="middle" fill="#f59e0b" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="14" letter-spacing="5">992 SERIES</text></svg>`,
    ),
  },
  {
    id: "series-pcc",
    label: "Production Car Challenge",
    group: "series",
    defaultScale: 0.15,
    src: svgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90"><rect x="4" y="4" width="252" height="82" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="6"/><text x="130" y="52" text-anchor="middle" fill="#38bdf8" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="38" letter-spacing="5">PCC</text><text x="130" y="74" text-anchor="middle" fill="#e2e8f0" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="12" letter-spacing="2">MULTICLASS CHALLENGE</text></svg>`,
    ),
  },
  {
    id: "series-sfl",
    label: "Super Formula Lights",
    group: "series",
    defaultScale: 0.15,
    src: svgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 90"><rect x="4" y="4" width="252" height="82" rx="10" fill="#090d16" stroke="#a855f7" stroke-width="6"/><text x="130" y="52" text-anchor="middle" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="36" letter-spacing="5">SFL 324</text><text x="130" y="74" text-anchor="middle" fill="#c084fc" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="12" letter-spacing="3">FORMULA SERIES</text></svg>`,
    ),
  },
  {
    id: "series-24h",
    label: "24H Special Event",
    group: "series",
    defaultScale: 0.14,
    src: svgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><rect x="4" y="4" width="232" height="82" rx="10" fill="#05130d" stroke="#00e699" stroke-width="6"/><text x="120" y="54" text-anchor="middle" fill="#00e699" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="40" letter-spacing="4">24H</text><text x="120" y="75" text-anchor="middle" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="12" letter-spacing="3">SPECIAL EVENT</text></svg>`,
    ),
  },
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
