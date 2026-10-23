import {describe, expect, it} from 'vitest';
import type {Difficulty, DifficultyDef, EnemyDef, WaveDef} from '../../src/contracts';
import {getEndlessWave, getWaveBudgetLedger, getWaveLayerBudget, getWaves, getWaveSet} from '../../src/content/waves';

const regular = [
  'scarlet', 'amber', 'lemon', 'jade', 'azure', 'violet', 'iron', 'glass',
  'cloak', 'regrow', 'shield', 'split', 'ruby', 'glacier', 'copper', 'obsidian',
  'dart', 'swarm', 'aegis', 'royal', 'hollow', 'prismatic', 'juggernaut', 'herald',
];
const bosses: Record<number, string> = {
  10: 'boss-carapace', 20: 'boss-brood', 40: 'boss-mirror',
  60: 'boss-chrono', 80: 'boss-tempest', 100: 'boss-eclipse',
};
const ids = new Set([...regular, ...Object.values(bosses)]);

// Stand-in catalogue: the owning enemy/boss modules are independent and still
// have placeholders on the frozen base. No imports from unfinished neighbours.
function enemy(id: string, bounty: number, children: EnemyDef['children'] = [],
  phases: NonNullable<EnemyDef['boss']>['phases'] = []): EnemyDef {
  return {
    id, name: id, description: '', color: '#f0f', shape: 'orb', hp: 20, speed: 50,
    bounty, leak: 1, radius: 10, armor: 0, shield: 0, regen: 0,
    cloaked: false, flying: false, resist: {}, children,
    layers: [{hp: 12, cash: Math.floor(bounty / 2), color: '#a0a'},
      {hp: 8, cash: Math.ceil(bounty / 2), color: '#f0f'}],
    ...(phases.length ? {boss: {controlFactor: 0.5, phases}} : {}),
  };
}
const phase = (spawn: string, count: number) =>
  ({atHealth: 0.5, shield: 0, speedMul: 1, spawn, count, interval: 1});

describe('100 campaign rounds', () => {
  const waves = getWaves();
  it('contains exactly sequential 1..100 rounds, each with a unique schedule', () => {
    expect(waves.map(x => x.number)).toEqual(Array.from({length: 100}, (_, i) => i + 1));
    expect(new Set(waves.map(x => JSON.stringify(x.groups)) ).size).toBe(100);
  });
  it('uses only declared spawn/boss IDs and finite nonnegative schedules', () => {
    for (const wave of waves) {
      expect(wave.preview.length).toBeGreaterThan(4);
      expect(wave.reward).toBe(80 + 4 * wave.number);
      expect(wave.groups.length).toBeGreaterThan(0);
      expect(wave.boss).toBe(bosses[wave.number]);
      for (const group of wave.groups) {
        expect(ids.has(group.enemy), `Wave ${wave.number}: ${group.enemy}`).toBe(true);
        expect(Number.isSafeInteger(group.count) && group.count > 0).toBe(true);
        expect(Number.isFinite(group.at) && group.at >= 0).toBe(true);
        expect(Number.isFinite(group.every) && group.every >= 0).toBe(true);
        expect(Number.isSafeInteger(group.lane) && group.lane >= 0).toBe(true);
        if (group.count > 1) expect(group.every).toBeGreaterThan(0);
        expect(Number.isFinite(group.at + (group.count - 1) * group.every)).toBe(true);
        if (group.hpMul !== undefined) expect(Number.isFinite(group.hpMul) && group.hpMul > 0).toBe(true);
        if (group.speedMul !== undefined) expect(Number.isFinite(group.speedMul) && group.speedMul > 0).toBe(true);
        if (group.enemy.startsWith('boss-')) {
          expect(group.enemy).toBe(wave.boss);
          expect(group.count).toBe(1);
        }
      }
      if (wave.boss) {
        expect(wave.groups.filter(x => x.enemy === wave.boss)).toHaveLength(1);
      }
    }
    for (const before of [9, 19, 39, 59, 79, 99]) {
      expect(waves[before - 1].preview).toContain('Предупреждение');
    }
  });
  it.each([['easy', 40], ['normal', 60], ['hard', 80], ['extreme', 100]] as const)(
    '%s ends on its intended boss at wave %i', (difficulty, rounds) => {
      const selected = getWaveSet(difficulty);
      expect(selected).toHaveLength(rounds);
      expect(selected[rounds - 1].boss).toBe(bosses[rounds]);
      expect(selected).toEqual(waves.slice(0, rounds));
    },
  );
  it('returns independent copies to prevent cross-run schedule mutation', () => {
    const snapshot = getWaves();
    snapshot[0].groups[0].count = 9000;
    snapshot[0].preview = 'modified';
    getWaveSet('easy')[0].groups[0].at = 1000;
    expect(getWaves()[0]).toEqual(waves[0]);
    expect(() => getWaveSet('invalid' as Difficulty)).toThrow(RangeError);
  });
  it('has no busy-spawn spikes in the opening tutorial', () => {
    const openings = waves.slice(0, 10);
    expect(openings[0].groups.reduce((n, group) => n + group.count, 0)).toBe(8);
    for (const wave of openings) {
      expect(wave.groups.reduce((n, group) => n + group.count, 0)).toBeLessThanOrEqual(30);
      // This is pacing hygiene, NOT proof the map is winnable.
      expect(wave.groups.every(group => group.every === 0 || group.every >= 1.1)).toBe(true);
    }
  });
});

