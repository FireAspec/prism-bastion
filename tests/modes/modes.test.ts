import {describe,expect,it} from 'vitest';
import type {Difficulty,GameState,RuleModifiers} from '../../src/contracts';
import {
 applyKnowledgeLives,awardIncome,awardRoundReward,canActivateAbility,canGrantIncome,getDifficulties,getModes,
 modeRewardMultiplier,resolveRules,roundReward,startingCredits,waveWeather,
} from '../../src/modes';

const expected={
 easy:{rounds:40,lives:200,startCredits:1000,towerCostMul:.85,enemyHpMul:.85,rewardBase:100,rewardStep:5,rewardMul:.70},
 normal:{rounds:60,lives:150,startCredits:900,towerCostMul:1,enemyHpMul:1,rewardBase:80,rewardStep:4,rewardMul:1},
 hard:{rounds:80,lives:100,startCredits:850,towerCostMul:1.1,enemyHpMul:1.1,rewardBase:60,rewardStep:3,rewardMul:1.35},
 extreme:{rounds:100,lives:1,startCredits:850,towerCostMul:1.2,enemyHpMul:1.2,rewardBase:50,rewardStep:2,rewardMul:1.70},
} as const;

const rewardByMode:Record<string,number>={
 standard:1,'half-cash':1.6,'no-leaks':1.7,'iron-oath':2.25,
 'short-supply':1.45,blackout:1.4,stormfront:1.45,overdrive:1.5,
 'low-tech':1.5,'no-actives':1.35,
};

describe('difficulty and mode catalogs',()=>{
 it('ships the ten uniquely named modes, with accurate unlock requirements and rewards',()=>{
  const modes=getModes();
  expect(modes).toHaveLength(10);
  expect(new Set(modes.map(m=>m.id)).size).toBe(10);
  expect(modes.map(m=>m.id)).toEqual(Object.keys(rewardByMode));
  for(const mode of modes){
   expect(mode.name.length).toBeGreaterThan(3);
   expect(mode.description.length).toBeGreaterThan(55);
   expect(mode.requiresClear).toBe(mode.id!=='standard');
   expect(modeRewardMultiplier(mode.id)).toBe(rewardByMode[mode.id]);
  }
 });

 it('matches all four full numeric presets independently of the map geometry',()=>{
  const difficulties=getDifficulties();
  expect(difficulties.map(d=>d.id)).toEqual(['easy','normal','hard','extreme']);
  for(const difficulty of difficulties){
   const want=expected[difficulty.id];
   expect(difficulty).toMatchObject({
    rounds:want.rounds,lives:want.lives,startCredits:want.startCredits,
    towerCostMul:want.towerCostMul,enemyHpMul:want.enemyHpMul,
    roundRewardBase:want.rewardBase,roundRewardStep:want.rewardStep,
    popCashMul:1,rewardMul:want.rewardMul,
   });
   const rules=resolveRules('standard',difficulty.id,1);
   expect(rules.rounds).toBe(want.rounds);
   expect(rules.maxLives).toBe(want.lives);
   expect(roundReward(rules,1)).toBe(want.rewardBase+want.rewardStep);
   expect(roundReward(rules,want.rounds)).toBe(want.rewardBase+want.rewardStep*want.rounds);
   expect(startingCredits(difficulty.id,rules)).toBe(want.startCredits);
   expect(startingCredits({...difficulty,startCredits:1200},rules)).toBe(1200);
  }
  // No map difficulty parameter is consulted. A group-4 map can run on easy.
  expect(resolveRules('standard','easy',1).rounds).toBe(40);
  expect(resolveRules('standard','extreme',1).rounds).toBe(100);
 });

 it('resolves all 4 × 10 × 4 combinations reproducibly, with no shared mutable state',()=>{
  const modes=getModes(),difficulties=getDifficulties();
  let combinations=0;
  for(const difficulty of difficulties)for(const mode of modes)for(let players=1;players<=4;players++){
   const first=resolveRules(mode.id,difficulty.id,players);
   const second=resolveRules(mode.id,difficulty.id,players);
   const coop=1+.25*(players-1);
   expect(first).toEqual(second);
   expect(first.rounds).toBe(difficulty.rounds);
   expect(first.roundRewardBase).toBe(difficulty.roundRewardBase);
   expect(first.roundRewardStep).toBe(difficulty.roundRewardStep);
   expect(first.towerCostMul).toBe(difficulty.towerCostMul);
   expect(first.enemyHpMul).toBeCloseTo(difficulty.enemyHpMul*coop,12);
   expect(first.startingCashMul).toBeCloseTo((mode.id==='half-cash'?.5:1)*coop,12);
   expect(first.maxLives).toBe(mode.id==='no-leaks'||mode.id==='iron-oath'?1:difficulty.lives);
   expect(first.popCashMul).toBe(1);
   expect(first.maxTowers).toBe(mode.id==='short-supply'?12:60);
   expect(first.maxTier).toBe(mode.id==='low-tech'?3:5);
   expect(startingCredits(difficulty.id,first)).toBe(Math.floor(difficulty.startCredits*first.startingCashMul));
   expect(roundReward(first,9)).toBeCloseTo((difficulty.roundRewardBase+9*difficulty.roundRewardStep)*first.incomeMul,12);
   first.enemyHpMul=-1000;
   first.rounds=999;
   expect(resolveRules(mode.id,difficulty.id,players)).toEqual(second);
   combinations++;
  }
  expect(combinations).toBe(160);
 });

 it('keeps mode partial overrides and difficulty data independent of caller modifications',()=>{
  const modes=getModes();
  expect(modes.find(m=>m.id==='standard')?.modifiers).toEqual({});
  expect(modes.find(m=>m.id==='no-leaks')?.modifiers).toEqual({maxLives:1});
  modes[0].description='corrupted';
  modes[0].modifiers.rounds=1;
  const difficulty=getDifficulties();
  difficulty[0].rounds=1;
  expect(getModes()[0].modifiers).toEqual({});
  expect(getDifficulties()[0].rounds).toBe(40);
  expect(resolveRules('standard','easy',1).rounds).toBe(40);
 });
});

