/** Validate replay scripts without combat or replay them through the real GameEngine.
 * --validate: 0 if structurally legal, still unverified.
 * --run: 0 only after three actual victories, 2 if frozen modules pending,
 *         1 if a purchase fails, a wave times out or a run loses.
 */
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGame} from '../../../src/engine';
import {createCombat} from '../../../src/combat';
import {loadContent} from '../../../src/content';
import {getMap} from '../../../src/content/maps/orchard-wall';
import {canUpgrade} from '../../../src/contracts/rules';
import {distance} from '../../../src/contracts/geometry';
import {analyzeOrchardWall,SITES} from './geometry-check';
import type {GameAction,GameEngine,PathIndex,Tiers,RunOptions} from '../../../src/contracts';

export interface Purchase{wave:number;tick:number;type:'place'|'upgrade';ref:string;tower?:string;site?:string;path?:PathIndex}
export interface Candidate{id:string;modeId:'standard'|'half-cash'|'iron-oath';difficulty:'easy';seed:number;startingCredits:number;guaranteedRoundRewardFloor:Record<string,number>;counterplay:string;actions:Purchase[]}
export interface Candidates{mapId:string;status:'unverified';reason:string;tickRate:number;maxTicksPerWave:number;allowedFirstArrivalTowers:string[];scenarios:Candidate[]}
const fixturePath=resolve(dirname(fileURLToPath(import.meta.url)),'replay-candidates.json');
export function loadReplayCandidates():Candidates{return JSON.parse(readFileSync(fixturePath,'utf8')) as Candidates;}

export function validateReplayCandidates(data:Candidates=loadReplayCandidates()):string[]{
 const errors:string[]=[],geometry=analyzeOrchardWall();errors.push(...geometry.errors);
 const legal=new Set(['needle','cannon','frost','beacon','scatter','ember','saw','venom','rail','tesla','mortar','observatory']);
 if(data.mapId!==getMap().id||data.status!=='unverified'||data.tickRate!==60||data.maxTicksPerWave<3600)errors.push('Bad fixture metadata');
 if(data.allowedFirstArrivalTowers.length!==12||data.allowedFirstArrivalTowers.some(t=>!legal.has(t)))errors.push('Wrong initial technology list');
 if(data.scenarios.length!==3||new Set(data.scenarios.map(s=>s.modeId)).size!==3)errors.push('Three distinct modes required');
 const sites=new Map(SITES.map(s=>[s.id,s]));
 for(const scenario of data.scenarios){
  if(!['standard','half-cash','iron-oath'].includes(scenario.modeId)||scenario.difficulty!=='easy'||!Number.isSafeInteger(scenario.seed))errors.push(`${scenario.id}: invalid mode/seed`);
  const ratio=scenario.modeId==='half-cash'?0.5:1;
  if(scenario.startingCredits!==1000*ratio)errors.push(`${scenario.id}: starting cash`);
  for(const n of [10,20,40])if(scenario.guaranteedRoundRewardFloor[n]!==Math.floor((100*n+5*n*(n+1)/2)*ratio))errors.push(`${scenario.id}: reward envelope ${n}`);
  const built=new Map<string,{site:string;tiers:Tiers}>();let prevWave=0,prevTick=-1;
  for(const [i,a] of scenario.actions.entries()){
   if(!Number.isInteger(a.wave)||a.wave<1||a.wave>40||!Number.isInteger(a.tick)||a.tick<0||a.tick>data.maxTicksPerWave||a.wave<prevWave||(a.wave===prevWave&&a.tick<prevTick))errors.push(`${scenario.id}: action ${i} invalid time`);
   prevWave=a.wave;prevTick=a.tick;
   if(a.type==='place'){
    if(!a.site||!a.tower||!legal.has(a.tower)||!sites.has(a.site)||built.has(a.ref)){errors.push(`${scenario.id}: action ${i} invalid purchase`);continue;}
    const spot=sites.get(a.site)!;
    if(spot.terrain!=='land'||!geometry.sites.some(s=>s.id===spot.id&&s.safe))errors.push(`${scenario.id}: invalid land position ${a.site}`);
    for(const used of built.values()){
     const other=sites.get(used.site)!;
     if(distance(spot.pos,other.pos)<spot.radius+other.radius)errors.push(`${scenario.id}: overlapping slots`);
    }
    built.set(a.ref,{site:a.site,tiers:[0,0,0]});
   }else if(a.type==='upgrade'){
    const p=built.get(a.ref);
    if(!p||a.path===undefined||![0,1,2].includes(a.path)||!canUpgrade(p.tiers,a.path)){errors.push(`${scenario.id}: illegal upgrade ${i}`);continue;}
    p.tiers[a.path]++;
   }else errors.push(`${scenario.id}: unexpected action type`);
  }
  if(built.size<4||!scenario.actions.some(a=>a.wave>=30))errors.push(`${scenario.id}: missing late defense`);
 }
 return errors;
}

