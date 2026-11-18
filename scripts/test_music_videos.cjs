// Music-video scenes: each is a pure function of media time and the recording's
// measured data. Pausing, seeking and replaying reproduce the same frame; the
// drawing work stays bounded; reduced motion holds one still frame per section.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const kit = require('../mv-kit.js');
const scenes = {
  MesmerizerFx: require('../mesmerizer-fx.js'),
  KuuFx: require('../kuu-fx.js'),
  FreeFx: require('../free-fx.js'),
  DemonsFx: require('../demons-fx.js'),
  JoyFx: require('../joy-fx.js'),
  MyWayFx: require('../my-way-fx.js'),
};

const recordings = [
  { key: 'mesmerizer-original', file: 'songs/32ki feat. Hatsune Miku & Kasane Teto SV - Mesmerizer (Japanese Original).m4a' },
  { key: 'mesmerizer-stetson', file: 'songs/Will Stetson & rachie - Mesmerizer (Official English Version).m4a' },
  { key: 'mesmerizer-artsy', file: 'songs/Artsythesecond feat. Razaplays - Mesmerizer (English Cover).m4a' },
  { key: 'kuu-ni-naru', file: 'songs/MIMI feat. Hatsune Miku & KAFU - Kuu ni Naru.m4a' },
  { key: 'kuu-ni-naru-okosama', file: 'songs/Okosama Lunch - Kuu ni Naru.m4a' },
  { key: 'free', file: 'songs/EJAE & Andrew Choi - Free.m4a', structure: true },
  { key: 'demons', file: 'songs/christian/Josiah Queen - demons.m4a', structure: true, fresh: true },
  { key: 'cant-steal-my-joy', file: "songs/christian/Josiah Queen - Can't Steal My Joy feat. Brandon Lake.m4a", structure: true, fresh: true },
  { key: 'my-way-so-what', file: 'songs/hiroki. feat. Kasane Teto & Hatsune Miku - My Way, So What!.m4a', structure: true, fresh: true },
];

function engine(reduced = false) {
  const sandbox = {
    window: { ...scenes, matchMedia: () => ({ matches: reduced }) },
    AbortController, setTimeout, clearTimeout, console: { warn() {} },
    fetch: async url => ({ ok: true, json: async () => read(url) }),
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'song-motion-fx.js'), 'utf8'), sandbox);
  return sandbox.window.SongMotionFx;
}

