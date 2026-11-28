// The visible ink and the moving nib sample the same ordered pen strokes.
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./reality-letterforms.js'));
  else root.RealityManuscript = factory(root.RealityLetterforms);
})(globalThis, forms => {
  'use strict';
  const unit = v => Math.max(0,Math.min(1,v));
  const smooth = v => { const x=unit(v); return x*x*(3-2*x); };
  const mix = (a,b,t) => a+(b-a)*t;
  const cache = new Map(), plans = new WeakMap(), layouts = new WeakMap();
  const styles = {
    original: ['letter','#302f44','#8d3253','#ae8983','nib'],
    'caleb-hyles': ['print','#3b3938','#85482d','#ad9a7e','pencil'],
    'pop-punk': ['print','#2e2944','#983456','#a895ac','marker'],
    'cement-city': ['print','#393123','#933b27','#bc987a','marker'],
    kamex: ['letter','#243854','#59467d','#929db4','nib'],
    'ink-static': ['letter','#233f40','#146763','#81a19c','nib']
  };
  const style = key => styles[(key || '').replace(/^your-reality-?/,'')] || styles.original;

  function shape(face, text) {
    const id=face+':'+text;
    if(cache.has(id))return cache.get(id);
    let x=0, length=0, last=null, minX=0, maxX=0;
    const segments=[];
    function append(a,b,down) {
      const dx=b[0]-a[0], dy=b[1]-a[1], d=Math.hypot(dx,dy);
      if(d<.01)return;
      // The hand slows around tight turns and moves faster with the nib lifted.
      const prev=segments.at(-1);
      let effort=1;
      if(down && prev?.down){
        const px=prev.b[0]-prev.a[0],py=prev.b[1]-prev.a[1];
        effort+=.28*(1-(px*dx+py*dy)/(Math.hypot(px,py)*d));
      }
      const from=length; length+=down?d*effort:Math.max(2,d*.44);
      segments.push({a,b,from,to:length,down,heavy:down && dy/d>.46});
    }
    for(const raw of text) {
      const char=raw==='\u2019'||raw==='\u2018'?"'":raw;
      const glyph=forms?.[face]?.[char];
      if(!glyph)return null;
      for(let k=1;k<glyph.length;k++){
        const points=[], src=glyph[k];
        for(let j=0;j<src.length;j+=2)points.push([x+src[j],src[j+1]]);
        if(points.length<2)continue;
        // This oval in the plotter master was digitized from its exit flourish.
        if(face==='letter' && char==='a' && k===1)points.reverse();
        for(const [px] of points){minX=Math.min(minX,px);maxX=Math.max(maxX,px);}
        if(last)append(last,points[0],false);
        for(let j=1;j<points.length;j++)append(points[j-1],points[j],true);
        last=points.at(-1);
      }
      x+=glyph[0];
    }
    if (!segments.length)return null;
    const word={text,width:x,minX,maxX,length,segments,paths:null};
    if(typeof Path2D==='function'){
      word.paths=[new Path2D(),new Path2D()];
      trace(word.paths[0],word,1,false);trace(word.paths[1],word,1,true);
    }
    cache.set(id,word);return word;
  }
  function point(word,fraction) {
    const at=unit(fraction)*word.length, segs=word.segments;
    let lo=0,hi=segs.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(segs[mid].to<=at)lo=mid+1;else hi=mid;}
    const s=segs[lo], f=unit((at-s.from)/(s.to-s.from));
    return {x:mix(s.a[0],s.b[0],f),y:mix(s.a[1],s.b[1],f),lift:s.down?0:.44*Math.sin(f*Math.PI),down:s.down};
  }
  function trace(path,word,fraction,heavy) {
    const stop=unit(fraction)*word.length;
    let last=null;
    for(const seg of word.segments){
      if(seg.from>=stop)break;
      if(!seg.down || (heavy&&!seg.heavy)){last=null;continue;}
      if(last!==seg.a)path.moveTo(...seg.a);
      const end=seg.to<=stop?seg.b:null;
      if(end)path.lineTo(...end);
      else {const f=(stop-seg.from)/(seg.to-seg.from);path.lineTo(mix(seg.a[0],seg.b[0],f),mix(seg.a[1],seg.b[1],f));}
      last=end;
    }
  }
  function plan(vocal, face='letter') {
    if(!vocal?.lines?.length)return null;
    let byFace=plans.get(vocal);
    if(!byFace){byFace=new Map();plans.set(vocal,byFace);}
    if(byFace.has(face))return byFace.get(face);
    const sections=[], lines=[], pages=[], words=[];
    for(const src of vocal.lines){
      const line={index:lines.length,start:src.start,end:src.end,words:[]};
      if(!lines.length || line.start-lines.at(-1).end>6)sections.push([]);
      sections.at(-1).push(line);lines.push(line);
      for(const cue of src.words){
        const form=typeof cue.text==='string' && shape(face,cue.text);
        if(!form){byFace.set(face,null);return null;}
        const span=cue.end-cue.start;
        const word={start:cue.start,end:cue.end,form,line,order:words.length,
          writeEnd:cue.start+Math.min(span*.90,.13+cue.text.length*.092)};
        line.words.push(word);words.push(word);
      }
    }
    for(const section of sections){
      const count=Math.ceil(section.length/3);
      for(let i=0,at=0;i<count;i++){
        const size=Math.ceil((section.length-at)/(count-i)), group=section.slice(at,at+size);
        const page={index:pages.length,lines:group,start:group[0].start,end:group.at(-1).end};
        pages.push(page);for(const line of group)line.page=page;
        at+=size;
      }
    }
    for(const [i,page] of pages.entries()){
      const next=pages[i+1];
      page.clearEnd=next?next.start:Infinity;
      page.clearStart=next?Math.max(page.end,next.start-1.2):Infinity;
    }
    const last=words.at(-1), goodbye=Math.min(2.4,Math.max(0,(vocal.duration??last.end+5)-last.end)*.55);
    const p={face,lines,words,pages,last,goodbye,sealAt:last.end+goodbye,finale:sections.at(-1)[0].start};
    byFace.set(face,p);return p;
  }
  function geometry(w,h,P) {
    const narrow=w<h, pw=w*(narrow?.935:.795), ph=h*.745;
    const xh=Math.min(ph*(narrow?.075:.067),pw*(narrow?.063:.051));
    const g={pw,ph,xh,unit:Math.min(pw/510,ph/350),left:pw*.105,right:pw*.87,
      gap:xh*3.38,focus:ph*(narrow?.57:.545),rest:{x:pw*.775,y:ph*.72}};
    if(!P)return g;
    const old=layouts.get(P);if(old?.pw===pw&&old.ph===ph)return old;
    const normal=xh/32, available=g.right-g.left, positions=[], rows=[];
    let row;
    function newRow(page,word){
      row={index:rows.length,page,first:word,start:word.start};rows.push(row);
    }
    for(const page of P.pages)for(const line of page.lines){
      let advance=0;newRow(page,line.words[0]);
      for(const word of line.words){
        const f=word.form, width=Math.max(f.width,f.maxX)-Math.min(0,f.minX);
        const scale=Math.min(normal,available/Math.max(1,width));
        if(advance && advance+width*scale>available){newRow(page,word);advance=0;}
        positions.push({row,x:g.left+advance-Math.min(0,f.minX)*scale,scale});
        advance+=(f.width-Math.min(0,f.minX))*scale+xh*(P.face==='print'?.69:.82);
      }
    }
    Object.assign(g,{rows,positions});layouts.set(P,g);return g;
  }
  function lastStarted(words,t) {
    let lo=0,hi=words.length;
    while(lo<hi){const m=(lo+hi)>>1;if(words[m].start<=t)lo=m+1;else hi=m;}
    return lo-1;
  }
  function camera(g,t) {
    const i=Math.max(0,lastStarted(g.rows,t)), row=g.rows[i],prev=g.rows[i-1];
    if(!prev || row.page!==prev.page)return i;
    return i-1+smooth((t-row.start)/.33);
  }
  const fraction=(w,t)=>unit((t-w.start)/(w.writeEnd-w.start));
  function localPoint(g,word,f,cam) {
    const at=g.positions[word.order], pt=point(word.form,f);
    return {x:at.x+pt.x*at.scale,y:g.focus+(at.row.index-cam)*g.gap+pt.y*at.scale,
      lift:pt.lift,writing:pt.down,alpha:1};
  }
  function nib(P,t,g) {
    const rest={...g.rest,lift:1,alpha:1,writing:false};
    if(!P)return rest;
    const cam=camera(g,t), i=lastStarted(P.words,t), word=P.words[i], next=P.words[i+1];
    const glide=(a,b,f,lift)=>({x:mix(a.x,b.x,f),y:mix(a.y,b.y,f),lift,writing:false,alpha:1});
    if(!word){const u=smooth((t-next.start+.65)/.65);return glide(rest,localPoint(g,next,0,cam),u,1-u);}
    if(t<word.writeEnd)return localPoint(g,word,fraction(word,t),cam);
    const end=localPoint(g,word,1,cam);
    if(!next){
      const u=smooth((t-word.end-P.goodbye*.25)/Math.max(.001,P.goodbye*.75));
      return {...glide(end,{x:g.pw*1.06,y:g.ph*.18},u,Math.min(1,3*u)),alpha:1-u};
    }
    const dest=localPoint(g,next,0,cam);
    // On a page change the new first line is centered on the new leaf, not below the last one.
    if(next.line.page!==word.line.page)dest.y-=g.gap*(g.positions[next.order].row.index-cam);
    if(next.start-word.end>2.2){
      const back=smooth((t-next.start+.65)/.65);
      if(back>0)return glide(rest,dest,back,1-back);
      const away=smooth((t-word.end)/.65);return glide(end,rest,away,away);
    }
    const depart=Math.max(word.writeEnd,Math.min(word.end,next.start-.14));
    const u=smooth((t-depart)/Math.max(.001,next.start-depart));
    return glide(end,dest,u,Math.sin(Math.PI*u)*(next.line===word.line?.38:1));
  }
  function paintWord(c,shape,f,scale,x,y,col,face,marker){
    if(f<=0)return;
    c.save();c.translate(x,y);c.scale(scale,scale);c.strokeStyle=col;c.lineCap='round';c.lineJoin='round';
    for(const heavy of [false,true]){
      c.lineWidth=(face==='print'?2.65:2.8)+(heavy?(marker?2.9:1.55):0);
      if(f>=1&&shape.paths)c.stroke(shape.paths[+heavy]);
      else {c.beginPath();trace(c,shape,f,heavy);c.stroke();}
    }c.restore();
  }
  function write(c,P,t,g,s) {
    const cam=P?camera(g,t):0, i=P?lastStarted(P.words,t):-1, current=P?.words[i];
    const page=current?.line.page;
    const turn=page&&Number.isFinite(page.clearEnd)?unit((t-page.clearStart)/Math.max(.001,page.clearEnd-page.clearStart)):0;
    c.save();c.beginPath();c.rect(g.pw*.054,g.ph*.177,g.pw*.875,g.ph*.642);c.clip();
    c.beginPath();const y0=g.focus-(cam%1)*g.gap;
    for(let k=-5;k<=5;k++){const y=y0+k*g.gap+g.xh*.065;c.moveTo(g.pw*.073,y);c.lineTo(g.pw*.924,y);}
    c.strokeStyle=s[3];c.globalAlpha=.34;c.lineWidth=Math.max(.75,g.unit*.74);c.stroke();
    c.globalAlpha=1;
    if(page)for(const line of page.lines)for(const word of line.words){
      if(t<=word.start)break;
      const at=g.positions[word.order], y=g.focus+(at.row.index-cam)*g.gap;
      if(y<g.ph*.155 || y>g.ph*.86)continue;
      const distance=Math.max(0,cam-at.row.index);
      c.globalAlpha=(1-smooth(turn))*(1-.58*smooth(distance/2));
      const live=t<word.end;
      paintWord(c,word.form,fraction(word,t),at.scale,at.x,y,live?s[2]:s[1],s[0],s[4]==='marker');
    }
    c.restore();return turn;
  }
  function inkAmount(vocal,t){
    const p=plan(vocal);if(!p)return 0;
    const i=lastStarted(p.words,t);if(i<0)return 0;
    const page=p.words[i].line.page;if(t>=page.clearStart)return 0;
    return page.lines.reduce((n,l)=>n+l.words.reduce((v,w)=>v+fraction(w,t)*w.form.length,0),0);
  }
  return {style,shape,point,plan,geometry,nib,write,inkAmount};
});
