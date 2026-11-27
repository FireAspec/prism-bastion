import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {matrix,recordRun,replay,canonical,MAX_TICKS} from '../src/balance/replay.mjs';
import {STRATEGIES,makePolicy} from '../src/balance/strategies.mjs';

const {values:v}=parseArgs({options:{
 scope:{type:'string',default:'gate'},players:{type:'string',default:'1'},
 seed:{type:'string',default:'73'},map:{type:'string'},mode:{type:'string'},difficulty:{type:'string'},
 strategy:{type:'string'},limit:{type:'string',default:String(MAX_TICKS)},
 output:{type:'string',default:'validation/replays'},verify:{type:'string'},help:{type:'boolean'}
}});
if(v.help){
 console.log('node --import tsx scripts/run-balance.mjs [--scope gate|expanded] [--players 1,2,4] [--map ID] [--mode ID] [--difficulty ID] [--strategy ID] [--seed N] [--limit ticks] [--output DIR] [--verify FILE]');
 process.exit(0);
}
const seed=Number(v.seed),limit=Number(v.limit),players=v.players.split(',').map(Number);
if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||!Number.isSafeInteger(limit)||limit<1||limit>MAX_TICKS) throw Error('Invalid seed/tick limit');
if(new Set(players).size!==players.length)throw Error('Duplicate player counts');
const strategies=STRATEGIES.filter(s=>!v.strategy||s.id===v.strategy);
if(!strategies.length)throw Error('Unknown strategy');
const out=resolve(v.output);
await mkdir(out,{recursive:true});
async function save(path,data){
 const tmp=path+'.tmp';
 await writeFile(tmp,JSON.stringify(data,null,2)+'\n');
 await rename(tmp,path);
}
const report={schema:1,scope:v.scope,players,seed,limit,strategies:strategies.map(s=>s.id),filters:{map:v.map,mode:v.mode,difficulty:v.difficulty},status:'blocked',cells:[],errors:[]};
const reportPath=join(out,'report.json');
try{
 const [{loadContent,validateContent},{createGame},{createCombat}]=await Promise.all([
  import('../src/content/index.ts'),import('../src/engine/index.ts'),import('../src/combat/index.ts')
 ]);
 const config=loadContent(),errors=validateContent(config);
 if(errors.length)throw Error('Content validation: '+errors.join('; '));
 if(typeof config.contentDigest!=='string'||!config.contentDigest)throw Error('Missing content digest');
 report.contentDigest=config.contentDigest;
 const combat=createCombat();
 const makeEngine=options=>createGame(config,options,createCombat());
 const all=matrix(config,v.scope,players);
 if(v.verify){
  const r=JSON.parse(await readFile(v.verify,'utf8'));
  const eligible=matrix(config,'expanded',[1,2,4]).find(c=>canonical(c)===canonical(r.cell));
  if(!eligible)throw Error('Replay uses an invalid campaign profile');
  console.log(JSON.stringify(replay(config,r,makeEngine,limit),null,2));
 }else{
  const selected=all.filter(c=>(!v.map||c.mapId===v.map)&&(!v.mode||c.modeId===v.mode)&&(!v.difficulty||c.difficulty===v.difficulty));
  if(!selected.length)throw Error('No matching matrix cells');
  report.expected=all.length;report.selected=selected.length;report.status='running';
  report.cells=all.map(cell=>({cell,status:'not-run',attempts:[]}));
  const key=c=>[c.mapId,c.difficulty,c.modeId,c.players].join('__');
  const byKey=new Map(report.cells.map(c=>[key(c.cell),c]));
  await save(reportPath,report);
  for(const cell of selected){
   const row=byKey.get(key(cell));
   row.status='running';
   for(const strategy of strategies){
    try{
     const r=recordRun(config,cell,seed,strategy,makeEngine,makePolicy(combat),limit);
     replay(config,r,makeEngine,limit);
     const filename=key(cell)+'__'+seed+'__'+strategy.id+'.json';
     await save(join(out,filename),r);
     row.attempts.push({strategy:strategy.id,status:r.result.won?'verified-win':'verified-defeat',file:filename,result:r.result,bossCheckpoints:r.bossCheckpoints,digest:r.digest});
    }catch(e){
     row.attempts.push({strategy:strategy.id,status:'error',error:String(e?.stack||e)});
    }
   }
   row.status=row.attempts.some(a=>a.status==='verified-win')?'verified-win':row.attempts.every(a=>a.status==='verified-defeat')?'searched-no-win':'inconclusive';
   console.log(key(cell),row.status);
   await save(reportPath,report);
  }
  const wins=report.cells.filter(c=>c.status==='verified-win');
  const pairs=report.cells.filter(c=>c.attempts.some(a=>a.strategy==='no-farms'));
  const counts={};
  for(const row of wins){
   const ids=new Set(row.attempts.filter(a=>a.status==='verified-win').flatMap(a=>a.result.towers.map(t=>t.defId+':'+t.tiers.join('-'))));
   for(const id of ids)counts[id]=(counts[id]||0)+1;
  }
  report.analysis={
   coverage:Object.fromEntries(['verified-win','searched-no-win','inconclusive','not-run','running'].map(s=>[s,report.cells.filter(c=>c.status===s).length])),
   finalBuildFrequency:Object.entries(counts).sort((a,b)=>b[1]-a[1]),
   farmComparison:pairs.map(row=>({cell:row.cell,noFarm:row.attempts.find(a=>a.strategy==='no-farms')?.status,otherWins:row.attempts.filter(a=>a.strategy!=='no-farms'&&a.status==='verified-win').map(a=>a.strategy)})),
   budgets:report.cells.filter(r=>['half-cash','iron-oath'].includes(r.cell.modeId)).map(r=>({cell:r.cell,attempts:r.attempts.map(a=>({strategy:a.strategy,status:a.status,credits:a.result?.credits,spent:a.result?.stats.spent,earned:a.result?.stats.earned,cashSubunits:a.result?.stats.cashSubunits,t5BeforeBoss:a.bossCheckpoints}))})),
   t5:report.cells.flatMap(r=>r.attempts.filter(a=>a.status==='verified-win').map(a=>({cell:r.cell,strategy:a.strategy,bossCheckpoints:a.bossCheckpoints})))
  };
  report.status=wins.length===all.length?'passed':'not-passed';
  await save(reportPath,report);
  console.log('Verified cells:',wins.length,'/',all.length,'; report:',reportPath);
  if(report.status!=='passed')process.exitCode=1;
 }
}catch(e){
 report.status='blocked';report.errors.push(String(e?.stack||e));
 // Verification must not overwrite a prior matrix report.
 if(!v.verify)await save(reportPath,report);
 console.error(e);process.exitCode=1;
}