describe('strict rules and effect restrictions',()=>{
 it('preserves farms, knowledge and combat abilities in no-leaks, but forbids all bonus income in iron-oath',()=>{
  const noLeaks=resolveRules('no-leaks','hard',4);
  const iron=resolveRules('iron-oath','hard',4);
  expect(noLeaks).toMatchObject({maxLives:1,allowKnowledge:true,allowPassiveIncome:true,allowAbilities:true,sellAllowed:true});
  expect(iron).toMatchObject({maxLives:1,allowKnowledge:false,allowPassiveIncome:false,allowAbilities:true,sellAllowed:false});
  expect(noLeaks.rounds).toBe(iron.rounds);
  expect(noLeaks.roundRewardBase).toBe(iron.roundRewardBase);
  expect(noLeaks.towerCostMul).toBe(iron.towerCostMul);
  expect(noLeaks.enemyHpMul).toBe(iron.enemyHpMul);

  for(const source of ['layer','round','farm','interest','harvest','income-ability','bonus'] as const){
   expect(canGrantIncome('no-leaks',source)).toBe(true);
   expect(canGrantIncome('iron-oath',source)).toBe(source==='layer'||source==='round');
  }
  for(const ability of ['nova','overclock','meteor','rewind','barrier','mint'] as const){
   expect(canActivateAbility('no-leaks',ability)).toBe(true);
   expect(canActivateAbility('iron-oath',ability)).toBe(ability!=='mint');
   expect(canActivateAbility('no-actives',ability)).toBe(false);
  }
  expect(canGrantIncome('no-actives','income-ability')).toBe(false);
  expect(canGrantIncome('no-actives','farm')).toBe(true);
 });

 it('never exceeds one life with knowledge; caps normal bonuses at 20',()=>{
  for(const difficulty of ['easy','normal','hard','extreme'] as Difficulty[]){
   for(const mode of ['no-leaks','iron-oath','standard']){
    const base=resolveRules(mode,difficulty,1);
    const withBonus=applyKnowledgeLives(base,999);
    expect(withBonus.maxLives).toBe(base.maxLives===1?1:base.maxLives+20);
    expect(base.maxLives).toBe(resolveRules(mode,difficulty,1).maxLives);
   }
  }
  expect(()=>applyKnowledgeLives(resolveRules('standard','normal',1),-.5)).toThrow(RangeError);
 });

 it('enforces other mode effects without replacing unrelated rules',()=>{
  const standard=resolveRules('standard','normal',1);
  expect(resolveRules('short-supply','normal',4).maxTowers).toBe(12);
  expect(resolveRules('low-tech','normal',1).maxTier).toBe(3);
  expect(resolveRules('blackout','normal',1).weather).toBe('fog');
  expect(resolveRules('stormfront','normal',1).weather).toBe('alternating');
  expect(resolveRules('no-actives','normal',1).allowAbilities).toBe(false);
  expect(resolveRules('overdrive','normal',1)).toMatchObject({enemySpeedMul:1.35,incomeMul:1.1});
  expect(standard).toMatchObject({enemySpeedMul:1,incomeMul:1,sellAllowed:true,maxTowers:60,maxTier:5,allowAbilities:true});
 });
});

