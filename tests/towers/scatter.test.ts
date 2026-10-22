import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Script} from 'node:vm';
import {canUpgrade, legalTiers, sellRefund} from '../../src/contracts/rules';
import type {AttackDef, PathIndex, ResolvedTower, StatDelta, Tiers, TowerDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/scatter';

const art = resolve(process.cwd(), 'public/art/towers/scatter');
const costs = [[215,425,1065,2550,6375],[195,385,960,2295,5740],[235,470,1170,2810,7015]];

// A local fixture, not a substitute combat engine: defines how mode-changing
// upgrades and minor secondary deltas are composed for content validation.
function applyDelta(attack: AttackDef, d: StatDelta): AttackDef {
  const next = structuredClone(attack);
  for(const [key,value] of Object.entries(d) as [keyof StatDelta,number|boolean][]) {
    if(key==='detects') {next.detects = value as boolean;continue;}
    const multiply: Partial<Record<keyof StatDelta,keyof AttackDef>> = {
      damageMul:'damage', intervalMul:'interval', rangeMul:'range',
      shieldMultiplierMul:'shieldMultiplier', bossMultiplierMul:'bossMultiplier',
      projectileSpeedMul:'projectileSpeed', windupMul:'windup',
    };
    const add: Partial<Record<keyof StatDelta,keyof AttackDef>> = {
      pierceAdd:'pierce', countAdd:'count', splashAdd:'splash', chainsAdd:'chains',
      chainRadiusAdd:'chainRadius', armorPierceAdd:'armorPierce', executeBelowAdd:'executeBelow',
      pushAdd:'push', arcAdd:'arc',
    };
    const target=multiply[key] ?? add[key];
    if(!target)throw new Error(`Unsupported fixture modifier: ${key}`);
    const old=next[target];
    if(typeof old!=='number')throw new Error('Delta target is not numeric');
    // AttackDef has mixed properties; writing numeric keys through a validated record.
    (next as unknown as Record<string,number>)[target] = multiply[key] ? old*(value as number) : old+(value as number);
  }
  next.arc=Math.min(360,next.arc);
  return next;
}

function resolveFixture(tower: TowerDef, tiers: Tiers): ResolvedTower {
  if(!legalTiers(tiers))throw new RangeError('Invalid upgrade combination');
  const main=tiers.findIndex(t=>t>2);
  const active=main>=0?main:tiers.findIndex(t=>t>0);
  let attack=structuredClone(tower.attack);
  const effects=structuredClone(tower.effects), abilities=structuredClone(tower.abilities);
  let visual=structuredClone(tower.visual);
  const order=main>=0?[main,...[0,1,2].filter(i=>i!==main)]:[0,1,2];
  for(const p of order){
    const upgrades=tower.paths[p].upgrades.slice(0,tiers[p]);
    // The mode-changing replacement already incorporates same-path T1/T2.
    let lastReplacement=-1;
    for(let i=0;i<upgrades.length;i++)if(upgrades[i].replaceAttack!==undefined)lastReplacement=i;
    if(lastReplacement>=0)attack=structuredClone(upgrades[lastReplacement].replaceAttack!);
    for(let i=(lastReplacement>=0?lastReplacement+1:0);i<upgrades.length;i++)attack=applyDelta(attack,upgrades[i].delta);
    for(const upgrade of upgrades){
      if(upgrade.addStatuses)attack.statuses.push(...structuredClone(upgrade.addStatuses));
      if(upgrade.effects)effects.push(...structuredClone(upgrade.effects));
      if(upgrade.abilities)abilities.push(...structuredClone(upgrade.abilities));
    }
    if(p===active && upgrades.length)visual=structuredClone(upgrades.at(-1)!.visual);
  }
  const secondary=main>=0?[0,1,2].find(i=>i!==main&&tiers[i]>0):undefined;
  const secondaryOverlay=secondary===undefined?undefined:
    `/art/towers/scatter/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`;
  return {attack,effects,abilities,visual,secondaryOverlay,...(main<0?{}:{mainPath:main as PathIndex})};
}

describe('Веерный страж: содержание',()=>{
  it('has the promised base statistics and a fresh, independent catalog object',()=>{
    const tower=getTower();
    expect(tower).toMatchObject({
      id:'scatter',cost:425,footprint:26,category:'weapon',placement:'land',
      attack:{mode:'cone',element:'kinetic',damage:6,interval:0.9,range:115,count:5},
    });
    tower.paths[0].upgrades[0].cost=-1;
    tower.attack.statuses.push({kind:'slow',power:1,duration:1});
    expect(getTower().paths[0].upgrades[0].cost).toBe(215);
    expect(getTower().attack.statuses).toEqual([]);
  });
  it('defines exactly three complete paths and exactly fifteen globally unique upgrades',()=>{
    const tower=getTower(), ids=new Set<string>();
    expect(tower.paths).toHaveLength(3);
    tower.paths.forEach((path,p)=>{
      expect(path.upgrades).toHaveLength(5);
      path.upgrades.forEach((u,i)=>{
        expect(u.id).toBe(`scatter-${'abc'[p]}${i+1}`);
        expect(u.tier).toBe(i+1);
        expect(u.cost).toBe(costs[p][i]);
        expect(u.name.length).toBeGreaterThan(7);
        expect(u.description.length).toBeGreaterThan(35);
        expect(ids.has(u.id)).toBe(false);ids.add(u.id);
      });
    });
    expect(ids.size).toBe(15);
  });
  it('keeps all numerical values, prices and resale limits finite and safe',()=>{
    const tower=getTower();
    for(const u of tower.paths.flatMap(p=>p.upgrades)){
      expect(Number.isSafeInteger(u.cost)).toBe(true);
      expect(u.cost).toBeGreaterThan(0);
      const fields=[u.delta,u.replaceAttack,...(u.effects??[]),...(u.abilities??[]),...(u.addStatuses??[])];
      for(const obj of fields.filter(x=>x!==undefined)){
        for(const value of Object.values(obj!))if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);
      }
      expect(sellRefund(tower.cost+u.cost)).toBeLessThan(tower.cost+u.cost);
    }
  });
  it('supports every legal one- and two-path state with bounded meaningful values',()=>{
    const tower=getTower();
    let legal=0;
    for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
      const tiers:Tiers=[a,b,c];
      if(!legalTiers(tiers)){expect(()=>resolveFixture(tower,tiers)).toThrow();continue;}
      legal++;
      const r=resolveFixture(tower,tiers);
      for(const key of ['damage','interval','range','count','pierce','arc','armorPierce'] as const){
        expect(Number.isFinite(r.attack[key])).toBe(true);
        expect(r.attack[key]).toBeGreaterThanOrEqual(0); // zero valid for armor penetration
      }
      expect(r.attack.interval).toBeGreaterThan(0);
      expect(r.attack.interval).toBeGreaterThanOrEqual(0.25);
      expect(r.attack.damage).toBeGreaterThan(0);
      expect(r.attack.count).toBeGreaterThanOrEqual(1);
      expect(r.attack.armorPierce).toBeLessThanOrEqual(1);
      expect(r.attack.arc).toBeLessThanOrEqual(360);
      expect(r.visual.asset.endsWith('.svg')).toBe(true);
      expect(existsSync(resolve(process.cwd(),'public'+r.visual.asset))).toBe(true);
      if(Math.max(...tiers)>2)expect(r.mainPath).toBe(tiers.findIndex(t=>t>2));
      for(const p of [0,1,2] as PathIndex[]){
        const next:Tiers=[...tiers];next[p]++;
        expect(canUpgrade(tiers,p)).toBe(legalTiers(next));
      }
    }
    expect(legal).toBeGreaterThan(60);
  });
  it('makes early cross-path choices useful regardless of main specialization',()=>{
    const tower=getTower();
    for(const main of [0,1,2]){
      const bare:Tiers=[0,0,0];bare[main]=5;
      const original=resolveFixture(tower,bare).attack;
      for(const secondary of [0,1,2].filter(p=>p!==main)){
        const cross:Tiers=[...bare];cross[secondary]=2;
        const result=resolveFixture(tower,cross).attack;
        expect(result.mode).toBe(original.mode);
        expect(result).not.toEqual(original);
        if(secondary===0){expect(result.pierce).toBeGreaterThan(original.pierce);expect(result.interval).toBeLessThan(original.interval);}
        if(secondary===1){expect(result.armorPierce).toBeGreaterThan(original.armorPierce);expect(result.bossMultiplier).toBeGreaterThan(original.bossMultiplier);}
        if(secondary===2){expect(result.range).toBeGreaterThan(original.range);expect(result.detects).toBe(true);}
      }
    }
  });
  it('has three substantially different T5 modes and unique capstones',()=>{
    const tower=getTower();
    const A=resolveFixture(tower,[5,0,0]), B=resolveFixture(tower,[0,5,0]), C=resolveFixture(tower,[0,0,5]);
    expect(A.attack).toMatchObject({mode:'cone',count:16,pierce:3,arc:96});
    expect(A.attack.interval).toBeCloseTo(0.60912);
    expect(A.attack.statuses).toContainEqual({kind:'slow',power:0.07,duration:0.6,maxStacks:1});
    expect(B.attack.mode).toBe('shot');
    expect(B.attack.count).toBe(3);
    expect(B.attack.damage).toBeCloseTo(40.6725);
    expect(B.attack.armorPierce).toBeCloseTo(0.82);
    expect(B.attack.statuses[0].kind).toBe('shred');
    expect(C.attack).toMatchObject({mode:'ring',count:20,arc:360,detects:true});
    expect(C.attack.interval).toBeCloseTo(0.5738688);
    expect(C.abilities).toHaveLength(1);
    expect(C.abilities[0]).toMatchObject({kind:'nova',power:42,cooldown:20,radius:120});
  });
  it('keeps every fifth-tier cross-path silhouette and loads its exact secondary overlay',()=>{
    const tower=getTower();
    for(const main of [0,1,2])for(const secondary of [0,1,2].filter(i=>i!==main)){
      const tiers:Tiers=[0,0,0];tiers[main]=5;tiers[secondary]=2;
      const result=resolveFixture(tower,tiers);
      expect(result.visual.asset).toBe(tower.paths[main].upgrades[4].visual.asset);
      expect(result.secondaryOverlay).toBe(`/art/towers/scatter/${'abc'[secondary]}2-overlay.svg`);
      expect(existsSync(resolve(process.cwd(),'public'+result.secondaryOverlay!))).toBe(true);
    }
  });
});

