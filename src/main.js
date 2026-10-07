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
import { levelConfig, TROOP, WEAPON, EVENTS } from './levels.js';

const params = new URLSearchParams(location.search);
const SNAP = params.has('snap'); // deterministic mode for screenshots

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = params.has('pr') ? +params.get('pr') : Math.min(window.devicePixelRatio || 1, SNAP ? 1 : 2);
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
  const d = camBase.distanceTo(new THREE.Vector3(0, 0, TROOP_Z));
  const hfov = 2 * Math.atan((EDGE + 0.5) / d);
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180 / Math.PI;
  camera.fov = THREE.MathUtils.clamp(vfov, 40, 84);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- loading
const loader = new GLTFLoader();
const loadEl = document.getElementById('loading');
let loaded = 0;
const files = ['env.json', 'rogue.json', 'skeleton_minion.json', 'skeleton_warrior.json'];
function load(f) {
  return loader.loadAsync('assets/' + f).then((g) => {
    loaded++;
    loadEl.querySelector('.bar i').style.width = (loaded / files.length * 100) + '%';
    g.scene.traverse((o) => { if (o.isMesh && o.material.map) { o.material.map.anisotropy = MAX_ANISO; } });
    return g;
  });
}
const [envG, rogueG, minionG, warriorG] = await Promise.all(files.map(load));

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
  clips: [{ name: 'Running_A', loop: true }, { name: 'Walking_D_Skeletons', loop: true }, { name: 'Death_C_Skeletons', loop: false }, { name: '1H_Melee_Attack_Chop', loop: true }],
  part: (name) => (/Eyes/.test(name) ? { tint: [1.0, 0.15, 0.05], emissive: 5, useMap: false } : {}),
});
const warriorBaked = bakeCharacter(warriorG, {
  height: 1.45,
  clips: [{ name: 'Running_A', loop: true }, { name: 'Walking_D_Skeletons', loop: true }, { name: 'Death_C_Skeletons', loop: false }, { name: '2H_Melee_Attack_Chop', loop: true }, { name: 'Hit_A', loop: false }],
  part: (name) => (/Eyes/.test(name) ? { tint: [1.0, 0.15, 0.05], emissive: 6, useMap: false } : {}),
});
for (const b of [rogueBaked, minionBaked, warriorBaked]) if (b.map) b.map.anisotropy = MAX_ANISO;

// team colours: soldiers green cloth -> royal blue; skeleton cloaks (blue/purple) -> blood red
const blueMat = createVatMaterial(rogueBaked, { recolor: [0.22, 0.55, 0.61, 1.25], key: 'blue', roughness: 0.6 });
const redMinionMat = createVatMaterial(minionBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [0.9, 0.3, 0.24], key: 'red1' });
const redWarriorMat = createVatMaterial(warriorBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [0.78, 0.22, 0.18], key: 'red2' });

