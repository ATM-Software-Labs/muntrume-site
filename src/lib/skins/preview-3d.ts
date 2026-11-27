/**
 * Automotive Showroom 3D Engine powered by Three.js for skins.muntru.me.
 * - ZERO procedural blocky car primitives (no BoxGeometry/CylinderGeometry/ExtrudeGeometry cars).
 * - 100% real .GLB / .GLTF / .OBJ model showroom with automatic IndexedDB persistence per car_slug
 *   and optional category base models at /models/{gt3,gtp,formula}-base.glb.
 * - When no .GLB is cached or available, renders a sleek double-curved Automotive Speedform
 *   (vinyl-shop paint sample hood) with clearcoat PBR reflections + prominent CTA to load a real .GLB.
 * - Smart material preservation: when loading a real .GLB/.GLTF, ONLY exterior bodywork paint panels
 *   receive the live iRacing 2D Canvas + Spec Map while original glass, tires, rims, brakes, lights,
 *   interior, and carbon grilles remain completely untouched.
 * - Non-mirrored, non-inverted Triplanar / Zonal Auto-Fit UV projection onto calibrated iRacing UV
 *   rectangles from src/data/uv-maps/<car_slug>.json, plus instant toggle to Native .GLB UVs.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ZoneKey, ZoneRect } from "./types";
import modelsManifest from "../../data/models-manifest.json";

export type CarBodyCategory = "gt3" | "gtp" | "formula" | "touring" | "nascar";
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

const MODELS_CDN_BASE = "/assets/models";
const MODEL_VER = "v=4";

const CATEGORY_BASE_GLB_PATHS: Record<CarBodyCategory, string> = {
  gt3: `${MODELS_CDN_BASE}/fordmustanggt3-v2.glb?${MODEL_VER}`,
  touring: `${MODELS_CDN_BASE}/fordmustanggt3-v2.glb?${MODEL_VER}`,
  gtp: `${MODELS_CDN_BASE}/mclaren720sgt3.glb?${MODEL_VER}`,
  nascar: `${MODELS_CDN_BASE}/fordmustanggt3-v2.glb?${MODEL_VER}`,
  formula: `${MODELS_CDN_BASE}/formula-v2.glb?${MODEL_VER}`,
};

function resolveBrandSpecificGlb(slugKey: string): string {
  if (!slugKey) return "";
  if (/ferrari|296|488|499p/.test(slugKey)) return `${MODELS_CDN_BASE}/ferrari296gt3.glb?${MODEL_VER}`;
  if (/porsche|992|991|911|718|963|919/.test(slugKey)) return `${MODELS_CDN_BASE}/porsche992rgt3.glb?${MODEL_VER}`;
  if (/bmw|m4gt|m4evogt|m8gte|m2csr|m2g87|z4gt3/.test(slugKey)) return `${MODELS_CDN_BASE}/bmwm4gt3.glb?${MODEL_VER}`;
  if (/lamborghini|huracan/.test(slugKey)) return `${MODELS_CDN_BASE}/lamborghinievogt3.glb?${MODEL_VER}`;
  if (/mclaren|720s|570s|mp4/.test(slugKey)) return `${MODELS_CDN_BASE}/mclaren720sgt3.glb?${MODEL_VER}`;
  if (/audi|r8lms|rs3lms/.test(slugKey)) return `${MODELS_CDN_BASE}/audir8lmsevo2gt3.glb?${MODEL_VER}`;
  if (/aston|amvantage|amvalkyrie|dbr9/.test(slugKey)) return `${MODELS_CDN_BASE}/amvantageevogt3.glb?${MODEL_VER}`;
  if (/corvette|chevyvette|c8r|c7dp|c6r|z06/.test(slugKey)) return `${MODELS_CDN_BASE}/corvettec8gt3.glb?${MODEL_VER}`;
  if (/formula|dallara(?!p217)|indy|ir18|ir01|dw12|sf23|sfl|raygr|skipbarber|vee|lotus49|lotus79|tatuus|usf2000|pm18|fr500|starmazda/.test(slugKey)) {
    return `${MODELS_CDN_BASE}/formula-v2.glb?${MODEL_VER}`;
  }
  if (/mustang|fordgt/.test(slugKey)) return `${MODELS_CDN_BASE}/fordmustanggt3-v2.glb?${MODEL_VER}`;
  return "";
}

export function mapCategoryStringToBody(category?: string): CarBodyCategory {
  const c = String(category || "").toLowerCase();
  if (c.includes("gtp") || c.includes("lmp") || c.includes("proto")) return "gtp";
  if (c.includes("fórmula") || c.includes("formula") || c.includes("indy") || c.includes("open")) return "formula";
  if (c.includes("nascar") || c.includes("oval") || c.includes("stock") || c.includes("arca")) return "nascar";
  if (c.includes("tcr") || c.includes("touring") || c.includes("producción") || c.includes("dirt")) return "touring";
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

function getMeshMaterialNames(mesh: THREE.Mesh): string {
  const matNames: string[] = [];
  if (Array.isArray(mesh.material)) {
    for (const m of mesh.material) {
      if (m && "name" in m && m.name) matNames.push(String(m.name).toLowerCase());
    }
  } else if (mesh.material && "name" in mesh.material && mesh.material.name) {
    matNames.push(String(mesh.material.name).toLowerCase());
  }
  return matNames.join(" ");
}

/**
 * Hides stock third-party sponsor/number decal overlay meshes on base models
 * (e.g. redbull_decals / redbull_number on formula-base.glb) so only the user's livery shows.
 */