describe('Веерный страж: рисунки',()=>{
  it('has exactly 16 full models, six overlays and a functional offline preview',()=>{
    const filenames=readdirSync(art).sort();
    const expected=['base.svg','preview.html'];
    for(const p of 'abc'){
      for(let t=1;t<=5;t++)expected.push(`${p}${t}.svg`);
      for(let t=1;t<=2;t++)expected.push(`${p}${t}-overlay.svg`);
    }
    expect(filenames).toEqual(expected.sort());
    const preview=readFileSync(resolve(art,'preview.html'),'utf8');
    expect(preview).toContain("crossModels.append");
    const script=preview.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(()=>new Script(script!)).not.toThrow();
  });
  it('validates SVG boundaries, visible geometry and isolation from external resources',()=>{
    for(const filename of readdirSync(art).filter(x=>x.endsWith('.svg'))){
      const svg=readFileSync(resolve(art,filename),'utf8');
      expect(svg).toMatch(/<svg\b[^>]*viewBox="0 0 128 128"/);
      expect(svg).toMatch(/<\/(?:svg)>/);
      expect(svg).toMatch(/<(?:path|rect|circle|polygon|ellipse)\b/);
      expect(svg.length).toBeGreaterThan(1600);
      expect(svg).not.toMatch(/<(?:script|foreignObject|image|text)\b|\b(?:href|src)\s*=|url\((?!#)/i);
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
    const base=readFileSync(resolve(art,'base.svg'),'utf8');
    for(const p of 'abc')for(let t=1;t<=5;t++){
      const svg=readFileSync(resolve(art,`${p}${t}.svg`),'utf8');
      expect(svg).not.toBe(base);
      if(t>1)expect(svg).not.toBe(readFileSync(resolve(art,`${p}${t-1}.svg`),'utf8'));
    }
  });
});