describe('deterministic endless', () => {
  const catalogue = [enemy('tiny', 3), enemy('splitter', 10, [{id: 'tiny', count: 3}]),
    enemy('medium', 9), enemy('heavy', 40), enemy('boss', 100, [], [phase('tiny', 5)])];
  it('repeats bit-for-bit for the same seed and is independent of input ordering', () => {
    for (const n of [101, 102, 125, 260, 1000]) {
      const first = getEndlessWave(n, -1245, catalogue);
      expect(first).toEqual(getEndlessWave(n, -1245, [...catalogue].reverse()));
      expect(first).toEqual(getEndlessWave(n, -1245, catalogue));
      expect(first.number).toBe(n);
      expect(first.reward).toBe(0);
      expect(first.boss).toBeUndefined();
    }
  });
  it('bounds roots and forbids split/phase summons, with HP and speed scaling', () => {
    let previous = 0;
    for (const n of [101, 103, 120, 150, 300, 1000, 10000]) {
      const wave = getEndlessWave(n, 42, catalogue);
      const roots = wave.groups.reduce((sum, group) => sum + group.count, 0);
      expect(roots).toBeLessThanOrEqual(36);
      expect(roots).toBeGreaterThanOrEqual(previous);
      expect(wave.groups.every(x => !['splitter', 'boss'].includes(x.enemy))).toBe(true);
      expect(wave.groups.every(x => x.hpMul! >= 1 && x.hpMul! <= 24)).toBe(true);
      expect(wave.groups.every(x => x.speedMul! >= 1 && x.speedMul! <= 1.8)).toBe(true);
      for (const group of wave.groups) {
        expect(group.count).toBeGreaterThan(0);
        expect(group.every).toBeGreaterThan(0);
        expect(group.lane).toBeGreaterThanOrEqual(0);
        expect(group.lane).toBeLessThan(4);
      }
      previous = roots;
    }
    expect(getEndlessWave(300, 42, catalogue).groups[0].hpMul)
      .toBeGreaterThan(getEndlessWave(101, 42, catalogue).groups[0].hpMul!);
  });
  it('rejects invalid indices, seeds, or no eligible units', () => {
    for (const value of [0, 100, -1, 1.5, NaN, Infinity]) {
      expect(() => getEndlessWave(value, 2, catalogue)).toThrow(RangeError);
    }
    expect(() => getEndlessWave(101, NaN, catalogue)).toThrow(RangeError);
    expect(() => getEndlessWave(101, 2, [catalogue[1]])).toThrow(RangeError);
  });
});

