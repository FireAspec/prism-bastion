import {distance, distanceToSegment, laneLength, pointInPolygon, pointOnLane} from '../../../src/contracts/geometry';
import type {MapDef,Vec} from '../../../src/contracts';
import {WORLD} from '../../../src/contracts';
import {getMap} from '../../../src/content/maps/windmill-fields';

export const LAND_SITES = {
 N1:{x:345,y:163},N2:{x:700,y:163},N3:{x:925,y:164},
 W1:{x:165,y:411},C1:{x:452,y:444},C2:{x:572,y:444},
 S1:{x:420,y:604},S2:{x:710,y:604},
} as const satisfies Record<string,Vec>;
export const WATER_SITES = {
 A:{x:497,y:301},B:{x:950,y:318},
} as const satisfies Record<string,Vec>;

function cross(a:Vec,b:Vec,c:Vec):number {
 return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
function onSegment(p:Vec,a:Vec,b:Vec):boolean {
 return Math.abs(cross(a,b,p))<1e-8 &&
  p.x>=Math.min(a.x,b.x)-1e-8 && p.x<=Math.max(a.x,b.x)+1e-8 &&
  p.y>=Math.min(a.y,b.y)-1e-8 && p.y<=Math.max(a.y,b.y)+1e-8;
}
export function segmentsIntersect(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
 const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
 return ((x>0&&y<0)||(x<0&&y>0))&&((u>0&&v<0)||(u<0&&v>0)) ||
  onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
export function segmentDistance(a:Vec,b:Vec,c:Vec,d:Vec):number {
 if(segmentsIntersect(a,b,c,d))return 0;
 return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),
  distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
export function polygonEdges(polygon:Vec[]):[Vec,Vec][] {
 return polygon.map((point,i)=>[point,polygon[(i+1)%polygon.length]]);
}
export function polygonArea(poly:Vec[]):number {
 return Math.abs(poly.reduce((sum,p,i)=>sum+p.x*poly[(i+1)%poly.length].y-
  poly[(i+1)%poly.length].x*p.y,0)/2);
}
function nearPolygonEdge(p:Vec,poly:Vec[]):number {
 return Math.min(...polygonEdges(poly).map(([a,b])=>distanceToSegment(p,a,b)));
}
export function pathClearance(p:Vec,map:MapDef):number {
 return Math.min(...map.lanes.flatMap(lane=>lane.slice(1)
  .map((end,i)=>distanceToSegment(p,lane[i],end))))-map.pathWidth/2;
}
export function canPlaceLand(p:Vec,radius:number,map:MapDef):boolean {
 if(p.x-radius<0||p.x+radius>WORLD.width||p.y-radius<0||p.y+radius>WORLD.height)
  return false;
 if(pathClearance(p,map)<radius)return false;
 return ![...map.blocked,...map.water].some(poly=>pointInPolygon(p,poly)||nearPolygonEdge(p,poly)<radius);
}
export function canPlaceWater(p:Vec,radius:number,map:MapDef):boolean {
 if(pathClearance(p,map)<radius)return false;
 return map.water.some(poly=>pointInPolygon(p,poly)&&nearPolygonEdge(p,poly)>=radius);
}
export function rangeCoverage(lane:Vec[],site:Vec,range:number,step=8):number {
 const length=laneLength(lane);let count=0;
 for(let at=0;at<length;at+=step){
  if(distance(pointOnLane(lane,at),site)<=range)count++;
 }
 return count*step;
}

export interface GeometryReport {
 map:string;world:{width:number;height:number};pathLength:number;
 segments:number;shortestSegment:number;minimumNonAdjacentGap:number;
 minimumSceneryClearance:number;waterPools:number;landSites:number;
 validLandSites:string[];validWaterSites:string[];
 responseDistance:number;responseSecondsAt75:number;responseSecondsAt150:number;
 bossTravelSecondsAt17:number;errors:string[];
}

/** Collision and pacing checks, independent of engine, waves and tower implementations. */
export function inspectGeometry(map=getMap()):GeometryReport {
 const errors:string[]=[];
 const finite=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  p.x>=0&&p.x<=WORLD.width&&p.y>=0&&p.y<=WORLD.height;
 const segmentPairs=map.lanes.flatMap(lane=>lane.slice(1).map((end,i)=>[lane[i],end] as [Vec,Vec]));
 let shortestSegment=Infinity,minimumNonAdjacentGap=Infinity,minimumSceneryClearance=Infinity;
 if(map.lanes.length!==1)errors.push('Expected exactly one visible spiral lane');
 for(const [laneIndex,lane] of map.lanes.entries()){
  if(lane.length<2)errors.push(`Lane ${laneIndex} needs two points`);
  lane.forEach((p,i)=>{if(!finite(p))errors.push(`Lane ${laneIndex} point ${i} leaves world`);});
  lane.slice(1).forEach((p,i)=>{
   const len=distance(lane[i],p);shortestSegment=Math.min(shortestSegment,len);
   if(len<20)errors.push(`Segment ${i} is shorter than 20px (${len.toFixed(2)})`);
  });
 }
 for(let i=0;i<segmentPairs.length;i++){
  // One intervening segment is still part of the same bend; its chord is
  // deliberately close to both neighbours and is not a separate road strand.
  for(let j=i+3;j<segmentPairs.length;j++){
   const [a,b]=segmentPairs[i],[c,d]=segmentPairs[j];
   const gap=segmentDistance(a,b,c,d);
   minimumNonAdjacentGap=Math.min(gap,minimumNonAdjacentGap);
   if(gap<map.pathWidth+12)errors.push(`Road strands ${i},${j} too close (${gap.toFixed(1)}px)`);
  }
 }
 for(const [kind,polys] of [['blocked',map.blocked],['water',map.water]] as const){
  for(const [i,poly] of polys.entries()){
   if(poly.length<3||polygonArea(poly)<250)errors.push(`${kind}[${i}] degenerate`);
   poly.forEach((p,j)=>{if(!finite(p))errors.push(`${kind}[${i}][${j}] leaves world`);});
   const edges=polygonEdges(poly);
   for(let j=0;j<edges.length;j++)for(let k=j+2;k<edges.length;k++){
    if(j===0&&k===edges.length-1)continue;
    if(segmentsIntersect(...edges[j],...edges[k]))errors.push(`${kind}[${i}] self-intersects`);
   }
   for(const [a,b] of edges)for(const [c,d] of segmentPairs){
    const clearance=segmentDistance(a,b,c,d)-map.pathWidth/2;
    minimumSceneryClearance=Math.min(minimumSceneryClearance,clearance);
    if(clearance<1)errors.push(`${kind}[${i}] overlaps road (clearance ${clearance.toFixed(1)}px)`);
   }
  }
 }
 for(const [name,p] of Object.entries(LAND_SITES)){
  if(!canPlaceLand(p,30,map))errors.push(`Land site ${name} cannot fit a 30px footprint`);
  if(rangeCoverage(map.lanes[0],p,150)<80)errors.push(`Site ${name} cannot cover useful road`);
 }
 for(const [name,p] of Object.entries(WATER_SITES)){
  if(!canPlaceWater(p,18,map))errors.push(`Water site ${name} cannot fit an 18px footprint`);
 }
 const length=map.lanes.reduce((sum,lane)=>sum+laneLength(lane),0);
 let responseDistance=length;
 for(let progress=0;progress<length;progress+=4){
  const p=pointOnLane(map.lanes[0],progress);
  if(Object.values(LAND_SITES).some(site=>distance(site,p)<=150)){
   responseDistance=progress;break;
  }
 }
 if(responseDistance>350)errors.push('First 150px range engagement starts too late');
 const validLandSites=Object.entries(LAND_SITES).filter(([,p])=>canPlaceLand(p,30,map)).map(([n])=>n);
 const validWaterSites=Object.entries(WATER_SITES).filter(([,p])=>canPlaceWater(p,18,map)).map(([n])=>n);
 return {
  map:map.id,world:{width:WORLD.width,height:WORLD.height},pathLength:+length.toFixed(1),
  segments:segmentPairs.length,shortestSegment:+shortestSegment.toFixed(1),
  minimumNonAdjacentGap:+minimumNonAdjacentGap.toFixed(1),
  minimumSceneryClearance:+minimumSceneryClearance.toFixed(1),
  waterPools:map.water.length,landSites:Object.keys(LAND_SITES).length,
  validLandSites,validWaterSites,responseDistance,
  responseSecondsAt75:+(responseDistance/75).toFixed(2),
  responseSecondsAt150:+(responseDistance/150).toFixed(2),
  bossTravelSecondsAt17:+(length/17).toFixed(1),errors,
 };
}
