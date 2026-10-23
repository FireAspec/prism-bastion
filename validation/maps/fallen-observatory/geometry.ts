import type {MapDef,Vec} from '../../../src/contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';

export interface BuildSite {id:string;point:Vec;radius:number;purpose:string}
export const landSites:BuildSite[]=[
 {id:'western-watch',point:{x:70,y:94},radius:24,purpose:'early entry contact'},
 {id:'western-crossfire',point:{x:438,y:164},radius:24,purpose:'long approach overlap'},
 {id:'western-reserve',point:{x:358,y:344},radius:24,purpose:'first bend reserve'},
 {id:'middle-overlook',point:{x:800,y:165},radius:24,purpose:'long central battery'},
 {id:'middle-south',point:{x:735,y:312},radius:24,purpose:'middle south artillery'},
 {id:'middle-west',point:{x:450,y:317},radius:24,purpose:'post-bend control'},
 {id:'eastern-upper',point:{x:913,y:316},radius:24,purpose:'second bend focus'},
 {id:'eastern-mid',point:{x:1050,y:326},radius:24,purpose:'exit approach'},
 {id:'eastern-exit',point:{x:1233,y:319},radius:24,purpose:'last upper position'},
 {id:'eastern-reserve',point:{x:1224,y:462},radius:24,purpose:'last southern reserve'},
 {id:'eastern-south',point:{x:912,y:446},radius:24,purpose:'control past second bend'},
];
export const waterSites:BuildSite[]=[
 {id:'west-pool',point:{x:145,y:566},radius:23,purpose:'future water unit'},
 {id:'middle-pool',point:{x:831,y:575},radius:23,purpose:'future water unit'},
 {id:'north-pool',point:{x:1230,y:110},radius:22,purpose:'future water unit'},
];

const EPS=1e-7;
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const between=(n:number,a:number,b:number)=>n>=Math.min(a,b)-EPS&&n<=Math.max(a,b)+EPS;
const on=(a:Vec,b:Vec,p:Vec)=>Math.abs(cross(a,b,p))<EPS&&between(p.x,a.x,b.x)&&between(p.y,a.y,b.y);
export function intersects(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 return (x*y < -EPS&&z*w < -EPS)||(Math.abs(x)<EPS&&on(a,b,c))||
  (Math.abs(y)<EPS&&on(a,b,d))||(Math.abs(z)<EPS&&on(c,d,a))||(Math.abs(w)<EPS&&on(c,d,b));
}
type Edge=[Vec,Vec];
const edges=(poly:Vec[]):Edge[]=>poly.map((p,i)=>[p,poly[(i+1)%poly.length]]);
const pathEdges=(poly:Vec[]):Edge[]=>poly.slice(1).map((p,i)=>[poly[i],p]);
const segmentGap=(a:Vec,b:Vec,c:Vec,d:Vec)=>intersects(a,b,c,d)?0:
 Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
