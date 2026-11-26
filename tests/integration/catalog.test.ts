import {describe,it,expect} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {loadContent,validateContent} from '../../src/content';
import {createCombat} from '../../src/combat';
import {legalTiers,canUpgrade,sellRefund} from '../../src/contracts/rules';
import type {Tiers,ResolvedTower} from '../../src/contracts';
import {towerIds,tiers,legal,paths} from './fixtures';

const sortKeys=(v:unknown):unknown=>Array.isArray(v)?v.map(sortKeys):v && typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,sortKeys(x)])):v;
const behavior=(r:ResolvedTower)=>sortKeys({attack:r.attack,effects:r.effects,abilities:r.abilities});
function asset(ref:string,id:string):string {
 const root=resolve('public/art/towers',id);
 const file=resolve('public',ref.replace(/^\/?public\//,'').replace(/^\//,''));
 expect(relative(root,file),ref).toMatch(/^[^/\\]+\.svg$/);
 expect(existsSync(file),file).toBe(true);
 const svg=readFileSync(file,'utf8');
 expect(svg,ref).toMatch(/<svg\b/);
 expect(svg,ref).not.toMatch(/<script\b|<foreignObject\b|(?:href|src)\s*=\s*["'](?:https?:|\/\/|javascript:)/i);
 return svg;
}
describe('Frozen rules: independent finite oracle',()=>{
 it('all 216 triples and three outgoing edges',()=>{
  expect(legal.size).toBe(64);
  for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
   const t:Tiers=[a,b,c]; const label=t.join(',');
   expect(legalTiers(t),label).toBe(legal.has(label));
   for(const p of paths){const next:Tiers=[...t];next[p]++;
    expect(canUpgrade(t,p),label+' path '+p).toBe(legal.has(label)&&legal.has(next.join(',')));
   }
  }
  for(const t of [[-1,0,0],[6,0,0],[1.5,0,0],[NaN,0,0],[Infinity,0,0]] as Tiers[])expect(legalTiers(t)).toBe(false);
 });
 it('refund uses actual invested credits and always loses money',()=>{
  for(const [paid,refund] of [[1,0],[9,6],[100,70],[81,56],[999,699],[1100,770]])expect(sellRefund(paid)).toBe(refund);
  for(const v of [0,-1,1.1,Infinity,NaN])expect(()=>sellRefund(v)).toThrow();
 });
});
describe('Integrated tower catalog',()=>{
 it('exact inventory and validator',()=>{
  const c=loadContent();
  expect(c.towers.map(x=>x.id).sort()).toEqual([...towerIds].sort());
  expect(validateContent(c)).toEqual([]);
 });
 for(const id of towerIds)it(id+': 15 real upgrades, 64 resolutions, all art and overlays',()=>{
  const c=loadContent();const combat=createCombat();
  const def=c.towers.find(x=>x.id===id);expect(def,id).toBeDefined();if(!def)throw Error(id);
  const original=structuredClone(def);
  expect(def.paths).toHaveLength(3);
  expect(new Set(def.paths.map(x=>x.id)).size).toBe(3);
  const seenAssets=new Set<string>(); const seenUpgradeIds=new Set<string>();
  const art=new Set<string>();
  art.add(asset(def.visual.asset,id));seenAssets.add(def.visual.asset);
  const finals:unknown[]=[];
  for(const p of paths){
   expect(def.paths[p].upgrades.map(x=>x.tier)).toEqual([1,2,3,4,5]);
   for(let t=1;t<=5;t++){
    const before:Tiers=[0,0,0];before[p]=t-1;const after:Tiers=[...before];after[p]=t;
    const upgrade=def.paths[p].upgrades[t-1];
    expect(upgrade.cost).toBeGreaterThan(0);expect(upgrade.cost%5).toBe(0);
    expect(seenUpgradeIds.has(upgrade.id)).toBe(false);seenUpgradeIds.add(upgrade.id);
    expect(seenAssets.has(upgrade.visual.asset)).toBe(false);seenAssets.add(upgrade.visual.asset);
    const svg=asset(upgrade.visual.asset,id);expect(art.has(svg),'duplicate SVG '+upgrade.visual.asset).toBe(false);art.add(svg);
    const r=combat.resolveTower(def,after);
    expect(behavior(r),'no gameplay change at '+upgrade.id).not.toEqual(behavior(combat.resolveTower(def,before)));
    expect(r.visual.asset).toBe(upgrade.visual.asset);
    if(t===5)finals.push(behavior(r));
   }
   for(const t of [1,2])asset('art/towers/'+id+'/'+'abc'[p]+t+'-overlay.svg',id);
  }
  expect(seenUpgradeIds.size).toBe(15);expect(seenAssets.size).toBe(16);
  expect(new Set(finals.map(x=>JSON.stringify(x))).size).toBe(3);
  for(const t of tiers){
   const r=combat.resolveTower(def,[...t]);const label=id+' '+t.join(',');
   expect(r.attack.interval,label).toBeGreaterThanOrEqual(.05);
   for(const value of Object.values(r.attack))if(typeof value==='number')expect(Number.isFinite(value),label).toBe(true);
   expect(new Set(r.effects.map(x=>x.id)).size,label).toBe(r.effects.length);
   expect(new Set(r.abilities.map(x=>x.id)).size,label).toBe(r.abilities.length);
   const highest=Math.max(...t);
   if(highest>0){
    const main=t.indexOf(highest);
    expect(r.visual.asset,label).toBe(def.paths[main].upgrades[highest-1].visual.asset);
    const second=t.findIndex((v,i)=>v>0&&i!==main);
    if(second>=0){expect(r.secondaryOverlay,label).toBeDefined();asset(r.secondaryOverlay!,id);}
   }
   expect(behavior(combat.resolveTower(def,[...t])),label).toEqual(behavior(r));
  }
  expect(def).toEqual(original);
 });
});
