// VP 3D kit: a small WebGL2 renderer for the 3D music-video theatres.
// It draws cel-shaded meshes with ink outlines, soft volumetric light beams,
// point sprites (glows, sparkles, confetti, petals), extruded 3D lettering
// drawn from a glyph texture, a procedural sky, a
// mirrored stage floor, and an anime-style finishing pass: bloom, speed lines,
// flashes, impact frames and letterbox bars.
// The kit keeps GPU buffers only. Scenes describe every frame from media time,
// so pausing, seeking and replaying always reproduce the same picture.
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Mv3d = api;
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';

  const TAU = Math.PI * 2;

  // MARK: vectors and matrices (column-major, as WebGL expects)

  const v3 = Object.freeze({
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    mix: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  });

  function ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  }
  const chain = (...ms) => ms.reduce((a, b) => mul(a, b));
  function T(x, y, z) { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function S(x, y = x, z = x) { const m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function RX(a) { const m = ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function RY(a) { const m = ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function RZ(a) { const m = ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  const apply = (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  const applyDir = (m, d) => [
    m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
    m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
    m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
  const origin = m => [m[12], m[13], m[14]];

  /** A frame whose local axes are `x`, `y`, `z` (columns) placed at `at`. */
  function basis(x, y, z, at) {
    const m = ident();
    m[0] = x[0]; m[1] = x[1]; m[2] = x[2];
    m[4] = y[0]; m[5] = y[1]; m[6] = y[2];
    m[8] = z[0]; m[9] = z[1]; m[10] = z[2];
    m[12] = at[0]; m[13] = at[1]; m[14] = at[2];
    return m;
  }

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
    return m;
  }

  /** View matrix looking from `eye` at `target`, turned `roll` radians about the view axis. */
  function lookAt(eye, target, roll = 0, upHint = [0, 1, 0]) {
    const z = v3.norm(v3.sub(eye, target));
    let x = v3.cross(upHint, z);
    if (v3.len(x) < 1e-5) x = v3.cross([0, 0, 1], z);
    x = v3.norm(x);
    let y = v3.cross(z, x);
    if (roll) {
      const c = Math.cos(roll), s = Math.sin(roll);
      const rx = v3.add(v3.scale(x, c), v3.scale(y, s));
      y = v3.add(v3.scale(y, c), v3.scale(x, -s));
      x = rx;
    }
    const m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -v3.dot(x, eye); m[13] = -v3.dot(y, eye); m[14] = -v3.dot(z, eye); m[15] = 1;
    return m;
  }

  function invert(m) {
    const a = m, o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
    const b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
    const b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return ident();
    det = 1 / det;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
    o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
    o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
    o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
    o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
    o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
    o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
    o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
    o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
    o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
    o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
    o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
    o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
    return o;
  }

  // MARK: geometry. Every builder returns { p, n, i, bounds, smooth } with
  // counter-clockwise outward faces, which the ink outlines rely on.

  function finish(p, n, i, smooth) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < p.length; k += 3) for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[k + a]); hi[a] = Math.max(hi[a], p[k + a]);
    }
    return {
      p: p instanceof Float32Array ? p : new Float32Array(p),
      n: n instanceof Float32Array ? n : new Float32Array(n),
      i: i instanceof Uint32Array ? i : new Uint32Array(i),
      bounds: { center: v3.scale(v3.add(lo, hi), .5), size: v3.sub(hi, lo) },
      smooth: !!smooth,
    };
  }

  function box(w = 1, h = 1, d = 1) {
    const x = w / 2, y = h / 2, z = d / 2, p = [], n = [], i = [];
    const face = (nx, ny, nz, corners) => {
      const b = p.length / 3;
      for (const c of corners) { p.push(...c); n.push(nx, ny, nz); }
      i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    face(1, 0, 0, [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]);
    face(-1, 0, 0, [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]);
    face(0, 1, 0, [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]);
    face(0, -1, 0, [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]);
    face(0, 0, 1, [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]);
    face(0, 0, -1, [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]);
    return finish(p, n, i, false);
  }

  /** Revolves a [radius, height] profile, listed top to bottom, around the Y axis. */
  function lathe(profile, seg = 24, smooth = true) {
    const p = [], n = [], i = [], count = profile.length;
    const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
    for (let k = 0; k < count; k++) {
      const [r, y] = profile[k];
      const prev = profile[Math.max(0, k - 1)], next = profile[Math.min(count - 1, k + 1)];
      let tr, ty;
      if (k > 0 && same(prev, profile[k])) { tr = next[0] - r; ty = next[1] - y; }
      else if (k < count - 1 && same(next, profile[k])) { tr = r - prev[0]; ty = y - prev[1]; }
      else { tr = next[0] - prev[0]; ty = next[1] - prev[1]; }
      let nr = -ty, ny = tr;
      const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * TAU, c = Math.cos(a), si = Math.sin(a);
        p.push(r * c, y, r * si); n.push(nr * c, ny, nr * si);
      }
    }
    for (let k = 0; k < count - 1; k++) for (let s = 0; s < seg; s++) {
      const a = k * (seg + 1) + s, b = a + seg + 1;
      i.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return finish(p, n, i, smooth && !profile.some((q, k) => k && same(q, profile[k - 1])));
  }

  function sphere(r = 1, seg = 20, rings = 14) {
    const p = [], n = [], i = [];
    for (let k = 0; k <= rings; k++) {
      const th = k / rings * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (let s = 0; s <= seg; s++) {
        const ph = s / seg * TAU, x = st * Math.cos(ph), z = st * Math.sin(ph);
        p.push(x * r, ct * r, z * r); n.push(x, ct, z);
      }
    }
    for (let k = 0; k < rings; k++) for (let s = 0; s < seg; s++) {
      const a = k * (seg + 1) + s, b = a + seg + 1;
      i.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return finish(p, n, i, true);
  }

  function cylinder(rTop = 1, rBottom = 1, h = 1, seg = 20) {
    const y = h / 2;
    return lathe([[0, y], [rTop, y], [rTop, y], [rBottom, -y], [rBottom, -y], [0, -y]], seg, false);
  }

  /** A ring in the XZ plane: `R` to the tube centre, tube radius `r`, sweeping `arc` radians. */
  function torus(R = 1, r = .2, segR = 40, segr = 12, arc = TAU) {
    const p = [], n = [], i = [];
    for (let a = 0; a <= segR; a++) {
      const u = a / segR * arc, cu = Math.cos(u), su = Math.sin(u);
      for (let b = 0; b <= segr; b++) {
        const v = b / segr * TAU, cv = Math.cos(v), sv = Math.sin(v);
        p.push((R + r * cv) * cu, r * sv, (R + r * cv) * su); n.push(cv * cu, sv, cv * su);
      }
    }
    for (let a = 0; a < segR; a++) for (let b = 0; b < segr; b++) {
      const i0 = a * (segr + 1) + b, i1 = (a + 1) * (segr + 1) + b;
      i.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
    }
    return finish(p, n, i, true);
  }

  /** Flat upward plane centred on the origin. */
  function plane(w = 1, d = 1) {
    const x = w / 2, z = d / 2;
    return finish([-x, 0, z, x, 0, z, x, 0, -z, -x, 0, -z], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3], false);
  }

  /** Extrudes a counter-clockwise 2D outline (star-shaped about its centroid) along Z. */
  function extrude(shape, depth = .2) {
    const p = [], n = [], i = [], z = depth / 2, count = shape.length;
    const c = shape.reduce((a, q) => [a[0] + q[0] / count, a[1] + q[1] / count], [0, 0]);
    for (const [side, nz] of [[z, 1], [-z, -1]]) {
      const b = p.length / 3;
      p.push(c[0], c[1], side); n.push(0, 0, nz);
      for (const q of shape) { p.push(q[0], q[1], side); n.push(0, 0, nz); }
      for (let k = 0; k < count; k++) {
        const a1 = b + 1 + k, a2 = b + 1 + (k + 1) % count;
        if (nz > 0) i.push(b, a1, a2); else i.push(b, a2, a1);
      }
    }
    for (let k = 0; k < count; k++) {
      const q0 = shape[k], q1 = shape[(k + 1) % count];
      const dx = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dx, dy) || 1;
      const nx = dy / l, ny = -dx / l, b = p.length / 3;
      p.push(q0[0], q0[1], z, q1[0], q1[1], z, q1[0], q1[1], -z, q0[0], q0[1], -z);
      for (let r = 0; r < 4; r++) n.push(nx, ny, 0);
      i.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    return finish(p, n, i, false);
  }

  /** A hanging pleated drape in the XY plane: top edge at y = 0, folds along X. */
  function drape(w = 4, h = 8, folds = 6, depth = .25, sx = 72, sy = 6) {
    const p = [], n = [], i = [], k = folds * TAU / w;
    for (let r = 0; r <= sy; r++) for (let c = 0; c <= sx; c++) {
      const x = -w / 2 + c / sx * w, y = -r / sy * h;
      p.push(x, y, Math.sin(x * k) * depth);
      const slope = Math.cos(x * k) * depth * k, l = Math.hypot(slope, 1);
      n.push(-slope / l, 0, 1 / l);
    }
    for (let r = 0; r < sy; r++) for (let c = 0; c < sx; c++) {
      const a = r * (sx + 1) + c, b = a + sx + 1;
      i.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return finish(p, n, i, false);
  }

  /** An open cone from its apex at the origin to a unit circle at y = -1, for light beams. */
  function cone(seg = 28, rings = 6) {
    const p = [], n = [], i = [], s2 = Math.SQRT1_2;
    for (let k = 0; k <= rings; k++) {
      const t = k / rings;
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * TAU, c = Math.cos(a), si = Math.sin(a);
        p.push(c * t, -t, si * t); n.push(c * s2, s2, si * s2);
      }
    }
    for (let k = 0; k < rings; k++) for (let s = 0; s < seg; s++) {
      const a = k * (seg + 1) + s, b = a + seg + 1;
      i.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return finish(p, n, i, true);
  }

  /** Bakes several { g, m } parts into one static mesh (one draw call). */
  function merge(parts) {
    let vc = 0, ic = 0;
    for (const { g } of parts) { vc += g.p.length; ic += g.i.length; }
    const p = new Float32Array(vc), n = new Float32Array(vc), idx = new Uint32Array(ic);
    let po = 0, io = 0;
    for (const { g, m } of parts) {
      const base = po / 3;
      for (let k = 0; k < g.p.length; k += 3) {
        p.set(apply(m, [g.p[k], g.p[k + 1], g.p[k + 2]]), po + k);
        n.set(v3.norm(applyDir(m, [g.n[k], g.n[k + 1], g.n[k + 2]])), po + k);
      }
      for (let k = 0; k < g.i.length; k++) idx[io + k] = g.i[k] + base;
      po += g.p.length; io += g.i.length;
    }
    return finish(p, n, idx, parts.every(({ g }) => g.smooth));
  }

  /** A two-sided ribbon through `points` ([x, y, z] list); width tapers by `widthAt(u)`. */
  function ribbon(points, widthAt, upHint = [0, 1, 0], twist = 0) {
    const count = points.length, p = new Float32Array(count * 6), n = new Float32Array(count * 6);
    const idx = new Uint32Array(Math.max(0, count - 1) * 6);
    let side = [1, 0, 0];
    for (let k = 0; k < count; k++) {
      const a = points[Math.max(0, k - 1)], b = points[Math.min(count - 1, k + 1)];
      const tangent = v3.norm(v3.sub(b, a));
      let s = v3.cross(tangent, upHint);
      if (v3.len(s) < 1e-4) s = side;
      s = v3.norm(s);
      const tw = twist * k / Math.max(1, count - 1);
      const up = v3.cross(s, tangent);
      s = v3.norm(v3.add(v3.scale(s, Math.cos(tw)), v3.scale(up, Math.sin(tw))));
      side = s;
      const normal = v3.norm(v3.cross(s, tangent));
      const w = widthAt(k / Math.max(1, count - 1)) / 2;
      const q = points[k];
      p.set([q[0] - s[0] * w, q[1] - s[1] * w, q[2] - s[2] * w, q[0] + s[0] * w, q[1] + s[1] * w, q[2] + s[2] * w], k * 6);
      n.set([...normal, ...normal], k * 6);
      if (k < count - 1) idx.set([k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3], k * 6);
    }
    return finish(p, n, idx, false);
  }

  /** A closed round tube through `points`; radius `radiusAt(u)` (0 at an end closes it). */
  function tube(points, radiusAt, seg = 8) {
    const count = points.length, ring = seg + 1;
    const p = new Float32Array(count * ring * 3), n = new Float32Array(count * ring * 3);
    const idx = new Uint32Array(Math.max(0, count - 1) * seg * 6);
    let normal = null;
    for (let k = 0; k < count; k++) {
      const a = points[Math.max(0, k - 1)], b = points[Math.min(count - 1, k + 1)];
      const tangent = v3.norm(v3.sub(b, a));
      if (!normal) {
        normal = v3.cross(tangent, [0, 1, 0]);
        if (v3.len(normal) < 1e-3) normal = v3.cross(tangent, [1, 0, 0]);
      }
      // Parallel transport keeps the rings from twisting along the curve.
      normal = v3.sub(normal, v3.scale(tangent, v3.dot(normal, tangent)));
      if (v3.len(normal) < 1e-6) normal = v3.cross(tangent, [1, 0, 0]);
      normal = v3.norm(normal);
      const bin = v3.cross(tangent, normal), r = radiusAt(k / Math.max(1, count - 1)), q = points[k];
      for (let s = 0; s <= seg; s++) {
        const ang = s / seg * TAU, c = Math.cos(ang), si = Math.sin(ang), o = (k * ring + s) * 3;
        const d = [normal[0] * c + bin[0] * si, normal[1] * c + bin[1] * si, normal[2] * c + bin[2] * si];
        p[o] = q[0] + d[0] * r; p[o + 1] = q[1] + d[1] * r; p[o + 2] = q[2] + d[2] * r;
        n[o] = d[0]; n[o + 1] = d[1]; n[o + 2] = d[2];
      }
    }
    let o = 0;
    for (let k = 0; k < count - 1; k++) for (let s = 0; s < seg; s++) {
      const a = k * ring + s, b = a + ring;
      idx[o++] = a; idx[o++] = a + 1; idx[o++] = b; idx[o++] = a + 1; idx[o++] = b + 1; idx[o++] = b;
    }
    return finish(p, n, idx, true);
  }

  // MARK: shaders

  const MESH_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
uniform mat4 uVP;
uniform mat4 uM;
uniform float uInflate;
out vec3 vN;
out vec3 vW;
out vec3 vL;
void main() {
  vec3 n = normalize(mat3(uM) * aNor);
  vec4 w = uM * vec4(aPos, 1.0);
  w.xyz += n * uInflate;
  vN = n;
  vW = w.xyz;
  vL = aPos;
  gl_Position = uVP * w;
}`;

  const MESH_FS = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vW;
uniform vec3 uBase, uShade, uEmit, uRimColor, uCam, uKeyDir, uKeyColor, uAmbient, uFogColor;
uniform float uRim, uSpec, uAlpha, uFlat, uFogNear, uFogFar, uWindows, uReflect, uSpotGain;
uniform vec3 uSpotPos[6];
uniform vec3 uSpotDir[6];
uniform vec3 uSpotCol[6];
uniform float uSpotCos[6];
uniform float uFloor, uTile, uRingRadius, uRingAmount;
uniform vec3 uFloorB, uRingColor, uRingCenter;
uniform float uScreen, uScrPower, uScrLit;
uniform vec3 uScrA, uScrB, uScrC, uScrD, uScrInk;
uniform vec4 uScrP;
uniform vec4 uScrQ;
uniform vec4 uScrR;
in vec3 vL;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return length(p - vec2(0.25, 0.75)) - 0.35355;
  vec2 a = p - vec2(0.0, 1.0), b = p - 0.5 * max(p.x + p.y, 0.0);
  return sqrt(min(dot(a, a), dot(b, b))) * sign(p.x - p.y);
}
// LED wall content. q: position on the panel in world units, uv: 0..1 across it (y up).
// uScrP: time, beat position, energy, LEDs per unit. uScrQ: width, height, hold-back, gain.
vec3 screenAt(vec2 q, vec2 uv) {
  float t = uScrP.x, beat = uScrP.y, e = uScrP.z, mode = uScreen;
  float pulse = pow(1.0 - fract(beat), 4.0);
  vec2 size = uScrQ.xy;
  float x = abs(uv.x - 0.5);
  vec3 c;
  if (mode < 1.5) {
    // Chevrons racing out from the middle.
    float g = x * size.x * 0.22 - abs(uv.y - 0.5) * size.y * 0.1 - t * 0.55;
    float v = fract(g);
    c = mix(uScrA, uScrB, mod(floor(g), 2.0)) * smoothstep(0.0, 0.05, v) * smoothstep(0.46, 0.4, v) * (0.6 + 0.4 * pulse);
  } else if (mode < 2.5) {
    // Level meters, mirrored about the middle.
    float col = floor(x * 26.0), gap = step(0.2, fract(x * 26.0));
    float h = 0.14 + (0.3 + 0.4 * e) * (0.55 + 0.45 * sin(col * 1.9 + t * 4.3 + hash1(col) * 6.0)) + 0.22 * pulse * hash1(col + floor(beat) * 13.0);
    float peak = smoothstep(0.025, 0.0, abs(uv.y - h - 0.04));
    c = (mix(uScrA, uScrC, clamp(uv.y / max(h, 0.05), 0.0, 1.0)) * step(uv.y, h) + uScrC * peak) * gap;
  } else if (mode < 3.5) {
    // Hearts that beat, each a little after the last.
    vec2 cell = floor(q / 2.4), p = (q - (cell + 0.5) * 2.4) / 0.95;
    float h = hash(cell + 2.0), s = 1.0 + 0.25 * pow(1.0 - fract(beat + h * 0.5), 4.0);
    float d = sdHeart(p / s + vec2(0.0, 0.55));
    c = mix(uScrA, uScrB, step(0.5, h)) * smoothstep(0.05, -0.02, d) * (0.65 + 0.35 * pulse);
  } else if (mode < 4.5) {
    // Twinkling stars over a soft night-sky glow.
    vec2 cell = floor(q * uScrP.w);
    float h = hash(cell), h2 = hash(cell + 5.3);
    c = mix(uScrC, uScrB, h2 * 0.6) * step(0.7, h) * (0.15 + pow(max(0.0, sin(t * (0.8 + h2 * 2.2) + h * 60.0)), 4.0))
      + mix(uScrA, uScrB, uv.y) * (0.1 + 0.06 * sin(uv.y * 6.0 - t * 0.4));
  } else if (mode < 5.5) {
    // Rings opening out from the middle on the beat.
    float g = length((uv - vec2(0.5, 0.42)) * size) * 0.16 - t * 0.35 - pulse * 0.08;
    float v = fract(g), k = mod(floor(g), 3.0);
    c = (k < 1.0 ? uScrA : k < 2.0 ? uScrB : uScrC) * smoothstep(0.0, 0.06, v) * smoothstep(0.42, 0.34, v) * (0.55 + 0.45 * pulse);
  } else if (mode < 6.5) {
    // Red-line stripes, with a strobe on every other beat.
    float v = fract((q.x * sign(uv.x - 0.5) + q.y * 0.6) * 0.35 - t * 1.4);
    c = mix(uScrA, uScrB, step(0.5, v)) * smoothstep(0.0, 0.05, v) * 0.7
      + uScrC * pow(1.0 - fract(beat), 10.0) * step(0.5, mod(floor(beat), 2.0)) * 0.8;
  } else {
    // City lights falling down the panel.
    float col = floor(q.x * uScrP.w * 0.5);
    float s = fract(uv.y * 1.4 + t * (0.5 + hash1(col) * 1.1) * 0.16 + hash1(col + 7.0));
    c = mix(mix(uScrA, uScrB, hash1(col + 11.0)), uScrC, pow(s, 24.0)) * pow(s, 3.0) * step(0.15, hash1(col + 3.0)) + uScrA * 0.05;
  }
  float hold = 1.0 - uScrQ.z * (1.0 - smoothstep(0.12, 0.34, x)) * (1.0 - smoothstep(0.1, 0.32, abs(uv.y - 0.25)));
  return c * hold * uScrQ.w;
}
// Card suits as signed distances in a box about [-1, 1]: 0 hearts, 1 diamonds, 2 spades, 3 clubs.
float suitDist(vec2 p, float suit) {
  if (suit < 0.5) return sdHeart(p * 0.9 + vec2(0.0, 0.55)) / 0.9;
  if (suit < 1.5) return (abs(p.x) / 0.7 + abs(p.y) - 0.92) * 0.6;
  float stem = max(abs(p.x) - 0.07 - max(0.0, -p.y - 0.55) * 0.9, abs(p.y + 0.6) - 0.3);
  if (suit < 2.5) return min(sdHeart(vec2(p.x, -p.y) * 0.95 + vec2(0.0, 0.42)) / 0.95, stem);
  float d = min(length(p - vec2(0.0, 0.34)), min(length(p - vec2(-0.34, -0.06)), length(p - vec2(0.34, -0.06)))) - 0.3;
  return min(d, stem);
}
vec3 cardFace(vec2 uv, vec2 size) {
  vec2 q = uv * size;
  vec3 ink = uScrR.x > 1.5 ? uScrInk : uScrB;
  vec3 c = vec3(0.99, 0.97, 0.92);
  // A thin inner border, then one big pip in the middle and small ones in two corners.
  vec2 e = min(q, size - q);
  float border = smoothstep(0.012, 0.0, abs(min(e.x, e.y) - 0.055));
  c = mix(c, mix(ink, c, 0.45), border);
  float pip = uScrR.y * size.x;
  vec2 p = (q - size * 0.5) / pip;
  float aa = fwidth(p.x) * 1.2;
  c = mix(c, ink, smoothstep(aa, -aa, suitDist(p, uScrR.x)));
  for (int k = 0; k < 2; k++) {
    vec2 corner = k == 0 ? vec2(0.14, size.y - 0.22) : vec2(size.x - 0.14, 0.22);
    vec2 cp = (q - corner) / 0.075 * (k == 0 ? 1.0 : -1.0);
    float ca = fwidth(cp.x) * 1.2;
    c = mix(c, ink, smoothstep(ca, -ca, suitDist(cp, uScrR.x)));
  }
  return c;
}
vec3 cardBack(vec2 uv, vec2 size) {
  vec2 q = uv * size, e = min(q, size - q);
  float inner = step(0.07, min(e.x, e.y));
  vec2 p = q - size * 0.5;
  float g = (p.x + p.y) * 7.0, h = (p.x - p.y) * 7.0;
  float w = fwidth(g) * 1.2;
  float lattice = max(1.0 - smoothstep(0.06, 0.06 + w, min(fract(g), 1.0 - fract(g))), 1.0 - smoothstep(0.06, 0.06 + w, min(fract(h), 1.0 - fract(h))));
  vec3 c = mix(uScrA, uScrC, lattice * 0.85);
  // A cream medallion with a heart in the middle.
  float oval = length(p / vec2(0.26, 0.32) * size.x) - 1.0;
  float ow = fwidth(oval) * 1.2;
  c = mix(c, vec3(0.99, 0.95, 0.86), smoothstep(ow, -ow, oval));
  c = mix(c, uScrC, smoothstep(ow, -ow, abs(oval) - 0.06));
  vec2 hp = p / (0.15 * size.x);
  float hw = fwidth(hp.x) * 1.2;
  c = mix(c, uScrB, smoothstep(hw, -hw, suitDist(hp, 0.0)));
  return mix(vec3(0.99, 0.97, 0.92), c, inner);
}
// Four flat colours in bands of v, with ink lines between them (pop-art print).
vec3 bands4(float v, float w) {
  float k = mod(floor(v), 4.0), f = fract(v);
  vec3 c = k < 1.0 ? uScrA : k < 2.0 ? uScrB : k < 3.0 ? uScrC : uScrD;
  float line = 1.0 - smoothstep(0.035, 0.035 + w * 1.5, min(f, 1.0 - f));
  return mix(c, uScrInk, line);
}
// Flat pop-art pictures (modes 8-15) for posters, backdrops and TV screens.
// uScrR: count (arms, rays, rings or cell size), twist, speed, extra.
vec3 popAt(vec2 q, vec2 uv) {
  float t = uScrP.x, mode = uScreen;
  vec2 size = uScrQ.xy, p = (uv - 0.5) * size;
  float r = length(p);
  // Angle as 0..1 turns, with a seam-free derivative for the ink lines.
  float a1 = atan(p.y, p.x) / 6.2831853 + 0.5, a2 = fract(a1 + 0.5);
  float da = min(fwidth(a1), fwidth(a2));
  vec3 c;
  if (mode < 8.5) {
    // A spiral of arms turning round the middle.
    float v = (a1 * uScrR.x + log(r + 0.3) * uScrR.y - t * uScrR.z) * 1.0;
    c = bands4(v, da * uScrR.x + fwidth(log(r + 0.3)) * abs(uScrR.y));
  } else if (mode < 9.5) {
    // Halftone dots that swell in waves from the middle.
    vec2 g = q / uScrR.x;
    g.x += 0.5 * mod(floor(g.y), 2.0);
    float d = length(fract(g) - 0.5), aa = fwidth(g.x) * 0.8;
    float rad = 0.1 + 0.3 * (0.5 + 0.5 * sin(r * uScrR.y - t * uScrR.z));
    c = mix(uScrB, uScrA, 1.0 - smoothstep(rad - aa, rad + aa, d));
  } else if (mode < 10.5) {
    // Sunburst rays.
    float v = a1 * uScrR.x * 2.0 + t * uScrR.z;
    float k = mod(floor(v), 2.0), f = fract(v), w = da * uScrR.x * 2.0;
    c = mix(mix(uScrA, uScrB, k), uScrInk, 1.0 - smoothstep(0.03, 0.03 + w * 1.5, min(f, 1.0 - f)));
    c = mix(c, uScrC, 1.0 - smoothstep(uScrR.y, uScrR.y + fwidth(r) * 1.5, r));
  } else if (mode < 11.5) {
    // Rings opening outward.
    float v = r * uScrR.x - t * uScrR.z;
    c = bands4(v, fwidth(v));
  } else if (mode < 12.5) {
    // TV static with a slow rolling band.
    float n = hash(floor(q * uScrR.x) + floor(t * 30.0) * 1.73);
    c = vec3(n) * (0.75 + 0.25 * sin(uv.y * 18.0 - t * 12.0)) * mix(vec3(1.0), uScrA, 0.15);
  } else if (mode < 13.5) {
    // A pop colour-bar test card.
    float k = floor(uv.x * 7.0);
    vec3 bar = mod(k, 4.0) < 1.0 ? uScrA : mod(k, 4.0) < 2.0 ? uScrB : mod(k, 4.0) < 3.0 ? uScrC : uScrD;
    if (k > 5.5) bar = vec3(0.98, 0.96, 0.9);
    float low = step(uv.y, 0.27);
    c = mix(bar, mix(uScrInk, vec3(0.98, 0.96, 0.9), step(0.5, fract(uv.x * 3.5 - t * 0.2))), low);
    float f = fract(uv.x * 7.0);
    c = mix(c, uScrInk, (1.0 - smoothstep(0.02, 0.02 + fwidth(uv.x * 7.0) * 1.5, min(f, 1.0 - f))) * (1.0 - low));
  } else if (mode < 14.5) {
    // An iris: coloured rings round a spiral pupil, with a catchlight.
    float rr = r / (min(size.x, size.y) * 0.5);
    c = bands4(rr * 5.0 - t * uScrR.z * 0.3, fwidth(rr * 5.0));
    float s = fract(a1 * 2.0 + log(rr + 0.05) * 1.6 - t * uScrR.z);
    vec3 pupil = mix(uScrInk, vec3(0.98, 0.96, 0.9), step(0.5, s));
    c = mix(c, pupil, 1.0 - smoothstep(uScrR.x, uScrR.x + fwidth(rr) * 1.5, rr));
    c = mix(c, uScrInk, 1.0 - smoothstep(0.02, 0.02 + fwidth(rr) * 1.5, abs(rr - uScrR.x)));
    c = mix(c, vec3(1.0), 1.0 - smoothstep(0.13, 0.15, length(p / (min(size.x, size.y) * 0.5) - vec2(-0.32, 0.34))));
  } else if (mode < 15.5) {
    // Tunnel walls: stripes spiralling along a cylinder (local y runs along it).
    float b1 = atan(vL.z, vL.x) / 6.2831853 + 0.5, b2 = fract(b1 + 0.5);
    float v = b1 * uScrR.x + vL.y * uScrR.y - t * uScrR.z;
    c = bands4(v, min(fwidth(b1), fwidth(b2)) * uScrR.x + fwidth(vL.y) * abs(uScrR.y));
  } else {
    // A playing card lying in the local xz plane: its face on the +y side, its back below.
    c = vL.y > 0.0 ? cardFace(uv, size) : cardBack(uv, size);
  }
  return c * uScrQ.w;
}
void main() {
  if (uFlat > 0.5) { outColor = vec4(uBase, uAlpha); return; }
  if (uReflect > 0.0 && vW.y < -0.02) discard;
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(uCam - vW);
  vec3 base = uBase;
  vec3 shade = uShade;
  vec3 emit = uEmit;
  if (uScreen > 7.5) {
    // A flat printed picture, or a TV screen showing one.
    vec2 uv = vec2(vL.x + 0.5, 0.5 - vL.z);
    vec3 pic = popAt(uv * uScrQ.xy, uv);
    if (uScrPower < 0.999) {
      // A CRT switching on or off: a bright line that opens to the full picture.
      float open = smoothstep(0.35, 1.0, uScrPower), line = smoothstep(0.0, 0.35, uScrPower);
      float inside = step(abs(uv.y - 0.5), mix(0.008, 0.5, open)) * step(abs(uv.x - 0.5), mix(0.0, 0.5, line));
      pic = mix(vec3(0.0), mix(vec3(1.6), pic, open), inside);
    }
    if (uScrLit > 0.5) {
      // Printed: the picture is the surface colour and takes the light (cards, posters).
      base = pic;
      shade = pic * vec3(0.6, 0.52, 0.68);
    } else {
      emit += pic;
      base = vec3(0.02);
      shade = base;
    }
  } else if (uScreen > 0.5) {
    // A panel of LEDs: content sampled once per LED, which melts into a smooth
    // picture when the LEDs get smaller than a pixel (no shimmer at a distance).
    vec2 uv = vec2(vL.x + 0.5, 0.5 - vL.z), q = uv * uScrQ.xy, g = q * uScrP.w;
    float fine = smoothstep(0.35, 0.9, max(fwidth(g.x), fwidth(g.y)));
    vec2 at = mix((floor(g) + 0.5) / uScrP.w, q, fine);
    float led = mix(smoothstep(0.5, 0.26, length(fract(g) - 0.5)), 0.62, fine);
    emit += screenAt(at, at / uScrQ.xy) * led;
    base = vec3(0.03, 0.025, 0.04) + vec3(0.035) * led;
    shade = base * 0.6;
  }
  if (uFloor > 0.5) {
    vec2 cell = floor(vW.xz / uTile);
    float chk = mod(cell.x + cell.y, 2.0);
    vec2 f = fract(vW.xz / uTile);
    float grout = 1.0 - 0.45 * step(0.955, max(f.x, f.y));
    base = mix(uBase, uFloorB, chk) * grout;
    shade = base * 0.6;
    float d = length((cell + 0.5) * uTile - uRingCenter.xz);
    float ring = exp(-pow((d - uRingRadius) / (uTile * 0.9), 2.0));
    emit += uRingColor * ring * uRingAmount * (0.55 + 0.45 * chk) * grout;
  }
  float ndl = dot(n, uKeyDir);
  float band = smoothstep(-0.02, 0.07, ndl);
  vec3 c = mix(shade, base, band) * uKeyColor + base * uAmbient;
  for (int k = 0; k < 6; k++) {
    vec3 L = uSpotPos[k] - vW;
    float dist = max(length(L), 1e-4);
    L /= dist;
    float cone = smoothstep(uSpotCos[k], uSpotCos[k] + (1.0 - uSpotCos[k]) * 0.18, dot(-L, uSpotDir[k]));
    float lam = smoothstep(0.0, 0.1, dot(n, L));
    c += base * uSpotCol[k] * cone * lam * uSpotGain;
    c += uSpotCol[k] * cone * uSpec * smoothstep(0.92, 0.95, dot(reflect(-L, n), v));
  }
  c += uKeyColor * uSpec * band * smoothstep(0.95, 0.975, dot(reflect(-uKeyDir, n), v));
  float rim = smoothstep(0.6, 0.76, 1.0 - max(dot(n, v), 0.0));
  c += uRimColor * rim * uRim;
  if (uWindows > 0.0 && abs(n.y) < 0.5) {
    vec2 g = abs(n.x) > 0.5 ? vW.zy : vW.xy;
    vec2 cw = floor(g * vec2(2.2, 2.6));
    vec2 fw = fract(g * vec2(2.2, 2.6));
    float pane = step(0.24, fw.x) * step(fw.x, 0.76) * step(0.26, fw.y) * step(fw.y, 0.7);
    float lit = step(0.46, hash(cw + floor(vW.xz * 0.21) * 17.0 + n.x * 3.0 + n.z * 5.0));
    vec3 warm = mix(vec3(1.0, 0.78, 0.46), vec3(0.55, 0.92, 1.0), step(0.78, hash(cw * 1.7 + 4.0)));
    c += warm * pane * lit * uWindows;
  }
  c += emit;
  float fog = smoothstep(uFogNear, uFogFar, distance(uCam, vW));
  c = mix(c, uFogColor, fog);
  float a = uAlpha;
  if (uReflect > 0.0) { a *= uReflect * exp(-max(vW.y, 0.0) * 0.42); c *= 0.9; }
  outColor = vec4(c, a);
}`;

  const BEAM_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNor;
uniform mat4 uVP;
uniform mat4 uM;
uniform mat3 uNM;
out vec3 vN;
out vec3 vW;
out float vAlong;
void main() {
  vec4 w = uM * vec4(aPos, 1.0);
  vW = w.xyz;
  vN = normalize(uNM * aNor);
  vAlong = -aPos.y;
  gl_Position = uVP * w;
}`;

  const BEAM_FS = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vW;
in float vAlong;
uniform vec3 uColor, uCam;
uniform float uIntensity;
out vec4 outColor;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(uCam - vW);
  float soft = pow(abs(dot(n, v)), 1.7);
  float along = clamp(vAlong, 0.0, 1.0);
  float fall = pow(1.0 - along, 1.15) * smoothstep(0.0, 0.03, along) + 0.35 * exp(-along * 30.0);
  float a = uIntensity * soft * fall;
  outColor = vec4(uColor * a, 1.0);
}`;

  const POINT_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aCol;
layout(location = 2) in vec2 aSize;
uniform mat4 uVP;
uniform float uScale, uMax;
out vec4 vCol;
out float vRot;
void main() {
  vec4 c = uVP * vec4(aPos, 1.0);
  gl_Position = c;
  gl_PointSize = clamp(aSize.x * uScale / max(c.w, 0.05), 0.0, uMax);
  vCol = aCol;
  vRot = aSize.y;
}`;

  const POINT_FS = `#version 300 es
precision highp float;
in vec4 vCol;
in float vRot;
uniform float uKind, uAdd;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float a;
  if (uKind < 0.5) a = exp(-dot(p, p) * 4.5);
  else if (uKind < 1.5) {
    float cross = max(exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 1.6), exp(-abs(p.y) * 14.0) * exp(-abs(p.x) * 1.6));
    a = max(cross, exp(-dot(p, p) * 9.0));
  } else if (uKind < 2.5) a = step(abs(p.x), 0.86) * step(abs(p.y), 0.42);
  else if (uKind < 3.5) a = smoothstep(1.0, 0.72, length(p));
  else if (uKind < 4.5) a = smoothstep(1.0, 0.82, length(p * vec2(1.0, 1.9))) * smoothstep(-0.95, -0.55, p.x);
  else { float r = length(p); a = smoothstep(1.0, 0.86, r) * (0.5 + 0.5 * smoothstep(0.45, 0.95, r)); }
  a *= vCol.a;
  if (a < 0.004) discard;
  outColor = uAdd > 0.5 ? vec4(vCol.rgb * a, 1.0) : vec4(vCol.rgb, a);
}`;

  const QUAD_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform mat4 uInvVP;
uniform vec3 uTop, uHorizon, uBottom, uMoonDir, uMoonColor;
uniform float uStars, uMoon, uTime;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 a = uInvVP * vec4(ndc, -1.0, 1.0);
  vec4 b = uInvVP * vec4(ndc, 1.0, 1.0);
  vec3 dir = normalize(b.xyz / b.w - a.xyz / a.w);
  float e = dir.y;
  vec3 c = e > 0.0 ? mix(uHorizon, uTop, pow(clamp(e, 0.0, 1.0), 0.55))
                   : mix(uHorizon, uBottom, pow(clamp(-e, 0.0, 1.0), 0.45));
  if (uStars > 0.0 && e > 0.0) {
    vec2 sc = vec2(atan(dir.z, dir.x), asin(clamp(e, -1.0, 1.0))) * 64.0;
    vec2 cell = floor(sc);
    vec2 f = fract(sc) - 0.5;
    float h = hash(cell);
    vec2 off = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
    float d = length(f - off * 0.6);
    float tw = 0.6 + 0.4 * sin(uTime * (1.3 + h * 3.0) + h * 40.0);
    c += vec3(1.0, 0.94, 0.9) * step(0.978, h) * smoothstep(0.13, 0.0, d) * tw * uStars * smoothstep(0.0, 0.12, e);
  }
  if (uMoon > 0.0) {
    vec3 md = normalize(uMoonDir);
    float cd = dot(dir, md);
    float r = 0.085;
    float disc = smoothstep(cos(r) - 0.00045, cos(r) + 0.00045, cd);
    float ang = acos(clamp(cd, -1.0, 1.0)) / r;
    vec3 side = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, md);
    vec2 q = vec2(dot(dir - md, side), dot(dir - md, up)) / r;
    float maria = smoothstep(0.55, 0.0, length(q - vec2(-0.25, 0.2))) * 0.16
                + smoothstep(0.35, 0.0, length(q - vec2(0.3, -0.25))) * 0.12
                + smoothstep(0.25, 0.0, length(q - vec2(0.05, 0.45))) * 0.08;
    vec3 moon = uMoonColor * (1.0 - maria) * (0.78 + 0.22 * sqrt(max(0.0, 1.0 - ang * ang)));
    float glow = pow(max(cd, 0.0), 1400.0) * 0.5 + pow(max(cd, 0.0), 90.0) * 0.22 + pow(max(cd, 0.0), 12.0) * 0.06;
    c = mix(c, moon, disc * uMoon) + uMoonColor * glow * uMoon;
  }
  outColor = vec4(c, 1.0);
}`;

  const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
out vec4 outColor;
void main() {
  vec3 c = (texture(uTex, vUv + uTexel * vec2(-1.5, -1.5)).rgb + texture(uTex, vUv + uTexel * vec2(1.5, -1.5)).rgb
          + texture(uTex, vUv + uTexel * vec2(-1.5, 1.5)).rgb + texture(uTex, vUv + uTexel * vec2(1.5, 1.5)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b));
  outColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.3, l), 1.0);
}`;

  const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 outColor;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.227027;
  c += (texture(uTex, vUv + uDir).rgb + texture(uTex, vUv - uDir).rgb) * 0.1945946;
  c += (texture(uTex, vUv + uDir * 2.0).rgb + texture(uTex, vUv - uDir * 2.0).rgb) * 0.1216216;
  c += (texture(uTex, vUv + uDir * 3.0).rgb + texture(uTex, vUv - uDir * 3.0).rgb) * 0.054054;
  c += (texture(uTex, vUv + uDir * 4.0).rgb + texture(uTex, vUv - uDir * 4.0).rgb) * 0.016216;
  outColor = vec4(c, 1.0);
}`;

  const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes, uFocus;
