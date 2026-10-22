import {WORLD} from '../contracts';
import type {
 CombatModule,CommandResult,DifficultyDef,EffectDef,GameCommand,GameConfig,
 GameEngine,GameEvent,GameState,MapDef,PathIndex,RuleModifiers,RunOptions,
 Targeting,TowerDef,TowerState,Vec,WaveDef,
} from '../contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon,pointOnLane} from '../contracts/geometry';
import {canUpgrade,legalTiers,sellRefund} from '../contracts/rules';
import {credit,emit,spawnEnemy} from '../contracts/runtime';

const FRAME_LIMIT = 0.25;
const EPSILON = 1e-8;
const MAX_ENEMIES = 1800;
const MAX_BUFFERED_EVENTS = 16384;
const MONEY_EFFECTS = new Set(['income','interest','harvest']);
const PLAYER_MULTIPLIER = [1,1.25,1.5,1.75] as const;
const TARGETS:Targeting[] = ['first','last','strong','near'];

function copy<T>(value:T):T{return structuredClone(value);}
function sameValue(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&
  a.length===b.length&&a.every((v,i)=>sameValue(v,b[i]));
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
 const keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&
  keys.every(k=>Object.prototype.hasOwnProperty.call(right,k)&&sameValue(left[k],right[k]));
}
function finite(n:number):boolean{return typeof n==='number'&&Number.isFinite(n);}
function nonnegative(n:number):boolean{return finite(n)&&n>=0;}
function count(n:number):boolean{return Number.isSafeInteger(n)&&n>=0;}
function bounded(n:number,lo:number,hi:number):number{return Math.max(lo,Math.min(hi,n));}

function ownConfig(source:GameConfig):GameConfig {
 // Functions cannot be structured-cloned. Every mutable collection is private.
 const {endlessWave,...data}=source;
 return {...copy(data),...(endlessWave?{endlessWave}: {})};
}

function configuration(config:GameConfig,options:RunOptions):{rules:RuleModifiers;difficulty:DifficultyDef;map:MapDef} {
 const difficulty=config.difficulties.find(d=>d.id===options.difficulty);
 const map=config.maps.find(m=>m.id===options.mapId);
 const mode=config.modes.find(m=>m.id===options.modeId);
 if(!difficulty||!map||!mode)throw new Error('Unknown map, mode or difficulty');
 if(!Number.isSafeInteger(options.seed))throw new Error('Invalid seed');
 if(!Array.isArray(options.players)||options.players.length<1||options.players.length>4||
  new Set(options.players.map(p=>p.id)).size!==options.players.length||options.players.some(p=>!p.id||p.id==='server'))
  throw new Error('Invalid player roster');
 if(!Array.isArray(options.unlockedTowers)||!Array.isArray(options.knowledge))throw new Error('Invalid run options');
 if(!nonnegative(map.pathWidth)||map.lanes.length===0||
  map.lanes.some(l=>l.length<2||!l.every(p=>finite(p.x)&&finite(p.y))))
  throw new Error('Invalid map lanes');
 const rules:RuleModifiers={
  incomeMul:1,startingCashMul:1,enemyHpMul:difficulty.enemyHpMul,
  enemySpeedMul:1,towerCostMul:difficulty.towerCostMul,sellAllowed:true,
  maxLives:difficulty.lives,allowAbilities:true,allowPassiveIncome:true,maxTowers:60,
  maxTier:5,weather:'none',allowKnowledge:true,rounds:difficulty.rounds,
  roundRewardBase:difficulty.roundRewardBase,roundRewardStep:difficulty.roundRewardStep,
  popCashMul:difficulty.popCashMul,
  ...mode.modifiers,
 };
 // These mode restrictions must hold regardless of partial catalog overrides.
 if(options.modeId==='no-leaks'||options.modeId==='iron-oath')rules.maxLives=1;
 if(options.modeId==='iron-oath'){
  rules.allowPassiveIncome=false;rules.allowKnowledge=false;rules.sellAllowed=false;
 }
 if(options.modeId==='half-cash'){
  rules.incomeMul=0.5;rules.startingCashMul=0.5;
 }
 const positive=['incomeMul','startingCashMul','enemyHpMul','enemySpeedMul','towerCostMul','popCashMul'] as const;
 if(positive.some(k=>!nonnegative(rules[k]))||
  !count(rules.rounds)||rules.rounds===0||!count(rules.maxTowers)||
  !count(rules.maxTier)||rules.maxTier>5||!nonnegative(rules.roundRewardBase)||
  !nonnegative(rules.roundRewardStep)||!Number.isSafeInteger(rules.maxLives)||rules.maxLives<1)
  throw new Error('Invalid gameplay rules');
 rules.enemyHpMul*=PLAYER_MULTIPLIER[options.players.length-1];
 if(!finite(rules.enemyHpMul))throw new Error('Invalid multiplayer health scale');
 return {rules,difficulty,map};
}

