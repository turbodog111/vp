const REPO_OWNER = 'turbodog111';
const REPO_NAME = 'vp';
const COLLECTIONS = [
  { id: 'secular', label: 'Secular', folder: 'songs' },
  { id: 'christian', label: 'Christian', folder: 'songs/christian' }
];
const COLLECTION_ORDER = new Map(COLLECTIONS.map((collection, index) => [collection.id, index]));
const DEFAULT_PLAYLISTS = {
  'Secular 12': [
    'songs/tripflag - Ochame Kinou (Old Teto).m4a',
    'songs/Farewell225 - Window View.m4a',
    'songs/Moonlit Star - Science (English).m4a',
    'songs/hololive English - Ochame Kinou (English).m4a',
    'songs/Lambie - Machine Love (Drums).m4a',
    'songs/MiliSen - Ever Romantic.m4a',
    'songs/hololive - Ochame Kinou (Japanese).m4a',
    'songs/MIMI - Science.m4a',
    'songs/Moonlit Star - Window View (English).m4a',
    'songs/Jamie Paige - Machine Love.m4a',
    'songs/Kasane Teto SV - Ochame Kinou (New Teto).m4a',
    'songs/Penthouse - One, Two, Three (一二三).m4a',
  ],
  'Hybrid 12': [
    'songs/christian/Forrest Frank - JESUS IS ALIVE.mp3',
    'songs/hololive English - Ochame Kinou (English).m4a',
    'songs/christian/Forrest Frank & Connor Price - UP!.m4a',
    'songs/Jamie Paige - Machine Love.m4a',
    'songs/christian/Forrest Frank - GOOD DAY.m4a',
    'songs/Penthouse - One, Two, Three (一二三).m4a',
    'songs/MIMI - Science.m4a',
    'songs/christian/Forrest Frank - CELEBRATION.m4a',
    'songs/Campus Village - Teto.m4a',
    "songs/christian/Josiah Queen - Can't Steal My Joy feat. Brandon Lake.m4a",
    'songs/christian/Forrest Frank - OKAY!.m4a',
    'songs/hololive - Ochame Kinou (Japanese).m4a',
  ],
  'IN THE ROOM!': [
    'songs/christian/Brandon Lake - INTRO - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - KING OF HEARTS - IN THE ROOM!.m4a',
    "songs/christian/Brandon Lake - COUNT 'EM - IN THE ROOM!.m4a",
    "songs/christian/Brandon Lake - THAT'S WHO I PRAISE - IN THE ROOM!.m4a",
    'songs/christian/Brandon Lake - BUT GOD - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - PLANS - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - RATTLE - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - REST ON US - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - TEAR OFF THE ROOF - IN THE ROOM!.m4a',
    "songs/christian/Brandon Lake - DADDY'S DNA (ACOUSTIC) - IN THE ROOM!.m4a",
    'songs/christian/Brandon Lake - AS FOR ME & MY HOME - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - THE BLESSING - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake & Franni Cash - I KNOW A NAME - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake & Bailey Zimmerman - JUST BELIEVE - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake & Nick Jonas - THE AUTHOR - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake feat. Cody Johnson - WHEN A COWBOY PRAYS - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - LION (ACOUSTIC) - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake & Pat Barrett - SAME GOD (ACOUSTIC) - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake & Pat Barrett - HOLY GHOST - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - HARD FOUGHT HALLELUJAH - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - GRATITUDE - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake, Pat Barrett & Franni Cash - PRAISE - IN THE ROOM!.m4a',
    'songs/christian/Brandon Lake - SEVENS - IN THE ROOM!.m4a',
  ],
};

const $ = (id) => document.getElementById(id);
// Mutable: MediaElementSource permanently hijacks an <audio> node; spatial tracks
// recreate the element to restore true native HTMLAudio routing (QuickTime-like).
let audio = $('audio');

let library = [];
let queue = [];
let queueIndex = -1;
let loopMode = 'off';
let shuffled = false;
let unshuffledQueue = null;
let playlists = loadPlaylists();
let currentPlaylist = null;
let activeCollection = localStorage.getItem('vp_collection') || 'all';
let tetoFxEnabled = localStorage.getItem('vp_teto_fx_enabled') !== 'false';
let fxTheme = ['teto', 'disco', 'teto11'].includes(localStorage.getItem('vp_fx_theme')) ? localStorage.getItem('vp_fx_theme') : 'teto11';
let timingDebugEnabled = localStorage.getItem('vp_timing_debug_enabled') === 'true';
let addToActionOpenedAt = 0;
let pendingPlaylistSongIdx = null;
let openPlaylistAdder = null;
let playlistAdderQueries = {};
let playlistDragState = null;
let audioCtx = null;
let audioSource = null;
let analyser = null;
let outputGain = null;
let waveData = null;
let waveTimeData = null;
let waveRaf = 0;
let progressTimer = 0;
let waveFrame = 0;
let waveSizeKey = '';
let fxSizeKey = '';
let waveBars = [];
let wavePitchFocus = 0.5;
let smoothedLevel = 0;
let waveFloorDb = -48;
let wavePeakDb = -18;
let tetoFxLevel = 0;
let tetoGlowLevel = 0;
let tetoRiseEnergy = 0;
let lastTetoAmplitude = 0;
let waveLevelWindow = [];
let playerVolume = parseVolume(localStorage.getItem('vp_volume'), 1);
let calibratedClockSongId = null;
let calibratedBaseTime = 0;
let calibratedBasePerf = 0;
let calibratedClockRunning = false;
let pendingClockSeekTime = null;
let pendingClockSeekStartedAt = 0;
let seekTransaction = null;
let seekSettleTimer = null;
let lastMediaEvent = 'boot';
let lastTimingRepair = 'none';
let timingRepairCount = 0;
let lastWatchdogNativeTime = 0;
let lastWatchdogDisplayTime = 0;
let lastWatchdogPerf = performance.now();
let audioGraphError = '';
let audioGraphActivatedAt = 0;
const WAVE_BAR_COUNT = 72; // was 124 — main-thread heavy with full FFT path
const WAVE_GAIN = 1.46;
const WAVE_SOFT_LIMIT = 1.08;
const WAVE_LEVEL_WINDOW = 90;
const WAVE_MIN_FREQ = 38;
const WAVE_MAX_FREQ = 14000;
const WAVE_FFT_SIZE = 1024; // was 2048
const PROGRESS_MS = 50; // dedicated lightweight progress clock (~20Hz)
// (progress is NOT driven from the visualizer rAF — that was the lag source)
const AUDIO_FILE_RE = /\.(mp3|m4a)$/i;
const AUDIO_EXTENSION_RE = /\.(mp3|m4a)$/i;
const PENTHOUSE_EFFECT_PROFILE = {
  bpm: 123,
  key: 'F# major',
  constantRings: true,
  beatOffset: 0.122,
  sections: [
    {name: 'Intro', start: 0, end: 51, intensity: 0.24, chorus: false},
    {name: 'First chorus', start: 52.27, end: 84.01, intensity: 1, chorus: true, fade: 0.5},
    {name: 'Altered second chorus', start: 128.89, end: 148.37, intensity: 0.92, chorus: true, fade: 0.5},
    {name: 'Last chorus', start: 179.5, end: 211.38, intensity: 1.08, chorus: true, fade: 0.5},
  ],
};
/** Doki Doki Forever — BPM from OR3O charting (165). Sections track lyric choruses. */
const DDF_EFFECT_PROFILE = {
  bpm: 165,
  key: 'G major',
  constantRings: true,
  beatOffset: 0.08,
  allowFx: true,
  sections: [
    {name: 'Intro', start: 0, end: 11.56, intensity: 0.22, chorus: false},
    {name: 'Verse 1', start: 11.56, end: 34.56, intensity: 0.42, chorus: false, fade: 0.4},
    {name: 'Pre-chorus 1', start: 34.56, end: 46.06, intensity: 0.58, chorus: false, fade: 0.35},
    {name: 'Chorus 1', start: 46.06, end: 81.28, intensity: 1.0, chorus: true, fade: 0.45},
    {name: 'Verse 2', start: 81.28, end: 104.7, intensity: 0.48, chorus: false, fade: 0.4},
    {name: 'Pre-chorus 2', start: 104.7, end: 116.14, intensity: 0.62, chorus: false, fade: 0.3},
    {name: 'Chorus 2', start: 116.14, end: 139.5, intensity: 1.05, chorus: true, fade: 0.4},
    {name: 'Bridge', start: 139.5, end: 158.83, intensity: 0.78, chorus: true, fade: 0.5},
    {name: 'Outro', start: 158.83, end: 182.0, intensity: 0.88, chorus: true, fade: 0.6},
  ],
};
/**
 * Doki Doki Forever (Lofi) — custom stretch of the OR3O timeline.
 * Duration ~268.3s vs OR3O ~180.3s. RMS-fit: t_lofi ≈ 0.60 + t_orig * 1.489.
 * BPM ≈ 111 (165 / 1.489). Softer intensities for chill lofi character.
 */
const DDF_LOFI_EFFECT_PROFILE = {
  bpm: 111,
  key: 'G major',
  constantRings: true,
  beatOffset: 0.72,
  allowFx: true,
  lofi: true,
  sections: [
    {name: 'Intro', start: 0, end: 17.81, intensity: 0.18, chorus: false},
    {name: 'Verse 1', start: 17.81, end: 52.06, intensity: 0.32, chorus: false, fade: 0.45},
    {name: 'Pre-chorus 1', start: 52.06, end: 69.18, intensity: 0.42, chorus: false, fade: 0.4},
    {name: 'Chorus 1', start: 69.18, end: 121.63, intensity: 0.72, chorus: true, fade: 0.5},
    {name: 'Verse 2', start: 121.63, end: 156.5, intensity: 0.36, chorus: false, fade: 0.45},
    {name: 'Pre-chorus 2', start: 156.5, end: 173.53, intensity: 0.44, chorus: false, fade: 0.35},
    {name: 'Chorus 2', start: 173.53, end: 208.32, intensity: 0.76, chorus: true, fade: 0.45},
    {name: 'Bridge', start: 208.32, end: 237.1, intensity: 0.55, chorus: true, fade: 0.55},
    {name: 'Outro', start: 237.1, end: 268.3, intensity: 0.62, chorus: true, fade: 0.65},
  ],
};
const bpmEffectProfile = (bpm, options = {}) => ({
  bpm,
  constantRings: true,
  beatOffset: 0,
  sections: [],
  ...options,
});
function audioProfileEntries(basePath, profile) {
  return [
    [`${basePath}.mp3`, profile],
    [`${basePath}.m4a`, profile],
  ];
}
const SONG_EFFECT_PROFILES = Object.fromEntries([
  ...audioProfileEntries('songs/Penthouse - One, Two, Three (一二三)', PENTHOUSE_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Jamie Paige - Machine Love', bpmEffectProfile(175)),
  ...audioProfileEntries('songs/Lambie - Machine Love (Drums)', bpmEffectProfile(175)),
  ...audioProfileEntries('songs/The8BitDrummer - Machine Love (Drums)', bpmEffectProfile(175)),
  ...audioProfileEntries('songs/christian/Forrest Frank - OKAY!', bpmEffectProfile(120, {allowFx: true})),
  ...audioProfileEntries('songs/MIMI - Science', bpmEffectProfile(188)),
  ...audioProfileEntries('songs/Moonlit Star - Science (English)', bpmEffectProfile(188)),
  // All Traveling Voices / DDF remasters share the DDLC story FX profile
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Traveling Voices v7 Phrase-Word Lead)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Traveling Voices v7 Slow Glide)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Traveling Voices v7 Slow Glide SADIE D1)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Traveling Voices v7 Slow Glide SADIE H3)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Female Vocal Remaster v3)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Male Vocal Remaster v3)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/OR3O (Monika) feat. Rachie (Sayori), Kathy-chan (Yuri) & Chi Chi (Natsuki) - Doki Doki Forever', DDF_EFFECT_PROFILE),
  // Lofi cut — stretched timeline + chill intensity (do NOT share full-speed DDF profile)
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Lofi)', DDF_LOFI_EFFECT_PROFILE),
]);
const seededUnit = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
const TETO_FX_OBJECTS = Array.from({ length: 24 }, (_, i) => {
  const a = seededUnit((i + 1) * 24.271);
  const b = seededUnit((i + 1) * 61.733);
  const lane = i % 8;
  const homes = [
    {x: 0.04 + a * 0.2, y: 0.08 + b * 0.28},
    {x: 0.74 + a * 0.22, y: 0.08 + b * 0.28},
    {x: 0.04 + a * 0.24, y: 0.62 + b * 0.3},
    {x: 0.72 + a * 0.24, y: 0.6 + b * 0.32},
    {x: 0.34 + a * 0.32, y: 0.05 + b * 0.18},
    {x: 0.3 + a * 0.4, y: 0.74 + b * 0.2},
    {x: 0.84 + a * 0.13, y: 0.33 + b * 0.3},
    {x: 0.03 + a * 0.16, y: 0.36 + b * 0.32},
  ];
  const home = homes[lane];
  return {
    x: home.x,
    y: home.y,
    phase: a * Math.PI * 2,
    size: 5.8 + (i % 6) * 1.55,
    kind: i % 2,
    threshold: 0.08 + ((i * 7) % 10) * 0.052,
  };
});
const DISCO_BEAMS = Array.from({ length: 8 }, (_, i) => ({
  phase: seededUnit((i + 1) * 9.81) * Math.PI * 2,
  speed: 0.13 + seededUnit((i + 1) * 16.37) * 0.16,
  width: 0.09 + seededUnit((i + 1) * 23.13) * 0.08,
  colorIndex: i % 7,
  origin: i % 4,
}));
const DISCO_SPARKLES = Array.from({ length: 32 }, (_, i) => ({
  x: 0.04 + seededUnit((i + 1) * 13.117) * 0.92,
  y: 0.05 + seededUnit((i + 1) * 41.91) * 0.86,
  phase: seededUnit((i + 1) * 71.37) * Math.PI * 2,
  size: 1.6 + seededUnit((i + 1) * 5.73) * 4.8,
  threshold: 0.08 + seededUnit((i + 1) * 19.43) * 0.5,
}));
const TETO11_SPARKS = Array.from({ length: 58 }, (_, i) => ({
  x: 0.035 + seededUnit((i + 1) * 17.217) * 0.93,
  y: 0.05 + seededUnit((i + 1) * 29.913) * 0.86,
  phase: seededUnit((i + 1) * 83.11) * Math.PI * 2,
  size: 1.2 + seededUnit((i + 1) * 7.37) * 3.8,
  warm: seededUnit((i + 1) * 43.91),
  threshold: 0.04 + seededUnit((i + 1) * 31.13) * 0.44,
}));
const TETO11_HEARTS = Array.from({ length: 10 }, (_, i) => {
  const a = seededUnit((i + 1) * 37.31);
  const b = seededUnit((i + 1) * 53.17);
  const zones = [
    {x: 0.08 + a * 0.18, y: 0.12 + b * 0.22},
    {x: 0.68 + a * 0.22, y: 0.13 + b * 0.2},
    {x: 0.06 + a * 0.2, y: 0.58 + b * 0.28},
    {x: 0.72 + a * 0.2, y: 0.56 + b * 0.28},
    {x: 0.34 + a * 0.28, y: 0.72 + b * 0.13},
    {x: 0.3 + a * 0.36, y: 0.07 + b * 0.12},
  ];
  return {
    ...zones[i % zones.length],
    phase: a * Math.PI * 2,
    size: 4.4 + (i % 5) * 0.85 + b * 1.1,
    threshold: 0.12 + (i % 6) * 0.075,
  };
});
const TETO11_BEAMS = Array.from({ length: 8 }, (_, i) => ({
  phase: seededUnit((i + 1) * 21.49) * Math.PI * 2,
  speed: 0.12 + seededUnit((i + 1) * 36.7) * 0.12,
  width: 0.065 + seededUnit((i + 1) * 18.23) * 0.055,
  colorIndex: i % 7,
  origin: i % 4,
}));
const TETO11_ROBOTS = [
  {x: 0.8, y: 0.22, size: 46, phase: 0.2},
];
let fxRingPulses = [];
let lastFxRingBeatKey = '';
let lastFxRingFallbackAt = 0;

let toastTimeout = null;
function showToast(icon, text) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.innerHTML = '<span class="toast-icon"></span><span class="toast-text"></span>';
    document.body.appendChild(toast);
  }
  toast.querySelector('.toast-icon').textContent = icon;
  toast.querySelector('.toast-text').textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1400);
}

function loadPlaylists() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('vp_playlists') || '{}') || {}; }
  catch { stored = {}; }
  let changed = false;
  Object.entries(DEFAULT_PLAYLISTS).forEach(([name, songIds]) => {
    if (!Array.isArray(stored[name])) {
      stored[name] = songIds.slice();
      changed = true;
    }
  });
  if (changed) {
    try { localStorage.setItem('vp_playlists', JSON.stringify(stored)); }
    catch {}
  }
  return stored;
}
function savePlaylists() {
  localStorage.setItem('vp_playlists', JSON.stringify(playlists));
}

window.addEventListener('pagehide', savePlaylists);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') savePlaylists();
});

function parseVolume(value, fallback = 1) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function audioBaseName(filename) {
  return filename.replace(AUDIO_EXTENSION_RE, '').trim();
}

function audioFormatRank(filename) {
  if (/\.m4a$/i.test(filename)) return 2;
  if (/\.mp3$/i.test(filename)) return 1;
  return 0;
}

function preferredAudioFiles(items) {
  const selected = new Map();
  items
    .filter(i => i.type === 'file' && AUDIO_FILE_RE.test(i.name))
    .forEach(item => {
      const key = audioBaseName(item.name).toLowerCase();
      const existing = selected.get(key);
      if (!existing || audioFormatRank(item.name) > audioFormatRank(existing.name)) {
        selected.set(key, item);
      }
    });
  return [...selected.values()].sort((a, b) => audioBaseName(a.name).localeCompare(audioBaseName(b.name)));
}

