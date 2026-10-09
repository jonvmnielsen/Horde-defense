// The base between levels as a small 3D village: one building per upgrade, growing as it is upgraded,
// construction sites for what can be built next, locked plots for later, and the reserve troop gathered in the square.
import * as THREE from 'three';
import { Crowd } from './vat.js';

const W = 2.2; // world size of one model unit (the hex pack is built on 2-unit hexes)
const HEX_X = 2.0 * W, HEX_Z = 2.3 * 0.75 * W; // pointy-top hex spacing
const hexPos = (c, r) => [(c - 3 + (r % 2 ? 0.5 : 0)) * HEX_X, (r - 5.5) * HEX_Z];

// which building stands for which upgrade, where it stands, what grows around it, and from which level it can be built
export const PLOTS = {
  hall: { at: [3, 1], main: 'building_castle_blue', extras: ['tent', 'flag_red', 'building_tower_A_blue'], unlock: 3 },
  heroes: { at: [1, 2], main: 'building_tavern_blue', extras: ['barrel', 'sack', 'building_well_blue'], unlock: 4 },
  treasury: { at: [5, 2], main: 'building_market_blue', extras: ['sack', 'crate_A_big', 'building_home_B_blue'], unlock: 2 },
  smith: { at: [1, 4], main: 'building_blacksmith_blue', extras: ['resource_stone', 'wheelbarrow', 'crate_open'], unlock: 1 },
  sharp: { at: [5, 4], main: 'building_tower_A_blue', extras: ['crate_A_big', 'resource_lumber', 'building_tower_B_blue'], unlock: 2 },
  barracks: { at: [1, 6], main: 'building_barracks_blue', extras: ['tent', 'building_home_A_blue', 'tent'], unlock: 1 },
  training: { at: [5, 6], main: 'building_archeryrange_blue', extras: ['tent', 'crate_B_small', 'tent'], unlock: 1 },
  medic: { at: [1, 8], main: 'building_church_blue', extras: ['tent', 'building_well_blue', 'sack'], unlock: 3 },
  drill: { at: [5, 8], main: 'building_tower_catapult_blue', extras: ['resource_lumber', 'crate_A_big', 'barrel'], unlock: 2 },
  powder: { at: [3, 9], main: 'building_mine_blue', extras: ['barrel', 'barrel', 'crate_open'], unlock: 4 },
};
const EXTRA_AT = [[0.62, 0.55], [-0.66, 0.5], [0.05, -0.85]]; // where extras stand around the main building (hex units)
const SQUARE = [3, 5.5]; // the square where the reserve gathers

