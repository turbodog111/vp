const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../lyric-workbench.js');
const recording = 'songs/test.m4a';
function timed() {
  const d = W.mergeLane(W.fresh(recording, 'en', 20), 'en', 'First line\nSecond line');
  d.rows[0].start = 1; d.rows[0].end = 3;
  d.rows[1].start = 5; d.rows[1].end = 8;
  return d;
}
test('time fields accept seconds and absolute mm:ss, never empty-as-zero', () => {
  assert.equal(W.parseTime(''), null); assert.equal(W.parseTime('52.27'), 52.27);
  assert.equal(W.parseTime('1:24.010'), 84.01); assert.equal(W.parseTime('0'), 0);
  for (const bad of ['-2', '1:60', 'NaN', '1e3', '12abc']) assert(Number.isNaN(W.parseTime(bad)));
});
test('plain and LRC text are numbered without inventing ends or ignoring malformed lines', () => {
  const d = W.mergeLane(W.fresh(recording), 'en', '[00:01.20] First\n\n[00:05.00] Second');
  assert.deepEqual(d.rows.map(r => [r.id,r.start,r.end]), [['line-1',1.2,null],['line-2',5,null]]);
  assert.throws(() => W.parseLane('[Verse]\nword'));
  assert.throws(() => W.parseLane('[00:01][00:02]Repeated'));
});
test('language updates preserve IDs and timing; mismatched counts are atomic', () => {
  const d = timed(), before = JSON.stringify(d);
  assert.throws(() => W.mergeLane(d, 'romaji', 'one'));
  assert.equal(JSON.stringify(d), before);
  const next = W.mergeLane(d, 'romaji', 'ichi\nni');
  assert.equal(next.rows[1].start, 5); assert.equal(next.rows[0].id, d.rows[0].id);
  assert.equal(d.rows[0].romaji, '');
});
test('changed text invalidates only its own word timings', () => {
  const d = timed(); d.rows[0].words.en = [{text:'First',start:1,end:2},{text:'line',start:2,end:3}];
  const next = W.mergeLane(d, 'en', 'Changed line\nSecond line');
  assert.equal(next.rows[0].words.en, undefined);
});
test('half-open lyric intervals clear in real gaps and support backwards seeks', () => {
  const rows = timed().rows;
  for (const [time, index] of [[0,-1],[1,0],[2.999,0],[3,-1],[4,-1],[5,1],[8,-1],[1.5,0]]) assert.equal(W.activeRow(rows,time), index);
});
test('a valid local preview overrides the prepared version; stale drafts cannot hide it', () => {
  const prepared=timed(), draft=timed(); draft.preview=true;
  assert.equal(W.selectTimeline(draft,prepared,20),draft);
  draft.rows[0].end=null;
  assert.equal(W.selectTimeline(draft,prepared,20),prepared);
  assert.equal(W.selectTimeline(draft,prepared,25),null);
  draft.preview=false;
  assert.equal(W.selectTimeline(draft,null,20),null);
});
test('validation rejects missing ends, overlap, wrong duration and text coverage', () => {
  assert.equal(W.validate(timed(),20).ready,true);
  for (const modify of [d=>d.rows[0].end=null,d=>d.rows[1].start=2,d=>d.rows[1].end=22,d=>d.rows[1].en='',d=>d.language='und']) {
    const d=timed(); modify(d); assert.equal(W.validate(d,20).ready,false);
  }
  assert.equal(W.validate(timed(),25).ready,false);
});
test('Japanese requires romaji plus English; mixed Chinese requires pinyin', () => {
  const d = timed(); d.language='ja'; assert.equal(W.validate(d).ready,false);
  d.rows.forEach(r=>r.romaji='romaji'); assert.equal(W.validate(d).ready,true);
  d.language='zh-en'; assert.equal(W.validate(d).ready,false);
  d.rows.forEach(r=>r.pinyin='pin yin'); assert.equal(W.validate(d).ready,true);
});
test('timed words must cover actual text and remain inside their parent line', () => {
  const d=timed(); d.rows[0].words.en=[{text:'First',start:1,end:2},{text:'line',start:2,end:3}];
  assert.equal(W.validate(d).ready,true);
  assert.equal(W.wordState(d.rows[0].words.en[0],0),'waiting');
  assert.equal(W.wordState(d.rows[0].words.en[0],1),'singing');
  assert.equal(W.wordState(d.rows[0].words.en[0],2),'sung');
  d.rows[0].words.en[1].end=4; assert.equal(W.validate(d).ready,false);
  d.rows[0].words.en[1].end=3; d.rows[0].words.en[1].text='wrong'; assert.equal(W.validate(d).ready,false);
});
test('imports reject another recording, duplicate IDs, bad numeric types and unsupported schema', () => {
  const d=timed(); assert.deepEqual(W.decode(JSON.stringify(d),recording),d);
  assert.throws(()=>W.decode(d,'songs/cover.m4a'));
  for (const mutate of [x=>x.schemaVersion=2,x=>x.rows[1].id=x.rows[0].id,x=>x.rows[0].start='1',x=>x.duration=-1,x=>x.rows[0].en={}]) {
    const x=timed(); mutate(x); assert.throws(()=>W.decode(x,recording));
  }
});
test('markup remains literal text, not executable HTML', () => {
  const d=W.mergeLane(W.fresh(recording),'en','<img src=x onerror=alert(1)>');
  assert.equal(W.decode(d,recording).rows[0].en,'<img src=x onerror=alert(1)>');
  const code=fs.readFileSync(path.resolve(__dirname,'../lyric-workbench.js'),'utf8');
  assert(!code.includes('innerHTML')); assert(!code.includes('requestAnimationFrame'));
});
test('all seven prepared lyric packets retain untimed status and omit scraped recommendations', () => {
  const folder=path.resolve(__dirname,'../songs/lyrics/drafts');
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  assert.equal(manifest.length,7); let count=0;
  for(const entry of manifest){
    const d=W.decode(JSON.parse(fs.readFileSync(path.join(folder,entry.file))),entry.recording);
    assert.equal(d.rows.length,entry.lines); count+=d.rows.length;
    assert(d.rows.every(r=>r.start===null&&r.end===null)); assert.equal(d.preview,false);
    assert(!JSON.stringify(d.rows).includes('You might also like'));
    assert(!JSON.stringify(d.rows).includes('https://genius.com'));
  }
  assert.equal(count,334);
});

