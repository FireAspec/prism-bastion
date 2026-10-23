import type {CombatModule,Difficulty,GameAction,GameConfig,GameEngine,PathIndex,RunOptions} from '../../../src/contracts';
import {createGame} from '../../../src/engine';
import {createCombat} from '../../../src/combat';
import {getMap} from '../../../src/content/maps/fallen-observatory';
import {landSites} from './geometry';

/** The gravity lens is awarded AFTER clearing this map and is absent here. */
export const FIRST_VISIT_TOWERS=[
 'needle','cannon','frost','beacon','scatter','ember','saw','venom','rail',
 'tesla','mortar','observatory','mint','orchard','drone','rocket',
 'resonator','forge','harbor','tide','coral','chrono',
] as const;
type TowerId=typeof FIRST_VISIT_TOWERS[number];
type SiteId=typeof landSites[number]['id'];
type At={wave:number;tick:number};
export type ReplayStep=(At&{kind:'place';name:string;tower:TowerId;site:SiteId})|
 (At&{kind:'upgrade';name:string;path:PathIndex})|
 (At&{kind:'target';name:string;targeting:'first'|'last'|'strong'|'near'});
export interface ReplayFixture {
 id:string;status:'unverified';seed:number;difficulty:Difficulty;
 modeId:'standard'|'half-cash'|'iron-oath';startingCredits:number;startingLives:number;
 concept:string;counters:string[];unlockedTowers:readonly string[];steps:ReplayStep[];
}
const place=(wave:number,name:string,tower:TowerId,site:SiteId,tick=0):ReplayStep=>({wave,tick,kind:'place',name,tower,site});
const upgrade=(wave:number,name:string,path:PathIndex,tick=0):ReplayStep=>({wave,tick,kind:'upgrade',name,path});
const target=(wave:number,name:string,targeting:'first'|'last'|'strong'|'near',tick=0):ReplayStep=>({wave,tick,kind:'target',name,targeting});

export const candidates:ReplayFixture[]=[
 {id:'standard-crossfire',status:'unverified',seed:490012,difficulty:'hard',modeId:'standard',startingCredits:850,startingLives:100,
  concept:'Cheap western needles, scattered splash, central rail/mortar battery, then shield and exit coverage',
  counters:['Cloak: observatory or rail detection before late stealth','Armor: rail pierce or cannon upgrades','Swarm: scatter and mortar area fire','Boss: rail and rocket focus; monitor phases'],unlockedTowers:FIRST_VISIT_TOWERS,
  steps:[
   place(1,'west','needle','western-watch'),place(1,'sweep','scatter','western-crossfire'),
   place(5,'bend','needle','western-reserve'),place(13,'slow','frost','middle-west'),
   place(20,'splash','mortar','middle-south'),target(20,'splash','strong'),
   place(28,'boss','rail','middle-overlook'),upgrade(32,'boss',1),
   place(37,'shield','tesla','eastern-upper'),place(43,'rockets','rocket','eastern-mid'),
   place(48,'forge','forge','eastern-south'),upgrade(52,'sweep',0),
   upgrade(58,'rockets',1),place(62,'exit','needle','eastern-exit'),
   upgrade(67,'boss',1),place(71,'reserve','resonator','eastern-reserve'),upgrade(76,'shield',1),
  ]},
 {id:'half-cash-needles',status:'unverified',seed:490013,difficulty:'hard',modeId:'half-cash',startingCredits:425,startingLives:100,
  concept:'One cheap tower at first; small installment purchases, midlane control, no farm dependency',
  counters:['Opening rush: front needle range at entry','Cloak: late rail detection path','Shield: defer tesla until funded','Boss: rocket and rail instead of assumed farm profits'],unlockedTowers:FIRST_VISIT_TOWERS,
  steps:[
   place(1,'starter','needle','western-watch'),place(6,'bend','needle','western-crossfire'),
   place(17,'sweep','scatter','middle-west'),place(25,'control','frost','middle-south'),
   place(40,'splash','mortar','middle-overlook'),upgrade(52,'starter',1),
   place(55,'boss','rail','eastern-upper'),target(55,'boss','strong'),
   place(63,'rockets','rocket','eastern-mid'),upgrade(70,'boss',2),
   place(76,'last','needle','eastern-exit'),
  ]},
 {id:'iron-oath-lockdown',status:'unverified',seed:490014,difficulty:'hard',modeId:'iron-oath',startingCredits:850,startingLives:1,
  concept:'No knowledge, no selling, no farms; layered slow and area effects plus sustained anti-boss fire',
  counters:['Any leak loses: protect the exit','Cloak: rail detection branch','Shield: tesla ion path','Speed: long approach plus mortar splash'],unlockedTowers:FIRST_VISIT_TOWERS,
  steps:[
   place(1,'west','needle','western-watch'),place(1,'scatter','scatter','western-crossfire'),
   place(5,'needle2','needle','western-reserve'),place(13,'frost','frost','middle-west'),
   place(20,'mortar','mortar','middle-south'),place(28,'rail','rail','middle-overlook'),
   target(28,'rail','strong'),upgrade(35,'rail',2),place(37,'tesla','tesla','eastern-upper'),
   place(43,'rocket','rocket','eastern-mid'),upgrade(49,'frost',0),
   place(54,'watch','needle','eastern-exit'),upgrade(61,'rocket',1),
   place(69,'last','resonator','eastern-reserve'),upgrade(76,'mortar',0),
  ]},
];

