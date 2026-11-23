// Mesmerizer: "Hypno Broadcast", VP's 3D pop-art music video for the three Mesmerizer
// recordings (32ki's Japanese original, Will Stetson & rachie's official English version
// and Artsythesecond's English cover). A retro TV broadcast that changes channel at each
// measured chapter of the recording: a TV powers on; an on-air studio where a carousel of
// TVs turns under a giant spiral; a dive through a screen into a spiral tunnel; channel
// surfing along a stacked wall of TVs; a chorus vortex circled by the title in 3D; a giant
// eye that follows a swinging pocket watch; a video wall whose screens join into one
// spiral; and power-off. Flat pop-art colours with ink outlines, halftone dots and TV
// static. Original shapes only: no characters, nothing copied from the music videos.
// When a recording has timed lyrics they fly in as 3D lettering in front of every scene.
// Every cut lands on the beat and has a reason (a new chapter, the next TV, a channel
// flip, the next figure of the chorus); every frame is a pure function of media time and
// the recording's measured chapters, beat and loudness, so pause, seek and replay match.
((root, factory) => {
  const kit = root.Mv3d || (typeof require === 'function' ? require('./mv3d.js') : null);
  const lyrics = root.MvLyrics3d || (typeof require === 'function' ? require('./mv-lyrics3d.js') : null);
  const api = factory(kit, lyrics);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MesmerizerMv = api;
})(typeof window === 'object' ? window : globalThis, (K, L) => {
  'use strict';

  const { TAU, v3, chain, T, S, RX, RY, RZ, apply } = K;
  const { PIVOT, LYRIC_FONT, approxAdvance, lyricModel, layoutLine, glyphInstance, batch } = L;
  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = x => { const a = clamp(x); return a * a * (3 - 2 * a); };
  const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
  const easeIn = x => Math.pow(clamp(x), 3);
  const easeInOut = x => { const a = clamp(x); return a < .5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2; };
  const easeOutBack = x => { const a = clamp(x) - 1; return 1 + 2.7 * a * a * a + 1.7 * a * a; };
  const fract = x => x - Math.floor(x);
  const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const noise = x => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return mix(hash(i), hash(i + 1), u) * 2 - 1;
  };
  const rgb = hex => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const scalec = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const around = (F, a, d, h) => [F[0] + Math.sin(a) * d, F[1] + h, F[2] + Math.cos(a) * d];

  // MARK: palettes and chapters

  const INK = rgb(0x17233a);
  const PAPER = rgb(0xfffae9);
  // [cyan, red, yellow, blue, deep red] for each recording, as in the 2D broadcast.
  const PALETTE_SOURCE = {
    original: [0x48e4ed, 0xfc426c, 0xffe05c, 0x1c4cbd, 0xea2450],
    stetson: [0xc6a5ff, 0xff9b70, 0xfff07d, 0x2547b1, 0xad2c65],
    artsy: [0x77ecbd, 0xff5887, 0xffc649, 0x2956bc, 0xcf2d51],
  };
  const PALETTES = {};
  for (const [name, list] of Object.entries(PALETTE_SOURCE)) {
    const [cyan, red, yellow, blue, deep] = list.map(rgb);
    PALETTES[name] = Object.freeze({ cyan, red, yellow, blue, deep });
  }
  // Chapter starts for each upload, measured against the linked videos (seconds); the
  // same marks drive the 2D broadcast in mesmerizer-fx.js.
  const CLOCKS = {
    original: [3.75, 43.25, 66.5, 79.25, 97.25, 122.75, 154.5],
    stetson: [3.0, 42.25, 65.25, 78.5, 96.0, 121.5, 153.25],
    artsy: [3.75, 43.25, 66.5, 79.25, 97.25, 122.75, 154.5],
  };
  const CHAPTERS = ['power-on', 'on air', 'dive', 'channel surf', 'spiral storm', 'the eye', 'wall of screens', 'power-off'];
  const CHORUS = new Set([4, 6]);

  function timeline(input) {
    const variant = PALETTE_SOURCE[input.variant] ? input.variant : 'original';
    const marks = CLOCKS[variant];
    const duration = input.duration > 0 ? input.duration : marks.at(-1) + 3;
    const edges = [0, ...marks.filter(m => m < duration - .5), duration];
    const sections = edges.slice(0, -1).map((start, i) => ({ start, end: edges[i + 1], phase: i, chorus: CHORUS.has(i), name: CHAPTERS[i] }));
    const period = 60 / clamp(input.bpm || 92.5, 40, 260);
    const offset = Number.isFinite(input.beatOffset) ? input.beatOffset : 0;
    return { variant, sections, duration, period, offset, reduce: !!input.reducedMotion, palette: PALETTES[variant] };
  }

  function locate(tl, t) {
    const { sections } = tl;
    let index = sections.findIndex(s => t >= s.start && t < s.end);
    if (index < 0) index = t < sections[0].start ? 0 : sections.length - 1;
    const section = sections[index];
    return { index, section, phase: section.phase, local: t - section.start,
      u: clamp((t - section.start) / Math.max(.001, section.end - section.start)) };
  }

  /** Beats since the first beat of a chapter (cuts and set motion count from it). */
  const chapterBeat = (tl, s, t) => (t - tl.offset) / tl.period - Math.round((s.start - tl.offset) / tl.period);

  /** How strongly a chorus lifts the picture: eases in at a chorus and out after it. */
  function liftAt(tl, t) {
    let lift = 0;
    for (const s of tl.sections) {
      if (!s.chorus) continue;
      lift = Math.max(lift, ease((t - s.start + .2) / .4) * (1 - ease((t - s.end + .3) / .6)));
    }
    return lift;
  }

  // MARK: the sets

  // On air: a carousel of TVs on pedestals turns so a new TV reaches the front every
  // eight beats, under a giant turning spiral.
  const CAROUSEL = { n: 7, radius: 4.4, center: [0, 0, -1], top: 1.05 };
  // Channel surf: a stacked wall of TVs, five across and three high.
  const SURF = { cols: 5, rows: 3, dx: 1.62, dy: 1.32 };
  // The eye and the pocket watch swinging in front of it.
  const EYE = [0, 2.45, -4];
  const PIVOT_TOP = [0, 7.3, 1.2], CHAIN = 4.4;
  // The video wall: nine by five TVs whose screens make one picture.
  const WALL = { cols: 9, rows: 5, dx: 1.56, dy: 1.18, z: -5, bottom: .15 };
  WALL.w = WALL.cols * WALL.dx; WALL.h = WALL.rows * WALL.dy;
  WALL.center = [0, WALL.bottom + WALL.h / 2, WALL.z];
  // A TV's screen: its centre and size in the TV's own frame (the TV faces +z).
  const SCREEN = { x: -.18, y: .67, z: .466, w: .98, h: .8 };
  // The wall's monitors have no knobs: their screens fill the front, so together they read as one picture.
  const WALL_SCREEN = { x: 0, y: .67, z: .466, w: 1.34, h: .95 };
  const TUNNEL = { radius: 4, speed: 7 };

  function carouselTurn(tl, s, t) { return chapterBeat(tl, s, t) / 8 * TAU / CAROUSEL.n; }
  /** World matrix of carousel TV k. */
  function carouselTv(k, turn) {
    const a = k * TAU / CAROUSEL.n - turn;
    return chain(T(...CAROUSEL.center), RY(a), T(0, CAROUSEL.top, CAROUSEL.radius));
  }
  function surfTv(col, row) {
    const k = row * SURF.cols + col;
    return chain(T((col - (SURF.cols - 1) / 2) * SURF.dx, row * SURF.dy, (hash(k + 3) - .5) * .12), RY((hash(k + 7) - .5) * .1));
  }
  const screenCenter = m => apply(m, [SCREEN.x, SCREEN.y, SCREEN.z]);
  function swingAt(tl, s, t) { return tl.reduce ? .2 : .44 * Math.sin(TAU * chapterBeat(tl, s, t) / 4); }
  function watchAt(swing) { return add(PIVOT_TOP, [Math.sin(swing) * CHAIN, -Math.cos(swing) * CHAIN, 0]); }
  /** The tunnel's centre line at depth z, gently winding. */
  const tunnelAt = z => [1.1 * Math.sin(z * .06), .7 * Math.sin(z * .045 + 1), z];

  // MARK: camera shots

  // Each chapter's edit, in beats from its first beat; 99 runs to the chapter's end.
  // Every cut has a reason: the title forms, the carousel brings the next TV round, the
  // camera dives through a screen, a channel flips, the chorus pulls the viewer into the
  // spiral, the watch swings, the wall turns out to be one picture.
  const PLANS = {
    0: [[99, 'powerOn']],
    1: [[16, 'title'], [8, 'carousel'], [8, 'carouselWide'], [8, 'carousel'], [8, 'carouselLow'], [99, 'carousel']],
    2: [[4, 'diveIn'], [99, 'tunnel']],
    3: [[4, 'surf'], [4, 'surf'], [4, 'surf'], [99, 'surfReveal']],
    4: [[8, 'stormRush'], [8, 'stormSpiral'], [8, 'stormRing'], [99, 'stormSpiral']],
    5: [[8, 'eyeOpen'], [12, 'pendulum'], [12, 'eyeWatch'], [99, 'eyePush']],
    6: [[8, 'wallReveal'], [8, 'wallOrbit'], [8, 'wallLow'], [8, 'wallPush'], [99, 'wallPull']],
    7: [[99, 'powerOff']],
  };

  /** The edit: cuts on chapter starts and on the beat grid counted from each chapter. */
  function planShots(tl) {
    const shots = [];
    tl.sections.forEach((s, si) => {
      if (tl.reduce) { shots.push({ start: s.start, end: s.end, kind: 'calm', phase: s.phase, section: si, index: 0, side: 1, n: 0 }); return; }
      const plan = PLANS[s.phase] || [[99, 'calm']];
      const first = Math.round((s.start - tl.offset) / tl.period);
      const turns = {};
      let t = s.start, beats = 0, k = 0;
      while (t < s.end - 1e-3) {
        const [step, kind] = plan[Math.min(k, plan.length - 1)];
        beats += step;
        let end = step >= 99 ? s.end : tl.offset + (first + beats) * tl.period;
        if (end <= t + tl.period * .5) end = tl.offset + Math.round((t + step * tl.period - tl.offset) / tl.period) * tl.period;
        if (end > s.end - tl.period * 1.5) end = s.end;
        const n = turns[kind] = (turns[kind] ?? -1) + 1;
        shots.push({ start: t, end, kind, phase: s.phase, section: si, index: k, side: n % 2 ? 1 : -1, n });
        t = end; k++;
      }
    });
    return shots;
  }

  function shotAt(shots, t) {
    let lo = 0, hi = shots.length - 1;
    if (t <= shots[0].start) return shots[0];
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (shots[mid].start <= t) lo = mid; else hi = mid - 1;
    }
    return shots[lo];
  }

  /** Camera for a shot at progress u: { eye, target, fov, roll, up, speed }. */
  function shotCamera(shot, u, c) {
    // Eased moves that never quite stop, so the picture is always gently moving.
    const e = mix(u, easeInOut(u), .7), side = shot.side || 1, { tl, s, t } = c;
    const cam = (eye, target, fov = 42, extra = {}) => ({ eye, target, fov, roll: 0, up: [0, 1, 0], speed: 0, ...extra });
    switch (shot.kind) {
      case 'powerOn': // drawn slowly toward the TV as it switches on
        return cam([0, .75, mix(6.6, 3.5, e)], [0, .7, 0], 36);
      case 'title': // the title forms above the studio; the camera eases in on it
        return cam([0, mix(3.3, 3, e), mix(11.5, 9, e)], [0, 2.5, -1], 42);
      case 'carousel': { // follows the TV the carousel brings to the front
        const F = screenCenter(carouselTv(0, 0));
        return cam(around(F, side * .32 - (u - .5) * .3, 3.5, .45), add(F, [0, -.05, 0]), 40);
      }
      case 'carouselWide': // high over the whole turning carousel
        return cam([side * mix(6, 4.4, e), mix(6.6, 4.9, e), mix(12.5, 10.8, e)], [0, 1.3, -1], 46);
      case 'carouselLow': // from the studio floor up past the TVs to the spiral
        return cam(around([0, .32, -1], side * (.42 + e * .3), 7.6, 0), [0, mix(2.9, 3.4, e), -1], 58);
      case 'diveIn': { // into the screen, faster and faster, until it fills the frame
        const F = [SCREEN.x * 1.5, SCREEN.y * 1.5, SCREEN.z * 1.5];
        return cam([F[0], F[1], F[2] + mix(4.6, .3, easeIn(u))], F, 40, { speed: easeIn(u) * .8 });
      }
      case 'tunnel': { // flies down the spiral tunnel, turning slowly with it
        const z = 2 - TUNNEL.speed * (t - shot.start);
        return cam(tunnelAt(z), tunnelAt(z - 9), 64, { roll: tl.reduce ? 0 : (t - shot.start) * .2 });
      }
      case 'surf': { // one TV at a time along the wall, drifting the way the channels run
        const F = screenCenter(surfTv(1 + Math.min(shot.n, 2), 1));
        return cam(add(F, [mix(-.25, .25, e) + side * .22, .12, 2.45]), add(F, [mix(-.1, .1, e), 0, 0]), 38);
      }
      case 'surfReveal': { // back from the last TV to the whole wall
        const F = screenCenter(surfTv(4, 1));
        return cam([mix(F[0], 0, e), mix(F[1] + .1, 1.9, e), mix(F[2] + 2.4, 10.5, e)], [mix(F[0], 0, e), mix(F[1], 1.5, e), 0], mix(38, 44, e));
      }
      case 'stormRush': { // the chorus hits: in from far away toward the vortex
        const r = easeOut(clamp(u / .6));
        return cam([0, 2.8, mix(36, 15, r) - u * 1.2], [0, 2.8, 0], 50, { speed: (1 - r) * .8 });
      }
      case 'stormSpiral': { // slowly circling the axis of the vortex and turning with it
        const a = side * mix(-.5, .5, e);
        return cam([Math.sin(a) * 1.6, 2.8 + Math.cos(a) * .8, mix(14, 12, e)], [0, 2.8, 0], 50, { roll: a * .35 });
      }
      case 'stormRing': // up at the title as it circles the top of the vortex
        return cam([side * mix(1.8, .6, e), 5.4, 8.4], [side * mix(.8, -.4, e), 7.1, 1], 46);
      case 'eyeOpen': // the eye opens; the camera eases toward it
        return cam([0, 2.7, mix(14, 11.5, e)], [0, 2.6, -2], 44);
      case 'pendulum': { // follows the swinging watch
        const W = watchAt(swingAt(tl, s, t));
        return cam([W[0] * .55 + side * .5, W[1] + .35, W[2] + 4.2], [W[0] * .85, W[1], W[2]], 40);
      }
      case 'eyeWatch': // past the watch to the eye, whose iris follows it
        return cam([side * mix(1.6, 1, e), mix(3.15, 2.85, e), mix(6.6, 5.9, e)], [side * .2, 2.5, -4], 44);
      case 'eyePush': // into the iris, down the spiral pupil
        return cam([0, 2.47, mix(8, -1.7, easeIn(u))], [0, 2.45, -4], 40);
      case 'wallReveal': // from one screen back until the wall shows one picture
        return cam([0, mix(3.5, 3.3, e), mix(WALL.z + 1.5, 11, e)], [0, 3.55, WALL.z], 44);
      case 'wallOrbit': // across the front of the wall
        return cam(around(WALL.center, side * mix(-.45, .45, e), 15, .3), WALL.center, 46);
      case 'wallLow': // low, up at the title and the wall
        return cam([side * mix(2.4, 1.4, e), .35, 6.5], [0, 4.6, WALL.z], 56);
      case 'wallPush': // toward the middle of the spiral
        return cam([0, 3.5, mix(12.5, 6.5, e)], [0, 3.5, WALL.z], 42);
      case 'wallPull': // back to the whole wall as the song ends
        return cam([0, mix(3.5, 5.2, e), mix(7, 18.5, e)], [0, 3.3, WALL.z], 44);
      case 'powerOff':
        return cam([0, 3.6, mix(17.5, 16, e)], [0, 3.3, WALL.z], 44);
      default: { // Reduce motion: one still view of each chapter
        const views = {
          0: [[0, .75, 4.2], [0, .7, 0], 36], 1: [[0, 3.1, 10.5], [0, 2.4, -1], 44], 2: [[0, 0, 2], [0, 0, -7], 64],
          3: [[0, 1.8, 10], [0, 1.4, 0], 44], 4: [[0, 2.8, 14], [0, 2.8, 0], 50], 5: [[0, 2.7, 12], [0, 2.6, -2], 44],
          6: [[0, 3.8, 15], [0, 3.3, WALL.z], 44], 7: [[0, 3.6, 17], [0, 3.3, WALL.z], 44],
        };
        const [eye, target, fov] = views[shot.phase] || views[1];
        return cam(eye, target, fov);
      }
    }
  }
  // Shots that pull back for narrow (phone) screens so their subject stays in frame.
  const PULL_FOR_NARROW = new Set(['powerOn', 'title', 'carousel', 'carouselWide', 'carouselLow', 'surf', 'surfReveal', 'eyeOpen',
    'pendulum', 'eyeWatch', 'wallReveal', 'wallOrbit', 'wallLow', 'wallPush', 'wallPull', 'powerOff', 'stormSpiral', 'stormRing', 'calm']);

  // MARK: titles and lyrics as 3D lettering

  const TITLE = 'MESMERIZER';
  const RING = 'MESMERIZER ★ MESMERIZER ★ ';

  /** The title in 3D: it forms over the studio, circles the chorus vortex and fronts the wall. */
  function titles(tl, loc, t, adv, pulse, reduce) {
    const out = [], s = loc.section, b = chapterBeat(tl, s, t);
    const glyph = (ch, m, size, alpha, order, role = 'title') => out.push({ ch, m, size, role, alpha: clamp(alpha), sung: true, singing: false, age: 9, order, line: -1 });
    const row = (size, at, appear, spread, exit) => {
      const chars = Array.from(TITLE);
      let x = -chars.reduce((sum, ch) => sum + adv(ch) * 1.06, 0) * size / 2;
      chars.forEach((ch, k) => {
        const a = adv(ch) * 1.06 * size, cx = x + a / 2;
        x += a;
        const inU = reduce ? 1 : clamp((b - appear - k * spread) / .9);
        const outU = exit == null || reduce ? 0 : clamp((b - exit - k * .12) / 1.4);
        if (inU <= 0 || outU >= 1) return;
        let px = cx, py = 0, pz = 0, rz = 0, ry = 0, scale = 1;
        if (!reduce) {
          const k2 = 1 - easeOut(inU), o = easeIn(outU);
          py += k2 * 2.2 + .1 * pulse * (k % 2 ? 1 : -1) + Math.sin(t * 1.7 + k) * .05;
          ry += k2 * Math.PI * (k % 2 ? 1 : -1);
          scale *= Math.max(.05, easeOutBack(inU));
          py += o * 4; pz -= o * 5; rz += o * (k % 2 ? .6 : -.6);
        }
        const pivot = PIVOT * size;
        glyph(ch, chain(T(...at), T(px, py + pivot, pz), RY(ry), RZ(rz), S(scale), T(0, -pivot, 0)), size, ease(inU) * (1 - outU), k);
      });
    };
    if (loc.phase === 1) row(.95, [0, 3.65, -1], 1, 1, 14);
    if (loc.phase === 6) row(1.05, [0, WALL.center[1], WALL.z + 1.6], 1, .5, null);
    if (loc.phase === 4) {
      // A ring of letters circling the vortex, upright at the top and reading clockwise.
      const chars = Array.from(RING), radius = 5.6, centre = [0, 2.8, .8], size = .6;
      const spin = reduce ? 0 : (t - s.start) * .22 + .12 * Math.floor(b);
      const fade = ease((t - s.start) / .5) * (1 - ease((t - s.end + .4) / .4));
      chars.forEach((ch, k) => {
        if (/\s/.test(ch)) return;
        const a = k * TAU / chars.length - spin;
        const p = [centre[0] + Math.sin(a) * radius, centre[1] + Math.cos(a) * radius, centre[2]];
        const pivot = PIVOT * size;
        glyph(ch, chain(T(p[0], p[1], p[2]), RZ(-a), S(1 + (reduce ? 0 : .12 * pulse)), T(0, -pivot, 0)), size, fade, k, 'ring');
      });
    }
    return out;
  }

  const lyricCache = new WeakMap();
  /** Timed lyrics ride in front of the camera, so every scene keeps them front and centre. */
  function lyricLetters(model, layouts, t, cam, aspect, reduce, pulse) {
    if (!model.length) return [];
    const world = K.invert(K.lookAt(cam.eye, cam.target, cam.roll, cam.up));
    const tv = Math.tan(cam.fov * Math.PI / 360), th = tv * aspect, out = [];
    for (const line of model) {
      if (t < line.enterAt || t > line.exitAt + 1) continue;
      const lay = layouts[line.index];
      const dist = Math.max(lay.width / 2 / (th * .74), lay.height / 2 / (tv * .56), 2);
      const sway = reduce ? 0 : .16 * Math.sin(t * .4 + line.index * 1.7), tilt = reduce ? 0 : .05 * Math.sin(t * .33 + line.index);
      const block = chain(world, T(0, -tv * dist * .06, -dist), RY(sway), RX(tilt));
      for (const g of lay.glyphs) {
        const inst = glyphInstance(g, line, block, t, reduce, pulse);
        if (inst) out.push(inst);
      }
    }
    return out;
  }

  /** Every pure per-frame decision, without touching WebGL (used by the renderer and the tests). */
  function frameAt(input, cache = {}) {
    const aspect = clamp((input.width || 16) / (input.height || 9), .3, 4);
    const adv = typeof input.metrics === 'function' ? input.metrics : approxAdvance;
    const lines = input.lyrics?.lines || null;
    const key = [input.variant, input.duration, input.bpm, input.beatOffset, !!input.reducedMotion, Math.round(aspect * 20),
      input.metricsEpoch || 0, input.lyrics?.offset, input.lyrics?.language].join('|');
    if (cache.key !== key || cache.lines !== lines) {
      const tl = timeline(input);
      const model = lyricModel(input.lyrics, tl);
      const maxW = mix(5.4, 9.6, clamp((aspect - .6) / 1.15));
      Object.assign(cache, { key, lines, tl, model, layouts: model.map(line => layoutLine(line, adv, maxW)), shots: planShots(tl) });
    }
    const { tl, model, layouts, shots } = cache;
    const t = clamp(Number.isFinite(input.time) ? input.time : 0, 0, tl.duration);
    const loc = locate(tl, t), s = loc.section, ph = loc.phase, reduce = tl.reduce;
    const shot = shotAt(shots, t);
    const u = clamp((t - shot.start) / Math.max(.001, shot.end - shot.start));
    const beatPos = (t - tl.offset) / tl.period, b = chapterBeat(tl, s, t);
    const pulse = reduce || t >= tl.duration ? 0 : Math.pow(1 - fract(beatPos), 4);
    const signal = (typeof input.signal === 'function' && input.signal(t)) || {};
    const energy = clamp(Number.isFinite(signal.energy) ? signal.energy : .55);
    const lift = liftAt(tl, t);
    const cam = shotCamera(shot, u, { tl, s, t });
    if (aspect < 1.25 && PULL_FOR_NARROW.has(shot.kind)) {
      // Narrow screens: step back along the line of sight so the subject still fits.
      const k = mix(1.85, 1, clamp((aspect - .55) / .7));
      cam.eye = add(cam.target, v3.scale(v3.sub(cam.eye, cam.target), k));
    }
    if (!reduce) {
      const shake = (lift * .03 + .006) * pulse * (.5 + energy);
      const n = k => noise(t * 15 + k * 31.7) * shake;
      cam.eye = add(cam.eye, [n(1), n(2), n(3)]);
      cam.target = add(cam.target, [n(4) * .5, n(5) * .5, n(6) * .5]);
      cam.fov *= 1 - .02 * pulse * lift;
    }

    // The set's moving parts for this moment.
    const local = t - s.start;
    const env = {
      phase: ph, beat: b, local, lift,
      turn: ph === 1 ? carouselTurn(tl, s, t) * (reduce ? .2 : 1) : 0,
      swing: ph === 5 ? swingAt(tl, s, t) : 0,
      // The TV switches on (a bright line opening to the picture); everything switches off at the end.
      power: ph === 0 ? ease((local - .5) / 1.7) : ph === 7 ? 1 - ease(local / 1.6) : 1,
      // The eye opens at its chapter's start and blinks on every eighth beat.
      open: ph === 5 ? ease(b / 2) * (reduce ? 1 : 1 - .94 * Math.pow(Math.max(0, Math.sin(Math.PI * clamp((fract(b / 8) * 8 - 7.6) / .4))), .6)) : 1,
    };
    // Lettering: the 3D title in the world, and timed lyrics in front of the camera.
    const words = lyricLetters(model, layouts, t, cam, aspect, reduce, pulse);
    const titleFade = words.length ? .35 : 1;
    const world = titles(tl, loc, t, adv, pulse, reduce).map(g => ({ ...g, alpha: g.alpha * titleFade }));

    // The finishing pass: TV static on every chapter cut, a flash and speed lines when a
    // chorus hits, scanlines that thicken as the set switches on and off.
    const since = local;
    let flash = 0, flashColor = [1, 1, 1], speed = cam.speed || 0, still = 0, aberration = 0;
    if (!reduce) {
      if (loc.index > 0 && since < .24) still = Math.pow(1 - since / .24, 1.5);
      if (CHORUS.has(ph) && since < .4) { flash = .5 * Math.pow(1 - since / .4, 2); flashColor = PAPER; speed = Math.max(speed, 1 - since / .4); }
      aberration = .003 * pulse * lift + speed * .005;
    } else speed = 0;
    const fadeOut = ease((t - (tl.duration - 1.6)) / 1.5);
    const post = {
      bloom: .26 + lift * .14, threshold: .9, speedLines: speed, flash, flashColor, invert: 0, aberration, letterbox: 0,
      vignette: .2, grain: .025, saturation: 1.1, exposure: 1 - fadeOut, time: t, static: still,
      scanlines: ph === 0 || ph === 7 ? .3 : .06,
    };
    return { t, tl, loc, env, shot, u, cam, beatPos, pulse, energy, lift, post, reduce, world, words, text: [...world, ...words], model, layouts };
  }

  // MARK: shapes

  function starShape(points = 10, outer = 1, inner = .55) {
    const pts = [];
    for (let k = 0; k < points * 2; k++) {
      const a = k / (points * 2) * TAU + Math.PI / 2, r = k % 2 ? inner : outer;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  function buildGeometry() {
    const G = {};
    G.panel = K.plane(1, 1);
    G.floor = K.plane(1, 1);
    // A retro TV facing +z, standing on short legs: a coloured cabinet, then the ink parts
    // (screen bezel, knobs, speaker grille, rabbit-ear antennas and legs).
    G.tvBody = K.merge([{ g: K.box(1.5, 1.1, .9), m: T(0, .67, 0) }]);
    const dark = [
      { g: K.box(1.06, .88, .04), m: T(SCREEN.x, SCREEN.y, .44) },
      { g: K.cylinder(.085, .085, .07, 16), m: chain(T(.5, .9, .46), RX(Math.PI / 2)) },
      { g: K.cylinder(.085, .085, .07, 16), m: chain(T(.5, .62, .46), RX(Math.PI / 2)) },
    ];
    for (let k = 0; k < 3; k++) dark.push({ g: K.box(.26, .035, .02), m: T(.5, .36 - k * .07, .455) });
    G.tvDarkPlain = K.merge(dark);
    G.monitorBezel = K.merge([{ g: K.box(WALL_SCREEN.w + .08, WALL_SCREEN.h + .08, .04), m: T(0, WALL_SCREEN.y, .44) }]);
    for (const sgn of [-1, 1]) {
      dark.push({ g: K.cylinder(.018, .018, .72, 8), m: chain(T(0, 1.22, 0), RZ(sgn * .5), T(0, .36, 0)) });
      dark.push({ g: K.sphere(.05, 10, 8), m: chain(T(0, 1.22, 0), RZ(sgn * .5), T(0, .72, 0)) });
    }
    dark.push({ g: K.sphere(.09, 12, 8), m: chain(T(0, 1.22, 0), S(1.3, .6, 1)) });
    for (const [x, z] of [[-.58, -.3], [.58, -.3], [-.58, .3], [.58, .3]]) dark.push({ g: K.cylinder(.035, .045, .12, 8), m: T(x, .06, z) });
    G.tvDark = K.merge(dark);
    G.pedestal = K.lathe([[0, 1.05], [.5, 1.05], [.5, .98], [.3, .9], [.26, .12], [.42, .06], [.42, 0], [0, 0]], 24);
    G.platform = K.cylinder(5.6, 5.8, .3, 64);
    G.star = K.extrude(starShape(), .22);
    G.candy = K.cylinder(.5, .5, .16, 40);
    G.ring = K.torus(TUNNEL.radius - .25, .13, 64, 10);
    // The tunnel: an open tube; drawn turned so its local y runs down -z, which its
    // spiral stripes are measured along.
    G.tunnel = K.lathe([[TUNNEL.radius, 200], [TUNNEL.radius, -6]], 56, true);
    // The eye: a white, a lid line and lashes, a lower line, and the iris disc.
    G.sclera = K.sphere(1, 40, 24);
    G.disc = K.cylinder(.5, .5, .08, 48);
    const lid = [{ g: K.torus(1, .07, 40, 8, Math.PI), m: RX(-Math.PI / 2) }];
    for (let k = 0; k < 7; k++) {
      const a = .25 + k / 6 * (Math.PI - .5), len = .32 + .08 * Math.sin(k / 6 * Math.PI);
      lid.push({ g: K.cone(10, 2), m: chain(T(Math.cos(a), Math.sin(a), 0), RZ(a - Math.PI / 2), T(0, len, 0), S(.06, len, .06)) });
    }
    G.lid = K.merge(lid);
    G.lowLid = K.merge([{ g: K.torus(1, .045, 40, 8, Math.PI), m: RX(Math.PI / 2) }]);
    // The pocket watch: a gold case with a crown, on a chain.
    G.watchCase = K.merge([{ g: K.torus(.68, .1, 48, 10), m: RX(Math.PI / 2) }, { g: K.cylinder(.09, .09, .16, 12), m: T(0, .82, 0) },
      { g: K.torus(.1, .03, 16, 6), m: chain(T(0, .97, 0), RX(Math.PI / 2)) }]);
    G.chain = K.cylinder(.025, .025, 1, 8);
    // The video wall: every screen in one mesh, laid out across a unit square so a single
    // picture spans them all (the model matrix scales it to the wall).
    const quads = [];
    for (let row = 0; row < WALL.rows; row++) for (let col = 0; col < WALL.cols; col++) {
      const cx = ((col + .5) * WALL.dx - WALL.w / 2 + WALL_SCREEN.x) / WALL.w;
      const cy = (row * WALL.dy + WALL_SCREEN.y - WALL.h / 2) / WALL.h;
      quads.push({ g: G.panel, m: chain(T(cx, 0, -cy), S(WALL_SCREEN.w / WALL.w, 1, WALL_SCREEN.h / WALL.h)) });
    }
    G.wallScreens = K.merge(quads);
    return G;
  }

  // MARK: rendering

  const TEXT_STYLE = {
    main: { layers: 10, depth: .34 }, romaji: { layers: 3, depth: .09 }, trans: { layers: 3, depth: .09 },
    title: { layers: 10, depth: .36 }, ring: { layers: 6, depth: .24 },
  };
  /** Pop-art lettering colours: cream faces, coloured sides, ink round every letter. */
  function letterColors(inst, pal) {
    switch (inst.role) {
      case 'title': return { top: PAPER, bottom: pal.yellow, near: pal.red, far: pal.deep };
      case 'ring': return { top: PAPER, bottom: pal.cyan, near: pal.blue, far: INK };
      case 'romaji': return inst.sung ? { top: PAPER, bottom: pal.yellow, near: INK, far: INK } : { top: PAPER, bottom: [.85, .86, .9], near: INK, far: INK };
      case 'trans': return { top: PAPER, bottom: [.9, .9, .88], near: INK, far: INK };
      default: {
        if (inst.singing) return { top: [1, 1, 1], bottom: pal.yellow, near: pal.red, far: pal.deep };
        if (inst.sung) return { top: pal.yellow, bottom: pal.red, near: pal.blue, far: INK };
        return { top: PAPER, bottom: [.86, .88, .92], near: pal.blue, far: INK };
      }
    }
  }

  /** Creates the music video on a canvas; returns null when WebGL2 is unavailable. */
  function create(canvas, options = {}) {
    const r = options.renderer || K.createRenderer(canvas, { font: LYRIC_FONT });
    if (!r) return null;
    const G = buildGeometry();
    const B = { dots: batch(900), confetti: batch(700), sparkle: batch(300), glow: batch(300) };
    const cache = {};
    const lettering = L.createLettering(r, TEXT_STYLE);
    const metrics = ch => r.glyph(ch).advance;
    const doc = typeof document === 'object' ? document : null;
    if (doc?.fonts?.load) {
      Promise.all([doc.fonts.load('800 84px "Atkinson Hyperlegible Next"'), doc.fonts.ready])
        .then(() => r.resetGlyphs()).catch(() => {});
    }
    const DARK = { color: INK, shade: INK };

    function draw(input) {
      if (r.lost()) return null;
      const width = Math.max(1, input.width | 0), height = Math.max(1, input.height | 0);
      const f = frameAt({ ...input, metrics, metricsEpoch: r.glyphEpoch }, cache);
      const { t, tl, loc, env, cam, beatPos, pulse, lift, reduce } = f;
      const pal = tl.palette, ph = loc.phase, s = loc.section, b = env.beat;
      const motionT = reduce ? t * .2 : t;
      const toon = (color, extra = {}) => ({ color, shade: mixc(color, INK, .42), outline: 2, outlineColor: INK, spec: .15, ...extra });
      const night = ph === 0 || ph === 7 || ph === 2;
      const clear = night ? [.02, .03, .06] : mixc(INK, pal.blue, .35);
      if (!r.begin(width, height, clear)) return null;
      r.camera({ eye: cam.eye, target: cam.target, roll: cam.roll, fov: cam.fov, up: cam.up });
      r.lights({ keyDir: v3.norm([-.45, .8, .55]), keyColor: [.78, .76, .74], ambient: [.42, .42, .46],
        fog: ph === 2 ? [.04, .05, .12] : clear, fogNear: ph === 2 ? 14 : 60, fogFar: ph === 2 ? 62 : 160, spots: [] });
      r.sky({ top: mixc(clear, [0, 0, 0], .3), horizon: clear, bottom: mixc(clear, [0, 0, 0], .5), stars: night ? .6 : 0, moon: 0, time: t });

      // A flat pop-art picture on a unit panel, or on a TV screen.
      const PARAMS = { 8: [3, 2.2, 1.1], 9: [.09, 18, 3], 10: [12, .12, .4], 11: [7, 0, .8], 12: [60, 0, 0], 13: [0, 0, 0], 14: [.36, 0, 1.2], 15: [6, .3, 1.2] };
      const pic = (mode, o = {}) => ({ mode, a: PAPER, b: pal.red, c: pal.yellow, d: pal.blue, ink: INK, time: motionT, beat: beatPos,
        width: SCREEN.w, height: SCREEN.h, params: PARAMS[mode], gain: .95, power: 1, ...o });
      const glass = screen => ({ color: [.02, .02, .03], spec: .55, screen });
      const CHANNELS = [8, 9, 10, 11, 13, 14];
      const bodyColors = [pal.cyan, pal.red, pal.yellow, pal.blue];
      const drawTv = (model, body, screen, antenna = true) => {
        r.draw(G.tvBody, model, toon(body));
        r.draw(antenna ? G.tvDark : G.tvDarkPlain, model, DARK);
        r.draw(G.panel, chain(model, T(SCREEN.x, SCREEN.y, SCREEN.z), RX(Math.PI / 2), S(SCREEN.w, 1, SCREEN.h)), glass(screen));
      };
      /** A channel for TV k: it flips every `every` beats, with a burst of static as it changes. */
      const channelOf = (k, every, delay = 0) => {
        const flip = Math.floor((b - delay) / every), since = (b - delay) - flip * every;
        if (!reduce && since < .3 && b > delay) return pic(12, { a: pal.cyan });
        const mode = CHANNELS[Math.floor(hash(k * 13.7 + flip * 3.1) * CHANNELS.length)];
        const turn = Math.floor(hash(k * 5.3 + flip) * 4);
        const order = [PAPER, pal.red, pal.yellow, pal.blue, pal.cyan];
        return pic(mode, { a: order[turn % 5], b: order[(turn + 1) % 5], c: order[(turn + 2) % 5], d: order[(turn + 3) % 5] });
      };
      const backdrop = (mode, at, size, o = {}) => r.draw(G.panel, chain(T(...at), RX(Math.PI / 2), S(size[0], 1, size[1])),
        { color: [.02, .02, .03], screen: pic(mode, { width: size[0], height: size[1], gain: .9, ...o }) });
      const starburst = (p, k, size, color) => r.draw(G.star, chain(T(...p), RZ(motionT * (.3 + hash(k) * .4) * (k % 2 ? 1 : -1)), RY(Math.sin(motionT * .7 + k) * .5), S(size * (1 + .12 * pulse))),
        toon(color, { emit: scalec(color, .12) }));
      const candy = (p, k, size) => r.draw(G.candy, chain(T(...p), RX(Math.PI / 2 + Math.sin(motionT * .6 + k) * .3), RY(motionT * (.8 + hash(k) * .6)), S(size)),
        { ...toon(PAPER), outline: 1.6, screen: pic(8, { width: 1, height: 1, params: [3, 1.6, 0], a: PAPER, b: k % 2 ? pal.red : pal.blue, c: PAPER, d: pal.yellow }) });

      switch (ph) {
        case 0: { // power-on: one TV in the dark
          drawTv(T(0, 0, 0), pal.red, env.power < .999 || env.local < 2.4 ? pic(12, { power: env.power, a: pal.cyan }) : pic(8));
          break;
        }
        case 1: { // on air: the carousel under a turning spiral
          backdrop(8, [0, 6, -26], [64, 40], { params: [3, 2.2, .25], a: PAPER, b: pal.red, c: PAPER, d: pal.blue });
          r.draw(G.platform, T(CAROUSEL.center[0], -.15, CAROUSEL.center[2]), { ...toon(pal.blue), screen: pic(9, { width: 11.4, height: 11.4, params: [.9, 1.1, 1.2], a: pal.cyan, b: pal.blue, gain: .8 }) });
          for (let k = 0; k < CAROUSEL.n; k++) {
            const m = carouselTv(k, env.turn);
            r.draw(G.pedestal, chain(m, T(0, -CAROUSEL.top, 0)), toon(PAPER));
            drawTv(m, bodyColors[k % 4], channelOf(k, 8, k * .5));
          }
          for (let k = 0; k < 8; k++) {
            const a = k * TAU / 8 + motionT * .08, p = [Math.sin(a) * 9, 3.6 + Math.sin(motionT * .9 + k) * .5 + (k % 3) * 1.2, -1 + Math.cos(a) * 6 - 3];
            k % 2 ? starburst(p, k, .55, k % 4 === 1 ? pal.yellow : pal.red) : candy(p, k, .9);
          }
          break;
        }
        case 2: { // the dive: into a screen, then down a spiral tunnel
          if (f.shot.kind === 'diveIn') {
            backdrop(10, [0, 2, -12], [60, 40], { params: [14, 1.2, .3], a: pal.blue, b: INK, c: pal.yellow });
            drawTv(S(1.5), pal.yellow, pic(8, { params: [3, 2.6, 2] }));
          } else {
            const z0 = f.cam.eye[2];
            r.draw(G.tunnel, RX(-Math.PI / 2), glass(pic(15, { width: 1, height: 1, params: [6, .18, 1.4], a: PAPER, b: pal.red, c: pal.yellow, d: pal.blue, gain: .85 })));
            for (let k = Math.ceil(-(z0 + 6) / 7); k <= Math.floor((48 - z0) / 7); k++) {
              const z = -k * 7;
              const c = [pal.cyan, pal.red, pal.yellow, pal.blue][((k % 4) + 4) % 4];
              r.draw(G.ring, chain(T(0, 0, z), RX(Math.PI / 2), RY(motionT * .5 * (k % 2 ? 1 : -1)), S(1 + .05 * pulse)), toon(c, { emit: scalec(c, .25) }));
              // Props ride close to the walls, clear of the camera's winding path.
              const a = hash(k * 3.3) * TAU, rr = 3 + hash(k * 1.9) * .35, p = [Math.cos(a) * rr, Math.sin(a) * rr, z - 3.5];
              if (k % 3 === 0) drawTv(chain(T(...p), RY(motionT * .6 + k), RX(Math.sin(motionT + k) * .5), S(.75), T(0, -.67, 0)), bodyColors[k % 4], channelOf(k, 4));
              else if (k % 3 === 1) starburst(p, k, .45, k % 2 ? pal.yellow : pal.cyan);
              else candy(p, k, .8);
            }
          }
          break;
        }
        case 3: { // channel surf: the stacked wall, every channel flipping in a wave
          backdrop(10, [0, 3, -6], [60, 34], { params: [16, 1.4, .25], a: pal.yellow, b: PAPER, c: pal.red });
          r.draw(G.floor, chain(T(0, -.02, 2), S(40, 1, 24)), { color: PAPER, shade: PAPER, depthWrite: true, floor: { b: pal.cyan, tile: 1.1 } });
          for (let row = 0; row < SURF.rows; row++) for (let col = 0; col < SURF.cols; col++) {
            const k = row * SURF.cols + col;
            drawTv(surfTv(col, row), bodyColors[(k + row) % 4], channelOf(k, 2, col * .12), row === SURF.rows - 1);
          }
          break;
        }
        case 4: { // the spiral storm: everything drawn round and into the spiral
          backdrop(8, [0, 2.8, -26], [90, 70], { params: [4, 2.6, .7 + lift * .5], a: PAPER, b: pal.red, c: pal.yellow, d: pal.blue });
          const tt = motionT - s.start;
          for (let j = 0; j < 22; j++) {
            const period = 6 + hash(j * 2.1) * 3, ph0 = hash(j * 4.7), w = fract(tt / period + ph0);
            const radius = mix(10.5, 1.2, ease(w)), a = hash(j * 7.9) * TAU + w * TAU * 1.4 + tt * .3;
            const p = [Math.sin(a) * radius, 2.8 + Math.cos(a) * radius * .75, mix(-2, -16, easeIn(w))], size = mix(1, .35, w);
            if (j % 3 === 0) drawTv(chain(T(...p), RZ(-a), RY(tt * .8 + j), S(size * .9), T(0, -.67, 0)), bodyColors[j % 4], channelOf(j, 4), false);
            else if (j % 3 === 1) starburst(p, j, .6 * size, j % 2 ? pal.yellow : pal.cyan);
            else candy(p, j, size * 1.1);
          }
          break;
        }
        case 5: { // the eye and the pocket watch
          backdrop(11, [0, 3, -9], [70, 46], { params: [.35, 0, .5], a: pal.blue, b: INK, c: pal.blue, d: mixc(pal.blue, INK, .5), gain: .75 });
          const open = Math.max(.04, env.open), look = Math.sin(env.swing) * .9;
          const eyeM = chain(T(...EYE), S(1, open, 1));
          r.draw(G.sclera, chain(eyeM, S(3.3, 1.8, .85)), toon(PAPER, { outline: 2.5 }));
          r.draw(G.disc, chain(eyeM, T(look, 0, .88), RX(Math.PI / 2), S(2.9, 1, 2.9)),
            { ...glass(pic(14, { width: 2.9, height: 2.9, a: pal.cyan, b: pal.blue, c: pal.cyan, d: pal.deep })), outline: 1.6, outlineColor: INK });
          r.draw(G.lid, chain(T(...EYE), T(0, 0, .2), S(3.45, 1.95 * open, 1)), DARK);
          r.draw(G.lowLid, chain(T(...EYE), T(0, 0, .2), S(3.35, 1.85 * open, 1)), DARK);
          const W = watchAt(env.swing), watch = chain(T(...W), RZ(env.swing), RY(Math.sin(motionT * .8) * .35));
          const top = apply(watch, [0, .97, 0]);
          r.draw(G.chain, chain(T(...v3.scale(add(PIVOT_TOP, top), .5)), RZ(env.swing), S(1, v3.dist(PIVOT_TOP, top), 1)), toon(pal.yellow));
          r.draw(G.watchCase, watch, toon(pal.yellow, { spec: .9, emit: scalec(pal.yellow, .1) }));
          r.draw(G.disc, chain(watch, RX(Math.PI / 2), S(1.3, 1, 1.3)), glass(pic(8, { width: 1, height: 1, params: [2, 1.8, 1.6], a: PAPER, b: pal.red, c: PAPER, d: INK })));
          for (let k = 0; k < 6; k++) {
            const a = k * TAU / 6 + motionT * .1, p = [Math.sin(a) * 7.5, 2.5 + Math.cos(a) * 4, -6];
            starburst(p, k, .5, k % 2 ? pal.yellow : pal.red);
          }
          break;
        }
        case 6: case 7: { // the video wall, then everything switches off
          backdrop(10, [0, 4, -8], [80, 46], { params: [18, 3, .35], a: pal.blue, b: INK, c: pal.yellow });
          r.draw(G.floor, chain(T(0, -.02, 4), S(46, 1, 26)), { color: PAPER, shade: PAPER, depthWrite: true, spec: .2,
            floor: { b: pal.blue, tile: 1.2, ringColor: pal.yellow, ringCenter: [0, 0, WALL.z + 2], ringRadius: fract(beatPos) * 12, ringAmount: (.3 + lift * .5) * (1 - fract(beatPos)) * env.power } });
          for (let row = 0; row < WALL.rows; row++) for (let col = 0; col < WALL.cols; col++) {
            const k = row * WALL.cols + col;
            const m = T((col + .5) * WALL.dx - WALL.w / 2, WALL.bottom + row * WALL.dy, WALL.z);
            r.draw(G.tvBody, m, toon(bodyColors[(col + row * 2) % 4]));
            r.draw(G.monitorBezel, m, DARK);
            // A few monitors drop to static for a beat, here and there.
            if (!reduce && env.power > .99 && hash(k * 7.7 + Math.floor(b)) > .94) {
              r.draw(G.panel, chain(m, T(WALL_SCREEN.x, WALL_SCREEN.y, WALL_SCREEN.z + .004), RX(Math.PI / 2), S(WALL_SCREEN.w, 1, WALL_SCREEN.h)),
                glass(pic(12, { a: pal.cyan, width: WALL_SCREEN.w, height: WALL_SCREEN.h })));
            }
          }
          // Every eighth beat the whole wall changes channel together.
          const wallMode = [8, 11, 8, 10][Math.floor(Math.max(0, b) / 8) % 4];
          r.draw(G.wallScreens, chain(T(0, WALL.bottom + WALL.h / 2, WALL.z + WALL_SCREEN.z), RX(Math.PI / 2), S(WALL.w, 1, WALL.h)),
            glass(pic(wallMode, { width: WALL.w, height: WALL.h, power: env.power, params: wallMode === 8 ? [4, 2.4, 1 + lift * .6] : wallMode === 11 ? [1.1, 0, 1.4] : [18, .8, .5],
              a: PAPER, b: pal.red, c: pal.yellow, d: pal.blue })));
          if (ph === 6) for (let k = 0; k < 6; k++) {
            const sgn = k % 2 ? 1 : -1, p = [sgn * (10.5 + (k >> 1) * 1.6), 1.5 + (k >> 1) * 2.4 + Math.sin(motionT + k) * .3, WALL.z + 3];
            starburst(p, k, .7, [pal.yellow, pal.red, pal.cyan][k % 3]);
          }
          break;
        }
        default: break;
      }

      // Points: halftone dots drifting through every scene, confetti when a chorus hits.
      for (const batchOf of Object.values(B)) batchOf.reset();
      const dotColors = [pal.red, pal.yellow, pal.cyan, pal.blue, PAPER];
      const centre = ph === 2 ? [0, 0, f.cam.eye[2] - 14] : ph === 6 || ph === 7 ? [0, 3, 0] : ph === 4 ? [0, 2.8, -2] : [0, 2.5, 0];
      if (ph !== 0 && ph !== 7) for (let k = 0; k < 160; k++) {
        const h1 = hash(k * 1.7), h2 = hash(k * 3.1), h3 = hash(k * 5.3);
        const span = ph === 2 ? 28 : 24;
        const p = [centre[0] + (h1 - .5) * span, centre[1] + (fract(h2 + motionT * (.015 + h3 * .02)) - .5) * 12, centre[2] + (h3 - .5) * span];
        if (ph === 2) p[2] = centre[2] + (fract(h3 - (f.cam.eye[2] - 2) / span) - .5) * span;
        B.dots.push(p, dotColors[k % 5], .9, .14 + h1 * .22);
      }
      for (const chorus of tl.sections) {
        if (!chorus.chorus) continue;
        const age = t - chorus.start;
        if (age < 0 || age > 6 || reduce) continue;
        for (let k = 0; k < 240; k++) {
          const h1 = hash(k * 1.3 + chorus.start), h2 = hash(k * 2.7 + chorus.start), h3 = hash(k * 4.1 + chorus.start);
          const dir = v3.norm([h1 - .5, h2 * .8 + .2, h3 - .5]), e = (1 - Math.exp(-1.6 * age)) / 1.6;
          const p = add(chorus.phase === 4 ? [0, 2.8, 2] : [0, 3, WALL.z + 3], [dir[0] * 16 * e, dir[1] * 12 * e - 1.4 * Math.max(0, age - .5) * age, dir[2] * 10 * e]);
          B.confetti.push(p, dotColors[k % 5], .95 * (1 - clamp(age - 5)), .2, age * (3 + h2 * 5) + k);
        }
      }
      r.points(B.dots.data, B.dots.count, 'disc', false);
      r.points(B.confetti.data, B.confetti.count, 'confetti', false);

      // The title in the world, then the lyrics riding in front of the camera.
      lettering(f.world, cam.eye, inst => letterColors(inst, pal));
      lettering(f.words, cam.eye, inst => letterColors(inst, pal), true);
      r.end({ ...f.post, focus: [.5, .5] });
      const byte = c => c.map(v => Math.round(clamp(v) * 255));
      return { phase: ph, chapter: CHAPTERS[ph], shot: f.shot.kind, lift, pulse, letters: f.text.length,
        palette: { primary: byte(pal.red), secondary: byte(pal.cyan), accent: byte(pal.yellow) } };
    }

    return Object.freeze({ draw, dispose: () => r.dispose(), lost: () => r.lost() });
  }

  return Object.freeze({ create, frameAt, timeline, planShots, shotCamera, buildGeometry, CLOCKS, PALETTES, CHAPTERS, PLANS });
});