test('all seven exact recordings have complete, valid publication-approved timelines', () => {
  const folder=path.resolve(__dirname,'../songs/lyrics/aligned');
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
  assert.equal(manifest.length,7);
  for(const entry of manifest) {
    const source=JSON.parse(fs.readFileSync(path.join(folder,entry.file)));
    const d=W.decode(source,entry.recording);
    assert.equal(source.alignment.approved,true);
    assert.equal(source.alignment.status,'approved');
    assert.equal(entry.status,'approved');
    assert.match(source.alignment.audioSha256,/^[a-f0-9]{64}$/);
    assert.equal(W.validate(d,d.duration).ready,true,entry.file);
    assert.equal(d.rows.length,entry.lines);
    assert(d.rows.every(r=>Object.values(r.words).some(words=>words.length)));
    assert(d.rows.every(r=>Object.values(r.words).flat().every(w=>w.end>w.start)));
  }
});

test('reviewed timing repairs preserve final choruses and genuine rests', () => {
  const read=name=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../songs/lyrics/aligned',name+'.json')));
  const dynamite=read('dynamite');
  assert(dynamite.rows.at(-1).start>189&&dynamite.rows.at(-1).end<195);
  assert.equal(W.activeRow(dynamite.rows,178),54);
  const romantic=read('ever-romantic');
  assert.equal(W.activeRow(romantic.rows,200),-1);
  assert.equal(W.activeRow(romantic.rows,209),romantic.rows.length-1);
  const petal=read('petal-lament');
  assert.equal(W.activeRow(petal.rows,85),-1);
  const science=read('science-jp');
  assert.equal(W.activeRow(science.rows,145),-1);
});
