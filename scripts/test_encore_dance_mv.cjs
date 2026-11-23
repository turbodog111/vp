// Encore Dance's 3D music video: the lyrics are big animated 3D lettering that the
// camera always keeps in frame and facing it, each character lights up when it is
// sung, every cut has a reason (a new section, a new line, the next figure of the
// dance) and lands on the beat, the camera moves gently and keeps moving (except under
// Reduce motion), one dancer performs behind the words, every frame is reproducible
// from media time, and the Now Playing title, artist, play button and times stay on screen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../mv3d.js');
const Mv = require('../encore-dance-mv.js');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const mimi = read('songs/lyrics/encore-dance.json');
const evil = read('songs/lyrics/encore-dance-evil.json');
const lyricsOf = (data, variant = 'jp') => ({ lines: data.variants[variant].lines, offset: variant === 'en' ? .05 : 0, language: variant });
const input = (data, time, extra = {}) => ({
  time, duration: data.duration, sections: data.sections, bpm: 132,
  beatOffset: data.analysis.jp.beatOffset, width: 1280, height: 720, lyrics: lyricsOf(data), ...extra,
});
const finite = values => values.every(Number.isFinite);
const RECORDINGS = [['MIMI', mimi, 'jp'], ['Moonlit Star', mimi, 'en'], ['Evil', evil, 'jp']];

/** Where a point lands on screen (0..1) for a frame's camera, or null behind the camera. */
function project(f, p, aspect) {
  const view = K.lookAt(f.cam.eye, f.cam.target, f.cam.roll, f.cam.up);
  const vp = K.mul(K.perspective(f.cam.fov * Math.PI / 180, aspect, .08, 400), view);
  const x = K.apply(vp, p), w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return w > 0 ? [(x[0] / w + 1) / 2, (x[1] / w + 1) / 2] : null;
}

test('every cut has a reason and lands on the beat, and the edit covers the whole song', () => {
  for (const [name, data, variant] of RECORDINGS) {
    const tl = Mv.timeline(input(data, 0));
    const model = Mv.lyricModel(lyricsOf(data, variant), tl);
    const shots = Mv.planShots(tl, model);
    assert.equal(shots[0].start, data.sections[0].start);
    assert.equal(shots.at(-1).end, data.sections.at(-1).end);
    for (let k = 1; k < shots.length; k++) assert.equal(shots[k].start, shots[k - 1].end, 'no gaps between shots');
    const sectionStarts = new Set(data.sections.map(s => s.start));
    for (const s of data.sections) assert.ok(shots.some(shot => shot.start === s.start), 'a cut at ' + s.start);
    for (const shot of shots) {
      if (sectionStarts.has(shot.start)) continue;
      const beats = (shot.start - tl.offset) / tl.period;
      assert.ok(Math.abs(beats - Math.round(beats)) < 1e-6, `cut at ${shot.start.toFixed(3)} lands on a beat`);
    }
    for (const shot of shots) {
      if (sectionStarts.has(shot.start)) continue;
      const s = tl.sections[shot.section], where = `${name}: cut at ${shot.start.toFixed(2)} (${shot.kind})`;
      const newLine = model.some(line => Math.abs(shot.start - line.enterAt) <= tl.period / 2 + 1e-6);
      const sung = model.some(line => line.start >= s.start - .3 && line.start < s.end - .3);
      const beats = (shot.start - (tl.offset + Math.round((s.start - tl.offset) / tl.period) * tl.period)) / tl.period;
      const nextFigure = !sung && Math.abs(beats / 4 - Math.round(beats / 4)) < 1e-6;
      assert.ok(newLine || nextFigure, 'a new line flies in or the dance moves on: ' + where);
      assert.ok(shot.end - shot.start > 1.75, 'no flash cuts: ' + where);
    }
    assert.ok(new Set(shots.map(s => s.kind)).size >= 16, 'many kinds of camera move');
  }
});

test('the camera moves gently: slow turns, level horizons, and a real change at each cut', () => {
  for (const [name, data, variant] of RECORDINGS) {
    const lyrics = lyricsOf(data, variant);
    const tl = Mv.timeline(input(data, 0));
    const shots = Mv.planShots(tl, Mv.lyricModel(lyrics, tl));
    for (const shot of shots) {
      if (!shot.kind.startsWith('lyric') || shot.kind === 'lyricRush') continue;
      for (let time = shot.start + .05; time < shot.end - .15; time += .25) {
        const a = Mv.frameAt(input(data, time, { lyrics })), b = Mv.frameAt(input(data, time + .1, { lyrics }));
        const dir = f => K.v3.norm(K.v3.sub(f.cam.eye, Mv.LYRIC_ANCHOR));
        const turn = Math.acos(Math.min(1, K.v3.dot(dir(a), dir(b)))) / .1;
        const where = `${name} ${shot.kind} at ${time.toFixed(2)}`;
        assert.ok(turn < .45, `turns at ${turn.toFixed(2)} rad/s: ${where}`);
        assert.ok(Math.abs(a.cam.roll) < .02, 'level horizon: ' + where);
      }
    }
    for (let k = 1; k < shots.length; k++) {
      const [p, q] = [shots[k - 1], shots[k]];
      if (p.section === q.section) assert.ok(p.kind !== q.kind || p.side !== q.side, `${name}: the cut at ${q.start.toFixed(2)} changes the view`);
    }
  }
});

