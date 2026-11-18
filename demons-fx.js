// demons (Josiah Queen) — "Light in the Dark". A stormy night road through a
// forest, walked forward toward the horizon with a lantern that pulses on the
// kick. Shadows circle the edges and recoil from the light; rain and lightning
// follow the strong hits. In each chorus dawn breaks: a cross of light rises,
// the shadows dissolve into golden sparks, and doves fly out of the light.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DemonsFx = api;
})(typeof window === 'object' ? window : globalThis, kit => {
  'use strict';

  const { TAU, clamp, mix, ease, easeOut, fract, hash, rgba, blend } = kit;
  const GOLD = '#ffd27a', DAWN = '#fff3d6', NIGHT = '#070a14', STORM = '#1a2034';
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

  /** How far dawn has come: rises through each chorus, falls back in the storms. */
  function dawnAt(list, F) {
    if (F.chorus) return Math.min(easeOut(F.elapsed / 2.5), 1) * (F.next?.chorus ? 1 : Math.max(0.35, F.leave(3)));
    const before = F.previous?.chorus ? clamp(1 - F.elapsed / 4) * 0.8 : 0;
    const anticipation = F.next?.chorus ? clamp(1 - F.remaining / 8) * 0.35 : 0;
    // The song ends in the morning, not back in the storm.
    const ending = !F.next && F.previous?.chorus ? 0.75 : 0;
    return Math.max(before, anticipation, ending);
  }

  function clouds(ctx, w, h, t, color, lit, seed, y0, scale) {
    ctx.beginPath();
    for (let c = 0; c < 7; c++) {
      const x = fract(hash(seed + c) + t * (0.004 + hash(seed + c * 2) * 0.006)) * w * 1.5 - w * 0.25;
      const y = h * (y0 + hash(seed + c * 3) * 0.12);
      const r = Math.min(w, h) * scale * (0.12 + hash(seed + c * 5) * 0.1);
      for (let p = 0; p < 5; p++) {
        const px = x + (p - 2) * r * 0.75, py = y - Math.sin((p + 0.5) / 5 * Math.PI) * r * 0.35;
        ctx.moveTo(px + r * 0.7, py); ctx.arc(px, py, r * 0.7, 0, TAU);
      }
    }
    ctx.fillStyle = color; ctx.fill();
    if (lit > 0.02) {
      ctx.fillStyle = kit.linear(ctx, 0, h * y0, 0, h * (y0 + 0.25), [[0, rgba(GOLD, 0)], [1, rgba(GOLD, 0.22 * lit)]]);
      ctx.fill();
    }
  }

  function crossOfLight(ctx, x, y, s, strength, beat) {
    const glow = s * (2.4 + beat * 0.5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = kit.radial(ctx, x, y, glow, [[0, rgba(DAWN, 0.35 * strength)], [0.3, rgba(GOLD, 0.22 * strength)], [1, rgba(GOLD, 0)]]);
    ctx.fillRect(x - glow, y - glow, glow * 2, glow * 2);
    ctx.fillStyle = rgba('#ffffff', 0.95 * strength);
    kit.roundRect(ctx, x - s * 0.09, y - s * 0.75, s * 0.18, s * 1.6, s * 0.06); ctx.fill();
    kit.roundRect(ctx, x - s * 0.48, y - s * 0.38, s * 0.96, s * 0.17, s * 0.06); ctx.fill();
    ctx.restore();
  }

  function rays(ctx, x, y, w, h, strength, turn, count = 14) {
    const len = Math.hypot(w, h);
    for (let r = 0; r < count; r++) {
      const a = turn + r * TAU / count, spread = 0.05 + 0.03 * Math.sin(r * 2.3);
      kit.poly(ctx, [[x, y], [x + Math.cos(a - spread) * len, y + Math.sin(a - spread) * len], [x + Math.cos(a + spread) * len, y + Math.sin(a + spread) * len]]);
      ctx.fillStyle = rgba(GOLD, (0.05 + 0.04 * (r % 2)) * strength);
      ctx.fill();
    }
  }

  function pine(ctx, x, base, height, color) {
    const half = height * 0.32;
    ctx.moveTo(x, base - height);
    for (let tier = 0; tier < 3; tier++) {
      const y = base - height * (0.66 - tier * 0.28), wide = half * (0.55 + tier * 0.25);
      ctx.lineTo(x + wide, y); ctx.lineTo(x + wide * 0.45, y);
    }
    ctx.lineTo(x + half * 0.1, base); ctx.lineTo(x - half * 0.1, base);
    for (let tier = 2; tier >= 0; tier--) {
      const y = base - height * (0.66 - tier * 0.28), wide = half * (0.55 + tier * 0.25);
      ctx.lineTo(x - wide * 0.45, y); ctx.lineTo(x - wide, y);
    }
    ctx.closePath();
  }

  function shadow(ctx, x, y, s, t, k, alpha, flee) {
    // A drifting smoke shape with two dim lights for eyes.
    const sway = Math.sin(t * 1.3 + k) * s * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y);
    ctx.bezierCurveTo(x - s * 0.7, y - s * 0.9, x + s * 0.7, y - s * 0.9, x + s * 0.6, y);
    ctx.bezierCurveTo(x + s * 0.5, y + s * 0.8 + sway, x + s * 0.1, y + s * 1.1, x + sway, y + s * 1.9);
    ctx.bezierCurveTo(x - s * 0.2, y + s * 1.1, x - s * 0.5, y + s * 0.8 - sway, x - s * 0.6, y);
    ctx.closePath();
    ctx.fillStyle = rgba('#05060c', 0.85 * alpha); ctx.fill();
    const look = flee * s * 0.08;
    ctx.fillStyle = rgba('#b9c3ff', 0.45 * alpha);
    ctx.beginPath();
    ctx.ellipse(x - s * 0.2 + look, y - s * 0.3, s * 0.08, s * 0.05, 0, 0, TAU);
    ctx.ellipse(x + s * 0.2 + look, y - s * 0.3, s * 0.08, s * 0.05, 0, 0, TAU);
    ctx.fill();
  }

  function bolt(ctx, x, y, len, seed, u, alpha) {
    ctx.beginPath(); ctx.moveTo(x, y);
    let px = x, py = y;
    for (let s = 1; s <= 7; s++) {
      px += (hash(seed + s) - 0.5) * u * 9; py += len / 7;
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = rgba('#dfe8ff', alpha); ctx.lineWidth = Math.max(1.5, u * 0.5); ctx.stroke();
    ctx.strokeStyle = rgba('#9fb4ff', alpha * 0.35); ctx.lineWidth = Math.max(3, u * 1.6); ctx.stroke();
  }

  function dove(ctx, x, y, s, flap, dir) {
    ctx.moveTo(x - s * dir, y);
    ctx.quadraticCurveTo(x - s * 0.5 * dir, y - s * 0.7 * flap, x, y - s * 0.05);
    ctx.quadraticCurveTo(x + s * 0.5 * dir, y - s * 0.7 * flap, x + s * dir, y);
    ctx.quadraticCurveTo(x + s * 0.2 * dir, y + s * 0.25, x, y + s * 0.15);
    ctx.quadraticCurveTo(x - s * 0.2 * dir, y + s * 0.25, x - s * dir, y);
  }

  function draw(ctx, w, h, input = {}) {
    if (!(w > 0 && h > 0)) return;
    const list = shotList(input);
    const F = kit.frame(input, list);
    const t = F.t, u = Math.min(w, h) / 100;
    const data = input.data || null;
    const dawn = dawnAt(list, F);
    const horizon = h * 0.6;
    const storm = (1 - dawn) * clamp(0.35 + F.level);

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = kit.linear(ctx, 0, 0, 0, horizon, [
      [0, blend(NIGHT, '#2a3e72', dawn)], [0.6, blend('#0f1426', '#c46c5a', dawn)], [1, blend('#1b2036', '#ffcf86', dawn)]]);
    ctx.fillRect(0, 0, w, horizon + 2);

    // Stars only on the calmest night stretches.
    const stars = clamp(1 - storm * 1.6) * (1 - dawn);
    if (stars > 0.02) {
      ctx.beginPath();
      for (let s = 0; s < 40; s++) {
        const x = hash(s * 4.1) * w, y = hash(s * 2.7) * horizon * 0.6, r = u * (0.1 + hash(s) * 0.2);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fillStyle = rgba('#e6ecff', 0.6 * stars); ctx.fill();
    }

    clouds(ctx, w, h, t, rgba(blend(STORM, '#6a4b5c', dawn), 0.92 - dawn * 0.35), dawn, 11, 0.02, 1.2);
    clouds(ctx, w, h, t * 1.6, rgba(blend('#10142a', '#8a5a5a', dawn), 0.85 - dawn * 0.4), dawn, 29, 0.14, 0.95);

    // The cross rises out of the horizon and shines through the clouds as dawn comes.
    const cy = mix(horizon + u * 6, h * 0.3, easeOut(dawn));
    if (dawn > 0.02) {
      rays(ctx, w / 2, cy, w, h, dawn * (0.7 + F.energy * 0.3), t * 0.05 + F.pulse * 0.02);
      crossOfLight(ctx, w / 2, cy, u * (12 + F.pulse * 2 * dawn), dawn, F.pulse);
      // Light rings on the beat.
      for (let k = 0; k < 3; k++) {
        const p = fract(F.beats / 2 + k / 3);
        kit.circle(ctx, w / 2, cy, u * 10 + p * Math.max(w, h) * 0.55);
        ctx.strokeStyle = rgba(DAWN, 0.25 * dawn * (1 - p)); ctx.lineWidth = Math.max(1, u * 0.5); ctx.stroke();
      }
    }

    // Lightning on strong hits while the storm holds.
    if (storm > 0.25 && !F.reduced) {
      const age = kit.sinceHit(data, 'onset', F.time, 0.82, 0.5);
      if (age < 0.35) {
        const seed = Math.round((F.time - age) * 20);
        kit.flash(ctx, w, h, age, 0.35, '#c9d6ff', 0.3 * storm);
        bolt(ctx, w * (0.15 + hash(seed) * 0.7), h * 0.08, horizon * 0.55, seed, u, (1 - age / 0.35) * storm);
      }
    }

    // Hills and the road toward the light.
    ctx.fillStyle = blend('#0b0f1c', '#3a2a35', dawn);
    ctx.beginPath(); ctx.moveTo(0, horizon);
    for (let i = 0; i <= 12; i++) ctx.lineTo(w * i / 12, horizon - h * (0.03 + 0.04 * Math.sin(i * 1.7 + 1)));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    kit.poly(ctx, [[w * 0.485, horizon], [w * 0.515, horizon], [w * 0.78, h], [w * 0.22, h]]);
    ctx.fillStyle = kit.linear(ctx, 0, horizon, 0, h, [[0, rgba(blend('#2a2f45', DAWN, dawn), 0.9)], [1, rgba(blend('#141826', '#7a5a48', dawn), 1)]]);
    ctx.fill();
    // Road markings stream toward the viewer as the walk continues.
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const z = fract(t * 0.12 + k / 8), y = mix(horizon, h, z * z), half = mix(0.002, 0.012, z * z) * w;
      ctx.rect(w / 2 - half, y, half * 2, Math.max(1, u * 1.6 * z * z));
    }
    ctx.fillStyle = rgba(blend('#c9c2a8', '#fff3d6', dawn), 0.5); ctx.fill();

    // Trees pass on both sides, growing as they approach.
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      for (const side of [-1, 1]) {
        const z = fract(t * 0.05 + k / 9 + (side > 0 ? 0.5 / 9 : 0));
        const depth = z * z;
        const x = w / 2 + side * w * mix(0.08, 0.62, depth);
        const base = mix(horizon, h * 1.05, depth);
        pine(ctx, x, base, h * mix(0.05, 0.75, depth) * (0.8 + hash(k + side) * 0.4), '');
      }
    }
    ctx.fillStyle = blend('#04060c', '#2a1e22', dawn * 0.6); ctx.fill();
    if (dawn > 0.05) { ctx.strokeStyle = rgba(GOLD, 0.25 * dawn); ctx.lineWidth = Math.max(1, u * 0.25); ctx.stroke(); }

    // Rain while the storm holds.
    if (storm > 0.15) {
      ctx.beginPath();
      for (let r = 0; r < 46; r++) {
        const fall = fract(t * (1.1 + hash(r) * 0.6) + hash(r + 3));
        const x = w * hash(r * 1.9) + fall * u * 6, y = fall * h * 1.1 - h * 0.05, len = u * (2.5 + hash(r + 5) * 2);
        ctx.moveTo(x, y); ctx.lineTo(x - len * 0.25, y + len);
      }
      ctx.strokeStyle = rgba('#a9b8e6', 0.25 * storm); ctx.lineWidth = Math.max(1, u * 0.15); ctx.stroke();
    }

    // The lantern pulses on the kick and pushes the dark back.
    const lantern = (1 - dawn) * 0.9 + 0.1;
    const lx = w / 2 + Math.sin(t * 0.9) * u * 1.2, ly = h * 0.84 + Math.sin(t * 1.8) * u * 0.6;
    const lr = u * (5 + F.pulse * 3 * (0.4 + F.bass * 0.6));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = kit.radial(ctx, lx, ly, lr * 6, [[0, rgba(GOLD, 0.55 * lantern)], [0.3, rgba(GOLD, 0.18 * lantern)], [1, rgba(GOLD, 0)]]);
    ctx.fillRect(lx - lr * 6, ly - lr * 6, lr * 12, lr * 12);
    ctx.restore();
    kit.roundRect(ctx, lx - u * 1.6, ly - u * 2.2, u * 3.2, u * 4.4, u * 0.8);
    ctx.fillStyle = rgba(DAWN, 0.95 * lantern); ctx.fill();
    ctx.strokeStyle = rgba('#3a2a18', 0.8 * lantern); ctx.lineWidth = Math.max(1, u * 0.4); ctx.stroke();

    // Shadows circle the edges, recoil on the beat, and dissolve at dawn.
    const shadows = clamp(1 - dawn * 1.4);
    if (shadows > 0.02) {
      for (let k = 0; k < 7; k++) {
        const a = t * (0.12 + hash(k) * 0.1) * (k % 2 ? 1 : -1) + k * TAU / 7;
        const recoil = 1 + F.pulse * 0.08 + (1 - shadows) * 0.6;
        const x = w / 2 + Math.cos(a) * w * 0.46 * recoil, y = h * 0.5 + Math.sin(a) * h * 0.4 * recoil;
        shadow(ctx, x, y, u * (6 + hash(k + 2) * 4), t, k, shadows * (0.7 + 0.3 * F.level), Math.sign(w / 2 - x));
      }
    }
    // ...into rising golden sparks.
    const sparks = Math.max(dawn, F.chorus ? 1 - shadows : 0);
    if (sparks > 0.02) {
      ctx.beginPath();
      for (let s = 0; s < 44; s++) {
        const rise = fract(t * (0.08 + hash(s) * 0.08) + hash(s + 9));
        const x = w * hash(s * 3.7) + Math.sin(t + s) * u * 2, y = h * (1 - rise);
        const r = u * (0.2 + hash(s + 1) * 0.35) * (1 + F.pulse * 0.4);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fillStyle = rgba(GOLD, 0.7 * sparks); ctx.fill();
    }

    // Doves fly out of the light through every chorus.
    if (F.chorus && dawn > 0.3) {
      ctx.beginPath();
      for (let d = 0; d < 8; d++) {
        const fly = fract((F.elapsed + hash(d) * 6) / 6);
        const dir = d % 2 ? 1 : -1;
        const x = w / 2 + dir * fly * w * (0.45 + hash(d + 2) * 0.2), y = cy - fly * h * (0.1 + hash(d + 4) * 0.3) + Math.sin(fly * 9 + d) * u;
        dove(ctx, x, y, u * (2.4 + fly * 3.4), Math.sin(F.beats * Math.PI + d), dir);
      }
      ctx.fillStyle = rgba('#ffffff', 0.9 * dawn); ctx.fill();
    }

    if (!F.reduced && F.chorus && !F.previous?.chorus) kit.flash(ctx, w, h, F.elapsed, 1.2, DAWN, 0.6);
    kit.vignette(ctx, w, h, NIGHT, 0.6 - dawn * 0.3);
    ctx.restore();
  }

  return Object.freeze({ draw, dawnAt });
});
