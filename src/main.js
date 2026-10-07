import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bakeCharacter, createVatMaterial, Crowd, setVatTime } from './vat.js';
import { buildWorld, makeSky, LANES, LANE_W, LANE_END_Z } from './world.js';
import { Particles, Bolts, Floaters, RADIAL } from './fx.js';
import { levelConfig, TROOP } from './levels.js';

const params = new URLSearchParams(location.search);
const SNAP = params.has('snap'); // deterministic mode for screenshots

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = params.has('pr') ? +params.get('pr') : Math.min(window.devicePixelRatio || 1, SNAP ? 1 : 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = true; // units are animated, so shadows re-render every frame

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb9c9d8, 70, 185);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 900);
const camBase = new THREE.Vector3(0, 13.5, 12.5);
const camTarget = new THREE.Vector3(0, 0, -19);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x7a6a52, 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b5, 3.6);
// low side light from the left so every unit throws a visible shadow across the ground toward the right
sun.position.set(-34, 26, -6);
sun.target.position.set(0, 0, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -44, right: 34, top: 18, bottom: -18, near: 1, far: 110 });
sun.shadow.camera.updateProjectionMatrix(); // without this the bounds above are ignored
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// post-processing
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hud = document.getElementById('hud');
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
  // keep ~19 world units visible across the troop area, whatever the screen shape
  const d = camBase.distanceTo(new THREE.Vector3(0, 0, 1));
  const hfov = 2 * Math.atan(8.6 / d);
  let vfov = 2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180 / Math.PI;
  camera.fov = THREE.MathUtils.clamp(vfov, 42, 82);
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
    return g;
  });
}
const [envG, rogueG, minionG, warriorG] = await Promise.all(files.map(load));

try { await Promise.race([document.fonts.load('80px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* fall back to system font */ }
const world = buildWorld(scene, envG);
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

// team colours: soldiers green cloth -> royal blue; skeleton cloaks (blue/purple) -> blood red
const blueMat = createVatMaterial(rogueBaked, { recolor: [0.22, 0.55, 0.61, 1.25], key: 'blue', roughness: 0.6 });
const redMinionMat = createVatMaterial(minionBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [0.9, 0.3, 0.24], key: 'red1' });
const redWarriorMat = createVatMaterial(warriorBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [0.78, 0.22, 0.18], key: 'red2' });

const soldiers = new Crowd(rogueBaked, TROOP.visibleMax + 40, blueMat);
const minions = new Crowd(minionBaked, 520, redMinionMat);
const warriors = new Crowd(warriorBaked, 140, redWarriorMat);
const bosses = new Crowd(warriorBaked, 2, createVatMaterial(warriorBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [1.0, 0.5, 0.42], key: 'boss', roughness: 0.55 }));
scene.add(soldiers.mesh, minions.mesh, warriors.mesh, bosses.mesh);

// blob shadows (cheap soft contact shadows under every unit)
const blobTex = RADIAL;
const blobs = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  1200
);
blobs.frustumCulled = false;
blobs.renderOrder = 1;
scene.add(blobs);
let blobN = 0;
const _bm = new THREE.Matrix4();
function blob(x, z, s) {
  if (blobN >= 1200) return;
  _bm.makeScale(s, 1, s); _bm.setPosition(x, 0.09, z);
  blobs.setMatrixAt(blobN++, _bm);
}

// effects
const glow = new Particles(1600, true);
const dust = new Particles(900, false);
const bolts = new Bolts(700);
scene.add(glow.points, dust.points, bolts.mesh);

// ---------------------------------------------------------------- blocks (+1 / +99) and the wall
function labelTexture(text, bg, fg = '#fff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = '92px "Lilita One", "Arial Black", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 18; g.strokeStyle = bg; g.lineJoin = 'round';
  g.strokeText(text, 128, 68);
  g.lineWidth = 8; g.strokeText(text, 128, 70);
  g.fillStyle = fg;
  g.fillText(text, 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function blockKind(color, emissive, text, stroke, max) {
  const body = new THREE.InstancedMesh(
    new RoundedBoxGeometry(3.0, 1.05, 0.85, 3, 0.16),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.35, roughness: 0.35, metalness: 0.15 }),
    max
  );
  body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  const label = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshBasicMaterial({ map: labelTexture(text, stroke), transparent: true, depthWrite: false }),
    max
  );
  body.castShadow = true;
  body.frustumCulled = label.frustumCulled = false;
  body.count = label.count = 0;
  scene.add(body, label);
  return { body, label, list: [], text };
}
const plus1 = blockKind(0x2f7cf6, 0x0a3cff, '+1', '#0b2f8a', 80);
const plus99 = blockKind(0xf2a812, 0xb85a00, '+99', '#7a3a00', 40);

