import type {Difficulty,GameEngine,GameAction,GameState,PathIndex,Targeting,Vec} from '../../../src/contracts';
import {LAND_SITES} from './geometry';

/**
 * Executable candidates, NOT proof of victory. The real engine must supply
 * costs, enemy defenses, enemy bounties, and the win condition after integration.
 * An unsuccessful purchase is a replay failure, never an implicit free top-up.
 */
export const REPLAY_STATUS = 'unverified' as const;
export const REPLAY_SEED = 380101;
export const FIRST_VISIT_TOWERS = ['needle','cannon','frost','beacon'] as const;
export const RECOMMENDED_DIFFICULTY:Difficulty = 'easy';

type Placement = {kind:'place';wave:number;tick:number;key:string;tower:string;site:string};
type Upgrade = {kind:'upgrade';wave:number;tick:number;key:string;path:PathIndex};
type Target = {kind:'target';wave:number;tick:number;key:string;targeting:Targeting};
export type ReplayMove = Placement|Upgrade|Target;

export interface ReplayCandidate {
 id:string;modeId:'standard'|'half-cash'|'iron-oath';
 description:string;countermeasures:string[];
 difficulty:Difficulty;seed:number;status:typeof REPLAY_STATUS;
 allowedTowers:readonly string[];knowledge:readonly string[];
 expectedWaves:40;expectedMaxLives:200|1;
 actions:readonly ReplayMove[];
}

const P=(wave:number,key:string,tower:string,site:string,tick=0):Placement=>({kind:'place',wave,tick,key,tower,site});
const U=(wave:number,key:string,path:PathIndex,tick=0):Upgrade=>({kind:'upgrade',wave,tick,key,path});
const T=(wave:number,key:string,targeting:Targeting,tick=0):Target=>({kind:'target',wave,tick,key,targeting});

