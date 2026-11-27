import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, StatDelta, StatusSpec, Tiers, TowerDef} from '../../src/contracts';
import {canUpgrade, legalTiers, sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/drone';

const costs = [
  [450, 900, 2250, 5400, 13500],
  [430, 855, 2140, 5130, 12825],
  [500, 995, 2480, 5945, 14855],
];
const letters = ['a', 'b', 'c'] as const;

/*
 * Isolated content fixture: combat/engine are owned by other modules and pending
 * on the pinned base. This follows the frozen resolver rules without inventing
 * another production resolver or importing a neighbor's unfinished code.
 */
function applyDelta(a: AttackDef, d: StatDelta): void {
  const multipliers: Array<[keyof StatDelta, keyof AttackDef]> = [
    ['damageMul', 'damage'], ['intervalMul', 'interval'], ['rangeMul', 'range'],
    ['shieldMultiplierMul', 'shieldMultiplier'], ['bossMultiplierMul', 'bossMultiplier'],
    ['projectileSpeedMul', 'projectileSpeed'], ['windupMul', 'windup'],
  ];
  for (const [change, field] of multipliers) {
    const value = d[change];
    if (typeof value === 'number') (a[field] as number) *= value;
  }
  const additions: Array<[keyof StatDelta, keyof AttackDef]> = [
    ['pierceAdd', 'pierce'], ['countAdd', 'count'], ['splashAdd', 'splash'],
    ['chainsAdd', 'chains'], ['chainRadiusAdd', 'chainRadius'],
    ['armorPierceAdd', 'armorPierce'], ['executeBelowAdd', 'executeBelow'],
    ['pushAdd', 'push'], ['arcAdd', 'arc'],
  ];
  for (const [change, field] of additions) {
    const value = d[change];
    if (typeof value === 'number') (a[field] as number) += value;
  }
  if (d.detects) a.detects = true;
}
function mergeStatuses(existing: StatusSpec[], next: StatusSpec[]): StatusSpec[] {
  const result = new Map(existing.map(s => [s.kind, s]));
  for (const status of next) result.set(status.kind, status);
  return [...result.values()];
}
function fixtureResolve(def: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legalTiers(tiers)) throw new RangeError('Illegal tier vector');
  const active = [0, 1, 2].filter(i => tiers[i] > 0) as PathIndex[];
  const main = [...active].sort((a, b) => tiers[b] - tiers[a] || a - b)[0] as PathIndex | undefined;
  const mainUpgrades = main === undefined ? [] : def.paths[main].upgrades.slice(0, tiers[main]);
  const replacement = [...mainUpgrades].reverse().find(u => u.replaceAttack)?.replaceAttack;
  const a = structuredClone(replacement ?? def.attack);
  const effects = new Map(def.effects.map(e => [e.id, e]));
  const abilities = new Map(def.abilities.map(e => [e.id, e]));
  for (let p = 0; p < 3; p++) {
    for (const u of def.paths[p].upgrades.slice(0, tiers[p])) {
      applyDelta(a, u.delta);
      if (u.addStatuses) a.statuses = mergeStatuses(a.statuses, u.addStatuses);
      for (const effect of u.effects ?? []) effects.set(effect.id, effect);
      for (const ability of u.abilities ?? []) abilities.set(ability.id, ability);
    }
  }
  const secondary = active.find(i => i !== main);
  const secondaryOverlay = secondary === undefined ? undefined :
    `./art/towers/drone/${letters[secondary]}${tiers[secondary]}-overlay.svg`;
  const selectedVisual = main === undefined ? def.visual : def.paths[main].upgrades[tiers[main] - 1].visual;
  return {
    attack: a, effects: [...effects.values()] as EffectDef[], abilities: [...abilities.values()],
    visual: selectedVisual, mainPath: main, secondaryOverlay,
  };
}

const combinations: Tiers[] = [];
for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
  const tiers: Tiers = [a, b, c];
  if (legalTiers(tiers)) combinations.push(tiers);
}

