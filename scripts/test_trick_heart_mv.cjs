// Trick Heart's 3D music video ("The Card Trick"): the lyrics lead as 3D lettering above
// a velvet card table, every sung character in frame and facing the camera, cuts with a
// reason on the beat, a gentle camera, the props telling the story (the ace that
// vanishes, the curtain, the house of cards, the heart), no characters, reproducible
// frames, a 2D fallback, and the page's title, artist, play button and times.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../mv3d.js');
const L = require('../mv-lyrics3d.js');
const Mv = require('../trick-heart-mv.js');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'songs/lyrics/trick-heart.json'), 'utf8'));
const lines = Mv.linesFromPhrases(data.lines);
const lyrics = { lines, offset: 0, language: 'jp' };
const input = (time, extra = {}) => ({ time, duration: data.duration, sections: data.sections, bpm: data.bpm, beatOffset: data.beatOffset,
  width: 1280, height: 720, lyrics, ...extra });
const finite = values => values.every(Number.isFinite);
const section = phase => data.sections.find(s => s.phase === phase);

function project(f, p, aspect) {
  const view = K.lookAt(f.cam.eye, f.cam.target, f.cam.roll, f.cam.up);
  const vp = K.mul(K.perspective(f.cam.fov * Math.PI / 180, aspect, .08, 400), view);
  const x = K.apply(vp, p), w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return w > 0 ? [(x[0] / w + 1) / 2, (x[1] / w + 1) / 2] : null;
}

test('the phrase lists become lines that keep every phrase, joined in at most two halves', () => {
  assert.equal(lines.length, data.lines.length);
  lines.forEach((line, k) => {
    const source = data.lines[k];
    assert.equal(line.text.replace(/ /g, ''), source.jp.join(''), 'no Japanese is lost or changed');
    assert.ok(line.text.split(' ').length <= 2, 'at most one break');
    if (line.text.includes(' ')) {
      const [a] = line.text.split(' ');
      assert.ok(source.jp.some((_, i) => source.jp.slice(0, i + 1).join('') === a), 'breaks between phrases');
    }
    assert.deepEqual(line.romaji, source.romaji);
    assert.deepEqual(line.en, source.en);
    assert.equal(line.start, source.start);
  });
});

test('every cut has a reason and lands on the beat, and the edit covers the whole song', () => {
  const tl = Mv.timeline(input(0));
  const model = L.lyricModel(lyrics, tl);
  const shots = Mv.planShots(tl, model);
  assert.equal(shots[0].start, 0);
  assert.equal(shots.at(-1).end, data.duration);
  for (let k = 1; k < shots.length; k++) assert.equal(shots[k].start, shots[k - 1].end, 'no gaps');
  const starts = new Set(data.sections.map(s => s.start));
  for (const s of data.sections) assert.ok(shots.some(shot => shot.start === s.start), 'a cut at ' + s.start);
  for (const shot of shots) {
    if (starts.has(shot.start)) continue;
    const s = tl.sections[shot.section], where = `cut at ${shot.start.toFixed(2)} (${shot.kind})`;
    const beats = (shot.start - tl.offset) / tl.period;
    assert.ok(Math.abs(beats - Math.round(beats)) < 1e-6, 'on the beat: ' + where);
    const newLine = model.some(line => Math.abs(shot.start - line.enterAt) <= tl.period / 2 + 1e-6);
    const sung = model.some(line => line.start >= s.start - .3 && line.start < s.end - .3);
    const bar = (shot.start - (tl.offset + Math.round((s.start - tl.offset) / tl.period) * tl.period)) / tl.period;
    assert.ok(newLine || (!sung && Math.abs(bar / 8 - Math.round(bar / 8)) < 1e-6), 'a new line or the next bar: ' + where);
    assert.ok(shot.end - shot.start > 1.75, 'no flash cuts: ' + where);
  }
  assert.ok(new Set(shots.map(s => s.kind)).size >= 14, 'many kinds of move');
});

