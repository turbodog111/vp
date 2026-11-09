const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const lyrics = require('../lyric-workbench.js');
const theater = require('../hunters-fx.js');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const cases = [
  { key: 'golden', file: 'HUNTRIX - Golden.m4a', count: 40, quiet: 25, peak: 65, last: 173.24 },
  { key: 'free', file: 'EJAE & Andrew Choi - Free.m4a', count: 50, quiet: 30, peak: 154, last: 180.59 }
];

function render(key, state, w = 1200, h = 700) {
  const trace = [];
  const call = (key, ...args) => {
    assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)), key);
    trace.push([key, ...args]);
  };
  const ctx = new Proxy({}, {
    set(_, key, value) { call(key, typeof value === 'object' ? 'gradient' : value); return true; },
    get(_, key) {
      if (key === 'createLinearGradient') return (...args) => {
        call(key, ...args);
        return { addColorStop: (...args) => call('stop', ...args) };
      };
      return (...args) => call(key, ...args);
    }
  });
  theater.draw('hunters-' + key, ctx, w, h, state);
  return trace;
}

for (const { key, file, count, quiet, peak, last } of cases) {
  const recording = 'songs/' + file;
  const data = read(`songs/motion/${key}.json`);
  const draft = lyrics.decode(read(`songs/lyrics/aligned/${key}.json`), recording);
  test(`${key}: exact media, lyric and motion identities agree`, () => {
    const bytes = fs.readFileSync(path.join(root, recording));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const song = read('songs/manifest.json').find(entry => entry.name === file);
    const entry = read('songs/lyrics/aligned/manifest.json').find(entry => entry.recording === recording);
    assert.equal(song.size, bytes.length);
    assert.equal(entry.audioSha256, hash);
    assert.equal(entry.status, 'approved');
    assert.equal(data.audioSha256, hash);
    assert.equal(read(`songs/imports/${key}.json`).outputAudioSha256, hash);
    assert.equal(draft.rows.length, count);
    assert.ok(lyrics.validate(draft, data.duration).ready);
    assert.equal(draft.rows.at(-1).end, last);
    assert.equal(lyrics.activeRow(draft.rows, 1), -1);
    assert.equal(lyrics.activeRow(draft.rows, last + .5), -1);
    assert.ok(draft.rows.every(row => row.words.en.length > 0));
    if (key === 'golden') assert.equal(draft.rows.filter(row => /[\uac00-\ud7af]/.test(row.en)).length, 5);
    else {
      assert.ok(draft.rows[42].start > 139 && draft.rows[42].start < 141);
      assert.ok(draft.rows[45].end > 165 && draft.rows[46].start > 167);
    }
  });
  test(`${key}: chorus lift and bounded seek-stable drawing`, () => {
    const frame = { time: peak, sections: data.sections, phase: .3, pulse: .6, bass: .8, duration: data.duration };
    assert.equal(theater.cueAt(data.sections, quiet), 0);
    assert.ok(theater.cueAt(data.sections, peak) >= .95);
    const first = render(key, frame);
    assert.ok(first.length > 150 && first.length < 1600);
    assert.notDeepEqual(first, render(key, { ...frame, time: peak + 1, phase: .6 }));
    assert.deepEqual(first, render(key, frame));
    assert.ok(render(key, frame, 390, 420).length > 150);
    const reduced = { ...frame, reducedMotion: true };
    assert.deepEqual(render(key, reduced), render(key, { ...reduced, pulse: 0, phase: .8, bass: .1 }));
  });
}
