// Mesmerizer's 3D music video ("Hypno Broadcast"): one pop-art set per measured chapter
// of each recording, no characters, every cut on the beat and for a reason, a gentle
// camera that keeps moving (except under Reduce motion), the title in 3D, timed lyrics
// carried in front of the camera when a recording has them, reproducible frames, and a
// 2D fallback without WebGL2. The page keeps the title, artist, play button and times.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const K = require('../mv3d.js');
const Mv = require('../mesmerizer-mv.js');
const root = path.resolve(__dirname, '..');
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const VARIANTS = ['original', 'stetson', 'artsy'];
const motion = Object.fromEntries(VARIANTS.map(v => [v, json(`songs/motion/mesmerizer-${v}.json`)]));
const input = (variant, time, extra = {}) => ({
  variant, time, duration: motion[variant].duration, bpm: motion[variant].bpm, beatOffset: motion[variant].beatOffset,
  width: 1280, height: 720, ...extra,
});
const finite = values => values.every(Number.isFinite);

/** Where a point lands on screen (0..1), or null behind the camera. */
function project(f, p, aspect) {
  const view = K.lookAt(f.cam.eye, f.cam.target, f.cam.roll, f.cam.up);
  const vp = K.mul(K.perspective(f.cam.fov * Math.PI / 180, aspect, .08, 400), view);
  const x = K.apply(vp, p), w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return w > 0 ? [(x[0] / w + 1) / 2, (x[1] / w + 1) / 2] : null;
}

// Placeholder lines (not lyrics) every few seconds, to check the lyric path end to end.
function placeholderLyrics(duration) {
  const lines = [];
  for (let start = 5; start < duration - 6; start += 4.2) {
    const text = 'la la la la la';
    const words = text.split(' ').map((word, k) => ({ word, start: start + k * .6, end: start + k * .6 + .5 }));
    lines.push({ start, end: start + 3.6, text, words, romaji: [], en: [] });
  }
  return { lines, offset: 0, language: 'en' };
}

test('each recording follows its own measured chapters and palette', () => {
  const palettes = new Set();
  for (const variant of VARIANTS) {
    const tl = Mv.timeline(input(variant, 0));
    assert.deepEqual(tl.sections.slice(1).map(s => s.start), Mv.CLOCKS[variant].filter(m => m < tl.duration - .5));
    assert.equal(tl.sections.length, 8, 'eight chapters: ' + Mv.CHAPTERS.join(', '));
    assert.deepEqual(tl.sections.filter(s => s.chorus).map(s => s.phase), [4, 6]);
    palettes.add(JSON.stringify(Mv.PALETTES[variant]));
  }
  assert.equal(palettes.size, 3, 'each recording has its own colours');
});

test('every cut lands on the beat at a chapter start or on the chapter\'s own beat count, and covers the song', () => {
  for (const variant of VARIANTS) {
    const tl = Mv.timeline(input(variant, 0));
    const shots = Mv.planShots(tl);
    assert.equal(shots[0].start, 0);
    assert.equal(shots.at(-1).end, tl.duration);
    for (let k = 1; k < shots.length; k++) assert.equal(shots[k].start, shots[k - 1].end, 'no gaps');
    const starts = new Set(tl.sections.map(s => s.start));
    for (const s of tl.sections) assert.ok(shots.some(shot => shot.start === s.start), `${variant}: a cut at chapter ${s.phase}`);
    for (const shot of shots) {
      if (starts.has(shot.start)) continue;
      const beats = (shot.start - tl.offset) / tl.period;
      assert.ok(Math.abs(beats - Math.round(beats)) < 1e-6, `${variant}: the cut at ${shot.start.toFixed(2)} lands on a beat`);
      assert.ok(shot.end - shot.start > 1.5, `${variant}: no flash cuts (${shot.kind})`);
    }
    assert.ok(new Set(shots.map(s => s.kind)).size >= 18, 'many kinds of move');
  }
});

