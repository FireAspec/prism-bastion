import type {GameEngine,PathIndex,PlayerInfo,RunOptions,Vec} from '../../../src/contracts';
import {WORLD} from '../../../src/contracts';

/** Declarative candidate: never interpreted as evidence of a win on its own. */
export type ReplayAction =
 | {beforeWave:number;tick:number;type:'place';key:string;tower:string;pos:Vec;baseHardCost:number}
 | {beforeWave:number;tick:number;type:'upgrade';target:string;path:PathIndex};
export interface ReplayCandidate {
 id:string;modeId:'standard'|'half-cash'|'iron-oath';status:'unverified';
 startingCredits:number;startingLives:number;goal:string;actions:ReplayAction[];
}
export interface ReplayFixture {
 schemaVersion:1;mapId:'glass-switchback';seed:number;difficulty:'hard';rounds:80;
 players:PlayerInfo[];availableAtFirstArrival:string[];candidates:ReplayCandidate[];
}
export interface ReplayResult {
 candidateId:string;status:'attempted'|'blocked';won:boolean;wave:number;lives:number;
 credits:number;tick:number;actionsDispatched:number;rejectedActions:number;reason:string;
}
export function optionsFor(fixture:ReplayFixture,candidate:ReplayCandidate):RunOptions {
 return {mapId:fixture.mapId,difficulty:'hard',seed:fixture.seed,endless:false,
  modeId:candidate.modeId,unlockedTowers:[...fixture.availableAtFirstArrival],
  players:fixture.players.map(p=>({...p})),runId:`glass-switchback-${candidate.id}`,knowledge:[]};
}

/**
 * Feed one real GameEngine instance through all 80 rounds. No credits are
 * injected, failures are fatal, and game-computed rewards are never replaced.
 * The caller must build a fresh engine with optionsFor() and the canonical
 * content/rules. Until the engine is implemented, this is a runnable contract,
 * not a claim that any candidate can win.
 */
export function runCandidate(engine:GameEngine,candidate:ReplayCandidate,maxTicksPerWave=72000):ReplayResult {
 const aliases=new Map<string,string>();
 let actionsDispatched=0,rejectedActions=0,reason='';
 let status:'attempted'|'blocked'='attempted';
 const failure=(why:string)=>{reason=why;status='blocked';};
 const current=()=>engine.getSnapshot();
 const ordered=[...candidate.actions].sort((a,b)=>a.beforeWave-b.beforeWave||a.tick-b.tick);
 const initial=current();
 if(initial.options.mapId!=='glass-switchback'||initial.options.modeId!==candidate.modeId||initial.options.difficulty!=='hard')failure('Engine run options do not match the candidate');
 if(initial.phase!=='build')failure('Engine must start in the build phase');
 if(initial.credits!==candidate.startingCredits)failure(`Expected ${candidate.startingCredits} starting credits, got ${initial.credits}`);
 if(initial.lives!==candidate.startingLives)failure(`Expected ${candidate.startingLives} lives, got ${initial.lives}`);
 for(let wave=1;wave<=80&&!reason;wave++){
  if(current().phase!=='build'){failure(`Not in build phase before wave ${wave}`);break;}
  for(const action of ordered.filter(a=>a.beforeWave===wave)){
   if(action.tick!==0){failure(`Wave ${wave} action requires unsupported nonzero tick`);break;}
   if(action.type==='place'){
    if(aliases.has(action.key)){failure(`Repeated tower alias ${action.key}`);break;}
    const result=engine.dispatch({type:'place',tower:action.tower,pos:action.pos,actor:'solo'});
    actionsDispatched++;
    if(!result.ok||!result.entity){rejectedActions++;failure(`Wave ${wave}: cannot place ${action.tower}: ${result.reason??'missing entity'}`);break;}
    aliases.set(action.key,result.entity);
   }else{
    const id=aliases.get(action.target);
    if(!id){failure(`Missing upgrade target ${action.target}`);break;}
    const result=engine.dispatch({type:'upgrade',tower:id,path:action.path,actor:'solo'});
    actionsDispatched++;
    if(!result.ok){rejectedActions++;failure(`Wave ${wave}: cannot upgrade ${action.target}: ${result.reason??'rejected'}`);break;}
   }
  }
  if(reason)break;
  const start=engine.dispatch({type:'startWave',actor:'solo'});
  if(!start.ok){rejectedActions++;failure(`Wave ${wave}: start rejected: ${start.reason??'unknown'}`);break;}
  let ticks=0;
  while(ticks<maxTicksPerWave){
   const state=current();
   if(state.phase==='defeat'||state.phase==='victory'||state.phase==='build')break;
   engine.step(WORLD.tick);ticks++;
  }
  const state=current();
  if(state.phase==='defeat'){reason=`Defeat on wave ${wave}`;break;}
  if(state.phase==='victory'){if(wave!==80)reason=`Premature victory at wave ${wave}`;break;}
  if(state.phase==='wave'){failure(`Wave ${wave}: exceeded ${maxTicksPerWave} ticks`);break;}
 }
 const end=current();
 const won=!reason&&end.phase==='victory'&&end.wave>=80&&end.lives>0;
 return {candidateId:candidate.id,status,won,wave:end.wave,lives:end.lives,
  credits:end.credits,tick:end.tick,actionsDispatched,rejectedActions,
  reason:reason||(won?'Victory confirmed by live simulation':'Simulation ended without victory')};
}
