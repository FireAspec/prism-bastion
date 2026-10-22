import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AttackDef,EffectDef,PathIndex,ResolvedTower,StatDelta,Tiers,TowerDef} from '../../src/contracts';
import {legalTiers,upgradeCost,sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/rail';

const assetDir=resolve(process.cwd(),'public/art/towers/rail');
const paths=['a','b','c'] as const;
const costs=[
 [550,1095,2735,6555,16390],
 [475,950,2375,5700,14250],
 [455,905,2260,5415,13540],
];

/** Local contract fixture until feature/02-combat is integrated. No game runtime is mocked. */
function resolveFixture(def:TowerDef,tiers:Tiers):ResolvedTower {
 if(!legalTiers(tiers))throw new RangeError('Illegal tiers');
 const locked=tiers.findIndex(t=>t>2);
 const first=tiers.findIndex(t=>t>0);
 const main=(locked>=0?locked:first) as PathIndex;
 const mainUpgrades=main<0?[]:def.paths[main].upgrades.slice(0,tiers[main]);
 const replacement=[...mainUpgrades].reverse().find(u=>u.replaceAttack)?.replaceAttack;
 const attack:AttackDef=structuredClone(replacement??def.attack);
 const effects=new Map<string,EffectDef>(def.effects.map(effect=>[effect.id,structuredClone(effect)]));
 const abilities=structuredClone(def.abilities);
 const multipliers:Partial<Record<keyof StatDelta,keyof AttackDef>>={
  damageMul:'damage',intervalMul:'interval',rangeMul:'range',shieldMultiplierMul:'shieldMultiplier',
  bossMultiplierMul:'bossMultiplier',projectileSpeedMul:'projectileSpeed',windupMul:'windup',
 };
 const increments:Partial<Record<keyof StatDelta,keyof AttackDef>>={
  pierceAdd:'pierce',countAdd:'count',splashAdd:'splash',chainsAdd:'chains',
  chainRadiusAdd:'chainRadius',armorPierceAdd:'armorPierce',executeBelowAdd:'executeBelow',
  pushAdd:'push',arcAdd:'arc',
 };
 for(let path=0;path<3;path++)for(const upgrade of def.paths[path].upgrades.slice(0,tiers[path])){
  for(const [key,value] of Object.entries(upgrade.delta) as [keyof StatDelta,number|boolean][]){
   if(key==='detects'){attack.detects=attack.detects||Boolean(value);continue;}
   const keyMul=multipliers[key],keyAdd=increments[key];
   if(keyMul)(attack as unknown as Record<string,number>)[keyMul]*=Number(value);
   else if(keyAdd)(attack as unknown as Record<string,number>)[keyAdd]+=Number(value);
   else throw Error(`Unexpected stat delta: ${key}`);
  }
  for(const effect of upgrade.effects??[])effects.set(effect.id,structuredClone(effect));
  for(const ability of upgrade.abilities??[]){
   const index=abilities.findIndex(item=>item.id===ability.id);
   if(index>=0)abilities[index]=structuredClone(ability);else abilities.push(structuredClone(ability));
  }
  for(const status of upgrade.addStatuses??[]){
   const index=attack.statuses.findIndex(item=>item.kind===status.kind);
   if(index>=0)attack.statuses[index]=structuredClone(status);
   else attack.statuses.push(structuredClone(status));
  }
 }
 const secondary=tiers.findIndex((t,p)=>t>0&&p!==main);
 return {
  attack,effects:[...effects.values()],abilities,
  visual:main<0?def.visual:def.paths[main].upgrades[tiers[main]-1].visual,
  mainPath:main<0?undefined:main,
  secondaryOverlay:secondary<0?undefined:`/art/towers/rail/${paths[secondary]}${tiers[secondary]}-overlay.svg`,
 };
}

function numericLeaves(value:unknown,prefix=''):number[] {
 if(typeof value==='number'){
  expect(Number.isFinite(value),`${prefix} must be finite`).toBe(true);
  return [value];
 }
 if(Array.isArray(value))return value.flatMap((v,i)=>numericLeaves(v,`${prefix}[${i}]`));
 if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>numericLeaves(v,`${prefix}.${k}`));
 return [];
}

