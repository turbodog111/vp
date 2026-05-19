const REPO_OWNER = 'turbodog111';
const REPO_NAME = 'vp';
const COLLECTIONS = [
  { id: 'secular', label: 'Secular', folder: 'songs' },
  { id: 'christian', label: 'Christian', folder: 'songs/christian' }
];
const COLLECTION_ORDER = new Map(COLLECTIONS.map((collection, index) => [collection.id, index]));

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
let addToActionOpenedAt = 0;
let pendingPlaylistSongIdx = null;
let audioCtx = null;
let audioSource = null;
let analyser = null;
let outputGain = null;
let waveData = null;
let waveTimeData = null;
let waveRaf = null;
let waveBars = [];
let smoothedLevel = 0;
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
const WAVE_BAR_COUNT = 84;
const WAVE_GAIN = 1.34;
const WAVE_SOFT_LIMIT = 0.94;
const WAVE_LEVEL_WINDOW = 180;
const WAVE_MIN_FREQ = 55;
const WAVE_MAX_FREQ = 14000;
const AUDIO_FILE_RE = /\.(mp3|m4a)$/i;
const AUDIO_EXTENSION_RE = /\.(mp3|m4a)$/i;
const PENTHOUSE_EFFECT_PROFILE = {
  bpm: 123,
  key: 'F# major',
  beatOffset: 0,
  sections: [
    {name: 'Intro', start: 0, end: 51, intensity: 0.24, chorus: false},
    {name: 'First chorus', start: 52.27, end: 84.01, intensity: 1, chorus: true, fade: 0.5},
    {name: 'Altered second chorus', start: 128.89, end: 148.37, intensity: 0.92, chorus: true, fade: 0.5},
    {name: 'Last chorus', start: 179.5, end: 211.38, intensity: 1.08, chorus: true, fade: 0.5},
  ],
};
const SONG_EFFECT_PROFILES = {
  'songs/Penthouse - One, Two, Three (一二三).mp3': PENTHOUSE_EFFECT_PROFILE,
  'songs/Penthouse - One, Two, Three (一二三).m4a': PENTHOUSE_EFFECT_PROFILE,
};
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
  try { return JSON.parse(localStorage.getItem('vp_playlists') || '{}'); }
  catch { return {}; }
}
function savePlaylists() {
  localStorage.setItem('vp_playlists', JSON.stringify(playlists));
}

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

function effectiveDuration(song = currentSong()) {
  return Math.max(nativeAudioDuration(), audio.currentTime || 0);
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
    resetCalibratedClock(calibratedFromNativeTime(audio.currentTime || 0, song), song);
  }
}

