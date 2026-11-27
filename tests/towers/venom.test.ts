import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {EnemyDef, GameConfig, GameState, TowerState, AttackDef, EffectDef, ResolvedTower, StatDelta, StatusSpec, Tiers, TowerDef} from '../../src/contracts';
import {legalTiers, canUpgrade} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/venom';
import {createCombat} from '../../src/combat';
import {spawnEnemy} from '../../src/contracts/runtime';

const directory = join(process.cwd(), 'public/art/towers/venom');
const costs = [[325,650,1625,3900,9750], [345,685,1710,4095,10240], [310,620,1545,3705,9265]];
const allTiers: Tiers[] = Array.from({length: 216}, (_, i): Tiers =>
 [Math.floor(i/36), Math.floor((i%36)/6), i%6] as Tiers);

/** A local contract-v1 fixture, independent of the unfinished combat implementation. */
function resolveFixture(def: TowerDef, tiers: Tiers): ResolvedTower {
 if (!legalTiers(tiers)) throw new RangeError(`Illegal tiers: ${tiers.join('-')}`);
 const active = tiers.map((tier, i) => ({tier, i})).filter(x => x.tier > 0);
 const primary = [...active].sort((a,b)=>b.tier-a.tier||a.i-b.i)[0]?.i;
 const mainPath = primary as 0|1|2|undefined;
 const selected = def.paths.flatMap((path, index) => path.upgrades.slice(0, tiers[index]));
 const attack: AttackDef = structuredClone(def.attack);
 const effectMap = new Map<string, EffectDef>(def.effects.map(effect => [effect.id, structuredClone(effect)]));
 const abilityMap = new Map(def.abilities.map(ability => [ability.id, structuredClone(ability)]));
 const statusMap = new Map<string, StatusSpec>(attack.statuses.map(s => [s.kind, s]));
 // Frozen merge order: one primary attack, then additive multipliers in A→B→C order.
 const numericMul: [keyof StatDelta, keyof AttackDef][] = [
  ['damageMul','damage'], ['intervalMul','interval'], ['rangeMul','range'],
  ['shieldMultiplierMul','shieldMultiplier'], ['bossMultiplierMul','bossMultiplier'],
  ['projectileSpeedMul','projectileSpeed'], ['windupMul','windup'],
 ];
 const numericAdd: [keyof StatDelta, keyof AttackDef][] = [
  ['pierceAdd','pierce'], ['countAdd','count'], ['splashAdd','splash'],
  ['chainsAdd','chains'], ['chainRadiusAdd','chainRadius'], ['armorPierceAdd','armorPierce'],
  ['executeBelowAdd','executeBelow'], ['pushAdd','push'], ['arcAdd','arc'],
 ];
 const primaryAttack = mainPath===undefined ? undefined :
  def.paths[mainPath].upgrades.slice(0, tiers[mainPath]).flatMap(u=>u.replaceAttack ? [u.replaceAttack] : []).at(-1);
 if(primaryAttack)Object.assign(attack, structuredClone(primaryAttack));
 for (const u of selected) {
  for(const [delta, key] of numericMul) {
   const value = u.delta[delta];
   if(typeof value==='number') (attack as unknown as Record<string,number>)[key] *= value;
  }
  for(const [delta, key] of numericAdd) {
   const value = u.delta[delta];
   if(typeof value==='number') (attack as unknown as Record<string,number>)[key] += value;
  }
  if(u.delta.detects) attack.detects = true;
  for(const s of u.addStatuses ?? []) {
   const previous = statusMap.get(s.kind);
   statusMap.set(s.kind, previous ? {kind:s.kind, power:Math.max(previous.power,s.power), duration:Math.max(previous.duration,s.duration), maxStacks:Math.max(previous.maxStacks??1,s.maxStacks??1)} : structuredClone(s));
  }
  for(const e of u.effects ?? []) effectMap.set(e.id,structuredClone(e));
  for(const a of u.abilities ?? []) abilityMap.set(a.id,structuredClone(a));
 }
 attack.statuses=[...statusMap.values()];
 const secondary = active.find(x=>x.i!==primary);
 return {attack, effects:[...effectMap.values()], abilities:[...abilityMap.values()],
  visual: mainPath===undefined? def.visual : def.paths[mainPath].upgrades[tiers[mainPath]-1].visual,
  mainPath, secondaryOverlay: secondary===undefined? undefined :
   `/art/towers/venom/${'abc'[secondary.i]}${secondary.tier}-overlay.svg`};
}

