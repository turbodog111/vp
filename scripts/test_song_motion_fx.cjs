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
  ['your-reality-pop-punk', 'The Juicebox feat. Vannamelon - Your Reality (Pop Punk Cover).m4a'],
  ['your-reality-caleb-hyles', 'Caleb Hyles - Your Reality.m4a'],
  ['your-reality-cement-city', 'Cement City feat. Kalcium - Your Reality (Cement City Remix).m4a'],
  ['your-reality-metalized', 'Spyder1246 - Your Reality (Metalized).m4a'],
  ['your-reality-kamex', 'Kamex - Your Reality (Kamex Remix).m4a'],
  ['your-reality-ink-static', 'Joshua Glass & Gemini 4 Neon feat. Jillian Ashcraft - Your Reality (Ink & Static 360).m4a']
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
    assert.ok(Math.abs(data.bpm - { override: 204, 'petal-lament': 170, marshmary: 182, dynamite: 114, butter: 110, 'your-reality': 105, 'your-reality-metal': 105, 'your-reality-pop-punk': 120, 'your-reality-caleb-hyles': 105,
      'your-reality-cement-city': 103, 'your-reality-metalized': 115, 'your-reality-kamex': 105, 'your-reality-ink-static': 105 }[key]) < 1);
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
  for (const [key,name] of recordings.filter(([k])=>k.startsWith('your-reality') && !['your-reality-metalized','your-reality-kamex'].includes(k))) {
    const recording='songs/'+name, config=api.track({path:recording});
    await api.activate(config); pictures.push(render(api,102));
    const entries=catalog.filter(e=>e.recording===recording); assert.equal(entries.length,1);
    const source=JSON.parse(fs.readFileSync(path.join(folder,entries[0].file)));
    const data=dataFor(key), sheet=W.decode(source,recording); timelines.push(sheet.rows);
    assert.equal(source.alignment.audioSha256,data.audioSha256);
    assert.equal(entries[0].audioSha256,data.audioSha256);
    assert.deepEqual(Array.from(W.validate(sheet,data.duration).errors),[]);
    const caleb = key === 'your-reality-caleb-hyles';
    assert.equal(entries[0].lines,caleb ? 22 : 21); assert.equal(sheet.rows.length,entries[0].lines);
    const text=sheet.rows.map(r=>r.en).join('\n')+'\n';
    assert.equal(crypto.createHash('sha256').update(text).digest('hex'),caleb
      ? '7b27ae564d27bf61e768007a51754e4d0b702d4f4dc79b2b7b940864f96e8afa'
      : '578f7a656c9775beee7cc3a0d56faaa2ff84348be53e9f7177b889bf941bc05a');
    assert.equal(sheet.rows.flatMap(r=>r.words.en).length,caleb ? 214 : 210);
    const anchors = caleb
      ? [[0,-1],[9.8,-1],[10.15,0],[20.96,1],[54,-1],[61,7],[99.9,-1],[115.96,13],[136.85,15],[164.65,21],[165.6,21],[166,-1],[179,-1]]
      : key === 'your-reality-pop-punk'
      ? [[9,-1],[19,-1],[19.5,0],[48,5],[52,6],[59,-1],[64,7],[102,-1],[123,14],[128,-1],[148.5,19],[152,-1],[158,20],[160,-1]]
      : key === 'your-reality-cement-city'
      ? [[9,-1],[12,0],[43,5],[48,6],[54,-1],[63,7],[102,-1],[134,-1],[160,19],[165,-1],[168,20],[172,-1]]
      : [[5,-1],[12,0],[43,5],[48,6],[54,-1],[63,7],[102,-1],[134,-1],[165,20],[173,-1]];
    for (const [time,line] of anchors)
      assert.equal(W.activeRow(sheet.rows,time),line, key+' at '+time);
  }
  assert.notDeepEqual(pictures[0],pictures[1]);
  assert.ok(timelines[1][19].end-timelines[0][19].end>2.5,'Rena sustains the penultimate line');
  assert.equal(W.activeRow(timelines[0],162),-1); assert.equal(W.activeRow(timelines[1],162),19);
});

