import {describe, expect, it} from 'vitest';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AttackDef, EffectDef, ResolvedTower, StatDelta, Tiers, UpgradeDef} from '../../src/contracts';
import {canUpgrade, legalTiers, sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/prism';

const costs = [[605,1210,3025,7260,18150],
 [550,1100,2750,6600,16500],[525,1045,2615,6270,15675]];
const artRoot = resolve(process.cwd(),'public/art/towers/prism');
const paths = ['a','b','c'];

/** Local combat fixture: implements the frozen data-resolution order, not the combat loop. */
function resolveFixture(tiers:Tiers):ResolvedTower {
 if(!legalTiers(tiers))throw Error('illegal tiers');
 const tower=getTower();
 const highest=Math.max(...tiers);
 const main=highest>0?tiers.indexOf(highest):-1;
 let attack:AttackDef=structuredClone(tower.attack);
 if(main>=0) {
  const replacements=tower.paths[main].upgrades.slice(0,tiers[main]).filter(u=>u.replaceAttack);
  if(replacements.length)attack=structuredClone(replacements.at(-1)!.replaceAttack!);
 }
 let visual=tower.visual;
 let effects:EffectDef[]=structuredClone(tower.effects);
 const abilities=structuredClone(tower.abilities);
 const delta=(d:StatDelta)=>{
  for(const [prop,val] of Object.entries(d) as [keyof StatDelta,number|boolean][]) {
   if(prop==='detects'){attack.detects=Boolean(val);continue;}
   const ops:Record<string,keyof AttackDef>={
    damageMul:'damage',intervalMul:'interval',rangeMul:'range',shieldMultiplierMul:'shieldMultiplier',
    bossMultiplierMul:'bossMultiplier',projectileSpeedMul:'projectileSpeed',windupMul:'windup',
    pierceAdd:'pierce',countAdd:'count',splashAdd:'splash',chainsAdd:'chains',
    chainRadiusAdd:'chainRadius',armorPierceAdd:'armorPierce',executeBelowAdd:'executeBelow',
    pushAdd:'push',arcAdd:'arc',
   };
   const field=ops[prop];
   if(!field)throw Error('unsupported delta: '+prop);
   const before=attack[field] as number;
   (attack as unknown as Record<string,unknown>)[field]=prop.endsWith('Mul')?before*(val as number):before+(val as number);
  }
 };
 for(let p=0;p<3;p++)for(const u of tower.paths[p].upgrades.slice(0,tiers[p])) {
  delta(u.delta);
  for(const status of u.addStatuses??[]) {
   attack.statuses=attack.statuses.filter(s=>s.kind!==status.kind);
   attack.statuses.push(structuredClone(status));
  }
  for(const e of u.effects??[]) {
   effects=effects.filter(x=>x.id!==e.id);
   effects.push(structuredClone(e));
  }
  for(const a of u.abilities??[]) {
   const i=abilities.findIndex(x=>x.id===a.id);
   if(i>=0)abilities[i]=structuredClone(a);else abilities.push(structuredClone(a));
  }
 }
 if(main>=0)visual=tower.paths[main].upgrades[tiers[main]-1].visual;
 const secondary=tiers.findIndex((n,i)=>n>0&&i!==main);
 const secondaryOverlay=secondary>=0?'/art/towers/prism/'+paths[secondary]+Math.min(tiers[secondary],2)+'-overlay.svg':undefined;
 return {attack,effects,abilities,visual,secondaryOverlay,mainPath:main>=0?main as 0|1|2:undefined};
}

function numericFinite(v:unknown):boolean {
 if(typeof v==='number')return Number.isFinite(v);
 if(v===null||typeof v!=='object')return true;
 return Object.values(v).every(numericFinite);
}
function invested(tiers:Tiers):number {
 return 1100+tiers.reduce((sum,t,p)=>sum+costs[p].slice(0,t).reduce((a,b)=>a+b,0),0);
}
function allLegal():Tiers[] {
 const list:Tiers[]=[];
 for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++) {
  const tiers:Tiers=[a,b,c];if(legalTiers(tiers))list.push(tiers);
 }
 return list;
}
const getAura=(resolved:ResolvedTower,id:string)=>resolved.effects.find(e=>e.id===id);
const upgradeList=():UpgradeDef[]=>getTower().paths.flatMap(p=>p.upgrades);

