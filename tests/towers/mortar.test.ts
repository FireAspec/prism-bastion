import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AttackDef, PathIndex, StatusSpec, Tiers, TowerDef, VisualState} from '../../src/contracts';
import {canUpgrade, legalTiers, sellRefund, upgradeCost} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/mortar';

// Isolated v1 fixture resolver; the neighboring combat implementation is pending
// at the frozen base commit. This deliberately tests the public data contract.
function fixtureResolve(def: TowerDef, tiers: Tiers) {
  if (!legalTiers(tiers)) throw new Error('Illegal combination');
  const attack = structuredClone(def.attack);
  const effects = new Map(def.effects.map(effect => [effect.id, structuredClone(effect)]));
  const abilities = new Map(def.abilities.map(ability => [ability.id, structuredClone(ability)]));
  const statuses = new Map<string, StatusSpec>(attack.statuses.map(status => [status.kind, structuredClone(status)]));
  const apply = (key: keyof AttackDef, multiplier: number) => {
    const old = attack[key];
    if (typeof old !== 'number') throw new Error(`Cannot multiply ${key}`);
    (attack as unknown as Record<string, number>)[key] = old * multiplier;
  };
  const add = (key: keyof AttackDef, delta: number) => {
    const old = attack[key];
    if (typeof old !== 'number') throw new Error(`Cannot add to ${key}`);
    (attack as unknown as Record<string, number>)[key] = old + delta;
  };
  for (const path of [0, 1, 2] as PathIndex[]) {
    for (const upgrade of def.paths[path].upgrades.slice(0, tiers[path])) {
      const d = upgrade.delta;
      for (const [key, value] of [
        ['damage', d.damageMul], ['interval', d.intervalMul], ['range', d.rangeMul],
        ['shieldMultiplier', d.shieldMultiplierMul], ['bossMultiplier', d.bossMultiplierMul],
        ['projectileSpeed', d.projectileSpeedMul], ['windup', d.windupMul],
      ] as const) if (value !== undefined) apply(key, value);
      for (const [key, value] of [
        ['pierce', d.pierceAdd], ['count', d.countAdd], ['splash', d.splashAdd],
        ['chains', d.chainsAdd], ['chainRadius', d.chainRadiusAdd],
        ['armorPierce', d.armorPierceAdd], ['executeBelow', d.executeBelowAdd],
        ['push', d.pushAdd], ['arc', d.arcAdd],
      ] as const) if (value !== undefined) add(key, value);
      if (d.detects !== undefined) attack.detects = d.detects;
      for (const status of upgrade.addStatuses ?? []) statuses.set(status.kind, structuredClone(status));
      for (const effect of upgrade.effects ?? []) effects.set(effect.id, structuredClone(effect));
      for (const ability of upgrade.abilities ?? []) abilities.set(ability.id, structuredClone(ability));
    }
  }
  attack.statuses = [...statuses.values()];
  const nonzero = ([0, 1, 2] as PathIndex[]).filter(p => tiers[p] > 0);
  const mainPath = nonzero.sort((a, b) => tiers[b] - tiers[a] || a - b)[0];
  const secondary = nonzero.find(p => p !== mainPath);
  const visual: VisualState = mainPath === undefined ? def.visual : def.paths[mainPath].upgrades[tiers[mainPath] - 1].visual;
  return {attack, effects: [...effects.values()], abilities: [...abilities.values()], visual,
    mainPath, secondaryOverlay: secondary === undefined ? undefined :
      `/art/towers/mortar/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`};
}

const allPaths = [0, 1, 2] as PathIndex[];
const artDirectory = resolve(process.cwd(), 'public/art/towers/mortar');
const expectedCosts = [
  [445, 885, 2205, 5285, 13205],
  [380, 760, 1900, 4560, 11400],
  [400, 800, 2000, 4800, 12000],
];
const expectedNameSets = ['a', 'b', 'c'].flatMap(prefix =>
  Array.from({length: 5}, (_, i) => `${prefix}${i + 1}.svg`));

