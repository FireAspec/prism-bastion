import type {GameAction,GameConfig,GameEngine,RunOptions,Vec} from '../../../src/contracts';
import data from './strategies.json';

export type PlanAction=
  | {wave:number;tick:number;type:'place';site:string;position:Vec;tower:string;bind:string}
  | {wave:number;tick:number;type:'upgrade';ref:string;path:0|1|2};
export type ReplayCase={id:string;modeId:string;seed:number;startingCredits:number;startingLives:number;hypothesis:string;actions:PlanAction[]};
export type ReplayProgram={schema:1;contractVersion:1;mapId:string;replayStatus:'unverified';difficulty:'normal';rounds:number;
  profile:{unlockedTowers:string[];knowledge:string[]};budgetNotes:string;cases:ReplayCase[]};
export type Purchase={wave:number;tick:number;action:PlanAction;creditsBefore:number;creditsAfter:number;cost:number;entity?:string};
export type ReplayResult={id:string;checkedAgainstEngine:boolean;won:boolean;phase:string;completedWaves:number;finalLives:number;finalCredits:number;purchases:Purchase[];failure?:string};
export const replayProgram=data as ReplayProgram;

export function validateReplayProgram(p:ReplayProgram=replayProgram):string[]{
  const errors:string[]=[];
  if(p.schema!==1||p.contractVersion!==1||p.replayStatus!=='unverified'||p.mapId!=='tidal-docks'||p.difficulty!=='normal'||p.rounds!==60)errors.push('schema/progression mismatch');
  if(p.profile.knowledge.length||p.profile.unlockedTowers.includes('harbor')||p.profile.unlockedTowers.length!==18)errors.push('locked technology in first-arrival profile');
  if(p.cases.length!==3||new Set(p.cases.map(c=>c.modeId)).size!==3)errors.push('three mode cases required');
  for(const c of p.cases){
    if(!['standard','half-cash','iron-oath'].includes(c.modeId))errors.push(`${c.id}: mode`);
    if(c.startingCredits!==(c.modeId==='half-cash'?450:900)||c.startingLives!==(c.modeId==='iron-oath'?1:150))errors.push(`${c.id}: economy`);
    if(!Number.isSafeInteger(c.seed)||c.seed<1)errors.push(`${c.id}: seed`);
    let previousWave=0,previousTick=0;
    const binds=new Set<string>(),positions:Vec[]=[];
    for(const [i,a] of c.actions.entries()){
      if(!Number.isInteger(a.wave)||a.wave<1||a.wave>p.rounds||!Number.isInteger(a.tick)||a.tick<0)errors.push(`${c.id}:${i} invalid wave/tick`);
      if(a.wave<previousWave||(a.wave===previousWave&&a.tick<previousTick))errors.push(`${c.id}:${i} actions unordered`);
      previousWave=a.wave;previousTick=a.tick;
      if(a.type==='place'){
        if(!p.profile.unlockedTowers.includes(a.tower))errors.push(`${c.id}: locked ${a.tower}`);
        if(binds.has(a.bind))errors.push(`${c.id}: duplicate bind`);
        binds.add(a.bind);
        if(!Number.isFinite(a.position.x)||!Number.isFinite(a.position.y)||positions.some(pos=>Math.hypot(pos.x-a.position.x,pos.y-a.position.y)<48))errors.push(`${c.id}: invalid/colliding placement`);
        positions.push(a.position);
        if(c.modeId==='iron-oath'&&['mint','orchard','bank'].includes(a.tower))errors.push(`${c.id}: forbidden income tower`);
      } else if(a.type==='upgrade'){
        if(!binds.has(a.ref)||![0,1,2].includes(a.path))errors.push(`${c.id}: upgrade ref/path`);
      } else errors.push(`${c.id}: command`);
    }
  }
  return errors;
}

/**
 * Central balance suite must inject the real catalog and real engine factory.
 * Tick 0 = build phase immediately before wave, >0 = fixed 1/60-s ticks in wave.
 * Every purchase uses real engine credits and MUST be accepted; nothing is skipped.
 */
