import {describe,it,expect} from 'vitest';
import {createGame,restoreGame} from '../../src/engine';
import * as combatModule from '../../src/combat';
import {loadContent} from '../../src/content';
import {spawnEnemy} from '../../src/contracts/runtime';
import {createSaveStore} from '../../src/persistence';
import type {GameConfig,GameEngine,GameState,GameCommand,DamagePacket,Tiers,EffectDef} from '../../src/contracts';
import {fixture,tower,options,paths,tiers,legal,towerIds,profile} from './fixtures';

const combat=()=>combatModule.createCombat();
function command(e:GameEngine,c:GameCommand){
 const r=e.dispatch({actor:'p1',...c});expect(r.ok,JSON.stringify(c)+' '+r.reason).toBe(true);return r;
}
function place(e:GameEngine,id='needle',x=80,y=300,actor='p1'){
 const r=command(e,{type:'place',tower:id,pos:{x,y},actor});
 expect(r.entity).toBeDefined();return r.entity!;
}
function rejected(e:GameEngine,c:GameCommand){
 const before=e.getSnapshot();expect(e.dispatch({actor:'p1',...c}).ok,JSON.stringify(c)).toBe(false);
 const after=e.getSnapshot();
 expect({credits:after.credits,towers:after.towers,stats:after.stats}).toEqual({credits:before.credits,towers:before.towers,stats:before.stats});
}
function build(c:GameConfig,opts=options(c)){return createGame(c,opts,combat());}
function upgrade(e:GameEngine,id:string,t:Tiers,actor='p1'){
 for(const p of paths)for(let i=0;i<t[p];i++)command(e,{type:'upgrade',tower:id,path:p,actor});
}
function rich(c:GameConfig){c.difficulties[0].startCredits=100000000;c.startCredits=100000000;return c;}
const effect=(id:string,power:number):EffectDef=>({id,kind:'aura',stat:'discount',power,radius:200,interval:1,duration:0,cap:0});
function memoryStorage():Storage{
 const entries=new Map<string,string>();
 return {get length(){return entries.size;},clear(){entries.clear();},getItem(k){return entries.get(k)??null;},setItem(k,v){entries.set(k,String(v));},removeItem(k){entries.delete(k);},key(i){return [...entries.keys()][i]??null;}};
}
function damage(s:GameState,c:GameConfig,id:string,amount:number){
 // Base stub does not export damageEnemy yet. Its absence must fail this test.
 const fn:unknown=Reflect.get(combatModule,'damageEnemy');
 if(typeof fn!=='function')throw Error('damageEnemy is not integrated');
 const packet:DamagePacket={source:'qa-source',damage:amount,element:'kinetic',armorPierce:0,shieldMultiplier:1,bossMultiplier:1,statuses:[]};
 (fn as (s:GameState,c:GameConfig,id:string,p:DamagePacket)=>void)(s,c,id,packet);
}
describe('Authoritative engine upgrade matrix',()=>{
 for(const towerId of towerIds)it(towerId+': legal and rejected edges; all T5 cross-paths',()=>{
  const c=rich(fixture());const actual=loadContent().towers.find(t=>t.id===towerId);
  if(!actual)throw Error('Missing '+towerId);c.towers=[actual];
  const opts=options(c);const e=build(c,opts);const y=actual.placement==='water'?600:200;
  const id=place(e,towerId,200,y);const baseline=e.getSnapshot();
  for(const t of tiers){
   const start=restoreGame(c,structuredClone(baseline),combat());upgrade(start,id,t);
   const snapshot=start.getSnapshot();
   expect(snapshot.towers.find(x=>x.id===id)?.tiers).toEqual(t);
   for(const p of paths){
    const next:Tiers=[...t];next[p]++;
    const branch=restoreGame(c,structuredClone(snapshot),combat());
    const cmd:GameCommand={type:'upgrade',tower:id,path:p};
    if(legal.has(next.join(','))){
     command(branch,cmd);expect(branch.getSnapshot().towers.find(x=>x.id===id)?.tiers).toEqual(next);
     expect(branch.getSnapshot().credits).toBeLessThan(snapshot.credits);
    }else rejected(branch,cmd);
   }
  }
 },60000);
 it('team-wide T5 slot, ownership, sale releases slot; other specialization allowed',()=>{
  const c=rich(fixture());const opts=options(c);opts.players.push({id:'p2',name:'Two',color:'#ff0000',connected:true});
  const e=build(c,opts);const a=place(e,'needle',100,200),b=place(e,'needle',200,200,'p2'),d=place(e,'needle',300,200,'p2');
  upgrade(e,a,[5,0,0]);upgrade(e,b,[4,0,0],'p2');upgrade(e,d,[0,5,0],'p2');
  rejected(e,{type:'upgrade',tower:b,path:0,actor:'p2'});
  rejected(e,{type:'sell',tower:a,actor:'p2'});
  command(e,{type:'sell',tower:a});command(e,{type:'upgrade',tower:b,path:0,actor:'p2'});
  expect(e.getSnapshot().towers.map(t=>t.tiers)).toEqual(expect.arrayContaining([[5,0,0],[0,5,0]]));
 });
 it('strongest support plus knowledge capped at 20%; actual investment and resale loss',()=>{
  const c=fixture();c.knowledgeDiscount=.08;
  const a=tower('support-a');a.category='support';a.effects=[effect('a',.15)];
  const b=tower('support-b');b.category='support';b.effects=[effect('b',.10)];
  c.towers.push(a,b);const e=build(c);
  place(e,a.id,100,200);place(e,b.id,150,200);
  const before=e.getSnapshot().credits;const id=place(e,'needle',200,200);
  expect(before-e.getSnapshot().credits).toBe(80);
  const afterPlace=e.getSnapshot().credits;command(e,{type:'upgrade',tower:id,path:0});
  expect(afterPlace-e.getSnapshot().credits).toBe(40);
  expect(e.getSnapshot().towers.find(t=>t.id===id)?.invested).toBe(120);
  const preSale=e.getSnapshot().credits;command(e,{type:'sell',tower:id});
  expect(e.getSnapshot().credits-preSale).toBe(84);
  expect(before-e.getSnapshot().credits).toBe(36);
 });
 it('rejects illegal placement, insufficient credits and strict-mode sale',()=>{
  const c=fixture();const e=build(c);rejected(e,{type:'place',tower:'needle',pos:{x:100,y:360}});
  rejected(e,{type:'place',tower:'needle',pos:{x:100,y:600}});
  rejected(e,{type:'place',tower:'needle',pos:{x:-1,y:200}});
  const id=place(e);rejected(e,{type:'place',tower:'needle',pos:{x:80,y:300}});
  const poor=fixture();poor.startCredits=1;poor.difficulties[0].startCredits=1;
  rejected(build(poor),{type:'place',tower:'needle',pos:{x:80,y:300}});
  const strict=options(c);strict.modeId='iron-oath';const se=build(c,strict);
  const sid=place(se);rejected(se,{type:'sell',tower:sid});expect(se.getSnapshot().lives).toBe(1);
  expect(e.getSnapshot().towers[0].id).toBe(id);
 });
});
describe('Layer accounting and actual combat',()=>{
 it('fractional payout, regen and persisted paidLayers never pay twice',()=>{
  const c=fixture();const o=options(c);o.modeId='half-cash';
  const e=build(c,o);command(e,{type:'startWave'});const s=e.getSnapshot();
  const foe=spawnEnemy(s,c,'fixture',0,50);
  const start=s.credits;damage(s,c,foe.id,5);expect(s.credits).toBe(start);
  damage(s,c,foe.id,6);expect(foe.paidLayers).toHaveLength(1);expect(s.credits).toBe(start);expect(s.stats.cashSubunits).toBe(50);
  const paid=[...foe.paidLayers];
  // Restore HP across the paid threshold to model a completed regeneration cycle.
  foe.hp=30;damage(s,c,foe.id,11);expect(foe.paidLayers).toEqual(paid);expect(s.stats.cashSubunits).toBe(50);
  const store=createSaveStore(memoryStorage());store.save({version:1,savedAt:'2026-01-01T00:00:00.000Z',contentVersion:c.contentVersion,profile:profile(),run:s});
  const loaded=store.load().run;if(!loaded)throw Error('Missing run after save/load');
  const restored=restoreGame(c,loaded,combat()).getSnapshot();
  const f=restored.enemies.find(x=>x.id===foe.id);if(!f)throw Error('Missing enemy after restore');
  expect(f.paidLayers).toEqual(paid);expect(restored.stats.cashSubunits).toBe(50);
  damage(restored,c,f.id,100);expect(restored.credits-start).toBe(1);expect(restored.stats.cashSubunits).toBe(50);
  damage(restored,c,f.id,100);expect(restored.credits-start).toBe(1);expect(restored.stats.cashSubunits).toBe(50);
 });
 it('regen actually heals without resetting paid layer identity',()=>{
  const c=fixture();const e=build(c);command(e,{type:'startWave'});const s=e.getSnapshot();
  const f=spawnEnemy(s,c,'fixture',0,50);damage(s,c,f.id,11);const paid=[...f.paidLayers];const cash=s.credits;
  const restored=restoreGame(c,s,combat());for(let i=0;i<180;i++)restored.step(1/60);
  const after=restored.getSnapshot();const healed=after.enemies.find(x=>x.id===f.id);
  expect(healed).toBeDefined();expect(healed!.hp).toBeGreaterThan(20);expect(healed!.hp).toBeLessThanOrEqual(30);
  expect(healed!.paidLayers).toEqual(paid);expect(after.credits).toBe(cash);
 });
 it('real engine and combat win a bounded seeded wave; exact credits and replay',()=>{
  const run=()=>{
   const c=fixture();const e=build(c);place(e);command(e,{type:'startWave'});
   const before=e.getSnapshot();command(e,{type:'pause',value:true});e.step(1);
   expect(e.getSnapshot().tick).toBe(before.tick);command(e,{type:'pause',value:false});
   const events=[];for(let i=0;i<1200;i++){
    e.step(1/60);events.push(...e.drainEvents());const s=e.getSnapshot();
    expect(s.enemies.length).toBeLessThanOrEqual(1800);expect(s.credits).toBeGreaterThanOrEqual(0);
    if(s.phase==='victory'||s.phase==='defeat')break;
   }
   const s=e.getSnapshot();expect(s.phase,'seed '+s.options.seed).toBe('victory');expect(s.lives).toBe(150);
   expect(s.credits).toBe(887);expect(s.stats.kills).toBe(1);
   expect(events.filter(x=>x.kind==='layerBreak')).toHaveLength(3);
   expect(events.filter(x=>x.kind==='kill')).toHaveLength(1);
   expect(events.filter(x=>x.kind==='waveEnd')).toHaveLength(1);
   expect(events.map(x=>x.id)).toEqual([...new Set(events.map(x=>x.id))]);
   e.step(1);expect(e.getSnapshot().credits).toBe(887);
   return {state:s,events};
  };expect(run()).toEqual(run());
 });
});
