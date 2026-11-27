import { mkdirSync, writeFileSync } from 'node:fs';
import { createCombat } from '../../src/combat/index';
import { restoreGame } from '../../src/engine/index';
import { cases, fixture, runCase } from '../../src/contact-validation/fixtures';
import { frame, auditTrace, type Trace } from '../../src/contact-validation/index';
import type { GameEngine, GameState } from '../../src/contracts/index';
const out=process.argv[2]??'validation/contact/results';
mkdirSync(out,{recursive:true});
const report:{name:string;status:'pass'|'fail'|'blocked';findings:string[]}[]=[];
const traces:Trace[]=[];
function record(trace:Trace){traces.push(trace);report.push({name:trace.name,status:trace.findings.length?'fail':'pass',findings:trace.findings});}
for(const c of cases){try{record(runCase(c,createCombat()));}catch(e){report.push({name:c.name,status:/pending/i.test(String(e))?'blocked':'fail',findings:[String(e)]});}}
const equal=(a:GameState,b:GameState)=>JSON.stringify({...a,speed:1,paused:false,events:[]})===JSON.stringify({...b,speed:1,paused:false,events:[]});
const step=(engine:GameEngine,seconds:number)=>{engine.step(seconds);return frame(engine.getSnapshot(),engine.drainEvents());};
try{
 const c=cases.find(c=>c.name==='slow-no-early-hit')!;
 const {config,state}=fixture(c), engine=restoreGame(config,state,createCombat());
 const trace:Trace={version:1,name:'pause-speed-save-reconnect',origin:'engine',frames:[frame(engine.getSnapshot())],radii:{target:8},findings:[]};
 for(let i=0;i<10;i++)trace.frames.push(step(engine,1/60));
 const inflight=engine.getSnapshot();
 if(!inflight.projectiles.length)trace.findings.push('no projectile available for save/reconnect');
 if(!engine.dispatch({type:'pause',value:true}).ok)trace.findings.push('pause rejected');
 const paused=engine.getSnapshot();step(engine,1);
 if(!equal(paused,engine.getSnapshot()))trace.findings.push('state advanced during pause');
 if(!engine.dispatch({type:'pause',value:false}).ok)trace.findings.push('resume rejected');
 const restored=restoreGame(config,JSON.parse(JSON.stringify(inflight)),createCombat());
 if(!equal(inflight,restored.getSnapshot()))trace.findings.push('restore lost in-flight state');
 const fast=restoreGame(config,JSON.parse(JSON.stringify(inflight)),createCombat());
 if(!fast.dispatch({type:'speed',value:3}).ok)trace.findings.push('3x rejected');
 for(let i=0;i<20;i++){
   for(let j=0;j<3;j++){trace.frames.push(step(engine,1/60));step(restored,1/60);}
   step(fast,1/60);
   if(!equal(engine.getSnapshot(),restored.getSnapshot()))trace.findings.push(`restore divergence at group ${i}`);
   if(!equal(engine.getSnapshot(),fast.getSnapshot()))trace.findings.push(`3x divergence at group ${i}`);
 }
 trace.findings.push(...auditTrace(trace,config));record(trace);
}catch(e){report.push({name:'pause-speed-save-reconnect',status:/pending/i.test(String(e))?'blocked':'fail',findings:[String(e)]});}
try{
 const c=cases.find(c=>c.name==='slow-no-early-hit')!;
 const {config,state}=fixture(c);config.enemies[0].speed=120;
 state.enemies[0].statuses=[{kind:'freeze',power:1,duration:.4,remaining:.4,source:'t0',stacks:1}];
 const engine=restoreGame(config,state,createCombat()), trace:Trace={version:1,name:'freeze-contact',origin:'engine',frames:[frame(engine.getSnapshot())],radii:{target:8},findings:[]};
 for(let i=0;i<60;i++)trace.frames.push(step(engine,1/60));
 const f=trace.frames[1].state.enemies[0];if(f&&f.progress>2+1e-7)trace.findings.push('invalid frozen progress');
 if(trace.frames.slice(1,10).some(f=>f.state.enemies[0]?.hp!==100))trace.findings.push('premature damage while frozen');
 trace.findings.push(...auditTrace(trace,config));record(trace);
}catch(e){report.push({name:'freeze-contact',status:/pending/i.test(String(e))?'blocked':'fail',findings:[String(e)]});}
writeFileSync(`${out}/traces.json`,JSON.stringify(traces));writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
console.table(report.map(({name,status})=>({name,status})));if(report.some(r=>r.status!=='pass'))process.exitCode=1;
