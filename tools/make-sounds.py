# Sound design: renders every sound effect of the game to public/sounds/*.mp3.
# Direction (Jon): deep, soft and heavy, never shrill or "arcade". Booming explosions, war cries from a huge army,
# crossbow volleys that grow denser as the troop grows. Everything is low-passed, sits in a big outdoor reverb,
# and is built from physical recipes (strings, wood, bone, stone, voices), so there is nothing to license.
# usage: python3 tools/make-sounds.py   (needs numpy, scipy, ffmpeg)
import os, subprocess, numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sounds')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def t(d): return np.arange(int(d * SR)) / SR
def silence(d): return np.zeros(int(d * SR))


def env(d, a=0.002, decay=0.1, hold=0.0):
    x = t(d)
    e = np.where(x < a, x / max(a, 1e-6), np.exp(-np.maximum(0, x - a - hold) / decay))
    return e


def noise(d, color='white'):
    n = rng.standard_normal(int(d * SR))
    if color == 'brown':
        n = np.cumsum(n); n = signal.lfilter([1, -1], [1, -0.995], n); n /= np.max(np.abs(n)) + 1e-9
    elif color == 'pink':
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]; a = [1, -2.494956002, 2.017265875, -0.522189400]
        n = signal.lfilter(b, a, n); n /= np.max(np.abs(n)) + 1e-9
    return n


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, min(hi, SR / 2 - 100)], 'bandpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def lp(x, f, order=2):
    sos = signal.butter(order, min(f, SR / 2 - 100), 'lowpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def hp(x, f, order=2):
    sos = signal.butter(order, f, 'highpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def sweep_lp(x, f0, f1):
    """time-varying low-pass (block-wise), for explosions and whooshes"""
    out = np.zeros_like(x); blk = 512; zi = None
    n = len(x)
    for i in range(0, n, blk):
        f = f0 * (f1 / f0) ** (i / max(1, n))
        sos = signal.butter(2, min(max(f, 30), SR / 2 - 100), 'lowpass', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        out[i:i + blk], zi = signal.sosfilt(sos, x[i:i + blk], zi=zi)
    return out


def modal(freqs, decays, amps, d, strike=0.0015):
    """a struck object: sum of decaying partials, excited by a short noise click"""
    x = t(d); y = np.zeros_like(x)
    for f, dc, a in zip(freqs, decays, amps):
        ph = rng.uniform(0, 2 * np.pi)
        y += a * np.sin(2 * np.pi * f * x + ph) * np.exp(-x / dc)
    click = noise(d) * np.exp(-x / strike)
    return y + click * 0.5


def pluck(freq, d, bright=0.5, damp=0.996):
    """Karplus-Strong plucked string"""
    n = int(d * SR); p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p); buf = lp(buf, 2000 + bright * 8000, 1)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = damp * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out


def grains(d, count, fn, spread_decay=None):
    """many little events (bone clatter, gravel, debris): fn(k) returns a short array"""
    y = silence(d)
    for k in range(count):
        if spread_decay: pos = min(d - 0.02, rng.exponential(spread_decay))
        else: pos = rng.uniform(0, d - 0.05)
        g = fn(k); i = int(pos * SR); j = min(len(y), i + len(g))
        y[i:j] += g[:j - i]
    return y


def formant_voice(f0s, d, vowels, breath=0.15, jitter=0.01):
    """glottal pulse train through vowel formants (grunts, groans, a roar)"""
    x = t(d); n = len(x)
    f0 = np.interp(x, np.linspace(0, d, len(f0s)), f0s) * (1 + jitter * noise(d, 'pink'))
    phase = np.cumsum(f0 / SR)
    pulse = (phase % 1.0); src = 1 - 2 * pulse  # saw-like glottal source
    src = src + breath * noise(d)
    y = np.zeros(n)
    for (F, B, A) in vowels:
        y += A * bp(src, max(50, F - B / 2), F + B / 2, 2)
    return y


def reverb(x, wet=0.18, size=0.7, damp=3500):
    ir_t = t(size)
    ir = noise(size) * np.exp(-ir_t / (size / 5)); ir = lp(ir, damp)
    ir[:int(0.03 * SR)] = 0  # pre-delay: a wide open battlefield
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    w = signal.fftconvolve(x, ir)[:len(x) + len(ir) - 1]
    dry = np.concatenate([x, np.zeros(len(w) - len(x))])
    return dry * (1 - wet) + w * wet * 3


def sat(x, k=2.0): return np.tanh(k * x) / np.tanh(k)


def fade(x, ms=8):
    n = int(ms / 1000 * SR); n = min(n, len(x) // 2)
    x[-n:] *= np.linspace(1, 0, n); return x


def save(name, x, gain=1.0, verb=0.15, size=0.6, cut=4500):
    x = lp(x, cut, 2)  # nothing shrill: every sound is darkened
    x = hp(x, 28, 2)   # but keep the sub-bass that makes it heavy
    if verb > 0: x = reverb(x, verb, size, damp=2200)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89 * gain
    # trim trailing silence
    thr = 0.003; idx = np.where(np.abs(x) > thr)[0]
    if len(idx): x = x[:min(len(x), idx[-1] + int(0.02 * SR))]
    x = fade(x.copy())
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    path = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '80k', path], input=pcm, check=True)
    print(f'{name:16s} {len(x) / SR:5.2f}s {os.path.getsize(path) / 1024:5.1f} KB')


def mix(*parts):
    n = max(len(p) for p, _ in parts); y = np.zeros(n)
    for p, off in parts:
        i = int(off * SR); j = min(n, i + len(p)); y[i:j] += p[:j - i]
    return y


def pad(x, d): return np.concatenate([x, silence(max(0, d - len(x) / SR))])


# ------------------------------------------------------------------ building blocks
def voice(f0, d, vowel='a', breath=0.35, jitter=0.03, contour=(0.9, 1.08, 1.0, 0.85)):
    """one male voice shouting a vowel"""
    F = {'a': [(730, 160, 1.0), (1090, 180, 0.55), (2440, 300, 0.18)],
         'o': [(570, 140, 1.0), (840, 160, 0.6), (2410, 300, 0.12)],
         'u': [(300, 100, 1.0), (870, 150, 0.4), (2240, 300, 0.08)],
         'e': [(530, 140, 1.0), (1840, 220, 0.45), (2480, 300, 0.15)]}[vowel]
    v = formant_voice([f0 * c for c in contour], d, F, breath=breath, jitter=jitter)
    return v

def army(d, n, vowel='a', f0=(95, 170), onset=0.25, attack=(0.06, 0.18), hold=0.5, rel=0.45, contour=(0.88, 1.1, 1.05, 0.8), bed=0.35):
    """a crowd of n men shouting together (war cry / cheer)"""
    y = silence(d)
    for k in range(n):
        st = rng.uniform(0, onset); dd = max(0.3, d - st - rng.uniform(0, 0.3))
        f = rng.uniform(*f0)
        v = voice(f, dd, vowel, breath=rng.uniform(0.3, 0.6), jitter=rng.uniform(0.02, 0.05), contour=tuple(c * rng.uniform(0.95, 1.05) for c in contour))
        x = t(dd); a = rng.uniform(*attack)
        e = np.minimum(1, x / a) * np.where(x < a + hold * dd, 1.0, np.exp(-(x - a - hold * dd) / rel))
        v = v * e * rng.uniform(0.5, 1.0)
        i = int(st * SR); y[i:i + len(v)] += v[:len(y) - i]
    noisebed = lp(noise(d, 'pink'), 1400) * env(d, 0.15, d * 0.35, d * 0.3) * bed
    y = y / (np.max(np.abs(y)) + 1e-9) + noisebed
    return lp(y, 3200)

def drum(f=55, d=1.2, skin=0.4):
    """big war drum (taiko-like): pitched body, thick skin slap, long boom"""
    x = t(d)
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.8 * np.exp(-x / 0.025))) / SR) * np.exp(-x / 0.45)
    sub = np.sin(2 * np.pi * np.cumsum(f * 0.5 * (1 + 0.3 * np.exp(-x / 0.05))) / SR) * np.exp(-x / 0.6)
    s_ = lp(noise(d), 900) * np.exp(-x / 0.035) * skin
    return body + sub * 0.6 + s_

