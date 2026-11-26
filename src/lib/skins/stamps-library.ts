/**
 * Trading Paints Paint Builder Pro–style Default Stamps & Graphics Library.
 * 24+ crisp vector SVG stamps with live colorization, explicit 512x512 dimensions,
 * and zero external dependencies so they render cleanly on 2K/4K canvases & TGA exports.
 */

export interface DefaultStampItem {
  id: string;
  label: string;
  category: "racing" | "stripes" | "patterns" | "fia" | "shapes";
  defaultScale: number;
  svg: (color: string) => string;
}

const wrap = (body: string, vb = "0 0 512 512") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="${vb}">${body}</svg>`;

export const DEFAULT_STAMPS: DefaultStampItem[] = [
  {
    id: "stamp-checkered-flag",
    label: "Bandera a Cuadros",
    category: "racing",
    defaultScale: 0.24,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          [0, 1, 2, 3, 4, 5].flatMap((r) =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((col) =>
              (r + col) % 2 === 0
                ? `<rect x="${col * 64}" y="${r * 64 + 64}" width="64" height="64" transform="skewX(-12)"/>`
                : "",
            ),
          ).join("") +
          `</g>`,
      ),
  },
  {
    id: "stamp-racing-chevron",
    label: "Chevrón Racing",
    category: "stripes",
    defaultScale: 0.28,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<polygon points="40,140 256,40 472,140 472,210 256,110 40,210"/>` +
          `<polygon points="40,250 256,150 472,250 472,320 256,220 40,320" opacity="0.78"/>` +
          `<polygon points="40,360 256,260 472,360 472,420 256,320 40,420" opacity="0.52"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-triple-slash",
    label: "Triple Franja Diagonal",
    category: "stripes",
    defaultScale: 0.26,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<polygon points="110,460 210,52 280,52 180,460"/>` +
          `<polygon points="215,460 315,52 365,52 265,460" opacity="0.82"/>` +
          `<polygon points="300,460 400,52 432,52 332,460" opacity="0.55"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-claw-rip",
    label: "Garras / Rasguño",
    category: "racing",
    defaultScale: 0.24,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<path d="M90 60 C130 170 155 300 135 455 C165 360 185 215 148 55 Z"/>` +
          `<path d="M210 35 C255 165 275 315 245 478 C288 370 310 210 268 30 Z"/>` +
          `<path d="M335 70 C372 180 390 300 368 445 C402 350 418 220 382 65 Z"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-flames",
    label: "Llamas Racing",
    category: "racing",
    defaultScale: 0.28,
    svg: (c) =>
      wrap(
        `<path fill="${c}" d="M30 330 C95 210 210 190 310 130 C265 190 250 220 290 215 C365 205 430 165 485 120 C440 215 395 260 445 268 C470 272 488 265 500 256 C445 340 350 385 230 390 C275 352 270 332 215 344 C155 356 85 368 30 330 Z"/>`,
      ),
  },
  {
    id: "stamp-speed-lines",
    label: "Líneas de Velocidad",
    category: "stripes",
    defaultScale: 0.30,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<polygon points="20,120 492,100 472,132 20,145"/>` +
          `<polygon points="60,185 492,170 468,202 60,210" opacity="0.85"/>` +
          `<polygon points="10,255 492,244 475,274 10,280"/>` +
          `<polygon points="90,325 492,316 470,344 90,348" opacity="0.72"/>` +
          `<polygon points="40,390 492,384 476,408 40,410" opacity="0.5"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-hex-mesh",
    label: "Rejilla Hexagonal",
    category: "patterns",
    defaultScale: 0.28,
    svg: (c) => {
      const hex = (cx: number, cy: number, r: number) => {
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(" ");
        return `<polygon points="${pts}" fill="none" stroke="${c}" stroke-width="8"/>`;
      };
      const items: string[] = [];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const cx = 76 + col * 90 + (row % 2 ? 45 : 0);
          const cy = 76 + row * 78;
          if (cx < 470 && cy < 460) items.push(hex(cx, cy, 38));
        }
      }
      return wrap(items.join(""));
    },
  },
  {
    id: "stamp-halftone-fade",
    label: "Degradado Halftone",
    category: "patterns",
    defaultScale: 0.28,
    svg: (c) => {
      const dots: string[] = [];
      for (let r = 0; r < 8; r++) {
        for (let col = 0; col < 8; col++) {
          const rad = Math.max(3, 22 - col * 2.4);
          dots.push(`<circle cx="${48 + col * 60}" cy="${48 + r * 60}" r="${rad.toFixed(1)}" fill="${c}"/>`);
        }
      }
      return wrap(dots.join(""));
    },
  },
  {
    id: "stamp-shatter-shards",
    label: "Fragmentos Geométricos",
    category: "patterns",
    defaultScale: 0.26,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<polygon points="40,120 190,60 155,210"/>` +
          `<polygon points="210,75 370,40 290,195" opacity="0.82"/>` +
          `<polygon points="330,190 480,110 450,275" opacity="0.65"/>` +
          `<polygon points="85,260 250,215 195,380" opacity="0.9"/>` +
          `<polygon points="245,270 420,290 315,455" opacity="0.72"/>` +
          `<polygon points="45,390 165,375 110,475" opacity="0.5"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-aero-swoosh",
    label: "Curva Aero GT",
    category: "stripes",
    defaultScale: 0.30,
    svg: (c) =>
      wrap(
        `<path fill="${c}" d="M24 360 C140 310 260 175 488 125 L488 185 C310 235 195 360 24 415 Z"/>` +
          `<path fill="${c}" opacity="0.58" d="M60 430 C190 380 305 260 488 225 L488 258 C335 292 225 405 60 458 Z"/>`,
      ),
  },
  {
    id: "stamp-fia-tow",
    label: "Flecha Remolque (TOW)",
    category: "fia",
    defaultScale: 0.09,
    svg: (c) =>
      wrap(
        `<polygon fill="${c}" points="256,36 440,260 328,260 328,476 184,476 184,260 72,260"/>`,
      ),
  },
  {
    id: "stamp-fia-killswitch",
    label: "Corte Corriente (E)",
    category: "fia",
    defaultScale: 0.09,
    svg: (c) =>
      wrap(
        `<polygon points="256,36 476,440 36,440" fill="#1d4ed8" stroke="#ffffff" stroke-width="24"/>` +
          `<polygon points="276,120 186,282 252,282 230,404 334,236 266,236" fill="${c}"/>`,
      ),
  },
  {
    id: "stamp-fia-fire",
    label: "Extintor FIA (E)",
    category: "fia",
    defaultScale: 0.09,
    svg: (c) =>
      wrap(
        `<circle cx="256" cy="256" r="220" fill="#ffffff" stroke="${c}" stroke-width="34"/>` +
          `<text x="256" y="338" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="260" font-weight="900" fill="${c}">E</text>`,
      ),
  },
  {
    id: "stamp-number-plate-gt3",
    label: "Placa Dorsal GT3",
    category: "fia",
    defaultScale: 0.22,
    svg: (c) =>
      wrap(
        `<rect x="28" y="64" width="456" height="384" rx="22" fill="#ffffff" stroke="#0f172a" stroke-width="16"/>` +
          `<rect x="28" y="64" width="456" height="92" rx="18" fill="${c}"/>` +
          `<text x="256" y="128" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="54" font-weight="900" fill="#ffffff">GT3 PRO</text>`,
      ),
  },
  {
    id: "stamp-number-plate-imsa",
    label: "Placa IMSA GTD",
    category: "fia",
    defaultScale: 0.22,
    svg: (c) =>
      wrap(
        `<rect x="28" y="64" width="456" height="384" rx="22" fill="#ffffff" stroke="#0f172a" stroke-width="16"/>` +
          `<rect x="28" y="64" width="456" height="96" rx="18" fill="${c}"/>` +
          `<text x="256" y="130" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="56" font-weight="900" fill="#ffffff">IMSA · GTD</text>`,
      ),
  },
  {
    id: "stamp-sunburst",
    label: "Rayos Sunburst",
    category: "patterns",
    defaultScale: 0.28,
    svg: (c) => {
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a1 = (i * 30 * Math.PI) / 180;
        const a2 = ((i * 30 + 14) * Math.PI) / 180;
        const x1 = (256 + 245 * Math.cos(a1)).toFixed(1);
        const y1 = (256 + 245 * Math.sin(a1)).toFixed(1);
        const x2 = (256 + 245 * Math.cos(a2)).toFixed(1);
        const y2 = (256 + 245 * Math.sin(a2)).toFixed(1);
        return `<polygon points="256,256 ${x1},${y1} ${x2},${y2}" fill="${c}"/>`;
      }).join("");
      return wrap(rays);
    },
  },
  {
    id: "stamp-camo-blob",
    label: "Parche Camo Proto",
    category: "patterns",
    defaultScale: 0.26,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<path d="M70 150 L200 70 L320 120 L270 250 L110 280 Z"/>` +
          `<path d="M270 240 L440 175 L475 340 L345 435 L235 355 Z" opacity="0.78"/>` +
          `<path d="M40 330 L175 310 L215 445 L75 465 Z" opacity="0.58"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-star-racing",
    label: "Estrella Racing",
    category: "shapes",
    defaultScale: 0.16,
    svg: (c) =>
      wrap(
        `<polygon fill="${c}" points="256,34 316,184 478,196 354,300 392,458 256,374 120,458 158,300 34,196 196,184"/>`,
      ),
  },
  {
    id: "stamp-lightning",
    label: "Rayo Turbo",
    category: "racing",
    defaultScale: 0.18,
    svg: (c) =>
      wrap(
        `<polygon fill="${c}" points="308,24 114,274 242,274 188,488 408,224 276,224"/>`,
      ),
  },
  {
    id: "stamp-double-stripe",
    label: "Doble Franja Le Mans",
    category: "stripes",
    defaultScale: 0.26,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<rect x="136" y="16" width="96" height="480"/>` +
          `<rect x="280" y="16" width="96" height="480"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-pinstripe-accent",
    label: "Franja con Pinstripe",
    category: "stripes",
    defaultScale: 0.28,
    svg: (c) =>
      wrap(
        `<g fill="${c}">` +
          `<rect x="16" y="186" width="480" height="84"/>` +
          `<rect x="16" y="150" width="480" height="18" opacity="0.75"/>` +
          `<rect x="16" y="288" width="480" height="18" opacity="0.75"/>` +
          `</g>`,
      ),
  },
  {
    id: "stamp-hexagon-solid",
    label: "Hexágono Sólido",
    category: "shapes",
    defaultScale: 0.16,
    svg: (c) =>
      wrap(`<polygon fill="${c}" points="256,32 450,144 450,368 256,480 62,368 62,144"/>`),
  },
  {
    id: "stamp-diamond-grid",
    label: "Trama Rombos",
    category: "patterns",
    defaultScale: 0.26,
    svg: (c) => {
      const cells: string[] = [];
      for (let r = 0; r < 5; r++) {
        for (let col = 0; col < 5; col++) {
          const cx = 64 + col * 96;
          const cy = 64 + r * 96;
          cells.push(`<polygon points="${cx},${cy - 34} ${cx + 34},${cy} ${cx},${cy + 34} ${cx - 34},${cy}" fill="${c}" opacity="${((r + col) % 2 ? 0.45 : 0.92)}"/>`);
        }
      }
      return wrap(cells.join(""));
    },
  },
  {
    id: "stamp-es-flag",
    label: "Bandera España",
    category: "fia",
    defaultScale: 0.14,
    svg: () =>
      wrap(
        `<rect x="24" y="106" width="464" height="75" fill="#aa151b"/>` +
          `<rect x="24" y="181" width="464" height="150" fill="#f1bf00"/>` +
          `<rect x="24" y="331" width="464" height="75" fill="#aa151b"/>`,
      ),
  },
];
