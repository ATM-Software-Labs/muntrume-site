/**
 * High-Fidelity 2D -> 3D Motorsport Showroom Engine powered by Three.js for skins.muntru.me.
 * - Sculpted parametric 3D bodywork by category (GT3/GT4, Prototype/GTP, Formula, Touring/Stock)
 *   built with CatmullRomCurve3 splines, indexed smooth-normal lofting (computeVertexNormals),
 *   ExtrudeGeometry airfoil wings & dorsal shark fins, TubeGeometry swan-neck pylons / A-B-C pillars / Halo,
 *   and LatheGeometry contoured slick tires with 10-spoke rims, brake rotors & calipers.
 * - Live dual THREE.CanvasTexture pipeline: Paint (map) + iRacing Spec Map (roughnessMap + metalnessMap + clearcoat)
 *   + procedural 2x2 twill carbon fiber bumpMap + RoomEnvironment PMREM studio reflections.
 * - OrbitControls, 4 camera presets, 3 studio lighting presets (Mediodía, Atardecer, Nublado/Boxes),
 *   and 100% client-side .GLB / .GLTF / .OBJ local model loader via URL.createObjectURL.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ZoneKey, ZoneRect } from "./types";

export type CarBodyCategory = "gt3" | "gtp" | "formula" | "touring";
export type LightingPreset = "noon" | "sunset" | "overcast";

type UvRect = Pick<ZoneRect, "x" | "y" | "w" | "h">;

const DEFAULT_CAR_ZONES: Record<ZoneKey, UvRect> = {
  hood: { x: 0.3, y: 0.06, w: 0.4, h: 0.25 },
  roof: { x: 0.34, y: 0.34, w: 0.32, h: 0.22 },
  leftSide: { x: 0.03, y: 0.34, w: 0.27, h: 0.44 },
  rightSide: { x: 0.7, y: 0.34, w: 0.27, h: 0.44 },
  rearWing: { x: 0.27, y: 0.8, w: 0.46, h: 0.11 },
  mirrors: { x: 0.05, y: 0.12, w: 0.18, h: 0.1 },
  frontBumper: { x: 0.25, y: 0.6, w: 0.5, h: 0.09 },
  rearBumper: { x: 0.25, y: 0.7, w: 0.5, h: 0.08 },
  numberPlateLeft: { x: 0.1, y: 0.47, w: 0.14, h: 0.14 },
  numberPlateRight: { x: 0.76, y: 0.47, w: 0.14, h: 0.14 },
};

export function mapCategoryStringToBody(category?: string): CarBodyCategory {
  const c = String(category || "").toLowerCase();
  if (c.includes("gtp") || c.includes("lmp") || c.includes("proto")) return "gtp";
  if (c.includes("fórmula") || c.includes("formula") || c.includes("indy") || c.includes("open")) return "formula";
  if (c.includes("tcr") || c.includes("touring") || c.includes("stock") || c.includes("nascar") || c.includes("arca") || c.includes("dirt")) return "touring";
  return "gt3";
}

function saneZone(z: UvRect | undefined, fallback: UvRect): UvRect {
  if (!z || z.w < 0.08 || z.h < 0.08) return fallback;
  return z;
}

function normalizeZones(raw?: Record<ZoneKey, UvRect>): Record<ZoneKey, UvRect> {
  if (!raw) return DEFAULT_CAR_ZONES;
  return {
    hood: saneZone(raw.hood, DEFAULT_CAR_ZONES.hood),
    roof: saneZone(raw.roof, DEFAULT_CAR_ZONES.roof),
    leftSide: saneZone(raw.leftSide, DEFAULT_CAR_ZONES.leftSide),
    rightSide: saneZone(raw.rightSide, DEFAULT_CAR_ZONES.rightSide),
    rearWing: saneZone(raw.rearWing, DEFAULT_CAR_ZONES.rearWing),
    mirrors: saneZone(raw.mirrors, DEFAULT_CAR_ZONES.mirrors),
    frontBumper: saneZone(raw.frontBumper, DEFAULT_CAR_ZONES.frontBumper),
    rearBumper: saneZone(raw.rearBumper, DEFAULT_CAR_ZONES.rearBumper),
    numberPlateLeft: raw.numberPlateLeft ?? DEFAULT_CAR_ZONES.numberPlateLeft,
    numberPlateRight: raw.numberPlateRight ?? DEFAULT_CAR_ZONES.numberPlateRight,
  };
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Procedural 2x2 twill carbon fiber bump texture for realistic 3D carbon sheen.
 */
function createCarbonBumpTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#505050";
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        const shift = ((x + y) / 8) % 2 === 0;
        ctx.fillStyle = shift ? "#b8b8b8" : "#2a2a2a";
        ctx.fillRect(x, y, 4, 8);
        ctx.fillStyle = shift ? "#2a2a2a" : "#b8b8b8";
        ctx.fillRect(x + 4, y, 4, 8);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  return tex;
}

/**
 * UV-mapped BoxGeometry mapped cleanly to a car UV zone.
 */
function createZoneBox(sx: number, sy: number, sz: number, zRect: UvRect): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, zRect.x + u * zRect.w, zRect.y + (1 - v) * zRect.h);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Sculpted cambered airfoil rear wing using ExtrudeGeometry mapped to zones.rearWing.
 */
