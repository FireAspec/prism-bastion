import {getMap} from '../../../src/content/maps/orchard-wall';
import {distance,distanceToSegment,pointInPolygon,laneLength} from '../../../src/contracts/geometry';
import type {MapDef,Vec} from '../../../src/contracts';

export interface Site {id:string;pos:Vec;radius:number;terrain:'land'|'water';role:string}
export const SITES:Site[]=[
 {id:'west-inner',pos:{x:400,y:316},radius:28,terrain:'land',role:'western overlap'},
 {id:'west-south',pos:{x:219,y:463},radius:28,terrain:'land',role:'first bend'},
 {id:'central',pos:{x:615,y:356},radius:28,terrain:'land',role:'shared central crossfire'},
 {id:'central-reserve',pos:{x:636,y:462},radius:28,terrain:'land',role:'support'},
 {id:'east-inner',pos:{x:850,y:325},radius:28,terrain:'land',role:'eastern overlap'},
 {id:'east-south',pos:{x:1050,y:460},radius:28,terrain:'land',role:'second bend'},
 {id:'east-reserve',pos:{x:778,y:479},radius:28,terrain:'land',role:'long range'},
 {id:'south-reserve',pos:{x:500,y:505},radius:28,terrain:'land',role:'fallback'},
 {id:'exit-reserve',pos:{x:1177,y:410},radius:28,terrain:'land',role:'final screen'},
 {id:'future-water-west',pos:{x:310,y:675},radius:24,terrain:'water',role:'future water tower'},
 {id:'future-water-east',pos:{x:970,y:675},radius:24,terrain:'water',role:'future water tower'},
];

const EPS=1e-7;
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(p:Vec,a:Vec,b:Vec)=>Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
export function intersects(a:Vec,b:Vec,c:Vec,d:Vec):boolean{
 const p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);
 return ((p>EPS&&q<-EPS)||(p<-EPS&&q>EPS))&&((r>EPS&&s<-EPS)||(r<-EPS&&s>EPS))||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b);
}
const area=(poly:Vec[])=>Math.abs(poly.reduce((v,p,i)=>{const n=poly[(i+1)%poly.length];return v+p.x*n.y-n.x*p.y;},0))/2;
function distanceToPoly(p:Vec,poly:Vec[]):number{
 if(pointInPolygon(p,poly)||poly.some((v,i)=>onSegment(p,v,poly[(i+1)%poly.length])))return 0;
 return Math.min(...poly.map((v,i)=>distanceToSegment(p,v,poly[(i+1)%poly.length])));
}
function segmentToPoly(a:Vec,b:Vec,poly:Vec[]):number{
 if(pointInPolygon(a,poly)||pointInPolygon(b,poly))return 0;
 let d=Infinity;
 for(let i=0;i<poly.length;i++){
  const c=poly[i],e=poly[(i+1)%poly.length];if(intersects(a,b,c,e))return 0;
  d=Math.min(d,distanceToSegment(a,c,e),distanceToSegment(b,c,e),distanceToSegment(c,a,b),distanceToSegment(e,a,b));
 }return d;
}
function polygonSimple(poly:Vec[]):boolean{
 for(let i=0;i<poly.length;i++)for(let j=i+1;j<poly.length;j++){
  if(j===i+1||(i===0&&j===poly.length-1))continue;
  if(intersects(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))return false;
 }return true;
}

export function analyzeOrchardWall(map:MapDef=getMap()){
 const errors:string[]=[],crossings:string[]=[];
 const bounded=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
 const lane=map.lanes[0]??[],width=map.pathWidth,planned=new Set(['6/13','19/26']);
 if(map.lanes.length!==1||width!==42)errors.push('Route count or width mismatch');
 if(lane.length<2||lane[0].x!==0||lane[lane.length-1].x!==1280)errors.push('Missing visible entrance/exit');
 for(const [i,p] of lane.entries()){
  if(!bounded(p))errors.push(`Lane point ${i} out of world`);
  if(i>0&&distance(p,lane[i-1])<EPS)errors.push(`Zero segment ${i}`);
 }
 for(let i=1;i<lane.length;i++)for(let j=i+2;j<lane.length;j++)if(intersects(lane[i-1],lane[i],lane[j-1],lane[j])){
  const id=`${i}/${j}`;crossings.push(id);if(!planned.has(id))errors.push(`Unexpected crossing ${id}`);
 }
 for(const id of planned)if(!crossings.includes(id))errors.push(`Missing marked crossing ${id}`);
 for(const [name,polys] of [['blocked',map.blocked],['water',map.water]] as const)polys.forEach((poly,n)=>{
  if(poly.length<3||area(poly)<40||!polygonSimple(poly))errors.push(`${name} ${n} non-simple or tiny`);
  poly.forEach((p,i)=>{if(!bounded(p)||distance(p,poly[(i+1)%poly.length])<EPS)errors.push(`${name} ${n} invalid vertex ${i}`);});
  for(let i=1;i<lane.length;i++)if(segmentToPoly(lane[i-1],lane[i],poly)<width/2-EPS){errors.push(`${name} ${n} overlaps road at ${i}`);break;}
 });
 const sites=SITES.map(site=>{
  const {pos,radius,terrain}=site;
  const roadMargin=Math.min(...lane.slice(1).map((p,i)=>distanceToSegment(pos,lane[i],p)-width/2-radius));
  const blockedMargin=Math.min(...map.blocked.map(p=>distanceToPoly(pos,p)-radius));
  const waterMargin=Math.min(...map.water.map(p=>distanceToPoly(pos,p)-radius));
  const inWater=map.water.some(poly=>pointInPolygon(pos,poly)&&Math.min(...poly.map((p,i)=>distanceToSegment(pos,p,poly[(i+1)%poly.length])))>=radius);
  const inside=pos.x>=radius&&pos.x<=1280-radius&&pos.y>=radius&&pos.y<=720-radius;
  const safe=inside&&roadMargin>=-EPS&&blockedMargin>=-EPS&&(terrain==='land'?waterMargin>=-EPS:inWater);
  if(!safe)errors.push(`Unsafe site ${site.id}: road=${roadMargin.toFixed(1)} blocked=${blockedMargin.toFixed(1)} water=${waterMargin.toFixed(1)}`);
  return {id:site.id,terrain,role:site.role,safe,roadMargin:Math.round(roadMargin*10)/10,blockedMargin:Math.round(blockedMargin*10)/10};
 });
 if(sites.filter(s=>s.safe&&s.terrain==='land').length<7||sites.filter(s=>s.safe&&s.terrain==='water').length<2)errors.push('Insufficient land/water slots');
 const byId=new Map(SITES.map(s=>[s.id,s]));
 for(const composition of [['west-inner','central','east-inner','east-south'],['west-south','central','east-reserve','east-south']])
  for(let i=0;i<composition.length;i++)for(let j=i+1;j<composition.length;j++){
   const a=byId.get(composition[i])!,b=byId.get(composition[j])!;
   if(distance(a.pos,b.pos)<a.radius+b.radius+6)errors.push(`Composition overlap ${a.id}/${b.id}`);
  }
 const length=laneLength(lane);if(length<2200)errors.push('Insufficient runway');
 return {id:map.id,valid:errors.length===0,errors,world:[1280,720],laneLength:Math.round(length),pathWidth:width,crossings,sites};
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){const result=analyzeOrchardWall();console.log(JSON.stringify(result,null,2));if(!result.valid)process.exitCode=1;}