// wall in the right lane
const wallGroup = new THREE.Group();
{
  const lib = {};
  envG.scene.traverse((o) => { if (o.parent === envG.scene) lib[o.name] = o; });
  const w = lib.wall_cracked.clone();
  w.scale.set(0.97, 0.8, 1.2);
  w.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  wallGroup.add(w);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(3.1, 1.35, 0.3, 2, 0.1), new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.45, metalness: 0.7 }));
  plate.position.set(0, 1.75, 0.8);
  wallGroup.add(plate);
}
const wallCanvas = document.createElement('canvas');
wallCanvas.width = 256; wallCanvas.height = 110;
const wallTex = new THREE.CanvasTexture(wallCanvas);
wallTex.colorSpace = THREE.SRGBColorSpace;
const wallLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.25), new THREE.MeshBasicMaterial({ map: wallTex, transparent: true }));
wallLabel.position.set(0, 1.75, 0.97);
wallGroup.add(wallLabel);
scene.add(wallGroup);
function drawWallHp(hp) {
  const g = wallCanvas.getContext('2d');
  g.clearRect(0, 0, 256, 110);
  g.font = '80px "Lilita One", "Arial Black", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText(String(Math.max(0, Math.ceil(hp))), 128, 60);
  wallTex.needsUpdate = true;
}


// ---------------------------------------------------------------- game state
const RIGHT = 2, MID = 1, LEFT = 0;
const WALL_Z = -15;
const TROOP_Z = 0.9;
const SPAWN_Z = -74;
const SHOOT_LEN = rogueBaked.clips['2H_Ranged_Shooting'].duration; // one bolt per loop
const RELEASE = 0.14; // point in the shooting loop where the bolt leaves the crossbow
let clock = 0; // global animation clock (never resets)
let S;

function clearEntities() {
  for (const s of S?.troop || []) soldiers.release(s.i);
  for (const e of S?.enemies || []) e.crowd.release(e.i);
  if (S?.boss) bosses.release(S.boss.i);
  plus1.list.length = 0; plus99.list.length = 0;
  bolts.list.length = 0;
}

function startLevel(n, troopCount) {
  clearEntities();
  visibleAlive = 0;
  const cfg = levelConfig(n);
  S = {
    level: n, cfg, t: 0, phase: 'horde', gold: S?.gold || 0, home: S?.home || 0, cx: 0, targetCx: 0,
    count: troopCount, startCount: troopCount, troop: [], enemies: [], boss: null,
    nextHorde: 0.4, nextBlock: 0, kills: 0, lost: 0, shake: 0, endT: 0, bot: S?.bot || null,
    wall: { hp: cfg.wallHp, max: cfg.wallHp, alive: true, z: WALL_Z, x: LANES[RIGHT], pending: 0, flash: 0 },
  };
  wallGroup.visible = true;
  wallGroup.position.set(LANES[RIGHT], 0.05, WALL_Z);
  drawWallHp(cfg.wallHp);
  for (let k = 0; k < cfg.plus99Count; k++) plus99.list.push(newBlock(plus99, RIGHT, WALL_Z - 2.2 - k * 2.0, cfg.plus99Hp));
  for (let z = -12; z > -76; z -= 2.6) plus1.list.push(newBlock(plus1, LEFT, z, cfg.plus1Hp));
  const vis = Math.min(S.count, TROOP.visibleMax);
  for (let k = 0; k < vis; k++) spawnVisibleSoldier(S.cx + (Math.random() - 0.5) * 2, TROOP_Z + (Math.random() - 0.5) * 2, true);
  for (let k = 0; k < 30; k++) spawnEnemy(-40 - Math.random() * 34);
  levelLabel.textContent = 'BANE ' + n;
  overEl.classList.remove('on'); winEl.classList.remove('on');
  showBanner('BANE ' + n, 'blue');
  updateHud(true);
}

function newBlock(kind, lane, z, hp) { return { lane, x: LANES[lane], z, y: 0.6, hp, max: hp, pending: 0, flash: 0, kind, alive: true, pop: 0 }; }

