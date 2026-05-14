const REPO_OWNER = 'turbodog111';
const REPO_NAME = 'vp';

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

async function loadLibrary() {
  const errBox = $('library-error');
  errBox.classList.add('hidden');
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/songs?ref=main`;
    const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (res.ok) {
      const items = await res.json();
      library = items
        .filter(i => i.type === 'file' && /\.mp3$/i.test(i.name))
        .map(i => {
          const p = prettyName(i.name);
          return {
            name: i.name,
            url: `./songs/${encodeURIComponent(i.name)}`,
            displayName: p.display,
            artist: p.artist,
            title: p.title,
            size: i.size
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else if (res.status === 403) {
      errBox.textContent = 'GitHub API rate limit hit. Try again in a few minutes.';
      errBox.classList.remove('hidden');
    } else if (res.status === 404) {
      // songs folder doesn't exist yet — show empty state
      library = [];
    } else {
      errBox.textContent = `Could not load library (HTTP ${res.status}).`;
      errBox.classList.remove('hidden');
    }
  } catch (e) {
    errBox.textContent = 'Could not load library. Check your connection.';
    errBox.classList.remove('hidden');
  }
  renderLibrary($('search').value);
}

function renderLibrary(filter = '') {
  const list = $('library-list');
  const empty = $('library-empty');
  const q = filter.toLowerCase().trim();
  list.innerHTML = '';
  if (library.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  const filtered = library
    .map((s, i) => ({ song: s, idx: i }))
    .filter(({ song }) => !q || song.displayName.toLowerCase().includes(q));
  filtered.forEach(({ song, idx }, displayIdx) => {
    const li = document.createElement('li');
    li.className = 'song-row';
    li.dataset.libIdx = idx;
    if (queue[queueIndex] === idx) li.classList.add('playing');
    li.innerHTML = `
      <span class="col-num"></span>
      <span class="col-title"></span>
      <span class="col-actions">
        <button class="icon-btn add-to" title="Add to playlist">+</button>
      </span>
    `;
    li.querySelector('.col-num').textContent = displayIdx + 1;
    li.querySelector('.col-title').textContent = song.displayName;
    li.addEventListener('click', (e) => {
      if (e.target.closest('.col-actions')) return;
      queue = library.map((_, i) => i);
      shuffled = false;
      $('shuffle').classList.remove('on');
      queueIndex = queue.indexOf(idx);
      currentPlaylist = null;
      playCurrent();
    });
    li.querySelector('.add-to').addEventListener('click', (e) => {
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
  audio.src = song.url;
  audio.play().catch(err => console.warn('Play failed:', err));
  $('np-title').textContent = song.title || song.displayName;
  const parts = [];
  if (song.artist) parts.push(song.artist);
  if (currentPlaylist) parts.push(`Playlist: ${currentPlaylist}`);
  $('np-sub').textContent = parts.join(' · ');
  $('play').textContent = '⏸';
  highlightCurrent();
  updateMediaSession(song);
  document.title = `${song.title || song.displayName} — vp`;
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
    if (library.length === 0) return;
    queue = library.map((_, i) => i);
    queueIndex = 0;
    currentPlaylist = null;
    playCurrent();
    return;
  }
  if (audio.paused) audio.play();
  else audio.pause();
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
  } else if (loopMode === 'all') {
    queueIndex = 0;
    playCurrent();
  } else {
    audio.pause();
    audio.currentTime = 0;
  }
}

function playPrev() {
  if (queue.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (queueIndex > 0) {
    queueIndex--;
  } else if (loopMode === 'all') {
    queueIndex = queue.length - 1;
  } else {
    audio.currentTime = 0;
    return;
  }
  playCurrent();
}

function toggleShuffle() {
  shuffled = !shuffled;
  $('shuffle').classList.toggle('on', shuffled);
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
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

audio.addEventListener('timeupdate', () => {
  $('time-current').textContent = fmtTime(audio.currentTime);
  if (audio.duration) {
    $('seek').value = (audio.currentTime / audio.duration) * 100;
  }
});
audio.addEventListener('loadedmetadata', () => {
  $('time-total').textContent = fmtTime(audio.duration);
});
audio.addEventListener('ended', () => playNext(true));
audio.addEventListener('play', () => { $('play').textContent = '⏸'; });
audio.addEventListener('pause', () => { $('play').textContent = '▶'; });
audio.addEventListener('error', () => {
  console.warn('Audio error for', audio.src);
  // Try next song if this one fails
  if (queueIndex + 1 < queue.length) playNext(false);
});

$('play').addEventListener('click', togglePlay);
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
});

const savedVolume = localStorage.getItem('vp_volume');
if (savedVolume !== null) {
  audio.volume = parseFloat(savedVolume);
  $('volume').value = savedVolume;
}

$('search').addEventListener('input', (e) => renderLibrary(e.target.value));

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    $(`view-${tab.dataset.view}`).classList.add('active');
    if (tab.dataset.view === 'playlists') renderPlaylists();
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
    card.querySelector('.playlist-play').addEventListener('click', () => playPlaylist(name, 0, false));
    card.querySelector('.playlist-shuffle').addEventListener('click', () => playPlaylist(name, 0, true));
    card.querySelector('.playlist-delete').addEventListener('click', () => {
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
      songs.forEach((songName, i) => {
        const libIdx = library.findIndex(s => s.name === songName);
        const li = document.createElement('li');
        li.className = 'playlist-song';
        li.dataset.playlist = name;
        li.dataset.libIdx = libIdx;
        const label = libIdx >= 0 ? library[libIdx].displayName : `${songName} (missing)`;
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
        li.querySelector('.remove').addEventListener('click', (e) => {
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
  const songNames = playlists[name];
  if (!songNames || songNames.length === 0) return;
  const indices = songNames
    .map(n => library.findIndex(s => s.name === n))
    .filter(i => i >= 0);
  if (indices.length === 0) {
    alert('No playable songs in this playlist. The files may not be in songs/ yet.');
    return;
  }
  queue = indices;
  currentPlaylist = name;
  if (shuffle) {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    queueIndex = 0;
    shuffled = true;
    $('shuffle').classList.add('on');
    unshuffledQueue = indices;
  } else {
    queueIndex = Math.min(Math.max(0, startIdx), queue.length - 1);
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
  const names = Object.keys(playlists).sort();
  if (names.length === 0) {
    const note = document.createElement('div');
    note.className = 'menu-note';
    note.textContent = 'No playlists yet';
    menu.appendChild(note);
  }
  names.forEach(name => {
    const b = document.createElement('button');
    const already = playlists[name].includes(library[libIdx].name);
    b.textContent = already ? `✓ ${name}` : name;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const song = library[libIdx];
      if (already) {
        playlists[name] = playlists[name].filter(n => n !== song.name);
      } else {
        playlists[name].push(song.name);
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
  create.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();
    const name = (prompt('Playlist name:') || '').trim();
    if (!name) return;
    if (!playlists[name]) playlists[name] = [];
    const song = library[libIdx];
    if (!playlists[name].includes(song.name)) playlists[name].push(song.name);
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

loadLibrary();