function createAirfoilWingGeometry(span: number, chord: number, thickness: number, zRect: UvRect): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(chord * 0.35, thickness * 1.15, chord, thickness * 0.35);
  shape.lineTo(chord, thickness * 0.15);
  shape.quadraticCurveTo(chord * 0.45, -thickness * 0.15, 0, -thickness * 0.25);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: span,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 14,
  });
  // Rotate so span runs along X (-span/2 .. +span/2) and leading edge faces +Z
  geo.translate(-chord * 0.5, 0, -span * 0.5);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const uFrac = Math.max(0, Math.min(1, (pos.getX(i) + span * 0.5) / span));
    const vFrac = Math.max(0, Math.min(1, (pos.getZ(i) + chord * 0.5) / chord));
    uv.setXY(i, zRect.x + uFrac * zRect.w, zRect.y + vFrac * zRect.h);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Sculpted curved GTP dorsal shark fin using ExtrudeGeometry mapped to zones.roof.
 */
function createSharkFinGeometry(zRect: UvRect): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1.38, 0);
  shape.lineTo(1.34, 0.26);
  shape.quadraticCurveTo(0.65, 0.34, 0.02, 0.18);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.translate(-0.69, 0, -0.014);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const uFrac = Math.max(0, Math.min(1, (pos.getZ(i) + 0.69) / 1.38));
    const vFrac = Math.max(0, Math.min(1, pos.getY(i) / 0.34));
    uv.setXY(i, zRect.x + uFrac * zRect.w, zRect.y + vFrac * zRect.h);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Smooth CatmullRomCurve3-driven indexed lofted bodywork (64 x 40) with welded computeVertexNormals().
 */