describe('Небесная мортира: frozen contract', () => {
  it('defines one full tower with the exact independent normal costs and unique upgrade IDs', () => {
    const tower = getTower();
    expect([tower.id, tower.name, tower.category, tower.placement, tower.footprint, tower.cost])
      .toEqual(['mortar', 'Небесная мортира', 'tech', 'land', 26, 800]);
    expect([tower.attack.damage, tower.attack.interval, tower.attack.range, tower.attack.mode])
      .toEqual([50, 2.4, 340, 'mortar']);
    const upgrades = tower.paths.flatMap(path => path.upgrades);
    expect(tower.paths).toHaveLength(3);
    expect(upgrades).toHaveLength(15);
    expect(new Set(upgrades.map(upgrade => upgrade.id)).size).toBe(15);
    expect(new Set(upgrades.map(upgrade => upgrade.name)).size).toBe(15);
    for (const path of allPaths) {
      expect(tower.paths[path].upgrades.map(upgrade => upgrade.cost)).toEqual(expectedCosts[path]);
      expect(tower.paths[path].upgrades.map(upgrade => upgrade.tier)).toEqual([1, 2, 3, 4, 5]);
      expect(tower.paths[path].upgrades.map(upgrade => upgrade.id)).toEqual(
        Array.from({length: 5}, (_, i) => `mortar-${'abc'[path]}${i + 1}`));
      const factor = [1.1001, 0.95, 1][path];
      expect(tower.paths[path].upgrades.map(upgrade => upgradeCost(800, factor, upgrade.tier)))
        .toEqual(expectedCosts[path]);
    }
    for (const upgrade of upgrades) {
      expect(upgrade.cost).toBeGreaterThan(0);
      expect(upgrade.description.length).toBeGreaterThan(35);
      expect(upgrade.replaceAttack).toBeUndefined();
      expect(upgrade.visual.asset.endsWith('.svg')).toBe(true);
    }
  });

  it('returns a fresh deep copy, so purchases cannot mutate shared content', () => {
    const a = getTower();
    const b = getTower();
    a.attack.statuses.push({kind: 'burn', power: 999, duration: 99});
    a.paths[0].upgrades[0].delta.damageMul = 999;
    a.paths[2].upgrades[4].effects![0].radius = 999;
    expect(b.attack.statuses).toEqual([]);
    expect(b.paths[0].upgrades[0].delta.damageMul).toBe(1.12);
    expect(b.paths[2].upgrades[4].effects![0].radius).toBe(320);
  });

  it('resolves every legal triple with finite and safe stats, statuses and effects', () => {
    const tower = getTower();
    let legalCount = 0;
    for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
      const tiers: Tiers = [a, b, c];
      if (!legalTiers(tiers)) continue;
      legalCount++;
      const resolved = fixtureResolve(tower, tiers);
      for (const key of ['damage', 'interval', 'range', 'splash', 'count', 'pierce', 'armorPierce',
        'projectileSpeed', 'projectileRadius', 'windup', 'bossMultiplier', 'shieldMultiplier'] as const) {
        expect(Number.isFinite(resolved.attack[key]), `${key} for ${tiers}`).toBe(true);
      }
      expect(resolved.attack.damage).toBeGreaterThan(0);
      expect(resolved.attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(resolved.attack.splash).toBeGreaterThan(0);
      expect(resolved.attack.count).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(resolved.attack.count)).toBe(true);
      expect(new Set(resolved.attack.statuses.map(s => s.kind)).size).toBe(resolved.attack.statuses.length);
      expect(new Set(resolved.effects.map(e => e.id)).size).toBe(resolved.effects.length);
      expect(new Set(resolved.abilities.map(a => a.id)).size).toBe(resolved.abilities.length);
      expect(resolved.attack.statuses.every(s => s.duration > 0 && s.power > 0)).toBe(true);
      for (const effect of resolved.effects) {
        expect(Number.isFinite(effect.power) && Number.isFinite(effect.radius)).toBe(true);
        expect(effect.kind).toBe('aura');
        expect(effect.stat).toBe('detect');
      }
      if (tiers.filter(n => n > 0).length === 2) {
        expect(resolved.secondaryOverlay).toMatch(/-overlay\.svg$/);
      }
    }
    expect(legalCount).toBe(64);
  });

  it('keeps all six final 5–2–0 permutations distinct, composable and in bounds', () => {
    const t = getTower();
    for (const main of allPaths) for (const secondary of allPaths.filter(p => p !== main)) {
      const tiers: Tiers = [0, 0, 0]; tiers[main] = 5; tiers[secondary] = 2;
      expect(legalTiers(tiers)).toBe(true);
      expect(canUpgrade(tiers, secondary)).toBe(false);
      const resolved = fixtureResolve(t, tiers);
      const mainOnly: Tiers = [0, 0, 0]; mainOnly[main] = 5;
      const primary = fixtureResolve(t, mainOnly);
      expect(resolved.mainPath).toBe(main);
      expect(resolved.visual.asset).toBe(primary.visual.asset);
      expect(resolved.secondaryOverlay).toBe(`/art/towers/mortar/${'abc'[secondary]}2-overlay.svg`);
      expect(resolved.attack.damage).toBeGreaterThan(0);
      if (secondary === 0) expect(resolved.attack.armorPierce).toBe(primary.attack.armorPierce + 3);
      if (secondary === 1) expect(resolved.attack.count).toBe(primary.attack.count + 1);
      if (secondary === 2) {
        expect(resolved.attack.detects).toBe(true);
        expect(resolved.attack.statuses.some(s => s.kind === 'mark')).toBe(true);
      }
      const invested = t.cost + tiers.reduce((total, tier, p) =>
        total + t.paths[p].upgrades.slice(0, tier).reduce((sum, u) => sum + u.cost, 0), 0);
      expect(sellRefund(invested)).toBe(Math.floor(invested * 0.7));
      expect(sellRefund(invested)).toBeLessThan(invested);
    }
  });

  it('makes every T5 a behavior change beyond the T4 version', () => {
    const t = getTower();
    for (const path of allPaths) {
      const t4: Tiers = [0, 0, 0]; t4[path] = 4;
      const t5: Tiers = [0, 0, 0]; t5[path] = 5;
      const four = fixtureResolve(t, t4), five = fixtureResolve(t, t5);
      expect(five.visual.asset).not.toBe(four.visual.asset);
      expect(five.attack.count).toBeGreaterThan(four.attack.count);
      expect(five.attack.splash).toBeGreaterThan(four.attack.splash);
      expect(five.attack.damage * five.attack.count / five.attack.interval)
        .toBeGreaterThan(four.attack.damage * four.attack.count / four.attack.interval * 1.3);
    }
    expect(fixtureResolve(t, [5, 0, 0]).abilities.map(a => a.kind)).toContain('meteor');
    expect(fixtureResolve(t, [0, 5, 0]).abilities.map(a => a.kind)).toContain('overclock');
    expect(fixtureResolve(t, [0, 0, 5]).effects.find(e => e.id === 'mortar-signal-net'))
      .toMatchObject({kind: 'aura', stat: 'detect', radius: 320});
  });

  it('ships valid self-contained assets for all 16 models, 6 overlays and the local gallery', () => {
    const expected = ['base.svg', ...expectedNameSets,
      ...['a', 'b', 'c'].flatMap(p => [1, 2].map(n => `${p}${n}-overlay.svg`))];
    const signatures = new Set<string>();
    for (const asset of expected) {
      const filename = resolve(artDirectory, asset);
      expect(existsSync(filename), asset).toBe(true);
      const svg = readFileSync(filename, 'utf8');
      expect(svg).toContain('viewBox="0 0 128 128"');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toMatch(/<(?:path|rect|ellipse|circle)\b/);
      expect(svg).not.toMatch(/<(?:script|text|foreignObject|image|use)\b/i);
      expect(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''))
        .not.toMatch(/(?:https?:\/\/|javascript:|data:)/i);
      expect(svg).not.toMatch(/(?:href|xlink:href)\s*=/i);
      expect(svg).not.toMatch(/(?:font-family|@import)/i);
      signatures.add(svg);
    }
    expect(signatures.size).toBe(22);
    const preview = readFileSync(resolve(artDirectory, 'preview.html'), 'utf8');
    expect(preview).toContain('lang="ru"');
    for (const asset of expected) expect(preview).toContain(asset);
    expect(preview).not.toMatch(/(?:https?:\/\/|<script)/i);
  });
});
