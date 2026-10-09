# Music: renders three seamless loops to public/sounds/music_*.mp3 (battle, boss, base).
# Deep and heavy: war drums, low strings, horns and a low choir. No samples, nothing to license.
# usage: python3 tools/make-music.py
import os, subprocess, numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sounds')
rng = np.random.default_rng(3)


def t(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'highpass', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return signal.sosfilt(signal.butter(o, [a, b], 'bandpass', fs=SR, output='sos'), x)
def noise(d): return rng.standard_normal(int(d * SR))
def midi(n): return 440 * 2 ** ((n - 69) / 12)


def place(buf, x, at):
    """add x into the loop buffer at time `at`, wrapping around the end (seamless loops)"""
    n = len(buf); i = int(at * SR) % n
    idx = (i + np.arange(len(x))) % n
    np.add.at(buf, idx, x)


def drum(f=55, d=1.2, skin=0.4, dec=0.45):
    x = t(d)
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.8 * np.exp(-x / 0.025))) / SR) * np.exp(-x / dec)
    sub = np.sin(2 * np.pi * np.cumsum(f * 0.5 * (1 + 0.3 * np.exp(-x / 0.05))) / SR) * np.exp(-x / (dec * 1.3))
    return body + sub * 0.6 + lp(noise(d), 900) * np.exp(-x / 0.035) * skin


def low_hit(d=0.25):  # small frame drum / rim on the off-beats
    x = t(d)
    return bp(noise(d), 150, 900) * np.exp(-x / 0.04) * 0.6 + np.sin(2 * np.pi * 180 * x) * np.exp(-x / 0.05) * 0.4


def strings(f, d, bright=900, att=0.02, rel=0.08):
    """a small section of low strings (detuned saws), short and driving"""
    x = t(d); y = np.zeros_like(x)
    for det in (-0.006, 0, 0.007):
        ph = np.cumsum(f * (1 + det) * (1 + 0.003 * np.sin(2 * np.pi * 5.5 * x)) / SR)
        y += sum((1 / h) * np.sin(2 * np.pi * h * ph) for h in range(1, 9))
    e = np.minimum(1, x / att) * np.exp(-np.maximum(0, x - (d - rel)) / (rel / 3 + 1e-3))
    return lp(y * e, bright)


def horn(f, d, bright=700):
    x = t(d); ph = np.cumsum(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * x) * np.minimum(1, x / 0.3)) / SR)
    saw = sum((1 / h) * np.sin(2 * np.pi * h * ph) for h in range(1, 10))
    e = np.minimum(1, x / 0.18) * np.exp(-np.maximum(0, x - d * 0.8) / 0.15)
    return lp(saw * e, bright)


def choir(f, d, vowel=((570, 140, 1.0), (840, 160, 0.6))):
    x = t(d); y = np.zeros_like(x)
    for k in range(5):
        ff = f * rng.uniform(0.995, 1.005)
        src = 1 - 2 * ((np.cumsum(ff * (1 + 0.004 * np.sin(2 * np.pi * rng.uniform(4.5, 5.5) * x)) / SR)) % 1.0) + 0.15 * noise(d)
        for F, B, A in vowel: y += A * bp(src, F - B / 2, F + B / 2)
    e = np.minimum(1, x / 0.6) * np.exp(-np.maximum(0, x - d * 0.7) / 0.4)
    return lp(y * e, 1800)


def reverb(x, wet=0.3, size=2.0):
    ir = noise(size) * np.exp(-t(size) / (size / 5)); ir = lp(ir, 2000); ir[:int(0.03 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    w = signal.fftconvolve(x, ir); n = len(x); out = x * (1 - wet) + w[:n] * wet * 3
    tail = w[n:] * wet * 3; out[:len(tail)] += tail  # wrap the tail: seamless
    return out


def save(name, y):
    y = hp(lp(y, 4000), 30)
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.85
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '96k', os.path.join(OUT, name + '.mp3')], input=pcm, check=True)
    print(name, f'{len(y) / SR:.1f}s', os.path.getsize(os.path.join(OUT, name + '.mp3')) // 1024, 'KB')


def track(bpm, bars, chords, drums_pat, strings_on=True, brass=True, choir_on=True, intensity=1.0):
    beat = 60 / bpm; L = bars * 4 * beat; y = np.zeros(int(L * SR))
    for b in range(bars):
        root = chords[b % len(chords)]
        t0 = b * 4 * beat
        # drums: pattern of (beat position, pitch, gain)
        for pos, f, g in drums_pat:
            place(y, drum(f, 1.2) * g * intensity, t0 + pos * beat)
        for k in range(8):
            if k % 2 == 1: place(y, low_hit() * 0.25 * intensity, t0 + k * beat / 2)
        if strings_on:  # driving eighth notes on the root, octave jumps
            for k in range(8):
                n = root + (12 if k in (3, 6) else 0)
                place(y, strings(midi(n), beat / 2 * 0.95) * 0.32, t0 + k * beat / 2)
        if brass and b % 2 == 0:  # a horn chord every two bars
            for iv in (0, 3, 7):
                place(y, horn(midi(root + 12 + iv), 4 * beat * 1.9) * 0.18 * intensity, t0)
        if choir_on and b % 4 == 0:
            for iv in (0, 7):
                place(y, choir(midi(root + 12 + iv), 4 * beat * 3.9) * 0.12, t0)
    return reverb(y, 0.25, 2.2)


D, Bb, C, A, F, G = 38, 34, 36, 33, 41, 43  # midi roots (low register)
battle = track(100, 8, [D, D, Bb, C, D, D, Bb, A], [(0, 50, 1.0), (1.5, 58, 0.5), (2, 50, 0.8), (3, 62, 0.45), (3.5, 58, 0.4)])
save('music_battle', battle)
boss = track(116, 8, [D, Bb, C, A, D, Bb, G, A], [(0, 46, 1.0), (0.5, 46, 0.6), (1, 58, 0.7), (2, 46, 1.0), (2.5, 52, 0.6), (3, 58, 0.7), (3.5, 62, 0.6)], intensity=1.25)
save('music_boss', boss)
base = track(78, 8, [F, C, D, Bb, F, C, Bb, C], [(0, 55, 0.45), (2, 60, 0.3)], strings_on=False, brass=False, choir_on=True, intensity=0.6)
# a gentle plucked low melody on top of the base loop
beat = 60 / 78
for b in range(8):
    for k, step in enumerate([0, 7, 12, 7]):
        x = t(beat * 1.2); f = midi([F, C, D, Bb, F, C, Bb, C][b] + 12 + step)
        pl = lp(sum(np.sin(2 * np.pi * f * h * x) / h for h in (1, 2, 3)) * np.exp(-x / 0.35), 1500) * 0.25
        place(base, pl, b * 4 * beat + k * beat)
save('music_base', base)
