import {createHash} from 'node:crypto';

export const MODES=['standard','half-cash','no-leaks','iron-oath','short-supply','blackout','stormfront','overdrive','low-tech','no-actives'];
export const DIFFICULTIES=['easy','normal','hard','extreme'];
export const INITIAL=['needle','cannon','frost','beacon'];
export const STEP=15;
export const MAX_TICKS=1800000;
export function canonical(value){
 if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 if(value && typeof value==='object') return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 if(typeof value==='number'&&!Number.isFinite(value)) throw Error('Nonfinite state');
 return JSON.stringify(value);
}
export const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function profiles(config){
 const maps=[...config.maps].sort((a,b)=>a.campaignIndex-b.campaignIndex);
 if(maps.length!==20||new Set(maps.map(m=>m.id)).size!==20||new Set(maps.map(m=>m.campaignIndex)).size!==20) throw Error('Expected 20 unique campaign maps');
 if(MODES.some(id=>!config.modes.some(m=>m.id===id))||DIFFICULTIES.some(id=>!config.difficulties.some(d=>d.id===id))) throw Error('Incomplete mode/difficulty catalog');
 const towers=new Set(INITIAL), done=new Set();
 return maps.map((map,index)=>{
  const node=config.campaign.find(n=>n.mapId===map.id);
  if(!node||node.prerequisites.some(id=>!done.has(id))) throw Error('Invalid campaign order: '+map.id);
  if(map.recommendedDifficulty!==DIFFICULTIES[Math.floor(index/5)]) throw Error('Unexpected recommended difficulty: '+map.id);
  const before=[...towers];
  for(const id of node.unlocks) towers.add(id);
  done.add(node.id);
  if([...towers].some(id=>!config.towers.some(t=>t.id===id))) throw Error('Missing unlocked tower');
  return {map,before,after:[...towers]};
 });
}
export function matrix(config,scope='gate',players=[1]){
 if(!['gate','expanded'].includes(scope)||players.some(n=>![1,2,4].includes(n))) throw Error('Invalid matrix selection');
 return profiles(config).flatMap(({map,before,after})=>MODES.flatMap(mode=>
  (scope==='gate'?[map.recommendedDifficulty]:DIFFICULTIES).flatMap(difficulty=>players.map(count=>({
   mapId:map.id,difficulty,modeId:mode,players:count,availableTowers:mode==='standard'?before:after,
   profile:mode==='standard'?'first-arrival':'first-clear'
  })))));
}
export function optionsFor(cell,seed){
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||![1,2,4].includes(cell.players)) throw Error('Invalid seed/player count');
 return {mapId:cell.mapId,difficulty:cell.difficulty,modeId:cell.modeId,seed,endless:false,
 unlockedTowers:[...cell.availableTowers],knowledge:[],runId:[cell.mapId,cell.difficulty,cell.modeId,cell.players,seed].join(':'),
 players:Array.from({length:cell.players},(_,i)=>({id:'p'+(i+1),name:'Player '+(i+1),color:['#ffaa33','#66aaff','#66cc88','#cc99ff'][i],connected:true}))};
}
const terminal=s=>s.phase==='victory'||s.phase==='defeat';
export function safeState(engine){
 const s=engine.getSnapshot();
 if(!Number.isSafeInteger(s.tick)||s.tick<0||!Number.isSafeInteger(s.credits)||s.credits<0||!Number.isSafeInteger(s.lives)||s.lives<0||s.lives>s.rules.maxLives) throw Error('Invalid engine state');
 return s;
}
export function advance(engine,from,limit=MAX_TICKS){
 if(from.tick>=limit) throw Error('Tick limit');
 engine.step(Math.min(STEP,limit-from.tick)/60);
 engine.drainEvents();
 const next=safeState(engine);
 if(next.tick<=from.tick||next.tick>from.tick+STEP) throw Error('Engine failed fixed-step progress');
 return next;
}
function checkpoint(s){
 return [10,20,40,60,80,100].includes(s.wave)?{wave:s.wave,credits:s.credits,t5:s.towers.filter(t=>Math.max(...t.tiers)===5).map(t=>({id:t.defId,tiers:t.tiers})),spent:s.stats.spent}:null;
}
export function initial(engine,options,config){
 const s=safeState(engine);
 if(s.tick!==0||s.phase!=='build'||s.options.knowledge.length||canonical(s.options.unlockedTowers)!==canonical(options.unlockedTowers)||s.options.players.length!==options.players.length) throw Error('Unexpected initial state/profile');
 if(s.rules.maxLives===1&&s.lives!==1) throw Error('One-life rule violated');
 if(['no-leaks','iron-oath'].includes(options.modeId)&&s.rules.maxLives!==1)throw Error('Strict life limit violated');
 if(options.modeId==='iron-oath'&&(s.rules.allowPassiveIncome||s.rules.allowKnowledge||s.rules.sellAllowed))throw Error('Iron oath rules violated');
 if(options.modeId==='half-cash'&&(s.rules.incomeMul!==.5||s.rules.startingCashMul!==.5))throw Error('Half-cash rules violated');
 if(options.modeId==='short-supply'&&s.rules.maxTowers!==12)throw Error('Tower limit violated');
 if(options.modeId==='low-tech'&&s.rules.maxTier!==3)throw Error('Tier limit violated');
 if(options.modeId==='no-actives'&&s.rules.allowAbilities)throw Error('Ability limit violated');
 if(config?.difficulties?.some(d=>d.id===options.difficulty&&Number.isFinite(d.startCredits))){
  const d=config.difficulties.find(d=>d.id===options.difficulty),m=config.modes.find(m=>m.id===options.modeId);
  const factor={1:1,2:1.25,4:1.75}[options.players.length];
  const starting=options.modeId==='half-cash'?.5:(m.modifiers.startingCashMul??1);
  const expectedCents=Math.round(d.startCredits*starting*factor*100);
  if(s.credits*100+s.stats.cashSubunits!==expectedCents||s.stats.earned!==0||s.stats.spent!==0)throw Error('Starting budget/scaling mismatch');
  const hp=(m.modifiers.enemyHpMul??d.enemyHpMul)*factor;
  if(Math.abs(s.rules.enemyHpMul-hp)>1e-9)throw Error('Enemy health scaling mismatch');
  if(s.rules.rounds!==d.rounds)throw Error('Difficulty round count mismatch');
 }
 return s;
}
export function outcome(s){
 if(s.phase==='victory'&&(s.wave!==s.rules.rounds||s.lives<=0))throw Error('Invalid victory state');
 if(s.phase==='defeat'&&s.lives!==0)throw Error('Invalid defeat state');
 return {won:s.phase==='victory',phase:s.phase,wave:s.wave,tick:s.tick,lives:s.lives,credits:s.credits,stats:s.stats,
 towers:s.towers.map(t=>({defId:t.defId,tiers:t.tiers,invested:t.invested,damage:t.damageDealt,generated:t.generated,kills:t.kills}))};
}
export function stateDigest(s){return digest({...s,events:[]});}
export function recordRun(config,cell,seed,strategy,makeEngine,policy,limit=MAX_TICKS){
 const options=optionsFor(cell,seed),engine=makeEngine(options);
 let s=initial(engine,options,config);
 const actions=[],bossCheckpoints=[];
 const issue=command=>{
  const result=engine.dispatch(command);
  if(result.ok&&!result.pending){
   actions.push({tick:s.tick,time:s.time,wave:s.wave,command,result:{entity:result.entity??null,amount:result.amount??null}});
   s=safeState(engine);
   if(command.type==='startWave'){const cp=checkpoint(s);if(cp)bossCheckpoints.push(cp);}
   return true;
  }
  if(result.pending) throw Error('Headless engine returned pending command');
  return false;
 };
 while(!terminal(s)){
  if(s.phase==='build'){
   policy({state:()=>s,issue,config,cell,strategy});
   if(!issue({type:'startWave',actor:options.players[0].id})) throw Error('Wave start rejected');
  }else if(s.phase==='wave'&&s.tick%60<STEP){
   policy({state:()=>s,issue,config,cell,strategy});
  }
  if(!terminal(s)) s=advance(engine,s,limit);
 }
 const record={schema:1,contentDigest:config.contentDigest,cell,seed,strategy,options,actions,bossCheckpoints,result:outcome(s),digest:stateDigest(s)};
 return record;
}
export function replay(config,record,makeEngine,limit=MAX_TICKS){
 if(record.schema!==1||record.contentDigest!==config.contentDigest) throw Error('Replay content mismatch');
 const expected=optionsFor(record.cell,record.seed);
 if(canonical(expected)!==canonical(record.options)) throw Error('Replay profile mismatch');
 const engine=makeEngine(expected);let s=initial(engine,expected,config);const bossCheckpoints=[];
 for(const item of record.actions){
  if(!Number.isSafeInteger(item.tick)||item.tick<s.tick) throw Error('Invalid action order');
  while(s.tick<item.tick){
   if(terminal(s)||s.phase==='build') throw Error('Replay stalled before command');
   s=advance(engine,s,limit);
  }
  if(s.tick!==item.tick||s.wave!==item.wave||s.time!==item.time||terminal(s)) throw Error('Replay action time mismatch');
  const result=engine.dispatch(item.command);
  if(!result.ok||result.pending||canonical({entity:result.entity??null,amount:result.amount??null})!==canonical(item.result)) throw Error('Replay command rejected or changed');
  s=safeState(engine);
  if(item.command.type==='startWave'){const cp=checkpoint(s);if(cp)bossCheckpoints.push(cp);}
 }
 while(!terminal(s)){
  if(s.phase==='build') throw Error('Replay missing wave start');
  s=advance(engine,s,limit);
 }
 if(canonical(bossCheckpoints)!==canonical(record.bossCheckpoints)||canonical(outcome(s))!==canonical(record.result)||stateDigest(s)!==record.digest) throw Error('Replay outcome/digest mismatch');
 return outcome(s);
}
