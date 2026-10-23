import {WORLD,type GameAction,type GameEngine,type RunOptions,type PathIndex} from '../../../src/contracts';
import {upgradeCost} from '../../../src/contracts/rules';
import {sites} from './geometry';

export const FIRST_VISIT_TOWERS=['needle','cannon','frost','beacon','scatter','ember'] as const;
type Tower=typeof FIRST_VISIT_TOWERS[number];
type Mode='standard'|'half-cash'|'iron-oath';
type Place={kind:'place';beforeWave:number;tick:0;slot:string;tower:Tower};
type Upgrade={kind:'upgrade';beforeWave:number;tick:0;slot:string;path:PathIndex};
export type ReplayStep=Place|Upgrade;
export interface ReplayCandidate{id:string;modeId:Mode;difficulty:'easy';verified:false;status:'unverified';description:string;counterplay:string[];steps:ReplayStep[];}
const p=(beforeWave:number,slot:string,tower:Tower):Place=>({kind:'place',beforeWave,tick:0,slot,tower});
const u=(beforeWave:number,slot:string,path:PathIndex):Upgrade=>({kind:'upgrade',beforeWave,tick:0,slot,path});
export const candidates:ReplayCandidate[]=[
 {id:'creek-standard-early-six',modeId:'standard',difficulty:'easy',verified:false,status:'unverified',
  description:'Контроль первой петли, артиллерия и резерв у выхода.',
  counterplay:['Броня Панцирника: бронепробитие и пушка.','Дети Матки: scatter на втором изгибе.','Тени Регента: фонарь B2 перед сороковой волной.'],
  steps:[p(1,'upper','needle'),p(1,'garden','frost'),p(4,'lower','cannon'),u(7,'upper',0),u(8,'upper',0),
   p(11,'court','scatter'),p(14,'beacon','beacon'),p(16,'ridge','needle'),u(19,'lower',1),u(22,'lower',1),
   p(25,'final','ember'),u(28,'upper',0),u(31,'garden',2),u(33,'garden',2),p(35,'meadow','cannon'),
   u(36,'beacon',1),u(37,'ridge',1),u(39,'ridge',1),u(40,'beacon',1)]},
 {id:'creek-half-cash-conservation',modeId:'half-cash',difficulty:'easy',verified:false,status:'unverified',
  description:'Экономный старт с игломётами, только гарантированные выплаты в плановом бюджете.',
  counterplay:['Экономия до второй покупки.','Броня: ветка B второго игломёта.','Тени: фонарь B2 до финального босса.'],
  steps:[p(1,'upper','needle'),p(3,'garden','needle'),p(7,'lower','scatter'),p(14,'court','frost'),
   u(18,'upper',0),u(21,'upper',0),p(25,'beacon','beacon'),u(29,'garden',1),u(31,'garden',1),
   p(34,'final','cannon'),u(35,'beacon',1),u(37,'lower',0),u(40,'beacon',1)]},
 {id:'creek-iron-oath-no-leaks',modeId:'iron-oath',difficulty:'easy',verified:false,status:'unverified',
  description:'Раздельная оборона с первой волны без продажи, знаний и денежной поддержки.',
  counterplay:['Одна жизнь: начальная пушка у нижней дуги.','Массовый урон: пушка A2, печь.','Скрытые призывы: фонарь B2.'],
  steps:[p(1,'upper','needle'),p(1,'lower','cannon'),p(4,'garden','frost'),p(8,'court','needle'),
   u(10,'upper',1),u(10,'upper',1),p(13,'beacon','beacon'),u(16,'lower',0),u(20,'lower',0),
   p(24,'meadow','ember'),u(27,'upper',1),p(31,'final','scatter'),u(34,'court',0),u(34,'court',0),
   u(35,'beacon',1),u(37,'garden',2),u(37,'garden',2),u(39,'meadow',0),u(39,'meadow',0),u(40,'beacon',1)]},
];
// Upgrade pathFactor belongs to pending tower modules; 1.25 is NOT verified.
const base:Record<Tower,number>={needle:250,cannon:550,frost:500,beacon:600,scatter:425,ember:600};
export interface BudgetRow{beforeWave:number;step:string;estimatedCost:number;guaranteedIncome:number;estimatedCash:number;}
export function estimateBudget(candidate:ReplayCandidate):BudgetRow[]{
 const cash0=candidate.modeId==='half-cash'?500:1000,mul=candidate.modeId==='half-cash'?.5:1;
 const tiers=new Map<string,[number,number,number]>(),towers=new Map<string,Tower>();let spent=0;
 return candidate.steps.map(step=>{
  let cost:number;
  if(step.kind==='place'){cost=base[step.tower];towers.set(step.slot,step.tower);tiers.set(step.slot,[0,0,0]);}
  else {const t=tiers.get(step.slot),tower=towers.get(step.slot);if(!t||!tower)throw new Error(`Upgrade before placement: ${step.slot}`);
   const tier=++t[step.path] as 1|2|3|4|5;cost=upgradeCost(base[tower],1.25,tier);}
  const estimatedCost=Math.ceil(cost*.85);spent+=estimatedCost;
  const n=step.beforeWave-1,guaranteedIncome=Math.floor(mul*(n*100+n*(n+1)*2.5)*100)/100;
  return {beforeWave:step.beforeWave,step:`${step.kind}:${step.slot}`,estimatedCost,guaranteedIncome,
   estimatedCash:Math.floor((cash0+guaranteedIncome-spent)*100)/100};
 });
}
export function optionsFor(candidate:ReplayCandidate):RunOptions{return {mapId:'copper-creek',difficulty:'easy',seed:390002,
 endless:false,modeId:candidate.modeId,unlockedTowers:[...FIRST_VISIT_TOWERS],knowledge:[],runId:`replay-${candidate.id}`,
 players:[{id:'solo',name:'Защитник',color:'#c5deb5',connected:true}]};}
