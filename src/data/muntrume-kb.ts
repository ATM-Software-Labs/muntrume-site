/**
 * Base verificada de Muntrume AI.
 * Solo incluye los hechos confirmados para el asistente. No añadir correos,
 * dorsales, cifras o resultados que no estén en esta lista.
 */

export interface KbDriver {
  dorsal: "#16" | "#1" | "#22";
  name: string;
  email: string | null;
}

export interface KbPage {
  name: string;
  url: string;
}

export const MUNTRUME_KB = {
  repo: "https://github.com/ATM-Software-Labs/muntrume-site",
  license: "MIT",
  drivers: [
    { dorsal: "#16", name: "Alberto Trujillo", email: "alberto@muntru.me" },
    { dorsal: "#1", name: "Mateo Berbis", email: "mateo@muntru.me" },
    { dorsal: "#22", name: "Eduardo", email: null },
  ] satisfies KbDriver[],
  contacts: {
    administration: "admin@muntru.me",
    press: "admin@muntru.me",
    legal: "legal@muntru.me",
    legalPage: "/contact/",
  },
  ecosystem: [
    {
      name: "MMT Sync Overlay",
      license: "MIT",
      summary: "Menos de 80 MB de RAM, 60 FPS y captura automática de IRSDK.",
      pages: [
        { name: "Overlay", url: "/overlay/" },
        { name: "App", url: "/app/" },
      ] satisfies KbPage[],
    },
    {
      name: "Setup Vault",
      license: "MIT",
      summary: "Setups .sto por coche y circuito.",
      pages: [{ name: "Garage", url: "/garage/" }] satisfies KbPage[],
    },
    {
      name: "Wallpapers",
      license: "MIT",
      summary: "Packs por serie oficial de iRacing, con un script de Windows sincronizado.",
      pages: [{ name: "Wallpapers", url: "/wallpapers/" }] satisfies KbPage[],
    },
  ],
  series: {
    imsa: "IMSA (GTP, incluida la Valkyrie, más LMP2 y 11 GT3, incluidos el Audi R8 Evo II y el McLaren 720S GT3)",
    gt: "GT Sprint y GT Endurance",
    nec: "NEC",
    porscheCup: "Porsche Cup",
    page: "/series/",
  },
} as const;

export function verifiedFacts(): string {
  const drivers = MUNTRUME_KB.drivers
    .map((driver) =>
      driver.email
        ? `- ${driver.dorsal} ${driver.name}: ${driver.email}`
        : `- ${driver.dorsal} ${driver.name}: no hay correo publicado para este piloto.`
    )
    .join("\n");
  const tools = MUNTRUME_KB.ecosystem
    .map((tool) => {
      const links = tool.pages.map((page) => `${page.url}`).join(", ");
      return `- ${tool.name} (${tool.license}): ${tool.summary} Páginas: ${links}`;
    })
    .join("\n");
  return [
    "Pilotos:",
    drivers,
    "Contacto:",
    `- Administración y prensa: ${MUNTRUME_KB.contacts.administration}`,
    `- Legal: ${MUNTRUME_KB.contacts.legal} (página ${MUNTRUME_KB.contacts.legalPage})`,
    "Ecosistema open source:",
    tools,
    "Series oficiales:",
    `- ${MUNTRUME_KB.series.imsa}`,
    `- ${MUNTRUME_KB.series.gt}`,
    `- ${MUNTRUME_KB.series.nec}`,
    `- ${MUNTRUME_KB.series.porscheCup}`,
    `- Directorio de series: ${MUNTRUME_KB.series.page}`,
    `Repositorio: ${MUNTRUME_KB.repo} (${MUNTRUME_KB.license}).`,
  ].join("\n");
}
