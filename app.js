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
let audioCtx = null;
let audioSource = null;
let analyser = null;
let waveData = null;
let waveTimeData = null;
let waveRaf = null;
let waveBars = [];
let smoothedLevel = 0;
let tetoFxLevel = 0;
let tetoGlowLevel = 0;
let waveLevelWindow = [];
const WAVE_BAR_COUNT = 84;
const WAVE_GAIN = 1.34;
const WAVE_SOFT_LIMIT = 0.94;
const WAVE_LEVEL_WINDOW = 180;
const WAVE_MIN_FREQ = 55;
const WAVE_MAX_FREQ = 14000;
const seededUnit = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};
const TETO_FX_OBJECTS = Array.from({ length: 40 }, (_, i) => {
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
    size: 6 + (i % 7) * 1.9,
    kind: i % 3,
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

function prettyName(filename) {
  const base = filename.replace(/\.mp3$/i, '').replace(/_/g, ' ').trim();
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
  return items
    .filter(i => i.type === 'file' && /\.mp3$/i.test(i.name))
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
    return 'No songs found. Drop .mp3 files into songs/ or songs/christian/, commit, and push.';
  }
  if (filter.trim()) {
    return `No ${activeCollection === 'all' ? '' : `${collectionLabel(activeCollection).toLowerCase()} `}songs match that search.`;
  }
  if (activeCollection !== 'all') {
    return `No ${collectionLabel(activeCollection).toLowerCase()} songs found.`;
  }
  return 'No songs found.';
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
    addButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    addButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showAddToMenu(idx, e.currentTarget);
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
    audio.pause();
    audio.src = song.url;
    audio.load();
  }
  audio.play().catch(err => console.warn('Play failed:', err));
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
  const pct = audio.duration ? Math.min(1, Math.max(0, audio.currentTime / audio.duration)) : 0;
  const deg = `${pct * 360}deg`;
  $('play').style.setProperty('--progress', deg);
  $('hero-play').style.setProperty('--progress', deg);
  $('hero-time-current').textContent = fmtTime(audio.currentTime);
  $('hero-time-total').textContent = fmtTime(audio.duration);
}

function updateMediaSession(song) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title || song.displayName,
    artist: song.artist || 'Unknown',
    album: currentPlaylist || 'vp'
  });
  navigator.mediaSession.setActionHandler('play', () => audio.play());
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
    ensureAudioGraph();
    audio.play();
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
    audio.play();
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
  }
}

