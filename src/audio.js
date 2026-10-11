// Sound effects: rendered samples (tools/make-sounds.py → public/sounds/*.mp3) played through WebAudio.
// Each effect has a few variations, a little random pitch, stereo position from where it happens on screen,
// and a cap on how many copies may ring at once, so 400 crossbows sound like a battle, not a buzz.

let ctx = null, master = null, sfxBus = null, ambBus = null;
let muted = false;
try { muted = localStorage.getItem('hordeforsvar.mute') === '1'; } catch (e) { /* ignore */ }
const buffers = {};
const playing = {}; // name -> number of voices ringing
const lastAt = {};

const FILES = ['shoot0', 'shoot1', 'shoot2', 'shoot3', 'hit0', 'hit1', 'hit2', 'hit3', 'kill0', 'kill1', 'kill2', 'gain0', 'gain1', 'warcry', 'warcrybig',
  'lose0', 'lose1', 'lose2', 'weapon', 'mult', 'hero', 'power', 'coin0', 'coin1', 'coin2', 'boom', 'boombig', 'crumble', 'impact', 'throw',
  'roar', 'clang0', 'clang1', 'clang2', 'caster', 'orb', 'fire', 'frost', 'heal', 'warn', 'win', 'defeat', 'click', 'tick', 'buy', 'horde',
  'volley1', 'volley2', 'volley3', 'music_battle', 'music_boss', 'music_base'];
// recorded sounds from the shared library (game-assets: Kenney CC0, Sonniss GDC bundle, zombie pack), see assets.json
const L = (base, n, pad = 3, from = 0) => Array.from({ length: n }, (_, k) => 'lib/' + base + String(k + from).padStart(pad, '0'));
const LIB = {
  punch: L('impactpunch_heavy_', 5), soft: L('impactsoft_heavy_', 5), wood: L('impactwood_light_', 5), plate: L('impactplate_heavy_', 5),
  mining: L('impactmining_', 5), plank: L('impactplank_medium_', 5), flesh: L('axe_flesh_hit_', 5, 2, 1), shield: L('shield_block_', 5, 2, 1),
  coins: ['lib/handlecoins', 'lib/handlecoins2'], knife: ['lib/drawknife1', 'lib/drawknife2', 'lib/drawknife3'], cloth: ['lib/cloth1', 'lib/cloth2', 'lib/cloth3', 'lib/cloth4'],
  zombie: Array.from({ length: 24 }, (_, k) => 'lib/zombie-' + (k + 1)),
  latch: ['lib/metallatch'], boom: ['lib/distant_explosion'], debris: ['lib/metal_debris'], metal: ['lib/metal_impact'], crack: ['lib/tree_crack_fall'],
};
FILES.push(...Object.values(LIB).flat());
const LOOPS = { horde: null, volley1: null, volley2: null, volley3: null, music_battle: null, music_boss: null, music_base: null };
const loopGain = {};

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
  ambBus = ctx.createGain(); ambBus.gain.value = 1;
  sfxBus.connect(comp); ambBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
  for (const k of Object.keys(LOOPS)) { loopGain[k] = ctx.createGain(); loopGain[k].gain.value = 0; loopGain[k].connect(k.startsWith('music') ? master : ambBus); }
  for (const f of FILES) {
    fetch('sounds/' + f + '.mp3').then((r) => r.arrayBuffer()).then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej)))
      .then((b) => { buffers[f] = b; if (f in LOOPS) startLoop(f); }).catch(() => { /* a missing sound is not fatal */ });
  }
}
/** Start loading as soon as the game boots (decoding works before the first touch). */
export function preloadAudio() { init(); }

/** Browsers (iOS above all) only allow sound after a touch: call this from the first pointer event. */
export function unlockAudio() {
  init();
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume();
  if (!unlockAudio.done) { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); unlockAudio.done = true; }
}
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('hordeforsvar.mute', m ? '1' : '0'); } catch (e) { /* ignore */ }
  if (master) master.gain.value = m ? 0 : 1;
}

/**
 * play(name | [variants], { vol, pitch (± random), pan (-1..1), max voices, gap seconds })
 */
