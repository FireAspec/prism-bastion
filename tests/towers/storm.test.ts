import {describe, expect, it} from 'vitest';
import {readFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canUpgrade, legalTiers, sellRefund} from '../../src/contracts/rules';
import type {AttackDef, PathIndex, Tiers, TowerDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/storm';

const artDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/art/towers/storm');
const costs = [[550,1100,2750,6600,16500],[580,1155,2890,6930,17325],[525,1045,2615,6270,15675]];
const numericField: Record<string,string> = {
  damageMul:'damage',intervalMul:'interval',rangeMul:'range',pierceAdd:'pierce',
  countAdd:'count',splashAdd:'splash',chainsAdd:'chains',chainRadiusAdd:'chainRadius',
  armorPierceAdd:'armorPierce',shieldMultiplierMul:'shieldMultiplier',
  bossMultiplierMul:'bossMultiplier',executeBelowAdd:'executeBelow',pushAdd:'push',
  projectileSpeedMul:'projectileSpeed',windupMul:'windup',arcAdd:'arc',
};
function fixture(def: TowerDef, tiers: Tiers) {
  if (!legalTiers(tiers)) throw new Error('Invalid tiers');
  const major = tiers.findIndex(t=>t>=3);
  const main = (major>=0?major:tiers.findIndex(t=>t===Math.max(...tiers))) as PathIndex;
  const latest=[...def.paths[main].upgrades.slice(0,tiers[main])].reverse().find(u=>u.replaceAttack);
  const attack: AttackDef = structuredClone(latest?.replaceAttack ?? def.attack);
  const numbers=attack as unknown as Record<string,number>;
  const statuses=new Map(attack.statuses.map(s=>[s.kind,structuredClone(s)]));
  const effects=new Map(def.effects.map(e=>[e.id,structuredClone(e)]));
  const abilities=new Map(def.abilities.map(a=>[a.id,structuredClone(a)]));
  let invested=def.cost;
  for(let p=0;p<3;p++)for(const u of def.paths[p].upgrades.slice(0,tiers[p])) {
    invested+=u.cost;
    for(const [k,v] of Object.entries(u.delta)) {
      if(typeof v==='boolean') {attack.detects=v;continue;}
      const dest=numericField[k];
      if(!dest) throw new Error('Unknown delta '+k);
      numbers[dest]=k.endsWith('Mul')?numbers[dest]*v:numbers[dest]+v;
    }
    for(const s of u.addStatuses??[]) {
      const old=statuses.get(s.kind);
      statuses.set(s.kind,old?{...s,duration:Math.max(old.duration,s.duration),power:Math.max(old.power,s.power)}:structuredClone(s));
    }
    for(const effect of u.effects??[]) effects.set(effect.id,structuredClone(effect));
    for(const ability of u.abilities??[]) abilities.set(ability.id,structuredClone(ability));
  }
  attack.statuses=[...statuses.values()];
  const second=tiers.findIndex((tier,i)=>tier>0&&i!==main);
  return {attack,invested,effects:[...effects.values()],abilities:[...abilities.values()],
    visual: tiers[main]===0?def.visual:def.paths[main].upgrades[tiers[main]-1].visual,
    overlay:second<0?undefined:'/art/towers/storm/'+'abc'[second]+tiers[second]+'-overlay.svg'};
}
describe('storm tower data',()=>{
 it('declares exactly fifteen sequential, independently priced upgrades',()=>{
  const d=getTower();
  expect([d.id,d.category,d.placement,d.cost,d.footprint]).toEqual(['storm','element','land',1100,26]);
  expect([d.attack.damage,d.attack.interval,d.attack.range]).toEqual([22,1.2,200]);
  expect(d.paths).toHaveLength(3);
  const all=d.paths.flatMap(p=>p.upgrades);
  expect(all).toHaveLength(15);
  expect(new Set(all.map(u=>u.id)).size).toBe(15);
  d.paths.forEach((p,i)=>{
    expect(p.upgrades.map(u=>u.cost)).toEqual(costs[i]);
    expect(p.upgrades.map(u=>u.tier)).toEqual([1,2,3,4,5]);
    expect(p.upgrades.slice(0,2).every(u=>!u.replaceAttack)).toBe(true);
    expect(p.upgrades[4].replaceAttack).toBeDefined();
    for(const u of p.upgrades) {
      expect(u.id).toBe('storm-'+'abc'[i]+u.tier);
      expect(u.name.length).toBeGreaterThan(6);
      expect(u.description.length).toBeGreaterThan(45);
      expect(u.cost).toBeGreaterThan(0);
      for(const v of Object.values(u.delta))if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);
    }
  });
  d.attack.damage=-1;
  expect(getTower().attack.damage).toBe(22);
 });
 it('keeps all effects finite and never generates money',()=>{
  const d=getTower();
  for(const a of [d.attack,...d.paths.flatMap(p=>p.upgrades.map(u=>u.replaceAttack).filter((x):x is AttackDef=>!!x))]){
    expect(a.interval).toBeGreaterThanOrEqual(.05);
    for(const v of Object.values(a))if(typeof v==='number'){expect(Number.isFinite(v)).toBe(true);expect(v).toBeGreaterThanOrEqual(0);}
  }
  for(const u of d.paths.flatMap(p=>p.upgrades)){
    for(const e of u.effects??[]){expect(['echo','focus']).toContain(e.kind);expect(e.cap).toBeGreaterThan(0);}
    for(const ability of u.abilities??[]){expect(ability.cooldown).toBeGreaterThan(0);expect(ability.power).toBeGreaterThan(0);}
  }
 });
 it('resolves the complete finite legal tier matrix and correct resale',()=>{
  const d=getTower();
  let legal=0;
  for(let a=0;a<6;a++)for(let b=0;b<6;b++)for(let c=0;c<6;c++){
    const t:Tiers=[a,b,c];
    if(!legalTiers(t)){expect(()=>fixture(d,t)).toThrow();continue;}
    legal++;
    const r=fixture(d,t);
    expect(r.attack.damage).toBeGreaterThan(0);
    expect(r.attack.interval).toBeGreaterThanOrEqual(.05);
    expect(r.attack.range).toBeGreaterThan(0);
    expect(sellRefund(r.invested)).toBe(Math.floor(.7*r.invested));
    expect(new Set(r.effects.map(e=>e.id)).size).toBe(r.effects.length);
    expect(new Set(r.abilities.map(e=>e.id)).size).toBe(r.abilities.length);
    for(const v of Object.values(r.attack))if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);
    for(const p of [0,1,2] as PathIndex[])if(canUpgrade(t,p)){
      const next:Tiers=[...t];next[p]++;
      expect(fixture(d,next).invested-r.invested).toBe(d.paths[p].upgrades[t[p]].cost);
    }
  }
  expect(legal).toBeGreaterThan(40);
 });
 it('preserves each main tier-five attack and applies all six tier-two overlays',()=>{
  const d=getTower();
  const cases:{t:Tiers;mode:string;useful:(a:AttackDef)=>boolean}[]=[
    {t:[5,2,0],mode:'ring',useful:a=>a.armorPierce===4&&a.bossMultiplier===1.2},
    {t:[5,0,2],mode:'ring',useful:a=>a.interval<.6&&a.statuses.some(s=>s.kind==='wet')},
    {t:[2,5,0],mode:'chain',useful:a=>a.push===11&&a.chains===11},
    {t:[0,5,2],mode:'chain',useful:a=>a.interval<1.05&&a.statuses.some(s=>s.kind==='wet')},
    {t:[2,0,5],mode:'pulse',useful:a=>a.push===11&&a.splash===124},
    {t:[0,2,5],mode:'pulse',useful:a=>a.armorPierce===4&&a.shieldMultiplier===1.15}
  ];
  for(const {t,mode,useful} of cases){
    const got=fixture(d,t);
    const pure:Tiers=[0,0,0];pure[t.findIndex(i=>i===5)]=5;
    expect(got.attack.mode).toBe(mode);
    expect(got.visual.asset).toBe(fixture(d,pure).visual.asset);
    expect(got.overlay).toMatch(/[abc]2-overlay.svg$/);
    expect(useful(got.attack),t.join('-')).toBe(true);
  }
  const a=fixture(d,[5,2,0]);
  expect(a.attack.damage).toBeCloseTo(121.7216,4);
  expect(a.attack.interval).toBeCloseTo(.65016,5);
  const c=fixture(d,[2,0,5]);
  expect(c.attack.damage).toBeCloseTo(83.1488,4);
  expect(c.attack.interval).toBeCloseTo(.549666,5);
 });
});
describe('storm visuals',()=>{
 it('has sixteen full SVGs, six overlays and the offline crosspath preview',()=>{
  const main=['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(t=>p+t))];
  const overlay=['a','b','c'].flatMap(p=>[1,2].map(t=>p+t+'-overlay'));
  expect(main).toHaveLength(16);expect(overlay).toHaveLength(6);
  for(const name of [...main,...overlay]){
    const file=join(artDir,name+'.svg');expect(existsSync(file),name).toBe(true);
    const svg=readFileSync(file,'utf8');
    expect(svg).toContain('viewBox="0 0 128 128"');
    expect(svg).toMatch(/<path|<ellipse|<circle/);
    expect(svg).not.toMatch(/<script|<text\b|<foreignObject|<image\b|<use\b|@import/i);
    expect((svg.match(/<path/g)||[]).length).toBeGreaterThanOrEqual(name.includes('overlay')?2:14);
  }
  const html=readFileSync(join(artDir,'preview.html'),'utf8');
  for(const name of main)expect(html).toContain('src="'+name+'.svg"');
  for(const p of ['a','b','c'])for(const q of ['a','b','c'].filter(x=>x!==p)){
    expect(html).toContain(p.toUpperCase()+'5–'+q.toUpperCase()+'2–0');
    expect(html).toContain('src="'+q+'2-overlay.svg"');
  }
  expect(html).not.toMatch(/<script|https?:\/\/|@import/i);
 });
});
