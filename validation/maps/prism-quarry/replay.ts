/** Deterministic candidate inputs for the future real-engine replay runner.
 * Nothing here is evidence of victory. No test double mints currency. */
import type {GameEngine,PathIndex,RunOptions,Vec} from '../../../src/contracts';
import {SITES} from './geometry';

export const FIRST_ARRIVAL_TOWERS=[
 'needle','cannon','frost','beacon','scatter','ember','saw','venom',
 'rail','tesla','mortar','observatory','mint','orchard','drone','rocket',
 'resonator','forge','harbor','tide','coral','chrono','gravity',
] as const;

export type ReplayAction=
 | {wave:number;tick:number;kind:'place';alias:string;tower:string;site:string}
 | {wave:number;tick:number;kind:'upgrade';alias:string;path:PathIndex}
 | {wave:number;tick:number;kind:'target';alias:string;targeting:'first'|'strong'|'near'|'last'};
export interface ReplayPlan{
 id:string;description:string;mode:'standard'|'half-cash'|'iron-oath';difficulty:'hard';seed:number;
 verification:{status:'unverified';reason:string};actions:ReplayAction[];contingencies:string[];
}
const P=(wave:number,alias:string,tower:string,site:string,tick=0):ReplayAction=>({wave,tick,kind:'place',alias,tower,site});
const U=(wave:number,alias:string,path:PathIndex,tick=0):ReplayAction=>({wave,tick,kind:'upgrade',alias,path});
const T=(wave:number,alias:string,targeting:'first'|'strong'|'near'|'last',tick=0):ReplayAction=>({wave,tick,kind:'target',alias,targeting});
const reason='Combat, towers, global wave catalog and complete engine are placeholders at pinned base; no battle has been run.';

export const REPLAY_PLANS:readonly ReplayPlan[]=[
 {
  id:'quarry-standard-crossfire',mode:'standard',difficulty:'hard',seed:5013501,
  description:'Cross-lane frost/needle control with northern artillery and southern rocket reserve.',
  verification:{status:'unverified',reason},
  actions:[
   P(0,'bridge','needle','saddle'),P(0,'slow','frost','hinge'),
   P(5,'south-guard','needle','south-entry'),P(11,'south-flak','scatter','south'),
   P(18,'final-gun','cannon','gate'),U(23,'bridge',1),
   P(25,'watch','observatory','north'),P(30,'north-guard','needle','north-cut'),
   P(33,'south-rockets','rocket','south-reserve'),T(34,'final-gun','strong'),
   P(39,'ridge-coil','tesla','north-ridge'),U(43,'final-gun',0),
   P(51,'upper-rail','rail','upper-east'),U(61,'south-rockets',1),
   U(68,'upper-rail',1),U(73,'slow',2),
  ],
  contingencies:[
   'If a hidden unit arrives before observatory, bring detection forward and postpone damage upgrades.',
   'For northern boss leaks, reinforce cannon/rail boss paths without stripping the southern defense.',
   'Fast darts require dedicated short-lane fire; no assumed passive income or extra funds.',
  ],
 },
 {
  id:'quarry-half-cash-split',mode:'half-cash',difficulty:'hard',seed:5013502,
  description:'Half credits: staggered needles, late frost, short-lane spread and splash.',
  verification:{status:'unverified',reason},
  actions:[
   P(0,'bridge','needle','saddle'),P(7,'south-guard','needle','south-entry'),
   P(17,'slow','frost','hinge'),U(20,'bridge',1),
   P(26,'south-flak','scatter','south'),P(34,'final-gun','cannon','gate'),
   P(43,'watch','observatory','north'),U(49,'south-guard',0),
   P(58,'south-rockets','rocket','south-reserve'),
   P(65,'ridge-coil','tesla','north-ridge'),U(70,'final-gun',0),
   U(76,'south-rockets',1),
  ],
  contingencies:[
   'If south fast enemies overwhelm a lone needle, shift the second purchase earlier only if real layer cash pays for it.',
   'The runner must preserve fractional subunit credit accounting; do not round individual cash layers upward.',
   'Skip early farms: buy the second lane footprint before optional income.',
  ],
 },
 {
  id:'quarry-iron-oath-battery',mode:'iron-oath',difficulty:'hard',seed:5013503,
  description:'No sales, knowledge, farms or leaks. Mixed armor-piercing and exit-area control.',
  verification:{status:'unverified',reason},
  actions:[
   P(0,'bridge','needle','saddle'),P(0,'slow','frost','hinge'),
   P(5,'south-guard','needle','south-entry'),P(11,'south-flak','scatter','south'),
   P(18,'final-gun','cannon','gate'),U(23,'bridge',1),
   P(26,'ridge-rail','rail','north-ridge'),T(27,'ridge-rail','strong'),
   P(32,'watch','observatory','north'),P(39,'south-rockets','rocket','south-reserve'),
   U(46,'final-gun',0),U(52,'ridge-rail',1),P(60,'north-guard','needle','north-cut'),
   U(63,'south-guard',1),U(72,'south-rockets',1),U(78,'slow',2),
  ],
  contingencies:[
   'One leak means defeat; keep both exits defended even during bosses.',
   'Use observatory detection and rail/rocket versus shields and armor.',
   'Never sell or use money-generating towers or permanent profile bonuses.',
  ],
 },
];