uniform float uBloomAmt, uSpeed, uFlash, uAberr, uLetter, uVignette, uInvert, uTime, uGrain, uSat, uExposure, uStatic, uScan;
uniform vec3 uFlashColor, uTint, uLift;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  vec3 c;
  if (uAberr > 0.0) {
    vec2 d = (uv - 0.5) * uAberr;
    c = vec3(texture(uScene, uv + d).r, texture(uScene, uv).g, texture(uScene, uv - d).b);
  } else c = texture(uScene, uv).rgb;
  c += texture(uBloom, uv).rgb * uBloomAmt;
  c *= uExposure;
  c = c / (1.0 + max(c - 0.86, 0.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat) * uTint + uLift;
  if (uSpeed > 0.0) {
    vec2 p = (uv - uFocus) * vec2(uRes.x / uRes.y, 1.0);
    float ang = (atan(p.y, p.x) + 3.14159265) * 46.0;
    float bin = floor(ang);
    float frame = floor(uTime * 12.0);
    float h = hash(vec2(bin, frame));
    float inner = 0.26 + hash(vec2(bin, frame + 9.0)) * 0.42;
    float line = step(0.7, h) * smoothstep(0.5, 0.12, abs(fract(ang) - 0.5)) * smoothstep(inner, inner + 0.22, length(p));
    c = mix(c, vec3(1.0), line * clamp(uSpeed, 0.0, 1.0) * 0.8);
  }
  vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= 1.0 - uVignette * smoothstep(0.38, 1.08, length(q));
  c = mix(c, uFlashColor, clamp(uFlash, 0.0, 1.0));
  if (uInvert > 0.0) c = mix(c, smoothstep(0.22, 0.78, vec3(1.0) - c), clamp(uInvert, 0.0, 1.0));
  if (uStatic > 0.0) {
    // TV static between channels, with a rolling band.
    float n = hash(floor(uv * uRes * 0.5) + floor(uTime * 30.0) * 1.73);
    c = mix(c, vec3(n) * (0.8 + 0.2 * sin(uv.y * 14.0 - uTime * 9.0)), clamp(uStatic, 0.0, 1.0));
  }
  if (uScan > 0.0) c *= 1.0 - uScan * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.5708));
  c += (hash(floor(uv * uRes) + floor(uTime * 24.0) * 0.37) - 0.5) * uGrain;
  if (uv.y < uLetter || uv.y > 1.0 - uLetter) c = vec3(0.0);
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

  // Lettering: each glyph quad samples a texture whose red channel holds the letter's
  // fill and green its thick ink outline. Extrusion layers behind the face use the
  // outline shape in a side colour, which reads as solid 3D type.
  const GLYPH_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aFill;
