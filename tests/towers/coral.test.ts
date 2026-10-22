import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {getTower} from '../../src/content/towers/coral';
import {canUpgrade,legalTiers,sellRefund} from '../../src/contracts/rules';
import type {AttackDef,EffectDef,PathIndex,StatDelta,StatusSpec,Tiers,VisualState} from '../../src/contracts';

const tower = getTower();
const ART = join(process.cwd(),'public/art/towers/coral');
const costs = [[325,650,1625,3900,9750],[310,620,1545,3705,9265],[360,720,1790,4295,10730]];

type Fixture = {attack:AttackDef;effects:EffectDef[];abilities:string[];visual:VisualState;secondaryOverlay?:string;};
const applyDelta = (attack:AttackDef,delta:StatDelta):AttackDef => ({
 ...attack,
 damage:attack.damage*(delta.damageMul??1),
 interval:attack.interval*(delta.intervalMul??1),
 range:attack.range*(delta.rangeMul??1),
 pierce:attack.pierce+(delta.pierceAdd??0),
 count:attack.count+(delta.countAdd??0),
 splash:attack.splash+(delta.splashAdd??0),
 chains:attack.chains+(delta.chainsAdd??0),
 chainRadius:attack.chainRadius+(delta.chainRadiusAdd??0),
 armorPierce:attack.armorPierce+(delta.armorPierceAdd??0),
 shieldMultiplier:attack.shieldMultiplier*(delta.shieldMultiplierMul??1),
 bossMultiplier:attack.bossMultiplier*(delta.bossMultiplierMul??1),
 executeBelow:attack.executeBelow+(delta.executeBelowAdd??0),
 push:attack.push+(delta.pushAdd??0),
 detects:attack.detects||Boolean(delta.detects),
 projectileSpeed:attack.projectileSpeed*(delta.projectileSpeedMul??1),
 windup:attack.windup*(delta.windupMul??1),
 arc:attack.arc+(delta.arcAdd??0),
});

// Fixture-only resolver, independent of the unfinished combat module.
// Apply secondary tiers first, main tiers second; multipliers are commutative.
function resolve(tiers:Tiers):Fixture {
 if(!legalTiers(tiers))throw new Error('Illegal tier combination');
 let attack:AttackDef = {...tower.attack,statuses:[...tower.attack.statuses]};
 const effects=[...tower.effects];
 const abilities=tower.abilities.map(a=>a.id);
 const main = tiers.findIndex(x=>x>2);
 const preferred = main>=0?main:tiers.findIndex(x=>x>0);
 const order = ([0,1,2] as PathIndex[]).filter(x=>x!==preferred).concat(
  preferred>=0?[preferred as PathIndex]:[],
 );
 for(const path of order){
  for(const up of tower.paths[path].upgrades.slice(0,tiers[path])){
   attack=applyDelta(attack,up.delta);
   attack.statuses.push(...(up.addStatuses??[]));
   effects.push(...(up.effects??[]));
   abilities.push(...(up.abilities??[]).map(a=>a.id));
  }
 }
 const visual = preferred>=0?tower.paths[preferred].upgrades[tiers[preferred]-1].visual:tower.visual;
 const secondary = order.find(x=>x!==preferred&&tiers[x]>0);
 return {attack,effects,abilities,visual,
  secondaryOverlay:secondary===undefined?undefined:`/art/towers/coral/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`};
}
const finiteDeep = (value:unknown):boolean => {
 if(typeof value==='number')return Number.isFinite(value);
 if(Array.isArray(value))return value.every(finiteDeep);
 if(value&&typeof value==='object')return Object.values(value).every(finiteDeep);
 return true;
};

