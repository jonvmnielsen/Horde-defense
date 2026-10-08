// Sound effects, synthesised with WebAudio (no sound files to license or download).
// Every effect is rate-limited so a troop of 400 crossbows sounds like a volley, not a buzz.

let ctx = null, master = null, comp = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('hordeforsvar.mute') === '1'; } catch (e) { /* ignore */ }
const last = {};

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

/** Browsers (iOS above all) only allow sound after a touch: call this from the first pointer event. */
export function unlockAudio() {
  init();
  if (ctx && ctx.state !== 'running') ctx.resume();
  // iOS: play one silent buffer inside the gesture
  if (ctx && !unlockAudio.done) { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); unlockAudio.done = true; }
}
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('hordeforsvar.mute', m ? '1' : '0'); } catch (e) { /* ignore */ }
  if (master) master.gain.value = m ? 0 : 0.8;
}

function ready(key, gap) {
  if (!ctx || muted || ctx.state !== 'running') return false;
  const t = ctx.currentTime;
  if (key && last[key] !== undefined && t - last[key] < gap) return false;
  if (key) last[key] = t;
  return true;
}

function tone(type, f0, f1, dur, vol, t0 = 0, dest = master) {
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, filter, f0, f1 = f0, q = 1, t0 = 0) {
  const t = ctx.currentTime + t0;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const rnd = (a, b) => a + Math.random() * (b - a);

export const sfx = {
  /** crossbow twang: a short plucked string and a puff of air */
  shoot() {
    if (!ready('shoot', 0.045)) return;
    const f = rnd(520, 700);
    tone('triangle', f, f * 0.55, 0.07, 0.05);
    noise(0.05, 0.05, 'bandpass', 2600, 1200, 1.2);
  },
  /** bolt hits bone */
  hit() {
    if (!ready('hit', 0.035)) return;
    noise(0.035, 0.07, 'bandpass', rnd(1800, 2600), 900, 3);
  },
  /** a skeleton falls apart */
  kill() {
    if (!ready('kill', 0.06)) return;
    const f = rnd(260, 380);
    tone('square', f, f * 0.5, 0.06, 0.035);
    noise(0.08, 0.06, 'highpass', 1800, 900, 0.7);
  },
  /** soldiers join: a bright pling, higher for bigger gains */
  gain(n = 1) {
    if (!ready('gain', 0.07)) return;
    const base = n >= 50 ? 880 : n >= 5 ? 740 : 620;
    tone('sine', base, base, 0.16, 0.12);
    tone('sine', base * 1.5, base * 1.5, 0.2, 0.08, 0.05);
    if (n >= 5) tone('sine', base * 2, base * 2, 0.25, 0.06, 0.1);
  },
  /** soldiers lost: a dull thud and a short cry */
  lose(n = 1) {
    if (!ready('lose', 0.09)) return;
    tone('sine', 140, 60, 0.18, Math.min(0.3, 0.12 + n * 0.01));
    tone('sawtooth', 300, 170, 0.12, 0.03);
  },
  /** chest breaks: weapon upgrade fanfare */
  weapon() {
    if (!ready('weapon', 0.3)) return;
    [523, 659, 784, 1047].forEach((f, k) => tone('square', f, f, 0.16, 0.06, k * 0.07));
    tone('sine', 1047, 1047, 0.5, 0.08, 0.28);
    noise(0.4, 0.05, 'highpass', 4000, 8000, 0.5, 0.25);
  },
  /** ×2 gate: rising whoosh and a big major chord */
  mult() {
    if (!ready('mult', 0.3)) return;
    noise(0.5, 0.1, 'bandpass', 400, 4000, 1.5);
    [392, 494, 587, 784].forEach((f) => tone('sawtooth', f, f, 0.7, 0.035, 0.2));
    tone('sine', 1568, 1568, 0.6, 0.05, 0.25);
  },
  hero() {
    if (!ready('hero', 0.3)) return;
    [784, 988, 1175, 1568].forEach((f, k) => tone('sine', f, f, 0.35, 0.07, k * 0.09));
  },
  /** rapid fire keg, bomb pickup */
  power() {
    if (!ready('power', 0.2)) return;
    tone('square', 330, 990, 0.25, 0.05);
    tone('sine', 660, 1320, 0.3, 0.06, 0.05);
  },
  explosion(big = false) {
    if (!ready('boom', 0.08)) return;
    noise(big ? 0.9 : 0.6, big ? 0.45 : 0.3, 'lowpass', 1800, 80, 0.8);
    tone('sine', 90, 35, big ? 0.7 : 0.45, big ? 0.5 : 0.35);
  },
  wall() {
    if (!ready('wall', 0.2)) return;
    noise(0.7, 0.3, 'lowpass', 1200, 100, 0.7);
    for (let k = 0; k < 4; k++) noise(0.08, 0.08, 'bandpass', rnd(600, 1400), 400, 2, 0.1 + k * 0.09);
  },
  bossRoar() {
    if (!ready('roar', 1)) return;
    tone('sawtooth', 110, 55, 1.3, 0.16);
    tone('sawtooth', 116, 58, 1.3, 0.12);
    noise(1.2, 0.12, 'bandpass', 500, 150, 2);
  },
  throwRock() {
    if (!ready('throw', 0.3)) return;
    noise(0.6, 0.08, 'bandpass', 300, 1400, 2);
  },
  rockImpact(hit) {
    if (!ready('impact', 0.1)) return;
    noise(0.5, 0.35, 'lowpass', 900, 60, 0.8);
    tone('sine', 70, 30, 0.4, 0.4);
    if (hit) tone('sawtooth', 280, 150, 0.2, 0.04, 0.05);
  },
  bossHit() {
    if (!ready('bosshit', 0.07)) return;
    tone('triangle', rnd(150, 190), 90, 0.07, 0.07);
  },
  caster() {
    if (!ready('caster', 1)) return;
    tone('sine', 660, 330, 0.8, 0.07);
    tone('sine', 700, 350, 0.8, 0.05, 0.05);
  },
  orb() {
    if (!ready('orb', 0.2)) return;
    tone('sine', 900, 200, 0.35, 0.06);
  },
  warn() {
    if (!ready('warn', 0.5)) return;
    tone('square', 880, 880, 0.08, 0.04); tone('square', 880, 880, 0.08, 0.04, 0.14);
  },
  heal() {
    if (!ready('heal', 0.4)) return;
    tone('sine', 988, 1318, 0.25, 0.05);
  },
  frost() {
    if (!ready('frost', 0.3)) return;
    noise(0.3, 0.06, 'highpass', 6000, 3000, 0.5);
    tone('sine', 1760, 1320, 0.2, 0.03);
  },
  fireball() {
    if (!ready('fireball', 0.25)) return;
    noise(0.35, 0.1, 'lowpass', 2500, 300, 0.7);
  },
  win() {
    if (!ready('win', 1)) return;
    [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone('square', f, f, k === 5 ? 0.6 : 0.15, 0.06, k * 0.12));
  },
  defeat() {
    if (!ready('defeat', 1)) return;
    [392, 370, 349, 262].forEach((f, k) => tone('triangle', f, f, k === 3 ? 0.8 : 0.25, 0.08, k * 0.25));
  },
  click() {
    if (!ready('click', 0.05)) return;
    tone('sine', 900, 600, 0.05, 0.06);
  },
  coin() {
    if (!ready('coin', 0.06)) return;
    tone('square', 1320, 1320, 0.05, 0.04); tone('square', 1760, 1760, 0.12, 0.04, 0.05);
  },
};

/** Short vibration where the phone supports it (Android; iPhone browsers ignore it). */
export function buzz(ms) {
  if (muted) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