test('Kamex loops verse one and the vocal sample; the guitar-only Metalized never borrows a lyric track', async () => {
  const W=require('../lyric-workbench.js'),catalog=require('../songs/lyrics/aligned/manifest.json');
  const sheet=lyricFor('your-reality-kamex'), original=lyricFor('your-reality');
  const verse=original.rows.slice(0,7).map(r=>r.en);
  const expected=[...verse,...Array(4).fill('That special day')];
  assert.deepEqual(sheet.rows.map(r=>r.en),expected.concat(expected));
  assert.deepEqual(W.validate(W.decode(sheet,sheet.recording),sheet.duration).errors,[]);
  assert.equal(sheet.alignment.audioSha256,dataFor('your-reality-kamex').audioSha256);
  assert.deepEqual([12,19.4,63,67.7,103,116.1,157,164,196,217].map(t=>W.activeRow(sheet.rows,t)),[-1,0,-1,7,-1,11,-1,18,-1,-1]);
  const {api,requests}=create();
  const config=api.track({path:'songs/Spyder1246 - Your Reality (Metalized).m4a'});
  assert.equal(config.lyrics,undefined);assert.ok(!catalog.some(r=>r.recording.includes('Spyder1246')));
  await api.activate(config);assert.equal(requests(),1);
  assert.equal(dataFor(config.key).duration,173.54);
  assert.equal(dataFor('your-reality-kamex').duration,218.43);
});

test('Your Reality: each timed pen stroke uses the exact sung token, including punctuation', async () => {
  const { api } = create();
  for (const [key] of recordings.filter(([k]) => k.startsWith('your-reality') && k!=='your-reality-metalized')) {
    const vocal = api.vocalTimeline(lyricFor(key));
    const caleb = key === 'your-reality-caleb-hyles';
    const sample = key === 'your-reality-kamex';
    assert.equal(vocal.lines.length, caleb || sample ? 22 : 21);
    const words = vocal.lines.flatMap(line => [...line.words]);
    assert.equal(words.length, caleb ? 214 : sample ? 168 : 210);
    const published=lyricFor(key).rows.flatMap(row=>row.words.en);
    words.forEach((word,i)=>{
      assert.deepEqual(Object.keys(word).sort(), ['end','start','text']);
      assert.equal(word.text,published[i].text);
      assert.equal(word.start,published[i].start);assert.equal(word.end,published[i].end);
    });
  }
  assert.equal(api.vocalTimeline(null), null);
  assert.equal(api.vocalTimeline({ rows: [{ words: { en: [{ text: 'x', start: 5, end: 4 }] } }] }), null);
  // A missing lyric file leaves a usable desk, not invented handwriting.
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
  assert.ok(ink(31.86)>0 && ink(32.4)===0, 'a full page turns during the gap before the next line');
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

test("Caleb's music edit keeps every vocal boundary and the instrumental coda on the edited clock", () => {
  const key = 'your-reality-caleb-hyles';
  const receipt = JSON.parse(fs.readFileSync(path.join(root, 'songs/imports', key + '.json')));
  const sheet = lyricFor(key), data = dataFor(key);
  assert.equal(receipt.trimStart, 45.045);
  assert.equal(receipt.trimEnd, 225.7);
  assert.ok(Math.abs(receipt.trimEnd - receipt.trimStart - sheet.duration) < .0001);
  assert.equal(sheet.duration, data.duration);
  const shift = Math.round(receipt.trimStart * 1000);
  const originalClock = sheet.rows.map(row => [row, ...row.words.en].map(cue =>
    [cue.start, cue.end].map(t => Math.round(t * 1000) + shift)));
  // Fingerprint of all checked cues in the previously published full upload.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(originalClock)).digest('hex'),
    '56295e7a3fa6fab03ebd91e16fc450670c472e01e9cd7c76d5971697d9e7ab59');
  assert.equal(sheet.rows[0].start, 9.955);
  assert.equal(sheet.rows.at(-1).end, 165.675);
  const at = t => data.energy[Math.round((t - data.sampleOffset) / data.sampleInterval)];
  assert.ok(at(170) > 30 && at(180.6) <= 2, 'music plays after the last lyric and decays before the end');
});

test('Your Reality metal: recorded pitch onsets cross the playhead independently of syllables', async () => {
  const { api } = create();
  const config = api.track({ path: `songs/${recordings[6][1]}` });
  await api.activate(config);
  const vocal = api.vocalTimeline(lyricFor('your-reality-metal'));
  const fx = scenes.RealityMetalFx;
  assert.equal(fx.voiceAt(vocal, 102), 0, 'the guitar solo has no singing');
  const W = 1280, H = 720;
  const atPlayhead = (calls, name) => calls.filter(([key, x]) => key === name && Math.abs(x - W / 2) < .5);
  const data = dataFor('your-reality-metal'), bar = 4 * 60 / data.bpm;
  const score=require('../reality-score.js');
  const pitches=score.between(data,'vocals',0,data.duration);
  for(const n of [pitches[3],pitches[Math.floor(pitches.length/2)],pitches.at(-4)]){
    const heads=atPlayhead(render(api,n.start,W,H),'ellipse').filter(e=>Math.abs(e[3]-H*.017*.64)<1e-5);
    assert.ok(heads.length>0,`visible head at measured onset ${n.start}`);
  }
  assert.equal(score.between(data,'vocals',101,103).length,0);
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
    const chaptered = name.includes('Override') || name.includes('Symphonic Metal') || name.includes('(Metalized)');
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
