// Physical sets for Your Reality. All marks, materials and reflections are drawn in Canvas;
// only stationary scenery is cached. There are no image files or wall-clock animations.
((root, factory) => {
  const kit = typeof module === 'object' && module.exports ? require('./mv-kit.js') : root.MvKit;
  const api = factory(kit);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RealitySet = api;
})(typeof window === 'object' ? window : globalThis, kit => {
  'use strict';
  const { TAU, hash, hash2, mix, clamp, linear, radial, rgba } = kit;
  const surfaces = new Map();
  function surface(w, h) {
    const a = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w,h)
      : typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (a) { a.width=w; a.height=h; }
    return a;
  }
  // Low-frequency figure and fine relief need different spatial scales. A seeded
  // lattice keeps the same grain when WebKit repaints a paused or resized stage.
  const lattice=new Float32Array(128*128);
  let seed=2166136261;
  for(let i=0;i<lattice.length;i++){seed=(Math.imul(1664525,seed)+1013904223)>>>0;lattice[i]=seed/4294967296;}
  function noise(x,y) {
    const ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);
    const j=(iy&127)*128,k=((iy+1)&127)*128,i=ix&127,n=(ix+1)&127;
    return mix(mix(lattice[j+i],lattice[j+n],a),mix(lattice[k+i],lattice[k+n],a),b);
  }
  const swatches=new Map();
  function swatch(key,W,H,pixel) {
    if(swatches.has(key))return swatches.get(key);
    const can=surface(W,H),ctx=can?.getContext('2d');
    if(!ctx)return null;
    const im=ctx.createImageData(W,H),out=im.data;
    for(let j=0,k=0;j<H;j++)for(let i=0;i<W;i++,k+=4)pixel((i+.5)/W,(j+.5)/H,i,j,out,k);
    ctx.putImageData(im,0,0);swatches.set(key,can);return can;
  }
  function grain(x,y,i,j,o,k) {
    const cut=y+.028*Math.sin(x*4.2+y*3)+.023*(noise(x*4,y*5)-.5);
    const knot=(a,b,depth)=>depth*Math.exp(-((x-a)**2/.021+(y-b)**2/.013));
    const v=cut+knot(.23,.56,.054)-knot(.76,.82,.04);
    const broad=noise(x*2.3,v*18), ring=v*83+broad*2.35+noise(x*6,v*34)*.8;
    const ridge=.5+.5*Math.sin(ring*TAU),late=Math.max(0,ridge-.57)/.43;
    const fibers=noise(x*29,v*440), pores=noise(x*115,v*510);
    const curl=noise(x*7+y*2,v*38),light=.95+.22*(1-x)-.12*y+.12*curl;
    const d=16*(broad-.5)+13*(fibers-.5)-10*late*late-18*Math.max(0,pores-.67)+4*(lattice[(j&127)*128+(i&127)]-.5);
    o[k]=(146+d*1.2)*light;o[k+1]=(98+d)*light;o[k+2]=(69+d*.79)*light;o[k+3]=255;
  }
  function rag(x,y,i,j,o,k) {
    const laid=Math.cos(y*TAU*103)*.73, fibre=noise(x*104+y*21,y*180);
    const speck=lattice[((j*3)&127)*128+((i+j)&127)], body=noise(x*6,y*7);
    const d=(body-.5)*5+(fibre-.5)*6+(speck-.5)*5+laid;
    const rim=5*Math.pow(Math.abs(x*2-1),7)+6*y*y;
    o[k]=252+d-rim*.48;o[k+1]=245+d-rim*.75;o[k+2]=226+d-rim;o[k+3]=255;
  }
  function limestone(x,y,i,j,o,k) {
    const broad=noise(x*8,y*9),stone=noise(x*67,y*52), grit=lattice[(i&127)*128+(j&127)];
    const d=(broad-.5)*18+(stone-.5)*11+(grit-.5)*13;
    const flank=Math.abs(x-.5)*2,side=.70+flank*.35+(1-y)*.13;
    o[k]=(64+d)*side;o[k+1]=(61+d*.9)*side;o[k+2]=(68+d*.9)*side;o[k+3]=255;
  }
  function cached(c,id,w,h,painter) {
    // One backing store per material, including during window resizing and song changes.
    const scale=Math.min(1,1280/Math.max(w,h)), W=Math.max(1,Math.round(w*scale/4)*4), H=Math.max(1,Math.round(h*scale/4)*4);
    let entry=surfaces.get(id);
    if (!entry || entry.width!==W || entry.height!==H) {
      entry=surface(W,H);
      const ctx=entry?.getContext('2d');
      if (!ctx) { painter(c,w,h,false); return; }
      painter(ctx,W,H,true); surfaces.set(id,entry);
    }
    c.drawImage(entry,0,0,w,h);
  }
  function stroke(c,col,width) { c.strokeStyle=col; c.lineWidth=width; c.stroke(); }
  function oval(c,x,y,rx,ry,fill,a=0) {
    c.beginPath(); c.ellipse(x,y,Math.max(.001,rx),Math.max(.001,ry),a,0,TAU); c.fillStyle=fill; c.fill();
  }
  function polygon(c,col,pts) {
    c.beginPath(); pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.closePath(); c.fillStyle=col; c.fill();
  }
  function board(c,w,h,detail) {
    c.fillStyle=linear(c,0,0,w*.76,h,[[0,'#674234'],[.22,'#986749'],[.58,'#80533e'],[1,'#462e2c']]); c.fillRect(0,0,w,h);
    // Sawcut growth rings follow the grain, bend around knots, and taper out again.
    const grainTile=detail&&swatch('walnut',820,402,grain);
    if(grainTile)c.drawImage(grainTile,0,0,w,h);
    const n=detail?36:18;
    for(let i=0;i<n;i++) {
      const y=(i+hash(i+2)*.9)/n*h, p=y/h, r=hash(i+23);
      const warp=x=>Math.sin(x*5+p*6)*.011+Math.sin(x*11+p*15)*.004+
        .035*Math.exp(-((x-.27)**2/.036+(p-.78)**2/.012))-.027*Math.exp(-((x-.83)**2/.022+(p-.2)**2/.011));
      c.beginPath();
      for(let k=0;k<=20;k++){const u=k/20,yy=y+h*warp(u)+Math.sin(u*20+i)*h*.0008; if(k)c.lineTo(u*w,yy);else c.moveTo(0,yy);}
      stroke(c,rgba(r>.66?'#ffcc8a':'#2d1b1b',.035+r*.061),Math.max(.42,h*.001));
    }
    if(detail) {
      for(let i=0;i<900;i++) {
        const x=hash2(i,2)*w,y=hash2(i,4)*h;
        c.fillStyle=i%5?'rgba(44,25,23,.17)':'rgba(255,218,166,.30)';
        c.fillRect(x,y,w*(.0005+hash2(i,8)*.005),.5+hash2(i,9)*.6);
      }
      for(const y of [.24,.71]) {
        c.fillStyle='rgba(43,24,23,.61)'; c.fillRect(0,y*h,w,1.4);
        c.fillStyle='rgba(255,216,158,.28)'; c.fillRect(0,y*h+1.7,w,.8);
      }
    }
    // A clothbound book, seen in section; bevelled boards sit proud of the page block.
    c.save();c.translate(w*.91,-h*.045);c.rotate(.135);
    c.fillStyle='#48352e';c.fillRect(1,5,w*.19,h*.175);
    c.fillStyle='#bb9d76';c.fillRect(1,1,w*.19,h*.166);
    for(let i=0;i<4;i++){c.fillStyle=i%2?'#e8d9ae':'#8e735b';c.fillRect(0,h*(.15+i*.0038),w*.19,1);}
    c.fillStyle=linear(c,0,0,w*.17,18,[[0,'#182e2b'],[.08,'#556353'],[.12,'#293e36'],[1,'#30483d']]);c.fillRect(-2,-5,w*.195,h*.157);
    c.strokeStyle='#a18b58';c.lineWidth=1;c.strokeRect(w*.012,-8,w*.165,h*.142);c.restore();
  }
  function bottle(c,x,y,s) {
    c.save();c.translate(x,y);c.scale(s,s);c.rotate(-.11);
    for(let i=3;i>=1;i--) oval(c,16+i*2,10+i*2,33+i*3,20+i*2,'rgba(27,19,24,.10)',.38);
    const body=[[-26,-17],[-14,-28],[16,-29],[29,-17],[30,15],[18,29],[-13,31],[-28,19]];
    polygon(c,linear(c,-28,-24,30,25,[[0,'#f0d9aa'],[.08,'#718580'],[.21,'#182937'],[.45,'#111d2c'],[.67,'#25494b'],[.83,'#7a9583'],[1,'#252e37']]),body);
    polygon(c,'rgba(190,231,215,.44)',[[-25,-15],[-16,-23],[-16,16],[-24,22]]);
    polygon(c,'rgba(147,188,174,.30)',[[18,-24],[27,-16],[26,14],[18,24]]);
    polygon(c,'#182732',[[-17,-9],[-9,-18],[12,-18],[20,-7],[18,13],[8,21],[-9,20],[-17,13]]);
    oval(c,0,-5,18,14,'#77918b');oval(c,0,-6,15.5,11.6,'#102732');oval(c,0,-7,11.8,8.8,'#090f19');
    c.beginPath();c.ellipse(0,-7,17,12,0,3.5,5.53);stroke(c,'#e5efda',1.6);
    for(let k=0;k<3;k++){c.beginPath();c.moveTo(-24+k*2,2);c.lineTo(-23+k*2,13-k*2);stroke(c,'rgba(209,244,227,.50)',.85);}
    oval(c,38,27,14,10,'rgba(29,17,19,.35)');oval(c,36,24,14,10,'#493d31');
    oval(c,35,21,14,10,linear(c,24,14,48,26,[[0,'#78654c'],[.23,'#f0d19a'],[.55,'#957447'],[1,'#d3b583']]));
    oval(c,35,21,9.7,6.6,'#5b4b36');oval(c,34,20.4,8.6,5.8,'#8f734d');c.restore();
  }
  function desk(c,w,h) {
    cached(c,'desk',w,h,board);
  }
  function inkwell(c,w,h) { bottle(c,w*(w<h?.10:.087),h*(w<h?.74:.64),Math.min(w*.00142,h*.00186)); }
  function laidPaper(c,w,h,detail) {
    const p=linear(c,0,0,w*.75,h,[[0,'#f1e7cf'],[.13,'#fff9ea'],[.44,'#fff8e9'],[.73,'#f5ead4'],[.94,'#f1e2ca'],[1,'#e2d3b9']]);
    c.fillStyle=p;c.fillRect(0,0,w,h);
    const ragTile=detail&&swatch('rag',720,400,rag);
    if(ragTile)c.drawImage(ragTile,0,0,w,h);
    if(detail) {
      // Laid lines and chain lines are part of the sheet, not screen noise.
      for(let y=1;y<h;y+=2.9){c.fillStyle='rgba(113,92,60,.048)';c.fillRect(0,y,w,.6);}
      for(let x=w*.06;x<w;x+=w*.093){c.fillStyle='rgba(255,255,250,.34)';c.fillRect(x,0,1.15,h);}
      c.beginPath();for(let i=0;i<Math.min(5400,w*h/65);i++){
        const x=hash2(i,12)*w,y=hash2(i,15)*h;c.moveTo(x,y);c.lineTo(x+hash2(i,17)*2.8-.5,y+hash2(i,19)*1.3-.65);
      }stroke(c,'rgba(100,72,51,.14)',.57);
    }
    const shadow=linear(c,0,0,w,0,[[0,'rgba(105,80,60,.13)'],[.022,'rgba(239,219,184,.08)'],[.07,'rgba(255,255,255,0)'],[.91,'rgba(255,255,255,0)'],[1,'rgba(124,99,81,.13)']]);
    c.fillStyle=shadow;c.fillRect(0,0,w,h);
  }
  function paper(c,w,h) { cached(c,'paper',w,h,laidPaper); }

  function lancet(c,x,y,r,H) {
    c.beginPath();c.moveTo(x-r,y);c.lineTo(x-r,y-H*.57);
    c.bezierCurveTo(x-r,y-H*.78,x-r*.44,y-H*.90,x,y-H);
    c.bezierCurveTo(x+r*.44,y-H*.90,x+r,y-H*.78,x+r,y-H*.57);c.lineTo(x+r,y);
  }
  function hallShell(c,w,h,detail) {
    const floorY=h*.737;
    c.fillStyle=linear(c,0,0,w*.6,h,[[0,'#243039'],[.43,'#4c4143'],[.72,'#292d35'],[1,'#49363e']]);c.fillRect(0,0,w,h);
    const stoneTile=detail&&swatch('limestone',760,390,limestone);
    if(stoneTile)c.drawImage(stoneTile,0,0,w,floorY);
    const rows=detail?20:8;
    for(let j=0;j<rows;j++){
      const n=detail?24:9, bh=floorY/rows, bw=w/n;
      for(let i=-1;i<n;i++){
        const seed=hash2(i+12,j+1),x=bw*(i+(j%2)*.5);
        c.fillStyle=rgba(seed>.55?'#d6c3a9':'#111b22',seed>.55?.018+seed*.032:.035+seed*.044);
        c.fillRect(x,j*bh,bw-.9,bh-1);
        if(detail){c.fillStyle='rgba(209,193,168,.10)';c.fillRect(x+1,j*bh,bw-2,.8);}
      }
    }
    // The arcade retreats in three planes. Recess, stop bevel, and lit arris are separate.
    for(let i=-2;i<=2;i++){
      const x=w*(.5+i*.162),a=Math.abs(i),yb=floorY-h*.012*a,H=h*(.36+.068*a),R=w*.068;
      lancet(c,x,yb,R,H);c.closePath();c.fillStyle=linear(c,x-R,0,x+R,0,[[0,'#191c25'],[.13,'#151922'],[.38,'#242830'],[.69,'#34323b'],[1,'#181c23']]);c.fill();
      c.save();c.clip();
      for(let j=1;j<=3;j++){
        lancet(c,x+R*.17,yb,R*(1-.21*j),H*(1-.092*j));stroke(c,rgba('#a39386',.19-.037*j),Math.max(1,h*.005));
      }
      c.restore();
      for(const [q,col,wd] of [[1.11,'#292a30',.017],[1.09,'#706463',.0065],[1.045,'#897669',.0022],[1.0,'#51494c',.004]]){
        lancet(c,x,yb,R*q,H*q);stroke(c,col,h*wd);
      }
    }
    for(const sign of [-1,1]){
      c.save();c.translate(w*.5,0);c.scale(sign,1);
      for(let k=0;k<3;k++){
        const foot=w*(.23+k*.115), rise=h*(.40-k*.059), head=w*(.02+k*.080), width=h*(.008+k*.003);
        for(const [j,col] of [[2.0,'#292932'],[1.44,'#5a5155'],[.86,'#938072'],[.25,'#b79b80']]){
          c.beginPath();c.moveTo(foot+width*j*.46,floorY);c.lineTo(foot+width*j*.46,rise);
          c.bezierCurveTo(foot,rise*.60,head+w*.10,h*.065,head,-h*.055);stroke(c,col,width*j);
        }
        c.fillStyle='#6b6062';c.fillRect(foot-width*1.1,rise,width*3.0,h*.009);
        c.fillStyle='#3a353c';c.fillRect(foot-width*1.5,floorY-h*.043,width*3.7,h*.037);
      }c.restore();
    }
    c.fillStyle=linear(c,0,floorY,0,h,[[0,'#302b32'],[.2,'#493b42'],[.65,'#352e35'],[1,'#201f27']]);c.fillRect(0,floorY,w,h-floorY);
    if(detail){
      const oak=swatch('walnut',820,402,grain);
      if(oak){c.save();c.globalAlpha=.14;c.drawImage(oak,0,floorY,w,h-floorY);c.restore();}
    }
    if(detail && c.canvas) {
      // Mirror the *drawn masonry* in polished boards, not an unrelated light texture.
      c.save();c.beginPath();c.rect(0,floorY,w,h-floorY);c.clip();c.translate(0,floorY);c.scale(1,-.43);
      c.globalAlpha=.22;c.drawImage(c.canvas,0,0,w,floorY,0,-floorY,w,floorY);c.restore();
    }
    for(let i=-6;i<=6;i++){
      c.beginPath();c.moveTo(w*(.5+i*.026),floorY);c.lineTo(w*(.5+i*.18),h);stroke(c,'rgba(13,16,23,.55)',Math.max(.8,h*.002));
    }
    for(const f of [.012,.035,.075,.14,.24,.38,.59,.86]){
      const y=mix(floorY,h,f);c.fillStyle='rgba(210,176,162,.13)';c.fillRect(0,y,w,1);c.fillStyle='rgba(12,14,23,.47)';c.fillRect(0,y+1,w,1);
    }
  }
  function hall(c,w,h) { cached(c,'hall',w,h,hallShell); }

  const jewels=[[217,76,79],[222,128,83],[134,70,114],[153,41,67],[207,89,110],[199,142,86],[70,119,134],[151,109,149]];
  function glassPixel(u,v,i,j,out,k) {
    const x=2*u-1,y=2*v-1,r=Math.hypot(x,y),theta=Math.atan2(y,x)+Math.PI/2;
    if(r>=1){out[k+3]=0;return;}
    const seg=theta*12/TAU+.5, sector=Math.floor(seg), angle=(seg-sector-.5)*TAU/12;
    const h=noise(u*27,v*31), pit=lattice[(j&127)*128+(i&127)], sun=(-x-y)*.32+.47;
    if(r>.89){
      const mould=.33+.46*Math.cos((1-r)*TAU*23)+.14*Math.sin((1-r)*TAU*43);
      const stone=42+76*clamp(mould)*(.55+sun*.6)+h*11+pit*8;
      out[k]=stone*1.07;out[k+1]=stone*.96;out[k+2]=stone*.95;out[k+3]=255;return;
    }
    const along=r*Math.cos(angle),across=r*Math.sin(angle);
    const t=clamp((along-.17)/.64), shape=.014+.115*Math.sin(t*Math.PI)**.8;
    const edge=Math.abs(across)-shape, petal=edge<0 && along<.82 && along>.16;
    const band=Math.floor(along*8.6), offset=sector+16;
    let c=petal?jewels[(offset+band*2)%6]:jewels[6+(offset%2)];
    let lead=Math.min(Math.abs(r-.875),Math.abs(r-.166),Math.abs(r-.113));
    if(r>.168) {
      lead=Math.min(lead,Math.abs(edge),Math.abs((seg%1+1)%1-.5)*r*.52,
        Math.abs(((along*8.6+Math.abs(across)*2.2+.46)%1)-.5)/8.6);
      if(!petal)c=[c[0]*.70,c[1]*.73,c[2]*.82];
    } else c=r<.11?jewels[5]:jewels[(offset%2)?0:4];
    const crackle=.77+.20*h+.16*noise(u*80+3*h,v*70)+.07*pit+.08*sun;
    const bead=clamp((lead-.003)/.012), lip=Math.max(0,1-Math.abs(lead-.014)/.006);
    out[k]=mix(36+sun*13,c[0]*crackle,bead)+lip*15;
    out[k+1]=mix(34+sun*9,c[1]*crackle,bead)+lip*10;
    out[k+2]=mix(46+sun*8,c[2]*crackle,bead)+lip*8;
    out[k+3]=255;
  }
  function glass(c,x,y,r,light,phase) {
    const window=swatch('rose-glass',360,360,glassPixel);
    if(!window)return false;
    c.drawImage(window,x-r,y-r,2*r,2*r);
    c.save();c.beginPath();c.arc(x,y,r*.885,0,TAU);c.clip();c.globalCompositeOperation='screen';
    const gx=x+r*.34*Math.cos(phase),gy=y+r*.25*Math.sin(phase);
    c.fillStyle=radial(c,gx,gy,r*.92,[[0,rgba('#ffbb8a',.08+.31*light)],[.48,rgba('#e6686b',.11*light)],[1,'rgba(183,75,99,0)']]);
    c.fillRect(x-r,y-r,r*2,r*2);c.restore();return true;
  }

  function sunPane(c,x,y,W,H,shear,amount) {
    const edge=(d,p)=>{const v=clamp(d/p+.5);return v*v*(3-2*v);};
    const mask=swatch('glazing',256,256,(u,v,i,j,o,k)=>{
      const ex=Math.min(u-.035,.965-u,Math.abs(u-.50)-.019);
      const ey=Math.min(v-.038,.962-v,Math.abs(v-.51)-.017);
      o[k]=255;o[k+1]=237;o[k+2]=200;
      o[k+3]=255*edge(ex,.045)*edge(ey,.044);
    });
    if(!mask)return false;
    c.save();c.translate(x,y);c.transform(1,0,shear,1,0,0);c.globalAlpha=clamp(amount);
    c.drawImage(mask,0,0,W,H);c.restore();return true;
  }

  // A real shaft has a penumbra and a footprint. Both use the same moving target.
  function shaft(c,x,y,X,Y,width,level,warm) {
    if(level<.009)return;
    const dx=X-x,dy=Y-y,len=Math.hypot(dx,dy)||1;
    c.save();c.translate(x,y);c.rotate(Math.atan2(-dx,dy));
    const rgb=kit.rgb(warm);
    const beam=swatch('beam:'+warm,96,176,(u,v,i,j,o,k)=>{
      const fan=.075+.91*v,across=(2*u-1)/fan;
      const dust=.9+.1*noise(u*7+v*3,v*8);
      o[k]=rgb[0];o[k+1]=rgb[1];o[k+2]=rgb[2];
      o[k+3]=255*Math.exp(-across*across*3.4)*(.52-.28*v)*dust;
    });
    if(beam){c.globalAlpha=clamp(level);c.drawImage(beam,-width,0,width*2,len);}
    else polygon(c,linear(c,0,0,0,len,[[0,rgba(warm,level*.30)],[1,rgba(warm,level*.085)]]),[[-width*.06,0],[width*.06,0],[width,len],[-width,len]]);
    c.restore();
    for(let j=2;j>=0;j--)oval(c,X,Y,width*(.75+j*.48),width*(.036+j*.033),rgba(warm,level*(.14-j*.034)));
  }
  return Object.freeze({desk,inkwell,paper,hall,glass,sunPane,shaft});
});
