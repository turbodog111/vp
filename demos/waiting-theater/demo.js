(() => {
  'use strict';

  const stage = document.getElementById('stage');
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
  const clockLabel = document.getElementById('clock-label');
  const beatValue = document.getElementById('beat-value');
  const lyricPrevious = document.getElementById('lyric-previous');
  const lyricCurrent = document.getElementById('lyric-current');
  const lyricNext = document.getElementById('lyric-next');
  const query = new URLSearchParams(location.search);
  const previewTime = Number(query.get('preview'));
  const previewMode = Number.isFinite(previewTime) && previewTime >= 0;

  const palette = {
    cream: '#fff7e2',
    pale: '#f4e4c9',
    wine: '#64243b',
    deep: '#3f142b',
    rose: '#c32f61',
    coral: '#ec7180',
    sky: '#78c9e8',
    blue: '#2e728e',
    gold: '#e4b86a',
    white: '#fffdf8'
  };

  const interludes = [
    'The room holds its breath.',
    'Clouds pass the window.',
    'Tomorrow turns another tooth.',
    'Petals find the current.',
    'The clock keeps faith.',
    'Morning reaches the desk.',
    'The curtain is all light.'
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

  const clamp = (min, max, value) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smoothStep = (a, b, value) => {
    const amount = clamp(0, 1, (value - a) / Math.max(0.0001, b - a));
    return amount * amount * (3 - 2 * amount);
  };
  const hash = value => {
    const result = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return result - Math.floor(result);
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
    return Array.from(raw, character => character.charCodeAt(0) / 255);
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
      || { phase: 0, short: 'ROOM TONE', name: 'Before the alarm' };
  }

  function isPeak(section) {
    return section.phase === 2 || section.phase === 5;
  }

  function beatAt(time) {
    const bpm = data?.bpm || 143.555;
    const offset = data?.beatOffset || 3.994;
    const beats = Math.max(0, (time - offset) * bpm / 60);
    const phase = beats - Math.floor(beats);
    return {
      index: Math.floor(beats),
      phase,
      pulse: Math.exp(-phase * 7.2),
      backbeat: Math.floor(beats) % 2
    };
  }

  function motionAt(section, recorded, beat) {
    const phaseBase = [0.12, 0.36, 0.94, 0.48, 0.62, 1.08, 0.28][section.phase] ?? 0.34;
    return clamp(0, 1.35, phaseBase + recorded.energy * 0.24 + recorded.onset * 0.2 + beat.pulse * (isPeak(section) ? 0.22 : 0.08));
  }

  function drawBackground(time, section, recorded, beat, motion) {
    const progress = clamp(0, 1, time / Math.max(1, data?.duration || 161.936));
    const peak = isPeak(section);
    const base = ctx.createLinearGradient(0, 0, width, height);
    if (peak) {
      base.addColorStop(0, '#8f2856');
      base.addColorStop(0.5, '#d35f87');
      base.addColorStop(1, '#5a2146');
    } else if (section.phase === 4) {
      base.addColorStop(0, '#edced2');
      base.addColorStop(0.52, '#c17b91');
      base.addColorStop(1, '#6b304d');
    } else {
      base.addColorStop(0, '#f7e6df');
      base.addColorStop(0.48, '#e1b8c0');
      base.addColorStop(1, progress > 0.75 ? '#c8597d' : '#954560');
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const daybreak = ctx.createRadialGradient(width * 0.79, height * 0.28, 0, width * 0.79, height * 0.28, width * 0.68);
    daybreak.addColorStop(0, rgba(palette.white, 0.2 + progress * 0.25 + recorded.energy * 0.1 + (peak ? beat.pulse * 0.11 : 0)));
    daybreak.addColorStop(0.35, rgba(palette.sky, 0.055 + progress * 0.1));
    daybreak.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = daybreak;
    ctx.fillRect(0, 0, width, height);

    if (section.phase === 6) {
      ctx.fillStyle = rgba(palette.white, 0.16 + smoothStep(153.24, 161.3, time) * 0.5);
      ctx.fillRect(0, 0, width, height);
    }

    void motion;
  }

  function drawMovingVeils(time, section, recorded, beat, motion) {
    const peak = isPeak(section);
    const veilCount = peak ? 5 : 3;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let veil = 0; veil < veilCount; veil++) {
      const phase = time * (0.16 + veil * 0.018) + veil * 2.1;
      const center = height * (0.18 + veil * 0.17) + Math.sin(phase * 0.37) * height * 0.08;
      const thickness = height * (0.055 + motion * 0.025 + (peak ? beat.pulse * 0.018 : 0));
      const travel = Math.sin(phase * 0.23) * width * 0.11;
      ctx.beginPath();
      ctx.moveTo(-width * 0.18 + travel, center - thickness);
      ctx.bezierCurveTo(
        width * 0.2 + travel,
        center + Math.sin(phase) * height * 0.12 - thickness,
        width * 0.72 + travel,
        center + Math.cos(phase * 0.81) * height * 0.11 - thickness,
        width * 1.18 + travel,
        center - thickness * 0.45
      );
      ctx.lineTo(width * 1.18 + travel, center + thickness * 0.45);
      ctx.bezierCurveTo(
        width * 0.72 + travel,
        center + Math.cos(phase * 0.81) * height * 0.11 + thickness,
        width * 0.2 + travel,
        center + Math.sin(phase) * height * 0.12 + thickness,
        -width * 0.18 + travel,
        center + thickness
      );
      ctx.closePath();
      const veilFill = ctx.createLinearGradient(-width * 0.1, center, width * 1.1, center);
      veilFill.addColorStop(0, 'rgba(255,255,255,0)');
      veilFill.addColorStop(0.28, rgba(veil % 3 ? palette.rose : palette.sky, 0.025 + motion * 0.025));
      veilFill.addColorStop(0.62, rgba(veil % 2 ? palette.coral : palette.white, 0.035 + motion * 0.03 + (peak ? recorded.energy * 0.035 : 0)));
      veilFill.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = veilFill;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawColorBlooms(time, section, recorded, beat, motion) {
    const peak = isPeak(section);
    const beatPeriod = 60 / (data?.bpm || 143.555);
    const bloomCount = peak ? 9 : 6;
    const lifetime = peak ? 3.35 : 2.65;
    const colors = [palette.rose, palette.coral, '#ed8fba', palette.sky, '#f6b5d1'];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let echo = 0; echo < bloomCount; echo++) {
      const age = beat.phase * beatPeriod + echo * beatPeriod * 0.68;
      const progress = age / lifetime;
      if (progress >= 1) continue;
      const eventIndex = beat.index - echo;
      const eased = 1 - Math.pow(1 - progress, 2.35);
      const life = Math.sin(progress * Math.PI);
      const x = width * (0.09 + hash(eventIndex * 7.31) * 0.82) + Math.sin(time * 0.19 + echo) * width * 0.018;
      const y = height * (0.12 + hash(eventIndex * 11.73) * 0.63) + Math.cos(time * 0.16 + echo) * height * 0.022;
      const radius = Math.min(width, height) * (0.025 + eased * (peak ? 0.28 : 0.2));
      const petalCount = 6 + Math.abs(eventIndex) % 3;
      const rotation = time * (echo % 2 ? -0.055 : 0.045) + hash(eventIndex * 3.9) * Math.PI * 2;
      const alpha = life * (0.025 + motion * 0.035 + recorded.energy * 0.025 + (peak ? beat.pulse * 0.035 : 0));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      for (let petal = 0; petal < petalCount; petal++) {
        const angle = petal / petalCount * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        ctx.translate(radius * 0.32, 0);
        ctx.fillStyle = rgba(colors[(echo + petal) % colors.length], alpha * (petal % 2 ? 0.82 : 1));
        ctx.beginPath();
        ctx.ellipse(radius * 0.21, 0, radius * 0.52, radius * 0.19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = rgba(echo % 2 ? palette.white : palette.rose, alpha * 0.85);
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawRoom(time, section, recorded, beat, motion) {
    const peak = isPeak(section);
    const windowX = width * 0.79;
    const windowY = height * 0.34;
    const windowW = width * 0.3;
    const windowH = height * 0.52;
    const drift = Math.sin(time * 0.09) * width * 0.003;

    ctx.save();
    ctx.translate(drift, 0);
    ctx.strokeStyle = rgba(peak ? palette.white : palette.wine, 0.12 + motion * 0.045);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(windowX - windowW / 2, windowY - windowH / 2, windowW, windowH);
    ctx.beginPath();
    ctx.moveTo(windowX, windowY - windowH / 2);
    ctx.lineTo(windowX, windowY + windowH / 2);
    ctx.moveTo(windowX - windowW / 2, windowY);
    ctx.lineTo(windowX + windowW / 2, windowY);
    ctx.stroke();
    ctx.restore();

    for (let frame = 0; frame < (peak ? 9 : 6); frame++) {
      const beatPeriod = 60 / (data?.bpm || 143.555);
      const age = (beat.phase + frame) * beatPeriod;
      const lifetime = peak ? 2.1 : 2.45;
      const progress = age / lifetime;
      if (progress >= 1) continue;
      const eased = 1 - Math.pow(1 - progress, 2.1);
      const life = Math.sin(progress * Math.PI);
      const frameW = width * (0.045 + eased * 0.9);
      const frameH = height * (0.045 + eased * 0.72);
      ctx.strokeStyle = rgba(frame % 2 ? palette.sky : palette.rose, life * (0.035 + motion * 0.055 + (peak ? beat.pulse * 0.05 : 0)));
      ctx.lineWidth = 0.8 + (frame === 0 ? beat.pulse * 1.4 : 0);
      ctx.strokeRect(windowX - frameW / 2, windowY - frameH / 2, frameW, frameH);
    }

    const floorY = height * 0.77;
    for (let ray = -8; ray <= 8; ray++) {
      const destination = width * (0.5 + ray * 0.085);
      ctx.beginPath();
      ctx.moveTo(windowX, windowY + windowH / 2);
      ctx.lineTo(destination, height);
      ctx.strokeStyle = rgba(peak ? palette.white : palette.wine, 0.025 + motion * 0.02);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    for (let line = 0; line < 7; line++) {
      const y = floorY + (1 - Math.pow(1 - line / 7, 2)) * (height - floorY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.strokeStyle = rgba(peak ? palette.white : palette.wine, 0.025 + motion * 0.018);
      ctx.stroke();
    }

    const panelX = width * 0.13;
    const panelY = height * 0.52;
    ctx.strokeStyle = rgba(peak ? palette.sky : palette.wine, 0.055 + recorded.energy * 0.07);
    ctx.strokeRect(panelX - width * 0.085, panelY - height * 0.22, width * 0.17, height * 0.44);
    for (let panel = 1; panel < 4; panel++) {
      const y = panelY - height * 0.22 + panel * height * 0.11;
      ctx.beginPath(); ctx.moveTo(panelX - width * 0.085, y); ctx.lineTo(panelX + width * 0.085, y); ctx.stroke();
    }
  }

  function drawClock(time, section, recorded, beat, motion) {
    const peak = isPeak(section);
    const cx = width * 0.79;
    const cy = height * 0.34;
    const baseRadius = Math.min(width, height) * 0.14;

    for (let orbit = 0; orbit < (peak ? 9 : 6); orbit++) {
      const radiusX = baseRadius * (0.58 + orbit * 0.27);
      const radiusY = baseRadius * (0.48 + orbit * 0.21);
      const direction = orbit % 2 ? -1 : 1;
      const rotation = time * (0.018 + orbit * 0.002) * direction + orbit * 0.38;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radiusX, radiusY, rotation * 0.12, rotation, rotation + Math.PI * (0.84 + orbit % 3 * 0.25));
      ctx.strokeStyle = rgba(orbit % 2 ? palette.sky : peak ? palette.white : palette.rose, 0.065 + motion * 0.055 + recorded.energy * 0.04);
      ctx.lineWidth = 0.8 + (orbit % 3 === 0 ? recorded.onset * 1.8 : 0);
      ctx.stroke();
    }

    for (let tick = 0; tick < 24; tick++) {
      const angle = tick * Math.PI / 12 - Math.PI / 2;
      const active = (beat.index % 24 + 24) % 24 === tick ? beat.pulse : 0;
      const inner = baseRadius * (0.78 - active * 0.07);
      const outer = baseRadius * (0.92 + active * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.strokeStyle = rgba(tick % 4 ? palette.wine : palette.rose, 0.16 + active * 0.5 + recorded.energy * 0.08);
      ctx.lineWidth = tick % 4 ? 1 : 2.1;
      ctx.stroke();
    }

    const secondAngle = time * Math.PI * 2 / 8 - Math.PI / 2;
    const minuteAngle = time * Math.PI * 2 / 32 - Math.PI / 2;
    [[secondAngle, 0.73, 2.2], [minuteAngle, 0.5, 1.2]].forEach(([angle, scale, lineWidth]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * baseRadius * scale, cy + Math.sin(angle) * baseRadius * scale);
      ctx.strokeStyle = rgba(peak ? palette.white : palette.wine, 0.36 + recorded.energy * 0.2);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 4 + beat.pulse * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(peak ? palette.white : palette.rose, 0.7);
    ctx.fill();
  }

  function drawCloudsAndRibbons(time, section, recorded, beat, motion) {
    const peak = isPeak(section);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let band = 0; band < 7; band++) {
      const travel = ((time * (0.018 + band * 0.002) + hash(band * 19.7)) % 1.45) - 0.22;
      const y = height * (0.13 + band * 0.095) + Math.sin(time * 0.12 + band) * height * 0.016;
      const cloudW = width * (0.2 + hash(band * 7.3) * 0.2);
      const cloud = ctx.createLinearGradient(travel * width, y, travel * width + cloudW, y);
      cloud.addColorStop(0, 'rgba(255,255,255,0)');
      cloud.addColorStop(0.5, rgba(band % 2 ? palette.sky : palette.white, 0.035 + motion * 0.04 + (peak ? recorded.energy * 0.06 : 0)));
      cloud.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(travel * width + cloudW * 0.5, y, cloudW * 0.5, height * (0.018 + band % 3 * 0.006), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (let ribbon = 0; ribbon < 3; ribbon++) {
      const direction = ribbon % 2 ? -1 : 1;
      const baseline = height * (0.28 + ribbon * 0.19);
      const amplitude = height * (0.025 + motion * 0.028 + (peak ? beat.pulse * 0.016 : 0));
      ctx.beginPath();
      for (let point = 0; point <= 54; point++) {
        const progress = point / 54;
        const x = direction > 0 ? progress * width : width - progress * width;
        const y = baseline
          + Math.sin(progress * Math.PI * (3.2 + ribbon * 0.45) + time * (0.32 + ribbon * 0.07)) * amplitude
          + Math.sin(progress * Math.PI * 8.2 - time * 0.19) * amplitude * 0.22;
        if (!point) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(ribbon % 2 ? palette.sky : peak ? palette.white : palette.rose, 0.075 + motion * 0.08 + recorded.onset * 0.06);
      ctx.lineWidth = 1 + recorded.energy * 2.2 + (peak ? beat.pulse * 1.3 : 0);
      ctx.stroke();
    }
  }

  function drawPetals(time, section, recorded, beat, motion) {
    const peak = isPeak(section);
    const count = peak ? 64 : section.phase === 4 ? 38 : 30;
    for (let index = 0; index < count; index++) {
      const speed = 0.017 + hash(index * 4.7) * 0.019;
      const drift = (hash(index * 13.1) + time * speed) % 1;
      const x = (0.03 + hash(index * 27.9) * 0.94 + Math.sin(time * 0.32 + index) * 0.038) * width;
      const y = (0.03 + drift * 0.9) * height;
      const angle = time * (0.18 + hash(index) * 0.12) + index;
      const length = 4 + recorded.energy * 8 + (peak ? beat.pulse * 9 : 0);
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
      ctx.lineTo(x, y);
      ctx.strokeStyle = rgba(index % 4 ? palette.rose : palette.sky, 0.025 + motion * 0.03 + (peak ? recorded.onset * 0.08 : 0));
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = rgba(index % 3 ? palette.coral : palette.sky, 0.1 + recorded.energy * 0.12 + (peak ? beat.pulse * 0.08 : 0));
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.2 + index % 4, 1.1 + index % 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRefrain(time, section, recorded, beat, motion) {
    if (!isPeak(section)) return;
    const cx = width * 0.79;
    const cy = height * 0.34;
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.72);
    bloom.addColorStop(0, rgba(palette.white, 0.14 + beat.pulse * 0.18 + recorded.onset * 0.07));
    bloom.addColorStop(0.36, rgba(palette.sky, 0.045 + motion * 0.055));
    bloom.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);

    for (let ray = 0; ray < 16; ray++) {
      const angle = -Math.PI * 0.94 + ray * Math.PI * 1.88 / 15 + Math.sin(time * 0.22) * 0.035;
      const half = 0.012 + beat.pulse * 0.011;
      const length = Math.hypot(width, height) * (0.55 + recorded.energy * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle - half) * length, cy + Math.sin(angle - half) * length);
      ctx.lineTo(cx + Math.cos(angle + half) * length, cy + Math.sin(angle + half) * length);
      ctx.closePath();
      ctx.fillStyle = rgba(ray % 3 ? palette.white : palette.sky, 0.018 + beat.pulse * 0.045 + recorded.energy * 0.028);
      ctx.fill();
    }

    for (let sweep = 0; sweep < 5; sweep++) {
      const travel = ((time * (0.08 + sweep * 0.004) + sweep * 0.25) % 1.45) - 0.22;
      const x = travel * width;
      ctx.save();
      ctx.translate(x, height * 0.5);
      ctx.rotate(-0.26 + sweep * 0.1);
      const light = ctx.createLinearGradient(-width * 0.07, 0, width * 0.07, 0);
      light.addColorStop(0, 'rgba(255,255,255,0)');
      light.addColorStop(0.5, rgba(sweep % 2 ? palette.sky : palette.white, 0.04 + beat.pulse * 0.075 + recorded.onset * 0.04));
      light.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = light;
      ctx.fillRect(-width * 0.07, -height, width * 0.14, height * 2);
      ctx.restore();
    }
  }

  function drawBridge(time, section, recorded, beat, motion) {
    if (section.phase !== 4) return;
    const cx = width * 0.52;
    const cy = height * 0.48;
    for (let gear = 0; gear < 7; gear++) {
      const radius = Math.min(width, height) * (0.06 + gear * 0.045);
      const rotation = time * (gear % 2 ? -0.05 : 0.04) + gear;
      ctx.save();
      ctx.translate(cx + Math.cos(gear * 2.4) * width * 0.18, cy + Math.sin(gear * 1.7) * height * 0.13);
      ctx.rotate(rotation);
      ctx.strokeStyle = rgba(gear % 2 ? palette.sky : palette.wine, 0.06 + motion * 0.08 + recorded.onset * 0.08);
      ctx.lineWidth = 1 + beat.pulse * 1.3;
      ctx.beginPath();
      for (let tooth = 0; tooth <= 24; tooth++) {
        const angle = tooth / 24 * Math.PI * 2;
        const toothRadius = radius * (tooth % 2 ? 0.88 : 1);
        const x = Math.cos(angle) * toothRadius;
        const y = Math.sin(angle) * toothRadius;
        if (!tooth) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFinalVignette(section, motion) {
    const vignette = ctx.createRadialGradient(width * 0.52, height * 0.5, width * 0.1, width * 0.52, height * 0.5, width * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, section.phase === 6 ? rgba(palette.cream, 0.12) : `rgba(68,23,40,${0.13 + Math.max(0, 0.11 - motion * 0.06)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFrame() {
    if (previewMode && audio.paused) displayTime = previewTime;
    else if (!audio.paused && Number.isFinite(audio.currentTime)) displayTime = audio.currentTime;

    const section = currentSection(displayTime);
    const recorded = recordedAt(displayTime);
    const beat = beatAt(displayTime);
    const motion = motionAt(section, recorded, beat);

    drawBackground(displayTime, section, recorded, beat, motion);
    drawMovingVeils(displayTime, section, recorded, beat, motion);
    drawRoom(displayTime, section, recorded, beat, motion);
    drawColorBlooms(displayTime, section, recorded, beat, motion);
    drawCloudsAndRibbons(displayTime, section, recorded, beat, motion);
    drawBridge(displayTime, section, recorded, beat, motion);
    drawClock(displayTime, section, recorded, beat, motion);
    drawPetals(displayTime, section, recorded, beat, motion);
    drawRefrain(displayTime, section, recorded, beat, motion);
    drawFinalVignette(section, motion);
    updateInterface(displayTime, section, beat);

    requestAnimationFrame(drawFrame);
  }

  function renderWords(line, time) {
    lyricCurrent.replaceChildren();
    if (!line) {
      const span = document.createElement('span');
      span.className = 'instrumental';
      span.textContent = interludes[currentSection(time).phase] || 'Tomorrow waits';
      lyricCurrent.append(span);
      return;
    }
    const words = Array.isArray(line.words) && line.words.length
      ? line.words
      : [{ word: line.text, start: line.start, end: line.end }];
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

  function lineIndexAt(time) {
    if (!data?.lines?.length) return -1;
    return data.lines.findIndex(line => time >= line.start && time < line.end);
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

  function updateInterface(time, section, beat) {
    const duration = Number.isFinite(audio.duration) ? audio.duration : data?.duration || 0;
    currentTimeEl.textContent = formatTime(time);
    durationEl.textContent = formatTime(duration);
    if (!seekActive) seek.value = duration ? String(time / duration * 1000) : '0';
    const sectionIndex = Math.max(0, data?.sections?.indexOf(section) || 0);
    chapterIndex.textContent = String(sectionIndex + 1).padStart(2, '0');
    chapterName.textContent = section.short;
    chapterDetail.textContent = section.name;
    clockLabel.textContent = section.phase >= 5 ? 'TOMORROW / OPEN' : `TOMORROW / ${String(sectionIndex + 1).padStart(2, '0')}`;
    beatValue.textContent = String(beat.index % 1000).padStart(3, '0');
    stage.classList.toggle('is-peak', isPeak(section));
    updateLyrics(time);
  }

  async function togglePlay() {
    if (audio.paused) {
      if (previewMode && Math.abs(audio.currentTime - previewTime) > 0.5) {
        audio.currentTime = clamp(0, Number.isFinite(audio.duration) ? audio.duration : previewTime, previewTime);
        displayTime = previewTime;
      }
      await audio.play();
    } else {
      audio.pause();
    }
  }

  play.addEventListener('click', () => togglePlay().catch(error => console.error(error)));
  audio.addEventListener('play', () => {
    playIcon.textContent = '\u275a\u275a';
    play.setAttribute('aria-label', 'Pause Waiting for Tomorrow');
  });
  audio.addEventListener('pause', () => {
    playIcon.textContent = '\u25b6';
    play.setAttribute('aria-label', 'Play Waiting for Tomorrow');
  });
  audio.addEventListener('ended', () => { displayTime = 0; });

  function applyLoadedMediaState() {
    durationEl.textContent = formatTime(audio.duration);
    if (previewMode && previewTime > 0) {
      audio.currentTime = clamp(0, audio.duration, previewTime);
      displayTime = audio.currentTime;
    }
  }
  audio.addEventListener('loadedmetadata', applyLoadedMediaState);

  function loadLocalAudio() {
    const mediaUrl = audio.dataset.src;
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

  fetch('../../songs/lyrics/waiting-for-tomorrow.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`Theater data request failed: ${response.status}`);
      return response.json();
    })
    .then(payload => {
      data = payload;
      energyEnvelope = decodeEnvelope(payload.analysis?.energyBase64);
      onsetEnvelope = decodeEnvelope(payload.analysis?.onsetsBase64);
      durationEl.textContent = formatTime(payload.duration);
      updateInterface(displayTime, currentSection(displayTime), beatAt(displayTime));
    })
    .catch(error => {
      console.error(error);
      lyricCurrent.textContent = 'Waiting for theater data';
      chapterDetail.textContent = 'Data unavailable';
    });

  requestAnimationFrame(drawFrame);
})();
