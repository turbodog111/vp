#!/usr/bin/env python3
"""Build the paired Window View lyric timelines and recording envelopes."""

import array
import base64
import json
import math
import re
import statistics
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DURATION = 145.890975
STEP = 0.1
SAMPLE_RATE = 11025
LRC = ROOT / ".lyrics-inbox" / "farewell225--window-view--lrclib-33221053.lrc"

SECTIONS = [
    {"start": 0.0, "end": 20.29, "name": "Leaving the platform", "short": "DEPARTURE", "phase": 0},
    {"start": 20.29, "end": 40.0, "name": "Voices left behind", "short": "WINDOW / I", "phase": 1},
    {"start": 40.0, "end": 59.66, "name": "Somewhere ahead", "short": "OPEN TRACK", "phase": 2},
    {"start": 59.66, "end": 79.89, "name": "Something warm", "short": "DINING CAR", "phase": 3},
    {"start": 79.89, "end": 99.4, "name": "The location updates", "short": "WINDOW / II", "phase": 4},
    {"start": 99.4, "end": 118.6, "name": "Face forward", "short": "FINAL PASSAGE", "phase": 5},
    {"start": 118.6, "end": 137.8, "name": "The city keeps moving", "short": "NIGHT RUN", "phase": 6},
    {"start": 137.8, "end": DURATION, "name": "Beyond the last signal", "short": "ARRIVAL", "phase": 7},
]

# Text is kept natural while tokens provide word-level highlighting without
# inserting spaces into Japanese display copy.
JAPANESE = [
    (0.84, 2.02, "ちょっとずつ動き出す風景が", "ちょっとずつ|動き出す|風景が"),
    (2.10, 5.94, "現在地を教えてくれるの", "現在地を|教えて|くれるの"),
    (6.04, 7.56, "なら", "なら"),
    (7.66, 10.27, "今は寄りかかってりゃいいのかも", "今は|寄りかかってりゃ|いいのかも"),
    (10.37, 12.85, "なんとなく思い出す光景が", "なんとなく|思い出す|光景が"),
    (12.95, 15.90, "どうしても楽しくないから", "どうしても|楽しく|ないから"),
    (16.00, 18.15, "まだ", "まだ"),
    (18.25, 20.19, "忘れきったフリをするよ", "忘れきった|フリを|するよ"),
    (20.29, 20.84, "ねぇ", "ねぇ"),
    (20.94, 22.35, "頭の中で聞こえる", "頭の中で|聞こえる"),
    (22.45, 25.81, "いつかの罵声は置いてこうよ", "いつかの|罵声は|置いてこうよ"),
    (25.91, 27.26, "めちゃくちゃになった後は", "めちゃくちゃに|なった|後は"),
    (27.36, 31.26, "寂しくなって突っ立ってるんだから", "寂しくなって|突っ立ってるんだから"),
    (31.36, 32.23, "せめて今は", "せめて|今は"),
    (32.33, 39.90, "下手くそなりのステップを踏まなきゃ", "下手くそなりの|ステップを|踏まなきゃ"),
    (40.00, 41.73, "とにかく歩き続ければ", "とにかく|歩き続ければ"),
    (41.83, 44.38, "どこかにたどり着ける気がしてる", "どこかに|たどり着ける|気がしてる"),
    (44.48, 45.10, "いつか", "いつか"),
    (45.10, 45.84, "道間違って", "道|間違って"),
    (45.94, 47.35, "足が止まって", "足が|止まって"),
    (47.45, 51.34, "周りから人はいなくなってるかも", "周りから|人は|いなくなってるかも"),
    (51.44, 52.17, "なんてね", "なんてね"),
    (52.27, 54.56, "また暗い事言ってる", "また|暗い事|言ってる"),
    (54.66, 56.93, "お財布に痛くならない程度に", "お財布に|痛くならない|程度に"),
    (57.03, 59.56, "あったかいものを食べに行こうよ", "あったかいものを|食べに|行こうよ"),
    (59.66, 61.02, "まぁ", "まぁ"),
    (61.12, 63.46, "別に良いけどさ", "別に|良いけどさ"),
    (63.56, 65.75, "気にしないように", "気にしない|ように"),
    (65.75, 68.22, "してるだけだから", "してる|だけだから"),
    (68.32, 70.84, "きっと良くないの", "きっと|良くないの"),
    (70.94, 71.90, "いつのまにか", "いつのまにか"),
    (72.00, 74.35, "どっか飛んでった終末論や", "どっか|飛んでった|終末論や"),
    (74.45, 76.81, "書いて消すを繰り返した日々が", "書いて|消すを|繰り返した|日々が"),
    (76.91, 77.93, "なんか全部", "なんか|全部"),
    (78.03, 79.79, "意味ないように見えてさ", "意味ないように|見えてさ"),
    (79.89, 82.10, "どんどんと遠くなる風景が", "どんどんと|遠くなる|風景が"),
    (82.20, 85.23, "現在地を更新するたびに", "現在地を|更新する|たびに"),
    (85.33, 86.05, "また", "また"),
    (86.05, 89.45, "何かを忘れちゃっていくのなら", "何かを|忘れちゃって|いくのなら"),
    (89.55, 92.02, "なんとなく思い出す光景が", "なんとなく|思い出す|光景が"),
    (92.12, 95.13, "ちょっとでも苦しくないように", "ちょっとでも|苦しく|ないように"),
    (95.23, 97.22, "ただ", "ただ"),
    (97.32, 101.40, "髪を切って前を向くの", "髪を切って|前を|向くの"),
    (101.72, 105.18, "髪を切って前を向くの", "髪を切って|前を|向くの"),
    (105.78, 109.24, "髪を切って前を向くの", "髪を切って|前を|向くの"),
    (109.84, 113.30, "髪を切って前を向くの", "髪を切って|前を|向くの"),
    (113.90, 117.72, "髪を切って前を向くの", "髪を切って|前を|向くの"),
]


