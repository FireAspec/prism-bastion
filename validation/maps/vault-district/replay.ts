import type {GameAction,RunOptions} from '../../../src/contracts';
import {loadContent} from '../../../src/content';
import {createCombat} from '../../../src/combat';
import {createGame} from '../../../src/engine';
import {readFileSync} from 'node:fs';
import {isBuildableLand,isBuildableWater} from './geometry';

type Step =
  | {wave:number;tick:number;type:'place';tower:string;alias:string;pos:{x:number;y:number}}
  | {wave:number;tick:number;type:'upgrade';alias:string;path:0|1|2};
type Plan={id:string;modeId:string;difficulty:'extreme';seed:number;actions:Step[];unlockedTowers:string[]};
type Fixtures={mapId:string;status:'unverified';plans:Plan[]};
const fixtures:Fixtures=JSON.parse(readFileSync(new URL('./replay-fixtures.json',import.meta.url),'utf8'));
const args=process.argv.slice(2);

export function listCandidates():unknown {
  return {status:fixtures.status,candidates:fixtures.plans.map(plan=>({
    id:plan.id,mode:plan.modeId,difficulty:plan.difficulty,seed:plan.seed,actions:plan.actions.length,
  }))};
}
export function replay(plan:Plan):unknown {
  const config=loadContent(); // Cannot run on the frozen base before the registry lands.
  const map=config.maps.find(m=>m.id===fixtures.mapId);
  if(!map)throw new Error('vault-district is absent from the content registry');
  if(!config.waves.length)throw new Error('canonical campaign wave program is absent');
  const options:RunOptions={
    mapId:fixtures.mapId,difficulty:plan.difficulty,seed:plan.seed,endless:false,modeId:plan.modeId,
    unlockedTowers:[...plan.unlockedTowers],players:[{id:'solo',name:'Solo',color:'#ffcc88',connected:true}],
    runId:'map54-'+plan.id+'-'+plan.seed,knowledge:[],
  };
  const engine=createGame(config,options,createCombat());
  const aliases=new Map<string,string>();
  const snap=()=>engine.getSnapshot();
  let state=snap();
  if(state.credits>Math.ceil(850*(plan.modeId==='half-cash'?0.5:1)))
    throw new Error('initial economy has additional unapproved funds');
  for(let wave=1;wave<=100;wave++){
    state=snap();
    if(state.phase==='victory')break;
    if(state.phase==='defeat')throw new Error('defeat before wave '+wave+', leaks='+state.stats.leaks);
    if(state.phase!=='build')throw new Error('expected build phase before wave '+wave);
    const actions=plan.actions.filter(a=>a.wave===wave);
    for(const action of actions){
      if(action.tick!==0)throw new Error('only pre-wave build tick 0 is supported');
      if(action.type==='place'){
        const def=config.towers.find(t=>t.id===action.tower);
        if(!def)throw new Error('missing tower definition '+action.tower);
        const land=isBuildableLand(map,action.pos,def.footprint);
        const water=isBuildableWater(map,action.pos,def.footprint);
        const valid=def.placement==='land'?land:def.placement==='water'?water:land||water;
        if(!valid)throw new Error('actual tower footprint illegal: '+action.alias);
      }
      const command:GameAction=action.type==='place'
        ? {type:'place',tower:action.tower,pos:action.pos}
        : {type:'upgrade',tower:aliases.get(action.alias)??'',path:action.path};
      const result=engine.dispatch({...command,actor:'solo'});
      if(!result.ok)throw new Error('wave '+wave+' '+action.type+' '+action.alias+': '+(result.reason??'rejected'));
      if(action.type==='place'){
        const entity=result.entity??snap().towers.find(t=>t.defId===action.tower&&
          t.pos.x===action.pos.x&&t.pos.y===action.pos.y)?.id;
        if(!entity)throw new Error('cannot resolve new entity '+action.alias);
        aliases.set(action.alias,entity);
      }
    }
    const started=engine.dispatch({type:'startWave',actor:'solo'});
    if(!started.ok)throw new Error('cannot start wave '+wave+': '+started.reason);
    for(let tick=0;tick<60*900;tick++){
      engine.step(1/60);
      if(tick%60!==59)continue;
      state=snap();
      if(state.credits<0)throw new Error('credits went negative at wave '+wave);
      if(state.phase==='defeat')throw new Error('defeat at wave '+wave+', leaks='+state.stats.leaks);
      if(state.phase!=='wave')break;
      if(tick===60*900-1)throw new Error('wave '+wave+' timed out after 900 sim seconds');
    }
  }
  state=snap();
  if(state.phase!=='victory')throw new Error('all scripted waves ended without a victory event: '+state.phase);
  if(state.stats.leaks!==0 && plan.modeId==='iron-oath')
    throw new Error('iron-oath accepted leaks');
  return {status:'verified',plan:plan.id,difficulty:plan.difficulty,mode:plan.modeId,seed:plan.seed,
    finalPhase:state.phase,finalWave:state.wave,finalLives:state.lives,credits:state.credits,
    spent:state.stats.spent,earned:state.stats.earned,leaks:state.stats.leaks,
    simulationTicks:state.tick};
}
if(args.includes('--list')){
  process.stdout.write(JSON.stringify(listCandidates(),null,2)+'\n');
}else if(args.includes('--run')){
  const id=args.find(x=>x.startsWith('--plan='))?.slice(7);
  const candidates=id?fixtures.plans.filter(p=>p.id===id):fixtures.plans;
  if(candidates.length===0){process.stderr.write('Unknown replay plan\n');process.exitCode=2;}
  const reports=[];
  for(const p of candidates){
    try{reports.push(replay(p));}
    catch(error){
      const reason=error instanceof Error?error.message:String(error);
      const unavailable=/pending|absent from the content registry|wave program is absent/i.test(reason);
      reports.push({status:unavailable?'unverified':'failed',plan:p.id,reason});
      process.exitCode=unavailable?Math.max(Number(process.exitCode??0),2):1;
    }
  }
  process.stdout.write(JSON.stringify({runs:reports},null,2)+'\n');
}else{
  process.stdout.write('Usage: npx tsx validation/maps/vault-district/replay.ts --list | --run [--plan=id]\n');
}