function dispatch(engine:GameEngine,action:GameAction,context:string):string|undefined{
 const r=engine.dispatch(action);if(!r.ok||r.pending)throw new Error(`${context}: ${action.type} rejected: ${r.reason??'pending'}`);return r.entity;
}
function buy(engine:GameEngine,a:Purchase,refs:Map<string,string>,where:string){
 if(a.type==='place'){
  const site=SITES.find(s=>s.id===a.site);if(!site||!a.tower)throw new Error(`${where}: unknown site/tower`);
  const old=new Set(engine.getSnapshot().towers.map(t=>t.id));
  const reply=dispatch(engine,{type:'place',tower:a.tower,pos:site.pos},where);
  const added=engine.getSnapshot().towers.filter(t=>!old.has(t.id));
  const entity=reply??(added.length===1?added[0].id:undefined);
  if(!entity)throw new Error(`${where}: no returned tower ID`);refs.set(a.ref,entity);
 }else{
  const id=refs.get(a.ref);if(!id||a.path===undefined)throw new Error(`${where}: unbound upgrade`);
  dispatch(engine,{type:'upgrade',tower:id,path:a.path},where);
 }
}
function simulate(s:Candidate,data:Candidates){
 const config=loadContent();
 const options:RunOptions={mapId:data.mapId,difficulty:s.difficulty,seed:s.seed,modeId:s.modeId,endless:false,
  unlockedTowers:[...data.allowedFirstArrivalTowers],players:[{id:'local',name:'Defender',color:'#e2be76',connected:true}],runId:`orchard-${s.id}`,knowledge:[]};
 const engine=createGame(config,options,createCombat()),refs=new Map<string,string>();
 if(engine.getSnapshot().credits!==s.startingCredits)throw new Error(`${s.id}: wrong starting credits`);
 let ticks=0,completed=0;
 for(let wave=1;wave<=40;wave++){
  if(engine.getSnapshot().phase!=='build')throw new Error(`${s.id}: not in build phase before wave ${wave}`);
  const actions=s.actions.filter(a=>a.wave===wave);let cursor=0;
  while(cursor<actions.length&&actions[cursor].tick===0){buy(engine,actions[cursor],refs,`${s.id} w${wave} t0`);cursor++;}
  dispatch(engine,{type:'startWave'},`${s.id} wave ${wave}`);let active=false,done=false;
  for(let t=1;t<=data.maxTicksPerWave;t++){
   engine.step(1/data.tickRate);ticks++;const state=engine.getSnapshot();
   if(state.phase==='defeat')throw new Error(`${s.id} defeated wave ${wave} tick ${t}`);
   if(state.phase==='wave')active=true;
   while(cursor<actions.length&&actions[cursor].tick===t){
    if(state.phase!=='wave')throw new Error(`${s.id}: action after wave`);
    buy(engine,actions[cursor],refs,`${s.id} w${wave} t${t}`);cursor++;
   }
   if(state.phase==='victory'||(active&&state.phase==='build')){done=true;break;}
  }
  if(!done||cursor!==actions.length)throw new Error(`${s.id}: timeout or missed action wave ${wave}`);
  completed++;if(engine.getSnapshot().phase==='victory')break;
 }
 const result=engine.getSnapshot();
 if(result.phase!=='victory'||completed!==40)throw new Error(`${s.id}: no actual victory after 40 rounds`);
 return {id:s.id,status:'verified',seed:s.seed,mode:s.modeId,waves:completed,ticks,lives:result.lives,credits:result.credits,spent:result.stats.spent,earned:result.stats.earned};
}
export function main(args:string[]=process.argv.slice(2)):number{
 const data=loadReplayCandidates(),errors=validateReplayCandidates(data);
 if(errors.length){console.error(JSON.stringify({status:'invalid-fixture',errors},null,2));return 1;}
 if(!args.includes('--run')){console.log(JSON.stringify({status:'unverified',validatedFixture:true,gameSimulation:false,scenarios:data.scenarios.map(s=>s.id)},null,2));return 0;}
 const results:ReturnType<typeof simulate>[]=[];
 for(const s of data.scenarios)try{results.push(simulate(s,data));}catch(e){
  const reason=e instanceof Error?e.message:String(e);
  if(/\bpending$/i.test(reason)&&/content|registry|combat|simulation|mode|wave|tower|enemy/i.test(reason)){
   console.error(JSON.stringify({status:'unverified',reason,gameSimulation:false,results},null,2));return 2;
  }
  console.error(JSON.stringify({status:'failed',scenario:s.id,reason,results},null,2));return 1;
 }
 console.log(JSON.stringify({status:'verified',gameSimulation:true,results},null,2));return 0;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main();