function prettyName(filename) {
  const base = audioBaseName(filename).replace(/_/g, ' ').trim();
  const m = base.match(/^(.+?)\s+-\s+(.+)$/);
  if (m) {
    const artist = m[1].trim();
    const title = m[2].trim();
    return { artist, title, display: `${artist} — ${title}` };
  }
  return { artist: '', title: base, display: base };
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function collectionLabel(collectionId) {
  return COLLECTIONS.find(collection => collection.id === collectionId)?.label || collectionId;
}

function songRef(song) {
  return song?.id || song?.name;
}

function refMatchesSong(ref, song) {
  return ref === song.id || ref === song.name;
}

function findSongIndex(ref) {
  let idx = library.findIndex(song => song.id === ref);
  if (idx < 0) idx = library.findIndex(song => song.name === ref);
  return idx;
}

function currentSong() {
  return library[queue[queueIndex]] || null;
}

function effectProfileForSong(song = currentSong()) {
  if (!song) return null;
  const direct = SONG_EFFECT_PROFILES[song.path] || SONG_EFFECT_PROFILES[song.id] || SONG_EFFECT_PROFILES[song.name];
  if (direct) return direct;
  // Lofi has its own stretched BPM / section map — never the full-speed 165 profile
  if (isDdfLofiSong(song)) return DDF_LOFI_EFFECT_PROFILE;
  // Any DDF / Traveling Voices cut gets the DDLC BPM profile even if path casing differs
  if (songLooksLikeTravelingVoices(song) || isDdfFamilySong(song)) return DDF_EFFECT_PROFILE;
  return null;
}

function songClockId(song = currentSong()) {
  return song ? (song.id || song.path || song.url || song.name) : null;
}

function nativeAudioDuration() {
  return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
}

function nativePlaybackTime() {
  return Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0;
}

function effectiveDuration(song = currentSong()) {
  return Math.max(nativeAudioDuration(), nativePlaybackTime());
}

function calibratedFromNativeTime(nativeTime, song = currentSong()) {
  const time = Number.isFinite(nativeTime) ? nativeTime : 0;
  return Math.max(0, time);
}

function nativeFromCalibratedTime(time, song = currentSong()) {
  const calibratedTime = Number.isFinite(time) ? time : 0;
  return Math.max(0, calibratedTime);
}

function resetCalibratedClock(time = 0, song = currentSong()) {
  calibratedClockSongId = songClockId(song);
  calibratedBaseTime = Math.max(0, time);
  calibratedBasePerf = performance.now() / 1000;
  calibratedClockRunning = false;
}

function ensureCalibratedClock(song = currentSong()) {
  if (calibratedClockSongId !== songClockId(song)) {
    resetCalibratedClock(calibratedFromNativeTime(nativePlaybackTime(), song), song);
  }
}

function currentCalibratedTime(song = currentSong()) {
  ensureCalibratedClock(song);
  let time;
  if (seekTransaction) {
    time = seekTransaction.targetTime;
  } else if (audio.src) {
    time = nativePlaybackTime();
    calibratedBaseTime = time;
    calibratedBasePerf = performance.now() / 1000;
    calibratedClockRunning = !audio.paused && !audio.seeking && audio.readyState >= 3;
  } else {
    time = calibratedBaseTime;
  }
  const duration = effectiveDuration(song);
  if (duration) time = Math.min(time, duration);
  return Math.max(0, time);
}

function setNativeTimeFromCalibratedClock(time, song = currentSong(), options = {}) {
  const duration = effectiveDuration(song);
  const targetTime = duration ? clamp(0, duration, time) : Math.max(0, time);
  const nativeTarget = nativeFromCalibratedTime(targetTime, song);
  if (!Number.isFinite(nativeTarget)) return false;
  const tolerance = Number.isFinite(options.tolerance) ? options.tolerance : 0.012;
  const diff = Math.abs(nativePlaybackTime() - nativeTarget);
  const shouldSeek = options.force ? diff > 0.001 : diff > tolerance;
  if (shouldSeek) {
    pendingClockSeekTime = targetTime;
    pendingClockSeekStartedAt = performance.now();
    audio.currentTime = nativeTarget;
  } else if (options.force) {
    pendingClockSeekTime = null;
  }
  return true;
}

function syncCalibratedClockToNative(song = currentSong(), options = {}) {
  const wasRunning = calibratedClockRunning;
  let nextTime;
  if (pendingClockSeekTime !== null) {
    nextTime = pendingClockSeekTime;
    if (options.consumePending) pendingClockSeekTime = null;
  } else if (seekTransaction) {
    nextTime = seekTransaction.targetTime;
  } else {
    nextTime = calibratedFromNativeTime(nativePlaybackTime(), song);
    if (options.allowBackward === false && calibratedClockSongId === songClockId(song)) {
      nextTime = Math.max(currentCalibratedTime(song), nextTime);
    }
  }
  resetCalibratedClock(nextTime, song);
  if (wasRunning && !audio.paused && !audio.seeking && audio.readyState >= 3 && options.keepRunning !== false) {
    startCalibratedClock(song);
  }
}

function startCalibratedClock(song = currentSong()) {
  ensureCalibratedClock(song);
  if (pendingClockSeekTime !== null) {
    calibratedBaseTime = pendingClockSeekTime;
  } else if (!seekTransaction) {
    calibratedBaseTime = nativePlaybackTime();
  }
  calibratedBasePerf = performance.now() / 1000;
  calibratedClockRunning = true;
}

function pauseCalibratedClock(song = currentSong()) {
  ensureCalibratedClock(song);
  calibratedBaseTime = currentCalibratedTime(song);
  calibratedBasePerf = performance.now() / 1000;
  calibratedClockRunning = false;
}

function primeAudioContextForGesture() {
  const ctx = ensureAudioContext();
  if (!ctx || ctx.state !== 'suspended') return Promise.resolve();
  return ctx.resume().catch(err => {
    rememberAudioGraphError(err);
  });
}

function resumeAudioFromCalibratedClock(song = currentSong()) {
  ensureCalibratedClock(song);
  calibratedBaseTime = currentCalibratedTime(song);
  calibratedBasePerf = performance.now() / 1000;
  calibratedClockRunning = false;
  audio.muted = false;

  // MUST run before play(): recreating <audio> after play() drops the stream.
  // Also re-apply song URL if element was swapped for native spatial fidelity.
  if (prefersNativeAudio(song) && (audioSource || analyser)) {
    const wantSrc = song?.url ? new URL(song.url, window.location.href).href : '';
    const t = currentCalibratedTime(song);
    recreateAudioElementForNativePath();
    if (wantSrc) {
      audio.src = song.url;
      audio.load();
      const seekOnce = () => {
        try { if (t > 0.05) audio.currentTime = t; } catch (_) {}
        audio.removeEventListener('loadedmetadata', seekOnce);
      };
      audio.addEventListener('loadedmetadata', seekOnce);
    }
  }

  // Spatial track: never hang volume on Web Audio graph
  if (prefersNativeAudio(song) && !audioSource) {
    audio.volume = playerVolume;
  } else {
    audio.volume = analyser && audioCtx?.state === 'running' ? 1 : playerVolume;
  }
  const contextReady = prefersNativeAudio(song) && !audioSource
    ? Promise.resolve()
    : primeAudioContextForGesture();
  return Promise.resolve(audio.play()).then(async result => {
    await contextReady;
    await activateAudioGraphIfPossible();
    // Re-apply volume after graph decision
    if (prefersNativeAudio(song) && !audioSource) audio.volume = playerVolume;
    setSpatialSong(song);
    updateTimingDebug();
    return result;
  }).catch(err => {
    updateTimingDebug();
    throw err;
  });
}

function clearSeekSettleTimer() {
  if (!seekSettleTimer) return;
  clearTimeout(seekSettleTimer);
  seekSettleTimer = null;
}

function noteMediaEvent(name) {
  lastMediaEvent = `${name} @ ${nativePlaybackTime().toFixed(3)}s`;
}

function timingDebugValue(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

function beginSeekTransaction() {
  if (seekTransaction) return seekTransaction;
  const resumeAfterSeek = !!(audio.src && !audio.paused);
  seekTransaction = {
    resumeAfterSeek,
    targetTime: currentCalibratedTime(),
    finishOnSeeked: false,
    startedAt: performance.now(),
  };
  pauseCalibratedClock();
  if (resumeAfterSeek) audio.pause();
  return seekTransaction;
}

function seekTargetFromControl() {
  const duration = effectiveDuration();
  if (!duration) return null;
  return (parseFloat($('seek').value) / 100) * duration;
}

function previewSeekTarget(time) {
  const tx = beginSeekTransaction();
  const duration = effectiveDuration();
  tx.targetTime = duration ? clamp(0, duration, time) : Math.max(0, time);
  pendingClockSeekTime = null;
  resetCalibratedClock(tx.targetTime);
  updatePlaybackVisuals();
}

function commitSeekTransaction(finishOnSeeked = true) {
  if (!seekTransaction) return;
  const tx = seekTransaction;
  tx.finishOnSeeked = tx.finishOnSeeked || finishOnSeeked;
  clearSeekSettleTimer();
  resetCalibratedClock(tx.targetTime);
  const nativeTarget = nativeFromCalibratedTime(tx.targetTime);
  const needsSeek = Math.abs(nativePlaybackTime() - nativeTarget) > 0.001;
  if (!setNativeTimeFromCalibratedClock(tx.targetTime, currentSong(), {force: true})) {
    audio.currentTime = nativeTarget;
  }
  if (tx.finishOnSeeked) {
    seekSettleTimer = setTimeout(() => finishSeekTransaction(), needsSeek ? 1200 : 0);
  }
  updatePlaybackVisuals();
}

function finishSeekTransaction() {
  if (!seekTransaction) return;
  const tx = seekTransaction;
  clearSeekSettleTimer();
  seekTransaction = null;
  pendingClockSeekTime = null;
  resetCalibratedClock(tx.targetTime);
  updatePlaybackVisuals();
  if (tx.resumeAfterSeek && audio.src) {
    resumeAudioFromCalibratedClock(currentSong()).catch(err => console.warn('Play failed:', err));
  }
}

function repairTimingState(displayTime) {
  const now = performance.now();
  const nativeTime = nativePlaybackTime();
  let repairedTime = displayTime;
  const nativeAdvanced = nativeTime - lastWatchdogNativeTime;
  const displayAdvanced = displayTime - lastWatchdogDisplayTime;
  const nativeIsPlaying = !!(audio.src && !audio.paused && !audio.seeking && audio.readyState >= 2);

  if (nativeIsPlaying && nativeAdvanced > 0.08 && displayAdvanced < 0.015 && Math.abs(nativeTime - displayTime) > 0.18) {
    clearSeekSettleTimer();
    seekTransaction = null;
    pendingClockSeekTime = null;
    resetCalibratedClock(nativeTime);
    calibratedClockRunning = true;
    repairedTime = nativeTime;
    timingRepairCount++;
    lastTimingRepair = `${new Date().toLocaleTimeString()} snapped ${timingDebugValue(displayTime)} -> ${timingDebugValue(nativeTime)}`;
  }

  if (now - lastWatchdogPerf > 180) {
    lastWatchdogNativeTime = nativeTime;
    lastWatchdogDisplayTime = repairedTime;
    lastWatchdogPerf = now;
  }
  return repairedTime;
}

function updateTimingDebug(displayTime = currentCalibratedTime()) {
  const el = $('timing-debug');
  if (!el) return;
  el.classList.toggle('hidden', !timingDebugEnabled);
  if (!timingDebugEnabled) return;
  const nativeTime = nativePlaybackTime();
  const duration = nativeAudioDuration();
  const txAge = seekTransaction ? `${Math.round(performance.now() - seekTransaction.startedAt)}ms` : 'none';
  const graphMode = analyser ? 'web-audio' : 'native';
  const gainValue = outputGain ? timingDebugValue(outputGain.gain.value, 3) : '-';
  const graphAge = audioGraphActivatedAt ? `${Math.round(performance.now() - audioGraphActivatedAt)}ms` : '-';
  el.textContent = [
    `display: ${timingDebugValue(displayTime)}s`,
    `native:  ${timingDebugValue(nativeTime)}s / ${timingDebugValue(duration)}s`,
    `delta:   ${timingDebugValue(displayTime - nativeTime)}s`,
    `paused:${audio.paused} seeking:${audio.seeking} ended:${audio.ended}`,
    `ready:${audio.readyState} network:${audio.networkState}`,
    `audio:${graphMode} ctx:${audioCtx?.state || 'none'} player:${timingDebugValue(playerVolume, 2)} elem:${timingDebugValue(audio.volume, 2)} muted:${audio.muted} gain:${gainValue}`,
    `graph age:${graphAge} error:${audioGraphError || '-'}`,
    `tx:${seekTransaction ? 'yes' : 'no'} target:${seekTransaction ? timingDebugValue(seekTransaction.targetTime) : '-'} age:${txAge}`,
    `pending:${pendingClockSeekTime === null ? '-' : timingDebugValue(pendingClockSeekTime)} running:${calibratedClockRunning}`,
    `event:${lastMediaEvent}`,
    `repairs:${timingRepairCount} ${lastTimingRepair}`,
  ].join('\n');
}

function effectSectionAt(profile, time) {
  if (!profile || !Number.isFinite(time)) return null;
  const section = (profile.sections || []).find(item => time >= item.start && time <= item.end);
  if (!section) return null;
  const fade = section.fade || 0;
  if (!fade) return {...section, fadeLevel: 1};
  const fadeIn = clamp(0, 1, (time - section.start) / fade);
  const fadeOut = clamp(0, 1, (section.end - time) / fade);
  return {...section, fadeLevel: Math.min(fadeIn, fadeOut)};
}

function beatPulseForProfile(profile, time) {
  if (!profile?.bpm || !Number.isFinite(time)) return 0;
  const beats = Math.max(0, (time - (profile.beatOffset || 0)) * profile.bpm / 60);
  const phase = beats - Math.floor(beats);
  return Math.pow(1 - phase, 4.2);
}

function activeFxTheme(song = currentSong()) {
  // Traveling Voices / DDF: dedicated DDLC story FX (visual only — audio stays native)
  if (songLooksLikeTravelingVoices(song) || isDdfFamilySong(song)) {
    return tetoFxEnabled ? 'ddlc' : 'off';
  }
  const profile = effectProfileForSong(song);
  if (!tetoFxEnabled || !song) return 'off';
  const theme = ['teto', 'disco', 'teto11'].includes(fxTheme) ? fxTheme : 'teto11';
  if (theme === 'teto11') return 'teto11';
  if (song.collection === 'secular' || profile?.allowFx) return theme;
  return 'off';
}

function isAnyFxActive(song = currentSong()) {
  return activeFxTheme(song) !== 'off';
}

function isTetoFxActive(song = currentSong()) {
  return activeFxTheme(song) === 'teto';
}

function isDiscoFxActive(song = currentSong()) {
  return activeFxTheme(song) === 'disco';
}

function isTeto11FxActive(song = currentSong()) {
  return activeFxTheme(song) === 'teto11';
}

function isDdlcFxActive(song = currentSong()) {
  return activeFxTheme(song) === 'ddlc';
}

function setTetoFxEnabled(enabled) {
  tetoFxEnabled = !!enabled;
  localStorage.setItem('vp_teto_fx_enabled', tetoFxEnabled ? 'true' : 'false');
  const checkbox = $('teto-fx-enabled');
  if (checkbox) checkbox.checked = tetoFxEnabled;
  updateFxState();
}

function setFxTheme(theme) {
  fxTheme = ['teto', 'disco', 'teto11'].includes(theme) ? theme : 'teto11';
  localStorage.setItem('vp_fx_theme', fxTheme);
  const select = $('fx-theme');
  if (select) select.value = fxTheme;
  updateFxState();
}

function updateFxState(levelOverride = tetoGlowLevel) {
  const theme = activeFxTheme();
  const active = theme !== 'off';
  const level = active && !audio.paused ? levelOverride : 0;
  document.body.classList.toggle('fx-active', active);
  document.body.classList.toggle('disco-fx-active', theme === 'disco');
  document.body.classList.toggle('teto-fx-active', theme === 'teto');
  document.body.classList.toggle('teto11-fx-active', theme === 'teto11');
  document.body.classList.toggle('ddlc-fx-active', theme === 'ddlc');
  document.body.style.setProperty('--fx-level', level.toFixed(3));
  document.body.style.setProperty('--teto-level', level.toFixed(3));
  document.body.style.setProperty('--disco-level', level.toFixed(3));
  document.body.style.setProperty('--teto11-level', level.toFixed(3));
  document.body.style.setProperty('--ddlc-level', level.toFixed(3));
}

function switchView(view) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'playlists') renderPlaylists();
  if (view === 'now') {
    // Layout must settle before measuring wave-panel (was sizing against stale boxes)
    scheduleNowLayoutSync();
    spatialForcePaint = true;
    syncSpatialLoop();
    if (!audio.paused) startWaveform();
  } else {
    stopSpatialLoop();
  }
}

function filteredLibraryEntries(filter = '') {
  const q = filter.toLowerCase().trim();
  return library
    .map((song, idx) => ({ song, idx }))
    .filter(({ song }) => activeCollection === 'all' || song.collection === activeCollection)
    .filter(({ song }) => !q || song.displayName.toLowerCase().includes(q));
}

function isLocalHost() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' || h === '';
}

function mapCollectionItems(collection, items) {
  return preferredAudioFiles(items).map(i => {
    const path = `${collection.folder}/${i.name}`;
    const p = prettyName(i.name);
    return {
      id: path,
      name: i.name,
      path,
      url: `./${encodePath(path)}`,
      collection: collection.id,
      collectionLabel: collection.label,
      displayName: p.display,
      artist: p.artist,
      title: p.title,
      size: i.size
    };
  });
}

async function fetchCollectionLocal(collection) {
  const url = `./${encodePath(collection.folder)}/manifest.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const error = new Error(`local manifest HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  const items = await res.json();
  return mapCollectionItems(collection, items);
}

async function fetchCollectionGitHub(collection) {
  const apiPath = encodePath(collection.folder);
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${apiPath}?ref=main`;
  const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  const items = await res.json();
  return mapCollectionItems(collection, items);
}

async function fetchCollection(collection) {
  // Prefer local manifest (works on localhost + includes unpushed tracks).
  try {
    return await fetchCollectionLocal(collection);
  } catch (localErr) {
    if (isLocalHost()) throw localErr;
    return fetchCollectionGitHub(collection);
  }
}

async function loadLibrary() {
  const errBox = $('library-error');
  errBox.classList.add('hidden');
  const loaded = [];
  const errors = [];
  for (const collection of COLLECTIONS) {
    try {
      loaded.push(...await fetchCollection(collection));
    } catch (error) {
      if (error.status !== 404 || collection.id === 'secular') {
        errors.push({ collection, error });
      }
    }
  }
  library = loaded.sort((a, b) => {
    const collectionSort = COLLECTION_ORDER.get(a.collection) - COLLECTION_ORDER.get(b.collection);
    return collectionSort || a.displayName.localeCompare(b.displayName);
  });
  if (errors.length > 0) {
    if (errors.some(({ error }) => error.status === 403)) {
      errBox.textContent = 'GitHub API rate limit hit. Try again in a few minutes.';
    } else {
      const failed = errors
        .map(({ collection, error }) => collection ? `${collection.label} (${error.message})` : error.message)
        .join(', ');
      errBox.textContent = `Could not load part of the library: ${failed}.`;
    }
    errBox.classList.remove('hidden');
  }
  if (activeCollection !== 'all' && !COLLECTIONS.some(collection => collection.id === activeCollection)) {
    activeCollection = 'all';
  }
  renderCollectionFilters();
  renderLibrary($('search').value);
  if ($('view-playlists')?.classList.contains('active')) renderPlaylists();
  // Auto-focus new traveling mix when available on first load of this session
  maybeHighlightTravelingSong();
}

function renderCollectionFilters() {
  const filter = $('collection-filter');
  if (!filter) return;
  const counts = Object.fromEntries(COLLECTIONS.map(collection => [collection.id, 0]));
  library.forEach(song => {
    if (counts[song.collection] !== undefined) counts[song.collection]++;
  });
  filter.querySelectorAll('.collection-tab').forEach(button => {
    const collection = button.dataset.collection;
    button.classList.toggle('active', collection === activeCollection);
    const count = collection === 'all' ? library.length : counts[collection] || 0;
    button.querySelector('.collection-count').textContent = count;
  });
}

function setActiveCollection(collection) {
  activeCollection = collection;
  localStorage.setItem('vp_collection', activeCollection);
  renderCollectionFilters();
  renderLibrary($('search').value);
}

function emptyLibraryText(filter) {
  if (library.length === 0) {
    return 'No songs found. Drop .mp3 or .m4a files into songs/ or songs/christian/, commit, and push.';
  }
  if (filter.trim()) {
    return `No ${activeCollection === 'all' ? '' : `${collectionLabel(activeCollection).toLowerCase()} `}songs match that search.`;
  }
  if (activeCollection !== 'all') {
    return `No ${collectionLabel(activeCollection).toLowerCase()} songs found.`;
  }
  return 'No songs found.';
}

function stopInteractiveEvent(e) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
}

function eventClientX(e) {
  if (Number.isFinite(e.clientX)) return e.clientX;
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  return Number.isFinite(touch?.clientX) ? touch.clientX : null;
}

function eventHitsRowActionZone(e, row) {
  if (!row) return false;
  const x = eventClientX(e);
  if (x === null) return false;
  const rect = row.getBoundingClientRect();
  const actionZone = Math.max(58, Math.min(110, rect.width * 0.22));
  return x >= rect.right - actionZone && x <= rect.right + 8;
}

function openAddToMenuFromEvent(e) {
  const target = e.target.closest?.('.add-to, .col-actions');
  const row = target?.closest('.song-row') || e.target.closest?.('.song-row');
  const hitAction = !!target || eventHitsRowActionZone(e, row);
  if (!hitAction) return false;
  const libIdx = parseInt(row?.dataset.libIdx, 10);
  if (!Number.isFinite(libIdx)) return false;
  stopInteractiveEvent(e);
  const now = performance.now();
  if (now - addToActionOpenedAt < 350) return true;
  addToActionOpenedAt = now;
  startAddToPlaylistFlow(libIdx);
  return true;
}

function bindLibraryActionGuards() {
  const list = $('library-list');
  ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(type => {
    list.addEventListener(type, openAddToMenuFromEvent, {capture: true});
  });
}

function renderLibrary(filter = '') {
  const list = $('library-list');
  const empty = $('library-empty');
  const filtered = filteredLibraryEntries(filter);
  list.innerHTML = '';
  if (filtered.length === 0) {
    empty.textContent = emptyLibraryText(filter);
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  filtered.forEach(({ song, idx }, displayIdx) => {
    const li = document.createElement('li');
    li.className = 'song-row';
    li.dataset.libIdx = idx;
    if (queue[queueIndex] === idx) li.classList.add('playing');
    li.innerHTML = `
      <span class="col-num"></span>
      <span class="col-title song-title-wrap">
        <span class="song-title-text"></span>
        <span class="song-badge"></span>
      </span>
      <span class="col-actions">
        <button class="icon-btn add-to" title="Add to playlist">+</button>
      </span>
    `;
    li.querySelector('.col-num').textContent = displayIdx + 1;
    li.querySelector('.song-title-text').textContent = song.displayName;
    const badge = li.querySelector('.song-badge');
    if (songLooksLikeTravelingVoices(song)) {
      const slug = spatialSlugForSong(song);
      // e.g. "01 · Spatial" or short path label for batch variants
      const short = slug
        ? slug.replace(/^\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : 'Spatial';
      const num = slug && slug.match(/^(\d+)/)?.[1];
      badge.textContent = num ? `${num} · ${short.length > 18 ? short.slice(0, 16) + '…' : short}` : 'Spatial';
      badge.classList.add('spatial-track');
      badge.title = short;
    } else {
      badge.textContent = song.collectionLabel;
      badge.classList.add(song.collection);
    }
    li.addEventListener('click', (e) => {
      if (e.defaultPrevented || openAddToMenuFromEvent(e)) return;
      if (e.target.closest('.col-actions')) return;
      if (queue[queueIndex] === idx && audio.src) {
        switchView('now');
        return;
      }
      queue = filtered.map(entry => entry.idx);
      shuffled = false;
      $('shuffle').classList.remove('on');
      queueIndex = queue.indexOf(idx);
      currentPlaylist = null;
      playCurrent();
    });
    const addButton = li.querySelector('.add-to');
    addButton.type = 'button';
    addButton.addEventListener('pointerdown', (e) => {
      openAddToMenuFromEvent(e);
    });
    addButton.addEventListener('click', (e) => {
      openAddToMenuFromEvent(e);
    });
    list.appendChild(li);
  });
}

function highlightCurrent() {
  const currentIdx = queue[queueIndex];
  document.querySelectorAll('.song-row').forEach(row => {
    row.classList.toggle('playing', parseInt(row.dataset.libIdx) === currentIdx);
  });
  document.querySelectorAll('.playlist-song').forEach(row => {
    const libIdx = parseInt(row.dataset.libIdx);
    const inCurrentPlaylist = row.dataset.playlist === currentPlaylist;
    row.classList.toggle('playing', inCurrentPlaylist && libIdx === currentIdx);
  });
}

function playCurrent() {
  if (queueIndex < 0 || queueIndex >= queue.length) return;
  const libIdx = queue[queueIndex];
  const song = library[libIdx];
  if (!song) return;
  // Spatial HQ: if a prior song attached Web Audio, rebuild <audio> for true native stereo
  const recreatedNative = ensureNativeRoutingForSpatialSong(song);
  const targetSrc = new URL(song.url, window.location.href).href;
  const sameSource = !recreatedNative && (audio.currentSrc === targetSrc || audio.src === targetSrc);
  audio.playbackRate = 1;
  audio.preservesPitch = true;
  audio.webkitPreservesPitch = true;
  if (!sameSource) {
    resetWaveEnvelope();
    pendingClockSeekTime = null;
    audio.pause();
    audio.src = song.url;
    audio.load();
    resetCalibratedClock(0, song);
  }
  resumeAudioFromCalibratedClock(song).catch(err => console.warn('Play failed:', err));
  $('np-title').textContent = song.title || song.displayName;
  const parts = [];
  if (song.artist) parts.push(song.artist);
  if (songLooksLikeTravelingVoices(song)) parts.push('Spatial 3D guide on Now Playing');
  else if (song.collectionLabel) parts.push(song.collectionLabel);
  if (currentPlaylist) parts.push(`Playlist: ${currentPlaylist}`);
  $('np-sub').textContent = parts.join(' · ');
  $('play').textContent = '⏸';
  highlightCurrent();
  updateNowPlaying(song);
  switchView('now');
  updateMediaSession(song);
  document.title = `${song.title || song.displayName} — vp`;
}

function updateNowPlaying(song = currentSong()) {
  const title = song ? (song.title || song.displayName) : 'Nothing playing';
  const parts = [];
  if (song?.artist) parts.push(song.artist);
  if (song?.collectionLabel) parts.push(song.collectionLabel);
  if (currentPlaylist) parts.push(`Playlist: ${currentPlaylist}`);

  $('now-title').textContent = title;
  $('now-subtitle').textContent = song ? parts.join(' · ') : 'Pick a song from the library.';
  $('now-kicker').textContent = currentPlaylist || song?.collectionLabel || 'vp';
  updateUpNext();
  updatePlaybackVisuals();
  updateFxState();
  // setSpatialSong applies DDF/girl themes and toggles spatial-song-active layout class
  setSpatialSong(song);
  // Non-spatial DDF/remasters still need themes when spatial path is inactive
  if (!songLooksLikeTravelingVoices(song)) applySongTheme(song);
}

/* ---------- Spatial guide (Traveling Voices) — low-cost ---------- */
// Embedded so Desktop UI / offline / failed fetch still get full cue data.
const SPATIAL_MAP_EMBEDDED = {
  "name": "DDF_jumpy_moving_leads_v5",
  "description": "v5: clean re-separation (Kim/BS RoFormer ensemble + debleed) vocal remaster v3 + equal dual-lead spatial mix",
  "female_stem": "/Users/joshua/separator/experiments/doki-doki-forever-male-female/edit/vocal_remaster_v3/female_remastered_v3.wav",
  "male_stem": "/Users/joshua/separator/experiments/doki-doki-forever-male-female/edit/vocal_remaster_v3/male_remastered_v3.wav",
  "transition_sec": 1.15,
  "hop_sec": 3.6,
  "keyframes": [
    {
      "t": 0.0,
      "az": 40.0,
      "el": 0.35,
      "depth": 0.9,
      "section": "hop0",
      "cue": "front-right"
    },
    {
      "t": 3.6,
      "az": -90.0,
      "el": 0.5,
      "depth": 0.05,
      "section": "hop1",
      "cue": "high left mid"
    },
    {
      "t": 7.2,
      "az": -160.0,
      "el": -0.3,
      "depth": -0.7,
      "section": "hop2",
      "cue": "deep back-left"
    },
    {
      "t": 10.8,
      "az": 0.0,
      "el": 0.25,
      "depth": 1.0,
      "section": "hop3",
      "cue": "dead front"
    },
    {
      "t": 14.4,
      "az": -130.0,
      "el": -0.7,
      "depth": -0.55,
      "section": "hop4",
      "cue": "low back-left"
    },
    {
      "t": 18.0,
      "az": -55.0,
      "el": 0.15,
      "depth": 0.75,
      "section": "hop5b",
      "cue": "wide front-left (quick)"
    },
    {
      "t": 20.34,
      "az": -140.0,
      "el": 0.1,
      "depth": -0.85,
      "section": "hop6",
      "cue": "back-left"
    },
    {
      "t": 23.94,
      "az": 130.0,
      "el": -0.7,
      "depth": -0.6,
      "section": "hop7",
      "cue": "low back-right"
    },
    {
      "t": 27.54,
      "az": -55.0,
      "el": 0.15,
      "depth": 0.75,
      "section": "hop8",
      "cue": "wide front-left"
    },
    {
      "t": 31.14,
      "az": 90.0,
      "el": -0.4,
      "depth": 0.05,
      "section": "hop9",
      "cue": "low right mid"
    },
    {
      "t": 34.74,
      "az": 140.0,
      "el": 0.1,
      "depth": -0.85,
      "section": "hop10b",
      "cue": "back-right (quick)"
    },
    {
      "t": 37.08,
      "az": -40.0,
      "el": 0.35,
      "depth": 0.9,
      "section": "hop11",
      "cue": "front-left"
    },
    {
      "t": 40.68,
      "az": 90.0,
      "el": 0.0,
      "depth": 0.0,
      "section": "hop12",
      "cue": "hard right (mid)"
    },
    {
      "t": 44.28,
      "az": 140.0,
      "el": 0.1,
      "depth": -0.85,
      "section": "hop13",
      "cue": "back-right"
    },
    {
      "t": 47.88,
      "az": 50.0,
      "el": 0.8,
      "depth": 0.55,
      "section": "hop14",
      "cue": "high front-right"
    },
    {
      "t": 51.48,
      "az": 40.0,
      "el": 0.35,
      "depth": 0.9,
      "section": "hop15b",
      "cue": "front-right (quick)"
    },
    {
      "t": 53.82,
      "az": 180.0,
      "el": -0.15,
      "depth": -1.0,
      "section": "hop16",
      "cue": "dead back"
    },
    {
      "t": 57.42,
      "az": -50.0,
      "el": 0.8,
      "depth": 0.6,
      "section": "hop17",
      "cue": "high front-left"
    },
    {
      "t": 61.02,
      "az": 40.0,
      "el": 0.35,
      "depth": 0.9,
      "section": "hop18",
      "cue": "front-right"
    },
    {
      "t": 64.62,
      "az": -90.0,
      "el": 0.5,
      "depth": 0.05,
      "section": "hop19",
      "cue": "high left mid"
    },
    {
      "t": 68.22,
      "az": -90.0,
      "el": 0.0,
      "depth": 0.0,
      "section": "hop20b",
      "cue": "hard left (mid) (quick)"
    },
    {
      "t": 70.56,
      "az": 0.0,
      "el": 0.25,
      "depth": 1.0,
      "section": "hop21",
      "cue": "dead front"
    },
    {
      "t": 74.16,
      "az": -130.0,
      "el": -0.7,
      "depth": -0.55,
      "section": "hop22",
      "cue": "low back-left"
    },
    {
      "t": 77.76,
      "az": -90.0,
      "el": 0.0,
      "depth": 0.0,
      "section": "hop23",
      "cue": "hard left (mid)"
    },
    {
      "t": 81.36,
      "az": -140.0,
      "el": 0.1,
      "depth": -0.85,
      "section": "hop24",
      "cue": "back-left"
    },
    {
      "t": 84.96,
      "az": 160.0,
      "el": 0.4,
      "depth": -0.7,
      "section": "hop25b",
      "cue": "high back-right (quick)"
    },
    {
      "t": 87.3,
      "az": -55.0,
      "el": 0.15,
      "depth": 0.75,
      "section": "hop26",
      "cue": "wide front-left"
    },
    {
      "t": 90.9,
      "az": 90.0,
      "el": -0.4,
      "depth": 0.05,
      "section": "hop27",
      "cue": "low right mid"
    },
    {
      "t": 94.5,
      "az": 160.0,
      "el": 0.4,
      "depth": -0.7,
      "section": "hop28",
      "cue": "high back-right"
    },
    {
      "t": 98.1,
      "az": -40.0,
      "el": 0.35,
      "depth": 0.9,
      "section": "hop29",
      "cue": "front-left"
    },
    {
      "t": 101.7,
      "az": 55.0,
      "el": 0.15,
      "depth": 0.75,
      "section": "hop30b",
      "cue": "wide front-right (quick)"
    },
    {
      "t": 104.04,
      "az": 140.0,
      "el": 0.1,
      "depth": -0.85,
      "section": "hop31",
      "cue": "back-right"
    },
    {
      "t": 107.64,
      "az": 50.0,
      "el": 0.8,
      "depth": 0.55,
      "section": "hop32",
      "cue": "high front-right"
    },
    {
      "t": 111.24,
      "az": 55.0,
      "el": 0.15,
      "depth": 0.75,
      "section": "hop33",
      "cue": "wide front-right"
    },
    {
      "t": 114.84,
      "az": 180.0,
      "el": -0.15,
      "depth": -1.0,
      "section": "hop34",
      "cue": "dead back"
    },
    {
      "t": 118.44,
      "az": -160.0,
      "el": -0.3,
      "depth": -0.7,
      "section": "hop35b",
      "cue": "deep back-left (quick)"
    },
    {
      "t": 120.78,
      "az": 40.0,
      "el": 0.35,
      "depth": 0.9,
      "section": "hop36",
      "cue": "front-right"
    },
    {
      "t": 124.38,
      "az": -90.0,
      "el": 0.5,
      "depth": 0.05,
      "section": "hop37",
      "cue": "high left mid"
    },
    {
      "t": 127.98,
      "az": -160.0,
      "el": -0.3,
      "depth": -0.7,
      "section": "hop38",
      "cue": "deep back-left"
    },
    {
      "t": 131.58,
      "az": 0.0,
      "el": 0.25,
      "depth": 1.0,
      "section": "hop39",
      "cue": "dead front"
    },
    {
      "t": 135.18,
      "az": 130.0,
      "el": -0.7,
      "depth": -0.6,
      "section": "hop40b",
      "cue": "low back-right (quick)"
    },
    {
      "t": 137.52,
      "az": -90.0,
      "el": 0.0,
      "depth": 0.0,
      "section": "hop41",
      "cue": "hard left (mid)"
    },
    {
      "t": 141.12,
      "az": -140.0,
      "el": 0.1,
      "depth": -0.85,
      "section": "hop42",
      "cue": "back-left"
    },
    {
      "t": 144.72,
      "az": 130.0,
      "el": -0.7,
      "depth": -0.6,
      "section": "hop43",
      "cue": "low back-right"
    },
    {
      "t": 148.32,
      "az": -55.0,
      "el": 0.15,
      "depth": 0.75,
      "section": "hop44",
      "cue": "wide front-left"
    },
    {
      "t": 151.92,
      "az": 90.0,
      "el": 0.0,
      "depth": 0.0,
      "section": "hop45b",
      "cue": "hard right (mid) (quick)"
    },
    {
      "t": 154.26,
      "az": 160.0,
      "el": 0.4,
      "depth": -0.7,
      "section": "hop46",
      "cue": "high back-right"
    },
    {
      "t": 157.86,
      "az": -40.0,
      "el": 0.35,
      "depth": 0.9,
      "section": "hop47",
      "cue": "front-left"
    },
    {
      "t": 161.46,
      "az": 90.0,
      "el": 0.0,
      "depth": 0.0,
      "section": "hop48",
      "cue": "hard right (mid)"
    },
    {
      "t": 165.06,
      "az": 140.0,
      "el": 0.1,
      "depth": -0.85,
      "section": "hop49",
      "cue": "back-right"
    },
    {
      "t": 168.66,
      "az": -50.0,
      "el": 0.8,
      "depth": 0.6,
      "section": "hop50b",
      "cue": "high front-left (quick)"
    },
    {
      "t": 171.0,
      "az": 55.0,
      "el": 0.15,
      "depth": 0.75,
      "section": "hop51",
      "cue": "wide front-right"
    },
    {
      "t": 174.6,
      "az": 180.0,
      "el": -0.15,
      "depth": -1.0,
      "section": "hop52",
      "cue": "dead back"
    },
    {
      "t": 178.2,
      "az": -50.0,
      "el": 0.8,
      "depth": 0.6,
      "section": "hop53",
      "cue": "high front-left"
    },
    {
      "t": 181.84,
      "az": -45.0,
      "el": 0.2,
      "depth": 0.5,
      "section": "end",
      "cue": "settle front-leftish"
    }
  ],
  "files": {
    "wav": "/Users/joshua/separator/experiments/doki-doki-forever-male-female/edit/immersion_jumpy/DDF_jumpy_moving_leads_v5.wav",
    "m4a": "/Users/joshua/separator/experiments/doki-doki-forever-male-female/edit/immersion_jumpy/DDF_jumpy_moving_leads_v5.m4a",
    "mp3": "/Users/joshua/separator/experiments/doki-doki-forever-male-female/edit/immersion_jumpy/DDF_jumpy_moving_leads_v5.mp3"
  }
};
const SPATIAL_MS = 125;
let spatialMapCache = null;
let spatialActive = false;
let spatialTimer = 0;
let spatialForcePaint = false;
let spatialRadarReady = false;
let spatialLastUi = { f: '', m: '', sec: '', cue: '', next: '', az: 999, el: 999 };
let spatialEls = null;
let spatialCtx = null;

function songLooksLikeTravelingVoices(song) {
  if (!song) return false;
  const name = song.name || '';
  const title = song.title || '';
  const path = song.path || '';
  const id = song.id || '';
  const display = song.displayName || '';
  // Match "Traveling Voices" and versioned titles like "Traveling Voices v3"
  if (name.includes('Traveling Voices') || name.includes('Travelling Voices')) return true;
  if (title.includes('Traveling Voices') || title.includes('Travelling Voices')) return true;
  if (display.includes('Traveling Voices') || display.includes('Travelling Voices')) return true;
  if (name.includes('DDF Travel') || name.includes('DDF_travel')) return true;
  if (/jumpy/i.test(name) || /jumpy/i.test(title)) return true;
  const hay = `${title} ${path} ${id} ${display} ${name}`.toLowerCase();
  return hay.includes('traveling voices')
    || hay.includes('travelling voices')
    || hay.includes('ddf travel')
    || hay.includes('ddf_travel')
    || hay.includes('jumpy');
}

/** Version string from title, e.g. "v3" from "Traveling Voices v3". */
function travelingVoicesVersionLabel(song = currentSong()) {
  if (!song) return '';
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''}`;
  const m = hay.match(/Traveling Voices\s*(v\d+)/i) || hay.match(/\(v(\d+)\)/i);
  if (m) return m[1].toLowerCase().startsWith('v') ? m[1] : `v${m[1]}`;
  // fallback if file is known latest
  if (/traveling voices/i.test(hay)) {
    const mv = hay.match(/v(\d+)/i);
    return mv ? `v${mv[1]}` : 'v4';
  }
  return '';
}