export class BaseView {
  constructor(gltf, rogueBaked, troopMat) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9cc4e4);
    this.scene.fog = new THREE.Fog(0x9cc4e4, 70, 140);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 300);
    this.lib = {};
    gltf.scene.traverse((o) => { if (o.parent === gltf.scene) this.lib[o.name] = o; });
    for (const o of Object.values(this.lib)) o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.active = false;
    this.pan = 0; // camera slide along the village (drag)
    this.plots = {};
    this.labels = {};
    this.selected = null;
    this.t = 0;

    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a6a3a, 0.8);
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.3);
    sun.position.set(-18, 30, 14); sun.target.position.set(0, 0, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 30, bottom: -30, near: 1, far: 90 });
    sun.shadow.camera.updateProjectionMatrix(); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    this.scene.add(hemi, sun, sun.target);

    // ground: hex grass over the whole village, a green plain beyond, hills and forest around
    const plain = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x5d8a3e, roughness: 1 }));
    plain.rotation.x = -Math.PI / 2; plain.position.y = -0.02; plain.receiveShadow = true;
    this.scene.add(plain);
    const rnd = mulberry(5);
    for (let r = -2; r <= 13; r++) for (let c = -2; c <= 8; c++) {
      const [x, z] = hexPos(c, r);
      const tile = this.place('hex_grass', x, 0, z, 0, 1);
      tile.position.y = -0.0;
      const inside = c >= 0 && c <= 6 && r >= 0 && r <= 11;
      if (!inside && rnd() < 0.55) {
        const deco = ['trees_A_large', 'trees_B_medium', 'tree_single_A', 'hills_A_trees', 'mountain_A_grass_trees', 'mountain_B_grass_trees'];
        const far = c < -1 || c > 7 || r < -1 || r > 12;
        this.place(deco[Math.floor(rnd() * (far ? 6 : 3))], x, 0, z, rnd() * 6, 0.9 + rnd() * 0.3);
      }
    }
    // the square: a few crates and the troop's flag
    const [sx, sz] = hexPos(...SQUARE);
    this.place('flag_blue', sx - 3.2, 0, sz - 2.2, 0.3, 3.2);

    // plots
    for (const [key, p] of Object.entries(PLOTS)) {
      const g = new THREE.Group();
      const [x, z] = hexPos(...p.at);
      g.position.set(x, 0, z);
      this.scene.add(g);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(HEX_X * 0.55, HEX_X * 0.55, 5, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 2.5; hit.userData.key = key; g.add(hit);
      const ring = new THREE.Mesh(new THREE.RingGeometry(HEX_X * 0.5, HEX_X * 0.58, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false }));
      ring.rotation.y = Math.PI / 6; ring.position.y = 0.06; ring.visible = false; g.add(ring);
      this.plots[key] = { g, hit, ring, content: new THREE.Group(), shown: '', bounce: 0 };
      g.add(this.plots[key].content);
    }

    // the reserve troop, gathered in the square
    this.troop = new Crowd(rogueBaked, 72, troopMat);
    this.scene.add(this.troop.mesh);
    this.troopIdx = [];
    this.troopShown = -1;
    this.dust = [];
    this.ray = new THREE.Raycaster();
  }

  place(name, x, y, z, rot = 0, s = 1, parent = this.scene) {
    const src = this.lib[name];
    if (!src) return new THREE.Group();
    const o = src.clone();
    o.position.set(x, y, z); o.rotation.y = rot; o.scale.setScalar(s * W);
    parent.add(o);
    return o;
  }

  /** rebuild a plot's models for its current level */
  setPlot(key, lv, max, locked) {
    const P = this.plots[key], p = PLOTS[key];
    const state = locked ? 'locked' : lv === 0 ? 'site' : 'b' + lv;
    if (P.shown === state) return;
    const grew = P.shown && P.shown !== state;
    P.shown = state;
    const c = P.content;
    while (c.children.length) c.remove(c.children[0]);
    if (locked) {
      this.place('building_destroyed', 0, 0, 0, 0.4, 0.9, c);
      for (let k = 0; k < 6; k++) { const f = this.place('fence_wood_straight', 0, 0, 0, k * Math.PI / 3, 0.92, c); f.rotation.y = k * Math.PI / 3; }
    } else if (lv === 0) {
      this.place('building_scaffolding', 0, 0, 0, 0, 0.9, c);
      this.place('resource_lumber', HEX_X * 0.3, 0, HEX_Z * 0.35, 0.3, 1.3, c);
      this.place('resource_stone', -HEX_X * 0.3, 0, HEX_Z * 0.35, 0, 1.3, c);
    } else {
      const f = lv / max;
      const s = 1.05 + 0.4 * f; // the building itself grows with its level
      this.place(p.main, 0, 0, 0, 0, s, c);
      const n = f >= 1 ? 3 : f >= 0.67 ? 2 : f >= 0.34 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const name = p.extras[k];
        const big = name.startsWith('building');
        const [ex, ez] = EXTRA_AT[k];
        this.place(name, ex * HEX_X * 0.5, 0, ez * HEX_Z * 0.5, k * 1.3, big ? 0.42 : 2.2, c);
      }
      // flags grow with the level; a golden one at the top
      const flags = Math.min(3, Math.floor(f * 3 + 0.001));
      for (let k = 0; k < flags; k++) this.place(f >= 1 && k === 0 ? 'flag_yellow' : 'flag_blue', (k - 1) * 0.9, 0, -HEX_Z * 0.42, 0, 4.5, c);
    }
    if (grew) { P.bounce = 1; this.puff(P.g.position); }
  }

  puff(pos) {
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8cfc0, transparent: true, opacity: 0.8, roughness: 1 }));
      const a = Math.random() * Math.PI * 2;
      m.position.set(pos.x + Math.cos(a) * 1.5, 0.5, pos.z + Math.sin(a) * 1.5);
      m.userData = { v: new THREE.Vector3(Math.cos(a) * 2, 2 + Math.random() * 2, Math.sin(a) * 2), life: 0.9 };
      this.scene.add(m); this.dust.push(m);
    }
  }

  /** the reserve stands in rows on the square */
  setTroop(n, clock) {
    n = Math.min(72, n);
    if (n === this.troopShown) return;
    this.troopShown = n;
    for (const i of this.troopIdx) this.troop.release(i);
    this.troopIdx = [];
    const [sx, sz] = hexPos(...SQUARE);
    const cols = Math.max(4, Math.ceil(Math.sqrt(n * 1.6)));
    for (let k = 0; k < n; k++) {
      const i = this.troop.alloc(); if (i < 0) break;
      const col = k % cols, row = Math.floor(k / cols);
      this.troop.setTransform(i, sx + (col - (cols - 1) / 2) * 0.95 + (row % 2) * 0.3, 0, sz - 1 + row * 0.95, 0, 1);
      this.troop.play(i, '2H_Ranged_Aiming', clock, 0.6 + Math.random() * 0.3, Math.random());
      this.troopIdx.push(i);
    }
    this.troop.commit();
  }
  cheer(clock) { for (const i of this.troopIdx) this.troop.play(i, 'Cheer', clock, 0.9 + Math.random() * 0.2, Math.random()); this.cheerT = 2.2; }

  select(key) {
    this.selected = key;
    for (const [k, P] of Object.entries(this.plots)) P.ring.visible = k === key;
  }

  pick(x, y, w, h) {
    this.ray.setFromCamera(new THREE.Vector2(x / w * 2 - 1, -(y / h) * 2 + 1), this.camera);
    const hits = this.ray.intersectObjects(Object.values(this.plots).map((p) => p.hit), false);
    return hits.length ? hits[0].object.userData.key : null;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    // frame the village's width whatever the screen shape
    const want = 34; // world units across
    const dist = 40;
    const hfov = 2 * Math.atan(want / 2 / dist);
    this.camera.fov = THREE.MathUtils.clamp(2 * Math.atan(Math.tan(hfov / 2) / this.camera.aspect) * 180 / Math.PI, 35, 80);
    this.camera.updateProjectionMatrix();
  }

  update(dt, clock) {
    this.t += dt;
    const z = this.pan;
    this.camera.position.set(0, 33, 22 + z);
    this.camera.lookAt(0, 0, -1 + z);
    this.camera.updateMatrixWorld();
    for (const P of Object.values(this.plots)) {
      if (P.bounce > 0) { P.bounce = Math.max(0, P.bounce - dt * 2.5); const s = 1 + Math.sin(P.bounce * Math.PI * 3) * 0.12 * P.bounce; P.content.scale.set(s, 1 + (s - 1) * 1.5, s); }
      if (P.ring.visible) P.ring.material.opacity = 0.55 + 0.4 * Math.sin(this.t * 5);
    }
    if (this.cheerT > 0) { this.cheerT -= dt; if (this.cheerT <= 0) for (const i of this.troopIdx) this.troop.play(i, '2H_Ranged_Aiming', clock, 0.7, Math.random()); }
    this.troop.commit();
    for (const m of this.dust) {
      m.userData.life -= dt;
      m.position.addScaledVector(m.userData.v, dt); m.userData.v.y -= dt * 3;
      m.material.opacity = Math.max(0, m.userData.life);
      m.scale.setScalar(1 + (0.9 - m.userData.life) * 1.5);
      if (m.userData.life <= 0) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    }
    this.dust = this.dust.filter((m) => m.userData.life > 0);
  }

  /** screen position of a plot's label */
  labelPos(key, w, h) {
    const P = this.plots[key];
    const v = new THREE.Vector3(P.g.position.x, 5.2, P.g.position.z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, v.z < 1];
  }
  squarePos(w, h) {
    const [sx, sz] = hexPos(...SQUARE);
    const v = new THREE.Vector3(sx, 0, sz + 4.2).project(this.camera);
    return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
  }
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
