import type {Difficulty,RunOptions} from '../../../src/contracts';
import {buildSites} from './geometry';

/** Campaign access at FIRST arrival, before unlocking chrono on this map. */
export const firstArrivalTowers=["needle","cannon","frost","beacon","scatter","ember","saw","venom","rail","tesla","mortar","observatory","mint","orchard","drone","rocket","resonator","forge","harbor","tide","coral"] as const;
export type TowerName=typeof firstArrivalTowers[number];
export type ReplayStep =
 | {action:'place';wave:number;tick:number;id:string;tower:TowerName;site:string}
 | {action:'upgrade';wave:number;tick:number;id:string;path:0|1|2}
 | {action:'target';wave:number;tick:number;id:string;targeting:'first'|'last'|'strong'|'near'};
export interface ReplayCandidate {
 id:string;status:'unverified';difficulty:Difficulty;modeId:'standard'|'half-cash'|'iron-oath';
 seed:number;rounds:80;knowledge:readonly [];startingCredits:number;
 grossRewardOnly:(wave:number)=>number;steps:readonly ReplayStep[];
}
/** Gross credits before purchases, bounties or tower income; rounds must be survived. */
const gross=(wave:number,half:boolean)=>{
 const n=wave-1,total=60*n+3*n*(n+1)/2;
 return (half?425:850)+Math.floor(total*(half?0.5:1));
};
export const replayCandidates:readonly ReplayCandidate[]=[
{id:'clock-standard-hard',status:'unverified',difficulty:'hard',modeId:'standard',seed:480011,
 rounds:80,knowledge:[],startingCredits:850,grossRewardOnly:(wave)=>gross(wave,false),
 steps:[{"action":"place","wave":1,"tick":0,"id":"north-needle","tower":"needle","site":"north-gate"},{"action":"place","wave":1,"tick":0,"id":"south-needle","tower":"needle","site":"south-gate"},{"action":"place","wave":4,"tick":0,"id":"central-frost","tower":"frost","site":"cross-north"},{"action":"place","wave":7,"tick":0,"id":"lower-scatter","tower":"scatter","site":"cross-south"},{"action":"upgrade","wave":10,"tick":0,"id":"north-needle","path":0},{"action":"place","wave":13,"tick":0,"id":"east-observer","tower":"observatory","site":"east-fork"},{"action":"place","wave":18,"tick":0,"id":"north-tesla","tower":"tesla","site":"east-high"},{"action":"upgrade","wave":20,"tick":120,"id":"central-frost","path":0},{"action":"place","wave":25,"tick":0,"id":"south-cannon","tower":"cannon","site":"east-low"},{"action":"place","wave":31,"tick":0,"id":"exit-mortar","tower":"mortar","site":"exit-guard"},{"action":"upgrade","wave":39,"tick":0,"id":"north-tesla","path":0},{"action":"place","wave":41,"tick":0,"id":"long-rail","tower":"rail","site":"west-high"},{"action":"upgrade","wave":51,"tick":0,"id":"long-rail","path":0},{"action":"upgrade","wave":61,"tick":0,"id":"exit-mortar","path":1},{"action":"upgrade","wave":71,"tick":0,"id":"south-cannon","path":0}]
},
{id:'clock-half-cash-hard',status:'unverified',difficulty:'hard',modeId:'half-cash',seed:480012,
 rounds:80,knowledge:[],startingCredits:425,grossRewardOnly:(wave)=>gross(wave,true),
 steps:[{"action":"place","wave":1,"tick":0,"id":"early-north","tower":"needle","site":"north-gate"},{"action":"place","wave":3,"tick":0,"id":"early-south","tower":"needle","site":"south-gate"},{"action":"place","wave":7,"tick":0,"id":"center-slow","tower":"frost","site":"cross-north"},{"action":"upgrade","wave":10,"tick":0,"id":"early-north","path":0},{"action":"place","wave":15,"tick":0,"id":"fork-tesla","tower":"tesla","site":"east-fork"},{"action":"place","wave":21,"tick":0,"id":"shared-cannon","tower":"cannon","site":"exit-guard"},{"action":"place","wave":31,"tick":0,"id":"south-venom","tower":"venom","site":"west-low"},{"action":"place","wave":41,"tick":0,"id":"loop-mortar","tower":"mortar","site":"east-low"},{"action":"upgrade","wave":50,"tick":0,"id":"fork-tesla","path":0},{"action":"place","wave":61,"tick":0,"id":"upper-rail","tower":"rail","site":"east-high"},{"action":"upgrade","wave":71,"tick":0,"id":"shared-cannon","path":0}]
},
{id:'clock-iron-oath-hard',status:'unverified',difficulty:'hard',modeId:'iron-oath',seed:480013,
 rounds:80,knowledge:[],startingCredits:850,grossRewardOnly:(wave)=>gross(wave,false),
 steps:[{"action":"place","wave":1,"tick":0,"id":"north-needle","tower":"needle","site":"north-gate"},{"action":"place","wave":1,"tick":0,"id":"south-cannon","tower":"cannon","site":"south-gate"},{"action":"place","wave":3,"tick":0,"id":"south-frost","tower":"frost","site":"cross-south"},{"action":"place","wave":6,"tick":0,"id":"north-scatter","tower":"scatter","site":"west-high"},{"action":"place","wave":11,"tick":0,"id":"center-tesla","tower":"tesla","site":"east-fork"},{"action":"place","wave":20,"tick":0,"id":"center-observer","tower":"observatory","site":"cross-north"},{"action":"place","wave":30,"tick":0,"id":"south-rocket","tower":"rocket","site":"east-low"},{"action":"upgrade","wave":40,"tick":0,"id":"center-tesla","path":0},{"action":"place","wave":45,"tick":0,"id":"north-mortar","tower":"mortar","site":"east-high"},{"action":"place","wave":60,"tick":0,"id":"exit-rail","tower":"rail","site":"exit-guard"},{"action":"upgrade","wave":70,"tick":0,"id":"south-cannon","path":0}]
}
];
export function validateReplayCandidates():string[]{
 const errors:string[]=[],validSites=new Map(buildSites.map(s=>[s.id,s]));
 for(const candidate of replayCandidates){
  if(candidate.difficulty!=='hard'||candidate.rounds!==80||candidate.status!=='unverified'||candidate.knowledge.length)
   errors.push(candidate.id+': invalid run profile');
  if(candidate.startingCredits!==(candidate.modeId==='half-cash'?425:850))
   errors.push(candidate.id+': invalid start budget');
  const seen=new Set<string>(),occupied=new Set<string>();let prior=-1;
  for(const step of candidate.steps){
   const order=step.wave*10801+step.tick;
   if(!Number.isInteger(step.wave)||step.wave<1||step.wave>80||
      !Number.isInteger(step.tick)||step.tick<0||step.tick>10800||order<prior)
      errors.push(candidate.id+': invalid step order or time');
   prior=order;
   if(step.action==='place'){
    if(seen.has(step.id)||occupied.has(step.site))errors.push(candidate.id+': duplicate alias or occupied site');
    seen.add(step.id);occupied.add(step.site);
    if(!firstArrivalTowers.includes(step.tower))errors.push(candidate.id+': locked technology');
    if(validSites.get(step.site)?.terrain!=='land')errors.push(candidate.id+': invalid land site');
    if(candidate.modeId==='iron-oath'&&(step.tower==='mint'||step.tower==='orchard'))
      errors.push(candidate.id+': forbidden income tower');
   }else if(!seen.has(step.id))errors.push(candidate.id+': missing purchased tower '+step.id);
  }
 }
 return errors;
}
export function replayOptions(c:ReplayCandidate):RunOptions{
 return {mapId:'clock-square',difficulty:c.difficulty,seed:c.seed,endless:false,modeId:c.modeId,
  unlockedTowers:[...firstArrivalTowers],
  players:[{id:'p1',name:'Solo',color:'#e7bd81',connected:true}],
  runId:'qa-'+c.id+'-'+c.seed,knowledge:[]};
}