// formation slot (sunflower packing => round, dense clump that grows wider with size)
function slot(k) {
  const r = 0.46 * Math.sqrt(k + 0.6);
  const a = k * 2.399963;
  return [Math.cos(a) * r, Math.sin(a) * r * 0.78];
}
let visibleAlive = 0;
function troopRadius() { return 0.46 * Math.sqrt(Math.max(1, visibleAlive) + 0.6); }

function spawnVisibleSoldier(x, z, instant) {
  const i = soldiers.alloc();
  if (i < 0) return false;
  const s = { i, x, z, state: instant ? 'shoot' : 'run', dying: 0, yaw: Math.PI, sp: 0.95 + Math.random() * 0.13, z0: 0, idle: 0 };
  if (instant) playShoot(s, Math.random());
  else soldiers.play(i, 'Running_A', clock, 1.2, Math.random());
  S.troop.push(s);
  visibleAlive++;
  return true;
}
function playShoot(s, phase) {
  s.z0 = clock - phase * SHOOT_LEN / s.sp;
  soldiers.play(s.i, '2H_Ranged_Shooting', clock, s.sp, phase * SHOOT_LEN / s.sp);
}

/** Gain soldiers (any number; only up to visibleMax are drawn). */
function gainTroops(n) { S.count += n; }

/** Lose soldiers near (x,z); a visible soldier always falls so the hit reads on screen. */
function loseTroops(n, x, z, label = true) {
  n = Math.min(n, S.count);
  if (n <= 0) return;
  S.count -= n; S.lost += n;
  if (label) floaters.add('-' + n, { x, y: 1.4, z: z - 0.5 }, 'red', 0.7, 1.2);
  const fall = Math.min(n, 8);
  for (let k = 0; k < fall; k++) { const s = nearestSoldier(x, z); if (s) killSoldier(s); }
  // never show more soldiers than the troop has
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
  const walk = !warrior && Math.random() < 0.25;
  const e = {
    crowd, i, lane, x: LANES[lane] + (Math.random() - 0.5) * (LANE_W - 0.9), z,
    hp: (warrior ? cfg.warriorHp : cfg.minionHp) * (1 + cfg.hpGrowth * prog), pending: 0,
    speed: cfg.enemySpeed * (warrior ? 0.85 : 1) * (walk ? 0.8 : 1) * (0.88 + Math.random() * 0.24),
    state: 'run', t: 0, flash: 0, warrior, y: 0,
  };
  crowd.play(i, walk ? 'Walking_D_Skeletons' : 'Running_A', clock, (walk ? 1.25 : 1.15) * (0.92 + Math.random() * 0.2), Math.random() * 2);
  S.enemies.push(e);
}

function spawnBoss() {
  const i = bosses.alloc();
  if (i < 0) return;
  const cfg = S.cfg;
  S.boss = { i, x: LANES[MID], z: SPAWN_Z - 2, hp: cfg.bossHp, max: cfg.bossHp, pending: 0, speed: cfg.bossSpeed, state: 'walk', flash: 0, atk: 0, y: 0, t: 0 };
  bosses.play(i, 'Walking_D_Skeletons', clock, 0.85);
  showBanner('BOSS', 'red');
  S.shake = 0.4;
}

