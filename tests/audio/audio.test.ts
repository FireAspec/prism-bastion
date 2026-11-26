import {describe,it,expect,vi,afterEach} from 'vitest';
import type {GameEvent,Settings} from '../../src/contracts';
import {createAudio} from '../../src/audio';
import {renderTrack,renderCue,SAMPLE_RATE,type Track,type Cue} from '../../src/audio/synthesis';
const settings:Settings={master:.5,music:.4,sfx:.5,language:'ru',fullscreen:false,reducedMotion:false,quality:'high',colorblind:false};
class Param {value=0;cancelAndHoldAtTime(){}cancelScheduledValues(){}setValueAtTime(v:number){this.value=v;}linearRampToValueAtTime(v:number){this.value=v;}}
class Node {connections=0;connect(){this.connections++;}disconnect(){this.connections=0;}}
class Gain extends Node {gain=new Param();}
class Source extends Node {buffer:BufferMock|null=null;loop=false;onended:(()=>void)|null=null;started=false;stopped=false;start(){this.started=true;}stop(when?:number){if(!when)this.stopped=true;}finish(){this.stopped=true;this.onended?.();}}
class BufferMock {data:Float32Array;constructor(n:number){this.data=new Float32Array(n);}getChannelData(){return this.data;}}
class Context {
 static instances:Context[]=[];currentTime=0;state='suspended';destination=new Node();sources:Source[]=[];gains:Gain[]=[];
 constructor(){Context.instances.push(this);}
 createGain(){const g=new Gain();this.gains.push(g);return g;}
 createDynamicsCompressor(){return Object.assign(new Node(),{threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param()});}
 createBuffer(_:number,n:number){return new BufferMock(n);}
 createBufferSource(){const s=new Source();this.sources.push(s);return s;}
 async resume(){this.state='running';}async close(){this.state='closed';}
}
const event=(id:number,kind:GameEvent['kind']='place'):GameEvent=>({id,time:0,kind});
function setup(){Context.instances=[];vi.stubGlobal('AudioContext',Context);return createAudio(settings);}
function ctx(){return Context.instances[0];}
const activeSfx=()=>ctx().sources.filter(s=>s.started&&!s.stopped&&!s.loop&&s.connections>0);
afterEach(()=>vi.unstubAllGlobals());
describe('audio lifecycle',()=>{
 it('never allocates audio until unlock and discards historical cues',async()=>{const a=setup();a.consume([event(1)]);a.setScene('build');expect(Context.instances.length).toBe(0);await a.unlock();expect(ctx().sources.length).toBe(1);a.consume([event(1)]);expect(activeSfx().length).toBe(0);a.consume([event(2)]);expect(activeSfx().length).toBe(1);a.dispose();expect(ctx().state).toBe('closed');});
 it('zero master immediately mutes and stops SFX; duplicate muted events stay consumed',async()=>{const a=setup();await a.unlock();a.consume([event(1)]);a.setSettings({...settings,master:0});expect(ctx().gains[0].gain.value).toBe(0);expect(activeSfx().length).toBe(0);a.consume([event(2)]);a.setSettings(settings);ctx().currentTime=1;a.consume([event(2)]);expect(activeSfx().length).toBe(0);a.consume([event(3)]);expect(activeSfx().length).toBe(1);a.dispose();});
 it('bounds combat and total active voices across a 60-tower burst',async()=>{const a=setup();await a.unlock();let id=0;for(let j=0;j<100;j++){ctx().currentTime+=.05;a.consume(Array.from({length:60},()=>({...event(id++,'shot'),element:'kinetic' as const})));}expect(activeSfx().length).toBeLessThanOrEqual(9);for(const kind of ['leak','ability','bossPhase','place','upgrade','sell','waveEnd','waveStart'] as const){ctx().currentTime+=.8;a.consume([event(id++,kind)]);}expect(activeSfx().length).toBeLessThanOrEqual(14);a.dispose();});
 it('handles reconnect, out-of-order ids, stale window and new runs',async()=>{const a=setup();await a.unlock();a.consume([event(100)]);ctx().currentTime=1;a.consume([event(99)]);expect(activeSfx().length).toBe(2);ctx().currentTime=2;a.consume([event(100),event(99)]);expect(activeSfx().length).toBe(2);a.consume([event(6000,'hit')]);ctx().currentTime=3;a.consume([event(101)]);expect(activeSfx().length).toBe(2);a.beginRun(10);a.consume([event(9),event(10)]);expect(activeSfx().length).toBe(1);a.dispose();});
 it('pause suppresses battle cues, resumes without replay',async()=>{const a=setup();await a.unlock();a.setPaused(true);expect(ctx().gains[1].gain.value).toBeCloseTo(settings.music*.32*.70);a.consume([event(1)]);a.setPaused(false);a.consume([event(1)]);expect(activeSfx().length).toBe(0);a.consume([event(2)]);expect(activeSfx().length).toBe(1);a.dispose();});
 it('does not restart same scene or ending, cleans fading nodes',async()=>{const a=setup();await a.unlock();a.setScene('wave');a.setScene('wave');expect(ctx().sources.length).toBe(2);a.setScene('boss');expect(ctx().sources.filter(s=>s.connections>0).length).toBe(2);a.consume([event(1,'victory')]);const n=ctx().sources.length;a.setScene('end');a.consume([event(1,'victory')]);expect(ctx().sources.length).toBe(n);a.dispose();expect(ctx().sources.every(s=>s.connections===0)).toBe(true);});
 it('uses different buffers for wave music and wave cue',async()=>{const a=setup();await a.unlock();a.consume([event(1,'waveStart')]);const sources=ctx().sources;expect(sources[1].buffer!.data.length).toBeGreaterThan(SAMPLE_RATE*30);expect(sources[2].buffer!.data.length).toBeLessThan(SAMPLE_RATE*2);a.dispose();});
 it('works without WebAudio',async()=>{vi.stubGlobal('AudioContext',undefined);const a=createAudio(settings);await a.unlock();a.consume([event(1)]);a.setScene('boss');a.dispose();});
});
describe('synthesis',()=>{
 it('renders all arrangements and cues with finite samples, quiet boundaries and headroom',()=>{for(const key of ['menu','build','wave','boss','end','victory','defeat'] as Track[]){const data=renderTrack(key);expect(data[0]).toBe(0);expect(Math.abs(data[data.length-1])).toBe(0);let peak=0;for(const x of data){if(!Number.isFinite(x))throw Error(key);peak=Math.max(peak,Math.abs(x));}expect(peak).toBeGreaterThan(.05);expect(peak).toBeLessThan(.83);}for(const cue of ['needle','heavy','frost','fire','electric','acid','energy','water','mechanical','layer','shield','impact','leak','purchase','upgrade','sell','ability','ready','reject','boss','wave','clear','income'] as Cue[]){const data=renderCue(cue);expect(data.some(x=>Math.abs(x)>.02)).toBe(true);expect(data.every(x=>Number.isFinite(x)&&Math.abs(x)<.83)).toBe(true);}});
});
