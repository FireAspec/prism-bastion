import {pathToFileURL} from 'node:url';
import type {MapDef,Vec} from '../../../src/contracts';
import {getMap} from '../../../src/content/maps/tidal-docks';

export type Site={id:string;pos:Vec;radius:number;role:string};
export const LAND_SITES:readonly Site[]=[
  {id:'W1',pos:{x:244,y:362},radius:24,role:'entry flanking'},
  {id:'W2',pos:{x:325,y:345},radius:24,role:'west crossfire'},
  {id:'W3',pos:{x:312,y:412},radius:24,role:'west fallback'},
  {id:'C1',pos:{x:612,y:356},radius:24,role:'central turn'},
  {id:'E1',pos:{x:815,y:349},radius:24,role:'east crossfire'},
  {id:'E3',pos:{x:758,y:352},radius:24,role:'east reserve'},
  {id:'E2',pos:{x:1032,y:362},radius:24,role:'exit strongpoint'},
  {id:'E4',pos:{x:976,y:392},radius:24,role:'exit fallback'},
  {id:'S1',pos:{x:558,y:526},radius:24,role:'southern artillery'},
  {id:'S2',pos:{x:626,y:526},radius:24,role:'southern reserve'},
  {id:'G1',pos:{x:85,y:444},radius:24,role:'entry emergency'},
];
export const WATER_SITES:readonly Site[]=[
  {id:'T1',pos:{x:560,y:257},radius:26,role:'future sheltered harbour'},
  {id:'T2',pos:{x:280,y:657},radius:26,role:'future southern basin'},
  {id:'T3',pos:{x:900,y:84},radius:26,role:'future northern basin'},
];

const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const edges=(poly:Vec[]):[Vec,Vec][]=>(poly.map((p,i)=>[p,poly[(i+1)%poly.length]]));
function inside(p:Vec,poly:Vec[]):boolean {
  let yes=false;
  for(const [a,b] of edges(poly)) if((a.y>p.y)!==(b.y>p.y)&&p.x<a.x+(p.y-a.y)*(b.x-a.x)/(b.y-a.y))yes=!yes;
  return yes;
}
function pointSeg(p:Vec,a:Vec,b:Vec):number {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return dist(p,{x:a.x+t*dx,y:a.y+t*dy});
}
function intersects(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
  const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
  const on=(p:Vec,s:Vec,e:Vec)=>Math.abs(cross(s,e,p))<1e-8&&p.x>=Math.min(s.x,e.x)-1e-8&&p.x<=Math.max(s.x,e.x)+1e-8&&p.y>=Math.min(s.y,e.y)-1e-8&&p.y<=Math.max(s.y,e.y)+1e-8;
  return (x*y<0&&u*v<0)||on(c,a,b)||on(d,a,b)||on(a,c,d)||on(b,c,d);
}
function segSeg(a:Vec,b:Vec,c:Vec,d:Vec):number {
  return intersects(a,b,c,d)?0:Math.min(pointSeg(a,c,d),pointSeg(b,c,d),pointSeg(c,a,b),pointSeg(d,a,b));
}
function pointPoly(p:Vec,poly:Vec[]):number {
  return inside(p,poly)?0:Math.min(...edges(poly).map(([a,b])=>pointSeg(p,a,b)));
}
function segPoly(a:Vec,b:Vec,poly:Vec[]):number {
  return inside(a,poly)||inside(b,poly)?0:Math.min(...edges(poly).map(([c,d])=>segSeg(a,b,c,d)));
}
function area(poly:Vec[]):number {
  return Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a.x*b.y-b.x*a.y;},0))/2;
}

export type GeometryReport={errors:string[];lengthPx:number;traversalSecondsAt60Px:number;
  traversalSecondsAt120Px:number;waterFractionSampled:number;landSites:number;
  waterSites:number;minLaneToWaterPx:number;minLaneToBlockedPx:number;};

