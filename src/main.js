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
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb9c9d8, 70, 185);
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 900);
const camBase = new THREE.Vector3(0, 13.5, 12.5);
const camTarget = new THREE.Vector3(0, 0, -19);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x7a6a52, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b5, 2.8);
sun.position.set(-22, 34, 20);
sun.target.position.set(0, 0, -25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 50, bottom: -50, near: 1, far: 140 });
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
  clips: [{ name: '2H_Ranged_Shooting', loop: true }, { name: 'Running_A', loop: true }, { name: 'Death_A', loop: false }, { name: 'Cheer', loop: true }],
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

const soldiers = new Crowd(rogueBaked, 420, blueMat);
const minions = new Crowd(minionBaked, 520, redMinionMat);
const warriors = new Crowd(warriorBaked, 140, redWarriorMat);
const bosses = new Crowd(warriorBaked, 2, createVatMaterial(warriorBaked, { recolor: [0.5, 0.99, 0.99, 1.8], tint: [1.0, 0.5, 0.42], key: 'boss', roughness: 0.55 }));
scene.add(soldiers.mesh, minions.mesh, warriors.mesh, bosses.mesh);

// blob shadows (cheap soft contact shadows under every unit)
const blobTex = RADIAL;
const blobs = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }),
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
let S;
function resetGame() {
  for (const s of S?.troop || []) soldiers.release(s.i);
  for (const e of S?.enemies || []) e.crowd.release(e.i);
  if (S?.boss) bosses.release(S.boss.i);
  plus1.list.length = 0; plus99.list.length = 0;
  S = {
    t: 0, gold: 0, cx: 0, targetCx: 0, troop: [], enemies: [], boss: null,
    nextHorde: 0.5, nextBlock: 0, nextBoss: SNAP ? 3 : 32, bossCount: 0,
    wall: { hp: 600, max: 600, alive: true, z: WALL_Z, x: LANES[RIGHT], pending: 0, flash: 0, respawn: 0 },
    shake: 0, over: false, kills: 0, spawnRate: 2.6,
  };
  wallGroup.visible = true;
  wallGroup.position.set(LANES[RIGHT], 0.05, WALL_Z);
  drawWallHp(600);
  for (let k = 0; k < 8; k++) plus99.list.push(newBlock(plus99, RIGHT, WALL_Z - 2.2 - k * 2.0, 26));
  const start = SNAP ? 60 : 16;
  for (let k = 0; k < start; k++) addSoldier(S.cx + (Math.random() - 0.5) * 2, TROOP_Z + (Math.random() - 0.5) * 2, true);
  // prefill the left lane with +1 blocks and the middle lane with a horde
  for (let z = -10; z > -76; z -= 2.6) plus1.list.push(newBlock(plus1, LEFT, z, 3));
  for (let k = 0; k < (SNAP ? 260 : 120); k++) spawnEnemy(-22 - Math.random() * 54);
  updateHud(true);
}

function newBlock(kind, lane, z, hp) { return { lane, x: LANES[lane], z, y: 0.6, hp, max: hp, pending: 0, flash: 0, kind, alive: true, pop: 0 }; }

// formation slot (sunflower packing => round, dense clump that grows wider with size)
function slot(k) {
  const r = 0.46 * Math.sqrt(k + 0.6);
  const a = k * 2.399963;
  return [Math.cos(a) * r, Math.sin(a) * r * 0.78];
}
function troopRadius() { return 0.46 * Math.sqrt(S.troop.length + 0.6); }

function addSoldier(x, z, instant) {
  if (S.troop.length >= soldiers.max - 4) return false;
  const i = soldiers.alloc();
  if (i < 0) return false;
  const s = { i, x, z, cd: Math.random() * 0.6, state: instant ? 'shoot' : 'run', dying: 0, yaw: Math.PI };
  soldiers.play(i, instant ? '2H_Ranged_Shooting' : 'Running_A', S.t, 1, Math.random());
  S.troop.push(s);
  return true;
}

