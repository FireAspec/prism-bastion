import {fileURLToPath} from 'node:url';
import type {GameAction,GameConfig,GameEngine,RunOptions,Targeting} from '../../../src/contracts';
import {SITES} from './check-geometry';

/** Only rewards of the eight preceding maps, not salt-marsh's own tide. */
export const FIRST_ARRIVAL_TOWERS=[
 'needle','cannon','frost','beacon','scatter','ember','saw','venom','rail',
 'tesla','mortar','observatory','mint','orchard','drone','rocket',
 'resonator','forge','harbor',
] as const;
type Site=keyof typeof SITES;
export type ReplayStep={
 id:string;wave:number;latestWave:number;tick:number;cashFloor:number;
 action:
  |{type:'place';tower:string;site:Site;tag:string}
  |{type:'upgrade';tag:string;path:0|1|2}
  |{type:'target';tag:string;targeting:Targeting};
};
export type ReplayScenario={
 id:string;status:'unverified';mapId:'salt-marsh';
 modeId:'standard'|'half-cash'|'iron-oath';difficulty:'normal';
 seed:number;startingCredits:number;requiredWaves:60;requiredLives:1;noKnowledge:true;
 roster:readonly string[];description:string;budgetRule:string;counters:string[];
 actions:readonly ReplayStep[];
};
const step=(id:string,wave:number,latestWave:number,action:ReplayStep['action'],cashFloor=0,tick=0):ReplayStep=>({id,wave,latestWave,tick,cashFloor,action});
const place=(tower:string,site:Site,tag:string):ReplayStep['action']=>({type:'place',tower,site,tag});
const upgrade=(tag:string,path:0|1|2):ReplayStep['action']=>({type:'upgrade',tag,path});