/** Map library filename → spatial JSON slug (batch10 paths + jumpy primary). */
function spatialSlugForSong(song) {
  if (!song) return null;
  if (!songLooksLikeTravelingVoices(song)) return null;
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''}`;
  // Slow Glide + SADIE A/B cuts share the long-whoosh compass map
  if (/slow\s*glide/i.test(hay) || /whoosh/i.test(hay) || /v7_glide/i.test(hay) || /sadie\s*(d1|h3)/i.test(hay)) {
    return 'jumpy_slow_glide';
  }
  return 'jumpy_moving_leads';
}

/** Native HTMLAudio path (no Web Audio graph) — closest to QuickTime levels/stereo. */
function prefersNativeAudio(song = currentSong()) {
  return songLooksLikeTravelingVoices(song);
}

function maybeHighlightTravelingSong() {}

function cacheSpatialEls() {
  if (spatialEls?.panel?.isConnected) return spatialEls;
  spatialEls = {
    panel: $('spatial-guide'),
    radar: $('spatial-radar'),
    section: $('spatial-section'),
    female: $('spatial-female-text'),
    male: $('spatial-male-text'),
    cue: $('spatial-cue'),
    next: $('spatial-next'),
  };
  return spatialEls;
}

const spatialMapBySlug = {};

function normalizeSpatialMap(data) {
  const map = data && data.keyframes
    ? data
    : {
        keyframes: data?.keyframes || SPATIAL_MAP_EMBEDDED.keyframes,
        transitionSec: data?.transition_sec || data?.transitionSec || 1.15,
      };
  if (!map.transitionSec && data?.transition_sec) map.transitionSec = data.transition_sec;
  if (!map.keyframes && data?.keyframes) map.keyframes = data.keyframes;
  map._times = (map.keyframes || []).map(k => k.t);
  return map;
}

// Primary (only) spatial track — jumpy / Traveling Voices
spatialMapBySlug['jumpy_moving_leads'] = normalizeSpatialMap(JSON.parse(JSON.stringify(SPATIAL_MAP_EMBEDDED)));

function fetchSpatialSlug(slug) {
  if (!slug || spatialMapBySlug[slug]) return Promise.resolve(spatialMapBySlug[slug] || null);
  // slow glide file is DDF_travel_jumpy_slow_glide.json (slug jumpy_slow_glide)
  return fetch(`./songs/spatial/DDF_travel_${slug}.json`)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (!data) return null;
      spatialMapBySlug[slug] = normalizeSpatialMap(data);
      return spatialMapBySlug[slug];
    })
    .catch(() => null);
}

function preloadSpatialMaps() {
  fetchSpatialSlug('jumpy_moving_leads');
  fetchSpatialSlug('jumpy_slow_glide');
  loadDdfLyrics();
  loadDdfLeadMaps();
}

function loadSpatialMap(song = currentSong()) {
  const slug = spatialSlugForSong(song) || 'jumpy_moving_leads';
  if (spatialMapBySlug[slug]) {
    spatialMapCache = spatialMapBySlug[slug];
    return spatialMapCache;
  }
  fetchSpatialSlug(slug).then(map => {
    if (!map) return;
    if ((spatialSlugForSong(currentSong()) || 'jumpy_moving_leads') === slug) {
      spatialMapCache = map;
      spatialForcePaint = true;
      paintSpatialGuide(currentCalibratedTime(), true);
    }
  });
  spatialMapCache = spatialMapBySlug['jumpy_moving_leads']
    || normalizeSpatialMap(JSON.parse(JSON.stringify(SPATIAL_MAP_EMBEDDED)));
  return spatialMapCache;
}

function resetSpatialUiCache() {
  spatialLastUi = { f: '', m: '', sec: '', cue: '', next: '', az: 999, el: 999 };
}

// Girl color themes ONLY (not male/female dual-lead). Layout flag spatial-song-active is separate.
const DDLC_THEME_CLASSES = [
  'theme-sayori', 'theme-natsuki', 'theme-yuri', 'theme-monika',
];

function isMultiGirlDdfOriginal(song) {
  if (!song) return false;
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''}`.toLowerCase();
  const hits = ['sayori', 'natsuki', 'yuri', 'monika'].filter(g => hay.includes(g));
  return hits.length >= 3 && hay.includes('doki doki forever');
}

/** Doki Doki Forever (Lofi) — slower ~111 BPM stretch of the OR3O cut. */
function isDdfLofiSong(song) {
  if (!song) return false;
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''} ${song.path || ''} ${song.id || ''}`.toLowerCase();
  return hay.includes('doki doki forever') && /\blofi\b/.test(hay);
}

function isDdfFamilySong(song) {
  if (!song) return false;
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''} ${song.path || ''}`.toLowerCase();
  return (
    hay.includes('doki doki forever')
    || hay.includes('traveling voices')
    || hay.includes('travelling voices')
    || hay.includes('ddf travel')
    || hay.includes('ddf_travel')
    || hay.includes('jumpy')
    || hay.includes('drum-centered')
    || hay.includes('ddlc')
    || hay.includes('literature club')
  );
}