function spawnEnemy(z, opts = {}) {
  const warrior = opts.warrior ?? Math.random() < 0.16;
  const crowd = warrior ? warriors : minions;
  const i = crowd.alloc();
  if (i < 0) return;
  const lane = opts.lane ?? MID;
  const e = {
    crowd, i, lane, x: LANES[lane] + (Math.random() - 0.5) * (LANE_W - 0.9), z,
    hp: warrior ? 5 : 2, pending: 0, speed: (warrior ? 2.5 : 2.9) * (0.85 + Math.random() * 0.3),
    state: 'run', t: 0, flash: 0, warrior, y: 0, gold: warrior ? 2 : 1,
  };
  const walk = !warrior && Math.random() < 0.35;
  e.speed *= walk ? 0.75 : 1;
  crowd.play(i, walk ? 'Walking_D_Skeletons' : 'Running_A', S.t, 0.9 + Math.random() * 0.25, Math.random() * 2);
  S.enemies.push(e);
}

function spawnBoss() {
  const i = bosses.alloc();
  if (i < 0) return;
  S.bossCount++;
  const hp = 220 + S.bossCount * 140;
  S.boss = { i, x: LANES[MID], z: -76, hp, max: hp, pending: 0, speed: 1.35, state: 'walk', flash: 0, atk: 0, y: 0 };
  bosses.play(i, 'Walking_D_Skeletons', S.t, 0.8);
  showBanner('BOSS');
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
const banner = document.getElementById('banner');
const overEl = document.getElementById('over');
const hint = document.getElementById('hint');
function hideHint() { hint.classList.add('gone'); }
let lastHud = 0;
function updateHud(force) {
  if (!force && S.t - lastHud < 0.08) return;
  lastHud = S.t;
  goldEl.textContent = S.gold.toLocaleString('da-DK');
  troopEl.querySelector('b').textContent = S.troop.filter((s) => s.state !== 'dead').length;
  if (S.boss) { bossBar.classList.add('on'); bossFill.style.width = Math.max(0, S.boss.hp / S.boss.max * 100) + '%'; }
  else bossBar.classList.remove('on');
}
let bannerT = 0;
function showBanner(text) { banner.textContent = text; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); bannerT = 2; }
document.getElementById('again').addEventListener('click', () => { overEl.classList.remove('on'); resetGame(); });

// ---------------------------------------------------------------- shooting
const laneTargets = [[], [], []];
function laneOf(x) { return x < -LANE_W / 2 ? LEFT : x > LANE_W / 2 ? RIGHT : MID; }
const _from = new THREE.Vector3(), _to = new THREE.Vector3();

function buildTargets() {
  for (const L of laneTargets) L.length = 0;
  for (const e of S.enemies) if (e.state === 'run' && e.hp - e.pending > 0) laneTargets[laneOf(e.x)].push(e);
  for (const b of plus1.list) if (b.alive && b.hp - b.pending > 0) laneTargets[b.lane].push(b);
  if (S.wall.alive) { if (S.wall.hp - S.wall.pending > 0) laneTargets[RIGHT].push(S.wall); }
  else for (const b of plus99.list) if (b.alive && b.hp - b.pending > 0) laneTargets[b.lane].push(b);
  if (S.boss && S.boss.state !== 'dead' && S.boss.hp - S.boss.pending > 0) laneTargets[laneOf(S.boss.x)].push(S.boss);
  for (const L of laneTargets) L.sort((a, b) => b.z - a.z);
}

function pickTarget(lane, fromZ) {
  const L = laneTargets[lane];
  for (let k = 0; k < L.length; k++) {
    const t = L[k];
    if (t.z > fromZ - 0.6 || t.z < -72) continue;
    if (t.hp - t.pending > 0) return t;
  }
  return null;
}

function hitHeight(t) {
  if (t === S.wall) return 1.4;
  if (t === S.boss) return 2.6;
  if (t.kind) return 0.6;
  return t.warrior ? 0.95 : 0.85;
}

function shoot(s) {
  const lane = laneOf(s.x);
  const t = pickTarget(lane, s.z);
  if (!t) return false;
  t.pending += 1;
  _from.set(s.x + 0.12, 0.85, s.z - 0.55);
  _to.set(t.x + (Math.random() - 0.5) * (t === S.wall ? 1.8 : t.kind ? 2.2 : 0.3), hitHeight(t), t.z + 0.2);
  // muzzle flash
  glow.emit(_from.x, _from.y, _from.z, 0, 0, 0, 2.6, 1.9, 0.9, 0.5, 0.06);
  const hx = _to.x, hy = _to.y, hz = _to.z;
  bolts.fire(_from, _to, 70, () => { t.pending -= 1; damage(t, 1, hx, hy, hz); });
  return true;
}

