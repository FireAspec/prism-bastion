/** Unverified candidate orders for the central authoritative replay runner. */
import type {RunOptions} from '../../../src/contracts';
import {BELL_FOUNDRY_SITES} from '../../../src/content/maps/bell-foundry';

export const FIRST_ARRIVAL_TOWERS=[
  'needle','cannon','frost','beacon','scatter','ember','saw','venom',
  'rail','tesla','mortar','observatory','mint','orchard','drone','rocket',
] as const;

export type ReplayAction=
  |{kind:'build';wave:number;tick:number;key:string;towerId:string;siteId:string;estimate:number}
  |{kind:'upgrade';wave:number;tick:number;key:string;path:0|1|2;tier:1|2|3|4|5;estimate:number};
export interface ReplayCandidate {
  id:string;verificationStatus:'unverified';expectedVictory:null;finalLives:null;finalCredits:null;
  reason:string;run:RunOptions;rounds:60;actions:ReplayAction[];counterplay:string[];
}
const B=(wave:number,key:string,towerId:string,siteId:string,estimate:number):ReplayAction=>({kind:'build',wave,tick:0,key,towerId,siteId,estimate});
const U=(wave:number,key:string,path:0|1|2,tier:1|2|3|4|5,estimate:number):ReplayAction=>({kind:'upgrade',wave,tick:0,key,path,tier,estimate});
function run(modeId:string,seed:number):RunOptions{return {
  mapId:'bell-foundry',difficulty:'normal',modeId,seed,endless:false,
  runId:`bell-foundry-${modeId}-${seed}`,unlockedTowers:[...FIRST_ARRIVAL_TOWERS],knowledge:[],
  players:[{id:'solo',name:'Защитник',color:'#dba467',connected:true}],
};}
const fixture=(modeId:string,seed:number,actions:ReplayAction[],counterplay:string[]):ReplayCandidate=>({
  id:`bell-foundry-${modeId}`,verificationStatus:'unverified',expectedVictory:null,finalLives:null,finalCredits:null,
  reason:'Base commit has no implemented combat, enemy, tower or wave simulation. No engine outcome has been produced.',
  run:run(modeId,seed),rounds:60,actions,counterplay,
});
export const replayCandidates:readonly ReplayCandidate[]=[
  fixture('standard',440701,[
    B(1,'starter','needle','early-platform',250),B(1,'slow','frost','west-bell',500),
    B(3,'north','needle','north-anvil',250),B(11,'watch','observatory','coal-station',650),
    U(12,'starter',0,1,125),U(14,'watch',0,1,325),
    B(17,'gun','cannon','east-crucible',550),B(21,'acid','venom','slag-platform',650),
    B(26,'ion','tesla','hearth-east',800),U(29,'gun',0,1,275),
    B(33,'sky','mortar','south-platform',800),U(37,'ion',1,1,400),
    B(40,'rail','rail','west-exit',950),U(42,'starter',0,2,250),
    B(45,'rocket','rocket','east-exit',1000),U(49,'gun',0,2,550),
    U(55,'rail',0,1,475),U(56,'starter',0,3,625),U(58,'gun',0,3,1375),
  ],[
    'The northern needle and western frost cover consecutive tram passes.',
    'Observatory with its revealing path is placed before the global stealth block; tesla/venom watch the short service lane.',
    'Cannon and mortar answer splits; rail/rocket provide a final reserve.',
    'Early boss DPS is still an integration risk; neither victory nor exact costs are confirmed.',
  ]),
  fixture('half-cash',440702,[
    B(1,'starter','needle','early-platform',250),B(5,'north','needle','north-anvil',250),
    B(15,'watch','observatory','coal-station',650),B(21,'spray','scatter','west-bell',425),
    B(27,'slow','frost','east-crucible',500),B(33,'acid','venom','slag-platform',650),
    B(38,'gun','cannon','hearth-west',550),B(45,'ion','tesla','hearth-east',800),
    U(48,'starter',0,1,125),B(54,'sky','mortar','south-platform',800),
    U(57,'spray',1,1,215),U(58,'north',0,1,125),U(59,'acid',1,1,325),
  ],[
    'The opening uses cheap needles; spending on economy towers is postponed.',
    'Observatory is prioritized for detection by wave 15; scatter/mortar cover swarms, frost/venom slow packs.',
    'Half-cash estimates count only guaranteed half-sized round awards, not theoretical pop rewards.',
    'Cloaks before the observatory and early bosses may defeat this candidate; central replay must revise it.',
  ]),
  fixture('iron-oath',440703,[
    B(1,'front','needle','early-platform',250),B(1,'gun','cannon','east-crucible',550),
    B(5,'north','needle','north-anvil',250),B(10,'watch','observatory','coal-station',650),
    U(13,'watch',0,1,325),B(19,'acid','venom','west-bell',650),
    B(23,'slow','frost','slag-platform',500),B(27,'ion','tesla','hearth-east',800),
    B(31,'sky','mortar','south-platform',800),B(36,'rail','rail','west-exit',950),
    U(40,'gun',0,1,275),U(43,'front',1,1,125),U(46,'ion',1,1,400),
    B(49,'rocket','rocket','east-exit',1000),U(53,'rail',0,1,475),
    U(56,'gun',0,2,550),U(59,'sky',0,1,400),
  ],[
    'One leak ends the run. There is no mint, orchard, harvest, selling or knowledge bonus.',
    'Observatory is added before the stealth block, with its first detection tier at wave 13.',
    'Poison and rail serve armored targets; frost controls the short service approach.',
    'No credits are inserted and no lives restored by the fixture.',
  ]),
];