describe('Ангар дронов — каталог и контракт', () => {
  it('has a precise, complete immutable-by-copy tower definition', () => {
    const tower = getTower();
    expect([tower.id, tower.category, tower.placement, tower.cost, tower.footprint])
      .toEqual(['drone', 'tech', 'land', 900, 26]);
    expect([tower.attack.mode, tower.attack.damage, tower.attack.interval, tower.attack.range])
      .toEqual(['drone', 12, 0.8, 230]);
    expect(tower.paths).toHaveLength(3);
    expect(tower.paths.map(p => p.upgrades.length)).toEqual([5, 5, 5]);
    const ids = tower.paths.flatMap(p => p.upgrades.map(u => u.id));
    expect(new Set(ids).size).toBe(15);
    tower.attack.damage = 123456;
    tower.paths[0].upgrades[0].delta.countAdd = 999;
    expect(getTower().attack.damage).toBe(12);
    expect(getTower().paths[0].upgrades[0].delta.countAdd).toBe(1);
  });

  it('uses all exact normal prices, positive finite effects and sequential IDs', () => {
    const tower = getTower();
    tower.paths.forEach((path, p) => path.upgrades.forEach((u, t) => {
      expect([u.id, u.tier, u.cost]).toEqual([`drone-${letters[p]}${t + 1}`, t + 1, costs[p][t]]);
      expect(u.name.length).toBeGreaterThan(5);
      expect(u.description.length).toBeGreaterThan(25);
      expect(u.cost).toBeGreaterThan(0);
      expect(t < 2 ? u.replaceAttack : undefined).toBeUndefined();
      for (const val of Object.values(u.delta)) if (typeof val === 'number') expect(Number.isFinite(val)).toBe(true);
      for (const effect of u.effects ?? []) {
        for (const field of ['power', 'radius', 'interval', 'duration', 'cap'] as const)
          expect(Number.isFinite(effect[field])).toBe(true);
        if (effect.kind === 'aura') expect(effect.stat).toBeTruthy();
        else {
          expect(effect.kind).toBe('echo');
          expect(effect.power).toBeGreaterThan(0);
          expect(effect.power).toBeLessThanOrEqual(1);
          expect(effect.cap).toBe(2);
          expect(effect.interval).toBeGreaterThanOrEqual(0.05);
        }
      }
    }));
  });

  it('resolves every legal tier matrix to finite attacks, unique effects and valid art', () => {
    const tower = getTower();
    expect(combinations).toHaveLength(64);
    for (const tiers of combinations) {
      const resolved = fixtureResolve(tower, tiers);
      const a = resolved.attack;
      expect(a.interval, JSON.stringify(tiers)).toBeGreaterThanOrEqual(0.05);
      expect(a.count).toBeGreaterThanOrEqual(1);
      expect(a.range).toBeGreaterThan(0);
      expect(a.damage).toBeGreaterThan(0);
      expect(a.pierce).toBeGreaterThan(0);
      expect(a.mode).toBe(tiers[1] >= 3 ? 'splash' : 'drone');
      if (a.mode === 'drone') {
        expect(a.splash).toBe(0);
        expect(a.chains).toBe(0);
      }
      for (const value of Object.values(a)) if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      expect(new Set(resolved.effects.map(e => e.id)).size).toBe(resolved.effects.length);
      expect(existsSync(resolve('public', resolved.visual.asset.replace(/^\.\//, '')))).toBe(true);
      if (resolved.secondaryOverlay)
        expect(existsSync(resolve('public', resolved.secondaryOverlay.replace(/^\.\//, '')))).toBe(true);
      for (let p = 0; p < 3; p++) {
        const next: Tiers = [...tiers];
        next[p]++;
        expect(canUpgrade(tiers, p as PathIndex)).toBe(legalTiers(next));
      }
    }
  });

  it('distinguishes six terminal cross-paths with the expected primary and overlay', () => {
    const cases: Array<[Tiers, PathIndex, string]> = [
      [[5, 2, 0], 0, 'b2'], [[5, 0, 2], 0, 'c2'],
      [[2, 5, 0], 1, 'a2'], [[0, 5, 2], 1, 'c2'],
      [[2, 0, 5], 2, 'a2'], [[0, 2, 5], 2, 'b2'],
    ];
    for (const [tiers, main, overlay] of cases) {
      const result = fixtureResolve(getTower(), tiers);
      expect(result.mainPath).toBe(main);
      expect(result.visual.asset).toContain(`${letters[main]}5.svg`);
      expect(result.secondaryOverlay).toContain(`${overlay}-overlay.svg`);
    }
  });

  it('preserves material mechanics and cross-path benefits', () => {
    const tower = getTower();
    const base = fixtureResolve(tower, [0, 0, 0]).attack;
    const a = fixtureResolve(tower, [5, 0, 0]).attack;
    const b = fixtureResolve(tower, [0, 5, 0]).attack;
    const c = fixtureResolve(tower, [0, 0, 5]);
    expect(base.count).toBe(1);
    expect(a.count).toBe(6);
    expect(a.chains).toBe(0);
    expect(fixtureResolve(tower, [5, 0, 0]).effects).toContainEqual({
      id: 'drone-swarm-echo', kind: 'echo', power: 0.35, radius: 65, interval: 0.35, duration: 0, cap: 2,
    });
    expect(a.pierce).toBe(2);
    expect(b.mode).toBe('splash');
    expect(b.splash).toBe(90);
    expect(b.armorPierce).toBe(24);
    expect(b.statuses).toContainEqual({kind: 'shred', power: 8, duration: 3});
    expect(c.attack.detects).toBe(true);
    expect(c.attack.count).toBe(4);
    expect(c.effects.filter(e => e.kind === 'aura').map(e => e.stat).sort()).toEqual(['attackSpeed', 'damage', 'detect', 'range']);
    expect(c.effects.find(e => e.kind === 'echo')).toMatchObject({power: 0.4, radius: 85, interval: 0.4, cap: 2});
    expect(c.effects.find(e => e.stat === 'detect')?.radius).toBe(310);
    expect(c.effects.find(e => e.stat === 'damage')?.power).toBe(0.18);
    expect(fixtureResolve(tower, [0, 5, 2]).attack.statuses.map(s => s.kind)).toEqual(['shred', 'reveal', 'mark']);
    expect(fixtureResolve(tower, [2, 5, 0]).attack.count).toBe(2);
    expect(fixtureResolve(tower, [5, 2, 0]).attack.damage).toBeGreaterThan(a.damage);
    expect(fixtureResolve(tower, [5, 0, 2]).attack.detects).toBe(true);
    expect(fixtureResolve(tower, [0, 2, 5]).attack.shieldMultiplier).toBeGreaterThan(c.attack.shieldMultiplier);
    expect(fixtureResolve(tower, [2, 0, 5]).attack.count).toBe(5);
  });

  it('chooses the higher early tier as primary, with index only breaking ties', () => {
    const tower = getTower();
    for (const [tiers, primary, secondary] of [
      [[1, 2, 0], 1, 'a1'], [[1, 0, 2], 2, 'a1'], [[0, 1, 2], 2, 'b1'],
      [[2, 2, 0], 0, 'b2'], [[2, 0, 2], 0, 'c2'], [[0, 2, 2], 1, 'c2'],
    ] as Array<[Tiers, PathIndex, string]>) {
      const result = fixtureResolve(tower, tiers);
      expect(result.mainPath).toBe(primary);
      expect(result.visual.asset).toContain(letters[primary] + '2.svg');
      expect(result.secondaryOverlay).toContain(secondary + '-overlay.svg');
    }
  });

  it('provides distinct projectile and launch visual keys for every model', () => {
    const tower = getTower();
    const visuals = [tower.visual, ...tower.paths.flatMap(p => p.upgrades.map(u => u.visual))];
    expect(new Set(visuals.map(v => v.projectile)).size).toBe(16);
    expect(new Set(visuals.map(v => v.muzzle)).size).toBe(16);
  });

  it('does not sell for over 70% and never earns credits from its aura', () => {
    const tower = getTower();
    for (const tiers of combinations) {
      let invested = tower.cost;
      tiers.forEach((n, p) => tower.paths[p].upgrades.slice(0, n).forEach(u => { invested += u.cost; }));
      expect(sellRefund(invested)).toBeLessThanOrEqual(Math.floor(invested * 0.7));
      expect(fixtureResolve(tower, tiers).effects.every(e => e.kind === 'aura' || e.kind === 'echo')).toBe(true);
    }
  });

  it('ships 16 stand-alone artworks and 6 composable overlays without external content', () => {
    const names = ['base', ...letters.flatMap(letter => Array.from({length: 5}, (_, i) => `${letter}${i + 1}`)),
      ...letters.flatMap(letter => [`${letter}1-overlay`, `${letter}2-overlay`])];
    expect(names).toHaveLength(22);
    for (const name of names) {
      const file = resolve('public/art/towers/drone', name + '.svg');
      expect(existsSync(file), file).toBe(true);
      const content = readFileSync(file, 'utf8');
      expect(content).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      expect(content).toContain('viewBox="0 0 128 128"');
      expect(content).toMatch(/<(path|polygon|rect|circle|ellipse)\b/);
      expect(content).not.toMatch(/<(script|image|foreignObject|text)\b|\b(?:href|url)\s*=\s*["']https?:/i);
      expect(content).not.toMatch(/<image|data:/i);
      expect(content).toContain('</svg>');
    }
    const preview = readFileSync(resolve('public/art/towers/drone/preview.html'), 'utf8');
    expect(preview).not.toMatch(/https?:\/\/|<script|<iframe/i);
    const sources = [...preview.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
    expect(sources.length).toBeGreaterThanOrEqual(28);
    for (const source of sources)
      expect(existsSync(resolve('public/art/towers/drone', source)), source).toBe(true);
  });
});
