(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OverrideFx = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const PAPER = '#ffeb8b', RED = '#e74662', INK = '#28262b', WHITE = '#fff9e6';
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  const mix = (a, b, t) => a + (b - a) * t;
  const rgba = (rgb, alpha) => `rgba(${rgb},${clamp(alpha)})`;
  const scenes = Object.freeze([
    { start: 0, end: 12.1, key: 'overture' },
    { start: 12.1, end: 31.3, key: 'badlands' },
    { start: 31.3, end: 40, key: 'crossroads' },
    { start: 40, end: 59.7, key: 'override', chorus: true },
    { start: 59.7, end: 68, key: 'reversal' },
    { start: 68, end: 85.2, key: 'lottery' },
    { start: 85.2, end: 89.45, key: 'escape' },
    { start: 89.45, end: 108.9, key: 'rewrite', chorus: true },
    { start: 108.9, end: 117.9, key: 'reversal' },
    { start: 117.9, end: 127.8, key: 'code' },
    { start: 127.8, end: 138.5, key: 'coda' }
  ]);

  function stateAt(input) {
    const time = Math.max(0, Number(input.time) || 0);
    const reduced = !!input.reducedMotion;
    const scene = scenes.find(s => time >= s.start && time < s.end) || scenes.at(-1);
    const beats = Math.max(0, (time - .046) * 204 / 60);
    const alive = time < 138.4954;
    const lift = scene.chorus ? Math.min(ease((time - scene.start) / .3), ease((scene.end - time) / .3)) : 0;
    return { ...scene, time, t: reduced ? 0 : Math.min(time, 138.4954),
      beat: reduced ? 0 : beats, lift,
      energy: reduced ? .5 : clamp(Number(input.energy) || 0),
      pulse: reduced || !alive ? 0 : Math.exp(-(beats % 2) * 3.4),
      reduced, alive };
  }

  function polygon(c, points, fill, stroke, width = 1) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function line(c, points, color, width) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function circle(c, x, y, r, color, stroke, width = 1) {
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); c.fillStyle = color; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function print(c, text, x, y, size, color, align = 'left') {
    c.font = `900 ${Math.max(8, size)}px system-ui, sans-serif`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(text, x, y);
  }

  function city(c, w, h, s) {
    const unit = w / 13, travel = (s.t * w * .023) % (unit * 2);
    for (let i = -2; i < 16; i++) {
      const x = i * unit - travel;
      const roof = h * (.59 + ((i + 20) % 4) * .045);
      const skew = Math.sin(s.t * .65 + i) * unit * .06;
      polygon(c, [[x, h], [x + skew, roof], [x + unit * .79, roof - h * .03], [x + unit * .91, h]], INK);
      for (let j = 0; j < 3; j++) {
        c.fillStyle = j % 2 ? RED : PAPER;
        c.fillRect(x + unit * .17, roof + h * (.06 + j * .055), unit * .28, h * .012);
      }
    }
    for (let i = 0; i < 7; i++) {
      const x = ((i / 6 + s.t * .035) % 1.3 - .15) * w;
      line(c, [[x, h * .87], [x + w * .2, h * .87]], rgba('255,249,230', .3), h * .003);
    }
  }

  function chess(c, x, y, size, rotation, alpha = 1) {
    c.save(); c.translate(x, y); c.rotate(rotation); c.globalAlpha = alpha;
    polygon(c, [[-size * .37, size * .6], [-size * .31, size * .38], [-size * .17, size * .27],
      [-size * .11, -size * .12], [-size * .27, -size * .18], [-size * .31, -size * .42],
      [-size * .13, -size * .3], [0, -size * .5], [size * .13, -size * .3],
      [size * .31, -size * .42], [size * .27, -size * .18], [size * .11, -size * .12],
      [size * .17, size * .27], [size * .31, size * .38], [size * .37, size * .6]], PAPER, INK, size * .025);
    line(c, [[-size * .3, size * .4], [size * .3, size * .4]], RED, size * .045);
    line(c, [[-size * .19, -size * .13], [size * .19, -size * .13]], RED, size * .045);
    circle(c, 0, -size * .04, size * .045, RED);
    c.restore();
  }

  function lottery(c, x, y, size, s) {
    c.save(); c.translate(x, y); c.rotate(-.1 + Math.sin(s.t * .8) * .045);
    c.fillStyle = INK; c.fillRect(-size * .42, -size * .6, size * .84, size * 1.2);
    c.fillStyle = RED; c.fillRect(-size * .35, -size * .53, size * .7, size * .68);
    c.fillStyle = PAPER; c.fillRect(-size * .3, -size * .48, size * .6, size * .56);
    for (let i = 0; i < 6; i++) {
      const a = s.t * .8 + i * TAU / 6;
      circle(c, Math.cos(a) * size * .17, -size * .2 + Math.sin(a) * size * .12,
        size * .075, i % 2 ? RED : INK, WHITE, size * .008);
    }
    circle(c, 0, size * .3, size * .1, PAPER, WHITE, size * .01);
    c.save(); c.translate(0, size * .3); c.rotate(s.beat * Math.PI / 8);
    c.fillStyle = INK; c.fillRect(-size * .07, -size * .025, size * .14, size * .05); c.restore();
    c.fillStyle = PAPER; c.fillRect(-size * .2, size * .49, size * .4, size * .06);
    c.restore();
  }

  function drill(c, x, y, size, flip, s) {
    c.save(); c.translate(x, y); c.scale(flip, 1); c.rotate(Math.sin(s.t * 1.2) * .07);
    for (let i = 0; i < 4; i++) {
      const r = size * (.44 - i * .075), cy = i * size * .23;
      c.beginPath(); c.ellipse(0, cy, r, size * .19, -.25, 0, TAU);
      c.fillStyle = RED; c.fill(); c.strokeStyle = INK; c.lineWidth = size * .018; c.stroke();
      c.beginPath(); c.ellipse(-size * .025, cy - size * .045, r * .8, size * .06, -.25, .4, 3.8);
      c.strokeStyle = PAPER; c.lineWidth = size * .025; c.stroke();
    }
    c.restore();
  }

  function speedLines(c, w, h, s) {
    if (s.reduced) return;
    for (let i = 0; i < 12; i++) {
      const q = (s.beat * .105 + i / 12) % 1;
      const y = (i < 6 ? .08 + i * .032 : .74 + (i - 6) * .032) * h;
      const x = (q * 1.5 - .35) * w;
      const length = w * (.06 + s.lift * .14);
      line(c, [[x - length, y + h * .025], [x, y]], rgba('40,38,43', .13 + s.lift * .23), h * .003);
      line(c, [[x - length * .9, y + h * .035], [x - length * .16, y + h * .014]],
        rgba('255,249,230', .35), h * .002);
    }
  }

  function chorus(c, w, h, s) {
    const size = Math.min(w, h), swing = Math.sin(s.beat * Math.PI / 8);
    // Each wave has a fixed birth and lifespan, so new beats never retract old waves.
    if (!s.reduced) for (let i = 0; i < 4; i++) {
      const birth = Math.floor(s.beat / 2) * 2 - i * 2;
      if (birth < 0 || !s.alive) continue;
      const age = (s.beat - birth) / 8;
      const r = size * .1 + age * Math.max(w, h) * 1.1;
      c.beginPath(); c.ellipse(w * .5, h * .5, r, r * .65, -.2, 0, TAU);
      c.strokeStyle = rgba('231,70,98', (1 - age) ** 2 * (.1 + s.energy * .14)); c.lineWidth = size * .025; c.stroke();
      c.beginPath(); c.ellipse(w * .5, h * .5, r + size * .025, r * .65, -.2, 0, TAU);
      c.strokeStyle = rgba('40,38,43', (1 - age) ** 2 * .18); c.lineWidth = size * .003; c.stroke();
    }
    const px = w * .1, py = h * .27 + swing * h * .035;
    for (let i = 3; i > 0; i--) chess(c, px - i * w * .016, py + i * h * .02, size * .38,
      -.5 + swing * .16, .08 + (3 - i) * .025);
    chess(c, px, py, size * .38, -.5 + swing * .16);
    drill(c, w * .89, h * .19 + Math.sin(s.beat * Math.PI / 4) * h * .02, size * .22, 1, s);
    drill(c, w * .12, h * .72, size * .2, -1, s);
    const travel = (s.beat % 8) / 8;
    if (!s.reduced) {
      const x = mix(-w * .5, w * 1.5, ease(travel));
      for (let i = 3; i >= 0; i--) polygon(c, [[x - w * .18 - i * 12, 0], [x - i * 12, 0],
        [x - w * .3 - i * 12, h], [x - w * .48 - i * 12, h]],
      rgba(i ? '40,38,43' : '231,70,98', Math.sin(travel * Math.PI) * (i ? .05 : .13)));
    }
  }

  function codeRoll(c, w, h, s) {
    for (let row = 0; row < 3; row++) {
      c.save(); c.translate(w * .5, h * (.15 + row * .35)); c.rotate(row % 2 ? .08 : -.07);
      c.fillStyle = row % 2 ? RED : INK; c.fillRect(-w, -h * .055, w * 2, h * .11);
      const x = -(s.t * 48 + row * 90) % (w * .8);
      for (let i = -1; i < 3; i++) print(c, row === 1 ? 'return self;  > override();' : '{ ERROR: HUMAN EXPECTATIONS }',
        x + i * w * .8, 0, Math.min(28, h * .044), PAPER);
      c.restore();
    }
  }

  function draw(c, w, h, input) {
    if (!(w > 0 && h > 0)) return;
    const s = stateAt(input), unit = Math.min(w, h);
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.globalCompositeOperation = 'source-over';
    c.fillStyle = PAPER; c.fillRect(0, 0, w, h);
    // A slow exposure shift adds energy without a full-frame 204-BPM strobe.
    c.fillStyle = rgba('231,70,98', s.lift * (.025 + s.pulse * s.energy * .065)); c.fillRect(0, 0, w, h);
    const sway = Math.sin(s.beat * Math.PI / 16) * w * .025;
    polygon(c, [[w * .73 + sway, 0], [w, 0], [w, h], [w * .91 + sway, h]], RED);
    polygon(c, [[0, 0], [w * .04, 0], [w * .23 + sway, h], [0, h]], INK);
    // Halftone belongs to the printing motif, not a floating particle system.
    for (let x = 0; x < 9; x++) for (let y = 0; y < 4; y++)
      circle(c, w * (.74 + x * .026), h * (.06 + y * .036), unit * .003, rgba('40,38,43', .22));
    const lettering = s.key === 'code' || s.key === 'coda' ? 'REWRITE' : 'OVERRIDE';
    c.save(); c.translate(w * .52 + sway, h * .16); c.rotate(-.035);
    print(c, lettering, 0, h * .01, Math.min(w * .13, h * .22), rgba('40,38,43', .13), 'center'); c.restore();
    if (['badlands', 'overture', 'crossroads', 'escape'].includes(s.key)) {
      city(c, w, h, s);
      chess(c, w * .86, h * .48, unit * .37, -.2 + Math.sin(s.t) * .06);
      if (s.key === 'crossroads' || s.key === 'escape') {
        const dx = Math.sin(s.beat * Math.PI / 8) * w * .035;
        polygon(c, [[w * .72 + dx, h * .22], [w * .88 + dx, h * .22], [w * .88 + dx, h * .15],
          [w * .97 + dx, h * .27], [w * .88 + dx, h * .39], [w * .88 + dx, h * .32], [w * .72 + dx, h * .32]], RED, INK, 2);
      }
    } else if (s.key === 'lottery') {
      lottery(c, w * .86, h * .46, unit * .44, s);
      chess(c, w * .15, h * .77, unit * .28, 1.3 + Math.sin(s.t) * .08);
      city(c, w, h, { ...s, t: s.t * .5 });
    } else if (s.chorus) chorus(c, w, h, s);
    else if (s.key === 'code') codeRoll(c, w, h, s);
    else {
      const a = s.reduced ? -.3 : Math.sin(s.beat * Math.PI / 16) * .4;
      chess(c, w * .2, h * .45, unit * .52, a - .8);
      drill(c, w * .82, h * .24, unit * .28, 1, s);
      for (let i = 0; i < 5; i++) {
        const y = h * (.73 + i * .046);
        line(c, [[w * .25, y], [w * .85 + Math.sin(s.t + i) * w * .04, y - h * .1]], RED, unit * .012);
      }
    }
    speedLines(c, w, h, s);
    if (!s.reduced && s.start > 0 && s.time - s.start < .65) {
      const travel = ease((s.time - s.start) / .65);
      const x = mix(-w * .55, w * 1.55, travel);
      for (let i = 3; i >= 0; i--) {
        polygon(c, [[x - w * .4 - i * 18, 0], [x - i * 18, 0],
          [x - w * .26 - i * 18, h], [x - w * .66 - i * 18, h]],
        rgba(i ? '40,38,43' : '231,70,98', Math.sin(travel * Math.PI) * (i ? .12 : .7)));
      }
    }
    // Full-width paper wash protects the words without framing them in a box.
    const wash = c.createLinearGradient(0, h * .22, 0, h * .8);
    wash.addColorStop(0, 'rgba(255,235,139,0)'); wash.addColorStop(.25, 'rgba(255,235,139,.72)');
    wash.addColorStop(.65, 'rgba(255,235,139,.72)'); wash.addColorStop(1, 'rgba(255,235,139,0)');
    c.fillStyle = wash; c.fillRect(0, h * .22, w, h * .58);
    if (s.chorus) {
      // A solid typographic strike lands outside the lyric band on each two-bar turn.
      c.save(); c.translate(w * .52 + Math.sin(s.beat * Math.PI / 8) * w * .025, h * .82); c.rotate(-.08);
      c.strokeStyle = INK; c.lineWidth = unit * .006;
      c.strokeRect(-w * .23, -h * .055, w * .46, h * .11);
      print(c, 'OVERRIDE', 0, 0, Math.min(w * .064, h * .09), INK, 'center'); c.restore();
    }
    line(c, [[w * .035, h * .93], [w * .965, h * .93]], INK, unit * .003);
    const ticker = (s.beat % 16) / 16;
    c.fillStyle = RED; c.fillRect(w * .035, h * .93, w * .93 * ticker, unit * .009);
    c.restore();
  }
  return Object.freeze({ draw, stateAt, scenes });
});