function polygonTouchesDisk(center:Vec,radius:number,polygon:Vec[]):boolean {
 if(polygon.length<3)return false;
 if(pointInPolygon(center,polygon))return true;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length];
  if(distance(center,a)<radius-EPSILON||distanceToSegment(center,a,b)<radius-EPSILON)return true;
 }
 return false;
}
function diskInsidePolygon(center:Vec,radius:number,polygon:Vec[]):boolean {
 if(polygon.length<3||!pointInPolygon(center,polygon))return false;
 for(let i=0;i<polygon.length;i++)
  if(distanceToSegment(center,polygon[i],polygon[(i+1)%polygon.length])<radius-EPSILON)return false;
 return true;
}
function canPlace(map:MapDef,def:TowerDef,pos:Vec,towers:TowerState[],catalog:TowerDef[]):boolean {
 const r=def.footprint;
 if(!finite(pos.x)||!finite(pos.y)||!finite(r)||r<=0||
  pos.x-r<0||pos.y-r<0||pos.x+r>WORLD.width||pos.y+r>WORLD.height)return false;
 if(map.blocked.some(p=>polygonTouchesDisk(pos,r,p)))return false;
 if(map.lanes.some(lane=>lane.some((p,i)=>i>0&&
  distanceToSegment(pos,lane[i-1],p)<r+map.pathWidth/2-EPSILON)))return false;
 if(def.placement==='water'){
  if(!map.water.some(p=>diskInsidePolygon(pos,r,p)))return false;
 }else if(def.placement==='land'&&map.water.some(p=>polygonTouchesDisk(pos,r,p)))return false;
 return towers.every(t=>{
  const other=catalog.find(d=>d.id===t.defId);
  return !!other&&distance(t.pos,pos)>=r+other.footprint-EPSILON;
 });
}

function withoutForbiddenEconomy(config:GameConfig,rules:RuleModifiers):GameConfig {
 if(rules.allowPassiveIncome&&rules.maxLives>1)return config;
 const permitted=(e:EffectDef):boolean=>
  (rules.allowPassiveIncome||!MONEY_EFFECTS.has(e.kind))&&
  (rules.maxLives>1||e.kind!=='barrier');
 return {
  ...config,
  towers:config.towers.map(t=>({
   ...t,effects:t.effects.filter(permitted),
   abilities:t.abilities.filter(a=>(rules.allowPassiveIncome||a.kind!=='mint')&&
    (rules.maxLives>1||a.kind!=='barrier')),
   paths:t.paths.map(path=>({
    ...path,upgrades:path.upgrades.map(u=>({
     ...u,effects:u.effects?.filter(permitted),
     abilities:u.abilities?.filter(a=>(rules.allowPassiveIncome||a.kind!=='mint')&&
      (rules.maxLives>1||a.kind!=='barrier')),
    })),
   })) as TowerDef['paths'],
  })),
 };
}

