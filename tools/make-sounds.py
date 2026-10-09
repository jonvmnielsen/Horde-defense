# Sound design: renders every sound effect of the game to public/sounds/*.mp3.
# The sounds are built from physical recipes (plucked strings, resonating wood/bone/metal/stone, filtered noise,
# vocal formants, a short outdoor reverb), so there are no third-party recordings and nothing to license.
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
    ir[:int(0.012 * SR)] = 0  # pre-delay
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    w = signal.fftconvolve(x, ir)[:len(x) + len(ir) - 1]
    dry = np.concatenate([x, np.zeros(len(w) - len(x))])
    return dry * (1 - wet) + w * wet * 3


def sat(x, k=2.0): return np.tanh(k * x) / np.tanh(k)


def fade(x, ms=8):
    n = int(ms / 1000 * SR); n = min(n, len(x) // 2)
    x[-n:] *= np.linspace(1, 0, n); return x


def save(name, x, gain=1.0, verb=0.15, size=0.6):
    if verb > 0: x = reverb(x, verb, size)
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

# ------------------------------------------------------------------ weapons
for v in range(4):  # crossbow: string snap, wooden stock thump, trigger click, bolt whoosh
    d = 0.32
    string = pluck(rng.uniform(150, 190), d, 0.8, 0.985) * env(d, 0.001, 0.05)
    snap = bp(noise(d), 1800, 6000) * env(d, 0.0005, 0.006)
    stock = modal([180, 410, 760], [0.03, 0.02, 0.012], [1, 0.6, 0.3], d) * 0.8
    click = modal([3200, 5100], [0.004, 0.003], [0.5, 0.4], d) * 0.4
    whoosh = bp(noise(d), 800, 3500) * np.concatenate([np.linspace(0, 1, int(0.05 * SR)), np.exp(-t(d - 0.05) / 0.05)]) * 0.35
    save(f'shoot{v}', mix((string * 0.9, 0.003), (snap, 0), (stock, 0.001), (click, 0), (whoosh, 0.01)), 0.55, verb=0.12)

for v in range(4):  # bolt hits bone: a dry crack and a hollow bony knock
    d = 0.18
    crack = hp(noise(d), 2500) * env(d, 0.0003, 0.004)
    f = rng.uniform(0.85, 1.2)
    knock = modal([620 * f, 1450 * f, 2380 * f, 3900 * f], [0.025, 0.014, 0.008, 0.005], [1, 0.7, 0.5, 0.3], d)
    thud = lp(noise(d), 400) * env(d, 0.001, 0.02) * 0.6
    save(f'hit{v}', mix((crack, 0), (knock * 0.7, 0.001), (thud, 0)), 0.5, verb=0.1)

def bone_clack(k):
    d = 0.06; f = rng.uniform(900, 2600)
    return modal([f, f * 1.73, f * 2.9], [0.012, 0.007, 0.004], [1, 0.5, 0.3], d) * rng.uniform(0.2, 1)

for v in range(3):  # skeleton falls apart: bones clattering on stone, a dull body hit
    d = 0.55
    clatter = grains(d, rng.integers(14, 22), bone_clack, spread_decay=0.09)
    body = lp(noise(d), 300) * env(d, 0.002, 0.04)
    save(f'kill{v}', mix((body * 0.8, 0), (clatter, 0.01)), 0.55, verb=0.15)

# ------------------------------------------------------------------ troop
def chain(k):  # a ring of chain mail / buckle
    d = 0.08; f = rng.uniform(3000, 7000)
    return modal([f, f * 1.5, f * 2.2], [0.02, 0.012, 0.008], [1, 0.6, 0.4], d) * rng.uniform(0.2, 0.8)

d = 0.45  # +1: a soldier joins: armour jingle and a footstep
steps = lp(noise(d), 500) * env(d, 0.002, 0.03)
save('gain', mix((grains(0.35, 10, chain, 0.08) * 0.5, 0.02), (steps, 0)), 0.45, verb=0.15)

def horn(notes, durs, f_amp=1.0, vib=5.0):
    """brass/war horn: band-limited saw with rising brightness, formant body and vibrato"""
    y = []
    for f, dd in zip(notes, durs):
        x = t(dd)
        fv = f * (1 + 0.006 * np.sin(2 * np.pi * vib * x) * np.minimum(1, x / 0.15))
        ph = np.cumsum(fv / SR)
        saw = sum((1 / h) * np.sin(2 * np.pi * h * ph) for h in range(1, 14) if f * h < 9000)
        a = np.minimum(1, x / 0.04) * np.exp(-np.maximum(0, x - dd * 0.75) / 0.06)
        bright = lp(saw, 900) * 0.7 + lp(saw, 2600) * 0.3 * np.minimum(1, x / 0.08)
        body = bp(bright, 400, 1600) * 0.6 + bright * 0.4
        y.append(body * a * f_amp + bp(noise(dd), 800, 3000) * np.exp(-x / 0.03) * 0.05)
    return np.concatenate(y)

save('gainbig', mix((horn([233, 311], [0.18, 0.55]), 0.0), (grains(0.6, 26, chain, 0.12) * 0.35, 0.02)), 0.6, verb=0.25, size=1.0)

def grunt(k=0, d=0.28):
    f0 = rng.uniform(110, 150)
    v = formant_voice([f0 * 1.15, f0, f0 * 0.8], d, [(600, 120, 1.0), (1000, 160, 0.6), (2500, 300, 0.25)], breath=0.3)
    return v * env(d, 0.01, 0.08, 0.05)

for v in range(3):  # soldiers fall: armour hits the ground, a cry
    d = 0.6
    clang = modal([380, 870, 1460, 2210], [0.08, 0.05, 0.03, 0.02], [1, 0.6, 0.4, 0.3], d) * 0.5
    thud = lp(noise(d), 250) * env(d, 0.002, 0.06)
    save(f'lose{v}', mix((grunt(), 0), (thud, 0.12), (clang, 0.13)), 0.6, verb=0.18)

# ------------------------------------------------------------------ rewards
d = 1.6  # weapon chest: wooden lid creak, iron clank, a two-note war horn
creak_src = noise(0.35) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * np.cumsum(np.linspace(30, 60, int(0.35 * SR))) / SR)))
creak = bp(creak_src, 500, 1800) * env(0.35, 0.05, 0.12, 0.15)
clank = modal([520, 1180, 2050, 3300], [0.2, 0.12, 0.07, 0.04], [1, 0.7, 0.5, 0.3], 0.7)
save('weapon', mix((creak * 0.5, 0), (clank * 0.6, 0.3), (horn([294, 392, 587], [0.14, 0.14, 0.7]), 0.35)), 0.7, verb=0.25, size=1.0)