describe('potential layer budget, including descendants and phase spawns', () => {
  const definitions = [enemy('scarlet', 3), enemy('split', 4, [{id: 'scarlet', count: 2}]),
    enemy('iron', 9), enemy('boss-carapace', 18, [], [phase('iron', 3)])];
  const wave: WaveDef = {number: 10, preview: 'fixture', reward: 120, boss: 'boss-carapace',
    groups: [{enemy: 'split', count: 2, at: 1, every: 1, lane: 0},
      {enemy: 'boss-carapace', count: 1, at: 2, every: 0, lane: 0}]};
  it('sums exactly every payable layer, each descendant, and every boss summon', () => {
    // 2 × (4 + 2×3) + (18 + 3×9) = 65, not 65 + bounties + reward.
    expect(getWaveLayerBudget(wave, definitions)).toBe(65);
    expect(getWaveLayerBudget({...wave, groups: [wave.groups[0]]}, definitions)).toBe(20);
    expect(getWaveLayerBudget({...wave, groups: [wave.groups[1]]}, definitions)).toBe(45);
    expect(getWaveLayerBudget(wave, [...definitions].reverse())).toBe(65);
  });
  it('fails explicitly for cycles, missing IDs and wrong layer-control totals', () => {
    expect(() => getWaveLayerBudget(wave, definitions.slice(1))).toThrow('Missing enemy');
    expect(() => getWaveLayerBudget(wave, [...definitions, definitions[0]])).toThrow('Duplicate');
    expect(() => getWaveLayerBudget(wave, definitions.map(x => x.id === 'split' ?
      {...x, children: [{id: 'split', count: 1}]} : x))).toThrow('Cyclic');
    expect(() => getWaveLayerBudget(wave, definitions.map(x => x.id === 'split' ?
      {...x, bounty: 999} : x))).toThrow('mismatch');
  });
});

