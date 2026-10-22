import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {getTower} from '../../src/content/towers/saw';
import {canUpgrade, legalTiers, sellRefund, upgradeCost} from '../../src/contracts/rules';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, StatDelta, StatusSpec, Tiers, TowerDef} from '../../src/contracts';

const data = getTower();
const root = fileURLToPath(new URL('../../public/art/towers/saw/', import.meta.url));
const costs = [[345, 685, 1710, 4095, 10240], [325, 650, 1625, 3900, 9750], [310, 620, 1545, 3705, 9265]];
const factors = [1.05, 1, 0.95];

// This fixture deliberately reads the public DSL only, never imports a combat or
// engine implementation owned by another module. It mirrors the frozen rules.
function applyDelta(target: AttackDef, delta: StatDelta): void {
  const mul: [keyof StatDelta, keyof AttackDef][] = [
    ['damageMul', 'damage'], ['intervalMul', 'interval'], ['rangeMul', 'range'],
    ['shieldMultiplierMul', 'shieldMultiplier'], ['bossMultiplierMul', 'bossMultiplier'],
    ['projectileSpeedMul', 'projectileSpeed'], ['windupMul', 'windup'],
  ];
  for (const [source, sink] of mul) {
    const factor = delta[source];
    if (typeof factor === 'number') (target as unknown as Record<string,number>)[sink] *= factor;
  }
  const add: [keyof StatDelta, keyof AttackDef][] = [
    ['pierceAdd', 'pierce'], ['countAdd', 'count'], ['splashAdd', 'splash'],
    ['chainsAdd', 'chains'], ['chainRadiusAdd', 'chainRadius'],
    ['armorPierceAdd', 'armorPierce'], ['executeBelowAdd', 'executeBelow'],
    ['pushAdd', 'push'], ['arcAdd', 'arc'],
  ];
  for (const [source, sink] of add) {
    const amount = delta[source];
    if (typeof amount === 'number') (target as unknown as Record<string,number>)[sink] += amount;
  }
  if (delta.detects !== undefined) target.detects = delta.detects;
}

function resolveFixture(tower: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legalTiers(tiers)) throw new Error(`Illegal tiers: ${tiers}`);
  const main = tiers.findIndex(n => n > 2) >= 0 ? tiers.findIndex(n => n > 2)
    : tiers.findIndex(n => n > 0);
  const mainPath = main >= 0 ? main as PathIndex : undefined;
  const attack = structuredClone(tower.attack);
  const effects = new Map(tower.effects.map(e => [e.id, {...e}]));
  const abilities = new Map(tower.abilities.map(a => [a.id, {...a}]));
  const replacement = mainPath === undefined ? undefined : tower.paths[mainPath].upgrades
    .slice(0, tiers[mainPath]).filter(u => u.replaceAttack).at(-1)?.replaceAttack;
  if (replacement) Object.assign(attack, structuredClone(replacement));
  for (const path of [0,1,2] as PathIndex[]) {
    for (const upgrade of tower.paths[path].upgrades.slice(0,tiers[path])) {
      applyDelta(attack, upgrade.delta);
      for (const status of upgrade.addStatuses ?? []) {
        const index = attack.statuses.findIndex(s => s.kind === status.kind);
        if (index < 0) attack.statuses.push({...status});
        else attack.statuses[index] = {
          ...attack.statuses[index], power: Math.max(attack.statuses[index].power, status.power),
          duration: Math.max(attack.statuses[index].duration, status.duration),
          maxStacks: Math.max(attack.statuses[index].maxStacks ?? 1,status.maxStacks ?? 1),
        };
      }
      for (const item of upgrade.effects ?? []) effects.set(item.id,{...item});
      for (const item of upgrade.abilities ?? []) abilities.set(item.id,{...item});
    }
  }
  const secondary = tiers.findIndex((n,i) => i !== main && n > 0);
  const secondaryOverlay = secondary < 0 ? undefined
    : `/art/towers/saw/${'abc'[secondary]}${Math.min(tiers[secondary],2)}-overlay.svg`;
  const visual = mainPath === undefined ? {...tower.visual} : {...tower.paths[mainPath].upgrades[tiers[mainPath]-1].visual};
  return {attack, effects:[...effects.values()], abilities:[...abilities.values()],
    visual, secondaryOverlay, mainPath};
}

function getNumericLeaves(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(getNumericLeaves);
}

