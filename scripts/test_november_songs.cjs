const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const read = file => JSON.parse(fs.readFileSync(path.join(root,file)));
const keys = ['kuu-ni-naru','kuu-ni-naru-okosama','override-fubuki','magic-maid-okosama','peace-on-earth'];
const app = fs.readFileSync(path.join(root,'app.js'),'utf8');
const marker='const SUPPORTED_LYRIC_TRACKS = ';
const at=app.indexOf(marker)+marker.length;
const registry=vm.runInNewContext('('+app.slice(at,app.indexOf('\n};',at)+2)+')');
const normalize = s => s.normalize('NFKC').toLowerCase().replace(/\.(m4a|mp3)$/,'');
const canon = s => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

for(const key of keys) test(key+': complete audio, distinct catalog entry, metadata and fingerprint agree',()=>{
  const row=read('songs/imports/'+key+'.json');
  const bytes=fs.readFileSync(path.join(root,row.recording));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.outputAudioSha256);
  const catalog=read(path.dirname(row.recording)+'/manifest.json');
  const found=catalog.filter(s=>s.name===path.basename(row.recording));
  assert.equal(found.length,1);assert.equal(found[0].size,bytes.length);
  if(key==='peace-on-earth')assert.equal(registry[normalize(row.recording)],undefined);
  else {
    const config=registry[normalize(row.recording)]; assert(config);
    const data=read(config.dataUrl);
    assert.equal(data.alignment.audioSha256,row.outputAudioSha256);
    assert(Math.abs(data.duration-row.duration)<.001);
    assert.equal(data.alignment.approved,false,'not falsely called a listening-approved new recording');
  }
});

for(const key of ['kuu-ni-naru','kuu-ni-naru-okosama'])test(key+': supplied text and independently measured lanes preserve all 40 lines and actual gaps',()=>{
  const data=read('songs/lyrics/'+key+'.json'), source=read('songs/lyrics/sources/kuu-ni-naru.json');
  const lines=data.variants.jp.lines;
  assert.equal(lines.length,40);
  let end=0;
  lines.forEach((line,i)=>{
    assert.equal(line.text,source.rows[i][0]);
    assert(line.start>=end&&line.end>line.start&&line.end<=data.duration);end=line.end;
    for(const [field,expected] of [['words',line.text],['romajiWords',source.rows[i][1]],['enWords',source.rows[i][2]]]){
      assert.equal(canon(line[field].map(w=>w.word).join('')),canon(expected));
      let previous=line.start;
      for(const word of line[field]){
        assert(word.start>=previous-.001&&word.end>word.start&&word.end<=line.end+.001);
        previous=word.end;
      }
    }
  });
  assert(lines[0].start>7&&lines[0].start<9);
  assert(lines[16].start>64&&lines[16].start<67,'verse entrance after instrumental gap');
  assert(lines[32].start>121&&lines[32].start<124,'final chorus is not fabricated during the break');
  assert(lines[32].start-lines[31].end>10);
  assert(lines.at(-1).end<148);
  assert(!JSON.stringify(source).includes('You might also like'));
});

test('copied covers keep lyric content and the exact source theater with measured clock transforms',()=>{
  for(const [key,original,offset] of [['override-fubuki','override',-.04513],['magic-maid-okosama','magic-maid',1.72]]){
    const data=read('songs/lyrics/'+key+'.json'),ref=read('songs/lyrics/'+original+'.json');
    const config=registry[normalize(data.alignment.recording)];
    assert.equal(config.visualTheme,original);
    const lines=data.variants?data.variants.jp.lines:data.lines;
    const old=ref.variants?ref.variants.jp.lines:ref.lines;
    assert.equal(lines.length,old.length);
    lines.forEach((l,i)=>{
      for(const lane of ['text','jp','romaji','en'])assert.deepEqual(l[lane],old[i][lane]);
      assert(Math.abs(l.start-(old[i].start*data.alignment.clock.scale+offset))<.0001);
    });
    assert.equal(data.alignment.clock.matches.length,6);
    assert(data.alignment.clock.maxResidual<.01);
  }
});

function canvas(){
  const calls=[];
  const ctx=new Proxy({}, {
    set(t,k,v){calls.push([k,typeof v==='object'?'gradient':v]);t[k]=v;return true;},
    get(t,k){
      if(k==='createLinearGradient')return(...args)=>{assert(args.every(Number.isFinite));calls.push([k,...args]);return{addColorStop:(...v)=>calls.push(['stop',...v])};};
      return(...args)=>{assert(args.filter(v=>typeof v==='number').every(Number.isFinite),k);calls.push([k,...args]);};
    }
  });return{ctx,calls};
}
test('both Kuu scenes move continuously, freeze on pause and seek, and stay bounded at compact sizes',()=>{
  const fx=require('../kuu-fx.js');
  for(const key of ['kuu-ni-naru','kuu-ni-naru-okosama']){
    const data=read('songs/motion/'+key+'.json');
    for(const [w,h] of [[1280,650],[390,550],[780,210]])for(const section of data.sections){
      const time=section.start+Math.min(1,(section.end-section.start)/2);
      const render=(t,reducedMotion=false)=>{
        const c=canvas();fx.draw(c.ctx,w,h,{time:t,energy:.6,beats:t*83/60,sections:data.sections,reducedMotion});return c.calls;
      };
      const a=render(time);assert(a.length>100&&a.length<1200);
      assert.deepEqual(a,render(time));assert.notDeepEqual(a,render(time+.04));
      assert.deepEqual(render(time,true),render(time+.01,true));
    }
  }
});

test('new motion tracks use exact identities and switching never retains the previous scene',async()=>{
  const context=vm.createContext({window:{matchMedia:()=>({matches:false}),OverrideFx:require('../override-fx.js'),KuuFx:require('../kuu-fx.js')},
    AbortController,setTimeout,clearTimeout,console,
    fetch:async url=>({ok:true,json:async()=>read(url)})});
  vm.runInContext(fs.readFileSync(path.join(root,'song-motion-fx.js'),'utf8'),context);
  const api=context.window.SongMotionFx;
  for(const key of ['kuu-ni-naru','kuu-ni-naru-okosama','override-fubuki']){
    const row=read('songs/imports/'+key+'.json'), config=api.track({path:row.recording});
    assert.equal(config.key,key);
    await api.activate(config);
    const trace=canvas();api.draw(trace.ctx,1280,650,{time:43,energy:.5});assert(trace.calls.length>100);
    await api.activate(null);const empty=canvas();api.draw(empty.ctx,1280,650,{time:43});assert.equal(empty.calls.length,0);
  }
  assert.equal(api.track({path:'songs/Unrelated Artist - Kuu ni Naru.m4a'}),null);
});

test('Magic Maid cover selects the existing renderer with an adjusted canonical clock',()=>{
  const a=app.indexOf('function isMagicMaidSong('),b=app.indexOf('\nfunction ',a+1);
  const c=vm.createContext({supportedLyricTrackForSong:s=>registry[normalize(s.path)]});
  vm.runInContext(app.slice(a,b),c);
  assert(c.isMagicMaidSong({path:'songs/Okosama Lunch - Magic Maid.m4a'}));
  assert(c.isMagicMaidSong({path:'songs/MIMI feat. Kasane Teto SV - Magic Maid.m4a'}));
  assert.equal(c.isMagicMaidSong({path:'songs/Other - Magic Maid.m4a'}),false);
  assert(app.includes('audioTime - (clock?.timelineOffset || 0)'));
});
