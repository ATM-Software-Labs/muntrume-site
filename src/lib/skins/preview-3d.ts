/**
 * Real-time 2D -> 3D Showroom Preview Engine powered by Three.js for skins.muntru.me.
 * - Connects both the main Paint <canvas> and iRacing Spec Map <canvas> as live THREE.CanvasTexture
 *   (`map`, `roughnessMap`, `metalnessMap`) on a MeshPhysicalMaterial with clearcoat + RoomEnvironment IBL.
 * - Parametric 3D bodywork generator by category: GT3/GT4, Prototype/GTP, Formula, and Touring/Stock,
 *   with UVs mapped directly to the selected car's JSON zone coordinates.
 * - Smooth OrbitControls, 4 camera presets, 3 studio lighting modes (Mediodía, Atardecer, Nublado/Boxes),
 *   and 100% local .GLB / .GLTF (and .OBJ) model loader via URL.createObjectURL (never uploaded to server).
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
 * Helper to create a UV-mapped box aligned to a specific UV ZoneRect.
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
 * Build a smooth lofted parametric bodywork BufferGeometry split into paintable body & tinted glass groups.
 */
function buildLoftedBodyGeometries(
  category: CarBodyCategory,
  zones: Record<ZoneKey, UvRect>,
): { paintGeo: THREE.BufferGeometry; glassGeo: THREE.BufferGeometry } {
  const segS = 48;
  const segT = 32;

  const evalPoint = (s: number, t: number): [number, number, number] => {
    const at = Math.abs(t);
    const sign = t < 0 ? -1 : 1;

    if (category === "formula") {
      // Sleek open-wheel monoposto fuselage + sculpted sidepods
      const z = 2.05 - s * 4.10;
      const noseW = 0.14 + smoothstep(0.0, 0.35, s) * 0.20;
      const sidepodMask = smoothstep(0.38, 0.50, s) * (1 - smoothstep(0.76, 0.94, s));
      const halfW = noseW + sidepodMask * 0.38 * (1 - smoothstep(0.0, 0.32, at) * 0.2);
      const yFloor = -0.22;
      const spineH =
        -0.08 +
        smoothstep(0.0, 0.34, s) * 0.24 +
        smoothstep(0.52, 0.62, s) * (1 - smoothstep(0.76, 0.95, s)) * 0.26;
      const podH = -0.02 + sidepodMask * 0.18;
      const u = at;
      let y: number;
      if (u < 0.75) {
        const k = u / 0.75;
        y = spineH * (1 - smoothstep(0.15, 0.7, k)) + podH * smoothstep(0.15, 0.7, k);
      } else {
        const k = (u - 0.75) / 0.25;
        y = podH * (1 - k) + yFloor * k;
      }
      return [sign * halfW * Math.min(1, u / 0.82), y, z];
    }

    const isGtp = category === "gtp";
    const isTouring = category === "touring";

    const length = isGtp ? 3.96 : isTouring ? 3.68 : 3.80;
    const z = length * 0.5 - s * length;

    const noseTaper = smoothstep(0.0, isGtp ? 0.14 : 0.17, s);
    const tailTaper = 1.0 - smoothstep(0.86, 1.0, s) * (isGtp ? 0.08 : 0.14);
    const frontFlare = Math.exp(-Math.pow((s - 0.21) / 0.11, 2)) * (isGtp ? 0.12 : 0.085);
    const rearFlare = Math.exp(-Math.pow((s - 0.78) / 0.13, 2)) * (isGtp ? 0.13 : 0.105);
    const baseW = isGtp ? 0.66 : isTouring ? 0.68 : 0.64;
    const halfW = (baseW + 0.24 * noseTaper + frontFlare + rearFlare) * tailTaper;

    const yFloor = -0.24;
    const beltY =
      (isGtp ? -0.05 : isTouring ? 0.02 : -0.02) +
      smoothstep(0.0, 0.18, s) * (isGtp ? 0.16 : 0.18) +
      smoothstep(0.25, 0.78, s) * (isGtp ? 0.08 : 0.12) -
      smoothstep(0.92, 1.0, s) * 0.06;

    const cabStart = isGtp ? 0.28 : isTouring ? 0.26 : 0.32;
    const cabPeak = isGtp ? 0.44 : isTouring ? 0.40 : 0.49;
    const cabEndStart = isGtp ? 0.60 : isTouring ? 0.74 : 0.66;
    const cabEnd = isGtp ? 0.82 : isTouring ? 0.88 : 0.90;
    const cabMaxH = isGtp ? 0.30 : isTouring ? 0.42 : 0.34;

    const cabHeight = smoothstep(cabStart, cabPeak, s) * (1.0 - smoothstep(cabEndStart, cabEnd, s)) * cabMaxH;

    let xNorm: number;
    let y: number;

    if (at < 0.72) {
      const u = at / 0.72;
      const greenhouseMask = cabHeight / cabMaxH;
      const cabTuck = smoothstep(isGtp ? 0.20 : 0.28, 0.68, u) * greenhouseMask * (isGtp ? 0.38 : 0.22);
      xNorm = u * (1.0 - cabTuck * 0.48);

      const hoodCrown = Math.cos(u * Math.PI * 0.5) * 0.045;
      const fenderBump = Math.exp(-Math.pow((u - 0.78) / 0.20, 2)) * (frontFlare + rearFlare) * (isGtp ? 0.9 : 0.55);
      const cabProfile = Math.cos(Math.min(1, u / (isGtp ? 0.58 : 0.78)) * Math.PI * 0.5);
      const cabY = cabHeight * Math.pow(Math.max(0, cabProfile), 0.72);
      y = beltY + hoodCrown + fenderBump + cabY;
    } else {
      const u = (at - 0.72) / 0.28;
      xNorm = 1.0 - Math.pow(u, 2.2) * 0.07;
      const shoulderY = beltY + (frontFlare + rearFlare) * 0.22;
      y = shoulderY * (1.0 - smoothstep(0, 1, u)) + yFloor * smoothstep(0, 1, u);
    }

    const noseCurve = s < 0.06 ? (1.0 - s / 0.06) * Math.pow(at, 2) * 0.14 : 0;
    const tailCurve = s > 0.94 ? ((s - 0.94) / 0.06) * Math.pow(at, 2) * 0.08 : 0;

    return [sign * halfW * xNorm, y, z - noseCurve + tailCurve];
  };

  const evalNormal = (s: number, t: number): [number, number, number] => {
    const es = 0.004;
    const et = 0.008;
    const p0 = evalPoint(s, t);
    const ps = evalPoint(Math.min(1, s + es), t);
    const pt = evalPoint(s, Math.min(1, t + et));
    const ds = [ps[0] - p0[0], ps[1] - p0[1], ps[2] - p0[2]];
    const dt = [pt[0] - p0[0], pt[1] - p0[1], pt[2] - p0[2]];
    let nx = ds[1] * dt[2] - ds[2] * dt[1];
    let ny = ds[2] * dt[0] - ds[0] * dt[2];
    let nz = ds[0] * dt[1] - ds[1] * dt[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  };

  const evalUvAndGlass = (s: number, t: number): { u: number; v: number; isGlass: boolean } => {
    const at = Math.abs(t);
    let isGlass = false;
    if (category === "formula") {
      isGlass = s >= 0.42 && s <= 0.56 && at < 0.26;
    } else if (category === "gtp") {
      isGlass = s >= 0.29 && s <= 0.55 && at < 0.42;
    } else {
      const isWindshield = s >= 0.32 && s <= 0.47 && at < 0.56;
      const isRearGlass = s >= 0.67 && s <= 0.84 && at < 0.50;
      const isSideGlass = s >= 0.43 && s <= 0.72 && at >= 0.48 && at <= 0.69;
      isGlass = isWindshield || isRearGlass || isSideGlass;
    }

    if (at >= 0.68) {
      const zRect = t < 0 ? zones.leftSide : zones.rightSide;
      const uFrac = t < 0 ? s : 1 - s;
      const vFrac = (at - 0.68) / 0.32;
      return { u: zRect.x + uFrac * zRect.w, v: zRect.y + vFrac * zRect.h, isGlass };
    }
    if (s < 0.36) {
      const zRect = s < 0.08 ? zones.frontBumper : zones.hood;
      const uFrac = (t / 0.68) * 0.5 + 0.5;
      const vFrac = s < 0.08 ? s / 0.08 : (s - 0.08) / 0.28;
      return { u: zRect.x + uFrac * zRect.w, v: zRect.y + vFrac * zRect.h, isGlass };
    }
    if (s < 0.70) {
      const uFrac = (t / 0.68) * 0.5 + 0.5;
      const vFrac = (s - 0.36) / 0.34;
      return { u: zones.roof.x + uFrac * zones.roof.w, v: zones.roof.y + vFrac * zones.roof.h, isGlass };
    }
    const uFrac = (t / 0.68) * 0.5 + 0.5;
    const vFrac = (s - 0.70) / 0.30;
    return { u: zones.rearBumper.x + uFrac * zones.rearBumper.w, v: zones.rearBumper.y + vFrac * zones.rearBumper.h, isGlass };
  };

  const pPos: number[] = [], pNorm: number[] = [], pUv: number[] = [];
  const gPos: number[] = [], gNorm: number[] = [], gUv: number[] = [];

  for (let is = 0; is < segS; is++) {
    const s0 = is / segS;
    const s1 = (is + 1) / segS;
    for (let it = 0; it < segT; it++) {
      const t0 = -1 + (2 * it) / segT;
      const t1 = -1 + (2 * (it + 1)) / segT;
      const isGlass = evalUvAndGlass((s0 + s1) * 0.5, (t0 + t1) * 0.5).isGlass;
      const posArr = isGlass ? gPos : pPos;
      const normArr = isGlass ? gNorm : pNorm;
      const uvArr = isGlass ? gUv : pUv;

      const corners: Array<[number, number]> = [
        [s0, t0], [s1, t0], [s1, t1],
        [s0, t0], [s1, t1], [s0, t1],
      ];
      for (const [cs, ct] of corners) {
        const p = evalPoint(cs, ct);
        const n = evalNormal(cs, ct);
        const { u, v } = evalUvAndGlass(cs, ct);
        posArr.push(...p);
        normArr.push(...n);
        uvArr.push(u, v);
      }
    }
  }

  const paintGeo = new THREE.BufferGeometry();
  paintGeo.setAttribute("position", new THREE.Float32BufferAttribute(pPos, 3));
  paintGeo.setAttribute("normal", new THREE.Float32BufferAttribute(pNorm, 3));
  paintGeo.setAttribute("uv", new THREE.Float32BufferAttribute(pUv, 2));

  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute("position", new THREE.Float32BufferAttribute(gPos, 3));
  glassGeo.setAttribute("normal", new THREE.Float32BufferAttribute(gNorm, 3));
  glassGeo.setAttribute("uv", new THREE.Float32BufferAttribute(gUv, 2));

  return { paintGeo, glassGeo };
}

function buildWheelMesh(
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  caliperMat: THREE.Material,
  radius: number,
  width: number,
  isLeft: boolean,
): THREE.Group {
  const wheel = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 32);
  tireGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(tireGeo, tireMat));

  const rimGeo = new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, width * 1.02, 24);
  rimGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(rimGeo, rimMat));

  // Center-lock hub + spokes
  const hubGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width * 1.08, 16);
  hubGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(hubGeo, caliperMat));

  const outX = (isLeft ? -1 : 1) * (width * 0.51);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, radius * 1.24, 0.032), rimMat);
    spoke.position.x = outX;
    spoke.rotation.x = (i / 6) * Math.PI;
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
  private caliperMaterial: THREE.MeshStandardMaterial | null = null;
  private headLightMat: THREE.MeshBasicMaterial | null = null;
  private tailLightMat: THREE.MeshBasicMaterial | null = null;

  private diffuseTexture: THREE.CanvasTexture | null = null;
  private specPackedCanvas: HTMLCanvasElement;
  private specPackedTexture: THREE.CanvasTexture | null = null;

  private carGroup: THREE.Group | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  private currentCategory: CarBodyCategory = "gt3";
  private currentZones: Record<ZoneKey, UvRect> = DEFAULT_CAR_ZONES;
  private currentLighting: LightingPreset = "noon";
  private isCustomModel = false;
  private meshLabel = "Coche 3D GT3 en tiempo real (Three.js PBR)";
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
      renderer.toneMappingExposure = 1.15;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer = renderer;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#070b11");
      scene.fog = new THREE.Fog("#070b11", 8, 22);
      this.scene = scene;

      // Studio IBL reflections via RoomEnvironment
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();

      const camera = new THREE.PerspectiveCamera(40, 16 / 10, 0.1, 60);
      camera.position.set(2.9, 1.45, 3.1);
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

      // Studio lights
      this.hemiLight = new THREE.HemisphereLight("#d8e8ff", "#111827", 0.9);
      scene.add(this.hemiLight);

      this.keyLight = new THREE.DirectionalLight("#fff7e8", 2.4);
      this.keyLight.position.set(4.5, 7.0, 4.2);
      scene.add(this.keyLight);

      this.fillLight = new THREE.DirectionalLight("#60a5fa", 1.1);
      this.fillLight.position.set(-4.5, 3.2, -4.0);
      scene.add(this.fillLight);

      // Studio showroom floor + subtle grid
      const floorGeo = new THREE.CircleGeometry(9, 64);
      floorGeo.rotateX(-Math.PI / 2);
      const floorMat = new THREE.MeshStandardMaterial({
        color: "#0b111a",
        roughness: 0.42,
        metalness: 0.15,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.y = -0.325;
      scene.add(floor);

      const grid = new THREE.GridHelper(12, 24, "#00e699", "#172230");
      grid.position.y = -0.322;
      const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMats.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.22;
      });
      scene.add(grid);

      // Shared PBR materials
      this.paintMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.36,
        metalness: 0.26,
        clearcoat: 0.85,
        clearcoatRoughness: 0.14,
        side: THREE.DoubleSide,
      });

      this.glassMaterial = new THREE.MeshPhysicalMaterial({
        color: "#09111c",
        roughness: 0.06,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        side: THREE.DoubleSide,
      });

      this.carbonMaterial = new THREE.MeshStandardMaterial({
        color: "#11161f",
        roughness: 0.68,
        metalness: 0.15,
      });

      this.rimMaterial = new THREE.MeshStandardMaterial({
        color: "#9aa5b4",
        roughness: 0.24,
        metalness: 0.88,
      });

      this.caliperMaterial = new THREE.MeshStandardMaterial({
        color: "#00e699",
        roughness: 0.35,
        metalness: 0.5,
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
    if (!this.scene || !this.paintMaterial || !this.glassMaterial || !this.carbonMaterial || !this.rimMaterial || !this.caliperMaterial || !this.headLightMat || !this.tailLightMat) return;
    this.clearCarGroup();

    const group = new THREE.Group();
    const z = this.currentZones;
    const cat = this.currentCategory;

    const { paintGeo, glassGeo } = buildLoftedBodyGeometries(cat, z);
    group.add(new THREE.Mesh(paintGeo, this.paintMaterial));
    group.add(new THREE.Mesh(glassGeo, this.glassMaterial));

    const addPart = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, pz: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, pz);
      group.add(m);
    };

    if (cat === "formula") {
      // Front multi-element wing + endplates
      addPart(createZoneBox(1.62, 0.035, 0.34, z.frontBumper), this.paintMaterial, 0, -0.18, 1.98);
      addPart(new THREE.BoxGeometry(0.03, 0.20, 0.42), this.carbonMaterial, -0.82, -0.13, 1.96);
      addPart(new THREE.BoxGeometry(0.03, 0.20, 0.42), this.carbonMaterial, 0.82, -0.13, 1.96);
      // Halo over cockpit
      const haloGeo = new THREE.TorusGeometry(0.24, 0.025, 10, 24, Math.PI);
      haloGeo.rotateX(Math.PI / 2);
      addPart(haloGeo, this.carbonMaterial, 0, 0.30, 0.14);
      // Tall open-wheel rear wing
      addPart(createZoneBox(1.06, 0.04, 0.32, z.rearWing), this.paintMaterial, 0, 0.56, -1.86);
      addPart(new THREE.BoxGeometry(0.03, 0.38, 0.38), this.carbonMaterial, -0.54, 0.44, -1.86);
      addPart(new THREE.BoxGeometry(0.03, 0.38, 0.38), this.carbonMaterial, 0.54, 0.44, -1.86);
      // Exposed open wheels + suspension wishbones
      const wheels: Array<[number, number, boolean]> = [
        [-0.86, 1.18, true], [0.86, 1.18, false],
        [-0.88, -1.16, true], [0.88, -1.16, false],
      ];
      for (const [wx, wz, isLeft] of wheels) {
        const w = buildWheelMesh(this.carbonMaterial, this.rimMaterial, this.caliperMaterial, 0.30, 0.30, isLeft);
        w.position.set(wx, -0.02, wz);
        group.add(w);
        addPart(new THREE.BoxGeometry(0.75, 0.025, 0.04), this.carbonMaterial, wx * 0.5, -0.02, wz);
      }
    } else {
      const isGtp = cat === "gtp";
      const isTouring = cat === "touring";

      // Carbon front splitter, rear diffuser & floor
      addPart(new THREE.BoxGeometry(1.74, 0.035, 0.34), this.carbonMaterial, 0, -0.25, isGtp ? 1.94 : 1.84);
      addPart(new THREE.BoxGeometry(1.64, 0.12, 0.24), this.carbonMaterial, 0, -0.22, isGtp ? -1.88 : -1.78);
      addPart(new THREE.BoxGeometry(1.68, 0.04, 3.50), this.carbonMaterial, 0, -0.25, 0);

      // Headlights & Taillights
      addPart(new THREE.BoxGeometry(0.28, 0.045, 0.12), this.headLightMat, -0.56, 0.08, isGtp ? 1.90 : 1.82);
      addPart(new THREE.BoxGeometry(0.28, 0.045, 0.12), this.headLightMat, 0.56, 0.08, isGtp ? 1.90 : 1.82);
      addPart(new THREE.BoxGeometry(0.38, 0.045, 0.06), this.tailLightMat, -0.56, 0.16, isGtp ? -1.94 : -1.84);
      addPart(new THREE.BoxGeometry(0.38, 0.045, 0.06), this.tailLightMat, 0.56, 0.16, isGtp ? -1.94 : -1.84);

      // Side mirrors
      addPart(createZoneBox(0.16, 0.065, 0.11, z.mirrors), this.paintMaterial, -0.92, 0.26, 0.44);
      addPart(createZoneBox(0.16, 0.065, 0.11, z.mirrors), this.paintMaterial, 0.92, 0.26, 0.44);

      // GTP Dorsal Shark Fin
      if (isGtp) {
        addPart(createZoneBox(0.035, 0.26, 1.35, z.roof), this.paintMaterial, 0, 0.40, -1.10);
      }

      // Rear Wing (low lip for touring, wide swan-neck wing for GT3/GTP)
      if (isTouring) {
        addPart(createZoneBox(1.58, 0.045, 0.20, z.rearWing), this.paintMaterial, 0, 0.34, -1.74);
      } else {
        const wingY = isGtp ? 0.48 : 0.56;
        const wingZ = isGtp ? -1.84 : -1.74;
        addPart(createZoneBox(1.74, 0.04, 0.30, z.rearWing), this.paintMaterial, 0, wingY, wingZ);
        addPart(new THREE.BoxGeometry(0.03, 0.24, 0.36), this.carbonMaterial, -0.88, wingY - 0.02, wingZ);
        addPart(new THREE.BoxGeometry(0.03, 0.24, 0.36), this.carbonMaterial, 0.88, wingY - 0.02, wingZ);
        addPart(new THREE.BoxGeometry(0.035, 0.32, 0.12), this.carbonMaterial, -0.34, wingY - 0.18, wingZ + 0.05);
        addPart(new THREE.BoxGeometry(0.035, 0.32, 0.12), this.carbonMaterial, 0.34, wingY - 0.18, wingZ + 0.05);
      }

      // 4 High-detail wheels
      const wheelZFront = isGtp ? 1.18 : 1.12;
      const wheelZRear = isGtp ? -1.16 : -1.06;
      const wheelSpecs: Array<[number, number, boolean]> = [
        [-0.82, wheelZFront, true], [0.82, wheelZFront, false],
        [-0.85, wheelZRear, true], [0.85, wheelZRear, false],
      ];
      for (const [wx, wz, isLeft] of wheelSpecs) {
        const w = buildWheelMesh(this.carbonMaterial, this.rimMaterial, this.caliperMaterial, 0.285, 0.26, isLeft);
        w.position.set(wx, -0.04, wz);
        group.add(w);
      }
    }

    this.carGroup = group;
    this.scene.add(group);
    this.isCustomModel = false;
    const catName =
      cat === "gtp" ? "Prototype / GTP" : cat === "formula" ? "Fórmula" : cat === "touring" ? "Touring / Stock" : "GT3 / GT4";
    this.meshLabel = `Coche 3D ${catName} (Three.js PBR · mapeado a zonas UV)`;
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
    if (!this.scene || !this.renderer || !this.keyLight || !this.fillLight || !this.hemiLight) return;

    if (preset === "sunset") {
      this.scene.background = new THREE.Color("#130d18");
      this.scene.fog = new THREE.Fog("#130d18", 8, 22);
      this.keyLight.color.set("#ff9b54");
      this.keyLight.intensity = 2.9;
      this.keyLight.position.set(6.5, 2.4, 3.2);
      this.fillLight.color.set("#6366f1");
      this.fillLight.intensity = 1.4;
      this.fillLight.position.set(-5.0, 2.8, -3.5);
      this.hemiLight.color.set("#fdba74");
      this.hemiLight.groundColor.set("#1e1b4b");
      this.hemiLight.intensity = 0.85;
      this.renderer.toneMappingExposure = 1.2;
    } else if (preset === "overcast") {
      this.scene.background = new THREE.Color("#0d131c");
      this.scene.fog = new THREE.Fog("#0d131c", 9, 24);
      this.keyLight.color.set("#e2e8f0");
      this.keyLight.intensity = 1.5;
      this.keyLight.position.set(2.0, 8.5, 2.0);
      this.fillLight.color.set("#cbd5e1");
      this.fillLight.intensity = 1.3;
      this.fillLight.position.set(-3.5, 5.0, -3.0);
      this.hemiLight.color.set("#f1f5f9");
      this.hemiLight.groundColor.set("#1e293b");
      this.hemiLight.intensity = 1.35;
      this.renderer.toneMappingExposure = 1.1;
    } else {
      // Noon (Mediodía)
      this.scene.background = new THREE.Color("#070b11");
      this.scene.fog = new THREE.Fog("#070b11", 8, 22);
      this.keyLight.color.set("#fff9ee");
      this.keyLight.intensity = 2.5;
      this.keyLight.position.set(4.5, 7.2, 4.2);
      this.fillLight.color.set("#38bdf8");
      this.fillLight.intensity = 1.05;
      this.fillLight.position.set(-4.5, 3.0, -4.0);
      this.hemiLight.color.set("#dbeafe");
      this.hemiLight.groundColor.set("#0f172a");
      this.hemiLight.intensity = 0.95;
      this.renderer.toneMappingExposure = 1.15;
    }
  }

  public getLightingPreset(): LightingPreset {
    return this.currentLighting;
  }

  public setCameraPreset(preset: "front34" | "side" | "rear34" | "top"): void {
    if (!this.camera || !this.controls) return;
    if (preset === "front34") {
      this.camera.position.set(2.9, 1.35, 3.1);
    } else if (preset === "side") {
      this.camera.position.set(4.4, 0.95, 0.05);
    } else if (preset === "rear34") {
      this.camera.position.set(-2.9, 1.4, -3.1);
    } else if (preset === "top") {
      this.camera.position.set(0.05, 4.9, 0.2);
    }
    this.controls.target.set(0, 0.1, 0);
    this.controls.update();
  }

  /**
   * Connects both the main Paint <canvas> and the iRacing Spec Map <canvas> as live THREE.CanvasTexture.
   * iRacing Spec Map channels: R = Metallic, G = Roughness, B = Clearcoat.
   * Three.js PBR channels: roughnessMap reads G, metalnessMap reads B.
   */
  public updateTexture(
    diffuseCanvas: HTMLCanvasElement,
    metallicPct: number,
    roughnessPct: number,
    specCanvas?: HTMLCanvasElement | null,
    clearcoatPct = 80,
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

    this.paintMaterial.clearcoat = Math.max(0, Math.min(1, clearcoatPct / 100));
    this.paintMaterial.clearcoatRoughness = Math.max(0.04, Math.min(0.85, (roughnessPct / 100) * 0.45));
  }

  /**
   * Loads a local .GLB or .GLTF 3D car model completely client-side via URL.createObjectURL (never uploaded).
   */
  public async loadGltfFile(file: File): Promise<void> {
    if (!this.scene || !this.paintMaterial) throw new Error("Visor Three.js no inicializado.");
    const blobUrl = URL.createObjectURL(file);
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(blobUrl);
      const root = gltf.scene;

      // Normalize bounding box to studio scale (~3.8 units max span, resting on floor y=-0.32)
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxSpan = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3.8 / maxSpan;
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -box.min.y * scale - 0.32, -center.z * scale);

      // Apply live paint & spec map material to meshes that look like car body (or all meshes without glass/tire name)
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

  /**
   * Legacy .OBJ text loader kept for compatibility.
   */
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
      const s = 3.8 / (Math.max(sz.x, sz.y, sz.z) || 1);
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
    this.specPackedTexture?.dispose();
    this.renderer?.dispose();
  }
}
