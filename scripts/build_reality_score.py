"""Offline transcription for the VP Your Reality sets. No inference runs in VP.

Requires ffmpeg, demucs, basic-pitch (ONNX), scipy and torch. Supply the
official htdemucs_6s checkpoint and a temporary directory for isolated stems.
Only note events are published; cached stems are keyed by the recording hash.
"""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1]
SR = 22050
MODEL_SHA = "34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd"
PARTS = {"your-reality": "piano", "your-reality-caleb-hyles": "piano",
         "your-reality-pop-punk": "piano", "your-reality-metal": "vocals",
         "your-reality-metalized": "guitar"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def recording(key):
    if key == "your-reality-metalized":
        ref = ROOT / "songs/imports" / (key + ".json")
    else:
        ref = ROOT / "songs/lyrics/aligned" / (key + ".json")
    return ROOT / json.loads(ref.read_text())["recording"]


def isolate(audio, stem, model, part):
    import torch
    from demucs.apply import apply_model
    pcm = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(audio), "-f", "f32le",
                                   "-ac", "2", "-ar", "44100", "pipe:1"])
    x = torch.from_numpy(np.frombuffer(pcm, dtype="<f4").reshape(-1, 2).T.copy())
    mid = x.mean(0)
    with torch.inference_mode():
        result = apply_model(model, ((x-mid.mean())/mid.std())[None], device="cpu",
                             shifts=0, overlap=.25, progress=False)[0, model.sources.index(part)]
        mono = result.mean(0).numpy() * float(mid.std()) + float(mid.mean())
    wavfile.write(stem, SR, resample_poly(mono, 1, 2).astype("float32"))


def evidence(y, start, end, midi, reference):
    """Independent spectral check: a local peak at the fundamental, not just its harmonics."""
    hz = 440 * 2 ** ((midi-69)/12)
    size = 4096
    # Zero-padding gives sub-bin peak estimates; the tolerance stays below half a semitone.
    window = np.hanning(size)
    matches = 0
    for when in np.linspace(start + (end-start)*.22, end - (end-start)*.18, 5):
        j = min(max(0, round(when*SR)-size//2), len(y)-size)
        frame = y[j:j+size]
        if np.sqrt(np.mean(frame*frame)) < reference*.028:
            continue
        spec = np.abs(np.fft.rfft(frame*window, n=16384))
        center = hz*16384/SR
        lo, hi = max(1, int(center*.939)), min(len(spec), int(center*1.065)+1)
        k = lo+np.argmax(spec[lo:hi])
        neighbors = spec[max(1, int(center*.85)):int(center*1.18)+1]
        if abs(1200*np.log2(k/center)) <= 46 and spec[k] > max(1e-7, 1.65*np.median(neighbors), spec.max()*.035):
            matches += 1
    return matches


def transcribe(stem, part, data, vocal, model):
    from basic_pitch.inference import predict
    lo, hi = (48, 83) if part == "piano" else ((53, 87) if part == "vocals" else (48, 88))
    _, _, estimates = predict(stem, model, onset_threshold=.55, frame_threshold=.32,
                              minimum_note_length=100, melodia_trick=False)
    rate, y = wavfile.read(stem)
    assert rate == SR
    # A loud harmonic is not necessarily another note. Require the source's
    # independent periodicity estimate on the two melody staffs. Do not use
    # a monophonic estimator to discard real chords on the piano.
    contour = None
    if part != "piano":
        import librosa
        contour = librosa.hz_to_midi(librosa.yin(y, fmin=98, fmax=1500, sr=SR,
                                    frame_length=2048, hop_length=256, center=True))
    reference = max(1e-6, float(np.percentile(np.abs(y[::8]), 97)))
    out = []
    for start, end, midi, amp, _ in estimates:
        if not lo <= midi <= hi or amp < (.43 if part == "guitar" else .39):
            continue
        start, end = max(0., start), min(end, data["duration"])
        if vocal is not None:
            # Filter spill from guitars, especially during Rena's long solo.
            span = next(((l["start"], l["end"]) for l in vocal["rows"]
                         if l["start"] <= (start+end)/2 <= l["end"]), None)
            if not span:
                continue
            start, end = max(start, span[0]), min(end, span[1])
        if end-start < .09 or evidence(y, start, end, midi, reference) < 3:
            continue
        if contour is not None:
            core = np.linspace(start+.20*(end-start), end-.16*(end-start), 7)
            offsets = np.minimum(len(contour)-1, np.rint(core*SR/256).astype(int))
            if np.count_nonzero(np.abs(contour[offsets]-midi) <= .54) < 4:
                continue
        out.append([round(start*1000), round(end*1000), int(midi), round(amp*100)])
    out.sort()
    if part == "vocals":
        # Vibrato can trigger the same MIDI pitch repeatedly through a held
        # vowel. Keep a reattack when a new word or an audible dip supports it.
        word_onsets = [w["start"]*1000 for l in vocal["rows"] for w in l["words"]["en"]]
        merged, previous = [], {}
        for a, b, midi, strength in out:
            last = previous.get(midi)
            if last and 0 <= a-last[1] <= 35 and not any(abs(x-a)<80 for x in word_onsets):
                center = round(a*SR/1000)
                samples = [y[max(0,center+d-120):center+d+120] for d in (-880,-440,-80,360,800)]
                rms = [np.sqrt(np.mean(x*x)) if x.size else 0 for x in samples]
                separated = min(rms[1:4]) < .55 * min(rms[0],rms[-1])
                if not separated:
                    last[1], last[3] = b, max(last[3],strength)
                    continue
            note = [a,b,midi,strength]
            previous[midi] = note
            merged.append(note)
        out = merged
    return {"version": 1, "source": part, "method": "htdemucs_6s/basic-pitch/fundamental"+("/yin" if contour is not None else ""),
            "audioSha256": data["audioSha256"], "notes": out}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("cache", type=Path)
    parser.add_argument("tracks", nargs="*", help="selected recording keys (default: all five)")
    args = parser.parse_args()
    if set(args.tracks)-PARTS.keys():
        parser.error("unknown recording; expected one of: "+", ".join(PARTS))
    from demucs.states import load_model
    from basic_pitch.inference import Model
    import basic_pitch
    import torch
    torch.set_num_threads(2)
    if digest(args.checkpoint) != MODEL_SHA:
        raise SystemExit("Wrong htdemucs_6s checkpoint")
    # Demucs' legacy torch bundle contains model classes; only load the pinned bytes.
    os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")
    split = load_model(args.checkpoint).eval()
    predictor = Model(Path(basic_pitch.__file__).parent / "saved_models/icassp_2022/nmp.onnx")
    args.cache.mkdir(parents=True, exist_ok=True)
    for key in args.tracks or PARTS:
        path = ROOT / "songs/motion" / (key+".json")
        data = json.loads(path.read_text())
        audio = recording(key)
        assert digest(audio) == data["audioSha256"], "motion data belongs to a different master"
        part = PARTS[key]
        stem = args.cache / (data["audioSha256"]+"-"+part+".wav")
        if not stem.exists():
            print("Separating", key, part, flush=True)
            isolate(audio, stem, split, part)
        vocal = json.loads((ROOT / "songs/lyrics/aligned" / (key+".json")).read_text()) if part == "vocals" else None
        pitch = transcribe(stem, part, data, vocal, predictor)
        data["pitch"] = pitch
        path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False)+"\n")
        print(key, len(pitch["notes"]), "verified pitch events", flush=True)


if __name__ == "__main__":
    main()