export interface ReplayOutcome{status:'won'|'lost'|'invalid'|'timeout';candidate:string;wave:number;lives:number;credits:number;commands:number;reason?:string;}
/** Genuine GameEngine adapter; never interprets a paper plan as a win. */
export function executeReplay(engine:GameEngine,candidate:ReplayCandidate,maxTicksPerWave=60*600):ReplayOutcome{
 const ids=new Map<string,string>();let commands=0;
 const result=(status:ReplayOutcome['status'],wave:number,reason?:string):ReplayOutcome=>{
  const s=engine.getSnapshot();return {status,candidate:candidate.id,wave,lives:s.lives,credits:s.credits,commands,reason};};
 for(let wave=1;wave<=40;wave++){
  if(engine.getSnapshot().phase!=='build')return result('invalid',wave,'Expected build phase');
  for(const step of candidate.steps.filter(s=>s.beforeWave===wave)){
   const site=sites.find(s=>s.id===step.slot);
   if(!site||site.kind!=='land')return result('invalid',wave,`Invalid land slot ${step.slot}`);
   const command:GameAction=step.kind==='place'?{type:'place',tower:step.tower,pos:site.pos}:
    {type:'upgrade',tower:ids.get(step.slot)??'',path:step.path};
   const response=engine.dispatch(command);commands++;
   if(!response.ok||response.pending)return result('invalid',wave,`Rejected ${step.kind} ${step.slot}: ${response.reason??'pending'}`);
   if(step.kind==='place'){
    const id=response.entity??engine.getSnapshot().towers.find(t=>t.defId===step.tower&&t.pos.x===site.pos.x&&t.pos.y===site.pos.y)?.id;
    if(!id)return result('invalid',wave,`Missing entity ${step.slot}`);ids.set(step.slot,id);
   }
  }
  const start=engine.dispatch({type:'startWave'});commands++;
  if(!start.ok)return result('invalid',wave,`Start rejected: ${start.reason??'unknown'}`);
  let ticks=0;
  while(engine.getSnapshot().phase==='wave'&&ticks<maxTicksPerWave){engine.step(WORLD.tick);ticks++;}
  const phase=engine.getSnapshot().phase;
  if(phase==='defeat')return result('lost',wave);
  if(phase==='victory')return result('won',wave);
  if(phase!=='build')return result('timeout',wave,`No completion in ${ticks} fixed ticks`);
 }
 return result('invalid',40,'No victory event after 40 waves');
}
