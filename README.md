# vp

Personal music player. Static site, no backend. Secular songs live in `songs/`, Christian songs live in `songs/christian/`, and playlists live in your browser.

Live at: https://turbodog111.github.io/vp/

## Adding songs

1. Drop secular `.m4a` files into `songs/` and Christian `.m4a` files into `songs/christian/`. MP3 originals can live in the `mp3-backup/` folders.
2. For nicer display, name them `Artist - Title.m4a` (the dash is parsed for the now-playing label).
3. Commit and push:
   ```
   git add songs/
   git commit -m "add songs"
   git push
   ```
4. Hit the ↻ button in the app (or refresh) to pick up new tracks.

## Features

- Auto-discovers every `.m4a` or `.mp3` in `songs/` and `songs/christian/` via the GitHub contents API, preferring `.m4a` when both exist
- Filter the library by All / Secular / Christian
- Create / delete playlists (stored in `localStorage`)
- Add/remove songs to playlists from the library
- Play a playlist in order or shuffle it
- Six-band equalizer with automatically saved per-song profiles and a reload-cleared temporary all-song override
- Queue recovery retries a failed track in place instead of silently skipping it
- FX-gated, recording-specific timed lyrics and custom Now Playing scenes for supported songs
- Petal Lament and Marshmary have distinct in-app scenes under the FX toggle, driven by precomputed recording-specific audio envelopes and the native playback clock
- Loop modes: off / loop all / loop one
- Keyboard shortcuts: `Space` play-pause, `Shift+←/→` prev/next, `L` cycle loop, `S` shuffle
- Search filter, volume control with persistence, media-key support (lock screen / headphones)

## Notes

- GitHub recommends repos stay under 1 GB. If your library grows past that, switch to [Git LFS](https://git-lfs.com/) for the audio files.
- Individual files >100 MB will be rejected by git.
- The GitHub API allows 60 unauthenticated requests per IP per hour — plenty for normal use.
- Playlists are per-browser since they live in `localStorage`. Export/import is not implemented yet.

## Recording-specific scene data

Petal Lament, Marshmary, Dynamite, and Butter live in `song-motion-fx.js`; their audio/artwork provenance
and measured timing are in `songs/motion/SOURCES.txt`. They do not register
desktop wallpaper theaters. Rebuild their motion JSON with
`python3 scripts/build_song_motion.py <audio.m4a> <motion.json> --bpm <tempo-family>` using
NumPy, SciPy, and FFmpeg. Run `node --test scripts/test_song_motion_fx.cjs` after edits.
The optional BPM hint resolves half/double-time ambiguity; exact tempo and phase
are fitted to the selected recording. Visuals use the native playback clock,
bounded canvas drawing, the existing frame limiter, and reduced-motion settings.
These are energy-driven scenes, not guessed lyric/chorus timelines.

## Lyric timing checks

`node scripts/audit_lyric_coverage.cjs` lists Vocaloid-related and BTS recordings
with missing language coverage. `--check` deliberately fails until those gaps
are supplied; this is separate from validating existing timelines. English
recordings do not require invented romaji. Japanese Window View has romaji and
English companions translated from its existing Japanese text, displayed for
the original line interval without inventing translated-word timestamps.

Run `python3 scripts/audit_lyrics.py` after changing a supported-song timeline. The audit verifies every mapped recording, media duration, line boundary, word boundary, and displayed lyric against its timed words.

## Lyrics intake

### Local lyric studio

The Lyrics tab edits a per-recording local draft using VP's existing player.
Seven user-supplied text packets are available through **Load prepared text**.
They have no assigned timestamps and do not replace published lyrics.
Separate acoustic timelines for those seven exact recordings now load
automatically under **FX for supported songs**. Joshua approved these timelines
and both Window View renditions for publication on 2026-10-23.
They use measured source-language word groups;
meaning translations remain phrase companions. Unmeasurable individual tokens
are kept in neighboring acoustic groups rather than given invented timestamps.
Drafts save in this browser, support JSON import/export, and can preview over
the current graphics only with **Preview local draft** and **FX for supported
songs** enabled. Invalid or untimed drafts never render as synchronized lyrics.
Japanese uses romaji/English with optional Japanese text; mixed Chinese/English
uses pinyin. See `LYRIC_IMPLEMENTATION.txt` for pending sources, review flags,
the recording-specific alignment checklist, and the draft schema.

The aligned timelines live in `songs/lyrics/aligned/`. Their audio SHA-256,
timing method, corrections and unresolved review notes are embedded in each file.
Rebuild them from the local evidence with `python3 scripts/materialize_aligned_lyrics.py
../lyric-alignment-20261022`. The evidence directory contains independent ASR,
whole-song and phrase-constrained alignment passes, plus short excerpt checks.
The local preview uses the existing VP server at `http://127.0.0.1:4187/`.
Rebuilding creates fresh unapproved candidates; review and obtain approval again
before replacing the accepted timelines. The originals and evidence stay local.

Regenerate the prepared packets with `node scripts/prepare_lyric_drafts.cjs`
after editing their user-supplied source table. Test with
`node --test scripts/test_lyric_workbench.cjs scripts/test_lyric_coverage.cjs`.

`scripts/lyrics_intake.py` searches LRCLIB and stages a selected synchronized lyric record without touching the checked-in theater data. Search results print metadata only; retrieved `.lrc` files and provenance sidecars go into the git-ignored `.lyrics-inbox/` directory for review.

```sh
# Find candidates. Duration materially improves match quality.
python3 scripts/lyrics_intake.py search \
  --title "Track title" --artist "Artist" --duration 180.2

# Retrieve the candidate you selected from the metadata list.
python3 scripts/lyrics_intake.py fetch --id 123456

# Or allow staging only when the best synchronized match is unambiguous.
python3 scripts/lyrics_intake.py auto \
  --title "Track title" --artist "Artist" --duration 180.2
```

The source sidecar records the provider ID, source URL, recording metadata, retrieval time, content hash, and review status. Review the title, artist, duration, and recording alignment before promoting any staged text into `songs/lyrics/*.json`; the intake tool never overwrites those files.
