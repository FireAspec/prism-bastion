import type {GameEngine} from '../../../src/contracts';
import {loadContent} from '../../../src/content';
import {createCombat} from '../../../src/combat';
import {createGame} from '../../../src/engine';
import {buildSites} from './geometry';
import {replayCandidates,replayOptions,validateReplayCandidates,type ReplayCandidate,type ReplayStep} from './replays';

export type ReplayStatus='verified-victory'|'defeat'|'invalid-action'|'time-limit'|'engine-unavailable';
export interface ReplayResult {
 id:string;status:ReplayStatus;reason:string;wave:number;
 lives?:number;credits?:number;spent?:number;earned?:number;
 actions:{wave:number;tick:number;action:string;before:number;after:number}[];
}
const sites=new Map(buildSites.map(s=>[s.id,s]));
function act(engine:GameEngine,step:ReplayStep,ids:Map<string,string>,report:ReplayResult):void{
 const before=engine.getSnapshot();let command;
 if(step.action==='place'){
  const site=sites.get(step.site);if(!site)throw Error('Invalid site '+step.site);
  command={type:'place' as const,tower:step.tower,pos:{...site.pos}};
 }else{
  const id=ids.get(step.id);if(!id)throw Error('Tower alias not placed '+step.id);
  command=step.action==='upgrade'?
   {type:'upgrade' as const,tower:id,path:step.path}:
   {type:'target' as const,tower:id,targeting:step.targeting};
 }
 const result=engine.dispatch({...command,actor:'p1'});
 const after=engine.getSnapshot();
 report.actions.push({wave:step.wave,tick:step.tick,action:JSON.stringify(command),before:before.credits,after:after.credits});
 if(!result.ok||result.pending)throw Error('Rejected '+step.id+': '+(result.reason??'pending'));
 if(step.action==='place'){
  const placed=after.towers.find(t=>!before.towers.some(old=>old.id===t.id));
  const entity=result.entity??placed?.id;
  if(!entity)throw Error('No confirmed tower after purchase '+step.id);
  ids.set(step.id,entity);
 }
}
export function runReplay(candidate:ReplayCandidate):ReplayResult{
 const report:ReplayResult={id:candidate.id,status:'engine-unavailable',reason:'Not run',wave:0,actions:[]};
 try{
  const game=createGame(loadContent(),replayOptions(candidate),createCombat());
  const ids=new Map<string,string>();
  for(let wave=1;wave<=candidate.rounds;wave++){
   report.wave=wave;
   if(game.getSnapshot().phase!=='build')throw Error('Missing build phase before wave '+wave);
   const steps=candidate.steps.filter(s=>s.wave===wave);let index=0;
   const apply=(tick:number)=>{while(index<steps.length&&steps[index].tick===tick)act(game,steps[index++],ids,report)};
   apply(0);
   const start=game.dispatch({type:'startWave',actor:'p1'});
   if(!start.ok||start.pending)throw Error('Wave '+wave+' cannot start: '+(start.reason??'pending'));
   let completed=false;
   for(let tick=1;tick<=10800;tick++){
    apply(tick);game.step(1/60);
    if(tick%60===0)game.drainEvents();
    const snapshot=game.getSnapshot();
    if(snapshot.phase==='defeat'||snapshot.phase==='victory'){
     report.status=snapshot.phase==='defeat'?'defeat':wave===80?'verified-victory':'invalid-action';
     report.reason=snapshot.phase==='defeat'?'Defeat on wave '+wave:
       wave===80?'Real simulation completed all 80 waves':'Premature victory';
     report.lives=snapshot.lives;report.credits=snapshot.credits;
     report.spent=snapshot.stats.spent;report.earned=snapshot.stats.earned;
     if(index!==steps.length){report.status='invalid-action';report.reason='Some planned actions were not reached';}
     return report;
    }
    if(snapshot.phase==='build'){
     if(index!==steps.length)throw Error('Wave '+wave+' ended before all scheduled actions');
     completed=true;break;
    }
   }
   if(!completed){report.status='time-limit';report.reason='180 simulated seconds exceeded on wave '+wave;return report;}
  }
  report.status='invalid-action';report.reason='No victory after wave 80';
 }catch(error){
  report.reason=error instanceof Error?error.message:String(error);
  report.status=/pending|not implemented|unavailable/i.test(report.reason)?'engine-unavailable':'invalid-action';
 }
 return report;
}
const cli=process.argv[1]?.replace(/\\/g,'/');
if(cli?.endsWith('/run-replays.ts')){
 const problems=validateReplayCandidates();
 if(problems.length){console.error(JSON.stringify({fixtureStatus:'invalid',problems},null,2));process.exitCode=1;}
 else{
  const id=process.argv[2];
  const selected=id?replayCandidates.filter(x=>x.id===id):replayCandidates;
  if(!selected.length){console.error('Unknown candidate: '+id);process.exitCode=1;}
  else{
   const results=selected.map(runReplay);
   console.log(JSON.stringify({fixtureStatus:'unverified',results},null,2));
   if(results.some(r=>r.status!=='verified-victory'))process.exitCode=2;
  }
 }
}
