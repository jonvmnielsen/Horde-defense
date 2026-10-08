import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bakeCharacter, createVatMaterial, Crowd, setVatTime } from './vat.js';
import { buildWorld, makeSky, LANES, LANE_W, LANE_END_Z, EDGE } from './world.js';
import { Particles, Bolts, Floaters, RADIAL } from './fx.js';
import { levelConfig, TROOP, WEAPON, EVENTS, ENEMY } from './levels.js';

const params = new URLSearchParams(location.search);
const SNAP = params.has('snap'); // deterministic mode for screenshots

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = params.has('pr') ? +params.get('pr') : Math.min(window.devicePixelRatio || 1, SNAP ? 1 : 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = true; // units are animated, so shadows re-render every frame
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb9c9d8, 70, 185);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 900);
const TROOP_Z = -2.6;
const camBase = new THREE.Vector3(0, 13.5, 8.6);
const camTarget = new THREE.Vector3(0, 0, -16.5);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x7a6a52, 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b5, 3.6);
// low side light from the left so every unit throws a visible shadow across the ground toward the right
sun.position.set(-34, 26, -8);
sun.target.position.set(0, 0, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -46, right: 34, top: 20, bottom: -20, near: 1, far: 110 });
sun.shadow.camera.updateProjectionMatrix(); // without this the bounds above are ignored
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// post-processing
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const floaterLayer = document.getElementById('floaters');
const floaters = new Floaters(floaterLayer, camera);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(w, h);
  bloom.resolution.set(w * pixelRatio / 2, h * pixelRatio / 2);
  camera.aspect = w / h;
  // keep the three lanes (plus a margin) visible across the troop's row, whatever the screen shape
  const d = camBase.distanceTo(new THREE.Vector3(0, 0, TROOP_Z - 9));
  const hfov = 2 * Math.atan((EDGE + 0.3) / d);
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180 / Math.PI;
  camera.fov = THREE.MathUtils.clamp(vfov, 40, 84);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- loading
const loader = new GLTFLoader();
const loadEl = document.getElementById('loading');
let loaded = 0;
const files = ['env.json', 'rogue.json', 'skeleton_minion_lod.json', 'skeleton_warrior.json', 'mage.json', 'skeleton_warrior_lod.json', 'skeleton_mage.json'];
function load(f) {
  return loader.loadAsync('assets/' + f).then((g) => {
    loaded++;
    loadEl.querySelector('.bar i').style.width = (loaded / files.length * 100) + '%';
    g.scene.traverse((o) => { if (o.isMesh && o.material.map) { o.material.map.anisotropy = MAX_ANISO; } });
    return g;
  });
}
const [envG, rogueG, minionG, warriorG, mageG, warriorLodG, skMageG] = await Promise.all(files.map(load));

try { await Promise.race([document.fonts.load('80px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* fall back to system font */ }
buildWorld(scene, envG);
makeSky(scene);

// ---------------------------------------------------------------- characters (baked)
const rogueBaked = bakeCharacter(rogueG, {
  height: 1.25,
  clips: [{ name: '2H_Ranged_Shooting', loop: true }, { name: '2H_Ranged_Aiming', loop: true }, { name: 'Running_A', loop: true }, { name: 'Death_A', loop: false }, { name: 'Cheer', loop: true }],
});
const minionBaked = bakeCharacter(minionG, {
  height: 1.3,
  clips: [{ name: 'Running_A', loop: true }, { name: 'Walking_D_Skeletons', loop: true }, { name: 'Death_C_Skeletons', loop: false }],
  part: (name) => (/Eyes/.test(name) ? { tint: [1.0, 0.15, 0.05], emissive: 5, useMap: false } : {}),
});
const warriorBaked = bakeCharacter(warriorG, {
  height: 1.45,
  clips: [{ name: 'Running_A', loop: true }, { name: 'Walking_D_Skeletons', loop: true }, { name: 'Death_C_Skeletons', loop: false }, { name: '2H_Melee_Attack_Chop', loop: true }, { name: 'Hit_A', loop: false }],
  part: (name) => (/Eyes/.test(name) ? { tint: [1.0, 0.15, 0.05], emissive: 6, useMap: false } : {}),
});
const warriorLodBaked = bakeCharacter(warriorLodG, {
  height: 1.45,
  clips: [{ name: 'Running_A', loop: true }, { name: 'Walking_D_Skeletons', loop: true }, { name: 'Death_C_Skeletons', loop: false }],
  part: (name) => (/Eyes/.test(name) ? { tint: [1.0, 0.15, 0.05], emissive: 6, useMap: false } : {}),
});
const skMageBaked = bakeCharacter(skMageG, {
  height: 1.4,
  clips: [{ name: 'Walking_D_Skeletons', loop: true }, { name: 'Spellcast_Shoot', loop: true }, { name: 'Death_C_Skeletons', loop: false }],
  part: (name) => (/Eyes/.test(name) ? { tint: [0.7, 0.2, 1.0], emissive: 7, useMap: false } : {}),
});
const mageBaked = bakeCharacter(mageG, {
  height: 1.55,
  clips: [{ name: 'Spellcast_Shoot', loop: true }, { name: 'Idle', loop: true }, { name: 'Running_A', loop: true }, { name: 'Cheer', loop: true }],
});
for (const b of [rogueBaked, minionBaked, warriorBaked, warriorLodBaked, mageBaked, skMageBaked]) if (b.map) b.map.anisotropy = MAX_ANISO;

// team colours: soldiers green cloth -> royal blue; skeleton cloaks (blue/purple) -> blood red
const blueMat = createVatMaterial(rogueBaked, { recolor: [0.22, 0.55, 0.61, 1.25], key: 'blue', roughness: 0.6 });
const redMinionMat = createVatMaterial(minionBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [0.9, 0.3, 0.24], key: 'red1' });
const redWarriorMat = createVatMaterial(warriorLodBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [0.78, 0.22, 0.18], key: 'red2' });

const soldiers = new Crowd(rogueBaked, TROOP.visibleMax + 40, blueMat);
const minions = new Crowd(minionBaked, 1600, redMinionMat);
const warriors = new Crowd(warriorLodBaked, 260, redWarriorMat);
// the horde is huge: only contact shadows for skeletons, real shadows for the troop, heroes and the boss
minions.mesh.castShadow = false; warriors.mesh.castShadow = false;
// Guldkriger: a big golden warrior in the horde; tough, and pays out soldiers when killed
const elites = new Crowd(warriorLodBaked, 40, createVatMaterial(warriorLodBaked, { recolor: [0.5, 0.99, 0.13, 1.6], tint: [1.6, 1.25, 0.45], key: 'elite', roughness: 0.3, metalness: 0.45 }));
// Skeletmagiker: an enemy hero that stops in a side lane and blasts the troop from range
const casters = new Crowd(skMageBaked, 6, createVatMaterial(skMageBaked, { recolor: [0.5, 0.99, 0.78, 1.5], key: 'caster' }));
scene.add(elites.mesh, casters.mesh);
const heroes = new Crowd(mageBaked, 6, createVatMaterial(mageBaked, { key: 'mage', roughness: 0.55 }));
// a mage frozen in stone: same model, desaturated to grey rock
const statues = new Crowd(mageBaked, 6, createVatMaterial(mageBaked, { recolor: [0.0, 1.0, 0.1, 0.0], tint: [0.62, 0.6, 0.58], key: 'stone', roughness: 0.95 }));
scene.add(heroes.mesh, statues.mesh);
const bosses = new Crowd(warriorBaked, 2, createVatMaterial(warriorBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [1.0, 0.5, 0.42], key: 'boss', roughness: 0.55 }));
scene.add(soldiers.mesh, minions.mesh, warriors.mesh, bosses.mesh);

// soft contact shadows under every unit (on top of the real shadows)
const blobs = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: RADIAL, color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  1400
);
blobs.frustumCulled = false;
blobs.renderOrder = 1;
scene.add(blobs);
let blobN = 0;
const _bm = new THREE.Matrix4();
function blob(x, z, s) {
  if (blobN >= 1400) return;
  _bm.makeScale(s, 1, s); _bm.setPosition(x, 0.09, z);
  blobs.setMatrixAt(blobN++, _bm);
}

// effects
const glow = new Particles(2000, true);
const dust = new Particles(1000, false);
const bolts = new Bolts(800);
scene.add(glow.points, dust.points, bolts.mesh);

