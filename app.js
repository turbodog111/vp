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
const audio = $('audio');

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
  return SONG_EFFECT_PROFILES[song.path] || SONG_EFFECT_PROFILES[song.id] || SONG_EFFECT_PROFILES[song.name] || null;
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
  // Spatial track: no disco/teto FX — keeps imaging pure (matches QuickTime intent)
  if (songLooksLikeTravelingVoices(song)) return 'off';
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
  document.body.style.setProperty('--fx-level', level.toFixed(3));
  document.body.style.setProperty('--teto-level', level.toFixed(3));
  document.body.style.setProperty('--disco-level', level.toFixed(3));
  document.body.style.setProperty('--teto11-level', level.toFixed(3));
}

function switchView(view) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'playlists') renderPlaylists();
  if (view === 'now') {
    resizeWaveform(true);
    resizeFxCanvas(true);
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
      badge.textContent = 'Spatial';
      badge.classList.add('spatial-track');
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
  const targetSrc = new URL(song.url, window.location.href).href;
  const sameSource = audio.currentSrc === targetSrc || audio.src === targetSrc;
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
  setSpatialSong(song);
  applySongTheme(song);
}

/* ---------- Spatial guide (Traveling Voices) — low-cost ---------- */
// Embedded so Desktop UI / offline / failed fetch still get full cue data.
const SPATIAL_MAP_EMBEDDED = {
  id: 'doki-doki-forever-traveling-voices',
  transitionSec: 3.2,
  description: 'HQ extreme_jumps path + clean spatialize (no rear invert).',
  keyframes: [
    { t: 0.0, az: -90.0, el: 0.0, section: "p0", cue: "Extreme -90,0" },
    { t: 17.7, az: 90.0, el: 0.0, section: "p1", cue: "Extreme 90,0" },
    { t: 24.4, az: 0.0, el: 1.0, section: "p2", cue: "Extreme 0,1" },
    { t: 30.3, az: 180.0, el: -1.0, section: "p3", cue: "Extreme 180,-1" },
    { t: 41.2, az: -45.0, el: 0.9, section: "p4", cue: "Extreme -45,0.9" },
    { t: 48.6, az: 135.0, el: -0.9, section: "p5", cue: "Extreme 135,-0.9" },
    { t: 51.3, az: -135.0, el: 0.9, section: "p6", cue: "Extreme -135,0.9" },
    { t: 61.0, az: 45.0, el: -0.9, section: "p7", cue: "Extreme 45,-0.9" },
    { t: 67.5, az: -90.0, el: 1.0, section: "p8", cue: "Extreme -90,1" },
    { t: 76.0, az: 90.0, el: -1.0, section: "p9", cue: "Extreme 90,-1" },
    { t: 89.0, az: 0.0, el: -1.0, section: "p10", cue: "Extreme 0,-1" },
    { t: 100.0, az: 180.0, el: 1.0, section: "p11", cue: "Extreme 180,1" },
    { t: 112.0, az: -120.0, el: 0.5, section: "p12", cue: "Extreme -120,0.5" },
    { t: 121.0, az: 60.0, el: -0.5, section: "p13", cue: "Extreme 60,-0.5" },
    { t: 132.5, az: -30.0, el: -0.8, section: "p14", cue: "Extreme -30,-0.8" },
    { t: 146.5, az: 150.0, el: 0.8, section: "p15", cue: "Extreme 150,0.8" },
    { t: 163.0, az: -90.0, el: 0.0, section: "p16", cue: "Extreme -90,0" },
    { t: 175.0, az: 0.0, el: 0.5, section: "p17", cue: "Extreme 0,0.5" }
  ],
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
  if (name.includes('Traveling Voices') || name.includes('Travelling Voices')) return true;
  if (name.includes('DDF Travel') || name.includes('DDF_travel')) return true;
  const hay = `${title} ${path} ${id} ${display} ${name}`.toLowerCase();
  return hay.includes('traveling voices')
    || hay.includes('travelling voices')
    || hay.includes('ddf travel')
    || hay.includes('ddf_travel');
}

