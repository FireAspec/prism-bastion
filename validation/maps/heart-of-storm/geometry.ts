/** Deterministic independent geometry audit:
 *   node --import tsx validation/maps/heart-of-storm/geometry.ts
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {Vec} from '../../../src/contracts';
import {WORLD} from '../../../src/contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';
import {getMap} from '../../../src/content/maps/heart-of-storm';

type Site = {id:string;x:number;y:number;radius:number;name:string;role:string};
const directory=new URL('./',import.meta.url);
const sites=JSON.parse(readFileSync(fileURLToPath(new URL('sites.json',directory)),'utf8')) as
  {land:Site[];water:Site[];clearanceMargin:number};
const EPS=1e-7;

function cross(a:Vec,b:Vec,c:Vec):number {
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
function onSegment(p:Vec,a:Vec,b:Vec):boolean {
  return Math.abs(cross(a,b,p))<EPS && p.x>=Math.min(a.x,b.x)-EPS &&
    p.x<=Math.max(a.x,b.x)+EPS && p.y>=Math.min(a.y,b.y)-EPS && p.y<=Math.max(a.y,b.y)+EPS;
}
function intersects(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
  const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
  if(((ab1>EPS&&ab2<-EPS)||(ab1<-EPS&&ab2>EPS)) &&
    ((cd1>EPS&&cd2<-EPS)||(cd1<-EPS&&cd2>EPS)))return true;
  return (Math.abs(ab1)<EPS&&onSegment(c,a,b)) ||
    (Math.abs(ab2)<EPS&&onSegment(d,a,b)) ||
    (Math.abs(cd1)<EPS&&onSegment(a,c,d)) ||
    (Math.abs(cd2)<EPS&&onSegment(b,c,d));
}
function segmentGap(a:Vec,b:Vec,c:Vec,d:Vec):number {
  return intersects(a,b,c,d)?0:Math.min(
    distanceToSegment(a,c,d),distanceToSegment(b,c,d),
    distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
function edges(poly:Vec[]):[Vec,Vec][] {return poly.map((p,i)=>[p,poly[(i+1)%poly.length]]);}
function signedArea(poly:Vec[]):number {
  return poly.reduce((sum,p,i)=>sum+p.x*poly[(i+1)%poly.length].y-poly[(i+1)%poly.length].x*p.y,0)/2;
}
function polygonGap(p:Vec,poly:Vec[]):number {
  return Math.min(...edges(poly).map(([a,b])=>distanceToSegment(p,a,b)));
}
function laneGap(p:Vec,lanes:Vec[][]):number {
  return Math.min(...lanes.flatMap(lane=>lane.slice(1).map((b,i)=>distanceToSegment(p,lane[i],b))));
}
function pathPolygonGap(lane:Vec[],poly:Vec[]):number {
  if(lane.some(v=>pointInPolygon(v,poly)))return 0;
  return Math.min(...lane.slice(1).flatMap((b,i)=>edges(poly).map(([c,d])=>segmentGap(lane[i],b,c,d))));
}

export function analyzeGeometry() {
  const map=getMap(),errors:string[]=[];
  const allPolygons=[...map.blocked.map((p,i)=>({p,id:`blocked[${i}]`})),
    ...map.water.map((p,i)=>({p,id:`water[${i}]`}))];
  const valid=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
    p.x>=0&&p.x<=WORLD.width&&p.y>=0&&p.y<=WORLD.height;
  for(const {p,id} of allPolygons) {
    if(p.length<3||Math.abs(signedArea(p))<10)errors.push(`${id}: degenerate polygon`);
    p.forEach((v,i)=>{if(!valid(v))errors.push(`${id}: point ${i} outside world`);});
    const parts=edges(p);
    parts.forEach(([a,b],i)=>{
      if(distance(a,b)<EPS)errors.push(`${id}: zero polygon edge ${i}`);
      parts.slice(i+1).forEach(([c,d],j)=>{
        const other=i+j+1;
        if(other===i+1||(i===0&&other===parts.length-1))return;
        if(intersects(a,b,c,d))errors.push(`${id}: self-intersection at ${i}/${other}`);
      });
    });
  }
  if(map.lanes.length!==4)errors.push('expected exactly four visible lanes');
  const minPathClearances:number[]=[];
  for(const [i,lane] of map.lanes.entries()) {
    if(lane.length<2)errors.push(`lane ${i}: not enough vertices`);
    lane.forEach((v,k)=>{if(!valid(v))errors.push(`lane ${i}: point ${k} outside world`);});
    lane.slice(1).forEach((v,k)=>{if(distance(v,lane[k])<EPS)errors.push(`lane ${i}: zero segment ${k}`);});
    if(lane[0]?.x!==0)errors.push(`lane ${i}: no left-edge entrance`);
    if(lane.at(-1)?.x!==WORLD.width||lane.at(-1)?.y!==(i%2===0?211:510))
      errors.push(`lane ${i}: wrong visible exit`);
    if(laneLength(lane)<1200)errors.push(`lane ${i}: no response time`);
    const clearance=Math.min(...allPolygons.map(({p})=>pathPolygonGap(lane,p)));
    minPathClearances.push(clearance);
    if(clearance<map.pathWidth/2+2-EPS)
      errors.push(`lane ${i}: a forbidden polygon overlaps the path corridor (${clearance.toFixed(2)} px)`);
  }
  const shared=map.lanes[0]?.slice(7,13)??[];
  const sharedLength=laneLength(shared);
  if(sharedLength<420)errors.push('the last shared trunk is too short');
  map.lanes.forEach((lane,i)=>{
    if(JSON.stringify(lane.slice(7,13))!==JSON.stringify(shared))errors.push(`lane ${i}: common trunk differs`);
  });
  const placementMetrics:{id:string;type:string;pathGap:number;terrainGap:number;radius:number}[]=[];
  for(const [type,list] of [['land',sites.land],['water',sites.water]] as const) {
    for(const site of list) {
      const p={x:site.x,y:site.y},required=site.radius+sites.clearanceMargin;
      if(!valid(p)||!Number.isFinite(site.radius)||site.radius<10)errors.push(`${site.id}: invalid site coordinates or radius`);
      const pathGap=laneGap(p,map.lanes)-map.pathWidth/2;
      const blockedGap=Math.min(...map.blocked.map(poly=>pointInPolygon(p,poly)?-polygonGap(p,poly):polygonGap(p,poly)));
      const waterInside=map.water.filter(poly=>pointInPolygon(p,poly));
      const waterGap=type==='land'
        ?Math.min(...map.water.map(poly=>pointInPolygon(p,poly)?-polygonGap(p,poly):polygonGap(p,poly)))
        :Math.max(0,...waterInside.map(poly=>polygonGap(p,poly)));
      const terrainGap=type==='land'?Math.min(blockedGap,waterGap):Math.min(blockedGap,waterGap);
      if(pathGap+EPS<required)errors.push(`${site.id}: path overlaps footprint (${pathGap.toFixed(2)} < ${required})`);
      if(type==='land'&&terrainGap+EPS<required)errors.push(`${site.id}: forbidden terrain overlaps footprint`);
      if(type==='water'&&(waterInside.length===0||waterGap+EPS<required||blockedGap+EPS<required))
        errors.push(`${site.id}: water-only footprint is not entirely on clear water`);
      if(type==='water'&&laneGap(p,map.lanes)>170)
        errors.push(`${site.id}: starter water tower cannot reach a lane`);
      placementMetrics.push({id:site.id,type,pathGap:+pathGap.toFixed(2),
        terrainGap:+terrainGap.toFixed(2),radius:site.radius});
    }
  }
  if(sites.land.length<8||sites.water.length<2)errors.push('not enough independent land/water strategies');
  return {status:errors.length?'failed':'passed',mapId:map.id,world:WORLD,
    lanes:map.lanes.length,exits:2,paths:map.lanes.map(l=>+laneLength(l).toFixed(2)),
    minPathClearances:minPathClearances.map(v=>+v.toFixed(2)),
    sharedLength:+sharedLength.toFixed(2),
    sharedAt132pxPerSec:+(sharedLength/132).toFixed(2),
    landSites:sites.land.length,waterSites:sites.water.length,sites:placementMetrics,errors};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const report=analyzeGeometry();
  console.log(JSON.stringify(report,null,2));
  if(report.status!=='passed')process.exitCode=1;
}
