/**
 * Candidate, not a recorded victory. Call runCandidate() with a real GameEngine
 * after the combat, economy, campaign and wave systems are integrated.
 */
import type {GameEngine,GameAction,GameConfig,RunOptions,Vec,PathIndex} from '../../../src/contracts';
import {sites,canPlace} from './geometry';
import {getMap} from '../../../src/content/maps/black-lighthouse';

const STORY_TOWERS=[
  'needle','cannon','frost','beacon','scatter','ember','saw','venom',
  'rail','tesla','mortar','observatory','mint','orchard','drone','rocket',
  'resonator','forge','harbor','tide','coral','chrono','gravity','prism',
  'mirror','mine','portal','bank','storm',
] as const;
export const storyTowers:string[]=[...STORY_TOWERS];

export interface Purchase {
  wave:number;tick:number;action:'place'|'upgrade';alias:string;
  site:string;type?:string;path?:PathIndex;reason:string;
}
export interface ReplayCandidate {
  id:string;name:string;status:'unverified';victory:null;
  seed:number;modeId:'standard'|'half-cash'|'iron-oath';
  difficulty:'extreme';openingCredits:number;actions:Purchase[];
  adaptation:string[];
}

const standard:ReplayCandidate={
  id:'black-lighthouse-extreme-standard',name:'Перекрёстный огонь и дальний перехват',
  status:'unverified',victory:null,seed:0x56b1a,modeId:'standard',difficulty:'extreme',openingCredits:850,
  actions:[
    {wave:1,tick:0,action:'place',alias:'west-needle',site:'west-cross',type:'needle',reason:'раннее прикрытие северной и центральной полосы'},
    {wave:1,tick:0,action:'place',alias:'south-needle',site:'south-cross',type:'needle',reason:'ранняя защита южной дуги'},
    {wave:9,tick:0,action:'place',alias:'bend-cannon',site:'tide-ramp',type:'cannon',reason:'взрыв по двум полосам к первой босс-волне'},
    {wave:12,tick:0,action:'place',alias:'lens',site:'last-light',type:'observatory',reason:'раннее обнаружение перед волнами скрытности'},
    {wave:13,tick:0,action:'upgrade',alias:'lens',site:'last-light',path:0,reason:'ветка всевидящего ока для cloak/hollow'},
    {wave:18,tick:0,action:'place',alias:'freeze',site:'twin-arcs',type:'frost',reason:'замедление срединного подхода'},
    {wave:25,tick:0,action:'upgrade',alias:'west-needle',site:'west-cross',path:1,reason:'первая бронепробивная модификация'},
    {wave:28,tick:60,action:'upgrade',alias:'west-needle',site:'west-cross',path:1,reason:'второе бронепробитие во время волны'},
    {wave:35,tick:0,action:'place',alias:'long-rail',site:'signal-shelf',type:'rail',reason:'дальний огонь по боссу и короткой полосе'},
    {wave:40,tick:0,action:'upgrade',alias:'bend-cannon',site:'tide-ramp',path:0,reason:'широкий взрыв против приспешников регента'},
    {wave:45,tick:0,action:'place',alias:'north-mortar',site:'north-watch',type:'mortar',reason:'охват северного входа и дальнего поворота'},
    {wave:53,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'пробитие колонны'},
    {wave:59,tick:0,action:'upgrade',alias:'freeze',site:'twin-arcs',path:2,reason:'замедляющая зона при ускорении на 60-й волне'},
    {wave:64,tick:0,action:'upgrade',alias:'north-mortar',site:'north-watch',path:0,reason:'усилить взрыв на северном подходе'},
    {wave:70,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'второй уровень прострела'},
    {wave:77,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'дальняя специализация против элиты'},
    {wave:81,tick:0,action:'place',alias:'storm-south',site:'southern-redoubt',type:'storm',reason:'wet+electric контроль общего выхода'},
    {wave:85,tick:0,action:'upgrade',alias:'bend-cannon',site:'tide-ramp',path:0,reason:'второй круг взрывного урона'},
    {wave:91,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'четвёртая ступень прострела'},
    {wave:96,tick:0,action:'upgrade',alias:'storm-south',site:'southern-redoubt',path:1,reason:'грозовой урон по щитам'},
    {wave:99,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'пятая специализация до Затмения'},
  ],
  adaptation:['При массовых split/swarm перевести огонь на cannon/mortar и поднять их A до T3.',
    'При щитах применять storm/rail, при cloak проверять радиус observatory A1.',
    'Дефицит урона на ранней южной дуге закрывать игломётом, не продавая ранние башни.'],
};