describe('economy, weather and bad inputs',()=>{
 it('halves every credit stream using the shared fractional-credit accumulator',()=>{
  const half=resolveRules('half-cash','normal',1);
  expect(startingCredits('normal',half)).toBe(450);
  expect(roundReward(half,1)).toBe(42);
  const state={options:{modeId:'half-cash'},rules:half,credits:0,time:0,nextEvent:0,events:[],stats:{earned:0,cashSubunits:0}} as unknown as GameState;
  for(const source of ['layer','farm','interest','harvest','income-ability','bonus'] as const){
   expect(canGrantIncome('half-cash',source)).toBe(true);
   const paid=awardIncome(state,source,1);
   expect(paid).toBe(source==='layer'||source==='interest'||source==='income-ability'?0:1);
  }
  expect(state.credits).toBe(3);
  expect(state.stats.cashSubunits).toBe(0);
  const restored=structuredClone(state);
  awardIncome(restored,'layer',1);
  expect(restored.stats.cashSubunits).toBe(50);
  awardIncome(restored,'layer',1);
  expect(restored.credits).toBe(4);
  expect(awardRoundReward(restored,1)).toBe(42);
  expect(restored.credits).toBe(46);
  // No separate multiplier is hidden in popCashMul.
  expect(half.popCashMul).toBe(1);
 });

 it('performs no mutation for banned bonus income, but pays base layers and waves in iron-oath',()=>{
  const iron=resolveRules('iron-oath','normal',1);
  const state={options:{modeId:'iron-oath'},rules:iron,credits:0,time:0,nextEvent:0,events:[],stats:{earned:0,cashSubunits:0}} as unknown as GameState;
  const before=structuredClone(state);
  for(const source of ['farm','interest','harvest','income-ability','bonus'] as const)expect(awardIncome(state,source,500)).toBe(0);
  expect(state).toEqual(before);
  expect(awardIncome(state,'layer',1)).toBe(1);
  expect(awardRoundReward(state,2)).toBe(88);
  expect(state.credits).toBe(89);
  expect(state.events).toHaveLength(2);
  expect(()=>awardIncome(state,'layer',-1)).toThrow(RangeError);
  expect(()=>awardIncome(state,'layer',Infinity)).toThrow(RangeError);
 });

 it('changes weather exactly every five waves based on seed, not clock',()=>{
  const storm=resolveRules('stormfront','easy',1);
  for(const seed of [0,1,987654321,-12345,2**32+1]){
   const phase=waveWeather(storm,1,seed);
   expect(waveWeather(storm,5,seed)).toBe(phase);
   expect(waveWeather(storm,6,seed)).not.toBe(phase);
   expect(waveWeather(storm,10,seed)).toBe(waveWeather(storm,6,seed));
   expect(waveWeather(storm,11,seed)).toBe(phase);
   expect(waveWeather(storm,100,seed)).toBe(waveWeather(storm,96,seed));
   expect(waveWeather(storm,1,seed)).toBe(phase);
  }
  expect(waveWeather(storm,1,0)).not.toBe(waveWeather(storm,1,1));
  expect(waveWeather(resolveRules('blackout','hard',1),18,0)).toBe('fog');
  expect(waveWeather(resolveRules('standard','hard',1),18,0)).toBe('clear');
 });

 it('rejects invalid modes, player counts, weather data, and waves',()=>{
  for(const invalid of ['', 'paid-boosts','standard+iron-oath']){
   expect(()=>resolveRules(invalid,'normal',1)).toThrow(RangeError);
   expect(()=>modeRewardMultiplier(invalid)).toThrow(RangeError);
  }
  expect(()=>resolveRules('standard','impossible' as Difficulty,1)).toThrow(RangeError);
  for(const count of [0,5,1.5,NaN,Infinity,-1])expect(()=>resolveRules('standard','easy',count)).toThrow(RangeError);
  const rules:RuleModifiers=resolveRules('stormfront','hard',1);
  for(const wave of [0,-3,1.5,NaN,Infinity]){
   expect(()=>roundReward(rules,wave)).toThrow(RangeError);
   expect(()=>waveWeather(rules,wave,12)).toThrow(RangeError);
  }
  expect(()=>waveWeather(rules,1,1.2)).toThrow(RangeError);
  expect(()=>canGrantIncome('standard','unknown' as 'layer')).toThrow(RangeError);
  expect(()=>canActivateAbility('standard','paid' as 'mint')).toThrow(RangeError);
 });
});