test('every lyric line is in frame, facing the camera and fully drawn while it is sung', () => {
  for (const [width, height] of [[1280, 720], [390, 640]]) {
    const aspect = width / height;
    let checked = 0;
    const model = Mv.frameAt(input(0, { width, height })).model;
    for (const line of model) {
      for (const time of [line.start + .35, (line.start + line.end) / 2, line.end - .1]) {
        if (time >= line.exitAt) continue;
        const f = Mv.frameAt(input(time, { width, height }));
        for (const g of f.text.filter(g => g.line === line.index && g.role === 'main' && g.sung)) {
          const centre = K.apply(g.m, [0, .36 * g.size, 0]);
          const p = project(f, centre, aspect);
          const where = `${width}x${height} line ${line.index} "${g.ch}" at ${time.toFixed(2)} (${f.shot.kind})`;
          assert.ok(p && p[0] > .01 && p[0] < .99 && p[1] > .05 && p[1] < .95, 'on screen: ' + where);
          const facing = K.v3.dot(K.v3.norm(K.applyDir(g.m, [0, 0, 1])), K.v3.norm(K.v3.sub(f.cam.eye, centre)));
          assert.ok(facing > .3, 'faces the camera: ' + where);
          assert.ok(g.alpha > .99, 'fully drawn once sung: ' + where);
          checked++;
        }
      }
    }
    assert.ok(checked > 400, `${width}x${height}: checked ${checked} sung characters`);
  }
});

test('the camera moves gently, keeps moving, and every frame is reproducible', () => {
  const tl = Mv.timeline(input(0));
  for (let time = .2; time < data.duration - .3; time += .7) {
    const a = Mv.frameAt(input(time)), b = Mv.frameAt(input(time));
    assert.deepEqual(a.cam, b.cam);
    assert.deepEqual(a.text.map(g => Array.from(g.m)), b.text.map(g => Array.from(g.m)));
    assert.ok(finite([...a.cam.eye, ...a.cam.target, a.cam.fov]) && a.cam.fov >= 20 && a.cam.fov <= 80);
    assert.ok(a.cam.eye[1] > .2, 'above the floor');
    const later = Mv.frameAt(input(time + .05));
    assert.ok(K.v3.dist(a.cam.eye, later.cam.eye) + K.v3.dist(a.cam.target, later.cam.target) > 1e-4, `moves at ${time.toFixed(1)} (${a.shot.kind})`);
    if (later.shot === a.shot && a.shot.kind !== 'lyricRush') {
      const dir = f => K.v3.norm(K.v3.sub(f.cam.target, f.cam.eye));
      const turn = Math.acos(Math.min(1, K.v3.dot(dir(a), dir(later)))) / .05;
      assert.ok(turn < .6, `turns at ${turn.toFixed(2)} rad/s in ${a.shot.kind}`);
    }
    assert.ok(Math.abs(a.cam.roll) < .02, 'level horizon');
  }
  assert.ok(tl.sections.length === data.sections.length);
});

test('the props tell the story: the ace vanishes, the curtain rises and falls, the house is built and falls, the heart appears', () => {
  const at = time => Mv.frameAt(input(time)).env;
  const vanish = lines.find(line => /消/.test(line.text)).start;
  assert.ok(at(vanish - .5).ace > .99 && at(vanish + .6).ace < .01, 'the ace vanishes as the line about it is sung');
  assert.equal(at(5).curtain, 0);
  assert.ok(at(section(1).end - .2).curtain > .9, 'the curtain rises');
  assert.equal(at(30).curtain, 1);
  const verse = section(4);
  assert.ok(at(verse.start + 2).built < 2 && at(verse.end - .5).built === Mv.HOUSE.length, 'the house of cards is built through the second verse');
  assert.ok(at(section(6).start + 5).curtain < .05, 'the curtain closes for the intermission');
  const reveal = section(7);
  assert.ok(at(reveal.start + 2).collapse === 1 && at(reveal.start + 5).heart > .9, 'the house falls and the heart rises');
  assert.ok(at(140).tornado && at(140).heart === 1, 'cards circle the heart in the final chorus');
  assert.ok(at(data.duration - .1).curtain < .05, 'the curtain falls at the end');
  const title = Mv.frameAt(input(section(6).start + 8)).text.filter(g => g.role === 'title');
  assert.equal(title.map(g => g.ch).join(''), 'TRICKHEART');
});

test('Reduce motion holds one still camera per section, still lettering and no flashes', () => {
  const tl = Mv.timeline(input(0, { reducedMotion: true }));
  assert.equal(Mv.planShots(tl, L.lyricModel(lyrics, tl)).length, data.sections.length);
  for (const s of data.sections) {
    const a = Mv.frameAt(input(s.start + .3, { reducedMotion: true })), b = Mv.frameAt(input(Math.min(s.end - .05, s.start + 2), { reducedMotion: true }));
    assert.deepEqual(a.cam, b.cam, 'still camera through ' + s.name);
    if (a.t > 1.9) assert.equal(a.post.flash, 0);
    assert.equal(a.post.speedLines, 0);
  }
  const line = lines[12];
  const a = Mv.frameAt(input(line.start + .5, { reducedMotion: true })).text.filter(g => g.role === 'main');
  const b = Mv.frameAt(input(line.start + 1, { reducedMotion: true })).text.filter(g => g.role === 'main');
  assert.deepEqual(a.map(g => Array.from(g.m)), b.map(g => Array.from(g.m)), 'lettering holds still');
});

