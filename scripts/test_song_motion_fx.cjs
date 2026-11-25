const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'song-motion-fx.js'), 'utf8');
const recordings = [
  ['override', 'Yoshida Yasei feat. Kasane Teto SV - Override.m4a'],
  ['petal-lament', 'MIMI feat. Kasane Teto SV - Petal Lament.m4a'],
  ['marshmary', 'MIMI feat. Hatsune Miku - Marshmary.m4a'],
  ['dynamite', 'BTS - Dynamite.m4a'],
  ['butter', 'BTS - Butter.m4a'],
  ['your-reality', 'Dan Salvato feat. Jillian Ashcraft - Your Reality.m4a'],
  ['your-reality-metal', 'FalKKonE feat. Rena - Your Reality (Intense Symphonic Metal Cover).m4a'],
  ['your-reality-pop-punk', 'The Juicebox feat. Vannamelon - Your Reality (Pop Punk Cover).m4a']
];
const dataFor = key => JSON.parse(fs.readFileSync(path.join(root, 'songs/motion', `${key}.json`)));
const lyricFor = key => JSON.parse(fs.readFileSync(path.join(root, 'songs/lyrics/aligned', `${key}.json`)));
const scenes = { OverrideFx: require('../override-fx.js'), RealityMetalFx: require('../your-reality-metal-fx.js'),
  RealityLetterFx: require('../your-reality-fx.js') };
