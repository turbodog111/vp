// Can't Steal My Joy — "Sunshine Parade". A bright festival field: a sun whose
// rays turn on the beat, bouncing hills, flowers that bob on every beat, bunting
// across the top and claps on the backbeat. Choruses bring a rainbow, confetti,
// balloons and a bouncing "JOY!"; quieter sections settle into golden hour with
// fireflies, and the last section ends at sunset with fireworks.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JoyFx = api;
})(typeof window === 'object' ? window : globalThis, kit => {
  'use strict';

  const { TAU, clamp, mix, ease, easeOut, fract, hash, rgba, blend } = kit;
  const SUN = '#ffd23f', SUN2 = '#ff9f1c', INK = '#3b2a1a';
  const CONFETTI = ['#ff5d8f', '#ffd23f', '#3ecf8e', '#4ea8ff', '#b07cff'];
  const RAINBOW = ['#ff5d5d', '#ff9f43', '#ffd23f', '#5fd38d', '#4ea8ff', '#7d6bff', '#c56bff'];
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

  function sun(ctx, x, y, r, turn, rays, pulse) {
    const len = r * (2.3 + pulse * 0.25);
    for (let k = 0; k < rays; k++) {
      const a = turn + k * TAU / rays, spread = Math.PI / rays * 0.55;
      kit.poly(ctx, [[x + Math.cos(a - spread) * r * 1.1, y + Math.sin(a - spread) * r * 1.1], [x + Math.cos(a) * len, y + Math.sin(a) * len],
        [x + Math.cos(a + spread) * r * 1.1, y + Math.sin(a + spread) * r * 1.1]]);
      ctx.fillStyle = k % 2 ? SUN : SUN2; ctx.fill();
    }
    kit.circle(ctx, x, y, r * (1 + pulse * 0.06)); ctx.fillStyle = SUN; ctx.fill();
    ctx.strokeStyle = SUN2; ctx.lineWidth = r * 0.08; ctx.stroke();
  }

  function hill(ctx, w, h, base, amp, phase, color, bounce) {
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let i = 0; i <= 24; i++) {
      const x = w * i / 24;
      ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(i * 0.55 + phase)) * (1 + bounce));
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    return i => base - amp * (0.5 + 0.5 * Math.sin(i * 0.55 + phase)) * (1 + bounce);
  }

  function flower(ctx, x, base, height, sway, bloom, petal, center, u) {
    const tx = x + sway * height * 0.35, ty = base - height;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x, base - height * 0.5, tx, ty);
    ctx.strokeStyle = '#2f8f4e'; ctx.lineWidth = Math.max(1.5, u * 0.5); ctx.stroke();
    const r = u * 2.2 * bloom;
    ctx.beginPath();
    for (let p = 0; p < 8; p++) {
      const a = p * TAU / 8 + sway;
      ctx.moveTo(tx + Math.cos(a) * r * 1.3 + r * 0.55, ty + Math.sin(a) * r * 1.3);
      ctx.arc(tx + Math.cos(a) * r * 1.3, ty + Math.sin(a) * r * 1.3, r * 0.55, 0, TAU);
    }
    ctx.fillStyle = petal; ctx.fill();
    kit.circle(ctx, tx, ty, r * 0.75); ctx.fillStyle = center; ctx.fill();
  }

  function bunting(ctx, w, h, u, swing, count = 14) {
    ctx.beginPath(); ctx.moveTo(-10, h * 0.04); ctx.quadraticCurveTo(w / 2, h * 0.16, w + 10, h * 0.04);
    ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = Math.max(1, u * 0.25); ctx.stroke();
    for (let k = 0; k <= count; k++) {
      const p = k / count, x = mix(-10, w + 10, p);
      const y = mix(h * 0.04, h * 0.04, p) + (1 - Math.pow(2 * p - 1, 2)) * h * 0.06;
      const s = u * 2.4, tilt = swing * (k % 2 ? 1 : -1) * 0.25;
      kit.poly(ctx, [[x - s, y], [x + s, y], [x + Math.sin(tilt) * s * 2, y + Math.cos(tilt) * s * 2.2]]);
      ctx.fillStyle = CONFETTI[k % CONFETTI.length]; ctx.fill();
    }
  }

  function cloud(ctx, x, y, r) {
    for (let p = 0; p < 4; p++) {
      const px = x + (p - 1.5) * r * 0.85, py = y - Math.sin((p + 0.5) / 4 * Math.PI) * r * 0.5;
      ctx.moveTo(px + r * 0.62, py); ctx.arc(px, py, r * 0.62, 0, TAU);
    }
  }

  function balloon(ctx, x, y, r, color, u) {
    ctx.beginPath(); ctx.moveTo(x, y + r * 1.15); ctx.quadraticCurveTo(x + r * 0.4, y + r * 2, x, y + r * 3);
    ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = Math.max(1, u * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r * 1.05, 0, 0, TAU);
    ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.18, r * 0.28, -0.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  }

  function pop(ctx, x, y, age, u, color) {
    if (!(age >= 0) || age > 0.45) return;
    const p = easeOut(age / 0.45), fade = 1 - age / 0.45;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8;
      ctx.moveTo(x + Math.cos(a) * u * 2 * p, y + Math.sin(a) * u * 2 * p);
      ctx.lineTo(x + Math.cos(a) * u * 5 * p, y + Math.sin(a) * u * 5 * p);
    }
    ctx.strokeStyle = rgba(color, fade); ctx.lineWidth = Math.max(1.5, u * 0.6); ctx.stroke();
  }

  function firework(ctx, x, y, age, u, color, seed) {
    if (!(age >= 0) || age > 1.4) return;
    const p = easeOut(age / 1.4), fade = 1 - age / 1.4;
    ctx.beginPath();
    for (let k = 0; k < 22; k++) {
      const a = k * TAU / 22 + hash(seed);
      const r = u * 15 * p * (0.8 + hash(seed + k) * 0.4);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r + age * age * u * 5, d = u * 0.45;
      ctx.moveTo(px + d, py); ctx.arc(px, py, d, 0, TAU);
    }
    ctx.fillStyle = rgba(color, fade); ctx.fill();
  }

  function draw(ctx, w, h, input = {}) {
    if (!(w > 0 && h > 0)) return;
    const list = shotList(input);
    const F = kit.frame(input, list);
    const t = F.t, u = Math.min(w, h) / 100;
    const party = F.chorus ? Math.min(easeOut(F.elapsed / 1.2), Math.max(0.4, F.leave(1.5))) : 0;
    const golden = F.chorus ? 0 : clamp((0.75 - F.level) / 0.3);
    const finale = !F.next ? clamp(F.elapsed / 6) : 0;
    const bounce = F.pulse * (0.04 + party * 0.06);

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const skyTop = blend(blend('#4ea8ff', '#ffb36b', golden), '#3a2f6b', finale);
    const skyLow = blend(blend('#bfe9ff', '#ffe2a8', golden), '#ff8a5c', finale);
    ctx.fillStyle = kit.linear(ctx, 0, 0, 0, h, [[0, skyTop], [0.7, skyLow], [1, skyLow]]);
    ctx.fillRect(0, 0, w, h);

    // Rainbow sweeps in for each chorus.
    if (party > 0.02) {
      const cx = w / 2, cy = h * 0.95, sweep = Math.PI * easeOut(F.elapsed / 2.4);
      RAINBOW.forEach((color, i) => {
        ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * (0.62 - i * 0.035), Math.PI, Math.PI + (F.reduced ? Math.PI : sweep));
        ctx.strokeStyle = rgba(color, 0.55 * party); ctx.lineWidth = Math.min(w, h) * 0.035; ctx.stroke();
      });
    }

    // The sun: rays turn a notch on every beat.
    const sunX = w * mix(0.8, 0.5, party), sunY = h * mix(0.28, 0.32, party) + finale * h * 0.3;
    const turn = (Math.floor(F.beats) + easeOut(F.phase * 3)) * (TAU / 32) + t * 0.05;
    sun(ctx, sunX, sunY, Math.min(w, h) * (0.09 + party * 0.03), turn, 16, F.pulse);

    ctx.beginPath();
    for (let c = 0; c < 5; c++) {
      const x = fract(hash(c) + t * (0.006 + hash(c + 1) * 0.008)) * w * 1.4 - w * 0.2;
      cloud(ctx, x, h * (0.14 + hash(c + 2) * 0.22), u * (5 + hash(c + 3) * 4));
    }
    ctx.fillStyle = rgba('#ffffff', 0.85 - finale * 0.4); ctx.fill();

    // Balloons rise through choruses and the finale.
    const lift = Math.max(party, finale);
    if (lift > 0.02) {
      for (let b = 0; b < 12; b++) {
        const rise = fract((F.elapsed + hash(b) * 10) / 10);
        const x = w * (0.05 + hash(b + 4) * 0.9) + Math.sin(t * 1.2 + b) * u * 2;
        balloon(ctx, x, h * (1.1 - rise * 1.3), u * (2.2 + hash(b + 5) * 1.2), rgba(CONFETTI[b % 5], 0.9 * lift), u);
      }
    }

    // Hills bounce on the beat; flowers bob on every beat, alternating sides.
    const far = hill(ctx, w, h, h * 0.74, h * 0.08, 1.3, blend(blend('#7ed37a', '#c8b45a', golden), '#5a4a6a', finale), bounce * 0.5);
    hill(ctx, w, h, h * 0.84, h * 0.07, 3.1, blend(blend('#47b35e', '#a8983e', golden), '#3f3550', finale), bounce);
    const near = hill(ctx, w, h, h * 0.95, h * 0.06, 0.4, blend(blend('#2f9a4c', '#7f7a30', golden), '#2c2440', finale), bounce * 1.4);
    const sway = (F.beatInBar % 2 ? 1 : -1) * F.pulse * (0.6 + party * 0.6) + Math.sin(t * 1.3) * 0.15;
    for (let k = 0; k < 11; k++) {
      const i = 1 + k * 2.2, x = w * i / 24;
      const height = h * (0.12 + hash(k) * 0.08) * (1 + F.pulse * 0.08);
      flower(ctx, x, near(i) + h * 0.02, height, sway * (k % 2 ? 1 : -1), 1 + F.pulse * 0.25 * (k % 2 ? 1 : 0.6),
        k % 3 === 0 ? '#ffd23f' : k % 3 === 1 ? '#ff7aa8' : '#ffffff', k % 3 === 0 ? '#7a4a1a' : '#ffb000', u);
    }
    for (let k = 0; k < 7; k++) {
      const i = 2 + k * 3.2;
      flower(ctx, w * i / 24, far(i) + h * 0.02, h * 0.06, sway * 0.5, 0.55, '#fff1a8', '#ff9f1c', u);
    }

    bunting(ctx, w, h, u, F.pulse + Math.sin(t * 2) * 0.2);

    // Claps on the backbeat (beats 2 and 4).
    if (!F.reduced && F.beatInBar % 2 === 1 && F.level > 0.5) {
      const seed = Math.floor(F.beats);
      pop(ctx, w * (0.12 + hash(seed) * 0.76), h * (0.18 + hash(seed + 1) * 0.3), F.phase * F.period, u, CONFETTI[seed % 5]);
      pop(ctx, w * (0.12 + hash(seed + 7) * 0.76), h * (0.2 + hash(seed + 8) * 0.3), F.phase * F.period, u, '#ffffff');
    }

    // Golden hour: fireflies drift over the field.
    if (golden > 0.05) {
      ctx.beginPath();
      for (let f = 0; f < 22; f++) {
        const x = w * hash(f * 2.1) + Math.sin(t * 0.6 + f) * u * 4, y = h * (0.55 + hash(f * 3.3) * 0.35) + Math.cos(t * 0.8 + f) * u * 3;
        const r = u * 0.35 * (0.5 + 0.5 * Math.sin(t * 3 + f * 1.7));
        ctx.moveTo(x + r, y); ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
      }
      ctx.fillStyle = rgba('#fff7b0', 0.8 * golden); ctx.fill();
    }

    // Confetti in the choruses.
    if (party > 0.02) {
      for (let c = 0; c < CONFETTI.length; c++) {
        ctx.beginPath();
        for (let k = c; k < 60; k += CONFETTI.length) {
          const fall = fract(t * (0.12 + hash(k) * 0.1) + hash(k + 3));
          const x = w * hash(k * 1.7) + Math.sin(t * 2 + k) * u * 3, y = h * (fall * 1.1 - 0.05);
          const a = t * (3 + hash(k) * 4) + k, s = u * 0.9, flat = Math.abs(Math.cos(t * 4 + k));
          const dx = Math.cos(a) * s, dy = Math.sin(a) * s * 0.6;
          ctx.moveTo(x - dx, y - dy * flat); ctx.lineTo(x + dy, y - dx * flat); ctx.lineTo(x + dx, y + dy * flat); ctx.lineTo(x - dy, y + dx * flat);
          ctx.closePath();
        }
        ctx.fillStyle = rgba(CONFETTI[c], party); ctx.fill();
      }
      // "JOY!" bounces on every beat in the middle of the chorus.
      const size = Math.round(Math.min(w * 0.18, h * 0.26) * (1 + F.pulse * 0.12));
      ctx.save();
      ctx.translate(w / 2, h * 0.56 - F.pulse * u * 3); ctx.rotate(Math.sin(F.beats * Math.PI) * 0.06);
      ctx.font = `900 ${size}px "Arial Rounded MT Bold", "Arial Black", "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, size * 0.09); ctx.strokeStyle = rgba(INK, 0.85 * party);
      ctx.strokeText('JOY!', 0, 0);
      ctx.fillStyle = rgba(CONFETTI[Math.floor(F.beats) % 5], party); ctx.fillText('JOY!', 0, 0);
      ctx.restore();
    }

    // Sunset fireworks to close.
    if (finale > 0.05 && !F.reduced) {
      for (let k = 0; k < 3; k++) {
        const n = Math.floor(F.beats / 2) - k, age = (F.beats / 2 - n) * F.period * 2;
        firework(ctx, w * (0.15 + hash(n) * 0.7), h * (0.15 + hash(n + 0.5) * 0.25), age, u, CONFETTI[Math.abs(n) % 5], n);
      }
    }

    if (!F.reduced && F.chorus && !F.previous?.chorus) kit.flash(ctx, w, h, F.elapsed, 0.4, '#fff6d0', 0.6);
    ctx.restore();
  }

  return Object.freeze({ draw });
});
