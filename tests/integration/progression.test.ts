import {describe,it,expect} from 'vitest';
import {getModes,getDifficulties,resolveRules} from '../../src/modes';
import {createCampaign} from '../../src/campaign';
import {createProgression} from '../../src/progression';
import {loadContent} from '../../src/content';
import type {Difficulty,GameConfig,KnowledgeNode,KnowledgeStat,RunResult,Profile} from '../../src/contracts';
import {caps,fixture,tower,profile,initial,mapIds,unlocks,towerIds,seed} from './fixtures';

const difficulties=[
 ['easy',40,200,1000,.85,.85,100,5,.7],
 ['normal',60,150,900,1,1,80,4,1],
 ['hard',80,100,850,1.1,1.1,60,3,1.35],
 ['extreme',100,1,850,1.2,1.2,50,2,1.7]
] as const;
const modes=['standard','half-cash','no-leaks','iron-oath','short-supply','blackout','stormfront','overdrive','low-tech','no-actives'];
describe('Difficulty and mode matrix',()=>{
 it('exact presets and catalog',()=>{
  const ds=getDifficulties();expect(ds).toHaveLength(4);
  expect(getModes().map(m=>m.id).sort()).toEqual([...modes].sort());
  for(const [id,rounds,lives,startCredits,towerCostMul,enemyHpMul,roundRewardBase,roundRewardStep,rewardMul] of difficulties)
   expect(ds.find(x=>x.id===id)).toMatchObject({id,rounds,lives,startCredits,towerCostMul,enemyHpMul,roundRewardBase,roundRewardStep,rewardMul});
 });
 for(const [id,rounds,lives,,price,hp,base,step] of difficulties)for(const mode of modes)it(id+' / '+mode+' / 1-4 players',()=>{
  for(const [i,coop] of [1,1.25,1.5,1.75].entries()){
   const r=resolveRules(mode,id,i+1);const half=mode==='half-cash',iron=mode==='iron-oath';
   expect(r).toMatchObject({rounds,maxLives:iron||mode==='no-leaks'?1:lives,towerCostMul:price,roundRewardBase:base,roundRewardStep:step,
    incomeMul:half?.5:mode==='overdrive'?1.1:1,enemySpeedMul:mode==='overdrive'?1.35:1,
    sellAllowed:!iron,allowKnowledge:!iron,allowPassiveIncome:!iron,allowAbilities:mode!=='no-actives',
    maxTowers:mode==='short-supply'?12:60,maxTier:mode==='low-tech'?3:5,
    weather:mode==='blackout'?'fog':mode==='stormfront'?'alternating':'none'});
   expect(r.startingCashMul).toBeCloseTo(coop*(half?.5:1),10);expect(r.enemyHpMul).toBeCloseTo(coop*hp,10);
   expect(r.popCashMul).toBe(resolveRules(mode,id,1).popCashMul);
  }
 });
});
describe('Campaign progression',()=>{
 it('20 maps, every pre-clear and post-clear tower set, no shortcut or failure reward',()=>{
  const c=loadContent(),service=createCampaign(c.campaign);let p=profile();const expected=[...initial];
  expect(service.nodes).toHaveLength(20);
  for(const [i,id] of mapIds.entries()){
   expect(service.availableMaps(p).sort()).toEqual(mapIds.slice(0,i+1).sort());
   expect(service.availableTowers(p).sort()).toEqual([...expected].sort());
   expect(service.complete(structuredClone(p),id,'standard',false)).toEqual(p);
   if(i<19){
    const future=service.complete(structuredClone(p),mapIds[i+1],'standard',true);
    expect(service.availableTowers(future).sort()).toEqual([...expected].sort());
    expect(service.availableMaps(future).sort()).toEqual(mapIds.slice(0,i+1).sort());
   }
   const before=structuredClone(p);p=service.complete(p,id,'standard',true);
   expected.push(...unlocks[i]);expect(service.availableTowers(p).sort()).toEqual([...expected].sort());
   const repeated=service.complete(structuredClone(p),id,'standard',true);
   expect(repeated.completedNodes).toEqual(p.completedNodes);expect(repeated.unlockedTowers).toEqual(p.unlockedTowers);
   expect(p.completedNodes.length).toBe(before.completedNodes.length+1);
  }
  expect(service.availableTowers(p).sort()).toEqual([...towerIds].sort());
 });
});
const branches=['ballistics','elements','engineering','commerce','lighthouse'] as const;
function richProfile():Profile{return {...profile(),level:51,xp:275625,seals:100000,knowledgePoints:150};}
function result(c:GameConfig,over:Partial<RunResult>={}):RunResult{
 return {runId:'qa-'+seed,mapId:c.maps[0].id,modeId:'standard',won:true,wave:40,rounds:40,seed,eligible:true,durationSeconds:720,contentDigest:c.contentDigest,difficulty:'easy',...over};
}
function isolated(stat:KnowledgeStat,value:number):KnowledgeNode{
 return {id:'qa-'+stat,branch:'ballistics',index:1,name:stat,description:stat,requires:[],minLevel:1,pointCost:1,sealCost:30,effects:[{stat,value}],icon:'fixture.svg'};
}
function knowledgeFixture(){
 const c=fixture();const w=tower(),el=tower('element'),wa=tower('water');el.category='element';wa.category='water';
 w.attack.statuses=[{kind:'burn',power:1,duration:10},{kind:'freeze',power:1,duration:10}];
 w.attack.shieldMultiplier=2;w.attack.bossMultiplier=2;
 w.effects=[{id:'income',kind:'income',power:100,radius:0,interval:1,duration:0,cap:0},{id:'detect',kind:'aura',stat:'detect',power:1,radius:100,interval:1,duration:0,cap:0},{id:'range',kind:'aura',stat:'range',power:.1,radius:100,interval:1,duration:0,cap:0}];
 w.abilities=[{id:'nova',name:'nova',description:'nova',cooldown:100,kind:'nova',power:10,duration:1,radius:10,element:'kinetic'}];
 w.paths[0].upgrades[2].replaceAttack={...w.attack};c.towers=[w,el,wa];return c;
}
describe('Knowledge inventory and profile purchases',()=>{
 it('150 nodes; every node purchased in prerequisite order; respec does not repay seals',()=>{
  const c=loadContent(),p=createProgression(c);expect(c.knowledge).toHaveLength(150);
  expect(new Set(c.knowledge.map(n=>n.id)).size).toBe(150);expect(p.validateCatalog(c.knowledge)).toEqual([]);
  const seen=new Set<KnowledgeStat>();let state=richProfile();
  for(const branch of branches){
   const nodes=c.knowledge.filter(n=>n.branch===branch).sort((a,b)=>a.index-b.index);expect(nodes).toHaveLength(30);
   for(const [i,n] of nodes.entries()){
    expect(n.index).toBe(i+1);expect(n.pointCost).toBe(1);expect(n.sealCost).toBeGreaterThan(0);expect(n.icon).not.toBe('');
    expect(n.minLevel).toBe([1,5,9,13,17,21][Math.floor(i/5)]);
    if(i>0)expect(n.requires).toContain(nodes[i-1].id);
    expect(n.effects.length).toBeGreaterThan(0);
    for(const e of n.effects){expect(Object.hasOwn(caps,e.stat)).toBe(true);expect(e.value).toBeGreaterThan(0);seen.add(e.stat);if(e.towers)for(const id of e.towers)expect(towerIds).toContain(id);}
    const poor={...structuredClone(state),seals:0};const bad=p.buy(poor,n.id);expect(bad.ok).toBe(false);expect(bad.profile).toEqual(poor);
    const before=structuredClone(state);const bought=p.buy(state,n.id);expect(bought.ok,n.id).toBe(true);state=bought.profile;
    expect(state.seals).toBe(before.seals-n.sealCost);expect(state.knowledgePoints).toBe(before.knowledgePoints-1);
    expect(state.knowledgeUnlocked).toContain(n.id);expect(state.knowledgePaid).toContain(n.id);
    const duplicate=p.buy(structuredClone(state),n.id);expect(duplicate.ok).toBe(false);expect(duplicate.profile).toEqual(state);
   }
  }
  expect([...seen].sort()).toEqual(Object.keys(caps).sort());
  expect(state.knowledgePoints).toBe(0);expect(state.knowledgeUnlocked).toHaveLength(150);expect(state.seals).toBe(69150);
  const reset=p.respec(state);expect(reset.ok).toBe(true);expect(reset.profile.knowledgePoints).toBe(150);expect(reset.profile.knowledgeUnlocked).toEqual([]);expect(reset.profile.seals).toBe(state.seals);
  const first=c.knowledge.find(n=>n.branch==='ballistics'&&n.index===1)!;
  const repurchase=p.buy(reset.profile,first.id);expect(repurchase.ok).toBe(true);expect(repurchase.profile.seals).toBe(state.seals);
 });
 it('rejects out-of-order, insufficient level and insufficient points',()=>{
  const c=loadContent(),p=createProgression(c);const nodes=c.knowledge.filter(n=>n.branch==='ballistics').sort((a,b)=>a.index-b.index);
  for(const [state,id] of [[richProfile(),nodes[1].id],[{...richProfile(),level:1,knowledgeUnlocked:nodes.slice(0,5).map(n=>n.id)},nodes[5].id],[{...richProfile(),knowledgePoints:0},nodes[0].id]] as [Profile,string][]){
   const result=p.buy(structuredClone(state),id);expect(result.ok).toBe(false);expect(result.profile).toEqual(state);
  }
 });
});
describe('All 19 knowledge stats: executed cap probes',()=>{
 for(const stat of Object.keys(caps) as KnowledgeStat[])it(stat+' capped, deduplicated and disabled in iron-oath',()=>{
  const c=knowledgeFixture();const n=isolated(stat,caps[stat]*4);c.knowledge=[n];
  const p=createProgression(c);const baseline=structuredClone(c);
  expect(p.combineKnowledge([[n.id],[n.id]],'standard')).toEqual([n.id]);
  expect(p.combineKnowledge([[n.id]],'iron-oath')).toEqual([]);
  const a=p.applyKnowledge(c,[n.id,n.id],'standard');const strict=p.applyKnowledge(c,[n.id],'iron-oath');
  expect(strict.towers).toEqual(c.towers);expect(strict.knowledgeDiscount).toBe(0);expect(c).toEqual(baseline);
  const w=a.towers[0],el=a.towers[1],water=a.towers[2];
  expect(w.cost).toBe(100);expect(w.paths[0].upgrades[0].cost).toBe(50);expect(w.paths[0].upgrades[0].delta).toEqual({damageMul:2});
  switch(stat){
   case 'weaponDamage':expect(w.attack.damage).toBeCloseTo(11.5);expect(w.paths[0].upgrades[2].replaceAttack?.damage).toBeCloseTo(11.5);expect(el.attack.damage).toBe(10);break;
   case 'weaponSpeed':expect(w.attack.interval).toBeCloseTo(1/1.12);break;
   case 'weaponRange':expect(w.attack.range).toBeCloseTo(330);break;
   case 'elementDamage':expect(el.attack.damage).toBeCloseTo(11.5);expect(w.attack.damage).toBe(10);break;
   case 'statusDuration':expect(w.attack.statuses[0].duration).toBeCloseTo(11.5);expect(w.attack.statuses[1].duration).toBe(10);break;
   case 'shieldDamage':expect(w.attack.shieldMultiplier).toBeCloseTo(2.4);break;
   case 'supportRadius':expect(w.effects[2].radius).toBeCloseTo(112);break;
   case 'abilityCooldown':expect(w.abilities[0].cooldown).toBeCloseTo(88);break;
   case 'controlDuration':expect(w.attack.statuses[1].duration).toBeCloseTo(11);expect(w.attack.statuses[0].duration).toBe(10);break;
   case 'startingCash':expect(a.difficulties[0].startCredits).toBe(990);break;
   case 'passiveIncome':expect(w.effects[0].power).toBeCloseTo(115);break;
   case 'purchaseDiscount':expect(a.knowledgeDiscount).toBeCloseTo(.08);break;
   case 'lives':expect(a.difficulties[0].lives).toBe(170);break;
   case 'bossDamage':expect(w.attack.bossMultiplier).toBeCloseTo(2.24);break;
   case 'revealRadius':expect(w.effects[1].radius).toBeCloseTo(115);expect(w.effects[2].radius).toBe(100);break;
   case 'waterDamage':expect(water.attack.damage).toBeCloseTo(11.5);expect(w.attack.damage).toBe(10);break;
   case 'waterRange':expect(water.attack.range).toBeCloseTo(330);expect(w.attack.range).toBe(300);break;
   case 'xpGain':case 'sealGain':{
    const state={...profile(),knowledgeUnlocked:[n.id]};const receipt=p.reward(state,result(c,{difficulty:'normal',wave:1,rounds:1})).receipt;
    expect(receipt.xp).toBe(stat==='xpGain'?412:375);expect(receipt.seals).toBe(stat==='sealGain'?88:80);
    expect(a.towers).toEqual(c.towers);break;
   }
  }
 });
 it('reward replay idempotency, first/repeat medal and eligibility',()=>{
  const c=fixture();const p=createProgression(c);const r=result(c,{difficulty:'normal',wave:1,rounds:1});
  const first=p.reward(profile(),r);expect(first.receipt).toMatchObject({xp:375,seals:80,firstClear:true,duplicate:false});
  const duplicate=p.reward(first.profile,r);expect(duplicate.receipt.duplicate).toBe(true);expect(duplicate.profile).toEqual(first.profile);
  const second=p.reward(first.profile,{...r,runId:r.runId+'-2'});expect(second.receipt).toMatchObject({xp:162,seals:28,firstClear:false});
  const absent=p.reward(second.profile,{...r,runId:r.runId+'-3',eligible:false});expect(absent.receipt.xp).toBe(0);expect(absent.receipt.seals).toBe(0);
 });
});