def thud(d=0.4, f=(60, 260), decay=0.08):
    return bp(noise(d, 'brown') + noise(d) * 0.2, f[0], f[1]) * env(d, 0.003, decay)

def wood(f, d=0.25, dec=0.05):
    return modal([f, f * 2.3, f * 3.1], [dec, dec * 0.6, dec * 0.4], [1, 0.45, 0.2], d, 0.002)

def boom(d=3.5, size=1.0):
    """a deep explosion: soft crack, chest-punch sub, rolling rumble, falling dirt"""
    x = t(d)
    crack = lp(noise(0.05), 2200) * np.linspace(1, 0, int(0.05 * SR)) * 0.6
    sub = np.sin(2 * np.pi * np.cumsum(28 + 45 * np.exp(-x / 0.12)) / SR) * env(d, 0.004, 0.7 * size)
    body = sweep_lp(noise(d, 'brown'), 1400 * size, 70) * env(d, 0.006, 0.6 * size)
    rumble = lp(noise(d, 'brown'), 180) * env(d, 0.08, 1.4 * size, 0.2)
    dirt = grains(d, int(30 * size), lambda k: thud(0.15, (120, 600), 0.03) * rng.uniform(0.1, 0.4), 0.8 * size)
    return mix((crack, 0), (sat(sub * 1.2, 1.3), 0), (sat(body * 1.4, 1.6), 0), (rumble * 0.9, 0), (dirt * 0.5, 0.2))