const edgeGap=(p:Vec,poly:Vec[])=>Math.min(...edges(poly).map(([a,b])=>distanceToSegment(p,a,b)));
const corridorGap=(poly:Vec[],lane:Vec[])=>Math.min(...edges(poly).flatMap(([a,b])=>pathEdges(lane).map(([c,d])=>segmentGap(a,b,c,d))));
const polygonGap=(a:Vec[],b:Vec[])=>{
 if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return 0;
 return Math.min(...edges(a).flatMap(([x,y])=>edges(b).map(([u,v])=>segmentGap(x,y,u,v))));
};
export function checkSite(map:MapDef,site:BuildSite,water=false):string[] {
 const {point:p,radius:r}=site;const errors:string[]=[];const clearance=4;
 if(p.x-r<clearance||p.y-r<clearance||p.x+r>1280-clearance||p.y+r>720-clearance)errors.push('outside bounds');
 if(map.lanes.some(lane=>Math.min(...pathEdges(lane).map(([a,b])=>distanceToSegment(p,a,b)))<r+map.pathWidth/2+clearance-EPS))errors.push('intersects road');
 if(map.blocked.some(poly=>pointInPolygon(p,poly)||edgeGap(p,poly)<r+clearance-EPS))errors.push('intersects debris');
 if(water){if(!map.water.some(poly=>pointInPolygon(p,poly)&&edgeGap(p,poly)>=r+clearance-EPS))errors.push('not submerged with full radius');}
 else if(map.water.some(poly=>pointInPolygon(p,poly)||edgeGap(p,poly)<r+clearance-EPS))errors.push('intersects water');
 return errors;
}
export function analyzeGeometry(map:MapDef) {
 const errors:string[]=[];const inBounds=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
 if(map.lanes.length!==1)errors.push('expected one lane');
 if(map.pathWidth<44||map.pathWidth>66)errors.push('invalid path width');
 map.lanes.forEach((lane,i)=>{
  if(lane.length<5||lane[0].x!==0||lane.at(-1)?.x!==1280)errors.push(`lane ${i}: nonvisible entry/exit`);
  lane.forEach((p,j)=>{if(!inBounds(p))errors.push(`lane ${i} vertex ${j}: out of bounds`);});
  pathEdges(lane).forEach(([a,b],j)=>{if(distance(a,b)<1)errors.push(`lane ${i} segment ${j}: zero length`);});
  const e=pathEdges(lane);
  for(let j=0;j<e.length;j++)for(let k=j+2;k<e.length;k++)if(intersects(...e[j],...e[k]))errors.push(`lane ${i}: self crossing`);
 });
 const polygons=[...map.blocked,...map.water];
 polygons.forEach((poly,i)=>{
  const area=Math.abs(poly.reduce((s,p,j)=>s+p.x*poly[(j+1)%poly.length].y-poly[(j+1)%poly.length].x*p.y,0)/2);
  if(poly.length<3||area<100)errors.push(`polygon ${i}: degenerate`);
  poly.forEach((p,j)=>{if(!inBounds(p))errors.push(`polygon ${i} vertex ${j}: out of bounds`);});
  const e=edges(poly);
  e.forEach(([a,b],j)=>{if(distance(a,b)<1)errors.push(`polygon ${i} edge ${j}: zero length`);});
  for(let j=0;j<e.length;j++)for(let k=j+1;k<e.length;k++){
   if(k===j+1||(j===0&&k===e.length-1))continue;
   if(intersects(...e[j],...e[k]))errors.push(`polygon ${i}: self-intersects`);
  }
  map.lanes.forEach((lane,j)=>{if(corridorGap(poly,lane)<map.pathWidth/2+3-EPS)errors.push(`polygon ${i}: intrudes into road ${j}`);});
  polygons.slice(i+1).forEach((other,j)=>{if(polygonGap(poly,other)<3-EPS)errors.push(`polygons ${i}/${i+j+1}: overlap or touch`);});
 });
 landSites.forEach(s=>checkSite(map,s).forEach(e=>errors.push(`${s.id}: ${e}`)));
 waterSites.forEach(s=>checkSite(map,s,true).forEach(e=>errors.push(`${s.id}: ${e}`)));
 for(let i=0;i<landSites.length;i++)for(let j=i+1;j<landSites.length;j++){
  const a=landSites[i],b=landSites[j];
  if(distance(a.point,b.point)<a.radius+b.radius+2-EPS)errors.push(`land sites ${a.id}/${b.id}: footprint overlap`);
 }
 const laneLengths=map.lanes.map(laneLength);
 if(laneLengths.some(n=>n<1100||n>1650))errors.push('non-medium lane length');
 const travelSeconds=Object.fromEntries([['scarlet',52],['lemon',115],['dart',132],['boss-chrono',18]].map(([id,v])=>[id,laneLengths.map(n=>Math.round(n/(v as number)*10)/10)]));
 return {ok:errors.length===0,errors,laneLengths,travelSeconds,landSites:landSites.length,waterSites:waterSites.length};
}