function play(names, o = {}) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const key = o.key || (Array.isArray(names) ? names[0] : names);
  const now = ctx.currentTime;
  if (o.gap && lastAt[key] !== undefined && now - lastAt[key] < o.gap) return;
  if ((playing[key] || 0) >= (o.max || 4)) return;
  const name = Array.isArray(names) ? names[Math.floor(Math.random() * names.length)] : names;
  const buf = buffers[name];
  if (!buf) return;
  lastAt[key] = now;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * (o.pitch ?? 0.06));
  const g = ctx.createGain(); g.gain.value = o.vol ?? 1;
  let node = src;
  node.connect(g); node = g;
  if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); node.connect(p); node = p; }
  node.connect(sfxBus);
  playing[key] = (playing[key] || 0) + 1;
  src.onended = () => { playing[key]--; };
  src.start(now + (o.delay || 0));
}

// loops that always run and are faded in and out: the horde, the crossbow volleys, the music
function startLoop(name) {
  if (LOOPS[name] || !buffers[name]) return;
  const src = ctx.createBufferSource(); src.buffer = buffers[name]; src.loop = true;
  src.connect(loopGain[name]); src.start(0, Math.random() * buffers[name].duration);
  LOOPS[name] = src;
}
function fadeTo(name, v, tc = 0.35) { if (ctx && loopGain[name]) loopGain[name].gain.setTargetAtTime(v, ctx.currentTime, tc); }
/** level 0..1: how close and big the horde is */
export function setHordeLevel(level) { fadeTo('horde', Math.max(0, Math.min(1, level)) * 0.55, 0.4); }
/**
 * How hard the troop is shooting, 0..1 (more soldiers, better weapons, 2× fire = higher).
 * Three volley loops cross-fade, so the battle sounds denser and heavier as the troop grows.
 */
export function setFireLevel(level) {
  const l = Math.max(0, Math.min(1, level));
  const tri = (c, w) => Math.max(0, 1 - Math.abs(l - c) / w);
  fadeTo('volley1', l > 0.02 ? 0.55 * Math.max(tri(0.2, 0.35), l < 0.2 ? 1 : 0) : 0, 0.25);
  fadeTo('volley2', 0.65 * tri(0.55, 0.35), 0.25);
  fadeTo('volley3', 0.8 * Math.max(tri(0.95, 0.4), l > 0.95 ? 1 : 0), 0.25);
}
/** which music plays: 'battle', 'boss', 'base' or '' (silence) */
let musicNow = '';
export function setMusic(which) {
  if (which === musicNow) return;
  musicNow = which;
  for (const m of ['battle', 'boss', 'base']) fadeTo('music_' + m, m === which ? 0.42 : 0, 0.8);
}

const V = (base, n) => Array.from({ length: n }, (_, k) => base + k);
const SHOOT = V('shoot', 4), HIT = V('hit', 4), KILL = V('kill', 3), LOSE = V('lose', 3), COIN = V('coin', 3), CLANG = V('clang', 3);

/** pan from a world x position (lanes run roughly -11..11) */
export const panOf = (x) => x / 14;