describe('venom: catalog / content', () => {
 it('has the required price, placement and exactly 15 sequential, unique upgrades', () => {
  const tower=getTower();
  expect(tower.id).toBe('venom');
  expect(tower.cost).toBe(650);
  expect(tower.category).toBe('element');
  expect(tower.placement).toBe('land');
  expect(tower.footprint).toBeGreaterThanOrEqual(22);
  expect(tower.footprint).toBeLessThanOrEqual(28);
  expect([tower.attack.damage,tower.attack.interval,tower.attack.range]).toEqual([6,.9,165]);
  expect(tower.paths).toHaveLength(3);
  const ids = new Set<string>();
  tower.paths.forEach((path,index) => {
   expect(path.upgrades).toHaveLength(5);
   path.upgrades.forEach((u,tier) => {
    expect(u.tier).toBe(tier+1);
    expect(u.id).toBe(`venom-${'abc'[index]}${tier+1}`);
    expect(u.cost).toBe(costs[index][tier]);
    expect(u.cost).toBeGreaterThan(0);
    expect(u.name.length).toBeGreaterThan(5);
    expect(u.description.length).toBeGreaterThan(30);
    expect(ids.has(u.id)).toBe(false);
    ids.add(u.id);
    expect(u.replaceAttack).toBeUndefined(); // Cross path does not clobber the main school.
   });
  });
  expect(ids.size).toBe(15);
 });

 it('returns a fresh independent tree even after external mutation', () => {
  const a = getTower();
  a.attack.damage = -100;
  a.paths[0].upgrades[0].delta.rangeMul = -2;
  a.paths[2].upgrades[4].effects?.push({id:'break',kind:'interest',power:999,
   radius:0,interval:0,duration:0,cap:999});
  const b=getTower();
  expect(b.attack.damage).toBe(6);
  expect(b.paths[0].upgrades[0].delta.rangeMul).toBe(1.08);
  expect(b.paths[2].upgrades[4].effects).toHaveLength(1);
 });

 it('has safe finite fields, bounded stacks, non-financial effects and valid status semantics', () => {
  const def=getTower();
  const all=[...def.paths.flatMap(p=>p.upgrades), {effects:def.effects, abilities:def.abilities,
   addStatuses:def.attack.statuses, delta:{} as StatDelta}];
  for(const u of all){
   for(const val of Object.values(u.delta)) if(typeof val==='number') expect(Number.isFinite(val)).toBe(true);
   for(const s of u.addStatuses??[]) {
    expect(['poison','shred']).toContain(s.kind);
    expect(s.power).toBeGreaterThan(0); expect(s.duration).toBeGreaterThan(0);
    expect(s.maxStacks).toBeGreaterThan(0); expect(s.maxStacks).toBeLessThanOrEqual(8);
   }
   for(const e of u.effects??[]){
    expect(['deathBurst','aura']).toContain(e.kind);
    for(const key of ['power','radius','interval','duration','cap'] as const)
     expect(Number.isFinite(e[key])).toBe(true);
    expect(e.power).toBeGreaterThan(0);
   }
   for(const a of u.abilities??[]){
    expect(a.kind).toBe('nova'); expect(a.cooldown).toBeGreaterThan(0);
    expect(a.power).toBeGreaterThan(0); expect(a.radius).toBeGreaterThan(0);
   }
  }
  expect(def.effects).toEqual([]);
  expect(def.abilities).toEqual([]);

 });
});