function create(fetcher, reduced = false) {
  let requests = 0;
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: reduced }), ...scenes },
    AbortController, setTimeout, clearTimeout, console: { warn() {} },
    fetch: async (url, options) => {
      requests++;
      if (fetcher) return fetcher(url, options);
      const key = path.basename(url, '.json');
      return { ok: true, json: async () => url.includes('/lyrics/aligned/') ? lyricFor(key) : dataFor(key) };
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

test('recording-specific scenes match exact filenames, not similar covers', () => {
  const { api } = create();
  for (const [key, name] of recordings) {
    assert.equal(api.track({ path: `songs/${name}` }).key, key);
    assert.equal(api.track({ path: `songs/${name.toUpperCase().replace('.M4A', '.MP3')}` }).key, key);
  }
  assert.equal(api.track({ path: 'songs/Other Artist - Marshmary.m4a' }), null);
  assert.equal(api.track({ path: 'songs/MIMI feat. Hatsune Miku - Marshmary (Cover).m4a' }), null);
  assert.equal(api.track({ path: 'songs/BTS - Butter (Remix).m4a' }), null);
  assert.equal(api.track({ path: 'songs/Other Artist - Dynamite.m4a' }), null);
  assert.equal(api.track({ path: 'songs/Other Artist - Your Reality.m4a' }), null);
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
    const config = create().api.track({ path: `songs/${name}` });
    if (key.startsWith('your-reality')) {
      const receipt = JSON.parse(fs.readFileSync(path.join(root, 'songs/imports', key+'.json')));
      assert.equal(receipt.recording, `songs/${name}`);
      assert.equal(receipt.source, config.source);
      assert.equal(receipt.outputAudioSha256, data.audioSha256);
      assert.ok(Math.abs(receipt.duration - data.duration) < .01);
      assert.equal(config.art, undefined, 'both stages are entirely procedural');
    } else assert.ok(fs.statSync(path.join(root, 'songs/art', `${key}.webp`)).size > 1000);
    for (const band of ['energy', 'bass', 'high', 'onset']) {
      assert.ok(data[band].every(x => Number.isFinite(x) && x >= 0 && x <= 100));
      assert.ok(Math.abs(data[band].length * data.sampleInterval - data.duration) < 0.1);
    }
    assert.equal(data.sampleInterval, 0.04);
    assert.ok(Math.abs(data.bpm - { override: 204, 'petal-lament': 170, marshmary: 182, dynamite: 114, butter: 110, 'your-reality': 105, 'your-reality-metal': 105, 'your-reality-pop-punk': 120 }[key]) < 1);
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

test('Your Reality: distinct stages, the full supplied sheet, independently timed singing and instrumental rests', async () => {
  const W = require('../lyric-workbench.js');
  const {api}=create(), folder=path.join(root,'songs/lyrics/aligned');
  const catalog=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  const acts=require('../your-reality-metal-fx.js').arrangement;
  assert.equal(acts(25).tutti,0); assert.equal(acts(64).tutti,1);
  assert.equal(acts(102).solo,1); assert.equal(acts(144).peak,1); assert.equal(acts(171).tail,1);
  const pictures=[], timelines=[];
  for (const [key,name] of recordings.filter(([k])=>k.startsWith('your-reality'))) {
    const recording='songs/'+name, config=api.track({path:recording});
    await api.activate(config); pictures.push(render(api,102));
    const entries=catalog.filter(e=>e.recording===recording); assert.equal(entries.length,1);
    const source=JSON.parse(fs.readFileSync(path.join(folder,entries[0].file)));
    const data=dataFor(key), sheet=W.decode(source,recording); timelines.push(sheet.rows);
    assert.equal(source.alignment.audioSha256,data.audioSha256);
    assert.equal(entries[0].audioSha256,data.audioSha256);
    assert.deepEqual(Array.from(W.validate(sheet,data.duration).errors),[]);
    assert.equal(entries[0].lines,21); assert.equal(sheet.rows.length,21);
    const text=sheet.rows.map(r=>r.en).join('\n')+'\n';
    assert.equal(crypto.createHash('sha256').update(text).digest('hex'),'578f7a656c9775beee7cc3a0d56faaa2ff84348be53e9f7177b889bf941bc05a');
    assert.equal(sheet.rows.flatMap(r=>r.words.en).length,210);
    const anchors = key === 'your-reality-pop-punk'
      ? [[9,-1],[19,-1],[19.5,0],[48,5],[52,6],[59,-1],[64,7],[102,-1],[123,14],[128,-1],[148.5,19],[152,-1],[158,20],[160,-1]]
      : [[5,-1],[12,0],[43,5],[48,6],[54,-1],[63,7],[102,-1],[134,-1],[165,20],[173,-1]];
    for (const [time,line] of anchors)
      assert.equal(W.activeRow(sheet.rows,time),line, key+' at '+time);
  }
  assert.notDeepEqual(pictures[0],pictures[1]);
  assert.ok(timelines[1][19].end-timelines[0][19].end>2.5,'Rena sustains the penultimate line');
  assert.equal(W.activeRow(timelines[0],162),-1); assert.equal(W.activeRow(timelines[1],162),19);
});

test('Your Reality: scenes receive when each word is sung and how long it is, never the words', async () => {
  const { api } = create();
  for (const [key] of recordings.filter(([k]) => k.startsWith('your-reality'))) {
    const vocal = api.vocalTimeline(lyricFor(key));
    assert.equal(vocal.lines.length, 21);
    const words = vocal.lines.flatMap(line => [...line.words]);
    assert.equal(words.length, 210);
    for (const word of words) {
      assert.deepEqual(Object.keys(word).sort(), ['end', 'n', 'start']);
      assert.ok(word.end > word.start && word.n >= 1 && word.n <= 14);
    }
  }
  assert.equal(api.vocalTimeline(null), null);
  assert.equal(api.vocalTimeline({ rows: [{ words: { en: [{ text: 'x', start: 5, end: 4 }] } }] }), null);
  // A missing lyric file leaves the scene on its beat-timed fallback rather than failing.
  const { api: offline } = create(async url => url.includes('/lyrics/')
    ? { ok: false, status: 404 } : { ok: true, json: async () => dataFor(path.basename(url, '.json')) });
  await offline.activate(offline.track({ path: `songs/${recordings[5][1]}` }));
  assert.ok(render(offline, 40).length > 100);
});

test('Your Reality letter: the pen writes only while she sings, rests in the instrumentals, and starts new pages', () => {
  const { api } = create();
  const fx = scenes.RealityLetterFx, vocal = api.vocalTimeline(lyricFor('your-reality'));
  const plan = fx.plan(vocal), ink = t => fx.inkAmount(vocal, t);
  assert.equal(plan.pages.length, 8);
  assert.ok(plan.pages.every(page => page.lines.length >= 1 && page.lines.length <= 3));
  assert.deepEqual(plan.pages.flatMap(page => page.lines.map(line => line.index)), [...Array(21).keys()]);
  const first = vocal.lines[0].words[0];
  assert.equal(ink(first.start - .5), 0, 'nothing is written before she sings');
  assert.ok(ink(first.start + .12) > 0 && ink(first.start + .12) < ink(first.start + .3), 'the first word is written as it is sung');
  assert.equal(ink(16), ink(18.8), 'the pen waits through the rest between lines');
  assert.ok(ink(100) > 0 && ink(100) === ink(110), 'the page stays written through the instrumental');
  assert.ok(ink(31.9) > 0 && ink(32.4) === 0, 'a full page clears before the next line begins');
  const mid = vocal.lines[3].words[2];
  assert.equal(fx.penAt(vocal, (mid.start + Math.min(mid.end, mid.start + .15)) / 2).writing, true);
  const resting = fx.penAt(vocal, 105);
  assert.equal(resting.writing, false);
  assert.equal(resting.lift, 1, 'the pen is lifted off the page while the piano plays alone');
  assert.equal(fx.penAt(vocal, 176).alpha, 0, 'the pen is put away when the letter is finished');
  assert.ok(Math.abs(plan.sealAt - (vocal.lines[20].end + 2.4)) < 1e-9);
});

test('pop-punk shares the original letter, not its audio clock or final note', async () => {
  const { api } = create();
  const get = key => api.track({path: 'songs/' + recordings.find(([k]) => k === key)[1]});
  const original = get('your-reality'), cover = get('your-reality-pop-punk');
  assert.equal(original.theme, cover.theme);
  assert.notEqual(original.lyrics, cover.lyrics);
  assert.notEqual(original.data, cover.data);
  const fx = scenes.RealityLetterFx, vocal = api.vocalTimeline(lyricFor(cover.key));
  assert.equal(fx.inkAmount(vocal, 12), 0, 'the spoken intro does not start the pen');
  assert.equal(fx.inkAmount(vocal, 100), fx.inkAmount(vocal, 108), 'no words are written during the instrumental');
  const goodbye = vocal.lines.at(-1).words.at(-1);
  assert.ok(goodbye.start > 153 && goodbye.start < 154 && goodbye.end > 159.5 && goodbye.end < 160);
  const { sealAt } = fx.plan(vocal);
  assert.ok(sealAt > goodbye.end && sealAt + .45 < vocal.duration, 'the seal lands before the track ends');
  await api.activate(original);
  const frame = render(api, 12);
  await api.activate(cover);
  assert.notDeepEqual(render(api, 12), frame, 'the original is sung here, the cover is not');
  await api.activate(original);
  assert.deepEqual(render(api, 12), frame);
});

test('Your Reality metal: notes cross the playhead as words are sung; bar lines cross it on downbeats', async () => {
  const { api } = create();
  const config = api.track({ path: `songs/${recordings[6][1]}` });
  await api.activate(config);
  const vocal = api.vocalTimeline(lyricFor('your-reality-metal'));
  const fx = scenes.RealityMetalFx;
  assert.equal(fx.voiceAt(vocal, 102), 0, 'the guitar solo has no singing');
  const W = 1280, H = 720;
  const atPlayhead = (calls, name) => calls.filter(([key, x]) => key === name && Math.abs(x - W / 2) < .5);
  for (const word of [vocal.lines[2].words[1], vocal.lines[9].words[0], vocal.lines[15].words[3]]) {
    assert.equal(fx.voiceAt(vocal, word.start + .01), 1);
    assert.ok(atPlayhead(render(api, word.start, W, H), 'ellipse').length >= 1, `a note head at the playhead at ${word.start}`);
  }
  const data = dataFor('your-reality-metal'), bar = 4 * 60 / data.bpm;
  const downbeat = data.beatOffset + 30 * bar;
  assert.ok(atPlayhead(render(api, downbeat, W, H), 'moveTo').length >= 1, 'a bar line at the playhead on the downbeat');
});

test('Your Reality: the busiest frames stay within the drawing budget', async () => {
  const { api } = create();
  for (const [, name] of recordings.filter(([k]) => k.startsWith('your-reality'))) {
    await api.activate(api.track({ path: `songs/${name}` }));
    for (const time of [12, 32.6, 50, 88, 102, 145, 158, 168, 178]) {
      const count = render(api, time).length;
      assert.ok(count < 5000, `${name} at ${time}: ${count} drawing calls`);
    }
  }
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
    // Narrative chapter changes are retained; motion inside a chapter is frozen.
    const chaptered = name.includes('Override') || name.includes('Symphonic Metal');
    assert.deepEqual(render(api, 15), render(api, chaptered ? 16 : 90), name);
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
