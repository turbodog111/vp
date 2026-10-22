const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const SHARED = fs.readFileSync(path.join(ROOT, 'demos/shared/immersive.js'), 'utf8');
const noop = () => {};

// Run the actual production functions, with deterministic media/timer dependencies.
function extract(source, name) {
  const match = new RegExp('^( *)(?:async )?function ' + name + '\\(', 'm').exec(source);
  assert.ok(match, 'production function exists: ' + name);
  const end = source.indexOf('\n' + match[1] + '}\n', match.index);
  assert.ok(end > match.index, 'function end: ' + name);
  return source.slice(match.index, end + match[1].length + 2);
}
function context(names, values = {}, source = APP) {
  const c = vm.createContext({ console: { warn: noop, error: noop }, performance: { now: () => 100 },
    setTimeout, clearTimeout, URL, AbortController, setSongMotionFxActive: noop, ...values });
  vm.runInContext(names.map(name => extract(source, name)).join('\n'), c);
  return c;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function element() {
  const classes = new Set();
  return { textContent: '', value: '', hidden: false, disabled: false, dataset: {}, children: [],
    style: { setProperty: noop }, classList: { add: x => classes.add(x), remove: x => classes.delete(x),
      contains: x => classes.has(x), toggle(x, on) { if (on) classes.add(x); else classes.delete(x); } },
    append(x) { this.children.push(x); }, appendChild(x) { this.children.push(x); },
    replaceChildren() { this.children = []; this.rebuilds = (this.rebuilds || 0) + 1; } };
}
function clockContext(extra = {}, names = []) {
  const song = { id: 'a', url: 'a.m4a' };
  const audio = { src: 'a.m4a', currentTime: 0, paused: false, muted: true, seeking: false, readyState: 4,
    volume: 0.2, play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; }, load: noop, removeAttribute(name) { if (name === 'src') this.src = ''; } };
  const c = context(['capturePlaybackOperation', 'playbackOperationIsCurrent', 'clearSeekSettleTimer',
    'cancelSeekTransaction', 'setPlaybackIntent', 'pausePlayback', ...names], {
    song, audio, currentSong: () => c.song, songClockId: s => (s || c.song)?.id,
    playbackAttemptSerial: 1, playbackIntentSerial: 1, playbackWantsToPlay: true,
    playbackFailed: false, playbackRetryCount: 0, playbackRetryTimer: 0, seekTransaction: null,
    seekSettleTimer: null, seekPointerActive: false, pendingClockSeekTime: null,
    pauseCalibratedClock: noop, resetCalibratedClock: noop, updatePlaybackVisuals: noop,
    ensureCalibratedClock: noop, currentCalibratedTime: () => c.audio.currentTime,
    nativePlaybackTime: () => c.audio.currentTime, effectiveDuration: () => 180,
    nativeFromCalibratedTime: x => x, clamp: (a,b,x) => Math.max(a,Math.min(b,x)),
    showToast: noop, ...extra
  });
  return c;
}

