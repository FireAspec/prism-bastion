import type {AbilityDef,AttackDef,DamagePacket,EffectDef,EnemyState,GameConfig,GameState,ProjectileState,ResolvedTower,StatusSpec,TowerState,Vec} from '../contracts';
import {distance,distanceToSegment} from '../contracts/geometry';
import {credit,emit} from '../contracts/runtime';
import {damageEnemy} from './damage';
import {resolveTower} from './resolve';

const EPS=1e-8;
const minMax=(x:number,min:number,max:number)=>Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;
const add=(a:Vec,b:Vec):Vec=>({x:a.x+b.x,y:a.y+b.y});
const sub=(a:Vec,b:Vec):Vec=>({x:a.x-b.x,y:a.y-b.y});
const scale=(a:Vec,n:number):Vec=>({x:a.x*n,y:a.y*n});
const normalize=(v:Vec):Vec=>{const l=Math.hypot(v.x,v.y);return l<EPS?{x:1,y:0}:scale(v,1/l);};
const rotate=(v:Vec,r:number):Vec=>({x:v.x*Math.cos(r)-v.y*Math.sin(r),y:v.x*Math.sin(r)+v.y*Math.cos(r)});
const living=(e:EnemyState)=>e.hp>0&&!e.memory['combat:dead'];
const uid=(s:GameState,prefix:string)=>`${prefix}${s.nextEntity++}`;
const defOf=(c:GameConfig,t:TowerState)=>c.towers.find(def=>def.id===t.defId);

interface Support {damage:number;attackSpeed:number;range:number;armorPierce:number;detect:boolean;discount:number;}
const noSupport=():Support=>({damage:0,attackSpeed:0,range:0,armorPierce:0,detect:false,discount:0});

/** Non-additive support values. Consumers may use discount for engine purchase pricing. */
export function supportAt(s:GameState,c:GameConfig,target:TowerState,resolvedCache?:Map<string,ResolvedTower>):Support {
  const result=noSupport();
  for(const tower of s.towers){
    if(tower.id===target.id)continue;
    const def=defOf(c,tower);if(!def)continue;
    for(const e of (resolvedCache?.get(tower.id)??resolveTower(def,tower.tiers)).effects){
      if(e.kind!=='aura'||!e.stat||distance(tower.pos,target.pos)>e.radius*(1+knowledgeBonus(s,c,tower,'supportRadius')))continue;
      if(e.stat==='detect'){result.detect||=e.power>0;continue;}
      result[e.stat]=Math.max(result[e.stat],Math.max(0,e.power));
    }
  }
  result.damage=Math.min(.4,result.damage);
  result.attackSpeed=Math.min(.5,result.attackSpeed);
  result.discount=Math.min(.15,result.discount);
  return result;
}

function knowledgeBonus(s:GameState,c:GameConfig,t:TowerState,stat:string):number {
  if(!s.rules.allowKnowledge)return 0;
  return c.knowledge.filter(n=>s.options.knowledge.includes(n.id)).flatMap(n=>n.effects)
    .filter(e=>e.stat===stat&&(!e.towers||e.towers.includes(t.defId)))
    .reduce((total,e)=>total+e.value,0);
}

function effectiveAttack(s:GameState,c:GameConfig,t:TowerState,resolved:ResolvedTower,cache:Map<string,ResolvedTower>):AttackDef {
  const attack=structuredClone(resolved.attack);
  const support=supportAt(s,c,t,cache);
  const def=defOf(c,t);
  const elemental=attack.element!=='kinetic';
  const water=def?.placement==='water';
  attack.damage*=1+support.damage+knowledgeBonus(s,c,t,'weaponDamage')+(elemental?knowledgeBonus(s,c,t,'elementDamage'):0)+(water?knowledgeBonus(s,c,t,'waterDamage'):0);
  if((t.memory['combat:overclockUntil']??0)>s.time)attack.interval/=1+(t.memory['combat:overclockPower']??0);
  attack.interval=Math.max(.05,attack.interval/(1+support.attackSpeed+knowledgeBonus(s,c,t,'weaponSpeed')));
  attack.range*=1+support.range+knowledgeBonus(s,c,t,'weaponRange')+(water?knowledgeBonus(s,c,t,'waterRange'):0);
  attack.armorPierce+=support.armorPierce;
  attack.detects||=support.detect;
  attack.bossMultiplier*=1+knowledgeBonus(s,c,t,'bossDamage');
  attack.shieldMultiplier*=1+knowledgeBonus(s,c,t,'shieldDamage');
  attack.statuses=attack.statuses.map(status=>({...status,duration:status.duration*(1+knowledgeBonus(s,c,t,'statusDuration'))}));
  return attack;
}

