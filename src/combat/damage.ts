import type {DamagePacket,EnemyDef,EnemyState,GameConfig,GameState,StatusSpec,TowerState} from '../contracts';
import {credit,emit,spawnEnemy} from '../contracts/runtime';
import {distance} from '../contracts/geometry';
import {resolveTower} from './resolve';

const EPS=1e-7;
const MAX_ENEMIES=1800;
const MAX_GENERATION=3;
type Hit={id:string;packet:DamagePacket};
const num=(n:number,low=0,high=Infinity)=>Number.isFinite(n)?Math.max(low,Math.min(high,n)):low;
const alive=(enemy:EnemyState)=>enemy.hp>0 && !enemy.memory['combat:dead'];

function incomeMultiplier(s:GameState):number {
  return num(s.rules.incomeMul)*num(s.rules.popCashMul);
}

function applyStatuses(s:GameState,e:EnemyState,def:EnemyDef,statuses:StatusSpec[],source:string):void {
  for(const status of statuses){
    if(status.duration<=0)continue;
    const hard=status.kind==='stun'||status.kind==='freeze';
    if(hard && (e.memory['combat:hardUntil']??0)>s.time)continue;
    const control=def.boss?num(def.boss.controlFactor,.15,1):1;
    const duration=hard?Math.min(def.boss?.phases?0.5:1,status.duration*control):status.duration*(def.boss?control:1);
    if(duration<=0)continue;
    const found=e.statuses.find(x=>x.kind===status.kind && (status.kind==='burn'||status.kind==='poison'?x.source===source:true));
    if(found){
      found.power=Math.max(found.power,status.power);
      found.remaining=Math.max(found.remaining,duration);
      found.duration=Math.max(found.duration,duration);
      found.stacks=Math.min(Math.max(1,status.maxStacks??1),found.stacks+1);
    }else e.statuses.push({...status,source,remaining:duration,stacks:1});
    if(hard)e.memory['combat:hardUntil']=s.time+duration+(def.boss?2:.35);
  }
}

function queueDeathBursts(s:GameState,c:GameConfig,e:EnemyState,queue:Hit[]):void {
  const triggered=new Set<string>();
  for(const status of e.statuses){
    if(status.kind!=='burn'&&status.kind!=='poison')continue;
    const tower=s.towers.find(t=>t.id===status.source);
    const def=c.towers.find(t=>t.id===tower?.defId);
    if(!tower||!def)continue;
    for(const effect of resolveTower(def,tower.tiers).effects.filter(f=>f.kind==='deathBurst')){
      const key=`${tower.id}:${effect.id}`;
      if(triggered.has(key))continue;
      triggered.add(key);
      for(const other of s.enemies){
        if(other.id!==e.id && alive(other) && distance(e.pos,other.pos)<=effect.radius){
          queue.push({id:other.id,packet:{source:tower.id,damage:effect.power,element:effect.element??'acid',armorPierce:0,shieldMultiplier:1,bossMultiplier:1,statuses:effect.status?[effect.status]:[]}});
        }
      }
    }
  }
}

function harvest(s:GameState,c:GameConfig,e:EnemyState,def:EnemyDef):void {
  if(!s.rules.allowPassiveIncome||s.options.modeId==='iron-oath')return;
  // A kill can be harvested once by the best eligible tower, not every overlapping mint.
  let choice:{tower:TowerState; key:string; amount:number}|undefined;
  for(const tower of s.towers){
    const towerDef=c.towers.find(t=>t.id===tower.defId);
    if(!towerDef)continue;
    for(const effect of resolveTower(towerDef,tower.tiers).effects.filter(f=>f.kind==='harvest')){
      if(distance(tower.pos,e.pos)>effect.radius)continue;
      const key=`combat:harvest:${effect.id}`;
      const waveKey=`${key}:wave`;
      if(tower.memory[waveKey]!==s.wave){tower.memory[waveKey]=s.wave;tower.memory[key]=0;}
      const eligible=Math.min(Math.max(0,def.bounty*effect.power),Math.max(0,effect.cap-(tower.memory[key]??0)));
      if(eligible>(choice?.amount??0))choice={tower,key,amount:eligible};
    }
  }
  if(choice && choice.amount>0){
    choice.tower.memory[choice.key]=(choice.tower.memory[choice.key]??0)+choice.amount;
    const amount=choice.amount*incomeMultiplier(s);
    const paid=credit(s,amount);
    choice.tower.generated+=paid;
  }
}