function buildSculptedBodyGeometries(
  category: CarBodyCategory,
  zones: Record<ZoneKey, UvRect>,
): { paintGeo: THREE.BufferGeometry; glassGeo: THREE.BufferGeometry } {
  const segS = 64;
  const segT = 40;

  // Define longitudinal CatmullRomCurve3 centerline spine (Y height along car length)
  const isGtp = category === "gtp";
  const isFormula = category === "formula";
  const isTouring = category === "touring";

  const spinePts = isFormula
    ? [
        new THREE.Vector3(0, -0.10, 2.08),
        new THREE.Vector3(0, 0.06, 1.15),
        new THREE.Vector3(0, 0.16, 0.45),
        new THREE.Vector3(0, 0.14, 0.05),
        new THREE.Vector3(0, 0.42, -0.35),
        new THREE.Vector3(0, 0.34, -1.15),
        new THREE.Vector3(0, 0.12, -1.96),
      ]
    : isGtp
      ? [
          new THREE.Vector3(0, -0.06, 1.98),
          new THREE.Vector3(0, 0.10, 1.35),
          new THREE.Vector3(0, 0.22, 0.68),
          new THREE.Vector3(0, 0.49, 0.02),
          new THREE.Vector3(0, 0.46, -0.62),
          new THREE.Vector3(0, 0.24, -1.35),
          new THREE.Vector3(0, 0.16, -1.94),
        ]
      : isTouring
        ? [
            new THREE.Vector3(0, 0.00, 1.84),
            new THREE.Vector3(0, 0.19, 1.35),
            new THREE.Vector3(0, 0.26, 0.72),
            new THREE.Vector3(0, 0.62, 0.18),
            new THREE.Vector3(0, 0.61, -0.78),
            new THREE.Vector3(0, 0.31, -1.42),
            new THREE.Vector3(0, 0.25, -1.84),
          ]
        : [
            // Sculpted GT3 / GT4 coupe silhouette
            new THREE.Vector3(0, -0.04, 1.94),
            new THREE.Vector3(0, 0.12, 1.42),
            new THREE.Vector3(0, 0.21, 0.74),
            new THREE.Vector3(0, 0.54, 0.08),
            new THREE.Vector3(0, 0.51, -0.66),
            new THREE.Vector3(0, 0.28, -1.44),
            new THREE.Vector3(0, 0.21, -1.88),
          ];

  const spineCurve = new THREE.CatmullRomCurve3(spinePts, false, "catmullrom", 0.45);
  const spineSamples = spineCurve.getPoints(segS);

  const evalVertex = (is: number, it: number): [number, number, number] => {
    const s = is / segS;
    const t = -1 + (2 * it) / segT;
    const at = Math.abs(t);
    const sign = t < 0 ? -1 : 1;
    const sp = spineSamples[is];
    const z = sp.z;

    if (isFormula) {
      const noseW = 0.13 + smoothstep(0.0, 0.34, s) * 0.21;
      const sidepodMask = smoothstep(0.36, 0.48, s) * (1 - smoothstep(0.75, 0.94, s));
      const halfW = noseW + sidepodMask * 0.42;
      const yFloor = -0.22;
      const podY = -0.02 + sidepodMask * 0.20;
      let y: number;
      if (at < 0.76) {
        const u = at / 0.76;
        y = sp.y * (1 - smoothstep(0.18, 0.72, u)) + podY * smoothstep(0.18, 0.72, u);
      } else {
        const u = (at - 0.76) / 0.24;
        y = podY * (1 - smoothstep(0, 1, u)) + yFloor * smoothstep(0, 1, u);
      }
      return [sign * halfW * Math.min(1, at / 0.80), y, z];
    }

    const noseTaper = smoothstep(0.0, isGtp ? 0.15 : 0.18, s);
    const tailTaper = 1.0 - smoothstep(0.86, 1.0, s) * (isGtp ? 0.08 : 0.14);
    const frontFlare = Math.exp(-Math.pow((s - 0.21) / 0.105, 2)) * (isGtp ? 0.14 : 0.095);
    const rearFlare = Math.exp(-Math.pow((s - 0.78) / 0.125, 2)) * (isGtp ? 0.15 : 0.115);
    const baseW = isGtp ? 0.66 : isTouring ? 0.69 : 0.65;
    const halfW = (baseW + 0.23 * noseTaper + frontFlare + rearFlare) * tailTaper;

    const yFloor = -0.24;
    const beltY =
      (isGtp ? -0.04 : isTouring ? 0.04 : -0.01) +
      smoothstep(0.0, 0.18, s) * 0.18 +
      smoothstep(0.24, 0.78, s) * (isGtp ? 0.09 : 0.13) -
      smoothstep(0.92, 1.0, s) * 0.05;

    const cabExtra = Math.max(0, sp.y - beltY);

    let xNorm: number;
    let y: number;

    if (at < 0.70) {
      const u = at / 0.70;
      const cabMask = smoothstep(0.04, 0.24, cabExtra);
      const tumblehome = smoothstep(isGtp ? 0.18 : 0.26, 0.68, u) * cabMask * (isGtp ? 0.42 : 0.25);
      xNorm = u * (1.0 - tumblehome * 0.48);

      const crown = Math.cos(u * Math.PI * 0.5) * 0.045;
      const archCrown = Math.exp(-Math.pow((u - 0.80) / 0.18, 2)) * (frontFlare + rearFlare) * (isGtp ? 1.0 : 0.65);
      const cabRoofProfile = Math.cos(Math.min(1, u / (isGtp ? 0.56 : 0.76)) * Math.PI * 0.5);
      // Slight GT3 beltline character crease at u ~ 0.88
      const beltCrease = Math.exp(-Math.pow((u - 0.90) / 0.08, 2)) * 0.018;
      y = beltY + crown + archCrown + cabExtra * Math.pow(Math.max(0, cabRoofProfile), 0.70) + beltCrease;
    } else {
      const u = (at - 0.70) / 0.30;
      // Sculpted lower side door tuck + side-skirt flare
      const doorConcave = -Math.sin(u * Math.PI) * 0.035;
      const rockerFlare = smoothstep(0.75, 1.0, u) * 0.03;
      xNorm = 1.0 + doorConcave + rockerFlare - Math.pow(u, 2.2) * 0.06;
      const shoulderY = beltY + (frontFlare + rearFlare) * 0.28;
      y = shoulderY * (1.0 - smoothstep(0, 1, u)) + yFloor * smoothstep(0, 1, u);
    }

    const noseRound = s < 0.07 ? (1.0 - s / 0.07) * Math.pow(at, 2) * 0.16 : 0;
    const tailRound = s > 0.93 ? ((s - 0.93) / 0.07) * Math.pow(at, 2) * 0.08 : 0;

    return [sign * halfW * xNorm, y, z - noseRound + tailRound];
  };

  const evalUv = (s: number, t: number): [number, number] => {
    const at = Math.abs(t);
    if (at >= 0.68) {
      const zRect = t < 0 ? zones.leftSide : zones.rightSide;
      const uFrac = t < 0 ? s : 1 - s;
      const vFrac = (at - 0.68) / 0.32;
      return [zRect.x + uFrac * zRect.w, zRect.y + vFrac * zRect.h];
    }
    if (s < 0.36) {
      const zRect = s < 0.08 ? zones.frontBumper : zones.hood;
      const uFrac = (t / 0.68) * 0.5 + 0.5;
      const vFrac = s < 0.08 ? s / 0.08 : (s - 0.08) / 0.28;
      return [zRect.x + uFrac * zRect.w, zRect.y + vFrac * zRect.h];
    }
    if (s < 0.70) {
      const uFrac = (t / 0.68) * 0.5 + 0.5;
      const vFrac = (s - 0.36) / 0.34;
      return [zones.roof.x + uFrac * zones.roof.w, zones.roof.y + vFrac * zones.roof.h];
    }
    const uFrac = (t / 0.68) * 0.5 + 0.5;
    const vFrac = (s - 0.70) / 0.30;
    return [zones.rearBumper.x + uFrac * zones.rearBumper.w, zones.rearBumper.y + vFrac * zones.rearBumper.h];
  };

  const isGlassCell = (s: number, t: number): boolean => {
    const at = Math.abs(t);
    if (isFormula) return s >= 0.42 && s <= 0.55 && at < 0.25;
    if (isGtp) return s >= 0.28 && s <= 0.54 && at < 0.42;
    const windshield = s >= 0.31 && s <= 0.46 && at < 0.55;
    const rearGlass = s >= 0.67 && s <= 0.83 && at < 0.49;
    const sideGlass = s >= 0.43 && s <= 0.71 && at >= 0.47 && at <= 0.67;
    return windshield || rearGlass || sideGlass;
  };

  // Build shared vertex grid so computeVertexNormals() produces silky smooth normals
  const cols = segT + 1;
  const totalVerts = (segS + 1) * cols;
  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  for (let is = 0; is <= segS; is++) {
    const s = is / segS;
    for (let it = 0; it <= segT; it++) {
      const t = -1 + (2 * it) / segT;
      const idx = is * cols + it;
      const [px, py, pz] = evalVertex(is, it);
      positions[idx * 3] = px;
      positions[idx * 3 + 1] = py;
      positions[idx * 3 + 2] = pz;
      const [u, v] = evalUv(s, t);
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = v;
    }
  }

  const paintIndices: number[] = [];
  const glassIndices: number[] = [];
  for (let is = 0; is < segS; is++) {
    const sm = (is + 0.5) / segS;
    for (let it = 0; it < segT; it++) {
      const tm = -1 + (2 * (it + 0.5)) / segT;
      const a = is * cols + it;
      const b = (is + 1) * cols + it;
      const c = (is + 1) * cols + (it + 1);
      const d = is * cols + (it + 1);
      const target = isGlassCell(sm, tm) ? glassIndices : paintIndices;
      target.push(a, b, c, a, c, d);
    }
  }

  const paintGeo = new THREE.BufferGeometry();
  paintGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  paintGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  paintGeo.setIndex(paintIndices);
  paintGeo.computeVertexNormals();

  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
  glassGeo.setAttribute("uv", new THREE.BufferAttribute(uvs.slice(), 2));
  glassGeo.setIndex(glassIndices);
  glassGeo.computeVertexNormals();

  return { paintGeo, glassGeo };
}

