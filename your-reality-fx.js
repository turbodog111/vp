// A recording-specific letter: the nib and the ink follow the same actual lyric strokes.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const set = typeof module === 'object' && module.exports ? require('./reality-set.js') : root.RealitySet;
  const hand = typeof module === 'object' && module.exports ? require('./reality-manuscript.js') : root.RealityManuscript;
  const score = typeof module === 'object' && module.exports ? require('./reality-score.js') : root.RealityScore;
  const api = factory(kit,set,hand,score);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RealityLetterFx = api;
})(typeof window === 'object' ? window : globalThis, (kit,set,hand,score) => {
  'use strict';

  const { TAU, clamp, mix, ease, easeOut, fract, hash, rgba, blend, linear, radial, vignette } = kit;
  const INK = '#39404f', PINK = '#ae4c70', WAX = '#952c4d';
  // Light colour through the afternoon (fraction of the song → colour).
  const DAYLIGHT = [[0, '#fff3da'], [.5, '#ffe4b4'], [.76, '#ffcaa6'], [.9, '#f4b9b6'], [1, '#bcc6f2']];


  /** 1 inside a sung line, falling to 0 over 2.5 s away from one. */
  function voiceNear(P, t) {
    if (!P) return 0;
    let gap = Infinity;
    for (const line of P.lines) {
      if (t >= line.start && t <= line.end) return 1;
      gap = Math.min(gap, Math.abs(t - (t < line.start ? line.start : line.end)));
    }
    return clamp(1 - gap / 2.5);
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


  function drawPen(c, pen, g, tap, tool) {
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
    if(tool==='pencil' || tool==='marker'){
      const pencil=tool==='pencil', width=pencil?3.8:5.7;
      const wood=linear(c,-width,0,width,0,pencil?[[0,'#673d26'],[.27,'#d99743'],[.64,'#eab962'],[.67,'#b27c39'],[1,'#785335']]:[[0,'#332b3f'],[.30,'#675671'],[.4,'#82748c'],[.6,'#504359'],[1,'#302735']]);
      c.fillStyle=wood;c.fillRect(-width,-70,2*width,56);
      c.fillStyle=pencil?'#c5b39a':'#ded6cb';c.fillRect(-width,-71,2*width,5);
      c.fillStyle=pencil?'#bf7f7f':'#423c4e';c.fillRect(-width,-77,2*width,6);
      c.beginPath();c.moveTo(-width,-14);c.lineTo(width,-14);c.lineTo(1.3,-2);c.lineTo(-1,-2);c.closePath();
      c.fillStyle=pencil?'#dab38b':'#d9c8ba';c.fill();c.beginPath();c.moveTo(-1.3,-4);c.lineTo(1.55,-4);c.lineTo(.3,.35);c.lineTo(-.5,0);c.closePath();c.fillStyle=pencil?'#322d2c':'#4b2e46';c.fill();
      c.restore();return;
    }
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
    const r = g.xh * 1.08, x = g.pw*.81, cy = g.ph*.77;
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

  function drawPaper(c, w, h, g, day, beat, t, P, still, key) {
    const { pw, ph, unit } = g;
    for(let i=4;i>0;i--){c.fillStyle='rgba(35,24,23,.105)';c.fillRect(unit*(3+i*1.3),unit*(3+i*1.8),pw,ph);}
    for(let i=3;i>0;i--){
      c.save(); c.rotate(-i*.0048);c.translate(-unit*i,unit*i*1.2);
      c.fillStyle=i%2?'#d9c7a9':'#efdfc2';c.fillRect(0,0,pw,ph);c.restore();
    }
    set.paper(c,pw,ph);
    const stock={'your-reality-kamex':'rgba(126,153,205,.23)','your-reality-ink-static':'rgba(148,202,185,.18)','your-reality-cement-city':'rgba(233,179,96,.21)'};
    if(stock[key]){c.fillStyle=stock[key];c.fillRect(0,0,pw,ph);}
    if(key==='your-reality-caleb-hyles' || key==='your-reality-pop-punk'){
      c.beginPath();c.moveTo(pw*.077,0);c.lineTo(pw*.077,ph);c.strokeStyle='#ce9692';c.lineWidth=unit;c.stroke();
      for(let n=0;n<7;n++){
        const y=ph*(.12+n*.122);
        c.beginPath();c.ellipse(pw*.036,y,unit*3.7,unit*4.2,0,0,TAU);c.fillStyle='#69564a';c.fill();
        c.beginPath();c.ellipse(-unit*.7,y-unit*2,pw*.038,unit*4.6,.08,Math.PI*.7,Math.PI*2.06);
        c.strokeStyle='#5c5050';c.lineWidth=unit*2.3;c.stroke();
      }
    }
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
    if (P && !still) for (let i = 0; i < 6; i++) {
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

  function drawKeyboard(c,w,h,pressed) {
    // Three fixed, chromatic octaves: never transpose an out-of-range pitch onto a visible key.
    const key=Math.min(w*.030,h*.043), kh=key*3.1;
    c.save(); c.translate(w * .035, h + 2); c.rotate(-.038);
    c.fillStyle = linear(c,0,-kh-key*.28,0,-kh,[[0,'#9e7650'],[.28,'#493835'],[.65,'#714539'],[1,'#262328']]); c.fillRect(-3,-kh-key*.28,key*21+6,kh+key*1.3);
    const ivory=linear(c,0,-kh,0,key*.32,[[0,'#aca195'],[.1,'#d5c9b4'],[.36,'#f3ead4'],[.88,'#faf4df'],[1,'#c5b89d']]);
    const ebony=linear(c,0,-kh,0,-kh*.4,[[0,'#242629'],[.64,'#35363b'],[.79,'#49464a'],[.95,'#27252a'],[1,'#13161c']]);
    for (let k = 0; k < 21; k++) {
      const down = pressed.get(score.keyMidi(k))||0;
      c.fillStyle = ivory; c.fillRect(k*key+1,-kh+down*key*.15,key-1,kh+key);
      if(down){c.fillStyle=rgba('#846e65',down*.43);c.fillRect(k*key+1,-kh+down*key*.15,key-1,kh+key);}
    }
    for (let k = 0; k < 21; k++) if (score.keyMidi(k,true)!==null) {
      const x=(k+.73)*key, down=pressed.get(score.keyMidi(k,true))||0;
      c.fillStyle='rgba(40,30,34,.32)';c.fillRect(x+key*.1,-kh+key*.13,key*.6,kh*.57);
      c.fillStyle=ebony;c.fillRect(x,-kh+key*.13*down,key*.55,kh*.57);
      c.fillStyle=down?'#b99279':'#716765';c.fillRect(x+key*.05,-kh+1+key*.13*down,Math.max(1,key*.07),kh*.50);
    }
    c.fillStyle='#803f4a';c.fillRect(0,-kh-key*.045,key*21,key*.077);
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
    const t = still ? 27.2 : Math.max(0, m.time), duration=m.duration||181.7;
    const style=hand.style(m.variant);
    const P=(!still && m.manuscript!==false) ? hand.plan(m.vocal,style[0]) : null;
    const g=hand.geometry(w,h,P);
    const day = still ? .3 : clamp(t / duration);
    const lift = still ? 0 : m.lift || 0, pulse = still ? 0 : m.pulse || 0, beats = still ? 12 : m.beats || 0;
    const voice = voiceNear(P, t);

    set.desk(c,w,h);
    const minor=m.variant==='your-reality-kamex', electronic=minor||m.variant==='your-reality-cement-city'||m.variant==='your-reality-ink-static';
    c.fillStyle=rgba(minor?'#263455':'#413456',minor?.32:.19*ease((day-.58)/.42));c.fillRect(0,0,w,h);

    const tilt=-.038+(still?0:Math.sin(t*.045)*.003), cy=h*(w<h?.585:.557);
    c.save(); c.translate(w * .525, cy); c.rotate(tilt); c.translate(-g.pw / 2, -g.ph / 2);
    drawPaper(c,w,h,g,day,beats,t,P,still,m.variant);
    const turn=hand.write(c,P,t,g,style);
    pageTurn(c,g,turn);
    if(P)drawSeal(c,P,t,g);
    c.restore();

    // The window light: dim at the start, brighter in the choruses and while the piano plays alone.
    const glow = (.19 + .09 * lift + .025 * pulse + .06 * (1 - voice)) * ease(.52 + t / 5) * (1 - .5 * ease((day - .88) / .12));
    windowLight(c, w, h, t, day, glow, .6 + lift * .9, still);

    c.save(); c.translate(w * .525, cy); c.rotate(tilt); c.translate(-g.pw / 2, -g.ph / 2);
    const pen = hand.nib(P,t,g);
    // At rest during a long instrumental, the pen taps along with the beat.
    drawPen(c,pen,g,pen.lift>.9 && voice<.5 ? pulse : 0,style[4]);
    c.restore();

    set.inkwell(c,w,h);
    if (electronic) drawTape(c,w,h,beats,still?.35:m.energy||0,minor);
    else drawKeyboard(c,w,h,still?new Map():score.keys(m.data,t));
    c.fillStyle=linear(c,0,0,0,h*.25,[[0,'rgba(48,34,31,.33)'],[.46,'rgba(48,34,31,.20)'],[1,'rgba(48,34,31,0)']]);
    c.fillRect(0,0,w,h*.25);
    vignette(c, w, h, '#3b3d68', .06 + .22 * ease((day - .8) / .2));
    return !!P;
  }

  return Object.freeze({draw,plan:hand.plan,inkAmount:hand.inkAmount,penAt:(v,t,w=1280,h=720)=>{
    const p=hand.plan(v);return hand.nib(p,t,hand.geometry(w,h,p));
  }});
});