function checkPhases(s:GameState,e:EnemyState,def:EnemyDef,previousHp:number):void {
  if(!def.boss)return;
  def.boss.phases.forEach((phase,i)=>{
    const key=`combat:phase:${i}`;
    if(e.memory[key] || previousHp<=phase.atHealth*e.maxHp+EPS || e.hp>phase.atHealth*e.maxHp+EPS)return;
    e.memory[key]=1;
    e.shield=Math.max(e.shield,num(phase.shield)*(e.maxHp/def.hp));
    e.maxShield=Math.max(e.maxShield,e.shield);
    e.memory['combat:phaseSpeed']=num(phase.speedMul,.1,10);
    if(phase.spawn && phase.count>0 && e.generation<MAX_GENERATION){e.memory[`combat:phasePending:${i}`]=Math.min(1800,Math.ceil(phase.count));e.memory[`combat:phaseNext:${i}`]=s.time;}
    emit(s,{kind:'bossPhase',target:e.id,pos:{...e.pos},amount:i+1});
  });
}

function oneHit(s:GameState,c:GameConfig,id:string,p:DamagePacket,queue:Hit[]):void {
  const e=s.enemies.find(enemy=>enemy.id===id);
  if(!e||!alive(e)||!Number.isFinite(p.damage)||p.damage<=0)return;
  const def=c.enemies.find(enemy=>enemy.id===e.defId);
  if(!def)return;
  const resist=num(def.resist[p.element]??0,0,.8);
  const marked=e.statuses.some(x=>x.kind==='mark');
  const wet=e.statuses.some(x=>x.kind==='wet');
  const cold=e.statuses.some(x=>x.kind==='slow'||x.kind==='freeze');
  let raw=p.damage*(def.boss?num(p.bossMultiplier):1)*(1-resist);
  if(marked)raw*=1.1;
  if(wet&&p.element==='electric')raw*=1.2;
  if(cold&&p.element==='kinetic')raw*=1.1;
  if(raw<=0)return;
  const shieldMultiplier=Math.max(.01,num(p.shieldMultiplier,.01));
  const shieldRemoved=Math.min(e.shield,raw*shieldMultiplier);
  e.shield=Math.max(0,e.shield-shieldRemoved);
  if(shieldRemoved>0 && e.shield<=EPS)emit(s,{kind:'shieldBreak',target:e.id,source:p.source,pos:{...e.pos}});
  const remaining=Math.max(0,raw-shieldRemoved/shieldMultiplier);
  const shredded=e.statuses.filter(x=>x.kind==='shred').reduce((best,x)=>Math.max(best,x.power),0);
  const armor=Math.max(0,def.armor-shredded-num(p.armorPierce));
  const hpDamage=remaining>EPS?Math.min(e.hp,Math.max(1,remaining-armor)):0;
  const oldHp=e.hp;
  e.hp=Math.max(0,e.hp-hpDamage);
  if(hpDamage>0){
    s.stats.damage+=hpDamage;
    const attacker=s.towers.find(t=>t.id===p.source);
    if(attacker)attacker.damageDealt+=hpDamage;
    emit(s,{kind:'hit',source:p.source,target:e.id,pos:{...e.pos},amount:hpDamage,element:p.element});
    let spent=0;
    for(let i=0;i<def.layers.length;i++){
      spent+=def.layers[i].hp;
      const threshold=e.maxHp*(1-spent/def.hp);
      if(oldHp>threshold+EPS && e.hp<=threshold+EPS && !e.paidLayers.includes(i)){
        e.paidLayers.push(i);
        const amount=credit(s,num(def.layers[i].cash)*incomeMultiplier(s));
        emit(s,{kind:'layerBreak',source:p.source,target:e.id,pos:{...e.pos},layer:i,amount,element:p.element});
      }
    }
    checkPhases(s,e,def,oldHp);
  }
  // A lethal poison/burn application can seed the on-death burst once, too.
  applyStatuses(s,e,def,p.statuses,p.source);
  if(e.hp>0)return;
  e.hp=0;e.memory['combat:dead']=1;e.bountyPaid=true;
  s.stats.kills++;
  const attacker=s.towers.find(t=>t.id===p.source);
  if(attacker)attacker.kills++;
  emit(s,{kind:'kill',source:p.source,target:e.id,pos:{...e.pos}});
  harvest(s,c,e,def);
  queueDeathBursts(s,c,e,queue);
  if(e.generation<MAX_GENERATION)def.children.forEach((child,i)=>{
    if(child.count>0)e.memory[`combat:child:${i}`]=Math.min(1800,Math.ceil(child.count));
  });
}

