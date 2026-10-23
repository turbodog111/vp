(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LyricWorkbench = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const LANGUAGES = ['ja', 'romaji', 'en', 'zh', 'pinyin'];
  const lanes = language => language === 'zh-en' ? ['zh', 'pinyin', 'en'] : ['ja', 'romaji', 'en'];
  const MAX_ROWS = 500;
  const MAX_TEXT = 2000;
  const STORAGE_PREFIX = 'vp_lyric_draft_v1:';
  const textKey = text => String(text).normalize('NFC').replace(/\s+/g, '');

  function parseTime(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const raw = String(value).trim();
    if (!/^\d+(?:\.\d{1,3})?$/.test(raw) && !/^\d+:[0-5]\d(?:\.\d{1,3})?$/.test(raw)) return NaN;
    const parts = raw.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  }
  function fresh(recording, language = 'en', duration = null) {
    return { schemaVersion: 1, recording, language, duration, preview: false, source: '', rows: [] };
  }
  function parseLane(text) {
    if (text.length > 300000) throw new Error('Text is too large. Import at most 500 lines.');
    const result = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const timed = line.match(/^\[(\d+:[0-5]\d(?:\.\d{1,3})?)\]\s*(.*)$/);
      if (/^\[/.test(line) && !timed) throw new Error('Use one [mm:ss.xx] timestamp per line, or plain text.');
      const value = timed ? timed[2] : line;
      if (timed && /^\[/.test(value)) throw new Error('Use one timestamp per line; expand repeated LRC timestamps first.');
      if (!value || value.length > MAX_TEXT) throw new Error('Each lyric line needs 1-2000 characters.');
      return { text: value, start: timed ? parseTime(timed[1]) : null };
    });
    if (!result.length || result.length > MAX_ROWS) throw new Error('Paste between 1 and 500 nonempty lines.');
    return result;
  }
  function mergeLane(draft, language, text) {
    if (!LANGUAGES.includes(language)) throw new Error('Unknown lyric language.');
    const lines = parseLane(text);
    if (draft.rows.length && lines.length !== draft.rows.length) {
      throw new Error(`Expected ${draft.rows.length} lines, received ${lines.length}. No text or timing was changed.`);
    }
    const next = structuredClone(draft);
    if (!next.rows.length) next.rows = lines.map((_, i) => ({ id: `line-${i + 1}`, start: null, end: null, ja: '', romaji: '', en: '', zh: '', pinyin: '', words: {} }));
    next.rows.forEach((row, i) => {
      if (row[language] !== lines[i].text) delete row.words[language];
      row[language] = lines[i].text;
      if (row.start === null && lines[i].start !== null) row.start = lines[i].start;
    });
    return next;
  }
  function decode(value, recording) {
    const obj = typeof value === 'string' ? JSON.parse(value) : value;
    if (!obj || obj.schemaVersion !== 1 || obj.recording !== recording) throw new Error('This draft belongs to a different recording or schema.');
    if (!['ja', 'en', 'zh-en', 'und'].includes(obj.language)) throw new Error('Choose Japanese, English, Chinese / English, or unconfirmed language.');
    if (!Array.isArray(obj.rows) || obj.rows.length > MAX_ROWS) throw new Error('Invalid lyric rows.');
    const draft = fresh(recording, obj.language);
    if (obj.duration !== null && obj.duration !== undefined && (!Number.isFinite(obj.duration) || obj.duration <= 0)) throw new Error('Invalid recording duration.');
    draft.duration = obj.duration ?? null;
    draft.preview = obj.preview === true;
    draft.source = typeof obj.source === 'string' ? obj.source.slice(0, 4000) : '';
    const ids = new Set();
    draft.rows = obj.rows.map((input, index) => {
      if (!input || typeof input.id !== 'string' || !input.id || input.id.length > 100 || ids.has(input.id)) throw new Error(`Invalid or duplicate line ID at ${index + 1}.`);
      ids.add(input.id);
      const row = { id: input.id, words: {} };
      for (const key of ['start', 'end']) {
        if (input[key] !== null && (!Number.isFinite(input[key]) || input[key] < 0)) throw new Error(`Invalid ${key} on line ${index + 1}.`);
        row[key] = input[key];
      }
      for (const language of LANGUAGES) {
        const text = input[language] ?? '';
        if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error(`Invalid ${language} text on line ${index + 1}.`);
        row[language] = text;
        const words = input.words?.[language];
        if (words !== undefined) {
          if (!Array.isArray(words) || words.length > 500) throw new Error(`Invalid word timings on line ${index + 1}.`);
          row.words[language] = words.map(word => {
            if (!word || typeof word.text !== 'string' || !word.text.trim() || word.text.length > MAX_TEXT || !Number.isFinite(word.start) || !Number.isFinite(word.end)) throw new Error(`Invalid timed word on line ${index + 1}.`);
            return { text: word.text, start: word.start, end: word.end };
          });
        }
      }
      return row;
    });
    return draft;
  }
  function validate(draft, actualDuration = null) {
    const errors = [], warnings = [];
    if (!draft.rows.length) errors.push('Add lyric text.');
    if (draft.language === 'und') errors.push('Confirm the sung language.');
    if (Number.isFinite(actualDuration) && actualDuration > 0 && draft.duration && Math.abs(draft.duration - actualDuration) > 0.25) errors.push('Recording duration differs from the imported draft. Check the rendition before previewing.');
    const duration = actualDuration > 0 ? actualDuration : draft.duration;
    const required = draft.language === 'ja' ? ['romaji', 'en'] : draft.language === 'zh-en' ? ['pinyin', 'en'] : ['en'];
    let previousEnd = 0;
    draft.rows.forEach((row, i) => {
      const label = `Line ${i + 1}`;
      for (const language of required) if (!row[language]?.trim()) errors.push(`${label}: missing ${language}.`);
      if (!Number.isFinite(row.start) || !Number.isFinite(row.end) || row.start < 0 || row.end <= row.start) errors.push(`${label}: enter a start and a later end.`);
      else {
        if (row.start < previousEnd) errors.push(`${label}: overlaps the preceding line. Split simultaneous vocals within one line.`);
        if (duration && row.end > duration + 0.02) errors.push(`${label}: extends beyond this recording.`);
        if (row.end - row.start > 12) warnings.push(`${label}: held for ${(row.end - row.start).toFixed(1)}s; check for a silence or a missed split.`);
        previousEnd = row.end;
      }
      for (const language of LANGUAGES) {
        const words = row.words?.[language];
        if (!words?.length) continue;
        if (textKey(words.map(w => w.text).join(' ')) !== textKey(row[language])) errors.push(`${label}: ${language} words do not match its text.`);
        let end = row.start;
        for (const word of words) {
          if (word.start < end || word.end <= word.start || word.end > row.end || word.start < row.start) errors.push(`${label}: invalid ${language} word interval.`);
          end = word.end;
        }
      }
    });
    return { errors, warnings, ready: errors.length === 0 };
  }
  function activeRow(rows, time) {
    let low = 0, high = rows.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1, row = rows[mid];
      if (time < row.start) high = mid - 1;
      else if (time >= row.end) low = mid + 1;
      else return mid;
    }
    return -1;
  }
  function wordState(word, time) { return time >= word.end ? 'sung' : time >= word.start ? 'singing' : 'waiting'; }

  function selectTimeline(draft, prepared, actualDuration) {
    if (draft?.preview && validate(draft, actualDuration).ready) return draft;
    if (prepared && validate(prepared, actualDuration).ready) return prepared;
    return null;
  }

  let ui = null;
  function init(bridge) {
    const $ = id => document.getElementById(id);
    const panel = $('view-lyrics');
    if (!panel) return;
    let draft = null, song = null, prepared = null, issue = null, readBlocked = false, revision = 0;
    let cachedValidation = null, validationKey = '', lastPaint = '', wordNodes = [], lastClock = '';
    let preparedCheckKey = '', preparedReady = false;
    const preparedCache = new Map();
    let catalogRequest = null;
    const editor = $('lyric-rows'), overlay = $('local-lyric-overlay');
    function message(text, error = false) {
      $('lyric-save-state').textContent = text;
      $('lyric-save-state').classList.toggle('error', error);
    }
    function check() {
      if (!draft) return { ready: false, errors: ['Choose a song from the library.'], warnings: [] };
      const duration = bridge.duration();
      const key = `${revision}:${duration}`;
      if (validationKey !== key) { cachedValidation = validate(draft, duration); validationKey = key; }
      return cachedValidation;
    }
    function save() {
      revision++; lastPaint = '';
      if (!draft) return;
      if (readBlocked) { message('Stored draft unreadable; original preserved. Export this session to keep changes.', true); return; }
      try { localStorage.setItem(STORAGE_PREFIX + draft.recording, JSON.stringify(draft)); issue = null; message('Saved on this browser'); }
      catch (err) { issue = err; message('Not saved. Export a backup or retry saving.', true); }
    }
    function showValidation() {
      const result = check();
      $('lyric-validation').textContent = result.ready
        ? `${draft.rows.length} lines ready for preview${result.warnings.length ? ' - ' + result.warnings.join(' ') : ''}`
        : result.errors.slice(0, 5).join(' ') + (result.errors.length > 5 ? ` (+${result.errors.length - 5} more)` : '');
      $('lyric-validation').classList.toggle('error', !result.ready);
      $('lyric-preview').checked = !!draft?.preview;
    }
    function changed() { save(); showValidation(); tick(bridge.time()); }
    function makeButton(label, title, action) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.title = title; button.addEventListener('click', action); return button;
    }
    function renderRows() {
      editor.replaceChildren();
      if (!draft) return;
      draft.rows.forEach((row, index) => {
        const item = document.createElement('div'); item.className = 'lyric-editor-row';
        const number = document.createElement('strong'); number.textContent = String(index + 1).padStart(2, '0'); item.append(number);
        const times = document.createElement('div'); times.className = 'lyric-time-fields';
        for (const field of ['start', 'end']) {
          const label = document.createElement('label'); label.textContent = field === 'start' ? 'In' : 'Out';
          const input = document.createElement('input'); input.type = 'text'; input.inputMode = 'decimal'; input.value = row[field] ?? ''; input.placeholder = '0:00.00';
          input.setAttribute('aria-label', `Line ${index + 1} ${field}`); input.title = 'Seconds or mm:ss.xx, on this recording';
          input.addEventListener('change', () => {
            const value = parseTime(input.value);
            if (Number.isNaN(value)) { input.setAttribute('aria-invalid', 'true'); message('Use seconds or mm:ss.xx. Invalid time was not saved.', true); return; }
            input.removeAttribute('aria-invalid'); row[field] = value; changed();
          });
          label.append(input); times.append(label);
          times.append(makeButton(field === 'start' ? 'Mark in' : 'Mark out', `Set line ${index + 1} ${field} to the actual playback time`, () => {
            row[field] = Math.round(bridge.time() * 1000) / 1000; input.value = row[field]; changed();
          }));
        }
        times.append(makeButton('Seek', `Seek to line ${index + 1} without changing play or pause intent`, () => { if (Number.isFinite(row.start)) bridge.seek(row.start); }));
        item.append(times);
        for (const language of draft.language === 'en' ? ['en'] : lanes(draft.language)) {
          const input = document.createElement('textarea'); input.rows = 2; input.value = row[language]; input.maxLength = MAX_TEXT;
          input.setAttribute('aria-label', `Line ${index + 1} ${language}`); input.placeholder = ({ja:'Japanese (optional)',romaji:'Romaji',en:'English',zh:'Chinese / English',pinyin:'Pinyin / English'})[language];
          input.addEventListener('change', () => { row[language] = input.value; delete row.words[language]; changed(); });
          item.append(input);
        }
        editor.append(item);
      });
      $('lyric-line-count').textContent = `${draft.rows.length} lines`;
      editor.classList.toggle('english-only', draft.language === 'en');
    }
    function setSong(next) {
      if (next?.path === song?.path) return;
      song = next; draft = null; prepared = null; preparedCheckKey = ''; readBlocked = false; issue = null; revision++; lastPaint = ''; validationKey = '';
      panel.querySelector('fieldset').disabled = !song;
      $('lyric-recording').textContent = song ? `${song.artist || ''} - ${song.title || song.displayName}` : 'Choose a song from the library';
      if (song) {
        draft = fresh(song.path, /^BTS - |\(English/.test(song.name || '') ? 'en' : 'und');
        try { const saved = localStorage.getItem(STORAGE_PREFIX + song.path); if (saved) draft = decode(saved, song.path); message(saved ? 'Saved on this browser' : 'New local draft'); }
        catch (err) { readBlocked = true; message('Stored draft unreadable. Original preserved; changes will be session-only.', true); }
      }
      $('lyric-language').value = draft?.language || 'und'; $('lyric-source').value = draft?.source || '';
      for (const lang of ['ja','romaji','en']) $('lyric-paste-' + lang).value = '';
      renderRows(); updatePasteLabels(); showValidation(); tick(bridge.time());
      if (song) loadSynchronized(song.path);
    }
    async function loadSynchronized(expected) {
      const startingRevision = revision;
      try {
        if (!catalogRequest) catalogRequest = fetch('./songs/lyrics/aligned/manifest.json').then(response => {
          if (!response.ok) throw new Error('Synchronized lyric list unavailable.');
          return response.json();
        }).catch(error => { catalogRequest = null; throw error; });
        const catalog = await catalogRequest;
        const entry = catalog.find(row => row.recording === expected);
        if (!entry || !/^[a-z0-9-]+\.json$/.test(entry.file)) return;
        let timeline = preparedCache.get(expected);
        if (!timeline) {
          const response = await fetch('./songs/lyrics/aligned/' + entry.file);
          if (!response.ok) throw new Error('Synchronized lyric file unavailable.');
          timeline = decode(await response.json(), expected);
          if (!validate(timeline).ready) throw new Error('Synchronized lyric file has invalid timing.');
          preparedCache.set(expected, timeline);
        }
        if (song?.path !== expected) return;
        prepared = timeline; preparedCheckKey = ''; lastPaint = '';
        // A built-in timeline can display without replacing a browser's saved work.
        if (revision === startingRevision && !draft.rows.length && !readBlocked) {
          draft = structuredClone(timeline); draft.preview = false; revision++;
          $('lyric-language').value = draft.language; $('lyric-source').value = draft.source;
          renderRows(); updatePasteLabels(); showValidation();
          message('Synchronized version loaded for local review');
        }
        tick(bridge.time());
      } catch (error) {
        if (song?.path === expected) console.warn('Synchronized lyrics:', error.message);
      }
    }
    function tick(time) {
      if (panel.classList.contains('active')) {
        const clock = Number(time).toFixed(2);
        if (clock !== lastClock) { $('lyric-clock').textContent = clock + ' s'; lastClock = clock; }
      }
      const duration = bridge.duration();
      const preparedKey = `${song?.path}:${duration}`;
      if (preparedKey !== preparedCheckKey) {
        preparedReady = !!prepared && validate(prepared, duration).ready;
        preparedCheckKey = preparedKey;
      }
      const timeline = draft?.preview && check().ready ? draft : preparedReady ? prepared : null;
      const visible = !!timeline && bridge.fxEnabled() && bridge.nowVisible();
      document.body.classList.toggle('local-lyrics-active', visible);
      const index = visible ? activeRow(timeline.rows, time) : -1;
      const key = `${revision}:${timeline === draft ? 'draft' : 'prepared'}:${visible}:${index}`;
      if (key !== lastPaint) {
        lastPaint = key; overlay.replaceChildren(); wordNodes = []; overlay.hidden = index < 0;
        if (index >= 0) {
          const row = timeline.rows[index];
          for (const language of timeline.language === 'en' ? ['en'] : lanes(timeline.language)) {
            if (!row[language]) continue;
            const line = document.createElement('div'); line.className = `local-lyric-${language}`; line.lang = ({ja:'ja',romaji:'ja-Latn',en:'en',zh:'zh',pinyin:'zh-Latn'})[language];
            if (row.words[language]?.length) {
              row.words[language].forEach((word, i) => {
                if (i && language !== 'ja' && language !== 'zh') line.append(document.createTextNode(' '));
                const span = document.createElement('span'); span.textContent = word.text; line.append(span); wordNodes.push({ span, word, state: '' });
              });
            } else line.textContent = row[language];
            overlay.append(line);
          }
          fitOverlay();
        }
      }
      for (const entry of wordNodes) {
        const state = wordState(entry.word, time);
        if (state !== entry.state) { entry.span.className = state; entry.state = state; }
      }
    }
    function fitOverlay() {
      overlay.classList.remove('compact', 'dense');
      if (overlay.scrollHeight > overlay.clientHeight + 1) overlay.classList.add('compact');
      if (overlay.scrollHeight > overlay.clientHeight + 1) overlay.classList.add('dense');
    }
    const resizeObserver = new ResizeObserver(() => { if (!overlay.hidden) fitOverlay(); });
    resizeObserver.observe(overlay);
    $('lyrics-open').addEventListener('click', () => { bridge.open(); $('settings-menu').classList.add('hidden'); showValidation(); });
    $('lyric-language').addEventListener('change', event => { if (draft) { draft.language = event.target.value; changed(); renderRows(); updatePasteLabels(); } });
    $('lyric-source').addEventListener('change', event => { if (draft) { draft.source = event.target.value; changed(); } });
    $('lyric-preview').addEventListener('change', event => { if (draft) { draft.preview = event.target.checked; changed(); } });
    $('lyric-retry').addEventListener('click', () => { if (draft) changed(); });
    $('lyric-show-preview').addEventListener('click', () => { bridge.showPreview(); tick(bridge.time()); });
    $('lyric-apply-text').addEventListener('click', () => {
      if (!draft) return;
      try {
        let next = draft;
        lanes(draft.language).forEach((lang, i) => { const text = $('lyric-paste-' + ['ja','romaji','en'][i]).value; if (text.trim()) next = mergeLane(next, lang, text); });
        draft = next; changed(); renderRows();
      } catch (err) { message(err.message, true); }
    });
    $('lyric-export').addEventListener('click', () => {
      if (!draft) return;
      const output = structuredClone(draft); const duration = bridge.duration();
      if (duration > 0 && !output.duration) output.duration = duration;
      const blob = new Blob([JSON.stringify(output, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url;
      link.download = `${song.title || 'song'}.lyrics-draft.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $('lyric-import').addEventListener('change', async event => {
      const file = event.target.files[0], expected = song?.path; event.target.value = '';
      if (!file || !expected) return;
      try {
        if (file.size > 2000000) throw new Error('Draft is too large (2 MB maximum).');
        const text = await file.text();
        if (song?.path !== expected) throw new Error('Song changed during import. Select the intended recording and retry.');
        const next = decode(text, expected); next.preview = false; draft = next;
        $('lyric-language').value = draft.language; $('lyric-source').value = draft.source;
        changed(); renderRows(); updatePasteLabels();
      } catch (err) { message('Import rejected: ' + err.message, true); }
    });
    function updatePasteLabels() {
      $('lyric-paste-label-source').textContent = draft?.language === 'zh-en' ? 'Chinese / English' : 'Japanese';
      $('lyric-paste-label-roman').textContent = draft?.language === 'zh-en' ? 'Pinyin / English' : 'Romaji';
      for (const key of ['ja','romaji']) $('lyric-paste-' + key).closest('label').hidden = draft?.language === 'en';
      panel.querySelector('.lyric-paste-grid').classList.toggle('english-only', draft?.language === 'en');
    }
    $('lyric-prepared').addEventListener('click', async () => {
      const expected = song?.path, generation = revision;
      if (!expected) return;
      if (draft.rows.length) { message('A draft already exists. Export it before replacing text through Import draft.', true); return; }
      try {
        const response = await fetch('./songs/lyrics/drafts/manifest.json');
        if (!response.ok) throw new Error('Prepared text list unavailable.');
        const manifest = await response.json(), entry = manifest.find(row => row.recording === expected);
        if (!entry || !/^[a-z0-9-]+\.json$/.test(entry.file)) throw new Error('No prepared text for this recording yet.');
        const response2 = await fetch('./songs/lyrics/drafts/' + entry.file);
        if (!response2.ok) throw new Error('Prepared text unavailable.');
        const next = decode(await response2.json(), expected);
        if (song?.path !== expected || revision !== generation) throw new Error('Draft or recording changed while loading. No changes applied.');
        draft = next; draft.preview = false; $('lyric-language').value = draft.language; $('lyric-source').value = draft.source;
        changed(); renderRows(); updatePasteLabels();
        panel.querySelector('.lyric-paste').open = false;
      } catch (err) { message(err.message, true); }
    });
    ui = { tick, setSong };
    setSong(bridge.song());
  }
  return { fresh, parseTime, parseLane, mergeLane, decode, validate, activeRow, wordState, selectTimeline, init,
    tick: time => ui?.tick(time), setSong: song => ui?.setSong(song) };
});