function canSee(s:GameState,c:GameConfig,e:EnemyState,a:AttackDef):boolean {
  if(!living(e))return false;
  const def=c.enemies.find(d=>d.id===e.defId);
  if(!def)return false;
  return !def.cloaked||a.detects||e.statuses.some(status=>status.kind==='reveal');
}

function candidates(s:GameState,c:GameConfig,pos:Vec,a:AttackDef):EnemyState[]{
  return s.enemies.filter(e=>canSee(s,c,e,a)&&distance(pos,e.pos)<=a.range+EPS && !(a.mode==='mine'&&c.enemies.find(d=>d.id===e.defId)?.flying));
}

function orderTarget(enemies:EnemyState[],t:TowerState):EnemyState[]{
  return enemies.sort((a,b)=>{
    let d=0;
    switch(t.targeting){
      case 'first':d=b.progress-a.progress;break;
      case 'last':d=a.progress-b.progress;break;
      case 'strong':d=b.hp-a.hp;break;
      case 'near':d=distance(a.pos,t.pos)-distance(b.pos,t.pos);break;
    }
    return d||a.id.localeCompare(b.id,undefined,{numeric:true});
  });
}

function packet(s:GameState,c:GameConfig,e:EnemyState,a:AttackDef,source:string):DamagePacket {
  const def=c.enemies.find(d=>d.id===e.defId);
  let damage=a.damage;
  if(a.executeBelow>0 && e.hp/e.maxHp<=a.executeBelow){
    if(def?.boss)damage*=1+Math.min(.5,a.executeBelow);
    else if(def){
      const resistance=minMax(def.resist[a.element]??0,0,.8);
      const shieldCost=e.shield/Math.max(.01,a.shieldMultiplier);
      const remainingArmor=Math.max(0,def.armor-a.armorPierce);
      damage=Math.max(damage,(e.hp+shieldCost+remainingArmor+1)/Math.max(.2,1-resistance));
    }
  }
  return {source,damage,element:a.element,armorPierce:a.armorPierce,
    shieldMultiplier:a.shieldMultiplier,bossMultiplier:a.bossMultiplier,statuses:a.statuses};
}

function strikeEnemy(s:GameState,c:GameConfig,e:EnemyState,a:AttackDef,source:string):void {
  if(canSee(s,c,e,a))damageEnemy(s,c,e.id,packet(s,c,e,a,source));
  if(a.push>0 && living(e))rewindEnemy(s,c,e,a.push,source);
}

function rewindEnemy(s:GameState,c:GameConfig,e:EnemyState,amount:number,source:string):void {
  const def=c.enemies.find(d=>d.id===e.defId);
  if(!def||!living(e))return;
  const cooldown=e.memory['combat:rewindUntil']??0;
  if(s.time<cooldown)return;
  const factor=def.boss?minMax(def.boss.controlFactor,.15,1):1;
  const shift=Math.min(e.progress,amount*factor,def.boss?90:Math.max(0,amount));
  if(shift<=0)return;
  e.progress-=shift;
  const lane=c.maps.find(m=>m.id===s.options.mapId)?.lanes[e.lane];
  if(lane){
    // Recalculate from progress: route loops must not change the travel index.
    let remaining=e.progress;
    for(let i=1;i<lane.length;i++){
      const d=distance(lane[i-1],lane[i]);
      if(remaining<=d){e.pos=add(lane[i-1],scale(sub(lane[i],lane[i-1]),d>0?remaining/d:0));break;}
      remaining-=d;
    }
  }
  e.memory['combat:rewindUntil']=s.time+(def.boss?2:Math.max(.5,Math.min(2,amount/100)));
  emit(s,{kind:'hit',source,target:e.id,pos:{...e.pos},amount:0});
}

function area(s:GameState,c:GameConfig,center:Vec,radius:number,a:AttackDef,source:string,cap=Infinity):void {
  let hits=0;
  for(const e of [...s.enemies].sort((x,y)=>distance(center,x.pos)-distance(center,y.pos)||x.id.localeCompare(y.id))){
    if(hits>=cap)break;
    if(canSee(s,c,e,a)&&!(a.mode==='mine'&&c.enemies.find(d=>d.id===e.defId)?.flying)&&distance(center,e.pos)<=radius+EPS){strikeEnemy(s,c,e,a,source);hits++;}
  }
}

