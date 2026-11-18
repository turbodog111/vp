// Kuu ni Naru — "Becoming Sky". The camera rises through the whole recording:
// rooftops at dusk, cloud layers, open sky at each chorus (breaking through the
// clouds), then night and stars, with sky lanterns in the late choruses. The
// lyric lanes keep a calm, softly darkened band in the middle of the frame.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KuuFx = api;
})(typeof window === 'object' ? window : globalThis, kit => {
  'use strict';

  const { TAU, clamp, mix, ease, easeOut, fract, hash, rgba, blend } = kit;
  // Sky keyframes from the first section to the last: [top, middle, horizon].
  const SKIES = {
    original: [['#3b4a78', '#9a9cc4', '#f4cdbb'], ['#3d6e9e', '#86bad9', '#e4ecef'], ['#45508c', '#d295b5', '#ffd0a6'],
      ['#151d4a', '#34477f', '#7c6fb0'], ['#0a0f2e', '#18265c', '#3d5a9c']],
    okosama: [['#4b3f78', '#b39ac4', '#f6c9c4'], ['#4d6aa6', '#a6b9e0', '#f1e4ec'], ['#5a3f86', '#e08fb0', '#ffc9b0'],
      ['#22184a', '#4a3a82', '#a070b0'], ['#120c2e', '#2a1f5c', '#5a4a9c']]
  };
  const ACCENT = { original: ['#fff3d6', '#ffb7c9', '#9fe3df'], okosama: ['#fff0e0', '#ffc2dc', '#c9b6ff'] };
  const listCache = new WeakMap();

  function skyAt(stops, p) {
    const x = clamp(p) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = ease(x - i);
    return stops[i].map((c, k) => blend(c, stops[i + 1][k], f));
  }

  function cloudLayer(ctx, w, h, u, y0, scroll, seed, body, light, scale, count = 6) {
    // Two passes per layer (body, then a sunlit top); each pass is one path of puffs.
    for (const pass of [0, 1]) {
      ctx.beginPath();
      for (let c = 0; c < count; c++) {
        const span = w * 1.4;
        const x = fract(hash(seed + c) + scroll * (0.3 + hash(seed + c * 2) * 0.4)) * span - w * 0.2;
        const y = y0 + (hash(seed + c * 3) - 0.5) * h * 0.12;
        const r = u * scale * (4 + hash(seed + c * 5) * 4);
        for (let p = 0; p < 4; p++) {
          const arch = Math.sin((p + 0.5) / 4 * Math.PI);
          const px = x + (p - 1.5) * r * 0.9, py = y - arch * r * 0.55 - pass * r * 0.16;
          const pr = r * (0.6 + 0.4 * arch) * (pass ? 0.72 : 1);
          ctx.moveTo(px + pr, py); ctx.arc(px, py, pr, 0, TAU);
        }
      }
      ctx.fillStyle = pass ? light : body; ctx.fill();
    }
  }

  function city(ctx, w, h, base, color) {
    ctx.beginPath();
    ctx.moveTo(-10, h + 10);
    let x = -10, k = 0;
    while (x < w + 10) {
      const bw = w * (0.03 + hash(k) * 0.05), bh = h * (0.06 + hash(k + 40) * 0.16);
      ctx.lineTo(x, base - bh); ctx.lineTo(x + bw, base - bh);
      x += bw; k++;
    }
    ctx.lineTo(w + 10, h + 10); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    // Power lines strung across the rooftops.
    ctx.beginPath();
    for (let line = 0; line < 2; line++) {
      const y = base - h * (0.2 + line * 0.035);
      ctx.moveTo(-10, y); ctx.quadraticCurveTo(w * 0.5, y + h * 0.06, w + 10, y - h * 0.02);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function plane(ctx, x, y, size, angle, color, ink) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    kit.poly(ctx, [[size, 0], [-size * 0.8, -size * 0.55], [-size * 0.45, 0], [-size * 0.8, size * 0.55]]);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, size * 0.06); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.45, 0); ctx.stroke();
    ctx.restore();
  }

  function planePath(k, t, w, h) {
    const speed = 0.035 + hash(k + 11) * 0.03;
    const p = fract(t * speed + hash(k + 21));
    const x = mix(-0.15, 1.15, p) * w;
    const y = h * (0.12 + hash(k + 31) * 0.76) + Math.sin(t * (0.5 + hash(k) * 0.4) + k * 2) * h * 0.06;
    return [x, y];
  }

  function bird(ctx, x, y, s, flap) {
    ctx.moveTo(x - s, y - s * 0.3 * flap);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.55 * flap, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.55 * flap, x + s, y - s * 0.3 * flap);
  }

  function list(input) {
    const raw = input.sections || [];
    let cached = listCache.get(raw);
    if (!cached) {
      cached = kit.sections(raw, input.data || null, input.duration);
      if (typeof raw === 'object') listCache.set(raw, cached);
    }
    return cached;
  }

  function draw(ctx, w, h, input = {}) {
    if (!(w > 0 && h > 0)) return;
    const variant = String(input.variant || '').includes('okosama') ? 'okosama' : 'original';
    const sections = list(input);
    const F = kit.frame(input, sections);
    const t = F.t, u = Math.min(w, h) / 100;
    const accent = ACCENT[variant];
    // Altitude: one step per section, continuous within it.
    const altitude = F.index + F.local;
    const p = altitude / Math.max(1, sections.length);
    const [top, mid, horizon] = skyAt(SKIES[variant], p);
    const choruses = sections.filter(s => s.chorus);
    const chorusNumber = choruses.indexOf(F.section);
    const open = F.chorus ? Math.min(easeOut(F.elapsed / 2.4), F.leave(1.6)) : 0;
    const night = clamp((p - 0.5) / 0.3);

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = kit.linear(ctx, 0, 0, 0, h, [[0, top], [0.55, mid], [1, horizon]]);
    ctx.fillRect(0, 0, w, h);

    // Stars arrive with the night and twinkle with the highs.
    if (night > 0) {
      for (let bucket = 0; bucket < 3; bucket++) {
        ctx.beginPath();
        for (let s = bucket; s < 72; s += 3) {
          const x = hash(s * 1.7) * w, y = hash(s * 2.3) * h * 0.85;
          const r = u * (0.12 + hash(s * 3.1) * 0.28);
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
        const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (1.3 + bucket) + bucket * 2));
        ctx.fillStyle = rgba('#fffaf0', night * twinkle * (0.7 + F.highs * 0.3));
        ctx.fill();
      }
    }

    // Sun becomes moon; it climbs as the camera rises.
    const orbX = w * mix(0.78, 0.84, p), orbY = h * mix(0.62, 0.18, ease(p * 1.4));
    const orbR = Math.min(w, h) * (0.09 + open * 0.02);
    const orbColor = blend('#ffd9b0', '#fff6dd', night);
    ctx.fillStyle = kit.radial(ctx, orbX, orbY, orbR * 4, [[0, rgba(orbColor, 0.5 + open * 0.3)], [0.3, rgba(orbColor, 0.16)], [1, rgba(orbColor, 0)]]);
    ctx.fillRect(orbX - orbR * 4, orbY - orbR * 4, orbR * 8, orbR * 8);
    kit.circle(ctx, orbX, orbY, orbR); ctx.fillStyle = orbColor; ctx.fill();
    if (night > 0.2) {
      kit.circle(ctx, orbX + orbR * 0.42, orbY - orbR * 0.22, orbR * 0.86);
      ctx.fillStyle = rgba(top, (night - 0.2) * 0.9); ctx.fill();
    }

    // Choruses open the sky: rays fan out from the orb and breathe with the beat.
    if (open > 0.01) {
      for (let r = 0; r < 9; r++) {
        const a = Math.PI * (0.55 + r * 0.11) + Math.sin(t * 0.2 + r) * 0.04;
        const spread = 0.035 + F.pulse * 0.015;
        const len = Math.hypot(w, h);
        kit.poly(ctx, [[orbX, orbY], [orbX + Math.cos(a - spread) * len, orbY + Math.sin(a - spread) * len],
          [orbX + Math.cos(a + spread) * len, orbY + Math.sin(a + spread) * len]]);
        ctx.fillStyle = rgba(accent[0], open * (0.06 + 0.05 * F.energy));
        ctx.fill();
      }
    }

    // Rising: rooftops sink away early; cloud layers stream downward past the camera.
    const cityBase = h * (0.9 + p * 4.5);
    if (cityBase < h * 1.25) city(ctx, w, h, cityBase, blend(top, '#0c1230', 0.55, 1));
    const rush = F.chorus ? easeOut(F.elapsed / 2.2) * 1.4 : 0;
    // Sunlit by day, moonlit by night.
    const cloudBody = blend(blend(horizon, '#ffffff', 0.5), blend(mid, '#8a95c8', 0.35), night);
    const cloudLight = blend('#ffffff', blend(mid, '#c9d2f2', 0.6), night);
    const layers = [[0.86, 0.9, 0.035, 0.7], [0.66, 1.25, 0.06, 0.62], [0.24, 0.8, 0.025, 0.5 - night * 0.2], [0.95, 1.7, 0.09, 0.88]];
    layers.forEach(([y, scale, speed, alpha], i) => {
      const climb = fract(y + altitude * speed * 2.2 + rush * (0.3 + i * 0.12)) * 1.3 - 0.15;
      cloudLayer(ctx, w, h, u, climb * h, t * speed + altitude * 0.05, i * 37 + (variant === 'okosama' ? 5 : 0),
        rgba(cloudBody, alpha), rgba(cloudLight, alpha * 0.85), scale);
    });

    // Wind streaks follow onsets.
    ctx.beginPath();
    for (let s = 0; s < 10; s++) {
      const life = fract(t * (0.25 + hash(s) * 0.2) + hash(s + 7));
      const x = mix(-0.2, 1.2, life) * w, y = h * hash(s + 13);
      const len = w * (0.06 + 0.1 * F.onset);
      ctx.moveTo(x, y); ctx.lineTo(x - len, y + len * 0.04);
    }
    ctx.strokeStyle = rgba('#ffffff', 0.12 + F.onset * 0.25); ctx.lineWidth = Math.max(1, u * 0.18); ctx.stroke();

    // Paper planes glide with a fading trail; more of them in choruses.
    const planes = F.chorus ? 6 : 3;
    for (let k = 0; k < planes; k++) {
      const [x, y] = planePath(k, t, w, h);
      const [px, py] = planePath(k, t - 0.25, w, h);
      ctx.beginPath();
      for (let j = 0; j <= 8; j++) {
        const [tx, ty] = planePath(k, t - j * 0.12, w, h);
        j ? ctx.lineTo(tx, ty) : ctx.moveTo(tx, ty);
      }
      ctx.strokeStyle = rgba(accent[1], 0.35); ctx.lineWidth = Math.max(1, u * 0.3); ctx.stroke();
      plane(ctx, x, y, u * (2.4 + hash(k) * 1.6) * (1 + F.pulse * 0.08), Math.atan2(y - py, x - px),
        k % 2 ? '#fffaf0' : accent[1], blend(top, '#203050', 0.5));
    }

    // A flock crosses every chorus, wings beating on the beat.
    if (open > 0.05) {
      ctx.beginPath();
      const lead = mix(-0.2, 1.2, fract(F.elapsed / 11)) * w;
      for (let b = 0; b < 9; b++) {
        const row = Math.ceil(b / 2), side = b % 2 ? 1 : -1;
        const flap = Math.sin(F.beats * Math.PI * 2 + b * 0.6);
        bird(ctx, lead - row * u * 4.5, h * 0.2 + side * row * u * 2.4 + Math.sin(t + b) * u, u * 1.6, 0.4 + 0.6 * flap);
      }
      ctx.strokeStyle = rgba(blend(top, '#101828', 0.6), 0.75 * open); ctx.lineWidth = Math.max(1.2, u * 0.32); ctx.stroke();
    }

    // Late choruses release sky lanterns that rise into the stars.
    if (chorusNumber >= 2 || (night > 0.5 && F.chorus)) {
      for (let k = 0; k < 14; k++) {
        const rise = fract((F.elapsed + hash(k) * 9) / 9);
        const x = w * (0.06 + hash(k + 3) * 0.88) + Math.sin(t * 0.8 + k) * u * 2;
        const y = h * (1.05 - rise * 1.15);
        const r = u * (0.9 + hash(k + 5) * 0.7);
        const glow = (0.55 + 0.45 * Math.sin(t * 3 + k)) * Math.sin(rise * Math.PI);
        ctx.fillStyle = rgba('#ffcf87', 0.25 * glow);
        kit.circle(ctx, x, y, r * 3); ctx.fill();
        ctx.fillStyle = rgba('#ffe7b8', 0.9 * glow);
        kit.roundRect(ctx, x - r * 0.7, y - r, r * 1.4, r * 2, r * 0.4); ctx.fill();
      }
    }

    // Drifting light motes for the quiet verses.
    ctx.beginPath();
    for (let m = 0; m < 26; m++) {
      const fall = fract(t * (0.04 + hash(m) * 0.05) + hash(m + 2));
      const x = w * hash(m + 9) + Math.sin(t * 0.7 + m) * u * 3;
      const y = h * fall;
      const r = u * (0.25 + hash(m + 4) * 0.35);
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fillStyle = rgba(accent[0], 0.35 + 0.2 * F.highs); ctx.fill();

    // Calm band behind the lyric lanes.
    ctx.fillStyle = kit.linear(ctx, 0, h * 0.22, 0, h * 0.8, [[0, 'rgba(8,14,40,0)'], [0.3, 'rgba(8,14,40,0.13)'],
      [0.7, 'rgba(8,14,40,0.13)'], [1, 'rgba(8,14,40,0)']]);
    ctx.fillRect(0, h * 0.22, w, h * 0.58);

    // Breaking through into a chorus: a soft white bloom.
    if (F.chorus && !F.reduced) kit.flash(ctx, w, h, F.elapsed, 1.2, '#ffffff', 0.45);
    ctx.restore();
  }

  return Object.freeze({ draw });
});
