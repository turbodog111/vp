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
  const stop = document.getElementById('stop');
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
    if (config.variant.startsWith('window-view-')) return [2, 5].includes(Number(section?.phase));
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
      if (wordIndex && data.language !== 'ja') lyricCurrent.append(document.createTextNode(' '));
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

  function drawKineticSweep(time, beat, colors, strength = 1, direction = 1) {
    const count = 3 + Math.round(strength * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < count; index++) {
      const travel = ((time * (0.055 + index * 0.006) + index / count) % 1.35) - 0.18;
      const x = direction > 0 ? travel * width : width - travel * width;
      const band = width * (0.045 + index * 0.012 + beat.pulse * 0.012 * strength);
      const gradient = ctx.createLinearGradient(x - band, 0, x + band, 0);
      gradient.addColorStop(0, rgba(colors[index % colors.length], 0));
      gradient.addColorStop(0.5, rgba(colors[index % colors.length], 0.025 + strength * 0.045 + beat.pulse * 0.035));
      gradient.addColorStop(1, rgba(colors[index % colors.length], 0));
      ctx.fillStyle = gradient;
      ctx.save();
      ctx.translate(x, height * 0.5);
      ctx.rotate(direction * (-0.18 + Math.sin(time * 0.09 + index) * 0.025));
      ctx.fillRect(-band, -height, band * 2, height * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawOutboundRings(x, y, time, beat, colors, strength = 1, scaleX = 1) {
    const period = 60 / Math.max(1, Number(config.bpm) || 120);
    for (let echo = 0; echo < 5; echo++) {
      const age = (beat.phase + echo) * period;
      const progress = age / 1.65;
      if (progress >= 1) continue;
      const eased = 1 - (1 - progress) ** 2.2;
      const life = Math.sin(progress * Math.PI);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scaleX, 1);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(width, height) * (0.07 + eased * (0.34 + strength * 0.09)), 0, TAU);
      ctx.strokeStyle = rgba(colors[echo % colors.length], life * (0.035 + strength * 0.095 + beat.pulse * 0.035));
      ctx.lineWidth = 0.8 + smoothed.onset * 2.4 + strength * 0.7;
      ctx.stroke();
      ctx.restore();
    }
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

    // A complete landscape replaces the old floating crest. The terrain moves
    // slowly while rain, identity gates, and gold threads carry the fast beat.
    const landscapeY = height * 0.64;
    for (let layer = 0; layer < 4; layer++) {
      const depth = layer / 3;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = -40; x <= width + 40; x += 36) {
        const scroll = time * (6 + layer * 5);
        const ridge = Math.sin((x + scroll) / width * TAU * (1.2 + layer * 0.2) + layer) * height * (0.035 + depth * 0.025);
        const y = landscapeY + layer * height * 0.045 + ridge;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = rgba(layer % 2 ? colors.bg : colors.deep, 0.78 + depth * 0.16);
      ctx.fill();
      ctx.strokeStyle = rgba(layer % 2 ? colors.primary : colors.secondary, 0.07 + intensity * 0.08);
      ctx.lineWidth = 1 + depth;
      ctx.stroke();
    }

    const gateCount = peak ? 7 : 4;
    for (let gate = 0; gate < gateCount; gate++) {
      const travel = ((time * (0.025 + gate * 0.002) + gate / gateCount) % 1.25) - 0.12;
      const x = travel * width;
      const gateHeight = height * (0.18 + gate % 3 * 0.06);
      const gateWidth = width * (0.035 + gate % 2 * 0.018);
      ctx.strokeStyle = rgba(gate % 2 ? colors.secondary : colors.primary, 0.08 + intensity * 0.14 + beat.pulse * peak * 0.08);
      ctx.lineWidth = 1.2 + smoothed.onset * 2;
      ctx.strokeRect(x, landscapeY - gateHeight, gateWidth, gateHeight);
      ctx.beginPath();
      ctx.moveTo(x + gateWidth * 0.5, landscapeY - gateHeight);
      ctx.lineTo(x + gateWidth * 0.5, landscapeY);
      ctx.stroke();
    }

    const rainCount = peak ? 28 : 14;
    for (let drop = 0; drop < rainCount; drop++) {
      const x = (hash(drop * 13.7) * width + time * (42 + drop % 5 * 9)) % (width + 80) - 40;
      const y = (hash(drop * 7.9) * height + time * (95 + drop % 6 * 15)) % (height + 90) - 45;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x - 16 - peak * 8, y + 38 + peak * 18);
      ctx.strokeStyle = rgba(drop % 4 ? colors.primary : colors.accent, 0.035 + intensity * 0.08 + peak * 0.035);
      ctx.lineWidth = 0.8 + smoothed.onset;
      ctx.stroke();
    }

    drawKineticSweep(time, beat, [colors.primary, colors.secondary, colors.accent], 0.45 + peak * 0.75, phase % 2 ? -1 : 1);

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
    drawOutboundRings(crestX, crestY, time, beat, [colors.primary, colors.secondary], 0.55 + peak * 0.65);

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

    // The scene is now a real dining room: curtain folds, a perspective table,
    // place settings, and sweeping utensils make the appetite physically move.
    for (let fold = 0; fold < 9; fold++) {
      const x = fold / 8 * width;
      const sway = Math.sin(time * 0.16 + fold) * width * 0.012;
      const curtain = ctx.createLinearGradient(x - width * 0.09, 0, x + width * 0.09, 0);
      curtain.addColorStop(0, rgba(fold % 2 ? '#ff60b8' : '#8edcff', 0));
      curtain.addColorStop(0.5, rgba(fold % 2 ? '#ff60b8' : '#8edcff', 0.025 + intensity * 0.035));
      curtain.addColorStop(1, rgba('#ff60b8', 0));
      ctx.fillStyle = curtain;
      ctx.fillRect(x + sway - width * 0.09, 0, width * 0.18, height * 0.72);
    }

    const tableY = height * 0.7;
    ctx.fillStyle = rgba('#070b1e', 0.82);
    ctx.beginPath(); ctx.moveTo(width * 0.06, height); ctx.lineTo(width * 0.34, tableY); ctx.lineTo(width * 0.88, tableY); ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
    for (let ray = 0; ray < (peak ? 14 : 8); ray++) {
      const x = ray / Math.max(1, (peak ? 13 : 7)) * width;
      ctx.beginPath(); ctx.moveTo(width * 0.61, tableY); ctx.lineTo(x, height);
      ctx.strokeStyle = rgba(ray % 2 ? '#ff60b8' : '#8edcff', 0.035 + intensity * 0.055 + beat.pulse * peak * 0.05);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let setting = 0; setting < 3; setting++) {
      const x = width * (0.25 + setting * 0.28);
      const y = tableY + height * (0.1 + setting % 2 * 0.06);
      const radius = Math.min(width, height) * (0.055 + setting % 2 * 0.012);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.38);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU);
      ctx.strokeStyle = rgba(setting % 2 ? '#8edcff' : '#fff8fc', 0.16 + intensity * 0.19 + peak * 0.08);
      ctx.lineWidth = 1.5 + smoothed.onset * 2; ctx.stroke();
      ctx.restore();
    }

    const utensilCount = peak ? 6 : 3;
    for (let utensil = 0; utensil < utensilCount; utensil++) {
      const travel = ((time * (0.07 + utensil * 0.008) + utensil / utensilCount) % 1.3) - 0.15;
      const x = travel * width;
      const y = height * (0.18 + hash(utensil * 6.2) * 0.55);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35 + Math.sin(time * 0.3 + utensil) * 0.12);
      ctx.beginPath(); ctx.moveTo(-width * 0.055, 0); ctx.lineTo(width * 0.055, 0);
      ctx.strokeStyle = rgba(utensil % 2 ? '#8edcff' : '#fff8fc', 0.06 + intensity * 0.12 + peak * 0.08);
      ctx.lineWidth = 2 + smoothed.onset * 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(width * 0.06, 0, 7, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    drawKineticSweep(time, beat, ['#ff60b8', '#8edcff', '#fff8fc'], 0.4 + peak * 0.8, 1);

    const centerX = width * 0.76;
    const centerY = height * 0.42;
    drawOutboundRings(centerX, centerY, time, beat, ['#ff60b8', '#8edcff'], 0.52 + peak * 0.72, 1.12);

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

    // Hyperpop city architecture: equalizer buildings, echo frames, and long
    // ribbons turn the full viewport into a moving stage rather than a portal.
    const skylineY = height * 0.72;
    const buildings = peak ? 24 : 16;
    for (let building = 0; building < buildings; building++) {
      const lane = building / buildings;
      const x = lane * width;
      const baseHeight = height * (0.08 + hash(building * 4.7) * 0.24);
      const bounce = beat.pulse * height * (0.01 + (building % 5) * 0.002) * (peak ? 1.8 : 0.7);
      ctx.fillStyle = rgba(building % 3 ? phaseColors.dark : phaseColors.primary, 0.42 + peak * 0.08);
      ctx.fillRect(x, skylineY - baseHeight - bounce, width / buildings * 0.72, baseHeight + bounce);
      const rows = 3 + building % 4;
      for (let row = 0; row < rows; row++) {
        ctx.fillStyle = rgba(row % 2 ? phaseColors.primary : phaseColors.secondary, 0.08 + intensity * 0.12 + beat.pulse * peak * 0.08);
        ctx.fillRect(x + 3, skylineY - baseHeight + row * baseHeight / rows, width / buildings * 0.3, 2);
      }
    }

    const frameCount = peak ? 6 : 3;
    for (let frame = 0; frame < frameCount; frame++) {
      const progress = (beat.phase + frame / frameCount) % 1;
      const scale = 0.28 + progress * 1.2;
      const frameW = width * 0.34 * scale;
      const frameH = height * 0.31 * scale;
      const drift = Math.sin(time * 0.23 + frame) * width * 0.025;
      ctx.strokeStyle = rgba(frame % 2 ? phaseColors.primary : phaseColors.secondary, (1 - progress) * (0.05 + intensity * 0.14 + peak * 0.08));
      ctx.lineWidth = 1 + smoothed.onset * 2;
      ctx.strokeRect(width * 0.58 - frameW / 2 + drift, height * 0.38 - frameH / 2, frameW, frameH);
    }

    for (let ribbon = 0; ribbon < (peak ? 9 : 5); ribbon++) {
      const baseY = height * (0.12 + ribbon * 0.09);
      ctx.beginPath();
      for (let point = 0; point <= 40; point++) {
        const p = point / 40;
        const x = p * width;
        const y = baseY + Math.sin(p * TAU * (1.1 + ribbon * 0.08) - time * (0.75 + ribbon * 0.04)) * height * (0.018 + peak * 0.02 + intensity * 0.012);
        point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = rgba(ribbon % 2 ? phaseColors.primary : phaseColors.secondary, 0.04 + intensity * 0.1 + peak * 0.07);
      ctx.lineWidth = 1.2 + peak * 0.8 + smoothed.onset * 1.4;
      ctx.stroke();
    }

    drawKineticSweep(time, beat, [phaseColors.primary, phaseColors.secondary, phaseColors.accent], 0.55 + peak * 0.9, phase % 2 ? -1 : 1);

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

    drawOutboundRings(portalX, portalY, time, beat, [phaseColors.primary, phaseColors.secondary], 0.6 + peak * 0.8, 1.45);

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

    // A perspective dance hall gives the song a floor, crowd, and opening
    // walls. The old ray burst now belongs to a visible mirror ball.
    const floorY = height * 0.72;
    ctx.fillStyle = rgba('#24070d', 0.72);
    ctx.fillRect(0, floorY, width, height - floorY);
    for (let ray = 0; ray < (peak ? 18 : 10); ray++) {
      const targetX = ray / Math.max(1, (peak ? 17 : 9)) * width;
      ctx.beginPath(); ctx.moveTo(sunX, floorY); ctx.lineTo(targetX, height);
      ctx.strokeStyle = rgba(ray % 3 ? '#ffb20f' : '#37cfee', 0.04 + intensity * 0.07 + beat.pulse * peak * 0.055);
      ctx.lineWidth = 1 + smoothed.onset;
      ctx.stroke();
    }
    for (let row = 0; row < 6; row++) {
      const y = floorY + (height - floorY) * (row / 5) ** 1.7;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y);
      ctx.strokeStyle = rgba(row % 2 ? '#37cfee' : '#ffb20f', 0.025 + intensity * 0.055);
      ctx.stroke();
    }

    const doorOpen = 0.08 + peak * 0.18 + beat.pulse * peak * 0.04;
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 0 : width;
      ctx.fillStyle = rgba(side < 0 ? '#b62710' : '#102150', 0.5);
      ctx.beginPath();
      ctx.moveTo(edge, 0);
      ctx.lineTo(width * (0.5 + side * doorOpen), 0);
      ctx.lineTo(width * (0.5 + side * (doorOpen + 0.09)), floorY);
      ctx.lineTo(edge, floorY);
      ctx.closePath(); ctx.fill();
    }

    const crowd = peak ? 18 : 10;
    for (let person = 0; person < crowd; person++) {
      const x = width * (0.05 + person / Math.max(1, crowd - 1) * 0.9);
      const jump = Math.sin(beat.phase * Math.PI) * height * (0.009 + (person % 4) * 0.002) * (peak ? 1.4 : 0.55);
      const y = floorY - jump;
      ctx.fillStyle = rgba('#12060c', 0.7);
      ctx.beginPath(); ctx.arc(x, y - 14, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(person % 3 ? '#fff7e0' : '#37cfee', 0.08 + intensity * 0.15 + beat.pulse * peak * 0.12);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 14); ctx.moveTo(x, y - 2); ctx.lineTo(x - 10, y - 12 - beat.pulse * peak * 8); ctx.moveTo(x, y - 2); ctx.lineTo(x + 10, y - 12 - beat.pulse * peak * 8); ctx.stroke();
    }

    drawKineticSweep(time, beat, ['#ffb20f', '#37cfee', '#fff7e0'], 0.45 + peak * 0.9, 1);

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

    const ballRadius = Math.min(width, height) * (0.07 + intensity * 0.015);
    const ball = ctx.createRadialGradient(sunX - ballRadius * 0.3, sunY - ballRadius * 0.35, 0, sunX, sunY, ballRadius);
    ball.addColorStop(0, '#fff7e0'); ball.addColorStop(0.38, '#37cfee'); ball.addColorStop(1, '#0b3c76');
    ctx.fillStyle = ball; ctx.beginPath(); ctx.arc(sunX, sunY, ballRadius, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba('#fff7e0', 0.48 + beat.pulse * 0.3); ctx.lineWidth = 1.5 + smoothed.onset * 2; ctx.stroke();
    for (let line = -3; line <= 3; line++) {
      ctx.beginPath(); ctx.ellipse(sunX, sunY + line * ballRadius / 4, ballRadius * Math.sqrt(Math.max(0.1, 1 - (line / 4) ** 2)), ballRadius * 0.08, 0, 0, TAU);
      ctx.strokeStyle = rgba(line % 2 ? '#ffb20f' : '#fff7e0', 0.14 + intensity * 0.11); ctx.lineWidth = 0.8; ctx.stroke();
    }
    drawOutboundRings(sunX, sunY, time, beat, ['#ffb20f', '#37cfee'], 0.55 + peak * 0.7);

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

    // A forward-moving route replaces the generic central pulse: layered
    // bridges, checkpoints, and opening doorways make every refrain progress.
    const horizon = height * 0.61;
    ctx.fillStyle = rgba('#021319', 0.78);
    ctx.fillRect(0, horizon, width, height - horizon);
    for (let lane = 0; lane < (peak ? 9 : 6); lane++) {
      const targetX = lane / Math.max(1, (peak ? 8 : 5)) * width;
      ctx.beginPath(); ctx.moveTo(width * 0.72, horizon); ctx.lineTo(targetX, height);
      ctx.strokeStyle = rgba(lane % 2 ? '#9eff82' : '#52e6e8', 0.035 + intensity * 0.065 + beat.pulse * peak * 0.05);
      ctx.lineWidth = 1 + smoothed.onset;
      ctx.stroke();
    }
    for (let marker = 0; marker < 7; marker++) {
      const progress = ((time * (0.13 + peak * 0.04) + marker / 7) % 1);
      const y = horizon + (height - horizon) * progress ** 1.7;
      const half = width * (0.04 + progress * 0.52);
      ctx.beginPath(); ctx.moveTo(width * 0.72 - half, y); ctx.lineTo(width * 0.72 + half, y);
      ctx.strokeStyle = rgba(marker % 2 ? '#9eff82' : '#52e6e8', (1 - progress) * (0.05 + intensity * 0.1 + peak * 0.05));
      ctx.lineWidth = 1 + progress * 2;
      ctx.stroke();
    }

    const doorwayCount = peak ? 5 : 3;
    for (let door = 0; door < doorwayCount; door++) {
      const progress = (beat.phase + door / doorwayCount) % 1;
      const scale = 0.2 + progress * 1.2;
      const x = width * 0.72 + Math.sin(time * 0.18 + door) * width * 0.018;
      const doorW = width * 0.12 * scale;
      const doorH = height * 0.24 * scale;
      ctx.strokeStyle = rgba(door % 2 ? '#9eff82' : '#52e6e8', (1 - progress) * (0.06 + intensity * 0.15 + peak * 0.08));
      ctx.lineWidth = 1.2 + smoothed.onset * 2;
      ctx.strokeRect(x - doorW / 2, horizon - doorH, doorW, doorH);
    }

    const arrowCount = peak ? 14 : 7;
    for (let arrow = 0; arrow < arrowCount; arrow++) {
      const travel = ((time * (0.07 + arrow % 4 * 0.008) + hash(arrow * 4.1)) % 1.2) - 0.1;
      const x = travel * width;
      const y = height * (0.1 + hash(arrow * 7.3) * 0.44);
      const size = 8 + hash(arrow) * 15 + beat.pulse * peak * 6;
      ctx.beginPath(); ctx.moveTo(x - size, y - size * 0.5); ctx.lineTo(x, y); ctx.lineTo(x - size, y + size * 0.5);
      ctx.strokeStyle = rgba(arrow % 2 ? '#9eff82' : '#e8fff9', 0.06 + intensity * 0.11 + peak * 0.06);
      ctx.lineWidth = 1.4 + smoothed.onset * 1.5; ctx.stroke();
    }

    drawKineticSweep(time, beat, ['#9eff82', '#52e6e8', '#e8fff9'], 0.42 + peak * 0.78, -1);

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
    drawOutboundRings(centerX, centerY, time, beat, ['#9eff82', '#52e6e8'], 0.5 + peak * 0.62, 1.32);

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

  function drawWindowView(time, section, beat, peak) {
    const phase = Number(section.phase || 0);
    const phasePalettes = [
      ['#b6e0ec', '#f4c6a6', '#324c58'],
      ['#97d3c6', '#e9e2b2', '#254b41'],
      ['#8ed6eb', '#fae2b1', '#366679'],
      ['#ecb592', '#fddca6', '#5f353e'],
      ['#add3df', '#e5d7bf', '#3e525f'],
      ['#757cb2', '#f59887', '#272749'],
      ['#27325b', '#e6668a', '#0d152c'],
      ['#1c263d', '#a8bec5', '#080e19']
    ];
    const colors = phasePalettes[Math.max(0, Math.min(phasePalettes.length - 1, phase))];
    const intensity = clamp(0, 1.2, 0.32 + smoothed.energy * 0.62 + smoothed.onset * 0.42 + peak * beat.pulse * 0.2);
    const speed = width * (0.105 + smoothed.energy * 0.04 + peak * 0.018);
    const horizon = height * (0.52 + Math.sin(time * 0.055) * 0.008);

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, colors[0]);
    sky.addColorStop(0.62, colors[1]);
    sky.addColorStop(1, colors[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const sunX = width * (0.78 - phase * 0.055);
    const sunY = height * (0.2 + phase * 0.035);
    const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, width * 0.34);
    sun.addColorStop(0, rgba(phase >= 6 ? '#f4d6e1' : '#fff7ca', 0.34 + beat.pulse * 0.07));
    sun.addColorStop(0.18, rgba(colors[1], 0.16));
    sun.addColorStop(1, rgba(colors[1], 0));
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);

    for (let ridge = 0; ridge < 3; ridge++) {
      ctx.beginPath();
      ctx.moveTo(-20, height);
      for (let x = -20; x <= width + 20; x += width / 48) {
        const drift = time * speed * (0.035 + ridge * 0.012);
        const y = horizon - height * (0.03 + ridge * 0.035)
          + Math.sin((x + drift) / width * Math.PI * (2.2 + ridge * 0.7) + ridge) * height * (0.025 + ridge * 0.008);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width + 20, height);
      ctx.closePath();
      ctx.fillStyle = rgba(ridge === 0 ? colors[2] : '#70d6c2', 0.18 + ridge * 0.07);
      ctx.fill();
    }

    if (phase === 2 || phase === 4) {
      const water = ctx.createLinearGradient(0, horizon, 0, height);
      water.addColorStop(0, rgba('#f7fcf4', 0.16));
      water.addColorStop(1, rgba(colors[2], 0.72));
      ctx.fillStyle = water;
      ctx.fillRect(0, horizon, width, height - horizon);
      for (let line = 0; line < 18; line++) {
        const y = horizon + (line / 18) ** 1.45 * height * 0.45;
        const offset = (time * speed * (0.08 + line * 0.006)) % (width * 0.22);
        ctx.beginPath();
        for (let x = -width * 0.22 + offset; x < width + width * 0.22; x += width * 0.22) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + width * (0.07 + line * 0.002), y + Math.sin(time * 0.7 + line) * 2);
        }
        ctx.strokeStyle = rgba(line % 3 ? '#f7fcf4' : '#ee5b7e', 0.045 + intensity * 0.045);
        ctx.lineWidth = 0.7 + line / 18;
        ctx.stroke();
      }
    } else {
      const ground = ctx.createLinearGradient(0, horizon, 0, height);
      ground.addColorStop(0, rgba(colors[2], 0.56));
      ground.addColorStop(1, 'rgba(12,21,29,0.94)');
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, width, height - horizon);
    }

    const cityPhase = phase === 0 || phase === 3 || phase >= 5;
    if (cityPhase) {
      const count = phase >= 6 ? 20 : 14;
      for (let index = 0; index < count; index++) {
        const slot = width * (0.095 + hash(index * 8.31) * 0.06);
        const x = width - ((time * speed * 0.32 + index * slot) % (width + slot * 2)) + slot;
        const buildingWidth = slot * (0.62 + hash(index * 3.71) * 0.6);
        const buildingHeight = height * (0.1 + hash(index * 9.17) * (phase >= 5 ? 0.32 : 0.2));
        const y = horizon - buildingHeight;
        ctx.fillStyle = rgba(phase >= 6 ? '#121d37' : colors[2], 0.48 + hash(index) * 0.2);
        ctx.fillRect(x, y, buildingWidth, buildingHeight);
        const rows = Math.max(2, Math.floor(buildingHeight / 18));
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < 3; column++) {
            if (hash(index * 71 + row * 11 + column) < 0.48) continue;
            ctx.fillStyle = rgba(phase >= 5 ? '#ffd28a' : '#f7fcf4', 0.22 + beat.pulse * 0.08);
            ctx.fillRect(x + buildingWidth * (0.16 + column * 0.27), y + 8 + row * 15, buildingWidth * 0.11, 5);
          }
        }
      }
    } else {
      for (let index = 0; index < 18; index++) {
        const spacing = width * 0.085;
        const x = width - ((time * speed * 0.48 + index * spacing) % (width + spacing * 2)) + spacing;
        const trunkHeight = height * (0.16 + hash(index * 2.7) * 0.17);
        ctx.strokeStyle = 'rgba(31,60,49,0.55)';
        ctx.lineWidth = 2 + hash(index) * 3;
        ctx.beginPath(); ctx.moveTo(x, horizon); ctx.lineTo(x, horizon - trunkHeight); ctx.stroke();
        ctx.fillStyle = rgba(index % 3 ? '#30684c' : '#70d6c2', 0.35 + intensity * 0.12);
        ctx.beginPath(); ctx.ellipse(x, horizon - trunkHeight, width * (0.025 + hash(index * 4.1) * 0.025), height * 0.08, 0, 0, TAU); ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(9,14,21,0.78)';
    ctx.fillRect(0, height * 0.78, width, height * 0.22);
    for (let rail = 0; rail < 4; rail++) {
      const y = height * (0.81 + rail * 0.052);
      ctx.strokeStyle = rail % 2 ? 'rgba(155,174,177,0.3)' : 'rgba(72,90,96,0.28)';
      ctx.lineWidth = 1.2 + rail * 0.6;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    const sleeperOffset = (time * speed * 1.4) % (width * 0.09);
    for (let x = -width * 0.1 + sleeperOffset; x < width * 1.1; x += width * 0.09) {
      ctx.strokeStyle = 'rgba(174,154,127,0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, height * 0.79); ctx.lineTo(x - width * 0.035, height); ctx.stroke();
    }

    for (let index = 0; index < 7; index++) {
      const spacing = width * 0.27;
      const x = width - ((time * speed * 1.05 + index * spacing) % (width + spacing));
      ctx.fillStyle = 'rgba(20,29,36,0.72)';
      ctx.fillRect(x, 0, 5, height);
      const streak = ctx.createLinearGradient(x - width * 0.08, 0, x + 5, 0);
      streak.addColorStop(0, 'rgba(0,0,0,0)');
      streak.addColorStop(1, rgba('#141d24', 0.16 + smoothed.onset * 0.1));
      ctx.fillStyle = streak;
      ctx.fillRect(x - width * 0.08, 0, width * 0.08, height);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let reflection = 0; reflection < 5; reflection++) {
      const x = (((time * (0.018 + reflection * 0.002) + reflection * 0.23) % 1.45) - 0.22) * width;
      ctx.save();
      ctx.translate(x, height * 0.45);
      ctx.rotate(-0.18);
      const sheen = ctx.createLinearGradient(-width * 0.035, 0, width * 0.035, 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, rgba(reflection % 2 ? '#70d6c2' : '#f7fcf4', 0.025 + intensity * 0.03));
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(-width * 0.04, -height, width * 0.08, height * 2);
      ctx.restore();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(9,15,23,0.86)';
    ctx.fillRect(0, 0, width, height * 0.045);
    ctx.fillRect(0, height * 0.95, width, height * 0.05);
    ctx.fillRect(width * 0.115, 0, width * 0.018, height);
    ctx.fillRect(width * 0.865, 0, width * 0.018, height);
    ctx.strokeStyle = 'rgba(226,239,235,0.16)';
    ctx.strokeRect(width * 0.13, height * 0.045, width * 0.735, height * 0.905);
    for (let strap = 0; strap < 4; strap++) {
      const x = width * (0.28 + strap * 0.15);
      ctx.strokeStyle = rgba('#f7fcf4', 0.09 + smoothed.energy * 0.03);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height * 0.13); ctx.stroke();
      ctx.strokeRect(x - width * 0.018, height * 0.13, width * 0.036, height * 0.055);
    }

    if (peak) {
      const bloom = ctx.createLinearGradient(0, 0, width, 0);
      bloom.addColorStop(0, 'rgba(255,255,255,0)');
      bloom.addColorStop(0.48, rgba('#ee5b7e', 0.035 + beat.pulse * 0.09 + smoothed.onset * 0.08));
      bloom.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);
    }
  }

  function updateInterface(time, section, beat) {
    const index = Math.max(0, data.sections.indexOf(section));
    chapterIndex.textContent = String(index + 1).padStart(2, '0');
    chapterName.textContent = section.short || config.title;
    chapterDetail.textContent = section.name || config.subtitle;
    beatValue.textContent = String(Math.max(0, beat.index)).padStart(3, '0');
    stage.classList.toggle('is-peak', isPeak(section));
    currentTimeEl.textContent = formatTime(previewMode ? time : audio.currentTime);
    durationEl.textContent = formatTime(Number.isFinite(audio.duration) ? audio.duration : data.duration);
    if (!seeking) seek.value = String(Math.round(clamp(0, 1, (previewMode ? time : audio.currentTime) / (audio.duration || data.duration)) * 1000));
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
    else if (config.variant.startsWith('window-view-')) drawWindowView(audioTime, section, beat, peak);
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
      if (stop) stop.disabled = true;
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
  if (stop) stop.addEventListener('click', stopAudio);
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