function chain(s:GameState,c:GameConfig,first:EnemyState,a:AttackDef,source:string):void {
  const visited=new Set<string>();
  let current:EnemyState|undefined=first;
  for(let jump=0;current && jump<=Math.max(0,Math.ceil(a.chains));jump++){
    visited.add(current.id);const previousPos:Vec={...current.pos};
    strikeEnemy(s,c,current,a,source);
    const next:EnemyState[]=s.enemies.filter(e=>!visited.has(e.id)&&canSee(s,c,e,a)&&distance(e.pos,previousPos)<=a.chainRadius)
      .sort((x,y)=>distance(x.pos,previousPos)-distance(y.pos,previousPos)||x.id.localeCompare(y.id));
    current=next[0];
  }
}

function lineHit(s:GameState,c:GameConfig,origin:Vec,dir:Vec,a:AttackDef,source:string,width=12):void {
  const end=add(origin,scale(normalize(dir),a.range));
  const matches=s.enemies.filter(e=>canSee(s,c,e,a)&&distanceToSegment(e.pos,origin,end)<=width+(c.enemies.find(d=>d.id===e.defId)?.radius??0))
    .filter(e=>{const v=sub(e.pos,origin);return v.x*dir.x+v.y*dir.y>=0 && distance(e.pos,origin)<=a.range+width;})
    .sort((x,y)=>distance(origin,x.pos)-distance(origin,y.pos)||x.id.localeCompare(y.id));
  for(const e of matches.slice(0,Math.max(1,Math.ceil(a.pierce))))strikeEnemy(s,c,e,a,source);
}

function contact(s:GameState,c:GameConfig,pos:Vec,dir:Vec,a:AttackDef,source:string):void {
  emit(s,{kind:'strikeContact',source,pos:{...pos},to:add(pos,scale(normalize(dir),a.range)),element:a.element});
  switch(a.mode){
    case 'ring':case 'pulse':case 'mine':case 'melee':
      area(s,c,pos,a.mode==='melee'?Math.min(a.range,Math.max(20,a.splash)):a.splash>0?Math.min(a.range,a.splash):a.range,a,source);break;
    case 'tide':
      area(s,c,pos,a.range,a,source);break;
    case 'cone':{
      const pellets=Math.max(1,Math.ceil(a.count));
      for(let i=0;i<pellets;i++)lineHit(s,c,pos,rotate(dir,(i-(pellets-1)/2)*(.7/Math.max(1,pellets-1))),a,source,12);
      break;
    }
    case 'beam':lineHit(s,c,pos,dir,a,source,8);break;
    case 'chain':{
      const first=s.enemies.filter(e=>canSee(s,c,e,a)&&distance(e.pos,pos)<=a.range)
        .sort((x,y)=>distance(x.pos,pos)-distance(y.pos,pos)||x.id.localeCompare(y.id))[0];
      if(first)chain(s,c,first,a,source);break;
    }
    case 'splash':case 'mortar':area(s,c,pos,Math.max(1,a.splash),a,source);break;
    default:area(s,c,pos,Math.max(1,a.projectileRadius),a,source,Math.max(1,a.pierce));
  }
}

function addStrike(s:GameState,source:string,pos:Vec,dir:Vec,a:AttackDef,visual:string,windup=a.windup):void {
  emit(s,{kind:'strikeStart',source,pos:{...pos},to:add(pos,scale(dir,a.range)),visual});
  if(windup<=EPS){return;} // Immediate contacts are handled by the caller with config.
  s.strikes.push({id:uid(s,'st'),source,pos:{...pos},direction:{...dir},remainingWindup:windup,remainingActive:0,
    attack:structuredClone(a),hitTargets:[],visual});
}

function launch(s:GameState,source:string,pos:Vec,aim:Vec,a:AttackDef,visual:string,target:string|null):void {
  const dir=normalize(sub(aim,pos));
  const speed=Math.max(1,a.projectileSpeed||420);
  const travel=distance(pos,aim)/speed;
  const projectile:ProjectileState={id:uid(s,'p'),source,pos:{...pos},previous:{...pos},velocity:scale(dir,speed),target,
    remainingLife:a.mode==='mortar'||a.mode==='splash'?Math.max(.05,travel):Math.max(.1,a.range/speed+0.25),
    remainingPierce:Math.max(1,Math.ceil(a.pierce)),hitTargets:[],attack:structuredClone(a),visual};
  s.projectiles.push(projectile);
  emit(s,{kind:'projectileSpawn',source,target:target??undefined,pos:{...pos},to:{...aim},element:a.element,visual});
}