const halfCash:ReplayCandidate={
  id:'black-lighthouse-extreme-half-cash',name:'Экономия заслона и приливная ферма',
  status:'unverified',victory:null,seed:0x56b1b,modeId:'half-cash',difficulty:'extreme',openingCredits:425,
  actions:[
    {wave:1,tick:0,action:'place',alias:'west-needle',site:'west-cross',type:'needle',reason:'дешёвое покрытие первого двухполосного сектора'},
    {wave:8,tick:0,action:'place',alias:'south-needle',site:'south-cross',type:'needle',reason:'южный вход до первой встречи с боссом'},
    {wave:16,tick:0,action:'place',alias:'lens',site:'last-light',type:'observatory',reason:'раннее обнаружение (нужен доход со слоёв)'},
    {wave:18,tick:0,action:'upgrade',alias:'lens',site:'last-light',path:0,reason:'раскрытие скрытых'},
    {wave:24,tick:0,action:'place',alias:'freeze',site:'twin-arcs',type:'frost',reason:'контроль быстро идущей центральной полосы'},
    {wave:31,tick:0,action:'place',alias:'orchard',site:'southern-redoubt',type:'orchard',reason:'ограниченный доход за оставшиеся раунды'},
    {wave:36,tick:0,action:'place',alias:'bend-cannon',site:'tide-ramp',type:'cannon',reason:'взрыв по двум поздним подходам'},
    {wave:44,tick:0,action:'upgrade',alias:'orchard',site:'southern-redoubt',path:0,reason:'усилить ограниченный доход'},
    {wave:52,tick:0,action:'place',alias:'north-mortar',site:'north-watch',type:'mortar',reason:'дальний охват северного входа'},
    {wave:61,tick:0,action:'upgrade',alias:'bend-cannon',site:'tide-ramp',path:0,reason:'поднять массовый урон'},
    {wave:68,tick:0,action:'upgrade',alias:'freeze',site:'twin-arcs',path:2,reason:'замедление на центральной дуге'},
    {wave:74,tick:0,action:'place',alias:'long-rail',site:'signal-shelf',type:'rail',reason:'переключиться на тяжёлых боссов'},
    {wave:79,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'увеличить пробитие'},
    {wave:85,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'больше дальнего урона'},
    {wave:90,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'специализация по колоннам'},
    {wave:95,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'четвёртая ступень'},
    {wave:99,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'пятая ступень для 100-й волны'},
  ],
  adaptation:['Покупка обсерватории на 16-й волне требует оплаченных слоёв; при нехватке денег кандидат невалиден и подлежит пересборке.',
    'Если ферма не окупается до 80-й волны, заменить Orchard на боевой Rail и доказать проход replay.',
    'Оставить reserve на быстрых dart/lemon; half-cash уменьшает также награду за волны.'],
};

const ironOath:ReplayCandidate={
  id:'black-lighthouse-extreme-iron-oath',name:'Безотказный осадный коридор',
  status:'unverified',victory:null,seed:0x56b1c,modeId:'iron-oath',difficulty:'extreme',openingCredits:850,
  actions:[
    {wave:1,tick:0,action:'place',alias:'west-needle',site:'west-cross',type:'needle',reason:'защита верхней и центральной полосы'},
    {wave:1,tick:0,action:'place',alias:'south-needle',site:'south-cross',type:'needle',reason:'юг прикрыт с первого тика'},
    {wave:9,tick:0,action:'place',alias:'bend-cannon',site:'tide-ramp',type:'cannon',reason:'босс и ранние группы'},
    {wave:12,tick:0,action:'place',alias:'lens',site:'last-light',type:'observatory',reason:'не дать скрытым пройти в 1 HP'},
    {wave:13,tick:0,action:'upgrade',alias:'lens',site:'last-light',path:0,reason:'обнаружение всех cloak/hollow'},
    {wave:21,tick:0,action:'place',alias:'freeze',site:'twin-arcs',type:'frost',reason:'безопасный контроль входа в общую зону'},
    {wave:27,tick:0,action:'upgrade',alias:'bend-cannon',site:'tide-ramp',path:0,reason:'снять мелкую свиту босса'},
    {wave:36,tick:0,action:'place',alias:'north-mortar',site:'north-watch',type:'mortar',reason:'не допускать переразгона северных элит'},
    {wave:43,tick:0,action:'place',alias:'long-rail',site:'signal-shelf',type:'rail',reason:'приоритет босса и бронированных'},
    {wave:50,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'броня и королевские колонны'},
    {wave:59,tick:0,action:'upgrade',alias:'freeze',site:'twin-arcs',path:2,reason:'контроль против ускорения'},
    {wave:66,tick:0,action:'upgrade',alias:'north-mortar',site:'north-watch',path:0,reason:'площадь против split'},
    {wave:73,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'длинная линия прострела'},
    {wave:80,tick:0,action:'place',alias:'storm-south',site:'southern-redoubt',type:'storm',reason:'вода и электричество для щитов'},
    {wave:85,tick:0,action:'upgrade',alias:'bend-cannon',site:'tide-ramp',path:0,reason:'усиление массового урона'},
    {wave:90,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'третий уровень пробития'},
    {wave:95,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'четвёртый уровень'},
    {wave:99,tick:0,action:'upgrade',alias:'long-rail',site:'signal-shelf',path:1,reason:'последний уровень до Затмения'},
  ],
  adaptation:['Никаких mint/bank/orchard и продаж: iron-oath запрещает пассивный доход и не допускает восстановления после утечки.',
    'Перед 60/80/100 волнами дождаться фактического бюджета апгрейдов, не выдавая предположение за доказательство.',
    'Если поражение при одном HP — фиксировать номер волны и менять состав, а не добавлять стартовые кредиты.'],
};

