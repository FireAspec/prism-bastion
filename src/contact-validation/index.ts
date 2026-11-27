import type { AttackDef, EnemyState, GameConfig, GameEvent, GameState, Vec } from '../contracts/index';

export const EPS = 1e-7;
const minus = (a: Vec, b: Vec): Vec => ({ x: a.x-b.x, y: a.y-b.y });
const dot = (a: Vec, b: Vec): number => a.x*b.x+a.y*b.y;
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x-b.x,a.y-b.y);
export const lerp = (a: Vec,b: Vec,t: number): Vec => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export interface Contact { t: number; point: Vec; targetPoint: Vec }
/** Independent projection/chord oracle; optional moving circle, relative linear motion. */
export function sweptContact(a: Vec,b: Vec,c: Vec,r: number,d: Vec=c): Contact|null {
  if (![a.x,a.y,b.x,b.y,c.x,c.y,d.x,d.y,r].every(Number.isFinite)||r<0) throw new RangeError('Invalid sweep');
  const p=minus(a,c), v=minus(minus(b,a),minus(d,c)), len=Math.hypot(v.x,v.y);
  const at=(t:number):Contact=>({t,point:lerp(a,b,t),targetPoint:lerp(c,d,t)});
  if (Math.hypot(p.x,p.y)<=r+EPS) return at(0);
  if (len<=EPS) return null;
  const axis={x:v.x/len,y:v.y/len}, along=-dot(p,axis), perpendicular=Math.abs(p.x*axis.y-p.y*axis.x);
  if(perpendicular>r+EPS) return null;
  const entry=along-Math.sqrt(Math.max(0,(r-perpendicular)*(r+perpendicular)));
  if(entry < -EPS || entry > len+EPS) return null;
  return at(Math.max(0,Math.min(1,entry/len)));
}
/** Point-centre sector: arc is full angular width, in degrees. */
export function inSector(origin:Vec,direction:Vec,target:Vec,range:number,arc:number):boolean {
  const offset=minus(target,origin), len=Math.hypot(offset.x,offset.y), dir=Math.hypot(direction.x,direction.y);
  if(![origin.x,origin.y,direction.x,direction.y,target.x,target.y,range,arc].every(Number.isFinite)||range<0||arc<0||arc>360||dir<=EPS) throw new RangeError('Invalid sector');
  if(len>range+EPS)return false;
  if(len<=EPS||arc===360)return true;
  const angle=Math.atan2(Math.abs(direction.x*offset.y-direction.y*offset.x),dot(direction,offset))*180/Math.PI;
  return angle<=arc/2+EPS;
}
export interface TraceFrame { tick:number; state:GameState; events:GameEvent[]; external?:boolean }
export interface Trace { version:1; name:string; origin:'combat'|'engine'|'fixture'; frames:TraceFrame[]; radii:Record<string,number>; findings:string[] }
export function frame(state:GameState,events:GameEvent[]=state.events):TraceFrame {
  return {tick:state.tick,state:structuredClone({...state,events:[]}),events:structuredClone(events)};
}
export const changed = (before:EnemyState, after:EnemyState|undefined):boolean => !after||after.hp<before.hp-EPS||after.shield<before.shield-EPS;
export const contactKinds = new Set<GameEvent['kind']>(['hit','projectileImpact','strikeContact']);
export function eventPointError(event:GameEvent, expected:Vec, tolerance:number):string|null {
  if(!event.pos||!Number.isFinite(event.pos.x)||!Number.isFinite(event.pos.y))return `${event.kind} ${event.id}: missing world point`;
  return distance(event.pos,expected)>tolerance+EPS?`${event.kind} ${event.id}: world point error ${distance(event.pos,expected).toFixed(3)} > ${tolerance}`:null;
}
/** Verify actual observations, not a re-simulated damage calculation. Fixtures must not regenerate HP or use DoT. */
export function auditTrace(trace:Trace, config:GameConfig):string[] {
  const errors:string[]=[], ids=new Set<number>(), paid=new Set<string>();
  for(let i=0;i<trace.frames.length;i++) {
    const f=trace.frames[i], prev=trace.frames[i-1];
    if(f.tick!==f.state.tick||prev&&f.tick<prev.tick)errors.push(`tick ${f.tick}: inconsistent order`);
    for(const event of f.events) {
      if(ids.has(event.id))errors.push(`duplicate event ${event.id}`); ids.add(event.id);
      if(event.time>f.state.time+EPS)errors.push(`future event ${event.id}`);
      if(contactKinds.has(event.kind)&&(!event.pos||![event.pos.x,event.pos.y].every(Number.isFinite)))errors.push(`contact ${event.id}: no world point`);
      if(event.kind==='layerBreak') {
        if(event.target===undefined||event.layer===undefined)errors.push(`layer event ${event.id}: missing identity`);
        else {const key=JSON.stringify([event.target,event.layer]);if(paid.has(key))errors.push(`duplicate layer ${key}`);paid.add(key);}
      }
    }
    if(!prev||f.external)continue;
    for(const enemy of prev.state.enemies) {
      const next=f.state.enemies.find(e=>e.id===enemy.id);
      if(next&&enemy.paidLayers.some(l=>!next.paidLayers.includes(l)))errors.push(`tick ${f.tick}: lost paid layer ${enemy.id}`);
      if(next&&new Set(next.paidLayers).size!==next.paidLayers.length)errors.push(`tick ${f.tick}: duplicate paidLayers ${enemy.id}`);
      if(!changed(enemy,next))continue;
      const hits=f.events.filter(e=>contactKinds.has(e.kind)&&e.target===enemy.id);
      if(!hits.length&&!f.events.some(e=>e.kind==='leak'&&e.target===enemy.id))errors.push(`tick ${f.tick}: damage/removal without contact ${enemy.id}`);
      for(const hit of hits.filter(e=>e.kind==='strikeContact')) {
        const strikes=prev.state.strikes.filter(s=>s.source===hit.source&&!s.hitTargets.includes(enemy.id));
        if(strikes.length&&!strikes.some(s=>s.remainingWindup<=1/60+EPS&&inSector(s.pos,s.direction,enemy.pos,s.attack.range,s.attack.arc)))errors.push(`tick ${f.tick}: strike outside active sector ${enemy.id}`);
        if(eventPointError(hit,enemy.pos,config.enemies.find(d=>d.id===enemy.defId)?.radius??0))errors.push(`tick ${f.tick}: strike point outside target ${enemy.id}`);
      }
      // Check previous in-flight straight projectiles, against the pre-combat position (contract tick order).
      const radius=config.enemies.find(d=>d.id===enemy.defId)?.radius;
      if(radius===undefined)continue;
      for(const hit of hits.filter(e=>e.kind==='projectileImpact'||e.kind==='hit')) {
        const candidates=prev.state.projectiles.filter(p=>p.source===hit.source&&!p.hitTargets.includes(enemy.id)&&!p.attack.homing&&p.attack.mode!=='mortar'&&p.attack.splash===0);
        if(!candidates.length)continue;
        const possible=candidates.flatMap(p=>{const end={x:p.pos.x+p.velocity.x/60,y:p.pos.y+p.velocity.y/60};const contact=sweptContact(p.pos,end,enemy.pos,radius+p.attack.projectileRadius);return contact?[{contact,tolerance:radius+p.attack.projectileRadius}]:[];});
        if(!possible.length)errors.push(`tick ${f.tick}: impact outside swept path ${enemy.id}`);
        else if(possible.every(p=>eventPointError(hit,p.contact.point,p.tolerance)!==null))errors.push(`tick ${f.tick}: impact world point outside radius ${enemy.id}`);
      }
    }
  }
  return errors;
}
export function attack(overrides:Partial<AttackDef>={}):AttackDef {
  return {mode:'shot',element:'kinetic',damage:25,interval:10,range:180,pierce:1,count:1,splash:0,chains:0,chainRadius:60,detects:true,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,statuses:[],projectileSpeed:600,projectileRadius:2,homing:false,windup:0.15,arc:60,...overrides};
}