function fire(s:GameState,c:GameConfig,t:TowerState,a:AttackDef,e:EnemyState,visual:string):void {
  emit(s,{kind:'shot',source:t.id,target:e.id,pos:{...t.pos},to:{...e.pos},element:a.element,visual});
  const count=Math.min(32,Math.max(1,Math.ceil(a.count)));
  if(a.mode==='cone'||a.mode==='beam'||a.mode==='ring'||a.mode==='pulse'||a.mode==='tide'||a.mode==='melee'||a.mode==='mine'||a.mode==='chain'){
    const choices=orderTarget(candidates(s,c,t.pos,a),t);
    const pulses=a.mode==='cone'?1:count;
    const strikeAttack=a.mode==='cone'?a:{...a,count:1};
    for(let i=0;i<pulses;i++){
      const selected=choices[i%choices.length]??e;
      const dir=normalize(sub(selected.pos,t.pos));
      const center=a.mode==='chain'?selected.pos:t.pos;
      addStrike(s,t.id,center,dir,strikeAttack,visual);
      if(a.windup<=EPS)contact(s,c,center,dir,strikeAttack,t.id);
    }
    return;
  }
  const choices=orderTarget(candidates(s,c,t.pos,a),t);
  for(let i=0;i<count;i++){
    const selected=choices[i%choices.length]??e;
    const angle=(i-(count-1)/2)*(.12/Math.max(1,count-1));
    const origin=a.mode==='drone'?add(t.pos,{x:Math.cos(i*Math.PI*2/count)*20,y:Math.sin(i*Math.PI*2/count)*20}):t.pos;
    const destination=add(origin,scale(rotate(normalize(sub(selected.pos,origin)),angle),distance(origin,selected.pos)));
    launch(s,t.id,origin,destination,a,visual,selected.id);
  }
}

function pulseEffect(s:GameState,c:GameConfig,t:TowerState,e:EffectDef):void {
  const attack:AttackDef={...resolveTower(defOf(c,t)!,t.tiers).attack,mode:'pulse',range:e.radius,splash:e.radius,
    damage:Math.max(0,e.power),element:e.element??'energy',statuses:e.status?[e.status]:[]};
  area(s,c,t.pos,e.radius,attack,t.id);
  emit(s,{kind:'strikeContact',source:t.id,pos:{...t.pos},visual:e.id,element:attack.element});
}

function copyAttack(s:GameState,c:GameConfig,t:TowerState,e:EffectDef):void {
  const nearby=s.towers.filter(other=>other.id!==t.id&&distance(t.pos,other.pos)<=e.radius).map(other=>({tower:other,def:defOf(c,other)}))
    .filter((x):x is {tower:TowerState;def:NonNullable<typeof x.def>}=>!!x.def)
    .filter(x=>x.def.category!=='economy'&&!resolveTower(x.def,x.tower.tiers).effects.some(f=>f.kind==='copy'))
    .filter(x=>resolveTower(x.def,x.tower.tiers).attack.damage>0)
    .sort((x,y)=>distance(t.pos,x.tower.pos)-distance(t.pos,y.tower.pos)||x.tower.id.localeCompare(y.tower.id));
  const donor=nearby[0];if(!donor)return;
  const a=resolveTower(donor.def,donor.tower.tiers).attack;
  a.damage*=minMax(e.power,0,1);
  a.range=Math.min(a.range,e.radius);
  a.statuses=[];
  a.count=Math.min(8,a.count);
  const target=orderTarget(candidates(s,c,t.pos,a),t)[0];
  if(target)fire(s,c,t,a,target,donor.def.visual.projectile);
}

