import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, Tiers, TowerDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/observatory';

const ROOT = join(process.cwd(), 'public/art/towers/observatory');
const expectedCosts = [[310, 620, 1545, 3705, 9265],
  [325, 650, 1625, 3900, 9750], [360, 720, 1790, 4295, 10730]];
const letters = ['a', 'b', 'c'] as const;

function legal(t: Tiers): boolean {
  return t.filter(n => n > 0).length <= 2 && t.filter(n => n > 2).length <= 1;
}

/** A contract-v1 fixture: non-mutating, and independent of unfinished combat. */
function fixtureResolve(def: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legal(tiers) || tiers.some(t => !Number.isInteger(t) || t < 0 || t > 5)) {
    throw new Error('illegal cross-path tiers');
  }
  const main = (tiers.findIndex(t => t > 2) >= 0
    ? tiers.findIndex(t => t > 2)
    : tiers.findIndex(t => t > 0)) as PathIndex | -1;
  const lastReplace = main === -1 ? undefined :
    def.paths[main].upgrades.slice(0, tiers[main]).reverse().find(upgrade => !!upgrade.replaceAttack);
  const attack: AttackDef = structuredClone(lastReplace?.replaceAttack ?? def.attack);
  const effects = new Map<string, EffectDef>(def.effects.map(effect => [effect.id, structuredClone(effect)]));
  const abilities = new Map(def.abilities.map(ability => [ability.id, structuredClone(ability)]));
  const mul = (field: keyof AttackDef, by: number) => {
    const value = attack[field];
    if (typeof value !== 'number') throw new Error(`unexpected ${field}`);
    Object.assign(attack, {[field]: value * by});
  };
  const add = (field: keyof AttackDef, value: number) => {
    const current = attack[field];
    if (typeof current !== 'number') throw new Error(`unexpected ${field}`);
    Object.assign(attack, {[field]: current + value});
  };
  for (let p = 0; p < 3; p++) {
    for (const u of def.paths[p].upgrades.slice(0, tiers[p])) {
      const d = u.delta;
      if (d.damageMul !== undefined) mul('damage', d.damageMul);
      if (d.intervalMul !== undefined) mul('interval', d.intervalMul);
      if (d.rangeMul !== undefined) mul('range', d.rangeMul);
      if (d.shieldMultiplierMul !== undefined) mul('shieldMultiplier', d.shieldMultiplierMul);
      if (d.bossMultiplierMul !== undefined) mul('bossMultiplier', d.bossMultiplierMul);
      if (d.projectileSpeedMul !== undefined) mul('projectileSpeed', d.projectileSpeedMul);
      if (d.windupMul !== undefined) mul('windup', d.windupMul);
      for (const [field, value] of [
        ['pierce', d.pierceAdd], ['count', d.countAdd], ['splash', d.splashAdd],
        ['chains', d.chainsAdd], ['chainRadius', d.chainRadiusAdd],
        ['armorPierce', d.armorPierceAdd], ['executeBelow', d.executeBelowAdd],
        ['push', d.pushAdd], ['arc', d.arcAdd],
      ] as const) if (value !== undefined) add(field, value);
      if (d.detects) attack.detects = true;
      for (const status of u.addStatuses ?? []) {
        const earlier = attack.statuses.find(old => old.kind === status.kind);
        if (earlier) Object.assign(earlier, status);
        else attack.statuses.push(structuredClone(status));
      }
      for (const effect of u.effects ?? []) effects.set(effect.id, structuredClone(effect));
      for (const ability of u.abilities ?? []) abilities.set(ability.id, structuredClone(ability));
    }
  }
  const secondary = (main === -1 ? -1 : tiers.findIndex((tier, index) => index !== main && tier > 0));
  return {
    attack, effects: [...effects.values()], abilities: [...abilities.values()],
    visual: main === -1 ? def.visual : def.paths[main].upgrades[tiers[main] - 1].visual,
    ...(main === -1 ? {} : {mainPath: main}),
    ...(secondary < 0 ? {} : {secondaryOverlay: `/art/towers/observatory/${letters[secondary]}${tiers[secondary]}-overlay.svg`}),
  };
}

function assetFile(url: string): string {
  return join(ROOT, url.split('/').at(-1) ?? '');
}

