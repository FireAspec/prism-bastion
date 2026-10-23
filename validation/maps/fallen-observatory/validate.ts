import {getMap} from '../../../src/content/maps/fallen-observatory';
import {analyzeGeometry,landSites,waterSites} from './geometry';
import {basePurchaseLedger,candidates,FIRST_VISIT_TOWERS,replayOptions} from './replays';

const map=getMap(),geometry=analyzeGeometry(map);
const errors=[...geometry.errors];
if(map.campaignIndex!==12||map.difficulty!==3||map.recommendedDifficulty!=='hard'||map.theme!=='garden')errors.push('Invalid campaign metadata');
if(FIRST_VISIT_TOWERS.length!==22||FIRST_VISIT_TOWERS.some(t=>t==='gravity' as never))errors.push('Incorrect first-visit tech');
for(const candidate of candidates){
 if(candidate.status!=='unverified'||candidate.steps.length<10)errors.push(`${candidate.id}: missing fixture actions`);
 if(replayOptions(candidate).knowledge.length)errors.push(`${candidate.id}: meta knowledge enabled`);
 const slots=new Set<string>();let last=0;
 for(const step of candidate.steps){
  if(!Number.isInteger(step.wave)||step.wave<1||step.wave>80||!Number.isInteger(step.tick)||step.tick<0)errors.push(`${candidate.id}: bad action time`);
  if(step.wave<last)errors.push(`${candidate.id}: actions not ordered`);
  last=step.wave;
  if(step.kind==='place'){
   if(!landSites.some(s=>s.id===step.site))errors.push(`${candidate.id}: bad position ${step.site}`);
   if(slots.has(step.name))errors.push(`${candidate.id}: duplicate slot ${step.name}`);
   slots.add(step.name);
  }else if(!slots.has(step.name))errors.push(`${candidate.id}: upgrade/target before placement ${step.name}`);
 }
 for(const row of basePurchaseLedger(candidate))if(row.afterIgnoringKillIncomeAndUpgradeCosts<0)errors.push(`${candidate.id}: base purchase needs kill income at wave ${row.wave}`);
 if(candidate.modeId==='iron-oath'&&candidate.steps.some(s=>s.kind==='place'&&['mint','orchard'].includes(s.tower)))errors.push('Farm forbidden in iron-oath');
}
const report={ok:errors.length===0,geometry,sites:{land:landSites,water:waterSites},
 fixtures:candidates.map(c=>({id:c.id,status:c.status,mode:c.modeId,seed:c.seed,budget:basePurchaseLedger(c)})),errors};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(!report.ok)process.exitCode=1;
