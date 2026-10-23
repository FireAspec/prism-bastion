import {inspectGeometry} from './geometry';
import {candidates,estimateBudget} from './replays';
const geometry=inspectGeometry(),issues=[...geometry.issues];
const budget=candidates.map(c=>{const rows=estimateBudget(c);return {id:c.id,mode:c.modeId,status:c.status,
 estimatedPathFactor:1.25,minimumCashWithoutLayerIncome:Math.min(...rows.map(r=>r.estimatedCash)),
 finalEstimatedCash:rows.at(-1)?.estimatedCash??0,includesUnverifiedUpgradePrices:true};});
for(const r of budget)if(r.minimumCashWithoutLayerIncome<0)issues.push(`negative-illustrative-budget:${r.id}`);
console.log(JSON.stringify({schema:1,map:'copper-creek',geometry,budget,issues,ok:issues.length===0,
 combatReplay:{status:'unverified',reason:'Engine, towers and central waves pending in base commit.'}},null,2));
if(issues.length)process.exitCode=1;
