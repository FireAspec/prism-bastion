import type { EnemyState, GameState, GameEvent } from '../../../src/contracts';
export function enemy(id: string, defId = 'scarlet'): EnemyState {
  return { id, defId, lane: 0, progress: 0, pos: { x: 0, y: 0 }, hp: 100, maxHp: 100, shield: 20, maxShield: 20, statuses: [], memory: {}, bountyPaid: false, generation: 0, paidLayers: [] };
}
export function state(enemies: EnemyState[] = []): GameState {
  return { version: 1, options: { mapId: 'fixture', difficulty: 'normal', seed: 1, endless: false, modeId: 'standard', unlockedTowers: [], players: [], runId: 'fixture', knowledge: [] }, phase: 'wave', time: 0, tick: 0, rng: 1, nextEntity: 1, nextEvent: 1, credits: 900, lives: 150, wave: 1, waveTime: 0, spawnCursor: [], paused: false, speed: 1, autoStart: false, towers: [], enemies, events: [], projectiles: [], strikes: [], rules: { incomeMul: 1, startingCashMul: 1, enemyHpMul: 1, enemySpeedMul: 1, towerCostMul: 1, sellAllowed: true, maxLives: 150, allowAbilities: true, allowPassiveIncome: true, maxTowers: 60, maxTier: 5, weather: 'none', allowKnowledge: true, rounds: 60, roundRewardBase: 80, roundRewardStep: 4, popCashMul: 1 }, stats: { spent: 0, earned: 0, kills: 0, damage: 0, leaks: 0, abilities: 0, cashSubunits: 0 } };
}
export function event(s: GameState, kind: GameEvent['kind'], target: string, pos = { x: 4, y: 7 }, extra: Partial<GameEvent> = {}): GameEvent {
  return { id: s.nextEvent++, time: s.time, kind, target, pos, ...extra };
}
export function advance(s: GameState, dt: number): void { s.time += dt * s.speed; s.tick += Math.max(1, Math.round(dt * s.speed * 60)); }

import type { EnemyDef, GameConfig, MapDef } from '../../../src/contracts';
export function fixtureConfig(ids: readonly string[], maps: MapDef[] = []): Pick<GameConfig,'enemies'|'maps'> {
  const colors = ['#e95b62','#e6a13c','#e7de65','#60b98a','#5bb8df','#aa84df','#a4b7c0','#a8e5e8','#8c86b0','#8ed49a','#83d9e7','#ed9d6a','#dc5474','#b3e9ff','#c58351','#827d9f','#e6c96a','#e5b1ea','#7da7dd','#d8b45b','#c1a6da','#e4b3df','#b4a096','#dfb16b','#bfb59a','#e2a2a4','#b3dce8','#d7bf79','#8bc6e5','#d2a9dc'];
  const enemies: EnemyDef[] = ids.map((id,i)=>({id,name:id,description:'Fixture',color:colors[i%colors.length],shape:'diamond',hp:100,speed:50,bounty:3,leak:1,radius:14,armor:0,shield:20,regen:0,cloaked:false,flying:id==='dart',resist:{},children:['glass','split','royal','prismatic'].includes(id)?[{id:'scarlet',count:2}]:[],layers:[{hp:30,cash:1,color:colors[i%colors.length]},{hp:30,cash:1,color:'#cfdbaf'},{hp:40,cash:1,color:'#93b2e0'}]}));
  return {enemies,maps};
}
