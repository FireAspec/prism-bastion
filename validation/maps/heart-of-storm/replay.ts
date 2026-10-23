/** Run after the combat/content engine has landed:
 *   node --import tsx validation/maps/heart-of-storm/replay.ts [scenario-id|all]
 * The candidate file intentionally remains unverified until full simulation.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {GameAction,GameEngine,GameState,RunOptions} from '../../../src/contracts';
import {WORLD} from '../../../src/contracts';
import {loadContent} from '../../../src/content';
import {createGame} from '../../../src/engine';
import {createCombat} from '../../../src/combat';

type Action = {wave:number;tick:number;type:'place'|'upgrade';ref:string;
  tower?:string;site?:string;path?:0|1|2};
type Scenario = {id:string;modeId:string;seed:number;startingCredits:number;
  actions:Action[]};
type Site = {id:string;x:number;y:number};
type Fixture = {mapId:string;difficulty:'extreme';rounds:number;
  unlockedTowers:string[];verification:'unverified';scenarios:Scenario[]};

const dir = new URL('./',import.meta.url);
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('replays.json',dir)),'utf8')) as Fixture;
const sites = JSON.parse(readFileSync(fileURLToPath(new URL('sites.json',dir)),'utf8')) as
  {land:Site[];water:Site[]};
const positions = new Map([...sites.land,...sites.water].map(site=>[site.id,{x:site.x,y:site.y}]));

function pending(error:unknown):boolean {
  return error instanceof Error && /(?:content registry|simulation module|combat module|modes|waves|enemy content|tower content).*pending/i.test(error.message);
}
function fail(reason:string,snapshot?:GameState):never {
  const message = {status:'failed',reason,
    ...(snapshot?{wave:snapshot.wave,tick:snapshot.tick,lives:snapshot.lives,credits:snapshot.credits}:{}),
  };
  throw new Error(JSON.stringify(message));
}

function execute(action:Action,engine:GameEngine,refs:Map<string,string>,report:unknown[]):void {
  const before=engine.getSnapshot();
  let command:GameAction;
  if(action.type==='place') {
    const pos=positions.get(action.site??'');
    if(!pos||!action.tower)fail(`Unknown placement: ${action.site}`);
    command={type:'place',tower:action.tower,pos};
  } else {
    const tower=refs.get(action.ref);
    if(!tower||action.path===undefined)fail(`Unknown upgrade target: ${action.ref}`);
    command={type:'upgrade',tower,path:action.path};
  }
  const outcome=engine.dispatch({...command,actor:'player-1'});
  if(!outcome.ok||outcome.pending)fail(`Command rejected at wave ${action.wave}, tick ${action.tick}: ${outcome.reason??'pending'}`,before);
  const after=engine.getSnapshot();
  if(action.type==='place') {
    const prevIds=new Set(before.towers.map(tower=>tower.id));
    const added=after.towers.find(tower=>!prevIds.has(tower.id));
    const id=outcome.entity??added?.id;
    if(!id)fail(`No placed tower entity for ${action.ref}`,after);
    refs.set(action.ref,id);
  }
  if(after.credits<0||after.credits>before.credits)fail('Unexpected purchase budget change',after);
  report.push({wave:action.wave,tick:action.tick,action:action.type,ref:action.ref,
    creditsBefore:before.credits,spent:before.credits-after.credits,creditsAfter:after.credits});
}

function runOne(scenario:Scenario):unknown {
  const config=loadContent();
  const map=config.maps.find(entry=>entry.id===fixture.mapId);
  if(!map)fail('Map not registered in content catalog');
  const difficulty=config.difficulties.find(d=>d.id===fixture.difficulty);
  if(!difficulty||difficulty.rounds!==fixture.rounds)fail('Extreme round count differs from 100');
  const options:RunOptions={mapId:fixture.mapId,difficulty:fixture.difficulty,
    seed:scenario.seed,modeId:scenario.modeId,endless:false,runId:`replay-57-${scenario.id}`,
    unlockedTowers:[...fixture.unlockedTowers],knowledge:[],
    players:[{id:'player-1',name:'Защитник',color:'#e9bf7b',connected:true}],
  };
  const engine=createGame(config,options,createCombat());
  engine.dispatch({type:'autoStart',value:false,actor:'player-1'});
  const actualStart=engine.getSnapshot();
  if(actualStart.credits!==scenario.startingCredits)
    fail(`Opening budget mismatch: expected ${scenario.startingCredits}, got ${actualStart.credits}`,actualStart);
  const refs=new Map<string,string>(),purchases:unknown[]=[],waveResults:unknown[]=[];
  for(let wave=1;wave<=fixture.rounds;wave++) {
    const state=engine.getSnapshot();
    if(state.phase!=='build')fail(`Expected build phase before wave ${wave}`,state);
    const pre=scenario.actions.filter(action=>action.wave===wave && action.tick===0);
    pre.forEach(action=>execute(action,engine,refs,purchases));
    const started=engine.dispatch({type:'startWave',actor:'player-1'});
    if(!started.ok)fail(`Failed to start wave ${wave}: ${started.reason}`,engine.getSnapshot());
    const inWave=scenario.actions.filter(action=>action.wave===wave && action.tick>0);
    let elapsed=0,returnedToBuild=false;
    // A maximum of 5 minutes per wave, including bosses, is a real failure.
    while(elapsed<18000) {
      elapsed++;
      for(const action of inWave.filter(item=>item.tick===elapsed))execute(action,engine,refs,purchases);
      engine.step(WORLD.tick);
      const now=engine.getSnapshot();
      if(now.credits<0)fail('Negative credits',now);
      if(now.phase==='defeat')fail(`Leaked to defeat on wave ${wave}`,now);
      if(now.phase==='victory') {
        if(wave!==fixture.rounds)fail('Victory before requested last wave',now);
        return {status:'verified',scenario:scenario.id,seed:scenario.seed,waves:wave,
          finalLives:now.lives,finalCredits:now.credits,actions:purchases,waveResults};
      }
      if(now.phase==='build') {returnedToBuild=true;waveResults.push({wave,ticks:elapsed,lives:now.lives,credits:now.credits});break;}
    }
    if(!returnedToBuild)fail(`Wave ${wave} did not finish within 18000 ticks`,engine.getSnapshot());
    if(wave===fixture.rounds)fail('No victory after wave 100',engine.getSnapshot());
  }
  fail('Replay did not reach a final state',engine.getSnapshot());
}

if(fixture.verification!=='unverified')throw new Error('Fixture must not self-certify success');
const arg=process.argv[2]??'all';
const selected=arg==='all'?fixture.scenarios:fixture.scenarios.filter(s=>s.id===arg);
if(!selected.length){console.error(`Unknown scenario: ${arg}`);process.exitCode=1;}
for(const scenario of selected) {
  try {console.log(JSON.stringify(runOne(scenario)));}
  catch(error) {
    if(pending(error)) {
      console.log(JSON.stringify({status:'unverified',scenario:scenario.id,
        reason:(error as Error).message}));
      process.exitCode=Math.max(process.exitCode??0,2);
    } else {
      console.error(JSON.stringify({status:'failed',scenario:scenario.id,
        error:error instanceof Error?error.message:String(error)}));
      process.exitCode=1;
    }
  }
}