function scheduledWave(config:GameConfig,map:MapDef,n:number,seed:number):WaveDef {
 const normal=config.waves.find(w=>w.number===n);
 const base=normal??(n>100?config.endlessWave?.(n,seed):undefined);
 if(!base)throw new Error(`Missing wave ${n}`);
 const override=map.waveOverrides[n]??{};
 const wave={...base,...override,number:n};
 if(!Array.isArray(wave.groups)||wave.groups.some(g=>
  !config.enemies.some(e=>e.id===g.enemy)||!count(g.count)||!nonnegative(g.at)||
  !nonnegative(g.every)||!count(g.lane)||
  (g.hpMul!==undefined&&!nonnegative(g.hpMul))||
  (g.speedMul!==undefined&&!nonnegative(g.speedMul))))
  throw new Error(`Invalid spawn groups in wave ${n}`);
 return wave;
}
function effectivePrice(base:number,rules:RuleModifiers,discount:number):number {
 if(!nonnegative(base))throw new Error('Invalid tower price');
 const amount=Math.max(1,Math.ceil(base*rules.towerCostMul*(1-bounded(discount,0,0.2))));
 if(!Number.isSafeInteger(amount))throw new Error('Tower price exceeds safe integer range');
 return amount;
}

function validateSnapshot(s:GameState,rules:RuleModifiers,map:MapDef,config:GameConfig):void {
 if(s.version!==1||s.tick<0||!count(s.tick)||s.wave<0||!count(s.wave)||
  !count(s.nextEntity)||!count(s.nextEvent)||!count(s.credits)||
  !Number.isSafeInteger(s.lives)||s.lives<0||s.lives>rules.maxLives||
  !nonnegative(s.time)||!nonnegative(s.waveTime)||Math.abs(s.time-s.tick*WORLD.tick)>1e-6||
  (s.wave>rules.rounds&&!s.options.endless)||
  (s.phase==='victory'&&s.wave!==rules.rounds)||
  (s.phase==='defeat'&&s.lives!==0)||
  (s.phase!=='defeat'&&s.lives===0)||
  typeof s.paused!=='boolean'||typeof s.autoStart!=='boolean'||
  ![1,2,3].includes(s.speed)||
  !['build','wave','victory','defeat'].includes(s.phase)||
  !Array.isArray(s.events)||!Array.isArray(s.enemies)||!Array.isArray(s.towers)||
  !Array.isArray(s.projectiles)||!Array.isArray(s.strikes)||!Array.isArray(s.spawnCursor)||
  !count(s.stats.spent)||!count(s.stats.earned)||!count(s.stats.kills)||
  !nonnegative(s.stats.damage)||!count(s.stats.leaks)||!count(s.stats.abilities)||
  !count(s.stats.cashSubunits)||s.stats.cashSubunits>=100)
  throw new Error('Invalid saved game');
 if(s.phase==='wave'){
  const w=scheduledWave(config,map,s.wave,s.options.seed);
  if(s.spawnCursor.length!==w.groups.length||s.spawnCursor.some((c,i)=>!count(c)||c>w.groups[i].count))
   throw new Error('Invalid spawn cursor');
 }
 if(s.towers.some(t=>!config.towers.some(d=>d.id===t.defId)||
  !s.options.players.some(p=>p.id===t.owner)||!legalTiers(t.tiers)||
  t.tiers.some(tier=>tier>rules.maxTier)||
  !s.options.unlockedTowers.includes(t.defId)||
  !count(t.invested)||t.invested===0||!finite(t.pos.x)||!finite(t.pos.y)))
  throw new Error('Invalid saved towers');
 const ids=new Set<string>(),specializations=new Set<string>();
 for(const t of s.towers){
  if(ids.has(t.id))throw new Error('Duplicate saved entity ID');
  ids.add(t.id);
  for(const path of [0,1,2]){
   if(t.tiers[path]!==5)continue;
   const key=`${t.defId}:${path}`;
   if(specializations.has(key))throw new Error('Duplicate saved tier-five specialization');
   specializations.add(key);
  }
 }
 if(s.enemies.some(e=>!config.enemies.some(d=>d.id===e.defId)||
  !map.lanes[e.lane]||!nonnegative(e.progress)||!finite(e.pos.x)||!finite(e.pos.y)||
  !Array.isArray(e.paidLayers)||new Set(e.paidLayers).size!==e.paidLayers.length||
  e.paidLayers.some(layer=>!count(layer))))
  throw new Error('Invalid saved enemies');
 for(const e of s.enemies){
  if(ids.has(e.id))throw new Error('Duplicate saved entity ID');
  ids.add(e.id);
 }
}

class Simulation implements GameEngine {
 private readonly config:GameConfig;
 private readonly combatConfig:GameConfig;
 private readonly combat:CombatModule;
 private readonly map:MapDef;
 private state:GameState;
 private frameRemainder=0;
 private readonly lengths:number[];
 private readonly waveCache=new Map<number,WaveDef>();

