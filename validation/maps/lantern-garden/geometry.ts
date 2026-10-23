import {getMap} from '../../../src/content/maps/lantern-garden';
import {distance,laneLength,distanceToSegment,pointInPolygon} from '../../../src/contracts/geometry';
import type {Vec} from '../../../src/contracts';

/** Conservative placement radii for candidate towers, in world pixels. */
export const LAND_SITES = [
 {id:'A',pos:{x:398,y:296},radius:35,role:'central damage'},
 {id:'B',pos:{x:939,y:306},radius:35,role:'eastern bend, control'},
 {id:'C',pos:{x:420,y:515},radius:35,role:'western bend, splash'},
 {id:'D',pos:{x:805,y:514},radius:35,role:'lower crossfire, support'},
 {id:'E',pos:{x:84,y:269},radius:32,role:'early interception'},
 {id:'F',pos:{x:1162,y:332},radius:34,role:'eastern hairpin flank'},
 {id:'G',pos:{x:100,y:540},radius:35,role:'western hairpin flank'},
 {id:'H',pos:{x:1135,y:678},radius:35,role:'last chance'},
 {id:'I',pos:{x:845,y:292},radius:35,role:'north-mid crossfire'},
 {id:'J',pos:{x:550,y:516},radius:35,role:'west-mid crossfire'},
] as const;

/** Alternative water pads; they are not claimed as simultaneous placements. */
export const WATER_SITES = [
 {id:'W1',pos:{x:635,y:295},radius:24,role:'pond center'},
 {id:'W2',pos:{x:598,y:295},radius:22,role:'pond west'},
 {id:'W3',pos:{x:686,y:295},radius:22,role:'pond east'},
] as const;

function assert(ok:boolean,message:string):void {if(!ok)throw new Error(message);}
function cross(a:Vec,b:Vec,c:Vec):number {
 return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
function touch(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
 const eps=1e-7;
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 if(abC*abD< -eps&&cdA*cdB< -eps)return true;
 const within=(p:Vec,q:Vec,r:Vec)=>p.x>=Math.min(q.x,r.x)-eps&&p.x<=Math.max(q.x,r.x)+eps&&p.y>=Math.min(q.y,r.y)-eps&&p.y<=Math.max(q.y,r.y)+eps;
 return (Math.abs(abC)<=eps&&within(c,a,b))||(Math.abs(abD)<=eps&&within(d,a,b))||
  (Math.abs(cdA)<=eps&&within(a,c,d))||(Math.abs(cdB)<=eps&&within(b,c,d));
}
function segmentDistance(a:Vec,b:Vec,c:Vec,d:Vec):number {
 if(touch(a,b,c,d))return 0;
 return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
function polygonEdges(poly:Vec[]):[Vec,Vec][] {
 return poly.map((p,i)=>[p,poly[(i+1)%poly.length]]);
}
function shorelineDistance(p:Vec,poly:Vec[]):number {
 return Math.min(...polygonEdges(poly).map(([a,b])=>distanceToSegment(p,a,b)));
}
function polygonRoadDistance(poly:Vec[],lane:Vec[]):number {
 let clearance=Infinity;
 for(let i=1;i<lane.length;i++){
  if(pointInPolygon(lane[i-1],poly)||pointInPolygon(lane[i],poly))return 0;
  for(const [a,b] of polygonEdges(poly))clearance=Math.min(clearance,segmentDistance(lane[i-1],lane[i],a,b));
 }
 return clearance;
}
function roadClearance(p:Vec,lane:Vec[]):number {
 let result=Infinity;
 for(let i=1;i<lane.length;i++)result=Math.min(result,distanceToSegment(p,lane[i-1],lane[i]));
 return result;
}
function validatePolygon(poly:Vec[],id:string):void {
 assert(poly.length>=3,`${id}: at least three vertices required`);
 for(const [i,p] of poly.entries()){
  assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720,`${id}[${i}]: outside world`);
  assert(distance(p,poly[(i+1)%poly.length])>0.01,`${id}[${i}]: duplicate/zero edge`);
 }
 const edges=polygonEdges(poly);
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
  if(j===i+1||(i===0&&j===edges.length-1))continue;
  assert(!touch(...edges[i],...edges[j]),`${id}: self intersection ${i} / ${j}`);
 }
}

export interface GeometryReport {
 mapId:string;valid:true;world:[1280,720];laneCount:number;vertexCount:number;
 pathWidth:number;lengthPixels:number;turnbacks:number;
 minSegmentLength:number;polygonRoadClearance:number;
 slowTransitSeconds:number;fastTransitSeconds:number;
 safeLandSites:{id:string;roadClearance:number;polygonClearance:number}[];
 safeWaterSites:{id:string;shoreClearance:number}[];
}