# ------------------------------------------------------------------ crossbows: single shots and volleys
def crossbow(seed=0):
    d = 0.5
    string = lp(pluck(rng.uniform(85, 115), d, 0.15, 0.992), 1800) * env(d, 0.001, 0.09)
    stock = wood(rng.uniform(95, 130), d, 0.07) * 0.9
    puff = bp(noise(d), 250, 1400) * np.concatenate([np.linspace(0, 1, int(0.03 * SR)), np.exp(-t(d - 0.03) / 0.07)]) * 0.5
    snap = lp(noise(d), 2000) * env(d, 0.0008, 0.008) * 0.5
    return mix((string, 0.002), (stock, 0), (puff, 0.005), (snap, 0))

for v in range(4):
    save(f'shoot{v}', crossbow(v), 0.7, verb=0.08, size=1.2, cut=3500)

def volley(L, rate, far=0.5):
    """a seamless loop of many crossbows firing (rate shots per second), with bolts thudding home in the distance"""
    n = int(L * SR); y = np.zeros(n)
    shots = [crossbow(k) for k in range(6)]
    hits = [mix((thud(0.3, (90, 500), 0.05), 0), (wood(rng.uniform(180, 320), 0.3, 0.03) * 0.5, 0)) for k in range(6)]
    for k in range(int(L * rate)):
        s_ = shots[rng.integers(6)] * rng.uniform(0.35, 1.0)
        if rng.random() < far: s_ = lp(s_, 1200)
        i = rng.integers(n)
        for seg_i in range(len(s_)): pass
        idx = (i + np.arange(len(s_))) % n; np.add.at(y, idx, s_)
        h = hits[rng.integers(6)] * rng.uniform(0.15, 0.5); j = (i + int(rng.uniform(0.25, 0.6) * SR) + np.arange(len(h))) % n; np.add.at(y, j, h)
    air = lp(noise(L, 'pink'), 900) * 0.15 * min(1, rate / 15)  # the hiss of many bolts in the air
    return y / (np.max(np.abs(y)) + 1e-9) + air

def save_loop(name, y, gain=0.8):
    y = lp(y, 3500); y = hp(y, 30)
    # wrap a reverb tail around the loop so it stays seamless
    w = reverb(y, 0.3, 1.2, damp=2000); n = len(y); out = w[:n].copy(); tail = w[n:]; out[:len(tail)] += tail
    out = out / (np.max(np.abs(out)) + 1e-9) * gain
    pcm = (np.clip(out, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '80k', os.path.join(OUT, name + '.mp3')], input=pcm, check=True)
    print(f'{name:16s} loop {n / SR:4.1f}s')

save_loop('volley1', volley(3.0, 6), 0.7)
save_loop('volley2', volley(3.0, 18), 0.8)
save_loop('volley3', volley(3.0, 45, 0.35), 0.9)

