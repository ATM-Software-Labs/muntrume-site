/**
 * Lightweight zero-dependency WebGL 3D Orbital Previewer for skins.muntru.me.
 * - Supports loading real user-provided Wavefront .OBJ car meshes (v / vt / vn / f).
 * - When no exact car .OBJ mesh is loaded, renders an honest Curved Studio Proofing Buck
 *   (aerodynamic speedform wrap) with real-time PBR-inspired metallic/roughness shading
 *   using the live skin diffuse canvas and spec map.
 */

import type { ZoneKey, ZoneRect } from "./types";

interface MeshBuffers {
  vertexBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  matBuffer: WebGLBuffer;
  vertexCount: number;
  isCustomObj: boolean;
  label: string;
}

const VERT_SRC = `
attribute vec3 aPos;
attribute vec2 aUv;
attribute vec3 aNorm;
attribute float aMat;
uniform mat4 uMvp;
uniform mat4 uModel;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vMat;
void main() {
  vUv = aUv;
  vMat = aMat;
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(uModel) * aNorm);
  gl_Position = uMvp * vec4(aPos, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uDiffuse;
uniform vec3 uCamPos;
uniform float uMetallic;
uniform float uRoughness;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vMat;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);

  vec3 L1 = normalize(vec3(2.8, 4.6, 3.2));
  vec3 L2 = normalize(vec3(-3.2, 2.2, -2.6));

  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0) * 0.42;
  float hemi = 0.26 + 0.20 * (N.y * 0.5 + 0.5);

  vec3 base = texture2D(uDiffuse, vUv).rgb;
  float met = clamp(uMetallic, 0.0, 1.0);
  float rough = clamp(uRoughness, 0.0, 1.0);

  if (vMat > 0.5 && vMat < 1.5) {
    // Tinted cockpit glass
    base = vec3(0.05, 0.08, 0.12);
    met = 0.15;
    rough = 0.08;
  } else if (vMat >= 1.5 && vMat < 2.5) {
    // Matte carbon / rubber tire
    base = vec3(0.06, 0.07, 0.085);
    met = 0.05;
    rough = 0.85;
  } else if (vMat >= 2.5 && vMat < 3.5) {
    // Alloy wheel rim
    base = vec3(0.62, 0.66, 0.72);
    met = 0.85;
    rough = 0.22;
  } else if (vMat >= 3.5) {
    // Headlight / taillight accent
    base = vWorldPos.z > 0.0 ? vec3(0.95, 0.98, 1.0) : vec3(0.92, 0.12, 0.15);
    gl_FragColor = vec4(base, 1.0);
    return;
  }

  vec3 H1 = normalize(L1 + V);
  float shininess = mix(112.0, 10.0, rough);
  float spec1 = pow(max(dot(N, H1), 0.0), shininess) * mix(0.28, 1.0, 1.0 - rough);

  vec3 specTint = mix(vec3(1.0), base, met);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * (0.18 + 0.38 * (1.0 - rough));

  vec3 color = base * (hemi + diff1 * 0.80 + diff2) + specTint * (spec1 + fresnel * 0.55);
  gl_FragColor = vec4(color, 1.0);
}
`;

const DEFAULT_CAR_ZONES: Record<ZoneKey, ZoneRect> = {
  hood: { x: 0.3, y: 0.06, w: 0.4, h: 0.25 },
  roof: { x: 0.34, y: 0.34, w: 0.32, h: 0.22 },
  leftSide: { x: 0.03, y: 0.34, w: 0.27, h: 0.44 },
  rightSide: { x: 0.7, y: 0.34, w: 0.27, h: 0.44 },
  rearWing: { x: 0.27, y: 0.8, w: 0.46, h: 0.11 },
  mirrors: { x: 0.05, y: 0.12, w: 0.18, h: 0.1 },
  frontBumper: { x: 0.25, y: 0.6, w: 0.5, h: 0.09 },
  rearBumper: { x: 0.25, y: 0.7, w: 0.5, h: 0.08 },
};