export function analyzeGeometry():GeometryReport {
 const map=getMap(),lane=map.lanes[0];
 assert(map.id==='lantern-garden'&&map.lanes.length===1,'Expected exactly one lantern-garden lane');
 assert(map.pathWidth>=42&&map.pathWidth<=58,'Road width must support readable enemies and spacious pads');
 assert(lane.length>=12,'Path is too short / has insufficient bends');
 const lengths:number[]=[];
 for(const [i,p] of lane.entries()){
  assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720,`lane[${i}] outside world`);
  if(i>0){const n=distance(lane[i-1],p);assert(n>=20,`lane[${i}] short or zero segment`);lengths.push(n);}
 }
 assert(lane[0].x===0&&lane[lane.length-1].x===1280,'Lane endpoints must be visible at left and right edges');
 let last=0,turnbacks=0;
 for(let i=1;i<lane.length;i++){
  const dx=lane[i].x-lane[i-1].x,sign=Math.sign(dx);
  if(sign!==0&&last!==0&&sign!==last)turnbacks++;
  if(sign!==0)last=sign;
 }
 assert(turnbacks===2,'The layout must have exactly two broad internal reversals');
 const polygons=[...map.water.map((poly,i)=>({poly,id:`water${i}`})),...map.blocked.map((poly,i)=>({poly,id:`blocked${i}`}))];
 let polygonRoadClearance=Infinity;
 for(const {poly,id} of polygons){
  validatePolygon(poly,id);
  const clearance=polygonRoadDistance(poly,lane);
  assert(clearance>map.pathWidth/2+3,`${id} intersects road / has less than 3px visual gap`);
  polygonRoadClearance=Math.min(clearance,polygonRoadClearance);
 }
 const safeLandSites:GeometryReport['safeLandSites']=[];
 for(const site of LAND_SITES){
  const {pos,radius,id}=site;
  assert(pos.x>=radius&&pos.x<=1280-radius&&pos.y>=radius&&pos.y<=720-radius,`${id}: footprint leaves world`);
  const route=roadClearance(pos,lane);
  assert(route>=map.pathWidth/2+radius+2,`${id}: tower footprint intrudes on road (${route.toFixed(1)})`);
  let polygonClearance=Infinity;
  for(const {poly} of polygons){
   const n=pointInPolygon(pos,poly)?0:shorelineDistance(pos,poly);
   polygonClearance=Math.min(n,polygonClearance);
  }
  assert(polygonClearance>=radius+2,`${id}: dry footprint overlaps pond / planter`);
  safeLandSites.push({id,roadClearance:+route.toFixed(2),polygonClearance:+polygonClearance.toFixed(2)});
 }
 for(let i=0;i<LAND_SITES.length;i++)for(let j=i+1;j<LAND_SITES.length;j++){
  const a=LAND_SITES[i],b=LAND_SITES[j];
  assert(distance(a.pos,b.pos)>=a.radius+b.radius+4,`${a.id}/${b.id}: candidate tower footprints overlap`);
 }
 const safeWaterSites:GeometryReport['safeWaterSites']=[];
 for(const site of WATER_SITES){
  const {id,pos,radius}=site;
  const p=map.water.find(poly=>pointInPolygon(pos,poly)&&shorelineDistance(pos,poly)>=radius+2);
  assert(Boolean(p),`${id}: water tower cannot fit wholly inside water`);
  assert(roadClearance(pos,lane)>map.pathWidth/2+radius+2,`${id}: water tower overlaps road`);
  safeWaterSites.push({id,shoreClearance:+shorelineDistance(pos,p!).toFixed(2)});
 }
 const length=laneLength(lane);
 assert(length>=2800,'Path too short to warn players in time');
 return {
  mapId:map.id,valid:true,world:[1280,720],laneCount:map.lanes.length,
  vertexCount:lane.length,pathWidth:map.pathWidth,lengthPixels:+length.toFixed(2),
  turnbacks,minSegmentLength:+Math.min(...lengths).toFixed(2),
  polygonRoadClearance:+polygonRoadClearance.toFixed(2),
  // Unmodified base speeds: scarlet 52 px/s, lemon 115 px/s.
  slowTransitSeconds:+(length/52).toFixed(2),fastTransitSeconds:+(length/115).toFixed(2),
  safeLandSites,safeWaterSites,
 };
}

// Executable machine-readable analyzer, independent of the unfinished engine.
if(process.argv[1]?.replaceAll('\\','/').endsWith('/lantern-garden/geometry.ts')){
 try{process.stdout.write(JSON.stringify(analyzeGeometry(),null,2)+'\n');}
 catch(error){process.stderr.write(String(error)+'\n');process.exitCode=1;}
}