def bell(f, d, a=1.0):
    return modal([f, f * 2.76, f * 5.40, f * 8.93], [d * 0.5, d * 0.3, d * 0.15, d * 0.08], [1, 0.5, 0.25, 0.12], d, 0.0008) * a

d = 1.8  # ×2 gate: rising magical whoosh, horn chord, bells
whoosh = sweep_lp(noise(1.0), 200, 6000) * np.linspace(0, 1, int(1.0 * SR)) ** 2
chord = horn([196], [1.1]) + horn([247], [1.1]) * 0.8 + horn([294], [1.1]) * 0.7
save('mult', mix((whoosh * 0.4, 0), (chord * 0.6, 0.55), (bell(784, 1.2), 0.6), (bell(1175, 1.0, 0.7), 0.7)), 0.75, verb=0.3, size=1.2)

d = 2.0  # hero freed: stone cracks, shimmering bells
crack = grains(0.4, 16, lambda k: modal([rng.uniform(250, 900)], [0.02], [1], 0.05) * rng.uniform(0.3, 1), 0.08)
shimmer = sum(bell(f, 1.4, 0.6) for f in [988, 1319, 1568])
save('hero', mix((crack, 0), (shimmer, 0.25), (horn([392, 523], [0.2, 0.8]) * 0.5, 0.3)), 0.7, verb=0.35, size=1.5)