/** Hypotheses pending the integrated enemy, tower, wave and engine modules. */
export const REPLAYS:readonly ReplayScenario[]=[
 {
  id:'salt-marsh-normal-standard',status:'unverified',mapId:'salt-marsh',modeId:'standard',
  difficulty:'normal',seed:0x46a17,startingCredits:900,requiredWaves:60,requiredLives:1,
  noKnowledge:true,roster:FIRST_ARRIVAL_TOWERS,
  description:'Distributed northern/southern defenses, then concentrated fire at the common exit.',
  budgetRule:'Start 900; each completed normal wave n yields 80+4n, plus actual paid enemy layers. Never pre-spend expected pop cash.',
  counters:['frost/tesla versus fast groups','beacon versus stealth','venom/rail versus regen and armor','cannon/mortar versus clusters','rocket if stronger boss damage is required'],
  actions:[
   step('s01',1,3,place('needle','northApproach','north-needle'),50),
   step('s02',1,3,place('cannon','southApproach','south-cannon')),
   step('s03',4,9,place('frost','southMiddle','mid-frost'),80),
   step('s04',7,14,place('tesla','northMiddle','mid-tesla'),90),
   step('s05',9,17,upgrade('south-cannon',0),100),
   step('s06',11,18,place('beacon','exitOverlook','exit-beacon'),100),
   step('s07',15,23,place('venom','northConfluence','merge-venom'),120),
   step('s08',19,29,place('rail','southConfluence','merge-rail'),130),
   step('s09',22,32,upgrade('mid-frost',1),100),
   step('s10',27,38,place('mortar','exitCrossfire','exit-mortar'),150),
   step('s11',34,43,upgrade('merge-rail',0),150),
   step('s12',39,49,upgrade('mid-tesla',2),180),
   step('s13',46,55,upgrade('exit-mortar',0),180),
   step('s14',52,60,upgrade('merge-venom',1),220),
  ],
 },
 {
  id:'salt-marsh-normal-half-cash',status:'unverified',mapId:'salt-marsh',modeId:'half-cash',
  difficulty:'normal',seed:0x46a17,startingCredits:450,requiredWaves:60,requiredLives:1,
  noKnowledge:true,roster:FIRST_ARRIVAL_TOWERS,
  description:'Two cheap starting weapons, frost control and a conditional early farm before late shared-lane firepower.',
  budgetRule:'Start 450; round rewards, paid layers and farm income all halved. Farm repayment is not assumed.',
  counters:['two needles catch both early lanes','frost buys time','beacon detects stealth','cannon controls armor/clusters','rail provides late pierce'],
  actions:[
   step('h01',1,4,place('needle','northApproach','n-needle')),
   step('h02',1,6,place('needle','southApproach','s-needle')),
   step('h03',4,11,upgrade('n-needle',0),20),
   step('h04',7,16,place('frost','southMiddle','s-frost'),30),
   step('h05',9,19,place('orchard','northMiddle','economy'),35),
   step('h06',11,21,place('cannon','southConfluence','merge-cannon'),45),
   step('h07',15,26,place('beacon','exitOverlook','vision'),55),
   step('h08',20,31,upgrade('merge-cannon',0),70),
   step('h09',24,34,place('venom','northConfluence','venom'),65),
   step('h10',31,43,place('rail','exitCrossfire','rail'),75),
   step('h11',38,49,upgrade('rail',0),100),
   step('h12',45,56,upgrade('s-frost',1),125),
   step('h13',52,60,upgrade('venom',0),150),
  ],
 },
 {
  id:'salt-marsh-normal-iron-oath',status:'unverified',mapId:'salt-marsh',modeId:'iron-oath',
  difficulty:'normal',seed:0x46a17,startingCredits:900,requiredWaves:60,requiredLives:1,
  noKnowledge:true,roster:FIRST_ARRIVAL_TOWERS,
  description:'One life, no sale or extra economy: screen both entrances and layer damage and detection at the exit.',
  budgetRule:'Start 900; use round rewards and layer cash only. No farm, interest, harvest, cash ability, knowledge or sale.',
  counters:['two starting weapons cover both lanes with zero leaks','frost/tesla delay fast enemies','beacon enables reveal','venom handles regeneration','rail/mortar counter armor and bosses'],
  actions:[
   step('i01',1,2,place('needle','northApproach','top'),50),
   step('i02',1,2,place('cannon','southApproach','bottom')),
   step('i03',3,9,place('frost','southMiddle','freeze'),60),
   step('i04',6,10,place('tesla','northMiddle','arc'),80),
   step('i05',9,15,upgrade('bottom',0),95),
   step('i06',10,18,place('beacon','exitOverlook','reveal'),95),
   step('i07',15,23,place('venom','northConfluence','poison'),120),
   step('i08',18,27,place('rail','southConfluence','pierce'),130),
   step('i09',23,32,upgrade('arc',0),140),
   step('i10',27,38,place('mortar','exitCrossfire','shell'),150),
   step('i11',35,44,upgrade('pierce',0),170),
   step('i12',42,51,upgrade('freeze',1),185),
   step('i13',50,60,upgrade('shell',0),190),
  ],
 },
] as const;

export function runOptions(scenario:ReplayScenario):RunOptions {
 return {mapId:scenario.mapId,difficulty:scenario.difficulty,seed:scenario.seed,endless:false,
  modeId:scenario.modeId,unlockedTowers:[...scenario.roster],
  players:[{id:'solo',name:'Защитник',color:'#dbb879',connected:true}],
  runId:`replay-${scenario.id}`,knowledge:[]};
}
export type ReplayOutcome={
 scenario:string;verification:'simulated';passed:boolean;
 wave:number;lives:number;credits:number;phase:string;
 completed:string[];unresolved:string[];rejected:{id:string;reason:string}[];
};

