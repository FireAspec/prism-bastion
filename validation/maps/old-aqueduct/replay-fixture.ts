import type {GameEngine,GameState,PathIndex,Vec} from '../../../src/contracts';
import {positions,type PositionKey} from './check-geometry';

/** These plans are candidates, not certified wins. A merged engine must run them. */
export type PlanAction=(
 |{kind:'place';tower:string;alias:string;site:PositionKey}
 |{kind:'upgrade';alias:string;path:PathIndex}
) & {wave:number;tick:number};
export interface ReplayCandidate{
 id:string;name:string;verification:'unverified';mapId:'old-aqueduct';
 difficulty:'easy';modeId:'standard'|'half-cash'|'iron-oath';seed:number;rounds:40;
 knowledge:[];unlockedTowers:readonly string[];goals:{victory:true;minimumLives:number};
 actions:PlanAction[];notes:string[];
}
export const firstArrivalTowers=['needle','cannon','frost','beacon','scatter','ember','saw','venom','rail','tesla'] as const;
const place=(wave:number,site:PositionKey,tower:string,alias:string,tick=0):PlanAction=>({kind:'place',wave,tick,site,tower,alias});
const upgrade=(wave:number,alias:string,path:PathIndex,tick=0):PlanAction=>({kind:'upgrade',wave,tick,alias,path});

export const candidates:ReplayCandidate[]=[
 {
  id:'old-aqueduct-standard-west',name:'Западный заслон и противощитовый рубеж',verification:'unverified',
  mapId:'old-aqueduct',difficulty:'easy',modeId:'standard',seed:410401,rounds:40,knowledge:[],unlockedTowers:firstArrivalTowers,goals:{victory:true,minimumLives:1},
  notes:['Две начальные линии держат обе арки; монеты расходуются на реальные улучшения.','Needle B и Cannon C борются с бронёй на 10-й волне, Beacon B раскрывает скрытых.','Tesla B с Venom B отвечают щитам, Rail A и Cannon A — боссам, Scatter A — потомкам.'],
  actions:[
   place(1,'westHigh','needle','west-needle'),place(1,'westLow','scatter','fan'),place(1,'archOneLow','needle','middle-needle'),
   place(4,'archOneHigh','frost','frost'),upgrade(6,'west-needle',1),
   place(8,'archTwoHigh','cannon','cannon'),upgrade(9,'cannon',2),
   place(11,'crossingBeacon','beacon','reveal'),upgrade(12,'reveal',1),
   place(13,'narrowsLow','tesla','tesla'),upgrade(15,'tesla',1),
   place(16,'eastHigh','venom','venom'),upgrade(17,'venom',1),
   place(18,'eastLow','rail','boss-rail'),upgrade(19,'boss-rail',0),
   upgrade(20,'fan',0),upgrade(21,'cannon',0),
   place(22,'narrowsHigh','ember','embers'),upgrade(23,'embers',2),
   upgrade(24,'middle-needle',1),upgrade(25,'tesla',1),
   place(27,'archTwoLow','saw','last-ditch'),upgrade(28,'boss-rail',0),
   upgrade(29,'fan',0),upgrade(30,'cannon',0),upgrade(31,'boss-rail',0),
   upgrade(32,'tesla',1),upgrade(33,'reveal',1),upgrade(34,'boss-rail',0),
   upgrade(35,'cannon',0),upgrade(36,'fan',0),upgrade(37,'venom',1),
   upgrade(38,'last-ditch',1),upgrade(39,'embers',2),
  ],
 },
 {
  id:'old-aqueduct-half-cash-east',name:'Бережливое снабжение и восточный перехват',verification:'unverified',
  mapId:'old-aqueduct',difficulty:'easy',modeId:'half-cash',seed:410402,rounds:40,knowledge:[],unlockedTowers:firstArrivalTowers,goals:{victory:true,minimumLives:1},
  notes:['Начальные 500 кредитов: два игломёта по 213, остаток 74.','Пушка на 8-й волне встречает броню; Beacon B — обязательное раскрытие скрытых с 11-й.','Без дополнительных денежных способностей; поздние Tesla B и Rail A прикрывают щиты и боссов.'],
  actions:[
   place(1,'westHigh','needle','west-needle'),place(1,'westLow','needle','west-guard'),
   place(8,'archTwoHigh','cannon','cannon'),upgrade(9,'west-needle',1),upgrade(10,'cannon',2),
   place(11,'crossingBeacon','beacon','reveal'),upgrade(12,'reveal',1),
   place(16,'narrowsLow','frost','frost'),upgrade(17,'frost',2),
   place(22,'archTwoLow','tesla','tesla'),upgrade(23,'tesla',1),
   upgrade(24,'cannon',0),upgrade(25,'west-guard',0),
   place(28,'eastHigh','rail','boss-rail'),upgrade(29,'boss-rail',0),
   upgrade(30,'tesla',1),upgrade(31,'boss-rail',0),
   place(34,'eastLow','venom','venom'),upgrade(35,'venom',1),
   upgrade(36,'boss-rail',0),upgrade(37,'cannon',0),
   upgrade(38,'tesla',1),upgrade(39,'boss-rail',0),
  ],
 },
 {
  id:'old-aqueduct-iron-oath-middle',name:'Несокрушимый центр без продаж и знаний',verification:'unverified',
  mapId:'old-aqueduct',difficulty:'easy',modeId:'iron-oath',seed:410403,rounds:40,knowledge:[],unlockedTowers:firstArrivalTowers,goals:{victory:true,minimumLives:1},
  notes:['Вся тысяча кредитов: needle 213, frost 425, scatter 362.','Потеря любой жизни запрещена, фарм, harvest, продажа и знания не предусмотрены.','Frost контролирует подход, Tesla B ломает щиты, Rail A добивает зеркального босса.'],
  actions:[
   place(1,'westHigh','needle','west-needle'),place(1,'archOneHigh','frost','frost'),place(1,'westLow','scatter','fan'),
   place(3,'narrowsLow','needle','middle-needle'),
   place(7,'archTwoHigh','cannon','cannon'),upgrade(8,'west-needle',1),upgrade(10,'cannon',2),
   place(11,'crossingBeacon','beacon','reveal'),upgrade(12,'reveal',1),
   place(15,'archTwoLow','tesla','tesla'),upgrade(16,'tesla',1),
   place(19,'eastHigh','venom','venom'),upgrade(20,'venom',1),
   place(24,'eastLow','rail','boss-rail'),upgrade(25,'boss-rail',0),
   upgrade(26,'fan',0),upgrade(27,'cannon',0),
   place(28,'narrowsHigh','ember','embers'),upgrade(29,'embers',2),
   upgrade(30,'middle-needle',1),upgrade(31,'tesla',1),
   upgrade(32,'boss-rail',0),upgrade(33,'frost',2),
   upgrade(34,'boss-rail',0),upgrade(35,'cannon',0),
   upgrade(36,'fan',0),upgrade(37,'tesla',1),
   upgrade(38,'boss-rail',0),upgrade(39,'embers',2),
  ],
 },
];

