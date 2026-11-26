import type {AudioSystem,GameEvent,Settings} from '../contracts';
import {renderTrack,renderCue,SAMPLE_RATE,type Track,type Scene,type Cue} from './synthesis';

export interface PrismAudio extends AudioSystem {
 setPaused(paused:boolean):void;
 beginRun(nextEvent?:number):void;
 notify(cue:'ready'|'reject'):void;
}
const WINDOW=4096, MAX_VOICES=14, COMBAT_VOICES=9;
const volume=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
class EventWindow {
 private max=-1;private readonly slots=new Float64Array(WINDOW).fill(-1);
 reset(next:number):void{this.max=next-1;this.slots.fill(-1);this.floor=next;}
 private floor=0;
 accept(id:number):boolean {
  if(!Number.isSafeInteger(id)||id<this.floor||id<=this.max-WINDOW)return false;
  const slot=id%WINDOW;if(this.slots[slot]===id)return false;
  this.slots[slot]=id;this.max=Math.max(this.max,id);return true;
 }
}
function cueFor(e:GameEvent):Cue|undefined {
 switch(e.kind){
  case 'shot':case 'projectileSpawn':case 'strikeStart': {
   // The frozen event carries visual/element, not the tower definition ID.
   const v=(e.visual??'').toLowerCase();
   if(/cannon|mortar|rocket|explos|shell|heavy/.test(v))return 'heavy';
   if(/water|tide|coral|harbor/.test(v))return 'water';
   switch(e.element){case 'fire':return 'fire';case 'frost':return 'frost';case 'electric':return 'electric';case 'acid':return 'acid';case 'energy':return 'energy';}
   return /saw|drone|melee|blade/.test(v)?'mechanical':'needle';
  }
  case 'projectileImpact':case 'strikeContact':return 'impact';
  case 'layerBreak':return 'layer';case 'shieldBreak':return 'shield';
  case 'leak':return 'leak';case 'place':return 'purchase';case 'upgrade':return 'upgrade';case 'sell':return 'sell';case 'ability':return 'ability';case 'bossPhase':return 'boss';case 'waveStart':return 'wave';case 'waveEnd':return 'clear';
  default:return undefined; // hit/kill/income may be emitted for every layer; do not stack those with layer cues.
 }
}
const priority=(c:Cue)=>['leak','boss','ability','wave','clear','purchase','upgrade','sell','ready','reject'].includes(c)?2:1;
const cooldown=(c:Cue)=>c==='leak'?.17:c==='boss'?.7:priority(c)===2?.12:c==='layer'?.08:.12;
type Voice={source:AudioBufferSourceNode;gain:GainNode;priority:number};
type MusicVoice=Voice&{track:Track;level:number};

