/**
 * Studio-Grade 2D -> 3D Motorsport Showroom Engine powered by Three.js for skins.muntru.me.
 * - Zero hardcoded external car GLB (no Ferrari/convertible). Renders clean closed parametric
 *   bodywork matching the selected category (GT3, GTP, Formula, Touring) centered at (0,0,0) on y=0.
 * - Loads real user-provided .GLB / .GLTF / .OBJ models (including auto-restore from IndexedDB)
 *   with automatic sub-mesh classification (body paint vs glass, tires, rims, brakes, lights, carbon)
 *   and scene.traverse sanitization to remove any floating/detached meshes.
 * - Real-time UV Mapping Mode switcher:
 *   * "native": preserves the .GLB's original UV coordinates.
 *   * "autofit": projects bodywork faces (hood, roof, left/right side, front/rear bumper, rear wing)
 *     directly onto the calibrated iRacing UV zone rectangles from src/data/uv-maps/<car_slug>.json.
 * - Connects live 2D Paint Canvas + Spec Map (Metallic, Roughness, Clearcoat, Carbon) to
 *   MeshPhysicalMaterial with RoomEnvironment (PMREMGenerator) studio reflections.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ZoneKey, ZoneRect } from "./types";

export type CarBodyCategory = "gt3" | "gtp" | "formula" | "touring";
export type LightingPreset = "noon" | "sunset" | "overcast";
export type UvMappingMode = "native" | "autofit";

type UvRect = Pick<ZoneRect, "x" | "y" | "w" | "h">;

const DEFAULT_ZONES: Record<ZoneKey, UvRect> = {
  hood: { x: 0.30, y: 0.06, w: 0.40, h: 0.24 },
  roof: { x: 0.34, y: 0.33, w: 0.32, h: 0.22 },
  leftSide: { x: 0.03, y: 0.32, w: 0.27, h: 0.44 },
  rightSide: { x: 0.70, y: 0.32, w: 0.27, h: 0.44 },
  rearWing: { x: 0.28, y: 0.80, w: 0.44, h: 0.12 },
  mirrors: { x: 0.05, y: 0.08, w: 0.18, h: 0.10 },
  frontBumper: { x: 0.26, y: 0.58, w: 0.48, h: 0.11 },
  rearBumper: { x: 0.26, y: 0.70, w: 0.48, h: 0.09 },
  numberPlateLeft: { x: 0.10, y: 0.47, w: 0.12, h: 0.12 },
  numberPlateRight: { x: 0.78, y: 0.47, w: 0.12, h: 0.12 },
};

export function mapCategoryStringToBody(category?: string): CarBodyCategory {
  const c = String(category || "").toLowerCase();
  if (c.includes("gtp") || c.includes("lmp") || c.includes("proto")) return "gtp";
  if (c.includes("fórmula") || c.includes("formula") || c.includes("indy") || c.includes("open")) return "formula";
  if (c.includes("tcr") || c.includes("touring") || c.includes("stock") || c.includes("nascar") || c.includes("arca") || c.includes("dirt")) return "touring";
  return "gt3";
}

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
  tex.repeat.set(22, 22);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 256, 20, 128, 256, 220);
    grad.addColorStop(0, "rgba(0,0,0,0.72)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.36)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Classifies a sub-mesh of a real .GLB/.GLTF car model so only exterior bodywork panels
 * receive the live iRacing paint & Spec Map while glass, tires, rims, brakes, lights and
 * carbon/interior parts keep realistic physical materials.
 */
function classifyMeshPart(mesh: THREE.Mesh): "paint" | "glass" | "tire" | "rim" | "brake" | "light" | "carbon" {
  const matName =
    !Array.isArray(mesh.material) && mesh.material && "name" in mesh.material
      ? String(mesh.material.name || "").toLowerCase()
      : "";
  const id = `${(mesh.name || "").toLowerCase()} ${matName}`;

  if (/\b(glass|window|windshield|windscreen|visor|cockpit_glass|transparent)\b/.test(id)) return "glass";
  if (/\b(tire|tyre|rubber|slick|tread)\b/.test(id)) return "tire";
  if (/\b(rim|wheel|alloy|spoke|hub|centerlock|nut)\b/.test(id)) return "rim";
  if (/\b(brake|caliper|disc|rotor)\b/.test(id)) return "brake";
  if (/\b(light|headlight|taillight|lamp|led|lens|indicator|emissive)\b/.test(id)) return "light";
  if (/\b(carbon|splitter|diffuser|grille|grill|mesh|vent|intake|interior|cockpit|seat|dash|steering|chassis|frame|exhaust|pipe|underbody|floor|strut|pylon|cage|rollcage|net|mirror_glass|black|plastic|trim)\b/.test(id)) {
    return "carbon";
  }
  return "paint";
}

/**
 * Projects each vertex of a painted bodywork mesh onto the exact calibrated iRacing UV zone
 * rectangle (hood, roof, leftSide, rightSide, frontBumper, rearBumper, rearWing) based on
 * 3D surface normal and normalized car position.
 */
