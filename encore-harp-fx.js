window.EncoreHarpFx = (() => {
  'use strict';

  const SRC_DUR = 137.23;
  const HARP_DUR = 144.149;
  const SRC_BPM = 132;
  const SRC_BEAT_OFFSET = 0.32;
  const STRING_N = 44;
  const CHORUSES = [
    [33.06, 47.5],
    [72.9, 87.38],
    [102.32, 116.56],
    [124.22, 132.78]
  ];
  const PALETTES = [
    { bg: [27, 2, 6], primary: [193, 24, 45], secondary: [246, 191, 174], accent: [255, 240, 220] },
    { bg: [38, 2, 8], primary: [230, 38, 68], secondary: [217, 111, 116], accent: [255, 232, 211] },
    { bg: [53, 1, 9], primary: [255, 38, 79], secondary: [255, 137, 133], accent: [255, 239, 213] },
    { bg: [19, 2, 9], primary: [150, 24, 57], secondary: [196, 104, 126], accent: [255, 226, 211] },
    { bg: [25, 2, 13], primary: [211, 40, 85], secondary: [176, 101, 141], accent: [250, 225, 214] },
    { bg: [47, 1, 12], primary: [255, 41, 93], secondary: [255, 135, 153], accent: [255, 238, 213] },
    { bg: [10, 1, 4], primary: [255, 30, 72], secondary: [230, 75, 116], accent: [255, 226, 195] },
    { bg: [61, 1, 11], primary: [255, 44, 79], secondary: [255, 154, 135], accent: [255, 242, 218] },
    { bg: [23, 1, 7], primary: [205, 30, 65], secondary: [219, 112, 128], accent: [255, 235, 215] },
    { bg: [67, 1, 10], primary: [255, 48, 77], secondary: [255, 179, 141], accent: [255, 246, 221] },
    { bg: [13, 1, 4], primary: [133, 24, 46], secondary: [160, 91, 101], accent: [218, 194, 184] }
  ];
  const MOTES = Array.from({ length: 36 }, (_, i) => ({
    x: 0.02 + Math.sin(i * 29.17) * 0.48 + 0.48,
    y: 0.05 + Math.sin(i * 61.43) * 0.43 + 0.43,
    size: 1.1 + (i % 7) * 0.45,
    phase: i * 0.71,
    speed: 0.18 + (i % 5) * 0.08
  }));

  let ctx = null;
  let width = 0, height = 0, u = 1, last = performance.now();
  const smoothed = { energy: 0.08, onset: 0, bass: 0.08, highs: 0.05 };
  const plucks = new Float32Array(STRING_N);
  let lastBeat = -1;
  let lastPhase = -1;
  let lastPeak = false;
  let lastTime = 0;
  let wipeAt = -10;
  const TAU = Math.PI * 2;
  const GOLD = [212, 175, 90];
  const NIGHT = [36, 58, 118];

  const clamp = (a, b, v) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const hash = (v) => { const x = Math.sin(v * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
  const hex = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  const bez3 = (a, b, c, d, t) => {
    const u = 1 - t, uu = u * u, tt = t * t;
    return [
      uu * u * a[0] + 3 * uu * t * b[0] + 3 * u * tt * c[0] + tt * t * d[0],
      uu * u * a[1] + 3 * uu * t * b[1] + 3 * u * tt * c[1] + tt * t * d[1]
    ];
  };
  const bez2 = (a, b, c, t) => {
    const u = 1 - t;
    return [
      u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
      u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]
    ];
  };
  let duration = HARP_DUR;
  let sections = [];

  function timeScale() {
    return (duration > 1 ? duration : HARP_DUR) / SRC_DUR;
  }
  function srcTime(t) {
    return t / timeScale();
  }
  function inChorus(t) {
    const src = srcTime(t);
    return CHORUSES.some(([a, b]) => src >= a && src < b);
  }

  function sectionAt(t) {
    return sections.find((s) => t >= s.start && t < s.end)
      || sections[sections.length - 1]
      || { phase: 0, chorus: false };
  }

  function beatState(t) {
    const scale = timeScale();
    const pos = Math.max(0, (t - SRC_BEAT_OFFSET * scale) * (SRC_BPM / scale) / 60);
    const phase = pos - Math.floor(pos);
    return {
      index: Math.floor(pos),
      phase,
      pulse: Math.pow(1 - phase, 5.4),
      halfPulse: Math.pow(1 - ((phase + 0.5) % 1), 7)
    };
  }

  function analyze(dt, input, paused) {
    const energy = paused ? 0 : (input.energy ?? 0.08);
    const onset = paused ? 0 : (input.onset ?? 0);
    const bass = paused ? 0 : (input.bass ?? 0.08);
    const highs = paused ? 0 : (input.highs ?? 0.05);
    const follow = (cur, target, up, down) => mix(cur, target, 1 - Math.exp(-dt * (target > cur ? up : down)));
    smoothed.energy = follow(smoothed.energy, energy, 13, 4);
    smoothed.onset = follow(smoothed.onset, onset, 18, 7);
    smoothed.bass = follow(smoothed.bass, bass, 12, 3.8);
    smoothed.highs = follow(smoothed.highs, highs, 15, 6);
  }

  function drawStar(x, y, r, color, alpha, rot) {
    if (alpha < 0.008 || r <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let p = 0; p < 8; p++) {
      const a = p * Math.PI / 4 - Math.PI / 2;
      const d = p % 2 ? r * 0.32 : r;
      const px = Math.cos(a) * d, py = Math.sin(a) * d;
      p ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
    ctx.restore();
  }

  const STAGE_Y = 0.64;

  function sceneLayout(phase, peak) {
    if (phase === 6) return { horizon: 0.46, night: 0, breakX: 1 };
    if ([3, 4].includes(phase)) return { horizon: 0.70, night: 1, breakX: 0 };
    if (peak) return { horizon: 0.56, night: 0, breakX: 0 };
    return { horizon: STAGE_Y, night: 0, breakX: 0 };
  }

  function drawWorld(time, beat, palette, energy, peak, phase, live) {
    const layout = sceneLayout(phase, peak);
    const bgA = layout.night
      ? [mix(palette.bg[0], NIGHT[0], 0.55), mix(palette.bg[1], NIGHT[1], 0.55), mix(palette.bg[2], NIGHT[2], 0.7)]
      : palette.bg;
    const bgB = layout.breakX
      ? [8, 0, 2]
      : [5, 0, 2];
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, hex(bgA));
    base.addColorStop(0.5, `rgb(${Math.min(255, bgA[0] + 18)}, ${bgA[1]}, ${Math.min(255, bgA[2] + 8)})`);
    base.addColorStop(1, hex(bgB));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    if (peak) {
      ctx.fillStyle = rgba(palette.primary, 0.28 + energy * 0.22);
      ctx.beginPath();
      ctx.ellipse(width * (0.2 + Math.sin(time * 0.16) * 0.06), height * 0.3, width * 0.42, height * 0.38, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(layout.night ? NIGHT : palette.secondary, 0.22 + energy * 0.18);
      ctx.beginPath();
      ctx.ellipse(width * (0.8 + Math.cos(time * 0.14) * 0.05), height * 0.62, width * 0.38, height * 0.34, 0, 0, TAU);
      ctx.fill();
    }

    const horizon = height * layout.horizon;
    const rows = peak ? 11 : 7;
    const columns = peak ? 18 : 12;
    const scroll = live ? ((beat.phase + 0.12) % 1) : 0.12;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, width, height - horizon);
    ctx.clip();
    for (let row = 0; row < rows; row++) {
      const near = (row + scroll) / rows;
      const y0 = horizon + (near ** 1.85) * (height - horizon);
      const next = (row + 1 + scroll) / rows;
      const y1 = horizon + (next ** 1.85) * (height - horizon);
      const rowAlpha = (0.10 + energy * 0.16 + beat.pulse * 0.08) * (0.45 + near * 0.8);
      for (let column = 0; column < columns; column++) {
        if ((column + row + beat.index) % 2) continue;
        const spread0 = 0.18 + near * 0.82;
        const spread1 = 0.18 + next * 0.82;
        const x00 = width * 0.5 + (column / columns - 0.5) * width * spread0 * 1.35;
        const x01 = width * 0.5 + ((column + 1) / columns - 0.5) * width * spread0 * 1.35;
        const x10 = width * 0.5 + (column / columns - 0.5) * width * spread1 * 1.35;
        const x11 = width * 0.5 + ((column + 1) / columns - 0.5) * width * spread1 * 1.35;
        ctx.beginPath();
        ctx.moveTo(x00, y0); ctx.lineTo(x01, y0); ctx.lineTo(x11, y1); ctx.lineTo(x10, y1);
        ctx.closePath();
        ctx.fillStyle = rgba((row + column) % 4 ? palette.primary : palette.accent, rowAlpha);
        ctx.fill();
      }
    }
    ctx.strokeStyle = rgba(GOLD, 0.55 + energy * 0.25);
    ctx.lineWidth = 1.4 * u;
    for (let lane = -6; lane <= 6; lane++) {
      ctx.beginPath();
      ctx.moveTo(width * 0.5 + lane * width * 0.025, horizon);
      ctx.lineTo(width * 0.5 + lane * width * 0.13, height);
      ctx.stroke();
    }
    ctx.restore();

    if (layout.night) {
      const moonX = width * 0.78, moonY = height * 0.22, r = Math.min(width, height) * 0.12;
      ctx.fillStyle = rgba(palette.accent, 0.55 + energy * 0.25);
      ctx.beginPath(); ctx.arc(moonX, moonY, r * 0.72, 0, TAU); ctx.fill();
      ctx.strokeStyle = hex(palette.accent);
      ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(moonX, moonY, r * 0.72, 0, TAU); ctx.stroke();
    }

    const opening = 0.11 + (peak ? 0.08 : 0) + energy * 0.02;
    for (const side of [-1, 1]) {
      ctx.save();
      if (side > 0) { ctx.translate(width, 0); ctx.scale(-1, 1); }
      const edge = width * opening;
      const curtain = ctx.createLinearGradient(0, 0, edge, 0);
      curtain.addColorStop(0, rgba([42, 7, 25], 0.92));
      curtain.addColorStop(1, rgba(palette.primary, 0.55));
      ctx.fillStyle = curtain;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(edge, 0);
      ctx.bezierCurveTo(edge * 0.9, height * 0.28, edge * 0.7, height * 0.72, edge * 0.88, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const moteCount = live ? (peak ? 36 : 20) : 0;
    for (let i = 0; i < moteCount; i++) {
      const mote = MOTES[i];
      const speed = peak ? 1.75 : 0.62;
      const x = ((mote.x + time * mote.speed * 0.009 * speed) % 1.08 - 0.04) * width;
      const y = (mote.y + Math.sin(time * (0.22 + mote.speed) + mote.phase) * (peak ? 0.035 : 0.012)) * height;
      const twinkle = 0.5 + Math.sin(time * (0.8 + mote.speed) + mote.phase) * 0.5;
      drawStar(
        x, y,
        mote.size * (1.1 + energy * 0.6 + beat.pulse * 0.25),
        i % 4 ? palette.accent : GOLD,
        (0.22 + energy * 0.35 + beat.pulse * 0.18) * (0.55 + twinkle * 0.45),
        mote.phase + time * 0.04
      );
    }

    return horizon;
  }

  function drawScreenFx(time, beat, palette, energy, peak, phase, wipe) {
    const sliceCount = peak ? 9 : 4;
    for (let slice = 0; slice < sliceCount; slice++) {
      const lane = (slice + beat.index * 0.25) % sliceCount;
      const x = width * (lane / Math.max(1, sliceCount - 1));
      const lean = height * (slice % 2 ? 0.16 : -0.14);
      ctx.beginPath();
      ctx.moveTo(x - lean, height);
      ctx.lineTo(x + lean, 0);
      ctx.strokeStyle = hex(slice % 3 ? palette.primary : palette.secondary);
      ctx.globalAlpha = 0.72 + energy * 0.2;
      ctx.lineWidth = (slice % 3 === 0 ? 5 : 2) * u;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (let staff = 0; staff < 2; staff++) {
      const baseY = height * (staff ? 0.74 : 0.22);
      const wave = Math.sin(time * 0.58 + staff * 2.2) * height * 0.03;
      for (let line = 0; line < 5; line++) {
        const y = baseY + (line - 2) * 10 + wave;
        ctx.fillStyle = hex(staff ? palette.accent : GOLD);
        ctx.fillRect(0, y, width, (line === 2 ? 3 : 2) * u);
      }
      const notes = peak ? 6 : 4;
      for (let note = 0; note < notes; note++) {
        const travel = (time * (peak ? 0.18 : 0.1) + note / notes + staff * 0.37) % 1.12;
        const x = (travel - 0.06) * width;
        const y = baseY + wave + Math.sin(travel * TAU + staff * Math.PI) * height * 0.05;
        ctx.fillStyle = hex(staff ? palette.accent : GOLD);
        ctx.beginPath();
        ctx.ellipse(x, y, 8 * u, 5.5 * u, -0.24, 0, TAU);
        ctx.fill();
        ctx.fillRect(x + 6 * u, y - 22 * u, 2.2 * u, 22 * u);
      }
    }

    const barN = peak ? 7 : 4;
    for (let i = 0; i < barN; i++) {
      const y = ((time * (0.28 + i * 0.03) + i / barN) % 1.18 - 0.08) * height;
      ctx.fillStyle = hex(i % 2 ? palette.accent : palette.primary);
      ctx.fillRect(0, y, width, (i % 3 === 0 ? 8 : 3) * u);
    }
    if (peak && beat.pulse > 0.35) {
      const y = height * (0.16 + (beat.index % 6) * 0.12);
      ctx.fillStyle = hex(palette.accent);
      ctx.fillRect(0, y, width, (7 + beat.pulse * 10) * u);
    }

    const ribbonN = peak ? 4 : 2;
    ctx.lineCap = 'round';
    for (let ribbon = 0; ribbon < ribbonN; ribbon++) {
      const phaseR = time * (0.28 + ribbon * 0.025) + ribbon * 1.7;
      const y = height * (0.28 + ribbon * 0.16) + Math.sin(phaseR) * height * 0.05;
      ctx.beginPath();
      ctx.moveTo(-width * 0.08, y);
      ctx.bezierCurveTo(
        width * 0.24, y - height * 0.16 * Math.sin(phaseR * 0.7),
        width * 0.7, y + height * 0.14 * Math.cos(phaseR * 0.6),
        width * 1.08, y
      );
      ctx.strokeStyle = hex(ribbon % 2 ? GOLD : palette.accent);
      ctx.lineWidth = (5 + (peak ? 2 : 0)) * u;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    if (peak) {
      for (let beam = 0; beam < 3; beam++) {
        const origin = width * (0.22 + beam * 0.28);
        const sweep = Math.sin(time * (0.36 + beam * 0.04) + beam * 1.8);
        const bw = width * (0.028 + beat.pulse * 0.02);
        ctx.fillStyle = rgba(beam % 2 ? palette.accent : GOLD, 0.28 + beat.pulse * 0.18);
        ctx.beginPath();
        ctx.moveTo(origin - bw, 0);
        ctx.lineTo(origin + bw, 0);
        ctx.lineTo(origin + sweep * width * 0.22 + bw * 2, height);
        ctx.lineTo(origin + sweep * width * 0.22 - bw * 2, height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = rgba(palette.accent, beat.halfPulse * 0.12);
      ctx.fillRect(0, 0, width, height);
      const wipeW = width * (0.02 + beat.pulse * 0.06);
      ctx.fillStyle = hex(palette.accent);
      ctx.fillRect(0, 0, wipeW, height);
      ctx.fillRect(width - wipeW, 0, wipeW, height);
    }

    const glyphN = peak ? 16 : 8;
    for (let i = 0; i < glyphN; i++) {
      const gx = ((hash(i * 17.3) + time * (0.06 + hash(i * 3) * 0.05)) % 1.1 - 0.05) * width;
      const gy = (hash(i * 41.9) + Math.sin(time * 0.35 + i) * 0.04) * height;
      const gs = 6 + hash(i * 9) * 8;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(time * 0.2 + i);
      ctx.strokeStyle = hex(i % 2 ? palette.accent : GOLD);
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(0, -gs); ctx.lineTo(gs * 0.7, 0); ctx.lineTo(0, gs); ctx.lineTo(-gs * 0.7, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (wipe < 1) {
      ctx.fillStyle = rgba(palette.accent, (1 - wipe) * 0.42);
      ctx.fillRect(0, 0, width, height);
      const blinds = 12;
      const h = height / blinds;
      for (let i = 0; i < blinds; i++) {
        const open = Math.min(1, wipe * 1.4 - i * 0.03);
        ctx.fillStyle = hex(i % 2 ? palette.primary : palette.bg);
        ctx.fillRect(width * open, i * h, width * (1 - open), h * 0.72);
      }
      ctx.fillStyle = hex(palette.accent);
      ctx.fillRect(wipe * width, 0, 18 * u, height);
    }

    if (beat.halfPulse > 0.72 && peak) {
      ctx.strokeStyle = hex(palette.accent);
      ctx.lineWidth = 4 * u;
      ctx.strokeRect(width * 0.018, height * 0.025, width * 0.964, height * 0.95);
    }
  }

  function harpNeckIn(W, H) {
    return [[30, -H * 0.43], [W * 0.34, -H * 0.52], [W * 0.76, -H * 0.12], [W * 0.72, H * 0.06]];
  }
  function harpBoardIn(W, H) {
    return [[30, H * 0.345], [W * 0.50, H * 0.44], [W * 0.72, H * 0.10]];
  }
  function harpOpening(ctx, W, H) {
    const n = harpNeckIn(W, H);
    const b = harpBoardIn(W, H);
    ctx.beginPath();
    ctx.moveTo(n[0][0], n[0][1]);
    ctx.bezierCurveTo(n[1][0], n[1][1], n[2][0], n[2][1], n[3][0], n[3][1]);
    ctx.lineTo(b[2][0], b[2][1]);
    ctx.quadraticCurveTo(b[1][0], b[1][1], b[0][0], b[0][1]);
    ctx.closePath();
  }

  function drawHarp(x, y, scale, time, energy, highs, peak, palette) {
    const W = 210, H = 430;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = rgba([0, 0, 0], 0.28);
    ctx.beginPath();
    ctx.ellipse(W * 0.42, H * 0.48, W * 0.55, 18, 0, 0, TAU);
    ctx.fill();

    const cream = palette.accent;
    const wood = GOLD;
    const n = harpNeckIn(W, H);
    const b = harpBoardIn(W, H);

    ctx.fillStyle = rgba(cream, 0.97);
    ctx.beginPath();
    ctx.moveTo(-8, H * 0.50);
    ctx.lineTo(32, H * 0.50);
    ctx.lineTo(36, -H * 0.54);
    ctx.lineTo(-4, -H * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(wood, 0.55);
    ctx.fillRect(8, -H * 0.53, 14, H * 1.02);

    ctx.beginPath();
    ctx.moveTo(18, -H * 0.54);
    ctx.bezierCurveTo(W * 0.44, -H * 0.64, W * 0.98, -H * 0.18, W * 0.92, H * 0.18);
    ctx.lineTo(n[3][0], n[3][1]);
    ctx.bezierCurveTo(n[2][0], n[2][1], n[1][0], n[1][1], n[0][0], n[0][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(cream, 0.96);
    ctx.fill();
    ctx.strokeStyle = rgba(wood, 0.6);
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16, H * 0.48);
    ctx.quadraticCurveTo(W * 0.52, H * 0.60, W * 0.90, H * 0.22);
    ctx.lineTo(b[2][0], b[2][1]);
    ctx.quadraticCurveTo(b[1][0], b[1][1], b[0][0], b[0][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(cream, 0.94);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgba(cream, 0.96);
    ctx.fillRect(-10, H * 0.46, 42, 16);

    ctx.save();
    harpOpening(ctx, W, H);
    ctx.clip();
    ctx.fillStyle = rgba([18, 4, 8], 0.72);
    ctx.fill();
    for (let i = 0; i < STRING_N; i++) {
      plucks[i] *= 0.84;
      const t = i / (STRING_N - 1);
      const neck = bez3(n[0], n[1], n[2], n[3], t);
      const board = bez2(b[0], b[1], b[2], t);
      const dx = board[0] - neck[0];
      const dy = board[1] - neck[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const wobble = Math.sin(time * (16 + i * 0.55) + i) * (0.4 + highs * 2.2)
        + plucks[i] * 3.2 * Math.sin(time * 54 + i);
      ctx.strokeStyle = rgba(GOLD, 0.78 + energy * 0.2 + plucks[i] * 0.2);
      ctx.lineWidth = mix(2.4, 0.8, t) + plucks[i] * 0.7;
      ctx.beginPath();
      ctx.moveTo(neck[0], neck[1]);
      ctx.lineTo(board[0] + nx * wobble, board[1] + ny * wobble);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = rgba(wood, 0.7);
    ctx.lineWidth = 1.6;
    harpOpening(ctx, W, H);
    ctx.stroke();
    ctx.restore();
  }

  function pianoWing(ctx) {
    ctx.beginPath();
    ctx.moveTo(-128, 96);
    ctx.lineTo(128, 96);
    ctx.lineTo(128, 70);
    ctx.bezierCurveTo(138, 8, 126, -78, 68, -158);
    ctx.bezierCurveTo(36, -198, 10, -214, 0, -218);
    ctx.bezierCurveTo(-22, -214, -62, -172, -82, -96);
    ctx.bezierCurveTo(-112, -18, -126, 42, -128, 70);
    ctx.closePath();
  }

  function drawPiano(x, y, scale, time, bass, pulse, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const cream = palette.accent;

    ctx.fillStyle = rgba([0, 0, 0], 0.32);
    ctx.beginPath();
    ctx.ellipse(0, 108, 150, 18, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(-118, 40);
    ctx.rotate(-0.48);
    ctx.translate(118, -40);
    ctx.fillStyle = rgba(cream, 0.88);
    pianoWing(ctx);
    ctx.fill();
    ctx.strokeStyle = rgba(GOLD, 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = rgba(cream, 0.97);
    pianoWing(ctx);
    ctx.fill();
    ctx.strokeStyle = rgba(GOLD, 0.55);
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.save();
    pianoWing(ctx);
    ctx.clip();
    ctx.fillStyle = rgba(palette.bg, 0.28);
    ctx.fillRect(-120, -220, 250, 280);
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      const x0 = mix(-108, 108, t);
      const x1 = mix(-48, 42, t);
      const wobble = Math.sin(time * (10 + i * 0.4) + i) * (0.4 + bass * 1.8);
      ctx.strokeStyle = rgba(GOLD, 0.28 + bass * 0.4 + pulse * 0.2);
      ctx.lineWidth = mix(1.8, 0.6, t);
      ctx.beginPath();
      ctx.moveTo(x0, 68);
      ctx.lineTo(x1 + wobble, -200);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = rgba(palette.bg, 0.55);
    ctx.fillRect(-128, 70, 256, 32);
    const whites = 26;
    const kw = 256 / whites;
    for (let i = 0; i < whites; i++) {
      ctx.fillStyle = rgba(cream, 0.96);
      ctx.fillRect(-128 + i * kw, 72, kw - 0.8, 26);
      ctx.strokeStyle = rgba(palette.bg, 0.35);
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-128 + i * kw, 72, kw - 0.8, 26);
    }
    for (let i = 0; i < whites; i++) {
      if (![0, 1, 3, 4, 5].includes(i % 7)) continue;
      ctx.fillStyle = rgba(palette.bg, 0.78);
      ctx.fillRect(-128 + i * kw + kw * 0.65, 72, kw * 0.55, 16);
    }

    ctx.strokeStyle = rgba(GOLD, 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-90, 96); ctx.lineTo(-90, 118);
    ctx.moveTo(0, 96); ctx.lineTo(0, 118);
    ctx.moveTo(90, 96); ctx.lineTo(90, 118);
    ctx.stroke();
    ctx.restore();
  }

  function drawFrames(beat, energy, palette) {
    for (let i = 0; i < 4; i++) {
      const p = (beat.phase + i / 4) % 1;
      const inset = 16 + p * Math.min(width, height) * 0.22;
      ctx.strokeStyle = rgba(palette.accent, (1 - p) * (0.18 + energy * 0.28 + beat.pulse * 0.22));
      ctx.lineWidth = (2.4 + beat.pulse * 2.2) * u;
      ctx.strokeRect(inset, inset * 0.62, width - inset * 2, height - inset * 1.24);
    }
  }

  function reset() {
    wipeAt = -10;
    lastBeat = -1;
    lastPeak = false;
    lastPhase = -1;
    lastTime = 0;
    plucks.fill(0);
  }

  function draw(drawCtx, drawWidth, drawHeight, input = {}) {
    ctx = drawCtx;
    width = drawWidth;
    height = drawHeight;
    u = Math.min(width, height) / 900;
    const now = performance.now();
    const dt = clamp(0.001, 0.05, (now - last) / 1000);
    last = now;
    const time = input.time || 0;
    duration = input.duration > 1 ? input.duration : HARP_DUR;
    sections = input.sections || [];
    const ended = !!input.ended;
    const paused = !!input.paused;
    const seeking = !!input.seeking;
    const src = srcTime(time);
    const section = sectionAt(src);
    const beat = beatState(time);
    const peak = inChorus(time);
    const palette = PALETTES[section.phase % PALETTES.length];
    const tailStart = (sections.find((s) => s.phase === 10)?.start ?? 133) * timeScale();
    const live = !ended && time < tailStart;
    analyze(dt, input, paused || !live);
    if (live && beat.index !== lastBeat) {
      lastBeat = beat.index;
      const n = peak ? 8 : 3;
      for (let k = 0; k < n; k++) plucks[Math.floor(hash(beat.index * 13.1 + k) * STRING_N)] = 1;
    }
    if (live && smoothed.onset > 0.38) {
      plucks[Math.floor(hash(now * 0.002) * STRING_N)] = Math.min(1, smoothed.onset + 0.35);
    }
    const fade = ended ? 0 : (live ? 1 : clamp(0, 1, (duration - time) / Math.max(0.4, duration - tailStart)));

    const jumped = Math.abs(time - lastTime) > 0.25;
    lastTime = time;
    lastPhase = section.phase;
    if (peak && !lastPeak && live && !jumped && !seeking && !paused) wipeAt = time;
    else if (jumped || seeking || !peak) wipeAt = -10;
    lastPeak = peak;
    const wipe = (!live || !peak || wipeAt < 0 || time < wipeAt) ? 1 : clamp(0, 1, (time - wipeAt) / 0.4);

    if (!live) {
      smoothed.energy = 0;
      smoothed.onset = 0;
      smoothed.bass = 0;
      smoothed.highs = 0;
      plucks.fill(0);
    }

    drawWorld(time, live ? beat : { ...beat, pulse: 0, halfPulse: 0 }, palette, live ? smoothed.energy : 0, peak && live, section.phase, live);
    if (live) {
      drawScreenFx(time, beat, palette, smoothed.energy, peak, section.phase, wipe);
      if (peak) drawFrames(beat, smoothed.energy, palette);
    }

    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, width * 0.18, width * 0.5, height * 0.48, width * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    const s = Math.min(width, height) / 780;
    const stageY = height * STAGE_Y;
    drawPiano(width * 0.66, stageY - 10 * s, s * 1.15, time, live ? smoothed.bass : 0, live ? beat.pulse : 0, palette);
    drawHarp(width * 0.28, stageY - 30 * s, s * 1.18, time, live ? smoothed.energy : 0, live ? smoothed.highs : 0, peak && live, palette);

    if (fade < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
      ctx.fillRect(0, 0, width, height);
    }

    const root = document.documentElement;
    const energy = live ? smoothed.energy : 0;
    root.style.setProperty('--encore-primary', hex(palette.primary));
    root.style.setProperty('--encore-secondary', hex(palette.secondary));
    root.style.setProperty('--encore-accent', hex(palette.accent));
    root.style.setProperty('--encore-energy', energy.toFixed(3));
    root.style.setProperty('--encore-beat', (live ? beat.pulse : 0).toFixed(3));
    return { palette, energy, peak: peak && live };
  }

  return { draw, reset };
})();
