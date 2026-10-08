// Vertex Animation Textures: bake skinned glTF characters into textures at load time,
// then draw hundreds of animated characters with ONE instanced draw call per character type.
import * as THREE from 'three';

const _v = new THREE.Vector3();

/**
 * Bake a glTF character.
 * opts.clips: [{name, loop}]   opts.height: target height in world units
 * opts.part(name, material) -> {tint:[r,g,b], emissive:number, useMap:bool} | null (null = skip part)
 */
export function bakeCharacter(gltf, opts) {
  const fps = opts.fps ?? 30;
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const info = opts.part ? opts.part(o.name, o.material) : {};
    if (info === null) return;
    parts.push({ mesh: o, info: info || {} });
  });

  // ---- merged static geometry (uv, ids, material attributes) ----
  let V = 0;
  for (const p of parts) { p.base = V; V += p.mesh.geometry.attributes.position.count; }
  const uv = new Float32Array(V * 2);
  const vid = new Float32Array(V);
  const mat = new Float32Array(V * 4);
  const useMap = new Float32Array(V);
  const indices = [];
  let map = null;
  for (const p of parts) {
    const g = p.mesh.geometry;
    const n = g.attributes.position.count;
    const t = p.info.tint || [1, 1, 1];
    const em = p.info.emissive || 0;
    const um = p.info.useMap === false ? 0 : (p.mesh.material.map ? 1 : 0);
    const col = p.mesh.material.color || new THREE.Color(1, 1, 1);
    if (p.mesh.material.map && !map) map = p.mesh.material.map;
    for (let i = 0; i < n; i++) {
      const k = p.base + i;
      vid[k] = k;
      if (g.attributes.uv) { uv[k * 2] = g.attributes.uv.getX(i); uv[k * 2 + 1] = g.attributes.uv.getY(i); }
      // when no map: bake the material color into the tint
      const cr = um ? 1 : col.r, cg = um ? 1 : col.g, cb = um ? 1 : col.b;
      mat[k * 4] = t[0] * cr; mat[k * 4 + 1] = t[1] * cg; mat[k * 4 + 2] = t[2] * cb; mat[k * 4 + 3] = em;
      useMap[k] = um;
    }
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) indices.push(a[i] + p.base); }
    else for (let i = 0; i < n; i++) indices.push(i + p.base);
  }

  // ---- normalisation: height + feet on ground ----
  const mixer = new THREE.AnimationMixer(root);
  const clips = opts.clips.map((c) => {
    const clip = THREE.AnimationClip.findByName(gltf.animations, c.name);
    if (!clip) throw new Error('missing clip ' + c.name);
    return { ...c, clip };
  });

  // frame layout
  let total = 0;
  for (const c of clips) {
    const n = Math.max(2, Math.round(c.clip.duration * fps));
    c.count = c.loop ? n : n + 1;
    c.start = total;
    total += c.count;
  }

  const pos = new Float32Array(total * V * 4);
  const nrm = new Float32Array(total * V * 4);

  const tmpM = new THREE.Matrix4();
  const nmat = new THREE.Matrix3();
  const sk = new Float32Array(16);

  function sampleFrame(frameIndex) {
    root.updateMatrixWorld(true);
    for (const p of parts) {
      const m = p.mesh;
      const g = m.geometry;
      const P = g.attributes.position, N = g.attributes.normal;
      const n = P.count;
      const off = (frameIndex * V + p.base) * 4;
      if (m.isSkinnedMesh) {
        m.skeleton.update();
        const bm = m.skeleton.boneMatrices;
        const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
        // combined = matrixWorld * bindMatrixInverse * sum(w*bone) * bindMatrix
        const pre = m.bindMatrix.elements;
        const post = tmpM.multiplyMatrices(m.matrixWorld, m.bindMatrixInverse).elements;
        for (let i = 0; i < n; i++) {
          // bind-space position/normal
          const px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
          const bx = pre[0] * px + pre[4] * py + pre[8] * pz + pre[12];
          const by = pre[1] * px + pre[5] * py + pre[9] * pz + pre[13];
          const bz = pre[2] * px + pre[6] * py + pre[10] * pz + pre[14];
          const nx0 = N ? N.getX(i) : 0, ny0 = N ? N.getY(i) : 1, nz0 = N ? N.getZ(i) : 0;
          const qx = pre[0] * nx0 + pre[4] * ny0 + pre[8] * nz0;
          const qy = pre[1] * nx0 + pre[5] * ny0 + pre[9] * nz0;
          const qz = pre[2] * nx0 + pre[6] * ny0 + pre[10] * nz0;
          sk.fill(0);
          for (let j = 0; j < 4; j++) {
            const w = SW.getComponent(i, j);
            if (w === 0) continue;
            const b = SI.getComponent(i, j) * 16;
            for (let e = 0; e < 16; e++) sk[e] += bm[b + e] * w;
          }
          const sx = sk[0] * bx + sk[4] * by + sk[8] * bz + sk[12];
          const sy = sk[1] * bx + sk[5] * by + sk[9] * bz + sk[13];
          const sz = sk[2] * bx + sk[6] * by + sk[10] * bz + sk[14];
          const tx = sk[0] * qx + sk[4] * qy + sk[8] * qz;
          const ty = sk[1] * qx + sk[5] * qy + sk[9] * qz;
          const tz = sk[2] * qx + sk[6] * qy + sk[10] * qz;
          const k = off + i * 4;
          pos[k] = post[0] * sx + post[4] * sy + post[8] * sz + post[12];
          pos[k + 1] = post[1] * sx + post[5] * sy + post[9] * sz + post[13];
          pos[k + 2] = post[2] * sx + post[6] * sy + post[10] * sz + post[14];
          let ox = post[0] * tx + post[4] * ty + post[8] * tz;
          let oy = post[1] * tx + post[5] * ty + post[9] * tz;
          let oz = post[2] * tx + post[6] * ty + post[10] * tz;
          const l = Math.hypot(ox, oy, oz) || 1;
          nrm[k] = ox / l; nrm[k + 1] = oy / l; nrm[k + 2] = oz / l;
        }
      } else {
        const e = m.matrixWorld.elements;
        nmat.getNormalMatrix(m.matrixWorld);
        const ne = nmat.elements;
        for (let i = 0; i < n; i++) {
          const px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
          const k = off + i * 4;
          pos[k] = e[0] * px + e[4] * py + e[8] * pz + e[12];
          pos[k + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
          pos[k + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
          const nx = N ? N.getX(i) : 0, ny = N ? N.getY(i) : 1, nz = N ? N.getZ(i) : 0;
          let ox = ne[0] * nx + ne[3] * ny + ne[6] * nz;
          let oy = ne[1] * nx + ne[4] * ny + ne[7] * nz;
          let oz = ne[2] * nx + ne[5] * ny + ne[8] * nz;
          const l = Math.hypot(ox, oy, oz) || 1;
          nrm[k] = ox / l; nrm[k + 1] = oy / l; nrm[k + 2] = oz / l;
        }
      }
    }
  }

  for (const c of clips) {
    mixer.stopAllAction();
    const action = mixer.clipAction(c.clip);
    action.reset();
    action.setLoop(c.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.play();
    for (let f = 0; f < c.count; f++) {
      const t = Math.min(f / fps, c.clip.duration - 1e-4);
      mixer.setTime(t);
      sampleFrame(c.start + f);
    }
  }

  // normalise using first frame of first clip
  let minY = Infinity, maxY = -Infinity, cx = 0, cz = 0;
  for (let i = 0; i < V; i++) {
    const y = pos[i * 4 + 1];
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    cx += pos[i * 4]; cz += pos[i * 4 + 2];
  }
  cx /= V; cz /= V;
  const s = (opts.height ?? 1.8) / (maxY - minY);
  for (let i = 0; i < total * V; i++) {
    pos[i * 4] = (pos[i * 4] - cx) * s;
    pos[i * 4 + 1] = (pos[i * 4 + 1] - minY) * s;
    pos[i * 4 + 2] = (pos[i * 4 + 2] - cz) * s;
  }

  // ---- textures (half float) ----
  const texW = 1024;
  const texH = Math.ceil((total * V) / texW);
  function toHalfTex(src) {
    const data = new Uint16Array(texW * texH * 4);
    for (let i = 0; i < src.length; i++) data[i] = THREE.DataUtils.toHalfFloat(src[i]);
    const t = new THREE.DataTexture(data, texW, texH, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }
  const posTex = toHalfTex(pos);
  const nrmTex = toHalfTex(nrm);

  const geometry = new THREE.BufferGeometry();
  // base pose positions (frame 0) so the geometry has valid bounds
  const basePos = new Float32Array(V * 3);
  for (let i = 0; i < V; i++) { basePos[i * 3] = pos[i * 4]; basePos[i * 3 + 1] = pos[i * 4 + 1]; basePos[i * 3 + 2] = pos[i * 4 + 2]; }
  geometry.setAttribute('position', new THREE.BufferAttribute(basePos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('aVid', new THREE.BufferAttribute(vid, 1));
  geometry.setAttribute('aMat', new THREE.BufferAttribute(mat, 4));
  geometry.setAttribute('aUseMap', new THREE.BufferAttribute(useMap, 1));
  geometry.setIndex(indices);

  const clipInfo = {};
  for (const c of clips) clipInfo[c.name] = { start: c.start, count: c.count, loop: c.loop, duration: c.count / fps };

  return { geometry, posTex, nrmTex, verts: V, texW, fps, clips: clipInfo, map, height: opts.height ?? 1.8 };
}

const timeUniform = { value: 0 };
export function setVatTime(t) { timeUniform.value = t; }

export function createVatMaterial(baked, params = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: baked.map || null,
    roughness: params.roughness ?? 0.75,
    metalness: params.metalness ?? 0.0,
    envMapIntensity: params.envMapIntensity ?? 0.6,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPosTex = { value: baked.posTex };
    sh.uniforms.uNrmTex = { value: baked.nrmTex };
    sh.uniforms.uTime = timeUniform;
    sh.uniforms.uFps = { value: baked.fps };
    sh.uniforms.uVerts = { value: baked.verts };
    sh.uniforms.uTexW = { value: baked.texW };
    sh.uniforms.uRecolor = { value: new THREE.Vector4(...(params.recolor || [0, 0, -1, 1])) };
    sh.uniforms.uTint = { value: new THREE.Color(...(params.tint || [1, 1, 1])) };
    sh.uniforms.uRim = params.rim || { value: new THREE.Color(0, 0, 0) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform highp sampler2D uPosTex;
uniform highp sampler2D uNrmTex;
uniform float uTime;
uniform float uFps;
uniform int uVerts;
uniform int uTexW;
attribute float aVid;
attribute vec4 aMat;
attribute float aUseMap;
attribute vec4 iClip;
attribute float iFlash;
varying vec4 vMat;
varying float vUseMap;
varying float vFlash;
ivec2 vatCoord(int frame) {
  int idx = frame * uVerts + int(aVid);
  return ivec2(idx - (idx / uTexW) * uTexW, idx / uTexW);
}`)
      .replace('#include <beginnormal_vertex>', `
  float vatSpeed = abs(iClip.w);
  float vatF = max(uTime - iClip.z, 0.0) * uFps * vatSpeed;
  float vatCnt = iClip.y;
  float vatF1;
  if (iClip.w > 0.0) { vatF = mod(vatF, vatCnt); } else { vatF = min(vatF, vatCnt - 1.0); }
  float vatF0 = floor(vatF);
  float vatFr = vatF - vatF0;
  if (iClip.w > 0.0) { vatF1 = mod(vatF0 + 1.0, vatCnt); } else { vatF1 = min(vatF0 + 1.0, vatCnt - 1.0); }
  int vatI0 = int(iClip.x + vatF0);
  int vatI1 = int(iClip.x + vatF1);
  vec3 vatPos = mix(texelFetch(uPosTex, vatCoord(vatI0), 0).xyz, texelFetch(uPosTex, vatCoord(vatI1), 0).xyz, vatFr);
  vec3 objectNormal = normalize(mix(texelFetch(uNrmTex, vatCoord(vatI0), 0).xyz, texelFetch(uNrmTex, vatCoord(vatI1), 0).xyz, vatFr));
  vMat = aMat;
  vUseMap = aUseMap;
  vFlash = iFlash;
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3( tangent.xyz );
  #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vatPos;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vMat;
varying float vUseMap;
varying float vFlash;
uniform vec4 uRecolor;
uniform vec3 uTint;
uniform vec3 uRim;
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }`)
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if (uRecolor.z >= 0.0) {
    vec3 hsv = rgb2hsv(sampledDiffuseColor.rgb);
    bool inRange = uRecolor.x < uRecolor.y ? (hsv.x > uRecolor.x && hsv.x < uRecolor.y) : (hsv.x > uRecolor.x || hsv.x < uRecolor.y);
    if (hsv.y > 0.22 && inRange) { hsv.x = uRecolor.z; hsv.y = clamp(hsv.y * uRecolor.w, 0.0, 1.0); sampledDiffuseColor.rgb = hsv2rgb(hsv); }
  }
  diffuseColor *= mix(vec4(1.0), sampledDiffuseColor, vUseMap);
#endif
  diffuseColor.rgb *= uTint;
  diffuseColor.rgb *= vMat.rgb;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vMat.rgb * vMat.w + vec3(1.0, 0.95, 0.85) * vFlash;
  float rimF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
  totalEmissiveRadiance += uRim * rimF * rimF * rimF;`);
  };
  m.customProgramCacheKey = () => 'vat' + (params.key || '');
  return m;
}

/** Depth material so animated instances cast correct, moving shadows. */
export function createVatDepthMaterial(baked) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPosTex = { value: baked.posTex };
    sh.uniforms.uTime = timeUniform;
    sh.uniforms.uFps = { value: baked.fps };
    sh.uniforms.uVerts = { value: baked.verts };
    sh.uniforms.uTexW = { value: baked.texW };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform highp sampler2D uPosTex;
uniform float uTime;
uniform float uFps;
uniform int uVerts;
uniform int uTexW;
attribute float aVid;
attribute vec4 iClip;
ivec2 vatCoord(int frame) {
  int idx = frame * uVerts + int(aVid);
  return ivec2(idx - (idx / uTexW) * uTexW, idx / uTexW);
}`)
      .replace('#include <begin_vertex>', `
  float vatSpeed = abs(iClip.w);
  float vatF = max(uTime - iClip.z, 0.0) * uFps * vatSpeed;
  float vatCnt = iClip.y;
  float vatF1;
  if (iClip.w > 0.0) { vatF = mod(vatF, vatCnt); } else { vatF = min(vatF, vatCnt - 1.0); }
  float vatF0 = floor(vatF);
  float vatFr = vatF - vatF0;
  if (iClip.w > 0.0) { vatF1 = mod(vatF0 + 1.0, vatCnt); } else { vatF1 = min(vatF0 + 1.0, vatCnt - 1.0); }
  vec3 transformed = mix(texelFetch(uPosTex, vatCoord(int(iClip.x + vatF0)), 0).xyz, texelFetch(uPosTex, vatCoord(int(iClip.x + vatF1)), 0).xyz, vatFr);`);
  };
  m.customProgramCacheKey = () => 'vatdepth';
  return m;
}

/** A pool of animated instances of one baked character. */
export class Crowd {
  constructor(baked, max, material) {
    this.baked = baked;
    this.max = max;
    const geo = baked.geometry.clone();
    this.clipAttr = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.flashAttr = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.clipAttr.setUsage(THREE.DynamicDrawUsage);
    this.flashAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iClip', this.clipAttr);
    geo.setAttribute('iFlash', this.flashAttr);
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = createVatDepthMaterial(baked);
    this.mesh.count = 0;
    this.free = [];
    for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.active = new Set();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    // hide all
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    this.mesh.count = max;
  }
  alloc() {
    const i = this.free.pop();
    if (i === undefined) return -1;
    this.active.add(i);
    return i;
  }
  release(i) {
    this.mesh.setMatrixAt(i, this._m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.active.delete(i);
    this.free.push(i);
    this.free.sort((a, b) => b - a); // keep lowest index at the end so it is reused first
  }
  setTransform(i, x, y, z, yaw, scale) {
    this._q.setFromAxisAngle(this._up, yaw);
    this._s.set(scale, scale, scale);
    this._p.set(x, y, z);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
  }
  play(i, clipName, now, speed = 1, offset = 0) {
    const c = this.baked.clips[clipName];
    const a = this.clipAttr.array;
    a[i * 4] = c.start; a[i * 4 + 1] = c.count; a[i * 4 + 2] = now - offset; a[i * 4 + 3] = c.loop ? speed : -speed;
    this.clipAttr.needsUpdate = true;
  }
  flash(i, v) { this.flashAttr.array[i] = v; this.flashAttr.needsUpdate = true; }
  commit() {
    // only draw up to the highest index in use (free list hands out low indices first)
    let hi = -1;
    for (const i of this.active) if (i > hi) hi = i;
    this.mesh.count = hi + 1;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
