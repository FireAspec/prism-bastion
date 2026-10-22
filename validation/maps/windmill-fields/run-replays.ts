/**
 * Strictly ordered, deterministic v1 replay adapter for the central engine.
 * `--static` validates candidate metadata without claiming a simulated win.
 * `--simulate` (or no flag) runs the real engine; stubs fail explicitly.
 */
import {readFileSync} from 'node:fs';
import {createGame} from '../../../src/engine';
import {createCombat} from '../../../src/combat';
import {loadContent} from '../../../src/content';
import {getMap} from '../../../src/content/maps/windmill-fields';
import type {GameCommand,GameEngine,PathIndex,PlayerInfo,Vec} from '../../../src/contracts';
import {canPlaceLand} from './geometry';

export const ALLOWED_TOWERS = [
 'needle','cannon','frost','beacon','scatter','ember','saw','venom',
] as const;
const BASE_COSTS:Record<string,number>={
 needle:250,cannon:550,frost:500,beacon:600,
 scatter:425,ember:600,saw:650,venom:650,
};
const TICKS_PER_SECOND=60;
const MAX_TICKS_PER_WAVE=50_000;

type PlaceAction={beforeWave:number;tick:number;type:'place';slot:string;tower:string;pos:Vec};
type UpgradeAction={beforeWave:number;tick:number;type:'upgrade';slot:string;path:PathIndex};
export type ReplayAction=PlaceAction|UpgradeAction;
export type ReplayScenario={
 id:string;modeId:'standard'|'half-cash'|'iron-oath';difficulty:'easy';seed:number;
 expected:{won:null|boolean;endingLives:number|null;endingCredits:number|null;note:string};
 actions:ReplayAction[];
};
type ReplaySet={
 version:number;mapId:string;verification:string;verificationReason:string;
 profile:{unlockedTowers:string[];knowledge:string[];players:PlayerInfo[]};
 scenarios:ReplayScenario[];
};
export const REPLAYS=JSON.parse(readFileSync(new URL('./replays.json',import.meta.url),'utf8')) as ReplaySet;

/** Base placement prices. Not an assertion about pending upgrade pathFactors. */
export function baseCostEasy(tower:string):number {
 const base=BASE_COSTS[tower];
 if(!base)throw new Error(`Unknown first-visit tower: ${tower}`);
 return Math.ceil(base*.85);
}
export function guaranteedRoundIncome(beforeWave:number,halfCash:boolean):number {
 const n=beforeWave-1;
 // The actual engine keeps fractional pop earnings in hundredths of a credit;
 // this report excludes all pop earnings and ignores upgrades altogether.
 return Math.floor((n*100+5*n*(n+1)/2)*(halfCash?.5:1));
}
export interface StaticBudgetPoint {
 beforeWave:number;guaranteedRoundRewards:number;estimatedSpentOnBasePlacements:number;
 baseOnlyFloor:number;requiresLayerIncomeOrUpgradeAccounting:boolean;
}
export function staticBudget(scenario:ReplayScenario):StaticBudgetPoint[] {
 const out:StaticBudgetPoint[]=[];
 let placed=0;
 const groups=new Map<number,ReplayAction[]>();
 for(const action of scenario.actions){
  const values=groups.get(action.beforeWave)??[];values.push(action);groups.set(action.beforeWave,values);
 }
 for(const [beforeWave,actions] of [...groups.entries()].sort((a,b)=>a[0]-b[0])){
  placed+=actions.filter((a):a is PlaceAction=>a.type==='place').reduce((n,a)=>n+baseCostEasy(a.tower),0);
  const roundRewards=guaranteedRoundIncome(beforeWave,scenario.modeId==='half-cash');
  const initial=scenario.modeId==='half-cash'?500:1000;
  const baseOnlyFloor=initial+roundRewards-placed;
  out.push({beforeWave,guaranteedRoundRewards:roundRewards,
   estimatedSpentOnBasePlacements:placed,baseOnlyFloor,
   requiresLayerIncomeOrUpgradeAccounting:baseOnlyFloor<0||actions.some(a=>a.type==='upgrade')});
 }
 return out;
}

