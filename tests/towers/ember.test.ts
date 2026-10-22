import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AttackDef,AbilityDef,EffectDef,StatDelta,StatusSpec,Tiers,TowerDef,VisualState} from '../../src/contracts';
import {getTower} from '../../src/content/towers/ember';

const assetRoot = resolve(process.cwd(),'public/art/towers/ember');
const expectedPrices = [
  [300,600,1500,3600,9000],
  [330,660,1650,3960,9900],
  [285,570,1425,3420,8550],
];

function legal(t:[number,number,number]):boolean {
  return t.filter(n=>n>0).length<=2 && t.filter(n=>n>2).length<=1;
}
function allBuilds():Tiers[] {
  const result:Tiers[]=[];
  for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
    const tiers:Tiers=[a,b,c];
    if(legal(tiers))result.push(tiers);
  }
  return result;
}

/** Local contract fixture while src/combat is independently developed. */
function fixture(def:TowerDef,tiers:Tiers){
  if(!legal(tiers))throw Error('illegal tiers');
  const main=tiers.findIndex(n=>n>=3)>=0 ? tiers.findIndex(n=>n>=3) : tiers.findIndex(n=>n>0);
  const high= main<0 ? null : def.paths[main].upgrades[tiers[main]-1];
  let attack:AttackDef=structuredClone(def.attack);
  if(main>=0 && tiers[main]>=3){
    // Contract: highest replaceAttack in the principal line, not second-line cosmetic.
    for(let t=3;t<=tiers[main];t++){
      const replacement=def.paths[main].upgrades[t-1].replaceAttack;
      if(replacement)attack=structuredClone(replacement);
    }
  }
  const effects=new Map<string,EffectDef>(def.effects.map(e=>[e.id,e]));
  const abilities=new Map<string,AbilityDef>(def.abilities.map(a=>[a.id,a]));
  const statuses=new Map<string,StatusSpec>(attack.statuses.map(s=>[s.kind,s]));
  const deltaKeys:(keyof StatDelta)[]=['damageMul','intervalMul','rangeMul','shieldMultiplierMul','bossMultiplierMul','projectileSpeedMul','windupMul'];
  const addKeys:(keyof StatDelta)[]=['pierceAdd','countAdd','splashAdd','chainsAdd','chainRadiusAdd','armorPierceAdd','executeBelowAdd','pushAdd','arcAdd'];
  for(let branch=0;branch<3;branch++)for(let tier=1;tier<=tiers[branch];tier++){
    const u=def.paths[branch].upgrades[tier-1];
    const d=u.delta;
    for(const k of deltaKeys){
      if(d[k]===undefined)continue;
      const field=k.replace(/Mul$/,'') as keyof AttackDef;
      (attack as unknown as Record<string,number>)[field]*=d[k] as number;
    }
    for(const k of addKeys){
      if(d[k]===undefined)continue;
      const field=k.replace(/Add$/,'') as keyof AttackDef;
      (attack as unknown as Record<string,number>)[field]+=d[k] as number;
    }
    if(d.detects!==undefined)attack.detects=d.detects;
    for(const s of u.addStatuses??[]){
      const original=statuses.get(s.kind);
      if(!original || s.power>original.power)statuses.set(s.kind,structuredClone(s));
    }
    for(const e of u.effects??[])effects.set(e.id,structuredClone(e));
    for(const a of u.abilities??[])abilities.set(a.id,structuredClone(a));
  }
  attack.statuses=[...statuses.values()];
  const secondary=tiers.findIndex((n,i)=>n>0&&i!==main);
  return {
    attack,effects:[...effects.values()],abilities:[...abilities.values()],
    visual:high?.visual??def.visual,mainPath:main,
    secondaryOverlay:secondary<0?undefined:`/art/towers/ember/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`,
  };
}

