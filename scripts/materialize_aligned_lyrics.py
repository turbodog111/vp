"""Build reviewable VP timelines from preserved acoustic alignment evidence."""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def canonical(text):
    return "".join(c for c in unicodedata.normalize("NFKC", text).lower() if c.isalnum())


def group_words(targets, aligned):
    """Group acoustic token spans at source-word boundaries, without uniform spacing."""
    source = "".join(canonical(word["word"]) for word in aligned)
    wanted = "".join(canonical(word) for word in targets)
    if source != wanted:
        raise ValueError("Alignment token content does not match the source text")
    spans = []
    offset = 0
    for word in aligned:
        size = len(canonical(word["word"]))
        if size:
            spans.append((offset, offset + size, word))
        offset += size
    groups = []
    offset = 0
    for target in targets:
        size = len(canonical(target))
        members = [word for start, end, word in spans if start < offset+size and end > offset]
        if not members:
            if groups:
                groups[-1]["text"] += " " + target
            continue
        start, end = min(w["start"] for w in members), max(w["end"] for w in members)
        if groups and start < groups[-1]["end"]:
            groups[-1]["text"] += " " + target
            groups[-1]["end"] = max(groups[-1]["end"], end)
        else:
            groups.append({"text": target, "start": start, "end": end})
        offset += size
    # A zero-duration token has no independently measured onset. Retain its text
    # in a neighboring measured group instead of inventing a duration for it.
    clean = []
    prefix = []
    grouped = 0
    for group in groups:
        if group["end"] <= group["start"]:
            grouped += 1
            if clean:
                clean[-1]["text"] += " " + group["text"]
            else:
                prefix.append(group["text"])
        else:
            if prefix:
                group["text"] = " ".join(prefix + [group["text"]])
                prefix = []
            clean.append(group)
    if prefix or not clean:
        raise ValueError("Line has no measured vocal interval")
    return clean, grouped


