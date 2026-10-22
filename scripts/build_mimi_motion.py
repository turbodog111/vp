"""Build compact, recording-specific motion data (requires numpy/scipy/ffmpeg)."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal


def analyze(path):
    rate, hop, size = 16000, 320, 1024
    pcm = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le',
        '-ac', '1', '-ar', str(rate), 'pipe:1',
    ])
    samples = np.frombuffer(pcm, dtype='<f4')
    frames = np.lib.stride_tricks.sliding_window_view(samples, size)[::hop]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(size), axis=1))
    frequencies = np.fft.rfftfreq(size, 1 / rate)
    rms = np.sqrt(np.mean(frames * frames, axis=1))
    bass = np.sqrt(np.mean(spectrum[:, frequencies < 230] ** 2, axis=1))
    high = np.sqrt(np.mean(spectrum[:, frequencies > 2200] ** 2, axis=1))
    flux = np.maximum(0, np.diff(np.log1p(spectrum), axis=0)).mean(axis=1)
    flux = np.concatenate(([0], flux))
    flux -= np.minimum(flux, signal.medfilt(flux, 51))
    autocorrelation = signal.correlate(flux, flux, mode='full', method='fft')[len(flux)-1:]
    candidates = []
    for bpm in np.arange(80, 201, 0.1):
        lag = 60 / bpm * rate / hop
        score = sum(np.interp(lag * n, np.arange(len(autocorrelation)), autocorrelation) / n for n in (1, 2, 4))
        candidates.append((score, bpm))
    candidates.sort(reverse=True)
    tempi = []
    for score, bpm in candidates:
        if all(abs(bpm - old['bpm']) > 3 for old in tempi):
            tempi.append({'bpm': round(float(bpm), 2), 'score': round(float(score), 4)})
        if len(tempi) == 5:
            break
    times = np.arange(len(flux)) * hop / rate + size / (2 * rate)
    # Autocorrelation locates tempo families; a whole-recording comb fit refines
    # the tempo and phase together, avoiding accumulated rounding drift.
    fits = []
    for candidate in tempi:
        if candidate['bpm'] < 145:
            continue
        for bpm_try in np.arange(candidate['bpm'] - 1.8, candidate['bpm'] + 1.8, 0.01):
            period = 60 / bpm_try
            offsets = np.arange(64) * period / 64
            grid = offsets[:, None] + np.arange(0, times[-1] - period, period)[None, :]
            scores = np.interp(grid, times, flux).mean(axis=1)
            best = int(np.argmax(scores))
            fits.append((float(scores[best]), float(bpm_try), float(offsets[best])))
    _, bpm, offset = max(fits)
    bpm = round(bpm, 2)

    def pack(values):
        # Fixed normalization keeps actual quiet passages quiet; no per-frame gain.
        ceiling = max(1e-8, np.percentile(values, 97))
        return np.rint(np.clip(values / ceiling, 0, 1) * 100).astype(int).tolist()

    # Store at 25 Hz; interpolation follows the native media clock during playback.
    envelope = signal.savgol_filter(rms, 25, 2)
    data = {
        'version': 1,
        'audioSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'duration': round(len(samples) / rate, 4),
        'sampleInterval': hop / rate * 2,
        'sampleOffset': size / (2 * rate),
        'scale': 100,
        'bpm': bpm,
        'beatOffset': round(offset, 3),
        'timingMethod': 'Spectral-flux autocorrelation and phase fit to this recording; not lyric alignment.',
        'tempoCandidates': tempi,
        'energy': pack(envelope[::2]),
        'bass': pack(bass[::2]),
        'high': pack(high[::2]),
        'onset': pack(flux[::2]),
    }
    return data


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('audio', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = analyze(args.audio)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(json.dumps({key: result[key] for key in ('duration', 'bpm', 'beatOffset', 'tempoCandidates')}))
