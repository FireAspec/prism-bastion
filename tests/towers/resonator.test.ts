import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import type {AttackDef,EffectDef,StatusSpec,Tiers,PathIndex} from '../../src/contracts';
import {legalTiers,canUpgrade,sellRefund,upgradeCost} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/resonator';

const art=resolve(fileURLToPath(new URL('../..',import.meta.url)),'public/art/towers/resonator');
const prices=[[350,700,1750,4200,10500],[335,665,1665,3990,9975],[390,775,1930,4625,11555]];

/** Isolated v1 fixture following the combat resolver's replacement and multiplier rules. */
function fixtureResolve(tiers:Tiers){
 if(!legalTiers(tiers))throw new RangeError('illegal crosspath');
 const def=getTower();
 const main=tiers.every(n=>n===0)?-1:tiers.indexOf(Math.max(...tiers));
 let attack:AttackDef=structuredClone(def.attack);
 if(main>=0)for(const u of def.paths[main].upgrades.slice(0,tiers[main]))if(u.replaceAttack)attack=structuredClone(u.replaceAttack);
 const effects=new Map<string,EffectDef>(def.effects.map(e=>[e.id,e]));
 const statuses=new Map<string,StatusSpec>(attack.statuses.map(s=>[s.kind,s]));
 const abilities=new Map(def.abilities.map(a=>[a.id,a]));
 let visual=def.visual;
 for(let p=0;p<3;p++)for(const u of def.paths[p].upgrades.slice(0,tiers[p])){
  const d=u.delta;
  for(const [field,mul] of [['damage','damageMul'],['interval','intervalMul'],['range','rangeMul'],
   ['projectileSpeed','projectileSpeedMul'],['windup','windupMul'],['shieldMultiplier','shieldMultiplierMul'],['bossMultiplier','bossMultiplierMul']] as const)
   if(d[mul]!==undefined)attack[field]*=d[mul];
  for(const [field,add] of [['pierce','pierceAdd'],['count','countAdd'],['splash','splashAdd'],
   ['chains','chainsAdd'],['chainRadius','chainRadiusAdd'],['armorPierce','armorPierceAdd'],['executeBelow','executeBelowAdd'],['push','pushAdd'],['arc','arcAdd']] as const)
   if(d[add]!==undefined)attack[field]+=d[add];
  if(d.detects)attack.detects=true;
  for(const s of u.addStatuses??[]){
   const old=statuses.get(s.kind);
   statuses.set(s.kind,old?{kind:s.kind,power:Math.max(old.power,s.power),duration:Math.max(old.duration,s.duration),maxStacks:Math.max(old.maxStacks??1,s.maxStacks??1)}:s);
  }
  for(const e of u.effects??[])effects.set(e.id,e);
  for(const a of u.abilities??[])abilities.set(a.id,a);
  if(p===main)visual=u.visual;
 }
 attack.statuses=[...statuses.values()];
 const second=tiers.findIndex((tier,p)=>p!==main&&tier>0);
 return {attack,effects:[...effects.values()],abilities:[...abilities.values()],visual,mainPath:main,
  secondaryOverlay:second<0?undefined:def.paths[second].upgrades[tiers[second]-1].visual.asset.replace(/\.svg$/,'-overlay.svg')};
}