export function validateReplayPlan(plan:ReplayPlan):string[]{
 const errors:string[]=[];const aliases=new Set<string>();
 const occupied:{pos:Vec;radius:number}[]=[];let lastWave=0,lastTick=0;
 if(plan.verification.status!=='unverified')errors.push('Replay prematurely marked as verified');
 for(const action of plan.actions){
  if(action.wave<lastWave||action.wave===lastWave&&action.tick<lastTick)errors.push('Non-chronological action');
  if(action.wave<0||action.wave>80||!Number.isInteger(action.tick)||action.tick<0)errors.push('Invalid wave/tick');
  lastWave=action.wave;lastTick=action.tick;
  if(action.kind==='place'){
   if(!FIRST_ARRIVAL_TOWERS.some(t=>t===action.tower))errors.push(`Locked tower ${action.tower}`);
   if(aliases.has(action.alias))errors.push(`Duplicate tower alias ${action.alias}`);
   const site=SITES.find(s=>s.id===action.site);
   if(!site||site.placement!=='land')errors.push(`Invalid site ${action.site}`);
   if(site){
    if(occupied.some(o=>Math.hypot(o.pos.x-site.pos.x,o.pos.y-site.pos.y)<o.radius+site.radius))errors.push(`Overlapping tower ${action.site}`);
    occupied.push({pos:site.pos,radius:site.radius});
   }
   aliases.add(action.alias);
  }else if(!aliases.has(action.alias))errors.push(`Unknown tower alias ${action.alias}`);
 }
 return errors;
}

const BASE_PRICES:Readonly<Record<string,number>>={needle:250,frost:500,cannon:550,scatter:425,observatory:650,rocket:1000,tesla:800,rail:950};
/** Lower bound counting only completed-round rewards and base tower purchases.
 * Upgrade costs and enemy layer cash are intentionally excluded, so this is
 * NOT proof of full-action affordability or victory. */
export function placementBudgetFloor(plan:ReplayPlan):Array<{wave:number;site:string;tower:string;cost:number;availableBefore:number;remaining:number}>{
 const mul=plan.mode==='half-cash'?.5:1;const initial=Math.floor(850*mul);let spent=0;
 const transactions:Array<{wave:number;site:string;tower:string;cost:number;availableBefore:number;remaining:number}>=[];
 for(const action of plan.actions){
  if(action.kind!=='place')continue;
  const n=Math.max(0,action.wave-1);
  const availableBefore=initial+Math.floor((60*n+3*n*(n+1)/2)*mul)-spent;
  const cost=Math.ceil((BASE_PRICES[action.tower]??Infinity)*1.1);
  transactions.push({wave:action.wave,site:action.site,tower:action.tower,cost,availableBefore,remaining:availableBefore-cost});
  spent+=cost;
 }
 return transactions;
}