/** Map library filename → spatial JSON slug (batch10). */
function spatialSlugForSong(song) {
  if (!song) return null;
  const n = `${song.name || ''} ${song.title || ''}`;
  const m = n.match(/DDF Travel\s+(\d{2})\s+(.+?)(?:\.m4a|\.mp3|$)/i)
    || n.match(/DDF_travel_(\d{2})_(.+?)(?:\.m4a|\.mp3|$)/i);
  if (m) {
    const num = m[1];
    const slug = m[2].trim().replace(/\s+/g, '_');
    return `${num}_${slug}`;
  }
  if (/Traveling Voices/i.test(n)) return '09_extreme_jumps'; // primary HQ = extreme jumps
  return null;
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
const BATCH10_SPATIAL_SLUGS = [
  '01_hard_LR_flip',
  '02_front_back_poles',
  '03_top_bottom_swap',
  '04_clockwise_ring',
  '05_counterclockwise_ring',
  '06_diagonal_cardinals',
  '07_vertical_spin_sides',
  '08_figure_eight',
  '09_extreme_jumps',
  '10_fast_orbit_then_hold',
];

function normalizeSpatialMap(data) {
  const map = data && data.keyframes ? data : { keyframes: data?.keyframes || SPATIAL_MAP_EMBEDDED.keyframes, transitionSec: data?.transition_sec || data?.transitionSec || 3.2 };
  if (!map.transitionSec && data?.transition_sec) map.transitionSec = data.transition_sec;
  if (!map.keyframes && data?.keyframes) map.keyframes = data.keyframes;
  map._times = (map.keyframes || []).map(k => k.t);
  return map;
}

function fetchSpatialSlug(slug) {
  if (!slug || spatialMapBySlug[slug]) return Promise.resolve(spatialMapBySlug[slug] || null);
  return fetch(`./songs/spatial/DDF_travel_${slug}.json`)
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (!data) return null;
      spatialMapBySlug[slug] = normalizeSpatialMap(data);
      return spatialMapBySlug[slug];
    })
    .catch(() => null);
}

function preloadBatch10SpatialMaps() {
  BATCH10_SPATIAL_SLUGS.forEach(slug => { fetchSpatialSlug(slug); });
}

function loadSpatialMap(song = currentSong()) {
  const slug = spatialSlugForSong(song);
  if (slug && spatialMapBySlug[slug]) {
    spatialMapCache = spatialMapBySlug[slug];
    return spatialMapCache;
  }
  // Per-variant JSON: warm cache async; do not permanently pin wrong embed when slug known
  if (slug && !spatialMapBySlug[slug]) {
    fetchSpatialSlug(slug).then(map => {
      if (!map) return;
      if (spatialSlugForSong(currentSong()) === slug) {
        spatialMapCache = map;
        spatialForcePaint = true;
        paintSpatialGuide(currentCalibratedTime(), true);
      }
    });
  }
  // Primary Traveling Voices / unknown → embedded extreme-jumps style map
  if (!slug) {
    spatialMapCache = normalizeSpatialMap(JSON.parse(JSON.stringify(SPATIAL_MAP_EMBEDDED)));
  } else if (!spatialMapCache) {
    // Brief fallback until fetch lands (slug-specific map preferred)
    spatialMapCache = normalizeSpatialMap(JSON.parse(JSON.stringify(SPATIAL_MAP_EMBEDDED)));
  }
  return spatialMapCache;
}

function resetSpatialUiCache() {
  spatialLastUi = { f: '', m: '', sec: '', cue: '', next: '', az: 999, el: 999 };
}

const DDLC_THEME_CLASSES = [
  'theme-sayori', 'theme-natsuki', 'theme-yuri', 'theme-monika',
  'theme-ddf-female', 'theme-ddf-male', 'theme-ddf-duet', 'spatial-song-active',
];

