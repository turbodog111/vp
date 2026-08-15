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
- Loop modes: off / loop all / loop one
- Keyboard shortcuts: `Space` play-pause, `Shift+←/→` prev/next, `L` cycle loop, `S` shuffle
- Search filter, volume control with persistence, media-key support (lock screen / headphones)

## Notes

- GitHub recommends repos stay under 1 GB. If your library grows past that, switch to [Git LFS](https://git-lfs.com/) for the audio files.
- Individual files >100 MB will be rejected by git.
- The GitHub API allows 60 unauthenticated requests per IP per hour — plenty for normal use.
- Playlists are per-browser since they live in `localStorage`. Export/import is not implemented yet.