describe('Saw tower content and prices', () => {
  it('has correct base stats, intended placement and three independent paths', () => {
    expect(data).toMatchObject({id:'saw',cost:650,category:'weapon',placement:'land',footprint:26,
      attack:{damage:16,interval:0.65,range:115}});
    expect(data.paths).toHaveLength(3);
    expect(data.paths.map(p => p.upgrades.length)).toEqual([5,5,5]);
  });
  it('uses fifteen stable unique IDs, sequential tiers and exact costs', () => {
    const ids = data.paths.flatMap(p=>p.upgrades.map(u=>u.id));
    expect(new Set(ids).size).toBe(15);
    data.paths.forEach((path,i)=>path.upgrades.forEach((u,j)=>{
      expect(u.tier).toBe(j+1);
      expect(u.id).toBe(`saw-${'abc'[i]}${j+1}`);
      expect(u.cost).toBe(costs[i][j]);
      expect(u.cost).toBe(upgradeCost(650,factors[i],u.tier));
      expect(u.name.length).toBeGreaterThan(5);
      expect(u.description.length).toBeGreaterThan(35);
      expect(u.delta).toBeDefined();
      if (j < 2) expect(u.replaceAttack).toBeUndefined();
      else expect(u.replaceAttack).toBeDefined();
    }));
  });
  it('returns a fresh deep copy on every call', () => {
    const first = getTower(), second = getTower();
    first.paths[0].upgrades[4].replaceAttack!.damage = -10;
    first.attack.statuses.push({kind:'slow',power:5,duration:1});
    expect(second.paths[0].upgrades[4].replaceAttack?.damage).toBe(38);
    expect(second.attack.statuses).toEqual([]);
    expect(data.paths[0].upgrades[4].replaceAttack?.damage).toBe(38);
  });
  it('contains only finite numeric data, bounded statuses, effects and abilities', () => {
    expect(getNumericLeaves(data).every(Number.isFinite)).toBe(true);
    for (const path of data.paths) for (const upgrade of path.upgrades) {
      expect(upgrade.cost).toBeGreaterThan(0);
      const atk = upgrade.replaceAttack;
      if (atk) {
        expect(atk.damage).toBeGreaterThan(0);
        expect(atk.interval).toBeGreaterThanOrEqual(0.05);
        expect(atk.count).toBeGreaterThan(0);
        expect(atk.range).toBeGreaterThan(0);
      }
      for (const status of [...(atk?.statuses ?? []), ...(upgrade.addStatuses ?? [])] as StatusSpec[]) {
        expect(status.power).toBeGreaterThan(0);
        expect(status.duration).toBeGreaterThan(0);
        expect(status.maxStacks ?? 1).toBeLessThanOrEqual(3);
      }
      for (const effect of upgrade.effects ?? [] as EffectDef[]) {
        expect(effect.power).toBeGreaterThan(0);
        expect(effect.cap).toBeGreaterThan(0);
        expect(effect.interval).toBeGreaterThan(0);
      }
      for (const ability of upgrade.abilities ?? []) {
        expect(ability.cooldown).toBeGreaterThan(0);
        expect(ability.power).toBeGreaterThan(0);
      }
    }
    expect(data.effects).toEqual([]);
  });
});