function playPrev() {
  if (queue.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    showToast('⏮', 'Restart');
    return;
  }
  if (queueIndex > 0) {
    queueIndex--;
  } else if (loopMode === 'all') {
    queueIndex = queue.length - 1;
  } else {
    audio.currentTime = 0;
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
  waveData = new Float32Array(analyser.frequencyBinCount);
  waveTimeData = new Uint8Array(analyser.fftSize);
  audioSource.connect(analyser);
  analyser.connect(audioCtx.destination);
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
  const target = clamp(0, 1, level);
  const motionTarget = smoothStep(0.06, 0.92, target);
  const glowTarget = Math.pow(target, 0.72);
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

  const glowRadius = Math.max(w, h) * (0.34 + levels.glow * 0.3);
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, glowRadius);
  glow.addColorStop(0, `rgba(255, 122, 45, ${0.08 + levels.glow * 0.22})`);
  glow.addColorStop(0.46, `rgba(210, 54, 37, ${0.04 + levels.glow * 0.17})`);
  glow.addColorStop(0.78, `rgba(120, 34, 22, ${0.015 + levels.glow * 0.09})`);
  glow.addColorStop(1, 'rgba(91, 28, 17, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const cornerGlow = ctx.createRadialGradient(w * 0.08, h * 0.88, 0, w * 0.08, h * 0.88, Math.max(w, h) * 0.5);
  cornerGlow.addColorStop(0, `rgba(255, 83, 48, ${levels.glow * 0.08})`);
  cornerGlow.addColorStop(1, 'rgba(255, 83, 48, 0)');
  ctx.fillStyle = cornerGlow;
  ctx.fillRect(0, 0, w, h);

  for (let j = 0; j < 4; j++) {
    const dir = j % 2 === 0 ? 1 : -1;
    const hue = j % 2 === 0 ? '255, 106, 61' : '255, 173, 67';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir * (t * (0.055 + party * 0.095) + j * 0.82));
    ctx.beginPath();
    const sweep = Math.PI * (1.05 + party * 0.42);
    for (let a = 0; a <= sweep; a += 0.055) {
      const wobble = Math.sin(a * 3.2 + t * 1.15 + j) * radius * 0.035 * party;
      const r = radius * (0.88 + j * 0.12) + a * radius * 0.12 + wobble;
      const x = Math.cos(a * dir + j * Math.PI * 0.5) * r;
      const y = Math.sin(a * dir + j * Math.PI * 0.5) * r * 0.72;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${hue}, ${0.1 + quietGate * 0.12 + party * 0.24})`;
    ctx.lineWidth = Math.max(1, (1.5 + party * 3.4) * sx);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  const palettes = [
    'rgba(255, 96, 62, 0.95)',
    'rgba(255, 153, 54, 0.86)',
    'rgba(181, 55, 31, 0.74)',
    'rgba(255, 210, 105, 0.72)',
  ];
  TETO_FX_OBJECTS.forEach((obj, i) => {
    const appear = smoothStep(obj.threshold, Math.min(1, obj.threshold + 0.48), party);
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
      drawDiamond(ctx, x, y, size, t * 0.42 + obj.phase, color, beat * 0.62);
    } else if (obj.kind === 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.75 + obj.phase) * 0.34);
      ctx.globalAlpha *= beat * 0.62;
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
    const attack = targetLevel > smoothedLevel ? 0.7 : 0.34;
    smoothedLevel = smoothedLevel * (1 - attack) + targetLevel * attack;
  } else if (!audio.src) {
    smoothedLevel = smoothedLevel * 0.98 + 0.08 * 0.02;
    waveLevelWindow = [];
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
  $('time-current').textContent = fmtTime(audio.currentTime);
  if (audio.duration) {
    $('seek').value = (audio.currentTime / audio.duration) * 100;
  }
  updatePlaybackVisuals();
});
audio.addEventListener('loadedmetadata', () => {
  $('time-total').textContent = fmtTime(audio.duration);
  updatePlaybackVisuals();
});
audio.addEventListener('ended', () => playNext(true));
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

$('seek').addEventListener('input', (e) => {
  if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
});
$('volume').addEventListener('input', (e) => {
  audio.volume = parseFloat(e.target.value);
  localStorage.setItem('vp_volume', e.target.value);
  const pct = Math.round(audio.volume * 100);
  const icon = pct === 0 ? '🔇' : pct < 50 ? '🔉' : '🔊';
  showToast(icon, `Volume ${pct}%`);
});

const savedVolume = localStorage.getItem('vp_volume');
if (savedVolume !== null) {
  audio.volume = parseFloat(savedVolume);
  $('volume').value = savedVolume;
}

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

$('new-playlist').addEventListener('click', () => {
  const name = (prompt('Playlist name:') || '').trim();
  if (!name) return;
  if (playlists[name]) { alert('A playlist with that name already exists.'); return; }
  playlists[name] = [];
  savePlaylists();
  renderPlaylists();
});

function renderPlaylists() {
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
      if (confirm(`Delete playlist "${name}"?`)) {
        delete playlists[name];
        savePlaylists();
        renderPlaylists();
      }
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
    alert('No playable songs in this playlist. The files may not be in the library folders yet.');
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

let activeMenu = null;
function showAddToMenu(libIdx, anchor) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.addEventListener('pointerdown', (e) => e.stopPropagation());
  const names = Object.keys(playlists).sort();
  if (names.length === 0) {
    const note = document.createElement('div');
    note.className = 'menu-note';
    note.textContent = 'No playlists yet';
    menu.appendChild(note);
  }
  names.forEach(name => {
    const b = document.createElement('button');
    const song = library[libIdx];
    const already = playlists[name].some(id => refMatchesSong(id, song));
    b.textContent = already ? `✓ ${name}` : name;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (already) {
        playlists[name] = playlists[name].filter(id => !refMatchesSong(id, song));
      } else {
        playlists[name].push(songRef(song));
      }
      savePlaylists();
      closeMenu();
    });
    menu.appendChild(b);
  });
  if (names.length > 0) {
    const div = document.createElement('div');
    div.className = 'menu-divider';
    menu.appendChild(div);
  }
  const create = document.createElement('button');
  create.className = 'menu-create';
  create.textContent = '+ New playlist...';
  create.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  create.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    const name = (prompt('Playlist name:') || '').trim();
    if (!name) return;
    if (!playlists[name]) playlists[name] = [];
    const song = library[libIdx];
    if (!playlists[name].some(id => refMatchesSong(id, song))) playlists[name].push(songRef(song));
    savePlaylists();
  });
  menu.appendChild(create);

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  const menuWidth = 200;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth))}px`;
  activeMenu = menu;
  setTimeout(() => {
    document.addEventListener('click', onDocClickClose);
  }, 0);
}
function onDocClickClose(e) {
  if (activeMenu && !activeMenu.contains(e.target)) closeMenu();
}
function closeMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
    document.removeEventListener('click', onDocClickClose);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
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