export const replayCandidates:ReplayCandidate[]=[standard,halfCash,ironOath];

const baseCosts:Record<string,number>={needle:250,cannon:550,frost:500,beacon:600,
  rail:950,tesla:800,mortar:800,observatory:650,orchard:700,storm:1100};
const multipliers=[0.5,1,2.5,6,15];

/** This is NOT actual pricing: tower modules may choose non-1 path factors. */
export function estimatedBudget(plan:ReplayCandidate){
  const tiers:Record<string,[number,number,number]>={};
  let spent=0;
  return plan.actions.map(step=>{
    let estimate=0;
    if(step.action==='place'){
      const base=baseCosts[step.type??''];
      if(base===undefined)throw new Error(`Unknown assumed base cost: ${step.type}`);
      estimate=Math.ceil(base*1.2);tiers[step.alias]=[0,0,0];
    }else{
      const base=baseCosts[plan.actions.find(a=>a.action==='place'&&a.alias===step.alias)?.type??''];
      const tier=++tiers[step.alias][step.path??0];
      if(!base||!multipliers[tier-1])throw new Error(`Invalid estimated upgrade ${step.alias}`);
      estimate=Math.ceil(Math.ceil(base*multipliers[tier-1]/5)*5*1.2);
    }
    spent+=estimate;
    const n=step.wave-1;
    const guaranteedRounds=(50*n+n*(n+1))*(plan.modeId==='half-cash'?0.5:1);
    const layerCashNeeded=Math.max(0,spent-plan.openingCredits-guaranteedRounds);
    return {...step,estimatedCost:estimate,estimatedTotalSpent:spent,
      guaranteedRoundsBefore:guaranteedRounds,layerCashNeeded};
  });
}

export function makeRunOptions(plan:ReplayCandidate):RunOptions {
  return {mapId:'black-lighthouse',difficulty:plan.difficulty,seed:plan.seed,endless:false,
    modeId:plan.modeId,unlockedTowers:[...STORY_TOWERS],players:[{id:'solo',name:'Defender',color:'#f4cf97',connected:true}],
    runId:`validation-${plan.id}`,knowledge:[]};
}

export function auditCandidates():string[] {
  const errors:string[]=[],map=getMap();
  const ids=new Set<string>();
  for(const plan of replayCandidates){
    if(ids.has(plan.id))errors.push(`duplicate plan ${plan.id}`);ids.add(plan.id);
    if(plan.status!=='unverified'||plan.victory!==null)errors.push(`false verification status ${plan.id}`);
    const aliases=new Map<string,string>();
    let lastWave=0,lastTick=-1;
    for(const step of plan.actions){
      if(step.wave<lastWave||(step.wave===lastWave&&step.tick<lastTick))errors.push(`${plan.id} unsorted purchase schedule`);
      lastWave=step.wave;lastTick=step.tick;
      if(step.wave<1||step.wave>100||step.tick<0||!Number.isInteger(step.tick))errors.push(`${plan.id} invalid wave/tick`);
      const site=sites.find(s=>s.id===step.site);
      if(!site)errors.push(`${plan.id} unknown site: ${step.site}`);
      else if(!canPlace(map,site.pos,site.radius,site.kind))errors.push(`${plan.id} illegal site: ${site.id}`);
      if(step.action==='place'){
        if(!step.type||!STORY_TOWERS.includes(step.type as typeof STORY_TOWERS[number]))errors.push(`${plan.id} locked tower: ${step.type}`);
        if(aliases.has(step.alias))errors.push(`${plan.id} reused tower alias: ${step.alias}`);
        if([...aliases.values()].includes(step.site))errors.push(`${plan.id} overlapping named hardpoint: ${step.site}`);
        aliases.set(step.alias,step.site);
        if(site?.kind==='water'&&step.type&&!['harbor','tide','coral'].includes(step.type))errors.push(`${plan.id} non-water tower on water site`);
      }else{
        if(!aliases.has(step.alias)||aliases.get(step.alias)!==step.site)errors.push(`${plan.id} upgrade missing tower ${step.alias}`);
        if(step.path===undefined)errors.push(`${plan.id} upgrade missing path`);
      }
    }
    estimatedBudget(plan);
    const towers=plan.actions.filter(a=>a.action==='place');
    if(towers.length<3)errors.push(`${plan.id} lacks credible placements`);
    const opening=estimatedBudget(plan).filter(x=>x.wave===1&&x.tick===0);
    if(opening.length&&opening.at(-1)!.estimatedTotalSpent>plan.openingCredits)errors.push(`${plan.id} impossible opening`);
  }
  return errors;
}

