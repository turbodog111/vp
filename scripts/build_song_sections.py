"""Add measured song structure to a motion JSON file (requires numpy/scipy/ffmpeg).

Usage: python3 scripts/build_song_sections.py <audio.m4a> <motion.json>

Writes a `structure` list into the existing motion file without touching its
envelopes, tempo or phase. Each entry is one musical section measured from the
recording itself:

  {start, end, energy (0-100), chorus (bool), group, kind}

Method: bar-synchronous timbre (log band energies) and pitch-class features,
a self-similarity matrix, and a checkerboard novelty curve locate where the
music changes; boundaries snap to the recording's own bar grid. Loud sections
whose material repeats elsewhere are marked as choruses. This is audio
structure, not lyric alignment, and it never invents lyric timing.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import ndimage, signal

RATE, HOP, SIZE = 16000, 512, 2048


def decode(path):
    pcm = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le',
        '-ac', '1', '-ar', str(RATE), 'pipe:1',
    ])
    return np.frombuffer(pcm, dtype='<f4')


def frame_features(samples):
    frames = np.lib.stride_tricks.sliding_window_view(samples, SIZE)[::HOP]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(SIZE), axis=1)) ** 2
    freqs = np.fft.rfftfreq(SIZE, 1 / RATE)
    # Timbre: 24 log-spaced bands from 60 Hz to 7.5 kHz.
    edges = np.geomspace(60, 7500, 25)
    bands = np.stack([spectrum[:, (freqs >= lo) & (freqs < hi)].sum(axis=1)
                      for lo, hi in zip(edges[:-1], edges[1:])], axis=1)
    timbre = np.log1p(bands * 1e3)
    # Harmony: pitch-class energy from 110 Hz to 3.5 kHz.
    valid = (freqs >= 110) & (freqs <= 3500)
    pitch = np.round(12 * np.log2(freqs[valid] / 440.0)).astype(int) % 12
    chroma = np.zeros((spectrum.shape[0], 12))
    for pc in range(12):
        chroma[:, pc] = spectrum[:, valid][:, pitch == pc].sum(axis=1)
    chroma = chroma / np.maximum(chroma.sum(axis=1, keepdims=True), 1e-9)
    rms = np.sqrt(np.mean(frames * frames, axis=1))
    times = np.arange(len(frames)) * HOP / RATE + SIZE / (2 * RATE)
    flux = np.concatenate(([0], np.maximum(0, np.diff(timbre, axis=0)).sum(axis=1)))
    return times, timbre, chroma, rms, flux


def bar_grid(times, flux, bpm, offset, duration):
    beat = 60 / bpm
    beats = np.arange(offset, duration, beat)
    # Choose the downbeat phase (0-3) whose beats carry the most onset energy.
    strength = np.interp(beats, times, flux)
    phase = max(range(4), key=lambda p: strength[p::4].mean() if len(strength[p::4]) else 0)
    bars = beats[phase::4]
    if len(bars) == 0 or bars[0] > 0.05:
        bars = np.concatenate(([0.0], bars))
    if bars[-1] < duration - 0.05:
        bars = np.concatenate((bars, [duration]))
    return bars


def pool(times, values, bars):
    out = []
    for lo, hi in zip(bars[:-1], bars[1:]):
        mask = (times >= lo) & (times < hi)
        out.append(values[mask].mean(axis=0) if mask.any() else values[np.argmin(np.abs(times - lo))])
    return np.array(out)


def novelty(features, width):
    norm = features / np.maximum(np.linalg.norm(features, axis=1, keepdims=True), 1e-9)
    ssm = norm @ norm.T
    n = len(ssm)
    half = width // 2
    sign = np.sign(np.arange(-half, half) + 0.5)
    taper = signal.windows.gaussian(2 * half, std=half / 1.5)
    kernel = np.outer(sign * taper, sign * taper)
    padded = np.pad(ssm, half, mode='edge')
    curve = np.array([(padded[i:i + 2 * half, i:i + 2 * half] * kernel).sum() for i in range(n)])
    curve = np.maximum(curve, 0)
    return curve / max(curve.max(), 1e-9), ssm


def build(path, motion):
    samples = decode(path)
    duration = len(samples) / RATE
    times, timbre, chroma, rms, flux = frame_features(samples)
    bars = bar_grid(times, flux, motion['bpm'], motion['beatOffset'], duration)
    bar_timbre = pool(times, timbre, bars)
    bar_chroma = pool(times, chroma, bars)
    bar_rms = pool(times, rms[:, None], bars)[:, 0]
    # Standardize, then pair each bar with the next one (two-bar context).
    z = lambda m: (m - m.mean(axis=0)) / np.maximum(m.std(axis=0), 1e-9)
    stacked = np.hstack([z(bar_timbre), 1.4 * z(bar_chroma)])
    context = np.hstack([stacked, np.vstack([stacked[1:], stacked[-1:]])])
    curve, _ = novelty(context, width=8)
    loud = 20 * np.log10(np.maximum(bar_rms, 1e-6))
    loud_jump = np.abs(np.diff(ndimage.uniform_filter1d(loud, 2), prepend=loud[0]))
    curve = curve + 0.35 * loud_jump / max(loud_jump.max(), 1e-9)
    bar_seconds = 4 * 60 / motion['bpm']
    min_bars = max(3, int(round(7.5 / bar_seconds)))
    peaks, _ = signal.find_peaks(curve, distance=min_bars, prominence=0.08)
    cuts = [0] + [int(p) for p in peaks if min_bars <= p <= len(bar_rms) - min_bars] + [len(bar_rms)]
    # Merge any section shorter than the minimum into its neighbour.
    merged = [cuts[0]]
    for cut in cuts[1:]:
        if cut - merged[-1] < min_bars and cut != cuts[-1]:
            continue
        merged.append(cut)
    if len(merged) > 2 and merged[-1] - merged[-2] < min_bars:
        merged.pop(-2)
    sections = []
    peak_rms = np.percentile(bar_rms, 95)
    for a, b in zip(merged[:-1], merged[1:]):
        sections.append({
            'start': round(float(bars[a]), 3),
            'end': round(float(bars[b] if b < len(bars) else duration), 3),
            'energy': float(np.clip(bar_rms[a:b].mean() / max(peak_rms, 1e-9), 0, 1)),
            'timbre': bar_timbre[a:b].mean(axis=0),
            'chroma': bar_chroma[a:b].mean(axis=0),
        })
    # Group sections that repeat the same material.
    feats = np.array([np.concatenate([s['timbre'] / np.linalg.norm(s['timbre']),
                                      1.4 * s['chroma'] / np.linalg.norm(s['chroma'])]) for s in sections])
    feats = feats / np.linalg.norm(feats, axis=1, keepdims=True)
    sim = feats @ feats.T
    group = list(range(len(sections)))
    for i in range(len(sections)):
        for j in range(i):
            if sim[i, j] > 0.985 and abs(sections[i]['energy'] - sections[j]['energy']) < 0.18:
                group[i] = group[j]
                break
    energies = np.array([s['energy'] for s in sections])
    loud_cut = np.percentile(energies, 60) if len(energies) > 2 else energies.max()
    out = []
    for i, s in enumerate(sections):
        repeats = sum(1 for g in group if g == group[i]) > 1
        chorus = bool(s['energy'] >= loud_cut and s['energy'] >= 0.62 and (repeats or s['energy'] >= 0.85))
        if i == 0 and s['energy'] < 0.55:
            kind = 'intro'
        elif i == len(sections) - 1 and s['energy'] < energies.max() * 0.8:
            kind = 'outro'
        elif chorus:
            kind = 'chorus'
        elif s['energy'] < np.percentile(energies, 35):
            kind = 'break'
        elif i + 1 < len(sections) and sections[i + 1]['energy'] > s['energy'] + 0.08:
            kind = 'build'
        else:
            kind = 'verse'
        out.append({'start': s['start'], 'end': s['end'], 'energy': int(round(s['energy'] * 100)),
                    'chorus': chorus, 'group': int(group[i]), 'kind': kind})
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', type=Path)
    parser.add_argument('motion', type=Path)
    args = parser.parse_args()
    motion = json.loads(args.motion.read_text())
    digest = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    if motion.get('audioSha256') != digest:
        parser.error('motion file was measured from a different recording')
    motion['structure'] = build(args.audio, motion)
    motion['structureMethod'] = ('Bar-synchronous timbre and pitch-class self-similarity novelty '
                                 'on this recording; loud repeated material marked as chorus.')
    args.motion.write_text(json.dumps(motion, separators=(',', ':')) + '\n')
    for s in motion['structure']:
        print(f"{s['start']:7.2f}-{s['end']:7.2f}  {s['kind']:<6} e={s['energy']:3d} g={s['group']:2d}"
              f"{'  CHORUS' if s['chorus'] else ''}")