function detectDdlcGirlTheme(song) {
  if (!song) return null;
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''} ${song.path || ''}`.toLowerCase();
  // Explicit girl markers in library titles
  if (hay.includes('sayori')) return 'theme-sayori';
  if (hay.includes('natsuki')) return 'theme-natsuki';
  if (hay.includes('yuri') && !hay.includes('forever')) return 'theme-yuri';
  if (hay.includes('monika')) return 'theme-monika';
  // DDF family → reactive dual-vocal themes (Travel batch uses "DDF Travel NN …")
  if (
    hay.includes('doki doki forever') ||
    hay.includes('traveling voices') ||
    hay.includes('travelling voices') ||
    hay.includes('ddf travel') ||
    hay.includes('ddf_travel') ||
    hay.includes('ddf_') ||
    hay.includes('drum-centered')
  ) {
    return 'theme-ddf'; // special: resolved dynamically by lead
  }
  // Other DDLC-adjacent
  if (hay.includes('ddlc') || hay.includes('literature club')) return 'theme-monika';
  return null;
}

function clearDdlcThemes() {
  DDLC_THEME_CLASSES.forEach(c => document.body.classList.remove(c));
  document.body.style.removeProperty('--ddf-female-lead');
  document.body.style.removeProperty('--ddf-male-lead');
}

function applySongTheme(song = currentSong()) {
  clearDdlcThemes();
  const theme = detectDdlcGirlTheme(song);
  if (!theme) return;
  if (theme === 'theme-ddf') {
    updateDdfSingerTheme(currentCalibratedTime());
    return;
  }
  document.body.classList.add(theme);
}

/** Approximate who leads from arrangement landmarks for DDF tracks. */
function updateDdfSingerTheme(timeSec = currentCalibratedTime()) {
  const theme = detectDdlcGirlTheme(currentSong());
  const isDdf = theme === 'theme-ddf'
    || document.body.classList.contains('theme-ddf-female')
    || document.body.classList.contains('theme-ddf-male')
    || document.body.classList.contains('theme-ddf-duet')
    || document.body.classList.contains('spatial-song-active');
  if (!isDdf) return;
  // Phrase-based lead guess from arrangement-like landmarks (matches our mix automation)
  const fLeads = [
    [17.5, 23.2], [29.0, 40.5], [51.0, 54.5], [60.5, 63.5], [66.0, 67.2],
    [73.0, 89.5], [98.5, 107.5], [108.0, 108.9], [110.2, 111.0], [111.8, 118.5],
    [125.0, 132.5], [136.0, 137.0], [137.8, 142.0], [143.0, 143.7], [145.2, 151.5],
    [170.5, 175.5],
  ];
  const mLeads = [
    [23.3, 28.8], [41.0, 48.0], [48.5, 51.0], [54.6, 56.0], [63.6, 66.0],
    [67.2, 68.5], [92.0, 99.0], [107.5, 108.0], [109.0, 110.2], [111.0, 111.7],
    [118.5, 125.0], [142.0, 143.0], [143.7, 145.2],
  ];
  const inRange = (ranges) => ranges.some(([a, b]) => timeSec >= a && timeSec < b);
  const f = inRange(fLeads) ? 1 : 0;
  const m = inRange(mLeads) ? 1 : 0;
  document.body.classList.remove('theme-ddf-female', 'theme-ddf-male', 'theme-ddf-duet');
  if (f && !m) document.body.classList.add('theme-ddf-female');
  else if (m && !f) document.body.classList.add('theme-ddf-male');
  else document.body.classList.add('theme-ddf-duet');
  document.body.style.setProperty('--ddf-female-lead', f && !m ? '1' : (f && m ? '0.55' : '0.25'));
  document.body.style.setProperty('--ddf-male-lead', m && !f ? '1' : (f && m ? '0.55' : '0.25'));
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
    return;
  }
  spatialMapCache = null; // re-resolve for this song's path
  const map = loadSpatialMap(song);
  if (!map) return;
  spatialActive = true;
  spatialForcePaint = true;
  resetSpatialUiCache();
  document.body.classList.add('spatial-song-active');
  if (els.panel) {
    els.panel.classList.remove('hidden');
    els.panel.style.display = '';
  }
  ensureSpatialRadar();
  paintSpatialGuide(currentCalibratedTime(), true);
  syncSpatialLoop();
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

function ensureSpatialRadar() {
  const els = cacheSpatialEls();
  const canvas = els.radar;
  if (!canvas) return null;
  // Compact dock radar (64 CSS px)
  if (canvas.width !== 64 || canvas.height !== 64) {
    canvas.width = 64;
    canvas.height = 64;
  }
  if (!spatialCtx) spatialCtx = canvas.getContext('2d', { alpha: true });
  spatialRadarReady = true;
  return spatialCtx;
}

function drawSpatialRadar(pose) {
  const ctx = ensureSpatialRadar();
  if (!ctx || !pose) return;
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const r = 22;

  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
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

  ctx.fillStyle = 'rgba(235,235,240,0.45)';
  ctx.font = '8px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', cx, cy - r - 5);
  ctx.fillText('B', cx, cy + r + 5);
  ctx.fillText('L', cx - r - 5, cy);
  ctx.fillText('R', cx + r + 5, cy);

  ctx.fillStyle = 'rgba(235,235,240,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  function plot(az, el, color) {
    const rad = (az * Math.PI) / 180;
    // Front (az≈0) sits near top of radar; rear near bottom — ring radius encodes depth a bit
    const rear = 0.5 * (1 - Math.cos(rad));
    const ring = r * (0.55 + rear * 0.22 + Math.min(0.18, Math.abs(el) * 0.12));
    const x = cx + Math.sin(rad) * ring;
    const y = cy - Math.cos(rad) * ring;
    const s = 3.0 + Math.max(0, el) * 1.6 + (el < 0 ? Math.abs(el) * 0.4 : 0);
    // Soft halo for rear (externalized) vs solid for front
    if (rear > 0.55) {
      ctx.fillStyle = color.replace(')', ',0.28)').replace('rgb', 'rgba').replace('#ff7eb6', 'rgba(255,126,182,0.28)').replace('#5eead4', 'rgba(94,234,212,0.28)');
      if (color === '#ff7eb6') ctx.fillStyle = 'rgba(255,126,182,0.28)';
      if (color === '#5eead4') ctx.fillStyle = 'rgba(94,234,212,0.28)';
      ctx.beginPath();
      ctx.arc(x, y, s + 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    // Tiny elevation tick: up = open ring, down = filled smaller core already
    if (el > 0.35) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, s + 1.8, 0, Math.PI * 2);
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
  if (!els.panel || els.panel.classList.contains('hidden')) return;

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
  setTextIfChanged(els.section, pose.section, 'sec');
  setTextIfChanged(els.female, describeDirection(pose.az, pose.el), 'f');
  setTextIfChanged(els.male, describeDirection(mAz, mEl), 'm');
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
  // Reactive DDF background while spatial track plays
  if (document.body.classList.contains('spatial-song-active')
    || document.body.classList.contains('theme-ddf-female')
    || document.body.classList.contains('theme-ddf-male')
    || document.body.classList.contains('theme-ddf-duet')) {
    updateDdfSingerTheme(timeSec);
  }
}

function updateUpNext() {
  const nextIdx = queueIndex + 1 < queue.length ? queue[queueIndex + 1] : (loopMode === 'all' && queue.length ? queue[0] : -1);
  const next = library[nextIdx];
  $('queue-next').textContent = next ? next.displayName : 'End of queue';
}

let lastUiTimeText = '';
let lastUiTotalText = '';
let lastUiSeekPct = -1;

function updatePlaybackVisuals() {
  // Uses native-backed calibrated time; kept off the visualizer rAF path
  const current = repairTimingState(currentCalibratedTime());
  const duration = effectiveDuration();
  const pct = duration ? clamp(0, 1, current / duration) : 0;
  const deg = `${(pct * 360).toFixed(2)}deg`;
  $('play').style.setProperty('--progress', deg);
  $('hero-play').style.setProperty('--progress', deg);

  const curText = fmtTime(current);
  const totText = fmtTime(duration);
  if (curText !== lastUiTimeText) {
    lastUiTimeText = curText;
    $('time-current').textContent = curText;
    $('hero-time-current').textContent = curText;
  }
  if (totText !== lastUiTotalText) {
    lastUiTotalText = totText;
    $('time-total').textContent = totText;
    $('hero-time-total').textContent = totText;
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

async function activateAudioGraphIfPossible() {
  // Traveling Voices: stay on native <audio> path so levels/stereo match QuickTime.
  // (Web Audio MediaElementSource + sample-rate conversion was coloring the mix.)
  if (prefersNativeAudio()) {
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
  if (!canvas) return;
  // Cap DPR at 1.5 — full 2x/3x retina on a wide waveform is very expensive
  const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.max(120, Math.floor(rect.height * dpr));
  const key = `${w}x${h}`;
  if (!force && key === waveSizeKey) return;
  waveSizeKey = key;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
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
  } else if (!audio.src) {
    smoothedLevel = smoothedLevel * 0.98 + 0.08 * 0.02;
    tetoRiseEnergy *= 0.86;
    lastTetoAmplitude = 0;
  } else if (audio.paused) {
    tetoRiseEnergy *= 0.86;
  }

  ctx.save();
  ctx.globalAlpha = (!audio.paused && analyser) ? 0.34 + smoothedLevel * 0.22 : 0.18;
  ctx.fillStyle = isTeto11FxActive()
    ? 'rgba(236, 242, 255, 0.42)'
    : isTetoFxActive()
      ? 'rgba(255, 204, 168, 0.36)'
      : 'rgba(235, 235, 240, 0.24)';
  ctx.fillRect(Math.round(w * 0.015), baseline, Math.round(w * 0.97), Math.max(1, Math.round(h * 0.008)));
  ctx.restore();

  const drawAnalysis = isAudible;
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
      const target = 0.006 + breathing * 0.018 + globalGate * spectrumHeight * shape * (1 + pitchProximity * 0.18);
      const rate = target > waveBars[i] ? 0.82 : 0.32;
      waveBars[i] = waveBars[i] * (1 - rate) + target * rate;
    } else if (!audio.src) {
      waveBars[i] = waveBars[i] * 0.99 + waveBaseShape(i, bins) * 0.0008;
    }
    const amp = Math.max(0.004, softLimit(Math.max(0, waveBars[i] * WAVE_GAIN), WAVE_SOFT_LIMIT));
    const x = i * (w / bins);
    const barH = Math.min(baseline - 2, Math.max(2, amp * h * 0.78));
    const radius = Math.min(7, barW / 2);
    ctx.fillStyle = gradient;
    roundedBar(ctx, x, baseline - barH, barW, barH, radius);
  }

  // Hero level only — do NOT call updatePlaybackVisuals here (was starving the clock)
  const hero = $('hero-play');
  if (hero) hero.style.setProperty('--level', smoothedLevel.toFixed(3));

  // FX every other frame, and only on Now view
  if (isNowViewActive() && isAnyFxActive() && waveFrame % 2 === 0) {
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

['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'stalled', 'suspend', 'ended', 'error'].forEach(eventName => {
  audio.addEventListener(eventName, () => noteMediaEvent(eventName), {capture: true});
});

// Progress is driven by startProgressClock() while playing — not by visualizer rAF
// and not only by sparse timeupdate (which feels late under load).
audio.addEventListener('timeupdate', () => {
  // Lightweight fallback if progress clock isn't running
  if (!progressTimer) updatePlaybackVisuals();
});
audio.addEventListener('loadedmetadata', () => {
  syncCalibratedClockToNative();
  updatePlaybackVisuals();
});
audio.addEventListener('seeking', () => {
  syncCalibratedClockToNative(currentSong(), {allowBackward: !!seekTransaction, keepRunning: false});
  updatePlaybackVisuals();
});
audio.addEventListener('seeked', () => {
  syncCalibratedClockToNative(currentSong(), {allowBackward: !!seekTransaction, consumePending: true, keepRunning: false});
  updatePlaybackVisuals();
  spatialForcePaint = true;
  if (spatialActive) paintSpatialGuide(currentCalibratedTime(), true);
  if (seekTransaction?.finishOnSeeked) finishSeekTransaction();
});
audio.addEventListener('ratechange', () => {
  pauseCalibratedClock();
  if (!audio.paused && !audio.seeking && audio.readyState >= 3) startCalibratedClock();
});
audio.addEventListener('waiting', () => pauseCalibratedClock());
audio.addEventListener('playing', () => startCalibratedClock());
audio.addEventListener('ended', () => {
  pauseCalibratedClock();
  playNext(true);
});
audio.addEventListener('play', () => {
  $('play').textContent = '⏸';
  $('hero-play').classList.add('playing');
  $('hero-play').querySelector('.hero-icon').textContent = '⏸';
  document.body.classList.add('is-playing');
  startProgressClock();
  startWaveform();
  updatePlaybackVisuals();
  updateFxState();
  syncSpatialLoop();
});
audio.addEventListener('pause', () => {
  pauseCalibratedClock();
  $('play').textContent = '▶';
  $('hero-play').classList.remove('playing');
  $('hero-play').querySelector('.hero-icon').textContent = '▶';
  document.body.classList.remove('is-playing');
  stopProgressClock();
  updatePlaybackVisuals();
  updateFxState();
  // One idle frame so bars settle; no continuous 60fps when paused
  drawWaveform(true);
  syncSpatialLoop();
});
audio.addEventListener('error', () => {
  console.warn('Audio error for', audio.src);
  // Try next song if this one fails
  if (queueIndex + 1 < queue.length) playNext(false);
});

$('play').addEventListener('click', togglePlay);
$('hero-play').addEventListener('click', togglePlay);
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
  setPlayerVolume(1, false);
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
  resizeWaveform(true);
  resizeFxCanvas(true);
});
resizeWaveform(true);
resizeFxCanvas(true);
updateFxState();
drawWaveform(true);
loadSpatialMap(); // embed into cache immediately
preloadBatch10SpatialMaps(); // warm all 10 travel path maps
loadLibrary();
