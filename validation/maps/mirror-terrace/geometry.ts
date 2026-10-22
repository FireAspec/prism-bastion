import {getMap} from '../../../src/content/maps/mirror-terrace';
import {distance, distanceToSegment, laneLength, pointInPolygon} from '../../../src/contracts/geometry';
import type {Vec} from '../../../src/contracts';

export const landSites = {
 west:{x:444,y:292}, center:{x:642,y:266}, south:{x:640,y:487},
 northeast:{x:862,y:271}, southeast:{x:882,y:456}, crossfire:{x:895,y:335},
 westReserve:{x:344,y:342}, southReserve:{x:436,y:442},
} as const;
export const waterSites = [{x:183,y:366},{x:1062,y:381}] as const;
export const LAND_RADIUS = 40;  // Conservative world-pixel radius for a land build pad.
export const WATER_RADIUS = 24;

type Segment = readonly [Vec,Vec];
const segments=(points:readonly Vec[],closed=false):Segment[] =>
 points.slice(0,closed?undefined:-1).map((p,i)=>[p,points[(i+1)%points.length]] as const);
const cross=(a:Vec,b:Vec,c:Vec):number =>
 (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

function intersection([a,b]:Segment,[c,d]:Segment):Vec|null {
 const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y};
 const denom=r.x*s.y-r.y*s.x;
 if(Math.abs(denom)<1e-10)return null;
 const t=cross(a,c,d)/denom;
 const u=cross(a,c,b)/denom;
 if(t< -1e-8||t>1+1e-8||u< -1e-8||u>1+1e-8)return null;
 return {x:a.x+t*r.x,y:a.y+t*r.y};
}
const near=(a:Vec,b:Vec)=>distance(a,b)<1e-5;
const inWorld=(p:Vec)=>p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
const edgeDistance=(p:Vec,poly:readonly Vec[])=>Math.min(...segments(poly,true).map(([a,b])=>distanceToSegment(p,a,b)));
function polylineDistance(p:Vec,lanes:readonly (readonly Vec[])[]):number {
 return Math.min(...lanes.flatMap(lane=>segments(lane).map(([a,b])=>distanceToSegment(p,a,b))));
}
function polygonClearance(poly:Vec[],lane:Vec[]):number {
 const pe=segments(poly,true),le=segments(lane);
 for(const edge of pe)for(const road of le)if(intersection(edge,road))return 0;
 return Math.min(
  ...poly.flatMap(p=>le.map(([a,b])=>distanceToSegment(p,a,b))),
  ...lane.flatMap(p=>pe.map(([a,b])=>distanceToSegment(p,a,b))),
 );
}
function polygonsOverlap(a:Vec[],b:Vec[]):boolean {
 if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return true;
 return segments(a,true).some(e=>segments(b,true).some(f=>intersection(e,f)!==null));
}
function area(poly:Vec[]):number {
 return Math.abs(poly.reduce((s,p,i)=>s+p.x*poly[(i+1)%poly.length].y-poly[(i+1)%poly.length].x*p.y,0)/2);
}
export function landBuildable(pos:Vec,radius=LAND_RADIUS):boolean {
 const m=getMap();
 if(pos.x-radius<0||pos.x+radius>1280||pos.y-radius<0||pos.y+radius>720)return false;
 if(polylineDistance(pos,m.lanes)<radius+m.pathWidth/2+1)return false;
 return [...m.water,...m.blocked].every(poly=>!pointInPolygon(pos,poly)&&edgeDistance(pos,poly)>radius+1);
}
export function waterBuildable(pos:Vec,radius=WATER_RADIUS):boolean {
 const m=getMap();
 if(!m.water.some(poly=>pointInPolygon(pos,poly)&&edgeDistance(pos,poly)>radius+1))return false;
 if(polylineDistance(pos,m.lanes)<radius+m.pathWidth/2+1)return false;
 return m.blocked.every(poly=>!pointInPolygon(pos,poly)&&edgeDistance(pos,poly)>radius+1);
}
export interface GeometryReport {
 ok:boolean;errors:string[];laneLengths:number[];fastestTransitSeconds:number[];
 crossings:Vec[];sites:{land:number;water:number};pathWidth:number;
}
export function analyzeGeometry():GeometryReport {
 const m=getMap(),errors:string[]=[];
 if(m.id!=='mirror-terrace'||m.lanes.length!==2)errors.push('Expected exactly two mirror-terrace lanes');
 if(m.pathWidth<32||m.pathWidth>60)errors.push('Path width must support readable turns and placement');
 const lengths=m.lanes.map(lane=>laneLength(lane));
 for(const [laneIndex,lane] of m.lanes.entries()){
  if(lane.length<4)errors.push('Lane '+laneIndex+' is too short');
  for(const p of lane)if(!inWorld(p))errors.push('Lane '+laneIndex+' is outside world');
  for(const [a,b] of segments(lane))if(distance(a,b)<1)errors.push('Zero segment on lane '+laneIndex);
  if(lane[0]?.x!==0||lane[lane.length-1]?.x!==1280)errors.push('Lane '+laneIndex+' does not reach a visible edge');
  if(lengths[laneIndex]<1350)errors.push('Lane '+laneIndex+' has insufficient reaction distance');
  const parts=segments(lane);
  for(let i=0;i<parts.length;i++)for(let j=i+2;j<parts.length;j++){
   if(intersection(parts[i],parts[j]))errors.push('Lane '+laneIndex+' crosses itself');
  }
 }
 if(Math.abs((m.lanes[0]?.at(-1)?.y??0)-(m.lanes[1]?.at(-1)?.y??0))<90)errors.push('Exits are visually ambiguous');
 const crossings:Vec[]=[];
 for(const a of segments(m.lanes[0]))for(const b of segments(m.lanes[1])){
  const c=intersection(a,b);
  if(c&&!crossings.some(p=>near(p,c)))crossings.push(c);
 }
 if(crossings.length!==1||!near(crossings[0]??{x:0,y:0},{x:650,y:360}))errors.push('Roads must cross exactly once at central prism');
 // No segments are shared by both lanes. At the crossing an enemy belongs to one lane/ID only.
 for(const a of segments(m.lanes[0]))for(const b of segments(m.lanes[1])){
  if((near(a[0],b[0])&&near(a[1],b[1]))||(near(a[0],b[1])&&near(a[1],b[0])))
   errors.push('Overlapping lane segment');
 }
 const polygons=[...m.blocked,...m.water];
 for(const [i,poly] of polygons.entries()){
  if(poly.length<3||area(poly)<100)errors.push('Degenerate polygon '+i);
  for(const p of poly)if(!inWorld(p))errors.push('Polygon '+i+' is outside world');
  for(const [a,b] of segments(poly,true))if(distance(a,b)<1)errors.push('Zero polygon edge '+i);
  for(const [j,lane] of m.lanes.entries())if(polygonClearance(poly,lane)<m.pathWidth/2+1)
   errors.push('Polygon '+i+' intersects lane '+j);
  for(let j=0;j<i;j++)if(polygonsOverlap(poly,polygons[j]))errors.push('Overlapping polygons '+i+'/'+j);
 }
 for(const [name,pos] of Object.entries(landSites))if(!landBuildable(pos))
  errors.push('Blocked land site '+name);
 for(const [i,pos] of waterSites.entries())if(!waterBuildable(pos))
  errors.push('Blocked water site '+i);
 // Conservative transit at base dart speed (132 px/s). Modes and buffs vary.
 const fastestTransitSeconds=lengths.map(length=>Math.round(length/132*100)/100);
 if(fastestTransitSeconds.some(t=>t<9))errors.push('Insufficient fast-enemy transit');
 return {ok:errors.length===0,errors,laneLengths:lengths.map(n=>Math.round(n)),
  fastestTransitSeconds,crossings,sites:{land:Object.keys(landSites).length,water:waterSites.length},pathWidth:m.pathWidth};
}

if(typeof process!=='undefined'&&process.argv[1]?.replaceAll('\\','/').endsWith('/mirror-terrace/geometry.ts')){
 const report=analyzeGeometry();
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(!report.ok)process.exitCode=1;
}
