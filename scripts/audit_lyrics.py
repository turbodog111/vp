#!/usr/bin/env python3
"""Validate every recording-specific lyric timeline used by vp."""

import json
import math
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRACKS = (
    ("trick-heart.json", "base", "songs/MIMI feat. Kasane Teto SV - Trick Heart.m4a"),
    ("magic-maid.json", "base", "songs/MIMI feat. Kasane Teto SV - Magic Maid.m4a"),
    ("one-more-bite.json", "base", "songs/Kasane Teto - One More Bite.m4a"),
    ("hero.json", "base", "songs/Mili - Hero.m4a"),
    ("hero.json", "base", "songs/Himemiya Rie - Hero (Mili Cover).m4a"),
    ("encore-dance.json", "jp", "songs/MIMI - Encore Dance (Japanese).m4a"),
    ("encore-dance.json", "en", "songs/Moonlit Star - Encore Dance (English).m4a"),
    ("waiting-for-tomorrow.json", "base", "songs/Kasane Teto - Waiting for Tomorrow.m4a"),
    ("through-patches-of-violet-metal.json", "base", "songs/Paul Owen Music - Through Patches of Violet (Metal Version).m4a"),
    ("compass-rock.json", "base", "songs/Paul Owen Music - Compass (Rock Version feat. Mili Vocals).m4a"),
    ("celebration.json", "base", "songs/christian/Forrest Frank - CELEBRATION.m4a"),
    ("psalm-8-halle.json", "base", "songs/christian/Phil Wickham - Psalm 8 (Halle).m4a"),
    ("dusty-bibles.json", "base", "songs/christian/Josiah Queen - Dusty Bibles.m4a"),
    ("window-view-jp.json", "base", "songs/Farewell225 - Window View.m4a"),
    ("window-view-en.json", "base", "songs/Moonlit Star - Window View (English).m4a"),
)

# Metadata-only visual theaters can share the lyrics data directory so the
# native Desktop UI bridge can read their sections and BPM. They intentionally
# contain no lyric lines and are audited as theater configuration elsewhere.
NON_LYRIC_THEATER_DATA = {"okay-theater.json"}


def normalized(text):
    return "".join(character.casefold() for character in text if character.isalnum())


def audio_duration(path):
    result = subprocess.run(
        (
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ),
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def timeline_lines(data, variant):
    if variant == "base":
        return data.get("lines", ())
    return data.get("variants", {}).get(variant, {}).get("lines", ())

def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def audit_parallel_lanes(label, line, line_index):
    errors = []
    lane_count = 0
    for language in ("jp", "romaji", "en"):
        if language not in line:
            continue
        lane_count += 1
        tokens = line[language]
        if not isinstance(tokens, list) or not tokens or any(
            not isinstance(token, str) or not token.strip() for token in tokens
        ):
            errors.append(f"{label} line {line_index}: invalid {language} token lane")
    if "jp" in line and any(language not in line for language in ("romaji", "en")):
        errors.append(f"{label} line {line_index}: incomplete parallel language lanes")
    return errors, lane_count


def audit_timeline(label, lines, duration):
    errors = []
    previous_line_end = 0.0
    word_count = 0
    for line_index, line in enumerate(lines, start=1):
        start = line.get("start")
        end = line.get("end")
        words = line.get("words")
        if not finite_number(start) or not finite_number(end) or start < 0 or end <= start:
            errors.append(f"{label} line {line_index}: invalid line interval")
            continue
        if start < previous_line_end - 0.001:
            errors.append(f"{label} line {line_index}: overlaps the previous line")
        if end > duration + 0.25:
            errors.append(f"{label} line {line_index}: ends after the recording")
        previous_line_end = end
        lane_errors, lane_count = audit_parallel_lanes(label, line, line_index)
        errors.extend(lane_errors)
        # Parallel-language string tokens are aligned within their parent line
        # by the renderer, not measured word timestamps. Do not certify them as such.
        if "jp" in line and lane_count and words is None:
            continue
        if not isinstance(words, list) or not words:
            errors.append(f"{label} line {line_index}: missing measured words")
            continue
        previous_word_end = start
        for word_index, word in enumerate(words, start=1):
            word_count += 1
            word_start = word.get("start")
            word_end = word.get("end")
            if (
                not finite_number(word_start)
                or not finite_number(word_end)
                or word_end <= word_start
            ):
                errors.append(f"{label} line {line_index}, word {word_index}: invalid interval")
                continue
            if word_start < previous_word_end - 0.001:
                errors.append(f"{label} line {line_index}, word {word_index}: overlaps the previous word")
            if word_start < start - 0.001 or word_end > end + 0.001:
                errors.append(f"{label} line {line_index}, word {word_index}: outside its line")
            previous_word_end = word_end
        lyric_text = normalized(line.get("text", ""))
        timed_text = normalized(" ".join(word.get("word", "") for word in words))
        if lyric_text != timed_text:
            errors.append(f"{label} line {line_index}: display text and timed words differ")
    return errors, word_count


def main():
    errors = []
    lyric_files = set()
    total_lines = 0
    total_words = 0
    for lyric_name, variant, audio_name in TRACKS:
        lyric_path = ROOT / "songs" / "lyrics" / lyric_name
        audio_path = ROOT / audio_name
        lyric_files.add(lyric_name)
        if not lyric_path.is_file():
            errors.append(f"missing lyric data: {lyric_path.relative_to(ROOT)}")
            continue
        if not audio_path.is_file():
            errors.append(f"missing audio: {audio_path.relative_to(ROOT)}")
            continue
        data = json.loads(lyric_path.read_text(encoding="utf-8"))
        lines = timeline_lines(data, variant)
        label = f"{lyric_name}:{variant}"
        if not lines:
            errors.append(f"{label}: empty timeline")
            continue
        duration = audio_duration(audio_path)
        declared_duration = data.get("duration")
        if not finite_number(declared_duration) or abs(duration - declared_duration) > 0.25:
            errors.append(
                f"{label}: declared duration {declared_duration!r} differs from audio duration {duration:.3f}"
            )
        timeline_errors, word_count = audit_timeline(label, lines, duration)
        errors.extend(timeline_errors)
        total_lines += len(lines)
        total_words += word_count

    disk_files = {path.name for path in (ROOT / "songs" / "lyrics").glob("*.json")}
    for unused in sorted(disk_files - lyric_files - NON_LYRIC_THEATER_DATA):
        errors.append(f"unmapped lyric data: songs/lyrics/{unused}")

    if errors:
        for error in errors:
            print(f"FAIL {error}")
        print(f"Lyric audit failed with {len(errors)} error(s).")
        return 1
    print(
        f"Lyric audit passed: {len(TRACKS)} recordings, {len(lyric_files)} lyric files, "
        f"{total_lines} lines, {total_words} explicit timed words. "
        "Parallel token lanes are validated at line level, not acoustically certified."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
