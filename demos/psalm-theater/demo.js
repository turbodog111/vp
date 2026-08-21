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
  const beatValue = document.getElementById('beat-value');
  const lyricPrevious = document.getElementById('lyric-previous');
  const lyricCurrent = document.getElementById('lyric-current');
  const lyricNext = document.getElementById('lyric-next');
  const query = new URLSearchParams(location.search);
  const previewValue = query.get('preview');
  const previewTime = Number(previewValue);
  const previewMode = previewValue !== null && Number.isFinite(previewTime) && previewTime >= 0;
  const silentMode = query.has('silent');

  const palette = {
    night: '#17191c',
    charcoal: '#25282a',
    slate: '#56636a',
    cloud: '#a5afb2',
    sky: '#8bcde2',
    blue: '#4a8298',
    gold: '#dda963',
    amber: '#efc576',
    cream: '#fff7df',
    earth: '#4a3730'
  };

  const interludes = [
    'The heavens are listening.',
    'The horizon keeps its counsel.',
    'Known beneath an endless sky.',
    'The firmament answers.',
    'A stronghold made from praise.',
    'The sky opens.',
    'Creation holds the final note.'
  ];

  let data = null;
  let energyEnvelope = [];
  let onsetEnvelope = [];
  let dpr = 1;
  let width = 0;
  let height = 0;
  let displayTime = previewMode ? previewTime : 0;
  let seeking = false;

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
      || { phase: 0, short: 'PRAISE / OPEN', name: 'Hallelujah' };
  }

  function isPeak(section) {
    return [2, 3, 5, 6, 7, 8].includes(section.phase);
  }

  function beatAt(time) {
    const bpm = data?.bpm || 120.045;
    const offset = data?.beatOffset || 0.153;
    const beats = Math.max(0, (time - offset) * bpm / 60);
    const phase = beats - Math.floor(beats);
    return {
      index: Math.floor(beats),
      phase,
      pulse: Math.exp(-phase * 6.2),
      measure: Math.floor(beats / 4),
      downbeat: Math.floor(beats) % 4 === 0
    };
  }

  function intensityAt(section, recorded, beat) {
    const base = [0.32, 0.42, 0.86, 0.92, 0.52, 1.02, 1.08, 1.12, 1.18, 0.24][section.phase] ?? 0.4;
    return clamp(0, 1.45, base + recorded.energy * 0.22 + recorded.onset * 0.18 + beat.pulse * (isPeak(section) ? 0.18 : 0.06));
  }

  function drawSky(time, section, recorded, beat, intensity) {
    const peak = isPeak(section);
    const greatName = section.phase === 8;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, greatName ? '#536f7b' : peak ? '#3d5058' : '#30383c');
    gradient.addColorStop(0.46, greatName ? '#896f59' : peak ? '#5d5e59' : '#54534d');
    gradient.addColorStop(1, greatName ? '#5a3e31' : '#392d29');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.72, height * 0.23, 0, width * 0.72, height * 0.23, width * 0.72);
    glow.addColorStop(0, rgba(greatName ? palette.cream : palette.amber, 0.1 + intensity * 0.09 + beat.pulse * (peak ? 0.08 : 0.025)));
    glow.addColorStop(0.42, rgba(palette.sky, 0.025 + recorded.energy * 0.05));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, width * 0.08, width * 0.5, height * 0.48, width * 0.82);
    vignette.addColorStop(0.55, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(8,10,11,0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    if (peak) {
      const downbeatBoost = beat.downbeat ? beat.pulse * 0.13 : beat.pulse * 0.045;
      const praiseFlash = ctx.createRadialGradient(width * 0.5, height * 0.68, 0, width * 0.5, height * 0.68, width * 0.88);
      praiseFlash.addColorStop(0, rgba(section.phase === 8 ? palette.cream : palette.gold, 0.035 + downbeatBoost));
      praiseFlash.addColorStop(0.42, rgba(palette.sky, 0.02 + downbeatBoost * 0.55));
      praiseFlash.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = praiseFlash;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  function drawCloudVaults(time, section, recorded, beat, intensity) {
    const peak = isPeak(section);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let band = 0; band < 7; band++) {
      const center = height * (0.09 + band * 0.075);
      const direction = band % 2 ? -1 : 1;
      const drift = Math.sin(time * (0.055 + band * 0.004) + band * 1.8) * width * 0.08 * direction;
      const rise = Math.sin(time * 0.075 + band) * height * 0.02;
      ctx.beginPath();
      ctx.moveTo(-width * 0.18, center + rise);
      ctx.bezierCurveTo(
        width * 0.18 + drift, center - height * (0.07 + band * 0.004),
        width * 0.58 - drift, center + height * (0.065 + band * 0.003),
        width * 1.18, center - height * 0.018 + rise
      );
      ctx.strokeStyle = rgba(band % 3 === 0 ? palette.gold : palette.cloud, 0.035 + intensity * 0.025 + (peak ? recorded.energy * 0.04 : 0));
      ctx.lineWidth = height * (0.018 + band * 0.003);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    for (let vault = 0; vault < 5; vault++) {
      const inset = width * (0.05 + vault * 0.075);
      const archHeight = height * (0.48 + vault * 0.06);
      ctx.beginPath();
      ctx.moveTo(inset, height * 0.79);
      ctx.bezierCurveTo(inset, height * 0.79 - archHeight, width - inset, height * 0.79 - archHeight, width - inset, height * 0.79);
      ctx.strokeStyle = rgba(vault % 2 ? palette.sky : palette.gold, 0.05 + intensity * 0.025 + (peak ? beat.pulse * 0.035 : 0));
      ctx.lineWidth = 0.8 + recorded.energy * 1.4;
      ctx.stroke();
    }
  }

  function drawCelestialBodies(time, section, recorded, beat, intensity) {
    const sunX = width * 0.76;
    const sunY = height * 0.24;
    const sunR = Math.min(width, height) * (0.052 + beat.pulse * (isPeak(section) ? 0.006 : 0.002));
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 4.5);
    sunGlow.addColorStop(0, rgba(palette.cream, 0.84));
    sunGlow.addColorStop(0.12, rgba(palette.gold, 0.58));
    sunGlow.addColorStop(1, 'rgba(221,169,99,0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - sunR * 5, sunY - sunR * 5, sunR * 10, sunR * 10);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = rgba(palette.cream, 0.6 + intensity * 0.08);
    ctx.fill();

    const moonX = width * 0.33;
    const moonY = height * 0.23;
    const moonR = sunR * 0.72;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = rgba(palette.sky, 0.36 + recorded.energy * 0.12);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.36, moonY - moonR * 0.08, moonR * 0.92, 0, Math.PI * 2);
    ctx.fillStyle = rgba(palette.charcoal, 0.94);
    ctx.fill();

    const starCount = width < 700 ? 48 : 84;
    for (let index = 0; index < starCount; index++) {
      const x = hash(index * 3.17) * width;
      const y = (0.04 + hash(index * 7.91) * 0.57) * height;
      const twinkle = 0.5 + 0.5 * Math.sin(time * (0.45 + hash(index) * 0.55) + index);
      const size = 0.7 + hash(index * 11.2) * 1.5 + (index % 13 === 0 ? beat.pulse * 1.7 : 0);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(index % 5 ? palette.cream : palette.sky, 0.16 + twinkle * 0.32 + intensity * 0.055);
      ctx.fill();
    }
  }

  function drawConstellations(time, section, recorded, beat, intensity) {
    const groups = [
      [[0.12,0.18],[0.18,0.11],[0.25,0.2],[0.31,0.13],[0.38,0.2]],
      [[0.57,0.18],[0.63,0.1],[0.69,0.17],[0.66,0.29],[0.75,0.34]],
      [[0.33,0.32],[0.4,0.25],[0.46,0.34],[0.51,0.28],[0.55,0.4]]
    ];
    ctx.save();
    ctx.translate(Math.sin(time * 0.04) * width * 0.008, Math.cos(time * 0.035) * height * 0.006);
    groups.forEach((points, group) => {
      ctx.beginPath();
      points.forEach(([px, py], index) => {
        const x = px * width;
        const y = py * height;
        if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = rgba(group % 2 ? palette.gold : palette.sky, 0.07 + intensity * 0.035 + (isPeak(section) ? beat.pulse * 0.075 : 0));
      ctx.lineWidth = 0.8 + recorded.onset * 1.4;
      ctx.stroke();
      points.forEach(([px, py], index) => {
        ctx.beginPath();
        const pointPulse = (beat.index + index + group) % 4 === 0 ? beat.pulse * 2 : 0;
        ctx.arc(px * width, py * height, 1.6 + pointPulse, 0, Math.PI * 2);
        ctx.fillStyle = rgba(palette.cream, 0.38 + intensity * 0.12);
        ctx.fill();
      });
    });
    ctx.restore();
  }

  function drawHorizon(time, section, recorded, beat, intensity) {
    const horizon = height * 0.73;
    const layers = [
      { y: -0.02, amp: 0.055, color: '#25292a', alpha: 0.94 },
      { y: 0.035, amp: 0.04, color: '#3d3c38', alpha: 0.96 },
      { y: 0.085, amp: 0.028, color: '#4a3730', alpha: 1 }
    ];
    layers.forEach((layer, layerIndex) => {
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let point = 0; point <= 60; point++) {
        const progress = point / 60;
        const x = progress * width;
        const y = horizon + height * layer.y
          + Math.sin(progress * Math.PI * (3.1 + layerIndex) + layerIndex * 1.3 + time * 0.025) * height * layer.amp
          + Math.sin(progress * Math.PI * 9.2 - time * 0.04) * height * layer.amp * 0.22;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = rgba(layer.color, layer.alpha);
      ctx.fill();
    });

    ctx.save();
    for (let line = 0; line < 34; line++) {
      const y = horizon + height * (0.02 + line * 0.008);
      const travel = ((time * (0.02 + recorded.energy * 0.015) + line * 0.083) % 1.25) - 0.2;
      const span = width * (0.08 + hash(line * 9.7) * 0.13);
      ctx.beginPath();
      ctx.moveTo(travel * width, y);
      ctx.quadraticCurveTo(travel * width + span * 0.5, y - intensity * 4, travel * width + span, y);
      ctx.strokeStyle = rgba(line % 4 ? palette.gold : palette.sky, 0.035 + intensity * 0.025 + beat.pulse * 0.018);
      ctx.lineWidth = 0.8 + recorded.energy * 1.3;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPraiseArches(time, section, recorded, beat, intensity) {
    if (!isPeak(section)) return;
    const beatPeriod = 60 / (data?.bpm || 120.045);
    const lifeBeats = section.phase === 8 ? 8 : 6;
    const originX = width * (section.phase % 2 ? 0.74 : 0.5);
    const originY = height * 0.72;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let echo = 0; echo < lifeBeats; echo++) {
      const age = (beat.phase + echo) * beatPeriod;
      const life = age / (beatPeriod * lifeBeats);
      if (life >= 1) continue;
      const eased = 1 - Math.pow(1 - life, 2.25);
      const alpha = Math.sin(life * Math.PI) * (0.11 + recorded.energy * 0.11 + recorded.onset * 0.06);
      const radiusX = width * (0.06 + eased * 0.78);
      const radiusY = height * (0.045 + eased * 0.62);
      ctx.beginPath();
      ctx.ellipse(originX, originY, radiusX, radiusY, 0, Math.PI, Math.PI * 2);
      ctx.strokeStyle = rgba(echo % 2 ? palette.sky : palette.gold, alpha);
      ctx.lineWidth = 1.2 + (1 - life) * 2.2 + beat.pulse * (echo === 0 ? 2 : 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSkySweeps(time, section, recorded, beat, intensity) {
    const peak = isPeak(section);
    const count = peak ? 7 : 2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < count; index++) {
      const direction = index % 2 ? -1 : 1;
      const travel = ((time * (0.055 + index * 0.004) + hash(index * 2.3)) % 1.5) - 0.25;
      const x = direction > 0 ? travel * width : width - travel * width;
      const top = -height * 0.15;
      const bottom = height * (0.78 + hash(index) * 0.15);
      const spread = width * (peak ? 0.055 : 0.028) * (1 + beat.pulse * 0.4);
      const beam = ctx.createLinearGradient(x - spread, 0, x + spread, 0);
      beam.addColorStop(0, 'rgba(255,255,255,0)');
      beam.addColorStop(0.5, rgba(index % 3 ? palette.sky : palette.gold, (peak ? 0.085 : 0.014) + recorded.energy * (peak ? 0.075 : 0.012) + beat.pulse * (peak ? 0.035 : 0)));
      beam.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - spread * 0.22, top);
      ctx.lineTo(x + spread * 1.8, bottom);
      ctx.lineTo(x - spread * 1.8, bottom);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrownAndComets(time, section, recorded, beat, intensity) {
    if (![3, 5, 7, 8].includes(section.phase)) return;
    const cx = width * 0.5;
    const cy = height * 0.31;
    const crownW = Math.min(width * 0.28, height * 0.42);
    const crownH = crownW * 0.28;
    ctx.save();
    ctx.translate(cx, cy + Math.sin(time * 0.35) * 4);
    ctx.beginPath();
    ctx.moveTo(-crownW * 0.5, crownH * 0.28);
    ctx.lineTo(-crownW * 0.38, -crownH * 0.2);
    ctx.lineTo(-crownW * 0.17, crownH * 0.02);
    ctx.lineTo(0, -crownH * 0.56);
    ctx.lineTo(crownW * 0.17, crownH * 0.02);
    ctx.lineTo(crownW * 0.38, -crownH * 0.2);
    ctx.lineTo(crownW * 0.5, crownH * 0.28);
    ctx.closePath();
    ctx.strokeStyle = rgba(palette.gold, 0.15 + intensity * 0.08 + beat.pulse * 0.2);
    ctx.lineWidth = 1.5 + recorded.energy * 2.2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let comet = 0; comet < 9; comet++) {
      const cycle = ((time * (0.09 + comet * 0.002) + hash(comet * 8.3)) % 1.4) - 0.2;
      const x = cycle * width;
      const y = height * (0.08 + hash(comet * 17.9) * 0.47) + cycle * height * 0.16;
      const length = width * (0.025 + hash(comet * 3.4) * 0.065) * (0.6 + intensity * 0.4);
      const trail = ctx.createLinearGradient(x - length, y - length * 0.3, x, y);
      trail.addColorStop(0, 'rgba(255,255,255,0)');
      trail.addColorStop(1, rgba(comet % 2 ? palette.sky : palette.gold, 0.18 + recorded.energy * 0.18));
      ctx.strokeStyle = trail;
      ctx.lineWidth = 0.8 + recorded.onset * 2;
      ctx.beginPath();
      ctx.moveTo(x - length, y - length * 0.3);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderWords(line, time) {
    lyricCurrent.className = 'lyric-current';
    lyricCurrent.replaceChildren();
    line.words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'word';
      if (time >= word.end) span.classList.add('is-sung');
      else if (time >= word.start) span.classList.add('is-current');
      span.textContent = `${index ? ' ' : ''}${word.word}`;
      lyricCurrent.append(span);
    });
  }

  function updateLyrics(time) {
    if (!data?.lines?.length) return;
    const lineIndex = data.lines.findIndex(line => time >= line.start && time < line.end);
    const nextIndex = data.lines.findIndex(line => line.start > time);
    const resolvedIndex = lineIndex >= 0 ? lineIndex : nextIndex;
    if (lineIndex >= 0) {
      renderWords(data.lines[lineIndex], time);
      lyricPrevious.textContent = lineIndex > 0 ? data.lines[lineIndex - 1].text : '';
      lyricNext.textContent = lineIndex + 1 < data.lines.length ? data.lines[lineIndex + 1].text : '';
    } else {
      const section = currentSection(time);
      lyricCurrent.className = 'lyric-current instrumental';
      lyricCurrent.textContent = interludes[section.phase % interludes.length];
      lyricPrevious.textContent = nextIndex > 0 ? data.lines[nextIndex - 1].text : '';
      lyricNext.textContent = nextIndex >= 0 ? data.lines[nextIndex].text : '';
    }
    void resolvedIndex;
  }

  function updateInterface(time, section, beat) {
    const sectionIndex = Math.max(0, data.sections.indexOf(section));
    chapterIndex.textContent = String(sectionIndex + 1).padStart(2, '0');
    chapterName.textContent = section.short;
    chapterDetail.textContent = section.name;
    beatValue.textContent = String(Math.max(0, beat.index)).padStart(3, '0');
    stage.classList.toggle('is-peak', isPeak(section));
    currentTimeEl.textContent = formatTime(time);
    durationEl.textContent = formatTime(data.duration);
    if (!seeking) seek.value = String(Math.round(clamp(0, 1, time / data.duration) * 1000));
    updateLyrics(time);
  }

  function drawFrame() {
    if (!data) {
      requestAnimationFrame(drawFrame);
      return;
    }
    const time = previewMode ? previewTime : audio.currentTime;
    displayTime = time;
    const section = currentSection(time);
    const recorded = recordedAt(time);
    const beat = beatAt(time);
    const intensity = intensityAt(section, recorded, beat);

    ctx.clearRect(0, 0, width, height);
    drawSky(time, section, recorded, beat, intensity);
    drawCloudVaults(time, section, recorded, beat, intensity);
    drawCelestialBodies(time, section, recorded, beat, intensity);
    drawConstellations(time, section, recorded, beat, intensity);
    drawSkySweeps(time, section, recorded, beat, intensity);
    drawPraiseArches(time, section, recorded, beat, intensity);
    drawCrownAndComets(time, section, recorded, beat, intensity);
    drawHorizon(time, section, recorded, beat, intensity);
    updateInterface(time, section, beat);
    requestAnimationFrame(drawFrame);
  }

  async function load() {
    const response = await fetch('../../songs/lyrics/psalm-8-halle.json');
    if (!response.ok) throw new Error(`Lyrics request failed: ${response.status}`);
    data = await response.json();
    energyEnvelope = decodeEnvelope(data.analysis?.energy);
    onsetEnvelope = decodeEnvelope(data.analysis?.onsets);
    durationEl.textContent = formatTime(data.duration);

    if (!previewMode) {
      audio.src = audio.dataset.src;
      audio.muted = silentMode;
      audio.load();
    } else {
      play.disabled = true;
      seek.disabled = true;
      mute.disabled = true;
    }
  }

  play.addEventListener('click', async () => {
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    play.disabled = false;
    durationEl.textContent = formatTime(Number.isFinite(audio.duration) ? audio.duration : data?.duration);
  });
  audio.addEventListener('play', () => {
    playIcon.textContent = '\u2016';
    play.title = 'Pause';
    play.setAttribute('aria-label', 'Pause Psalm 8');
  });
  audio.addEventListener('pause', () => {
    playIcon.textContent = '\u25b6';
    play.title = 'Play';
    play.setAttribute('aria-label', 'Play Psalm 8');
  });
  audio.addEventListener('ended', () => {
    playIcon.textContent = '\u25b6';
  });

  seek.addEventListener('pointerdown', () => { seeking = true; });
  function seekToSlider() {
    if (!data || previewMode) return;
    const target = Number(seek.value) / 1000 * data.duration;
    audio.currentTime = target;
    displayTime = target;
  }
  seek.addEventListener('input', seekToSlider);
  const finishSeek = () => { seeking = false; };
  seek.addEventListener('change', () => {
    seekToSlider();
    finishSeek();
  });
  seek.addEventListener('pointerup', finishSeek);
  seek.addEventListener('pointercancel', finishSeek);

  mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    mute.textContent = audio.muted ? 'MUTE' : 'VOL';
    mute.title = audio.muted ? 'Unmute' : 'Mute';
  });

  window.addEventListener('resize', resize);
  resize();
  load().catch(error => {
    lyricCurrent.className = 'lyric-current instrumental';
    lyricCurrent.textContent = `Unable to load theater: ${error.message}`;
  });
  requestAnimationFrame(drawFrame);
})();