export function runReplay(config:GameConfig,createEngine:(options:RunOptions)=>GameEngine,c:ReplayCase,maxWaveTicks=60*180):ReplayResult {
  const errors=validateReplayProgram();
  if(errors.length)throw new Error(errors.join('; '));
  if(!replayProgram.cases.some(plan=>plan.id===c.id))throw new Error('unknown replay case');
  const options:RunOptions={mapId:'tidal-docks',modeId:c.modeId,difficulty:'normal',seed:c.seed,endless:false,
    unlockedTowers:[...replayProgram.profile.unlockedTowers],knowledge:[],runId:`tidal-docks-${c.id}-${c.seed}`,
    players:[{id:'solo',name:'Solo',color:'#8ddbcc',connected:true}]};
  void config; // Catalog ownership stays with injected factory, not with the fixture.
  const game=createEngine(options),binds=new Map<string,string>(),purchases:Purchase[]=[];
  const state=()=>game.getSnapshot();
  let completedWaves=0,next=0;
  const fail=(reason:string):ReplayResult=>({id:c.id,checkedAgainstEngine:true,won:false,phase:state().phase,completedWaves,finalLives:state().lives,finalCredits:state().credits,purchases,failure:reason});
  if(state().credits!==c.startingCredits||state().lives!==c.startingLives)return fail(`unexpected initial credits/lives ${state().credits}/${state().lives}`);
  const purchase=(wave:number,tick:number):string|undefined=>{
    while(next<c.actions.length&&c.actions[next].wave===wave&&c.actions[next].tick===tick){
      const a=c.actions[next++],before=state();
      let action:GameAction;
      if(a.type==='place')action={type:'place',tower:a.tower,pos:{...a.position}};
      else {const entity=binds.get(a.ref);if(!entity)return `unknown entity ${a.ref}`;action={type:'upgrade',tower:entity,path:a.path};}
      const result=game.dispatch({...action,actor:'solo'});
      if(!result.ok||result.pending)return `wave ${wave} tick ${tick}: ${a.type} rejected (${result.reason??'pending'})`;
      const after=state();
      if(after.credits<0||after.credits>before.credits)return `invalid purchase credits wave ${wave}`;
      let entity=result.entity;
      if(a.type==='place'){
        entity??=after.towers.find(t=>!before.towers.some(p=>p.id===t.id))?.id;
        if(!entity)return `successful place has no entity at wave ${wave}`;
        binds.set(a.bind,entity);
      }
      purchases.push({wave,tick,action:a,creditsBefore:before.credits,creditsAfter:after.credits,cost:before.credits-after.credits,entity});
    }
    return undefined;
  };
  for(let wave=1;wave<=60;wave++){
    if(state().phase!=='build')return fail(`wave ${wave}: build phase missing`);
    const initial=purchase(wave,0);if(initial)return fail(initial);
    const started=game.dispatch({type:'startWave',actor:'solo'});
    if(!started.ok||started.pending)return fail(`wave ${wave} did not start`);
    let tick=0;
    while(state().phase==='wave'&&tick<maxWaveTicks){
      game.step(1/60);tick++;
      const issue=purchase(wave,tick);if(issue)return fail(issue);
      if(state().credits<0)return fail(`wave ${wave}: negative cash`);
    }
    if(state().phase==='wave')return fail(`wave ${wave} timeout`);
    if(next<c.actions.length&&c.actions[next].wave===wave)return fail(`wave ${wave} ended before scheduled tick ${c.actions[next].tick}`);
    if(state().phase==='defeat')return fail(`defeat wave ${wave}`);
    completedWaves=wave;
    if(state().phase==='victory'&&wave<60)return fail('early victory');
  }
  const final=state(),won=final.phase==='victory'&&final.lives>0;
  return {id:c.id,checkedAgainstEngine:true,won,phase:final.phase,completedWaves,finalLives:final.lives,finalCredits:final.credits,purchases,...(won?{}:{failure:'no valid victory after wave 60'})};
}