function shouldHideStockDecalMesh(mesh: THREE.Mesh, isBaseModel: boolean): boolean {
  if (!isBaseModel) return false;
  const matId = getMeshMaterialNames(mesh);
  return /(redbull_decals|redbull_number|sw_decals|mt_shadow_plane)/.test(matId);
}

/**
 * Smart material/mesh classifier for real .GLB / .GLTF models.
 * Returns true ONLY for exterior painted bodywork panels (body, paint, chassis, hood, wing, bumper, etc.)
 * and false for glass, windows, tires, wheels, rims, brakes, lights, interior, and carbon grilles,
 * keeping all non-body original GLB materials completely intact.
 */
function isPaintableBodyMesh(mesh: THREE.Mesh): boolean {
  const matId = getMeshMaterialNames(mesh);
  const meshId = (mesh.name || "").toLowerCase();

  // 1. Explicit positive match on material name first (handles Mustang GT3, F1, BMW M4, Porsche, Lambo STO "mat_carrozzeria", Ferrari 488 GT3 "phong4", McLaren P1 GTR "vehicle_exterior_mm_ext", Audi R8 "bodymaterials", Aston "mat_body", Corvette "body_color")
  if (/(paint|carpaint|livery|redbull_color|body_color|bodypaint|meshesbody|mt_body|mat_body|mat_carrozzeria|bodymaterials|vehicle_exterior_mm_ext|\bphong4\b|mt_mirrorcover|\bbody\b)/.test(matId)) {
    return true;
  }

  const id = `${meshId} ${matId}`;

  // 2. Strictly preserve non-body materials (glass, tires, rims, lights, interior, carbon, grilles, mechanical)
  const excludedPattern =
    /(glass|window|windshield|windscreen|visor|transparent|tire|tyre|tireside|tiretread|sidewall|rubber|slick|tread|wheel|rim|alloy|spoke|hub|centerlock|nut|brake|brakelight|caliper|disc|rotor|light|headlight|taillight|signallight|redlight|lamp|led|clearled|lens|indicator|emissive|interior|cockpit|seat|dash|dashboard|steering|cage|rollcage|net|belt|cinture|harness|floormat|hardware|mechanical|engine|pedal|wiper|gasket|license|lcd|carbon|splitter|diffuser|grille|grill|piggrill|raidiator|pillars|mesh|vent|intake|exhaust|pipe|underbody|underside|floor|strut|pylon|mirror|chrome|badge|emblem|logo|decal|plastic|trim|black|detail|generics|panel sides|shadow|ground|plane)/;
  if (excludedPattern.test(id)) return false;

  // 3. Explicit positive match on mesh name for bodywork panels
  const bodyPattern =
    /(body|paint|carpaint|livery|chassis|hood|bonnet|roof|door|fender|quarter|wing|spoiler|bumper|nose|sidepod|shell|ext|exterior|aero|trunk|boot|tail)/;
  if (bodyPattern.test(meshId)) return true;

  return false;
}

