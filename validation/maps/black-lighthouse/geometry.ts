import type {MapDef,Vec} from '../../../src/contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';
import {getMap} from '../../../src/content/maps/black-lighthouse';

export interface Site {id:string;label:string;pos:Vec;radius:number;kind:'land'|'water';role:string;}
/** Named suggested sites are recommendations, not an extra placement rule. */
export const sites:Site[] = [
  {id:'north-watch',label:'Северный наблюдатель',pos:{x:736,y:103},radius:24,kind:'land',role:'early northern route'},
  {id:'west-cross',label:'Западный перехват',pos:{x:300,y:230},radius:24,kind:'land',role:'northern / central crossing coverage'},
  {id:'twin-arcs',label:'Двойная дуга',pos:{x:518,y:276},radius:24,kind:'land',role:'midfield support, northern / central reach'},
  {id:'signal-shelf',label:'Сигнальный уступ',pos:{x:690,y:260},radius:24,kind:'land',role:'long-range northern / central control'},
  {id:'south-cross',label:'Южный перехват',pos:{x:351,y:514},radius:24,kind:'land',role:'early central / southern split'},
  {id:'tide-ramp',label:'Приливная рампа',pos:{x:788,y:411},radius:24,kind:'land',role:'short-range central / southern crossfire'},
  {id:'last-light',label:'Последний свет',pos:{x:1012,y:235},radius:24,kind:'land',role:'multi-lane convergence and shared exit'},
  {id:'southern-redoubt',label:'Южный редут',pos:{x:1055,y:463},radius:24,kind:'land',role:'final shared line / southern flank'},
  {id:'inner-harbor',label:'Внутренняя гавань',pos:{x:130,y:224},radius:22,kind:'water',role:'early water-only coverage'},
  {id:'tidal-basin',label:'Приливный бассейн',pos:{x:592,y:457},radius:22,kind:'water',role:'central / southern water-only coverage'},
  {id:'southern-deep',label:'Южная глубина',pos:{x:1095,y:582},radius:26,kind:'water',role:'future long-range naval battery'},
];

const EPS=1e-7;

function edgeDistance(p:Vec,polygon:Vec[]):number {
  return Math.min(...polygon.map((v,i)=>distanceToSegment(p,v,polygon[(i+1)%polygon.length])));
}

