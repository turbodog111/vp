#!/usr/bin/env python3
"""Focused unit tests for the lyrics intake matching and staging safeguards."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lyrics_intake as intake


class LyricsIntakeTests(unittest.TestCase):
    def test_exact_synced_duration_match_scores_highest(self):
        exact = {
            "id": 1,
            "trackName": "Example Song",
            "artistName": "Example Artist",
            "duration": 180.2,
            "syncedLyrics": "[00:01.00]Example",
        }
        cover = {
            "id": 2,
            "trackName": "Example Song (Live)",
            "artistName": "Another Artist",
            "duration": 205,
            "syncedLyrics": "[00:01.00]Example",
        }
        exact_score = intake.candidate_score(exact, "Example Song", "Example Artist", 180)
        cover_score = intake.candidate_score(cover, "Example Song", "Example Artist", 180)
        self.assertGreaterEqual(exact_score, 100)
        self.assertGreater(exact_score, cover_score)

    def test_metadata_view_never_contains_lyric_bodies(self):
        view = intake.metadata_view(
            {
                "id": 7,
                "trackName": "Song",
                "artistName": "Artist",
                "syncedLyrics": "[00:01.00]private body",
                "plainLyrics": "private body",
            }
        )
        self.assertNotIn("syncedLyrics", view)
        self.assertNotIn("plainLyrics", view)
        self.assertTrue(view["hasSyncedLyrics"])

    def test_stage_writes_lrc_and_provenance(self):
        record = {
            "id": 42,
            "trackName": "Example Song",
            "artistName": "Example Artist",
            "albumName": "Examples",
            "duration": 10.0,
            "syncedLyrics": "[00:01.00]First line\n[00:05.50]Second line",
        }
        with tempfile.TemporaryDirectory() as directory:
            staged = intake.stage_record(record, Path(directory))
            self.assertTrue(staged.lyrics_path.is_file())
            source = json.loads(staged.metadata_path.read_text(encoding="utf-8"))
            self.assertEqual(source["providerRecordId"], 42)
            self.assertEqual(source["reviewStatus"], "unreviewed")
            with self.assertRaises(intake.IntakeError):
                intake.stage_record(record, Path(directory))

    def test_rejects_out_of_order_lrc(self):
        with self.assertRaises(intake.IntakeError):
            intake.validate_lrc("[00:10.00]Later\n[00:05.00]Earlier\n")


if __name__ == "__main__":
    unittest.main()