function detectDdlcGirlTheme(song) {
  if (!song) return null;
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''} ${song.path || ''}`.toLowerCase();
  // Explicit girl name in title wins
  if (hay.includes('sayori')) return 'theme-sayori';
  if (hay.includes('natsuki')) return 'theme-natsuki';
  if (hay.includes('yuri') && !hay.includes('forever')) return 'theme-yuri';
  if (hay.includes('monika') && !isDdfFamilySong(song)) return 'theme-monika';
  // Multi-girl original OR any DDF-family / Travel track → rotate the four girls by section
  // (user asked for girl themes, not male/female lead colors)
  if (isMultiGirlDdfOriginal(song) || isDdfFamilySong(song)) return 'theme-ddl-cast';
  if (hay.includes('monika')) return 'theme-monika';
  return null;
}

/**
 * OR3O Doki Doki Forever — active girl by REAL lyric timing.
 * Cast: rachie=Sayori, Chi-Chi=Natsuki, Kathy-chan=Yuri, OR3O=Monika.
 * Times from synced LRC (lrclib) + character labels (lyrics.com).
 * Checked against remaster vocal energy (V2 restart ~81s after mid-song gap).
 * [startSec, endSec, theme, label]
 */
const DDLC_GIRL_BY_LYRIC = [
  [0.00, 11.56, 'theme-monika', 'Intro · Monika'],
  // Verse 1
  [11.56, 22.68, 'theme-sayori', 'Hey hey · Sayori'],
  [22.68, 34.56, 'theme-natsuki', 'Sundae · Natsuki'],
  // Pre-chorus 1
  [34.56, 39.76, 'theme-yuri', 'When we touch · Yuri'],
  [39.76, 46.06, 'theme-sayori', 'Choose one · Sayori'],
  // Chorus 1
  [46.06, 58.00, 'theme-natsuki', 'Tell me · Natsuki'],
  [58.00, 67.63, 'theme-sayori', 'Will it be okay · Sayori'],
  [67.63, 81.28, 'theme-monika', 'Never apart · Monika'],
  // Verse 2 (after instrumental break)
  [81.28, 92.44, 'theme-yuri', 'Next to you · Yuri'],
  [92.44, 93.46, 'theme-sayori', 'I really love · Sayori'],
  [93.46, 104.70, 'theme-monika', 'Way you write · Monika'],
  // Pre-chorus 2
  [104.70, 109.59, 'theme-natsuki', 'Tasty love · Natsuki'],
  [109.59, 116.14, 'theme-yuri', 'Make the cut · Yuri'],
  // Chorus 2
  [116.14, 127.67, 'theme-monika', 'Leave you be · Monika'],
  [127.67, 139.50, 'theme-yuri', 'How can I convey · Yuri'],
  // Bridge
  [139.50, 158.83, 'theme-monika', 'One by one · Monika'],
  // Outro
  [158.83, 170.96, 'theme-sayori', 'Together forever · Sayori'],
  [170.96, 999.0, 'theme-monika', 'In my heart · Monika'],
];

/**
 * Lofi girl map — same cast order as DDLC_GIRL_BY_LYRIC, times stretched to the
 * ~268s Lofi file (RMS fit vs OR3O: t_lofi ≈ 0.60 + t_orig * 1.489).
 */
const DDLC_GIRL_BY_LYRIC_LOFI = [
  [0.00, 17.81, 'theme-monika', 'Intro · Monika'],
  [17.81, 34.37, 'theme-sayori', 'Hey hey · Sayori'],
  [34.37, 52.06, 'theme-natsuki', 'Sundae · Natsuki'],
  [52.06, 59.80, 'theme-yuri', 'When we touch · Yuri'],
  [59.80, 69.18, 'theme-sayori', 'Choose one · Sayori'],
  [69.18, 86.96, 'theme-natsuki', 'Tell me · Natsuki'],
  [86.96, 101.30, 'theme-sayori', 'Will it be okay · Sayori'],
  [101.30, 121.63, 'theme-monika', 'Never apart · Monika'],
  [121.63, 138.24, 'theme-yuri', 'Next to you · Yuri'],
  [138.24, 139.76, 'theme-sayori', 'I really love · Sayori'],
  [139.76, 156.50, 'theme-monika', 'Way you write · Monika'],
  [156.50, 163.78, 'theme-natsuki', 'Tasty love · Natsuki'],
  [163.78, 173.53, 'theme-yuri', 'Make the cut · Yuri'],
  [173.53, 190.70, 'theme-monika', 'Leave you be · Monika'],
  [190.70, 208.32, 'theme-yuri', 'How can I convey · Yuri'],
  [208.32, 237.10, 'theme-monika', 'One by one · Monika'],
  [237.10, 255.16, 'theme-sayori', 'Together forever · Sayori'],
  [255.16, 999.0, 'theme-monika', 'In my heart · Monika'],
];

let lastDdlcGirlTheme = '';
let lastDdlcGirlLabel = '';

function girlLyricMapForSong(song = currentSong()) {
  return isDdfLofiSong(song) ? DDLC_GIRL_BY_LYRIC_LOFI : DDLC_GIRL_BY_LYRIC;
}

function girlThemeAtTime(timeSec = 0, song = currentSong()) {
  const t = Number(timeSec) || 0;
  const map = girlLyricMapForSong(song);
  for (const [a, b, theme, label] of map) {
    if (t >= a && t < b) return { theme, label };
  }
  const last = map[map.length - 1];
  return { theme: last[2], label: last[3] };
}

function updateDdlcCastTheme(timeSec = currentCalibratedTime(), song = currentSong()) {
  const { theme: next, label } = girlThemeAtTime(timeSec, song);
  lastDdlcGirlLabel = label || '';
  if (next === lastDdlcGirlTheme && document.body.classList.contains(next)) {
    refreshNowKickerThemeHint(song);
    return;
  }
  lastDdlcGirlTheme = next;
  DDLC_THEME_CLASSES.forEach(c => document.body.classList.remove(c));
  document.body.classList.add(next);
  refreshNowKickerThemeHint(song);
}

function clearDdlcThemes() {
  DDLC_THEME_CLASSES.forEach(c => document.body.classList.remove(c));
}

function applySongTheme(song = currentSong()) {
  clearDdlcThemes();
  const theme = detectDdlcGirlTheme(song);
  if (!theme) return;
  // All multi-DDF / Travel tracks rotate the four girls — never pink/teal "male vs female"
  if (theme === 'theme-ddl-cast') {
    updateDdlcCastTheme(currentCalibratedTime());
    return;
  }
  document.body.classList.add(theme);
  refreshNowKickerThemeHint(song);
}

function spatialPathLabel(song = currentSong(), { compact = true } = {}) {
  const slug = spatialSlugForSong(song);
  if (!slug) return 'Opposite leads';
  const pretty = slug
    .replace(/^\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  const num = slug.match(/^(\d+)/)?.[1];
  if (!num) return pretty;
  // Compact for dock max-height / ellipsis (e.g. "04 · Clockwise Ring")
  if (compact) {
    const short = pretty.length > 18 ? `${pretty.slice(0, 16)}…` : pretty;
    return `${num} · ${short}`;
  }
  return `Path ${num} · ${pretty}`;
}

function activeGirlLabel() {
  if (document.body.classList.contains('theme-sayori')) return 'Sayori';
  if (document.body.classList.contains('theme-natsuki')) return 'Natsuki';
  if (document.body.classList.contains('theme-yuri')) return 'Yuri';
  if (document.body.classList.contains('theme-monika')) return 'Monika';
  return '';
}

function refreshNowKickerThemeHint(song = currentSong()) {
  const kicker = $('now-kicker');
  if (!kicker) return;
  const base = currentPlaylist || song?.collectionLabel || 'vp';
  const girl = activeGirlLabel();
  // Prefer lyric-section label (e.g. "Ch1 · Monika") when cast map is active
  const section = (detectDdlcGirlTheme(song) === 'theme-ddl-cast' && lastDdlcGirlLabel)
    ? lastDdlcGirlLabel
    : girl;
  if (songLooksLikeTravelingVoices(song)) {
    // Minimal: just the active girl / section — no "Spatial / dual lead" tech chrome
    kicker.textContent = section || 'Doki Doki Forever';
    return;
  }
  if (section) kicker.textContent = `${base} · ${section}`;
  else kicker.textContent = base;
}

function setSpatialSong(song = currentSong()) {
  const els = cacheSpatialEls();
  applySongTheme(song);
  const want = songLooksLikeTravelingVoices(song);
  if (!want) {
    spatialActive = false;
    stopSpatialLoop();
    resetSpatialUiCache();
    if (els.panel) els.panel.classList.add('hidden');
    document.body.classList.remove('spatial-song-active');
    setDdfTheaterActive(false, song);
    return;
  }
  // Re-resolve map for this variant (uses preloaded batch10 JSON when available)
  const wantSlug = spatialSlugForSong(song);
  if (!(wantSlug && spatialMapBySlug[wantSlug] && spatialMapCache === spatialMapBySlug[wantSlug])) {
    spatialMapCache = null;
  }
  const map = loadSpatialMap(song);
  if (!map) return;
  spatialActive = true;
  spatialForcePaint = true;
  resetSpatialUiCache();
  document.body.classList.add('spatial-song-active');

  const theater = wantsDdfTheater(song);
  if (theater) {
    // Full DDLC theater owns the UI; keep compact dock hidden
    if (els.panel) {
      els.panel.classList.add('hidden');
      els.panel.style.display = 'none';
    }
    setDdfTheaterActive(true, song);
  } else {
    setDdfTheaterActive(false, song);
    if (els.panel) {
      els.panel.classList.remove('hidden');
      els.panel.style.display = '';
      const kicker = els.panel.querySelector('.spatial-kicker');
      if (kicker) {
        kicker.innerHTML = 'Where the audio is <span class="spatial-hq-chip" title="Native HTMLAudio · AAC stereo, no Web Audio coloring">HQ</span>';
      }
      if (els.section) els.section.textContent = spatialPathLabel(song);
    }
  }
  refreshNowKickerThemeHint(song);
  ensureSpatialRadar();
  paintSpatialGuide(currentCalibratedTime(), true);
  syncSpatialLoop();
  // spatial-song-active / ddf-theater-active change grid rows — remeasure bars
  if (isNowViewActive()) scheduleNowLayoutSync();
}

function isNowViewActive() {
  return !!document.getElementById('view-now')?.classList.contains('active');
}

function syncSpatialLoop() {
  if (spatialActive && isNowViewActive()) startSpatialLoop();
  else stopSpatialLoop();
}

function startSpatialLoop() {
  if (spatialTimer) return;
  const run = () => {
    if (!spatialActive || !isNowViewActive()) {
      stopSpatialLoop();
      return;
    }
    const force = spatialForcePaint;
    spatialForcePaint = false;
    paintSpatialGuide(currentCalibratedTime(), force);
  };
  run();
  spatialTimer = setInterval(run, SPATIAL_MS);
}

function stopSpatialLoop() {
  if (spatialTimer) {
    clearInterval(spatialTimer);
    spatialTimer = 0;
  }
}

function wrapAzDelta(a, b) {
  let d = (b - a + 180) % 360;
  if (d < 0) d += 360;
  return d - 180;
}

function normalizeAz(az) {
  let a = (az + 180) % 360;
  if (a < 0) a += 360;
  return a - 180;
}

function smoothstep(u) {
  const x = u < 0 ? 0 : u > 1 ? 1 : u;
  return x * x * (3 - 2 * x);
}

function findKeyframeIndex(times, t) {
  // largest i with times[i] <= t
  let lo = 0;
  let hi = times.length - 1;
  if (t <= times[0]) return 0;
  if (t >= times[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function interpolateSpatialPose(map, timeSec) {
  const kfs = map.keyframes;
  const times = map._times;
  if (!kfs || !kfs.length) return null;
  const t = timeSec > 0 ? timeSec : 0;
  const transition = map.transitionSec || 3;
  if (t <= times[0]) {
    const k = kfs[0];
    return { az: k.az, el: k.el, section: k.section, cue: k.cue, next: kfs[1] || null, progress: 1 };
  }
  const lastI = kfs.length - 1;
  if (t >= times[lastI]) {
    const k = kfs[lastI];
    return { az: k.az, el: k.el, section: k.section, cue: k.cue, next: null, progress: 1 };
  }
  const i = Math.min(findKeyframeIndex(times, t), lastI - 1);
  const a = kfs[i];
  const b = kfs[i + 1];
  const tStart = a.t > b.t - transition ? a.t : b.t - transition;
  let u = 0;
  if (t > tStart) u = smoothstep((t - tStart) / (b.t - tStart || 1e-6));
  const az = normalizeAz(a.az + wrapAzDelta(a.az, b.az) * u);
  const el = a.el + (b.el - a.el) * u;
  const section = u < 0.5 ? a.section : b.section;
  const cue = u < 0.15 ? a.cue : (u > 0.85 ? b.cue : `Moving → ${b.cue}`);
  return { az, el, section, cue, next: b, progress: u };
}

function describeDirection(az, el) {
  const rad = (az * Math.PI) / 180;
  const rear = 0.5 * (1 - Math.cos(rad));
  const pan = Math.sin(rad);
  let horiz;
  if (rear > 0.72 && pan * pan < 0.1225) horiz = 'directly behind';
  else if (rear < 0.22 && pan * pan < 0.078) horiz = 'directly in front';
  else if (pan < -0.72) horiz = rear > 0.45 ? 'back-left' : (rear < 0.25 ? 'front-left' : 'hard left');
  else if (pan > 0.72) horiz = rear > 0.45 ? 'back-right' : (rear < 0.25 ? 'front-right' : 'hard right');
  else if (pan < -0.25) horiz = rear > 0.5 ? 'rear-left' : 'front-left';
  else if (pan > 0.25) horiz = rear > 0.5 ? 'rear-right' : 'front-right';
  else horiz = rear > 0.5 ? 'behind' : 'in front';

  let height = '';
  if (el > 0.55) height = ' · high';
  else if (el > 0.2) height = ' · slightly high';
  else if (el < -0.55) height = ' · low';
  else if (el < -0.2) height = ' · slightly low';
  return horiz + height;
}

function isDdfTheaterMode() {
  return document.body.classList.contains('ddf-theater-active');
}

function compassCanvas() {
  if (isDdfTheaterMode()) return $('ddf-compass') || $('spatial-radar');
  return $('spatial-radar');
}

function ensureSpatialRadar() {
  const canvas = compassCanvas();
  if (!canvas) return null;
  // Theater: large Audio Compass; dock: compact 64px
  const size = isDdfTheaterMode() ? 300 : 64;
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
    spatialCtx = null; // force new context after resize
  }
  if (!spatialCtx || spatialCtx.canvas !== canvas) {
    spatialCtx = canvas.getContext('2d', { alpha: true });
  }
  spatialRadarReady = true;
  return spatialCtx;
}

function drawSpatialRadar(pose) {
  const ctx = ensureSpatialRadar();
  if (!ctx || !pose) return;
  const size = ctx.canvas.width || 64;
  const theater = size >= 200;
  const cx = size / 2;
  const cy = size / 2;
  // Ring radius scales with canvas
  const r = theater ? size * 0.34 : 18;

  ctx.clearRect(0, 0, size, size);

  // Front hemisphere hint (subtle) so front/back reads faster
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();

  const labelPx = theater ? 13 : 8;
  ctx.fillStyle = theater ? 'rgba(255,220,235,0.85)' : 'rgba(235,235,240,0.5)';
  ctx.font = `700 ${labelPx}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const edge = theater ? 16 : 7;
  ctx.fillText('F', cx, cy - r + edge);
  ctx.fillText('B', cx, cy + r - edge);
  ctx.fillText('L', cx - r + edge, cy);
  ctx.fillText('R', cx + r - edge, cy);

  ctx.fillStyle = 'rgba(235,235,240,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, theater ? 4 : 2, 0, Math.PI * 2);
  ctx.fill();

  function plot(az, el, color) {
    const rad = (az * Math.PI) / 180;
    // Front (az≈0) top; rear bottom — ring radius + halo encode depth
    const rear = 0.5 * (1 - Math.cos(rad));
    const ring = r * (0.42 + rear * 0.42 + Math.min(0.14, Math.abs(el) * 0.1));
    const x = cx + Math.sin(rad) * ring;
    const y = cy - Math.cos(rad) * ring;
    const s = (theater ? 7 : 2.8) + Math.max(0, el) * (theater ? 3 : 1.5) + (el < 0 ? Math.abs(el) * 0.35 : 0);
    // Rear: dashed outer ring + dim fill so F/B reads without stereo headphones
    if (rear > 0.55) {
      ctx.fillStyle = color === '#ff7eb6' ? 'rgba(255,126,182,0.22)' : 'rgba(94,234,212,0.22)';
      ctx.beginPath();
      ctx.arc(x, y, s + (theater ? 6 : 3.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash(theater ? [4, 4] : [2, 2]);
      ctx.strokeStyle = color === '#ff7eb6' ? 'rgba(255,126,182,0.7)' : 'rgba(94,234,212,0.7)';
      ctx.lineWidth = theater ? 2 : 1.25;
      ctx.beginPath();
      ctx.arc(x, y, s + (theater ? 5 : 2.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = rear > 0.55 ? 0.82 : 1;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Gender letter on theater dots
    if (theater) {
      ctx.fillStyle = 'rgba(20,10,24,0.9)';
      ctx.font = '800 11px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(color === '#ff7eb6' ? 'F' : 'M', x, y + 0.5);
    }
    if (el > 0.35) {
      ctx.strokeStyle = color;
      ctx.lineWidth = theater ? 2 : 1;
      ctx.beginPath();
      ctx.arc(x, y, s + (theater ? 3 : 1.6), 0, Math.PI * 2);
      ctx.stroke();
    } else if (el < -0.35) {
      // Low elevation: small underline tick
      ctx.strokeStyle = color;
      ctx.lineWidth = theater ? 2 : 1.25;
      ctx.beginPath();
      ctx.moveTo(x - s, y + s + 1.5);
      ctx.lineTo(x + s, y + s + 1.5);
      ctx.stroke();
    }
  }

  plot(pose.az, pose.el, '#ff7eb6');
  plot(normalizeAz(pose.az + 180), -pose.el, '#5eead4');
}

function setTextIfChanged(el, value, key) {
  if (!el) return;
  if (spatialLastUi[key] === value) return;
  spatialLastUi[key] = value;
  el.textContent = value;
}

function paintSpatialGuide(timeSec, force = false) {
  if (!spatialActive || !spatialMapCache) return;
  const els = cacheSpatialEls();
  const theater = isDdfTheaterMode();
  // Dock hidden in theater; still paint large compass + lyrics
  if (!theater && (!els.panel || els.panel.classList.contains('hidden'))) return;

  const pose = interpolateSpatialPose(spatialMapCache, timeSec);
  if (!pose) return;

  // Coarse snap for canvas: only redraw when ~4° or el moves meaningfully
  const azQ = Math.round(pose.az / 4) * 4;
  const elQ = Math.round(pose.el * 5) / 5;
  if (force || spatialLastUi.az !== azQ || spatialLastUi.el !== elQ) {
    spatialLastUi.az = azQ;
    spatialLastUi.el = elQ;
    drawSpatialRadar(pose);
  }

  const mAz = normalizeAz(pose.az + 180);
  const mEl = -pose.el;
  const fDir = describeDirection(pose.az, pose.el);
  const mDir = describeDirection(mAz, mEl);
  // Compact path + phrase (dock is height-capped)
  const pathBit = spatialPathLabel(currentSong(), { compact: true });
  const secLabel = pose.section ? `${pathBit} · ${pose.section}` : pathBit;
  setTextIfChanged(els.section, secLabel, 'sec');
  setTextIfChanged(els.female, fDir, 'f');
  setTextIfChanged(els.male, mDir, 'm');
  setTextIfChanged(els.cue, pose.cue || '', 'cue');

  let nextText = '';
  if (pose.next) {
    const eta = pose.next.t - timeSec;
    nextText = eta > 0.05
      ? `Next in ${eta.toFixed(0)}s: ${pose.next.cue}`
      : `Next: ${pose.next.cue}`;
  } else {
    nextText = 'End of spatial cues';
  }
  setTextIfChanged(els.next, nextText, 'next');

  if (theater) {
    paintDdfTheater(timeSec, pose, fDir, mDir, force);
  }

  // Rotate girl colors on cast / DDF-family tracks while playing
  if (detectDdlcGirlTheme(currentSong()) === 'theme-ddl-cast') {
    updateDdlcCastTheme(timeSec);
  }
}

/* ---------- DDF Theater (full DDLC custom UI) ---------- */
let ddfLyricsCache = null;
let ddfLeadMaps = null;
let ddfLastLineIdx = -1;
let ddfLastLeadMode = '';
let ddfFullListBuilt = false;
let ddfTheaterEls = null;
let ddfFullOpen = false;

/**
 * DDF stage FX — NO character images.
 * Full-bleed canvas effects color-coded per active girl (Sayori/Natsuki/Yuri/Monika).
 * Aggressive by design; dial down later if needed.
 */
const DDF_GIRL_PALETTE = {
  sayori: {
    bg: [14, 28, 48],
    primary: [87, 199, 255],
    secondary: [255, 143, 171],
    accent: [255, 240, 250],
    mode: 'hearts',
  },
  natsuki: {
    bg: [48, 14, 28],
    primary: [255, 140, 180],
    secondary: [255, 80, 140],
    accent: [255, 230, 100],
    mode: 'spark',
  },
  yuri: {
    bg: [22, 10, 42],
    primary: [124, 77, 255],
    secondary: [180, 140, 255],
    accent: [230, 220, 255],
    mode: 'ink',
  },
  monika: {
    bg: [8, 28, 20],
    primary: [16, 185, 129],
    secondary: [80, 255, 180],
    accent: [200, 255, 230],
    mode: 'glitch',
  },
};

/* Same visual density, cheaper draws: fewer path objects, no pixel-heart loops */
const DDF_FX_PARTICLES = Array.from({ length: 72 }, (_, i) => ({
  x: seededUnit((i + 1) * 17.3),
  y: seededUnit((i + 1) * 41.9),
  z: 0.35 + seededUnit((i + 1) * 7.7) * 0.65,
  sp: 0.25 + seededUnit((i + 1) * 29.1) * 1.4,
  ph: seededUnit((i + 1) * 11.5) * Math.PI * 2,
  kind: i % 5,
  size: 6 + seededUnit((i + 1) * 3.3) * 22,
}));

const DDF_FX_BEAMS = Array.from({ length: 12 }, (_, i) => ({
  origin: i % 4,
  phase: seededUnit((i + 1) * 13.1) * Math.PI * 2,
  speed: 0.18 + seededUnit((i + 1) * 19.7) * 0.55,
  width: 0.018 + seededUnit((i + 1) * 8.2) * 0.04,
  colorIndex: i % 3,
  ox: seededUnit(i * 2.1),
  oy: seededUnit(i * 3.3),
}));

let ddfFxSizeKey = '';
let ddfFxLastPaint = 0;
let ddfFxRaf = 0;
let ddfFxCtx = null;
const DDF_FX_MIN_MS = 33; // ~30fps — keeps effects, cuts main-thread load vs 60+

function activeDdfGirlKey() {
  if (document.body.classList.contains('theme-sayori')) return 'sayori';
  if (document.body.classList.contains('theme-natsuki')) return 'natsuki';
  if (document.body.classList.contains('theme-yuri')) return 'yuri';
  if (document.body.classList.contains('theme-monika')) return 'monika';
  return 'monika';
}

/** Cheap vector heart (2 arcs + triangle) — same look as pixel heart, ~40x less work */
function drawFastHeart(ctx, x, y, size, fillStyle, alpha, angle = 0) {
  if (alpha <= 0.01 || size < 1) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fillStyle;
  const s = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.7);
  ctx.bezierCurveTo(-s * 1.2, s * 0.05, -s * 0.9, -s * 0.85, 0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.9, -s * 0.85, s * 1.2, s * 0.05, 0, s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function resizeDdfFxCanvas(force = false) {
  const canvas = $('ddf-fx');
  const root = $('ddf-theater');
  if (!canvas || !root || root.classList.contains('hidden')) return false;
  const rect = root.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  // Cap DPR at 1 — full retina on a full-bleed FX canvas is the main lag source
  const dpr = 1;
  const w = Math.max(2, Math.floor(rect.width * dpr));
  const h = Math.max(2, Math.floor(rect.height * dpr));
  const key = `${w}x${h}`;
  if (!force && key === ddfFxSizeKey && ddfFxCtx) return true;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ddfFxSizeKey = key;
  ddfFxCtx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  return !!ddfFxCtx;
}

function startDdfFxLoop() {
  if (ddfFxRaf) return;
  const tick = (now) => {
    ddfFxRaf = requestAnimationFrame(tick);
    if (!document.body.classList.contains('ddf-theater-active')) {
      stopDdfFxLoop();
      return;
    }
    if (!isNowViewActive()) return;
    if (now - ddfFxLastPaint < DDF_FX_MIN_MS) return;
    paintDdfTheaterFx(currentCalibratedTime());
  };
  ddfFxRaf = requestAnimationFrame(tick);
}

function stopDdfFxLoop() {
  if (ddfFxRaf) {
    cancelAnimationFrame(ddfFxRaf);
    ddfFxRaf = 0;
  }
}

function paintDdfTheaterFx(timeSec = currentCalibratedTime()) {
  const canvas = $('ddf-fx');
  const root = $('ddf-theater');
  if (!canvas || !root || root.classList.contains('hidden')) return;
  if (!resizeDdfFxCanvas()) return;
  const ctx = ddfFxCtx;
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const girl = activeDdfGirlKey();
  const pal = DDF_GIRL_PALETTE[girl] || DDF_GIRL_PALETTE.monika;
  const p = pal.primary;
  const s = pal.secondary;
  const a = pal.accent;
  const bg = pal.bg;
  const t = performance.now() / 1000;
  const profile = effectProfileForSong() || DDF_EFFECT_PROFILE;
  const section = effectSectionAt(profile, timeSec);
  // Lofi profile already uses softer section intensities; extra chill dampener for canvas FX
  const lofiEase = profile.lofi ? 0.72 : 1;
  const sectionPower = ((section?.intensity || 0.4) * (section?.fadeLevel ?? 1)) * lofiEase;
  const chorus = section?.chorus ? sectionPower : 0;
  const beat = beatPulseForProfile(profile, timeSec) * (profile.lofi ? 0.85 : 1);
  const bpm = profile.bpm || 165;
  const beatHz = bpm / 60;
  const heartWave = 0.5 + 0.5 * Math.sin(t * beatHz * Math.PI * 2);
  const energy = clamp(0, 1, 0.35 + sectionPower * 0.45 + beat * 0.35 + chorus * 0.35);
  const cx = w * 0.5;
  const cy = h * 0.48;
  const scale = Math.max(1, Math.min(w, h) / 700);
  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);

  // Base fill
  ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
  ctx.fillRect(0, 0, w, h);

  // One radial wash (not per-particle)
  const field = ctx.createRadialGradient(
    cx + Math.sin(t * 0.4) * w * 0.08,
    cy + Math.cos(t * 0.35) * h * 0.06,
    0, cx, cy, maxDim * (0.55 + energy * 0.25)
  );
  field.addColorStop(0, `rgba(${p[0]},${p[1]},${p[2]},${0.55 + energy * 0.35})`);
  field.addColorStop(0.4, `rgba(${s[0]},${s[1]},${s[2]},${0.32 + energy * 0.22})`);
  field.addColorStop(1, `rgba(${bg[0]},${bg[1]},${bg[2]},1)`);
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Beams — keep all, skip nested save when possible
  const length = maxDim * (1.05 + chorus * 0.35);
  for (let i = 0; i < DDF_FX_BEAMS.length; i++) {
    const beam = DDF_FX_BEAMS[i];
    const color = i % 3 === 0 ? p : i % 3 === 1 ? s : a;
    const originPhase = (beam.origin + ((t * 0.2) | 0)) & 3;
    let ox; let oy; let base;
    if (originPhase === 0) { ox = w * (0.08 + beam.ox * 0.84); oy = -h * 0.05; base = Math.PI * 0.5; }
    else if (originPhase === 1) { ox = w * 1.05; oy = h * (0.1 + beam.oy * 0.8); base = Math.PI; }
    else if (originPhase === 2) { ox = w * (0.08 + beam.ox * 0.84); oy = h * 1.05; base = -Math.PI * 0.5; }
    else { ox = -w * 0.05; oy = h * (0.1 + beam.oy * 0.8); base = 0; }
    const angle = base + Math.sin(t * beam.speed + beam.phase) * (0.5 + chorus * 0.3) + beat * 0.12;
    const half = length * (beam.width + beat * 0.025 + energy * 0.01);
    const alpha = (0.07 + energy * 0.14 + chorus * 0.16 + beat * 0.12) * (0.7 + (i % 3) * 0.12);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, length, 0);
    g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha * 1.7})`);
    g.addColorStop(0.5, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
    g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, half);
    ctx.lineTo(length, -half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Beat rings
  for (let r = 0; r < 5; r++) {
    const life = (beat * 0.85 + r * 0.18 + heartWave * 0.08) % 1;
    const rad = minDim * (0.06 + life * (0.42 + chorus * 0.18));
    const alpha = (1 - life) * (0.2 + energy * 0.24 + beat * 0.22);
    if (alpha < 0.02) continue;
    const col = r & 1 ? s : p;
    ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
    ctx.lineWidth = (2 + (1 - life) * 5) * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Particles — solid fills/strokes (no per-particle gradients)
  const mode = pal.mode;
  for (let i = 0; i < DDF_FX_PARTICLES.length; i++) {
    const pt = DDF_FX_PARTICLES[i];
    const drift = t * pt.sp * (0.08 + energy * 0.12);
    const x = ((pt.x + Math.sin(t * 0.35 + pt.ph) * 0.06 + 1) % 1) * w;
    const y = ((pt.y + drift) % 1.15) * h - h * 0.08;
    const size = pt.size * scale * pt.z * (0.7 + beat * 0.55 + energy * 0.35);
    const alpha = (0.1 + energy * 0.22 + beat * 0.14) * pt.z;
    const col = i & 1 ? p : s;
    const colCss = `rgb(${col[0]},${col[1]},${col[2]})`;

    if (mode === 'hearts') {
      if (pt.kind < 3) {
        drawFastHeart(ctx, x, y, size, colCss, alpha * 1.35, t * 0.4 + pt.ph);
      } else {
        ctx.globalAlpha = alpha * 1.2;
        ctx.fillStyle = `rgb(${a[0]},${a[1]},${a[2]})`;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (mode === 'spark') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * (1.2 + pt.sp) + pt.ph);
      ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * 1.7})`;
      ctx.lineWidth = Math.max(1.2, scale * 1.3);
      const arm = size * (0.9 + beat * 0.75);
      ctx.beginPath();
      ctx.moveTo(-arm, 0); ctx.lineTo(arm, 0);
      ctx.moveTo(0, -arm); ctx.lineTo(0, arm);
      if (!(pt.kind & 1)) {
        ctx.moveTo(-arm * 0.7, -arm * 0.7); ctx.lineTo(arm * 0.7, arm * 0.7);
        ctx.moveTo(-arm * 0.7, arm * 0.7); ctx.lineTo(arm * 0.7, -arm * 0.7);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(${a[0]},${a[1]},${a[2]},${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (mode === 'ink') {
      if (pt.kind < 2) {
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * 1.25})`;
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.55, size * 0.9, pt.ph + t * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pt.ph + t * 0.5);
        ctx.fillStyle = `rgba(${s[0]},${s[1]},${s[2]},${alpha * 1.05})`;
        ctx.fillRect(-size * 0.35, -size * 0.55, size * 0.7, size * 1.1);
        ctx.restore();
      }
    } else {
      // glitch blocks
      const gw = size * (0.8 + beat);
      const gh = size * (0.25 + (i % 3) * 0.15);
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * (0.85 + beat)})`;
      ctx.fillRect(x - gw / 2, y - gh / 2, gw, gh);
      if (pt.kind === 0 && beat > 0.2) {
        ctx.fillStyle = `rgba(${a[0]},${a[1]},${a[2]},${alpha * 1.3})`;
        ctx.fillRect(x + size * 0.35, y - gh, gw * 0.35, gh * 0.5);
      }
    }
  }

  // Girl overlays (kept, cheaper where possible)
  if (girl === 'sayori') {
    for (let k = 0; k < 2; k++) {
      const phase = (heartWave + k * 0.18) % 1;
      ctx.strokeStyle = `rgba(${p[0]},${p[1]},${p[2]},${(1 - phase) * 0.35})`;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, minDim * (0.12 + phase * 0.28), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (girl === 'natsuki') {
    if (beat > 0.35) {
      ctx.fillStyle = `rgba(${s[0]},${s[1]},${s[2]},${beat * 0.16})`;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2 + t * 0.8;
      const dist = minDim * (0.15 + beat * 0.2 + (i % 5) * 0.03);
      const col = i & 1 ? p : a;
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.28 + beat * 0.4})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist * 0.7, (4 + (i % 4)) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (girl === 'yuri') {
    for (let i = 0; i < 4; i++) {
      const yy = ((t * 0.04 + i * 0.22) % 1) * h;
      ctx.fillStyle = `rgba(${p[0]},${p[1]},${p[2]},${0.1 + chorus * 0.1})`;
      ctx.fillRect(0, yy, w, 28 * scale);
    }
  } else if (girl === 'monika') {
    const step = Math.max(6, 6 * scale);
    const flickBase = (t * 18) | 0;
    for (let y = 0; y < h; y += step) {
      if (seededUnit(y * 0.07 + flickBase) > 0.5) continue;
      ctx.fillStyle = `rgba(${p[0]},${p[1]},${p[2]},${0.05 + beat * 0.08})`;
      ctx.fillRect(0, y, w, 2);
    }
    for (let g = 0; g < 7; g++) {
      if (seededUnit(t * 30 + g * 4.2) > 0.42 + beat * 0.2) continue;
      const gy = seededUnit(g * 9.1 + ((t * 12) | 0)) * h;
      const gh = (8 + seededUnit(g * 2.3) * 40) * scale;
      const gx = (seededUnit(g * 5.5 + t) - 0.5) * w * 0.15;
      ctx.fillStyle = `rgba(${s[0]},${s[1]},${s[2]},${0.14 + beat * 0.2})`;
      ctx.fillRect(gx, gy, w, gh);
    }
  }

  // Core bloom
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * (0.2 + energy * 0.15));
  core.addColorStop(0, `rgba(${a[0]},${a[1]},${a[2]},${0.32 + beat * 0.32 + chorus * 0.18})`);
  core.addColorStop(0.45, `rgba(${p[0]},${p[1]},${p[2]},${0.16 + energy * 0.14})`);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
  ddfFxLastPaint = performance.now();
}

function wantsDdfTheater(song = currentSong()) {
  return songLooksLikeTravelingVoices(song);
}

function cacheDdfTheaterEls() {
  if (ddfTheaterEls?.root?.isConnected) return ddfTheaterEls;
  ddfTheaterEls = {
    root: $('ddf-theater'),
    fx: $('ddf-fx'),
    title: $('ddf-song-title'),
    section: $('ddf-section-label'),
    femaleDir: $('ddf-female-dir'),
    maleDir: $('ddf-male-dir'),
    cue: $('ddf-cue'),
    block: $('ddf-lyrics-block'),
    paneF: $('ddf-pane-female'),
    paneM: $('ddf-pane-male'),
    lineF: $('ddf-line-female'),
    lineM: $('ddf-line-male'),
    stateF: $('ddf-state-female'),
    stateM: $('ddf-state-male'),
    fullToggle: $('ddf-full-toggle'),
    fullPanel: $('ddf-full-lyrics'),
    fullList: $('ddf-full-list'),
    playIcon: $('ddf-play-icon'),
    timeCur: $('ddf-time-current'),
    timeTot: $('ddf-time-total'),
  };
  return ddfTheaterEls;
}

function loadDdfLyrics() {
  if (ddfLyricsCache) return Promise.resolve(ddfLyricsCache);
  return fetch(`./songs/spatial/ddf_dual_lyrics.json?v=${encodeURIComponent(document.querySelector('meta[name="vp-build"]')?.content || '1')}`)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      ddfLyricsCache = data;
      return data;
    })
    .catch(() => null);
}

function loadDdfLeadMaps() {
  if (ddfLeadMaps) return Promise.resolve(ddfLeadMaps);
  return fetch(`./songs/spatial/ddf_lead_maps.json?v=${encodeURIComponent(document.querySelector('meta[name="vp-build"]')?.content || '1')}`)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      ddfLeadMaps = data || {};
      return ddfLeadMaps;
    })
    .catch(() => {
      ddfLeadMaps = {};
      return ddfLeadMaps;
    });
}

