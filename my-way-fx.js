// My Way, So What! — an original idol-pop concert theatre (no characters).
// Shots follow the recording's measured sections: a phone feed for verses,
// comic panels for breaks, the full concert stage for choruses, and a spotlight
// finale where the curtain closes. Everything moves on the measured beat.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MyWayFx = api;
})(typeof window === 'object' ? window : globalThis, kit => {
  'use strict';

  const { TAU, clamp, mix, ease, easeOut, fract, hash, rgba, blend } = kit;
  const RED = '#e8394d', PINK = '#ff8fb8', BLUSH = '#ffd6e6', TEAL = '#39c5bb', GOLD = '#ffd76a';
  const INK = '#2a1426', STAGE = '#1a0f24', WHITE = '#fff7fb';
  const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
  const listCache = new WeakMap();

  function shotList(input) {
    const raw = input.structure?.length ? input.structure : input.sections || [];
    let list = listCache.get(raw);
    if (!list) {
      list = kit.sections(raw, input.data || null, input.duration);
      if (typeof raw === 'object') listCache.set(raw, list);
    }
    return list;
  }

  function shotFor(F) {
    if (!F.next && F.section.kind === 'outro') return 'finale';
    if (F.chorus) return 'stage';
    return F.index % 2 ? 'comic' : 'phone';
  }

  function bigText(ctx, text, x, y, size, fill, stroke, tilt = 0) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt);
    ctx.font = `900 ${Math.round(size)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size * 0.12); ctx.strokeStyle = stroke; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill; ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function sparkle(ctx, x, y, r, alpha, color = WHITE) {
    kit.star(ctx, x, y, r, r * 0.22, 4, 0);
    ctx.fillStyle = rgba(color, alpha); ctx.fill();
  }

  function dots(ctx, w, h, u, t, base, dot) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    const step = Math.max(24, u * 7), shift = fract(t * 0.15) * step;
    ctx.beginPath();
    for (let y = -step + shift; y < h + step; y += step) for (let x = -step + shift; x < w + step; x += step) {
      const r = step * 0.16;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = dot; ctx.fill();
  }

  // MARK: shots

  function phone(ctx, w, h, u, F) {
    dots(ctx, w, h, u, F.t, BLUSH, rgba(PINK, 0.45));
    const pw = Math.min(w * 0.36, h * 0.84 * 0.55), ph = pw / 0.55;
    const px = w * 0.5 - pw / 2 + Math.sin(F.t * 0.8) * u, py = h * 0.52 - ph / 2;
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate(-0.06 + Math.sin(F.t * 0.6) * 0.02 + F.pulse * 0.01); ctx.translate(-w / 2, -h / 2);
    kit.roundRect(ctx, px - u * 1.4, py - u * 1.4, pw + u * 2.8, ph + u * 2.8, u * 6);
    ctx.fillStyle = RED; ctx.fill();
    kit.roundRect(ctx, px, py, pw, ph, u * 4.5);
    ctx.fillStyle = '#fff3f8'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = PINK; ctx.fillRect(px, py, pw, ph * 0.1);
    kit.circle(ctx, px + pw * 0.12, py + ph * 0.05, ph * 0.025); ctx.fillStyle = WHITE; ctx.fill();
    ctx.fillStyle = WHITE; ctx.fillRect(px + pw * 0.2, py + ph * 0.04, pw * 0.36, ph * 0.02);
    // A new message lands on every beat; the thread scrolls up as they arrive.
    const step = ph * 0.105, newest = Math.floor(F.beats);
    const scroll = easeOut(F.phase * 3) * step;
    for (let k = 0; k < 9; k++) {
      const n = newest - k, mine = hash(n * 1.37) < 0.5;
      const y = py + ph * 0.9 - k * step - step + scroll;
      if (y < py + ph * 0.1) break;
      const bw = pw * (0.32 + hash(n * 2.1) * 0.36), bh = step * 0.72;
      const bx = mine ? px + pw - bw - pw * 0.06 : px + pw * 0.06;
      const grow = k === 0 ? easeOut(F.phase * 4) : 1;
      kit.roundRect(ctx, bx, y + bh * (1 - grow) / 2, bw * grow, bh * grow, bh * 0.45);
      ctx.fillStyle = mine ? TEAL : RED; ctx.fill();
      ctx.fillStyle = rgba(WHITE, 0.85 * grow);
      ctx.fillRect(bx + bh * 0.4, y + bh * 0.42, (bw - bh * 0.8) * grow * (0.4 + hash(n) * 0.5), Math.max(1, bh * 0.16));
    }
    ctx.restore();
    ctx.restore();
    // Reactions float up beside the phone.
    for (let k = 0; k < 10; k++) {
      const rise = fract(F.t * (0.12 + hash(k) * 0.08) + hash(k + 2));
      const side = k % 2 ? 1 : -1;
      const x = w / 2 + side * (pw * 0.75 + u * (4 + hash(k + 5) * 10)) + Math.sin(F.t * 2 + k) * u * 1.5;
      kit.heart(ctx, x, h * (1 - rise), u * (3 + hash(k + 3) * 3) * (1 + F.pulse * 0.2), Math.sin(F.t + k) * 0.3);
      ctx.fillStyle = rgba(k % 3 ? RED : TEAL, Math.sin(rise * Math.PI)); ctx.fill();
    }
  }

  function comic(ctx, w, h, u, F) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
    const panels = [[0.03, 0.05, 0.36, 0.56], [0.4, 0.05, 0.57, 0.42], [0.42, 0.5, 0.55, 0.45], [0.03, 0.64, 0.36, 0.31]];
    const icons = ['mic', 'heart', 'star', 'bang'];
    panels.forEach(([x, y, pw, ph], i) => {
      const lit = F.beatInBar === i ? 1 : 0;
      const X = x * w, Y = y * h, W = pw * w, H = ph * h;
      ctx.save();
      kit.poly(ctx, [[X + u, Y], [X + W, Y + u * 0.8], [X + W - u * 0.6, Y + H], [X, Y + H - u * 0.6]]);
      ctx.fillStyle = lit ? (i % 2 ? TEAL : RED) : (i % 2 ? '#3a2a4a' : '#4a2236'); ctx.fill();
      ctx.clip();
      // Speed lines radiate from each panel's centre.
      ctx.beginPath();
      const cx = X + W / 2, cy = Y + H / 2;
      for (let k = 0; k < 18; k++) {
        const a = k * TAU / 18 + F.t * 0.3 + i;
        ctx.moveTo(cx + Math.cos(a) * Math.min(W, H) * 0.3, cy + Math.sin(a) * Math.min(W, H) * 0.3);
        ctx.lineTo(cx + Math.cos(a) * Math.max(W, H), cy + Math.sin(a) * Math.max(W, H));
      }
      ctx.strokeStyle = rgba(WHITE, 0.18 + lit * 0.22); ctx.lineWidth = Math.max(1, u * 0.4); ctx.stroke();
      const s = Math.min(W, H) * (0.22 + lit * 0.06 * (1 + F.pulse));
      if (icons[i] === 'mic') {
        kit.roundRect(ctx, cx - s * 0.3, cy - s * 0.8, s * 0.6, s * 0.9, s * 0.3); ctx.fillStyle = WHITE; ctx.fill();
        ctx.fillStyle = GOLD; ctx.fillRect(cx - s * 0.06, cy + s * 0.1, s * 0.12, s * 0.7);
      } else if (icons[i] === 'heart') {
        kit.heart(ctx, cx, cy, s * 2.2, Math.sin(F.t * 2) * 0.1); ctx.fillStyle = WHITE; ctx.fill();
      } else if (icons[i] === 'star') {
        kit.star(ctx, cx, cy, s, s * 0.45, 5, F.t * 0.5); ctx.fillStyle = GOLD; ctx.fill();
      } else {
        bigText(ctx, '!?', cx, cy, s * 1.6, WHITE, INK, -0.1);
      }
      ctx.restore();
      kit.poly(ctx, [[X + u, Y], [X + W, Y + u * 0.8], [X + W - u * 0.6, Y + H], [X, Y + H - u * 0.6]]);
      ctx.strokeStyle = WHITE; ctx.lineWidth = Math.max(2, u * 0.8); ctx.stroke();
    });
    // "SO WHAT!" bursts onto the downbeat.
    const age = F.barPhase * 4 * F.period;
    if (age < F.period * 2) {
      const pop = easeOut(age / 0.25) * (1 - clamp((age - F.period * 1.4) / (F.period * 0.6)));
      kit.star(ctx, w * 0.5, h * 0.5, Math.min(w, h) * 0.24 * pop, Math.min(w, h) * 0.16 * pop, 12, 0.2);
      ctx.fillStyle = GOLD; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, u * 0.8); ctx.stroke();
      bigText(ctx, 'SO WHAT!', w * 0.5, h * 0.5, Math.min(w, h) * 0.085 * pop, RED, WHITE, -0.08);
    }
  }

  function stage(ctx, w, h, u, F) {
    ctx.fillStyle = kit.linear(ctx, 0, 0, 0, h, [[0, STAGE], [0.6, '#3a1638'], [1, '#12081a']]);
    ctx.fillRect(0, 0, w, h);
    // The LED wall alternates the title words each bar.
    // Right of centre, so the song title at top left stays clear.
    const lx = w * 0.3, ly = h * 0.1, lw = w * 0.62, lh = h * 0.34;
    kit.roundRect(ctx, lx, ly, lw, lh, u * 1.5);
    ctx.fillStyle = blend('#2a0c2a', F.bar % 2 ? '#0d3a3a' : '#4a0d1e', 0.6 + F.pulse * 0.4); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.beginPath();
    for (let x = lx; x < lx + lw; x += Math.max(6, u * 1.6)) { ctx.moveTo(x, ly); ctx.lineTo(x, ly + lh); }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    const words = F.bar % 2 ? 'SO WHAT!' : 'MY WAY';
    const slam = easeOut(F.barPhase * 4 / 0.5);
    bigText(ctx, words, lx + lw / 2, ly + lh / 2, Math.min(lw * 0.17, lh * 0.5) * mix(1.4, 1, slam) * (1 + F.pulse * 0.05),
      F.bar % 2 ? TEAL : PINK, WHITE, Math.sin(F.beats * Math.PI) * 0.03);
    ctx.restore();
    // Stage floor and lights.
    kit.poly(ctx, [[w * 0.12, h * 0.58], [w * 0.88, h * 0.58], [w, h * 0.78], [0, h * 0.78]]);
    ctx.fillStyle = kit.linear(ctx, 0, h * 0.58, 0, h * 0.78, [[0, '#4a1e44'], [1, '#22102a']]); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const x = w * (0.1 + k * 0.16), top = h * 0.02;
      const a = Math.PI / 2 + Math.sin(F.t * (0.9 + k * 0.13) + k * 1.4) * 0.45 + (k % 2 ? 1 : -1) * F.pulse * 0.05;
      const len = h * 0.9, spread = 0.06;
      kit.poly(ctx, [[x, top], [x + Math.cos(a - spread) * len, top + Math.sin(a - spread) * len], [x + Math.cos(a + spread) * len, top + Math.sin(a + spread) * len]]);
      ctx.fillStyle = kit.linear(ctx, x, top, x + Math.cos(a) * len, top + Math.sin(a) * len,
        [[0, rgba(k % 2 ? TEAL : PINK, 0.32 + F.pulse * 0.15)], [1, rgba(k % 2 ? TEAL : PINK, 0)]]);
      ctx.fill();
    }
    ctx.restore();
    // Lights along the stage lip chase on the beat.
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      if ((k + Math.floor(F.beats)) % 4) continue;
      const x = w * (0.13 + k * 0.05), y = h * 0.585;
      ctx.moveTo(x + u * 0.9, y); ctx.arc(x, y, u * 0.9, 0, TAU);
    }
    ctx.fillStyle = GOLD; ctx.fill();
    // The crowd: rows of penlights waving on the beat.
    for (let row = 0; row < 3; row++) {
      const y = h * (0.82 + row * 0.07), count = 12 + row * 4;
      for (let k = 0; k < count; k++) {
        const x = w * (k + 0.5 + (row % 2) * 0.5) / count;
        const wave = Math.sin(F.beats * Math.PI + k * 0.4 + row) * (0.35 + F.pulse * 0.15);
        const len = u * (5 + row * 1.5);
        const color = (k + row) % 2 ? TEAL : RED;
        ctx.beginPath(); ctx.moveTo(x, y + len * 0.4); ctx.lineTo(x + Math.sin(wave) * len, y + len * 0.4 - Math.cos(wave) * len);
        ctx.strokeStyle = rgba(color, 0.9); ctx.lineWidth = Math.max(2, u * (0.6 + row * 0.15)); ctx.stroke();
      }
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const x = w * (k + 0.5 + (row % 2) * 0.5) / count;
        ctx.moveTo(x + u * 2.4, y + u * 3); ctx.arc(x, y + u * 3, u * 2.4, Math.PI, TAU);
      }
      ctx.fillStyle = '#0a0410'; ctx.fill();
    }
    // Heart confetti and sparkles.
    for (let k = 0; k < 18; k++) {
      const fall = fract(F.t * (0.1 + hash(k) * 0.08) + hash(k + 1));
      kit.heart(ctx, w * hash(k * 2.3) + Math.sin(F.t * 2 + k) * u * 2, h * (fall * 0.8), u * (2 + hash(k + 4) * 2), F.t * 2 + k);
      ctx.fillStyle = rgba([PINK, RED, TEAL, GOLD][k % 4], 0.85); ctx.fill();
    }
    for (let k = 0; k < 8; k++) {
      const tw = Math.max(0, Math.sin(F.t * 4 + k * 1.7));
      sparkle(ctx, w * hash(k + 40), h * hash(k + 50) * 0.55, u * 2.2 * tw, tw);
    }
  }

  function finale(ctx, w, h, u, F) {
    ctx.fillStyle = STAGE; ctx.fillRect(0, 0, w, h);
    const close = F.reduced ? 0.6 : easeOut(F.elapsed / Math.max(4, F.section.end - F.section.start - 2));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    kit.poly(ctx, [[w * 0.47, 0], [w * 0.53, 0], [w * 0.68, h * 0.9], [w * 0.32, h * 0.9]]);
    ctx.fillStyle = kit.linear(ctx, 0, 0, 0, h, [[0, rgba(BLUSH, 0.5)], [1, rgba(BLUSH, 0.08)]]); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.9, w * 0.18, h * 0.04, 0, 0, TAU);
    ctx.fillStyle = rgba(BLUSH, 0.25); ctx.fill();
    // A mic stand in the light.
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.88); ctx.lineTo(w / 2, h * 0.5);
    ctx.strokeStyle = '#d9c8d8'; ctx.lineWidth = Math.max(2, u * 0.6); ctx.stroke();
    kit.roundRect(ctx, w / 2 - u * 1.6, h * 0.42, u * 3.2, u * 5, u * 1.6); ctx.fillStyle = WHITE; ctx.fill();
    // Curtains close from both sides.
    for (const side of [-1, 1]) {
      const edge = w / 2 + side * w * 0.5 * (1 - close);
      ctx.beginPath();
      ctx.moveTo(side < 0 ? 0 : w, 0); ctx.lineTo(edge, 0);
      for (let i = 0; i <= 10; i++) ctx.lineTo(edge + Math.sin(i * 1.4 + F.t) * u * 1.2 * side, h * i / 10);
      ctx.lineTo(side < 0 ? 0 : w, h); ctx.closePath();
      ctx.fillStyle = RED; ctx.fill();
      ctx.beginPath();
      for (let f = 1; f < 6; f++) {
        const x = mix(side < 0 ? 0 : w, edge, f / 6);
        ctx.moveTo(x, 0); ctx.lineTo(x + Math.sin(F.t + f) * u, h);
      }
      ctx.strokeStyle = 'rgba(80,0,20,0.45)'; ctx.lineWidth = Math.max(2, u * 1.2); ctx.stroke();
    }
    if (close > 0.85) bigText(ctx, 'SO WHAT!', w / 2, h * 0.5, Math.min(w, h) * 0.13 * easeOut((close - 0.85) / 0.15), GOLD, INK, -0.12);
  }

  function draw(ctx, w, h, input = {}) {
    if (!(w > 0 && h > 0)) return;
    const list = shotList(input);
    const F = kit.frame(input, list);
    const u = Math.min(w, h) / 100;
    const shot = shotFor(F);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    kit.camera(ctx, w, h, 1 + F.pulse * (shot === 'stage' ? 0.03 : 0.012));
    if (shot === 'phone') phone(ctx, w, h, u, F);
    else if (shot === 'comic') comic(ctx, w, h, u, F);
    else if (shot === 'stage') stage(ctx, w, h, u, F);
    else finale(ctx, w, h, u, F);
    ctx.restore();
    if (!F.reduced && F.index > 0) kit.flash(ctx, w, h, F.elapsed, F.chorus ? 0.5 : 0.25, WHITE, F.chorus ? 0.8 : 0.45);
    kit.vignette(ctx, w, h, '#12061a', 0.4);
  }

  return Object.freeze({ draw, shotFor });
});
