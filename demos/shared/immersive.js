(() => {
  'use strict';

  const config = window.VP_THEATER_CONFIG;
  if (!config) throw new Error('Missing VP_THEATER_CONFIG');

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
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
  const beatValue = document.getElementById('beat-value');
  const lyricPrevious = document.getElementById('lyric-previous');
  const lyricCurrent = document.getElementById('lyric-current');
  const lyricNext = document.getElementById('lyric-next');
  const query = new URLSearchParams(location.search);
  const previewValue = query.get('preview');
  const previewTime = previewValue === null ? Number.NaN : Number(previewValue);
  const previewMode = Number.isFinite(previewTime) && previewTime >= 0;
  const TAU = Math.PI * 2;
  const palette = config.palette;

  let data = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let seeking = false;
  let audioContext = null;
  let analyser = null;
  let source = null;
  let spectrum = null;
  let waveform = null;
  let energyEnvelope = [];
  let onsetEnvelope = [];
  let smoothed = { energy: 0.08, onset: 0, bass: 0.08, highs: 0.05 };
  let lastFrame = performance.now();
  let playbackStopped = false;

  document.body.dataset.variant = config.variant;
  Object.entries(palette).forEach(([name, value]) => document.documentElement.style.setProperty(`--${name}`, value));

  const clamp = (min, max, value) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const hash = value => {
    const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function rgba(hex, alpha) {
    const raw = hex.replace('#', '');
    const value = raw.length === 3 ? raw.split('').map(char => char + char).join('') : raw;
    const number = parseInt(value, 16);
    return `rgba(${number >> 16}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
  }

  function resize() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function formatTime(seconds) {
    const whole = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function decodeEnvelope(value) {
    if (!value) return [];
    try {
      return Array.from(atob(value), char => char.charCodeAt(0) / 255);
    } catch (_) {
      return [];
    }
  }

  function envelopeAt(values, time, step) {
    if (!values.length || !step) return 0;
    const position = clamp(0, values.length - 1, time / step);
    const lower = Math.floor(position);
    const upper = Math.min(values.length - 1, lower + 1);
    return mix(values[lower], values[upper], position - lower);
  }

  function timelineTime(audioTime) {
    if (config.variant !== 'hero-rie') return Math.max(0, audioTime - Number(config.lyricOffset || 0));
    const points = data?.timing?.rieOffset;
    if (!Array.isArray(points) || !points.length) return Math.max(0, audioTime - 0.25);
    let left = points[0];
    let right = points[points.length - 1];
    for (let index = 1; index < points.length; index++) {
      if (audioTime <= points[index].at) {
        left = points[index - 1];
        right = points[index];
        break;
      }
    }
    const amount = clamp(0, 1, (audioTime - left.at) / Math.max(0.001, right.at - left.at));
    return Math.max(0, audioTime - mix(left.seconds, right.seconds, amount));
  }

  function sectionAt(time) {
    return data?.sections?.find(section => time >= section.start && time < section.end)
      || data?.sections?.[data.sections.length - 1]
      || { name: config.title, short: 'OPENING', phase: 0 };
  }

  function isPeak(section) {
    if (config.variant === 'one-more-bite') return /CHORUS/i.test(section?.short || '');
    if (config.variant.startsWith('encore-')) return !!section?.chorus;
    if (config.variant === 'celebration') return /CELEBRATION|CHOIR|RESPONSE/i.test(section?.short || '');
    if (config.variant === 'okay') return /REFRAIN|LIFT|FINAL/i.test(section?.short || '');
    return [2, 7, 8].includes(Number(section?.phase));
  }

  function initAudioGraph() {
    if (audioContext) return;
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.62;
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    spectrum = new Uint8Array(analyser.frequencyBinCount);
    waveform = new Uint8Array(analyser.fftSize);
  }

  function analyze(time, dt) {
    const profile = config.analysisKey ? data?.analysis?.[config.analysisKey] : data?.analysis;
    const step = Number(profile?.step) || 0.1;
    let energy = envelopeAt(energyEnvelope, time, step);
    let onset = envelopeAt(onsetEnvelope, time, step);
    let bass = energy * 0.72;
    let highs = onset * 0.7;
    if (analyser && !audio.paused) {
      analyser.getByteFrequencyData(spectrum);
      const average = (start, end) => {
        let sum = 0;
        for (let index = start; index < end; index++) sum += spectrum[index];
        return sum / Math.max(1, end - start) / 255;
      };
      bass = Math.max(bass, average(1, 18));
      highs = Math.max(highs, average(42, 170));
    }
    const follow = (current, target, attack, release) => mix(current, target, 1 - Math.exp(-dt * (target > current ? attack : release)));
    smoothed.energy = follow(smoothed.energy, energy, 11, 4.5);
    smoothed.onset = follow(smoothed.onset, onset, 15, 7);
    smoothed.bass = follow(smoothed.bass, bass, 12, 4.5);
    smoothed.highs = follow(smoothed.highs, highs, 14, 6);
  }

  function renderLyrics(time) {
    if (!data?.lines?.length) {
      const section = sectionAt(time);
      const index = Math.max(0, data?.sections?.indexOf(section) || 0);
      lyricCurrent.className = 'lyric-current instrumental';
      lyricCurrent.textContent = config.interludes[index % config.interludes.length] || config.interludes[0];
      lyricPrevious.textContent = '';
      lyricNext.textContent = '';
      return;
    }
    const index = data.lines.findIndex(line => time >= line.start && time < line.end + 0.12);
    if (index < 0) {
      const next = data.lines.findIndex(line => line.start > time);
      lyricCurrent.className = 'lyric-current instrumental';
      const section = sectionAt(time);
      const sectionIndex = Math.max(0, data.sections.indexOf(section));
      lyricCurrent.textContent = config.interludes[sectionIndex % config.interludes.length] || config.interludes[0];
      lyricPrevious.textContent = next > 0 ? data.lines[next - 1].text : '';
      lyricNext.textContent = next >= 0 ? data.lines[next].text : '';
      return;
    }
    const line = data.lines[index];
    lyricCurrent.className = 'lyric-current';
    lyricCurrent.replaceChildren();
    (line.words || [{ word: line.text, start: line.start, end: line.end }]).forEach((word, wordIndex) => {
      if (wordIndex) lyricCurrent.append(document.createTextNode(' '));
      const span = document.createElement('span');
      span.className = 'word';
      if (time >= word.end) span.classList.add('is-sung');
      else if (time >= word.start) span.classList.add('is-current');
      span.textContent = word.word;
      lyricCurrent.append(span);
    });
    lyricPrevious.textContent = data.lines[index - 1]?.text || '';
    lyricNext.textContent = data.lines[index + 1]?.text || '';
  }

  function beatState(time) {
    const bpm = Number(config.bpm) || 132;
    const position = Math.max(0, (time - Number(config.beatOffset || 0)) * bpm / 60);
    const phase = position - Math.floor(position);
    return { index: Math.floor(position), phase, pulse: Math.exp(-phase * 6.8) };
  }

  function drawHero(time, section, beat, peak) {
    const phase = Number(section.phase || 0);
    const palettes = config.phasePalettes;
    const colors = palettes[Math.min(palettes.length - 1, phase)] || palettes[0];
    const intensity = clamp(0, 1, 0.2 + smoothed.energy * 0.8 + smoothed.onset * 0.52 + peak * 0.24);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, colors.bg);
    background.addColorStop(0.58, colors.deep);
    background.addColorStop(1, '#010302');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const glowX = width * (0.22 + 0.56 * (0.5 + 0.5 * Math.sin(time * 0.075 + phase)));
    const glow = ctx.createRadialGradient(glowX, height * 0.38, 0, glowX, height * 0.38, width * 0.66);
    glow.addColorStop(0, rgba(colors.primary, 0.05 + intensity * 0.24));
    glow.addColorStop(0.48, rgba(colors.secondary, 0.02 + intensity * 0.07));
    glow.addColorStop(1, rgba(colors.primary, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const horizon = height * (0.62 + Math.sin(time * 0.11) * 0.018);
    for (let lane = 0; lane < 8; lane++) {
      ctx.beginPath();
      for (let x = -20; x <= width + 20; x += 18) {
        const y = horizon + lane * height * 0.032
          + Math.sin(x / width * Math.PI * (2.2 + lane * 0.13) - time * (0.34 + lane * 0.025)) * height * (0.018 + intensity * 0.022);
        if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(lane % 2 ? colors.secondary : colors.primary, 0.08 + intensity * 0.15);
      ctx.lineWidth = 1 + peak * 0.8;
      ctx.stroke();
    }

    const crestX = width * 0.76;
    const crestY = height * 0.39;
    for (let ring = 0; ring < 5 + peak * 3; ring++) {
      const progress = (beat.phase + ring / (5 + peak * 3)) % 1;
      ctx.beginPath();
      ctx.arc(crestX, crestY, Math.min(width, height) * (0.06 + progress * 0.42), 0, TAU);
      ctx.strokeStyle = rgba(ring % 2 ? colors.secondary : colors.primary, (1 - progress) * (0.08 + intensity * 0.18));
      ctx.lineWidth = 1 + beat.pulse * 1.2;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(crestX, crestY);
    ctx.rotate(Math.sin(time * 0.2) * 0.07);
    ctx.strokeStyle = rgba(colors.accent, 0.38 + intensity * 0.44);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -54); ctx.lineTo(42, -18); ctx.lineTo(31, 39); ctx.lineTo(0, 58); ctx.lineTo(-31, 39); ctx.lineTo(-42, -18); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-19, 13); ctx.lineTo(0, -22); ctx.lineTo(19, 13);
    ctx.moveTo(0, -22); ctx.lineTo(0, 37);
    ctx.stroke();
    ctx.restore();

    const threadCount = peak ? 18 : 9;
    for (let index = 0; index < threadCount; index++) {
      const born = (beat.index - index) * 60 / config.bpm;
      const age = time - born;
      const x = ((hash(index * 9.3 + beat.index) + age * (0.05 + hash(index) * 0.04)) % 1.2 - 0.1) * width;
      const y = hash(index * 4.7) * height;
      ctx.strokeStyle = rgba(index % 2 ? colors.primary : colors.secondary, (0.04 + peak * 0.1) * (0.4 + beat.pulse));
      ctx.beginPath();
      ctx.moveTo(x - width * 0.1, y + Math.sin(time + index) * 14);
      ctx.quadraticCurveTo(x, y - 48, x + width * 0.14, y + 12);
      ctx.stroke();
    }
  }

  function drawBite(time, section, beat, peak) {
    const intensity = clamp(0, 1, 0.18 + smoothed.energy * 0.92 + smoothed.onset * 0.55 + peak * 0.22);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#170b1d');
    background.addColorStop(0.52, peak ? '#3b123d' : '#1b1735');
    background.addColorStop(1, '#081728');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const bloom = ctx.createRadialGradient(width * 0.72, height * 0.42, 0, width * 0.72, height * 0.42, width * 0.65);
    bloom.addColorStop(0, rgba('#ff60b8', 0.06 + intensity * 0.3));
    bloom.addColorStop(0.42, rgba('#94dcff', 0.02 + intensity * 0.12));
    bloom.addColorStop(1, rgba('#94dcff', 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);

    const centerX = width * 0.76;
    const centerY = height * 0.42;
    for (let ring = 0; ring < (peak ? 8 : 4); ring++) {
      const progress = (beat.phase + ring / (peak ? 8 : 4)) % 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(width, height) * (0.07 + progress * 0.48), 0, TAU);
      ctx.strokeStyle = rgba(ring % 2 ? '#8edcff' : '#ff60b8', (1 - progress) * (0.08 + intensity * 0.23));
      ctx.lineWidth = 1 + peak * 1.3;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(time * 0.05);
    ctx.strokeStyle = rgba('#fff8fc', 0.38 + intensity * 0.4);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0.22, TAU - 0.22);
    ctx.stroke();
    for (let bite = 0; bite < 3; bite++) {
      ctx.beginPath();
      ctx.arc(66 + bite * 4, -18 + bite * 18, 13, Math.PI * 0.7, Math.PI * 1.72);
      ctx.stroke();
    }
    ctx.restore();

    for (let rail = 0; rail < 7; rail++) {
      const y = height * (0.14 + rail * 0.105) + Math.sin(time * (0.16 + rail * 0.014) + rail) * height * (0.012 + peak * 0.009);
      ctx.strokeStyle = rgba(rail % 2 ? '#ff60b8' : '#75d9ef', 0.045 + intensity * (0.08 + peak * 0.07));
      ctx.lineWidth = rail % 3 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.bezierCurveTo(width * 0.28, y - 70, width * 0.64, y + 66, width + 40, y - 10);
      ctx.stroke();
    }

    const crumbCount = peak ? 36 : 16;
    for (let index = 0; index < crumbCount; index++) {
      const x = (hash(index * 7.3) * width + time * (10 + hash(index) * 20)) % (width + 30) - 15;
      const y = hash(index * 4.1) * height + Math.sin(time * 0.7 + index) * 20;
      ctx.fillStyle = rgba(index % 2 ? '#ff8fce' : '#a8e8ff', (0.07 + peak * 0.12) * (0.45 + beat.pulse));
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash(index * 2.9) * 2.4, 0, TAU);
      ctx.fill();
    }
  }

  function drawEncore(time, section, beat, peak) {
    const intensity = clamp(0, 1, 0.22 + smoothed.energy * 0.88 + smoothed.onset * 0.65 + peak * 0.28);
    const phase = Number(section.phase || 0);
    const phaseColors = config.phasePalettes[phase % config.phasePalettes.length];
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, phaseColors.dark);
    background.addColorStop(0.52, '#230109');
    background.addColorStop(1, '#060106');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const portalX = width * (0.7 + Math.sin(time * 0.13) * 0.035);
    const portalY = height * (0.42 + Math.cos(time * 0.17) * 0.025);
    const portal = ctx.createRadialGradient(portalX, portalY, 0, portalX, portalY, width * 0.58);
    portal.addColorStop(0, rgba(phaseColors.primary, 0.08 + intensity * 0.3));
    portal.addColorStop(0.38, rgba(phaseColors.secondary, 0.025 + intensity * 0.11));
    portal.addColorStop(1, rgba(phaseColors.primary, 0));
    ctx.fillStyle = portal;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(-0.14 + Math.sin(time * 0.21) * 0.035);
    const panelCount = peak ? 11 : 6;
    for (let index = -panelCount; index <= panelCount; index++) {
      const travel = ((time * (0.05 + peak * 0.045) + index / panelCount) % 1.5) - 0.75;
      const x = travel * width * 1.4;
      const panelWidth = width * (0.018 + hash(index * 4.2) * 0.035);
      const gradient = ctx.createLinearGradient(x, -height, x + panelWidth, height);
      gradient.addColorStop(0, rgba(index % 2 ? phaseColors.primary : phaseColors.secondary, 0));
      gradient.addColorStop(0.48, rgba(index % 2 ? phaseColors.primary : phaseColors.secondary, 0.05 + intensity * (0.09 + peak * 0.07)));
      gradient.addColorStop(1, rgba(phaseColors.primary, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x, -height, panelWidth, height * 2);
    }
    ctx.restore();

    for (let ring = 0; ring < (peak ? 10 : 5); ring++) {
      const progress = (beat.phase + ring / (peak ? 10 : 5)) % 1;
      ctx.save();
      ctx.translate(portalX, portalY);
      ctx.rotate(time * (ring % 2 ? 0.07 : -0.05) + ring);
      ctx.scale(1, 0.62 + Math.sin(time * 0.2 + ring) * 0.06);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(width, height) * (0.08 + progress * 0.52), 0, TAU);
      ctx.strokeStyle = rgba(ring % 2 ? phaseColors.primary : phaseColors.secondary, (1 - progress) * (0.08 + intensity * 0.2));
      ctx.lineWidth = 1 + peak * 1.2 + beat.pulse;
      ctx.stroke();
      ctx.restore();
    }

    const slashCount = peak ? 34 : 15;
    for (let index = 0; index < slashCount; index++) {
      const speed = 80 + hash(index * 8.7) * 180;
      const x = (hash(index * 4.3) * width + time * speed) % (width + 150) - 75;
      const y = hash(index * 6.9) * height;
      const length = 22 + hash(index * 3.1) * (peak ? 88 : 45);
      ctx.strokeStyle = rgba(index % 3 ? phaseColors.primary : phaseColors.accent, (0.05 + peak * 0.11) * (0.45 + beat.pulse));
      ctx.lineWidth = 1 + hash(index) * 2;
      ctx.beginPath();
      ctx.moveTo(x - length, y + length * 0.26);
      ctx.lineTo(x + length, y - length * 0.26);
      ctx.stroke();
    }
  }

  function drawCelebration(time, section, beat, peak) {
    const intensity = clamp(0, 1, 0.2 + smoothed.energy * 0.9 + smoothed.onset * 0.6 + peak * 0.3);
    const background = ctx.createLinearGradient(0, height, width, 0);
    background.addColorStop(0, '#3e0b07');
    background.addColorStop(0.46, peak ? '#a62b06' : '#6f1807');
    background.addColorStop(1, '#101938');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const sunX = width * 0.73;
    const sunY = height * 0.4;
    const bloom = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, width * 0.65);
    bloom.addColorStop(0, rgba('#ffb20f', 0.1 + intensity * 0.36));
    bloom.addColorStop(0.34, rgba('#37cfee', 0.025 + intensity * 0.14));
    bloom.addColorStop(1, rgba('#ffb20f', 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(sunX, sunY);
    ctx.rotate(time * 0.08);
    const rays = peak ? 22 : 12;
    for (let ray = 0; ray < rays; ray++) {
      const angle = ray / rays * TAU;
      const inner = Math.min(width, height) * (0.08 + beat.pulse * 0.02);
      const outer = Math.max(width, height) * (0.52 + hash(ray * 4.8) * 0.28);
      const spread = 0.014 + peak * 0.012;
      ctx.fillStyle = rgba(ray % 3 === 0 ? '#37cfee' : ray % 2 ? '#ffb20f' : '#fff7e0', 0.025 + intensity * (0.045 + peak * 0.045));
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle - spread) * inner, Math.sin(angle - spread) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineTo(Math.cos(angle + spread) * inner, Math.sin(angle + spread) * inner);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const mirrorCount = peak ? 18 : 9;
    for (let index = 0; index < mirrorCount; index++) {
      const orbit = Math.min(width, height) * (0.13 + (index % 6) * 0.07);
      const angle = time * (0.16 + (index % 4) * 0.035) + index * 1.7;
      const x = sunX + Math.cos(angle) * orbit * 1.55;
      const y = sunY + Math.sin(angle) * orbit;
      const size = 5 + hash(index * 5.7) * (peak ? 18 : 10) + beat.pulse * 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle * 0.6);
      ctx.strokeStyle = rgba(index % 2 ? '#37cfee' : '#fff7e0', 0.12 + intensity * 0.3);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();
    }

    const bursts = peak ? 34 : 13;
    for (let index = 0; index < bursts; index++) {
      const x = hash(index * 9.1 + Math.floor(time * 0.5)) * width;
      const y = hash(index * 2.7) * height;
      const radius = 2 + hash(index * 5.3) * 5 + beat.pulse * 3;
      ctx.fillStyle = rgba(index % 3 === 0 ? '#37cfee' : index % 2 ? '#ffb20f' : '#fff7e0', 0.12 + peak * 0.18);
      ctx.beginPath();
      for (let point = 0; point < 8; point++) {
        const r = point % 2 ? radius * 0.35 : radius;
        const angle = point / 8 * TAU + time * 0.2;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (!point) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawOkay(time, section, beat, peak) {
    const intensity = clamp(0, 1, 0.18 + smoothed.energy * 0.92 + smoothed.onset * 0.64 + peak * 0.25);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#041b21');
    background.addColorStop(0.48, peak ? '#0b5f63' : '#07363f');
    background.addColorStop(1, '#082044');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.72, height * 0.42, 0, width * 0.72, height * 0.42, width * 0.64);
    glow.addColorStop(0, rgba('#9eff82', 0.07 + intensity * 0.32));
    glow.addColorStop(0.42, rgba('#52e6e8', 0.025 + intensity * 0.13));
    glow.addColorStop(1, rgba('#52e6e8', 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const laneCount = peak ? 12 : 7;
    for (let lane = 0; lane < laneCount; lane++) {
      const baseY = height * (0.14 + lane / Math.max(1, laneCount - 1) * 0.7);
      ctx.beginPath();
      for (let x = -20; x < width + 20; x += 20) {
        const wave = Math.sin(x / width * TAU * (1.4 + lane * 0.13) - time * (1.2 + lane * 0.04));
        const y = baseY + wave * height * (0.008 + intensity * (0.015 + peak * 0.012));
        if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(lane % 3 === 0 ? '#9eff82' : lane % 2 ? '#52e6e8' : '#d9fff6', 0.05 + intensity * (0.08 + peak * 0.05));
      ctx.lineWidth = 1 + beat.pulse * 0.8;
      ctx.stroke();
    }

    const centerX = width * 0.72;
    const centerY = height * 0.42;
    for (let ring = 0; ring < (peak ? 9 : 5); ring++) {
      const progress = (beat.phase + ring / (peak ? 9 : 5)) % 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(width, height) * (0.07 + progress * 0.48), 0, TAU);
      ctx.strokeStyle = rgba(ring % 2 ? '#9eff82' : '#52e6e8', (1 - progress) * (0.08 + intensity * 0.2));
      ctx.lineWidth = 1 + peak + beat.pulse;
      ctx.stroke();
    }

    const glyphs = peak ? 30 : 14;
    for (let index = 0; index < glyphs; index++) {
      const x = (hash(index * 4.2) * width + time * (12 + hash(index) * 24)) % (width + 30) - 15;
      const y = hash(index * 8.3) * height;
      const size = 3 + hash(index * 2.1) * 8 + beat.pulse * 4;
      ctx.strokeStyle = rgba(index % 2 ? '#9eff82' : '#d9fff6', 0.08 + peak * 0.13);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
      ctx.stroke();
    }
  }

  function updateInterface(time, section, beat) {
    const index = Math.max(0, data.sections.indexOf(section));
    chapterIndex.textContent = String(index + 1).padStart(2, '0');
    chapterName.textContent = section.short || config.title;
    chapterDetail.textContent = section.name || config.subtitle;
    beatValue.textContent = String(Math.max(0, beat.index)).padStart(3, '0');
    stage.classList.toggle('is-peak', isPeak(section));
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = formatTime(Number.isFinite(audio.duration) ? audio.duration : data.duration);
    if (!seeking) seek.value = String(Math.round(clamp(0, 1, audio.currentTime / (audio.duration || data.duration)) * 1000));
    renderLyrics(time);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!data) return;
    const dt = clamp(0.001, 0.08, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    const audioTime = previewMode ? previewTime : audio.currentTime;
    const time = timelineTime(audioTime);
    const section = sectionAt(time);
    const beat = beatState(audioTime);
    analyze(audioTime, dt);
    const peak = isPeak(section) ? 1 : 0;
    ctx.clearRect(0, 0, width, height);
    if (config.variant === 'hero-rie') drawHero(audioTime, section, beat, peak);
    else if (config.variant === 'one-more-bite') drawBite(audioTime, section, beat, peak);
    else if (config.variant.startsWith('encore-')) drawEncore(audioTime, section, beat, peak);
    else if (config.variant === 'celebration') drawCelebration(audioTime, section, beat, peak);
    else drawOkay(audioTime, section, beat, peak);
    updateInterface(time, section, beat);
  }

  async function load() {
    const response = await fetch(config.lyricsUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Lyrics request failed: ${response.status}`);
    data = await response.json();
    if (config.lyricVariant && data.variants?.[config.lyricVariant]) {
      data.lines = data.variants[config.lyricVariant].lines || [];
    }
    const profile = config.analysisKey ? data.analysis?.[config.analysisKey] : data.analysis;
    energyEnvelope = decodeEnvelope(profile?.energyBase64 || profile?.energy);
    onsetEnvelope = decodeEnvelope(profile?.onsetsBase64 || profile?.onsets);
    durationEl.textContent = formatTime(data.duration);
    if (previewMode) {
      play.disabled = true;
      seek.disabled = true;
      mute.disabled = true;
    } else {
      audio.src = config.audioUrl;
      audio.load();
    }
  }

  async function playAudio(options = {}) {
    playbackStopped = false;
    stage.classList.remove('is-stopped');
    if (options.analyze !== false) {
      initAudioGraph();
    }
    if (audioContext?.state === 'suspended') await audioContext.resume();
    await audio.play();
    return true;
  }

  function pauseAudio() {
    audio.pause();
    return true;
  }

  function stopAudio() {
    playbackStopped = true;
    audio.pause();
    try { audio.currentTime = 0; } catch (_) {}
    seek.value = '0';
    currentTimeEl.textContent = '0:00';
    stage.classList.add('is-stopped');
    return true;
  }

  async function toggleAudio(options = {}) {
    if (audio.paused) return playAudio(options);
    return pauseAudio();
  }

  // Native Desktop UI controls call this API directly. Programmatic starts
  // deliberately skip WebAudio initialization: WKWebView may suspend a newly
  // created AudioContext without a real gesture, which routes otherwise valid
  // media playback into silence. The page's real button still enables the
  // analyser because its click is a genuine user gesture.
  window.vpTheaterPlayback = {
    play: () => playAudio({ analyze: false }),
    pause: pauseAudio,
    toggle: () => toggleAudio({ analyze: false }),
    stop: stopAudio,
    state: () => ({ paused: audio.paused, stopped: playbackStopped, time: audio.currentTime })
  };

  play.addEventListener('click', async () => {
    try {
      await toggleAudio({ analyze: true });
    } catch (error) {
      console.error('Theater playback failed:', error);
      play.title = 'Playback failed - click to retry';
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    play.disabled = false;
    durationEl.textContent = formatTime(audio.duration);
    window.dispatchEvent(new CustomEvent('vpTheaterReady'));
  });
  audio.addEventListener('play', () => { playIcon.textContent = '\u2016'; play.title = 'Pause'; });
  audio.addEventListener('pause', () => { playIcon.textContent = '\u25b6'; play.title = 'Play'; });
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('input', () => {
    const duration = audio.duration || data?.duration || 0;
    if (duration) audio.currentTime = Number(seek.value) / 1000 * duration;
  });
  const endSeek = () => { seeking = false; };
  seek.addEventListener('change', endSeek);
  seek.addEventListener('pointerup', endSeek);
  seek.addEventListener('pointercancel', endSeek);
  mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    mute.textContent = audio.muted ? 'MUTE' : 'VOL';
  });
  window.addEventListener('resize', resize);
  resize();
  load().catch(error => {
    lyricCurrent.className = 'lyric-current instrumental';
    lyricCurrent.textContent = `Unable to load theater: ${error.message}`;
  });
  requestAnimationFrame(frame);
})();
