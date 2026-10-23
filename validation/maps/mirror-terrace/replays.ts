import type {Difficulty,GameAction,GameConfig,GameEngine,PathIndex,RunOptions,Vec} from '../../../src/contracts';
import {createGame} from '../../../src/engine';
import {createCombat} from '../../../src/combat';
import {landSites} from './geometry';

export const FIRST_VISIT_TOWERS = [
 'needle','cannon','frost','beacon','scatter','ember','saw','venom',
 'rail','tesla','mortar','observatory','mint','orchard','drone','rocket',
 'resonator','forge','harbor','tide','coral','chrono','gravity','prism',
] as const;
export type Site = keyof typeof landSites;
interface At {wave:number;tick:number}
export type ReplayStep =
 | (At&{kind:'place';name:string;tower:typeof FIRST_VISIT_TOWERS[number];site:Site})
 | (At&{kind:'upgrade';name:string;path:PathIndex})
 | (At&{kind:'target';name:string;targeting:'first'|'strong'|'last'|'near'});
export interface ReplayCandidate {
 id:string;status:'unverified';reason:string;seed:number;difficulty:Difficulty;
 modeId:'standard'|'half-cash'|'iron-oath';startingCredits:number;
 openingSpent:number;openingBalance:number;unlockedTowers:readonly string[];
 steps:ReplayStep[];
}
const place=(wave:number,name:string,tower:typeof FIRST_VISIT_TOWERS[number],site:Site,tick=0):ReplayStep=>
 ({wave,tick,kind:'place',name,tower,site});
const upgrade=(wave:number,name:string,path:PathIndex,tick=0):ReplayStep=>
 ({wave,tick,kind:'upgrade',name,path});
const target=(wave:number,name:string,targeting:'first'|'strong'|'last'|'near',tick=0):ReplayStep=>
 ({wave,tick,kind:'target',name,targeting});

export const candidates:ReplayCandidate[] = [
 {
  id:'hard-standard-long-diagonal',status:'unverified',
  reason:'Global waves, tower upgrade costs and engine placement are unfinished in base commit',
  seed:510014,difficulty:'hard',modeId:'standard',startingCredits:850,openingSpent:825,openingBalance:25,
  unlockedTowers:FIRST_VISIT_TOWERS,
  steps:[
   place(1,'west-gun','needle','west'),place(1,'high-gun','needle','center'),
   place(1,'low-gun','needle','south'),
   place(9,'freeze-east','frost','northeast'),target(9,'freeze-east','first'),
   upgrade(11,'west-gun',1),
   place(16,'shell-east','cannon','southeast'),target(16,'shell-east','strong'),
   upgrade(21,'high-gun',0),
   place(24,'arc-cross','tesla','crossfire'),upgrade(27,'arc-cross',1),
   place(30,'sight-west','observatory','westReserve'),
   upgrade(33,'west-gun',1),upgrade(36,'shell-east',0),
   place(40,'sky-south','mortar','southReserve'),target(40,'sky-south','strong'),
   upgrade(43,'freeze-east',0),upgrade(46,'arc-cross',0),
   upgrade(50,'shell-east',0),upgrade(54,'sky-south',0),
   upgrade(58,'high-gun',0),upgrade(60,'arc-cross',1),
   upgrade(65,'west-gun',1),upgrade(70,'shell-east',0),
   upgrade(74,'sky-south',0),upgrade(79,'freeze-east',2),
  ],
 },
 {
  id:'hard-half-cash-frugal-crossing',status:'unverified',
  reason:'Half income requires layer-cash simulation and wave-by-wave affordability checks',
  seed:510024,difficulty:'hard',modeId:'half-cash',startingCredits:425,openingSpent:275,openingBalance:150,
  unlockedTowers:FIRST_VISIT_TOWERS,
  steps:[
   place(1,'economy-gun','needle','west'),
   place(8,'second-gun','needle','center'),
   place(16,'fan-south','scatter','south'),
   upgrade(20,'economy-gun',1),
   place(25,'slow-north','frost','northeast'),
   upgrade(31,'fan-south',0),upgrade(35,'second-gun',0),
   place(37,'chain-mid','tesla','crossfire'),
   upgrade(41,'slow-north',0),upgrade(47,'chain-mid',1),
   place(51,'spotter','observatory','westReserve'),
   upgrade(56,'economy-gun',1),upgrade(61,'fan-south',0),
   place(64,'heavy-south','mortar','southReserve'),
   upgrade(67,'chain-mid',0),upgrade(73,'heavy-south',0),upgrade(78,'second-gun',0),
  ],
 },
 {
  id:'hard-iron-oath-dual-battery',status:'unverified',
  reason:'No leaks permitted; no selling, knowledge, farm or percent income is assumed',
  seed:510034,difficulty:'hard',modeId:'iron-oath',startingCredits:850,openingSpent:743,openingBalance:107,
  unlockedTowers:FIRST_VISIT_TOWERS,
  steps:[
   place(1,'steel-west','needle','west'),place(1,'shrapnel-mid','scatter','center'),
   place(9,'slow-upper','frost','northeast'),
   upgrade(12,'steel-west',1),upgrade(15,'shrapnel-mid',0),
   place(17,'boss-punch','cannon','southeast'),target(17,'boss-punch','strong'),
   place(24,'chain-reserve','tesla','crossfire'),
   upgrade(28,'slow-upper',0),upgrade(32,'boss-punch',0),
   place(35,'long-angle','rail','westReserve'),target(35,'long-angle','strong'),
   upgrade(39,'chain-reserve',1),
   place(42,'sky-battery','mortar','southReserve'),target(42,'sky-battery','strong'),
   upgrade(47,'long-angle',1),upgrade(52,'shrapnel-mid',0),
   upgrade(57,'boss-punch',0),upgrade(61,'chain-reserve',0),
   upgrade(65,'long-angle',1),upgrade(71,'sky-battery',0),
   upgrade(76,'slow-upper',0),upgrade(79,'boss-punch',0),
  ],
 },
];

