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

const SUPPORTED_LYRIC_TRACKS = {
  'songs/kasane teto - one more bite': {
    dataUrl: './songs/lyrics/one-more-bite.json',
    scene: 'one-more-bite'
  },
  'songs/mili - hero': {
    dataUrl: './songs/lyrics/hero.json',
    scene: 'hero-story',
    variant: 'mili'
  },
  'songs/himemiya rie - hero (mili cover)': {
    dataUrl: './songs/lyrics/hero.json',
    scene: 'hero-story',
    variant: 'rie'
  },
  'songs/mimi - encore dance (japanese)': {
    dataUrl: './songs/lyrics/encore-dance.json',
    scene: 'encore-dance',
    variant: 'jp'
  },
  'songs/moonlit star - encore dance (english)': {
    dataUrl: './songs/lyrics/encore-dance.json',
    scene: 'encore-dance',
    variant: 'en'
  },
  'songs/kasane teto - waiting for tomorrow': {
    dataUrl: './songs/lyrics/waiting-for-tomorrow.json',
    scene: 'story-theater',
    variant: 'waiting'
  },
  'songs/paul owen music - through patches of violet (metal version)': {
    dataUrl: './songs/lyrics/through-patches-of-violet-metal.json',
    scene: 'story-theater',
    variant: 'violet'
  },
  'songs/paul owen music - compass (rock version feat. mili vocals)': {
    dataUrl: './songs/lyrics/compass-rock.json',
    scene: 'story-theater',
    variant: 'compass'
  },
  'songs/christian/forrest frank - celebration': {
    dataUrl: './songs/lyrics/celebration.json',
    scene: 'story-theater',
    variant: 'celebration'
  },
  'songs/christian/phil wickham - psalm 8 (halle)': {
    dataUrl: './songs/lyrics/psalm-8-halle.json',
    scene: 'story-theater',
    variant: 'psalm'
  },
  'songs/christian/josiah queen - dusty bibles': {
    dataUrl: './songs/lyrics/dusty-bibles.json',
    scene: 'story-theater',
    variant: 'dusty'
  }
};
const SONG_METADATA_OVERRIDES = {
  'songs/Kasane Teto - One More Bite.m4a': {
    artist: 'MiliSen feat. Kasane Teto',
    title: 'One More Bite'
  }
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
let eqPreampNode = null;
let eqFilterNodes = [];
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
let playbackAttemptSerial = 0;
let playbackRetryCount = 0;
let playbackRetryTimer = 0;
let supportedLyricsData = null;
let supportedLyricsPromise = null;
let supportedLyricsSongKey = '';
let supportedLyricsLineIndex = -2;
let supportedLyricsSectionIndex = -2;
let supportedLyricsWordNodes = [];
let oneMoreBiteSceneActive = false;
let heroStorySceneActive = false;
let encoreSceneActive = false;
let storyTheaterSceneActive = false;
const SONG_EQ_STORAGE_KEY = 'vp_song_eq_v1';
const EQ_BANDS = [
  { frequency: 60, type: 'lowshelf', label: 'Sub', detail: '60 Hz' },
  { frequency: 170, type: 'peaking', q: 0.9, label: 'Bass', detail: '170 Hz' },
  { frequency: 350, type: 'peaking', q: 1, label: 'Low Mid', detail: '350 Hz' },
  { frequency: 1000, type: 'peaking', q: 1, label: 'Mid', detail: '1 kHz' },
  { frequency: 3500, type: 'peaking', q: 0.9, label: 'Presence', detail: '3.5 kHz' },
  { frequency: 10000, type: 'highshelf', label: 'Air', detail: '10 kHz' },
];
const EQ_PRESETS = {
  flat: { preamp: 0, gains: [0, 0, 0, 0, 0, 0] },
  bass: { preamp: -2, gains: [6, 4, 1, 0, 0, 1] },
  warm: { preamp: -1.5, gains: [3, 2.5, 1.5, 0, -1, -1.5] },
  vocal: { preamp: -1.5, gains: [-2, -1, 0, 2.5, 4, 1.5] },
  bright: { preamp: -2, gains: [-1, 0, 0.5, 1.5, 3.5, 5] },
  loudness: { preamp: -3, gains: [5, 3, 0, -1, 2, 4] },
};
let songEqProfiles = loadSongEqProfiles();
let temporaryGlobalEq = createEqProfile();
let eqEditMode = 'song';
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
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Traveling Voices v7 Slow Glide CIPIC 050)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Traveling Voices v7 Slow Glide CIPIC 050 Quiet Inst)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Female Vocal Remaster v3)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Male Vocal Remaster v3)', DDF_EFFECT_PROFILE),
  ...audioProfileEntries('songs/OR3O (Monika) feat. Rachie (Sayori), Kathy-chan (Yuri) & Chi Chi (Natsuki) - Doki Doki Forever', DDF_EFFECT_PROFILE),
  // Lofi cut — stretched timeline + chill intensity (do NOT share full-speed DDF profile)
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Lofi)', DDF_LOFI_EFFECT_PROFILE),
  ...audioProfileEntries('songs/Joshua Glass & Grok 4.5 - Doki Doki Forever (Female-Dominant Rectangle)', DDF_EFFECT_PROFILE),
]);
const seededUnit = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
const ONE_MORE_BITE_CRUMBS = Array.from({ length: 26 }, (_, i) => ({
  x: 0.03 + seededUnit((i + 1) * 17.31) * 0.94,
  y: 0.08 + seededUnit((i + 1) * 43.73) * 0.82,
  size: 1.5 + seededUnit((i + 1) * 8.91) * 4.5,
  phase: seededUnit((i + 1) * 67.17) * Math.PI * 2,
  color: i % 3
}));
const HERO_STORY_MOTES = Array.from({ length: 32 }, (_, i) => ({
  x: 0.025 + seededUnit((i + 1) * 31.41) * 0.95,
  y: 0.06 + seededUnit((i + 1) * 73.19) * 0.84,
  size: 0.8 + seededUnit((i + 1) * 11.73) * 2.8,
  phase: seededUnit((i + 1) * 47.31) * Math.PI * 2,
  speed: 0.14 + seededUnit((i + 1) * 19.07) * 0.34,
  kind: i % 4
}));
const ENCORE_MOTES = Array.from({ length: 36 }, (_, i) => ({
  x: 0.02 + seededUnit((i + 1) * 29.17) * 0.96,
  y: 0.05 + seededUnit((i + 1) * 61.43) * 0.86,
  size: 1.1 + seededUnit((i + 1) * 13.91) * 3.8,
  phase: seededUnit((i + 1) * 71.03) * Math.PI * 2,
  speed: 0.18 + seededUnit((i + 1) * 23.27) * 0.42,
  lane: i % 6
}));
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

function clampEqDb(value, min = -12, max = 12) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : 0;
}

function createEqProfile(source = {}) {
  return {
    enabled: source.enabled === true,
    preamp: clampEqDb(source.preamp),
    gains: EQ_BANDS.map((_, index) => clampEqDb(source.gains?.[index])),
  };
}