 constructor(config:GameConfig,options:RunOptions,combat:CombatModule,snapshot?:GameState){
  this.config=ownConfig(config);
  this.combat=combat;
  const opts=copy(options);
  const {rules,difficulty,map}=configuration(this.config,opts);
  this.map=map;
  this.lengths=map.lanes.map(l=>laneLength(l));
  if(!this.lengths.every(n=>n>0))throw new Error('Zero-length lane');
  this.combatConfig=withoutForbiddenEconomy(this.config,rules);
  if(snapshot){
   this.state=copy(snapshot);
   if(!sameValue(this.state.options,opts)||!sameValue(this.state.rules,rules))
    throw new Error('Saved run does not match selected options/rules');
   validateSnapshot(this.state,rules,map,this.config);
  }else{
   const initial=difficulty.startCredits*rules.startingCashMul*
    PLAYER_MULTIPLIER[opts.players.length-1];
   if(!nonnegative(initial)||initial>Number.MAX_SAFE_INTEGER/100)throw new Error('Invalid starting credits');
   // Preserve fractional starting credits without marking them earned.
   const cents=Math.round(initial*100);
   const lives=Math.min(rules.maxLives,Math.max(1,Math.floor(rules.maxLives)));
   this.state={version:1,options:opts,phase:'build',time:0,rules,tick:0,rng:opts.seed>>>0,
    nextEntity:1,nextEvent:1,credits:Math.floor(cents/100),lives,
    wave:0,waveTime:0,spawnCursor:[],paused:false,speed:1,autoStart:false,
    towers:[],enemies:[],events:[],projectiles:[],strikes:[],
    stats:{spent:0,earned:0,kills:0,damage:0,leaks:0,abilities:0,cashSubunits:cents%100}};
  }
 }
 private compactEvents():void {
  const excess=this.state.events.length-MAX_BUFFERED_EVENTS;
  if(excess>0)this.state.events.splice(0,excess);
 }
 getSnapshot():GameState{this.compactEvents();return copy(this.state);}
 drainEvents():GameEvent[]{
  this.compactEvents();
  const events=copy(this.state.events);this.state.events=[];return events;
 }

