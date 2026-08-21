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
  const bearingValue = document.getElementById('bearing-value');
  const lyricPrevious = document.getElementById('lyric-previous');
  const lyricCurrent = document.getElementById('lyric-current');
  const lyricNext = document.getElementById('lyric-next');
  const query = new URLSearchParams(location.search);
  const previewTime = Number(query.get('preview'));
  const previewMode = Number.isFinite(previewTime) && previewTime >= 0;

  const palette = {
    night: '#010714',
    deep: '#061536',
    cobalt: '#2f68dc',
    blue: '#79a9ff',
    gold: '#ffd45c',
    red: '#e74358',
    white: '#f7fbff'
  };

  let data = null;
  let dpr = 1;
  let width = 0;
  let height = 0;
  let audioContext = null;
  let analyser = null;
  let source = null;
  let spectrum = null;
  let timeDomain = null;
  let activeLineIndex = -2;
  let seekActive = false;
  let lastFrame = performance.now();
  let displayTime = previewMode ? previewTime : 0;
  let smooth = { bass: 0.1, mids: 0.08, highs: 0.06, rms: 0.08, rise: 0 };

  const clamp = (min, max, value) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const hash = value => {
    const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function rgba(hex, alpha) {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
    const number = parseInt(full, 16);
    return `rgba(${number >> 16}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
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

  function currentSection(time) {
    return data?.sections.find(section => time >= section.start && time < section.end)
      || data?.sections[data.sections.length - 1]
      || { phase: 0, short: 'DEPARTURE', name: 'Star before bearing' };
  }

  function isChorusSection(section) {
    return String(section?.short || '').startsWith('CHORUS');
  }

  function initAudioGraph() {
    if (audioContext) return;
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.58;
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    spectrum = new Uint8Array(analyser.frequencyBinCount);
    timeDomain = new Uint8Array(analyser.fftSize);
  }

  function averageBand(lowHz, highHz) {
    if (!analyser || !spectrum || !audioContext) return 0;
    const binHz = audioContext.sampleRate / analyser.fftSize;
    const start = clamp(0, spectrum.length - 1, Math.floor(lowHz / binHz));
    const end = clamp(start + 1, spectrum.length, Math.ceil(highHz / binHz));
    let total = 0;
    for (let index = start; index < end; index++) total += spectrum[index];
    return total / Math.max(1, end - start) / 255;
  }

  function analyze(dt, time, phase) {
    let bass;
    let mids;
    let highs;
    let rms;
    if (analyser && !audio.paused) {
      analyser.getByteFrequencyData(spectrum);
      analyser.getByteTimeDomainData(timeDomain);
      bass = averageBand(35, 180);
      mids = averageBand(180, 2200);
      highs = averageBand(2200, 9000);
      let sum = 0;
      for (const value of timeDomain) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      rms = Math.sqrt(sum / timeDomain.length);
    } else {
      const previewLift = phase === 5 || phase === 6 || phase === 7 ? 0.28 : phase === 0 || phase === 8 ? 0.08 : 0.15;
      bass = previewLift + Math.sin(time * 1.17) * 0.025;
      mids = previewLift * 0.78 + Math.sin(time * 0.71 + 1) * 0.02;
      highs = previewLift * 0.55 + Math.sin(time * 1.91) * 0.015;
      rms = previewLift * 0.5;
    }
    const previousRms = smooth.rms;
    const follow = (current, target, attack = 0.2, release = 0.06) => mix(current, target, 1 - Math.exp(-dt * (target > current ? attack : release) * 60));
    smooth.bass = follow(smooth.bass, bass, 0.23, 0.055);
    smooth.mids = follow(smooth.mids, mids, 0.2, 0.05);
    smooth.highs = follow(smooth.highs, highs, 0.27, 0.075);
    smooth.rms = follow(smooth.rms, rms, 0.24, 0.055);
    smooth.rise = follow(smooth.rise, Math.max(0, smooth.rms - previousRms) * 12, 0.35, 0.08);
  }

  function beatAt(time) {
    const bpm = data?.bpm || 178.206;
    const offset = data?.beatOffset || 0;
    const beats = Math.max(0, (time - offset) * bpm / 60);
    const phase = beats - Math.floor(beats);
    return {
      index: Math.floor(beats),
      phase,
      pulse: Math.exp(-phase * 7.2)
    };
  }

  function skyWaveY(x, time, lane, phase, energy) {
    const progress = x / width;
    const speed = 0.075 + lane * 0.006 + (phase === 5 || phase === 6 ? 0.045 : 0);
    const drift = time * speed + lane * 0.24;
    const diagonal = (progress - 0.5) * height * (0.12 + lane * 0.01);
    const primary = Math.sin(progress * Math.PI * (1.55 + lane * 0.16) - drift * Math.PI * 2);
    const secondary = Math.sin(progress * Math.PI * 4.2 + drift * Math.PI * 1.7 + lane) * 0.28;
    return height * (0.1 + lane * 0.055) + diagonal + (primary + secondary) * height * (0.055 + energy * 0.075);
  }

  function transferEvents(time, beat, phase) {
    const secondsPerBeat = 60 / (data?.bpm || 178.206);
    const interval = phase === 5 || phase === 6 ? 2 : phase === 7 ? 1 : 4;
    const events = [];
    const latest = beat.index - (beat.index % interval);
    for (let index = latest - interval * 18; index <= latest; index += interval) {
      const born = (index * secondsPerBeat) + (data?.beatOffset || 0);
      const age = time - born;
      if (age < 0 || age > 7.5) continue;
      events.push({
        age,
        x: width * (0.12 + hash(index * 1.73) * 0.76),
        strength: (0.38 + hash(index * 2.91) * 0.62) * (phase === 5 || phase === 6 ? 1.35 : phase === 7 ? 1.65 : 0.72),
        sign: index % 2 ? 1 : -1
      });
    }
    if (phase === 7) {
      [196.6, 201.44, 206.56, 212.06].forEach((born, index) => {
        const age = time - born;
        if (age >= 0 && age <= 8.5) events.push({ age, x: width * (0.2 + index * 0.2), strength: 2.25, sign: index % 2 ? -1 : 1 });
      });
    }
    return events;
  }

  function waterDisplacement(x, time, events, energy) {
    let value = Math.sin(x / width * Math.PI * 3.4 + time * 0.23) * height * (0.004 + energy * 0.006);
    for (const event of events) {
      const expansion = width * (0.045 + event.age * 0.07);
      const distance = Math.abs(x - event.x);
      const crestDistance = Math.abs(distance - expansion);
      const envelope = Math.exp(-(crestDistance * crestDistance) / (2 * Math.pow(width * 0.025 + event.age * width * 0.004, 2)));
      const decay = Math.exp(-event.age * 0.22);
      value += envelope * Math.sin(distance / width * 48 - event.age * 3.1) * height * 0.021 * event.strength * decay;
    }
    return value;
  }

  function drawBackground(time, section, beat) {
    const phase = section.phase;
    const chorus = isChorusSection(section);
    const energy = clamp(0, 1, smooth.rms * 2.8 + smooth.bass * 0.42);
    const horizon = height * 0.7;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, phase === 3 ? '#05060a' : chorus ? '#061638' : palette.night);
    sky.addColorStop(0.58, phase === 3 ? '#17191e' : chorus ? '#1252a7' : '#08235a');
    sky.addColorStop(1, phase === 8 ? '#163454' : chorus ? '#2b7bd0' : '#0b2969');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);

    const aurora = ctx.createRadialGradient(width * 0.25, height * 0.2, 0, width * 0.25, height * 0.2, width * 0.55);
    aurora.addColorStop(0, rgba(phase === 3 ? palette.white : palette.cobalt, 0.08 + energy * 0.16));
    aurora.addColorStop(0.48, rgba(palette.blue, 0.035 + energy * 0.06));
    aurora.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, width, horizon);

    if (chorus) {
      const beatLight = 0.075 + energy * 0.1 + beat.pulse * 0.2;
      ctx.fillStyle = rgba(beat.index % 2 ? palette.blue : palette.gold, beatLight);
      ctx.fillRect(0, 0, width, horizon);

      const bloomX = width * (0.5 + Math.sin(time * 0.18) * 0.12);
      const bloom = ctx.createRadialGradient(bloomX, horizon * 0.48, 0, bloomX, horizon * 0.48, width * 0.58);
      bloom.addColorStop(0, rgba(palette.white, 0.08 + beat.pulse * 0.14));
      bloom.addColorStop(0.3, rgba(palette.gold, 0.055 + beat.pulse * 0.08));
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, horizon);

      for (let beamIndex = 0; beamIndex < 4; beamIndex++) {
        const originX = width * (0.16 + beamIndex * 0.23);
        const sweep = Math.sin(time * 0.62 + beamIndex * 1.4) * width * 0.07;
        ctx.beginPath();
        ctx.moveTo(originX - width * 0.018, 0);
        ctx.lineTo(originX + width * 0.018, 0);
        ctx.lineTo(originX + sweep + width * 0.15, horizon);
        ctx.lineTo(originX + sweep - width * 0.15, horizon);
        ctx.closePath();
        ctx.fillStyle = rgba(beamIndex % 2 ? palette.gold : palette.blue, 0.025 + beat.pulse * 0.055 + energy * 0.035);
        ctx.fill();
      }
    }

    if (phase === 3) {
      ctx.fillStyle = 'rgba(242,244,239,0.09)';
      ctx.fillRect(width * 0.5, 0, width * 0.5, horizon);
      ctx.fillStyle = rgba(palette.red, 0.35 + beat.pulse * 0.22);
      ctx.fillRect(width * 0.5 - 1.5, 0, 3, horizon);
    }

    const starX = width * 0.18;
    const starY = height * 0.2;
    const glow = ctx.createRadialGradient(starX, starY, 0, starX, starY, width * 0.09);
    glow.addColorStop(0, rgba(palette.gold, 0.45 + beat.pulse * 0.12));
    glow.addColorStop(0.08, rgba(palette.gold, 0.17));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, horizon * 0.72);
    ctx.save();
    ctx.translate(starX, starY);
    ctx.rotate(time * 0.025);
    ctx.strokeStyle = rgba(palette.gold, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();
    ctx.restore();

    const waveCount = chorus ? 15 : phase === 5 || phase === 6 ? 13 : 9;
    const solo = phase === 5 || phase === 6;
    for (let lane = waveCount - 1; lane >= 0; lane--) {
      const trails = lane % 3 === 0 ? 3 : 1;
      for (let trail = trails - 1; trail >= 0; trail--) {
        ctx.beginPath();
        for (let point = 0; point <= 110; point++) {
          const x = point / 110 * width;
          const y = skyWaveY(x, time - trail * 0.16, lane, phase, energy) + trail * height * 0.012;
          point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        const trailFade = 1 - trail / Math.max(1, trails);
        ctx.strokeStyle = rgba(lane % 3 === 0 ? palette.gold : palette.blue, (0.07 + energy * 0.19 + (solo ? 0.1 : 0) + (chorus ? 0.13 + beat.pulse * 0.08 : 0)) * trailFade);
        ctx.lineWidth = 1.2 + lane * 0.34 + smooth.rise * 3.4;
        if (trail === 0 && lane % 2 === 0) {
          ctx.setLineDash([width * 0.055, width * 0.022]);
          ctx.lineDashOffset = -time * (70 + lane * 5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Tall wave walls cross the entire viewport. Parallel echoes and animated
    // dashes make their direction legible even when the audio is restrained.
    const wallCount = chorus ? 5 : solo || phase === 7 ? 4 : 2;
    for (let wall = 0; wall < wallCount; wall++) {
      const travel = (time * (0.085 + wall * 0.009) + wall * 0.31) % 1.45 - 0.22;
      const frontX = travel * width;
      for (let echo = 4; echo >= 0; echo--) {
        ctx.beginPath();
        for (let point = 0; point <= 64; point++) {
          const progress = point / 64;
          const y = progress * horizon;
          const x = frontX - echo * width * 0.022
            + Math.sin(progress * Math.PI * 2.4 + time * 0.72 + wall) * width * (0.035 + energy * 0.045)
            + (progress - 0.5) * width * 0.11;
          point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba(wall % 2 ? palette.blue : palette.gold, (0.035 + energy * 0.095 + (solo ? 0.065 : 0) + (chorus ? 0.085 + beat.pulse * 0.055 : 0)) * (1 - echo / 5));
        ctx.lineWidth = echo === 0 ? 3.2 + energy * 5 : 1.1;
        if (echo === 0) {
          ctx.setLineDash([height * 0.08, height * 0.025]);
          ctx.lineDashOffset = time * 85;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    return { horizon, energy };
  }

  function drawWater(time, section, beat, horizon, energy) {
    const events = transferEvents(time, beat, section.phase);
    const chorus = isChorusSection(section);
    const solo = section.phase === 5 || section.phase === 6;
    const sea = ctx.createLinearGradient(0, horizon, 0, height);
    sea.addColorStop(0, '#061635');
    sea.addColorStop(0.48, '#020b1e');
    sea.addColorStop(1, '#01040c');
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, width, height - horizon);

    if (chorus) {
      const horizonLight = ctx.createLinearGradient(0, horizon, 0, height);
      horizonLight.addColorStop(0, rgba(palette.gold, 0.14 + beat.pulse * 0.22 + energy * 0.08));
      horizonLight.addColorStop(0.38, rgba(palette.cobalt, 0.055 + beat.pulse * 0.06));
      horizonLight.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = horizonLight;
      ctx.fillRect(0, horizon, width, height - horizon);
    }

    const refractedWalls = chorus ? 5 : solo || section.phase === 7 ? 4 : 2;
    for (let wall = 0; wall < refractedWalls; wall++) {
      const travel = (time * (0.085 + wall * 0.009) + wall * 0.31) % 1.45 - 0.22;
      const frontX = travel * width;
      for (let echo = 3; echo >= 0; echo--) {
        ctx.beginPath();
        for (let point = 0; point <= 42; point++) {
          const progress = point / 42;
          const y = horizon + progress * (height - horizon);
          const x = frontX - echo * width * 0.025
            + Math.sin(progress * Math.PI * 3.2 - time * 0.58 + wall) * width * (0.045 + energy * 0.055)
            + progress * width * 0.08;
          point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba(wall % 2 ? palette.cobalt : palette.gold, (0.03 + energy * 0.08 + (solo ? 0.045 : 0) + (chorus ? 0.075 + beat.pulse * 0.05 : 0)) * (1 - echo / 4));
        ctx.lineWidth = echo === 0 ? 2.4 + energy * 3.5 : 0.9;
        ctx.stroke();
      }
    }

    // Every sky front has a visible handoff: a curved descent reaches the
    // horizon, flashes at contact, and becomes the expanding water wake below.
    events.forEach((event, index) => {
      if (event.age > 3.2) return;
      const progress = event.age / 3.2;
      const life = Math.sin(progress * Math.PI);
      const startX = event.x + event.sign * width * (0.16 + hash(index * 8.4) * 0.12);
      const startY = height * (0.22 + hash(index * 4.8) * 0.18);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(
        mix(startX, event.x, 0.38), startY + height * 0.08,
        event.x + event.sign * width * 0.045, horizon - height * 0.08,
        event.x, horizon
      );
      ctx.strokeStyle = rgba(index % 3 ? palette.blue : palette.gold, life * (0.055 + energy * 0.12 + (solo ? 0.08 : 0)) * event.strength);
      ctx.lineWidth = 0.8 + life * (1.3 + smooth.bass * 2.4);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(event.x, horizon, width * (0.012 + progress * 0.025), 1.2 + life * 3.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(palette.gold, life * (0.1 + energy * 0.2) * event.strength);
      ctx.lineWidth = 1 + life * 1.5;
      ctx.stroke();
    });

    for (const event of events) {
      if (event.age > 1.4) continue;
      const alpha = (1 - event.age / 1.4) * (0.08 + energy * 0.18) * event.strength;
      const beam = ctx.createLinearGradient(0, horizon - height * 0.18, 0, horizon + height * 0.2);
      beam.addColorStop(0, 'rgba(0,0,0,0)');
      beam.addColorStop(0.48, rgba(palette.gold, alpha));
      beam.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(event.x - width * 0.018, horizon - height * 0.18, width * 0.036, height * 0.38);
    }

    const samples = 130;
    const bands = 8;
    for (let band = bands - 1; band >= 0; band--) {
      const depth = band / (bands - 1);
      const base = horizon + depth * (height - horizon) * 0.88;
      ctx.beginPath();
      for (let point = 0; point <= samples; point++) {
        const x = point / samples * width;
        const displacement = waterDisplacement(x, time - depth * 0.22, events, energy) * (1 + depth * 0.42);
        const y = base + displacement;
        point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = rgba(band % 3 === 0 ? palette.gold : palette.cobalt, 0.045 + (1 - depth) * 0.1 + energy * 0.1);
      ctx.lineWidth = 0.8 + (1 - depth) * 1.3;
      ctx.stroke();
    }

    ctx.beginPath();
    for (let point = 0; point <= samples; point++) {
      const x = point / samples * width;
      const y = horizon + waterDisplacement(x, time, events, energy);
      point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = rgba(palette.gold, 0.25 + energy * 0.28 + smooth.rise * 0.2);
    ctx.lineWidth = 1.25 + smooth.bass * 2.4;
    ctx.stroke();

    return events;
  }

  function limbPath(points, color, widthValue, alpha = 1) {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = widthValue;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
    ctx.stroke();
  }

  function drawNavigator(x, groundY, scale, time, pose, alpha = 1, reflection = false) {
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(scale, reflection ? -scale * 0.68 : scale);
    ctx.globalAlpha = alpha;

    const sway = Math.sin(time * 0.45 + pose * 1.7) * 0.9;
    const step = Math.sin(time * 0.7 + pose * 2.2) * 2.4;
    const dark = reflection ? '#081329' : '#050d22';
    const cloth = reflection ? '#0b1d3d' : '#07183b';
    const edge = reflection ? palette.cobalt : pose % 2 ? palette.blue : palette.gold;

    const hip = [sway, -42];
    const shoulder = [sway * 0.45, -84];
    const head = [sway * 0.2 + 2, -111];
    const leftKnee = [-9 - step, -22];
    const rightKnee = [10 + step, -21];
    const leftFoot = [-14 - step * 0.5, 0];
    const rightFoot = [15 + step * 0.4, 0];
    const armLift = pose % 3 === 0 ? -11 : pose % 3 === 1 ? 8 : 0;
    const leftElbow = [-20, -67 + armLift];
    const leftHand = [-30, -50 + armLift * 1.2];
    const rightElbow = [20, -66 - armLift * 0.4];
    const rightHand = [27, -45 - armLift * 0.7];

    limbPath([hip, leftKnee, leftFoot], dark, 9, 0.96);
    limbPath([hip, rightKnee, rightFoot], dark, 9, 0.96);
    limbPath([[shoulder[0] - 10, shoulder[1]], leftElbow, leftHand], dark, 7, 0.96);
    limbPath([[shoulder[0] + 10, shoulder[1]], rightElbow, rightHand], dark, 7, 0.96);

    ctx.fillStyle = rgba(cloth, 0.98);
    ctx.beginPath();
    ctx.moveTo(shoulder[0] - 13, shoulder[1]);
    ctx.quadraticCurveTo(shoulder[0] - 18, -62, hip[0] - 9, hip[1]);
    ctx.lineTo(hip[0] + 10, hip[1]);
    ctx.quadraticCurveTo(shoulder[0] + 17, -63, shoulder[0] + 13, shoulder[1]);
    ctx.quadraticCurveTo(shoulder[0], shoulder[1] - 7, shoulder[0] - 13, shoulder[1]);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(shoulder[0] - 9, shoulder[1] + 4);
    ctx.quadraticCurveTo(-31 - sway, -50, -22 + Math.sin(time * 0.36 + pose) * 8, -25);
    ctx.quadraticCurveTo(-4, -34, hip[0] - 7, hip[1]);
    ctx.closePath();
    ctx.fillStyle = rgba(cloth, 0.88);
    ctx.fill();

    ctx.fillStyle = rgba(dark, 1);
    ctx.beginPath();
    ctx.ellipse(head[0], head[1], 11, 14, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(head[0] - 8, head[1] - 8);
    ctx.quadraticCurveTo(head[0] - 21, head[1] + 3, head[0] - 14, head[1] + 22);
    ctx.quadraticCurveTo(head[0] - 4, head[1] + 13, head[0] + 8, head[1] + 7);
    ctx.closePath();
    ctx.fill();

    // A readable profile, collar, belt and coat seam keep the silhouette human
    // at both lead and witness scales without turning it into a cartoon icon.
    ctx.strokeStyle = rgba(edge, reflection ? 0.12 : 0.46);
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(head[0] - 4, head[1] - 8);
    ctx.quadraticCurveTo(head[0] - 10, head[1] - 4, head[0] - 9, head[1] + 1);
    ctx.quadraticCurveTo(head[0] - 5, head[1] + 7, head[0] + 2, head[1] + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shoulder[0] - 7, shoulder[1] + 2);
    ctx.lineTo(shoulder[0], shoulder[1] + 10);
    ctx.lineTo(shoulder[0] + 7, shoulder[1] + 2);
    ctx.moveTo(hip[0] - 8, hip[1] - 3);
    ctx.lineTo(hip[0] + 9, hip[1] - 3);
    ctx.moveTo(shoulder[0], shoulder[1] + 10);
    ctx.lineTo(hip[0], hip[1] - 3);
    ctx.stroke();

    limbPath([[shoulder[0] - 11, shoulder[1]], [shoulder[0] + 11, shoulder[1]]], edge, 1.2, reflection ? 0.2 : 0.54);
    limbPath([hip, leftKnee, leftFoot], edge, 1, reflection ? 0.12 : 0.24);
    limbPath([hip, rightKnee, rightFoot], edge, 1, reflection ? 0.12 : 0.24);

    ctx.restore();
  }

  function drawFigures(time, section, horizon, energy) {
    const witnesses = section.phase === 3 ? 5 : 3;
    for (let index = 0; index < witnesses; index++) {
      const perspective = 0.25 + index * 0.028;
      const x = width * (0.07 + index * 0.072);
      drawNavigator(x, horizon - 1, perspective, time * 0.3, index + 2, 0.24 + energy * 0.12);
    }
  }

  function drawCompassRose(time, section, beat, energy) {
    const phase = section.phase;
    const chorus = isChorusSection(section);
    const cx = width * 0.76;
    const cy = height * 0.31;
    const radius = Math.min(width, height) * (0.2 + energy * 0.025);
    const rotation = time * (phase === 2 ? -0.16 : 0.035);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    const roseGlow = ctx.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius * 1.3);
    roseGlow.addColorStop(0, rgba(palette.gold, 0.08 + beat.pulse * (chorus ? 0.22 : 0.08)));
    roseGlow.addColorStop(0.58, rgba(palette.cobalt, 0.045 + energy * 0.05 + (chorus ? 0.07 : 0)));
    roseGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = roseGlow;
    ctx.fillRect(-radius * 1.4, -radius * 1.4, radius * 2.8, radius * 2.8);

    [1, 0.76, 0.34].forEach((scale, index) => {
      ctx.beginPath();
      ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(index === 1 ? palette.blue : palette.gold, 0.16 + energy * 0.16 - index * 0.025);
      ctx.lineWidth = index === 0 ? 2.2 : 1;
      ctx.stroke();
    });
    for (let tick = 0; tick < 32; tick++) {
      const angle = tick / 32 * Math.PI * 2;
      const major = tick % 4 === 0;
      const inner = radius * (major ? 0.78 : 0.89);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.strokeStyle = rgba(major ? palette.gold : palette.blue, major ? 0.46 : 0.22);
      ctx.lineWidth = major ? 2 : 1;
      ctx.stroke();
    }

    const needleAngle = -Math.PI / 2 + Math.sin(time * 0.22) * (phase === 2 ? 1.15 : 0.08);
    ctx.rotate(needleAngle);
    ctx.fillStyle = rgba(phase === 2 ? palette.red : palette.gold, 0.68 + beat.pulse * 0.22);
    ctx.beginPath();
    ctx.moveTo(radius * 0.82, 0);
    ctx.lineTo(-radius * 0.18, radius * 0.075);
    ctx.lineTo(-radius * 0.05, 0);
    ctx.lineTo(-radius * 0.18, -radius * 0.075);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(palette.white, 0.42);
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawShip(time, section, beat, horizon, energy, events) {
    const phase = section.phase;
    const shipX = width * (0.69 + Math.sin(time * 0.045) * 0.025);
    const shipWidth = Math.min(width * 0.38, height * 0.58);
    const shipHeight = shipWidth * 0.44;
    const surface = waterDisplacement(shipX, time, events, energy);
    const bob = surface * 0.72 + Math.sin(time * 0.82) * height * (0.004 + energy * 0.006);
    const tilt = Math.sin(time * 0.62) * (0.018 + energy * 0.04) + smooth.rise * 0.035;
    const shipY = horizon - shipHeight * 0.015 + bob;
    const sailBillow = Math.sin(time * 0.9) * shipWidth * 0.018 + energy * shipWidth * 0.018;

    // The wake remains in world space so it visibly separates from the hull.
    for (let wake = 0; wake < 6; wake++) {
      const age = wake * 0.18;
      ctx.beginPath();
      ctx.moveTo(shipX - shipWidth * (0.42 + wake * 0.06), shipY + shipHeight * 0.08 + wake * 3);
      ctx.quadraticCurveTo(
        shipX - shipWidth * (0.16 + wake * 0.035),
        shipY + shipHeight * (0.14 + Math.sin(time * 1.2 - age) * 0.035),
        shipX + shipWidth * 0.46,
        shipY + shipHeight * (0.08 + wake * 0.012)
      );
      ctx.strokeStyle = rgba(wake % 2 ? palette.blue : palette.gold, (0.05 + energy * 0.12) * (1 - wake / 7));
      ctx.lineWidth = 1 + energy * 2.5;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(tilt);

    const hull = ctx.createLinearGradient(0, 0, 0, shipHeight * 0.22);
    hull.addColorStop(0, '#102b5e');
    hull.addColorStop(1, '#020817');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(-shipWidth * 0.5, 0);
    ctx.quadraticCurveTo(-shipWidth * 0.34, shipHeight * 0.23, shipWidth * 0.24, shipHeight * 0.2);
    ctx.quadraticCurveTo(shipWidth * 0.43, shipHeight * 0.16, shipWidth * 0.52, -shipHeight * 0.015);
    ctx.lineTo(shipWidth * 0.34, shipHeight * 0.055);
    ctx.lineTo(-shipWidth * 0.43, shipHeight * 0.055);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(palette.gold, 0.42 + energy * 0.25);
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.strokeStyle = rgba(palette.gold, 0.33);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-shipWidth * 0.44, shipHeight * 0.075);
    ctx.quadraticCurveTo(-shipWidth * 0.15, shipHeight * 0.16, shipWidth * 0.34, shipHeight * 0.11);
    ctx.stroke();

    const mastX = -shipWidth * 0.06;
    const mastTop = -shipHeight * 0.88;
    ctx.strokeStyle = rgba(palette.gold, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(mastX, shipHeight * 0.06); ctx.lineTo(mastX, mastTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mastX - shipWidth * 0.22, -shipHeight * 0.56); ctx.lineTo(mastX + shipWidth * 0.24, -shipHeight * 0.56); ctx.stroke();

    const sail = ctx.createLinearGradient(mastX, mastTop, mastX + shipWidth * 0.3, -shipHeight * 0.1);
    sail.addColorStop(0, rgba(palette.white, 0.78));
    sail.addColorStop(0.42, rgba(palette.blue, 0.55 + energy * 0.16));
    sail.addColorStop(1, rgba(palette.cobalt, 0.28));
    ctx.fillStyle = sail;
    ctx.beginPath();
    ctx.moveTo(mastX + 4, mastTop + shipHeight * 0.04);
    ctx.quadraticCurveTo(mastX + shipWidth * 0.28 + sailBillow, -shipHeight * 0.56, mastX + shipWidth * 0.22, -shipHeight * 0.12);
    ctx.quadraticCurveTo(mastX + shipWidth * 0.08, -shipHeight * 0.2, mastX + 4, -shipHeight * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(palette.gold, 0.32);
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = rgba(phase === 3 ? palette.red : palette.gold, 0.62 + beat.pulse * 0.2);
    ctx.beginPath();
    ctx.moveTo(mastX, mastTop);
    ctx.lineTo(mastX + shipWidth * 0.17, mastTop + shipHeight * 0.075);
    ctx.lineTo(mastX, mastTop + shipHeight * 0.14);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rgba(palette.blue, 0.36);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mastX, mastTop);
    ctx.lineTo(-shipWidth * 0.4, 0);
    ctx.moveTo(mastX, mastTop);
    ctx.lineTo(shipWidth * 0.4, 0);
    ctx.stroke();

    const navigatorScale = clamp(0.5, 0.92, shipWidth / 430 * 0.78);
    drawNavigator(shipWidth * 0.16, -shipHeight * 0.005, navigatorScale, time, phase, 0.96);
    ctx.restore();

    // A broad reflected hull grounds the ship in the animated mirror sea.
    ctx.save();
    ctx.globalAlpha = 0.08 + energy * 0.07;
    ctx.translate(shipX, horizon + (horizon - shipY) * 0.35 + shipHeight * 0.16);
    ctx.scale(1, -0.34);
    ctx.rotate(-tilt * 0.65);
    ctx.fillStyle = rgba(palette.cobalt, 0.55);
    ctx.beginPath();
    ctx.moveTo(-shipWidth * 0.5, 0);
    ctx.quadraticCurveTo(-shipWidth * 0.3, shipHeight * 0.22, shipWidth * 0.28, shipHeight * 0.18);
    ctx.quadraticCurveTo(shipWidth * 0.45, shipHeight * 0.14, shipWidth * 0.52, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCompassMotifs(time, section, beat, horizon, energy) {
    drawCompassRose(time, section, beat, energy);
    const phase = section.phase;
    const centerX = width * 0.72;
    const centerY = phase === 2 ? horizon + height * 0.13 : height * 0.41;
    if (phase === 2 || phase === 4) {
      const radius = Math.min(width, height) * (phase === 2 ? 0.075 : 0.11);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(phase === 2 ? time * 0.11 : Math.sin(time * 0.12) * 0.03);
      ctx.strokeStyle = rgba(phase === 2 ? palette.red : palette.gold, 0.28 + energy * 0.3);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(phase === 2 ? palette.red : palette.gold, 0.72 + beat.pulse * 0.18);
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.88);
      ctx.lineTo(radius * 0.1, radius * 0.14);
      ctx.lineTo(0, radius * 0.04);
      ctx.lineTo(-radius * 0.1, radius * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (phase === 5 || phase === 6) {
      const passes = phase === 6 ? 10 : 6;
      for (let index = 0; index < passes; index++) {
        const travel = (time * (0.12 + index * 0.003) + hash(index * 9.3)) % 1.35 - 0.15;
        const y = height * (0.12 + hash(index * 12.8) * 0.5);
        const x = travel * width;
        ctx.beginPath();
        ctx.moveTo(x - width * (0.06 + energy * 0.05), y + height * 0.02);
        ctx.lineTo(x, y);
        ctx.strokeStyle = rgba(index % 3 ? palette.blue : palette.gold, 0.07 + energy * 0.13);
        ctx.lineWidth = 1 + smooth.rise * 2.5;
        ctx.stroke();
      }
    }
  }

  function drawFrame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    if (previewMode && audio.paused) displayTime = previewTime;
    else if (!audio.paused && Number.isFinite(audio.currentTime)) displayTime = audio.currentTime;
    const section = currentSection(displayTime);
    const beat = beatAt(displayTime);
    analyze(dt, displayTime, section.phase);

    ctx.clearRect(0, 0, width, height);
    const { horizon, energy } = drawBackground(displayTime, section, beat);
    const events = drawWater(displayTime, section, beat, horizon, energy);
    drawCompassMotifs(displayTime, section, beat, horizon, energy);
    drawShip(displayTime, section, beat, horizon, energy, events);
    drawFigures(displayTime, section, horizon, energy);

    updateInterface(displayTime, section);
    requestAnimationFrame(drawFrame);
  }

  function renderWords(line, time) {
    lyricCurrent.textContent = '';
    if (!line) {
      lyricCurrent.textContent = currentSection(time).name;
      return;
    }
    const words = Array.isArray(line.words) && line.words.length
      ? line.words
      : line.text.split(/\s+/).map((word, index, all) => ({
          word,
          start: mix(line.start, line.end, index / all.length),
          end: mix(line.start, line.end, (index + 1) / all.length)
        }));
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
    const direct = data.lines.findIndex(line => time >= line.start - 0.12 && time <= line.end + 0.22);
    if (direct >= 0) return direct;
    return data.lines.findIndex(line => line.start > time && line.start - time < 1.15);
  }

  function updateLyrics(time) {
    const lineIndex = lineIndexAt(time);
    const line = lineIndex >= 0 ? data.lines[lineIndex] : null;
    if (lineIndex !== activeLineIndex) {
      activeLineIndex = lineIndex;
      lyricPrevious.textContent = lineIndex > 0 ? data.lines[lineIndex - 1].text : '';
      lyricNext.textContent = lineIndex >= 0 && lineIndex < data.lines.length - 1 ? data.lines[lineIndex + 1].text : '';
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
    const bearing = Math.round((360 + Math.sin(time * 0.12) * (section.phase === 2 ? 130 : 8)) % 360);
    bearingValue.textContent = String(bearing).padStart(3, '0');
    updateLyrics(time);
  }

  async function togglePlay() {
    initAudioGraph();
    if (audioContext.state === 'suspended') await audioContext.resume();
    if (audio.paused) {
      if (previewMode && Math.abs(audio.currentTime - previewTime) > 0.5) {
        audio.currentTime = previewTime;
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
    play.setAttribute('aria-label', 'Pause Compass');
  });
  audio.addEventListener('pause', () => {
    playIcon.textContent = '\u25b6';
    play.setAttribute('aria-label', 'Play Compass');
  });
  audio.addEventListener('ended', () => {
    displayTime = 0;
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

  function applySeekValue() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : data?.duration || 0;
    if (!duration) return;
    displayTime = Number(seek.value) / 1000 * duration;
    audio.currentTime = displayTime;
  }

  seek.addEventListener('pointerdown', () => {
    seekActive = true;
  });
  seek.addEventListener('focus', () => {
    seekActive = true;
  });
  seek.addEventListener('input', applySeekValue);
  seek.addEventListener('change', applySeekValue);
  seek.addEventListener('pointerup', () => {
    applySeekValue();
    setTimeout(() => { seekActive = false; }, 0);
  });
  seek.addEventListener('pointercancel', () => {
    seekActive = false;
  });
  seek.addEventListener('blur', () => {
    seekActive = false;
  });

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

  fetch('../../songs/lyrics/compass-rock.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`Lyrics request failed: ${response.status}`);
      return response.json();
    })
    .then(payload => {
      data = payload;
      durationEl.textContent = formatTime(payload.duration);
      updateInterface(displayTime, currentSection(displayTime));
    })
    .catch(error => {
      console.error(error);
      chapterDetail.textContent = 'Lyrics data unavailable';
    });

  requestAnimationFrame(drawFrame);
})();
