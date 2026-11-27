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
- Saved library filters choose which songs the Library shows (see below)
- Ten themes (seven dark, three light), four typefaces plus the device's own, a compact song list and an optional background glow, under Settings → Appearance
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

## Library filters

**Choose songs** in the Library turns on tick boxes: untick the songs you don't want to
see, or use **Hide all** / **Show all** (after a search or a collection tab they act only on
the songs listed, e.g. "Show these 13"). The choice saves as you go, under a name you can
change, and the **Showing** menu switches between saved filters and **All songs**. A filter
hides songs from the Library, its counts, search, and playback started from the Library;
playlists are not affected. Each filter also says what happens to **songs added later**:
they show, or they stay hidden and the Library names them with a one-click **Show** /
**Keep hidden** choice. Filters live in this browser's `localStorage`
(`vp_library_filters_v1`). Run `node --test scripts/test_library_filters.cjs` after edits.

## Appearance

Settings → Appearance (also the **Appearance** row in the quick menu) picks a theme, a
typeface, Comfortable or Compact song rows, and the background glow. Each theme is a set of
colour tokens under `[data-look="…"]` in `styles.css`; its text meets WCAG AA on every
background. In the light themes the app is light but Now Playing stays a dark stage,
because the song scenes and the visualizer are drawn for a dark backdrop. A song's own
accent colour tints Now Playing only; the rest of the app keeps the chosen theme. The
`<head>` script in `index.html` applies the saved choices before the page first paints.
Run `node --test scripts/test_appearance.cjs` after adding or changing a theme.

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

The original Your Reality, Caleb Hyles's cover, and The Juicebox feat. Vannamelon's pop-punk cover share
`your-reality-fx.js` (a letter written by a window); FalKKonE feat. Rena uses
`your-reality-metal-fx.js` (a concert hall). Each recording has its own measured
beat and amplitude data. The scenes also read the recording's synchronized
lyric file in `songs/lyrics/aligned/`, keeping only when each word is sung and how many
letters it has; the words themselves never reach the scene. In the letter, the pen writes
one handwritten word for each sung word and rests when nobody is singing. The pop-punk
cover's spoken intro is preserved without starting the letter. A full page
breaks into drifting pixels before the next is written, the window light moves from
afternoon to dusk, and the letter is sealed after the last line. In the hall, a score
scrolls past a playhead: a note crosses it as each word is sung, and a bar line crosses
it on each downbeat. Note heights are decorative; only their timing is measured. Organ
pipes and floor echoes follow the measured bass hits, and the candles are left burning
at the end. If a lyric file cannot be read, the letter writes on the measured beat
instead.

## Music videos

Free, demons, Can't Steal My Joy, the three Mesmerizer recordings, both Kuu ni Naru
recordings, and the My Way, So What! theatre are full music videos under
**FX for supported songs**: `free-fx.js`, `demons-fx.js`, `joy-fx.js`,
`mesmerizer-fx.js`, `kuu-fx.js` and `my-way-fx.js`, sharing `mv-kit.js`. Each scene
changes shot at the recording's measured sections and moves on its measured beat.
Every frame is a pure function of media time and the recording's motion data, so
pause, seek and replay always show the same picture, and nothing accumulates.
Section structure comes from
`python3 scripts/build_song_sections.py <audio.m4a> <motion.json>`, which adds a
`structure` list (audio structure, not lyric timing) without changing the envelopes.
My Way, So What! keeps its official video: the **Theatre / Video** switch on Now
Playing chooses per song, and the choice is remembered in this browser.
Run `node --test scripts/test_music_videos.cjs` after edits.