# ------------------------------------------------------------------ hits and skeletons
for v in range(4):  # a bolt thuds into bone: deep and dull
    d = 0.3
    save(f'hit{v}', mix((thud(d, (80, 450), 0.04), 0), (wood(rng.uniform(220, 380), d, 0.025) * 0.6, 0)), 0.55, verb=0.15, size=1.0, cut=2500)

def bone(k):
    f = rng.uniform(250, 700)
    return wood(f, 0.12, 0.02) * rng.uniform(0.2, 1)
for v in range(3):  # a skeleton collapses into a heap of bones
    d = 0.7
    save(f'kill{v}', mix((thud(d, (50, 220), 0.06), 0), (grains(0.55, rng.integers(10, 16), bone, 0.1) * 0.7, 0.02)), 0.6, verb=0.18, size=1.2, cut=2400)

# ------------------------------------------------------------------ the troop
for v in range(2):  # a few soldiers join: armour rustle, footsteps, a couple of short "hah!"
    d = 0.9
    steps = grains(0.6, 5, lambda k: thud(0.15, (60, 300), 0.03) * rng.uniform(0.4, 1), 0.2)
    shout = army(0.6, 3, 'a', (110, 150), onset=0.15, attack=(0.02, 0.05), hold=0.2, rel=0.12, bed=0.05)
    rustle = bp(noise(0.5), 300, 1600) * env(0.5, 0.05, 0.12) * 0.25
    save(f'gain{v}', mix((steps, 0), (rustle, 0.02), (shout * 0.8, 0.08)), 0.6, verb=0.25, size=1.5, cut=3000)

save('warcry', mix((army(2.2, 28, 'a', (95, 165), onset=0.2), 0), (drum(50, 1.5), 0)), 0.9, verb=0.35, size=2.2, cut=3200)
save('warcrybig', mix((army(3.4, 55, 'a', (90, 170), onset=0.35, hold=0.55), 0), (drum(48, 1.8), 0), (drum(52, 1.8), 0.32), (drum(44, 2.2), 0.64)), 1.0, verb=0.4, size=2.8, cut=3200)

for v in range(3):  # soldiers fall: groans, bodies and armour hitting the ground
    d = 1.0
    groan = army(0.7, 2, 'u', (95, 130), onset=0.1, attack=(0.02, 0.05), hold=0.3, rel=0.2, contour=(1.1, 1.0, 0.85, 0.7), bed=0.02)
    fall = thud(0.5, (40, 200), 0.09)
    armour = lp(modal([210, 430, 690], [0.08, 0.05, 0.03], [1, 0.5, 0.3], 0.5), 1500) * 0.35
    save(f'lose{v}', mix((groan * 0.8, 0), (fall, 0.15), (armour, 0.17)), 0.7, verb=0.25, size=1.5, cut=2600)

# ------------------------------------------------------------------ rewards
save('weapon', mix((drum(52, 1.4), 0), (drum(46, 1.6), 0.28), (army(1.6, 20, 'a', (100, 160), onset=0.15), 0.3),
                   (sweep_lp(bp(noise(0.6), 400, 2500), 2500, 600) * env(0.6, 0.05, 0.2) * 0.25, 0.05)), 0.9, verb=0.35, size=2.2, cut=3000)
save('mult', mix((grains(1.0, 14, lambda k: drum(60, 0.4, 0.5) * rng.uniform(0.5, 0.9), None), 0), (army(2.8, 45, 'a', (90, 165), onset=0.3), 0.7), (drum(44, 2.0), 0.8)), 1.0, verb=0.4, size=2.6, cut=3200)

def choir(notes, d, vowel='o'):
    y = silence(d)
    for f in notes:
        for _ in range(4):
            v = voice(f * rng.uniform(0.99, 1.01), d, vowel, breath=0.25, jitter=0.01, contour=(1, 1, 1, 1))
            y += v * env(d, 0.4, 0.6, d * 0.45)
    return lp(y, 2000)
