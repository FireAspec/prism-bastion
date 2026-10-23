import type {MapDef,Vec} from '../../../src/contracts';
import {getMap} from '../../../src/content/maps/old-aqueduct';

export const positions={
 westHigh:{x:210,y:147},westLow:{x:272,y:407},
 archOneHigh:{x:490,y:188},archOneLow:{x:535,y:455},
 narrowsHigh:{x:666,y:156},narrowsLow:{x:683,y:365},
 crossingBeacon:{x:772,y:394},archTwoHigh:{x:830,y:209},archTwoLow:{x:829,y:449},
 eastHigh:{x:1028,y:305},eastLow:{x:1086,y:515},
 reservoirWest:{x:1040,y:152},reservoirEast:{x:1131,y:166},
} as const satisfies Record<string,Vec>;
export type PositionKey=keyof typeof positions;
type Segment=[Vec,Vec];
const len=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const bounds=(p:Vec)=>p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
const edges=(p:Vec[]):Segment[]=>p.map((v,i)=>[v,p[(i+1)%p.length]]);
const laneEdges=(p:Vec[]):Segment[]=>p.slice(1).map((v,i)=>[p[i],v]);
const nearSegment=(p:Vec,[a,b]:Segment)=>{
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
const on=(p:Vec,a:Vec,b:Vec)=>Math.abs(cross(a,b,p))<1e-6&&p.x>=Math.min(a.x,b.x)-1e-6&&p.x<=Math.max(a.x,b.x)+1e-6&&p.y>=Math.min(a.y,b.y)-1e-6&&p.y<=Math.max(a.y,b.y)+1e-6;
const intersects=(a:Vec,b:Vec,c:Vec,d:Vec)=>{
 const v=cross(a,b,c),w=cross(a,b,d),u=cross(c,d,a),z=cross(c,d,b);
 return ((v>1e-6&&w< -1e-6||v< -1e-6&&w>1e-6)&&(u>1e-6&&z< -1e-6||u< -1e-6&&z>1e-6))||on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);
};
const segmentGap=(a:Segment,b:Segment)=>intersects(...a,...b)?0:Math.min(nearSegment(a[0],b),nearSegment(a[1],b),nearSegment(b[0],a),nearSegment(b[1],a));
const inside=(p:Vec,poly:Vec[])=>{
 if(edges(poly).some(e=>nearSegment(p,e)<1e-6))return true;
 let hit=0;
 for(const [a,b] of edges(poly))if((a.y>p.y)!==(b.y>p.y))if(p.x<a.x+(b.x-a.x)*(p.y-a.y)/(b.y-a.y))hit++;
 return hit%2===1;
};
const polyGap=(p:Vec,poly:Vec[])=>inside(p,poly)?0:Math.min(...edges(poly).map(e=>nearSegment(p,e)));
export function canBuild(map:MapDef,p:Vec,radius:number,placement:'land'|'water'='land'):boolean{
 if(radius<=0||!Number.isFinite(radius)||p.x<radius||p.x>1280-radius||p.y<radius||p.y>720-radius)return false;
 const road=Math.min(...map.lanes.flatMap(l=>laneEdges(l).map(e=>nearSegment(p,e))));
 if(road<map.pathWidth/2+radius-1e-6)return false;
 if(map.blocked.some(poly=>polyGap(p,poly)<radius-1e-6))return false;
 if(placement==='land')return map.water.every(poly=>polyGap(p,poly)>=radius-1e-6);
 return map.water.some(poly=>inside(p,poly)&&edges(poly).every(e=>nearSegment(p,e)>=radius-1e-6));
}
export interface GeometryReport{
 ok:boolean;errors:string[];pathLengths:number[];passageSeconds:Record<string,number>;
 dryCells:number;waterCells:number;siteValidity:Record<PositionKey,boolean>;minimumObstacleGap:number;
}
export function analyzeGeometry(map:MapDef):GeometryReport{
 const errors:string[]=[];
 if(map.lanes.length<1||map.lanes.length>3)errors.push('Lane count out of bounds');
 if(map.pathWidth<48||map.pathWidth>90)errors.push('Path width unsuitable');
 const pathLengths=map.lanes.map((lane,i)=>{
  if(lane.length<2||lane.some(v=>!bounds(v)))errors.push(`Lane ${i} out of bounds`);
  const segments=laneEdges(lane);
  if(segments.some(([a,b])=>len(a,b)<1e-6))errors.push(`Lane ${i} zero segment`);
  for(let a=0;a<segments.length;a++)for(let b=a+2;b<segments.length;b++)if(intersects(...segments[a],...segments[b]))errors.push(`Lane ${i} self-crosses`);
  if(!lane[0]||![0,1280].includes(lane[0].x)&&![0,720].includes(lane[0].y))errors.push(`Lane ${i} hidden entrance`);
  const end=lane.at(-1);
  if(!end||![0,1280].includes(end.x)&&![0,720].includes(end.y))errors.push(`Lane ${i} hidden exit`);
  return segments.reduce((n,[a,b])=>n+len(a,b),0);
 });
 let minimumObstacleGap=Infinity;
 for(const [kind,polys] of [['blocked',map.blocked],['water',map.water]] as const)for(let i=0;i<polys.length;i++){
  const poly=polys[i];
  if(poly.length<3||poly.some(p=>!bounds(p)))errors.push(`${kind} ${i} invalid bounds`);
  const area=Math.abs(poly.reduce((n,p,j)=>n+p.x*poly[(j+1)%poly.length].y-p.y*poly[(j+1)%poly.length].x,0))/2;
  if(area<100)errors.push(`${kind} ${i} degeneracy`);
  const outline=edges(poly);
  for(let a=0;a<outline.length;a++)for(let b=a+2;b<outline.length;b++)if(!(a===0&&b===outline.length-1)&&intersects(...outline[a],...outline[b]))errors.push(`${kind} ${i} self-crossing`);
  for(const lane of map.lanes)for(const segment of laneEdges(lane)){
   const gap=Math.min(...outline.map(e=>segmentGap(segment,e)),inside(segment[0],poly)?0:Infinity,inside(segment[1],poly)?0:Infinity);
   minimumObstacleGap=Math.min(minimumObstacleGap,gap);
   if(gap<map.pathWidth/2-1e-6)errors.push(`${kind} ${i} overlaps road`);
  }
 }
 const siteValidity={} as Record<PositionKey,boolean>;
 for(const name of Object.keys(positions) as PositionKey[]){
  const ok=canBuild(map,positions[name],24,name.startsWith('reservoir')?'water':'land');siteValidity[name]=ok;
  if(!ok)errors.push(`Invalid site ${name}`);
 }
 let dryCells=0,waterCells=0;
 for(let x=24;x<=1256;x+=40)for(let y=24;y<=696;y+=40){
  if(canBuild(map,{x,y},24))dryCells++;
  if(canBuild(map,{x,y},24,'water'))waterCells++;
 }
 if(dryCells<80||waterCells<8)errors.push('Insufficient dry/water cells');
 if(pathLengths.some(x=>x<1100))errors.push('Too little reaction time');
 const distance=pathLengths[0]??0;
 return {ok:errors.length===0,errors:[...new Set(errors)],pathLengths,
  passageSeconds:{scarlet:Math.round(distance/52*100)/100,lemon:Math.round(distance/115*100)/100,'boss-carapace':Math.round(distance/18*100)/100},
  dryCells,waterCells,siteValidity,minimumObstacleGap};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/check-geometry.ts')){
 const report=analyzeGeometry(getMap());process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(!report.ok)process.exitCode=1;
}