function buildGt3CarMesh(
  zones: Record<ZoneKey, ZoneRect> = DEFAULT_CAR_ZONES,
): { positions: Float32Array; uvs: Float32Array; normals: Float32Array; mats: Float32Array } {
  const pos: number[] = [];
  const uvs: number[] = [];
  const norms: number[] = [];
  const mats: number[] = [];

  type Vec3 = [number, number, number];
  type Vec2 = [number, number];

  const pushTri = (a: Vec3, b: Vec3, c: Vec3, ua: Vec2, ub: Vec2, uc: Vec2, mat = 0) => {
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = ab[1] * ac[2] - ab[2] * ac[1];
    let ny = ab[2] * ac[0] - ab[0] * ac[2];
    let nz = ab[0] * ac[1] - ab[1] * ac[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    pos.push(...a, ...b, ...c);
    uvs.push(...ua, ...ub, ...uc);
    norms.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    mats.push(mat, mat, mat);
  };

  const pushQuad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, zRect: ZoneRect, mat = 0, flipU = false) => {
    const u0 = flipU ? zRect.x + zRect.w : zRect.x;
    const u1 = flipU ? zRect.x : zRect.x + zRect.w;
    const v0 = zRect.y;
    const v1 = zRect.y + zRect.h;
    pushTri(a, b, c, [u0, v0], [u1, v0], [u1, v1], mat);
    pushTri(a, c, d, [u0, v0], [u1, v1], [u0, v1], mat);
  };

  const pushBox = (
    cx: number, cy: number, cz: number,
    sx: number, sy: number, sz: number,
    zRect: ZoneRect, mat = 0,
  ) => {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    // Top
    pushQuad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], zRect, mat);
    // Bottom
    pushQuad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], zRect, mat);
    // Front (+Z)
    pushQuad([x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], zRect, mat);
    // Back (-Z)
    pushQuad([x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], zRect, mat);
    // Left (-X)
    pushQuad([x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], zRect, mat);
    // Right (+X)
    pushQuad([x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], zRect, mat);
  };

  const pushWheel = (wx: number, wy: number, wz: number) => {
    const segs = 18;
    const r = 0.27;
    const rimR = 0.175;
    const halfW = 0.115;
    const dummy: ZoneRect = { x: 0, y: 0, w: 0.01, h: 0.01 };
    const xIn = wx < 0 ? wx + halfW : wx - halfW;
    const xOut = wx < 0 ? wx - halfW : wx + halfW;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      // Tread
      const p0: Vec3 = [xIn, wy + s0 * r, wz + c0 * r];
      const p1: Vec3 = [xOut, wy + s0 * r, wz + c0 * r];
      const p2: Vec3 = [xOut, wy + s1 * r, wz + c1 * r];
      const p3: Vec3 = [xIn, wy + s1 * r, wz + c1 * r];
      if (wx < 0) pushQuad(p0, p1, p2, p3, dummy, 2);
      else pushQuad(p3, p2, p1, p0, dummy, 2);
      // Outer tire sidewall
      const r0: Vec3 = [xOut, wy + s0 * rimR, wz + c0 * rimR];
      const r1: Vec3 = [xOut, wy + s1 * rimR, wz + c1 * rimR];
      if (wx < 0) pushQuad(p1, r0, r1, p2, dummy, 2);
      else pushQuad(p2, r1, r0, p1, dummy, 2);
      // Outer alloy rim disc
      const center: Vec3 = [xOut + (wx < 0 ? -0.01 : 0.01), wy, wz];
      if (wx < 0) pushTri(center, r1, r0, [0, 0], [0, 0], [0, 0], 3);
      else pushTri(center, r0, r1, [0, 0], [0, 0], [0, 0], 3);
    }
  };

  // Sculpted GT3 dimensions (car faces +Z, width ~1.64, length ~3.56, height ~0.88)
  const wBody = 0.82;
  const wNose = 0.72;
  const wCab = 0.56;
  const yFloor = -0.26;
  const yBeltFront = 0.04;
  const yBeltMid = 0.16;
  const yBeltRear = 0.22;
  const yRoof = 0.52;

  // 1. HOOD (mapped to zones.hood)
  pushQuad(
    [-wNose, yBeltFront, 1.66], [wNose, yBeltFront, 1.66],
    [wBody * 0.94, yBeltMid + 0.02, 0.58], [-wBody * 0.94, yBeltMid + 0.02, 0.58],
    zones.hood, 0,
  );

  // 2. FRONT BUMPER & SPLITTER (mapped to zones.frontBumper)
  pushQuad(
    [-wNose, yBeltFront, 1.66], [wNose, yBeltFront, 1.66],
    [wNose * 1.02, yFloor + 0.06, 1.76], [-wNose * 1.02, yFloor + 0.06, 1.76],
    zones.frontBumper, 0,
  );
  // Carbon front splitter
  pushBox(0, yFloor + 0.03, 1.72, 1.66, 0.04, 0.24, zones.frontBumper, 2);
  // LED Headlights
  pushBox(-0.56, yBeltFront - 0.04, 1.68, 0.26, 0.07, 0.08, zones.frontBumper, 4);
  pushBox(0.56, yBeltFront - 0.04, 1.68, 0.26, 0.07, 0.08, zones.frontBumper, 4);

  // 3. WINDSHIELD (tinted glass)
  pushQuad(
    [-wBody * 0.84, yBeltMid + 0.02, 0.58], [wBody * 0.84, yBeltMid + 0.02, 0.58],
    [wCab, yRoof, 0.06], [-wCab, yRoof, 0.06],
    zones.roof, 1,
  );

  // 4. ROOF (mapped to zones.roof)
  pushQuad(
    [-wCab, yRoof, 0.06], [wCab, yRoof, 0.06],
    [wCab * 0.92, yRoof - 0.03, -0.78], [-wCab * 0.92, yRoof - 0.03, -0.78],
    zones.roof, 0,
  );

  // 5. REAR WINDOW & ENGINE DECK
  pushQuad(
    [-wCab * 0.92, yRoof - 0.03, -0.78], [wCab * 0.92, yRoof - 0.03, -0.78],
    [wBody * 0.86, yBeltRear, -1.48], [-wBody * 0.86, yBeltRear, -1.48],
    zones.roof, 1,
  );
  pushQuad(
    [-wBody * 0.86, yBeltRear, -1.48], [wBody * 0.86, yBeltRear, -1.48],
    [wBody * 0.82, yBeltRear - 0.04, -1.72], [-wBody * 0.82, yBeltRear - 0.04, -1.72],
    zones.rearBumper, 0,
  );

  // 6. LEFT SIDE BODY & DOOR (mapped to zones.leftSide)
  pushQuad(
    [-wBody, yBeltRear, -1.72], [-wNose, yBeltFront, 1.66],
    [-wNose * 1.02, yFloor + 0.06, 1.72], [-wBody, yFloor + 0.06, -1.72],
    zones.leftSide, 0,
  );
  // Left side window
  pushQuad(
    [-wCab * 0.92, yRoof - 0.03, -0.78], [-wCab, yRoof, 0.06],
    [-wBody * 0.88, yBeltMid + 0.02, 0.56], [-wBody * 0.9, yBeltRear, -1.15],
    zones.leftSide, 1,
  );

  // 7. RIGHT SIDE BODY & DOOR (mapped to zones.rightSide)
  pushQuad(
    [wNose, yBeltFront, 1.66], [wBody, yBeltRear, -1.72],
    [wBody, yFloor + 0.06, -1.72], [wNose * 1.02, yFloor + 0.06, 1.72],
    zones.rightSide, 0, true,
  );
  // Right side window
  pushQuad(
    [wCab, yRoof, 0.06], [wCab * 0.92, yRoof - 0.03, -0.78],
    [wBody * 0.9, yBeltRear, -1.15], [wBody * 0.88, yBeltMid + 0.02, 0.56],
    zones.rightSide, 1,
  );

  // 8. REAR BUMPER, TAILLIGHTS & DIFFUSER (mapped to zones.rearBumper)
  pushQuad(
    [wBody * 0.84, yBeltRear - 0.04, -1.72], [-wBody * 0.84, yBeltRear - 0.04, -1.72],
    [-wBody * 0.84, yFloor + 0.14, -1.74], [wBody * 0.84, yFloor + 0.14, -1.74],
    zones.rearBumper, 0,
  );
  pushBox(0, yFloor + 0.07, -1.72, 1.56, 0.14, 0.16, zones.rearBumper, 2);
  pushBox(-0.56, yBeltRear - 0.11, -1.74, 0.34, 0.06, 0.04, zones.rearBumper, 4);
  pushBox(0.56, yBeltRear - 0.11, -1.74, 0.34, 0.06, 0.04, zones.rearBumper, 4);

  // 9. SIDE MIRRORS (mapped to zones.mirrors)
  pushBox(-0.88, yBeltMid + 0.12, 0.34, 0.16, 0.08, 0.12, zones.mirrors, 0);
  pushBox(0.88, yBeltMid + 0.12, 0.34, 0.16, 0.08, 0.12, zones.mirrors, 0);

  // 10. GT3 REAR WING + SWAN-NECK PYLONS + ENDPLATES (mapped to zones.rearWing)
  pushBox(0, yRoof + 0.04, -1.58, 1.62, 0.045, 0.28, zones.rearWing, 0);
  // Endplates
  pushBox(-0.82, yRoof + 0.02, -1.58, 0.03, 0.22, 0.34, zones.rearWing, 2);
  pushBox(0.82, yRoof + 0.02, -1.58, 0.03, 0.22, 0.34, zones.rearWing, 2);
  // Swan-neck uprights
  pushBox(-0.32, yBeltRear + 0.15, -1.54, 0.04, 0.34, 0.12, zones.rearWing, 2);
  pushBox(0.32, yBeltRear + 0.15, -1.54, 0.04, 0.34, 0.12, zones.rearWing, 2);

  // 11. UNDERBODY FLOOR & SIDE SKIRTS
  pushBox(0, yFloor + 0.03, 0, 1.64, 0.05, 3.36, zones.frontBumper, 2);

  // 12. 4 3D WHEELS (front & rear)
  pushWheel(-0.78, yFloor + 0.22, 1.06);
  pushWheel(0.78, yFloor + 0.22, 1.06);
  pushWheel(-0.8, yFloor + 0.22, -1.04);
  pushWheel(0.8, yFloor + 0.22, -1.04);

  return {
    positions: new Float32Array(pos),
    uvs: new Float32Array(uvs),
    normals: new Float32Array(norms),
    mats: new Float32Array(mats),
  };
}