function damage(t, dmg, hx, hy, hz) {
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
    sparks(hx, hy + 0.2, hz + 0.45, t.kind === plus1 ? 0.5 : 1.0, t.kind === plus1 ? 0.75 : 0.8, t.kind === plus1 ? 1.6 : 0.3, 3);
    if (t.hp <= 0) popBlock(t);
    return;
  }
  // enemy
  if (t.state !== 'run') return;
  t.hp -= dmg; t.flash = 0.09;
  sparks(hx, hy, hz, 1.0, 0.95, 0.85, 2);
  if (t.hp <= 0) killEnemy(t);
}

function sparks(x, y, z, r, g, b, n) {
  for (let k = 0; k < n; k++) glow.emit(x, y, z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.2) * 5, r * 2, g * 2, b * 2, 0.22, 0.25 + Math.random() * 0.2, 9);
}
function puff(x, y, z, n, col = [0.75, 0.72, 0.66], size = 1.1) {
  for (let k = 0; k < n; k++) dust.emit(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2.5, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 2.5, col[0], col[1], col[2], size * (0.6 + Math.random() * 0.8), 0.7 + Math.random() * 0.6, 0.6);
}

function killEnemy(e) {
  e.state = 'dead'; e.t = 0;
  e.crowd.play(e.i, 'Death_C_Skeletons', S.t, 1.15);
  S.gold += e.gold; S.kills++;
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
  // reinforcements run in from the side of the troop
  for (let k = 0; k < n; k++) {
    const side = b.x < S.cx ? -1 : 1;
    if (!addSoldier(S.cx + side * (troopRadius() + 1 + Math.random() * 2), TROOP_Z - 2 - Math.random() * 3, false)) break;
  }
  if (isBig) S.shake = Math.max(S.shake, 0.25);
}

function breakWall() {
  S.wall.alive = false;
  wallGroup.visible = false;
  S.shake = 0.6;
  for (let k = 0; k < 40; k++) puff(LANES[RIGHT] + (Math.random() - 0.5) * 3.5, Math.random() * 2, WALL_Z, 1, [0.6, 0.58, 0.55], 1.8);
  for (let k = 0; k < 60; k++) glow.emit(LANES[RIGHT] + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, WALL_Z, (Math.random() - 0.5) * 12, 3 + Math.random() * 8, Math.random() * 8, 2.4, 1.4, 0.5, 0.3, 0.7, 14);
  floaters.add('MUREN ER NEDE!', { x: LANES[RIGHT], y: 3, z: WALL_Z }, 'gold', 1.4, 2);
  S.wall.respawn = 22;
}

function killBoss() {
  const b = S.boss;
  b.state = 'dead'; b.t = 0;
  bosses.play(b.i, 'Death_C_Skeletons', S.t, 0.9);
  S.gold += 50 + S.bossCount * 25;
  S.shake = 0.9;
  floaters.add('+' + (50 + S.bossCount * 25) + ' guld', { x: b.x, y: 4, z: b.z }, 'gold big', 1.6, 3);
  for (let k = 0; k < 90; k++) glow.emit(b.x + (Math.random() - 0.5) * 2, 1 + Math.random() * 3, b.z, (Math.random() - 0.5) * 14, 2 + Math.random() * 10, (Math.random() - 0.5) * 10, 2.6, 0.6, 0.2, 0.45, 0.9, 10);
  for (let k = 0; k < 30; k++) puff(b.x, 0.5, b.z, 1, [0.7, 0.66, 0.6], 2.2);
}