function loadSongEqProfiles() {
  try {
    const stored = JSON.parse(localStorage.getItem(SONG_EQ_STORAGE_KEY) || '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).map(([key, profile]) => [key, createEqProfile(profile)]));
  } catch {
    return {};
  }
}

function saveSongEqProfiles() {
  try { localStorage.setItem(SONG_EQ_STORAGE_KEY, JSON.stringify(songEqProfiles)); }
  catch {}
}

function songEqKey(song = currentSong()) {
  return song ? (song.id || song.path || song.name || '') : '';
}

function savedEqForSong(song = currentSong()) {
  const key = songEqKey(song);
  return key && songEqProfiles[key] ? createEqProfile(songEqProfiles[key]) : createEqProfile();
}

function effectiveEqProfile(song = currentSong()) {
  return temporaryGlobalEq.enabled ? createEqProfile(temporaryGlobalEq) : savedEqForSong(song);
}

function isEqAudiblyActive(song = currentSong()) {
  const profile = effectiveEqProfile(song);
  return profile.enabled && (
    Math.abs(profile.preamp) > 0.01 || profile.gains.some(gain => Math.abs(gain) > 0.01)
  );
}

function usesNativeAudioPath(song = currentSong()) {
  return prefersNativeAudio(song) && !isEqAudiblyActive(song);
}

function dbToGain(db) {
  return Math.pow(10, clampEqDb(db) / 20);
}

function editableEqProfile() {
  return eqEditMode === 'global' ? createEqProfile(temporaryGlobalEq) : savedEqForSong();
}

function persistEditableEqProfile(profile) {
  const normalized = createEqProfile(profile);
  if (eqEditMode === 'global') {
    temporaryGlobalEq = normalized;
  } else {
    const key = songEqKey();
    if (!key) return;
    songEqProfiles[key] = normalized;
    saveSongEqProfiles();
  }
}

function formatEqDb(value) {
  const db = clampEqDb(value);
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

function applyEqualizerToGraph(song = currentSong()) {
  if (!audioCtx || !eqPreampNode || eqFilterNodes.length !== EQ_BANDS.length) return;
  const profile = effectiveEqProfile(song);
  const active = profile.enabled;
  const now = audioCtx.currentTime;
  eqPreampNode.gain.cancelScheduledValues(now);
  eqPreampNode.gain.setTargetAtTime(active ? dbToGain(profile.preamp) : 1, now, 0.012);
  eqFilterNodes.forEach((filter, index) => {
    filter.gain.cancelScheduledValues(now);
    filter.gain.setTargetAtTime(active ? profile.gains[index] : 0, now, 0.012);
  });
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

function normalizeSongRef(ref) {
  let value = String(ref || '').trim();
  try { value = decodeURIComponent(value); } catch {}
  return value
    .normalize('NFC')
    .replace(/^\.\//, '')
    .replace(AUDIO_EXTENSION_RE, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

function normalizedMediaUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    url.searchParams.delete('_vp_retry');
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(value).split('?')[0];
  }
}

function sameMediaUrl(a, b) {
  return !!a && !!b && normalizedMediaUrl(a) === normalizedMediaUrl(b);
}

function audioElementMatchesCurrentSong(el) {
  const song = currentSong();
  return el === audio && !!song && sameMediaUrl(el.currentSrc || el.src, song.url);
}

function refMatchesSong(ref, song) {
  if (ref === song.id || ref === song.name) return true;
  const normalized = normalizeSongRef(ref);
  return normalizeSongRef(song.id) === normalized || normalizeSongRef(song.name) === normalized;
}

function findSongIndex(ref) {
  let idx = library.findIndex(song => song.id === ref);
  if (idx < 0) idx = library.findIndex(song => song.name === ref);
  if (idx < 0) {
    const normalized = normalizeSongRef(ref);
    idx = library.findIndex(song => (
      normalizeSongRef(song.id) === normalized ||
      normalizeSongRef(song.path) === normalized ||
      normalizeSongRef(song.name) === normalized
    ));
  }
  return idx;
}

function currentSong() {
  return library[queue[queueIndex]] || null;
}

function supportedLyricTrackForSong(song = currentSong()) {
  if (!song) return null;
  const keys = [song.path, song.id, song.name].map(normalizeSongRef);
  for (const key of keys) {
    if (SUPPORTED_LYRIC_TRACKS[key]) return { key, ...SUPPORTED_LYRIC_TRACKS[key] };
  }
  return null;
}

function isOneMoreBiteSong(song = currentSong()) {
  return supportedLyricTrackForSong(song)?.scene === 'one-more-bite';
}

function isHeroStorySong(song = currentSong()) {
  return supportedLyricTrackForSong(song)?.scene === 'hero-story';
}

function heroStoryVariant(song = currentSong()) {
  return supportedLyricTrackForSong(song)?.variant || 'mili';
}

function isEncoreDanceSong(song = currentSong()) {
  return supportedLyricTrackForSong(song)?.scene === 'encore-dance';
}

function encoreDanceVariant(song = currentSong()) {
  return supportedLyricTrackForSong(song)?.variant || 'jp';
}

function isStoryTheaterSong(song = currentSong()) {
  return supportedLyricTrackForSong(song)?.scene === 'story-theater';
}

function storyTheaterVariant(song = currentSong()) {
  return supportedLyricTrackForSong(song)?.variant || 'waiting';
}

async function loadSupportedLyrics(config) {
  if (!config) return null;
  if (supportedLyricsData && supportedLyricsSongKey === config.key) return supportedLyricsData;
  if (supportedLyricsPromise && supportedLyricsSongKey === config.key) return supportedLyricsPromise;
  supportedLyricsSongKey = config.key;
  supportedLyricsData = null;
  supportedLyricsPromise = fetch(config.dataUrl, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`lyrics HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (supportedLyricsSongKey !== config.key) return null;
      const hasLines = Array.isArray(data.lines) || Object.values(data.variants || {}).some(variant => Array.isArray(variant?.lines));
      if (!hasLines || !Array.isArray(data.sections)) {
        throw new Error('lyrics file is missing lines or sections');
      }
      supportedLyricsData = data;
      supportedLyricsPromise = null;
      supportedLyricsLineIndex = -2;
      supportedLyricsSectionIndex = -2;
      if (config.scene === 'story-theater') {
        updateStoryTheaterLyrics(currentCalibratedTime(), true);
      } else if (config.scene === 'encore-dance') {
        updateEncoreDanceLyrics(currentCalibratedTime(), true);
      } else if (config.scene === 'hero-story') {
        updateHeroStoryLyrics(currentCalibratedTime(), true);
      } else {
        updateOneMoreBiteLyrics(currentCalibratedTime(), true);
      }
      return data;
    })
    .catch(error => {
      supportedLyricsPromise = null;
      console.warn('Could not load supported lyrics:', error);
      const current = config.scene === 'story-theater'
        ? $('story-current')
        : config.scene === 'encore-dance'
          ? $('encore-current')
          : config.scene === 'hero-story'
            ? $('hero-story-current')
            : $('omb-lyric-current');
      if (current) current.textContent = 'Lyrics could not be loaded.';
      return null;
    });
  return supportedLyricsPromise;
}

function oneMoreBiteInterludeText(time, data) {
  const first = data?.lines?.[0]?.start ?? 6.92;
  if (time < first) return 'A little room before the first bite.';
  if (time >= 123.2 && time < 139.76) return 'Piano takes the plate.';
  if (time >= 180.9) return 'The last taste lingers.';
  return 'A breath between bites.';
}

function weightedWordTimings(line) {
  const words = line.text.trim().split(/\s+/).filter(Boolean);
  const duration = Math.max(0.1, line.end - line.start);
  const weights = words.map(word => Math.max(1, word.replace(/[^A-Za-z0-9']/g, '').length ** 0.62));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = line.start;
  return words.map((word, index) => {
    const end = index === words.length - 1 ? line.end : cursor + duration * weights[index] / total;
    const timing = { word, start: cursor, end };
    cursor = end;
    return timing;
  });
}

function measuredWordTimings(line) {
  if (!Array.isArray(line.words) || !line.words.length) return weightedWordTimings(line);
  return line.words
    .filter(word => word && word.word && Number.isFinite(word.start) && Number.isFinite(word.end))
    .map(word => ({
      word: word.word,
      start: clamp(line.start, line.end, word.start),
      end: clamp(line.start, line.end, Math.max(word.start + 0.02, word.end))
    }));
}

function decodedOneMoreBiteEnvelope(analysis, name) {
  if (!analysis) return [];
  const cacheKey = `_${name}Values`;
  if (analysis[cacheKey]) return analysis[cacheKey];
  if (Array.isArray(analysis[name])) return analysis[name];
  const encoded = analysis[`${name}Base64`];
  if (!encoded) return [];
  try {
    const binary = atob(encoded);
    const values = Uint8Array.from(binary, char => char.charCodeAt(0));
    Object.defineProperty(analysis, cacheKey, { value: values, enumerable: false });
    return values;
  } catch (error) {
    console.warn(`Could not decode One More Bite ${name} envelope:`, error);
    return [];
  }
}

function oneMoreBiteAnalysisAt(time) {
  const analysis = supportedLyricsData?.analysis;
  const energyValues = decodedOneMoreBiteEnvelope(analysis, 'energy');
  const onsetValues = decodedOneMoreBiteEnvelope(analysis, 'onsets');
  if (!analysis?.step || !energyValues.length) {
    return { energy: 0, onset: 0 };
  }
  const position = clamp(0, energyValues.length - 1, time / analysis.step);
  const lower = Math.floor(position);
  const upper = Math.min(energyValues.length - 1, lower + 1);
  const mix = position - lower;
  const sample = values => {
    if (!values?.length) return 0;
    return ((values[lower] || 0) * (1 - mix) + (values[upper] || 0) * mix) / 100;
  };
  const onset = Math.max(
    sample(onsetValues),
    (onsetValues[Math.max(0, lower - 1)] || 0) / 125,
    (onsetValues[Math.max(0, lower - 2)] || 0) / 165
  );
  return { energy: sample(energyValues), onset: clamp(0, 1, onset) };
}

function oneMoreBiteBeatPeaks(analysis) {
  if (!analysis?.step) return [];
  if (analysis._beatPeaks) return analysis._beatPeaks;
  const values = decodedOneMoreBiteEnvelope(analysis, 'onsets');
  if (!values.length) return [];
  const minGap = Math.max(2, Math.round(0.28 / analysis.step));
  const peaks = [];
  for (let index = 2; index < values.length - 2; index++) {
    const strength = values[index] / 100;
    if (strength < 0.48) continue;
    if (values[index] < values[index - 1] || values[index] < values[index + 1]) continue;
    if (values[index] < values[index - 2] || values[index] < values[index + 2]) continue;
    const previous = peaks[peaks.length - 1];
    if (previous && index - previous.index < minGap) {
      if (strength > previous.strength) peaks[peaks.length - 1] = { index, strength };
      continue;
    }
    peaks.push({ index, strength });
  }
  const timedPeaks = peaks.map((peak, ordinal) => ({
    ...peak,
    ordinal,
    time: peak.index * analysis.step
  }));
  Object.defineProperty(analysis, '_beatPeaks', { value: timedPeaks, enumerable: false });
  return timedPeaks;
}

function oneMoreBiteBeatsAt(time, chorus) {
  const analysis = supportedLyricsData?.analysis;
  const peaks = oneMoreBiteBeatPeaks(analysis);
  const threshold = chorus ? 0.58 : 0.84;
  const duration = chorus ? 1.25 : 0.68;
  const active = [];
  for (let index = peaks.length - 1; index >= 0; index--) {
    const peak = peaks[index];
    const age = time - peak.time;
    if (age < -0.04) continue;
    if (age > duration) break;
    if (peak.strength < threshold) continue;
    const directionIndex = Math.floor(peak.ordinal / 4) % 4;
    const directions = [
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 1 }
    ];
    const progress = clamp(0, 1, Math.max(0, age) / duration);
    const strengthScale = 0.42 + smoothStep(threshold, 1, peak.strength) * 0.58;
    const entrance = smoothStep(0, 0.07, progress);
    const exit = 1 - smoothStep(0.62, 1, progress);
    active.push({
      ...peak,
      age: Math.max(0, age),
      duration,
      direction: directions[directionIndex],
      progress,
      life: entrance * exit,
      impact: strengthScale * entrance * exit
    });
  }
  return active.reverse();
}

function renderOneMoreBiteLine(index, data) {
  const current = $('omb-lyric-current');
  const previous = $('omb-lyric-previous');
  const next = $('omb-lyric-next');
  if (!current || !previous || !next) return;
  supportedLyricsWordNodes = [];
  current.replaceChildren();
  const line = index >= 0 ? data.lines[index] : null;
  if (!line) {
    const note = document.createElement('span');
    note.className = 'omb-instrumental';
    note.textContent = oneMoreBiteInterludeText(currentCalibratedTime(), data);
    current.appendChild(note);
    current.classList.remove('is-aside');
    const nextIndex = data.lines.findIndex(item => item.start > currentCalibratedTime());
    previous.textContent = '';
    next.textContent = nextIndex >= 0 ? data.lines[nextIndex].text : '';
    return;
  }
  current.classList.toggle('is-aside', !!line.aside);
  measuredWordTimings(line).forEach((timing, wordIndex) => {
    if (wordIndex) current.appendChild(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'omb-word';
    span.textContent = timing.word;
    current.appendChild(span);
    supportedLyricsWordNodes.push({ ...timing, element: span });
  });
  previous.textContent = data.lines[index - 1]?.text || '';
  next.textContent = data.lines[index + 1]?.text || '';
}

function updateOneMoreBiteLyrics(time = currentCalibratedTime(), force = false) {
  if (!oneMoreBiteSceneActive) return;
  const theater = $('omb-theater');
  if (!theater) return;
  const duration = supportedLyricsData?.duration || effectiveDuration() || 194.049;
  const pct = clamp(0, 1, time / duration);
  theater.style.setProperty('--omb-progress', `${(pct * 100).toFixed(3)}%`);
  const progress = $('omb-progress-fill');
  if (progress) progress.style.width = `${(pct * 100).toFixed(3)}%`;
  const cur = $('omb-time-current');
  const total = $('omb-time-total');
  if (cur) cur.textContent = fmtTime(time);
  if (total) total.textContent = fmtTime(duration);
  if (!supportedLyricsData) return;

  const data = supportedLyricsData;
  const sectionIndex = data.sections.findIndex(section => time >= section.start && time < section.end);
  if (force || sectionIndex !== supportedLyricsSectionIndex) {
    supportedLyricsSectionIndex = sectionIndex;
    const section = data.sections[sectionIndex] || data.sections[data.sections.length - 1];
    if ($('omb-section')) $('omb-section').textContent = section?.name || 'One More Bite';
    if ($('omb-status')) $('omb-status').textContent = section?.short || 'ONE MORE BITE';
    if ($('omb-course-number')) $('omb-course-number').textContent = String(Math.max(1, sectionIndex + 1)).padStart(2, '0');
    theater.classList.toggle('is-chorus', !!section?.short?.includes('CHORUS'));
  }

  const lineIndex = data.lines.findIndex(line => time >= line.start && time < line.end + 0.12);
  if (force || lineIndex !== supportedLyricsLineIndex) {
    supportedLyricsLineIndex = lineIndex;
    renderOneMoreBiteLine(lineIndex, data);
  }
  supportedLyricsWordNodes.forEach(word => {
    const wordProgress = clamp(0, 1, (time - word.start) / Math.max(0.04, word.end - word.start));
    word.element.style.setProperty('--word-progress', `${(wordProgress * 100).toFixed(1)}%`);
    word.element.classList.toggle('is-current', wordProgress > 0 && wordProgress < 1);
  });
}

function setOneMoreBiteTheaterActive(active, song = currentSong()) {
  const nextActive = !!active && isOneMoreBiteSong(song);
  const theater = $('omb-theater');
  document.body.classList.toggle('omb-theater-active', nextActive);
  if (theater) theater.classList.toggle('hidden', !nextActive);
  if (oneMoreBiteSceneActive === nextActive) return;
  oneMoreBiteSceneActive = nextActive;
  supportedLyricsLineIndex = -2;
  supportedLyricsSectionIndex = -2;
  supportedLyricsWordNodes = [];
  if (nextActive) {
    const config = supportedLyricTrackForSong(song);
    loadSupportedLyrics(config);
    updateOneMoreBiteLyrics(currentCalibratedTime(), true);
    drawOneMoreBiteFx({ glow: 0, motion: 0, rise: 0 }, currentCalibratedTime());
    scheduleNowLayoutSync();
  }
}

function heroStoryTimelineTime(audioTime, variant = heroStoryVariant()) {
  if (variant !== 'rie') return Math.max(0, audioTime);
  const points = supportedLyricsData?.timing?.rieOffset;
  if (!Array.isArray(points) || !points.length) return Math.max(0, audioTime - 0.25);
  let left = points[0];
  let right = points[points.length - 1];
  for (let index = 1; index < points.length; index++) {
    if (audioTime <= points[index].at) {
      right = points[index];
      left = points[index - 1];
      break;
    }
  }
  const span = Math.max(0.001, right.at - left.at);
  const mix = clamp(0, 1, (audioTime - left.at) / span);
  const offset = left.seconds + (right.seconds - left.seconds) * mix;
  return Math.max(0, audioTime - offset);
}

function heroStoryAnalysisProfile(variant = heroStoryVariant()) {
  return supportedLyricsData?.analysis?.[variant] || supportedLyricsData?.analysis?.mili || null;
}

function heroStoryAnalysisAt(audioTime, variant = heroStoryVariant()) {
  const analysis = heroStoryAnalysisProfile(variant);
  const energyValues = decodedOneMoreBiteEnvelope(analysis, 'energy');
  const onsetValues = decodedOneMoreBiteEnvelope(analysis, 'onsets');
  if (!analysis?.step || !energyValues.length) return { energy: 0, onset: 0 };
  const position = clamp(0, energyValues.length - 1, audioTime / analysis.step);
  const lower = Math.floor(position);
  const upper = Math.min(energyValues.length - 1, lower + 1);
  const mix = position - lower;
  const sample = values => {
    if (!values?.length) return 0;
    return ((values[lower] || 0) * (1 - mix) + (values[upper] || 0) * mix) / 100;
  };
  return {
    energy: clamp(0, 1, sample(energyValues)),
    onset: clamp(0, 1, Math.max(sample(onsetValues), (onsetValues[Math.max(0, lower - 1)] || 0) / 130))
  };
}

function heroStoryInterludeText(time, data) {
  const section = data?.sections?.find(item => time >= item.start && time < item.end);
  const notes = [
    'Count the steps into the story.',
    'The hills still believe in heroes.',
    'Devotion becomes a script.',
    'Rain finds the painted surface.',
    'A name echoes inside the void.',
    'The same scene turns again.',
    'The system assigns its parts.',
    'Stand without the borrowed title.',
    'Choose what justice means.',
    'The stage remembers the choice.'
  ];
  return notes[section?.phase ?? 0] || 'The story waits for its next line.';
}

function renderHeroStoryLine(index, data, timelineTime) {
  const current = $('hero-story-current');
  const previous = $('hero-story-previous');
  const next = $('hero-story-next');
  if (!current || !previous || !next) return;
  supportedLyricsWordNodes = [];
  current.replaceChildren();
  const line = index >= 0 ? data.lines[index] : null;
  if (!line) {
    const note = document.createElement('span');
    note.className = 'hero-story-instrumental';
    note.textContent = heroStoryInterludeText(timelineTime, data);
    current.appendChild(note);
    current.classList.remove('is-aside');
    const nextIndex = data.lines.findIndex(item => item.start > timelineTime);
    previous.textContent = '';
    next.textContent = nextIndex >= 0 ? data.lines[nextIndex].text : '';
    return;
  }
  current.classList.toggle('is-aside', !!line.aside);
  measuredWordTimings(line).forEach((timing, wordIndex) => {
    if (wordIndex) current.appendChild(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'hero-story-word';
    span.textContent = timing.word;
    current.appendChild(span);
    supportedLyricsWordNodes.push({ ...timing, element: span });
  });
  previous.textContent = data.lines[index - 1]?.text || '';
  next.textContent = data.lines[index + 1]?.text || '';
}

function updateHeroStoryLyrics(audioTime = currentCalibratedTime(), force = false) {
  if (!heroStorySceneActive) return;
  const theater = $('hero-story-theater');
  if (!theater) return;
  const variant = heroStoryVariant();
  const timelineTime = heroStoryTimelineTime(audioTime, variant);
  const duration = effectiveDuration() || supportedLyricsData?.duration || 214.9;
  const pct = clamp(0, 1, audioTime / duration);
  theater.style.setProperty('--hero-story-progress', `${(pct * 100).toFixed(3)}%`);
  const progress = $('hero-story-progress-fill');
  if (progress) progress.style.width = `${(pct * 100).toFixed(3)}%`;
  if ($('hero-story-time-current')) $('hero-story-time-current').textContent = fmtTime(audioTime);
  if ($('hero-story-time-total')) $('hero-story-time-total').textContent = fmtTime(duration);
  if ($('hero-story-artist')) {
    $('hero-story-artist').textContent = variant === 'rie' ? 'HIMEMIYA RIE / MILI COVER' : 'MILI / ORIGINAL';
  }
  if (!supportedLyricsData) return;

  const data = supportedLyricsData;
  const sectionIndex = data.sections.findIndex(section => timelineTime >= section.start && timelineTime < section.end);
  const section = data.sections[sectionIndex] || data.sections[data.sections.length - 1];
  if (force || sectionIndex !== supportedLyricsSectionIndex) {
    supportedLyricsSectionIndex = sectionIndex;
    if ($('hero-story-section')) $('hero-story-section').textContent = section?.name || 'Hero';
    if ($('hero-story-status')) $('hero-story-status').textContent = section?.short || 'HERO';
    if ($('hero-story-act-number')) $('hero-story-act-number').textContent = String(Math.max(1, sectionIndex + 1)).padStart(2, '0');
    theater.dataset.phase = String(section?.phase ?? 0);
    theater.classList.toggle('is-void', section?.phase === 4);
    theater.classList.toggle('is-resolve', (section?.phase ?? 0) >= 7 && (section?.phase ?? 0) <= 8);
  }

  const lineIndex = data.lines.findIndex(line => timelineTime >= line.start && timelineTime < line.end + 0.1);
  if (force || lineIndex !== supportedLyricsLineIndex) {
    supportedLyricsLineIndex = lineIndex;
    renderHeroStoryLine(lineIndex, data, timelineTime);
  }
  supportedLyricsWordNodes.forEach(word => {
    const wordProgress = clamp(0, 1, (timelineTime - word.start) / Math.max(0.04, word.end - word.start));
    word.element.style.setProperty('--word-progress', `${(wordProgress * 100).toFixed(1)}%`);
    word.element.classList.toggle('is-current', wordProgress > 0 && wordProgress < 1);
  });
}

function setHeroStoryTheaterActive(active, song = currentSong()) {
  const nextActive = !!active && isHeroStorySong(song);
  const theater = $('hero-story-theater');
  document.body.classList.toggle('hero-story-active', nextActive);
  if (theater) theater.classList.toggle('hidden', !nextActive);
  if (heroStorySceneActive === nextActive) return;
  heroStorySceneActive = nextActive;
  supportedLyricsLineIndex = -2;
  supportedLyricsSectionIndex = -2;
  supportedLyricsWordNodes = [];
  if (nextActive) {
    const config = supportedLyricTrackForSong(song);
    loadSupportedLyrics(config);
    updateHeroStoryLyrics(currentCalibratedTime(), true);
    drawHeroStoryFx({ glow: 0, motion: 0, rise: 0 }, currentCalibratedTime());
    scheduleNowLayoutSync();
  }
}

function encoreCanonicalTime(audioTime, variant = encoreDanceVariant()) {
  const offset = variant === 'en' ? (supportedLyricsData?.timing?.enOffset ?? 0.05) : 0;
  return Math.max(0, audioTime - offset);
}

function encoreVariantData(variant = encoreDanceVariant()) {
  return supportedLyricsData?.variants?.[variant] || null;
}

function encoreAnalysisProfile(variant = encoreDanceVariant()) {
  return supportedLyricsData?.analysis?.[variant] || supportedLyricsData?.analysis?.jp || null;
}

function encoreAnalysisAt(audioTime, variant = encoreDanceVariant()) {
  const analysis = encoreAnalysisProfile(variant);
  const energyValues = decodedOneMoreBiteEnvelope(analysis, 'energy');
  const onsetValues = decodedOneMoreBiteEnvelope(analysis, 'onsets');
  if (!analysis?.step || !energyValues.length) return { energy: 0, onset: 0 };
  const position = clamp(0, energyValues.length - 1, audioTime / analysis.step);
  const lower = Math.floor(position);
  const upper = Math.min(energyValues.length - 1, lower + 1);
  const mix = position - lower;
  const sample = values => {
    if (!values?.length) return 0;
    return ((values[lower] || 0) * (1 - mix) + (values[upper] || 0) * mix) / 100;
  };
  return {
    energy: clamp(0, 1, sample(energyValues)),
    onset: clamp(0, 1, Math.max(sample(onsetValues), (onsetValues[Math.max(0, lower - 1)] || 0) / 126))
  };
}

function encoreInterludeText(time, data) {
  const section = data?.sections?.find(item => time >= item.start && time < item.end);
  const notes = [
    'Signal warming. Curtain still closed.',
    'Streetlights skip in quarter notes.',
    'The first encore tears open the night.',
    'Moonlight holds the frame.',
    'A quieter signal crosses the water.',
    'Love loops until the pixels give way.',
    'No lyrics. Just redline motion.',
    'Run the chorus back brighter.',
    'Keep the last words clean.',
    'One final request from the crowd.',
    'Only the afterimage remains.'
  ];
  return notes[section?.phase ?? 0] || 'Waiting for the next signal.';
}

function renderEncoreLine(index, variantData, audioTime) {
  const current = $('encore-current');
  const previous = $('encore-previous');
  const next = $('encore-next');
  if (!current || !previous || !next) return;
  supportedLyricsWordNodes = [];
  current.replaceChildren();
  const lines = variantData?.lines || [];
  const line = index >= 0 ? lines[index] : null;
  if (!line) {
    const note = document.createElement('span');
    note.className = 'encore-instrumental';
    note.textContent = encoreInterludeText(encoreCanonicalTime(audioTime), supportedLyricsData);
    current.appendChild(note);
    current.classList.remove('is-aside');
    const nextIndex = lines.findIndex(item => item.start > audioTime);
    previous.textContent = '';
    next.textContent = nextIndex >= 0 ? lines[nextIndex].text : '';
    return;
  }
  current.classList.toggle('is-aside', !!line.aside);
  const timings = measuredWordTimings(line);
  timings.forEach((timing, wordIndex) => {
    if (wordIndex && variantData.language !== 'ja') current.appendChild(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'encore-word';
    span.textContent = timing.word;
    current.appendChild(span);
    supportedLyricsWordNodes.push({ ...timing, element: span });
  });
  previous.textContent = lines[index - 1]?.text || '';
  next.textContent = lines[index + 1]?.text || '';
}

function updateEncoreDanceLyrics(audioTime = currentCalibratedTime(), force = false) {
  if (!encoreSceneActive) return;
  const theater = $('encore-theater');
  if (!theater) return;
  const variant = encoreDanceVariant();
  const canonicalTime = encoreCanonicalTime(audioTime, variant);
  const duration = effectiveDuration() || supportedLyricsData?.duration || 137.23;
  const pct = clamp(0, 1, audioTime / duration);
  theater.style.setProperty('--encore-progress', `${(pct * 100).toFixed(3)}%`);
  if ($('encore-progress-fill')) $('encore-progress-fill').style.width = `${(pct * 100).toFixed(3)}%`;
  if ($('encore-time-current')) $('encore-time-current').textContent = fmtTime(audioTime);
  if ($('encore-time-total')) $('encore-time-total').textContent = fmtTime(duration);
  const variantData = encoreVariantData(variant);
  if ($('encore-artist')) $('encore-artist').textContent = variantData?.label || 'MIMI / KASANE TETO SV';
  if ($('encore-language')) $('encore-language').textContent = variant === 'en' ? 'ENGLISH SIGNAL' : 'JAPANESE SIGNAL';
  theater.dataset.variant = variant;
  theater.dataset.language = variantData?.language || (variant === 'en' ? 'en' : 'ja');
  if (!supportedLyricsData || !variantData) return;

  const data = supportedLyricsData;
  const sectionIndex = data.sections.findIndex(section => canonicalTime >= section.start && canonicalTime < section.end);
  const section = data.sections[sectionIndex] || data.sections[data.sections.length - 1];
  if (force || sectionIndex !== supportedLyricsSectionIndex) {
    supportedLyricsSectionIndex = sectionIndex;
    if ($('encore-section')) $('encore-section').textContent = section?.name || 'Encore Dance';
    if ($('encore-status')) $('encore-status').textContent = section?.short || 'ENCORE';
    if ($('encore-scene-number')) $('encore-scene-number').textContent = String(Math.max(1, sectionIndex + 1)).padStart(2, '0');
    theater.dataset.phase = String(section?.phase ?? 0);
    theater.classList.toggle('is-chorus', [2, 5, 7, 9].includes(section?.phase));
    theater.classList.toggle('is-break', section?.phase === 6);
    theater.classList.toggle('is-afterimage', section?.phase === 10);
  }

  const lines = variantData.lines || [];
  const lineIndex = lines.findIndex(line => audioTime >= line.start && audioTime < line.end + 0.1);
  if (force || lineIndex !== supportedLyricsLineIndex) {
    supportedLyricsLineIndex = lineIndex;
    renderEncoreLine(lineIndex, variantData, audioTime);
  }
  supportedLyricsWordNodes.forEach(word => {
    const wordProgress = clamp(0, 1, (audioTime - word.start) / Math.max(0.025, word.end - word.start));
    word.element.style.setProperty('--word-progress', `${(wordProgress * 100).toFixed(1)}%`);
    word.element.classList.toggle('is-current', wordProgress > 0 && wordProgress < 1);
  });
}

function setEncoreTheaterActive(active, song = currentSong()) {
  const nextActive = !!active && isEncoreDanceSong(song);
  const theater = $('encore-theater');
  document.body.classList.toggle('encore-theater-active', nextActive);
  if (theater) theater.classList.toggle('hidden', !nextActive);
  if (encoreSceneActive === nextActive) return;
  encoreSceneActive = nextActive;
  supportedLyricsLineIndex = -2;
  supportedLyricsSectionIndex = -2;
  supportedLyricsWordNodes = [];
  if (nextActive) {
    const config = supportedLyricTrackForSong(song);
    loadSupportedLyrics(config);
    updateEncoreDanceLyrics(currentCalibratedTime(), true);
    drawEncoreDanceFx({ glow: 0, motion: 0, rise: 0 }, currentCalibratedTime());
    scheduleNowLayoutSync();
  }
}

const STORY_INTERLUDES = {
  waiting: ['The room holds its breath.', 'Clouds pass the window.', 'Tomorrow turns another tooth.', 'Petals find the current.', 'The clock keeps faith.', 'Morning reaches the desk.', 'The curtain is all light.'],
  violet: ['Two futures share one frame.', 'The mirror remembers first.', 'Pain acquires an orbit.', 'The thread pulls taut.', 'Nothing deletes cleanly.', 'A white interval.', 'The orbit reverses.', 'Two answers remain.', 'Violet outlives the message.'],
  compass: ['One star, no bearing.', 'A gold cord crosses the mirror sea.', 'The needle disappears below.', 'Certainty divides the water.', 'Curiosity becomes north.', 'The cord pulls against the current.', 'Gold outruns the storm.', 'The tide answers four times.', 'One light remains.'],
  celebration: ['The room is waking up.', 'Hands find the count.', 'Clap. Stomp. Lift.', 'The room answers back.', 'Less of me.', 'Joy takes the floor.', 'Freedom gets loud.', 'Everybody in.', 'One last celebration.'],
  psalm: ['Praise breaks the horizon.', 'The heavens begin in wonder.', 'Known beneath an enormous sky.', 'The horizon learns the Name.', 'Praise becomes constellation.', 'A stronghold made of voices.', 'Yahweh across the firmament.', 'The whole sky opens.', 'Majesty fills the earth.', 'Every star joins the answer.', 'The desert keeps the light.'],
  dusty: ['Dust turns gold in the window.', 'A letter across an empty pew.', 'Busy is not the same as alive.', 'The glass goes dark.', 'The room listens.', 'One life, fully awake.', 'The pages open.', 'Only the beams are moving.', 'An old friend returns.', 'No more closed eyes.', 'Dust settles on nothing.']
};

const STORY_PEAK_PHASES = {
  waiting: [2, 5],
  violet: [2, 4, 7],
  compass: [2, 4, 5, 6],
  celebration: [2, 3, 6, 7, 8],
  psalm: [3, 5, 6, 8],
  dusty: [3, 6, 9]
};

function storyTheaterAnalysisAt(time) {
  const analysis = supportedLyricsData?.analysis;
  const energyValues = decodedOneMoreBiteEnvelope(analysis, 'energy');
  const onsetValues = decodedOneMoreBiteEnvelope(analysis, 'onsets');
  if (!analysis?.step || !energyValues.length) return { energy: 0, onset: 0 };
  const position = clamp(0, energyValues.length - 1, time / analysis.step);
  const lower = Math.floor(position);
  const upper = Math.min(energyValues.length - 1, lower + 1);
  const mix = position - lower;
  const sample = values => ((values[lower] || 0) * (1 - mix) + (values[upper] || 0) * mix) / 100;
  return {
    energy: clamp(0, 1, sample(energyValues)),
    onset: clamp(0, 1, Math.max(sample(onsetValues), (onsetValues[Math.max(0, lower - 1)] || 0) / 118))
  };
}

function storyTheaterBeatAt(time) {
  const bpm = supportedLyricsData?.bpm || 120;
  const period = 60 / bpm;
  const position = Math.max(0, (time - (supportedLyricsData?.beatOffset || 0)) / period);
  const phase = position - Math.floor(position);
  return { index: Math.floor(position), phase, pulse: Math.pow(1 - phase, 5.2) };
}

function storyInterludeText(time, data) {
  const sectionIndex = data?.sections?.findIndex(section => time >= section.start && time < section.end) ?? -1;
  const notes = STORY_INTERLUDES[storyTheaterVariant()] || STORY_INTERLUDES.waiting;
  return notes[Math.max(0, sectionIndex)] || notes[notes.length - 1];
}

function renderStoryTheaterLine(index, data, time) {
  const current = $('story-current');
  const previous = $('story-previous');
  const next = $('story-next');
  if (!current || !previous || !next) return;
  supportedLyricsWordNodes = [];
  current.replaceChildren();
  const line = index >= 0 ? data.lines[index] : null;
  if (!line) {
    const note = document.createElement('span');
    note.className = 'story-instrumental';
    note.textContent = storyInterludeText(time, data);
    current.appendChild(note);
    const nextIndex = data.lines.findIndex(item => item.start > time);
    previous.textContent = '';
    next.textContent = nextIndex >= 0 ? data.lines[nextIndex].text : '';
    return;
  }
  measuredWordTimings(line).forEach((timing, wordIndex) => {
    if (wordIndex) current.appendChild(document.createTextNode(' '));
    const span = document.createElement('span');
    span.className = 'story-word';
    span.textContent = timing.word;
    current.appendChild(span);
    supportedLyricsWordNodes.push({ ...timing, element: span });
  });
  previous.textContent = data.lines[index - 1]?.text || '';
  next.textContent = data.lines[index + 1]?.text || '';
}

function updateStoryTheaterLyrics(time = currentCalibratedTime(), force = false) {
  if (!storyTheaterSceneActive) return;
  const theater = $('story-theater');
  if (!theater) return;
  const data = supportedLyricsData;
  const duration = effectiveDuration() || data?.duration || 180;
  const pct = clamp(0, 1, time / duration);
  theater.style.setProperty('--story-progress', `${(pct * 100).toFixed(3)}%`);
  if ($('story-progress-fill')) $('story-progress-fill').style.width = `${(pct * 100).toFixed(3)}%`;
  if ($('story-time-current')) $('story-time-current').textContent = fmtTime(time);
  if ($('story-time-total')) $('story-time-total').textContent = fmtTime(duration);
  if (!data) return;

  const variant = storyTheaterVariant();
  theater.dataset.story = variant;
  if ($('story-artist')) $('story-artist').textContent = data.artist || '';
  if ($('story-title')) $('story-title').textContent = data.song || '';
  if ($('story-footer-left')) $('story-footer-left').textContent = `${Math.round(data.bpm || 0)} BPM / ${(data.key || '').toUpperCase()}`;
  if ($('story-footer-right')) $('story-footer-right').textContent = data.footer || '';

  const sectionIndex = data.sections.findIndex(section => time >= section.start && time < section.end);
  const section = data.sections[sectionIndex] || data.sections[data.sections.length - 1];
  if (force || sectionIndex !== supportedLyricsSectionIndex) {
    supportedLyricsSectionIndex = sectionIndex;
    if ($('story-section')) $('story-section').textContent = section?.name || data.song;
    if ($('story-status')) $('story-status').textContent = section?.short || 'STORY';
    if ($('story-act-number')) $('story-act-number').textContent = String(Math.max(1, sectionIndex + 1)).padStart(2, '0');
    theater.dataset.phase = String(section?.phase ?? 0);
    theater.classList.toggle('is-peak', !!STORY_PEAK_PHASES[variant]?.includes(section?.phase ?? 0));
  }

  const lineIndex = data.lines.findIndex(line => time >= line.start && time < line.end + 0.1);
  if (force || lineIndex !== supportedLyricsLineIndex) {
    supportedLyricsLineIndex = lineIndex;
    renderStoryTheaterLine(lineIndex, data, time);
  }
  supportedLyricsWordNodes.forEach(word => {
    const wordProgress = clamp(0, 1, (time - word.start) / Math.max(0.03, word.end - word.start));
    word.element.style.setProperty('--word-progress', `${(wordProgress * 100).toFixed(1)}%`);
    const isCurrent = time >= word.start && time < word.end;
    const isSung = time >= word.end;
    word.element.classList.toggle('is-current', isCurrent);
    word.element.classList.toggle('is-sung', isSung);
    word.element.classList.toggle('is-pending', !isCurrent && !isSung);
  });
}

function setStoryTheaterActive(active, song = currentSong()) {
  const nextActive = !!active && isStoryTheaterSong(song);
  const theater = $('story-theater');
  const config = nextActive ? supportedLyricTrackForSong(song) : null;
  document.body.classList.toggle('story-theater-active', nextActive);
  if (theater) theater.classList.toggle('hidden', !nextActive);
  if (storyTheaterSceneActive === nextActive && (!nextActive || supportedLyricsSongKey === config?.key)) return;
  storyTheaterSceneActive = nextActive;
  supportedLyricsLineIndex = -2;
  supportedLyricsSectionIndex = -2;
  supportedLyricsWordNodes = [];
  if (nextActive) {
    theater.dataset.story = storyTheaterVariant(song);
    loadSupportedLyrics(config);
    updateStoryTheaterLyrics(currentCalibratedTime(), true);
    drawStoryTheaterFx({ glow: 0, motion: 0, rise: 0 }, currentCalibratedTime());
    scheduleNowLayoutSync();
  }
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
  if (usesNativeAudioPath(song) && (audioSource || analyser)) {
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
  if (usesNativeAudioPath(song) && !audioSource) {
    audio.volume = playerVolume;
  } else {
    audio.volume = analyser && audioCtx?.state === 'running' ? 1 : playerVolume;
  }
  const contextReady = usesNativeAudioPath(song) && !audioSource
    ? Promise.resolve()
    : primeAudioContextForGesture();
  return Promise.resolve(audio.play()).then(async result => {
    await contextReady;
    await activateAudioGraphIfPossible();
    // Re-apply volume after graph decision
    if (usesNativeAudioPath(song) && !audioSource) audio.volume = playerVolume;
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
  if (isStoryTheaterSong(song)) {
    return tetoFxEnabled ? 'story-theater' : 'off';
  }
  if (isOneMoreBiteSong(song)) {
    return tetoFxEnabled ? 'omb' : 'off';
  }
  if (isHeroStorySong(song)) {
    return tetoFxEnabled ? 'hero-story' : 'off';
  }
  if (isEncoreDanceSong(song)) {
    return tetoFxEnabled ? 'encore-dance' : 'off';
  }
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
  updateOneMoreBiteLyrics(currentCalibratedTime(), true);
  updateHeroStoryLyrics(currentCalibratedTime(), true);
  updateEncoreDanceLyrics(currentCalibratedTime(), true);
  updateStoryTheaterLyrics(currentCalibratedTime(), true);
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
  document.body.classList.toggle('omb-fx-active', theme === 'omb');
  document.body.classList.toggle('hero-story-fx-active', theme === 'hero-story');
  document.body.classList.toggle('encore-fx-active', theme === 'encore-dance');
  document.body.classList.toggle('story-theater-fx-active', theme === 'story-theater');
  document.body.style.setProperty('--fx-level', level.toFixed(3));
  document.body.style.setProperty('--teto-level', level.toFixed(3));
  document.body.style.setProperty('--disco-level', level.toFixed(3));
  document.body.style.setProperty('--teto11-level', level.toFixed(3));
  document.body.style.setProperty('--ddlc-level', level.toFixed(3));
  document.body.style.setProperty('--omb-level', level.toFixed(3));
  document.body.style.setProperty('--hero-story-level', level.toFixed(3));
  document.body.style.setProperty('--encore-level', level.toFixed(3));
  document.body.style.setProperty('--story-level', level.toFixed(3));
  if (theme === 'story-theater') {
    setOneMoreBiteTheaterActive(false);
    setHeroStoryTheaterActive(false);
    setEncoreTheaterActive(false);
    setStoryTheaterActive(true);
  } else if (theme === 'omb') {
    setStoryTheaterActive(false);
    setHeroStoryTheaterActive(false);
    setEncoreTheaterActive(false);
    setOneMoreBiteTheaterActive(true);
  } else if (theme === 'hero-story') {
    setStoryTheaterActive(false);
    setOneMoreBiteTheaterActive(false);
    setEncoreTheaterActive(false);
    setHeroStoryTheaterActive(true);
  } else if (theme === 'encore-dance') {
    setStoryTheaterActive(false);
    setOneMoreBiteTheaterActive(false);
    setHeroStoryTheaterActive(false);
    setEncoreTheaterActive(true);
  } else {
    setStoryTheaterActive(false);
    setOneMoreBiteTheaterActive(false);
    setHeroStoryTheaterActive(false);
    setEncoreTheaterActive(false);
  }
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
    const metadata = SONG_METADATA_OVERRIDES[path] || p;
    return {
      id: path,
      name: i.name,
      path,
      url: `./${encodePath(path)}`,
      collection: collection.id,
      collectionLabel: collection.label,
      displayName: metadata.display || `${metadata.artist} — ${metadata.title}`,
      artist: metadata.artist,
      title: metadata.title,
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
  const queuedRefs = queue.map(index => songRef(library[index])).filter(Boolean);
  const activeRef = songRef(currentSong());
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
  if (queuedRefs.length) {
    queue = queuedRefs.map(findSongIndex).filter(index => index >= 0);
    const activeLibraryIndex = findSongIndex(activeRef);
    const remappedQueueIndex = queue.indexOf(activeLibraryIndex);
    queueIndex = remappedQueueIndex >= 0 ? remappedQueueIndex : Math.min(queueIndex, queue.length - 1);
  }
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
  if (queueIndex < 0 || queueIndex >= queue.length) {
    showToast('!', 'Queue position is no longer available.');
    return;
  }
  const libIdx = queue[queueIndex];
  const song = library[libIdx];
  if (!song) {
    showToast('!', 'This queued song is missing from the library.');
    return;
  }
  clearTimeout(playbackRetryTimer);
  playbackAttemptSerial++;
  playbackRetryCount = 0;
  // Spatial HQ: if a prior song attached Web Audio, rebuild <audio> for true native stereo
  const recreatedNative = ensureNativeRoutingForSpatialSong(song);
  const targetSrc = new URL(song.url, window.location.href).href;
  const sameSource = !recreatedNative && sameMediaUrl(audio.currentSrc || audio.src, targetSrc);
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
  renderEqualizerUi(song);
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
  renderEqualizerUi(song);
}

function matchingEqPreset(profile) {
  const entries = Object.entries(EQ_PRESETS);
  const match = entries.find(([, preset]) => (
    Math.abs(profile.preamp - preset.preamp) < 0.01 &&
    profile.gains.every((gain, index) => Math.abs(gain - preset.gains[index]) < 0.01)
  ));
  return match?.[0] || 'custom';
}

function buildEqualizerBands() {
  const container = $('eq-bands');
  if (!container || container.children.length) return;
  const controls = [{ label: 'Preamp', detail: 'Output headroom', key: 'preamp' }]
    .concat(EQ_BANDS.map((band, index) => ({ ...band, key: String(index) })));
  controls.forEach(control => {
    const row = document.createElement('label');
    row.className = 'eq-band';
    row.innerHTML = `
      <span class="eq-band-label"><strong></strong><small></small></span>
      <input type="range" min="-12" max="12" step="0.5" value="0">
      <output>0.0 dB</output>
    `;
    row.dataset.eqKey = control.key;
    row.querySelector('strong').textContent = control.label;
    row.querySelector('small').textContent = control.detail;
    row.querySelector('input').addEventListener('input', event => {
      updateEditableEqProfile(profile => {
        const value = clampEqDb(event.target.value);
        profile.enabled = true;
        if (control.key === 'preamp') profile.preamp = value;
        else profile.gains[Number(control.key)] = value;
      });
    });
    container.appendChild(row);
  });
}

function renderEqualizerUi(song = currentSong()) {
  buildEqualizerBands();
  const panel = $('equalizer-panel');
  if (!panel) return;
  const unavailable = eqEditMode === 'song' && !song;
  const profile = editableEqProfile();
  panel.classList.toggle('eq-unavailable', unavailable);
  panel.querySelectorAll('[data-eq-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.eqMode === eqEditMode);
  });
  $('equalizer-context').textContent = eqEditMode === 'global'
    ? 'Temporary sound profile for every song'
    : song ? (song.title || song.displayName) : 'Choose a song to create its saved sound profile.';
  $('equalizer-notice').textContent = eqEditMode === 'global'
    ? 'Overrides saved song profiles until vp is reloaded. It is never saved.'
    : "This song's settings save automatically.";
  $('eq-save-status').textContent = eqEditMode === 'global' ? 'Temporary session setting' : 'Saved automatically';
  $('eq-enabled').checked = profile.enabled;
  $('eq-preset').value = matchingEqPreset(profile);
  panel.querySelectorAll('.eq-band').forEach(row => {
    const key = row.dataset.eqKey;
    const value = key === 'preamp' ? profile.preamp : profile.gains[Number(key)];
    row.querySelector('input').value = value;
    row.querySelector('output').textContent = formatEqDb(value);
  });
  const effective = effectiveEqProfile(song);
  const summary = $('equalizer-summary');
  if (summary) {
    summary.textContent = isEqAudiblyActive(song)
      ? (temporaryGlobalEq.enabled ? 'Temporary' : (matchingEqPreset(effective) === 'custom' ? 'Custom' : matchingEqPreset(effective)))
      : 'Flat';
  }
}

function refreshEqualizerRouting(previousNativePath) {
  const song = currentSong();
  if (!song || !audio.src) return;
  const nextNativePath = usesNativeAudioPath(song);
  const wasPlaying = !audio.paused;
  if (previousNativePath !== nextNativePath && nextNativePath) {
    recreateAudioElementForNativePath();
    if (wasPlaying) resumeAudioFromCalibratedClock(song).catch(err => console.warn('EQ routing failed:', err));
    return;
  }
  if (previousNativePath !== nextNativePath && !nextNativePath) {
    primeAudioContextForGesture()
      .then(() => activateAudioGraphIfPossible())
      .then(() => applyEqualizerToGraph(song))
      .catch(err => rememberAudioGraphError(err));
    return;
  }
  applyEqualizerToGraph(song);
}

function updateEditableEqProfile(mutator) {
  if (eqEditMode === 'song' && !currentSong()) return;
  const previousNativePath = usesNativeAudioPath();
  const profile = editableEqProfile();
  mutator(profile);
  persistEditableEqProfile(profile);
  renderEqualizerUi();
  refreshEqualizerRouting(previousNativePath);
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
  // Female-Dominant Rectangle — experimental 4-source spatial (same theater/native path)
  if (hay.includes('female-dominant') || hay.includes('female dominant') || hay.includes('female_dom')) {
    return true;
  }
  return hay.includes('traveling voices')
    || hay.includes('travelling voices')
    || hay.includes('ddf travel')
    || hay.includes('ddf_travel')
    || hay.includes('jumpy');
}

function isFemaleDomRectangleSong(song = currentSong()) {
  if (!song) return false;
  const hay = `${song.name || ''} ${song.title || ''} ${song.displayName || ''} ${song.path || ''}`.toLowerCase();
  return hay.includes('female-dominant') || hay.includes('female dominant') || hay.includes('female_dom');
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
  // Experimental 4-source fixed rectangle (♀ L/R + ♂ F/B)
  if (isFemaleDomRectangleSong(song)) return 'female_dom_rectangle';
  // Slow Glide + SADIE/CIPIC A/B cuts share the long-whoosh compass map
  if (/slow\s*glide/i.test(hay) || /whoosh/i.test(hay) || /v7_glide/i.test(hay) || /sadie\s*(d1|h3)/i.test(hay) || /cipic/i.test(hay)) {
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
    ? { ...data }
    : {
        keyframes: data?.keyframes || SPATIAL_MAP_EMBEDDED.keyframes,
        transitionSec: data?.transition_sec || data?.transitionSec || 1.15,
      };
  if (!map.transitionSec && data?.transition_sec) map.transitionSec = data.transition_sec;
  if (!map.keyframes && data?.keyframes) map.keyframes = data.keyframes;
  // Preserve multi-source rectangle architecture (4 fixed corners)
  if (data?.sources) map.sources = data.sources;
  if (data?.architecture) map.architecture = data.architecture;
  if (data?.static) map.static = data.static;
  if (data?.readout) map.readout = data.readout;
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
  fetchSpatialSlug('female_dom_rectangle');
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
  // "How can I convey…" is Yuri; vow return is Monika (user correction — was wrongly lumped as Yuri)
  [127.67, 135.49, 'theme-yuri', 'How can I convey · Yuri'],
  [135.49, 139.50, 'theme-monika', 'Together forever · Monika'],
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
  // Lofi stretch of 127.67–135.49 (Yuri) then 135.49–139.50 (Monika vow — user correction)
  [190.70, 202.34, 'theme-yuri', 'How can I convey · Yuri'],
  [202.34, 208.32, 'theme-monika', 'Together forever · Monika'],
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
  if (slug === 'female_dom_rectangle') {
    return compact ? '♀ dom · rectangle' : 'Female-Dominant Rectangle (♀ L/R · ♂ F/B)';
  }
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

function drawSpatialRadar(pose, map = spatialMapCache) {
  const ctx = ensureSpatialRadar();
  if (!ctx || !pose) return;
  const size = ctx.canvas.width || 64;
  const theater = size >= 200;
  const cx = size / 2;
  const cy = size / 2;
  // Theater: fill most of the circular frame (CSS frame + canvas are the same circle)
  // Dock: compact 64px radar
  const r = theater ? size * 0.40 : 20;

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

  function xyFor(az, el) {
    const rad = (az * Math.PI) / 180;
    const rear = 0.5 * (1 - Math.cos(rad));
    const ring = r * (0.42 + rear * 0.42 + Math.min(0.14, Math.abs(el) * 0.1));
    return {
      x: cx + Math.sin(rad) * ring,
      y: cy - Math.cos(rad) * ring,
      rear,
      s: (theater ? 7 : 2.8) + Math.max(0, el) * (theater ? 3 : 1.5) + (el < 0 ? Math.abs(el) * 0.35 : 0),
    };
  }

  function plot(az, el, color, letter = null) {
    const { x, y, rear, s } = xyFor(az, el);
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
      const ch = letter || (color === '#ff7eb6' ? 'F' : 'M');
      ctx.fillText(ch, x, y + 0.5);
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
    return { x, y };
  }

  // Multi-source rectangle architecture (♀ L/R + ♂ F/B) — draw all corners + edges
  const sources = map?.sources;
  if (sources && sources.length >= 2) {
    const pts = sources.map(s => {
      const color = s.role === 'female' ? '#ff7eb6' : '#5eead4';
      const letter = s.role === 'female' ? 'F' : 'M';
      const p = plot(s.az, s.el ?? 0, color, letter);
      return { ...p, role: s.role, id: s.id };
    });
    // Faint rectangle edges (F1–M1–F2–M2–F1) when we have the classic 4 corners
    if (pts.length >= 4 && theater) {
      const byId = Object.fromEntries(pts.map(p => [p.id, p]));
      const order = ['F1', 'M1', 'F2', 'M2', 'F1'];
      if (order.every((id, i) => i === order.length - 1 || byId[id])) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        order.forEach((id, i) => {
          const p = byId[id];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    return;
  }

  // Legacy dual-lead: female at pose, male opposite
  plot(pose.az, pose.el, '#ff7eb6', 'F');
  plot(normalizeAz(pose.az + 180), -pose.el, '#5eead4', 'M');
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
  // Static multi-source maps (rectangle) only need a forced/first paint
  const isStaticRect = !!(spatialMapCache?.static || spatialMapCache?.sources?.length);
  const azQ = isStaticRect ? 0 : Math.round(pose.az / 4) * 4;
  const elQ = isStaticRect ? 0 : Math.round(pose.el * 5) / 5;
  if (force || spatialLastUi.az !== azQ || spatialLastUi.el !== elQ) {
    spatialLastUi.az = azQ;
    spatialLastUi.el = elQ;
    drawSpatialRadar(pose, spatialMapCache);
  }

  let fDir;
  let mDir;
  if (spatialMapCache?.sources?.length) {
    // Rectangle readout: dual female L/R + dual male F/B (not "opposite pair")
    const fs = spatialMapCache.sources.filter(s => s.role === 'female');
    const ms = spatialMapCache.sources.filter(s => s.role === 'male');
    fDir = fs.length
      ? fs.map(s => describeDirection(s.az, s.el ?? 0)).join(' · ')
      : 'dual lead';
    mDir = ms.length
      ? ms.map(s => describeDirection(s.az, s.el ?? 0)).join(' · ')
      : 'dual support';
  } else {
    const mAz = normalizeAz(pose.az + 180);
    const mEl = -pose.el;
    fDir = describeDirection(pose.az, pose.el);
    mDir = describeDirection(mAz, mEl);
  }
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
  // Rings + bloom MUST sit on the Audio Compass, not a guessed canvas midpoint
  const compass = getCompassFxAnchor(canvas);
  const cx = compass?.cx ?? w * 0.5;
  const cy = compass?.cy ?? h * 0.42;
  const ringBase = compass?.radius ?? Math.min(w, h) * 0.12;
  const scale = Math.max(1, Math.min(w, h) / 700);
  const maxDim = Math.max(w, h);
  const minDim = Math.min(w, h);
  // Travel distance: leave the compass rim and expand into the stage
  const ringTravel = Math.max(ringBase * 1.8, minDim * 0.38);

  // Base fill
  ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
  ctx.fillRect(0, 0, w, h);

  // One radial wash (not per-particle) — centered on compass
  const field = ctx.createRadialGradient(
    cx + Math.sin(t * 0.4) * w * 0.04,
    cy + Math.cos(t * 0.35) * h * 0.03,
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

  // Beat rings — start at compass rim and expand outward (aligned with Audio Compass)
  for (let r = 0; r < 5; r++) {
    const life = (beat * 0.85 + r * 0.18 + heartWave * 0.08) % 1;
    const rad = ringBase * 0.98 + ringTravel * life * (0.95 + chorus * 0.25);
    const alpha = (1 - life) * (0.22 + energy * 0.24 + beat * 0.22);
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

  // Girl overlays (kept, cheaper where possible) — orbit the compass, not canvas center
  if (girl === 'sayori') {
    for (let k = 0; k < 2; k++) {
      const phase = (heartWave + k * 0.18) % 1;
      ctx.strokeStyle = `rgba(${p[0]},${p[1]},${p[2]},${(1 - phase) * 0.35})`;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, ringBase * (1.05 + phase * 1.55), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (girl === 'natsuki') {
    if (beat > 0.35) {
      ctx.fillStyle = `rgba(${s[0]},${s[1]},${s[2]},${beat * 0.16})`;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2 + t * 0.8;
      const dist = ringBase * (1.05 + beat * 0.55 + (i % 5) * 0.08);
      const col = i & 1 ? p : a;
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.28 + beat * 0.4})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, (4 + (i % 4)) * scale, 0, Math.PI * 2);
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

  // Core bloom — same compass center as rings
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringBase * (1.15 + energy * 0.85));
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
  // SADIE / CIPIC A/B Slow Glide variants (same phrase leads; separate ids for metadata)
  if (/sadie\s*d1/i.test(hay)) return 'v7_phrase_word_lead_glide_sadie_d1';
  if (/sadie\s*h3/i.test(hay)) return 'v7_phrase_word_lead_glide_sadie_h3';
  if (/cipic\s*0*50/i.test(hay) && /quiet\s*inst/i.test(hay)) {
    return 'v7_phrase_word_lead_glide_cipic_050_inst075';
  }
  if (/cipic\s*0*50/i.test(hay)) return 'v7_phrase_word_lead_glide_cipic_050';
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
  updateOneMoreBiteLyrics(current);
  updateHeroStoryLyrics(current);
  updateEncoreDanceLyrics(current);
  updateStoryTheaterLyrics(current);
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
    applyEqualizerToGraph();
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
    eqPreampNode = ctx.createGain();
    eqFilterNodes = EQ_BANDS.map(band => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      if (band.q) filter.Q.value = band.q;
      filter.gain.value = 0;
      return filter;
    });
    waveData = new Float32Array(analyser.frequencyBinCount);
    waveTimeData = new Uint8Array(analyser.fftSize);
    // Preserve stereo: source -> preamp -> filters -> volume -> speakers.
    audioSource.connect(eqPreampNode);
    let eqTail = eqPreampNode;
    eqFilterNodes.forEach(filter => {
      eqTail.connect(filter);
      eqTail = filter;
    });
    eqTail.connect(outputGain);
    audioSource.connect(analyser);
    outputGain.connect(ctx.destination);
    // analyser is sink-only (no connection to destination) so it cannot color the mix
    audio.volume = 1;
    applyEqualizerToGraph();
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
  try { eqPreampNode?.disconnect(); } catch (_) {}
  eqFilterNodes.forEach(filter => { try { filter.disconnect(); } catch (_) {} });
  try { outputGain?.disconnect(); } catch (_) {}
  try { analyser?.disconnect(); } catch (_) {}
  audioSource = null;
  analyser = null;
  eqPreampNode = null;
  eqFilterNodes = [];
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
  if (!usesNativeAudioPath(song)) return false;
  if (!audioSource && !analyser) return false;
  return recreateAudioElementForNativePath();
}

async function activateAudioGraphIfPossible() {
  // Traveling Voices: stay on native <audio> path so levels/stereo match QuickTime.
  // (Web Audio MediaElementSource + sample-rate conversion was coloring the mix.)
  if (usesNativeAudioPath()) {
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
    applyEqualizerToGraph();
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

/**
 * Map a laid-out DOM element into canvas pixel space.
 * Rings must start at the visual edge of the play button / Audio Compass, not the canvas midpoint.
 */
function fxAnchorFromDom(canvas, el, { outerPadCss = 0 } = {}) {
  if (!canvas || !el) return null;
  const fxRect = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (fxRect.width < 2 || fxRect.height < 2 || r.width < 2 || r.height < 2) return null;
  const sx = canvas.width / fxRect.width;
  const sy = canvas.height / fxRect.height;
  // Uniform scale keeps circles round when canvas DPR aspect ≠ CSS aspect
  const s = Math.min(sx, sy);
  const cx = (r.left - fxRect.left + r.width / 2) * sx;
  const cy = (r.top - fxRect.top + r.height / 2) * sy;
  const halfCss = Math.max(r.width, r.height) / 2 + outerPadCss;
  return { cx, cy, radius: halfCss * s, sx, sy, s };
}

/** Hero play button + CSS progress ring (::before inset −8px). */
function getHeroFxAnchor(canvas) {
  return fxAnchorFromDom(canvas, $('hero-play'), { outerPadCss: 8 });
}

/** Large Audio Compass frame (theater) — rings expand from its rim. */
function getCompassFxAnchor(canvas) {
  const el = document.querySelector('.ddf-compass-frame') || $('ddf-compass');
  return fxAnchorFromDom(canvas, el, { outerPadCss: 2 });
}

// Lightweight outbound beat rings (stroke only — radial fillRect was the lag source).
function emitOutboundRingPulse(theme, now, cx, cy, baseRadius, travelRadius, palette, power, lineWidth, life) {
  const color = palette[Math.floor(seededUnit(now * 1000 + theme.length * 17) * palette.length)] || palette[0];
  fxRingPulses.push({
    theme,
    born: now,
    cx,
    cy,
    baseRadius,
    travelRadius,
    color,
    power,
    lineWidth,
    life,
  });
  if (fxRingPulses.length > 14) fxRingPulses.splice(0, fxRingPulses.length - 14);
}

function drawOutboundPulseRings(ctx, options) {
  if (!ctx || !options) {
    if (fxRingPulses.length) fxRingPulses.length = 0;
    return;
  }
  const {
    theme,
    cx,
    cy,
    levels,
    profile,
    fxTime,
    sectionPower,
    chorusPower,
    beatPulse,
    palette,
    baseRadius,
    travelRadius,
    alphaBase,
    lineWidth,
    life = 0.72,
  } = options;
  const now = performance.now() / 1000;
  const audible = !!(audio.src && !audio.paused && (levels?.motion ?? 0) > 0.03);
  const eventPower = clamp(
    0,
    1,
    (levels?.glow ?? 0) * 0.4
      + (levels?.motion ?? 0) * 0.22
      + (beatPulse || 0) * (0.4 + (chorusPower || 0) * 0.32)
      + (chorusPower || 0) * 0.16
  );

  if (audible && eventPower > 0.1) {
    let shouldEmit = false;
    if (profile?.bpm && Number.isFinite(fxTime)) {
      const beats = Math.max(0, (fxTime - (profile.beatOffset || 0)) * profile.bpm / 60);
      const beatIndex = Math.floor(beats);
      const song = currentSong();
      const beatKey = `${song?.path || song?.name || 'song'}:${theme}:${beatIndex}`;
      if (beatPulse > 0.26 && beatKey !== lastFxRingBeatKey) {
        lastFxRingBeatKey = beatKey;
        shouldEmit = true;
      }
    } else if (typeof tetoRiseEnergy === 'number' && tetoRiseEnergy > 0.42 && now - lastFxRingFallbackAt > 0.36) {
      lastFxRingFallbackAt = now;
      shouldEmit = true;
    }
    if (shouldEmit) {
      emitOutboundRingPulse(
        theme,
        now,
        cx,
        cy,
        baseRadius,
        travelRadius * (0.82 + (sectionPower || 0) * 0.18),
        palette,
        eventPower,
        lineWidth,
        life
      );
    }
  }

  // Drop finished pulses; draw active ones as simple strokes from the anchor
  let write = 0;
  for (let i = 0; i < fxRingPulses.length; i++) {
    const pulse = fxRingPulses[i];
    const age = (now - pulse.born) / pulse.life;
    if (age < 0 || age > 1) continue;
    fxRingPulses[write++] = pulse;
    if (pulse.theme !== theme) continue;
    const progress = easeOutCubic(age);
    const radius = pulse.baseRadius + pulse.travelRadius * progress;
    const fade = Math.pow(1 - age, 1.65);
    const alpha = fade * pulse.power * alphaBase;
    if (alpha <= 0.004) continue;
    ctx.beginPath();
    ctx.arc(pulse.cx, pulse.cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = rgbaColor(pulse.color, alpha);
    ctx.lineWidth = Math.max(1, pulse.lineWidth * (0.9 + fade * 0.2));
    ctx.stroke();
  }
  fxRingPulses.length = write;
}

function drawDiscoFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, baseRadius = null) {
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
  const ringBase = baseRadius ?? Math.min(w, h) * (0.11 + pulseLevel * 0.015);
  const ringTravel = Math.max(ringBase * 1.6, Math.min(w, h) * (0.28 + pulseLevel * 0.1 + chorusBoost * 0.1));
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
    baseRadius: ringBase,
    travelRadius: ringTravel,
    alphaBase: 0.18 + chorusBoost * 0.09,
    lineWidth: (1.05 + pulseLevel * 2.4) * scale,
    life: 0.62,
  });

  const ballRadius = Math.min(ringBase * 0.42, Math.min(w, h) * (0.045 + pulseLevel * 0.018));
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

function drawTeto11Fx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, protectedPoint = () => false, baseRadius = null) {
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

  const ringBase = baseRadius ?? Math.min(w, h) * (0.11 + alive * 0.015);
  const ringTravel = Math.max(ringBase * 1.6, Math.min(w, h) * (0.28 + alive * 0.1 + chorusBoost * 0.1));
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
    baseRadius: ringBase,
    travelRadius: ringTravel,
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
 * Rings / bloom center on the hero play button (cx/cy/baseRadius from drawTetoFx).
 * Visual only; does not touch the spatial audio graph.
 */
function drawDdlcFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, baseRadius = null) {
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
  // Anchor radius = hero progress ring; travel outward so rings hug the play button
  const ringBase = baseRadius ?? Math.min(w, h) * 0.1;
  const ringTravel = Math.max(ringBase * 1.7, Math.min(w, h) * 0.28);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Soft character color stage wash
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${(0.014 + alive * 0.09 + chorusLift * 0.05) * glowDim})`);
  wash.addColorStop(0.45, `rgba(${s[0]}, ${s[1]}, ${s[2]}, ${(0.01 + alive * 0.07 + chorusLift * 0.04) * glowDim})`);
  wash.addColorStop(1, `rgba(${a[0]}, ${a[1]}, ${a[2]}, ${(0.008 + alive * 0.05) * glowDim})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // Center bloom (heartbeat) — true play-button center (was cy*0.92, which floated above)
  const heartPulse = 0.55 + bpmPulse * 0.55 + Math.sin(t * (profile?.bpm ? profile.bpm / 60 : 2.75) * Math.PI * 2) * 0.08;
  const coreR = ringBase * (1.6 + alive * 1.1 + bpmPulse * 0.35);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
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

  // Beat rings — expand from the play button rim (same center as hero-play)
  if (bpmPulse > 0.08 || chorusBoost > 0.15) {
    const ringCount = 3;
    for (let r = 0; r < ringCount; r++) {
      const life = (bpmPulse + r * 0.22) % 1;
      const rad = ringBase * 0.98 + ringTravel * life * (0.95 + chorusBoost * 0.2);
      const alpha = (1 - life) * (0.12 + chorusBoost * 0.1 + bpmPulse * 0.12) * alive;
      if (alpha < 0.01) continue;
      const col = r % 2 ? s : p;
      ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${alpha})`;
      ctx.lineWidth = (1.2 + (1 - life) * 2.4) * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Shared beat-spawned rings (lightweight strokes) for Lofi / non-theater DDF
  drawOutboundPulseRings(ctx, {
    theme: 'ddlc',
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
    palette: [p, s, a],
    baseRadius: ringBase,
    travelRadius: ringTravel * (0.9 + chorusBoost * 0.25),
    alphaBase: 0.22 + chorusBoost * 0.1,
    lineWidth: (1.15 + bpmPulse * 2.2) * scale,
    life: profile?.lofi ? 0.82 : 0.7,
  });

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

  // Sayori: extra soft heart ring on strong beats — same play-button center
  if (girl === 'sayori' && bpmPulse > 0.35) {
    ctx.strokeStyle = `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${0.08 + bpmPulse * 0.12})`;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, ringBase * (1.15 + bpmPulse * 0.35), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawOneMoreBiteFx(levels, time) {
  const canvas = $('omb-fx');
  const theater = $('omb-theater');
  if (!canvas || !theater || !oneMoreBiteSceneActive) return;
  const rect = theater.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = Math.min(1.25, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(240, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, width, height);
  const section = supportedLyricsData?.sections?.find(item => time >= item.start && time < item.end);
  const chorus = section?.short?.includes('CHORUS') ? 1 : 0;
  const recorded = oneMoreBiteAnalysisAt(time);
  const glow = clamp(0, 1, Math.max(
    (levels.glow || 0) * 0.72,
    recorded.energy * (0.58 + chorus * 0.28)
  ));
  const motion = clamp(0, 1, Math.max(
    (levels.motion || 0) * 0.7,
    recorded.onset * (0.72 + chorus * 0.25),
    recorded.energy * (0.22 + chorus * 0.22)
  ));
  const beats = oneMoreBiteBeatsAt(time, chorus);
  const backgroundMotion = beats.reduce((motionState, beat) => {
    const arc = Math.sin(beat.progress * Math.PI) * beat.impact;
    motionState.x += beat.direction.x * arc;
    motionState.y += beat.direction.y * arc;
    motionState.power += arc;
    return motionState;
  }, { x: 0, y: 0, power: 0 });
  const motionLength = Math.hypot(backgroundMotion.x, backgroundMotion.y) || 1;
  const trailDirection = {
    x: backgroundMotion.x / motionLength,
    y: backgroundMotion.y / motionLength
  };
  const trailPower = clamp(0, 1, backgroundMotion.power * 0.58);
  theater.style.setProperty('--omb-level', glow.toFixed(3));
  theater.style.setProperty('--omb-energy', recorded.energy.toFixed(3));
  theater.style.setProperty('--omb-onset', recorded.onset.toFixed(3));
  theater.style.setProperty('--omb-parallax-x', `${(backgroundMotion.x * (chorus ? 13 : 4)).toFixed(2)}px`);
  theater.style.setProperty('--omb-parallax-y', `${(backgroundMotion.y * (chorus ? 9 : 3)).toFixed(2)}px`);

  const travel = time;
  const colors = ['#df2a92', '#263bb8', '#75d9ef'];
  const playRect = $('omb-play')?.getBoundingClientRect();
  const centerX = playRect ? (playRect.left + playRect.width / 2 - rect.left) * dpr : width * 0.78;
  const centerY = playRect ? (playRect.top + playRect.height / 2 - rect.top) * dpr : height * 0.5;

  ctx.save();

  // Each onset owns its full animation lifetime. New beats add another wave
  // instead of replacing the one already crossing the stage.
  beats.forEach(beat => {
    const progress = clamp(0, 1, beat.age / beat.duration);
    const waveLife = Math.sin(progress * Math.PI) * beat.impact;
    const horizontal = beat.direction.x !== 0;
    const span = (horizontal ? width : height) * (0.24 + beat.strength * 0.16);
    const distance = (horizontal ? width : height) + span * 2;
    const easedProgress = progress * progress * (3 - 2 * progress);
    const axisPosition = beat.direction.x + beat.direction.y > 0
      ? -span + distance * easedProgress
      : (horizontal ? width : height) + span - distance * easedProgress;
    const gradient = horizontal
      ? ctx.createLinearGradient(axisPosition - span, 0, axisPosition + span, 0)
      : ctx.createLinearGradient(0, axisPosition - span, 0, axisPosition + span);
    gradient.addColorStop(0, 'rgba(190, 220, 255, 0)');
    gradient.addColorStop(0.34, `rgba(117, 217, 239, ${waveLife * (chorus ? 0.22 : 0.05)})`);
    gradient.addColorStop(0.52, `rgba(255, 79, 174, ${waveLife * (chorus ? 0.27 : 0.065)})`);
    gradient.addColorStop(0.7, `rgba(38, 59, 184, ${waveLife * (chorus ? 0.14 : 0.035)})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.filter = `blur(${dpr * (8 + waveLife * 12)}px)`;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    const sweepCount = chorus ? 5 : 1;
    for (let sweep = 0; sweep < sweepCount; sweep++) {
      const separation = dpr * (sweep - (sweepCount - 1) / 2) * 22;
      const linePosition = axisPosition + separation;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(linePosition, -height * 0.12);
        ctx.quadraticCurveTo(linePosition + beat.direction.x * width * 0.08, height * 0.5, linePosition, height * 1.12);
      } else {
        ctx.moveTo(-width * 0.12, linePosition);
        ctx.quadraticCurveTo(width * 0.5, linePosition + beat.direction.y * height * 0.08, width * 1.12, linePosition);
      }
      ctx.strokeStyle = colors[(sweep + beat.ordinal) % colors.length];
      ctx.globalAlpha = waveLife * (0.16 + sweep * 0.022) * (chorus ? 1 : 0.32);
      ctx.lineWidth = dpr * (3 + beat.strength * 7);
      ctx.stroke();
    }

    // A pulse begins behind the play control and expands past the viewport.
    // Staggered rings create depth while overlapping pulses remain independent.
    const maxRadius = Math.hypot(width, height) * 0.72;
    const startRadius = (playRect?.width || 82) * dpr * 0.68;
    const ringCount = chorus ? 4 : 2;
    for (let ring = 0; ring < ringCount; ring++) {
      const ringDelay = ring * 0.055;
      const ringProgress = clamp(0, 1, (progress - ringDelay) / Math.max(0.01, 1 - ringDelay));
      if (ringProgress <= 0 || ringProgress >= 1) continue;
      const radius = startRadius + maxRadius * (1 - (1 - ringProgress) ** 2);
      const ringLife = Math.sin(ringProgress * Math.PI) * beat.impact;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = colors[(beat.ordinal + ring) % colors.length];
      ctx.globalAlpha = ringLife * (chorus ? 0.31 : 0.08) * (1 - ring * 0.1);
      ctx.lineWidth = dpr * (2.2 + beat.strength * 4.6 - ring * 0.28);
      ctx.stroke();
    }
  });

  // Long icing paths move together as one graphic layer, not as rotating beams.
  ctx.lineCap = 'round';
  const laneCount = chorus ? 5 : 3;
  for (let lane = 0; lane < laneCount; lane++) {
    const baseY = height * (0.2 + lane * (0.6 / Math.max(1, laneCount - 1)));
    const phase = travel * (0.18 + chorus * 0.25 + lane * 0.025) + lane * 1.7;
    const amplitude = height * (0.01 + recorded.energy * 0.018 + chorus * 0.018 + recorded.onset * 0.012);
    ctx.beginPath();
    ctx.moveTo(-width * 0.08, baseY + Math.sin(phase) * amplitude);
    for (let pathStep = 1; pathStep <= 10; pathStep++) {
      const x = width * (pathStep / 9.2);
      const y = baseY + Math.sin(phase + pathStep * (0.74 + recorded.onset * 0.1)) * amplitude;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colors[lane % colors.length];
    ctx.globalAlpha = 0.06 + recorded.energy * 0.12 + chorus * 0.08 + recorded.onset * 0.05;
    ctx.lineWidth = dpr * (1.8 + (lane % 3) * 0.55 + glow * 2.4);
    ctx.stroke();
  }

  const crumbAlpha = 0.1 + motion * 0.36 + chorus * 0.16;
  ONE_MORE_BITE_CRUMBS.forEach((crumb, index) => {
    const drift = Math.sin(travel * (0.5 + chorus * 0.24) + crumb.phase) * height * (0.003 + motion * 0.014);
    const nudge = Math.cos(travel * (0.32 + chorus * 0.16) + crumb.phase) * width * motion * 0.006;
    const x = crumb.x * width + nudge;
    const y = crumb.y * height + drift;
    const size = crumb.size * dpr * (0.76 + glow * 0.42 + recorded.onset * 0.2);
    ctx.globalAlpha = crumbAlpha * (0.55 + seededUnit(index * 11.7) * 0.45);
    ctx.fillStyle = colors[crumb.color];
    if (index % 4 === 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(crumb.phase + travel * 0.08);
      ctx.fillRect(-size * 0.7, -size * 0.7, size * 1.4, size * 1.4);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Flowing sprinkles cross the stage primarily during choruses. Their speed is
  // continuous, while their visibility follows the measured recording energy.
  const sprinkleCount = chorus ? 34 : 10;
  for (let index = 0; index < sprinkleCount; index++) {
    const seed = seededUnit((index + 1) * 27.17);
    const speed = 0.035 + seededUnit((index + 1) * 44.81) * 0.035 + chorus * 0.035;
    const xRatio = ((seed + travel * speed) % 1.18) - 0.09;
    const lane = index % 5;
    const y = height * (0.18 + lane * 0.15) + Math.sin(travel * 0.9 + index) * height * 0.018;
    const x = xRatio * width;
    const length = dpr * (5 + seededUnit(index * 18.3) * 11 + recorded.onset * 7);
    const rotation = -0.65 + Math.sin(index * 2.4 + travel * 0.35) * 0.45;
    const trailCount = chorus && trailPower > 0.08 ? 3 : 1;
    for (let trail = trailCount - 1; trail >= 0; trail--) {
      ctx.save();
      const trailDistance = trail * dpr * (8 + trailPower * 16);
      ctx.translate(x - trailDirection.x * trailDistance, y - trailDirection.y * trailDistance);
      ctx.rotate(rotation);
      const baseAlpha = (0.025 + recorded.energy * 0.08 + chorus * 0.22) * (0.65 + recorded.onset * 0.35);
      ctx.globalAlpha = baseAlpha * (trail ? trailPower * (0.34 / trail) : 1);
      ctx.strokeStyle = colors[(index + trail) % colors.length];
      ctx.lineWidth = dpr * (1.4 + (index % 3) * 0.55);
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Spectral-flux peaks launch short sprinkle bursts from the bitten plate.
  // Looking backward in the fixed envelope makes each burst persist briefly
  // without maintaining a separate animation clock or drifting while paused.
  const analysis = supportedLyricsData?.analysis;
  const onsetEnvelope = decodedOneMoreBiteEnvelope(analysis, 'onsets');
  if (analysis?.step && onsetEnvelope.length) {
    const exactIndex = time / analysis.step;
    const envelopeIndex = Math.floor(exactIndex);
    for (let offset = 0; offset <= 6; offset++) {
      const strength = (onsetEnvelope[Math.max(0, envelopeIndex - offset)] || 0) / 100;
      if (strength < (chorus ? 0.62 : 0.88)) continue;
      const age = (exactIndex - (envelopeIndex - offset)) * analysis.step;
      const life = clamp(0, 1, 1 - age / 0.72);
      const rayCount = chorus ? 9 : 5;
      for (let ray = 0; ray < rayCount; ray++) {
        const angle = seededUnit((envelopeIndex - offset + 1) * 31.7 + ray * 8.13) * Math.PI * 2;
        const distance = dpr * (46 + age * (170 + chorus * 110) + ray * 2.5);
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const length = dpr * (5 + strength * 10);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = life * strength * (chorus ? 0.62 : 0.18);
        ctx.fillStyle = colors[(ray + offset) % colors.length];
        ctx.fillRect(-length / 2, -dpr, length, dpr * 2);
        ctx.restore();
      }
    }
  }

  // Louder passages fill the page with color without strobing or resizing controls.
  const wash = ctx.createRadialGradient(width * 0.68, height * 0.48, 0, width * 0.68, height * 0.48, width * 0.42);
  wash.addColorStop(0, `rgba(255, 79, 174, ${0.025 + glow * 0.14 + chorus * recorded.energy * 0.08})`);
  wash.addColorStop(0.48, `rgba(190, 220, 255, ${0.02 + glow * 0.08 + chorus * recorded.onset * 0.04})`);
  wash.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

const HERO_STORY_PALETTES = [
  { bg: [2, 10, 6], primary: [114, 232, 132], secondary: [198, 236, 119], accent: [231, 255, 226] },
  { bg: [3, 17, 9], primary: [91, 222, 119], secondary: [186, 231, 105], accent: [237, 255, 220] },
  { bg: [7, 20, 10], primary: [126, 215, 97], secondary: [225, 210, 103], accent: [247, 243, 200] },
  { bg: [10, 15, 7], primary: [127, 159, 68], secondary: [193, 165, 67], accent: [222, 225, 174] },
  { bg: [2, 5, 3], primary: [111, 178, 94], secondary: [151, 129, 55], accent: [204, 218, 183] },
  { bg: [12, 12, 4], primary: [173, 186, 72], secondary: [208, 148, 51], accent: [239, 225, 161] },
  { bg: [17, 7, 3], primary: [211, 154, 53], secondary: [190, 63, 36], accent: [248, 222, 154] },
  { bg: [10, 12, 4], primary: [229, 190, 69], secondary: [229, 93, 39], accent: [255, 238, 169] },
  { bg: [13, 10, 4], primary: [244, 199, 72], secondary: [218, 69, 34], accent: [255, 243, 194] },
  { bg: [2, 4, 3], primary: [114, 151, 82], secondary: [150, 108, 48], accent: [189, 199, 164] }
];

function heroStoryBeatEvents(audioTime, analysis, phase) {
  const peaks = oneMoreBiteBeatPeaks(analysis);
  const threshold = phase >= 7 && phase <= 8 ? 0.46 : phase >= 3 && phase <= 6 ? 0.58 : 0.7;
  const duration = phase >= 7 && phase <= 8 ? 1.55 : 1.25;
  const events = [];
  for (let index = peaks.length - 1; index >= 0; index--) {
    const peak = peaks[index];
    const age = audioTime - peak.time;
    if (age < -0.04) continue;
    if (age > duration) break;
    if (peak.strength < threshold) continue;
    const progress = clamp(0, 1, Math.max(0, age) / duration);
    const entrance = smoothStep(0, 0.06, progress);
    const life = entrance * (1 - smoothStep(0.58, 1, progress));
    events.push({ ...peak, age: Math.max(0, age), duration, progress, life });
  }
  return events.reverse();
}

function drawHeroStoryFx(levels, audioTime) {
  const canvas = $('hero-story-fx');
  const theater = $('hero-story-theater');
  if (!canvas || !theater || !heroStorySceneActive) return;
  const rect = theater.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = Math.min(1.25, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(240, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  const variant = heroStoryVariant();
  const storyTime = heroStoryTimelineTime(audioTime, variant);
  const section = supportedLyricsData?.sections?.find(item => storyTime >= item.start && storyTime < item.end);
  const phase = section?.phase ?? 0;
  const palette = HERO_STORY_PALETTES[phase] || HERO_STORY_PALETTES[0];
  const analysis = heroStoryAnalysisProfile(variant);
  const recorded = heroStoryAnalysisAt(audioTime, variant);
  const energy = clamp(0, 1, Math.max(recorded.energy, (levels.glow || 0) * 0.66));
  const onset = clamp(0, 1, Math.max(recorded.onset, (levels.rise || 0) * 0.58));
  const drama = phase >= 7 && phase <= 8 ? 1 : phase >= 3 ? 0.72 : 0.42;
  const events = heroStoryBeatEvents(audioTime, analysis, phase);
  const rgb = (color, alpha) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  theater.style.setProperty('--hero-primary', `rgb(${palette.primary.join(', ')})`);
  theater.style.setProperty('--hero-secondary', `rgb(${palette.secondary.join(', ')})`);
  theater.style.setProperty('--hero-accent', `rgb(${palette.accent.join(', ')})`);
  theater.style.setProperty('--hero-energy', energy.toFixed(3));
  theater.style.setProperty('--hero-onset', onset.toFixed(3));

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, `rgb(${palette.bg.join(', ')})`);
  background.addColorStop(0.52, rgb(palette.bg.map((value, index) => value + (index === 1 ? 4 : 1)), 1));
  background.addColorStop(1, 'rgb(1, 3, 2)');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Slow full-stage illumination follows the recording, not a synthetic BPM.
  const washX = width * (0.26 + 0.48 * (0.5 + 0.5 * Math.sin(audioTime * 0.075 + phase)));
  const washY = height * (0.38 + 0.12 * Math.cos(audioTime * 0.09));
  const wash = ctx.createRadialGradient(washX, washY, 0, washX, washY, width * 0.72);
  wash.addColorStop(0, rgb(palette.primary, 0.035 + energy * (0.16 + drama * 0.09)));
  wash.addColorStop(0.42, rgb(palette.secondary, 0.015 + energy * 0.06));
  wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  // Contour lines begin as hills and flatten into an unstable horizon.
  const contourCount = phase <= 2 ? 6 : 4;
  ctx.lineCap = 'round';
  for (let line = 0; line < contourCount; line++) {
    const baseY = height * (0.68 + line * 0.055);
    const amplitude = height * ((phase <= 2 ? 0.035 : 0.014) + energy * 0.018);
    ctx.beginPath();
    for (let step = 0; step <= 18; step++) {
      const x = width * step / 18;
      const y = baseY
        + Math.sin(step * 0.72 + audioTime * (0.12 + line * 0.008) + line) * amplitude
        + Math.sin(step * 0.27 - audioTime * 0.07) * amplitude * 0.42;
      if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgb(line % 2 ? palette.secondary : palette.primary, 0.045 + energy * 0.085);
    ctx.lineWidth = dpr * (0.8 + line * 0.22);
    ctx.stroke();
  }

  const playRect = $('hero-story-play')?.getBoundingClientRect();
  const centerX = playRect ? (playRect.left + playRect.width / 2 - rect.left) * dpr : width * 0.82;
  const centerY = playRect ? (playRect.top + playRect.height / 2 - rect.top) * dpr : height * 0.52;
  const startRadius = (playRect?.width || 78) * dpr * 0.56;
  const maxRadius = Math.hypot(width, height) * 0.78;

  // Every measured attack owns a complete pulse. Close attacks overlap instead
  // of snapping the previous wave back to its origin.
  events.forEach(event => {
    const strength = smoothStep(0.42, 1, event.strength);
    const maxAlpha = (0.08 + drama * 0.16) * strength;
    const ringCount = phase >= 7 && phase <= 8 ? 4 : 2;
    for (let ring = 0; ring < ringCount; ring++) {
      const delay = ring * 0.06;
      const progress = clamp(0, 1, (event.progress - delay) / Math.max(0.01, 1 - delay));
      if (progress <= 0 || progress >= 1) continue;
      const eased = 1 - (1 - progress) ** 2.4;
      const radius = startRadius + maxRadius * eased;
      const life = Math.sin(progress * Math.PI) * event.life;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(ring % 2 ? palette.secondary : palette.primary, maxAlpha * life * (1 - ring * 0.12));
      ctx.lineWidth = dpr * (1.1 + strength * 3.4 - ring * 0.12);
      ctx.stroke();
    }

    if (phase >= 3) {
      const direction = event.ordinal % 2 ? 1 : -1;
      const sweepX = direction > 0
        ? -width * 0.25 + width * 1.5 * event.progress
        : width * 1.25 - width * 1.5 * event.progress;
      const band = ctx.createLinearGradient(sweepX - width * 0.18, 0, sweepX + width * 0.18, 0);
      band.addColorStop(0, 'rgba(0, 0, 0, 0)');
      band.addColorStop(0.5, rgb(palette.secondary, event.life * strength * (0.025 + drama * 0.055)));
      band.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, width, height);
    }
  });

  if (phase <= 2) {
    // Small chevrons read as distant birds, not confetti.
    for (let bird = 0; bird < 11; bird++) {
      const seed = seededUnit((bird + 1) * 21.7);
      const x = ((seed + audioTime * (0.004 + bird * 0.0003)) % 1.1 - 0.05) * width;
      const y = height * (0.16 + seededUnit((bird + 1) * 39.2) * 0.34);
      const size = dpr * (2.5 + (bird % 4));
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x, y - size * 0.5);
      ctx.lineTo(x + size, y);
      ctx.strokeStyle = rgb(palette.accent, 0.08 + energy * 0.18);
      ctx.lineWidth = dpr;
      ctx.stroke();
    }
  } else if (phase === 3) {
    for (let rain = 0; rain < 34; rain++) {
      const x = seededUnit((rain + 1) * 17.4) * width;
      const fall = (seededUnit((rain + 1) * 43.8) + audioTime * (0.08 + rain % 5 * 0.006)) % 1;
      const y = fall * height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dpr * 8, y + dpr * (18 + energy * 18));
      ctx.strokeStyle = rgb(palette.accent, 0.035 + energy * 0.095);
      ctx.lineWidth = dpr;
      ctx.stroke();
    }
  } else if (phase === 4) {
    // Imperfect identity rings orbit an empty center without moving the copy.
    const voidX = width * 0.32;
    const voidY = height * 0.5;
    for (let ring = 0; ring < 7; ring++) {
      const radius = dpr * (28 + ring * 24 + Math.sin(audioTime * 0.18 + ring) * 4);
      ctx.beginPath();
      ctx.ellipse(voidX, voidY, radius * 1.45, radius, audioTime * 0.015 + ring * 0.13, ring * 0.31, Math.PI * (1.35 + ring * 0.04));
      ctx.strokeStyle = rgb(ring % 2 ? palette.secondary : palette.primary, 0.055 + onset * 0.1);
      ctx.lineWidth = dpr * (0.8 + ring * 0.12);
      ctx.stroke();
    }
  } else if (phase === 5) {
    const carouselX = width * 0.5;
    const carouselY = height * 0.72;
    for (let ring = 0; ring < 5; ring++) {
      ctx.beginPath();
      ctx.ellipse(carouselX, carouselY, width * (0.12 + ring * 0.075), height * (0.035 + ring * 0.018), 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(ring % 2 ? palette.primary : palette.secondary, 0.055 + energy * 0.08);
      ctx.lineWidth = dpr * 1.2;
      ctx.stroke();
    }
    for (let spoke = 0; spoke < 12; spoke++) {
      const x = width * (0.1 + spoke * 0.073);
      const lift = Math.sin(audioTime * 0.52 + spoke * 1.7) * height * 0.018;
      ctx.fillStyle = rgb(palette.accent, 0.04 + energy * 0.1);
      ctx.fillRect(x, height * 0.43 + lift, dpr, height * 0.28);
    }
  } else if (phase === 6) {
    for (let stripe = -5; stripe < 13; stripe++) {
      const x = ((stripe * width * 0.105 + audioTime * width * 0.015) % (width * 1.9)) - width * 0.45;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + height * 0.55, 0);
      ctx.strokeStyle = rgb(stripe % 2 ? palette.secondary : palette.primary, 0.045 + onset * 0.08);
      ctx.lineWidth = dpr * (stripe % 3 === 0 ? 3 : 1);
      ctx.stroke();
    }
  } else if (phase >= 7 && phase <= 8) {
    const slashCount = phase === 8 ? 9 : 6;
    for (let slash = 0; slash < slashCount; slash++) {
      const angle = -0.72 + slash * 0.24;
      const length = width * (0.16 + seededUnit(slash * 9.3) * 0.24) * (0.6 + energy * 0.6);
      const x = width * (0.14 + seededUnit((slash + 1) * 22.1) * 0.72);
      const y = height * (0.18 + seededUnit((slash + 1) * 51.3) * 0.62);
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * length * 0.5, y - Math.sin(angle) * length * 0.5);
      ctx.lineTo(x + Math.cos(angle) * length * 0.5, y + Math.sin(angle) * length * 0.5);
      ctx.strokeStyle = rgb(slash % 3 ? palette.primary : palette.secondary, 0.055 + onset * 0.2 + energy * 0.08);
      ctx.lineWidth = dpr * (1.3 + onset * 4.2);
      ctx.stroke();
    }
  }

  const moteCount = phase === 9 ? 12 : phase >= 7 ? 32 : 22;
  HERO_STORY_MOTES.slice(0, moteCount).forEach((mote, index) => {
    const drift = (mote.y + audioTime * mote.speed * 0.006) % 0.94;
    const x = (mote.x + Math.sin(audioTime * 0.16 + mote.phase) * 0.018) * width;
    const y = (0.03 + drift) * height;
    const twinkle = 0.5 + Math.sin(audioTime * (0.42 + mote.speed) + mote.phase) * 0.5;
    const alpha = (0.018 + energy * 0.12 + onset * 0.08) * (0.45 + twinkle * 0.55) * (phase === 9 ? 0.45 : 1);
    const size = mote.size * dpr * (0.7 + energy * 0.52);
    ctx.fillStyle = rgb(index % 3 ? palette.primary : palette.accent, alpha);
    if (mote.kind === 0) {
      ctx.fillRect(x - size * 0.5, y - dpr * 0.5, size, dpr);
      ctx.fillRect(x - dpr * 0.5, y - size * 0.5, dpr, size);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // A final vignette keeps the moving background from competing with lyrics.
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, width * 0.12, width * 0.5, height * 0.48, width * 0.74);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, `rgba(0, 0, 0, ${0.42 + (phase === 4 || phase === 9 ? 0.2 : 0)})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

const ENCORE_PALETTES = [
  { bg: [27, 2, 6], primary: [193, 24, 45], secondary: [246, 191, 174], accent: [255, 240, 220] },
  { bg: [38, 2, 8], primary: [230, 38, 68], secondary: [217, 111, 116], accent: [255, 232, 211] },
  { bg: [53, 1, 9], primary: [255, 38, 79], secondary: [255, 137, 133], accent: [255, 239, 213] },
  { bg: [19, 2, 9], primary: [150, 24, 57], secondary: [196, 104, 126], accent: [255, 226, 211] },
  { bg: [25, 2, 13], primary: [211, 40, 85], secondary: [176, 101, 141], accent: [250, 225, 214] },
  { bg: [47, 1, 12], primary: [255, 41, 93], secondary: [255, 135, 153], accent: [255, 238, 213] },
  { bg: [10, 1, 4], primary: [255, 30, 72], secondary: [230, 75, 116], accent: [255, 226, 195] },
  { bg: [61, 1, 11], primary: [255, 44, 79], secondary: [255, 154, 135], accent: [255, 242, 218] },
  { bg: [23, 1, 7], primary: [205, 30, 65], secondary: [219, 112, 128], accent: [255, 235, 215] },
  { bg: [67, 1, 10], primary: [255, 48, 77], secondary: [255, 179, 141], accent: [255, 246, 221] },
  { bg: [13, 1, 4], primary: [133, 24, 46], secondary: [160, 91, 101], accent: [218, 194, 184] }
];

function encoreBeatState(audioTime, analysis) {
  const bpm = analysis?.bpm || 132;
  const period = 60 / bpm;
  const beatPosition = Math.max(0, (audioTime - (analysis?.beatOffset || 0)) / period);
  const phase = beatPosition - Math.floor(beatPosition);
  return {
    index: Math.floor(beatPosition),
    phase,
    pulse: Math.pow(1 - phase, 5.4),
    halfPulse: Math.pow(1 - ((phase + 0.5) % 1), 7)
  };
}

function encoreBeatEvents(audioTime, analysis, phase) {
  const peaks = oneMoreBiteBeatPeaks(analysis);
  const highEnergy = [2, 5, 6, 7, 9].includes(phase);
  const threshold = highEnergy ? 0.43 : 0.62;
  const duration = highEnergy ? 1.05 : 0.78;
  const events = [];
  for (let index = peaks.length - 1; index >= 0; index--) {
    const peak = peaks[index];
    const age = audioTime - peak.time;
    if (age < -0.035) continue;
    if (age > duration) break;
    if (peak.strength < threshold) continue;
    const progress = clamp(0, 1, Math.max(0, age) / duration);
    const entrance = smoothStep(0, 0.045, progress);
    const life = entrance * (1 - smoothStep(0.6, 1, progress));
    events.push({ ...peak, progress, life });
  }
  return events.reverse();
}

function drawEncoreStar(ctx, x, y, radius, color, alpha, rotation = 0) {
  if (alpha <= 0.002 || radius <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let point = 0; point < 8; point++) {
    const angle = point * Math.PI / 4 - Math.PI / 2;
    const distance = point % 2 ? radius * 0.32 : radius;
    const px = Math.cos(angle) * distance;
    const py = Math.sin(angle) * distance;
    if (!point) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  ctx.fill();
  ctx.restore();
}

function drawEncoreDanceFx(levels, audioTime) {
  const canvas = $('encore-fx');
  const theater = $('encore-theater');
  if (!canvas || !theater || !encoreSceneActive) return;
  const rect = theater.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = Math.min(1.2, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(240, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  const variant = encoreDanceVariant();
  const canonicalTime = encoreCanonicalTime(audioTime, variant);
  const section = supportedLyricsData?.sections?.find(item => canonicalTime >= item.start && canonicalTime < item.end);
  const phase = section?.phase ?? 0;
  const palette = ENCORE_PALETTES[phase] || ENCORE_PALETTES[0];
  const analysis = encoreAnalysisProfile(variant);
  const recorded = encoreAnalysisAt(audioTime, variant);
  const energy = clamp(0, 1, Math.max(recorded.energy, (levels.glow || 0) * 0.7));
  const onset = clamp(0, 1, Math.max(recorded.onset, (levels.rise || 0) * 0.62));
  const highEnergy = [2, 5, 6, 7, 9].includes(phase);
  const intensity = highEnergy ? 1 : phase === 10 ? 0.2 : 0.5;
  const beat = encoreBeatState(audioTime, analysis);
  const events = encoreBeatEvents(audioTime, analysis, phase);
  const rgba = (color, alpha) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;

  theater.style.setProperty('--encore-primary', `rgb(${palette.primary.join(', ')})`);
  theater.style.setProperty('--encore-secondary', `rgb(${palette.secondary.join(', ')})`);
  theater.style.setProperty('--encore-accent', `rgb(${palette.accent.join(', ')})`);
  theater.style.setProperty('--encore-energy', energy.toFixed(3));
  theater.style.setProperty('--encore-onset', onset.toFixed(3));
  theater.style.setProperty('--encore-beat', beat.pulse.toFixed(3));

  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, `rgb(${palette.bg.join(', ')})`);
  base.addColorStop(0.52, `rgb(${Math.min(255, palette.bg[0] + 13)}, ${palette.bg[1]}, ${Math.min(255, palette.bg[2] + 4)})`);
  base.addColorStop(1, 'rgb(5, 0, 2)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const spotlightX = width * (0.24 + 0.52 * (0.5 + 0.5 * Math.sin(audioTime * 0.16)));
  const wash = ctx.createRadialGradient(spotlightX, height * 0.42, 0, spotlightX, height * 0.42, width * 0.62);
  wash.addColorStop(0, rgba(palette.primary, 0.05 + energy * 0.18 + beat.pulse * 0.04));
  wash.addColorStop(0.45, rgba(palette.secondary, 0.015 + energy * 0.055));
  wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  // A perspective checker runway gives the rhythm a physical floor without
  // touching the lyric layer. The grid scrolls from the measured 132 BPM phase.
  const horizon = height * (phase === 6 ? 0.48 : 0.66);
  const rows = highEnergy ? 11 : 7;
  const columns = highEnergy ? 18 : 12;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, width, height - horizon);
  ctx.clip();
  for (let row = 0; row < rows; row++) {
    const near = (row + ((beat.phase + 0.12) % 1)) / rows;
    const y0 = horizon + (near ** 1.85) * (height - horizon);
    const next = (row + 1 + ((beat.phase + 0.12) % 1)) / rows;
    const y1 = horizon + (next ** 1.85) * (height - horizon);
    const rowAlpha = (0.018 + energy * 0.065 + beat.pulse * 0.04) * (0.45 + near * 0.8);
    for (let column = 0; column < columns; column++) {
      if ((column + row + beat.index) % 2) continue;
      const spread0 = 0.18 + near * 0.82;
      const spread1 = 0.18 + next * 0.82;
      const x00 = width * 0.5 + (column / columns - 0.5) * width * spread0 * 1.35;
      const x01 = width * 0.5 + ((column + 1) / columns - 0.5) * width * spread0 * 1.35;
      const x10 = width * 0.5 + (column / columns - 0.5) * width * spread1 * 1.35;
      const x11 = width * 0.5 + ((column + 1) / columns - 0.5) * width * spread1 * 1.35;
      ctx.beginPath();
      ctx.moveTo(x00, y0);
      ctx.lineTo(x01, y0);
      ctx.lineTo(x11, y1);
      ctx.lineTo(x10, y1);
      ctx.closePath();
      ctx.fillStyle = rgba((row + column) % 4 ? palette.primary : palette.accent, rowAlpha);
      ctx.fill();
    }
  }
  ctx.restore();

  const playRect = $('encore-play')?.getBoundingClientRect();
  const centerX = playRect ? (playRect.left + playRect.width / 2 - rect.left) * dpr : width * 0.82;
  const centerY = playRect ? (playRect.top + playRect.height / 2 - rect.top) * dpr : height * 0.5;
  const startRadius = (playRect?.width || 76) * dpr * 0.58;
  const maxRadius = Math.hypot(width, height) * 0.74;

  // Measured attacks create complete echo frames and radial rings. Overlapping
  // attacks coexist, producing the stacked snapshot effect requested elsewhere.
  events.forEach(event => {
    const strength = smoothStep(0.4, 1, event.strength);
    const eased = 1 - (1 - event.progress) ** 2.5;
    const direction = event.ordinal % 4;
    const dirX = direction === 0 ? 1 : direction === 2 ? -1 : 0;
    const dirY = direction === 1 ? 1 : direction === 3 ? -1 : 0;
    const frameCount = highEnergy ? 4 : 2;
    for (let frame = 0; frame < frameCount; frame++) {
      const delay = frame * 0.055;
      const progress = clamp(0, 1, (event.progress - delay) / Math.max(0.01, 1 - delay));
      if (progress <= 0 || progress >= 1) continue;
      const frameLife = Math.sin(progress * Math.PI) * event.life * strength;
      const inset = dpr * (20 + frame * 17 + progress * 34);
      const travel = Math.sin(progress * Math.PI) * dpr * (18 + strength * 42);
      ctx.strokeStyle = rgba(frame % 2 ? palette.secondary : palette.accent, frameLife * (highEnergy ? 0.2 : 0.08));
      ctx.lineWidth = dpr * (0.9 + strength * 2.2);
      ctx.strokeRect(
        inset + dirX * travel,
        inset * 0.68 + dirY * travel,
        width - inset * 2,
        height - inset * 1.36
      );
    }

    const ringCount = highEnergy ? 4 : 2;
    for (let ring = 0; ring < ringCount; ring++) {
      const delay = ring * 0.05;
      const progress = clamp(0, 1, (event.progress - delay) / Math.max(0.01, 1 - delay));
      if (progress <= 0 || progress >= 1) continue;
      const radius = startRadius + maxRadius * (1 - (1 - progress) ** 2.2);
      const ringLife = Math.sin(progress * Math.PI) * event.life * strength;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(ring % 2 ? palette.primary : palette.secondary, ringLife * (highEnergy ? 0.23 : 0.07));
      ctx.lineWidth = dpr * (1.1 + strength * 3.1 - ring * 0.12);
      ctx.stroke();
    }

    if (highEnergy) {
      const horizontal = event.ordinal % 2 === 0;
      const axis = event.ordinal % 4 < 2 ? event.progress : 1 - event.progress;
      const plateCenter = (horizontal ? width : height) * axis;
      const plateSpan = (horizontal ? width : height) * (0.1 + strength * 0.08);
      const plate = horizontal
        ? ctx.createLinearGradient(plateCenter - plateSpan, 0, plateCenter + plateSpan, 0)
        : ctx.createLinearGradient(0, plateCenter - plateSpan, 0, plateCenter + plateSpan);
      plate.addColorStop(0, 'rgba(0,0,0,0)');
      plate.addColorStop(0.5, rgba(palette.primary, event.life * strength * 0.1));
      plate.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = plate;
      ctx.fillRect(0, 0, width, height);
    }
  });

  // Fixed-width diagonal signal slices cross on half-beats during choruses.
  const sliceCount = highEnergy ? 9 : 4;
  for (let slice = 0; slice < sliceCount; slice++) {
    const lane = (slice + beat.index * 0.25) % sliceCount;
    const x = width * (lane / Math.max(1, sliceCount - 1));
    const lean = height * (slice % 2 ? 0.16 : -0.14);
    ctx.beginPath();
    ctx.moveTo(x - lean, height);
    ctx.lineTo(x + lean, 0);
    ctx.strokeStyle = rgba(slice % 3 ? palette.primary : palette.secondary, 0.018 + energy * 0.055 + beat.halfPulse * intensity * 0.07);
    ctx.lineWidth = dpr * (slice % 3 === 0 ? 4.2 : 1.1);
    ctx.stroke();
  }

  if ([3, 4].includes(phase)) {
    const moonX = width * 0.76;
    const moonY = height * 0.34;
    const moonRadius = Math.min(width, height) * 0.14;
    const moon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 1.5);
    moon.addColorStop(0, rgba(palette.accent, 0.15 + energy * 0.16));
    moon.addColorStop(0.48, rgba(palette.secondary, 0.05 + energy * 0.05));
    moon.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = moon;
    ctx.fillRect(moonX - moonRadius * 1.5, moonY - moonRadius * 1.5, moonRadius * 3, moonRadius * 3);
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(palette.accent, 0.12 + energy * 0.13);
    ctx.lineWidth = dpr * 1.2;
    ctx.stroke();
  }

  const moteCount = phase === 10 ? 10 : highEnergy ? 36 : 20;
  for (let index = 0; index < moteCount; index++) {
    const mote = ENCORE_MOTES[index];
    const speedLift = highEnergy ? 1.75 : 0.62;
    const x = ((mote.x + audioTime * mote.speed * 0.009 * speedLift) % 1.08 - 0.04) * width;
    const y = (mote.y + Math.sin(audioTime * (0.22 + mote.speed) + mote.phase) * (highEnergy ? 0.035 : 0.012)) * height;
    const twinkle = 0.5 + Math.sin(audioTime * (0.8 + mote.speed) + mote.phase) * 0.5;
    const alpha = (0.025 + energy * 0.15 + beat.pulse * intensity * 0.1) * (0.55 + twinkle * 0.45) * (phase === 10 ? 0.4 : 1);
    const radius = mote.size * dpr * (0.72 + energy * 0.44 + beat.pulse * 0.18);
    const trailCount = highEnergy ? 3 : 1;
    for (let trail = trailCount - 1; trail >= 0; trail--) {
      const distance = trail * dpr * (7 + energy * 10);
      drawEncoreStar(
        ctx,
        x - distance,
        y + Math.sin(mote.phase) * distance * 0.22,
        radius * (1 - trail * 0.13),
        trail ? palette.primary : (index % 4 ? palette.accent : palette.secondary),
        alpha * (trail ? 0.22 / trail : 1),
        mote.phase + audioTime * 0.04
      );
    }
  }

  if (phase === 6) {
    // Instrumental peak: a clean central X flashes from beat energy, keeping the
    // lyrics-free dance break visually decisive without adding more particles.
    const length = Math.min(width, height) * (0.25 + beat.pulse * 0.12);
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(audioTime * 0.035);
    ctx.strokeStyle = rgba(palette.accent, 0.08 + beat.pulse * 0.27 + onset * 0.16);
    ctx.lineWidth = dpr * (2 + beat.pulse * 7);
    ctx.beginPath();
    ctx.moveTo(-length, -length);
    ctx.lineTo(length, length);
    ctx.moveTo(length, -length);
    ctx.lineTo(-length, length);
    ctx.stroke();
    ctx.restore();
  }

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, width * 0.12, width * 0.5, height * 0.48, width * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, `rgba(0,0,0,${phase === 10 ? 0.72 : 0.42})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

const STORY_PALETTES = {
  waiting: { bg: [246, 238, 215], deep: [105, 35, 52], primary: [181, 67, 91], secondary: [139, 194, 220], accent: [255, 250, 235] },
  violet: { bg: [10, 6, 24], deep: [3, 2, 10], primary: [144, 91, 239], secondary: [242, 87, 202], accent: [204, 224, 255] },
  compass: { bg: [18, 61, 154], deep: [2, 7, 30], primary: [255, 174, 18], secondary: [255, 225, 84], accent: [222, 236, 255] },
  celebration: { bg: [242, 62, 152], deep: [80, 19, 76], primary: [255, 224, 72], secondary: [69, 213, 235], accent: [255, 244, 233] },
  psalm: { bg: [42, 79, 112], deep: [5, 14, 31], primary: [238, 202, 137], secondary: [157, 207, 224], accent: [241, 239, 217] },
  dusty: { bg: [45, 42, 31], deep: [10, 13, 11], primary: [215, 165, 86], secondary: [116, 139, 112], accent: [238, 224, 190] }
};

function storyCanvasColor(color, alpha = 1) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function drawStorySpark(ctx, x, y, radius, color, alpha, rotation = 0) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.22, -radius * 0.2);
  ctx.lineTo(radius, 0);
  ctx.lineTo(radius * 0.22, radius * 0.2);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius * 0.22, radius * 0.2);
  ctx.lineTo(-radius, 0);
  ctx.lineTo(-radius * 0.22, -radius * 0.2);
  ctx.closePath();
  ctx.fillStyle = storyCanvasColor(color, alpha);
  ctx.fill();
  ctx.restore();
}

function drawStoryPulseRings(ctx, centerX, centerY, width, height, palette, audioTime, energy, onset, intensity) {
  const bpm = supportedLyricsData?.bpm || 120;
  const period = 60 / bpm;
  const beat = storyTheaterBeatAt(audioTime);
  const maxRadius = Math.hypot(width, height) * 0.52;
  for (let ageIndex = 0; ageIndex < 4; ageIndex++) {
    const age = (beat.phase + ageIndex) * period;
    const lifetime = 1.25;
    const progress = age / lifetime;
    if (progress >= 1) continue;
    const eased = 1 - (1 - progress) ** 2.5;
    const alpha = (1 - progress) ** 1.7 * (0.025 + energy * 0.09 + onset * 0.1) * intensity;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 34 + maxRadius * eased, 0, Math.PI * 2);
    ctx.strokeStyle = storyCanvasColor(ageIndex % 2 ? palette.secondary : palette.primary, alpha);
    ctx.lineWidth = 1 + onset * 3.2;
    ctx.stroke();
  }
}

function drawStoryKineticPass(ctx, width, height, palette, audioTime, beat, energy, onset, intensity, direction = 1) {
  const strength = clamp(0, 1.4, intensity * (0.42 + energy * 0.38 + onset * 0.3));
  if (strength <= 0.01) return;
  const period = 60 / (supportedLyricsData?.bpm || 120);
  const diagonal = direction * 0.14;

  // Successive beats leave complete, overlapping frames. Nothing retracts,
  // so the field stays fluid even when several accents land close together.
  for (let echo = 0; echo < 5; echo++) {
    const age = (beat.phase + echo) * period;
    const progress = age / 1.45;
    if (progress >= 1) continue;
    const eased = 1 - (1 - progress) ** 2.25;
    const life = Math.sin(progress * Math.PI);
    const frameWidth = width * (0.08 + eased * 0.94);
    const frameHeight = height * (0.07 + eased * 0.82);
    ctx.save();
    ctx.translate(width * 0.5, height * 0.49);
    ctx.rotate(diagonal * (0.32 + echo * 0.08));
    ctx.strokeStyle = storyCanvasColor(echo % 2 ? palette.secondary : palette.primary, life * strength * 0.12);
    ctx.lineWidth = 0.8 + onset * 2.4;
    ctx.strokeRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
    ctx.restore();
  }

  // Broad blurred-looking bands travel continuously across the full stage.
  // Canvas gradients provide the softness without an expensive blur filter.
  for (let lane = 0; lane < 4; lane++) {
    const travel = ((audioTime * (0.105 + lane * 0.009) + lane * 0.29) % 1.42) - 0.21;
    const x = direction > 0 ? travel * width : width - travel * width;
    const span = width * (0.045 + strength * 0.025);
    const sweep = ctx.createLinearGradient(x - span, 0, x + span, 0);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.48, storyCanvasColor(lane % 2 ? palette.secondary : palette.accent, strength * (0.035 + beat.pulse * 0.045)));
    sweep.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.translate(x, height * 0.5);
    ctx.rotate(diagonal + (lane - 1.5) * 0.055);
    ctx.fillStyle = sweep;
    ctx.fillRect(-span, -height, span * 2, height * 2);
    ctx.restore();
  }
}

function drawCompassTheaterFx(ctx, width, height, dpr, palette, audioTime, beat, energy, onset, phase, cx, cy) {
  const horizon = height * 0.69;
  const phaseLift = [0.18, 0.34, 0.82, 0.64, 0.88, 0.92, 1, 0.58, 0.14][phase] ?? 0.3;
  const solo = phase === 5 || phase === 6;
  const guideX = width * 0.155;
  const guideY = height * 0.17;
  const dancerX = width * 0.57;
  const dancerY = horizon - height * 0.12;

  // The cover's cobalt field opens into a nearly black mirror sea. Phase three
  // deliberately splits that field into black and white before color returns.
  const cobalt = ctx.createRadialGradient(width * 0.48, height * 0.28, 0, width * 0.48, height * 0.28, width * 0.82);
  cobalt.addColorStop(0, storyCanvasColor([41, 92, 211], 0.25 + energy * 0.14));
  cobalt.addColorStop(0.55, storyCanvasColor([13, 44, 123], 0.15 + phaseLift * 0.08));
  cobalt.addColorStop(1, storyCanvasColor(palette.deep, 0.42));
  ctx.fillStyle = cobalt;
  ctx.fillRect(0, 0, width, height);

  if (phase === 3) {
    ctx.fillStyle = 'rgba(238, 241, 236, 0.085)';
    ctx.fillRect(width * 0.5, 0, width * 0.5, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width * 0.5, height);
    const cutX = width * (0.5 + Math.sin(audioTime * 0.22) * 0.012);
    ctx.fillStyle = `rgba(197, 35, 48, ${0.2 + onset * 0.24 + beat.pulse * 0.12})`;
    ctx.fillRect(cutX - dpr * 1.6, 0, dpr * 3.2, height);
  }

  // Sparse witnesses from the cover remain almost still, making the central
  // dancer's motion read clearly instead of competing with a particle field.
  const witnessCount = solo ? 9 : 6;
  for (let index = 0; index < witnessCount; index++) {
    const x = width * (0.07 + index * 0.105);
    const y = horizon - height * (0.025 + (index % 3) * 0.014);
    const radius = dpr * (8 + index % 4 * 2.5);
    ctx.beginPath();
    ctx.arc(x, y - radius * 1.7, radius * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = storyCanvasColor([4, 9, 27], 0.34 + phaseLift * 0.16);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.55, radius * 1.25, radius * 2.15, 0, Math.PI, 0);
    ctx.fill();
  }

  // The guide star is the one stable landmark through every chapter.
  const starPulse = 0.72 + Math.sin(audioTime * 0.8) * 0.13 + beat.pulse * phaseLift * 0.15;
  const starGlow = ctx.createRadialGradient(guideX, guideY, 0, guideX, guideY, width * (0.055 + phaseLift * 0.025));
  starGlow.addColorStop(0, storyCanvasColor(palette.secondary, 0.24 + starPulse * 0.2));
  starGlow.addColorStop(0.28, storyCanvasColor(palette.primary, 0.11 + energy * 0.1));
  starGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = starGlow;
  ctx.fillRect(0, 0, width, height * 0.48);
  drawStorySpark(ctx, guideX, guideY, dpr * (5.5 + starPulse * 2.5), palette.secondary, 0.62 + phaseLift * 0.2, audioTime * 0.025);

  // Long, slow mirror bands preserve motion in quiet passages without making
  // the horizon twitch. The high-energy phases widen and brighten the wake.
  ctx.fillStyle = storyCanvasColor([1, 5, 18], phase === 8 ? 0.62 : 0.48);
  ctx.fillRect(0, horizon, width, height - horizon);
  const waveCount = solo ? 11 : 8;
  for (let wave = 0; wave < waveCount; wave++) {
    const depth = wave / Math.max(1, waveCount - 1);
    const baseY = horizon + depth * (height - horizon) * 0.84;
    const amplitude = dpr * (1.2 + energy * 4.8 + phaseLift * 2.5) * (0.4 + depth * 0.8);
    ctx.beginPath();
    for (let point = 0; point <= 56; point++) {
      const progress = point / 56;
      const x = progress * width;
      const y = baseY + Math.sin(progress * Math.PI * (3.4 + wave * 0.21) + audioTime * (0.17 + wave * 0.012)) * amplitude;
      point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = storyCanvasColor(wave % 3 ? [61, 110, 213] : palette.primary, 0.035 + energy * 0.055 + phaseLift * 0.035);
    ctx.lineWidth = dpr * (0.75 + depth * 0.8 + beat.pulse * phaseLift * 0.45);
    ctx.stroke();
  }

  const drawDancer = (x, y, scale, alpha, reflected = false) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, reflected ? -scale * 0.58 : scale);
    ctx.globalAlpha *= alpha;
    const sway = reflected ? 0 : Math.sin(audioTime * 0.48) * 0.08 + beat.pulse * phaseLift * 0.025;
    ctx.rotate(sway);
    ctx.strokeStyle = storyCanvasColor(palette.accent, reflected ? 0.22 : 0.72);
    ctx.fillStyle = storyCanvasColor([7, 14, 43], reflected ? 0.3 : 0.82);
    ctx.lineWidth = dpr * 1.35;
    ctx.beginPath(); ctx.arc(0, -dpr * 27, dpr * 7.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -dpr * 19); ctx.quadraticCurveTo(-dpr * 4, -dpr * 7, 0, dpr * 1); ctx.stroke();
    const armLift = Math.sin(audioTime * 0.62) * dpr * 3 + beat.pulse * phaseLift * dpr * 3;
    ctx.beginPath(); ctx.moveTo(-dpr * 2, -dpr * 15); ctx.quadraticCurveTo(-dpr * 14, -dpr * 10 - armLift, -dpr * 18, -dpr * 1 - armLift); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dpr * 2, -dpr * 15); ctx.quadraticCurveTo(dpr * 13, -dpr * 11 + armLift, dpr * 17, -dpr * 3 + armLift); ctx.stroke();
    for (let petal = 0; petal < 8; petal++) {
      const angle = petal * Math.PI / 4 + Math.sin(audioTime * 0.34) * 0.05;
      ctx.save(); ctx.rotate(angle);
      ctx.fillStyle = storyCanvasColor(petal % 2 ? palette.primary : palette.secondary, reflected ? 0.22 : 0.62 + energy * 0.16);
      ctx.beginPath(); ctx.ellipse(0, dpr * 8, dpr * 4.2, dpr * 11.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  };

  // During the solos, full dancer snapshots linger behind the present pose.
  // They are time-offset silhouettes rather than continuously retracting rings.
  if (solo) {
    const echoes = phase === 6 ? 4 : 2;
    for (let echo = echoes; echo >= 1; echo--) {
      const offset = width * 0.026 * echo * (phase === 6 ? 1 : -1);
      drawDancer(dancerX - offset, dancerY + Math.sin(audioTime * 0.36 - echo) * height * 0.01, 1 + echo * 0.025, 0.07 + energy * 0.035);
    }
  }
  drawDancer(dancerX, dancerY, 1, phase === 0 ? 0.25 : 0.62 + phaseLift * 0.19);
  drawDancer(dancerX, horizon + (horizon - dancerY) * 0.52, 1, phase === 0 ? 0.08 : 0.2, true);

  // The molten-gold cord is the scene's main motion language. Its broad arcs
  // retain the cover's silhouette while audio energy controls wake and glow.
  const cordAmp = height * (0.07 + phaseLift * 0.055 + energy * 0.035);
  const cordStartX = guideX + width * 0.025;
  const cordEndX = phase === 2 ? width * 0.78 : dancerX + width * 0.035;
  const trailCount = solo ? (phase === 6 ? 5 : 3) : 2;
  for (let trail = trailCount - 1; trail >= 0; trail--) {
    const lag = trail * 0.23;
    const wave = Math.sin((audioTime - lag) * (solo ? 0.62 : 0.32));
    ctx.beginPath();
    ctx.moveTo(cordStartX, guideY + dpr * 8);
    ctx.bezierCurveTo(
      width * 0.3, height * 0.12 + wave * cordAmp,
      width * 0.34, horizon - cordAmp * (0.8 + wave * 0.2),
      cordEndX, dancerY + dpr * (phase === 2 ? 28 : -3)
    );
    const alpha = trail === 0 ? 0.32 + energy * 0.24 + beat.pulse * phaseLift * 0.13 : (0.08 + energy * 0.05) * (1 - trail / (trailCount + 1));
    ctx.strokeStyle = storyCanvasColor(trail % 2 ? palette.secondary : palette.primary, alpha);
    ctx.lineWidth = dpr * (trail === 0 ? 2.2 + energy * 2.3 + onset * 1.8 : 1.1);
    ctx.stroke();
  }

  // A bright bead travels along the cord once per beat, giving the fast rock
  // arrangement a precise pulse without flashing the entire viewport.
  const beadProgress = beat.phase;
  const beadX = cordStartX + (cordEndX - cordStartX) * beadProgress;
  const beadY = guideY + (dancerY - guideY) * beadProgress + Math.sin(beadProgress * Math.PI * 2 + audioTime * 0.32) * cordAmp;
  ctx.fillStyle = storyCanvasColor(palette.secondary, 0.3 + beat.pulse * 0.48 + energy * 0.15);
  ctx.beginPath(); ctx.arc(beadX, beadY, dpr * (1.8 + phaseLift * 1.4), 0, Math.PI * 2); ctx.fill();

  if (phase === 2) {
    // The compass is visibly below the horizon and breaks into four fragments.
    const compassX = width * 0.76;
    const compassY = horizon + height * 0.095;
    const radius = Math.min(width, height) * 0.085;
    for (let fragment = 0; fragment < 4; fragment++) {
      const start = fragment * Math.PI / 2 + audioTime * 0.025;
      ctx.beginPath(); ctx.arc(compassX, compassY, radius + fragment % 2 * dpr * 5, start, start + Math.PI * 0.34);
      ctx.strokeStyle = storyCanvasColor(fragment % 2 ? palette.accent : palette.primary, 0.32 + energy * 0.24);
      ctx.lineWidth = dpr * (1.5 + onset * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(compassX, compassY); ctx.lineTo(compassX + Math.sin(audioTime * 0.7) * radius * 0.62, compassY + radius * 0.55);
    ctx.strokeStyle = storyCanvasColor([207, 45, 55], 0.52 + onset * 0.25); ctx.lineWidth = dpr * 2; ctx.stroke();
  }

  if (phase === 4) {
    const radius = Math.min(width, height) * 0.13;
    const needleAngle = -Math.PI / 2 + Math.sin(audioTime * 0.16) * 0.025;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = storyCanvasColor(palette.secondary, 0.18 + energy * 0.18); ctx.lineWidth = dpr * 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(needleAngle) * radius * 0.52, cy - Math.sin(needleAngle) * radius * 0.52); ctx.lineTo(cx + Math.cos(needleAngle) * radius * 0.82, cy + Math.sin(needleAngle) * radius * 0.82);
    ctx.strokeStyle = storyCanvasColor(palette.primary, 0.68 + beat.pulse * 0.22); ctx.lineWidth = dpr * (2.1 + onset * 1.8); ctx.stroke();
  }

  if (solo) {
    drawStoryKineticPass(ctx, width, height, palette, audioTime, beat, energy, onset, phase === 6 ? 0.96 : 0.72, phase === 6 ? 1 : -1);
    const streaks = phase === 6 ? 18 : 10;
    for (let streak = 0; streak < streaks; streak++) {
      const travel = ((audioTime * (0.07 + streak % 4 * 0.006) + seededUnit(streak * 17.4)) % 1.35) - 0.16;
      const x = travel * width;
      const y = height * (0.08 + seededUnit(streak * 47.1) * 0.74);
      const length = width * (0.035 + energy * 0.055 + streak % 3 * 0.012);
      ctx.beginPath(); ctx.moveTo(x - length, y + length * 0.12); ctx.lineTo(x, y);
      ctx.strokeStyle = storyCanvasColor(streak % 4 ? palette.primary : [218, 75, 137], 0.04 + energy * 0.1 + beat.pulse * 0.07);
      ctx.lineWidth = dpr * (0.8 + onset * 2); ctx.stroke();
    }
  }

  if (phase === 7) {
    // Four independent tide walls follow the four isolated vocal calls. Each
    // wave completes even when the next arrives, so the coda can overlap cleanly.
    const calls = [196.6, 201.44, 206.56, 212.06];
    calls.forEach((start, index) => {
      const age = audioTime - start;
      if (age < 0 || age > 6.4) return;
      const progress = age / 6.4;
      const life = Math.sin(progress * Math.PI);
      const tideY = horizon - height * 0.28 * life + index * dpr * 3;
      ctx.beginPath();
      for (let point = 0; point <= 48; point++) {
        const x = point / 48 * width;
        const y = tideY + Math.sin(point * 0.58 + age * 1.1) * dpr * (3 + life * 7);
        point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = storyCanvasColor(index % 2 ? palette.accent : palette.secondary, life * (0.18 + energy * 0.18));
      ctx.lineWidth = dpr * (1.2 + life * 3.2); ctx.stroke();
    });
  }

  if (phase === 8) {
    const still = ctx.createLinearGradient(0, horizon, 0, height);
    still.addColorStop(0, storyCanvasColor(palette.secondary, 0.08));
    still.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = still; ctx.fillRect(0, horizon, width, height - horizon);
  }
}

function drawStoryTheaterFx(levels, audioTime) {
  const canvas = $('story-fx');
  const theater = $('story-theater');
  if (!canvas || !theater || !storyTheaterSceneActive) return;
  const rect = theater.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = Math.min(1.2, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(240, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  const variant = storyTheaterVariant();
  const palette = STORY_PALETTES[variant] || STORY_PALETTES.waiting;
  const recorded = storyTheaterAnalysisAt(audioTime);
  const energy = clamp(0, 1, Math.max(recorded.energy, (levels.glow || 0) * 0.52));
  const onset = clamp(0, 1, Math.max(recorded.onset, (levels.rise || 0) * 0.58));
  const beat = storyTheaterBeatAt(audioTime);
  const phase = Number(theater.dataset.phase || 0);
  const isPeakPhase = !!STORY_PEAK_PHASES[variant]?.includes(phase);
  const peak = isPeakPhase ? 1 : 0.3;
  const motion = clamp(0, 1.3, energy * 0.7 + onset * 0.65 + beat.pulse * peak * 0.4);
  theater.style.setProperty('--story-primary', `rgb(${palette.primary.join(', ')})`);
  theater.style.setProperty('--story-secondary', `rgb(${palette.secondary.join(', ')})`);
  theater.style.setProperty('--story-accent', `rgb(${palette.accent.join(', ')})`);
  theater.style.setProperty('--story-energy', energy.toFixed(3));
  theater.style.setProperty('--story-onset', onset.toFixed(3));
  theater.style.setProperty('--story-beat', beat.pulse.toFixed(3));

  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, storyCanvasColor(palette.bg));
  base.addColorStop(1, storyCanvasColor(palette.deep));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const controlRect = $('story-play')?.getBoundingClientRect();
  const cx = controlRect ? (controlRect.left + controlRect.width / 2 - rect.left) * dpr : width * 0.82;
  const cy = controlRect ? (controlRect.top + controlRect.height / 2 - rect.top) * dpr : height * 0.54;

  if (variant === 'waiting') {
    const chorus = isPeakPhase;
    const chorusLift = chorus ? clamp(0, 1, 0.48 + energy * 0.34 + beat.pulse * 0.28) : 0;
    const verseMotion = clamp(0, 1, 0.34 + energy * 0.36 + onset * 0.24 + beat.pulse * 0.18);
    const morning = clamp(0, 1, audioTime / Math.max(1, supportedLyricsData?.duration || 162));
    const sky = ctx.createRadialGradient(width * 0.78, height * 0.16, 0, width * 0.78, height * 0.16, width * 0.7);
    sky.addColorStop(0, storyCanvasColor([255, 247, 204], 0.28 + morning * 0.3 + energy * 0.12));
    sky.addColorStop(0.45, storyCanvasColor(palette.secondary, 0.08 + morning * 0.14));
    sky.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const windowX = width * 0.785;
    const windowY = height * 0.34;

    // Broken orbital tracks make the window read as a large clock face. Their
    // slow counter-rotation is visible in verses without borrowing the refrain star.
    for (let orbit = 0; orbit < 6; orbit++) {
      const radiusX = width * (0.105 + orbit * 0.052);
      const radiusY = height * (0.105 + orbit * 0.043);
      const rotation = audioTime * (orbit % 2 ? -0.018 : 0.014) + orbit * 0.21;
      const arcStart = rotation + orbit * 0.47;
      const arcLength = Math.PI * (0.72 + (orbit % 3) * 0.18);
      ctx.beginPath();
      ctx.ellipse(windowX, windowY, radiusX, radiusY, rotation * 0.12, arcStart, arcStart + arcLength);
      ctx.strokeStyle = storyCanvasColor(orbit % 2 ? palette.secondary : palette.primary, 0.07 + verseMotion * 0.065 + chorusLift * 0.045);
      ctx.lineWidth = dpr * (orbit % 3 === 0 ? 1.8 : 1);
      ctx.stroke();
    }

    // Two time ribbons travel toward tomorrow from opposite sides of the room.
    // Their curves continually breathe with the measured recording energy.
    for (let ribbonIndex = 0; ribbonIndex < 2; ribbonIndex++) {
      const direction = ribbonIndex ? -1 : 1;
      const baseY = height * (ribbonIndex ? 0.7 : 0.24);
      const wave = height * (0.035 + verseMotion * 0.025 + chorusLift * 0.02);
      ctx.beginPath();
      for (let point = 0; point <= 40; point++) {
        const progress = point / 40;
        const x = direction > 0 ? progress * width : width - progress * width;
        const y = baseY
          + Math.sin(progress * Math.PI * 3.2 + audioTime * (0.42 + ribbonIndex * 0.08)) * wave
          + (windowY - baseY) * progress * 0.28;
        if (!point) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = storyCanvasColor(ribbonIndex ? palette.primary : palette.secondary, 0.1 + verseMotion * 0.1 + chorusLift * 0.08);
      ctx.lineWidth = dpr * (1.4 + energy * 2.2 + beat.pulse * 1.2);
      ctx.shadowColor = storyCanvasColor(ribbonIndex ? palette.primary : palette.secondary, 0.2 + verseMotion * 0.12);
      ctx.shadowBlur = dpr * (4 + verseMotion * 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // A moving clock corridor gives every section a sense of forward travel.
    // Refrains open it into the existing daybreak star instead of replacing it.
    for (let spoke = 0; spoke < 12; spoke++) {
      const angle = spoke * Math.PI / 6 + Math.sin(audioTime * 0.12) * 0.025;
      const inner = Math.min(width, height) * (0.055 + beat.pulse * 0.012);
      const outer = Math.hypot(width, height) * (0.48 + chorusLift * 0.1);
      ctx.beginPath();
      ctx.moveTo(windowX + Math.cos(angle) * inner, windowY + Math.sin(angle) * inner);
      ctx.lineTo(windowX + Math.cos(angle) * outer, windowY + Math.sin(angle) * outer);
      ctx.strokeStyle = storyCanvasColor(spoke % 3 ? palette.secondary : palette.primary, 0.045 + verseMotion * 0.055 + chorusLift * 0.055);
      ctx.lineWidth = dpr * (spoke % 3 === 0 ? 1.4 : 0.7);
      ctx.stroke();
    }

    const beatPeriod = 60 / (supportedLyricsData?.bpm || 143.555);
    for (let echo = 0; echo < 5; echo++) {
      const age = (beat.phase + echo) * beatPeriod;
      const progress = age / 1.65;
      if (progress >= 1) continue;
      const eased = 1 - (1 - progress) ** 2.2;
      const life = Math.sin(progress * Math.PI);
      const frameWidth = width * (0.08 + eased * 0.82);
      const frameHeight = height * (0.08 + eased * 0.7);
      ctx.strokeStyle = storyCanvasColor(echo % 2 ? palette.secondary : palette.primary, life * (0.055 + verseMotion * 0.085 + chorusLift * 0.075));
      ctx.lineWidth = dpr * (0.8 + beat.pulse * 1.4 + chorusLift * 0.8);
      ctx.strokeRect(windowX - frameWidth / 2, windowY - frameHeight / 2, frameWidth, frameHeight);
    }

    // Thin measured sweeps cross the whole room on successive beats. They stay
    // calm in verses but make the non-chorus scene visibly alive.
    for (let sweep = 0; sweep < 3; sweep++) {
      const progress = (beat.phase + sweep) / 3;
      const x = (-0.16 + progress * 1.34) * width;
      const span = width * (0.055 + chorusLift * 0.035);
      const sweepGradient = ctx.createLinearGradient(x - span, 0, x + span, 0);
      sweepGradient.addColorStop(0, 'rgba(255,255,255,0)');
      sweepGradient.addColorStop(0.5, storyCanvasColor(sweep % 2 ? palette.secondary : palette.accent, 0.025 + verseMotion * 0.045 + chorusLift * 0.075));
      sweepGradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.translate(x, height * 0.5);
      ctx.rotate(-0.16 + sweep * 0.1);
      ctx.fillStyle = sweepGradient;
      ctx.fillRect(-span, -height, span * 2, height * 2);
      ctx.restore();
    }

    // Slow cloud ribbons keep the verses alive without turning them into refrains.
    for (let band = 0; band < 6; band++) {
      const travel = ((audioTime * (0.012 + band * 0.0015) + seededUnit(band * 18.7)) % 1.35) - 0.18;
      const y = height * (0.14 + band * 0.105) + Math.sin(audioTime * 0.16 + band) * height * 0.012;
      const cloudWidth = width * (0.24 + seededUnit(band * 33.9) * 0.18);
      const cloud = ctx.createLinearGradient(travel * width, y, travel * width + cloudWidth, y);
      cloud.addColorStop(0, 'rgba(255,255,255,0)');
      cloud.addColorStop(0.5, storyCanvasColor(chorus ? palette.accent : palette.secondary, 0.055 + verseMotion * 0.06 + chorusLift * 0.085));
      cloud.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(travel * width + cloudWidth * 0.5, y, cloudWidth * 0.5, height * (0.018 + band % 2 * 0.008), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (chorus) {
      const refrainWash = ctx.createLinearGradient(0, height, width, 0);
      refrainWash.addColorStop(0, storyCanvasColor([102, 22, 55], 0.26 + chorusLift * 0.2));
      refrainWash.addColorStop(0.52, storyCanvasColor(palette.primary, 0.2 + chorusLift * 0.18));
      refrainWash.addColorStop(1, storyCanvasColor([80, 30, 67], 0.28 + chorusLift * 0.17));
      ctx.fillStyle = refrainWash;
      ctx.fillRect(0, 0, width, height);

      // The window becomes a daybreak source: broad rays move smoothly on the beat.
      const rayX = windowX;
      const rayY = windowY;
      const rayCount = 14;
      for (let ray = 0; ray < rayCount; ray++) {
        const angle = -Math.PI * 0.92 + ray * (Math.PI * 1.84 / (rayCount - 1)) + Math.sin(audioTime * 0.24) * 0.035;
        const halfWidth = 0.018 + beat.pulse * 0.012;
        const length = Math.hypot(width, height) * (0.52 + energy * 0.12);
        ctx.beginPath();
        ctx.moveTo(rayX, rayY);
        ctx.lineTo(rayX + Math.cos(angle - halfWidth) * length, rayY + Math.sin(angle - halfWidth) * length);
        ctx.lineTo(rayX + Math.cos(angle + halfWidth) * length, rayY + Math.sin(angle + halfWidth) * length);
        ctx.closePath();
        ctx.fillStyle = storyCanvasColor(ray % 3 ? palette.accent : palette.secondary, 0.018 + chorusLift * 0.032 + beat.pulse * 0.045);
        ctx.fill();
      }

      for (let sweep = 0; sweep < 4; sweep++) {
        const sweepX = (((audioTime * (0.055 + sweep * 0.004)) + sweep * 0.31) % 1.45 - 0.22) * width;
        ctx.save();
        ctx.translate(sweepX, height * 0.5);
        ctx.rotate(-0.24 + sweep * 0.12);
        const ribbon = ctx.createLinearGradient(-width * 0.08, 0, width * 0.08, 0);
        ribbon.addColorStop(0, 'rgba(255,255,255,0)');
        ribbon.addColorStop(0.5, storyCanvasColor(sweep % 2 ? palette.secondary : palette.accent, 0.035 + chorusLift * 0.075));
        ribbon.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = ribbon;
        ctx.fillRect(-width * 0.08, -height, width * 0.16, height * 2);
        ctx.restore();
      }
    }

    ctx.strokeStyle = storyCanvasColor(palette.deep, 0.13);
    ctx.lineWidth = dpr * 2;
    ctx.strokeRect(width * 0.63, height * 0.08, width * 0.31, height * 0.54);
    ctx.beginPath();
    ctx.moveTo(width * 0.785, height * 0.08); ctx.lineTo(width * 0.785, height * 0.62);
    ctx.moveTo(width * 0.63, height * 0.34); ctx.lineTo(width * 0.94, height * 0.34); ctx.stroke();

    // Time marks orbit the window throughout the song; the active beat lights
    // the next mark without forcing the entire scene to flash.
    const markRadiusX = width * 0.19;
    const markRadiusY = height * 0.25;
    for (let mark = 0; mark < 24; mark++) {
      const angle = mark * Math.PI / 12 - Math.PI / 2;
      const activeDistance = (mark - beat.index % 24 + 24) % 24;
      const active = activeDistance === 0 ? beat.pulse : 0;
      const x = windowX + Math.cos(angle) * markRadiusX;
      const y = windowY + Math.sin(angle) * markRadiusY;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = storyCanvasColor(mark % 4 ? palette.deep : palette.primary, 0.055 + verseMotion * 0.06 + active * 0.3 + chorusLift * 0.08);
      ctx.fillRect(-dpr * (1 + active * 1.8), -dpr * (2.5 + active * 4), dpr * (2 + active * 3.6), dpr * (5 + active * 8));
      ctx.restore();
    }

    const petalCount = chorus ? 52 : 27;
    for (let index = 0; index < petalCount; index++) {
      const drift = (seededUnit(index * 19.2) + audioTime * (0.008 + index % 4 * 0.0017)) % 1;
      const x = (0.04 + seededUnit(index * 41.7) * 0.92 + Math.sin(audioTime * 0.22 + index) * 0.018) * width;
      const y = (0.08 + drift * 0.86) * height;
      const trailLength = dpr * (4 + energy * 7 + chorusLift * 12);
      ctx.beginPath();
      ctx.moveTo(x - trailLength, y - trailLength * 0.32);
      ctx.lineTo(x, y);
      ctx.strokeStyle = storyCanvasColor(index % 3 ? palette.primary : palette.secondary, 0.025 + energy * 0.045 + chorusLift * 0.07);
      ctx.lineWidth = dpr * (0.7 + chorusLift * 0.5);
      ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(audioTime * 0.15 + index);
      ctx.fillStyle = storyCanvasColor(index % 3 ? palette.primary : [232, 177, 129], 0.065 + energy * 0.12 + chorusLift * 0.13 + beat.pulse * peak * 0.07);
      ctx.beginPath(); ctx.ellipse(0, 0, dpr * (3 + index % 4), dpr * (1.5 + index % 2), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (let hand = 0; hand < 2; hand++) {
      const angle = audioTime * (hand ? 0.12 : 0.035) - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * width * (hand ? 0.07 : 0.11), cy + Math.sin(angle) * width * (hand ? 0.07 : 0.11));
      ctx.strokeStyle = storyCanvasColor(palette.deep, 0.18 + energy * 0.16); ctx.lineWidth = dpr * (hand ? 2.2 : 1.2); ctx.stroke();
    }
  } else if (variant === 'violet') {
    drawStoryKineticPass(ctx, width, height, palette, audioTime, beat, energy, onset, isPeakPhase ? 1.12 : 0.46, phase >= 6 ? -1 : 1);
    const vortexX = width * (phase >= 6 ? 0.7 : 0.28);
    const vortexY = height * 0.52;
    const fracture = isPeakPhase ? 1 : 0.38;
    const violetGlow = ctx.createRadialGradient(vortexX, vortexY, 0, vortexX, vortexY, width * 0.62);
    violetGlow.addColorStop(0, storyCanvasColor(palette.secondary, 0.08 + energy * 0.13 + beat.pulse * fracture * 0.1));
    violetGlow.addColorStop(0.48, storyCanvasColor(palette.primary, 0.035 + onset * 0.07));
    violetGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = violetGlow; ctx.fillRect(0, 0, width, height);
    for (let ring = 0; ring < 12; ring++) {
      ctx.beginPath();
      ctx.ellipse(vortexX, vortexY, width * (0.08 + ring * 0.045), height * (0.04 + ring * 0.027), audioTime * 0.018 * (ring % 2 ? 1 : -1) + ring * 0.3, 0, Math.PI * (1.2 + ring * 0.08));
      ctx.strokeStyle = storyCanvasColor(ring % 2 ? palette.secondary : palette.primary, 0.04 + energy * 0.09 + onset * 0.1 + beat.pulse * fracture * 0.035);
      ctx.lineWidth = dpr * (1 + (ring % 3 === 0 ? onset * 3 : 0)); ctx.stroke();
    }
    ctx.beginPath();
    for (let point = 0; point <= 32; point++) {
      const y = point / 32 * height;
      const x = width * 0.5 + Math.sin(point * 1.7 + audioTime * 0.35) * width * (0.012 + onset * 0.03);
      point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = storyCanvasColor(palette.secondary, 0.24 + onset * 0.42); ctx.lineWidth = dpr * (1.2 + onset * 4); ctx.stroke();
    for (let index = 0; index < (isPeakPhase ? 38 : 21); index++) {
      const orbit = audioTime * (0.035 + index % 5 * 0.006) + seededUnit(index * 12.3) * Math.PI * 2;
      const x = vortexX + Math.cos(orbit) * width * (0.12 + seededUnit(index * 29.8) * 0.34);
      const y = vortexY + Math.sin(orbit) * height * (0.08 + seededUnit(index * 39.4) * 0.28);
      ctx.save(); ctx.translate(x, y); ctx.rotate(orbit);
      ctx.strokeStyle = storyCanvasColor(index % 3 ? palette.primary : palette.accent, 0.06 + energy * 0.13 + onset * 0.12);
      ctx.strokeRect(-dpr * (4 + index % 5), -dpr * 2, dpr * (8 + index % 5 * 2), dpr * 4); ctx.restore();
    }
    for (let slash = 0; slash < (isPeakPhase ? 14 : 7); slash++) {
      const travel = ((audioTime * (0.07 + slash * 0.002) + seededUnit(slash * 8.7)) % 1.3) - 0.15;
      const y = seededUnit(slash * 31.4) * height;
      const length = width * (0.08 + seededUnit(slash * 19.1) * 0.16);
      ctx.beginPath(); ctx.moveTo(travel * width - length, y + (phase >= 6 ? -1 : 1) * length * 0.18); ctx.lineTo(travel * width, y);
      ctx.strokeStyle = storyCanvasColor(slash % 3 ? palette.primary : palette.accent, 0.035 + energy * 0.09 + fracture * beat.pulse * 0.08);
      ctx.lineWidth = dpr * (0.8 + onset * 2.2); ctx.stroke();
    }
    if (phase === 4) {
      ctx.fillStyle = storyCanvasColor(palette.accent, 0.035 + beat.pulse * 0.06);
      for (let lane = 0; lane < 9; lane++) ctx.fillRect(0, height * (0.12 + lane * 0.09), width * (0.2 + beat.pulse * 0.5), dpr * (1 + lane % 3));
    }
  } else if (variant === 'compass') {
    drawCompassTheaterFx(ctx, width, height, dpr, palette, audioTime, beat, energy, onset, phase, cx, cy);
  } else if (variant === 'celebration') {
    drawStoryKineticPass(ctx, width, height, palette, audioTime, beat, energy, onset, isPeakPhase ? 1.35 : 0.52, 1);
    const shift = (audioTime * (supportedLyricsData?.bpm || 123) / 60) % 1;
    for (let panel = -1; panel < 9; panel++) {
      const x = (panel + shift) * width / 7 - width * 0.12;
      ctx.save(); ctx.translate(x, height * 0.5); ctx.rotate(panel % 2 ? -0.16 : 0.16);
      ctx.fillStyle = storyCanvasColor(panel % 3 === 0 ? palette.secondary : panel % 3 === 1 ? palette.primary : palette.accent, 0.018 + energy * 0.045 + beat.pulse * peak * 0.04);
      ctx.fillRect(-width * 0.035, -height, width * 0.07, height * 2); ctx.restore();
    }
    const burstCount = peak > 0.5 ? 68 : 24;
    for (let index = 0; index < burstCount; index++) {
      const travel = (seededUnit(index * 11.7) + audioTime * (0.035 + index % 6 * 0.004)) % 1;
      const x = seededUnit(index * 27.4) * width + Math.sin(audioTime + index) * dpr * 12;
      const y = travel * height;
      ctx.save(); ctx.translate(x, y); ctx.rotate(audioTime * (0.4 + index % 4 * 0.12));
      ctx.fillStyle = storyCanvasColor(index % 4 === 0 ? palette.secondary : index % 3 === 0 ? palette.primary : palette.accent, (0.035 + energy * 0.18 + onset * 0.13) * peak);
      ctx.fillRect(-dpr * 2, -dpr * 5, dpr * 4, dpr * 10); ctx.restore();
    }
    for (let ring = 0; ring < 5; ring++) {
      const radius = (ring + 1) * Math.min(width, height) * 0.08 + beat.pulse * dpr * 9;
      ctx.beginPath(); ctx.arc(width * 0.32, height * 0.48, radius, 0, Math.PI * 2);
      ctx.strokeStyle = storyCanvasColor(ring % 2 ? palette.secondary : palette.primary, 0.035 + beat.pulse * peak * 0.1); ctx.lineWidth = dpr * (1 + onset * 3); ctx.stroke();
    }
    const jump = Math.sin(beat.phase * Math.PI);
    for (let badge = 0; badge < (isPeakPhase ? 16 : 8); badge++) {
      const x = width * (0.08 + seededUnit(badge * 17.3) * 0.84);
      const baseY = height * (0.18 + seededUnit(badge * 37.1) * 0.64);
      const y = baseY - jump * height * (0.012 + seededUnit(badge * 7.4) * 0.025) * (0.4 + peak);
      const size = dpr * (3 + badge % 5 + beat.pulse * peak * 4);
      drawStorySpark(ctx, x, y, size, badge % 3 ? palette.accent : palette.primary, 0.08 + energy * 0.14 + beat.pulse * peak * 0.18, audioTime * 0.18 + badge);
    }
  } else if (variant === 'psalm') {
    const horizon = height * 0.79;
    const skyLift = clamp(0, 1, phase / 9);
    const praise = isPeakPhase ? 1 : 0.24;
    drawStoryKineticPass(ctx, width, height, palette, audioTime, beat, energy, onset, isPeakPhase ? 1.28 : 0.38, phase % 2 ? 1 : -1);

    const glow = ctx.createRadialGradient(width * 0.52, horizon, 0, width * 0.52, horizon, width * 0.72);
    glow.addColorStop(0, storyCanvasColor(palette.primary, 0.15 + skyLift * 0.1 + energy * 0.09 + beat.pulse * praise * 0.12));
    glow.addColorStop(0.42, storyCanvasColor(palette.secondary, 0.04 + praise * 0.055));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);

    // Celestial ribbons turn the sky itself into the spectrum. They drift in
    // verses and widen into bright counter-moving bands during praise sections.
    for (let ribbon = 0; ribbon < (isPeakPhase ? 6 : 3); ribbon++) {
      const baseY = height * (0.12 + ribbon * 0.095);
      const amplitude = height * (0.018 + energy * 0.026 + praise * 0.018);
      ctx.beginPath();
      for (let point = 0; point <= 48; point++) {
        const progress = point / 48;
        const x = progress * width;
        const y = baseY + Math.sin(progress * Math.PI * (2.1 + ribbon * 0.16) + audioTime * (0.2 + ribbon * 0.025) * (ribbon % 2 ? -1 : 1)) * amplitude;
        point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = storyCanvasColor(ribbon % 3 === 0 ? palette.primary : ribbon % 3 === 1 ? palette.secondary : palette.accent, 0.055 + energy * 0.075 + praise * 0.075);
      ctx.lineWidth = dpr * (1.2 + energy * 2.2 + beat.pulse * praise * 1.8);
      ctx.shadowColor = storyCanvasColor(ribbon % 2 ? palette.secondary : palette.primary, 0.18 + praise * 0.12);
      ctx.shadowBlur = dpr * (5 + praise * 10);
      ctx.stroke(); ctx.shadowBlur = 0;
    }

    // The chorus opens a fan of light from the horizon; regular sections keep
    // a smaller moving canopy so the contrast is structural, not just brighter.
    const rayCount = isPeakPhase ? 20 : 8;
    for (let ray = 0; ray < rayCount; ray++) {
      const angle = -Math.PI * 0.91 + ray * (Math.PI * 0.82 / Math.max(1, rayCount - 1)) + Math.sin(audioTime * 0.16) * 0.025;
      const length = Math.hypot(width, height) * (0.58 + energy * 0.1);
      const spread = 0.012 + beat.pulse * praise * 0.012;
      ctx.beginPath(); ctx.moveTo(width * 0.52, horizon);
      ctx.lineTo(width * 0.52 + Math.cos(angle - spread) * length, horizon + Math.sin(angle - spread) * length);
      ctx.lineTo(width * 0.52 + Math.cos(angle + spread) * length, horizon + Math.sin(angle + spread) * length);
      ctx.closePath();
      ctx.fillStyle = storyCanvasColor(ray % 3 ? palette.secondary : palette.primary, 0.012 + energy * 0.018 + praise * (0.026 + beat.pulse * 0.035));
      ctx.fill();
    }

    ctx.fillStyle = storyCanvasColor([18, 20, 25], 0.7); ctx.beginPath(); ctx.moveTo(0, horizon);
    for (let point = 0; point <= 12; point++) ctx.lineTo(point / 12 * width, horizon - seededUnit(point * 31.2) * height * 0.055);
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
    const stars = (isPeakPhase ? 66 : 38) + Math.round(energy * (isPeakPhase ? 26 : 16));
    for (let index = 0; index < stars; index++) {
      const x = seededUnit(index * 18.9) * width;
      const y = seededUnit(index * 53.2) * horizon * 0.88;
      const twinkle = 0.5 + Math.sin(audioTime * (0.45 + index % 7 * 0.07) + index) * 0.5;
      if (isPeakPhase && index % 5 === 0) {
        const trail = dpr * (7 + energy * 12 + beat.pulse * 10);
        ctx.beginPath(); ctx.moveTo(x - trail, y + trail * 0.32); ctx.lineTo(x, y);
        ctx.strokeStyle = storyCanvasColor(index % 2 ? palette.secondary : palette.primary, 0.05 + energy * 0.12 + beat.pulse * 0.1);
        ctx.lineWidth = dpr; ctx.stroke();
      }
      drawStorySpark(ctx, x, y, dpr * (1.2 + index % 4 + beat.pulse * praise * 1.2), index % 4 ? palette.accent : palette.primary, 0.055 + twinkle * (0.1 + energy * 0.2) + beat.pulse * praise * 0.08, index);
    }

    // Constellation threads become legible only in the refrains, giving the
    // chorus a second visual identity beyond particle density.
    for (let link = 0; link < (isPeakPhase ? 22 : 7); link++) {
      const x1 = seededUnit(link * 18.9) * width;
      const y1 = seededUnit(link * 53.2) * horizon * 0.82;
      const x2 = seededUnit((link + 5) * 18.9) * width;
      const y2 = seededUnit((link + 5) * 53.2) * horizon * 0.82;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = storyCanvasColor(link % 2 ? palette.secondary : palette.primary, 0.018 + energy * 0.035 + praise * beat.pulse * 0.04);
      ctx.lineWidth = dpr * 0.8; ctx.stroke();
    }

    const period = 60 / (supportedLyricsData?.bpm || 117.454);
    for (let arc = 0; arc < 7; arc++) {
      const age = (beat.phase + arc) * period;
      const progress = age / 1.72;
      if (progress >= 1) continue;
      const eased = 1 - (1 - progress) ** 2.3;
      const life = Math.sin(progress * Math.PI);
      ctx.beginPath();
      ctx.arc(width * 0.52, horizon, Math.min(width, height) * (0.09 + eased * 0.92), Math.PI, Math.PI * 2);
      ctx.strokeStyle = storyCanvasColor(arc % 2 ? palette.secondary : palette.primary, life * (0.055 + energy * 0.08 + praise * 0.1));
      ctx.lineWidth = dpr * (1 + onset * 2.8 + praise * beat.pulse * 1.4); ctx.stroke();
    }

    if (isPeakPhase) {
      const praiseWash = ctx.createLinearGradient(0, height, width, 0);
      praiseWash.addColorStop(0, storyCanvasColor(palette.deep, 0));
      praiseWash.addColorStop(0.52, storyCanvasColor(palette.primary, 0.035 + beat.pulse * 0.07 + onset * 0.045));
      praiseWash.addColorStop(1, storyCanvasColor(palette.secondary, 0.025 + energy * 0.055));
      ctx.fillStyle = praiseWash; ctx.fillRect(0, 0, width, height);
    }
  } else if (variant === 'dusty') {
    drawStoryKineticPass(ctx, width, height, palette, audioTime, beat, energy, onset, isPeakPhase ? 1.08 : 0.34, phase >= 7 ? -1 : 1);
    const revival = isPeakPhase ? 1 : 0.22;
    const windowCount = 3;
    for (let index = 0; index < windowCount; index++) {
      const x = width * (0.14 + index * 0.27);
      const top = height * (0.13 + (index % 2) * 0.04);
      const winWidth = width * 0.12;
      const winHeight = height * 0.43;
      ctx.beginPath(); ctx.moveTo(x - winWidth / 2, top + winWidth / 2); ctx.arc(x, top + winWidth / 2, winWidth / 2, Math.PI, 0); ctx.lineTo(x + winWidth / 2, top + winHeight); ctx.lineTo(x - winWidth / 2, top + winHeight); ctx.closePath();
      const light = ctx.createLinearGradient(x, top, x, top + winHeight);
      light.addColorStop(0, storyCanvasColor(palette.accent, 0.11 + energy * 0.15 + beat.pulse * revival * 0.1)); light.addColorStop(1, storyCanvasColor(palette.primary, 0.025));
      ctx.fillStyle = light; ctx.fill(); ctx.strokeStyle = storyCanvasColor(palette.secondary, 0.16); ctx.lineWidth = dpr * 2; ctx.stroke();
      const ray = ctx.createLinearGradient(x, top, x + winWidth * 2.5, height);
      ray.addColorStop(0, storyCanvasColor(palette.primary, 0.075 + energy * 0.12 + revival * 0.07)); ray.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ray; ctx.beginPath(); ctx.moveTo(x - winWidth * 0.45, top + winHeight); ctx.lineTo(x + winWidth * 0.45, top + winHeight); ctx.lineTo(x + winWidth * 2.7, height); ctx.lineTo(x + winWidth * 1.3, height); ctx.closePath(); ctx.fill();
    }
    const dustCount = isPeakPhase ? 74 : 42;
    for (let index = 0; index < dustCount; index++) {
      const x = (seededUnit(index * 22.7) + Math.sin(audioTime * (0.1 + index % 5 * 0.007) + index) * 0.018) * width;
      const y = (seededUnit(index * 61.2) + audioTime * (0.003 + index % 5 * 0.00055)) % 1 * height;
      const alpha = 0.03 + energy * 0.14 + beat.pulse * revival * 0.09;
      if (isPeakPhase && index % 6 === 0) {
        ctx.beginPath(); ctx.moveTo(x - dpr * 11, y + dpr * 5); ctx.lineTo(x, y);
        ctx.strokeStyle = storyCanvasColor(palette.primary, alpha * 0.72); ctx.lineWidth = dpr; ctx.stroke();
      }
      ctx.fillStyle = storyCanvasColor(index % 5 ? palette.primary : palette.accent, alpha);
      ctx.beginPath(); ctx.arc(x, y, dpr * (0.9 + index % 3 * 0.62 + beat.pulse * revival), 0, Math.PI * 2); ctx.fill();
    }

    // Open-page echoes flip across the right side; during the chorus they
    // multiply into a rhythmic wall instead of merely making the dust brighter.
    const pageCount = isPeakPhase ? 14 : 6;
    for (let page = 0; page < pageCount; page++) {
      const column = page % 2;
      const row = Math.floor(page / 2);
      const x = width * (0.7 + column * 0.08) + Math.sin(audioTime * 0.32 + page) * width * 0.008;
      const y = height * (0.1 + row * 0.09);
      const open = 0.7 + Math.sin(audioTime * 0.5 + page * 0.7) * 0.3;
      ctx.save(); ctx.translate(x, y); ctx.rotate((column ? 1 : -1) * 0.08 * open);
      ctx.strokeStyle = storyCanvasColor(page % 3 ? palette.secondary : palette.primary, 0.045 + energy * 0.07 + revival * 0.08 + beat.pulse * revival * 0.07);
      ctx.lineWidth = dpr * (0.8 + onset * 1.4);
      ctx.strokeRect(-width * 0.028, -height * 0.024, width * 0.056, height * 0.048);
      ctx.beginPath(); ctx.moveTo(0, -height * 0.024); ctx.lineTo(0, height * 0.024); ctx.stroke(); ctx.restore();
    }
    if (isPeakPhase) {
      const openGlow = ctx.createRadialGradient(width * 0.52, height * 0.58, 0, width * 0.52, height * 0.58, width * 0.55);
      openGlow.addColorStop(0, storyCanvasColor(palette.primary, 0.055 + energy * 0.08 + beat.pulse * 0.09));
      openGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = openGlow; ctx.fillRect(0, 0, width, height);
    }
  }

  drawStoryPulseRings(ctx, cx, cy, width, height, palette, audioTime, energy, onset, isPeakPhase ? (variant === 'waiting' ? 1.75 : 1.35) : 0.36);
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, width * 0.08, width * 0.5, height * 0.48, width * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, variant === 'waiting' ? 'rgba(66,35,38,0.16)' : 'rgba(0,0,0,0.48)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
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
  if (theme === 'omb') {
    drawOneMoreBiteFx(levels, currentCalibratedTime());
    return;
  }
  if (theme === 'hero-story') {
    drawHeroStoryFx(levels, currentCalibratedTime());
    return;
  }
  if (theme === 'encore-dance') {
    drawEncoreDanceFx(levels, currentCalibratedTime());
    return;
  }
  if (theme === 'story-theater') {
    drawStoryTheaterFx(levels, currentCalibratedTime());
    return;
  }

  const quietGate = smoothStep(0.12, 0.42, levels.motion);
  const party = smoothStep(0.22, 0.78, levels.motion);
  const profile = effectProfileForSong();
  if (!profile?.constantRings && quietGate <= 0.01 && levels.glow <= 0.02) return;

  // Anchor rings to the real hero play button (progress ring rim), not canvas midpoint
  const hero = getHeroFxAnchor(canvas);
  const fxRect = canvas.getBoundingClientRect();
  const sx = hero?.sx ?? (fxRect.width ? canvas.width / fxRect.width : 1);
  const sy = hero?.sy ?? (fxRect.height ? canvas.height / fxRect.height : 1);
  const cx = hero?.cx ?? w * 0.5;
  const cy = hero?.cy ?? h * 0.5;
  // Radius matches CSS hero-play + ::before progress ring
  const radius = hero?.radius ?? Math.min(w, h) * (0.12 + party * 0.02);
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
    drawDiscoFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, radius);
    return;
  }
  if (theme === 'ddlc') {
    drawDdlcFx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, radius);
    return;
  }
  if (theme === 'teto11') {
    drawTeto11Fx(ctx, w, h, cx, cy, levels, profile, fxTime, section, sectionPower, chorusPower, beatPulse, protectedPoint, radius);
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
    // Start at hero progress-ring rim; expand outward from the play button
    baseRadius: radius,
    travelRadius: Math.max(radius * 1.8, Math.min(w, h) * (0.22 + pulseLevel * 0.12 + chorusPower * 0.1)),
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

function retryCurrentSongAfterError(el) {
  if (!audioElementMatchesCurrentSong(el)) return;
  const song = currentSong();
  const attemptSerial = playbackAttemptSerial;
  const queuedIndex = queueIndex;
  const resumeAt = Number.isFinite(el.currentTime) ? el.currentTime : 0;
  if (playbackRetryCount >= 2) {
    pauseCalibratedClock(song);
    showToast('!', `Could not play ${song.title || song.displayName}`);
    return;
  }
  playbackRetryCount++;
  showToast('↻', `Retrying ${song.title || song.displayName} (${playbackRetryCount}/2)`);
  clearTimeout(playbackRetryTimer);
  playbackRetryTimer = setTimeout(() => {
    if (attemptSerial !== playbackAttemptSerial || queuedIndex !== queueIndex || currentSong() !== song || el !== audio) return;
    const retryUrl = new URL(song.url, window.location.href);
    retryUrl.searchParams.set('_vp_retry', `${Date.now()}-${playbackRetryCount}`);
    try {
      el.pause();
      el.src = retryUrl.href;
      el.load();
      resetCalibratedClock(resumeAt, song);
      const restoreTime = () => {
        if (el !== audio) return;
        try { if (resumeAt > 0.05) el.currentTime = resumeAt; } catch (_) {}
        el.removeEventListener('loadedmetadata', restoreTime);
      };
      el.addEventListener('loadedmetadata', restoreTime);
      resumeAudioFromCalibratedClock(song).catch(err => console.warn('Audio retry failed:', err));
    } catch (err) {
      console.warn('Audio retry setup failed:', err);
    }
  }, 350);
}

function bindAudioElementEvents(el) {
  if (!el || el.dataset.vpBound === '1') return;
  el.dataset.vpBound = '1';
  ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'stalled', 'suspend', 'ended', 'error'].forEach(eventName => {
    el.addEventListener(eventName, () => {
      if (el !== audio) return;
      noteMediaEvent(eventName);
    }, { capture: true });
  });

  // Progress is driven by startProgressClock() while playing — not by visualizer rAF
  // and not only by sparse timeupdate (which feels late under load).
  el.addEventListener('timeupdate', () => {
    if (el !== audio) return;
    if (!progressTimer) updatePlaybackVisuals();
  });
  el.addEventListener('loadedmetadata', () => {
    if (el !== audio) return;
    syncCalibratedClockToNative();
    updatePlaybackVisuals();
  });
  el.addEventListener('seeking', () => {
    if (el !== audio) return;
    syncCalibratedClockToNative(currentSong(), { allowBackward: !!seekTransaction, keepRunning: false });
    updatePlaybackVisuals();
  });
  el.addEventListener('seeked', () => {
    if (el !== audio) return;
    syncCalibratedClockToNative(currentSong(), { allowBackward: !!seekTransaction, consumePending: true, keepRunning: false });
    updatePlaybackVisuals();
    spatialForcePaint = true;
    if (spatialActive) paintSpatialGuide(currentCalibratedTime(), true);
    if (seekTransaction?.finishOnSeeked) finishSeekTransaction();
  });
  el.addEventListener('ratechange', () => {
    if (el !== audio) return;
    pauseCalibratedClock();
    if (!el.paused && !el.seeking && el.readyState >= 3) startCalibratedClock();
  });
  el.addEventListener('waiting', () => {
    if (el !== audio) return;
    pauseCalibratedClock();
  });
  el.addEventListener('playing', () => {
    if (el !== audio) return;
    startCalibratedClock();
  });
  el.addEventListener('ended', () => {
    if (!audioElementMatchesCurrentSong(el)) return;
    pauseCalibratedClock();
    playNext(true);
  });
  el.addEventListener('play', () => {
    if (el !== audio) return;
    $('play').textContent = '⏸';
    $('hero-play').classList.add('playing');
    $('hero-play').querySelector('.hero-icon').textContent = '⏸';
    const ddfIcon = $('ddf-play-icon');
    if (ddfIcon) ddfIcon.textContent = '⏸';
    const ombIcon = $('omb-play-icon');
    if (ombIcon) ombIcon.textContent = '⏸';
    const heroStoryIcon = $('hero-story-play-icon');
    if (heroStoryIcon) heroStoryIcon.textContent = '⏸';
    const encoreIcon = $('encore-play-icon');
    if (encoreIcon) encoreIcon.textContent = '⏸';
    const storyIcon = $('story-play-icon');
    if (storyIcon) storyIcon.textContent = '⏸';
    document.body.classList.add('is-playing');
    startProgressClock();
    startWaveform();
    updatePlaybackVisuals();
    updateFxState();
    syncSpatialLoop();
  });
  el.addEventListener('pause', () => {
    if (el !== audio) return;
    pauseCalibratedClock();
    $('play').textContent = '▶';
    $('hero-play').classList.remove('playing');
    $('hero-play').querySelector('.hero-icon').textContent = '▶';
    const ddfIcon = $('ddf-play-icon');
    if (ddfIcon) ddfIcon.textContent = '▶';
    const ombIcon = $('omb-play-icon');
    if (ombIcon) ombIcon.textContent = '▶';
    const heroStoryIcon = $('hero-story-play-icon');
    if (heroStoryIcon) heroStoryIcon.textContent = '▶';
    const encoreIcon = $('encore-play-icon');
    if (encoreIcon) encoreIcon.textContent = '▶';
    const storyIcon = $('story-play-icon');
    if (storyIcon) storyIcon.textContent = '▶';
    document.body.classList.remove('is-playing');
    stopProgressClock();
    updatePlaybackVisuals();
    updateFxState();
    drawWaveform(true);
    syncSpatialLoop();
  });
  el.addEventListener('error', () => {
    if (el !== audio) return;
    console.warn('Audio error for', el.src);
    retryCurrentSongAfterError(el);
  });
}
bindAudioElementEvents(audio);

$('play').addEventListener('click', togglePlay);
$('hero-play').addEventListener('click', togglePlay);
const ddfPlayBtn = $('ddf-play');
if (ddfPlayBtn) ddfPlayBtn.addEventListener('click', togglePlay);
const ombPlayBtn = $('omb-play');
if (ombPlayBtn) ombPlayBtn.addEventListener('click', togglePlay);
const heroStoryPlayBtn = $('hero-story-play');
if (heroStoryPlayBtn) heroStoryPlayBtn.addEventListener('click', togglePlay);
const encorePlayBtn = $('encore-play');
if (encorePlayBtn) encorePlayBtn.addEventListener('click', togglePlay);
const storyPlayBtn = $('story-play');
if (storyPlayBtn) storyPlayBtn.addEventListener('click', togglePlay);
$('next').addEventListener('click', () => playNext(false));
$('prev').addEventListener('click', playPrev);
$('shuffle').addEventListener('click', toggleShuffle);
$('loop').addEventListener('click', cycleLoop);
$('refresh').addEventListener('click', loadLibrary);
bindLibraryActionGuards();

const seekEl = $('seek');
let activeSeekPointerId = null;

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

function seekTargetFromPointer(event) {
  const duration = effectiveDuration();
  const rect = seekEl.getBoundingClientRect();
  if (!duration || rect.width <= 0 || !Number.isFinite(event.clientX)) return null;
  return clamp(0, duration, ((event.clientX - rect.left) / rect.width) * duration);
}

function previewSeekPointer(event) {
  const targetTime = seekTargetFromPointer(event);
  const duration = effectiveDuration();
  if (targetTime === null || !duration) return;
  seekEl.value = String((targetTime / duration) * 100);
  previewSeekTarget(targetTime);
}

function beginSeekPointer(event) {
  if (event.button !== undefined && event.button !== 0) return;
  activeSeekPointerId = event.pointerId;
  beginSeekTransaction();
  previewSeekPointer(event);
  try { seekEl.setPointerCapture(event.pointerId); } catch (_) {}
}

function moveSeekPointer(event) {
  if (event.pointerId !== activeSeekPointerId) return;
  previewSeekPointer(event);
}

function finishSeekPointer(event) {
  if (event.pointerId !== activeSeekPointerId) return;
  previewSeekPointer(event);
  activeSeekPointerId = null;
  try { seekEl.releasePointerCapture(event.pointerId); } catch (_) {}
  commitSeekTransaction(true);
}

function cancelSeekPointer(event) {
  if (event.pointerId !== activeSeekPointerId) return;
  activeSeekPointerId = null;
  try { seekEl.releasePointerCapture(event.pointerId); } catch (_) {}
  commitSeekTransaction(true);
}

seekEl.addEventListener('pointerdown', beginSeekPointer);
seekEl.addEventListener('pointermove', moveSeekPointer);
seekEl.addEventListener('input', handleSeekPreview);
seekEl.addEventListener('change', handleSeekCommit);
seekEl.addEventListener('pointerup', finishSeekPointer);
seekEl.addEventListener('pointercancel', cancelSeekPointer);

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
  if (song && !usesNativeAudioPath(song)) {
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

const equalizerOpenButton = $('equalizer-open');
const equalizerBackdrop = $('equalizer-backdrop');
const equalizerCloseButton = $('equalizer-close');
function openEqualizer() {
  settingsMenu?.classList.add('hidden');
  equalizerBackdrop?.classList.remove('hidden');
  renderEqualizerUi();
}
function closeEqualizer() {
  equalizerBackdrop?.classList.add('hidden');
}
if (equalizerOpenButton) equalizerOpenButton.addEventListener('click', openEqualizer);
if (equalizerCloseButton) equalizerCloseButton.addEventListener('click', closeEqualizer);
if (equalizerBackdrop) {
  equalizerBackdrop.addEventListener('click', event => {
    if (event.target === equalizerBackdrop) closeEqualizer();
  });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !equalizerBackdrop?.classList.contains('hidden')) closeEqualizer();
});
document.querySelectorAll('[data-eq-mode]').forEach(button => {
  button.addEventListener('click', () => {
    eqEditMode = button.dataset.eqMode;
    renderEqualizerUi();
  });
});
const eqEnabledCheckbox = $('eq-enabled');
if (eqEnabledCheckbox) {
  eqEnabledCheckbox.addEventListener('change', () => {
    updateEditableEqProfile(profile => { profile.enabled = eqEnabledCheckbox.checked; });
  });
}
const eqPresetSelect = $('eq-preset');
if (eqPresetSelect) {
  eqPresetSelect.addEventListener('change', () => {
    const preset = EQ_PRESETS[eqPresetSelect.value];
    if (!preset) return;
    updateEditableEqProfile(profile => {
      profile.enabled = true;
      profile.preamp = preset.preamp;
      profile.gains = preset.gains.slice();
    });
  });
}
const eqResetButton = $('eq-reset');
if (eqResetButton) {
  eqResetButton.addEventListener('click', () => {
    updateEditableEqProfile(profile => {
      profile.enabled = false;
      profile.preamp = 0;
      profile.gains = EQ_BANDS.map(() => 0);
    });
  });
}
buildEqualizerBands();
renderEqualizerUi();

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
  const missingCount = songIds.length - playable.length;
  if (playable.length === 0) {
    showToast('!', 'No playable songs in this playlist.');
    return;
  }
  if (missingCount > 0) {
    showToast('!', `${missingCount} missing playlist ${missingCount === 1 ? 'song' : 'songs'} kept in place`);
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