export interface ReplayResult {
  plan:string;won:boolean;status:'verified'|'failed';
  wave:number;lives:number;credits:number;tick:number;message:string;
}

/**
 * A deterministic real-engine adapter, never a mocked victory. The host's
 * wave/build transitions, economy and spawn schedule remain authoritative.
 */
export function runCandidate(engine:GameEngine,plan:ReplayCandidate,maxTicks=1_200_000):ReplayResult {
  if(auditCandidates().length)throw new Error(`Invalid fixture: ${auditCandidates().join('; ')}`);
  if(engine.getSnapshot().options.mapId!=='black-lighthouse')throw new Error('Wrong map on engine');
  const names=new Map<string,string>();
  const map=getMap();
  let completed=0,active=false,tickInWave=0,next=0;
  const fail=(message:string):ReplayResult=>{
    const s=engine.getSnapshot();
    return {plan:plan.id,won:false,status:'failed',wave:s.wave,lives:s.lives,credits:s.credits,tick:s.tick,message};
  };
  const purchase=(p:Purchase):string|null=>{
    let action:GameAction;
    if(p.action==='place'){
      const site=sites.find(s=>s.id===p.site)!;
      action={type:'place',tower:p.type!,pos:{...site.pos}};
    }else{
      const id=names.get(p.alias);
      if(!id)return `No built entity for ${p.alias}`;
      action={type:'upgrade',tower:id,path:p.path!};
    }
    const r=engine.dispatch(action);
    if(!r.ok||r.pending)return `Rejected ${p.action} ${p.alias} on wave ${p.wave}: ${r.reason??'pending/unknown'}`;
    if(p.action==='place'){
      const site=sites.find(s=>s.id===p.site)!;
      const state=engine.getSnapshot();
      const entity=r.entity??state.towers.find(t=>t.defId===p.type&&
        Math.hypot(t.pos.x-site.pos.x,t.pos.y-site.pos.y)<0.01&&!names.has(p.alias))?.id;
      if(!entity)return `No confirmed tower entity after ${p.alias}`;
      names.set(p.alias,entity);
    }
    return null;
  };
  for(let i=0;i<maxTicks;i++){
    const s=engine.getSnapshot();
    if(s.phase==='victory'){
      if(next!==plan.actions.length)return fail('Victory arrived before scheduled final actions');
      return {plan:plan.id,won:s.lives>0,status:s.lives>0?'verified':'failed',wave:s.wave,
        lives:s.lives,credits:s.credits,tick:s.tick,message:s.lives>0?'Full engine victory':'Victory without lives'};
    }
    if(s.phase==='defeat')return fail(`Defeat on wave ${s.wave}`);
    const wave=completed+1;
    if(s.phase==='build'){
      if(active){completed++;active=false;tickInWave=0;continue;}
      while(next<plan.actions.length&&plan.actions[next].wave===wave&&plan.actions[next].tick===0){
        const message=purchase(plan.actions[next]);if(message)return fail(message);next++;
      }
      if(next<plan.actions.length&&plan.actions[next].wave<wave)return fail('Skipped a purchase wave');
      const start=engine.dispatch({type:'startWave'});
      if(!start.ok||start.pending)return fail(`Cannot start wave ${wave}: ${start.reason??'pending'}`);
      active=true;tickInWave=0;
      continue;
    }
    if(s.phase!=='wave')return fail(`Unknown phase ${s.phase}`);
    active=true;
    while(next<plan.actions.length&&plan.actions[next].wave===wave&&plan.actions[next].tick<=tickInWave){
      const message=purchase(plan.actions[next]);if(message)return fail(message);next++;
    }
    if(next<plan.actions.length&&plan.actions[next].wave<wave)return fail(`Missed action on wave ${plan.actions[next].wave}`);
    engine.step(1/60);
    tickInWave++;
  }
  return fail(`Exceeded ${maxTicks} simulation ticks`);
}