describe('prism catalog',()=>{
 it('has original base combat values and exactly 3×5 correctly priced upgrades',()=>{
  const tower=getTower();
  expect([tower.id,tower.cost,tower.footprint,tower.category,tower.placement]).toEqual(['prism',1100,26,'element','land']);
  expect([tower.attack.mode,tower.attack.damage,tower.attack.interval,tower.attack.range]).toEqual(['beam',15,.3,185]);
  expect(tower.paths.map(p=>p.id)).toEqual(paths);
  const ids=new Set<string>();
  tower.paths.forEach((path,p)=>{
   expect(path.upgrades).toHaveLength(5);
   path.upgrades.forEach((u,i)=>{
    expect(u.id).toBe('prism-'+path.id+(i+1));
    expect(u.tier).toBe(i+1);
    expect(u.cost).toBe(costs[p][i]);
    expect(u.cost).toBeGreaterThan(0);
    expect(u.name.length).toBeGreaterThan(8);
    expect(u.description.length).toBeGreaterThan(30);
    expect(ids.has(u.id)).toBe(false);ids.add(u.id);
    expect(numericFinite(u)).toBe(true);
    if(i<2)expect(u.replaceAttack).toBeUndefined();
   });
  });
  expect(ids.size).toBe(15);
 });
 it('returns fresh independent objects on every call',()=>{
  const a=getTower(),b=getTower();
  a.attack.damage=999;a.paths[0].upgrades[0].delta.damageMul=333;
  a.paths[2].upgrades[4].effects![0].power=999;
  expect(b.attack.damage).toBe(15);
  expect(b.paths[0].upgrades[0].delta.damageMul).toBe(1.15);
  expect(b.paths[2].upgrades[4].effects![0].power).toBe(.36);
 });
 it('makes meaningful cross-effects at T1/T2 of every branch',()=>{
  const a=resolveFixture([2,0,0]),b=resolveFixture([0,2,0]),c=resolveFixture([0,0,2]);
  expect(a.attack.damage).toBeCloseTo(17.25);
  expect(a.attack.armorPierce).toBe(3);
  expect(a.attack.bossMultiplier).toBeCloseTo(1.16);
  expect(b.attack.count).toBe(2);
  expect(b.attack.pierce).toBe(2);
  expect(c.attack.detects).toBe(true);
  expect(c.attack.statuses.map(s=>s.kind)).toEqual(['reveal','mark']);
  expect(c.attack.range).toBeCloseTo(203.5);
 });
 it('expresses distinct T5 behavior and capped support without economy loops',()=>{
  const a=resolveFixture([5,0,0]),b=resolveFixture([0,5,0]),c=resolveFixture([0,0,5]);
  expect(a.attack.count).toBe(1);
  expect(a.attack.damage/a.attack.interval).toBeCloseTo(847.54728,3);
  expect(getAura(a,'prism-focus')).toMatchObject({kind:'focus',power:.35,cap:2.1});
  expect(a.abilities).toMatchObject([{kind:'overclock',cooldown:70,duration:6}]);
  expect(b.attack.count).toBe(7);
  expect(b.attack.damage/b.attack.interval*b.attack.count).toBeCloseTo(1629.33333,3);
  expect(b.abilities[0]).toMatchObject({kind:'nova',power:155,radius:195,cooldown:60});
  expect(c.attack.count).toBe(3);
  expect(c.attack.detects).toBe(true);
  expect(c.attack.statuses.map(s=>s.kind)).toEqual(['reveal','mark']);
  expect(getAura(c,'prism-judgment-damage')).toMatchObject({power:.36,radius:225});
  expect(getAura(c,'prism-judgment-tempo')).toMatchObject({power:.25,radius:205});
  expect(getAura(c,'prism-judgment-detect')).toMatchObject({power:1,radius:230});
  expect(c.abilities[0]).toMatchObject({kind:'nova',power:90,radius:205,cooldown:75});
  for(const u of upgradeList())expect((u.effects??[]).some(e=>['income','interest','harvest','copy'].includes(e.kind))).toBe(false);
 });
});