save('hero', mix((choir([73.4, 110, 146.8, 185], 2.6), 0), (drum(46, 2.0), 0.0)), 0.85, verb=0.45, size=3.0, cut=2400)
save('power', mix((thud(0.6, (40, 300), 0.12), 0), (sweep_lp(noise(1.0, 'brown'), 900, 120) * env(1.0, 0.01, 0.3), 0.02), (army(1.0, 8, 'a', (110, 160), onset=0.1, hold=0.3), 0.15)), 0.8, verb=0.3, size=1.8, cut=2800)
for v in range(3):  # catching a crate: a soft pouch and muted coins
    d = 0.5
    coins = grains(0.3, 5, lambda k: lp(modal([rng.uniform(1100, 1700)], [0.05], [1], 0.12), 2000) * rng.uniform(0.1, 0.3), 0.06)
    save(f'coin{v}', mix((thud(0.3, (70, 350), 0.05), 0), (coins, 0.02)), 0.45, verb=0.2, size=1.0, cut=2200)

# ------------------------------------------------------------------ explosions and stone
save('boom', boom(3.2, 0.8), 1.0, verb=0.3, size=2.5, cut=2600)
save('boombig', boom(4.8, 1.3), 1.0, verb=0.35, size=3.2, cut=2400)
def stone(k):
    return lp(modal([rng.uniform(120, 420)], [0.03], [1], 0.12), 1500) * rng.uniform(0.2, 1)
save('crumble', mix((lp(noise(2.6, 'brown'), 220) * env(2.6, 0.03, 0.8), 0), (grains(2.0, 60, stone, 0.5) * 0.8, 0.02), (boom(1.5, 0.5) * 0.6, 0)), 0.95, verb=0.3, size=2.4, cut=2200)
save('impact', mix((boom(2.4, 0.7), 0), (grains(1.2, 25, stone, 0.25) * 0.6, 0.02)), 1.0, verb=0.3, size=2.4, cut=2400)
d = 1.3; x = t(d); a = np.sin(np.pi * x / d) ** 2
save('throw', (lp(noise(d, 'brown'), 300) * 0.8 + bp(noise(d), 120, 700) * 0.4) * a, 0.6, verb=0.2, size=1.4, cut=1500)

# ------------------------------------------------------------------ boss
d = 2.8
voice_ = formant_voice([44, 55, 60, 54, 42, 34], d, [(420, 180, 1.0), (760, 220, 0.7), (1300, 300, 0.25)], breath=0.8, jitter=0.07)
roar = sat(lp(voice_, 1600) * env(d, 0.2, 0.7, 1.2), 2.2)
save('roar', mix((roar, 0), (lp(noise(d, 'brown'), 90) * env(d, 0.15, 1.0, 0.8) * 0.8, 0), (np.sin(2 * np.pi * 32 * t(d)) * env(d, 0.3, 1.0, 1.0) * 0.4, 0)), 1.0, verb=0.4, size=3.0, cut=2000)
for v in range(3):  # bolts on heavy armour: dull, not ringing
    save(f'clang{v}', mix((lp(modal([rng.uniform(140, 190), 330, 520], [0.06, 0.035, 0.02], [1, 0.5, 0.25], 0.4), 1400), 0), (thud(0.3, (60, 300), 0.04), 0)), 0.5, verb=0.2, size=1.4, cut=1800)

# ------------------------------------------------------------------ magic (low and ominous)
d = 2.4; x = t(d)
drone = sum(np.sign(np.sin(2 * np.pi * f * x)) * 0.3 for f in [55, 55.7, 82.4]) 
save('caster', mix((lp(drone, 500) * env(d, 0.5, 0.8, 0.8), 0), (choir([65.4, 98], 2.4, 'u') * 0.6, 0)), 0.65, verb=0.5, size=3.0, cut=1600)
d = 1.2; x = t(d)
save('orb', (lp(noise(d, 'brown'), 400) + np.sin(2 * np.pi * np.cumsum(np.linspace(220, 80, len(x))) / SR) * 0.4) * np.sin(np.pi * x / d), 0.6, verb=0.35, size=2.0, cut=1500)
d = 1.0
save('fire', sweep_lp(noise(d, 'brown') + noise(d) * 0.2, 2200, 200) * env(d, 0.04, 0.35), 0.6, verb=0.25, size=1.6, cut=2400)
save('frost', mix((grains(0.7, 25, lambda k: lp(noise(0.02), 2600) * np.exp(-t(0.02) / 0.004) * rng.uniform(0.2, 1), 0.2), 0), (lp(noise(0.8, 'pink'), 1200) * env(0.8, 0.05, 0.3) * 0.4, 0)), 0.5, verb=0.3, size=1.8, cut=2800)
save('heal', choir([110, 138.6, 164.8], 1.8, 'u'), 0.4, verb=0.45, size=2.4, cut=1800)

