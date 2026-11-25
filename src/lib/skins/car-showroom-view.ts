import { BUILTIN_DECALS, getCarById } from "./catalog";
import type { DecalLayer, SkinDesignState, ZoneKey } from "./types";

export type ShowroomAngle = "side" | "top" | "front" | "rear";

const decalImgCache = new Map<string, HTMLImageElement>();

function loadDecalImg(key: string, src: string): Promise<HTMLImageElement | null> {
  const cached = decalImgCache.get(key);
  if (cached && cached.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      decalImgCache.set(key, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function resolveDecalImage(decal: DecalLayer): Promise<HTMLImageElement | null> {
  if (decal.kind === "custom" && decal.dataUrl) {
    return loadDecalImg(`custom:${decal.id}:${decal.dataUrl.slice(0, 40)}`, decal.dataUrl);
  }
  if (decal.kind === "builtin" && decal.assetId) {
    const asset = BUILTIN_DECALS.find((b) => b.id === decal.assetId);
    if (!asset) return null;
    const svg = asset.svg(decal.color || "#ffffff");
    return loadDecalImg(`builtin:${asset.id}:${decal.color}`, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  }
  return null;
}

function drawStudioBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, carName: string, angleLabel: string): void {
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.35, 30, w * 0.5, h * 0.5, w * 0.7);
  bg.addColorStop(0, "#172130");
  bg.addColorStop(0.65, "#0b1018");
  bg.addColorStop(1, "#06090e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle garage studio floor grid
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // Floor shadow for side/front/rear views
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.77, w * 0.38, h * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Studio watermark header
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "700 12px Inter, Segoe UI, system-ui, sans-serif";
  ctx.fillText(`${carName.toUpperCase()}  ·  ${angleLabel.toUpperCase()}`, 22, 28);
  ctx.fillStyle = "rgba(0,230,153,0.85)";
  ctx.font = "800 11px ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText("GT / iRACING PAINT SHOP", w - 22, 28);
  ctx.restore();
}

function drawWheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string): void {
  ctx.save();
  // Tire
  ctx.fillStyle = "#0a0c10";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1e2430";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Rim
  ctx.fillStyle = "#1c222d";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.67, 0, Math.PI * 2);
  ctx.fill();

  // Brake rotor + caliper
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx + r * 0.24, cy - r * 0.14, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Spokes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 0.64, cy + Math.sin(a) * r * 0.64);
    ctx.stroke();
  }
  // Center lock nut
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

