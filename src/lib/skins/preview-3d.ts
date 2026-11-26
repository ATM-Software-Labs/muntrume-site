/**
 * Studio-Grade 2D -> 3D Motorsport Showroom Engine powered by Three.js for skins.muntru.me.
 * - Loads a real high-detail GT car model (/assets/models/gt-showroom.glb, Three.js MIT)
 *   with local Draco WASM decoding (/assets/draco/) — zero external CDN dependencies.
 * - Applies clean studio planar UV projection on the car bodywork mesh so any live 2D paint,
 *   metallic/pearl gradient, forged/twill carbon, or subtle camo wraps seamlessly with PBR
 *   clearcoat, roughness, metalness, and RoomEnvironment studio reflections.
 * - Supports 4 camera presets, 3 studio lighting presets, OrbitControls, and client-side
 *   .GLB / .GLTF / .OBJ local model loading via URL.createObjectURL.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ZoneKey, ZoneRect } from "./types";

export type CarBodyCategory = "gt3" | "gtp" | "formula" | "touring";
export type LightingPreset = "noon" | "sunset" | "overcast";

type UvRect = Pick<ZoneRect, "x" | "y" | "w" | "h">;

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
    grad.addColorStop(0.55, "rgba(0,0,0,0.38)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Generates clean seamless planar UV coordinates (X/Z normalized across the car bounding box)
 * for bodywork meshes so live 2D studio finishes wrap cleanly across hood, roof and fenders.
 */