/** Map song title → lead map id */
function leadMapIdForSong(song = currentSong()) {
  const hay = `${song?.name || ''} ${song?.title || ''} ${song?.displayName || ''}`;
  // SADIE A/B Slow Glide variants
  if (/sadie\s*d1/i.test(hay)) return 'v7_phrase_word_lead_glide_sadie_d1';
  if (/sadie\s*h3/i.test(hay)) return 'v7_phrase_word_lead_glide_sadie_h3';
  // Slow Glide sister cut shares phrase leads, separate id for spatial metadata
  if (/slow\s*glide/i.test(hay) || /whoosh/i.test(hay)) {
    return 'v7_phrase_word_lead_glide';
  }
  // Default Traveling Voices cut: phrase/word lead map (v7)
  if (/v7/i.test(hay) || /phrase[- ]?word/i.test(hay) || songLooksLikeTravelingVoices(song)) {
    return 'v7_phrase_word_lead';
  }
  return 'v7_phrase_word_lead';
}

/**
 * Active lead at time: 'F' | 'M' | 'both'
 * F/M = that track is lead, other is support only.
 * both = dual (both main).
 */
function leadAtTime(t, song = currentSong()) {
  const maps = ddfLeadMaps || {};
  const id = leadMapIdForSong(song);
  const map = maps[id] || maps.v7_phrase_word_lead || maps.default || maps.v5_flat;
  if (!map || !map.segments || !map.segments.length) return 'both';
  // Last matching segment wins (phrase/word units are ordered; overlaps rare)
  let lead = 'both';
  for (const s of map.segments) {
    const a = Number(s.start);
    const b = Number(s.end);
    if (t >= a && t < b) {
      const L = String(s.lead || 'both');
      if (L === 'F' || L === 'M' || L === 'both' || L === 'none') lead = L;
    }
  }
  if (lead === 'none') return 'both';
  return lead;
}

function lyricIndexAtTime(t) {
  const lines = ddfLyricsCache?.lines;
  if (!lines?.length) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const start = Number(lines[i].t);
    const end = lines[i].end != null ? Number(lines[i].end) : (lines[i + 1] ? Number(lines[i + 1].t) : start + 4);
    if (t + 0.04 >= start && t < end + 0.05) idx = i;
    else if (t + 0.04 >= start) idx = i; // keep last started
  }
  // Prefer last line whose start has passed
  idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (t + 0.05 >= Number(lines[i].t)) idx = i;
    else break;
  }
  return idx;
}

function fmtLyricTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function buildFullLyricsList(song = currentSong()) {
  const els = cacheDdfTheaterEls();
  if (!els.fullList || !ddfLyricsCache?.lines) return;
  const lines = ddfLyricsCache.lines;
  const frag = document.createDocumentFragment();
  lines.forEach((ln, i) => {
    const mid = (Number(ln.t) + Number(ln.end != null ? ln.end : ln.t + 2)) / 2;
    const lead = leadAtTime(mid, song);
    const who = lead === 'F' ? '♀' : lead === 'M' ? '♂' : '♥';
    const row = document.createElement('div');
    row.className = `ddf-full-row lead-${lead === 'F' || lead === 'M' ? lead : 'both'}`;
    row.dataset.i = String(i);
    row.dataset.t = String(ln.t);
    row.innerHTML =
      `<span class="t">${fmtLyricTime(ln.t)}</span>` +
      `<span class="who">${who}</span>` +
      `<span class="txt"></span>`;
    row.querySelector('.txt').textContent = ln.text || '';
    row.addEventListener('click', () => {
      const target = Number(ln.t);
      if (Number.isFinite(target)) {
        // Seek via existing seek machinery if available
        try {
          if (typeof setNativeTimeFromCalibratedClock === 'function') {
            setNativeTimeFromCalibratedClock(target, currentSong(), { force: true });
          } else if (audio) {
            audio.currentTime = target;
          }
        } catch (_) { /* ignore */ }
      }
    });
    frag.appendChild(row);
  });
  els.fullList.innerHTML = '';
  els.fullList.appendChild(frag);
  ddfFullListBuilt = true;
}

function updateFullLyricsNow(idx) {
  const els = cacheDdfTheaterEls();
  if (!els.fullList || !ddfFullListBuilt) return;
  const rows = els.fullList.querySelectorAll('.ddf-full-row');
  rows.forEach((row, i) => {
    const on = i === idx;
    row.classList.toggle('is-now', on);
    if (on) {
      // keep current row visible
      const parent = els.fullPanel;
      if (parent && !parent.classList.contains('hidden')) {
        const rTop = row.offsetTop;
        const rH = row.offsetHeight;
        const view = parent.clientHeight;
        const scroll = parent.scrollTop;
        if (rTop < scroll + 40 || rTop + rH > scroll + view - 20) {
          parent.scrollTop = Math.max(0, rTop - view * 0.35);
        }
      }
    }
  });
}

function updateCurrentLyrics(timeSec, force = false) {
  const els = cacheDdfTheaterEls();
  if (!els.block || !ddfLyricsCache?.lines) return;
  const idx = lyricIndexAtTime(timeSec);
  const lead = leadAtTime(timeSec);
  const mode = lead === 'F' ? 'female' : lead === 'M' ? 'male' : 'dual';
  const line = idx >= 0 ? ddfLyricsCache.lines[idx] : null;
  const text = (line && line.text) ? line.text : (timeSec < 10.4 ? '(intro)' : '…');

  if (!force && idx === ddfLastLineIdx && mode === ddfLastLeadMode) {
    // still refresh full-list now marker occasionally
    return;
  }
  ddfLastLineIdx = idx;
  ddfLastLeadMode = mode;

  els.block.dataset.mode = mode;

  // Panes (minimal chrome — no dual-lead / support % labels)
  const setPane = (pane, lineEl, stateEl, isLead) => {
    if (!pane || !lineEl) return;
    pane.classList.toggle('is-lead', isLead);
    pane.classList.toggle('is-support', !isLead && mode === 'dual');
    lineEl.textContent = text;
    lineEl.classList.toggle('is-empty', !line || !line.text);
    if (stateEl) {
      stateEl.textContent = '';
    }
  };

  if (mode === 'dual') {
    setPane(els.paneF, els.lineF, els.stateF, true);
    setPane(els.paneM, els.lineM, els.stateM, true);
  } else if (mode === 'female') {
    setPane(els.paneF, els.lineF, els.stateF, true);
    if (els.paneM) {
      els.paneM.classList.remove('is-lead');
      els.paneM.classList.add('is-support');
    }
  } else {
    setPane(els.paneM, els.lineM, els.stateM, true);
    if (els.paneF) {
      els.paneF.classList.remove('is-lead');
      els.paneF.classList.add('is-support');
    }
  }

  updateFullLyricsNow(idx);
}

function bindDdfFullToggle() {
  const els = cacheDdfTheaterEls();
  if (!els.fullToggle || els.fullToggle.dataset.bound) return;
  els.fullToggle.dataset.bound = '1';
  els.fullToggle.addEventListener('click', () => {
    ddfFullOpen = !ddfFullOpen;
    els.fullToggle.setAttribute('aria-expanded', ddfFullOpen ? 'true' : 'false');
    els.fullToggle.textContent = ddfFullOpen ? 'Lyrics ▴' : 'Lyrics ▾';
    if (els.fullPanel) {
      els.fullPanel.classList.toggle('hidden', !ddfFullOpen);
    }
    if (ddfFullOpen) {
      if (!ddfFullListBuilt) buildFullLyricsList(currentSong());
      updateFullLyricsNow(ddfLastLineIdx);
    }
  });
}

function setDdfTheaterActive(want, song = currentSong()) {
  const els = cacheDdfTheaterEls();
  if (!els.root) return;
  if (want) {
    document.body.classList.add('ddf-theater-active');
    els.root.classList.remove('hidden');
    if (els.title) els.title.textContent = 'Doki Doki Forever';
    bindDdfFullToggle();
    ddfLastLineIdx = -1;
    ddfLastLeadMode = '';
    ddfFullListBuilt = false;
    ddfFxSizeKey = '';
    ddfFxCtx = null;
    Promise.all([loadDdfLyrics(), loadDdfLeadMaps()]).then(() => {
      buildFullLyricsList(song);
      updateCurrentLyrics(currentCalibratedTime(), true);
    });
    spatialCtx = null;
    spatialForcePaint = true;
    ensureSpatialRadar();
    // Dedicated ~30fps FX loop (not tied to spatial interval / wave rAF)
    requestAnimationFrame(() => {
      resizeDdfFxCanvas(true);
      paintDdfTheaterFx(currentCalibratedTime());
      startDdfFxLoop();
    });
    paintSpatialGuide(currentCalibratedTime(), true);
    updateFxState();
  } else {
    document.body.classList.remove('ddf-theater-active');
    els.root.classList.add('hidden');
    ddfLastLineIdx = -1;
    ddfLastLeadMode = '';
    ddfFullOpen = false;
    ddfFxSizeKey = '';
    ddfFxCtx = null;
    stopDdfFxLoop();
    spatialCtx = null;
    updateFxState();
  }
}

function paintDdfTheater(timeSec, pose, fDir, mDir, force) {
  const els = cacheDdfTheaterEls();
  if (!els.root || els.root.classList.contains('hidden')) return;
  if (els.femaleDir) els.femaleDir.textContent = fDir;
  if (els.maleDir) els.maleDir.textContent = mDir;
  if (els.cue) {
    const girl = activeGirlLabel() || '';
    els.cue.textContent = girl;
  }
  if (els.section) {
    const label = lastDdlcGirlLabel || '';
    const short = label.includes('·') ? label.split('·').pop().trim() : label;
    els.section.textContent = short || activeGirlLabel() || '—';
  }
  // FX is painted by startDdfFxLoop — avoid double-paint here
  updateCurrentLyrics(timeSec, force);
}

function updateUpNext() {
  const nextIdx = queueIndex + 1 < queue.length ? queue[queueIndex + 1] : (loopMode === 'all' && queue.length ? queue[0] : -1);
  const next = library[nextIdx];
  $('queue-next').textContent = next ? next.displayName : 'End of queue';
}

let lastUiTimeText = '';
let lastUiTotalText = '';
let lastUiSeekPct = -1;

let lastDdfThemeTick = -1;

function updatePlaybackVisuals() {
  // Uses native-backed calibrated time; kept off the visualizer rAF path
  const current = repairTimingState(currentCalibratedTime());
  const duration = effectiveDuration();
  const pct = duration ? clamp(0, 1, current / duration) : 0;
  const deg = `${(pct * 360).toFixed(2)}deg`;
  $('play').style.setProperty('--progress', deg);
  $('hero-play').style.setProperty('--progress', deg);

  // Four-girl cast themes tick during playback (spatial dock also ticks cast)
  {
    const th = detectDdlcGirlTheme(currentSong());
    if (th === 'theme-ddl-cast') {
      const tick = Math.floor(current * 10); // 100ms — short lyric lines need snappier color
      if (tick !== lastDdfThemeTick) {
        lastDdfThemeTick = tick;
        updateDdlcCastTheme(current);
      }
    }
  }

  const curText = fmtTime(current);
  const totText = fmtTime(duration);
  if (curText !== lastUiTimeText) {
    lastUiTimeText = curText;
    $('time-current').textContent = curText;
    $('hero-time-current').textContent = curText;
    const ddfCur = $('ddf-time-current');
    if (ddfCur) ddfCur.textContent = curText;
  }
  if (totText !== lastUiTotalText) {
    lastUiTotalText = totText;
    $('time-total').textContent = totText;
    $('hero-time-total').textContent = totText;
    const ddfTot = $('ddf-time-total');
    if (ddfTot) ddfTot.textContent = totText;
  }
  // Avoid writing identical seek values (layout thrash)
  const seekPct = Math.round(pct * 1000) / 10;
  if (seekPct !== lastUiSeekPct) {
    lastUiSeekPct = seekPct;
    $('seek').value = seekPct;
  }
  if (timingDebugEnabled) updateTimingDebug(current);
}

function updateMediaSession(song) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title || song.displayName,
    artist: song.artist || 'Unknown',
    album: currentPlaylist || 'vp'
  });
  navigator.mediaSession.setActionHandler('play', () => resumeAudioFromCalibratedClock());
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext(false));
}

function togglePlay() {
  if (!audio.src) {
    const visible = filteredLibraryEntries($('search').value);
    if (visible.length === 0) return;
    queue = visible.map(entry => entry.idx);
    queueIndex = 0;
    currentPlaylist = null;
    playCurrent();
    const song = library[queue[queueIndex]];
    showToast('▶', song?.title || song?.displayName || 'Playing');
    return;
  }
  if (audio.paused) {
    resumeAudioFromCalibratedClock();
    const song = library[queue[queueIndex]];
    showToast('▶', song?.title || song?.displayName || 'Playing');
    switchView('now');
  } else {
    audio.pause();
    showToast('⏸', 'Paused');
  }
}

function playNext(auto = false) {
  if (queue.length === 0) return;
  if (loopMode === 'one' && auto) {
    audio.currentTime = 0;
    resetCalibratedClock(0);
    resumeAudioFromCalibratedClock();
    return;
  }
  if (queueIndex + 1 < queue.length) {
    queueIndex++;
    playCurrent();
    if (!auto) {
      const song = library[queue[queueIndex]];
      showToast('⏭', song?.title || song?.displayName || 'Next');
    }
  } else if (loopMode === 'all') {
    queueIndex = 0;
    playCurrent();
    if (!auto) {
      const song = library[queue[queueIndex]];
      showToast('⏭', song?.title || song?.displayName || 'Next');
    }
  } else {
    audio.pause();
    audio.currentTime = 0;
    resetCalibratedClock(0);
    updatePlaybackVisuals();
  }
}

function playPrev() {
  if (queue.length === 0) return;
  if (currentCalibratedTime() > 3) {
    audio.currentTime = 0;
    resetCalibratedClock(0);
    if (!audio.paused) startCalibratedClock();
    updatePlaybackVisuals();
    showToast('⏮', 'Restart');
    return;
  }
  if (queueIndex > 0) {
    queueIndex--;
  } else if (loopMode === 'all') {
    queueIndex = queue.length - 1;
  } else {
    audio.currentTime = 0;
    resetCalibratedClock(0);
    if (!audio.paused) startCalibratedClock();
    updatePlaybackVisuals();
    showToast('⏮', 'Restart');
    return;
  }
  playCurrent();
  const song = library[queue[queueIndex]];
  showToast('⏮', song?.title || song?.displayName || 'Previous');
}

function toggleShuffle() {
  shuffled = !shuffled;
  $('shuffle').classList.toggle('on', shuffled);
  showToast('🔀', shuffled ? 'Shuffle on' : 'Shuffle off');
  if (queue.length === 0) return;
  if (shuffled) {
    unshuffledQueue = queue.slice();
    const current = queue[queueIndex];
    const rest = queue.filter((_, i) => i !== queueIndex);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    queue = [current, ...rest];
    queueIndex = 0;
  } else if (unshuffledQueue) {
    const current = queue[queueIndex];
    queue = unshuffledQueue;
    queueIndex = queue.indexOf(current);
    unshuffledQueue = null;
  }
}

function cycleLoop() {
  loopMode = { off: 'all', all: 'one', one: 'off' }[loopMode];
  const btn = $('loop');
  btn.dataset.mode = loopMode;
  btn.textContent = loopMode === 'one' ? '🔂' : '🔁';
  btn.title = `Loop: ${loopMode}`;
  const labels = { off: 'Loop off', all: 'Loop all', one: 'Loop one' };
  const icon = loopMode === 'one' ? '🔂' : '🔁';
  showToast(icon, labels[loopMode]);
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function rememberAudioGraphError(error) {
  audioGraphError = error?.message || String(error || 'Unknown audio graph error');
}

function ensureAudioContext() {
  if (audioCtx && audioCtx.state !== 'closed') return audioCtx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    audioGraphError = 'AudioContext unavailable';
    return null;
  }
  try {
    // Prefer 48 kHz to match remaster/traveling renders (avoids resampler smear)
    try {
      audioCtx = new AudioContextClass({ latencyHint: 'playback', sampleRate: 48000 });
    } catch (_) {
      audioCtx = new AudioContextClass({ latencyHint: 'playback' });
    }
    audioGraphError = '';
    return audioCtx;
  } catch (err) {
    rememberAudioGraphError(err);
    audioCtx = null;
    return null;
  }
}

function connectAudioGraph() {
  if (analyser) {
    if (audioCtx?.state === 'running') audio.volume = 1;
    if (outputGain) outputGain.gain.value = playerVolume;
    return true;
  }
  const ctx = ensureAudioContext();
  if (!ctx || ctx.state !== 'running') return false;
  try {
    audioSource = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = WAVE_FFT_SIZE;
    analyser.minDecibels = -92;
    analyser.maxDecibels = -18;
    analyser.smoothingTimeConstant = 0.35;
    analyser.channelCount = 2;
    analyser.channelCountMode = 'explicit';
    analyser.channelInterpretation = 'speakers';
    outputGain = ctx.createGain();
    outputGain.channelCount = 2;
    outputGain.channelCountMode = 'explicit';
    outputGain.channelInterpretation = 'speakers';
    outputGain.gain.value = playerVolume;
    waveData = new Float32Array(analyser.frequencyBinCount);
    waveTimeData = new Uint8Array(analyser.fftSize);
    // Preserve stereo: source -> gain -> speakers; analyser taps in parallel
    audioSource.connect(outputGain);
    audioSource.connect(analyser);
    outputGain.connect(ctx.destination);
    // analyser is sink-only (no connection to destination) so it cannot color the mix
    audio.volume = 1;
    audioGraphError = '';
    audioGraphActivatedAt = performance.now();
    startWaveform();
    return true;
  } catch (err) {
    rememberAudioGraphError(err);
    audio.volume = playerVolume;
    return false;
  }
}

/**
 * After createMediaElementSource, the browser never routes that <audio> natively again.
 * Swap in a fresh element so spatial tracks can play pure stereo (no Web Audio graph).
 */
function recreateAudioElementForNativePath() {
  if (!audioSource && !analyser) return false;
  const old = audio;
  const src = old?.currentSrc || old?.src || '';
  const t = Number.isFinite(old?.currentTime) ? old.currentTime : 0;
  try { old?.pause(); } catch (_) {}
  try { audioSource?.disconnect(); } catch (_) {}
  try { outputGain?.disconnect(); } catch (_) {}
  try { analyser?.disconnect(); } catch (_) {}
  audioSource = null;
  analyser = null;
  outputGain = null;
  waveData = null;
  waveTimeData = null;

  const next = document.createElement('audio');
  next.id = 'audio';
  next.preload = 'metadata';
  next.setAttribute('playsinline', '');
  next.playsInline = true;
  if (old?.parentNode) old.parentNode.replaceChild(next, old);
  else document.body.appendChild(next);
  audio = next;
  if (typeof bindAudioElementEvents === 'function') bindAudioElementEvents(audio);
  audio.muted = false;
  audio.volume = playerVolume;
  if (src) {
    audio.src = src;
    const onMeta = () => {
      try { if (t > 0) audio.currentTime = t; } catch (_) {}
      audio.removeEventListener('loadedmetadata', onMeta);
    };
    audio.addEventListener('loadedmetadata', onMeta);
    try { audio.load(); } catch (_) {}
  }
  audioGraphError = 'native-html-audio (spatial; element recreated)';
  audioGraphActivatedAt = 0;
  return true;
}

function ensureNativeRoutingForSpatialSong(song = currentSong()) {
  if (!prefersNativeAudio(song)) return false;
  if (!audioSource && !analyser) return false;
  return recreateAudioElementForNativePath();
}

async function activateAudioGraphIfPossible() {
  // Traveling Voices: stay on native <audio> path so levels/stereo match QuickTime.
  // (Web Audio MediaElementSource + sample-rate conversion was coloring the mix.)
  if (prefersNativeAudio()) {
    // Recreate only if still hijacked — callers should do this before play().
    // If we must recreate here, re-bind current song URL so playback can resume.
    if (audioSource || analyser) {
      const song = currentSong();
      const want = song?.url || '';
      const t = currentCalibratedTime(song);
      recreateAudioElementForNativePath();
      if (want) {
        audio.src = want;
        audio.load();
        try { if (t > 0.05) audio.currentTime = t; } catch (_) {}
        try { await audio.play(); } catch (_) {}
      }
    }
    audio.volume = playerVolume;
    audioGraphError = 'native-html-audio (spatial fidelity)';
    return false;
  }
  // If graph was already created for a prior song, we must keep using it
  if (audioSource) {
    const ctx = ensureAudioContext();
    if (ctx?.state === 'suspended') {
      try { await ctx.resume(); } catch (err) { rememberAudioGraphError(err); }
    }
    if (outputGain) outputGain.gain.value = playerVolume;
    audio.volume = 1;
    return true;
  }
  const ctx = ensureAudioContext();
  if (!ctx) {
    audio.volume = playerVolume;
    return false;
  }
  try {
    if (ctx.state === 'suspended') await ctx.resume();
  } catch (err) {
    rememberAudioGraphError(err);
    audio.volume = playerVolume;
    return false;
  }
  if (ctx.state !== 'running') {
    audioGraphError = `AudioContext ${ctx.state}`;
    audio.volume = playerVolume;
    return false;
  }
  return connectAudioGraph();
}

function ensureAudioGraph() {
  activateAudioGraphIfPossible().catch(err => {
    rememberAudioGraphError(err);
    audio.volume = playerVolume;
  });
}

function resizeWaveform(force = false) {
  const canvas = $('waveform');
  // Measure the PANEL, never the canvas — canvas is position:absolute with
  // width/height 100%, so reading its box before buffer sync was circular
  // and produced wrong aspect (bars looked stretched/squashed).
  const panel = canvas?.closest?.('.wave-panel') || canvas?.parentElement;
  if (!canvas || !panel) return;
  // Hidden (DDF theater hides wave) — skip so we don't stamp 0-size buffers
  if (panel.offsetParent === null && getComputedStyle(panel).display === 'none') return;

  const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  const rect = panel.getBoundingClientRect();
  const cssW = Math.max(2, Math.floor(rect.width));
  const cssH = Math.max(2, Math.floor(rect.height));
  // Not laid out yet (0×0) — try again next frame instead of inventing sizes
  if (cssW < 8 || cssH < 8) {
    if (force) {
      requestAnimationFrame(() => resizeWaveform(true));
    }
    return;
  }

  const w = Math.max(2, Math.floor(cssW * dpr));
  const h = Math.max(2, Math.floor(cssH * dpr));
  const key = `${w}x${h}@${cssW}x${cssH}`;
  if (!force && key === waveSizeKey) return;
  waveSizeKey = key;
  // Drawing buffer only — CSS size is controlled by stylesheet (absolute fill)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

/** Double-rAF: wait for CSS grid to settle, then size canvases to real boxes. */
function scheduleNowLayoutSync() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      waveSizeKey = '';
      fxSizeKey = '';
      resizeWaveform(true);
      resizeFxCanvas(true);
      if (document.body.classList.contains('ddf-theater-active')) {
        ddfFxSizeKey = '';
        ddfFxCtx = null;
        resizeDdfFxCanvas(true);
        paintDdfTheaterFx(currentCalibratedTime());
      }
    });
  });
}

