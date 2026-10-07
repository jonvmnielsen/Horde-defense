// Visual effects: crossbow bolts, particles (flashes, sparks, dust, debris), floating numbers.
import * as THREE from 'three';

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
export const RADIAL = radialTexture();

/** GPU particles with CPU simulation. additive = glowing; otherwise alpha-blended (dust). */
export class Particles {
  constructor(max, additive) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.life0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.alpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: RADIAL }, scale: { value: 600 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, r, g, b, size, life, grav = 0) {
    let i = this.n;
    if (i >= this.max) { i = Math.floor(Math.random() * this.max); } else this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
    this.size0[i] = size; this.life[i] = life; this.life0[i] = life; this.grav[i] = grav;
  }
  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i] - dt;
      if (l <= 0) continue;
      // compact
      if (w !== i) {
        for (let k = 0; k < 3; k++) {
          this.pos[w * 3 + k] = this.pos[i * 3 + k]; this.vel[w * 3 + k] = this.vel[i * 3 + k]; this.base[w * 3 + k] = this.base[i * 3 + k];
        }
        this.size0[w] = this.size0[i]; this.life0[w] = this.life0[i]; this.grav[w] = this.grav[i];
      }
      this.life[w] = l;
      this.vel[w * 3 + 1] -= this.grav[w] * dt;
      const drag = Math.exp(-dt * 2.5);
      this.vel[w * 3] *= drag; this.vel[w * 3 + 2] *= drag;
      this.pos[w * 3] += this.vel[w * 3] * dt;
      this.pos[w * 3 + 1] = Math.max(0.05, this.pos[w * 3 + 1] + this.vel[w * 3 + 1] * dt);
      this.pos[w * 3 + 2] += this.vel[w * 3 + 2] * dt;
      const t = l / this.life0[w];
      this.alpha[w] = Math.min(1, t * 2.2);
      this.size[w] = this.size0[w] * (0.4 + 0.6 * t);
      this.col[w * 3] = this.base[w * 3]; this.col[w * 3 + 1] = this.base[w * 3 + 1]; this.col[w * 3 + 2] = this.base[w * 3 + 2];
      w++;
    }
    this.n = w;
    this.geo.setDrawRange(0, w);
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

/** Crossbow bolts: glowing streaks travelling from shooter to target. */
export class Bolts {
  constructor(max) {
    this.max = max;
    const g = new THREE.BoxGeometry(0.035, 0.035, 0.8);
    g.translate(0, 0, -0.5);
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.6), toneMapped: true });
    this.mesh = new THREE.InstancedMesh(g, m, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.list = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.dir = new THREE.Vector3();
    this.fwd = new THREE.Vector3(0, 0, -1);
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
  }
  fire(from, to, speed, onHit) {
    if (this.list.length >= this.max) { onHit(); return; }
    const d = from.distanceTo(to);
    this.list.push({ fx: from.x, fy: from.y, fz: from.z, tx: to.x, ty: to.y, tz: to.z, t: 0, dur: d / speed, onHit });
  }
  update(dt) {
    let w = 0;
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const b = L[i];
      b.t += dt;
      if (b.t >= b.dur) { b.onHit(); continue; }
      L[w++] = b;
    }
    L.length = w;
    for (let i = 0; i < w; i++) {
      const b = L[i];
      const k = b.t / b.dur;
      const x = b.fx + (b.tx - b.fx) * k, y = b.fy + (b.ty - b.fy) * k + Math.sin(k * Math.PI) * 0.6, z = b.fz + (b.tz - b.fz) * k;
      this.dir.set(b.tx - b.fx, b.ty - b.fy, b.tz - b.fz).normalize();
      this.q.setFromUnitVectors(this.fwd, this.dir);
      this.p.set(x, y, z);
      this.s.set(1, 1, 1);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = w;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Floating DOM labels that follow world positions (numbers that pop up). */
export class Floaters {
  constructor(container, camera) {
    this.c = container;
    this.camera = camera;
    this.items = [];
    this.v = new THREE.Vector3();
  }
  add(text, pos, cls, life = 1.0, rise = 2.2) {
    if (this.items.length > 60) { const o = this.items.shift(); o.el.remove(); }
    const el = document.createElement('div');
    el.className = 'floater ' + (cls || '');
    el.textContent = text;
    this.c.appendChild(el);
    this.items.push({ el, x: pos.x, y: pos.y, z: pos.z, t: 0, life, rise });
  }
  update(dt, w, h) {
    let k = 0;
    for (const it of this.items) {
      it.t += dt;
      if (it.t >= it.life) { it.el.remove(); continue; }
      const p = this.v.set(it.x, it.y + it.rise * Math.sqrt(it.t / it.life), it.z).project(this.camera);
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const a = it.t / it.life;
      const sc = a < 0.15 ? 0.6 + (a / 0.15) * 0.7 : 1.3 - Math.min(0.3, (a - 0.15) * 0.6);
      it.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%,-50%) scale(${sc})`;
      it.el.style.opacity = a > 0.7 ? String(1 - (a - 0.7) / 0.3) : '1';
      this.items[k++] = it;
    }
    this.items.length = k;
  }
}