/**
 * High-detail 3D motorsport wheel built with LatheGeometry contoured slick tire,
 * deep-dish 10-spoke gunmetal alloy rim, ventilated brake rotor & brake caliper.
 */
function buildDetailedWheelMesh(
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  rotorMat: THREE.Material,
  caliperMat: THREE.Material,
  radius: number,
  width: number,
  isLeft: boolean,
): THREE.Group {
  const wheel = new THREE.Group();
  const hw = width * 0.5;
  const rInner = radius * 0.66;

  // Contoured slick tire profile via LatheGeometry
  const tirePts = [
    new THREE.Vector2(rInner, -hw * 0.94),
    new THREE.Vector2(radius * 0.94, -hw),
    new THREE.Vector2(radius, -hw * 0.80),
    new THREE.Vector2(radius, hw * 0.80),
    new THREE.Vector2(radius * 0.94, hw),
    new THREE.Vector2(rInner, hw * 0.94),
  ];
  const tireGeo = new THREE.LatheGeometry(tirePts, 36);
  tireGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(tireGeo, tireMat));

  // Alloy rim barrel
  const barrelGeo = new THREE.CylinderGeometry(rInner, rInner, width * 0.92, 28, 1, true);
  barrelGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(barrelGeo, rimMat));

  // Ventilated brake rotor inside
  const rotorGeo = new THREE.CylinderGeometry(rInner * 0.82, rInner * 0.82, 0.035, 24);
  rotorGeo.rotateZ(Math.PI / 2);
  const rotor = new THREE.Mesh(rotorGeo, rotorMat);
  rotor.position.x = (isLeft ? 1 : -1) * (hw * 0.12);
  wheel.add(rotor);

  // Brake caliper
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, rInner * 0.52, rInner * 0.34), caliperMat);
  caliper.position.set((isLeft ? -1 : 1) * (hw * 0.06), 0.02, -rInner * 0.52);
  wheel.add(caliper);

  // Center-lock hub + 10 sculpted spokes
  const outDir = isLeft ? -1 : 1;
  const hubGeo = new THREE.CylinderGeometry(radius * 0.19, radius * 0.19, width * 0.45, 18);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, caliperMat);
  hub.position.x = outDir * (hw * 0.32);
  wheel.add(hub);

  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.022, rInner * 0.94, 0.022), rimMat);
    spoke.position.set(
      outDir * (hw * 0.44),
      Math.cos(angle) * (rInner * 0.46),
      Math.sin(angle) * (rInner * 0.46),
    );
    spoke.rotation.x = angle;
    wheel.add(spoke);
  }
  return wheel;
}

