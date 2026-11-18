const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const scene = require('../mesmerizer-fx.js');
const root = path.resolve(__dirname, '..');
const file = name => fs.readFileSync(path.join(root, name));
const json = name => JSON.parse(file(name));
const manifest = json('songs/manifest.json');
const configFiles = ['original', 'stetson', 'artsy'];

function engine(reduced = false) {
  const sandbox = {
    window: { MesmerizerFx: scene, matchMedia: () => ({ matches: reduced }) },
    AbortController, setTimeout, clearTimeout, console,
    fetch: async url => ({ ok: true, json: async () => json(url) }),
  };
  vm.runInNewContext(file('song-motion-fx.js').toString(), sandbox);
  return sandbox.window.SongMotionFx;
}

function draw(api, time, w = 1280, h = 670) {
  const trace = [];
  const record = (name, ...args) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), name);
    trace.push([name, ...args.map(value => typeof value === 'object' ? 'gradient' : value)]);
  };
  const ctx = new Proxy({}, {
    set(_, key, value) { record(key, value); return true; },
    get(_, key) {
      if (key === 'createLinearGradient') return (...args) => {
        record(key, ...args);
        return { addColorStop: (...stops) => record('stop', ...stops) };
      };
      return (...args) => record(key, ...args);
    }
  });
  api.draw(ctx, w, h, { time, energy: .3 });
  return trace;
}

for (const variant of configFiles) {
  test(`Mesmerizer ${variant}: recording identity, chapter moves and deterministic seeks`, async () => {
    const key = 'mesmerizer-' + variant;
    const credits = json(`songs/imports/${key}.json`);
    const data = json(`songs/motion/${key}.json`);
    const media = file(credits.recording);
    assert.equal(manifest.find(row => row.name === path.basename(credits.recording)).size, media.length);
    const digest = createHash('sha256').update(media).digest('hex');
    assert.equal(digest, data.audioSha256);
    assert.equal(digest, credits.outputAudioSha256);
    const api = engine();
    const config = api.track({ path: credits.recording });
    assert.equal(config.variant, variant);
    assert.equal(config.source, credits.source);
    assert.equal(config.beatOffset, data.beatOffset);
    assert.equal(config.bpm, data.bpm);
    assert.equal(api.track({ path: 'songs/Other Artist - Mesmerizer.m4a' }), null);
    await api.activate(config);
    assert.equal(scene.chapter(variant, 72).index, 3);
    assert.equal(scene.chapter(variant, 88).index, 4);
    assert.equal(scene.chapter(variant, 135).index, 6);
    const peak = draw(api, 135);
    assert.ok(peak.length > 100 && peak.length < 2500);
    assert.notDeepEqual(peak, draw(api, 135.2));
    assert.notDeepEqual(peak, draw(api, 88));
    assert.deepEqual(peak, draw(api, 135));
    assert.ok(draw(api, 135, 360, 440).length > 100);
    await api.activate(null);
    assert.deepEqual(draw(api, 135), []);
  });
}

test('Mesmerizer variant changes are distinct and reduced motion freezes within a chapter', async () => {
  const api = engine(true);
  const renderers = [];
  for (const variant of configFiles) {
    const credits = json(`songs/imports/mesmerizer-${variant}.json`);
    await api.activate(api.track({ path: credits.recording }));
    const peak = draw(api, 132);
    assert.deepEqual(peak, draw(api, 137));
    renderers.push(JSON.stringify(peak));
  }
  assert.equal(new Set(renderers).size, 3);
});
