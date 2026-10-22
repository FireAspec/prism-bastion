import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {EffectDef, ResolvedTower, Tiers, TowerDef, UpgradeDef} from '../../src/contracts';
import {legalTiers, sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/mint';

const root = join(process.cwd(), 'public/art/towers/mint');
const costs = [[500,1000,2500,6000,15000],[525,1050,2625,6300,15750],[475,950,2375,5700,14250]];
const byId = (effects:EffectDef[], id:string)=>effects.find(e=>e.id===id);

/** Contract-specific fixture until the independent combat module lands. */
function resolveFixture(def:TowerDef, tiers:Tiers):ResolvedTower {
  if(!legalTiers(tiers)) throw new Error('Illegal tier selection');
  const effects = new Map(def.effects.map(e=>[e.id, {...e}]));
  const abilities = new Map(def.abilities.map(a=>[a.id, {...a}]));
  const active = [0,1,2].filter(i=>tiers[i]>0);
  const mainPath = active.find(i=>tiers[i]>2) ?? active[0] ?? 0;
  for(let path=0;path<3;path++) {
    for(let level=0;level<tiers[path];level++) {
      const upgrade = def.paths[path].upgrades[level];
      for(const effect of upgrade.effects ?? []) effects.set(effect.id,{...effect});
      for(const ability of upgrade.abilities ?? []) abilities.set(ability.id,{...ability});
    }
  }
  const secondary = active.find(i=>i!==mainPath);
  return {
    attack:structuredClone(def.attack), effects:[...effects.values()], abilities:[...abilities.values()],
    visual:tiers[mainPath] ? structuredClone(def.paths[mainPath].upgrades[tiers[mainPath]-1].visual) : structuredClone(def.visual),
    mainPath:mainPath as 0|1|2,
    secondaryOverlay:secondary===undefined ? undefined : `/art/towers/mint/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`,
  };
}

function allLegalTiers():Tiers[] {
  const cases:Tiers[]=[];
  for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++) {
    const candidate:[number,number,number]=[a,b,c];
    if(legalTiers(candidate)) cases.push(candidate);
  }
  return cases;
}