test('F1: hidden ancestors and zero/tiny panels never schedule resize retries', () => {
  for (const [parent, size] of [[null, 0], [{}, 0], [{}, 5]]) {
    let scheduled = 0;
    const panel = { offsetParent: parent, getBoundingClientRect: () => ({width:size,height:size}) };
    const canvas = { closest: () => panel };
    const c = context(['resizeWaveform'], { $: () => canvas, getComputedStyle: () => ({display:'grid'}),
      adaptiveCanvasDpr: () => 1, requestAnimationFrame: () => scheduled++, waveSizeKey:'' });
    for (let i=0;i<100;i++) c.resizeWaveform(true);
    assert.equal(scheduled, 0);
  }
});
test('F1: repeated layout invalidations coalesce and resize visible buffers', () => {
  let callback, scheduled=0;
  const c = context(['scheduleNowLayoutSync'], { nowLayoutRaf:0,
    requestAnimationFrame(fn) { callback=fn; return ++scheduled; },
    resizeWaveform:noop, resizeFxCanvas:noop, waveSizeKey:'', fxSizeKey:'',
    document:{body:{classList:{contains:()=>false}}} });
  for(let i=0;i<100;i++) c.scheduleNowLayoutSync();
  assert.equal(scheduled,1); callback();
  for(let i=0;i<100;i++) c.scheduleNowLayoutSync();
  assert.equal(scheduled,2); callback(); assert.equal(c.nowLayoutRaf,0);
});
test('F2: same-theme song switches still activate the next theater', () => {
  let activations=0;
  const c=context(['updateFxState'], { activeFxTheme:()=> 'story-theater', songClockId:()=> 'compass',
    renderedFxTheme:'story-theater', renderedFxSongId:'waiting', renderedFxLevel:0, tetoGlowLevel:0,
    audio:{paused:true}, FX_LEVEL_PROPERTIES:{}, syncReferenceVideo:noop,
    document:{body:element()}, setStoryTheaterActive:()=>activations++,
    setTrickHeartOverlayActive:noop, setOneMoreBiteTheaterActive:noop,
    setHeroStoryTheaterActive:noop, setEncoreTheaterActive:noop, usesParallelLyrics:()=>false });
  c.updateFxState(); assert.equal(activations,1);
  c.updateFxState(); assert.equal(activations,1);
});
test('MIMI: resizing a paused scene repaints once after canvas resizing', () => {
  let callback;
  const operations = [];
  const c = context(['scheduleNowLayoutSync'], { nowLayoutRaf: 0,
    requestAnimationFrame(fn) { callback = fn; return 1; }, audio: { paused: true },
    resizeWaveform: () => operations.push('wave-size'), resizeFxCanvas: () => operations.push('fx-size'),
    drawWaveform: idle => operations.push(idle ? 'paused-frame' : 'playing-frame'),
    waveSizeKey: '', fxSizeKey: '',
    document: { body: { classList: { contains: name => name === 'song-motion-fx-active' } } }
  });
  c.scheduleNowLayoutSync(); callback(); callback();
  assert.deepEqual(operations, ['wave-size', 'fx-size', 'paused-frame']);
});
test('MIMI: compact canvas dimensions preserve the view aspect ratio', () => {
  const canvas = { width: 0, height: 0 };
  const view = { getBoundingClientRect: () => ({ width: 300, height: 114 }) };
  const c = context(['resizeFxCanvas'], { $: id => id === 'teto-fx' ? canvas : view,
    adaptiveCanvasDpr: () => 1, fxSizeKey: '',
    document: { body: { classList: { contains: () => true } } }
  });
  c.resizeFxCanvas(true);
  assert.equal(canvas.width, 300); assert.equal(canvas.height, 114);
});
test('MIMI: the desktop bridge stays inactive for in-app-only scenes', () => {
  const c = context(['publishDesktopEffectsState'], {
    lastDesktopEffectsPublishAt: 0, currentSong: () => ({ path: 'songs/petal.m4a' }),
    activeFxTheme: () => 'mimi-petal', desktopEffectsVariant: () => 'off', tetoFxEnabled: true,
    audio: { src: 'petal.m4a', paused: false }, currentCalibratedTime: () => 15,
    supportedLyricTrackForSong: () => null, effectProfileForSong: () => null, effectSectionAt: () => null,
    smoothedLevel: 0.6, tetoRiseEnergy: 0.1, tetoGlowLevel: 0.6, tetoFxLevel: 0.6,
    clamp: (a, b, x) => Math.max(a, Math.min(b, x)), effectiveDuration: () => 179,
    CustomEvent: class { constructor(name, data) { this.detail = data.detail; } },
    window: { dispatchEvent: noop }
  });
  c.publishDesktopEffectsState(true);
  assert.equal(c.window.__vpDesktopEffectsState.active, false);
  assert.equal(c.window.__vpDesktopEffectsState.playing, false);
  assert.equal(c.window.__vpDesktopEffectsState.variant, 'off');
});
test('Japanese story companions render without changing source word timing and clear during gaps', () => {
  const controls = Object.fromEntries(['story-current', 'story-previous', 'story-next'].map(id => [id, element()]));
  const c = context(['renderStoryTheaterLine'], {
    $: id => controls[id], supportedLyricsWordNodes: [], storyLyricsWordLanes: [],
    document: { createElement: element, createTextNode: text => ({ textContent: text }) },
    storyTheaterVariant: () => 'window-jp', storyInterludeText: () => '',
    measuredWordTimings: line => line.words || [],
  });
  const data = { language: 'ja', lines: [{ text: 'source', start: 1, end: 2,
    words: [{ word: 'source', start: 1.1, end: 1.8 }] }], translations: [{ romaji: 'romaji sample', en: 'English sample' }] };
  c.renderStoryTheaterLine(0, data, 1.5);
  assert.equal(controls['story-current'].children.length, 3);
  assert.equal(controls['story-current'].children[1].lang, 'ja-Latn');
  assert.equal(controls['story-current'].children[2].textContent, 'English sample');
  assert.equal(c.supportedLyricsWordNodes[0].start, 1.1);
  assert.equal(c.supportedLyricsWordNodes[0].end, 1.8);
  assert.equal(controls['story-next'].hidden, true);
  c.renderStoryTheaterLine(-1, data, 2.5);
  assert.equal(controls['story-current'].children.length, 1);
  assert.equal(controls['story-current'].classList.contains('is-multilingual'), false);
  assert.equal(controls['story-next'].hidden, false);
});
test('F2: every ordered pair in each shared lyric theater family invalidates song identity',()=>{
  const declaration='const SUPPORTED_LYRIC_TRACKS = ';
  const start=APP.indexOf(declaration)+declaration.length;
  const registry=vm.runInNewContext('('+APP.slice(start,APP.indexOf('\n};',start)+2)+')');
  const families=new Map();
  Object.entries(registry).forEach(([key,config])=>{
    if(!families.has(config.scene))families.set(config.scene,[]);
    families.get(config.scene).push(key);
  });
  let pairs=0;
  for(const [theme,keys] of families)for(const from of keys)for(const to of keys){
    if(from===to)continue;
    let activations=0;
    const c=context(['updateFxState'],{activeFxTheme:()=>theme,songClockId:()=>to,
      renderedFxTheme:theme,renderedFxSongId:from,renderedFxLevel:0,tetoGlowLevel:0,
      audio:{paused:true},FX_LEVEL_PROPERTIES:{},syncReferenceVideo:noop,
      document:{body:element()},setStoryTheaterActive:()=>activations++,
      setTrickHeartOverlayActive:noop,setOneMoreBiteTheaterActive:noop,
      setHeroStoryTheaterActive:noop,setEncoreTheaterActive:noop,usesParallelLyrics:()=>false});
    c.updateFxState();assert.equal(c.renderedFxSongId,to);assert.equal(activations,1);pairs++;
  }
  assert.ok(pairs>50);
});
test('F2: Hero variants reload even when the theater is already active', () => {
  let loaded;
  const c=context(['setHeroStoryTheaterActive'], { currentSong:()=>({}), isHeroStorySong:()=>true,
    supportedLyricTrackForSong:()=>({key:'rie'}), heroStorySceneActive:true,
    supportedLyricsSongKey:'mili', $:()=>element(), document:{body:element()},
    loadSupportedLyrics:config=>loaded=config.key, updateHeroStoryLyrics:noop, drawHeroStoryFx:noop,
    currentCalibratedTime:()=>0, scheduleNowLayoutSync:noop });
  c.setHeroStoryTheaterActive(true); assert.equal(loaded,'rie');
});
test('F3: old seek cannot control a different media generation or clock', () => {
  const c=clockContext({ calibratedBaseTime:0, calibratedBasePerf:0, calibratedClockRunning:false,
    audioElementMatchesCurrentSong:()=>true }, ['currentCalibratedTime']);
  c.seekTransaction={...c.capturePlaybackOperation(),targetTime:90};
  c.playbackAttemptSerial++;
  assert.equal(c.currentCalibratedTime(),0);
  assert.equal(c.seekTransaction,null);
});
test('F3: pause cancels seek settlement and never resumes it', () => {
  let resumes=0;
  const c=clockContext({resumeAudioFromCalibratedClock:()=>resumes++},['finishSeekTransaction']);
  const tx={...c.capturePlaybackOperation(),targetTime:25,resumeAfterSeek:true};
  c.seekTransaction=tx;
  c.pausePlayback(); c.finishSeekTransaction(tx);
  assert.equal(resumes,0); assert.equal(c.audio.paused,true);
});
test('F3: only the current seek may settle and resume', () => {
  let resumes=0;
  const c=clockContext({resumeAudioFromCalibratedClock:()=>resumes++},['finishSeekTransaction']);
  const old={...c.capturePlaybackOperation(),targetTime:12,resumeAfterSeek:true};
  const next={...old,targetTime:40};
  c.seekTransaction=next;
  c.finishSeekTransaction(old); assert.equal(resumes,0); assert.equal(c.seekTransaction,next);
  c.finishSeekTransaction(next); assert.equal(resumes,1); assert.equal(c.seekTransaction,null);
});
test('F3: seek fallback fails closed instead of resuming an unsettled target', () => {
  let timeout;
  const c=clockContext({setTimeout:fn=>{timeout=fn;return 1;}, setNativeTimeFromCalibratedClock:()=>true},
    ['commitSeekTransaction','finishSeekTransaction']);
  c.seekTransaction={...c.capturePlaybackOperation(),targetTime:50,resumeAfterSeek:true};
  c.commitSeekTransaction(); timeout();
  assert.equal(c.playbackWantsToPlay,false); assert.equal(c.seekTransaction,null);
});
test('F4: stale play completion cannot apply old song state', async () => {
  const pending=deferred(); let applied=0,graph=0;
  const c=clockContext({usesNativeAudioPath:()=>false, audioSource:null, analyser:null, audioCtx:null,
    playerVolume:.2, mediaTransitionPending:false, primeAudioContextForGesture:()=>pending.promise,
    activateAudioGraphIfPossible:async()=>graph++, setSpatialSong:()=>applied++, updateTimingDebug:noop},
    ['resumeAudioFromCalibratedClock']);
  const request=c.resumeAudioFromCalibratedClock();
  await Promise.resolve(); c.song={id:'b'}; c.playbackAttemptSerial++;
  pending.resolve(); await request;
  assert.equal(applied,0); assert.equal(graph,0);
});
test('F4: paused pending play completion cannot activate graph', async () => {
  const pending=deferred(); let graph=0;
  const c=clockContext({usesNativeAudioPath:()=>false, audioSource:null, analyser:null, audioCtx:null,
    playerVolume:.2, mediaTransitionPending:false, primeAudioContextForGesture:()=>pending.promise,
    activateAudioGraphIfPossible:async()=>graph++, setSpatialSong:noop, updateTimingDebug:noop},
    ['resumeAudioFromCalibratedClock']);
  const request=c.resumeAudioFromCalibratedClock();
  await Promise.resolve(); c.pausePlayback(); pending.resolve(); await request;
  assert.equal(graph,0); assert.equal(c.audio.paused,true);
});
test('F4: expected aborted play rejects neither the UI nor a later command', async () => {
  const c=clockContext({usesNativeAudioPath:()=>true, audioSource:null, analyser:null, playerVolume:.2,
    mediaTransitionPending:false, updateTimingDebug:noop},['resumeAudioFromCalibratedClock']);
  c.audio.play=()=>Promise.reject(Object.assign(new Error('cancelled'),{name:'AbortError'}));
  assert.equal(await c.resumeAudioFromCalibratedClock(),false);
  assert.equal(c.playbackWantsToPlay,false);
});
test('F4: graph activation rechecks ownership after AudioContext resume',async()=>{
  const pending=deferred();let applied=0;
  const c=clockContext({usesNativeAudioPath:()=>false,audioSource:{},
    ensureAudioContext:()=>({state:'suspended',resume:()=>pending.promise}),
    outputGain:{gain:{value:.2}},playerVolume:.2,applyEqualizerToGraph:()=>applied++},
    ['activateAudioGraphIfPossible']);
  const request=c.activateAudioGraphIfPossible();c.pausePlayback();pending.resolve();
  assert.equal(await request,false);assert.equal(applied,0);
});
test('F5: a delayed error retry does not override Pause', () => {
  let callback,resumes=0;
  const c=clockContext({mediaEventMatchesExpectedSong:()=>true, queueIndex:0, mediaTransitionPending:false,
    setTimeout:fn=>{callback=fn;return 1;}, resumeAudioFromCalibratedClock:()=>resumes++},
    ['retryCurrentSongAfterError']);
  c.retryCurrentSongAfterError(c.audio); c.pausePlayback(); callback();
  assert.equal(resumes,0);
});
test('F5: retry exhaustion preserves selection for the next explicit Play', () => {
  let restarted=0;
  const c=clockContext({mediaEventMatchesExpectedSong:()=>true, queueIndex:2, mediaTransitionPending:false,
    playbackRetryCount:2, stopProgressClock:noop, updateFxState:noop, playCurrent:()=>restarted++},
    ['retryCurrentSongAfterError','togglePlay']);
  c.retryCurrentSongAfterError(c.audio);
  assert.equal(c.playbackFailed,true); assert.equal(c.playbackWantsToPlay,false);
  c.togglePlay(); assert.equal(restarted,1); assert.equal(c.queueIndex,2);
});
for (const playing of [false,true]) test('F6: reset preserves volume/mute and intent: '+playing, async () => {
  let resumed=0,volume;
  const c=clockContext({playbackWantsToPlay:playing, playerVolume:.17, audioSource:{}, analyser:{},
    recreateAudioElementForNativePath(){c.audio={...c.audio,paused:true};},
    setPlayerVolume:v=>{volume=v;}, usesNativeAudioPath:()=>true,
    resumeAudioFromCalibratedClock:async()=>resumed++, updateTimingDebug:noop},
    ['resetAudioOutput']);
  c.audio.paused=!playing; c.audio.muted=true;
  await c.resetAudioOutput();
  assert.equal(volume,.17); assert.equal(c.audio.muted,true); assert.equal(resumed,playing?1:0);
});
test('F6: reset reports failed restoration instead of reporting success',async()=>{
  let notice='';
  const c=clockContext({playerVolume:.17,audioSource:null,analyser:null,
    setPlayerVolume:noop,resumeAudioFromCalibratedClock:async()=>false,
    rememberAudioGraphError:noop,showToast:(_,text)=>notice=text},['resetAudioOutput']);
  await c.resetAudioOutput();assert.match(notice,/reset failed/);
});
for(const changed of [false,true]) test('F4/6: recreated media restores position only for its recording: '+changed,()=>{
  let metadata;
  const next={...element(),setAttribute:noop,load:noop,currentTime:0,
    addEventListener:(_,fn)=>metadata=fn,removeEventListener:noop};
  const c=clockContext({audioSource:{},analyser:{},eqPreampNode:null,eqFilterNodes:[],outputGain:null,
    playerVolume:.17,document:{createElement:()=>next,body:{appendChild:noop}},
    sameMediaUrl:(a,b)=>a===b},['recreateAudioElementForNativePath']);
  c.audio.currentTime=27;c.recreateAudioElementForNativePath();
  if(changed){c.playbackAttemptSerial++;next.src='b.m4a';}
  metadata();assert.equal(next.currentTime,changed?0:27);assert.equal(next.muted,true);
  assert.equal(next.volume,.17);
});
function libraryContext(fetcher) {
  const a={id:'a',collection:'secular',displayName:'A'},b={id:'b',collection:'secular',displayName:'B'};
  const control=element();
  const c=context(['loadLibrary','toggleShuffle'], { library:[a,b],queue:[1,0],queueIndex:0,
    unshuffledQueue:[0,1],shuffled:true,libraryLoadSerial:0,collectionSnapshots:new Map(),
    COLLECTIONS:[{id:'secular',label:'Secular'}], COLLECTION_ORDER:new Map([['secular',0]]),
    fetchCollection:fetcher, songRef:s=>s?.id, currentSong:()=>c.library[c.queue[c.queueIndex]],
    findSongIndex:id=>c.library.findIndex(s=>s.id===id), $:()=>control,
    renderCollectionFilters:noop,renderLibrary:noop,renderPlaylists:noop,maybeHighlightTravelingSong:noop,
    showToast:noop,activeCollection:'all' });
  return c;
}
test('F7: refreshing shuffled library preserves original order and selected song', async () => {
  const c=libraryContext(async()=>[{id:'x',collection:'secular',displayName:'0'},...c.library]);
  await c.loadLibrary(); c.toggleShuffle();
  assert.equal(c.currentSong().id,'b');
  assert.deepEqual(Array.from(c.queue, i=>c.library[i].id),['a','b']);
});
test('F8: failed collection refresh retains healthy songs and queue', async () => {
  const c=libraryContext(async()=>{throw new Error('offline');});
  await c.loadLibrary();
  assert.equal(c.library.length,2); assert.equal(c.currentSong().id,'b');
});
test('F8: older refresh response cannot overwrite newer data', async () => {
  const old=deferred(); let calls=0;
  const c=libraryContext(()=>++calls===1?old.promise:Promise.resolve([{id:'new',collection:'secular',displayName:'New'}]));
  const first=c.loadLibrary(); await c.loadLibrary();
  old.resolve([{id:'old',collection:'secular',displayName:'Old'}]); await first;
  assert.ok(c.library.some(s=>s.id==='new')); assert.ok(!c.library.some(s=>s.id==='old'));
  assert.equal(c.currentSong().id,'b');
});
test('F8: selection changed during refresh is not rolled back', async () => {
  const fetch=deferred(); const c=libraryContext(()=>fetch.promise);
  const request=c.loadLibrary(); c.queueIndex=1;
  fetch.resolve(c.library.slice()); await request;
  assert.equal(c.currentSong().id,'a');
});
for(const hz of [60,90,120]) test('F9: 30fps pacing at '+hz+'Hz preserves elapsed remainder',()=>{
  const c=context(['visualFrameDue'],{lastVisualFrameAt:0,VISUAL_FRAME_MS:1000/30});
  let frames=0;for(let i=1;i<=hz*10;i++)if(c.visualFrameDue(i*1000/hz))frames++;
  assert.equal(frames,300);
  assert.equal(c.visualFrameDue(60000),true);
  assert.equal(c.visualFrameDue(60000),false);
});
function lyricContext() {
  const nodes={}; const pending=[];
  const c=context(['loadSupportedLyrics'],{
    supportedLyricsData:null,supportedLyricsPromise:null,supportedLyricsSongKey:'',
    supportedLyricsRequestSerial:0,supportedLyricsAbort:null,fetch:()=>{const d=deferred();pending.push(d);return d.promise;},
    $:id=>nodes[id] ||= element(), currentCalibratedTime:()=>0,updateStoryTheaterLyrics:noop,
    updateHeroStoryLyrics:noop, updateEncoreDanceLyrics:noop,updateTrickHeartLyrics:noop, updateOneMoreBiteLyrics:noop
  });
  return {c,pending,nodes};
}
test('F13: failure from a previous request leaves current lyrics and promise alone', async () => {
  const {c,pending,nodes}=lyricContext();
  const old=c.loadSupportedLyrics({key:'old',dataUrl:'old',scene:'story-theater'});
  const next=c.loadSupportedLyrics({key:'new',dataUrl:'new',scene:'story-theater'});
  const currentPromise=c.supportedLyricsPromise;
  pending[0].reject(new Error('old request failed')); await old;
  assert.equal(c.supportedLyricsPromise,currentPromise);
  pending[1].resolve({ok:true,json:async()=>({lines:[],sections:[],song:'new'})}); await next;
  assert.equal(c.supportedLyricsData.song,'new'); assert.equal(nodes['story-current'],undefined);
});
test('F13: old success from an A-B-A request sequence cannot win', async () => {
  const {c,pending}=lyricContext();
  const a={key:'a',dataUrl:'a',scene:'story-theater'};
  const first=c.loadSupportedLyrics(a);
  const second=c.loadSupportedLyrics({key:'b',dataUrl:'b',scene:'story-theater'});
  const third=c.loadSupportedLyrics(a);
  pending[2].resolve({ok:true,json:async()=>({lines:[],sections:[],revision:'new'})}); await third;
  pending[0].resolve({ok:true,json:async()=>({lines:[],sections:[],revision:'old'})}); await first;
  pending[1].reject(new Error('aborted')); await second;
  assert.equal(c.supportedLyricsData.revision,'new');
});
for (const source of [APP,SHARED]) test('F14: lyric intervals have exact handoffs and real gaps: '+(source===APP?'app':'shared'),()=>{
  const c=context(['activeLyricLineIndex'],{},source);
  const lines=[{start:0,end:1},{start:1,end:2},{start:2.5,end:3}];
  assert.equal(c.activeLyricLineIndex(lines,.999),0);
  assert.equal(c.activeLyricLineIndex(lines,1),1);
  assert.equal(c.activeLyricLineIndex(lines,2.1),-1);
  assert.equal(c.activeLyricLineIndex(lines,3),-1);
});
test('F10: shared lyrics retain word node identity between frames and seek backwards',()=>{
  const current=element(),previous=element(),next=element();
  const c=context(['renderLyrics','activeLyricLineIndex','updateWordStates'],{
    data:{lines:[{start:0,end:2,text:'example',words:[{word:'example',start:0,end:1}]}]},
    lyricCurrent:current,lyricPrevious:previous,lyricNext:next,renderedLine:null,renderedWords:[],
    document:{createElement:element,createTextNode:text=>({textContent:text})}
  },SHARED);
  c.renderLyrics(.5); const node=current.children[0];
  c.renderLyrics(1.5); assert.equal(current.children[0],node);assert.equal(current.rebuilds,1);
  assert.equal(node.classList.contains('is-sung'),true);
  c.renderLyrics(.5); assert.equal(node.classList.contains('is-current'),true);
});
for (const demo of ['waiting','compass','violet','psalm']) test('F10: '+demo+' preserves timed word nodes and resets them between lines',()=>{
  const source=fs.readFileSync(path.join(ROOT,'demos',demo+'-theater','demo.js'),'utf8');
  const current=element();
  const c=context(['renderWords'],{lyricCurrent:current,renderedWordLine:null,renderedWordNodes:[],
    document:{createElement:element,createTextNode:text=>({textContent:text})}
  },source);
  const line={text:'example',start:0,end:2,words:[{word:'example',start:0,end:1}]};
  c.renderWords(line,.5);const node=c.renderedWordNodes[0].span;
  c.renderWords(line,1.5);assert.equal(c.renderedWordNodes[0].span,node);
  assert.equal(node.classList.contains('is-sung'),true);
  c.renderWords(line,.5);assert.equal(node.classList.contains('is-current'),true);
  assert.equal(node.classList.contains('is-sung'),false);
  c.renderWords({...line},.5);assert.notEqual(c.renderedWordNodes[0].span,node);
});
test('F14: legacy DDF lyrics honor explicit silence and the last line end',()=>{
  const c=context(['lyricIndexAtTime'],{ddfLyricsCache:{lines:[{t:0,end:1},{t:2,end:3}]}});
  assert.equal(c.lyricIndexAtTime(.99),0);assert.equal(c.lyricIndexAtTime(1),-1);
  assert.equal(c.lyricIndexAtTime(1.99),-1);assert.equal(c.lyricIndexAtTime(2),1);
  assert.equal(c.lyricIndexAtTime(3),-1);
});
test('F11: full-strength encoded energy decodes to 1, not 0.392',()=>{
  const c=context(['decodeEnvelope'],{atob:s=>Buffer.from(s,'base64').toString('binary'),
    clamp:(a,b,x)=>Math.max(a,Math.min(b,x))},SHARED);
  assert.deepEqual(Array.from(c.decodeEnvelope(Buffer.from([0,50,100]).toString('base64'))),[0,.5,1]);
  assert.deepEqual(Array.from(c.decodeEnvelope(Buffer.from([255]).toString('base64'),255)),[1]);
});
test('F15: media is assigned before a lyric request can fail',async()=>{
  let loaded=false;
  const c=context(['load','fetchLyricData'],{data:null,previewMode:false,config:{audioUrl:'song.m4a',lyricsUrl:'missing'},
    audio:{load(){loaded=true;}},fetch:async()=>{throw new Error('offline');}},SHARED);
  await assert.rejects(c.load(),/offline/);assert.equal(loaded,true);assert.equal(c.audio.src,'song.m4a');
});
test('F15: transient lyric failure retries once without reloading media',async()=>{
  let calls=0;
  const c=context(['fetchLyricData'],{fetch:async()=>{
    if(++calls===1)throw Error('offline');return {ok:true,json:async()=>({lines:[]})};
  }},SHARED);
  assert.equal((await c.fetchLyricData('lyrics')).lines.length,0);assert.equal(calls,2);
});
test('F4/12: Stop during pending context resume cannot restart a demo',async()=>{
  const pending=deferred();let plays=0;
  const c=context(['playAudio','pauseAudio','stopAudio'],{playbackIntent:0,wantsPlayback:false,
    playbackStopped:false,stage:element(),seek:element(),currentTimeEl:element(),
    audioContext:{state:'suspended',resume:()=>pending.promise},initAudioGraph:noop,
    audio:{play:async()=>plays++,pause:noop,currentTime:40},renderLoop:{invalidate:noop}},SHARED);
  const request=c.playAudio();c.stopAudio();pending.resolve();
  assert.equal(await request,false);assert.equal(plays,0);assert.equal(c.audio.currentTime,0);
});
test('F4: an obsolete demo play rejection cannot clear a newer play intent',async()=>{
  const pending=deferred();let calls=0;
  const c=context(['playAudio'],{playbackIntent:0,wantsPlayback:false,playbackStopped:false,
    stage:element(),audioContext:null,initAudioGraph:noop,
    audio:{play:()=>++calls===1?pending.promise:Promise.resolve()}},SHARED);
  const first=c.playAudio();await c.playAudio();pending.reject(new Error('old failure'));
  assert.equal(await first,false);assert.equal(c.wantsPlayback,true);
});
function storageContext(initial={}) {
  const disk=new Map(Object.entries(initial)); const controls={};
  const c=context(['readSetting','writeSetting','renderStorageStatus','validatePlaylists','loadPlaylists',
    'loadDeletedDefaults','loadPlaylistOrder','loadCollapsedPlaylists','orderedPlaylistNames',
    'savePlaylistLayout','savePlaylists','createPlaylistFromInput','saveSongEqProfiles','retryPendingStorageWrites'],{
    localStorage:{getItem:key=>disk.get(key)??null,setItem:(key,value)=>disk.set(key,value)},
    pendingStorageWrites:new Map(),storageReadFailures:new Set(),playlistRecoveryRaw:null,playlistRecoveryBackupKey:null,
    DEFAULT_PLAYLISTS:{Default:['a']},RETIRED_DEFAULT_PLAYLISTS:[],DEFAULT_PLAYLISTS_VERSION:'1',
    DELETED_DEFAULTS_STORAGE_KEY:'deleted',PLAYLIST_ORDER_STORAGE_KEY:'order',PLAYLIST_COLLAPSED_STORAGE_KEY:'collapsed',
    SONG_EQ_STORAGE_KEY:'eq',deletedDefaultPlaylists:new Set(),playlistOrder:[],collapsedPlaylists:new Set(),
    songEqProfiles:{a:{enabled:true}},$:id=>controls[id] ||= element(),
    renderPlaylists:noop,renderPlaylistActionPanel:noop,renderEqualizerUi:noop
  });
  return {c,disk,controls};
}
test('F16: inherited names and markup remain safe own-key playlists',()=>{
  const {c}=storageContext(); c.playlists=c.loadPlaylists();
  for(const name of ['constructor','toString','__proto__','a\" <button>']){
    c.createPlaylistFromInput({value:name});
    assert.equal(Object.hasOwn(c.playlists,name),true);assert.equal(Array.isArray(c.playlists[name]),true);
  }
  assert.equal(Object.getPrototypeOf(c.playlists),null);
  assert.ok(!APP.includes('aria-label="Drag ${name}"'));
});
for(const raw of ['null','[]','{bad','{"bad":null,"good":["a",null,"a","b"]}']) test('F17: invalid playlist data is backed up before sanitized replacement: '+raw,()=>{
  const {c,disk}=storageContext({vp_playlists:raw});c.playlists=c.loadPlaylists();
  assert.equal(c.playlistRecoveryRaw,raw);assert.equal(disk.get(c.playlistRecoveryBackupKey),raw);
  if(raw.includes('good')) assert.deepEqual(Array.from(c.playlists.good),['a','b']);
});
test('F17/18: backup failure prevents replacing the original data',()=>{
  const raw='{"broken":null}'; const {c,disk}=storageContext({vp_playlists:raw});
  c.localStorage.setItem=(key,value)=>{if(key.startsWith('vp_playlist_recovery_'))throw Error('quota');disk.set(key,value);};
  c.playlists=c.loadPlaylists();
  assert.equal(disk.get('vp_playlists'),raw);assert.ok(c.pendingStorageWrites.has('vp_playlists'));
});
test('F18: denied reads cannot silently overwrite previously saved data',()=>{
  const {c,disk}=storageContext({vp_playlists:'{"keep":["a"]}'});
  c.localStorage.getItem=()=>{throw Error('denied');};
  c.playlists=c.loadPlaylists();c.savePlaylists();
  assert.equal(disk.get('vp_playlists'),'{"keep":["a"]}');
  assert.ok(c.storageReadFailures.has('vp_playlists'));
});
test('F18: EQ and playlist write failures are retained for retry',()=>{
  const {c,controls}=storageContext();c.playlists=c.loadPlaylists();
  c.localStorage.setItem=()=>{throw Error('quota');};
  assert.equal(c.saveSongEqProfiles(),false);assert.equal(c.savePlaylists(),false);
  assert.equal(c.pendingStorageWrites.has('eq'),true);
  assert.equal(controls['storage-status'].hidden,false);
  assert.match(controls['storage-message'].textContent,/not saved/);
});
test('F17/18: retry saves the original backup and playlists before migration version',()=>{
  const raw='{"broken":null}';const {c,disk}=storageContext({vp_playlists:raw});
  c.localStorage.setItem=()=>{throw Error('quota');};c.playlists=c.loadPlaylists();
  const writes=[];c.localStorage.setItem=(key,value)=>{writes.push(key);disk.set(key,value);};
  c.retryPendingStorageWrites();
  assert.equal(c.pendingStorageWrites.size,0);
  assert.equal(disk.get(c.playlistRecoveryBackupKey),raw);
  assert.ok(writes.indexOf(c.playlistRecoveryBackupKey)<writes.indexOf('vp_playlists'));
  assert.ok(writes.indexOf('vp_playlists')<writes.indexOf('vp_default_playlists_version'));
});
test('F18: a failed migration does not mark the version as saved',()=>{
  const {c,disk}=storageContext();
  c.localStorage.setItem=(key,value)=>{if(key==='vp_playlists')throw Error('quota');disk.set(key,value);};
  c.playlists=c.loadPlaylists();
  assert.equal(disk.has('vp_default_playlists_version'),false);
  assert.equal(c.pendingStorageWrites.has('vp_default_playlists_version'),true);
});
test('F19: a deleted default stays deleted across reload and can be recreated',()=>{
  const {c,disk}=storageContext({deleted:'["Default"]',vp_default_playlists_version:'1'});
  c.deletedDefaultPlaylists=c.loadDeletedDefaults();c.playlists=c.loadPlaylists();
  assert.equal(Object.hasOwn(c.playlists,'Default'),false);
  c.createPlaylistFromInput({value:'Default'});
  assert.equal(c.deletedDefaultPlaylists.has('Default'),false);
  assert.equal(disk.get('deleted'),'[]');
});
test('F12: render loop sleeps while paused/hidden and repaints after seek or resize',()=>{
  const callbacks=new Map(); let seq=0,paints=0;
  function target(extra={}){const events=new Map();return {...extra,
    addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n),
    emit:n=>events.get(n)?.()};}
  const audio=target({paused:true,ended:false}),document=target({hidden:false}),window=target();
  const c=vm.createContext({window,document,
    requestAnimationFrame:fn=>{callbacks.set(++seq,fn);return seq;},
    cancelAnimationFrame:id=>callbacks.delete(id)});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'demos/shared/render-loop.js'),'utf8'),c);
  const loop=window.VPFrameLoop.create(audio,()=>paints++);
  const tick=()=>{const jobs=[...callbacks.values()];callbacks.clear();jobs.forEach(f=>f(100));};
  tick();assert.equal(paints,1);assert.equal(callbacks.size,0);
  audio.paused=false;audio.emit('play');tick();tick();assert.equal(callbacks.size,1);
  audio.paused=true;audio.emit('pause');tick();assert.equal(callbacks.size,0);
  audio.emit('seeked');tick();assert.equal(callbacks.size,0);
  document.hidden=true;document.emit('visibilitychange');window.emit('resize');assert.equal(callbacks.size,0);
  document.hidden=false;document.emit('visibilitychange');assert.equal(callbacks.size,1);
  loop.dispose();assert.equal(callbacks.size,0);
});