d = 0.9  # 2× fire: keg burst, powder fizz
burst = lp(noise(0.3), 1500) * env(0.3, 0.001, 0.05)
fizz = hp(noise(0.8), 3000) * env(0.8, 0.02, 0.25) * 0.4
save('power', mix((burst, 0), (fizz, 0.05), (modal([210, 470], [0.06, 0.04], [1, 0.5], 0.3) * 0.6, 0)), 0.65, verb=0.15)

for v in range(3):  # coin
    f = rng.uniform(2400, 2900)
    save(f'coin{v}', mix((bell(f, 0.5), 0), (bell(f * 1.06, 0.4, 0.6), 0.07)), 0.45, verb=0.1)

# ------------------------------------------------------------------ explosions and stone
def explosion(d, size=1.0):
    crack = noise(0.03) * np.linspace(1, 0, int(0.03 * SR))
    body = sweep_lp(noise(d, 'brown') * 0.7 + noise(d) * 0.3, 2500 * size, 120) * env(d, 0.003, d * 0.28)
    sub = np.sin(2 * np.pi * np.cumsum(np.linspace(70, 30, int(d * SR))) / SR) * env(d, 0.002, d * 0.2)
    debris = grains(d, int(40 * size), lambda k: modal([rng.uniform(300, 2500)], [0.015], [1], 0.04) * rng.uniform(0.1, 0.5), d * 0.35)
    return mix((crack, 0), (sat(body * 1.6, 1.5), 0), (sub * 0.9, 0), (debris * 0.4, 0.05))

save('boom', explosion(1.4, 0.8), 0.9, verb=0.25, size=1.2)
save('boombig', explosion(2.4, 1.3), 1.0, verb=0.3, size=1.8)

def stone(k):
    d = 0.09; f = rng.uniform(180, 900)
    return modal([f, f * 1.6], [0.02, 0.012], [1, 0.4], d) * rng.uniform(0.2, 1)

d = 1.6  # wall / boulder crumbles
rumble = lp(noise(d, 'brown'), 300) * env(d, 0.02, 0.4)
save('crumble', mix((rumble, 0), (grains(1.3, 70, stone, 0.35) * 0.7, 0.02), (explosion(0.5, 0.4) * 0.4, 0)), 0.85, verb=0.25, size=1.2)

d = 0.9  # rock lands
save('impact', mix((explosion(0.8, 0.5) * 0.8, 0), (grains(0.7, 30, stone, 0.15) * 0.6, 0.01)), 0.9, verb=0.2)

d = 1.1  # a heavy rock flying: low whoosh rising and falling
x = t(d); a = np.sin(np.pi * x / d) ** 2
save('throw', bp(noise(d), 150, 900) * a + lp(noise(d), 200) * a * 0.5, 0.5, verb=0.15)

# ------------------------------------------------------------------ boss
d = 2.0  # roar: a huge growl through an open-mouth vowel, with rasp
f0 = [62, 75, 80, 74, 60, 48]
voice = formant_voice(f0, d, [(500, 200, 1.0), (850, 250, 0.8), (1500, 400, 0.4), (2600, 600, 0.2)], breath=0.9, jitter=0.06)
rasp = bp(noise(d), 300, 2000) * (0.5 + 0.5 * np.sin(2 * np.pi * 28 * x[:0].size + 2 * np.pi * 28 * t(d)))
roar = sat((voice + rasp * 0.35) * env(d, 0.15, 0.5, 1.0), 2.5)
save('roar', mix((roar, 0), (lp(noise(d, 'brown'), 120) * env(d, 0.1, 0.8, 0.6) * 0.6, 0)), 0.9, verb=0.35, size=1.8)

for v in range(3):  # bolt glances off the boss's armour
    f = rng.uniform(300, 420)
    save(f'clang{v}', mix((modal([f, f * 2.3, f * 3.9, f * 5.8], [0.12, 0.07, 0.04, 0.02], [1, 0.6, 0.4, 0.2], 0.4), 0), (hp(noise(0.02), 3000), 0)), 0.45, verb=0.15)

# ------------------------------------------------------------------ magic
d = 1.6  # skeleton mage appears: ghostly wail
x = t(d)
wail = formant_voice([300, 420, 380, 260], d, [(700, 200, 1), (1100, 200, 0.5)], breath=0.15, jitter=0.03) * env(d, 0.3, 0.4, 0.6)
save('caster', lp(wail, 2500) * 0.7, 0.6, verb=0.45, size=2.0)