describe('coral content contract',()=>{
 it('contains the expected independent, water-only base with safe combat timing',()=>{
  expect(tower.id).toBe('coral');
  expect([tower.cost,tower.attack.damage,tower.attack.interval,tower.attack.range,tower.footprint]).toEqual([650,8,.65,155,26]);
  expect([tower.category,tower.placement,tower.attack.mode]).toEqual(['water','water','shot']);
  expect(tower.attack.projectileSpeed).toBeGreaterThan(0);
  expect(tower.attack.count).toBe(1);
  expect(tower.attack.pierce).toBe(1);
  expect(tower.effects).toEqual([]);
  expect(tower.abilities).toEqual([]);
 });
 it('has exactly 3 ordered paths and 15 unique upgrades with specified costs',()=>{
  expect(tower.paths.map(x=>x.upgrades.length)).toEqual([5,5,5]);
  expect(tower.paths.map(x=>x.id)).toEqual(['coral-a','coral-b','coral-c']);
  const upgrades=tower.paths.flatMap(p=>p.upgrades);
  expect(new Set(upgrades.map(x=>x.id)).size).toBe(15);
  expect(new Set(upgrades.map(x=>x.name)).size).toBe(15);
  expect(upgrades.every(x=>x.name.trim()&&x.description.length>30)).toBe(true);
  for(let p=0;p<3;p++){
   expect(tower.paths[p].upgrades.map(x=>x.tier)).toEqual([1,2,3,4,5]);
   expect(tower.paths[p].upgrades.map(x=>x.cost)).toEqual(costs[p]);
   expect(tower.paths[p].upgrades.every(x=>Number.isSafeInteger(x.cost)&&x.cost>0)).toBe(true);
  }
  expect(finiteDeep(tower)).toBe(true);
  expect(upgrades.every(x=>(x.abilities??[]).every(a=>a.cooldown>0&&a.radius>0))).toBe(true);
  expect(upgrades.every(x=>(x.addStatuses??[]).every((s:StatusSpec)=>s.duration>0&&s.power>0))).toBe(true);
 });
 it('resolves every one of 216 states, accepts precisely legal states, and never produces a nonfinite attack',()=>{
  let legalCount=0;
  for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
   const t:Tiers=[a,b,c];
   if(!legalTiers(t)){expect(()=>resolve(t)).toThrow();continue;}
   legalCount++;
   const r=resolve(t);
   expect(finiteDeep(r)).toBe(true);
   expect(r.attack.interval).toBeGreaterThan(0.01);
   expect(r.attack.range).toBeGreaterThan(0);
   expect(r.attack.damage).toBeGreaterThan(0);
   expect(r.attack.count).toBeGreaterThan(0);
   expect(r.attack.pierce).toBeGreaterThan(0);
   expect(r.attack.projectileSpeed).toBeGreaterThan(0);
   for(let p=0;p<3;p++){
    const n:Tiers=[...t];n[p]++;
    expect(canUpgrade(t,p as PathIndex)).toBe(legalTiers(n));
   }
  }
  expect(legalCount).toBe(64);
 });
 it('has six real endgame combinations with dominant silhouettes and visible secondary geometry',()=>{
  for(const primary of [0,1,2] as PathIndex[]){
   for(const secondary of [0,1,2] as PathIndex[]){
    if(primary===secondary)continue;
    const tiers:Tiers=[0,0,0];
    tiers[primary]=5;tiers[secondary]=2;
    const r=resolve(tiers);
    expect(r.visual.asset).toBe(`/art/towers/coral/${'abc'[primary]}5.svg`);
    expect(r.secondaryOverlay).toBe(`/art/towers/coral/${'abc'[secondary]}2-overlay.svg`);
    expect(existsSync(join(ART,`${'abc'[secondary]}2-overlay.svg`))).toBe(true);
    expect(r.attack.count).toBeGreaterThanOrEqual(1);
    expect(r.effects.map(x=>x.id).length).toBe(new Set(r.effects.map(x=>x.id)).size);
   }
  }
  expect(resolve([5,2,0]).attack.statuses.some(s=>s.kind==='wet')).toBe(true);
  expect(resolve([5,0,2]).attack.statuses.some(s=>s.kind==='poison')).toBe(true);
  expect(resolve([2,5,0]).attack.count).toBe(4);
  expect(resolve([0,5,2]).attack.detects).toBe(true);
  expect(resolve([2,0,5]).attack.count).toBe(4);
  expect(resolve([0,2,5]).attack.statuses.some(s=>s.kind==='wet')).toBe(true);
 });
 it('has three distinct material endgame changes, not nominal stat boosts',()=>{
  const a4=resolve([4,0,0]);const a5=resolve([5,0,0]);
  expect(a5.attack.count-a4.attack.count).toBe(3);
  expect(a5.attack.pierce-a4.attack.pierce).toBe(7);
  expect(a5.abilities).toContain('coral-a-white-tide');
  const b4=resolve([0,4,0]);const b5=resolve([0,5,0]);
  expect(b5.effects.length).toBe(b4.effects.length+1);
  expect(b5.effects.find(x=>x.id==='coral-b-heart')?.radius).toBe(215);
  expect(b5.abilities).toContain('coral-b-heart-pulse');
  const c4=resolve([0,0,4]);const c5=resolve([0,0,5]);
  expect(c5.effects.length).toBe(c4.effects.length+1);
  expect(c5.attack.statuses.length).toBe(c4.attack.statuses.length+1);
  expect(c5.effects.every(e=>e.status?.kind==='poison')).toBe(true);
  expect(c5.abilities).toContain('coral-c-medusa-nova');
 });
 it('keeps every local SVG self-contained and all variants visibly different',()=>{
  const required=['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(t=>p+t)),
   ...['a','b','c'].flatMap(p=>[1,2].map(t=>`${p}${t}-overlay`))];
  expect(required).toHaveLength(22);
  const originals=new Set<string>();
  for(const name of required){
   const file=join(ART,`${name}.svg`);
   expect(existsSync(file),name).toBe(true);
   const svg=readFileSync(file,'utf8');
   expect(svg).toContain('viewBox="0 0 128 128"');
   expect(svg).toContain('width="128" height="128"');
   expect(svg).toMatch(/<path\b/);
   expect(svg.replace('xmlns="http://www.w3.org/2000/svg"','')).not.toMatch(/<script\b|<text\b|<foreignObject\b|<image\b|https?:\/\/|href=|@import/i);
   expect(svg).toMatch(/<\/svg>$/);
   expect(originals.has(svg)).toBe(false);
   originals.add(svg);
  }
  expect(readFileSync(join(ART,'preview.html'),'utf8')).toContain('A5 + B2');
  expect(readFileSync(join(ART,'preview.html'),'utf8')).toContain('C5 + B2');
  expect([tower.visual,...tower.paths.flatMap(p=>p.upgrades.map(u=>u.visual))]
   .every(v=>existsSync(join(ART,v.asset.split('/').pop()??'')))).toBe(true);
 });
 it('uses capped fixed support, no passive income, and a lossy resale model',()=>{
  const all=tower.paths.flatMap(p=>p.upgrades);
  expect(all.flatMap(x=>x.effects??[]).every(x=>['aura','deathBurst'].includes(x.kind)&&x.cap>0)).toBe(true);
  expect(all.flatMap(x=>x.abilities??[]).every(x=>x.kind==='nova')).toBe(true);
  for(const index of [0,1,2]){
   const invested=tower.cost+tower.paths[index].upgrades.reduce((n,u)=>n+u.cost,0);
   expect(invested).toBe([16900,16095,18545][index]);
   expect(sellRefund(invested)).toBeLessThan(invested);
  }
 });
});
