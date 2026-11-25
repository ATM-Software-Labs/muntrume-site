/**
 * Lightweight zero-dependency WebGL 3D Orbital Previewer for skins.muntru.me.
 * - Supports loading real user-provided Wavefront .OBJ car meshes (v / vt / vn / f).
 * - When no exact car .OBJ mesh is loaded, renders an honest Curved Studio Proofing Buck
 *   (aerodynamic speedform wrap) with real-time PBR-inspired metallic/roughness shading
 *   using the live skin diffuse canvas and spec map.
 */

interface MeshBuffers {
  vertexBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  vertexCount: number;
  isCustomObj: boolean;
  label: string;
}

const VERT_SRC = `
attribute vec3 aPos;
attribute vec2 aUv;
attribute vec3 aNorm;
uniform mat4 uMvp;
uniform mat4 uModel;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vUv = aUv;
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

void main() {
  vec3 base = texture2D(uDiffuse, vUv).rgb;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);

  vec3 L1 = normalize(vec3(2.5, 4.2, 3.0));
  vec3 L2 = normalize(vec3(-3.0, 2.0, -2.5));

  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0) * 0.45;
  float hemi = 0.24 + 0.18 * (N.y * 0.5 + 0.5);

  vec3 H1 = normalize(L1 + V);
  float shininess = mix(96.0, 8.0, clamp(uRoughness, 0.0, 1.0));
  float spec1 = pow(max(dot(N, H1), 0.0), shininess) * mix(0.25, 0.95, 1.0 - uRoughness);

  vec3 specTint = mix(vec3(1.0), base, clamp(uMetallic, 0.0, 1.0));
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * (0.18 + 0.35 * (1.0 - uRoughness));

  vec3 color = base * (hemi + diff1 * 0.78 + diff2) + specTint * (spec1 + fresnel * 0.55);
  gl_FragColor = vec4(color, 1.0);
}
`;

function buildSpeedformBuck(): { positions: Float32Array; uvs: Float32Array; normals: Float32Array } {
  // Smooth aerodynamic curved studio proofing buck (honest UV wrap stage)
  const segU = 48;
  const segV = 36;
  const pos: number[] = [];
  const uvs: number[] = [];
  const norms: number[] = [];

  const evalPoint = (u: number, v: number): [number, number, number] => {
    const x = (u - 0.5) * 2.6;
    const z = (v - 0.5) * 3.2;
    const archX = Math.cos((u - 0.5) * Math.PI * 0.92);
    const roofProfile = Math.sin(v * Math.PI);
    const hoodSlope = v < 0.38 ? Math.pow(v / 0.38, 0.85) : 1.0 - Math.max(0, (v - 0.65) / 0.35) * 0.32;
    const y = archX * (0.52 * roofProfile + 0.32 * hoodSlope) - 0.28;
    return [x, y, z];
  };

  const evalNormal = (u: number, v: number): [number, number, number] => {
    const eps = 0.005;
    const p0 = evalPoint(u, v);
    const pu = evalPoint(Math.min(1, u + eps), v);
    const pv = evalPoint(u, Math.min(1, v + eps));
    const tu = [pu[0] - p0[0], pu[1] - p0[1], pu[2] - p0[2]];
    const tv = [pv[0] - p0[0], pv[1] - p0[1], pv[2] - p0[2]];
    // cross(tv, tu) pointing upward
    const nx = tv[1] * tu[2] - tv[2] * tu[1];
    const ny = tv[2] * tu[0] - tv[0] * tu[2];
    const nz = tv[0] * tu[1] - tv[1] * tu[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  };

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const u0 = iu / segU;
      const u1 = (iu + 1) / segU;
      const v0 = iv / segV;
      const v1 = (iv + 1) / segV;

      const corners: Array<[number, number]> = [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v0],
        [u1, v1],
        [u0, v1],
      ];

      for (const [cu, cv] of corners) {
        const p = evalPoint(cu, cv);
        const n = evalNormal(cu, cv);
        pos.push(p[0], p[1], p[2]);
        uvs.push(cu, cv);
        norms.push(n[0], n[1], n[2]);
      }
    }
  }

  return {
    positions: new Float32Array(pos),
    uvs: new Float32Array(uvs),
    normals: new Float32Array(norms),
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

    this.uploadGeometry(buildSpeedformBuck(), false, "Superficie curva de pruebas UV (carga un .OBJ para malla exacta)");
  }

  private uploadGeometry(
    geo: { positions: Float32Array; uvs: Float32Array; normals: Float32Array },
    isCustomObj: boolean,
    label: string,
  ): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.mesh) {
      gl.deleteBuffer(this.mesh.vertexBuffer);
      gl.deleteBuffer(this.mesh.uvBuffer);
      gl.deleteBuffer(this.mesh.normalBuffer);
    }

    const vertexBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();
    const normalBuffer = gl.createBuffer();
    if (!vertexBuffer || !uvBuffer || !normalBuffer) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);

    this.mesh = {
      vertexBuffer,
      uvBuffer,
      normalBuffer,
      vertexCount: geo.positions.length / 3,
      isCustomObj,
      label,
    };
    this.render();
  }

  public loadObjMesh(objText: string, filename: string): void {
    const geo = parseWavefrontObj(objText);
    this.uploadGeometry(geo, true, `Malla 3D cargada: ${filename}`);
  }

  public resetToProofingBuck(): void {
    this.uploadGeometry(buildSpeedformBuck(), false, "Superficie curva de pruebas UV (carga un .OBJ para malla exacta)");
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
