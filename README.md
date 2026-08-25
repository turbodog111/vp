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
- Loop modes: off / loop all / loop one
- Keyboard shortcuts: `Space` play-pause, `Shift+←/→` prev/next, `L` cycle loop, `S` shuffle
- Search filter, volume control with persistence, media-key support (lock screen / headphones)

## Notes

- GitHub recommends repos stay under 1 GB. If your library grows past that, switch to [Git LFS](https://git-lfs.com/) for the audio files.
- Individual files >100 MB will be rejected by git.
- The GitHub API allows 60 unauthenticated requests per IP per hour — plenty for normal use.
- Playlists are per-browser since they live in `localStorage`. Export/import is not implemented yet.

## Lyric timing checks

Run `python3 scripts/audit_lyrics.py` after changing a supported-song timeline. The audit verifies every mapped recording, media duration, line boundary, word boundary, and displayed lyric against its timed words.

## Lyrics intake

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
