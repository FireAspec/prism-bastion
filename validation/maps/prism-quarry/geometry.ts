import type {MapDef,Vec} from '../../../src/contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';
import {getMap} from '../../../src/content/maps/prism-quarry';

export interface CandidateSite{id:string;pos:Vec;radius:number;placement:'land'|'water';role:string;}
export const SITES:readonly CandidateSite[]=[
 {id:'saddle',pos:{x:370,y:385},radius:40,placement:'land',role:'First two-lane crossfire'},
 {id:'hinge',pos:{x:810,y:384},radius:40,placement:'land',role:'Midfield two-lane slow/control'},
 {id:'gate',pos:{x:1159,y:375},radius:40,placement:'land',role:'Two-exit final stand'},
 {id:'north',pos:{x:570,y:225},radius:38,placement:'land',role:'Northern long-lane fire'},
 {id:'north-cut',pos:{x:215,y:355},radius:38,placement:'land',role:'Early northern intercept'},
 {id:'north-ridge',pos:{x:767,y:183},radius:38,placement:'land',role:'Northern ridge artillery'},
 {id:'upper-east',pos:{x:954,y:301},radius:38,placement:'land',role:'Eastern long-lane armor counter'},
 {id:'south',pos:{x:627,y:399},radius:38,placement:'land',role:'Short-lane reinforcement'},
 {id:'south-entry',pos:{x:212,y:456},radius:38,placement:'land',role:'Early fast-lane watch'},
 {id:'south-reserve',pos:{x:972,y:630},radius:38,placement:'land',role:'South last-resort reserve'},
 {id:'pool',pos:{x:798,y:649},radius:30,placement:'water',role:'Future water-tower revisit'},
];

const EPS=1e-8;
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(p:Vec,a:Vec,b:Vec)=>Math.abs(cross(a,b,p))<EPS&&
 p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&
 p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;

export function intersects(a:Vec,b:Vec,c:Vec,d:Vec):boolean{
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 if((abC>EPS&&abD< -EPS||abC< -EPS&&abD>EPS)&&
    (cdA>EPS&&cdB< -EPS||cdA< -EPS&&cdB>EPS))return true;
 return Math.abs(abC)<EPS&&onSegment(c,a,b)||Math.abs(abD)<EPS&&onSegment(d,a,b)||
        Math.abs(cdA)<EPS&&onSegment(a,c,d)||Math.abs(cdB)<EPS&&onSegment(b,c,d);
}
const edges=(poly:Vec[]):[Vec,Vec][]=>poly.map((p,i)=>[p,poly[(i+1)%poly.length]]);
const segmentGap=(a:Vec,b:Vec,c:Vec,d:Vec)=>intersects(a,b,c,d)?0:
 Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));

export function distanceToPolygon(p:Vec,poly:Vec[]):number{
 if(pointInPolygon(p,poly)||edges(poly).some(([a,b])=>onSegment(p,a,b)))return 0;
 return Math.min(...edges(poly).map(([a,b])=>distanceToSegment(p,a,b)));
}
function lanePolygonGap(lane:Vec[],poly:Vec[]):number{
 let closest=Infinity;
 for(let i=1;i<lane.length;i++){
  const a=lane[i-1],b=lane[i];
  if(pointInPolygon(a,poly)||pointInPolygon(b,poly))return 0;
  for(const [c,d] of edges(poly))closest=Math.min(closest,segmentGap(a,b,c,d));
 }
 return closest;
}
const laneDistance=(p:Vec,lane:Vec[])=>Math.min(...lane.slice(1).map((b,i)=>distanceToSegment(p,lane[i],b)));
const area=(poly:Vec[])=>poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p.x*q.y-q.x*p.y;},0)/2;

/** Checks a whole circular footprint, not just the center. Conservatively
 * reserves two extra pixels beside roads, obstacles and water. */
