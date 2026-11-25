import type { CarProfile, PhotoGuideShot, SkinDesignState } from "./types";

function hexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = hexLuminance(hexA);
  const l2 = hexLuminance(hexB);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

export function buildDefaultPhotoGuide(car: CarProfile, state: SkinDesignState): PhotoGuideShot[] {
  const isDarkBase = hexLuminance(state.palette.primary) < 0.22;
  const isMetallicOrGloss = state.spec.finish === "metallic" || state.spec.finish === "chrome" || state.spec.finish === "gloss";
  const num = (state.customNumber || "16").replace(/[^0-9A-Za-z]/g, "") || "16";
  const slug = `${car.iracingFolder}_${num}`;

  const mainCircuit = isDarkBase
    ? "Circuit de Spa-Francorchamps (Recta Kemmel / Pit Exit)"
    : "Autodromo Nazionale Monza (Variante Ascari / Recta Principal)";
  const lighting = isDarkBase
    ? isMetallicOrGloss
      ? "16:45 (Golden Hour) · Partly Cloudy — evita negros empastados y saca reflejos del Spec Map"
      : "11:30 · Partly Cloudy suave — iluminación uniforme para resaltar carbono/mate sin sombras duras"
    : "15:30 · Clear / Partly Cloudy — evita sobreexposición en carrocería clara y mantiene contraste de sponsors";

  return [
    {
      id: "front34",
      title: "1. Portada Frontal 3/4 (Trading Paints Hero)",
      filename: `mmt_${slug}_01_front34.png`,
      circuit: mainCircuit,
      timeAndWeather: lighting,
      cameraSetup: "Replay pausado en pista limpia → Cámara 'Chase' o 'Far Chase' → Ctrl+F12 → FOV 32°-38°, gira 35° a izquierda, altura baja (0.95m) apuntando al faro delantero.",
      checklist: [
        "Verifica que el escudo MMT del capó no se corta ni monta sobre rejillas.",
        "Comprueba que el dorsal del capó y el splitter delantero tienen buen contraste.",
        "Sin HUD ni barra de replay (pulsa Barra Espaciadora para ocultar UI de iRacing).",
      ],
    },
    {
      id: "side",
      title: "2. Perfil Lateral Completo",
      filename: `mmt_${slug}_02_side.png`,
      circuit: "Circuit de Barcelona-Catalunya (Recta de Meta · Muro limpio)",
      timeAndWeather: lighting,
      cameraSetup: "Cámara 'Far Chase' → Ctrl+F12 → FOV 28° (teleobjetivo para evitar distorsión), ángulo 90° exacto perpendicular a la puerta, distancia ~6m.",
      checklist: [
        "Confirma que la placa oficial de dorsal de iRacing queda limpia y sin texto debajo.",
        "Revisa alineación de franjas laterales y simetría del wordmark MUNTRUME.",
        "Asegura ruedas ligeramente rectas y sombra completa bajo el coche.",
      ],
    },
    {
      id: "rear34",
      title: "3. Trasera 3/4 y Alerón",
      filename: `mmt_${slug}_03_rear34.png`,
      circuit: mainCircuit,
      timeAndWeather: "17:15 (Atardecer suave) · Partly Cloudy — realza pilotos traseros y alerón",
      cameraSetup: "Cámara 'Chase' → Ctrl+F12 → FOV 35°, gira 145° hacia la zaga, altura media-baja (1.05m) para leer bien el plano superior del alerón y el difusor.",
      checklist: [
        "Verifica legibilidad de MUNTRU.ME en el plano del alerón trasero.",
        "Comprueba transición de color en parachoques trasero y endplates.",
        "Revisa que el Spec Map (brillo/mate) no genera artefactos en las uniones UV.",
      ],
    },
    {
      id: "top",
      title: "4. Cenital / Techo y Dorsal (Web muntru.me)",
      filename: `mmt_${slug}_04_top_detail.png`,
      circuit: "Daytona International Speedway (Pit Lane o Recta)",
      timeAndWeather: "13:30 · Partly Cloudy — luz cenital limpia sobre techo y capó",
      cameraSetup: "Cámara 'Chopper' o 'Far Chase' → Ctrl+F12 → Eleva cámara (Z +4.5m), Pitch -72°, FOV 30° centrando capó, techo y dorsal.",
      checklist: [
        "Confirma simetría izquierda/derecha entre capó, techo y retrovisores.",
        "Comprueba que el dorsal del techo se lee desde cámaras TV aéreas.",
        "Ideal para ficha del coche y galería oficial en muntru.me.",
      ],
    },
  ];
}
