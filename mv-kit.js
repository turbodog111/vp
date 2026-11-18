// Shared music-video toolkit for VP's recording-specific scenes.
// Every scene is a pure function of media time and the recording's measured
// motion data: pausing, seeking and replaying always reproduce the same frame,
// and nothing accumulates between frames.
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MvKit = api;
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = x => { const a = clamp(x); return a * a * (3 - 2 * a); };
  const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
  const easeIn = x => Math.pow(clamp(x), 3);
  const fract = x => x - Math.floor(x);
  const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const hash2 = (a, b) => hash(a * 12.9898 + b * 78.233);
  const noise = x => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return mix(hash(i), hash(i + 1), u) * 2 - 1;
  };

  const rgbCache = new Map();
  function rgb(color) {
    if (Array.isArray(color)) return color;
    let value = rgbCache.get(color);
    if (!value) {
      if (color.startsWith('rgb')) {
        value = color.slice(color.indexOf('(') + 1).split(',').slice(0, 3).map(v => parseFloat(v) || 0);
      } else {
        const raw = color.replace('#', '');
        const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
        const n = parseInt(full, 16);
        value = [n >> 16, (n >> 8) & 255, n & 255];
      }
      if (rgbCache.size > 2000) rgbCache.clear();
      rgbCache.set(color, value);
    }
    return value;
  }
  const rgba = (color, alpha = 1) => {
    const [r, g, b] = rgb(color);
    return `rgba(${r},${g},${b},${Math.round(clamp(alpha) * 1000) / 1000})`;
  };
  const blend = (a, b, t, alpha = 1) => {
    const x = rgb(a), y = rgb(b);
    return `rgba(${Math.round(mix(x[0], y[0], t))},${Math.round(mix(x[1], y[1], t))},${Math.round(mix(x[2], y[2], t))},${Math.round(clamp(alpha) * 1000) / 1000})`;
  };

  // Gradients degrade to their middle colour when a context cannot make one.
  function linear(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient?.(x0, y0, x1, y1);
    if (!g || typeof g.addColorStop !== 'function') return stops[Math.floor(stops.length / 2)][1];
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    return g;
  }
  function radial(ctx, x, y, r, stops, r0 = 0) {
    const g = ctx.createRadialGradient?.(x, y, Math.max(0, r0), x, y, Math.max(0.001, r));
    if (!g || typeof g.addColorStop !== 'function') return stops[Math.floor(stops.length / 2)][1];
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    return g;
  }

  // MARK: measured data

  function sample(data, key, time, fallback = 0) {
    const values = data?.[key];
    if (!values || !data.sampleInterval) return clamp(fallback);
    if (time < 0 || time >= data.duration) return 0;
    const index = Math.max(0, (time - data.sampleOffset) / data.sampleInterval);
    const lo = Math.min(values.length - 1, Math.floor(index));
    const hi = Math.min(values.length - 1, lo + 1);
    return mix(values[lo], values[hi], index - Math.floor(index)) / (data.scale || 100);
  }

  /** Seconds since `key` last rose above `threshold`, looking back at most `window` seconds. */
  function sinceHit(data, key, time, threshold, window = 1.5) {
    const values = data?.[key];
    if (!values || !data.sampleInterval) return Infinity;
    const scale = data.scale || 100;
    const last = Math.min(values.length - 1, Math.floor((time - data.sampleOffset) / data.sampleInterval));
    const first = Math.max(1, last - Math.ceil(window / data.sampleInterval));
    for (let i = last; i >= first; i--) {
      if (values[i] / scale >= threshold && values[i - 1] / scale < threshold) {
        return Math.max(0, time - (data.sampleOffset + i * data.sampleInterval));
      }
    }
    return Infinity;
  }

  const energyCache = new Map();
  function sectionEnergy(data, start, end) {
    if (!data?.energy) return 0.5;
    const key = `${data.audioSha256 || data.duration}:${start}:${end}`;
    let value = energyCache.get(key);
    if (value === undefined) {
      const step = data.sampleInterval;
      const a = Math.max(0, Math.floor((start - data.sampleOffset) / step));
      const b = Math.min(data.energy.length, Math.ceil((end - data.sampleOffset) / step));
      let sum = 0;
      for (let i = a; i < b; i++) sum += data.energy[i];
      value = b > a ? sum / (b - a) / (data.scale || 100) : 0;
      if (energyCache.size > 400) energyCache.clear();
      energyCache.set(key, value);
    }
    return value;
  }

  /** Normalises section lists (lyric sections, measured structure, chapter marks). */
  function sections(list, data, duration) {
    const end = duration || data?.duration || 0;
    if (!Array.isArray(list) || !list.length) return [{ start: 0, end: end || 1e9, chorus: false, level: 0.5, kind: 'verse', group: 0 }];
    return list.map((s, i) => {
      const start = Number(s.start) || 0;
      const stop = Number.isFinite(s.end) ? s.end : (list[i + 1]?.start ?? (end || start + 30));
      const level = Number.isFinite(s.energy) && s.energy > 1 ? s.energy / 100
        : Number.isFinite(s.energy) ? s.energy : sectionEnergy(data, start, stop);
      return { start, end: stop, chorus: !!s.chorus, level: clamp(level), kind: s.kind || (s.chorus ? 'chorus' : 'verse'),
        group: Number.isFinite(s.group) ? s.group : (s.phase ?? i), phase: s.phase ?? i, index: i };
    });
  }

  function locate(list, time) {
    let index = list.findIndex(s => time >= s.start && time < s.end);
    if (index < 0) index = time < list[0].start ? 0 : list.length - 1;
    const section = list[index];
    const length = Math.max(0.001, section.end - section.start);
    const elapsed = time - section.start;
    return { index, section, elapsed, remaining: section.end - time, local: clamp(elapsed / length),
      next: list[index + 1] || null, previous: list[index - 1] || null };
  }

  /**
   * The per-frame clock every scene draws from. With reduced motion the scene
   * holds one still moment per section: no traveling motion, no beat pulses.
   */
  function frame(state, list) {
    const reduced = !!state.reducedMotion;
    const time = Math.max(0, Number(state.time) || 0);
    const found = locate(list, time);
    const section = found.section;
    const hold = section.start + Math.min(2.5, (section.end - section.start) * 0.35);
    const t = reduced ? hold : time;
    const at = reduced ? locate(list, hold) : found;
    const period = state.period > 0 ? state.period : 0.5;
    const beats = reduced ? 0 : Math.max(0, Number(state.beats) || 0);
    const phase = reduced ? 0 : fract(beats);
    const bar = Math.floor(beats / 4);
    const barPhase = reduced ? 0 : fract(beats / 4);
    const level = section.level;
    const pick = (value, fallback) => reduced ? fallback : clamp(Number(value) || 0);
    return {
      reduced, time, t, period, beats, phase, bar, barPhase, beatInBar: Math.floor(beats) % 4,
      pulse: reduced ? 0 : Math.exp(-phase * 6),
      barPulse: reduced ? 0 : Math.exp(-barPhase * 4 * 3),
      energy: pick(state.energy, level), bass: pick(state.bass, level), highs: pick(state.highs, level * 0.7),
      onset: pick(state.onset, 0.2), lift: pick(state.lift, level),
      section, index: at.index, elapsed: at.elapsed, remaining: at.remaining, local: at.local,
      next: at.next, previous: at.previous, chorus: section.chorus, level,
      // 0 → 1 over the first `d` seconds of a section (for entrances).
      enter: d => reduced ? 1 : clamp(at.elapsed / d),
      // 1 → 0 over the last `d` seconds of a section (for exits).
      leave: d => reduced ? 1 : clamp(at.remaining / d),
    };
  }

  // MARK: drawing helpers

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, TAU);
  }
  function poly(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
  }
  function star(ctx, x, y, outer, inner, points, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = rotation + i * Math.PI / points - Math.PI / 2;
      const r = i % 2 ? inner : outer;
      i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function heart(ctx, x, y, size, rotation = 0) {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const p = (px, py) => [x + (px * c - py * s) * size, y + (px * s + py * c) * size];
    ctx.beginPath();
    ctx.moveTo(...p(0, 0.35));
    ctx.bezierCurveTo(...p(-0.05, 0.3), ...p(-0.6, 0.05), ...p(-0.5, -0.25));
    ctx.bezierCurveTo(...p(-0.42, -0.55), ...p(-0.05, -0.55), ...p(0, -0.25));
    ctx.bezierCurveTo(...p(0.05, -0.55), ...p(0.42, -0.55), ...p(0.5, -0.25));
    ctx.bezierCurveTo(...p(0.6, 0.05), ...p(0.05, 0.3), ...p(0, 0.35));
    ctx.closePath();
  }
  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  /** Zoom/rotate/shift around the frame centre. Call inside ctx.save()/restore(). */
  function camera(ctx, w, h, zoom = 1, rotation = 0, dx = 0, dy = 0) {
    ctx.translate(w / 2 + dx, h / 2 + dy);
    if (rotation) ctx.rotate(rotation);
    if (zoom !== 1) ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);
  }

  /** A soft full-frame flash that fades out over `duration` seconds after `age`. */
  function flash(ctx, w, h, age, duration, color, strength = 1) {
    if (!(age >= 0) || age > duration) return;
    ctx.fillStyle = rgba(color, strength * Math.pow(1 - age / duration, 2));
    ctx.fillRect(0, 0, w, h);
  }

  /** Darkens the frame edges so titles and controls stay readable. */
  function vignette(ctx, w, h, color, strength = 0.5) {
    const r = Math.hypot(w, h) * 0.62;
    ctx.fillStyle = radial(ctx, w / 2, h / 2, r, [[0, rgba(color, 0)], [0.62, rgba(color, 0)], [1, rgba(color, strength)]], r * 0.2);
    ctx.fillRect(0, 0, w, h);
  }

  return Object.freeze({
    TAU, clamp, mix, ease, easeOut, easeIn, fract, hash, hash2, noise, rgb, rgba, blend,
    linear, radial, sample, sinceHit, sectionEnergy, sections, locate, frame,
    circle, poly, star, heart, roundRect, camera, flash, vignette,
  });
});
