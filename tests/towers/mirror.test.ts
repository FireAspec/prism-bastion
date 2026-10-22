import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {AttackDef, EffectDef, ResolvedTower, StatDelta, Tiers, TowerDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/mirror';

const PUBLIC = join(process.cwd(), 'public');
const BRANCHES = ['a', 'b', 'c'] as const;
const COSTS = [[525, 1045, 2615, 6270, 15675],
  [475, 950, 2375, 5700, 14250], [455, 905, 2260, 5415, 13540]];

function legal(tiers: Tiers): boolean {
  const active = tiers.filter(tier => tier > 0);
  return active.length <= 2 && active.filter(tier => tier > 2).length <= 1;
}

// Content-only fixture. The actual combat module is supplied by another workstream.
// This independently exercises the v1 documented ordering and cross-path visuals.
function fixtureResolve(def: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legal(tiers) || tiers.some(tier => tier < 0 || tier > 5 || !Number.isInteger(tier))) {
    throw new RangeError(`Illegal mirror build: ${tiers}`);
  }
  const mainPath = ([0, 1, 2] as const)
    .filter(path => tiers[path] > 0)
    .sort((x, y) => tiers[y] - tiers[x] || x - y)[0];
  let attack = structuredClone(def.attack);
  if (mainPath !== undefined) {
    for (let i = 0; i < tiers[mainPath]; i++) {
      const replacement = def.paths[mainPath].upgrades[i]?.replaceAttack;
      if (replacement) attack = structuredClone(replacement);
    }
  }
  const effects = new Map<string, EffectDef>(def.effects.map(effect => [effect.id, effect]));
  const abilities = new Map(def.abilities.map(ability => [ability.id, ability]));
  for (const path of [0, 1, 2] as const) {
    for (let i = 0; i < tiers[path]; i++) {
      const upgrade = def.paths[path].upgrades[i];
      const delta: StatDelta = upgrade.delta;
      for (const [key, factor] of [
        ['damage', delta.damageMul], ['interval', delta.intervalMul],
        ['range', delta.rangeMul], ['shieldMultiplier', delta.shieldMultiplierMul],
        ['bossMultiplier', delta.bossMultiplierMul], ['projectileSpeed', delta.projectileSpeedMul],
        ['windup', delta.windupMul],
      ] as const) if (factor !== undefined) attack[key] *= factor;
      for (const [key, addition] of [
        ['pierce', delta.pierceAdd], ['count', delta.countAdd],
        ['splash', delta.splashAdd], ['chains', delta.chainsAdd],
        ['chainRadius', delta.chainRadiusAdd], ['armorPierce', delta.armorPierceAdd],
        ['executeBelow', delta.executeBelowAdd], ['push', delta.pushAdd], ['arc', delta.arcAdd],
      ] as const) if (addition !== undefined) attack[key] += addition;
      if (delta.detects !== undefined) attack.detects = delta.detects;
      for (const status of upgrade.addStatuses ?? []) {
        const existing = attack.statuses.find(s => s.kind === status.kind);
        if (existing) Object.assign(existing, status);
        else attack.statuses.push(structuredClone(status));
      }
      for (const effect of upgrade.effects ?? []) effects.set(effect.id, structuredClone(effect));
      for (const ability of upgrade.abilities ?? []) abilities.set(ability.id, structuredClone(ability));
    }
  }
  const secondary = ([0, 1, 2] as const).find(p => p !== mainPath && tiers[p] > 0);
  const visual = mainPath === undefined ? def.visual : def.paths[mainPath].upgrades[tiers[mainPath] - 1].visual;
  return {attack, effects: [...effects.values()], abilities: [...abilities.values()], visual,
    ...(mainPath === undefined ? {} : {mainPath}),
    ...(secondary === undefined ? {} : {
      secondaryOverlay: `/art/towers/mirror/${BRANCHES[secondary]}${tiers[secondary]}-overlay.svg`,
    })};
}