const soldiers = new Crowd(rogueBaked, TROOP.visibleMax + 40, blueMat);
const minions = new Crowd(minionBaked, 620, redMinionMat);
const warriors = new Crowd(warriorBaked, 180, redWarriorMat);
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
  plus1: { label: '+1', color: 0x2f7cf6, emissive: 0x0a3cff, stroke: '#0b2f8a', w: LANE_W - 1.4, h: 1.0 },
  plus5: { label: '+5', color: 0x1d5fe8, emissive: 0x0a3cff, stroke: '#0b2f8a', w: LANE_W - 1.4, h: 1.4 },
  plus99: { label: '+99', color: 0xf2a812, emissive: 0xb85a00, stroke: '#7a3a00', w: LANE_W - 1.4, h: 1.5 },
  weapon: { label: 'VÅBEN +', color: 0x9b3df5, emissive: 0x5a12c9, stroke: '#3b0a7a', w: LANE_W - 2.2, h: 1.8 },
  rapid: { label: '2× SKUD', color: 0xff7a1a, emissive: 0xc43c00, stroke: '#6a2200', w: LANE_W - 2.2, h: 1.5 },
  bomb: { label: 'BOMBE', color: 0xe0322b, emissive: 0x9a0c06, stroke: '#4a0503', w: LANE_W - 2.2, h: 1.5 },
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
  const label = new THREE.InstancedMesh(new THREE.PlaneGeometry(lw, lw * 0.375), new THREE.MeshBasicMaterial({ map: labelTexture(st.label, st.stroke), transparent: true, depthWrite: false }), max);
  body.castShadow = true;
  body.frustumCulled = label.frustumCulled = false;
  body.count = label.count = 0;
  scene.add(body, label);
  kinds[name] = { name, ...st, body, label, max };
}

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
  for (const w of S?.walls || []) { w.v.g.visible = false; wallPool.push(w.v); }
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
    weapon: 0, rapid: 0, stats: { ev: {}, pop: {}, lane: [0, 0, 0] }, nextHorde: 0.4, kills: 0, lost: 0, shake: 0, endT: 0, bot: S?.bot || null,
    // each side lane plays its own shuffled deck of events, so the two sides never mirror each other
    // a scripted opening (popped from the end) guarantees an early weapon chest and +5s, then the decks are random
    side: [{ lane: LEFT, deck: ['plus1', 'plus5'], next: 0 }, { lane: RIGHT, deck: ['plus1', 'weapon', 'plus5'], next: 0 }],
  };
  const vis = Math.min(S.count, TROOP.visibleMax);
  for (let k = 0; k < vis; k++) spawnVisibleSoldier(S.cx + (Math.random() - 0.5) * 2, TROOP_Z + (Math.random() - 0.5) * 2, true);
  // opening: a horde already on its way, +1 blocks in both side lanes
  for (let k = 0; k < 14; k++) spawnEnemy(-46 - Math.random() * 28);
  for (const lane of [LEFT, RIGHT]) for (let z = -16; z > -50; z -= 2.4) addItem('plus1', lane, z, cfg.plus1Hp);
  S.side[0].next = 6; S.side[1].next = 4;
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

/** Run the next event in a side lane. Returns its length in lane units (so the next one starts after it). */
function sideEvent(lane, deckState) {
  const cfg = S.cfg;
  if (!deckState.deck.length) deckState.deck = shuffled(EVENTS.deck);
  const ev = deckState.deck.pop();
  S.stats.ev[ev] = (S.stats.ev[ev] || 0) + 1;
  const z0 = SPAWN_Z;
  const prog = Math.min(1, S.t / cfg.duration);
  switch (ev) {
    case 'plus1': { const n = 8 + Math.floor(Math.random() * 7); for (let k = 0; k < n; k++) addItem('plus1', lane, z0 - k * 1.9, cfg.plus1Hp); return n * 1.9; }
    case 'plus5': { addItem('plus5', lane, z0, cfg.plus5Hp); addItem('plus5', lane, z0 - 3, cfg.plus5Hp); return 6; }
    case 'squad': { const n = Math.round(cfg.squadSize[0] + (cfg.squadSize[1] - cfg.squadSize[0]) * prog); for (let k = 0; k < n; k++) spawnEnemy(z0 - Math.random() * 6, { lane }); return 8; }
    case 'fort': { addWall(lane, z0, cfg.fortHp); addItem('plus99', lane, z0 - 2.4, cfg.plus99Hp); return 6; }
    case 'weapon': { if (S.weapon + S.items.filter((i) => i.alive && i.kind === 'weapon').length >= WEAPON.length - 1) return sideEvent(lane, deckState); addWall(lane, z0, cfg.weaponWallHp); addItem('weapon', lane, z0 - 2.6, cfg.weaponHp); return 6; }
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

function spawnEnemy(z, opts = {}) {
  const cfg = S.cfg;
  const prog = Math.min(1, S.t / cfg.duration);
  const warrior = opts.warrior ?? Math.random() < cfg.warriorShare * (1 + prog);
  const crowd = warrior ? warriors : minions;
  const i = crowd.alloc();
  if (i < 0) return;
  const lane = opts.lane ?? MID;
  const walk = !warrior && Math.random() < 0.2;
  const e = {
    crowd, i, lane, x: LANES[lane] + (Math.random() - 0.5) * (LANE_W - 1.2), z,
    hp: (warrior ? cfg.warriorHp : cfg.minionHp) * (1 + cfg.hpGrowth * prog), pending: 0,
    speed: cfg.enemySpeed * (warrior ? 0.85 : 1) * (walk ? 0.8 : 1) * (0.88 + Math.random() * 0.24),
    state: 'run', t: 0, flash: 0, warrior, y: 0,
  };
  crowd.play(i, walk ? 'Walking_D_Skeletons' : 'Running_A', clock, (walk ? 1.35 : 1.3) * (0.92 + Math.random() * 0.2), Math.random() * 2);
  S.enemies.push(e);
}

function spawnBoss() {
  const i = bosses.alloc();
  if (i < 0) return;
  const cfg = S.cfg;
  S.boss = { i, x: LANES[MID], z: SPAWN_Z - 2, hp: cfg.bossHp, max: cfg.bossHp, pending: 0, speed: cfg.bossSpeed, state: 'walk', flash: 0, atk: 0, y: 0, t: 0 };
  bosses.play(i, 'Walking_D_Skeletons', clock, 0.95);
  showBanner('BOSS', 'red');
  S.shake = 0.4;
}

// ---------------------------------------------------------------- input
const XMAX = EDGE - 1.2;
let dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); hideHint(); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  S.targetCx = THREE.MathUtils.clamp(S.targetCx + dx * (2.4 * EDGE / window.innerWidth), -XMAX, XMAX);
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
  for (const it of S.items) if (it.alive) laneTargets[it.lane].push(it);
  for (const w of S.walls) if (w.alive) laneTargets[w.lane].push(w);
  if (S.boss && S.boss.state !== 'dead') laneTargets[laneOf(S.boss.x)].push(S.boss);
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
  if (t.kind) return 0.8;
  return t.warrior ? 0.95 : 0.85;
}