// ---------------------------------------------------------------- input
let dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); hideHint(); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  S.targetCx = THREE.MathUtils.clamp(S.targetCx + dx * (19 / window.innerWidth), -6.2, 6.2);
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key] = true; hideHint(); });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// ---------------------------------------------------------------- HUD
const goldEl = document.getElementById('gold');
const troopEl = document.getElementById('troop');
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
  progFill.style.width = (Math.min(1, S.t / S.cfg.duration) * 100).toFixed(1) + '%';
  progEl.classList.toggle('boss', S.phase !== 'horde');
  if (S.boss && S.boss.state !== 'dead') { bossBar.classList.add('on'); bossFill.style.width = Math.max(0, S.boss.hp / S.boss.max * 100) + '%'; }
  else bossBar.classList.remove('on');
}
function showBanner(text, cls) { banner.className = cls || ''; banner.textContent = text; void banner.offsetWidth; banner.classList.add('show'); }
function fmtTime(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
document.getElementById('again').addEventListener('click', () => startLevel(S.level, S.startCount));
const startTroop = (n) => TROOP.start + (n - 1) * TROOP.startPerLevel;
document.getElementById('next').addEventListener('click', () => { S.home = (S.home || 0) + S.count; startLevel(S.level + 1, startTroop(S.level + 1)); });

// ---------------------------------------------------------------- shooting
const laneTargets = [[], [], []];
function laneOf(x) { return x < -LANE_W / 2 ? LEFT : x > LANE_W / 2 ? RIGHT : MID; }
const _from = new THREE.Vector3(), _to = new THREE.Vector3();

function buildTargets() {
  for (const L of laneTargets) L.length = 0;
  for (const e of S.enemies) if (e.state === 'run') laneTargets[laneOf(e.x)].push(e);
  for (const b of plus1.list) if (b.alive) laneTargets[b.lane].push(b);
  if (S.wall.alive) laneTargets[RIGHT].push(S.wall);
  else for (const b of plus99.list) if (b.alive) laneTargets[b.lane].push(b);
  if (S.boss && S.boss.state !== 'dead') laneTargets[laneOf(S.boss.x)].push(S.boss);
  for (const L of laneTargets) L.sort((a, b) => b.z - a.z);
}

// nearest target in the lane that still needs damage; if everything is already covered, the nearest one anyway
function pickTarget(lane, fromZ) {
  const L = laneTargets[lane];
  let fallback = null;
  for (let k = 0; k < L.length; k++) {
    const t = L[k];
    if (t.z > fromZ - 0.6 || t.z < SPAWN_Z + 2) continue;
    if (t.hp - t.pending > 0) return t;
    if (!fallback) fallback = t;
  }
  return fallback;
}

function hitHeight(t) {
  if (t === S.wall) return 1.6;
  if (t === S.boss) return 2.6;
  if (t.kind) return 0.7;
  return t.warrior ? 0.95 : 0.85;
}

function shoot(s, dmg) {
  const t = pickTarget(laneOf(s.x), s.z);
  if (!t) return false;
  t.pending += dmg;
  _from.set(s.x + 0.12, 0.85, s.z - 0.55);
  _to.set(t.x + (Math.random() - 0.5) * (t === S.wall ? 1.8 : t.kind ? 2.2 : t === S.boss ? 0.8 : 0.3), hitHeight(t), t.z + 0.2);
  glow.emit(_from.x, _from.y, _from.z, 0, 0, 0, 2.6, 1.9, 0.9, 0.5, 0.06);
  const hx = _to.x, hy = _to.y, hz = _to.z;
  bolts.fire(_from, _to, 75, () => { t.pending -= dmg; damage(t, dmg, hx, hy, hz); });
  return true;
}

function damage(t, dmg, hx, hy, hz) {
  if (S.phase === 'lost') return;
  if (t === S.wall) {
    if (!S.wall.alive) return;
    S.wall.hp -= dmg; S.wall.flash = 0.08;
    sparks(hx, hy, hz + 0.5, 0.9, 0.8, 0.7, 2);
    if (S.wall.hp <= 0) breakWall();
    return;
  }
  if (t === S.boss) {
    if (!S.boss || S.boss.state === 'dead') return;
    S.boss.hp -= dmg; S.boss.flash = 0.07;
    sparks(hx, hy, hz + 0.3, 1.0, 0.9, 0.8, 2);
    if (S.boss.hp <= 0) killBoss();
    return;
  }
  if (t.kind) { // block
    if (!t.alive) return;
    t.hp -= dmg; t.flash = 0.08;
    const blue = t.kind === plus1;
    sparks(hx, hy + 0.2, hz + 0.45, blue ? 0.5 : 1.0, blue ? 0.75 : 0.8, blue ? 1.6 : 0.3, 3);
    if (t.hp <= 0) popBlock(t);
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

function killEnemy(e, reward) {
  e.state = 'dead'; e.t = 0;
  e.crowd.play(e.i, 'Death_C_Skeletons', clock, 1.15);
  if (reward) { S.gold += e.warrior ? S.cfg.gold.warrior : S.cfg.gold.minion; S.kills++; }
  if (Math.random() < 0.5) puff(e.x, 0.3, e.z, 1, [0.55, 0.5, 0.46], 0.8);
}

function popBlock(b) {
  b.alive = false;
  const isBig = b.kind === plus99;
  const n = isBig ? 99 : 1;
  floaters.add('+' + n, { x: b.x, y: 1.6, z: b.z }, isBig ? 'gold big' : 'blue', 1.0, 2.6);
  for (let k = 0; k < (isBig ? 40 : 14); k++) {
    glow.emit(b.x + (Math.random() - 0.5) * 2.6, 0.6 + Math.random() * 0.6, b.z, (Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 6,
      isBig ? 2.4 : 0.5, isBig ? 1.6 : 1.0, isBig ? 0.2 : 2.6, 0.35, 0.5 + Math.random() * 0.4, 14);
  }
  gainTroops(n);
  if (isBig) S.shake = Math.max(S.shake, 0.25);
}

function breakWall() {
  S.wall.alive = false;
  wallGroup.visible = false;
  S.shake = 0.6;
  for (let k = 0; k < 40; k++) puff(LANES[RIGHT] + (Math.random() - 0.5) * 3.5, Math.random() * 2, WALL_Z, 1, [0.6, 0.58, 0.55], 1.8);
  for (let k = 0; k < 60; k++) glow.emit(LANES[RIGHT] + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, WALL_Z, (Math.random() - 0.5) * 12, 3 + Math.random() * 8, Math.random() * 8, 2.4, 1.4, 0.5, 0.3, 0.7, 14);
  floaters.add('MUREN ER NEDE!', { x: LANES[RIGHT], y: 3, z: WALL_Z }, 'gold', 1.4, 2);
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
  // the horde collapses with its king
  for (const e of S.enemies) if (e.state === 'run') { killEnemy(e, true); }
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

// ---------------------------------------------------------------- simple bots (balance testing only)
// greedy: grab +1 while the middle is quiet, go for the wall once the troop passes wallAt, defend when the horde is close
function smartBot(wallAt) {
  let near = 0;
  for (const e of S.enemies) if (e.state === 'run' && e.z > -24) near += e.warrior ? 3 : 1;
  if (S.phase !== 'horde') return 0;
  if (near > S.count * 0.25 + 3) return 0;
  if (S.count > wallAt && (S.wall.alive || plus99.list.some((b) => b.alive))) return 3.2;
  return -3.2;
}
const BOTS = {
  middle: () => 0,
  left: () => -4,
  // greedy: grab +1 while the middle is quiet, break the wall when strong, defend when the horde is close
  smart: () => smartBot(60),
  smart40: () => smartBot(40),
  smart25: () => smartBot(25),
};

// ---------------------------------------------------------------- update
function update(dt) {
  clock += dt;
  setVatTime(clock);
  if (S.phase === 'horde' || S.phase === 'boss') S.t += dt;
  blobN = 0;
  const cfg = S.cfg;
  const playing = S.phase === 'horde' || S.phase === 'boss';

  // troop movement
  if (keys.ArrowLeft || keys.a) S.targetCx = Math.max(-6.2, S.targetCx - 12 * dt);
  if (keys.ArrowRight || keys.d) S.targetCx = Math.min(6.2, S.targetCx + 12 * dt);
  if (S.bot) S.targetCx = BOTS[S.bot]();
  else if (SNAP) S.targetCx = Math.sin(S.t * 0.4) * 2.5;
  S.cx += (S.targetCx - S.cx) * Math.min(1, dt * 10);

  // ---- spawns
  if (S.phase === 'horde') {
    const p = Math.min(1, S.t / cfg.duration);
    const rate = cfg.spawnStart + (cfg.spawnEnd - cfg.spawnStart) * p;
    S.nextHorde -= dt;
    if (S.nextHorde <= 0) {
      const burst = Math.random() < cfg.burstChance ? 20 + Math.floor(Math.random() * 26) : 1;
      for (let k = 0; k < burst; k++) spawnEnemy(SPAWN_Z - Math.random() * (burst > 1 ? 7 : 0.5));
      S.nextHorde = burst > 1 ? burst / rate * 0.7 : 1 / rate;
    }
    S.nextBlock -= dt;
    if (S.nextBlock <= 0) { plus1.list.push(newBlock(plus1, LEFT, -76, cfg.plus1Hp)); S.nextBlock = cfg.plus1Interval; }
    if (S.t >= cfg.duration) { S.phase = 'boss'; spawnBoss(); }
  } else if (S.phase === 'boss') {
    S.nextBlock -= dt; // +1 blocks keep coming: grow the troop or hit the boss?
    if (S.nextBlock <= 0) { plus1.list.push(newBlock(plus1, LEFT, -76, cfg.plus1Hp)); S.nextBlock = cfg.plus1Interval; }
    S.nextHorde -= dt;
    if (S.nextHorde <= 0) { spawnEnemy(SPAWN_Z - Math.random()); S.nextHorde = 1 / cfg.bossEscortRate; }
  }

  // ---- keep the drawn troop in step with the real number (new soldiers run in from the side)
  const wantVisible = Math.min(S.count, TROOP.visibleMax);
  for (let k = 0; k < 4 && visibleAlive < wantVisible && playing; k++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    spawnVisibleSoldier(S.cx + side * (troopRadius() + 1 + Math.random() * 2), TROOP_Z - 1.5 - Math.random() * 3, false);
  }

  // ---- targets & shooting
  buildTargets();
  const weight = visibleAlive > 0 ? S.count / visibleAlive : 1; // each drawn soldier fires for this many
  const dmg = TROOP.boltDamage * Math.max(1, weight);
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
      const m = Math.min(d, (s.state === 'run' ? 9 : 6) * dt * (d > 0.5 ? 1 : d / 0.5 + 0.3));
      s.x += dx / d * m; s.z += dz / d * m;
    }
    if (s.state === 'run' && d < 0.35) { s.state = 'aim'; soldiers.play(s.i, '2H_Ranged_Aiming', clock, 1, Math.random()); }
    else if (s.state !== 'run' && d > 1.2) { s.state = 'run'; soldiers.play(s.i, 'Running_A', clock, 1.2, Math.random()); }
    const wantYaw = s.state === 'run' && d > 0.6 ? Math.atan2(dx, dz) : Math.PI;
    let dy = wantYaw - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.yaw += dy * Math.min(1, dt * 12);

    if (playing && s.state !== 'run') {
      const hasTarget = !!pickTarget(laneOf(s.x), s.z);
      if (s.state === 'aim' && hasTarget) { s.state = 'shoot'; playShoot(s, RELEASE - 0.04 - Math.random() * 0.15); }
      if (s.state === 'shoot') {
        // fire exactly when the crossbow animation releases
        const L = SHOOT_LEN / s.sp;
        const ph = (((clock - s.z0) / L) % 1 + 1) % 1;
        const prev = (((clock - dt - s.z0) / L) % 1 + 1) % 1;
        const crossed = prev <= ph ? prev < RELEASE && ph >= RELEASE : prev < RELEASE || ph >= RELEASE;
        if (crossed) { if (!shoot(s, dmg)) s.idle += L; else s.idle = 0; }
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
  const front = TROOP_Z - troopRadius() * 0.8 - 0.3;
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
      e.x += THREE.MathUtils.clamp(ddx, -5 * dt, 5 * dt);
      yaw = Math.atan2(ddx, 3) * 0.6;
      if (e.z > front && Math.abs(e.x - S.cx) < troopRadius() + 0.6) {
        loseTroops(e.warrior ? cfg.warriorCost : cfg.minionCost, e.x, e.z, false);
        killEnemy(e, false);
        continue;
      }
      if (e.z > TROOP_Z + 6) { e.state = 'dead'; e.remove = true; }
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
      if (b.z > LANE_END_Z) b.x += THREE.MathUtils.clamp(S.cx - b.x, -2 * dt, 2 * dt);
      if (b.z > front - 1.8) { b.state = 'attack'; b.atk = 0.55; bosses.play(b.i, '2H_Melee_Attack_Chop', clock, 1.1); }
    } else if (b.state === 'attack') {
      b.atk -= dt;
      b.x += THREE.MathUtils.clamp(S.cx - b.x, -2 * dt, 2 * dt);
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

  // ---- blocks & wall
  updateBlocks(plus1, dt, 2.3, null);
  updateBlocks(plus99, dt, 2.3, S.wall.alive ? WALL_Z - 1.6 : null);
  if (S.wall.alive) {
    if (S.wall.flash > 0) S.wall.flash -= dt;
    wallGroup.position.x = LANES[RIGHT] + (S.wall.flash > 0 ? (Math.random() - 0.5) * 0.08 : 0);
    if (Math.floor(clock * 20) !== Math.floor((clock - dt) * 20)) drawWallHp(S.wall.hp);
  }

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

const _labelQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.15, 0, 0));
const _bmat = new THREE.Matrix4(), _lmat = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function updateBlocks(kind, dt, speed, stopZ) {
  let n = 0, wq = 0;
  const L = kind.list;
  L.sort((a, b) => b.z - a.z); // near-first so queue spacing works
  for (const b of L) {
    if (!b.alive) { b.pop += dt; continue; }
    let limit = Infinity;
    if (stopZ !== null) { limit = stopZ - wq * 2.0; wq++; }
    b.z = Math.min(limit, b.z + speed * dt);
    if (b.z > LANE_END_Z - 0.6) { b.alive = false; b.pop = 1; puff(b.x, 0.4, b.z, 5, [0.6, 0.7, 0.9]); continue; }
    if (b.flash > 0) b.flash -= dt;
    const bump = b.flash > 0 ? 1.06 : 1;
    _p.set(b.x, 0.62, b.z); _s.set(bump, bump, bump);
    _bmat.compose(_p, _q.identity(), _s);
    kind.body.setMatrixAt(n, _bmat);
    const f = b.flash > 0 ? 2.6 : 1;
    kind.body.instanceColor.setXYZ(n, f, f, f);
    _p.set(b.x, 1.17, b.z + 0.12);
    _lmat.compose(_p, _labelQ, _s);
    kind.label.setMatrixAt(n, _lmat);
    n++;
  }
  kind.list = L.filter((b) => b.alive || b.pop < 0.5);
  kind.body.count = kind.label.count = n;
  kind.body.instanceMatrix.needsUpdate = kind.label.instanceMatrix.needsUpdate = true;
  kind.body.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- camera & loop
const troopLabelPos = new THREE.Vector3();
function updateCamera(dt) {
  S.shake = Math.max(0, S.shake - dt * 1.6);
  const sh = S.shake * S.shake * 0.5;
  camera.position.set(camBase.x + S.cx * 0.18 + (Math.random() - 0.5) * sh, camBase.y + (Math.random() - 0.5) * sh, camBase.z);
  camera.lookAt(camTarget.x + S.cx * 0.12, camTarget.y, camTarget.z);
  if (params.has('cam')) { const c = params.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); }
  camera.updateMatrixWorld();
  troopLabelPos.set(S.cx, 1.9, TROOP_Z - troopRadius() * 0.78 - 0.9).project(camera);
  troopEl.style.transform = `translate(${(troopLabelPos.x * 0.5 + 0.5) * window.innerWidth}px, ${(-troopLabelPos.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
}

resize();
startLevel(1, SNAP ? 60 : TROOP.start);
loadEl.classList.add('gone');

// adaptive quality: drop resolution if the phone struggles
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function adapt(dt) {
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 2.5) {
    const fps = fpsN / fpsAcc;
    if (fps < 42 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); resize(); }
    else if (fps < 34 && sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    fpsAcc = fpsN = fpsT = 0;
  }
}

let last = performance.now();
const debug = document.getElementById('debug');
function frame(now) {
  let dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
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
  step: (n) => { for (let i = 0; i < n; i++) { update(1 / 30); floaters.update(1 / 30, window.innerWidth, window.innerHeight); } updateCamera(1 / 30); composer.render(); return { count: S.count, visible: visibleAlive, phase: S.phase, shadowCalls: renderer.info.render.calls }; },
  // run a whole level with a bot at 30 steps/s without rendering; returns the outcome
  sim: (bot, level = 1, troop = TROOP.start, maxSeconds = 400) => {
    S.bot = bot;
    startLevel(level, troop);
    S.bot = bot;
    let peak = S.count, minAfter20 = Infinity;
    const trace = [];
    for (let i = 0; i < maxSeconds * 30 && S.phase !== 'won' && S.phase !== 'lost'; i++) {
      update(1 / 30);
      peak = Math.max(peak, S.count);
      if (S.t > 20) minAfter20 = Math.min(minAfter20, S.count);
      if (i % 300 === 0) trace.push(`${Math.round(S.t)}s:${S.count}`);
    }
    const out = { bot, level, result: S.phase, t: Math.round(S.t), troop: S.count, peak, minAfter20, kills: S.kills, gold: S.gold, wall: S.wall.alive ? Math.round(S.wall.hp) : 'nede', boss: S.boss ? Math.max(0, Math.round(S.boss.hp)) : null, trace: trace.join(' ') };
    S.bot = null;
    return out;
  },
};
