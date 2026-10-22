import {describe, expect, it} from 'vitest';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AttackDef, EffectDef, ResolvedTower, StatDelta, Tiers, PathIndex, TowerDef} from '../../src/contracts';
import {legalTiers, canUpgrade, sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/needle';

const artRoot = resolve(process.cwd(), 'public/art/towers/needle');
const costs = [125, 250, 625, 1500, 3750];
const paths = ['a', 'b', 'c'] as const;

/** Standalone frozen-contract fixture; the combat module is owned separately. */
function resolveNeedle(tower: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legalTiers(tiers)) throw new RangeError('Illegal tower tiers');
  const active = ([0, 1, 2] as PathIndex[]).filter(p => tiers[p] > 0);
  const main = active.find(p => tiers[p] > 2) ?? active[0];
  let attack: AttackDef = structuredClone(tower.attack);
  if (main !== undefined) {
    const replacements = tower.paths[main].upgrades.slice(0, tiers[main])
      .filter(up => up.replaceAttack);
    if (replacements.length) attack = structuredClone(replacements.at(-1)!.replaceAttack!);
  }
  const effects = new Map<string, EffectDef>(tower.effects.map(effect => [effect.id, effect]));
  for (const p of [0, 1, 2] as PathIndex[]) {
    for (const upgrade of tower.paths[p].upgrades.slice(0, tiers[p])) {
      const delta = upgrade.delta;
      for (const [key, factor] of [
        ['damage', delta.damageMul], ['interval', delta.intervalMul],
        ['range', delta.rangeMul], ['shieldMultiplier', delta.shieldMultiplierMul],
        ['bossMultiplier', delta.bossMultiplierMul],
        ['projectileSpeed', delta.projectileSpeedMul],
        ['windup', delta.windupMul],
      ] as const) if (factor !== undefined) attack[key] *= factor;
      for (const [key, add] of [
        ['pierce', delta.pierceAdd], ['count', delta.countAdd],
        ['splash', delta.splashAdd], ['chains', delta.chainsAdd],
        ['chainRadius', delta.chainRadiusAdd], ['armorPierce', delta.armorPierceAdd],
        ['executeBelow', delta.executeBelowAdd], ['push', delta.pushAdd], ['arc', delta.arcAdd],
      ] as const) if (add !== undefined) attack[key] += add;
      if (delta.detects !== undefined) attack.detects = delta.detects;
      for (const status of upgrade.addStatuses ?? []) {
        const previous = attack.statuses.find(candidate => candidate.kind === status.kind);
        if (previous) Object.assign(previous, status);
        else attack.statuses.push({...status});
      }
      for (const effect of upgrade.effects ?? []) effects.set(effect.id, effect);
    }
  }
  const secondary = active.find(p => p !== main);
  const mainUp = main === undefined ? undefined : tower.paths[main].upgrades[tiers[main] - 1];
  return {
    attack, effects: [...effects.values()], abilities: [],
    visual: mainUp?.visual ?? tower.visual,
    mainPath: main,
    secondaryOverlay: secondary === undefined ? undefined :
      `/art/towers/needle/${paths[secondary]}${tiers[secondary]}-overlay.svg`,
  };
}

function readAsset(name: string) {
  return readFileSync(resolve(artRoot, name), 'utf8');
}

function baseDps(a: AttackDef) {
  return a.damage * a.count / a.interval;
}

