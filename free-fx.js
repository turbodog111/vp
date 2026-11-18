// Free — "Two Lights". Two voices as two ribbons of light (teal and pink) that
// travel the edges of a night city while the lyrics hold the centre. Before each
// chorus a cage of light bars forms and cracks; it shatters as the chorus lands,
// the ribbons braid together, and bursts follow the bass hits. At the end the
// two lights merge into one rising star. Original imagery only.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FreeFx = api;
})(typeof window === 'object' ? window : globalThis, kit => {
  'use strict';

  const { TAU, clamp, mix, ease, easeOut, fract, hash, rgba, blend } = kit;
  const TEAL = '#92e8d9', PINK = '#f0b6ce', GOLD = '#ffe2a8', NIGHT = '#0b1520';
  const listCache = new WeakMap();

  /** Chorus lift (0–1) from the lyric-measured chorus windows, with soft edges. */
  function cueAt(choruses, time) {
    const c = (choruses || []).find(s => time >= s.start - 0.6 && time < s.end + 0.8);
    if (!c) return 0;
    return Math.min(ease((time - c.start + 0.6) / 1.2), ease((c.end + 0.8 - time) / 1.6));
  }

  // Lyric-measured chorus windows; back-to-back windows count as one chorus.
  const windowCache = new WeakMap();
  function chorusWindows(raw) {
    if (!Array.isArray(raw)) return [];
    let merged = windowCache.get(raw);
    if (!merged) {
      merged = [];
      for (const s of raw.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end)).sort((a, b) => a.start - b.start)) {
        const last = merged.at(-1);
        if (last && s.start - last.end < 1.5) last.end = Math.max(last.end, s.end);
        else merged.push({ start: s.start, end: s.end });
      }
      windowCache.set(raw, merged);
    }
    return merged;
  }

  function shotList(input) {
    const raw = input.structure?.length ? input.structure : input.sections || [];
    let list = listCache.get(raw);
    if (!list) {
      list = kit.sections(raw, input.data || null, input.duration);
      if (typeof raw === 'object') listCache.set(raw, list);
    }
    return list;
  }

  // A voice's path around the frame edge; `side` 0 = teal, 1 = pink.
  function voice(side, t, w, h, braid, speed) {
    const dir = side ? -1 : 1;
    const a = dir * t * speed + side * Math.PI;
    const rx = w * mix(0.43, 0.36, braid), ry = h * mix(0.36, 0.33, braid);
    // Braiding: both ride the same orbit, weaving across it.
    const shared = t * speed * 1.15;
    const weave = Math.sin(shared * 3 + side * Math.PI) * h * 0.05 * braid;
    const angle = mix(a, shared + side * 0.25, braid);
    return [w / 2 + Math.cos(angle) * (rx + weave), h * 0.47 + Math.sin(angle) * (ry + weave)];
  }

  function ribbon(ctx, side, t, w, h, braid, speed, color, u, glow, horizon) {
    const n = 32, span = 2.1;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(voice(side, t - (i / n) * span, w, h, braid, speed));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Sparkles shed along the trail.
    ctx.beginPath();
    for (let i = 2; i < n; i += 2) {
      const [x, y] = pts[i];
      const drift = (i / n) * u * 5;
      const sx = x + (hash(i + side * 50 + Math.floor(t * 3)) - 0.5) * drift, sy = y + drift * 0.6;
      const r = u * 0.35 * (1 - i / n);
      ctx.moveTo(sx + r, sy); ctx.arc(sx, sy, r, 0, TAU);
    }
    ctx.fillStyle = rgba('#ffffff', 0.7 * glow); ctx.fill();
    for (const [width, alpha] of [[8, 0.07], [3.4, 0.2], [1.2, 0.95]]) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = rgba(color, alpha * glow);
      ctx.lineWidth = Math.max(1, u * width);
      ctx.stroke();
    }
    // Reflection in the water below the horizon.
    ctx.beginPath();
    let started = false;
    for (const [x, y] of pts) {
      if (y > horizon) { started = false; continue; }
      const ry = horizon + (horizon - y) * 0.45;
      started ? ctx.lineTo(x, ry) : ctx.moveTo(x, ry);
      started = true;
    }
    ctx.strokeStyle = rgba(color, 0.12 * glow); ctx.lineWidth = Math.max(1, u * 1.2); ctx.stroke();
    const [hx, hy] = pts[0];
    ctx.fillStyle = kit.radial(ctx, hx, hy, u * 5, [[0, rgba('#ffffff', 0.9 * glow)], [0.25, rgba(color, 0.5 * glow)], [1, rgba(color, 0)]]);
    ctx.fillRect(hx - u * 5, hy - u * 5, u * 10, u * 10);
    ctx.restore();
  }

  function skyline(ctx, w, h, horizon, u, F, t) {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    const windows = [];
    let x = 0, k = 0;
    while (x < w) {
      const bw = w * (0.025 + hash(k + 1) * 0.045);
      // Taller toward the sides, low in the middle under the lyrics.
      const edge = Math.abs(x + bw / 2 - w / 2) / (w / 2);
      const bh = h * (0.03 + edge * edge * 0.2) * (0.6 + hash(k + 50) * 0.8);
      ctx.lineTo(x, horizon - bh); ctx.lineTo(x + bw, horizon - bh);
      if (bh > h * 0.06) windows.push([x, horizon - bh, bw, bh, k]);
      x += bw; k++;
    }
    ctx.lineTo(w, horizon); ctx.closePath();
    ctx.fillStyle = '#060c14'; ctx.fill();
    // Window lights pulse with the beat in rows.
    ctx.beginPath();
    for (const [bx, by, bw, bh, b] of windows) {
      for (let r = 0; r < 6; r++) {
        const wy = by + bh * (0.12 + r * 0.14);
        if (wy > horizon - 3) break;
        if (hash(b * 13 + r + Math.floor(F.beats / 4)) < 0.45 + F.highs * 0.35) ctx.rect(bx + bw * 0.25, wy, bw * 0.5, Math.max(1, u * 0.45));
      }
    }
    ctx.fillStyle = rgba(GOLD, 0.35 + F.pulse * 0.25 * F.lift); ctx.fill();
  }

  function cage(ctx, w, h, u, strength, crack, seed) {
    // Light bars around the lyric box; cracks spread as the chorus approaches.
    const x0 = w * 0.1, x1 = w * 0.9, y0 = h * 0.2, y1 = h * 0.8;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const x = mix(x0, x1, i / 14);
      ctx.moveTo(x, y0); ctx.lineTo(x, y1);
    }
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1);
    ctx.strokeStyle = rgba(GOLD, 0.16 * strength); ctx.lineWidth = Math.max(1, u * 0.35); ctx.stroke();
    if (crack <= 0) return;
    ctx.beginPath();
    for (let c = 0; c < 6; c++) {
      let x = mix(x0, x1, hash(seed + c)), y = mix(y0, y1, hash(seed + c * 2));
      ctx.moveTo(x, y);
      for (let s = 0; s < 5 * crack; s++) {
        x += (hash(seed + c * 7 + s) - 0.5) * u * 12; y += (hash(seed + c * 11 + s) - 0.5) * u * 12;
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = rgba('#ffffff', 0.6 * crack); ctx.lineWidth = Math.max(1, u * 0.25); ctx.stroke();
  }

  function shatter(ctx, w, h, u, age, seed) {
    if (age < 0 || age > 1.6) return;
    const fade = 1 - age / 1.6;
    for (let s = 0; s < 34; s++) {
      const sx = w * (0.1 + hash(seed + s) * 0.8), sy = h * (0.2 + hash(seed + s * 2) * 0.6);
      const dx = sx - w / 2, dy = sy - h * 0.5, d = Math.hypot(dx, dy) || 1;
      const fly = easeOut(age / 1.6) * Math.min(w, h) * (0.35 + hash(seed + s * 3) * 0.5);
      const x = sx + dx / d * fly, y = sy + dy / d * fly + age * age * u * 18;
      const r = u * (1 + hash(seed + s * 5) * 2.4), spin = age * (4 + hash(seed + s) * 6);
      kit.poly(ctx, [[x + Math.cos(spin) * r, y + Math.sin(spin) * r], [x + Math.cos(spin + 2.2) * r * 0.7, y + Math.sin(spin + 2.2) * r * 0.7],
        [x + Math.cos(spin + 4.1) * r * 0.9, y + Math.sin(spin + 4.1) * r * 0.9]]);
      ctx.fillStyle = rgba(s % 3 ? GOLD : '#ffffff', 0.75 * fade); ctx.fill();
    }
  }

  function burst(ctx, x, y, age, u, color, seed, size = 16) {
    if (!(age >= 0) || age > 1.2) return;
    const fade = 1 - age / 1.2, r = easeOut(age / 1.2) * u * size, fall = age * age * u * 6;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = k * TAU / 16 + hash(seed) * 2;
      ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55 + fall);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r + fall);
    }
    ctx.strokeStyle = rgba(color, 0.85 * fade); ctx.lineWidth = Math.max(1, u * 0.45); ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = k * TAU / 16 + hash(seed) * 2 + 0.2, rr = r * 1.08;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr + fall * 1.3, d = u * 0.4;
      ctx.moveTo(px + d, py); ctx.arc(px, py, d, 0, TAU);
    }
    ctx.fillStyle = rgba('#ffffff', 0.8 * fade); ctx.fill();
  }

  function aurora(ctx, w, h, t, strength, beat) {
    for (let c = 0; c < 3; c++) {
      const color = [TEAL, PINK, '#b9a7ff'][c];
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const x = (i / 16) * w * 1.1 - w * 0.05;
        pts.push([x, h * (0.06 + c * 0.05) + Math.sin(i * 0.7 + t * (0.5 + c * 0.2) + c * 2) * h * 0.04]);
      }
      ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      for (let i = 16; i >= 0; i--) {
        const [x, y] = pts[i];
        ctx.lineTo(x, y + h * (0.2 + 0.08 * Math.sin(i * 1.3 + t * 0.9 + c)) * (0.85 + beat * 0.15));
      }
      ctx.closePath();
      ctx.fillStyle = kit.linear(ctx, 0, h * 0.05, 0, h * 0.42, [[0, rgba(color, 0)], [0.35, rgba(color, 0.2 * strength)], [1, rgba(color, 0)]]);
      ctx.fill();
    }
  }

  function searchlights(ctx, w, h, horizon, t, strength, beat) {
    for (let k = 0; k < 4; k++) {
      const x = w * [0.08, 0.22, 0.78, 0.92][k];
      const a = -Math.PI / 2 + Math.sin(t * (0.4 + k * 0.07) + k * 1.7) * 0.5;
      const len = h * 1.1, spread = 0.045;
      kit.poly(ctx, [[x, horizon], [x + Math.cos(a - spread) * len, horizon + Math.sin(a - spread) * len],
        [x + Math.cos(a + spread) * len, horizon + Math.sin(a + spread) * len]]);
      ctx.fillStyle = kit.linear(ctx, x, horizon, x + Math.cos(a) * len, horizon + Math.sin(a) * len,
        [[0, rgba(k % 2 ? TEAL : PINK, (0.22 + beat * 0.1) * strength)], [1, rgba(k % 2 ? TEAL : PINK, 0)]]);
      ctx.fill();
    }
  }

  function draw(ctx, w, h, input = {}) {
    if (!(w > 0 && h > 0)) return;
    const list = shotList(input);
    const F = kit.frame(input, list);
    const t = F.t, u = Math.min(w, h) / 100;
    const data = input.data || null;
    const choruses = chorusWindows(input.sections);
    const lift = F.reduced ? cueAt(choruses, F.t) : cueAt(choruses, F.time);
    const duration = input.duration || data?.duration || 190;
    const ending = clamp((F.time - (duration - 9)) / 7);
    const horizon = h * 0.76;

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Night sky that warms during the choruses.
    ctx.fillStyle = kit.linear(ctx, 0, 0, 0, horizon, [[0, '#050b14'], [0.6, blend('#0f1b2b', '#1d1838', lift)], [1, blend('#1b2a3c', '#3a2442', lift)]]);
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = kit.linear(ctx, 0, horizon, 0, h, [[0, '#0c1a26'], [1, NIGHT]]);
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.beginPath();
    for (let s = 0; s < 60; s++) {
      const x = hash(s * 3.3) * w, y = hash(s * 7.1) * horizon * 0.9, r = u * (0.1 + hash(s) * 0.22);
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = rgba('#e6f4ff', 0.5 + 0.3 * Math.sin(t * 0.9)); ctx.fill();

    // A low moon whose glow follows the song's loudness.
    const mx = w * 0.5, my = horizon - h * 0.02, mr = Math.min(w, h) * 0.2;
    ctx.fillStyle = kit.radial(ctx, mx, my, mr * 2.6, [[0, rgba(blend(PINK, GOLD, lift), 0.22 + F.energy * 0.12)], [0.4, rgba(PINK, 0.08)], [1, rgba(PINK, 0)]]);
    ctx.fillRect(mx - mr * 2.6, my - mr * 2.6, mr * 5.2, mr * 2.6);
    ctx.beginPath(); ctx.arc(mx, my, mr, Math.PI, TAU); ctx.fillStyle = rgba('#fde9ef', 0.12 + lift * 0.1); ctx.fill();

    // Water shimmer lines.
    ctx.beginPath();
    for (let r = 0; r < 12; r++) {
      const y = horizon + (h - horizon) * Math.pow((r + 1) / 12, 1.6);
      const x = w * 0.5 + Math.sin(t * 0.8 + r) * w * 0.04, half = w * (0.06 + r * 0.03) * (0.6 + F.energy * 0.6);
      ctx.moveTo(x - half, y); ctx.lineTo(x + half, y);
    }
    ctx.strokeStyle = rgba(blend(PINK, GOLD, lift), 0.18 + F.pulse * 0.1); ctx.lineWidth = Math.max(1, u * 0.3); ctx.stroke();

    const nextChorus = choruses.find(c => c.start > F.time - 0.01);
    const toChorus = nextChorus ? nextChorus.start - F.time : Infinity;
    const build = Math.max(lift, toChorus < 12 ? clamp(1 - toChorus / 12) * 0.7 : 0);
    if (lift > 0.02) aurora(ctx, w, h, t, lift, F.pulse);
    if (build > 0.02) searchlights(ctx, w, h, horizon, t, build, F.pulse);
    skyline(ctx, w, h, horizon, u, F, t);

    // The cage builds through each pre-chorus, cracking in the last few seconds.
    if (lift < 0.5 && toChorus < 12 && !ending) {
      cage(ctx, w, h, u, clamp(1 - toChorus / 12) * (1 - lift * 2), clamp(1 - toChorus / 3.5), Math.round(nextChorus.start));
    }
    const lastChorus = [...choruses].reverse().find(c => c.start <= F.time);
    if (lastChorus && !F.reduced) shatter(ctx, w, h, u, F.time - lastChorus.start, Math.round(lastChorus.start));

    // Two voices: apart in the verses, braided in the choruses, merged at the end.
    const speed = 0.34 + F.energy * 0.22 + lift * 0.18;
    const braid = Math.max(lift, ending);
    if (ending < 0.98) {
      ribbon(ctx, 0, t, w, h, braid, speed, TEAL, u, 0.75 + F.energy * 0.25, horizon);
      ribbon(ctx, 1, t, w, h, braid, speed, PINK, u, 0.75 + F.energy * 0.25, horizon);
    }
    if (ending > 0) {
      const sy = mix(h * 0.5, h * 0.12, easeOut(ending));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = kit.radial(ctx, w / 2, sy, u * 14, [[0, rgba('#ffffff', ending)], [0.2, rgba(blend(TEAL, PINK, 0.5), 0.6 * ending)], [1, rgba(PINK, 0)]]);
      ctx.fillRect(w / 2 - u * 14, sy - u * 14, u * 28, u * 28);
      kit.star(ctx, w / 2, sy, u * 3 * ending, u * 0.8 * ending, 4, t * 0.3); ctx.fillStyle = rgba('#ffffff', ending); ctx.fill();
      ctx.restore();
    }

    // Fireworks every other beat in the choruses, around the lyric box.
    if (lift > 0.2 && !F.reduced) {
      for (let k = 0; k < 2; k++) {
        const beat = Math.floor(F.beats / 2) - k;
        const age = (F.beats / 2 - beat) * F.period * 2;
        const left = hash(beat * 1.3) < 0.5;
        const x = left ? w * (0.06 + hash(beat + 0.2) * 0.16) : w * (0.78 + hash(beat + 0.2) * 0.16);
        burst(ctx, x, h * (0.1 + hash(beat + 0.7) * 0.3), age, u, [TEAL, PINK, GOLD][Math.abs(beat) % 3], beat, 11 + hash(beat) * 8);
      }
    }
    // Bass hits throw bursts of light around the frame edges in the choruses.
    if (lift > 0.2 && !F.reduced) {
      const age = kit.sinceHit(data, 'bass', F.time, 0.78, 1.3);
      const seed = Math.round((F.time - age) * 10);
      if (age < 1.2) {
        const side = hash(seed) < 0.5 ? 0.14 : 0.86;
        burst(ctx, w * side, h * (0.15 + hash(seed + 1) * 0.5), age, u, hash(seed + 2) < 0.5 ? TEAL : PINK, seed);
        burst(ctx, w * (1 - side), h * (0.1 + hash(seed + 3) * 0.4), age * 1.1, u, GOLD, seed + 9);
      }
    }

    // Lanterns rise through the quieter middle of the song.
    const lanterns = clamp(1 - lift * 2) * clamp((F.time - 20) / 6);
    if (lanterns > 0) {
      for (let k = 0; k < 10; k++) {
        const rise = fract(t * (0.025 + hash(k) * 0.02) + hash(k + 4));
        const x = (k % 2 ? w * (0.04 + hash(k + 1) * 0.12) : w * (0.84 + hash(k + 1) * 0.12)) + Math.sin(t * 0.7 + k) * u * 2;
        const y = horizon - rise * horizon * 1.05, r = u * (0.8 + hash(k + 2) * 0.6);
        ctx.fillStyle = rgba(GOLD, 0.2 * lanterns * Math.sin(rise * Math.PI));
        kit.circle(ctx, x, y, r * 3); ctx.fill();
        ctx.fillStyle = rgba('#ffd18a', 0.85 * lanterns * Math.sin(rise * Math.PI));
        kit.roundRect(ctx, x - r * 0.7, y - r, r * 1.4, r * 2, r * 0.4); ctx.fill();
      }
    }

    if (!F.reduced && lastChorus) kit.flash(ctx, w, h, F.time - lastChorus.start, 0.5, '#ffffff', 0.4);
    kit.vignette(ctx, w, h, '#03070d', 0.55);
    ctx.restore();
  }

  return Object.freeze({ draw, cueAt });
});
