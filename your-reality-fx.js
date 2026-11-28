// Your Reality (Dan Salvato feat. Jillian Ashcraft) — "The Letter". A letter is written at
// a desk by a window while the song is sung. The pen writes one handwritten line for each
// sung line and one word for each sung word, and it lifts off the page when the voice rests.
// Held notes pool ink at the nib. A full page curls back into the light before the next one
// is begun. Afternoon light crosses the page and turns to dusk by the end, leaf shadows sway
// with the music, and the piano keys sound on the recording's measured onsets (the piano
// says more while the voice rests). After the last line the pen is put away and the letter
// is sealed. Every frame is a pure function of media time. Original imagery; the scene
// uses only word timings and word lengths, never the words themselves.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const set = typeof module === 'object' && module.exports ? require('./reality-set.js') : root.RealitySet;
  const api = factory(kit, set);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RealityLetterFx = api;
})(typeof window === 'object' ? window : globalThis, (kit, set) => {
  'use strict';

  const { TAU, clamp, mix, ease, easeOut, fract, hash, hash2, rgba, blend, linear, radial, sample, vignette } = kit;
  const INK = '#39404f', FRESH = '#18204f', PINK = '#ae4c70', WAX = '#952c4d';
  const ROWS = 3;            // handwritten lines per page
  const SECTION_GAP = 6;     // a rest this long ends a section, so the next one starts a new page
  const REST_GAP = 2.2;      // a rest this long sends the pen back to its resting place
  const DISSOLVE = 1.2;      // maximum duration of a sheet turn
  const SPACE = 1.5;         // word space, in letter widths
  const STILL_TIME = 27.2;   // reduced motion holds this one moment: two lines written, pen at rest
  // Light colour through the afternoon (fraction of the song → colour).
  const DAYLIGHT = [[0, '#fff3da'], [.5, '#ffe4b4'], [.76, '#ffcaa6'], [.9, '#f4b9b6'], [1, '#bcc6f2']];

  // MARK: timing plan (built once per timeline)

  const plans = new WeakMap();
  function plan(vocal) {
    let p = plans.get(vocal);
    if (p) return p;
    const lines = vocal.lines.map((line, index) => ({ ...line, index, words: [] }));
    // Sections split at long rests; each section is shared out evenly over pages of ROWS lines.
    const sections = [];
    lines.forEach((line, i) => {
      if (!i || line.start - lines[i - 1].end > SECTION_GAP) sections.push([]);
      sections[sections.length - 1].push(line);
    });
    const pages = [];
    for (const section of sections) {
      const count = Math.ceil(section.length / ROWS);
      for (let k = 0, at = 0; k < count; k++) {
        const size = Math.ceil((section.length - at) / (count - k));
        pages.push({ index: pages.length, lines: section.slice(at, at + size) });
        at += size;
      }
    }
    const words = [];
    let widest = 1;
    for (const page of pages) {
      page.lines.forEach((line, row) => {
        line.row = row; line.page = page;
        let x = 0;
        vocal.lines[line.index].words.forEach((source, i) => {
          const n = Math.max(1, Math.min(14, Math.round(source.n) || 1));
          const duration = source.end - source.start;
          // Steady handwriting: about 12 letters a second, never longer than the sung word.
          const write = Math.min(duration, Math.max(.16, n * .085));
          const word = { start: source.start, end: source.end, writeEnd: source.start + write,
            hold: duration - write, n, x, line, seed: hash2(line.index + 1, i + 1) * 1000, order: words.length };
          line.words.push(word); words.push(word);
          x += n + SPACE;
        });
        line.width = Math.max(0, x - SPACE);
        widest = Math.max(widest, line.width);
      });
      page.start = page.lines[0].words[0].start;
      page.end = page.lines[page.lines.length - 1].end;
    }
    pages.forEach((page, i) => {
      const next = pages[i + 1];
      page.clearStart = next ? Math.max(page.end + .3, next.start - DISSOLVE - .2) : Infinity;
      page.clearEnd = page.clearStart + DISSOLVE;
    });
    const last = words[words.length - 1];
    const lastSection = sections[sections.length - 1];
    // Leave room for the stamp when a cover holds its last word almost to the end.
    const goodbye = Number.isFinite(vocal.duration) ? Math.min(2.4, Math.max(0, vocal.duration - last.end) * .55) : 2.4;
    p = { lines, pages, words, widest, last, finale: lastSection[0].start, goodbye, sealAt: last.end + goodbye };
    plans.set(vocal, p);
    return p;
  }

  // Used only when the synchronized lyric file cannot be read: lines on the measured beat.
  const synthetic = new Map();
  function syntheticTimeline(duration, period, offset) {
    const key = `${duration}:${period}:${offset}`;
    let vocal = synthetic.get(key);
    if (!vocal) {
      const lines = [];
      for (let beat = Math.ceil((10 - offset) / period); offset + (beat + 16) * period < duration - 16; beat += 16) {
        const words = [];
        for (let i = 0; i < 7; i++) {
          const start = offset + (beat + i) * period;
          words.push({ start, end: start + period * .8, n: 2 + Math.floor(hash(beat + i * 7) * 6) });
        }
        lines.push({ start: words[0].start, end: words[6].end, words });
      }
      vocal = { lines, duration };
      synthetic.set(key, vocal);
    }
    return vocal;
  }

  function lastStarted(words, t) {
    let lo = 0, hi = words.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return found;
  }

  /** 1 inside a sung line, falling to 0 over 2.5 s away from one. */
  function voiceNear(P, t) {
    let gap = Infinity;
    for (const line of P.lines) {
      if (t >= line.start && t <= line.end) return 1;
      gap = Math.min(gap, Math.abs(t - (t < line.start ? line.start : line.end)));
    }
    return clamp(1 - gap / 2.5);
  }

  // MARK: handwriting

  function geometry(w, h, P) {
    const pw = w * (w<h ? .93 : .76), ph = h * .745;
    const width = pw * .5;
    // Writing sits on ruled lines below the lyrics: one line lower on tall (phone) stages.
    const first = h > w * 1.1 ? 10 : 9;
    return {
      pw, ph, unit: Math.min(pw / 510, ph / 350),
      left: pw * .16, base: [0, 1, 2].map(row => ph * (.13 + .059 * (first + row))),
      lw: Math.min(width / P.widest, ph * .028), xh: ph * .0185,
      rest: { x: pw * .735, y: ph * .745 },
    };
  }

  function letterKind(seed, k) {
    const r = hash2(seed, k + 1);
    return r < .4 ? 0 : r < .64 ? 3 : r < .84 ? 1 : 2; // small loop, tall loop, descender, arch
  }

  /** Point on a word's cursive line after `u` letters (paper coordinates). */
  function inkAt(word, u, g) {
    const k = Math.min(word.n - 1, Math.floor(u)), s = u - k;
    const kind = letterKind(word.seed, k);
    const size = .85 + hash2(word.seed, k + 40) * .25;
    let up, x;
    if (kind === 3) {
      up = Math.sin(Math.PI * s) * size;
      x = word.x + k + s;
    } else {
      up = (1 - Math.cos(TAU * s)) / 2 * (kind === 1 ? 2.05 : kind === 2 ? -1.45 : size);
      x = word.x + k + s - Math.sin(TAU * s) * (kind === 1 ? .22 : .32);
    }
    x += up * .26;
    return [g.left + x * g.lw, g.base[word.line.row] - up * g.xh];
  }

  function written(word, t) {
    if (t <= word.start) return 0;
    return word.n * clamp((t - word.start) / (word.writeEnd - word.start));
  }

  function strokeWord(c, word, u, g, color, width) {
    const steps = Math.max(1, Math.ceil(u * 6));
    c.beginPath();
    for (let i = 0; i <= steps; i++) {
      const [x, y] = inkAt(word, u * i / steps, g);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }

  /** Ink pooled at the nib while a note is held after its word is written. */
  function poolRadius(word, t, g) {
    if (word.hold < .3 || t <= word.writeEnd) return 0;
    return g.xh * (.22 + .5 * Math.sqrt(clamp((Math.min(t, word.end) - word.writeEnd) / 1.6)));
  }

  // A cylindrical fold advances from the fore-edge; a soft contact shadow leads it.
  function pageTurn(c,g,u) {
    if (!(u>0 && u<1)) return;
    const w=g.pw, h=g.ph, lift=Math.sin(Math.PI*u), x=w*(1-ease(u)), b=w*.13*lift;
    c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
    c.fillStyle=linear(c,x-b*.35,0,x+b,0,[[0,'rgba(62,43,30,0)'],[.36,rgba('#604837',.24*lift)],[1,'rgba(62,43,30,0)']]);
    c.fillRect(x-b*.35,0,b*1.35,h);
    c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+b*.7,h*.23,x-b*.45,h*.76,x+b*.22,h);
    c.lineTo(x+b*1.2,h);c.bezierCurveTo(x+b*.68,h*.72,x+b*1.25,h*.20,x+b*.9,-h*.018);c.closePath();
    c.fillStyle=linear(c,x-b*.16,0,x+b*1.2,0,[[0,'#c4b5a1'],[.22,'#e7d7bc'],[.60,'#fff7e5'],[.83,'#f8ecd4'],[1,'#bfad94']]);c.fill();c.restore();
  }

  function drawPage(c, page, t, g) {
    if (t < page.start - .01 || t >= page.clearEnd) return;
    const age = t >= page.clearStart ? (t - page.clearStart) / DISSOLVE : 0;
    const inkAlpha = 1 - ease(age / .35);
    const width = Math.max(1, 1.15 * g.unit);
    for (const line of page.lines) {
      for (const word of line.words) {
        if (t < word.start) break;
        if (inkAlpha > 0) {
          // Fresh ink is wet blue-black and dries to the letter's grey ink.
          const dry = ease((t - word.writeEnd) / 2.5);
          strokeWord(c, word, written(word, t), g, blend(FRESH, INK, dry, inkAlpha), width);
          const r = poolRadius(word, t, g);
          if (r > 0) {
            const [x, y] = inkAt(word, word.n, g);
            c.beginPath(); c.ellipse(x + r * .25, y + r * .35, r * 1.15, r, 0, 0, TAU);
            c.fillStyle = blend(FRESH, INK, dry, inkAlpha); c.fill();
            if (dry < 1) {
              c.beginPath(); c.ellipse(x, y + r * .05, r * .35, r * .22, -.4, 0, TAU);
              c.fillStyle = rgba('#ffffff', .45 * (1 - dry) * inkAlpha); c.fill();
            }
          }
        }
      }
    }
    pageTurn(c,g,age);
  }

  // MARK: pen

  /** Where the nib is: on the line while writing, hopping between words, away while the voice rests. */
  function penAt(P, t, g) {
    const words = P.words, rest = { ...g.rest, lift: 1, alpha: 1, writing: false };
    const startOf = word => ({ ...(([x, y]) => ({ x, y }))(inkAt(word, 0, g)), lift: 0, alpha: 1 });
    const glide = (a, b, u, lift) => ({ x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), lift, alpha: 1, writing: false });
    const i = lastStarted(words, t);
    if (i < 0) {
      const first = startOf(words[0]), back = ease((t - (words[0].start - .8)) / .8);
      return back > 0 ? glide(rest, first, back, 1 - back) : rest;
    }
    const word = words[i];
    if (t < word.writeEnd) {
      const [x, y] = inkAt(word, written(word, t), g);
      return { x, y, lift: 0, alpha: 1, writing: true };
    }
    const [ex, ey] = inkAt(word, word.n, g), end = { x: ex, y: ey };
    if (t < word.end) return { ...end, lift: 0, alpha: 1, writing: false };
    const next = words[i + 1];
    if (!next) {
      // The letter is finished: the pen is lifted and put away past the top right corner.
      const away = ease((t - word.end - P.goodbye * .25) / Math.max(.001, P.goodbye * .75));
      return { x: mix(ex, g.pw * 1.06, away), y: mix(ey, g.ph * .18, away), lift: Math.min(1, away * 3), alpha: 1 - away, writing: false };
    }
    const to = startOf(next), gap = next.start - word.end;
    if (gap <= REST_GAP) {
      const u = ease((t - word.end) / gap);
      return glide(end, to, u, Math.sin(Math.PI * u) * (next.line === word.line ? .35 : 1));
    }
    const back = ease((t - (next.start - .8)) / .8);
    if (back > 0) return glide(rest, to, back, 1 - back);
    const away = ease((t - word.end) / .8);
    return glide(end, rest, away, away);
  }

  function drawPen(c, pen, g, tap) {
    if (pen.alpha <= 0) return;
    c.save(); c.globalAlpha = pen.alpha;
    const raise = pen.lift * g.xh * 2.6 + tap * g.xh * .9;
    // The shadow stays on the paper and separates from the nib as the pen lifts.
    c.beginPath();
    c.ellipse(pen.x + pen.lift * g.xh * 1.7, pen.y + pen.lift * g.xh * .5, g.xh * (.9 + pen.lift * .7), g.xh * (.35 + pen.lift * .2), .5, 0, TAU);
    c.fillStyle = rgba('#3b2c33', .1 + .08 * pen.lift); c.fill();
    c.translate(pen.x, pen.y - raise); c.scale(g.unit, g.unit);
    c.rotate(.68 + pen.lift * .2 + (pen.writing ? Math.sin(pen.x * .31) * .04 : 0));
    c.save();c.translate(4+pen.lift*4,5+pen.lift*7);
    c.beginPath();c.moveTo(0,1);c.lineTo(-4,-16);c.lineTo(-5,-71);c.quadraticCurveTo(0,-79,5,-71);c.lineTo(4,-16);c.closePath();
    c.fillStyle=rgba('#3e3436',.17-pen.lift*.045);c.fill();c.restore();
    c.fillStyle = linear(c,-5,0,5,0,[[0,'#172425'],[.15,'#344347'],[.29,'#7c9291'],[.36,'#465958'],[.52,'#233438'],[.87,'#192c30'],[1,'#0c171d']]); c.beginPath();
    c.moveTo(-4, -16); c.lineTo(-5, -69); c.quadraticCurveTo(0, -79, 5, -69);
    c.lineTo(4, -16); c.closePath(); c.fill();
    c.fillStyle = 'rgba(242,255,243,.47)'; c.fillRect(-2.15, -66, .55, 43);
    const brass=linear(c,-4.7,0,4.7,0,[[0,'#775642'],[.22,'#cfae69'],[.38,'#fff1bc'],[.52,'#b69049'],[.83,'#c99d60'],[1,'#77503a']]);
    c.fillStyle = brass; c.fillRect(-4.5, -22, 9, 3);c.fillRect(-4.6,-66,9.2,1.4);c.fillRect(-4.1,-24.2,8.2,.75);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-4.5, -11); c.lineTo(-3, -16);
    c.lineTo(3, -16); c.lineTo(4.5, -11); c.closePath(); c.fillStyle = brass; c.fill();
    c.beginPath();c.moveTo(-3,-12);c.quadraticCurveTo(-1,-12,0,-9);c.quadraticCurveTo(1,-12,3,-12);
    c.strokeStyle='#6a4b36';c.lineWidth=.6;c.stroke();
    c.beginPath();c.arc(0,-8,.82,0,TAU);c.fillStyle='#20242b';c.fill();
    c.strokeStyle = INK; c.lineWidth = .7; c.beginPath();
    c.moveTo(0, -8); c.lineTo(0, 0); c.stroke();
    c.restore();
  }

  function drawSeal(c, P, t, g) {
    const age = t - P.sealAt;
    if (age < 0) return;
    const word = P.last, [, y] = inkAt(word, 0, g);
    const r = g.xh * 3, x = Math.min(g.pw * .7, g.left + (word.x + word.n + 2.4) * g.lw + r), cy = y - g.xh * .6;
    const stamp = easeOut(age / .45);
    // A ring of light spreads from the stamp as it lands.
    if (age < 1.6) {
      c.beginPath(); c.arc(x, cy, r * (1.1 + age * 1.6), 0, TAU);
      c.strokeStyle = rgba(PINK, .35 * (1 - age / 1.6)); c.lineWidth = Math.max(1, g.unit * 1.2); c.stroke();
    }
    c.save(); c.translate(x, cy); c.scale(mix(1.45, 1, stamp), mix(1.45, 1, stamp)); c.globalAlpha = stamp;
    c.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = i / 16 * TAU, rr = r * (1 + (hash(i % 16 + 3) - .5) * .16);
      if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(rr, 0);
    }
    c.fillStyle = radial(c,-r*.36,-r*.37,r*1.6,[[0,'#eca6aa'],[.25,'#b45169'],[.49,WAX],[.76,'#742841'],[.89,'#a94860'],[1,'#582032']]); c.fill();
    c.beginPath(); c.arc(0, 0, r * .72, 0, TAU); c.strokeStyle = '#71203a'; c.lineWidth = r * .09; c.stroke();
    // A pen nib pressed into the wax.
    c.beginPath(); c.moveTo(0, -r * .5); c.lineTo(r * .27, -r * .05); c.lineTo(r * .12, r * .42);
    c.lineTo(-r * .12, r * .42); c.lineTo(-r * .27, -r * .05); c.closePath(); c.fillStyle = '#c4627f'; c.fill();
    c.beginPath(); c.moveTo(0, -r * .48); c.lineTo(0, r * .05); c.strokeStyle = '#71203a'; c.lineWidth = r * .07; c.stroke();
    c.beginPath(); c.arc(-r * .3, -r * .38, r * .2, Math.PI * 1.1, Math.PI * 1.6);
    c.strokeStyle = 'rgba(255,220,226,.45)'; c.lineWidth = r * .08; c.stroke();
    c.restore();
  }

  // MARK: paper and light

  function daylight(day) {
    for (let i = 1; i < DAYLIGHT.length; i++) {
      const [at, color] = DAYLIGHT[i], [from, prev] = DAYLIGHT[i - 1];
      if (day <= at) return blend(prev, color, (day - from) / (at - from));
    }
    return DAYLIGHT[DAYLIGHT.length - 1][1];
  }

  function drawPaper(c, w, h, g, day, beat, t, P, still) {
    const { pw, ph, unit } = g;
    for(let i=4;i>0;i--){c.fillStyle='rgba(35,24,23,.105)';c.fillRect(unit*(3+i*1.3),unit*(3+i*1.8),pw,ph);}
    for(let i=3;i>0;i--){
      c.save(); c.rotate(-i*.0048);c.translate(-unit*i,unit*i*1.2);
      c.fillStyle=i%2?'#d9c7a9':'#efdfc2';c.fillRect(0,0,pw,ph);c.restore();
    }
    set.paper(c,pw,ph);
    c.beginPath();
    for (let i = 8; i < 14; i++) {
      const y = ph * (.13 + .059 * i);
      c.moveTo(pw*.105, y); c.lineTo(pw*.88, y);
    }
    c.strokeStyle = '#d1c6b6'; c.lineWidth = Math.max(.6, unit * .48); c.stroke();
    // Bookmark ribbon; its tail stirs on the beat.
    const flick = still ? 0 : Math.sin(beat * Math.PI) * .004;
    c.beginPath(); c.moveTo(pw * .79, 0); c.lineTo(pw * .86, 0);
    c.lineTo(pw * (.86 + flick), ph * .19); c.lineTo(pw * .825, ph * .15); c.lineTo(pw * (.79 + flick), ph * .19);
    c.closePath(); c.fillStyle = linear(c,pw*.79,0,pw*.86,0,[[0,'#873a50'],[.08,'#bf6e7c'],[.39,'#d797a2'],[.55,'#c47989'],[.93,'#96465d'],[1,'#d796a4']]); c.fill();
    c.beginPath();c.moveTo(pw*.795,0);c.lineTo(pw*(.795+flick),ph*.18);c.strokeStyle='#e2a9a9';c.lineWidth=unit*.7;c.stroke();
    // Pressed sprig; in the last chorus it lets go of a few petals.
    c.save(); c.translate(pw * .86, ph * .24); c.scale(unit, unit);
    c.rotate(-.25 + Math.sin(beat * Math.PI / 48) * .012);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(9, -7, 20, -29, 23, -51);
    c.strokeStyle = '#718373'; c.lineWidth = 1.35; c.stroke();
    for (let leaf = 0; leaf < 4; leaf++) {
      const x = 5 + leaf * 4.3, y = -6 - leaf * 8, side = leaf % 2 ? 1 : -1;
      c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + side * 12, y - 1, x + side * 13, y - 12);
      c.quadraticCurveTo(x + side * 5, y - 12, x, y); c.fillStyle = leaf % 2 ? '#98a393' : '#748c7f'; c.fill();
    }
    for (let j = 0; j < 5; j++) {
      const a = j * TAU / 5;
      c.beginPath(); c.ellipse(23 + 4 * Math.cos(a), -51 + 4 * Math.sin(a), 4.5, 2.6, a, 0, TAU);
      c.fillStyle = '#b97789'; c.fill();
    }
    c.beginPath(); c.arc(23, -51, 2.4, 0, TAU); c.fillStyle = '#d7ad65'; c.fill();
    if (!still) for (let i = 0; i < 6; i++) {
      const age = (t - (P.finale + i * 4.1)) / 7;
      if (age <= 0 || age >= 1) continue;
      const x = 23 - age * 150 + Math.sin(age * 7 + i) * 14, y = -51 + age * 205;
      c.save(); c.translate(x, y); c.rotate(age * 5 + i);
      c.beginPath(); c.ellipse(0, 0, 7, 3.6, 0, 0, TAU);
      c.fillStyle = rgba('#b97789', Math.min(1, age * 6) * (1 - ease((age - .75) / .25))); c.fill();
      c.restore();
    }
    c.restore();
    const fold = Math.min(pw, ph) * .05;
    c.beginPath(); c.moveTo(pw - fold, ph); c.lineTo(pw, ph - fold); c.lineTo(pw, ph); c.closePath();
    c.fillStyle = 'rgba(200,186,168,.64)'; c.fill();
    c.beginPath(); c.moveTo(pw - fold, ph); c.lineTo(pw, ph - fold); c.lineTo(pw - fold * .86, ph - fold * .79); c.closePath();
    c.fillStyle = 'rgba(255,252,241,.98)'; c.fill();
  }

  // Sprays of leaves outside the window: anchor in window coordinates and growing direction.
  const SPRAYS = [[.0, .04, .55], [.2, -.02, 1.25], [.62, .0, 2.1], [.02, .42, .15]];

  /** Leaf shadows as one shape, so overlapping leaves never darken twice. */
  function leafShadows(c, at, t, sway, still, size) {
    c.beginPath();
    SPRAYS.forEach(([bu, bv, heading], k) => {
      const bend = still ? 0 : (Math.sin(t * .55 + k * 1.7) * .07 + Math.sin(t * 1.4 + k) * .02) * sway;
      for (let j = 0; j < 10; j++) {
        const side = j % 2 ? 1 : -1, along = .035 + j * .03, dir = heading + bend * (1 + j * .12);
        const u = bu + Math.cos(dir) * along + Math.cos(dir + side * 1.3) * .018;
        const v = bv + Math.sin(dir) * along * 1.5 + Math.sin(dir + side * 1.3) * .03;
        const [x, y] = at(u, v);
        const a = dir + side * .85 + (still ? 0 : Math.sin(t * 2.1 + j * 1.3 + k) * .2 * sway);
        const len = size * (.75 + hash(k * 10 + j + 1) * .5), wide = len * .38;
        const ca = Math.cos(a), sa = Math.sin(a), nx = -sa * wide, ny = ca * wide;
        const x1 = x - ca * len / 2, y1 = y - sa * len / 2, x2 = x + ca * len / 2, y2 = y + sa * len / 2;
        c.moveTo(x1, y1); c.quadraticCurveTo(x + nx, y + ny, x2, y2); c.quadraticCurveTo(x - nx, y - ny, x1, y1); c.closePath();
      }
    });
    c.fill();
  }

  /**
   * Light from a four-pane window, moving across the desk as the afternoon goes by. The room
   * around it is in soft shade, so the window patch, its mullions and the leaf shadows read
   * clearly on white paper.
   */
  function windowLight(c, w, h, t, day, glow, sway, still) {
    const paneW = w * .16, paneH = h * .4, gap = w * .016;
    const ax = w * mix(.02, .4, day), ay = -h * .08, skew = mix(.38, .78, day);
    const at = (u, v) => [ax + u * (2 * paneW + gap) + v * (2 * paneH + gap) * skew, ay + v * (2 * paneH + gap)];
    const panes = grow => {
      for (const [col, row] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const x = ax + col * (paneW + gap) - grow, y = ay + row * (paneH + gap) - grow;
        const W = paneW + grow * 2, H = paneH + grow * 2, ox = (y - ay) * skew, dx = H * skew;
        c.moveTo(x + ox, y); c.lineTo(x + ox + W, y); c.lineTo(x + ox + W + dx, y + H); c.lineTo(x + ox + dx, y + H); c.closePath();
      }
    };
    const soft = w * .009;
    c.fillStyle=rgba('#6b565c',glow*.56);c.fillRect(0,0,w,h);
    if(!set.sunPane(c,ax,ay,paneW*2+gap,paneH*2+gap,skew,glow*1.17)){
      c.beginPath();panes(0);c.fillStyle=rgba(daylight(day),glow*.95);c.fill();
    }
    c.save(); c.beginPath(); panes(soft); c.clip();
    c.fillStyle = rgba('#4d504c', glow * .40);
    leafShadows(c, at, t, sway, still, Math.min(w, h) * .055);
    // Dust drifting through the beam.
    if (!still) for (let i = 0; i < 22; i++) {
      const u = fract(hash(i + 51) + t * .004 * (1 + hash(i + 61))), v = fract(hash(i + 71) - t * .011 * (.5 + hash(i + 81)));
      const [x, y] = at(u, v), r = (1 + 1.6 * hash(i + 91)) * Math.min(w, h) / 700;
      c.beginPath(); c.arc(x + Math.sin(t * .8 + i) * w * .006, y, r, 0, TAU);
      c.fillStyle = rgba('#fffdf6', (.45 + .35 * Math.sin(t * 1.3 + i * 2.1)) * Math.min(1, glow * 4)); c.fill();
    }
    c.restore();
  }

  // MARK: piano

  function peak(data, key, t0, t1) {
    let best = 0;
    for (let t = t0; t <= t1 + 1e-9; t += .04) best = Math.max(best, sample(data, key, t));
    return best;
  }

  function keyFor(slot) {
    const bar = Math.floor(slot / 8);
    return Math.max(0, Math.min(13, Math.round(6.5 + 4.6 * Math.sin(slot * .85 + bar * 2.3) + (hash(slot * .37) - .5) * 2.4)));
  }

  /** Notes struck on the recording's onsets in the last two seconds (eighth-note grid). */
  function keyEvents(m, P, t) {
    const data = m.data, events = [];
    if (!data || m.reducedMotion) return events;
    const half = m.period / 2, offset = data.beatOffset ?? 0, now = Math.floor((t - offset) / half);
    for (let slot = now - 8; slot <= now; slot++) {
      const at = offset + slot * half, age = t - at;
      if (at < 0 || age < 0 || age > 1.9) continue;
      const voiced = voiceNear(P, at) > .5;
      const strength = peak(data, 'onset', at - .04, at + .08);
      if (strength >= (voiced ? .62 : .4)) events.push({ slot, key: keyFor(slot), age, strength, voiced });
    }
    return events;
  }

  function drawKeyboard(c, w, h, events) {
    const key = Math.min(w * .044, h * .058), kh = key * 2.35;
    const pressed = new Array(14).fill(0);
    for (const e of events) if (e.age < .3) pressed[e.key] = Math.max(pressed[e.key], (1 - e.age / .3) * e.strength);
    c.save(); c.translate(w * .035, h + 2); c.rotate(-.038);
    c.fillStyle = linear(c,0,-kh-key*.28,0,-kh,[[0,'#9e7650'],[.28,'#493835'],[.65,'#714539'],[1,'#262328']]); c.fillRect(-3,-kh-key*.28,key*14+6,kh+key*1.3);
    const ivory=linear(c,0,-kh,0,key*.32,[[0,'#aca195'],[.1,'#d5c9b4'],[.36,'#f3ead4'],[.88,'#faf4df'],[1,'#c5b89d']]);
    const ebony=linear(c,0,-kh,0,-kh*.4,[[0,'#242629'],[.64,'#35363b'],[.79,'#49464a'],[.95,'#27252a'],[1,'#13161c']]);
    for (let k = 0; k < 14; k++) {
      const down = pressed[k];
      c.fillStyle = ivory; c.fillRect(k*key+1,-kh+down*key*.15,key-1,kh+key);
      if(down){c.fillStyle=rgba('#846e65',down*.43);c.fillRect(k*key+1,-kh+down*key*.15,key-1,kh+key);}
    }
    for (let k = 0; k < 13; k++) if (k % 7 !== 2 && k % 7 !== 6) {
      const x=(k+.73)*key;
      c.fillStyle='rgba(40,30,34,.32)';c.fillRect(x+key*.1,-kh+key*.13,key*.6,kh*.57);
      c.fillStyle=ebony;c.fillRect(x,-kh,key*.55,kh*.57);
      c.fillStyle='#716765';c.fillRect(x+key*.05,-kh+1,Math.max(1,key*.04),kh*.50);
    }
    c.fillStyle='#803f4a';c.fillRect(0,-kh-key*.045,key*14,key*.077);
    c.restore();
  }

  // The sampled vocals have a physical source on the desk. The tape keeps running
  // through the instrumental, but both reels stop exactly where playback is paused.
  function drawTape(c,w,h,b,energy,minor) {
    const s=Math.min(w*.00205,h*.0023), accent=minor?'#a9c9c2':'#f4af9c';
    c.save();c.translate(w*(w<h?.235:.145),h*.935);c.rotate(-.06);c.scale(s,s);
    c.fillStyle='rgba(30,24,29,.36)';c.fillRect(-69,-28,147,65);
    c.fillStyle=linear(c,-70,-27,72,33,[[0,'#827e72'],[.04,'#c0b9a5'],[.13,'#454c4b'],[.86,'#293335'],[.97,'#7c8177'],[1,'#252828']]);c.fillRect(-72,-33,146,65);
    c.fillStyle='#171f22';c.fillRect(-65,-27,132,51);
    c.fillStyle=linear(c,0,-25,0,22,[[0,'#414a49'],[.3,'#242e30'],[1,'#101b20']]);c.fillRect(-63,-25,91,44);
    c.beginPath();c.moveTo(-44,6);c.lineTo(-44,12);c.lineTo(9,12);c.lineTo(10,6);c.strokeStyle='#ac7e5c';c.lineWidth=1.2;c.stroke();
    for(const [x,r,rate] of [[-43,13,1],[8,12,1.12]]){
      c.save();c.translate(x,-4);c.beginPath();c.arc(0,0,r+2,0,TAU);c.fillStyle='#12191b';c.fill();
      c.beginPath();c.arc(0,0,r,0,TAU);c.fillStyle=linear(c,-r,-r,r,r,[[0,'#dcd6c2'],[.3,'#8e9a96'],[.54,'#c4cbbd'],[1,'#5a6462']]);c.fill();
      c.rotate(b*.38*rate);
      for(let k=0;k<3;k++){c.rotate(TAU/3);c.beginPath();c.ellipse(0,-r*.59,r*.28,r*.21,0,0,TAU);c.fillStyle='#273133';c.fill();}
      c.beginPath();c.arc(0,0,r*.19,0,TAU);c.fillStyle='#716653';c.fill();c.restore();
    }
    c.fillStyle='#e1d2ab';c.fillRect(34,-18,28,21);
    c.beginPath();c.arc(48,3,15,Math.PI*1.19,Math.PI*1.81);c.strokeStyle='#9c795c';c.lineWidth=1.3;c.stroke();
    c.beginPath();c.moveTo(48,2);const a=-2.49+1.77*clamp(energy);
    c.lineTo(48+14*Math.cos(a),2+14*Math.sin(a));c.strokeStyle='#703c36';c.lineWidth=1.2;c.stroke();
    for(let k=0;k<4;k++){c.fillStyle=k===1?accent:'#a09e8e';c.fillRect(32+k*8,10,5,5);}
    c.restore();
  }

  // MARK: frame

  function draw(c, w, h, m) {
    const still = !!m.reducedMotion;
    const t = still ? STILL_TIME : Math.max(0, m.time);
    const duration = m.duration || 181.7;
    const vocal = m.vocal?.lines?.length ? m.vocal : syntheticTimeline(duration, m.period || .5714, m.data?.beatOffset ?? .321);
    const P = plan(vocal), g = geometry(w, h, P);
    const day = still ? .3 : clamp(t / duration);
    const lift = still ? 0 : m.lift || 0, pulse = still ? 0 : m.pulse || 0, beats = still ? 12 : m.beats || 0;
    const voice = voiceNear(P, t);

    set.desk(c,w,h);
    const minor=m.variant==='your-reality-kamex', electronic=minor||m.variant==='your-reality-cement-city'||m.variant==='your-reality-ink-static';
    c.fillStyle=rgba(minor?'#263455':'#413456',minor?.32:.19*ease((day-.58)/.42));c.fillRect(0,0,w,h);

    const tilt=-.038+(still?0:Math.sin(t*.045)*.003), cy=h*(w<h?.585:.557);
    c.save(); c.translate(w * .525, cy); c.rotate(tilt); c.translate(-g.pw / 2, -g.ph / 2);
    drawPaper(c, w, h, g, day, beats, t, P, still);
    for (const page of P.pages) drawPage(c, page, t, g);
    drawSeal(c, P, still ? -1 : t, g);
    c.restore();

    // The window light: dim at the start, brighter in the choruses and while the piano plays alone.
    const glow = (.19 + .09 * lift + .025 * pulse + .06 * (1 - voice)) * ease(.52 + t / 5) * (1 - .5 * ease((day - .88) / .12));
    windowLight(c, w, h, t, day, glow, .6 + lift * .9, still);

    c.save(); c.translate(w * .525, cy); c.rotate(tilt); c.translate(-g.pw / 2, -g.ph / 2);
    const pen = penAt(P, t, g);
    // At rest during a long instrumental, the pen taps along with the beat.
    drawPen(c, pen, g, pen.lift > .9 && voice < .5 ? pulse : 0);
    c.restore();

    set.inkwell(c,w,h);
    if (electronic) drawTape(c,w,h,beats,still?.35:m.energy||0,minor);
    else drawKeyboard(c, w, h, keyEvents(m, P, t));
    c.fillStyle=linear(c,0,0,0,h*.25,[[0,'rgba(48,34,31,.33)'],[.46,'rgba(48,34,31,.20)'],[1,'rgba(48,34,31,0)']]);
    c.fillRect(0,0,w,h*.25);
    vignette(c, w, h, '#3b3d68', .06 + .22 * ease((day - .8) / .2));
  }

  /** Inked letters on the visible page at time t (for tests and tooling). */
  function inkAmount(vocal, t) {
    const P = plan(vocal);
    let total = 0;
    for (const page of P.pages) {
      if (t < page.start - .01 || t >= page.clearStart) continue;
      for (const line of page.lines) for (const word of line.words) total += written(word, t);
    }
    return total;
  }

  return Object.freeze({ draw, plan, inkAmount, penAt: (vocal, t, w = 1280, h = 720) => penAt(plan(vocal), t, geometry(w, h, plan(vocal))) });
});