export interface ActionReceipt{wave:number;tick:number;kind:PlanAction['kind'];alias:string;cost:number;creditsAfter:number;}
export interface ReplayReport{candidate:string;verification:'verified'|'failed';won:boolean;wave:number;lives:number;credits:number;totalTicks:number;receipts:ActionReceipt[];error?:string;}

/**
 * The central verifier injects its real GameEngine, already initialized with
 * the complete config and the candidate's seed/options. No money or health
 * is ever injected. Every step is exactly one fixed 1/60s simulation tick.
 */
export function executeCandidate(engine:GameEngine,plan:ReplayCandidate):ReplayReport{
 let last:GameState=engine.getSnapshot(),totalTicks=0;
 const receipts:ActionReceipt[]=[],aliases=new Map<string,string>();
 const result=(verification:'verified'|'failed',error?:string):ReplayReport=>({candidate:plan.id,verification,won:last.phase==='victory',wave:last.wave,lives:last.lives,credits:last.credits,totalTicks,receipts,...(error?{error}:{})});
 try{
  if(last.options.mapId!==plan.mapId||last.options.difficulty!==plan.difficulty||last.options.modeId!==plan.modeId||last.options.seed!==plan.seed)throw Error('Run options differ from replay fixture');
  if(last.options.knowledge.length||last.options.unlockedTowers.some(x=>!plan.unlockedTowers.includes(x)))throw Error('Illegal knowledge or towers');
  if(last.phase!=='build')throw Error('Replay must start at build phase');
  const actions=[...plan.actions].sort((a,b)=>a.wave-b.wave||a.tick-b.tick);
  let cursor=0;
  function purchase(a:PlanAction){
   const before=engine.getSnapshot();
   if(a.kind==='upgrade'&&!aliases.has(a.alias))throw Error(`Unknown upgrade alias ${a.alias}`);
   const cmd=a.kind==='place'?{type:'place' as const,tower:a.tower,pos:positions[a.site] as Vec}:{type:'upgrade' as const,tower:aliases.get(a.alias)??'',path:a.path};
   const confirmation=engine.dispatch(cmd);
   if(!confirmation.ok||confirmation.pending)throw Error(`Rejected action w${a.wave} t${a.tick} ${a.alias}: ${confirmation.reason??'pending'}`);
   const after=engine.getSnapshot();
   if(after.credits<0||after.credits>before.credits)throw Error('Invalid credit movement');
   if(a.kind==='place'){
    const previousIds=new Set(before.towers.map(t=>t.id));
    const created=after.towers.find(t=>!previousIds.has(t.id));
    const id=confirmation.entity??created?.id;
    if(!id||!after.towers.some(t=>t.id===id&&t.defId===a.tower)||aliases.has(a.alias))throw Error(`Unconfirmed placement ${a.alias}`);
    aliases.set(a.alias,id);
   }
   receipts.push({wave:a.wave,tick:a.tick,kind:a.kind,alias:a.alias,cost:before.credits-after.credits,creditsAfter:after.credits});
  }
  for(let wave=1;wave<=plan.rounds;wave++){
   last=engine.getSnapshot();
   if(last.phase!=='build')throw Error(`Expected build before wave ${wave}; got ${last.phase}`);
   while(actions[cursor]?.wave===wave&&actions[cursor].tick===0)purchase(actions[cursor++]);
   const started=engine.dispatch({type:'startWave'});
   if(!started.ok||started.pending)throw Error(`Cannot start wave ${wave}`);
   let tick=0;
   while(true){
    last=engine.getSnapshot();if(last.phase!=='wave')break;
    if(++tick>36000)throw Error(`Wave ${wave} exceeded 600 simulated seconds`);
    while(actions[cursor]?.wave===wave&&actions[cursor].tick===tick)purchase(actions[cursor++]);
    engine.step(1/60);totalTicks++;
   }
   if(last.phase==='defeat')throw Error(`Defeat on wave ${wave}`);
   if(wave<plan.rounds&&last.phase==='victory')throw Error(`Premature victory ${wave}`);
  }
  last=engine.getSnapshot();
  if(cursor!==actions.length||last.phase!=='victory'||last.lives<plan.goals.minimumLives)throw Error('Replay did not meet final victory criteria');
  return result('verified');
 }catch(e){last=engine.getSnapshot();return result('failed',e instanceof Error?e.message:String(e));}
}
