// Mesmerizer — "Hypno Broadcast". A pop-art TV broadcast that changes shot at
// each measured chapter of the recording: power-on, the on-air room, a dive into
// the screen, channel surfing, a spiral storm, the eye, a wall of screens, and
// power-off. Original shapes only; nothing is copied from the music videos.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MesmerizerFx = api;
})(typeof window === 'object' ? window : globalThis, kit => {
  'use strict';

  const { TAU, clamp, ease, easeOut, fract, hash, rgba, blend } = kit;
  const INK = '#17233a';
  const PAPER = '#fffae9';
  // [cyan, red, yellow, blue, deep red] per recording.
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
  const CHORUS_CHAPTERS = new Set([4, 6]);
  const CHANNELS = ['spiral', 'card', 'eye', 'scope', 'tunnel'];
  const listCache = new Map();

  function chapter(variant, time) {
    const marks = clocks[variant] || clocks.original;
    const next = marks.findIndex(mark => time < mark);
    const index = next < 0 ? marks.length : next;
    const start = marks[index - 1] ?? 0;
    return { index, elapsed: time - start, blend: ease((time - start) / .48) };
  }

  function chapterList(variant, data) {
    const key = `${variant}:${data?.audioSha256 || ''}`;
    let list = listCache.get(key);
    if (!list) {
      const marks = clocks[variant] || clocks.original;
      const edges = [0, ...marks, Math.max(marks.at(-1) + 4, data?.duration || 160)];
      list = kit.sections(edges.slice(0, -1).map((start, i) =>
        ({ start, end: edges[i + 1], chorus: CHORUS_CHAPTERS.has(i), phase: i })), data);
      listCache.set(key, list);
    }
    return list;
  }

  // MARK: pop-art primitives

  function outlined(ctx, fill, u, width = 0.55) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, u * width); ctx.stroke();
  }

  function halftone(ctx, w, h, u, base, dot, t, wave) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const step = Math.max(26, u * 7.5);
    ctx.beginPath();
    for (let y = step / 2, row = 0; y < h + step; y += step * 0.87, row++) {
      for (let x = (row % 2) * step / 2; x < w + step; x += step) {
        const d = Math.hypot(x - w / 2, y - h / 2) / Math.hypot(w, h);
        const r = step * (0.12 + 0.22 * (0.5 + 0.5 * Math.sin(d * 18 - t * 2.4)) * wave);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
    }
    ctx.fillStyle = dot; ctx.fill();
  }

  function spiral(ctx, cx, cy, radius, turn, colors, arms = 6, twist = 2.6, steps = 14) {
    const half = Math.PI / arms;
    for (let a = 0; a < arms; a++) {
      const base = turn + a * TAU / arms;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let i = 1; i <= steps; i++) {
        const r = radius * i / steps, ang = base + twist * i / steps - half;
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      }
      for (let i = steps; i >= 1; i--) {
        const r = radius * i / steps, ang = base + twist * i / steps + half;
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fillStyle = colors[a % colors.length];
      ctx.fill();
    }
  }

  function rings(ctx, cx, cy, maxR, phase, color, u, count = 4, alpha = 0.7) {
    for (let k = 0; k < count; k++) {
      const p = fract(phase + k / count);
      kit.circle(ctx, cx, cy, maxR * p);
      ctx.strokeStyle = rgba(color, alpha * (1 - p));
      ctx.lineWidth = Math.max(1, u * (1.2 - p));
      ctx.stroke();
    }
  }

  function tunnel(ctx, cx, cy, w, h, depth, turn, colors, count = 12) {
    const size = Math.hypot(w, h) * 0.75;
    for (let k = count - 1; k >= 0; k--) {
      const z = fract(depth + k / count);
      const s = size * Math.pow(z, 2.2) + 2;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(turn + z * 1.4);
      ctx.fillStyle = colors[(k + Math.floor(depth * count)) % colors.length];
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  function testCard(ctx, x, y, w, h, pal, t) {
    const bars = [PAPER, pal[2], pal[0], '#5ee87a', pal[1], pal[4], pal[3]];
    const bw = w / bars.length;
    bars.forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(x + i * bw, y, bw + 1, h * 0.72); });
    ctx.fillStyle = INK; ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
    ctx.fillStyle = Math.floor(t * 2) % 2 ? PAPER : pal[2];
    kit.circle(ctx, x + w / 2, y + h * 0.36, Math.min(w, h) * 0.16); ctx.fill();
  }

  function oscilloscope(ctx, x, y, w, h, data, t, color, u, n = 48) {
    ctx.fillStyle = '#0b1424'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba(color, 0.25); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) { ctx.moveTo(x, y + h * i / 4); ctx.lineTo(x + w, y + h * i / 4); }
    ctx.stroke();
    // The trace is the recording's own measured loudness over the last two seconds.
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const at = t - (n - i) * 0.04;
      const e = kit.sample(data, 'energy', at, 0.4), b = kit.sample(data, 'high', at, 0.3);
      const yy = y + h / 2 + Math.sin(i * 0.9 + t * 9) * h * 0.38 * (0.25 + e * 0.75) * (0.6 + b * 0.4);
      i ? ctx.lineTo(x + w * i / n, yy) : ctx.moveTo(x, yy);
    }
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, u * 0.6); ctx.stroke();
  }

  function eye(ctx, cx, cy, size, open, pal, turn, u) {
    const lid = size * 0.55 * open;
    ctx.beginPath();
    ctx.moveTo(cx - size, cy);
    ctx.quadraticCurveTo(cx, cy - lid * 2, cx + size, cy);
    ctx.quadraticCurveTo(cx, cy + lid * 2, cx - size, cy);
    ctx.closePath();
    outlined(ctx, PAPER, u, 0.7);
    if (open < 0.08) return;
    ctx.save();
    ctx.clip();
    const iris = size * 0.42;
    kit.circle(ctx, cx, cy, iris); ctx.fillStyle = pal[0]; ctx.fill();
    spiral(ctx, cx, cy, iris * 0.92, turn, [pal[3], pal[0]], 4, 3.4);
    kit.circle(ctx, cx, cy, iris * 0.22); ctx.fillStyle = INK; ctx.fill();
    kit.circle(ctx, cx - iris * 0.3, cy - iris * 0.32, iris * 0.14); ctx.fillStyle = PAPER; ctx.fill();
    ctx.restore();
  }

  function pocketWatch(ctx, px, py, length, angle, r, t, pal, u) {
    const x = px + Math.sin(angle) * length, y = py + Math.cos(angle) * length;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y - r);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, u * 0.5); ctx.stroke();
    kit.circle(ctx, x, y - r * 1.12, r * 0.18); outlined(ctx, pal[2], u, 0.4);
    kit.circle(ctx, x, y, r); outlined(ctx, pal[2], u, 0.6);
    kit.circle(ctx, x, y, r * 0.78); outlined(ctx, PAPER, u, 0.35);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      ctx.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62);
      ctx.lineTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, u * 0.25); ctx.stroke();
    for (const [len, speed] of [[0.5, 0.35], [0.66, 4.2]]) {
      const a = t * speed - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * len, y + Math.sin(a) * r * len);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, u * 0.45); ctx.stroke();
    }
    spiral(ctx, x, y, r * 0.2, -t * 3, [pal[1], PAPER], 2, 3);
  }

  function tv(ctx, cx, cy, sw, sh, u, body, content, tilt = 0, antenna = 0) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(tilt);
    const pad = Math.min(sw, sh) * 0.12;
    const bw = sw + pad * 2.6, bh = sh + pad * 2;
    const small = Math.min(sw, sh) < 160;
    // Legs and antennae first, so the cabinet overlaps them.
    ctx.beginPath();
    const tips = [];
    for (const side of [-1, 1]) {
      ctx.moveTo(side * bw * 0.3, bh * 0.45); ctx.lineTo(side * bw * 0.36, bh * 0.62);
      const a = -Math.PI / 2 + side * (0.45 + antenna * 0.12);
      const ax = Math.cos(a) * bh * 0.55, ay = -bh / 2 + Math.sin(a) * bh * 0.55;
      ctx.moveTo(0, -bh / 2); ctx.lineTo(ax, ay);
      tips.push([ax, ay]);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, u * 0.7); ctx.stroke();
    if (!small) for (const [ax, ay] of tips) { kit.circle(ctx, ax, ay, u * 1.1); outlined(ctx, PAPER, u, 0.35); }
    kit.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, pad * 0.9);
    outlined(ctx, body, u, 0.8);
    const sx = -bw / 2 + pad, sy = -sh / 2;
    kit.roundRect(ctx, sx, sy, sw, sh, pad * 0.7);
    ctx.fillStyle = '#0b1424'; ctx.fill();
    ctx.save(); ctx.clip();
    content(sx, sy, sw, sh);
    // Scanlines and a glass glare.
    ctx.fillStyle = 'rgba(11,20,36,0.16)';
    ctx.beginPath();
    const gap = Math.max(5, sh / (sh < 160 ? 12 : 30));
    for (let y = sy; y < sy + sh; y += gap) ctx.rect(sx, y, sw, Math.max(1, gap * 0.3));
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath(); ctx.ellipse(sx + sw * 0.28, sy + sh * 0.2, sw * 0.3, sh * 0.1, -0.3, 0, TAU); ctx.fill();
    ctx.restore();
    kit.roundRect(ctx, sx, sy, sw, sh, pad * 0.7);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, u * 0.7); ctx.stroke();
    for (let k = 0; k < (small ? 1 : 2); k++) {
      kit.circle(ctx, bw / 2 - pad * 0.7, -bh * 0.18 + k * bh * 0.28, pad * 0.36); outlined(ctx, PAPER, u, 0.4);
    }
    ctx.restore();
  }

  function onAir(ctx, x, y, u, lit, pal) {
    const w = u * 15, h = u * 5;
    kit.roundRect(ctx, x - w / 2, y - h / 2, w, h, u * 1.2);
    outlined(ctx, lit > 0.5 ? pal[1] : '#5a2a3a', u, 0.5);
    ctx.fillStyle = lit > 0.5 ? PAPER : 'rgba(255,250,233,0.45)';
    ctx.font = `900 ${Math.round(u * 2.9)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ON AIR', x, y + u * 0.15);
  }

  function burst(ctx, x, y, r, turn, color, u) {
    kit.star(ctx, x, y, r, r * 0.5, 8, turn);
    outlined(ctx, color, u, 0.45);
  }

  function staticNoise(ctx, x, y, w, h, seed, strength) {
    for (let i = 0; i < 26; i++) {
      const yy = y + hash(seed + i) * h, hh = h * (0.01 + hash(seed + i * 3.1) * 0.05);
      ctx.fillStyle = `rgba(255,255,255,${Math.round((0.15 + hash(seed + i * 7.7) * 0.5) * strength * 1000) / 1000})`;
      ctx.fillRect(x, yy, w, hh);
    }
  }

  // MARK: shots

  function screen(ctx, kind, F, pal, data, turn, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2, r = Math.hypot(w, h) * 0.6;
    // Small screens (the orbiting TVs and the wall) use less detail; it reads the same.
    const small = Math.min(w, h) < 160;
    if (kind === 'spiral') spiral(ctx, cx, cy, r, turn, [pal[0], PAPER, pal[1], PAPER], small ? 4 : 8, 3.2, small ? 7 : 14);
    else if (kind === 'tunnel') tunnel(ctx, cx, cy, w, h, F.beats * 0.25, turn * 0.2, [pal[3], pal[0], INK, pal[1]], small ? 6 : 9);
    else if (kind === 'card') testCard(ctx, x, y, w, h, pal, F.t);
    else if (kind === 'scope') oscilloscope(ctx, x, y, w, h, data, F.t, pal[0], Math.min(w, h) / 40, small ? 20 : 48);
    else {
      ctx.fillStyle = pal[3]; ctx.fillRect(x, y, w, h);
      eye(ctx, cx, cy, w * 0.4, 0.75 + 0.25 * Math.sin(F.t * 1.3), pal, turn, Math.min(w, h) / 60);
    }
  }

  function shot(ctx, w, h, u, F, pal, data, variant) {
    const t = F.t, i = F.index;
    const spin = t * (0.9 + F.energy * 1.4) + F.pulse * 0.25;
    const set = (kind, cx, cy, sw, sh, body, tilt = 0) =>
      tv(ctx, cx, cy, sw, sh, u, body, (x, y, ww, hh) => screen(ctx, kind, F, pal, data, spin, x, y, ww, hh), tilt, F.pulse);

    if (i === 0 || i === 7) {
      // Power on / power off.
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, w, h);
      const p = i === 0 ? easeOut((F.elapsed - 0.25) / 1.1) : 1 - easeOut(F.elapsed / 1.4);
      const sh = h * 0.86 * Math.pow(clamp(p), 2), sw = w * 0.92 * clamp(p * 3);
      if (p > 0.02) {
        ctx.save();
        ctx.beginPath(); ctx.rect(w / 2 - sw / 2, h / 2 - Math.max(2, sh) / 2, sw, Math.max(2, sh)); ctx.clip();
        spiral(ctx, w / 2, h / 2, Math.hypot(w, h) * 0.6, spin, [pal[0], PAPER, pal[1], PAPER], 8, 3.2);
        ctx.restore();
      }
      const dot = i === 7 ? clamp(1 - F.elapsed / 2.6) : 0;
      if (dot > 0) { kit.circle(ctx, w / 2, h / 2, u * 2 * dot); ctx.fillStyle = PAPER; ctx.fill(); }
      return;
    }

    if (i === 1) {
      // The on-air room: TV, a pendulum swinging on the beat, broadcast rings.
      halftone(ctx, w, h, u, pal[3], blend(pal[3], pal[0], 0.35), t, 0.6 + F.energy * 0.4);
      ctx.fillStyle = INK; ctx.fillRect(0, h * 0.8, w, h * 0.2);
      ctx.fillStyle = pal[1];
      for (let k = -1; k < 14; k++) {
        const x0 = (k / 12) * w + fract(F.beats / 8) * w / 12;
        kit.poly(ctx, [[x0, h * 0.8], [x0 + w / 24, h * 0.8], [x0 + w / 24 + w * 0.06, h], [x0 + w * 0.06, h]]);
        ctx.fill();
      }
      const tvX = w * 0.42, tvY = h * 0.52;
      rings(ctx, tvX, tvY, Math.hypot(w, h) * 0.55, F.beats / 2, PAPER, u, 4, 0.35 + F.energy * 0.3);
      const sw = Math.min(w * 0.42, h * 0.5 * 1.45);
      set('spiral', tvX, tvY, sw, sw / 1.45, pal[1], Math.sin(t * 0.7) * 0.03);
      onAir(ctx, w * 0.83, h * 0.16, u, F.beatInBar % 2 === 0 ? 1 : F.pulse, pal);
      pocketWatch(ctx, w * 0.74, -u * 2, h * 0.58, Math.cos(Math.PI * F.beats) * (0.55 + F.energy * 0.15), u * 7.5, t, pal, u);
      for (let k = 0; k < 5; k++) {
        const x = w * (0.06 + hash(k + 3) * 0.16), y = h * (0.28 + k * 0.11) + Math.sin(t * 1.4 + k) * u * 2;
        spiral(ctx, x, y, u * (2.5 + hash(k) * 2), -t * 2 + k, [pal[2], INK], 3, 4);
      }
      return;
    }

    if (i === 2) {
      // Dive into the screen, then a beat-driven tunnel with the pendulum.
      const dive = easeOut(F.elapsed / 2.2);
      if (dive < 1 && !F.reduced) {
        ctx.save();
        kit.camera(ctx, w, h, 1 + dive * dive * 6);
        halftone(ctx, w, h, u, pal[3], blend(pal[3], pal[0], 0.35), t, 0.8);
        const sw = Math.min(w * 0.42, h * 0.5 * 1.45);
        set('tunnel', w / 2, h / 2, sw, sw / 1.45, pal[1]);
        ctx.restore();
        return;
      }
      tunnel(ctx, w / 2, h / 2, w, h, F.beats * 0.25, t * 0.15, [pal[3], pal[0], INK, pal[1], PAPER, pal[2]], 14);
      rings(ctx, w / 2, h / 2, Math.hypot(w, h) * 0.5, F.beats, PAPER, u, 3, 0.5);
      spiral(ctx, w / 2, h / 2, u * (7 + F.pulse * 3), spin * 2, [pal[2], INK], 4, 3);
      pocketWatch(ctx, w / 2, -u * 3, h * 0.55, Math.cos(Math.PI * F.beats) * 0.7, u * 6.5, t, pal, u);
      return;
    }

    if (i === 3) {
      // Channel surfing: a new channel every bar, with a burst of static between.
      const ch = CHANNELS[(F.bar + (variant === 'stetson' ? 2 : variant === 'artsy' ? 4 : 0)) % CHANNELS.length];
      ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
      const sx = w * 0.04, sy = h * 0.06, sw = w * 0.92, sh = h * 0.88;
      ctx.save();
      kit.roundRect(ctx, sx, sy, sw, sh, u * 6); ctx.clip();
      screen(ctx, ch, F, pal, data, spin, sx, sy, sw, sh);
      if (F.barPhase < 0.08 && !F.reduced) staticNoise(ctx, sx, sy, sw, sh, F.bar * 17, 1 - F.barPhase / 0.08);
      ctx.restore();
      ctx.fillStyle = '#7dff8a';
      ctx.font = `700 ${Math.round(u * 4)}px "Courier New", monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(`CH ${String(F.bar % 12 + 1).padStart(2, '0')}`, sx + sw - u * 4, sy + u * 4);
      kit.roundRect(ctx, sx, sy, sw, sh, u * 6);
      ctx.strokeStyle = pal[1]; ctx.lineWidth = u * 1.6; ctx.stroke();
      return;
    }

    if (i === 4 || i === 6) {
      // Choruses. 4: spiral storm with orbiting TVs. 6: the wall of screens.
      const shift = F.bar % 5;
      const cols = [pal[shift], PAPER, pal[(shift + 1) % 5], PAPER, pal[(shift + 2) % 5], PAPER];
      spiral(ctx, w / 2, h / 2, Math.hypot(w, h) * 0.62, (F.bar % 2 ? -1 : 1) * spin * 1.3, cols, 12, 4, 10);
      rings(ctx, w / 2, h / 2, Math.hypot(w, h) * 0.55, F.beats, INK, u, 4, 0.55);
      if (i === 4) {
        for (let k = 0; k < 4; k++) {
          const a = k * TAU / 4 + t * 0.45;
          set(CHANNELS[(k + F.bar) % CHANNELS.length], w / 2 + Math.cos(a) * w * 0.34, h / 2 + Math.sin(a) * h * 0.3,
            u * 15, u * 11, pal[(k + 1) % 5], Math.sin(t + k) * 0.15);
        }
        kit.circle(ctx, w / 2, h / 2, u * (9 + F.pulse * 4)); outlined(ctx, PAPER, u, 0.8);
        spiral(ctx, w / 2, h / 2, u * (8 + F.pulse * 4), -spin * 3, [pal[1], PAPER], 6, 3);
      } else {
        const columns = w > h * 1.2 ? 4 : 3, rows = 3;
        const cw = w * 0.9 / columns, rh = h * 0.86 / rows;
        for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
          const n = r * columns + c;
          const lit = Math.floor(F.beats) % (columns * rows) === n ? 1 : 0;
          set(CHANNELS[(n + F.bar) % CHANNELS.length], w * 0.05 + cw * (c + 0.5), h * 0.07 + rh * (r + 0.5) - lit * u * 1.5,
            cw * 0.62, rh * 0.6, lit ? PAPER : pal[n % 5], (hash(n) - 0.5) * 0.12);
        }
      }
      for (let k = 0; k < 6; k++) {
        const age = fract(F.beats / 2 + k / 6);
        const seed = Math.floor(F.beats / 2 + k / 6) * 6 + k;
        burst(ctx, w * hash(seed), h * hash(seed + 0.5), u * (2.5 + 3 * easeOut(age * 3)) * (1 - age), seed, pal[seed % 5], u);
      }
      return;
    }

    // i === 5: the eye — the slower bridge.
    halftone(ctx, w, h, u, INK, rgba(pal[3], 0.7), t * 0.4, 0.7);
    const open = F.reduced ? 1 : clamp(Math.abs(Math.sin(Math.PI * (F.beats / 8))) * 6);
    eye(ctx, w / 2, h / 2, Math.min(w * 0.36, h * 0.62), open, pal, -spin, u);
    for (let k = 0; k < 3; k++) {
      const a = t * 0.35 + k * TAU / 3;
      pocketWatch(ctx, w / 2 + Math.cos(a) * w * 0.38, h / 2 + Math.sin(a) * h * 0.34 - u * 9, u * 9,
        Math.sin(t * 2 + k) * 0.4, u * 4.5, t + k * 7, pal, u);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < 7; k++) {
      const rise = fract(t * 0.12 + hash(k));
      ctx.fillStyle = rgba(PAPER, 0.75 * Math.sin(rise * Math.PI));
      ctx.font = `900 ${Math.round(u * (3 + hash(k + 9) * 3))}px "Arial Black", Arial, sans-serif`;
      ctx.fillText('z', w * (0.08 + hash(k + 2) * 0.84), h * (1 - rise));
    }
  }

  function draw(ctx, w, h, input = {}) {
    if (!(w > 0 && h > 0)) return;
    const variant = palettes[input.variant] ? input.variant : 'original';
    const pal = palettes[variant];
    const data = input.data || null;
    const F = kit.frame(input, chapterList(variant, data));
    const u = Math.min(w, h) / 100;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const punch = F.chorus ? 0.035 : 0.015;
    kit.camera(ctx, w, h, 1 + F.pulse * punch * (0.4 + F.energy), Math.sin(F.t * 0.6) * (F.chorus ? 0.012 : 0.004));
    shot(ctx, w, h, u, F, pal, data, variant);
    ctx.restore();
    // Section entrances: a pop flash into choruses, static into everything else.
    if (!F.reduced && F.index > 0) {
      if (F.chorus) kit.flash(ctx, w, h, F.elapsed, 0.45, PAPER, 0.85);
      else if (F.elapsed < 0.22) staticNoise(ctx, 0, 0, w, h, F.index * 31, 1 - F.elapsed / 0.22);
    }
    kit.vignette(ctx, w, h, INK, 0.45);
  }

  return Object.freeze({ draw, chapter, palettes, clocks });
});
