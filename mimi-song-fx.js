window.MimiSongFx = (() => {
  'use strict';

  const tracks = Object.freeze({
    'songs/mimi feat. kasane teto sv - petal lament': Object.freeze({
      key: 'petal-lament', theme: 'mimi-petal', bpm: 170, beatOffset: 0.011,
      title: 'Petal Lament', art: './songs/art/petal-lament.webp',
      data: './songs/motion/petal-lament.json',
      source: 'https://www.youtube.com/watch?v=IxVFW1XIW7Q'
    }),
    'songs/mimi feat. hatsune miku - marshmary': Object.freeze({
      key: 'marshmary', theme: 'mimi-marshmary', bpm: 182, beatOffset: 0.082,
      title: 'Marshmary', art: './songs/art/marshmary.webp',
      data: './songs/motion/marshmary.json',
      source: 'https://www.youtube.com/watch?v=qtuX4cHk-vE'
    })
  });
  const cache = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  let active = null;
  let controller = null;
  let generation = 0;

  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const color = (rgb, alpha = 1) => `rgba(${rgb.join(',')},${clamp(alpha)})`;
  const blend = (a, b, amount) => a.map((v, i) => Math.round(mix(v, b[i], amount)));

  function track(song) {
    const path = String(song?.path || song?.id || '').normalize('NFKC').toLowerCase().replace(/\.(m4a|mp3)$/, '');
    return tracks[path] || null;
  }

  function validData(data) {
    return data?.version === 1 && Number.isFinite(data.duration) && data.duration > 0
      && Number.isFinite(data.bpm) && data.bpm > 0 && Number.isFinite(data.beatOffset)
      && Number.isFinite(data.sampleInterval) && data.sampleInterval > 0
      && Number.isFinite(data.sampleOffset) && data.scale === 100
      && ['energy', 'bass', 'high', 'onset'].every(key =>
        Array.isArray(data[key]) && data[key].length > 1
        && data[key].every(value => Number.isFinite(value) && value >= 0 && value <= 100));
  }

  async function activate(config, onReady) {
    const serial = ++generation;
    controller?.abort();
    controller = null;
    active = config;
    if (!config) return;
    if (cache.has(config.key)) { onReady?.(); return; }
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch(config.data, { signal: request.signal });
      if (!response.ok) throw new Error(`Motion data HTTP ${response.status}`);
      const data = await response.json();
      if (!validData(data)) throw new Error('Invalid motion data');
      if (serial !== generation) return;
      cache.set(config.key, data);
      onReady?.();
    } catch (error) {
      if (serial === generation && error.name !== 'AbortError') console.warn('MIMI motion data:', error);
      // Playback and live-analyser fallback remain independent of data loading.
    } finally {
      clearTimeout(timeout);
      if (serial === generation) controller = null;
    }
  }

  function sample(data, key, time, fallback = 0) {
    const values = data?.[key];
    if (!values) return clamp(fallback);
    if (time < 0 || time >= data.duration) return 0;
    const index = Math.max(0, (time - data.sampleOffset) / data.sampleInterval);
    const lo = Math.min(values.length - 1, Math.floor(index));
    return mix(values[lo], values[Math.min(lo + 1, values.length - 1)], index - Math.floor(index)) / data.scale;
  }

  function motionAt(config, time, live = 0) {
    const data = cache.get(config.key);
    const energy = sample(data, 'energy', time, live);
    const bass = sample(data, 'bass', time, live);
    const highs = sample(data, 'high', time, live * 0.5);
    const onset = sample(data, 'onset', time, live * 0.5);
    const period = 60 / (data?.bpm || config.bpm);
    const beats = Math.max(0, (time - (data?.beatOffset ?? config.beatOffset)) / period);
    const phase = beats % 1;
    const quiet = ease((energy - 0.07) / 0.35);
    const lift = ease((energy * 0.65 + highs * 0.35 - 0.48) / 0.38);
    const pulse = Math.exp(-phase * 7) * quiet;
    return { energy, bass, highs, onset, period, beats, phase, lift, pulse, quiet };
  }

  function stroke(ctx, rgb, alpha, width) {
    ctx.strokeStyle = color(rgb, alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function petal(ctx, x, y, size, rotation, rgb, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * 0.8, -size * 0.2, -size * 0.45, -size * 1.3, 0, -size);
    ctx.bezierCurveTo(size * 0.45, -size * 1.3, size * 0.8, -size * 0.2, 0, 0);
    ctx.fillStyle = color(rgb, alpha); ctx.fill();
    ctx.restore();
  }

  function bloom(ctx, x, y, radius, rotation, opening, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5;
      petal(ctx, Math.sin(a) * radius * 0.12, -Math.cos(a) * radius * 0.12,
        radius * (0.7 + opening * 0.3), a, i % 2 ? [252, 148, 180] : [255, 228, 233], alpha);
    }
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.16, 0, TAU);
    ctx.fillStyle = color([155, 41, 91], alpha); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius * 0.18, Math.sin(a) * radius * 0.18);
      ctx.lineTo(Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3);
      stroke(ctx, [174, 49, 101], alpha * 0.8, Math.max(1, radius * 0.016));
    }
    ctx.restore();
  }

  function butterfly(ctx, x, y, size, time, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 0.8) * 0.3);
    const flap = 0.42 + 0.58 * Math.abs(Math.sin(time * 4.2));
    ctx.scale(flap, 1);
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(side * size * 1.25, -size * 1.4, side * size * 1.7, size * 0.3, side * size * 0.22, size * 0.12);
      ctx.bezierCurveTo(side * size, size * 1.3, side * size * 0.3, size * 1.2, 0, 0);
      ctx.fillStyle = color([255, 245, 245], alpha); ctx.fill();
      stroke(ctx, [143, 43, 89], alpha, Math.max(1, size * 0.035));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * size * 0.7, -size * 0.5);
      stroke(ctx, [76, 162, 168], alpha * 0.65, 1.5);
    }
    ctx.restore();
  }

  function ribbons(ctx, w, h, time, m, palette, sea = false) {
    const amplitude = h * (0.035 + m.lift * 0.075 + m.bass * 0.035);
    for (let band = 0; band < 5; band++) {
      const y = h * (0.7 + band * 0.065);
      const phase = time * (sea ? 0.72 : 0.48) + band * 0.65;
      ctx.beginPath();
      for (let x = -20; x <= w + 20; x += 20) {
        const value = y + Math.sin(x / w * 5.3 + phase) * amplitude
          + Math.sin(x / w * 9.1 - phase * 0.6) * amplitude * 0.3;
        if (x === -20) ctx.moveTo(x, value); else ctx.lineTo(x, value);
      }
      ctx.lineTo(w + 20, h); ctx.lineTo(-20, h); ctx.closePath();
      ctx.fillStyle = color(palette[band % palette.length], 0.25 + band * 0.055); ctx.fill();
      for (let line = 0; line < 3; line++) {
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += 20) {
          const value = y + line * h * 0.012 + Math.sin(x / w * 5.3 + phase) * amplitude
            + Math.sin(x / w * 9.1 - phase * 0.6) * amplitude * 0.3;
          if (x === -20) ctx.moveTo(x, value); else ctx.lineTo(x, value);
        }
        stroke(ctx, band % 2 ? [255, 244, 238] : palette[(band + 1) % palette.length],
          0.2 + m.lift * 0.2, Math.max(1, w / 1050));
      }
    }
  }

  function wavefronts(ctx, w, h, config, time, m, cx, cy, rgb, reduced) {
    if (reduced || m.quiet < 0.01) return;
    const data = cache.get(config.key);
    // Each front retains its birth strength and expands independently. Seeking
    // reconstructs the same bounded set instead of replaying queued events.
    for (let ago = 0; ago < 5; ago++) {
      const beat = Math.floor(m.beats) - ago;
      if (beat < 0) continue;
      const born = (data?.beatOffset ?? config.beatOffset) + beat * m.period;
      const age = (time - born) / (m.period * 4.8);
      if (age < 0 || age > 1) continue;
      const strength = sample(data, 'energy', born + 0.04, m.energy);
      const radius = Math.min(w, h) * 0.12 + age * Math.max(w, h) * 0.85;
      ctx.beginPath(); ctx.ellipse(cx, cy, radius, radius * 0.67, -0.18, 0, TAU);
      stroke(ctx, rgb, (1 - age) ** 2 * (0.08 + strength * 0.21), Math.max(1.2, w * 0.002));
      ctx.beginPath(); ctx.ellipse(cx, cy, radius + 8, radius * 0.67 + 8, -0.18, 0.1, Math.PI * 1.3);
      stroke(ctx, [255, 249, 241], (1 - age) ** 2 * strength * 0.2, 1);
    }
  }

  function musicalSweep(ctx, w, h, m, rgb, reduced) {
    if (reduced || m.quiet < 0.01) return;
    const travel = (m.beats % 8) / 8;
    const x = mix(-w * 0.4, w * 1.4, ease(travel));
    const visibility = Math.sin(travel * Math.PI) * (0.08 + m.lift * 0.18);
    for (let trail = 5; trail >= 0; trail--) {
      ctx.beginPath(); ctx.moveTo(x - trail * 12 - w * 0.2, -h * 0.1);
      ctx.bezierCurveTo(x + w * 0.4 - trail * 12, h * 0.35,
        x - w * 0.25 - trail * 12, h * 0.65, x + w * 0.1 - trail * 12, h * 1.1);
      stroke(ctx, rgb, visibility * (1 - trail / 7), trail ? 1.5 : 5 + m.lift * 5);
    }
  }

  function drawPetal(ctx, w, h, time, m, config, reduced) {
    const s = Math.min(w, h), t = reduced ? 0 : time;
    const sky = ctx.createLinearGradient(0, 0, w * 0.7, h);
    sky.addColorStop(0, color(blend([251, 222, 232], [255, 189, 213], m.lift * 0.65 + m.pulse * 0.12)));
    sky.addColorStop(0.55, '#f7d9e4'); sky.addColorStop(1, '#72bcc2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const drift = Math.sin(t * 0.32) * w * 0.025;
    ctx.save(); ctx.translate(drift, 0);
    // Long silk curves and their parallel strokes carry motion across the stage.
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const y = h * (0.16 + i * 0.1);
      ctx.moveTo(-w * 0.1, y);
      ctx.bezierCurveTo(w * 0.25, y + Math.sin(t * 0.55 + i * 0.6) * h * 0.2,
        w * 0.68, y - h * (0.15 + m.lift * 0.08), w * 1.12, y + h * 0.18);
      stroke(ctx, i % 2 ? [255, 255, 251] : [177, 67, 112], 0.14 + m.lift * 0.09, i % 2 ? 4 : 1.4);
    }
    ctx.restore();
    musicalSweep(ctx, w, h, m, [255, 249, 247], reduced);
    ribbons(ctx, w, h, t, m, [[112, 190, 192], [222, 117, 162], [255, 221, 230]]);
    const cx = w * 0.68, cy = h * 0.4;
    wavefronts(ctx, w, h, config, time, m, cx, cy, [191, 63, 116], reduced);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 0.3) * 0.07);
    // A floral crown opens around an empty center, leaving the butterfly legible.
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI * 0.9 + i * Math.PI * 1.8 / 6;
      const radius = s * (0.235 + Math.sin(t * 0.4 + i) * 0.008);
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      ctx.beginPath(); ctx.moveTo(x * 0.76, y * 0.76); ctx.quadraticCurveTo(x * 1.15, y * 0.5, x, y);
      stroke(ctx, [33, 115, 123], 0.5, s * 0.003);
      petal(ctx, x * 0.86, y * 0.86, s * 0.045, angle + 1.2, [56, 148, 153], 0.7);
      bloom(ctx, x, y, s * (0.055 + (i % 3) * 0.012), angle + t * 0.07,
        0.45 + m.lift * 0.4 + m.pulse * 0.15, 0.9);
    }
    ctx.restore();
    // Short outline echoes show the butterfly's path without smearing the UI.
    for (let echo = reduced ? 0 : 3; echo >= 0; echo--) {
      const past = t - echo * 0.13;
      const x = cx + Math.sin(past * 0.67) * s * 0.14;
      const y = cy + Math.cos(past * 0.44) * s * 0.09;
      butterfly(ctx, x, y, s * 0.056, past, echo ? 0.09 / echo : 0.95);
    }
    // Four large foreground petals follow deliberate crossing arcs, not confetti.
    for (let i = 0; i < 4; i++) {
      const travel = ((t * 0.055 + i * 0.25) % 1 + 1) % 1;
      const x = mix(-w * 0.1, w * 1.1, travel);
      const y = h * (0.45 + 0.35 * Math.sin(travel * Math.PI + i));
      const alpha = Math.sin(travel * Math.PI) * (0.2 + m.lift * 0.25);
      petal(ctx, x, y, s * (0.06 + i * 0.012), travel * 4 + i, [210, 73, 133], alpha);
    }
  }

  function star(ctx, x, y, radius, rotation, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = i * TAU / 16, r = radius * (i % 2 ? 0.38 : 1);
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fillStyle = color([250, 217, 87], alpha); ctx.fill();
    stroke(ctx, [33, 70, 80], alpha, 1.5); ctx.restore();
  }

  function pocketWatch(ctx, x, y, radius, time, m) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 0.35) * 0.11);
    ctx.beginPath(); ctx.arc(0, -radius * 1.17, radius * 0.17, 0, TAU);
    stroke(ctx, [247, 212, 109], 0.95, radius * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = '#f1f2e7'; ctx.fill();
    stroke(ctx, [35, 75, 87], 1, radius * 0.08);
    ctx.beginPath(); ctx.arc(0, 0, radius * 1.04, 0, TAU);
    stroke(ctx, [245, 211, 119], 0.9, radius * 0.022);
    for (let i = 0; i < 60; i++) {
      const a = i * TAU / 60, r = radius * (i % 5 ? 0.86 : 0.8);
      ctx.beginPath(); ctx.moveTo(Math.sin(a) * r, -Math.cos(a) * r);
      ctx.lineTo(Math.sin(a) * radius * 0.91, -Math.cos(a) * radius * 0.91);
      stroke(ctx, [41, 91, 104], i % 5 ? 0.35 : 0.9, i % 5 ? 1 : 2.5);
    }
    for (const [rotation, length, weight] of [[time / 32, 0.48, 0.045], [time / 8, 0.73, 0.025]]) {
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(rotation) * radius * length, -Math.cos(rotation) * radius * length);
      stroke(ctx, [34, 71, 85], 0.95, radius * weight);
    }
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.055, 0, TAU);
    ctx.fillStyle = '#c67984'; ctx.fill();
    star(ctx, radius * 0.35, radius * 0.36, radius * (0.13 + m.pulse * 0.025), time * 0.15, 0.9);
    ctx.restore();
  }

  function drawMarshmary(ctx, w, h, time, m, config, reduced) {
    const s = Math.min(w, h), t = reduced ? 0 : time;
    const sky = ctx.createLinearGradient(0, 0, w * 0.2, h);
    sky.addColorStop(0, color(blend([184, 222, 218], [126, 205, 205], m.lift * 0.6 + m.pulse * 0.12)));
    sky.addColorStop(0.6, '#7faeb5'); sky.addColorStop(1, '#325f72');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const cx = w * 0.68, cy = h * 0.4;
    // Engraved currents sweep through the full frame like the source art's hair.
    for (let strand = 0; strand < 14; strand++) {
      const y = h * (0.16 + strand * 0.037);
      const bend = Math.sin(t * 0.55 + strand * 0.13) * h * (0.15 + m.lift * 0.1);
      ctx.beginPath(); ctx.moveTo(-w * 0.05, y);
      ctx.bezierCurveTo(w * 0.2, y + bend, w * 0.43, y - h * 0.4, w * 0.7, y + h * 0.05);
      ctx.bezierCurveTo(w * 0.92, y + h * 0.32 + bend, w * 0.65, y - h * 0.2, w * 1.12, y - h * 0.26);
      stroke(ctx, strand % 4 ? [241, 247, 229] : [32, 77, 93], strand % 4 ? 0.37 : 0.27,
        strand % 4 ? Math.max(1, w / 1250) : Math.max(2, w / 650));
    }
    musicalSweep(ctx, w, h, m, [255, 240, 182], reduced);
    ribbons(ctx, w, h, t, m, [[42, 105, 126], [227, 180, 192], [153, 212, 203]], true);
    wavefronts(ctx, w, h, config, time, m, cx, cy, [255, 237, 171], reduced);
    // The chain has a fixed number of links; it sways with the watch.
    ctx.beginPath();
    for (let i = 0; i <= 50; i++) {
      const f = i / 50;
      const x = mix(w * 0.94, cx, f) + Math.sin(f * Math.PI) * s * 0.11;
      const y = mix(-h * 0.05, cy - s * 0.22, f) + Math.sin(t * 0.35) * f * s * 0.012;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.setLineDash([s * 0.008, s * 0.006]);
    stroke(ctx, [247, 224, 155], 0.9, Math.max(2, s * 0.005)); ctx.setLineDash([]);
    pocketWatch(ctx, cx, cy + Math.sin(t * 0.4) * s * 0.015, s * 0.19, t, m);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + t * 0.095;
      const radius = s * (0.32 + Math.sin(t * 0.5 + i) * 0.015);
      const x = cx + Math.cos(a) * radius * 1.15, y = cy + Math.sin(a) * radius * 0.8;
      for (let echo = reduced ? 0 : 2; echo >= 0; echo--) {
        star(ctx, x - echo * Math.sin(a) * 9, y + echo * Math.cos(a) * 9,
          s * (0.018 + (i % 2) * 0.008), a, echo ? 0.1 / echo : 0.9);
      }
    }
    // Three broad paper sails cross the lower current, each with visible folds.
    for (let i = 0; i < 3; i++) {
      const travel = (t * 0.035 + i / 3) % 1;
      const x = w * (travel * 1.2 - 0.1), y = h * (0.72 + Math.sin(t * 0.6 + i * 2) * 0.07);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.6 + i) * 0.18);
      const r = s * (0.055 + i * 0.008);
      ctx.beginPath(); ctx.moveTo(-r, r * 0.4); ctx.lineTo(r, -r * 0.65);
      ctx.lineTo(r * 0.25, r * 0.72); ctx.lineTo(0, r * 0.1); ctx.closePath();
      ctx.fillStyle = color(i % 2 ? [249, 216, 130] : [245, 225, 235], 0.86); ctx.fill();
      stroke(ctx, [39, 86, 98], 0.6, 1.5);
      ctx.beginPath(); ctx.moveTo(0, r * 0.1); ctx.lineTo(r, -r * 0.65);
      stroke(ctx, [39, 86, 98], 0.5, 1); ctx.restore();
    }
  }

  function draw(ctx, w, h, state) {
    if (!active || w <= 0 || h <= 0) return;
    const time = Math.max(0, Number(state.time) || 0);
    const m = motionAt(active, time, state.energy || 0);
    const reduced = reducedMotion.matches;
    if (reduced) m.pulse = 0;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (active.key === 'petal-lament') drawPetal(ctx, w, h, time, m, active, reduced);
    else drawMarshmary(ctx, w, h, time, m, active, reduced);
    ctx.restore();
  }

  return Object.freeze({ track, activate, draw, motionAt });
})();
