import {WORLD,type MapDef,type Vec} from '../../../src/contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';
import {getMap} from '../../../src/content/maps/copper-creek';

export interface Site{id:string;label:string;kind:'land'|'water';pos:Vec;radius:number;purpose:string;}
export const sites:Site[]=[
 {id:'upper',label:'Верхняя застава',kind:'land',pos:{x:203,y:271},radius:36,purpose:'Ранний огонь'},
 {id:'garden',label:'Первый сад',kind:'land',pos:{x:438,y:365},radius:36,purpose:'Охват первой петли'},
 {id:'lower',label:'Нижняя дуга',kind:'land',pos:{x:303,y:518},radius:35,purpose:'Добивание первой петли'},
 {id:'beacon',label:'Фонарная терраса',kind:'land',pos:{x:445,y:481},radius:31,purpose:'Поддержка'},
 {id:'ridge',label:'Верхний гребень',kind:'land',pos:{x:700,y:93},radius:34,purpose:'Огонь на второй подход'},
 {id:'court',label:'Второй сад',kind:'land',pos:{x:823,y:342},radius:36,purpose:'Охват второй петли'},
 {id:'final',label:'Последний рубеж',kind:'land',pos:{x:1044,y:499},radius:36,purpose:'Резерв у выхода'},
 {id:'meadow',label:'Луговая опора',kind:'land',pos:{x:697,y:552},radius:29,purpose:'Запасная сухая позиция'},
 {id:'creek',label:'Русло ручья',kind:'water',pos:{x:656,y:368},radius:32,purpose:'Будущая водная башня'},
 {id:'oxbow',label:'Старая заводь',kind:'water',pos:{x:74,y:330},radius:24,purpose:'Запасная водная башня'},
];
export interface GeometryReport{map:string;pathLength:number;pathWidth:number;segments:number;travelSeconds:{fast:number;ordinary:number;boss:number};landSites:string[];waterSites:string[];issues:string[];ok:boolean;}
const EPS=1e-7;
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(p:Vec,a:Vec,b:Vec)=>Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
function intersects(a:Vec,b:Vec,c:Vec,d:Vec):boolean{
 const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
 return ((((ab1>EPS&&ab2 < -EPS)||(ab1 < -EPS&&ab2>EPS))&&((cd1>EPS&&cd2 < -EPS)||(cd1 < -EPS&&cd2>EPS)))
  || onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d));
}
const edges=(poly:Vec[]):[Vec,Vec][]=>(poly.map((p,i)=>[p,poly[(i+1)%poly.length]]));
const touches=(p:Vec,r:number,poly:Vec[])=>pointInPolygon(p,poly)||edges(poly).some(([a,b])=>distanceToSegment(p,a,b)<r-EPS);
const contains=(p:Vec,r:number,poly:Vec[])=>pointInPolygon(p,poly)&&edges(poly).every(([a,b])=>distanceToSegment(p,a,b)>=r-EPS);
export function isBuildable(map:MapDef,site:Site):boolean{
 const {pos:p,radius:r}=site;
 if(p.x-r<0||p.y-r<0||p.x+r>WORLD.width||p.y+r>WORLD.height)return false;
 if(map.lanes.some(l=>l.slice(1).some((q,i)=>distanceToSegment(p,l[i],q)<r+map.pathWidth/2-EPS)))return false;
 if(map.blocked.some(poly=>touches(p,r,poly)))return false;
 return site.kind==='water'?map.water.some(poly=>contains(p,r,poly)):map.water.every(poly=>!touches(p,r,poly));
}
export function inspectGeometry(map:MapDef=getMap()):GeometryReport{
 const issues:string[]=[],polys=[...map.blocked,...map.water],points=[...map.lanes.flat(),...polys.flat()];
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>WORLD.width||p.y<0||p.y>WORLD.height))issues.push('coordinate-out-of-bounds');
 if(map.lanes.length!==1)issues.push('expected-one-lane');
 if(map.pathWidth<45||map.pathWidth>75)issues.push('path-width-out-of-design-range');
 for(const [i,lane] of map.lanes.entries()){
  if(lane.length<2||lane.some((p,k)=>k>0&&distance(p,lane[k-1])<18))issues.push(`short-or-zero-segment:${i}`);
  if(lane[0]?.x!==0||lane.at(-1)?.x!==WORLD.width)issues.push(`missing-visible-entry-or-exit:${i}`);
  for(let j=0;j<lane.length-1;j++)for(let k=j+2;k<lane.length-1;k++)if(intersects(lane[j],lane[j+1],lane[k],lane[k+1]))issues.push(`lane-self-intersection:${i}:${j}:${k}`);
 }
 for(const [i,poly] of polys.entries()){
  if(poly.length<3)issues.push(`polygon-too-short:${i}`);
  if(poly.some((p,k)=>distance(p,poly[(k+1)%poly.length])<2))issues.push(`polygon-degenerate-edge:${i}`);
  const area=poly.reduce((sum,p,k)=>sum+p.x*poly[(k+1)%poly.length].y-poly[(k+1)%poly.length].x*p.y,0)/2;
  if(Math.abs(area)<100)issues.push(`polygon-zero-area:${i}`);
  for(let j=0;j<poly.length;j++)for(let k=j+2;k<poly.length;k++){
   if(j===0&&k===poly.length-1)continue;
   if(intersects(poly[j],poly[(j+1)%poly.length],poly[k],poly[(k+1)%poly.length]))issues.push(`polygon-self-intersection:${i}:${j}:${k}`);
  }
 }
 for(let i=0;i<sites.length;i++){
  if(!isBuildable(map,sites[i]))issues.push(`site-not-buildable:${sites[i].id}`);
  for(let j=0;j<i;j++)if(distance(sites[i].pos,sites[j].pos)<sites[i].radius+sites[j].radius-EPS)issues.push(`sites-overlap:${sites[i].id}:${sites[j].id}`);
 }
 const length=laneLength(map.lanes[0]??[]);
 if(length<2200||length>4500)issues.push('path-length-out-of-target');
 const landSites=sites.filter(s=>s.kind==='land').map(s=>s.id),waterSites=sites.filter(s=>s.kind==='water').map(s=>s.id);
 if(landSites.length<6||waterSites.length<1)issues.push('insufficient-build-sites');
 return {map:map.id,pathLength:Math.round(length*100)/100,pathWidth:map.pathWidth,segments:(map.lanes[0]?.length??1)-1,
  travelSeconds:{fast:Math.round(length/132*10)/10,ordinary:Math.round(length/52*10)/10,boss:Math.round(length/17*10)/10},landSites,waterSites,issues,ok:issues.length===0};
}