function resizeFxCanvas(force = false) {
  const canvas = $('teto-fx');
  const view = $('view-now');
  if (!canvas || !view) return;
  // FX is full-view; keep DPR low so particle/beam frames stay on budget
  const dpr = Math.min(1.25, Math.max(1, window.devicePixelRatio || 1));
  const rect = view.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.max(320, Math.floor(rect.height * dpr));
  const key = `${w}x${h}`;
  if (!force && key === fxSizeKey) return;
  fxSizeKey = key;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function startWaveform() {
  if (waveRaf) return;
  const draw = () => {
    waveRaf = requestAnimationFrame(draw);
    // Visualizer only needs to run on Now Playing. Progress clock handles timing elsewhere.
    if (!isNowViewActive()) return;
    if (audio.paused) {
      // Idle settle frame occasionally, not 60fps
      if (waveFrame % 30 === 0) drawWaveform(true);
      waveFrame++;
      return;
    }
    drawWaveform(false);
  };
  waveRaf = requestAnimationFrame(draw);
}

function stopWaveformLoop() {
  if (waveRaf) {
    cancelAnimationFrame(waveRaf);
    waveRaf = 0;
  }
}

function startProgressClock() {
  if (progressTimer) return;
  const tick = () => {
    // Lightweight: only progress ring / seek / times — never full visualizer
    if (!audio.src) return;
    updatePlaybackVisuals();
  };
  tick();
  progressTimer = setInterval(tick, PROGRESS_MS);
}

function stopProgressClock() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = 0;
  }
}

function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

function softLimit(value, limit) {
  return limit * Math.tanh(value / limit);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - clamp(0, 1, value), 3);
}

function easeInOut(value) {
  const t = clamp(0, 1, value);
  return t * t * (3 - 2 * t);
}

function smoothStep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  return easeInOut((value - edge0) / (edge1 - edge0));
}

function percentile(sortedValues, percent) {
  if (!sortedValues.length) return 0;
  const index = Math.floor((sortedValues.length - 1) * percent);
  return sortedValues[index];
}

function normalizedWaveLevel(rms, peak) {
  // EMA floor/peak — O(1). Old path sorted a 180-sample window every frame.
  const blendedEnergy = Math.max(0.00002, rms * 0.72 + peak * 0.28);
  const db = 20 * Math.log10(blendedEnergy);
  waveFloorDb = waveFloorDb * 0.995 + db * 0.005;
  if (db > wavePeakDb) wavePeakDb = wavePeakDb * 0.85 + db * 0.15;
  else wavePeakDb = wavePeakDb * 0.997 + db * 0.003;
  const dynamicSpan = Math.max(2.8, wavePeakDb - waveFloorDb);
  const relativeLevel = clamp(0, 1, (db - waveFloorDb) / dynamicSpan);
  const absoluteLevel = smoothStep(-44, -14, db);
  const gatedRelative = smoothStep(0.12, 0.92, relativeLevel);
  return clamp(0, 1, Math.max(gatedRelative, absoluteLevel * 0.18));
}

function waveBaseShape(i, total) {
  const x = total <= 1 ? 0.5 : i / (total - 1);
  const edgeTaper = 0.58 + 0.42 * Math.sin(Math.PI * x);
  const stableTexture = 0.92
    + 0.055 * Math.sin(i * 0.71 + 0.8)
    + 0.045 * Math.sin(i * 1.83 + 1.9)
    + 0.03 * Math.sin(i * 3.17);
  return clamp(0.34, 1, edgeTaper * stableTexture);
}

function waveBandRange(index, total) {
  if (!audioCtx) return {bin0: 0, bin1: 1, centerRatio: 0.5, centerFreq: 440};
  const nyquist = audioCtx.sampleRate / 2;
  const maxFreq = Math.min(WAVE_MAX_FREQ, nyquist * 0.92);
  const t0 = index / total;
  const t1 = (index + 1) / total;
  const f0 = WAVE_MIN_FREQ * Math.pow(maxFreq / WAVE_MIN_FREQ, t0);
  const f1 = WAVE_MIN_FREQ * Math.pow(maxFreq / WAVE_MIN_FREQ, t1);
  const bin0 = clamp(0, waveData.length - 1, Math.floor(f0 / nyquist * waveData.length));
  const bin1 = clamp(bin0 + 1, waveData.length, Math.ceil(f1 / nyquist * waveData.length));
  const centerFreq = Math.sqrt(f0 * f1);
  const centerRatio = clamp(0, 1, Math.log(centerFreq / WAVE_MIN_FREQ) / Math.log(maxFreq / WAVE_MIN_FREQ));
  return {bin0, bin1, centerRatio, centerFreq};
}

function dbToWaveEnergy(db) {
  if (!Number.isFinite(db) || !analyser) return 0;
  const normalized = (db - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels);
  return Math.pow(clamp(0, 1, normalized), 1.16);
}

function waveBandEnergy(index, total) {
  if (!analyser || !waveData || !audioCtx) return 0;
  const {bin0, bin1, centerFreq} = waveBandRange(index, total);
  let sum = 0;
  let peak = 0;
  let count = 0;
  for (let b = bin0; b < bin1; b++) {
    const energy = dbToWaveEnergy(waveData[b]);
    sum += energy;
    peak = Math.max(peak, energy);
    count++;
  }
  const avg = count ? sum / count : 0;
  const peakLift = Math.max(0, peak - avg);
  const presenceBias = centerFreq < 90 ? 0.82
    : centerFreq < 230 ? 1.12
    : centerFreq < 1800 ? 1.02
    : centerFreq < 7200 ? 1.18
    : 0.94;
  return clamp(0, 1, (avg * 0.46 + peak * 0.62 + peakLift * 0.58) * presenceBias);
}

function ensureWaveBars(count) {
  if (waveBars.length === count) return;
  waveBars = Array.from({length: count}, (_, i) => waveBaseShape(i, count) * 0.018);
}

function resetWaveEnvelope() {
  smoothedLevel = 0;
  wavePitchFocus = 0.5;
  tetoFxLevel = 0;
  tetoGlowLevel = 0;
  tetoRiseEnergy = 0;
  lastTetoAmplitude = 0;
  waveLevelWindow = [];
  waveFloorDb = -48;
  wavePeakDb = -18;
  waveBars = waveBars.map((_, i) => waveBaseShape(i, waveBars.length) * 0.01);
  updateFxState();
}

function smoothTetoFxLevels(level) {
  const audible = !!(isAnyFxActive() && audio.src && !audio.paused);
  if (!audible) {
    tetoFxLevel = 0;
    tetoGlowLevel = 0;
    return {motion: 0, glow: 0};
  }
  const rise = clamp(0, 1, tetoRiseEnergy);
  const motionTarget = smoothStep(0.04, 0.88, rise);
  const glowTarget = Math.pow(rise, 0.62);
  const motionRate = motionTarget > tetoFxLevel ? 0.065 : 0.022;
  const glowRate = glowTarget > tetoGlowLevel ? 0.055 : 0.018;
  tetoFxLevel = tetoFxLevel * (1 - motionRate) + motionTarget * motionRate;
  tetoGlowLevel = tetoGlowLevel * (1 - glowRate) + glowTarget * glowRate;
  return {motion: tetoFxLevel, glow: tetoGlowLevel};
}

function drawDiamond(ctx, x, y, size, angle, fillStyle, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.56, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.56, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function rgbaColor(color, alpha) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPixelHeart(ctx, x, y, size, color, alpha, angle = 0) {
  if (alpha <= 0) return;
  const rows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  const block = size / 7;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = block * 1.8;
  ctx.fillStyle = color;
  const left = -size / 2;
  const top = -rows.length * block / 2;
  rows.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (cell !== '1') return;
      const bx = left + colIndex * block;
      const by = top + rowIndex * block;
      ctx.fillRect(bx, by, block * 0.82, block * 0.82);
    });
  });
  ctx.restore();
}

function drawLedSpark(ctx, x, y, size, color, alpha, twinkle = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = 'rgba(255, 248, 230, 0.82)';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 1.25;
  ctx.lineWidth = Math.max(1, size * 0.18);
  ctx.lineCap = 'round';
  const arm = size * (0.62 + twinkle * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - arm, y);
  ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm);
  ctx.lineTo(x, y + arm);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, size * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRobotHeartGlyph(ctx, x, y, size, alpha, color, pulse) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * (0.12 + pulse * 0.16);
  ctx.lineWidth = Math.max(1, size * 0.045);
  roundedRectPath(ctx, -size * 0.48, -size * 0.36, size * 0.96, size * 0.72, size * 0.13);
  ctx.fillStyle = 'rgba(34, 18, 20, 0.32)';
  ctx.strokeStyle = color;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 237, 222, 0.58)';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.36);
  ctx.lineTo(0, -size * 0.54);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -size * 0.59, size * 0.055, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 242, 232, 0.86)';
  roundedRectPath(ctx, -size * 0.27, -size * 0.11, size * 0.17, size * 0.1, size * 0.05);
  ctx.fill();
  roundedRectPath(ctx, size * 0.1, -size * 0.11, size * 0.17, size * 0.1, size * 0.05);
  ctx.fill();
  drawPixelHeart(ctx, 0, size * 0.18, size * (0.2 + pulse * 0.06), color, 0.72);
  ctx.restore();
}

// Outbound rings from the hero play button were a major lag source (spawn + stroke every beat).
// Disabled permanently — keep stubs so theme drawers can still call them safely.
function emitOutboundRingPulse() {
  /* no-op */
}

function drawOutboundPulseRings() {
  if (fxRingPulses.length) fxRingPulses.length = 0;
}

function drawDiscoFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse) {
  const quietGate = smoothStep(0.08, 0.34, levels.motion);
  const party = smoothStep(0.16, 0.72, levels.motion);
  if (!profile?.constantRings && quietGate <= 0.01 && levels.glow <= 0.02) return;

  const t = performance.now() / 1000;
  const scale = Math.max(1, Math.min(w, h) / 760);
  const bpmPulse = profile ? beatPulse * (0.28 + sectionPower * 0.72) : 0;
  const chorusLift = section?.chorus ? sectionPower * 0.72 : 0;
  const chorusBoost = clamp(0, 1, chorusLift / 0.72);
  const washDim = 0.46 + chorusBoost * 0.54;
  const glowDim = 0.44 + chorusBoost * 0.56;
  const beamDensity = 0.18 + chorusBoost * 0.42;
  const beamDim = 0.32 + chorusBoost * 0.42;
  const sparkleDensity = 0.18 + chorusBoost * 0.46;
  const sparkleDim = 0.3 + chorusBoost * 0.46;
  const pulseLevel = clamp(0, 1, levels.glow * 0.48 + party * 0.34 + bpmPulse * (0.32 + chorusLift));
  const beamPower = quietGate * (0.1 + party * 0.32 + chorusLift * 0.96) * (0.62 + beatPulse * 0.56) * beamDim;
  const palette = [
    [255, 55, 155],
    [70, 218, 255],
    [255, 232, 91],
    [129, 92, 255],
    [78, 255, 167],
    [255, 112, 74],
    [246, 78, 255],
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const stageWash = ctx.createLinearGradient(0, 0, w, h);
  stageWash.addColorStop(0, `rgba(255, 55, 155, ${(0.012 + pulseLevel * 0.14) * washDim})`);
  stageWash.addColorStop(0.28, `rgba(79, 216, 255, ${(0.01 + pulseLevel * 0.12) * washDim})`);
  stageWash.addColorStop(0.62, `rgba(255, 232, 91, ${(0.006 + pulseLevel * 0.09) * washDim})`);
  stageWash.addColorStop(1, `rgba(124, 92, 255, ${(0.014 + pulseLevel * 0.14) * washDim})`);
  ctx.fillStyle = stageWash;
  ctx.fillRect(0, 0, w, h);

  const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * (0.35 + pulseLevel * 0.22));
  centerGlow.addColorStop(0, `rgba(255, 255, 228, ${(0.024 + pulseLevel * 0.11) * glowDim})`);
  centerGlow.addColorStop(0.34, `rgba(70, 218, 255, ${(0.014 + pulseLevel * 0.1) * glowDim})`);
  centerGlow.addColorStop(0.68, `rgba(255, 55, 155, ${(0.006 + pulseLevel * 0.07) * glowDim})`);
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, w, h);

  DISCO_BEAMS.forEach((beam, i) => {
    if (seededUnit((i + 1) * 31.77) > beamDensity) return;
    const color = palette[beam.colorIndex];
    const originPhase = (beam.origin + Math.floor(t * 0.18)) % 4;
    const origins = [
      {x: w * (0.1 + seededUnit(i * 2.1) * 0.8), y: -h * 0.08, base: Math.PI * 0.5},
      {x: w * 1.08, y: h * (0.12 + seededUnit(i * 3.2) * 0.78), base: Math.PI},
      {x: w * (0.1 + seededUnit(i * 5.3) * 0.8), y: h * 1.08, base: -Math.PI * 0.5},
      {x: -w * 0.08, y: h * (0.12 + seededUnit(i * 7.4) * 0.78), base: 0},
    ];
    const origin = origins[originPhase];
    const sweep = Math.sin(t * beam.speed + beam.phase) * (0.42 + chorusLift * 0.22);
    const angle = origin.base + sweep + beatPulse * 0.06;
    const length = Math.max(w, h) * (0.94 + chorusLift * 0.28);
    const halfWidth = length * (beam.width + beatPulse * 0.018);
    const alpha = beamPower * (0.024 + (i % 3) * 0.006 + chorusLift * 0.052);
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, length, 0);
    grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 1.8})`);
    grad.addColorStop(0.42, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
    grad.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, halfWidth);
    ctx.lineTo(length, -halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  drawOutboundPulseRings(ctx, {
    theme: 'disco',
    w,
    h,
    cx,
    cy,
    levels,
    profile,
    fxTime,
    sectionPower,
    chorusPower,
    beatPulse,
    palette,
    baseRadius: Math.min(w, h) * (0.11 + pulseLevel * 0.015),
    travelRadius: Math.min(w, h) * (0.3 + pulseLevel * 0.12 + chorusBoost * 0.12),
    alphaBase: 0.18 + chorusBoost * 0.09,
    lineWidth: (1.05 + pulseLevel * 2.4) * scale,
    life: 0.62,
  });

  const ballRadius = Math.min(w, h) * (0.045 + pulseLevel * 0.018);
  const ballX = clamp(ballRadius * 1.4, w - ballRadius * 1.4, cx);
  const ballY = clamp(ballRadius * 1.5, h - ballRadius * 1.5, cy - Math.min(h * 0.24, 160 * scale));
  ctx.save();
  ctx.translate(ballX, ballY);
  ctx.rotate(t * 0.24);
  const ballGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, ballRadius * 1.9);
  ballGlow.addColorStop(0, `rgba(255, 255, 232, ${(0.05 + pulseLevel * 0.09) * glowDim})`);
  ballGlow.addColorStop(0.58, `rgba(70, 218, 255, ${(0.022 + pulseLevel * 0.06) * glowDim})`);
  ballGlow.addColorStop(1, 'rgba(70, 218, 255, 0)');
  ctx.fillStyle = ballGlow;
  ctx.beginPath();
  ctx.arc(0, 0, ballRadius * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 232, ${0.08 + pulseLevel * 0.16})`;
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.beginPath();
  ctx.arc(0, 0, ballRadius * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-ballRadius * 0.6, 0);
  ctx.lineTo(ballRadius * 0.6, 0);
  ctx.moveTo(0, -ballRadius * 0.6);
  ctx.lineTo(0, ballRadius * 0.6);
  ctx.stroke();
  ctx.restore();

  DISCO_SPARKLES.forEach((dot, i) => {
    if (seededUnit((i + 1) * 47.19) > sparkleDensity) return;
    const color = palette[i % palette.length];
    const twinkle = 0.5 + Math.sin(t * (1.2 + (i % 7) * 0.24) + dot.phase) * 0.5;
    const appear = smoothStep(dot.threshold, Math.min(1, dot.threshold + 0.5), party + chorusLift * 0.65 + beatPulse * 0.18);
    const alpha = appear * quietGate * sparkleDim * (0.026 + twinkle * 0.14 + beatPulse * (0.04 + chorusBoost * 0.07));
    if (alpha <= 0.01) return;
    const drift = (8 + party * 22) * scale;
    const x = dot.x * w + Math.sin(t * 0.24 + dot.phase) * drift;
    const y = dot.y * h + Math.cos(t * 0.18 + dot.phase) * drift;
    const size = dot.size * scale * (0.72 + beatPulse * 0.65 + twinkle * 0.34);
    ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
    ctx.lineWidth = Math.max(1, scale * 1.1);
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 245, ${alpha * 0.65})`;
    ctx.fill();
  });

  ctx.restore();
}

function drawTeto11Fx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, protectedPoint = () => false) {
  const quietGate = smoothStep(0.08, 0.34, levels.motion);
  const party = smoothStep(0.16, 0.72, levels.motion);
  if (!profile?.constantRings && quietGate <= 0.01 && levels.glow <= 0.02) return;

  const t = performance.now() / 1000;
  const scale = Math.max(1, Math.min(w, h) / 760);
  const chorusLift = section?.chorus ? sectionPower * 0.72 : 0;
  const chorusBoost = clamp(0, 1, chorusLift / 0.72);
  const bpmPulse = profile ? beatPulse * (0.3 + sectionPower * 0.7) : 0;
  const alive = clamp(0, 1, levels.glow * 0.42 + party * 0.32 + bpmPulse * (0.34 + chorusLift * 0.76));
  const palette = [
    [255, 91, 54],
    [255, 58, 171],
    [70, 218, 255],
    [255, 232, 91],
    [132, 102, 255],
    [78, 255, 167],
    [236, 242, 255],
  ];
  const tetoOrange = palette[0];
  const pink = palette[1];
  const cyan = palette[2];
  const yellow = palette[3];
  const violet = palette[4];
  const chrome = palette[6];

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const washDim = 0.6 + chorusBoost * 0.34;
  const stageWash = ctx.createLinearGradient(0, 0, w, h);
  stageWash.addColorStop(0, `rgba(255, 58, 171, ${(0.012 + alive * 0.09 + chorusLift * 0.045) * washDim})`);
  stageWash.addColorStop(0.28, `rgba(70, 218, 255, ${(0.012 + alive * 0.08 + chorusLift * 0.045) * washDim})`);
  stageWash.addColorStop(0.56, `rgba(255, 232, 91, ${(0.006 + alive * 0.055 + chorusLift * 0.035) * washDim})`);
  stageWash.addColorStop(0.78, `rgba(255, 91, 54, ${(0.006 + alive * 0.04 + chorusLift * 0.025) * washDim})`);
  stageWash.addColorStop(1, `rgba(132, 102, 255, ${(0.012 + alive * 0.075 + chorusLift * 0.04) * washDim})`);
  ctx.fillStyle = stageWash;
  ctx.fillRect(0, 0, w, h);

  const leftGlow = ctx.createRadialGradient(w * 0.18, h * 0.76, 0, w * 0.18, h * 0.76, Math.max(w, h) * 0.42);
  leftGlow.addColorStop(0, `rgba(255, 58, 171, ${0.016 + alive * 0.07 + chorusLift * 0.05})`);
  leftGlow.addColorStop(1, 'rgba(255, 58, 171, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, w, h);

  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * (0.34 + alive * 0.24));
  coreGlow.addColorStop(0, `rgba(236, 242, 255, ${0.03 + alive * 0.1 + chorusLift * 0.065})`);
  coreGlow.addColorStop(0.34, `rgba(70, 218, 255, ${0.018 + alive * 0.08 + chorusLift * 0.055})`);
  coreGlow.addColorStop(0.68, `rgba(255, 91, 54, ${0.006 + alive * 0.035 + chorusLift * 0.025})`);
  coreGlow.addColorStop(1, 'rgba(70, 218, 255, 0)');
  ctx.fillStyle = coreGlow;
  ctx.fillRect(0, 0, w, h);

  const beamDensity = 0.32 + chorusBoost * 0.46;
  const beamPower = quietGate * (0.08 + party * 0.28 + chorusLift * 0.78) * (0.56 + beatPulse * 0.46);
  TETO11_BEAMS.forEach((beam, i) => {
    if (seededUnit((i + 1) * 77.03) > beamDensity) return;
    const color = palette[beam.colorIndex];
    const originPhase = (beam.origin + Math.floor(t * 0.18)) % 4;
    const origins = [
      {x: w * (0.1 + seededUnit(i * 7.1) * 0.8), y: -h * 0.08, base: Math.PI * 0.5},
      {x: w * 1.08, y: h * (0.12 + seededUnit(i * 5.4) * 0.78), base: Math.PI},
      {x: w * (0.1 + seededUnit(i * 3.9) * 0.8), y: h * 1.08, base: -Math.PI * 0.5},
      {x: -w * 0.08, y: h * (0.12 + seededUnit(i * 9.2) * 0.78), base: 0},
    ];
    const origin = origins[originPhase];
    const sweep = Math.sin(t * beam.speed + beam.phase) * (0.38 + chorusBoost * 0.22);
    const angle = origin.base + sweep + beatPulse * 0.05;
    const length = Math.max(w, h) * (0.98 + chorusLift * 0.34);
    const halfWidth = length * (beam.width + beatPulse * 0.014);
    const alpha = beamPower * (0.026 + (i % 3) * 0.007 + chorusLift * 0.06);
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(angle);
    const beamGrad = ctx.createLinearGradient(0, 0, length, 0);
    beamGrad.addColorStop(0, rgbaColor(color, alpha * 1.5));
    beamGrad.addColorStop(0.48, rgbaColor(color, alpha));
    beamGrad.addColorStop(1, rgbaColor(color, 0));
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, halfWidth);
    ctx.lineTo(length, -halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  drawOutboundPulseRings(ctx, {
    theme: 'teto11',
    w,
    h,
    cx,
    cy,
    levels,
    profile,
    fxTime,
    sectionPower,
    chorusPower,
    beatPulse,
    palette: [tetoOrange, pink, cyan, yellow, violet, chrome],
    baseRadius: Math.min(w, h) * (0.11 + alive * 0.015),
    travelRadius: Math.min(w, h) * (0.3 + alive * 0.12 + chorusBoost * 0.12),
    alphaBase: 0.2 + chorusBoost * 0.1,
    lineWidth: (1.05 + alive * 2.7) * scale,
    life: 0.66,
  });

  const heartAlpha = quietGate * (0.018 + alive * 0.04 + chorusLift * 0.08);
  if (heartAlpha > 0.02) {
    const heartWidth = Math.min(w, h) * (0.22 + alive * 0.08);
    const startX = cx - heartWidth * 0.5;
    const startY = cy + Math.min(h * 0.18, 140 * scale);
    const points = [
      [0, 0], [0.1, 0], [0.16, -0.1], [0.22, 0.12], [0.34, -0.02],
      [0.45, -0.02], [0.53, 0.12], [0.62, -0.08], [0.7, 0], [1, 0],
    ];
    ctx.save();
    ctx.translate(startX, startY);
    ctx.strokeStyle = rgbaColor(pink, heartAlpha * (0.7 + beatPulse * 0.6));
    ctx.lineWidth = Math.max(1, 1.4 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = rgbaColor(pink, 0.75);
    ctx.shadowBlur = 5 * scale * (0.35 + alive);
    ctx.beginPath();
    points.forEach((point, index) => {
      const px = point[0] * heartWidth;
      const py = point[1] * heartWidth * 0.42;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  const sparkleDensity = 0.3 + chorusBoost * 0.5;
  TETO11_SPARKS.forEach((dot, i) => {
    if (seededUnit((i + 1) * 61.41) > sparkleDensity) return;
    const color = palette[i % palette.length];
    const twinkle = 0.5 + Math.sin(t * (0.9 + (i % 8) * 0.12) + dot.phase) * 0.5;
    const appear = smoothStep(dot.threshold, Math.min(1, dot.threshold + 0.42), party * 0.78 + chorusLift * 0.7 + beatPulse * 0.16);
    const alpha = appear * quietGate * (0.028 + twinkle * 0.13 + beatPulse * (0.04 + chorusBoost * 0.07));
    if (alpha <= 0.01) return;
    const drift = (4 + party * 11 + chorusBoost * 5) * scale;
    const x = dot.x * w + Math.sin(t * 0.2 + dot.phase) * drift;
    const y = dot.y * h + Math.cos(t * 0.16 + dot.phase) * drift;
    if (protectedPoint(x, y)) return;
    drawLedSpark(ctx, x, y, dot.size * scale * (0.82 + twinkle * 0.42 + beatPulse * 0.52), rgbaColor(color, 0.92), alpha, twinkle);
  });

  const heartDensity = 0.12 + chorusBoost * 0.32;
  TETO11_HEARTS.forEach((heart, i) => {
    if (seededUnit((i + 1) * 19.73) > heartDensity) return;
    const appear = smoothStep(heart.threshold, Math.min(1, heart.threshold + 0.45), party * 0.58 + chorusLift * 0.7 + beatPulse * 0.12);
    if (appear <= 0.01) return;
    const drift = (4 + party * 8 + chorusBoost * 3) * scale;
    const x = heart.x * w + Math.sin(t * 0.13 + heart.phase) * drift;
    const y = heart.y * h + Math.cos(t * 0.16 + heart.phase * 0.8) * drift;
    if (protectedPoint(x, y)) return;
    const color = i % 3 === 0 ? '#ff3aab' : (i % 3 === 1 ? '#46daff' : '#ff5b36');
    const alpha = appear * quietGate * (0.032 + chorusBoost * 0.1 + beatPulse * (0.022 + chorusBoost * 0.042));
    const size = heart.size * scale * (1.7 + chorusBoost * 0.38 + beatPulse * 0.24);
    drawPixelHeart(ctx, x, y, size, color, alpha, Math.sin(t * 0.22 + heart.phase) * 0.08);
  });

  const robotAppear = smoothStep(0.28, 0.9, party * 0.68 + chorusLift * 0.58 + beatPulse * 0.1);
  TETO11_ROBOTS.forEach((bot, i) => {
    const x = bot.x * w + Math.sin(t * 0.08 + bot.phase) * 8 * scale;
    const y = bot.y * h + Math.cos(t * 0.11 + bot.phase) * 8 * scale;
    if (protectedPoint(x, y)) return;
    const color = rgbaColor(i % 2 ? chrome : cyan, 0.95);
    const alpha = robotAppear * quietGate * (0.026 + chorusBoost * 0.07 + beatPulse * 0.03);
    drawRobotHeartGlyph(ctx, x, y, bot.size * scale * (0.78 + chorusBoost * 0.14), alpha, color, beatPulse);
  });

  ctx.restore();
}

/** Primary colors per Literature Club girl (exact club palette). */
const DDLC_GIRL_COLORS = {
  sayori: { primary: [87, 199, 255], secondary: [255, 143, 171], accent: [255, 232, 245] },
  natsuki: { primary: [255, 179, 201], secondary: [255, 92, 143], accent: [255, 245, 248] },
  yuri: { primary: [124, 77, 255], secondary: [183, 148, 246], accent: [236, 230, 255] },
  monika: { primary: [16, 185, 129], secondary: [110, 231, 183], accent: [220, 255, 240] },
};

function activeDdlcGirlKey() {
  if (document.body.classList.contains('theme-sayori')) return 'sayori';
  if (document.body.classList.contains('theme-natsuki')) return 'natsuki';
  if (document.body.classList.contains('theme-yuri')) return 'yuri';
  if (document.body.classList.contains('theme-monika')) return 'monika';
  return 'monika';
}

const DDLC_HEARTS = Array.from({ length: 18 }, (_, i) => ({
  x: seededUnit((i + 1) * 13.7),
  y: seededUnit((i + 1) * 29.1),
  size: 10 + seededUnit((i + 1) * 41.3) * 18,
  phase: seededUnit((i + 1) * 7.9) * Math.PI * 2,
  speed: 0.35 + seededUnit((i + 1) * 19.2) * 0.85,
  spin: (seededUnit((i + 1) * 5.5) - 0.5) * 0.8,
}));

const DDLC_BEAMS = Array.from({ length: 8 }, (_, i) => ({
  origin: i % 4,
  phase: seededUnit((i + 1) * 11.3) * Math.PI * 2,
  speed: 0.22 + seededUnit((i + 1) * 17.8) * 0.4,
  width: 0.012 + seededUnit((i + 1) * 23.1) * 0.02,
  colorIndex: i % 3,
}));

/**
 * DDLC overlay FX on the main Now canvas — girl colors, loud.
 * Theater stage uses paintDdfTheaterFx; this adds page-wide wash.
 * Visual only; does not touch the spatial audio graph.
 */
function drawDdlcFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse) {
  // Always paint when DDF is active (even quiet intros) — user wants full effects
  // Lofi cut: same girl palette, calmer pulse / wash (custom chill profile)
  const lofiEase = profile?.lofi ? 0.68 : 1;
  const quietGate = Math.max(0.35, smoothStep(0.02, 0.2, levels.motion)) * (profile?.lofi ? 0.9 : 1);
  const party = Math.max(0.4, smoothStep(0.05, 0.55, levels.motion)) * lofiEase;

  const girl = activeDdlcGirlKey();
  const colors = DDLC_GIRL_COLORS[girl] || DDLC_GIRL_COLORS.monika;
  const p = colors.primary;
  const s = colors.secondary;
  const a = colors.accent;
  const t = performance.now() / 1000;
  const scale = Math.max(1, Math.min(w, h) / 760);
  const chorusLift = (section?.chorus ? sectionPower * 0.9 : sectionPower * 0.35) * lofiEase;
  const chorusBoost = clamp(0, 1, chorusLift / 0.9);
  const bpmPulse = (profile ? beatPulse * (0.45 + sectionPower * 0.7) : beatPulse) * (profile?.lofi ? 0.8 : 1);
  const alive = clamp(0, 1, 0.45 + levels.glow * 0.35 + party * 0.25 + bpmPulse * 0.45 + chorusLift * 0.4);
  const glowDim = 0.75 + chorusBoost * 0.35;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Soft character color stage wash
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${(0.014 + alive * 0.09 + chorusLift * 0.05) * glowDim})`);
  wash.addColorStop(0.45, `rgba(${s[0]}, ${s[1]}, ${s[2]}, ${(0.01 + alive * 0.07 + chorusLift * 0.04) * glowDim})`);
  wash.addColorStop(1, `rgba(${a[0]}, ${a[1]}, ${a[2]}, ${(0.008 + alive * 0.05) * glowDim})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // Center bloom (heartbeat)
  const heartPulse = 0.55 + bpmPulse * 0.55 + Math.sin(t * (profile?.bpm ? profile.bpm / 60 : 2.75) * Math.PI * 2) * 0.08;
  const coreR = Math.max(w, h) * (0.22 + alive * 0.18 + bpmPulse * 0.08);
  const core = ctx.createRadialGradient(cx, cy * 0.92, 0, cx, cy * 0.92, coreR);
  core.addColorStop(0, `rgba(${a[0]}, ${a[1]}, ${a[2]}, ${0.03 + alive * 0.1 + bpmPulse * 0.08})`);
  core.addColorStop(0.4, `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${0.02 + alive * 0.07 + chorusLift * 0.04})`);
  core.addColorStop(1, `rgba(${p[0]}, ${p[1]}, ${p[2]}, 0)`);
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  // Soft side beams in girl palette (disco-like but softer / pastel)
  const beamDensity = 0.28 + chorusBoost * 0.48;
  const beamPower = quietGate * (0.07 + party * 0.24 + chorusLift * 0.7) * (0.5 + beatPulse * 0.5);
  const palette = [p, s, a];
  DDLC_BEAMS.forEach((beam, i) => {
    if (seededUnit((i + 1) * 31.77) > beamDensity) return;
    const color = palette[beam.colorIndex % palette.length];
    const originPhase = (beam.origin + Math.floor(t * 0.14)) % 4;
    const origins = [
      { x: w * (0.12 + seededUnit(i * 2.1) * 0.76), y: -h * 0.06, base: Math.PI * 0.5 },
      { x: w * 1.06, y: h * (0.15 + seededUnit(i * 3.2) * 0.7), base: Math.PI },
      { x: w * (0.12 + seededUnit(i * 5.3) * 0.76), y: h * 1.06, base: -Math.PI * 0.5 },
      { x: -w * 0.06, y: h * (0.15 + seededUnit(i * 7.4) * 0.7), base: 0 },
    ];
    const origin = origins[originPhase];
    const sweep = Math.sin(t * beam.speed + beam.phase) * (0.36 + chorusLift * 0.18);
    const angle = origin.base + sweep + beatPulse * 0.05;
    const length = Math.max(w, h) * (0.9 + chorusLift * 0.22);
    const halfWidth = length * (beam.width + beatPulse * 0.012);
    const alpha = beamPower * (0.02 + (i % 3) * 0.006 + chorusLift * 0.04);
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(0, 0, length, 0);
    grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 1.6})`);
    grad.addColorStop(0.45, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
    grad.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, halfWidth);
    ctx.lineTo(length, -halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Beat rings (inline — shared pulse helper is a no-op stub)
  if (bpmPulse > 0.08 || chorusBoost > 0.15) {
    const ringCount = 3;
    for (let r = 0; r < ringCount; r++) {
      const life = (bpmPulse + r * 0.22) % 1;
      const rad = Math.min(w, h) * (0.08 + life * (0.22 + chorusBoost * 0.1));
      const alpha = (1 - life) * (0.1 + chorusBoost * 0.08 + bpmPulse * 0.1) * alive;
      if (alpha < 0.01) continue;
      const col = r % 2 ? s : p;
      ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${alpha})`;
      ctx.lineWidth = (1.2 + (1 - life) * 2.4) * scale;
      ctx.beginPath();
      ctx.arc(cx, cy * 0.92, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Floating pixel hearts — denser on chorus / monika bridge glitch tint handled via color
  const heartDensity = 0.4 + chorusBoost * 0.55 + bpmPulse * 0.15;
  DDLC_HEARTS.forEach((dot, i) => {
    if (seededUnit((i + 1) * 47.19) > heartDensity) return;
    const color = i % 2 === 0 ? p : s;
    const floatY = (dot.y + (t * dot.speed * 0.04) % 1.2) % 1.2 - 0.1;
    const x = (dot.x + Math.sin(t * 0.3 + dot.phase) * 0.04) * w;
    const y = floatY * h;
    const twinkle = 0.5 + Math.sin(t * (1.1 + (i % 5) * 0.2) + dot.phase) * 0.5;
    const alpha = quietGate * (0.04 + twinkle * 0.14 + bpmPulse * 0.1 + chorusLift * 0.08) * heartPulse;
    if (alpha < 0.01) return;
    const size = dot.size * scale * (0.7 + bpmPulse * 0.45 + twinkle * 0.2);
    const css = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    drawPixelHeart(ctx, x, y, size, css, alpha, t * dot.spin + dot.phase);
  });

  // Monika: light scanline glitch shimmer
  if (girl === 'monika' && (chorusBoost > 0.2 || section?.name === 'Bridge')) {
    const glitchAlpha = (0.02 + chorusBoost * 0.05 + bpmPulse * 0.04) * alive;
    for (let g = 0; g < 5; g++) {
      if (seededUnit(t * 40 + g * 9.1) > 0.55) continue;
      const gy = seededUnit(t * 12 + g) * h;
      const gh = (2 + seededUnit(g * 3.3) * 8) * scale;
      ctx.fillStyle = `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${glitchAlpha})`;
      ctx.fillRect(0, gy, w, gh);
    }
  }

  // Sayori: extra soft heart ring on strong beats
  if (girl === 'sayori' && bpmPulse > 0.35) {
    ctx.strokeStyle = `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${0.08 + bpmPulse * 0.12})`;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy * 0.9, Math.min(w, h) * (0.12 + bpmPulse * 0.06), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTetoFx(level) {
  const canvas = $('teto-fx');
  const view = $('view-now');
  if (!canvas || !view) return;
  if (!fxSizeKey) resizeFxCanvas(true);
  const ctx = canvas.getContext('2d', { alpha: true });
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const levels = smoothTetoFxLevels(level);
  const theme = activeFxTheme();
  updateFxState(levels.glow);
  if (theme === 'off') return;

  const quietGate = smoothStep(0.12, 0.42, levels.motion);
  const party = smoothStep(0.22, 0.78, levels.motion);
  const profile = effectProfileForSong();
  if (!profile?.constantRings && quietGate <= 0.01 && levels.glow <= 0.02) return;

  const fxRect = canvas.getBoundingClientRect();
  const heroRect = $('hero-play').getBoundingClientRect();
  const sx = fxRect.width ? canvas.width / fxRect.width : 1;
  const sy = fxRect.height ? canvas.height / fxRect.height : 1;
  const cx = (heroRect.left - fxRect.left + heroRect.width / 2) * sx;
  const cy = (heroRect.top - fxRect.top + heroRect.height / 2) * sy;
  const radius = Math.min(w, h) * (0.16 + party * 0.035);
  const t = performance.now() / 1000;
  const fxTime = currentCalibratedTime();
  const section = effectSectionAt(profile, fxTime);
  const sectionPower = profile ? ((section?.intensity || 0.28) * (section?.fadeLevel ?? 1)) : 1;
  const chorusPower = section?.chorus ? sectionPower : 0;
  const beatPulse = beatPulseForProfile(profile, fxTime);

  const protectedRects = ['.now-meta', '.now-queue'].map(selector => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = 18;
    return {
      x: (r.left - fxRect.left) * sx - pad * sx,
      y: (r.top - fxRect.top) * sy - pad * sy,
      w: (r.width + pad * 2) * sx,
      h: (r.height + pad * 2) * sy,
    };
  }).filter(Boolean);
  const protectedPoint = (x, y) => protectedRects.some(r =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  );

  if (theme === 'disco') {
    drawDiscoFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse);
    return;
  }
  if (theme === 'ddlc') {
    drawDdlcFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse);
    return;
  }
  if (theme === 'teto11') {
    drawTeto11Fx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, protectedPoint);
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const glowRadius = Math.max(w, h) * (0.34 + levels.glow * 0.3 + chorusPower * beatPulse * 0.16);
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, glowRadius);
  glow.addColorStop(0, `rgba(255, 122, 45, ${0.06 + levels.glow * 0.18 + chorusPower * beatPulse * 0.16})`);
  glow.addColorStop(0.46, `rgba(210, 54, 37, ${0.03 + levels.glow * 0.13 + chorusPower * beatPulse * 0.12})`);
  glow.addColorStop(0.78, `rgba(120, 34, 22, ${0.01 + levels.glow * 0.08 + chorusPower * beatPulse * 0.05})`);
  glow.addColorStop(1, 'rgba(91, 28, 17, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const cornerGlow = ctx.createRadialGradient(w * 0.08, h * 0.88, 0, w * 0.08, h * 0.88, Math.max(w, h) * 0.5);
  cornerGlow.addColorStop(0, `rgba(255, 83, 48, ${levels.glow * 0.05 + chorusPower * beatPulse * 0.08})`);
  cornerGlow.addColorStop(1, 'rgba(255, 83, 48, 0)');
  ctx.fillStyle = cornerGlow;
  ctx.fillRect(0, 0, w, h);

  const bpmPulse = profile ? beatPulse * (0.3 + sectionPower * 0.7) : 0;
  const pulseLevel = clamp(0, 1, (levels.glow * 0.54 + party * 0.2) * sectionPower + bpmPulse * (0.22 + chorusPower * 0.72));
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, `rgba(255, 69, 45, ${pulseLevel * (0.06 + chorusPower * 0.07)})`);
  wash.addColorStop(0.48, `rgba(255, 134, 42, ${pulseLevel * (0.06 + chorusPower * 0.06)})`);
  wash.addColorStop(1, `rgba(136, 34, 24, ${pulseLevel * (0.07 + chorusPower * 0.08)})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  if (chorusPower > 0) {
    const colors = [
      [255, 98, 55],
      [255, 173, 67],
      [111, 211, 255],
      [255, 92, 143],
    ];
    const beamCount = 7;
    for (let j = 0; j < beamCount; j++) {
      const color = colors[j % colors.length];
      const angle = t * (0.16 + chorusPower * 0.05) + j * (Math.PI * 2 / beamCount) + beatPulse * 0.2;
      const width = (0.14 + beatPulse * 0.05) * Math.PI;
      const length = Math.max(w, h) * (0.82 + chorusPower * 0.46);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const beam = ctx.createLinearGradient(0, 0, length, 0);
      beam.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.05 + chorusPower * 0.1 + beatPulse * 0.12})`);
      beam.addColorStop(0.42, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.025 + chorusPower * 0.07 + beatPulse * 0.08})`);
      beam.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(radius * 0.4, 0);
      ctx.lineTo(length, Math.sin(width) * length * 0.28);
      ctx.lineTo(length, -Math.sin(width) * length * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawOutboundPulseRings(ctx, {
    theme: 'teto',
    w,
    h,
    cx,
    cy,
    levels,
    profile,
    fxTime,
    sectionPower,
    chorusPower,
    beatPulse,
    palette: [
      [255, 96, 62],
      [255, 153, 54],
      [255, 210, 105],
      [255, 92, 143],
    ],
    baseRadius: radius * 0.92,
    travelRadius: radius * (2.05 + pulseLevel * 0.9 + chorusPower * 0.42),
    alphaBase: 0.24 + chorusPower * 0.12,
    lineWidth: Math.max(1, (1.15 + pulseLevel * 3.1) * sx),
    life: 0.72,
  });

  const palettes = [
    'rgba(255, 96, 62, 0.6)',
    'rgba(255, 153, 54, 0.52)',
    'rgba(181, 55, 31, 0.44)',
    'rgba(255, 210, 105, 0.4)',
  ];
  TETO_FX_OBJECTS.forEach((obj, i) => {
    const appear = smoothStep(obj.threshold + 0.12, Math.min(1, obj.threshold + 0.58), party * sectionPower + beatPulse * 0.14);
    if (appear <= 0.01) return;
    const pulse = 0.72 + Math.sin(t * (0.72 + (i % 5) * 0.12) + obj.phase) * 0.28;
    const beat = appear * (0.72 + pulse * 0.28);
    const drift = (12 + levels.motion * 30) * sx;
    const x = obj.x * w + Math.sin(t * 0.22 + obj.phase) * drift;
    const y = obj.y * h + Math.cos(t * 0.28 + obj.phase * 0.7) * drift * 0.72;
    if (protectedPoint(x, y)) return;
    const size = obj.size * sx * (0.52 + beat * 1.02);
    const color = palettes[i % palettes.length];
    if (obj.kind === 0) {
      drawDiamond(ctx, x, y, size, t * 0.28 + obj.phase, color, beat * 0.38);
    } else if (obj.kind === 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.75 + obj.phase) * 0.34);
      ctx.globalAlpha *= beat * 0.36;
      ctx.fillStyle = color;
      const barH = size * (1.25 + party * 1.65);
      roundedBar(ctx, -size * 0.26, -barH / 2, size * 0.52, barH, size * 0.24);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.28 + obj.phase);
      ctx.globalAlpha *= beat * 0.58;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.16);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, size, -Math.PI * 0.15, Math.PI * (0.75 + party * 0.5));
      ctx.stroke();
      ctx.restore();
    }
  });

  ctx.restore();
}

function drawWaveform(idle = false) {
  const canvas = $('waveform');
  if (!canvas) return;
  // Never resize every frame — layout thrash was a major lag source
  if (!waveSizeKey) resizeWaveform(true);
  const ctx = canvas.getContext('2d', { alpha: true });
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);

  waveFrame++;
  // Skip alternate analysis frames when playing to keep UI clock smooth
  const analyseThisFrame = !idle && !audio.paused && (waveFrame % 2 === 0);

  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  if (isDiscoFxActive()) {
    gradient.addColorStop(0, 'rgba(255, 55, 155, 0.42)');
    gradient.addColorStop(0.5, 'rgba(70, 218, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(246, 78, 255, 0.58)');
  } else if (isTeto11FxActive()) {
    gradient.addColorStop(0, 'rgba(255, 91, 54, 0.44)');
    gradient.addColorStop(0.5, 'rgba(70, 218, 255, 0.98)');
    gradient.addColorStop(1, 'rgba(236, 242, 255, 0.58)');
  } else if (isTetoFxActive()) {
    gradient.addColorStop(0, 'rgba(132, 42, 28, 0.32)');
    gradient.addColorStop(0.55, 'rgba(255, 150, 45, 0.98)');
    gradient.addColorStop(1, 'rgba(172, 111, 48, 0.72)');
  } else {
    gradient.addColorStop(0, 'rgba(94, 234, 212, 0.25)');
    gradient.addColorStop(0.5, 'rgba(94, 234, 212, 0.95)');
    gradient.addColorStop(1, 'rgba(253, 230, 138, 0.62)');
  }

  const bins = Math.min(WAVE_BAR_COUNT, Math.max(48, Math.floor(w / 10)));
  ensureWaveBars(bins);
  const isAudible = !!(analyser && waveData && waveTimeData && !audio.paused && analyseThisFrame);
  // Spatial tracks stay on native <audio> (no analyser) — still animate a soft dual-lead viz
  const nativeSpatialViz = !!(spatialActive && prefersNativeAudio() && !analyser && !audio.paused && audio.src);
  if (isAudible) {
    analyser.getFloatFrequencyData(waveData);
    analyser.getByteTimeDomainData(waveTimeData);
  }

  const baseline = h * 0.78;
  const barGap = Math.max(1, Math.round(w / 430));
  const barW = Math.max(3, Math.floor(w / bins) - barGap);
  let rmsEnergy = 0;
  let peakEnergy = 0;
  const bandTargets = new Array(bins).fill(0);
  if (isAudible) {
    // Subsample time-domain for RMS (every 4th sample)
    const step = 4;
    let n = 0;
    for (let i = 0; i < waveTimeData.length; i += step) {
      const centered = (waveTimeData[i] - 128) / 128;
      peakEnergy = Math.max(peakEnergy, Math.abs(centered));
      rmsEnergy += centered * centered;
      n++;
    }
    rmsEnergy = Math.sqrt(rmsEnergy / Math.max(1, n));
    let spectralWeight = 0;
    let spectralSum = 0;
    for (let i = 0; i < bins; i++) {
      const range = waveBandRange(i, bins);
      bandTargets[i] = waveBandEnergyFromRange(range);
      const energy = bandTargets[i] * bandTargets[i];
      spectralWeight += energy;
      spectralSum += range.centerRatio * energy;
    }
    if (spectralWeight > 0.0001) {
      wavePitchFocus = wavePitchFocus * 0.84 + (spectralSum / spectralWeight) * 0.16;
    }
    const targetLevel = normalizedWaveLevel(rmsEnergy, peakEnergy);
    const upwardChange = Math.max(0, targetLevel - lastTetoAmplitude);
    const riseImpulse = smoothStep(0.018, 0.24, upwardChange) * smoothStep(0.1, 0.9, targetLevel);
    tetoRiseEnergy = Math.max(tetoRiseEnergy * 0.9, riseImpulse);
    lastTetoAmplitude = targetLevel;
    const attack = targetLevel > smoothedLevel ? 0.7 : 0.34;
    smoothedLevel = smoothedLevel * (1 - attack) + targetLevel * attack;
  } else if (nativeSpatialViz) {
    // Decorative motion keyed to pose + time — does not touch the audio graph
    const t = currentCalibratedTime();
    const pose = spatialMapCache ? interpolateSpatialPose(spatialMapCache, t) : null;
    const pan = pose ? Math.sin((pose.az * Math.PI) / 180) : 0;
    const elev = pose ? pose.el : 0;
    const pulse = 0.32 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.4)) + 0.12 * Math.abs(pan) + 0.08 * Math.abs(elev);
    smoothedLevel = smoothedLevel * 0.82 + pulse * 0.18;
    lastTetoAmplitude = pulse;
    tetoRiseEnergy = Math.max(tetoRiseEnergy * 0.88, pulse * 0.35);
    for (let i = 0; i < bins; i++) {
      const x = bins <= 1 ? 0.5 : i / (bins - 1);
      // L-biased female energy + R-biased male shimmer (opposite leads)
      const fWave = 0.55 + 0.45 * Math.sin(t * 3.1 + x * 7 - pan * 1.2);
      const mWave = 0.55 + 0.45 * Math.sin(t * 2.7 + x * 9 + pan * 1.2 + 1.3);
      const side = x < 0.5 ? fWave : mWave;
      bandTargets[i] = clamp(0, 1, (0.22 + 0.55 * Math.abs(side) * pulse) * (0.75 + 0.25 * Math.abs(Math.sin(t + x * 5))));
    }
  } else if (!audio.src) {
    smoothedLevel = smoothedLevel * 0.98 + 0.08 * 0.02;
    tetoRiseEnergy *= 0.86;
    lastTetoAmplitude = 0;
  } else if (audio.paused) {
    tetoRiseEnergy *= 0.86;
  }

  ctx.save();
  ctx.globalAlpha = (!audio.paused && (analyser || nativeSpatialViz)) ? 0.34 + smoothedLevel * 0.22 : 0.18;
  ctx.fillStyle = isTeto11FxActive()
    ? 'rgba(236, 242, 255, 0.42)'
    : isTetoFxActive()
      ? 'rgba(255, 204, 168, 0.36)'
      : 'rgba(235, 235, 240, 0.24)';
  ctx.fillRect(Math.round(w * 0.015), baseline, Math.round(w * 0.97), Math.max(1, Math.round(h * 0.008)));
  ctx.restore();

  const drawAnalysis = isAudible || nativeSpatialViz;
  for (let i = 0; i < bins; i++) {
    if (drawAnalysis) {
      const shape = waveBaseShape(i, bins);
      const center = bandTargets[i];
      const left = bandTargets[Math.max(0, i - 1)];
      const right = bandTargets[Math.min(bins - 1, i + 1)];
      const localAverage = left * 0.25 + center * 0.5 + right * 0.25;
      const localPeak = Math.max(0, center - (left + right) * 0.38);
      const xRatio = bins <= 1 ? 0.5 : i / (bins - 1);
      const pitchProximity = 1 - clamp(0, 1, Math.abs(xRatio - wavePitchFocus) / 0.34);
      const globalGate = smoothStep(0.025, 0.22, smoothedLevel);
      const breathing = Math.pow(smoothedLevel, 0.9);
      const spectrumHeight = center * 0.7 + localAverage * 0.3 + localPeak * 0.5;
      // Native spatial viz is softer so it doesn't look like a fake analyser
      const gain = nativeSpatialViz && !isAudible ? 0.72 : 1;
      const target = (0.006 + breathing * 0.018 + globalGate * spectrumHeight * shape * (1 + pitchProximity * 0.18)) * gain;
      const rate = target > waveBars[i] ? 0.82 : 0.32;
      waveBars[i] = waveBars[i] * (1 - rate) + target * rate;
    } else if (!audio.src) {
      waveBars[i] = waveBars[i] * 0.99 + waveBaseShape(i, bins) * 0.0008;
    }
    const amp = Math.max(0.004, softLimit(Math.max(0, waveBars[i] * WAVE_GAIN), WAVE_SOFT_LIMIT));
    const x = i * (w / bins);
    // Scale bars to baseline (usable height), not full canvas — keeps proportions
    // consistent when the panel is short or tall across songs/layouts.
    const maxBar = Math.max(8, baseline - 2);
    const barH = Math.min(maxBar, Math.max(2, amp * maxBar * 0.92));
    const radius = Math.min(Math.max(2, barW / 2), barH / 2);
    ctx.fillStyle = gradient;
    roundedBar(ctx, x, baseline - barH, barW, barH, radius);
  }

  // Hero level only — do NOT call updatePlaybackVisuals here (was starving the clock)
  const hero = $('hero-play');
  if (hero) hero.style.setProperty('--level', smoothedLevel.toFixed(3));

  // FX every other frame on Now view. Skip teto overlay when DDF theater owns the stage
  // (theater has its own optimized canvas loop — drawing both is pure lag).
  if (
    isNowViewActive()
    && isAnyFxActive()
    && waveFrame % 2 === 0
    && !document.body.classList.contains('ddf-theater-active')
  ) {
    drawTetoFx(smoothedLevel);
  }
}