def parse_lrc():
    pattern = re.compile(r"^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$")
    entries = []
    for raw in LRC.read_text(encoding="utf-8").splitlines():
        match = pattern.match(raw.strip())
        if not match:
            continue
        entries.append((int(match.group(1)) * 60 + float(match.group(2)), match.group(3).strip()))
    lines = []
    for index, (start, text) in enumerate(entries):
        next_start = entries[index + 1][0] if index + 1 < len(entries) else 101.40
        lines.append((start, max(start + 0.24, next_start - 0.10), text, text.split()))
    refrain = "cut my hair and face forward"
    for start, end in ((101.72, 105.18), (105.78, 109.24), (109.84, 113.30), (113.90, 117.72)):
        lines.append((start, end, refrain, refrain.split()))
    return lines


def timed_line(start, end, text, tokens):
    weights = [max(1.0, len(re.sub(r"[^\w\u3040-\u30ff\u3400-\u9fff]", "", token)) ** 0.68) for token in tokens]
    total = sum(weights) or 1.0
    cursor = start
    words = []
    for index, (token, weight) in enumerate(zip(tokens, weights)):
        word_end = end if index == len(tokens) - 1 else cursor + (end - start) * weight / total
        words.append({"word": token, "start": round(cursor, 3), "end": round(word_end, 3)})
        cursor = word_end
    return {"start": round(start, 3), "end": round(end, 3), "text": text, "words": words}


def audio_analysis(path):
    process = subprocess.run(
        ("ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-"),
        check=True,
        capture_output=True,
    )
    samples = array.array("h")
    samples.frombytes(process.stdout)
    frame_size = int(SAMPLE_RATE * STEP)
    rms = []
    for start in range(0, len(samples), frame_size):
        frame = samples[start:start + frame_size]
        if frame:
            rms.append(math.sqrt(sum(sample * sample for sample in frame) / len(frame)))
    floor = statistics.quantiles(rms, n=100)[4]
    ceiling = statistics.quantiles(rms, n=100)[94]
    span = max(1.0, ceiling - floor)
    normalized = [max(0.0, min(1.0, (value - floor) / span)) for value in rms]
    energy = []
    state = 0.0
    for value in normalized:
        state += (value - state) * (0.48 if value > state else 0.13)
        energy.append(state)
    onsets = []
    previous = 0.0
    for value in energy:
        onsets.append(min(1.0, max(0.0, value - previous) * 7.5))
        previous = value

    def encode(values):
        packed = bytes(round(max(0.0, min(1.0, value)) * 100) for value in values)
        return base64.b64encode(packed).decode("ascii")

    return {"step": STEP, "energyBase64": encode(energy), "onsetsBase64": encode(onsets)}


def write_dataset(filename, language, artist, audio_path, line_specs):
    lines = []
    for start, end, text, tokens in line_specs:
        if isinstance(tokens, str):
            tokens = tokens.split("|")
        lines.append(timed_line(start, end, text, tokens))
    data = {
        "song": "Window View",
        "artist": artist,
        "language": language,
        "duration": DURATION,
        "theater": f"window-{language}",
        "bpm": 97,
        "beatOffset": 0.22,
        "key": "B-flat major",
        "footer": "RAIL / GLASS / DISTANCE",
        "sections": SECTIONS,
        "lines": lines,
        "analysis": audio_analysis(audio_path),
        "timingMethod": "Recording-specific synced LRC anchors, phrase mapping, and measured audio envelope.",
    }
    destination = ROOT / "songs" / "lyrics" / filename
    destination.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    write_dataset(
        "window-view-jp.json",
        "ja",
        "farewell225 feat. Kasane Teto SV",
        ROOT / "songs" / "Farewell225 - Window View.m4a",
        JAPANESE,
    )
    write_dataset(
        "window-view-en.json",
        "en",
        "Moonlit Star",
        ROOT / "songs" / "Moonlit Star - Window View (English).m4a",
        parse_lrc(),
    )


if __name__ == "__main__":
    main()