/** Base 900 credits and the NORMAL reward series 80+4n. Excludes all pop cash. */
export function guaranteedBudgetBeforeWave(wave:number,modeId:string):number{
  const n=wave-1,credits=900+80*n+2*n*(n+1);
  return Math.floor(credits*(modeId==='half-cash'?0.5:1));
}

export function inspectCandidate(candidate:ReplayCandidate):string[]{
  const errors:string[]=[],sites=new Set(BELL_FOUNDRY_SITES.map(s=>s.id)),occupied=new Set<string>();
  const builds=new Map<string,[number,number,number]>();let spent=0,lastWave=0;
  for(const a of candidate.actions){
    if(a.wave<lastWave||a.wave<1||a.wave>60||a.tick!==0)errors.push(`Invalid pre-wave order ${a.wave}`);
    lastWave=a.wave;
    if(a.kind==='build'){
      if(!sites.has(a.siteId)||occupied.has(a.siteId))errors.push(`Illegal site ${a.siteId}`);
      if(!FIRST_ARRIVAL_TOWERS.some(id=>id===a.towerId))errors.push(`Locked tower ${a.towerId}`);
      if(builds.has(a.key))errors.push(`Duplicate key ${a.key}`);
      occupied.add(a.siteId);builds.set(a.key,[0,0,0]);
    }else{
      const t=builds.get(a.key);if(!t)errors.push(`Unknown tower ${a.key}`);
      else{
        if(a.tier!==t[a.path]+1)errors.push(`Skipped tier ${a.key}`);
        t[a.path]=a.tier;
        if(t.filter(v=>v>0).length>2||t.filter(v=>v>2).length>1)errors.push(`Illegal branch combination ${a.key}`);
      }
    }
    spent+=a.estimate;
    if(spent>guaranteedBudgetBeforeWave(a.wave,candidate.run.modeId))errors.push(`Estimated budget shortage on wave ${a.wave}: ${spent}`);
  }
  if(candidate.run.mapId!=='bell-foundry'||candidate.run.difficulty!=='normal'||candidate.run.knowledge.length)errors.push('Bad run configuration');
  if(candidate.verificationStatus!=='unverified'||candidate.expectedVictory!==null||candidate.finalLives!==null||candidate.finalCredits!==null)errors.push('Unverified result must be null');
  return errors;
}

/** Adapter translating this independent fixture into real authoritative GameEngine calls. */
export interface ReplayAdapter {
  start(run:RunOptions):Promise<void>|void;
  action(a:ReplayAction,pos:Readonly<{x:number;y:number}>|undefined):Promise<{ok:boolean;reason?:string}>|{ok:boolean;reason?:string};
  finishWave(wave:number):Promise<void>|void;
  result():Promise<{victory:boolean;lives:number;credits:number;completedWaves:number}>|{victory:boolean;lives:number;credits:number;completedWaves:number};
}
export async function executeReplay(candidate:ReplayCandidate,adapter:ReplayAdapter){
  await adapter.start(candidate.run);let applied=0;const rejected:{action:ReplayAction;reason:string}[]=[];
  for(let wave=1;wave<=60;wave++){
    for(const a of candidate.actions.filter(a=>a.wave===wave)){
      const pos=a.kind==='build'?BELL_FOUNDRY_SITES.find(site=>site.id===a.siteId)?.pos:undefined;
      const result=await adapter.action(a,pos);
      if(result.ok)applied++;else rejected.push({action:a,reason:result.reason??'Authoritative command rejected'});
    }
    await adapter.finishWave(wave);
  }
  return {id:candidate.id,applied,rejected,final:await adapter.result()};
}