describe('mint content',()=>{
  it('provides a real non-attacking base income and independent mutable data',()=>{
    const original=getTower(), other=getTower();
    expect(original).toMatchObject({id:'mint',cost:1000,category:'economy',placement:'land',footprint:26});
    expect(original.attack).toMatchObject({damage:0,interval:1,range:0});
    expect(original.effects).toEqual([{id:'mint-wave-income',kind:'income',power:65,radius:0,interval:0,duration:0,cap:0}]);
    original.effects[0].power=999;
    original.paths[0].upgrades[0].effects![0].power=999;
    original.paths[1].upgrades[3].visual.asset='unwanted.svg';
    expect(other.effects[0].power).toBe(65);
    expect(other.paths[0].upgrades[0].effects![0].power).toBe(95);
    expect(other.paths[1].upgrades[3].visual.asset).toBe('/art/towers/mint/b4.svg');
  });

  it('has 15 named sequential upgrades and exact separate prices',()=>{
    const tower=getTower(), ids=new Set<string>(), names=new Set<string>();
    expect(tower.paths).toHaveLength(3);
    tower.paths.forEach((path,p)=>{
      expect(path.upgrades).toHaveLength(5);
      path.upgrades.forEach((u,t)=>{
        expect(u.id).toBe(`mint-${'abc'[p]}${t+1}`);
        expect(u.tier).toBe(t+1);
        expect(u.cost).toBe(costs[p][t]);
        expect(u.cost).toBeGreaterThan(0);
        expect(u.name.length).toBeGreaterThan(5);
        expect(u.description.length).toBeGreaterThan(35);
        expect(ids.has(u.id)).toBe(false);ids.add(u.id);
        expect(names.has(u.name)).toBe(false);names.add(u.name);
        expect(Object.keys(u.delta).length+(u.effects?.length??0)+(u.abilities?.length??0)).toBeGreaterThan(0);
        for(const eff of u.effects??[]) {
          for(const key of ['power','radius','interval','duration','cap'] as const) expect(Number.isFinite(eff[key])).toBe(true);
          expect(eff.power).toBeGreaterThan(0);
        }
        for(const ability of u.abilities??[]) {
          expect(ability.cooldown).toBeGreaterThanOrEqual(120);
          expect(ability.power).toBeGreaterThan(0);
          expect(ability.kind).toBe('mint');
        }
      });
    });
    expect(ids.size).toBe(15);
  });

  it('resolves all 64 legal tier triples with unique capped effects and no attack',()=>{
    const def=getTower(), legal=allLegalTiers();
    expect(legal).toHaveLength(64);
    for(const tiers of legal){
      const resolved=resolveFixture(def,tiers);
      expect(resolved.attack.damage).toBe(0);
      expect(resolved.attack.range).toBe(0);
      expect(new Set(resolved.effects.map(e=>e.id)).size).toBe(resolved.effects.length);
      expect(new Set(resolved.abilities.map(a=>a.id)).size).toBe(resolved.abilities.length);
      const i=byId(resolved.effects,'mint-wave-income');
      expect(i?.power).toBeGreaterThanOrEqual(65);
      const harvest=byId(resolved.effects,'mint-harvest');
      if(harvest){expect(harvest.kind).toBe('harvest');expect(harvest.cap).toBeGreaterThan(0);expect(harvest.power).toBeLessThan(1);}
      const filename=resolved.visual.asset.split('/').at(-1)!;
      expect(existsSync(join(root,filename)),filename).toBe(true);
      if(resolved.secondaryOverlay)expect(existsSync(join(root,resolved.secondaryOverlay.split('/').at(-1)!))).toBe(true);
    }
    expect(legalTiers([1,1,1])).toBe(false);
    expect(legalTiers([3,3,0])).toBe(false);
    expect(legalTiers([5,5,0])).toBe(false);
  });

  it('keeps the primary tier-five identity for each of six 5-2-0 combinations',()=>{
    for(let main=0;main<3;main++)for(let secondary=0;secondary<3;secondary++){
      if(main===secondary)continue;
      const tiers:Tiers=[0,0,0];tiers[main]=5;tiers[secondary]=2;
      const r=resolveFixture(getTower(),tiers);
      expect(r.mainPath).toBe(main);
      expect(r.visual.asset).toBe(`/art/towers/mint/${'abc'[main]}5.svg`);
      expect(r.secondaryOverlay).toBe(`/art/towers/mint/${'abc'[secondary]}2-overlay.svg`);
    }
  });

  it('replaces earlier tiers by ID instead of stacking money or payouts',()=>{
    const a=resolveFixture(getTower(),[5,0,2]);
    expect(a.effects.filter(e=>e.kind==='income')).toHaveLength(1);
    expect(byId(a.effects,'mint-wave-income')?.power).toBe(1280);
    expect(byId(a.effects,'mint-discount')?.power).toBe(.1);
    expect(byId(a.effects,'mint-guard-damage')?.power).toBe(.06);
    const b=resolveFixture(getTower(),[2,5,0]);
    expect(byId(b.effects,'mint-wave-income')?.power).toBe(135);
    expect(byId(b.effects,'mint-harvest')).toMatchObject({kind:'harvest',power:.28,radius:230,cap:1150});
    expect(byId(b.effects,'mint-rhythm')?.power).toBe(.14);
    const c=resolveFixture(getTower(),[2,0,5]);
    expect(c.abilities).toHaveLength(1);
    expect(c.abilities[0]).toMatchObject({kind:'mint',power:3600,cooldown:165});
    expect(byId(c.effects,'mint-guard-detect')?.power).toBe(1);
  });

  it('puts independently bounded funds through a non-recursive event fixture',()=>{
    const tower=resolveFixture(getTower(),[0,5,0]);
    const bonus=byId(tower.effects,'mint-harvest')!;
    const kills=[{id:'e1',cash:600,inside:true},{id:'e2',cash:2500,inside:true},{id:'e2',cash:2500,inside:true},{id:'e3',cash:999,inside:false}];
    let paid=0; const seen=new Set<string>();
    for(const kill of kills){
      if(!kill.inside || seen.has(kill.id))continue;
      seen.add(kill.id);
      paid+=Math.min(bonus.cap-paid,kill.cash*bonus.power);
    }
    expect(paid).toBeCloseTo(868,8); // 600×.28 + 2500×.28, duplicate e2 ignored.
    expect(Math.min(bonus.cap,paid+1000)).toBe(1150);
    expect(byId(tower.effects,'mint-wave-income')?.power).toBe(65);
  });

  it('never modifies the fixed 70% refund rule',()=>{
    const tower=getTower();
    for(const path of tower.paths){
      let invested=tower.cost;
      for(const upgrade of path.upgrades){
        invested+=upgrade.cost;
        expect(sellRefund(invested)).toBe(Math.floor(invested*.7));
        expect(sellRefund(invested)).toBeLessThan(invested);
      }
    }
    expect(getTower().effects.some(e=>e.kind==='interest')).toBe(false);
  });

  it('ships complete local SVG models, overlays and a contact preview without remote assets',()=>{
    const names=['base',...['a','b','c'].flatMap(b=>[1,2,3,4,5].map(t=>`${b}${t}`)),
      ...['a','b','c'].flatMap(b=>[1,2].map(t=>`${b}${t}-overlay`))];
    expect(names).toHaveLength(22);
    for(const name of names){
      const svg=readFileSync(join(root,`${name}.svg`),'utf8');
      expect(svg).toContain('viewBox="0 0 128 128"');
      expect(svg).toMatch(/<path|<rect|<polygon|<ellipse|<circle/);
      expect(svg.replace(/xmlns="[^"]+"/g,'')).not.toMatch(/<script\b|<text\b|<foreignObject\b|https?:\/\/|href=|url\(https?:/i);
      expect(svg.length).toBeGreaterThan(1300);
    }
    const preview=readFileSync(join(root,'preview.html'),'utf8');
    expect(preview).toContain('Шесть финальных сочетаний');
    for(const name of names)if(!name.endsWith('1-overlay'))expect(preview).toContain(`${name}.svg`);
  });
});