function render(api, time, w = 1280, h = 720) {
  const calls = [];
  const record = (name, args) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${name}: finite geometry`);
    calls.push([name, ...args.map(value => typeof value === 'object' ? 'gradient' : value)]);
  };
  const gradient = name => (...args) => { record(name, args); return { addColorStop: (...stop) => record('stop', stop) }; };
  const ctx = new Proxy({}, {
    set(_, key, value) { record(key, [value]); return true; },
    get(_, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient(key);
      return (...args) => record(key, args);
    }
  });
  api.draw(ctx, w, h, { time, energy: 0.4 });
  return calls;
}

for (const { key, file, structure, fresh } of recordings) {
  test(`${key}: exact recording and measured data agree`, () => {
    const bytes = fs.readFileSync(path.join(root, file));
    const data = read(`songs/motion/${key}.json`);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), data.audioSha256);
    const catalog = read(path.dirname(file) + '/manifest.json');
    const entry = catalog.find(row => row.name === path.basename(file));
    assert.ok(entry, 'listed in its manifest');
    assert.equal(entry.size, bytes.length);
    if (structure) {
      assert.ok(data.structure.length >= 4, 'measured sections');
      assert.equal(data.structure[0].start, 0);
      for (let i = 1; i < data.structure.length; i++) assert.equal(data.structure[i].start, data.structure[i - 1].end);
      assert.ok(Math.abs(data.structure.at(-1).end - data.duration) < 0.05);
      assert.ok(data.structure.some(s => s.chorus), 'at least one chorus');
    }
    if (fresh) assert.ok(data.bpm > 60 && data.bpm < 200 && data.energy.length > 1000);
  });

  test(`${key}: deterministic, moving, bounded music video across the whole song`, async () => {
    const api = engine();
    const config = api.track({ path: file });
    assert.ok(config, 'recording has a scene');
    assert.equal(api.track({ path: file.toUpperCase().replace('.M4A', '.MP3') })?.key, config.key);
    await api.activate(config);
    const data = read(`songs/motion/${key}.json`);
    for (let k = 0; k < 14; k++) {
      const time = 1 + (data.duration - 2) * k / 13;
      const frame = render(api, time);
      // Some shots are deliberately simple (a TV test card, the power-off dot), so the
      // floor only proves something is drawn; the ceiling bounds the work per frame.
      assert.ok(frame.length > 20 && frame.length < 3000, `${key} @${time.toFixed(1)}s: ${frame.length} calls`);
      assert.deepEqual(render(api, time), frame, 'same media time, same frame');
      assert.notDeepEqual(render(api, time + 0.2), frame, 'the picture moves');
      assert.ok(render(api, time, 360, 480).length > 20, 'compact sizes still draw');
    }
    const first = render(api, 42);
    render(api, data.duration - 3);
    assert.deepEqual(render(api, 42), first, 'seeking back reconstructs the exact scene');
    await api.activate(null);
    assert.equal(render(api, 42).length, 0, 'FX off tears the scene down');
  });

  test(`${key}: reduced motion holds one still frame per section`, async () => {
    const api = engine(true);
    await api.activate(api.track({ path: file }));
    const data = read(`songs/motion/${key}.json`);
    const list = data.structure?.length ? data.structure : data.sections?.length && !key.startsWith('free') ? data.sections : null;
    const probe = list ? list.find(s => s.end - s.start > 6) : { start: 10, end: 20 };
    if (key.startsWith('mesmerizer')) Object.assign(probe, { start: 123, end: 154 });
    assert.deepEqual(render(api, probe.start + 1), render(api, probe.start + 4), key);
  });
}

test('the toolkit clock: sections, beats, hits and reduced motion', () => {
  const data = { duration: 10, sampleInterval: 0.04, sampleOffset: 0.032, scale: 100, audioSha256: 'x',
    energy: Array(250).fill(50), onset: Array.from({ length: 250 }, (_, i) => i === 100 ? 90 : 10) };
  const list = kit.sections([{ start: 0, end: 4 }, { start: 4, end: 10, chorus: true }], data);
  assert.equal(list[1].chorus, true);
  assert.ok(Math.abs(list[0].level - 0.5) < 1e-9, 'section loudness comes from the recording');
  const F = kit.frame({ time: 5, beats: 9.25, energy: 0.8 }, list);
  assert.equal(F.index, 1); assert.equal(F.chorus, true); assert.equal(F.beatInBar, 1);
  assert.ok(Math.abs(F.phase - 0.25) < 1e-9);
  const still = kit.frame({ time: 9, beats: 17.6, energy: 0.8, reducedMotion: true }, list);
  assert.equal(still.pulse, 0); assert.equal(still.t, kit.frame({ time: 5, reducedMotion: true }, list).t);
  assert.ok(Math.abs(kit.sinceHit(data, 'onset', 4.2, 0.8) - (4.2 - (0.032 + 100 * 0.04))) < 1e-9);
  assert.equal(kit.sinceHit(data, 'onset', 9, 0.8), Infinity, 'outside the look-back window');
  assert.equal(kit.rgba('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
  assert.equal(kit.rgba(kit.blend('#000000', '#ffffff', 0.5), 1), 'rgba(128,128,128,1)');
});

test('Free: lyric-measured choruses lift the scene and quiet verses do not', () => {
  const data = read('songs/motion/free.json');
  assert.equal(scenes.FreeFx.cueAt(data.sections, 30), 0);
  assert.ok(scenes.FreeFx.cueAt(data.sections, 154) >= 0.95);
});

test('demons: lowercase title, renamed recording, and no stale capitalized entry', () => {
  const catalog = read('songs/christian/manifest.json');
  assert.ok(catalog.some(row => row.name === 'Josiah Queen - demons.m4a'));
  assert.ok(!catalog.some(row => row.name === 'Josiah Queen - Demons.m4a'));
  assert.ok(fs.readdirSync(path.join(root, 'songs/christian')).includes('Josiah Queen - demons.m4a'));
});

const APP = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
function extract(name) {
  const match = new RegExp('^( *)function ' + name + '\\(', 'm').exec(APP);
  assert.ok(match, 'production function exists: ' + name);
  const end = APP.indexOf('\n' + match[1] + '}\n', match.index);
  return APP.slice(match.index, end + match[1].length + 2);
}

test('My Way: theatre by default, official video on request, remembered per song', () => {
  const myWay = { path: 'songs/hiroki. feat. Kasane Teto & Hatsune Miku - My Way, So What!.m4a' };
  const videoOnly = { path: 'songs/Pleometric - Im Upping My Pdoom.m4a' };
  const c = vm.createContext({
    REFERENCE_VIDEO_TRACKS: { [myWay.path]: { url: 'my-way.mp4' }, [videoOnly.path]: { url: 'pdoom.mp4' } },
    window: { SongMotionFx: { track: song => song === myWay ? { theme: 'my-way' } : null } },
    songVisualModes: {}, currentSong: () => myWay,
  });
  vm.runInContext(['hasTheatreAndVideo', 'songVisualMode', 'referenceVideoTrack'].map(extract).join('\n'), c);
  assert.equal(c.songVisualMode(myWay), 'theatre');
  assert.equal(c.referenceVideoTrack(myWay), null, 'theatre hides the video');
  c.songVisualModes = { [myWay.path]: 'video' };
  assert.equal(c.songVisualMode(myWay), 'video');
  assert.equal(c.referenceVideoTrack(myWay).url, 'my-way.mp4');
  assert.equal(c.songVisualMode(videoOnly), null, 'video-only songs have no switch');
  assert.equal(c.referenceVideoTrack(videoOnly).url, 'pdoom.mp4');
  assert.match(APP, /function activeFxTheme[\s\S]{0,200}referenceVideoTrack\(song\)[\s\S]{0,120}SongMotionFx\?\.track\(song\)/,
    'video mode is checked before the theatre');
});

test('a recording renamed only in capitalization keeps its saved EQ', () => {
  const c = vm.createContext({
    songEqProfiles: { 'songs/christian/Josiah Queen - Demons.m4a': { preamp: -2, gains: [1, 2, 3, 4, 5, 6] } },
    AUDIO_EXTENSION_RE: /\.(mp3|m4a)$/i, createEqProfile: (source = {}) => ({ ...source, made: true }),
    currentSong: () => null,
  });
  vm.runInContext(['songEqKey', 'savedEqForSong', 'normalizeSongRef'].map(extract).join('\n'), c);
  const eq = c.savedEqForSong({ id: 'songs/christian/Josiah Queen - demons.m4a' });
  assert.equal(eq.preamp, -2);
  assert.equal(c.savedEqForSong({ id: 'songs/other.m4a' }).preamp, undefined);
});
