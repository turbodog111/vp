#!/usr/bin/env python3
"""Search and stage synchronized lyrics without modifying VP theater data.

The tool deliberately separates discovery from retrieval:

  search  - list metadata-only candidates
  fetch   - retrieve one explicitly selected LRCLIB record
  auto    - retrieve only a high-confidence title/artist/duration match

Fetched files are written to .lyrics-inbox/ by default. They must be reviewed
and aligned before being promoted into songs/lyrics/*.json.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INBOX = ROOT / ".lyrics-inbox"
BASE_URL = "https://lrclib.net"
CLIENT_ID = "vp-lyrics-intake/1.0 (https://github.com/turbodog111/vp)"
REQUEST_DELAY_SECONDS = 0.3


class IntakeError(RuntimeError):
    """A user-facing lyrics intake failure."""


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").casefold()
    return " ".join(re.findall(r"[a-z0-9]+", value))


def slugify(value: str) -> str:
    slug = normalize(value).replace(" ", "-")
    return slug[:100] or "lyrics"


def duration_delta(candidate: dict, wanted: float | None) -> float | None:
    if wanted is None:
        return None
    try:
        return abs(float(candidate.get("duration")) - wanted)
    except (TypeError, ValueError):
        return None


def token_similarity(left: str, right: str) -> float:
    a = set(normalize(left).split())
    b = set(normalize(right).split())
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def candidate_score(candidate: dict, title: str, artist: str, duration: float | None) -> float:
    candidate_title = candidate.get("trackName") or candidate.get("name") or ""
    candidate_artist = candidate.get("artistName") or ""
    wanted_title = normalize(title)
    actual_title = normalize(candidate_title)
    score = 0.0

    if wanted_title and wanted_title == actual_title:
        score += 55
    elif wanted_title and (wanted_title in actual_title or actual_title in wanted_title):
        score += 32
    else:
        score += 25 * token_similarity(title, candidate_title)

    artist_similarity = token_similarity(artist, candidate_artist)
    score += 25 * artist_similarity

    delta = duration_delta(candidate, duration)
    if delta is not None:
        if delta <= 2.0:
            score += 20
        elif delta <= 5.0:
            score += 10
        elif delta <= 12.0:
            score += 3
        else:
            score -= min(20, delta / 2)

    if candidate.get("syncedLyrics"):
        score += 12
    elif candidate.get("plainLyrics"):
        score += 3
    if candidate.get("instrumental"):
        score -= 100
    return round(score, 2)


def request_json(path: str, query: dict[str, object] | None = None) -> object:
    url = BASE_URL + path
    if query:
        encoded = urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
        url += "?" + encoded
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Lrclib-Client": CLIENT_ID,
            "User-Agent": CLIENT_ID,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code == 404:
            raise IntakeError("LRCLIB did not find that lyrics record.") from error
        if error.code == 429:
            retry_after = error.headers.get("Retry-After", "a short while")
            raise IntakeError(f"LRCLIB rate limit reached; retry after {retry_after}.") from error
        raise IntakeError(f"LRCLIB returned HTTP {error.code}.") from error
    except urllib.error.URLError as error:
        raise IntakeError(f"Could not reach LRCLIB: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise IntakeError("LRCLIB returned invalid JSON.") from error


def search(title: str, artist: str, duration: float | None) -> list[dict]:
    payload = request_json(
        "/api/search",
        {"track_name": title, "artist_name": artist},
    )
    if not isinstance(payload, list):
        raise IntakeError("LRCLIB search returned an unexpected response.")
    candidates = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        candidate = dict(item)
        candidate["matchScore"] = candidate_score(candidate, title, artist, duration)
        candidate["durationDelta"] = duration_delta(candidate, duration)
        candidates.append(candidate)
    return sorted(candidates, key=lambda item: item["matchScore"], reverse=True)


def metadata_view(candidate: dict) -> dict:
    """Return candidate metadata without copying lyric bodies to the console."""
    return {
        "id": candidate.get("id"),
        "trackName": candidate.get("trackName") or candidate.get("name"),
        "artistName": candidate.get("artistName"),
        "albumName": candidate.get("albumName"),
        "duration": candidate.get("duration"),
        "hasSyncedLyrics": bool(candidate.get("syncedLyrics")),
        "hasPlainLyrics": bool(candidate.get("plainLyrics")),
        "instrumental": bool(candidate.get("instrumental")),
        "matchScore": candidate.get("matchScore"),
        "durationDelta": candidate.get("durationDelta"),
    }


@dataclass(frozen=True)
class StagedLyrics:
    lyrics_path: Path
    metadata_path: Path


def choose_lyrics(record: dict) -> tuple[str, str]:
    synced = record.get("syncedLyrics")
    plain = record.get("plainLyrics")
    if isinstance(synced, str) and synced.strip():
        return synced.strip() + "\n", "synced-lrc"
    if isinstance(plain, str) and plain.strip():
        return plain.strip() + "\n", "plain-text"
    raise IntakeError("The selected LRCLIB record contains no lyrics.")


def validate_lrc(text: str) -> None:
    timestamps = re.findall(r"^\[(\d+):(\d+(?:\.\d+)?)\]", text, flags=re.MULTILINE)
    if not timestamps:
        raise IntakeError("The synchronized record does not contain recognizable LRC timestamps.")
    previous = -1.0
    for minutes, seconds in timestamps:
        current = int(minutes) * 60 + float(seconds)
        if current < previous:
            raise IntakeError("The synchronized record has out-of-order timestamps.")
        previous = current


def stage_record(record: dict, output_dir: Path, force: bool = False) -> StagedLyrics:
    text, kind = choose_lyrics(record)
    if kind == "synced-lrc":
        validate_lrc(text)
    title = record.get("trackName") or record.get("name") or "lyrics"
    artist = record.get("artistName") or "unknown-artist"
    stem = f"{slugify(artist)}--{slugify(title)}--lrclib-{record.get('id', 'unknown')}"
    extension = ".lrc" if kind == "synced-lrc" else ".txt"
    output_dir.mkdir(parents=True, exist_ok=True)
    lyrics_path = output_dir / f"{stem}{extension}"
    metadata_path = output_dir / f"{stem}.source.json"
    if not force and (lyrics_path.exists() or metadata_path.exists()):
        raise IntakeError(f"Staged output already exists: {lyrics_path}")

    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    source = {
        "provider": "LRCLIB",
        "providerRecordId": record.get("id"),
        "providerUrl": f"{BASE_URL}/api/get/{record.get('id')}",
        "trackName": title,
        "artistName": artist,
        "albumName": record.get("albumName"),
        "duration": record.get("duration"),
        "lyricsKind": kind,
        "sha256": digest,
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "reviewStatus": "unreviewed",
        "promotionNote": "Review match and recording alignment before editing songs/lyrics/*.json.",
    }
    lyrics_path.write_text(text, encoding="utf-8")
    metadata_path.write_text(json.dumps(source, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return StagedLyrics(lyrics_path, metadata_path)


def fetch_record(record_id: int) -> dict:
    payload = request_json(f"/api/get/{record_id}")
    if not isinstance(payload, dict):
        raise IntakeError("LRCLIB record returned an unexpected response.")
    return payload


def print_candidates(candidates: list[dict], limit: int, as_json: bool) -> None:
    visible = [metadata_view(item) for item in candidates[:limit]]
    if as_json:
        print(json.dumps(visible, indent=2, ensure_ascii=False))
        return
    if not visible:
        print("No candidates found.")
        return
    for index, item in enumerate(visible, start=1):
        delta = item["durationDelta"]
        delta_label = "n/a" if delta is None else f"{delta:.2f}s"
        lyric_kind = "synced" if item["hasSyncedLyrics"] else "plain" if item["hasPlainLyrics"] else "none"
        print(
            f"{index:>2}. id={item['id']} score={item['matchScore']:.2f} "
            f"duration={item['duration']} delta={delta_label} lyrics={lyric_kind}\n"
            f"    {item['artistName']} - {item['trackName']} [{item['albumName'] or 'no album'}]"
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    search_parser = subparsers.add_parser("search", help="List metadata-only LRCLIB candidates")
    search_parser.add_argument("--title", required=True)
    search_parser.add_argument("--artist", required=True)
    search_parser.add_argument("--duration", type=float)
    search_parser.add_argument("--limit", type=int, default=8)
    search_parser.add_argument("--json", action="store_true")

    fetch_parser = subparsers.add_parser("fetch", help="Stage one explicitly selected LRCLIB record")
    fetch_parser.add_argument("--id", type=int, required=True)
    fetch_parser.add_argument("--output-dir", type=Path, default=DEFAULT_INBOX)
    fetch_parser.add_argument("--force", action="store_true")

    auto_parser = subparsers.add_parser("auto", help="Stage only an unambiguous high-confidence match")
    auto_parser.add_argument("--title", required=True)
    auto_parser.add_argument("--artist", required=True)
    auto_parser.add_argument("--duration", type=float, required=True)
    auto_parser.add_argument("--output-dir", type=Path, default=DEFAULT_INBOX)
    auto_parser.add_argument("--force", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "search":
            candidates = search(args.title, args.artist, args.duration)
            print_candidates(candidates, max(1, args.limit), args.json)
            return 0

        if args.command == "fetch":
            staged = stage_record(fetch_record(args.id), args.output_dir, args.force)
            print(f"Staged lyrics: {staged.lyrics_path}")
            print(f"Staged provenance: {staged.metadata_path}")
            return 0

        candidates = search(args.title, args.artist, args.duration)
        if not candidates:
            raise IntakeError("No LRCLIB candidates found.")
        best = candidates[0]
        runner_up_score = candidates[1]["matchScore"] if len(candidates) > 1 else 0
        delta = best.get("durationDelta")
        confident = (
            best["matchScore"] >= 100
            and best["matchScore"] - runner_up_score >= 8
            and delta is not None
            and delta <= 2.0
            and bool(best.get("syncedLyrics"))
        )
        if not confident:
            print_candidates(candidates, 8, False)
            raise IntakeError("No unambiguous synchronized match; select a record with the fetch command.")
        # Search responses already include the lyric bodies; avoid a second request.
        time.sleep(REQUEST_DELAY_SECONDS)
        staged = stage_record(best, args.output_dir, args.force)
        print(f"Staged high-confidence match id={best.get('id')} score={best['matchScore']:.2f}")
        print(f"Staged lyrics: {staged.lyrics_path}")
        print(f"Staged provenance: {staged.metadata_path}")
        return 0
    except IntakeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