describe('resonator frozen content',()=>{
 it('provides a fresh tech/land catalog entry with the exact base',()=>{
  const a=getTower(),b=getTower();
  expect([a.id,a.category,a.placement,a.cost,a.footprint]).toEqual(['resonator','tech','land',700,26]);
  expect([a.attack.damage,a.attack.interval,a.attack.range]).toEqual([18,1.1,155]);
  a.paths[0].upgrades[0].cost=1;a.attack.damage=0;
  expect(b.paths[0].upgrades[0].cost).toBe(350);expect(b.attack.damage).toBe(18);
 });
 it('defines all fifteen exact tier costs, stable IDs and distinct visual attacks',()=>{
  const t=getTower(),ids=new Set<string>(),names=new Set<string>(),visuals=new Set<string>([t.visual.projectile]);
  expect(t.paths).toHaveLength(3);
  for(let p=0;p<3;p++){
   expect(t.paths[p].upgrades.map(u=>u.cost)).toEqual(prices[p]);
   expect([1,2,3,4,5].map(n=>upgradeCost(700,[1,.95,1.1][p],n as 1|2|3|4|5))).toEqual(prices[p]);
   for(let i=0;i<5;i++){
    const u=t.paths[p].upgrades[i];
    expect(u.tier).toBe(i+1);expect(u.id).toBe(`resonator-${'abc'[p]}${i+1}`);
    expect(u.description.length).toBeGreaterThan(25);ids.add(u.id);names.add(u.name);visuals.add(u.visual.projectile);
    if(i<2)expect(u.replaceAttack).toBeUndefined();
   }
  }
  expect(ids.size).toBe(15);expect(names.size).toBe(15);expect(visuals.size).toBe(16);
 });
 it('resolves 64 legal and rejects 152 illegal combinations',()=>{
  let valid=0,invalid=0;
  for(let a=0;a<6;a++)for(let b=0;b<6;b++)for(let c=0;c<6;c++){
   const tiers:Tiers=[a,b,c];
   if(!legalTiers(tiers)){invalid++;expect(()=>fixtureResolve(tiers)).toThrow();continue;}
   valid++;const r=fixtureResolve(tiers);
   for(const n of Object.values(r.attack))if(typeof n==='number')expect(Number.isFinite(n)).toBe(true);
   expect(r.attack.damage).toBeGreaterThan(0);expect(r.attack.interval).toBeGreaterThanOrEqual(.05);
   expect(r.attack.pierce).toBeGreaterThanOrEqual(1);expect(r.attack.range).toBeGreaterThan(0);
   if(r.attack.mode==='ring'||r.attack.mode==='pulse')expect(r.attack.splash).toBe(0);
   expect(r.effects.length).toBe(new Set(r.effects.map(e=>e.id)).size);
   expect(r.abilities.length).toBe(new Set(r.abilities.map(e=>e.id)).size);
   for(const e of r.effects){
    expect([e.power,e.radius,e.interval,e.duration,e.cap].every(Number.isFinite)).toBe(true);
    if(e.kind==='aura'&&e.stat==='attackSpeed')expect(e.power).toBeLessThanOrEqual(.5);
    if(e.kind==='aura'&&e.stat==='damage')expect(e.power).toBeLessThanOrEqual(.4);
   }
   for(const s of r.attack.statuses)expect(Number.isFinite(s.power)&&s.duration>0).toBe(true);
   for(let p=0;p<3;p++)if(canUpgrade(tiers,p as PathIndex)){
    const next:Tiers=[...tiers];next[p]++;expect(()=>fixtureResolve(next)).not.toThrow();
   }
   if(Math.max(...tiers)===5)expect(r.abilities).toHaveLength(1);
  }
  expect([valid,invalid]).toEqual([64,152]);
 });
 it('chooses the higher tier and breaks ties by smaller path index',()=>{
  expect(fixtureResolve([1,2,0]).mainPath).toBe(1);
  expect(fixtureResolve([2,2,0]).mainPath).toBe(0);
  expect(fixtureResolve([0,0,0]).mainPath).toBe(-1);
 });
 it('keeps literal multiplier semantics and prevents accidental ring collapse',()=>{
  const a=fixtureResolve([5,0,0]);expect(a.attack.damage).toBeCloseTo(139.104,8);
  expect(a.attack.range).toBeCloseTo(245*1.10*1.12,8);
  expect(a.attack.splash).toBe(0);
  expect(a.effects.find(e=>e.kind==='echo')).toMatchObject({radius:100,cap:6,power:.35,interval:.7});
  expect(fixtureResolve([0,4,0]).attack.mode).toBe('beam');
  expect(fixtureResolve([0,5,0]).attack.statuses.find(s=>s.kind==='shred')).toMatchObject({power:9,duration:5});
  expect(fixtureResolve([0,0,5]).effects.find(e=>e.stat==='attackSpeed')?.power).toBe(.45);
 });
 it('changes behavior at T3 and T5 in every branch',()=>{
  for(let p=0;p<3;p++){
   const t3:Tiers=[0,0,0],t4:Tiers=[0,0,0],t5:Tiers=[0,0,0];t3[p]=3;t4[p]=4;t5[p]=5;
   const a=fixtureResolve(t3),b=fixtureResolve(t4),c=fixtureResolve(t5);
   expect(a.attack.mode).toBe(['ring','shot','pulse'][p]);
   expect(c.attack.mode).toBe(['ring','pulse','pulse'][p]);
   expect(c.attack.damage).toBeGreaterThan(a.attack.damage*1.5);
   expect(c.attack.pierce).toBeGreaterThan(b.attack.pierce);
   expect(c.abilities).toHaveLength(1);
  }
 });
 it('preserves all six T5 main visuals and useful secondary effects',()=>{
  for(let p=0;p<3;p++)for(let q=0;q<3;q++)if(p!==q){
   const x:Tiers=[0,0,0],y:Tiers=[0,0,0];x[p]=y[p]=5;y[q]=2;
   const single=fixtureResolve(x),r=fixtureResolve(y);
   expect(r.mainPath).toBe(p);expect(r.attack.mode).toBe(single.attack.mode);expect(r.visual.asset).toBe(single.visual.asset);
   expect(r.secondaryOverlay).toBe(`/art/towers/resonator/${'abc'[q]}2-overlay.svg`);
   if(q===0){expect(r.attack.damage).toBeGreaterThan(single.attack.damage);expect(r.attack.range).toBeGreaterThan(single.attack.range);}
   if(q===1){expect(r.attack.detects).toBe(true);expect(r.attack.statuses.some(s=>s.kind==='mark')).toBe(true);}
   if(q===2){expect(r.attack.interval).toBeLessThan(single.attack.interval);expect(r.effects.some(e=>e.stat==='attackSpeed')).toBe(true);}
   expect(r.attack.splash).toBe(0);
  }
 });
 it('cannot generate income or positive refund cycles',()=>{
  const t=getTower();
  for(let p=0;p<3;p++){const tiers:Tiers=[0,0,0];tiers[p]=5;const r=fixtureResolve(tiers);
   expect(r.effects.every(e=>e.kind==='aura'||e.kind==='echo')).toBe(true);
   expect(r.abilities.every(a=>a.kind==='nova')).toBe(true);
   const cost=t.cost+t.paths[p].upgrades.reduce((n,u)=>n+u.cost,0);
   expect(sellRefund(cost)).toBe(Math.floor(cost*.7));expect(sellRefund(cost)).toBeLessThan(cost);
  }
 });
 it('provides sixteen 128px models, six suffix overlays and a local preview',()=>{
  const names=['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(n=>p+n))];
  for(const name of [...names,...['a','b','c'].flatMap(p=>[1,2].map(n=>p+n+'-overlay'))]){
   const svg=readFileSync(resolve(art,name+'.svg'),'utf8');
   expect(svg).toMatch(/<svg[^>]+viewBox="0 0 128 128"/);
   expect(svg).toMatch(/<(path|polygon|circle|ellipse|rect)\b/);
   expect(svg).not.toMatch(/<(script|image|text|foreignObject)\b|(?:href|src)=["']https?:\/\/|xlink:href=/i);
   expect(svg).toContain('</svg>');
  }
  const html=readFileSync(resolve(art,'preview.html'),'utf8');
  for(const n of names)expect(html).toContain(`src="${n}.svg"`);
  for(const p of 'abc')expect(html).toContain(`${p}2-overlay.svg`);
  expect((html.match(/class="tile cross /g)??[])).toHaveLength(6);
 });
});