export function stepTowers(s:GameState,c:GameConfig,dt:number):void {
  const cache=new Map(s.towers.flatMap(t=>{
    const def=defOf(c,t);
    return def?[[t.id,resolveTower(def,t.tiers)] as const]:[];
  }));
  for(const t of s.towers){
    const def=defOf(c,t);if(!def)continue;
    const resolved=cache.get(t.id)!;
    const a=effectiveAttack(s,c,t,resolved,cache);
    t.cooldown=Math.max(0,t.cooldown-dt);
    for(const id of Object.keys(t.abilityCooldowns))t.abilityCooldowns[id]=Math.max(0,t.abilityCooldowns[id]-dt);
    const target=orderTarget(candidates(s,c,t.pos,a),t)[0];
    for(const e of resolved.effects){
      const key=`combat:effect:${e.id}`;
      if(e.kind==='charge')t.memory[key]=Math.min(Math.max(0,e.duration), (t.memory[key]??0)+dt);
      if(e.kind==='focus'){
        const id=target?Number(target.id.replace(/\D/g,'')):-1;
        if(t.memory[`${key}:target`]===id && id>=0)t.memory[key]=Math.min(e.cap,(t.memory[key]??0)+dt*e.power);
        else {t.memory[`${key}:target`]=id;t.memory[key]=0;}
      }
      if(e.kind==='barrier'&&s.rules.maxLives>1 && t.memory[`${key}:wave`]!==s.wave){
        t.memory[`${key}:wave`]=s.wave;
        s.lives=Math.min(s.rules.maxLives,s.lives+Math.max(0,e.power));
      }
      if(e.kind==='portal'){
        t.memory[key]=(t.memory[key]??0)+dt;
        if(t.memory[key]+EPS>=Math.max(.05,e.interval)){
          t.memory[key]=0;
          const victims=orderTarget(s.enemies.filter(enemy=>living(enemy)&&distance(enemy.pos,t.pos)<=e.radius),t);
          if(victims[0])rewindEnemy(s,c,victims[0],e.power,t.id);
        }
      }
      if(e.kind==='copy'||e.kind==='trap'){
        t.memory[key]=(t.memory[key]??0)+dt;
        if(t.memory[key]+EPS>=Math.max(.05,e.interval)){
          t.memory[key]%=Math.max(.05,e.interval);
          if(e.kind==='copy')copyAttack(s,c,t,e);
          else if(s.enemies.some(enemy=>living(enemy)&&distance(enemy.pos,t.pos)<=e.radius))pulseEffect(s,c,t,e);
        }
      }
    }
    if(!target||a.damage<=0||a.range<=0||t.cooldown>EPS)continue;
    let bonus=1;
    for(const e of resolved.effects){
      if(e.kind==='charge')bonus+=Math.min(e.cap||e.power,e.power*(t.memory[`combat:effect:${e.id}`]??0)/Math.max(.01,e.duration));
      if(e.kind==='focus')bonus+=Math.min(e.cap,t.memory[`combat:effect:${e.id}`]??0);
    }
    a.damage*=Math.max(0,bonus);
    fire(s,c,t,a,target,resolved.visual.projectile);
    t.cooldown=a.interval;
    for(const e of resolved.effects){
      if(e.kind==='charge')t.memory[`combat:effect:${e.id}`]=0;
      if(e.kind==='echo'){
        const repeated=structuredClone(a);
        repeated.damage*=minMax(e.power,0,1);
        repeated.mode='chain';repeated.chains=Math.max(0,Math.floor(e.cap)-1);
        repeated.chainRadius=e.radius;
        addStrike(s,t.id,target.pos,normalize(sub(target.pos,t.pos)),repeated,`echo:${e.id}`,Math.max(.05,e.interval));
      }
    }
  }
}

export function stepOrdnance(s:GameState,c:GameConfig,dt:number):void {
  for(const st of [...s.strikes]){
    st.remainingWindup-=dt;
    if(st.remainingWindup>EPS)continue;
    contact(s,c,st.pos,st.direction,st.attack,st.source);
    s.strikes=s.strikes.filter(x=>x.id!==st.id);
  }
  for(const p of [...s.projectiles]){
    p.previous={...p.pos};
    const enemy=s.enemies.find(e=>e.id===p.target);
    if(p.attack.homing&&enemy&&living(enemy))p.velocity=scale(normalize(sub(enemy.pos,p.pos)),Math.max(1,p.attack.projectileSpeed||420));
    const travel=Math.min(dt,p.remainingLife);
    p.pos=add(p.pos,scale(p.velocity,travel));
    p.remainingLife-=dt;
    let expired=p.remainingLife<=EPS;
    let hitNow=false;
    if(p.attack.mode!=='mortar'){
      // Segment sweep prevents fast projectiles from tunnelling through small enemies.
      const hit=s.enemies.filter(e=>!p.hitTargets.includes(e.id)&&canSee(s,c,e,p.attack) && distanceToSegment(e.pos,p.previous,p.pos)<=
        (c.enemies.find(d=>d.id===e.defId)?.radius??0)+Math.max(0,p.attack.projectileRadius))
        .sort((x,y)=>distance(x.pos,p.previous)-distance(y.pos,p.previous)||x.id.localeCompare(y.id));
      for(const e of hit){
        if(p.attack.mode==='splash'){
          area(s,c,e.pos,Math.max(1,p.attack.splash),p.attack,p.source);
          hitNow=true;
          expired=true;break;
        }
        p.hitTargets.push(e.id);
        hitNow=true;
        strikeEnemy(s,c,e,p.attack,p.source);
        p.remainingPierce--;
        if(p.remainingPierce<=0){expired=true;break;}
      }
    }else if(expired){
      const previousDamage=s.stats.damage;
      area(s,c,p.pos,Math.max(1,p.attack.splash),p.attack,p.source);
      hitNow=s.stats.damage>previousDamage;
    }
    if(p.attack.mode==='splash'&&expired&&!hitNow){
      const previousDamage=s.stats.damage;
      area(s,c,p.pos,Math.max(1,p.attack.splash),p.attack,p.source);
      hitNow=s.stats.damage>previousDamage;
    }
    if(expired){
      if(!hitNow && p.hitTargets.length===0)emit(s,{kind:'miss',source:p.source,pos:{...p.pos},target:p.target??undefined});
      emit(s,{kind:'projectileImpact',source:p.source,pos:{...p.pos},target:p.target??undefined,visual:p.visual,element:p.attack.element});
      s.projectiles=s.projectiles.filter(x=>x.id!==p.id);
    }
  }
}

