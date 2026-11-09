((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HuntersFx = api;
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { const q = clamp(x); return q * q * (3 - 2 * q); };
  const mix = (a, b, x) => a + (b - a) * x;
  const rgb = (color, alpha) => `rgba(${color.join(',')},${clamp(alpha)})`;

  function cueAt(sections, time) {
    return sections.reduce((lift, { start, end, strength }) => Math.max(lift,
      strength * smooth((time - start + .35) / .85) * smooth((end + .6 - time) / 1.15)), 0);
  }

  function fill(ctx, color, points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function stroke(ctx, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function field(ctx, w, h, upper, horizon, ground) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, upper);
    gradient.addColorStop(.7, horizon);
    gradient.addColorStop(1, ground);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function diamond(ctx, x, y, w, h, color, width) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    stroke(ctx, color, width);
  }

  function drawGolden(ctx, w, h, { t, phase, lift, pulse, bass }) {
    const s = Math.min(w, h);
    const gold = [255, 205, 101], pearl = [255, 239, 191], rose = [227, 103, 140];
    const yStage = h * (.76 - lift * .055);
    field(ctx, w, h, '#150f23', '#281827', '#140f18');

    // Wide moving spotlights frame the lyrics; light is strongest at the edges.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const origin = w * (.5 + side * (.38 + i * .05));
        const target = w * (.5 + side * (.36 - i * .13 + .06 * Math.sin(t * .8 + i)));
        const span = w * (.025 + .042 * lift + i * .01);
        const ray = ctx.createLinearGradient(origin, h, target, -h * .16);
        const tint = i === 2 ? rose : gold;
        ray.addColorStop(0, rgb(tint, .23 + lift * .27 + pulse * .11));
        ray.addColorStop(.65, rgb(tint, .06 + lift * .12));
        ray.addColorStop(1, rgb(tint, 0));
        fill(ctx, ray, [[origin, h], [target - span, -h * .16], [target + span, -h * .16]]);
      }
      // Two overlapping light passes climb the wings and fade before recycling.
      for (let echo = 0; echo < 2; echo++) {
        const age = (phase + echo) / 2;
        const y = h * (1.04 - age * 1.17);
        const x = w * (.5 + side * (.39 - age * .17));
        const span = w * (.04 + age * .12);
        fill(ctx, rgb(echo ? rose : pearl, lift * Math.sin(age * Math.PI) * .19),
          [[x - span, y + h * .055], [x + span, y - h * .035],
            [x + span, y - h * .012], [x - span, y + h * .08]]);
      }
    }

    // Three ascending emblems and a fan of faceted gold outlines.
    for (let i = 0; i < 3; i++) {
      const x = w * (.5 + (i - 1) * (.105 + .025 * lift));
      const y = h * (.247 - lift * .075 + (i === 1 ? -.036 : .024)
        + .018 * Math.sin(t * 1.9 - i * .6) - pulse * .013);
      const size = s * (.026 + .028 * lift + .009 * pulse);
      for (let echo = 2; echo >= 1; echo--) {
        const d = echo * s * (.019 + .017 * lift);
        diamond(ctx, x, y + d, size * (1 + echo * .19), size * (1.5 + echo * .17),
          rgb(gold, (.26 + .28 * lift) / echo), 1);
      }
      fill(ctx, rgb(gold, .15 + lift * .16), [[x, y - size * 1.5], [x + size, y], [x, y + size * 1.5]]);
      diamond(ctx, x, y, size, size * 1.5, rgb(pearl, .78 + pulse * .2), Math.max(1, s * .003));
      ctx.beginPath();
      ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
      stroke(ctx, rgb(pearl, .44 + .36 * lift), 1);
    }
    for (let i = 0; i < 7; i++) {
      const spread = (i - 3) / 3;
      const y = h * (.15 - lift * .045);
      ctx.beginPath();
      ctx.moveTo(w * (.5 + spread * .055), y + Math.abs(spread) * h * .07);
      ctx.lineTo(w * (.5 + spread * (.25 + lift * .12)), y - h * (.15 + lift * .12));
      stroke(ctx, rgb(gold, .14 + lift * .19 + pulse * .15), 1 + lift);
    }

    const deck = ctx.createLinearGradient(0, yStage, 0, h);
    deck.addColorStop(0, rgb(rose, .13 + .17 * lift));
    deck.addColorStop(1, '#110c17');
    ctx.fillStyle = deck;
    ctx.fillRect(0, yStage, w, h - yStage);
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (.5 + i * .034), yStage);
      ctx.lineTo(w * (.5 + i * .17), h);
      stroke(ctx, rgb(i % 2 ? gold : rose, .26 + lift * .22), 1.15);
    }
    for (let i = 0; i < 8; i++) {
      const p = ((i + phase * .98) / 8) ** 1.65;
      const y = mix(yStage, h, p);
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      stroke(ctx, rgb(i % 2 ? gold : rose, .1 + .36 * lift + .14 * pulse + p * bass * .19), 1 + p * 1.5);
    }
    ctx.beginPath();
    ctx.moveTo(0, yStage); ctx.lineTo(w, yStage);
    stroke(ctx, rgb(pearl, .36 + .47 * lift + pulse * .13), 1 + lift * 2);
  }

  function drawFree(ctx, w, h, { t, phase, lift, pulse, bass, progress }) {
    const s = Math.min(w, h);
    const sea = [104, 227, 208], orchid = [237, 156, 185], white = [205, 249, 241];
    const opening = .14 + .35 * lift + .2 * progress;
    const horizon = h * (.73 - lift * .09);
    field(ctx, w, h, '#101822', '#203039', '#101b23');

    // Two different voices enter from opposite sides and leave a shared opening.
    for (const side of [-1, 1]) {
      const color = side < 0 ? sea : orchid;
      const sweep = Math.sin(t * .66 + (side < 0 ? .8 : -.8));
      const wing = ctx.createLinearGradient(w * (.5 + side * .45), h * .8, w * .5, h * .19);
      wing.addColorStop(0, rgb(color, .12 + .2 * lift + .09 * pulse));
      wing.addColorStop(.75, rgb(color, .025 + .05 * lift));
      wing.addColorStop(1, rgb(color, 0));
      ctx.beginPath();
      ctx.moveTo(w * (.5 + side * .59), h * .91);
      ctx.bezierCurveTo(w * (.5 + side * .2), h * .58,
        w * (.5 + side * .28), h * (.19 + sweep * .09), w * .5, h * .14);
      ctx.bezierCurveTo(w * (.5 + side * .38), h * (.16 + sweep * .09),
        w * (.5 + side * .31), h * .62, w * (.5 + side * .65), h * .97);
      ctx.closePath();
      ctx.fillStyle = wing; ctx.fill();
      for (let i = 6; i >= 0; i--) {
        const age = i * .105;
        const bend = Math.sin((t - age) * .66 + (side < 0 ? .8 : -.8));
        const spread = w * (.18 + opening * .25 + i * .022);
        const outer = w * .5 + side * spread;
        const inner = w * .5 + side * w * (.07 + opening * .17 + i * .012);
        const y = h * (.24 - opening * .16 + bend * .045 + i * .012);
        ctx.beginPath();
        ctx.moveTo(outer + side * w * .37, h * (.97 - i * .025));
        ctx.bezierCurveTo(outer - side * w * .23, h * .69,
          inner + side * w * .08, h * .2 + bend * h * .16, inner, y);
        const join = h * (.138 - .078 * lift + i * .014 + .012 * Math.sin((t - age) * .66));
        ctx.bezierCurveTo(inner - side * w * .055, join + h * .02,
          w * .5 + side * w * (.04 + i * .017), join, w * (.5 + side * .035 * (1 - lift)), join);
        stroke(ctx, rgb(color, (.46 + lift * .44 + pulse * .14) / (1 + i * .29)),
          Math.max(.8, s * (.0045 - i * .0005)));
      }
    }

    // The lower reflection carries the beat without moving or blurring the text.
    for (let i = 0; i < 10; i++) {
      const p = (i + phase * .97) / 10;
      const y = horizon + p * p * h * .39;
      const depth = (i + 1) / 10;
      const wave = h * (.013 + opening * .043) * (1 + .45 * bass) * depth;
      ctx.beginPath();
      for (let j = 0; j <= 44; j++) {
        const x = j / 44;
        const ripple = Math.sin(x * TAU * 1.55 + t * 1.12 + i * .25) * wave;
        if (j) ctx.lineTo(x * w, y + ripple);
        else ctx.moveTo(x * w, y + ripple);
      }
      stroke(ctx, rgb(i % 3 === 0 ? orchid : sea, .16 + depth * .12 + lift * .26 + pulse * .1), 1 + depth);
    }

    const rise = h * (.115 + lift * .03);
    const span = s * (.035 + opening * .09);
    const y = rise + h * .018 * Math.sin(t * .72) - h * .012 * pulse;
    ctx.beginPath();
    ctx.moveTo(w * .5 - span * 1.5, y + span * .36);
    ctx.quadraticCurveTo(w * .5 - span * .54, y - span * .24, w * .5, y);
    ctx.quadraticCurveTo(w * .5 + span * .54, y - span * .24, w * .5 + span * 1.5, y + span * .36);
    stroke(ctx, rgb(white, .44 + lift * .42), Math.max(1, s * .004));
  }

  function draw(theme, ctx, w, h, state) {
    const { time, sections, reducedMotion, pulse, bass, phase, duration } = state;
    const frame = {
      t: reducedMotion ? 0 : time,
      phase: reducedMotion ? 0 : phase,
      lift: cueAt(sections, time),
      pulse: reducedMotion ? 0 : pulse,
      bass: reducedMotion ? 0 : bass,
      progress: smooth(time / duration)
    };
    if (theme === 'hunters-golden') drawGolden(ctx, w, h, frame);
    else drawFree(ctx, w, h, frame);
  }

  return Object.freeze({ draw, cueAt });
});
