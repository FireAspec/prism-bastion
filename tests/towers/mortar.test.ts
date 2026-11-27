import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AttackDef, PathIndex, StatusSpec, Tiers, TowerDef, VisualState} from '../../src/contracts';
import {canUpgrade, legalTiers, sellRefund, upgradeCost} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/mortar';
import {createCombat} from '../../src/combat';
import {spawnEnemy} from '../../src/contracts/runtime';
import type {CombatModule, EnemyDef, GameConfig, GameState, TowerState} from '../../src/contracts';

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

it('gives every full model an independent projectile and muzzle signal', () => {
  const t = getTower();
  const visuals = [t.visual, ...t.paths.flatMap(p => p.upgrades.map(u => u.visual))];
  for (const key of ['asset', 'projectile', 'muzzle'] as const) {
    expect(new Set(visuals.map(v => v[key])).size).toBe(16);
  }
});

// Integration tests run when the public combat entry point is installed.
// Only the precise frozen-base sentinel may skip them; unexpected failures propagate.
let actualCombat: CombatModule | undefined;
try {
  actualCombat = createCombat();
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'Combat module pending') throw error;
}

function placedMortar(id: string, tiers: Tiers, x = 0): TowerState {
  return {id, defId: 'mortar', owner: 'player', pos: {x, y: 0}, tiers, targeting: 'first',
    invested: 800, cooldown: 0, abilityCooldowns: {}, memory: {}, damageDealt: 0, kills: 0, generated: 0};
}

function combatScenario(tiers: Tiers, cloaked = false) {
  const enemy: EnemyDef = {id: 'target', name: 'Target', description: '', color: '#f44', shape: 'orb',
    hp: 10000, speed: 0, bounty: 10, leak: 1, radius: 10, armor: 0, shield: 0, regen: 0,
    cloaked, flying: false, resist: {}, children: [], layers: [{hp: 10000, cash: 10, color: '#f44'}]};
  const config: GameConfig = {
    version: 1, towers: [getTower()], enemies: [enemy], waves: [],
    maps: [{id: 'test-map', name: '', description: '', difficulty: 1, campaignIndex: 1,
      recommendedDifficulty: 'normal', waveOverrides: {}, lanes: [[{x: 0, y: 0}, {x: 1000, y: 0}]],
      pathWidth: 10, blocked: [], water: [], theme: 'garden', background: ''}],
    modes: [], campaign: [], contentVersion: '1', contentDigest: 'test', knowledge: [],
    economy: {xpCurve: [200, 40, 5], maxRewardLevel: 51, pointsPerLevel: 3, mapXP: [250,400,600,900],
      mapSeals: [80,120,180,260], modeReward: {}, firstClearXP: 1.5, repeatXP: 0.65,
      repeatSeals: 0.35, defeatXP: 0.35, respecCost: 200},
    difficulties: [], knowledgeDiscount: 0, startCredits: 0, startLives: 150, sellRatio: 0.7,
  };
  const tower = placedMortar('t1', tiers);
  const state: GameState = {
    version: 1, options: {mapId: 'test-map', difficulty: 'normal', seed: 1, endless: false,
      modeId: 'standard', unlockedTowers: ['mortar'], players: [], runId: 'mortar-test', knowledge: []},
    phase: 'wave', time: 0, rules: {incomeMul: 1, startingCashMul: 1, enemyHpMul: 1, enemySpeedMul: 1,
      towerCostMul: 1, sellAllowed: true, maxLives: 150, allowAbilities: true, allowPassiveIncome: true,
      maxTowers: 60, maxTier: 5, weather: 'none', allowKnowledge: false, rounds: 60,
      roundRewardBase: 80, roundRewardStep: 4, popCashMul: 1},
    tick: 0, rng: 1, nextEntity: 1, nextEvent: 1, credits: 0, lives: 150, wave: 1, waveTime: 0,
    spawnCursor: [], paused: false, speed: 1, autoStart: false, towers: [tower], enemies: [],
    events: [], projectiles: [], strikes: [],
    stats: {spent: 0, earned: 0, kills: 0, damage: 0, leaks: 0, abilities: 0, cashSubunits: 0},
  };
  const spawn = (x: number) => spawnEnemy(state, config, enemy.id, 0, x);
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      state.tick++;
      state.time = state.tick / 60;
      state.waveTime = state.time;
      actualCombat!.step(state, config, 1 / 60);
    }
  };
  return {state, config, tower, spawn, advance};
}