describe('Every legal path combination', () => {
  const legal:Tiers[] = [];
  for (let a=0;a<=5;a++)for (let b=0;b<=5;b++)for (let c=0;c<=5;c++) {
    const tiers:Tiers = [a,b,c]; if (legalTiers(tiers)) legal.push(tiers);
  }
  it('resolves the entire legal matrix without losing or corrupting stats', () => {
    expect(legal).toHaveLength(64);
    for (const tiers of legal) {
      const before = JSON.stringify(data);
      const result = resolveFixture(data,tiers);
      expect(result.attack.interval).toBeGreaterThanOrEqual(.05);
      expect(result.attack.damage).toBeGreaterThan(0);
      expect(result.attack.range).toBeGreaterThan(0);
      expect(result.attack.count).toBeGreaterThanOrEqual(1);
      expect(result.attack.pierce).toBeGreaterThanOrEqual(1);
      expect(getNumericLeaves(result).every(Number.isFinite)).toBe(true);
      expect(new Set(result.effects.map(e=>e.id)).size).toBe(result.effects.length);
      expect(new Set(result.abilities.map(e=>e.id)).size).toBe(result.abilities.length);
      expect(existsSync(root + result.visual.asset.split('/').at(-1))).toBe(true);
      if (result.secondaryOverlay) expect(existsSync(root + result.secondaryOverlay.split('/').at(-1))).toBe(true);
      expect(JSON.stringify(data)).toBe(before);
      for (const path of [0,1,2] as PathIndex[]) {
        if (!canUpgrade(tiers,path)) continue;
        const next:Tiers = [...tiers]; next[path]++;
        expect(legalTiers(next)).toBe(true);
        resolveFixture(data,next);
      }
    }
  });
  it('keeps the selected specialization in each of six 5-2-0 final variants', () => {
    const finals:Tiers[] = [[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
    const overlays = ['b2-overlay.svg','c2-overlay.svg','a2-overlay.svg','c2-overlay.svg','a2-overlay.svg','b2-overlay.svg'];
    finals.forEach((tiers,i)=>{
      const result = resolveFixture(data,tiers);
      const path = tiers.indexOf(5);
      expect(result.mainPath).toBe(path);
      expect(result.visual.asset).toContain(`${'abc'[path]}5.svg`);
      expect(result.secondaryOverlay).toContain(overlays[i]);
      expect(result.attack.mode).toBe(['ring','cone','shot'][path]);
      expect(sellRefund(data.cost+tiers.reduce((sum,level,p)=> sum +
        data.paths[p].upgrades.slice(0,level).reduce((acc,u)=>acc+u.cost,0),0)))
        .toBeLessThan(data.cost+tiers.reduce((sum,level,p)=> sum +
          data.paths[p].upgrades.slice(0,level).reduce((acc,u)=>acc+u.cost,0),0));
    });
  });
  it('grants useful and different cross-effects before the third tier', () => {
    const a = resolveFixture(data,[2,0,0]).attack;
    const b = resolveFixture(data,[0,2,0]).attack;
    const c = resolveFixture(data,[0,0,2]).attack;
    expect(a.count).toBe(2);
    expect(a.interval).toBeCloseTo(0.65*.9);
    expect(b.armorPierce).toBe(4);
    expect(b.damage).toBeCloseTo(16*1.12);
    expect(b.statuses.some(s=>s.kind==='shred')).toBe(true);
    expect(c.range).toBeCloseTo(115*1.2);
    expect(c.pierce).toBe(2);
    expect(c.push).toBe(5);
  });
  it('has substantive T5 mechanics beyond T4 in all three paths', () => {
    for (let p=0;p<3;p++) {
      const t4:Tiers = [0,0,0], t5:Tiers=[0,0,0];
      t4[p] = 4; t5[p] = 5;
      const prev = resolveFixture(data,t4), final = resolveFixture(data,t5);
      expect(final.attack.damage/final.attack.interval).toBeGreaterThan(prev.attack.damage/prev.attack.interval*1.13);
      expect(final.attack.count).toBeGreaterThan(prev.attack.count);
      expect(final.visual.asset).not.toBe(prev.visual.asset);
      if (p===0) expect(final.effects.some(e=>e.kind==='trap')).toBe(true);
      if (p===1) expect(final.abilities.some(a=>a.kind==='nova')).toBe(true);
      if (p===2) expect(final.effects.find(e=>e.kind==='echo')?.power).toBe(.6);
    }
  });
});

describe('Vector graphics handoff',()=>{
  it('contains sixteen complete SVGs, six separate overlays and a standalone preview',()=>{
    const names = ['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(n=>`${p}${n}`))];
    const overlays = ['a','b','c'].flatMap(p=>[1,2].map(n=>`${p}${n}-overlay`));
    for (const name of [...names,...overlays]) {
      const content=readFileSync(`${root}${name}.svg`,'utf8');
      expect(content).toContain('viewBox="0 0 128 128"');
      expect(content).toContain('</svg>');
      expect(content).toMatch(/<(path|polygon|rect|circle|ellipse)\b/);
      expect(content).not.toMatch(/<script\b|<text\b|<image\b|<foreignObject\b|href\s*=|url\(['"]?https?:/i);
      expect(content.length).toBeGreaterThan(name.endsWith('overlay') ? 1000 : 1700);
    }
    expect(new Set(names.map(n=>readFileSync(`${root}${n}.svg`,'utf8'))).size).toBe(16);
    const preview=readFileSync(`${root}preview.html`,'utf8');
    for (const name of names) expect(preview).toContain(`${name}.svg`);
    for (const name of ['a2-overlay','b2-overlay','c2-overlay']) expect(preview).toContain(`${name}.svg`);
    expect(preview).toContain('A5 / B2');
    expect(preview).toContain('C5 / B2');
  });
});
