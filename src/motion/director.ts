import type { GameEvent, GameState, Vec } from '../contracts/index';
import type { UITransition } from '../contracts/motion';

export type Style = 'assemble'|'upgrade'|'ascend'|'recoil'|'travel'|'contact'|'shard'|'shield'|'fade'|'spawn'|'pulse'|'banner'|'reject'|'slide'|'idle'|'turn';
export interface Cue { readonly duration: number; readonly reduced: number; readonly style: Style; readonly channel: string; readonly priority: number }
const cue = (duration: number, style: Style, channel: string, priority=1, reduced=.12): Cue => Object.freeze({duration,style,channel,priority,reduced:Math.min(duration,reduced)});
export const GAME_CUES = Object.freeze({
  place:cue(.38,'assemble','body',3), upgrade:cue(.38,'upgrade','body',3), sell:cue(.32,'fade','body',5),
  shot:cue(.16,'recoil','attack'), projectileSpawn:cue(.16,'travel','projectile'), projectileImpact:cue(.18,'contact','impact'),
  strikeStart:cue(.25,'turn','attack'), strikeContact:cue(.18,'contact','impact'), miss:cue(.16,'fade','impact'),
  hit:cue(.10,'contact','hit'), layerBreak:cue(.09,'shard','layer',2,.08), shieldBreak:cue(.23,'shield','shield',3),
  kill:cue(.30,'fade','body',5), leak:cue(.25,'fade','body',5), spawn:cue(.24,'spawn','body',2),
  ability:cue(.45,'pulse','ability',3), bossPhase:cue(.75,'ascend','phase',4),
  waveStart:cue(.36,'banner','wave',2), waveEnd:cue(.36,'banner','wave',2), victory:cue(.60,'banner','result',5), defeat:cue(.60,'fade','result',5),
  income:cue(.20,'pulse','income'),
} satisfies Record<GameEvent['kind'],Cue>);
export const UI_CUES = Object.freeze({
  purchase:cue(.20,'pulse','ui'), reject:cue(.18,'reject','ui'), unlock:cue(.35,'assemble','ui'), levelUp:cue(.50,'ascend','ui'),
  reward:cue(.32,'pulse','ui'), open:cue(.24,'slide','ui'), close:cue(.20,'fade','ui'), select:cue(.16,'pulse','ui'), respec:cue(.28,'shield','ui'),
} satisfies Record<UITransition,Cue>);
export const EXTRA_CUES = Object.freeze({
  ghost:cue(.18,'spawn','body'), idle:cue(1.2,'idle','idle'), aim:cue(.16,'turn','attack'), reload:cue(.28,'recoil','attack'),
  move:cue(.16,'travel','move'), turn:cue(.16,'turn','move'), split:cue(.24,'shard','body'),
  debit:cue(.20,'pulse','ui'), xp:cue(.32,'pulse','ui'), seals:cue(.32,'pulse','ui'), medal:cue(.50,'ascend','ui'),
  upgradeMid:cue(.60,'upgrade','body',3), upgradeFinal:cue(1.15,'ascend','body',4),
});
export function cueForEvent(event: Pick<GameEvent,'kind'|'toVisual'>, tier?: number): Cue {
  if (event.kind === 'upgrade') {
    // Prefer explicit tier from the confirmed snapshot; the asset is a fallback only.
    const n = tier ?? Number(event.toVisual?.match(/(?:^|[/\\])[abc]([1-5])(?:\.svg)?$/i)?.[1] ?? 1);
    return n===5 ? EXTRA_CUES.upgradeFinal : n>=3 ? EXTRA_CUES.upgradeMid : GAME_CUES.upgrade;
  }
  return GAME_CUES[event.kind];
}
export function cueForUI(transition:UITransition): Cue { return UI_CUES[transition]; }
export interface CueSample { progress:number; scale:number; rotation:number; opacity:number; glow:number; offsetX:number; offsetY:number; ring:number }
export function sampleCue(c:Cue, elapsed:number, reduced=false, out?:CueSample): CueSample {
  if (!Number.isFinite(elapsed)) throw new RangeError('Invalid cue time');
  const p=Math.max(0,Math.min(1,elapsed/(reduced?c.reduced:c.duration)));
  const q=1-(1-p)**3, pulse=Math.sin(Math.PI*p);
  const s=out ?? {progress:0,scale:1,rotation:0,opacity:1,glow:0,offsetX:0,offsetY:0,ring:0};
  s.progress=p;s.scale=1;s.rotation=0;s.opacity=1;s.glow=0;s.offsetX=0;s.offsetY=0;s.ring=0;
  if(reduced){s.opacity=c.style==='fade'?1-p: .72+.28*q;s.glow=.12*pulse;return s;}
  switch(c.style){
    case 'assemble': s.scale=.65+.35*q;s.opacity=q;s.offsetY=12*(1-q);s.ring=q;break;
    case 'upgrade': s.scale=1+.18*pulse;s.rotation=.12*pulse;s.glow=.65*pulse;s.ring=q;break;
    case 'ascend': s.scale=1+.28*pulse;s.offsetY=-12*pulse;s.glow=.85*pulse;s.ring=q;break;
    case 'recoil': s.offsetX=-9*pulse;s.scale=1-.08*pulse;break;
    case 'travel': s.offsetX=52*q;s.opacity=1;break;
    case 'contact': s.glow=.6*(1-p);s.ring=q;s.scale=1+.1*pulse;break;
    case 'shard': s.scale=1+.12*pulse;s.ring=q;s.glow=.45*(1-p);break;
    case 'shield': s.ring=q;s.glow=.65*pulse;break;
    case 'fade': s.opacity=1-q;s.scale=1-.16*q;break;
    case 'spawn': s.opacity=q;s.scale=.82+.18*q;break;
    case 'pulse': s.scale=1+.13*pulse;s.glow=.5*pulse;break;
    case 'banner': s.opacity=p<.15?p/.15:Math.min(1,(1-p)/.2);s.offsetY=10*(1-q);break;
    case 'reject': s.offsetX=5*Math.sin(p*Math.PI*4)*(1-p);break;
    case 'slide': s.opacity=q;s.offsetY=16*(1-q);break;
    case 'idle': s.scale=1+.03*pulse;break;
    case 'turn': s.rotation=.4*pulse;break;
  }
  return s;
}
export const MAX_CUES=2048;
export interface ActiveCue { readonly key:string; readonly entity:string; readonly eventId:number; readonly cue:Cue; readonly start:number; readonly pos?:Readonly<Vec>; readonly to?:Readonly<Vec> }
export interface Director {
  readonly size:number;
  reset(snapshot:Pick<GameState,'time'|'nextEvent'>):void;
  consume(events:readonly GameEvent[], snapshot:Pick<GameState,'time'|'towers'>):void;
  update(snapshot:Pick<GameState,'time'>):void;
  visit(visitor:(active:ActiveCue,elapsed:number)=>void):void;
  cancel(entity:string):void;
  dispose():void;
}
const TARGET_EVENTS:ReadonlySet<GameEvent['kind']>=new Set(['hit','layerBreak','shieldBreak','kill','leak','spawn','bossPhase','projectileImpact','strikeContact']);
const point=(p?:Vec)=>p?Object.freeze({x:p.x,y:p.y}):undefined;
export function createDirector():Director {
  const active=new Map<string,ActiveCue>();
  let now=0,lastId=-1,disposed=false;
  const cancel=(entity:string)=>{for(const [key,a] of active)if(a.entity===entity)active.delete(key);};
  const update=(s:Pick<GameState,'time'>)=>{
    if(disposed)return;
    if(!Number.isFinite(s.time)||s.time<0)throw new RangeError('Invalid game time');
    now=Math.max(now,s.time);
    for(const [key,a] of active)if(now-a.start>=a.cue.duration-1e-12)active.delete(key);
  };
  return {
    get size(){return active.size;},
    reset(s){if(disposed)return;if(!Number.isSafeInteger(s.nextEvent)||s.nextEvent<0||!Number.isFinite(s.time)||s.time<0)throw new RangeError('Invalid snapshot');active.clear();now=s.time;lastId=s.nextEvent-1;},
    update,
    consume(events,s){
      if(disposed)return;
      update(s);
      // The app supplies authoritative event packets in ascending ID order.
      for(const event of events){
        if(!Number.isSafeInteger(event.id)||event.id<0||event.id<=lastId||!Number.isFinite(event.time)||event.time<0||event.time>now+1e-9)continue;
        lastId=event.id;
        const targetEvent=TARGET_EVENTS.has(event.kind);
        const entity=(targetEvent?event.target??event.source:event.source??event.target)??'@scene';
        const terminal=event.kind==='sell'||event.kind==='kill'||event.kind==='leak';
        if(terminal)cancel(entity);
        const tier=event.kind==='upgrade'?Math.max(0,...(s.towers.find(t=>t.id===entity)?.tiers??[])):undefined;
        // Multiple upgrades in one packet can share the final snapshot; asset tier takes precedence for that case.
        const assetTier=event.toVisual?.match(/(?:^|[/\\])[abc]([1-5])(?:\.svg)?$/i)?.[1];
        const c=cueForEvent(event,assetTier?Number(assetTier):tier||undefined);
        if(now-event.time>=c.duration-1e-12)continue;
        const key=JSON.stringify([entity,c.channel]);
        const previous=active.get(key);
        if(previous && previous.cue.priority>c.priority)continue;
        if(!previous && active.size>=MAX_CUES){
          let victim:string|undefined;
          for(const [k,a] of active)if(a.cue.priority<c.priority){victim=k;break;}
          if(victim===undefined)continue;
          active.delete(victim);
        }
        active.set(key,Object.freeze({key,entity,eventId:event.id,cue:c,start:event.time,pos:point(event.pos),to:point(event.to)}));
      }
    },
    visit(visitor){if(!disposed)for(const a of active.values())visitor(a,Math.max(0,now-a.start));},
    cancel,
    dispose(){active.clear();disposed=true;},
  };
}