export const replayCandidates:readonly ReplayCandidate[] = [
 {
  id:'standard-crossfire',modeId:'standard',description:'Двойной перекрёстный огонь двух внутренних площадок; ледяной контроль защищает восточный разворот.',
  countermeasures:[
   '1–9: центральная позиция A дважды встречает длинную верхнюю и среднюю прямые; вторую линию держит B.',
   '10: броню Панцирника встречает пушка на B, сильная цель выбирается вручную; игломёты добавляют постоянный урон.',
   '11–12: маяк у D обнаруживает cloak при условии радиуса каталога; frost у I замедляет быстрые цели.',
   '20–21: пушки на B/C снимают рой и разделившихся детей; игломёты не оставляют чистую splash-монокультуру.',
   '31–40: разнотипные kinetic/frost, обнаружение и две зоны контроля — ответ на тени, щиты и фазы Регента.',
  ],
  difficulty:'easy',seed:REPLAY_SEED,status:REPLAY_STATUS,allowedTowers:FIRST_VISIT_TOWERS,knowledge:[],expectedWaves:40,expectedMaxLives:200,
  actions:[
   P(1,'nA','needle','A'),U(2,'nA',0),P(3,'cB','cannon','B'),
   U(5,'cB',0),P(7,'fI','frost','I'),U(8,'nA',0),U(9,'cB',0),T(10,'cB','strong',1),
   P(11,'bD','beacon','D'),U(12,'bD',0),P(14,'nE','needle','E'),U(15,'fI',1),
   P(17,'cC','cannon','C'),U(18,'cC',1),U(19,'cB',0),U(20,'cC',1),
   P(22,'nJ','needle','J'),U(23,'nJ',0),U(25,'fI',1),U(27,'cB',0),
   P(29,'nH','needle','H'),U(30,'nA',0),U(32,'bD',0),U(34,'cC',1),
   U(36,'nJ',0),U(38,'nA',0),T(40,'cB','strong',1),
  ],
 },
 {
  id:'half-cash-corridor',modeId:'half-cash',description:'Одна ранняя универсальная точка C, экономные улучшения и поздний переход в контроль / пушечный коридор.',
  countermeasures:[
   '1–7: стартовый игломёт на C обеспечивает две атаки по средней и нижней дорожкам; новую покупку делать после начислений.',
   '10: вместо дорогой ранней поддержки усиливается пушка на B против брони босса.',
   '12: доступность обнаружения проверяет beacon у D; если дальность не закрывает cloak, replay должен провалиться и потребовать переработки.',
   '20–21: splash в зоне J останавливает детей и массовый спавн, I подбирает выживших.',
   '40: сводить фокус cB и cJ на босса; без заработанных бонти не допускается ни одна досрочная покупка.',
  ],
  difficulty:'easy',seed:REPLAY_SEED,status:REPLAY_STATUS,allowedTowers:FIRST_VISIT_TOWERS,knowledge:[],expectedWaves:40,expectedMaxLives:200,
  actions:[
   P(1,'nC','needle','C'),U(4,'nC',0),P(7,'cB','cannon','B'),
   U(9,'cB',0),T(10,'cB','strong',1),P(11,'bD','beacon','D'),U(12,'bD',0),
   P(15,'fA','frost','A'),U(16,'nC',0),P(19,'cJ','cannon','J'),
   U(20,'cJ',1),U(21,'cB',0),P(23,'nI','needle','I'),U(25,'cJ',1),
   U(27,'fA',1),U(29,'nI',0),U(32,'cB',0),U(34,'nC',0),
   P(36,'nH','needle','H'),U(38,'cB',0),T(40,'cB','strong',1),
  ],
 },
 {
  id:'iron-oath-bastions',modeId:'iron-oath',description:'Без продажи, фермы и знаний: пушки на B/J/C, отдельный ледяной коридор и резерв у выхода.',
  countermeasures:[
   '1–10: прочное раннее ядро cB, постепенное усиление и ручная наводка на босса; 1 утечка означает поражение.',
   '11–12: обнаружение bD вводится до волны с маскировкой, frost на I снижает риск скоростного прорыва.',
   '20–21: пушки B/J плюс needle E собирают и разбивают дочерние волны.',
   '31: разные источники урона и возможность обнаруживать скрытых; невозможность возврата денег учтена порядком покупок.',
   '40: резервная cC и needle H перехватывают последний участок, босса фокусируют сильной целью.',
  ],
  difficulty:'easy',seed:REPLAY_SEED,status:REPLAY_STATUS,allowedTowers:FIRST_VISIT_TOWERS,knowledge:[],expectedWaves:40,expectedMaxLives:1,
  actions:[
   P(1,'cB','cannon','B'),U(3,'cB',0),P(5,'nI','needle','I'),U(6,'nI',0),
   P(8,'fA','frost','A'),U(9,'cB',0),T(10,'cB','strong',1),
   P(11,'bD','beacon','D'),U(12,'bD',0),P(15,'cJ','cannon','J'),
   U(17,'cJ',1),P(19,'nE','needle','E'),U(20,'cJ',1),U(22,'nE',0),
   P(24,'cC','cannon','C'),U(26,'cC',0),U(28,'fA',1),
   P(30,'nH','needle','H'),U(32,'cB',0),U(34,'cJ',1),
   U(36,'nI',0),U(38,'cC',0),T(40,'cB','strong',1),
  ],
 },
] as const;

/** Wave-completion awards only: excludes all kill/layer bounties and passive income. */
export function guaranteedCreditsBeforeWave(wave:number,modeId:ReplayCandidate['modeId']):number {
 if(!Number.isInteger(wave)||wave<1||wave>41)throw new RangeError('Expected wave 1..41');
 const completed=wave-1;
 const normalAward=100*completed+5*completed*(completed+1)/2;
 return modeId==='half-cash'?500+Math.floor(normalAward/2):1000+normalAward;
}

export interface ReplayAudit {
 candidate:string;status:'won'|'lost'|'rejected';completedWaves:number;
 credits:number;lives:number;spent:number;earned:number;
 placements:{key:string;entity:string;site:string;creditsBefore:number;creditsAfter:number}[];
 failures:string[];
}

/**
 * Requires an actual, already-created GameEngine. Does not construct a mock
 * engine, amend credits, force enemy deaths, or imply a completed run.
 */
