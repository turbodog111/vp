"""Recheck Window View against its two exact recordings; keep acoustic evidence local."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence", type=Path)
    parser.add_argument("mode", choices=["transcribe", "align", "materialize", "check-tail"])
    parser.add_argument("--rendition", choices=["jp", "en"], default="jp")
    opts = parser.parse_args()
    sys.path.insert(0, str(opts.evidence))
    from run_alignment import MODEL, audio_for, pcm, write
    from refine_alignment import anchors
    from materialize_aligned_lyrics import canonical, group_words
    import mlx.core as mx
    import romkan2
    import stable_whisper

    folder = opts.evidence / "window-view"
    folder.mkdir(exist_ok=True)
    model = None if opts.mode == "materialize" else stable_whisper.load_mlx_whisper(MODEL, dtype=mx.float16)
    for suffix, recording, language in [
        ("jp", "songs/Farewell225 - Window View.m4a", "ja"),
        ("en", "songs/Moonlit Star - Window View (English).m4a", "en"),
    ]:
        if suffix != opts.rendition:
            continue
        key = "window-view-" + suffix
        target = ROOT / "songs/lyrics" / (key + ".json")
        original = folder / (key + ".original.json")
        if not original.exists():
            write(original, json.loads(target.read_text()))
        data = json.loads(original.read_text())
        file = audio_for({"recording": recording})
        audio = pcm(file)
        metadata = {"recording": recording, "audioSha256": hashlib.sha256(file.read_bytes()).hexdigest(),
            "duration": len(audio) / 16000, "model": "mlx-community/whisper-large-v3-turbo",
            "reviewed": False, "status": "local-review"}
        source = ROOT / "songs/lyrics/sources/window-view-en.txt"
        if suffix == "en" and source.exists():
            text = source.read_text()
            data["lines"] = [{"text": line.strip(), "words": [{"word": word} for word in line.split()]}
                for line in text.splitlines() if line.strip()]
            metadata["sourceText"] = str(source.relative_to(ROOT))
            metadata["sourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
            metadata["sourceAttribution"] = "English cover lyrics supplied by Joshua in chat"
        output = folder / (key + "." + opts.mode + ".json")
        if opts.mode == "check-tail":
            clips = []
            ranges = [(94, 120), (115, 145)]
            if suffix == "en":
                ranges += [(14, 21), (50, 55)]
            for start, end in ranges:
                result = model.transcribe(pcm(file, start, end), language=language, verbose=None,
                    word_timestamps=True, condition_on_previous_text=False, temperature=0,
                    regroup=False, suppress_silence=True)
                clips.append({"offset": start, "end": end, "result": result.to_dict()})
            write(output, {"clips": clips, "evidence": metadata})
        elif opts.mode == "transcribe":
            if output.exists():
                print("CACHED", key, flush=True)
                continue
            print("TRANSCRIBE", key, flush=True)
            result = model.transcribe(audio, language=language, verbose=None, word_timestamps=True,
                condition_on_previous_text=False, temperature=0, regroup=False, suppress_silence=True)
            write(output, dict(result.to_dict(), evidence=metadata))
        elif opts.mode == "align":
            transcript = json.loads((folder / (key + ".transcribe.json")).read_text())
            mapping = [{"alignmentText": line["text"]} for line in data["lines"]]
            found = anchors(mapping, transcript, language == "ja")
            if suffix == "en" and sum(a["coverage"] for a in found) / len(found) < .45:
                raise ValueError("English cover source differs from the sung lyrics; supply corrected cover-specific text before alignment")
            windows = []
            for i, (line, anchor) in enumerate(zip(data["lines"], found)):
                # Low-coverage repeated phrases keep their existing neighborhood;
                # independent recognition must not move a refrain to another repeat.
                reliable = anchor["coverage"] >= .45 and anchor["start"] is not None and (
                    line.get("start") is None or abs(anchor["start"]-line["start"]) < 5)
                previous = next((a for a in reversed(found[:i]) if a["coverage"] >= .45 and a["end"] is not None), None)
                following = next((a for a in found[i+1:] if a["coverage"] >= .45 and a["start"] is not None), None)
                fallback_start = line.get("start", previous["end"] if previous else 0)
                fallback_end = line.get("end", following["start"] if following else metadata["duration"])
                start = max(0, (anchor["start"] if reliable else fallback_start) - .55)
                end = min(metadata["duration"], (anchor["end"] if reliable else fallback_end) + .65)
                windows.append({"start": start, "end": end, "text": line["text"]})
            for left, right in zip(windows, windows[1:]):
                if left["end"] > right["start"]:
                    left["end"] = right["start"] = (left["end"]+right["start"])/2
            if any(w["end"] <= w["start"] for w in windows):
                raise ValueError("Acoustic neighborhoods cross; inspect " + key)
            write(folder / (key + ".anchors.json"), {"anchors": found, "windows": windows})
            print("ALIGN", key, flush=True)
            aligned = model.align_words(audio, windows, language=language, verbose=None,
                normalize_text=False, suppress_silence=True)
            value = aligned.to_dict()
            value["evidence"] = dict(metadata, method="Independent ASR plus bounded phrase forced alignment")
            write(output, value)
            if suffix == "jp":
                roman_windows = []
                for window, companion in zip(windows, data["translations"]):
                    words = companion["romaji"].lower().split()
                    pronunciations = [romkan2.to_hiragana(re.sub(r"nn(?=[aiueoy])", "n'n", word)) for word in words]
                    roman_windows.append(dict(window, text=" ".join(pronunciations)))
                roman = model.align_words(audio, roman_windows, language="ja", verbose=None,
                    normalize_text=False, suppress_silence=True)
                write(folder / (key + ".romaji.json"), roman.to_dict())
        else:
            aligned = json.loads((folder / (key + ".align.json")).read_text())
            flat = [w for seg in aligned["segments"] for w in seg["words"]]
            roman = json.loads((folder / (key + ".romaji.json")).read_text()) if suffix == "jp" else None
            roman_flat = [w for seg in roman["segments"] for w in seg["words"]] if roman else []
            repairs = json.loads((ROOT / "songs/lyrics/alignment-repairs.json").read_text()).get(key, {})
            reviews = []
            def take(words, text):
                taken, content = [], ""
                while len(content) < len(canonical(text)) and words:
                    word = words.pop(0)
                    content += canonical(word["word"])
                    taken.append(word)
                if content != canonical(text):
                    raise ValueError("Acoustic text differs from source")
                return taken
            for i, line in enumerate(data["lines"]):
                original_line = copy.deepcopy(line)
                heard = take(flat, line["text"])
                # Japanese glyph groups can share a token, but are never stretched
                # proportionally to text length; preserve the measured token span.
                tokens, _ = group_words([w["word"] for w in line["words"]], heard)
                line["words"] = [dict(word=w["text"], start=w["start"], end=w["end"]) for w in tokens]
                for repair in repairs.get("wordIntervals", []):
                    if repair["line"] != i+1:
                        continue
                    matches = [w for w in line["words"] if canonical(w["word"]) == canonical(repair["text"])]
                    if len(matches) != 1:
                        raise ValueError(f"Ambiguous repair target {key} {i+1}")
                    matches[0]["start"], matches[0]["end"] = repair["start"], repair["end"]
                    reviews.append({"line": i+1, "acousticRepair": repair})
                for word_index, word in enumerate(line["words"]):
                    if word["end"] <= word["start"] or (word_index and word["start"] < line["words"][word_index-1]["end"]):
                        raise ValueError(f"Invalid measured word interval {key} {i+1}")
                line["start"], line["end"] = line["words"][0]["start"], line["words"][-1]["end"]
                if suffix == "jp":
                    companion = data["translations"][i]
                    display = companion["romaji"].split()
                    kana = [romkan2.to_hiragana(re.sub(r"nn(?=[aiueoy])", "n'n", word.lower())) for word in display]
                    heard_roman = take(roman_flat, "".join(kana))
                    groups, _ = group_words(kana, heard_roman)
                    at, timed = 0, []
                    for group in groups:
                        count = len(group["text"].split())
                        timed.append(dict(word=" ".join(display[at:at+count]), start=group["start"], end=group["end"]))
                        at += count
                    if at != len(display):
                        raise ValueError("Romaji content lost")
                    companion["words"] = timed
                    line["start"] = min(line["start"], timed[0]["start"])
                    line["end"] = max(line["end"], timed[-1]["end"])
                if i and line["start"] < data["lines"][i-1]["end"]:
                    raise ValueError(f"Overlapping vocal lines {key} {i+1}")
                reviews.append({"line": i+1, "old": [original_line.get("start"), original_line.get("end")],
                    "measured": [line["start"], line["end"]]})
            data["duration"] = metadata["duration"]
            data["alignment"] = aligned["evidence"]
            if repairs:
                data["alignment"]["repairs"] = repairs
            if suffix == "en" and aligned["evidence"].get("sourceSha256") != metadata.get("sourceSha256"):
                raise ValueError("Source text changed after alignment; rerun align before materializing")
            checks = json.loads((folder / (key + ".anchors.json")).read_text())["anchors"]
            data["alignment"]["lowRecognitionCoverageLines"] = [i+1 for i, check in enumerate(checks[:43] if suffix == "jp" else checks) if check["coverage"] < .45]
            if suffix == "jp":
                # The old builder appended four artificial refrain repeats.
                # Full-recording recognition and the separate 94-120s / 115-145s
                # excerpts find the final sung phrase at ~99.8s, then instruments.
                tail_check = folder / (key + ".check-tail.json")
                if not tail_check.exists():
                    raise ValueError("Verify the instrumental ending with check-tail before materializing")
                data["lines"] = data["lines"][:43]
                data["translations"] = data["translations"][:43]
                data["alignment"]["removedSyntheticEndingRepeats"] = [44, 45, 46, 47]
                data["alignment"]["endingEvidence"] = tail_check.name
            data["timingMethod"] = "Recording-specific independent recognition and bounded acoustic alignment; not text-length interpolation. Local audition candidate."
            if suffix == "jp":
                data["translationMethod"] = "Existing Japanese, romaji and English preserved; Japanese and romaji acoustically timed, English phrase-level meaning translation."
            write(target, data)
            write(folder / (key + ".review.json"), reviews)
        print("DONE", key, opts.mode, flush=True)
        if model:
            mx.clear_cache()


if __name__ == "__main__":
    main()