/**
 * Triplanar / Zonal UV projection onto calibrated iRacing UV rectangles from src/data/uv-maps/<car_slug>.json.
 * Uses world-space normals (+Y -> hood/roof/rearWing, -X -> leftSide, +X -> rightSide, +Z -> frontBumper, -Z -> rearBumper)
 * with CanvasTexture.flipY = false so pilot names ("Alberto Trujillo"), numbers (#16), and MMT logos
 * ALWAYS read upright and left-to-right on every side of the car without mirroring.
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

  const longIsZ = spanZ >= spanX;

  mesh.updateWorldMatrix(true, false);
  const normalMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const uvArr = new Float32Array(pos.count * 2);

  const isRearWingMesh = /\b(wing|spoiler)\b/i.test(mesh.name || "");

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(norm, i).applyMatrix3(normalMat).normalize();

    // Normalized longitudinal (0=rear -Z, 1=front +Z), lateral (0=-X, 1=+X), vertical (0=bottom, 1=top)
    const along = longIsZ ? (v.z - min.z) / spanZ : (v.x - min.x) / spanX;
    const across = longIsZ ? (v.x - min.x) / spanX : (v.z - min.z) / spanZ;
    const up = (v.y - min.y) / spanY;

    const latN = longIsZ ? n.x : n.z;
    const longN = longIsZ ? n.z : n.x;
    const absLat = Math.abs(latN);
    const absLong = Math.abs(longN);
    const absUp = Math.abs(n.y);

    let zone: UvRect;
    let lu = 0.5;
    let lv = 0.5;

    if (isRearWingMesh || (up > 0.72 && along < 0.20)) {
      // +Y Rear wing (viewed from rear 3/4: -X is left, +X is right)
      zone = zones.rearWing;
      lu = across;
      lv = 1 - Math.max(0, Math.min(1, along / 0.20));
    } else if (absLong >= absLat && absLong >= absUp && longN >= 0 && along > 0.75) {
      // +Z Front bumper (viewed from front: +X is left, -X is right)
      zone = zones.frontBumper;
      lu = 1 - across;
      lv = 1 - up;
    } else if (absLong >= absLat && absLong >= absUp && longN < 0 && along < 0.25) {
      // -Z Rear bumper (viewed from rear: -X is left, +X is right)
      zone = zones.rearBumper;
      lu = across;
      lv = 1 - up;
    } else if (absLat >= absUp * 0.85 && (across < 0.46 || across > 0.54)) {
      // Real iRacing horizontal UV: leftSide (bottom door, 0° upright) & rightSide (top door, 180° inverted)
      if (latN < 0) {
        zone = zones.leftSide;
        lu = 1 - along;
        lv = 1 - up;
      } else {
        zone = zones.rightSide;
        lu = 1 - along;
        lv = up;
      }
    } else if (along > 0.54) {
      // +Y Hood in real iRacing horizontal UV: nose (+Z, along=1) is on the LEFT (lu=0), windshield on RIGHT (lu=1)
      zone = zones.hood;
      lu = 1 - Math.max(0, Math.min(1, (along - 0.54) / 0.46));
      lv = 1 - across;
    } else {
      // +Y Roof & rear deck in real iRacing horizontal UV: front on LEFT (lu=0), rear on RIGHT (lu=1)
      zone = zones.roof;
      lu = 1 - Math.max(0, Math.min(1, (along - 0.12) / 0.44));
      lv = 1 - across;
    }

    const u = Math.max(0.001, Math.min(0.999, zone.x + Math.max(0, Math.min(1, lu)) * zone.w));
    const w = Math.max(0.001, Math.min(0.999, zone.y + Math.max(0, Math.min(1, lv)) * zone.h));
    uvArr[i * 2] = u;
    uvArr[i * 2 + 1] = w;
  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
}

/**
 * Builds an automotive vinyl-shop "Speedform" (curved aerodynamic paint sample hood)
 * used ONLY when no real .GLB/.GLTF model is cached in IndexedDB or present in /models/.
 * Uses a single smooth double-curved surface (zero blocky car primitives).
 */
function createSpeedformSurfaceGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(3.5, 2.5, 64, 48);
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); // -1.75 .. +1.75
    const y = pos.getY(i); // -1.25 .. +1.25
    const nx = x / 1.75; // -1 .. +1
    const ny = y / 1.25; // -1 (bottom/front) .. +1 (top/rear)

    // Smooth automotive hood double curvature + sculpted power-bulge character lines
    const archX = 0.24 * (1 - nx * nx);
    const archY = 0.16 * (1 - ny * ny);
    const powerBulge = 0.055 * Math.exp(-Math.pow((Math.abs(nx) - 0.34) / 0.18, 2)) * (0.45 + 0.55 * (1 - ny * ny));
    const centerCrease = 0.025 * Math.exp(-Math.pow(nx / 0.14, 2)) * (1 - ny * ny);
    const z = archX + archY + powerBulge + centerCrease;

    pos.setXYZ(i, x, y, z);

    // Non-flipped 1:1 UV for CanvasTexture.flipY = false:
    // u = 0..1 left -> right, v = 0..1 top -> bottom
    const uCoord = (nx + 1) * 0.5;
    const vCoord = (1 - ny) * 0.5;
    uv.setXY(i, uCoord, vCoord);
  }

  // Rotate into a sleek tilted showroom hood display angle (resting cleanly above the floor)
  geo.rotateX(-Math.PI * 0.34);
  geo.computeVertexNormals();
  return geo;
}