 private owner(actor:string|undefined):string|null {
  if(this.state.options.players.length===1){
   const id=this.state.options.players[0].id;
   return actor===undefined||actor===id?id:null;
  }
  return actor&&this.state.options.players.some(p=>p.id===actor)?actor:null;
 }
 private waveDefinition(n:number):WaveDef {
  let wave=this.waveCache.get(n);
  if(!wave){
   wave=scheduledWave(this.config,this.map,n,this.state.options.seed);
   this.waveCache.set(n,wave);
  }
  return wave;
 }
 private globalAccess(actor:string|undefined):boolean {
  return this.state.options.players.length===1?
   actor===undefined||actor==='server'||actor===this.state.options.players[0].id:
   actor==='server';
 }
 private findTower(id:string):TowerState|undefined{return this.state.towers.find(t=>t.id===id);}
 private definition(id:string):TowerDef|undefined{return this.combatConfig.towers.find(t=>t.id===id);}
 private discount(pos:Vec,exclude?:string):number {
  let support=0;
  for(const tower of this.state.towers){
   if(tower.id===exclude)continue;
   const def=this.definition(tower.defId);
   if(!def)continue;
   for(const effect of this.combat.resolveTower(def,tower.tiers).effects){
    if(effect.kind==='aura'&&effect.stat==='discount'&&
     nonnegative(effect.power)&&nonnegative(effect.radius)&&
     distance(pos,tower.pos)<=effect.radius)support=Math.max(support,effect.power);
   }
  }
  const knowledge=this.state.rules.allowKnowledge?bounded(this.config.knowledgeDiscount,0,0.08):0;
  return Math.min(0.2,knowledge+Math.min(0.15,support));
 }
 private spend(amount:number):boolean {
  if(!count(amount)||amount<1||this.state.credits<amount||
   !Number.isSafeInteger(this.state.stats.spent+amount))return false;
  this.state.credits-=amount;this.state.stats.spent+=amount;return true;
 }
 private place(cmd:Extract<GameCommand,{type:'place'}>,actor:string):CommandResult {
  const def=this.definition(cmd.tower);
  if(!def||!this.state.options.unlockedTowers.includes(cmd.tower))return {ok:false,reason:'locked-tower'};
  if(this.state.towers.length>=this.state.rules.maxTowers)return {ok:false,reason:'tower-limit'};
  if(!cmd.pos||!canPlace(this.map,def,cmd.pos,this.state.towers,this.combatConfig.towers))
   return {ok:false,reason:'invalid-placement'};
  const cost=effectivePrice(def.cost,this.state.rules,this.discount(cmd.pos));
  if(!this.spend(cost))return {ok:false,reason:'insufficient-credits'};
  const id=`t${this.state.nextEntity++}`;
  const tower:TowerState={id,defId:def.id,owner:actor,pos:copy(cmd.pos),tiers:[0,0,0],
   targeting:'first',invested:cost,cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0};
  this.state.towers.push(tower);
  emit(this.state,{kind:'place',source:id,pos:copy(cmd.pos),amount:cost,toVisual:def.visual.asset});
  return {ok:true,entity:id,amount:cost};
 }
 private upgrade(tower:TowerState,path:PathIndex):CommandResult {
  if(![0,1,2].includes(path)||!canUpgrade(tower.tiers,path))return {ok:false,reason:'invalid-crosspath'};
  const next=(tower.tiers[path]+1) as 1|2|3|4|5;
  if(next>this.state.rules.maxTier)return {ok:false,reason:'tier-limit'};
  if(next===5&&this.state.towers.some(t=>t.id!==tower.id&&t.defId===tower.defId&&t.tiers[path]===5))
   return {ok:false,reason:'team-tier-five-limit'};
  const def=this.definition(tower.defId)!;
  const upgrade=def.paths[path].upgrades[next-1];
  if(!upgrade||upgrade.tier!==next)return {ok:false,reason:'missing-upgrade'};
  const cost=effectivePrice(upgrade.cost,this.state.rules,this.discount(tower.pos,tower.id));
  if(!this.spend(cost))return {ok:false,reason:'insufficient-credits'};
  const from=this.combat.resolveTower(def,tower.tiers).visual.asset;
  tower.invested+=cost;tower.tiers[path]=next;
  const resolved=this.combat.resolveTower(def,tower.tiers);
  emit(this.state,{kind:'upgrade',source:tower.id,pos:copy(tower.pos),amount:cost,
   fromVisual:from,toVisual:resolved.visual.asset});
  return {ok:true,entity:tower.id,amount:cost};
 }
 private sell(tower:TowerState):CommandResult {
  if(!this.state.rules.sellAllowed)return {ok:false,reason:'selling-disabled'};
  const refund=sellRefund(tower.invested);
  if(!Number.isSafeInteger(this.state.credits+refund))return {ok:false,reason:'credit-limit'};
  this.state.towers.splice(this.state.towers.indexOf(tower),1);
  this.state.credits+=refund;
  emit(this.state,{kind:'sell',source:tower.id,pos:copy(tower.pos),amount:refund});
  return {ok:true,entity:tower.id,amount:refund};
 }
 private ability(tower:TowerState,id:string):CommandResult {
  if(!this.state.rules.allowAbilities)return {ok:false,reason:'abilities-disabled'};
  const def=this.definition(tower.defId)!;
  const ability=this.combat.resolveTower(def,tower.tiers).abilities.find(a=>a.id===id);
  if(!ability)return {ok:false,reason:'unknown-ability'};
  if((!this.state.rules.allowPassiveIncome&&ability.kind==='mint')||
   (this.state.rules.maxLives===1&&ability.kind==='barrier'))return {ok:false,reason:'ability-prohibited'};
  return this.combat.activate(this.state,this.combatConfig,tower.id,id);
 }
 private startWave():CommandResult {
  if(this.state.phase!=='build')return {ok:false,reason:'not-building'};
  const next=this.state.wave+1;
  if(next>this.state.rules.rounds&&!this.state.options.endless)return {ok:false,reason:'run-complete'};
  const wave=this.waveDefinition(next);
  this.state.wave=next;this.state.phase='wave';this.state.waveTime=0;
  this.state.spawnCursor=wave.groups.map(()=>0);
  emit(this.state,{kind:'waveStart',amount:next});
  return {ok:true};
 }
 dispatch(command:GameCommand):CommandResult {
  this.compactEvents();
  const {type,actor}=command;
  if(type==='pause'||type==='speed'||type==='autoStart'||type==='startWave'){
   if(!this.globalAccess(actor))return {ok:false,reason:'server-only'};
   if(type==='pause'){
    if(typeof command.value!=='boolean')return {ok:false,reason:'invalid-pause'};
    this.state.paused=command.value;return {ok:true};
   }
   if(type==='speed'){
    if(![1,2,3].includes(command.value))return {ok:false,reason:'invalid-speed'};
    this.state.speed=command.value;return {ok:true};
   }
   if(type==='autoStart'){
    if(typeof command.value!=='boolean')return {ok:false,reason:'invalid-autostart'};
    this.state.autoStart=command.value;return {ok:true};
   }
   return this.startWave();
  }
  if(this.state.phase==='victory'||this.state.phase==='defeat')return {ok:false,reason:'run-finished'};
  const owner=this.owner(actor);
  if(!owner)return {ok:false,reason:'invalid-actor'};
  if(type==='place')return this.place(command,owner);
  const tower=this.findTower(command.tower);
  if(!tower)return {ok:false,reason:'unknown-tower'};
  if(tower.owner!==owner)return {ok:false,reason:'not-owner'};
  if(type==='upgrade')return this.upgrade(tower,command.path);
  if(type==='sell')return this.sell(tower);
  if(type==='target'){
   if(!TARGETS.includes(command.targeting))return {ok:false,reason:'invalid-targeting'};
   tower.targeting=command.targeting;return {ok:true,entity:tower.id};
  }
  if(type==='ability')return this.ability(tower,command.ability);
  return {ok:false,reason:'unknown-command'};
 }
 reassignOwner(fromPlayerId:string,toPlayerId:string):CommandResult {
  // Only the authoritative host receives this method. The host verifies
  // the disconnection grace-period and caller permissions before invoking.
  if(fromPlayerId===toPlayerId||!this.state.options.players.some(p=>p.id===fromPlayerId)||
   !this.state.options.players.some(p=>p.id===toPlayerId))return {ok:false,reason:'invalid-owner'};
  let transferred=0;
  for(const tower of this.state.towers)if(tower.owner===fromPlayerId){tower.owner=toPlayerId;transferred++;}
  return {ok:true,amount:transferred};
 }
 private spawn(wave:WaveDef):void {
  wave.groups.forEach((g,i)=>{
   while(this.state.spawnCursor[i]<g.count&&this.state.enemies.length<MAX_ENEMIES&&
    g.at+g.every*this.state.spawnCursor[i]<=this.state.waveTime+EPSILON){
    spawnEnemy(this.state,this.combatConfig,g.enemy,g.lane%this.map.lanes.length,0,
     this.state.rules.enemyHpMul*(g.hpMul??1),this.state.rules.enemySpeedMul*(g.speedMul??1));
    this.state.spawnCursor[i]++;
   }
  });
 }
 private moveAndLeak(dt:number):void {
  for(let i=this.state.enemies.length-1;i>=0;i--){
   const enemy=this.state.enemies[i];
   const def=this.config.enemies.find(d=>d.id===enemy.defId);
   if(!def)throw new Error(`Unknown active enemy: ${enemy.defId}`);
   const hardStopped=enemy.statuses.some(st=>(st.kind==='freeze'||st.kind==='stun')&&st.remaining>0);
   const slow=enemy.statuses.reduce((v,st)=>st.kind==='slow'&&st.remaining>0?
    Math.max(v,bounded(st.power,0,0.75)):v,0);
   const speed=hardStopped?0:def.speed*(enemy.memory.speedMul??1)*
    (enemy.memory.phaseSpeedMul??1)*(1-slow);
   enemy.progress+=Math.max(0,speed)*dt;
   enemy.pos=pointOnLane(this.map.lanes[enemy.lane],enemy.progress);
   if(enemy.progress+EPSILON<this.lengths[enemy.lane])continue;
   this.state.enemies.splice(i,1);
   const leaked=Math.max(1,Math.floor(def.leak));
   this.state.lives=Math.max(0,this.state.lives-leaked);
   this.state.stats.leaks++;
   emit(this.state,{kind:'leak',target:enemy.id,pos:copy(enemy.pos),amount:leaked});
   if(this.state.lives===0){this.defeat();break;}
  }
 }
 private defeat():void {
  if(this.state.phase==='defeat')return;
  this.state.phase='defeat';this.state.lives=0;
  emit(this.state,{kind:'defeat',amount:this.state.wave});
 }
 private terminal():boolean{return this.state.phase==='victory'||this.state.phase==='defeat';}
 private completeWave():void {
  const s=this.state;
  emit(s,{kind:'waveEnd',amount:s.wave});
  // Interest is based on the opening end-of-round balance, rather than the
  // income generated by other towers or the current round reward.
  const bankBase=s.credits+s.stats.cashSubunits/100;
  const incomes:{tower:TowerState;amount:number}[]=[];
  let healing=0;
  for(const tower of s.towers){
   const def=this.definition(tower.defId)!;
   for(const effect of this.combat.resolveTower(def,tower.tiers).effects){
    if(effect.kind==='barrier'&&s.rules.maxLives>1)healing+=Math.max(0,effect.power);
    if(!s.rules.allowPassiveIncome)continue;
    if(effect.kind==='income')incomes.push({tower,amount:Math.max(0,effect.power)});
    if(effect.kind==='interest')incomes.push({tower,amount:Math.min(
     Math.max(0,effect.cap),bankBase*Math.max(0,effect.power))});
   }
  }
  credit(s,(s.rules.roundRewardBase+s.rules.roundRewardStep*s.wave)*s.rules.incomeMul);
  for(const {tower,amount} of incomes){
   const paid=credit(s,amount*s.rules.incomeMul);
   tower.generated+=paid;
  }
  if(s.rules.maxLives>1&&healing>0)s.lives=Math.min(s.rules.maxLives,s.lives+Math.floor(healing));
  s.phase='build';s.waveTime=0;s.spawnCursor=[];
  if(s.wave===s.rules.rounds){
   emit(s,{kind:'victory',amount:s.wave});
   if(!s.options.endless){s.phase='victory';return;}
  }
  if(s.autoStart)this.startWave();
 }
 private tickOnce():void {
  const s=this.state;
  if(s.phase==='build'){
   if(!s.autoStart)return;
   this.startWave();
  }
  if(s.phase!=='wave')return;
  const dt=WORLD.tick;
  s.tick++;s.time=s.tick*dt;s.waveTime+=dt;
  const wave=this.waveDefinition(s.wave);
  this.spawn(wave);
  this.combat.step(s,this.combatConfig,dt);
  s.lives=Math.min(s.rules.maxLives,s.lives);
  if(s.lives<=0){this.defeat();return;}
  this.moveAndLeak(dt);
  if(s.lives<=0)return;
  if(s.spawnCursor.every((n,i)=>n===wave.groups[i].count)&&s.enemies.length===0)
   this.completeWave();
 }
 step(realSeconds:number):void {
  if(!nonnegative(realSeconds))throw new RangeError('Invalid frame delta');
  if(this.state.paused||this.terminal())return;
  if(this.state.phase==='build'&&!this.state.autoStart)return;
  this.frameRemainder+=Math.min(realSeconds,FRAME_LIMIT)*this.state.speed/WORLD.tick;
  let steps=Math.floor(this.frameRemainder+EPSILON);
  this.frameRemainder=Math.max(0,this.frameRemainder-steps);
  while(steps-->0){
   if(this.terminal()||
    (this.state.phase==='build'&&!this.state.autoStart))break;
   this.tickOnce();
   this.compactEvents();
  }
 }
}
export function createGame(config:GameConfig,options:RunOptions,combat:CombatModule):GameEngine {
 return new Simulation(config,options,combat);
}
export function restoreGame(config:GameConfig,snapshot:GameState,combat:CombatModule):GameEngine {
 return new Simulation(config,snapshot.options,combat,snapshot);
}
