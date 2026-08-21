(() => {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const audio = document.getElementById('audio');
  const play = document.getElementById('play');
  const playIcon = document.getElementById('play-icon');
  const seek = document.getElementById('seek');
  const mute = document.getElementById('mute');
  const currentTimeEl = document.getElementById('current-time');
  const durationEl = document.getElementById('duration');
  const chapterIndex = document.getElementById('chapter-index');
  const chapterName = document.getElementById('chapter-name');
  const chapterDetail = document.getElementById('chapter-detail');
  const worldLabel = document.getElementById('world-label');
  const bearingValue = document.getElementById('bearing-value');
  const lyricPrevious = document.getElementById('lyric-previous');
  const lyricCurrent = document.getElementById('lyric-current');
  const lyricNext = document.getElementById('lyric-next');
  const query = new URLSearchParams(location.search);
  const LRCLIB_RECORD_ID = 20027796;
  const LRCLIB_RECORD_URL = `https://lrclib.net/api/get/${LRCLIB_RECORD_ID}`;
  const LRCLIB_CLIENT = 'vp-violet-demo/1.0 (https://github.com/turbodog111/vp)';
  const LRCLIB_CACHE_KEY = `vp-lyrics-provider:lrclib:${LRCLIB_RECORD_ID}`;
  const previewTime = Number(query.get('preview'));
  const previewMode = Number.isFinite(previewTime) && previewTime >= 0;

  const palette = {
    black: '#030108',
    deep: '#0a0618',
    violet: '#915bef',
    magenta: '#f257ca',
    ice: '#cce0ff',
    white: '#f7f5ff',
    red: '#ff416f',
    silver: '#b9bfd2',
    heath: '#7f61a8',
    moss: '#293226',
    gold: '#d6ad68'
  };

  const interludes = [
    'Two futures share one frame.',
    'The mirror remembers first.',
    'Pain acquires an orbit.',
    'The thread pulls taut.',
    'Nothing deletes cleanly.',
    'A white interval.',
    'The orbit reverses.',
    'Two answers remain.',
    'Violet outlives the message.'
  ];

  let data = null;
  let energyEnvelope = [];
  let onsetEnvelope = [];
  let dpr = 1;
  let width = 0;
  let height = 0;
  let activeLineIndex = -2;
  let seekActive = false;
  let displayTime = previewMode ? previewTime : 0;
  let lastFrame = performance.now();

  const clamp = (min, max, value) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smoothStep = (a, b, value) => {
    const t = clamp(0, 1, (value - a) / Math.max(0.0001, b - a));
    return t * t * (3 - 2 * t);
  };
  const hash = value => {
    const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function rgba(hex, alpha) {
    const value = hex.replace('#', '');
    const number = parseInt(value.length === 3 ? value.split('').map(char => char + char).join('') : value, 16);
    return `rgba(${number >> 16}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
  }

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function decodeEnvelope(encoded) {
    if (!encoded) return [];
    const raw = atob(encoded);
    return Array.from(raw, char => char.charCodeAt(0) / 255);
  }

  function envelopeAt(values, time) {
    const step = data?.analysis?.step || 0.1;
    if (!values.length) return 0;
    const position = clamp(0, values.length - 1, time / step);
    const lower = Math.floor(position);
    return mix(values[lower], values[Math.min(values.length - 1, lower + 1)], position - lower);
  }

  function recordedAt(time) {
    return {
      energy: envelopeAt(energyEnvelope, time),
      onset: envelopeAt(onsetEnvelope, time)
    };
  }

  function currentSection(time) {
    return data?.sections?.find(section => time >= section.start && time < section.end)
      || data?.sections?.[data.sections.length - 1]
      || { phase: 0, short: 'DIVERGENCE', name: 'At the gate' };
  }

  function isPeak(section) {
    return [2, 4, 7].includes(section.phase);
  }

  function beatAt(time) {
    const bpm = data?.bpm || 161.499;
    const offset = data?.beatOffset || 1.37;
    const beats = Math.max(0, (time - offset) * bpm / 60);
    const phase = beats - Math.floor(beats);
    return {
      index: Math.floor(beats),
      phase,
      pulse: Math.exp(-phase * 7.4),
      alternate: Math.floor(beats) % 2
    };
  }

  function phaseIntensity(section, recorded, beat) {
    const base = [0.2, 0.42, 0.96, 0.56, 1.12, 0.14, 0.52, 1.04, 0.38][section.phase] ?? 0.35;
    return clamp(0, 1.35, base + recorded.energy * 0.24 + recorded.onset * 0.18 + (isPeak(section) ? beat.pulse * 0.2 : 0));
  }

  function drawBase(time, section, recorded, beat, intensity) {
    const phase = section.phase;
    const voidPhase = phase === 5;
    const peak = isPeak(section);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    if (voidPhase) {
      gradient.addColorStop(0, '#b9b5c6');
      gradient.addColorStop(0.5, '#eeeaf1');
      gradient.addColorStop(1, '#8b879b');
    } else if (phase >= 6) {
      gradient.addColorStop(0, '#090519');
      gradient.addColorStop(0.45, '#12092a');
      gradient.addColorStop(1, '#220525');
    } else {
      gradient.addColorStop(0, '#120425');
      gradient.addColorStop(0.5, '#090417');
      gradient.addColorStop(1, '#05010c');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (voidPhase) return;

    const leftGlow = ctx.createRadialGradient(width * 0.18, height * 0.5, 0, width * 0.18, height * 0.5, width * 0.58);
    leftGlow.addColorStop(0, rgba(phase >= 6 ? palette.ice : palette.violet, 0.08 + intensity * (peak ? 0.2 : 0.12)));
    leftGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, width, height);

    const rightGlow = ctx.createRadialGradient(width * 0.82, height * 0.5, 0, width * 0.82, height * 0.5, width * 0.58);
    rightGlow.addColorStop(0, rgba(phase >= 6 ? palette.violet : palette.magenta, 0.075 + intensity * (peak ? 0.21 : 0.13)));
    rightGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(0, 0, width, height);

    if (peak) {
      ctx.fillStyle = rgba(beat.alternate ? palette.magenta : palette.ice, 0.045 + beat.pulse * 0.105 + recorded.onset * 0.055);
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawStormMoor(time, section, recorded, beat, intensity) {
    if (section.phase === 5) return;
    const peak = isPeak(section);
    const wind = 0.38 + intensity * 0.24 + recorded.energy * 0.22;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let band = 0; band < 7; band++) {
      const bandWidth = width * (0.34 + hash(band * 8.7) * 0.24);
      const travel = width + bandWidth * 2;
      const direction = band % 2 ? -1 : 1;
      const raw = (time * (10 + band * 1.7) * direction + hash(band * 12.1) * travel) % travel;
      const x = raw - bandWidth;
      const y = height * (0.08 + band * 0.07) + Math.sin(time * 0.12 + band) * height * 0.018;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, bandWidth * 0.58);
      cloud.addColorStop(0, rgba(band % 3 ? palette.violet : palette.silver, 0.022 + intensity * 0.018 + recorded.energy * 0.025));
      cloud.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cloud;
      ctx.fillRect(x - bandWidth, y - height * 0.14, bandWidth * 2, height * 0.28);
    }

    const rainCount = peak ? 58 : 34;
    ctx.lineCap = 'round';
    for (let drop = 0; drop < rainCount; drop++) {
      const speed = 58 + hash(drop * 4.3) * 92;
      const x = ((hash(drop * 11.7) * (width + 220) + time * speed * 0.28) % (width + 220)) - 110;
      const y = ((hash(drop * 21.1) * (height + 180) + time * speed) % (height + 180)) - 90;
      const length = 14 + hash(drop * 2.9) * (peak ? 44 : 28);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - length * wind, y + length);
      ctx.strokeStyle = rgba(drop % 5 ? palette.ice : palette.violet, 0.025 + intensity * 0.023 + recorded.onset * 0.08);
      ctx.lineWidth = drop % 9 === 0 ? 1.35 : 0.65;
      ctx.stroke();
    }
    ctx.restore();

    const horizon = height * (0.74 + Math.sin(time * 0.08) * 0.006);
    const moor = ctx.createLinearGradient(0, horizon - height * 0.08, 0, height);
    moor.addColorStop(0, rgba(palette.heath, 0.08 + intensity * 0.04));
    moor.addColorStop(0.35, rgba(palette.moss, 0.72));
    moor.addColorStop(1, rgba(palette.black, 0.96));
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, horizon);
    for (let point = 0; point <= 40; point++) {
      const progress = point / 40;
      const x = progress * width;
      const y = horizon
        + Math.sin(progress * Math.PI * 2.3 + time * 0.055) * height * 0.024
        + Math.sin(progress * Math.PI * 7.1 - time * 0.035) * height * 0.009;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = moor;
    ctx.fill();

    const sprigs = peak ? 38 : 28;
    for (let sprig = 0; sprig < sprigs; sprig++) {
      const x = hash(sprig * 17.37) * width;
      const ground = horizon + height * (0.02 + hash(sprig * 7.9) * 0.23);
      const heightScale = height * (0.025 + hash(sprig * 3.7) * 0.065);
      const sway = Math.sin(time * (0.55 + hash(sprig) * 0.16) + sprig) * heightScale * (0.08 + wind * 0.11);
      const topX = x + sway;
      const topY = ground - heightScale;
      ctx.beginPath();
      ctx.moveTo(x, ground);
      ctx.quadraticCurveTo(x + sway * 0.25, ground - heightScale * 0.55, topX, topY);
      ctx.strokeStyle = rgba(palette.silver, 0.05 + intensity * 0.035);
      ctx.lineWidth = 0.7;
      ctx.stroke();
      for (let bud = 0; bud < 3; bud++) {
        const progress = 0.42 + bud * 0.21;
        const budX = mix(x, topX, progress) + (bud % 2 ? 1 : -1) * (3 + recorded.energy * 4);
        const budY = mix(ground, topY, progress);
        ctx.beginPath();
        ctx.arc(budX, budY, 1.2 + (peak ? beat.pulse * 1.2 : recorded.onset * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = rgba(bud % 2 ? palette.violet : palette.magenta, 0.16 + intensity * 0.11 + recorded.onset * 0.08);
        ctx.fill();
      }
    }
  }

  function drawMirrorWindows(time, section, recorded, beat, intensity) {
    if (section.phase === 5) return;
    const peak = isPeak(section);
    const frameWidth = Math.min(width * 0.17, height * 0.28);
    const frameHeight = frameWidth * 1.35;
    const alpha = 0.045 + intensity * 0.045 + recorded.energy * 0.045;

    for (let side = -1; side <= 1; side += 2) {
      const centerX = width * (side < 0 ? 0.17 : 0.83) + Math.sin(time * 0.13 + side) * width * 0.012;
      const centerY = height * (0.43 + Math.cos(time * 0.095 + side) * 0.018);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(side * (0.012 + Math.sin(time * 0.08) * 0.009));
      ctx.strokeStyle = rgba(side < 0 ? palette.silver : palette.gold, alpha);
      ctx.lineWidth = 1 + (peak ? beat.pulse * 1.6 : recorded.onset * 0.8);
      ctx.strokeRect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
      ctx.beginPath();
      ctx.moveTo(0, -frameHeight / 2);
      ctx.lineTo(0, frameHeight / 2);
      ctx.moveTo(-frameWidth / 2, 0);
      ctx.lineTo(frameWidth / 2, 0);
      ctx.stroke();

      const reflection = ctx.createLinearGradient(-frameWidth / 2, 0, frameWidth / 2, 0);
      reflection.addColorStop(0, 'rgba(255,255,255,0)');
      reflection.addColorStop(0.5, rgba(side < 0 ? palette.ice : palette.magenta, 0.025 + beat.pulse * (peak ? 0.055 : 0.015)));
      reflection.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = reflection;
      const sweep = ((time * 0.08 + (side > 0 ? 0.5 : 0)) % 1.4) - 0.2;
      ctx.fillRect(-frameWidth / 2 + sweep * frameWidth, -frameHeight / 2, frameWidth * 0.22, frameHeight);
      ctx.restore();
    }
  }

  function drawGhostPairAndSigil(time, section, recorded, beat, intensity) {
    if (section.phase === 5) return;
    const peak = isPeak(section);
    const horizon = height * 0.73;
    const separation = width * (0.045 + (peak ? (1 - beat.pulse) * 0.016 : 0.012));
    const pairAlpha = 0.075 + intensity * 0.055 + recorded.energy * 0.06;

    for (let side = -1; side <= 1; side += 2) {
      const x = width * 0.5 + side * separation + Math.sin(time * 0.16 + side) * 2;
      const figureHeight = height * (side < 0 ? 0.105 : 0.092);
      ctx.beginPath();
      ctx.arc(x, horizon - figureHeight, figureHeight * 0.115, 0, Math.PI * 2);
      ctx.fillStyle = rgba(side < 0 ? palette.silver : palette.gold, pairAlpha);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, horizon - figureHeight * 0.86);
      ctx.quadraticCurveTo(x + side * figureHeight * 0.2, horizon - figureHeight * 0.48, x + side * figureHeight * 0.32, horizon);
      ctx.lineTo(x - side * figureHeight * 0.22, horizon);
      ctx.quadraticCurveTo(x - side * figureHeight * 0.06, horizon - figureHeight * 0.58, x, horizon - figureHeight * 0.86);
      ctx.fillStyle = rgba(side < 0 ? palette.violet : palette.magenta, pairAlpha * 0.78);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(width * 0.5 - separation * 0.55, horizon - height * 0.045);
    ctx.quadraticCurveTo(width * 0.5, horizon - height * (0.062 + recorded.onset * 0.02), width * 0.5 + separation * 0.55, horizon - height * 0.043);
    ctx.strokeStyle = rgba(palette.heath, pairAlpha + (peak ? beat.pulse * 0.08 : 0));
    ctx.lineWidth = 0.9 + recorded.onset * 1.4;
    ctx.stroke();

    const radius = Math.min(width, height) * (0.055 + (peak ? beat.pulse * 0.008 : 0));
    const sigilX = width * 0.86;
    const sigilY = height * 0.17;
    ctx.save();
    ctx.translate(sigilX, sigilY);
    ctx.rotate(Math.sin(time * 0.11) * 0.025);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(palette.silver, 0.08 + intensity * 0.055 + recorded.onset * 0.08);
    ctx.lineWidth = 1.1 + (peak ? beat.pulse * 1.8 : 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, radius * 0.34);
    ctx.quadraticCurveTo(0, -radius * 0.18, radius * 0.72, radius * 0.34);
    ctx.strokeStyle = rgba(palette.violet, 0.12 + intensity * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(radius * 0.2, -radius * 0.82);
    ctx.lineTo(-radius * 0.08, -radius * 0.18);
    ctx.lineTo(radius * 0.18, -radius * 0.2);
    ctx.lineTo(-radius * 0.25, radius * 0.64);
    ctx.strokeStyle = rgba(palette.gold, 0.11 + intensity * 0.09 + beat.pulse * (peak ? 0.16 : 0.025));
    ctx.lineWidth = 1.1 + recorded.onset * 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, radius * 0.42);
    ctx.quadraticCurveTo(-radius * 0.38, radius * 0.12, radius * 0.6, radius * 0.5);
    ctx.strokeStyle = rgba(palette.heath, 0.11 + intensity * 0.07);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    for (let bud = 0; bud < 4; bud++) {
      const x = -radius * 0.48 + bud * radius * 0.27;
      const y = radius * (0.27 + Math.sin(bud * 1.9) * 0.09);
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + recorded.onset * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(bud % 2 ? palette.magenta : palette.violet, 0.18 + intensity * 0.08);
      ctx.fill();
    }

    ctx.font = `600 ${Math.max(9, radius * 0.23)}px ui-monospace, SFMono-Regular, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(palette.silver, 0.12 + intensity * 0.07);
    ctx.fillText('C', -radius * 0.48, 0);
    ctx.fillText('H', radius * 0.48, 0);
    ctx.restore();
  }

  function worldWaveY(x, time, lane, side, intensity, phase) {
    const progress = x / width;
    const direction = phase >= 6 ? -side : side;
    const base = height * (0.16 + lane * 0.065);
    const primary = Math.sin(progress * Math.PI * (2.1 + lane * 0.13) + time * (0.46 + lane * 0.025) * direction + lane * 0.9);
    const secondary = Math.sin(progress * Math.PI * 6.4 - time * 0.23 * direction + lane) * 0.26;
    return base + (primary + secondary) * height * (0.025 + intensity * 0.035);
  }

  function drawWorldSheets(time, section, recorded, beat, intensity) {
    if (section.phase === 5) return;
    const peak = isPeak(section);
    const lineCount = peak ? 13 : 8;
    ctx.lineCap = 'round';

    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.beginPath();
      if (side < 0) ctx.rect(0, 0, width * 0.515, height);
      else ctx.rect(width * 0.485, 0, width * 0.515, height);
      ctx.clip();

      for (let lane = 0; lane < lineCount; lane++) {
        ctx.beginPath();
        for (let point = 0; point <= 54; point++) {
          const progress = point / 54;
          const x = progress * width;
          let y = worldWaveY(x, time, lane, side, intensity, section.phase);
          if (side > 0) y = height - y;
          const seamPull = Math.exp(-Math.pow((progress - 0.5) / 0.16, 2)) * height * 0.055 * intensity;
          y += side * seamPull * (section.phase >= 6 ? -1 : 1);
          if (!point) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const color = (lane + (side > 0 ? 1 : 0)) % 3 === 0 ? palette.ice : side < 0 ? palette.violet : palette.magenta;
        ctx.strokeStyle = rgba(color, 0.04 + intensity * (peak ? 0.092 : 0.05) + recorded.energy * 0.08 + beat.pulse * (peak ? 0.065 : 0.012));
        ctx.lineWidth = 0.8 + (lane % 4 === 0 ? recorded.onset * 2.8 + beat.pulse * 1.2 : 0);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawMirrorOrbits(time, section, recorded, beat, intensity) {
    if (section.phase === 5) return;
    const peak = isPeak(section);
    const centerX = width * (section.phase >= 6 ? 0.7 : 0.3);
    const centerY = height * 0.52;
    const orbitCount = peak ? 16 : 10;

    for (let orbit = 0; orbit < orbitCount; orbit++) {
      const radiusX = width * (0.055 + orbit * 0.033);
      const radiusY = height * (0.03 + orbit * 0.021);
      const reverse = orbit % 2 ? -1 : 1;
      const rotation = time * 0.023 * reverse + orbit * 0.31;
      const sweep = Math.PI * (0.72 + (orbit % 4) * 0.2 + (peak ? beat.pulse * 0.18 : 0));
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, rotation * 0.3, rotation, rotation + sweep);
      ctx.strokeStyle = rgba(orbit % 2 ? palette.magenta : orbit % 3 ? palette.violet : palette.ice, 0.045 + intensity * 0.045 + recorded.energy * 0.07 + recorded.onset * 0.08);
      ctx.lineWidth = 0.8 + (orbit % 4 === 0 ? beat.pulse * 2.6 : 0);
      ctx.stroke();
    }
  }

  function drawBeatFractures(time, section, recorded, beat, intensity) {
    if (section.phase === 5) return;
    const peak = isPeak(section);
    const period = 60 / (data?.bpm || 161.499);
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const echoes = peak ? 8 : 4;

    for (let echo = 0; echo < echoes; echo++) {
      const age = (beat.phase + echo) * period;
      const lifetime = peak ? 1.42 : 1.05;
      const progress = age / lifetime;
      if (progress >= 1) continue;
      const eased = 1 - Math.pow(1 - progress, 2.3);
      const life = Math.sin(progress * Math.PI);
      const radiusX = width * (0.035 + eased * (peak ? 0.56 : 0.34));
      const radiusY = height * (0.03 + eased * (peak ? 0.46 : 0.28));
      const skew = (echo % 2 ? -1 : 1) * width * 0.05 * eased;
      ctx.save();
      ctx.translate(centerX + skew, centerY);
      ctx.rotate((echo % 2 ? -1 : 1) * (0.05 + progress * 0.18));
      ctx.beginPath();
      ctx.moveTo(0, -radiusY);
      ctx.lineTo(radiusX, 0);
      ctx.lineTo(0, radiusY);
      ctx.lineTo(-radiusX, 0);
      ctx.closePath();
      ctx.strokeStyle = rgba(echo % 3 ? palette.violet : palette.magenta, life * (0.035 + intensity * (peak ? 0.105 : 0.07) + recorded.onset * 0.09));
      ctx.lineWidth = 0.8 + recorded.onset * 2.2 + (echo === 0 ? beat.pulse * 2 : 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCentralThread(time, section, recorded, beat, intensity) {
    const voidPhase = section.phase === 5;
    const peak = isPeak(section);
    const split = peak ? width * (0.012 + intensity * 0.018 + beat.pulse * 0.012) : width * 0.004;
    const threadColor = voidPhase ? '#1a1720' : palette.magenta;

    for (let echo = 3; echo >= 0; echo--) {
      ctx.beginPath();
      for (let point = 0; point <= 48; point++) {
        const progress = point / 48;
        const y = progress * height;
        const wave = Math.sin(point * 1.24 + time * 0.65 - echo * 0.35) * width * (voidPhase ? 0.002 : 0.004 + recorded.onset * 0.006);
        const tear = Math.sin(progress * Math.PI) * split * (point % 2 ? 1 : -1);
        const x = width * 0.5 + wave + tear + (section.phase >= 6 ? -1 : 1) * echo * 2;
        if (!point) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(threadColor, voidPhase ? 0.28 - echo * 0.045 : 0.16 + intensity * 0.13 - echo * 0.025);
      ctx.lineWidth = 0.8 + (3 - echo) * 0.6 + (peak ? beat.pulse * 2.8 : recorded.onset * 1.5);
      ctx.stroke();
    }
  }

  function drawPeakLight(time, section, recorded, beat, intensity) {
    if (!isPeak(section)) return;
    const reverse = section.phase >= 6 ? -1 : 1;
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    const bloom = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.66);
    bloom.addColorStop(0, rgba(section.phase === 4 ? palette.white : palette.magenta, 0.12 + beat.pulse * 0.16 + recorded.onset * 0.08));
    bloom.addColorStop(0.38, rgba(palette.violet, 0.055 + intensity * 0.07));
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);

    for (let beam = 0; beam < 9; beam++) {
      const angle = reverse * (-Math.PI * 0.72 + beam * Math.PI * 1.44 / 8) + Math.sin(time * 0.31) * 0.035;
      const halfWidth = 0.014 + beat.pulse * 0.01;
      const length = Math.hypot(width, height) * (0.58 + intensity * 0.1);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle - halfWidth) * length, centerY + Math.sin(angle - halfWidth) * length);
      ctx.lineTo(centerX + Math.cos(angle + halfWidth) * length, centerY + Math.sin(angle + halfWidth) * length);
      ctx.closePath();
      ctx.fillStyle = rgba(beam % 3 ? palette.violet : palette.ice, 0.035 + beat.pulse * 0.065 + recorded.energy * 0.028);
      ctx.fill();
    }

    for (let sweep = 0; sweep < 4; sweep++) {
      const progress = ((time * (0.12 + sweep * 0.008) + sweep * 0.27) % 1.36) - 0.18;
      const x = reverse > 0 ? progress * width : width - progress * width;
      ctx.save();
      ctx.translate(x, height * 0.5);
      ctx.rotate(reverse * (-0.26 + sweep * 0.12));
      const light = ctx.createLinearGradient(-width * 0.075, 0, width * 0.075, 0);
      light.addColorStop(0, 'rgba(255,255,255,0)');
      light.addColorStop(0.5, rgba(sweep % 2 ? palette.magenta : palette.ice, 0.065 + beat.pulse * 0.1 + recorded.onset * 0.055));
      light.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = light;
      ctx.fillRect(-width * 0.075, -height, width * 0.15, height * 2);
      ctx.restore();
    }
  }

  function drawDeletionDrop(time, section, recorded, beat, intensity) {
    if (section.phase !== 4) return;
    const laneCount = 12;
    for (let lane = 0; lane < laneCount; lane++) {
      const y = height * (0.07 + lane * 0.077);
      const side = lane % 2 ? 1 : -1;
      const reach = width * (0.2 + beat.pulse * 0.48 + recorded.onset * 0.2);
      ctx.fillStyle = rgba(lane % 3 ? palette.magenta : palette.white, 0.025 + beat.pulse * 0.07 + recorded.onset * 0.045);
      ctx.fillRect(side > 0 ? 0 : width - reach, y, reach, 1 + (lane % 4 === 0 ? 3 : 0));
    }

    ctx.save();
    ctx.font = `700 ${Math.max(10, width * 0.009)}px Avenir Next, sans-serif`;
    ctx.textAlign = 'center';
    for (let row = 0; row < 6; row++) {
      for (let column = 0; column < 8; column++) {
        const x = width * (0.08 + column * 0.12) + Math.sin(time * 1.1 + row) * 8;
        const y = height * (0.2 + row * 0.12);
        const flicker = hash(beat.index * 31 + row * 8 + column);
        ctx.fillStyle = rgba(column % 3 ? palette.violet : palette.magenta, (0.018 + recorded.onset * 0.06) * (0.35 + flicker));
        ctx.fillText('DELETE', x, y);
      }
    }
    ctx.restore();

    const shards = 34;
    for (let shard = 0; shard < shards; shard++) {
      const angle = hash(shard * 9.31) * Math.PI * 2;
      const radius = Math.min(width, height) * (0.1 + hash(shard * 17.7) * 0.52) * (0.72 + beat.pulse * 0.28);
      const x = width * 0.5 + Math.cos(angle + time * 0.035) * radius;
      const y = height * 0.5 + Math.sin(angle - time * 0.04) * radius * 0.7;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + time * 0.08);
      ctx.strokeStyle = rgba(shard % 4 ? palette.violet : palette.ice, 0.045 + intensity * 0.055 + beat.pulse * 0.06);
      ctx.lineWidth = 0.7 + recorded.onset * 1.7;
      ctx.strokeRect(-5 - shard % 4 * 2, -2, 10 + shard % 4 * 4, 4);
      ctx.restore();
    }
  }

  function drawVoid(section, beat) {
    if (section.phase !== 5) return;
    const fog = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.65);
    fog.addColorStop(0, `rgba(255,255,255,${0.2 + beat.pulse * 0.045})`);
    fog.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFinalVignette(section, intensity) {
    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.49, width * 0.12, width * 0.5, height * 0.49, width * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, section.phase === 5 ? 'rgba(16,12,22,0.18)' : `rgba(0,0,0,${0.48 - Math.min(0.16, intensity * 0.08)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFrame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!audio.paused && Number.isFinite(audio.currentTime)) displayTime = audio.currentTime;
    if (previewMode && audio.paused) displayTime = previewTime;

    const section = currentSection(displayTime);
    const recorded = recordedAt(displayTime);
    const beat = beatAt(displayTime);
    const intensity = phaseIntensity(section, recorded, beat);

    drawBase(displayTime, section, recorded, beat, intensity);
    drawStormMoor(displayTime, section, recorded, beat, intensity);
    drawMirrorWindows(displayTime, section, recorded, beat, intensity);
    drawWorldSheets(displayTime, section, recorded, beat, intensity);
    drawPeakLight(displayTime, section, recorded, beat, intensity);
    drawMirrorOrbits(displayTime, section, recorded, beat, intensity);
    drawBeatFractures(displayTime, section, recorded, beat, intensity);
    drawDeletionDrop(displayTime, section, recorded, beat, intensity);
    drawCentralThread(displayTime, section, recorded, beat, intensity);
    drawGhostPairAndSigil(displayTime, section, recorded, beat, intensity);
    drawVoid(section, beat);
    drawFinalVignette(section, intensity);
    updateInterface(displayTime, section);

    void dt;
    requestAnimationFrame(drawFrame);
  }

  function renderWords(line, time) {
    lyricCurrent.replaceChildren();
    if (!line) {
      const span = document.createElement('span');
      span.className = 'instrumental';
      span.textContent = interludes[currentSection(time).phase] || 'Violet interval';
      lyricCurrent.append(span);
      return;
    }
    const words = line.words?.length ? line.words : [{ word: line.text, start: line.start, end: line.end }];
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'word';
      if (time >= word.end) span.classList.add('is-sung');
      else if (time >= word.start && time < word.end) span.classList.add('is-current');
      span.textContent = word.word;
      lyricCurrent.append(span);
      if (index < words.length - 1) lyricCurrent.append(document.createTextNode(' '));
    });
  }

  function parseLrcTimestamp(minutes, seconds) {
    return Number(minutes) * 60 + Number(seconds);
  }

  function distributeWordTimes(text, start, end) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const span = Math.max(0.04, end - start);
    const weights = words.map(word => {
      const letters = word.replace(/[^\p{L}\p{N}]/gu, '').length;
      return Math.max(1, Math.sqrt(Math.max(1, letters)));
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = start;
    return words.map((word, index) => {
      const wordStart = cursor;
      cursor = index === words.length - 1 ? start + span : cursor + span * weights[index] / total;
      return {
        word,
        start: Number(wordStart.toFixed(3)),
        end: Number(Math.max(wordStart + 0.04, cursor).toFixed(3))
      };
    });
  }

  function parseProviderTimeline(record, targetDuration) {
    if (!record?.syncedLyrics) throw new Error('LRCLIB record has no synchronized lyrics');
    const timestampPattern = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
    const entries = [];

    String(record.syncedLyrics).split(/\r?\n/).forEach(rawLine => {
      const timestamps = [...rawLine.matchAll(timestampPattern)];
      const text = rawLine.replace(timestampPattern, '').trim();
      if (!timestamps.length || !text) return;
      timestamps.forEach(match => {
        entries.push({
          start: parseLrcTimestamp(match[1], match[2]),
          text
        });
      });
    });

    entries.sort((left, right) => left.start - right.start);
    if (!entries.length) throw new Error('LRCLIB timeline has no displayable lines');
    return entries.map((entry, index) => {
      const nextStart = entries[index + 1]?.start;
      const naturalEnd = Number.isFinite(nextStart) ? nextStart - 0.045 : targetDuration;
      const end = clamp(entry.start + 0.35, targetDuration, Math.max(entry.start + 0.35, naturalEnd));
      return {
        start: Number(entry.start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text: entry.text,
        words: distributeWordTimes(entry.text, entry.start, end)
      };
    });
  }

  async function loadCanonicalProviderLyrics(targetDuration) {
    if (query.get('refreshLyrics') !== '1') {
      try {
        const cached = JSON.parse(localStorage.getItem(LRCLIB_CACHE_KEY) || 'null');
        if (Number(cached?.id) === LRCLIB_RECORD_ID && cached?.syncedLyrics) {
          return {
            lines: parseProviderTimeline(cached, targetDuration),
            source: {
              provider: 'LRCLIB',
              recordId: LRCLIB_RECORD_ID,
              trackName: cached.trackName || cached.name,
              artistName: cached.artistName,
              duration: cached.duration,
              synchronized: true,
              cached: true
            }
          };
        }
      } catch (error) {
        console.warn('Ignoring invalid cached LRCLIB record', error);
      }
    }
    const response = await fetch(LRCLIB_RECORD_URL, {
      cache: 'no-store',
      headers: { 'Lrclib-Client': LRCLIB_CLIENT }
    });
    if (!response.ok) throw new Error(`LRCLIB lyrics request failed: ${response.status}`);
    const record = await response.json();
    if (Number(record.id) !== LRCLIB_RECORD_ID) throw new Error('LRCLIB returned the wrong record');
    try {
      localStorage.setItem(LRCLIB_CACHE_KEY, JSON.stringify(record));
    } catch (error) {
      console.warn('Could not cache LRCLIB lyrics locally', error);
    }
    return {
      lines: parseProviderTimeline(record, targetDuration),
      source: {
        provider: 'LRCLIB',
        recordId: LRCLIB_RECORD_ID,
        trackName: record.trackName || record.name,
        artistName: record.artistName,
        duration: record.duration,
        synchronized: true
      }
    };
  }

  function lineIndexAt(time) {
    if (!data?.lines?.length) return -1;
    const direct = data.lines.findIndex(line => time >= line.start && time < line.end);
    if (direct >= 0) return direct;
    return data.lines.findIndex(line => time >= line.start - 0.06 && time < line.end + 0.06);
  }

  function updateLyrics(time) {
    if (!data?.lines?.length) return;
    const lineIndex = lineIndexAt(time);
    const line = lineIndex >= 0 ? data.lines[lineIndex] : null;
    if (lineIndex !== activeLineIndex) {
      activeLineIndex = lineIndex;
      lyricPrevious.textContent = lineIndex > 0 ? data.lines[lineIndex - 1].text : '';
      const nextIndex = lineIndex >= 0 ? lineIndex + 1 : data.lines.findIndex(item => item.start > time);
      lyricNext.textContent = nextIndex >= 0 && nextIndex < data.lines.length ? data.lines[nextIndex].text : '';
    }
    renderWords(line, time);
  }

  function updateInterface(time, section) {
    const duration = Number.isFinite(audio.duration) ? audio.duration : data?.duration || 0;
    currentTimeEl.textContent = formatTime(time);
    durationEl.textContent = formatTime(duration);
    if (!seekActive) seek.value = duration ? String(time / duration * 1000) : '0';
    const sectionIndex = Math.max(0, data?.sections?.indexOf(section) || 0);
    chapterIndex.textContent = String(sectionIndex + 1).padStart(2, '0');
    chapterName.textContent = section.short;
    chapterDetail.textContent = section.name;
    worldLabel.textContent = section.phase >= 6 ? 'WORLD / B' : 'WORLD / A';
    bearingValue.textContent = String(Math.round((displayTime * (data?.bpm || 161.499) / 60 * 10) % 360)).padStart(3, '0');
    updateLyrics(time);
  }

  async function togglePlay() {
    if (audio.paused) {
      if (previewMode && Math.abs(audio.currentTime - previewTime) > 0.5) {
        await new Promise(resolve => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          audio.addEventListener('seeked', finish, { once: true });
          audio.currentTime = clamp(0, Number.isFinite(audio.duration) ? audio.duration : previewTime, previewTime);
          displayTime = previewTime;
          setTimeout(finish, 900);
        });
      }
      await audio.play();
    } else {
      audio.pause();
    }
  }

  play.addEventListener('click', () => togglePlay().catch(error => console.error(error)));
  audio.addEventListener('play', () => {
    playIcon.textContent = '\u275a\u275a';
    play.setAttribute('aria-label', 'Pause Through Patches of Violet');
  });
  audio.addEventListener('pause', () => {
    playIcon.textContent = '\u25b6';
    play.setAttribute('aria-label', 'Play Through Patches of Violet');
  });

  function applyLoadedMediaState() {
    durationEl.textContent = formatTime(audio.duration);
    if (previewMode && previewTime > 0) {
      audio.currentTime = clamp(0, audio.duration, previewTime);
      displayTime = audio.currentTime;
    }
  }
  audio.addEventListener('loadedmetadata', applyLoadedMediaState);
  if (audio.readyState >= 1) applyLoadedMediaState();

  function loadLocalAudio() {
    const mediaUrl = audio.dataset.src;
    if (!mediaUrl) return;
    fetch(mediaUrl, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        audio.src = URL.createObjectURL(blob);
        audio.load();
        play.disabled = false;
      })
      .catch(error => {
        console.warn(error);
        audio.src = mediaUrl;
        audio.load();
        play.disabled = false;
      });
  }

  function applySeekValue() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : data?.duration || 0;
    if (!duration) return;
    displayTime = Number(seek.value) / 1000 * duration;
    audio.currentTime = displayTime;
  }

  seek.addEventListener('pointerdown', () => { seekActive = true; });
  seek.addEventListener('focus', () => { seekActive = true; });
  seek.addEventListener('input', applySeekValue);
  seek.addEventListener('change', applySeekValue);
  seek.addEventListener('pointerup', () => {
    applySeekValue();
    setTimeout(() => { seekActive = false; }, 0);
  });
  seek.addEventListener('pointercancel', () => { seekActive = false; });
  seek.addEventListener('blur', () => { seekActive = false; });

  mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    mute.textContent = audio.muted ? 'MUTE' : 'VOL';
    mute.setAttribute('aria-label', audio.muted ? 'Unmute audio' : 'Mute audio');
  });

  if (query.get('silent') === '1') {
    audio.muted = true;
    mute.textContent = 'MUTE';
  }

  window.addEventListener('resize', resize);
  resize();
  loadLocalAudio();

  fetch('../../songs/lyrics/through-patches-of-violet-metal.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`Theater data request failed: ${response.status}`);
      return response.json();
    })
    .then(payload => {
      data = payload;
      energyEnvelope = decodeEnvelope(payload.analysis?.energyBase64);
      onsetEnvelope = decodeEnvelope(payload.analysis?.onsetsBase64);
      durationEl.textContent = formatTime(data.duration);
      updateInterface(displayTime, currentSection(displayTime));
    })
    .catch(error => {
      console.error(error);
      data = data ? { ...data, lines: [] } : data;
      lyricPrevious.textContent = '';
      lyricCurrent.textContent = 'Canonical lyrics unavailable';
      lyricNext.textContent = '';
      chapterDetail.textContent = 'Provider lyrics unavailable';
    });

  requestAnimationFrame(drawFrame);
})();
