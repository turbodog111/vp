const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const hand=require('../reality-manuscript.js'), score=require('../reality-score.js');
const root=path.join(__dirname,'..','songs');
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(root,dir,name+'.json')));
const vocal=key=>{const doc=read('lyrics/aligned',key);return {duration:doc.duration,lines:doc.rows.map(r=>({...r,words:r.words.en}))};};

test('letter silhouettes encode spelling, case, punctuation, and real nib lifts',()=>{
  for(const face of ['letter','print']){
    const ink=hand.shape(face,'ink'), pen=hand.shape(face,'pen');
    assert.ok(ink && pen);assert.notDeepEqual(ink.segments,pen.segments);
    assert.notDeepEqual(hand.shape(face,'I').segments,hand.shape(face,'i').segments);
    assert.ok(hand.shape(face,"you,").length>hand.shape(face,'you').length);
    assert.equal(hand.shape(face,'\u732b'),null);
    const dot=hand.shape(face,'i'),lift=dot.segments.find(s=>!s.down);
    assert.ok(lift,'dot is separately penned');const pt=hand.point(dot,(lift.from+lift.to)/(2*dot.length));
    assert.ok(!pt.down&&pt.lift>0);
    for(const f of [.01,.3,.51,.95])assert.deepEqual(hand.point(ink,f),hand.point(ink,f),'seek reconstructs nib');
  }
  assert.equal(hand.plan(null),null);assert.equal(hand.inkAmount(null,15),0);
});

test('each desk wraps the actual recording into the paper width without losing any words',()=>{
  for(const suffix of ['','-caleb-hyles','-pop-punk','-kamex','-ink-static','-cement-city']){
    const key='your-reality'+suffix, sheet=vocal(key), face=hand.style(key)[0], p=hand.plan(sheet,face);
    assert.deepEqual(p.words.map(w=>w.form.text),sheet.lines.flatMap(l=>l.words.map(w=>w.text)));
    for(const [w,h] of [[1110,560],[345,451],[580,240]]){
      const g=hand.geometry(w,h,p),before=hand.nib(p,p.words[0].start-2,g);
      assert.equal(before.writing,false);
      for(const word of p.words){
        const p0=g.positions[word.order];
        assert.ok(p0.x+word.form.minX*p0.scale>=g.left-1e-6);
        assert.ok(p0.x+word.form.maxX*p0.scale<=g.right+1e-6);
        const t=(word.start+word.writeEnd)/2;
        const expected=hand.point(word.form,.5),actual=hand.nib(p,t,g);
        assert.ok(Math.abs(actual.x-p0.x-expected.x*p0.scale)<.001);
        assert.equal(actual.writing,expected.down);
      }
    }
  }
});

test('staff spelling and chromatic keyboard use fixed pitches and absolute octaves',()=>{
  assert.deepEqual([60,64,67,69,72,77].map(v=>score.spell(v).step),[-2,0,2,3,5,8]);
  assert.deepEqual(score.spell(66),{step:1,alter:1});
  assert.deepEqual([0,1,2,3,4,5,6,7,14,20].map(k=>score.keyMidi(k)),[48,50,52,53,55,57,59,60,72,83]);
  assert.deepEqual([0,1,2,3,6].map(k=>score.keyMidi(k,true)),[49,51,null,54,null]);
  const model={duration:8,audioSha256:'matching',bpm:120,beatOffset:0,
    pitch:{version:1,audioSha256:'matching',source:'piano',notes:[[100,1800,61,92],[120,450,67,70],[500,900,60,80],[2100,2300,60,64]]}};
  assert.deepEqual(score.between(model,'piano',.75,.8).map(n=>n.midi),[61,60]);
  assert.deepEqual(score.between(model,'piano',0,4).map(n=>n.accidental),['sharp',null,'natural',null]);
  assert.deepEqual([...score.keys(model,.25).keys()],[61,67]);
  assert.equal(score.keys(model,1.9).size,0);
  assert.equal(score.between(model,'vocals',0,4).length,0);
  assert.equal(score.between({...model,audioSha256:'other'},'piano',0,4).length,0);
  assert.equal(score.keys({},1).size,0);
});

test('all five note-displaying arrangements have independent, fingerprinted performance events',()=>{
  for(const [key,src] of [['your-reality','piano'],['your-reality-caleb-hyles','piano'],
    ['your-reality-pop-punk','piano'],['your-reality-metal','vocals'],['your-reality-metalized','guitar']]){
    const data=read('motion',key), p=data.pitch;
    assert.equal(p.source,src);assert.equal(p.audioSha256,data.audioSha256);
    assert.ok(p.notes.length>35);
    assert.equal(score.between(data,src,0,data.duration).length,p.notes.length);
    assert.ok(new Set(p.notes.map(n=>n[2])).size>=8);
    if(src==='vocals'){
      const lines=vocal(key).lines;
      assert.ok(p.notes.every(([a,b])=>lines.some(l=>a/1000>=l.start-.001&&b/1000<=l.end+.001)));
    }
  }
});