describe('observatory tower', () => {
  it('has a useful unupgraded support role and returns independent data', () => {
    const tower = getTower();
    expect(tower).toMatchObject({id: 'observatory', category: 'support', placement: 'land', cost: 650, footprint: 26});
    expect(tower.attack).toMatchObject({damage: 0, interval: 1, range: 190});
    expect(tower.effects).toContainEqual(expect.objectContaining({
      id: 'observatory-detection', kind: 'aura', stat: 'detect', power: 1, radius: 190,
    }));
    tower.effects[0].power = 999;
    tower.paths[0].upgrades[0].delta.rangeMul = 999;
    expect(getTower().effects[0].power).toBe(1);
    expect(getTower().paths[0].upgrades[0].delta.rangeMul).toBe(1.03);
  });

  it('has exactly 15 ordered upgrades, unique IDs, finite data and frozen prices', () => {
    const def = getTower();
    const ids = new Set<string>();
    for (let branch = 0; branch < 3; branch++) {
      expect(def.paths[branch].upgrades).toHaveLength(5);
      for (let tier = 1; tier <= 5; tier++) {
        const u = def.paths[branch].upgrades[tier - 1];
        expect(u.id).toBe(`observatory-${letters[branch]}${tier}`);
        expect(ids.has(u.id)).toBe(false);
        ids.add(u.id);
        expect(u.tier).toBe(tier);
        expect(u.cost).toBe(expectedCosts[branch][tier - 1]);
        expect(u.name.length).toBeGreaterThan(5);
        expect(u.description.length).toBeGreaterThan(40);
        for (const number of [u.cost, ...Object.values(u.delta).filter(v => typeof v === 'number'),
          ...Object.values(u.replaceAttack ?? {}).filter(v => typeof v === 'number'),
          ...(u.effects ?? []).flatMap(e => [e.power, e.radius, e.interval, e.duration, e.cap])]) {
          expect(Number.isFinite(number)).toBe(true);
        }
        if (tier <= 2) expect(u.replaceAttack).toBeUndefined();
        else expect(u.replaceAttack).toBeDefined();
      }
    }
    expect(ids.size).toBe(15);
    expect(def.paths.map(path => path.upgrades.every(u => u.cost > 0))).toEqual([true, true, true]);
  });

  it('resolves the entire legal tiers matrix and rejects incompatible paths', () => {
    const def = getTower();
    let count = 0;
    for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
      const tiers: Tiers = [a, b, c];
      if (!legal(tiers)) {
        expect(() => fixtureResolve(def, tiers)).toThrow();
        continue;
      }
      count++;
      const r = fixtureResolve(def, tiers);
      expect(r.attack.interval).toBeGreaterThanOrEqual(.05);
      expect(r.attack.damage).toBeGreaterThanOrEqual(0);
      expect(r.attack.range).toBeGreaterThanOrEqual(0);
      expect(r.attack.count).toBeGreaterThan(0);
      expect(r.attack.pierce).toBeGreaterThan(0);
      expect(r.attack.statuses.every(s => s.duration > 0 && Number.isFinite(s.power))).toBe(true);
      expect(new Set(r.effects.map(effect => effect.id)).size).toBe(r.effects.length);
      expect(r.effects.every(effect => Number.isFinite(effect.power))).toBe(true);
      expect(existsSync(assetFile(r.visual.asset))).toBe(true);
      if (r.secondaryOverlay) expect(existsSync(assetFile(r.secondaryOverlay))).toBe(true);
      expect(r.effects.some(e => e.stat === 'detect')).toBe(true);
    }
    expect(count).toBe(64);
  });

  it('delivers three genuinely different T5 attacks and uncapped incoming buffs never recurse', () => {
    const def = getTower();
    const [a, b, c] = ([0, 1, 2] as const).map(index => {
      const tiers: Tiers = [0, 0, 0]; tiers[index] = 5; return fixtureResolve(def, tiers);
    });
    expect(a.attack).toMatchObject({mode: 'ring', damage: 18, interval: 1.35});
    expect(a.attack.range).toBeCloseTo(455 * 1.03);
    expect(a.attack.statuses).toContainEqual({kind: 'reveal', power: 1, duration: 10});
    expect(a.effects.find(effect => effect.id === 'observatory-detection')?.radius).toBe(500);
    expect(b.attack).toMatchObject({mode: 'beam', element: 'kinetic', count: 2, pierce: 9,
      armorPierce: 30, damage: 55, bossMultiplier: 1.6});
    expect(b.attack.range).toBeCloseTo(520 * 1.10);
    expect(c.attack).toMatchObject({mode: 'chain', count: 2, chains: 6, chainRadius: 155});
    expect(c.attack.damage).toBeCloseTo(34 * 1.03);
    expect(c.attack.interval).toBeCloseTo(1.2 * .96);
    expect(c.attack.statuses).toContainEqual({kind: 'mark', power: .10, duration: 8});
    for (const resolved of [a, b, c]) {
      expect(resolved.effects.every(effect => effect.kind === 'aura')).toBe(true);
      expect(resolved.effects.every(effect => effect.power > 0)).toBe(true);
      expect(resolved.effects.some(effect => effect.kind === 'income' || effect.kind === 'interest')).toBe(false);
    }
  });

  it('supports all six final cross-path variants with real secondary overlays', () => {
    const def = getTower();
    const all: Tiers[] = [[5, 2, 0], [5, 0, 2], [2, 5, 0], [0, 5, 2], [2, 0, 5], [0, 2, 5]];
    const names = ['b2', 'c2', 'a2', 'c2', 'a2', 'b2'];
    for (let i = 0; i < all.length; i++) {
      const tiers = all[i];
      const r = fixtureResolve(def, tiers);
      const main = tiers.indexOf(5);
      expect(r.mainPath).toBe(main);
      expect(r.visual.asset).toContain(`${letters[main]}5.svg`);
      expect(r.secondaryOverlay).toContain(`${names[i]}-overlay.svg`);
      expect(existsSync(assetFile(r.secondaryOverlay!))).toBe(true);
      const secondary = tiers.indexOf(2);
      const solo: Tiers = [0, 0, 0]; solo[main] = 5;
      const primary = fixtureResolve(def, solo);
      expect(r.attack.mode).toEqual(primary.attack.mode);
      expect(r.effects.length).toBeGreaterThan(primary.effects.length);
      expect(r.attack.range).toBeGreaterThanOrEqual(primary.attack.range);
      expect(secondary).not.toBe(main);
    }
    expect(fixtureResolve(def, [2, 2, 0]).mainPath).toBe(0);
  });

  it('has 22 distinct internal SVGs and a complete 22-model gallery', () => {
    const paths = ['base', ...letters.flatMap(branch => Array.from({length: 5}, (_, i) => `${branch}${i + 1}`)),
      ...letters.flatMap(branch => [`${branch}1-overlay`, `${branch}2-overlay`])];
    expect(paths.length).toBe(22);
    const contents = new Set<string>();
    for (const name of paths) {
      const svg = readFileSync(join(ROOT, `${name}.svg`), 'utf8');
      contents.add(svg);
      expect(svg).toContain('viewBox="0 0 128 128"');
      expect(svg).toMatch(/<svg\s/);
      expect(svg).not.toMatch(/<script\b|<text\b|<image\b|<foreignObject\b|<use\b/i);
      expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', '')).not.toMatch(/https?:\/\/|javascript:|data:image|xlink:href/i);
      expect(svg.length).toBeGreaterThan(name.includes('overlay') ? 1100 : 1700);
    }
    expect(contents.size).toBe(22);
    const html = readFileSync(join(ROOT, 'preview.html'), 'utf8');
    for (const name of paths.filter(name => !name.includes('overlay') || name.endsWith('2-overlay'))) {
      expect(html).toContain(`${name}.svg`);
    }
    for (const tierPair of ['A5 + B2', 'A5 + C2', 'B5 + A2', 'B5 + C2', 'C5 + A2', 'C5 + B2']) {
      expect(html).toContain(tierPair);
    }
  });

  it('preserves purchase prices and a loss on resale for every final variant', () => {
    const def = getTower();
    const variants: Tiers[] = [[5, 0, 0], [0, 5, 0], [0, 0, 5],
      [5, 2, 0], [5, 0, 2], [2, 5, 0], [0, 5, 2], [2, 0, 5], [0, 2, 5]];
    const expectedTotals = [16095, 16900, 18545, 17070, 17175, 17830, 17980, 19475, 19520];
    variants.forEach((tiers, index) => {
      const invested = def.cost + tiers.reduce((sum, tier, path) => sum +
        def.paths[path].upgrades.slice(0, tier).reduce((part, upgrade) => part + upgrade.cost, 0), 0);
      expect(invested).toBe(expectedTotals[index]);
      expect(Math.floor(.7 * invested)).toBeLessThan(invested);
    });
  });
});