export function siteFits(map:MapDef,site:CandidateSite):boolean{
 const p=site.pos,r=site.radius;
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<r+2||p.y<r+2||p.x>1280-r-2||p.y>720-r-2)return false;
 if(map.lanes.some(lane=>laneDistance(p,lane)<r+map.pathWidth/2+2))return false;
 if(map.blocked.some(poly=>distanceToPolygon(p,poly)<r+2))return false;
 if(site.placement==='land')return map.water.every(poly=>distanceToPolygon(p,poly)>=r+2);
 return map.water.some(poly=>pointInPolygon(p,poly)&&
  Math.min(...edges(poly).map(([a,b])=>distanceToSegment(p,a,b)))>=r+2);
}

export interface MapAnalysis{
 errors:string[];laneLengths:number[];fastestTravelSeconds:number[];
 laneDistancesForSites:Record<string,number[]>;
 geometricChecks:{checkedPolygons:number;checkedSegments:number;dualLanePositions:string[]};
}
export function analyzeMap(map:MapDef=getMap()):MapAnalysis{
 const errors:string[]=[];
 const inWorld=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=1280&&p.y<=720;
 if(map.id!=='prism-quarry'||map.difficulty!==3||map.campaignIndex!==13||map.recommendedDifficulty!=='hard')errors.push('Map metadata mismatch');
 if(map.lanes.length!==2||map.pathWidth!==44)errors.push('Expected two 44-pixel paths');
 let segments=0;
 for(const [laneIndex,lane] of map.lanes.entries()){
  if(lane.length<2)errors.push(`Lane ${laneIndex} needs >=2 points`);
  lane.forEach((p,i)=>{
   if(!inWorld(p))errors.push(`Lane ${laneIndex} vertex ${i} out of world`);
   if(i>0){segments++;if(distance(p,lane[i-1])<EPS)errors.push(`Lane ${laneIndex} has zero segment ${i}`);}
  });
  if(lane[0]?.x>60||lane.at(-1)!.x<1220)errors.push(`Lane ${laneIndex} lacks visible entrance/exit`);
 }
 const polygons=[...map.blocked,...map.water];
 polygons.forEach((poly,pIndex)=>{
  if(poly.length<3||Math.abs(area(poly))<1)errors.push(`Polygon ${pIndex} has no usable area`);
  poly.forEach((p,i)=>{if(!inWorld(p))errors.push(`Polygon ${pIndex} vertex ${i} out of world`);});
  const ee=edges(poly);
  ee.forEach(([a,b],i)=>{
   if(distance(a,b)<EPS)errors.push(`Polygon ${pIndex} has zero edge ${i}`);
   ee.forEach(([c,d],j)=>{
    if(j<=i+1||i===0&&j===ee.length-1)return;
    if(intersects(a,b,c,d))errors.push(`Polygon ${pIndex} self-intersects ${i}/${j}`);
   });
  });
  map.lanes.forEach((lane,li)=>{
   const gap=lanePolygonGap(lane,poly);
   if(gap<map.pathWidth/2+2)errors.push(`Polygon ${pIndex} intersects road ${li}, clearance ${gap.toFixed(1)}`);
  });
 });
 const laneLengths=map.lanes.map(laneLength);
 if(laneLengths.length===2&&(laneLengths[0]<laneLengths[1]*1.2||laneLengths[1]<1000))errors.push('Short route too short or north not distinctly longer');
 if(map.lanes.length===2&&distance(map.lanes[0].at(-1)!,map.lanes[1].at(-1)!)<100)errors.push('Exits not separate');
 const laneDistancesForSites:Record<string,number[]>={};
 const dualLanePositions:string[]=[];
 for(const site of SITES){
  if(!siteFits(map,site))errors.push(`Footprint blocked: ${site.id}`);
  laneDistancesForSites[site.id]=map.lanes.map(lane=>laneDistance(site.pos,lane));
  if(site.placement==='land'&&laneDistancesForSites[site.id].every(d=>d<=160))dualLanePositions.push(site.id);
 }
 if(dualLanePositions.length<3)errors.push('Fewer than three cross-lane needle sites');
 if(!SITES.some(site=>site.placement==='water'&&siteFits(map,site)))errors.push('Pool inaccessible to water towers');
 return {errors,laneLengths,fastestTravelSeconds:laneLengths.map(l=>l/132),laneDistancesForSites,
  geometricChecks:{checkedPolygons:polygons.length,checkedSegments:segments,dualLanePositions}};
}