describe('needle content contract', () => {
  it('has the exact base characteristics and three complete paths', () => {
    const def = getTower();
    expect([def.id, def.name, def.category, def.placement, def.cost, def.footprint])
      .toEqual(['needle', 'Игломёт', 'weapon', 'land', 250, 26]);
    expect([def.attack.mode, def.attack.damage, def.attack.interval, def.attack.range])
      .toEqual(['shot', 8, 0.55, 160]);
    expect(def.paths).toHaveLength(3);
    for (const path of def.paths) expect(path.upgrades).toHaveLength(5);
  });

  it('uses 15 stable unique IDs, 15 exact prices and useful, finite changes', () => {
    const def = getTower();
    const ids = new Set<string>();
    for (const [p, path] of def.paths.entries()) for (const [index, upgrade] of path.upgrades.entries()) {
      const tier = index + 1;
      expect(upgrade.id).toBe(`needle-${paths[p]}${tier}`);
      expect(ids.has(upgrade.id)).toBe(false);
      ids.add(upgrade.id);
      expect(upgrade.tier).toBe(tier);
      expect(upgrade.cost).toBe(costs[index]);
      expect(upgrade.name.length).toBeGreaterThan(5);
      expect(upgrade.description.length).toBeGreaterThan(25);
      expect(upgrade.delta).not.toEqual({});
      for (const value of Object.values(upgrade.delta as StatDelta)) {
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      }
      for (const effect of upgrade.effects ?? []) {
        for (const value of [effect.power, effect.duration, effect.interval, effect.radius, effect.cap])
          expect(Number.isFinite(value)).toBe(true);
        expect(effect.kind).toBe('focus');
        expect(effect.cap).toBeLessThanOrEqual(1);
      }
      for (const status of upgrade.addStatuses ?? []) {
        expect(status.kind).toBe('mark');
        expect(status.duration).toBeGreaterThan(0);
      }
    }
    expect(ids.size).toBe(15);
  });

  it('returns independent copies, including nested statuses and effect definitions', () => {
    const original = getTower();
    const mutable = getTower();
    mutable.attack.damage = 999;
    mutable.paths[0].upgrades[3].effects![0].power = 999;
    mutable.paths[2].upgrades[3].addStatuses![0].duration = 999;
    mutable.paths[1].upgrades[4].replaceAttack!.damage = 999;
    expect(getTower()).toEqual(original);
  });
});

describe('fixture resolver for the full legal matrix', () => {
  it('produces finite valid combat data for every legal combination', () => {
    const def = getTower();
    let count = 0;
    for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
      const t: Tiers = [a, b, c];
      if (!legalTiers(t)) {
        expect(() => resolveNeedle(def, t)).toThrow(RangeError);
        continue;
      }
      count++;
      const result = resolveNeedle(def, t);
      for (const value of Object.values(result.attack)) {
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      }
      expect(result.attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(result.attack.count).toBeGreaterThanOrEqual(1);
      expect(result.attack.pierce).toBeGreaterThanOrEqual(1);
      expect(result.attack.range).toBeGreaterThanOrEqual(160);
      expect(result.effects.map(e => e.id).length).toBe(new Set(result.effects.map(e => e.id)).size);
      expect(existsSync(resolve(artRoot, result.visual.asset.split('/').at(-1)!))).toBe(true);
      if (result.secondaryOverlay) {
        expect(existsSync(resolve(artRoot, result.secondaryOverlay.split('/').at(-1)!))).toBe(true);
      }
      for (const p of [0, 1, 2] as PathIndex[]) {
        if (canUpgrade(t, p)) {
          const next: Tiers = [...t]; next[p]++;
          const nextResult = resolveNeedle(def, next);
          expect(nextResult.visual.asset).toMatch(/^\/art\/towers\/needle\/[abc][1-5]\.svg$/);
        }
      }
    }
    expect(count).toBeGreaterThan(50);
  });

  it('keeps the intended shape-changing T5 attacks and full primary bonuses', () => {
    const tower = getTower();
    const a = resolveNeedle(tower, [5, 0, 0]);
    expect(a.attack.mode).toBe('shot');
    expect(a.attack.count).toBe(5);
    expect(a.attack.interval).toBeCloseTo(0.16632, 5);
    expect(a.effects).toEqual([expect.objectContaining({kind: 'focus', power: 0.2, cap: 1})]);
    const b = resolveNeedle(tower, [0, 5, 0]);
    expect(b.attack.mode).toBe('beam');
    expect(b.attack.damage).toBeCloseTo(64.8);
    expect(b.attack.pierce).toBe(10);
    expect(b.attack.armorPierce).toBe(5);
    expect(b.attack.shieldMultiplier).toBeCloseTo(1.5);
    const c = resolveNeedle(tower, [0, 0, 5]);
    expect(c.attack.mode).toBe('chain');
    expect(c.attack.count).toBe(3);
    expect(c.attack.chains).toBe(8);
    expect(c.attack.chainRadius).toBe(135);
    expect(c.attack.damage).toBeCloseTo(34.65);
    expect(c.attack.statuses).toEqual([{kind: 'mark', power: 0.1, duration: 2.5, maxStacks: 1}]);
    expect(baseDps(a.attack)).toBeCloseTo(240.5, 0);
    expect(baseDps(b.attack)).toBeCloseTo(129.6, 1);
    expect(baseDps(c.attack)).toBeCloseTo(280, 1);
  });

  it('preserves all six final 5–2–0 combinations and their secondary overlay', () => {
    const def = getTower();
    let variants = 0;
    for (const primary of [0, 1, 2] as PathIndex[])
      for (const secondary of [0, 1, 2] as PathIndex[]) {
        if (primary === secondary) continue;
        const tiers: Tiers = [0, 0, 0];
        tiers[primary] = 5; tiers[secondary] = 2;
        expect(legalTiers(tiers)).toBe(true);
        const mainOnly: Tiers = [0, 0, 0]; mainOnly[primary] = 5;
        const res = resolveNeedle(def, tiers);
        const plain = resolveNeedle(def, mainOnly);
        expect(res.visual.asset).toBe(plain.visual.asset);
        expect(res.mainPath).toBe(primary);
        expect(res.secondaryOverlay).toBe(`/art/towers/needle/${paths[secondary]}2-overlay.svg`);
        expect(res.attack.damage).toBeGreaterThanOrEqual(plain.attack.damage);
        expect(baseDps(res.attack)).toBeGreaterThanOrEqual(baseDps(plain.attack));
        expect(res.attack.mode).toBe(plain.attack.mode);
        expect(res.attack.range).toBeGreaterThanOrEqual(plain.attack.range);
        const invested = 250 + costs.reduce((a, b) => a + b, 0) + costs[0] + costs[1];
        expect(invested).toBe(6875);
        expect(sellRefund(invested)).toBe(4812);
        variants++;
      }
    expect(variants).toBe(6);
  });

  it('adds genuine T1/T2 cross benefits even before specializing', () => {
    const def = getTower();
    const start = resolveNeedle(def, [0, 0, 0]);
    const a = resolveNeedle(def, [2, 0, 0]);
    const b = resolveNeedle(def, [0, 2, 0]);
    const c = resolveNeedle(def, [0, 0, 2]);
    expect(a.attack.interval).toBeLessThan(start.attack.interval);
    expect(a.attack.count).toBe(2);
    expect(b.attack.pierce).toBe(2);
    expect(b.attack.armorPierce).toBe(2);
    expect(c.attack.range).toBeGreaterThan(start.attack.range);
    expect(c.attack.bossMultiplier).toBeGreaterThan(1);
    expect([a.attack.count, b.attack.pierce]).toEqual([2, 2]);
    expect(c.attack.range).toBeCloseTo(188.8);
  });
});

