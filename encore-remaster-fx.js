(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EncoreRemasterFx = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const mix = (a, b, x) => a + (b - a) * x;
  const color = (rgb, alpha = 1) => `rgba(${rgb.map(Math.round).join(',')},${clamp(alpha)})`;
  const palettes = [
    { bg: [29, 13, 29], primary: [248, 73, 113], secondary: [87, 211, 205], accent: [255, 230, 219] },
    { bg: [38, 12, 31], primary: [244, 77, 117], secondary: [106, 202, 205], accent: [255, 224, 217] },
    { bg: [109, 17, 46], primary: [255, 93, 131], secondary: [255, 179, 105], accent: [255, 240, 232] },
    { bg: [19, 23, 43], primary: [239, 112, 149], secondary: [103, 205, 210], accent: [230, 245, 244] },
    { bg: [24, 19, 43], primary: [255, 97, 145], secondary: [104, 215, 211], accent: [231, 242, 247] },
    { bg: [108, 18, 48], primary: [255, 104, 151], secondary: [255, 177, 102], accent: [255, 239, 232] },
    { bg: [39, 12, 32], primary: [255, 74, 127], secondary: [93, 224, 210], accent: [255, 231, 225] },
    { bg: [92, 18, 43], primary: [255, 111, 135], secondary: [255, 184, 112], accent: [255, 241, 231] },
    { bg: [92, 18, 43], primary: [255, 111, 135], secondary: [255, 184, 112], accent: [255, 241, 231] },
    { bg: [98, 18, 48], primary: [255, 123, 156], secondary: [114, 224, 205], accent: [255, 243, 235] },
    { bg: [53, 17, 36], primary: [244, 109, 141], secondary: [120, 207, 197], accent: [255, 230, 219] }
  ];

  function stateAt(input) {
    const duration = Number.isFinite(input.duration) ? Math.max(0, input.duration) : 137.23;
    const time = clamp(Number.isFinite(input.time) ? input.time : 0, 0, duration);
    const sections = input.sections || [];
    const found = sections.findIndex(section => time >= section.start && time < section.end);
    const afterLast = sections.length && time >= sections[sections.length - 1].end;
    const index = found >= 0 ? found : afterLast || time >= duration ? Math.max(0, sections.length - 1) : 0;
    const section = sections[index] || {};
    const phase = clamp(section.phase || 0, 0, palettes.length - 1);
    const reduce = !!input.reducedMotion;
    const blend = reduce ? 1 : ease((time - (section.start || 0)) / .85);
    const before = palettes[sections[Math.max(0, index - 1)]?.phase || 0] || palettes[0];
    const target = palettes[phase];
    const palette = Object.fromEntries(Object.keys(target).map(key => [key,
      target[key].map((value, i) => mix(before[key][i], value, blend))]));
    // Adjacent chorus subsections form one sustained lift, including "amends".
    let lift = 0;
    const choruses = [];
    for (const item of sections) {
      if (!item.chorus) continue;
      const previous = choruses[choruses.length - 1];
      if (previous && item.start <= previous.end + .001) previous.end = Math.max(previous.end, item.end);
      else choruses.push({ start: item.start, end: item.end });
    }
    for (const item of choruses) {
      lift += ease((time - item.start + .25) / .5) * (1 - ease((time - item.end + .35) / .7));
    }
    lift = clamp(lift);
    const period = 60 / Math.max(30, input.bpm || 132);
    const position = Math.max(0, (time - (input.beatOffset || 0)) / period);
    const fraction = position % 1;
    return { time, duration, phase, palette, lift, reduce, period,
      motionTime: reduce ? 0 : time,
      position: reduce ? 0 : position,
      energy: reduce ? .3 : clamp(input.energy || 0),
      pulse: reduce || time >= duration ? 0 : Math.pow(1 - fraction, 4.5),
      instrumental: phase === 0 || phase === 3 || phase === 6,
      beatOffset: input.beatOffset || 0 };
  }

  function echoesAt(state) {
    if (state.reduce || state.time >= state.duration) return [];
    const latest = Math.floor(state.position);
    const echoes = [];
    for (let n = Math.max(0, latest - 3); n <= latest; n++) {
      const age = state.time - state.beatOffset - n * state.period;
      if (age < 0 || age >= 1.45) continue;
      const progress = age / 1.45;
      echoes.push({ index: n, progress, radius: .035 + .94 * progress,
        opacity: ease(age / .07) * (1 - ease((progress - .28) / .72)) });
    }
    return echoes;
  }

  function star(ctx, x, y, radius, angle, rgb, alpha, lineWidth) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 - Math.PI / 2;
      const r = radius * (i % 2 ? .24 : 1);
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.strokeStyle = color(rgb, alpha); ctx.lineWidth = lineWidth; ctx.stroke();
    ctx.restore();
  }

  function draw(ctx, width, height, input) {
    if (!(width > 0 && height > 0)) return null;
    const s = stateAt(input), p = s.palette, t = s.motionTime;
    const unit = Math.max(.65, Math.min(width / 1100, height / 650));
    const lift = s.lift, energy = s.energy;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, color(p.bg));
    base.addColorStop(.58, color(p.bg.map((v, i) => v + (i === 0 ? 24 : 3))));
    base.addColorStop(1, color([17, 16, 30]));
    ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);

    // A tangible proscenium and pleated drapes frame the stage, not the text.
    const curtain = width * (.105 - lift * .045);
    for (let side = 0; side < 2; side++) {
      ctx.save();
      if (side) { ctx.translate(width, 0); ctx.scale(-1, 1); }
      const velvet = ctx.createLinearGradient(0, 0, curtain * 1.8, 0);
      velvet.addColorStop(0, color([35, 5, 22], .96));
      velvet.addColorStop(.55, color(p.primary, .35));
      velvet.addColorStop(1, color(p.primary, 0));
      ctx.fillStyle = velvet;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(curtain * 2.2, 0);
      ctx.bezierCurveTo(curtain * .8, height * .2, curtain * 1.6, height * .62, curtain, height);
      ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
      for (let fold = 0; fold < 5; fold++) {
        const x = curtain * (.15 + fold * .22);
        ctx.beginPath(); ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x * .6, height * .3, x * 1.4, height * .6, x * .8, height);
        ctx.strokeStyle = color(p.primary, .12); ctx.lineWidth = unit * 1.5; ctx.stroke();
      }
      ctx.restore();
    }
    for (let arch = 0; arch < 3; arch++) {
      ctx.beginPath();
      ctx.ellipse(width * .5, height * .58, width * (.56 + arch * .035), height * (.55 + arch * .04), 0, Math.PI, TAU);
      ctx.strokeStyle = color(arch % 2 ? p.secondary : p.accent, .13 + lift * .12);
      ctx.lineWidth = unit * (arch ? 1.4 : 4); ctx.stroke();
    }

    const night = s.phase === 1 || s.phase === 3 || s.phase === 4;
    if (night) {
      // Sleeping streets, a reflected moon, and open water echo the verses.
      for (let i = 0; i < 13; i++) {
        const x = width * (i / 12 - .03);
        const h = height * (.08 + (Math.sin(i * 17.4) + 1) * .027);
        ctx.fillStyle = color([10, 15, 31], .55);
        ctx.fillRect(x, height * .75 - h, width * .055, h);
        ctx.fillStyle = color(p.secondary, .28);
        for (let row = 0; row < 3; row++) ctx.fillRect(x + width * .018, height * .75 - h + row * height * .025, unit * 5, unit * 2);
      }
      const mx = width * .82, my = height * .24, radius = Math.min(width, height) * .09;
      ctx.beginPath(); ctx.arc(mx, my, radius, 0, TAU);
      ctx.fillStyle = color(p.accent, .74); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + radius * .32, my - radius * .13, radius * .89, 0, TAU);
      ctx.fillStyle = color(p.bg); ctx.fill();
      for (let row = 0; row < 7; row++) {
        const x = mx + Math.sin(t * .6 + row) * width * .012;
        ctx.beginPath(); ctx.moveTo(x - radius * (.8 + row * .2), height * (.78 + row * .022));
        ctx.lineTo(x + radius * (.8 + row * .2), height * (.78 + row * .022));
        ctx.strokeStyle = color(p.secondary, .12 - row * .01); ctx.lineWidth = unit * 2; ctx.stroke();
      }
    }

    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const beamCount = 3;
    for (let side = 0; side < 2; side++) for (let i = 0; i < beamCount; i++) {
      const ox = width * (side ? 1.08 : -.08), oy = -height * .08;
      const swing = Math.sin(t * (.48 + i * .075) + i * 1.7 + side * 2.2);
      const goal = width * (.5 + swing * (.22 + lift * .17));
      const spread = width * (.045 + lift * .055 + i * .012);
      const alpha = (i ? .03 + lift * .19 : .07 + lift * .24) * (.65 + energy * .35);
      const beam = ctx.createLinearGradient(ox, oy, goal, height);
      beam.addColorStop(0, color(p.accent, alpha * 1.8));
      beam.addColorStop(.5, color(i % 2 ? p.secondary : p.primary, alpha));
      beam.addColorStop(1, color(p.accent, .01 + lift * .04));
      ctx.beginPath(); ctx.moveTo(ox - unit * 8, oy); ctx.lineTo(ox + unit * 8, oy);
      ctx.lineTo(goal + spread, height); ctx.lineTo(goal - spread, height); ctx.closePath();
      ctx.fillStyle = beam; ctx.fill();
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(goal, height);
      ctx.strokeStyle = color(p.accent, alpha * .6); ctx.lineWidth = unit; ctx.stroke();
    }
    ctx.restore();

    const footlights = ctx.createRadialGradient(width * .5, height * 1.12, 0, width * .5, height, width * .7);
    footlights.addColorStop(0, color(p.secondary, .08 + lift * .3 + s.pulse * lift * .06));
    footlights.addColorStop(.5, color(p.primary, .03 + lift * .14));
    footlights.addColorStop(1, color(p.bg, 0));
    ctx.fillStyle = footlights; ctx.fillRect(0, 0, width, height);

    // Fixed travel speed: loudness changes lighting, never elapsed-time distance.
    const floorY = height * .77, scroll = t * .42, step = scroll % 1;
    for (let row = 0; row < 7; row++) {
      const a = (row + step) / 7, b = (row + step + 1) / 7;
      const y0 = floorY + a * a * height * .26, y1 = floorY + b * b * height * .26;
      for (let column = 0; column < 12; column++) {
        if ((column + row + Math.floor(scroll)) % 2) continue;
        const x = (n, z) => width * .5 + (n / 12 - .5) * width * (.22 + z * 1.4);
        ctx.beginPath(); ctx.moveTo(x(column, a), y0); ctx.lineTo(x(column + 1, a), y0);
        ctx.lineTo(x(column + 1, b), y1); ctx.lineTo(x(column, b), y1); ctx.closePath();
        ctx.fillStyle = color((row + column) % 3 ? p.primary : p.secondary, .06 + lift * .2 + energy * .025); ctx.fill();
      }
    }

    // Long ribbons connect the whole screen; no free-floating particle confetti.
    for (let ribbon = 0; ribbon < 3; ribbon++) {
      ctx.beginPath();
      for (let point = 0; point <= 36; point++) {
        const x = width * point / 36;
        const y = height * (.26 + ribbon * .22) + Math.sin(point / 36 * TAU * 1.2 - t * 1.4 + ribbon * 1.8)
          * height * (.018 + lift * .055) + Math.sin(t * .4 + ribbon) * height * .025;
        if (point) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = color(ribbon === 1 ? p.secondary : p.primary, .12 + lift * .27);
      ctx.lineWidth = unit * (ribbon === 1 ? 2 : 6 + lift * 7); ctx.stroke();
    }

    for (const echo of echoesAt(s)) {
      const cx = width * (echo.index % 2 ? .82 : .18), cy = height * .48;
      const radius = echo.radius * Math.hypot(width, height) * .65;
      for (let trail = 0; trail < 3; trail++) {
        const r = radius - trail * unit * 9;
        if (r <= 0) continue;
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .76, -.12, 0, TAU);
        ctx.strokeStyle = color(trail ? p.primary : p.accent,
          echo.opacity * (.06 + lift * .34) * (1 - trail * .28) * (.55 + energy * .45));
        ctx.lineWidth = unit * (trail ? 1.2 : 3); ctx.stroke();
      }
    }

    if (!s.reduce) {
      const barTime = s.position / 4, bar = Math.floor(barTime), progress = barTime % 1;
      const sweep = clamp(progress / .42);
      if (sweep < 1) {
        const opacity = Math.sin(sweep * Math.PI) * (.035 + lift * .28);
        const direction = bar % 2 ? -1 : 1;
        const center = width * (direction > 0 ? - .35 + sweep * 1.7 : 1.35 - sweep * 1.7);
        // Offset copies are spatial afterimages, not a blur on the lyric DOM.
        for (let trail = 2; trail >= 0; trail--) {
          const x = center - direction * trail * width * .028;
          const wash = ctx.createLinearGradient(x - width * .12, 0, x + width * .12, 0);
          wash.addColorStop(0, color(p.primary, 0));
          wash.addColorStop(.56, color(trail ? p.primary : p.accent, opacity * (1 - trail * .3)));
          wash.addColorStop(1, color(p.secondary, 0));
          ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
          for (let line = 0; line < 5; line++) {
            const y = height * (.1 + line * .19);
            ctx.beginPath(); ctx.moveTo(x - direction * width * .24, y);
            ctx.lineTo(x, y + direction * height * .055);
            ctx.strokeStyle = color(p.accent, opacity * (1 - trail * .3));
            ctx.lineWidth = unit * (line % 2 ? 1 : 3); ctx.stroke();
          }
        }
      }
    }

    for (let i = 0; i < 2; i++) {
      const x = width * (i ? .88 : .12), y = height * (i ? .65 : .28);
      const radius = Math.min(width, height) * (.055 + lift * .025);
      star(ctx, x, y, radius, t * (i ? -.22 : .22), i ? p.secondary : p.accent, .3 + lift * .35, unit * 2.5);
    }
    // Uniform contrast over the stage: no panel, border or filter behind words.
    const shade = ctx.createRadialGradient(width * .5, height * .48, 0, width * .5, height * .48, width * .58);
    shade.addColorStop(0, 'rgba(12,7,19,0.24)'); shade.addColorStop(1, 'rgba(12,7,19,0)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return s;
  }

  return Object.freeze({ draw, stateAt, echoesAt });
});