describe('per-wave theoretical purchasing budget', () => {
  const catalogue = [
    ...regular.map((id, i) => enemy(id, i % 4 === 0 ? 3 : i + 2,
      id === 'split' ? [{id: 'scarlet', count: 2}] :
        id === 'prismatic' ? [{id: 'royal', count: 2}] : [])),
    ...Object.values(bosses).map((id, i) => enemy(id, 50 + i * 50, [],
      [phase(i % 2 === 0 ? 'iron' : 'swarm', 2 + i)])),
  ];
  const presets: DifficultyDef[] = [
    {id: 'easy', name: 'easy', rounds: 40, lives: 200, startCredits: 1000,
      towerCostMul: 0.85, enemyHpMul: 0.85, roundRewardBase: 100,
      roundRewardStep: 5, popCashMul: 1, rewardMul: 0.7},
    {id: 'normal', name: 'normal', rounds: 60, lives: 150, startCredits: 900,
      towerCostMul: 1, enemyHpMul: 1, roundRewardBase: 80,
      roundRewardStep: 4, popCashMul: 1, rewardMul: 1},
    {id: 'hard', name: 'hard', rounds: 80, lives: 100, startCredits: 850,
      towerCostMul: 1.1, enemyHpMul: 1.1, roundRewardBase: 60,
      roundRewardStep: 3, popCashMul: 1, rewardMul: 1.35},
    {id: 'extreme', name: 'extreme', rounds: 100, lives: 1, startCredits: 850,
      towerCostMul: 1.2, enemyHpMul: 1.2, roundRewardBase: 50,
      roundRewardStep: 2, popCashMul: 1, rewardMul: 1.7},
  ];

  // Event-based oracle: physically expand spawn roots, split children and phase
  // summons, then deposit each layer's fixed-point cents separately.
  function simulateNoPurchaseIncome(def: DifficultyDef, half: boolean) {
    const factor = half ? 0.5 : 1;
    let cents = Math.round(def.startCredits * factor * 100);
    const map = new Map(catalogue.map(value => [value.id, value]));
    const check = [];
    for (const wave of getWaveSet(def.id)) {
      const before = cents;
      const stack: string[] = [];
      for (const group of wave.groups) for (let n = 0; n < group.count; n++) stack.push(group.enemy);
      let payout = 0;
      while (stack.length) {
        const current = map.get(stack.pop()!)!;
        for (const layer of current.layers) {
          cents += Math.round(layer.cash * factor * def.popCashMul * 100);
          payout += layer.cash;
        }
        for (const child of current.children) for (let n = 0; n < child.count; n++) stack.push(child.id);
        for (const p of current.boss?.phases ?? []) {
          if (p.spawn) for (let n = 0; n < p.count; n++) stack.push(p.spawn);
        }
      }
      cents += Math.round((def.roundRewardBase + def.roundRewardStep * wave.number) * factor * 100);
      check.push({before, after: cents, layerCash: payout});
    }
    return check;
  }

  it.each(presets.flatMap(preset => [
    {preset, halfCash: false}, {preset, halfCash: true},
  ]))('audits every $preset.id round (half-cash $halfCash) against individual pay events',
    ({preset, halfCash}) => {
      const rows = getWaveBudgetLedger(preset, catalogue, halfCash);
      const oracle = simulateNoPurchaseIncome(preset, halfCash);
      expect(rows).toHaveLength(preset.rounds);
      for (let n = 0; n < rows.length; n++) {
        expect(rows[n].wave).toBe(n + 1);
        expect(rows[n].layerCash).toBe(oracle[n].layerCash);
        expect(rows[n].beforeCredits * 100 + rows[n].beforeSubunits).toBe(oracle[n].before);
        expect(rows[n].afterCredits * 100 + rows[n].afterSubunits).toBe(oracle[n].after);
      }
    });

  it('gets known first-wave receipts and retains partial half-cash credits', () => {
    const easy = getWaveBudgetLedger(presets[0], catalogue);
    const half = getWaveBudgetLedger(presets[0], catalogue, true);
    expect(easy[0]).toMatchObject({beforeCredits: 1000, afterCredits: 1129,
      beforeSubunits: 0, afterSubunits: 0, layerCash: 24, roundReward: 105});
    expect(half[0]).toMatchObject({beforeCredits: 500, afterCredits: 564,
      beforeSubunits: 0, afterSubunits: 50, layerCash: 24, roundReward: 52.5});
    expect(half[1].beforeSubunits).toBe(50);
  });

  it('rounds each layer event separately at fractional pop-cash rates', () => {
    const def = {...presets[0], popCashMul: 0.333};
    const rows = getWaveBudgetLedger(def, catalogue);
    const oracle = simulateNoPurchaseIncome(def, false);
    // The eight scarlets each pay layer amounts of 1 and 2: 33c + 67c.
    // Rounding the total of 24 credits at once instead gives only 799c.
    expect(rows[0].afterCredits).toBe(1113);
    expect(rows[0].afterSubunits).toBe(0);
    expect(rows[0].afterCredits * 100 + rows[0].afterSubunits).toBe(oracle[0].after);
    const half = getWaveBudgetLedger(def, catalogue, true);
    const halfOracle = simulateNoPurchaseIncome(def, true);
    expect(half[0].afterCredits * 100 + half[0].afterSubunits).toBe(halfOracle[0].after);
  });

  it('rejects malformed economy rules and non-matching round prefixes', () => {
    expect(() => getWaveBudgetLedger({...presets[0], rounds: 60}, catalogue)).toThrow(RangeError);
    expect(() => getWaveBudgetLedger({...presets[0], popCashMul: NaN}, catalogue)).toThrow(RangeError);
    expect(() => getWaveBudgetLedger(presets[0], catalogue.slice(1))).toThrow('Missing enemy');
    expect(() => getWaveLayerBudget(getWaves()[0],
      catalogue.map(def => def.id === 'scarlet' ? {...def, hp: 21} : def)))
      .toThrow('HP mismatch');
  });
});