function parseWavefrontObj(objText: string): { positions: Float32Array; uvs: Float32Array; normals: Float32Array } {
  const verts: Array<[number, number, number]> = [];
  const texs: Array<[number, number]> = [];
  const norms: Array<[number, number, number]> = [];
  const outPos: number[] = [];
  const outUv: number[] = [];
  const outNorm: number[] = [];

  const lines = objText.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === "v" && parts.length >= 4) {
      verts.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
    } else if (parts[0] === "vt" && parts.length >= 3) {
      texs.push([Number(parts[1]), 1 - Number(parts[2])]);
    } else if (parts[0] === "vn" && parts.length >= 4) {
      norms.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
    } else if (parts[0] === "f" && parts.length >= 4) {
      const faceVerts = parts.slice(1).map((tok) => {
        const [vi, ti, ni] = tok.split("/").map((n) => (n ? parseInt(n, 10) : 0));
        return { vi, ti, ni };
      });
      for (let i = 1; i + 1 < faceVerts.length; i++) {
        for (const fv of [faceVerts[0], faceVerts[i], faceVerts[i + 1]]) {
          const v = verts[fv.vi > 0 ? fv.vi - 1 : verts.length + fv.vi] ?? [0, 0, 0];
          const t = fv.ti ? texs[fv.ti > 0 ? fv.ti - 1 : texs.length + fv.ti] ?? [0, 0] : [0, 0];
          const n = fv.ni ? norms[fv.ni > 0 ? fv.ni - 1 : norms.length + fv.ni] ?? [0, 1, 0] : [0, 1, 0];
          outPos.push(v[0], v[1], v[2]);
          outUv.push(t[0], t[1]);
          outNorm.push(n[0], n[1], n[2]);
        }
      }
    }
  }

  if (outPos.length < 9) {
    throw new Error("El archivo .OBJ no contiene geometría válida.");
  }

  // Normalize mesh to fit nicely inside [-1.4, 1.4]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < outPos.length; i += 3) {
    if (outPos[i] < minX) minX = outPos[i];
    if (outPos[i] > maxX) maxX = outPos[i];
    if (outPos[i + 1] < minY) minY = outPos[i + 1];
    if (outPos[i + 1] > maxY) maxY = outPos[i + 1];
    if (outPos[i + 2] < minZ) minZ = outPos[i + 2];
    if (outPos[i + 2] > maxZ) maxZ = outPos[i + 2];
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const maxSpan = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const scale = 2.8 / maxSpan;
  for (let i = 0; i < outPos.length; i += 3) {
    outPos[i] = (outPos[i] - cx) * scale;
    outPos[i + 1] = (outPos[i + 1] - cy) * scale;
    outPos[i + 2] = (outPos[i + 2] - cz) * scale;
  }

  return {
    positions: new Float32Array(outPos),
    uvs: new Float32Array(outUv),
    normals: new Float32Array(outNorm),
    mats: new Float32Array(outPos.length / 3),
  };
}