async function drawDecalInBox(
  ctx: CanvasRenderingContext2D,
  decal: DecalLayer,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  fontFam: string,
): Promise<void> {
  const cx = boxX + boxW * 0.5;
  const cy = boxY + boxH * 0.5;
  const targetW = Math.min(boxW * 0.9, Math.max(40, decal.scale * boxW * 3.1));

  ctx.save();
  ctx.globalAlpha = Math.max(0.1, Math.min(1, decal.opacity));
  ctx.translate(cx, cy);
  ctx.rotate((decal.rotation * Math.PI) / 180);

  if (decal.kind === "text") {
    ctx.fillStyle = decal.color || "#ffffff";
    ctx.font = `900 ${Math.round(Math.min(boxH * 0.52, targetW * 0.24))}px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(decal.text || decal.name, 0, 0);
  } else {
    const img = await resolveDecalImage(decal);
    if (img) {
      const aspect = img.naturalHeight > 0 && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0.35;
      const drawH = Math.min(boxH * 0.85, targetW * aspect);
      const drawW = drawH / aspect;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    }
  }
  ctx.restore();
}

function getFontFamily(style: SkinDesignState["fontStyle"]): string {
  if (style === "condensed-gt") return "'Barlow Condensed', 'Impact', sans-serif";
  if (style === "mono-tech") return "'JetBrains Mono', ui-monospace, monospace";
  return "'Inter', 'Segoe UI', system-ui, sans-serif";
}

function decalsForZone(state: SkinDesignState, zones: ZoneKey[]): DecalLayer[] {
  return state.decals.filter((d) => {
    if (d.zoneHint && zones.includes(d.zoneHint)) return true;
    // Also match by UV coordinate containment
    for (const zk of zones) {
      const r = state.zones[zk];
      if (!r) continue;
      if (d.x >= r.x && d.x <= r.x + r.w && d.y >= r.y && d.y <= r.y + r.h) return true;
      if (d.mirrorX) {
        const mx = 1 - d.x;
        if (mx >= r.x && mx <= r.x + r.w && d.y >= r.y && d.y <= r.y + r.h) return true;
      }
    }
    return false;
  });
}

async function drawSideView(ctx: CanvasRenderingContext2D, w: number, h: number, state: SkinDesignState): Promise<void> {
  const { palette, pattern, spec } = state;
  const fontFam = getFontFamily(state.fontStyle);

  // Body silhouette path (sleek GT3 side profile)
  const bodyPath = new Path2D();
  bodyPath.moveTo(w * 0.11, h * 0.66); // front splitter tip
  bodyPath.lineTo(w * 0.12, h * 0.58);
  bodyPath.quadraticCurveTo(w * 0.16, h * 0.49, w * 0.31, h * 0.45); // hood
  bodyPath.quadraticCurveTo(w * 0.43, h * 0.33, w * 0.56, h * 0.33); // windshield + roof
  bodyPath.quadraticCurveTo(w * 0.72, h * 0.34, w * 0.84, h * 0.45); // fastback rear
  bodyPath.lineTo(w * 0.89, h * 0.48); // rear deck
  bodyPath.lineTo(w * 0.88, h * 0.65); // rear bumper
  bodyPath.lineTo(w * 0.11, h * 0.66);
  bodyPath.closePath();

  // Rear Wing swan-neck + endplate
  ctx.save();
  ctx.fillStyle = palette.secondary;
  ctx.fillRect(w * 0.83, h * 0.37, w * 0.025, h * 0.10); // wing upright
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(w * 0.81, h * 0.33, w * 0.095, h * 0.065, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Paint body clipped to silhouette
  ctx.save();
  ctx.clip(bodyPath);

  ctx.fillStyle = palette.primary;
  ctx.fillRect(w * 0.08, h * 0.28, w * 0.84, h * 0.44);

  // Livery pattern stripes on side profile
  if (pattern === "endurance") {
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.moveTo(w * 0.10, h * 0.64);
    ctx.lineTo(w * 0.76, h * 0.43);
    ctx.lineTo(w * 0.90, h * 0.43);
    ctx.lineTo(w * 0.90, h * 0.68);
    ctx.lineTo(w * 0.10, h * 0.68);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.63);
    ctx.lineTo(w * 0.76, h * 0.43);
    ctx.stroke();

    ctx.strokeStyle = palette.detail;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.605);
    ctx.lineTo(w * 0.75, h * 0.405);
    ctx.stroke();
  } else if (pattern === "sprint") {
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(w * 0.10, h * 0.56, w * 0.82, h * 0.12);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(w * 0.10, h * 0.535, w * 0.82, h * 0.028);
  } else if (pattern === "tricolor") {
    const cols = [palette.secondary, palette.accent, palette.detail];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      const ox = w * (0.48 + i * 0.055);
      ctx.moveTo(ox, h * 0.30);
      ctx.lineTo(ox + w * 0.045, h * 0.30);
      ctx.lineTo(ox - w * 0.12 + w * 0.045, h * 0.70);
      ctx.lineTo(ox - w * 0.12, h * 0.70);
      ctx.closePath();
      ctx.fill();
    });
  } else if (pattern === "carbon-stealth") {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(w * 0.10, h * 0.605, w * 0.82, h * 0.02);
    ctx.fillStyle = palette.detail;
    ctx.fillRect(w * 0.10, h * 0.635, w * 0.82, h * 0.01);
  } else {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(w * 0.10, h * 0.62, w * 0.82, h * 0.018);
  }

  // Front splitter & rear diffuser
  ctx.fillStyle = "#090b0f";
  ctx.fillRect(w * 0.10, h * 0.635, w * 0.80, h * 0.04);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(w * 0.11, h * 0.648, w * 0.14, h * 0.01);

  // Gloss / Specular sheen gradient along upper body
  const glossAlpha = Math.max(0.05, (100 - spec.roughness) / 360);
  const sheen = ctx.createLinearGradient(0, h * 0.32, 0, h * 0.56);
  sheen.addColorStop(0, `rgba(255,255,255,${glossAlpha})`);
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = sheen;
  ctx.fillRect(w * 0.08, h * 0.30, w * 0.84, h * 0.38);
  ctx.restore();

  // Body outline
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke(bodyPath);

  // Cockpit side glass
  ctx.save();
  ctx.fillStyle = "#090e17";
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.45);
  ctx.quadraticCurveTo(w * 0.44, h * 0.355, w * 0.55, h * 0.355);
  ctx.lineTo(w * 0.68, h * 0.435);
  ctx.lineTo(w * 0.34, h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Side mirror in accent color
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(w * 0.37, h * 0.425, w * 0.04, h * 0.028, 5);
  ctx.fill();

  // Headlight & Taillight LEDs
  ctx.fillStyle = "#e0f2fe";
  ctx.beginPath();
  ctx.roundRect(w * 0.125, h * 0.545, w * 0.055, h * 0.022, 4);
  ctx.fill();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.roundRect(w * 0.855, h * 0.515, w * 0.03, h * 0.024, 3);
  ctx.fill();

  // Official iRacing Side Door Number Plate
  const plateX = w * 0.41;
  const plateY = h * 0.485;
  const plateW = w * 0.095;
  const plateH = h * 0.11;
  ctx.save();
  ctx.fillStyle = palette.numberBg;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 5);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = palette.numberColor;
  ctx.font = `900 ${Math.round(plateH * 0.62)}px ${fontFam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.customNumber || "16", plateX + plateW / 2, plateY + plateH / 2 + 2);
  ctx.restore();

  // Side sponsors projected onto door/rear quarter
  const sideDecals = decalsForZone(state, ["leftSide", "rightSide"]);
  for (let i = 0; i < sideDecals.length; i++) {
    await drawDecalInBox(ctx, sideDecals[i], w * 0.515, h * (0.48 + i * 0.075), w * 0.23, h * 0.095, fontFam);
  }

  // Wheels
  drawWheel(ctx, w * 0.255, h * 0.64, h * 0.115, palette.accent);
  drawWheel(ctx, w * 0.745, h * 0.64, h * 0.115, palette.accent);
}

async function drawTopView(ctx: CanvasRenderingContext2D, w: number, h: number, state: SkinDesignState): Promise<void> {
  const { palette, pattern } = state;
  const fontFam = getFontFamily(state.fontStyle);

  const carW = w * 0.34;
  const carH = h * 0.74;
  const cx = w * 0.5;
  const top = h * 0.13;

  const hull = new Path2D();
  hull.roundRect(cx - carW / 2, top, carW, carH, [54, 54, 24, 24]);

  ctx.save();
  ctx.clip(hull);
  ctx.fillStyle = palette.primary;
  ctx.fillRect(cx - carW / 2, top, carW, carH);

  if (pattern === "endurance") {
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.moveTo(cx - carW * 0.36, top);
    ctx.lineTo(cx + carW * 0.36, top);
    ctx.lineTo(cx + carW * 0.20, top + carH * 0.36);
    ctx.lineTo(cx - carW * 0.20, top + carH * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - carW * 0.35, top);
    ctx.lineTo(cx - carW * 0.20, top + carH * 0.36);
    ctx.moveTo(cx + carW * 0.35, top);
    ctx.lineTo(cx + carW * 0.20, top + carH * 0.36);
    ctx.stroke();
  } else if (pattern === "sprint") {
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(cx - carW * 0.16, top, carW * 0.32, carH);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(cx - carW * 0.19, top, carW * 0.03, carH);
    ctx.fillRect(cx + carW * 0.16, top, carW * 0.03, carH);
  } else if (pattern === "tricolor") {
    [palette.secondary, palette.accent, palette.detail].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(cx - carW * 0.22 + i * carW * 0.15, top, carW * 0.13, carH);
    });
  } else {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(cx - carW * 0.42, top + carH * 0.32, carW * 0.84, 8);
  }

  // Windshield + rear glass
  ctx.fillStyle = "#090e17";
  ctx.beginPath();
  ctx.roundRect(cx - carW * 0.38, top + carH * 0.35, carW * 0.76, carH * 0.14, 14);
  ctx.fill();

  // Roof panel
  ctx.fillStyle = palette.secondary;
  ctx.beginPath();
  ctx.roundRect(cx - carW * 0.34, top + carH * 0.47, carW * 0.68, carH * 0.20, 10);
  ctx.fill();
  ctx.fillStyle = palette.accent;
  ctx.fillRect(cx - carW * 0.34, top + carH * 0.47, carW * 0.68, 16);

  if (state.showNumberOnCar) {
    ctx.fillStyle = palette.detail;
    ctx.font = `900 54px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.customNumber || "16", cx, top + carH * 0.585);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke(hull);

  // Side mirrors
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(cx - carW / 2 - 24, top + carH * 0.38, 26, 14, 5);
  ctx.roundRect(cx + carW / 2 - 2, top + carH * 0.38, 26, 14, 5);
  ctx.fill();

  // Rear Wing
  const wingW = carW * 1.12;
  const wingH = 44;
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(cx - wingW / 2, top + carH - 36, wingW, wingH, 6);
  ctx.fill();

  // Hood decals & wing decals
  const hoodDecals = decalsForZone(state, ["hood"]);
  for (const d of hoodDecals.slice(0, 2)) {
    await drawDecalInBox(ctx, d, cx - carW * 0.34, top + 28, carW * 0.68, carH * 0.26, fontFam);
  }
  const wingDecals = decalsForZone(state, ["rearWing"]);
  for (const d of wingDecals.slice(0, 1)) {
    await drawDecalInBox(ctx, d, cx - wingW * 0.44, top + carH - 34, wingW * 0.88, wingH - 4, fontFam);
  }
}

async function drawFrontOrRearView(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SkinDesignState,
  isRear: boolean,
): Promise<void> {
  const { palette } = state;
  const fontFam = getFontFamily(state.fontStyle);
  const cx = w * 0.5;
  const bw = w * 0.52;
  const bh = h * 0.36;
  const by = h * 0.38;

  // Tires
  ctx.fillStyle = "#090b0f";
  ctx.fillRect(cx - bw * 0.49, by + bh * 0.55, bw * 0.14, bh * 0.52);
  ctx.fillRect(cx + bw * 0.35, by + bh * 0.55, bw * 0.14, bh * 0.52);

  // Rear wing visible from both front & rear
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(cx - bw * 0.52, by - 46, bw * 1.04, 24, 5);
  ctx.fill();
  ctx.fillStyle = palette.secondary;
  ctx.fillRect(cx - bw * 0.18, by - 24, 12, 34);
  ctx.fillRect(cx + bw * 0.18 - 12, by - 24, 12, 34);

  // Cabin greenhouse
  ctx.fillStyle = "#090e17";
  ctx.beginPath();
  ctx.moveTo(cx - bw * 0.34, by + 22);
  ctx.lineTo(cx - bw * 0.25, by - 36);
  ctx.lineTo(cx + bw * 0.25, by - 36);
  ctx.lineTo(cx + bw * 0.34, by + 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Sunstrip / banner
  ctx.fillStyle = palette.accent;
  ctx.fillRect(cx - bw * 0.24, by - 32, bw * 0.48, 12);

  // Mirrors
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(cx - bw * 0.45, by - 2, 36, 18, 6);
  ctx.roundRect(cx + bw * 0.45 - 36, by - 2, 36, 18, 6);
  ctx.fill();

  // Main body
  ctx.fillStyle = palette.primary;
  ctx.beginPath();
  ctx.roundRect(cx - bw / 2, by + 16, bw, bh * 0.72, [26, 26, 10, 10]);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Lower grille / diffuser
  ctx.fillStyle = palette.secondary;
  ctx.beginPath();
  ctx.roundRect(cx - bw * 0.42, by + bh * 0.48, bw * 0.84, bh * 0.34, 8);
  ctx.fill();
  ctx.fillStyle = palette.accent;
  ctx.fillRect(cx - bw * 0.46, by + bh * 0.84, bw * 0.92, 8);

  // Lights
  ctx.fillStyle = isRear ? "#ef4444" : "#e0f2fe";
  ctx.beginPath();
  ctx.roundRect(cx - bw * 0.44, by + 44, bw * 0.16, 20, 6);
  ctx.roundRect(cx + bw * 0.28, by + 44, bw * 0.16, 20, 6);
  ctx.fill();

  if (isRear) {
    const wingDecals = decalsForZone(state, ["rearWing"]);
    for (const d of wingDecals.slice(0, 1)) {
      await drawDecalInBox(ctx, d, cx - bw * 0.4, by - 46, bw * 0.8, 24, fontFam);
    }
    ctx.fillStyle = palette.detail;
    ctx.font = `800 18px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.fillText(`#${state.customNumber || "16"} · MUNTRUME`, cx, by + bh * 0.36);
  } else {
    const hoodDecals = decalsForZone(state, ["hood"]);
    for (const d of hoodDecals.slice(0, 1)) {
      await drawDecalInBox(ctx, d, cx - bw * 0.25, by + 22, bw * 0.5, bh * 0.28, fontFam);
    }
  }
}

export async function renderShowroomCarView(
  canvas: HTMLCanvasElement,
  state: SkinDesignState,
  angle: ShowroomAngle,
): Promise<void> {
  const w = 1024;
  const h = 640;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const car = getCarById(state.carId);
  const labels: Record<ShowroomAngle, string> = {
    side: "Vista Lateral · Puertas y Dorsal",
    top: "Vista Superior · Capó, Techo y Alerón",
    front: "Vista Frontal · Morro y Espejos",
    rear: "Vista Trasera · Alerón y Difusor",
  };

  drawStudioBackdrop(ctx, w, h, car.name, labels[angle]);

  if (angle === "side") {
    await drawSideView(ctx, w, h, state);
  } else if (angle === "top") {
    await drawTopView(ctx, w, h, state);
  } else {
    await drawFrontOrRearView(ctx, w, h, state, angle === "rear");
  }
}