export class WebGLPreviewEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private carGroup: THREE.Group | null = null;

  private paintMaterial: THREE.MeshPhysicalMaterial | null = null;
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
  private isSpeedformFallback = true;
  private loadRequestId = 0;
  private originalUvs = new WeakMap<THREE.BufferGeometry, THREE.BufferAttribute>();
  private missingBasePaths = new Set<string>();
  private meshLabel = "Muestra de Pintura Speedform PBR · Carga tu modelo 3D real (.GLB / .GLTF)";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.specPackedCanvas = document.createElement("canvas");
    this.specPackedCanvas.width = 512;
    this.specPackedCanvas.height = 512;
    this.initScene();
  }

  private initScene(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color("#090d14");
      this.scene.fog = new THREE.Fog("#090d14", 11, 26);

      // Studio HDRI environment reflections via PMREMGenerator
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();

      this.camera = new THREE.PerspectiveCamera(36, 16 / 10, 0.1, 100);
      this.camera.position.set(3.8, 1.6, 4.1);

      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.065;
      this.controls.maxPolarAngle = Math.PI * 0.485;
      this.controls.minDistance = 2.2;
      this.controls.maxDistance = 10.5;
      this.controls.target.set(0, 0.6, 0);

      // Automotive showroom studio lighting with PCFSoftShadowMap
      this.hemiLight = new THREE.HemisphereLight("#e6f0ff", "#141c28", 0.75);
      this.scene.add(this.hemiLight);

      this.keyLight = new THREE.DirectionalLight("#ffffff", 2.35);
      this.keyLight.position.set(4.5, 8.5, 5.2);
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(1024, 1024);
      this.keyLight.shadow.camera.near = 1;
      this.keyLight.shadow.camera.far = 22;
      this.keyLight.shadow.camera.left = -4.5;
      this.keyLight.shadow.camera.right = 4.5;
      this.keyLight.shadow.camera.top = 4.5;
      this.keyLight.shadow.camera.bottom = -4.5;
      this.keyLight.shadow.bias = -0.0004;
      this.keyLight.shadow.radius = 4;
      this.scene.add(this.keyLight);

      this.fillLight = new THREE.DirectionalLight("#b8d8ff", 0.95);
      this.fillLight.position.set(-6, 4.2, -3.5);
      this.scene.add(this.fillLight);

      this.rimLight = new THREE.DirectionalLight("#00e699", 0.48);
      this.rimLight.position.set(0, 3.8, -6.5);
      this.scene.add(this.rimLight);

      // Subtle reflective dark showroom studio floor (roughness: 0.35, metalness: 0.2)
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(18, 64),
        new THREE.MeshStandardMaterial({
          color: "#101620",
          roughness: 0.35,
          metalness: 0.2,
          envMapIntensity: 0.9,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.scene.add(floor);

      const grid = new THREE.GridHelper(20, 40, "#1d2c40", "#131c29");
      grid.position.y = 0.002;
      this.scene.add(grid);

      // Physical Clearcoat Paint Material (connected live to 2D Canvas + Spec Map)
      this.carbonBumpTexture = createCarbonBumpTexture();
      this.paintMaterial = new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.2,
        metalness: 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.6,
        bumpScale: 0.004,
      });

      this.setLightingPreset("noon");
      this.buildAutomotiveSpeedform();
      this.startLoop();
    } catch {
      this.renderer = null;
    }
  }

  /**
   * Renders a clean, double-curved automotive vinyl-shop "Speedform" paint sample hood
   * (zero blocky car shapes) and shows the prominent CTA to load a real .GLB/.GLTF car.
   */
  private buildAutomotiveSpeedform(): void {
    if (!this.scene || !this.paintMaterial) return;
    this.clearCarGroup();

    const group = new THREE.Group();
    const speedformGeo = createSpeedformSurfaceGeometry();
    const speedformMesh = new THREE.Mesh(speedformGeo, this.paintMaterial);
    speedformMesh.name = "speedform_paint_sample";
    speedformMesh.castShadow = true;
    speedformMesh.receiveShadow = true;
    group.add(speedformMesh);

    // Center neatly above the reflective studio floor
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.set(-center.x, -box.min.y + 0.14, -center.z);
    group.updateMatrixWorld(true);

    this.carGroup = group;
    this.hasCustomModel = false;
    this.isSpeedformFallback = true;
    this.scene.add(group);

    this.meshLabel = "Speedform de Estudio Automotriz · Carga un .GLB / .GLTF real (se guarda en IndexedDB por coche)";
    this.syncNoticeDom();
    this.syncEmptyCtaDom(true);
    this.render();
  }

  /**
   * Attempts to load an optional category base .GLB from public/models/{gt3,gtp,formula}-base.glb.
   * If not present, cleanly falls back to the Automotive Speedform without errors or blocky cars.
   */
  public async loadGlbFromUrl(url: string): Promise<boolean> {
    const reqId = ++this.loadRequestId;
    try {
      const res = await fetch(url, { cache: "default" });
      if (!res.ok || reqId !== this.loadRequestId) return false;
      const buffer = await res.arrayBuffer();
      if (reqId !== this.loadRequestId) return false;
      const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
      const isGlb = bytes.length === 4 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
      const isGltfJson = bytes.length > 0 && bytes[0] === 0x7b;
      if (!isGlb && !isGltfJson) return false;
      await this.loadGltfBuffer(buffer, (url.split("/").pop() || "model.glb").split("?")[0], false, true);
      return true;
    } catch (err) {
      console.warn("[skins-3d] loadGlbFromUrl failed:", url, err);
      return false;
    }
  }

  public async tryLoadCategoryBaseModel(category: CarBodyCategory, carSlug = ""): Promise<boolean> {
    this.currentCategory = category;
    const reqId = ++this.loadRequestId;
    const slugKey = (carSlug || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const manifestModels = (modelsManifest?.models || {}) as Record<string, string>;
    const candidates = Array.from(
      new Set(
        [
          slugKey && manifestModels[slugKey] ? manifestModels[slugKey] : "",
          resolveBrandSpecificGlb(slugKey),
          CATEGORY_BASE_GLB_PATHS[category],
          category === "formula" ? `${MODELS_CDN_BASE}/formula-v2.glb?${MODEL_VER}` : `${MODELS_CDN_BASE}/fordmustanggt3-v2.glb?${MODEL_VER}`,
        ].filter(Boolean),
      ),
    );

    for (const url of candidates) {
      if (reqId !== this.loadRequestId) return false;
      if (this.missingBasePaths.has(url)) continue;
      try {
        const res = await fetch(url, { cache: "default" });
        if (reqId !== this.loadRequestId) return false;
        if (!res.ok) {
          this.missingBasePaths.add(url);
          continue;
        }
        const buffer = await res.arrayBuffer();
        if (reqId !== this.loadRequestId) return false;
        const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
        const isGlb = bytes.length === 4 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
        const isGltfJson = bytes.length > 0 && bytes[0] === 0x7b;
        if (!isGlb && !isGltfJson) {
          this.missingBasePaths.add(url);
          continue;
        }
        await this.loadGltfBuffer(buffer, (url.split("/").pop() || `${category}-base.glb`).split("?")[0], false, true);
        return true;
      } catch (err) {
        console.warn("[skins-3d] Base GLB load failed:", url, err);
        this.missingBasePaths.add(url);
      }
    }

    if (reqId === this.loadRequestId) this.buildAutomotiveSpeedform();
    return false;
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
    if (!this.carGroup || !this.paintMaterial || this.isSpeedformFallback) return;
    this.carGroup.updateMatrixWorld(true);
    const carBox = new THREE.Box3().setFromObject(this.carGroup);
    const paintMat = this.paintMaterial;

    this.carGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || obj.material !== paintMat) return;
      const geo = obj.geometry;
      if (!geo) return;

      if (!this.originalUvs.has(geo)) {
        const uvAttr = geo.getAttribute("uv");
        if (uvAttr instanceof THREE.BufferAttribute) {
          this.originalUvs.set(geo, uvAttr.clone());
        }
      }

      if (this.uvMappingMode === "native") {
        const orig = this.originalUvs.get(geo);
        if (orig) {
          geo.setAttribute("uv", orig.clone());
          return;
        }
      }
      applyIracingAutoFitUVs(obj, carBox, this.currentZones);
    });
  }

  private syncNoticeDom(): void {
    const notice = document.getElementById("skGlNotice");
    if (notice) notice.textContent = this.meshLabel;
  }

  private syncEmptyCtaDom(show: boolean): void {
    const cta = document.getElementById("skGlSpeedformCta");
    if (cta) cta.classList.toggle("sk-hidden", !show);
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
  }

  public updateZones(zones: Record<ZoneKey, UvRect>): void {
    this.currentZones = { ...DEFAULT_ZONES, ...zones };
    if (!this.isSpeedformFallback && this.uvMappingMode === "autofit") {
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
      this.scene.background = new THREE.Color("#140f17");
      this.scene.fog = new THREE.Fog("#140f17", 11, 26);
      this.keyLight.color.set("#ffad66");
      this.keyLight.intensity = 2.6;
      this.keyLight.position.set(7, 3.4, 5);
      this.fillLight.color.set("#5c7cba");
      this.fillLight.intensity = 0.8;
      this.rimLight.color.set("#ff6b4a");
      this.rimLight.intensity = 1.1;
      this.hemiLight.color.set("#ffcca8");
      this.hemiLight.groundColor.set("#1c1524");
      this.hemiLight.intensity = 0.75;
      this.renderer.toneMappingExposure = 1.16;
    } else if (preset === "overcast") {
      this.scene.background = new THREE.Color("#151d28");
      this.scene.fog = new THREE.Fog("#151d28", 13, 28);
      this.keyLight.color.set("#eef5ff");
      this.keyLight.intensity = 1.75;
      this.keyLight.position.set(2, 9, 4);
      this.fillLight.color.set("#d4e4f7");
      this.fillLight.intensity = 1.25;
      this.rimLight.color.set("#94b8db");
      this.rimLight.intensity = 0.72;
      this.hemiLight.color.set("#e2ecfa");
      this.hemiLight.groundColor.set("#283446");
      this.hemiLight.intensity = 1.15;
      this.renderer.toneMappingExposure = 1.06;
    } else {
      this.scene.background = new THREE.Color("#090d14");
      this.scene.fog = new THREE.Fog("#090d14", 11, 26);
      this.keyLight.color.set("#ffffff");
      this.keyLight.intensity = 2.35;
      this.keyLight.position.set(4.5, 8.5, 5.2);
      this.fillLight.color.set("#b8d8ff");
      this.fillLight.intensity = 0.95;
      this.rimLight.color.set("#00e699");
      this.rimLight.intensity = 0.48;
      this.hemiLight.color.set("#e6f0ff");
      this.hemiLight.groundColor.set("#141c28");
      this.hemiLight.intensity = 0.75;
      this.renderer.toneMappingExposure = 1.15;
    }
  }

  public setCameraPreset(preset: "front34" | "side" | "rear34" | "top"): void {
    if (!this.camera || !this.controls) return;
    if (preset === "front34") {
      this.camera.position.set(3.8, 1.55, 4.1);
      this.controls.target.set(0, 0.58, 0);
    } else if (preset === "side") {
      this.camera.position.set(5.4, 1.15, 0.05);
      this.controls.target.set(0, 0.58, 0);
    } else if (preset === "rear34") {
      this.camera.position.set(-3.8, 1.6, -4.2);
      this.controls.target.set(0, 0.6, 0);
    } else {
      this.camera.position.set(0.01, 5.8, 0.35);
      this.controls.target.set(0, 0.35, 0);
    }
    this.controls.update();
  }

  public updateTexture(
    diffuseCanvas: HTMLCanvasElement,
    metallicPct: number,
    roughnessPct: number,
    specCanvas?: HTMLCanvasElement | null,
    clearcoatPct = 85,
    carbonWeave = false,
  ): void {
    if (!this.paintMaterial) return;

    if (!this.diffuseTexture || this.diffuseTexture.image !== diffuseCanvas) {
      this.diffuseTexture?.dispose();
      const tex = new THREE.CanvasTexture(diffuseCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false; // Standard glTF orientation: zero upside-down/mirrored text
      tex.anisotropy = this.renderer ? Math.min(16, this.renderer.capabilities.getMaxAnisotropy()) : 8;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      this.diffuseTexture = tex;
      this.paintMaterial.map = tex;
      this.paintMaterial.needsUpdate = true;
    } else {
      this.diffuseTexture.needsUpdate = true;
    }

    if (specCanvas) {
      const sw = this.specPackedCanvas.width;
      const sh = this.specPackedCanvas.height;
      const ctx = this.specPackedCanvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(specCanvas, 0, 0, sw, sh);
        const img = ctx.getImageData(0, 0, sw, sh);
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
    this.paintMaterial.clearcoatRoughness = Math.max(0.04, Math.min(0.85, (roughnessPct / 100) * 0.4));
  }

  public async loadGltfBuffer(
    buffer: ArrayBuffer,
    filename: string,
    fromCache = false,
    isBaseModel = false,
  ): Promise<void> {
    if (!this.scene || !this.paintMaterial) {
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

    // Apply live paint ONLY to exterior bodywork panels; refine blown-out base GLB rims/tires/glass into realistic motorsport PBR
    const gunmetalRimMat = new THREE.MeshStandardMaterial({ color: "#2b323d", roughness: 0.28, metalness: 0.86, envMapIntensity: 1.2 });
    const rubberTireMat = new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 0.88, metalness: 0.06 });
    const smokedGlassMat = new THREE.MeshPhysicalMaterial({ color: "#0b121c", roughness: 0.08, metalness: 0.12, transparent: true, opacity: 0.78, clearcoat: 1.0 });

    let paintedCount = 0;
    let preservedCount = 0;
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (shouldHideStockDecalMesh(obj, isBaseModel)) {
        obj.visible = false;
        return;
      }
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (isPaintableBodyMesh(obj)) {
        obj.material = this.paintMaterial!;
        paintedCount++;
      } else {
        if (isBaseModel && filename === "gt3-base.glb") {
          const id = `${(obj.name || "").toLowerCase()} ${getMeshMaterialNames(obj)}`;
          if (/(rim1|rim2|wheel|alloy)/.test(id)) obj.material = gunmetalRimMat;
          else if (/(tireside|tiretread|tire|tyre)/.test(id)) obj.material = rubberTireMat;
          else if (/(glass|windshield)/.test(id)) obj.material = smokedGlassMat;
        }
        preservedCount++;
      }
    });

    this.clearCarGroup();
    const wrapper = new THREE.Group();
    wrapper.add(root);
    this.carGroup = wrapper;
    this.hasCustomModel = !isBaseModel;
    this.isSpeedformFallback = false;
    this.scene.add(wrapper);
    this.reapplyCurrentUvMapping();

    const originTag = isBaseModel
      ? "modelo base de categoría"
      : fromCache
        ? "cargado de IndexedDB"
        : "guardado en IndexedDB local";
    this.meshLabel = `Modelo 3D real: ${filename} (${paintedCount} paneles pintables · ${preservedCount} piezas originales preservadas · ${originTag})`;
    this.syncNoticeDom();
    this.syncEmptyCtaDom(false);
    this.render();
  }

  public async loadGltfFile(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    await this.loadGltfBuffer(buffer, file.name, false, false);
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
    const mesh = new THREE.Mesh(geo, this.paintMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wrapper.add(mesh);
    this.carGroup = wrapper;
    this.hasCustomModel = true;
    this.isSpeedformFallback = false;
    this.scene.add(wrapper);
    this.reapplyCurrentUvMapping();
    this.meshLabel = `Malla .OBJ local: ${filename}`;
    this.syncNoticeDom();
    this.syncEmptyCtaDom(false);
    this.render();
  }

  public resetToProofingBuck(): void {
    this.hasCustomModel = false;
    this.buildAutomotiveSpeedform();
  }

  public setAutoRotate(enabled: boolean): void {
    if (!this.controls) return;
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 1.6;
  }

  public captureScreenshotPng(filename: string): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