test('every lyric line is in frame, facing the camera and fully drawn while it is sung', () => {
  for (const [name, data, variant] of RECORDINGS) for (const [width, height] of [[1280, 720], [390, 640]]) {
    const aspect = width / height;
    const lines = Mv.lyricModel(lyricsOf(data, variant), Mv.timeline(input(data, 0))).length;
    let checked = 0;
    for (let index = 0; index < lines; index++) {
      const probe = Mv.frameAt(input(data, 0, { lyrics: lyricsOf(data, variant), width, height }));
      const line = probe.model[index];
      for (const time of [line.start + .35, (line.start + line.end) / 2, line.end - .1]) {
        const f = Mv.frameAt(input(data, time, { lyrics: lyricsOf(data, variant), width, height }));
        const glyphs = f.text.filter(g => g.line === index && g.role === 'main');
        const sung = glyphs.filter(g => g.sung);
        if (time >= line.exitAt) continue;
        for (const g of sung) {
          const center = K.apply(g.m, [0, .36 * g.size, 0]);
          const screen = project(f, center, aspect);
          const where = `${name} ${width}x${height} line ${index} "${g.ch}" at ${time.toFixed(2)} (${f.shot.kind})`;
          assert.ok(screen, 'in front of the camera: ' + where);
          assert.ok(screen[0] > .01 && screen[0] < .99 && screen[1] > .05 && screen[1] < .95, `on screen ${screen.map(v => v.toFixed(2))}: ${where}`);
          const facing = K.v3.dot(K.v3.norm(K.applyDir(g.m, [0, 0, 1])), K.v3.norm(K.v3.sub(f.cam.eye, center)));
          assert.ok(facing > .3, `faces the camera (${facing.toFixed(2)}): ${where}`);
          assert.ok(g.alpha > .99, 'fully drawn once sung: ' + where);
          checked++;
        }
      }
    }
    assert.ok(checked > 200, `${name}: checked ${checked} sung characters`);
  }
});

test('each character lights up and pops when it is sung, not before', () => {
  const tl = Mv.timeline(input(mimi, 0));
  const line = Mv.lyricModel(lyricsOf(mimi), tl)[10]; // 輝く月に 歌うよ孤独を
  const ch = line.main.find(c => c.ch === '月');
  const at = time => Mv.frameAt(input(mimi, time)).text.find(g => g.line === 10 && g.ch === '月');
  const before = at(ch.t0 - .1), hit = at(ch.t0 + .04), after = at(ch.t0 + .9);
  assert.equal(before.sung, false);
  assert.equal(hit.sung, true);
  assert.equal(hit.singing, true);
  const scale = g => K.v3.len(K.applyDir(g.m, [1, 0, 0]));
  assert.ok(scale(hit) > scale(before) * 1.15, 'pops when sung');
  assert.ok(scale(after) < scale(hit), 'settles after the pop');
  const romaji = Mv.frameAt(input(mimi, (line.start + line.end) / 2)).text.filter(g => g.line === 10 && g.role === 'romaji');
  const translation = Mv.frameAt(input(mimi, (line.start + line.end) / 2)).text.filter(g => g.line === 10 && g.role === 'trans');
  assert.equal(romaji.map(g => g.ch).join(''), 'kagayakutsukiniutauyokodokuo');
  assert.equal(translation.map(g => g.ch).join(''), 'TotheshiningmoonIsingofloneliness');
});

test('English lyrics use their word timing, with no romaji or translation rows', () => {
  const tl = Mv.timeline(input(mimi, 0));
  const model = Mv.lyricModel(lyricsOf(mimi, 'en'), tl);
  const line = model.find(l => l.text.startsWith('Dissolving encores'));
  assert.equal(line.romaji, '');
  assert.equal(line.trans, '');
  const d = line.main.find(c => c.ch === 'D');
  assert.ok(Math.abs(d.t0 - (36.46 - .05)) < 1e-6, 'times move to the video clock');
  const layout = Mv.layoutLine(line, Mv.approxAdvance, 9.6);
  assert.ok(new Set(layout.glyphs.map(g => g.y.toFixed(3))).size >= 2, 'a long line wraps');
});