export function analyzeMapGeometry(map:MapDef=getMap()):GeometryReport {
  const errors:string[]=[];
  const bounds=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
  for(const [name,polys] of [['water',map.water],['blocked',map.blocked]] as const){
    for(const [i,poly] of polys.entries()){
      if(poly.length<3||poly.some(p=>!bounds(p)))errors.push(`${name}[${i}]: invalid bounds`);
      if(poly.length<3)continue;
      if(area(poly)<12)errors.push(`${name}[${i}]: zero area`);
      for(const [j,[a,b]] of edges(poly).entries()){
        if(dist(a,b)<1e-8)errors.push(`${name}[${i}]: zero edge`);
        for(const [k,[c,d]] of edges(poly).entries()){
          if(k<=j+1||(j===0&&k===poly.length-1))continue;
          if(intersects(a,b,c,d))errors.push(`${name}[${i}]: self-crossing`);
        }
      }
    }
  }
  if(map.lanes.length!==1)errors.push('single continuous land lane expected');
  if(map.pathWidth!==52)errors.push('unexpected path width');
  let length=0,minWater=Infinity,minBlocked=Infinity;
  for(const lane of map.lanes){
    if(lane.length<2||lane.some(p=>!bounds(p)))errors.push('invalid lane');
    for(let i=1;i<lane.length;i++){
      const a=lane[i-1],b=lane[i],segment=dist(a,b);
      if(segment<10)errors.push(`degenerate segment ${i-1}`);
      length+=segment;
      for(const p of map.water)minWater=Math.min(minWater,segPoly(a,b,p));
      for(const p of map.blocked)minBlocked=Math.min(minBlocked,segPoly(a,b,p));
    }
  }
  if(minWater<map.pathWidth/2+3)errors.push('water touches the dry route');
  if(minBlocked<map.pathWidth/2+3)errors.push('blocked region touches route');
  if(length<1450||length>3000)errors.push('route length out of expected range');
  if(map.lanes[0]?.[0]?.x!==0||map.lanes[0]?.at(-1)?.x!==1280)errors.push('invisible entrance or exit');
  const roadDistance=(s:Site)=>Math.min(...map.lanes.flatMap(l=>l.slice(1).map((b,i)=>pointSeg(s.pos,l[i],b))));
  for(const s of LAND_SITES){
    if(s.pos.x-s.radius<0||s.pos.y-s.radius<0||s.pos.x+s.radius>1280||s.pos.y+s.radius>720)errors.push(`${s.id}: outside bounds`);
    if(roadDistance(s)<map.pathWidth/2+s.radius+4)errors.push(`${s.id}: path overlap`);
    if(map.water.some(p=>pointPoly(s.pos,p)<s.radius+4))errors.push(`${s.id}: wet site`);
    if(map.blocked.some(p=>pointPoly(s.pos,p)<s.radius+4))errors.push(`${s.id}: blocked site`);
    if(roadDistance(s)>170)errors.push(`${s.id}: too far to defend`);
  }
  for(const s of WATER_SITES){
    if(!map.water.some(p=>inside(s.pos,p)&&Math.min(...edges(p).map(([a,b])=>pointSeg(s.pos,a,b)))>s.radius+4))errors.push(`${s.id}: insufficient water footprint`);
    if(roadDistance(s)<map.pathWidth/2+s.radius+4)errors.push(`${s.id}: touches route`);
  }
  let wet=0,total=0;
  for(let y=12;y<720;y+=24)for(let x=12;x<1280;x+=24){total++;if(map.water.some(p=>inside({x,y},p)))wet++;}
  if(wet/total<.37)errors.push('water area below estuary minimum');
  return {errors,lengthPx:length,traversalSecondsAt60Px:length/60,traversalSecondsAt120Px:length/120,
    waterFractionSampled:wet/total,landSites:LAND_SITES.length,waterSites:WATER_SITES.length,
    minLaneToWaterPx:minWater,minLaneToBlockedPx:minBlocked};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=analyzeMapGeometry();process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(result.errors.length)process.exitCode=1;
}
