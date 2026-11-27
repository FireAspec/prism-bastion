import {INITIAL} from './replay.mjs';
export const STRATEGIES=[
 {id:'balanced',damage:1,splash:1.1,boss:1,detect:1.4,economy:1,coverage:1,spacing:24,reserve:0},
 {id:'boss-focus',damage:1.2,splash:.65,boss:2.8,detect:1.1,economy:.7,coverage:1,spacing:20,reserve:0},
 {id:'crowd-control',damage:.8,splash:2,boss:.8,detect:1.4,economy:.6,coverage:1.3,spacing:32,reserve:0},
 {id:'early-economy',damage:1,splash:1,boss:1,detect:1,economy:3.5,coverage:1,spacing:24,reserve:.25},
 {id:'no-farms',damage:1,splash:1.2,boss:1.6,detect:1.4,economy:0,coverage:1,spacing:24,reserve:0,noFarms:true},
 {id:'distributed',damage:1,splash:1,boss:1,detect:1.3,economy:.8,coverage:2.5,spacing:45,reserve:0},
 {id:'tier-rush',damage:1.15,splash:1,boss:2,detect:1.3,economy:.8,coverage:1,spacing:24,reserve:.45,upgradeBias:2.2},
 {id:'starter-only',damage:1,splash:1.4,boss:1.7,detect:1.5,economy:0,coverage:1,spacing:24,reserve:0,noFarms:true,starterOnly:true}
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function seg(p,a,b){
 const d=(b.x-a.x)**2+(b.y-a.y)**2;
 const t=d?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d)):0;
 return dist(p,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
}
export function sampleLanes(map,spacing=32){
 return map.lanes.map(lane=>lane.slice(1).flatMap((b,i)=>{
  const a=lane[i],len=dist(a,b),n=Math.max(1,Math.ceil(len/spacing));
  return Array.from({length:n},(_,j)=>({x:a.x+(b.x-a.x)*(j+.5)/n,y:a.y+(b.y-a.y)*(j+.5)/n,weight:len/n}));
 }));
}
function inPoly(p,poly){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
function edgeDistance(p,poly){return Math.min(...poly.map((b,i)=>seg(p,poly[(i+poly.length-1)%poly.length],b)));}
function touches(p,r,poly){return inPoly(p,poly)||edgeDistance(p,poly)<r;}
export function positions(map,def,samples,grid=24){
 const result=[],r=def.footprint;
 for(let y=r+1;y<720-r;y+=grid)for(let x=r+1;x<1280-r;x+=grid){
  const p={x,y};
  if(map.lanes.some(l=>l.slice(1).some((b,i)=>seg(p,l[i],b)<map.pathWidth/2+r)))continue;
  if(map.blocked.some(poly=>touches(p,r,poly)))continue;
  if(def.placement==='water'&&!map.water.some(poly=>inPoly(p,poly)&&edgeDistance(p,poly)>=r))continue;
  if(def.placement==='land'&&map.water.some(poly=>touches(p,r,poly)))continue;
  const range=def.attack.range||def.effects.reduce((v,e)=>Math.max(v,e.radius),0)||150;
  const coverage=samples.map(l=>l.reduce((n,q)=>n+(dist(p,q)<=range?q.weight:0),0));
  if(coverage.every(c=>c===0)&&def.category!=='economy')continue;
  result.push({p,coverage});
 }
 return result;
}
const legal=t=>t.filter(x=>x>0).length<=2&&t.filter(x=>x>2).length<=1&&t.every(x=>x>=0&&x<=5);
const moneyEffect=e=>['income','interest','harvest'].includes(e.kind);
function economic(res){return res.effects.some(moneyEffect)||res.abilities.some(a=>a.kind==='mint');}
function value(res,st,phase,remaining,team){
 const a=res.attack;
 const hits=Math.max(1,Math.min(8,a.pierce+a.chains+(a.splash>0?Math.min(5,a.splash/35):0)));
 const control=a.statuses.reduce((n,x)=>n+(['slow','freeze','stun','mark','shred','reveal'].includes(x.kind)?Math.min(2,x.duration)*Math.max(.15,x.power)*8:0),0);
 const dps=a.damage*Math.max(1,a.count)/Math.max(.05,a.interval);
 const attacks=dps*(st.damage+st.splash*(hits-1)*.5+st.boss*Math.max(0,a.bossMultiplier-1)+.025*a.armorPierce);
 const detect=(a.detects||res.effects.some(e=>e.kind==='aura'&&e.stat==='detect'))?st.detect*(team.some(t=>t.detects)?8:45):0;
 const support=res.effects.filter(e=>e.kind==='aura').reduce((n,e)=>n+(e.stat==='detect'?0:Math.min(100,e.power*Math.max(1,team.length)*20)),0);
 const income=res.effects.filter(moneyEffect).reduce((n,e)=>n+(e.kind==='income'?e.power:e.kind==='interest'?Math.min(e.cap,1500*e.power):Math.min(e.cap,120*e.power)),0);
 const skills=res.abilities.filter(a=>a.kind!=='mint').reduce((n,a)=>n+Math.max(0,a.power)/Math.max(1,a.cooldown),0);
 return attacks+control+detect+support+skills+(phase==='build'?income*st.economy*Math.min(12,remaining)/12:0);
}
export function makePolicy(combat){
 const cache=new Map();
 return ({state,issue,config,cell,strategy:st})=>{
  let s=state();const map=config.maps.find(m=>m.id===cell.mapId);
  const defs=new Map(config.towers.map(d=>[d.id,d]));
  const defList=config.towers.filter(d=>cell.availableTowers.includes(d.id)&&(!st.starterOnly||INITIAL.includes(d.id)));
  const team=()=>s.towers.map(t=>combat.resolveTower(defs.get(t.defId),t.tiers).attack);
  const host=s.options.players[0].id;
  // Activate only when a real target is near, or for a legal monetary/barrier ability.
  if(s.phase==='wave'&&s.rules.allowAbilities){
   for(const t of s.towers){
    const res=combat.resolveTower(defs.get(t.defId),t.tiers);
    for(const a of res.abilities){
     if((t.abilityCooldowns[a.id]??0)>0)continue;
     if(a.kind==='mint'&&(!s.rules.allowPassiveIncome||st.noFarms))continue;
     const radius=a.radius||res.attack.range||160;
     if(a.kind==='barrier'?s.lives<s.rules.maxLives:a.kind==='mint'||s.enemies.some(e=>dist(e.pos,t.pos)<=radius)){
      issue({type:'ability',tower:t.id,ability:a.id,actor:t.owner});s=state();
     }
    }
   }
  }
  if(s.phase==='wave'&&s.tick%180>=15)return;
  const remaining=Math.max(0,s.rules.rounds-s.wave);
  if(!cache.has(map.id))cache.set(map.id,{samples:sampleLanes(map),defs:new Map()});
  const entry=cache.get(map.id);
  for(let iteration=0;iteration<40;iteration++){
   s=state();const choices=[],attacks=team();
   const forbidMoney=st.noFarms||!s.rules.allowPassiveIncome;
   const estimate=(cost)=>Math.max(1,Math.ceil(cost*s.rules.towerCostMul));
   const reserve=s.towers.length>=2&&s.phase==='build'?Math.floor(s.credits*st.reserve):0;
   for(const t of s.towers){
    const d=defs.get(t.defId),prev=combat.resolveTower(d,t.tiers);
    for(let p=0;p<3;p++){
     const next=[...t.tiers];next[p]++;
     if(!legal(next)||next[p]>s.rules.maxTier)continue;
     if(next[p]===5&&s.towers.some(o=>o.defId===t.defId&&o.tiers[p]===5))continue;
     const u=d.paths[p].upgrades[next[p]-1];if(!u)continue;
     const res=combat.resolveTower(d,next);
     if(forbidMoney&&economic(res))continue;
     const cost=estimate(u.cost);if(cost*.8>s.credits)continue;
     const benefit=value(res,st,s.phase,remaining,attacks)-value(prev,st,s.phase,remaining,attacks);
     // A modest unlock value allows buying useful but weak prerequisite tiers.
     const score=(Math.max(0,benefit)+2+next[p]*.8)*(st.upgradeBias||1)/cost;
     choices.push({score,command:{type:'upgrade',tower:t.id,path:p,actor:t.owner}});
    }
   }
   if(s.towers.length<s.rules.maxTowers){
    for(const d of defList){
     const res=combat.resolveTower(d,[0,0,0]);
     if(forbidMoney&&(d.category==='economy'||economic(res)))continue;
     if(d.category==='economy'&&(remaining<12||s.towers.filter(t=>defs.get(t.defId).category==='economy').length>=Math.max(1,Math.floor(s.towers.length/3))||!attacks.some(a=>a.damage>0)))continue;
     const cost=estimate(d.cost);if(cost*.8>s.credits-reserve)continue;
     if(!entry.defs.has(d.id))entry.defs.set(d.id,positions(map,d,entry.samples));
     const candidates=entry.defs.get(d.id).filter(({p})=>s.towers.every(t=>dist(t.pos,p)>=d.footprint+defs.get(t.defId).footprint));
     const ranked=candidates.map(({p,coverage})=>{
      const total=coverage.reduce((a,b)=>a+b,0),minimum=Math.min(...coverage);
      const spread=s.towers.reduce((n,t)=>n+Math.max(0,1-dist(t.pos,p)/Math.max(1,st.spacing*3)),0);
      const nearby=s.towers.filter(t=>dist(t.pos,p)<=Math.max(100,res.attack.range,...res.effects.map(e=>e.radius))).length;
      const support=d.category==='support'?Math.max(.05,nearby/2):1;
      return {p,score:(1+total/250+minimum/150*st.coverage)*support/(1+spread*.3)};
     }).sort((a,b)=>b.score-a.score).slice(0,64);
     const val=value(res,st,s.phase,remaining,attacks);
     if(val<=0)continue;
     for(const c of ranked)choices.push({score:val/cost*c.score,command:{type:'place',tower:d.id,pos:c.p,actor:s.options.players[s.towers.length%s.options.players.length]?.id||host}});
    }
   }
   choices.sort((a,b)=>b.score-a.score);
   let accepted=false;
   for(const c of choices.slice(0,300)){if(issue(c.command)){accepted=true;break;}}
   if(!accepted)break;
  }
 };
}