function applyIracingAutoFitUVs(
  mesh: THREE.Mesh,
  carBox: THREE.Box3,
  zones: Record<ZoneKey, UvRect>,
): void {
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  if (!pos) return;
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  const norm = geo.getAttribute("normal");

  const min = carBox.min;
  const max = carBox.max;
  const spanX = Math.max(0.001, max.x - min.x);
  const spanY = Math.max(0.001, max.y - min.y);
  const spanZ = Math.max(0.001, max.z - min.z);

  // Determine whether the car's longitudinal axis is Z (standard) or X
  const longIsZ = spanZ >= spanX;

  mesh.updateWorldMatrix(true, false);
  const normalMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const uvArr = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(norm, i).applyMatrix3(normalMat).normalize();

    // Normalized longitudinal (0=rear -Z, 1=front +Z), lateral (0=-X, 1=+X), vertical (0=bottom, 1=top)
    const along = longIsZ ? (v.z - min.z) / spanZ : (v.x - min.x) / spanX;
    const across = longIsZ ? (v.x - min.x) / spanX : (v.z - min.z) / spanZ;
    const up = (v.y - min.y) / spanY;

    const latNormal = longIsZ ? n.x : n.z;
    const absLat = Math.abs(latNormal);
    const absLong = Math.abs(longIsZ ? n.z : n.x);
    const absUp = Math.abs(n.y);

    let zone: UvRect;
    let lu = 0.5;
    let lv = 0.5;

    // With CanvasTexture.flipY = false:
    // u = 0..1 goes LEFT -> RIGHT on the 2D canvas, v = 0..1 goes TOP -> BOTTOM on the 2D canvas.
    // Every surface below maps its outward viewer-left -> viewer-right to lu = 0 -> 1,
    // and viewer-top -> viewer-bottom to lv = 0 -> 1 so text/logos NEVER mirror or invert.
    const isRearWingMesh = mesh.name.includes("rear_wing");
    if (isRearWingMesh || (up > 0.72 && along < 0.19)) {
      // Rear wing (viewed from rear 3/4: -X is left, +X is right)
      zone = zones.rearWing;
      lu = across;
      lv = 1 - Math.max(0, Math.min(1, along / 0.19));
    } else if (absLong > absLat && absLong > absUp && along > 0.84) {
      // Front bumper (+Z face, viewed from front: +X is left, -X is right)
      zone = zones.frontBumper;
      lu = 1 - across;
      lv = 1 - up;
    } else if (absLong > absLat && absLong > absUp && along < 0.15) {
      // Rear bumper (-Z face, viewed from rear: -X is left, +X is right)
      zone = zones.rearBumper;
      lu = across;
      lv = 1 - up;
    } else if (absLat > absUp * 0.85 && (across < 0.46 || across > 0.54)) {
      // Left side (+X face: viewer's left is +Z front, right is -Z rear -> lu = 1 - along)
      // Right side (-X face: viewer's left is -Z rear, right is +Z front -> lu = along)
      const isDriverLeft = longIsZ ? latNormal >= 0 : across >= 0.5;
      zone = isDriverLeft ? zones.leftSide : zones.rightSide;
      lu = isDriverLeft ? 1 - along : along;
      lv = 1 - up;
    } else if (along > 0.54) {
      // Hood (viewed from front 3/4: +X is left, -X is right; windshield is top, nose is bottom)
      zone = zones.hood;
      lu = 1 - across;
      lv = Math.max(0, Math.min(1, (along - 0.54) / 0.46));
    } else {
      // Roof & rear engine deck (viewed from front 3/4: +X is left, -X is right)
      zone = zones.roof;
      lu = 1 - across;
      lv = Math.max(0, Math.min(1, (along - 0.12) / 0.44));
    }

    const u = Math.max(0.001, Math.min(0.999, zone.x + Math.max(0, Math.min(1, lu)) * zone.w));
    const w = Math.max(0.001, Math.min(0.999, zone.y + Math.max(0, Math.min(1, lv)) * zone.h));
    uvArr[i * 2] = u;
    uvArr[i * 2 + 1] = w;
  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gaussian(x: number, center: number, sigma: number): number {
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

/**
 * Generates a sleek, curved, multi-station lofted motorsport bodywork mesh (44 longitudinal
 * stations x 36 circumferential points) with flared wheel-arch haunches, Coke-bottle waist,
 * raked aerodynamic nose, sculpted shoulders, and continuous smooth vertex normals.
 */
function createLoftedMotorsportHull(category: CarBodyCategory): THREE.BufferGeometry {
  const isFormula = category === "formula";
  const isGtp = category === "gtp";
  const isTouring = category === "touring";

  const halfLen = isFormula ? 2.42 : isGtp ? 2.42 : 2.28;
  const baseHalfW = isFormula ? 0.58 : isGtp ? 0.98 : 0.96;

  const stations = 44;
  const ringPts = 36;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let si = 0; si <= stations; si++) {
    // t = 0 (rear tail) -> 1 (front nose)
    const t = si / stations;
    const z = -halfLen + t * halfLen * 2;

    // Smooth nose & tail taper
    const noseTaper = 1 - 0.22 * Math.pow(smoothstep(0.84, 1.0, t), 1.6);
    const tailTaper = 1 - 0.10 * Math.pow(1 - smoothstep(0.0, 0.14, t), 1.4);

    // Flared front & rear wheel arches + pinched waist
    const frontArch = gaussian(t, 0.78, 0.095);
    const rearArch = gaussian(t, 0.21, 0.105);
    const waistPinch = gaussian(t, 0.49, 0.14);

    let halfW: number;
    let floorY: number;
    let beltY: number;
    let roofY: number;
    let cabinHalfW: number;

    if (isFormula) {
      // Narrow pointed nose, sculpted sidepods mid-rear, tapered engine cover
      const sidepod = smoothstep(0.18, 0.34, t) * (1 - smoothstep(0.56, 0.70, t));
      halfW = (0.18 + 0.48 * sidepod + 0.14 * (1 - smoothstep(0.65, 0.98, t))) * noseTaper;
      floorY = 0.10 + 0.10 * smoothstep(0.82, 1.0, t) + 0.08 * (1 - smoothstep(0.0, 0.14, t));
      beltY = 0.34 + 0.24 * sidepod - 0.10 * smoothstep(0.76, 1.0, t);
      roofY =
        0.40 +
        0.54 * gaussian(t, 0.40, 0.15) -
        0.16 * smoothstep(0.72, 1.0, t) +
        0.10 * sidepod;
      cabinHalfW = Math.max(0.10, halfW * 0.46);
    } else if (isGtp) {
      // Low wide Le Mans Hypercar / GTP: dramatic wheel fenders + teardrop bubble canopy
      halfW = baseHalfW * (0.92 + 0.11 * frontArch + 0.12 * rearArch - 0.10 * waistPinch) * noseTaper * tailTaper;
      floorY = 0.11 + 0.05 * smoothstep(0.88, 1.0, t) + 0.10 * (1 - smoothstep(0.0, 0.12, t));
      beltY =
        0.54 +
        0.16 * frontArch +
        0.16 * rearArch -
        0.08 * waistPinch -
        0.20 * smoothstep(0.84, 1.0, t);
      const canopyBump = gaussian(t, 0.50, 0.18);
      roofY = Math.max(beltY + 0.04, 0.56 + 0.50 * canopyBump + 0.08 * rearArch - 0.22 * smoothstep(0.86, 1.0, t));
      cabinHalfW = halfW * (0.56 + 0.16 * (1 - canopyBump));
    } else {
      // Sculpted GT3 / Touring Coupe: sleek raked hood, muscular fenders, fastback greenhouse
      halfW = baseHalfW * (0.93 + 0.09 * frontArch + 0.10 * rearArch - 0.06 * waistPinch) * noseTaper * tailTaper;
      floorY = 0.13 + 0.04 * smoothstep(0.90, 1.0, t) + 0.08 * (1 - smoothstep(0.0, 0.10, t));
      beltY =
        0.66 +
        0.09 * frontArch +
        0.11 * rearArch -
        0.04 * waistPinch -
        0.26 * Math.pow(smoothstep(0.76, 1.0, t), 1.4);
      const cabinFactor =
        smoothstep(0.14, 0.34, t) * (1 - smoothstep(isTouring ? 0.68 : 0.64, 0.80, t));
      const crownHeight = isTouring ? 0.56 : 0.49;
      roofY =
        beltY +
        0.06 +
        crownHeight * Math.pow(cabinFactor, 0.85) -
        0.05 * smoothstep(0.88, 1.0, t);
      cabinHalfW = halfW * (1 - 0.28 * cabinFactor);
    }

    // Pinch to clean rounded nose & tail tips
    const endCapScale =
      si === 0 ? 0.18 : si === stations ? 0.15 : si === 1 || si === stations - 1 ? 0.72 : 1.0;

    for (let ri = 0; ri < ringPts; ri++) {
      // Angle around cross-section: 0 = top center, PI/2 = +X left, PI = bottom center, 3PI/2 = -X right
      const theta = (ri / ringPts) * Math.PI * 2;
      const s = Math.sin(theta);
      const c = Math.cos(theta);

      let x: number;
      let y: number;

      if (c >= 0) {
        // Upper half: smooth shoulder transition from beltline to crowned roof/hood
        const upT = Math.pow(c, 0.82);
        const wAtHeight = halfW * (1 - upT) + cabinHalfW * upT;
        const sideSign = Math.sign(s);
        x = sideSign * Math.pow(Math.abs(s), 0.78) * wAtHeight;
        y = beltY + upT * (roofY - beltY);
      } else {
        // Lower half: muscular vertical flank curving smoothly into the race floor
        const downT = Math.pow(-c, 0.72);
        const sideSign = Math.sign(s);
        const lowerW = halfW * (1 - 0.14 * downT);
        x = sideSign * Math.pow(Math.abs(s), 0.62) * lowerW;
        y = beltY - downT * (beltY - floorY);
      }

      if (endCapScale < 1) {
        const midY = (floorY + beltY) * 0.5;
        x *= endCapScale;
        y = midY + (y - midY) * endCapScale;
      }

      positions.push(x, y, z);
    }
  }

  for (let si = 0; si < stations; si++) {
    const rowA = si * ringPts;
    const rowB = (si + 1) * ringPts;
    for (let ri = 0; ri < ringPts; ri++) {
      const next = (ri + 1) % ringPts;
      const a = rowA + ri;
      const b = rowA + next;
      const c = rowB + next;
      const d = rowB + ri;
      indices.push(a, c, b);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved flush tinted glass canopy (windshield + side windows + fastback rear glass)
 * that conforms smoothly to the sculpted greenhouse instead of a flat box.
 */
function createLoftedCanopy(category: CarBodyCategory): THREE.BufferGeometry {
  const isGtp = category === "gtp";
  const isTouring = category === "touring";
  const zStart = isGtp ? -0.58 : -0.92;
  const zEnd = isGtp ? 0.86 : isTouring ? 0.92 : 0.86;
  const stations = 18;
  const arcPts = 18;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let si = 0; si <= stations; si++) {
    const t = si / stations;
    const z = zStart + t * (zEnd - zStart);
    const dome = Math.sin(t * Math.PI);
    const halfW = (isGtp ? 0.62 : 0.78) * (0.64 + 0.36 * Math.pow(dome, 0.55));
    const baseY = isGtp ? 0.66 : 0.75;
    const peakY = baseY + (isGtp ? 0.39 : isTouring ? 0.47 : 0.43) * Math.pow(dome, 0.68);

    for (let ai = 0; ai <= arcPts; ai++) {
      const u = ai / arcPts; // 0 = -X right edge, 1 = +X left edge
      const ang = (u - 0.5) * Math.PI; // -PI/2 -> +PI/2
      const x = Math.sin(ang) * halfW;
      const y = baseY + Math.pow(Math.cos(ang), 0.72) * (peakY - baseY);
      positions.push(x, y, z);
    }
  }

  const stride = arcPts + 1;
  for (let si = 0; si < stations; si++) {
    for (let ai = 0; ai < arcPts; ai++) {
      const a = si * stride + ai;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, b, c);
      indices.push(a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Extrudes a curved NACA-style racing wing airfoil blade.
 */
function createAirfoilWingGeometry(width: number, chord: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-chord / 2, 0);
  shape.quadraticCurveTo(-chord * 0.15, thickness * 1.15, chord / 2, thickness * 0.25);
  shape.quadraticCurveTo(0, -thickness * 0.45, -chord / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a realistic motorsport wheel assembly: rounded-sidewall slick tire (LatheGeometry),
 * deep-dish alloy barrel, 10 sculpted spokes, center-lock nut, ventilated brake disc & red caliper.
 */
function createMotorsportWheel(
  radius: number,
  width: number,
  isLeftSide: boolean,
  mats: {
    tire: THREE.Material;
    rim: THREE.Material;
    brake: THREE.Material;
    carbon: THREE.Material;
  },
): THREE.Group {
  const wheel = new THREE.Group();
  const hw = width / 2;
  const innerR = radius * 0.65;

  // Rounded slick tire profile via LatheGeometry (axis Y -> rotated to X)
  const tireProfile = [
    new THREE.Vector2(innerR, -hw * 0.92),
    new THREE.Vector2(radius * 0.96, -hw),
    new THREE.Vector2(radius, -hw * 0.78),
    new THREE.Vector2(radius, hw * 0.78),
    new THREE.Vector2(radius * 0.96, hw),
    new THREE.Vector2(innerR, hw * 0.92),
    new THREE.Vector2(innerR, -hw * 0.92),
  ];
  const tireGeo = new THREE.LatheGeometry(tireProfile, 36);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, mats.tire);
  tireMesh.name = "tire";
  wheel.add(tireMesh);

  // Deep-dish alloy barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(innerR, innerR, width * 0.88, 28, 1, true), mats.rim);
  barrel.rotation.z = Math.PI / 2;
  barrel.name = "rim_barrel";
  wheel.add(barrel);

  // Outer lip ring
  const lip = new THREE.Mesh(new THREE.TorusGeometry(innerR * 0.98, 0.018, 12, 32), mats.rim);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = (isLeftSide ? 1 : -1) * (hw * 0.86);
  lip.name = "rim_lip";
  wheel.add(lip);

  // 10 forged racing spokes
  const spokeOffsetX = (isLeftSide ? 1 : -1) * (hw * 0.68);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.022, innerR * 0.92, 0.028), mats.rim);
    spoke.position.set(spokeOffsetX, Math.cos(ang) * innerR * 0.46, Math.sin(ang) * innerR * 0.46);
    spoke.rotation.x = ang;
    spoke.name = "rim_spoke";
    wheel.add(spoke);
  }

  // Center-lock hub & anodized nut
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.06, 16), mats.carbon);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = spokeOffsetX;
  wheel.add(hub);

  const lockNut = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.08, 6), mats.brake);
  lockNut.rotation.z = Math.PI / 2;
  lockNut.position.x = spokeOffsetX + (isLeftSide ? 0.02 : -0.02);
  wheel.add(lockNut);

  // Brake rotor & red 6-piston caliper
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(innerR * 0.82, innerR * 0.82, 0.028, 24), mats.rim);
  rotor.rotation.z = Math.PI / 2;
  rotor.position.x = (isLeftSide ? -1 : 1) * 0.03;
  wheel.add(rotor);

  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.09), mats.brake);
  caliper.position.set((isLeftSide ? -1 : 1) * 0.03, 0.04, -innerR * 0.62);
  wheel.add(caliper);

  return wheel;
}

