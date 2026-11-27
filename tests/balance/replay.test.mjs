import {describe,it,expect} from 'vitest';
import {matrix,profiles,optionsFor,recordRun,replay,canonical,digest,MODES,DIFFICULTIES} from '../../src/balance/replay.mjs';
import {positions,sampleLanes} from '../../src/balance/strategies.mjs';

const config={contentDigest:'fixture-not-game',maps:Array.from({length:20},(_,i)=>({id:'m'+i,campaignIndex:i+1,recommendedDifficulty:DIFFICULTIES[Math.floor(i/5)]})),
 campaign:Array.from({length:20},(_,i)=>({id:'n'+i,mapId:'m'+i,prerequisites:i?['n'+(i-1)]:[],unlocks:i===0?['new-tower']:[]})),
 towers:['needle','cannon','frost','beacon','new-tower'].map(id=>({id})),
 modes:MODES.map(id=>({id})),difficulties:DIFFICULTIES.map(id=>({id}))};
const cell=matrix(config)[0];
function fakeEngine(options){
 const s={options,tick:0,time:0,wave:0,phase:'build',credits:100,lives:1,rules:{rounds:2,maxLives:1},towers:[],stats:{spent:0,earned:0},events:[]};
 return {
  getSnapshot:()=>structuredClone(s),
  drainEvents:()=>[],
  dispatch(c){
   if(c.type==='place'){
    if(s.credits<60||!options.unlockedTowers.includes(c.tower))return {ok:false};
    s.credits-=60;s.stats.spent+=60;
    const id='t'+s.towers.length;s.towers.push({id,defId:c.tower,tiers:[0,0,0],invested:60,damageDealt:0,generated:0,kills:0});
    return {ok:true,entity:id,amount:60};
   }
   if(c.type==='startWave'&&s.phase==='build'){s.wave++;s.phase='wave';return {ok:true};}
   return {ok:false};
  },
  step(dt){
   if(s.phase!=='wave')return;
   s.tick+=Math.round(dt*60);s.time=s.tick/60;
   s.phase=s.wave===2?'victory':'build';
  }
 };
}
const policy=({state,issue})=>{
 if(state().wave===0){
  issue({type:'place',tower:'locked',pos:{x:10,y:10},actor:'p1'});
  issue({type:'place',tower:'needle',pos:{x:10,y:10},actor:'p1'});
  issue({type:'place',tower:'needle',pos:{x:20,y:20},actor:'p1'});
 }
};
const run=()=>recordRun(config,cell,73,{id:'fixture'},fakeEngine,policy);

describe('balance replay infrastructure — fixture only',()=>{
 it('enumerates exact matrix, pre-clear and post-clear profiles',()=>{
  expect(matrix(config).length).toBe(200);
  expect(matrix(config,'expanded').length).toBe(800);
  expect(matrix(config,'gate',[1,2,4]).length).toBe(600);
  expect(profiles(config)[0].before).not.toContain('new-tower');
  expect(matrix(config).find(x=>x.modeId==='half-cash').availableTowers).toContain('new-tower');
  expect(optionsFor({...cell,players:4},73).players.map(p=>p.id)).toEqual(['p1','p2','p3','p4']);
  expect(optionsFor(cell,73).knowledge).toEqual([]);
 });
 it('rejects incomplete catalogs',()=>expect(()=>matrix({...config,maps:config.maps.slice(1)})).toThrow());
 it('records only accepted commands and replays exact digest',()=>{
  const r=run();
  expect(r.actions.map(x=>x.command.type)).toEqual(['place','startWave','startWave']);
  expect(r.result.credits).toBe(40);
  expect(r.result.won).toBe(true);
  expect(replay(config,r,fakeEngine)).toEqual(r.result);
  expect(run().digest).toBe(r.digest);
 });
 it('rejects altered replay result, digest, cost, tick, checkpoints, and content',()=>{
  const r=run();
  for(const mutate of [
   x=>x.result.credits++,x=>x.digest='bad',x=>x.actions[0].result.amount++,
   x=>x.actions[0].tick++,x=>x.bossCheckpoints.push({wave:10}),x=>x.contentDigest='other',
   x=>x.options.knowledge.push('fake')
  ]){
   const copy=structuredClone(r);mutate(copy);expect(()=>replay(config,copy,fakeEngine)).toThrow();
  }
 });
 it('rejects stalled engine and tick budget exhaustion',()=>{
  expect(()=>recordRun(config,cell,73,{id:'fixture'},o=>({...fakeEngine(o),step(){}}),policy)).toThrow(/progress/);
  expect(()=>recordRun(config,cell,73,{id:'fixture'},fakeEngine,policy,15)).toThrow(/Tick limit/);
 });
 it('canonicalizes key order and uses SHA-256',()=>{
  expect(canonical({b:1,a:2})).toBe('{"a":2,"b":1}');
  expect(digest({b:1,a:2})).toBe(digest({a:2,b:1}));
  expect(digest('abc')).toMatch(/^[0-9a-f]{64}$/);
  expect(()=>digest({a:NaN})).toThrow();
 });
 it('excludes path, blocked ground and water footprints',()=>{
  const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
  const map={lanes:[[{x:0,y:360},{x:1280,y:360}]],pathWidth:30,blocked:[rect(0,0,320,720)],water:[rect(640,0,640,720)]};
  const def={footprint:12,category:'weapon',attack:{range:150},effects:[],placement:'land'};
  const s=sampleLanes(map),land=positions(map,def,s),water=positions(map,{...def,placement:'water'},s);
  expect(land.length).toBeGreaterThan(0);expect(water.length).toBeGreaterThan(0);
  expect(land.every(({p})=>p.x>=332&&p.x<=628&&Math.abs(p.y-360)>=27)).toBe(true);
  expect(water.every(({p})=>p.x>=652&&Math.abs(p.y-360)>=27)).toBe(true);
 });
});