function abilityDamage(s:GameState,c:GameConfig,t:TowerState,a:AbilityDef):void {
  const def=defOf(c,t);if(!def)return;
  const base=resolveTower(def,t.tiers).attack;
  const attack:AttackDef={...base,damage:Math.max(0,a.power),element:a.element,
    mode:'pulse',range:a.radius,splash:a.radius,executeBelow:0,push:0,statuses:[]};
  area(s,c,t.pos,a.radius,attack,t.id);
}

export function activate(s:GameState,c:GameConfig,towerId:string,abilityId:string):{ok:boolean;reason?:string;entity?:string}{
  const t=s.towers.find(x=>x.id===towerId);
  const def=t&&defOf(c,t);
  if(!t||!def)return {ok:false,reason:'Unknown tower'};
  const a=resolveTower(def,t.tiers).abilities.find(x=>x.id===abilityId);
  if(!a)return {ok:false,reason:'Unknown ability'};
  if(s.phase!=='wave'||s.paused||!s.rules.allowAbilities)return {ok:false,reason:'Ability unavailable'};
  if(a.kind==='mint' && (!s.rules.allowPassiveIncome||s.options.modeId==='iron-oath'))return {ok:false,reason:'Income disabled'};
  if((t.abilityCooldowns[a.id]??0)>EPS)return {ok:false,reason:'Ability cooling down'};
  switch(a.kind){
    case 'nova':abilityDamage(s,c,t,a);break;
    case 'meteor':{
      const target=s.enemies.filter(living).sort((x,y)=>distance(x.pos,t.pos)-distance(y.pos,t.pos))[0];
      if(!target)return {ok:false,reason:'No target'};
      const attack:AttackDef={...resolveTower(def,t.tiers).attack,mode:'mortar',damage:Math.max(0,a.power),
        element:a.element,splash:a.radius,range:distance(t.pos,target.pos)+1,statuses:[]};
      launch(s,t.id,t.pos,target.pos,attack,'meteor',target.id);break;
    }
    case 'overclock':
      t.memory['combat:overclockUntil']=s.time+Math.max(0,a.duration);
      t.memory['combat:overclockPower']=Math.max(0,a.power);break;
    case 'rewind':
      for(const e of s.enemies.filter(living))if(distance(t.pos,e.pos)<=a.radius)rewindEnemy(s,c,e,a.power,t.id);
      break;
    case 'barrier':
      if(s.rules.maxLives<=1)return {ok:false,reason:'Barrier disabled at one life'};
      s.lives=Math.min(s.rules.maxLives,s.lives+Math.max(0,a.power));break;
    case 'mint':{
      const amount=credit(s,Math.max(0,a.power)*s.rules.incomeMul*s.rules.popCashMul);
      t.generated+=amount;break;
    }
  }
  t.abilityCooldowns[a.id]=Math.max(.05,a.cooldown/(1+knowledgeBonus(s,c,t,'abilityCooldown')));
  s.stats.abilities++;
  emit(s,{kind:'ability',source:t.id,pos:{...t.pos},visual:a.id,element:a.element});
  return {ok:true,entity:t.id};
}
