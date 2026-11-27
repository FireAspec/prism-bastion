import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, it, expect} from 'vitest';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, StatDelta, StatusSpec, Tiers, TowerDef} from '../../src/contracts';
import {legalTiers, sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/chrono';

const paths = ['a', 'b', 'c'] as const;
const prices = [[500,1000,2500,6000,15000], [550,1100,2750,6600,16500], [500,1000,2500,6000,15000]];

/** Contract-v1 local fixture. No import of an unfinished combat implementation. */
function resolveFixture(def: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legalTiers(tiers)) throw new Error(`Illegal upgrade ${tiers}`);
  const mainIndex = ([0,1,2] as PathIndex[]).filter(i => tiers[i] > 0)
    .sort((a,b) => tiers[b] - tiers[a] || a-b)[0] ?? -1;
  const path = (mainIndex < 0 ? 0 : mainIndex) as PathIndex;
  const attack = structuredClone(def.attack);
  const effects = structuredClone(def.effects);
  const abilities = structuredClone(def.abilities);
  const replace = def.paths[path].upgrades.slice(0,tiers[path]).reverse().find(u => u.replaceAttack)?.replaceAttack;
  const result: ResolvedTower = {attack: replace ? structuredClone(replace) : attack, effects, abilities,
    visual: structuredClone(tiers[path] ? def.paths[path].upgrades[tiers[path]-1].visual : def.visual),
    mainPath: mainIndex < 0 ? undefined : path};

  const mul: Record<string,keyof AttackDef> = {
    damageMul: 'damage', intervalMul: 'interval', rangeMul: 'range',
    shieldMultiplierMul: 'shieldMultiplier', bossMultiplierMul: 'bossMultiplier',
    projectileSpeedMul: 'projectileSpeed', windupMul: 'windup',
  };
  const add: Record<string,keyof AttackDef> = {
    pierceAdd: 'pierce', countAdd: 'count', splashAdd: 'splash', chainsAdd: 'chains',
    chainRadiusAdd: 'chainRadius', armorPierceAdd: 'armorPierce',
    executeBelowAdd: 'executeBelow', pushAdd: 'push', arcAdd: 'arc',
  };
  const upsert = <T extends {id:string}>(values:T[], update:T) => {
    const index = values.findIndex(v=>v.id === update.id);
    if (index >= 0) values[index] = structuredClone(update);
    else values.push(structuredClone(update));
  };
  const addStatus = (value:StatusSpec) => {
    // The contract's single source/kind policy uses the strongest non-stacking status.
    const index = result.attack.statuses.findIndex(s=>s.kind===value.kind);
    if (index < 0) result.attack.statuses.push({...value});
    else {
      const old = result.attack.statuses[index];
      result.attack.statuses[index] = {kind:value.kind,power:Math.max(old.power,value.power),
        duration:Math.max(old.duration,value.duration),maxStacks:1};
    }
  };
  for (let i=0;i<3;i++) for (let tier=0;tier<tiers[i];tier++) {
    const upgrade = def.paths[i].upgrades[tier];
    const delta:StatDelta = upgrade.delta;
    for (const [key,field] of Object.entries(mul)) if (delta[key as keyof StatDelta] !== undefined) {
      const value=delta[key as keyof StatDelta] as number;
      (result.attack as unknown as Record<string,number>)[field] *= value;
    }
    for (const [key,field] of Object.entries(add)) if (delta[key as keyof StatDelta] !== undefined) {
      const value=delta[key as keyof StatDelta] as number;
      (result.attack as unknown as Record<string,number>)[field] += value;
    }
    if (delta.detects) result.attack.detects=true;
    for (const status of upgrade.addStatuses ?? []) addStatus(status);
    for (const effect of upgrade.effects ?? []) upsert(effects,effect);
    for (const ability of upgrade.abilities ?? []) upsert(abilities,ability);
  }
  const secondary = tiers.findIndex((level,i)=>i!==path && level>0);
  if (secondary>=0) result.secondaryOverlay = `/art/towers/chrono/${paths[secondary]}${tiers[secondary]}-overlay.svg`;
  return result;
}

function checkNumericTree(data: unknown) {
  if (typeof data === 'number') expect(Number.isFinite(data)).toBe(true);
  else if (data && typeof data === 'object')
    for (const v of Object.values(data)) checkNumericTree(v);
}