d = 0.9  # purple orb flies
x = t(d)
save('orb', sweep_lp(noise(d), 4000, 300) * np.sin(np.pi * x / d) + np.sin(2 * np.pi * np.cumsum(np.linspace(900, 300, len(x))) / SR) * np.sin(np.pi * x / d) * 0.2, 0.5, verb=0.3)

d = 0.7  # fireball
save('fire', mix((sweep_lp(noise(d), 300, 3000) * env(d, 0.05, 0.25), 0), (hp(noise(d), 4000) * env(d, 0.05, 0.15) * 0.3, 0)), 0.55, verb=0.15)

d = 0.7  # frost: ice crackle
ice = grains(d, 40, lambda k: hp(noise(0.01), 5000) * np.exp(-t(0.01) / 0.002) * rng.uniform(0.2, 1), 0.2)
save('frost', mix((ice, 0), (bell(2637, 0.6, 0.4), 0.02)), 0.5, verb=0.25)

d = 1.0  # heal: soft rising chime
save('heal', mix((bell(1047, 0.8, 0.6), 0), (bell(1319, 0.8, 0.5), 0.08), (bell(1568, 0.8, 0.5), 0.16)), 0.4, verb=0.35, size=1.2)

# ------------------------------------------------------------------ drums, horns, ui
def drum(f=70, d=0.6):
    x = t(d)
    tone = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-x / 0.03))) / SR) * np.exp(-x / 0.25)
    skin = bp(noise(d), 150, 1200) * np.exp(-x / 0.05) * 0.5
    return tone + skin

save('warn', mix((drum(), 0), (drum(), 0.22), (drum(75), 0.44)), 0.75, verb=0.25, size=1.2)
save('win', mix((drum(), 0), (drum(), 0.2), (horn([392, 392, 523, 659, 784], [0.14, 0.14, 0.18, 0.18, 1.0]), 0.25), (drum(60, 1.2), 0.95)), 0.8, verb=0.3, size=1.5)
save('defeat', mix((horn([294, 277, 262, 196], [0.35, 0.35, 0.35, 1.3]) * 0.8, 0), (drum(55, 1.5), 1.05)), 0.75, verb=0.4, size=2.0)
save('click', modal([1200, 2700], [0.012, 0.006], [1, 0.4], 0.06), 0.3, verb=0)
save('buy', mix((bell(2637, 0.5), 0), (bell(3136, 0.5, 0.7), 0.06), (grains(0.3, 8, lambda k: bell(rng.uniform(2200, 3200), 0.15, 0.4), 0.06), 0.1)), 0.5, verb=0.1)

# ------------------------------------------------------------------ horde ambience (seamless loop): marching feet and a low drone of groans
d = 4.0
x = t(d)
feet = grains(d, 120, lambda k: lp(noise(0.05), rng.uniform(300, 700)) * np.exp(-t(0.05) / 0.012) * rng.uniform(0.2, 1))
drone = lp(noise(d, 'brown'), 250) * (0.7 + 0.3 * np.sin(2 * np.pi * x / d))
groan = sum(formant_voice([rng.uniform(70, 110)] * 3, d, [(450, 150, 1), (900, 200, 0.4)], breath=0.7, jitter=0.05) * (0.5 + 0.5 * np.sin(2 * np.pi * (x / d + rng.uniform())))  for _ in range(3)) * 0.15
loop = feet * 0.6 + drone * 0.6 + groan
loop = loop / np.max(np.abs(loop)) * 0.8
xf = int(0.3 * SR)  # crossfade end into start
loop[:xf] = loop[:xf] * np.linspace(0, 1, xf) + loop[-xf:] * np.linspace(1, 0, xf)
loop = loop[:-xf]
pcm = (np.clip(loop * 0.7, -1, 1) * 32767).astype('<i2').tobytes()
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '64k', os.path.join(OUT, 'horde.mp3')], input=pcm, check=True)
print('horde loop done')
