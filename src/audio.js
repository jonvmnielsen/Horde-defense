// Sound effects: rendered samples (tools/make-sounds.py → public/sounds/*.mp3) played through WebAudio.
// Each effect has a few variations, a little random pitch, stereo position from where it happens on screen,
// and a cap on how many copies may ring at once, so 400 crossbows sound like a battle, not a buzz.

let ctx = null, master = null, sfxBus = null, ambBus = null;
let muted = false;
try { muted = localStorage.getItem('hordeforsvar.mute') === '1'; } catch (e) { /* ignore */ }
const buffers = {};
const playing = {}; // name -> number of voices ringing
const lastAt = {};

const FILES = ['shoot0', 'shoot1', 'shoot2', 'shoot3', 'hit0', 'hit1', 'hit2', 'hit3', 'kill0', 'kill1', 'kill2', 'gain', 'gainbig',
  'lose0', 'lose1', 'lose2', 'weapon', 'mult', 'hero', 'power', 'coin0', 'coin1', 'coin2', 'boom', 'boombig', 'crumble', 'impact', 'throw',
  'roar', 'clang0', 'clang1', 'clang2', 'caster', 'orb', 'fire', 'frost', 'heal', 'warn', 'win', 'defeat', 'click', 'buy', 'horde'];

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9;
  ambBus = ctx.createGain(); ambBus.gain.value = 0;
  sfxBus.connect(comp); ambBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
  for (const f of FILES) {
    fetch('sounds/' + f + '.mp3').then((r) => r.arrayBuffer()).then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej)))
      .then((b) => { buffers[f] = b; if (f === 'horde') startAmbience(); }).catch(() => { /* a missing sound is not fatal */ });
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

// the horde: a loop of marching feet and groans whose volume follows how close and how big the mass is
let amb = null;
function startAmbience() {
  if (amb || !buffers.horde) return;
  amb = ctx.createBufferSource(); amb.buffer = buffers.horde; amb.loop = true;
  amb.connect(ambBus); amb.start();
}
/** level 0..1 */
export function setHordeLevel(level) {
  if (!ctx || !ambBus) return;
  ambBus.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.55, ctx.currentTime, 0.4);
}

const V = (base, n) => Array.from({ length: n }, (_, k) => base + k);
const SHOOT = V('shoot', 4), HIT = V('hit', 4), KILL = V('kill', 3), LOSE = V('lose', 3), COIN = V('coin', 3), CLANG = V('clang', 3);

/** pan from a world x position (lanes run roughly -11..11) */
export const panOf = (x) => x / 14;

export const sfx = {
  shoot(pan = 0) { play(SHOOT, { key: 'shoot', vol: 0.32, pitch: 0.08, max: 6, gap: 0.03, pan }); },
  hit(pan = 0) { play(HIT, { key: 'hit', vol: 0.35, pitch: 0.12, max: 5, gap: 0.03, pan }); },
  kill(pan = 0) { play(KILL, { key: 'kill', vol: 0.4, pitch: 0.12, max: 5, gap: 0.05, pan }); },
  gain(n = 1, pan = 0) {
    if (n >= 20) play('gainbig', { vol: 0.75, pitch: 0.02, max: 2, gap: 0.3 });
    else play('gain', { vol: 0.45 + Math.min(0.3, n * 0.03), pitch: 0.1, max: 3, gap: 0.06, pan });
  },
  lose(n = 1, pan = 0) { play(LOSE, { key: 'lose', vol: Math.min(0.85, 0.4 + n * 0.04), pitch: 0.1, max: 3, gap: 0.08, pan }); },
  weapon() { play('weapon', { vol: 0.85, pitch: 0, max: 1 }); },
  mult() { play('mult', { vol: 0.85, pitch: 0, max: 1 }); },
  hero() { play('hero', { vol: 0.8, pitch: 0, max: 1 }); },
  power() { play('power', { vol: 0.7, pitch: 0.04, max: 2 }); },
  explosion(big = false, pan = 0) { play(big ? 'boombig' : 'boom', { vol: big ? 1 : 0.8, pitch: 0.08, max: 3, gap: 0.06, pan }); },
  wall(pan = 0) { play('crumble', { vol: 0.85, pitch: 0.06, max: 2, pan }); },
  bossRoar() { play('roar', { vol: 0.95, pitch: 0.04, max: 1 }); },
  throwRock(pan = 0) { play('throw', { vol: 0.6, pitch: 0.1, max: 2, pan }); },
  rockImpact(hit, pan = 0) { play('impact', { vol: hit ? 1 : 0.75, pitch: 0.08, max: 2, pan }); },
  bossHit() { play(CLANG, { key: 'clang', vol: 0.3, pitch: 0.1, max: 3, gap: 0.09 }); },
  caster(pan = 0) { play('caster', { vol: 0.6, pitch: 0.05, max: 1, pan }); },
  orb(pan = 0) { play('orb', { vol: 0.5, pitch: 0.1, max: 2, pan }); },
  warn() { play('warn', { vol: 0.7, pitch: 0, max: 1, gap: 1 }); },
  heal() { play('heal', { vol: 0.35, pitch: 0.05, max: 1, gap: 0.5 }); },
  frost(pan = 0) { play('frost', { vol: 0.45, pitch: 0.1, max: 2, gap: 0.2, pan }); },
  fireball(pan = 0) { play('fire', { vol: 0.5, pitch: 0.1, max: 2, gap: 0.2, pan }); },
  pickup(pan = 0) { play(COIN, { key: 'coin', vol: 0.5, pitch: 0.05, max: 3, gap: 0.05, pan }); },
  win() { play('win', { vol: 0.9, pitch: 0, max: 1 }); },
  defeat() { play('defeat', { vol: 0.9, pitch: 0, max: 1 }); },
  click() { play('click', { vol: 0.5, pitch: 0.05, max: 2, gap: 0.04 }); },
  coin() { play('buy', { vol: 0.6, pitch: 0.03, max: 2 }); },
};

/** Short vibration where the phone supports it (Android; iPhone browsers ignore it). */
export function buzz(ms) {
  if (muted) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