The three Encore Dance recordings (MIMI, Moonlit Star and Evil) have a 3D
anime-style music video, `encore-dance-mv.js`, drawn with VP's small WebGL2 kit
`mv3d.js`: cel-shaded models with ink outlines, extruded 3D lettering, light beams,
a mirrored stage floor, bloom and speed lines. The lyrics lead: each line flies in
as 3D type above the stage, every character pops and lights up as it is sung
(from the measured word timing), with romaji above and the English translation
below. One dancer (a sculpted idol with a painted anime face, layered hair, a
swinging ponytail and a pleated dress) performs behind the words in a theatre
that changes with each section. LED screens on the back wall and on two towers at
the sides, footlights, streamers and drifting lights keep the whole frame moving,
while the wall stays calm behind the lyrics. Every cut has a reason: a new
section, the beat before a new line is sung, or the next figure of the dance
break. Inside a shot the camera makes one slow move with a purpose (it settles in
front of a line, glides along with the karaoke, walks with the dancer, rises to
the moon, or pulls back as a chorus ends), always keeping the whole line in frame
and facing it. Under Reduce motion it holds one
still camera per section, the lettering stays still and nothing flashes. The
title, artist, play button and times stay on screen; the text lyrics remain for
screen readers. Without WebGL2 the theatre falls back to the flat stage in
`encore-remaster-fx.js`. Run `node --test scripts/test_encore_dance_mv.cjs` after edits.

The three Mesmerizer recordings have a 3D pop-art music video, `mesmerizer-mv.js`
("Hypno Broadcast"), with no characters. It is a retro TV broadcast that changes
channel at each of the recording's measured chapters:
- a TV powers on;
- a carousel of TVs turns in an on-air studio under a giant spiral;
- the camera dives through a screen into a spiral tunnel;
- channel surfing along a stacked wall of TVs;
- a chorus vortex circled by the title in 3D;
- a giant eye follows a swinging pocket watch;
- a video wall whose screens join into one picture;
- power-off.

Cuts land on the beat and follow the action (the next TV, a channel flip, the
watch's swing), and the screens' patterns, TV static and halftone dots are drawn
by `mv3d.js`. Each recording keeps its own palette. No Mesmerizer recording has a
timed lyric file yet; when one does, its lines fly in as 3D lettering in front of
every scene. Without WebGL2 the flat 2D broadcast in `mesmerizer-fx.js` draws
instead. Run `node --test scripts/test_mesmerizer_mv.cjs` after edits.

Trick Heart (MIMI feat. Kasane Teto SV) has a 3D music video, `trick-heart-mv.js`
("The Card Trick"), with no characters. It is a parlour magic show around a velvet
card table, and the lyrics lead: each line floats above the table as 3D type, with
romaji above and the English below, lighting up as it is sung. The props tell the
story:
- an ace of hearts hovers over the table and vanishes when its line is sung;
- the curtain rises on a giant fan of cards that flips in waves through the
  choruses, while cards pour down both sides of the frame;
- cards fountain out of a top hat in the interlude;
- a house of cards is built on the beat through the second verse;
- the house collapses in the quiet reveal to show a glowing heart;
- a tornado of cards circles the heart in the final chorus.

Every cut lands on the beat and has a reason (a new section, a new line, the next
bar of an instrumental), and the camera always keeps the whole line in frame. The
text lyrics remain for screen readers. Without WebGL2 the 2D stage draws instead.
Run `node --test scripts/test_trick_heart_mv.cjs` after edits.

The 3D videos share their lyric lettering (layout, karaoke timing and the extruded
type) through `mv-lyrics3d.js`.

## Cover art

Every song has original drawn cover art in `songs/covers/` (one small SVG per song;
all versions of a song share it). `songs/covers/covers.json` maps each cover to song
titles with version notes removed — "Encore Dance: Piano Hyperpop" and "Encore Dance
(Japanese)" both become `encore dance` (see `coverKeyForTitle` in `app.js`). A new
version of an existing song picks up its cover automatically; a new song shows a
lettered tile until it gets a cover and a key in `covers.json`. Run
`node --test scripts/test_song_covers.cjs` after adding songs or covers.

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