# ------------------------------------------------------------------ drums, horns, ui
def horn(notes, durs):
    y = []
    for f, dd in zip(notes, durs):
        x = t(dd); fv = f * (1 + 0.005 * np.sin(2 * np.pi * 5 * x) * np.minimum(1, x / 0.2)); ph = np.cumsum(fv / SR)
        saw = sum((1 / h) * np.sin(2 * np.pi * h * ph) for h in range(1, 10))
        a = np.minimum(1, x / 0.08) * np.exp(-np.maximum(0, x - dd * 0.75) / 0.12)
        y.append(lp(saw, 700) * a)
    return np.concatenate(y)
save('warn', mix((drum(48, 1.4), 0), (drum(48, 1.4), 0.3), (drum(42, 1.8), 0.6), (army(2.0, 30, 'o', (70, 110), onset=0.4, contour=(0.9, 1, 1, 0.8)) * 0.5, 0.3)), 0.95, verb=0.4, size=2.6, cut=2200)
save('win', mix((drum(50, 1.4), 0), (drum(50, 1.4), 0.3), (army(3.2, 55, 'a', (90, 170), onset=0.3), 0.4), (horn([110, 146.8], [0.5, 1.6]) * 0.5, 0.5), (drum(44, 2.2), 1.2)), 1.0, verb=0.4, size=3.0, cut=3000)
save('defeat', mix((horn([98, 92.5, 87.3, 65.4], [0.6, 0.6, 0.6, 2.2]) * 0.8, 0), (drum(40, 2.4), 1.8), (army(2.0, 8, 'u', (80, 110), onset=0.4, contour=(1, 0.95, 0.85, 0.7)) * 0.4, 0.5)), 0.9, verb=0.45, size=3.2, cut=1800)
save('click', mix((thud(0.15, (120, 700), 0.02), 0), (wood(420, 0.15, 0.02) * 0.4, 0)), 0.4, verb=0, cut=2000)
save('tick', mix((wood(330, 0.2, 0.03), 0), (thud(0.15, (80, 400), 0.02) * 0.5, 0)), 0.45, verb=0.1, size=0.8, cut=1800)
save('buy', mix((thud(0.3, (60, 300), 0.06), 0), (grains(0.4, 8, lambda k: lp(modal([rng.uniform(900, 1500)], [0.06], [1], 0.12), 1800) * rng.uniform(0.1, 0.35), 0.08), 0.03), (drum(55, 0.8) * 0.5, 0)), 0.6, verb=0.25, size=1.4, cut=2200)

# ------------------------------------------------------------------ the horde: a seamless loop of heavy feet and groans
L = 4.0; n = int(L * SR)
feet = np.zeros(n)
for k in range(160):
    h = thud(0.12, (40, 260), 0.03) * rng.uniform(0.2, 1); i = rng.integers(n); idx = (i + np.arange(len(h))) % n; np.add.at(feet, idx, h)
groans = np.zeros(n)
for k in range(10):
    dd = rng.uniform(0.8, 1.8); g = voice(rng.uniform(60, 95), dd, rng.choice(['u', 'o']), breath=0.7, jitter=0.06, contour=(1, 1.05, 0.9, 0.75)) * env(dd, 0.2, 0.4, dd * 0.4)
    i = rng.integers(n); idx = (i + np.arange(len(g))) % n; np.add.at(groans, idx, g * rng.uniform(0.3, 0.8))
drone = lp(noise(L, 'brown'), 160)
y = feet / np.max(np.abs(feet)) * 0.7 + lp(groans, 1200) / (np.max(np.abs(groans)) + 1e-9) * 0.4 + drone * 0.4
save_loop('horde', y, 0.75)
