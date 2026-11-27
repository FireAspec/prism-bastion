import type {EconomyConfig} from '../contracts';

export function getEconomy(): EconomyConfig {
  return {
    xpCurve: [200, 40, 5], maxRewardLevel: 51, pointsPerLevel: 3,
    mapXP: [250, 400, 600, 900], mapSeals: [80, 120, 180, 260],
    modeReward: {standard: 1, 'half-cash': 1.6, 'no-leaks': 1.7, 'iron-oath': 2.25,
      'short-supply': 1.45, blackout: 1.4, stormfront: 1.45, overdrive: 1.5,
      'low-tech': 1.5, 'no-actives': 1.35},
    firstClearXP: 1.5, repeatXP: .65, repeatSeals: .35, defeatXP: .35, respecCost: 200,
  };
}