describe('Рельсотрон / complete standalone content',()=>{
 it('has the required base properties and provides deep-independent copies',()=>{
  const one=getTower(),two=getTower();
  expect([one.id,one.category,one.placement,one.cost,one.footprint]).toEqual(['rail','weapon','land',950,26]);
  expect([one.attack.damage,one.attack.interval,one.attack.range]).toEqual([100,2.8,290]);
  one.paths[0].upgrades[0].cost=1;
  one.attack.damage=0;
  expect(two.paths[0].upgrades[0].cost).toBe(550);
  expect(two.attack.damage).toBe(100);
 });

 it('has exactly 15 stable, named, nonempty upgrades with mandated independent prices',()=>{
  const def=getTower(),ids=new Set<string>();
  expect(def.paths.map(p=>p.upgrades.length)).toEqual([5,5,5]);
  expect(def.paths.map(p=>p.id)).toEqual(['rail-a','rail-b','rail-c']);
  def.paths.forEach((path,p)=>path.upgrades.forEach((upgrade,t)=>{
   expect(upgrade.id).toMatch(new RegExp(`^rail-${paths[p]}${t+1}-`));
   expect(ids.has(upgrade.id)).toBe(false);
   ids.add(upgrade.id);
   expect(upgrade.tier).toBe(t+1);
   expect(upgrade.cost).toBe(costs[p][t]);
   expect(upgrade.cost).toBe(upgradeCost(950,[1.15,1,0.95][p],(t+1) as 1|2|3|4|5));
   expect(upgrade.name.length).toBeGreaterThan(4);
   expect(upgrade.description.length).toBeGreaterThan(30);
   expect(numericLeaves(upgrade).every(Number.isFinite)).toBe(true);
   if(t<2)expect(upgrade.replaceAttack).toBeUndefined();
  }));
  expect(ids.size).toBe(15);
  expect(numericLeaves(def).every(Number.isFinite)).toBe(true);
 });

 it('resolves every legal permutation in the 6x6x6 tier cube',()=>{
  let legal=0;
  const def=getTower();
  for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
   const tiers:Tiers=[a,b,c];
   if(!legalTiers(tiers)){
    expect(()=>resolveFixture(def,tiers)).toThrow(RangeError);
    continue;
   }
   legal++;
   const result=resolveFixture(def,tiers);
   expect(result.attack.interval).toBeGreaterThanOrEqual(0.05);
   expect(result.attack.range).toBeGreaterThan(0);
   expect(result.attack.damage).toBeGreaterThan(0);
   expect(result.attack.pierce).toBeGreaterThanOrEqual(1);
   expect(result.attack.count).toBeGreaterThanOrEqual(1);
   expect(result.attack.statuses.every(s=>s.duration>0&&s.maxStacks!==0)).toBe(true);
   numericLeaves(result);
   expect(result.visual.asset).toMatch(/^\/art\/towers\/rail\/(base|[abc][1-5])\.svg$/);
   if(result.secondaryOverlay)expect(existsSync(resolve(assetDir,result.secondaryOverlay.split('/').at(-1)!))).toBe(true);
  }
  expect(legal).toBe(64);
 });

 it('preserves the six different T5 main shapes and allows a useful secondary T2',()=>{
  const def=getTower();
  const cases:[Tiers,string,string][]=[
   [[5,2,0],'shot','a5.svg'],[[5,0,2],'shot','a5.svg'],
   [[2,5,0],'beam','b5.svg'],[[0,5,2],'beam','b5.svg'],
   [[2,0,5],'shot','c5.svg'],[[0,2,5],'shot','c5.svg'],
  ];
  const overlays=new Set<string>();
  for(const [tiers,mode,file] of cases){
   const r=resolveFixture(def,tiers);
   expect(r.attack.mode).toBe(mode);
   expect(r.visual.asset).toContain(file);
   expect(r.secondaryOverlay).toContain('-overlay.svg');
   overlays.add(r.secondaryOverlay!);
   const spent=def.cost+tiers.reduce((total,t,p)=>total+def.paths[p].upgrades.slice(0,t).reduce((n,u)=>n+u.cost,0),0);
   expect(sellRefund(spent)).toBe(Math.floor(spent*0.7));
   expect(sellRefund(spent)).toBeLessThan(spent);
  }
  expect(overlays.size).toBe(3);
  expect(resolveFixture(def,[5,0,2]).attack.detects).toBe(true);
  expect(resolveFixture(def,[5,2,0]).attack.pierce).toBe(3);
  expect(resolveFixture(def,[2,5,0]).attack.armorPierce).toBeGreaterThan(50);
  expect(resolveFixture(def,[0,5,2]).attack.detects).toBe(true);
  expect(resolveFixture(def,[2,0,5]).attack.bossMultiplier).toBeGreaterThan(2);
  expect(resolveFixture(def,[0,2,5]).attack.pierce).toBe(3);
  expect(resolveFixture(def,[5,0,0]).effects.map(e=>e.kind)).toContain('charge');
  expect(resolveFixture(def,[0,0,5]).effects.map(e=>e.kind)).toContain('focus');
  expect(resolveFixture(def,[0,5,0]).attack.count).toBe(3);
 });

 it('ships the 16 distinct complete drawings, six safe overlays and the live catalog',()=>{
  const expected=['base',...paths.flatMap(p=>[1,2,3,4,5].map(t=>`${p}${t}`))];
  const bodies=new Set<string>();
  for(const name of expected){
   const file=resolve(assetDir,`${name}.svg`);
   expect(existsSync(file),file).toBe(true);
   const svg=readFileSync(file,'utf8');
   expect(svg).toMatch(/<svg[^>]+viewBox="0 0 128 128"/);
   expect(svg).toContain('</svg>');
   expect(svg).toMatch(/<(path|polygon|rect|circle)\b/);
   expect(svg).not.toMatch(/<script|<text\b|<image\b|<foreignObject|\s(?:href|src)\s*=|url\(https?:/i);
   bodies.add(svg);
  }
  expect(bodies.size).toBe(16);
  for(const name of paths.flatMap(p=>[1,2].map(t=>`${p}${t}-overlay`))){
   const body=readFileSync(resolve(assetDir,`${name}.svg`),'utf8');
   expect(body).toContain('viewBox="0 0 128 128"');
   expect(body).not.toMatch(/<script|<text\b|<image\b|<foreignObject|\s(?:href|src)\s*=/i);
   expect(body.length).toBeGreaterThan(700);
  }
  const html=readFileSync(resolve(assetDir,'preview.html'),'utf8');
  const localImages=[...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m=>m[1]);
  expect(localImages.length).toBe(16+12+12);
  for(const src of localImages)expect(existsSync(resolve(assetDir,src)),src).toBe(true);
  expect(html).toContain('Финальные кросс-пути');
 });
});
