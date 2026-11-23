// Encore Dance: "Curtain Call", VP's 3D anime music video for the Encore Dance
// recordings by MIMI, Moonlit Star and Evil.
// The lyrics are the star: every line is extruded 3D lettering that flies into the
// air above the stage, and each character pops and lights up as it is sung, with
// romaji above and the English translation below. Behind them an anime idol in a
// top hat and pleated dress performs in a grand theatre that changes with the song:
// the back wall drops on a sleeping city for the first verse, the roof opens on a
// full moon for the second, the dance break turns red with lasers and a ring of
// ENCORE letters, and the final chorus fires off fireworks before the curtain falls.
// LED screens, towers, footlights, streamers and drifting lights fill the frame to
// its edges. Every cut has a reason (a new section, a new line, the next figure of
// the dance) and lands on the beat; inside a shot the camera makes one slow,
// motivated move, always framing the whole lyric line. Every frame is a pure
// function of media time and the recording's measured sections, beat, loudness and
// lyric timing, so pause, seek and replay show the same frame.
((root, factory) => {
  const kit = root.Mv3d || (typeof require === 'function' ? require('./mv3d.js') : null);
  const lyrics = root.MvLyrics3d || (typeof require === 'function' ? require('./mv-lyrics3d.js') : null);
  const api = factory(kit, lyrics);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EncoreDanceMv = api;
})(typeof window === 'object' ? window : globalThis, (K, L) => {
  'use strict';

  const { TAU, v3, chain, T, S, RX, RY, RZ, apply, origin } = K;
  const { PIVOT, LYRIC_FONT, TEXT_INK, approxAdvance, charTimings, lyricModel, layoutLine, placeGlyph, glyphInstance, batch } = L;
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
  const INK = [.075, .02, .06];
  const MOON_DIR = v3.norm([-.2, .34, -1]);
  // Sections with singing; there the dancer performs upstage, behind the lyrics.
  const VOCAL_PHASES = new Set([1, 2, 4, 5, 7, 8, 9]);
  const DANCER_BACK = -.9;

  // MARK: looks, one per song section (phase numbers come from the lyric data)

  const LOOK_SOURCE = {
    0: { name: 'velvet', sky: [0x0c0612, 0x1d0c22, 0x070309], fog: 0x12060f, open: false,
      key: 0xffd6c4, keyI: .42, ambient: .2, keyDir: [.35, .8, .6], primary: 0xff3d64, secondary: 0x63e6d6, accent: 0xffd5a6,
      rim: 0xff8fae, pen: 0xff4f7b, floor: [0x4a1428, 0x240b19], ring: 0xff3d64, beams: .45, house: .7 },
    1: { name: 'city', sky: [0x060a1c, 0x111a3a, 0x04050c], fog: 0x0c1433, open: false,
      key: 0xa9c0ff, keyI: .6, ambient: .24, keyDir: [-.4, .7, .55], primary: 0x4dd8ff, secondary: 0xff4fa0, accent: 0xfff0c8,
      rim: 0x7feaff, pen: 0x4dd8ff, floor: [0x1a2550, 0x0d1330], ring: 0x4dd8ff, beams: .55, house: .75 },
    2: { name: 'encore', sky: [0x16040f, 0x34081f, 0x08020a], fog: 0x1c0714, open: false,
      key: 0xffe4d2, keyI: .85, ambient: .26, keyDir: [.3, .85, .55], primary: 0xff2f5e, secondary: 0x5df0de, accent: 0xffe2a8,
      rim: 0x8ff7ff, pen: 0xff2f5e, floor: [0x5c1030, 0x220a1e], ring: 0xff3d6e, beams: 1, house: 1 },
    3: { name: 'moon', sky: [0x070b24, 0x24346a, 0x05060f], fog: 0x121c46, open: true,
      key: 0xc9d8ff, keyI: .75, ambient: .26, keyDir: MOON_DIR, primary: 0x9fc4ff, secondary: 0xff8fb8, accent: 0xf4f0ff,
      rim: 0xcfe6ff, pen: 0x9fc4ff, floor: [0x1d2652, 0x0c1132], ring: 0x9fc4ff, beams: .15, house: .25 },
    4: { name: 'lonely', sky: [0x050820, 0x1c2b5e, 0x04050d], fog: 0x0f1840, open: true,
      key: 0xbfd2ff, keyI: .7, ambient: .22, keyDir: MOON_DIR, primary: 0x8fb6ff, secondary: 0xff9cc4, accent: 0xeef2ff,
      rim: 0xd6ecff, pen: 0x8fb6ff, floor: [0x182250, 0x0a0f2c], ring: 0x8fb6ff, beams: .1, house: .12 },
    5: { name: 'love', sky: [0x1c0517, 0x45102f, 0x0a0208], fog: 0x260a1d, open: false,
      key: 0xffe0ee, keyI: .85, ambient: .28, keyDir: [-.3, .85, .55], primary: 0xff4f9a, secondary: 0xffb3d6, accent: 0xfff0f6,
      rim: 0xffa8d6, pen: 0xff6fb0, floor: [0x6a1440, 0x2c0a22], ring: 0xff4f9a, beams: 1, house: 1 },
    6: { name: 'redline', sky: [0x0c0102, 0x220306, 0x050000], fog: 0x140204, open: false,
      key: 0xffd0c8, keyI: .5, ambient: .16, keyDir: [.4, .8, .45], primary: 0xff1e2e, secondary: 0xff7a1a, accent: 0xffffff,
      rim: 0xff3a3a, pen: 0xff1e2e, floor: [0x360508, 0x0c0204], ring: 0xff2a1a, beams: 1, house: .85 },
    7: { name: 'fireworks', sky: [0x0d0c30, 0x46205a, 0x0a0514], fog: 0x1e1236, open: true,
      key: 0xffe6cc, keyI: .9, ambient: .3, keyDir: [.3, .85, .55], primary: 0xff3d6e, secondary: 0x5df0de, accent: 0xffd27a,
      rim: 0xffd9a0, pen: 0xffd27a, floor: [0x5c1434, 0x22102a], ring: 0xffd27a, beams: 1, house: 1 },
    8: { name: 'amends', sky: [0x0a1030, 0x30306a, 0x060714], fog: 0x161a40, open: true,
      key: 0xd8e2ff, keyI: .8, ambient: .28, keyDir: MOON_DIR, primary: 0x5df0de, secondary: 0xff5f8e, accent: 0xf4f0ff,
      rim: 0xbff6ff, pen: 0x5df0de, floor: [0x1e2a58, 0x0e1232], ring: 0x5df0de, beams: .9, house: 1 },
    9: { name: 'final', sky: [0x120c34, 0x5a2252, 0x0b0516], fog: 0x24123a, open: true,
      key: 0xffe8d4, keyI: .95, ambient: .3, keyDir: [.3, .85, .55], primary: 0xff2f5e, secondary: 0x5df0de, accent: 0xffd27a,
      rim: 0xfff0c8, pen: 0xff2f5e, floor: [0x681234, 0x24102a], ring: 0xff2f5e, beams: 1, house: 1 },
    10: { name: 'dawn', sky: [0x2c3a7c, 0xff9e8a, 0x2a1028], fog: 0x4a3050, open: true,
      key: 0xffd2b8, keyI: .9, ambient: .3, keyDir: [-.5, .45, -.7], primary: 0xff7a8a, secondary: 0x7fd8e8, accent: 0xffe6c8,
      rim: 0xffc8a0, pen: 0xffb0a0, floor: [0x5a2038, 0x2a1428], ring: 0xffb0a0, beams: .35, house: .6 },
  };
  const LOOKS = {};
  for (const [phase, s] of Object.entries(LOOK_SOURCE)) {
    LOOKS[phase] = Object.freeze({
      ...s, sky: s.sky.map(rgb), fog: rgb(s.fog), key: rgb(s.key), primary: rgb(s.primary), secondary: rgb(s.secondary),
      accent: rgb(s.accent), rim: rgb(s.rim), pen: rgb(s.pen), floor: s.floor.map(rgb), ring: rgb(s.ring),
      keyDir: v3.norm(s.keyDir),
    });
  }
  const lookFor = phase => LOOKS[phase] || LOOKS[2];
  // LED content for each section: [back wall, towers, brightness]. Patterns: 1 chevrons,
  // 2 level meters, 3 hearts, 4 twinkling stars, 5 rings, 6 red-line stripes, 7 falling lights.
  const LED_LOOK = { 0: [5, 4, .5], 1: [7, 7, .85], 2: [1, 2, .95], 3: [4, 4, .7], 4: [4, 4, .7], 5: [3, 3, .9], 6: [6, 6, 1],
    7: [5, 2, .95], 8: [4, 5, .75], 9: [1, 1, 1], 10: [4, 4, .5] };
  // The LED towers either side of the stage.
  const TOWERS = [-1, 1].map(sgn => ({ sgn, x: sgn * 8.5, z: -2.4, yaw: -sgn * .42, w: 2.7, h: 9.6 }));

  // MARK: timeline

  function timeline(input) {
    const sections = (input.sections || [])
      .filter(s => s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      .map(s => ({ ...s, phase: Number.isFinite(s.phase) ? s.phase : 2 }));
    const duration = input.duration > 0 ? input.duration : (sections.at(-1)?.end || 137.23);
    if (!sections.length) sections.push({ start: 0, end: duration, phase: 2, chorus: true });
    const period = 60 / clamp(input.bpm || 132, 40, 260);
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

  /** How strongly a chorus lifts the room: sustained across adjacent chorus sections. */
  function liftAt(tl, t) {
    let lift = 0;
    for (const s of tl.sections) {
      if (!s.chorus) continue;
      lift = Math.max(lift, ease((t - s.start + .2) / .4) * (1 - ease((t - s.end + .2) / .6)));
    }
    return lift;
  }

  // MARK: choreography

  const REST = { lean: 0, side: 0, twist: 0, nod: 0, turn: 0, aLr: .2, aLf: .06, aLe: .28, aLt: 0, aRr: .2, aRf: .06, aRe: .28, aRt: 0,
    lLf: 0, lLa: .05, lLk: .06, lRf: 0, lRa: .05, lRk: .06 };
  const POSE_KEYS = Object.keys(REST);
  const pose = o => Object.freeze({ ...REST, ...o });
  const mirrorPose = p => Object.freeze({ ...p, side: -p.side, twist: -p.twist, turn: -p.turn,
    aLr: p.aRr, aLf: p.aRf, aLe: p.aRe, aLt: p.aRt, aRr: p.aLr, aRf: p.aLf, aRe: p.aLe, aRt: p.aLt,
    lLf: p.lRf, lLa: p.lRa, lLk: p.lRk, lRf: p.lLf, lRa: p.lLa, lRk: p.lLk });
  // The dancer faces +z (the audience); her left is +x. Arms: r raises out to the side,
  // f swings forward, e bends the elbow, t turns the upper arm. Legs: f lifts forward,
  // a opens sideways, k bends the knee.
  const BASE_POSES = {
    idle: pose({}),
    hip: pose({ side: .1, turn: .25, nod: -.05, aLr: .62, aLf: -.4, aLe: 1.95, aLt: .5, aRr: 2.6, aRf: .2, aRe: .3, lLa: .16, lRk: .3, lRf: .12 }),
    point: pose({ lean: -.05, turn: -.12, aRr: .3, aRf: 1.9, aRe: .02, aLr: .62, aLf: -.4, aLe: 1.95, aLt: .5, lRf: .28, lRk: .12, lLk: .08 }),
    vUp: pose({ nod: -.28, aLr: 2.62, aRr: 2.62, aLe: .1, aRe: .1, aLf: .15, aRf: .15, lLa: .13, lRa: .13 }),
    heart: pose({ nod: -.12, side: .05, aLr: 2.45, aRr: 2.45, aLf: .5, aRf: .5, aLe: 1.6, aRe: 1.6, aLt: 1.57, aRt: 1.57, lLk: .2, lLf: .1 }),
    reach: pose({ lean: -.16, nod: -.42, turn: -.2, aRr: 1.35, aRf: 1.3, aRe: .05, aLr: .95, aLf: -.95, aLe: .25, lLf: -.4, lLk: .25, lRk: .06 }),
    crouch: pose({ lean: .5, nod: .25, aLr: .3, aLf: 1.25, aLe: 1.7, aRr: .3, aRf: 1.25, aRe: 1.7, lLf: 1.15, lRf: 1.15, lLk: 2.0, lRk: 2.0, lLa: .22, lRa: .22 }),
    arabesque: pose({ lean: .4, nod: -.3, aLr: 1.5, aLf: .95, aLe: .1, aRr: 1.55, aRf: -.45, aRe: .1, lRf: -1.3, lRk: .05, lLk: .06 }),
    retire: pose({ nod: -.06, aLr: 2.55, aRr: 2.55, aLf: .4, aRf: .4, aLe: .95, aRe: .95, aLt: 1.57, aRt: 1.57, lLf: 1.0, lLa: .8, lLk: 2.1 }),
    kick: pose({ lean: -.14, nod: .06, aLr: 1.55, aRr: 1.55, aLe: .1, aRe: .1, lRf: 1.5, lRk: .05, lLk: .1 }),
    split: pose({ lean: .06, nod: -.22, aLr: 2.45, aRr: 2.45, aLe: .1, aRe: .1, lLf: 1.2, lRf: -1.05, lLk: .05, lRk: .25 }),
    bow: pose({ lean: 1.05, nod: .35, aRr: .45, aRf: 1.2, aRe: 1.75, aLr: 1.25, aLf: -.6, aLe: .1, lLf: -.38, lLk: .28, lRf: .16 }),
    stumble: pose({ lean: .24, side: -.24, turn: .3, aLr: 1.75, aLf: .45, aLe: .5, aRr: 1.15, aRf: -.6, aRe: .75, lLf: .55, lLk: .65, lRf: -.3, lRk: .2 }),
    walk: pose({ aLf: .55, aRf: -.5, aLe: .45, aRe: .3, lLf: .45, lRf: -.34, lRk: .38, lLk: .06, nod: .04 }),
    wave: pose({ side: -.06, turn: .3, aRr: 2.35, aRf: .2, aRe: .45, aLr: .3, aLe: .4, lLk: .15 }),
  };
  const POSES = {};
  for (const [name, p] of Object.entries(BASE_POSES)) { POSES[name] = p; POSES[name + 'M'] = mirrorPose(p); }

  // One move per step: "*" spins a full turn, "^" jumps.
  const ROUTINES = {
    0: { beats: 1, seq: ['idle'] },
    1: { beats: 1, walk: true, seq: ['walk', 'walkM', 'walk', 'walkM', 'walk', 'walkM', 'stumble', 'wave'] },
    2: { beats: 1, seq: ['hip', 'hipM', 'hip', 'hipM', 'point', 'pointM', 'retire*', 'vUp'] },
    3: { beats: 2, snap: 1.1, seq: ['reach', 'retire*', 'reach', 'arabesque'] },
    4: { beats: 2, snap: 1.2, seq: ['reach', 'arabesque', 'wave', 'retire*', 'reachM', 'idle', 'arabesqueM', 'reach'] },
    5: { beats: 1, seq: ['heart', 'heart', 'hip', 'hipM', 'heart', 'retire*', 'point', 'vUp'] },
    6: { beats: 1, seq: ['crouch', 'split^', 'retire*', 'retireM*', 'kick^', 'kickM^', 'hip', 'vUp'] },
    7: { beats: 1, seq: ['vUp', 'hip', 'hipM', 'retire*', 'point', 'heart', 'kick^', 'split^'] },
    8: { beats: 1, seq: ['hip', 'hipM', 'heart', 'heart', 'wave', 'waveM', 'retire*', 'vUp'] },
    9: { beats: 1, seq: ['kick^', 'kickM^', 'kick^', 'kickM^', 'hip', 'hipM', 'retire*', 'vUp'] },
    10: { beats: 4, snap: 2.2, seq: ['vUp', 'bow', 'bow', 'bow', 'bow', 'bow', 'bow', 'bow'] },
  };
  const moveCache = new Map();
  function parseMove(name) {
    let m = moveCache.get(name);
    if (!m) {
      const base = name.replace(/[*^]/g, '');
      m = { pose: POSES[base] || POSES.idle, spin: name.includes('*'), jump: name.includes('^') ? (base.startsWith('split') ? .42 : .16) : 0 };
      moveCache.set(name, m);
    }
    return m;
  }
  function blendPose(a, b, w) {
    const out = {};
    for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * w;
    return out;
  }
  // Follow-through: the legs and body hit each pose first, the arms, head and forearms
  // arrive a moment later (in beats), so moves flow instead of snapping as one block.
  const LAG = { lean: 0, side: 0, twist: 0, nod: .07, turn: .07, lLf: 0, lLa: 0, lLk: 0, lRf: 0, lRa: 0, lRk: 0,
    aLr: .04, aLf: .04, aLt: .05, aRr: .04, aRf: .04, aRt: .05, aLe: .09, aRe: .09 };

  /** The dancer's pose and place at time t: joint angles, stage position, turn and jump. */
  function danceAt(tl, t) {
    const loc = locate(tl, t), phase = loc.phase, s = loc.section;
    const beatPos = (t - tl.offset) / tl.period;
    const routine = ROUTINES[phase] || ROUTINES[2];
    const startBeat = Math.round((s.start - tl.offset) / tl.period);
    const stepF = Math.max(0, (beatPos - startBeat) / routine.beats);
    const step = Math.floor(stepF), frac = stepF - step, seq = routine.seq;
    const cur = parseMove(seq[step % seq.length]), prev = parseMove(seq[(step + seq.length - 1) % seq.length]);
    const snap = routine.snap ?? .3, into = frac * routine.beats;
    const w = easeOutBack(into / snap);
    let p = {};
    for (const k of POSE_KEYS) {
      const wk = easeOutBack((into - LAG[k] * (snap / .3)) / snap);
      p[k] = prev.pose[k] + (cur.pose[k] - prev.pose[k]) * wk;
    }
    const facing = k => phase === 1 ? 0 : [0, .5, -.5, .25, -.25, 0, .75, -.75][Math.floor(hash(k * 3.1 + phase * 1.7) * 8)] * (routine.beats > 1 ? .5 : 1);
    let yaw = mix(facing(step - 1), facing(step), clamp(w));
    let jump = 0, flare = 1, x = 0, z = VOCAL_PHASES.has(phase) ? DANCER_BACK : .6;
    if (cur.spin) {
      const spin = clamp(frac / .85);
      yaw += TAU * easeInOut(spin) * (step % 2 ? -1 : 1);
      flare += Math.sin(Math.PI * spin) * .6;
    }
    if (cur.jump) {
      const j = clamp(frac / .7);
      jump = Math.sin(Math.PI * j) * cur.jump;
      flare += Math.sin(Math.PI * j) * .35;
    }
    if (phase === 0) {
      const rise = ease((t - (s.end - 3)) / 2.2);
      p = blendPose(POSES.crouch, POSES.vUp, rise);
      yaw = 0;
    }
    if (routine.walk) {
      const u = loc.local / Math.max(1, s.end - s.start);
      const px = a => 2.4 * Math.sin(a * Math.PI * 1.6 - .9), pz = a => DANCER_BACK - .3 + .7 * Math.cos(a * Math.PI * 1.2);
      x = px(u); z = pz(u);
      yaw = Math.atan2(px(u + .01) - px(u - .01), pz(u + .01) - pz(u - .01));
    }
    // Groove: knees dip on every beat and the hips sway every two.
    const groove = phase === 0 || phase === 10 ? .3 : s.chorus ? 1 : .6;
    const dip = Math.pow(1 - fract(beatPos), 3) * groove;
    p.lLk += dip * .32; p.lRk += dip * .32; p.lLf += dip * .16; p.lRf += dip * .16;
    p.side += Math.sin(beatPos * Math.PI) * .045 * groove;
    p.nod += Math.sin(beatPos * TAU) * .03 * groove;
    flare += dip * .12;
    return { pose: p, x, z, yaw, jump, flare, phase, beatPos, loc };
  }

  /** Forward kinematics: world matrices for every joint, feet resting on the floor. */
  function skeleton(d) {
    const P = d.pose;
    const build = y => {
      const pelvis = chain(T(d.x, y, d.z), RY(d.yaw));
      const chest = chain(pelvis, RX(P.lean), RZ(P.side), RY(P.twist));
      const head = chain(chest, T(0, .635, 0), RY(P.turn), RX(P.nod));
      const arm = (sgn, r, f, e, tw) => {
        const sh = chain(chest, T(sgn * .17, .45, 0), RZ(sgn * r), RX(-f), RY(sgn * tw));
        const el = chain(sh, T(0, -.27, 0), RX(-e));
        return { sh, el, hand: chain(el, T(0, -.26, 0)) };
      };
      const leg = (sgn, f, a, k) => {
        const hip = chain(pelvis, T(sgn * .095, -.05, 0), RZ(sgn * a), RX(-f));
        const knee = chain(hip, T(0, -.44, 0), RX(k));
        return { hip, knee, ankle: chain(knee, T(0, -.43, 0)), lift: Math.max(0, f) + k * .3 };
      };
      return { pelvis, chest, head, armL: arm(1, P.aLr, P.aLf, P.aLe, P.aLt), armR: arm(-1, P.aRr, P.aRf, P.aRe, P.aRt),
        legL: leg(1, P.lLf, P.lLa, P.lLk), legR: leg(-1, P.lRf, P.lRa, P.lRk) };
    };
    const probe = build(0);
    const sk = build(.075 - Math.min(probe.legL.ankle[13], probe.legR.ankle[13]) + d.jump);
    sk.flare = d.flare;
    return sk;
  }

  function bodyParts(sk) {
    const feet = v3.scale(v3.add(origin(sk.legL.ankle), origin(sk.legR.ankle)), .5);
    return {
      chest: apply(sk.chest, [0, .32, 0]), head: apply(sk.head, [0, .12, 0]), hips: origin(sk.pelvis),
      handR: origin(sk.armR.hand), handL: origin(sk.armL.hand), feet, skirt: apply(sk.pelvis, [0, -.22, 0]),
    };
  }

  // MARK: lyrics as 3D lettering

  // Lyrics hang in the air above the stage, in front of the dancer, and each line
  // gets its own layout and entrance. Every character pops as it is sung.
  const LYRIC_ANCHOR = [0, 3.25, 2.3];

  function lyricBlock(line, textYaw) {
    const tilt = line.style.layout === 'tilt';
    return chain(T(...LYRIC_ANCHOR), RY(textYaw + (tilt ? .22 * line.style.dir : 0)), RX(tilt ? -.06 : 0));
  }

  /** The 3D title card over the closed curtain, and the ENCORE ring of the dance break. */
  function titleAndRing(tl, t, reduce, adv, pulse, dancer, eye) {
    const out = [];
    const s0 = tl.byPhase.get(0);
    if (s0 && t < s0.end) {
      const exitAt = s0.end - 3.9, firstBeat = tl.offset + Math.ceil((s0.start + .6 - tl.offset) / tl.period) * tl.period;
      let order = 0;
      for (const [word, size, row] of [['ENCORE', 1.3, .55], ['DANCE', .86, -.78]]) {
        const chars = Array.from(word);
        let x = -chars.reduce((sum, c) => sum + adv(c) * 1.08, 0) * size / 2;
        chars.forEach((ch, k) => {
          const a = adv(ch) * 1.08 * size, appear = firstBeat + order * tl.period;
          const inU = clamp((t - appear) / .4), outU = clamp((t - exitAt - order * .04) / .55);
          order++;
          if (inU > 0 && outU < 1) {
            let px = x + a / 2, py = row, pz = 0, rx = 0, rz = 0, scale = 1;
            if (!reduce) {
              const k2 = 1 - easeOut(inU), o = easeIn(outU);
              py += k2 * 3 + Math.sin(t * 1.8 + order) * .05;
              rz += k2 * (k % 2 ? .5 : -.5);
              scale *= Math.max(.05, easeOutBack(inU)) * (1 + .04 * pulse);
              pz += o * 6; px *= 1 + o * .8; rx -= o * .8;
            }
            const pivot = PIVOT * size;
            out.push({ ch, m: chain(T(0, 5.6, 5.3), T(px, py + pivot, pz), RX(rx), RZ(rz), S(scale), T(0, -pivot, 0)), size,
              role: 'title', alpha: ease(inU) * (1 - outU), sung: true, singing: false, age: t - appear, order, line: -1 });
          }
          x += a;
        });
      }
    }
    const s6 = tl.byPhase.get(6);
    if (s6 && t > s6.start - .2 && t < s6.end + .2) {
      const chars = Array.from('ENCORE · ENCORE · ENCORE · ');
      const fade = ease((t - s6.start) / .4) * (1 - ease((t - s6.end + .3) / .4));
      // A crown of letters circling above the dancer's head, clear of her body.
      const spin = reduce ? t * .15 : t * .85, size = .5, radius = 2.7, pivot = PIVOT * size;
      chars.forEach((ch, k) => {
        if (/\s/.test(ch)) return;
        const a = k * TAU / chars.length - spin;
        const y = 2.75 + (reduce ? 0 : Math.sin(a * 2 + t * 3) * .14);
        const p = [dancer[0] + Math.sin(a) * radius, y + pivot, dancer[2] + Math.cos(a) * radius];
        // Letters on the far side of the ring would read backwards, so they fade out.
        const facing = eye ? v3.dot([Math.sin(a), 0, Math.cos(a)], v3.norm(v3.sub(eye, p))) : 1;
        out.push({ ch, m: chain(T(...p), RY(a), S(1 + (reduce ? 0 : .15 * pulse)), T(0, -pivot, 0)),
          size, role: 'ring', alpha: fade * clamp((facing + .1) / .4), sung: true, singing: false, age: 9, order: k, line: -2 });
      });
    }
    return out;
  }

  // MARK: camera shots

  // Every cut has a reason and every move has a purpose. Cuts land on a new section, on
  // the beat just before a new lyric line is sung (so the line flies in on the new
  // angle), or, in the dance break, on each half of the routine. Inside a shot the camera
  // makes one slow move that follows the song: it settles in front of a line as it is
  // sung, glides along with the karaoke, walks with the dancer, rises toward the moon, or
  // pulls back to show the stage as a chorus ends.
  const STAGE_PLANS = {
    0: { beats: [12, 8, 99], kinds: ['establish', 'audience', 'curtain'] },
    3: { beats: [99], kinds: ['moonrise'] },
    // The dance break: a new angle for each half of the eight-count routine.
    6: { beats: [4], kinds: ['audience', 'low', 'orbit', 'crane', 'low', 'track', 'push', 'pull'] },
    10: { beats: [99], kinds: ['finale'] },
    // Without lyrics the other sections get a steady eight-beat edit around the dancer.
    default: { beats: [8], kinds: ['push', 'orbit', 'low', 'track', 'crane', 'pull'] },
  };
  // For each sung section: the move on its first line, the moves that take turns in the
  // middle, and the move on its last line.
  const LYRIC_PLANS = {
    1: { first: 'lyricReveal', middle: ['lyricFollow'], last: 'lyricFollow' },
    2: { first: 'lyricRush', middle: ['lyricLean', 'lyricRead'], last: 'lyricPull' },
    4: { first: 'lyricMoon', middle: ['lyricRise', 'lyricLean'], last: 'lyricDrift' },
    5: { first: 'lyricRush', middle: ['lyricLean', 'lyricRead'], last: 'lyricArc' },
    7: { first: 'lyricRush', middle: ['lyricLean', 'lyricRead'], last: 'lyricPull' },
    8: { first: 'lyricMoon', middle: ['lyricLean'], last: 'lyricLean' },
    9: { first: 'lyricRush', middle: ['lyricLean', 'lyricRead'], last: 'lyricPull' },
    default: { first: 'lyricLean', middle: ['lyricRead', 'lyricLean'], last: 'lyricPull' },
  };
  const LYRIC_KINDS = new Set(['lyricLean', 'lyricRead', 'lyricRush', 'lyricPull', 'lyricArc', 'lyricFollow', 'lyricReveal',
    'lyricRise', 'lyricMoon', 'lyricDrift', 'lyricCalm']);
  // A line shorter than this shares its shot with the line before it.
  const MIN_SHOT = 2.4;

  /** The edit: cuts on section starts, on the entry beat of a lyric line, or on the dance's bars. */
  function planShots(tl, model = []) {
    const shots = [];
    const onBeat = t => tl.offset + Math.round((t - tl.offset) / tl.period) * tl.period;
    tl.sections.forEach((s, si) => {
      let index = 0;
      const turns = {};
      const add = (start, end, kind) => {
        const k = index++, n = turns[kind] = (turns[kind] ?? -1) + 1;
        // Repeated moves alternate sides, like shot and reverse shot.
        shots.push({ start, end, kind, side: n % 2 ? 1 : -1, phase: s.phase, section: si, index: k,
          seed: hash(si * 13.1 + k * 3.7 + 1), seed2: hash(si * 5.3 + k * 11.9 + 2), seed3: hash(si * 2.9 + k * 17.3 + 3) });
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
          if (intro && k === 0) { add(cut, end, 'push'); return; }
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

  /** The largest lyric block a lyric shot has to keep in frame. */
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

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const around = (F, a, d, h) => [F[0] + Math.sin(a) * d, F[1] + h, F[2] + Math.cos(a) * d];
  const rakeY = z => -1.45 + Math.max(0, z - 4.8) * .07;

  /** Camera for a lyric shot at progress u: one slow, motivated move that keeps the whole line in frame. */
  function lyricCamera(shot, u, aspect, ctx = {}) {
    const f = shot.frame || { w: 7, h: 3 }, side = shot.side || 1, e = easeInOut(u);
    const fit = fov => {
      const vf = fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
      return Math.max((f.w / 2) / Math.tan(hf / 2) / .74, (f.h / 2) / Math.tan(vf / 2) / .56, 3.5);
    };
    let fov = 38, yaw = 0, pitch = .07, k = 1.12, lateral = 0, lift = 0, speed = 0, turn = .5;
    switch (shot.kind) {
      case 'lyricLean': // starts to one side and settles in front of the line as it is sung
        yaw = side * mix(.36, .1, e); k = mix(1.18, 1.05, e); pitch = mix(.13, .06, e); break;
      case 'lyricRead': // glides along the line the way it is read, with the karaoke
        lateral = mix(-.1, .1, e) * f.w; k = mix(1.12, 1.07, e); pitch = .08; break;
      case 'lyricRush': { // the chorus hits: in from the back of the hall, then a slow push
        const r = easeOut(clamp(u / .4));
        k = mix(2.8, 1.1, r) - .05 * ease((u - .4) / .6); speed = (1 - r) * .7; pitch = mix(.18, .07, r); break;
      }
      case 'lyricPull': // the chorus ends: back and up to show the whole stage
        k = mix(1.06, 1.5, e); pitch = mix(.06, .24, e); yaw = side * .1 * e; break;
      case 'lyricArc': // a long line: the camera travels round it and the words turn to meet it
        yaw = side * mix(-1, 1, e) * Math.min(.5, (shot.end - shot.start) * .06); k = 1.14; turn = .55; break;
      case 'lyricFollow': // walks alongside the dancer through the sleeping city
        lateral = (ctx.dancerX || 0) * .42; k = mix(1.16, 1.08, e); pitch = side > 0 ? .02 : .15; break;
      case 'lyricReveal': // the back wall falls away: back and up to reveal the city behind
        k = mix(1.02, 1.22, e); pitch = mix(.02, .14, e); break;
      case 'lyricRise': // from under the line up to eye level with it
        fov = 46; pitch = mix(-.26, .02, e); yaw = side * .16; break;
      case 'lyricMoon': // just under the words, tilted up so the moon rises above them
        fov = 54; pitch = -.08; yaw = side * mix(.16, .1, e); k = mix(1.08, 1, e); lift = f.h * mix(.7, .95, e); break;
      case 'lyricDrift': // drifts away with the last line of the verse
        yaw = side * .16 * Math.sin(u * Math.PI); k = mix(1.06, 1.3, e); pitch = mix(.06, .12, e); break;
      default: k = 1.1; pitch = .05;
    }
    const dist = fit(fov) * k, c = LYRIC_ANCHOR;
    const eye = [c[0] + Math.sin(yaw) * Math.cos(pitch) * dist + lateral, c[1] + Math.sin(pitch) * dist,
      c[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
    // The words turn part of the way toward the camera, so an angled shot still reads.
    const textYaw = Math.atan2(eye[0] - c[0], eye[2] - c[2]) * turn;
    return { eye, target: [c[0] + lateral * .35, c[1] + lift, c[2]], fov, roll: 0, up: [0, 1, 0], speed, textYaw };
  }

  /** Camera for a stage shot at progress u: { eye, target, fov, roll, up, speed }. */
  function shotCamera(shot, u, parts) {
    const F = parts.chest, side = shot.side || 1, e = easeInOut(u);
    const cam = (eye, target, fov = 42, extra = {}) => ({ eye, target, fov, roll: 0, up: [0, 1, 0], speed: 0, textYaw: 0, ...extra });
    switch (shot.kind) {
      case 'establish':
        return cam([mix(-4, 2.5, e), mix(8.5, 5.2, e), mix(33, 21, e)], [0, mix(5.2, 3.8, e), 2], 46);
      case 'audience': {
        // Over the crowd's penlights; before the curtain opens it looks up at the title card.
        const x = side * mix(2.6, 3.8, e), title = shot.phase === 0;
        return cam([x, rakeY(13) + 1.55, mix(13.5, 11.8, e)], title ? [x * .2, 5.2, 5.3] : add(F, [0, .5, 0]), title ? 40 : 30);
      }
      case 'curtain': // from the title card down to the dancer as the curtain opens
        return cam([mix(.8, -.4, e), mix(3.2, 1.6, e), mix(15, 6.2, e)], [0, mix(5.1, 1.25, ease((u - .35) / .65)), mix(5, 0, e)], mix(46, 40, e));
      case 'orbit': // circles the dancer as she turns
        return cam(around(F, side * (.55 + e * .5), 4.6, .45 + e * .25), add(F, [0, -.1, 0]), 40);
      case 'push': // moves in on the dancer as the phrase builds
        return cam(around(F, side * .3, mix(7.5, 3.8, e), mix(1.1, .25, e)), F, 38);
      case 'pull': // backs away to the whole stage as the phrase ends
        return cam(around(F, side * .3, mix(3.2, 9.5, e), mix(.2, 2.8, e)), add(F, [0, mix(0, .8, e), 0]), 44);
      case 'crane': // rises over the dancer to what is above her
        return cam(around(F, side * (.35 + e * .2), mix(5.2, 4.4, e), mix(-.4, 4.6, e)), F, 48);
      case 'low': // from the floor, so jumps and kicks rise into the frame
        return cam(around([F[0], .25, F[2]], side * (.5 + e * .22), 3.3, 0), add(F, [0, .45, 0]), 56);
      case 'track': // runs alongside her, in profile for the kicks
        return cam([F[0] + side * mix(-2.4, 2.4, e), 1.1, F[2] + 4.8], add(F, [side * mix(-.5, .5, e), -.2, 0]), 36);
      case 'moonrise': {
        const eye = [F[0] + 1.6, mix(1.1, 2.4, e), F[2] + mix(4.6, 6.8, e)];
        return cam(eye, v3.mix(F, add(eye, v3.scale(MOON_DIR, 60)), e), mix(40, 56, e));
      }
      case 'finale':
        return cam([0, mix(1.5, 7.6, e), mix(4.6, 27, e)], [0, mix(1.1, 3.6, e), 0], 44);
      default: {
        const night = [3, 4, 8].includes(shot.phase), intro = shot.phase === 0 || shot.phase === 10;
        if (intro) return cam([0, 4.4, 20], [0, 3.4, 2], 46);
        if (night) return cam([0, 1.5, 9.5], [0, 3.3, -2], 50);
        return cam([3.4, 2.4, 10.5], [0, 1.4, 0], 42);
      }
    }
  }

  /** Keeps the camera above the stage floor and the raked seating. */
  function settle(eye) {
    const onStage = Math.abs(eye[0]) < 12 && eye[2] < 4.3;
    const floor = onStage ? .12 : rakeY(eye[2]) + .35;
    return [eye[0], Math.max(floor, eye[1]), eye[2]];
  }

  // MARK: per-time environment

  function envAt(tl, t, loc) {
    const sec = p => tl.byPhase.get(p);
    let curtain = 1;
    const s0 = sec(0), s10 = sec(10), s3 = sec(3), s7 = sec(7), s1 = sec(1);
    if (s0 && t < s0.end) curtain = ease((t - (s0.end - 4.2)) / 3.6);
    if (s10 && t >= s10.start) curtain = 1 - ease((t - s10.start - 1) / Math.max(1, s10.end - s10.start - 1.2));
    let roof = 0;
    const ph = loc.phase;
    if (ph === 3 && s3) roof = ease((t - s3.start - .5) / Math.max(1, s3.end - s3.start - 1.8));
    else if (ph === 4 || ph >= 8) roof = 1;
    else if (ph === 7 && s7) roof = ease((t - s7.start) / (tl.period * 8));
    // The back wall also drops for the first verse to show the sleeping city outside.
    const wall = Math.max(roof, ph === 1 && s1 ? ease((t - s1.start) / 1.6) : 0);
    return { curtain, roof, wall, look: lookFor(ph), lift: liftAt(tl, t),
      hearts: ph === 5, lasers: ph === 6, fireworks: ph >= 7 && ph <= 9,
      stars: [2, 7, 8, 9].includes(ph), petals: [3, 4, 10].includes(ph) };
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
    const loc = locate(tl, t), env = envAt(tl, t, loc), look = env.look;
    const dance = danceAt(tl, t), sk = skeleton(dance), parts = bodyParts(sk);
    const shot = shotAt(shots, t);
    const u = clamp((t - shot.start) / Math.max(.001, shot.end - shot.start));
    // In the dance break, stage shots aim higher to hold the dancer and her ring of letters.
    const aimed = loc.phase === 6 ? { ...parts, chest: add(parts.chest, [0, .8, 0]) } : parts;
    const cam = LYRIC_KINDS.has(shot.kind) ? lyricCamera(shot, u, aspect, { dancerX: sk.pelvis[12] }) : shotCamera(shot, u, aimed);
    const beatPos = (t - tl.offset) / tl.period, pulse = t >= tl.duration ? 0 : Math.pow(1 - fract(beatPos), 4);
    const signal = (typeof input.signal === 'function' && input.signal(t)) || {};
    const energy = clamp(Number.isFinite(signal.energy) ? signal.energy : .55);
    const reduce = tl.reduce;
    if (!reduce) {
      const lyricShot = LYRIC_KINDS.has(shot.kind);
      const shake = ((env.lift ? .04 : .01) * pulse * (.5 + energy) + (loc.phase === 6 ? .03 * pulse : 0)) * (lyricShot ? .35 : 1);
      const n = k => noise(t * 17 + k * 31.7) * shake;
      cam.eye = add(cam.eye, [n(1), n(2), n(3)]);
      cam.target = add(cam.target, [n(4) * .5, n(5) * .5, n(6) * .5]);
      cam.roll += noise(t * 11 + 9) * shake * .6;
      cam.fov *= 1 - .025 * pulse * env.lift;
    }
    cam.eye = settle(cam.eye);

    // The lettering on screen now: lyric lines entering, being sung and leaving.
    const text = [];
    for (const line of model) {
      if (t < line.enterAt || t > line.exitAt + 1) continue;
      const block = lyricBlock(line, cam.textYaw || 0);
      for (const g of layouts[line.index].glyphs) {
        const inst = glyphInstance(g, line, block, t, reduce, pulse);
        if (inst) text.push(inst);
      }
    }
    const dancer = [sk.pelvis[12], 0, sk.pelvis[14]];
    text.push(...titleAndRing(tl, t, reduce, adv, pulse, dancer, cam.eye));

    // The finishing pass: flashes on chorus entries, a red strobe in the dance break,
    // speed lines on whips and rushes, letterbox bars at the start and end.
    const since = t - loc.section.start;
    let flash = 0, flashColor = [1, 1, 1], invert = 0, speed = cam.speed || 0, aberration = 0;
    if (!reduce) {
      if (loc.section.chorus && [2, 5, 7, 9].includes(loc.phase) && since < .45) {
        flash = .6 * Math.pow(1 - since / .45, 2);
        speed = Math.max(speed, 1 - since / .45);
      }
      if (loc.phase === 6) {
        if (since < .3) flash = Math.max(flash, .6 * (1 - since / .3));
        if (Math.floor(beatPos) % 2 === 0) flash = Math.max(flash, .2 * Math.pow(1 - fract(beatPos), 6));
        flashColor = look.primary;
        speed = Math.max(speed, .45 * pulse);
      }
      if ((loc.phase === 6 || loc.phase === 7) && since >= 0 && since < .07) invert = 1;
      aberration = .0035 * pulse * env.lift + speed * .006;
    } else speed = 0;
    const fadeIn = 1 - ease(t / 2.4);
    if (fadeIn > flash) { flash = fadeIn; flashColor = [0, 0, 0]; }
    const tail = ease((t - (tl.duration - 2.2)) / 2);
    let letterbox = .05;
    if (loc.phase === 0) letterbox = mix(.1, .05, env.curtain);
    if (loc.phase === 10) letterbox = mix(.05, .1, ease(since / 3));
    const post = {
      bloom: .42 + env.lift * .22 + pulse * env.lift * .12 + (loc.phase === 6 ? .2 : 0),
      threshold: .82, speedLines: speed, flash, flashColor, invert, aberration, letterbox,
      vignette: .36, grain: .03, saturation: 1.1, exposure: (look.open ? .96 : 1) * (1 - .7 * tail), time: t,
    };
    return { t, tl, loc, env, look, dance, sk, parts, shot, u, cam, beatPos, pulse, energy, post, reduce, text, model, layouts };
  }

  // MARK: rendering

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
  function starShape(points = 8, outer = 1, inner = .42) {
    const pts = [];
    for (let k = 0; k < points * 2; k++) {
      const a = k / (points * 2) * TAU + Math.PI / 2, r = k % 2 ? inner : outer;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  // MARK: the dancer's shapes

  /** Bakes parts into one mesh, turning normals correctly for squashed parts. */
  function bake(parts) {
    const out = K.merge(parts);
    let o = 0;
    for (const { g, m } of parts) {
      const inv = K.invert(m);
      for (let k = 0; k < g.n.length; k += 3) {
        const x = g.n[k], y = g.n[k + 1], z = g.n[k + 2];
        const n = v3.norm([inv[0] * x + inv[1] * y + inv[2] * z, inv[4] * x + inv[5] * y + inv[6] * z, inv[8] * x + inv[9] * y + inv[10] * z]);
        out.n[o + k] = n[0]; out.n[o + k + 1] = n[1]; out.n[o + k + 2] = n[2];
      }
      o += g.n.length;
    }
    return out;
  }
  const solid = (p, n, i) => K.merge([{ g: { p: new Float32Array(p), n: new Float32Array(n), i: new Uint32Array(i), smooth: true }, m: K.ident() }]);

  /** A rounded limb hanging from y = 0 to y = -len: radius r1 at the top, r2 at the bottom,
   *  and an optional swell (a calf) a third of the way down. Its round ends make the joints. */
  function limb(r1, r2, len, swell = 0, seg = 18) {
    const prof = [], cap = 6, mid = 9;
    for (let k = 0; k <= cap; k++) { const a = k / cap * Math.PI / 2; prof.push([Math.sin(a) * r1, Math.cos(a) * r1]); }
    for (let k = 1; k < mid; k++) {
      const u = k / mid;
      prof.push([mix(r1, r2, u) + swell * Math.sin(Math.PI * Math.min(1, u / .75)), -len * u]);
    }
    for (let k = 0; k <= cap; k++) { const a = k / cap * Math.PI / 2; prof.push([Math.cos(a) * r2, -len - Math.sin(a) * r2]); }
    return K.lathe(prof, seg);
  }

  /** A lathe whose rows ([radius, y, depth]) ripple `count` times around: pleats or ruffles. */
  function pleated(rows, count, seg = 96) {
    const p = [], n = [], i = [];
    const pos = (k, a) => {
      const [r, y, d] = rows[k], rr = r * (1 + d * Math.cos(count * a));
      return [rr * Math.cos(a), y, rr * Math.sin(a)];
    };
    for (let k = 0; k < rows.length; k++) for (let s = 0; s <= seg; s++) {
      const a = s / seg * TAU, q = pos(k, a);
      const du = v3.sub(pos(k, a + 1e-3), pos(k, a - 1e-3));
      const dv = v3.sub(pos(Math.min(rows.length - 1, k + 1), a), pos(Math.max(0, k - 1), a));
      let nn = v3.norm(v3.cross(du, dv));
      if (v3.dot(nn, [q[0], 0, q[2]]) < 0) nn = v3.scale(nn, -1);
      p.push(...q); n.push(...nn);
    }
    for (let k = 0; k < rows.length - 1; k++) for (let s = 0; s < seg; s++) {
      const a = k * (seg + 1) + s, b = a + seg + 1;
      i.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return solid(p, n, i);
  }

  /** A flattened lock of hair along a curve from p0 (bending toward c) to p2, tapering to a point.
   *  Its thickness lies along the direction away from the head's centre. */
  function strand(p0, c, p2, halfW, halfT, n = 10, seg = 8) {
    const ring = seg + 1, p = [], nrm = [], idx = [];
    const at = s => [0, 1, 2].map(a => (1 - s) * (1 - s) * p0[a] + 2 * s * (1 - s) * c[a] + s * s * p2[a]);
    for (let k = 0; k <= n; k++) {
      const s = k / n, q = at(s);
      const tangent = v3.norm(v3.sub(at(Math.min(1, s + .01)), at(Math.max(0, s - .01))));
      const outward = v3.norm(q);
      const out = v3.norm(v3.sub(outward, v3.scale(tangent, v3.dot(outward, tangent))));
      const side = v3.cross(out, tangent);
      const shape = Math.pow(1 - s, .8) * (.7 + .3 * Math.min(1, s / .25));
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
        p.push(...v3.add(q, v3.add(v3.scale(side, ca * halfW * shape), v3.scale(out, sa * halfT * shape))));
        nrm.push(...v3.norm(v3.add(v3.scale(side, ca * halfT), v3.scale(out, sa * halfW))));
      }
    }
    for (let k = 0; k < n; k++) for (let j = 0; j < seg; j++) {
      const a = k * ring + j, b = a + ring;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return { p: new Float32Array(p), n: new Float32Array(nrm), i: new Uint32Array(idx), smooth: true };
  }

  // The head, measured from the centre of the skull (HEAD_Y above the neck joint): round
  // on top, narrowing to a small chin that sits a little forward.
  const HEAD_R = .128, HEAD_Y = .115;
  const JAW = [[0, HEAD_R], [-.03, .121], [-.058, .104], [-.082, .083], [-.102, .06], [-.118, .036], [-.129, .014], [-.134, 0]];
  function faceRadius(y) {
    if (y >= 0) return Math.sqrt(Math.max(0, HEAD_R * HEAD_R - y * y));
    for (let k = 1; k < JAW.length; k++) {
      if (y >= JAW[k][0]) { const [y0, r0] = JAW[k - 1], [y1, r1] = JAW[k]; return mix(r0, r1, (y - y0) / (y1 - y0)); }
    }
    return 0;
  }
  const chinShift = y => Math.max(0, -y) * .3;
  /** A frame lying on the face at angle ax round the head and height y: +z points out of the skin. */
  function faceFrame(ax, y, lift = 0) {
    const r = faceRadius(y) + lift, tilt = Math.asin(clamp(y / HEAD_R, -1, 1)) * (y < 0 ? .55 : 1);
    return chain(T(r * Math.sin(ax), y, r * Math.cos(ax) + chinShift(y)), RY(ax), RX(-tilt));
  }

  function buildHead(G) {
    const prof = [];
    for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI / 2; prof.push([HEAD_R * Math.sin(a), HEAD_R * Math.cos(a)]); }
    for (const [y, r] of JAW.slice(1)) prof.push([r, y]);
    const face = K.lathe(prof, 32);
    for (let k = 0; k < face.p.length; k += 3) {
      const y = face.p[k + 1], s = y < 0 ? .3 : 0;
      face.p[k + 2] += chinShift(y);
      const n = v3.norm([face.n[k], face.n[k + 1] + s * face.n[k + 2], face.n[k + 2]]);
      face.n[k] = n[0]; face.n[k + 1] = n[1]; face.n[k + 2] = n[2];
    }
    G.face = face;
    // Big anime eyes: white, iris, pupil, two catchlights and a heavy upper lash line.
    const ball = K.sphere(1, 16, 12);
    const arcUp = K.torus(1, .14, 18, 6, Math.PI), up = RX(-Math.PI / 2), down = RX(Math.PI / 2);
    const sclera = [], iris = [], ink = [], shine = [], blush = [];
    for (const sgn of [-1, 1]) {
      const E = faceFrame(sgn * .42, -.012);
      sclera.push({ g: ball, m: chain(E, T(0, 0, -.005), S(.03, .042, .012)) });
      iris.push({ g: ball, m: chain(E, T(0, -.004, -.002), S(.022, .035, .012)) });
      ink.push({ g: ball, m: chain(E, T(0, -.006, .0006), S(.0095, .017, .011)) });
      ink.push({ g: arcUp, m: chain(E, T(0, .001, .003), RX(-.18), up, S(.033, 1, .046), S(1, .016, 1)) });
      ink.push({ g: ball, m: chain(E, T(sgn * .031, .016, .001), RZ(sgn * .7), S(.011, .003, .004)) });
      shine.push({ g: ball, m: chain(E, T(-.008, .012, .008), S(.0075, .0095, .005)) });
      shine.push({ g: ball, m: chain(E, T(.008, -.019, .009), S(.0038, .0038, .003)) });
      ink.push({ g: arcUp, m: chain(faceFrame(sgn * .44, .056), RZ(sgn * -.12), T(0, -.008, .002), up, S(.028, 1, .01), S(1, .012, 1)) });
      blush.push({ g: ball, m: chain(faceFrame(sgn * .62, -.05), T(0, 0, -.002), S(.022, .011, .006)) });
    }
    G.sclera = bake(sclera); G.iris = bake(iris); G.faceInk = bake(ink); G.shine = bake(shine); G.blush = bake(blush);
    G.mouth = bake([{ g: arcUp, m: chain(faceFrame(0, -.078), T(0, .004, .001), down, S(.016, 1, .009), S(1, .012, 1)) }]);
    // Hair: a cap set back from the forehead, bangs, locks framing the face and a full back.
    G.hairCap = bake([{ g: K.sphere(.1366, 30, 20), m: chain(T(0, .03, -.035), S(1.08, 1, 1)) }]);
    const sph = (ax, ay, rr) => [rr * Math.sin(ax) * Math.cos(ay), rr * Math.sin(ay), rr * Math.cos(ax) * Math.cos(ay)];
    const R = HEAD_R, locks = [];
    for (const [ax, tip, w] of [[-.68, .48, .022], [-.45, .5, .026], [-.22, .4, .026], [0, .33, .028], [.23, .42, .026], [.46, .52, .026], [.69, .47, .022]]) {
      locks.push(strand(sph(ax, .92, R + .008), sph(ax * 1.04, .66, R + .02), sph(ax * 1.1, tip, R + .014), w, .0075));
    }
    for (const sgn of [-1, 1]) {
      locks.push(strand(sph(sgn * .98, .72, R + .01), sph(sgn * 1.12, -.05, R + .028), [sgn * .115, -.15, .04], .022, .009));
      locks.push(strand(sph(sgn * 1.3, .62, R + .012), sph(sgn * 1.4, .02, R + .032), [sgn * .125, -.13, -.015], .028, .011));
    }
    for (const da of [-1, -.5, 0, .5, 1]) {
      const ax = Math.PI + da;
      locks.push(strand(sph(ax, .5, R + .01), sph(ax, -.25, R + .045), [Math.sin(ax) * .1, -.25, Math.cos(ax) * .11 - .02], .038, .013));
    }
    G.hairLocks = K.merge(locks.map(g => ({ g, m: K.ident() })));
    // A small top hat with a curled brim.
    G.hat = K.merge([
      { g: K.lathe([[0, .19], [.062, .189], [.08, .184], [.084, .175], [.078, .095], [.073, .03], [.074, 0], [0, -.002]], 28), m: K.ident() },
      { g: K.lathe([[0, .012], [.1, .012], [.128, .017], [.142, .031], [.147, .027], [.137, .006], [.1, -.004], [0, -.004]], 32), m: K.ident() },
    ]);
    G.hatBand = K.lathe([[.0, .05], [.078, .05], [.081, .044], [.079, .02], [.0, .02]], 28);
  }

  function buildDancer(G) {
    buildHead(G);
    const ball = K.sphere(1, 18, 12);
    // A fitted bodice, a little flatter front to back than side to side.
    G.torso = bake([{ g: K.lathe([[0, .62], [.045, .615], [.062, .6], [.1, .576], [.136, .532], [.15, .47], [.153, .4], [.147, .33],
      [.13, .26], [.112, .19], [.106, .13], [.117, .06], [.13, 0], [.12, -.06], [0, -.09]], 30), m: S(1, 1, .8) }]);
    G.belt = bake([{ g: K.torus(.113, .017, 36, 8), m: S(1, 1, .8) }]);
    G.collar = K.torus(.06, .017, 26, 8);
    G.buttons = bake([[.17, .109], [.24, .124], [.31, .142]].map(([y, r]) => ({ g: ball, m: chain(T(0, y, r * .8 + .004), S(.012)) })));
    // A bow: two loops and a knot, with two tails.
    const spindle = K.lathe([[0, 0], [.14, -.06], [.19, -.2], [.17, -.45], [.11, -.7], [.05, -.9], [0, -1]], 10);
    const loops = [
      { g: ball, m: chain(T(-.055, 0, 0), RZ(.35), S(.055, .035, .022)) },
      { g: ball, m: chain(T(.055, 0, 0), RZ(-.35), S(.055, .035, .022)) },
      { g: ball, m: S(.022, .024, .024) },
    ];
    G.bow = bake(loops);
    G.bigBow = bake([...loops, { g: spindle, m: chain(T(-.012, -.012, 0), RZ(-.32), S(.14, .16, .05)) }, { g: spindle, m: chain(T(.012, -.012, 0), RZ(.32), S(.14, .16, .05)) }]);
    G.neck = limb(.036, .034, .1, 0, 14);
    // Arms: puffed sleeves, bare upper arms, long gloves and soft hands with a thumb.
    G.puff = bake([{ g: K.sphere(.082, 20, 14), m: S(1.06, .92, 1) }]);
    G.cuff = K.torus(.048, .012, 22, 6);
    G.upper = limb(.04, .033, .23);
    G.fore = limb(.034, .027, .25, .004);
    G.frill = K.torus(.04, .013, 22, 6);
    const hand = sgn => bake([
      { g: ball, m: chain(T(0, -.045, 0), S(.022, .048, .036)) },
      { g: limb(.012, .01, .04, 0, 10), m: chain(T(-sgn * .004, -.022, .026), RX(-.55)) },
    ]);
    G.handL = hand(1); G.handR = hand(-1);
    // Legs: white tights, short boots with a gold cuff, and shaped shoes with a heel.
    G.thigh = limb(.07, .052, .42, .004);
    G.shin = limb(.05, .03, .43, .008);
    G.boot = limb(.054, .04, .22, .004);
    G.bootCuff = K.torus(.054, .012, 22, 6);
    G.foot = bake([{ g: ball, m: chain(T(0, -.035, .05), S(.046, .04, .1)) }, { g: K.sphere(1, 10, 8), m: chain(T(0, -.055, -.03), S(.022, .03, .022)) }]);
    // A pleated skirt over a ruffled petticoat, with a gold hem.
    const skirtRows = [[.118, .08, 0], [.15, .02, .01], [.21, -.08, .03], [.29, -.19, .05], [.36, -.29, .065], [.395, -.345, .075]];
    G.skirt = pleated(skirtRows, 14);
    G.hem = pleated([[.376 * 1.012, -.315, .07], [.395 * 1.012, -.345, .075], [.386, -.351, .075]], 14);
    G.petticoat = pleated([[.12, 0, 0], [.2, -.12, .01], [.29, -.25, .02], [.345, -.34, .03], [.4, -.375, .06], [.405, -.388, .06]], 26);
  }

  function buildGeometry() {
    const G = {};
    G.unitBox = K.box(1, 1, 1);
    buildDancer(G);
    G.panel = K.plane(1, 1);
    // Two LED towers at the sides of the stage, turned toward the audience.
    const frames = [], trims = [];
    for (const tw of TOWERS) {
      const base = chain(T(tw.x, 0, tw.z), RY(tw.yaw));
      frames.push({ g: K.box(tw.w + .34, tw.h + .5, .5), m: chain(base, T(0, tw.h / 2 + .25, 0)) });
      frames.push({ g: K.box(tw.w + .9, .3, 1.1), m: chain(base, T(0, .15, 0)) });
      for (const sx of [-1, 1]) trims.push({ g: K.box(.12, tw.h + .5, .1), m: chain(base, T(sx * (tw.w / 2 + .17), tw.h / 2 + .25, .27)) });
      for (const y of [.12, tw.h + .38]) trims.push({ g: K.box(tw.w + .46, .1, .1), m: chain(base, T(0, y, .27)) });
    }
    G.towers = K.merge(frames);
    G.towerTrim = K.merge(trims);
    // Stage and hall
    G.floor = K.plane(23.6, 12.8);
    G.drape = K.drape(11.8, 10.7, 9, .3, 90, 4);
    G.valance = K.drape(25, 2.2, 26, .2, 140, 2);
    G.arch = K.torus(11.4, .22, 64, 10, Math.PI);
    G.ring = K.torus(3.2, .16, 48, 10);
    G.fixture = K.cylinder(.2, .28, .5, 14);
    G.star = K.extrude(starShape(), .22);
    G.heart = K.extrude(heartShape(), .22);

    const box = (w, h, d, x, y, z, rx = 0) => ({ g: K.box(w, h, d), m: chain(T(x, y, z), RX(rx)) });
    const rake = Math.atan(.07);
    G.hall = K.merge([
      box(30, 1.43, 13, 0, -.745, -2.3),                       // stage platform, just under the floor
      box(44, .4, 3, 0, -1.65, 5.6),                           // orchestra floor
      box(44, .4, 34.4, 0, -1.45 + 17 * .07 - .2, 21.8, -rake), // raked stalls
      box(.8, 18, 36.5, -21.4, 7, 22.6), box(.8, 18, 36.5, 21.4, 7, 22.6), box(43.6, 18, .8, 0, 7, 40.6),
      box(2.8, 1.1, 26, -19.2, 4.6, 22.5), box(2.8, 1.1, 26, 19.2, 4.6, 22.5), box(2.8, 1.1, 26, -19.2, 8.2, 22.5), box(2.8, 1.1, 26, 19.2, 8.2, 22.5),
      box(38, 1.1, 2.8, 0, 4.6, 36.8), box(38, 1.1, 2.8, 0, 8.2, 36.8),
      box(2, 14, 1.4, -12.5, 6, 4.4), box(2, 14, 1.4, 12.5, 6, 4.4), box(27, 3, 1.4, 0, 12.1, 4.4),
      box(1.2, 13, 12.6, -12.6, 6.5, -2.2), box(1.2, 13, 12.6, 12.6, 6.5, -2.2),
    ]);
    G.gold = K.merge([
      box(30, .14, .22, 0, -.04, 4.24),
      box(2.92, .14, 26.1, -19.2, 5.2, 22.5), box(2.92, .14, 26.1, 19.2, 5.2, 22.5), box(2.92, .14, 26.1, -19.2, 8.8, 22.5), box(2.92, .14, 26.1, 19.2, 8.8, 22.5),
      box(38.1, .14, 2.92, 0, 5.2, 36.8), box(38.1, .14, 2.92, 0, 8.8, 36.8),
      box(2.3, .4, 1.6, -12.5, 10.6, 4.4), box(2.3, .4, 1.6, 12.5, 10.6, 4.4), box(27.2, .3, 1.6, 0, 10.7, 4.4),
      { g: G.arch, m: chain(T(0, 0, 5.2), RX(-Math.PI / 2)) },
      box(20, .35, .35, 0, 10.4, 1.8), box(20, .35, .35, 0, 10.4, -3.2),
    ]);
    const rose = [{ g: G.ring, m: RX(-Math.PI / 2) }, { g: K.torus(1.2, .1, 32, 8), m: RX(-Math.PI / 2) }];
    for (let k = 0; k < 8; k++) rose.push({ g: K.box(.12, 2.1, .12), m: chain(RZ(k * TAU / 8), T(0, 2.15, 0)) });
    G.rose = K.merge(rose);
    // The audience is a sea of penlights only.
    G.seats = [];
    for (let row = 0; row < 18; row++) {
      const z = 6.6 + row * 1.6;
      for (let col = 0; col < 34; col++) {
        const x = -17.8 + col * 1.08;
        if (Math.abs(x) < .9 || Math.abs(Math.abs(x) - 11) < .5) continue;
        G.seats.push({ x: x + (hash(row * 40 + col) - .5) * .2, y: rakeY(z) + 1.02 + (hash(row * 7 + col * 3) - .5) * .14, z, phase: hash(row * 13 + col), row });
      }
    }
    for (const sgn of [-1, 1]) for (const tier of [5.25, 8.85]) for (let k = 0; k < 15; k++) {
      G.seats.push({ x: sgn * 18.4, y: tier + .55, z: 10.5 + k * 1.7, phase: hash(k * 3 + tier + sgn), row: 20 });
    }
    for (const tier of [5.25, 8.85]) for (let k = 0; k < 25; k++) G.seats.push({ x: -15.6 + k * 1.3, y: tier + .55, z: 36.2, phase: hash(k * 5 + tier), row: 21 });
    // A distant city skyline behind the stage, seen once the back wall drops.
    const sky = [];
    for (let k = 0; k < 70; k++) {
      const a = mix(-1.3, 1.3, k / 69) + (hash(k) - .5) * .03, dist = 55 + hash(k + 7) * 45;
      const h = 8 + Math.pow(hash(k + 3), 2) * 40, w = 5 + hash(k + 5) * 7, d = 5 + hash(k + 9) * 6;
      sky.push({ g: K.box(w, h, d), m: chain(T(Math.sin(a) * dist, -6 + h / 2, -Math.cos(a) * dist - 10), RY(-a)) });
    }
    G.skyline = K.merge(sky);
    G.sphereDirs = [];
    for (let k = 0; k < 64; k++) {
      const y = 1 - (k + .5) / 64 * 2, r = Math.sqrt(1 - y * y), a = k * 2.39996;
      G.sphereDirs.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    G.bulbs = [];
    for (let k = 0; k <= 46; k++) {
      const a = k / 46 * Math.PI;
      G.bulbs.push([Math.cos(a) * 11.4, Math.sin(a) * 11.4, 5.45]);
    }
    for (const sgn of [-1, 1]) for (let k = 0; k < 10; k++) G.bulbs.push([sgn * 11.55, .6 + k * 1.0, 5.2]);
    return G;
  }

  // Extrusion depth (ems) and layer count per kind of lettering.
  const TEXT_STYLE = {
    main: { layers: 10, depth: .34 }, romaji: { layers: 3, depth: .09 }, trans: { layers: 3, depth: .09 },
    title: { layers: 9, depth: .3 }, ring: { layers: 5, depth: .2 },
  };

  function textColors(inst, look) {
    switch (inst.role) {
      case 'title': return { top: [1, .9, .58], bottom: [1, .56, .3], near: [.5, .2, .1], far: [.22, .06, .04] };
      case 'ring': return { top: [1, .8, .84], bottom: scalec(look.primary, 1.1), near: scalec(look.primary, .4), far: scalec(look.primary, .15) };
      case 'romaji': return inst.sung
        ? { top: mixc(look.secondary, [1, 1, 1], .5), bottom: look.secondary, near: TEXT_INK, far: TEXT_INK }
        : { top: [.86, .86, .95], bottom: [.74, .74, .88], near: TEXT_INK, far: TEXT_INK };
      case 'trans': return { top: [.95, .92, .88], bottom: [.84, .8, .84], near: TEXT_INK, far: TEXT_INK };
      default: {
        const near = scalec(look.primary, .8), far = scalec(look.primary, .28);
        if (inst.singing) return { top: [1, 1, 1], bottom: mixc(look.accent, [1, 1, 1], .45), near, far };
        if (inst.sung) return { top: mixc(look.accent, [1, 1, 1], .3), bottom: look.primary, near, far };
        return { top: [.92, .9, .95], bottom: [.76, .73, .86], near, far };
      }
    }
  }

  /** Creates the music video on a canvas; returns null when WebGL2 is unavailable. */
  function create(canvas, options = {}) {
    const r = options.renderer || K.createRenderer(canvas, { font: LYRIC_FONT });
    if (!r) return null;
    const G = buildGeometry();
    const B = { glow: batch(3000), sparkle: batch(800), confetti: batch(1400), petal: batch(400), disc: batch(1200), burst: batch(1200), bokeh: batch(64) };
    const cache = {};
    const lettering = L.createLettering(r, TEXT_STYLE);
    const metrics = ch => r.glyph(ch).advance;
    // Lay lyrics out again once the web font arrives, so spacing matches the real letters.
    const doc = typeof document === 'object' ? document : null;
    if (doc?.fonts?.load) {
      Promise.all([doc.fonts.load('800 84px "Atkinson Hyperlegible Next"'), doc.fonts.ready])
        .then(() => r.resetGlyphs()).catch(() => {});
    }

    function materials(look) {
      const ink = { outline: 1.6, outlineColor: INK };
      return {
        skin: { color: [.97, .86, .82], shade: [.86, .63, .7], rim: .2, rimColor: look.rim, spotGain: .3, ...ink },
        dress: { color: [.86, .1, .24], shade: [.42, .04, .2], rim: .45, rimColor: look.rim, spec: .25, ...ink },
        white: { color: [.95, .93, .98], shade: [.62, .58, .78], rim: .25, rimColor: look.rim, spotGain: .5, ...ink },
        dark: { color: [.13, .06, .12], shade: [.05, .02, .05], rim: .8, rimColor: look.rim, spec: .6, ...ink },
        gold: { color: [1, .78, .36], shade: [.62, .36, .22], rim: .5, rimColor: look.accent, spec: .9, emit: [.06, .035, 0], ...ink },
        hair: { color: [.4, .15, .4], shade: [.17, .05, .2], rim: .85, rimColor: look.rim, spec: .65, ...ink },
        ribbon: { color: [1, .82, .4], shade: [.75, .4, .3], rim: .6, rimColor: look.rim, emit: [.18, .1, .02], spec: .4 },
      };
    }
    // The face is painted on: flat colours that read in any light, without ink outlines.
    const FACE = {
      sclera: { color: [1, .98, 1], shade: [.86, .82, .94], emit: [.3, .29, .33] },
      iris: { color: [.58, .2, .8], shade: [.4, .1, .6], emit: [.16, .04, .24] },
      ink: { color: [.14, .04, .12], shade: [.1, .02, .09] },
      shine: { color: [1, 1, 1], emit: [.9, .9, .9] },
      blush: { color: [1, .55, .66], shade: [.9, .45, .55], emit: [.2, .05, .08] },
      mouth: { color: [.62, .14, .22], shade: [.5, .1, .18] },
    };
    const ponytailWidth = u => (.042 + .025 * Math.sin(Math.PI * Math.min(1, u / .55))) * Math.pow(1 - u, .55);

    function drawDancer(sk, look, opt = {}) {
      const M = materials(look), mirror = !!opt.mirror;
      const draw = (g, m, mat) => r.draw(g, m, mirror ? { ...mat, outline: 0 } : mat);
      const H = chain(sk.head, T(0, HEAD_Y, 0));
      // Bodice, collar and bows.
      draw(G.torso, sk.chest, M.dress);
      draw(G.belt, chain(sk.chest, T(0, .115, 0)), M.dark);
      draw(G.collar, chain(sk.chest, T(0, .585, 0)), M.white);
      draw(G.neck, chain(sk.head, T(0, .05, 0)), M.skin);
      draw(G.bigBow, chain(sk.chest, T(0, .14, -.1), RY(Math.PI), S(1.5)), M.dark);
      if (!mirror) {
        draw(G.buttons, sk.chest, M.gold);
        draw(G.bow, chain(sk.chest, T(0, .55, .1), S(.6)), M.dark);
      }
      // Arms.
      for (const [arm, left] of [[sk.armL, true], [sk.armR, false]]) {
        draw(G.puff, chain(arm.sh, T(0, -.01, 0)), M.dress);
        draw(G.cuff, chain(arm.sh, T(0, -.075, 0)), M.white);
        draw(G.upper, chain(arm.sh, T(0, -.04, 0)), M.skin);
        draw(G.fore, arm.el, M.white);
        draw(G.frill, chain(arm.el, T(0, -.04, 0)), M.dress);
        draw(left ? G.handL : G.handR, arm.hand, M.white);
      }
      // Legs.
      for (const leg of [sk.legL, sk.legR]) {
        draw(G.thigh, chain(leg.hip, T(0, -.02, 0)), M.white);
        draw(G.shin, leg.knee, M.white);
        draw(G.boot, chain(leg.knee, T(0, -.21, 0)), M.dark);
        draw(G.bootCuff, chain(leg.knee, T(0, -.215, 0)), M.gold);
        draw(G.foot, chain(leg.ankle, RX(-clamp(leg.lift, 0, 1.4) * .7)), M.dark);
      }
      // The skirt flares out on spins and jumps.
      const fl = sk.flare, flare = chain(sk.pelvis, T(0, .04, 0), S(fl, 1 - (fl - 1) * .4, fl));
      draw(G.petticoat, chain(sk.pelvis, T(0, .02, 0), S(fl * 1.02, 1 - (fl - 1) * .5, fl * 1.02)), M.white);
      draw(G.skirt, flare, M.dress);
      draw(G.hem, flare, M.gold);
      // Head: face, painted features, hair and hat.
      draw(G.face, H, M.skin);
      if (!mirror) {
        for (const part of ['sclera', 'iris', 'faceInk', 'shine', 'blush', 'mouth']) {
          r.draw(G[part], H, FACE[part === 'faceInk' ? 'ink' : part]);
        }
      }
      draw(G.hairCap, H, M.hair);
      draw(G.hairLocks, H, M.hair);
      const hat = chain(H, T(.035, .148, -.012), RZ(-.24), RX(.1));
      draw(G.hat, hat, M.dark);
      draw(G.hatBand, hat, M.dress);
      if (!mirror) draw(G.bow, chain(hat, T(-.08, .036, .02), RY(-Math.PI / 2), S(.55)), M.gold);
      // The high ponytail and the ribbon trail follow where the head and hand just were.
      if (opt.tails && opt.tails.length > 2) {
        r.drawDynamic(K.tube(opt.tails, ponytailWidth, 10), K.ident(), mirror ? { ...M.hair, outline: 0 } : M.hair);
        draw(G.bow, chain(H, T(0, .075, -.138), RX(.5), RY(Math.PI), S(.8)), M.dress);
      }
      if (opt.ribbon && opt.ribbon.length > 3) {
        r.drawDynamic(K.ribbon(opt.ribbon, u => mix(.11, .03, u), [0, 1, 0], 2.4), K.ident(), M.ribbon);
      }
    }

    /** The hand path and ponytail, sampled at earlier moments of the same section. */
    function trails(tl, t, loc) {
      const start = loc.section.start;
      const ribbon = [], tails = [];
      for (let k = 0; k < 30; k++) {
        const sk = skeleton(danceAt(tl, Math.max(start, t - k * .03)));
        ribbon.push(origin(sk.armR.hand));
        if (k < 12) {
          const sag = k * .028;
          tails.push(apply(sk.head, [0, HEAD_Y + .075 - sag * 1.5, -.14 - sag * .75]));
        }
      }
      return { ribbon, tails };
    }

    function draw(input) {
      if (r.lost()) return null;
      const width = Math.max(1, input.width | 0), height = Math.max(1, input.height | 0);
      const f = frameAt({ ...input, metrics, metricsEpoch: r.glyphEpoch }, cache);
      const { t, tl, loc, env, look, sk, parts, cam, beatPos, pulse, energy, reduce } = f;
      const ph = loc.phase, lift = env.lift;
      const indoor = [scalec(look.sky[0], .55), scalec(look.sky[1], .5), scalec(look.sky[2], .6)];
      const skyCols = indoor.map((c, k) => mixc(c, look.sky[k], env.roof));
      if (!r.begin(width, height, skyCols[2])) return null;
      r.camera({ eye: cam.eye, target: cam.target, roll: cam.roll, fov: cam.fov, up: cam.up });

      // Lighting rig: six moving heads on the truss and a follow spot from the back of the hall.
      const heads = [];
      const dancer = [sk.pelvis[12], 0, sk.pelvis[14]];
      const motionT = reduce ? t * .25 : t;
      for (let k = 0; k < 6; k++) {
        const x = -8.4 + k * 3.36, apex = [x, 10.05, 1.8];
        let target;
        if (ph === 6 && !reduce) {
          const b = Math.floor(beatPos);
          target = [(hash(b * 7 + k) - .5) * 18, 0, (hash(b * 3 + k * 5) - .5) * 10 - 1];
        } else if (lift > .5 && !reduce) {
          const sweep = Math.sin(beatPos * Math.PI / 4 + k * .9);
          const converge = Math.pow(1 - fract(beatPos / 4), 6) * .75;
          target = v3.mix([x * .4 + sweep * 6, 0, 1 + Math.cos(beatPos * .7 + k) * 3], dancer, converge);
        } else {
          target = [x * .3 + Math.sin(motionT * .35 + k * 1.3) * 5, 0, Math.sin(motionT * .27 + k) * 3];
        }
        const color = ph === 6 ? look.primary : [look.primary, look.secondary, look.accent][k % 3];
        let intensity = look.beams * (.45 + lift * .45);
        if (ph === 0) intensity *= env.curtain;
        heads.push({ apex, dir: v3.norm(v3.sub(target, apex)), color, intensity });
      }
      const followApex = [0, 9, 30], followDir = v3.norm(v3.sub(parts.chest, followApex));
      const followDist = v3.dist(parts.chest, followApex);
      const followOn = ph === 0 ? .55 + env.curtain * .45 : ph === 6 ? .25 : 1;
      const followColor = [3, 4].includes(ph) ? [.75, .85, 1] : [1, .93, .86];
      const spots = [{ pos: followApex, dir: followDir, color: scalec(followColor, .3 * followOn), angle: Math.atan(.85 / followDist) }];
      for (const h of heads.slice(0, 5)) spots.push({ pos: h.apex, dir: h.dir, color: scalec(h.color, h.intensity * .3), angle: .085 });
      r.lights({
        keyDir: look.keyDir, keyColor: scalec(look.key, look.keyI), ambient: [look.ambient, look.ambient * .9, look.ambient * 1.1],
        fog: look.fog, fogNear: look.open ? 45 : 32, fogFar: look.open ? 175 : 100, spots,
      });
      r.sky({ top: skyCols[0], horizon: skyCols[1], bottom: skyCols[2], stars: env.roof * (ph === 10 ? .15 : 1),
        moon: env.roof * (ph === 10 ? .35 : ph === 7 || ph === 9 ? .7 : 1), moonDir: MOON_DIR, moonColor: [1, .96, .9], time: t });

      const wallDrop = env.wall * 15.5;
      const dancerTrails = trails(tl, t, loc);
      const setPieces = mirror => {
        const ink = w => (mirror ? 0 : w);
        if (env.stars) for (let k = 0; k < 3; k++) {
          const pos = [[-7.2, 6.6, -6.6], [7.2, 6.6, -6.6], [0, 9.2, -7.2]][k];
          const sc = (k === 2 ? 1.5 : 1.15) * (1 + pulse * .12 * lift);
          const m = chain(T(pos[0], pos[1] + Math.sin(t * .8 + k) * .3, pos[2]), RY(t * .7 + k * 2), RZ(Math.sin(t * .5 + k) * .3), S(sc));
          r.draw(G.star, m, { color: [1, .82, .38], shade: [.8, .4, .25], emit: scalec(look.accent, .25 + pulse * .25 * lift), rim: .8, rimColor: look.rim, spec: .8, outline: ink(2), outlineColor: INK });
        }
        if (env.hearts) for (let k = 0; k < 8; k++) {
          const a = t * .6 + k * TAU / 8, rad = 5 + Math.sin(k * 1.7) * .6;
          const pos = [dancer[0] + Math.sin(a) * rad, 1.2 + fract(k * .37) * 3.4 + Math.sin(t * 1.3 + k) * .25, dancer[2] - 1.5 + Math.cos(a) * rad * .6];
          const sc = (.42 + fract(k * .61) * .25) * (1 + pulse * .25);
          r.draw(G.heart, chain(T(...pos), RY(a + Math.PI / 2 + Math.sin(t * 2 + k) * .4), RZ(Math.sin(t * 1.5 + k) * .2), S(sc)),
            { color: [1, .42, .68], shade: [.72, .14, .42], emit: scalec(look.primary, .25 + pulse * .35), rim: .9, rimColor: [1, .85, .95], spec: .8, outline: ink(1.8), outlineColor: INK });
        }
        drawDancer(sk, look, { mirror, ribbon: dancerTrails.ribbon, tails: dancerTrails.tails });
      };

      // Reflections in the lacquered stage floor, then the floor itself.
      r.mirror(true);
      setPieces(true);
      r.mirror(false);
      const ringAge = fract(beatPos);
      r.draw(G.floor, T(0, .004, -2.2), {
        color: look.floor[0], alpha: [3, 4].includes(ph) ? .5 : .66, spec: .3, depthWrite: true,
        floor: { b: look.floor[1], tile: 1.2, ringColor: look.ring, ringCenter: dancer, ringRadius: ringAge * 9,
          ringAmount: (reduce ? .25 : (.25 + lift * .75)) * (1 - ringAge) * (ph === 0 ? env.curtain : 1) },
      });

      // LED screens: the back wall and the two towers run a moving pattern for each section,
      // held back in the middle of the wall where the lyrics are.
      const led = LED_LOOK[ph] || LED_LOOK[2], stageOn = ph === 0 ? env.curtain : 1;
      const screen = (mode, width, height, hold, gain) => ({ mode, a: look.primary, b: look.secondary, c: mixc(look.accent, [1, 1, 1], .4),
        time: reduce ? t * .2 : t, beat: reduce ? 0 : beatPos, energy, pitch: 4.2, width, height, hold,
        gain: gain * led[2] * stageOn * (reduce ? .6 : 1) });
      const panel = { color: [.03, .025, .04], spec: .15 };

      // The house
      r.draw(G.hall, K.ident(), { color: [.3, .07, .14], shade: [.12, .03, .08], outline: 1.2, outlineColor: INK });
      r.draw(G.gold, K.ident(), { color: [.96, .72, .32], shade: [.55, .3, .2], spec: .9, rim: .5, rimColor: look.accent, emit: [.04, .025, 0], outline: 1.3, outlineColor: INK });
      if (wallDrop < 15) {
        r.draw(G.unitBox, chain(T(0, 7.5 - wallDrop, -8.7), S(26, 15, .6)), { color: [.22, .05, .11], shade: [.09, .02, .06], outline: 1.2, outlineColor: INK });
        r.draw(G.panel, chain(T(0, 7.6 - wallDrop, -8.38), RX(Math.PI / 2), S(24.4, 1, 13.6)), { ...panel, screen: screen(led[0], 24.4, 13.6, .65, 1) });
        r.draw(G.rose, chain(T(0, 6.8 - wallDrop, -8.3), RZ(t * .05)), { color: [.96, .72, .32], shade: [.55, .3, .2], spec: .8, emit: [.05, .03, 0], outline: 1.4, outlineColor: INK });
      }
      for (const tw of TOWERS) {
        r.draw(G.panel, chain(T(tw.x, 0, tw.z), RY(tw.yaw), T(0, tw.h / 2 + .25, .26), RX(Math.PI / 2), S(tw.w, 1, tw.h)),
          { ...panel, screen: screen(led[1], tw.w, tw.h, 0, .9) });
      }
      r.draw(G.towers, K.ident(), { color: [.1, .05, .1], shade: [.04, .02, .05], rim: .4, rimColor: look.rim, spec: .3, outline: 1.2, outlineColor: INK });
      r.draw(G.towerTrim, K.ident(), { color: [.96, .72, .32], shade: [.55, .3, .2], spec: .9, rim: .5, rimColor: look.accent, emit: [.05, .03, 0], outline: 1, outlineColor: INK });
      if (env.wall > 0) r.draw(G.skyline, K.ident(), { color: [.08, .1, .22], shade: [.04, .05, .12], windows: .9, rim: .25, rimColor: look.rim });
      // Curtains gather to the sides as they open.
      const sway = reduce ? 0 : Math.sin(t * .9) * .04;
      for (const sgn of [-1, 1]) {
        const open = env.curtain, sx = mix(1, .2, open), cx = sgn * (mix(5.9, 10.6, open) + sway);
        r.draw(G.drape, chain(T(cx, 10.55, 4.12), S(sx, 1, 1)), { color: [.72, .06, .17], shade: [.3, .02, .1], rim: .6, rimColor: look.rim, spec: .2 });
        r.draw(G.unitBox, chain(T(cx, -.08, 4.18), S(11.8 * sx, .22, .12)), { color: [.96, .72, .32], shade: [.55, .3, .2], emit: [.05, .03, 0] });
      }
      r.draw(G.valance, T(0, 11.1, 4.3), { color: [.66, .05, .15], shade: [.28, .02, .09], rim: .5, rimColor: look.rim });
      for (const h of heads) {
        const y = v3.norm(v3.scale(h.dir, -1));
        let x = v3.norm(v3.cross(y, [0, 0, 1]));
        if (v3.len(x) < .5) x = [1, 0, 0];
        r.draw(G.fixture, K.basis(x, y, v3.cross(x, y), add(h.apex, [0, .2, 0])), { color: [.14, .12, .16], shade: [.06, .05, .08], emit: scalec(h.color, h.intensity * .4), outline: 1.2, outlineColor: INK });
      }
      setPieces(false);

      // Streamers flutter down either side of the stage through the choruses.
      if (lift > .02 && !reduce) {
        const gold = [], tint = [];
        for (let j = 0; j < 14; j++) {
          const sgn = j % 2 ? 1 : -1, period = 4.8 + hash(j * 3.1 + 1) * 1.8, start = hash(j * 5.7 + 2) * period;
          const cycle = Math.floor((t + start) / period), age = t + start - cycle * period;
          if (age > 4.3) continue;
          const x0 = sgn * (3.6 + hash(j * 7.3 + cycle * 1.7) * 5), z0 = -1.6 + hash(j * 2.2 + cycle * 3.1) * 5, pts = [];
          for (let k = 0; k < 16; k++) {
            const a = age - k * .06, curl = a * 3.2 + k * .5 + j;
            pts.push([x0 + Math.cos(curl) * .2 + Math.sin(a * .8 + j) * .45, 11.6 - a * 2.6, z0 + Math.sin(curl) * .2]);
          }
          const width = .15 * lift * clamp((4.3 - age) / .5);
          (j % 3 ? gold : tint).push(K.ribbon(pts, u => width * (1 - u * .3), [0, 0, 1], 5));
        }
        const flat = list => K.merge(list.map(g => ({ g, m: K.ident() })));
        if (gold.length) r.drawDynamic(flat(gold), K.ident(), { color: [1, .8, .4], shade: [.7, .4, .25], emit: [.12, .08, .02], spec: .9, rim: .6, rimColor: look.rim });
        if (tint.length) r.drawDynamic(flat(tint), K.ident(), { color: look.secondary, shade: scalec(look.secondary, .5), emit: scalec(look.secondary, .15), spec: .9, rim: .6, rimColor: [1, 1, 1] });
      }

      // Light: beams, lasers and the follow spot.
      for (const h of heads) if (h.intensity > .01) r.beam(h.apex, h.dir, 14, 1.25, h.color, h.intensity * (.22 + lift * .3));
      // Two moving heads on each tower fan their beams up over the audience.
      for (const tw of TOWERS) for (let j = 0; j < 2; j++) {
        const swing = reduce ? 0 : Math.sin(beatPos * Math.PI / 4 + j * 1.7 + tw.sgn);
        const dir = v3.norm([-tw.sgn * (.3 + .25 * j + .2 * swing), .35 + .3 * j + .12 * Math.cos(beatPos * Math.PI / 8 + j), .55]);
        r.beam([tw.x, tw.h + .7, tw.z], dir, 24, 1.5, j ? look.secondary : look.primary, (.12 + lift * .2) * stageOn * ([3, 4].includes(ph) ? .4 : 1));
      }
      r.beam(followApex, followDir, followDist + 2, (followDist + 2) * Math.tan(Math.atan(.85 / followDist)), followColor, .085 * followOn);
      if (env.lasers) {
        for (let k = 0; k < 12; k++) {
          const apex = [-9 + k * 1.64, 1.6 + (k % 3) * 1.4, -8];
          const b = reduce ? 0 : Math.floor(beatPos);
          const sweep = Math.sin(t * 2.2 + k * .7 + b * 1.3) * .5;
          const dirL = v3.norm([sweep + (k - 5.5) * .05, -.04 + Math.cos(t * 1.7 + k) * .08, 1]);
          r.beam(apex, dirL, 48, .05, look.primary, .9);
        }
      }

      // Points: penlights, bulbs, sconces, confetti, petals, fireworks and sparkles.
      for (const b of Object.values(B)) b.reset();
      const house = look.house * (ph === 0 ? .55 + env.curtain * .45 : 1);
      const raise = .15 + lift * .3;
      for (const seat of G.seats) {
        const wave = reduce ? Math.sin(t * .8 + seat.phase * 6) * .05 : Math.sin(beatPos * Math.PI + seat.phase * .5) * (.18 + lift * .14);
        const p = [seat.x + wave, seat.y + .48 + raise, seat.z];
        const col = ph === 9 ? [look.primary, look.secondary, look.accent][seat.row % 3] : look.pen;
        B.disc.push(p, mixc(col, [1, 1, 1], .35), house * .95, .1);
        B.glow.push(p, col, house * (.35 + pulse * .25 * lift), .55);
      }
      G.bulbs.forEach((b, k) => {
        const chase = reduce ? .7 : ((k + Math.floor(beatPos * 2)) % 3 === 0 ? 1 : .45);
        B.glow.push(b, [1, .8, .48], .75 * chase, .5);
        B.disc.push(b, [1, .93, .75], chase, .14);
      });
      for (const sgn of [-1, 1]) for (let k = 0; k < 8; k++) {
        B.glow.push([sgn * 20.9, 2.8, 8 + k * 4], [1, .7, .4], .5, 1.1);
        B.glow.push([sgn * 20.9, 6.6, 8 + k * 4], [1, .7, .4], .4, .9);
      }
      // Footlights along the lip of the stage, chasing on the beat in the choruses.
      for (let k = 0; k < 26; k++) {
        const chase = reduce ? .65 : lift > .3 ? ((k + Math.floor(beatPos * 2)) % 4 === 0 ? 1 : .35) : .55 + .25 * Math.sin(t * 1.5 + k * .6);
        const p = [-12 + k * .96, .07, 4.33], on = chase * (.4 + .6 * stageOn);
        B.glow.push(p, mixc(look.accent, [1, .78, .45], .5), .55 * on, .75);
        B.disc.push(p, [1, .95, .85], on, .09);
      }
      // Bulbs running up the edges of the towers.
      for (const tw of TOWERS) {
        const frame = chain(T(tw.x, 0, tw.z), RY(tw.yaw));
        for (const sx of [-1, 1]) for (let k = 0; k < 14; k++) {
          const p = apply(frame, [sx * (tw.w / 2 + .17), .5 + k * tw.h / 13, .34]);
          const chase = (reduce ? .6 : (((k - Math.floor(beatPos * 2)) % 7) + 7) % 7 === 0 ? 1 : .3) * stageOn;
          B.disc.push(p, [1, .9, .7], chase, .1);
          B.glow.push(p, look.accent, .35 * chase, .45);
        }
      }
      // Out-of-focus lights drifting at the edges of the frame, between the camera and the stage.
      const drift = reduce ? t * .2 : t, bokeh = [look.primary, look.secondary, look.accent];
      for (let k = 0; k < 40; k++) {
        const h1 = hash(k * 1.91 + 3), h2 = hash(k * 2.73 + 7), h3 = hash(k * 4.37 + 11), sgn = k % 2 ? 1 : -1;
        const p = [sgn * (3.4 + h1 * 7) + Math.sin(drift * (.11 + h2 * .1) + k) * .7, .5 + h2 * 8 + Math.sin(drift * (.09 + h3 * .08) + k * 2) * .5,
          3.2 + h3 * 7 + Math.cos(drift * .07 + k) * .5];
        B.bokeh.push(p, bokeh[k % 3], (.12 + h3 * .14) * (.8 + .4 * pulse * lift) * (.35 + .65 * stageOn), .5 + h1 * .8);
      }
      // Confetti bursts from two cannons behind the lyrics at each chorus entry.
      for (const s of tl.sections) {
        if (![2, 5, 7, 9].includes(s.phase)) continue;
        const age = t - s.start;
        if (age < 0 || age > 7) continue;
        const palette = [look.primary, look.secondary, look.accent, [1, 1, 1]];
        for (let k = 0; k < 200; k++) {
          const sgn = k % 2 ? 1 : -1, h1 = hash(k * 1.3 + s.start), h2 = hash(k * 2.7 + s.start), h3 = hash(k * 4.1 + s.start);
          const v = [-sgn * (3 + h1 * 7), 9 + h2 * 7, (h3 - .5) * 6 - 1];
          const drag = 1.7, e = (1 - Math.exp(-drag * age)) / drag;
          const flutter = Math.sin(age * (3 + h1 * 4) + k) * .35 * clamp(age - .8);
          const p = [sgn * 10 + v[0] * e + flutter, Math.max(.03, .4 + v[1] * e - 1.15 * Math.max(0, age - .4)), -2 + v[2] * e];
          B.confetti.push(p, palette[k % 4], .95 * (1 - clamp(age - 6)), .17, age * (3 + h2 * 6) + k);
        }
      }
      if (env.petals) for (let k = 0; k < 150; k++) {
        const h1 = hash(k * 3.3), h2 = hash(k * 5.9), h3 = hash(k * 8.1);
        const fall = fract(t * (.035 + h1 * .03) + h2);
        const p = [(h1 - .5) * 26 + Math.sin(t * .4 + h3 * 10) * 1.2, 13 - fall * 14, (h3 - .5) * 16 + Math.cos(t * .3 + h1 * 9) * 1];
        B.petal.push(p, mixc([1, .78, .86], [1, 1, 1], h2 * .5), .85 * clamp(fall * 6) * clamp((1 - fall) * 8), .16, t * (1 + h1 * 2) + k);
      }
      if (env.fireworks && env.roof > .2) {
        const bp = Math.floor(beatPos / 2);
        for (let b = bp - 3; b <= bp; b++) {
          const age = t - (tl.offset + b * 2 * tl.period);
          if (age < 0 || age > 2.4) continue;
          const center = [(hash(b) - .5) * 80, 30 + hash(b + 1) * 22, -55 - hash(b + 2) * 30];
          const col = [look.primary, look.secondary, look.accent, [1, .9, 1]][((b % 4) + 4) % 4];
          const reach = (10 + hash(b + 3) * 5) * (1 - Math.exp(-age * 2.4)), a = Math.pow(1 - age / 2.4, 1.5) * env.roof;
          G.sphereDirs.forEach((d, k) => {
            const p = [center[0] + d[0] * reach, center[1] + d[1] * reach - 1.8 * age * age, center[2] + d[2] * reach];
            B.glow.push(p, col, a, 1.6);
            if (k % 2 === 0) B.sparkle.push(p, mixc(col, [1, 1, 1], .5), a, 1.2, k);
          });
        }
      }
      r.points(B.glow.data, B.glow.count, 'glow', true);
      r.points(B.disc.data, B.disc.count, 'disc', true);
      r.points(B.sparkle.data, B.sparkle.count, 'sparkle', true);
      r.points(B.confetti.data, B.confetti.count, 'confetti', false);
      r.points(B.petal.data, B.petal.count, 'petal', false);
      r.points(B.bokeh.data, B.bokeh.count, 'bokeh', true);

      // The lyrics, in front of everything, then sparks thrown off each sung character.
      lettering(f.text, cam.eye, inst => textColors(inst, look));
      if (!reduce) for (const inst of f.text) {
        if (inst.role !== 'main' || inst.age < 0 || inst.age > .5) continue;
        const center = apply(inst.m, [0, PIVOT * inst.size, 0]);
        const fade = (1 - inst.age / .5) * inst.alpha;
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * TAU + inst.order;
          const dir = v3.norm(K.applyDir(inst.m, [Math.cos(a), Math.sin(a), .3]));
          const reach = (.35 + inst.age * 2.6) * inst.size;
          B.burst.push(add(center, v3.scale(dir, reach)), k % 2 ? look.accent : look.secondary, fade, .14 * inst.size / .8, a);
        }
      }
      r.points(B.burst.data, B.burst.count, 'sparkle', true);

      const focus = r.project(LYRIC_KINDS.has(f.shot.kind) ? LYRIC_ANCHOR : parts.chest);
      r.end({ ...f.post, focus: focus ? [focus[0], focus[1]] : [.5, .5] });
      const byte = c => c.map(v => Math.round(clamp(v) * 255));
      return { phase: ph, shot: f.shot.kind, lift, pulse, energy, letters: f.text.length,
        palette: { primary: byte(look.primary), secondary: byte(look.secondary), accent: byte(look.accent) } };
    }

    return Object.freeze({ draw, dispose: () => r.dispose(), lost: () => r.lost() });
  }

  return Object.freeze({ create, frameAt, timeline, planShots, danceAt, skeleton, bodyParts, shotCamera, lyricCamera, envAt, buildGeometry,
    lyricModel, layoutLine, charTimings, approxAdvance, LYRIC_ANCHOR, LOOKS, POSES, ROUTINES, STAGE_PLANS, LYRIC_PLANS });
});