export function validateStaticReplay(set=REPLAYS):string[] {
 const errors:string[]=[];
 const allowed=new Set<string>(ALLOWED_TOWERS);
 const map=getMap();
 if(set.version!==1||set.mapId!==map.id)errors.push('Wrong replay version or map ID');
 if(set.verification!=='unverified')errors.push('Fixture must remain unverified until central simulation confirms it');
 if(set.profile.knowledge.length!==0)errors.push('Baseline profile must have no knowledge');
 if([...set.profile.unlockedTowers].sort().join(',')!==[...allowed].sort().join(','))
  errors.push('First-visit tower list has missing or future technology');
 if(set.profile.players.length!==1)errors.push('Baseline scenarios require exactly one solo player');
 if(set.scenarios.length!==3||new Set(set.scenarios.map(s=>s.modeId)).size!==3)
  errors.push('Expected three distinct standard/half-cash/iron-oath scenarios');
 for(const scenario of set.scenarios){
  if(scenario.expected.won!==null||scenario.expected.endingLives!==null||scenario.expected.endingCredits!==null)
   errors.push(`${scenario.id}: expected outcomes must be null before real replay`);
  if(scenario.difficulty!=='easy'||!Number.isSafeInteger(scenario.seed))
   errors.push(`${scenario.id}: invalid difficulty/seed`);
  let previousWave=0,previousTick=0,spentAtStart=0;
  const slots=new Set<string>(),points:Vec[]=[];
  for(const action of scenario.actions){
   if(!Number.isInteger(action.beforeWave)||action.beforeWave<1||action.beforeWave>40||
     !Number.isInteger(action.tick)||action.tick<0||action.tick>MAX_TICKS_PER_WAVE)
    errors.push(`${scenario.id}: invalid action schedule`);
   if(action.beforeWave<previousWave||(action.beforeWave===previousWave&&action.tick<previousTick))
    errors.push(`${scenario.id}: actions are out of order`);
   previousWave=action.beforeWave;previousTick=action.tick;
   if(action.type==='place'){
    if(!allowed.has(action.tower))errors.push(`${scenario.id}: future/unknown tower ${action.tower}`);
    if(slots.has(action.slot))errors.push(`${scenario.id}: slot ${action.slot} reused`);
    if(!canPlaceLand(action.pos,30,map))errors.push(`${scenario.id}: invalid footprint at ${action.slot}`);
    if(points.some(p=>Math.hypot(p.x-action.pos.x,p.y-action.pos.y)<60))
     errors.push(`${scenario.id}: overlapping footprints at ${action.slot}`);
    points.push(action.pos);slots.add(action.slot);
    if(action.beforeWave===1)spentAtStart+=baseCostEasy(action.tower);
   }else if(!slots.has(action.slot)||![0,1,2].includes(action.path)){
    errors.push(`${scenario.id}: upgrade before placement or bad branch at ${action.slot}`);
   }
  }
  if(spentAtStart>(scenario.modeId==='half-cash'?500:1000))
   errors.push(`${scenario.id}: wave-1 buildings exceed initial credits`);
  if(scenario.modeId==='iron-oath'&&scenario.actions.some(a=>a.type!=='place'&&a.type!=='upgrade'))
   errors.push('Iron-oath cannot sell or use income powers');
 }
 return errors;
}

function send(engine:GameEngine,command:GameCommand,context:string):string|undefined {
 const result=engine.dispatch(command);
 if(!result.ok)throw new Error(`${context}: rejected (${result.reason??'unknown'})`);
 return result.entity;
}