describe('every legal tier state',()=>{
 it('resolves deterministically with finite combat values, caps and unique IDs',()=>{
  const states=allLegal();expect(states.length).toBeGreaterThan(60);
  for(const state of states) {
   const r=resolveFixture(state),r2=resolveFixture(state);
   expect(r).toEqual(r2);
   const main=Math.max(...state)>0?state.indexOf(Math.max(...state)):-1;
   expect(r.mainPath).toBe(main<0?undefined:main);
   expect(r.visual.asset).toBe('/art/towers/prism/'+(main<0?'base':paths[main]+state[main])+'.svg');
   const secondary=state.findIndex((tier,p)=>tier>0&&p!==main);
   expect(r.secondaryOverlay).toBe(secondary<0?undefined:'/art/towers/prism/'+paths[secondary]+state[secondary]+'-overlay.svg');
   expect(numericFinite(r)).toBe(true);
   expect(r.attack.interval).toBeGreaterThanOrEqual(.05);
   expect(r.attack.damage).toBeGreaterThan(0);
   expect(r.attack.count).toBeGreaterThanOrEqual(1);
   expect(r.attack.pierce).toBeGreaterThanOrEqual(1);
   expect(r.attack.range).toBeGreaterThan(0);
   expect(new Set(r.effects.map(e=>e.id)).size).toBe(r.effects.length);
   expect(new Set(r.abilities.map(a=>a.id)).size).toBe(r.abilities.length);
   expect(getAura(r,'prism-judgment-damage')?.power??0).toBeLessThanOrEqual(.4);
   expect(getAura(r,'prism-judgment-tempo')?.power??0).toBeLessThanOrEqual(.5);
   const investedTotal=invested(state);
   expect(investedTotal).toBeGreaterThanOrEqual(1100);
   expect(sellRefund(investedTotal)).toBe(Math.floor(investedTotal*.7));
   expect(sellRefund(investedTotal)).toBeLessThan(investedTotal);
   for(let p=0;p<3;p++)if(canUpgrade(state,p as 0|1|2)) {
    const next:Tiers=[...state];next[p]++;
    expect(legalTiers(next)).toBe(true);
   }
  }
 });
 it('handles all six maximal crosses, preserving the main specialization',()=>{
  const states:Tiers[]=[[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
  for(const state of states) {
   const main=state.indexOf(5),other=state.indexOf(2);
   const r=resolveFixture(state);
   expect(r.mainPath).toBe(main);
   expect(r.visual.asset).toBe('/art/towers/prism/'+paths[main]+'5.svg');
   expect(r.secondaryOverlay).toBe('/art/towers/prism/'+paths[other]+'2-overlay.svg');
   expect(existsSync(resolve(artRoot,paths[other]+'2-overlay.svg'))).toBe(true);
   expect(invested(state)).toBeGreaterThan(28000);
   expect(r.attack.count).toBeGreaterThanOrEqual(1);
   if(main===0)expect(getAura(r,'prism-focus')?.cap).toBe(2.1);
   if(main===1)expect(r.attack.count).toBeGreaterThanOrEqual(7);
   if(main===2)expect(getAura(r,'prism-judgment-damage')?.power).toBe(.36);
  }
 });
});

describe('visual asset inventory',()=>{
 it('has 16 different complete 128px SVGs, 6 overlays and a working local gallery',()=>{
  const full=['base',...paths.flatMap(p=>[1,2,3,4,5].map(t=>p+t))];
  const overlays=paths.flatMap(p=>[1,2].map(t=>p+t+'-overlay'));
  const strings=new Set<string>();
  for(const id of [...full,...overlays]) {
   const file=resolve(artRoot,id+'.svg');
   expect(existsSync(file),file).toBe(true);
   const svg=readFileSync(file,'utf8');
   expect(svg).toContain('viewBox="0 0 128 128"');
   expect(svg).toMatch(/^<svg /);
   expect(svg).toContain('</svg>');
   expect(svg.replace('xmlns="http://www.w3.org/2000/svg"',''))
    .not.toMatch(/<script\b|<text\b|<foreignObject\b|https?:\/\/|xlink:href|<image\b/i);
   expect(svg.length).toBeGreaterThan(id.endsWith('overlay')?500:2400);
   expect(strings.has(svg),id).toBe(false);strings.add(svg);
  }
  for(const u of upgradeList())expect(full.map(x=>'/art/towers/prism/'+x+'.svg')).toContain(u.visual.asset);
  const preview=readFileSync(resolve(artRoot,'preview.html'),'utf8');
  for(const id of [...full,...overlays])expect(preview).toContain(id+'.svg');
  expect((preview.match(/class="tile"/g)??[]).length).toBe(28);
 });
});