describe('art and offline preview', () => {
  it('ships sixteen distinct full views and six meaningful transparent overlays', () => {
    const names = ['base', ...paths.flatMap(p => [1, 2, 3, 4, 5].map(n => `${p}${n}`))];
    const overlays = paths.flatMap(p => [1, 2].map(n => `${p}${n}-overlay`));
    const mainFiles = names.map(n => readAsset(`${n}.svg`));
    const overlayFiles = overlays.map(n => readAsset(`${n}.svg`));
    expect(new Set(mainFiles).size).toBe(16);
    expect(new Set(overlayFiles).size).toBe(6);
    for (const xml of [...mainFiles, ...overlayFiles]) {
      expect(xml).toMatch(/<svg[^>]*width="128" height="128" viewBox="0 0 128 128"/);
      expect(xml).toMatch(/<path|<circle|<polygon|<ellipse/);
      expect(xml).not.toMatch(/<script|<foreignObject|<image\b|<text\b|\shref\s*=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
      expect(xml.length).toBeGreaterThan(1400);
    }
    for (const p of paths) {
      expect(readAsset(`${p}5.svg`).length).toBeGreaterThan(readAsset(`${p}1.svg`).length);
    }
  });

  it('shows exactly the sixteen main assets and all six 5–2–0 composites', () => {
    const html = readAsset('preview.html');
    expect(html).toContain('lang="ru"');
    for (const image of ['base', ...paths.flatMap(p => [1, 2, 3, 4, 5].map(n => `${p}${n}`))]) {
      expect(html).toContain(`src="./${image}.svg"`);
    }
    for (const p of paths) for (const q of paths) if (p !== q) {
      expect(html).toContain(`${p.toUpperCase()} + ${q.toUpperCase()}`);
      expect(html).toContain(`src="./${q}2-overlay.svg"`);
    }
    expect(html).not.toMatch(/<script|https?:\/\//i);
  });
});