export function runScenario(scenario:ReplayScenario):{
 scenario:string;won:boolean;wave:number;lives:number;credits:number;spent:number;earned:number;
 checkpoints:{wave:number;lives:number;credits:number}[];
} {
 const config=loadContent(); // fails honestly on the frozen foundation branch
 const options={
  mapId:'windmill-fields',difficulty:'easy' as const,seed:scenario.seed,
  endless:false,modeId:scenario.modeId,unlockedTowers:[...ALLOWED_TOWERS],
  players:REPLAYS.profile.players.map(p=>({...p})),
  knowledge:[] as string[],runId:`map40-${scenario.id}-${scenario.seed}`,
 };
 const engine=createGame(config,options,createCombat());
 const slots=new Map<string,string>();
 const checkpoints:{wave:number;lives:number;credits:number}[]=[];
 const action=(a:ReplayAction)=>{
  if(a.type==='place'){
   const id=send(engine,{type:'place',tower:a.tower,pos:{...a.pos},actor:'solo'},
    `${scenario.id} wave ${a.beforeWave} tick ${a.tick} place ${a.slot}`);
   if(!id)throw new Error(`Engine did not return placed tower id for ${a.slot}`);
   slots.set(a.slot,id);
  }else{
   const id=slots.get(a.slot);
   if(!id)throw new Error(`No entity for slot ${a.slot}`);
   send(engine,{type:'upgrade',tower:id,path:a.path,actor:'solo'},
    `${scenario.id} wave ${a.beforeWave} tick ${a.tick} upgrade ${a.slot}`);
  }
 };
 for(let wave=1;wave<=40;wave++){
  const before=engine.getSnapshot();
  if(before.phase!=='build'||before.wave!==wave-1)
   throw new Error(`Wave ${wave}: expected build after ${wave-1}, got ${before.phase}/${before.wave}`);
  const actions=scenario.actions.filter(a=>a.beforeWave===wave);
  for(const a of actions.filter(a=>a.tick===0))action(a);
  send(engine,{type:'startWave',actor:'solo'},`${scenario.id} start wave ${wave}`);
  let stopped=false;
  for(let tick=1;tick<=MAX_TICKS_PER_WAVE;tick++){
   engine.step(1/TICKS_PER_SECOND);
   for(const a of actions.filter(a=>a.tick===tick))action(a);
   const current=engine.getSnapshot();
   if(current.phase==='defeat'){
    checkpoints.push({wave,lives:current.lives,credits:current.credits});
    return {scenario:scenario.id,won:false,wave,lives:current.lives,credits:current.credits,
     spent:current.stats.spent,earned:current.stats.earned,checkpoints};
   }
   if(current.phase==='victory'||current.phase==='build'){
    if(actions.some(a=>a.tick>tick))throw new Error(`${scenario.id}: action after wave ${wave} ended`);
    checkpoints.push({wave,lives:current.lives,credits:current.credits});
    stopped=true;
    if(current.phase==='victory'){
     if(wave!==40)throw new Error(`${scenario.id}: premature victory at wave ${wave}`);
     return {scenario:scenario.id,won:true,wave,lives:current.lives,credits:current.credits,
      spent:current.stats.spent,earned:current.stats.earned,checkpoints};
    }
    break;
   }
  }
  if(!stopped)throw new Error(`${scenario.id}: wave ${wave} exceeded ${MAX_TICKS_PER_WAVE} ticks`);
 }
 const final=engine.getSnapshot();
 throw new Error(`${scenario.id}: 40 waves passed but final phase=${final.phase}; no victory event`);
}

const isEntry=process.argv[1]?.endsWith('/run-replays.ts');
if(isEntry){
 const errors=validateStaticReplay();
 if(errors.length){process.stderr.write(`STATIC FAIL:\n${errors.join('\n')}\n`);process.exitCode=1;}
 else{
  process.stdout.write('STATIC PASS: fixtures structurally valid; victory still unverified.\n');
  for(const scenario of REPLAYS.scenarios){
   const budget=staticBudget(scenario);
   process.stdout.write(`${scenario.id}: base-only budget ${JSON.stringify(budget)}\n`);
  }
  if(!process.argv.includes('--static')){
   for(const scenario of REPLAYS.scenarios){
    try{
     const result=runScenario(scenario);
     process.stdout.write(`SIMULATION ${JSON.stringify(result)}\n`);
     if(!result.won)process.exitCode=1;
    }catch(error){
     process.stderr.write(`NOT VERIFIED (${scenario.id}): ${String(error)}\n`);
     process.exitCode=2;
    }
   }
  }
 }
}