test('the camera is gentle, keeps moving, stays finite, and every frame is reproducible', () => {
  for (const variant of VARIANTS) {
    const tl = Mv.timeline(input(variant, 0));
    for (let time = .3; time < tl.duration - .3; time += .9) {
      const a = Mv.frameAt(input(variant, time)), b = Mv.frameAt(input(variant, time));
      assert.deepEqual(a.cam, b.cam, 'same time, same camera');
      assert.deepEqual(a.text.map(g => Array.from(g.m)), b.text.map(g => Array.from(g.m)), 'same time, same lettering');
      assert.ok(finite([...a.cam.eye, ...a.cam.target, a.cam.fov, a.cam.roll]), 'finite camera');
      assert.ok(a.cam.fov >= 20 && a.cam.fov <= 80);
      const later = Mv.frameAt(input(variant, time + .05));
      assert.ok(K.v3.dist(a.cam.eye, later.cam.eye) + K.v3.dist(a.cam.target, later.cam.target) > 1e-4, `${variant}: the camera moves at ${time.toFixed(1)} (${a.shot.kind})`);
      if (later.shot !== a.shot) continue;
      // Rushes and dives travel fast on purpose; everything else turns slowly.
      if (!['stormRush', 'diveIn', 'tunnel', 'eyePush'].includes(a.shot.kind)) {
        const dir = f => K.v3.norm(K.v3.sub(f.cam.target, f.cam.eye));
        const turn = Math.acos(Math.min(1, K.v3.dot(dir(a), dir(later)))) / .05;
        assert.ok(turn < .7, `${variant}: turns at ${turn.toFixed(2)} rad/s in ${a.shot.kind}`);
      }
      assert.ok(Math.abs(a.cam.roll) < (a.shot.kind === 'tunnel' ? 5 : .25), 'horizons stay nearly level outside the tunnel');
    }
  }
});