export interface PaidAction {wave:number;tick:number;kind:string;name:string;cost:number;balance:number}
export interface ReplayResult {
 candidate:string;status:'verified'|'failed';outcome:'victory'|'defeat';
 finalWave:number;finalLives:number;finalCredits:number;
 actions:PaidAction[];durationTicks:number;
}
export function runCandidateReplay(config:GameConfig,plan:ReplayCandidate):ReplayResult {
 if(plan.status!=='unverified')throw new Error('Fixture must enter central validation as unverified');
 if(!config.maps.some(m=>m.id==='mirror-terrace'))throw new Error('Map missing from game config');
 const options:RunOptions={
  mapId:'mirror-terrace',difficulty:plan.difficulty,seed:plan.seed,endless:false,
  modeId:plan.modeId,unlockedTowers:[...plan.unlockedTowers],
  players:[{id:'solo',name:'Оборона',color:'#d8b47d',connected:true}],
  runId:'mirror-terrace-'+plan.id,knowledge:[],
 };
 const engine:GameEngine=createGame(config,options,createCombat());
 const names=new Map<string,string>(),paid:PaidAction[]=[];
 let durationTicks=0;
 const execute=(step:ReplayStep):void=>{
  const before=engine.getSnapshot();
  let command:GameAction;
  if(step.kind==='place')command={type:'place',tower:step.tower,pos:{...landSites[step.site]}};
  else {
   const id=names.get(step.name);
   if(!id)throw new Error('Unknown tower name '+step.name);
   command=step.kind==='upgrade'?{type:'upgrade',tower:id,path:step.path}:
    {type:'target',tower:id,targeting:step.targeting};
  }
  const result=engine.dispatch(command);
  if(!result.ok)throw new Error('Rejected '+plan.id+' wave='+step.wave+' tick='+step.tick+' '+step.kind+' '+step.name+': '+result.reason);
  const after=engine.getSnapshot();
  if(step.kind==='place'){
   const oldIds=new Set(before.towers.map(t=>t.id));
   const created=after.towers.filter(t=>!oldIds.has(t.id));
   const id=result.entity??created[0]?.id;
   if(!id||created.length!==1)throw new Error('Place did not create exactly one tower');
   names.set(step.name,id);
  }
  const cost=before.credits-after.credits;
  if(cost<0)throw new Error('Unexpected money credit during purchase');
  paid.push({wave:step.wave,tick:step.tick,kind:step.kind,name:step.name,cost,balance:after.credits});
 };
 const rounds=plan.difficulty==='hard'?80:plan.difficulty==='normal'?60:plan.difficulty==='easy'?40:100;
 for(let wave=1;wave<=rounds;wave++){
  const before=engine.getSnapshot();
  if(before.phase==='defeat'||before.phase==='victory')break;
  if(before.phase!=='build')throw new Error('Expected build phase before wave '+wave);
  const scheduled=plan.steps.filter(s=>s.wave===wave).sort((a,b)=>a.tick-b.tick);
  for(const step of scheduled.filter(s=>s.tick===0))execute(step);
  const started=engine.dispatch({type:'startWave'});
  if(!started.ok)throw new Error('Unable to start wave '+wave+': '+started.reason);
  let tick=0,index=scheduled.findIndex(s=>s.tick>0);
  if(index<0)index=scheduled.length;
  while(engine.getSnapshot().phase==='wave'){
   if(tick>60*1200)throw new Error('Wave '+wave+' exceeded 20 simulated minutes');
   while(index<scheduled.length&&scheduled[index].tick===tick){execute(scheduled[index]);index++;}
   engine.step(1/60);
   tick++;durationTicks++;
  }
  if(index<scheduled.length)throw new Error('Wave '+wave+' ended before scheduled action at tick '+scheduled[index].tick);
  if(engine.getSnapshot().phase==='defeat')break;
 }
 const state=engine.getSnapshot();
 return {candidate:plan.id,status:state.phase==='victory'&&state.wave>=rounds?'verified':'failed',
  outcome:state.phase==='victory'?'victory':'defeat',finalWave:state.wave,
  finalLives:state.lives,finalCredits:state.credits,actions:paid,durationTicks};
}