function currentCalibratedTime(song = currentSong()) {
  ensureCalibratedClock(song);
  let time = calibratedBaseTime;
  if (calibratedClockRunning && !audio.paused) {
    time += Math.max(0, performance.now() / 1000 - calibratedBasePerf);
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
  const diff = Math.abs((audio.currentTime || 0) - nativeTarget);
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
  } else {
    nextTime = calibratedFromNativeTime(audio.currentTime || 0, song);
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

function resumeAudioFromCalibratedClock(song = currentSong()) {
  ensureAudioGraph();
  ensureCalibratedClock(song);
  calibratedBaseTime = currentCalibratedTime(song);
  calibratedBasePerf = performance.now() / 1000;
  calibratedClockRunning = false;
  return audio.play();
}

function effectSectionAt(profile, time) {
  if (!profile || !Number.isFinite(time)) return null;
  const section = profile.sections.find(item => time >= item.start && time <= item.end);
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

function isTetoFxActive(song = currentSong()) {
  return !!(tetoFxEnabled && song && song.collection === 'secular');
}

function setTetoFxEnabled(enabled) {
  tetoFxEnabled = !!enabled;
  localStorage.setItem('vp_teto_fx_enabled', tetoFxEnabled ? 'true' : 'false');
  const checkbox = $('teto-fx-enabled');
  if (checkbox) checkbox.checked = tetoFxEnabled;
  updateFxState();
}

function updateFxState(levelOverride = tetoGlowLevel) {
  const active = isTetoFxActive();
  const level = active && !audio.paused ? levelOverride : 0;
  document.body.classList.toggle('teto-fx-active', active);
  document.body.style.setProperty('--teto-level', level.toFixed(3));
}

function switchView(view) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'playlists') renderPlaylists();
  if (view === 'now') {
    resizeWaveform();
    resizeFxCanvas();
  }
}

function filteredLibraryEntries(filter = '') {
  const q = filter.toLowerCase().trim();
  return library
    .map((song, idx) => ({ song, idx }))
    .filter(({ song }) => activeCollection === 'all' || song.collection === activeCollection)
    .filter(({ song }) => !q || song.displayName.toLowerCase().includes(q));
}

async function fetchCollection(collection) {
  const apiPath = encodePath(collection.folder);
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${apiPath}?ref=main`;
  const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  const items = await res.json();
  return preferredAudioFiles(items)
    .map(i => {
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
    badge.textContent = song.collectionLabel;
    badge.classList.add(song.collection);
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
  ensureAudioGraph();
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
  if (song.collectionLabel) parts.push(song.collectionLabel);
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
}

function updateUpNext() {
  const nextIdx = queueIndex + 1 < queue.length ? queue[queueIndex + 1] : (loopMode === 'all' && queue.length ? queue[0] : -1);
  const next = library[nextIdx];
  $('queue-next').textContent = next ? next.displayName : 'End of queue';
}

function updatePlaybackVisuals() {
  const current = currentCalibratedTime();
  const duration = effectiveDuration();
  const pct = duration ? clamp(0, 1, current / duration) : 0;
  const deg = `${pct * 360}deg`;
  $('play').style.setProperty('--progress', deg);
  $('hero-play').style.setProperty('--progress', deg);
  $('time-current').textContent = fmtTime(current);
  $('time-total').textContent = fmtTime(duration);
  $('seek').value = pct * 100;
  $('hero-time-current').textContent = fmtTime(current);
  $('hero-time-total').textContent = fmtTime(duration);
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

function ensureAudioGraph() {
  if (analyser) {
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioCtx = new AudioContextClass();
  audioSource = audioCtx.createMediaElementSource(audio);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.minDecibels = -92;
  analyser.maxDecibels = -18;
  analyser.smoothingTimeConstant = 0.36;
  outputGain = audioCtx.createGain();
  outputGain.gain.value = playerVolume;
  waveData = new Float32Array(analyser.frequencyBinCount);
  waveTimeData = new Uint8Array(analyser.fftSize);
  audio.volume = 1;
  audioSource.connect(analyser);
  analyser.connect(outputGain);
  outputGain.connect(audioCtx.destination);
  startWaveform();
}

function resizeWaveform() {
  const canvas = $('waveform');
  if (!canvas) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.max(120, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function resizeFxCanvas() {
  const canvas = $('teto-fx');
  const view = $('view-now');
  if (!canvas || !view) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = view.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.max(320, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function startWaveform() {
  if (waveRaf) return;
  const draw = () => {
    waveRaf = requestAnimationFrame(draw);
    drawWaveform();
  };
  draw();
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
  const blendedEnergy = Math.max(0.00002, rms * 0.72 + peak * 0.28);
  const db = 20 * Math.log10(blendedEnergy);
  waveLevelWindow.push(db);
  if (waveLevelWindow.length > WAVE_LEVEL_WINDOW) waveLevelWindow.shift();

  const sorted = [...waveLevelWindow].sort((a, b) => a - b);
  const floorDb = percentile(sorted, 0.18);
  const peakDb = percentile(sorted, 0.92);
  const dynamicSpan = Math.max(2.8, peakDb - floorDb);
  const relativeLevel = clamp(0, 1, (db - floorDb) / dynamicSpan);
  const absoluteLevel = smoothStep(-44, -14, db);
  const gatedRelative = smoothStep(0.12, 0.92, relativeLevel);
  return clamp(0, 1, Math.max(gatedRelative, absoluteLevel * 0.18));
}

function waveBaseShape(i, total) {
  const x = total <= 1 ? 0.5 : i / (total - 1);
  const edgeTaper = Math.sin(Math.PI * x);
  const centerLift = 1 - Math.abs(x - 0.5) * 0.42;
  const slowLobes = 0.76 + 0.14 * Math.sin(x * Math.PI * 5.2) + 0.1 * Math.sin(x * Math.PI * 9.6 + 0.8);
  return clamp(0.16, 1, (0.22 + edgeTaper * 0.78) * centerLift * slowLobes);
}

function waveBandEnergy(index, total) {
  if (!analyser || !waveData || !audioCtx) return 0;
  const nyquist = audioCtx.sampleRate / 2;
  const maxFreq = Math.min(WAVE_MAX_FREQ, nyquist * 0.92);
  const t0 = index / total;
  const t1 = (index + 1) / total;
  const f0 = WAVE_MIN_FREQ * Math.pow(maxFreq / WAVE_MIN_FREQ, t0);
  const f1 = WAVE_MIN_FREQ * Math.pow(maxFreq / WAVE_MIN_FREQ, t1);
  const bin0 = clamp(0, waveData.length - 1, Math.floor(f0 / nyquist * waveData.length));
  const bin1 = clamp(bin0 + 1, waveData.length, Math.ceil(f1 / nyquist * waveData.length));
  let sum = 0;
  let count = 0;
  for (let b = bin0; b < bin1; b++) {
    sum += waveData[b];
    count++;
  }
  const avgDb = count ? sum / count : analyser.minDecibels;
  const normalized = (avgDb - analyser.minDecibels) / (analyser.maxDecibels - analyser.minDecibels);
  return easeOutCubic(normalized);
}

function ensureWaveBars(count) {
  if (waveBars.length === count) return;
  waveBars = Array.from({length: count}, (_, i) => waveBaseShape(i, count) * 0.018);
}

function resetWaveEnvelope() {
  smoothedLevel = 0;
  tetoFxLevel = 0;
  tetoGlowLevel = 0;
  tetoRiseEnergy = 0;
  lastTetoAmplitude = 0;
  waveLevelWindow = [];
  waveBars = waveBars.map((_, i) => waveBaseShape(i, waveBars.length) * 0.01);
  updateFxState();
}

function smoothTetoFxLevels(level) {
  const audible = !!(isTetoFxActive() && audio.src && !audio.paused);
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

function drawTetoFx(level) {
  const canvas = $('teto-fx');
  const view = $('view-now');
  if (!canvas || !view) return;
  resizeFxCanvas();
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const levels = smoothTetoFxLevels(level);
  updateFxState(levels.glow);
  if (!isTetoFxActive()) return;

  const quietGate = smoothStep(0.12, 0.42, levels.motion);
  const party = smoothStep(0.22, 0.78, levels.motion);
  if (quietGate <= 0.01 && levels.glow <= 0.02) return;

  const fxRect = canvas.getBoundingClientRect();
  const heroRect = $('hero-play').getBoundingClientRect();
  const sx = fxRect.width ? canvas.width / fxRect.width : 1;
  const sy = fxRect.height ? canvas.height / fxRect.height : 1;
  const cx = (heroRect.left - fxRect.left + heroRect.width / 2) * sx;
  const cy = (heroRect.top - fxRect.top + heroRect.height / 2) * sy;
  const radius = Math.min(w, h) * (0.16 + party * 0.035);
  const t = performance.now() / 1000;
  const profile = effectProfileForSong();
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

  const ringSpeed = profile?.bpm ? profile.bpm / 60 : 0.12 + party * 0.16;
  const ringCount = 5;
  for (let j = 0; j < ringCount; j++) {
    const phase = (t * ringSpeed + j / ringCount) % 1;
    const fade = Math.pow(1 - phase, 1.55);
    const ringRadius = radius * (0.95 + phase * (2.4 + pulseLevel * 1.35));
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, ${112 + j * 16}, 48, ${fade * (0.025 + pulseLevel * 0.2 + chorusPower * beatPulse * 0.12)})`;
    ctx.lineWidth = Math.max(1, (1.2 + pulseLevel * 3.4) * (1 - phase * 0.34) * sx);
    ctx.stroke();
  }

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

function drawWaveform() {
  const canvas = $('waveform');
  if (!canvas) return;
  resizeWaveform();
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  if (isTetoFxActive()) {
    gradient.addColorStop(0, 'rgba(132, 42, 28, 0.32)');
    gradient.addColorStop(0.32, 'rgba(255, 93, 55, 0.88)');
    gradient.addColorStop(0.58, 'rgba(255, 150, 45, 0.98)');
    gradient.addColorStop(1, 'rgba(172, 111, 48, 0.72)');
  } else {
    gradient.addColorStop(0, 'rgba(94, 234, 212, 0.25)');
    gradient.addColorStop(0.48, 'rgba(94, 234, 212, 0.95)');
    gradient.addColorStop(1, 'rgba(253, 230, 138, 0.62)');
  }

  const bins = WAVE_BAR_COUNT;
  ensureWaveBars(bins);
  const isAudible = !!(analyser && waveData && waveTimeData && !audio.paused);
  if (isAudible) {
    analyser.getFloatFrequencyData(waveData);
    analyser.getByteTimeDomainData(waveTimeData);
  }

  const mid = h * 0.54;
  const barGap = Math.max(2, Math.round(w / 260));
  const barW = Math.max(3, Math.floor(w / bins) - barGap);
  let rmsEnergy = 0;
  let peakEnergy = 0;
  const bandTargets = new Array(bins).fill(0);
  if (isAudible) {
    for (let i = 0; i < waveTimeData.length; i++) {
      const centered = (waveTimeData[i] - 128) / 128;
      peakEnergy = Math.max(peakEnergy, Math.abs(centered));
      rmsEnergy += centered * centered;
    }
    rmsEnergy = Math.sqrt(rmsEnergy / Math.max(1, waveTimeData.length));
    for (let i = 0; i < bins; i++) {
      bandTargets[i] = waveBandEnergy(i, bins);
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
    waveLevelWindow = [];
  } else {
    tetoRiseEnergy *= 0.86;
    lastTetoAmplitude = 0;
  }

  for (let i = 0; i < bins; i++) {
    if (isAudible) {
      const shape = waveBaseShape(i, bins);
      const left = bandTargets[Math.max(0, i - 1)];
      const center = bandTargets[i];
      const right = bandTargets[Math.min(bins - 1, i + 1)];
      const bandEnergy = left * 0.16 + center * 0.68 + right * 0.16;
      const staticTexture = 0.02 * Math.sin(i * 0.73);
      const bandContrast = Math.pow(bandEnergy, 1.45);
      const breathing = Math.pow(smoothedLevel, 1.12);
      const target = 0.004 + shape * breathing * (0.2 + bandContrast * 1.6 + staticTexture);
      const rate = target > waveBars[i] ? 0.72 : 0.4;
      waveBars[i] = waveBars[i] * (1 - rate) + target * rate;
    } else if (!audio.src) {
      waveBars[i] = waveBars[i] * 0.99 + waveBaseShape(i, bins) * 0.08 * 0.01;
    }
    const amp = Math.max(0.005, softLimit(Math.max(0, waveBars[i] * WAVE_GAIN), WAVE_SOFT_LIMIT));
    const x = i * (w / bins);
    const barH = Math.max(2, amp * h * 0.74);
    const radius = Math.min(8, barW / 2);
    ctx.fillStyle = gradient;
    roundedBar(ctx, x, mid - barH / 2, barW, barH, radius);
  }

  $('hero-play').style.setProperty('--level', smoothedLevel.toFixed(3));
  if (audio.src) updatePlaybackVisuals();
  drawTetoFx(smoothedLevel);
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

audio.addEventListener('timeupdate', () => {
  updatePlaybackVisuals();
});
audio.addEventListener('loadedmetadata', () => {
  syncCalibratedClockToNative();
  updatePlaybackVisuals();
});
audio.addEventListener('seeking', () => {
  syncCalibratedClockToNative(currentSong(), {allowBackward: false, keepRunning: false});
  updatePlaybackVisuals();
});
audio.addEventListener('seeked', () => {
  syncCalibratedClockToNative(currentSong(), {allowBackward: false, consumePending: true, keepRunning: false});
  updatePlaybackVisuals();
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
  startWaveform();
  updatePlaybackVisuals();
  updateFxState();
});
audio.addEventListener('pause', () => {
  pauseCalibratedClock();
  $('play').textContent = '▶';
  $('hero-play').classList.remove('playing');
  $('hero-play').querySelector('.hero-icon').textContent = '▶';
  document.body.classList.remove('is-playing');
  updatePlaybackVisuals();
  updateFxState();
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

$('seek').addEventListener('input', (e) => {
  const duration = effectiveDuration();
  if (!duration) return;
  const targetTime = (parseFloat(e.target.value) / 100) * duration;
  resetCalibratedClock(targetTime);
  if (!setNativeTimeFromCalibratedClock(targetTime, currentSong(), {force: true})) {
    audio.currentTime = nativeFromCalibratedTime(targetTime);
  }
  updatePlaybackVisuals();
});

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
  if (outputGain && audioCtx) {
    outputGain.gain.cancelScheduledValues(audioCtx.currentTime);
    outputGain.gain.setTargetAtTime(playerVolume, audioCtx.currentTime, 0.015);
    audio.volume = 1;
  } else {
    audio.volume = playerVolume;
  }
  updateVolumeIcon(playerVolume);
  if (notify) {
    const pct = Math.round(playerVolume * 100);
    const icon = pct === 0 ? '🔇' : pct < 50 ? '🔉' : '🔊';
    showToast(icon, `Volume ${pct}%`);
  }
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
if (tetoFxCheckbox) tetoFxCheckbox.checked = tetoFxEnabled;
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
        <button class="playlist-play">▶ Play</button>
        <button class="playlist-shuffle">🔀 Shuffle</button>
        <button class="playlist-delete">Delete</button>
      </div>
      <ul class="playlist-songs"></ul>
    `;
    card.querySelector('.playlist-name').textContent = name;
    card.querySelector('.playlist-count').textContent =
      `${songs.length} song${songs.length === 1 ? '' : 's'}`;
    const playButton = card.querySelector('.playlist-play');
    const shuffleButton = card.querySelector('.playlist-shuffle');
    const deleteButton = card.querySelector('.playlist-delete');
    [playButton, shuffleButton, deleteButton].forEach(button => {
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
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
    const ul = card.querySelector('.playlist-songs');
    if (songs.length === 0) {
      const li = document.createElement('li');
      li.style.padding = '8px 10px';
      li.style.color = 'var(--fg-faint)';
      li.style.fontSize = '13px';
      li.textContent = 'Empty. Add songs from the Library tab using the + button.';
      ul.appendChild(li);
    } else {
      songs.forEach((songId, i) => {
        const libIdx = findSongIndex(songId);
        const li = document.createElement('li');
        li.className = 'playlist-song';
        li.dataset.playlist = name;
        li.dataset.libIdx = libIdx;
        const missingName = String(songId).split('/').pop();
        const label = libIdx >= 0 ? library[libIdx].displayName : `${missingName} (missing)`;
        li.innerHTML = `
          <span class="col-num">${i + 1}</span>
          <span class="title"></span>
          <button class="remove" title="Remove from playlist">×</button>
        `;
        li.querySelector('.title').textContent = label;
        if (libIdx < 0) li.querySelector('.title').style.color = 'var(--fg-faint)';
        li.addEventListener('click', (e) => {
          if (e.target.closest('.remove')) return;
          if (libIdx >= 0) playPlaylist(name, i, false);
        });
        const removeButton = li.querySelector('.remove');
        removeButton.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
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
  resizeWaveform();
  resizeFxCanvas();
});
resizeWaveform();
resizeFxCanvas();
updateFxState();
drawWaveform();
loadLibrary();