test('the camera keeps moving through every section, and every frame is reproducible', () => {
  for (const s of mimi.sections) {
    for (const time of [s.start + .3, (s.start + s.end) / 2]) {
      const a = Mv.frameAt(input(mimi, time)), b = Mv.frameAt(input(mimi, time));
      assert.deepEqual(a.cam, b.cam, 'same time, same camera');
      assert.deepEqual(a.parts, b.parts, 'same time, same pose');
      assert.deepEqual(a.text.map(g => Array.from(g.m)), b.text.map(g => Array.from(g.m)), 'same time, same lettering');
      const later = Mv.frameAt(input(mimi, time + 1 / 30));
      const moved = K.v3.dist(a.cam.eye, later.cam.eye) + K.v3.dist(a.cam.target, later.cam.target);
      assert.ok(moved > 1e-4, `camera moves at ${time.toFixed(2)} (${a.shot.kind})`);
      assert.ok(K.v3.dist(a.parts.handR, later.parts.handR) + K.v3.dist(a.parts.head, later.parts.head) > 1e-5, 'the dancer moves');
    }
  }
});

test('cameras stay finite, above the floor and inside a sane lens range for the whole song', () => {
  for (const reducedMotion of [false, true]) for (const [, data, variant] of RECORDINGS) {
    for (let time = 0; time <= data.duration; time += .23) {
      const f = Mv.frameAt(input(data, time, { reducedMotion, lyrics: lyricsOf(data, variant) }));
      assert.ok(finite(f.cam.eye) && finite(f.cam.target), 'finite camera at ' + time);
      assert.ok(f.cam.fov >= 14 && f.cam.fov <= 80, 'lens at ' + time + ': ' + f.cam.fov);
      assert.ok(f.cam.eye[1] > -1.4, 'camera above the house floor at ' + time);
      assert.ok(K.v3.dist(f.cam.eye, f.cam.target) > .3, 'camera is not inside its subject');
      assert.ok(finite(Object.values(f.post).filter(v => typeof v === 'number')), 'finite finishing pass');
      assert.ok(f.text.every(g => finite(Array.from(g.m)) && g.alpha >= 0 && g.alpha <= 1), 'finite lettering');
      const feet = Math.min(f.sk.legL.ankle[13], f.sk.legR.ankle[13]);
      assert.ok(feet > .06 && feet < .9, 'the dancer stands on, or jumps from, the stage: ' + feet);
    }
  }
});

test('Reduce motion holds one still camera per section, still lettering, and no flashes', () => {
  const reduced = (time, extra = {}) => Mv.frameAt(input(mimi, time, { reducedMotion: true, ...extra }));
  const tl = Mv.timeline(input(mimi, 0, { reducedMotion: true }));
  assert.equal(Mv.planShots(tl, Mv.lyricModel(lyricsOf(mimi), tl)).length, mimi.sections.length);
  for (const s of mimi.sections) {
    const a = reduced(s.start + .5), b = reduced(s.end - .3);
    assert.deepEqual(a.cam, b.cam, 'still camera through ' + s.name);
    for (const f of [a, b]) {
      assert.equal(f.post.speedLines, 0);
      assert.equal(f.post.invert, 0);
      assert.equal(f.post.aberration, 0);
      if (f.t > 2.4) assert.equal(f.post.flash, 0);
    }
  }
  const line = reduced(0).model[11];
  const a = reduced(line.start + .4).text.filter(g => g.line === 11), b = reduced(line.start + 1.4).text.filter(g => g.line === 11);
  assert.deepEqual(a.map(g => Array.from(g.m)), b.map(g => Array.from(g.m)), 'lettering holds still');
  const moving = Mv.frameAt(input(mimi, 29.7));
  assert.ok(moving.post.flash > 0 || moving.post.speedLines > 0, 'without Reduce motion the chorus entry hits');
});

test('the theatre transforms with the song around a single dancer', () => {
  const at = time => Mv.frameAt(input(mimi, time));
  assert.ok(at(3).env.curtain < .01, 'curtain closed during the count-in');
  assert.ok(at(8).text.some(g => g.role === 'title'), 'a 3D title card over the closed curtain');
  assert.ok(at(14.5).env.curtain > .95, 'curtain open for the first verse');
  assert.ok(at(20).env.wall > .99 && at(20).env.roof === 0, 'the back wall drops on the city for the first verse');
  assert.ok(at(48).env.roof < at(54).env.roof && at(60).env.roof === 1, 'the roof opens for the moon');
  assert.equal(at(75).env.hearts, true);
  assert.equal(at(95).env.lasers, true);
  assert.ok(at(95).text.filter(g => g.role === 'ring').length >= 15, 'a ring of ENCORE letters in the dance break');
  assert.ok(at(110).env.fireworks);
  assert.ok(at(137).env.curtain < .05, 'the curtain falls at the end');
  for (const time of [20, 60, 75, 95, 128]) assert.ok(at(time).sk.pelvis[14] < 1, 'the dancer stays upstage of the lyrics');
});