export const sfx = {
  /** a zombie-like groan from the horde (recorded) */
  groan(pan = 0, vol = 0.35) { play(LIB.zombie, { key: 'groan', vol, pitch: 0.12, rate: 0.8, max: 3, gap: 0.6, pan }); },
  shoot(pan = 0) { play(SHOOT, { key: 'shoot', vol: 0.45, pitch: 0.1, max: 4, gap: 0.09, pan }); }, // single shots on top of the volley loops
  hit(pan = 0) { play(Math.random() < 0.5 ? LIB.punch : LIB.soft, { key: 'hit', vol: 0.3, pitch: 0.12, rate: 0.85, max: 5, gap: 0.035, pan }); },
  kill(pan = 0) { play(LIB.wood, { key: 'kill', vol: 0.4, pitch: 0.15, rate: 0.75, max: 4, gap: 0.06, pan }); play(KILL, { key: 'kill2', vol: 0.3, pitch: 0.12, max: 3, gap: 0.12, pan }); },
  gain(n = 1, pan = 0) {
    if (n >= 40) play('warcrybig', { vol: 0.95, pitch: 0.03, max: 1, gap: 1.5 });
    else if (n >= 8) play('warcry', { vol: 0.85, pitch: 0.05, max: 2, gap: 0.6 });
    else play(['gain0', 'gain1'], { key: 'gain', vol: 0.5 + Math.min(0.3, n * 0.04), pitch: 0.08, max: 2, gap: 0.25, pan });
  },
  /** the whole army shouts (level start, big win) */
  warcry(big = false) { play(big ? 'warcrybig' : 'warcry', { vol: 0.95, pitch: 0.03, max: 1, gap: 1 }); },
  lose(n = 1, pan = 0) { play(LIB.flesh, { key: 'flesh', vol: Math.min(0.8, 0.35 + n * 0.04), pitch: 0.1, max: 3, gap: 0.1, pan }); play(LOSE, { key: 'lose', vol: Math.min(0.7, 0.3 + n * 0.03), pitch: 0.1, max: 2, gap: 0.2, pan }); },
  weapon() { play(LIB.knife, { key: 'knife', vol: 0.8, pitch: 0.05, max: 1 }); play(LIB.latch, { vol: 0.6, max: 1, delay: 0.15 }); play('weapon', { vol: 0.85, pitch: 0, max: 1 }); },
  mult() { play('mult', { vol: 0.85, pitch: 0, max: 1 }); },
  hero() { play(LIB.mining, { key: 'mining', vol: 0.8, pitch: 0.08, rate: 0.8, max: 2 }); play('hero', { vol: 0.8, pitch: 0, max: 1, delay: 0.1 }); },
  power() { play('power', { vol: 0.7, pitch: 0.04, max: 2 }); },
  explosion(big = false, pan = 0) { play(LIB.boom, { key: 'rboom', vol: big ? 1 : 0.8, pitch: 0.1, rate: big ? 0.8 : 1, max: 3, gap: 0.08, pan }); play(big ? 'boombig' : 'boom', { vol: big ? 0.8 : 0.6, pitch: 0.08, max: 3, gap: 0.06, pan }); },
  wall(pan = 0) { play('crumble', { vol: 0.8, pitch: 0.06, max: 2, pan }); play(LIB.mining, { key: 'mining', vol: 0.7, rate: 0.7, max: 2, pan }); play(LIB.debris, { vol: 0.35, rate: 0.6, max: 1, pan, delay: 0.1 }); },
  bossRoar() { play('roar', { vol: 0.95, pitch: 0.04, max: 1 }); },
  throwRock(pan = 0) { play('throw', { vol: 0.6, pitch: 0.1, max: 2, pan }); },
  rockImpact(hit, pan = 0) { play('impact', { vol: hit ? 0.9 : 0.7, pitch: 0.08, max: 2, pan }); play(LIB.boom, { key: 'rboom', vol: hit ? 0.7 : 0.5, rate: 1.3, max: 2, pan }); },
  bossHit() { play(Math.random() < 0.5 ? LIB.shield : LIB.plate, { key: 'clang', vol: 0.32, pitch: 0.1, rate: 0.8, max: 3, gap: 0.1 }); },
  caster(pan = 0) { play('caster', { vol: 0.6, pitch: 0.05, max: 1, pan }); },
  orb(pan = 0) { play('orb', { vol: 0.5, pitch: 0.1, max: 2, pan }); },
  warn() { play('warn', { vol: 0.7, pitch: 0, max: 1, gap: 1 }); },
  heal() { play('heal', { vol: 0.35, pitch: 0.05, max: 1, gap: 0.5 }); },
  frost(pan = 0) { play('frost', { vol: 0.45, pitch: 0.1, max: 2, gap: 0.2, pan }); },
  fireball(pan = 0) { play('fire', { vol: 0.5, pitch: 0.1, max: 2, gap: 0.2, pan }); },
  pickup(pan = 0) { play(LIB.coins, { key: 'coin', vol: 0.55, pitch: 0.1, rate: 0.85, max: 3, gap: 0.08, pan }); play(LIB.cloth, { key: 'cloth', vol: 0.4, pitch: 0.1, max: 2, gap: 0.1, pan }); },
  win() { play('win', { vol: 0.9, pitch: 0, max: 1 }); },
  defeat() { play('defeat', { vol: 0.9, pitch: 0, max: 1 }); },
  /** a gate's number goes up: a short tick that climbs with the value */
  tick(v = 0) { play(LIB.plank, { key: 'tick', vol: 0.35, pitch: 0.05, rate: 0.9 + Math.min(0.5, Math.max(0, v + 15) / 60), max: 2, gap: 0.06 }); return; play('tick', { vol: 0.6, pitch: 0, rate: 0.85 + Math.min(0.5, Math.max(0, v + 15) / 60), max: 3, gap: 0.05 }); },
  click() { play('click', { vol: 0.5, pitch: 0.05, max: 2, gap: 0.04 }); },
  coin() { play(LIB.coins, { key: 'buy', vol: 0.8, pitch: 0.05, max: 2 }); play('buy', { vol: 0.4, pitch: 0.03, max: 1 }); },
};

/** Short vibration where the phone supports it (Android; iPhone browsers ignore it). */
export function buzz(ms) {
  if (muted) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