describe.skipIf(!actualCombat)('Небесная мортира: combat integration', () => {
  it('matches the independent resolver for all 64 legal combinations', () => {
    const def = getTower();
    let count = 0;
    for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
      const tiers: Tiers = [a, b, c];
      if (!legalTiers(tiers)) continue;
      const actual = actualCombat!.resolveTower(def, tiers);
      const expected = fixtureResolve(def, tiers);
      const normalize = (attack: AttackDef) => ({...attack,
        statuses: attack.statuses.map(s => ({...s, maxStacks: s.maxStacks ?? 1}))});
      expect(normalize(actual.attack)).toEqual(normalize(expected.attack));
      expect(actual.effects).toEqual(expected.effects);
      expect(actual.abilities).toEqual(expected.abilities);
      expect(actual.visual).toEqual(expected.visual);
      expect(actual.mainPath).toBe(expected.mainPath);
      expect(actual.secondaryOverlay).toBe(expected.secondaryOverlay);
      count++;
    }
    expect(count).toBe(64);
  });

  it('deals damage only after the windup and projectile reaches the landing point', () => {
    const f = combatScenario([0, 0, 0]);
    const enemy = f.spawn(100);
    f.advance(30);
    expect(enemy.hp).toBe(10000);
    expect(f.state.projectiles.length).toBe(1);
    f.advance(12);
    expect(enemy.hp).toBe(9950);
    expect(f.state.events.filter(e => e.kind === 'projectileImpact')).toHaveLength(1);
    expect(f.state.events.find(e => e.kind === 'projectileImpact')?.pos?.x).toBeCloseTo(100, 6);
  });

  it('misses a target that leaves the blast area after launch', () => {
    const f = combatScenario([0, 0, 0]);
    const enemy = f.spawn(100);
    f.advance(17);
    expect(f.state.projectiles.length).toBe(1);
    enemy.pos.x = 300; enemy.progress = 300;
    f.advance(30);
    expect(enemy.hp).toBe(10000);
    expect(f.state.events.filter(e => e.kind === 'miss')).toHaveLength(1);
  });

  it('launches ten cluster shells distributed among available targets', () => {
    const f = combatScenario([0, 5, 0]);
    f.spawn(100); f.spawn(200);
    f.advance(17);
    expect(f.state.projectiles).toHaveLength(10);
    expect(new Set(f.state.projectiles.map(p => p.target)).size).toBe(2);
    expect(f.state.projectiles.every(p => p.visual === 'mortar-swarm')).toBe(true);
    expect(f.state.stats.damage).toBe(0);
    f.advance(40);
    expect(f.state.events.filter(e => e.kind === 'projectileImpact')).toHaveLength(10);
    expect(f.state.stats.damage).toBeGreaterThan(0);
  });

  it('launches an active meteor, enforces cooldown and respects no-actives rules', () => {
    const f = combatScenario([5, 0, 0]);
    const enemy = f.spawn(200);
    const farther = f.spawn(500);
    f.tower.cooldown = 100;
    const id = 'mortar-skyfall';
    f.state.rules.allowAbilities = false;
    expect(actualCombat!.activate(f.state, f.config, f.tower.id, id).ok).toBe(false);
    f.state.rules.allowAbilities = true;
    expect(actualCombat!.activate(f.state, f.config, f.tower.id, id).ok).toBe(true);
    expect(f.state.projectiles).toHaveLength(1);
    expect(f.state.projectiles[0].target).toBe(enemy.id);
    expect(f.tower.abilityCooldowns[id]).toBe(65);
    expect(actualCombat!.activate(f.state, f.config, f.tower.id, id).ok).toBe(false);
    f.advance(10);
    expect(enemy.hp).toBe(10000);
    f.advance(40);
    expect(enemy.hp).toBe(9480);
    expect(farther.hp).toBe(10000);
  });

  it('applies cluster overclock to the next attack interval', () => {
    const f = combatScenario([0, 5, 0]);
    f.spawn(100);
    const id = 'mortar-cluster-overclock';
    expect(actualCombat!.activate(f.state, f.config, f.tower.id, id).ok).toBe(true);
    f.advance(1);
    const ordinary = actualCombat!.resolveTower(getTower(), [0, 5, 0]).attack.interval;
    expect(f.tower.cooldown).toBeCloseTo(ordinary / 1.3, 8);
    expect(f.tower.memory['combat:overclockUntil']).toBe(7);
    expect(f.tower.abilityCooldowns[id]).toBeGreaterThan(49);
  });

  it('reveals and marks a cloaked target, extending the mark at C5', () => {
    const f = combatScenario([0, 0, 5], true);
    const enemy = f.spawn(100);
    f.advance(60);
    expect(enemy.hp).toBeLessThan(10000);
    const reveal = enemy.statuses.find(s => s.kind === 'reveal');
    const mark = enemy.statuses.find(s => s.kind === 'mark');
    const slow = enemy.statuses.find(s => s.kind === 'slow');
    expect(reveal?.duration).toBe(4);
    expect(mark?.duration).toBe(6);
    expect(mark?.power).toBe(0.1);
    expect(slow?.power).toBe(0.18);
    expect(mark?.remaining).toBeGreaterThan(5);
  });

  it('supports allies inside the C5 detection radius, not outside it', () => {
    const f = combatScenario([0, 0, 5], true);
    f.spawn(500);
    f.state.towers.push(placedMortar('inside', [0, 0, 0], 300),
      placedMortar('outside', [0, 0, 0], 321));
    f.advance(1);
    expect(f.state.strikes.map(s => s.source)).toEqual(['inside']);
  });

  it('keeps burn at two stacks despite three shells from an A5/B1 cross-path', () => {
    const f = combatScenario([5, 1, 0]);
    const enemy = f.spawn(100);
    f.advance(60);
    const burn = enemy.statuses.find(s => s.kind === 'burn');
    expect(burn?.stacks).toBe(2);
    expect(burn?.power).toBe(6);
    expect(f.state.stats.damage).toBeGreaterThan(0);
  });
});