test('the title forms on the beat, circles the chorus vortex reading clockwise, and fronts the video wall', () => {
  const variant = 'original', tl = Mv.timeline(input(variant, 0)), [, onAir, , , storm, , wall] = tl.sections;
  const early = Mv.frameAt(input(variant, onAir.start + tl.period * 3.2)), full = Mv.frameAt(input(variant, onAir.start + tl.period * 12));
  assert.ok(early.world.length > 0 && early.world.length < 10, 'the title is still forming');
  assert.equal(full.world.map(g => g.ch).join(''), 'MESMERIZER');
  const ring = Mv.frameAt(input(variant, storm.start + 6)).world.filter(g => g.role === 'ring');
  assert.ok(ring.length >= 20, 'a ring of title letters in the chorus');
  const angle = g => Math.atan2(g.m[12], g.m[13] - 2.8);
  const delta = ((angle(ring[1]) - angle(ring[0])) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  assert.ok(delta > 0, 'the second letter is clockwise of the first');
  const front = Mv.frameAt(input(variant, wall.start + 9));
  assert.equal(front.world.map(g => g.ch).join(''), 'MESMERIZER');
  for (const g of front.world) {
    const p = project(front, K.apply(g.m, [0, .36 * g.size, 0]), 1280 / 720);
    assert.ok(p && p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1, 'the wall title is in frame');
  }
});

test('timed lyrics, when a recording has them, ride in front of the camera in every chapter', () => {
  for (const variant of VARIANTS) for (const [width, height] of [[1280, 720], [390, 640]]) {
    const lyrics = placeholderLyrics(motion[variant].duration);
    let checked = 0;
    for (const line of lyrics.lines) {
      const time = line.start + 1.2;
      const f = Mv.frameAt(input(variant, time, { lyrics, width, height }));
      const sung = f.words.filter(g => g.role === 'main' && g.sung && g.alpha > .99);
      for (const g of sung) {
        const centre = K.apply(g.m, [0, .36 * g.size, 0]);
        const p = project(f, centre, width / height);
        const where = `${variant} ${width}x${height} at ${time.toFixed(1)} (${f.shot.kind})`;
        assert.ok(p && p[0] > .01 && p[0] < .99 && p[1] > .05 && p[1] < .95, 'on screen: ' + where);
        const facing = K.v3.dot(K.v3.norm(K.applyDir(g.m, [0, 0, 1])), K.v3.norm(K.v3.sub(f.cam.eye, centre)));
        assert.ok(facing > .5, 'faces the camera: ' + where);
        checked++;
      }
      assert.ok(f.world.every(g => g.alpha <= .35 + 1e-9), 'the 3D title steps back while lyrics are up');
    }
    assert.ok(checked > 150, `${variant}: checked ${checked} sung letters`);
  }
  assert.equal(Mv.frameAt(input('original', 60)).words.length, 0, 'no lyric file, no lyric letters');
});

test('Reduce motion holds one still camera per chapter, still letters and no flashes or static', () => {
  for (const variant of VARIANTS) {
    const tl = Mv.timeline(input(variant, 0, { reducedMotion: true }));
    assert.equal(Mv.planShots(tl).length, tl.sections.length);
    for (const s of tl.sections) {
      const a = Mv.frameAt(input(variant, s.start + .3, { reducedMotion: true }));
      const b = Mv.frameAt(input(variant, Math.min(s.end - .1, s.start + 2.5), { reducedMotion: true }));
      assert.deepEqual(a.cam, b.cam, `${variant}: still camera through ${s.name}`);
      assert.equal(a.post.flash, 0); assert.equal(a.post.speedLines, 0); assert.equal(a.post.static, 0); assert.equal(a.post.aberration, 0);
    }
    const wall = tl.sections[6];
    const a = Mv.frameAt(input(variant, wall.start + 4, { reducedMotion: true })), b = Mv.frameAt(input(variant, wall.start + 7, { reducedMotion: true }));
    assert.deepEqual(a.world.map(g => Array.from(g.m)), b.world.map(g => Array.from(g.m)), 'the title holds still');
  }
  const moving = Mv.frameAt(input('original', Mv.CLOCKS.original[3] + .05));
  assert.ok(moving.post.flash > 0 && moving.post.static > 0, 'without Reduce motion the chorus hits and the channel changes');
});

test('the renderer path draws every chapter without errors, without characters, and within budget', () => {
  const count = { draw: 0, dynamic: 0, points: 0, quads: 0, frames: 0, overlay: 0 };
  const renderer = {
    begin: () => true, lost: () => false, mirror() {}, sky() {}, lights() {}, dispose() {}, resetGlyphs() {}, glyphEpoch: 0,
    glyph: ch => ({ advance: .6, u0: 0, v0: 0, u1: .0625, v1: .0625, top: 1.1, bottom: -.43, half: .76 }),
    camera: c => assert.ok(finite([...c.eye, ...c.target, c.fov])),
    draw: (g, m, mat) => {
      assert.ok(finite(Array.from(m)), 'finite model matrix');
      if (mat.screen) assert.ok(finite([mat.screen.mode, mat.screen.width, mat.screen.height, mat.screen.power ?? 1, ...(mat.screen.params || [])]));
      count.draw++;
    },
    drawDynamic: () => { count.dynamic++; },
    beam: () => {},
    points: (data, n) => { assert.ok(finite(Array.from(data.subarray(0, n * 9)))); count.points += n; },
    text: (data, quads, overlay) => { assert.ok(finite(Array.from(data.subarray(0, quads * 56)))); count.quads += quads; if (overlay && quads) count.overlay++; },
    end: o => assert.ok(o.static >= 0 && o.static <= 1 && o.scanlines >= 0),
    project: () => [.5, .5, 1],
  };
  for (const variant of VARIANTS) {
    const mv = Mv.create(null, { renderer });
    const lyrics = variant === 'stetson' ? placeholderLyrics(motion[variant].duration) : null;
    const seen = new Set();
    for (let time = 0; time <= motion[variant].duration; time += .4) {
      const state = mv.draw(input(variant, time, { lyrics, signal: () => ({ energy: .6 }) }));
      assert.ok(state && state.palette.primary.every(v => v >= 0 && v <= 255));
      seen.add(state.chapter);
      count.frames++;
    }
    assert.deepEqual([...seen], Mv.CHAPTERS, variant + ' visits every chapter in order');
  }
  assert.equal(count.dynamic, 0, 'no characters: nothing is rebuilt per frame');
  assert.ok(count.draw / count.frames < 200, 'draw calls per frame: ' + (count.draw / count.frames).toFixed(1));
  assert.ok(count.points / count.frames < 2500, 'point sprites per frame');
  assert.ok(count.overlay > 0, 'lyrics draw over the scene');
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

test('the app draws Mesmerizer in 3D when it can and falls back to the 2D broadcast when it cannot', async () => {
  const run = async create => {
    const calls = { mv: [], fx: 0 };
    const classes = new Set();
    const canvas = { width: 0, height: 0, getBoundingClientRect: () => ({ width: 1200, height: 640 }) };
    const sandbox = {
      window: {
        MesmerizerFx: { draw: () => { calls.fx++; } },
        MesmerizerMv: { create: () => create(calls) },
        matchMedia: () => ({ matches: false }), devicePixelRatio: 1,
      },
      document: { body: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), remove: c => classes.delete(c) } }, getElementById: id => (id === 'motion-gl' ? canvas : null) },
      AbortController, setTimeout, clearTimeout, console,
      fetch: async url => ({ ok: true, json: async () => json(url) }),
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'song-motion-fx.js'), 'utf8'), sandbox);
    const api = sandbox.window.SongMotionFx;
    await api.activate(api.track({ path: 'songs/Will Stetson & rachie - Mesmerizer (Official English Version).m4a' }));
    api.draw(new Proxy({}, { get: () => () => {}, set: () => true }), 1200, 640, { time: 90, energy: .4 });
    return { calls, classes, canvas };
  };
  const live = await run(calls => ({ draw: o => { calls.mv.push(o); return { phase: 4 }; }, lost: () => false, dispose() {} }));
  assert.equal(live.calls.mv.length, 1);
  assert.equal(live.calls.fx, 0);
  assert.ok(live.classes.has('motion-3d-active'));
  const o = live.calls.mv[0];
  assert.equal(o.variant, 'stetson');
  assert.equal(o.time, 90);
  assert.equal(o.bpm, motion.stetson.bpm);
  assert.equal(o.beatOffset, motion.stetson.beatOffset);
  assert.ok(o.width > 0 && o.height > 0 && live.canvas.width === o.width);
  assert.ok(o.signal(90).energy >= 0);
  const fallback = await run(() => null);
  assert.equal(fallback.calls.fx, 1, 'no WebGL2: the 2D broadcast draws');
  assert.ok(!fallback.classes.has('motion-3d-active'));
});

test('the page has the 3D canvas, loads the scripts in order and keeps the title, artist and controls', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(html, /<canvas id="motion-gl" class="motion-gl-canvas" aria-hidden="true"><\/canvas>/);
  const order = ['mv3d.js', 'mv-lyrics3d.js', 'mesmerizer-fx.js', 'mesmerizer-mv.js', 'song-motion-fx.js', 'app.js'].map(name => html.indexOf(`<script src="${name}`));
  assert.ok(order.every(i => i > 0) && order.every((i, k) => !k || order[k - 1] < i), 'scripts load in order');
  for (const selector of ['.now-meta', '.hero-control', '.hero-play', '.hero-time']) {
    assert.doesNotMatch(css, new RegExp(`motion-3d-active[^{]*\\${selector}\\s*\\{[^}]*(display:\\s*none|visibility:\\s*hidden)`), selector + ' stays on screen');
  }
});
