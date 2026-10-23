import type {Vec} from '../../../src/contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';
import {BELL_FOUNDRY_SITES,getMap} from '../../../src/content/maps/bell-foundry';

type Edge=[Vec,Vec];
const edges=(poly:Vec[],closed=false):Edge[]=>poly.slice(1).map((p,i)=>[poly[i],p] as Edge).concat(closed?[[poly.at(-1)!,poly[0]] as Edge]:[]);
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function intersects([a,b]:Edge,[c,d]:Edge):boolean {
  const e=1e-7,p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);
  if(Math.abs(p)<e&&Math.abs(q)<e&&Math.abs(r)<e&&Math.abs(s)<e)
    return Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+e
      &&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+e;
  return p*q<=e&&r*s<=e;
}
function edgeGap(s:Edge,t:Edge):number {
  if(intersects(s,t))return 0;
  return Math.min(distanceToSegment(s[0],...t),distanceToSegment(s[1],...t),distanceToSegment(t[0],...s),distanceToSegment(t[1],...s));
}
function polygonGap(lane:Vec[],polygon:Vec[]):number {
  if(lane.some(p=>pointInPolygon(p,polygon)))return 0;
  return Math.min(...edges(lane).flatMap(s=>edges(polygon,true).map(t=>edgeGap(s,t))));
}
const boundary=(p:Vec,polygon:Vec[])=>Math.min(...edges(polygon,true).map(e=>distanceToSegment(p,...e)));
const bounds=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
export type GeometryReport={ok:boolean;errors:string[];laneLengths:number[];secondsAt132:number[];secondsAt18:number[];minTerrainGap:number;landPads:number;waterPads:number;hairpins:number};

export function analyzeBellFoundry():GeometryReport {
  const map=getMap(),errors:string[]=[];
  if(map.lanes.length!==3)errors.push('Three separately marked lanes are required');
  if(map.pathWidth!==46)errors.push('Unexpected tram width');
  for(const [i,lane] of map.lanes.entries()){
    if(lane.length<2||lane.some(p=>!bounds(p)))errors.push(`Invalid lane ${i}`);
    if(edges(lane).some(([a,b])=>distance(a,b)<=0))errors.push(`Zero segment lane ${i}`);
    if(![0,1280].includes(lane[0].x)||lane.at(-1)?.x!==0||lane.at(-1)?.y!==579)errors.push(`Invisible lane endpoint ${i}`);
    if(laneLength(lane)<1200)errors.push(`Insufficient enemy reaction time lane ${i}`);
  }
  const horizontal=edges(map.lanes[0]).filter(([a,b])=>a.x!==b.x).map(([a,b])=>Math.sign(b.x-a.x));
  const hairpins=horizontal.slice(1).filter((sign,i)=>sign!==horizontal[i]).length;
  if(hairpins!==3)errors.push(`Expected 3 reversals; found ${hairpins}`);
  if(edges(map.lanes[0]).filter(([a,b])=>a.x===b.x).some(([a,b])=>Math.abs(a.y-b.y)<120))errors.push('Shallow hairpin');
  const terrain=[...map.blocked,...map.water];let minTerrainGap=Infinity;
  for(const [i,poly] of terrain.entries()){
    if(poly.length<3||poly.some(p=>!bounds(p)))errors.push(`Invalid terrain polygon ${i}`);
    const area=edges(poly,true).reduce((s,[a,b])=>s+a.x*b.y-b.x*a.y,0)/2;
    if(Math.abs(area)<1)errors.push(`Zero-area polygon ${i}`);
    const contour=edges(poly,true);
    for(let a=0;a<contour.length;a++)for(let b=a+2;b<contour.length;b++){
      if(a===0&&b===contour.length-1)continue;
      if(intersects(contour[a],contour[b]))errors.push(`Self-crossing polygon ${i}`);
    }
  }
  for(const [i,lane] of map.lanes.entries())for(const [j,poly] of terrain.entries()){
    const clearance=polygonGap(lane,poly)-map.pathWidth/2;
    minTerrainGap=Math.min(minTerrainGap,clearance);
    if(clearance<2)errors.push(`Terrain ${j} intrudes on lane ${i}`);
  }
  for(let i=0;i<terrain.length;i++)for(let j=i+1;j<terrain.length;j++){
    if(terrain[i].some(p=>pointInPolygon(p,terrain[j]))||terrain[j].some(p=>pointInPolygon(p,terrain[i]))
      ||edges(terrain[i],true).some(e=>edges(terrain[j],true).some(f=>intersects(e,f))))errors.push(`Overlapping polygons ${i}/${j}`);
  }
  const sites=new Set<string>();
  for(const s of BELL_FOUNDRY_SITES){
    if(sites.has(s.id))errors.push(`Duplicate site ${s.id}`);sites.add(s.id);
    const {pos:p,radius:r}=s;
    if(!bounds({x:p.x-r,y:p.y-r})||!bounds({x:p.x+r,y:p.y+r}))errors.push(`Off-world site ${s.id}`);
    for(const lane of map.lanes)if(Math.min(...edges(lane).map(e=>distanceToSegment(p,...e)))<r+map.pathWidth/2+2)errors.push(`Site ${s.id} intersects tram`);
    if(s.role==='water'){
      if(!map.water.some(poly=>pointInPolygon(p,poly)&&boundary(p,poly)>=r+2))errors.push(`Water footprint not fully wet ${s.id}`);
      if(map.blocked.some(poly=>pointInPolygon(p,poly)||boundary(p,poly)<r+2))errors.push(`Water site under roof ${s.id}`);
    }else if(terrain.some(poly=>pointInPolygon(p,poly)||boundary(p,poly)<r+2))errors.push(`Land site under obstruction ${s.id}`);
  }
  for(let i=0;i<BELL_FOUNDRY_SITES.length;i++)for(let j=i+1;j<BELL_FOUNDRY_SITES.length;j++){
    const a=BELL_FOUNDRY_SITES[i],b=BELL_FOUNDRY_SITES[j];
    if(distance(a.pos,b.pos)<a.radius+b.radius+2)errors.push(`Sites ${a.id}/${b.id} conflict`);
  }
  const lengths=map.lanes.map(l=>Math.round(laneLength(l)*10)/10);
  const report={ok:!errors.length,errors,laneLengths:lengths,
    secondsAt132:lengths.map(n=>Math.round(n/132*10)/10),secondsAt18:lengths.map(n=>Math.round(n/18*10)/10),
    minTerrainGap:Math.round(minTerrainGap*10)/10,landPads:BELL_FOUNDRY_SITES.filter(s=>s.role==='land').length,
    waterPads:BELL_FOUNDRY_SITES.filter(s=>s.role==='water').length,hairpins};
  if(report.landPads<10||report.waterPads<2)report.errors.push('Insufficient pad diversity');
  report.ok=report.errors.length===0;return report;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/bell-foundry/check.ts')){
  const report=analyzeBellFoundry();process.stdout.write(`${JSON.stringify(report,null,2)}\n`);if(!report.ok)process.exitCode=1;
}