describe('Хронобашня / schema and strict upgrade bounds', () => {
  it('has exact independent base data, prices, paths, ids and useful base damage', () => {
    const t=getTower();
    expect({id:t.id,cost:t.cost,footprint:t.footprint,placement:t.placement,category:t.category})
      .toEqual({id:'chrono',cost:1000,footprint:26,placement:'land',category:'tech'});
    expect([t.attack.damage,t.attack.interval,t.attack.range]).toEqual([3,1.2,165]);
    expect(t.attack.damage / t.attack.interval).toBeCloseTo(2.5);
    expect(t.paths).toHaveLength(3);
    expect(t.paths.map(p=>p.upgrades.map(u=>u.cost))).toEqual(prices);
    const all=t.paths.flatMap(p=>p.upgrades);
    expect(new Set(all.map(u=>u.id)).size).toBe(15);
    expect(new Set(t.paths.map(p=>p.id)).size).toBe(3);
    for (const path of t.paths) {
      expect(path.upgrades.map(u=>u.tier)).toEqual([1,2,3,4,5]);
      for (const upgrade of path.upgrades) {
        expect(upgrade.cost).toBeGreaterThan(0);
        expect(upgrade.name.length).toBeGreaterThan(5);
        expect(upgrade.description.length).toBeGreaterThan(20);
        if (upgrade.tier <= 2) expect(upgrade.replaceAttack).toBeUndefined();
      }
    }
  });
  it('never replaces an attack before tier 3 and defines genuinely new primary behavior at tier 5',()=>{
    const t=getTower();
    for (const path of t.paths) {
      expect(path.upgrades[0].replaceAttack).toBeUndefined();
      expect(path.upgrades[1].replaceAttack).toBeUndefined();
      expect(path.upgrades[2].replaceAttack).toBeDefined();
      expect(path.upgrades[4].replaceAttack).toBeDefined();
      expect(path.upgrades[4].replaceAttack).not.toEqual(path.upgrades[3].replaceAttack);
    }
    expect(t.paths[0].upgrades[4].effects?.[0].kind).toBe('echo');
    expect(t.paths[1].upgrades[4].replaceAttack?.count).toBe(2);
    expect(t.paths[2].upgrades[4].abilities?.[0].kind).toBe('rewind');
  });
  it('returns a new deep copy and has only finite effects and timers',()=>{
    const t=getTower();
    checkNumericTree(t);
    t.attack.damage=999;
    t.paths[0].upgrades[0].addStatuses![0].power=999;
    expect(getTower().attack.damage).toBe(3);
    expect(getTower().paths[0].upgrades[0].addStatuses![0].power).toBe(0.16);
    for (const path of getTower().paths) for (const u of path.upgrades) {
      for (const e of u.effects ?? []) {
        expect(e.power).toBeGreaterThan(0);
        if (e.kind==='aura') {
          expect(e.stat).toBe('attackSpeed');
          expect(e.power).toBeLessThanOrEqual(0.5);
        }
        if (e.kind==='portal') {
          expect(e.interval).toBeGreaterThan(0);
          expect(e.duration).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('legal tier matrix and 6 ultimate combinations',()=>{
  it('resolves every legal combination without mutating catalog, non-finite stats or missing overlays',()=>{
    const def=getTower();
    const original=JSON.stringify(def);
    let combinations=0;
    for (let a=0;a<=5;a++) for(let b=0;b<=5;b++) for(let c=0;c<=5;c++) {
      const tiers:Tiers=[a,b,c];
      if (!legalTiers(tiers)) continue;
      combinations++;
      const result=resolveFixture(def,tiers);
      checkNumericTree(result);
      expect(result.attack.interval).toBeGreaterThanOrEqual(.05);
      expect(result.attack.damage).toBeGreaterThan(0);
      expect(result.attack.range).toBeGreaterThan(0);
      expect(new Set(result.effects.map(e=>e.id)).size).toBe(result.effects.length);
      expect(new Set(result.abilities.map(e=>e.id)).size).toBe(result.abilities.length);
      expect(existsSync(resolve(`public${result.visual.asset}`))).toBe(true);
      if (result.secondaryOverlay) expect(existsSync(resolve(`public${result.secondaryOverlay}`))).toBe(true);
    }
    expect(combinations).toBe(64);
    expect(JSON.stringify(def)).toBe(original);
  });
  it('preserves main path across all cross paths and grants useful offpath traits',()=>{
    const def=getTower();
    const combos:Tiers[]=[[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
    expect(new Set(combos.map(t=>t.join(','))).size).toBe(6);
    for (const tiers of combos) {
      const r=resolveFixture(def,tiers);
      const main=tiers.indexOf(5);
      const secondary=tiers.indexOf(2);
      expect(r.mainPath).toBe(main);
      expect(r.visual.asset).toBe(`/art/towers/chrono/${paths[main]}5.svg`);
      expect(r.secondaryOverlay).toBe(`/art/towers/chrono/${paths[secondary]}2-overlay.svg`);
      if (secondary===0) {const solo:Tiers=[0,0,0];solo[main]=5;expect(r.attack.range).toBeCloseTo(resolveFixture(def,solo).attack.range*1.12);expect(r.attack.statuses.some(s=>s.kind==='slow')).toBe(true);}
      if (secondary===1) {expect(r.attack.interval).toBeLessThan(.85);expect(r.attack.damage).toBeGreaterThan(13);}
      if (secondary===2) {expect(r.attack.detects).toBe(true);expect(r.attack.statuses.some(s=>s.kind==='mark'&&s.power===.1)).toBe(true);expect(r.attack.push).toBe(0);}
    }
  });
  it('keeps aura definitions non-stacking, portal limited, and resale at 70%',()=>{
    const def=getTower();
    const b=resolveFixture(def,[0,5,2]);
    const aura=b.effects.filter((e):e is EffectDef => e.kind==='aura');
    expect(aura).toHaveLength(1);
    expect(aura[0].power).toBe(.42);
    expect(aura[0].radius).toBe(215);
    expect(aura[0].power).toBeLessThanOrEqual(.5);
    const c=resolveFixture(def,[2,0,5]);
    expect(c.effects.filter(e=>e.kind==='portal')).toHaveLength(1);
    expect(c.effects.find(e=>e.kind==='portal')?.power).toBe(140);
    expect(c.abilities.filter(a=>a.kind==='rewind')).toHaveLength(1);
    for (const t of [[5,2,0],[0,5,2],[2,0,5]] as Tiers[]) {
      const invested=1000+t.reduce((sum,tier,path)=>sum+prices[path].slice(0,tier).reduce((s,cost)=>s+cost,0),0);
      expect(sellRefund(invested)).toBe(Math.floor(invested*.7));
      expect(sellRefund(invested)).toBeLessThan(invested);
    }
  });
});

describe('every asset is an independent safe fully drawn SVG',()=>{
  it('ships all 16 full pictures, six overlays, and a self-contained preview',()=>{
    const ids=['base',...paths.flatMap(p=>[1,2,3,4,5].map(t=>`${p}${t}`)),
      ...paths.flatMap(p=>[1,2].map(t=>`${p}${t}-overlay`))];
    expect(ids).toHaveLength(22);
    const unique=new Set<string>();
    for (const id of ids) {
      const file=resolve(`public/art/towers/chrono/${id}.svg`);
      expect(existsSync(file),id).toBe(true);
      const svg=readFileSync(file,'utf8');
      expect(svg).toMatch(/<svg\s/);
      expect(svg).toMatch(/viewBox="0 0 128 128"/);
      expect(svg).toMatch(/<path |<circle |<ellipse |<polygon /);
      expect(svg.replace('xmlns="http://www.w3.org/2000/svg"','')).not.toMatch(/<script\b|<foreignObject\b|<text\b|https?:\/\/|xlink:href=|<image\b/);
      expect(svg.length).toBeGreaterThan(900);
      unique.add(svg);
    }
    expect(unique.size).toBe(22);
    const page=readFileSync(resolve('public/art/towers/chrono/preview.html'),'utf8');
    for(const id of ids) expect(page).toContain(`${id}.svg`);
    expect((page.match(/class="composite"/g)??[])).toHaveLength(6);
    const finalShapes=paths.map(p=>readFileSync(resolve(`public/art/towers/chrono/${p}5.svg`),'utf8'));
    expect(new Set(finalShapes).size).toBe(3);
    expect(finalShapes.every(s=>s.length>3500)).toBe(true);
  });
});


describe('combat contract regression checks',()=>{
  it('selects the higher low-tier branch and breaks ties in A/B/C order',()=>{
    const def=getTower();
    for(const [tiers,path] of [[[1,2,0],1],[[2,1,0],0],[[0,1,2],2],[[0,2,2],1]] as [Tiers,PathIndex][]) {
      const result=resolveFixture(def,tiers);
      expect(result.mainPath).toBe(path);
      expect(result.visual.asset).toBe(def.paths[path].upgrades[tiers[path]-1].visual.asset);
    }
  });
  it('uses contact-centered splash for A and a full-range local ring for C5',()=>{
    const def=getTower();
    for(const tier of [3,4,5]){
      const a=resolveFixture(def,[tier,0,0]).attack;
      expect(a.mode).toBe('splash');
      expect(a.splash).toBeGreaterThan(0);
      expect(a.projectileSpeed).toBeGreaterThan(0);
      expect(a.range).toBeGreaterThan(a.splash);
    }
    const c=resolveFixture(def,[0,0,5]).attack;
    expect(c.mode).toBe('ring');
    expect(c.splash).toBe(0);
    expect(c.range).toBeCloseTo(162);
    expect(resolveFixture(def,[2,0,5]).attack.range).toBeCloseTo(181.44);
  });
  it('never spends the shared rewind protection on a normal hit',()=>{
    const def=getTower();
    for(const tiers of [[0,0,1],[5,0,2],[0,5,2],[0,0,3],[0,0,4],[0,0,5]] as Tiers[]){
      const a=resolveFixture(def,tiers).attack;
      expect(a.push).toBe(0);
      expect(a.statuses.find(s=>s.kind==='mark')?.duration).toBe(1.8);
    }
    const c=resolveFixture(def,[0,0,5]);
    expect(c.effects.find(e=>e.kind==='portal')?.cap).toBe(1);
    expect(c.abilities[0].cooldown).toBe(24);
    const a=resolveFixture(def,[5,0,0]);
    expect(a.effects.find(e=>e.kind==='echo')).toMatchObject({power:.45,interval:1.7,cap:5});
  });
});