describe('venom: local v1 resolver / complete tier matrix', () => {
 it('resolves each legal combination and rejects every illegal one', () => {
  const def=getTower();
  let legal=0;
  for(const tiers of allTiers){
   if(!legalTiers(tiers)){
    expect(()=>resolveFixture(def,tiers)).toThrow(RangeError);
    continue;
   }
   legal++;
   const result=resolveFixture(def,tiers);
   const a=result.attack;
   expect(a.interval).toBeGreaterThanOrEqual(.05);
   expect(a.count).toBeGreaterThanOrEqual(1);
   expect(a.range).toBeGreaterThan(0);
   expect(a.pierce).toBeGreaterThanOrEqual(1);
   expect(a.damage).toBeGreaterThan(0);
   for(const n of [a.damage,a.interval,a.range,a.pierce,a.count,a.splash,a.armorPierce,a.shieldMultiplier])
    expect(Number.isFinite(n)).toBe(true);
   expect(result.effects.map(x=>x.id).length).toBe(new Set(result.effects.map(x=>x.id)).size);
   expect(result.abilities.map(x=>x.id).length).toBe(new Set(result.abilities.map(x=>x.id)).size);
   const main=Math.max(...tiers)===0 ? -1 : tiers.indexOf(Math.max(...tiers));
   expect(result.visual.asset).toBe(main===-1?def.visual.asset :
    def.paths[main].upgrades[tiers[main]-1].visual.asset);
   const secondary=tiers.findIndex((n,i)=>n>0&&i!==main);
   expect(result.secondaryOverlay).toBe(secondary===-1?undefined:
    `/art/towers/venom/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`);
   for(let path=0;path<3;path++){
    const next=tiers.map((v,i)=>i===path?v+1:v) as Tiers;
    expect(canUpgrade(tiers,path as 0|1|2)).toBe(legalTiers(next));
   }
  }
  expect(legal).toBe(64);
 });

 it('three T5 identities differ in measurable, unique effects', () => {
  const [a,b,c]=[[5,0,0],[0,5,0],[0,0,5]].map(t=>resolveFixture(getTower(),t as Tiers));
  expect(a.attack.count).toBe(4);
  expect(a.attack.pierce).toBe(1);
  expect(a.attack.splash).toBe(54);
  expect(a.attack.statuses.find(s=>s.kind==='poison')?.maxStacks).toBe(8);
  expect(a.abilities[0].id).toBe('venom-flowering');
  expect(b.attack.count).toBe(3);
  expect(b.attack.armorPierce).toBe(16.5);
  expect(b.attack.splash).toBe(58);
  expect(b.attack.shieldMultiplier).toBeCloseTo(1.15*1.3*1.35*1.35*1.6);
  expect(b.effects.find(x=>x.id==='venom-corrosion-field')?.radius).toBe(135);
  expect(c.attack.splash).toBe(53);
  expect(c.attack.count).toBe(2);
  expect(c.effects).toHaveLength(1);
  expect(c.effects[0]).toMatchObject({id:'venom-outbreak',power:120,radius:110});
  expect(c.abilities[0].id).toBe('venom-pandemic-wave');
 });

 it.each([
  [[5,2,0],0,'b2', 'shred'], [[5,0,2],0,'c2','poison'],
  [[2,5,0],1,'a2','poison'], [[0,5,2],1,'c2','poison'],
  [[2,0,5],2,'a2','poison'], [[0,2,5],2,'b2','shred'],
 ] as const)('5–2–0 %j keeps the T5 primary and gains real secondary effects', (tiers, main, side, kind) => {
  const base:[number,number,number]=[0,0,0]; base[main]=5;
  const only=resolveFixture(getTower(),base);
  const hybrid=resolveFixture(getTower(),[...tiers] as Tiers);
  expect(hybrid.mainPath).toBe(main);
  expect(hybrid.visual.asset).toBe(only.visual.asset);
  expect(hybrid.secondaryOverlay).toBe(`/art/towers/venom/${side}-overlay.svg`);
  expect(hybrid.attack.statuses.some(s=>s.kind===kind)).toBe(true);
  expect(hybrid.attack.interval).toBeLessThanOrEqual(only.attack.interval);
  expect(hybrid.attack.splash).toBeGreaterThanOrEqual(only.attack.splash);
  expect(hybrid.attack.range).toBeGreaterThanOrEqual(only.attack.range);
  expect(hybrid.attack.armorPierce).toBeGreaterThanOrEqual(only.attack.armorPierce);
  expect(hybrid.attack.shieldMultiplier).toBeGreaterThanOrEqual(only.attack.shieldMultiplier);
  expect(hybrid.abilities.map(a=>a.id)).toEqual(only.abilities.map(a=>a.id));
  expect(hybrid.effects.map(e=>e.id)).toEqual(only.effects.map(e=>e.id));
 });
});

