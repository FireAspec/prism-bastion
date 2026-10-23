/**
 * Freight Yard candidate strategy checker and integration-only replay.
 *   node --import tsx validation/maps/freight-yard/replay.ts --static
 *   node --import tsx validation/maps/freight-yard/replay.ts --simulate all
 * Baseline content/combat/engine stubs are not a victory. Live replay remains
 * UNVERIFIED and exits 2 until those modules truly support simulation.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {PathIndex,RunOptions,Tiers} from '../../../src/contracts';
import {analyzeFreightYard,spots,TOWER_RADIUS,BUFFER} from './geometry-check';

export type Action=[wave:number,tick:0,kind:'place',key:string,tower:string,site:string]|
 [wave:number,tick:0,kind:'upgrade',key:string,path:PathIndex];
export interface Plan {
 id:string;seed:number;mode:string;startCredits:number;incomeMultiplier:number;
 composition:string;risk:string;countermeasures:string[];actions:Action[];
}
interface Fixture {
 schemaVersion:number;mapId:string;difficulty:'normal';rounds:number;status:'unverified';evidence:null;
 knowledge:string[];firstArrivalTowers:string[];actionTuple:string[];budgetAssumptions:string;scenarios:Plan[];
}
export const fixture:Fixture=JSON.parse(readFileSync(new URL('strategies.json',import.meta.url),'utf8')) as Fixture;
const prices:Record<string,number>={needle:250,cannon:550,frost:500,beacon:600,scatter:425,ember:600,saw:650,
 venom:650,rail:950,tesla:800,mortar:800,observatory:650,mint:1000,orchard:700};
const tierFactors=[.5,1,2.5,6,15];
const locations=new Map<string,(typeof spots)[number]>(spots.map(s=>[s.id,s]));
const roundRewardThrough=(n:number)=>80*n+2*n*(n+1);

export function auditPlans(){
 const geometry=analyzeFreightYard();
 const errors:string[]=[];
 if(geometry.status!=='pass')errors.push('Geometry checks failed');
 if(fixture.schemaVersion!==1||fixture.mapId!=='freight-yard'||fixture.difficulty!=='normal'||fixture.rounds!==60||
  fixture.status!=='unverified'||fixture.evidence!==null||fixture.knowledge.length)errors.push('Fixture status/schema not honestly unverified');
 if(fixture.firstArrivalTowers.length!==14||new Set(fixture.firstArrivalTowers).size!==14||
  fixture.firstArrivalTowers.includes('drone')||fixture.firstArrivalTowers.includes('rocket')||
  fixture.firstArrivalTowers.some(id=>prices[id]===undefined))errors.push('Invalid first-arrival tower set');
 if(fixture.scenarios.map(p=>p.id).join(',')!=='standard,half-cash,iron-oath')errors.push('Missing modes');
 const reports:unknown[]=[];
 for(const plan of fixture.scenarios){
  const placed=new Map<string,{tower:string;site:string;tiers:Tiers}>();
  let spent=0,extra=0,previousWave=0;
  const ledger:unknown[]=[];
  if(plan.id!==plan.mode||plan.startCredits!==(plan.mode==='half-cash'?450:900)||
   plan.incomeMultiplier!==(plan.mode==='half-cash'?.5:1))errors.push(`${plan.id}: wrong starting mode budget`);
  for(const a of plan.actions){
   const [wave,tick,kind,key]=a;
   if(!Number.isInteger(wave)||wave<1||wave>60||wave<previousWave||tick!==0)errors.push(`${plan.id}: unsorted/invalid wave ${wave}`);
   previousWave=wave;
   let cost=0;
   if(kind==='place'){
    const tower=a[4],site=a[5],loc=locations.get(site);
    if(!fixture.firstArrivalTowers.includes(tower)||placed.has(key)||!loc||!geometry.spots.some(s=>s.id===site)||!isSpotClear(site)){
     errors.push(`${plan.id}: unavailable or colliding site/tower ${key}`);continue;
    }
    for(const [otherKey,other] of placed){
     const p=locations.get(other.site)!;
     if(Math.hypot(p.x-loc.x,p.y-loc.y)<2*TOWER_RADIUS+BUFFER)errors.push(`${plan.id}: ${key} overlaps ${otherKey}`);
    }
    if(plan.mode==='iron-oath'&&['mint','orchard'].includes(tower))errors.push('Iron-oath includes economy tower');
    cost=prices[tower];placed.set(key,{tower,site,tiers:[0,0,0]});
   }else if(kind==='upgrade'){
    const existing=placed.get(key),path=a[4];
    if(!existing||![0,1,2].includes(path)){errors.push(`${plan.id}: upgrade without valid tower ${key}`);continue;}
    const next=[...existing.tiers] as Tiers;next[path]++;
    if(next.some(n=>n>5)||next.filter(n=>n>0).length>2||next.filter(n=>n>2).length>1)
     errors.push(`${plan.id}: illegal crosspath ${key}`);
    cost=Math.ceil(prices[existing.tower]*tierFactors[existing.tiers[path]]/5)*5;
    existing.tiers=next;
   }else errors.push(`${plan.id}: unknown action`);
   spent+=cost;
   const withoutBounty=plan.startCredits+roundRewardThrough(wave-1)*plan.incomeMultiplier-spent;
   extra=Math.max(extra,Math.ceil(-withoutBounty));
   ledger.push({wave,tick,key,kind,costEstimate:cost,cashWithoutBounty:withoutBounty,
    pos:kind==='place'?locations.get(a[5]):undefined});
  }
  reports.push({id:plan.id,actions:plan.actions.length,estimatedSpendFactorOne:spent,
   guaranteedWaveCashBy60:roundRewardThrough(60)*plan.incomeMultiplier,minimumAdditionalBountyNeededByPurchases:extra,
   caveat:'Upgrade path factor, enemy layer payouts, damage and survival are not simulated.',ledger});
 }
 return {status:errors.length?'fail':'static-pass-replay-unverified',errors,reports};
}
const isSpotClear=(id:string)=>analyzeFreightYard().checks.find(c=>c.id===`spot-${id}`)?.ok===true;

async function simulate(plan:Plan){
 // Real modules are imported lazily. No fake combat, damage, cash or wins.
 const [{loadContent},{createCombat},{createGame}]=await Promise.all([
  import('../../../src/content/index'),import('../../../src/combat/index'),import('../../../src/engine/index'),
 ]);
 const config=loadContent();
 if(!config.maps.some(m=>m.id==='freight-yard'))throw new Error('Freight Yard is missing from integrated catalog');
 const options:RunOptions={mapId:'freight-yard',difficulty:'normal',seed:plan.seed,endless:false,modeId:plan.mode,
  unlockedTowers:[...fixture.firstArrivalTowers],knowledge:[],runId:`replay-43-${plan.id}-${plan.seed}`,
  players:[{id:'solo',name:'Defender',color:'#a8dcec',connected:true}]};
 const game=createGame(config,options,createCombat()),entities=new Map<string,string>();
 const initial=game.getSnapshot();
 if(initial.credits!==plan.startCredits)throw new Error(`Wrong starting credits: ${initial.credits}`);
 if(plan.mode==='iron-oath'&&(initial.lives!==1||initial.rules.sellAllowed||initial.rules.allowKnowledge||initial.rules.allowPassiveIncome))
  throw new Error('Engine failed iron-oath restrictions');
 const log:unknown[]=[];
 for(let wave=1;wave<=fixture.rounds;wave++){
  let state=game.getSnapshot();
  if(state.phase!=='build')throw new Error(`Expected build phase before wave ${wave}, got ${state.phase}`);
  for(const a of plan.actions.filter(action=>action[0]===wave)){
   const creditsBefore=state.credits;
   let result;
   if(a[2]==='place'){
    const site=locations.get(a[5])!;
    result=game.dispatch({type:'place',tower:a[4],pos:{x:site.x,y:site.y},actor:'solo'});
    if(!result.ok)throw new Error(`Wave ${wave}: place ${a[3]} rejected: ${result.reason}`);
    state=game.getSnapshot();
    const entity=result.entity??state.towers.find(t=>t.defId===a[4]&&t.pos.x===site.x&&t.pos.y===site.y)?.id;
    if(!entity)throw new Error(`Wave ${wave}: placement lacks entity ID`);
    entities.set(a[3],entity);
   }else{
    result=game.dispatch({type:'upgrade',tower:entities.get(a[3])??'missing',path:a[4],actor:'solo'});
    if(!result.ok)throw new Error(`Wave ${wave}: upgrade ${a[3]} rejected: ${result.reason}`);
    state=game.getSnapshot();
   }
   if(state.credits<0||state.credits>creditsBefore)throw new Error(`Wave ${wave}: invalid purchase cash`);
   log.push({wave,tick:0,action:a,creditsBefore,creditsAfter:state.credits,lives:state.lives});
  }
  const started=game.dispatch({type:'startWave',actor:'solo'});
  if(!started.ok)throw new Error(`Wave ${wave}: start rejected: ${started.reason}`);
  state=game.getSnapshot();
  let ticks=0;
  while(state.phase==='wave'&&ticks<18000){game.step(1/60);ticks++;state=game.getSnapshot();}
  if(state.phase==='defeat')throw new Error(`Defeat at wave ${wave}, lives=${state.lives}, credits=${state.credits}`);
  if(state.phase==='wave')throw new Error(`Wave ${wave} exceeded 18000 fixed ticks`);
  if(wave<fixture.rounds&&state.phase!=='build')throw new Error(`Unexpected phase ${state.phase} at wave ${wave}`);
 }
 const state=game.getSnapshot();
 if(state.phase!=='victory'||plan.mode==='iron-oath'&&state.lives!==1)throw new Error('Final victory and mode restrictions not demonstrated');
 return {id:plan.id,status:'verified-by-engine',seed:plan.seed,mode:plan.mode,wave:state.wave,lives:state.lives,credits:state.credits,log};
}
async function main(){
 const [mode,target]=process.argv.slice(2),audit=auditPlans();
 if(!mode||mode==='--static'){
  process.stdout.write(`${JSON.stringify(audit,null,2)}\n`);
  if(audit.errors.length)process.exitCode=1;
  return;
 }
 if(mode!=='--simulate'||!target){process.stderr.write('Usage: --static | --simulate standard|half-cash|iron-oath|all\n');process.exitCode=1;return;}
 if(audit.errors.length){process.stderr.write(`${JSON.stringify(audit.errors)}\n`);process.exitCode=1;return;}
 const plans=target==='all'?fixture.scenarios:fixture.scenarios.filter(p=>p.id===target);
 if(!plans.length){process.stderr.write(`Unknown plan ${target}\n`);process.exitCode=1;return;}
 const results=[];
 for(const p of plans){
  try{results.push(await simulate(p));}
  catch(err){results.push({id:p.id,status:'unverified',error:err instanceof Error?err.message:String(err)});process.exitCode=2;}
 }
 process.stdout.write(`${JSON.stringify({mapId:fixture.mapId,results},null,2)}\n`);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 void main().catch(e=>{process.stderr.write(`${String(e)}\n`);process.exitCode=1;});
}
