((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MesmerizerFx = api;
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';

  const TAU = 2 * Math.PI;
  const INK = '#17233a';
  const PAPER = '#fffae9';
  const palettes = {
    original: ['#48e4ed', '#fc426c', '#ffe05c', '#1c4cbd', '#ea2450'],
    stetson: ['#c6a5ff', '#ff9b70', '#fff07d', '#2547b1', '#ad2c65'],
    artsy: ['#77ecbd', '#ff5887', '#ffc649', '#2956bc', '#cf2d51']
  };
  // Per-upload chapter markers, measured against the linked videos (seconds).
  const clocks = {
    original: [3.75, 43.25, 66.5, 79.25, 97.25, 122.75, 154.5],
    stetson: [3.0, 42.25, 65.25, 78.5, 96.0, 121.5, 153.25],
    artsy: [3.75, 43.25, 66.5, 79.25, 97.25, 122.75, 154.5]
  };
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { const a = clamp(x); return a * a * (3 - 2 * a); };
  const fract = x => x - Math.floor(x);

  function chapter(variant, time) {
    const marks = clocks[variant];
    const next = marks.findIndex(mark => time < mark);
    const index = next < 0 ? marks.length : next;
    const start = marks[index - 1] ?? 0;
    return { index, elapsed: time - start, blend: ease((time - start) / .48) };
  }

  function polygon(ctx, points, color, outline = false) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
  }

  function capsule(ctx, x, y, w, h, radius, color, outline = false) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = color; ctx.fill();
    if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
  }

  function disk(ctx, x, y, r, color, outline = false) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = color; ctx.fill();
    if (outline) { ctx.strokeStyle = INK; ctx.stroke(); }
  }

  function path(ctx, points, color, width) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function spark(ctx, x, y, r, turn, color, points = 8, notch = .48) {
    polygon(ctx, Array.from({ length: points * 2 }, (_, n) => {
      const a = turn + n * Math.PI / points, d = n % 2 ? r * notch : r;
      return [x + d * Math.cos(a), y + d * Math.sin(a)];
    }), color);
  }

  function projector(ctx, x, y, size, tilt, pose, tint, other, mood, variant, side) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(size, size); ctx.rotate(tilt);
    ctx.lineWidth = 4;
    // Articulated arms surround a projector housing rather than copying the MV cast.
    for (const hand of [-1, 1]) {
      const raise = (pose * hand * side + 1) * .5;
      const wrist = [hand * (77 - 9 * raise), 23 - 64 * raise];
      const arm = [[hand * 42, 25], [hand * 65, 35 - 20 * raise], wrist];
      path(ctx, arm, INK, 15);
      path(ctx, arm, PAPER, 8);
      disk(ctx, ...wrist, 10, other, true);
    }
    ctx.lineWidth = 4;
    capsule(ctx, -28, 27, 56, 36, 10, tint, true);
    for (let n = 0; n < 4; n++) {
      path(ctx, [[-18 + n * 12, 48], [-12 + n * 12, 48]], INK, 2.6);
    }
    ctx.lineWidth = 4;
    capsule(ctx, -52, -41, 104, 82, 22, tint, true);
    capsule(ctx, -41, -29, 82, 56, 15, INK);
    for (const eye of [-1, 1]) {
      const ex = eye * 18;
      if (mood === 'off') {
        path(ctx, [[ex - 6, -4], [ex + 6, -4]], '#465069', 3);
      } else if (mood === 'loop') {
        spark(ctx, ex, -4, 10, pose, eye < 0 ? PAPER : other, 4, .29);
        disk(ctx, ex, -4, 2, INK);
      } else if (variant === 'stetson' && side < 0 && eye > 0) {
        ctx.beginPath(); ctx.moveTo(ex, 5);
        ctx.bezierCurveTo(ex - 23, -10, ex - 5, -19, ex, -10);
        ctx.bezierCurveTo(ex + 5, -19, ex + 23, -10, ex, 5);
        ctx.fillStyle = other; ctx.fill();
      } else {
        capsule(ctx, ex - 5, -12, 10, 17, 5, PAPER);
      }
    }
    if (mood !== 'off') path(ctx, [[-8, 12], [0, 15 + 2 * pose], [8, 12]], PAPER, 2.3);
    path(ctx, [[-4, -42], [-10, -58], [-30, -69]], INK, 4);
    path(ctx, [[9, -42], [16, -56], [29, -63]], INK, 4);
    ctx.lineWidth = 3;
    disk(ctx, -30, -69, 6, PAPER, true);
    disk(ctx, 29, -63, 5, other, true);
    ctx.restore();
  }

  function panel(ctx, x, y, w, h, tint, ink, travel, dim) {
    capsule(ctx, x - w / 2 + 5, y - h / 2 + 6, w, h, 9, INK);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 9); ctx.clip();
    ctx.fillStyle = dim ? '#202a41' : tint;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.globalAlpha = dim ? .20 : .29;
    for (let n = -3; n < 9; n++) {
      const top = x - w * .6 + (n + travel) * w * .21;
      polygon(ctx, [[top,y-h/2],[top+w*.075,y-h/2],[top-w*.37,y+h/2],[top-w*.445,y+h/2]], ink);
    }
    ctx.restore();
  }

  function aperture(ctx, x, y, r, rotation, accent, mode, peak) {
    ctx.save(); ctx.translate(x, y);
    disk(ctx, 0, 0, r, mode === 4 ? '#232d44' : INK);
    ctx.rotate(rotation);
    if (mode === 3) {
      polygon(ctx, [[0,-r*.71],[r*.62,0],[0,r*.71],[-r*.62,0]], accent);
      capsule(ctx, -r*.075, -r*.34, r*.15, r*.43, r*.055, INK);
      disk(ctx, 0, r*.24, r*.086, INK);
    } else if (mode === 4 || mode === 7) {
      path(ctx, [[-r*.45,0],[-r*.17,0],[-r*.05,-r*.12],[r*.07,r*.1],[r*.18,0],[r*.45,0]], accent, r*.07);
    } else {
      // Curved mechanical shutters suggest hypnosis without a flashing spiral.
      for (let n = 0; n < 10; n++) {
        ctx.rotate(TAU / 10);
        ctx.beginPath();
        ctx.moveTo(r * .19, 0);
        ctx.quadraticCurveTo(r * .51, -r * .20, r * .92, -r * .05);
        ctx.arc(0, 0, r * .921, -.054, .28);
        ctx.quadraticCurveTo(r * .55, r * (.38 + .11 * peak), r * .19, 0);
        ctx.fillStyle = n % 2 ? PAPER : accent;
        ctx.fill();
      }
      disk(ctx, 0, 0, r * .25, INK);
      spark(ctx, 0, 0, r * (.18 + .035 * peak), 0, accent, 4);
    }
    ctx.restore();
  }

  function draw(ctx, w, h, state) {
    const { variant, time, beats, pulse, bass, reducedMotion } = state;
    const [left, right, accent, blue, red] = palettes[variant];
    const { index, blend } = chapter(variant, time);
    const dim = index === 4 || index === 7;
    const finale = index === 6;
    const show = index === 0 || index === 2 || finale;
    const a = reducedMotion ? 0 : beats * Math.PI;
    const p = reducedMotion ? 0 : pulse;
    const t = reducedMotion ? 0 : time;
    const motion = reducedMotion ? 0 : blend;
    const compact = w < h * 1.1;
    const s = Math.min(w, h);
    const centerY = h * (compact ? .52 : .55);
    const backdrop = dim ? '#172034' : index === 5 ? blue : red;
    ctx.fillStyle = backdrop; ctx.fillRect(0, 0, w, h);

    // Broad marquee ribbons counter-scroll. Both wrap outside the stage.
    ctx.save();
    ctx.globalAlpha = dim ? .21 : .42;
    for (let lane = 0; lane < 2; lane++) {
      const y = h * (lane ? .69 : .27);
      polygon(ctx, [[0,y+h*.03],[w,y-h*.11],[w,y+h*.01],[0,y+h*.14]], dim ? blue : lane ? blue : PAPER);
      const travel = reducedMotion ? 0 : fract(beats * (finale ? .5 : .25) * (lane ? -1 : 1));
      for (let n = -1; n < 9; n++) {
        const x = w * (n + travel) / 7;
        path(ctx, [[x-w*.045,y+h*.075-x/w*h*.14],[x,y+h*.085-x/w*h*.14],[x+w*.045,y+h*.062-x/w*h*.14]],
          lane ? accent : INK, Math.max(1, s * .006));
      }
    }
    ctx.restore();

    // The stage rail carries a continuous chase, not a full-screen flash.
    const rail = h * (compact ? .793 : .885);
    path(ctx, [[0,rail],[w,rail]], dim ? '#2d3a59' : INK, Math.max(2, s * .012));
    for (let n = 0; n < 21; n++) {
      const alpha = reducedMotion ? .48 : .23 + .67 * ((1 + Math.cos(n * .65 - a)) * .5) ** 3;
      ctx.save();
      ctx.globalAlpha = dim ? alpha * .25 : alpha;
      const x = w * (n + 1) / 22, dash = w * .015;
      path(ctx, [[x-dash/2,rail],[x+dash/2,rail]], n % 3 ? accent : left, Math.max(1.5, s * .005));
      ctx.restore();
    }

    const shift = .029 * s * Math.sin(a);
    const pW = Math.min(w * (compact ? .32 : .267), h * .62);
    const pH = h * (compact ? .38 : .50);
    for (const side of [-1, 1]) {
      const lead = index === 1 || index === 5
        ? (Math.floor(reducedMotion ? 0 : beats / 8) % 2 ? 1 : -1) === side : true;
      const pulseY = centerY + side * shift + (reducedMotion ? 0 : (1 - motion) * s * .05 * side);
      const x = w * (.5 + side * (compact ? .275 : .302)) + side * p * s * .014;
      const tint = side < 0 ? left : right;
      panel(ctx, x, pulseY, pW, pH, tint, PAPER, fract(t * (show ? 1.22 : .48) * side), dim);
      const scale = Math.min(pW / 187, pH / 162) * (lead ? 1 : .91) * (1 + p * .035);
      const arms = Math.cos(a * 2 + (side === 1 ? Math.PI : 0));
      ctx.save();
      ctx.globalAlpha = dim ? (side < 0 ? .58 : .84) : 1;
      if (finale && !reducedMotion) {
        ctx.globalAlpha = .34 + .19 * p;
        projector(ctx, x + side * s * .023, pulseY + s * .018, scale, side * .22, -arms, accent, tint, 'loop', variant, side);
        ctx.globalAlpha = 1;
      }
      projector(ctx, x, pulseY, scale, .12 * Math.sin(a + side), arms,
        tint, side < 0 ? right : accent, dim ? 'off' : finale ? 'loop' : 'live', variant, side);
      ctx.restore();
    }
    const radius = Math.min(s * (compact ? .114 : .145), w * .119) * (1 + p * (show ? .16 : .045));
    if (finale) {
      for (let n = 0; n < 12; n++) {
        const angle = n * TAU / 12 + t * .3;
        const inner = radius * (1.33 + .2 * p), outer = radius * (1.62 + .47 * p);
        const x = Math.cos(angle), y = Math.sin(angle);
        path(ctx, [[w/2 + inner*x, centerY + inner*y], [w/2 + outer*x, centerY + outer*y]],
          n % 3 ? accent : PAPER, Math.max(1.2, s * .008));
      }
    }
    if (show && !reducedMotion) {
      for (let i = 0; i < 3; i++) {
        const age = fract((beats + i) / 3);
        ctx.save();
        ctx.globalAlpha = .55 * Math.sin(Math.PI * age);
        ctx.lineWidth = 1 + (1 - age) * 3;
        ctx.beginPath(); ctx.arc(w/2, centerY, radius * (1.05 + age * (.95 + .3 * bass)), 0, TAU);
        ctx.strokeStyle = accent; ctx.stroke(); ctx.restore();
      }
    }
    const turn = index === 3 ? .15 * Math.sin(t * 2) : dim ? 0 : t * (finale ? 1.2 : .45);
    aperture(ctx, w/2, centerY, radius, turn, accent, index, p);

    // A fixed contrast shelf keeps the existing app metadata readable.
    const top = ctx.createLinearGradient(0, 0, 0, h * .33);
    top.addColorStop(0, 'rgba(18,26,45,.98)');
    top.addColorStop(.46, 'rgba(18,26,45,.82)');
    top.addColorStop(1, 'rgba(18,26,45,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, w, h * .33);
  }

  return Object.freeze({ draw, chapter });
});
