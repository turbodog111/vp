// Rena's arrangement: a letter opens into a concert hall built from tuned metal.
// The hall breathes with the recording: fog drifts across the floor, light falls from the
// rose window, candles and embers burn, and the organ pipes sound on the measured bass hits.
// Along the floor a score scrolls past a playhead: a bar line crosses it on every downbeat and
// a note crosses it as each word is sung (held notes trail a bar of light), in the same
// colours as the sung lyric words. Note heights are decorative; their timing is measured.
// When the last line ends the lights go down and the candles are left burning.
// Every frame is a pure function of media time. Original imagery; no lyrics are drawn.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const set = typeof module === 'object' && module.exports ? require('./reality-set.js') : root.RealitySet;
  const fx = factory(kit,set);
  if (typeof module === 'object' && module.exports) module.exports = fx;
  else root.RealityMetalFx = fx;
})(typeof window === 'object' ? window : globalThis, (kit,set) => {
  'use strict';
  const { hash, hash2, sample, linear, radial, rgba, blend, mix, easeOut } = kit;
  const tau = Math.PI * 2;
  const unit = x => Math.max(0, Math.min(1, x));
  const smooth = x => { const y = unit(x); return y * y * (3 - 2 * y); };
  const ramp = (t, inTime, outTime) => smooth((t - inTime) / (outTime - inTime));
  const band = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));
  // The sung-lyric colours from the stage stylesheet: waiting, singing, sung.
  const WAITING = '#d7cbd3', SINGING = '#fff3ce', SUNG = '#ff9eac';
  const LEAD = 4.5;      // seconds of score visible ahead of the playhead

  function arrangement(time) {
    return {
      tutti: band(time, 48.8, 51.3, 155.3, 158.8),
      solo: band(time, 94.9, 97.8, 113.4, 116.2),
      peak: band(time, 135.4, 138.3, 153.7, 157.4),
      tail: ramp(time, 159.8, 165.4)
    };
  }
  function path(c, fill, ...points) {
    c.beginPath(); c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath(); c.fillStyle = fill; c.fill();
  }
  function line(c, color, width) {
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  function peak(data, key, t0, t1) {
    let best = 0;
    for (let t = t0; t <= t1 + 1e-9; t += .04) best = Math.max(best, sample(data, key, t));
    return best;
  }

  // MARK: the singer's timing

  const scores = new WeakMap();
  /** One note per sung word. */
  function score(vocal) {
    let notes = scores.get(vocal);
    if (!notes) {
      notes = [];
      vocal.lines.forEach((ln, li) => ln.words.forEach((word, wi) => {
        const contour = 4 + 3.2 * Math.sin(li * 1.9 + wi * .83) + (hash2(li + 1, wi + 1) - .5) * 2.4;
        notes.push({ start: word.start, end: word.end, held: word.end - word.start > .85,
          pos: Math.max(-1, Math.min(9, Math.round(contour))) });
      }));
      scores.set(vocal, notes);
    }
    return notes;
  }
  /** 1 while a word is being sung, easing off over a third of a second after it. */
  function voiceAt(vocal, t) {
    if (!vocal) return 0;
    let level = 0;
    for (const ln of vocal.lines) {
      if (t < ln.start - .05) break;
      if (t > ln.end + .35) continue;
      for (const word of ln.words) {
        if (t >= word.start && t < word.end) return 1;
        if (t >= word.end && t < word.end + .35) level = Math.max(level, 1 - (t - word.end) / .35);
      }
    }
    return level;
  }

  // MARK: architecture

  function pane(c, radius, color, rim) {
    c.beginPath(); c.moveTo(0, -radius);
    c.bezierCurveTo(radius*.28,-radius*.69, radius*.17,-radius*.43, 0,-radius*.30);
    c.bezierCurveTo(-radius*.17,-radius*.43,-radius*.28,-radius*.69,0,-radius);
    c.fillStyle = color; c.fill(); line(c, rim, Math.max(.8, radius*.011));
  }
  function roseWindow(c, x, y, r, turn, open, light, voice, glint) {
    if(set.glass(c,x,y,r*1.08,unit(light+voice*.09),glint))return;
    c.save(); c.translate(x, y);
    c.fillStyle = '#181622'; c.beginPath(); c.arc(0,0,r*1.08,0,tau); c.fill();
    for (const [radius, edge, width] of [[1.08,'#987d80',.015],[1.035,'#453847',.032],[1,'#d1adb2',.011]]) {
      c.beginPath(); c.arc(0,0,r*radius,0,tau); line(c,edge,Math.max(.8,r*width));
    }
    // A glint runs once round the rim in every bar.
    c.beginPath(); c.arc(0,0,r*1.035,glint-.35,glint+.35); line(c,`rgba(255,214,180,${(.18+.4*light).toFixed(3)})`,Math.max(1,r*.03));
    // The glass stays in the masonry. The light moves through its leaded facets.
    const glass=['#d97672','#dca55d','#824467','#bc465c','#7f92a0','#be6a76'];
    for (let i=0; i<12; i++) {
      c.save(); c.rotate(i*tau/12);
      pane(c,r*.89,i%2 ? '#9c304d' : '#c95c69','#402733');
      for(let j=0;j<3;j++){
        const y0=-r*(.38+j*.148),y1=y0-r*.139,wide=r*(j===2?.045:.077);
        const warm=unit(.16+light*.41+Math.sin(i*.52+j*.6+turn*10)*.16);
        path(c,blend(glass[(i+j*2)%glass.length],'#fff0bd',warm),0,y0,wide,y0-r*.068,0,y1,-wide,y0-r*.068);
        c.beginPath();c.moveTo(-wide*.65,y0-r*.058);c.lineTo(.8,y0-r*.019);line(c,'rgba(255,222,172,.58)',Math.max(.65,r*.008));
      }
      c.beginPath();c.arc(0,-r*.89,r*.048,0,tau);c.fillStyle=blend('#685766','#efc388',.32+open*.4);c.fill();
      c.restore();
    }
    // A split pen nib takes the place of the central boss; it glows while she sings.
    if (voice > 0) { c.beginPath(); c.arc(0,0,r*.42,0,tau); c.fillStyle=rgba('#ffd9a0',.28*voice); c.fill(); }
    c.beginPath(); c.arc(0,0,r*.29,0,tau); c.fillStyle='#24202b'; c.fill();
    path(c,blend('#f4dbb6','#fff6dc',voice),0,-r*.26,r*.15,-r*.02,r*.083,r*.19,-r*.083,r*.19,-r*.15,-r*.02);
    c.beginPath(); c.moveTo(0,-r*.26); c.lineTo(0,r*.015); line(c,'#413341',Math.max(1,r*.019));
    c.beginPath(); c.arc(0,r*.02,r*.029,0,tau); c.fillStyle='#413341'; c.fill();
    c.restore();
  }
  /** Shafts of coloured light falling from the rose window, behind everything else. */
  function windowRays(c, w, h, x, y, b, level, still) {
    if (level <= .01) return;
    const reach = Math.hypot(w, h);
    // Each shaft is drawn wide and faint, then narrow, so its edges are soft.
    for (const [widen, strength] of [[2.2, .45], [1, .55]]) {
      c.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (.24 + i * .087 + (hash(i + 1) - .5) * .03) + (still ? 0 : Math.sin(b * Math.PI / 32 + i * 1.7) * .035);
        const spread = (.012 + hash(i + 5) * .028) * widen;
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a - spread) * reach, y + Math.sin(a - spread) * reach);
        c.lineTo(x + Math.cos(a + spread) * reach, y + Math.sin(a + spread) * reach);
        c.closePath();
      }
      c.fillStyle = radial(c, x, y, h * .9, [[0, rgba('#ffc9a6', .3 * level * strength)], [.3, rgba('#f07f82', .13 * level * strength)],
        [.6, rgba('#c9435d', .06 * level * strength)], [1, rgba('#c9435d', 0)]]);
      c.fill();
    }
  }
  function rank(c, w, h, side, drive, beats, hit, pulses) {
    c.save(); if (side === 1) { c.translate(w,0); c.scale(-1,1); }
    const step = Math.min(w*.031, h*.056);
    // The casing opens on pivot points, but each pipe remains a rigid, fluted tube.
    c.translate(-step*.42,0);
    for (let i=0; i<7; i++) {
      const x = step*(i-.32), width = step*.91, base = h*(.80+i*.018);
      const top = h*(.055 + i*.036);
      const mouth = base - (base-top)*.27, glint = (1+Math.cos(i*.95-beats*Math.PI/2))/2;
      const metal = c.createLinearGradient(x,0,x+width,0);
      metal.addColorStop(0,'#161b27'); metal.addColorStop(.10,'#50515f');
      metal.addColorStop(.21,'#bab1aa'); metal.addColorStop(.245,'#ebd5bd');metal.addColorStop(.30,'#716971');
      metal.addColorStop(.38,blend('#575967','#e9b19f',glint*drive));
      metal.addColorStop(.58,'#363947');metal.addColorStop(.79,'#23232c');metal.addColorStop(.88,'#917977');metal.addColorStop(1,'#24232e');
      path(c,metal,x,top+width*.42,x+width,top,x+width,base,x,base);
      // A bass hit sends a band of light up the pipe from its mouth, outer pipes first.
      for (const p of pulses) {
        const u = p.u - i * .04;
        if (u <= 0 || u >= 1) continue;
        const y = mouth - (mouth - top) * u, a = p.a * (1 - u);
        c.fillStyle = `rgba(255,150,110,${(a*.35).toFixed(3)})`;
        c.fillRect(x+width*.1, y-width*1.6, width*.74, width*3.2);
        c.fillStyle = `rgba(255,196,150,${(a*.7).toFixed(3)})`;
        c.fillRect(x+width*.22, y-width*.45, width*.5, width*.9);
      }
      path(c,'#100f19',x,top+width*.42,x+width*.95,top,x+width*.8,top+width*.29,x+width*.1,top+width*.55);
      c.beginPath(); c.moveTo(x+width*.08,top+width*.42); c.lineTo(x+width,top);
      line(c,'#d9b8b3',Math.max(1,width*.045));
      path(c,'#191521',x+width*.16,mouth,x+width*.50,mouth-width*.59,x+width*.82,mouth,x+width*.82,mouth+width*.20,x+width*.16,mouth+width*.20);
      c.fillStyle=`rgba(255,160,102,${.18+.68*glint*hit})`; c.fillRect(x+width*.18,mouth+width*.12,width*.62,Math.max(1,width*.08));
    }
    c.restore();
  }

  // MARK: floor

  /** Low fog in three layers, drifting at different speeds and lit by the rake lights. */
  function fog(c, w, h, t, drive, tail) {
    const lit = blend('#3b2739', '#a43c50', drive * .6);
    for (let layer = 0; layer < 3; layer++) {
      const top = h * (.66 + layer * .085), amp = h * (.018 + layer * .008) * (1 - tail * .5);
      const drift = t * (.05 + layer * .035) + layer * 2.1;
      c.beginPath(); c.moveTo(-w * .05, h);
      for (let n = 0; n <= 24; n++) {
        const u = n / 24;
        c.lineTo(u * w * 1.1 - w * .05, top + Math.sin(u * 7.1 + drift * 2.3) * amp + Math.sin(u * 13.3 - drift * 1.4) * amp * .45);
      }
      c.lineTo(w * 1.05, h); c.closePath();
      const g = c.createLinearGradient(0, top - amp, 0, h);
      g.addColorStop(0, rgba(lit, 0)); g.addColorStop(.4, rgba(lit, (.13 + .08 * layer) * (.55 + .45 * drive)));
      g.addColorStop(1, rgba(lit, (.2 + .09 * layer) * (.55 + .45 * drive)));
      c.fillStyle = g; c.fill();
    }
  }
  /** A row of candles below the window; they are what is left burning at the end. */
  function candles(c, w, h, t, level, still) {
    const size = Math.min(w, h) * .011, y = h * .745;
    for (let i = 0; i < 14; i++) {
      const x = w * (.1 + i * .0615) + (hash(i + 2) - .5) * w * .02, yy = y + (hash(i + 9) - .5) * h * .02;
      const flick = still ? 1 : 1 + .14 * Math.sin(t * 11 + i * 3.7) + .08 * Math.sin(t * 17.3 + i);
      c.fillStyle = radial(c, x, yy - size * 1.3, size * 3.6, [[0, rgba('#ffb877', .2 * level * flick)], [.5, rgba('#ff9a6a', .06 * level)], [1, rgba('#ff9a6a', 0)]]);
      c.beginPath(); c.arc(x, yy - size * 1.3, size * 3.6, 0, tau); c.fill();
      c.fillStyle = rgba('#dccbb4', .55 * level); c.fillRect(x - size * .28, yy - size * .3, size * .56, size * 1.6);
      c.save(); c.translate(x, yy - size * .45); c.scale(1, flick);
      c.beginPath(); c.moveTo(0, -size * 1.7);
      c.quadraticCurveTo(size * .55, -size * .55, 0, 0); c.quadraticCurveTo(-size * .55, -size * .55, 0, -size * 1.7);
      c.fillStyle = rgba('#ffd38f', .9 * level); c.fill();
      c.restore();
    }
  }
  /** Embers rising from the stage; brighter as the band drives harder. */
  function embers(c, w, h, t, drive, tail) {
    const size = Math.max(1, Math.min(w, h) / 320);
    for (let i = 0; i < 26; i++) {
      const speed = .045 + hash(i + 31) * .05, life = (t * speed + hash(i + 17)) % 1;
      const x = w * (.04 + hash(i + 3) * .92) + Math.sin(t * .9 + i) * w * .015 + (hash(i + 43) - .5) * w * .06 * life;
      const y = h * (1.02 - life * 1.05);
      const alpha = Math.sin(life * Math.PI) * (.18 + .55 * drive) * (1 - tail * .8) * (.7 + .3 * Math.sin(t * 9 + i * 2.3));
      if (alpha <= .01) continue;
      const d = size * (1 + hash(i + 7));
      c.fillStyle = rgba(i % 3 ? '#ffb27a' : '#ff8a8e', alpha);
      c.fillRect(x, y, d, d);
    }
  }

  // MARK: score

  function staffY(w, h, x, k, b, drive, hit, solo) {
    const u = x / w, tether = Math.sin(Math.max(0, Math.min(1, u)) * Math.PI);
    const vibration = (Math.sin(u*tau*(2+solo) + b*Math.PI/2 + k*.14)*.011 + Math.sin(u*tau*5 - b*Math.PI)*.004*hit) * tether * drive;
    return h * (.862 + (k - 2) * .017 - .05 * (1 - tether) ** 2 + vibration);
  }
  function scoreLines(c, w, h, b, drive, hit, solo, tail) {
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      for (let n = 0; n <= 40; n++) {
        const x = n / 40 * w, y = staffY(w, h, x, k, b, drive, hit, solo);
        if (n) c.lineTo(x, y); else c.moveTo(x, y);
      }
      line(c, k % 2 ? `rgba(190,135,132,${(.85-.4*tail).toFixed(3)})` : `rgba(168,170,181,${(.85-.4*tail).toFixed(3)})`, Math.max(.8, h * .0019));
    }
    // Independent bow strokes travel to the vanishing point and fade; no particle emitter.
    const travel = (b * .25) % 1;
    for (let j=0;j<3;j++) {
      const u=(travel+j/3)%1, a=(1-u)*drive;
      for (const sign of [-1,1]) {
        const xx=w*(.5+sign*(.16+u*.43)), yy=h*(.86-u*.74);
        c.beginPath(); c.moveTo(xx+sign*w*.09, yy-h*.05);
        c.quadraticCurveTo(xx+sign*w*.028,yy,xx+sign*w*.018,yy+h*.1);
        line(c,`rgba(255,145,128,${(a*.66).toFixed(3)})`,Math.max(1,h*.004)*(1-u*.6));
      }
    }
  }
  /** Bar lines on the measured downbeats and one note per sung word, scrolling past a playhead. */
  function scoreNotes(c, w, h, m, sec, b, drive, hit, solo, voice) {
    // Narrow stages scroll faster so neighbouring notes do not overlap.
    const play = w * .5, speed = Math.max(w / (LEAD * 2), h * .1), lead = play / speed, gap = h * .017;
    const at = time => play + (time - sec) * speed;
    const lineY = (x, k) => staffY(w, h, x, k, b, drive, hit, solo);
    const top = lineY(play, 0) - gap * 2, bottom = lineY(play, 4) + gap * 2;
    const head = c.createLinearGradient(0, top, 0, bottom);
    head.addColorStop(0, rgba(SINGING, 0)); head.addColorStop(.5, rgba(SINGING, .22 + .4 * voice)); head.addColorStop(1, rgba(SINGING, 0));
    c.fillStyle = head; c.fillRect(play - Math.max(1, w * .0012), top, Math.max(2, w * .0024), bottom - top);
    const offset = m.data?.beatOffset ?? 0, bar = m.period * 4;
    if (bar > 0) for (let k = Math.ceil((sec - lead - offset) / bar); offset + k * bar <= sec + lead; k++) {
      const x = at(offset + k * bar);
      if (x < 0 || x > w) continue;
      const near = Math.max(0, 1 - Math.abs(x - play) / (w * .02));
      c.beginPath(); c.moveTo(x, lineY(x, 0)); c.lineTo(x, lineY(x, 4));
      line(c, rgba(near ? SINGING : '#b6a4b0', .22 + .5 * near), Math.max(1, h * (.0018 + .002 * near)));
    }
    if (!m.vocal) return;
    for (const note of score(m.vocal)) {
      if (note.end < sec - lead || note.start > sec + lead) continue;
      const x = at(note.start), tailX = at(note.end);
      const y = lineY(x, 4) - note.pos * gap / 2;
      const singing = sec >= note.start && sec < note.end, past = sec >= note.end;
      const fadeIn = Math.min(1, (w - x) / (w * .08)), fadeOut = past ? Math.max(0, 1 - (sec - note.end) / lead) : 1;
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut)) * (singing ? 1 : past ? .8 : .6);
      if (alpha <= .01) continue;
      const color = singing ? SINGING : past ? SUNG : WAITING;
      if (note.end - note.start > .35) {
        c.beginPath(); c.moveTo(x, y); c.lineTo(Math.min(tailX, w), y);
        line(c, rgba(color, alpha * .45), gap * .38);
      }
      if (singing) { c.beginPath(); c.arc(x, y, gap * 1.5, 0, tau); c.fillStyle = rgba('#ffd9a0', .22); c.fill(); }
      c.beginPath(); c.ellipse(x, y, gap * .64, gap * .45, -.35, 0, tau);
      if (note.held) { c.fillStyle = rgba('#1a1520', alpha); c.fill(); line(c, rgba(color, alpha), gap * .2); }
      else { c.fillStyle = rgba(color, alpha); c.fill(); }
      const up = note.pos < 4, sx = x + (up ? gap * .58 : -gap * .58);
      c.beginPath(); c.moveTo(sx, y); c.lineTo(sx, y + (up ? -gap * 3.2 : gap * 3.2));
      line(c, rgba(color, alpha), Math.max(1, gap * .11));
    }
  }

  // MARK: guitar

  function guitarBreak(c,w,h,level,b,hit,still,sparks,blue) {
    if (level<=0) return;
    const size=Math.min(w/460,h/352), x=w*.49, y=h*(.68+(1-level)*.43);
    c.save(); c.globalAlpha=level;
    for (const sign of [-1,1]) {
      const u=.04*Math.sin(b*Math.PI/9+sign);
      set.shaft(c,w*(.5+sign*.31),h*.018,w*(.5-sign*(.07+u)),h*.869,h*.125,level*(.78+.13*hit),sign>0?'#efc992':blue?'#9fbde5':'#dd8793');
    }
    c.beginPath();c.ellipse(x+w*.018,h*.914,size*92,size*7,0,0,tau);c.fillStyle='rgba(17,16,23,.36)';c.fill();
    if(blue){
      const bx=x-size*73,by=h*.835;
      c.fillStyle=linear(c,bx,by-size*38,bx+size*72,by,[[0,'#585154'],[.075,'#232631'],[.92,'#1e2029'],[1,'#685f59']]);
      c.fillRect(bx,by-size*42,size*63,size*42);
      c.fillStyle='#918571';c.fillRect(bx+size*3,by-size*39,size*57,size*6);
      c.beginPath();
      for(let i=0;i<8;i++){c.moveTo(bx+size*4,by-size*(5+i*3.3));c.lineTo(bx+size*59,by-size*(5+i*3.3));}
      line(c,'#535257',size*.8);
      for(let i=0;i<5;i++){c.beginPath();c.arc(bx+size*(8+i*5),by-size*36,size*1.35,0,tau);c.fillStyle='#343238';c.fill();}
      c.beginPath();c.moveTo(bx+size*56,by-size*35);c.bezierCurveTo(bx+size*68,by+size*38,x-size*10,by+size*27,x+size*28,y+size*46);
      line(c,'#151921',size*2);
    }
    c.translate(x,y); c.scale(size,size);
    c.rotate((blue?.61:.81)+.045*Math.sin(b*Math.PI/12)+hit*.012);
    const shape=()=>{ c.beginPath();
      if(blue){
        c.moveTo(-10,-18);c.bezierCurveTo(-21,-11,-28,-24,-28,-45);c.bezierCurveTo(-52,-27,-33,-2,-42,18);
        c.bezierCurveTo(-55,51,-53,80,-23,86);c.bezierCurveTo(2,91,43,82,46,58);
        c.bezierCurveTo(51,36,27,20,27,7);c.bezierCurveTo(26,-2,40,-17,30,-27);
        c.bezierCurveTo(26,-16,20,-10,10,-14);c.closePath();return;
      }
      c.moveTo(-13,-27); c.quadraticCurveTo(-19,-31,-23,-18);
      c.lineTo(-83,100); c.quadraticCurveTo(-84,106,-78,102); c.lineTo(-2,50);
      c.lineTo(61,90); c.quadraticCurveTo(68,93,65,85); c.lineTo(19,-21);
      c.quadraticCurveTo(16,-28,10,-27); c.closePath(); };
    c.save(); c.translate(3,6); shape(); c.fillStyle='#341f2b'; c.fill(); c.restore();
    const finish=c.createLinearGradient(-60,-12,52,68);
    const lacquer=blue?['#111b35','#293c79','#3b61a4','#b7cbdc','#7287bf','#303e82','#141e3e']:['#391f31','#933a4d','#ca595e','#e4a092','#cc7674','#96374d','#482534'];
    [0,.16,.38,.47,.485,.64,1].forEach((at,i)=>finish.addColorStop(at,lacquer[i]));
    shape(); c.fillStyle=finish; c.fill(); line(c,'#f1c1a1',1.5);
    c.save();shape();c.clip();c.beginPath();
    for(let i=0;i<27;i++){
      const xx=-82+i*6;c.moveTo(xx,-30);c.bezierCurveTo(xx+8,18,xx-10,49,xx+7,111);
    }line(c,'rgba(255,213,182,.16)',.7);c.restore();
    if(!blue){
      path(c,'#e3d1b7',-13,-17,11,-17,47,70,-2,39,-59,79);
      path(c,'#29232c',-10,-17,9,-17,35,54,-2,33,-42,60);
    }
    path(c,'#dfbb92',-10,-11,-6.5,-189,6.5,-189,10,-11);
    path(c,'#342731',-8.6,-10,-5.5,-189,5.5,-189,8.6,-10);
    for (let i=0;i<19;i++) {
      const d=1-Math.pow(2,-i/12), yy=-177+d*244, fret=5.6+(yy+177)*.015;
      c.fillStyle='#bdaba0'; c.fillRect(-fret,yy,fret*2,.85);
      if ([3,5,7,9,12,15,17].includes(i))
        path(c,'#dfd4c6',0,yy-2.5,2.6,yy-5,0,yy-7.5,-2.6,yy-5);
    }
    path(c,'#d0b69a',-6,-180,-11,-206,1,-238,11,-205,6,-180);
    path(c,blue?'#263e73':'#9a404f',-4.5,-184,-8.3,-205,.8,-232,8.4,-205,4.5,-184);
    for (let i=0;i<3;i++) for (const side of [-1,1]) {
      const yy=-195-i*9;
      c.fillStyle='#c3b8a7'; c.fillRect(side<0?-14:6,yy,8,1.6);
      c.beginPath(); c.ellipse(side*14,yy,2.7,3.4,0,0,tau); c.fill();
    }
    for (const yy of [-10,9]) {
      c.fillStyle='#17141b'; c.fillRect(-13,yy-1,26,11); c.fillStyle='#ae9899'; c.fillRect(-10.5,yy+1,21,6.6);
      for (let i=0;i<6;i++){c.fillStyle='#564651';c.fillRect(-8+i*3.2,yy+3,1.3,1.3);}
    }
    c.fillStyle='#d0b4a0'; c.fillRect(-11,27,22,3);
    for (let i=0;i<6;i++) {
      const x0=-6+i*2.4;
      c.beginPath(); c.moveTo((i-2.5)*1.45,-200-Math.abs(2.5-i)*5);
      c.lineTo(x0*.69,-178); c.quadraticCurveTo(x0+Math.sin(b*tau+i)*hit*1.4,-24,x0,29);
      line(c,'#f2ddc8',.43+i*.06);
    }
    c.beginPath(); c.arc(21,42,3,0,tau); c.fillStyle='#c7b69e'; c.fill();
    if (!still) {
      // The pick passes across the strings on alternating eighth notes.
      const px=Math.sin(b*tau)*10+9;
      c.save(); c.translate(px,-1); c.rotate(-.4+Math.sin(b*tau)*.18);
      path(c,'#f6bb7c',-3,-4,4,-4,1,4); c.restore();
      // Sparks fly off the strings on the recording's hardest picked notes.
      for (const s of sparks) for (let k=0;k<5;k++) {
        const a=-1.9+hash2(s.seed,k)*2.2, v=55+hash2(k,s.seed)*60;
        c.fillStyle=`rgba(255,${190+Math.round(50*hash(k+s.seed))},140,${((1-s.age/.45)*s.strength).toFixed(3)})`;
        c.fillRect(px+Math.cos(a)*v*s.age, Math.sin(a)*v*s.age+90*s.age*s.age, 2.2, 2.2);
      }
    }
    c.restore();
  }

  // MARK: frame

  function draw(c,w,h,m) {
    const still=m.reducedMotion, b=still ? 12 : m.beats, sec=m.time;
    const leadGuitar=m.variant==='your-reality-metalized';
    const {tutti,solo,peak:climax,tail}=leadGuitar ? {
      tutti:ramp(sec,8,15),solo:band(sec,96,103,121,128),
      peak:band(sec,133,143,150,158),tail:ramp(sec,(m.duration||196)-6,(m.duration||196)-.5)
    } : arrangement(sec);
    const energy=still ? .55 : m.energy, hi=still ? .3 : m.highs;
    const drive=unit((.22+.62*tutti+.22*solo+.24*climax)*(energy*.65+.35))*(1-tail*.74);
    const hit=still ? 0 : unit(m.pulse*.58+m.onset*.27+m.bass*.15);
    const double=still ? 0 : Math.exp(-((b*2)%1)*5)*drive;
    const voice=still ? 0 : voiceAt(m.vocal, sec);
    const data=still ? null : m.data, offset=data?.beatOffset ?? 0;
    const clock=still ? 0 : sec;
    set.hall(c,w,h);
    const center=w*.5, narrow=w<h*.95;
    const s=Math.min(w,h), rx=center, ry=h*(narrow?.225:.195);
    const r=s*(narrow?.134:.150);
    // The same glass that emits the high light leaves a low, elongated reflection.
    c.save();c.translate(rx,h*.816);c.scale(1,.13);
    const glow=.17+hi*.15+hit*.13;
    c.fillStyle=radial(c,0,0,r*1.84,[[0,rgba('#ffb983',glow)],[.36,rgba('#da5666',glow*.87)],[1,'rgba(165,38,57,0)']]);
    c.fillRect(-r*1.84,-r*1.84,r*3.68,r*3.68);c.restore();
    windowRays(c,w,h,rx,ry,b,(.25+.45*drive+.2*hi+.35*climax+.25*voice)*(1-tail*.8),still);

    // Bass hits measured on the beat send light up the pipes.
    const pulses=[];
    if (data) for (let ago=0; ago<3; ago++) {
      const k=Math.floor(b)-ago, at=offset+k*m.period, u=(sec-at)/.9;
      if (k<0 || u<0 || u>=1.3) continue;
      const strength=peak(data,'bass',at-.04,at+.08);
      if (strength>.55) pulses.push({ u:easeOut(u/1.3)*1.3, a:Math.min(.75,(strength-.45)*1.6)*(.35+.65*drive) });
    }
    // The visible beam and floor footprint move together; the stone and pipes never flex.
    for (const side of [-1,1]) {
      // Slow sweeps in the quiet parts; with the full band the lights jump to a new mark each bar.
      const drift=.5+.5*Math.sin(b*Math.PI/8+side*.7);
      const bar=Math.floor(b/4), mark=k=>.5+.5*Math.sin(k*2.39+side*1.3);
      const jump=mix(mark(bar-1),mark(bar),easeOut((b%4)/1.2));
      const swing=mix(drift,jump,unit(tutti*.85+climax*.15)*(1-solo));
      const foot=center+side*w*(.10+swing*.21),tip=center+side*w*.35,sw=h*(.038+.052*drive);
      set.shaft(c,tip,h*.024,foot,h*(.79+.055*swing),sw,(.28+.52*drive+.18*hit)*(1-.71*tail),side<0?'#efd0aa':'#d98999');
      if(tutti>.08)set.shaft(c,center+side*w*.27,h*.08,center-side*w*(.045+swing*.08),h*.765,sw*.56,(.21+.34*drive+.13*double)*tutti,'#afbedc');
    }
    candles(c,w,h,clock,.55+.45*tail,still);
    fog(c,w,h,clock,drive,tail);
    for (const side of [-1,1]) rank(c,w,h,side,drive,b,hit,pulses);
    roseWindow(c,rx,ry,r,Math.sin(b*Math.PI/24)*.19+solo*.23,drive*(.45+.55*hit),
      unit(drive+hi*.18+voice*.2),voice,((b/4)%1)*tau-Math.PI/2);
    scoreLines(c,w,h,b,drive,hit,solo,tail);
    if (!still) scoreNotes(c,w,h,m,sec,b,drive,hit,solo,voice);
    // Drum hits measured on the beat throw architectural echoes outwards.
    if (data && drive>.24) for (let ago=0;ago<3;ago++) {
      const k=Math.floor(b)-ago, at=offset+k*m.period, u=(sec-at)/(m.period*3);
      if (k<0 || u<0 || u>=1) continue;
      const strength=peak(data,'bass',at-.04,at+.08);
      if (strength<.5) continue;
      const a=(1-u)**2*drive*strength;
      c.beginPath(); c.moveTo(-w*.05,h*(.53+u*.63)); c.lineTo(w*.19,h*(.70+u*.40));
      c.lineTo(w*.5,h*(.79+u*.32)); c.lineTo(w*.81,h*(.70+u*.40)); c.lineTo(w*1.05,h*(.53+u*.63));
      line(c,`rgba(248,119,105,${(a*.72).toFixed(3)})`,Math.max(1,h*.003));
    }
    if (!still) embers(c,w,h,sec,drive,tail);
    const instrumental=leadGuitar ? (still ? 1 : .90+.10*drive) : Math.max(band(sec,50.65,51.6,58.6,60.0), band(sec,95.55,97.3,113.9,115.5),
      .84*band(sec,130.0,131.5,136.3,137.7));
    const sparks=[];
    if (data && instrumental>0) {
      const half=m.period/2, now=Math.floor((sec-offset)/half);
      for (let slot=now-3; slot<=now; slot++) {
        const at=offset+slot*half, age=sec-at;
        if (age<0 || age>=.45) continue;
        const strength=peak(data,'onset',at-.04,at+.08);
        if (strength>.6) sparks.push({ age, strength, seed: slot%97 });
      }
    }
    guitarBreak(c,w,h,still ? (instrumental>.5 ? 1 : 0) : instrumental,b,hit,still,sparks,leadGuitar);
  }
  return Object.freeze({draw,arrangement,voiceAt});
});