function shoot(s, dmg) {
  const t = pickTarget(laneOf(s.x), s.z);
  if (!t) return false;
  t.pending += dmg;
  _from.set(s.x + 0.12, 0.85, s.z - 0.55);
  _to.set(t.x + (Math.random() - 0.5) * (t.wall ? 2.4 : t.kind ? 2.6 : t === S.boss ? 0.8 : 0.3), hitHeight(t), t.z + 0.2);
  const w = WEAPON[S.weapon];
  glow.emit(_from.x, _from.y, _from.z, 0, 0, 0, w.flash[0], w.flash[1], w.flash[2], 0.5, 0.06);
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
    const c = new THREE.Color(KIND_STYLE[t.kind].color);
    sparks(hx, hy + 0.2, hz + 0.45, c.r, c.g, c.b, 3);
    if (t.hp <= 0) popItem(t);
    return;
  }
  if (t.state !== 'run') return;
  t.hp -= dmg; t.flash = 0.09;
  sparks(hx, hy, hz, 1.0, 0.95, 0.85, 2);
  if (t.hp <= 0) killEnemy(t, true);
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
  e.crowd.play(e.i, 'Death_C_Skeletons', clock, 1.15);
  if (reward) { S.gold += e.warrior ? S.cfg.gold.warrior : S.cfg.gold.minion; S.kills++; }
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
    case 'rapid': {
      S.rapid = S.cfg.rapidTime;
      floaters.add('2× SKUD!', p, 'orange big', 1.4, 3);
      burst(it.x, 0.8, it.z, 40, [3.0, 1.4, 0.3], 9, 0.4);
      for (const s of S.troop) if (s.state === 'shoot') playShoot(s, RELEASE - 0.05);
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

// ---------------------------------------------------------------- bots (balance testing only)
const VALUE = { plus1: 1, plus5: 5, plus99: 99, weapon: 400, rapid: 60, bomb: 40 };
/** A greedy player: defends the lane with the most pressure, otherwise farms the lane with the best reward per health. */
function botTarget(style) {
  if (style === 'middle') return LANES[MID];
  const dps = Math.max(1, S.count * TROOP.boltDamage * WEAPON[S.weapon].mul * 0.94);
  // threat: health of enemies close to the troop, per lane (+ anything already in the courtyard)
  const threat = [0, 0, 0], reward = [0, 0, 0], cost = [1, 1, 1];
  for (const e of S.enemies) if (e.state === 'run' && e.z > TROOP_Z - 22) threat[laneOf(e.x)] += e.hp * (e.z > LANE_END_Z - 4 ? 2 : 1);
  if (S.boss && S.boss.state !== 'dead' && S.boss.z > TROOP_Z - 30) threat[laneOf(S.boss.x)] += S.boss.hp;
  for (const it of S.items) if (it.alive && it.z > TROOP_Z - TROOP.range) { reward[it.lane] += VALUE[it.kind]; cost[it.lane] += it.hp; }
  for (const w of S.walls) if (w.alive && w.z > TROOP_Z - TROOP.range) cost[w.lane] += w.hp;
  const worst = threat.indexOf(Math.max(...threat));
  if (threat[worst] > dps * 1.6) return LANES[worst];
  let bestL = worst, bestV = 0;
  for (const L of [LEFT, MID, RIGHT]) {
    const v = reward[L] / (cost[L] / dps + 2);
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
  S.cx += (S.targetCx - S.cx) * Math.min(1, dt * 10);

  // rapid fire wears off
  if (S.rapid > 0) {
    S.rapid -= dt;
    if (S.rapid <= 0) { S.rapid = 0; for (const s of S.troop) if (s.state === 'shoot') playShoot(s, RELEASE - 0.05); }
  }

  // ---- spawns
  if (S.phase === 'horde') {
    const p = Math.min(1, S.t / cfg.duration);
    const rate = cfg.spawnStart + (cfg.spawnEnd - cfg.spawnStart) * Math.pow(p, 1.5);
    S.nextHorde -= dt;
    if (S.nextHorde <= 0) {
      const big = p > 0.15 && Math.random() < cfg.burstChance;
      const n = big ? cfg.burst[0] + Math.floor(Math.random() * (cfg.burst[1] - cfg.burst[0])) : 1;
      for (let k = 0; k < n; k++) spawnEnemy(SPAWN_Z - Math.random() * (big ? 8 : 0.5));
      S.nextHorde = big ? n / rate * 0.7 : 1 / rate;
    }
    if (S.t >= cfg.duration) { S.phase = 'boss'; spawnBoss(); }
  } else if (S.phase === 'boss') {
    S.nextHorde -= dt;
    if (S.nextHorde <= 0) { spawnEnemy(SPAWN_Z - Math.random()); S.nextHorde = 1 / cfg.bossEscortRate; }
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
    if (s.state === 'run' && d < 0.35) { s.state = 'aim'; soldiers.play(s.i, '2H_Ranged_Aiming', clock, 1, Math.random()); }
    else if (s.state !== 'run' && s.state !== 'cheer' && d > 1.2) { s.state = 'run'; soldiers.play(s.i, 'Running_A', clock, 1.2, Math.random()); }
    const wantYaw = s.state === 'run' && d > 0.6 ? Math.atan2(dx, dz) : Math.PI;
    let dy = wantYaw - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.yaw += dy * Math.min(1, dt * 12);

    if (playing && s.state !== 'run') {
      const hasTarget = !!pickTarget(laneOf(s.x), s.z);
      if (s.state === 'aim' && hasTarget) { s.state = 'shoot'; playShoot(s, RELEASE - 0.04 - Math.random() * 0.15); }
      if (s.state === 'shoot') {
        // fire exactly when the crossbow animation releases
        const L = SHOOT_LEN / (s.sp * s.fs);
        const ph = (((clock - s.z0) / L) % 1 + 1) % 1;
        const prev = (((clock - dt - s.z0) / L) % 1 + 1) % 1;
        const crossed = prev <= ph ? prev < RELEASE && ph >= RELEASE : prev < RELEASE || ph >= RELEASE;
        if (crossed) shoot(s, dmg);
        if (!hasTarget) s.idle += dt; else s.idle = 0;
        if (s.idle > 0.6) { s.state = 'aim'; s.idle = 0; soldiers.play(s.i, '2H_Ranged_Aiming', clock, 1, Math.random()); }
      }
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
      if (e.t > 1.6) e.y -= dt * 1.2;
      if (e.t > 2.6) e.remove = true;
      e.crowd.setTransform(e.i, e.x, e.y, e.z, 0, 1);
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
        loseTroops(e.warrior ? cfg.warriorCost : cfg.minionCost, e.x, e.z, false);
        killEnemy(e, false);
        continue;
      }
      if (e.z > TROOP_Z + 7) { e.state = 'dead'; e.remove = true; }
    }
    if (e.flash > 0) { e.flash -= dt; e.crowd.flash(e.i, Math.max(0, e.flash) * 25); }
    e.crowd.setTransform(e.i, e.x, 0, e.z, yaw, 1);
    if (e.z > -60) blob(e.x, e.z, 0.85);
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

  // ---- pickups and walls ride the conveyor; walls hold back whatever is behind them in their lane
  updateConveyor(dt);

  // ---- end of level
  if (playing && S.count <= 0) { S.phase = 'lost'; S.endT = 0; }
  if (S.phase === 'lost' || S.phase === 'won') {
    S.endT += dt;
    if (S.endT >= 1.6 && S.endT - dt < 1.6 && !S.bot) showEnd();
  }

  soldiers.commit(); minions.commit(); warriors.commit(); bosses.commit();
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
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
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
  for (const it of S.items) {
    if (!it.alive) { it.pop += dt; continue; }
    // never pass through a standing wall in the same lane
    let limit = Infinity;
    for (const w of S.walls) if (w.lane === it.lane && w.z > it.z) limit = Math.min(limit, w.z - 1.6);
    it.z = Math.min(limit, it.z + CONVEYOR * dt);
    if (it.z > exitZ) { it.alive = false; it.pop = 1; puff(it.x, 0.4, it.z, 5, [0.6, 0.7, 0.9]); continue; }
    if (it.flash > 0) it.flash -= dt;
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
  camera.position.set(camBase.x + S.cx * 0.5 + (Math.random() - 0.5) * sh, camBase.y + (Math.random() - 0.5) * sh, camBase.z);
  camera.lookAt(camTarget.x + S.cx * 0.4, camTarget.y, camTarget.z);
  if (params.has('cam')) { const c = params.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); }
  camera.updateMatrixWorld();
  troopLabelPos.set(S.cx, 1.9, TROOP_Z - troopRadius() * 0.7 - 0.9).project(camera);
  troopEl.style.transform = `translate(${(troopLabelPos.x * 0.5 + 0.5) * window.innerWidth}px, ${(-troopLabelPos.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
}

resize();
startLevel(1, params.has('troop') ? +params.get('troop') : SNAP ? 60 : TROOP.start);
if (params.has('bot')) S.bot = params.get('bot'); // screenshots of a bot-played game
loadEl.classList.add('gone');

// adaptive quality: keep the picture sharp, only drop resolution when the phone really struggles
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function adapt(dt) {
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 3) {
    const fps = fpsN / fpsAcc;
    if (fps < 38 && pixelRatio > 1.25) { pixelRatio = Math.max(1.25, pixelRatio - 0.25); resize(); }
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
  step: (n) => { for (let i = 0; i < n; i++) { update(1 / 30); floaters.update(1 / 30, window.innerWidth, window.innerHeight); } updateCamera(1 / 30); composer.render(); return { count: S.count, visible: visibleAlive, phase: S.phase, weapon: S.weapon }; },
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
      if (i % 300 === 0) trace.push(`${Math.round(S.t)}s:${S.count}/w${S.weapon}`);
    }
    const out = { bot, level, result: S.phase, t: Math.round(S.t), troop: S.count, peak, weapon: S.weapon, kills: S.kills, ev: S.stats.ev, pop: S.stats.pop, lane: S.stats.lane.map((v) => Math.round(v / 30)), boss: S.boss ? Math.max(0, Math.round(S.boss.hp)) : null, trace: trace.join(' ') };
    S.bot = null;
    return out;
  },
};