export class WebGLPreviewEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private carGroup: THREE.Group | null = null;

  private paintMaterial: THREE.MeshPhysicalMaterial | null = null;
  private glassMaterial: THREE.MeshPhysicalMaterial | null = null;
  private carbonMaterial: THREE.MeshStandardMaterial | null = null;
  private tireMaterial: THREE.MeshStandardMaterial | null = null;
  private rimMaterial: THREE.MeshStandardMaterial | null = null;
  private brakeMaterial: THREE.MeshStandardMaterial | null = null;
  private lightMaterial: THREE.MeshStandardMaterial | null = null;

  private diffuseTexture: THREE.CanvasTexture | null = null;
  private carbonBumpTexture: THREE.CanvasTexture | null = null;
  private specPackedCanvas: HTMLCanvasElement;
  private specPackedTexture: THREE.CanvasTexture | null = null;

  private keyLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  private rafId = 0;
  private currentCategory: CarBodyCategory = "gt3";
  private currentZones: Record<ZoneKey, UvRect> = { ...DEFAULT_ZONES };
  private uvMappingMode: UvMappingMode = "autofit";
  private hasCustomModel = false;
  private originalUvs = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();
  private meshLabel = "Carrocería GT3 cerrada PBR (carga tu .GLB / .GLTF real y se guarda en IndexedDB)";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.specPackedCanvas = document.createElement("canvas");
    this.specPackedCanvas.width = 256;
    this.specPackedCanvas.height = 256;
    this.initScene();
  }

  private initScene(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color("#0b1017");
      this.scene.fog = new THREE.Fog("#0b1017", 12, 26);

      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();

      this.camera = new THREE.PerspectiveCamera(36, 16 / 10, 0.1, 100);
      this.camera.position.set(3.9, 1.55, 4.3);

      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.065;
      this.controls.maxPolarAngle = Math.PI * 0.485;
      this.controls.minDistance = 2.6;
      this.controls.maxDistance = 10.5;
      this.controls.target.set(0, 0.55, 0);

      // Studio lights
      this.hemiLight = new THREE.HemisphereLight("#e2eeff", "#151b26", 0.8);
      this.scene.add(this.hemiLight);

      this.keyLight = new THREE.DirectionalLight("#ffffff", 2.2);
      this.keyLight.position.set(5, 8.5, 5.5);
      this.scene.add(this.keyLight);

      this.fillLight = new THREE.DirectionalLight("#b8d8ff", 0.9);
      this.fillLight.position.set(-6, 4, -3);
      this.scene.add(this.fillLight);

      this.rimLight = new THREE.DirectionalLight("#00e699", 0.42);
      this.rimLight.position.set(0, 3.5, -7);
      this.scene.add(this.rimLight);

      // Showroom floor + grid + soft contact shadow
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(16, 64),
        new THREE.MeshStandardMaterial({ color: "#111824", roughness: 0.42, metalness: 0.28 }),
      );
      floor.rotation.x = -Math.PI / 2;
      this.scene.add(floor);

      const grid = new THREE.GridHelper(20, 40, "#1f2e42", "#141d2b");
      grid.position.y = 0.002;
      this.scene.add(grid);

      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 5.2),
        new THREE.MeshBasicMaterial({
          map: createContactShadowTexture(),
          transparent: true,
          depthWrite: false,
          opacity: 0.82,
        }),
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.004;
      this.scene.add(shadowPlane);

      // Physical PBR Materials
      this.carbonBumpTexture = createCarbonBumpTexture();
      this.paintMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.2,
        metalness: 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.5,
        bumpScale: 0.004,
      });

      this.glassMaterial = new THREE.MeshPhysicalMaterial({
        color: "#0b1320",
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.72,
        transparent: true,
        opacity: 0.86,
        ior: 1.5,
        reflectivity: 0.9,
      });

      this.carbonMaterial = new THREE.MeshStandardMaterial({
        color: "#151a23",
        roughness: 0.44,
        metalness: 0.34,
        bumpMap: this.carbonBumpTexture,
        bumpScale: 0.004,
      });

      this.tireMaterial = new THREE.MeshStandardMaterial({ color: "#14161a", roughness: 0.88, metalness: 0.06 });
      this.rimMaterial = new THREE.MeshStandardMaterial({ color: "#adb7c4", roughness: 0.22, metalness: 0.9, envMapIntensity: 1.4 });
      this.brakeMaterial = new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.35, metalness: 0.55 });
      this.lightMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#e0f2fe", emissiveIntensity: 1.8 });

      this.setLightingPreset("noon");
      this.buildCleanParametricCar(this.currentCategory);
      this.startLoop();
    } catch {
      this.renderer = null;
    }
  }

  /**
   * Builds a sculpted, aerodynamic, showroom-grade motorsport car (GT3, GTP, Formula, Touring)
   * with smooth lofted bodywork, curved tinted glass canopy, forged 10-spoke racing wheels,
   * NACA airfoil swan-neck rear wing, carbon splitter/diffuser, mirrors and LED lighting.
   */
  private buildCleanParametricCar(category: CarBodyCategory): void {
    if (
      !this.scene ||
      !this.paintMaterial ||
      !this.glassMaterial ||
      !this.carbonMaterial ||
      !this.tireMaterial ||
      !this.rimMaterial ||
      !this.brakeMaterial ||
      !this.lightMaterial
    ) {
      return;
    }
    this.clearCarGroup();

    const group = new THREE.Group();
    const isFormula = category === "formula";
    const isGtp = category === "gtp";
    const bodyWidth = isFormula ? 1.12 : isGtp ? 1.96 : 1.92;
    const halfLen = isFormula ? 2.42 : isGtp ? 2.42 : 2.28;

    // 1. Sculpted multi-station lofted aerodynamic bodywork (zero flat boxes)
    const bodyGeo = createLoftedMotorsportHull(category);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.paintMaterial);
    bodyMesh.name = "body";
    group.add(bodyMesh);

    // 2. Curved tinted glass canopy (GT3 / GTP / Touring) OR Formula cockpit + Halo + airbox
    if (!isFormula) {
      const canopyGeo = createLoftedCanopy(category);
      const canopy = new THREE.Mesh(canopyGeo, this.glassMaterial);
      canopy.name = "glass_canopy";
      group.add(canopy);
    } else {
      // Formula open cockpit recess, titanium Halo bar & airbox intake
      const cockpitRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 20), this.carbonMaterial);
      cockpitRim.position.set(0, 0.52, 0.16);
      group.add(cockpitRim);

      const haloCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.26, 0.62, -0.18),
        new THREE.Vector3(-0.24, 0.78, 0.22),
        new THREE.Vector3(0, 0.80, 0.56),
        new THREE.Vector3(0.24, 0.78, 0.22),
        new THREE.Vector3(0.26, 0.62, -0.18),
      ]);
      const halo = new THREE.Mesh(new THREE.TubeGeometry(haloCurve, 28, 0.026, 10, false), this.carbonMaterial);
      group.add(halo);

      const haloPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.24, 10), this.carbonMaterial);
      haloPillar.position.set(0, 0.68, 0.58);
      haloPillar.rotation.x = 0.35;
      group.add(haloPillar);

      // Formula multi-plane front wing + endplates
      const fwBlade = new THREE.Mesh(createAirfoilWingGeometry(1.78, 0.34, 0.04), this.paintMaterial);
      fwBlade.position.set(0, 0.14, halfLen - 0.04);
      fwBlade.name = "front_wing";
      group.add(fwBlade);

      for (const side of [-1, 1]) {
        const fwEnd = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.20, 0.42), this.carbonMaterial);
        fwEnd.position.set(side * 0.90, 0.20, halfLen - 0.06);
        group.add(fwEnd);
      }
    }

    // 3. Carbon aero floor, sculpted front splitter, side skirts & multi-strake rear diffuser
    if (!isFormula) {
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth + 0.08, 0.036, 0.52), this.carbonMaterial);
      splitter.position.set(0, 0.11, halfLen - 0.16);
      group.add(splitter);

      // Front dive-plane canards & sculpted side skirts
      for (const side of [-1, 1]) {
        const canard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.022, 0.26), this.carbonMaterial);
        canard.position.set(side * (bodyWidth * 0.49), 0.30, halfLen - 0.36);
        canard.rotation.z = side * 0.24;
        group.add(canard);

        const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, halfLen * 1.12), this.carbonMaterial);
        skirt.position.set(side * (bodyWidth * 0.48), 0.12, 0);
        group.add(skirt);

        // Aerodynamic teardrop side mirror on angled stalk
        const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.04), this.carbonMaterial);
        stalk.position.set(side * (bodyWidth * 0.44), isGtp ? 0.72 : 0.80, 0.54);
        stalk.rotation.z = side * 0.22;
        group.add(stalk);

        const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), this.paintMaterial);
        mirror.scale.set(1.25, 0.72, 1.55);
        mirror.position.set(side * (bodyWidth * 0.52), isGtp ? 0.76 : 0.84, 0.52);
        mirror.name = "mirror";
        group.add(mirror);
      }

      // Recessed dark front intake grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.56, 0.18, 0.06), this.carbonMaterial);
      grille.position.set(0, 0.28, halfLen - 0.06);
      group.add(grille);
    }

    // Rear carbon diffuser with vertical strakes
    const diffW = isFormula ? 0.88 : bodyWidth * 0.86;
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(diffW, 0.16, 0.38), this.carbonMaterial);
    diffuser.position.set(0, 0.17, -halfLen + 0.12);
    group.add(diffuser);
    for (let s = -2; s <= 2; s++) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.15, 0.36), this.carbonMaterial);
      strake.position.set((s / 2.2) * (diffW * 0.44), 0.15, -halfLen + 0.10);
      group.add(strake);
    }

    // 4. Sculpted NACA airfoil rear wing with swan-neck pylons & swept endplates
    const wingY = isFormula ? 0.92 : isGtp ? 0.98 : 1.04;
    const wingZ = -halfLen + 0.18;
    const wingW = isFormula ? 1.06 : bodyWidth + 0.02;
    const wingBlade = new THREE.Mesh(createAirfoilWingGeometry(wingW, 0.32, 0.048), this.paintMaterial);
    wingBlade.position.set(0, wingY, wingZ);
    wingBlade.rotation.x = 0.09;
    wingBlade.name = "rear_wing";
    group.add(wingBlade);

    for (const side of [-1, 1]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.30, 0.42), this.carbonMaterial);
      endplate.position.set(side * (wingW / 2 + 0.015), wingY - 0.03, wingZ);
      endplate.rotation.x = -0.10;
      group.add(endplate);

      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.46, 0.16), this.carbonMaterial);
      pylon.position.set(side * (isFormula ? 0.14 : 0.30), wingY - 0.24, wingZ + 0.08);
      pylon.rotation.x = -0.18;
      group.add(pylon);
    }

    // 5. GTP Dorsal Shark Fin anchored seamlessly into roof & rear deck
    if (isGtp) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.34, 1.38), this.paintMaterial);
      fin.position.set(0, 0.84, -1.20);
      fin.name = "shark_fin";
      group.add(fin);
    }

    // 6. Sleek LED DRL headlights & full-width rear LED light bar
    const tailMat = new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#dc2626", emissiveIntensity: 2.2 });
    if (!isFormula) {
      for (const side of [-1, 1]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.055, 0.10), this.lightMaterial);
        hl.position.set(side * (bodyWidth * 0.33), 0.43, halfLen - 0.14);
        hl.rotation.y = side * -0.22;
        group.add(hl);
      }
      const tailBar = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.72, 0.042, 0.05), tailMat);
      tailBar.position.set(0, 0.56, -halfLen + 0.02);
      group.add(tailBar);
    } else {
      // Formula FIA rain light
      const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.04), tailMat);
      rainLight.position.set(0, 0.30, -halfLen + 0.01);
      group.add(rainLight);
    }

    // 7. Four forged 10-spoke racing wheels resting strictly on y = 0
    const wheelR = isFormula ? 0.33 : 0.34;
    const wheelW = isFormula ? 0.34 : 0.30;
    const trackHalf = isFormula ? 0.84 : bodyWidth * 0.49;
    const frontAxleZ = isFormula ? 1.54 : halfLen * 0.62;
    const rearAxleZ = isFormula ? -1.48 : -halfLen * 0.62;

    const wheelSpecs: Array<{ x: number; z: number; isLeft: boolean }> = [
      { x: trackHalf, z: frontAxleZ, isLeft: true },
      { x: -trackHalf, z: frontAxleZ, isLeft: false },
      { x: trackHalf, z: rearAxleZ, isLeft: true },
      { x: -trackHalf, z: rearAxleZ, isLeft: false },
    ];
    for (const ws of wheelSpecs) {
      const wheelGroup = createMotorsportWheel(wheelR, wheelW, ws.isLeft, {
        tire: this.tireMaterial,
        rim: this.rimMaterial,
        brake: this.brakeMaterial,
        carbon: this.carbonMaterial,
      });
      wheelGroup.position.set(ws.x, wheelR, ws.z);
      group.add(wheelGroup);

      // Formula exposed double-wishbone carbon suspension arms
      if (isFormula) {
        const sgn = ws.isLeft ? 1 : -1;
        for (const dy of [0.26, 0.40]) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 8), this.carbonMaterial);
          arm.rotation.z = Math.PI / 2;
          arm.position.set(sgn * 0.48, dy, ws.z);
          group.add(arm);
        }
      }
    }

    // Center strictly at (0, 0, 0) with tires resting on y = 0
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.set(-center.x, -box.min.y, -center.z);
    group.updateMatrixWorld(true);

    this.carGroup = group;
    this.hasCustomModel = false;
    this.scene.add(group);
    this.reapplyCurrentUvMapping();

    const catLabel = category === "gtp" ? "GTP Prototipo" : category === "formula" ? "Fórmula Monoplaza" : category === "touring" ? "Touring" : "GT3 Coupé";
    this.meshLabel = `Showroom ${catLabel} PBR · Carga un .GLB / .GLTF real (se guarda en IndexedDB por coche)`;
    this.syncNoticeDom();
    this.render();
  }

  private sanitizeSceneGroup(group: THREE.Object3D, refBox: THREE.Box3): void {
    const allowed = refBox.clone().expandByScalar(0.15);
    const toRemove: THREE.Object3D[] = [];
    const mBox = new THREE.Box3();
    const mSize = new THREE.Vector3();
    group.updateMatrixWorld(true);

    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.geometry && !obj.geometry.getAttribute("normal")) {
        obj.geometry.computeVertexNormals();
      }
      mBox.setFromObject(obj);
      if (mBox.isEmpty()) return;
      mBox.getSize(mSize);
      // Remove stray ground planes or floating meshes outside the car envelope
      const isStrayFloor = mSize.y < 0.02 && (mSize.x > 6 || mSize.z > 6);
      const isFloatingOutside = !allowed.intersectsBox(mBox) || mBox.min.y > refBox.max.y + 0.08;
      if (isStrayFloor || isFloatingOutside) {
        toRemove.push(obj);
      }
    });
    for (const orphan of toRemove) {
      orphan.parent?.remove(orphan);
    }
  }

  private reapplyCurrentUvMapping(): void {
    if (!this.carGroup || !this.paintMaterial) return;
    this.carGroup.updateMatrixWorld(true);
    const carBox = new THREE.Box3().setFromObject(this.carGroup);
    const paintMat = this.paintMaterial;

    this.carGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || obj.material !== paintMat) return;
      const geo = obj.geometry;
      if (!geo) return;

      // Snapshot original native UV once per geometry
      if (!this.originalUvs.has(geo)) {
        const uvAttr = geo.getAttribute("uv");
        if (uvAttr instanceof THREE.BufferAttribute) {
          this.originalUvs.set(geo, uvAttr.clone());
        }
      }

      if (this.uvMappingMode === "native" && this.hasCustomModel) {
        const orig = this.originalUvs.get(geo);
        if (orig) {
          geo.setAttribute("uv", orig.clone());
          return;
        }
      }
      // Auto-Fit Zonas iRacing projection (or fallback when native UVs are absent)
      applyIracingAutoFitUVs(obj, carBox, this.currentZones);
    });
  }

  private syncNoticeDom(): void {
    const notice = document.getElementById("skGlNotice");
    if (notice) notice.textContent = this.meshLabel;
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

  public setCategory(category: CarBodyCategory): void {
    this.currentCategory = category;
    if (!this.hasCustomModel) {
      this.buildCleanParametricCar(category);
    }
  }

  public updateZones(zones: Record<ZoneKey, UvRect>): void {
    this.currentZones = { ...DEFAULT_ZONES, ...zones };
    if (this.uvMappingMode === "autofit" || !this.hasCustomModel) {
      this.reapplyCurrentUvMapping();
      this.render();
    }
  }

  public setUvMappingMode(mode: UvMappingMode): void {
    this.uvMappingMode = mode;
    this.reapplyCurrentUvMapping();
    this.render();
  }

  public getUvMappingMode(): UvMappingMode {
    return this.uvMappingMode;
  }

  public setLightingPreset(preset: LightingPreset): void {
    if (!this.scene || !this.keyLight || !this.fillLight || !this.rimLight || !this.hemiLight || !this.renderer) return;
    if (preset === "sunset") {
      this.scene.background = new THREE.Color("#161119");
      this.scene.fog = new THREE.Fog("#161119", 12, 26);
      this.keyLight.color.set("#ffad66");
      this.keyLight.intensity = 2.55;
      this.keyLight.position.set(7, 3.2, 5);
      this.fillLight.color.set("#5c7cba");
      this.fillLight.intensity = 0.75;
      this.rimLight.color.set("#ff6b4a");
      this.rimLight.intensity = 1.05;
      this.hemiLight.color.set("#ffcca8");
      this.hemiLight.groundColor.set("#1c1524");
      this.hemiLight.intensity = 0.75;
      this.renderer.toneMappingExposure = 1.15;
    } else if (preset === "overcast") {
      this.scene.background = new THREE.Color("#18202c");
      this.scene.fog = new THREE.Fog("#18202c", 14, 28);
      this.keyLight.color.set("#eef5ff");
      this.keyLight.intensity = 1.65;
      this.keyLight.position.set(2, 9, 4);
      this.fillLight.color.set("#d4e4f7");
      this.fillLight.intensity = 1.25;
      this.rimLight.color.set("#94b8db");
      this.rimLight.intensity = 0.7;
      this.hemiLight.color.set("#e2ecfa");
      this.hemiLight.groundColor.set("#283446");
      this.hemiLight.intensity = 1.15;
      this.renderer.toneMappingExposure = 1.05;
    } else {
      this.scene.background = new THREE.Color("#0b1017");
      this.scene.fog = new THREE.Fog("#0b1017", 12, 26);
      this.keyLight.color.set("#ffffff");
      this.keyLight.intensity = 2.25;
      this.keyLight.position.set(5, 8.5, 5.5);
      this.fillLight.color.set("#b8d8ff");
      this.fillLight.intensity = 0.9;
      this.rimLight.color.set("#00e699");
      this.rimLight.intensity = 0.45;
      this.hemiLight.color.set("#f1f6ff");
      this.hemiLight.groundColor.set("#131a26");
      this.hemiLight.intensity = 0.85;
      this.renderer.toneMappingExposure = 1.12;
    }
  }

  public setCameraPreset(preset: "front34" | "side" | "rear34" | "top"): void {
    if (!this.camera || !this.controls) return;
    if (preset === "front34") {
      this.camera.position.set(3.9, 1.5, 4.2);
      this.controls.target.set(0, 0.55, 0);
    } else if (preset === "side") {
      this.camera.position.set(5.4, 1.15, 0.05);
      this.controls.target.set(0, 0.55, 0);
    } else if (preset === "rear34") {
      this.camera.position.set(-3.9, 1.6, -4.3);
      this.controls.target.set(0, 0.58, 0);
    } else {
      this.camera.position.set(0.01, 6.2, 0.35);
      this.controls.target.set(0, 0.3, 0);
    }
    this.controls.update();
  }

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

  public async loadGltfBuffer(buffer: ArrayBuffer, filename: string, fromCache = false): Promise<void> {
    if (!this.scene || !this.paintMaterial || !this.glassMaterial || !this.carbonMaterial || !this.tireMaterial || !this.rimMaterial || !this.brakeMaterial || !this.lightMaterial) {
      throw new Error("Visor Three.js no inicializado.");
    }
    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(buffer.slice(0), "", (res) => resolve(res as unknown as { scene: THREE.Group }), reject);
    });
    const root = gltf.scene;

    // Normalize scale to ~4.5m and center strictly at (0, 0, 0) resting on y = 0
    const rawBox = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    rawBox.getSize(size);
    rawBox.getCenter(center);
    const maxSpan = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4.5 / maxSpan;
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -rawBox.min.y * scale, -center.z * scale);
    root.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(root);
    this.sanitizeSceneGroup(root, finalBox);

    // Classify every sub-mesh so ONLY exterior bodywork receives the live iRacing paint
    let paintedCount = 0;
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const part = classifyMeshPart(obj);
      if (part === "paint") {
        obj.material = this.paintMaterial!;
        paintedCount++;
      } else if (part === "glass") {
        obj.material = this.glassMaterial!;
      } else if (part === "tire") {
        obj.material = this.tireMaterial!;
      } else if (part === "rim") {
        obj.material = this.rimMaterial!;
      } else if (part === "brake") {
        obj.material = this.brakeMaterial!;
      } else if (part === "light") {
        obj.material = this.lightMaterial!;
      } else {
        obj.material = this.carbonMaterial!;
      }
    });

    this.clearCarGroup();
    const wrapper = new THREE.Group();
    wrapper.add(root);
    this.carGroup = wrapper;
    this.hasCustomModel = true;
    this.scene.add(wrapper);
    this.reapplyCurrentUvMapping();

    this.meshLabel = `Modelo 3D real: ${filename} (${paintedCount} paneles pintables · ${fromCache ? "cargado de IndexedDB" : "guardado en IndexedDB local"})`;
    this.syncNoticeDom();
    this.render();
  }

  public async loadGltfFile(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    await this.loadGltfBuffer(buffer, file.name, false);
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
    if (norms.length === 0) geo.computeVertexNormals();
    geo.center();
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (bb) {
      const sz = new THREE.Vector3();
      bb.getSize(sz);
      const s = 4.5 / (Math.max(sz.x, sz.y, sz.z) || 1);
      geo.scale(s, s, s);
      geo.translate(0, -bb.min.y * s, 0);
    }

    this.clearCarGroup();
    const wrapper = new THREE.Group();
    wrapper.add(new THREE.Mesh(geo, this.paintMaterial));
    this.carGroup = wrapper;
    this.hasCustomModel = true;
    this.scene.add(wrapper);
    this.reapplyCurrentUvMapping();
    this.meshLabel = `Malla .OBJ local: ${filename}`;
    this.syncNoticeDom();
    this.render();
  }

  public resetToProofingBuck(): void {
    this.hasCustomModel = false;
    this.buildCleanParametricCar(this.currentCategory);
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
