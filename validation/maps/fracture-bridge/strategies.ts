import type {PathIndex, Vec} from '../../../src/contracts';

export const firstVisitTowers = [
  'needle', 'cannon', 'frost', 'beacon', 'scatter', 'ember', 'saw', 'venom',
  'rail', 'tesla', 'mortar', 'observatory', 'mint', 'orchard', 'drone',
  'rocket', 'resonator', 'forge', 'harbor', 'tide', 'coral', 'chrono',
  'gravity', 'prism', 'mirror', 'mine',
] as const;
type Tower = typeof firstVisitTowers[number];

export const positions = {
  C: {x: 365, y: 362}, N: {x: 363, y: 148}, S: {x: 364, y: 580},
  U: {x: 523, y: 218}, D: {x: 528, y: 512},
  B1: {x: 613, y: 254}, B2: {x: 611, y: 475},
  E: {x: 1096, y: 512}, LN: {x: 166, y: 307}, LS: {x: 162, y: 429},
  W1: {x: 822, y: 262}, W2: {x: 821, y: 468},
} satisfies Record<string, Vec>;

export type ReplayAction =
  | {wave: number; tick: number; type: 'place'; tower: Tower; alias: string; pos: Vec}
  | {wave: number; tick: number; type: 'upgrade'; alias: string; path: PathIndex};

export interface StrategyCandidate {
  id: string; modeId: 'standard' | 'half-cash' | 'iron-oath'; difficulty: 'extreme';
  seed: number; maxWave: 100; verified: false;
  actions: ReplayAction[]; counters: string[];
}
const place = (wave: number, tick: number, tower: Tower, alias: keyof typeof positions): ReplayAction =>
  ({wave, tick, type: 'place', tower, alias, pos: {...positions[alias]}});
const upgrade = (wave: number, tick: number, alias: keyof typeof positions, path: PathIndex): ReplayAction =>
  ({wave, tick, type: 'upgrade', alias, path});

// A concrete test input, not a claimed victory. tick=0 means pre-wave build
// phase, other ticks count fixed 1/60-second simulation steps within the wave.
export const candidates: StrategyCandidate[] = [
  {id: 'two-bank-crossfire', modeId: 'standard', difficulty: 'extreme', seed: 531601, maxWave: 100, verified: false,
    counters: ['N/S counter asymmetric early leaks', 'Frost slows fast enemies',
      'Rail and Tesla pressure armor and shields', 'Beacon reveals cloak', 'Mine covers the final exit'],
    actions: [
      place(1, 0, 'needle', 'C'), upgrade(3, 0, 'C', 0),
      place(5, 0, 'cannon', 'N'), place(8, 0, 'scatter', 'S'),
      upgrade(10, 120, 'N', 0), place(12, 0, 'frost', 'U'), upgrade(15, 0, 'U', 1),
      place(18, 0, 'tesla', 'D'), upgrade(21, 0, 'C', 0),
      place(25, 0, 'rail', 'B1'), upgrade(28, 0, 'B1', 0),
      place(31, 0, 'beacon', 'B2'), place(35, 0, 'mortar', 'LS'),
      upgrade(40, 150, 'B1', 0), place(43, 0, 'resonator', 'LN'),
      upgrade(48, 0, 'D', 0), place(53, 0, 'mine', 'E'),
      upgrade(60, 160, 'B1', 0), upgrade(67, 0, 'B1', 0),
      upgrade(76, 0, 'D', 0), upgrade(84, 0, 'LS', 1), upgrade(90, 0, 'U', 1),
    ]},
  {id: 'frugal-channel-control', modeId: 'half-cash', difficulty: 'extreme', seed: 531602, maxWave: 100, verified: false,
    counters: ['Needle at the shared junction fits a smaller starting purse',
      'Separate N/S anchors after early cash accumulation',
      'Tide leverages the water beside the bridge', 'Beacon counters cloak without portal or bank'],
    actions: [
      place(1, 0, 'needle', 'C'), upgrade(6, 0, 'C', 0),
      place(12, 0, 'frost', 'N'), place(19, 0, 'cannon', 'S'),
      upgrade(25, 0, 'S', 0), place(31, 0, 'scatter', 'U'),
      place(38, 0, 'tide', 'W1'), upgrade(44, 0, 'W1', 1),
      place(50, 0, 'beacon', 'D'), place(57, 0, 'rail', 'B1'),
      upgrade(63, 0, 'B1', 0), upgrade(68, 0, 'C', 0),
      place(72, 0, 'venom', 'B2'), upgrade(80, 130, 'B1', 0),
      place(85, 0, 'mine', 'E'), upgrade(90, 0, 'W1', 1), upgrade(97, 0, 'B1', 0),
    ]},
  {id: 'oath-no-economy', modeId: 'iron-oath', difficulty: 'extreme', seed: 531603, maxWave: 100, verified: false,
    counters: ['No sales, knowledge, farms, harvest or monetary abilities',
      'Frost and reveal before the bridge', 'Rail and Tesla counter hard layers',
      'Exit mine is a last contingency, not the main line'],
    actions: [
      place(1, 0, 'needle', 'C'), place(5, 0, 'cannon', 'N'),
      place(10, 0, 'frost', 'S'), upgrade(15, 0, 'N', 0),
      place(21, 0, 'tesla', 'D'), place(27, 0, 'rail', 'B1'),
      upgrade(33, 0, 'B1', 0), place(39, 0, 'beacon', 'B2'),
      place(46, 0, 'mirror', 'U'), upgrade(52, 0, 'D', 1),
      place(57, 0, 'venom', 'LN'), upgrade(60, 160, 'B1', 0),
      place(65, 0, 'mine', 'E'), upgrade(70, 0, 'S', 1),
      upgrade(77, 0, 'B1', 0), upgrade(85, 0, 'B1', 0), upgrade(94, 0, 'D', 1),
    ]},
];

/** Gross guaranteed income only: no pop cash, costs or purchases subtracted. */
export function guaranteedGrossCashBefore(wave: number, modeId: StrategyCandidate['modeId']): number {
  if (!Number.isInteger(wave) || wave < 1 || wave > 101) throw new RangeError('Wave must be 1..101');
  const n = wave - 1;
  const amount = 850 + 50 * n + n * (n + 1);
  return modeId === 'half-cash' ? amount / 2 : amount;
}