function killSoldier(s) {
  if (s.state === 'dead') return;
  s.state = 'dead'; s.dying = 0;
  soldiers.play(s.i, 'Death_A', S.t, 1.2);
  glow.emit(s.x, 0.8, s.z, 0, 1, 0, 0.6, 1.2, 3, 0.9, 0.18);
  floaters.add('-1', { x: s.x, y: 1.4, z: s.z }, 'red', 0.7, 1.2);
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

// ---------------------------------------------------------------- update
const _sl = [];
function update(dt) {
  S.t += dt;
  setVatTime(S.t);
  blobN = 0;

  // troop movement
  if (keys.ArrowLeft || keys.a) S.targetCx = Math.max(-6.2, S.targetCx - 12 * dt);
  if (keys.ArrowRight || keys.d) S.targetCx = Math.min(6.2, S.targetCx + 12 * dt);
  if (SNAP) S.targetCx = Math.sin(S.t * 0.4) * 2.5;
  S.cx += (S.targetCx - S.cx) * Math.min(1, dt * 10);

  // ---- spawns
  S.spawnRate = 4.2 + S.t * 0.06;
  S.nextHorde -= dt;
  if (S.nextHorde <= 0) {
    const burst = Math.random() < 0.1 ? 24 + Math.floor(Math.random() * 24) : 1;
    for (let k = 0; k < burst; k++) spawnEnemy(-74 - Math.random() * (burst > 1 ? 6 : 0.5));
    S.nextHorde = 1 / S.spawnRate * (burst > 1 ? burst * 0.6 : 1);
  }
  S.nextBlock -= dt;
  if (S.nextBlock <= 0) {
    const big = Math.random() < 0.1;
    plus1.list.push(newBlock(plus1, LEFT, -76, big ? 3 : 3));
    S.nextBlock = 1.25;
  }
  if (!S.boss) {
    S.nextBoss -= dt;
    if (S.nextBoss <= 0) spawnBoss();
  }
  if (!S.wall.alive) {
    S.wall.respawn -= dt;
    if (S.wall.respawn <= 0 && plus99.list.every((b) => !b.alive)) {
      const hp = Math.round(S.wall.max * 1.5 / 100) * 100;
      Object.assign(S.wall, { hp, max: hp, alive: true, pending: 0 });
      wallGroup.visible = true;
      drawWallHp(hp);
      plus99.list.length = 0;
      for (let k = 0; k < 8; k++) plus99.list.push(newBlock(plus99, RIGHT, -80 - k * 2.0, 26 + S.bossCount * 6));
    }
  }

  // ---- targets & shooting
  buildTargets();
  const alive = [];
  for (const s of S.troop) if (s.state !== 'dead') alive.push(s);
  alive.forEach((s, k) => { const [ox, oz] = slot(k); s.sx = S.cx + ox; s.sz = TROOP_Z + oz; });
  for (const s of S.troop) {
    if (s.state === 'dead') {
      s.dying += dt;
      if (s.dying > 1.3) s.remove = true;
      blob(s.x, s.z, 0.8 * Math.max(0, 1 - s.dying));
      soldiers.setTransform(s.i, s.x, 0, s.z, s.yaw, 1);
      continue;
    }
    const dx = s.sx - s.x, dz = s.sz - s.z;
    const d = Math.hypot(dx, dz);
    const runSpeed = s.state === 'run' ? 9 : 6;
    if (d > 0.02) {
      const m = Math.min(d, runSpeed * dt * (d > 0.5 ? 1 : d / 0.5 + 0.3));
      s.x += dx / d * m; s.z += dz / d * m;
    }
    if (s.state === 'run' && d < 0.35) { s.state = 'shoot'; soldiers.play(s.i, '2H_Ranged_Shooting', S.t, 1, Math.random()); }
    else if (s.state === 'shoot' && d > 1.2) { s.state = 'run'; soldiers.play(s.i, 'Running_A', S.t, 1.2, Math.random()); }
    const wantYaw = s.state === 'run' && d > 0.6 ? Math.atan2(dx, dz) : Math.PI;
    let dy = wantYaw - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.yaw += dy * Math.min(1, dt * 12);
    if (s.state === 'shoot') {
      s.cd -= dt;
      if (s.cd <= 0) { s.cd = shoot(s) ? 0.52 + Math.random() * 0.1 : 0.12; }
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
      e.x += THREE.MathUtils.clamp(ddx, -4 * dt, 4 * dt);
      yaw = Math.atan2(ddx, 3) * 0.6;
      if (e.z > front && Math.abs(e.x - S.cx) < troopRadius() + 0.6) {
        const s = nearestSoldier(e.x, e.z);
        if (s) killSoldier(s);
        e.hp = 0; killEnemy(e); e.gold = 0;
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
    b.t = (b.t || 0) + dt;
    if (b.state === 'dead') {
      if (b.t > 2.2) b.y -= dt * 1.5;
      if (b.t > 3.5) { bosses.release(b.i); S.boss = null; S.nextBoss = 50; }
    } else if (b.state === 'walk') {
      b.z += b.speed * dt;
      if (b.z > LANE_END_Z) b.x += THREE.MathUtils.clamp(S.cx - b.x, -2 * dt, 2 * dt);
      if (b.z > front - 1.8) { b.state = 'attack'; b.atk = 0.55; bosses.play(b.i, '2H_Melee_Attack_Chop', S.t, 1.1); }
    } else if (b.state === 'attack') {
      b.atk -= dt;
      b.x += THREE.MathUtils.clamp(S.cx - b.x, -2 * dt, 2 * dt);
      if (b.atk <= 0) {
        b.atk = 1.48;
        S.shake = Math.max(S.shake, 0.35);
        for (let k = 0; k < 5; k++) { const s = nearestSoldier(b.x, b.z + 2); if (s) killSoldier(s); }
        puff(b.x, 0.2, b.z + 2.2, 10, [0.7, 0.62, 0.5], 1.6);
      }
    }
    if (S.boss) {
      if (b.flash > 0) { b.flash -= dt; bosses.flash(b.i, Math.max(0, b.flash) * 12); }
      bosses.setTransform(b.i, b.x, b.y || 0, b.z, 0, 3.0);
      if (b.state !== 'dead' || b.t < 2.5) blob(b.x, b.z, 3.2);
    }
  }

  // ---- blocks
  updateBlocks(plus1, dt, 2.1, null);
  updateBlocks(plus99, dt, 2.1, S.wall.alive ? WALL_Z - 1.6 : null);

  // ---- wall
  if (S.wall.alive) {
    if (S.wall.flash > 0) S.wall.flash -= dt;
    wallGroup.position.x = LANES[RIGHT] + (S.wall.flash > 0 ? (Math.random() - 0.5) * 0.08 : 0);
    if (Math.floor(S.t * 20) !== Math.floor((S.t - dt) * 20)) drawWallHp(S.wall.hp);
  }

  // ---- game over
  if (!S.over && S.troop.every((s) => s.state === 'dead')) {
    S.over = true;
    setTimeout(() => {
      document.getElementById('overGold').textContent = S.gold.toLocaleString('da-DK');
      document.getElementById('overKills').textContent = S.kills.toLocaleString('da-DK');
      document.getElementById('overTime').textContent = Math.floor(S.t / 60) + ':' + String(Math.floor(S.t % 60)).padStart(2, '0');
      overEl.classList.add('on');
    }, 1300);
  }

  soldiers.commit(); minions.commit(); warriors.commit(); bosses.commit();
  blobs.count = blobN;
  blobs.instanceMatrix.needsUpdate = true;
  glow.update(dt); dust.update(dt); bolts.update(dt);
  updateHud(false);
}

const _labelQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.15, 0, 0));
const _bmat = new THREE.Matrix4(), _lmat = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function updateBlocks(kind, dt, speed, stopZ) {
  let n = 0, wq = 0;
  const L = kind.list;
  // sort near-first so queue spacing works
  L.sort((a, b) => b.z - a.z);
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
  // troop count pill follows the troop
  camera.updateMatrixWorld();
  troopLabelPos.set(S.cx, 1.9, TROOP_Z - troopRadius() * 0.78 - 0.9).project(camera);
  troopEl.style.transform = `translate(${(troopLabelPos.x * 0.5 + 0.5) * window.innerWidth}px, ${(-troopLabelPos.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -100%)`;
}

resize();
resetGame();
renderer.shadowMap.needsUpdate = true;
loadEl.classList.add('gone');

// adaptive quality: drop resolution if the phone struggles
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function adapt(dt) {
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 2.5) {
    const fps = fpsN / fpsAcc;
    if (fps < 42 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); resize(); }
    fpsAcc = fpsN = fpsT = 0;
  }
}

let last = performance.now();
const debug = document.getElementById('debug');
function frame(now) {
  let dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (SNAP) dt = 1 / 30;
  if (!S.over || S.t < 1e9) update(dt);
  updateCamera(dt);
  floaters.update(dt, window.innerWidth, window.innerHeight);
  if (bannerT > 0) bannerT -= dt;
  composer.render();
  if (!SNAP) adapt(dt);
  if (params.has('debug')) debug.textContent = `${Math.round(1 / dt)} fps · ${S.enemies.length} fjender · ${S.troop.length} soldater · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1e6).toFixed(2)}M tris · pr ${pixelRatio}`;
  if (!SNAP) requestAnimationFrame(frame);
}
if (!SNAP) requestAnimationFrame(frame);
window.__game = { get S() { return S; }, step: (n) => { for (let k = 0; k < n; k++) { update(1 / 30); floaters.update(1 / 30, window.innerWidth, window.innerHeight); } updateCamera(1 / 30); composer.render(); return renderer.info.render; } };