export interface UIActiveCue { readonly element:string; readonly transition:UITransition; readonly cue:Cue; readonly start:number }
export interface UIDirector {
  readonly size:number;
  advance(seconds:number):void;
  play(element:string,transition:UITransition):void;
  visit(visitor:(active:UIActiveCue,elapsed:number,reduced:boolean)=>void):void;
  setReducedMotion(value:boolean):void;
  cancel(element:string):void;
  clear():void;
  dispose():void;
}
export const MAX_UI_CUES=128;
/** Presentation-only clock. The app calls advance even when the game is paused. */
export function createUIDirector():UIDirector {
  const active=new Map<string,UIActiveCue>();
  let now=0,reduced=false,disposed=false;
  const prune=()=>{for(const [key,a] of active)if(now-a.start>=(reduced?a.cue.reduced:a.cue.duration)-1e-12)active.delete(key);};
  return {
    get size(){return active.size;},
    advance(seconds){if(!Number.isFinite(seconds)||seconds<0||!Number.isFinite(now+seconds))throw new RangeError('Invalid UI delta');if(!disposed){now+=seconds;prune();}},
    play(element,transition){if(disposed)return;const c=cueForUI(transition);active.delete(element);if(active.size>=MAX_UI_CUES){const first=active.keys().next();if(!first.done)active.delete(first.value);}active.set(element,Object.freeze({element,transition,cue:c,start:now}));},
    visit(visitor){if(!disposed)for(const a of active.values())visitor(a,Math.max(0,now-a.start),reduced);},
    setReducedMotion(value){if(disposed||value===reduced)return;reduced=value;active.clear();},
    cancel(element){active.delete(element);},clear(){active.clear();now=0;},dispose(){active.clear();disposed=true;},
  };
}