def build(entry, evidence):
    key = Path(entry["file"]).stem
    mapping = json.loads((evidence / "inputs" / (key + ".map.json")).read_text())
    result = json.loads((evidence / "evidence" / (key + ".bounded.json")).read_text())
    anchors = json.loads((evidence / "evidence" / (key + ".anchors.json")).read_text())["anchors"]
    flat = [word for segment in result["segments"] for word in segment["words"]]
    global_result = json.loads((evidence / "evidence" / (key + ".align.json")).read_text())
    repair_file = ROOT / "songs/lyrics/alignment-repairs.json"
    repairs = json.loads(repair_file.read_text()).get(key, {}) if repair_file.exists() else {}
    rows = []
    reviews = []
    cursor = 0
    for index, item in enumerate(mapping):
        target = canonical(item["alignmentText"])
        matched = ""
        words = []
        while len(matched) < len(target) and cursor < len(flat):
            word = flat[cursor]
            words.append(word)
            matched += canonical(word["word"])
            cursor += 1
        if matched != target:
            raise ValueError(f"{key} line {index+1}: acoustic token map differs")
        clip_source = next((c for c in repairs.get("sourceClips", []) if c["line"] == index+1), None)
        fallback = global_result["segments"][index]["words"]
        if clip_source:
            clips = json.loads((evidence / "evidence" / clip_source["file"]).read_text())
            words = clips[clip_source["clip"]]["segments"][clip_source["segment"]]["words"]
            if canonical("".join(w["word"] for w in words)) != target:
                raise ValueError(f"{key} line {index+1}: clip source does not match")
            reviews.append({"line": index+1, "issue": "Background entrance measured in an English-language vocal excerpt"})
        elif index+1 in repairs.get("useGlobalRows", []) or (
            all(w["end"] <= w["start"] for w in words)
            and any(w["end"] > w["start"] for w in fallback)
        ):
            if canonical("".join(w["word"] for w in fallback)) != target:
                raise ValueError(f"{key} line {index+1}: fallback source does not match")
            words = fallback
            reviews.append({"line": index+1, "issue": "Used valid whole-recording alignment after bounded pass failure"})
        lane = item["lane"]
        display = item["textWords"]
        if lane == "romaji":
            pronunciation, grouped = group_words(item["pronunciationWords"], words)
            # Kana token spans correspond to source romaji words by character
            # boundaries. Grouped words keep their complete acoustic interval.
            positions, at = [], 0
            for token in pronunciation:
                count = len(token["text"].split())
                positions.append(dict(token, text=" ".join(display[at:at+count])))
                at += count
            if at != len(display):
                raise ValueError(f"{key} line {index+1}: pronunciation grouping differs")
            timed = positions
        else:
            timed, grouped = group_words(display, words)
        for correction in repairs.get("wordIntervals", []):
            if correction["line"] != index+1:
                continue
            matches = [word for word in timed if canonical(word["text"]) == canonical(correction["text"])]
            if len(matches) != 1:
                raise ValueError(f"{key} line {index+1}: correction target ambiguous")
            matches[0]["start"], matches[0]["end"] = correction["start"], correction["end"]
            reviews.append({"line": index+1, "issue": "Rest boundary corrected from independent word-timestamp recognition"})
        row = copy.deepcopy(item["row"])
        if "[source wording uncertain]" in row["en"]:
            row["en"] = row["en"].replace(" [source wording uncertain]", "")
            reviews.append({"line": index+1, "issue": "Provisional translation depends on uncertain source spelling; review before publishing"})
        row["words"] = {lane: timed}
        row["start"], row["end"] = timed[0]["start"], timed[-1]["end"]
        if rows and row["start"] < rows[-1]["end"]:
            raise ValueError(f"{key} line {index+1}: acoustic rows overlap")
        if grouped:
            reviews.append({"line": index+1, "issue": "Acoustically inseparable tokens retained as measured groups", "groups": grouped})
        if anchors[index]["coverage"] < .35:
            reviews.append({"line": index+1, "issue": "Low independent-transcript match; audition this phrase", "coverage": round(anchors[index]["coverage"],3)})
        if row["end"] - row["start"] > 12:
            reviews.append({"line": index+1, "issue": "Long phrase or held note; audition end boundary"})
        if lane == "zh":
            if canonical(row["en"]) == canonical(row["zh"]):
                row["words"]["en"] = copy.deepcopy(timed)
            if canonical(row["pinyin"]) == canonical(row["zh"]):
                row["words"]["pinyin"] = copy.deepcopy(timed)
        for word in timed:
            word["start"] = round(word["start"],3)
            word["end"] = round(word["end"],3)
        row["start"] = round(row["start"],3)
        row["end"] = round(row["end"],3)
        if lane == "en":
            parts = [[]]
            for word in timed:
                if parts[-1] and word["start"] - parts[-1][-1]["end"] > 1.4:
                    parts.append([])
                parts[-1].append(word)
            for part_index, part in enumerate(parts):
                split = copy.deepcopy(row)
                if len(parts) > 1:
                    split["id"] += f"-part-{part_index+1}"
                    split["en"] = " ".join(word["text"] for word in part)
                    split["words"] = {"en": part}
                    split["start"], split["end"] = part[0]["start"], part[-1]["end"]
                rows.append(split)
        else:
            rows.append(row)
    duration = result["evidence"]["duration"]
    language = json.loads((ROOT / "songs/lyrics/drafts" / entry["file"]).read_text())["language"]
    return {"schemaVersion": 1, "recording": entry["recording"], "language": language,
        "duration": duration, "preview": False,
        "source": "Joshua's supplied text; recording-specific MLX Whisper large-v3-turbo / stable-ts acoustic alignment. Local audition candidate, not approved. Companion translations are provisional meaning translations.",
        "rows": rows, "alignment": {**result["evidence"], "status": "local-review", "approved": False,
            "sourceText": "../drafts/" + entry["file"], "reviewNotes": reviews,
            "repairs": repairs}}, reviews


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence", type=Path)
    parser.add_argument("ids", nargs="*")
    opts = parser.parse_args()
    output = ROOT / "songs/lyrics/aligned"
    output.mkdir(exist_ok=True)
    manifest = []
    failures = []
    for entry in json.loads((ROOT / "songs/lyrics/drafts/manifest.json").read_text()):
        key = Path(entry["file"]).stem
        if opts.ids and key not in opts.ids:
            continue
        try:
            data, reviews = build(entry, opts.evidence)
            (output / entry["file"]).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
            manifest.append({"recording": entry["recording"], "file": entry["file"], "lines": len(data["rows"]), "status": "local-review", "audioSha256": data["alignment"]["audioSha256"]})
            print(key, len(data["rows"]), "lines", len(reviews), "review notes")
        except (ValueError, FileNotFoundError) as error:
            failures.append({"song": key, "error": str(error)})
            print("NEEDS REPAIR", key, str(error))
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (opts.evidence / "materialization-issues.json").write_text(json.dumps(failures, indent=2) + "\n")
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