test('the renderer path draws every frame within budget and without characters', () => {
  const count = { draw: 0, dynamic: 0, points: 0, quads: 0, frames: 0 };
  const renderer = {
    begin: () => true, lost: () => false, mirror() {}, sky() {}, lights() {}, dispose() {}, resetGlyphs() {}, glyphEpoch: 0,
    glyph: ch => ({ advance: L.approxAdvance(ch), u0: 0, v0: 0, u1: .0625, v1: .0625, top: 1.1, bottom: -.43, half: .76 }),
    camera: c => assert.ok(finite([...c.eye, ...c.target, c.fov])),
    draw: (g, m) => { assert.ok(finite(Array.from(m)), 'finite model matrix'); count.draw++; },
    drawDynamic: () => { count.dynamic++; },
    beam: (apex, dir, length, radius, color, intensity) => assert.ok(finite([...apex, ...dir, length, radius, intensity])),
    points: (d, n) => { assert.ok(finite(Array.from(d.subarray(0, n * 9)))); count.points += n; },
    text: (d, quads) => { assert.ok(finite(Array.from(d.subarray(0, quads * 56)))); count.quads += quads; },
    end: o => assert.ok(o.letterbox >= 0 && o.letterbox < .2),
    project: () => [.5, .5, 1],
  };
  const mv = Mv.create(null, { renderer });
  for (let time = 0; time <= data.duration; time += .4) {
    const state = mv.draw(input(time));
    assert.ok(state && state.palette.primary.every(v => v >= 0 && v <= 255));
    count.frames++;
  }
  assert.equal(count.dynamic, 0, 'no characters or other rebuilt shapes');
  assert.ok(count.draw / count.frames < 160, 'draw calls per frame: ' + (count.draw / count.frames).toFixed(1));
  assert.ok(count.points / count.frames < 3000, 'point sprites per frame');
  assert.ok(count.quads / count.frames > 50 && count.quads / count.frames < 6000, 'lettering quads per frame');
});

test('every solid shape faces outward, which the ink outlines depend on', () => {
  for (const [name, g] of Object.entries(Mv.buildGeometry())) {
    if (!g || !g.i || !g.p) continue;
    let bad = 0;
    for (let k = 0; k < g.i.length; k += 3) {
      const [a, b, c] = [g.i[k], g.i[k + 1], g.i[k + 2]].map(i => [g.p[i * 3], g.p[i * 3 + 1], g.p[i * 3 + 2]]);
      const face = K.v3.cross(K.v3.sub(b, a), K.v3.sub(c, a));
      if (K.v3.len(face) < 1e-9) continue;
      const i = g.i[k], n = [g.n[i * 3], g.n[i * 3 + 1], g.n[i * 3 + 2]];
      if (K.v3.dot(face, n) < 0) bad++;
    }
    assert.equal(bad, 0, name + ' has inward-facing triangles');
  }
});

test('the page draws Trick Heart in 3D with a 2D fallback and keeps the title, artist and controls', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(html, /<canvas id="trick-heart-gl" class="motion-gl-canvas" aria-hidden="true"><\/canvas>/);
  const order = ['mv3d.js', 'mv-lyrics3d.js', 'trick-heart-mv.js', 'app.js'].map(name => html.indexOf(`<script src="${name}`));
  assert.ok(order.every(i => i > 0) && order.every((i, k) => !k || order[k - 1] < i), 'scripts load in order');
  assert.match(app, /const in3d = drawTrickHeart3d\(audioTime\);[^]*?if \(in3d\) return;/, 'the 2D stage draws only when the 3D video cannot');
  for (const selector of ['.now-meta', '.hero-control', '.hero-play', '.hero-time']) {
    assert.doesNotMatch(css, new RegExp(`trick-heart-3d-active[^{]*\\${selector}\\s*\\{[^}]*(display:\\s*none|visibility:\\s*hidden)`), selector + ' stays on screen');
  }
  const overlay = /trick-heart-3d-active \.trick-heart-overlay \{([^}]*)\}/.exec(css);
  assert.ok(overlay && /clip-path/.test(overlay[1]) && !/display:\s*none/.test(overlay[1]), 'the text lyrics stay readable by screen readers');
});
