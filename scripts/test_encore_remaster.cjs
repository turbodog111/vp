const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Fx = require('../encore-remaster-fx.js');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'songs/lyrics/encore-dance.json')));
const input = time => ({ time, duration: data.duration, sections: data.sections, bpm: 132, beatOffset: .275, energy: .7 });

function canvas() {
  const calls = [];
  const context = new Proxy({}, {
    set(target, key, value) { calls.push([key, typeof value === 'object' ? 'gradient' : value]); target[key] = value; return true; },
    get(target, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return (...args) => {
        assert(args.every(Number.isFinite)); calls.push([key, ...args]);
        return { addColorStop(position, color) { assert(position >= 0 && position <= 1); assert(!/NaN|undefined|Infinity/.test(color)); calls.push(['stop', position, color]); } };
      };
      return (...args) => {
        assert(args.filter(value => typeof value === 'number').every(Number.isFinite), key);
        if (key === 'arc') assert(args[2] >= 0);
        if (key === 'ellipse') assert(args[2] >= 0 && args[3] >= 0);
        calls.push([key, ...args]);
      };
    }
  });
  return { context, calls };
}

test('choruses have a sustained lift across every final-chorus subsection', () => {
  assert(Fx.stateAt(input(20)).lift < .01);
  assert(Fx.stateAt(input(35)).lift > .99);
  for (let time = 103; time < 136.8; time += .07) assert(Fx.stateAt(input(time)).lift > .99, String(time));
  assert(Fx.stateAt(input(116.64)).lift > .99);
  assert(Fx.stateAt(input(116.66)).lift > .99);
});

test('echoes coexist and each emitted ring only moves outward until it expires', () => {
  assert(Fx.echoesAt(Fx.stateAt(input(35))).length >= 3);
  const first = Fx.echoesAt(Fx.stateAt(input(35)));
  const second = Fx.echoesAt(Fx.stateAt(input(35.1)));
  for (const echo of first) {
    const later = second.find(value => value.index === echo.index);
    if (later) assert(later.radius > echo.radius);
  }
});

test('all scenes are deterministic, moving, finite and bounded at desktop and compact sizes', () => {
  for (const [width, height] of [[1280, 650], [390, 550], [780, 210]]) for (const section of data.sections) {
    const time = section.start + Math.min(1, (section.end - section.start) / 2);
    const a = canvas(), b = canvas(), moving = canvas();
    Fx.draw(a.context, width, height, input(time));
    Fx.draw(b.context, width, height, input(time));
    Fx.draw(moving.context, width, height, input(time + .05));
    assert.deepEqual(a.calls, b.calls);
    assert.notDeepEqual(a.calls, moving.calls);
    assert(a.calls.length < 1500, 'bounded draw operations: ' + a.calls.length);
    assert(a.calls.some(call => call[0] === 'fillRect' && call[3] === width && call[4] === height));
  }
});

test('reduced motion removes travel, echoes and pulse modulation without losing the scene', () => {
  const a = canvas(), b = canvas();
  Fx.draw(a.context, 1280, 650, { ...input(35), reducedMotion: true });
  Fx.draw(b.context, 1280, 650, { ...input(36), reducedMotion: true });
  assert.deepEqual(a.calls, b.calls);
  assert.deepEqual(Fx.echoesAt(Fx.stateAt({ ...input(35), reducedMotion: true })), []);
});

test('end-of-track retains the last scene and cannot schedule more pulse rings', () => {
  const state = Fx.stateAt(input(data.duration));
  assert.equal(state.phase, 10);
  assert.equal(state.pulse, 0);
  assert.deepEqual(Fx.echoesAt(state), []);
});

test('Evil cover is music-only, distinct, hash-bound and in the secular catalog', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'songs/imports/encore-dance-evil.json')));
  const lyrics = JSON.parse(fs.readFileSync(path.join(root, 'songs/lyrics/encore-dance-evil.json')));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'songs/manifest.json')));
  const file = path.join(root, provenance.recording);
  const audio = fs.readFileSync(file);
  assert.equal(manifest.filter(song => 'songs/' + song.name === provenance.recording).length, 1);
  assert.equal(manifest.find(song => 'songs/' + song.name === provenance.recording).size, audio.length);
  assert.equal(crypto.createHash('sha256').update(audio).digest('hex'), provenance.outputAudioSha256);
  assert.equal(lyrics.alignment.audioSha256, provenance.outputAudioSha256);
  assert.equal(provenance.trimStart, 5.89);
  assert.equal(provenance.trimEnd, 140.48);
  assert(Math.abs(lyrics.duration - (provenance.trimEnd - provenance.trimStart)) < .03);
  assert.equal(lyrics.alignment.approved, true);
  assert.equal(lyrics.alignment.approvedBy, 'Joshua Glass');
  assert(lyrics.variants.jp.lines.every(line => line.end < lyrics.duration));
  assert.deepEqual(lyrics.variants.jp.lines, data.variants.jp.lines);
  assert.equal(lyrics.sections.at(-1).end, lyrics.duration);
  const row = require('./audit_lyric_coverage.cjs').audit().find(row => row.recording === provenance.recording);
  assert.equal(row.status, 'approved'); assert.deepEqual(row.missing, []);
});