/** The sole HP/shield/layer accounting entry point, including DoT and ability damage. */
export function damageEnemy(s:GameState,c:GameConfig,id:string,packet:DamagePacket):void {
  const queue:Hit[]=[{id,packet}];
  // Death explosions are queued, never recursive. A dying enemy can queue a burst once only.
  for(let i=0;i<queue.length && i<MAX_ENEMIES*16;i++)oneHit(s,c,queue[i].id,queue[i].packet,queue);
  flushChildren(s,c);
}

/** Flush deferred children/phase summons. Dead parents persist until their quota is served. */
export function flushChildren(s:GameState,c:GameConfig):void {
  let liveCount=s.enemies.filter(alive).length;
  for(const e of [...s.enemies]){
    const def=c.enemies.find(x=>x.id===e.defId);
    if(!def)continue;
    for(let i=0;i<def.children.length;i++){
      const key=`combat:child:${i}`;
      while((e.memory[key]??0)>0 && liveCount<MAX_ENEMIES){
        const child=def.children[i];
        if(!c.enemies.some(x=>x.id===child.id) || e.generation>=MAX_GENERATION){e.memory[key]=0;break;}
        e.memory[key]--;
        spawnEnemy(s,c,child.id,e.lane,e.progress,s.rules.enemyHpMul,1,e.generation+1);
        liveCount++;
      }
    }
    for(let i=0;i<(def.boss?.phases.length??0);i++){
      const phase=def.boss!.phases[i],key=`combat:phasePending:${i}`;
      while((e.memory[key]??0)>0 && liveCount<MAX_ENEMIES && s.time+EPS>=(e.memory[`combat:phaseNext:${i}`]??0)){
        if(e.generation>=MAX_GENERATION||!phase.spawn||!c.enemies.some(x=>x.id===phase.spawn)){e.memory[key]=0;break;}
        e.memory[key]--;
        spawnEnemy(s,c,phase.spawn,e.lane,e.progress,s.rules.enemyHpMul,1,Math.min(3,e.generation+1));
        liveCount++;
        e.memory[`combat:phaseNext:${i}`]=s.time+Math.max(0,phase.interval);
      }
    }
  }
  s.enemies=s.enemies.filter(e=>e.hp>0||Object.entries(e.memory).some(([k,v])=>(k.startsWith('combat:child:')||k.startsWith('combat:phasePending:'))&&v>0));
}

export function applyStatusTick(s:GameState,c:GameConfig,dt:number):void {
  for(const e of [...s.enemies]){
    if(!alive(e))continue;
    const def=c.enemies.find(d=>d.id===e.defId);
    if(!def)continue;
    // Fixed 0.25 second DoT cadence; elapsed time and fractional remainder survive snapshots.
    for(const status of [...e.statuses]){
      const elapsed=Math.min(dt,status.remaining);
      if(elapsed>0 && (status.kind==='burn'||status.kind==='poison')){
        const key=`combat:dot:${status.kind}:${status.source}`;
        e.memory[key]=(e.memory[key]??0)+elapsed;
        let ticks=Math.floor((e.memory[key]+EPS)/.25);
        e.memory[key]-=ticks*.25;
        ticks=Math.min(ticks,240);
        while(ticks-->0&&alive(e))damageEnemy(s,c,e.id,{
          source:status.source,damage:status.power*status.stacks*.25,element:status.kind==='burn'?'fire':'acid',
          armorPierce:0,shieldMultiplier:1,bossMultiplier:1,statuses:[]});
      }
      status.remaining=Math.max(0,status.remaining-dt);
      if(status.remaining<=EPS && (status.kind==='burn'||status.kind==='poison')){
        delete e.memory[`combat:dot:${status.kind}:${status.source}`];
      }
    }
    e.statuses=e.statuses.filter(status=>status.remaining>EPS);
    if(def.regen>0&&alive(e))e.hp=Math.min(e.maxHp,e.hp+def.regen*dt);
  }
  flushChildren(s,c);
}
