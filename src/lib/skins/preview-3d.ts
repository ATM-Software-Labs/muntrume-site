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

    // Normalized longitudinal (0=rear, 1=front), lateral (0=left, 1=right), vertical (0=bottom, 1=top)
    const along = longIsZ ? (v.z - min.z) / spanZ : (v.x - min.x) / spanX;
    const across = longIsZ ? (v.x - min.x) / spanX : (v.z - min.z) / spanZ;
    const up = (v.y - min.y) / spanY;

    const absLat = Math.abs(longIsZ ? n.x : n.z);
    const absLong = Math.abs(longIsZ ? n.z : n.x);
    const absUp = Math.abs(n.y);

    let zone: UvRect;
    let lu = 0.5;
    let lv = 0.5;

    if (up > 0.72 && along < 0.18) {
      // Rear wing top / endplates
      zone = zones.rearWing;
      lu = across;
      lv = Math.min(1, along / 0.18);
    } else if (absLong > absLat && absLong > absUp && along > 0.82) {
      // Front bumper
      zone = zones.frontBumper;
      lu = across;
      lv = 1 - up;
    } else if (absLong > absLat && absLong > absUp && along < 0.16) {
      // Rear bumper
      zone = zones.rearBumper;
      lu = across;
      lv = 1 - up;
    } else if (absLat > absUp * 0.92 && (across < 0.45 || across > 0.55)) {
      // Left or right side doors / fenders
      const isLeft = across < 0.5;
      zone = isLeft ? zones.leftSide : zones.rightSide;
      lu = isLeft ? 1 - along : along;
      lv = 1 - up;
    } else if (along > 0.54) {
      // Hood (front deck)
      zone = zones.hood;
      lu = across;
      lv = 1 - Math.max(0, Math.min(1, (along - 0.54) / 0.46));
    } else {
      // Roof / rear engine deck
      zone = zones.roof;
      lu = across;
      lv = 1 - Math.max(0, Math.min(1, along / 0.54));
    }

    const u = Math.max(0.001, Math.min(0.999, zone.x + Math.max(0, Math.min(1, lu)) * zone.w));
    const w = Math.max(0.001, Math.min(0.999, zone.y + Math.max(0, Math.min(1, lv)) * zone.h));
    uvArr[i * 2] = u;
    uvArr[i * 2 + 1] = w;
  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
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
   * Builds a clean, closed, zero-floating-parts motorsport bodywork matching the car category
   * whenever no user .GLB model is stored in IndexedDB for the current car_slug.
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
    const bodyWidth = isFormula ? 1.02 : isGtp ? 1.96 : 1.92;
    const bodyLen = isFormula ? 4.8 : isGtp ? 4.82 : 4.52;

    // 1. Closed side-profile silhouette extruded smoothly across width
    const profile = new THREE.Shape();
    if (isFormula) {
      profile.moveTo(-2.35, 0.14);
      profile.lineTo(-1.25, 0.32);
      profile.lineTo(-0.25, 0.56);
      profile.lineTo(0.45, 0.92);
      profile.lineTo(1.55, 0.62);
      profile.lineTo(2.25, 0.42);
      profile.lineTo(2.25, 0.14);
    } else if (isGtp) {
      profile.moveTo(-2.38, 0.14);
      profile.lineTo(-2.16, 0.56);
      profile.lineTo(-1.22, 0.68);
      profile.lineTo(-0.52, 1.06);
      profile.lineTo(0.48, 1.04);
      profile.lineTo(1.74, 0.72);
      profile.lineTo(2.36, 0.62);
      profile.lineTo(2.36, 0.16);
    } else {
      // Closed GT3 / Touring coupe silhouette
      profile.moveTo(-2.22, 0.14);
      profile.lineTo(-2.06, 0.58);
      profile.lineTo(-1.16, 0.74);
      profile.lineTo(-0.46, 1.22);
      profile.lineTo(0.62, 1.20);
      profile.lineTo(1.52, 0.84);
      profile.lineTo(2.22, 0.76);
      profile.lineTo(2.22, 0.18);
    }
    profile.closePath();

    const bodyGeo = new THREE.ExtrudeGeometry(profile, {
      depth: bodyWidth,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 4,
      curveSegments: 16,
    });
    bodyGeo.translate(0, 0, -bodyWidth / 2);
    bodyGeo.rotateY(Math.PI / 2);
    bodyGeo.computeVertexNormals();
    const bodyMesh = new THREE.Mesh(bodyGeo, this.paintMaterial);
    bodyMesh.name = "body";
    group.add(bodyMesh);

    // 2. Closed cabin glass canopy flush with the roof
    if (!isFormula) {
      const canopyGeo = new THREE.BoxGeometry(bodyWidth * 0.76, isGtp ? 0.32 : 0.40, isGtp ? 1.38 : 1.72);
      const canopy = new THREE.Mesh(canopyGeo, this.glassMaterial);
      canopy.position.set(0, isGtp ? 0.84 : 0.98, isGtp ? 0.08 : -0.06);
      canopy.name = "glass_canopy";
      group.add(canopy);
    }

    // 3. Anchored carbon splitter, floor & rear diffuser
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth + 0.06, 0.05, 0.50), this.carbonMaterial);
    splitter.position.set(0, 0.12, bodyLen / 2 - 0.12);
    group.add(splitter);

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth * 0.92, 0.14, 0.36), this.carbonMaterial);
    diffuser.position.set(0, 0.16, -bodyLen / 2 + 0.10);
    group.add(diffuser);

    // 4. Anchored rear wing (pylons extend firmly into rear deck — zero floating gap)
    const wingY = isFormula ? 0.94 : isGtp ? 1.02 : 1.06;
    const wingZ = -bodyLen / 2 + 0.22;
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(bodyWidth + 0.04, 0.045, 0.30), this.paintMaterial);
    wingBlade.position.set(0, wingY, wingZ);
    wingBlade.rotation.x = 0.08;
    wingBlade.name = "rear_wing";
    group.add(wingBlade);

    for (const side of [-1, 1]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.38), this.paintMaterial);
      endplate.position.set(side * (bodyWidth / 2 + 0.02), wingY - 0.02, wingZ);
      endplate.name = "rear_wing_endplate";
      group.add(endplate);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 0.16), this.carbonMaterial);
      pylon.position.set(side * 0.30, wingY - 0.24, wingZ + 0.04);
      group.add(pylon);
    }

    // 5. GTP Dorsal Shark Fin anchored to roof & rear deck
    if (isGtp) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 1.32), this.paintMaterial);
      fin.position.set(0, 0.88, -1.24);
      fin.name = "shark_fin";
      group.add(fin);
    }

    // 6. Flush LED headlights & taillights
    const tailMat = new THREE.MeshStandardMaterial({ color: "#ef4444", emissive: "#dc2626", emissiveIntensity: 2.0 });
    for (const side of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.08, 0.05), this.lightMaterial);
      hl.position.set(side * (bodyWidth * 0.33), 0.44, bodyLen / 2 + 0.01);
      group.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.07, 0.05), tailMat);
      tl.position.set(side * (bodyWidth * 0.31), 0.60, -bodyLen / 2 - 0.01);
      group.add(tl);
    }

    // 7. Four wheels resting strictly on y = 0 (radius = 0.34 -> center y = 0.34)
    const wheelCoords: Array<[number, number]> = [
      [-bodyWidth * 0.5 - 0.04, bodyLen * 0.31],
      [bodyWidth * 0.5 + 0.04, bodyLen * 0.31],
      [-bodyWidth * 0.5 - 0.04, -bodyLen * 0.31],
      [bodyWidth * 0.5 + 0.04, -bodyLen * 0.31],
    ];
    for (const [wx, wz] of wheelCoords) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 32), this.tireMaterial);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, 0.34, wz);
      group.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.29, 24), this.rimMaterial);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, 0.34, wz);
      group.add(rim);

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.11), this.brakeMaterial);
      caliper.position.set(wx * 0.92, 0.37, wz);
      group.add(caliper);
    }

    // Center strictly at (0, 0, 0) with lowest point on y = 0
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

    const catLabel = category === "gtp" ? "GTP Prototipo" : category === "formula" ? "Fórmula" : category === "touring" ? "Touring" : "GT3";
    this.meshLabel = `Carrocería ${catLabel} PBR · Carga un .GLB / .GLTF real (se guarda en IndexedDB por coche)`;
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