function orient(a:Vec,b:Vec,c:Vec):number {
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function onSegment(a:Vec,b:Vec,p:Vec):boolean {
  return Math.abs(orient(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&
    p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
}

function segmentsIntersect(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
  const abC=orient(a,b,c),abD=orient(a,b,d),cdA=orient(c,d,a),cdB=orient(c,d,b);
  return (abC*abD < -EPS && cdA*cdB < -EPS)||
    (Math.abs(abC)<EPS&&onSegment(a,b,c))||
    (Math.abs(abD)<EPS&&onSegment(a,b,d))||
    (Math.abs(cdA)<EPS&&onSegment(c,d,a))||
    (Math.abs(cdB)<EPS&&onSegment(c,d,b));
}

function segmentPolygonDistance(a:Vec,b:Vec,poly:Vec[]):number {
  if(pointInPolygon(a,poly)||pointInPolygon(b,poly))return 0;
  let nearest=Infinity;
  for(let i=0;i<poly.length;i++){
    const c=poly[i],d=poly[(i+1)%poly.length];
    if(segmentsIntersect(a,b,c,d))return 0;
    nearest=Math.min(nearest,distanceToSegment(c,a,b),distanceToSegment(a,c,d),distanceToSegment(b,c,d));
  }
  return nearest;
}

export function clearanceFromRoad(map:MapDef,p:Vec):number {
  return Math.min(...map.lanes.flatMap(lane=>lane.slice(1).map((b,i)=>distanceToSegment(p,lane[i],b))))-
    map.pathWidth/2;
}

/** Full circular footprint, not just the centre, with two pixels of tolerance. */
export function canPlace(map:MapDef,p:Vec,radius:number,kind:'land'|'water'):boolean {
  if(!(radius>0)||![p.x,p.y,radius].every(Number.isFinite))return false;
  if(p.x<radius+2||p.x>1280-radius-2||p.y<radius+2||p.y>720-radius-2)return false;
  if(clearanceFromRoad(map,p)<radius+2)return false;
  if(map.blocked.some(poly=>pointInPolygon(p,poly)||edgeDistance(p,poly)<radius+2))return false;
  if(kind==='land'){
    return map.water.every(poly=>!pointInPolygon(p,poly)&&edgeDistance(p,poly)>=radius+2);
  }
  return map.water.some(poly=>pointInPolygon(p,poly)&&edgeDistance(p,poly)>=radius+2);
}

export interface GeometryReport {
  errors:string[];
  lanes:{index:number;length:number;travelSecondsAt52:number;travelSecondsAt132:number}[];
  sites:{id:string;valid:boolean;roadClearance:number}[];
}

export function auditGeometry(map:MapDef):GeometryReport {
  const errors:string[]=[];
  const inWorld=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
  if(map.lanes.length!==3)errors.push('expected three permanent lanes');
  if(!(map.pathWidth>=32&&map.pathWidth<=48))errors.push('path width outside 32..48 px');
  map.lanes.forEach((lane,i)=>{
    if(lane.length<2)errors.push(`lane ${i} has too few points`);
    lane.forEach((p,j)=>{
      if(!inWorld(p))errors.push(`lane ${i} vertex ${j} outside world`);
      if(j>0&&distance(lane[j-1],p)<EPS)errors.push(`lane ${i} zero-length segment ${j}`);
    });
    if(lane[0]?.x!==0)errors.push(`lane ${i} does not enter visibly at western edge`);
    if(lane.at(-1)?.x!==1280)errors.push(`lane ${i} does not exit visibly at eastern edge`);
    const tail=lane.slice(-3);
    if(JSON.stringify(tail)!==JSON.stringify(map.lanes[0]?.slice(-3)))errors.push(`lane ${i} is not joined at final defence line`);
    for(let k=1;k<lane.length;k++){
      for(let j=0;j<map.blocked.length;j++){
        if(segmentPolygonDistance(lane[k-1],lane[k],map.blocked[j])<map.pathWidth/2+1)
          errors.push(`lane ${i} road corridor intersects blocked polygon ${j} at segment ${k}`);
      }
    }
  });
  for(const [group,polys] of [['water',map.water],['blocked',map.blocked]] as const){
    polys.forEach((poly,k)=>{
      if(poly.length<3)errors.push(`${group} ${k} has fewer than 3 vertices`);
      const area=poly.reduce((sum,p,i)=>sum+p.x*poly[(i+1)%poly.length].y-poly[(i+1)%poly.length].x*p.y,0)/2;
      if(Math.abs(area)<EPS)errors.push(`${group} ${k} has zero area`);
      poly.forEach((p,i)=>{
        if(!inWorld(p))errors.push(`${group} ${k} vertex ${i} outside world`);
        if(distance(p,poly[(i+1)%poly.length])<EPS)errors.push(`${group} ${k} duplicate adjacent vertices`);
        for(let j=i+2;j<poly.length;j++){
          if(i===0&&j===poly.length-1)continue;
          if(segmentsIntersect(p,poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))
            errors.push(`${group} ${k} self-intersection ${i}-${j}`);
        }
      });
    });
  }
  const placements=sites.map(site=>({id:site.id,valid:canPlace(map,site.pos,site.radius,site.kind),
    roadClearance:clearanceFromRoad(map,site.pos)}));
  for(const site of placements)if(!site.valid)errors.push(`illegal advertised site: ${site.id}`);
  if(placements.filter(s=>s.valid&&sites.find(t=>t.id===s.id)?.kind==='land').length<6)
    errors.push('insufficient dry hardpoints');
  if(placements.filter(s=>s.valid&&sites.find(t=>t.id===s.id)?.kind==='water').length<2)
    errors.push('insufficient legal water-only hardpoints');
  const lanes=map.lanes.map((lane,index)=>({index,length:laneLength(lane),
    travelSecondsAt52:laneLength(lane)/52,travelSecondsAt132:laneLength(lane)/132}));
  if(lanes.length===3&&Math.max(...lanes.map(l=>l.length))-Math.min(...lanes.map(l=>l.length))<160)
    errors.push('approaches are not meaningfully different lengths');
  return {errors,lanes,sites:placements};
}

// `npx tsx validation/maps/black-lighthouse/geometry.ts` is a standalone audit.
if(process.argv[1]?.replaceAll('\\','/').endsWith('/validation/maps/black-lighthouse/geometry.ts')){
  const report=auditGeometry(getMap());
  console.log(JSON.stringify(report,null,2));
  if(report.errors.length)process.exitCode=1;
}
