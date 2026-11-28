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

// Clean IP policy: no unlicensed third-party commercial series or manufacturer logo packs are redistributed in the UI.
// External sponsors or brand logos are loaded locally by the user via "Subir logo propio (PNG / SVG transparente)".
export const SERIES_DECALS: LibraryDecalItem[] = [];

export const BRAND_DECALS: LibraryDecalItem[] = [];
