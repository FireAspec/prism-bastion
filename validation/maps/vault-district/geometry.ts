import type {MapDef,Vec} from '../../../src/contracts';
import {distance, distanceToSegment, laneLength, pointInPolygon} from '../../../src/contracts/geometry';
import {getMap} from '../../../src/content/maps/vault-district';

export const LAND_SITES = {
  north:{x:635,y:205}, west:{x:453,y:357}, east:{x:875,y:313}, south:{x:634,y:592},
  westReserve:{x:388,y:377}, southReserve:{x:736,y:593},
  exit:{x:1150,y:304}, southExit:{x:1185,y:575},
} as const satisfies Record<string,Vec>;
export const WATER_SITES = {
  upper:{x:102,y:61}, westBasin:{x:301,y:366}, eastBasin:{x:1056,y:480},
} as const satisfies Record<string,Vec>;

const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersects=(a:Vec,b:Vec,c:Vec,d:Vec):boolean=>{
  const a1=cross(a,b,c),a2=cross(a,b,d),b1=cross(c,d,a),b2=cross(c,d,b);
  return a1*a2<0 && b1*b2<0;
};
export function segmentDistance(a:Vec,b:Vec,c:Vec,d:Vec):number {
  if(intersects(a,b,c,d))return 0;
  return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
export function polygonEdgeDistance(p:Vec,polygon:Vec[]):number {
  return Math.min(...polygon.map((v,i)=>distanceToSegment(p,v,polygon[(i+1)%polygon.length])));
}
export function polygonDistance(p:Vec,polygon:Vec[]):number {
  return pointInPolygon(p,polygon)?0:polygonEdgeDistance(p,polygon);
}
export function routePolygonDistance(lane:Vec[],polygon:Vec[]):number {
  let nearest=Infinity;
  for(let i=1;i<lane.length;i++){
    const a=lane[i-1],b=lane[i];
    if(pointInPolygon(a,polygon)||pointInPolygon(b,polygon))return 0;
    for(let j=0;j<polygon.length;j++)
      nearest=Math.min(nearest,segmentDistance(a,b,polygon[j],polygon[(j+1)%polygon.length]));
  }
  return nearest;
}
export function landSiteClearance(map:MapDef,p:Vec):{lane:number;blocked:number;water:number} {
  return {
    lane:Math.min(...map.lanes.flatMap(l=>l.slice(1).map((b,i)=>distanceToSegment(p,l[i],b))))-map.pathWidth/2,
    blocked:Math.min(...map.blocked.map(poly=>polygonDistance(p,poly))),
    water:Math.min(...map.water.map(poly=>polygonDistance(p,poly))),
  };
}
export function isBuildableLand(map:MapDef,p:Vec,footprint:number):boolean {
  const c=landSiteClearance(map,p);
  return [c.lane,c.blocked,c.water].every(n=>n>=footprint-1e-7)&&
    p.x>=footprint&&p.y>=footprint&&p.x<=1280-footprint&&p.y<=720-footprint;
}
export function isBuildableWater(map:MapDef,p:Vec,footprint:number):boolean {
  return map.water.some(poly=>pointInPolygon(p,poly)&&polygonEdgeDistance(p,poly)>=footprint)&&
    map.blocked.every(poly=>polygonDistance(p,poly)>=footprint)&&
    map.lanes.every(l=>l.slice(1).every((b,i)=>distanceToSegment(p,l[i],b)>=map.pathWidth/2+footprint));
}

export interface GeometryReport {
  status:'pass'|'fail';pathWidth:number;laneLengths:number[];fastestTravelSeconds:number[];
  routes:{entrance:Vec;exit:Vec;minBlockedClearance:number;minWaterClearance:number}[];
  landSites:Record<string,boolean>;waterSites:Record<string,boolean>;errors:string[];
}
/** No simulation or combat claim: only fixed-world geometry. */
export function analyseGeometry(map:MapDef=getMap()):GeometryReport {
  const errors:string[]=[];
  const finite=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
  const polyCheck=(poly:Vec[],label:string)=>{
    if(poly.length<3||!poly.every(finite)) errors.push(label+': polygon is invalid/outside world');
    if(Math.abs(poly.reduce((a,p,i)=>a+p.x*poly[(i+1)%poly.length].y-poly[(i+1)%poly.length].x*p.y,0))<1)errors.push(label+': zero polygon area');
    for(let i=0;i<poly.length;i++){
      if(distance(poly[i],poly[(i+1)%poly.length])<1)errors.push(label+': duplicate polygon vertices');
      for(let j=i+2;j<poly.length;j++){
        if(i===0&&j===poly.length-1)continue;
        if(intersects(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))
          errors.push(label+': self-intersection');
      }
    }
  };
  if(map.lanes.length!==3)errors.push('expected exactly three lanes');
  if(map.pathWidth!==44)errors.push('path width is outside agreed artwork');
  const laneLengths=map.lanes.map(l=>laneLength(l));
  map.lanes.forEach((lane,i)=>{
    if(lane.length<2||!lane.every(finite))errors.push('lane '+i+': invalid vertices');
    if(lane.some((p,j)=>j>0&&distance(p,lane[j-1])<20))errors.push('lane '+i+': short/zero segment');
    if(lane[0].x!==0||lane[lane.length-1].x!==1280)errors.push('lane '+i+': invisible entrance/exit');
    if(laneLengths[i]<1400)errors.push('lane '+i+': insufficient reaction distance');
    for(let a=0;a<lane.length-1;a++)for(let b=a+2;b<lane.length-1;b++){
      if(segmentDistance(lane[a],lane[a+1],lane[b],lane[b+1])<map.pathWidth)
        errors.push('lane '+i+': self-overlapping corridor');
    }
  });
  if(new Set(map.lanes.map(l=>l[0].y)).size!==3||new Set(map.lanes.map(l=>l[l.length-1].y)).size!==3)
    errors.push('entry/exit markers overlap');
  map.blocked.forEach((p,i)=>polyCheck(p,'blocked '+i));
  map.water.forEach((p,i)=>polyCheck(p,'water '+i));
  const routes=map.lanes.map(l=>{
    const b=Math.min(...map.blocked.map(poly=>routePolygonDistance(l,poly)));
    const w=Math.min(...map.water.map(poly=>routePolygonDistance(l,poly)));
    if(b<=map.pathWidth/2+4)errors.push('blocked polygon cuts path');
    if(w<=map.pathWidth/2+4)errors.push('water cuts path');
    return {entrance:l[0],exit:l[l.length-1],minBlockedClearance:b,minWaterClearance:w};
  });
  const landSites=Object.fromEntries(Object.entries(LAND_SITES).map(([name,p])=>[name,isBuildableLand(map,p,24)]));
  const waterSites=Object.fromEntries(Object.entries(WATER_SITES).map(([name,p])=>[name,isBuildableWater(map,p,20)]));
  for(const [name,valid] of Object.entries(landSites))if(!valid)errors.push('invalid land footprint at '+name);
  for(const [name,valid] of Object.entries(waterSites))if(!valid)errors.push('invalid water footprint at '+name);
  return {status:errors.length?'fail':'pass',pathWidth:map.pathWidth,laneLengths,
    fastestTravelSeconds:laneLengths.map(n=>n/132),routes,landSites,waterSites,errors};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/vault-district/geometry.ts')){
  const report=analyseGeometry();
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status==='fail')process.exitCode=1;
}
