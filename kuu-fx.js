(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KuuFx = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  function draw(c, w, h, input) {
    if (!(w > 0 && h > 0)) return;
    const reduced = !!input.reducedMotion;
    const t = reduced ? 0 : Math.max(0, input.time || 0);
    const energy = reduced ? .4 : clamp(input.energy || 0);
    const section = (input.sections || []).find(s => input.time >= s.start && input.time < s.end);
    const chorus = !!section?.chorus;
    const lift = chorus ? reduced ? 1 : Math.min(ease((input.time-section.start)/.7),ease((section.end-input.time)/.7)) : 0;
    const beat = reduced ? 0 : input.beats || 0;
    const pulse = reduced ? 0 : Math.exp(-(beat%1)*4);
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const sky = c.createLinearGradient(0,0,w*.5,h);
    sky.addColorStop(0,'#d8e7ea'); sky.addColorStop(.5,'#dae9e1'); sky.addColorStop(1,'#8cb0b0');
    c.fillStyle = sky; c.fillRect(0,0,w,h);
    c.fillStyle = `rgba(255,246,222,${lift*(.1+energy*pulse*.08)})`; c.fillRect(0,0,w,h);
    const moonX = w*.83, moonY = h*.2, r = Math.min(w,h)*.12;
    c.beginPath(); c.arc(moonX,moonY,r,0,TAU); c.fillStyle='#fff5d5'; c.fill();
    c.beginPath(); c.arc(moonX+r*.43,moonY-r*.2,r*.86,0,TAU); c.fillStyle='#c1d8d7'; c.fill();
    // A moonlit signal, rather than a particle field, anchors the left horizon.
    c.fillStyle='#4c747b'; c.fillRect(w*.12,h*.62,w*.008,h*.32);
    c.fillRect(w*.105,h*.56,w*.038,h*.12);
    for (let i=0;i<3;i++) {
      c.beginPath(); c.arc(w*.124,h*(.585+i*.032),Math.min(w,h)*.009,0,TAU);
      c.fillStyle = i===1?'#fff5d5':'#9ab9ae'; c.fill();
    }
    // Continuous phase belongs to audio time; energy changes brightness, not position.
    for (let band=0;band<5;band++) {
      c.beginPath();
      const base=h*(.73+band*.055), amp=h*(.018+lift*.022);
      for(let x=-20;x<=w+20;x+=20){
        const y=base+Math.sin(x/w*5.7-t*.65+band*.5)*amp+Math.sin(x/w*12+t*.3)*amp*.3;
        if(x===-20)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.lineTo(w+20,h); c.lineTo(-20,h); c.closePath();
      c.fillStyle=['#9cbbb5','#8aadaa','#739a9f','#638b95','#4c7484'][band]; c.fill();
    }
    for(let ribbon=0;ribbon<5;ribbon++){
      const y=h*(.15+ribbon*.17), wave=Math.sin(t*.42+ribbon)*h*(.03+lift*.04);
      for(let echo=2;echo>=0;echo--){
        c.beginPath();c.moveTo(-w*.1,y+echo*5);
        c.bezierCurveTo(w*.2,y-h*.16+wave+echo*5,w*.7,y+h*.14-wave+echo*5,w*1.1,y-h*.03);
        c.strokeStyle=`rgba(${ribbon%2?'255,251,233':'90,136,148'},${(.12+lift*.12)/(echo+1)})`;
        c.lineWidth=(echo?1:2.5)*Math.max(.7,w/1280);c.stroke();
      }
    }
    // Two paired kites follow continuous wind arcs outside the lyric's clear center.
    for(let i=0;i<2;i++){
      const x=w*(i?.86:.19)+Math.sin(t*.3+i*2)*w*.035;
      const y=h*(i?.66:.23)+Math.cos(t*.4+i)*h*.035;
      const s=Math.min(w,h)*(.035+lift*.01);
      c.save();c.translate(x,y);c.rotate(Math.sin(t*.35+i)*.2);
      c.beginPath();c.moveTo(0,-s);c.lineTo(s*.6,0);c.lineTo(0,s);c.lineTo(-s*.6,0);c.closePath();
      c.fillStyle=i?'#b66f86':'#fff7dd';c.fill();
      c.strokeStyle='#6a8d97';c.lineWidth=1.5;c.stroke();
      c.beginPath();c.moveTo(0,s);c.bezierCurveTo(-s,s*2,s,s*3,-s*.4,s*4);c.stroke();c.restore();
    }
    const wash=c.createLinearGradient(0,h*.25,0,h*.74);
    wash.addColorStop(0,'rgba(220,234,229,0)');wash.addColorStop(.3,'rgba(220,234,229,.86)');
    wash.addColorStop(.7,'rgba(220,234,229,.86)');wash.addColorStop(1,'rgba(220,234,229,0)');
    c.fillStyle=wash;c.fillRect(0,h*.25,w,h*.49);c.restore();
  }
  return Object.freeze({draw});
});