function purchased(def: TowerDef, tiers: Tiers): number {
  return def.cost + tiers.reduce((sum, tier, path) => sum +
    def.paths[path].upgrades.slice(0, tier).reduce((s, u) => s + u.cost, 0), 0);
}

function numbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(numbersFinite);
  if (value !== null && typeof value === 'object') return Object.values(value).every(numbersFinite);
  return true;
}

describe('mirror / Зеркальная галерея', () => {
  it('exports the required independent base and exactly 3 × 5 ordered upgrades', () => {
    const tower = getTower();
    expect([tower.id, tower.name, tower.category, tower.placement, tower.cost, tower.footprint])
      .toEqual(['mirror', 'Зеркальная галерея', 'tech', 'land', 950, 25]);
    expect([tower.attack.damage, tower.attack.interval, tower.attack.range]).toEqual([8, 1, 170]);
    expect(tower.paths).toHaveLength(3);
    const ids = new Set<string>();
    tower.paths.forEach((path, index) => {
      expect(path.upgrades).toHaveLength(5);
      path.upgrades.forEach((upgrade, i) => {
        expect(upgrade.id).toBe(`mirror-${BRANCHES[index]}${i + 1}`);
        expect(upgrade.tier).toBe(i + 1);
        expect(upgrade.cost).toBe(COSTS[index][i]);
        expect(upgrade.cost).toBeGreaterThan(0);
        expect(upgrade.name.length).toBeGreaterThan(10);
        expect(upgrade.description.length).toBeGreaterThan(45);
        expect(numbersFinite(upgrade)).toBe(true);
        expect(ids.has(upgrade.id)).toBe(false);
        ids.add(upgrade.id);
        if (i < 2) expect(upgrade.replaceAttack).toBeUndefined();
        expect(upgrade.visual.asset).toBe(`/art/towers/mirror/${BRANCHES[index]}${i + 1}.svg`);
      });
    });
    expect(ids.size).toBe(15);
    expect(numbersFinite(tower)).toBe(true);
    const copy = getTower();
    copy.paths[0].upgrades[2].effects![0].power = -100;
    copy.attack.statuses.push({kind: 'burn', duration: 2, power: 1});
    expect(getTower().paths[0].upgrades[2].effects![0].power).toBe(0.42);
    expect(getTower().attack.statuses).toEqual([]);
  });

  it('rejects illegal builds and resolves the complete legal tier matrix', () => {
    const def = getTower();
    let legalCount = 0;
    for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
      const tiers: Tiers = [a, b, c];
      if (!legal(tiers)) {
        expect(() => fixtureResolve(def, tiers)).toThrow(RangeError);
        continue;
      }
      legalCount++;
      const resolved = fixtureResolve(def, tiers);
      expect(numbersFinite(resolved)).toBe(true);
      expect(resolved.attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(resolved.attack.count).toBeGreaterThanOrEqual(1);
      expect(resolved.attack.pierce).toBeGreaterThanOrEqual(1);
      expect(resolved.attack.range).toBeGreaterThan(0);
      expect(purchased(def, tiers)).toBeGreaterThanOrEqual(950);
      expect(new Set(resolved.effects.map(effect => effect.id)).size).toBe(resolved.effects.length);
      expect(resolved.effects.filter(e => e.kind === 'aura' && e.stat === 'attackSpeed')
        .every(e => e.power <= 0.5)).toBe(true);
    }
    expect(legalCount).toBe(64); // 1 empty + 15 single-path + 12 low/low + 36 high/low
  });

  it('preserves each of the six 5–2–0 specializations and the secondary overlay', () => {
    const def = getTower();
    for (const main of [0, 1, 2] as const) for (const side of [0, 1, 2] as const) {
      if (main === side) continue;
      const tiers: Tiers = [0, 0, 0];
      tiers[main] = 5;
      tiers[side] = 2;
      const resolved = fixtureResolve(def, tiers);
      expect(resolved.mainPath).toBe(main);
      expect(resolved.visual.asset).toContain(`${BRANCHES[main]}5.svg`);
      expect(resolved.secondaryOverlay).toContain(`${BRANCHES[side]}2-overlay.svg`);
      expect(resolved.attack.detects).toBe(side === 2 || main === 2);
      expect(purchased(def, tiers)).toBeGreaterThan(def.cost);
    }
  });

  it('has distinct T3 identities, escalating T5 mechanics and bounded support', () => {
    const tower = getTower();
    const a3 = fixtureResolve(tower, [3, 0, 0]);
    const a5 = fixtureResolve(tower, [5, 0, 0]);
    expect(a3.effects.find(e => e.kind === 'copy')?.power).toBe(0.42);
    expect(a5.effects.find(e => e.kind === 'copy')?.power).toBe(0.90);
    expect(a5.effects.find(e => e.kind === 'echo')?.cap).toBe(2);
    expect(a5.attack.count).toBe(3);
    expect(a5.attack.bossMultiplier).toBeCloseTo(1.15);
    const b3 = fixtureResolve(tower, [0, 3, 0]);
    const b5 = fixtureResolve(tower, [0, 5, 0]);
    expect([b3.attack.mode, b3.attack.count, b3.attack.arc]).toEqual(['cone', 5, 60]);
    expect([b5.attack.mode, b5.attack.count, b5.attack.arc]).toEqual(['cone', 12, 110]);
    expect(b5.attack.statuses).toEqual([{kind: 'mark', power: 0.1, duration: 1.8}]);
    const c3 = fixtureResolve(tower, [0, 0, 3]);
    const c5 = fixtureResolve(tower, [0, 0, 5]);
    expect(c3.effects.find(e => e.stat === 'range')?.power).toBe(0.12);
    expect(c5.effects.find(e => e.stat === 'range')?.power).toBe(0.30);
    expect(c5.effects.find(e => e.stat === 'attackSpeed')?.power).toBe(0.15);
    expect([c5.attack.mode, c5.attack.count, c5.attack.pierce]).toEqual(['beam', 2, 3]);
    expect(c5.attack.statuses[0].kind).toBe('reveal');
    expect(c5.effects.filter(e => e.kind === 'aura').length).toBe(3);
    expect([...a5.effects, ...b5.effects, ...c5.effects].every(e =>
      !['income', 'interest', 'harvest'].includes(e.kind))).toBe(true);
  });

  it('provides 16 fully embedded illustrations, six overlays, and an HTML contact sheet', () => {
    const tower = getTower();
    const assets = [tower.visual.asset,
      ...tower.paths.flatMap(p => p.upgrades.map(u => u.visual.asset)),
      ...BRANCHES.flatMap(path => [1, 2].map(tier => `/art/towers/mirror/${path}${tier}-overlay.svg`))];
    expect(new Set(assets).size).toBe(22);
    for (const asset of assets) {
      const pathname = join(PUBLIC, asset.slice(1));
      expect(existsSync(pathname), asset).toBe(true);
      const xml = readFileSync(pathname, 'utf8');
      expect(xml).toMatch(/<svg\b[^>]*viewBox="0 0 128 128"/);
      expect(xml).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(xml).toMatch(/<path\b|<polygon\b|<circle\b/);
      expect(xml).not.toMatch(/<(?:script|text|foreignObject|image)\b/i);
      expect(xml.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\/|xlink:href|href\s*=/i);
      expect(xml).not.toMatch(/NaN|Infinity/);
    }
    const html = readFileSync(join(PUBLIC, 'art/towers/mirror/preview.html'), 'utf8');
    for (const asset of assets) expect(html).toContain(asset.split('/').at(-1)!);
    expect(html).not.toMatch(/<script\b|https?:\/\//);
  });
});