function applyCleanBodyUVs(mesh: THREE.Mesh, carBox: THREE.Box3): void {
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  if (!pos) return;
  const min = carBox.min;
  const spanX = Math.max(0.001, carBox.max.x - min.x);
  const spanZ = Math.max(0.001, carBox.max.z - min.z);
  const uvArr = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const u = Math.max(0.001, Math.min(0.999, (v.x - min.x) / spanX));
    const w = Math.max(0.001, Math.min(0.999, (v.z - min.z) / spanZ));
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
  private detailsMaterial: THREE.MeshStandardMaterial | null = null;
  private diffuseTexture: THREE.CanvasTexture | null = null;
  private carbonBumpTexture: THREE.CanvasTexture | null = null;
  private specPackedCanvas: HTMLCanvasElement;
  private specPackedTexture: THREE.CanvasTexture | null = null;

  private keyLight: THREE.DirectionalLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;

  private rafId = 0;
  private isCustomModel = false;
  private meshLabel = "Cargando coche 3D GT de estudio (.GLB)...";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.specPackedCanvas = document.createElement("canvas");
    this.specPackedCanvas.width = 256;
    this.specPackedCanvas.height = 256;
    this.initScene();
  }

  private createGltfLoader(): GLTFLoader {
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    return loader;
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

      // Studio lighting rig
      this.hemiLight = new THREE.HemisphereLight("#e2eeff", "#151b26", 0.75);
      this.scene.add(this.hemiLight);

      this.keyLight = new THREE.DirectionalLight("#ffffff", 2.1);
      this.keyLight.position.set(5, 8, 5);
      this.scene.add(this.keyLight);

      this.fillLight = new THREE.DirectionalLight("#b8d8ff", 0.85);
      this.fillLight.position.set(-6, 4, -3);
      this.scene.add(this.fillLight);

      this.rimLight = new THREE.DirectionalLight("#00e699", 0.4);
      this.rimLight.position.set(0, 3.5, -7);
      this.scene.add(this.rimLight);

      // Clean dark studio floor + subtle grid
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(16, 64),
        new THREE.MeshStandardMaterial({
          color: "#111824",
          roughness: 0.42,
          metalness: 0.28,
        }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      this.scene.add(floor);

      const grid = new THREE.GridHelper(20, 40, "#1f2e42", "#141d2b");
      grid.position.y = 0.002;
      this.scene.add(grid);

      // Soft contact shadow directly beneath the car
      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 5.2),
        new THREE.MeshBasicMaterial({
          map: createContactShadowTexture(),
          transparent: true,
          depthWrite: false,
          opacity: 0.85,
        }),
      );
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.004;
      this.scene.add(shadowPlane);

      // PBR Showroom Materials
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

      this.detailsMaterial = new THREE.MeshStandardMaterial({
        color: "#1a202c",
        metalness: 0.75,
        roughness: 0.32,
      });

      this.glassMaterial = new THREE.MeshPhysicalMaterial({
        color: "#0c1420",
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.72,
        transparent: true,
        opacity: 0.85,
        ior: 1.5,
        reflectivity: 0.9,
      });

      this.setLightingPreset("noon");
      void this.loadDefaultGtShowroomModel();
      this.startLoop();
    } catch {
      this.renderer = null;
    }
  }

  private async loadDefaultGtShowroomModel(): Promise<void> {
    if (!this.scene || !this.paintMaterial || !this.glassMaterial || !this.detailsMaterial) return;
    try {
      const loader = this.createGltfLoader();
      const gltf = await loader.loadAsync("/assets/models/gt-showroom.glb");
      const root = gltf.scene;

      // Normalize to exact showroom scale and rest tires flush on y = 0
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxSpan = Math.max(size.x, size.y, size.z) || 1;
      const scale = 4.4 / maxSpan;
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      root.updateMatrixWorld(true);

      const finalBox = new THREE.Box3().setFromObject(root);
      const paintMat = this.paintMaterial;
      const glassMat = this.glassMaterial;
      const detailMat = this.detailsMaterial;

      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const name = (obj.name || "").toLowerCase();
        const matName =
          !Array.isArray(obj.material) && obj.material && "name" in obj.material
            ? String(obj.material.name || "").toLowerCase()
            : "";

        if (name === "body" || matName === "body" || matName.includes("carpaint") || matName.includes("paint")) {
          applyCleanBodyUVs(obj, finalBox);
          obj.material = paintMat;
        } else if (name.includes("glass") || matName.includes("glass")) {
          obj.material = glassMat;
        } else if (name.includes("rim") || matName.includes("rim")) {
          obj.material = detailMat;
        }
      });

      this.clearCarGroup();
      const wrapper = new THREE.Group();
      wrapper.add(root);
      this.carGroup = wrapper;
      this.scene.add(wrapper);
      this.isCustomModel = false;
      this.meshLabel = "Showroom 3D GT Real (Three.js PBR + reflejos de estudio · arrastra para orbitar)";
    } catch {
      this.meshLabel = "No se pudo cargar /assets/models/gt-showroom.glb — carga tu .GLB/.OBJ local.";
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

  public setCategory(_category: CarBodyCategory): void {
    // Real GT showroom model stays active regardless of category; user can load custom GLB/OBJ anytime.
  }

  public updateZones(_zones: Record<ZoneKey, UvRect>): void {
    // Planar studio UVs on the real GLB stay clean and undistorted.
  }

  public setLightingPreset(preset: LightingPreset): void {
    if (!this.scene || !this.keyLight || !this.fillLight || !this.rimLight || !this.hemiLight || !this.renderer) return;
    if (preset === "sunset") {
      this.scene.background = new THREE.Color("#161119");
      this.scene.fog = new THREE.Fog("#161119", 12, 26);
      this.keyLight.color.set("#ffad66");
      this.keyLight.intensity = 2.6;
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
      // Mediodía / Showroom limpio
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

  public async loadGltfFile(file: File): Promise<void> {
    if (!this.scene || !this.paintMaterial) throw new Error("Visor Three.js no inicializado.");
    const blobUrl = URL.createObjectURL(file);
    try {
      const loader = this.createGltfLoader();
      const gltf = await loader.loadAsync(blobUrl);
      const root = gltf.scene;

      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxSpan = Math.max(size.x, size.y, size.z) || 1;
      const scale = 4.4 / maxSpan;
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

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
      const s = 4.4 / (Math.max(sz.x, sz.y, sz.z) || 1);
      geo.scale(s, s, s);
      geo.translate(0, -bb.min.y * s, 0);
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
    void this.loadDefaultGtShowroomModel();
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