export function createAudio(settings:Settings):PrismAudio {
 let preferences={...settings}, context:AudioContext|undefined, master:GainNode|undefined, music:GainNode|undefined, sfx:GainNode|undefined, limiter:DynamicsCompressorNode|undefined;
 let disposed=false, unlocked=false, pending:Promise<void>|undefined, paused=false, scene:Scene='menu', outcome:'victory'|'defeat'|undefined;
 let current:MusicVoice|undefined, fading:MusicVoice|undefined;
 const voices=new Set<Voice>(), buffers=new Map<string,AudioBuffer>(), last=new Map<Cue,number>(), seen=new EventWindow();
 let combatNext=0, sceneEvent=-1;
 function gainTo(node:GainNode,value:number,seconds:number):void {
  const now=context!.currentTime;const p=node.gain;
  // cancelAndHoldAtTime is supported by the target Chromium runtime.
  if(typeof p.cancelAndHoldAtTime==='function')p.cancelAndHoldAtTime(now);else {p.cancelScheduledValues(now);p.setValueAtTime(p.value,now);}
  if(seconds===0)p.setValueAtTime(value,now);else p.linearRampToValueAtTime(value,now+seconds);
 }
 function apply():void {
  if(!master||!music||!sfx)return;
  gainTo(master,volume(preferences.master),volume(preferences.master)===0?0:.06);
  gainTo(music,volume(preferences.music)*(paused?.32:1)*.70,.12);
  gainTo(sfx,volume(preferences.sfx)*.78,.06);
 }
 function getBuffer(key:Track|Cue,isTrack:boolean):AudioBuffer {
  const cacheKey=(isTrack?'track:':'cue:')+key;const cached=buffers.get(cacheKey);if(cached)return cached;
  const data=isTrack?renderTrack(key as Track):renderCue(key as Cue);
  const b=context!.createBuffer(1,data.length,SAMPLE_RATE);b.getChannelData(0).set(data);buffers.set(cacheKey,b);return b;
 }
 function stop(v:Voice):void {v.source.onended=null;try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();voices.delete(v);}
 function clearSfx():void {for(const v of voices)stop(v);}
 function play(c:Cue):void {
  if(!unlocked||disposed||paused||!context||context.state!=='running'||volume(preferences.master)===0||volume(preferences.sfx)===0)return;
  const p=priority(c),now=context.currentTime;
  if(now-(last.get(c)??-Infinity)<cooldown(c))return;
  if(p===1&&(now<combatNext||voices.size>=COMBAT_VOICES))return;
  if(voices.size>=MAX_VOICES){const victim=[...voices].find(v=>v.priority<p);if(!victim)return;stop(victim);}
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=getBuffer(c,false);
  gain.gain.value=p===1?.48:.8;source.connect(gain);gain.connect(sfx!);
  const v:Voice={source,gain,priority:p};voices.add(v);source.onended=()=>stop(v);source.start();
  last.set(c,now);if(p===1)combatNext=now+.046;
 }
 function syncMusic():void {
  if(!unlocked||disposed||!context||context.state!=='running')return;
  const track:Track=scene==='end'?(outcome??'end'):scene;
  if(current?.track===track)return;
  if(fading){stop(fading);fading=undefined;}
  if(current){const old=current;fading=old;gainTo(old.gain,0,.65);old.source.onended=()=>{stop(old);if(fading===old)fading=undefined;};try{old.source.stop(context.currentTime+.66);}catch{stop(old);fading=undefined;}}
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=getBuffer(track,true);source.loop=scene!=='end';gain.gain.value=0;source.connect(gain);gain.connect(music!);
  const v:MusicVoice={source,gain,track,priority:3,level:1};current=v;
  // Keep completed ending as the current marker so repeated scene updates do not restart it.
  source.onended=()=>{source.disconnect();gain.disconnect();};source.start();gainTo(gain,1,.65);
 }
 function setScene(value:Scene):void {if(disposed)return;if(value!=='end'&&scene==='end')outcome=undefined;scene=value;syncMusic();}
 function consume(events:GameEvent[]):void {
  if(disposed)return;
  // Priority selection happens after dedup, so discarded/muted cues cannot replay on reconnect.
  const queued:Cue[]=[];
  for(const e of events){if(!seen.accept(e.id))continue;
   if(e.id>sceneEvent){
    if(e.kind==='victory'||e.kind==='defeat'){outcome=e.kind;scene='end';sceneEvent=e.id;}
    else if(scene!=='end'){if(e.kind==='waveStart'){scene='wave';sceneEvent=e.id;}else if(e.kind==='waveEnd'){scene='build';sceneEvent=e.id;}else if(e.kind==='bossPhase'){scene='boss';sceneEvent=e.id;}}
   }
   const cue=cueFor(e);if(cue&&!queued.includes(cue))queued.push(cue);
  }
  syncMusic();queued.sort((a,b)=>priority(b)-priority(a));for(const c of queued)play(c);
 }
 async function unlock():Promise<void> {
  if(disposed)return;if(pending)return pending;
  const operation=(async()=>{
   try{
    if(!context){if(typeof AudioContext==='undefined')return;context=new AudioContext();master=context.createGain();music=context.createGain();sfx=context.createGain();limiter=context.createDynamicsCompressor();
     master.gain.value=0;music.gain.value=0;sfx.gain.value=0;limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.004;limiter.release.value=.16;
     music.connect(master);sfx.connect(master);master.connect(limiter);limiter.connect(context.destination);}
    if(context.state!=='running')await context.resume();
    if(disposed)return;unlocked=context.state==='running';apply();syncMusic();
   }catch{unlocked=false;/* Unavailable or blocked device: retry on the next gesture. */}
  })();pending=operation;try{await operation;}finally{if(pending===operation)pending=undefined;}
 }
 return {unlock,setSettings(value){if(disposed)return;preferences={...value};apply();if(volume(value.master)===0||volume(value.sfx)===0)clearSfx();},consume,setScene,
  setPaused(value){if(disposed||paused===value)return;paused=value;if(value)clearSfx();apply();},
  beginRun(next=0){if(disposed)return;if(!Number.isSafeInteger(next)||next<0)throw new RangeError('Invalid event cursor');seen.reset(next);sceneEvent=next-1;last.clear();combatNext=0;clearSfx();outcome=undefined;paused=false;apply();setScene('build');},
  notify(cue){play(cue);},
  dispose(){if(disposed)return;disposed=true;unlocked=false;clearSfx();if(current)stop(current);if(fading)stop(fading);current=fading=undefined;buffers.clear();last.clear();master?.disconnect();music?.disconnect();sfx?.disconnect();limiter?.disconnect();if(context&&context.state!=='closed')void context.close().catch(()=>{});}
 };
}