// ---------------------------------------------------------------- pickups (+1, +5, +99, weapon, rapid fire, bomb)
function labelTexture(text, bg, fg = '#fff') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  let size = 150;
  g.font = `${size}px "Lilita One", "Arial Black", system-ui, sans-serif`;
  while (g.measureText(text).width > 440 && size > 40) { size -= 6; g.font = `${size}px "Lilita One", "Arial Black", system-ui, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.round(size * 0.22); g.strokeStyle = bg;
  g.strokeText(text, 256, 102);
  g.fillStyle = fg;
  g.fillText(text, 256, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
}
const KIND_STYLE = {
  plus1: { label: '+1', color: 0x2f7cf6, emissive: 0x0a3cff, stroke: '#0b2f8a', w: 4.6, h: 1.0 },
  plus5: { label: '+5', color: 0x1d5fe8, emissive: 0x0a3cff, stroke: '#0b2f8a', w: 4.6, h: 1.4 },
  plus99: { label: '+99', color: 0xf2a812, emissive: 0xb85a00, stroke: '#7a3a00', w: 4.6, h: 1.5 },
  weapon: { label: 'VÅBEN +', color: 0x9b3df5, emissive: 0x5a12c9, stroke: '#3b0a7a', w: 3.8, h: 1.8 },
  weapon2: { label: 'VÅBEN ++', color: 0xd4a017, emissive: 0x8a3cff, stroke: '#3b0a7a', w: 4.4, h: 2.0 },
  altar: { label: 'OFR', color: 0x7a0e14, emissive: 0x5a0008, stroke: '#2a0004', w: 4.2, h: 2.2 },
  rapid: { label: '2× SKUD', color: 0xff7a1a, emissive: 0xc43c00, stroke: '#6a2200', w: 3.8, h: 1.5 },
  bomb: { label: 'BOMBE', color: 0xe0322b, emissive: 0x9a0c06, stroke: '#4a0503', w: 3.8, h: 1.5 },
};
const kinds = {};
for (const [name, st] of Object.entries(KIND_STYLE)) {
  const max = name === 'plus1' ? 90 : 24;
  const body = new THREE.InstancedMesh(
    new RoundedBoxGeometry(st.w, st.h, 0.9, 3, 0.18),
    new THREE.MeshStandardMaterial({ color: st.color, emissive: st.emissive, emissiveIntensity: 0.35, roughness: 0.32, metalness: 0.15 }),
    max
  );
  body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  const lw = Math.min(st.w * 0.95, 4.2);
  const label = new THREE.InstancedMesh(new THREE.PlaneGeometry(lw, lw * 0.375), new THREE.MeshBasicMaterial({ map: labelTexture(name === 'altar' ? 'OFR ' + Math.round(levelConfig(1).altar.share * 100) + '%' : st.label, st.stroke, name === 'altar' ? '#ffd0d0' : '#fff'), transparent: true, depthWrite: false }), max);
  body.castShadow = true;
  body.frustumCulled = label.frustumCulled = false;
  body.count = label.count = 0;
  scene.add(body, label);
  kinds[name] = { name, ...st, body, label, max };
}

// ---------------------------------------------------------------- stone prison (a hero encased in rock; chunks break off as it is shot)
const PRISON_CHUNKS = 10;
const rockGeo = (() => {
  let geo = null;
  envG.scene.traverse((o) => { if (!geo && o.isMesh && /rock_single_C/.test(o.parent?.name || '') ) geo = o; });
  if (!geo) envG.scene.traverse((o) => { if (!geo && o.isMesh && /rock_single/.test((o.parent?.name || '') + o.name)) geo = o; });
  return geo;
})();
const heroTag = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: labelTexture('BEFRI HELT', '#3b0a7a', '#e9d2ff'), transparent: true, depthWrite: false }), 6);
heroTag.frustumCulled = false; heroTag.count = 0;
scene.add(heroTag);
const chunkMesh = new THREE.InstancedMesh(rockGeo.geometry, rockGeo.material.clone(), PRISON_CHUNKS * 6);
chunkMesh.material.color = new THREE.Color(0.78, 0.76, 0.74);
chunkMesh.castShadow = true; chunkMesh.receiveShadow = true; chunkMesh.frustumCulled = false; chunkMesh.count = 0;
scene.add(chunkMesh);
// chunk layout around the statue (local offsets); index 0 breaks off first (top), the last ones last (base)
const CHUNK_LAYOUT = [];
for (let i = 0; i < PRISON_CHUNKS; i++) {
  const ring = i < 2 ? 2 : i < 6 ? 1 : 0; // top, middle, base
  const a = i * 2.4 + ring;
  const r = ring === 2 ? 0.25 : 0.62;
  // the hat and face stay visible above the rock so you can see who is trapped inside
  CHUNK_LAYOUT.push({ x: Math.cos(a) * (r + 0.1), y: ring === 2 ? 0.95 : ring === 1 ? 0.55 : 0.08, z: Math.sin(a) * (r + 0.1) * 0.8, rot: a * 1.7, s: ring === 2 ? 2.8 : ring === 1 ? 3.2 : 3.6 });
}

// ---------------------------------------------------------------- hazards (they roll on into the camp and hit the troop unless it moves or shoots them)
const envLib = {};
envG.scene.traverse((o) => { if (o.parent === envG.scene) envLib[o.name] = o; });
function hazardVisual(type) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  if (type === 'barrel') {
    const b = envLib.barrel_large.clone();
    b.scale.setScalar(0.62);
    // a red band so it reads as dangerous
    b.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(1.15, 0.55, 0.45); o.castShadow = true; } });
    // lying on its side (axis along x), centred on the inner group so it rolls about its own axis
    b.rotation.set(0, 0, Math.PI / 2);
    b.position.set(0.62, 0, 0);
    inner.add(b);
    inner.position.y = 0.56;
  } else {
    const r = envLib.rock_single_C.clone();
    r.scale.set(9.5, 14, 9.5);
    r.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(0.8, 0.76, 0.72); o.castShadow = true; } });
    r.position.y = -1.1;
    inner.add(r);
    inner.position.y = 1.1;
  }
  g.add(inner);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false }));
  stripe.rotation.x = -Math.PI / 2;
  stripe.renderOrder = 2;
  scene.add(g, stripe);
  return { g, inner, stripe };
}
const hazardPool = { barrel: [], boulder: [] };

// ---------------------------------------------------------------- barricades (walls with health that shield what is behind them)
const wallTemplate = new THREE.Group();
{
  const lib = {};
  envG.scene.traverse((o) => { if (o.parent === envG.scene) lib[o.name] = o; });
  const w = lib.wall_cracked.clone();
  w.scale.set(LANE_W / 4 * 0.97, 0.75, 1.2);
  w.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  wallTemplate.add(w);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(3.3, 1.35, 0.3, 2, 0.1), new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.45, metalness: 0.7 }));
  plate.position.set(0, 1.7, 0.8);
  wallTemplate.add(plate);
}
const wallPool = [];
function makeWallVisual() {
  const g = wallTemplate.clone();
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 110;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.33), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  label.position.set(0, 1.7, 0.97);
  g.add(label);
  scene.add(g);
  return { g, canvas, tex, shown: -1 };
}
function drawWallHp(v, hp) {
  const val = Math.max(0, Math.ceil(hp));
  if (v.shown === val) return;
  v.shown = val;
  const g = v.canvas.getContext('2d');
  g.clearRect(0, 0, 256, 110);
  g.font = '80px "Lilita One", "Arial Black", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText(String(val), 128, 60);
  v.tex.needsUpdate = true;
}

// ---------------------------------------------------------------- game state
const LEFT = 0, MID = 1, RIGHT = 2;
const SPAWN_Z = -76;
const SHOOT_LEN = rogueBaked.clips['2H_Ranged_Shooting'].duration; // one bolt per loop
const RELEASE = 0.14; // point in the shooting loop where the bolt leaves the crossbow
const CONVEYOR = 2.7; // speed of everything that is not walking by itself
let clock = 0; // global animation clock (never resets)
let S;
let visibleAlive = 0;

function clearEntities() {
  for (const s of S?.troop || []) soldiers.release(s.i);
  for (const e of S?.enemies || []) e.crowd.release(e.i);
  if (S?.boss) bosses.release(S.boss.i);
  for (const c of S?.casterList || []) casters.release(c.i);
  for (const h of S?.heroList || []) heroes.release(h.i);
  for (const it of S?.items || []) if (it.statue !== undefined && it.statue >= 0) statues.release(it.statue);
  for (const w of S?.walls || []) { w.v.g.visible = false; wallPool.push(w.v); }
  for (const h of S?.hazards || []) releaseHazard(h);
  bolts.list.length = 0;
}

function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function startLevel(n, troopCount) {
  clearEntities();
  visibleAlive = 0;
  const cfg = levelConfig(n);
  S = {
    level: n, cfg, t: 0, phase: 'horde', gold: S?.gold || 0, home: S?.home || 0, cx: 0, targetCx: 0,
    count: troopCount, startCount: troopCount, troop: [], enemies: [], boss: null, items: [], walls: [],
    heroList: [], fireballs: [], weapon: 0, rapid: 0, stats: { ev: {}, pop: {}, lane: [0, 0, 0] }, nextHorde: 0.4, kills: 0, lost: 0, shake: 0, endT: 0, bot: S?.bot || null,
    // each side lane plays its own shuffled deck of events, so the two sides never mirror each other
    // a scripted opening (popped from the end) guarantees an early weapon chest and +5s, then the decks are random
    // scripted opening (popped from the end, nearest first): soldiers on both sides and an early weapon chest, then random decks
    side: [{ lane: LEFT, deck: ['squad', 'plus5', 'plus1', 'plus1'], next: 0 }, { lane: RIGHT, deck: ['plus5', 'plus1', 'weapon', 'plus1'], next: 0 }],
    hazards: [], nextHazard: 15, spent: {}, orbs: [], rowAcc: 0, hordeSpeed: 3, rush: 0, nextElite: cfg.eliteEvery, timeline: cfg.timeline.map((ev) => ({ ...ev })), casterList: [],
  };
  const vis = Math.min(S.count, TROOP.visibleMax);
  for (let k = 0; k < vis; k++) spawnVisibleSoldier(S.cx + (Math.random() - 0.5) * 2, TROOP_Z + (Math.random() - 0.5) * 2, true);
  // opening: a horde already on its way, +1 blocks in both side lanes
  S.hordeSpeed = cfg.hordeSpeed[0];
  for (let z = cfg.hordeStartZ; z > SPAWN_Z; z -= cfg.rowGap) spawnRow(MID, z, hordeWidth(0, z));
  for (const sd of S.side) {
    let z = -15;
    while (z > SPAWN_Z + 3) { const len = sideEvent(sd.lane, sd, z); z -= len + 1.2; }
    sd.next = 0.4;
  }
  levelLabel.textContent = 'BANE ' + n;
  overEl.classList.remove('on'); winEl.classList.remove('on');
  showBanner('BANE ' + n, 'blue');
  updateHud(true);
}

function addItem(kind, lane, z, hp, extra = {}) {
  const it = { kind, lane, x: LANES[lane], z, hp, max: hp, pending: 0, flash: 0, alive: true, pop: 0, ...extra };
  S.items.push(it);
  return it;
}
function addWall(lane, z, hp) {
  const v = wallPool.pop() || makeWallVisual();
  v.g.visible = true; v.shown = -1;
  const w = { wall: true, lane, x: LANES[lane], z, hp, max: hp, pending: 0, flash: 0, alive: true, v };
  drawWallHp(v, hp);
  S.walls.push(w);
  return w;
}

/** A squad of warriors marching in front of a big reward: you have to fight through them first. */
function escort(lane, z, n) {
  const rows = Math.ceil(n / 5);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < Math.min(5, n - r * 5); c++) spawnEnemy(z - r * 1.0, { lane, type: 'warrior', x: LANES[lane] - (LANE_W - 1.6) / 2 + (LANE_W - 1.6) * (c + 0.5) / 5 });
  }
}

function addHazard(type, lane, z) {
  const c = S.cfg.hazard[type];
  const v = hazardPool[type].pop() || hazardVisual(type);
  v.g.visible = true; v.stripe.visible = true;
  const h = { hazard: type, lane, x: LANES[lane] + (Math.random() - 0.5) * (LANE_W - 3), z, hp: c.hp * S.cfg.hpScale, max: c.hp, pending: 0, flash: 0, alive: true, v, roll: 0, speed: c.speed, radius: c.radius };
  S.hazards.push(h);
  return h;
}
function releaseHazard(h) { h.v.g.visible = false; h.v.stripe.visible = false; hazardPool[h.hazard].push(h.v); }

/** A barrel blows up: everything in the blast is hit, enemies and (if it reached the camp) soldiers. */
function explodeBarrel(h, hitTroop) {
  h.alive = false;
  const c = S.cfg.hazard.barrel;
  for (const e of S.enemies) {
    if (e.state !== 'run') continue;
    if ((e.x - h.x) ** 2 + (e.z - h.z) ** 2 < c.blast * c.blast) { e.hp -= c.damage; e.flash = 0.1; if (e.hp <= 0) killEnemy(e, true); }
  }
  if (hitTroop) loseTroops(c.kills, h.x, h.z);
  for (let k = 0; k < 120; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * c.blast * 0.7;
    glow.emit(h.x + Math.cos(a) * r * 0.5, 0.5 + Math.random() * 2, h.z + Math.sin(a) * r * 0.5, Math.cos(a) * 8, 3 + Math.random() * 9, Math.sin(a) * 8, 3.0, 1.1 + Math.random() * 0.8, 0.2, 0.8 + Math.random() * 0.7, 0.5 + Math.random() * 0.4, 8);
  }
  for (let k = 0; k < 24; k++) puff(h.x + (Math.random() - 0.5) * 3, 0.3, h.z + (Math.random() - 0.5) * 3, 1, [0.3, 0.27, 0.25], 2.6);
  floaters.add(hitTroop ? 'BUM!' : 'BUM!', { x: h.x, y: 2.5, z: h.z }, 'orange big', 0.9, 2);
  S.shake = Math.max(S.shake, hitTroop ? 0.7 : 0.45);
}

function crumbleBoulder(h) {
  h.alive = false;
  for (let k = 0; k < 40; k++) dust.emit(h.x + (Math.random() - 0.5) * 2, 0.4 + Math.random() * 1.5, h.z, (Math.random() - 0.5) * 6, 1 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.62, 0.6, 0.57, 1.6, 0.9, 6);
  S.shake = Math.max(S.shake, 0.3);
}

const _redStripe = new THREE.Color(0xff2a1a);
function updateHazards(dt, playing) {
  const R = troopRadius();
  if (playing && S.phase === 'horde') {
    S.nextHazard -= dt;
    if (S.nextHazard <= 0) {
      const c = S.cfg.hazard;
      S.nextHazard = c.every * (0.7 + Math.random() * 0.6);
      const lane = Math.floor(Math.random() * 3);
      addHazard(Math.random() < c.boulderShare ? 'boulder' : 'barrel', lane, SPAWN_Z);
    }
  }
  for (const h of S.hazards) {
    if (!h.alive) continue;
    h.z += h.speed * dt;
    // past the lanes it keeps rolling straight at its x: the troop must move out of the way (or shoot it)
    const troopFront = TROOP_Z - R * 0.72, troopBack = TROOP_Z + R * 0.72;
    if (!h.hit && h.z + h.radius > troopFront && h.z - h.radius < troopBack && Math.abs(h.x - S.cx) < R + h.radius * 0.8) {
      h.hit = true;
      if (h.hazard === 'barrel') { explodeBarrel(h, true); continue; }
      loseTroops(S.cfg.hazard.boulder.kills, h.x, h.z);
      S.shake = Math.max(S.shake, 0.6);
      floaters.add('KNUST!', { x: h.x, y: 2.5, z: h.z }, 'red big', 0.9, 2);
    }
    if (h.z > TROOP_Z + 9) { h.alive = false; continue; }
    h.roll += h.speed * dt / (h.hazard === 'barrel' ? 0.56 : 0.85);
    if (h.flash > 0) h.flash -= dt;
    h.v.g.position.set(h.x + (h.flash > 0 ? (Math.random() - 0.5) * 0.1 : 0), 0, h.z);
    h.v.inner.rotation.x = h.roll;
    if (h.hazard === 'barrel' && Math.random() < 0.5) glow.emit(h.x + 0.2, 1.3, h.z, (Math.random() - 0.5), 1.5, 0, 3, 1.6, 0.4, 0.35, 0.25); // fuse sparks
    // danger stripe from the hazard to the troop row, brightening as it closes in
    const near = THREE.MathUtils.clamp((h.z - (LANE_END_Z - 26)) / 26, 0, 1);
    const len = Math.max(0.1, TROOP_Z + 2 - h.z);
    h.v.stripe.scale.set(h.radius * 2.2, len, 1);
    h.v.stripe.position.set(h.x, 0.14, h.z + len / 2);
    h.v.stripe.material.opacity = near * (0.18 + 0.12 * Math.sin(clock * 12));
    h.v.stripe.material.color.copy(_redStripe);
    blob(h.x, h.z, h.radius * 1.6);
  }
  S.hazards = S.hazards.filter((h) => { if (!h.alive) { releaseHazard(h); return false; } return true; });
}

/** Run the next event in a side lane. Returns its length in lane units (so the next one starts after it). */
function sideEvent(lane, deckState, z0 = SPAWN_Z) {
  const cfg = S.cfg;
  if (!deckState.deck.length) deckState.deck = shuffled(EVENTS.deck);
  let ev = deckState.deck.pop();
  if (ev in cfg.budget) {
    S.spent[ev] = (S.spent[ev] || 0) + 1;
    if (S.spent[ev] > cfg.budget[ev]) ev = ['squad', 'plus1', 'squad', 'rapid', 'bomb'][Math.floor(Math.random() * 5)];
  }
  S.stats.ev[ev] = (S.stats.ev[ev] || 0) + 1;
  const prog = Math.min(1, S.t / cfg.duration);
  switch (ev) {
    case 'plus1': { const n = 8 + Math.floor(Math.random() * 7); for (let k = 0; k < n; k++) addItem('plus1', lane, z0 - k * 1.9, cfg.plus1Hp); return n * 1.9; }
    case 'plus5': { addItem('plus5', lane, z0, cfg.plus5Hp); addItem('plus5', lane, z0 - 3, cfg.plus5Hp); return 6; }
    case 'squad': { const n = Math.round(cfg.squadSize[0] + (cfg.squadSize[1] - cfg.squadSize[0]) * prog); const rows = Math.ceil(n / 6); for (let r = 0; r < rows; r++) spawnRow(lane, z0 - r * cfg.rowGap, Math.min(6, n - r * 6)); return rows * cfg.rowGap + 1; }
    case 'fort': { escort(lane, z0, cfg.escort); addWall(lane, z0 - 4, cfg.fortHp); addItem('plus99', lane, z0 - 6.4, cfg.plus99Hp); return 10; }
    case 'weapon': { if (S.weapon + S.items.filter((i) => i.alive && i.kind === 'weapon').length >= WEAPON.length - 1) return sideEvent(lane, deckState, z0); addItem('weapon', lane, z0, cfg.weaponHp); return 4; }
    case 'weapon2': { if (S.weapon >= WEAPON.length - 2) return sideEvent(lane, deckState, z0); escort(lane, z0, cfg.escort); addWall(lane, z0 - 4, cfg.bigWeaponWallHp); addItem('weapon2', lane, z0 - 6.8, cfg.bigWeaponHp); return 11; }
    case 'prisoner': {
      if (S.heroList.length + S.items.filter((i) => i.alive && i.kind === 'prisoner').length >= cfg.maxHeroes) return sideEvent(lane, deckState, z0);
      const st = statues.alloc();
      if (st < 0) return 4;
      statues.play(st, 'Idle', clock, 0.0001, Math.random());
      addItem('prisoner', lane, z0, cfg.prisonHp, { statue: st, chunksLeft: PRISON_CHUNKS });
      return 5;
    }
    case 'altar': {
      // OFFERPORT: breaking it costs a share of the troop, and instantly hands over the big reward locked behind it
      const reward = Math.random() < 0.5 && S.weapon < WEAPON.length - 2 ? 'weapon2' : S.heroList.length < cfg.maxHeroes ? 'prisoner' : 'weapon2';
      const gate = addItem('altar', lane, z0, cfg.altar.hp, { reward });
      if (reward === 'prisoner') {
        const st = statues.alloc();
        if (st >= 0) { statues.play(st, 'Idle', clock, 0.0001, Math.random()); addItem('prisoner', lane, z0 - 3, cfg.prisonHp, { statue: st, chunksLeft: PRISON_CHUNKS, lockedBy: gate }); }
      } else addItem('weapon2', lane, z0 - 3, cfg.bigWeaponHp, { lockedBy: gate });
      return 7;
    }
    case 'barrels': { for (let k = 0; k < 2; k++) addHazard('barrel', lane, z0 - k * 5); return 10; }
    case 'rapid': { addItem('rapid', lane, z0, cfg.rapidHp); return 4; }
    case 'bomb': { addItem('bomb', lane, z0, cfg.bombHp); return 4; }
    default: return 4;
  }
}

// formation slot (sunflower packing => round, dense clump that grows wider with size)
function slot(k) {
  const r = 0.42 * Math.sqrt(k + 0.6);
  const a = k * 2.399963;
  return [Math.cos(a) * r, Math.sin(a) * r * 0.7];
}
function troopRadius() { return 0.42 * Math.sqrt(Math.max(1, visibleAlive) + 0.6); }
function fireSpeed() { return S.rapid > 0 ? 1.9 : 1; }

function spawnVisibleSoldier(x, z, instant) {
  const i = soldiers.alloc();
  if (i < 0) return false;
  const s = { i, x, z, state: instant ? 'shoot' : 'run', dying: 0, yaw: Math.PI, sp: 0.95 + Math.random() * 0.13, z0: 0, idle: 0, fs: 1 };
  if (instant) playShoot(s, Math.random());
  else soldiers.play(i, 'Running_A', clock, 1.2, Math.random());
  S.troop.push(s);
  visibleAlive++;
  return true;
}
/** Where a shooting soldier is in its crossbow loop right now (0..1). */
function shootPhase(s) {
  const L = SHOOT_LEN / (s.sp * s.fs);
  return (((clock - s.z0) / L) % 1 + 1) % 1;
}
/** Change fire speed without resetting anyone's rhythm: every soldier keeps its own phase, so fire stays continuous. */
function retime(s) { if (s.state === 'shoot') playShoot(s, shootPhase(s)); }
function playShoot(s, phase) {
  s.fs = fireSpeed();
  const sp = s.sp * s.fs;
  s.z0 = clock - phase * SHOOT_LEN / sp;
  soldiers.play(s.i, '2H_Ranged_Shooting', clock, sp, phase * SHOOT_LEN / sp);
}

function gainTroops(n) { S.count += n; }

/** Lose soldiers near (x,z); a visible soldier always falls so the hit reads on screen. */
function loseTroops(n, x, z, label = true) {
  n = Math.min(n, S.count);
  if (n <= 0) return;
  S.count -= n; S.lost += n;
  if (label) floaters.add('-' + n, { x, y: 1.4, z: z - 0.5 }, 'red', 0.7, 1.2);
  const fall = Math.min(n, 8);
  for (let k = 0; k < fall; k++) { const s = nearestSoldier(x, z); if (s) killSoldier(s); }
  while (visibleAlive > S.count) { const s = nearestSoldier(x, z); if (!s) break; killSoldier(s); }
}

/** Width (enemies per row) of the middle horde: grows over the level, with thick and thin waves. */
function hordeWidth(p, z = 0) {
  const c = S.cfg;
  const base = c.hordeWidth[0] + (c.hordeWidth[1] - c.hordeWidth[0]) * p;
  const wave = 1 + c.hordeWave * Math.sin((S.t * c.hordeSpeed[0] - z) * 0.11);
  return Math.max(1, Math.min(ROW_MAX, base * wave));
}
const RUN_STRIDE = 3.0; // ground speed (units/s) that the running cycle covers at 1x playback
const ROW_MAX = Math.round(LANE_W * 1.25); // enemies across a full row
/** One row of enemies across a lane (fractional widths are dithered so density changes smoothly). */
function spawnRow(lane, z, width, fast = 1) {
  const n = Math.floor(width) + (Math.random() < width % 1 ? 1 : 0);
  const span = LANE_W - 1.0;
  const shift = Math.random(); // each row is offset differently so the rows never line up into stripes
  for (let c = 0; c < n; c++) {
    const f = ((((c + shift + (Math.random() - 0.5) * 0.7) / n) % 1) + 1) % 1; // 0..1 across the lane
    const x = LANES[lane] - span / 2 + span * f;
    spawnEnemy(z + (Math.random() - 0.5) * S.cfg.rowGap * 0.8, { lane, x, fast });
  }
}

function spawnEnemy(z, opts = {}) {
  const cfg = S.cfg;
  const prog = Math.min(1, S.t / cfg.duration);
  let type = opts.type;
  if (!type) {
    const r = Math.random();
    const bru = Math.max(0, (prog - 0.3) / 0.7) * cfg.bruteShare[1];
    const war = cfg.warriorShare[0] + (cfg.warriorShare[1] - cfg.warriorShare[0]) * prog;
    type = r < bru ? 'brute' : r < bru + war ? 'warrior' : 'minion';
  }
  const T = ENEMY[type];
  const crowd = type === 'elite' ? elites : type === 'minion' ? minions : warriors;
  const i = crowd.alloc();
  if (i < 0) return;
  const lane = opts.lane ?? MID;
  const fast = opts.fast || 1;
  const e = {
    crowd, i, lane, type, x: opts.x ?? LANES[lane] + (Math.random() - 0.5) * (LANE_W - 1.2), z,
    hp: T.hp * cfg.hpScale, pending: 0, scale: T.scale, warrior: type !== 'minion',
    speed: S.hordeSpeed * fast * (0.97 + Math.random() * 0.06), // one pace for everyone, so the mass stays packed
    state: 'run', t: 0, flash: 0, y: 0,
  };
  // they run: the running cycle plays at the rate that matches their ground speed (feet don't slide)
  crowd.play(i, 'Running_A', clock, e.speed / RUN_STRIDE * (0.95 + Math.random() * 0.1), Math.random() * 2);
  S.enemies.push(e);
}

/** Skeletmagiker: walks down a side lane, stops in crossbow range and blasts the troop until it is killed. */
function spawnCaster(lane) {
  const i = casters.alloc();
  if (i < 0) return;
  const c = S.cfg.caster;
  S.casterList.push({ caster: true, i, lane, x: LANES[lane], z: SPAWN_Z, hp: c.hp, max: c.hp, pending: 0, flash: 0, state: 'walk', t: 0, cast: 0, y: 0 });
  casters.play(i, 'Walking_D_Skeletons', clock, 0.9);
  showBanner('SKELETMAGIKER!', 'purple');
}

function spawnBoss() {
  const i = bosses.alloc();
  if (i < 0) return;
  const cfg = S.cfg;
  const bossHp = cfg.bossHp; // fixed: a strong troop beats it, a weak one does not
  S.boss = { i, x: LANES[MID], z: SPAWN_Z - 2, hp: bossHp, max: bossHp, pending: 0, speed: cfg.bossSpeed, state: 'walk', flash: 0, atk: 0, y: 0, t: 0 };
  bosses.play(i, 'Walking_D_Skeletons', clock, 0.95);
  showBanner('BOSS', 'red');
  S.shake = 0.4;
}

// ---------------------------------------------------------------- input
const XMAX = EDGE - 2.4; // troop centre stays inside the outer lanes, so the clump never leaves the screen
let dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); hideHint(); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  S.targetCx = THREE.MathUtils.clamp(S.targetCx + dx * (2.1 * EDGE / window.innerWidth), -XMAX, XMAX);
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key] = true; hideHint(); });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// ---------------------------------------------------------------- HUD
const goldEl = document.getElementById('gold');
const troopEl = document.getElementById('troop');
const weaponEl = document.getElementById('weapon');
const rapidEl = document.getElementById('rapid');
const bossBar = document.getElementById('bossbar');
const bossFill = bossBar.querySelector('i');
const progFill = document.querySelector('#progress .fill');
const progEl = document.getElementById('progress');
const levelLabel = document.getElementById('levelLabel');
const banner = document.getElementById('banner');
const overEl = document.getElementById('over');
const winEl = document.getElementById('win');
const hint = document.getElementById('hint');
function hideHint() { hint.classList.add('gone'); }
let lastHud = -1;
function updateHud(force) {
  if (!force && Math.abs(clock - lastHud) < 0.08) return;
  lastHud = clock;
  goldEl.textContent = S.gold.toLocaleString('da-DK');
  troopEl.querySelector('b').textContent = S.count.toLocaleString('da-DK');
  weaponEl.querySelector('b').textContent = WEAPON[S.weapon].name;
  weaponEl.style.setProperty('--wc', WEAPON[S.weapon].css);
  rapidEl.classList.toggle('on', S.rapid > 0);
  rapidEl.querySelector('b').textContent = Math.ceil(S.rapid) + ' s';
  progFill.style.width = (Math.min(1, S.t / S.cfg.duration) * 100).toFixed(1) + '%';
  progEl.classList.toggle('boss', S.phase !== 'horde');
  if (S.boss && S.boss.state !== 'dead') { bossBar.classList.add('on'); bossFill.style.width = Math.max(0, S.boss.hp / S.boss.max * 100) + '%'; }
  else bossBar.classList.remove('on');
}
function showBanner(text, cls) { banner.className = cls || ''; banner.textContent = text; void banner.offsetWidth; banner.classList.add('show'); }
function fmtTime(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
const startTroop = (n) => TROOP.start + (n - 1) * TROOP.startPerLevel;
document.getElementById('again').addEventListener('click', () => startLevel(S.level, S.startCount));
document.getElementById('next').addEventListener('click', () => { S.home += S.count; startLevel(S.level + 1, startTroop(S.level + 1)); });

// ---------------------------------------------------------------- shooting
const laneTargets = [[], [], []];
function laneOf(x) { return x < -LANE_W / 2 ? LEFT : x > LANE_W / 2 ? RIGHT : MID; }
const _from = new THREE.Vector3(), _to = new THREE.Vector3();

function buildTargets() {
  for (const L of laneTargets) L.length = 0;
  for (const e of S.enemies) if (e.state === 'run') laneTargets[laneOf(e.x)].push(e);
  for (const it of S.items) if (it.alive && !(it.lockedBy && it.lockedBy.alive)) laneTargets[it.lane].push(it);
  for (const h of S.hazards) if (h.alive) laneTargets[laneOf(h.x)].push(h);
  for (const w of S.walls) if (w.alive) laneTargets[w.lane].push(w);
  if (S.boss && S.boss.state !== 'dead') laneTargets[laneOf(S.boss.x)].push(S.boss);
  for (const c of S.casterList) if (c.state !== 'dead') laneTargets[c.lane].push(c);
  for (const L of laneTargets) L.sort((a, b) => b.z - a.z);
}

// nearest target in the lane that still needs damage; if everything is already covered, the nearest one anyway
function pickTarget(lane, fromZ) {
  const L = laneTargets[lane];
  let fallback = null;
  for (let k = 0; k < L.length; k++) {
    const t = L[k];
    if (t.z > fromZ - 0.6 || t.z < fromZ - TROOP.range) continue; // crossbow range: the fight happens on screen, not at the horizon
    if (t.hp - t.pending > 0) return t;
    if (!fallback) fallback = t;
  }
  return fallback;
}

function hitHeight(t) {
  if (t.wall) return 1.6;
  if (t === S.boss) return 2.6;
  if (t.caster) return 1.6;
  if (t.hazard) return t.hazard === 'barrel' ? 0.6 : 1.0;
  if (t.type === 'elite') return 1.4;
  if (t.kind) return 0.8;
  return t.warrior ? 0.95 : 0.85;
}

function shoot(s, dmg) {
  const t = pickTarget(laneOf(s.x), s.z);
  const w = WEAPON[S.weapon];
  _from.set(s.x + 0.12, 0.85, s.z - 0.55);
  glow.emit(_from.x, _from.y, _from.z, 0, 0, 0, w.flash[0], w.flash[1], w.flash[2], 0.5, 0.06);
  if (!t) {
    // nothing to hit: the bolt flies to max range and thuds into the ground
    _to.set(s.x + (Math.random() - 0.5) * 0.8, 0.05, s.z - TROOP.range * (0.82 + Math.random() * 0.18));
    const gx = _to.x, gz = _to.z;
    bolts.fire(_from, _to, 80, () => {
      if (Math.random() < 0.35) dust.emit(gx, 0.15, gz, (Math.random() - 0.5), 0.8, (Math.random() - 0.5), 0.62, 0.56, 0.48, 0.7, 0.5, 0.5);
      if (Math.random() < 0.5) glow.emit(gx, 0.12, gz, (Math.random() - 0.5) * 2, 1.5, 0, w.flash[0] * 0.6, w.flash[1] * 0.6, w.flash[2] * 0.6, 0.22, 0.15, 6);
    });
    return false;
  }
  t.pending += dmg;
  _to.set(t.x + (Math.random() - 0.5) * (t.wall ? 2.4 : t.kind ? 2.6 : t === S.boss ? 0.8 : 0.3), hitHeight(t), t.z + 0.2);
  const hx = _to.x, hy = _to.y, hz = _to.z;
  bolts.fire(_from, _to, 80, () => { t.pending -= dmg; damage(t, dmg, hx, hy, hz); });
  return true;
}

function damage(t, dmg, hx, hy, hz) {
  if (S.phase === 'lost') return;
  const w = WEAPON[S.weapon];
  if (t.wall) {
    if (!t.alive) return;
    t.hp -= dmg; t.flash = 0.08;
    sparks(hx, hy, hz + 0.5, 0.9, 0.8, 0.7, 2);
    if (t.hp <= 0) breakWall(t);
    return;
  }
  if (t.hazard) {
    if (!t.alive) return;
    t.hp -= dmg; t.flash = 0.08;
    sparks(hx, hy, hz + 0.4, 1.0, 0.8, 0.6, 2);
    if (t.hp <= 0) { if (t.hazard === 'barrel') explodeBarrel(t, false); else crumbleBoulder(t); }
    return;
  }
  if (t.caster) {
    if (t.state === 'dead') return;
    t.hp -= dmg; t.flash = 0.08;
    sparks(hx, hy, hz + 0.3, 0.8, 0.4, 1.0, 2);
    if (t.hp <= 0) killCaster(t);
    return;
  }
  if (t === S.boss) {
    if (!S.boss || S.boss.state === 'dead') return;
    S.boss.hp -= dmg; S.boss.flash = 0.07;
    sparks(hx, hy, hz + 0.3, w.flash[0] / 2.6, w.flash[1] / 2.6, w.flash[2] / 2.6, 2);
    if (S.boss.hp <= 0) killBoss();
    return;
  }
  if (t.kind) {
    if (!t.alive) return;
    t.hp -= dmg; t.flash = 0.08;
    const c = new THREE.Color(KIND_STYLE[t.kind]?.color ?? 0xb0aaa4);
    sparks(hx, hy + 0.2, hz + 0.45, c.r, c.g, c.b, 3);
    if (t.kind === 'prisoner') crackPrison(t);
    if (t.hp <= 0) popItem(t);
    return;
  }
  if (t.state !== 'run') { pierce(t, dmg, hx, hz); return; } // already dead: the bolt carries on
  const before = t.hp;
  t.hp -= dmg; t.flash = 0.09;
  sparks(hx, hy, hz, 1.0, 0.95, 0.85, 2);
  if (t.hp <= 0) { killEnemy(t, true); if (dmg - before > 0.01) pierce(t, dmg - before, hx, hz); }
}

/** A bolt that has killed its target keeps going through the enemies right behind it, spending what is left. */
function pierce(from, left, hx, hz) {
  const lane = laneOf(from.x);
  let z = from.z;
  for (let n = 0; n < TROOP.pierce && left > 0.01; n++) {
    let next = null, bz = -1e9;
    for (const e of S.enemies) {
      if (e.state !== 'run' || e.z >= z || e.z < z - 2.6 || e.z <= bz || laneOf(e.x) !== lane || Math.abs(e.x - hx) > 1.4) continue;
      bz = e.z; next = e;
    }
    if (!next) return;
    const before = next.hp;
    next.hp -= left; next.flash = 0.09;
    if (n < 2) sparks(next.x, 0.9, next.z, 1.0, 0.95, 0.85, 1);
    if (next.hp > 0) return;
    killEnemy(next, true);
    left -= before; z = next.z;
  }
}

function sparks(x, y, z, r, g, b, n) {
  for (let k = 0; k < n; k++) glow.emit(x, y, z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.2) * 5, r * 2, g * 2, b * 2, 0.22, 0.25 + Math.random() * 0.2, 9);
}
function puff(x, y, z, n, col = [0.75, 0.72, 0.66], size = 1.1) {
  for (let k = 0; k < n; k++) dust.emit(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2.5, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 2.5, col[0], col[1], col[2], size * (0.6 + Math.random() * 0.8), 0.7 + Math.random() * 0.6, 0.6);
}
function burst(x, y, z, n, col, speed = 8, size = 0.35) {
  for (let k = 0; k < n; k++) glow.emit(x + (Math.random() - 0.5) * 2.6, y + Math.random() * 0.6, z, (Math.random() - 0.5) * speed, 2 + Math.random() * speed * 0.75, (Math.random() - 0.5) * speed * 0.75, col[0], col[1], col[2], size, 0.5 + Math.random() * 0.4, 14);
}

function killEnemy(e, reward) {
  e.state = 'dead'; e.t = 0;
  e.kb = 1.5 + Math.random() * 1.5; // knock-back speed
  e.crowd.play(e.i, 'Death_C_Skeletons', clock, 1.15);
  if (reward) {
    const T = ENEMY[e.type];
    S.gold += T.gold; S.kills++;
    if (T.troops) {
      gainTroops(T.troops);
      floaters.add('+' + T.troops, { x: e.x, y: 2.4, z: e.z }, 'gold big', 1.2, 2.6);
      burst(e.x, 1.2, e.z, 40, [2.6, 2.0, 0.5], 9, 0.4);
    }
  }
  if (Math.random() < 0.5) puff(e.x, 0.3, e.z, 1, [0.55, 0.5, 0.46], 0.8);
}

function popItem(it) {
  it.alive = false;
  S.stats.pop[it.kind] = (S.stats.pop[it.kind] || 0) + 1;
  const p = { x: it.x, y: 1.8, z: it.z };
  switch (it.kind) {
    case 'plus1': case 'plus5': case 'plus99': {
      const n = it.kind === 'plus1' ? 1 : it.kind === 'plus5' ? 5 : 99;
      floaters.add('+' + n, p, n >= 99 ? 'gold big' : 'blue', 1.0, 2.6);
      burst(it.x, 0.6, it.z, n >= 99 ? 40 : 14, n >= 99 ? [2.4, 1.6, 0.2] : [0.5, 1.0, 2.6]);
      gainTroops(n);
      if (n >= 99) S.shake = Math.max(S.shake, 0.25);
      break;
    }
    case 'weapon': {
      S.weapon = Math.min(WEAPON.length - 1, S.weapon + 1);
      floaters.add(WEAPON[S.weapon].name.toUpperCase() + '!', p, 'purple big', 1.6, 3);
      burst(it.x, 0.8, it.z, 50, [1.8, 0.8, 3.0], 10, 0.4);
      S.shake = Math.max(S.shake, 0.3);
      break;
    }
    case 'weapon2': {
      S.weapon = Math.min(WEAPON.length - 1, S.weapon + 2);
      floaters.add(WEAPON[S.weapon].name.toUpperCase() + '!', p, 'purple big', 1.8, 3);
      burst(it.x, 0.8, it.z, 80, [2.6, 1.6, 3.2], 12, 0.45);
      S.shake = Math.max(S.shake, 0.5);
      break;
    }
    case 'prisoner': {
      statues.release(it.statue); it.statue = -1;
      for (let k = 0; k < 30; k++) puff(it.x + (Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 1.5, it.z, 1, [0.62, 0.6, 0.58], 1.4);
      burst(it.x, 1.0, it.z, 60, [2.2, 1.0, 3.2], 9, 0.4);
      floaters.add('HELT BEFRIET!', p, 'purple big', 1.8, 3);
      freeHero(it.x, it.z);
      S.shake = Math.max(S.shake, 0.4);
      break;
    }
    case 'altar': {
      const cost = Math.max(S.cfg.altar.min, Math.round(S.count * S.cfg.altar.share));
      loseTroops(Math.min(cost, S.count - 1), S.cx, TROOP_Z);
      floaters.add('-' + cost + ' OFRET', p, 'red big', 1.4, 2.6);
      burst(it.x, 1, it.z, 50, [2.4, 0.2, 0.2], 9, 0.4);
      for (const o of S.items) if (o.lockedBy === it && o.alive) { if (o.kind === 'prisoner') o.hp = 0; popItem(o); }
      break;
    }
    case 'rapid': {
      S.rapid = S.cfg.rapidTime;
      floaters.add('2× SKUD!', p, 'orange big', 1.4, 3);
      burst(it.x, 0.8, it.z, 40, [3.0, 1.4, 0.3], 9, 0.4);
      for (const s of S.troop) retime(s);
      break;
    }
    case 'bomb': {
      floaters.add('BOMBE!', p, 'red big', 1.2, 3);
      detonate();
      break;
    }
  }
}

/** Bomb: a big blast where the middle horde is densest, close to the troop. */
function detonate() {
  const cfg = S.cfg;
  let bestZ = -30, best = -1;
  for (let z = -10; z > -60; z -= 2) {
    let n = 0;
    for (const e of S.enemies) if (e.state === 'run' && Math.abs(e.z - z) < cfg.bombRadius) n++;
    if (n > best) { best = n; bestZ = z; }
  }
  const cx = LANES[MID];
  S.shake = 1.0;
  for (const e of S.enemies) {
    if (e.state !== 'run') continue;
    const d = Math.hypot(e.x - cx, e.z - bestZ);
    if (d < cfg.bombRadius) { e.hp -= cfg.bombDamage; e.flash = 0.1; if (e.hp <= 0) killEnemy(e, true); }
  }
  if (S.boss && S.boss.state !== 'dead' && Math.abs(S.boss.z - bestZ) < cfg.bombRadius) { S.boss.hp -= cfg.bombDamage * 4; if (S.boss.hp <= 0) killBoss(); }
  for (let k = 0; k < 140; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * cfg.bombRadius * 0.8;
    glow.emit(cx + Math.cos(a) * r * 0.6, 0.5 + Math.random() * 2, bestZ + Math.sin(a) * r, Math.cos(a) * 9, 4 + Math.random() * 10, Math.sin(a) * 9, 3.0, 1.2 + Math.random() * 0.8, 0.2, 0.9 + Math.random() * 0.8, 0.6 + Math.random() * 0.5, 8);
  }
  for (let k = 0; k < 40; k++) puff(cx + (Math.random() - 0.5) * 6, 0.3, bestZ + (Math.random() - 0.5) * cfg.bombRadius * 1.5, 1, [0.35, 0.3, 0.28], 3.2);
}

function breakWall(w) {
  w.alive = false;
  w.v.g.visible = false;
  wallPool.push(w.v);
  S.shake = Math.max(S.shake, 0.6);
  for (let k = 0; k < 40; k++) puff(w.x + (Math.random() - 0.5) * 4.5, Math.random() * 2, w.z, 1, [0.6, 0.58, 0.55], 1.8);
  burst(w.x, 1, w.z, 60, [2.4, 1.4, 0.5], 12, 0.3);
  floaters.add('MUREN ER NEDE!', { x: w.x, y: 3, z: w.z }, 'gold', 1.4, 2);
}

function killBoss() {
  const b = S.boss;
  b.state = 'dead'; b.t = 0;
  bosses.play(b.i, 'Death_C_Skeletons', clock, 0.9);
  S.gold += S.cfg.gold.boss;
  S.shake = 0.9;
  floaters.add('+' + S.cfg.gold.boss + ' guld', { x: b.x, y: 4, z: b.z }, 'gold big', 1.6, 3);
  for (let k = 0; k < 90; k++) glow.emit(b.x + (Math.random() - 0.5) * 2, 1 + Math.random() * 3, b.z, (Math.random() - 0.5) * 14, 2 + Math.random() * 10, (Math.random() - 0.5) * 10, 2.6, 0.6, 0.2, 0.45, 0.9, 10);
  for (let k = 0; k < 30; k++) puff(b.x, 0.5, b.z, 1, [0.7, 0.66, 0.6], 2.2);
  for (const e of S.enemies) if (e.state === 'run') killEnemy(e, true); // the horde collapses with its king
  S.phase = 'won'; S.endT = 0;
  S.gold += S.cfg.gold.clear;
}

function killCaster(c) {
  c.state = 'dead'; c.t = 0;
  casters.play(c.i, 'Death_C_Skeletons', clock, 1);
  const r = S.cfg.caster;
  S.gold += r.gold; gainTroops(r.troops);
  floaters.add('+' + r.troops, { x: c.x, y: 3, z: c.z }, 'gold big', 1.5, 3);
  burst(c.x, 1.5, c.z, 70, [1.8, 0.6, 3.0], 11, 0.45);
  S.shake = Math.max(S.shake, 0.4);
}

function updateCasters(dt, playing) {
  const cfg = S.cfg.caster;
  for (const c of S.casterList) {
    c.t += dt;
    if (c.state === 'dead') {
      if (c.t > 1.8) c.y -= dt * 1.2;
      if (c.t > 2.8) c.remove = true;
    } else if (c.state === 'walk') {
      c.z += S.hordeSpeed * dt;
      if (c.z >= TROOP_Z - cfg.stopAt) { c.state = 'cast'; c.cast = 0.6; casters.play(c.i, 'Spellcast_Shoot', clock, 0.9); }
    } else if (playing) {
      c.cast -= dt;
      if (c.cast <= 0) {
        c.cast = cfg.interval;
        // a purple orb arcs over to the troop and takes soldiers with it
        S.orbs.push({ x: c.x, y: 2.2, z: c.z + 0.5, t: 0, dur: 0.9, kills: cfg.kills });
        glow.emit(c.x, 2.2, c.z + 0.5, 0, 0.5, 0, 1.8, 0.5, 3.2, 1.6, 0.2);
      }
    }
    if (c.flash > 0) c.flash -= dt;
    casters.flash(c.i, Math.max(0, c.flash) * 12);
    casters.setTransform(c.i, c.x, c.y, c.z, 0, 1.7);
    if (c.state !== 'dead') blob(c.x, c.z, 1.6);
  }
  S.casterList = S.casterList.filter((c) => { if (c.remove) { casters.release(c.i); return false; } return true; });
  let w = 0;
  for (const o of S.orbs) {
    o.t += dt;
    const k = Math.min(1, o.t / o.dur);
    const x = o.x + (S.cx - o.x) * k, z = o.z + (TROOP_Z - o.z) * k, y = o.y + Math.sin(k * Math.PI) * 4 * (1 - k * 0.6);
    glow.emit(x, y, z, 0, 0, 0, 1.8, 0.5, 3.4, 1.3, 0.12);
    glow.emit(x, y, z - 0.3, (Math.random() - 0.5) * 1.5, 0.6, -1.5, 1.2, 0.3, 2.6, 0.6, 0.3);
    if (k < 1) { S.orbs[w++] = o; continue; }
    loseTroops(o.kills, S.cx, TROOP_Z);
    for (let n = 0; n < 30; n++) glow.emit(S.cx, 0.8, TROOP_Z, (Math.random() - 0.5) * 8, 2 + Math.random() * 5, (Math.random() - 0.5) * 8, 1.8, 0.5, 3.2, 0.5, 0.5, 9);
    S.shake = Math.max(S.shake, 0.25);
  }
  S.orbs.length = w;
}

function killSoldier(s) {
  if (s.state === 'dead') return;
  s.state = 'dead'; s.dying = 0;
  visibleAlive--;
  soldiers.play(s.i, 'Death_A', clock, 1.2);
  glow.emit(s.x, 0.8, s.z, 0, 1, 0, 0.6, 1.2, 3, 0.9, 0.18);
}

function nearestSoldier(x, z) {
  let best = null, bd = 1e9;
  for (const s of S.troop) {
    if (s.state === 'dead') continue;
    const d = (s.x - x) ** 2 + (s.z - z) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function crackPrison(it) {
  const want = Math.ceil(Math.max(0, it.hp) / it.max * PRISON_CHUNKS);
  while (it.chunksLeft > want) {
    const c = CHUNK_LAYOUT[PRISON_CHUNKS - it.chunksLeft];
    it.chunksLeft--;
    const x = it.x + c.x, y = c.y, z = it.z + c.z;
    for (let k = 0; k < 8; k++) dust.emit(x, y, z, (Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.2) * 4, 0.6, 0.58, 0.55, 0.9, 0.7, 6);
    for (let k = 0; k < 6; k++) glow.emit(x, y, z, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, Math.random() * 4, 1.4, 1.3, 1.2, 0.18, 0.4, 12);
  }
}

function freeHero(x, z) {
  const i = heroes.alloc();
  if (i < 0) return;
  const h = { i, x, z, state: 'run', z0: 0, yaw: Math.PI };
  heroes.play(i, 'Running_A', clock, 1.2, 0);
  S.heroList.push(h);
}
const CAST_LEN = mageBaked.clips['Spellcast_Shoot'].duration;
const CAST_RELEASE = 0.5;
function heroTarget(h) {
  // the nearest enemy in reach (any lane); otherwise whatever is nearest in the hero's own lane
  let best = null, bz = -1e9;
  for (const e of S.enemies) if (e.state === 'run' && e.z < h.z - 1 && e.z > h.z - S.cfg.heroRange && e.z > bz) { bz = e.z; best = e; }
  if (best) return best;
  if (S.boss && S.boss.state !== 'dead' && S.boss.z > h.z - S.cfg.heroRange) return S.boss;
  return pickTarget(laneOf(h.x), h.z);
}
function castFireball(h) {
  const t = heroTarget(h);
  if (!t) return;
  const dmg = S.cfg.heroDamage * WEAPON[S.weapon].mul;
  S.fireballs.push({ x: h.x, y: 1.5, z: h.z - 0.6, tx: t.x, ty: hitHeight(t), tz: t.z + 0.4, t: 0, dur: Math.max(0.15, Math.hypot(t.x - h.x, t.z - h.z) / 42), target: t, dmg });
  glow.emit(h.x, 1.6, h.z - 0.6, 0, 0.5, 0, 3.0, 1.2, 0.4, 1.4, 0.15);
}
function updateFireballs(dt) {
  let w = 0;
  for (const f of S.fireballs) {
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    const x = f.x + (f.tx - f.x) * k, z = f.z + (f.tz - f.z) * k, y = f.y + (f.ty - f.y) * k + Math.sin(k * Math.PI) * 1.4;
    glow.emit(x, y, z, 0, 0, 0, 3.2, 1.3, 0.35, 1.2, 0.12);
    glow.emit(x + (Math.random() - 0.5) * 0.3, y, z + 0.3, (Math.random() - 0.5) * 1.5, 0.8, 1.5, 2.6, 0.7, 0.15, 0.6, 0.3);
    if (k < 1) { S.fireballs[w++] = f; continue; }
    // impact: area damage around the hit point
    const R = S.cfg.heroRadius;
    for (const e of S.enemies) {
      if (e.state !== 'run') continue;
      if ((e.x - f.tx) ** 2 + (e.z - f.tz) ** 2 < R * R) { e.hp -= f.dmg; e.flash = 0.1; if (e.hp <= 0) killEnemy(e, true); }
    }
    const t = f.target;
    if (t && (t.kind || t.wall || t === S.boss)) damage(t, f.dmg, f.tx, f.ty, f.tz);
    for (let n = 0; n < 26; n++) glow.emit(f.tx, f.ty, f.tz, (Math.random() - 0.5) * 9, 1 + Math.random() * 6, (Math.random() - 0.5) * 9, 3.2, 1.1 + Math.random(), 0.25, 0.5, 0.45, 9);
    for (let n = 0; n < 4; n++) puff(f.tx, 0.2, f.tz, 1, [0.32, 0.28, 0.26], 1.6);
    S.shake = Math.max(S.shake, 0.12);
  }
  S.fireballs.length = w;
}
function updateHeroes(dt, playing) {
  const n = S.heroList.length;
  S.heroList.forEach((h, j) => {
    const side = j % 2 === 0 ? 1 : -1, row = Math.floor(j / 2);
    const hx = THREE.MathUtils.clamp(S.cx + side * (troopRadius() + 0.9 + row * 0.9), -EDGE + 0.8, EDGE - 0.8); // stay on screen
    const hz = TROOP_Z - 0.4 + row * 1.2;
    const dx = hx - h.x, dz = hz - h.z, d = Math.hypot(dx, dz);
    if (h.state === 'run') {
      const m = Math.min(d, 12 * dt);
      if (d > 0.01) { h.x += dx / d * m; h.z += dz / d * m; }
      h.yaw = d > 0.3 ? Math.atan2(dx, dz) : Math.PI;
      if (d < 0.3) { h.state = 'cast'; h.z0 = clock; heroes.play(h.i, 'Spellcast_Shoot', clock, 1, 0); }
    } else {
      h.x = hx; h.z = hz; h.yaw = Math.PI;
      if (playing) {
        const ph = ((clock - h.z0) / CAST_LEN) % 1, prev = ((clock - dt - h.z0) / CAST_LEN) % 1;
        if (prev < CAST_RELEASE && ph >= CAST_RELEASE) castFireball(h);
      } else if (h.state !== 'cheer' && S.phase === 'won') { h.state = 'cheer'; heroes.play(h.i, 'Cheer', clock, 1, 0); }
    }
    heroes.setTransform(h.i, h.x, 0, h.z, h.yaw, 1.1);
    blob(h.x, h.z, 1.1);
  });
}

// ---------------------------------------------------------------- bots (balance testing only)
const VALUE = { plus1: 1, plus5: 5, plus99: 99, weapon: 400, weapon2: 900, prisoner: 700, rapid: 60, bomb: 40, altar: 500 };
/** A greedy player: defends the lane with the most pressure, otherwise farms the lane with the best reward per health. */
function botTarget(style) {
  if (style === 'middle') return LANES[MID];
  const dps = Math.max(1, S.count * TROOP.boltDamage * WEAPON[S.weapon].mul * 0.94);
  // threat: health of enemies close to the troop, per lane (+ anything already in the courtyard)
  const threat = [0, 0, 0], reward = [0, 0, 0], cost = [1, 1, 1];
  for (const e of S.enemies) if (e.state === 'run' && e.z > TROOP_Z - 22) threat[laneOf(e.x)] += e.hp * (e.z > LANE_END_Z - 4 ? 2 : 1);
  if (S.boss && S.boss.state !== 'dead' && S.boss.z > TROOP_Z - 30) threat[laneOf(S.boss.x)] += S.boss.hp;
  for (const c of S.casterList) if (c.state === 'cast') threat[c.lane] += dps * 3;
  for (const it of S.items) if (it.alive && it.z > TROOP_Z - TROOP.range) { reward[it.lane] += style === 'noweapon' && /weapon/.test(it.kind) ? 0 : VALUE[it.kind]; cost[it.lane] += it.hp; }
  for (const w of S.walls) if (w.alive && w.z > TROOP_Z - TROOP.range) cost[w.lane] += w.hp;
  // dodge: a hazard about to reach the camp in a lane makes that lane off-limits
  const avoid = [false, false, false];
  for (const h of S.hazards) if (h.alive && h.z > TROOP_Z - 16) avoid[laneOf(h.x)] = true;
  const worst0 = threat.indexOf(Math.max(...threat));
  const worst = avoid[worst0] ? [LEFT, MID, RIGHT].filter((L) => !avoid[L]).sort((a, b) => threat[b] - threat[a])[0] ?? worst0 : worst0;
  for (const L of [LEFT, MID, RIGHT]) if (avoid[L]) reward[L] = 0;
  // 'weak' = a cautious player who mostly defends and only grabs what is cheap
  if (threat[worst] > dps * (style === 'weak' ? 0.4 : 1.1)) return LANES[worst];
  let bestL = worst, bestV = 0;
  for (const L of [LEFT, MID, RIGHT]) {
    const v = reward[L] / (cost[L] / dps + 2) / (style === 'weak' ? 1 + cost[L] / dps : 1);
    if (v > bestV) { bestV = v; bestL = L; }
  }
  if (bestV === 0) return LANES[worst];
  return LANES[bestL];
}

// ---------------------------------------------------------------- update
function update(dt) {
  clock += dt;
  setVatTime(clock);
  const playing = S.phase === 'horde' || S.phase === 'boss';
  if (playing) S.t += dt;
  blobN = 0;
  const cfg = S.cfg;

  // troop movement
  if (keys.ArrowLeft || keys.a) S.targetCx = Math.max(-XMAX, S.targetCx - 14 * dt);
  if (keys.ArrowRight || keys.d) S.targetCx = Math.min(XMAX, S.targetCx + 14 * dt);
  if (S.bot) S.targetCx = botTarget(S.bot);
  else if (SNAP) S.targetCx = Math.sin(S.t * 0.4) * 3.5;
  // steering is instant: the whole troop moves with the finger, no easing
  const dcx = S.targetCx - S.cx;
  S.cx = S.targetCx;
  if (dcx !== 0) for (const s of S.troop) if (s.state !== 'dead') s.x += dcx;

  // rapid fire wears off
  if (S.rapid > 0) {
    S.rapid -= dt;
    if (S.rapid <= 0) { S.rapid = 0; for (const s of S.troop) retime(s); }
  }

  // ---- spawns
  if (S.phase === 'horde') {
    const p = Math.min(1, S.t / cfg.duration);
    S.hordeSpeed = cfg.hordeSpeed[0] + (cfg.hordeSpeed[1] - cfg.hordeSpeed[0]) * p;
    // scripted events of the level: rushes and enemy heroes
    for (const ev of S.timeline) {
      if (ev.done || p < ev.at) continue;
      ev.done = true;
      if (ev.type === 'rush') { S.rush = cfg.rush.time; showBanner('STORMLØB!', 'red'); }
      if (ev.type === 'caster') spawnCaster(ev.lane ?? (Math.random() < 0.5 ? LEFT : RIGHT));
    }
    // a new row enters every time the mass has advanced one row gap: the lane never empties behind it
    S.rowAcc += S.hordeSpeed * dt;
    while (S.rowAcc >= cfg.rowGap) {
      S.rowAcc -= cfg.rowGap;
      if (S.rush > 0) spawnRow(MID, SPAWN_Z - S.rowAcc, cfg.rush.width[0] + (cfg.rush.width[1] - cfg.rush.width[0]) * p, cfg.rush.speed);
      else spawnRow(MID, SPAWN_Z - S.rowAcc, hordeWidth(Math.pow(p, 1.3)));
    }
    if (S.rush > 0) S.rush -= dt;
    // Guldkriger: one marches in the mass every few seconds
    S.nextElite -= dt;
    if (S.nextElite <= 0 && S.t > 8) { S.nextElite = cfg.eliteEvery * (0.7 + Math.random() * 0.6); spawnEnemy(SPAWN_Z, { type: 'elite' }); }
    if (S.t >= cfg.duration) { S.phase = 'boss'; spawnBoss(); }
  } else if (S.phase === 'boss') {
    S.rowAcc += S.hordeSpeed * dt;
    while (S.rowAcc >= cfg.rowGap) { S.rowAcc -= cfg.rowGap; spawnRow(MID, SPAWN_Z - S.rowAcc, cfg.bossEscortWidth); }
  }
  if (playing) {
    for (const sd of S.side) {
      sd.next -= dt;
      if (sd.next <= 0) { const len = sideEvent(sd.lane, sd); sd.next = len / CONVEYOR + EVENTS.gap[0] + Math.random() * (EVENTS.gap[1] - EVENTS.gap[0]); }
    }
  }

  // ---- keep the drawn troop in step with the real number (new soldiers run in from the side)
  const wantVisible = Math.min(S.count, TROOP.visibleMax);
  for (let k = 0; k < 4 && visibleAlive < wantVisible && playing; k++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    spawnVisibleSoldier(S.cx + side * (troopRadius() + 1 + Math.random() * 2), TROOP_Z + 1.5 + Math.random() * 3, false);
  }

  // ---- targets & shooting
  buildTargets();
  const weight = visibleAlive > 0 ? S.count / visibleAlive : 1; // each drawn soldier fires for this many
  const dmg = TROOP.boltDamage * WEAPON[S.weapon].mul * Math.max(1, weight);
  bolts.setColor(WEAPON[S.weapon].bolt);
  let k = 0;
  for (const s of S.troop) {
    if (s.state === 'dead') {
      s.dying += dt;
      if (s.dying > 1.3) s.remove = true;
      soldiers.setTransform(s.i, s.x, 0, s.z, s.yaw, 1);
      continue;
    }
    const [ox, oz] = slot(k++);
    const sx = S.cx + ox, sz = TROOP_Z + oz;
    const dx = sx - s.x, dz = sz - s.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.02) {
      const m = Math.min(d, (s.state === 'run' ? 10 : 7) * dt * (d > 0.5 ? 1 : d / 0.5 + 0.3));
      s.x += dx / d * m; s.z += dz / d * m;
    }
    if (s.state === 'run' && d < 0.35) { s.state = 'shoot'; playShoot(s, Math.random()); } // random phase: no volleys
    else if (s.state === 'shoot' && d > 1.2) { s.state = 'run'; soldiers.play(s.i, 'Running_A', clock, 1.2, Math.random()); }
    const wantYaw = s.state === 'run' && d > 0.6 ? Math.atan2(dx, dz) : Math.PI;
    let dy = wantYaw - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.yaw += dy * Math.min(1, dt * 12);

    if (playing && s.state === 'shoot') {
      if (s.fs !== fireSpeed()) retime(s);
      // every soldier fires on every crossbow loop: at a target if one is in range, otherwise into the ground at max range
      const L = SHOOT_LEN / (s.sp * s.fs);
      const ph = (((clock - s.z0) / L) % 1 + 1) % 1;
      const prev = (((clock - dt - s.z0) / L) % 1 + 1) % 1;
      const crossed = prev <= ph ? prev < RELEASE && ph >= RELEASE : prev < RELEASE || ph >= RELEASE;
      if (crossed) shoot(s, dmg);
    } else if (S.phase === 'won' && s.state !== 'run' && s.state !== 'cheer') {
      s.state = 'cheer'; soldiers.play(s.i, 'Cheer', clock, 0.9 + Math.random() * 0.2, Math.random());
    }
    soldiers.setTransform(s.i, s.x, 0, s.z, s.yaw, 1);
    blob(s.x, s.z, 0.85);
  }
  if (S.troop.some((s) => s.remove)) {
    S.troop = S.troop.filter((s) => { if (s.remove) { soldiers.release(s.i); return false; } return true; });
  }

  // ---- enemies
  const front = TROOP_Z - troopRadius() * 0.72 - 0.3;
  for (const e of S.enemies) {
    e.t += dt;
    if (e.state === 'dead') {
      if (e.kb > 0) { e.z -= e.kb * dt; e.kb = Math.max(0, e.kb - dt * 6); }
      if (e.t > 1.6) e.y -= dt * 1.2;
      if (e.t > 2.6) e.remove = true;
      e.crowd.setTransform(e.i, e.x, e.y, e.z, 0, e.scale);
      if (e.flash > 0) { e.flash -= dt; e.crowd.flash(e.i, Math.max(0, e.flash) * 25); }
      continue;
    }
    e.z += e.speed * dt;
    let yaw = 0;
    if (e.z > LANE_END_Z) { // out of the lanes: charge the troop
      const tx = S.cx + THREE.MathUtils.clamp(e.x - S.cx, -troopRadius(), troopRadius());
      const ddx = tx - e.x;
      e.x += THREE.MathUtils.clamp(ddx, -6 * dt, 6 * dt);
      yaw = Math.atan2(ddx, 3) * 0.6;
      if (e.z > front && Math.abs(e.x - S.cx) < troopRadius() + 0.6) {
        loseTroops(ENEMY[e.type].cost, e.x, e.z, ENEMY[e.type].cost > 3);
        killEnemy(e, false);
        continue;
      }
      if (e.z > TROOP_Z + 7) { e.state = 'dead'; e.remove = true; }
    }
    if (e.flash > 0) { e.flash -= dt; e.crowd.flash(e.i, Math.max(0, e.flash) * 25); }
    e.crowd.setTransform(e.i, e.x, 0, e.z, yaw, e.scale);
    if (e.z > -60) blob(e.x, e.z, 0.85 * e.scale);
  }
  if (S.enemies.some((e) => e.remove)) {
    S.enemies = S.enemies.filter((e) => { if (e.remove) { e.crowd.release(e.i); return false; } return true; });
  }

  // ---- boss
  if (S.boss) {
    const b = S.boss;
    b.t += dt;
    if (b.state === 'dead') {
      if (b.t > 2.2) b.y -= dt * 1.5;
      if (b.t > 3.5) { bosses.release(b.i); S.boss = null; }
    } else if (b.state === 'walk') {
      b.z += b.speed * dt;
      if (b.z > LANE_END_Z) b.x += THREE.MathUtils.clamp(S.cx - b.x, -2.5 * dt, 2.5 * dt);
      if (b.z > front - 1.8) { b.state = 'attack'; b.atk = 0.55; bosses.play(b.i, '2H_Melee_Attack_Chop', clock, 1.1); }
    } else if (b.state === 'attack') {
      b.atk -= dt;
      b.x += THREE.MathUtils.clamp(S.cx - b.x, -2.5 * dt, 2.5 * dt);
      if (b.atk <= 0) {
        b.atk = 1.48;
        S.shake = Math.max(S.shake, 0.35);
        loseTroops(cfg.bossKillsPerSwing, b.x, b.z + 2);
        puff(b.x, 0.2, b.z + 2.2, 10, [0.7, 0.62, 0.5], 1.6);
      }
    }
    if (S.boss) {
      if (b.flash > 0) { b.flash -= dt; bosses.flash(b.i, Math.max(0, b.flash) * 12); }
      bosses.setTransform(b.i, b.x, b.y, b.z, 0, 3.0);
      if (b.state !== 'dead' || b.t < 2.5) blob(b.x, b.z, 3.2);
    }
  }

  // ---- heroes and their fireballs
  updateHeroes(dt, playing);
  updateCasters(dt, playing);
  updateHazards(dt, playing);
  updateFireballs(dt);

  // ---- pickups and walls ride the conveyor; walls hold back whatever is behind them in their lane
  updateConveyor(dt);

  // ---- end of level
  if (playing && S.count <= 0) { S.phase = 'lost'; S.endT = 0; }
  if (S.phase === 'lost' || S.phase === 'won') {
    S.endT += dt;
    if (S.endT >= 1.6 && S.endT - dt < 1.6 && !S.bot) showEnd();
  }

  soldiers.commit(); minions.commit(); warriors.commit(); bosses.commit(); heroes.commit(); statues.commit(); elites.commit(); casters.commit();
  blobs.count = blobN;
  blobs.instanceMatrix.needsUpdate = true;
  glow.update(dt); dust.update(dt); bolts.update(dt);
  updateHud(false);
}

function showEnd() {
  if (S.phase === 'won') {
    document.getElementById('winTitle').textContent = 'Bane ' + S.level + ' klaret!';
    document.getElementById('winTroop').textContent = S.count.toLocaleString('da-DK');
    document.getElementById('winGold').textContent = S.gold.toLocaleString('da-DK');
    document.getElementById('winKills').textContent = S.kills.toLocaleString('da-DK');
    winEl.classList.add('on');
  } else {
    document.getElementById('overProgress').textContent = Math.round(Math.min(1, S.t / S.cfg.duration) * 100) + ' %';
    document.getElementById('overGold').textContent = S.gold.toLocaleString('da-DK');
    document.getElementById('overKills').textContent = S.kills.toLocaleString('da-DK');
    document.getElementById('overTime').textContent = fmtTime(S.t);
    overEl.classList.add('on');
  }
}

const _labelQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.1, 0, 0));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _yAxis = new THREE.Vector3(0, 1, 0);
function updateConveyor(dt) {
  const exitZ = LANE_END_Z - 0.6;
  // walls first: they move unless something alive is right in front of them (keeps spacing)
  for (const w of S.walls) {
    if (!w.alive) continue;
    w.z += CONVEYOR * dt;
    if (w.z > exitZ) { w.alive = false; w.v.g.visible = false; wallPool.push(w.v); puff(w.x, 0.5, w.z, 8, [0.6, 0.58, 0.55], 1.6); continue; }
    if (w.flash > 0) w.flash -= dt;
    w.v.g.position.set(w.x + (w.flash > 0 ? (Math.random() - 0.5) * 0.08 : 0), 0.05, w.z);
    drawWallHp(w.v, w.hp);
  }
  S.walls = S.walls.filter((w) => w.alive);
  for (const kd of Object.values(kinds)) kd.n = 0;
  let chunkN = 0, tagN = 0;
  for (const it of S.items) {
    if (!it.alive) { it.pop += dt; continue; }
    // never pass through a standing wall in the same lane
    let limit = Infinity;
    for (const w of S.walls) if (w.lane === it.lane && w.z > it.z) limit = Math.min(limit, w.z - 1.6);
    it.z = Math.min(limit, it.z + CONVEYOR * dt);
    if (it.z > exitZ) { it.alive = false; it.pop = 1; if (it.statue >= 0 && it.statue !== undefined) { statues.release(it.statue); it.statue = -1; } puff(it.x, 0.4, it.z, 5, [0.6, 0.7, 0.9]); continue; }
    if (it.flash > 0) it.flash -= dt;
    if (it.kind === 'prisoner') {
      statues.setTransform(it.statue, it.x, 0.05, it.z, 0, 1.55);
      statues.flash(it.statue, it.flash > 0 ? 1.2 : 0);
      for (let c = PRISON_CHUNKS - it.chunksLeft; c < PRISON_CHUNKS; c++) {
        const L = CHUNK_LAYOUT[c];
        _p.set(it.x + L.x, L.y, it.z + L.z); _s.set(L.s, L.s * 1.15, L.s);
        _q.setFromAxisAngle(_yAxis, L.rot);
        _m.compose(_p, _q, _s);
        chunkMesh.setMatrixAt(chunkN++, _m);
      }
      _p.set(it.x, 2.75 + Math.sin(clock * 3) * 0.1, it.z); _s.set(1, 1, 1);
      _m.compose(_p, _labelQ, _s);
      heroTag.setMatrixAt(tagN++, _m);
      blob(it.x, it.z, 1.6);
      continue;
    }
    const kd = kinds[it.kind];
    if (kd.n >= kd.max) continue;
    const bump = it.flash > 0 ? 1.06 : 1;
    const bob = it.kind === 'plus1' || it.kind === 'plus5' || it.kind === 'plus99' ? 0 : Math.sin(clock * 3 + it.z) * 0.12;
    _p.set(it.x, kd.h / 2 + 0.1 + bob, it.z); _s.set(bump, bump, bump);
    _m.compose(_p, _q.identity(), _s);
    kd.body.setMatrixAt(kd.n, _m);
    const f = it.flash > 0 ? 2.6 : 1;
    kd.body.instanceColor.setXYZ(kd.n, f, f, f);
    _p.set(it.x, kd.h + 0.16 + bob, it.z + 0.1);
    _m.compose(_p, _labelQ, _s);
    kd.label.setMatrixAt(kd.n, _m);
    kd.n++;
  }
  chunkMesh.count = chunkN;
  heroTag.count = tagN;
  heroTag.instanceMatrix.needsUpdate = true;
  chunkMesh.instanceMatrix.needsUpdate = true;
  S.items = S.items.filter((it) => it.alive || it.pop < 0.5);
  for (const kd of Object.values(kinds)) {
    kd.body.count = kd.label.count = kd.n;
    kd.body.instanceMatrix.needsUpdate = kd.label.instanceMatrix.needsUpdate = true;
    kd.body.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- camera & loop
const troopLabelPos = new THREE.Vector3();
function updateCamera(dt) {
  S.shake = Math.max(0, S.shake - dt * 1.6);
  const sh = S.shake * S.shake * 0.5;
  // the camera follows the troop sideways so it never slides off the edge of a narrow phone screen
  camera.position.set(camBase.x + S.cx * 0.55 + (Math.random() - 0.5) * sh, camBase.y + (Math.random() - 0.5) * sh, camBase.z);
  camera.lookAt(camTarget.x + S.cx * 0.45, camTarget.y, camTarget.z);
  if (params.has('cam')) { const c = params.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); }
  camera.updateMatrixWorld();
  troopLabelPos.set(S.cx, 1.9, TROOP_Z - troopRadius() * 0.7 - 0.9).project(camera);
  troopEl.style.transform = `translate(${(troopLabelPos.x * 0.5 + 0.5) * window.innerWidth}px, ${(-troopLabelPos.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
}

resize();
startLevel(1, params.has('troop') ? +params.get('troop') : SNAP ? 60 : TROOP.start);
if (params.has('bot')) S.bot = params.get('bot'); // screenshots of a bot-played game
if (params.has('hz')) { addHazard(params.get('hz'), MID, -26); addHazard('barrel', LEFT, -34); }
if (params.has('spawn')) { S.side[1].deck.push(params.get('spawn')); S.side[1].next = 0; } // force a side-lane event (tests)
loadEl.classList.add('gone');

// adaptive quality: keep the picture sharp, only drop resolution when the phone really struggles
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function adapt(dt) {
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 2) {
    const fps = fpsN / fpsAcc;
    if (fps < 48 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); resize(); }
    else if (fps < 30 && sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    fpsAcc = fpsN = fpsT = 0;
  }
}

let last = performance.now();
const debug = document.getElementById('debug');
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  update(dt);
  updateCamera(dt);
  floaters.update(dt, window.innerWidth, window.innerHeight);
  composer.render();
  adapt(dt);
  if (params.has('debug')) debug.textContent = `${Math.round(1 / Math.max(dt, 1e-3))} fps · ${S.enemies.length} fjender · ${visibleAlive}/${S.count} soldater · ${renderer.info.render.calls} calls · pr ${pixelRatio}`;
  requestAnimationFrame(frame);
}
if (!SNAP) requestAnimationFrame(frame);

// test hooks: screenshots and balance simulation
window.__game = {
  get S() { return S; },
  step: (n) => { for (let i = 0; i < n; i++) { update(1 / 30); floaters.update(1 / 30, window.innerWidth, window.innerHeight); } updateCamera(1 / 30); composer.render(); return { count: S.count, visible: visibleAlive, phase: S.phase, weapon: S.weapon, enemies: S.enemies.length }; },
  // run a whole level with a bot at 30 steps/s without rendering; returns the outcome
  sim: (bot, level = 1, troop = TROOP.start, maxSeconds = 400) => {
    S.bot = bot;
    startLevel(level, troop);
    S.bot = bot;
    let peak = S.count;
    const trace = [];
    for (let i = 0; i < maxSeconds * 30 && S.phase !== 'won' && S.phase !== 'lost'; i++) {
      update(1 / 30);
      peak = Math.max(peak, S.count);
      S.stats.lane[laneOf(S.cx)]++;
      if (i % 300 === 0) trace.push(`${Math.round(S.t)}s:${S.count}/w${S.weapon}/h${S.heroList.length}/c${S.casterList.filter((c) => c.state !== "dead").length}/f${Math.round(TROOP_Z - S.enemies.reduce((m, e) => e.state === "run" && e.lane === MID ? Math.max(m, e.z) : m, -99))}`);
    }
    const out = { bot, level, result: S.phase, t: Math.round(S.t), troop: S.count, peak, weapon: S.weapon, kills: S.kills, ev: S.stats.ev, pop: S.stats.pop, lane: S.stats.lane.map((v) => Math.round(v / 30)), boss: S.boss ? Math.max(0, Math.round(S.boss.hp)) : null, trace: trace.join(' ') };
    S.bot = null;
    return out;
  },
};