export interface ReplayResult{
 plan:string;status:'passed'|'failed';victory:boolean;waves:number;
 lives:number;credits:number;lastTick:number;reason:string;actionsAttempted:number;
}

/** Uses *only* a supplied real engine: denied purchases, defeats, missing IDs
 * and timeouts are failures, never skipped actions. No artificial funds. */
export function executeReplay(plan:ReplayPlan,createEngine:(options:RunOptions)=>GameEngine):ReplayResult{
 const issues=validateReplayPlan(plan);if(issues.length)throw Error(issues.join('; '));
 const options:RunOptions={mapId:'prism-quarry',difficulty:'hard',seed:plan.seed,endless:false,modeId:plan.mode,
  unlockedTowers:[...FIRST_ARRIVAL_TOWERS],players:[{id:'solo',name:'Player',color:'#86dfdc',connected:true}],
  runId:`validation-${plan.id}-${plan.seed}`,knowledge:[]};
 const engine=createEngine(options);const towerIds=new Map<string,string>();let attempted=0,lastTick=0;
 const summary=(reason:string):ReplayResult=>{
  const state=engine.getSnapshot(),victory=state.phase==='victory'&&state.wave>=80&&state.lives>0;
  return {plan:plan.id,status:victory?'passed':'failed',victory,waves:state.wave,lives:state.lives,
   credits:state.credits,lastTick,reason,actionsAttempted:attempted};
 };
 const submit=(action:ReplayAction):string|null=>{
  const site=action.kind==='place'?SITES.find(s=>s.id===action.site):undefined;
  const id=action.kind==='place'?undefined:towerIds.get(action.alias);
  if(action.kind!=='place'&&!id)return `Missing tower alias ${action.alias}`;
  const command=action.kind==='place'?{type:'place' as const,tower:action.tower,pos:site!.pos}
   :action.kind==='upgrade'?{type:'upgrade' as const,tower:id!,path:action.path}
   :{type:'target' as const,tower:id!,targeting:action.targeting};
  attempted++;const response=engine.dispatch(command);
  if(!response.ok||response.pending)return `Rejected ${action.kind} (${action.alias}) at wave ${action.wave}, tick ${action.tick}: ${response.reason??'unknown'}`;
  if(action.kind==='place'){
   if(!response.entity)return `Missing entity in placement result for ${action.alias}`;
   towerIds.set(action.alias,response.entity);
  }
  return null;
 };
 for(const action of plan.actions.filter(a=>a.wave===0)){
  const failure=submit(action);if(failure)return summary(failure);
 }
 for(let wave=1;wave<=80;wave++){
  const actions=plan.actions.filter(a=>a.wave===wave);let cursor=0;
  while(cursor<actions.length&&actions[cursor].tick===0){
   const failure=submit(actions[cursor++]);if(failure)return summary(failure);
  }
  const started=engine.dispatch({type:'startWave'});
  if(!started.ok||started.pending)return summary(`Could not start wave ${wave}: ${started.reason??'unknown'}`);
  let completed=false;
  for(let tick=1;tick<=36000;tick++){
   engine.step(1/60);lastTick++;
   while(cursor<actions.length&&actions[cursor].tick<=tick){
    const failure=submit(actions[cursor++]);if(failure)return summary(failure);
   }
   const state=engine.getSnapshot();
   if(state.phase==='defeat')return summary(`Defeat on wave ${wave}`);
   if(state.phase==='victory')return summary('Observed victory in real engine');
   if(state.phase==='build'){completed=true;break;}
  }
  if(!completed)return summary(`Wave ${wave} timeout/unexpected phase`);
  if(cursor<actions.length)return summary(`Unexecuted actions on wave ${wave}`);
 }
 return summary('Wave 80 ended without victory');
}
