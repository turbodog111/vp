// The quick menu holds only everyday controls and accessibility switches; tools and
// troubleshooting live in the Settings panel; VP's Reduce motion switch drives the music videos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function block(id) {
  const start = HTML.indexOf(`id="${id}"`);
  assert.ok(start > 0, `${id} exists`);
  const open = HTML.lastIndexOf('<', start);
  const tag = HTML.slice(open + 1, HTML.indexOf(' ', open));
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}[\\s>]`, 'g');
  re.lastIndex = open;
  for (let m; (m = re.exec(HTML));) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return HTML.slice(open, m.index);
  }
  throw new Error(`unclosed ${id}`);
}

test('quick menu: everyday controls and accessibility only', () => {
  const menu = block('settings-menu');
  for (const id of ['teto-fx-enabled', 'a11y-large-text', 'a11y-reduce-motion', 'a11y-high-contrast', 'equalizer-open', 'settings-open']) {
    assert.match(menu, new RegExp(`id="${id}"`), id);
  }
  for (const gone of ['fx-theme', 'lyrics-open', 'hrtf-lab', 'audio-reset', 'force-reload', 'timing-debug-enabled']) {
    assert.doesNotMatch(menu, new RegExp(gone), `${gone} is not in quick access`);
  }
  assert.doesNotMatch(HTML, /hrtf-lab/, 'the HRTF clip lab link is gone');
  assert.doesNotMatch(HTML, /data-view="lyrics"/, 'Lyric studio is not a main tab');
});

test('settings panel: lyric studio, troubleshooting and build', () => {
  const panel = block('settings-panel');
  for (const id of ['lyrics-open', 'audio-reset', 'force-reload', 'timing-debug-enabled', 'vp-build-label', 'settings-close']) {
    assert.match(panel, new RegExp(`id="${id}"`), id);
  }
  assert.match(panel, /role="dialog"/);
});

function extract(name) {
  const match = new RegExp('^( *)function ' + name + '\\(', 'm').exec(APP);
  assert.ok(match, 'production function exists: ' + name);
  const end = APP.indexOf('\n' + match[1] + '}\n', match.index);
  return APP.slice(match.index, end + match[1].length + 2);
}

test('songs read title first, artist second', () => {
  const c = vm.createContext({});
  vm.runInContext(['songTitleText', 'songArtistText', 'songLabel'].map(extract).join('\n'), c);
  assert.equal(c.songLabel({ title: 'Mesmerizer', artist: '32ki', displayName: '32ki — Mesmerizer' }), 'Mesmerizer · 32ki');
  assert.equal(c.songLabel({ title: 'Untitled', artist: '' }), 'Untitled');
  assert.doesNotMatch(extract('renderLibrary'), /displayName/, 'library rows never print "Artist — Title"');
});

test('playlist search lists every match instead of stopping at 60', () => {
  const body = extract('renderPlaylistAdderResults');
  assert.doesNotMatch(body, /\.slice\(/);
  assert.match(body, /candidates\.forEach/);
});

test('reduce motion: an explicit choice wins over the system setting', () => {
  for (const [motion, system, expected] of [[null, true, true], [null, false, false], ['on', false, true], ['off', true, false]]) {
    const c = vm.createContext({ a11yOptions: { motion }, SYSTEM_REDUCED_MOTION: { matches: system } });
    vm.runInContext(extract('prefersReducedMotion'), c);
    assert.equal(c.prefersReducedMotion(), expected, `${motion}/${system}`);
  }
});

test('music videos follow VP\'s Reduce motion switch even when the system does not ask', async () => {
  const file = 'songs/EJAE & Andrew Choi - Free.m4a';
  const read = url => JSON.parse(fs.readFileSync(path.join(root, url), 'utf8'));
  const frames = async vpReducedMotion => {
    const window = { MvKit: require('../mv-kit.js'), FreeFx: require('../free-fx.js'), matchMedia: () => ({ matches: false }), vpReducedMotion };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'song-motion-fx.js'), 'utf8'), {
      window, AbortController, setTimeout, clearTimeout, console: { warn() {} },
      fetch: async url => ({ ok: true, json: async () => read(url) }),
    });
    const api = window.SongMotionFx;
    await api.activate(api.track({ path: file }));
    const draw = time => {
      const calls = [];
      const ctx = new Proxy({}, {
        set(_, key, value) { calls.push([key, value]); return true; },
        get(_, key) {
          if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
          return (...args) => calls.push([key, ...args.map(a => typeof a === 'object' ? 0 : a)]);
        },
      });
      api.draw(ctx, 640, 360, { time, energy: 0.4 });
      return JSON.stringify(calls);
    };
    const section = read('songs/motion/free.json').structure.find(s => s.end - s.start > 6);
    return [draw(section.start + 1), draw(section.start + 4)];
  };
  const [stillA, stillB] = await frames(true);
  assert.equal(stillA, stillB, 'reduced: one still frame per section');
  const [movingA, movingB] = await frames(false);
  assert.notEqual(movingA, movingB, 'explicitly off: the video moves');
});
