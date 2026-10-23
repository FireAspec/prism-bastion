import {auditCandidates,estimatedBudget,replayCandidates,runCandidate,makeRunOptions} from './replays';
import type {GameConfig,GameEngine,RunOptions} from '../../../src/contracts';

const errors=auditCandidates();
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else {
  for(const plan of replayCandidates){
    const rows=estimatedBudget(plan);
    console.log(`${plan.id}: ${plan.status}, ${rows.length} actions, seed ${plan.seed}, opening ${plan.openingCredits}`);
    for(const r of rows){
      console.log(`  w${String(r.wave).padStart(3)} t${String(r.tick).padStart(3)} ${r.action.padEnd(7)} ${r.alias.padEnd(16)} @${r.site.padEnd(17)} cost~${String(r.estimatedCost).padStart(5)} layer-min~${Math.ceil(r.layerCashNeeded)}`);
    }
  }
}

// --engine is intentionally opt-in. It MUST import real modules; absent engine
// is an unverified status, not a successful replay. No test-double is accepted.
if(process.argv.includes('--engine')&&!errors.length){
  try{
    const engineUrl=new URL('../../../src/engine/index.ts',import.meta.url).href;
    const contentUrl=new URL('../../../src/content/index.ts',import.meta.url).href;
    const combatUrl=new URL('../../../src/combat/index.ts',import.meta.url).href;
    const [{createGame},{loadContent},{createCombat}]=await Promise.all([
      import(engineUrl),import(contentUrl),import(combatUrl),
    ]);
    const config=loadContent() as GameConfig;
    for(const plan of replayCandidates){
      const engine=createGame(config,makeRunOptions(plan) as RunOptions,createCombat()) as GameEngine;
      const result=runCandidate(engine,plan);
      console.log(JSON.stringify(result,null,2));
      if(!result.won)process.exitCode=1;
    }
  }catch(e){
    console.error('UNVERIFIED: real engine/content/combat unavailable or replay failed:',e);
    process.exitCode=2;
  }
}else if(!errors.length)console.log('UNVERIFIED: fixture structure passed; no combat replay performed.');