export function executeCandidate(engine:GameEngine,candidate:ReplayCandidate,maxTicksPerWave=18000):ReplayAudit {
 const start=engine.getSnapshot();
 const expected=[...candidate.allowedTowers].sort().join(',');
 if(start.options.mapId!=='lantern-garden'||start.options.difficulty!==candidate.difficulty||
    start.options.modeId!==candidate.modeId||start.options.seed!==candidate.seed||
    [...start.options.unlockedTowers].sort().join(',')!==expected||
    start.options.knowledge.length!==0||start.options.endless||start.options.players.length!==1||
    start.towers.length!==0||start.phase!=='build'||
    start.lives!==candidate.expectedMaxLives||start.rules.maxLives!==candidate.expectedMaxLives||
    start.credits!==guaranteedCreditsBeforeWave(1,candidate.modeId)||
    (candidate.modeId==='half-cash'&&
     (start.rules.startingCashMul!==0.5||start.rules.incomeMul!==0.5))||
    (candidate.modeId==='iron-oath'&&
     (start.rules.sellAllowed||start.rules.allowPassiveIncome||start.rules.allowKnowledge))){
  throw new Error('Engine/options do not match this unmodified first-visit solo replay');
 }
 if(candidate.actions.some(a=>a.wave<1||a.wave>40||a.tick<0||!Number.isInteger(a.tick))){
  throw new Error('Malformed action wave/tick');
 }
 if(!Number.isInteger(maxTicksPerWave)||maxTicksPerWave<1)throw new RangeError('Invalid tick cap');
 const placements:ReplayAudit['placements']=[],failures:string[]=[],ids=new Map<string,string>();
 const lookup:Map<string,Vec>=new Map(LAND_SITES.map(site=>[site.id,site.pos] as const));
 const handle=(move:ReplayMove):void=>{
  const before=engine.getSnapshot().credits;
  let command:GameAction;
  if(move.kind==='place'){
   const pos:Vec|undefined=lookup.get(move.site);
   if(!pos||!candidate.allowedTowers.includes(move.tower)||ids.has(move.key)){
    failures.push(`wave ${move.wave}/tick ${move.tick}: invalid site/tower/key ${move.key}`);return;
   }
   command={type:'place',tower:move.tower,pos};
  }else{
   const entity=ids.get(move.key);
   if(!entity){failures.push(`wave ${move.wave}/tick ${move.tick}: missing placed ${move.key}`);return;}
   command=move.kind==='upgrade'?{type:'upgrade',tower:entity,path:move.path}:{type:'target',tower:entity,targeting:move.targeting};
  }
  const response=engine.dispatch(command);
  if(!response.ok||response.pending){
   failures.push(`wave ${move.wave}/tick ${move.tick}: ${move.kind} ${move.key}: ${response.reason??'command rejected/pending'}`);return;
  }
  if(move.kind==='place'){
   if(!response.entity){failures.push(`wave ${move.wave}: place ${move.key} returned no entity id`);return;}
   ids.set(move.key,response.entity);
   placements.push({key:move.key,entity:response.entity,site:move.site,creditsBefore:before,creditsAfter:engine.getSnapshot().credits});
  }
 };
 const makeAudit=(status:ReplayAudit['status'],completedWaves:number):ReplayAudit=>{
  const state=engine.getSnapshot();
  return {candidate:candidate.id,status,completedWaves,credits:state.credits,lives:state.lives,
   spent:state.stats.spent,earned:state.stats.earned,placements,failures};
 };
 for(let wave=1;wave<=candidate.expectedWaves;wave++){
  const planned=candidate.actions.filter(a=>a.wave===wave).sort((a,b)=>a.tick-b.tick);
  for(const move of planned.filter(a=>a.tick===0))handle(move);
  if(failures.length>0)return makeAudit('rejected',wave-1);
  const startResult=engine.dispatch({type:'startWave'});
  if(!startResult.ok||startResult.pending){failures.push(`wave ${wave}: startWave rejected ${startResult.reason??''}`);return makeAudit('rejected',wave-1);}
  let ticks=0,next=0;
  const during=planned.filter(a=>a.tick>0);
  while(engine.getSnapshot().phase==='wave'&&ticks<maxTicksPerWave){
   ticks++;
   while(next<during.length&&during[next].tick===ticks)handle(during[next++]);
   if(failures.length>0)return makeAudit('rejected',wave-1);
   engine.step(1/60);
  }
  const state:GameState=engine.getSnapshot();
  if(ticks===maxTicksPerWave&&state.phase==='wave'){
   failures.push(`wave ${wave}: exceeded ${maxTicksPerWave} simulation ticks`);return makeAudit('rejected',wave-1);
  }
  if(next!==during.length){failures.push(`wave ${wave}: wave ended before planned action tick`);return makeAudit('rejected',wave-1);}
  if(state.phase==='defeat')return makeAudit('lost',wave-1);
  if(wave<40&&state.phase!=='build'){
   failures.push(`wave ${wave}: expected build phase after wave, found ${state.phase}`);return makeAudit('rejected',wave);
  }
  if(wave===40)return makeAudit(state.phase==='victory'?'won':'rejected',40);
 }
 return makeAudit('rejected',40);
}
