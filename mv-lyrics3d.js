// Shared 3D lyric lettering for VP's music videos (drawn with mv3d.js). Timed lyric lines
// become extruded 3D type laid out in ems, the sung line in big type with romaji above and
// a translation below. Every character flies in with its line, pops and lights up as it
// is sung (from the measured word timing) and leaves in a style of its own. Everything is
// a pure function of time, so pause, seek and replay show the same lettering. Used by
// encore-dance-mv.js and mesmerizer-mv.js.
((root, factory) => {
  const kit = root.Mv3d || (typeof require === 'function' ? require('./mv3d.js') : null);
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MvLyrics3d = api;
})(typeof window === 'object' ? window : globalThis, (K) => {
  'use strict';

  const { v3, chain, T, S, RX, RY, RZ, apply } = K;
  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = x => { const a = clamp(x); return a * a * (3 - 2 * a); };
  const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
  const easeIn = x => Math.pow(clamp(x), 3);
  const easeOutBack = x => { const a = clamp(x) - 1; return 1 + 2.7 * a * a * a + 1.7 * a * a; };
  const fract = x => x - Math.floor(x);
  const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  // A glyph turns and scales about a point this far (in ems) above its baseline.
  const PIVOT = .36;
  const WIDE_CHAR = /[⺀-鿿豈-﫿＀-￯　-〿]/;

  /** Rough letter widths in ems, used before a font is available (and by the tests). */
  function approxAdvance(ch) {
    if (/\s/.test(ch)) return .3;
    if (WIDE_CHAR.test(ch)) return 1;
    if (/[mwMW@]/.test(ch)) return .86;
    if (/[il.,:;'!|]/.test(ch)) return .3;
    if (/[A-Z]/.test(ch)) return .68;
    return .56;
  }

  /** Per-character sung times, from the measured word timings of a line. */
  function charTimings(text, words, start, end) {
    const chars = Array.from(String(text || ''));
    const lower = chars.map(c => c.toLowerCase());
    const timing = new Array(chars.length).fill(null);
    let cursor = 0;
    for (const w of words || []) {
      const token = Array.from(String(w.word || '').toLowerCase());
      if (!token.length || !Number.isFinite(w.start)) continue;
      let found = -1;
      for (let i = cursor; i <= chars.length - token.length && found < 0; i++) {
        if (token.every((c, k) => lower[i + k] === c)) found = i;
      }
      if (found < 0) continue;
      const span = Math.max(0, (Number.isFinite(w.end) ? w.end : w.start) - w.start);
      token.forEach((c, k) => { timing[found + k] = [w.start + span * k / token.length, w.start + span * (k + 1) / token.length]; });
      cursor = found + token.length;
    }
    let last = null;
    for (let i = 0; i < chars.length; i++) {
      if (timing[i]) { last = timing[i]; continue; }
      let next = null;
      for (let j = i + 1; j < chars.length && !next; j++) next = timing[j];
      const t0 = last ? last[1] : next ? next[0] : start + (end - start) * i / Math.max(1, chars.length);
      timing[i] = [t0, t0];
    }
    return chars.map((ch, i) => ({ ch, t0: timing[i][0], t1: timing[i][1] }));
  }

  function lineStyle(line, k, tl) {
    const section = tl.sections.find(s => line.start >= s.start - .05 && line.start < s.end) || {};
    const chorus = !!section.chorus;
    const pick = (list, salt) => list[Math.floor(hash(k * 7.13 + salt) * list.length)];
    return {
      chorus,
      layout: pick(chorus ? ['flat', 'arc', 'tilt', 'flat'] : ['flat', 'wave', 'arc', 'tilt'], 1),
      entry: pick(chorus ? ['zoom', 'drop', 'spin'] : ['rise', 'spin', 'zoom', 'drop'], 2),
      exit: pick(['blow', 'scatter', 'sink'], 3),
      dir: hash(k * 3.7 + 4) > .5 ? 1 : -1,
    };
  }

  /** Lines in the video's clock, with sung times per character and a style each. */
  function lyricModel(lyrics, tl) {
    const lines = Array.isArray(lyrics?.lines) ? lyrics.lines : [];
    const offset = Number.isFinite(lyrics?.offset) ? lyrics.offset : 0;
    const latin = lyrics?.language === 'en';
    const model = lines
      .filter(line => line && line.text && Number.isFinite(line.start) && Number.isFinite(line.end) && line.end > line.start)
      .map(line => {
        const start = line.start - offset, end = line.end - offset;
        const words = (line.words || []).map(w => ({ word: w.word, start: w.start - offset, end: w.end - offset }));
        return { start, end, latin, text: line.text, main: charTimings(line.text, words, start, end),
          romaji: latin ? '' : (line.romaji || []).join('   '), trans: latin ? '' : (line.en || []).join(' ') };
      })
      .sort((a, b) => a.start - b.start);
    model.forEach((line, k) => {
      const next = model[k + 1];
      line.index = k;
      // A line flies in just before it is sung and leaves as the next one arrives.
      line.enterAt = line.start - .42;
      line.exitAt = Math.max(line.start + .3, next ? Math.min(next.start - .14, line.end + 1.2) : line.end + 1.4);
      line.style = lineStyle(line, k, tl);
    });
    return model;
  }

  /** Lays a line out in ems: the sung line in big type, romaji above, the translation below. */
  function layoutLine(line, adv, maxW) {
    const base = line.latin ? .62 : .8;
    const units = [];
    let unit = [];
    for (const c of line.main) {
      if (/\s/.test(c.ch)) { if (unit.length) units.push(unit); unit = []; } else unit.push(c);
    }
    if (unit.length) units.push(unit);
    const gap = line.latin ? .3 : .55;
    const unitW = u => u.reduce((sum, c) => sum + adv(c.ch), 0);
    const rowW = row => row.reduce((sum, u, k) => sum + unitW(u) + (k ? gap : 0), 0);
    let rows;
    if (line.latin) {
      rows = [];
      let row = [];
      for (const u of units) {
        if (row.length && rowW([...row, u]) * base > maxW) { rows.push(row); row = []; }
        row.push(u);
      }
      if (row.length) rows.push(row);
    } else if (rowW(units) * base > maxW && units.length > 1) {
      let best = 1, bestDiff = Infinity;
      for (let k = 1; k < units.length; k++) {
        const diff = Math.abs(rowW(units.slice(0, k)) - rowW(units.slice(k)));
        if (diff < bestDiff) { bestDiff = diff; best = k; }
      }
      rows = [units.slice(0, best), units.slice(best)];
    } else rows = [units];
    const widest = Math.max(1e-3, ...rows.map(rowW));
    const size = Math.min(base, maxW / widest);
    const lead = size * 1.24, glyphs = [];
    let order = 0, width = widest * size;
    rows.forEach((row, r) => {
      let x = -rowW(row) * size / 2;
      row.forEach((u, k) => {
        if (k) x += gap * size;
        for (const c of u) {
          const a = adv(c.ch) * size;
          glyphs.push({ ch: c.ch, x: x + a / 2, y: -r * lead, size, role: 'main', t0: c.t0, t1: c.t1, order: order++ });
          x += a;
        }
      });
    });
    let top = size * .92, bottom = -(rows.length - 1) * lead - size * .24;
    if (line.romaji) {
      const chars = Array.from(line.romaji), n = chars.length;
      const total = chars.reduce((sum, ch) => sum + adv(ch), 0);
      const rs = Math.min(.27, maxW * 1.05 / Math.max(1e-3, total));
      const y = top + rs * .5;
      let x = -total * rs / 2;
      chars.forEach((ch, k) => {
        const a = adv(ch) * rs, span = (line.end - line.start) * .92;
        if (!/\s/.test(ch)) glyphs.push({ ch, x: x + a / 2, y, size: rs, role: 'romaji', t0: line.start + span * k / n, t1: line.start + span * (k + 1) / n, order: order++ });
        x += a;
      });
      width = Math.max(width, total * rs);
      top = y + rs * .95;
    }
    if (line.trans) {
      const ts = .34, space = adv(' ');
      const wordW = w => Array.from(w).reduce((sum, ch) => sum + adv(ch), 0);
      const lineW = r => r.reduce((sum, w, k) => sum + wordW(w) + (k ? space : 0), 0) * ts;
      const tRows = [];
      let row = [];
      for (const w of line.trans.split(/\s+/).filter(Boolean)) {
        if (row.length && lineW([...row, w]) > maxW * 1.05) { tRows.push(row); row = []; }
        row.push(w);
      }
      if (row.length) tRows.push(row);
      tRows.forEach((r, ri) => {
        let x = -lineW(r) / 2;
        const y = bottom - ts * 1.05 - ri * ts * 1.3;
        r.forEach((w, k) => {
          if (k) x += space * ts;
          for (const ch of Array.from(w)) {
            const a = adv(ch) * ts;
            glyphs.push({ ch, x: x + a / 2, y, size: ts, role: 'trans', t0: Infinity, t1: Infinity, order: order++ });
            x += a;
          }
        });
        width = Math.max(width, lineW(r));
      });
      bottom -= ts * 1.05 + (tRows.length - 1) * ts * 1.3 + ts * .3;
    }
    const center = (top + bottom) / 2;
    for (const g of glyphs) g.y -= center;
    return { glyphs, width, height: top - bottom };
  }

  function placeGlyph(g, layout, t, reduce) {
    if (layout === 'arc') {
      const R = 8.5, a = g.x / R;
      return { p: [R * Math.sin(a), g.y, R - R * Math.cos(a)], ry: -a };
    }
    if (layout === 'wave' && !reduce) {
      return { p: [g.x, g.y + Math.sin(g.x * .75 - t * 2.2) * .09, Math.sin(g.x * .45 + t * 1.2) * .14], ry: 0 };
    }
    return { p: [g.x, g.y, 0], ry: 0 };
  }

  /** One character at time t: its world matrix, opacity and whether it has been sung. */
  function glyphInstance(g, line, block, t, reduce, pulse) {
    const st = line.style, main = g.role === 'main';
    const enterAt = line.enterAt + (main ? g.order * .028 : .14 + g.order * .006);
    const inU = clamp((t - enterAt) / .45);
    const outU = clamp((t - line.exitAt - (main ? g.order * .012 : 0)) / .42);
    if (inU <= 0 || outU >= 1) return null;
    const place = placeGlyph(g, st.layout, t, reduce);
    let [x, y, z] = place.p;
    let rx = 0, ry = place.ry, rz = 0, scale = 1, alpha;
    if (reduce) alpha = ease(inU) * (1 - ease(outU));
    else {
      const k = 1 - easeOut(inU), d = st.dir;
      if (st.entry === 'rise') { y -= k * 1.6; rx += k * 1.7; }
      else if (st.entry === 'zoom') { z -= k * 6; scale *= Math.max(.05, easeOutBack(inU)); }
      else if (st.entry === 'spin') { ry += k * Math.PI * d; scale *= Math.max(.05, easeOutBack(inU)); }
      else { y += k * 2.4; rz += k * .6 * d; }
      alpha = clamp(inU * 2.5);
      if (outU > 0) {
        const o = easeIn(outU), h1 = hash(g.order * 1.7 + line.index), h2 = hash(g.order * 2.3 + line.index + 5);
        if (st.exit === 'blow') { z += o * 5; ry += o * 1.4 * d; x += (h1 - .5) * o * 1.5; }
        else if (st.exit === 'scatter') { x += (h1 - .5) * 5 * o; y += (h2 - .3) * 3.5 * o; rz += (h1 - .5) * 5 * o; scale *= 1 + o * .5; }
        else { y -= o * 2.6; rx -= o * 1.4; }
        alpha *= 1 - outU;
      }
      const age = t - g.t0;
      const pop = main && age >= 0 ? Math.exp(-age * 7) : 0;
      scale *= 1 + .34 * pop + .025 * pulse * (st.chorus ? 1 : .4);
      y += .17 * g.size * pop;
      rz += .13 * pop * (g.order % 2 ? 1 : -1);
      y += Math.sin(t * 2.3 + g.order * .5) * .03 * g.size;
      rz += Math.sin(t * 1.6 + g.order * 1.3) * .025;
    }
    const pivot = PIVOT * g.size;
    const m = chain(block, T(x, y + pivot, z), RY(ry), RX(rx), RZ(rz), S(scale), T(0, -pivot, 0));
    return { ch: g.ch, m, size: g.size, role: g.role, alpha: clamp(alpha), order: g.order, line: line.index,
      sung: g.role !== 'trans' && t >= g.t0, singing: main && t >= g.t0 && t < Math.max(g.t1, g.t0 + .18), age: t - g.t0 };
  }

  /** A batch of point sprites (9 floats each) for the renderer's points(). */
  function batch(capacity) {
    const data = new Float32Array(capacity * 9);
    let count = 0;
    return {
      data, get count() { return count; }, reset() { count = 0; },
      push(p, c, a, size, rot = 0) {
        if (count >= capacity || !(a > .002)) return;
        const o = count * 9;
        data[o] = p[0]; data[o + 1] = p[1]; data[o + 2] = p[2];
        data[o + 3] = c[0]; data[o + 4] = c[1]; data[o + 5] = c[2]; data[o + 6] = a;
        data[o + 7] = size; data[o + 8] = rot;
        count++;
      },
    };
  }

  // The lettering font: bold, very legible, with Japanese fallbacks.
  const LYRIC_FONT = '800 {px}px "Atkinson Hyperlegible Next", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Noto Sans JP", system-ui, sans-serif';
  // The ink drawn round every glyph face.
  const TEXT_INK = [.07, .015, .05];

  /** Creates the extruded-lettering pass for a renderer: draw(instances, eye, colorsOf) draws
   *  layers of each glyph's outline shape behind it in its side colour, then its face.
   *  `styles` gives each role's extrusion { layers, depth } (ems); colorsOf(inst) returns
   *  { top, bottom, near, far } colours. Quads are sorted back to front. */
  function createLettering(r, styles, maxQuads = 6000) {
    const TEXT_FLOATS = 14, MAX_QUADS = maxQuads;
    const textData = new Float32Array(MAX_QUADS * 4 * TEXT_FLOATS);
    // `overlay` draws over the whole scene (for lettering that rides in front of the camera).
    return function drawLettering(instances, eye, colorsOf, overlay = false) {
      if (!instances.length) return;
      const items = instances.map(inst => ({ inst, d: v3.dist(eye, apply(inst.m, [0, PIVOT * inst.size, 0])) }));
      items.sort((a, b) => b.d - a.d);
      let q = 0;
      const put = (corners, g, top, bottom, edge, edgeOnly, alpha) => {
        if (q >= MAX_QUADS) return;
        const uv = [[g.u0, g.v0], [g.u1, g.v0], [g.u1, g.v1], [g.u0, g.v1]];
        for (let k = 0; k < 4; k++) {
          const o = (q * 4 + k) * TEXT_FLOATS, p = corners[k], fill = k < 2 ? top : bottom;
          textData[o] = p[0]; textData[o + 1] = p[1]; textData[o + 2] = p[2];
          textData[o + 3] = uv[k][0]; textData[o + 4] = uv[k][1];
          textData[o + 5] = fill[0]; textData[o + 6] = fill[1]; textData[o + 7] = fill[2]; textData[o + 8] = alpha;
          textData[o + 9] = edge[0]; textData[o + 10] = edge[1]; textData[o + 11] = edge[2]; textData[o + 12] = edgeOnly ? 1 : 0;
          textData[o + 13] = 0;
        }
        q++;
      };
      for (const { inst } of items) {
        if (!(inst.alpha > .004)) continue;
        const g = r.glyph(inst.ch), s = inst.size, style = styles[inst.role] || styles.main;
        const corners = [[-g.half * s, g.top * s, 0], [g.half * s, g.top * s, 0], [g.half * s, g.bottom * s, 0], [-g.half * s, g.bottom * s, 0]]
          .map(p => apply(inst.m, p));
        const backDir = K.applyDir(inst.m, [0, 0, -1]);
        const step = style.depth * s / style.layers;
        const colors = colorsOf(inst);
        for (let k = style.layers; k >= 1; k--) {
          const off = v3.scale(backDir, step * k), side = mixc(colors.near, colors.far, k / style.layers);
          put(corners.map(c => v3.add(c, off)), g, side, side, side, true, inst.alpha);
        }
        put(corners, g, colors.top, colors.bottom, TEXT_INK, false, inst.alpha);
      }
      r.text(textData, q, overlay);
    };
  }

  return Object.freeze({ PIVOT, LYRIC_FONT, TEXT_INK, approxAdvance, charTimings, lineStyle, lyricModel, layoutLine, placeGlyph,
    glyphInstance, batch, createLettering });
});