/** Real headless executor after integration, never grants money or manipulates enemies. */
export function executeReplay(engine:GameEngine,scenario:ReplayScenario):ReplayOutcome {
 const done=new Set<string>(),entities=new Map<string,string>();
 const rejected:{id:string;reason:string}[]=[];
 const runActions=(wave:number,tick:number)=>{
  for(const candidate of scenario.actions){
   if(done.has(candidate.id)||wave<candidate.wave||wave>candidate.latestWave||tick<candidate.tick)continue;
   const snapshot=engine.getSnapshot();
   if(snapshot.credits<candidate.cashFloor)continue;
   const {action}=candidate;
   let command:GameAction;
   if(action.type==='place'){
    if(entities.has(action.tag)){done.add(candidate.id);continue;}
    command={type:'place',tower:action.tower,pos:{...SITES[action.site]}};
   }else{
    const entity=entities.get(action.tag);
    if(!entity)continue;
    command=action.type==='upgrade'?{type:'upgrade',tower:entity,path:action.path}:
     {type:'target',tower:entity,targeting:action.targeting};
   }
   const before=snapshot.credits;
   const result=engine.dispatch({...command,actor:'solo'});
   if(result.ok&&!result.pending){
    done.add(candidate.id);
    if(action.type==='place'&&result.entity)entities.set(action.tag,result.entity);
    if(engine.getSnapshot().credits<0)throw Error('Engine allowed negative credits');
    if(result.amount!==undefined&&result.amount>before)throw Error('Purchase cost exceeds available credits');
   }else if(!result.pending&&result.reason&&!/cash|credit|fund|money|денег|средств|price|дорого|cost/i.test(result.reason)){
    rejected.push({id:candidate.id,reason:result.reason});done.add(candidate.id);
   }
  }
 };
 for(let wave=1;wave<=scenario.requiredWaves;wave++){
  const before=engine.getSnapshot();
  if(before.phase==='victory'||before.phase==='defeat')break;
  if(before.phase!=='build'){rejected.push({id:`wave-${wave}`,reason:`Expected build, got ${before.phase}`});break;}
  runActions(wave,0);
  const start=engine.dispatch({type:'startWave',actor:'solo'});
  if(!start.ok||start.pending){rejected.push({id:`wave-${wave}`,reason:start.reason??'Wave not confirmed'});break;}
  for(let tick=1;tick<=120000;tick++){
   if(engine.getSnapshot().phase!=='wave')break;
   runActions(wave,tick);
   engine.step(1/60);
   if(tick===120000)rejected.push({id:`wave-${wave}`,reason:'Tick safety limit exceeded'});
  }
  const after=engine.getSnapshot();
  if(after.phase==='defeat'||(after.phase!=='build'&&after.phase!=='victory'))break;
 }
 const final=engine.getSnapshot();
 const unresolved=scenario.actions.filter(s=>!done.has(s.id)).map(s=>s.id);
 return {scenario:scenario.id,verification:'simulated',
  passed:final.phase==='victory'&&final.lives>=scenario.requiredLives&&rejected.length===0&&unresolved.length===0,
  wave:final.wave,lives:final.lives,credits:final.credits,phase:final.phase,
  completed:[...done],unresolved,rejected};
}
export function roundRewardsThrough(wave:number,modeId:ReplayScenario['modeId']):number {
 return (80*wave+2*wave*(wave+1))*(modeId==='half-cash'?.5:1);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv.includes('--integrated')){
  const [{loadContent},{createGame},{createCombat}]=await Promise.all([
   import('../../../src/content/index'),import('../../../src/engine/index'),import('../../../src/combat/index'),
  ]);
  const config:GameConfig=loadContent();
  const result=REPLAYS.map(s=>executeReplay(createGame(config,runOptions(s),createCombat()),s));
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(result.some(r=>!r.passed))process.exitCode=1;
 }else{
  process.stdout.write(`${JSON.stringify({status:'unverified',reason:'Base content and engine are pending',scenarios:REPLAYS.map(s=>({id:s.id,mode:s.modeId,actions:s.actions.length}))},null,2)}\n`);
 }
}
