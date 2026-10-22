import type {AbilityDef,Difficulty,DifficultyDef,GameState,ModeDef,RuleModifiers} from '../contracts';
import {credit} from '../contracts/runtime';
import {DIFFICULTIES,MODES,MODE_REWARDS} from './catalog';

export type IncomeSource = 'layer'|'round'|'farm'|'interest'|'harvest'|'income-ability'|'bonus';
export type WaveWeather = 'clear'|'wet'|'fog';

const COOP_MULTIPLIERS = [1,1.25,1.5,1.75] as const;
const INCOME_SOURCES:readonly IncomeSource[] = ['layer','round','farm','interest','harvest','income-ability','bonus'];

function requireMode(modeId:string):Readonly<ModeDef> {
 const mode=MODES.find(entry=>entry.id===modeId);
 if(!mode)throw new RangeError(`Unknown mode: ${modeId}`);
 return mode;
}

function requireDifficulty(difficulty:Difficulty):Readonly<DifficultyDef> {
 const definition=DIFFICULTIES.find(entry=>entry.id===difficulty);
 if(!definition)throw new RangeError(`Unknown difficulty: ${difficulty}`);
 return definition;
}

/** Every call gives the caller fresh, independently editable data. */
export function getModes():ModeDef[] {
 return MODES.map(mode=>({...mode,modifiers:{...mode.modifiers}}));
}

export function getDifficulties():DifficultyDef[] {
 return DIFFICULTIES.map(difficulty=>({...difficulty}));
}

/**
 * Run difficulty -> partial mode overrides; co-op's fixed factors are included.
 * Progression may subsequently apply knowledge to a fresh run configuration.
 * Maps deliberately have no input: their 1..4 rating describes geometry only.
 * The returned object is mutable by its owner without changing the catalog.
 */
export function resolveRules(modeId:string,difficulty:Difficulty,players:number):RuleModifiers {
 const mode=requireMode(modeId);
 const selected=requireDifficulty(difficulty);
 if(!Number.isInteger(players)||players<1||players>4)throw new RangeError('Players must be an integer from 1 to 4');

 const base:RuleModifiers={
  incomeMul:1,startingCashMul:1,enemyHpMul:selected.enemyHpMul,enemySpeedMul:1,
  towerCostMul:selected.towerCostMul,sellAllowed:true,maxLives:selected.lives,
  allowAbilities:true,allowPassiveIncome:true,maxTowers:60,maxTier:5,
  weather:'none',allowKnowledge:true,rounds:selected.rounds,
  roundRewardBase:selected.roundRewardBase,roundRewardStep:selected.roundRewardStep,
  popCashMul:selected.popCashMul,
 };
 const rules={...base,...mode.modifiers};
 const coop=COOP_MULTIPLIERS[players-1];
 rules.startingCashMul*=coop;
 rules.enemyHpMul*=coop;
 return rules;
}

/** Apply this once after picking the mode, before the engine starts the run. */
export function applyKnowledgeLives(rules:RuleModifiers,lifeBonus:number):RuleModifiers {
 if(!Number.isSafeInteger(lifeBonus)||lifeBonus<0)throw new RangeError('Invalid knowledge life bonus');
 const allowed=rules.allowKnowledge&&rules.maxLives>1?Math.min(lifeBonus,20):0;
 return {...rules,maxLives:rules.maxLives+allowed};
}

/**
 * Whole credits at the start; co-op and mode coefficients are rounded only once.
 * A DifficultyDef object may be passed after progression has applied knowledge.
 */
export function startingCredits(difficulty:Difficulty|Pick<DifficultyDef,'startCredits'>,rules:RuleModifiers):number {
 const base=typeof difficulty==='string'?requireDifficulty(difficulty).startCredits:difficulty.startCredits;
 const credits=base*rules.startingCashMul;
 if(!Number.isFinite(credits)||credits<0)throw new RangeError('Invalid starting credits');
 return Math.floor(credits);
}

/** May be fractional: pass directly to runtime.credit to retain hundredths. */
export function roundReward(rules:RuleModifiers,wave:number):number {
 if(!Number.isSafeInteger(wave)||wave<1)throw new RangeError('Invalid wave number');
 const amount=(rules.roundRewardBase+rules.roundRewardStep*wave)*rules.incomeMul;
 if(!Number.isFinite(amount)||amount<0)throw new RangeError('Invalid round reward');
 return amount;
}

/** Progression uses the mode and difficulty multipliers once per eligible result. */
export function modeRewardMultiplier(modeId:string):number {
 requireMode(modeId);
 return MODE_REWARDS[modeId];
}

/** Only the normal layer and round budget survives iron-oath. */
export function canGrantIncome(modeId:string,source:IncomeSource):boolean {
 const mode=requireMode(modeId);
 if(!(INCOME_SOURCES as readonly string[]).includes(source))throw new RangeError(`Unknown income source: ${source}`);
 if(mode.id==='iron-oath')return source==='layer'||source==='round';
 if(mode.modifiers.allowAbilities===false&&source==='income-ability')return false;
 return true;
}

/**
 * Authoritative payment gateway for combat and engine income. `baseAmount`
 * must be unmodified by difficulty/mode multipliers. Fractional sums pass
 * into frozen runtime.credit, which persists hundredths in state.stats.
 * Forbidden income sources leave the state untouched, including events.
 */
export function awardIncome(state:GameState,source:IncomeSource,baseAmount:number):number {
 if(!Number.isFinite(baseAmount)||baseAmount<0)throw new RangeError('Invalid income amount');
 if(!canGrantIncome(state.options.modeId,source))return 0;
 const multiplier=state.rules.incomeMul*(source==='layer'?state.rules.popCashMul:1);
 const result=baseAmount*multiplier;
 if(!Number.isFinite(result)||result<0)throw new RangeError('Invalid income multiplier');
 return credit(state,result);
}

/** Exactly one wave-completion payout; never also pay WaveDef.reward. */
export function awardRoundReward(state:GameState,wave:number):number {
 if(!Number.isSafeInteger(wave)||wave<1)throw new RangeError('Invalid wave number');
 const base=state.rules.roundRewardBase+state.rules.roundRewardStep*wave;
 return awardIncome(state,'round',base);
}

/** Iron-oath forbids only the mint (money) ability, not combat actives. */
export function canActivateAbility(modeId:string,kind:AbilityDef['kind']):boolean {
 const mode=requireMode(modeId);
 if(!['nova','overclock','meteor','rewind','barrier','mint'].includes(kind))throw new RangeError(`Unknown ability kind: ${kind}`);
 return mode.modifiers.allowAbilities!==false&&(mode.id!=='iron-oath'||kind!=='mint');
}

/** The seed decides the first 5-wave block; following blocks flip wet/dry. */
export function waveWeather(rules:RuleModifiers,wave:number,seed:number):WaveWeather {
 if(!Number.isSafeInteger(wave)||wave<1)throw new RangeError('Invalid wave number');
 if(!Number.isSafeInteger(seed))throw new RangeError('Invalid weather seed');
 if(rules.weather==='fog')return 'fog';
 if(rules.weather==='none')return 'clear';
 if(rules.weather==='alternating') {
  const block=Math.floor((wave-1)/5);
  return (((seed>>>0)&1)^(block%2))===0?'wet':'clear';
 }
 throw new RangeError(`Unknown weather: ${rules.weather}`);
}