describe('venom: contact-compatible data', () => {
 it('uses explosive projectiles for every legal build, with no ineffective piercing increments', () => {
  for(const tiers of allTiers.filter(legalTiers)){
   const a=resolveFixture(getTower(),tiers).attack;
   expect(a.mode).toBe('splash');
   expect(a.pierce).toBe(1);
   expect(a.homing).toBe(true);
   expect(a.projectileSpeed).toBeGreaterThan(0);
  }
  expect(resolveFixture(getTower(),[0,0,0]).attack.splash).toBe(0);
  expect(resolveFixture(getTower(),[2,0,0]).attack.splash).toBe(17);
  expect(resolveFixture(getTower(),[0,0,2]).attack.splash).toBe(13);
  expect(resolveFixture(getTower(),[0,3,0]).attack.splash).toBe(8);
 });
 it('selects the higher early visual tier; equal tiers prefer A then B', () => {
  for(const [tiers,main] of [[[1,2,0],1],[[2,1,0],0],[[0,1,2],2],[[1,1,0],0],[[0,2,2],1]] as const){
   expect(resolveFixture(getTower(),[...tiers] as Tiers).mainPath).toBe(main);
  }
 });
 it('shred is a single strongest debuff, not an advertised stacking effect', () => {
  for(const [tier,power,duration] of [[2,1.5,3],[3,3,5],[4,4,6],[5,6,8]]){
   expect(resolveFixture(getTower(),[0,tier,0]).attack.statuses.find(x=>x.kind==='shred'))
    .toEqual({kind:'shred',power,duration,maxStacks:1});
  }
 });
});

describe('venom: vector resource inventory', () => {
 it('provides 16 full SVGs and all 6 secondary overlays at the exact referenced paths', () => {
  const def=getTower();
  const full=[def.visual.asset,...def.paths.flatMap(p=>p.upgrades.map(u=>u.visual.asset))];
  const overlays=['a','b','c'].flatMap(path=>[1,2].map(tier=>`${path}${tier}-overlay.svg`));
  expect(full).toHaveLength(16);
  expect(new Set(full).size).toBe(16);
  for(const file of [...full.map(x=>x.slice(artPrefix.length)),...overlays]) {
   const local=join(directory,file);
   expect(existsSync(local)).toBe(true);
   const svg=readFileSync(local,'utf8');
   expect(svg).toContain('<svg');
   expect(svg).toMatch(/viewBox="0 0 128 128"/);
   expect(svg).toContain('</svg>');
   expect(svg).toMatch(/<(path|circle|rect|polygon|ellipse)\b/);
   expect(svg).not.toMatch(/<(script|foreignObject|text|image|use)\b/i);
   expect(svg.replace('xmlns="http://www.w3.org/2000/svg"',''))
    .not.toMatch(/(?:https?:|data:|javascript:|<style|<link)/i);
   expect(svg).not.toMatch(/href\s*=/i);
  }
  expect(readFileSync(join(directory,'a5.svg'),'utf8').match(/<circle|<path/g)?.length).toBeGreaterThan(30);
  expect(readFileSync(join(directory,'b5.svg'),'utf8')).not.toBe(readFileSync(join(directory,'c5.svg'),'utf8'));
  const preview=readFileSync(join(directory,'preview.html'),'utf8');
  for(const file of [...full.map(x=>x.slice(artPrefix.length)),...overlays])
   expect(preview).toContain(file);
 });
});

const artPrefix='/art/towers/venom/';


