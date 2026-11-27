import type { GameEvent, GameState, TowerState, Vec, Tiers } from '../../contracts';
import type { EntityMotion, MotionSample } from '../../contracts/motion';

export const towerIds = ['needle','cannon','rail','scatter','saw','ember','frost','tesla','venom','prism','mortar','rocket','drone','mine','resonator','chrono','gravity','mirror','portal','storm','beacon','forge','observatory','mint','bank','orchard','harbor','tide','coral','bastion'] as const;
type Mechanism = 'barrel'|'ring'|'lens'|'tree'|'water'|'production'|'strike'|'launch';
interface Style { mechanism:Mechanism; idle:number; period:number; recoil:number; glow:number; }
const styles:Record<typeof towerIds[number],Style> = {
 needle:{mechanism:'barrel',idle:.008,period:.8,recoil:2,glow:.22}, cannon:{mechanism:'barrel',idle:.005,period:2,recoil:5,glow:.42}, rail:{mechanism:'barrel',idle:.005,period:2.5,recoil:4,glow:.48}, scatter:{mechanism:'barrel',idle:.009,period:1.1,recoil:3,glow:.3},
 saw:{mechanism:'ring',idle:.024,period:1.2,recoil:1,glow:.3}, ember:{mechanism:'production',idle:.027,period:1.4,recoil:1,glow:.43}, frost:{mechanism:'lens',idle:.016,period:2.7,recoil:0,glow:.35}, tesla:{mechanism:'ring',idle:.02,period:1.6,recoil:0,glow:.45}, venom:{mechanism:'production',idle:.021,period:2.2,recoil:1,glow:.32}, prism:{mechanism:'lens',idle:.012,period:2.4,recoil:0,glow:.48},
 mortar:{mechanism:'barrel',idle:.005,period:2.2,recoil:5,glow:.44}, rocket:{mechanism:'launch',idle:.012,period:1.6,recoil:3,glow:.4}, drone:{mechanism:'launch',idle:.019,period:1.1,recoil:1,glow:.28}, mine:{mechanism:'production',idle:.01,period:2.8,recoil:0,glow:.28}, resonator:{mechanism:'ring',idle:.03,period:1.8,recoil:0,glow:.38}, chrono:{mechanism:'ring',idle:.015,period:3.1,recoil:0,glow:.29}, gravity:{mechanism:'lens',idle:.022,period:2.8,recoil:0,glow:.42}, mirror:{mechanism:'lens',idle:.014,period:2.1,recoil:0,glow:.35}, portal:{mechanism:'ring',idle:.022,period:2.6,recoil:0,glow:.4}, storm:{mechanism:'ring',idle:.025,period:1.7,recoil:0,glow:.44},
 beacon:{mechanism:'lens',idle:.014,period:2.9,recoil:0,glow:.34}, forge:{mechanism:'production',idle:.026,period:1.2,recoil:0,glow:.37}, observatory:{mechanism:'lens',idle:.009,period:3.4,recoil:0,glow:.26}, mint:{mechanism:'production',idle:.018,period:1.3,recoil:0,glow:.25}, bank:{mechanism:'production',idle:.008,period:3.2,recoil:0,glow:.21}, orchard:{mechanism:'tree',idle:.018,period:3.5,recoil:0,glow:.24}, harbor:{mechanism:'water',idle:.014,period:2.4,recoil:2,glow:.28}, tide:{mechanism:'water',idle:.026,period:1.8,recoil:1,glow:.34}, coral:{mechanism:'tree',idle:.02,period:2.7,recoil:1,glow:.31}, bastion:{mechanism:'strike',idle:.008,period:2,recoil:2,glow:.3}
};
const fallback:Style={mechanism:'production',idle:0,period:2,recoil:0,glow:.2};
const style=(id:string):Style=>styles[id as keyof typeof styles]??fallback;
const clamp=(x:number,min=0,max=1)=>Math.max(min,Math.min(max,x));
const ease=(x:number)=>1-(1-clamp(x))**3;
const neutral=():MotionSample=>({offset:{x:0,y:0},scale:1,rotation:0,glow:0,opacity:1});
const copy=(p:Vec):Vec=>({x:p.x,y:p.y});
const finite=(n:number)=>Number.isFinite(n);
const angle=(v:Vec)=>Math.atan2(v.y,v.x);
const direction=(a:Vec,b:Vec):Vec=>({x:b.x-a.x,y:b.y-a.y});
const validDirection=(v:Vec)=>finite(v.x)&&finite(v.y)&&Math.hypot(v.x,v.y)>1e-8;
const primary=(t:Tiers)=>t.reduce((best,n,i)=>n>t[best]?i:best,0);
const topTier=(t:Tiers)=>Math.max(...t);
export function towerAsset(defId:string,tiers:Tiers):string {
 const p=primary(tiers); return `/art/towers/${defId}/${tiers[p]?'abc'[p]+tiers[p]:'base'}.svg`;
}
export function towerOverlay(defId:string,tiers:Tiers):string|undefined {
 const p=primary(tiers), q=tiers.findIndex((n,i)=>i!==p&&n>0);
 return q<0?undefined:`/art/towers/${defId}/${'abc'[q]}${tiers[q]}-overlay.svg`;
}
// Only permit this tower's canonical local assets. Never fetch or execute event-provided URLs.
function eventAsset(value:string|undefined,id:string):string|undefined {
 if(!value)return undefined;
 const m=value.match(/^(?:(?:\/?(?:public\/)?art\/towers\/)([a-z-]+)\/)?(base|[abc][1-5])(?:\.svg)?$/);
 return m&&(!m[1]||m[1]===id)?`/art/towers/${id}/${m[2]}.svg`:undefined;
}
interface Transition {kind:'place'|'upgrade'|'sell'; start:number; duration:number; from?:string; t5:boolean; initialScale:number; initialOpacity:number;}
interface Pulse {time:number; direction:Vec; kind:'shot'|'contact'|'ability';}
interface Entry {id:string;defId:string;pos:Vec;tiers:Tiers;asset:string;aim:number;transition?:Transition;pulse?:Pulse;strike?:{direction:Vec;windup:number;total:number};phase:number;}
export interface RetiredTower {id:string;defId:string;pos:Vec;tiers:Tiers;asset:string;}
export interface TowerMotion extends EntityMotion {retired():RetiredTower[]; trackedCount():number;}
const hash=(s:string)=>{let h=0;for(const c of s)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return h/4294967296*Math.PI*2;};
export function createTowerMotion():TowerMotion {
 const entries=new Map<string,Entry>();
 let reduced=false,disposed=false,clock=0,sim=0,run:string|undefined,lastTick=-1,lastEvent=-1;
 function reset(state:GameState){entries.clear();clock=0;sim=state.time;run=state.options.runId;lastTick=state.tick;lastEvent=-1;}
 function context(state:GameState){if(run!==state.options.runId||state.tick<lastTick)reset(state);lastTick=state.tick;sim=state.time;}
 function add(t:TowerState):Entry {const e:Entry={id:t.id,defId:t.defId,pos:copy(t.pos),tiers:[...t.tiers],asset:towerAsset(t.defId,t.tiers),aim:0,phase:hash(t.id)};entries.set(t.id,e);return e;}
 function sync(state:GameState){
  const live=new Set<string>();for(const t of state.towers){live.add(t.id);const e=entries.get(t.id)??add(t);if(e.transition?.kind==='sell')e.transition=undefined;e.pos=copy(t.pos);e.tiers=[...t.tiers];e.asset=towerAsset(t.defId,t.tiers);e.strike=undefined;}
  for(const s of state.strikes){const e=entries.get(s.source);if(e&&live.has(e.id)&&validDirection(s.direction)){e.aim=angle(s.direction);e.strike={direction:copy(s.direction),windup:Math.max(0,s.remainingWindup),total:Math.max(.001,s.attack.windup)};}}
  for(const [id,e] of entries){if(!live.has(id)&&e.transition?.kind!=='sell')entries.delete(id);}
 }
 function sample(id:string):MotionSample {
  const e=entries.get(id);if(!e||disposed)return neutral();const s=style(e.defId), out=neutral(), t=e.transition;
  const wave=Math.sin(sim*2*Math.PI/s.period+e.phase);const tier=topTier(e.tiers);
  const aimed=s.mechanism==='barrel'||s.mechanism==='strike'||s.mechanism==='launch';
  out.rotation=aimed?e.aim:0;
  if(!reduced){
   out.scale=1+s.idle*wave*(1+tier*.08);
   if(s.mechanism==='tree')out.rotation=.025*wave;
   if(s.mechanism==='water')out.offset.y=.9*wave;
   if(s.mechanism==='ring')out.rotation=.09*Math.sin(sim*2*Math.PI/s.period+e.phase);
   out.glow=s.glow*(.4+.25*wave);
   if(e.strike){out.rotation=angle(e.strike.direction);if(e.strike.windup>0){const p=clamp(1-e.strike.windup/e.strike.total);out.scale*=1-.09*Math.sin(p*Math.PI/2);}}
   if(e.pulse){const age=Math.max(0,sim-e.pulse.time), d=e.pulse.kind==='ability'?.8:.24, k=1-clamp(age/d);if(k>0){const strength=e.pulse.kind==='ability'?.42:s.glow;out.glow+=strength*k*k;
    if(e.pulse.kind==='shot'&&age>0&&s.recoil>0){const f=Math.sin(Math.PI*clamp(age/d))*s.recoil;out.offset.x-=Math.cos(angle(e.pulse.direction))*f;out.offset.y-=Math.sin(angle(e.pulse.direction))*f;}
    if(e.pulse.kind==='ability')out.scale*=1+.055*Math.sin(Math.PI*(1-k));
   }}
  }
  if(t){const p=clamp((clock-t.start)/t.duration), q=ease(p);
   if(t.kind==='place'){out.opacity=p<1?Math.max(.18,q):1;if(!reduced){out.scale*=.65+.35*q;out.glow+=.22*Math.sin(Math.PI*p);}}
   else if(t.kind==='upgrade'){if(!reduced){out.scale*=t.initialScale+(1-t.initialScale)*q+(t.t5?.11:.055)*Math.sin(Math.PI*p);out.glow+=(t.t5?.55:.28)*Math.sin(Math.PI*p);if(t.from&&t.from!==e.asset&&p<1){out.ghostAsset=t.from;out.ghostOpacity=(1-q)*.8;out.opacity=1-out.ghostOpacity;}}}
   else {out.opacity=t.initialOpacity*(1-q);if(!reduced){out.scale*=t.initialScale*(1-.28*q);out.glow+=.12*Math.sin(Math.PI*p);}}
  }
  // A launch pose uses the unshifted world-space origin at the event tick.
  if(e.pulse?.kind==='shot'&&Math.abs(sim-e.pulse.time)<1e-8){out.offset={x:0,y:0};out.scale=1;}
  out.glow=clamp(out.glow);out.opacity=clamp(out.opacity);return out;
 }
 function consume(events:GameEvent[],state:GameState){
  if(disposed)return;context(state);const live=new Map(state.towers.map(t=>[t.id,t]));
  for(const event of [...events].sort((a,b)=>a.id-b.id)){
   if(!Number.isSafeInteger(event.id)||event.id<=lastEvent||!finite(event.time))continue;lastEvent=event.id;
   const id=[event.source,event.target].find(x=>x!==undefined&&(live.has(x)||entries.has(x)));if(!id)continue;const tower=live.get(id);let e=entries.get(id);const prior=e?.asset;
   if(!e&&tower)e=add(tower);if(!e)continue;
   const before=sample(id);const pos=event.pos??e.pos;const dir=event.to?direction(pos,event.to):undefined;
   switch(event.kind){
    case 'place': if(tower)e.transition={kind:'place',start:clock,duration:reduced?.12:.42,t5:false,initialScale:1,initialOpacity:1};break;
    case 'upgrade': if(tower){const next=eventAsset(event.toVisual,e.defId)??towerAsset(tower.defId,tower.tiers);const previous=eventAsset(event.fromVisual,e.defId)??prior;const t5=/[abc]5\.svg$/.test(next)&&next!==previous;e.asset=next;e.transition={kind:'upgrade',start:clock,duration:reduced?.12:t5?.95:.48,from:previous,t5,initialScale:clamp(before.scale,.65,1.12),initialOpacity:1};}break;
    case 'sell': if(!tower){e.transition={kind:'sell',start:clock,duration:reduced?.12:.38,t5:false,initialScale:clamp(before.scale,.65,1.12),initialOpacity:before.opacity};e.pulse=undefined;e.strike=undefined;}break;
    case 'shot':case 'projectileSpawn':case 'strikeStart': if(tower){const projectile=event.kind==='projectileSpawn'?state.projectiles.find(p=>p.source===id&&(p.id===event.target||!event.target)):undefined;const strike=event.kind==='strikeStart'?state.strikes.find(s=>s.source===id):undefined;const d=projectile?.velocity??strike?.direction??dir;if(d&&validDirection(d)){e.aim=angle(d);if(event.kind!=='strikeStart')e.pulse={time:event.time,direction:copy(d),kind:'shot'};}else if(event.kind!=='strikeStart')e.pulse={time:event.time,direction:{x:Math.cos(e.aim),y:Math.sin(e.aim)},kind:'shot'};}break;
    case 'strikeContact': if(tower)e.pulse={time:event.time,direction:dir??{x:Math.cos(e.aim),y:Math.sin(e.aim)},kind:'contact'};break;
    case 'ability': if(tower)e.pulse={time:event.time,direction:{x:Math.cos(e.aim),y:Math.sin(e.aim)},kind:'ability'};break;
   }
  }
  sync(state);
 }
 function update(realSeconds:number,state:GameState){if(disposed)return;context(state);if(finite(realSeconds)&&realSeconds>0)clock+=realSeconds;sync(state);for(const [id,e] of entries){if(e.transition&&clock-e.transition.start>=e.transition.duration){if(e.transition.kind==='sell'){entries.delete(id);continue;}e.transition=undefined;}if(e.pulse&&sim-e.pulse.time>.8)e.pulse=undefined;}}
 return {consume,update,sample,setReducedMotion(value){reduced=value;},retired(){return [...entries.values()].filter(e=>e.transition?.kind==='sell').map(e=>({id:e.id,defId:e.defId,pos:copy(e.pos),tiers:[...e.tiers],asset:e.asset}));},trackedCount(){return entries.size;},dispose(){entries.clear();disposed=true;}};
}