function mat4Perspective(fovRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovRad / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4LookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Float32Array {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export class WebGLPreviewEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private mesh: MeshBuffers | null = null;

  private yaw = 0.62;
  private pitch = 0.48;
  private distance = 4.2;
  private metallic = 0.3;
  private roughness = 0.35;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initWebGL();
    this.bindPointerEvents();
  }

  public isSupported(): boolean {
    return this.gl !== null && this.program !== null;
  }

  public getMeshStatus(): { isCustomObj: boolean; label: string } {
    return this.mesh
      ? { isCustomObj: this.mesh.isCustomObj, label: this.mesh.label }
      : { isCustomObj: false, label: "WebGL no disponible" };
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) return;
    this.gl = gl;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    this.program = prog;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.uploadGeometry(buildGt3CarMesh(), false, "Coche 3D GT3 en tiempo real (arrastra para girar 360° · carga .OBJ para malla exacta)");
  }

  private uploadGeometry(
    geo: { positions: Float32Array; uvs: Float32Array; normals: Float32Array; mats?: Float32Array },
    isCustomObj: boolean,
    label: string,
  ): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.mesh) {
      gl.deleteBuffer(this.mesh.vertexBuffer);
      gl.deleteBuffer(this.mesh.uvBuffer);
      gl.deleteBuffer(this.mesh.normalBuffer);
      gl.deleteBuffer(this.mesh.matBuffer);
    }

    const vertexBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();
    const normalBuffer = gl.createBuffer();
    const matBuffer = gl.createBuffer();
    if (!vertexBuffer || !uvBuffer || !normalBuffer || !matBuffer) return;

    const matsData = geo.mats ?? new Float32Array(geo.positions.length / 3);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, matBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, matsData, gl.STATIC_DRAW);

    this.mesh = {
      vertexBuffer,
      uvBuffer,
      normalBuffer,
      matBuffer,
      vertexCount: geo.positions.length / 3,
      isCustomObj,
      label,
    };
    this.render();
  }

  public updateZones(zones: Record<ZoneKey, ZoneRect>): void {
    if (this.mesh?.isCustomObj) return;
    this.uploadGeometry(
      buildGt3CarMesh(zones),
      false,
      "Coche 3D GT3 en tiempo real (mapeado a las zonas detectadas del coche)",
    );
  }

  public loadObjMesh(objText: string, filename: string): void {
    const geo = parseWavefrontObj(objText);
    this.uploadGeometry(geo, true, `Malla 3D cargada: ${filename}`);
  }

  public resetToProofingBuck(): void {
    this.uploadGeometry(buildGt3CarMesh(), false, "Coche 3D GT3 en tiempo real (arrastra para girar 360°)");
  }

  public setCameraPreset(preset: "front34" | "side" | "rear34" | "top"): void {
    if (preset === "front34") {
      this.yaw = 0.68;
      this.pitch = 0.42;
      this.distance = 4.1;
    } else if (preset === "side") {
      this.yaw = Math.PI / 2;
      this.pitch = 0.25;
      this.distance = 4.3;
    } else if (preset === "rear34") {
      this.yaw = -2.42;
      this.pitch = 0.42;
      this.distance = 4.1;
    } else {
      this.yaw = 0.01;
      this.pitch = 1.38;
      this.distance = 4.2;
    }
    this.render();
  }

  public updateTexture(sourceCanvas: HTMLCanvasElement, metallicPct: number, roughnessPct: number): void {
    const gl = this.gl;
    if (!gl || !this.texture) return;
    this.metallic = metallicPct / 100;
    this.roughness = roughnessPct / 100;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    this.render();
  }

  public render(): void {
    const gl = this.gl;
    const prog = this.program;
    const mesh = this.mesh;
    if (!gl || !prog || !mesh) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(240, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.clearColor(0.04, 0.055, 0.075, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(prog);

    const eye: [number, number, number] = [
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    ];

    const proj = mat4Perspective((42 * Math.PI) / 180, w / h, 0.1, 40);
    const view = mat4LookAt(eye, [0, 0, 0], [0, 1, 0]);
    const model = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const mvp = mat4Multiply(proj, view);

    gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uMvp"), false, mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uModel"), false, model);
    gl.uniform3fv(gl.getUniformLocation(prog, "uCamPos"), new Float32Array(eye));
    gl.uniform1f(gl.getUniformLocation(prog, "uMetallic"), this.metallic);
    gl.uniform1f(gl.getUniformLocation(prog, "uRoughness"), this.roughness);

    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    const aUv = gl.getAttribLocation(prog, "aUv");
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

    const aNorm = gl.getAttribLocation(prog, "aNorm");
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);

    const aMat = gl.getAttribLocation(prog, "aMat");
    if (aMat >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.matBuffer);
      gl.enableVertexAttribArray(aMat);
      gl.vertexAttribPointer(aMat, 1, gl.FLOAT, false, 0, 0);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(prog, "uDiffuse"), 0);

    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
  }

  private bindPointerEvents(): void {
    this.canvas.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.yaw -= dx * 0.008;
      this.pitch = Math.max(0.08, Math.min(1.48, this.pitch + dy * 0.008));
      this.render();
    });
    const endDrag = () => {
      this.dragging = false;
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.distance = Math.max(2.2, Math.min(8.0, this.distance + e.deltaY * 0.003));
        this.render();
      },
      { passive: false },
    );
  }
}
