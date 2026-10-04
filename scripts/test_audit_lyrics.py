import math
import unittest

import audit_lyrics as audit


class LyricAuditTests(unittest.TestCase):
    def test_new_parallel_songs_are_mapped(self):
        files = {name for name, _, _ in audit.TRACKS}
        self.assertTrue({"magic-maid.json", "trick-heart.json"} <= files)

    def test_parallel_lanes_validate_without_fabricating_word_times(self):
        line = {"start": 1, "end": 2, "jp": ["example"], "romaji": ["example"], "en": ["example"]}
        errors, words = audit.audit_timeline("test", [line], 3)
        self.assertEqual(errors, [])
        self.assertEqual(words, 0)

    def test_parallel_lane_corruption_is_an_error(self):
        for lane in ([], [" "], [42], "not a token array"):
            line = {"start": 1, "end": 2, "jp": ["example"], "romaji": lane}
            errors, _ = audit.audit_timeline("test", [line], 3)
            self.assertTrue(errors)

    def test_nonfinite_times_are_rejected(self):
        for start in (-1, math.nan, math.inf, True):
            errors, _ = audit.audit_timeline("test", [{"start": start, "end": 3}], 4)
            self.assertTrue(errors)

    def test_variant_parallel_lane_is_checked_alongside_explicit_words(self):
        line = {"start": 1, "end": 2, "text": "example",
                "words": [{"word": "example", "start": 1, "end": 2}],
                "romaji": [None]}
        errors, _ = audit.audit_timeline("test", [line], 3)
        self.assertTrue(any("romaji" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