const baseCosts:Partial<Record<TowerId,number>>={needle:250,cannon:550,frost:500,scatter:425,rail:950,tesla:800,mortar:800,rocket:1000,resonator:700,forge:750};
export function basePurchaseLedger(plan:ReplayFixture) {
 let spent=0;const half=plan.modeId==='half-cash';
 return plan.steps.flatMap(step=>{
  if(step.kind!=='place')return [];
  const n=step.wave-1;
  const waveIncome=60*n+3*n*(n+1)/2;
  const guaranteedCashBefore=plan.startingCredits+(half?Math.floor(waveIncome/2):waveIncome)-spent;
  const cost=Math.ceil((baseCosts[step.tower]??Infinity)*1.1);
  spent+=cost;
  return [{wave:step.wave,site:step.site,tower:step.tower,cost,guaranteedCashBefore,
   afterIgnoringKillIncomeAndUpgradeCosts:guaranteedCashBefore-cost}];
 });
}
export function replayOptions(plan:ReplayFixture):RunOptions {
 return {mapId:getMap().id,difficulty:plan.difficulty,seed:plan.seed,endless:false,
  modeId:plan.modeId,unlockedTowers:[...plan.unlockedTowers],
  players:[{id:'solo',name:'Tester',color:'#86cfc5',connected:true}],
  runId:`fallen-observatory-${plan.id}`,knowledge:[]};
}

/** True integration replay, intentionally never claims a win before engine simulation. */
export function runCandidateReplay(config:GameConfig,plan:ReplayFixture,
 factory:(c:GameConfig,o:RunOptions,b:CombatModule)=>GameEngine=createGame,
 combat:CombatModule=createCombat()) {
 if(plan.status!=='unverified')throw new Error('Fixture must enter unverified');
 if(!config.maps.some(m=>m.id==='fallen-observatory'))throw new Error('Map absent from content');
 const engine=factory(config,replayOptions(plan),combat);
 const ids=new Map<string,string>();
 const purchases:Array<{wave:number;tick:number;kind:string;name:string;cost:number;balance:number}>=[];
 let durationTicks=0;
 const execute=(step:ReplayStep)=>{
  const before=engine.getSnapshot();let command:GameAction;
  if(step.kind==='place'){
   const p=landSites.find(s=>s.id===step.site)?.point;
   if(!p)throw new Error(`Unknown site ${step.site}`);
   command={type:'place',tower:step.tower,pos:{...p}};
  }else{
   const id=ids.get(step.name);if(!id)throw new Error(`Missing named tower ${step.name}`);
   command=step.kind==='upgrade'?{type:'upgrade',tower:id,path:step.path}:{type:'target',tower:id,targeting:step.targeting};
  }
  const result=engine.dispatch(command);
  if(!result.ok||result.pending)throw new Error(`Rejected ${plan.id} wave=${step.wave} tick=${step.tick} ${step.kind}/${step.name}: ${result.reason??'pending'}`);
  const after=engine.getSnapshot();
  if(step.kind==='place'){
   const old=new Set(before.towers.map(t=>t.id));const created=after.towers.filter(t=>!old.has(t.id));
   if(created.length!==1)throw new Error(`Place ${step.name} did not create exactly one tower`);
   ids.set(step.name,result.entity??created[0].id);
  }
  const cost=before.credits-after.credits;
  if(cost<0)throw new Error('Purchase unexpectedly credited money');
  purchases.push({wave:step.wave,tick:step.tick,kind:step.kind,name:step.name,cost,balance:after.credits});
 };
 for(let wave=1;wave<=80;wave++){
  const state=engine.getSnapshot();
  if(state.phase==='defeat')throw new Error(`Defeat before wave ${wave}`);
  if(state.phase==='victory')throw new Error(`Premature victory before wave ${wave}`);
  if(state.phase!=='build')throw new Error(`Expected build before wave ${wave}: ${state.phase}`);
  const steps=plan.steps.filter(a=>a.wave===wave).sort((a,b)=>a.tick-b.tick);
  for(const step of steps.filter(a=>a.tick===0))execute(step);
  const start=engine.dispatch({type:'startWave'});
  if(!start.ok||start.pending)throw new Error(`Wave ${wave} rejected: ${start.reason??'pending'}`);
  let next=steps.findIndex(a=>a.tick>0);if(next<0)next=steps.length;
  let tick=0;
  while(engine.getSnapshot().phase==='wave'){
   if(tick>60*1200)throw new Error(`Wave ${wave} stuck beyond 20 simulated minutes`);
   while(next<steps.length&&steps[next].tick===tick)execute(steps[next++]);
   engine.step(1/60);tick++;durationTicks++;
  }
  if(next<steps.length)throw new Error(`Wave ${wave} ended before scheduled action`);
 }
 const final=engine.getSnapshot();
 if(final.phase!=='victory'||final.lives<=0||final.wave<80)throw new Error(`No victory: ${final.phase}, wave ${final.wave}, lives ${final.lives}`);
 return {status:'verified-in-this-run' as const,candidate:plan.id,mode:plan.modeId,
  finalWave:final.wave,finalLives:final.lives,finalCredits:final.credits,
  seed:plan.seed,durationTicks,purchases};
}

/** Run with: npx tsx validation/maps/fallen-observatory/replays.ts --run */
export async function main(args:string[]=process.argv.slice(2)) {
 if(!args.includes('--run')){
  process.stdout.write(JSON.stringify({status:'unverified',candidates:candidates.map(c=>({id:c.id,seed:c.seed,mode:c.modeId,actions:c.steps.length}))},null,2)+'\n');
  return;
 }
 const {loadContent}=await import('../../../src/content');
 const config=loadContent();
 const results=candidates.map(c=>runCandidateReplay(config,c));
 process.stdout.write(JSON.stringify(results,null,2)+'\n');
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/fallen-observatory/replays.ts')){
 main().catch(error=>{process.stderr.write(`REPLAY UNVERIFIED: ${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1;});
}