// Explicit opt-in: the default independent suite runs even with the main combat stub.
// Run on a temporary integration checkout containing the real combat module.
describe.skipIf(process.env.PRISM_VENOM_COMBAT_QA !== '1')('venom: real combat integration', () => {
 function scenario(tiers:Tiers, shield=0, radius=10){
  const combat=createCombat();
  const tower:TowerState={id:'t1',defId:'venom',owner:'player',pos:{x:0,y:0},
   tiers,targeting:'first',invested:650,cooldown:0,abilityCooldowns:{},memory:{},
   damageDealt:0,kills:0,generated:0};
  const enemy:EnemyDef={id:'foe',name:'Foe',description:'Fixture',color:'#f44',shape:'orb',
   hp:200,speed:30,bounty:10,leak:1,radius,armor:0,shield,regen:0,
   cloaked:false,flying:false,resist:{},children:[],layers:[{hp:200,cash:10,color:'#f44'}]};
  const config:GameConfig={version:1,towers:[getTower()],enemies:[enemy],waves:[],
   maps:[{id:'map',name:'Map',description:'Fixture',difficulty:1,campaignIndex:1,
    recommendedDifficulty:'normal',waveOverrides:{},lanes:[[{x:0,y:0},{x:1000,y:0}]],
    pathWidth:10,blocked:[],water:[],theme:'garden',background:''}],
   modes:[],campaign:[],contentVersion:'1',contentDigest:'fixture',knowledge:[],
   economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,mapXP:[250,400,600,900],
    mapSeals:[80,120,180,260],modeReward:{standard:1},firstClearXP:1.5,repeatXP:.65,
    repeatSeals:.35,defeatXP:.35,respecCost:200},
   difficulties:[],knowledgeDiscount:0,startCredits:0,startLives:150,sellRatio:.7};
  const state:GameState={version:1,options:{mapId:'map',difficulty:'normal',seed:1,
   endless:false,modeId:'standard',unlockedTowers:['venom'],players:[],runId:'venom-test',knowledge:[]},
   phase:'wave',time:0,tick:0,rng:123,nextEntity:1,nextEvent:1,credits:0,lives:150,
   wave:1,waveTime:0,spawnCursor:[],paused:false,speed:1,autoStart:false,towers:[tower],
   enemies:[],events:[],projectiles:[],strikes:[],
   rules:{incomeMul:1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1,
    sellAllowed:true,maxLives:150,allowAbilities:true,allowPassiveIncome:true,maxTowers:60,
    maxTier:5,weather:'none',allowKnowledge:false,rounds:60,roundRewardBase:80,roundRewardStep:4,popCashMul:1},
   stats:{spent:0,earned:0,kills:0,damage:0,leaks:0,abilities:0,cashSubunits:0}};
  const spawn=(x:number,y=0)=>{const e=spawnEnemy(state,config,'foe',0,x);e.pos.y=y;return e;};
  const step=(n:number)=>{for(let i=0;i<n;i++){state.time+=1/60;state.tick++;combat.step(state,config,1/60);}};
  return {combat,state,config,tower,spawn,step};
 }
 it('agrees with the independent fixture over the full tier matrix',()=>{
  const combat=createCombat(), def=getTower();
  for(const tiers of allTiers){
   if(!legalTiers(tiers)){expect(()=>combat.resolveTower(def,tiers)).toThrow();continue;}
   expect(combat.resolveTower(def,tiers)).toEqual(resolveFixture(def,tiers));
  }
 });
 it.each([
  [[0,0,0],10,false],[[2,0,0],10,true],[[0,0,2],10,false],[[0,0,2],4,true],
 ] as const)('contact %j (enemy radius %s) affects only the actual blast', (tiers,radius,nearHit)=>{
  const f=scenario([...tiers] as Tiers,0,radius);
  const a=f.spawn(80),b=f.spawn(80,5),far=f.spawn(80,55);
  f.step(5);expect(a.hp).toBe(200);expect(b.hp).toBe(200);
  f.step(25);expect(a.hp).toBeLessThan(200);
  expect(b.hp<200).toBe(nearHit);expect(far.hp).toBe(200);
  expect(f.state.events.some(e=>e.kind==='projectileImpact')).toBe(true);
  expect(a.statuses.some(s=>s.kind==='poison'&&s.source===f.tower.id)).toBe(true);
 });
 it('C5 poison death damages nearby targets once and leaves distant targets alone',()=>{
  const f=scenario([0,0,5]);f.tower.cooldown=99;
  const a=f.spawn(80),b=f.spawn(120),far=f.spawn(260);
  a.hp=1;a.statuses=[{kind:'poison',source:'t1',power:9,duration:9,remaining:9,stacks:1,maxStacks:7}];
  f.step(15);expect(a.hp).toBe(0);expect(b.hp).toBe(80);expect(far.hp).toBe(200);
  expect(f.state.stats.kills).toBe(1);f.step(60);expect(b.hp).toBe(80);
 });
 it('B5 shield multiplier is applied on contact, and nova cannot be spammed',()=>{
  const f=scenario([0,5,0],200);const e=f.spawn(80);
  f.step(30);expect(e.shield).toBeCloseTo(105.836528);expect(e.hp).toBe(200);
  const n=scenario([0,5,0]);const target=n.spawn(80);
  expect(n.combat.activate(n.state,n.config,'t1','venom-solvent-wave').ok).toBe(true);
  expect(target.hp).toBe(120);
  expect(n.combat.activate(n.state,n.config,'t1','venom-solvent-wave').ok).toBe(false);
 });
});
