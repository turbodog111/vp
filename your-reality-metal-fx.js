// Rena's arrangement: a letter opens into a concert hall built from tuned metal.
(function (root, factory) {
  const fx = factory();
  if (typeof module === 'object' && module.exports) module.exports = fx;
  else root.RealityMetalFx = fx;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const tau = Math.PI * 2;
  const unit = x => Math.max(0, Math.min(1, x));
  const smooth = x => { const y = unit(x); return y * y * (3 - 2 * y); };
  const ramp = (t, inTime, outTime) => smooth((t - inTime) / (outTime - inTime));
  const band = (t, a, b, c, d) => ramp(t, a, b) * (1 - ramp(t, c, d));

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
  function pane(c, radius, color, rim) {
    c.beginPath(); c.moveTo(0, -radius);
    c.bezierCurveTo(radius*.28,-radius*.69, radius*.17,-radius*.43, 0,-radius*.30);
    c.bezierCurveTo(-radius*.17,-radius*.43,-radius*.28,-radius*.69,0,-radius);
    c.fillStyle = color; c.fill(); line(c, rim, Math.max(.8, radius*.011));
  }
  function roseWindow(c, x, y, r, turn, open, light) {
    c.save(); c.translate(x, y);
    c.fillStyle = '#181622'; c.beginPath(); c.arc(0,0,r*1.08,0,tau); c.fill();
    for (const [radius, edge, width] of [[1.08,'#987d80',.015],[1.035,'#453847',.032],[1,'#d1adb2',.011]]) {
      c.beginPath(); c.arc(0,0,r*radius,0,tau); line(c,edge,Math.max(.8,r*width));
    }
    c.rotate(turn);
    for (let i=0; i<12; i++) {
      c.save(); c.rotate(i*tau/12); c.translate(0,-open*r*.065);
      pane(c,r*.89,i%2 ? '#9c304d' : '#c95c69','#402733');
      path(c,`rgba(255,218,170,${.19+light*.5})`,0,-r*.83, r*.068,-r*.61, 0,-r*.46, -r*.018,-r*.58);
      c.restore();
    }
    // A split pen nib takes the place of the central boss in the rose.
    c.rotate(-turn); c.beginPath(); c.arc(0,0,r*.29,0,tau); c.fillStyle='#24202b'; c.fill();
    path(c,'#f4dbb6',0,-r*.26,r*.15,-r*.02,r*.083,r*.19,-r*.083,r*.19,-r*.15,-r*.02);
    c.beginPath(); c.moveTo(0,-r*.26); c.lineTo(0,r*.015); line(c,'#413341',Math.max(1,r*.019));
    c.beginPath(); c.arc(0,r*.02,r*.029,0,tau); c.fillStyle='#413341'; c.fill();
    c.restore();
  }
  function rank(c, w, h, side, drive, beats, hit) {
    c.save(); if (side === 1) { c.translate(w,0); c.scale(-1,1); }
    const step = Math.min(w*.031, h*.056);
    // The casing opens on pivot points, but each pipe remains a rigid, fluted tube.
    c.translate(-step*(.3+drive*.68),0);
    for (let i=0; i<7; i++) {
      const x = step*(i-.32), width = step*.91, base = h*(.80+i*.018);
      const top = h*(.055 + i*.036) + Math.sin(i*.72+beats*Math.PI/8)*h*.014*drive;
      const mouth = base - (base-top)*.27, glint = (1+Math.cos(i*.95-beats*Math.PI/2))/2;
      const metal = c.createLinearGradient(x,0,x+width,0);
      metal.addColorStop(0,'#25212d'); metal.addColorStop(.24,'#514653');
      metal.addColorStop(.38,`rgba(${Math.round(124+70*glint*drive)},128,142,1)`);
      metal.addColorStop(.46,'#574955'); metal.addColorStop(.79,'#302631'); metal.addColorStop(1,'#171621');
      path(c,metal,x,top+width*.42,x+width,top,x+width,base,x,base);
      path(c,'#100f19',x,top+width*.42,x+width*.95,top,x+width*.8,top+width*.29,x+width*.1,top+width*.55);
      c.beginPath(); c.moveTo(x+width*.08,top+width*.42); c.lineTo(x+width,top);
      line(c,'#d9b8b3',Math.max(1,width*.045));
      path(c,'#191521',x+width*.16,mouth,x+width*.50,mouth-width*.59,x+width*.82,mouth,x+width*.82,mouth+width*.20,x+width*.16,mouth+width*.20);
      c.fillStyle=`rgba(255,160,102,${.18+.68*glint*hit})`; c.fillRect(x+width*.18,mouth+width*.12,width*.62,Math.max(1,width*.08));
    }
    c.restore();
  }
  function scoreWaves(c,w,h,beats,sweep,drive,hit,solo) {
    const y=h*.87, travel=(beats*.25)%1;
    for (let j=0;j<6;j++) {
      const depth=j/5;
      c.beginPath();
      for (let n=0;n<=44;n++) {
        const u=n/44, tether=Math.sin(u*Math.PI);
        const oscillation = Math.sin(u*tau*(2+solo)+sweep+j*.14)*.033
          + Math.sin(u*tau*5-beats*Math.PI)*.011*hit;
        const yy=y+h*(depth*.089+oscillation*tether*drive
          -.10*(1-u)**2-.036*u*u-.045*tether);
        if (n) c.lineTo(u*w,yy); else c.moveTo(0,yy);
      }
      line(c,j%2 ? '#be8784' : '#a8aab5',Math.max(.8,h*(.0018+depth*.001)));
    }
    // Independent bow strokes travel to the vanishing point and fade; no particle emitter.
    for (let j=0;j<3;j++) {
      const u=(travel+j/3)%1, a=(1-u)*drive;
      for (const sign of [-1,1]) {
        const xx=w*(.5+sign*(.16+u*.43)), yy=h*(.86-u*.74);
        c.beginPath(); c.moveTo(xx+sign*w*.09, yy-h*.05);
        c.quadraticCurveTo(xx+sign*w*.028,yy,xx+sign*w*.018,yy+h*.1);
        line(c,`rgba(255,145,128,${a*.66})`,Math.max(1,h*.004)*(1-u*.6));
      }
    }
  }
  function guitarBreak(c,w,h,level,b,hit,still) {
    if (level<=0) return;
    const size=Math.min(w/460,h/352), x=w*.49, y=h*(.68+(1-level)*.43);
    c.save(); c.globalAlpha=level;
    // The long edges of the two spotlights meet behind the instrument, not the words.
    for (const sign of [-1,1]) {
      const u=.06*Math.sin(b*Math.PI/8+sign);
      const beam=c.createLinearGradient(0,0,0,h);
      beam.addColorStop(0,'rgba(255,192,151,.66)'); beam.addColorStop(.72,'rgba(204,75,86,.17)'); beam.addColorStop(1,'rgba(204,75,86,0)');
      path(c,beam,w*(.5+sign*(.31+u)),0,w*(.5+sign*(.37+u)),0,w*(.5-sign*.10),h,w*(.5-sign*.29),h);
    }
    c.translate(x,y); c.scale(size,size);
    c.rotate(.81+.10*Math.sin(b*Math.PI/8)+hit*.027);
    const shape=()=>{ c.beginPath(); c.moveTo(-13,-27); c.quadraticCurveTo(-19,-31,-23,-18);
      c.lineTo(-83,100); c.quadraticCurveTo(-84,106,-78,102); c.lineTo(-2,50);
      c.lineTo(61,90); c.quadraticCurveTo(68,93,65,85); c.lineTo(19,-21);
      c.quadraticCurveTo(16,-28,10,-27); c.closePath(); };
    c.save(); c.translate(3,6); shape(); c.fillStyle='#341f2b'; c.fill(); c.restore();
    const finish=c.createLinearGradient(-52,8,51,59);
    finish.addColorStop(0,'#672f40'); finish.addColorStop(.36,'#da6269'); finish.addColorStop(.46,'#b83b51'); finish.addColorStop(1,'#712639');
    shape(); c.fillStyle=finish; c.fill(); line(c,'#f1c1a1',1.5);
    path(c,'#e3d1b7',-13,-17,11,-17,47,70,-2,39,-59,79);
    path(c,'#29232c',-10,-17,9,-17,35,54,-2,33,-42,60);
    path(c,'#dfbb92',-10,-11,-6.5,-189,6.5,-189,10,-11);
    path(c,'#342731',-8.6,-10,-5.5,-189,5.5,-189,8.6,-10);
    for (let i=0;i<19;i++) {
      const d=1-Math.pow(2,-i/12), yy=-177+d*244, fret=5.6+(yy+177)*.015;
      c.fillStyle='#bdaba0'; c.fillRect(-fret,yy,fret*2,.85);
      if ([3,5,7,9,12,15,17].includes(i))
        path(c,'#dfd4c6',0,yy-2.5,2.6,yy-5,0,yy-7.5,-2.6,yy-5);
    }
    path(c,'#d0b69a',-6,-180,-11,-206,1,-238,11,-205,6,-180);
    path(c,'#9a404f',-4.5,-184,-8.3,-205,.8,-232,8.4,-205,4.5,-184);
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
      c.save(); c.translate(Math.sin(b*tau)*10+9,-1); c.rotate(-.4+Math.sin(b*tau)*.18);
      path(c,'#f6bb7c',-3,-4,4,-4,1,4); c.restore();
    }
    c.restore();
  }
  function draw(c,w,h,m) {
    const still=m.reducedMotion, b=still ? 12 : m.beats, sec=m.time;
    const {tutti,solo,peak,tail}=arrangement(sec);
    const energy=still ? .55 : m.energy, hi=still ? .3 : m.highs;
    const drive=unit((.22+.62*tutti+.22*solo+.24*peak)*(energy*.65+.35))*(1-tail*.74);
    const hit=still ? 0 : unit(m.pulse*.58+m.onset*.27+m.bass*.15);
    const double=still ? 0 : Math.exp(-((b*2)%1)*5)*drive;
    const floor=c.createLinearGradient(0,0,w*.22,h);
    floor.addColorStop(0,'#100f1a'); floor.addColorStop(.41,'#231825');
    floor.addColorStop(.68,'#181824'); floor.addColorStop(1,'#30212d');
    c.fillStyle=floor; c.fillRect(0,0,w,h);
    const center=w*.5, narrow=w<h*.95;
    // Pointed rib vault, followed by rake lights reflected down its sides.
    for (const side of [-1,1]) {
      c.save(); c.translate(center,0); c.scale(side,1);
      for (let i=0;i<3;i++) {
        c.beginPath(); c.moveTo(w*(.45+i*.05),h*.83);
        c.bezierCurveTo(w*.46,h*.42,w*(.32+i*.04),h*.09,0,h*(-.05+i*.045));
        line(c,i===1?'#71505c':'#513d4b',Math.max(1,h*(i===1?.006:.002)));
      }
      const swing=(.5+.5*Math.sin(b*Math.PI/8+side*.7));
      const foot=w*(.20+swing*.17), tip=w*(.38+.07*double), sw=h*(.06+.11*drive);
      const light=c.createLinearGradient(0,0,0,h);
      light.addColorStop(0,`rgba(255,110,103,${.11+.40*drive+.08*hit})`);
      light.addColorStop(.6,`rgba(207,57,87,${.10+.14*drive})`); light.addColorStop(1,'rgba(165,44,76,0)');
      path(c,light,tip,-1,tip+sw,-1,foot+sw*.7,h,foot-sw,h);
      c.restore();
      rank(c,w,h,side,drive,b,hit);
    }
    const s=Math.min(w,h), rx=narrow ? w*.80 : center, ry=h*(narrow?.19:.16);
    roseWindow(c,rx,ry,s*(narrow?.12:.122)*(1+.035*hit),Math.sin(b*Math.PI/24)*.19+solo*.23,drive*(.45+.55*hit),unit(drive+hi*.18));
    scoreWaves(c,w,h,b,b*Math.PI/2,drive,hit,solo);
    // Drum downbeats throw two separate architectural echoes, both moving outwards.
    if (!still && drive>.24) for (let ago=0;ago<2;ago++) {
      const u=((b%2)+2*ago)/4, a=(1-u)**2*drive;
      c.beginPath(); c.moveTo(-w*.05,h*(.53+u*.63)); c.lineTo(w*.19,h*(.70+u*.40));
      c.lineTo(w*.5,h*(.79+u*.32)); c.lineTo(w*.81,h*(.70+u*.40)); c.lineTo(w*1.05,h*(.53+u*.63));
      line(c,`rgba(248,119,105,${a*.72})`,Math.max(1,h*.003));
    }
    const instrumental=Math.max(band(sec,50.65,51.6,58.6,60.0), band(sec,95.55,97.3,113.9,115.5),
      .84*band(sec,130.0,131.5,136.3,137.7));
    guitarBreak(c,w,h,still ? (instrumental>.5 ? 1 : 0) : instrumental,b,hit,still);
  }
  return Object.freeze({draw,arrangement});
});
