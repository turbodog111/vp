const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const Fx = require('../override-fx.js');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'songs/lyrics/override.json')));
const source = JSON.parse(fs.readFileSync(path.join(root, 'songs/lyrics/sources/override.json')));
const canonical = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function trace(time, reducedMotion = false, w = 1280, h = 650) {
  const calls = [];
  const ctx = new Proxy({}, {
    set(target, key, value) { calls.push([key, typeof value === 'object' ? 'gradient' : value]); target[key] = value; return true; },
    get(target, key) {
      if (key === 'createLinearGradient') return (...args) => {
        assert(args.every(Number.isFinite)); calls.push([key, ...args]);
        return { addColorStop: (...args) => calls.push(['stop', ...args]) };
      };
      return (...args) => {
        assert(args.filter(v => typeof v === 'number').every(Number.isFinite), key);
        if (key === 'arc') assert(args[2] >= 0);
        if (key === 'ellipse') assert(args[2] >= 0 && args[3] >= 0);
        calls.push([key, ...args]);
      };
    }
  });
  Fx.draw(ctx, w, h, { time, reducedMotion, energy: .75 });
  return calls;
}

test('every Override scene moves, is deterministic after seek, and has bounded work', () => {
  for (const scene of Fx.scenes) for (const [w, h] of [[1280, 650], [390, 550], [780, 210]]) {
    const time = scene.start + 1;
    const first = trace(time, false, w, h);
    assert(first.length > 100 && first.length < 1900, `${scene.key}: ${first.length}`);
    assert.deepEqual(first, trace(time, false, w, h));
    assert.notDeepEqual(first, trace(time + .06, false, w, h));
    trace(136, false, w, h);
    assert.deepEqual(first, trace(time, false, w, h));
  }
});

test('both complete choruses receive sustained movement, not short energy-triggered bursts', () => {
  for (const [start, end] of [[40.4, 59.3], [89.85, 108.5]])
    for (let t = start; t < end; t += .08) assert(Fx.stateAt({ time: t }).lift > .99);
  assert.equal(Fx.stateAt({ time: 70 }).lift, 0);
  assert.equal(Fx.stateAt({ time: 140 }).pulse, 0);
});

test('reduced motion is a stable composition rather than a flashing frame', () => {
  for (const scene of Fx.scenes) assert.deepEqual(trace(scene.start + .5, true), trace(scene.start + 1, true));
});

test('all 42 supplied lines and all three languages survive acoustic materialization', () => {
  const lines = data.variants.jp.lines;
  assert.equal(lines.length, 42);
  let previous = 0;
  for (const [i, line] of lines.entries()) {
    assert.equal(line.text, source.rows[i][0]);
    assert.equal(line.romaji.join(' '), source.rows[i][1]);
    assert.equal(line.en.join(' '), source.rows[i][2]);
    assert(line.start >= previous && line.end > line.start && line.end <= data.duration);
    previous = line.end;
    for (const [key, wanted] of [['words', line.text], ['romajiWords', source.rows[i][1]], ['enWords', source.rows[i][2]]]) {
      assert.equal(canonical(line[key].map(w => w.word).join('')), canonical(wanted));
      let end = line.start;
      for (const word of line[key]) {
        assert(word.start >= end - .001 && word.end > word.start && word.end <= line.end + .001);
        end = word.end;
      }
    }
  }
  assert(lines[0].start > 11 && lines[0].start < 13, 'no vocals fabricated during instrumental intro');
  assert(lines.at(-1).end < 129, 'no fabricated lyrics during instrumental coda');
  assert(lines[19].end > 59, 'quiet end of hanarebanare is not cut by a partial ASR anchor');
});

test('published audio, source lyric identity and motion data share recording fingerprints', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'songs/imports/override.json')));
  const motion = JSON.parse(fs.readFileSync(path.join(root, 'songs/motion/override.json')));
  const audio = fs.readFileSync(path.join(root, provenance.recording));
  const hash = crypto.createHash('sha256').update(audio).digest('hex');
  assert.equal(hash, motion.audioSha256);
  assert.equal(hash, data.alignment.audioSha256);
  assert.equal(hash, provenance.outputAudioSha256);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'songs/manifest.json')));
  assert.equal(manifest.filter(s => 'songs/' + s.name === provenance.recording).length, 1);
  assert.equal(manifest.find(s => 'songs/' + s.name === provenance.recording).size, audio.length);
  assert.equal(data.alignment.approved, false, 'preauthorized publishing is not user listening approval');
  assert.equal(data.alignment.publicationAuthorizedBy, 'Joshua Glass');
});

test('parallel renderer uses measured companion tokens when present, preserving older fallbacks', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const start = app.indexOf('function renderTrickHeartLane(');
  const end = app.indexOf('\nfunction renderTrickHeartLine', start);
  const element = { replaceChildren() {}, appendChild() {} };
  const c = vm.createContext({ $: () => element,
    measuredWordTimings: line => line.words,
    trickHeartTokenTimings: () => [{ word: 'fallback', start: 0, end: 1 }],
    document: { createElement: () => ({}) } });
  vm.runInContext(app.slice(start, end), c);
  const line = data.variants.jp.lines[0];
  assert.equal(c.renderTrickHeartLane('x', line.romaji, line, 'romaji')[0].start, line.romajiWords[0].start);
  assert.equal(c.renderTrickHeartLane('x', line.en, line, 'en').length, 1);
  assert.equal(c.renderTrickHeartLane('x', ['old'], { start: 0, end: 1 }, 'romaji')[0].word, 'fallback');
});
