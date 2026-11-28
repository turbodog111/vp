// Recording-specific MIDI heights; playback only looks up offline measurements.
((root,factory)=>{
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;else root.RealityScore=api;
})(globalThis,()=>{
  'use strict';
  const cache=new WeakMap(), empty=[];
  const letters=[0,0,1,1,2,3,3,4,4,5,5,6], sharp=[1,3,6,8,10];
  function spell(midi){
    const pc=midi%12;
    return {step:Math.floor(midi/12)*7+letters[pc]-37,alter:sharp.includes(pc)?1:0};
  }
  function build(data,source) {
    const p=data?.pitch;
    if(!p || p.version!==1 || !data.audioSha256 || p.audioSha256!==data.audioSha256 ||
       p.source!==source || !Array.isArray(p.notes))return null;
    if(cache.has(data))return cache.get(data);
    const notes=[], prefix=[], measure=new Map();
    let lastBar=null, latest=-1;
    for(const r of p.notes){
      if(!Array.isArray(r)||r.length!==4||!r.every(Number.isInteger))continue;
      const [a,b,midi,amplitude]=r, start=a/1000,end=b/1000;
      if(a<0 || b<=a || end>data.duration+.001 || midi<0 || midi>127 ||
         amplitude<=0 || amplitude>100 || (notes.length && start<notes.at(-1).start))continue;
      const {step,alter}=spell(midi),bar=Math.floor((start-data.beatOffset)*data.bpm/240);
      if(bar!==lastBar){measure.clear();lastBar=bar;}
      const accidental=alter?'sharp':measure.get(step)?'natural':null;
      measure.set(step,alter);
      notes.push({start,end,midi,level:amplitude/100,step,accidental});latest=Math.max(latest,end);prefix.push(latest);
    }
    const score={notes,prefix};cache.set(data,score);return score;
  }
  function between(data,source,from,to){
    const built=build(data,source);if(!built||to<from)return empty;
    const {notes,prefix}=built;let a=0,b=notes.length;
    while(a<b){const m=(a+b)>>1;if(prefix[m]<=from)a=m+1;else b=m;}
    const out=[];for(let i=a;i<notes.length&&notes[i].start<=to;i++)if(notes[i].end>from)out.push(notes[i]);
    return out;
  }
  const whites=[0,2,4,5,7,9,11];
  function keyMidi(whiteIndex,black=false){
    const k=whiteIndex%7;
    if(black && (k===2||k===6))return null;
    return 48+Math.floor(whiteIndex/7)*12+whites[k]+Number(black);
  }
  function keys(data,t){
    const result=new Map();
    for(const n of between(data,'piano',t-.065,t)){
      const down=Math.min(1,Math.max(.12,(t-n.start)/.025)),release=Math.max(0,1-Math.max(0,t-n.end)/.065);
      result.set(n.midi,Math.max(result.get(n.midi)||0,down*release*(.5+.5*n.level)));
    }
    return result;
  }
  return {between,spell,keys,keyMidi};
});
