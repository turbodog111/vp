// Trick Heart: "The Card Trick", VP's 3D music video for MIMI feat. Kasane Teto SV's
// Trick Heart. A parlour magic show around a velvet card table, with the lyrics as the
// star: every line floats above the table as extruded 3D type, each character lighting
// up as it is sung, with romaji above and the English below. No characters: the props
// perform. An ace of hearts hovers over the table and vanishes; the curtain rises on a
// giant fan of cards that flips in waves through the choruses while cards pour down
// both sides of the frame; cards fountain out of a top hat in the interlude; a house of
// cards is built on the beat through the second verse and collapses in the quiet reveal
// to show a glowing heart, which a tornado of cards circles in the final chorus before
// the curtain falls. Every cut has a reason (a new section, the beat before a new line,
// the next bar of an instrumental) and every move is slow and motivated. Every frame is a
// pure function of media time, the recording's sections and beat, and the lyric timing.
((root, factory) => {
  const kit = root.Mv3d || (typeof require === 'function' ? require('./mv3d.js') : null);
  const lyrics = root.MvLyrics3d || (typeof require === 'function' ? require('./mv-lyrics3d.js') : null);
  const api = factory(kit, lyrics);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrickHeartMv = api;
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
  const INK = [.08, .025, .07];
  const CREAM = rgb(0xfff3d8);
  const GOLD = rgb(0xffd36b);

  // MARK: looks, one per section (phase numbers come from the lyric data)

  const LOOK_SOURCE = {
    0: { sky: [0x0c0412, 0x1e0a26, 0x050208], key: 0xffe2c8, keyI: .38, ambient: .17, primary: 0xcf2854, secondary: 0x7f9cdf, accent: 0xffd36b, felt: 0x8a1236, curtain: 0x5c1438, floor: [0x2c0a1c, 0x13050d], beams: .35 },
    1: { sky: [0x14061c, 0x2c0c2e, 0x07020a], key: 0xffe6cc, keyI: .6, ambient: .21, primary: 0xcf2854, secondary: 0xff8fb0, accent: 0xffd36b, felt: 0x8a1236, curtain: 0x6a1640, floor: [0x3a0c22, 0x160610], beams: .7 },
    2: { sky: [0x1e0614, 0x4a0e2a, 0x0a0208], key: 0xffe8d2, keyI: .85, ambient: .27, primary: 0xe8335f, secondary: 0xffd36b, accent: 0xfff3d8, felt: 0x9a1438, curtain: 0x74183e, floor: [0x4c1028, 0x1c0612], beams: 1 },
    3: { sky: [0x0c0618, 0x24123e, 0x05030a], key: 0xd8c8ff, keyI: .55, ambient: .2, primary: 0x9a4dff, secondary: 0x3fd6c8, accent: 0xffd36b, felt: 0x5a1a7a, curtain: 0x3c1660, floor: [0x24103c, 0x0e0618], beams: .7 },
    4: { sky: [0x060a1e, 0x16224a, 0x04050c], key: 0xc8d8ff, keyI: .6, ambient: .21, primary: 0x5a7fd6, secondary: 0xe07fa8, accent: 0xe8eeff, felt: 0x24346e, curtain: 0x1e2a5a, floor: [0x182448, 0x0a0f22], beams: .5 },
    5: { sky: [0x1c0418, 0x480c36, 0x0a0208], key: 0xffe4ee, keyI: .85, ambient: .27, primary: 0xe0357a, secondary: 0xffd36b, accent: 0xfff0d6, felt: 0x9a1446, curtain: 0x701a48, floor: [0x4a0e30, 0x1c0614], beams: 1 },
    6: { sky: [0x14040a, 0x3a0a18, 0x080206], key: 0xffd8b8, keyI: .5, ambient: .2, primary: 0xcf2854, secondary: 0xffb060, accent: 0xffe0a0, felt: 0x8a1236, curtain: 0x7a1634, floor: [0x3a0c1c, 0x16050c], beams: .55 },
    7: { sky: [0x04061a, 0x0e1438, 0x020308], key: 0xb8c8ff, keyI: .36, ambient: .15, primary: 0x5070c0, secondary: 0xff4d7a, accent: 0xffe0e8, felt: 0x1c2658, curtain: 0x1a1e48, floor: [0x10163a, 0x06081a], beams: .3 },
    8: { sky: [0x220616, 0x5a1030, 0x0c0208], key: 0xfff0dc, keyI: .95, ambient: .3, primary: 0xff2f5e, secondary: 0xffd36b, accent: 0xfff6e6, felt: 0xa01438, curtain: 0x7c1a40, floor: [0x561230, 0x200614], beams: 1 },
    9: { sky: [0x0a0310, 0x1a0820, 0x040106], key: 0xffd8c0, keyI: .3, ambient: .14, primary: 0xcf2854, secondary: 0x7f9cdf, accent: 0xffd36b, felt: 0x7a1030, curtain: 0x5c1438, floor: [0x24081a, 0x10040b], beams: .3 },
  };
  const LOOKS = {};
  for (const [phase, s] of Object.entries(LOOK_SOURCE)) {
    LOOKS[phase] = Object.freeze({
      ...s, sky: s.sky.map(rgb), key: rgb(s.key), primary: rgb(s.primary), secondary: rgb(s.secondary), accent: rgb(s.accent),
      felt: rgb(s.felt), curtain: rgb(s.curtain), floor: s.floor.map(rgb),
    });
  }
  const lookFor = phase => LOOKS[phase] || LOOKS[2];

  // MARK: timeline

  function timeline(input) {
    const sections = (input.sections || [])
      .filter(s => s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      .map(s => ({ ...s, phase: Number.isFinite(s.phase) ? s.phase : 2 }));
    const duration = input.duration > 0 ? input.duration : (sections.at(-1)?.end || 157.05);
    if (!sections.length) sections.push({ start: 0, end: duration, phase: 2, chorus: true });
    const period = 60 / clamp(input.bpm || 150, 40, 260);
    const offset = Number.isFinite(input.beatOffset) ? input.beatOffset : 0;
    const byPhase = new Map();
    sections.forEach((s, index) => { if (!byPhase.has(s.phase)) byPhase.set(s.phase, { ...s, index }); });
    return { sections, duration, period, offset, byPhase, reduce: !!input.reducedMotion };
  }

  function locate(tl, t) {
    const { sections } = tl;
    let index = sections.findIndex(s => t >= s.start && t < s.end);
    if (index < 0) index = t < sections[0].start ? 0 : sections.length - 1;
    const section = sections[index];
    return { index, section, phase: section.phase, local: t - section.start,
      u: clamp((t - section.start) / Math.max(.001, section.end - section.start)) };
  }

  function liftAt(tl, t) {
    let lift = 0;
    for (const s of tl.sections) {
      if (!s.chorus) continue;
      lift = Math.max(lift, ease((t - s.start + .2) / .4) * (1 - ease((t - s.end + .2) / .6)));
    }
    return lift;
  }
  const sectionBeat = (tl, s, t) => (t - tl.offset) / tl.period - Math.round((s.start - tl.offset) / tl.period);

  /** The lyric data keeps each line as matching phrase lists (jp, romaji, en). Joins the
   *  Japanese into at most two halves that break at a phrase boundary. */
  function linesFromPhrases(lines) {
    return (lines || []).filter(line => line && Array.isArray(line.jp) && line.jp.length).map(line => {
      const parts = line.jp.map(String), total = parts.join('').length;
      let text = parts.join('');
      if (total > 9 && parts.length > 1) {
        let best = 1, bestDiff = Infinity, run = 0;
        for (let k = 1; k < parts.length; k++) {
          run += parts[k - 1].length;
          const diff = Math.abs(run - total / 2);
          if (diff < bestDiff) { bestDiff = diff; best = k; }
        }
        text = parts.slice(0, best).join('') + ' ' + parts.slice(best).join('');
      }
      return { start: line.start, end: line.end, text, romaji: line.romaji || [], en: line.en || [], words: line.words };
    });
  }

  // MARK: the set

  const TABLE_TOP = .9, TABLE_R = 1.7;
  const LYRIC_ANCHOR = [0, 3.45, .8];
  const CURTAIN_Z = -7.5;
  const FAN = { pivot: [0, -1.2, -12], n: 13, width: 4.3, reach: 7.3, spread: .165 };
  const CARD_RATIO = 1.4;
  // The house of cards: [x, level, kind] where kind is a leaning pair's left or right card or a flat floor.
  const HOUSE = (() => {
    const cards = [];
    const frame = (x, level) => { cards.push([x, level, 'L'], [x, level, 'R']); };
    [-.5, 0, .5].forEach(x => frame(x, 0));
    cards.push([-.25, 1, 'F'], [.25, 1, 'F']);
    [-.25, .25].forEach(x => frame(x, 1));
    cards.push([0, 2, 'F']);
    frame(0, 2);
    return cards;
  })();
  const HOUSE_CARD = .42, LEAN = .32;
  const HOUSE_STOREY = HOUSE_CARD * CARD_RATIO * Math.cos(LEAN);

  /** The house of cards card k: its matrix in the standing house (a card lies in local xz, face up). */
  function houseCard(k) {
    const [x, level, kind] = HOUSE[k], base = TABLE_TOP + level * (HOUSE_STOREY + .012);
    const h = HOUSE_CARD * CARD_RATIO;
    // A floor card lies flat across the tents below, its long side left to right.
    if (kind === 'F') return chain(T(x, base + .006, 0), RY(Math.PI / 2), S(HOUSE_CARD * 1.1, 1, HOUSE_CARD * 1.1 * CARD_RATIO));
    const sgn = kind === 'L' ? -1 : 1;
    // Two cards lean together like a tent, tops touching: each stands on its bottom edge
    // with its face toward the other card and its width running front to back.
    return chain(T(x + sgn * Math.sin(LEAN) * h / 2, base + Math.cos(LEAN) * h / 2, 0), RZ(sgn * LEAN), RY(-Math.PI / 2), RX(Math.PI / 2), S(HOUSE_CARD, 1, h));
  }

  // MARK: camera shots

  // Cuts land on a section start, on the beat just before a new line is sung, or on the
  // next bar of an instrumental section. Inside a shot the camera makes one slow move.
  const LYRIC_PLANS = {
    0: { first: 'lyricRise', middle: ['lyricLean', 'lyricRead'], last: 'lyricPull' },
    1: { first: 'lyricReveal', middle: ['lyricLean'], last: 'lyricLean' },
    2: { first: 'lyricRush', middle: ['lyricLean', 'lyricRead'], last: 'lyricPull' },
    4: { first: 'lyricRise', middle: ['lyricLean', 'lyricRead'], last: 'lyricDrift' },
    5: { first: 'lyricRush', middle: ['lyricLean', 'lyricRead'], last: 'lyricArc' },
    7: { first: 'lyricRise', middle: ['lyricLean'], last: 'lyricPull' },
    8: { first: 'lyricRush', middle: ['lyricLean', 'lyricRead'], last: 'lyricPull' },
    default: { first: 'lyricLean', middle: ['lyricRead', 'lyricLean'], last: 'lyricPull' },
  };
  const STAGE_PLANS = {
    // The false bottom: the camera follows the cards as they fountain out of the hat.
    3: { beats: [8], kinds: ['hatPush', 'hatLow', 'hatCrane', 'hatOrbit', 'hatPull'] },
    // Intermission: along the closed curtain and up at the marquee.
    6: { beats: [8], kinds: ['curtainTrack', 'marqueeLow', 'curtainTrack', 'marqueePush'] },
    9: { beats: [99], kinds: ['endCard'] },
    default: { beats: [8], kinds: ['tablePush', 'tableOrbit', 'tableLow', 'tablePull'] },
  };
  const LYRIC_KINDS = new Set(['lyricLean', 'lyricRead', 'lyricRush', 'lyricPull', 'lyricArc', 'lyricReveal', 'lyricRise', 'lyricDrift', 'lyricCalm']);
  const MIN_SHOT = 2.4;

  function planShots(tl, model = []) {
    const shots = [];
    const onBeat = t => tl.offset + Math.round((t - tl.offset) / tl.period) * tl.period;
    tl.sections.forEach((s, si) => {
      let index = 0;
      const turns = {};
      const add = (start, end, kind) => {
        const k = index++, n = turns[kind] = (turns[kind] ?? -1) + 1;
        shots.push({ start, end, kind, side: n % 2 ? 1 : -1, n, phase: s.phase, section: si, index: k, seed: hash(si * 13.1 + k * 3.7 + 1) });
      };
      const lines = model.filter(line => line.start >= s.start - .3 && line.start < s.end - .3);
      if (tl.reduce) { add(s.start, s.end, lines.length ? 'lyricCalm' : 'calm'); return; }
      if (lines.length) {
        const cuts = [s.start];
        const intro = onBeat(lines[0].enterAt) - s.start >= MIN_SHOT;
        if (intro) cuts.push(onBeat(lines[0].enterAt));
        for (const line of lines.slice(1)) {
          const cut = onBeat(line.enterAt);
          if (cut - cuts.at(-1) >= MIN_SHOT && s.end - cut >= MIN_SHOT * .75) cuts.push(cut);
        }
        const plan = LYRIC_PLANS[s.phase] || LYRIC_PLANS.default;
        const sung = cuts.length - (intro ? 1 : 0);
        cuts.forEach((cut, k) => {
          const end = k + 1 < cuts.length ? cuts[k + 1] : s.end;
          if (intro && k === 0) { add(cut, end, 'tablePush'); return; }
          const n = k - (intro ? 1 : 0);
          add(cut, end, n === 0 ? plan.first : n === sung - 1 ? plan.last : plan.middle[(n - 1) % plan.middle.length]);
        });
        return;
      }
      const plan = STAGE_PLANS[s.phase] || STAGE_PLANS.default;
      const firstBeat = Math.round((s.start - tl.offset) / tl.period);
      let t = s.start, beats = 0, k = 0;
      while (t < s.end - 1e-3) {
        const step = plan.beats[Math.min(k, plan.beats.length - 1)];
        beats += step;
        let end = step >= 99 ? s.end : tl.offset + (firstBeat + beats) * tl.period;
        if (end <= t + tl.period * .5) end = onBeat(t + step * tl.period);
        if (end > s.end - tl.period * 1.5) end = s.end;
        add(t, end, plan.kinds[k % plan.kinds.length]);
        t = end; k++;
      }
    });
    return shots;
  }

  function frameFor(shot, model, layouts, tl) {
    const s = tl.sections[shot.section];
    let pool = model.filter(line => line.enterAt < shot.end && line.exitAt > shot.start - .2);
    if (shot.kind === 'lyricCalm' || !pool.length) pool = model.filter(line => line.start < s.end && line.end > s.start);
    if (!pool.length) return { w: 7, h: 3 };
    return { w: Math.max(...pool.map(line => layouts[line.index].width)), h: Math.max(...pool.map(line => layouts[line.index].height)) };
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

  /** Camera for a lyric shot: one slow, motivated move that keeps the whole line in frame. */
  function lyricCamera(shot, u, aspect) {
    const f = shot.frame || { w: 7, h: 3 }, side = shot.side || 1, e = mix(u, easeInOut(u), .8);
    const fit = fov => {
      const vf = fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
      return Math.max((f.w / 2) / Math.tan(hf / 2) / .74, (f.h / 2) / Math.tan(vf / 2) / .56, 3.5);
    };
    let fov = 38, yaw = 0, pitch = .08, k = 1.12, lateral = 0, speed = 0, turn = .5;
    switch (shot.kind) {
      case 'lyricLean': // starts to one side and settles in front of the line as it is sung
        yaw = side * mix(.36, .1, e); k = mix(1.18, 1.05, e); pitch = mix(.15, .08, e); break;
      case 'lyricRead': // glides along the line the way it is read
        lateral = mix(-.1, .1, e) * f.w; k = mix(1.12, 1.07, e); pitch = .1; break;
      case 'lyricRush': { // the chorus hits: in from the back of the parlour, then a slow push
        const r = easeOut(clamp(u / .4));
        k = mix(2.7, 1.1, r) - .05 * ease((u - .4) / .6); speed = (1 - r) * .7; pitch = mix(.2, .09, r); break;
      }
      case 'lyricPull': // a section ends: back and up to show the whole stage
        k = mix(1.06, 1.45, e); pitch = mix(.08, .24, e); yaw = side * .1 * e; break;
      case 'lyricArc': // a long line: the camera travels round it and the words turn to meet it
        yaw = side * mix(-1, 1, e) * Math.min(.5, (shot.end - shot.start) * .06); k = 1.14; turn = .55; break;
      case 'lyricReveal': // the curtain rises: back and up to reveal the stage behind
        k = mix(1.02, 1.3, e); pitch = mix(.04, .18, e); break;
      case 'lyricRise': // from the table up to the words
        fov = 44; pitch = mix(-.12, .08, e); yaw = side * .14; break;
      case 'lyricDrift': // drifts away with the last line of the verse
        yaw = side * .16 * Math.sin(u * Math.PI); k = mix(1.06, 1.3, e); pitch = mix(.08, .14, e); break;
      default: k = 1.1; pitch = .08;
    }
    const dist = fit(fov) * k, c = LYRIC_ANCHOR;
    const eye = [c[0] + Math.sin(yaw) * Math.cos(pitch) * dist + lateral, c[1] + Math.sin(pitch) * dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
    const textYaw = Math.atan2(eye[0] - c[0], eye[2] - c[2]) * turn;
    return { eye, target: [c[0] + lateral * .35, c[1], c[2]], fov, roll: 0, up: [0, 1, 0], speed, textYaw };
  }

  /** Camera for a stage shot (the instrumental sections). */
  function stageCamera(shot, u, c) {
    const e = mix(u, easeInOut(u), .75), side = shot.side || 1, F = [0, TABLE_TOP + .7, 0];
    const cam = (eye, target, fov = 42, extra = {}) => ({ eye, target, fov, roll: 0, up: [0, 1, 0], speed: 0, textYaw: 0, ...extra });
    switch (shot.kind) {
      case 'hatPush': // in on the hat as the cards start to fly
        return cam(around(F, side * .3, mix(7.5, 4.2, e), mix(1.3, .6, e)), add(F, [0, .2, 0]), 40);
      case 'hatLow': // from table height, up the fountain of cards
        return cam(around([0, TABLE_TOP + .15, 0], side * (.5 + e * .25), 3.4, 0), [0, mix(2.2, 3, e), 0], 58);
      case 'hatCrane': // rising with the cards
        return cam(around(F, side * (.4 + e * .2), mix(5.4, 4.6, e), mix(-.2, 3.6, e)), add(F, [0, mix(.3, 1.4, e), 0]), 46);
      case 'hatOrbit': // circling the table as the fountain fills the room
        return cam(around(F, side * (-.6 + e * 1.2), 5.6, 1.2), add(F, [0, .7, 0]), 44);
      case 'hatPull': // back to the whole parlour as the trick ends
        return cam(around(F, side * .25, mix(4.5, 11, e), mix(.8, 3.2, e)), add(F, [0, mix(.6, 1.6, e), 0]), 44);
      case 'curtainTrack': // along the closed curtain
        return cam([side * mix(-4, 4, e), 3.2, 6.5], [side * mix(-2.5, 2.5, e), 4.6, CURTAIN_Z], 44);
      case 'marqueeLow': // up at the marquee from the floor
        return cam([side * mix(1.4, .6, e), .6, 5.2], [0, mix(4.6, 5.2, e), CURTAIN_Z], 56);
      case 'marqueePush': // toward the title as the show resumes
        return cam([0, 4.4, mix(12, 7.5, e)], [0, 5, CURTAIN_Z], 44);
      case 'endCard':
        return cam([0, mix(3.4, 4.4, e), mix(10, 13, e)], [0, 4.8, CURTAIN_Z], 44);
      case 'tablePush':
        return cam(around(F, side * .25, mix(7, 4.5, e), mix(1.4, .8, e)), F, 40);
      case 'tableOrbit':
        return cam(around(F, side * (-.5 + e), 5.5, 1.3), F, 42);
      case 'tableLow':
        return cam(around([0, TABLE_TOP + .2, 0], side * (.4 + e * .2), 4, 0), add(F, [0, .8, 0]), 54);
      case 'tablePull':
        return cam(around(F, side * .2, mix(4.5, 10, e), mix(.8, 3, e)), F, 44);
      default: {
        const views = { 3: [[0, 2.6, 7], [0, 1.8, 0]], 6: [[0, 4, 10], [0, 4.8, CURTAIN_Z]], 9: [[0, 4, 12], [0, 4.8, CURTAIN_Z]] };
        const [eye, target] = views[c.phase] || [[0, 2.5, 8], F];
        return cam(eye, target, 44);
      }
    }
  }

  function settle(eye) { return [eye[0], Math.max(.25, eye[1]), eye[2]]; }

  // MARK: per-time state of the set

  function envAt(tl, t, loc, model) {
    const sec = p => tl.byPhase.get(p);
    const ph = loc.phase, s = loc.section, b = sectionBeat(tl, s, t);
    // The curtain: down for the opening, up from the curtain rise, down for the
    // intermission, up again for the reveal, and down at the end.
    let curtain = 0;
    const s1 = sec(1), s6 = sec(6), s7 = sec(7), s9 = sec(9);
    if (ph === 1 && s1) curtain = ease((t - s1.start - .3) / Math.max(1, s1.end - s1.start - 1));
    else if (ph >= 2 && ph <= 5) curtain = 1;
    else if (ph === 6 && s6) curtain = 1 - ease((t - s6.start) / 2.4);
    else if (ph === 7 && s7) curtain = ease((t - s7.start) / 3);
    else if (ph === 8) curtain = 1;
    else if (ph === 9 && s9) curtain = 1 - ease((t - s9.start) / 2);
    // The ace vanishes when the line about it slipping away is sung.
    const vanishAt = (model.find(line => /消/.test(line.text)) || {}).start ?? 8.5;
    const ace = ph === 0 ? 1 - ease((t - vanishAt) / .35) : 0;
    // The house of cards: a card lands about every three beats through the second verse, it
    // stands through the next chorus and intermission, then falls at the reveal.
    const s4 = sec(4);
    let built = 0, collapse = 0;
    if (s4 && t >= s4.start) {
      built = HOUSE.length;
      if (ph === 4) built = clamp((sectionBeat(tl, s4, t) - 1) / 2.8, 0, HOUSE.length);
      if (ph >= 7) collapse = ph === 7 && s7 ? ease((t - s7.start) / 1.6) : 1;
    }
    // The glowing heart rises from the fallen cards and leads the final chorus.
    const heart = ph === 7 && s7 ? ease((t - s7.start - 1.2) / 2.4) : ph === 8 ? 1 : ph === 9 && s9 ? 1 - ease((t - s9.start) / 2) : 0;
    const look = lookFor(ph), lift = liftAt(tl, t);
    return { ph, beat: b, curtain, ace, vanishAt, built, collapse, heart, look, lift, fountain: ph === 3, tornado: ph === 8,
      cascade: s.chorus ? 1 : [4, 7].includes(ph) ? .35 : [1, 3].includes(ph) ? .5 : 0 };
  }

  /** The title in 3D on the closed curtain for the intermission and the end. */
  function titleCard(tl, loc, t, adv, pulse, reduce) {
    const out = [];
    if (loc.phase !== 6 && loc.phase !== 9) return out;
    const s = loc.section, b = sectionBeat(tl, s, t);
    let order = 0;
    for (const [word, size, y] of [['TRICK', 1.15, 5.85], ['HEART', 1.15, 4.35]]) {
      const chars = Array.from(word);
      let x = -chars.reduce((sum, ch) => sum + adv(ch) * 1.08, 0) * size / 2;
      chars.forEach((ch, k) => {
        const a = adv(ch) * 1.08 * size, cx = x + a / 2;
        x += a;
        // On the intermission curtain the letters arrive one by one; at the end they wait for the last line to leave.
        const appear = loc.phase === 6 ? 4 + order * .5 : 4 + order * .2;
        const inU = reduce ? 1 : clamp((b - appear) / 1);
        order++;
        if (inU <= 0) return;
        let py = y, rz = 0, scale = 1;
        if (!reduce) {
          const k2 = 1 - easeOut(inU);
          py += k2 * 2.5 + Math.sin(t * 1.6 + order) * .05 + .06 * pulse * (order % 2 ? 1 : -1);
          rz += k2 * (k % 2 ? .5 : -.5);
          scale *= Math.max(.05, easeOutBack(inU));
        }
        const pivot = PIVOT * size;
        out.push({ ch, m: chain(T(cx, py + pivot, CURTAIN_Z + .9), RZ(rz), S(scale), T(0, -pivot, 0)), size, role: 'title',
          alpha: ease(inU), sung: true, singing: false, age: 9, order, line: -1 });
      });
    }
    return out;
  }

  /** Every pure per-frame decision, without touching WebGL (used by the renderer and the tests). */
  function frameAt(input, cache = {}) {
    const aspect = clamp((input.width || 16) / (input.height || 9), .3, 4);
    const adv = typeof input.metrics === 'function' ? input.metrics : approxAdvance;
    const lines = input.lyrics?.lines || null;
    const key = [input.duration, input.bpm, input.beatOffset, !!input.reducedMotion, Math.round(aspect * 20), input.metricsEpoch || 0,
      input.lyrics?.offset, input.lyrics?.language, (input.sections || []).map(s => s.start + ':' + s.end + ':' + s.phase).join(',')].join('|');
    if (cache.key !== key || cache.lines !== lines) {
      const tl = timeline(input);
      const model = lyricModel(input.lyrics, tl);
      const maxW = mix(5.4, 9.6, clamp((aspect - .6) / 1.15));
      const layouts = model.map(line => layoutLine(line, adv, maxW));
      const shots = planShots(tl, model);
      for (const shot of shots) if (LYRIC_KINDS.has(shot.kind)) shot.frame = frameFor(shot, model, layouts, tl);
      Object.assign(cache, { key, lines, tl, model, layouts, shots });
    }
    const { tl, model, layouts, shots } = cache;
    const t = clamp(Number.isFinite(input.time) ? input.time : 0, 0, tl.duration);
    const loc = locate(tl, t), env = envAt(tl, t, loc, model), reduce = tl.reduce;
    const shot = shotAt(shots, t);
    const u = clamp((t - shot.start) / Math.max(.001, shot.end - shot.start));
    const lyricShot = LYRIC_KINDS.has(shot.kind);
    const cam = lyricShot ? lyricCamera(shot, u, aspect) : stageCamera(shot, u, { phase: loc.phase });
    if (!lyricShot && aspect < 1.25) {
      const k = mix(1.8, 1, clamp((aspect - .55) / .7));
      cam.eye = add(cam.target, v3.scale(v3.sub(cam.eye, cam.target), k));
    }
    const beatPos = (t - tl.offset) / tl.period, pulse = reduce || t >= tl.duration ? 0 : Math.pow(1 - fract(beatPos), 4);
    const energy = clamp(.35 + (loc.section.intensity ?? .6) * .6);
    if (!reduce) {
      const shake = ((env.lift ? .035 : .008) * pulse * (.5 + energy)) * (lyricShot ? .35 : 1);
      const n = k => noise(t * 17 + k * 31.7) * shake;
      cam.eye = add(cam.eye, [n(1), n(2), n(3)]);
      cam.target = add(cam.target, [n(4) * .5, n(5) * .5, n(6) * .5]);
      cam.fov *= 1 - .025 * pulse * env.lift;
    }
    cam.eye = settle(cam.eye);

    // Lettering: lyric lines entering, being sung and leaving; the title on the curtain.
    const text = [];
    for (const line of model) {
      if (t < line.enterAt || t > line.exitAt + 1) continue;
      const tilt = line.style.layout === 'tilt';
      const block = chain(T(...LYRIC_ANCHOR), RY((cam.textYaw || 0) + (tilt ? .22 * line.style.dir : 0)), RX(tilt ? -.06 : 0));
      for (const g of layouts[line.index].glyphs) {
        const inst = glyphInstance(g, line, block, t, reduce, pulse);
        if (inst) text.push(inst);
      }
    }
    text.push(...titleCard(tl, loc, t, adv, pulse, reduce));

    const since = t - loc.section.start;
    let flash = 0, flashColor = [1, 1, 1], speed = cam.speed || 0, aberration = 0;
    if (!reduce) {
      if (loc.section.chorus && since < .45) { flash = .55 * Math.pow(1 - since / .45, 2); flashColor = CREAM; speed = Math.max(speed, 1 - since / .45); }
      if (env.ace > 0 && env.ace < 1) flash = Math.max(flash, .25 * Math.sin(Math.PI * env.ace));
      aberration = .003 * pulse * env.lift + speed * .005;
    } else speed = 0;
    const fadeIn = 1 - ease(t / 1.8);
    if (fadeIn > flash) { flash = fadeIn; flashColor = [0, 0, 0]; }
    const tail = ease((t - (tl.duration - 1.8)) / 1.6);
    const post = {
      bloom: .4 + env.lift * .2, threshold: .84, speedLines: speed, flash, flashColor, invert: 0, aberration,
      letterbox: .045, vignette: .32, grain: .03, saturation: 1.1, exposure: 1 - .75 * tail, time: t, static: 0, scanlines: 0,
    };
    return { t, tl, loc, env, look: env.look, shot, u, cam, beatPos, pulse, energy, post, reduce, text, model, layouts };
  }

  // MARK: shapes

  function heartShape(n = 40) {
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = -k / n * TAU;
      const x = 16 * Math.pow(Math.sin(a), 3);
      const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      pts.push([x / 17, y / 17]);
    }
    return pts;
  }

  function roundedRect(w, h, rx, ry, steps = 6) {
    const pts = [];
    const corner = (cx, cy, a0) => {
      for (let k = 0; k <= steps; k++) {
        const a = a0 + k / steps * Math.PI / 2;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
    };
    corner(w / 2 - rx, h / 2 - ry, 0);
    corner(-w / 2 + rx, h / 2 - ry, Math.PI / 2);
    corner(-w / 2 + rx, -h / 2 + ry, Math.PI);
    corner(w / 2 - rx, -h / 2 + ry, Math.PI * 1.5);
    return pts;
  }

  function buildGeometry() {
    const G = {};
    G.panel = K.plane(1, 1);
    // A playing card on a unit square in the xz plane (face up); its model matrix makes it
    // CARD_RATIO times longer, so the corners are drawn pre-squashed to come out round.
    G.card = K.merge([{ g: K.extrude(roundedRect(1, 1, .09, .09 / CARD_RATIO), .016), m: RX(-Math.PI / 2) }]);
    G.floor = K.plane(60, 44);
    G.drape = K.drape(36, 17, 30, .38, 180, 4);
    G.valance = K.drape(36, 2.4, 34, .22, 160, 2);
    G.backWall = K.box(40, 18, .6);
    // The card table: a velvet top with a gold rim on a turned pedestal.
    G.tableTop = K.cylinder(TABLE_R, TABLE_R, .08, 64);
    G.tableRim = K.torus(TABLE_R, .055, 72, 10);
    G.tableLeg = K.lathe([[0, TABLE_TOP - .04], [.16, TABLE_TOP - .04], [.12, .7], [.09, .45], [.14, .3], [.5, .06], [.55, 0], [0, 0]], 28);
    // The magician's top hat and wand.
    G.hat = K.lathe([[0, .62], [.26, .62], [.29, .6], [.3, .55], [.27, .2], [.26, .06], [.28, 0], [0, -.002]], 32);
    G.brim = K.lathe([[0, .03], [.32, .03], [.44, .045], [.5, .08], [.52, .07], [.47, .02], [.34, -.01], [0, -.01]], 40);
    G.band = K.lathe([[0, .2], [.275, .2], [.28, .19], [.268, .1], [0, .1]], 32);
    G.wand = K.cylinder(.025, .025, .9, 12);
    G.wandTip = K.cylinder(.028, .028, .14, 12);
    G.heart = K.extrude(heartShape(), .3);
    // Bulbs round the marquee title and along the garlands over the stage.
    G.garlands = [];
    for (const z of [-5.5, -1.5, 2.5]) for (let k = 0; k <= 30; k++) {
      const x = -13 + k * 26 / 30;
      G.garlands.push([x, 8.6 - 1.3 * (1 - Math.pow(x / 13, 2)) + (z + 5.5) * .1, z]);
    }
    G.marquee = [];
    for (let k = 0; k < 40; k++) {
      const a = k / 40 * TAU;
      G.marquee.push([Math.cos(a) * 5.6, 5.1 + Math.sin(a) * 2.3, CURTAIN_Z + .7]);
    }
    return G;
  }

  // MARK: rendering

  const TEXT_STYLE = {
    main: { layers: 10, depth: .34 }, romaji: { layers: 3, depth: .09 }, trans: { layers: 3, depth: .09 },
    title: { layers: 10, depth: .32 },
  };
  const TEXT_INK = [.07, .015, .05];
  function textColors(inst, look) {
    switch (inst.role) {
      case 'title': return { top: [1, .93, .72], bottom: GOLD, near: scalec(look.primary, .55), far: scalec(look.primary, .2) };
      case 'romaji': return inst.sung
        ? { top: mixc(look.secondary, [1, 1, 1], .45), bottom: look.secondary, near: TEXT_INK, far: TEXT_INK }
        : { top: [.88, .86, .94], bottom: [.76, .74, .86], near: TEXT_INK, far: TEXT_INK };
      case 'trans': return { top: [.97, .93, .86], bottom: [.86, .8, .82], near: TEXT_INK, far: TEXT_INK };
      default: {
        const near = scalec(look.primary, .78), far = scalec(look.primary, .26);
        if (inst.singing) return { top: [1, 1, 1], bottom: mixc(GOLD, [1, 1, 1], .4), near, far };
        if (inst.sung) return { top: mixc(GOLD, [1, 1, 1], .35), bottom: look.primary, near, far };
        return { top: CREAM, bottom: [.82, .76, .86], near, far };
      }
    }
  }

  /** Creates the music video on a canvas; returns null when WebGL2 is unavailable. */
  function create(canvas, options = {}) {
    const r = options.renderer || K.createRenderer(canvas, { font: LYRIC_FONT });
    if (!r) return null;
    const G = buildGeometry();
    const B = { glow: batch(900), disc: batch(500), sparkle: batch(700), confetti: batch(1200), burst: batch(900) };
    const cache = {};
    const lettering = L.createLettering(r, TEXT_STYLE);
    const metrics = ch => r.glyph(ch).advance;
    const doc = typeof document === 'object' ? document : null;
    if (doc?.fonts?.load) {
      Promise.all([doc.fonts.load('800 84px "Atkinson Hyperlegible Next"'), doc.fonts.ready])
        .then(() => r.resetGlyphs()).catch(() => {});
    }

    function draw(input) {
      if (r.lost()) return null;
      const width = Math.max(1, input.width | 0), height = Math.max(1, input.height | 0);
      const f = frameAt({ ...input, metrics, metricsEpoch: r.glyphEpoch }, cache);
      const { t, tl, loc, env, look, cam, beatPos, pulse, reduce } = f;
      const ph = loc.phase, lift = env.lift, motionT = reduce ? t * .2 : t;
      const sky = look.sky;
      if (!r.begin(width, height, sky[2])) return null;
      r.camera({ eye: cam.eye, target: cam.target, roll: cam.roll, fov: cam.fov, up: cam.up });

      // Light: a follow spot on the table and four moving heads that sweep in the choruses.
      const centre = [0, TABLE_TOP + .6, 0];
      const followApex = [0, 11, 9], followDir = v3.norm(v3.sub(centre, followApex)), followDist = v3.dist(centre, followApex);
      const heads = [];
      for (let k = 0; k < 4; k++) {
        const apex = [-6 + k * 4, 10.2, -2];
        let target;
        if (lift > .5 && !reduce) {
          const sweep = Math.sin(beatPos * Math.PI / 4 + k * 1.1);
          target = v3.mix([apex[0] * .4 + sweep * 5, 0, 1 + Math.cos(beatPos * .6 + k) * 3], centre, Math.pow(1 - fract(beatPos / 4), 6) * .7);
        } else target = [apex[0] * .3 + Math.sin(motionT * .3 + k * 1.4) * 3, 0, Math.sin(motionT * .25 + k) * 2.5];
        heads.push({ apex, dir: v3.norm(v3.sub(target, apex)), color: [look.primary, look.secondary, look.accent, look.primary][k], intensity: look.beams * (.45 + lift * .45) });
      }
      const spots = [{ pos: followApex, dir: followDir, color: scalec(mixc(look.key, [1, .95, .85], .5), .5), angle: Math.atan(2.4 / followDist) }];
      for (const h of heads) spots.push({ pos: h.apex, dir: h.dir, color: scalec(h.color, h.intensity * .3), angle: .1 });
      r.lights({ keyDir: v3.norm([.3, .85, .5]), keyColor: scalec(look.key, look.keyI), ambient: [look.ambient, look.ambient * .9, look.ambient * 1.1],
        fog: sky[1], fogNear: 30, fogFar: 90, spots });
      r.sky({ top: sky[0], horizon: sky[1], bottom: sky[2], stars: 0, moon: 0, time: t });

      const ink = { outline: 1.6, outlineColor: INK };
      const toon = (color, extra = {}) => ({ color, shade: mixc(color, INK, .5), rim: .35, rimColor: look.accent, ...ink, ...extra });
      /** A playing card: face up in its own xz plane. */
      const card = (m, suit, w, extra = {}) => r.draw(G.card, chain(m, S(w, 1, w * CARD_RATIO)), {
        color: [1, 1, 1], rim: .25, rimColor: look.accent, spec: .2, ...ink, outline: 1.2,
        screen: { mode: 16, lit: true, a: mixc(look.primary, INK, .25), b: look.primary, c: GOLD, ink: INK, width: 1, height: CARD_RATIO,
          params: [suit, extra.pip ?? .36, 0, 0], gain: 1, time: motionT }, ...extra.material,
      });

      // The parlour: a velvet floor and back wall, the curtain and its valance.
      r.draw(G.floor, T(0, 0, 4), { color: look.floor[0], depthWrite: true, spec: .2,
        floor: { b: look.floor[1], tile: 1.3, ringColor: look.primary, ringCenter: [0, 0, 0], ringRadius: fract(beatPos) * 10,
          ringAmount: (reduce ? .15 : .15 + lift * .6) * (1 - fract(beatPos)) } });
      r.draw(G.backWall, T(0, 9, -15.5), toon(mixc(look.curtain, INK, .55), { rim: 0 }));
      const curtainY = 16.6 + env.curtain * 14;
      if (env.curtain < .999) {
        const sway = reduce ? 0 : Math.sin(t * .8) * .03;
        r.draw(G.drape, chain(T(0, curtainY, CURTAIN_Z), RZ(sway * .02)), { color: look.curtain, shade: mixc(look.curtain, INK, .6), rim: .6, rimColor: look.accent, spec: .2 });
      }
      r.draw(G.valance, T(0, 12.2, CURTAIN_Z + .5), { color: mixc(look.curtain, [1, .2, .3], .2), shade: mixc(look.curtain, INK, .6), rim: .5, rimColor: look.accent });

      // Behind the curtain: a giant fan of cards that flips in waves through the choruses.
      if (env.curtain > .01) {
        for (let k = 0; k < FAN.n; k++) {
          const a = (k - (FAN.n - 1) / 2) * FAN.spread;
          let flip = 0;
          if (!reduce && lift > .3) {
            const wave = fract(beatPos / 8 - k * .035);
            flip = Math.PI * 2 * easeInOut(clamp(wave / .22));
          } else if (!reduce) flip = Math.sin(motionT * .5 + k * .7) * .12;
          // Each card sits a little in front of the last, as in a fanned hand.
          const m = chain(T(...FAN.pivot), T(0, 0, k * .08), RZ(-a), T(0, FAN.reach + .1 * Math.sin(motionT * .7 + k), 0), RY(flip), RX(Math.PI / 2));
          card(m, [0, 1, 2, 3][k % 4], FAN.width, { pip: .34 });
        }
      }

      // The card table, the hat and the wand.
      r.draw(G.tableLeg, K.ident(), toon(GOLD, { color: mixc(GOLD, INK, .35), spec: .6 }));
      r.draw(G.tableTop, T(0, TABLE_TOP - .04, 0), toon(look.felt, { rim: .2 }));
      r.draw(G.tableRim, T(0, TABLE_TOP, 0), toon(GOLD, { spec: .9, emit: scalec(GOLD, .06) }));
      const hatAt = env.fountain ? chain(T(0, TABLE_TOP + .62, 0), RX(Math.PI), RY(motionT * .5)) : chain(T(1.05, TABLE_TOP, -.55), RY(.5), RZ(.06));
      r.draw(G.hat, hatAt, toon([.12, .07, .12], { rim: .7, spec: .6 }));
      r.draw(G.brim, hatAt, toon([.12, .07, .12], { rim: .7, spec: .6 }));
      r.draw(G.band, hatAt, toon(look.primary));
      const tap = env.fountain && !reduce ? Math.pow(1 - fract(beatPos / 2), 6) * .35 : 0;
      const wand = chain(T(-1.0, TABLE_TOP + .05, .45), RY(-.6), RZ(Math.PI / 2 - .08 - tap), T(0, .45, 0));
      r.draw(G.wand, wand, toon([.08, .05, .08], { rim: .6, spec: .8 }));
      for (const y of [-.45, .45]) r.draw(G.wandTip, chain(wand, T(0, y, 0)), toon(CREAM));

      // The ace hovers over the table, then vanishes in a puff of sparkles.
      if (env.ace > .01) {
        const s = easeOutBack(clamp(env.ace)) * (1 + .05 * pulse);
        card(chain(T(0, TABLE_TOP + 1.05 + Math.sin(motionT * 1.3) * .06, 0), RY(motionT * .7), RX(Math.PI / 2), S(s)), 0, .62, { pip: .42 });
      }
      // Dealt cards: one lands on the table for each line of the opening.
      const opening = f.model.filter(line => line.start < (tl.byPhase.get(2)?.start ?? 20));
      opening.forEach((line, k) => {
        const land = clamp((t - line.start) / .45);
        if (land <= 0 || env.collapse > 0 || env.built > 0 || ph >= 3) return;
        const a = -1.1 + k * .44, rr = 1.05;
        const p = [Math.sin(a) * rr, TABLE_TOP + .015 + (1 - easeOut(land)) * 1.6, Math.cos(a) * rr * .7 + .1];
        card(chain(T(...p), RY(a + (1 - land) * 3)), k % 4, .36, { pip: .4 });
      });

      // The house of cards: built a card at a time, and fallen flat at the reveal.
      for (let k = 0; k < HOUSE.length; k++) {
        const appear = env.built - k;
        if (appear <= 0) continue;
        let m = houseCard(k);
        const drop = 1 - easeOutBack(clamp(appear));
        m = chain(T(0, drop * .9, 0), m);
        if (env.collapse > 0) {
          // The house falls: every card topples to lie flat, scattered across the table.
          const h1 = hash(k * 3.1), h2 = hash(k * 5.7), c = ease(env.collapse);
          const flat = chain(T((h1 - .5) * 2.2, TABLE_TOP + .016 + k * .002, (h2 - .5) * 1.6), RY(h1 * TAU), S(HOUSE_CARD, 1, HOUSE_CARD * CARD_RATIO));
          const blended = m.map((v, i) => mix(v, flat[i], c));
          blended[13] += Math.sin(Math.PI * c) * (.2 + h2 * .3);
          m = blended;
          r.draw(G.card, m, { color: [1, 1, 1], ...ink, outline: 1.2, screen: { mode: 16, lit: true, a: mixc(look.primary, INK, .25), b: look.primary, c: GOLD, ink: INK, width: 1, height: CARD_RATIO, params: [k % 4, .38, 0, 0], gain: 1 } });
        } else r.draw(G.card, m, { color: [1, 1, 1], ...ink, outline: 1.2, screen: { mode: 16, lit: true, a: mixc(look.primary, INK, .25), b: look.primary, c: GOLD, ink: INK, width: 1, height: CARD_RATIO, params: [k % 4, .38, 0, 0], gain: 1 } });
      }

      // The false bottom: cards fountain out of the upturned hat.
      if (env.fountain) {
        const s3 = tl.byPhase.get(3), since = t - (s3?.start ?? 0);
        for (let k = 0; k < 16; k++) {
          const w = fract(since / 2.6 + k / 16);
          if (since < k / 16 * 2.6) continue;
          const a = k * TAU / 16 + w * 3.2, rr = .15 + w * 2.2;
          const p = [Math.cos(a) * rr, TABLE_TOP + .7 + Math.sin(Math.PI * w) * 3.4 + w * .6, Math.sin(a) * rr];
          const s = Math.sin(Math.PI * clamp(w * 1.1));
          card(chain(T(...p), RY(-a), RX(w * 6 + k), RZ(w * 4), S(Math.max(.05, s))), k % 4, .5, { pip: .4 });
        }
      }

      // The glowing heart, circled by a tornado of cards in the final chorus.
      if (env.heart > .01) {
        const hs = .55 * easeOutBack(env.heart) * (1 + .09 * pulse);
        const hm = chain(T(0, TABLE_TOP + .9 + Math.sin(motionT * 1.2) * .08, 0), RY(motionT * .8), S(hs));
        r.draw(G.heart, hm, { color: [1, .3, .45], shade: [.7, .08, .25], emit: scalec([1, .25, .4], .55 + pulse * .3), rim: .9, rimColor: [1, .9, .95], spec: .8, ...ink });
        if (env.tornado) for (let k = 0; k < 22; k++) {
          const lane = k % 3, a = k * TAU / 22 + motionT * (1 + lane * .3), rr = 1.2 + lane * .45;
          const y = TABLE_TOP + .2 + fract(k * .37 + motionT * .1) * 3.8;
          card(chain(T(Math.cos(a) * rr, y, Math.sin(a) * rr), RY(-a + Math.PI / 2), RX(Math.PI / 2 - .3), RZ(Math.sin(motionT + k) * .4)), k % 4, .42, { pip: .4 });
        }
      }

      // Cards pouring down both sides of the frame, thick in the choruses.
      if (env.cascade > 0) {
        for (let j = 0; j < 12; j++) {
          if (hash(j * 9.1) > env.cascade + .15) continue;
          const sgn = j % 2 ? 1 : -1, period = 3.6 + hash(j * 2.3) * 1.8, w = fract(motionT / period + hash(j * 4.1));
          const p = [sgn * (7.2 + hash(j * 6.7) * 2.4) + Math.sin(w * 6 + j) * .4, 12 - w * 13.5, -4 + hash(j * 8.3) * 6];
          card(chain(T(...p), RY(w * 5 + j), RX(w * 7 + j * .5), RZ(Math.sin(w * 9 + j) * .6)), j % 4, .9, { pip: .4 });
        }
      }

      // Light: beams from the moving heads and the follow spot.
      for (const h of heads) if (h.intensity > .01) r.beam(h.apex, h.dir, 13, 1.3, h.color, h.intensity * (.2 + lift * .28));
      r.beam(followApex, followDir, followDist + 1, (followDist + 1) * Math.tan(Math.atan(2.4 / followDist)), [1, .93, .84], .07 + (ph === 7 ? .05 : 0));

      // Points: garlands of bulbs, the marquee, card confetti, sparkles.
      for (const batchOf of Object.values(B)) batchOf.reset();
      G.garlands.forEach((p, k) => {
        const chase = reduce ? .6 : ((k + Math.floor(beatPos * 2)) % 4 === 0 ? 1 : .35);
        B.glow.push(p, mixc(look.accent, [1, .8, .5], .5), .55 * chase, .55);
        B.disc.push(p, [1, .95, .82], chase, .1);
      });
      if (env.curtain < .99) G.marquee.forEach((p, k) => {
        const chase = reduce ? .7 : ((k + Math.floor(beatPos * 2)) % 3 === 0 ? 1 : .4);
        B.glow.push(p, GOLD, .6 * chase * (1 - env.curtain), .6);
        B.disc.push(p, [1, .96, .86], chase * (1 - env.curtain), .13);
      });
      if (env.cascade > 0 && !reduce) for (let k = 0; k < 360; k++) {
        const sgn = k % 2 ? 1 : -1, h1 = hash(k * 1.7), h2 = hash(k * 3.1), h3 = hash(k * 5.3);
        if (h3 > env.cascade + .1) continue;
        const w = fract(motionT * (.07 + h1 * .06) + h2);
        const p = [sgn * (5.5 + h1 * 7) + Math.sin(motionT + k) * .3, 13 - w * 14, -6 + h3 * 9];
        B.confetti.push(p, k % 3 ? [1, .97, .92] : look.primary, .95 * clamp(w * 8) * clamp((1 - w) * 8), .22, w * 12 + k);
      }
      for (const s of tl.sections) {
        if (!s.chorus) continue;
        const age = t - s.start;
        if (age < 0 || age > 6 || reduce) continue;
        for (let k = 0; k < 220; k++) {
          const h1 = hash(k * 1.3 + s.start), h2 = hash(k * 2.7 + s.start), h3 = hash(k * 4.1 + s.start);
          const sgn = k % 2 ? 1 : -1, e = (1 - Math.exp(-1.7 * age)) / 1.7;
          const p = [sgn * 6 - sgn * (2 + h1 * 6) * e, Math.max(.03, .6 + (8 + h2 * 6) * e - 1.1 * Math.max(0, age - .4)), -2 + (h3 - .5) * 6 * e];
          B.confetti.push(p, [look.primary, GOLD, CREAM, look.secondary][k % 4], .95 * (1 - clamp(age - 5)), .2, age * (3 + h2 * 6) + k);
        }
      }
      if (env.heart > .01) for (let k = 0; k < 40; k++) {
        const a = k * TAU / 40 + motionT * .6, rr = .9 + .25 * Math.sin(motionT * 2 + k);
        B.sparkle.push([Math.cos(a) * rr, TABLE_TOP + .9 + Math.sin(a * 3 + motionT) * .5, Math.sin(a) * rr], k % 2 ? GOLD : [1, .7, .8], env.heart * .8, .18, a);
      }
      if (env.ace < 1 && ph === 0 && t > env.vanishAt && t < env.vanishAt + 1.2 && !reduce) {
        const age = t - env.vanishAt;
        for (let k = 0; k < 60; k++) {
          const d = v3.norm([hash(k) - .5, hash(k + 9) - .3, hash(k + 17) - .5]);
          B.burst.push(add([0, TABLE_TOP + 1.05, 0], v3.scale(d, age * 2.2)), k % 2 ? GOLD : [1, .6, .75], 1 - age / 1.2, .2, k);
        }
      }
      r.points(B.glow.data, B.glow.count, 'glow', true);
      r.points(B.disc.data, B.disc.count, 'disc', true);
      r.points(B.confetti.data, B.confetti.count, 'confetti', false);
      r.points(B.sparkle.data, B.sparkle.count, 'sparkle', true);
      r.points(B.burst.data, B.burst.count, 'sparkle', true);

      // The lyrics, in front of everything, then sparks thrown off each sung character.
      lettering(f.text, cam.eye, inst => textColors(inst, look));
      B.burst.reset();
      if (!reduce) for (const inst of f.text) {
        if (inst.role !== 'main' || inst.age < 0 || inst.age > .45) continue;
        const centreOf = apply(inst.m, [0, PIVOT * inst.size, 0]), fade = (1 - inst.age / .45) * inst.alpha;
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * TAU + inst.order;
          const dir = v3.norm(K.applyDir(inst.m, [Math.cos(a), Math.sin(a), .3]));
          B.burst.push(add(centreOf, v3.scale(dir, (.35 + inst.age * 2.4) * inst.size)), k % 2 ? GOLD : look.secondary, fade, .13 * inst.size / .8, a);
        }
      }
      r.points(B.burst.data, B.burst.count, 'sparkle', true);
      const focus = r.project(LYRIC_KINDS.has(f.shot.kind) ? LYRIC_ANCHOR : centre);
      r.end({ ...f.post, focus: focus ? [focus[0], focus[1]] : [.5, .5] });
      const byte = c => c.map(v => Math.round(clamp(v) * 255));
      return { phase: ph, shot: f.shot.kind, lift, pulse, letters: f.text.length,
        palette: { primary: byte(look.primary), secondary: byte(look.secondary), accent: byte(look.accent) } };
    }

    return Object.freeze({ draw, dispose: () => r.dispose(), lost: () => r.lost() });
  }

  return Object.freeze({ create, frameAt, timeline, planShots, lyricCamera, stageCamera, envAt, linesFromPhrases, buildGeometry,
    LYRIC_ANCHOR, LOOKS, HOUSE, LYRIC_PLANS, STAGE_PLANS });
});