test('the renderer path draws every frame without errors, one dancer, and a bounded amount of work', () => {
  const count = { draw: 0, dynamic: 0, points: 0, quads: 0, frames: 0 };
  const renderer = {
    begin: () => true, lost: () => false, mirror() {}, sky() {}, lights() {}, dispose() {}, resetGlyphs() {}, glyphEpoch: 0,
    glyph: ch => ({ advance: Mv.approxAdvance(ch), u0: 0, v0: 0, u1: .0625, v1: .0625, top: 1.1, bottom: -.43, half: .76 }),
    camera: c => assert.ok(finite([...c.eye, ...c.target, c.fov])),
    draw: (g, m) => { assert.ok(finite(Array.from(m)), 'finite model matrix'); count.draw++; },
    drawDynamic: g => { assert.ok(finite(Array.from(g.p))); count.dynamic++; },
    beam: (apex, dir, length, radius, color, intensity) => assert.ok(finite([...apex, ...dir, length, radius, intensity])),
    points: (data, n) => { assert.ok(finite(Array.from(data.subarray(0, n * 9)))); count.points += n; },
    text: (data, quads) => { assert.ok(finite(Array.from(data.subarray(0, quads * 56)))); count.quads += quads; },
    end: o => assert.ok(o.letterbox >= 0 && o.letterbox < .2),
    project: () => [.5, .5, 1],
  };
  const mv = Mv.create(null, { renderer });
  for (let time = 0; time <= mimi.duration; time += .5) {
    const state = mv.draw(input(mimi, time, { signal: () => ({ energy: .6, onset: .3 }) }));
    assert.ok(state && state.palette.primary.every(v => v >= 0 && v <= 255));
    count.frames++;
  }
  assert.ok(count.dynamic / count.frames <= 6, 'one dancer (a ponytail and a ribbon, and their reflections) and the chorus streamers');
  assert.ok(count.draw / count.frames < 200, 'draw calls per frame: ' + count.draw / count.frames);
  assert.ok(count.points / count.frames < 4000, 'point sprites per frame: ' + count.points / count.frames);
  assert.ok(count.quads / count.frames > 50 && count.quads / count.frames < 6000, 'lettering quads per frame: ' + count.quads / count.frames);
});

test('every solid shape faces outward, which the ink outlines depend on', () => {
  const shapes = {
    box: K.box(1, 2, 3), sphere: K.sphere(1), cylinder: K.cylinder(.5, .3, 1), torus: K.torus(2, .3),
    lathe: K.lathe([[0, 1], [.5, .8], [.6, 0], [.3, -.5]]), cone: K.cone(),
    star: K.extrude([[0, 1], [-.3, .3], [-1, 0], [-.3, -.3], [0, -1], [.3, -.3], [1, 0], [.3, .3]], .2),
    tube: K.tube([[0, 0, 0], [.2, -.3, .1], [.3, -.7, .4], [.2, -1, .5]], u => .1 * (1 - u)),
  };
  // Every mesh of the video: the dancer's body, face, hair and costume, and the stage.
  for (const [key, g] of Object.entries(Mv.buildGeometry())) if (g && g.i && g.p) shapes['video ' + key] = g;
  for (const [name, g] of Object.entries(shapes)) {
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

test('the page keeps the title, artist, play button and both times over the 3D video', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(html, /<div id="encore-theater"[^]*?<canvas id="encore-gl"/);
  const order = ['mv3d.js', 'mv-lyrics3d.js', 'encore-dance-mv.js', 'app.js'].map(name => html.indexOf(`<script src="${name}`));
  assert.ok(order.every(i => i > 0) && order.every((i, k) => !k || order[k - 1] < i), 'scripts load in order');
  for (const id of ['now-title', 'now-subtitle', 'hero-play', 'hero-time-current', 'hero-time-total']) assert.match(html, new RegExp(`id="${id}"`));
  for (const selector of ['.now-meta', '.hero-control', '.hero-play', '.hero-time']) {
    const hidden = new RegExp(`encore-theater-active[^{]*\\${selector}\\s*\\{[^}]*display:\\s*none`);
    assert.doesNotMatch(css, hidden, selector + ' is never hidden in the Encore theatre');
  }
  const overlay = /is-3d\) \.trick-heart-overlay \{([^}]*)\}/.exec(css);
  assert.ok(overlay && /clip-path/.test(overlay[1]) && !/display:\s*none/.test(overlay[1]), 'text lyrics stay readable by screen readers');
});