describe('ember content: 3 × 5',()=>{
  it('has the fixed base identity, prices, full numeric attack and independent instances',()=>{
    const one=getTower(),two=getTower();
    expect([one.id,one.category,one.placement,one.cost,one.footprint]).toEqual(['ember','element','land',600,25]);
    expect([one.attack.damage,one.attack.interval,one.attack.range]).toEqual([9,0.8,145]);
    expect(one.paths.map(p=>p.upgrades.map(u=>u.cost))).toEqual(expectedPrices);
    expect(one.paths.map(p=>p.upgrades.length)).toEqual([5,5,5]);
    expect(one.paths.flatMap(p=>p.upgrades.map(u=>u.id)).sort()).toEqual(
      Array.from({length:3},(_,i)=>Array.from({length:5},(_,j)=>`ember-${'abc'[i]}${j+1}`)).flat().sort());
    one.attack.statuses[0].power=999;
    one.paths[0].upgrades[0].cost=0;
    expect(two.attack.statuses[0].power).toBe(2);
    expect(two.paths[0].upgrades[0].cost).toBe(300);
  });

  it('keeps all attack/status/effect numbers finite and game-safe',()=>{
    const def=getTower();
    const attacks=[def.attack,...def.paths.flatMap(p=>p.upgrades.flatMap(u=>u.replaceAttack?[u.replaceAttack]:[]))];
    for(const attack of attacks){
      expect(attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(attack.damage).toBeGreaterThan(0);
      expect(attack.range).toBeGreaterThan(0);
      expect(attack.pierce).toBeGreaterThanOrEqual(1);
      expect(attack.count).toBeGreaterThanOrEqual(1);
      expect(['shot','ring','mortar']).toContain(attack.mode);
      for(const v of Object.values(attack))if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);
      for(const s of attack.statuses){
        expect(s.duration).toBeGreaterThan(0);
        expect(s.power).toBeGreaterThan(0);
        if(s.maxStacks!==undefined)expect(s.maxStacks).toBeLessThanOrEqual(8);
      }
    }
    for(const [idx,path] of def.paths.entries()){
      expect(path.upgrades.map(u=>u.tier)).toEqual([1,2,3,4,5]);
      for(const [j,u] of path.upgrades.entries()){
        expect(u.cost).toBe(expectedPrices[idx][j]);
        expect(u.name.length).toBeGreaterThan(5);
        expect(u.description.length).toBeGreaterThan(45);
        if(j<2)expect(u.replaceAttack).toBeUndefined();
        for(const v of Object.values(u.delta))if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);
        for(const e of u.effects??[]){
          for(const v of Object.values(e))if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);
          if(e.kind==='focus'||e.kind==='echo')expect(e.cap).toBeGreaterThan(0);
        }
        for(const a of u.abilities??[]){
          expect(a.cooldown).toBeGreaterThan(0);
          expect(a.power).toBeGreaterThan(0);
        }
      }
    }
  });

  it('resolves every legal matrix and rejects the key illegal combinations',()=>{
    const def=getTower();
    const builds=allBuilds();
    expect(builds).toHaveLength(64);
    for(const t of builds){
      const r=fixture(def,t);
      expect(r.attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(r.attack.damage).toBeGreaterThan(0);
      expect(r.attack.range).toBeGreaterThan(0);
      expect(r.attack.statuses.every(s=>Number.isFinite(s.power)&&Number.isFinite(s.duration))).toBe(true);
      expect(new Set(r.effects.map(e=>e.id)).size).toBe(r.effects.length);
      expect(new Set(r.abilities.map(a=>a.id)).size).toBe(r.abilities.length);
      expect(existsSync(resolve(assetRoot,r.visual.asset.split('/').at(-1)!))).toBe(true);
      if(r.secondaryOverlay)expect(existsSync(resolve(assetRoot,r.secondaryOverlay.split('/').at(-1)!))).toBe(true);
      if(t.some(x=>x>=3))expect(r.attack.mode).toBe(['shot','ring','mortar'][t.findIndex(x=>x>=3)]);
      else expect(r.attack.mode).toBe('shot');
    }
    for(const illegal of [[1,1,1],[3,3,0],[5,5,0],[5,2,2],[3,0,3]] as Tiers[]){
      expect(()=>fixture(def,illegal)).toThrow();
    }
  });

  it('preserves 6 distinct T5 primary forms and correct secondary overlays',()=>{
    const def=getTower();
    const cases:[Tiers,string,string,number][]=[
      [[5,2,0],'shot','b2-overlay.svg',3],
      [[5,0,2],'shot','c2-overlay.svg',3],
      [[2,5,0],'ring','a2-overlay.svg',1],
      [[0,5,2],'ring','c2-overlay.svg',1],
      [[2,0,5],'mortar','a2-overlay.svg',3],
      [[0,2,5],'mortar','b2-overlay.svg',3],
    ];
    for(const [tiers,mode,overlay,count] of cases){
      const r=fixture(def,tiers);
      expect(r.attack.mode).toBe(mode);
      expect(r.attack.count).toBe(count);
      expect(r.secondaryOverlay).toContain(overlay);
      expect(r.visual.asset).toContain(`${'abc'[tiers.indexOf(5)]}5.svg`);
      expect(r.attack.statuses.some(s=>s.kind==='burn')).toBe(true);
    }
    const a=fixture(def,[5,2,0]).attack;
    expect(a.damage).toBeCloseTo(42*1.08*1.12,6);
    expect(a.interval).toBeCloseTo(.38*.92*.9,6);
    expect(a.range).toBeCloseTo(205*1.1,6);
    const c=fixture(def,[0,2,5]).attack;
    expect(c.damage).toBeCloseTo(108*1.09,6);
    expect(c.splash).toBe(116);
    expect(c.range).toBeCloseTo(355*1.12*1.1,6);
    expect(c.detects).toBe(true);
  });

  it('has 16 full views, 6 transparent overlays, and a locally complete 22-image preview',()=>{
    const def=getTower();
    const names=['base',...['a','b','c'].flatMap(b=>[1,2,3,4,5].map(t=>b+t))];
    const overlays=['a','b','c'].flatMap(b=>[1,2].map(t=>b+t+'-overlay'));
    const html=readFileSync(resolve(assetRoot,'preview.html'),'utf8');
    for(const asset of [...names,...overlays]){
      const svg=readFileSync(resolve(assetRoot,asset+'.svg'),'utf8');
      expect(svg).toContain('viewBox="0 0 128 128"');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('<path');
      expect(svg).not.toMatch(/<script|<foreignObject|<text(?:\s|>)|href=|\$\{/i);
      expect(html).toContain('src="'+asset+'.svg"');
    }
    expect(def.visual.asset).toMatch(/\/base\.svg$/);
    expect(names).toHaveLength(16);
    expect(overlays).toHaveLength(6);
    expect((html.match(/<img\s/g)??[])).toHaveLength(40); // 16 views + 6×2 cross pairs + 6×2 overlay proofs
    expect(html).toContain('lang="ru"');
  });
});