layout(location = 3) in vec4 aEdge;
uniform mat4 uVP;
out vec2 vUv;
out vec4 vFill;
out vec4 vEdge;
void main() {
  vUv = aUv;
  vFill = aFill;
  vEdge = aEdge;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

  const GLYPH_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vFill;
in vec4 vEdge;
uniform sampler2D uAtlas;
out vec4 outColor;
void main() {
  vec4 tx = texture(uAtlas, vUv);
  float fill = tx.r * tx.a;
  float edge = max(tx.g * tx.a, fill);
  vec3 col = vEdge.a > 0.5 ? vEdge.rgb : mix(vEdge.rgb, vFill.rgb, fill / max(edge, 1e-4));
  float a = edge * vFill.a;
  if (a < 0.004) discard;
  outColor = vec4(col * a, a);
}`;

  // MARK: renderer

  /** Returns a renderer, or null when WebGL2 or the shaders are unavailable. */
  function createRenderer(canvas, options = {}) {
    let gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power',
      });
    } catch { gl = null; }
    if (!gl) return null;

    function program(vsSource, fsSource) {
      const make = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
          console.warn('Mv3d shader:', gl.getShaderInfoLog(shader));
          return null;
        }
        return shader;
      };
      const vs = make(gl.VERTEX_SHADER, vsSource), fs = make(gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn('Mv3d program:', gl.getProgramInfoLog(p));
        return null;
      }
      const cache = new Map();
      return { p, stamp: -1, u: name => {
        if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
        return cache.get(name);
      } };
    }

    const P = {
      mesh: program(MESH_VS, MESH_FS), beam: program(BEAM_VS, BEAM_FS), point: program(POINT_VS, POINT_FS),
      sky: program(QUAD_VS, SKY_FS), bright: program(QUAD_VS, BRIGHT_FS), blur: program(QUAD_VS, BLUR_FS),
      composite: program(QUAD_VS, COMPOSITE_FS), glyph: program(GLYPH_VS, GLYPH_FS),
    };
    if (Object.values(P).some(x => !x)) return null;

    const emptyVao = gl.createVertexArray();
    const meshes = new WeakMap();
    const owned = [];
    function upload(g, usage = gl.STATIC_DRAW, target = null) {
      const m = target || { vao: gl.createVertexArray(), pb: gl.createBuffer(), nb: gl.createBuffer(), ib: gl.createBuffer() };
      gl.bindVertexArray(m.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.bufferData(gl.ARRAY_BUFFER, g.p, usage);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.nb); gl.bufferData(gl.ARRAY_BUFFER, g.n, usage);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.i, usage);
      gl.bindVertexArray(null);
      m.count = g.i.length; m.bounds = g.bounds; m.smooth = g.smooth;
      if (!target) owned.push(m);
      return m;
    }
    function meshOf(g) {
      let m = meshes.get(g);
      if (!m) { m = upload(g); meshes.set(g, m); }
      return m;
    }
    const dynamicMesh = { vao: gl.createVertexArray(), pb: gl.createBuffer(), nb: gl.createBuffer(), ib: gl.createBuffer() };
    const coneGeo = cone();

    const pointVao = gl.createVertexArray(), pointBuffer = gl.createBuffer();
    gl.bindVertexArray(pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 28);
    gl.bindVertexArray(null);
    // Glyph atlas: letters are drawn on demand into 128-pixel cells of one texture.
    const ATLAS = 2048, CELL = 128, EM = 84, BASE = 92, PER_ROW = ATLAS / CELL;
    const FONT = options.font || '800 {px}px system-ui, sans-serif';
    const glyphs = new Map();
    let atlasCtx = null, atlasTex = null, atlasNext = 0, atlasDirty = false, glyphEpoch = 0;
    function ensureAtlas() {
      if (atlasCtx) return true;
      const doc = typeof document === 'object' ? document : null;
      const surface = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(ATLAS, ATLAS) : doc?.createElement('canvas');
      if (!surface) return false;
      surface.width = ATLAS; surface.height = ATLAS;
      atlasCtx = surface.getContext('2d', { willReadFrequently: true });
      atlasTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ATLAS, ATLAS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return !!atlasCtx;
    }
    /** Metrics and texture cell for one character; sizes are in ems from its baseline centre. */
    function glyph(ch) {
      let g = glyphs.get(ch);
      if (g) return g;
      if (!ensureAtlas()) return { advance: .6, u0: 0, v0: 0, u1: 0, v1: 0, top: BASE / EM, bottom: (BASE - CELL) / EM, half: CELL / EM / 2 };
      if (atlasNext >= PER_ROW * PER_ROW) { resetGlyphs(); ensureAtlas(); }
      const k = atlasNext++, cx = (k % PER_ROW) * CELL, cy = Math.floor(k / PER_ROW) * CELL;
      const ctx = atlasCtx;
      ctx.save();
      ctx.clearRect(cx, cy, CELL, CELL);
      ctx.beginPath(); ctx.rect(cx, cy, CELL, CELL); ctx.clip();
      ctx.font = FONT.replace('{px}', EM);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round'; ctx.lineWidth = EM * .2; ctx.strokeStyle = '#00ff00';
      ctx.strokeText(ch, cx + CELL / 2, cy + BASE);
      ctx.fillStyle = '#ff0000';
      ctx.fillText(ch, cx + CELL / 2, cy + BASE);
      const advance = ctx.measureText(ch).width / EM;
      ctx.restore();
      const pixels = ctx.getImageData(cx, cy, CELL, CELL);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, cx, cy, CELL, CELL, gl.RGBA, gl.UNSIGNED_BYTE, pixels.data);
      atlasDirty = true;
      g = { advance, u0: cx / ATLAS, v0: cy / ATLAS, u1: (cx + CELL) / ATLAS, v1: (cy + CELL) / ATLAS,
        top: BASE / EM, bottom: (BASE - CELL) / EM, half: CELL / EM / 2 };
      glyphs.set(ch, g);
      return g;
    }
    /** Forgets every drawn letter, for example once a web font has finished loading. */
    function resetGlyphs() {
      glyphs.clear(); atlasNext = 0; glyphEpoch++;
      if (atlasCtx) atlasCtx.clearRect(0, 0, ATLAS, ATLAS);
    }
    const MAX_QUADS = 6000, GLYPH_FLOATS = 14;
    const glyphVao = gl.createVertexArray(), glyphBuffer = gl.createBuffer(), glyphIndex = gl.createBuffer();
    gl.bindVertexArray(glyphVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphBuffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, GLYPH_FLOATS * 4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, GLYPH_FLOATS * 4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, GLYPH_FLOATS * 4, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, GLYPH_FLOATS * 4, 36);
    const quadIndices = new Uint32Array(MAX_QUADS * 6);
    for (let k = 0; k < MAX_QUADS; k++) quadIndices.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glyphIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    const maxPoint = pointRange ? pointRange[1] : 64;

    // Render targets: a multisampled scene buffer, its resolved texture and two bloom buffers.
    let size = { w: 0, h: 0 }, targets = null;
    const maxSamples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    function texture(w, h) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function textureTarget(w, h) {
      const tex = texture(w, h), fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo, w, h };
    }
    function freeTargets() {
      if (!targets) return;
      for (const t of [targets.scene, targets.bloomA, targets.bloomB]) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
      if (targets.msaa) { gl.deleteFramebuffer(targets.msaa); gl.deleteRenderbuffer(targets.color); }
      gl.deleteRenderbuffer(targets.depth);
      targets = null;
    }
    function ensureTargets(w, h) {
      if (targets && size.w === w && size.h === h) return;
      freeTargets();
      size = { w, h };
      const scene = textureTarget(w, h);
      const bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
      const bloomA = textureTarget(bw, bh), bloomB = textureTarget(bw, bh);
      let msaa = null, color = null, depth = gl.createRenderbuffer();
      if (maxSamples > 1) {
        msaa = gl.createFramebuffer(); color = gl.createRenderbuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, msaa);
        gl.bindRenderbuffer(gl.RENDERBUFFER, color);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, maxSamples, gl.RGBA8, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, maxSamples, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          gl.deleteFramebuffer(msaa); gl.deleteRenderbuffer(color); gl.deleteRenderbuffer(depth);
          msaa = null; color = null; depth = gl.createRenderbuffer();
        }
      }
      if (!msaa) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      targets = { scene, bloomA, bloomB, msaa, color, depth };
    }

    // Per-frame state.
    const frame = {
      stamp: 0, eye: [0, 0, 5], shadeEye: [0, 0, 5], fov: .8, w: 1, h: 1,
      vp: ident(), baseVp: ident(), invVp: ident(), mirror: false,
      light: {
        keyDir: [0, 1, 0], keyColor: [1, 1, 1], ambient: [.2, .2, .2], fog: [0, 0, 0], fogNear: 30, fogFar: 90,
        spotPos: new Float32Array(18), spotDir: new Float32Array(18), spotCol: new Float32Array(18), spotCos: new Float32Array(6),
      },
    };
    let current = null;
    function use(prog) {
      if (current !== prog) { gl.useProgram(prog.p); current = prog; }
      if (prog.stamp !== frame.stamp) {
        prog.stamp = frame.stamp;
        const u = prog.u;
        if (u('uVP')) gl.uniformMatrix4fv(u('uVP'), false, frame.vp);
        if (u('uCam')) gl.uniform3fv(u('uCam'), frame.shadeEye);
        if (prog === P.mesh) {
          const L = frame.light;
          gl.uniform3fv(u('uKeyDir'), v3.norm(L.keyDir));
          gl.uniform3fv(u('uKeyColor'), L.keyColor);
          gl.uniform3fv(u('uAmbient'), L.ambient);
          gl.uniform3fv(u('uFogColor'), L.fog);
          gl.uniform1f(u('uFogNear'), L.fogNear);
          gl.uniform1f(u('uFogFar'), L.fogFar);
          gl.uniform3fv(u('uSpotPos'), L.spotPos);
          gl.uniform3fv(u('uSpotDir'), L.spotDir);
          gl.uniform3fv(u('uSpotCol'), L.spotCol);
          gl.uniform1fv(u('uSpotCos'), L.spotCos);
        }
      }
    }

    function begin(w, h, clear = [0, 0, 0]) {
      if (gl.isContextLost()) return false;
      frame.w = Math.max(1, w | 0); frame.h = Math.max(1, h | 0);
      ensureTargets(frame.w, frame.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.msaa || targets.scene.fbo);
      gl.viewport(0, 0, frame.w, frame.h);
      gl.clearColor(clear[0], clear[1], clear[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      frame.stamp++;
      return true;
    }

    function camera({ eye, target, roll = 0, fov = 45, up = [0, 1, 0], near = .08, far = 400 }) {
      frame.eye = eye.slice(); frame.shadeEye = eye.slice();
      frame.fov = fov * Math.PI / 180;
      const proj = perspective(frame.fov, frame.w / frame.h, near, far);
      frame.baseVp = mul(proj, lookAt(eye, target, roll, up));
      frame.vp = frame.baseVp;
      frame.invVp = invert(frame.baseVp);
      frame.mirror = false;
      frame.stamp++;
    }

    function lights(L) {
      const out = frame.light;
      Object.assign(out, {
        keyDir: L.keyDir || out.keyDir, keyColor: L.keyColor || out.keyColor, ambient: L.ambient || out.ambient,
        fog: L.fog || out.fog, fogNear: L.fogNear ?? out.fogNear, fogFar: L.fogFar ?? out.fogFar,
      });
      out.spotPos.fill(0); out.spotDir.fill(0); out.spotCol.fill(0); out.spotCos.fill(2);
      (L.spots || []).slice(0, 6).forEach((s, k) => {
        out.spotPos.set(s.pos, k * 3); out.spotDir.set(v3.norm(s.dir), k * 3);
        out.spotCol.set(s.color, k * 3); out.spotCos[k] = Math.cos(s.angle);
      });
      frame.stamp++;
    }

    /** Draws the following meshes reflected in the floor plane y = 0. */
    function mirror(on) {
      frame.mirror = !!on;
      frame.vp = on ? mul(frame.baseVp, S(1, -1, 1)) : frame.baseVp;
      frame.shadeEye = on ? [frame.eye[0], -frame.eye[1], frame.eye[2]] : frame.eye.slice();
      frame.stamp++;
    }

    function sky(o) {
      use(P.sky);
      const u = P.sky.u;
      gl.uniformMatrix4fv(u('uInvVP'), false, frame.invVp);
      gl.uniform3fv(u('uTop'), o.top); gl.uniform3fv(u('uHorizon'), o.horizon); gl.uniform3fv(u('uBottom'), o.bottom);
      gl.uniform3fv(u('uMoonDir'), o.moonDir || [0, 1, 0]); gl.uniform3fv(u('uMoonColor'), o.moonColor || [1, 1, 1]);
      gl.uniform1f(u('uStars'), o.stars || 0); gl.uniform1f(u('uMoon'), o.moon || 0); gl.uniform1f(u('uTime'), o.time || 0);
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    }

    const DARK = [.07, .025, .06];
    function setMaterial(u, m) {
      const color = m.color || [1, 1, 1];
      gl.uniform3fv(u('uBase'), color);
      gl.uniform3fv(u('uShade'), m.shade || [color[0] * .42, color[1] * .36, color[2] * .52]);
      gl.uniform3fv(u('uEmit'), m.emit || [0, 0, 0]);
      gl.uniform3fv(u('uRimColor'), m.rimColor || [1, 1, 1]);
      gl.uniform1f(u('uRim'), m.rim || 0);
      gl.uniform1f(u('uSpec'), m.spec || 0);
      gl.uniform1f(u('uWindows'), m.windows || 0);
      gl.uniform1f(u('uSpotGain'), m.spotGain ?? 1);
      gl.uniform1f(u('uFloor'), m.floor ? 1 : 0);
      if (m.floor) {
        gl.uniform3fv(u('uFloorB'), m.floor.b); gl.uniform1f(u('uTile'), m.floor.tile || 1);
        gl.uniform3fv(u('uRingColor'), m.floor.ringColor || [0, 0, 0]); gl.uniform3fv(u('uRingCenter'), m.floor.ringCenter || [0, 0, 0]);
        gl.uniform1f(u('uRingRadius'), m.floor.ringRadius || 0); gl.uniform1f(u('uRingAmount'), m.floor.ringAmount || 0);
      }
      // Screen content on a unit plane: LED modes 1-7 { a, b, c colours, time, beat, energy,
      // pitch, width, height, hold, gain }, or flat pop-art modes 8-15, which add a fourth
      // colour d, an ink colour, params [count, twist, speed, extra] and power (0 off, 1 on).
      const s = m.screen;
      gl.uniform1f(u('uScreen'), s ? s.mode : 0);
      if (s) {
        gl.uniform3fv(u('uScrA'), s.a); gl.uniform3fv(u('uScrB'), s.b); gl.uniform3fv(u('uScrC'), s.c);
        gl.uniform3fv(u('uScrD'), s.d || s.a); gl.uniform3fv(u('uScrInk'), s.ink || DARK);
        gl.uniform4f(u('uScrP'), s.time || 0, s.beat || 0, s.energy ?? .5, s.pitch || 4);
        gl.uniform4f(u('uScrQ'), s.width || 1, s.height || 1, s.hold || 0, s.gain ?? 1);
        const k = s.params || [6, 2, 1, 0];
        gl.uniform4f(u('uScrR'), k[0], k[1], k[2], k[3] || 0);
        gl.uniform1f(u('uScrPower'), s.power ?? 1);
        gl.uniform1f(u('uScrLit'), s.lit ? 1 : 0);
      }
    }

    function drawWith(mesh, model, m) {
      use(P.mesh);
      const u = P.mesh.u, alpha = m.alpha ?? 1, reflect = frame.mirror ? (m.reflect ?? .7) : 0;
      gl.uniformMatrix4fv(u('uM'), false, model);
      gl.uniform1f(u('uInflate'), 0);
      gl.uniform1f(u('uFlat'), 0);
      gl.uniform1f(u('uAlpha'), alpha);
      gl.uniform1f(u('uReflect'), reflect);
      setMaterial(u, m);
      const blended = alpha < 1 || reflect > 0;
      if (blended) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(!!m.depthWrite); }
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
      if (blended) { gl.disable(gl.BLEND); gl.depthMask(true); }
      if (m.outline && !frame.mirror) {
        const pixel = 2 * Math.tan(frame.fov / 2) / frame.h;
        const thickness = m.outline * pixel * Math.max(.05, v3.dist(frame.eye, origin(model)));
        let hull = model, inflate = thickness;
        if (!mesh.smooth) {
          const b = mesh.bounds, c = b.center, k = [0, 1, 2].map(a => {
            const axis = Math.hypot(model[a * 4], model[a * 4 + 1], model[a * 4 + 2]), world = b.size[a] * axis;
            return world > 1e-4 ? (world + 2 * thickness) / world : 1;
          });
          hull = chain(model, T(c[0], c[1], c[2]), S(k[0], k[1], k[2]), T(-c[0], -c[1], -c[2]));
          inflate = 0;
        }
        gl.uniformMatrix4fv(u('uM'), false, hull);
        gl.uniform1f(u('uInflate'), inflate);
        gl.uniform1f(u('uFlat'), 1);
        gl.uniform3fv(u('uBase'), m.outlineColor || DARK);
        gl.uniform1f(u('uAlpha'), 1);
        gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
        gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
        gl.disable(gl.CULL_FACE);
      }
    }

    /** Draws a static geometry (uploaded once) with a toon material. */
    function draw(g, model, m = {}) { drawWith(meshOf(g), model, m); }
    /** Draws geometry rebuilt this frame (ribbons and other moving shapes). */
    function drawDynamic(g, model, m = {}) { drawWith(upload(g, gl.DYNAMIC_DRAW, dynamicMesh), model, m); }

    /** A soft volumetric light cone from `apex` along `dir`. */
    function beam(apex, dir, length, radius, color, intensity = 1) {
      const y = v3.scale(v3.norm(dir), -1);
      let x = v3.cross(y, [0, 0, 1]);
      if (v3.len(x) < 1e-3) x = v3.cross(y, [1, 0, 0]);
      x = v3.norm(x);
      const z = v3.cross(x, y);
      const model = basis(v3.scale(x, radius), v3.scale(y, length), v3.scale(z, radius), apex);
      const nm = new Float32Array([...v3.scale(x, 1 / radius), ...v3.scale(y, 1 / length), ...v3.scale(z, 1 / radius)]);
      use(P.beam);
      const u = P.beam.u;
      gl.uniformMatrix4fv(u('uM'), false, model);
      gl.uniformMatrix3fv(u('uNM'), false, nm);
      gl.uniform3fv(u('uColor'), color);
      gl.uniform1f(u('uIntensity'), intensity);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.bindVertexArray(meshOf(coneGeo).vao);
      gl.drawElements(gl.TRIANGLES, meshOf(coneGeo).count, gl.UNSIGNED_INT, 0);
      gl.disable(gl.BLEND); gl.depthMask(true);
    }

    const KINDS = { glow: 0, sparkle: 1, confetti: 2, disc: 3, petal: 4, bokeh: 5 };
    /** Point sprites; `data` holds 9 floats each: x, y, z, r, g, b, a, size (world units), rotation. */
    function points(data, count, kind = 'glow', additive = true) {
      if (!count) return;
      use(P.point);
      const u = P.point.u;
      gl.uniform1f(u('uScale'), frame.h / (2 * Math.tan(frame.fov / 2)));
      gl.uniform1f(u('uMax'), maxPoint);
      gl.uniform1f(u('uKind'), KINDS[kind] ?? 0);
      gl.uniform1f(u('uAdd'), additive ? 1 : 0);
      gl.bindVertexArray(pointVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * 9), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND);
      if (additive) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND); gl.depthMask(true);
    }

    /** Lettering quads, already sorted back to front: 14 floats per corner
     *  (x, y, z, u, v, fill rgba, edge rgb, edge-only flag), 4 corners per quad. */
    function text(data, quads, overlay = false) {
      if (!quads || !atlasTex) return;
      if (overlay) gl.disable(gl.DEPTH_TEST);
      if (atlasDirty) { gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.generateMipmap(gl.TEXTURE_2D); atlasDirty = false; }
      use(P.glyph);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.uniform1i(P.glyph.u('uAtlas'), 0);
      gl.bindVertexArray(glyphVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, glyphBuffer);
      const count = Math.min(quads, MAX_QUADS);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * 4 * GLYPH_FLOATS), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_INT, 0);
      gl.disable(gl.BLEND); gl.depthMask(true);
      if (overlay) gl.enable(gl.DEPTH_TEST);
    }

    function quad(prog, target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
      use(prog);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /** Resolves the frame and applies bloom and the anime finishing pass. */
    function end(o = {}) {
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
      if (targets.msaa) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, targets.msaa);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, targets.scene.fbo);
        gl.blitFramebuffer(0, 0, frame.w, frame.h, 0, 0, frame.w, frame.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      }
      const { scene, bloomA, bloomB } = targets;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.tex);
      use(P.bright);
      gl.uniform1i(P.bright.u('uTex'), 0);
      gl.uniform2f(P.bright.u('uTexel'), 1 / frame.w, 1 / frame.h);
      gl.uniform1f(P.bright.u('uThreshold'), o.threshold ?? .62);
      quad(P.bright, bloomA);
      for (const radius of [1, 2.2]) {
        gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
        use(P.blur); gl.uniform1i(P.blur.u('uTex'), 0);
        gl.uniform2f(P.blur.u('uDir'), radius / bloomA.w, 0);
        quad(P.blur, bloomB);
        gl.bindTexture(gl.TEXTURE_2D, bloomB.tex);
        gl.uniform2f(P.blur.u('uDir'), 0, radius / bloomA.h);
        quad(P.blur, bloomA);
      }
      use(P.composite);
      const u = P.composite.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex); gl.uniform1i(u('uScene'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomA.tex); gl.uniform1i(u('uBloom'), 1);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
      gl.uniform2fv(u('uFocus'), o.focus || [.5, .5]);
      gl.uniform1f(u('uBloomAmt'), o.bloom ?? .8);
      gl.uniform1f(u('uSpeed'), o.speedLines || 0);
      gl.uniform1f(u('uFlash'), o.flash || 0);
      gl.uniform3fv(u('uFlashColor'), o.flashColor || [1, 1, 1]);
      gl.uniform1f(u('uAberr'), o.aberration || 0);
      gl.uniform1f(u('uLetter'), o.letterbox || 0);
      gl.uniform1f(u('uVignette'), o.vignette ?? .5);
      gl.uniform1f(u('uInvert'), o.invert || 0);
      gl.uniform1f(u('uTime'), o.time || 0);
      gl.uniform1f(u('uGrain'), o.grain ?? .03);
      gl.uniform1f(u('uSat'), o.saturation ?? 1);
      gl.uniform1f(u('uExposure'), o.exposure ?? 1);
      gl.uniform3fv(u('uTint'), o.tint || [1, 1, 1]);
      gl.uniform3fv(u('uLift'), o.lift || [0, 0, 0]);
      gl.uniform1f(u('uStatic'), o.static || 0);
      gl.uniform1f(u('uScan'), o.scanlines || 0);
      quad(P.composite, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.depthMask(true);
    }

    function dispose() {
      freeTargets();
      for (const m of owned) { gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.pb); gl.deleteBuffer(m.nb); gl.deleteBuffer(m.ib); }
      for (const prog of Object.values(P)) gl.deleteProgram(prog.p);
      if (atlasTex) gl.deleteTexture(atlasTex);
      gl.deleteBuffer(glyphBuffer); gl.deleteBuffer(glyphIndex);
    }

    return Object.freeze({
      gl, begin, camera, lights, mirror, sky, draw, drawDynamic, beam, points, text, glyph, resetGlyphs, end, dispose,
      get glyphEpoch() { return glyphEpoch; },
      lost: () => gl.isContextLost(),
      get eye() { return frame.eye.slice(); },
      project(p) {
        const m = frame.baseVp, x = apply(m, p), w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
        return w > 0 ? [(x[0] / w + 1) / 2, (x[1] / w + 1) / 2, w] : null;
      },
    });
  }

  return Object.freeze({
    TAU, v3, ident, mul, chain, T, S, RX, RY, RZ, apply, applyDir, origin, basis, perspective, lookAt, invert,
    box, lathe, sphere, cylinder, torus, plane, extrude, drape, cone, merge, ribbon, tube, createRenderer,
  });
});