export class WebGLPreviewEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;

  private paintMaterial: THREE.MeshPhysicalMaterial | null = null;
  private glassMaterial: THREE.MeshPhysicalMaterial | null = null;
  private carbonMaterial: THREE.MeshStandardMaterial | null = null;
  private rimMaterial: THREE.MeshStandardMaterial | null = null;
  private rotorMaterial: THREE.MeshStandardMaterial | null = null;
  private caliperMaterial: THREE.MeshStandardMaterial | null = null;
  private headLightMat: THREE.MeshBasicMaterial | null = null;
  private tailLightMat: THREE.MeshBasicMaterial | null = null;

  private diffuseTexture: THREE.CanvasTexture | null = null;
  private carbonBumpTexture: THREE.CanvasTexture | null = null;
  private specPackedCanvas: HTMLCanvasElement;
  private specPackedTexture: THREE.CanvasTexture | null = null;

  private carGroup: THREE.Group | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  private currentCategory: CarBodyCategory = "gt3";
  private currentZones: Record<ZoneKey, UvRect> = DEFAULT_CAR_ZONES;
  private currentLighting: LightingPreset = "noon";
  private isCustomModel = false;
  private meshLabel = "Coche 3D GT3 esculpido (Three.js PBR)";
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.specPackedCanvas = document.createElement("canvas");
    this.specPackedCanvas.width = 256;
    this.specPackedCanvas.height = 256;
    this.initThree();
  }

  private initThree(): void {
    try {
      const renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.22;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer = renderer;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#070b11");
      scene.fog = new THREE.Fog("#070b11", 9, 24);
      this.scene = scene;

      // High-contrast Studio IBL reflections via PMREMGenerator + RoomEnvironment
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
      pmrem.dispose();

      const camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.1, 60);
      camera.position.set(2.95, 1.32, 3.15);
      this.camera = camera;

      const controls = new OrbitControls(camera, this.canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 2.0;
      controls.maxDistance = 8.5;
      controls.maxPolarAngle = Math.PI * 0.485;
      controls.target.set(0, 0.1, 0);
      controls.update();
      this.controls = controls;

      // Multi-point studio lights
      this.hemiLight = new THREE.HemisphereLight("#e0f2fe", "#0f172a", 1.0);
      scene.add(this.hemiLight);

      this.keyLight = new THREE.DirectionalLight("#fff8ec", 2.7);
      this.keyLight.position.set(4.5, 7.2, 4.4);
      scene.add(this.keyLight);

      this.fillLight = new THREE.DirectionalLight("#38bdf8", 1.25);
      this.fillLight.position.set(-4.8, 3.4, -3.6);
      scene.add(this.fillLight);

      this.rimLight = new THREE.DirectionalLight("#ffffff", 1.15);
      this.rimLight.position.set(0, 4.2, -5.8);
      scene.add(this.rimLight);

      // Showroom turntable floor + contact shadow disc + subtle emerald grid
      const floorGeo = new THREE.CircleGeometry(9.5, 64);
      floorGeo.rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(
        floorGeo,
        new THREE.MeshStandardMaterial({ color: "#0b111a", roughness: 0.34, metalness: 0.22 }),
      );
      floor.position.y = -0.325;
      scene.add(floor);

      // Soft contact shadow directly beneath chassis
      const shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = 128;
      shadowCanvas.height = 128;
      const sctx = shadowCanvas.getContext("2d");
      if (sctx) {
        const g = sctx.createRadialGradient(64, 64, 14, 64, 64, 62);
        g.addColorStop(0, "rgba(0,0,0,0.88)");
        g.addColorStop(0.6, "rgba(0,0,0,0.45)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, 128, 128);
      }
      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 4.7),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = -0.321;
      scene.add(shadowPlane);

      const grid = new THREE.GridHelper(12, 24, "#00e699", "#172230");
      grid.position.y = -0.323;
      const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMats.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.20;
      });
      scene.add(grid);

      this.carbonBumpTexture = createCarbonBumpTexture();

      // Shared high-gloss PBR materials
      this.paintMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.32,
        metalness: 0.28,
        clearcoat: 0.9,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.55,
        bumpScale: 0.008,
        side: THREE.DoubleSide,
      });

      this.glassMaterial = new THREE.MeshPhysicalMaterial({
        color: "#060c14",
        roughness: 0.04,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        envMapIntensity: 2.1,
        side: THREE.DoubleSide,
      });

      this.carbonMaterial = new THREE.MeshStandardMaterial({
        color: "#11161f",
        roughness: 0.58,
        metalness: 0.2,
        bumpMap: this.carbonBumpTexture,
        bumpScale: 0.006,
      });

      this.rimMaterial = new THREE.MeshStandardMaterial({
        color: "#b4becb",
        roughness: 0.20,
        metalness: 0.92,
        envMapIntensity: 1.6,
      });

      this.rotorMaterial = new THREE.MeshStandardMaterial({
        color: "#6b7280",
        roughness: 0.38,
        metalness: 0.85,
      });

      this.caliperMaterial = new THREE.MeshStandardMaterial({
        color: "#00e699",
        roughness: 0.32,
        metalness: 0.55,
      });

      this.headLightMat = new THREE.MeshBasicMaterial({ color: "#f8fafc" });
      this.tailLightMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });

      this.setLightingPreset("noon");
      this.rebuildParametricCar();
      this.startLoop();
    } catch {
      this.renderer = null;
    }
  }

  private startLoop(): void {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      if (this.controls) this.controls.update();
      this.render();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private clearCarGroup(): void {
    if (!this.scene || !this.carGroup) return;
    this.scene.remove(this.carGroup);
    this.carGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        obj.geometry.dispose();
      }
    });
    this.carGroup = null;
  }

  private rebuildParametricCar(): void {
    if (
      !this.scene ||
      !this.paintMaterial ||
      !this.glassMaterial ||
      !this.carbonMaterial ||
      !this.rimMaterial ||
      !this.rotorMaterial ||
      !this.caliperMaterial ||
      !this.headLightMat ||
      !this.tailLightMat
    ) {
      return;
    }
    this.clearCarGroup();

    const group = new THREE.Group();
    const z = this.currentZones;
    const cat = this.currentCategory;

    const { paintGeo, glassGeo } = buildSculptedBodyGeometries(cat, z);
    group.add(new THREE.Mesh(paintGeo, this.paintMaterial));
    group.add(new THREE.Mesh(glassGeo, this.glassMaterial));

    const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, pz: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, pz);
      group.add(m);
    };

    if (cat === "formula") {
      // Sculpted multi-element airfoil front wing + endplates
      addPart(createAirfoilWingGeometry(1.66, 0.36, 0.04, z.frontBumper), this.paintMaterial, 0, -0.18, 1.98);
      addPart(new THREE.BoxGeometry(0.03, 0.22, 0.44), this.carbonMaterial, -0.84, -0.12, 1.96);
      addPart(new THREE.BoxGeometry(0.03, 0.22, 0.44), this.carbonMaterial, 0.84, -0.12, 1.96);

      // Curved Halo built with CatmullRomCurve3 + TubeGeometry
      const haloCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.22, 0.22, -0.16),
        new THREE.Vector3(-0.24, 0.30, 0.14),
        new THREE.Vector3(0, 0.32, 0.38),
        new THREE.Vector3(0.24, 0.30, 0.14),
        new THREE.Vector3(0.22, 0.22, -0.16),
      ]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(haloCurve, 24, 0.022, 10, false), this.carbonMaterial));
      addPart(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 10), this.carbonMaterial, 0, 0.24, 0.38);

      // Cambered airfoil rear wing + endplates
      addPart(createAirfoilWingGeometry(1.08, 0.32, 0.045, z.rearWing), this.paintMaterial, 0, 0.56, -1.86);
      addPart(new THREE.BoxGeometry(0.03, 0.40, 0.40), this.carbonMaterial, -0.55, 0.43, -1.86);
      addPart(new THREE.BoxGeometry(0.03, 0.40, 0.40), this.carbonMaterial, 0.55, 0.43, -1.86);

      // 4 Exposed open wheels + double wishbone suspension
      const wheels: Array<[number, number, boolean]> = [
        [-0.86, 1.18, true], [0.86, 1.18, false],
        [-0.88, -1.16, true], [0.88, -1.16, false],
      ];
      for (const [wx, wz, isLeft] of wheels) {
        const w = buildDetailedWheelMesh(this.carbonMaterial, this.rimMaterial, this.rotorMaterial, this.caliperMaterial, 0.30, 0.30, isLeft);
        w.position.set(wx, -0.02, wz);
        group.add(w);
        addPart(new THREE.BoxGeometry(0.76, 0.02, 0.035), this.carbonMaterial, wx * 0.5, 0.03, wz);
        addPart(new THREE.BoxGeometry(0.76, 0.02, 0.035), this.carbonMaterial, wx * 0.5, -0.07, wz);
      }
    } else {
      const isGtp = cat === "gtp";
      const isTouring = cat === "touring";

      // Carbon front splitter + intake grille + floor
      addPart(new THREE.BoxGeometry(1.76, 0.035, 0.36), this.carbonMaterial, 0, -0.25, isGtp ? 1.94 : 1.85);
      addPart(new THREE.BoxGeometry(1.16, 0.12, 0.08), this.carbonMaterial, 0, -0.12, isGtp ? 1.94 : 1.88);
      addPart(new THREE.BoxGeometry(1.70, 0.04, 3.55), this.carbonMaterial, 0, -0.25, 0);

      // Multi-fin carbon rear diffuser (4 vertical aero strakes)
      const diffZ = isGtp ? -1.88 : -1.80;
      addPart(new THREE.BoxGeometry(1.62, 0.11, 0.26), this.carbonMaterial, 0, -0.22, diffZ);
      for (const fx of [-0.52, -0.18, 0.18, 0.52]) {
        addPart(new THREE.BoxGeometry(0.025, 0.15, 0.28), this.carbonMaterial, fx, -0.21, diffZ - 0.03);
      }

      // Hood aero extraction vent (GT3 / GTP)
      if (!isTouring) {
        addPart(new THREE.BoxGeometry(0.56, 0.022, 0.32), this.carbonMaterial, 0, 0.165, 1.06);
      }

      // A-Pillars & C-Pillars defining the cabin greenhouse on GT3 / Touring
      if (!isGtp) {
        const roofY = isTouring ? 0.61 : 0.52;
        for (const sgn of [-1, 1]) {
          const aPillar = new THREE.CatmullRomCurve3([
            new THREE.Vector3(sgn * 0.68, 0.24, 0.68),
            new THREE.Vector3(sgn * 0.52, roofY - 0.02, 0.14),
          ]);
          group.add(new THREE.Mesh(new THREE.TubeGeometry(aPillar, 10, 0.022, 8, false), this.carbonMaterial));

          const cPillar = new THREE.CatmullRomCurve3([
            new THREE.Vector3(sgn * 0.50, roofY - 0.04, -0.66),
            new THREE.Vector3(sgn * 0.68, 0.28, -1.28),
          ]);
          group.add(new THREE.Mesh(new THREE.TubeGeometry(cPillar, 10, 0.026, 8, false), this.carbonMaterial));
        }
      }

      // Sleek LED headlights & full-width taillight accents
      addPart(new THREE.BoxGeometry(0.32, 0.042, 0.12), this.headLightMat, -0.56, 0.07, isGtp ? 1.91 : 1.84);
      addPart(new THREE.BoxGeometry(0.32, 0.042, 0.12), this.headLightMat, 0.56, 0.07, isGtp ? 1.91 : 1.84);
      addPart(new THREE.BoxGeometry(0.42, 0.042, 0.06), this.tailLightMat, -0.54, 0.16, isGtp ? -1.94 : -1.86);
      addPart(new THREE.BoxGeometry(0.42, 0.042, 0.06), this.tailLightMat, 0.54, 0.16, isGtp ? -1.94 : -1.86);

      // Sculpted aerodynamic side mirrors
      addPart(createZoneBox(0.16, 0.065, 0.11, z.mirrors), this.paintMaterial, -0.92, 0.26, 0.44);
      addPart(createZoneBox(0.16, 0.065, 0.11, z.mirrors), this.paintMaterial, 0.92, 0.26, 0.44);

      // GTP Sculpted Dorsal Shark Fin (ExtrudeGeometry)
      if (isGtp) {
        addPart(createSharkFinGeometry(z.roof), this.paintMaterial, 0, 0.26, -1.16);
      }

      // Rear Wing: Cambered Airfoil (ExtrudeGeometry) + Curved Swan-Neck Pylons (CatmullRomCurve3)
      if (isTouring) {
        addPart(createAirfoilWingGeometry(1.58, 0.22, 0.032, z.rearWing), this.paintMaterial, 0, 0.34, -1.75);
      } else {
        const wingY = isGtp ? 0.48 : 0.56;
        const wingZ = isGtp ? -1.86 : -1.76;
        addPart(createAirfoilWingGeometry(1.76, 0.32, 0.045, z.rearWing), this.paintMaterial, 0, wingY, wingZ);
        addPart(new THREE.BoxGeometry(0.028, 0.25, 0.38), this.carbonMaterial, -0.89, wingY - 0.02, wingZ);
        addPart(new THREE.BoxGeometry(0.028, 0.25, 0.38), this.carbonMaterial, 0.89, wingY - 0.02, wingZ);

        // Curved swan-neck wing pylons arching over the top of the airfoil
        for (const px of [-0.34, 0.34]) {
          const swanCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(px, 0.22, wingZ + 0.16),
            new THREE.Vector3(px, wingY + 0.04, wingZ + 0.14),
            new THREE.Vector3(px, wingY + 0.045, wingZ + 0.02),
            new THREE.Vector3(px, wingY + 0.01, wingZ - 0.02),
          ]);
          group.add(new THREE.Mesh(new THREE.TubeGeometry(swanCurve, 16, 0.018, 8, false), this.carbonMaterial));
        }
      }

      // 4 High-detail LatheGeometry racing wheels
      const wheelZFront = isGtp ? 1.18 : 1.12;
      const wheelZRear = isGtp ? -1.16 : -1.06;
      const wheelSpecs: Array<[number, number, boolean]> = [
        [-0.82, wheelZFront, true], [0.82, wheelZFront, false],
        [-0.85, wheelZRear, true], [0.85, wheelZRear, false],
      ];
      for (const [wx, wz, isLeft] of wheelSpecs) {
        const w = buildDetailedWheelMesh(this.carbonMaterial, this.rimMaterial, this.rotorMaterial, this.caliperMaterial, 0.285, 0.27, isLeft);
        w.position.set(wx, -0.04, wz);
        group.add(w);
      }
    }

    this.carGroup = group;
    this.scene.add(group);
    this.isCustomModel = false;
    const catName =
      cat === "gtp" ? "Prototype / GTP" : cat === "formula" ? "Fórmula" : cat === "touring" ? "Touring / Stock" : "GT3 / GT4";
    this.meshLabel = `Coche 3D ${catName} esculpido (Three.js PBR · reflejos reales)`;
  }

  public setCategory(category: CarBodyCategory): void {
    if (this.currentCategory === category && !this.isCustomModel) return;
    this.currentCategory = category;
    if (!this.isCustomModel) {
      this.rebuildParametricCar();
    }
  }

  public updateZones(zones: Record<ZoneKey, ZoneRect>): void {
    this.currentZones = normalizeZones(zones);
    if (!this.isCustomModel) {
      this.rebuildParametricCar();
    }
  }

  public setLightingPreset(preset: LightingPreset): void {
    this.currentLighting = preset;
    if (!this.scene || !this.renderer || !this.keyLight || !this.fillLight || !this.hemiLight || !this.rimLight) return;

    if (preset === "sunset") {
      this.scene.background = new THREE.Color("#140d1a");
      this.scene.fog = new THREE.Fog("#140d1a", 9, 24);
      this.keyLight.color.set("#ff984f");
      this.keyLight.intensity = 3.2;
      this.keyLight.position.set(6.5, 2.2, 3.4);
      this.fillLight.color.set("#6366f1");
      this.fillLight.intensity = 1.5;
      this.fillLight.position.set(-5.0, 2.8, -3.5);
      this.rimLight.color.set("#fbbf24");
      this.rimLight.intensity = 1.4;
      this.hemiLight.color.set("#fdba74");
      this.hemiLight.groundColor.set("#1e1b4b");
      this.hemiLight.intensity = 0.9;
      this.renderer.toneMappingExposure = 1.25;
    } else if (preset === "overcast") {
      this.scene.background = new THREE.Color("#0d141e");
      this.scene.fog = new THREE.Fog("#0d141e", 10, 26);
      this.keyLight.color.set("#e2e8f0");
      this.keyLight.intensity = 1.65;
      this.keyLight.position.set(2.0, 8.5, 2.0);
      this.fillLight.color.set("#cbd5e1");
      this.fillLight.intensity = 1.45;
      this.fillLight.position.set(-3.5, 5.0, -3.0);
      this.rimLight.color.set("#e2e8f0");
      this.rimLight.intensity = 1.0;
      this.hemiLight.color.set("#f1f5f9");
      this.hemiLight.groundColor.set("#1e293b");
      this.hemiLight.intensity = 1.45;
      this.renderer.toneMappingExposure = 1.15;
    } else {
      // Noon (Mediodía)
      this.scene.background = new THREE.Color("#070b11");
      this.scene.fog = new THREE.Fog("#070b11", 9, 24);
      this.keyLight.color.set("#fff9ee");
      this.keyLight.intensity = 2.75;
      this.keyLight.position.set(4.5, 7.2, 4.4);
      this.fillLight.color.set("#38bdf8");
      this.fillLight.intensity = 1.25;
      this.fillLight.position.set(-4.8, 3.4, -3.6);
      this.rimLight.color.set("#ffffff");
      this.rimLight.intensity = 1.2;
      this.hemiLight.color.set("#e0f2fe");
      this.hemiLight.groundColor.set("#0f172a");
      this.hemiLight.intensity = 1.0;
      this.renderer.toneMappingExposure = 1.22;
    }
  }

  public getLightingPreset(): LightingPreset {
    return this.currentLighting;
  }

  public setCameraPreset(preset: "front34" | "side" | "rear34" | "top"): void {
    if (!this.camera || !this.controls) return;
    if (preset === "front34") {
      this.camera.position.set(2.95, 1.32, 3.15);
    } else if (preset === "side") {
      this.camera.position.set(4.5, 0.92, 0.05);
    } else if (preset === "rear34") {
      this.camera.position.set(-2.95, 1.38, -3.15);
    } else if (preset === "top") {
      this.camera.position.set(0.05, 5.0, 0.2);
    }
    this.controls.target.set(0, 0.1, 0);
    this.controls.update();
  }

  /**
   * Connects both the main Paint <canvas> and the iRacing Spec Map <canvas> as live THREE.CanvasTexture,
   * plus toggles 3D twill carbon fiber bumpMap when Carbon finish/weave is active.
   */
  public updateTexture(
    diffuseCanvas: HTMLCanvasElement,
    metallicPct: number,
    roughnessPct: number,
    specCanvas?: HTMLCanvasElement | null,
    clearcoatPct = 80,
    carbonWeave = false,
  ): void {
    if (!this.paintMaterial) return;

    if (!this.diffuseTexture || this.diffuseTexture.image !== diffuseCanvas) {
      this.diffuseTexture?.dispose();
      const tex = new THREE.CanvasTexture(diffuseCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.anisotropy = 4;
      this.diffuseTexture = tex;
      this.paintMaterial.map = tex;
      this.paintMaterial.needsUpdate = true;
    } else {
      this.diffuseTexture.needsUpdate = true;
    }

    if (specCanvas) {
      const ctx = this.specPackedCanvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(specCanvas, 0, 0, 256, 256);
        const img = ctx.getImageData(0, 0, 256, 256);
        const d = img.data;
        // Remap iRacing (R=Metallic, G=Roughness, B=Clearcoat) -> Three.js (G=Roughness, B=Metallic)
        for (let i = 0; i < d.length; i += 4) {
          const irMetallic = d[i];
          const irRoughness = d[i + 1];
          d[i] = 255;
          d[i + 1] = irRoughness;
          d[i + 2] = irMetallic;
          d[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);

        if (!this.specPackedTexture) {
          const stex = new THREE.CanvasTexture(this.specPackedCanvas);
          stex.flipY = false;
          this.specPackedTexture = stex;
          this.paintMaterial.roughnessMap = stex;
          this.paintMaterial.metalnessMap = stex;
          this.paintMaterial.needsUpdate = true;
        } else {
          this.specPackedTexture.needsUpdate = true;
        }
        this.paintMaterial.roughness = 1.0;
        this.paintMaterial.metalness = 1.0;
      }
    } else {
      this.paintMaterial.roughness = Math.max(0.05, Math.min(1, roughnessPct / 100));
      this.paintMaterial.metalness = Math.max(0, Math.min(1, metallicPct / 100));
    }

    const wantBump = carbonWeave ? this.carbonBumpTexture : null;
    if (this.paintMaterial.bumpMap !== wantBump) {
      this.paintMaterial.bumpMap = wantBump;
      this.paintMaterial.needsUpdate = true;
    }

    this.paintMaterial.clearcoat = Math.max(0, Math.min(1, clearcoatPct / 100));
    this.paintMaterial.clearcoatRoughness = Math.max(0.04, Math.min(0.85, (roughnessPct / 100) * 0.42));
  }

  public async loadGltfFile(file: File): Promise<void> {
    if (!this.scene || !this.paintMaterial) throw new Error("Visor Three.js no inicializado.");
    const blobUrl = URL.createObjectURL(file);
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(blobUrl);
      const root = gltf.scene;

      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxSpan = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3.85 / maxSpan;
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -box.min.y * scale - 0.32, -center.z * scale);

      const paintMat = this.paintMaterial;
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const n = (obj.name || "").toLowerCase();
          if (!/glass|window|windshield|tire|tyre|wheel|rim|brake/.test(n)) {
            obj.material = paintMat;
          }
        }
      });

      this.clearCarGroup();
      const wrapper = new THREE.Group();
      wrapper.add(root);
      this.carGroup = wrapper;
      this.scene.add(wrapper);
      this.isCustomModel = true;
      this.meshLabel = `Modelo 3D local cargado: ${file.name} (solo en tu navegador)`;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  public loadObjMesh(objText: string, filename: string): void {
    if (!this.scene || !this.paintMaterial) return;
    const verts: Array<[number, number, number]> = [];
    const texs: Array<[number, number]> = [];
    const norms: Array<[number, number, number]> = [];
    const outPos: number[] = [], outUv: number[] = [], outNorm: number[] = [];

    for (const raw of objText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split(/\s+/);
      if (parts[0] === "v" && parts.length >= 4) verts.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
      else if (parts[0] === "vt" && parts.length >= 3) texs.push([Number(parts[1]), 1 - Number(parts[2])]);
      else if (parts[0] === "vn" && parts.length >= 4) norms.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
      else if (parts[0] === "f" && parts.length >= 4) {
        const fvs = parts.slice(1).map((tok) => {
          const [vi, ti, ni] = tok.split("/").map((n) => (n ? parseInt(n, 10) : 0));
          return { vi, ti, ni };
        });
        for (let i = 1; i + 1 < fvs.length; i++) {
          for (const fv of [fvs[0], fvs[i], fvs[i + 1]]) {
            const v = verts[fv.vi > 0 ? fv.vi - 1 : verts.length + fv.vi] ?? [0, 0, 0];
            const t = fv.ti ? texs[fv.ti > 0 ? fv.ti - 1 : texs.length + fv.ti] ?? [0, 0] : [0, 0];
            const n = fv.ni ? norms[fv.ni > 0 ? fv.ni - 1 : norms.length + fv.ni] ?? [0, 1, 0] : [0, 1, 0];
            outPos.push(...v);
            outUv.push(...t);
            outNorm.push(...n);
          }
        }
      }
    }
    if (outPos.length < 9) throw new Error("El archivo .OBJ no contiene geometría válida.");

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(outPos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(outUv, 2));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(outNorm, 3));
    geo.center();
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (bb) {
      const sz = new THREE.Vector3();
      bb.getSize(sz);
      const s = 3.85 / (Math.max(sz.x, sz.y, sz.z) || 1);
      geo.scale(s, s, s);
      geo.translate(0, -bb.min.y * s - 0.32, 0);
    }

    this.clearCarGroup();
    const wrapper = new THREE.Group();
    wrapper.add(new THREE.Mesh(geo, this.paintMaterial));
    this.carGroup = wrapper;
    this.scene.add(wrapper);
    this.isCustomModel = true;
    this.meshLabel = `Malla .OBJ local: ${filename}`;
  }

  public resetToProofingBuck(): void {
    this.isCustomModel = false;
    this.rebuildParametricCar();
  }

  public getMeshLabel(): string {
    return this.meshLabel;
  }

  public render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(300, Math.round(rect.width));
    const h = Math.max(240, Math.round(rect.height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.controls?.dispose();
    this.diffuseTexture?.dispose();
    this.carbonBumpTexture?.dispose();
    this.specPackedTexture?.dispose();
    this.renderer?.dispose();
  }
}