function waveBandEnergyFromRange(range) {
  if (!analyser || !waveData || !range) return 0;
  const {bin0, bin1, centerFreq} = range;
  let sum = 0;
  let peak = 0;
  let count = 0;
  for (let b = bin0; b < bin1; b++) {
    const energy = dbToWaveEnergy(waveData[b]);
    sum += energy;
    peak = Math.max(peak, energy);
    count++;
  }
  const avg = count ? sum / count : 0;
  const peakLift = Math.max(0, peak - avg);
  const presenceBias = centerFreq < 90 ? 0.82
    : centerFreq < 230 ? 1.12
    : centerFreq < 1800 ? 1.02
    : centerFreq < 7200 ? 1.18
    : 0.94;
  return clamp(0, 1, (avg * 0.46 + peak * 0.62 + peakLift * 0.58) * presenceBias);
}

function roundedBar(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();
}

function bindAudioElementEvents(el) {
  if (!el || el.dataset.vpBound === '1') return;
  el.dataset.vpBound = '1';
  ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'stalled', 'suspend', 'ended', 'error'].forEach(eventName => {
    el.addEventListener(eventName, () => noteMediaEvent(eventName), { capture: true });
  });

  // Progress is driven by startProgressClock() while playing — not by visualizer rAF
  // and not only by sparse timeupdate (which feels late under load).
  el.addEventListener('timeupdate', () => {
    if (!progressTimer) updatePlaybackVisuals();
  });
  el.addEventListener('loadedmetadata', () => {
    syncCalibratedClockToNative();
    updatePlaybackVisuals();
  });
  el.addEventListener('seeking', () => {
    syncCalibratedClockToNative(currentSong(), { allowBackward: !!seekTransaction, keepRunning: false });
    updatePlaybackVisuals();
  });
  el.addEventListener('seeked', () => {
    syncCalibratedClockToNative(currentSong(), { allowBackward: !!seekTransaction, consumePending: true, keepRunning: false });
    updatePlaybackVisuals();
    spatialForcePaint = true;
    if (spatialActive) paintSpatialGuide(currentCalibratedTime(), true);
    if (seekTransaction?.finishOnSeeked) finishSeekTransaction();
  });
  el.addEventListener('ratechange', () => {
    pauseCalibratedClock();
    if (!el.paused && !el.seeking && el.readyState >= 3) startCalibratedClock();
  });
  el.addEventListener('waiting', () => pauseCalibratedClock());
  el.addEventListener('playing', () => startCalibratedClock());
  el.addEventListener('ended', () => {
    pauseCalibratedClock();
    playNext(true);
  });
  el.addEventListener('play', () => {
    $('play').textContent = '⏸';
    $('hero-play').classList.add('playing');
    $('hero-play').querySelector('.hero-icon').textContent = '⏸';
    const ddfIcon = $('ddf-play-icon');
    if (ddfIcon) ddfIcon.textContent = '⏸';
    document.body.classList.add('is-playing');
    startProgressClock();
    startWaveform();
    updatePlaybackVisuals();
    updateFxState();
    syncSpatialLoop();
  });
  el.addEventListener('pause', () => {
    pauseCalibratedClock();
    $('play').textContent = '▶';
    $('hero-play').classList.remove('playing');
    $('hero-play').querySelector('.hero-icon').textContent = '▶';
    const ddfIcon = $('ddf-play-icon');
    if (ddfIcon) ddfIcon.textContent = '▶';
    document.body.classList.remove('is-playing');
    stopProgressClock();
    updatePlaybackVisuals();
    updateFxState();
    drawWaveform(true);
    syncSpatialLoop();
  });
  el.addEventListener('error', () => {
    console.warn('Audio error for', el.src);
    if (queueIndex + 1 < queue.length) playNext(false);
  });
}
bindAudioElementEvents(audio);

$('play').addEventListener('click', togglePlay);
$('hero-play').addEventListener('click', togglePlay);
const ddfPlayBtn = $('ddf-play');
if (ddfPlayBtn) ddfPlayBtn.addEventListener('click', togglePlay);
$('next').addEventListener('click', () => playNext(false));
$('prev').addEventListener('click', playPrev);
$('shuffle').addEventListener('click', toggleShuffle);
$('loop').addEventListener('click', cycleLoop);
$('refresh').addEventListener('click', loadLibrary);
bindLibraryActionGuards();

const seekEl = $('seek');
function handleSeekPreview() {
  const targetTime = seekTargetFromControl();
  if (targetTime === null) return;
  previewSeekTarget(targetTime);
}

function handleSeekCommit() {
  if (!seekTransaction) return;
  const targetTime = seekTargetFromControl();
  if (targetTime !== null) previewSeekTarget(targetTime);
  commitSeekTransaction(true);
}

seekEl.addEventListener('pointerdown', () => beginSeekTransaction(), {capture: true});
seekEl.addEventListener('input', handleSeekPreview);
seekEl.addEventListener('change', handleSeekCommit);
seekEl.addEventListener('pointerup', handleSeekCommit);
seekEl.addEventListener('pointercancel', handleSeekCommit);

function updateVolumeIcon(volume = playerVolume) {
  const iconEl = document.querySelector('.volume span');
  if (!iconEl) return;
  const pct = Math.round(volume * 100);
  iconEl.textContent = pct === 0 ? '🔇' : pct < 50 ? '🔉' : '🔊';
}

function setPlayerVolume(value, notify = false) {
  playerVolume = parseVolume(value, playerVolume);
  localStorage.setItem('vp_volume', playerVolume.toString());
  const volumeEl = $('volume');
  if (volumeEl) volumeEl.value = playerVolume.toString();
  if (outputGain && audioCtx?.state === 'running') {
    outputGain.gain.cancelScheduledValues(audioCtx.currentTime);
    outputGain.gain.setTargetAtTime(playerVolume, audioCtx.currentTime, 0.015);
    audio.volume = 1;
  } else {
    audio.volume = playerVolume;
  }
  updateVolumeIcon(playerVolume);
  updateTimingDebug();
  if (notify) {
    const pct = Math.round(playerVolume * 100);
    const icon = pct === 0 ? '🔇' : pct < 50 ? '🔉' : '🔊';
    showToast(icon, `Volume ${pct}%`);
  }
}

function resetAudioOutput() {
  audio.muted = false;
  audioGraphError = '';
  // Full native restore if graph was attached (also helps spatial HQ path)
  if (audioSource || analyser) recreateAudioElementForNativePath();
  setPlayerVolume(1, false);
  const song = currentSong();
  if (song && !prefersNativeAudio(song)) {
    primeAudioContextForGesture()
      .then(() => audio.src ? activateAudioGraphIfPossible() : false)
      .then((graphActive) => {
        updateTimingDebug();
        showToast('🔊', graphActive ? 'Audio reset' : 'Native audio reset');
      })
      .catch(err => {
        rememberAudioGraphError(err);
        audio.volume = playerVolume;
        updateTimingDebug();
        showToast('🔊', 'Native audio reset');
      });
    return;
  }
  audio.volume = playerVolume;
  updateTimingDebug();
  showToast('🔊', 'Native audio reset');
}

const volumeEl = $('volume');
volumeEl.value = playerVolume.toString();
setPlayerVolume(playerVolume, false);
volumeEl.addEventListener('input', (e) => setPlayerVolume(e.target.value, true));
volumeEl.addEventListener('change', (e) => setPlayerVolume(e.target.value, true));
['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(type => {
  volumeEl.addEventListener(type, (e) => e.stopPropagation(), {capture: true});
});

const settingsToggle = $('settings-toggle');
const settingsMenu = $('settings-menu');
const tetoFxCheckbox = $('teto-fx-enabled');
const fxThemeSelect = $('fx-theme');
const timingDebugCheckbox = $('timing-debug-enabled');
const audioResetButton = $('audio-reset');
if (tetoFxCheckbox) tetoFxCheckbox.checked = tetoFxEnabled;
if (fxThemeSelect) fxThemeSelect.value = fxTheme;
if (timingDebugCheckbox) timingDebugCheckbox.checked = timingDebugEnabled;
if (settingsToggle && settingsMenu) {
  settingsToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    settingsMenu.classList.toggle('hidden');
  });
  settingsMenu.addEventListener('pointerdown', (e) => e.stopPropagation());
  settingsMenu.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => {
    if (!settingsMenu.classList.contains('hidden') && !settingsMenu.contains(e.target) && e.target !== settingsToggle) {
      settingsMenu.classList.add('hidden');
    }
  });
}
if (tetoFxCheckbox) {
  tetoFxCheckbox.addEventListener('change', () => setTetoFxEnabled(tetoFxCheckbox.checked));
}
if (fxThemeSelect) {
  fxThemeSelect.addEventListener('change', () => setFxTheme(fxThemeSelect.value));
}
if (timingDebugCheckbox) {
  timingDebugCheckbox.addEventListener('change', () => {
    timingDebugEnabled = timingDebugCheckbox.checked;
    localStorage.setItem('vp_timing_debug_enabled', timingDebugEnabled ? 'true' : 'false');
    updateTimingDebug();
  });
}
if (audioResetButton) audioResetButton.addEventListener('click', resetAudioOutput);

// Force a full page reload with a unique query so iOS/GitHub Pages can't serve stale JS/CSS/images
const forceReloadButton = $('force-reload');
if (forceReloadButton) {
  forceReloadButton.addEventListener('click', () => {
    const u = new URL(window.location.href);
    u.searchParams.set('_vp', String(Date.now()));
    window.location.replace(u.toString());
  });
}
const buildMeta = document.querySelector('meta[name="vp-build"]');
const buildLabel = $('vp-build-label');
if (buildLabel) {
  buildLabel.textContent = buildMeta?.content || 'unknown';
}

$('search').addEventListener('input', (e) => renderLibrary(e.target.value));

document.querySelectorAll('.collection-tab').forEach(button => {
  button.addEventListener('click', () => setActiveCollection(button.dataset.collection));
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchView(tab.dataset.view);
  });
});

$('new-playlist').addEventListener('click', () => createPlaylistFromInput($('new-playlist-name')));
$('new-playlist-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createPlaylistFromInput(e.currentTarget);
});

function createPlaylistFromInput(input, songToAdd = null) {
  const name = (input?.value || '').trim();
  if (!name) return null;
  if (!playlists[name]) playlists[name] = [];
  if (songToAdd && !playlists[name].some(id => refMatchesSong(id, songToAdd))) {
    playlists[name].push(songRef(songToAdd));
  }
  savePlaylists();
  if (input) input.value = '';
  renderPlaylists();
  renderPlaylistActionPanel();
  return name;
}

function playlistHasSong(name, song) {
  return !!playlists[name]?.some(id => refMatchesSong(id, song));
}

function addSongToPlaylist(name, song) {
  if (!song) return false;
  if (!playlists[name]) playlists[name] = [];
  if (playlistHasSong(name, song)) return false;
  playlists[name].push(songRef(song));
  savePlaylists();
  renderPlaylists();
  renderPlaylistActionPanel();
  showToast('+', `Added ${song.title || song.displayName}`);
  return true;
}

function reorderPlaylistSong(name, fromIdx, targetIdx) {
  const songs = playlists[name];
  if (!songs || fromIdx < 0 || fromIdx >= songs.length) return false;
  if (targetIdx === fromIdx || targetIdx === fromIdx + 1) return false;
  let insertAt = Math.max(0, Math.min(targetIdx, songs.length));
  const [songId] = songs.splice(fromIdx, 1);
  if (fromIdx < insertAt) insertAt -= 1;
  songs.splice(insertAt, 0, songId);
  savePlaylists();
  renderPlaylists();
  return true;
}

function movePlaylistSong(name, fromIdx, direction) {
  const targetIdx = direction < 0 ? fromIdx - 1 : fromIdx + 2;
  if (reorderPlaylistSong(name, fromIdx, targetIdx)) {
    showToast('↕', 'Playlist order saved');
  }
}

function startAddToPlaylistFlow(libIdx) {
  pendingPlaylistSongIdx = libIdx;
  switchView('playlists');
  renderPlaylistActionPanel();
  setTimeout(() => $('playlist-action-panel')?.scrollIntoView({block: 'nearest'}), 0);
}

function renderPlaylistActionPanel() {
  const panel = $('playlist-action-panel');
  if (!panel) return;
  const song = library[pendingPlaylistSongIdx];
  if (!song) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  $('playlist-action-title').textContent = song.displayName;
  const options = $('playlist-action-options');
  options.innerHTML = '';
  const names = Object.keys(playlists).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    const note = document.createElement('div');
    note.className = 'empty';
    note.style.padding = '6px 0';
    note.style.textAlign = 'left';
    note.textContent = 'No playlists yet. Create one below and this song will be added.';
    options.appendChild(note);
  } else {
    names.forEach(name => {
      const button = document.createElement('button');
      const already = playlists[name].some(id => refMatchesSong(id, song));
      button.type = 'button';
      button.classList.toggle('on', already);
      button.textContent = already ? `✓ ${name}` : `+ ${name}`;
      button.addEventListener('click', () => {
        if (already) {
          playlists[name] = playlists[name].filter(id => !refMatchesSong(id, song));
        } else {
          playlists[name].push(songRef(song));
        }
        savePlaylists();
        renderPlaylists();
        renderPlaylistActionPanel();
      });
      options.appendChild(button);
    });
  }
}

$('playlist-action-create').addEventListener('click', () => {
  const song = library[pendingPlaylistSongIdx];
  createPlaylistFromInput($('playlist-action-name'), song);
});
$('playlist-action-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const song = library[pendingPlaylistSongIdx];
    createPlaylistFromInput(e.currentTarget, song);
  }
});
$('playlist-action-cancel').addEventListener('click', () => {
  pendingPlaylistSongIdx = null;
  renderPlaylistActionPanel();
});

function renderPlaylists() {
  renderPlaylistActionPanel();
  const container = $('playlists-container');
  container.innerHTML = '';
  const names = Object.keys(playlists).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No playlists yet. Click "+ New playlist" to create one.';
    container.appendChild(empty);
    return;
  }
  names.forEach(name => {
    const songs = playlists[name];
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.innerHTML = `
      <div class="playlist-header">
        <span class="playlist-name"></span>
        <span class="playlist-count"></span>
        <button class="playlist-add">+ Add songs</button>
        <button class="playlist-play">▶ Play</button>
        <button class="playlist-shuffle">🔀 Shuffle</button>
        <button class="playlist-delete">Delete</button>
      </div>
      <div class="playlist-adder hidden">
        <input class="playlist-adder-search" type="text" placeholder="Search library">
        <div class="playlist-adder-results"></div>
      </div>
      <ul class="playlist-songs"></ul>
    `;
    card.querySelector('.playlist-name').textContent = name;
    card.querySelector('.playlist-count').textContent =
      `${songs.length} song${songs.length === 1 ? '' : 's'}`;
    const playButton = card.querySelector('.playlist-play');
    const shuffleButton = card.querySelector('.playlist-shuffle');
    const deleteButton = card.querySelector('.playlist-delete');
    const addButton = card.querySelector('.playlist-add');
    [addButton, playButton, shuffleButton, deleteButton].forEach(button => {
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    addButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPlaylistAdder = openPlaylistAdder === name ? null : name;
      renderPlaylists();
    });
    playButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      playPlaylist(name, 0, false);
    });
    shuffleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      playPlaylist(name, 0, true);
    });
    deleteButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      delete playlists[name];
      savePlaylists();
      renderPlaylists();
      renderPlaylistActionPanel();
      showToast('×', `Deleted ${name}`);
    });
    renderPlaylistAdder(card, name);
    const ul = card.querySelector('.playlist-songs');
    ul.addEventListener('dragover', (e) => {
      if (!playlistDragState || playlistDragState.name !== name) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    ul.addEventListener('drop', (e) => {
      if (!playlistDragState || playlistDragState.name !== name) return;
      if (e.target.closest('.playlist-song')) return;
      e.preventDefault();
      if (reorderPlaylistSong(name, playlistDragState.index, songs.length)) {
        showToast('↕', 'Playlist order saved');
      }
    });
    if (songs.length === 0) {
      const li = document.createElement('li');
      li.style.padding = '8px 10px';
      li.style.color = 'var(--fg-faint)';
      li.style.fontSize = '13px';
      li.textContent = 'Empty. Use Add songs above to build this playlist.';
      ul.appendChild(li);
    } else {
      songs.forEach((songId, i) => {
        const libIdx = findSongIndex(songId);
        const li = document.createElement('li');
        li.className = 'playlist-song';
        li.dataset.playlist = name;
        li.dataset.libIdx = libIdx;
        li.dataset.playlistIdx = i;
        li.draggable = true;
        const missingName = String(songId).split('/').pop();
        const label = libIdx >= 0 ? library[libIdx].displayName : `${missingName} (missing)`;
        li.innerHTML = `
          <span class="drag-handle" title="Drag to reorder">☰</span>
          <span class="col-num">${i + 1}</span>
          <span class="title"></span>
          <span class="playlist-move">
            <button class="move-up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="move-down" title="Move down" ${i === songs.length - 1 ? 'disabled' : ''}>↓</button>
          </span>
          <button class="remove" title="Remove from playlist">×</button>
        `;
        li.querySelector('.title').textContent = label;
        if (libIdx < 0) li.querySelector('.title').style.color = 'var(--fg-faint)';
        li.addEventListener('click', (e) => {
          if (e.target.closest('button') || e.target.closest('.drag-handle')) return;
          if (libIdx >= 0) playPlaylist(name, i, false);
        });
        li.addEventListener('dragstart', (e) => {
          playlistDragState = {name, index: i};
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `${name}:${i}`);
          requestAnimationFrame(() => li.classList.add('dragging'));
        });
        li.addEventListener('dragend', () => {
          li.classList.remove('dragging');
          li.classList.remove('drag-over');
          playlistDragState = null;
        });
        li.addEventListener('dragover', (e) => {
          if (!playlistDragState || playlistDragState.name !== name) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          li.classList.add('drag-over');
        });
        li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
        li.addEventListener('drop', (e) => {
          if (!playlistDragState || playlistDragState.name !== name) return;
          e.preventDefault();
          e.stopPropagation();
          li.classList.remove('drag-over');
          const rect = li.getBoundingClientRect();
          const after = e.clientY > rect.top + rect.height / 2;
          const targetIdx = after ? i + 1 : i;
          if (reorderPlaylistSong(name, playlistDragState.index, targetIdx)) {
            showToast('↕', 'Playlist order saved');
          }
        });
        li.querySelectorAll('button').forEach(button => {
          button.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
        });
        li.querySelector('.move-up').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          movePlaylistSong(name, i, -1);
        });
        li.querySelector('.move-down').addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          movePlaylistSong(name, i, 1);
        });
        const removeButton = li.querySelector('.remove');
        removeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          songs.splice(i, 1);
          savePlaylists();
          renderPlaylists();
        });
        ul.appendChild(li);
      });
    }
    container.appendChild(card);
  });
}

function renderPlaylistAdder(card, name) {
  const adder = card.querySelector('.playlist-adder');
  const search = card.querySelector('.playlist-adder-search');
  const results = card.querySelector('.playlist-adder-results');
  const isOpen = openPlaylistAdder === name;
  adder.classList.toggle('hidden', !isOpen);
  card.querySelector('.playlist-add').classList.toggle('on', isOpen);
  if (!isOpen) return;

  const query = playlistAdderQueries[name] || '';
  search.value = query;
  search.addEventListener('input', () => {
    playlistAdderQueries[name] = search.value;
    renderPlaylistAdderResults(results, name, search.value);
  });
  renderPlaylistAdderResults(results, name, query);
}

function renderPlaylistAdderResults(results, name, query) {
  const q = query.trim().toLowerCase();
  const candidates = library
    .filter(song => !playlistHasSong(name, song))
    .filter(song => !q || song.displayName.toLowerCase().includes(q) || song.collectionLabel.toLowerCase().includes(q));

  results.innerHTML = '';
  if (!library.length) {
    const empty = document.createElement('div');
    empty.className = 'playlist-adder-empty';
    empty.textContent = 'Library is still loading.';
    results.appendChild(empty);
    return;
  }
  if (candidates.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'playlist-adder-empty';
    empty.textContent = q ? 'No matching songs left to add.' : 'Every library song is already in this playlist.';
    results.appendChild(empty);
    return;
  }

  candidates.slice(0, 60).forEach(song => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'playlist-adder-song';
    button.innerHTML =
      `<span class="playlist-adder-song-title"></span>` +
      `<span class="playlist-adder-song-meta"></span>` +
      `<span class="playlist-adder-song-plus">+</span>`;
    button.querySelector('.playlist-adder-song-title').textContent = song.displayName;
    button.querySelector('.playlist-adder-song-meta').textContent = song.collectionLabel;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addSongToPlaylist(name, song);
    });
    results.appendChild(button);
  });
}

function playPlaylist(name, startIdx = 0, shuffle = false) {
  const songIds = playlists[name];
  if (!songIds || songIds.length === 0) return;
  const playable = songIds
    .map((id, playlistIdx) => ({ libIdx: findSongIndex(id), playlistIdx }))
    .filter(entry => entry.libIdx >= 0);
  if (playable.length === 0) {
    showToast('!', 'No playable songs in this playlist.');
    return;
  }
  queue = playable.map(entry => entry.libIdx);
  currentPlaylist = name;
  if (shuffle) {
    const orderedQueue = queue.slice();
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    queueIndex = 0;
    shuffled = true;
    $('shuffle').classList.add('on');
    unshuffledQueue = orderedQueue;
  } else {
    const targetQueueIndex = playable.findIndex(entry => entry.playlistIdx === startIdx);
    queueIndex = targetQueueIndex >= 0 ? targetQueueIndex : 0;
    shuffled = false;
    $('shuffle').classList.remove('on');
    unshuffledQueue = null;
  }
  playCurrent();
}

document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'ArrowRight' && e.shiftKey) { e.preventDefault(); playNext(false); }
  else if (e.code === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); playPrev(); }
  else if (e.code === 'KeyL' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); cycleLoop(); }
  else if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleShuffle(); }
});

window.addEventListener('resize', () => {
  scheduleNowLayoutSync();
});
// Initial measure after first paint (DOM may not have final grid sizes yet)
scheduleNowLayoutSync();
updateFxState();
loadSpatialMap(); // embed into cache immediately
preloadSpatialMaps(); // warm jumpy/traveling-voices map
loadLibrary();
