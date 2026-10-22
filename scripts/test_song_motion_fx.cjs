const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'song-motion-fx.js'), 'utf8');
const recordings = [
  ['petal-lament', 'MIMI feat. Kasane Teto SV - Petal Lament.m4a'],
  ['marshmary', 'MIMI feat. Hatsune Miku - Marshmary.m4a'],
  ['dynamite', 'BTS - Dynamite.m4a'],
  ['butter', 'BTS - Butter.m4a']
];
const dataFor = key => JSON.parse(fs.readFileSync(path.join(root, 'songs/motion', `${key}.json`)));
function create(fetcher, reduced = false) {
  let requests = 0;
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: reduced }) },
    AbortController, setTimeout, clearTimeout, console: { warn() {} },
    fetch: async (url, options) => {
      requests++;
      if (fetcher) return fetcher(url, options);
      return { ok: true, json: async () => dataFor(path.basename(url, '.json')) };
    }
  });
  vm.runInContext(source, context);
  return { api: context.window.SongMotionFx, requests: () => requests };
}
function canvasTrace() {
  const calls = [];
  const context = new Proxy({}, {
    set(target, key, value) { calls.push([key, value]); target[key] = value; return true; },
    get(target, key) {
      if (key === 'createLinearGradient') return (...args) => {
        calls.push([key, ...args]);
        return { addColorStop: (...stops) => calls.push(['colorStop', ...stops]) };
      };
      return (...args) => {
        for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${key}: finite geometry`);
        calls.push([key, ...args]);
      };
    }
  });
  return { context, calls };
}
function render(api, time, width = 1280, height = 720) {
  const trace = canvasTrace();
  api.draw(trace.context, width, height, { time, energy: 0.4 });
  // Compare recorded drawing operations, not gradient method identities or VM prototypes.
  return JSON.parse(JSON.stringify(trace.calls));
}

test('only the four exact recordings receive their own scenes', () => {
  const { api } = create();
  for (const [key, name] of recordings) {
    assert.equal(api.track({ path: `songs/${name}` }).key, key);
    assert.equal(api.track({ path: `songs/${name.toUpperCase().replace('.M4A', '.MP3')}` }).key, key);
  }
  assert.equal(api.track({ path: 'songs/Other Artist - Marshmary.m4a' }), null);
  assert.equal(api.track({ path: 'songs/MIMI feat. Hatsune Miku - Marshmary (Cover).m4a' }), null);
  assert.equal(api.track({ path: 'songs/BTS - Butter (Remix).m4a' }), null);
  assert.equal(api.track({ path: 'songs/Other Artist - Dynamite.m4a' }), null);
  assert.equal(api.track(null), null);
});

for (const [key, name] of recordings) {
  test(`${key}: manifest, media fingerprint, artwork and motion coverage agree`, () => {
    const media = fs.readFileSync(path.join(root, 'songs', name));
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'songs/manifest.json')));
    assert.equal(manifest.filter(x => x.name === name).length, 1);
    assert.equal(manifest.find(x => x.name === name).size, media.length);
    const data = dataFor(key);
    assert.equal(crypto.createHash('sha256').update(media).digest('hex'), data.audioSha256);
    assert.ok(fs.statSync(path.join(root, 'songs/art', `${key}.webp`)).size > 1000);
    for (const band of ['energy', 'bass', 'high', 'onset']) {
      assert.ok(data[band].every(x => Number.isFinite(x) && x >= 0 && x <= 100));
      assert.ok(Math.abs(data[band].length * data.sampleInterval - data.duration) < 0.1);
    }
    assert.equal(data.sampleInterval, 0.04);
    assert.ok(Math.abs(data.bpm - { 'petal-lament': 170, marshmary: 182, dynamite: 114, butter: 110 }[key]) < 1);
    const config = create().api.track({ path: `songs/${name}` });
    assert.equal(config.bpm, data.bpm, 'fallback uses the measured tempo');
    assert.equal(config.beatOffset, data.beatOffset, 'fallback uses the measured phase');
  });

  test(`${key}: pause/seek renders are deterministic, moving and bounded`, async () => {
    const { api } = create();
    const config = api.track({ path: `songs/${name}` });
    await api.activate(config);
    const first = render(api, 35);
    assert.deepEqual(render(api, 35), first, 'same media time freezes the scene');
    assert.notDeepEqual(render(api, 36), first, 'later media time visibly moves');
    render(api, 150);
    assert.deepEqual(render(api, 35), first, 'seeking back reconstructs the exact scene');
    assert.ok(first.length < 5000, 'bounded drawing work, no accumulating particles');
    for (const [w, h] of [[360, 480], [640, 250], [1920, 1080]]) assert.ok(render(api, 42, w, h).length > 100);
    const data = dataFor(key);
    const quietIndex = data.energy.indexOf(Math.min(...data.energy));
    const loudIndex = data.energy.indexOf(Math.max(...data.energy));
    assert.ok(api.motionAt(config, loudIndex * 0.04 + data.sampleOffset).energy
      > api.motionAt(config, quietIndex * 0.04 + data.sampleOffset).energy + 0.5);
    await api.activate(null);
    assert.equal(render(api, 35).length, 0, 'FX off tears down the active scene');
  });
}

test('late data from the previous song cannot reactivate it', async () => {
  const pending = [];
  const { api } = create((url, options) => new Promise(resolve => pending.push({ url, options, resolve })));
  let oldReady = 0, newReady = 0;
  const petal = api.track({ path: `songs/${recordings[0][1]}` });
  const marsh = api.track({ path: `songs/${recordings[1][1]}` });
  const a = api.activate(petal, () => oldReady++);
  const b = api.activate(marsh, () => newReady++);
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve({ ok: true, json: async () => dataFor('marshmary') });
  await b;
  const expected = render(api, 35);
  pending[0].resolve({ ok: true, json: async () => dataFor('petal-lament') });
  await a;
  assert.deepEqual(render(api, 35), expected);
  assert.equal(oldReady, 0);
  assert.equal(newReady, 1);
});

test('cached motion data needs no repeat download when switching back', async () => {
  const { api, requests } = create();
  const config = api.track({ path: `songs/${recordings[0][1]}` });
  await api.activate(config); await api.activate(null); await api.activate(config);
  assert.equal(requests(), 1);
});

test('failed or malformed motion data still draws the live fallback', async () => {
  for (const response of [{ ok: false, status: 503 }, { ok: true, json: async () => ({ version: 1, energy: [NaN] }) }]) {
    const { api } = create(async () => response);
    const config = api.track({ path: `songs/${recordings[0][1]}` });
    await api.activate(config);
    assert.equal(api.motionAt(config, 20, 0.3).energy, 0.3);
    assert.ok(render(api, 20).length > 100);
  }
});

test('reduced motion removes traveling objects and beat pulses for every scene', async () => {
  const constant = { ...dataFor('marshmary'), energy: Array(6000).fill(60),
    bass: Array(6000).fill(60), high: Array(6000).fill(60), onset: Array(6000).fill(60) };
  const { api } = create(async () => ({ ok: true, json: async () => constant }), true);
  for (const [, name] of recordings) {
    await api.activate(api.track({ path: `songs/${name}` }));
    assert.deepEqual(render(api, 15), render(api, 90), name);
  }
});

test('switching between every scene pair never leaves the previous scene active', async () => {
  const { api } = create();
  const configs = recordings.map(([, name]) => api.track({ path: `songs/${name}` }));
  const expected = [];
  for (const config of configs) { await api.activate(config); expected.push(render(api, 42)); }
  for (const from of configs) for (let to = 0; to < configs.length; to++) {
    await api.activate(from); await api.activate(configs[to]);
    assert.deepEqual(render(api, 42), expected[to]);
  }
  assert.notDeepEqual(expected[2], expected[3], 'BTS songs have independent renderers');
});

test('beat phase and energy follow media time, including silence after the recording', async () => {
  const { api } = create();
  for (const [key, name] of recordings) {
    const config = api.track({ path: `songs/${name}` });
    await api.activate(config);
    const data = dataFor(key), beat = data.beatOffset + 20 * 60 / data.bpm;
    assert.ok(Math.abs(api.motionAt(config, beat).beats - 20) < 1e-8);
    assert.equal(api.motionAt(config, data.duration + 1).energy, 0);
    assert.equal(api.motionAt(config, -1).energy, 0);
  }
});
